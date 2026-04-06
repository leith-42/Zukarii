import { System } from '../core/Systems.js';
import { JourneyPathComponent, DialogueComponent, InteractionIntentComponent, ShopInteractionComponent, StashInteractionComponent, JourneyPathsComponent, OfferedJourneysComponent, JourneyStateComponent } from '../core/Components.js';

export class InteractionSystem extends System {
    constructor(entityManager, eventBus, utilities) {
        super(entityManager, eventBus);
        this.requiredComponents = [];
        this.utilities = utilities;
        this.queues = this.entityManager.getEntity('gameState').getComponent('DataProcessQueues') || {};
        this.pathTransfers = this.queues.pathTransfers || [];
        this.shownCompletions = new Set();
    }

    init() {
        this.shownCompletions.clear();
        console.log('InteractionSystem: Cleared shownCompletions on init');
    }

    update(deltaTime) {
        while (this.pathTransfers.length > 0) {
            const transfer = this.pathTransfers.shift();
            this.processPathTransfer(transfer);
        }

        const player = this.entityManager.getEntity('player');
        const intent = player.getComponent('InteractionIntent');
        if (intent && intent.intents.length > 0) {
            intent.intents.forEach(({ action, params }) => {
                if (action === 'interactWithNPC') {
                    this.handleInteractWithNPC(params);
                } else if (action === 'acceptJourney') {
                    this.handleAcceptJourney(params);
                } else if (action === 'openShop') {
                    this.handleOpenShop(params);
                } else if (action === 'openStash') {
                    this.handleOpenStash(params);
                } else if (action === 'turnIn') {
                    this.handleTurnIn(params);
                } else if (action === 'acknowledgeCompletion') {
                    this.handleAcknowledgeCompletion(params);
                } else if (action === 'completeTask') {
                    this.handleCompleteTask(params);
                } else if (action === 'selectPortalTier') {
                    this.handleSelectPortalTier(params);
                } else if (action === 'updatePortalInteraction') {
                    this.updatePortalInteraction(params);
                }
                console.log(`InteractionSystem: Processed intent: ${action}`, params);
            });
            intent.intents = [];
            console.log('InteractionSystem: Cleared InteractionIntent intents');
        }
    }

    updatePortalInteraction({ action, portalId, tier }) {
        const player = this.entityManager.getEntity('player');
        const portalInteractionComp = player.getComponent('PortalInteraction');

        if (!portalInteractionComp) {
            console.error('InteractionSystem: PortalInteractionComponent not found on player.');
            return;
        }

        portalInteractionComp.action = action;
        portalInteractionComp.params = { portalId, tier };
        console.log(`InteractionSystem: Updated PortalInteractionComponent`, portalInteractionComp);
    }

    handleSelectPortalTier({ tier }) {
        const levelTransition = this.entityManager.getEntity('gameState').getComponent('LevelTransition');

        // Set destinationTier to null for randomization or the selected tier
        levelTransition.destinationTier = tier === '?' ? null : tier;

        levelTransition.pendingTransition = 'portal';
        console.log(`InteractionSystem: Set pendingTransition to 'portal' with destinationTier: ${levelTransition.destinationTier}`);
    }

    handleInteractWithNPC({ npcId }) {
        const npc = this.entityManager.getEntity(npcId);
        if (!npc || !npc.hasComponent('NPCData')) {
            console.error(`InteractionSystem: NPC ${npcId} not found or missing NPCData`);
            return;
        }


        const npcData = npc.getComponent('NPCData');
        console.log(`InteractionSystem: Interacting with NPC ${npcId}, NPCData ID: ${npcData.id}, Name: ${npcData.name}`);

        const dialogue = this.entityManager.getEntity('dialogueState').getComponent('Dialogue');
        if (!dialogue) {
            console.error('InteractionSystem: Dialogue component not found on dialogueState');
            return;
        }

        // Find active interactWithNPC task for this NPC
        const player = this.entityManager.getEntity('player');
        const journeyPath = player.getComponent('JourneyPath');
        let taskId = null;
        if (journeyPath) {
            journeyPath.paths.forEach(path => {
                if (path.id === path.parentId || path.completed) return;
                path.tasks?.forEach(task => {
                    if (!task.completed && (task.completionCondition.type === 'interactWithNPC' || task.completionCondition.type === 'interactWithNPCFinal') && task.completionCondition.npc === npcData.id) {
                        taskId = task.id;
                        /*
                        if (task.id === 'whisper_child_2_4') {
                            console.log(`InteractionSystem: Found whisper_child_2_4 for NPC ${npcData.id}`, {
                                taskId: task.id,
                                completed: task.completed,
                                condition: task.completionCondition
                            });
                        }
                        */
                    }
                });
            });
        }

        this.utilities.pushPlayerActions('interactWithNPC', { npcId, taskId });
        console.log(`InteractionSystem: Pushed interactWithNPC to PlayerActionQueue`, { npcId, taskId });
        /*
        if (taskId === 'whisper_child_2_4') {
            console.log(`InteractionSystem: Queued action for whisper_child_2_4`, { npcId, taskId });
        }
        */

        this.refreshDialogue(npcId);
    }

    handleAcceptJourney({ journeyId, npcId }) {
        const gameState = this.entityManager.getEntity('gameState');
        const offeredJourneysComp = gameState.getComponent('OfferedJourneys');
        const journeyPathsComp = gameState.getComponent('JourneyPaths');
        const player = this.entityManager.getEntity('player');
        const journeyPath = player.getComponent('JourneyPath');

        if (!offeredJourneysComp) {
            console.error('InteractionSystem: OfferedJourneys component not found on gameState');
            return;
        }
        if (!journeyPathsComp) {
            console.error('InteractionSystem: JourneyPaths component not found on gameState');
            return;
        }
        if (!journeyPath) {
            console.error('InteractionSystem: JourneyPath component not found on player');
            return;
        }

        const offeredJourney = offeredJourneysComp.journeys.find(q => q.journeyId === journeyId);
        if (!offeredJourney) {
            console.error(`InteractionSystem: Offered journey ${journeyId} not found`);
            return;
        }

        const journeyData = journeyPathsComp.paths.find(path => path.id === journeyId);
        if (!journeyData) {
            console.error(`InteractionSystem: Journey data for ${journeyId} not found`);
            return;
        }

        journeyPath.paths.push({ ...journeyData, accepted: true });
        offeredJourneysComp.journeys = offeredJourneysComp.journeys.filter(q => q.journeyId !== journeyId);
        this.utilities.logMessage({ channel: "journey", message: `Journey accepted: ${journeyData.title}` });
        this.eventBus.emit('JourneyStateUpdated');
        console.log(`InteractionSystem: Journey ${journeyId} accepted by player`);
        /*
        if (journeyId === 'whisper_parent_3') {
            console.log(`InteractionSystem: Accepted whisper_parent_3`);
        }
        */

        const dialogue = this.entityManager.getEntity('dialogueState').getComponent('Dialogue');
        if (dialogue) {
            dialogue.text = '';
            dialogue.options = [];
            dialogue.isOpen = false;
        }

        this.refreshDialogue(npcId);
    }

    handleOpenShop({ npcId }) {
        const npc = this.entityManager.getEntity(npcId);
        if (!npc || !npc.hasComponent('ShopComponent')) {
            console.error(`InteractionSystem: NPC ${npcId} not found or missing ShopComponent`);
            return;
        }
        const player = this.entityManager.getEntity('player');
        if (!player.hasComponent('ShopInteraction')) {
            player.addComponent(new ShopInteractionComponent());
            console.log(`InteractionSystem: Added ShopInteractionComponent to player for NPC ${npcId}`);
        }
        this.eventBus.emit('ToggleOverlay', { tab: 'shop', fromShop: true, npcId });
        this.utilities.logMessage({ channel: "system", message: `Opened shop for ${npc.getComponent('NPCData').name}` });
        console.log(`InteractionSystem: Emitted ToggleOverlay for shop with NPC ${npcId}`);
    }

    handleOpenStash() {
        const player = this.entityManager.getEntity('player');
        if (!player) {
            console.error('InteractionSystem: Player entity not found');
            return;
        }

        // Check if stash is unlocked
        if (!player.hasComponent('Stash')) {
            this.utilities.logMessage({ channel: "system", message: 'Stash is locked. Purchase access from the shopkeeper.' });
            return;
        }

        // Add StashInteraction component if not present
        if (!player.hasComponent('StashInteraction')) {
            player.addComponent(new StashInteractionComponent());
            console.log('InteractionSystem: Added StashInteractionComponent to player');
        }

        this.eventBus.emit('ToggleOverlay', { tab: 'stash', fromStash: true });
        this.utilities.logMessage({ channel: "system", message: 'Opened stash' });
        console.log('InteractionSystem: Emitted ToggleOverlay for stash');
    }

    handleTurnIn({ taskId, resourceType, itemId, quantity, npcId }) {
        const npcEntity = this.entityManager.getEntity(npcId);
        if (!npcEntity || !npcEntity.hasComponent('NPCData')) {
            console.error(`InteractionSystem: NPC entity ${npcId} not found or missing NPCData`);
            return;
        }
        console.log(`InteractionSystem: Handling turnIn intent`, { taskId, resourceType, itemId, quantity, npcId });
        this.utilities.pushPlayerActions('turnIn', { taskId, resourceType, itemId, quantity, npcId });
        console.log(`InteractionSystem: Pushed turnIn to PlayerActionQueue`, { taskId, resourceType, itemId, quantity, npcId });
        this.refreshDialogue(npcId);
    }

    handleCompleteTask({ taskId, npcId }) {
        const player = this.entityManager.getEntity('player');
        const journeyPath = player.getComponent('JourneyPath');
        const dialogue = this.entityManager.getEntity('dialogueState').getComponent('Dialogue');
        if (!journeyPath || !dialogue) {
            console.error('InteractionSystem: Missing JourneyPath or Dialogue component');
            return;
        }

        let task = null;
        journeyPath.paths.forEach(path => {
            if (path.id === path.parentId || path.completed) return;
            const foundTask = path.tasks?.find(t => t.id === taskId && !t.completed);
            if (foundTask) task = foundTask;
        });

        if (task) {
            this.utilities.pushPlayerActions('interactWithNPC', { npcId: task.completionCondition.npc, taskId });
            console.log(`InteractionSystem: Pushed interactWithNPC for task ${taskId}`);
            /*
            if (taskId === 'whisper_child_2_4') {
                console.log(`InteractionSystem: Queued completeTask action for whisper_child_2_4`, { npcId: task.completionCondition.npc, taskId });
            }
            */
        }

        dialogue.text = '';
        dialogue.options = [];
        dialogue.isOpen = true;
        this.refreshDialogue(npcId);
        console.log(`InteractionSystem: Processed completeTask for ${taskId}`);
    }

    handleAcknowledgeCompletion({ journeyId, npcId }) {
        const dialogue = this.entityManager.getEntity('dialogueState').getComponent('Dialogue');
        const player = this.entityManager.getEntity('player');
        const journeyState = player.getComponent('JourneyState');
        if (!dialogue) {
            console.error('InteractionSystem: Dialogue component not found on dialogueState');
            return;
        }
        if (!journeyState) {
            console.error('InteractionSystem: JourneyState component not found on player');
            return;
        }

        this.eventBus.emit('FinalizeJourneyCompletion', { journeyId });
        journeyState.completedPaths = journeyState.completedPaths.filter(path => path.id !== journeyId);
        this.eventBus.emit('JourneyStateUpdated');
        console.log(`InteractionSystem: Acknowledged completion of journey ${journeyId}`);
        if (journeyId === 'whisper_parent_2') {
            console.log(`InteractionSystem: Completed acknowledgement for whisper_parent_2`);
        }

        dialogue.text = '';
        dialogue.options = [];
        dialogue.isOpen = true;

        this.refreshDialogue(npcId);
    }

    refreshDialogue(npcId) {
        const npc = this.entityManager.getEntity(npcId);
        if (!npc || !npc.hasComponent('NPCData')) {
            console.error(`InteractionSystem: NPC ${npcId} not found or missing NPCData`);
            return false;
        }
        const npcData = npc.getComponent('NPCData');
        const dialogue = this.entityManager.getEntity('dialogueState').getComponent('Dialogue');
        const player = this.entityManager.getEntity('player');
        const journeyPath = player.getComponent('JourneyPath');
        const journeyState = player.getComponent('JourneyState');
        const gameState = this.entityManager.getEntity('gameState');
        const journeyPathsComp = gameState.getComponent('JourneyPaths');
        const offeredJourneysComp = gameState.getComponent('OfferedJourneys');

        if (!dialogue || !journeyPath || !journeyState || !journeyPathsComp || !offeredJourneysComp) {
            console.error('InteractionSystem: Missing required components for refreshDialogue');
            return false;
        }

        dialogue.options = [];

        // Check for interactWithNPCFinal tasks
        let finalTaskHandled = false;
        journeyPath.paths.forEach(path => {
            if (path.id === path.parentId || path.completed) return;
            path.tasks?.forEach(task => {
                if (!task.completed && task.completionCondition.type === 'interactWithNPCFinal' && task.completionCondition.npc === npcData.id) {
                    if ((path.completedTaskCount || 0) < (path.totalTaskCount || 0) - 1) {
                        dialogue.text = task.activeText || "You must complete all other tasks for this journey.";
                        dialogue.options = [{ label: "Close", action: "closeDialogue", params: {} }];
                        dialogue.isOpen = true;
                        dialogue.npcId = npcId;
                        dialogue.dialogueStage = 'task';
                        console.log(`InteractionSystem: Set not-ready dialogue for task ${task.id}`, {
                            text: dialogue.text,
                            totalTaskCount: path.totalTaskCount,
                            completedTaskCount: path.completedTaskCount
                        });

                        finalTaskHandled = true;
                    } else {
                        console.log(`InteractionSystem: Task ${task.id} ready for completion`, {
                            totalTaskCount: path.totalTaskCount,
                            completedTaskCount: path.completedTaskCount
                        });
                    }
                }
            });
        });
        if (finalTaskHandled) return true;

        // Check JourneyDialogueComponent
        if (npc.hasComponent('JourneyDialogue')) {
            const dialogueComp = npc.getComponent('JourneyDialogue');
            const dialogueEntries = Object.entries(dialogueComp.dialogues);
            if (dialogueEntries.length > 0) {
                const completionEntry = dialogueEntries.find(([id]) => journeyState.completedPaths.some(p => p.id === id));
                const activeEntry = dialogueEntries.find(([id]) => id.startsWith('whisper_child') && !journeyState.completedPaths.some(p => p.id === id));
                const offerEntry = dialogueEntries.find(([id]) => offeredJourneysComp.journeys.some(q => q.journeyId === id));

                const selectedEntry = completionEntry || offerEntry || activeEntry;
                if (selectedEntry) {
                    const [id, entry] = selectedEntry;
                    // Check if the task is completed
                    let taskCompleted = false;
                    journeyPath.paths.forEach(path => {
                        if (path.id === path.parentId || path.completed) return;
                        const task = path.tasks?.find(t => t.id === id);
                        if (task && task.completed) {
                            taskCompleted = true;
                        }
                    });

                    if (taskCompleted) {
                        dialogue.text = `Task completed: ${entry.text}`;
                        dialogue.options = [{ label: "Close", action: "closeDialogue", params: {} }];
                    } else {
                        dialogue.text = entry.text;
                        if (entry.action) {
                            const params = { ...entry.params, npcId }; // Use entity ID
                            dialogue.options.push({
                                label: entry.action === 'acknowledgeCompletion' ? 'OK' :
                                    entry.action === 'completeTask' ? 'OK' :
                                        entry.action === 'turnIn' ? 'Deliver' : 'Accept',
                                action: entry.action,
                                params
                            });
                        }
                        dialogue.options.push({ label: "Close", action: "closeDialogue", params: {} });
                    }
                    dialogue.isOpen = true;
                    dialogue.npcId = npcId;
                    dialogue.dialogueStage = entry.action || 'task';
                    console.log(`InteractionSystem: Set dialogue from JourneyDialogueComponent for ${id}`, entry);
                    if (id === 'whisper_child_4_5') {
                        console.log(`InteractionSystem: Dialogue set for whisper_child_4_5`, { text: dialogue.text, action: entry.action, label: dialogue.options[0]?.label, npcId, taskCompleted });
                    }
                    return true;
                }
            }
        }

        // Fallback to existing logic
        const completedPaths = [...journeyState.completedPaths].sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
        const completedJourney = completedPaths.find(path =>
            path.completionText && !this.shownCompletions.has(path.id)
        );
        if (completedJourney) {
            dialogue.text = `Journey completed: ${completedJourney.title}. Rewards: ${this.formatRewards(journeyPathsComp.paths.find(p => p.id === completedJourney.id)?.rewards || [])}`;
            dialogue.options = [
                { label: 'OK', action: 'acknowledgeCompletion', params: { journeyId: completedJourney.id, npcId } },
                { label: 'Close', action: 'closeDialogue', params: {} }
            ];
            dialogue.isOpen = true;
            dialogue.npcId = npcId;
            dialogue.dialogueStage = 'completion';
            this.shownCompletions.add(completedJourney.id);
            console.log(`InteractionSystem: Showing completion message for journey ${completedJourney.id}`);

            return true;
        }

        const offeredJourneys = offeredJourneysComp.journeys.filter(
            journey => journey.offeredBy === npcData.id && !journeyPath.paths.some(p => p.id === journey.journeyId)
        );
        if (offeredJourneys.length > 0) {
            const journey = offeredJourneys[0];
            const journeyData = journeyPathsComp.paths.find(path => path.id === journey.journeyId);
            if (!journeyData) {
                console.error(`InteractionSystem: Journey data for ${journey.journeyId} not found`);
                return false;
            }
            dialogue.text = `I have a task for you: ${journeyData.title}. ${journeyData.description} Will you accept?`;
            dialogue.options = [
                { label: 'Accept', action: 'acceptJourney', params: { journeyId: journey.journeyId, npcId } },
                { label: 'Close', action: 'closeDialogue', params: {} }
            ];
            dialogue.isOpen = true;
            dialogue.npcId = npcId;
            dialogue.dialogueStage = 'journeyOffer';
            console.log(`InteractionSystem: Offering journey ${journey.journeyId}`);
            /*
            if (journey.journeyId === 'whisper_parent_3') {
                console.log(`InteractionSystem: Offering whisper_parent_3`, { text: dialogue.text });
            }
            */
            return true;
        }

        let hasTurnInOptions = false;
        journeyPath.paths.forEach(path => {
            if (path.id === path.parentId || path.completed) return;
            path.tasks?.forEach(task => {
                console.log(`InteractionSystem: Checking task ${task.id} for NPC ${npcData.id}`, { completed: task.completed, condition: task.completionCondition });
                if (!task.completed && task.completionCondition.type === 'turnIn' && task.completionCondition.npc === npcData.id) {
                    const condition = task.completionCondition;
                    dialogue.options.push({
                        label: `Deliver ${condition.quantity} ${condition.resourceType || condition.itemId}`,
                        action: 'turnIn',
                        params: { taskId: task.id, resourceType: condition.resourceType, itemId: condition.itemId, quantity: condition.quantity, npcId }
                    });
                    hasTurnInOptions = true;
                } else if (task.completed && task.completionCondition.type === 'turnIn' && task.completionCondition.npc === npcData.id) {
                    dialogue.text = `Task completed: Delivered ${task.completionCondition.quantity} ${task.completionCondition.resourceType || task.completionCondition.itemId}`;
                    dialogue.options = [{ label: "Close", action: "closeDialogue", params: {} }];
                    dialogue.isOpen = true;
                    dialogue.npcId = npcId;
                    dialogue.dialogueStage = 'taskCompletion';
                    console.log(`InteractionSystem: Set completion dialogue for task ${task.id}`, { text: dialogue.text });
                    return true;
                }
            });
        });

        const shopComponent = npc.hasComponent('ShopComponent') ? npc.getComponent('ShopComponent') : null;
        const shopDialogueText = shopComponent ? shopComponent.dialogueText : null;
        if (hasTurnInOptions || shopDialogueText) {
            dialogue.text = hasTurnInOptions ? 'What do you have for me?' : 'Greetings, adventurer.';
            if (shopDialogueText && !hasTurnInOptions) {
                dialogue.options.push({ label: 'Shop', action: 'openShop', params: { npcId } });
            }
            dialogue.options.push({ label: 'Close', action: 'closeDialogue', params: {} });
            dialogue.isOpen = true;
            dialogue.npcId = npcId;
            dialogue.dialogueStage = 'greeting';
            console.log(`InteractionSystem: Set default dialogue for NPC ${npcId}`, { text: dialogue.text });
            return true;
        }

        dialogue.text = 'Greetings, adventurer.';
        dialogue.options = [{ label: 'Close', action: 'closeDialogue', params: {} }];
        dialogue.isOpen = true;
        dialogue.npcId = npcId;
        dialogue.dialogueStage = 'greeting';
        console.log(`InteractionSystem: Set fallback greeting for NPC ${npcId}`);
        return true;
    }

    formatRewards(rewards) {
        const rewardStrings = rewards.map(reward => {
            if (reward.xp) return `${reward.xp} XP`;
            if (reward.gold) return `${reward.gold} gold`;
            if (reward.type === 'item') return `${reward.quantity || 1} ${reward.itemId}`;
            if (reward.type === 'unlock') return `${reward.mechanic}`;
            return '';
        }).filter(str => str);
        return rewardStrings.join(', ');
    }

    processPathTransfer({ sourceEntityId, targetEntityId, journeyPathCompId }) {
        const sourceEntity = this.entityManager.getEntity(sourceEntityId);
        const targetEntity = this.entityManager.getEntity(targetEntityId);
        if (!sourceEntity || !targetEntity) {
            console.error(`InteractionSystem: Source (${sourceEntityId}) or target (${targetEntityId}) entity not found`);
            return;
        }

        const sourceJourneyPath = sourceEntity.getComponent('JourneyPath');
        const targetJourneyPath = targetEntity.getComponent('JourneyPath');
        if (!sourceJourneyPath || !targetJourneyPath) {
            console.error('InteractionSystem: JourneyPath component missing on source or target');
            return;
        }

        const pathToTransfer = sourceJourneyPath.paths.find(path => path.id === journeyPathCompId);
        if (!pathToTransfer) {
            console.error(`InteractionSystem: Path ${journeyPathCompId} not found on source entity ${sourceEntityId}`);
            return;
        }

        targetJourneyPath.paths.push({ ...pathToTransfer });
        this.utilities.removePath(sourceJourneyPath, journeyPathCompId);
        console.log(`InteractionSystem: Transferred path ${journeyPathCompId} from ${sourceEntityId} to ${targetEntityId}`);
        this.eventBus.emit('JourneyStateUpdated');
    }
}
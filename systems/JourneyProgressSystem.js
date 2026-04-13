import { System } from '../core/Systems.js';
import { JourneyUpdateQueueComponent, JourneyPathComponent, JourneyStateComponent, OfferedJourneysComponent, PlayerActionQueueComponent, JourneyRewardComponent } from '../core/Components.js';

export class JourneyProgressSystem extends System {
    constructor(entityManager, eventBus, utilities) {
        super(entityManager, eventBus, utilities);
        this.requiredComponents = [];
    }

    async init() {
        this.eventBus.on('FinalizeJourneyCompletion', ({ journeyId }) => {
            this.finalizeJourneyCompletion(journeyId);
        });
    }

    update(deltaTime) {
        const gameState = this.entityManager.getEntity('gameState');
        const player = this.entityManager.getEntity('player');
        const journeyUpdateQueue = gameState.getComponent('JourneyUpdateQueue');
        const journeyPath = player.getComponent('JourneyPath');
        const journeyState = player.getComponent('JourneyState');
        const offeredJourneys = gameState.getComponent('OfferedJourneys');
        const inventory = player.getComponent('Inventory');
        const resource = player.getComponent('Resource');
        const journeyPathsComp = gameState.getComponent('JourneyPaths');

        if (!journeyUpdateQueue || !journeyPath || !journeyState || !offeredJourneys || !inventory || !resource || !journeyPathsComp) {
            console.error('JourneyProgressSystem: Missing required components');
            return;
        }

        // Process equipGear tasks
        const hasEquipGearTask = journeyPath.paths.some(path =>
            path.tasks?.some(task => !task.completed && task.completionCondition.type === 'equipGear')
        );
        if (hasEquipGearTask) {
            journeyPath.paths.forEach(path => {
                if (path.completed || path.id === path.parentId) return;
                path.tasks?.forEach(task => {
                    if (!task.completed && task.completionCondition.type === 'equipGear') {
                        if (this.checkEquipGear(task, inventory)) {
                            task.completed = true;
                            task.completedAt = Date.now();
                            this.utilities.logMessage({ channel: "journey", message: task.completionText });
                            this.eventBus.emit('DialogueMessage', { message: task.completionText });
                            
                            this.eventBus.emit('JourneyStateUpdated');
                            console.log(`JourneyProgressSystem: Completed equipGear task ${task.id}`);
                            this.updateTaskCounts(path);
                        }
                    }
                });
            });
        }

        // Process actions with task-specific validation
        const processedActions = new Set();
        journeyUpdateQueue.queue.forEach((action, index) => {
            let actionProcessed = false;
            journeyPath.paths.forEach(path => {
                if (path.completed || path.id === path.parentId) return;
                path.tasks?.forEach(task => {
                    if (!task.completed && this.matchesTask(action, task)) {
                        console.log(`JourneyProgressSystem: Task ${task.id} matches action ${action.type}`, { actionData: action.data, taskCondition: task.completionCondition });
                        if (task.id === 'whisper_child_2_4' || task.id === 'whisper_child_3_4' || task.id === 'whisper_child_4_5') {
                            console.log(`JourneyProgressSystem: Processing ${task.id} with parent ${path.id}`, {
                                totalTaskCount: path.totalTaskCount,
                                completedTaskCount: path.completedTaskCount
                            });
                        }
                        task.completed = true;
                        task.completedAt = Date.now();
                        this.utilities.logMessage({ channel: "journey", message: task.completionText });
                        this.eventBus.emit('DialogueMessage', { message: task.completionText });
                        this.eventBus.emit('JourneyStateUpdated');
                        console.log(`JourneyProgressSystem: Completed task ${task.id} for action ${action.type}`);
                        this.updateTaskCounts(path);
                        actionProcessed = true;
                    } else if (task.id === 'whisper_child_2_4' || task.id === 'whisper_child_3_4' || task.id === 'whisper_child_4_5') {
                        console.log(`JourneyProgressSystem: Task ${task.id} did not match action ${action.type}`, {
                            actionData: action.data,
                            taskCondition: task.completionCondition,
                            totalTaskCount: path.totalTaskCount,
                            completedTaskCount: path.completedTaskCount
                        });
                    }
                });
            });
            if (actionProcessed) {
                processedActions.add(index);
            }
        });

        // Remove processed actions from queue
        journeyUpdateQueue.queue = journeyUpdateQueue.queue.filter((_, index) => !processedActions.has(index));
        if (journeyUpdateQueue.queue.length) {
            console.log('JourneyProgressSystem: Cleared processed actions from JourneyUpdateQueue', { remaining: journeyUpdateQueue.queue.length });
        }
        
        // Initialize task counts for active journeys
        journeyPath.paths.forEach(path => {
            if (path.id === path.parentId || path.completed) return;
            this.updateTaskCounts(path);
            if ((path.id === 'whisper_parent_2' || path.id === 'whisper_parent_3') && false) {
                console.log(`JourneyProgressSystem: Initialized task counts for ${path.id}`, {
                    totalTaskCount: path.totalTaskCount,
                    completedTaskCount: path.completedTaskCount
                });
            }
        });

        // Update JourneyDialogueComponent
        const syliri = this.entityManager.getEntitiesWith(['NPCData']).find(e => e.getComponent('NPCData').id === 'sehnrhyx_syliri');
        if (syliri && syliri.hasComponent('JourneyDialogue')) {
            const dialogueComp = syliri.getComponent('JourneyDialogue');
            dialogueComp.dialogues = {};

            // Pending rewards
            journeyPath.paths.forEach(path => {
                if (path.pendingCompletion && !path.completed) {
                    const journeyData = journeyPathsComp.paths.find(p => p.id === path.id);
                    if (journeyData) {
                        const rewardStrings = journeyData.rewards?.map(reward => {
                            if (reward.xp) return `${reward.xp} XP`;
                            if (reward.gold) return `${reward.gold} gold`;
                            if (reward.type === 'item') {
                                const itemName = reward.journeyItemId === 'stoneOfReturn' ? 'Stone of Return' : reward.journeyItemId;
                                return itemName;
                            }
                            if (reward.type === 'unlock') return `${reward.mechanic}`;
                            return '';
                        }).filter(str => str) || [];
                        const rewardMessage = rewardStrings.length > 0 ? rewardStrings.join(', ') : 'None';
                        const dialogueText = `${journeyData.completionText} <p>Rewards: ${rewardMessage}</p>`;
                        dialogueComp.dialogues[path.id] = {
                            text: dialogueText,
                            action: 'acknowledgeCompletion',
                            params: { journeyId: path.id, npcId: syliri.id }
                        };
                        if (!journeyState.completedPaths.some(p => p.id === path.id)) {
                            journeyState.completedPaths.push({
                                id: path.id,
                                parentId: path.parentId,
                                title: path.title,
                                completedAt: new Date().toISOString(),
                                completionText: path.completionText,
                                rewards: path.rewards
                            });
                        }
                        if (path.id === 'whisper_parent_2' || path.id === 'whisper_parent_3') {
                            console.log(`JourneyProgressSystem: Set completion dialogue for ${path.id}`, { dialogueText });
                        }
                    }
                }
            });

            // Offered journeys
            offeredJourneys.journeys.forEach(journey => {
                if (journey.offeredBy === 'sehnrhyx_syliri') {
                    const journeyData = journeyPathsComp.paths.find(p => p.id === journey.journeyId);
                    if (journeyData && !journeyPath.paths.some(p => p.id === journey.journeyId)) {
                        dialogueComp.dialogues[journey.journeyId] = {
                            text: journeyData.offerText || journeyData.description,
                            action: 'acceptJourney',
                            params: { journeyId: journey.journeyId, npcId: syliri.id }
                        };
                        if (journey.journeyId === 'whisper_parent_3' || journey.journeyId === 'whisper_parent_4') {
                            console.log(`JourneyProgressSystem: Set offer dialogue for ${journey.journeyId}`, { journeyId: journey.journeyId });
                        }
                    }
                }
            });

            // Active tasks
            journeyPath.paths.forEach(path => {
                if (path.id === path.parentId || path.completed) return;
                path.tasks?.forEach(task => {
                    if (!task.completed && (task.completionCondition.npc === 'sehnrhyx_syliri' || path.offeredBy === 'sehnrhyx_syliri')) {
                        let action = null;
                        let params = null;
                        if (task.completionCondition.type === 'turnIn') {
                            action = 'turnIn';
                            params = {
                                taskId: task.id,
                                resourceType: task.completionCondition.resourceType,
                                itemId: task.completionCondition.itemId,
                                quantity: task.completionCondition.quantity,
                                npcId: syliri.id // Entity ID
                            };
                        } else if (task.completionCondition.type === 'interactWithNPC') {
                            action = 'completeTask';
                            params = { taskId: task.id, npcId: syliri.id };
                        } else if (task.completionCondition.type === 'interactWithNPCFinal') {
                            if ((path.completedTaskCount || 0) === (path.totalTaskCount || 0) - 1) {
                                action = 'completeTask';
                                params = { taskId: task.id, npcId: syliri.id };
                            }
                        }
                        dialogueComp.dialogues[task.id] = {
                            text: task.activeText || task.description,
                            action,
                            params
                        };
                    }
                });
            });
        }

        // Check for completed journeys
        journeyPath.paths.forEach(journey => {
            if (journey.completed || journey.pendingCompletion || journey.id === journey.parentId) return;
            const allTasksCompleted = journey.tasks?.length > 0 && journey.tasks.every(task => task.completed);
            if (allTasksCompleted) {
                journey.pendingCompletion = true;
                this.eventBus.emit('Log');
                console.log(`JourneyProgressSystem: Journey ${journey.id} set to pendingCompletion`);
                if (journey.id === 'whisper_parent_2' || journey.id === 'whisper_parent_3') {
                    console.log(`JourneyProgressSystem: ${journey.id} pending completion`, { tasks: journey.tasks.map(t => ({ id: t.id, completed: t.completed })) });
                }
            }
        });

        // clear actions from queue
        if (journeyUpdateQueue.queue.length > 0) {
            console.log(`JourneyProgressSystem: Cleared ${journeyUpdateQueue.queue.length} actions from JourneyUpdateQueue`, journeyUpdateQueue.queue);
            journeyUpdateQueue.queue = [];
        }
    }

    updateTaskCounts(path) {
        path.totalTaskCount = path.tasks ? path.tasks.length : 0;
        path.completedTaskCount = path.tasks ? path.tasks.filter(t => t.completed).length : 0;
        if ((path.id === 'whisper_parent_2' || path.id === 'whisper_parent_3') && false) {
            console.log(`JourneyProgressSystem: Updated task counts for ${path.id}`, {
                totalTaskCount: path.totalTaskCount,
                completedTaskCount: path.completedTaskCount
            });
        }
    }

    matchesTask(action, task) {
        const condition = task.completionCondition;

       
        if (!condition.type) {
            console.error(`JourneyProgressSystem: Task ${task.id} has invalid completion condition:`, condition);
            return false;
        }
        let npcLogicalId;
       // console.log(`JourneyProgressSystem: Matching task ${task.id} with action ${action.type}`, { condition, actionData: action.data });
        if (action.data.npcId) {
            const npcEntity = this.entityManager.getEntity(action.data.npcId);
            npcLogicalId = npcEntity ? npcEntity.getComponent('NPCData')?.id : action.data.npcId;
            console.log(`JourneyProgressSystem: NPC logical ID resolved to ${npcLogicalId} for action`, action);
        }


        switch (action.type) {
            case 'collectResource':
                const player = this.entityManager.getEntity('player');
                const resource = player.getComponent('Resource');
                console.log(`JourneyProgressSystem: Evaluating collectResource for task ${task.id}`, resource, action, condition);
                const crafting = resource.craftResources;

                return condition.type === 'collectResource' &&
                    condition.resourceType === action.data.resourceType &&
                    (condition.quantity <= resource[condition.resourceType] ||
                        condition.quantity <= crafting[condition.resourceType] ||
                        condition.quantity <= action.data.quantity ||
                        !condition.quantity);

            case 'findItem':
                console.log(`JourneyProgressSystem: Evaluated findItem for task ${task}`, condition, action);
                if (!action.data || !action.data.journeyItemId) return false;
                return (condition.type === 'findItem' && condition.journeyItemId === action.data.journeyItemId);

            case 'collectItem':
                console.log(`JourneyProgressSystem: Evaluated collectItem for task ${task}`, condition, action);
                if (!action.data || !action.data.journeyItemId) return false;
                return condition.type === 'collectItem' && condition.journeyItemId === action.data.journeyItemId;


            case 'bossKill':
                return condition.type === 'bossKill' && condition.tier === action.data.tier;

            case 'interactWithNPC':
                
                console.log(`JourneyProgressSystem: Evaluating interactWithNPC for task ${task.id}`, condition, action);
                if (condition.type === 'interactWithNPCFinal') {
                    const path = this.entityManager.getEntity('player').getComponent('JourneyPath').paths.find(p => p.id === task.parentId);
                   const isMatchFinal = condition.type === 'interactWithNPCFinal' &&
                        condition.npc === npcLogicalId &&
                        action.data.taskId === task.id &&
                        (path.completedTaskCount || 0) === (path.totalTaskCount || 0) - 1;
                    console.log(`JourneyProgressSystem: Evaluated interactWithNPCFinal for task ${task.id}`, isMatchFinal);
                    return isMatchFinal;
                } else { 
                    const isMatch = (condition.type === 'interactWithNPC' &&
                    condition.npc === npcLogicalId &&
                        action.data.taskId === task.id);
                    console.log(`JourneyProgressSystem: Evaluated interactWithNPC for task ${task.id}`, isMatch);
                    return isMatch;
                }
                
            case 'attemptStairs':
                const isAttemptMatch = condition.type === 'attemptStairs' &&
                    condition.fromTier === action.data.fromTier &&
                    condition.toTier === action.data.toTier &&
                    action.data.success === false;
                if (task.id === 'whisper_child_3_4') {
                    console.log(`JourneyProgressSystem: Evaluated whisper_child_3_4 for attemptStairs`, {
                        matches: isAttemptMatch,
                        fromTier: action.data.fromTier,
                        toTier: action.data.toTier,
                        success: action.data.success
                    });
                }
                return isAttemptMatch;
            case 'useItem':
                console.log(`JourneyProgressSystem: Evaluating useItem for task ${task.id}`, condition, action);
                return condition.type === 'useItem' &&
                    action.data.itemId &&
                    (condition.itemId === action.data.itemId || condition.journeyItemId === action.data.itemId);
            case 'reachTier':
                return condition.type === 'reachTier' && condition.tier === action.data.tier;
            case 'completeEchoes':
                return condition.type === 'completeEchoes' && condition.count <= action.data.count;
            case 'completeWhispers':
                return condition.type === 'completeWhispers' && condition.pathId === action.data.pathId;
            case 'turnIn':
               
                return condition.type === 'turnIn' &&
                    task.id === action.data.taskId &&
                    condition.npc === npcLogicalId &&
                    this.handleTurnInCondition(condition, action.data);
            default:
                console.warn(`JourneyProgressSystem: Unknown task type ${action.type}`);
                return false;
        }
    }

    handleTurnInCondition(condition, data) {
        console.log(`JourneyProgressSystem: Handling turnIn condition`, { condition, data });
        if (condition.resourceType) {
            const resources = this.entityManager.getEntity('player').getComponent('Resource');
            const resourceCount = resources.craftResources[condition.resourceType] || 0;
            if (resourceCount >= condition.quantity) {
                resources.craftResources[condition.resourceType] -= condition.quantity;
                console.log(`JourneyProgressSystem: Deducted ${condition.quantity} ${condition.resourceType}, remaining: ${resources.craftResources[condition.resourceType]}`);
                return true;
            } else {
                console.log(`JourneyProgressSystem: Insufficient resources for turnIn`, {
                    resourceType: condition.resourceType,
                    required: condition.quantity,
                    available: resourceCount
                });
            }
        } else if (condition.itemId) {
            const inventory = this.entityManager.getEntity('player').getComponent('Inventory');
            const itemIndex = inventory.items.findIndex(item => item.id === condition.itemId || item.journeyItemId === condition.itemId);
            if (itemIndex !== -1) {
                inventory.items.splice(itemIndex, 1);
                console.log(`JourneyProgressSystem: Removed item ${condition.itemId} from inventory`);
                return true;
            } else {
                console.log(`JourneyProgressSystem: Item ${condition.itemId} not found in inventory`);
            }
        }
        return false;
    }

    checkEquipGear(task, inventory) { 

        console.log(`JourneyProgressSystem: Checking equipGear for task ${task.id}`,task, inventory.equipped);
        for (const item of Object.values(inventory.equipped)) {
            if (!item || item.itemTier !== 'magic') return false;
        }
        return true;
        /*
        const requiredTypes = new Set(['amulet', 'armor', 'ring', 'ring', 'weapon', 'weapon']);
        const requiredWeapons = new Set(['melee', 'ranged']);
        const equippedTypes = new Set();
        const equippedWeapons = new Set();

        for (const item of Object.values(inventory.equipped)) {
            if (!item || item.itemTier !== 'magic') continue;
            if (item.type === 'amulet' || item.type === 'armor') {
                equippedTypes.add(item.type);
            } else if (item.type === 'ring') {
                if (!equippedTypes.has('ring')) {
                    equippedTypes.add('ring');
                } else if (equippedTypes.has('ring') && !equippedTypes.has('ring2')) {
                    equippedTypes.add('ring2');
                }
            } else if (item.type === 'weapon') {
                if (item.attackType === 'melee' || item.attackType === 'ranged') {
                    equippedWeapons.add(item.attackType);
                    equippedTypes.add('weapon');
                }
            }
        }

        return requiredTypes.size === equippedTypes.size &&
            requiredTypes.every(type => type === 'weapon' || equippedTypes.has(type)) &&
            requiredWeapons.size === equippedWeapons.size &&
            requiredWeapons.every(attackType => equippedWeapons.has(attackType));
            */
    }

    applyRewards(journey) {
        const player = this.entityManager.getEntity('player');
        const journeyReward = player.getComponent('JourneyReward');

        if (!journeyReward) {
            console.warn('JourneyProgressSystem: JourneyReward component not found on player');
            return;
        }
        if (!journey.rewards) {
            console.warn('JourneyProgressSystem: No rewards found for journey', journey.id);
            return;
        }
        if (!journey.rewards.length) {
            console.warn('JourneyProgressSystem: No rewards found for journey', journey.id);
            return;
        }
        console.log('JourneyProgressSystem: Adding rewards to JourneyRewardComponent:', journey.rewards);
        // @Grok we should probably add the array to JourneyRewardrewards instead of overwriting it
        journeyReward.rewards = journey.rewards;
    }

    offerNextJourney(journey) {
        if (journey.nextPathId) {
            const gameState = this.entityManager.getEntity('gameState');
            const journeyPathsComp = gameState.getComponent('JourneyPaths');
            const offeredJourneysComp = gameState.getComponent('OfferedJourneys');
            const nextJourney = journeyPathsComp.paths.find(path => path.id === journey.nextPathId);
            if (nextJourney && !offeredJourneysComp.journeys.some(q => q.journeyId === nextJourney.id)) {
                const offeredBy = nextJourney.offeredBy || journey.offeredBy || 'default_npc';
                offeredJourneysComp.journeys.push({ journeyId: nextJourney.id, offeredBy });
                this.utilities.logMessage({ channel: "journey", message: `New journey available: ${nextJourney.title}` });
                console.log(`JourneyProgressSystem: Offered next journey ${nextJourney.id} by ${offeredBy}`);
                if (nextJourney.id === 'whisper_parent_3' || nextJourney.id === 'whisper_parent_4') {
                    console.log(`JourneyProgressSystem: Offered ${nextJourney.id} after completing ${journey.id}`);
                }
            }
        }
    }

    triggerMasterPath(journey) {
        if (journey.triggersMasterPath) {
            const journeyPath = this.entityManager.getEntity('player').getComponent('JourneyPath');
            const gameState = this.entityManager.getEntity('gameState');
            const journeyPathsComp = gameState.getComponent('JourneyPaths');
            const masterPath = journeyPathsComp.paths.find(path => path.id === journey.triggersMasterPath);
            if (masterPath && !journeyPath.paths.some(p => p.id === masterPath.id)) {
                this.utilities.addPath(journeyPath, masterPath);
                this.utilities.logMessage({ channel: "journey", message: `New path unlocked: ${masterPath.title}` });
                console.log(`JourneyProgressSystem: Triggered master path ${masterPath.id}`);
            }
        }
    }

    finalizeJourneyCompletion(journeyId) {
        const player = this.entityManager.getEntity('player');
        const journeyPath = player.getComponent('JourneyPath');
        const journey = journeyPath.paths.find(q => q.id === journeyId && q.pendingCompletion);
        if (!journey) {
            console.warn(`JourneyProgressSystem: Journey ${journeyId} not found or not in pendingCompletion state`);
            return;
        }

        journey.pendingCompletion = false;
        journey.completed = true;
        this.applyRewards(journey);
        this.offerNextJourney(journey);
        this.triggerMasterPath(journey);
        this.utilities.pushPlayerActions('completeWhispers', { pathId: journey.id, title: journey.title });
        this.eventBus.emit('JourneyStateUpdated');
        console.log(`JourneyProgressSystem: Finalized completion of journey ${journeyId}`);
        if (journeyId === 'whisper_parent_2' || journeyId === 'whisper_parent_3') {
            console.log(`JourneyProgressSystem: Completed ${journeyId}, nextPathId: ${journey.nextPathId}`);
        }

        this.utilities.removePath(journeyPath, journeyId);
        console.log(`JourneyProgressSystem: Removed completed journey ${journeyId} from JourneyPath.paths`);
    }
}
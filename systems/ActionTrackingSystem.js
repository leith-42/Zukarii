import { System } from '../core/Systems.js';
import { PlayerActionQueueComponent, JourneyUpdateQueueComponent, AchievementUpdateQueueComponent } from '../core/Components.js';

export class ActionTrackingSystem extends System {
    constructor(entityManager, eventBus, utilities) {
        super(entityManager, eventBus, utilities);
        this.requiredComponents = [];
    }

    init() {
    }

    update(deltaTime) {
        const components = this.validateComponents();
        if (!components) return;

        const { playerActionQueue, journeyUpdateQueue, achievementUpdateQueue } = components;
        if (playerActionQueue.actions.length === 0) return;

        const { journeyRelevantTypes, achievementRelevantTypes } = this.buildRelevanceTypeSets(components.journeyPaths);
        const unprocessedActions = this.processActions(
            playerActionQueue.actions,
            journeyRelevantTypes,
            achievementRelevantTypes,
            journeyUpdateQueue,
            achievementUpdateQueue
        );
        this.logUnprocessedActions(unprocessedActions);
        this.flushInputQueue(playerActionQueue);
    }

    validateComponents() {
        const player = this.entityManager.getEntity('player');
        const gameState = this.entityManager.getEntity('gameState');

        const playerActionQueue = player?.getComponent('PlayerActionQueue');
        const journeyUpdateQueue = gameState?.getComponent('JourneyUpdateQueue');
        const achievementUpdateQueue = gameState?.getComponent('AchievementUpdateQueue');
        const journeyPaths = gameState?.getComponent('JourneyPaths');

        if (!playerActionQueue) {
            console.error('ActionTrackingSystem: PlayerActionQueue component not found on player');
            return null;
        }
        if (!journeyUpdateQueue) {
            console.error('ActionTrackingSystem: JourneyUpdateQueue component not found on gameState');
            return null;
        }
        if (!achievementUpdateQueue) {
            console.error('ActionTrackingSystem: AchievementUpdateQueue component not found on gameState');
            return null;
        }
        if (!journeyPaths) {
            console.error('ActionTrackingSystem: JourneyPaths component not found on gameState');
            return null;
        }

        return { playerActionQueue, journeyUpdateQueue, achievementUpdateQueue, journeyPaths };
    }

    buildRelevanceTypeSets(journeyPaths) {
        const journeyRelevantTypes = new Set();
        journeyPaths.paths.forEach(path => {
            path.tasks?.forEach(task => {
                if (task.completionCondition?.type) {
                    journeyRelevantTypes.add(task.completionCondition.type);
                }
            });
        });

        // Hardcode completeWhispers for achievements
        const achievementRelevantTypes = new Set(['completeWhispers']);

        return { journeyRelevantTypes, achievementRelevantTypes };
    }

    processActions(actions, journeyRelevantTypes, achievementRelevantTypes, journeyUpdateQueue, achievementUpdateQueue) {
        const unprocessedActions = [];
        actions.forEach(action => {
            if (!action.type) {
                unprocessedActions.push({ ...action, error: 'Missing type' });
                console.log(`ActionTrackingSystem: Skipped malformed action`, action);
                return;
            }

            let processed = false;

            if (journeyRelevantTypes.has(action.type)) {
                journeyUpdateQueue.queue.push({ ...action });
                console.log(`ActionTrackingSystem: Forwarded ${action.type} to JourneyUpdateQueue`, action.data);
                processed = true;
            }

            if (achievementRelevantTypes.has(action.type)) {
                achievementUpdateQueue.queue.push({ ...action });
                console.log(`ActionTrackingSystem: Forwarded ${action.type} to AchievementUpdateQueue`, action.data);
                processed = true;
            }

            if (!processed) {
                unprocessedActions.push(action);
                console.log(`ActionTrackingSystem: Skipped non-relevant action ${action.type}`, action.data);
            }
        });
        return unprocessedActions;
    }

    logUnprocessedActions(unprocessedActions) {
        if (unprocessedActions.length > 0) {
            console.log('ActionTrackingSystem: Unprocessed actions:', unprocessedActions);
        }
    }

    flushInputQueue(playerActionQueue) {
        playerActionQueue.actions = [];
        console.log('ActionTrackingSystem: Cleared PlayerActionQueue actions');
    }
}
import { System } from '../core/Systems.js';

export class PathSystem extends System {
    constructor(entityManager, eventBus, utilities) {
        super(entityManager, eventBus, utilities);
        this.requiredComponents = [];
        this.queues = this.entityManager.getEntity('gameState').getComponent('DataProcessQueues') || {};
        this.pathTransfers = this.queues.pathTransfers || [];
    }

    init() {
        // No initialization events needed; this system processes the pathTransfers queue
    }

    update(deltaTime) {
        if (this.pathTransfers.length > 0) {
            this.pathTransfers.forEach(transfer => {
                this.processPathTransfer(transfer);
            });
            this.pathTransfers.length = 0; // Clear queue after processing
            //console.log('PathSystem: Processed and cleared pathTransfers');
            this.eventBus.emit('JourneyStateUpdated'); // Notify UISystem of potential changes
        }
    }

    processPathTransfer({ sourceEntityId, targetEntityId, journeyPathCompId }) {
        // Get the source and target entities
        const sourceEntity = this.entityManager.getEntity(sourceEntityId);
        const targetEntity = this.entityManager.getEntity(targetEntityId);

        if (!sourceEntity || !targetEntity) {
            console.error(`PathSystem: Source (${sourceEntityId}) or target (${targetEntityId}) entity not found`);
            return;
        }

        // Get the JourneyPathComponent from both entities
        const sourceJourneyPath = sourceEntity.getComponent('JourneyPath');
        const targetJourneyPath = targetEntity.getComponent('JourneyPath');

        if (!sourceJourneyPath) {
            console.error(`PathSystem: JourneyPathComponent not found on source entity ${sourceEntityId}`);
            return;
        }

        if (!targetJourneyPath) {
            console.error(`PathSystem: JourneyPathComponent not found on target entity ${targetEntityId}`);
            return;
        }

        // Find the path in the source entity's paths array
        const sourcePath = this.utilities.findPath(sourceJourneyPath, journeyPathCompId);
        if (!sourcePath) {
            console.error(`PathSystem: Path with ID ${journeyPathCompId} not found in source entity ${sourceEntityId}`);
            return;
        }

        // Create a copy of the path
        const newPath = {
            id: sourcePath.id,
            parentId: sourcePath.parentId,
            nextPathId: sourcePath.nextPathId,
            completed: sourcePath.completed,
            title: sourcePath.title,
            description: sourcePath.description,
            completionCondition: sourcePath.completionCondition ? { ...sourcePath.completionCondition } : null,
            rewards: sourcePath.rewards.map(reward => ({ ...reward })),
            completionText: sourcePath.completionText,
            logCompletion: sourcePath.logCompletion
        };

        // Add the copied path to the target entity's paths array
        this.utilities.addPath(targetJourneyPath, newPath);

        // Verify the path was added to the target entity
        const targetPath = this.utilities.findPath(targetJourneyPath, journeyPathCompId);
        if (targetPath) {
            // Path successfully added to target; remove from source
            this.utilities.removePath(sourceJourneyPath, journeyPathCompId);
            //console.log(`PathSystem: Transferred path ${journeyPathCompId} from ${sourceEntityId} to ${targetEntityId}`);
        } else {
            // Path not found on target; log error and do not remove from source
            console.error(`PathSystem: Failed to transfer path ${journeyPathCompId} to target entity ${targetEntityId} - path not found after adding`);
        }
    }
}
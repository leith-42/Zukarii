import { System } from '../core/Systems.js';
import { InCombatComponent } from '../core/Components.js'; 

export class PlayerTimerSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = ['PlayerState'];
    }

    init() {
        this.gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
    }

    update(deltaTime) {

        const entities = this.getEntities();
        const deltaMs = deltaTime * 1000; 

        for (const entity of entities) {
            if (entity.hasComponent('InCombat')) {
                const combat = entity.getComponent('InCombat');
                combat.elapsed += deltaMs;
                if (combat.elapsed >= combat.duration && this.gameState) {
                    entity.removeComponent('InCombat');
                    this.utilities.logMessage({ channel: "combat", message: 'You are no longer in combat.' });
                    this.gameState.needsRender = true;
                }
            }

            if (entity.hasComponent('StairLock')) {
                const stairLock = entity.getComponent('StairLock');
                stairLock.elapsed += deltaMs;
                if (stairLock.elapsed >= stairLock.duration && this.gameState) {
                    entity.removeComponent('StairLock');
                }
            }
        }
    }
}




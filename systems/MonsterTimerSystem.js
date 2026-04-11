

// MonsterTimerSystem.js
import { System } from '../core/Systems.js';

export class MonsterTimerSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.healthUpdates = this.entityManager.getEntity('gameState')
            .getComponent('DataProcessQueues').HealthUpdates;
    }

    init() { }

    update(deltaTime) {
        const deltaMs = deltaTime * 1000;

        // Process InCombat timers
        const combatEntities = this.entityManager.getEntitiesWith(['MonsterData', 'InCombat']);
        for (const entity of combatEntities) {
            const combat = entity.getComponent('InCombat');
            combat.elapsed += deltaMs;
            if (combat.elapsed >= combat.duration) {
                entity.removeComponent('InCombat');
                const gameState = this.entityManager.getEntity('gameState');
                if (gameState) gameState.getComponent('GameState').needsRender = true;
            }
        }

        // Process Regenerating monsters
        const regenEntities = this.entityManager.getEntitiesWith(['MonsterData', 'Regenerating']);
        for (const entity of regenEntities) {
            const regen = entity.getComponent('Regenerating');
            const health = entity.getComponent('Health');
            if (!health) continue;

            regen.accumulator += deltaTime;

            // Tick every 1 second
            if (regen.accumulator >= 1.0) {
                const regenAmount = health.maxHp * health.healthRegen;
                this.healthUpdates.push({
                    entityId: entity.id,
                    amount: regenAmount,
                    attackerId: null
                });
                regen.accumulator -= 1.0; // Keep fractional remainder
            }
        }
    }
}


/*
import { System } from '../core/Systems.js';

export class MonsterTimerSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = ['MonsterData', 'InCombat'];
    }

    init() {

    }

    update(deltaTime) {

        const entities = this.entityManager.getEntitiesWith(this.requiredComponents);
        const deltaMs = deltaTime * 1000;

        for (const entity of entities) {
            const combat = entity.getComponent('InCombat');
            if (!combat) continue;
            combat.elapsed += deltaMs;
            const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
            if (combat.elapsed >= combat.duration && gameState) {
                entity.removeComponent('InCombat');
                gameState.needsRender = true;
            }
        }
    }
}
*/
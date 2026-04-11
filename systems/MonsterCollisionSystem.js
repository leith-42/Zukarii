import { System } from '../core/Systems.js';
import { CollisionComponent } from '../core/Components.js';

export class MonsterCollisionSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = ['MonsterData', 'Collision'];
        this.sfxQueue = this.entityManager.getEntity('gameState').getComponent('AudioQueue').SFX || [];
    }

    update(deltaTime) {
        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
        if (!gameState || gameState.gameOver || gameState.transitionLock) return;

        const monsters = this.entityManager.getEntitiesWith(this.requiredComponents);
        if (monsters.length === 0) return;
        
        for (const monster of monsters) {

            if (!monster) continue;

            const collision = monster.getComponent('Collision');
            if ( !collision || collision.collisions.length === 0) continue;

            const attackSpeed = monster.getComponent('AttackSpeed');
            const monsterData = monster.getComponent('MonsterData');
            const movementIntent = monster.getComponent('MovementIntent');
            const movementDirection = movementIntent
                ? { dx: movementIntent.targetX - monster.getComponent('Position').x, dy: movementIntent.targetY - monster.getComponent('Position').y }
                : { dx: 0, dy: 0 };

            // Iterate over the collisions array
            for (let i = collision.collisions.length - 1; i >= 0; i--) {
                const collisionData = collision.collisions[i];
                const target = this.entityManager.getEntity(collisionData.targetId);
                if (!target) {
                    console.warn(`MonsterCollisionSystem: Target entity ${collisionData.targetId} not found for monster ${monster.id}`);
                    continue; // Skip if target entity is not found
                }
                ////console.log(`MonsterCollisionSystem: Monster collided with ${target.id}`);

                if (target.hasComponent('MonsterData') && target.getComponent('Health').hp > 0 && !target.hasComponent('Dead')) {
                    const targetMonsterData = target.getComponent('MonsterData');

                    // Aggro contagion safety checks:
                    // 1. Don't spread aggro FROM retreating monsters
                    // 2. Don't spread aggro TO retreating monsters (they're heading to spawn)
                    // 3. Only spread if source monster is actively aggressive
                    if (monsterData.isAggro && !monsterData.isRetreating && !targetMonsterData.isRetreating) {
                        targetMonsterData.isAggro = true;
                    }
                }
                /*
                if (target.hasComponent('Fountain')) {
                }
                if (target.hasComponent('LootData')) {
                }
                if (target.hasComponent('Stair') && !monster.hasComponent('StairLock')) {
                    //console.log(`MonsterCollisionSystem: Monster ${monster.id} collided with stair ${target.id}`);
                }
                if (target.hasComponent('Portal')) {
                    //console.log(`MonsterCollisionSystem: Monster ${monster.id} collided with portal ${target.id}`);
                }
                */
            }
        }
    }


    isOverlapping(projectile, target) {
        const projectilePos = projectile.getComponent('Position');
        const projectileHitbox = projectile.getComponent('Hitbox');
        if (!projectilePos || !projectileHitbox) return false;

        // Always use Hitbox and Position for area checks
        if (target.hasComponent('Hitbox') && target.hasComponent('Position')) {
            const targetPos = target.getComponent('Position');
            const targetHitbox = target.getComponent('Hitbox');
            const areaLeft = targetPos.x + (targetHitbox.offsetX || 0);
            const areaTop = targetPos.y + (targetHitbox.offsetY || 0);
            const areaRight = areaLeft + targetHitbox.width;
            const areaBottom = areaTop + targetHitbox.height;

            // projectile hitbox bounds
            const projectileLeft = projectilePos.x + (projectileHitbox.offsetX || 0);
            const projectileTop = projectilePos.y + (projectileHitbox.offsetY || 0);
            const projectileRight = projectileLeft + projectileHitbox.width;
            const projectileBottom = projectileTop + projectileHitbox.height;

            // Rectangle overlap check
            return (
                projectileLeft < areaRight &&
                projectileRight > areaLeft &&
                projectileTop < areaBottom &&
                projectileBottom > areaTop
            );
        }
        return false;
    }
}

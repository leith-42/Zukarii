import { System } from '../core/Systems.js';
import { RemoveEntityComponent } from '../core/Components.js';

export class ProjectileCollisionSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = ['Projectile', 'Collision'];
        this.sfxQueue = this.entityManager.getEntity('gameState').getComponent('AudioQueue').SFX || []
    }

    // Helper: check overlap at arbitrary positions
    isOverlappingAt(projectile, target, projPos, targPos) {
        const projectileHitbox = projectile.getComponent('Hitbox');
        const targetHitbox = target.getComponent('Hitbox');
        if (!projPos || !projectileHitbox || !targPos || !targetHitbox) return false;

        const projectileLeft = projPos.x + (projectileHitbox.offsetX || 0);
        const projectileTop = projPos.y + (projectileHitbox.offsetY || 0);
        const projectileRight = projectileLeft + projectileHitbox.width;
        const projectileBottom = projectileTop + projectileHitbox.height;

        const targetLeft = targPos.x + (targetHitbox.offsetX || 0);
        const targetTop = targPos.y + (targetHitbox.offsetY || 0);
        const targetRight = targetLeft + targetHitbox.width;
        const targetBottom = targetTop + targetHitbox.height;

        return (
            projectileLeft < targetRight &&
            projectileRight > targetLeft &&
            projectileTop < targetBottom &&
            projectileBottom > targetTop
        );
    }

    // New copilot version
    update(deltaTime) {
        const projectiles = this.entityManager.getEntitiesWith(this.requiredComponents);

        for (const projectile of projectiles) {
            if (!projectile.hasComponent('Collision') || projectile.hasComponent('RemoveEntity')) continue;
            const collision = projectile.getComponent('Collision');
            const projData = projectile.getComponent('Projectile');
            if (projData.rangeLeft <= 0) continue;
            const source = this.entityManager.getEntity(projData.sourceEntityId);

            // Get projectile positions
            const projectilePos = projectile.getComponent('Position');
            const projectileLastPos = projectile.getComponent('LastPosition');

            for (const collisionData of collision.collisions) {
                const targetId = projectile.id === collisionData.moverId ? collisionData.targetId : collisionData.moverId;
                const target = this.entityManager.getEntity(targetId);
                if (!target) continue;

                // Prevent projectile-projectile self-collision
                if (target.hasComponent('Projectile')) {
                    target.sourceEntityId = target.getComponent('Projectile').sourceEntityId;
                    if (projData.sourceEntityId === target.sourceEntityId) break;
                }

                // Get target positions
                const targetPos = target.getComponent('Position');
                const targetLastPos = target.getComponent('LastPosition');

                // Check all combinations of current/last positions for overlap
                const overlapNow = this.isOverlappingAt(projectile, target, projectilePos, targetPos);
                const overlapProjLast = projectileLastPos && this.isOverlappingAt(projectile, target, projectileLastPos, targetPos);
                const overlapTargLast = targetLastPos && this.isOverlappingAt(projectile, target, projectilePos, targetLastPos);
                const overlapBothLast = projectileLastPos && targetLastPos && this.isOverlappingAt(projectile, target, projectileLastPos, targetLastPos);

                const isOverlapping = overlapNow || overlapProjLast || overlapTargLast || overlapBothLast;

                if (!isOverlapping) continue;

                // --- Collision Handling ---
                if (target.hasComponent('Wall')) {
                    if (!projectile.hasComponent('RemoveEntity')) {
                        projectile.addComponent(new RemoveEntityComponent());
                    }
                    this.sfxQueue.push({ sfx: 'firehit0', volume: .15 });
                    this.utilities.logMessage({ channel: "combat", message: 'Your shot hit a wall.' });
                    break;
                }

                if (target.hasComponent('MonsterData') && !source.hasComponent('MonsterData') && !target.hasComponent('Dead')) {
                    const weapon = projData.weapon;
                    if (!weapon && source?.hasComponent('PlayerState')) {
                        throw new Error(`Projectile ${projectile.id} from player has no weapon assigned!`);
                    }
                    this.eventBus.emit('CalculateDamage', {
                        attacker: source,
                        target: target,
                        weapon: weapon
                    });

                    this.eventBus.emit('RangedAttackHit', {
                        attacker: source,
                        target: target,
                    });

                    this.sfxQueue.push({ sfx: 'firehit0', volume: .45 });

                    if (!projData.isPiercing && !projectile.hasComponent('RemoveEntity')) {
                        projectile.rangeLeft = 0;
                        projectile.addComponent(new RemoveEntityComponent());
                        break;
                    } else {
                        projectile.rangeLeft -= 1;
                    }
                }

                if (target.hasComponent('PlayerState') && source.hasComponent('MonsterData')) {
                    const weapon = projData.weapon;
                    if (!weapon) {
                        console.error(`Projectile ${projectile.id} from monster has no weapon assigned!`);
                        continue;
                    }
                    this.eventBus.emit('CalculateDamage', {
                        attacker: source,
                        target: target,
                        weapon: weapon
                    });

                    this.eventBus.emit('RangedAttackHit', {
                        attacker: source,
                        target: target,
                    });;

                    this.sfxQueue.push({ sfx: 'firehit0', volume: .25 });

                    if (!projData.isPiercing && !projectile.hasComponent('RemoveEntity')) {
                        projectile.rangeLeft = 0;
                        projectile.addComponent(new RemoveEntityComponent());
                        break;
                    } else {
                        projectile.rangeLeft -= 1;
                    }
                }
            }

            projectile.removeComponent('Collision');
        }
    }

}

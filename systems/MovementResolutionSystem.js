
import { System } from '../core/Systems.js';
import { AvoidanceWaypointComponent, SlowMovementComponent } from '../core/Components.js';
import { EntityManager } from '../core/EntityManager.js';

export class MovementResolutionSystem extends System {
    constructor(entityManager, eventBus, utilities) {
        super(entityManager, eventBus, utilities); 
        this.requiredComponents = ['Position', 'MovementIntent'];
        this.BASE_MOVEMENT_SPEED_PPS = 155;
        this.MAX_ACTUAL_SPEED = 320;
    }
    update(deltaTime) {
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        if (gameState.transitionLock) {
            this.entityManager.getEntitiesWith(['MovementIntent']).forEach(entity => {
                this.entityManager.removeComponentFromEntity(entity.id, 'MovementIntent');
            });
            return;
        }
        const entities = this.entityManager.getEntitiesWith(this.requiredComponents);
        // Cache all entities with hitboxes once per frame
        //const hitboxEntities = this.entityManager.getEntitiesWith(['Position', 'Hitbox']);

        for (let i = 0; i < entities.length; i++) {
            const entity = entities[i];
            const isPlayer = entity.id === 'player';
            if (isPlayer && gameState.isRangedMode) {
                // In ranged mode, player movement is handled by PlayerControllerSystem
                continue;
            }
            

            if (entity.hasComponent('SlowMovement')) {
                const slomovComp = entity.getComponent('SlowMovement');
                slomovComp.duration -= deltaTime * 1000;
                if (slomovComp.duration <= 0) {
                    this.entityManager.removeComponentFromEntity(entity.id, 'SlowMovement');
                }

            }

            if (entity.hasComponent('StopMovement')) {
                const stopMovComp = entity.getComponent('StopMovement');
                stopMovComp.duration -= deltaTime * 1000;
                if (stopMovComp.duration <= 0) {
                    this.entityManager.removeComponentFromEntity(entity.id, 'StopMovement');
                } else {
                    continue;
                }
            }
            const hasProjectile = entity.hasComponent('Projectile');

            const intent = entity.getComponent('MovementIntent');
            const pos = entity.getComponent('Position');
            let lastPos = null;
            if (entity.hasComponent('LastPosition')) {
                lastPos = entity.getComponent('LastPosition');
            }

            let speedMultiplier = 100;
            let moveSpeedComp = null;
            if (entity.hasComponent('MovementSpeed')) {
                moveSpeedComp = entity.getComponent('MovementSpeed');
                speedMultiplier = moveSpeedComp.movementSpeed;
            }
            let actualSpeed = this.BASE_MOVEMENT_SPEED_PPS * (speedMultiplier / 100);
            if (entity.hasComponent('InCombat') && entity.hasComponent('MovementSpeed')) {
                actualSpeed *= moveSpeedComp.combatSpeedMultiplier;
            }

            if (actualSpeed > this.MAX_ACTUAL_SPEED && !hasProjectile) actualSpeed = this.MAX_ACTUAL_SPEED;

            if (entity.hasComponent('SlowMovement')) {
                const slowComp = entity.getComponent('SlowMovement');
                actualSpeed *= slowComp.slowFactor;
                actualSpeed *= slowComp.slowFactor;
            }

            const dx = intent.targetX - pos.x;
            const dy = intent.targetY - pos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const maxStep = actualSpeed * deltaTime;

            let moveX = 0, moveY = 0;
            if (distance <= maxStep) {
                moveX = dx;
                moveY = dy;
            } else if (distance > 0) {
                moveX = (dx / distance) * maxStep;
                moveY = (dy / distance) * maxStep;
            }

            // Only run overlap checks if CollisionSystem predicted a collision
            const collisionComp = entity.getComponent('Collision');
            const filteredCollisions = collisionComp?.collisions.filter(c => c.distance < maxStep * 3);

            const hasPredictedCollision = filteredCollisions && filteredCollisions.length > 0;

            if (hasPredictedCollision && !hasProjectile) {
                const hitboxEntities = collisionComp.nearbyEntities || [];

                // Path checking for monsters/NPCs
                if (entity.hasComponent('MonsterData')) {

                    const pathResult = this.pathChecking(entity, pos, moveX, moveY, 2, hitboxEntities);

                    
                        if ((pathResult.moveX !== moveX || pathResult.moveY !== moveY) && !entity.hasComponent('AvoidanceWaypoint')) {
                            const monsterData = entity.getComponent('MonsterData');
                            const originalDir = { x: moveX.toFixed(2), y: moveY.toFixed(2) };
                            const avoidDir = { x: pathResult.moveX.toFixed(2), y: pathResult.moveY.toFixed(2) };

                            // Calculate waypoint 7 tiles ahead in the avoidance direction
                            const waypointDistance = 224; // 7 tiles * 32px (increased from 5 tiles)
                            const magnitude = Math.sqrt(pathResult.moveX ** 2 + pathResult.moveY ** 2);
                            if (magnitude > 0) {
                                const waypointX = pos.x + (pathResult.moveX / magnitude) * waypointDistance;
                                const waypointY = pos.y + (pathResult.moveY / magnitude) * waypointDistance;
                                const expiresAt = Date.now() + 2500; // 2.5 second commitment (increased from 1.5s)

                                console.log(`[WAYPOINT-CREATE] ${monsterData.name} at (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}) changed direction from (${originalDir.x}, ${originalDir.y}) to (${avoidDir.x}, ${avoidDir.y}), waypoint: (${waypointX.toFixed(1)}, ${waypointY.toFixed(1)})`);

                                const waypoint = new AvoidanceWaypointComponent(waypointX, waypointY, expiresAt);
                                waypoint.lastPathCheck = Date.now(); // Initialize to prevent immediate path check
                                entity.addComponent(waypoint);
                                intent.targetX = waypointX;
                                intent.targetY = waypointY;
                            }
                        }

                    

                    

                    // If pathChecking changed direction, set avoidance waypoint
                    

                    moveX = pathResult.moveX;
                    moveY = pathResult.moveY;
                } else {
                    // General overlap checks
                    const newX = pos.x + moveX;
                    if (this.wouldOverlap(entity, newX, pos.y, hitboxEntities)) {
                        moveX = 0;
                        intent.targetX = pos.x;
                    }
                    const newY = pos.y + moveY;
                    if (this.wouldOverlap(entity, pos.x, newY, hitboxEntities)) {
                        moveY = 0;
                        intent.targetY = pos.y;
                    }
                }
            }

            if (lastPos) {
                lastPos.x = pos.x;
                lastPos.y = pos.y;
            }
            pos.x += moveX;
            pos.y += moveY;

            if (distance <= maxStep) {
                this.entityManager.removeComponentFromEntity(entity.id, 'MovementIntent');
            }
        }
    }

    pathChecking(entity, pos, moveX, moveY, framesAhead = 2, hitboxEntities) {
        let testX = pos.x;
        let testY = pos.y;
        let testMoveX = moveX;
        let testMoveY = moveY;
        for (let i = 0; i < framesAhead; i++) {
            testX += testMoveX;
            testY += testMoveY;


            if (this.wouldOverlap(entity, testX, testY, hitboxEntities)) {
                if (!this.wouldOverlap(entity, testX, pos.y, hitboxEntities)) {
                    return { moveX: testMoveX * 1.5, moveY: 0 };
                }
                if (!this.wouldOverlap(entity, pos.x, testY, hitboxEntities)) {
                    return { moveX: 0, moveY: testMoveY * 1.5};
                }
                return { moveX: 0, moveY: 0 };
            }
        }
        return { moveX, moveY };
    }

    wouldOverlap(entity, newX, newY, hitboxEntities) {
        const hitbox = entity.getComponent('Hitbox');
        if (!hitbox) return false;
        for (let i = 0; i < hitboxEntities.length; i++) {
            const other = hitboxEntities[i];
            if (other === entity) continue;
            if (other.hasComponent('TriggerArea') ||
                (entity.id === 'player' && other.hasComponent('Portal')) ||
                (entity.id === 'player' && other.hasComponent('Stair')) 
                
            ) continue;


            const otherPos = other.getComponent('Position');
            const otherHitbox = other.getComponent('Hitbox');
            const thisLeft = newX + (hitbox.offsetX || 0);
            const thisTop = newY + (hitbox.offsetY || 0);
            const thisRight = thisLeft + hitbox.width;
            const thisBottom = thisTop + hitbox.height;
            const otherLeft = otherPos.x + (otherHitbox.offsetX || 0);
            const otherTop = otherPos.y + (otherHitbox.offsetY || 0);
            const otherRight = otherLeft + otherHitbox.width;
            const otherBottom = otherTop + otherHitbox.height;
            if (
                thisLeft < otherRight &&
                thisRight > otherLeft &&
                thisTop < otherBottom &&
                thisBottom > otherTop
            ) {
                if (entity.hasComponent('MonsterData') && other.hasComponent('LootData')) {
                    // Allow monsters to overlap loot to prevent pathfinding issues, but still trigger collision events for slowdown effects
                    this.utilities.safeAddComponent(entity, new SlowMovementComponent(.5, 750));
                    return false; // Allow monsters to overlap loot
                }
                return true;
            }
        }
        return false;
    }
}


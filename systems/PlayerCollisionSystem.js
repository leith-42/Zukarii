import { System } from '../core/Systems.js';
import { StairLockComponent, PortalInteractionComponent  } from '../core/Components.js';

export class PlayerCollisionSystem extends System {
    constructor(entityManager, eventBus, utilities) {
        super(entityManager, eventBus);
        this.requiredComponents = ['PlayerStateComponent', 'Collision'];
        this.sfxQueue = this.entityManager.getEntity('gameState').getComponent('AudioQueue').SFX || [];
        this.utilities = utilities;
        this.utilities.entityManager = this.entityManager;
    }

    update(deltaTime) {
        const player = this.entityManager.getEntity('player');
        if (!player) return;

        const collision = player.getComponent('Collision');
        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
        let levelTransition = null;

        if (!collision || !gameState || gameState.gameOver || gameState.transitionLock) {
            return;
        }

        // If no collisions, skip the rest (but after overlap check!)
        if (!collision.collisions || collision.collisions.length === 0) {
            return;
        }

        const movementIntent = player.getComponent('MovementIntent');
        const movementDirection = movementIntent
            ? { dx: movementIntent.targetX - player.getComponent('Position').x, dy: movementIntent.targetY - player.getComponent('Position').y }
            : { dx: 0, dy: 0 };

        // Iterate over the collisions array
        for (let i = collision.collisions.length - 1; i >= 0; i--) {
            const collisionData = collision.collisions[i];
            const target = this.entityManager.getEntity(collisionData.targetId);
            if (!target) {
                console.warn(`PlayerCollisionSystem: Target entity ${collisionData.targetId} not found for player ${player.id}`);
                continue;
            }
            const isAdjacent = this.isAdjacentToPlayer(player, target);
            const isOverlapping = this.isOverlappingPlayer(player, target);

            if (target.hasComponent('MonsterData') && target.getComponent('Health').hp > 0) {
                const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
                // Only allow melee if NOT in ranged mode
                if (!gameState?.isRangedMode) {
                    // Adjacency check (melee range)          
                    if (isAdjacent || isOverlapping) {
                        const attackSpeed = player.getComponent('AttackSpeed');
                        if (attackSpeed.elapsedSinceLastAttack >= attackSpeed.attackSpeed) {
                            this.eventBus.emit('MeleeAttack', { targetEntityId: target.id });
                            attackSpeed.elapsedSinceLastAttack = 0;
                            this.endTurn('meleeAttack');
                        }
                        collision.collisions.splice(i, 1);
                    }
                }
                continue;
            }

            // Entry (one-shot) triggers: fire once per entry, then cooldown
            if (target.hasComponent('TriggerArea')) {
                if (isOverlapping) { 
                    const triggerArea = target.getComponent('TriggerArea');
                    if (triggerArea.mode !== 'Presence' && triggerArea.active) {
                        this.eventBus.emit(triggerArea.action, triggerArea.data);
                        triggerArea.active = false;
                        setTimeout(() => {
                            triggerArea.active = true;
                        }, triggerArea.resetDelay || 120000);
                    }
                }
                continue;
            } 

            if (target.hasComponent('NPCData')) {
                if (isAdjacent || isOverlapping) { 
                    this.entityManager.removeComponentFromEntity('player', 'MovementIntent');
                    collision.collisions.splice(i, 1);
                }
               
                continue;
            }
            if (target.hasComponent('Fountain')) {
                if (isAdjacent || isOverlapping) {
                    this.eventBus.emit('UseFountain', { fountainEntityId: target.id });
                    this.endTurn('useFountain');
                }
                collision.collisions.splice(i, 1);
                continue;
            }
            if (target.hasComponent('LootData')) {
                if (isAdjacent) {
                    const pos = target.getComponent('Position');
                    this.eventBus.emit('PickupTreasure', { x: pos.x, y: pos.y });
                    collision.collisions.splice(i, 1);
                }
                continue;
            }
            if (target.hasComponent('Stair') && !player.hasComponent('StairLock')) {
                if (/*isAdjacent || */isOverlapping) {

                    const stairComp = target.getComponent('Stair');
                    if (!stairComp.active) {
                        const highestTier = this.entityManager.getEntity('gameState').getComponent('GameState').highestTier;
                        const currentTier = this.entityManager.getActiveTier();
                        if (highestTier > currentTier && stairComp.direction === 'down') {
                            console.warn(`PlayerCollisionSystem: Stairs down at tier ${currentTier} unocked for highest tier: .`, highestTier);
                            stairComp.active = true;
                        } else {
                            player.addComponent(new StairLockComponent());
                            this.utilities.logMessage({ channel: "journey", message: 'The Stairs are blocked by a magical barrier' });
                            const fromTier = this.entityManager.getActiveTier();
                            if (fromTier === undefined || fromTier === null) {
                                console.error('PlayerCollisionSystem: getActiveTier returned invalid value', { fromTier });
                                player.removeComponent(new StairLockComponent());
                                continue;
                            }
                            const toTier = stairComp.direction === 'down' ? fromTier + 1 : fromTier - 1;
                            try {
                                this.utilities.pushPlayerActions('attemptStairs', { fromTier, toTier, success: false });
                                //console.log(`PlayerCollisionSystem: Pushed attemptStairs action`, { fromTier, toTier, success: false });
                            } catch (error) {
                                console.error('PlayerCollisionSystem: Failed to push attemptStairs action', { error: error.message });
                            }
                            setTimeout(() => {
                                player.removeComponent(new StairLockComponent());
                            }, 2000);
                            continue;

                        }
                    }
                        levelTransition = this.entityManager.getEntity('gameState').getComponent('LevelTransition');
                        player.addComponent(new StairLockComponent());
                        if (levelTransition && levelTransition.pendingTransition === null) {
                            const stairComp = target.getComponent('Stair');
                            levelTransition.lastMovementDirection = movementDirection;
                            if (stairComp.direction === 'down') {
                                levelTransition.pendingTransition = 'down';
                                this.endTurn('transitionDown');
                            } else if (stairComp.direction === 'up') {
                                levelTransition.pendingTransition = 'up';
                                this.endTurn('transitionUp');
                            }
                            collision.collisions.splice(i, 1);
                            break;
                        }
                    
                }
            }

            if (target.hasComponent('Portal')) {
                const portalComp = target.getComponent('Portal');
                if (!portalComp.active) continue;

                if (player.hasComponent('PortalBinding')) {
                    if (player.hasComponent('PortalInteraction')) continue;
                    console.warn(`PlayerCollisionSystem: Player has PortalBinding, checking portal interaction for ${target.id}`);
                    if (isOverlapping) {
                        let interactionComp = new PortalInteractionComponent();
                        interactionComp.portalId = target.id;
                        interactionComp.tier = this.entityManager.getActiveTier();
                        player.addComponent(interactionComp);

                        collision.collisions.splice(i, 1);
                        continue;
                    }
                } else if (isOverlapping) {
                        this.sfxQueue.push({ sfx: 'portal0', volume: 0.5 });
                        levelTransition = this.entityManager.getEntity('gameState').getComponent('LevelTransition');
                        if (portalComp.destinationTier !== undefined && portalComp.destinationTier !== null) {
                            levelTransition.destinationTier = portalComp.destinationTier;
                        }

                        this.entityManager.getEntity('gameState').getComponent('GameState').transitionLock = true;

                        if (levelTransition && levelTransition.pendingTransition === null) {
                            levelTransition.lastMovementDirection = movementDirection;
                            levelTransition.pendingTransition = 'portal';
                            this.endTurn('transitionPortal');
                            collision.collisions.splice(i, 1);
                            break;
                        }
                }
            }
        }
    }

    isAdjacentToPlayer(player, target, range = 1.5 * 32) {
        const playerPos = player.getComponent('Position');
        const playerHitbox = player.getComponent('Hitbox');
        const targetPos = target.getComponent('Position');
        const targetHitbox = target.getComponent('Hitbox');
        if (!playerPos || !targetPos || !playerHitbox || !targetHitbox) return false;

        // Include hitbox offsets in center calculation
        const playerCenterX = playerPos.x + (playerHitbox.offsetX || 0) + (playerHitbox.width / 2);
        const playerCenterY = playerPos.y + (playerHitbox.offsetY || 0) + (playerHitbox.height / 2);
        const targetCenterX = targetPos.x + (targetHitbox.offsetX || 0) + (targetHitbox.width / 2);
        const targetCenterY = targetPos.y + (targetHitbox.offsetY || 0) + (targetHitbox.height / 2);

        const dx = targetCenterX - playerCenterX;
        const dy = targetCenterY - playerCenterY;
        return Math.sqrt(dx * dx + dy * dy) <= range;
    }

    isOverlappingPlayer(player, target) {
        const playerPos = player.getComponent('Position');
        const playerHitbox = player.getComponent('Hitbox');
        if (!playerPos || !playerHitbox) return false;

        // Always use Hitbox and Position for area checks
        if (target.hasComponent('Hitbox') && target.hasComponent('Position')) {
            const targetPos = target.getComponent('Position');
            const targetHitbox = target.getComponent('Hitbox');
            const areaLeft = targetPos.x + (targetHitbox.offsetX || 0);
            const areaTop = targetPos.y + (targetHitbox.offsetY || 0);
            const areaRight = areaLeft + targetHitbox.width;
            const areaBottom = areaTop + targetHitbox.height;

            // Player hitbox bounds
            const playerLeft = playerPos.x + (playerHitbox.offsetX || 0);
            const playerTop = playerPos.y + (playerHitbox.offsetY || 0);
            const playerRight = playerLeft + playerHitbox.width;
            const playerBottom = playerTop + playerHitbox.height;

            // Rectangle overlap check
            return (
                playerLeft < areaRight &&
                playerRight > areaLeft &&
                playerTop < areaBottom &&
                playerBottom > areaTop
            );
        }
        return false;
    }



    endTurn(source) {
        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
        if (!gameState || gameState.gameOver) return;
        gameState.transitionLock = false;
        gameState.needsRender = true;
    }
}

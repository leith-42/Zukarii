// systems/MonsterControllerSystem.js
import { System } from '../core/Systems.js';
import { LootSourceData, MovementIntentComponent, AvoidanceWaypointComponent, RemoveEntityComponent, HealthRegenComponent } from '../core/Components.js';

export class MonsterControllerSystem extends System {
    constructor(entityManager, eventBus, utilities) {
        super(entityManager, eventBus);
        this.requiredComponents = ['Position', 'Health', 'MonsterData'];
        this.utilities = utilities;
        this.utilities.entityManager = this.entityManager; // Ensure utilities have access to the entity manager     
    }
    init() {
        this.TILE_SIZE = this.utilities.TILE_SIZE
        this.BUCKET_SIZE = 16; // Matches existing bucket size (16 tiles)
        this.invTileBucket = 1 / (this.TILE_SIZE * this.BUCKET_SIZE);
        this.AGGRO_RANGE = 6 * this.TILE_SIZE; // 6 tiles in pixels (32 pixels per tile)
        this.MELEE_RANGE = 1.5 * this.TILE_SIZE; // Pixel distance to trigger melee attack
        this.MONSTER_WANDER_CHANCE = .005;

        const tier = this.entityManager.getEntity('gameState').getComponent('GameState').tier;
        const levelEntity = this.entityManager.getEntitiesWith(['Map', 'Tier']).find(e => e.getComponent('Tier').value === tier);

        this.bucketsComp = levelEntity.getComponent('SpatialBuckets');
        
    }
    update(deltaTime) {
        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
        if (gameState?.gameOver) return;

        const player = this.entityManager.getEntity('player');
        if (!player || player.getComponent('PlayerState').dead || player.hasComponent('Dead')) return;

        if (!this.bucketsComp || !this.bucketsComp.monsterBuckets) return;

        const monsters = this.entityManager.getEntitiesWith(this.requiredComponents);

        const now = Date.now();

        monsters.forEach(monster => {
            const health = monster.getComponent('Health');
            const hpBarWidth = Math.floor((health.hp / health.maxHp) * (this.TILE_SIZE / 2));

            const healthPercent = (health.hp / health.maxHp) * 100;
            let healthArgoMultipler = 1;
            switch (true) {
                case healthPercent <= 25:
                    healthArgoMultipler = 0.5;
                    break;
                case healthPercent <= 75:
                    healthArgoMultipler = 2;
                    break;
                default:
                    healthArgoMultipler = 1;
            }
            const monsterData = monster.getComponent('MonsterData');
            monsterData.hpBarWidth = hpBarWidth;


            // Flag monster for regeneration if conditions are met
            if (health.hp < health.maxHp &&
                !monsterData.isAggro &&
                !monsterData.isRetreating &&
                !monster.hasComponent('InCombat')) {

                if (!monster.hasComponent('Regenerating')) {
                    monster.addComponent(new HealthRegenComponent());
                }
            } else {
                if (monster.hasComponent('Regenerating')) {
                    monster.removeComponent('Regenerating');
                }
            }



            const dead = monster.getComponent('Dead');
            if (dead) {
                if (dead.state === 'new') {
                    this.handleMonsterDeath(monster.id);
                    dead.state = 'handling';
                }
                if ((dead.expiresAt < now && dead.state === 'processed') || dead.expiresAt + 200 < now) {
                    if (!monster.hasComponent('RemoveEntity')) {
                        monster.addComponent(new RemoveEntityComponent());
                    }
                }
                return;
            }

            const isInCombat = monster.getComponent('InCombat');

            const pos = monster.getComponent('Position');
            const attackSpeed = monster.getComponent('AttackSpeed');
            const playerPos = player.getComponent('Position');
            const distance = this.utilities.getDistance(pos, playerPos);
            const dx = playerPos.x - pos.x;
            const dy = playerPos.y - pos.y;
            const magnitude = distance === 0 ? 1 : distance;
            const direction = magnitude === 0 ? { dx: 0, dy: 0 } : { dx: dx / magnitude, dy: dy / magnitude }

            // Accumulate time for attacks (deltaTime in seconds, convert to ms)
            attackSpeed.elapsedSinceLastAttack += deltaTime * 1000;

            if (distance <= this.AGGRO_RANGE + (2 * this.TILE_SIZE)) { monsterData.isDetected = true; }

            if (distance <= this.AGGRO_RANGE) { 
                monsterData.isAggro = true;
                // Cancel retreat if monster is re-aggroed
                if (monsterData.isRetreating) {
                    console.log(`[RETREAT-CANCELLED] ${monsterData.name} was retreating but player re-entered aggro range`);
                    monsterData.isRetreating = false;
                }
            }

            // Double de-aggro range for waypointing monsters to allow them to complete pathfinding
            const deAggroMultiplier = monster.hasComponent('AvoidanceWaypoint') ? 4 : 2;

            if (distance > (this.AGGRO_RANGE * deAggroMultiplier * healthArgoMultipler) && monsterData.isAggro && !isInCombat) {
                console.log(`[DE-AGGRO] ${monsterData.name} de-aggroing at distance ${distance.toFixed(1)}px (threshold: ${(this.AGGRO_RANGE * deAggroMultiplier * healthArgoMultipler).toFixed(1)}px)`);

                // Clean up all aggro-related state
                monsterData.isAggro = false;
                monsterData.isDetected = false;
                monsterData.nearbyMonsters = [];

                // Remove movement components
                this.utilities.safeRemoveComponent(monster, 'MovementIntent');
                this.utilities.safeRemoveComponent(monster, 'AvoidanceWaypoint');

                // Reset stuck tracking
                if (monsterData.totalStuckEvents > 0) {
                    console.log(`[DE-AGGRO] ${monsterData.name} resetting stuck counter from ${monsterData.totalStuckEvents} to 0`);
                    monsterData.totalStuckEvents = 0;
                }
                monsterData.stuckCooldownUntil = null;

                // Initiate retreat to spawn - let retreat system handle movement
                if (monsterData.spawnX !== undefined && monsterData.spawnY !== undefined) {
                    const distanceToSpawn = this.utilities.getDistance(pos, { x: monsterData.spawnX, y: monsterData.spawnY });
                    if (distanceToSpawn > 32) { // More than 1 tile away from spawn
                        console.log(`[DE-AGGRO] ${monsterData.name} initiating retreat to spawn, distance: ${distanceToSpawn.toFixed(1)}px`);
                        monsterData.isRetreating = true;
                    }
                }

                return; // Skip rest of aggro logic this frame
            }

            // Handle retreat to spawn behavior
            if (monsterData.isRetreating) {
                // Check if monster has reached spawn point
                const distanceToSpawn = this.utilities.getDistance(pos, { x: monsterData.spawnX, y: monsterData.spawnY });

                if (distanceToSpawn < 16) { // Within half a tile of spawn
                    console.log(`[RETREAT-COMPLETE] ${monsterData.name} reached spawn at (${monsterData.spawnX.toFixed(1)}, ${monsterData.spawnY.toFixed(1)}), resetting stuck counter and ending retreat`);
                    monsterData.isRetreating = false;
                    monsterData.totalStuckEvents = 0;
                    monsterData.retreatStartTime = null;
                    monsterData.retreatLastPos = null;
                    monsterData.retreatStuckFrames = 0;
                    this.utilities.safeRemoveComponent(monster, 'MovementIntent');
                    return;
                }

                // Initialize retreat tracking on first frame
                if (!monsterData.retreatStartTime) {
                    monsterData.retreatStartTime = now;
                    monsterData.retreatLastPos = { x: pos.x, y: pos.y };
                    monsterData.retreatStuckFrames = 0;
                    console.log(`[RETREAT-START] ${monsterData.name} starting retreat timer at distance ${distanceToSpawn.toFixed(1)}px from spawn`);
                }

                // Stuck detection: check if monster has moved since last frame
                if (monster.hasComponent('MovementIntent')) {
                    monsterData.retreatStuckFrames = this.utilities.detectStuckMovement(
                        pos,
                        monsterData.retreatLastPos,
                        monsterData.retreatStuckFrames
                    );
                    if (monsterData.retreatStuckFrames > 0 && monsterData.retreatStuckFrames % 30 === 0) {
                        console.warn(`[RETREAT-STUCK] ${monsterData.name} stuck during retreat for ${monsterData.retreatStuckFrames} frames at (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}), distance to spawn: ${distanceToSpawn.toFixed(1)}px`);
                    }
                    monsterData.retreatLastPos = { x: pos.x, y: pos.y };
                }

                // Give up retreat after 10 seconds OR if stuck for 60+ frames (~1 second)
                const retreatDuration = now - monsterData.retreatStartTime;
                const RETREAT_TIMEOUT = 10000; // 10 seconds
                const MAX_RETREAT_STUCK_FRAMES = 60; // ~1 second at 60fps

                if (retreatDuration > RETREAT_TIMEOUT || monsterData.retreatStuckFrames >= MAX_RETREAT_STUCK_FRAMES) {
                    const reason = retreatDuration > RETREAT_TIMEOUT ? 'timeout' : 'stuck';
                    console.warn(`[RETREAT-ABANDONED] ${monsterData.name} giving up retreat due to ${reason} (duration: ${(retreatDuration/1000).toFixed(1)}s, stuck frames: ${monsterData.retreatStuckFrames}), teleporting to spawn`);

                    // Teleport to spawn and end retreat
                    pos.x = monsterData.spawnX;
                    pos.y = monsterData.spawnY;
                    monsterData.isRetreating = false;
                    monsterData.totalStuckEvents = 0;
                    monsterData.retreatStartTime = null;
                    monsterData.retreatLastPos = null;
                    monsterData.retreatStuckFrames = 0;

                    this.utilities.safeRemoveComponent(monster, 'MovementIntent');
                    return;
                }

                // Continue moving to spawn
                if (!monster.hasComponent('MovementIntent')) {
                    console.log(`[RETREAT-MOVING] ${monsterData.name} moving to spawn (${monsterData.spawnX.toFixed(1)}, ${monsterData.spawnY.toFixed(1)}), distance: ${distanceToSpawn.toFixed(1)}px`);
                    this.entityManager.addComponentToEntity(monster.id, new MovementIntentComponent(monsterData.spawnX, monsterData.spawnY));
                }

                // Set facing direction toward spawn
                this.utilities.setFacingDirection(monster, monsterData.spawnX, pos.x);

                return; // Skip normal behavior while retreating
            }

            monsterData.nearbyMonsters = [];
            if (monsterData.isAggro) {

                const nearbyMonsters = this.getNearbyMonsters(monster, this.AGGRO_RANGE);
                monsterData.nearbyMonsters = nearbyMonsters; // Store nearby monsters with distance in MonsterData

               // console.log(`MonsterControllerSystem: Updated nearbyMonsters for ${monsterData.name} with ${monsterData.nearbyMonsters.length} entries`);
                nearbyMonsters.forEach(({ entityId, distance }) => {
                    if (entityId === monster.id) return; // Skip self
                    const nearbyMonster = this.entityManager.getEntity(entityId);
                    const nearbyMonsterData = nearbyMonster.getComponent('MonsterData');

                    if (nearbyMonsterData.isAggro) return; // Skip if already aggro
                    if (nearbyMonsterData.isRetreating) return; // Skip if retreating to spawn

                    nearbyMonsterData.isAggro = true;

                    if (monsterData.isInCombat) {
                        nearbyMonster.addComponent(new InCombatComponent(3000)); // Set inCombat if the monster is already in combat
                     }
                    console.log(`MonsterControllerSystem: Nearby monster ${nearbyMonsterData.name} is now aggro at distance ${distance} from Aggro monster ${monsterData.name}`);
                                        
                });

                if (monster.hasComponent('RangedAttack')) {
                    const rangedAttack = monster.getComponent('RangedAttack');
                   // console.warn(`MonsterControllerSystem: ${monsterData.name} has ranged attack with range ${rangedAttack.range} distance to player`);
                    if (distance <= rangedAttack.range * this.TILE_SIZE) {
                       // console.warn(`MonsterControllerSystem: ${monsterData.name} is in ranged attack range of player at distance ${distance.toFixed(2)} pixels`);
                        //console.warn(`MonsterControllerSystem: ${monsterData.name} attack cooldown data: `,attackSpeed.elapsedSinceLastAttack, attackSpeed.attackSpeed);
                        if (attackSpeed.elapsedSinceLastAttack >= attackSpeed.attackSpeed) {
                           // console.warn(`MonsterControllerSystem: ${monsterData.name} is emitting ranged attack`);
                            this.eventBus.emit('MonsterRangedAttack', { entityId: monster.id, direction });
                            attackSpeed.elapsedSinceLastAttack = 0;
                            //////console.log(`MonsterControllerSystem: ${monsterData.name} ranged attacked player at distance ${distance.toFixed(2)} pixels`);
                        }
                        // Remove waypoint when in ranged attack range - prioritize combat
                        this.utilities.safeRemoveComponent(monster, 'AvoidanceWaypoint');
                        return; // Stop moving if in ranged attack range
                    }
                }


                if (distance <= this.MELEE_RANGE) {
                    if (attackSpeed.elapsedSinceLastAttack >= attackSpeed.attackSpeed) {
                        this.eventBus.emit('MonsterAttack', { entityId: monster.id });
                        attackSpeed.elapsedSinceLastAttack = 0;
                        //////console.log(`MonsterControllerSystem: ${monsterData.name} attacked player at distance ${distance.toFixed(2)} pixels`);
                    }
                    // Remove waypoint when in melee range - prioritize combat
                    this.utilities.safeRemoveComponent(monster, 'AvoidanceWaypoint');
                    // Reset stuck counter on successful combat engagement
                    if (monsterData.totalStuckEvents > 0) {
                        console.log(`[STUCK-RESET] ${monsterData.name} reached melee range, resetting stuck counter from ${monsterData.totalStuckEvents} to 0`);
                        monsterData.totalStuckEvents = 0;
                    }
                    return; // Stop moving if in melee range
                }

                // Check if monster has active avoidance waypoint
                if (monster.hasComponent('AvoidanceWaypoint')) {
                    const waypoint = monster.getComponent('AvoidanceWaypoint');

                    // Set origin position on FIRST encounter with waypoint (not when reached!)
                    if (waypoint.originX === null) {
                        waypoint.originX = pos.x;
                        waypoint.originY = pos.y;
                        console.log(`[WAYPOINT-ORIGIN] ${monsterData.name} starting waypoint journey from (${waypoint.originX.toFixed(1)}, ${waypoint.originY.toFixed(1)}) to (${waypoint.targetX.toFixed(1)}, ${waypoint.targetY.toFixed(1)})`);
                    }

                    const waypointDist = this.utilities.getDistance(pos, { x: waypoint.targetX, y: waypoint.targetY });

                    // Stuck detection: only run if monster has MovementIntent (actively trying to move)
                    if (monster.hasComponent('MovementIntent')) {
                        waypoint.stuckFrames = this.utilities.detectStuckMovement(
                            pos,
                            { x: waypoint.lastPosX, y: waypoint.lastPosY },
                            waypoint.stuckFrames
                        );
                        if (waypoint.stuckFrames > 0 && waypoint.stuckFrames % 5 === 0) {
                            console.log(`[STUCK] ${monsterData.name} at (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}) stuck for ${waypoint.stuckFrames} frames, waypoint: (${waypoint.targetX.toFixed(1)}, ${waypoint.targetY.toFixed(1)})`);
                        }
                        waypoint.lastPosX = pos.x;
                        waypoint.lastPosY = pos.y;
                    }

                    // If stuck for 10+ frames, remove waypoint and let pathChecking create a new one
                    if (waypoint.stuckFrames >= 10) {
                        // Increment total stuck events
                        monsterData.totalStuckEvents = (monsterData.totalStuckEvents || 0) + 1;

                        console.warn(`[STUCK-REMOVE] ${monsterData.name} stuck for ${waypoint.stuckFrames} frames at (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}), waypoint was (${waypoint.targetX.toFixed(1)}, ${waypoint.targetY.toFixed(1)}), distance to player: ${distance.toFixed(1)}px, total stuck events: ${monsterData.totalStuckEvents}`);

                        // Log nearby obstacles
                        const nearbyObstacles = this.entityManager.getEntitiesWith(['Position', 'Hitbox'])
                            .filter(e => {
                                if (e === monster || e.id === 'player') return false;
                                if (e.hasComponent('TriggerArea')) return false;
                                const ePos = e.getComponent('Position');
                                const dist = this.utilities.getDistance(ePos, pos);
                                return dist < 64; // Within 2 tiles
                            })
                            .map(e => {
                                const ePos = e.getComponent('Position');
                                const dist = this.utilities.getDistance(ePos, pos);
                                let type = 'unknown';
                                if (e.hasComponent('MonsterData')) type = 'monster';
                                else if (e.hasComponent('Chest')) type = 'chest';
                                else if (e.hasComponent('Portal')) type = 'portal';
                                else if (e.hasComponent('Stair')) type = 'stair';
                                else if (e.hasComponent('Fountain')) type = 'fountain';
                                return { id: e.id, type, dist: dist.toFixed(1) };
                            });
                        console.warn(`[STUCK-OBSTACLES] Nearby obstacles (within 2 tiles):`, nearbyObstacles);

                        // Check if exceeded max stuck attempts - if so, retreat to spawn
                        const MAX_STUCK_ATTEMPTS = 3;
                        if (monsterData.totalStuckEvents >= MAX_STUCK_ATTEMPTS) {
                            console.warn(`[RETREAT-INITIATED] ${monsterData.name} exceeded ${MAX_STUCK_ATTEMPTS} stuck events, retreating to spawn (${monsterData.spawnX?.toFixed(1)}, ${monsterData.spawnY?.toFixed(1)})`);
                            monsterData.isRetreating = true;
                            monsterData.isAggro = false;
                            this.utilities.safeRemoveComponent(monster, 'AvoidanceWaypoint');
                            // Clear MovementIntent - retreat logic will handle movement below
                            this.utilities.safeRemoveComponent(monster, 'MovementIntent');
                            return;
                        }

                        // Set stuck cooldown to prevent immediate re-creation of waypoints (500ms cooldown)
                        const stuckCooldownUntil = Date.now() + 500;
                        this.utilities.safeRemoveComponent(monster, 'AvoidanceWaypoint');

                        // Add a MonsterData property to track stuck cooldown across component removal
                        monsterData.stuckCooldownUntil = stuckCooldownUntil;

                        console.log(`[STUCK-REMOVE] Waypoint removed, will be on cooldown until ${stuckCooldownUntil}, then attempt new path to player at (${playerPos.x.toFixed(1)}, ${playerPos.y.toFixed(1)})`);

                        // Skip creating new MovementIntent - let cooldown expire first
                        return;
                    }
                    // Early exit: Remove waypoint if expired (but not just because reached - must verify clearance)
                    if (Date.now() > waypoint.expiresAt) {
                        console.log(`[WAYPOINT-EXPIRED] ${monsterData.name} waypoint expired, removing and retrying direct path`);
                        this.utilities.safeRemoveComponent(monster, 'AvoidanceWaypoint');
                    }
                    // Waypoint reached - check if monster has sufficient clearance from original obstacle
                    else if (waypointDist < 16) {
                        const traveledDist = this.utilities.getDistance(pos, { x: waypoint.originX, y: waypoint.originY });
                        const MIN_CLEARANCE_DISTANCE = 96; // Must travel at least 3 tiles to ensure obstacle clearance

                        if (traveledDist >= MIN_CLEARANCE_DISTANCE) {
                            console.log(`[WAYPOINT-REACHED] ${monsterData.name} reached waypoint after traveling ${traveledDist.toFixed(1)}px (>= ${MIN_CLEARANCE_DISTANCE}), checking if path to player is clear`);

                            // Now verify path to player is actually clear
                            if (this.isPathClearToPlayer(monster, pos, playerPos)) {
                                console.log(`[WAYPOINT-SUCCESS] ${monsterData.name} path to player confirmed clear, removing waypoint`);
                                this.utilities.safeRemoveComponent(monster, 'AvoidanceWaypoint');
                                // Reset stuck counter on successful waypoint completion
                                if (monsterData.totalStuckEvents > 0) {
                                    console.log(`[STUCK-RESET] ${monsterData.name} successfully completed waypoint, resetting stuck counter from ${monsterData.totalStuckEvents} to 0`);
                                    monsterData.totalStuckEvents = 0;
                                }
                            } else {
                                console.warn(`[WAYPOINT-INCOMPLETE] ${monsterData.name} reached waypoint but path still blocked, extending waypoint further`);
                                // Extend waypoint further in same direction
                                const waypointDx = waypoint.targetX - waypoint.originX;
                                const waypointDy = waypoint.targetY - waypoint.originY;
                                waypoint.targetX += waypointDx * 0.5; // Extend 50% further
                                waypoint.targetY += waypointDy * 0.5;
                                waypoint.expiresAt = Date.now() + 2000; // Extend expiry
                                console.log(`[WAYPOINT-EXTENDED] ${monsterData.name} new waypoint: (${waypoint.targetX.toFixed(1)}, ${waypoint.targetY.toFixed(1)})`);
                            }
                        } else {
                            console.log(`[WAYPOINT-TOO-CLOSE] ${monsterData.name} only traveled ${traveledDist.toFixed(1)}px (< ${MIN_CLEARANCE_DISTANCE}), continuing to waypoint`);
                        }
                    }
                    // Periodic check if direct path to player is now clear (throttled to every 200ms)
                    else if (Date.now() - waypoint.lastPathCheck >= 200) {
                        waypoint.lastPathCheck = Date.now();
                        const pathClear = this.isPathClearToPlayer(monster, pos, playerPos);
                        if (pathClear) {
                            waypoint.consecutiveClearChecks++;
                            console.log(`[PATH-CLEAR] ${monsterData.name} path check ${waypoint.consecutiveClearChecks}/3: CLEAR (distance to player: ${distance.toFixed(1)}px)`);
                            // Require 3 consecutive clears (~600ms total) before removing waypoint
                            if (waypoint.consecutiveClearChecks >= 3) {
                                console.log(`[PATH-CLEAR-SUCCESS] ${monsterData.name} path clear for ${waypoint.consecutiveClearChecks} consecutive checks, removing waypoint and going direct to player`);
                                this.utilities.safeRemoveComponent(monster, 'AvoidanceWaypoint');
                            }
                        } else {
                            // Path still blocked - reset counter
                            if (waypoint.consecutiveClearChecks > 0) {
                                console.log(`[PATH-BLOCKED] ${monsterData.name} path check FAILED after ${waypoint.consecutiveClearChecks} clear checks, resetting counter`);
                            }
                            waypoint.consecutiveClearChecks = 0;
                        }
                    }
                    // Continue to waypoint
                    else {
                        // Keep moving toward waypoint - ensure MovementIntent points to waypoint
                        if (!monster.hasComponent('MovementIntent')) {
                            // MovementIntent was removed (destination reached) - reset stuck tracking
                            waypoint.stuckFrames = 0;
                            waypoint.lastPosX = null;
                            waypoint.lastPosY = null;
                            this.entityManager.addComponentToEntity(monster.id, 
                                new MovementIntentComponent(waypoint.targetX, waypoint.targetY));
                        }
                        // Set facing direction toward waypoint
                        this.utilities.setFacingDirection(monster, waypoint.targetX, pos.x);
                        return; // Skip player targeting while avoiding
                    }
                }

                // Set facing direction
                this.utilities.setFacingDirection(monster, playerPos.x, pos.x);

                // Check if stuck cooldown is active
                if (monsterData.stuckCooldownUntil && Date.now() < monsterData.stuckCooldownUntil) {
                    // Still on cooldown - don't create MovementIntent yet
                    return;
                }

                // Clear stuck cooldown if it has expired
                if (monsterData.stuckCooldownUntil) {
                    console.log(`[STUCK-COOLDOWN-EXPIRED] ${monsterData.name} stuck cooldown expired, resuming movement to player`);
                    monsterData.stuckCooldownUntil = null;
                }

                // Set MovementIntent destimnation as the player's current position
                this.entityManager.addComponentToEntity(monster.id, new MovementIntentComponent(playerPos.x, playerPos.y));

            } else {
                // Monster not aggro - waypoint cleanup now handled by de-aggro logic above
                // This else block handles wandering behavior for non-aggro monsters

                if (!monster.hasComponent('MovementIntent') && !monsterData.isAggro && !monsterData.isBoss && monsterData.isElite) {

                    const { tileX, tileY } = this.utilities.getTileFromPixel(pos.x, pos.y);

                    let setNextWanderTile = false;

                    // Check if monster is currently wandering
                    if (monsterData.isWandering && monsterData.wanderTile) {
                        const nextTile = monsterData.wanderTile;
                        if (tileX === nextTile.x && tileY === nextTile.y) {
                            this.entityManager.removeComponentFromEntity(monster.id, 'MovementIntent');
                            monsterData.wanderCycles--;

                            if (monsterData.wanderCycles && monsterData.wanderCycles > 0) {
                                setNextWanderTile = true;
                            } else {
                                //console.log(`MonsterControllerSystem: ${monsterData.name} finished wandering`);
                                monsterData.isWandering = false;
                                monsterData.wanderTile = null;
                                return;
                            }
                        }
                        if (!setNextWanderTile) {
                            return; // Skip further processing if already wandering
                        }
                    }

                    if (Math.random() < this.MONSTER_WANDER_CHANCE || setNextWanderTile) {

                        let wanderTile = null;
                        let attempts = 0;
                        const maxAttempts = 10;
                        const maxOffset = 4; // ±4 tiles

                        while (attempts < maxAttempts && !wanderTile) {
                            const offsetX = Math.floor(Math.random() * (2 * maxOffset + 1)) - maxOffset;
                            const offsetY = Math.floor(Math.random() * (2 * maxOffset + 1)) - maxOffset;
                            const targetTileX = tileX + offsetX;
                            const targetTileY = tileY + offsetY;

                            if (
                                (targetTileX !== tileX || targetTileY !== tileY) &&
                                targetTileX >= 0 && targetTileX < 120 && targetTileY >= 0 && targetTileY < 67// Map bounds
                                && this.utilities.isWalkable(monster, targetTileX, targetTileY) // Exclude all MonsterData
                            ) {
                                wanderTile = { x: targetTileX, y: targetTileY };
                            }
                            attempts++;
                        }

                        if (wanderTile) {
                            if (!setNextWanderTile) {
                                monsterData.wanderCycles = Math.floor(Math.random() * 3) + 2; // Random cycles between 2 and 4
                            }
                            //console.log(`MonsterControllerSystem: ${monsterData.name} found wander target tile (${wanderTile.x}, ${wanderTile.y})  after ${attempts} attempts`);
                            monsterData.wanderTile = wanderTile;
                            monsterData.isWandering = true;
                            const nextPixel = this.utilities.getPixelFromTile(wanderTile.x, wanderTile.y);
                            this.entityManager.addComponentToEntity(monster.id, new MovementIntentComponent(nextPixel.x, nextPixel.y));
                        } else {
                            monsterData.isWandering = false;
                            monsterData.wanderTile = null;
                            this.entityManager.removeComponentFromEntity(monster.id, 'MovementIntent');
                            console.warn(`MonsterControllerSystem: ${monsterData.name} has to wanderTile set)`);
                        }
                    }

                }

            }
           
        });
    }
    
    isPathClearToPlayer(monster, monsterPos, playerPos) {
        // Simple raycast to check if path to player has obstacles
        const dx = playerPos.x - monsterPos.x;
        const dy = playerPos.y - monsterPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 1) return true; // Already at player

        // Normalize direction
        const dirX = dx / distance;
        const dirY = dy / distance;

        // Check every 8 pixels (quarter tile) for more accuracy
        const stepSize = 8;
        const numSteps = Math.floor(distance / stepSize);

        const hitbox = monster.getComponent('Hitbox');
        if (!hitbox) return false;

        // Get all entities that could block
        const allEntities = this.entityManager.getEntitiesWith(['Position', 'Hitbox']);

        for (let step = 1; step <= numSteps; step++) {
            const checkX = monsterPos.x + dirX * stepSize * step;
            const checkY = monsterPos.y + dirY * stepSize * step;

            // Check if this position would collide with anything
            for (const other of allEntities) {
                if (other === monster || other.id === 'player') continue;
                if (other.hasComponent('TriggerArea')) continue;
                // Ignore other monsters - they can pass through each other
                if (other.hasComponent('MonsterData')) continue;

                const otherPos = other.getComponent('Position');
                const otherHitbox = other.getComponent('Hitbox');

                const thisLeft = checkX + (hitbox.offsetX || 0);
                const thisTop = checkY + (hitbox.offsetY || 0);
                const thisRight = thisLeft + hitbox.width;
                const thisBottom = thisTop + hitbox.height;

                const otherLeft = otherPos.x + (otherHitbox.offsetX || 0);
                const otherTop = otherPos.y + (otherHitbox.offsetY || 0);
                const otherRight = otherLeft + otherHitbox.width;
                const otherBottom = otherTop + otherHitbox.height;

                if (thisLeft < otherRight && thisRight > otherLeft && 
                    thisTop < otherBottom && thisBottom > otherTop) {
                    return false; // Path is blocked
                }
            }
        }

        return true; // Path is clear
    }

    getNearbyMonsters(entity, range) {
        if (!entity || !entity.hasComponent('Position') || !this.bucketsComp) return [];
        const pos = entity.getComponent('Position');
        const bucketX = Math.floor(pos.x * this.invTileBucket); // Required to locate the entity's bucket
        const bucketY = Math.floor(pos.y * this.invTileBucket);

        const nearbyBuckets = [];
        const contagionRange = Math.ceil(range * this.invTileBucket); // Convert range to bucket units
       // console.log(`MonsterControllerSystem: Monster at bucket (${bucketX}, ${bucketY}), contagion range: ${contagionRange}`);

        for (let dx = -contagionRange; dx <= contagionRange; dx++) {
            for (let dy = -contagionRange; dy <= contagionRange; dy++) {
                const bucketKey = `${bucketX + dx},${bucketY + dy}`;
                if (this.bucketsComp.monsterBuckets.has(bucketKey)) {
                    nearbyBuckets.push(...this.bucketsComp.monsterBuckets.get(bucketKey));
                }
            }
        }

        const nearbyMonsters = nearbyBuckets
            .map(id => this.entityManager.getEntity(id))
            .filter(entity => entity && entity.hasComponent('MonsterData'))
            .map(nearbyMonster => {
                const nearbyPos = nearbyMonster.getComponent('Position');
                const distance = this.utilities.getDistance(pos, nearbyPos);
                return { entityId: nearbyMonster.id, distance };
            });

        return nearbyMonsters.filter(m => m.distance <= range);
    }

    handleMonsterDeath(entityId) {
        const monster = this.entityManager.getEntity(entityId);
        const player = this.entityManager.getEntity('player');
        if (!monster || !player) return;

        const monsterData = monster.getComponent('MonsterData');
        const health = monster.getComponent('Health');
        health.hp = 0;
        monsterData.isAggro = false;

        const tier = this.entityManager.getEntity('gameState').getComponent('GameState').tier;
        const baseXp = Math.round((health.maxHp / 3 + (monsterData.minBaseDamage + monsterData.maxBaseDamage * 1.5)) * (1 + tier * 0.1));
        this.eventBus.emit('LogMessage', { message: `${monsterData.name} defeated!` });
        this.eventBus.emit('AwardXp', { amount: baseXp });

        if (monsterData.isBoss) {
            this.utilities.pushPlayerActions('bossKill', { monsterId: monsterData.id, tier });
            ////console.log(`MonsterControllerSystem: Boss defeated: ${monsterData.name}, awarding special actions and loot.`);
        } else {
            this.utilities.pushPlayerActions('monsterKill', { monsterId: monsterData.id, tier });
            ////console.log(`MonsterControllerSystem: Monster defeated: ${monsterData.name}, awarding actions and loot.`);
        }

        const lootSource = this.entityManager.createEntity(`loot_source_${monsterData.tier}_${Date.now()}`);
        const items = Array.isArray(monsterData.uniqueItemsDropped)
            ? monsterData.uniqueItemsDropped.filter(item => {
                if (!item || typeof item !== 'object' || !item.type || !item.data) {
                    console.warn(`MonsterControllerSystem: Invalid uniqueItemsDropped entry for ${monsterData.name}:`, item);
                    return false;
                }
                if (item.type === 'customUnique' && typeof item.data.name !== 'string') {
                    console.warn(`MonsterControllerSystem: Invalid customUnique entry for ${monsterData.name}:`, item);
                    return false;
                }
                return true;
            })
            : [];
        this.entityManager.addComponentToEntity(lootSource.id, new LootSourceData({
            sourceType: "monster",
            name: monsterData.name,
            tier: monsterData.tier,
            position: monster.getComponent('Position'),
            sourceDetails: { id: monster.id },
            chanceModifiers: {
                torches: 1,
                healPotions: 1,
                gold: 1,
                item: 1,
                uniqueItem: 1
            },
            maxItems: items.length > 0 ? items.length : 1,
            items: items
        }));
        this.eventBus.emit('DropLoot', { lootSource });


    }

}

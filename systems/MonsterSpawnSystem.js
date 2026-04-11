// systems/MonsterSpawnSystem.js
import { System } from '../core/Systems.js';
import { PositionComponent, LastPositionComponent, HealthComponent, AttackSpeedComponent, MovementSpeedComponent, AffixComponent, VisualsComponent, HitboxComponent, RangedAttackComponent } from '../core/Components.js';

export class MonsterSpawnSystem extends System {
    constructor(entityManager, eventBus, utilities, dataSystem) {
        super(entityManager, eventBus, utilities);
        this.dataSystem = dataSystem;
        this.MIN_SPAWN_DISTANCE = 6; // Minimum distance from player
        this.TILE_SIZE = 32; // Assuming each tile is 32x32 pixels
        this.BASE_HEALTH_REGEN = 0.005; // Base health regeneration multiplier (0.5% of max HP per second)

        // Aggro range for monsters (set to your actual aggro range)
        this.DEFAULT_AGGRO_RANGE = 6;
        this.MIN_SPAWN_DISTANCE_TO_STAIRS = this.DEFAULT_AGGRO_RANGE + 1;

        // Temporary static affix map (to be moved to DataSystem later)
        this.AFFIX_MAP = {
            "goldTheft": {
                type: "combat",
                trigger: "attackHitTarget",
                effect: "stealGold",
                params: { stealPercentage: 0.1, minSteal: 1 }
            }
        };

        this.primaryFamilies = ['goblinoid', 'undead', 'demon'];
        this.secondaryFamilies = ['beast', 'fey', 'mythical', 'draco'];

        this.primaryFalilyTable = (roll) => { // Tier 0: Levels 1-4
            if (roll < 0.40) return 1;
            if (roll < 0.80) return 2;
            if (roll >= 0.81) return 3;
        };
    }

    init() {
        this.eventBus.on('SpawnMonsters', (data) => this.handleSpawnMonsters(data));
    }

    update(deltaTime) { }

    getStairTilesForTier(tier) {
        const levelEntity = this.entityManager.getEntitiesWith(['Tier']).find(e => e.getComponent('Tier').value === tier);
        if (!levelEntity) return [];
        const mapComp = levelEntity.getComponent('Map');
        if (!mapComp) return [];
        const stairs = [];
        if (mapComp.stairsUp) stairs.push(mapComp.stairsUp);
        if (mapComp.stairsDown) stairs.push(mapComp.stairsDown);
        // If you have more stairs, add them here
        return stairs;
    }

    // systems/MonsterSpawnSystem.js - Updated handleSpawnMonsters method
    async handleSpawnMonsters({ tier, rooms, hasBossRoom, spawnPool }) {
        const baseMonsterCount = 15;
        const densityFactor = 1 + tier * 0.1;
        const monsterCount = Math.floor(baseMonsterCount * densityFactor);
        const player = this.entityManager.getEntity('player');
        const playerX = player.getComponent('Position').x;
        const playerY = player.getComponent('Position').y;

        const fetchData = (eventName) => {
            return new Promise((resolve) => {
                this.eventBus.emit(eventName, {
                    callback: (data) => resolve(data)
                });
            });
        };

        const promises = [];
        if (spawnPool.randomMonsters) {
            promises.push(fetchData('GetRandomMonsters'));
        } else {
            promises.push(Promise.resolve([])); // Placeholder for randomMonsters
        }
        if (spawnPool.uniqueMonsters) {
            promises.push(fetchData('GetUniqueMonsters'));
        } else {
            promises.push(Promise.resolve([])); // Placeholder for uniqueMonsters
        }
        if (hasBossRoom) {
            promises.push(fetchData('GetBossMonsters'));
        } else {
            promises.push(Promise.resolve([])); // Placeholder for bossMonsters
        }

        Promise.all(promises).then(([randomMonsters, uniqueMonsters, bossMonsters]) => {
            const allTemplates = [
                ...(randomMonsters || []),
                ...(uniqueMonsters || [])
            ];
            ////console.log('MonsterSpawnSystem: Random monsters:', randomMonsters);
            ////console.log('MonsterSpawnSystem: Unique monsters:', uniqueMonsters);
            ////console.log('MonsterSpawnSystem: Boss monsters:', bossMonsters);
            ////console.log('MonsterSpawnSystem: Monster spawn pool:', spawnPool);
            ////console.log(`MonsterSpawnSystem: Spawning ${monsterCount} monsters for tier ${tier}`);

            this.entityManager.setActiveTier(tier); // NEW: Ensure tier sync
            ////console.log(`MonsterSpawnSystem: Active tier set to ${tier}, rooms: ${rooms}`);

            if (hasBossRoom) {
                ////console.log('MonsterSpawnSystem: Starting Boss Monster RoomSelection');
                const bossRoomId = rooms.find(roomId => {
                    const roomEntity = this.entityManager.getEntity(roomId);
                    if (!roomEntity) {
                        console.error(`MonsterSpawnSystem: Entity ${roomId} not found in tier ${tier}`);
                        return false;
                    }
                    const roomComp = roomEntity.getComponent('Room');
                    if (!roomComp) {
                        console.error(`MonsterSpawnSystem: No Room component for ${roomId}`);
                        return false;
                    }
                    return roomComp.roomType === 'BossChamberSpecial';
                });
                ////console.log(`MonsterSpawnSystem: Boss room ID: ${bossRoomId}`);
                if (bossRoomId && bossMonsters) {
                    const bossTemplate = bossMonsters[Math.floor(Math.random() * bossMonsters.length)];
                    const boss = this.createMonsterEntity(bossTemplate, tier, [bossRoomId], playerX, playerY);
                    ////console.log(`MonsterSpawnSystem: Selected Boss ${bossTemplate.name} to spawn at (${boss.getComponent('Position').x}, ${boss.getComponent('Position').y})`, boss);

                    if (boss) {
                        boss.getComponent('MonsterData').isBoss = true;
                        ////console.log(`MonsterSpawnSystem: Boss ${boss.getComponent('MonsterData').name} spawned at (${boss.getComponent('Position').x}, ${boss.getComponent('Position').y})`);
                        const entityList = this.entityManager.getEntitiesWith(['Tier']).find(e => e.getComponent('Tier').value === tier).getComponent('EntityList');
                        entityList.monsters.push(boss.id);
                    } else {
                        console.error(`MonsterSpawnSystem: Failed to spawn boss ${bossTemplate.name} in room ${bossRoomId}`);
                    }
                } else {
                    console.error(`MonsterSpawnSystem: No boss room (${bossRoomId}) or bossMonsters (${bossMonsters.length}) for tier ${tier}`);
                }
            }

            const normalRoomIds = hasBossRoom ? rooms.filter(roomId => {
                const roomEntity = this.entityManager.getEntity(roomId);
                const roomComp = roomEntity.getComponent('Room');
                return roomComp.type !== 'BossChamberSpecial';
            }) : rooms;
            let eliteMonsterCount = 0;

            const primaryFamily = this.primaryFamilies[Math.floor(Math.random() * this.primaryFamilies.length)];
            ////console.log(`MonsterSpawnSystem: Primary family selected: ${primaryFamily}`);
            const tierMonsters = (randomMonsters || []).filter(m => m.minDungeonTier <= tier);

            const tierPrimaryFamilyMonsters = tierMonsters.filter(m => m.family === primaryFamily);
            const tierSecondaryFamilyMonsters = tierMonsters.filter(m => this.secondaryFamilies.includes(m.family));

            const tierUniqueMonsters = (uniqueMonsters || []).filter(m => m.minDungeonTier <= tier);

            if (tierMonsters.length === 0 && tierUniqueMonsters.length === 0) {
                console.warn(`MonsterSpawnSystem: No monsters available for tier ${tier}`);
                return false;
            }

            for (let i = 0; i < monsterCount; i++) {
                if (!tierMonsters || tierMonsters.length === 0) {
                    console.warn('MonsterSpawnSystem: No random monsters available to spawn');
                    break;
                }

                const monsterArray = Math.random() < 0.90 ? tierPrimaryFamilyMonsters : tierSecondaryFamilyMonsters;

                let template = monsterArray[Math.floor(Math.random() * monsterArray.length)];

                if (spawnPool.uniqueMonsters && Math.random() < .05 * tier && eliteMonsterCount <= monsterCount * .2) {
                    if (tierUniqueMonsters.length > 0) {
                        eliteMonsterCount++;
                        template = tierUniqueMonsters[Math.floor(Math.random() * tierUniqueMonsters.length)];
                    } else {
                        console.warn('MonsterSpawnSystem: No unique monsters available, falling back to random monster');
                    }
                }

                if (!playerX || !playerY) {
                    console.error(`MonsterSpawnSystem.js: Player position {x:${playerX},  y:${playerY} could not be resolved for calling createMonsterEntity`);
                    return false;
                }

                const monster = this.createMonsterEntity(template, tier, normalRoomIds, playerX, playerY);
                if (monster) {
                    const entityList = this.entityManager.getEntitiesWith(['Tier']).find(e => e.getComponent('Tier').value === tier).getComponent('EntityList');
                    entityList.monsters.push(monster.id);
                }
            }
        }).catch(err => {
            console.error('MonsterSpawnSystem: Failed to fetch monster data:', err);
        });
    }
    
    createMonsterEntity(template, tier, roomIds, playerX, playerY) {
        if (!roomIds || roomIds.length === 0) {
            console.error(`MonsterSpawnSystem.js: No rooms provided for spawning monsters on tier ${tier}`);
            return null;
        }
        const entity = this.entityManager.createEntity(`monster_${tier}_${Math.random().toString(36).substring(2, 11)}`);
        const roomId = roomIds[Math.floor(Math.random() * roomIds.length)];
        const roomEntity = this.entityManager.getEntity(roomId);
        if (!roomEntity) {
            console.error(`MonsterSpawnSystem.js: Room entity ${roomId} not found`);
            return null;
        }
        const room = roomEntity.getComponent('Room');
        if (!room) {
            console.error(`MonsterSpawnSystem.js: RoomComponent not found for room ${roomId}`);
            return null;
        }
        if (room.suppressMonsters) {
            console.warn(`MonsterSpawnSystem.js: Monsters suppressed for room ${roomId}`);
            return null;
        }
        let tileX, tileY;
        let attempts = 0;
        const maxAttempts = 50;
        let isOccupied = false;

        const MIN_SPAWN_DISTANCE = this.MIN_SPAWN_DISTANCE; // 6 tiles

        // Define player tile coordinates outside the loop
        const playerTileX = Math.floor(playerX / this.TILE_SIZE);
        const playerTileY = Math.floor(playerY / this.TILE_SIZE);

        // Get all stair tiles for this tier
        const stairTiles = this.getStairTilesForTier(tier);

        let distance;
        let minDistToStairs;
        do {
            if (attempts >= maxAttempts) {
                console.warn(`MonsterSpawnSystem.js: Failed to find valid spawn position for ${template.name} in room ${roomId} after ${maxAttempts} attempts`);
                return null;
            }
            tileX = room.left + 1 + Math.floor(Math.random() * (room.width - 2));
            tileY = room.top + 1 + Math.floor(Math.random() * (room.height - 2));
            const entitiesAtTarget = this.entityManager.getEntitiesWith(['Position']).filter(e => {
                const ePos = e.getComponent('Position');
                const pixelX = tileX * this.TILE_SIZE;
                const pixelY = tileY * this.TILE_SIZE;
                return ePos.x === pixelX && ePos.y === pixelY;
            });
            isOccupied = entitiesAtTarget.some(e => e.hasComponent('MonsterData'));

            const dx = playerTileX - tileX;
            const dy = playerTileY - tileY;
            distance = Math.sqrt(dx * dx + dy * dy);

            // Calculate minimum distance to any stair tile
            minDistToStairs = stairTiles.length > 0
                ? stairTiles.reduce((minDist, stair) => {
                    const stairDx = stair.x - tileX;
                    const stairDy = stair.y - tileY;
                    const dist = Math.sqrt(stairDx * stairDx + stairDy * stairDy);
                    return Math.min(minDist, dist);
                }, Infinity)
                : Infinity;

            attempts++;
        } while (
            !this.utilities.isWalkable(entity.id, tileX, tileY) ||
            isOccupied ||
            (tileX === playerTileX && tileY === playerTileY) ||
            distance < MIN_SPAWN_DISTANCE ||
            minDistToStairs < this.MIN_SPAWN_DISTANCE_TO_STAIRS
        );

        const maxHp = this.calculateMonsterMaxHp(template.baseHp, tier);
        // Convert tile coordinates to pixel coordinates
        const pixelX = tileX * this.TILE_SIZE;
        const pixelY = tileY * this.TILE_SIZE;
        this.entityManager.addComponentToEntity(entity.id, new PositionComponent(pixelX, pixelY));
        this.entityManager.addComponentToEntity(entity.id, new LastPositionComponent(0, 0));
        this.entityManager.addComponentToEntity(entity.id, new HealthComponent(maxHp, maxHp));
        const healthComp = entity.getComponent('Health');
        healthComp.healthRegen = template.healthRegen || this.BASE_HEALTH_REGEN; // This will be used as a multiplier against max HP to determine actual regen amount per second

        const attackSpeed = template.attackSpeed || 1000; // Default attack speed if not specified
        this.entityManager.addComponentToEntity(entity.id, new AttackSpeedComponent(attackSpeed));

        const movementSpeed = template.movementSpeed || 65; // Default movement speed if not specified
        this.entityManager.addComponentToEntity(entity.id, new MovementSpeedComponent(movementSpeed));
        const movementSpeedComp = entity.getComponent('MovementSpeed');
        movementSpeedComp.combatSpeedMultiplier = .9;

        if (tier >= 7 && tier <= 10 && template.isElite) {
            const dropChance = 0.4; // 60% base chance
            const dropModifier = (tier - 8) * 0.3; // +20% per tier above 8
            const dropRoll = Math.random();
            const player = this.entityManager.getEntity('player');
            const uniqueItemsCollected = player.getComponent('PlayerAchievements').stats.uniqueItemDrops;
           /* const hasBothRings = uniqueItemsCollected.some(item => item.journeyItemId === 'bandOfZu') &&
                uniqueItemsCollected.some(item => item.journeyItemId === 'bandOfKarn');*/
            const hasWyrmTooth = uniqueItemsCollected.some(item => item.journeyItemId === 'wyrmTooth');

            // if (hasBothRings && !hasWyrmTooth && dropRoll < dropChance + dropModifier) {
            if (!hasWyrmTooth && dropRoll < dropChance + dropModifier) {
                template.uniqueItemsDropped.push({
                    type: 'customUnique',
                    dropChance: 1,
                    data: { name: 'Wyrm Tooth', journeyItemId: 'wyrmTooth' }
                });
            }
        } 

        if (tier === 3 && template.isBoss) {
            template.uniqueItemsDropped.push({
                type: 'rog',
                dropChance: 1,
                data: {
                    tierIndex: 2,
                    type: "armor",
                    name: 'Vestment of Zukarath',
                    journeyItemId: 'vestmentOfZukarath'
                }
            });
        }
        if (tier === 6 && template.isBoss) {
            template.uniqueItemsDropped.push({
                type: 'rog',
                dropChance: 1,
                data: {
                    tierIndex: 2,
                    type: "amulet",
                    name: 'Sigil of Zukarath',
                    journeyItemId: 'sigilOfZukarath'
                }
            });
        }
        if (tier >= 8 && tier < 11 && template.isElite) {

            const drop = 0.20; // Base drop chance for the item
            let dropModifier = 0; // Default drop modifier
            if (tier > 8) {
                 dropModifier = (tier - 8) * 0.4; // Increase drop chance by 40% per tier above 8
            }
            const dropRoll = Math.random();

            if (dropRoll < drop + dropModifier) {

                const rings = [
                    { name: 'Band of Zu', journeyItemId: 'bandOfZu' },
                    { name: 'Band of Karn', journeyItemId: 'bandOfKarn' }
                ];

                // Fisher-Yates shuffle
                for (let i = rings.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [rings[i], rings[j]] = [rings[j], rings[i]];
                }

                const player = this.entityManager.getEntity('player');
                const uniqueItemsCollected = player.getComponent('PlayerAchievements').stats.uniqueItemDrops;

                // Find the first ring not yet collected
                const ringToDrop = rings.find(ring =>
                    !uniqueItemsCollected.some(collected => collected.journeyItemId === ring.journeyItemId)
                );

                if (ringToDrop) {
                    template.uniqueItemsDropped.push({
                        type: 'customUnique',
                        dropChance: 1,
                        data: { name: ringToDrop.name }
                    });
                }

            }
        }

        this.entityManager.addComponentToEntity(entity.id, {
            type: 'MonsterData',
            hpBarWidth: this.TILE_SIZE,
            name: template.name,
            tier: tier,
            classes: template.classes,
            avatar: template.avatar,
            minBaseDamage: template.minBaseDamage + Math.floor(tier / 3),
            maxBaseDamage: template.maxBaseDamage + Math.floor(tier / 2),
            isAggro: false,
            isDetected: false,
            isElite: template.isElite || false,
            isBoss: template.isBoss || false,
            affixes: template.affixes || [],
            uniqueItemsDropped: template.uniqueItemsDropped || [],
            spawnX: pixelX,
            spawnY: pixelY,
            totalStuckEvents: 0,
            isRetreating: false
        });
        const vHeight = template.h || this.TILE_SIZE;
        const vWidth = template.w || this.TILE_SIZE;
        this.entityManager.addComponentToEntity(entity.id, new VisualsComponent(vHeight, vWidth));
        const visuals = entity.getComponent('Visuals');
        visuals.avatar = template.avatar.length > 1 ? template.avatar : 'img/avatars/monsters/skeleton.png';

        const hbHeight = template.hbHeight || vHeight || this.TILE_SIZE;
        const hbWidth = template.hbWidth || vWidth || this.TILE_SIZE;
        const hbPadding = 2;
        this.entityManager.addComponentToEntity(entity.id, new HitboxComponent(hbWidth - hbPadding, hbHeight - hbPadding));

        if (template.isElite) {
            this.eventBus.emit('LightSourceActivated', ({ type: 'elite', entityId: entity.id }));
        } else if (template.isBoss) {
            this.eventBus.emit('LightSourceActivated', ({ type: 'boss', entityId: entity.id }));
        }


        // Add AffixComponent for each affix in template.affixes
        const affixDefinitions = (template.affixes || []).map(affixName => {
            const affixData = this.AFFIX_MAP[affixName];
            if (affixData) {
                return {
                    type: affixData.type,
                    trigger: affixData.trigger,
                    effect: affixData.effect,
                    params: affixData.params
                };
            }
            console.warn(`MonsterSpawnSystem: Unknown affix ${affixName} for ${template.name}`);
            return null;
        }).filter(Boolean);

        if (affixDefinitions.length > 0) {
            this.entityManager.addComponentToEntity(entity.id, new AffixComponent(affixDefinitions));
            ////console.log(`MonsterSpawnSystem: Added affixes to ${template.name}:`, affixDefinitions);
        }

        if (template.rangedAttack) {
            this.entityManager.addComponentToEntity(entity.id, new RangedAttackComponent(template.rangedAttack));
        }

        ////console.log(`MonsterSpawnSystem: Entity ${entity.id} classes: ${template.classes}, components:`, Array.from(entity.components.keys()));
        ////console.log(`MonsterSpawnSystem.js: Spawned monster ${entity.id} at pixel (${pixelX}, ${pixelY}) for tile (${tileX}, ${tileY}) on tier ${tier}`, entity);
        return entity;
    }

    calculateMonsterMaxHp(baseHp, tier) {
        const BASE_GROWTH_RATE = 0.25;
        const INITIAL_VARIANCE_FACTOR = 0.1;
        const VARIANCE_GROWTH_RATE = 0.005;
        const tierAdjustment = tier - 1;
        const varianceScaling = 1 + VARIANCE_GROWTH_RATE * tierAdjustment;
        const variance = Math.random() * INITIAL_VARIANCE_FACTOR * varianceScaling;
        return Math.round(baseHp * (1 + BASE_GROWTH_RATE * tierAdjustment + variance));
    }

}


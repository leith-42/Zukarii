import { System } from '../core/Systems.js';

import {
    MapComponent,
    EntityListComponent,
    PositionComponent,
    VisualsComponent,
    ExplorationComponent,
    LootSourceData,
    WallComponent,
    FloorComponent,
    StairComponent,
    PortalComponent,
    FountainComponent,
    RoomComponent,
    HitboxComponent,
    SpatialBucketsComponent,
    NPCDataComponent,
    ShopComponent,
    TriggerAreaComponent,
    ShopCounterComponent
} from '../core/Components.js';

export class EntityGenerationSystem extends System {

    constructor(entityManager, eventBus, state, utilities) {
        super(entityManager, eventBus, utilities);
        this.state = state;
        this.TILE_SIZE = this.state.TILE_SIZE || 32;
        
    }


    generateStairEntity(levelData, entityList, tier, roomId, direction, x, y, returnEntity = false) {
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        const map = levelData.map;
        const lockedLevels = [6, 10];
        const roomEntity = this.entityManager.getEntity(roomId);
        const room = roomEntity.getComponent('Room');
        
        let active = true;
        if (direction === 'down' && lockedLevels.includes(tier) && gameState.highestTier <= tier) {
            console.warn(`EntityGenerationSystem: generateStairEntity - Stairs down at tier ${tier} are locked until highest tier is reached.`);
            console.warn(`EntityGenerationSystem: generateStairEntity - Highest tier is currently ${gameState.highestTier}.`);
            active = false;
        }
        const stairId = `stair_${tier}_stair_${direction}_${x}_${y}`
        const stairEntity = this.entityManager.createEntity(stairId);
        if (!Array.isArray(room.hasEntities)) {
            room.hasEntities = [];
        }
        room.hasEntities.push({ id: stairId, type: 'Stair' });
        this.entityManager.addComponentToEntity(stairEntity.id, new PositionComponent(x * this.TILE_SIZE, y * this.TILE_SIZE));
        this.entityManager.addComponentToEntity(stairEntity.id, new StairComponent(direction, active));
        this.entityManager.addComponentToEntity(stairEntity.id, new VisualsComponent(32, 42));
        this.entityManager.addComponentToEntity(stairEntity.id, new HitboxComponent(28, 38));
        const visuals = stairEntity.getComponent('Visuals');
        visuals.avatar = `img/avatars/stairs${direction}.png`;
        entityList.stairs.push(stairEntity.id);
        const stairChar = direction === 'down' ? '⇓' : '⇑';
        map[y][x] = stairChar;
        if (direction === 'down') { levelData.stairsDown = { x, y }; } else { levelData.stairsUp = { x, y } }
        console.log(`EntityGenerationSystem: Placed stairs ${direction} at (${x}, ${y}) on tier ${tier}`, stairEntity);

        if (direction === 'down' && tier === 10) {
            visuals.avatar = `img/avatars/ashangal_guardian.png`;
            visuals.w = 64;
            visuals.h = 54;
            this.generateTriggerArea(entityList, x, y, 512, 512, 'DialogueMessage',  {
                message: { message: 'You feel a strange dark force in this area!', params: '' }
            })
        }

        if (returnEntity) return stairEntity;
    }

    generatePortal(entityList, tier, mapComp, x, y, active = true) {
        const portalEntity = this.entityManager.createEntity(`portal_${tier}_portal_${entityList.portals.length}`);
        this.entityManager.addComponentToEntity(portalEntity.id, new PositionComponent(x * this.TILE_SIZE, y * this.TILE_SIZE));
        this.entityManager.addComponentToEntity(portalEntity.id, new PortalComponent());
        const portalComp = portalEntity.getComponent('Portal');
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        const player = this.entityManager.getEntity('player');

        this.entityManager.addComponentToEntity(portalEntity.id, new VisualsComponent(48, 72));
        this.entityManager.addComponentToEntity(portalEntity.id, new HitboxComponent(24, 24, 23, 43));
        const visuals = portalEntity.getComponent('Visuals');
        const hitBox = portalEntity.getComponent('Hitbox');

        let visualsImg = 'img/anim/Portal-Animation.png';
        let cleansed = false; // Portals are not cleansed by default
        let lightsourceDefinition = 'portalBlue'; // Default light source definition
        const unlockedPortals = player.getComponent('PlayerAchievements').stats.unlockedPortals || [];
        const cleansedPortals = player.getComponent('PortalBindingds')?.cleansed || [];
        console.warn(`EntityGenerationSystem: generatePortal - Starting for tier ${tier}`, unlockedPortals, cleansedPortals);
        if (cleansedPortals.includes(tier) || unlockedPortals.includes(tier)) {
            active = true;
            cleansed = true;
            visualsImg = 'img/anim/Portal-Animation-Cleansed.png';
            lightsourceDefinition = 'portalGreen';
        } else if (tier < 11 && gameState.highestTier < 11) {
            active = false;
            cleansed = false;
            visualsImg = 'img/avatars/inactive-portal.png';
            lightsourceDefinition = null;
        } else if (tier < 11 && gameState.highestTier >= 11) {
            active = true;
            cleansed = true;
            visualsImg = 'img/anim/Portal-Animation-Cleansed.png';
            lightsourceDefinition = 'portalGreen';
        }

        if (lightsourceDefinition) {
            this.eventBus.emit('LightSourceActivated', ({ type: lightsourceDefinition, entityId: portalEntity.id }));
            console.log(`EntityGenerationSystem: generatePortal - emitted light source activation request for portal at tier ${tier} with definition ${lightsourceDefinition}`);
        }
        
        console.log(`EntityGenerationSystem: generatePortal - Portal visuals set to ${visualsImg} for tier ${tier}, cleansed: ${cleansed}`, gameState);

        portalComp.active = active;
        portalComp.cleansed = cleansed; 
        visuals.avatar = visualsImg;

        entityList.portals.push(portalEntity.id);
        mapComp.map[y][x] = '?';
        this.eventBus.emit('PortalAdded');

        console.log(`LevelSystem - PORTAL - Portal Entity Created on tier: ${tier} at x:${x}, y:${y}`, portalEntity);

        return portalEntity;

    }

    minDistanceRequirementCheck(newPosition, existingPositions, minDistance) {
        const { x: newX, y: newY } = newPosition;

        for (const { x: existingX, y: existingY } of existingPositions) {
            const dx = newX - existingX;
            const dy = newY - existingY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < minDistance) {
                return false; // Distance is less than the minimum required
            }
        }

        return true; // All distances are greater than or equal to the minimum required
    }

    /*
    generateFountains(tier, levelData, entityList, mapComp) {
        const map = mapComp.map;
        const roomEntityIds = levelData.roomEntityIds;
        const isCustomLevel = levelData.isCustomLevel || false;
        console.log(`EntityGenerationSystem: generateFountains - Starting for tier ${tier}`);

        const fountainsPerLevel = () => {
            let r = Math.random();
            return r <.03 ? 0 : r < 0.95 ? 1 : 2;
        }
        const fountainCount = fountainsPerLevel();
        console.log(`EntityGenerationSystem: generateFountains - Fountain count for tier ${tier}: ${fountainCount}`);
        const validRoomIds = roomEntityIds.filter(roomId => {
            const room = this.entityManager.getEntity(roomId).getComponent('Room');
            return isCustomLevel || !(Array.isArray(room.hasEntities) && room.hasEntities.some(e => e.type === 'Fountain' || e.type === 'Stair'));
        });

        if (validRoomIds.length === 0) { console.log(`EntityGeneration: generateFountains() - No valid rooms for fouintain placement`); return; }

        const existingFountainPositions = [];
        const minDistance = 1162; 

        for (let i = 0; i < fountainCount+5; i++) {
            
            const roomId = validRoomIds.splice(Math.floor(Math.random() * validRoomIds.length), 1)[0];
            const room = this.entityManager.getEntity(roomId).getComponent('Room');
            let x, y;
            let attempts = 0;
            do {
                x = room.left + 1 + Math.floor(Math.random() * (room.width - 2));
                y = room.top + 1 + Math.floor(Math.random() * (room.height - 2));
                attempts++;

                const canPlace = this.minDistanceRequirementCheck({ x, y }, existingFountainPositions, minDistance);
                if (canPlace) {
                    // Add the new fountain position to the list of existing positions
                    existingFountainPositions.push({ x, y });
                    break;
                }

                if (attempts > 50) {
                    console.error(`Failed to place fountain in room after 50 attempts`);
                    break;
                }
            } while (map[y][x] !== ' ');
            if (attempts <= 50) {
                const fountainEntity = this.generateFountainEntity(entityList, tier, mapComp, x, y, true, room);
            }
        }
      
        console.log(`EntityGenerationSystem: generateFountains - Completed for tier ${tier}`);
        //return fountains;
    }
    */

    generateFountains(tier, levelData, entityList, mapComp) {
        const map = mapComp.map;
        const roomEntityIds = levelData.roomEntityIds;
        const isCustomLevel = levelData.isCustomLevel || false;
        console.log(`EntityGenerationSystem: generateFountains - Starting for tier ${tier}`);

        const fountainsPerLevel = () => {
            let r = Math.random();
            return r < 0.03 ? 0 : r < 0.95 ? 1 : 2;
        };
        const fountainCount = fountainsPerLevel();
        console.log(`EntityGenerationSystem: generateFountains - Fountain count for tier ${tier}: ${fountainCount}`);

        const validRoomIds = roomEntityIds.filter(roomId => {
            const room = this.entityManager.getEntity(roomId).getComponent('Room');
            return isCustomLevel || !(Array.isArray(room.hasEntities) && room.hasEntities.some(e => e.type === 'Fountain' || e.type === 'Stair'));
        });

        if (validRoomIds.length === 0) {
            console.log(`EntityGeneration: generateFountains() - No valid rooms for fountain placement`);
            return;
        }

        const existingFountainPositions = [];
        const minDistance = 512; // Minimum distance between fountains (based on trigger area size)
        let placedFountains = 0;

        while (placedFountains < fountainCount && validRoomIds.length > 0) {
            // Pick a random room from the remaining valid rooms
            const roomId = validRoomIds.splice(Math.floor(Math.random() * validRoomIds.length), 1)[0];
            const room = this.entityManager.getEntity(roomId).getComponent('Room');
            let attempts = 0;
            let fountainPlaced = false;

            while (attempts < 50) {
                const x = room.left + 1 + Math.floor(Math.random() * (room.width - 2));
                const y = room.top + 1 + Math.floor(Math.random() * (room.height - 2));
                attempts++;

                // Check minimum distance requirement
                const canPlace = this.minDistanceRequirementCheck({ x, y }, existingFountainPositions, minDistance);
                if (canPlace && map[y][x] === ' ') {
                    // Place the fountain and add its position to the list
                    this.generateFountainEntity(entityList, tier, mapComp, x, y, true, room);
                    existingFountainPositions.push({ x, y });
                    placedFountains++;
                    fountainPlaced = true;
                    break;
                }
            }

            if (!fountainPlaced) {
                console.warn(`EntityGenerationSystem: Failed to place fountain in room ${roomId} after 50 attempts`);
            }
        }

        if (placedFountains < fountainCount) {
            console.warn(`EntityGenerationSystem: Only placed ${placedFountains} fountains out of ${fountainCount} requested`);
        }

        console.log(`EntityGenerationSystem: generateFountains - Completed for tier ${tier}`);
    }

    generateFountainEntity(entityList, tier, mapComp, x, y, active = true, room = null) {
        const fountainEntity = this.entityManager.createEntity(`fountain_${tier}_fountain_${entityList.fountains.length}`);
        this.entityManager.addComponentToEntity(fountainEntity.id, new PositionComponent(x * this.TILE_SIZE, y * this.TILE_SIZE));
        this.entityManager.addComponentToEntity(fountainEntity.id, new FountainComponent(false, false, active));
        this.entityManager.addComponentToEntity(fountainEntity.id, new VisualsComponent(this.TILE_SIZE, this.TILE_SIZE));
        this.entityManager.addComponentToEntity(fountainEntity.id, new HitboxComponent(this.TILE_SIZE, this.TILE_SIZE, this.TILE_SIZE / 2, this.TILE_SIZE));

        const visuals = fountainEntity.getComponent('Visuals');
        visuals.avatar = 'img/anim/fountain/128x64_fountain_stone_shadow_anim.png';

        entityList.fountains.push(fountainEntity.id);
        mapComp.map[y][x] = '≅';

        // Update room.hasEntities if a room is provided
        if (room) {
            if (!Array.isArray(room.hasEntities)) {
                room.hasEntities = [];
            }
            room.hasEntities.push({ id: fountainEntity.id, type: 'Fountain' });
        }

        let triggerAreaSize = 512; // Default size for trigger area

        if (tier === 2) {
            triggerAreaSize = 128; // Smaller trigger area for tier 2 becasue of close proximity of fountains.
        }
        if (active) {
            this.generateTriggerArea(
                entityList,
                x, y,
                triggerAreaSize, triggerAreaSize,
                'PlayTrackControl',
                { track: 'fountain_loop', play: true, volume: 0.2, fadeIn: 0.75 },
                'PlayTrackControl',
                { track: 'fountain_loop', play: false, fadeOut: 0.75 },
                'Presence'
            );
        }

        console.log(`EntityGenerationSystem: Created fountain at (${x}, ${y}) on tier ${tier}`, fountainEntity);
        return fountainEntity;
    }
  

    generateLootEntities(tier, mapComp, entityList) {
        console.log(`EntityGenerationSystem: generateLootEntities - Starting for tier ${tier}`);
        const lootPerLevel = 5;
        const roomEntityIds = entityList.rooms;
        for (let i = 0; i < lootPerLevel; i++) {
            const roomId = roomEntityIds[Math.floor(Math.random() * roomEntityIds.length)];
            const room = this.entityManager.getEntity(roomId).getComponent('Room');
            let x, y;
            let attempts = 0;

            do {
                x = room.left + 1 + Math.floor(Math.random() * (room.width - 2));
                y = room.top + 1 + Math.floor(Math.random() * (room.height - 2));
                attempts++;
                if (attempts > 50) {
                    console.error(`Failed to place loot entity in room after 50 attempts`);
                    break;
                }
            } while (mapComp.map[y][x] !== ' ');

            if (attempts <= 50) {
                this.generateLootEntity(entityList, tier, mapComp, x, y, roomId);
            }
        }
        console.log(`EntityGenerationSystem: generateLootEntities - Completed for tier ${tier}`);
    }

    generateLootEntity(entityList, tier, mapComp, x, y, roomId, lootData = {}) {
        const room = this.entityManager.getEntity(roomId).getComponent('Room');
        if (!room) {
            console.error(`generateLootEntity: Room with ID ${roomId} not found.`);
            return;
        }

        if (!Array.isArray(room.hasEntities)) {room.hasEntities = [];}

        const pixelX = x * this.TILE_SIZE;
        const pixelY = y * this.TILE_SIZE;

        const uniqueId = this.utilities.generateUniqueId();
        const lootSource = this.entityManager.createEntity(`loot_source_${tier}_${uniqueId}`);

        // Default loot source data
        const defaultLootSourceData = {
            sourceType: "container",
            name: "Treasure Chest",
            tier: tier,
            position: { x: pixelX, y: pixelY },
            sourceDetails: { id: roomId },
            chanceModifiers: {
                torches: 1,
                healPotions: 1,
                gold: 1.5,
                item: 0.25,
                uniqueItem: 0.8
            },
            maxItems: 1,
            items: []
        };

        // Merge default data with lootData (if provided)
        const mergedLootSourceData = {
            ...defaultLootSourceData,
            ...lootData,
            chanceModifiers: {
                ...defaultLootSourceData.chanceModifiers,
                ...(lootData.chanceModifiers || {})
            }
        };

        this.entityManager.addComponentToEntity(lootSource.id, new LootSourceData(mergedLootSourceData));

        // Set up the callback to listen for the DropLoot event
        const collectEntityId = (data) => {
            if (data.tier === tier) {
                entityList.treasures.push(data.entityId);
                room.hasEntities.push({ id: data.entityId, type: 'Treasure' });
                console.log(`LevelSystem: logged entity ID ${data.entityId} for tier ${tier}`);

                // Clean up the event listener after handling
                this.eventBus.off('LootEntityCreated', collectEntityId);
            }
        };
        this.eventBus.on('LootEntityCreated', collectEntityId);

        // Emit the DropLoot event to create the loot object
        this.eventBus.emit('DropLoot', { lootSource });

        console.log(`EntityGenerationSystem: Created loot source at (${x}, ${y}) on tier ${tier}`, lootSource);
        return lootSource;
    }

    generateShopCounter(entityList, tier, mapComp, x, y) {
        const shopCounterEntity = this.entityManager.createEntity(`shopCounter_${tier}_shopCounter_${entityList.shopCounters.length}`);
        this.entityManager.addComponentToEntity(shopCounterEntity.id, new PositionComponent(x * this.TILE_SIZE, y * this.TILE_SIZE));
        this.entityManager.addComponentToEntity(shopCounterEntity.id, new VisualsComponent(58, 112));
        this.entityManager.addComponentToEntity(shopCounterEntity.id, new HitboxComponent(112, 58));
        this.entityManager.addComponentToEntity(shopCounterEntity.id, new ShopCounterComponent(tier, x, y));
        const visuals = shopCounterEntity.getComponent('Visuals');
        visuals.avatar = 'img/avatars/shop-counter.png';
        entityList.shopCounters.push(shopCounterEntity.id);
        mapComp.map[y][x] = '?';
        this.eventBus.emit('shopCounterAdded');

        console.log(`LevelSystem - shopCounter - shopCounter Entity Created on tier: ${tier} at x:${x}, y:${y}`, shopCounterEntity);
        return shopCounterEntity;
    }


    generateTriggerArea(entityList, x, y, width, height, action, data = {}, stopAction = null, stopData = {}, mode) {
        const xOffset = -(width / 2);
        const yOffset = -(height / 2);
        const triggerEntity = this.entityManager.createEntity(`trigger_area_${x}_${y}_${Date.now()}`);
        this.entityManager.addComponentToEntity(triggerEntity.id, new PositionComponent(x * this.TILE_SIZE, y * this.TILE_SIZE));
        this.entityManager.addComponentToEntity(triggerEntity.id, new HitboxComponent(width, height, xOffset, yOffset)) ;
        this.entityManager.addComponentToEntity(triggerEntity.id, new TriggerAreaComponent(action, data, stopAction, stopData, mode));
        // Add to entityList if you want to track them
        if (entityList.triggerAreas) {
            entityList.triggerAreas.push(triggerEntity.id);
        }
        return triggerEntity;
    }

}
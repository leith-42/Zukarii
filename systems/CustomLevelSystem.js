// systems/CustomLevelSystem.js

import { System } from '../core/Systems.js';
import { customLevels } from '../data/cfg/customLevels.js';

import {
    MapComponent,
    EntityListComponent,
    PositionComponent,
    VisualsComponent,
    WallComponent,
    FloorComponent,
    ExplorationComponent,
    SpatialBucketsComponent,
    HitboxComponent,
    RoomComponent
} from '../core/Components.js';

export class CustomLevelSystem extends System {
    constructor(entityManager, eventBus, state, entityGenerationSystem) {
        super(entityManager, eventBus);
        this.state = state;
        this.entityGenerationSystem = entityGenerationSystem;
        this.TILE_SIZE = state.TILE_SIZE || 32;
        this.customLevels = customLevels;
    }

    init() {
        this.eventBus.on('LoadCustomLevel', ({ tier, levelEntity }) => this.loadCustomLevel(tier, levelEntity));
    }

    async loadCustomLevel(tier, levelEntity) {
        console.log(`CustomLevelSystem: Loading custom level for tier ${tier}`);
        // Clean up existing entities for this tier to prevent ID conflicts
        // This should not be neeed as this code should never be executed if the tier exists for the session.
        /*
        const existingEntities = this.entityManager.getEntitiesWith(['Tier']).filter(e => e.getComponent('Tier').value === tier);
        existingEntities.forEach(entity => {
            if (entity.id !== levelEntity.id) {
                this.entityManager.removeEntity(entity.id);
            }
        });
        */
        return new Promise((resolve, reject) => {
            this.eventBus.emit('GetCustomLevelJSON', {
                tier,
                callback: (jsonData) => {
                    if (!jsonData) {
                        console.error(`CustomLevelSystem: No JSON data for tier ${tier}`);
                        reject(new Error(`Failed to load tier_${tier}.json`));
                        return;
                    }
                    try {
                        const levelData = this.parseLevelJSON(jsonData, tier, levelEntity);
                        resolve(levelData);
                    } catch (error) {
                        console.error(`CustomLevelSystem: Error parsing JSON for tier ${tier}:`, error);
                        reject(error);
                    }
                }
            });
        });
    }

    parseLevelJSON(jsonData, tier, levelEntity) {

        const entityList = new EntityListComponent();

        this.entityManager.addComponentToEntity(levelEntity.id, entityList);
        //this.entityManager.addComponentToEntity(levelEntity.id, new ExplorationComponent());
       //this.entityManager.addComponentToEntity(levelEntity.id, new SpatialBucketsComponent());



        console.log(`CustomLevelSystem: Parsing JSON for tier ${tier}`);
        const width = jsonData.width;
        const height = jsonData.height;

        if (width !== this.state.WIDTH || height !== this.state.HEIGHT) {
            throw new Error(`Map dimensions (${width}x${height}) do not match expected (${this.state.WIDTH}x${this.state.HEIGHT})`);
        }

        const map = Array(height).fill().map(() => Array(width).fill('#'));
        const walls = [];
        const floors = [];
        const stairs = [];
        const npcs = [];
        const shopCounters = [];
        const portals = [];
        const fountains = [];
        const treasures = [];
        let stairsUp = null;
        let stairsDown = null;
        const roomEntityIds = [];
 

       // const mapComp = new MapComponent({ map, walls, floors });
       // this.entityManager.addComponentToEntity(levelEntity.id, mapComp);

        // Parse Rooms object layer
        const roomsLayer = jsonData.layers.find(layer => layer.name === 'Rooms' && layer.type === 'objectgroup');
        if (roomsLayer) {
            console.log(`CustomLevelSystem: Found Rooms layer with ${roomsLayer.objects.length} rooms`);
            roomsLayer.objects.forEach((obj, index) => {
                // Convert pixel to tile coordinates
                const x = Math.floor(obj.x / this.TILE_SIZE);
                const y = Math.floor(obj.y / this.TILE_SIZE);
                const w = Math.floor(obj.width / this.TILE_SIZE);
                const h = Math.floor(obj.height / this.TILE_SIZE);

                // Validate room bounds
                if (x < 0 || y < 0 || x + w > width || y + h > height || w <= 0 || h <= 0) {
                    console.warn(`CustomLevelSystem: Invalid room dimensions at (${x}, ${y}): ${w}x${h}, skipping`);
                    return;
                }

                // Determine room type
                let roomType = 'SquareRoom'; // Default
                const properties = obj.properties || [];
                const typeProp = properties.find(p => p.name === 'type');
                if (typeProp && typeProp.value) {
                    roomType = typeProp.value;
                } else {
                    if ( h >  w ) {
                        roomType = 'VerticalRoom';
                    } else if ( w > h ) {
                        roomType = 'HorizontalRoom';
                    }
                }

                // Calculate center
                const centerX = x + Math.floor(w / 2);
                const centerY = y + Math.floor(h / 2);

                // Create room entity
                const roomId = `room_${tier}_${x}_${y}_${index}`;
                if (this.entityManager.getEntity(roomId)) {
                    this.entityManager.removeEntity(roomId);
                }
                const roomEntity = this.entityManager.createEntity(roomId);
                this.entityManager.addComponentToEntity(roomId, new RoomComponent({
                    left: x,
                    top: y,
                    width: w,
                    height: h,
                    type: roomType,
                    centerX: centerX,
                    centerY: centerY,
                    connections: [],
                    hasEntities: []
                }));
                roomEntityIds.push(roomId);
                console.log(`CustomLevelSystem: Created room ${roomId} at (${x}, ${y}) with size ${w}x${h}, type: ${roomType}`);
            });
           
        } else {
            console.error(`CustomLevelSystem: No Rooms layer found in tier ${tier} JSON`);
        }

        

        // Parse Map tile layer (terrain)
        const mapTileLayer = jsonData.layers.find(layer => layer.name === 'Map' && layer.type === 'tilelayer');
        if (!mapTileLayer) {
            throw new Error('No Map tile layer found in JSON');
        }

        const mapData = mapTileLayer.data;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const tileId = mapData[y * width + x];
                const pixelX = x * this.TILE_SIZE;
                const pixelY = y * this.TILE_SIZE;

                const wallId = `wall_${tier}_wall_${y}_${x}`;
                const floorId = `floor_${tier}_floor_${y}_${x}`;
                if (this.entityManager.getEntity(wallId)) {
                    this.entityManager.removeEntity(wallId);
                }
                if (this.entityManager.getEntity(floorId)) {
                    this.entityManager.removeEntity(floorId);
                }

                if (tileId === 1) { // Wall
                    map[y][x] = '#';
                    const wallEntity = this.entityManager.createEntity(wallId);
                    this.entityManager.addComponentToEntity(wallId, new PositionComponent(pixelX, pixelY));
                    this.entityManager.addComponentToEntity(wallId, new WallComponent());
                    this.entityManager.addComponentToEntity(wallId, new VisualsComponent(this.TILE_SIZE, this.TILE_SIZE));
                    this.entityManager.addComponentToEntity(wallId, new HitboxComponent(this.TILE_SIZE, this.TILE_SIZE));
                    const visuals = wallEntity.getComponent('Visuals');
                    visuals.avatar = 'img/map/wall.png';
                   walls.push(wallId);
                } else if (tileId === 2) { // Floor
                    map[y][x] = ' ';
                    const floorEntity = this.entityManager.createEntity(floorId);
                    this.entityManager.addComponentToEntity(floorId, new PositionComponent(pixelX, pixelY));
                    this.entityManager.addComponentToEntity(floorId, new FloorComponent());
                    floors.push(floorId);
                } else { // Empty (tileId === 0), treat as wall
                    map[y][x] = '#';
                    const wallEntity = this.entityManager.createEntity(wallId);
                    this.entityManager.addComponentToEntity(wallId, new PositionComponent(pixelX, pixelY));
                    this.entityManager.addComponentToEntity(wallId, new WallComponent());
                    this.entityManager.addComponentToEntity(wallId, new VisualsComponent(this.TILE_SIZE, this.TILE_SIZE));
                    this.entityManager.addComponentToEntity(wallId, new HitboxComponent(this.TILE_SIZE, this.TILE_SIZE));
                    const visuals = wallEntity.getComponent('Visuals');
                    visuals.avatar = 'img/map/wall.png';
                   walls.push(wallId);
                }
            }
        }
        entityList.walls = walls;
        entityList.floors = floors;

        // Parse StaticEntities tile layer
        const entitiesLayer = jsonData.layers.find(layer => layer.name === 'StaticEntities' && layer.type === 'tilelayer');
        const tileEntityMap = {
            3: { type: 'Stair', direction: 'up' }, // StairsUp
            4: { type: 'Stair', direction: 'down' }, // StairsDown
            5: { type: 'Portal' }, // Portal
            6: { type: 'Fountain' }, // Fountain 
            7: { type: 'TreasureChest' }, // TreasureChest
            8: { type: 'ShopCounter' }, // ShopCounter
            9: { type: 'NPC', id: 'sehnrhyx_syliri' }, // SehnrhyxSyliri
            10: { type: 'NPC', id: 'shop_keeper' }, // ShopKeeper
            11: {type: 'Stash'}
        };

        if (!entitiesLayer) {
            console.error(`CustomLevelSystem: No StaticEntities tile layer found in tier ${tier} JSON`);
        } else {
            const entitiesData = entitiesLayer.data;
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const tileId = entitiesData[y * width + x];
                    if (tileId === 0) continue;

                    const entityInfo = tileEntityMap[tileId];
                    if (!entityInfo) {
                        console.warn(`CustomLevelSystem: Unknown tile ID ${tileId} at (${x}, ${y}) in StaticEntities layer`);
                        continue;
                    }

                    const pixelX = x * this.TILE_SIZE;
                    const pixelY = y * this.TILE_SIZE;
                    console.log(`Processing entity ${entityInfo.type} at tile (${x}, ${y})`);

                    // Find the room containing this entity
                    let room;
                    const containingRoomId = roomEntityIds.find(roomId => {
                        room = this.entityManager.getEntity(roomId).getComponent('Room');
                       
                        return x >= room.left && x < room.left + room.width &&
                            y >= room.top && y < room.top + room.height;
                    }) || roomEntityIds[0];

                    const widthTiles = entityInfo.widthTiles || 1;
                    const heightTiles = entityInfo.heightTiles || 1;
                    const visualWidth = widthTiles * this.TILE_SIZE;
                    const visualHeight = heightTiles * this.TILE_SIZE;

                    switch (entityInfo.type) {
                        case 'Stair':
                            const direction = entityInfo.direction || 'up';
                            const stair = this.entityGenerationSystem.generateStairEntity(
                                { map, walls, floors, stairs, npcs, shopCounters, portals, roomEntityIds },
                                { stairs },
                                tier,
                                containingRoomId,
                                direction,
                                x,
                                y,
                                true
                            );
                            if (direction === 'up') {
                                stairsUp = { x, y };
                            } else if (direction === 'down') {
                                stairsDown = { x, y };
                            }
                            
                            break;
                        case 'Portal':
                            const portalId = this.entityGenerationSystem.generatePortal(
                                { portals },
                                tier,
                                { map },
                                x,
                                y
                            );
                            break;
                        case 'Fountain':
                            const fountainId = this.entityGenerationSystem.generateFountainEntity(
                                entityList, 
                                tier,
                                { map },
                                x,
                                y,
                                true,
                                room
                            );
                            break;
                        case 'TreasureChest':
                            const treasureId = this.entityGenerationSystem.generateLootEntity(
                                entityList,
                                tier,
                                { map },
                                x,
                                y,
                                containingRoomId
                            );
                            break;
                        case 'ShopCounter':
                            const shopCounterId = this.entityGenerationSystem.generateShopCounter(
                                { shopCounters },
                                tier,
                                { map },
                                x,
                                y
                            );
                            shopCounters.push(shopCounterId);
                            break;
                        case 'NPC':
                            const npcId = entityInfo.id;
                            if (npcId) {
                                npcs.push({ id: npcId, x, y });
                            } else {
                                console.warn(`NPC at (${x}, ${y}) missing 'id'`);
                            }
                            break;

                        case 'Stash':
                            const stashId = this.entityGenerationSystem.generateStashChest(
                                tier,
                                x,
                                y
                            );
                            break;
                            
                        default:
                            console.warn(`Unknown entity type '${entityInfo.type}' at (${x}, ${y})`);
                            break;
                    }
                }
            }
        }

        // Create level data
        const levelData = {
            map,
            walls,
            floors,
            stairs,
            npcs,
            shopCounters,
            portals,
            fountains,
            treasures,
            stairsDown,
            stairsUp,
            roomEntityIds,
            isCustomLevel: true
        };

        // Add components to level entity
        const mapComp = new MapComponent(levelData);
        this.entityManager.addComponentToEntity(levelEntity.id, mapComp);

      
        
        entityList.stairs = stairs;
        entityList.portals = portals;
        entityList.npcs = npcs;
        entityList.shopCounters = shopCounters;
        entityList.rooms = roomEntityIds;

        this.entityManager.addComponentToEntity(levelEntity.id, new ExplorationComponent());
        this.entityManager.addComponentToEntity(levelEntity.id, new SpatialBucketsComponent());

        // Spawn NPCs if defined
        if (npcs.length > 0) {
            this.eventBus.emit('SpawnNPCs', { tier, npcs });
        }

        // Trigger monster spawning
        const hasElites = tier > 1;
        this.eventBus.emit('SpawnMonsters', {
            tier,
            rooms: roomEntityIds,
            hasBossRoom: roomEntityIds.some(id => this.entityManager.getEntity(id).getComponent('Room').type === 'BossChamberSpecial'),
            spawnPool: { randomMonsters: true, uniqueMonsters: hasElites }
        });
        console.log(`CustomLevelSystem: Loaded custom level for tier ${tier} with data`, levelData, levelEntity, entityList);
        return levelData;
    }
}


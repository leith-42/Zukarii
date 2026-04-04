import { System } from '../core/Systems.js';
import { PositionComponent, VisualsComponent, HitboxComponent, NPCDataComponent, JourneyDialogueComponent, ShopComponent, ShopDialogueComponent , LightSourceComponent, AnimationComponent, AnimationStateComponent} from '../core/Components.js';

export class NPCSpawnSystem extends System {
    constructor(entityManager, eventBus, dataSystem, utilities) {
        super(entityManager, eventBus);
        this.dataSystem = dataSystem;
        this.utilities = utilities;
        this.TILE_SIZE = 32;
    }

    init() {
        this.eventBus.on('SpawnNPCs', (data) => this.handleSpawnNPCs(data));
        //console.log('NPCSpawnSystem: Initialized');
    }

    update(deltaTime) { /* No per-frame updates needed */ }

    async handleSpawnNPCs({ tier, npcs }) {
        //console.log(`NPCSpawnSystem: Received SpawnNPCs event for tier ${tier}, npcs:`, npcs);
        this.entityManager.setActiveTier(tier);

       
        const fetchData = () => {
            return new Promise((resolve) => {
                this.eventBus.emit('GetNPCs', {
                    callback: (data) => resolve(data)
                });
            });
        };

        try {
            const npcTemplates = await fetchData();
            //console.log('NPCSpawnSystem: NPC templates:', npcTemplates);

            const levelEntity = this.entityManager.getEntity(`level_${tier}`);
            if (!levelEntity) {
                console.error(`NPCSpawnSystem: No level entity for tier ${tier}`);
                return;
            }
            const entityList = levelEntity.getComponent('EntityList');
            if (!entityList.npcs) {
                entityList.npcs = [];
            }

            for (const npcData of npcs) {
                const template = npcTemplates.find(t => t.id === npcData.id);
                if (!template) {
                    console.warn(`NPCSpawnSystem: No template found for NPC ID ${npcData.id}`);
                    continue;
                }
                let hasNpcShop = false;
                const tileX = npcData.x;
                const tileY = npcData.y;
                const pixelX = tileX * this.TILE_SIZE;
                const pixelY = tileY * this.TILE_SIZE;

                const entity = this.entityManager.createEntity(`npc_${tier}_${npcData.id}_${Math.random().toString(36).substring(2, 11)}`);

                if (!this.utilities.isWalkable(entity.id,tileX, tileY)) {
                    console.error(`NPCSpawnSystem: Tile (${tileX}, ${tileY}) is not walkable for NPC ${npcData.id}`);
                    continue;
                }

                
                this.entityManager.addComponentToEntity(entity.id, new PositionComponent(pixelX, pixelY));
                this.entityManager.addComponentToEntity(entity.id, new VisualsComponent(template.width, template.height));
                const visuals = entity.getComponent('Visuals');
                visuals.avatar = template.avatar;
                if (template.faceLeft) {
                    //console.log("NPCSpawnSystem: template.faceLeft = ", template.faceLeft);
                    visuals.faceLeft = template.faceLeft;
                }
                this.entityManager.addComponentToEntity(entity.id, new HitboxComponent(template.hitboxWidth, template.hitboxHeight));
                this.entityManager.addComponentToEntity(entity.id, new NPCDataComponent(template.id, template.name, template.greeting));

                // Add animation components for ZuMaster (Sehnrhyx Syliri)
                if (template.id === 'sehnrhyx_syliri') {
                    this.entityManager.addComponentToEntity(entity.id, new AnimationStateComponent());
                    this.entityManager.addComponentToEntity(entity.id, new AnimationComponent());
                    const animation = entity.getComponent('Animation');

                    animation.spriteSheets = {
                        idle: { src: 'img/anim/ZuMaster/Idle.png' }
                    };

                    animation.animations = {
                        'idle': {
                            frames: [
                                { x: 0 }, { x: 128 }, { x: 256 }, { x: 384 },
                                { x: 512 }, { x: 640 }, { x: 768 }, { x: 896 }
                            ],
                            frameWidth: 128,
                            frameHeight: 128,
                            frameTime: 100 // Matches player idle animation speed
                        }
                    };
                    console.log(`NPCSpawnSystem: Added animation components to ZuMaster NPC ${entity.id}`, {
                        hasAnimation: entity.hasComponent('Animation'),
                        hasAnimState: entity.hasComponent('AnimationState'),
                        currentAnimation: animation.currentAnimation,
                        frameCount: animation.animations.idle.frames.length
                    });
                }

                if (template.hasJourneyPaths) {
                    this.entityManager.addComponentToEntity(entity.id, new JourneyDialogueComponent());
                    //console.log(`NPCSpawnSystem: Added JourneyDialogueComponent to NPC ${entity.id}`);
                }


                if (template.lightSource) {
                   // this.entityManager.addComponentToEntity(entity.id, new LightSourceComponent({ definitionKey: 'magic', entityId: entity.id } ));
                    this.eventBus.emit('LightSourceActivated', ({ type: 'magic', entityId: entity.id }));
                }

                if (template.shopType) {
                    let shopComponent = null;
                    switch (template.shopType) {
                        case 'EquipmentShop':
                            shopComponent = new ShopComponent({
                                dialogueText: 'Browse my wares!',
                                shopType: 'EquipmentShop'
                            });
                            break;
                        default:
                            console.warn(`NPCSpawnSystem: Unknown shopType '${template.shopType}' for NPC ${npcData.id}`);
                            break;
                    }
                    if (shopComponent) {
                        this.entityManager.addComponentToEntity(entity.id, shopComponent);
                        this.entityManager.addComponentToEntity(entity.id, new ShopDialogueComponent());
                        const shopDialogue = entity.getComponent('ShopDialogue');
                        shopDialogue.dialogues.shop = {
                            text: template.greeting || 'Browse my wares!',
                            action: 'openShop',
                            params: { npcId: entity.id }
                        };
                        //console.log(`NPCSpawnSystem: Added ShopComponent and ShopDialogueComponent to NPC ${entity.id}`);
                        hasNpcShop = true;
                    }
                }

                entityList.npcs.push(entity.id);
                if (hasNpcShop) {
                    this.eventBus.emit('GenerateShopInventories', { tier });
                }
                //console.log(`NPCSpawnSystem: Spawned NPC ${entity.id} (${template.name}) at pixel (${pixelX}, ${pixelY}) for tile (${tileX}, ${tileY}) on tier ${tier}`);
            }
            //console.log(`NPCSpawnSystem: EntityListComponent.npcs after spawning:`, entityList.npcs);

        } catch (err) {
            console.error('NPCSpawnSystem: Failed to fetch NPC data:', err);
        }
    }

    /* // USING: this.utilities.isWalkable(entity.id, tileX, tileY) in NPCControllerSystem.js
    isWalkable(tileX, tileY) {
        const pixelX = tileX * this.TILE_SIZE;
        const pixelY = tileY * this.TILE_SIZE;
        const entitiesAtTarget = this.entityManager.getEntitiesWith(['Position']).filter(e => {
            const ePos = e.getComponent('Position');
            return ePos.x === pixelX && ePos.y === pixelY;
        });
        const isBlocked = entitiesAtTarget.some(e =>
            e.hasComponent('Wall') ||
            e.hasComponent('Stair') ||
            e.hasComponent('Portal') ||
            e.hasComponent('Fountain') ||
            e.hasComponent('NPCData')
        );
        const hasFloor = entitiesAtTarget.some(e => e.hasComponent('Floor'));
        //console.log(`NPCSpawnSystem: Tile (${tileX}, ${tileY}) walkable check: isBlocked=${isBlocked}, hasFloor=${hasFloor}`);
        return !isBlocked && hasFloor;
    }
    */
}
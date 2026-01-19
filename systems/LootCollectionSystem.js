// systems/LootCollectionSystem.js
import { System } from '../core/Systems.js';

export class LootCollectionSystem extends System {
    constructor(entityManager, eventBus, utilities) {
        super(entityManager, eventBus);
        this.requiredComponents = ['Position', 'TreasureData'];
        this.utilities = utilities;
    }

    init() {
        this.eventBus.on('PickupTreasure', (data) => this.collectLoot(data));
        this.sfxQueue = this.entityManager.getEntity('gameState').getComponent('AudioQueue').SFX || []
    }

    // systems/LootCollectionSystem.js - Updated collectLoot method
    collectLoot({ x, y }) {
        const player = this.entityManager.getEntity('player');
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        const levelEntity = this.entityManager.getEntitiesWith(['Map', 'Tier']).find(e => e.getComponent('Tier').value === gameState.tier);
        if (!player || !levelEntity) {
            console.error('LootCollectionSystem: Player or levelEntity is null');
            return;
        }

        const entityList = levelEntity.getComponent('EntityList');
        console.log('LootCollectionSystem: Checking treasures at (x, y):', x, y, 'with entityList.treasures:', entityList.treasures);
        const lootIndex = entityList.treasures.findIndex(tId => {
            const t = this.entityManager.getEntity(tId);
            if (!t) {
                console.error('LootCollectionSystem: Entity not found for ID:', tId);
                return false;
            }
            const pos = t.getComponent('Position');
            if (!pos) {
                console.error('LootCollectionSystem: Position component not found for entity ID:', tId);
                return false;
            }
            console.log('LootCollectionSystem: Checking entity ID:', tId, 'at position:', pos.x, pos.y);
            return pos.x === x && pos.y === y;
        });

        if (lootIndex === -1) {
            console.log('LootCollectionSystem: No loot found at (', x, ',', y, ')');
            return;
        }

        const lootEntity = this.entityManager.getEntity(entityList.treasures[lootIndex]);
        if (!lootEntity) {
            console.error('LootCollectionSystem: Failed to retrieve loot entity at index:', lootIndex);
            return;
        }
        const lootData = lootEntity.getComponent('LootData');
        const playerInventory = player.getComponent('Inventory');
        const playerResource = player.getComponent('Resource');

        let pickupMessage = [];
        if (lootData.gold) {
            playerResource.gold += lootData.gold;
            pickupMessage.push(`${lootData.gold} gold`);
        }
        if (lootData.torches) {
            playerResource.torches += lootData.torches;
            pickupMessage.push(`${lootData.torches} torch${lootData.torches > 1 ? 'es' : ''}`);
        }
        if (lootData.healPotions) {
            playerResource.healPotions += lootData.healPotions;
            pickupMessage.push(`${lootData.healPotions} heal potion${lootData.healPotions > 1 ? 's' : ''}`);
        }
        console.log("Ashen: LootData", lootData);
        if (lootData.stones) {
            console.log("Ashen: LootCollectionSystem: Stones", lootData.stones);
            if (lootData.stones.count > 0) {
                const stoneType = lootData.stones.type;
                // Initialize craftResources[stoneType] if undefined
                if (!(stoneType in playerResource.craftResources)) {
                    console.warn(`LootCollectionSystem: craftResources.${stoneType} not initialized, setting to 0`);
                    playerResource.craftResources[stoneType] = 0;
                }
                // Ensure the value is a number
                if (typeof playerResource.craftResources[stoneType] !== 'number' || isNaN(playerResource.craftResources[stoneType])) {
                    console.warn(`LootCollectionSystem: craftResources.${stoneType} is invalid (${playerResource.craftResources[stoneType]}), resetting to 0`);
                    playerResource.craftResources[stoneType] = 0;
                }
                console.log(`LootCollectionSystem: Before increment - craftResources.${stoneType}:`, playerResource.craftResources[stoneType]);
                playerResource.craftResources[stoneType] += lootData.stones.count;
                console.log(`LootCollectionSystem: After increment - craftResources.${stoneType}:`, playerResource.craftResources[stoneType]);
                pickupMessage.push(`${lootData.stones.count} ${lootData.stones.text}${lootData.stones.count > 1 ? 's' : ''}`);
                console.log("Ashen: PlayerResource", playerResource);
            }
        } else {
            console.log("Ashen: LootCollectionSystem: No Stones object in loot Data");
        }

        if (lootData.items && lootData.items.length) {
            lootData.items.forEach(item => {
                if (item.collectItem) {
                    const uniqueItemsCollected = player.getComponent('PlayerAchievements').stats.uniqueItemDrops;
                    let found = false;
                    for (const obj of uniqueItemsCollected) {
                        if (obj.journeyItemId === item.journeyItemId) {
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
                        uniqueItemsCollected.push({ journeyItemId: item.journeyItemId, name: item.name });
                    } else {
                        console.warn(`LootCollectionSystem: Item ${item.name} already collected, skipping.`);
                        return;
                    }
                }

                this.utilities.pushPlayerActions(item.collectItem ? 'collectItem' : 'findItem', {
                    journeyItemId: item.journeyItemId,
                    itemId: item.id
                });
                console.log(`LootCollectionSystem: Pushed ${item.collectItem ? 'collectItem' : 'findItem'} to PlayerActionQueue`, {
                    journeyItemId: item.journeyItemId,
                    itemId: item.id
                });
                
                playerInventory.items.push(item);
                pickupMessage.push(item.name);
            });
        }

        if (pickupMessage.length) {
            //this.eventBus.emit('LogMessage', { message: `Found ${pickupMessage.join(', ')} from ${lootData.name}!` });
            this.utilities.logMessage({
                channel: 'loot',
                message: `Found ${pickupMessage.join(', ')} from the ${lootData.name}!`
            });
        }

        entityList.treasures.splice(lootIndex, 1);
        this.entityManager.removeEntity(lootEntity.id);
        gameState.needsRender = true;
        this.eventBus.emit('StatsUpdated', { entityId: 'player' });
        this.eventBus.emit('PlayerStateUpdated', { entityId: 'player' });

        this.sfxQueue.push({ sfx: 'loot0', volume: .7 });

        if (lootData.stones && lootData.stones.count > 0) {
            this.utilities.pushPlayerActions('collectResource', {
                resourceType: lootData.stones.type,
                quantity: lootData.stones.count
            });
            console.log(`LootCollectionSystem: Pushed collectResource to PlayerActionQueue`, {
                resourceType: lootData.stones.type,
                quantity: lootData.stones.count
            });
        }
        
        if (playerResource.gold >= 1e12) {
            gameState.isVictory = true;
            this.eventBus.emit('GameOver', { message: "You amassed a trillion gold! Victory!" });
        }
    }

}
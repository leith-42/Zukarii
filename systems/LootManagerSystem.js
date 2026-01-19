// systems/LootManagerSystem.js
import { System } from '../core/Systems.js';
import { PositionComponent, LootData } from '../core/Components.js';

export class LootManagerSystem extends System {
    constructor(entityManager, eventBus, utilities) {
        super(entityManager, eventBus, utilities);
        this.tierTables = [
            (roll) => { // Tier 0: Levels 1-4
                if (roll < 0.60) return 0;  // junk: 60%
                if (roll < 0.995) return 1; // common: 39.5% 
                if (roll >= 0.995) return 2; // rare: 0.5%
                return 0;                   // junk (fallback)
            },
            (roll) => { // Tier 1: Levels 5-9
                if (roll < 0.30) return 0;  // junk: 30%
                if (roll < 0.95) return 1; // common: 65%
                if (roll >= 0.95) return 2; // rare: 5%
                return 0;                   // junk (fallback)
            },
            (roll) => { // Tier 2: Levels 10-14
                if (roll < 0.10) return 0;  // junk: 10%
                if (roll < 0.85) return 1; // common: 75%
                if (roll >= 0.85) return 2; // rare: 15%
                return 0;                   // junk (fallback)
            },
            (roll) => { // Tier 3: Levels 15-19
                if (roll < 0.05) return 0;  // junk: 5%
                if (roll < 0.75) return 1;  // common: 70%
                if (roll < 0.99) return 2; // rare: 24.%
                if (roll >= 0.99) return 3; // magic: 1%
                return 0;                   // junk (fallback)
            },
            (roll) => { // Tier 4: Levels 20-24
                if (roll < 0.01) return 0;  // junk: 1%
                if (roll < 0.61) return 1;  // common: 60%
                if (roll < 0.95) return 2; // rare: 34%
                if (roll >= 0.95) return 3; // magic: 5%
                return 0;                   // junk (fallback)
            },
            (roll) => { // Tier 5: Levels 25-29
                if (roll < 0.50) return 1;  // common: 50%
                if (roll < 0.89) return 2;  // rare: 39%
                if (roll < 0.99) return 3; // magic: 10%
                if (roll >= 0.99) return 4; // mastercraft: 1%
                return 1;                   // common (fallback)
            },
            (roll) => { // Tier 6: Levels 30-34
                if (roll < 0.30) return 1;  // common: 30%
                if (roll < 0.75) return 2;  // rare: 45%
                if (roll < 0.95) return 3; // magic: 20%
                if (roll >= 0.95) return 4; // mastercraft: 5%
                return 1;                   // common (fallback)
            },
            (roll) => { // Tier 7: Levels 35-39
                if (roll < 0.20) return 1;  // common: 20%
                if (roll < 0.70) return 2;  // rare: 50%
                if (roll < 0.89) return 3;  // magic: 24.%
                if (roll < 0.99) return 4; // mastercraft: 9%
                if (roll >= 0.99) return 5; // legendary: 1%
                return 1;                   // common (fallback)
            },
            (roll) => { // Tier 8: Levels 40-44
                if (roll < 0.05) return 1;  // common: 5%
                if (roll < 0.40) return 2;  // rare: 35%
                if (roll < 0.90) return 3; // magic: 45%
                if (roll < 0.99) return 4; // mastercraft:13%
                if (roll >= 0.99) return 5; // legendary: 2%
                return 1;                   // common (fallback)
            },
            (roll) => { // Tier 9: Levels 45-49
                if (roll < 0.35) return 2;  // rare: 35%
                if (roll < 0.80) return 3;  // magic: 45%
                if (roll < 0.95) return 4; // mastercraft: 15%
                if (roll < 0.995) return 5; // legendary: 4.5%
                if (roll >= 0.995) return 6; // relic: 0.5%
                return 2;                   // rare (fallback)
            },
            (roll) => { // Tier 10: Levels 50+
                if (roll < 0.05) return 3;   // magic: 5%
                if (roll < 0.70) return 4;   // mastercraft: 65%
                if (roll < 0.97) return 5;   // legendary: 27%
                if (roll < 0.995) return 6;  // relic: 2.5%
                if (roll >= 0.995) return 7; // artifact: 0.5%
                return 3;                    // junk (fallback)
            },
            (roll) => { // Tier 11: Levels 50+ with lucky tier roll (unchanged)
                if (roll < 0.60) return 4;  // mastercraft: 60%
                if (roll < 0.85) return 5;  // legendary: 25%
                if (roll < 0.99) return 6;  // relic: 14%
                if (roll >= 0.99) return 7; // artifact: 1%
                return 4;                    // common (fallback)
            }
        ];
         
        this.itemTiers = ['junk', 'common', 'rare', 'magic', 'mastercraft', 'legendary', 'relic', 'artifact'];

        // Fetch unique items from DataSystem
        this.uniqueItemsPromise = null;

        // Constants
        this.BASE_DROP_CHANCE = 1;

        //GOLD
        this.BASE_GOLD_CHANCE = 0.95;
        this.BASE_GOLD_MIN = 10;
        this.BASE_GOLD_MAX = 50;

        //ITEMS
        this.BASE_ITEM_CHANCE = .45;
        this.BASE_UNIQUE_CHANCE = 0.02;

        //POTIONS
        this.BASE_POTION_CHANCE = 0.02;
        this.POTION_CHANCE_NO_POTIONS = 0.5;
        this.POTION_CHANCE_FEW_POTIONS = 0.30;
        this.POTION_CHANCE_SOME_POTIONS = 0.125;
        this.POTION_THRESHOLD_NO_POTIONS = 0;
        this.POTION_THRESHOLD_FEW_POTIONS = 3;
        this.POTION_THRESHOLD_SOME_POTIONS = 5;
        this.HEALTH_TRESHOLD_INJURED = 0.5;
        this.HEALTH_THRESHOLD_CRITICAL = 0.25;
        this.HEALTH_THRESHOLD_IMMINENT_DEATH = 0.1;
        this.HEALTH_THRESHOLD_INCREMENT = 0.1;

        //TORCHES
        this.BASE_TORCH_CHANCE = 0.025;
        this.TORCH_CHANCE_LOW_TORCHES = 0.125 ;
        this.TORCH_CHANCE_MEDIUM_TORCHES = 0.075;
        this.TORCH_DESPERATION_CHANCE = 0.20;
        this.TORCH_DROP_FAIL_THRESHOLD = 3; 

        //CRAFTING  
        this.BASE_STONE_CHANCE = .3;
    }

    init() {
        this.eventBus.on('DropLoot', (data) => this.handleLootDrop(data));
        this.eventBus.emit('GetUniqueItems', {
            callback: (uniqueItems) => {
                //console.log('LootManagerSystem: Received unique items from DataSystem:', uniqueItems);
                this.uniqueItems = uniqueItems;
            }
        });

        // Fetch journey items
        this.eventBus.emit('GetJourneyItems', {
            callback: (journeyItems) => {
                //console.log('LootManagerSystem: Received journey items from DataSystem:', journeyItems);
                this.journeyItems = journeyItems;
            }
        });
    }

    async handleLootDrop({ lootSource }) {
        const sourceData = lootSource.getComponent('LootSourceData');
        if (!sourceData) {
            console.error(`LootManagerSystem: No LootSourceData found on lootSource entity with ID: ${lootSource.id}`);
            return;
        }
        //console.log(`LootManagerSystem: handleLootDrop() called with lootSource:`, sourceData);
        //console.log(`LootManagerSystem: Handling loot drop for ${sourceData.name}, items:`, sourceData.items);

        if (Math.random() >= this.BASE_DROP_CHANCE) {
           // this.eventBus.emit('LogMessage', { message: `The ${sourceData.name} dropped nothing.` });
            this.utilities.logMessage({
                channel: 'system',
                message: `The ${sourceData.name} dropped nothing.`
            });
            const sourceEntityId = sourceData.sourceDetails?.id;
            if (sourceEntityId) {
                this.processDeadLootSource(sourceEntityId)
            } else {
                console.warn(`LootManagerSystem: No sourceDetails.id found in lootSource for ${sourceData.name}`);
            }
            return;
        }

        const player = this.entityManager.getEntity('player');
        const playerResource = player ? player.getComponent('Resource') : { torches: 0, healPotions: 0 };
        const lightingState = this.entityManager.getEntity('lightingState')?.getComponent('LightingState') || { isLit: false };
        const playerHealth = player ? player.getComponent('Health') : { hp: 0, maxHp: 1 };

        const modifiers = sourceData.chanceModifiers || {};
        const gold = this.calculateGoldGain(modifiers.gold || 1);
        const torches = this.calculateTorchDrop(playerResource, lightingState, modifiers.torches || 1);
        const healPotions = this.calculatePotionDrop(playerResource, playerHealth, modifiers.healPotions || 1);
        const stones = this.calculateStoneDrop(sourceData, modifiers.stones || 1);
        //console.log("Ashen: Stones", stones);

        const items = await this.buildItemsDropped(sourceData, player, modifiers);
        //console.log(`LootManagerSystem: handleLootDrop() generated items:`, items);

        const uniqueId = this.utilities.generateUniqueId();
        const lootEntity = this.entityManager.createEntity(`loot_${sourceData.tier}_${uniqueId}`);
        const position = new PositionComponent(sourceData.position.x, sourceData.position.y);
        const lootData = new LootData({
            name: `${sourceData.name} Loot`,
            gold,
            torches,
            healPotions,
            items,
            stones,
        });
        //console.log("Ashen: LootData Created", lootData);
        this.entityManager.addComponentToEntity(lootEntity.id, position);
        this.entityManager.addComponentToEntity(lootEntity.id, lootData);

        const dropMessage = [
            gold ? `${gold} gold` : '',
            torches ? `${torches} torch${torches > 1 ? 'es' : ''}` : '',
            healPotions ? `${healPotions} heal potion${healPotions > 1 ? 's' : ''}` : '',
            stones.count ? `${stones.count} ${stones.text}${stones.count > 1 ? 's' : ''}` : '',
            items.length ? items.map(i => i.name).join(', ') : ''
        ].filter(Boolean).join(', ');
        if (sourceData.name === 'Treasure Chest') {
            //this.eventBus.emit('LogMessage', { message: `The ${sourceData.name} contained ${dropMessage}!` });
        } else {
            //this.eventBus.emit('LogMessage', { message: `The ${sourceData.name} dropped ${dropMessage}!` });
            this.utilities.logMessage({
                channel: 'system',
                message: `The ${sourceData.name} dropped ${dropMessage}!`
            });
        }

        const sourceEntityId = sourceData.sourceDetails?.id;
        if (sourceEntityId) {
            this.processDeadLootSource(sourceEntityId)
        } else {
            console.warn(`LootManagerSystem: No sourceDetails.id found in lootSource for ${sourceData.name}`);
        }

        this.eventBus.emit('SpawnLoot', {
            treasure: lootEntity,
            tier: sourceData.tier
        });
    }

    processDeadLootSource(sourceEntityId) {
       

            const sourceEntity = this.entityManager.getEntity(sourceEntityId);

            if (sourceEntity && sourceEntity.hasComponent('MonsterData')) {
                const dead = sourceEntity.getComponent('Dead');
                if (dead && dead.state === 'handling') {
                    dead.state = 'processed';
                } else if (!dead) {
                    console.warn(`LootManagerSystem: No DeadComponent found on source entity ${sourceEntityId}`);
                }
            } else if (sourceEntity && sourceEntity.hasComponent('Room')) {
                //console.log(`LootManagerSystem: Source entity ${sourceEntityId} is a Room.`);
            } else {
                console.warn(`LootManagerSystem: Source entity ${sourceEntityId} not found for processed flag`);
            }

    }

  async buildItemsDropped(sourceData, player, modifiers) {
        let items = []; 
        // Process specified items in sourceData.items
        if (sourceData.items && sourceData.items.length > 0) {
            for (const stub of sourceData.items) {

                const itemDropChance = stub.dropChance || 1;
                const itemTierIndexBonus = stub.itemTierIndexBonus || 0;

                if (Math.random() < itemDropChance) {
                    if (stub.type === "rog") {
                        // Partial ROG item
                        const tierIndex = Math.min(
                            (stub.data.tierIndex !== undefined && stub.data.tierIndex > sourceData.tier / 5) ? stub.data.tierIndex : this.getItemTier(sourceData.tier, player)
                                + itemTierIndexBonus,
                            this.itemTiers.length - 1);

                        this.eventBus.emit('GenerateROGItem', {
                            partialItem: { tierIndex, ...stub.data },
                            dungeonTier: sourceData.tier,
                            callback: (item) => { if (item) items.push(item);}
                        });
                    } else if (stub.type === "randomUnique") {
                        //console.log("LootManagerSystem: buildItemsDropped(sourceData, player, modifiers) randomUnique stub.data: ", stub.data);
                        const uniqueItem = await this.getUniqueItem({ type: "randomUnique", data: stub.data });
                        //console.log("LootManagerSystem: buildItemsDropped(sourceData, player, modifiers) randomUnique uniqueItem: ", uniqueItem);
                        if (uniqueItem) items.push(uniqueItem);
                    } else if (stub.type === "customUnique") {
                        //console.log("LootManagerSystem: buildItemsDropped(sourceData, player, modifiers) customUnique stub.data: ", stub.data);
                        // Specific unique item
                        const uniqueItem = await this.getUniqueItem({ type: "customUnique", data: stub.data });
                        //console.log("LootManagerSystem: buildItemsDropped(sourceData, player, modifiers) customUnique uniqueItem: ", uniqueItem);
                        if (uniqueItem) items.push(uniqueItem);
                    }
                }
            }
        }

        // Process random generation for remaining slots
        const remainingSlots = Math.max(0, sourceData.maxItems - (sourceData.items ? sourceData.items.length : 0));
        if (remainingSlots > 0 && Math.random() < this.calculateItemChance(modifiers.item || 1)) {
            for (let i = 0; i < remainingSlots; i++) {
                const tierIndex = this.getItemTier(sourceData.tier, player);
                if (tierIndex >= 0) {
                    if (tierIndex <= 5) {
                        this.eventBus.emit('GenerateROGItem', {
                            partialItem: { tierIndex },
                            dungeonTier: sourceData.tier,
                            callback: (item) => {
                                if (item) items.push(item);
                            }
                        });
                    } else if (Math.random() < this.calculateUniqueItemChance(modifiers.uniqueItem || 1)) {
                        const uniqueItem = await this.getUniqueItem({ data: { tierIndex } });
                        if (uniqueItem) items.push(uniqueItem);
                    }
                }
            }
      }
      ////console.log("LootManagerSystem: buildItemsDropped(sourceData, player, modifiers) returning Item Array: ", sourceData, player, modifiers, items);
      return items;
    }

    calculateTorchDrop(resource, lightingState, multiplier) {
        let torchChance = this.BASE_TORCH_CHANCE;
        if (resource.torches === 0 && !lightingState.isLit) {
            torchChance = this.TORCH_DESPERATION_CHANCE;
            resource.torchDropFail = (resource.torchDropFail || 0) + 1;
            if (resource.torchDropFail >= this.TORCH_DROP_FAIL_THRESHOLD) {
                resource.torches = 1;
                resource.torchDropFail = 0;
                //this.eventBus.emit('LogMessage', { message: 'You found a discarded torch lying on the ground!' });
                this.utilities.logMessage({
                    channel: 'system',
                    message: 'You found a discarded torch lying on the ground!'
                });
                return 1; // Mercy torch - if no active torch and no torches in inventory, give 1 torch after 3 failed drops
            }
        } else if (resource.torches < 2) {
            torchChance = this.TORCH_CHANCE_LOW_TORCHES;
        } else if (resource.torches <= 5) {
            torchChance = this.TORCH_CHANCE_MEDIUM_TORCHES;
        }

        return Math.random() < (torchChance * multiplier) ? 1 : 0;
    }

    calculateStoneDrop(sourceData, multiplier) {
        const tier = sourceData.tier
        if (tier < 7) return { count: 0, stoneType: '', stoneText: '' };
        const stones = {};
        let stoneChance = this.BASE_STONE_CHANCE;
        stones.count = Math.random() > (stoneChance * multiplier) ? 1 : 0;
        let stoneType = 'ashenShard';
        if (tier > 20) stoneType = 'ashenCrystal';
        if (tier > 40) stoneType = 'ashenGem';
        stones.type = stoneType;
        const stoneText = this.utilities.camelToTitleCase(stoneType);
        stones.text = stoneText;
        //console.log("Ashen: Calculated Stones", stones);
        return stones;
        
        //EXAMPLE stones = {count:1, type:'ashenShard', text:"Ashen Shard"}
    }

    calculatePotionDrop(resource, health, multiplier) {

        let chance = this.BASE_POTION_CHANCE;

        switch (true) {
            case resource.healPotions === this.POTION_THRESHOLD_NO_POTIONS: chance = this.POTION_CHANCE_NO_POTIONS; break;
            case resource.healPotions < this.POTION_THRESHOLD_FEW_POTIONS: chance = this.POTION_CHANCE_FEW_POTIONS; break;
            case resource.healPotions < this.POTION_CHANCE_SOME_POTIONS: chance = this.POTION_CHANCE_SOME_POTIONS; break;
            default: chance = this.BASE_POTION_CHANCE;
        }
        if (resource.healPotions < 3) { 
            switch (true) { // add 10% chance for each health threshold DO NOT ADD BREAKS HERE IT WILL BREAK THE CODE
                case health.hp / health.maxHp < this.HEALTH_TRESHOLD_INJURED: chance += this.HEALTH_THRESHOLD_INCREMENT;
                case health.hp / health.maxHp < this.HEALTH_THRESHOLD_CRITICAL: chance += this.HEALTH_THRESHOLD_INCREMENT;
                case health.hp / health.maxHp < this.HEALTH_THRESHOLD_IMMINENT_DEATH: chance += this.HEALTH_THRESHOLD_INCREMENT;
            }
        }
        return Math.random() < (chance * multiplier) ? 1 : 0;
    }

    calculateGoldGain(multiplier) {
        return Math.random() < this.BASE_GOLD_CHANCE * multiplier ? this.BASE_GOLD_MIN + Math.floor(Math.random() * (this.BASE_GOLD_MAX - this.BASE_GOLD_MIN + 1)) + this.entityManager.getEntity('gameState').getComponent('GameState').tier * 10 : 0;
    }

    calculateItemChance(multiplier) {
        return this.BASE_ITEM_CHANCE;
    }

    calculateUniqueItemChance(multiplier) {
        return this.BASE_UNIQUE_CHANCE;
    }

    getItemTier(dungeonTier, player) {
        //console.log("getItemTier() called");
        let tableIndex = 0;
        switch (true) {
            case dungeonTier < 5:
                tableIndex = 0;
                break;
            case dungeonTier <= 50:
                tableIndex = Math.floor(dungeonTier / 5);
                break;
            case dungeonTier > 50:
                tableIndex = 10;
                break;
            default:
                tableIndex = 0;
        }

        tableIndex += this.getLuckyTier(player);
        tableIndex = Math.min(Math.max(tableIndex, 0), this.tierTables.length - 1);

        const roll = Math.random();
        //console.log(`LootManagerSystem: tableIndex=${tableIndex}, dungeonTier=${dungeonTier}, luckAdjustment=${this.getLuckyTier(player)}, roll=${roll}`);
        return this.tierTables[tableIndex](roll);
    }

    getLuckyTier(player) {
        if (!player) return 0;
        const stats = player.getComponent('Stats');
        const luck = stats.luck * 0.1;
        return Math.floor(this.utilities.dRoll(100, 1, luck) / 100);
    }

    async getUniqueItem({ type = "randomUnique", data = {} }) {
        //console.log(`LootManagerSystem: getUniqueItem() called with type: ${type}, data:`, data);
        let uniqueItems = await this.uniqueItemsPromise;

        if (!uniqueItems) {
            console.warn('LootManagerSystem: uniqueItemsPromise resolved to null, fetching synchronously...');
            uniqueItems = await new Promise(resolve => {
                this.eventBus.emit('GetUniqueItems', {
                    callback: (items) => {
                        //console.log('LootManagerSystem: Fetched unique items synchronously:', items);
                        resolve(items);
                    }
                });
            });
        } 
        let journeyItems = this.journeyItems;
        if (!journeyItems) {
            journeyItems = await new Promise(resolve => {
                this.eventBus.emit('GetJourneyItems', {
                    callback: (items) => resolve(items)
                });
            });
        }

        if (!uniqueItems || uniqueItems.length === 0) {
            console.error('LootManagerSystem: No unique items available after fetch');
            return null;
        }
        if (!journeyItems || journeyItems.length === 0) {
            console.warn('LootManagerSystem: No journey items available');
        }

        //console.log('LootManagerSystem: Available unique items:', uniqueItems);
        let uniqueItem;
        if (type === "customUnique") {
            // Check journey items first // Move this to seperate block later... no need to check journey items if type is randomUnique or even customUnique
            uniqueItem = journeyItems.find(i => i.journeyItemId === data.journeyItemId && (!data.type || i.type === data.type));
            if (uniqueItem) {
                //console.log(`LootManagerSystem: Fetched journey item '${data.journeyItemId}':`, uniqueItem);
                return { ...uniqueItem, uniqueId: this.utilities.generateUniqueId() };
            }
            // Fallback to unique items
            // Fetch specific unique by name
            uniqueItem = uniqueItems.find(i => i.name === data.name);
            if (!uniqueItem) {
                console.warn(`LootManagerSystem: Unique item '${data.name}' not found in uniqueItems`);
                return null;
            }
            //console.log(`LootManagerSystem: Fetched custom unique item '${data.name}':`, uniqueItem);
        } else {
            // Random unique (from items[] or random generation loop)
            let tierIndex = data.tierIndex; // Extract tierIndex from data
            if (!tierIndex || tierIndex < 5) tierIndex = 6; // Hardcoded to relic tier until more unique items are added
            const tier = this.itemTiers[tierIndex];
            uniqueItem = uniqueItems.find(i => i.itemTier === tier);
            if (!uniqueItem) {
                console.warn(`LootManagerSystem: No unique item found for tier '${tier}'`);
                return null;
            }
            //console.log(`LootManagerSystem: Selected random unique item for tier '${tier}':`, uniqueItem);
        }
        return { ...uniqueItem, uniqueId: this.utilities.generateUniqueId() };
    }
}

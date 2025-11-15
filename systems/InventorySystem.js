import { System } from '../core/Systems.js';
import { PositionComponent, LootData } from '../core/Components.js';

export class InventorySystem extends System {
    constructor(entityManager, eventBus, utilities) {
        super(entityManager, eventBus, utilities);
        this.requiredComponents = ['Inventory'];
    }


    init() {
        this.eventBus.on('AddItem', (data) => {
            this.addItem(data);
        });
        this.eventBus.on('EquipItem', (data) => {
            this.equipItem(data);
        });
        this.eventBus.on('UnequipItem', (data) => {
            this.unequipItem(data);
        });
        this.eventBus.on('DropItem', (data) => {
            this.discardItem(data);
        });
        this.eventBus.on('SellItem', (data) => {
            this.sellItem(data);
        });
        this.eventBus.on('BuyItem', (data) => {
            this.buyItem(data);
        });
        this.eventBus.on('RemoveItem', (data) => {
            this.removeItem(data);
        });
        this.eventBus.on('UseItem', ({ entityId, uniqueId }) => this.useItem({ entityId, uniqueId }));
        this.sfxQueue = this.entityManager.getEntity('gameState').getComponent('AudioQueue').SFX || []
        
    }

    addItem({ entityId, item }) {
        const entity = this.entityManager.getEntity(entityId);
        if (!entity) {
            return;
        }

        const inventory = entity.getComponent('Inventory');
        if (!inventory) {
            return;
        }

        item.uniqueId = item.uniqueId || this.utilities.generateUniqueId();
        if (!inventory.items.some(i => i.uniqueId === item.uniqueId)) {
            inventory.items.push({ ...item });
            this.utilities.logMessage({ channel: "system", message: `Added ${item.name} to inventory` });
        }

        if (item.journeyItemId) {
            // Use collectItem if the item is marked as such, otherwise findItem
            this.utilities.pushPlayerActions(item.collectItem ? 'collectItem' : 'findItem', {
                journeyItemId: item.journeyItemId,
                itemId: item.id || item.uniqueId
            });
        }

    }

    equipItem({ entityId, item, slot }) {
        const entity = this.entityManager.getEntity(entityId);
        if (!entity) {
            return;
        }

        const inventory = entity.getComponent('Inventory');
        if (!inventory) {
            return;
        }

        if (item.levelRequirement && entity.getComponent('PlayerState')?.level < item.levelRequirement) {
            this.utilities.logMessage({ channel: "system", message: `You need to be level ${item.levelRequirement} to equip ${item.name}!` });
            return;
        }

        const index = inventory.items.findIndex(i => i.uniqueId === item.uniqueId);
        if (index === -1) {
            this.utilities.logMessage({ channel: "system", message: `Error: ${item.name} not in inventory` });
            return;
        }

        if (!this.isSlotCompatible(item, slot)) {
            this.utilities.logMessage({ channel: "system", message: `Cannot equip ${item.name} to ${slot}!` });
            return;
        }

        const currentItem = inventory.equipped[slot];
        if (currentItem) {
            this.unequipItem({ entityId, slot, toInventory: true, silent: true });
        }

        inventory.items.splice(index, 1);
        inventory.equipped[slot] = { ...item, equippedSlot: slot };
        this.utilities.logMessage({ channel: "system", message: `Equipped ${item.name} to ${slot}` });

        if (item.stats?.movementSpeed) {
            this.utilities.logMessage({ channel: "system", message: `${item.name} grants +${item.stats.movementSpeed} movement speed!` });
        }

        if (item.affixes && Array.isArray(item.affixes)) {
            const affixComponent = entity.getComponent('Affix') || new AffixComponent([]);
            item.affixes.forEach(affix => {
                const affixData = {
                    name: affix.name,
                    type: affix.type,
                    trigger: affix.trigger,
                    effect: affix.effect,
                    params: affix.params,
                    sourceId: item.uniqueId
                };
                affixComponent.affixes.push(affixData);
            });
            this.entityManager.addComponentToEntity(entityId, affixComponent);
            //console.log(`InventorySystem: Applied affixes from ${item.name} to ${entityId}:`, affixComponent.affixes);
        }

        this.eventBus.emit('GearChanged', { entityId, action: 'equip', item, slot });
    }

    unequipItem({ entityId, slot, toInventory = true, silent = false }) {
        const entity = this.entityManager.getEntity(entityId);
        if (!entity) {
            return;
        }

        const inventory = entity.getComponent('Inventory');
        if (!inventory) {
            return;
        }

        const item = inventory.equipped[slot];
        if (!item) return;

        inventory.equipped[slot] = null;

        const affixComponent = entity.getComponent('Affix');
        if (affixComponent && item.affixes) {
            affixComponent.affixes = affixComponent.affixes.filter(affix => affix.sourceId !== item.uniqueId);
            this.entityManager.addComponentToEntity(entityId, affixComponent);
            //console.log(`InventorySystem: Removed affixes from ${item.name} for ${entityId}:`, affixComponent.affixes);
        }

        if (toInventory) {
            inventory.items.push({ ...item, equippedSlot: undefined });
            if (!silent) this.utilities.logMessage({ channel: "system", message: `Unequipped ${item.name} to inventory` });
        }
        this.eventBus.emit('GearChanged', { entityId, action: 'unequip', slot });
    }

    discardItem({ uniqueId }) {
        const player = this.entityManager.getEntity('player');
        if (!player) { return; }
        const inventory = player.getComponent('Inventory');
        if (!inventory) { return; }

        const position = player.getComponent('Position');
        if (!position) { return; }

        const itemIndex = inventory.items.findIndex(item => item.uniqueId === uniqueId);
        if (itemIndex === -1) {
            console.error('InventorySystem: Item with uniqueId not found:', uniqueId);
            return;
        }

        const item = inventory.items[itemIndex];
        inventory.items.splice(itemIndex, 1);

        const gameStateEntity = this.entityManager.getEntity('gameState');
        if (!gameStateEntity) { return; }

        const gameState = gameStateEntity.getComponent('GameState');
        if (!gameState) { return; }

        const tier = gameState.tier;
        if (tier === undefined) { return; }

        const loot = JSON.parse(JSON.stringify({
            name: `${item.name} (Discarded)`,
            gold: 0,
            torches: 0,
            healPotions: 0,
            items: [item]
        }));

        const uniqueIdLoot = this.utilities.generateUniqueId();
        const lootEntity = this.entityManager.createEntity(`loot_${tier}_${uniqueIdLoot}`);

        let lootDropOffset = 48;
        if (player.getComponent('Visuals')?.faceLeft) {
            lootDropOffset = -lootDropOffset;
        }

        const lootPosition = new PositionComponent(position.x + lootDropOffset, position.y);
        const lootData = new LootData(loot);
        this.entityManager.addComponentToEntity(lootEntity.id, lootPosition);
        this.entityManager.addComponentToEntity(lootEntity.id, lootData);
        this.eventBus.emit('DiscardItem', { treasure: lootEntity, tier });
        this.eventBus.emit('StatsUpdated', { entityId: 'player' });
    }

    sellItem({ item, uniqueId }) {
        const player = this.entityManager.getEntity('player');
        if (!player) {
            console.error('InventorySystem: Player entity not found');
            return;
        }

        const inventory = player.getComponent('Inventory');
        if (!inventory) {
            console.error('InventorySystem: Inventory component not found for player');
            return;
        }

        const resource = player.getComponent('Resource');
        if (!resource) {
            console.error('InventorySystem: Resource component not found for player');
            return;
        }

        const itemIndex = inventory.items.findIndex(i => i.uniqueId === uniqueId);
        if (itemIndex === -1) {
            console.error('InventorySystem: Item with uniqueId not found:', uniqueId);
            return;
        }

        const itemToSell = inventory.items[itemIndex];
        if (!itemToSell.isSellable) {
            //console.log(`InventorySystem: Item ${itemToSell.name} (uniqueId: ${uniqueId}) is not sellable`);
            return;
        }

        const goldValue = itemToSell.goldValue || 0;
        resource.gold = (resource.gold || 0) + goldValue;
        inventory.items.splice(itemIndex, 1);

        this.utilities.logMessage({ channel: "loot", message: `Sold ${itemToSell.name} for ${goldValue} gold` });
        this.sfxQueue.push({ sfx: 'loot0', volume: .33 });
        this.eventBus.emit('StatsUpdated', { entityId: 'player' });
        this.eventBus.emit('PlayerStateUpdated', { entityId: 'player' });

        //console.log(`InventorySystem: Sold item ${itemToSell.name} (uniqueId: ${uniqueId}) for ${goldValue} gold`);
    }

    buyItem({ entityId, npcId, uniqueId }) {
        const player = this.entityManager.getEntity(entityId);
        if (!player) {
            console.error('InventorySystem: Player entity not found');
            return;
        }

        const npc = this.entityManager.getEntity(npcId);
        if (!npc) {
            console.error('InventorySystem: NPC entity not found:', npcId);
            return;
        }

        const inventory = player.getComponent('Inventory');
        const resource = player.getComponent('Resource');
        const shopComponent = npc.getComponent('ShopComponent');
        if (!inventory || !resource || !shopComponent) {
            console.error('InventorySystem: Missing components for buyItem');
            return;
        }

        const itemIndex = shopComponent.items.findIndex(item => item.uniqueId === uniqueId);
        if (itemIndex === -1) {
            console.error('InventorySystem: Item with uniqueId not found in shop:', uniqueId);
            return;
        }

        const item = shopComponent.items[itemIndex];
        if (resource.gold < item.purchasePrice) {
            this.utilities.logMessage({ channel: "system", message: 'Not enough gold to buy this item!' });
            return;
        }

        resource.gold -= item.purchasePrice;
        inventory.items.push({ ...item, uniqueId: this.utilities.generateUniqueId() });
        shopComponent.items.splice(itemIndex, 1);

        this.utilities.logMessage({ channel: "loot", message: `Bought ${item.name} for ${item.purchasePrice} gold` });
        this.sfxQueue.push({ sfx: 'loot0', volume: .33 });
        this.eventBus.emit('StatsUpdated', { entityId: 'player' });
        this.eventBus.emit('PlayerStateUpdated', { entityId: 'player' });

        //console.log(`InventorySystem: Bought item ${item.name} (uniqueId: ${uniqueId}) for ${item.purchasePrice} gold`);
    }

    useItem({ entityId, uniqueId }) {
        const player = this.entityManager.getEntity(entityId);
        if (!player) return;
        const inventory = player.getComponent('Inventory');
        if (!inventory) return;

        const itemIndex = inventory.items.findIndex(item => item.uniqueId === uniqueId);
        if (itemIndex === -1) {
            console.error('InventorySystem: Item with uniqueId not found:', uniqueId);
            return;
        }

        const item = inventory.items[itemIndex];
        if (!item.useItem) {
            console.warn('InventorySystem: Item is not usable:', item);
            return;
        }
        console.log('InventorySystem: Using item:', item, 'with uniqueId: ', uniqueId);
        this.eventBus.emit('ItemUsed', { entityId, item, effect: item.useEffect, params: item.params || {} });
    }

    removeItem({ entityId, uniqueId }) {
        console.log('InventorySystem: removeItem called with entityId:', entityId, 'and uniqueId:', uniqueId);
        const entity = this.entityManager.getEntity(entityId);
        if (!entity) return;
        const inventory = entity.getComponent('Inventory');
        if (!inventory) return;
        const item = inventory.items.find(item => item.uniqueId === uniqueId);
        const itemIndex = inventory.items.findIndex(item => item.uniqueId === uniqueId);
        if (itemIndex === -1) {
            console.error('InventorySystem: Item with uniqueId not found:', uniqueId);
            return;
        }
        if (!item.quantity) {
            item.quantity = 1; // Default quantity if not specified
        }
 
        item.quantity--; 
   
        if (item.quantity <= 0) {
            inventory.items.splice(itemIndex, 1); // Remove consumable item
        } else {
            this.utilities.logMessage({ channel: "system", message: `${item.quantity} ${item.name}, left in inventory ` });
        }
        
    }

    isSlotCompatible(item, slot) { 
        const slotMap = {
            amulet: ["amulet"],
            armor: ["armor"],
            head: ["head"],
            gloves: ["gloves"],
            boots: ["boots"],
            ring: ["leftring", "rightring"],
            weapon: ["mainhand", "offhand"]
        };
        const validSlots = slotMap[item.type];
        return validSlots?.includes(slot) || false;
    }
}
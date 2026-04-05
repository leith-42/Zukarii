import { System } from '../core/Systems.js';
import { ShopComponent } from '../core/Components.js';

export class NPCControllerSystem extends System {
    constructor(entityManager, eventBus, utilities) {
        super(entityManager, eventBus);
        this.utilities = utilities;
        this.INVENTORY_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
    }

    init() {
        //console.log('NPCControllerSystem: Initialized');
        // Listen for the GenerateShopInventories event
        this.eventBus.on('GenerateShopInventories', ({ tier }) => {
            console.log(`NPCControllerSystem: Received GenerateShopInventories event for tier ${tier}`);
            this.generateShopInventories(tier);
        });
        const initTier = this.entityManager.getActiveTier();
        this.generateShopInventories(initTier);

    }

    update(deltaTime) {
        // Placeholder for other NPC updates (e.g., AI, movement)
    }

    async generateShopInventories(tier) {
        console.log(`NPCControllerSystem: Starting generateShopInventories for tier ${tier}`);
        try {
            // Check if game state is ready
            const gameStateEntity = this.entityManager.getEntity('gameState');
            if (!gameStateEntity || !gameStateEntity.hasComponent('GameState')) {
                console.warn('NPCControllerSystem: GameState not ready, aborting shop generation');
                return;
            }

            
            // Query for ShopComponent in the specified tier
            const shopEntities = this.entityManager.getEntitiesWith(['ShopComponent'], tier);
            //console.log('NPCControllerSystem: Found entities with ShopComponent in tier', tier, ':', shopEntities.length, 'IDs:', shopEntities.map(n => n.id));

            // Filter for NPCs with both ShopComponent and NPCData
            const npcs = shopEntities.filter(entity => entity.hasComponent('NPCData'));
            //console.log('NPCControllerSystem: Filtered NPCs with ShopComponent and NPCData in tier', tier, ':', npcs.length, 'IDs:', npcs.map(n => n.id));

            // Debug: Check shop keeper explicitly
            const shopKeeper = this.entityManager.getEntitiesWith(['NPCData'], tier).find(n => n.id.includes('shop_keeper'));
            if (shopKeeper) {
                //console.log('NPCControllerSystem: Shop Keeper ID:', shopKeeper.id);
                //console.log('NPCControllerSystem: Shop Keeper components:', Array.from(shopKeeper.components.keys()));
                //console.log('NPCControllerSystem: Has ShopComponent:', shopKeeper.hasComponent('ShopComponent'));
            } else {
                //console.log('NPCControllerSystem: No shop keeper found in NPCData entities');
            }

            if (npcs.length === 0) {
                //console.log('NPCControllerSystem: No NPCs found with ShopComponent and NPCData in tier', tier);
                const npcDataEntities = this.entityManager.getEntitiesWith(['NPCData'], tier);
                //console.log('NPCControllerSystem: Entities with NPCData in tier', tier, ':', npcDataEntities.map(n => n.id));
                return;
            }

            // Load unique items (non-blocking)
            let uniqueItems = [];
            try {
                await new Promise((resolve) => {
                    this.eventBus.emit('GetUniqueItems', {
                        callback: (items) => {
                            uniqueItems = items;
                            //console.log('NPCControllerSystem: Loaded unique items:', uniqueItems.length);
                            resolve();
                        }
                    });
                });
            } catch (err) {
                console.error('NPCControllerSystem: Error loading unique items:', err);
                uniqueItems = [];
            }

            // Find "Golden Buniyar Band"
            const goldenBuniyarBand = uniqueItems.find(item => item.name === "Golden Buniyar Band");
            if (!goldenBuniyarBand) {
                console.warn('NPCControllerSystem: "Golden Buniyar Band" not found in unique items');
            } else {
                //console.log('NPCControllerSystem: Found "Golden Buniyar Band":', goldenBuniyarBand);
            }

            // Check player name for "bunny"
            const player = this.entityManager.getEntity('player');
            let hasBunnyInName = false;
            if (player && player.hasComponent('PlayerState')) {
                const playerName = player.getComponent('PlayerState').name || '';
                hasBunnyInName = playerName.toLowerCase().includes('bunny');
                //console.log(`NPCControllerSystem: Player name: "${playerName}", has "bunny": ${hasBunnyInName}`);
            } else {
                console.warn('NPCControllerSystem: Player or PlayerState not found, cannot check name');
                // Proceed without the unique item, but don't fail
            }

            for (const npc of npcs) {
                const shopComponent = npc.getComponent('ShopComponent');
                const now = Date.now();

                // Check if inventory is expired
                if (shopComponent.lastRestockTime && now - shopComponent.lastRestockTime < this.INVENTORY_COOLDOWN_MS) {
                    console.log(`NPCControllerSystem: Skipping inventory generation for NPC ${npc.id}, cooldown active`);
                    continue;
                }

                console.log(`NPCControllerSystem: Resetting Inventory for NPC ${npc.id} at tier ${tier}`);
                shopComponent.items = [];
                shopComponent.lastRestockTime = now; // Update timestamp


                console.log(`NPCControllerSystem: Generating shop items for NPC ${npc.id} at tier ${tier}`);
                const gameState = gameStateEntity.getComponent('GameState');
                // Tier 0 shopkeeper scales with player progression, dungeon shopkeepers use their tier
                const shopTier = tier === 0 ? (gameState.highestTier || 0) : tier;
                console.log(`NPCControllerSystem: Using shop tier ${shopTier} (tier: ${tier}, highestTier: ${gameState.highestTier}, isTier0: ${tier === 0})`);
                let merchantBaseItemTier = Math.round(shopTier / 10);
                if (merchantBaseItemTier < 1) merchantBaseItemTier = 0;
                if (merchantBaseItemTier > 6) merchantBaseItemTier = 6;

                const merchantItemCount = Math.round(Math.random() * 4) + 3;
                const partialItems = [];

                for (let i = 0; i < merchantItemCount; i++) {
                    let itemTier = merchantBaseItemTier;
                    const roll = Math.random();
                    if (roll > .998) itemTier += 2;
                        else if (roll > .85) itemTier++ ;
                    if (roll < .01) itemTier -= 2;
                        else if(roll < .35) itemTier--;

                    if (itemTier < 1) itemTier = 0;
                    if (itemTier > 6) itemTier = 6;
                    partialItems.push({ tierIndex: itemTier })
                    }


                //console.log('NPCControllerSystem: partialItems for NPC:', npc.id, partialItems);
                const shopItemPromises = partialItems.map((partialItem, index) => {
                    return new Promise((resolve) => {
                        //console.log(`NPCControllerSystem: Emitting GenerateROGItem for item ${index} for NPC ${npc.id}:`, partialItem);
                        this.eventBus.emit('GenerateROGItem', {
                            partialItem,
                            dungeonTier: tier, // Use the provided tier
                            callback: (item) => {
                                //console.log(`NPCControllerSystem: Callback received for item ${index} for NPC ${npc.id}:`, item);
                                resolve(item);
                            }
                        });
                    });
                });

                //console.log('NPCControllerSystem: Waiting for Promise.all for NPC:', npc.id);
                let shopItems = await Promise.all(shopItemPromises);
                //console.log('NPCControllerSystem: Promise.all resolved, shopItems for NPC:', npc.id, shopItems);

                const filteredItems = shopItems.filter(item => item !== null && item !== undefined);
                //console.log('NPCControllerSystem: Filtered shop items for NPC:', npc.id, filteredItems);

                // Add "Golden Buniyar Band" if found and player name contains "bunny"
                if (goldenBuniyarBand && hasBunnyInName) {
                    const uniqueItemCopy = { ...goldenBuniyarBand, uniqueId: this.utilities.generateUniqueId() };
                    filteredItems.push(uniqueItemCopy);
                    //console.log('NPCControllerSystem: Added "Golden Buniyar Band" to shop items for NPC:', npc.id);
                } else if (goldenBuniyarBand && !hasBunnyInName) {
                    //console.log('NPCControllerSystem: Skipped adding "Golden Buniyar Band" to shop items for NPC:', npc.id, 'Reason: Player name does not contain "bunny"');
                }

                shopComponent.items = filteredItems.map(item => {
                    // Base price multiplier
                    let priceMultiplier = shopComponent.sellMultiplier;

                    // Double the price for high-tier items (mastercraft, legendary, relic, artifact)
                    if (item.tierIndex >= 4) {
                        priceMultiplier += item.tierIndex;
                    }

                    return {
                        ...item,
                        uniqueId: item.uniqueId || this.utilities.generateUniqueId(),
                        purchasePrice: Math.round((item.goldValue || 0) * priceMultiplier)
                    };
                });
                //console.log(`NPCControllerSystem: Generated ${shopComponent.items.length} shop items for NPC ${npc.id}`);
            }
        } catch (err) {
            console.error('NPCControllerSystem: Error in generateShopInventories:', err);
        }
    }
}
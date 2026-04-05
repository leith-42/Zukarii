// systems/EffectsSystem.js
import { System } from '../core/Systems.js';
import { ResourceComponent } from '../core/Components.js';

export class EffectsSystem extends System {
    constructor(entityManager, eventBus, utilities) {
        super(entityManager, eventBus, utilities);
        this.requiredComponents = [];
        this.healthUpdates = this.entityManager.getEntity('gameState').getComponent('DataProcessQueues').HealthUpdates;
    }

    init() {

        //console.log('EffectsSystem.init: this.entityManager:', this.entityManager);

        this.eventBus.on('applyEffect', ({ entityId, effect, params, context }) => {

            //console.log('EffectsSystem.applyEffect: this:', this, 'entityManager:', this.entityManager);
            //console.log(`EffectsSystem: Received applyEffect for ${entityId} with effect: ${effect}`);


            const handlers = {
                stealGold: this.stealGold.bind(this),
                instantHeal: this.instantHeal.bind(this),
                lifeSteal: this.lifeSteal.bind(this),
                reflectDamage: this.reflectDamage.bind(this)
            };
            const handler = handlers[effect];
            if (handler) {
                handler(entityId, params, context);
            } else {
                console.warn(`EffectsSystem: No handler for effect ${effect} on ${entityId}`);
            }
        });
        //console.log('EffectsSystem: Initialized and listening for applyEffect events');

        this.eventBus.on('ItemUsed', ({ entityId, item, effect, params }) => {
           this.applyEffect({ entityId, effect, params, context: { item, itemId: item.itemId } });
        });
    }

    applyEffect({ entityId, effect, params, context }) {    
        //console.log('EffectsSystem.applyEffect: this.entityManager:', this.entityManager);
        //console.log(`EffectsSystem: Applying effect ${effect} to ${entityId} with params:`, params);
        const handlers = {
            teleportToTier: this.teleportToTier.bind(this),
            reflectDamage: this.reflectDamage.bind(this),
            forgeSpectralWyrmKey: this.forgeSpectralWyrmKey.bind(this),
        };
        const handler = handlers[effect];
        if (handler) {
            handler(entityId, params, context);
        } else {
            console.warn(`EffectsSystem: No handler for effect ${effect} on ${entityId}`);
        }
    }

    update() {
        // No per-frame logic needed yet—event-driven for now
    }

    stealGold(entityId, params, context) {
        const attacker = this.entityManager.getEntity(entityId);
        const targetId = context.targetId;
        const target = this.entityManager.getEntity(targetId);
        const resource = target?.getComponent('Resource');

        if (!attacker || !target || !resource) {
            console.warn(`EffectsSystem:stealGod failed - Attacker ${entityId} target ${targetId} or arget ${target.id} Resource component not found `);
            return;
        }
        const goldBefore = resource.gold;
        if (goldBefore > 0) {
            const STEAL_PERCENTAGE = params?.stealPercentage || 0.1;
            const MIN_STEAL = params?.minSteal || 1;
            const monsterData = attacker.getComponent('MonsterData');
            const attackerName = monsterData ? monsterData.name : 'Unknown';
            const stolenGold = Math.floor(goldBefore * STEAL_PERCENTAGE) + MIN_STEAL;

            resource.gold = Math.max(0, goldBefore - stolenGold);

            this.utilities.logMessage({channel: 'loot',  message: `${attackerName}'s Greedy Claw attack has stolen ${stolenGold} gold from you!`});

            if (resource.gold === 0) {
                this.utilities.logMessage({ channel: 'loot', message: `ALL YOUR GOLD ARE BELONG TO ${attackerName}` });
            }
        } 
    }

    // NEW: Moved from AffixSystem - instantHeal effect
    instantHeal(entityId, params, context) {
        //console.log('EffectsSystem.instantHeal: this.entityManager:', this.entityManager);
        const entity = this.entityManager.getEntity(entityId);
        if (!entity) {
            console.warn(`EffectsSystem: Entity ${entityId} not found for instantHeal`);
            return;
        }

        const CHANCE_TO_HEAL = params?.chanceToHeal || 0.05;
        const MIN_HEAL_PERCENTAGE = params?.minHealPercentage || 0.05;
        const MAX_HEAL_PERCENTAGE = params?.maxHealPercentage || 0.10;

        if (Math.random() >= CHANCE_TO_HEAL) {
            //console.log(`EffectsSystem: Heal chance failed for ${entity.id}`);
            return;
        }

        const health = entity.getComponent('Health');
        if (!health) {
            console.warn(`EffectsSystem: Entity ${entity.id} has no Health component for instantHeal`);
            return;
        }

        const missingHp = health.maxHp - health.hp;
        const healPercentage = Math.random() * (MAX_HEAL_PERCENTAGE - MIN_HEAL_PERCENTAGE) + MIN_HEAL_PERCENTAGE;
        const healAmount = Math.round(missingHp * healPercentage);
        this.healthUpdates.push({ entityId, amount: healAmount });
    
        this.utilities.logMessage( {channel: 'combat', classNames: 'player', message: `Resilience heals you for ${healAmount} HP! (${health.hp}/${health.maxHp})`});
        //console.log(`EffectsSystem: Healed ${entity.id} for ${healAmount} HP. Now: ${health.hp}/${health.maxHp}`);
    }

    // NEW: Moved from AffixSystem - lifeSteal effect
    lifeSteal(entityId, params, context) {
        //console.log('EffectsSystem.lifeSteal: this.entityManager:', this.entityManager);
        const entity = this.entityManager.getEntity(entityId);
        if (!entity) {
            console.warn(`EffectsSystem: Entity ${entityId} not found for lifeSteal`);
            return;
        }

        //console.log(`EffectsSystem: Attempting lifeSteal on ${entity.id}`);
        const CHANCE_TO_STEAL_LIFE = params?.chanceToStealLife || 0.10;
        const MIN_DAMAGE_HEALED_PERCENTAGE = params?.minDamageHealedPercentage || 0.15;
        const MAX_DAMAGE_HEALED_PERCENTAGE = params?.maxDamageHealedPercentage || 0.25;

        if (Math.random() >= CHANCE_TO_STEAL_LIFE) {
            //console.log(`EffectsSystem: Life steal chance failed for ${entity.id}`);
            return;
        }

        const targetId = context.targetId;
        const target = this.entityManager.getEntity(targetId);
        if (!target) {
            console.warn(`EffectsSystem: Target ${targetId} not found for lifeSteal`);
            return;
        }

        const health = entity.getComponent('Health');
        if (!health) {
            console.warn(`EffectsSystem: Entity ${entity.id} has no Health component for lifeSteal`);
            return;
        }

        const damageDealt = context.damageDealt || 0;
        if (damageDealt <= 0) {
            console.warn(`EffectsSystem: No damage dealt provided for lifeSteal on ${entity.id}`);
            return;
        }

        const healPercentage = Math.random() * (MAX_DAMAGE_HEALED_PERCENTAGE - MIN_DAMAGE_HEALED_PERCENTAGE) + MIN_DAMAGE_HEALED_PERCENTAGE;
        const healAmount = Math.round(damageDealt * healPercentage);

        this.healthUpdates.push({ entityId, amount: healAmount });

        this.utilities.logMessage({ channel: 'combat', classNames: 'player', message: `Life Steal heals you for ${healAmount} HP from damage dealt! (${health.hp}/${health.maxHp})`});
        //console.log(`EffectsSystem: ${entity.id} stole ${healAmount} HP from ${targetId}. Now: ${health.hp}/${health.maxHp}`);
    }


    reflectDamage(entityId, params, context) {
        //console.log('EffectsSystem.reflectDamage: this.entityManager:', this.entityManager);
        const entity = this.entityManager.getEntity(entityId);
        if (!entity) {
            console.warn(`EffectsSystem: Entity ${entityId} not found for reflectDamage`);
            return;
        }
        if (!context || !context.attackerId || !context.damageDealt) {
            console.warn(`EffectsSystem: Invalid context for reflectDamage on ${entityId}`, context);
            return;
        }

        console.log(`EffectsSystem: Attempting reflectDamage on ${entity.id}`);
        const CHANCE_TO_REFLECT = params?.chanceToReflect || 0.10;
        const MIN_REFLECT_PERCENTAGE = params?.minReflectPercentage || 0.25;
        const MAX_REFLECT_PERCENTAGE = params?.maxReflectPercentage || .5;
        const DAMAGE = context.damageDealt || 0;
        const TARGET_ID = context.attackerId || null;

        if (Math.random() >= CHANCE_TO_REFLECT) {
            //console.log(`EffectsSystem: Reflect chance failed for ${entity.id}`);
            return;
        }
        const reflectAmount = Math.round(DAMAGE * (Math.random() * (MAX_REFLECT_PERCENTAGE - MIN_REFLECT_PERCENTAGE) + MIN_REFLECT_PERCENTAGE));

        this.healthUpdates.push({ entityId, amount: reflectAmount });
        console.log(`EffectsSystem: ${entity.id} received ${DAMAGE} damage from ${TARGET_ID}. Reflecting ${reflectAmount} damage back to attacker.${TARGET_ID}`);
        this.healthUpdates.push({ entityId: TARGET_ID, amount: -reflectAmount });

        this.utilities.logMessage({ channel: 'combat', classNames: 'player', message: `Reflect Damage hits your attacker for ${reflectAmount} HP! `});
        console.log(`EffectsSystem: Reflect Damage hits your attacker for ${entity.id} for ${reflectAmount} HP. `);
    }

    teleportToTier(entityId, params, context) {
        const entity = this.entityManager.getEntity(entityId);
        console.log(`EffectsSystem: Attempting teleportToTier on ${entityId} with params:`, params, context);
        if (!entity) {
            console.warn(`EffectsSystem: Entity ${entityId} not found for teleportToTier`, params.tier);
            return;
        }
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        const levelTransition = this.entityManager.getEntity('gameState').getComponent('LevelTransition');
        const tier = params.tier || 0;
        levelTransition.pendingTransition = 'teleportToTier';
        levelTransition.destinationTier = tier;
        this.utilities.logMessage({ channel: "system", message: `You are teleported to tier ${tier}!` });

        const uniqueId = context.item.uniqueId;
        const itemId = context.item.journeyItemId != null ? context.item.journeyItemId :  uniqueId; // Use journeyItemId if available, otherwise use context.item.id

        this.utilities.pushPlayerActions('useItem', { itemId });
        this.eventBus.emit('StatsUpdated', { entityId });
        this.utilities.logMessage({ channel: "system", message: `Used ${context.item.name}` });

        console.log(`EffectsSystem: Teleporting ${entity.id} to tier ${tier} with uniqueId ${uniqueId}`);
        if (context.item.type === 'consumable') {
            console.log(`EffectsSystem: Emitting request to Removing item ${uniqueId} from player inventory after teleporting to tier ${tier}`);
            this.eventBus.emit('RemoveItem', { entityId: 'player', uniqueId });
        }
    }

    forgeSpectralWyrmKey(entityId, params, context) {
        const player = this.entityManager.getEntity('player');
        const hasForgedKey = player.getComponent('Inventory')?.items?.some(item => item.itemId === 'spectralWyrmKey');
        if (hasForgedKey) {
            this.utilities.logMessage({ channel: "journey", message: `You have already forged the Spectral Wyrm Key!` });
            return;
        }

        //console.log(`EffectsSystem: Attempting to forge Spectral Wyrm Key from ${entityId}`);
        
        const playerResource = player.getComponent('Resource');
        //console.log(`EffectsSystem: Player resource component:`, playerResource);
        const requiredResources = params.craftResources 
        //console.log(`EffectsSystem: Required resources for forging Spectral Wyrm Key: ${requiredResources}`);
        //console.log(`EffectsSystem: Player resource component:`, playerResource.craftResources);
        const craftResourceAmount = playerResource.craftResources[requiredResources] || 0;
        const amount = params.amount;
        //console.log(`EffectsSystem: Player has ${craftResourceAmount} of ${amount} required ${requiredResources}`);

        

        const proximityEntity = params.proximity; 
        const tier = params.tier; 
        //need to check distance from player to specific entity (stairsDown) in the specified tier
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState')
        let inProximity = false; // Initialize proximity check
        if (gameState.tier !== tier) {
            this.utilities.logMessage({ channel: 'system', message: `You must be near The Guardian among the ashen to make your offering!` });
            return;
        } else {
             
        }
        
        const stairsDownEntity = this.utilities.findStairOnTier(tier, 'down');
        //console.log(`EffectsSystem: stairsDownEntity:`, stairsDownEntity);
        const stairsDownPosition = stairsDownEntity.getComponent('Position');
        const playerPosition = player.getComponent('Position');
        const distance = Math.sqrt(Math.pow(stairsDownPosition.x - playerPosition.x, 2) + Math.pow(stairsDownPosition.y - playerPosition.y, 2));
        const proximityDistance = 320; // Define the proximity distance threshold 5 tiles * 32px * 2 scaling per tile
        inProximity = distance <= proximityDistance; // Check if player is within proximity distance
        //console.log(`EffectsSystem: Player is ${distance} units away from stairs down in Tier ${tier}. Proximity check: ${distance} <= ${proximityDistance}`);

        if (!inProximity) {
            this.utilities.logMessage({ channel: 'system', message: `You must be near The Guardian among the ashen to make your offering!` });
            return;
        } 

        let hasResources = false;
        if (craftResourceAmount < amount) {
            this.utilities.logMessage({ channel: 'system', message: `You must offer this tooth and at least ${amount} ${requiredResources} to The Guardian !` });
            return;
        } else {
            hasResources = true;
            //console.log(`EffectsSystem: Player has ${craftResourceAmount} of ${amount} required ${requiredResources}`)
        }

        if (hasResources && inProximity) {
            // need to unlock stairs
            const stairsDownComponent = stairsDownEntity.getComponent('Stair');
            if (!stairsDownComponent) {
                console.warn(`EffectsSystem: Stairs down entity ${stairsDownEntity.id} has no Stair component`);
                return;
            }
            stairsDownComponent.active = true; // Unlock the stairs down
            // Remove 20 Ashen Shards and add the key item to inventory
            playerResource.craftResources[requiredResources] -= amount;
            const playerInventory = player.getComponent('Inventory');
            // Need to get item from journeyItems.json
            const spectralWyrmKey = {
                itemId: null,
                journeyItemId: "spectralWyrmKey",
                name: "Spectral Wyrm Key",
                type: "journey",
                itemTier: "magic",
                goldValue: 0,
                isJourneyItem: true,
                description: "Posessing this Key allows passage to Ashangal.",
                icon: "spectral_wyrm_key.png",
                isSellable: false
            
            };


           // Need to add item to inventory
            this.eventBus.emit('HandleItemReward', { reward: spectralWyrmKey, entityId: player.id }); 
            this.utilities.logMessage({ channel: "journey", message: `You have forged the Spectral Wyrm Key!` });

            const uniqueId = context.item.uniqueId;
            const itemId = context.item.journeyItemId != null ? context.item.journeyItemId : uniqueId; // Use journeyItemId if available, otherwise use context.item.id

            this.utilities.pushPlayerActions('useItem', { itemId });
            this.eventBus.emit('StatsUpdated', { entityId });
            this.utilities.logMessage({ channel: "system", message: `Used ${context.item.name}` });

            if (context.item.type === 'consumable') {
                console.log(`EffectsSystem: Emitting request to Removing item ${uniqueId} from player inventory after forging Spectral Wyrm Key`);
                this.eventBus.emit('RemoveItem', { entityId: player.id, uniqueId });
            }
        }  
    }
}

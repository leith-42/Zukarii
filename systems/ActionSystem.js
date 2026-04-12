// ActionSystem.js
import { System } from '../core/Systems.js';
import { NeedsRenderComponent, } from '../core/Components.js';
export class ActionSystem extends System {
    constructor(entityManager, eventBus, utilities) {
        super(entityManager, eventBus);
        this.requiredComponents = ['Position', 'Resource', 'PlayerState']; 
        this.utilities = utilities;
        this.healthUpdates = this.entityManager.getEntity('gameState').getComponent('DataProcessQueues').HealthUpdates;
    }

    init() {
        this.sfxQueue = this.entityManager.getEntity('gameState').getComponent('AudioQueue').SFX || [];
        this.eventBus.on('UseFountain', (data) => this.useFountain(data));
        this.eventBus.on('LightTorch', () => this.lightTorch());
        this.eventBus.on('DrinkHealPotion', () => this.drinkHealPotion());
    }

    // ActionSystem.js - Updated useFountain method
    useFountain({ fountainEntityId }) {
        const entityId = 'player'; 
        const player = this.entityManager.getEntity(entityId);
        const fountainEntity = this.entityManager.getEntity(fountainEntityId);
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState'); 
    

        if (!player || !fountainEntity) return;
        
        const fountainData = fountainEntity.getComponent('Fountain') || { used: false };

        const fUseTime = Date.now(); 

        if (!fountainData) { 
            console.log('ActionSystem: - useFountain: No fountain data found.'); 
            return; 
        }

        const canUseFountain = fUseTime - fountainData.useCdExpiresAt || 0; // Default to 0 if not set
        if (canUseFountain < 1) { return; }
       
        this.sfxQueue.push({ sfx: 'fountain0', volume: .5 }); 
        fountainData.useCdExpiresAt = fUseTime + 2500; // 2.5 seconds cooldown
        
        const fountainCanHeal = fUseTime - fountainData.healCdExpiresAt || 0; // Default to 0 if not set
        if (fountainCanHeal < 1) {
            this.utilities.logMessage({ channel: "system", message: `The fountain water is cool and refreshing, but it seems the healing magic that was here is now spent.` });
            return;
        }

        fountainData.healCdExpiresAt = fUseTime + 90000; // 90 seconds cooldown

        const playerStats = player.getComponent('Stats');
        const playerHealth = player.getComponent('Health');
        const pos = player.getComponent('Position');
        const critChance = playerStats.critChance || (playerStats.agility * 0.02);
        let healAmount = 0;

        if (Math.random() < critChance && fountainData.used === false) {
            const maxHpBoost = Math.round(1 + (2 * (gameState.tier / 10)));

            this.utilities.logMessage({ channel: "system", message: `The fountain surges with power! Fully healed and Max HP increased!` });

            this.eventBus.emit('ModifyBaseStat', { stat: 'maxHp', value: maxHpBoost });

            healAmount = (playerHealth.maxHp + maxHpBoost) - playerHealth.hp;

            this.healthUpdates.push({ entityId, amount: healAmount });

        } else {
            const missingHp = playerHealth.maxHp - playerHealth.hp;
            const healPercent = Math.random() * (0.5 - 0.3) + 0.3;

            healAmount = Math.min(playerHealth.hp + Math.round(missingHp * healPercent), playerHealth.maxHp);
            this.healthUpdates.push({ entityId, amount: healAmount });

            this.utilities.logMessage({ channel: "system", message: `The fountain restores ${healAmount} HP. Current HP: ${playerHealth.hp}/${playerHealth.maxHp}` });
        }

        fountainData.used = true;
        this.eventBus.emit('StatsUpdated', { entityId: 'player' });

        if (!fountainEntity.hasComponent('NeedsRender')) {
            this.entityManager.addComponentToEntity(fountainEntityId, new NeedsRenderComponent(pos.x, pos.y));
        }
    }

    drinkHealPotion() {
        const entityId = 'player'; 
        const player = this.entityManager.getEntity(entityId);
        if (!player) return;

        const resource = player.getComponent('Resource');
        const health = player.getComponent('Health');
        const stats = player.getComponent('Stats');

        if (resource.healPotions <= 0) return;

        const critChance = stats.critChance || (stats.agility * 0.02);
        let critHealText = '';
        let healAmount = Math.round(health.maxHp * 0.3);

        if (Math.random() < critChance) {
            healAmount = health.maxHp - health.hp;
            critHealText = 'is of exceptional quality and ';
        }

       healAmount = Math.min(healAmount, health.maxHp);
        this.healthUpdates.push({ entityId, amount: healAmount });

        resource.healPotions--;

        const message = health.hp + healAmount >= health.maxHp
            ? `The Heal Potion ${critHealText}fully heals you!`
            : `The Heal Potion restores ${healAmount} HP. Current HP: ${health.hp + healAmount}/${health.maxHp}`;
        this.utilities.logMessage({ channel: "system", message });
        this.eventBus.emit('StatsUpdated', { entityId: 'player' });
    }

    lightTorch() {
        const player = this.entityManager.getEntity('player');
        if (!player) return;

        const resource = player.getComponent('Resource');
        
        if (resource.torches <= 0) {
            this.utilities.logMessage({ channel: "system", message: 'You have no torches left.' });
            return;
        }
        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
        if (gameState) gameState.needsRender = true;

        resource.torches--;
        this.eventBus.emit('LightSourceActivated', { type: 'torch', entityId: 'player' });
        this.eventBus.emit('PlayerStateUpdated', { entityId: 'player' });

        let message = 'The darkness is at bay... for now!';
        if (resource.torches < 1) {
            message = 'You light your last torch!';
        }
        this.utilities.logMessage({ channel: "system", message });
        
    }
}
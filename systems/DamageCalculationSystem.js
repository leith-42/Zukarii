// systems/DamageCalculationSystem.js
import { System } from '../core/Systems.js';

export class DamageCalculationSystem extends System {
    constructor(entityManager, eventBus, utilities) {
        super(entityManager, eventBus, utilities);
        this.requiredComponents = [];

        this.queues = this.entityManager.getEntity('gameState')?.getComponent('DataProcessQueues') || {};
        this.healthUpdates = this.queues.HealthUpdates || [];
    }

    
    init() {
        this.eventBus.on('CalculateDamage', ({ attacker, target, weapon }) => {
            const result = attacker.hasComponent('PlayerState')
                ? this.calculatePlayerToMonsterDamage({ attacker, target, weapon })
                : this.calculateMonsterToPlayerDamage({ attacker, target });

            // NEW: Emit WasHit + set isAggro
            if (target.hasComponent('MonsterData')) {
                const monsterData = target.getComponent('MonsterData');
                if (!monsterData.isAggro) monsterData.isAggro = true;
                this.eventBus.emit('MonsterWasHit', {
                    entityId: target.id,
                    attackerId: attacker.id,
                    damageDealt: result.damage
                });
            } else if (target.hasComponent('PlayerState')) {
                this.eventBus.emit('PlayerWasHit', {
                    entityId: target.id,
                    attackerId: attacker.id,
                    damageDealt: result.damage
                });
            }
        });
    }

    update(deltaTime) {
        // NEW: Empty—pure ECS, no per-frame logic needed
    }

    calculatePlayerToMonsterDamage({ attacker, target, weapon }) {
        const attackerStats = attacker.getComponent('Stats');
        const level = attacker.getComponent('PlayerState').level;

        const baseDamageMin = weapon?.baseDamageMin || 1;
        const baseDamageMax = weapon?.baseDamageMax || 2;
        const prowess = attackerStats.prowess || 0;
        const intellect = attackerStats.intellect || 0;
        const damageBonus = attackerStats.damageBonus || 0; // All attacks
        const meleeBonus = attackerStats.meleeBonus || 0;
        const rangedBonus = attackerStats.rangedBonus || 0;
        const agility = attackerStats.agility || 0;

        const isRanged = weapon?.attackType === 'ranged';
        const statBonus = isRanged ? rangedBonus : meleeBonus;
        const baseStat = isRanged ? intellect : prowess;

        // Base damage: roll + level
        const baseRoll = Math.floor(Math.random() * (baseDamageMax - baseDamageMin + 1)) + baseDamageMin;
        const baseDamage = baseRoll + level;

        // Apply bonuses and stat multiplier
        const preCritDamage = (baseDamage + damageBonus + statBonus) * (1 + baseStat * 0.02);

        // Crit check: agility * 0.01, 1.5x multiplier
        const critChance = agility * 0.01;
        const critRoll = Math.random();
        const isCritical = critRoll < critChance;
        const totalDamage = Math.round(isCritical ? preCritDamage * 1.5 : preCritDamage);

        this.healthUpdates.push({ entityId: target.id, amount: -totalDamage , attackerId:'player'});
       
        this.utilities.logMessage({
            channel: 'combat', 
            classNames: 'player',
            message: `${isCritical ? '(CRIT): ' : ''}You dealt ${totalDamage} damage to ${target.getComponent('MonsterData').name} with your ${weapon?.name || 'Fists'}`
        });

        return { damage: totalDamage };
    }

    calculateMonsterToPlayerDamage({ attacker, target, weapon }) {
        const monsterData = attacker.getComponent('MonsterData');
        const targetStats = target.getComponent('Stats');
        const tier = this.entityManager.getEntity('gameState').getComponent('GameState').tier;
        const tierDamageMultiplier = 0.20;
        const armorReductionFactor = 0.02 + (.001 * tier/10);
        const defenseReductionFactor = 0.025;

        const baseDamageMin = monsterData.minBaseDamage || 2;
        const baseDamageMax = monsterData.maxBaseDamage || 3;
        const baseDamage = Math.round(Math.random() * (baseDamageMax - baseDamageMin)) + baseDamageMin;
        const scaledDamage = Math.round(baseDamage * (1 + tier * tierDamageMultiplier));

        const critThreshold = 95;
        const critMultiplier = 1.2; 
        const critRoll = Math.random() * 100;
        const isCritical = critRoll >= critThreshold;
        const preReductionDamage = isCritical ? Math.round(scaledDamage * critMultiplier) : scaledDamage;

        const armor = targetStats.armor || 0;
        const armorReduction = armor > 0 ? Math.max(1, Math.floor(preReductionDamage * armorReductionFactor * armor)) : 0;
        const defenseReduction = Math.round(preReductionDamage * (defenseReductionFactor * (targetStats.defense || 0)));
        const totalDamage = Math.round(Math.max(0, preReductionDamage - armorReduction - defenseReduction));

        let magicResistMessage = '';
        if (weapon.attackType === 'ranged') {
            const magicResist = targetStats.resistMagic || 0;
            const magicResistReduction = Math.round(totalDamage * (magicResist * 0.01));
            magicResistMessage = `, magic resist absorbs: ${magicResistReduction}`;
            totalDamage = Math.max(0, totalDamage - magicResistReduction);
        }

        this.healthUpdates.push({ entityId: target.id, amount: -totalDamage, attackerId: attacker });

        this.utilities.logMessage({
            channel: 'combat',
            message: `${isCritical ? '(CRIT): ' : ''}${monsterData.name} hits for ${preReductionDamage}, armor protects you from: ${armorReduction}, defense skill mitigates: ${defenseReduction} ${magicResistMessage} resulting in ${totalDamage} damage dealt to you`
        });
        return { damage: totalDamage };
    }
}


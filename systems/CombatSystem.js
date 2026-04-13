// systems/CombatSystem.js
import { System } from '../core/Systems.js';
import { PositionComponent, LastPositionComponent, ProjectileComponent, MovementSpeedComponent, InCombatComponent, NeedsRenderComponent, HitboxComponent, VisualsComponent } from '../core/Components.js';

export class CombatSystem extends System {
    constructor(entityManager, eventBus, utilities) {
        super(entityManager, eventBus, utilities);
        this.requiredComponents = ['Position', 'Health'];
        this.queues = this.entityManager.getEntity('gameState').getComponent('DataProcessQueues') || {};
        this.healthUpdates = this.queues.HealthUpdates || [];
        this.manaUpdates = this.queues.ManaUpdates;

        this.sfxQueue = this.entityManager.getEntity('gameState').getComponent('AudioQueue').SFX || []
    }

    init() {
        this.eventBus.on('MeleeAttack', (data) => this.handleMeleeAttack(data));
        this.eventBus.on('RangedAttack', (data) => {
            //console.log('CombatSystem: RangedAttack event received with data:', data);
            this.handleRangedAttack(data);
        });
        this.eventBus.on('MonsterRangedAttack', (data) => this.initiateRangedAttack(data));
        this.eventBus.on('MonsterAttack', (data) => this.handleMonsterMeleeAttack(data));
        this.eventBus.on('RangedAttackHit', (data) => {
            //console.log('CombatSystem: RangedAttackHit event received with data:', data);
            this.combatFlagging(data);
        });
        
           
    }

    update() {
        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
        if (gameState?.gameOver) return;
    }

    combatSfx(type) {
        const hitFileCount = 27;
        const missFileCount = 9;
        const blockFileCount = 9;

        let sfx = '';
        switch (type) {
            case 'hit': sfx = `${type}${Math.floor(Math.random() * hitFileCount)}`; break;
            case 'miss': sfx = `${type}${Math.floor(Math.random() * missFileCount)}`; break;
            case 'block': sfx = `${type}${Math.floor(Math.random() * blockFileCount)}`; break;
            default: return;
        }
        this.sfxQueue.push({ sfx, volume: .1 }); 
    }

    getBestRangedWeapon() {
        const player = this.entityManager.getEntity('player');
        const playerInventory = player.getComponent('Inventory');
        const mainWeapon = playerInventory.equipped.mainhand;
        const offWeapon = playerInventory.equipped.offhand;
        const rangedWeapons = [];

        if (mainWeapon?.attackType === 'ranged') rangedWeapons.push(mainWeapon);
        if (offWeapon?.attackType === 'ranged') rangedWeapons.push(offWeapon);
        if (rangedWeapons.length === 0) return null;

        return rangedWeapons.reduce((best, current) => {
            const bestMean = (best.baseDamageMin + best.baseDamageMax) * 0.5;
            const currentMean = (current.baseDamageMin + current.baseDamageMax) * 0.5;
            return currentMean > bestMean ? current : best;
        }, rangedWeapons[0]);
    }

    handleMonsterMeleeAttack({ entityId }) {
        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
        if (gameState?.gameOver) return;

        const monster = this.entityManager.getEntity(entityId);
        const player = this.entityManager.getEntity('player');
        if (!monster || !player || !monster.getComponent('MonsterData')?.isAggro) return;  

        const playerStats = player.getComponent('Stats');
        const monsterData = monster.getComponent('MonsterData');

        this.combatFlagging({ attacker:monster, target:player })

        const dodgeRoll = Math.round((Math.random() * 100) + (playerStats.dodge / 2) );
        if (dodgeRoll >= 85) {
           // this.eventBus.emit('LogMessage', { message: `You dodged the ${monsterData.name}'s attack!` });
            this.utilities.logMessage({  channel: 'combat', message: `You dodged the ${monsterData.name}'s attack!` }); 
            this.combatSfx('miss');
            return;
        }

        const blockRoll = Math.round((Math.random() * 100) + (playerStats.block / 2) );
        if (blockRoll >= 85) {
            //this.eventBus.emit('LogMessage', { message: `You blocked the ${monsterData.name}'s attack!` });
            this.utilities.logMessage({ channel: 'combat', message: `You blocked the ${monsterData.name}'s attack!` });
            this.combatSfx('block');
            return;
        }

        this.combatSfx('hit');
        //eventBus.emit('PlayerWasHit', { entityId: 'player', attackerId: entityId });
        this.eventBus.emit('CalculateDamage', {
            attacker: monster,
            target: player,
            weapon: 'melee' 
        });

         

    }

    handleMeleeAttack({ targetEntityId }) {
        const player = this.entityManager.getEntity('player');
        const target = this.entityManager.getEntity(targetEntityId);
        if (!player || !target) return;
       

        const playerStats = player.getComponent('Stats');
        const playerInventory = player.getComponent('Inventory');
        const targetHealth = target.getComponent('Health');
        const targetMonsterData = target.getComponent('MonsterData');

        this.combatFlagging({ attacker:player, target })

        const meleeWeapons = [];
        const mainhand = playerInventory.equipped.mainhand;
        const offhand = playerInventory.equipped.offhand;
        if (mainhand?.attackType === 'melee') meleeWeapons.push(mainhand);
        if (offhand?.attackType === 'melee') meleeWeapons.push(offhand);
        if (meleeWeapons.length === 0) meleeWeapons.push({ baseDamageMin: 0.5, baseDamageMax: 1, name: 'Fists', attackType: 'melee' });

        const isDualWield = meleeWeapons.length === 2;

        meleeWeapons.forEach((weapon, index) => {
            if (target.hasComponent('Dead')) return;

            const missChance = isDualWield ? (index === 0 ? 15 : 25) : 0;
            if (Math.random() * 100 < missChance) {
               // this.eventBus.emit('LogMessage', { message: `Your ${weapon.name} missed the ${targetMonsterData.name}!` });
                this.utilities.logMessage({ channel: 'combat', message: `Your ${weapon.name} missed the ${targetMonsterData.name}!` });
                this.combatSfx('miss');
                return;
            }

            const dodgeRoll = Math.random() * 100;
            if (dodgeRoll >= 95) {
               // this.eventBus.emit('LogMessage', { message: `${targetMonsterData.name} dodged your ${weapon.name} attack!` });
                this.utilities.logMessage({ channel: 'combat', message: `${targetMonsterData.name} dodged your ${weapon.name} attack!` });
                this.combatSfx('miss');
                return;
            }

            const blockRoll = Math.random() * 100;
            if (blockRoll >= 95) {
               // this.eventBus.emit('LogMessage', { message: `${targetMonsterData.name} blocked your ${weapon.name} attack!` });
                this.utilities.logMessage({ channel: 'combat', message: `${targetMonsterData.name} blocked your ${weapon.name} attack!` });
                this.combatSfx('block');
                return;
            }

            this.combatSfx('hit');
            this.eventBus.emit('CalculateDamage', {
                attacker: player,
                target: target,
                weapon: weapon
            });
        });
    }

    handleRangedAttack(direction ) {
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        const player = this.entityManager.getEntity('player');
        if (!player) return;

        const playerState = player.getComponent('PlayerState');
        if (playerState.isCasting) return;

        const manaCost = 2;
        if (this.entityManager.getEntity('player').getComponent('Mana').mana < manaCost) {
            //console.log(`you do not have enough mana to cast FlamingBolt`);
            return;
        }

        const combat = player.getComponent('InCombat');
        if (!combat) {
            player.addComponent(new InCombatComponent(3000));
            //this.eventBus.emit('LogMessage', { message: 'You enter combat by casting FlamingBolt!' });
            this.utilities.logMessage({ channel: 'combat', message: 'You enter combat by casting FlamingBolt!' });
        } else {
            combat.elapsed = 0; // Reset to extend 3s
        }

        const playerPos = player.getComponent('Position');
        const stats = player.getComponent('Stats');
       
        const weapon = this.getBestRangedWeapon();
        const range = stats.range || weapon?.baseRange || 3;

        let isPiercing = false;
        if (weapon?.piercing) { // Placeholder for piercing logic
            isPiercing = true;
        }
        const sfx = 'firecast0';

        this.sfxQueue.push({ sfx, volume: .5 });
        this.manaUpdates.push({ entityId: 'player', amount: -manaCost });
        const CAST_TIME = 100;
        playerState.isCasting = true;
        this.eventBus.emit('AnimateRangedAttack', { entityId: 'player' });

        setTimeout(() => {
            const projectile = this.entityManager.createEntity(`projectile_${this.utilities.generateUniqueId()}`);
            this.entityManager.addComponentToEntity(projectile.id, new PositionComponent(playerPos.x, playerPos.y));
            this.entityManager.addComponentToEntity(projectile.id, new LastPositionComponent(0, 0));
            this.entityManager.addComponentToEntity(projectile.id, new ProjectileComponent(direction, range, 'player', weapon, isPiercing));
            this.entityManager.addComponentToEntity(projectile.id, new MovementSpeedComponent(320)); // 320 pixels/second (was 32 pixels every 100 ms)
            this.entityManager.addComponentToEntity(projectile.id, new HitboxComponent(24, 24));
            this.entityManager.addComponentToEntity(projectile.id, new VisualsComponent(32, 32));
            const visuals = this.entityManager.getEntity(projectile.id).getComponent('Visuals');
            visuals.avatar = 'img/avatars/projectile.png';
            visuals.offsetX = 8; visuals.offsetY = 8;
            this.entityManager.addComponentToEntity(projectile.id, new NeedsRenderComponent(playerPos.x, playerPos.y));
            this.eventBus.emit('LightSourceActivated', ({ type: 'firebolt', entityId: projectile.id }));
            playerState.isCasting = false;
        }, CAST_TIME);
    }

    initiateRangedAttack({ entityId, direction }) {
        console.log('CombatSystem: initiateRangedAttack called with source:', entityId, 'and direction:', direction);
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        if (gameState?.gameOver) return;

        const source = this.entityManager.getEntity(entityId);
        if (!source) return;
        if (source.hasComponent('Dead')) return;
        const rangedAttack = source.getComponent('RangedAttack');
        if (!rangedAttack) return;

        
        let sourceState = null;
        if (source.hasComponent('PlayerState')) {
            sourceState = source.getComponent('State');
            if (sourceState?.isCasting) return;
            sourceState.isCasting = true;
            if (rangedAttack.manaCost && rangedAttack.manaCost > 0) {
                const mana = source.getComponent('Mana');
                if (!mana || mana.mana < rangedAttack.manaCost) {
                    this.utilities.logMessage({ channel: 'combat', message: `${source.id} does not have enough mana to cast ${rangedAttack.name}` });
                    return;
                }
                this.manaUpdates.push({ entityId, amount: -rangedAttack.manaCost });
            }
        }

        const combat = source.getComponent('InCombat');
        if (!combat) {
            source.addComponent(new InCombatComponent(3000));
            this.utilities.logMessage({ channel: 'combat', message: `${source.id} enters combat by casting ${rangedAttack.name}!` });
        } else {
            combat.elapsed = 0; // Reset to extend 3s
        }

        const sourcePos = source.getComponent('Position');
        const range = rangedAttack.range || 3;
        const isPiercing = rangedAttack.piercing || false;

        this.sfxQueue.push({ sfx: rangedAttack.sfx || 'firecast0', volume: .25 });
        const CAST_TIME = rangedAttack.castTime || 100;

        if (source.hasComponent('Animation') && source.hasComponent('AnimationState')) {
            this.eventBus.emit('AnimateRangedAttack', { entityId });
        }
        
        setTimeout(() => {
            const projectile = this.entityManager.createEntity(`projectile_${this.utilities.generateUniqueId()}`);
            this.entityManager.addComponentToEntity(projectile.id, new PositionComponent(sourcePos.x, sourcePos.y));
            this.entityManager.addComponentToEntity(projectile.id, new LastPositionComponent(0, 0));
            this.entityManager.addComponentToEntity(projectile.id, new ProjectileComponent(direction, range, entityId, rangedAttack.weapon, isPiercing));
            this.entityManager.addComponentToEntity(projectile.id, new MovementSpeedComponent(rangedAttack.projectileSpeed || 288));
            this.entityManager.addComponentToEntity(projectile.id, new HitboxComponent(24, 24));
            this.entityManager.addComponentToEntity(projectile.id, new VisualsComponent(32, 32));
            const visuals = this.entityManager.getEntity(projectile.id).getComponent('Visuals');
            visuals.avatar = rangedAttack.projectileAvatar || 'img/avatars/projectile.png';
            console.warn(`CombatSystem: initiateRangedAttack - projectile visuals component set to ${visuals}`);
            visuals.offsetX = 8; visuals.offsetY = 8;
            this.entityManager.addComponentToEntity(projectile.id, new NeedsRenderComponent(sourcePos.x, sourcePos.y));
            this.eventBus.emit('LightSourceActivated', { type: rangedAttack.lightSourceType || 'default', entityId: projectile.id });
            if(sourceState)sourceState.isCasting = false;
        }, CAST_TIME);
    }

    combatFlagging({attacker, target }) {

        const attackerInCombat = attacker.getComponent('InCombat');
        if (!attackerInCombat) {
            attacker.addComponent(new InCombatComponent(3000));
        } else {
            attackerInCombat.elapsed = 0; // Reset to extend 3s from now
        }

        const targetInCombat = target.getComponent('InCombat');
        if (!targetInCombat) {
            target.addComponent(new InCombatComponent(3000));
        } else {
            targetInCombat.elapsed = 0; // Reset to extend 3s from now
        }

        switch ('player') {
            case attacker:
                //this.eventBus.emit('LogMessage', { message: `You enter combat with ${target.getComponent('MonsterData').name}!` });
                this.utilities.logMessage({ channel: 'combat', message: `You enter combat with ${target.getComponent('MonsterData').name}!` });
                //console.log(`${ target.getComponent('MonsterData').name } enters combat after being hit by player`)
                break;
            case target:
                //this.eventBus.emit('LogMessage', { message: `${attacker.getComponent('MonsterData').name} enters combat with you!` });
                this.utilities.logMessage({ channel: 'combat', message: `${attacker.getComponent('MonsterData').name} enters combat with you!` });
                //console.log(`${attacker.getComponent('MonsterData').name } Initiates combat by attacking player}`)
                break;
            default:
                break;
        }

    }
}
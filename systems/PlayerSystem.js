// systems/PlayerSystem.js - Updated
import { System } from '../core/Systems.js';

export class PlayerSystem extends System {
    constructor(entityManager, eventBus, utilities) {
        super(entityManager, eventBus, utilities);
        this.requiredComponents = ['PlayerState', 'Stats', 'Health', 'Mana', 'Inventory', 'Resource'];
    }

    init() {
        this.sfxQueue = this.entityManager.getEntity('gameState').getComponent('AudioQueue').SFX || []
        this.queues = this.entityManager.getEntity('gameState').getComponent('DataProcessQueues') || {};
        this.healthUpdates = this.queues.HealthUpdates || [];
        this.manaUpdates = this.queues.ManaUpdates || [];
        this.eventBus.on('InitializePlayer', () => this.initializePlayer());
        this.eventBus.on('GearChanged', (data) => this.updateGearStats(data.entityId));
        this.eventBus.on('AwardXp', (data) => this.awardXp(data));
        this.eventBus.on('PlayerDeath', (data) => this.death(data));
        this.eventBus.on('PlayerExit', () => this.exit());
        this.eventBus.on('TilesDiscovered', (data) => this.handleTilesDiscovered(data));
        this.eventBus.on('AllocateStat', (data) => this.handleStatAllocation(data));
        this.eventBus.on('ModifyBaseStat', (data) => this.modifyBaseStat(data));

    }

    exitCombat(entityId) {
        const player = this.entityManager.getEntity(entityId);
        if (!player) return;
        const playerState = player.getComponent('PlayerState');
        if (playerState.isInCombat) {
            playerState.isInCombat = false;
            this.eventBus.emit('LogMessage', { message: 'You are no longer in combat.' });
        }
    }

    initializePlayer() {
        const player = this.entityManager.getEntity('player');
        const visuals = player.getComponent('Visuals');
        visuals.avatar = 'img/avatars/player.png'; // Set the avatar image for the player
        const stats = player.getComponent('Stats');
        stats._internal.base.intellect = this.utilities.dRoll(3, 1, 8);
        stats._internal.base.prowess = this.utilities.dRoll(3, 1, 8);
        stats._internal.base.agility = this.utilities.dRoll(3, 1, 8);
        stats._internal.base.luck = 0;
        stats._internal.base.maxHp = 30
        stats._internal.base.maxMana = 10
        stats._internal.base.movementSpeed = 100; // Default movement speed

        stats._internal.temp = {
            intellect: 0,
            prowess: 0,
            agility: 0,
            luck: 0,
            maxHp: 0,
            maxMana: 0,
            movementSpeed: 0,
            armor: 0,
            defense: 0,
            block: 0,
            dodge: 0,
            range: 0,
            resistMagic: 0,
            baseRange: 0,
            damageBonus: 0,
            meleeBonus: 0,
            rangedBonus: 0,
            maxLuck: 0
        };

        stats.intellect = stats._internal.base.intellect;
        stats.prowess = stats._internal.base.prowess;
        stats.agility = stats._internal.base.agility;
        stats.luck = stats._internal.base.luck;
        stats.maxHp = stats._internal.base.maxHp;
        stats.maxMana = stats._internal.base.maxMana;
        stats.movementSpeed = stats._internal.base.movementSpeed;
        stats.unallocated = 3;

        const health = player.getComponent('Health');
        health.hp = stats.maxHp;
        health.maxHp = stats.maxHp;

        const mana = player.getComponent('Mana');
        mana.mana = stats.maxMana;
        mana.maxMana = stats.maxMana;

        const playerState = player.getComponent('PlayerState');
        playerState.xp = 0;
        playerState.level = 1;
        playerState.nextLevelXp = 135;
        playerState.dead = false;
        playerState.lampLit = false;
        playerState.name = "Zukarii";

        const resource = player.getComponent('Resource');
        resource.torches = 1;
        resource.healPotions = 1;
        resource.gold = 100;
        resource.potionDropFail = 0;
        resource.torchDropFail = 0;

        const inventory = player.getComponent('Inventory');

        this.getRandomStartItems().then(startItems => {
            inventory.items = startItems.map(item => ({ ...item, uniqueId: this.utilities.generateUniqueId() }));
        });

        this.calculateStats(player);
    }

    getRandomStartItems() {
        const randomStartItemTierIndex = Math.random() < 0.5 ? 0 : 1;
        const partialItems = [
            { tierIndex: randomStartItemTierIndex },
            { tierIndex: 0, type: 'armor' },
            { tierIndex: 0, type: 'weapon', attackType: 'ranged' },
            { tierIndex: 0, type: 'weapon', attackType: 'melee' }
        ];

        return Promise.all(partialItems.map(partialItem => {
            return new Promise((resolve) => {
                this.eventBus.emit('GenerateROGItem', {
                    partialItem,
                    dungeonTier: 0,
                    callback: (item) => {
                        if (item) {
                            resolve(item);
                        } else {
                            console.warn('Failed to generate start item for partialItem:', partialItem);
                            resolve(null);
                        }
                    }
                });
            });
        })).then(items => items.filter(item => item !== null));
    }

    handleStatAllocation({ stat }) {
        const player = this.entityManager.getEntity('player');
        const stats = player.getComponent('Stats');

        // Check if allocation is allowed
        if (stats.unallocated <= 0 || stats.isLocked) {
            return;
        }

        // Decrement unallocated points and increment the stat
        stats.unallocated--;
        stats._internal.incremented[stat]++;

        // Update live stats and sync HealthComponent/ManaComponent
        this.calculateStats(player);

        // Lock allocation if no points remain
        if (stats.unallocated === 0) {
            stats.isLocked = true;
        }

        this.eventBus.emit('LogMessage', { message: `+1 to ${this.utilities.camelToTitleCase(stat)}! Now ${stats[stat]}.` });
    }

    modifyBaseStat({ stat, value }) {
        const player = this.entityManager.getEntity('player');
        const stats = player.getComponent('Stats');

        // Log the modification for debugging
        //console.log(`PlayerSystem.js: modifyBaseStat - Modifying stat ${stat} by ${value}`);

        // Update the specified stat in _internal.base
        if (stat in stats._internal.base) {
            stats._internal.base[stat] += value;
        } else {
            console.warn(`Attempted to modify unknown base stat: ${stat}`);
            return;
        }

        // Update live stats and sync HealthComponent/ManaComponent
        this.calculateStats(player);

        // Emit a log message for feedback
        this.eventBus.emit('LogMessage', { message: `Base ${this.utilities.camelToTitleCase(stat)} permanently modified by ${value}!` });
    }

    updateGearStats(entityId) {
        const player = this.entityManager.getEntity(entityId);
        const stats = player.getComponent('Stats');
        const inventory = player.getComponent('Inventory');

        stats._internal.gear = {
            intellect: 0, prowess: 0, agility: 0, maxHp: 0, maxMana: 0,
            armor: 0, defense: 0, block: 0, dodge: 0, range: 0, resistMagic: 0, baseRange: 0,
            damageBonus: 0, meleeBonus: 0, rangedBonus: 0, luck: 0, maxLuck: 0, movementSpeed: 0
        };

        Object.values(inventory.equipped).forEach(item => {
            if (!item) return;
            if (['armor', 'head', 'gloves'].includes(item.type)) {
                stats._internal.gear.armor += item.armor || 0;
            };
            if (item.type === 'weapon' && item.attackType === 'melee') stats._internal.gear.block += item.baseBlock || 0;
            if (item.type === 'weapon' && item.attackType === 'ranged') stats._internal.gear.range = Math.max(stats._internal.gear.range || 0, item.baseRange || 0);
            if (item.type === 'boots') stats._internal.gear.movementSpeed += item.baseMovementSpeed || 0 ;
            if (item.stats) {
                Object.entries(item.stats).forEach(([stat, value]) => {
                    stats._internal.gear[stat] = (stats._internal.gear[stat] || 0) + (value || 0);
                });
            }
        });

        this.calculateStats(player);
    }

    calculateStats(player) {
        const playerState = player.getComponent('PlayerState');
        const stats = player.getComponent('Stats');
        const health = player.getComponent('Health');
        const mana = player.getComponent('Mana');
        const movementSpeedComp = player.getComponent('MovementSpeed');

        stats.intellect = stats._internal.base.intellect + (stats._internal.incremented.intellect || 0)
            + (stats._internal.gear.intellect || 0) + (stats._internal.temp.intellect || 0);
        stats.prowess = stats._internal.base.prowess + (stats._internal.incremented.prowess || 0)
            + (stats._internal.gear.prowess || 0) + (stats._internal.temp.prowess || 0);
        stats.agility = stats._internal.base.agility + (stats._internal.incremented.agility || 0)
            + (stats._internal.gear.agility || 0) + (stats._internal.temp.agility || 0);

        const combinedProwess = stats._internal.base.prowess + (stats._internal.incremented.prowess || 0);
        const combinedIntellect = stats._internal.base.intellect + (stats._internal.incremented.intellect || 0);

        const levelCount = Math.max(0, playerState.level - 1); // Number of increases (e.g., level 10 -> 9 increases)
        const levelHpIncrease = levelCount > 0 ? (levelCount / 2) * ((6 + 2) + (6 + playerState.level)) : 0; // Sum of 8 to (6 + level)
        const levelMpIncrease = levelCount > 0 ? (levelCount / 3) * ((2 + 2) + (3 + playerState.level)) : 0; // Sum of 4 to (2 + level)

        const baseMaxHp = stats._internal.base.maxHp + Math.round(levelHpIncrease);
        const baseMaxMana = stats._internal.base.maxMana + Math.round(levelMpIncrease);

        // Apply Prowess/Intellect multipliers to the whole number (baseMaxHp, baseMaxMana)
        const oldMaxHp = health.maxHp || baseMaxHp;
        stats.maxHp = Math.round(baseMaxHp * (1 + combinedProwess * 0.025)) + (stats._internal.gear.maxHp || 0) + (stats._internal.temp.maxHp || 0);
        health.maxHp = stats.maxHp;
        if (oldMaxHp !== 0 && health.maxHp !== oldMaxHp) {
            health.hp = Math.round(health.hp * (health.maxHp / oldMaxHp));
            health.hp = Math.max(1, Math.min(health.hp, health.maxHp));
        }

        const oldMaxMana = mana.maxMana || baseMaxMana;
        stats.maxMana = Math.round(baseMaxMana * (1 + combinedIntellect * 0.005)) + (stats._internal.gear.maxMana || 0) + (stats._internal.temp.maxMana || 0);
        mana.maxMana = stats.maxMana;
        if (oldMaxMana !== 0 && mana.maxMana !== oldMaxMana) {
            mana.mana = Math.round(mana.mana * (mana.maxMana / oldMaxMana));
            mana.mana = Math.max(1, Math.min(mana.mana, mana.maxMana));
            mana.manaRegen = combinedIntellect * .2;
        }

        stats.armor = (stats._internal.gear.armor || 0) + (stats._internal.temp.armor || 0);
        stats.defense = (stats._internal.gear.defense || 0) + (stats._internal.temp.defense || 0);
        stats.block = (stats._internal.gear.block || 0) + (stats._internal.temp.block || 0);
        stats.dodge = (stats._internal.gear.dodge || 0) + (stats._internal.temp.dodge || 0);
        stats.range = (stats._internal.gear.range || 0) + (stats._internal.temp.range || 0);
        stats.resistMagic = (stats._internal.gear.resistMagic || 0) + (stats._internal.temp.resistMagic || 0);
        stats.baseRange = (stats._internal.gear.baseRange || 0) + (stats._internal.temp.baseRange || 0);
        stats.damageBonus = (stats._internal.gear.damageBonus || 0) + (stats._internal.temp.damageBonus || 0);
        stats.meleeBonus = (stats._internal.gear.meleeBonus || 0) + (stats._internal.temp.meleeBonus || 0);
        stats.rangedBonus = (stats._internal.gear.rangedBonus || 0) + (stats._internal.temp.rangedBonus || 0);
        stats.luck = stats._internal.base.luck + (stats._internal.gear.luck || 0) + (stats._internal.temp.luck || 0);
        stats.maxLuck = (stats._internal.gear.maxLuck || 0) + (stats._internal.temp.maxLuck || 0);

        stats._internal.base.movementSpeed = isNaN(stats._internal.base.movementSpeed) ? 100 : stats._internal.base.movementSpeed;
        const movementSpeed = stats._internal.base.movementSpeed + (stats._internal.gear.movementSpeed || 0) + (stats._internal.temp.movementSpeed || 0);
        stats.movementSpeed =  movementSpeed;
        console.warn(`PlayerSystem.js: calculateStats - Calculated movementSpeed: ${stats.movementSpeed}`);
        // Update MovementSpeedComponent
        movementSpeedComp.movementSpeed = stats.movementSpeed;

        this.eventBus.emit('StatsUpdated', { entityId: player.id });
        this.eventBus.emit('PlayerStateUpdated', { entityId: 'player' });
    }

    awardXp({ amount }) {
        const player = this.entityManager.getEntity('player');
        const playerState = player.getComponent('PlayerState');
        playerState.xp += amount;
        this.eventBus.emit('LogMessage', { message: `Gained ${amount} XP (${playerState.xp}/${playerState.nextLevelXp})` });
        this.checkLevelUp(player);
        this.eventBus.emit('PlayerStateUpdated', { entityId: player.id });
    }

    checkLevelUp(player) {
        const playerState = player.getComponent('PlayerState');
        const playerHealth = player.getComponent('Health');
        const playerMana = player.getComponent('Mana');
        const stats = player.getComponent('Stats');
        let statAllocationMessage = '';
        let levelUp = false;
        while (playerState.xp >= playerState.nextLevelXp) {
            const newXp = playerState.xp - playerState.nextLevelXp;
            playerState.level++;
            levelUp = true

            if (playerState.level % 2 === 0) {
                stats.unallocated++;
                stats.isLocked = false; // Unlock allocation
                statAllocationMessage = ', Gained 1 stat point to allocate!';
            }

            playerState.xp = newXp;
            const x = playerState.level - 1;

            playerState.nextLevelXp = Math.round(playerState.nextLevelXp * this.getXpMultiplier(x));

            this.sfxQueue.push({ sfx: 'ding', volume: .05 });
            this.eventBus.emit('LogMessage', { message: `Level up! Now level ${playerState.level}, ${statAllocationMessage}` });
        }
        if (levelUp) {
            this.calculateStats(player);
            this.healthUpdates.push({ entityId: 'player', amount: stats.maxHp - playerHealth.hp, attackerId: 'player' });
            this.manaUpdates.push({ entityId: 'player', amount: stats.maxMana - playerMana.mana, attackerId: 'player' });
            this.eventBus.emit('StatsUpdated', { entityId: player.id });

        }
    }

    getXpMultiplier(x) {
        let value = 0;
        if (x <= 4) {
            value = 2.16 - (x * 0.16275);
        } else if (x <= 9) {
            value = 1.509 - (x * .0333);
        } else if (x <= 19) {
            value = 1.2093 - (x * .0042);
        } else if (x <= 29) {
            value = 1.1295 + (x * .005);
        } else if (x <= 40) {
            value = 1.2745 + (x * .0046105);
        }

        if (x > 19 && value > 1.5) { value = 1.5; }

        return value;
    }

    death({ source }) {
        const player = this.entityManager.getEntity('player');
        const health = player.getComponent('Health');
        const playerState = player.getComponent('PlayerState');
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');

        health.hp = 0;
        playerState.dead = true;
        gameState.gameOver = true;

        this.eventBus.emit('LogMessage', { message: 'You died! Game Over.' });
        this.eventBus.emit('GameOver', { message: `You have been killed by a ${source}!` });
        this.eventBus.emit('StatsUpdated', { entityId: 'player' });
    }

    exit() {
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        this.eventBus.emit('LogMessage', { message: 'You exited the dungeon! Game Over.' });
        gameState.gameOver = true;
        this.eventBus.emit('GameOver', { message: 'You exited the dungeon! Too much adventure to handle eh?' });
        this.eventBus.emit('StatsUpdated', { entityId: 'player' });
    }

    handleTilesDiscovered({ count, total }) {
        const player = this.entityManager.getEntity('player');
        const playerState = player.getComponent('PlayerState');

        const xpThreshold = 1000;
        const previousTotal = total - count;
        const previousMilestones = Math.floor(previousTotal / xpThreshold);
        const currentMilestones = Math.floor(total / xpThreshold);

        if (currentMilestones > previousMilestones) {
            const xpAward = (currentMilestones - previousMilestones) * 100 * playerState.level;
            this.eventBus.emit('AwardXp', { amount: xpAward });
            this.eventBus.emit('LogMessage', { message: `Exploration milestone reached! Gained ${xpAward} XP for discovering ${currentMilestones * xpThreshold} tiles.` });
        }
    }
}
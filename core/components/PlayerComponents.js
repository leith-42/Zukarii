// core/components/PlayerComponents.js
// Defines player-related components
export class StatsComponent {
    constructor({
        unallocated = 0, intellect = 0, prowess = 0, agility = 0, maxHp = 0, maxMana = 0,
        armor = 0, defense = 0, block = 0, dodge = 0, range = 0, resistMagic = 0, baseRange = 0,
        damageBonus = 0, meleeBonus = 0, rangedBonus = 0, luck = 0, maxLuck = 0 , movementSpeed = 0,baseMovementSpeed =0
    } = {}) {
        this.type = 'Stats';
        this.unallocated = unallocated;
        this.intellect = intellect;
        this.prowess = prowess;
        this.agility = agility;
        this.maxHp = maxHp;
        this.maxMana = maxMana;
        this.armor = armor;
        this.defense = defense;
        this.block = block;
        this.dodge = dodge;
        this.range = range;
        this.resistMagic = resistMagic;
        this.baseRange = baseRange;
        this.damageBonus = damageBonus;
        this.meleeBonus = meleeBonus;
        this.rangedBonus = rangedBonus;
        this.luck = luck;
        this.maxLuck = maxLuck;
        this.movementSpeed = movementSpeed;
        this.baseMovementSpeed = baseMovementSpeed;
        this.isLocked = false;

        this._internal = {
            base: {
                intellect: 0, prowess: 0, agility: 0, maxHp: 0, maxMana: 0,
                armor: 0, defense: 0, block: 0, dodge: 0, range: 0, resistMagic: 0, baseRange: 0,
                damageBonus: 0, meleeBonus: 0, rangedBonus: 0, luck: 0, maxLuck: 0, movementSpeed: 0
            },
            gear: {
                intellect: 0, prowess: 0, agility: 0, maxHp: 0, maxMana: 0, baseMovementSpeed: 0,
                armor: 0, defense: 0, block: 0, dodge: 0, range: 0, resistMagic: 0, baseRange: 0,
                damageBonus: 0, meleeBonus: 0, rangedBonus: 0, luck: 0, maxLuck: 0, movementSpeed: 0
            },
            temp: {
                intellect: 0, prowess: 0, agility: 0, maxHp: 0, maxMana: 0, baseMovementSpeed: 0,
                armor: 0, defense: 0, block: 0, dodge: 0, range: 0, resistMagic: 0, baseRange: 0,
                damageBonus: 0, meleeBonus: 0, rangedBonus: 0, luck: 0, maxLuck: 0, movementSpeed: 0
            },
            incremented: {
                intellect: 0, prowess: 0, agility: 0
            }
        };
    }
}
export class InventoryComponent {
    constructor({
        equipped = {},
        items = []
    } = {}) {
        this.type = 'Inventory';
        this.equipped = equipped; // { slot: item }
        this.items = items;       // Array of item objects
    }
}

export class ResourceComponent {
    constructor({
        torches = 0,
        healPotions = 0,
        gold = 0,
        potionDropFail = 0,
        torchDropFail = 0,
        portalBinding = 0,
        craftResources = {
            ashenShard: 0,
            ashenCrystal: 0,
            ashenGem: 0,
            sylduranShard: 0,
            sylduranCrystal: 0,
            sylduranGem: 0
        }
    } = {}) {
        this.type = 'Resource';
        this.torches = Number(torches) || 0;
        this.healPotions = Number(healPotions) || 0;
        this.gold = Number(gold) || 0;
        this.potionDropFail = Number(potionDropFail) || 0;
        this.torchDropFail = Number(torchDropFail) || 0;
        this.portalBinding = Number(portalBinding) || 0;
        // Deep-copy and validate craftResources
        this.craftResources = {
            ashenShard: Number(craftResources.ashenShard) || 0,
            ashenCrystal: Number(craftResources.ashenCrystal) || 0,
            ashenGem: Number(craftResources.ashenGem) || 0,
            sylduranShard: Number(craftResources.sylduranShard) || 0,
            sylduranCrystal: Number(craftResources.sylduranCrystal) || 0,
            sylduranGem: Number(craftResources.sylduranGem) || 0
        };
    }
}
export class PlayerStateComponent {
    constructor({
        name = "",
        level = 1,
        xp = 0,
        nextLevelXp = 0,
        dead = false,
        lampLit = false,
        discoveredTileCount = 0,
        isInCombat = false,
        
    } = {}) {
        this.type = 'PlayerState';
        this.name = name;
        this.level = level;
        this.xp = xp;
        this.nextLevelXp = nextLevelXp;
        this.dead = dead;
        this.lampLit = lampLit;
        this.discoveredTileCount = discoveredTileCount;
        this.isInCombat = isInCombat;
    }
}
export class InputStateComponent {
    constructor({
        keys = {} // e.g., { ArrowUp: true, ArrowLeft: true }
    } = {}) {
        this.type = 'InputState';
        this.keys = keys;
    }
}

export class NewCharacterComponent {
    constructor({
        name = "",
        level = 1,
        xp = 0,
        nextLevelXp = 0,
        dead = false,
        lampLit = false,
        discoveredTileCount = 0,
        isInCombat = false
    } = {}) {
        this.type = 'NewCharacter';
        this.name = name;
        this.level = level;
        this.xp = xp;
        this.nextLevelXp = nextLevelXp;
        this.dead = dead;
        this.lampLit = lampLit;
        this.discoveredTileCount = discoveredTileCount;
        this.isInCombat = isInCombat;
    }
}

export class JourneyStateComponent {
    constructor() {
        this.type = 'JourneyState';
        this.completedPaths = []; // Array of completed path data (e.g., [{ id: 'whisper_1', parentId: 'master_whispers', title: 'The First Descent', completedAt: '2025-05-03', completionText: '...' }])
        this.pathTree = new Map(); // Map<parentId, JourneyPathComponent[]> (parentId to child path components)
    }
}

export class ShopInteractionComponent {
    constructor() {
        this.type = 'ShopInteraction';
        this.active = true; // Flag to indicate an active shop interaction
        // Future expansion: Add properties like transactionHistory, activeShopNpc, etc.
    }
    
}

export class HotBarIntentComponent {
    constructor(hotBarActions = []) {
        this.type = 'HotBarIntent';
        this.hotBarActions = hotBarActions; // Array of hotbar intents, e.g., [{ slot: 1, action: 'use', target: 'itemId' }]
    }
}

export class HotBarSkillMapComponent {
    constructor(skillMap = {}) {
        this.type = 'HotBarSkillMap';
        this.skillMap = skillMap; // e.g., { 1: 'fireball', 2: 'heal' }
    }

}

export class HotBarActionIntentComponent {
    constructor() {
        this.type = 'HotBarActionIntent';
        this.actionIntents = []; // Array of skill intents, e.g., [{ skillId, slot, params }]
    }
}

export class SkillIntentComponent {
    constructor() {
        this.type = 'SkillIntent';
        this.intents = []; // Array of skill intents, e.g., [{ skillId, slot, params }]
    }
}

export class PlayerActionQueueComponent {
    constructor() {
        this.type = 'PlayerActionQueue';
        this.actions = []; // [{ type: string, data: object, timestamp: number }]
    }
}

export class PlayerAchievementsComponent {
    constructor() {
        this.type = 'PlayerAchievements';
        this.stats = {
            monstersKilled: 0,
            bossesKilled: 0,
            itemsUsed: 0,
            potionsUsed: 0,
            resourcesCollected: { ashenShard: 0, sylduranShard: 0,},
            itemsCollected: 0,
            interactions: 0,
            tiersReached: 0,  
            uniqueItemDrops: [],
            unlockedPortals:[]
        };
        this.history = []; // [{ type: string, data: object, timestamp: number }]
    }
}


export class JourneyRewardComponent {
    constructor() {
        this.type = 'JourneyReward';
        this.rewards = []; // Array of rewards
    }
}

export class PortalBindingComponent {
    constructor({ bindings = [], cleansed = [] } = {}) {
        this.type = 'PortalBinding';
        this.bindings = bindings; // Array of portal bindings
        this.cleansed = cleansed;
    }
}

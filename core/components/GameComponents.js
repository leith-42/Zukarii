// core/components/GameComponents.js - Updated
export class UIComponent {
    constructor({
        overlayOpen = false,
        activeTab = 'log',
        logEntries = [],
        maxLogEntries = 60,
    } = {}) {
        this.type = 'UI';
        this.overlayOpen = overlayOpen;
        this.activeTab = activeTab;
        this.logEntries = logEntries;
        this.maxLogEntries = maxLogEntries;
    }
}

export class MouseTargetComponent {
    constructor(targetX, targetY) {
        this.type = 'MouseTarget';
        this.targetX = targetX;
        this.targetY = targetY;
    }
}

export class MouseActionTargetComponent {
    constructor(targetX = 0, targetY = 0, entityId = null, direction = { dx: 0, dy: 0 }) {
        this.type = 'MouseActionTarget';
        this.targetX = targetX;
        this.targetY = targetY;
        this.entityId = entityId; // ID of the entity being hovered over (if any)
        this.direction = direction; // Normalized direction vector from the player to the target
    }
}

export class OverlayStateComponent {
    constructor({
        isOpen = false,
        activeTab = null,
        logMessages = [],
        activeMenuSection = 'controls-button' // Add this property
    } = {}) {
        this.type = 'OverlayState';
        this.isOpen = isOpen;           // Boolean: Whether the overlay is open
        this.activeTab = activeTab;     // String: The currently active tab ('menu', 'log', 'character', or null)
        this.logMessages = logMessages; // Array: List of log messages
        this.activeMenuSection = activeMenuSection; // Persist the active menu
    }
}

export class RenderStateComponent {
    constructor({
        activeRenderZone = new Set(),
        redrawTiles = new Set(), // set of tiles to be added to activeRenderZone at next render (old moster positions)
        projectile = null,
        torchLitOnTurn = false,
        renderRadius = 6
    } = {}) {
        this.type = 'RenderState';
        this.activeRenderZone = activeRenderZone;
        this.redrawTiles = redrawTiles; 
        this.projectile = projectile;
        this.torchLitOnTurn = torchLitOnTurn;
        this.renderRadius = renderRadius;
    }
}
 
export class GameStateComponent {
    constructor({
        tier = 0,
        highestTier = 0,
        gameStarted = false,
        gameOver = false,
        isVictory = false,
        isRangedMode = false,
        transitionLock = false,
        needsRender = false,
        needsInitialRender = false
    } = {}) {
        this.type = 'GameState';
        this.tier = tier;
        this.highestTier = highestTier;
        this.gameStarted = gameStarted;
        this.gameOver = gameOver;
        this.isVictory = isVictory;
        this.isRangedMode = isRangedMode;
        this.transitionLock = transitionLock;
        this.needsRender = needsRender;
        this.needsInitialRender = needsInitialRender;
    }
}

export class GameOptionsComponent {
    constructor({
        soundEnabled = true,
        globalVolume = 1, // Global audio volume
    } = {}) {
        this.type = 'GameOptions';
        soundEnabled = soundEnabled; // Boolean: Whether sound is enabled
        this.globalVolume = globalVolume; // Global audio volume
    }
}
export class ProjectileComponent {
    constructor(direction, rangeLeft, sourceEntityId, weapon = null, isPiercing = false) {
        this.type = 'Projectile';
        this.direction = direction;
        this.rangeLeft = rangeLeft;
        this.sourceEntityId = sourceEntityId;
        this.weapon = weapon;
        this.isPiercing = isPiercing;
        this.removeAfterRender = false; // Flag to indicate if the projectile should be removed after rendering
        this.finalRenderApplied = false; // Flag to indicate if the final render has been applied
    }
}

export class LootSourceData {
    constructor({ sourceType = "unknown", name = "Unknown", tier = 0, position = { x: 0, y: 0 }, sourceDetails = {}, chanceModifiers = {}, maxItems = 1, items = [] } = {}) {
        this.type = 'LootSourceData';
        this.sourceType = sourceType;
        this.name = name;
        this.tier = tier;
        this.position = position;
        this.sourceDetails = sourceDetails;
        this.chanceModifiers = {
            torches: chanceModifiers.torches || 1,
            healPotions: chanceModifiers.healPotions || 1,
            gold: chanceModifiers.gold || 1,
            item: chanceModifiers.item || 1,
            uniqueItem: chanceModifiers.uniqueItem || 1
        };
        this.maxItems = maxItems;
        this.items = items;
    }
}

export class LootData {
    constructor({
        name = "Loot Pile",
        gold = 0,
        torches = 0,
        healPotions = 0,
        items = [],
        stones = {},
        suppressRender = false
    } = {}) {
        this.type = 'LootData';
        this.name = name;
        this.gold = gold;
        this.torches = torches;
        this.healPotions = healPotions;
        this.items = items;
        this.stones = stones;
        this.suppressRender = suppressRender;
    }
}

export class RenderControlComponent {
    constructor({
        locked = false
    } = {}) {
        this.type = 'RenderControl';
        this.locked = locked;
    }
}

// Add to GameComponents.js
export class LightingState {
    constructor({ isLit = false, expiresOnTurn = 0, visibleRadius = 2 } = {}) {
        this.type = 'LightingState';
        this.isLit = isLit;
        this.expiresOnTurn = expiresOnTurn;
        this.visibleRadius = visibleRadius;
        this.remainingDuration = 0; // Number of turns left for the light source
    }
}

export class LightSourceDefinitions {
    constructor() {
        this.type = 'LightSourceDefinitions';
        this.definitions = {
            unlit: {
                visibilityEnabled: true,
                visibilityRadius: 3,
                visibilityOpacitySteps: [0.75, 0.15, 0],
                visibilityTintColor: 'rgba(255,255,255,0)',
                glowEnabled: false,
                glowType: 'outline',
                glowColor: 'rgba(255,255,255,0)',
                glowIntensity: 0,
                glowSize: 0,
                proximityFactor: 1.0,
                pulse: null
            },
            torch: {
                visibilityEnabled: true,
                visibilityRadius: 6,
                visibilityOpacitySteps: [0.85, 0.35, 0],
                visibilityTintColor: 'rgba(229,174,107,0.8 )', // Subtle yellow tint
                glowEnabled: true,
                glowType: 'environmental', // Environmental glow for torch
                glowColor: 'rgba(255,220,120,0.30)', // Used for environmental gradient
                glowIntensity: 1.0,
                glowSize: 0, // Not used for environmental glow
                proximityFactor: 1.0,
                pulse: null,
                duration: 300
            },
            lamp: {
                visibilityEnabled: true,
                visibilityRadius: 7,
                visibilityOpacitySteps: [0.75, 0.15, 0],
                visibilityTintColor: 'rgba(255,255,255,0.2)', // Subtle white tint
                glowEnabled: false, // No glow/outline for lamp
                glowType: 'outline',
                glowColor: 'rgba(255,255,255,0)',
                glowIntensity: 0,
                glowSize: 0,
                proximityFactor: 1.0,
                pulse: null,
                duration: 500
            },

            lootGlow: {
                visibilityEnabled: true,
                visibilityRadius: 1.5, // Small visibility radius
                visibilityOpacitySteps: [0.75, 0.25, 0],
                visibilityTintColor: 'rgba(255,215,0,1)', // Subtle gold tint
                glowEnabled: false,
                glowType: 'outline', // Outline glow for treasure chest
                glowColor: 'rgba(255,215,0,1)', // Bright gold glow
                glowIntensity: 1, // Bright glow
                glowSize: 3, // Medium-sized outline
                proximityFactor: 10, // Brighter when player is near
                pulse: { amplitude: 0.25, frequency: 0.5 } // Subtle pulsing
            },
            magic: { // Example for NPC on tier 0
                visibilityEnabled: true,
                visibilityRadius: 18, // Large visibility radius
                visibilityOpacitySteps: [0.95, 0.25, 0],
                visibilityTintColor: 'rgba(0,255,0,0.8)', // Subtle green tint
                glowEnabled: true,
                glowType: 'outline',
                glowColor: 'rgba(0,128,0,1)', // Green glow
                glowIntensity: .25, // Faint glow
                glowSize: 10, // Small outline
                proximityFactor: 1.5, // Slightly brighter when player is near
                pulse: null
            },
            portalGreen: { // Example for NPC on tier 0
                visibilityEnabled: true,
                visibilityRadius: 11, // medium visibility radius
                visibilityOpacitySteps: [0.75, 0.15, 0],
                visibilityTintColor: 'rgba(0,255,0,0.4)', // Subtle green tint
                glowEnabled: true,
                glowType: 'environmental',
                glowColor: 'rgba(0,255,0,1)', // Green glow
                glowIntensity: 1, // Faint glow
                glowSize: 15, // Small outline
                proximityFactor: 3, // Slightly brighter when player is near
                pulse: { amplitude: 0.3, frequency: 0.3 } // Strong pulsing
            },
            portalBlue: { 
                visibilityEnabled: true,
                visibilityRadius: 11, // Large visibility radius
                visibilityOpacitySteps: [0.75, 0.15, 0],
                visibilityTintColor: 'rgba(0,0,255,1)', // Strong Blue Tint
                glowEnabled: true,
                glowType: 'outline',
                glowColor: 'rgba(0,0,255,1)', // Green glow
                glowIntensity: 1, // Faint glow
                glowSize: 15, // Small outline
                proximityFactor: 3, // Slightly brighter when player is near
                pulse: { amplitude: 0.3, frequency: 0.3 } // Strong pulsing
            },
            elite: { // Example for elite monster
                visibilityEnabled: true, // No visibility effect
                visibilityRadius: 1,
                visibilityOpacitySteps: [0.75, 0.15, 0],
                visibilityTintColor: 'rgba(255,255,255,0)',
                glowEnabled: true,
                glowType: 'outline',
                glowColor: 'rgba(255,0,0,1)', // Red glow
                glowIntensity: 0.5, // Medium intensity
                glowSize: 8, // Medium outline
                proximityFactor: 1.0,
                pulse: null
            },
            boss: { // Example for boss
                visibilityEnabled: true, // No visibility effect
                visibilityRadius: 1.5,
                visibilityOpacitySteps: [0.75, 0.15, 0],
                visibilityTintColor: 'rgba(255,255,255,0)',
                glowEnabled: true,
                glowType: 'outline',
                glowColor: 'rgba(255,0,0,1)', // Red glow
                glowIntensity: 1.0, // High intensity
                glowSize: 12, // Large outline
                proximityFactor: 1.0,
                pulse: { amplitude: 0.3, frequency: 0.3 } // Strong pulsing
            },
            firebolt: {
                visibilityEnabled: true,
                visibilityRadius: 4, // Small visibility radius
                visibilityOpacitySteps: [0.75, 0.15, 0],
                visibilityTintColor: 'rgba(255,215,0,0.6)', 
                glowType: 'environmental', // Environmental glow for torch
                glowColor: 'rgba(255,220,120,0.35)', // Used for environmental gradient
                glowIntensity: 1, // Bright glow
                glowSize: 3, // Medium-sized outline
                proximityFactor: 10, // Brighter when player is near
                pulse: { amplitude: 0.25, frequency: 0.15 } // Subtle pulsing
            }
        };
    }
}

export class DataProcessQueues {
    constructor() {
        this.type = 'DataProcessQueues';
        this.HealthUpdates = [];
        this.ManaUpdates = [];
        
    }
}

export class AudioQueueComponent {
    constructor() {
        this.type = 'AudioQueue';
        this.SFX = []; // {sfx:'SfxName', volume: .1}
        this.TrackControl = []; // {track:'TrackName', play: true, volume: .1}
    }
}

export class LevelTransitionComponent {
    constructor(pendingTransition = null) {
        this.type = 'LevelTransition';
        this.pendingTransition = pendingTransition; // Indicates if a level transition is pending
        this.lastMovementDirection = { dx: 0, dy: 0 }
        this.destinationTier = null;
    }
}

export class ShopComponent {
    constructor({
        dialogueText = "Browse my wares!",
        shopType = "EquipmentShop",
        items = [],
        sellMultiplier = 3.0
    } = {}) {
        this.type = 'ShopComponent';
        this.dialogueText = dialogueText;
        this.shopType = shopType;
        this.items = items;
        this.sellMultiplier = sellMultiplier;
        this.lastRestockTime = null;
    }
}
export class JourneyPathsComponent {
    constructor() {
        this.type = 'JourneyPaths';
        this.paths = []; // Array of all journey paths loaded from journeyPaths.json
    }
}

export class OfferedJourneysComponent {
    constructor() {
        this.type = 'OfferedJourneys';
        this.journeys = []; // Array of offered journey objects { journeyId, offeredBy }
    }
}

export class JourneyUpdateQueueComponent {
    constructor() {
        this.type = 'JourneyUpdateQueue';
        this.queue = []; // [{ type: string, data: object, timestamp: number }]
    }
}

export class AchievementUpdateQueueComponent {
    constructor() {
        this.type = 'AchievementUpdateQueue';
        this.queue = []; // [{ type: string, data: object, timestamp: number }]
    }
}




// core/components/CommonComponents.js
// Defines components shared across multiple entity types in the Component-Based Architecture

export class PositionComponent {
    constructor(x = 0, y = 0) {
        this.type = 'Position';
        this.x = x;
        this.y = y;
    }
}

export class LastPositionComponent {
    constructor(x = 0, y = 0) {
        this.type = 'LastPosition';
        this.x = x;
        this.y = y;
    }
}
/////////////////////////////////////////////////////////////////////////
export class HitboxComponent {
    constructor(width = 1, height = 1, offsetX = 0, offsetY = 0) {
        this.type = 'Hitbox';
        this.width = width;
        this.height = height;
        this.offsetX = offsetX;
        this.offsetY = offsetY;
    }
}

export class MovementIntentComponent {
    constructor(targetX, targetY) {
        this.type = 'MovementIntent';
        this.targetX = targetX;
        this.targetY = targetY;
    }
}

export class WanderIntentComponent {
    constructor() {
        this.type = 'WanderIntent';
        this.targetX = null; // Target X coordinate for wandering
        this.targetY = null; // Target Y coordinate for wandering
        this.failedAttempts = 0; // Number of failed attempts to wander
        this.wanderTime = 0; // Time spent wandering
        this.wanderDuration = 0; // Duration of the wandering state
        this.wanderCooldown = 0; // Cooldown before next wander
        this.wanderCooldownDuration = 0; // Duration of the cooldown
        this.wanderTarget = null; // Target entity to wander towards, if any
        this.wanderTargetId = null; // ID of the target entity to wander towards
        this.wanderTargetType = null; // Type of the target entity to wander towards
        this.wanderTargetPosition = { x: 0, y: 0 };// Position of the target entity to wander towards
        this.wanderTargetPositionOffsetX = 0; // X offset from the target position
        this.wanderTargetPositionOffsetY = 0; // Y offset from the target position
        this.wanderTargetPositionOffset = { x: 0, y: 0 }; // Combined offset for target position
    }
}

export class CollisionComponent {
    constructor() {
        this.type = 'Collision';
        this.collisions = []; // Array to store collision details 
        this.nearbyEntities = []; // Entities within a certain range for collision checks
    }
}



////////////////////////////////////////////////////////////////////////////////////

export class VisualsComponent {
    constructor(h = 32, w = 32) {
        this.type = 'Visuals';
        this.avatar = null; // Placeholder for avatar image
        this.h = h;
        this.w = w;
        this.faceLeft = false; // Indicates if the entity is facing left
        this.direction = { dx: 1, dy: 0 }; // Default facing right
        this.animations = []
    }
}

export class HealthComponent {
    constructor(hp = 0, maxHp = 0 ) {
        this.type = 'Health';
        this.hp = hp;
        this.maxHp = maxHp;
        this.healthRegen = 0;
        this.updated = false; // Indicates if the health has been updated
    }
} 

export class HpBarComponent {
    constructor(fillPercent = 1, fillColor = 'green', lastFillPercent = 1, lastFillColor = 'green') {
        this.type = 'HpBar';
        this.fillColor = fillColor; // Color of the health bar
        this.fillPercent = fillPercent; // Percentage of health remaining (0 to 1)
        this.lastFillColor = lastFillColor; // Last color of the health bar
        this.lastFillPercent = lastFillPercent; // Last percentage of health remaining
        this.animationStartTime = null; // Timestamp when animation starts (ms)
        this.animationDuration = 500; // Duration of animation (ms)
        this.updated = false; // Indicates if the health bar has been updated
    }
}

export class ManaComponent {
    constructor(mana = 0, maxMana = 0, manaRegen = 0.25) {
        this.type = 'Mana';
        this.mana = mana;
        this.maxMana = maxMana;
        this.manaRegen = manaRegen;
        this.updated = false;
    }
}

export class AttackSpeedComponent {
    constructor(attackSpeed = 0) {
        this.type = 'AttackSpeed';
        this.attackSpeed = attackSpeed;
        this.elapsedSinceLastAttack = 0;
    }
}

export class InCombatComponent {
    constructor(duration = 3000) { // ms
        this.type = 'InCombat';
        this.duration = duration;
        this.elapsed = 0; 
    }
}

export class StairLockComponent { 
    constructor(duration = 1500) { // ms
        this.type = 'StairLock';
        this.duration = duration;
        this.elapsed = 0;
    }
}


export class MovementSpeedComponent {
    constructor(movementSpeed = 0) {
        this.type = 'MovementSpeed';
        this.movementSpeed = movementSpeed; // px per second
        this.elapsedSinceLastMove = 0; // Time since last move in ms
        this.combatSpeedMultiplier = 1; // Modifier for combat speed, default is 1 (no change)
        this.wanderSpeedMultiplier = 1; // Modifier for wandering speed, default is 1 (no change)
    }
}

export class AffixComponent {
    constructor(affixes = []) {
        this.type = 'Affix';
        this.affixes = affixes; // Array of { type, trigger, effect, params }
    }
}

export class DeadComponent {
    constructor(expiresAt) { // Absolute expiry time in ms
        this.type = 'Dead';
        this.expiresAt = expiresAt; // Set by system
        this.state = 'new'; 
    }
}


export class NeedsRenderComponent {
    constructor(x = 0, y = 0) {
        this.type = 'NeedsRender';
        this.x = x;
        this.y = y;
    }
}

export class RemoveEntityComponent {
    constructor() {
        this.type = 'RemoveEntity';
        this.remove = true;
    }
}

export class JourneyPathComponent {
    constructor() {
        this.type = 'JourneyPath';
        this.paths = []; // Array of path objects, each mirroring the previous JourneyPathComponent structure
    }
} 


export class AnimationStateComponent {
    constructor() {
        this.type = 'AnimationState';
        this.isIdle = true;
        this.isWalking = false;
        this.isAttacking = false;
    }
}

export class AnimationComponent {
    constructor() {
        this.type = 'Animation';
        this.animations = {};
        this.currentAnimation = 'idle';
        this.currentFrame = 0;
        this.frameTimer = 0;
        this.spriteSheets = {};
    }
}

export class NPCDataComponent {
    constructor(id, name, greeting) {
        this.type = 'NPCData';
        this.id = id; // e.g., "zu_master"
        this.name = name; // e.g., "Zu Master"
        this.greeting = greeting; // e.g., "Hello Zukarii"
    }
}

export class DialogueComponent {
    constructor(npcId = '', text = '', options = [], isOpen = false) {
        this.type = 'Dialogue';
        this.npcId = npcId;
        this.text = text;
        this.options = options; // [{ label: string, action: string, params: object }]
        this.isOpen = isOpen;
    }
}

export class InteractionIntentComponent {
    constructor() {
        this.type = 'InteractionIntent';
        this.intents = []; // [{ action: string, params: object }]
    }
}

export class JourneyDialogueComponent {
    constructor() {
        this.type = 'JourneyDialogue';
        this.dialogues = {}; // { [id]: { text: string, action: string, params: object } }
    }
}

export class ShopDialogueComponent {
    constructor() {
        this.type = 'ShopDialogue';
        this.dialogues = {}; // { shop: { text: string, action: string, params: object }, [id]: {...} }
    }
}

export class LogComponent {
    constructor() {
        this.type = 'Log';
        this.messages = []; // Array of log entries
    }
}

export class LightSourceComponent {
    constructor({
        definitionKey = null,
        // Visibility effect properties
        visibilityEnabled = true, // Whether to clear darkness around the entity
        visibilityRadius = 3, // Radius for clearing darkness (in tiles)
        visibilityOpacitySteps = [0.75, 0.15, 0], // Gradient stops for visibility
        visibilityTintColor = 'rgba(255,255,255,0)', // Tint color for the visibility area
        // Glow effect properties
        glowEnabled = true, // Whether to apply a glow/outline effect
        glowType = 'outline', // 'outline' for non-torch, 'environmental' for torch
        glowColor = 'rgba(255,255,255,0.5)', // Color of the glow/outline
        glowIntensity = 0.5, // Intensity of the glow (affects opacity/brightness)
        glowSize = 10, // Size/spread of the glow (pixels for outline, radius for environmental)
        proximityFactor = 1.0, // Intensity multiplier based on player proximity
        pulse = null, // Pulsing effect for glow intensity
        // General properties
        expires = false,
        remainingDuration = 0
    } = {}) {
        this.type = 'LightSource';
        this.definitionKey = definitionKey;
        // Visibility properties
        this.visibilityEnabled = visibilityEnabled;
        this.visibilityRadius = visibilityRadius;
        this.visibilityOpacitySteps = visibilityOpacitySteps;
        this.visibilityTintColor = visibilityTintColor;
        // Glow properties
        this.glowEnabled = glowEnabled;
        this.glowType = glowType;
        this.glowColor = glowColor;
        this.glowIntensity = glowIntensity;
        this.currentGlowIntensity = glowIntensity; // Dynamic value updated by LightingSystem
        this.glowSize = glowSize;
        this.proximityFactor = proximityFactor;
        this.pulse = pulse;
        // General properties
        this.expires = expires;
        this.remainingDuration = remainingDuration;
    }
} 

export class AStarComponent {
    constructor() {
        this.type = 'AStar';
        this.openSet = []; // List of nodes to be evaluated
        this.closedSet = []; // List of nodes already evaluated
        this.path = []; // Final path from start to goal
        this.startNode = null; // Starting node for pathfinding
        this.goalNode = null; // Goal node for pathfinding
        this.grid = null; // Grid representation of the map for pathfinding
    }
}

export class PortalInteractionComponent {
    constructor() {
        this.type = 'PortalInteraction';
        this.portalId = null; // ID of the portal entity
        this.tier = null; // Current tier
        this.action = null; // The player's intended action (e.g., 'cleansePortal', 'enterUncleansedPortal', 'cancelPortalInteraction', 'teleport')
        this.params = {}; // Additional parameters related to the action
    }
}


export class RangedAttackComponent {
    constructor({ name, manaCost, range, piercing, sfx, castTime, projectileSpeed, projectileAvatar, lightSourceType, weapon }) {
        this.type = 'RangedAttack';
        this.name = name || 'Firebolt';
        this.manaCost = manaCost || 0;
        this.range = range || 3;
        this.piercing = piercing || false;
        this.sfx = sfx || 'firecast0';
        this.castTime = castTime || 100;
        this.projectileSpeed = projectileSpeed || 320;
        this.projectileAvatar = projectileAvatar || 'img/avatars/projectile.png';
        this.lightSourceType = lightSourceType || 'default';
        this.weapon = weapon ||{
            name: 'Firebolt',
            baseDamageMin: 2,
            baseDamageMax: 5,
            attackType: 'ranged',
            range: 3,
            specialEffects: { piercing: true, elemental: 'fire' },
            critMultiplier: 1.5,
            projectileAvatar: 'img/avatars/projectile.png'
        };
    }
}


export class AttackComponent {
    constructor({ name, manaCost, range, piercing, sfx, castTime, projectileSpeed, projectileAvatar, lightSourceType, weapon }) {
        this.type = 'Attack';
        this.name = name || 'Firebolt';
        this.manaCost = manaCost || 0;
        this.range = range || 3;
        this.piercing = piercing || false;
        this.sfx = sfx || 'firecast0';
        this.castTime = castTime || 100;
        this.projectileSpeed = projectileSpeed || 320;
        this.projectileAvatar = projectileAvatar || 'img/avatars/projectile.png';
        this.lightSourceType = lightSourceType || 'default';
        this.weapon = weapon || {
            name: 'Firebolt',
            baseDamageMin: 2,
            baseDamageMax: 5,
            attackType: 'ranged',
            range: 3,
            specialEffects: { piercing: true, elemental: 'fire' },
            critMultiplier: 1.5,
            projectileAvatar: 'img/avatars/projectile.png'
        };
    }
}
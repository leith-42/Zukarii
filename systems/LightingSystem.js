
// systems/LightingSystem.js - Updated
import { System } from '../core/Systems.js';
import { LightSourceComponent, LightingState, LightSourceDefinitions } from '../core/Components.js';

export class LightingSystem extends System {
    constructor(entityManager, eventBus, utilities) {
        super(entityManager, eventBus, utilities);
        this.requiredComponents = ['Position', 'LightSource'];
    }

    init() {
        this.RENDER_RADIUS_MODIFIER = 3;
        this.DEFAULT_VISIBLE_RADIUS = 3;
        this.trackControlQueue = this.entityManager.getEntity('gameState')?.getComponent('AudioQueue')?.TrackControl || [];
        this.eventBus.on('LightSourceActivated', (data) => this.activateLightSource(data));
        this.eventBus.on('LightExpired', () => this.checkExpiration());
        this.renderState = this.entityManager.getEntity('renderState')?.getComponent('RenderState');
        this.lightingState = this.entityManager.getEntity('lightingState')?.getComponent('LightingState');
        this.definitions = this.entityManager.getEntity('lightingState')?.getComponent('LightSourceDefinitions').definitions;
    }

    update(deltaTime) {
        this.checkExpiration(deltaTime);
        this.updateLightSources(deltaTime);
    }

    checkExpiration(deltaTime) {
        if (!this.lightingState) return;

        if (this.lightingState.isLit && this.lightingState.remainingDuration > 0) {
            const deltaMs = deltaTime * 1000;
            this.lightingState.remainingDuration -= (deltaMs / 1000);

            if (this.lightingState.remainingDuration <= 0) {
                this.lightingState.isLit = false;
                this.lightingState.expiresOnTurn = 0;
                this.lightingState.visibleRadius = this.DEFAULT_VISIBLE_RADIUS;
                this.renderState.renderRadius = this.DEFAULT_VISIBLE_RADIUS + this.RENDER_RADIUS_MODIFIER;
                const player = this.entityManager.getEntity('player');
                if (player && player.hasComponent('LightSource')) {
                    player.removeComponent('LightSource');
                    player.addComponent(new LightSourceComponent({ definitionKey: 'unlit' }));
                }
                //console.log(`LightingSystem: Torch expired, visibleRadius reset to ${this.lightingState.visibleRadius}`);
                this.utilities.logMessage({ channel: 'system', message: 'The torch has burned out!' });
                this.trackControlQueue.push({ track: 'torchBurning', play: false, volume: 0 });
            }
        }

        const entities = this.entityManager.getEntitiesWith(this.requiredComponents);
        for (const entity of entities) {
            const light = entity.getComponent('LightSource');
            if (light.expires && light.remainingDuration > 0) {
                light.remainingDuration -= deltaTime;
                if (light.remainingDuration <= 0) {
                    entity.removeComponent('LightSource');
                    if (entity.id === 'player') {
                        entity.addComponent(new LightSourceComponent({ definitionKey: 'unlit' }));
                    }
                    this.eventBus.emit('LightExpired', { entityId: entity.id });
                }
            }
        }
    }

    activateLightSource({ type, entityId = 'player' }) {
        //console.log('LightingSystem: Activating light source:', type);
        if (!this.definitions[type]) {
            ////console.log(`LightingSystem: Unknown light source type: ${type}`);
            return;
        }

        const entity = this.entityManager.getEntity(entityId);
        if (!entity) {
            ////console.log(`LightingSystem: Entity ${entityId} not found`);
            return;
        }

        if (entity.hasComponent('LightSource')) {
            entity.removeComponent('LightSource');
            ////console.log(`LightingSystem: Removing Existing LightSourceComponent from Entity ${entityId} `);

        }

        const def = this.definitions[type];
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        const currentTurn = gameState.turn || 0;

        if (entityId === 'player') {
            this.lightingState.isLit = true;
            this.lightingState.expiresOnTurn = currentTurn + (def.duration || 0);
            this.lightingState.visibleRadius = def.visibilityRadius || 0;
            this.lightingState.remainingDuration = def.duration || 0;
            this.renderState.renderRadius = def.visibilityRadius + this.RENDER_RADIUS_MODIFIER;
            
            entity.addComponent(new LightSourceComponent({
                definitionKey: type,
                visibilityEnabled: def.visibilityEnabled,
                visibilityRadius: def.visibilityRadius,
                visibilityOpacitySteps: def.visibilityOpacitySteps || [0.75, 0.15, 0],
                visibilityTintColor: def.visibilityTintColor || 'rgba(255,255,255,0)',
                glowEnabled: def.glowEnabled,
                glowType: def.glowType || 'environmental',
                glowColor: def.glowColor || 'rgba(255,220,120,0.35)',
                glowIntensity: def.glowIntensity || 1.0,
                glowSize: def.glowSize || 0,
                proximityFactor: def.proximityFactor || 1.0,
                pulse: def.pulse || null,
                expires: (def.duration || 0) > 0,
                remainingDuration: def.duration || 0
            }));

            //console.log(`LightingSystem: Activated ${type} for player - visibleRadius: ${this.lightingState.visibleRadius}, expires on turn: ${this.lightingState.expiresOnTurn}`);
            this.trackControlQueue.push({ track: 'torchBurning', play: true, volume: 0.25 });
        } else {

            const lightingStateEntity = this.entityManager.getEntity('lightingState');
            const definitions = lightingStateEntity.getComponent('LightSourceDefinitions').definitions;
            if (!definitions[type]) {
                ////console.log(`LightingSystem: Unknown light source type: ${type}`);
                return;
            }

            let lightSourceComp = (new LightSourceComponent({
                definitionKey: type,
                visibilityEnabled: def.visibilityEnabled,
                visibilityRadius: def.visibilityRadius || 0,
                visibilityOpacitySteps: def.visibilityOpacitySteps || [0.75, 0.15, 0],
                visibilityTintColor: def.visibilityTintColor || 'rgba(255,255,255,0)',
                glowEnabled: def.glowEnabled,
                glowType: def.glowType || 'outline',
                glowColor: def.glowColor || 'rgba(255,255,255,0.5)',
                glowIntensity: def.glowIntensity || 0.5,
                glowSize: def.glowSize || 10,
                proximityFactor: def.proximityFactor || 1.0,
                pulse: def.pulse || null,
                expires: (def.duration || 0) > 0,
                remainingDuration: def.duration || 0
            }));


 
            entity.addComponent(lightSourceComp);
            ////console.log(`LightingSystem: Activated ${type} for entity ${entityId}`, entity, lightSourceComp);
        }
    }

    updateLightSources(deltaTime) {
        const player = this.entityManager.getEntity('player');
        const playerPos = player?.getComponent('Position');
        if (!playerPos) return;

        const entities = this.entityManager.getEntitiesWith(this.requiredComponents);
        for (const entity of entities) {
            const pos = entity.getComponent('Position');
            const light = entity.getComponent('LightSource');

            // Skip torch (player) since its glow is handled differently
            if (entity.id === 'player' && light.definitionKey === 'torch') continue;

            // Update proximity-based glow intensity
            const dx = pos.x - playerPos.x;
            const dy = pos.y - playerPos.y;
            const distance = Math.sqrt(dx * dx + dy * dy) / 32; // TILE_SIZE = 32

            if (light.proximityFactor > 1.0) {
                const maxDistance = light.visibilityRadius * 2;
                const t = Math.max(0, Math.min(1, 1 - distance / maxDistance));
                light.currentGlowIntensity = light.glowIntensity * (1 + (light.proximityFactor - 1) * t);
            } else {
                light.currentGlowIntensity = light.glowIntensity;
            }

            // Apply pulsing effect
            if (light.pulse) {
                const t = Date.now() * light.pulse.frequency * 0.001;
                light.currentGlowIntensity += light.pulse.amplitude * Math.sin(t);
            }
        }
    }
}

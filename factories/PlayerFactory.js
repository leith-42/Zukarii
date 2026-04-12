// factories/PlayerFactory.js
import { PLAYER_ANIMATION_CONFIG } from '../data/cfg/PlayerAnimations.js';
import {
    PositionComponent,
    LastPositionComponent,
    VisualsComponent,
    HealthComponent,
    ManaComponent,
    StatsComponent,
    InventoryComponent,
    JourneyRewardComponent,
    ResourceComponent,
    PlayerStateComponent,
    JourneyStateComponent,
    JourneyPathComponent,
    InputStateComponent,
    AttackSpeedComponent,
    MovementSpeedComponent,
    AffixComponent,
    NeedsRenderComponent,
    HitboxComponent,
    PlayerActionQueueComponent,
    PlayerAchievementsComponent,
    AnimationStateComponent,
    AnimationComponent,
    LogComponent,
    LightSourceComponent,
    SkillsComponent
} from '../core/Components.js';

export class PlayerFactory {
    /**
     * Creates and initializes the player entity with all required components
     * @param {EntityManager} entityManager - The entity manager instance
     * @returns {Entity} The fully initialized player entity
     */
    static create(entityManager) {
        // Remove existing player if present
        let player = entityManager.getEntity('player');
        if (player) {
            entityManager.removeEntity('player');
        }

        // Create new player entity
        player = entityManager.createEntity('player', true);

        // Add all player components
        const components = [
            new LightSourceComponent({
                definitionKey: 'unlit',
                visibilityEnabled: true,
                visibilityRadius: 2,
                visibilityOpacitySteps: [0.75, 0.15, 0],
                visibilityTintColor: 'rgba(255,255,255,.5)',
                glowEnabled: true,
                glowType: 'outline',
                glowColor: 'rgba(255,255,255,0)',
                glowIntensity: 0.5,
                glowSize: 2,
                proximityFactor: 1.0,
                pulse: null
            }),
            new LogComponent(),
            new PositionComponent(704, 704),
            new LastPositionComponent(0, 0),
            new VisualsComponent(32, 32),
            new HealthComponent(0, 0),
            new ManaComponent(0, 0),
            new StatsComponent(),
            new InventoryComponent({
                equipped: {
                    mainhand: null,
                    offhand: null,
                    armor: null,
                    amulet: null,
                    leftring: null,
                    rightring: null
                },
                items: []
            }),
            new JourneyRewardComponent(),
            new ResourceComponent(0, 0, 0, 0, 0, 0, {}),
            new PlayerStateComponent(0, 1, 0, false, false, ''),
            new JourneyStateComponent(),
            new JourneyPathComponent(),
            new InputStateComponent(),
            new AttackSpeedComponent(500),
            new MovementSpeedComponent(),
            new AffixComponent(),
            new NeedsRenderComponent(32, 32),
            new HitboxComponent(28, 28, 2, 4),
            new PlayerActionQueueComponent(),
            new PlayerAchievementsComponent(),
            new AnimationStateComponent(),
            new AnimationComponent(),
            new SkillsComponent()
        ];

        // Add all components to player
        components.forEach(component => {
            entityManager.addComponentToEntity('player', component);
        });

        // Post-initialization: Configure visuals
        const visuals = player.getComponent('Visuals');
        visuals.avatar = 'img/avatars/player.png';

        // Post-initialization: Configure movement speed
        const movementSpeedComp = player.getComponent('MovementSpeed');
        movementSpeedComp.combatSpeedMultiplier = 0.9;

        // Post-initialization: Configure animation
        const animation = player.getComponent('Animation');
        Object.assign(animation, PLAYER_ANIMATION_CONFIG);

        console.log('PlayerFactory: Player entity created and initialized');

        return player;
    }
}

// State.js - Updated
// Manages high-level game state using EntityManager and EventBus, stripped of God Object tendencies

import { Utilities } from './Utilities.js';
import { EntityManager } from './core/EntityManager.js';
import { EventBus } from './core/EventBus.js';
import {
    UIComponent,
    GameStateComponent,
    GameOptionsComponent
} from './core/Components.js';

export class State {
    constructor(utilities = new Utilities()) {
        this.utilities = utilities;

        // Core managers replacing old state structure
        this.entityManager = new EntityManager();
        this.eventBus = new EventBus();

        // Constants (to be moved later)
        this.WIDTH = 122;
        this.HEIGHT = 67;
        this.MIN_STAIR_DISTANCE = Math.floor(Math.random() * 31) + 30;
        this.AGGRO_RANGE = 4;

        // DOM references (preserved for now, to be handled by RenderSystem)
        this.mapDiv = null;
        this.statsDiv = null;
        this.logDiv = null;
        this.tabsDiv = null;

        // Possible item stats (preserved for PlayerSystem)
        this.possibleItemStats = [
            'maxHp', 'maxMana', 'maxLuck',
            'intellect', 'prowess', 'agility',
            'range', 'block', 'armor', 'defense',
            'baseBlock', 'baseRange',
            'rangedBonus', 'meleeBonus', 'damageBonus'
        ];

        // Initialize core entities
        this.initializeCoreEntities();
    }

    initializeCoreEntities() {
        // Game state entity (global)
        const gameState = this.entityManager.createEntity('gameState', true);

        this.entityManager.addComponentToEntity('gameState',
            new GameStateComponent({
                gameStarted: false,
                needsRender: true,          // Set to true to ensure initial render
                needsInitialRender: true    // Set to true for initial render
            })
        );
        this.entityManager.addComponentToEntity('gameState', 
            new GameOptionsComponent({
                type: 'GameOptions',
                soundEnabled: true,
                globalVolume: 1,
            })
        );
        console.log('State.js: Created gameState entity with GameState component:', this.entityManager.getEntity('gameState'));

        // UI entity (global)
        const ui = this.entityManager.createEntity('ui', true);
        this.entityManager.addComponentToEntity('ui',
            new UIComponent()
        );

        // Add LevelDimensions to state entity
        const state = this.entityManager.createEntity('state', true);
        this.entityManager.addComponentToEntity('state', {
            type: 'LevelDimensions',
            WIDTH: this.WIDTH,
            HEIGHT: this.HEIGHT
        });
    }

    // Helper to get the player entity (convenience for now)
    getPlayer() {
        return this.entityManager.getEntity('player');
    }

    // Helper to get game state (convenience for now)
    getGameState() {
        const entity = this.entityManager.getEntity('gameState');
        const component = entity?.getComponent('GameState');
        // console.log('State.js: getGameState called, entity ID:', entity?.id, 'component reference:', component, 'timestamp:', Date.now());
        return entity;
    }
}
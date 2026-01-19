// PlayerInputSystem.js
import { InputStateComponent,  HotBarIntentComponent } from '../core/Components.js';

export class PlayerInputSystem {
    constructor(entityManager, eventBus) {
        this.entityManager = entityManager;
        this.eventBus = eventBus;
        this.keysPressed = {};
        this.keyMap = {
            'w': 'ArrowUp', 'W': 'ArrowUp', 'ArrowUp': 'ArrowUp',
            'a': 'ArrowLeft', 'A': 'ArrowLeft', 'ArrowLeft': 'ArrowLeft',
            's': 'ArrowDown', 'S': 'ArrowDown', 'ArrowDown': 'ArrowDown',
            'd': 'ArrowRight', 'D': 'ArrowRight', 'ArrowRight': 'ArrowRight',
            'i': 'c', 'I': 'c', 'c': 'c', 'C': 'c',
            'l': 'l', 'L': 'l',
            'j': 'j', 'J': 'j',
            'escape': 'escape', 'Escape': 'escape',
            't': 't', 'T': 't',
            'h': 'h', 'H': 'h',
            ' ': ' ', 'Space': ' ',
            'm': 'm', 'M': 'm',
            '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', 
        };

        this.lastInputUpdate = 0;
        this.inputUpdateCooldown = 50; // Update every 50ms

        this.repeatableKeys = {
            '1': '100', '2': '100', '3': '100', '4': '100', '5': '100', '6': '100'
        }
        this.lastKeyTimes = {};

        this.keydownHandler = (e) => this.handleKeyDown(e);
        this.keyupHandler = (e) => this.handleKeyUp(e);

        window.addEventListener('keydown', this.keydownHandler, { capture: true });
        window.addEventListener('keyup', this.keyupHandler, { capture: true });
        ////console.log('PlayerInputSystem: Key listeners attached to window');
    }

    async init() {
        this.trackControlQueue = this.entityManager.getEntity('gameState')?.getComponent('AudioQueue')?.TrackControl || [];
        const player = this.entityManager.getEntity('player');
        if (!player.hasComponent('InputState')) {
            this.entityManager.addComponentToEntity('player', new InputStateComponent());
        }
        ////console.log('PlayerInputSystem initialized');
    }

    handleKeyDown(event) {
        
        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
        if (!gameState.gameStarted) {
            if (!document.activeElement.id === 'player-name-input' && mappedKey) {
                event.preventDefault();  // Prevent default action for mapped keys
            } else {
                return;
            }
        }
         
        ////console.log('PlayerInputSystem: handleKeyDown - raw key:', event.key);
        const mappedKey = this.keyMap[event.key];
        ////console.log('PlayerInputSystem: handleKeyDown - mappedKey:', mappedKey);

        if ((document.activeElement.id === 'save-name-input' ) && mappedKey != 'escape') {
            return; // Ignore keypresses when the save-name-input field is focused
        } else if (mappedKey) {
            event.preventDefault();  // Prevent default action for mapped keys
        } 
        /* handled elsewhere
        if (event.repeat) {
            ////console.log('PlayerInputSystem: Ignoring repeated key press:', event.key);
            return;
        }
        */

        ////console.log('PlayerInputSystem: handleKeyDown - raw key pressed:', event.key);
        if (mappedKey) {
            event.preventDefault();  // Prevent default action for mapped keys
            this.keysPressed[mappedKey] = true;
            const now = Date.now();
            if (now - this.lastInputUpdate >= this.inputUpdateCooldown) {
                this.updateInputState();
                this.lastInputUpdate = now;
            }
            this.handleNonMovementKeys(event, mappedKey, true);
        }
    }

    handleKeyUp(event) {
       // //console.log('PlayerInputSystem: handleKeyUp - raw key:', event.key);
        const mappedKey = this.keyMap[event.key];
       // //console.log('KeyUp Event Fired:', event.key, 'Mapped:', mappedKey);
        
        if (mappedKey) {
            if (document.activeElement.id === 'save-name-input' && mappedKey != 'escape') {
                return; // Ignore keypresses when the save-name-input field is focused
            }

            delete this.keysPressed[mappedKey];
            this.updateInputState();
           // //console.log('Key Up:', mappedKey, 'keysPressed:', JSON.stringify(this.keysPressed));
            if (mappedKey === ' ') {
                this.handleNonMovementKeys(event, mappedKey, false);
            }
            if (['1', '2', '3', '4', '5', '6'].includes(mappedKey)) {
                this.handleNonMovementKeys(event, mappedKey, false);
            }
        }
    }

    updateInputState() {
        const player = this.entityManager.getEntity('player');
        if (player) {
            const inputState = player.getComponent('InputState');
            inputState.keys = { ...this.keysPressed };
           // //console.log('PlayerInputSystem: InputState updated with keys:', JSON.stringify(inputState.keys));
        }
    }

    handleNonMovementKeys(event, mappedKey, isKeyDown) {
        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');

        if (!gameState || gameState.gameOver) return;

        if (this.repeatableKeys[mappedKey]) {
            const now = Date.now();
            const interval = parseInt(this.repeatableKeys[mappedKey], 10);
            const lastTime = this.lastKeyTimes[mappedKey] || 0;

            if (isKeyDown && now - lastTime < interval) return;
            this.lastKeyTimes[mappedKey] = now;

        } else if(isKeyDown && event.repeat) return;

        switch (mappedKey) {
            case 'c':
                this.eventBus.emit('ToggleOverlay', { tab: 'character' });
                break;
            case 'l':
                this.eventBus.emit('ToggleOverlay', { tab: 'log' });
                break;
            case 'j':
                this.eventBus.emit('ToggleOverlay', { tab: 'journey' });
                break;
            case 'escape':
                this.eventBus.emit('ToggleOverlay', {});
                break;
            case 't':
                this.eventBus.emit('LightTorch');
                gameState.needsRender = true;
                //this.eventBus.emit('RenderNeeded');
                break;
            case 'h':
                this.eventBus.emit('DrinkHealPotion');
                break;
            case ' ':
                event.preventDefault();
                this.eventBus.emit('ToggleRangedMode', { event });
                ////console.log('PlayerInputSystem: Emitting ToggleRangedMode - event:', event.type, 'key:', event.key);
                break;
            case 'm':
                event.preventDefault();
                this.eventBus.emit('ToggleMinimap');
                // //console.log('PlayerInputSystem: Emitting ToggleMinimap');
                break;
            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
            case '6':
                event.preventDefault();
                const player = this.entityManager.getEntity('player');
                let hotBarComp = player.getComponent('HotBarIntent');
                if (!hotBarComp) {
                    hotBarComp = new HotBarIntentComponent();
                    this.entityManager.addComponentToEntity('player', hotBarComp);
                }
                // Update or add the action for the pressed key
                const existingAction = hotBarComp.hotBarActions.find(a => a.slot === mappedKey);
                if (existingAction) {
                    existingAction.isKeyDown = isKeyDown;
                } else {
                    hotBarComp.hotBarActions.push({ slot: mappedKey, action: 'use', isKeyDown });
                }
            break;
        }
    }

    update() { }

    destroy() {
        window.removeEventListener('keydown', this.keydownHandler, { capture: true });
        window.removeEventListener('keyup', this.keyupHandler, { capture: true });
        ////console.log('PlayerInputSystem destroyed, listeners removed');
    }
}
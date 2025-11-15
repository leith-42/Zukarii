/*

import { MovementIntentComponent, MouseTargetComponent, PositionComponent, HitboxComponent, CollisionComponent, InteractionIntentComponent } from '../core/Components.js';

export class MouseInputSystem {
    constructor(entityManager, eventBus, state) {
        this.entityManager = entityManager;
        this.eventBus = eventBus;
        this.state = state;
        this.canvas = document.getElementById('viewport-canvas');
        this.TILE_SIZE = 32;
        this.SCALE_FACTOR = 2;
        this.isMouseDown = false;
        this.lastMouseX = null;
        this.lastMouseY = null;
        this.mouseDownTime = null;
        this.MIN_CLICK_INTERVAL = 150;
        this.CLICK_THRESHOLD = 155;
        this.lastAttackTime = 0;
        this.lastClickTimes = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 }; // Separate debounce times for each button
        this.HITBOX_BUFFER = 4;
        this.hasInteractedWithNPC = false;

        if (!this.canvas) {
            console.error('MouseInputSystem: Canvas element with id="viewport-canvas" not found');
            return;
        }

        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        window.addEventListener('resize', () => this.handleResize());
        this.eventBus.on('LevelAdded', () => this.clearMovement());
    }

    async init() {
        this.player = this.entityManager.getEntity('player');
        this.isMouseDown = false;
    }

    update(deltaTime) {
        const dialogue = this.entityManager.getEntity('dialogueState')?.getComponent('Dialogue');
        if (dialogue?.isOpen) {
            // Reset mouse state if dialogue opens during a hold
            if (this.isMouseDown) {
                this.isMouseDown = false;
                this.lastMouseX = null;
                this.lastMouseY = null;
                this.mouseDownTime = null;
                this.hasInteractedWithNPC = false;

                const mouseTarget = this.player.getComponent('MouseTarget');
                if (mouseTarget) {
                    mouseTarget.active = false; // Mark as inactive instead of removing
                }

                this.eventBus.emit('StopMovement', { entityId: 'player' });
            }
            return;
        }

        if (!this.isMouseDown || this.lastMouseX === null || this.lastMouseY === null) return;

        const player = this.player;
        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
        if (!player || !gameState?.gameStarted || gameState.gameOver || gameState.transitionLock) {
            return;
        }

        const worldX = this.lastMouseX;
        const worldY = this.lastMouseY;

        this.processInput(worldX, worldY);
    }

    handleResize() {
        if (!this.canvas) return;
        this.canvas.width = Math.min(window.innerWidth, 1920);
        this.canvas.height = Math.min(window.innerHeight, 1080);
    }

    handleMouseDown(event) {
        const dialogue = this.entityManager.getEntity('dialogueState')?.getComponent('Dialogue');
        if (dialogue?.isOpen) {
            event.stopPropagation();
            return;
        }

        const now = performance.now();
        const lastClickTime = this.lastClickTimes[event.button] || 0;

        switch (event.button) {
            case 0: // Left button
                if (now - lastClickTime < this.MIN_CLICK_INTERVAL) {
                    return;
                }
                this.lastClickTimes[0] = now;
                this.mouseDownTime = now;

                const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
                if (!gameState?.gameStarted || gameState.gameOver || gameState.transitionLock) {
                    return;
                }

                this.isMouseDown = true;
                this.hasInteractedWithNPC = false;

                const { worldX, worldY } = this.getWorldCoordinates(event);
                this.lastMouseX = worldX;
                this.lastMouseY = worldY;

                this.processInput(worldX, worldY);
                break;

            case 1: // Middle button
            case 2: // Right button
                event.preventDefault();
                break;

            case 3: // Back button
            case 4: // Forward button
                if (now - lastClickTime < this.MIN_CLICK_INTERVAL) {
                    return;
                }
                this.lastClickTimes[event.button] = now;
                event.preventDefault();
                this.eventBus.emit('ToggleRangedMode', { event });
                break;

            default:
                break;
        }
    }

    handleMouseMove(event) {
        const { worldX, worldY } = this.getWorldCoordinates(event);

        // Find the entity at the mouse position
        const entity = this.getEntityAtPosition(worldX, worldY);

        // Calculate direction from player to cursor
        const playerPos = this.player.getComponent('Position');
        const dx = worldX - playerPos.x;
        const dy = worldY - playerPos.y;
        const magnitude = Math.sqrt(dx * dx + dy * dy);
        const direction = magnitude > 0 ? { dx: dx / magnitude, dy: dy / magnitude } : { dx: 0, dy: 0 };

        let mouseTarget = this.entityManager.getEntity('player').getComponent('MouseTarget');
        if (!mouseTarget) {
            mouseTarget = new MouseTargetComponent(worldX, worldY, entity ? entity.id : null, direction);
            this.entityManager.addComponentToEntity('player', mouseTarget);
        } else {
            mouseTarget.targetX = worldX;
            mouseTarget.targetY = worldY;
            mouseTarget.entityId = entity ? entity.id : null;
            mouseTarget.direction = direction; // Update the direction
        }

        this.setCursor({ worldX, worldY });
        if (this.isMouseDown) {
            this.lastMouseX = worldX;
            this.lastMouseY = worldY;
        }
    }

    setCursor(cursorPos) {
        const player = this.player;
        if (!player) {
            console.warn('MouseInputSystem: Player entity not found');
            return;
        }
        const playerPos = player.getComponent('Position');
        const dx = cursorPos.worldX - playerPos.x;
        const dy = cursorPos.worldY - playerPos.y;
        const rangeToCursor = Math.sqrt(dx * dx + dy * dy) / this.TILE_SIZE;
        const playerRange = player.getComponent('Stats')?.range || 1; // Default range if not defined
        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
        if (gameState.isRangedMode && rangeToCursor <= playerRange) {
            document.body.style.cursor = 'crosshair'; // Change cursor to pointer when holding mouse down
        } else {
            document.body.style.cursor = 'pointer'; // Reset cursor when not holding down
        }
    }

    handleMouseUp(event) {
        const dialogue = this.entityManager.getEntity('dialogueState')?.getComponent('Dialogue');
        if (dialogue?.isOpen) {
            event.stopPropagation();
            this.clearMovement();
            return;
        }

        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
        if (gameState.transitionLock) {
            return;
        }

        switch (event.button) {
            case 0: // Left button
                const now = performance.now();
                const duration = this.mouseDownTime ? now - this.mouseDownTime : 0;
                const isQuickClick = duration < this.CLICK_THRESHOLD;

                const player = this.player;
                if (!player) {
                    console.warn('MouseInputSystem: Player entity not found');
                    return;
                }

                if (this.lastMouseX !== null && this.lastMouseY !== null) {
                    if (isQuickClick) {
                        this.processInput(this.lastMouseX, this.lastMouseY, true);
                    } else {
                        this.clearMovement();
                    }
                }

                this.clearMovement();
                break;

            case 1: // Middle button
            case 2: // Right button
                event.preventDefault();
                return;

            case 3: // Back button
            case 4: // Forward button
                event.preventDefault();
                this.eventBus.emit('ToggleRangedMode', { event });
                break;

            default:
                return;
        }
    }

    clearMovement() {
        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
        if (!gameState?.gameStarted || gameState.gameOver || gameState.transitionLock) {
            return;
        }
        const mouseTarget = this.entityManager.getEntity('player').getComponent('MouseTarget');
        if (mouseTarget) {
            mouseTarget.active = false; // Mark as inactive instead of removing
        }
        this.isMouseDown = false;
        this.lastMouseX = null;
        this.lastMouseY = null;
        this.mouseDownTime = null;
        this.hasInteractedWithNPC = false;
        this.eventBus.emit('StopMovement', { entityId: 'player' });
    }

    processInput(worldX, worldY, isClick = false) {
        const player = this.player;
        const playerState = player.getComponent('PlayerState');
        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
        const attackSpeed = player.getComponent('AttackSpeed');
        const mana = player.getComponent('Mana');
        const inventory = player.getComponent('Inventory');
        const visuals = player.getComponent('Visuals');

        const npc = this.getNPCAtPosition(worldX, worldY);
        if (npc) {
            const npcPos = npc.getComponent('Position');
            const playerPos = player.getComponent('Position');
            const dx = npcPos.x - playerPos.x;
            const dy = npcPos.y - playerPos.y;
            const distance = Math.sqrt(dx * dx + dy * dy) / this.TILE_SIZE;
            const interactRange = 3;

            if (isClick && distance <= interactRange) {
                if (!this.hasInteractedWithNPC) {
                    this.clearMovement();
                    const intent = player.getComponent('InteractionIntent') || new InteractionIntentComponent();
                    intent.intents.push({ action: 'interactWithNPC', params: { npcId: npc.id } });
                    player.addComponent(intent);
                    this.hasInteractedWithNPC = true;
                }
                return;
            } else {
                this.setMovementTarget(npcPos.x, npcPos.y);
                return;
            }
        }

        const target = this.getMonsterAtPosition(worldX, worldY);
        if (target) {
            this.setMovementTarget(target.monster.getComponent('Position').x, target.monster.getComponent('Position').y);
            return;
        }

        this.setMovementTarget(worldX, worldY);
    }

    processMovement(worldX, worldY) {
        const player = this.player;
        const playerPos = player.getComponent('Position');
        const dx = worldX - playerPos.x;
        const dy = worldY - playerPos.y;
        const magnitude = Math.sqrt(dx * dx + dy * dy);

        if (magnitude > 0) {
            const movementIntent = player.getComponent('MovementIntent') || new MovementIntentComponent();
            movementIntent.dx = dx / magnitude;
            movementIntent.dy = dy / magnitude;
            player.addComponent(movementIntent);
        }
    }

    setMovementTarget(worldX, worldY) {
        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
        const tileX = Math.floor(worldX / this.TILE_SIZE);
        const tileY = Math.floor(worldY / this.TILE_SIZE);

        if (tileX < 0 || tileX >= this.state.WIDTH || tileY < 0 || tileY >= this.state.HEIGHT) {
            //console.log(`MouseInputSystem: Target tile (${tileX}, ${tileY}) out of bounds`);
            return;
        }

        const levelEntity = this.entityManager.getEntity(`level_${gameState.tier}`);
        if (!levelEntity) {
            console.warn(`MouseInputSystem: No level entity for tier ${gameState.tier}`);
            return;
        }

        const map = levelEntity.getComponent('Map').map;
        if (!map[tileY] || map[tileY][tileX] === 1) {
            //console.log(`MouseInputSystem: Tile (${tileX}, ${tileY}) is a wall`);
            return;
        }

        const targetX = tileX * this.TILE_SIZE;
        const targetY = tileY * this.TILE_SIZE;
        const player = this.player;
        const moveDx = targetX - player.getComponent('Position').x;
        const moveDy = targetY - player.getComponent('Position').y;
        this.entityManager.addComponentToEntity('player', new MouseTargetComponent(targetX, targetY));
        ////console.log(`MouseInputSystem: Setting movement target to (${targetX.toFixed(2)}, ${targetY.toFixed(2)}) for tile (${tileX}, ${tileY}), direction: (${moveDx.toFixed(2)}, ${moveDy.toFixed(2)})`);
    }
    getEntityAtPosition(worldX, worldY) {
        // Check for NPCs
        const npc = this.getNPCAtPosition(worldX, worldY);
        if (npc) return npc;

        // Check for monsters
        const monster = this.getMonsterAtPosition(worldX, worldY);
        if (monster) return monster.monster;

        // No entity found
        return null;
    }

    getNPCAtPosition(worldX, worldY) {
        const npcs = this.entityManager.getEntitiesWith(['NPCData', 'Position', 'Hitbox', 'Visuals']);
        for (const npc of npcs) {
            const pos = npc.getComponent('Position');
            const visuals = npc.getComponent('Visuals');
            const hitboxLeft = pos.x - this.HITBOX_BUFFER;
            const hitboxRight = pos.x + visuals.w + this.HITBOX_BUFFER;
            const hitboxTop = pos.y - this.HITBOX_BUFFER;
            const hitboxBottom = pos.y + visuals.h + this.HITBOX_BUFFER;

            if (
                worldX >= hitboxLeft &&
                worldX <= hitboxRight &&
                worldY >= hitboxTop &&
                worldY <= hitboxBottom
            ) {
                return npc;
            }
        }
        return null;
    }

    getMonsterAtPosition(worldX, worldY) {
        const monsters = this.entityManager.getEntitiesWith(['MonsterData', 'Position', 'Hitbox', 'Health', 'Visuals']);
        for (const monster of monsters) {
            if (monster.getComponent('Health').hp <= 0) continue;
            const pos = monster.getComponent('Position');
            const visuals = monster.getComponent('Visuals');
            const hitboxLeft = pos.x - this.HITBOX_BUFFER;
            const hitboxRight = pos.x + visuals.w + this.HITBOX_BUFFER;
            const hitboxTop = pos.y - this.HITBOX_BUFFER;
            const hitboxBottom = pos.y + visuals.h + this.HITBOX_BUFFER;

            if (
                worldX >= hitboxLeft &&
                worldX <= hitboxRight &&
                worldY >= hitboxTop &&
                worldY <= hitboxBottom
            ) {
                return { monster, range: Math.floor(Math.sqrt((pos.x - worldX) ** 2 + (pos.y - worldY) ** 2) / this.TILE_SIZE) };
            }
        }
        return null;
    }

    getWorldCoordinates(event) {
        const rect = this.canvas.getBoundingClientRect();
        const pixelX = (event.clientX - rect.left) / this.SCALE_FACTOR;
        const pixelY = (event.clientY - rect.top) / this.SCALE_FACTOR;
        const player = this.player;
        const playerPos = player.getComponent('Position');
        const viewportWidth = this.canvas.width / this.SCALE_FACTOR;
        const viewportHeight = this.canvas.height / this.SCALE_FACTOR;
        const mapWidth = this.state.WIDTH * this.TILE_SIZE;
        const mapHeight = this.state.HEIGHT * this.TILE_SIZE;
        let startX = playerPos.x - viewportWidth / 2;
        let startY = playerPos.y - viewportHeight / 2;
        startX = Math.max(0, Math.min(startX, mapWidth - viewportWidth));
        startY = Math.max(0, Math.min(startY, mapHeight - viewportHeight));
        return { worldX: pixelX + startX, worldY: pixelY + startY };
    }

    destroy() {
        if (this.canvas) {
            this.canvas.removeEventListener('mousedown', this.handleMouseDown);
            this.canvas.removeEventListener('mouseup', this.handleMouseUp);
            this.canvas.removeEventListener('mousemove', this.handleMouseMove);
            this.canvas.removeEventListener('contextmenu', (e) => e.preventDefault());
            window.removeEventListener('resize', () => this.handleResize());
        }
        this.eventBus.off('LevelAdded', this.clearMovement);
    }
}

*/

import { MovementIntentComponent, MouseTargetComponent, PositionComponent, HitboxComponent, CollisionComponent, InteractionIntentComponent } from '../core/Components.js';

export class MouseInputSystem {
    constructor(entityManager, eventBus, state) {
        this.entityManager = entityManager;
        this.eventBus = eventBus;
        this.state = state;
        this.canvas = document.getElementById('viewport-canvas');
        this.TILE_SIZE = 32;
        this.SCALE_FACTOR = 2;
        this.isMouseDown = false;
        this.lastMouseX = null;
        this.lastMouseY = null;
        this.mouseDownTime = null;
        this.MIN_CLICK_INTERVAL = 150;
        this.CLICK_THRESHOLD = 155;
        this.lastAttackTime = 0;
        this.lastClickTime = 0;
        this.HITBOX_BUFFER = 4;
        this.hasInteractedWithNPC = false;
        if (!this.canvas) {
            console.error('MouseInputSystem: Canvas element with id="viewport-canvas" not found');
            return;
        }
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        window.addEventListener('resize', () => this.handleResize());
        this.eventBus.on('LevelAdded', () => this.clearMovement());
    }

    async init() {
        //console.log('MouseInputSystem initialized');
        this.player = this.entityManager.getEntity('player');
    }

    update(deltaTime) {
        const dialogue = this.entityManager.getEntity('dialogueState')?.getComponent('Dialogue');
        if (dialogue?.isOpen) {
            // Reset mouse state if dialogue opens during a hold
            if (this.isMouseDown) {
                this.isMouseDown = false;
                this.lastMouseX = null;
                this.lastMouseY = null;
                this.mouseDownTime = null;
                this.hasInteractedWithNPC = false;
                this.entityManager.removeComponentFromEntity('player', 'MouseTarget');
                this.eventBus.emit('StopMovement', { entityId: 'player' });
                //console.log('MouseInputSystem: Reset mouse state in update due to dialogue being open');
            }
            return;
        }

        if (!this.isMouseDown || this.lastMouseX === null || this.lastMouseY === null) return;

        const player = this.player;
        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
        if (!player || !gameState?.gameStarted || gameState.gameOver || gameState.transitionLock) {
            //console.log(`MouseInputSystem: Update skipped due to transitionLock or invalid state`);
            return;
        }

        const worldX = this.lastMouseX;
        const worldY = this.lastMouseY;

        this.processInput(worldX, worldY);
    }

    handleResize() {
        if (!this.canvas) return;
        this.canvas.width = Math.min(window.innerWidth, 1920);
        this.canvas.height = Math.min(window.innerHeight, 1080);
    }

    handleMouseDown(event) {
        const dialogue = this.entityManager.getEntity('dialogueState')?.getComponent('Dialogue');
        if (dialogue?.isOpen) {
            event.stopPropagation();
            return;
        }

        // Maintain separate debounce times for each button
        if (!this.lastClickTimes) {
            this.lastClickTimes = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
        }

        const now = performance.now();
        const lastClickTime = this.lastClickTimes[event.button] || 0;
        

        switch (event.button) {
            case 0: // Left button

                if (now - lastClickTime < this.MIN_CLICK_INTERVAL) {
                    return;
                }
               
                this.lastClickTimes[0] = now;
                this.mouseDownTime = now;

                const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
                if (!gameState?.gameStarted || gameState.gameOver || gameState.transitionLock) {
                    //console.log(`MouseInputSystem: Input blocked`);
                    return;
                }

                this.isMouseDown = true;
                this.hasInteractedWithNPC = false;

                const { worldX, worldY } = this.getWorldCoordinates(event);
                this.lastMouseX = worldX;
                this.lastMouseY = worldY;

                this.processInput(worldX, worldY);
                break;
            case 1: // Middle button
            case 2: // Right button
                event.preventDefault();
                break;
            case 3: // Back button
            case 4: // Forward button
                if (now - lastClickTime < this.MIN_CLICK_INTERVAL) {
                    return;
                }
                this.lastClickTimes[event.button] = now;
                event.preventDefault();
                this.eventBus.emit('ToggleRangedMode', { event });
                break;
           

            default:
                break;
        }
        
    }

    handleMouseMove(event) {
        const cusrorPos = this.getWorldCoordinates(event);
        this.setCursor(cusrorPos);
        if (!this.isMouseDown) return;

        
        this.lastMouseX = cusrorPos.worldX;
        this.lastMouseY = cusrorPos.worldY;
        
    }

    setCursor(cursorPos) {
        const player = this.player;
        if (!this.player) {
            console.warn('MouseInputSystem: Player entity not found');
            return;
        }
        const playerPos = player.getComponent('Position');
        const dx = cursorPos.worldX - playerPos.x;
        const dy = cursorPos.worldY - playerPos.y;
        const rangeToCursor = Math.sqrt(dx * dx + dy * dy) / this.TILE_SIZE;
        const playerRange = player.getComponent('Stats')?.range || 1; // Default range if not defined
        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
        if (gameState.isRangedMode && rangeToCursor <= playerRange) {
            document.body.style.cursor = 'crosshair'; // Change cursor to pointer when holding mouse down
        }
        else {
            document.body.style.cursor = 'pointer'; // Reset cursor when not holding down
        }
    }

    handleMouseUp(event) {
        const dialogue = this.entityManager.getEntity('dialogueState')?.getComponent('Dialogue');
        if (dialogue?.isOpen) {
            event.stopPropagation();
            this.isMouseDown = false; // Reset mouse state even if dialogue is open
            this.lastMouseX = null;
            this.lastMouseY = null;
            this.mouseDownTime = null;
            this.hasInteractedWithNPC = false;
            this.entityManager.removeComponentFromEntity('player', 'MouseTarget');
            this.eventBus.emit('StopMovement', { entityId: 'player' });
            //console.log('MouseInputSystem: Reset mouse state due to dialogue being open');
            return;
        }

        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
        if (gameState.transitionLock) {
            //console.log(`MouseInputSystem: Mouse up ignored during transition`);
            return;
        }

       

        switch (event.button) {
            case 0: // Left button

                const now = performance.now();
                const duration = this.mouseDownTime ? now - this.mouseDownTime : 0;
                const isQuickClick = duration < this.CLICK_THRESHOLD;
                
                const player = this.player;
                if (!player) {
                    console.warn('MouseInputSystem: Player entity not found');
                    return;
                }

                if (this.lastMouseX !== null && this.lastMouseY !== null) {
                    if (isQuickClick) {
                        this.processInput(this.lastMouseX, this.lastMouseY, true);
                        //console.log(`MouseInputSystem: Quick click detected (${duration.toFixed(2)}ms)`);
                    } else {
                        this.entityManager.removeComponentFromEntity('player', 'MouseTarget');
                        this.eventBus.emit('StopMovement', { entityId: 'player' });
                        //console.log(`MouseInputSystem: Hold release detected (${duration.toFixed(2)}ms), stopped movement`);
                    }
                }

                this.isMouseDown = false;
                this.lastMouseX = null;
                this.lastMouseY = null;
                this.mouseDownTime = null;
                this.hasInteractedWithNPC = false;

                break;
            case 1: // Middle button
            case 2: // Right button
                event.preventDefault();
                return;
            case 3: // Back button
            case 4: // Forward button
                event.preventDefault();
                this.eventBus.emit('ToggleRangedMode', { event });
                break;

            default:
                return;

        }
        
    }

    clearMovement() {
        const player = this.player;
        if (player) {
            this.entityManager.removeComponentFromEntity('player', 'MouseTarget');
            this.isMouseDown = false;
            this.lastMouseX = null;
            this.lastMouseY = null;
            this.mouseDownTime = null;
            this.hasInteractedWithNPC = false;
            this.eventBus.emit('StopMovement', { entityId: 'player' });
            //console.log('MouseInputSystem: Cleared movement components and mouse state due to level transition');
        }
    }

    getNPCAtPosition(worldX, worldY) {
        const npcs = this.entityManager.getEntitiesWith(['NPCData', 'Position', 'Hitbox', 'Visuals']);
        for (const npc of npcs) {
            const pos = npc.getComponent('Position');
            const visuals = npc.getComponent('Visuals');
            const hitboxWidth = visuals.w + this.HITBOX_BUFFER * 2;
            const hitboxHeight = visuals.h + this.HITBOX_BUFFER * 2;
            const hitboxLeft = pos.x - this.HITBOX_BUFFER;
            const hitboxRight = pos.x + visuals.w + this.HITBOX_BUFFER;
            const hitboxTop = pos.y - this.HITBOX_BUFFER;
            const hitboxBottom = pos.y + visuals.h + this.HITBOX_BUFFER;

            if (
                worldX >= hitboxLeft &&
                worldX <= hitboxRight &&
                worldY >= hitboxTop &&
                worldY <= hitboxBottom
            ) {
                const centerX = pos.x + visuals.w / 2;
                const centerY = pos.y + visuals.h / 2;
                const dx = worldX - centerX;
                const dy = worldY - centerY;
                //console.log(`MouseInputSystem: Hit NPC ${npc.id}, distance from center: ${Math.sqrt(dx * dx + dy * dy).toFixed(2)} pixels`);
                return npc;
            }
        }
        return null;
    }

    processInput(worldX, worldY, isClick = false) {
        const player = this.player;
        const playerState = player.getComponent('PlayerState');
        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
        const attackSpeed = player.getComponent('AttackSpeed');
        const mana = player.getComponent('Mana');
        const inventory = player.getComponent('Inventory');
        const visuals = player.getComponent('Visuals');
        const lightingState = this.entityManager.getEntity('lightingState')?.getComponent('LightingState');

        const npc = this.getNPCAtPosition(worldX, worldY);
        if (npc) {
            const npcPos = npc.getComponent('Position');
            const playerPos = player.getComponent('Position');
            const dx = npcPos.x - playerPos.x;
            const dy = npcPos.y - playerPos.y;
            const distance = Math.sqrt(dx * dx + dy * dy) / this.TILE_SIZE;
            const interactRange = 3;
           
            if ( isClick && distance <= interactRange) {
                if (!this.hasInteractedWithNPC) {
                    this.entityManager.removeComponentFromEntity('player', 'MouseTarget');
                    this.eventBus.emit('StopMovement', { entityId: 'player' });
                    const intent = player.getComponent('InteractionIntent') || new InteractionIntentComponent();
                    intent.intents.push({ action: 'interactWithNPC', params: { npcId: npc.id } });
                    player.addComponent(intent);
                    //console.log(`MouseInputSystem: Interacting with NPC ${npc.id} at (${npcPos.x}, ${npcPos.y})`);
                    this.hasInteractedWithNPC = true;
                }
                return;
            } else {
                const tileX = Math.floor(npcPos.x / this.TILE_SIZE);
                const tileY = Math.floor(npcPos.y / this.TILE_SIZE);
                const targetX = tileX * this.TILE_SIZE;
                const targetY = tileY * this.TILE_SIZE;
                this.setMovementTarget(targetX, targetY);
                //console.log(`MouseInputSystem: Moving to NPC ${npc.id} at tile (${tileX}, ${tileY})`);
                return;
            }
            
        }
        const target = this.getMonsterAtPosition(worldX, worldY);
        let monster = null, rangeToTarget = 1;
        if (target !== null) {
            monster = target.monster;
            rangeToTarget = target.range;
        } 
        const playerRange = player.getComponent('Stats')?.range || 1; 
        const hasRangedWeapon = (inventory.equipped.offhand?.attackType === 'ranged' && inventory.equipped.offhand?.baseRange > 0) ||
            (inventory.equipped.mainhand?.attackType === 'ranged' && inventory.equipped.mainhand?.baseRange > 0);

        if (gameState.isRangedMode || (monster && hasRangedWeapon && rangeToTarget <= playerRange )) {
            if (hasRangedWeapon && attackSpeed.elapsedSinceLastAttack >= attackSpeed.attackSpeed && mana.mana >= 2 && !playerState.isCasting) {
               
                const now = performance.now();
                if (now - this.lastAttackTime >= attackSpeed.attackSpeed) {
                    const targetX = monster ? (monster.getComponent('Position').x) : worldX;
                    const targetY = monster ? (monster.getComponent('Position').y) : worldY;
                    let dx = targetX - player.getComponent('Position').x;
                    let dy = targetY - player.getComponent('Position').y;
                    const magnitude = Math.sqrt(dx * dx + dy * dy);
                    if (magnitude > 0) {
                        dx /= magnitude;
                        dy /= magnitude;
                    }
                    visuals.faceLeft = dx < 0;
                    //console.log(`MouseInputSystem: Ranged attack - direction: dx=${dx.toFixed(2)}, dy=${dy.toFixed(2)}, faceLeft: ${visuals.faceLeft}`);

                    const direction = { dx, dy, source: monster ? 'mouse_monster' : 'mouse_ranged' };
                    this.eventBus.emit('RangedAttack', direction);
                    attackSpeed.elapsedSinceLastAttack = 0;
                    this.lastAttackTime = now;
                    //console.log(`MouseInputSystem: Ranged attack triggered, source: ${direction.source}, target: (${targetX.toFixed(2)}, ${targetY.toFixed(2)})`);
                }
            }
            return;
        }

        if (monster) {
            document.body.style.cursor = 'crosshair'; // Change cursor to pointer when hovering over monster
            const monsterPos = monster.getComponent('Position');
            const tileX = Math.floor(monsterPos.x / this.TILE_SIZE);
            const tileY = Math.floor(monsterPos.y / this.TILE_SIZE);
            const targetX = tileX * this.TILE_SIZE;
            const targetY = tileY * this.TILE_SIZE;
            this.setMovementTarget(targetX, targetY);
            return;
        }
        
        this.setMovementTarget(worldX, worldY);
    }

    setMovementTarget(worldX, worldY) {
        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
        const tileX = Math.floor(worldX / this.TILE_SIZE);
        const tileY = Math.floor(worldY / this.TILE_SIZE);

        if (tileX < 0 || tileX >= this.state.WIDTH || tileY < 0 || tileY >= this.state.HEIGHT) {
            //console.log(`MouseInputSystem: Target tile (${tileX}, ${tileY}) out of bounds`);
            return;
        }

        const levelEntity = this.entityManager.getEntity(`level_${gameState.tier}`);
        if (!levelEntity) {
            console.warn(`MouseInputSystem: No level entity for tier ${gameState.tier}`);
            return;
        }

        const map = levelEntity.getComponent('Map').map;
        if (!map[tileY] || map[tileY][tileX] === 1) {
            //console.log(`MouseInputSystem: Tile (${tileX}, ${tileY}) is a wall`);
            return;
        }

        const targetX = tileX * this.TILE_SIZE;
        const targetY = tileY * this.TILE_SIZE;
        const player = this.player;
        const moveDx = targetX - player.getComponent('Position').x;
        const moveDy = targetY - player.getComponent('Position').y;
        this.entityManager.addComponentToEntity('player', new MouseTargetComponent(targetX, targetY));
        ////console.log(`MouseInputSystem: Setting movement target to (${targetX.toFixed(2)}, ${targetY.toFixed(2)}) for tile (${tileX}, ${tileY}), direction: (${moveDx.toFixed(2)}, ${moveDy.toFixed(2)})`);
    }

    getMonsterAtPosition(worldX, worldY) {
        const monsters = this.entityManager.getEntitiesWith(['MonsterData', 'Position', 'Hitbox', 'Health', 'Visuals']);
        for (const monster of monsters) {
            if (monster.getComponent('Health').hp <= 0) continue;
            const pos = monster.getComponent('Position');
            const visuals = monster.getComponent('Visuals');

            const hitboxWidth = visuals.w + this.HITBOX_BUFFER * 2;
            const hitboxHeight = visuals.h + this.HITBOX_BUFFER * 2;
            const hitboxLeft = pos.x - this.HITBOX_BUFFER;
            const hitboxRight = pos.x + visuals.w + this.HITBOX_BUFFER;
            const hitboxTop = pos.y - this.HITBOX_BUFFER;
            const hitboxBottom = pos.y + visuals.h + this.HITBOX_BUFFER;

            if (
                worldX >= hitboxLeft &&
                worldX <= hitboxRight &&
                worldY >= hitboxTop &&
                worldY <= hitboxBottom
            ) {
                const centerX = pos.x + visuals.w / 2;
                const centerY = pos.y + visuals.h / 2;
                const dx = worldX - centerX;
                const dy = worldY - centerY;
                //console.log(`MouseInputSystem: Hit monster ${monster.id}, distance from center: ${Math.sqrt(dx * dx + dy * dy).toFixed(2)} pixels`);


                const playerPos = this.entityManager.getEntity('player').getComponent('Position');
                const rx = pos.x + visuals.w / 2 - playerPos.x;
                const ry = pos.y + visuals.h / 2 - playerPos.y;
                const distance = Math.sqrt(rx * rx + ry * ry);
                //console.log(`MouseInputSystem: Hit monster ${monster.id}, distance from player: ${distance.toFixed(2)} pixels`);
                const range = Math.floor(distance / this.TILE_SIZE);
                return { monster, range };
            }
        }
        return null;
    }

    getWorldCoordinates(event) {
        const rect = this.canvas.getBoundingClientRect();
        const pixelX = (event.clientX - rect.left) / this.SCALE_FACTOR;
        const pixelY = (event.clientY - rect.top) / this.SCALE_FACTOR;
        const player = this.player;
        const playerPos = player.getComponent('Position');
        const viewportWidth = this.canvas.width / this.SCALE_FACTOR;
        const viewportHeight = this.canvas.height / this.SCALE_FACTOR;
        const mapWidth = this.state.WIDTH * this.TILE_SIZE;
        const mapHeight = this.state.HEIGHT * this.TILE_SIZE;
        let startX = playerPos.x - viewportWidth / 2;
        let startY = playerPos.y - viewportHeight / 2;
        startX = Math.max(0, Math.min(startX, mapWidth - viewportWidth));
        startY = Math.max(0, Math.min(startY, mapHeight - viewportHeight));
        return { worldX: pixelX + startX, worldY: pixelY + startY };
    }

    destroy() {
        if (this.canvas) {
            this.canvas.removeEventListener('mousedown', this.handleMouseDown);
            this.canvas.removeEventListener('mouseup', this.handleMouseUp);
            this.canvas.removeEventListener('mousemove', this.handleMouseMove);
            this.canvas.removeEventListener('contextmenu', (e) => e.preventDefault());
            window.removeEventListener('resize', () => this.handleResize());
        }
        this.eventBus.off('LevelAdded', this.clearMovement);
        //console.log('MouseInputSystem destroyed');
    }
}

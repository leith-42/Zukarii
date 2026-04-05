// systems/LevelTransitionSystem.js - Updated
import { PortalBindingComponent, PortalInteractionComponent, StashComponent } from '../core/Components.js';
import { System } from '../core/Systems.js';

export class LevelTransitionSystem extends System {
    constructor(entityManager, eventBus, utilities) {
        super(entityManager, eventBus, utilities);
        this.requiredComponents = ['Map', 'Tier', 'Exploration'];
        this.pendingTransition = null;
    }
     
    init() {
        this.levelTransition = this.entityManager.getEntity('gameState').getComponent('LevelTransition');
        this.eventBus.on('LevelAdded', (data) => this.handleLevelAdded(data));
        this.eventBus.on('TransitionLoad', ({ tier, data }) => this.transitionViaLoad(tier, data));
        this.lightingState = this.entityManager.getEntity('lightingState').getComponent('LightingState');
        this.player = this.entityManager.getEntity('player');
    }

    update(deltaTime) {

        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        if (this.levelTransition.pendingTransition) {
            gameState.transitionLock = true;
            this.pendingTransition = this.levelTransition.pendingTransition;
            console.log('LevelTransitionSystem: Processing pending transition:', this.pendingTransition);
            this.levelTransition.pendingTransition = null;

            // Close the dialogue to prevent repeated teleportation
            const dialogue = this.entityManager.getEntity('dialogueState').getComponent('Dialogue');
            if (dialogue) {
                dialogue.isOpen = false;
                dialogue.text = '';
                dialogue.options = [];
                dialogue.npcId = '';
                dialogue.dialogueStage = 'greeting';
            }
            // remove PortalInteraction component if it exists
            if (this.player.hasComponent('PortalInteraction')) {
                this.player.removeComponent('PortalInteraction');
            }

            switch (this.pendingTransition) {
                case 'portal':
                    let destinationTier;
                    if (this.levelTransition.destinationTier === null || this.levelTransition.destinationTier === undefined) {
                        destinationTier = null;
                    } else {
                        destinationTier = this.levelTransition.destinationTier || 0;
                    }
                    this.transitionViaPortal(deltaTime, destinationTier);
                    break;
                case 'teleportToTier':
                    const transition = this.entityManager.getEntity('gameState').getComponent('LevelTransition');

                    console.log('LevelTransitionSystem: Teleporting to tier:', transition.destinationTier);
                    this.transitionViaPortal(deltaTime, transition.destinationTier);
                    transition.destinationTier = null; // Clear after use
                    break;
                case 'down':
                    this.transitionDown();
                    break;
                case 'up':
                    this.transitionUp();
                    break;

                default:
                    console.error('LevelTransitionSystem: No method found for Unknown pending transition:', this.pendingTransition);
                    break;
                break;
            }
            
        }
            
    }

    findAdjacentTile(stairX, stairY) {
        console.log(`findAdjacentTile: Checking tiles around stair (${stairX}, ${stairY})`);
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        const levelTransition = this.entityManager.getEntity('gameState').getComponent('LevelTransition');
        const { dx, dy } = levelTransition.lastMovementDirection || { dx: 0, dy: 0 };
        console.log(`findAdjacentTile: Player movement direction: dx=${dx}, dy=${dy}`);

        // Normalize dx and dy to -1, 0, or 1 for simplicity
        const normalizedDx = dx !== 0 ? (dx > 0 ? 1 : -1) : 0;
        const normalizedDy = dy !== 0 ? (dy > 0 ? 1 : -1) : 0;

        // Determine the primary axis of movement
        const isXAxisMovement = normalizedDx !== 0 && normalizedDy === 0;
        const isYAxisMovement = normalizedDx === 0 && normalizedDy !== 0;
        const isDiagonalMovement = normalizedDx !== 0 && normalizedDy !== 0;

        const TILE_SIZE = 32; // Match the TILE_SIZE used elsewhere

        // Prioritize directions based on the axis of movement
        const directions = [];
        if (isYAxisMovement) {
            if (normalizedDy > 0) {
                directions.push({ x: stairX, y: stairY + 1 }); // Down
                directions.push({ x: stairX, y: stairY - 1 }); // Up
            } else {
                directions.push({ x: stairX, y: stairY - 1 }); // Up
                directions.push({ x: stairX, y: stairY + 1 }); // Down
            }
            directions.push({ x: stairX - 1, y: stairY }); // Left
            directions.push({ x: stairX + 1, y: stairY }); // Right
        } else if (isXAxisMovement) {
            if (normalizedDx > 0) {
                directions.push({ x: stairX + 1, y: stairY }); // Right
                directions.push({ x: stairX - 1, y: stairY }); // Left
            } else {
                directions.push({ x: stairX - 1, y: stairY }); // Left
                directions.push({ x: stairX + 1, y: stairY }); // Right
            }
            directions.push({ x: stairX, y: stairY - 1 }); // Up
            directions.push({ x: stairX, y: stairY + 1 }); // Down
        } else if (isDiagonalMovement) {
            if (normalizedDx > 0) {
                directions.push({ x: stairX + 1, y: stairY }); // Right
                directions.push({ x: stairX - 1, y: stairY }); // Left
            } else {
                directions.push({ x: stairX - 1, y: stairY }); // Left
                directions.push({ x: stairX + 1, y: stairY }); // Right
            }
            if (normalizedDy > 0) {
                directions.push({ x: stairX, y: stairY + 1 }); // Down
                directions.push({ x: stairX, y: stairY - 1 }); // Up
            } else {
                directions.push({ x: stairX, y: stairY - 1 }); // Up
                directions.push({ x: stairX, y: stairY + 1 }); // Down
            }
        } else {
            directions.push({ x: stairX - 1, y: stairY }); // Left
            directions.push({ x: stairX + 1, y: stairY }); // Right
            directions.push({ x: stairX, y: stairY - 1 }); // Up
            directions.push({ x: stairX, y: stairY + 1 }); // Down
        }

        for (const dir of directions) {
            // Convert tile coordinates to pixel coordinates for collision check
            const pixelX = dir.x * TILE_SIZE;
            const pixelY = dir.y * TILE_SIZE;
            // Check for collisions at this position
            const collidingEntities = this.entityManager.getEntitiesWith(['Position', 'Hitbox']).filter(e => {
                const pos = e.getComponent('Position');
                return pos.x === pixelX && pos.y === pixelY && e.id !== 'player';
            });
            if (collidingEntities.length === 0) {
                console.log(`findAdjacentTile: Found walkable tile at (${dir.x}, ${dir.y})`);
                return { x: dir.x, y: dir.y };
            } else {
                console.log(`findAdjacentTile: Tile at (${dir.x}, ${dir.y}) is not walkable due to collisions with:`, collidingEntities.map(e => e.id));
            }
        }

        console.warn(`findAdjacentTile: No adjacent walkable tile found near (${stairX}, ${stairY})`);
        throw new Error(`No adjacent walkable tile found near (${stairX}, ${stairY})`);
    }

    clearLevelEntities(tier) {
        const entities = this.entityManager.getEntitiesWith(['Tier']).filter(e => e.getComponent('Tier').value === tier);
        entities.forEach(entity => this.entityManager.removeEntity(entity.id));
        const tierEntities = this.entityManager.entitiesByTier.get(tier) || new Map();
        tierEntities.forEach((_, id) => this.entityManager.removeEntity(id));
    }

    clearPlayerPosition() {

        const playerPos = this.player.getComponent('Position');
        const oldPlayerPos = { x: playerPos.x, y: playerPos.y };

        this.eventBus.emit('ClearOldPlayerPosition', oldPlayerPos);
    }

    transitionDown() {
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        const renderControl = this.entityManager.getEntity('renderState').getComponent('RenderControl');
        if (gameState.tier >= Number.MAX_SAFE_INTEGER) return;

        renderControl.locked = true;
        console.log('LevelTransitionSystem: Render locked for TransitionDown');

        const newTier = gameState.tier + 1;
        gameState.tier = newTier;

        this.eventBus.emit('AddLevel', { tier: newTier });
    }

    transitionUp() {
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        const renderControl = this.entityManager.getEntity('renderState').getComponent('RenderControl');
        if (gameState.tier === 0 ) {
        //if (gameState.tier === 0 || gameState.tier === 1) {
            this.eventBus.emit('PlayerExit', {});
            return;
        }

        renderControl.locked = true;
        console.log('LevelTransitionSystem: Render locked for TransitionUp');

        const newTier = gameState.tier - 1;
        gameState.tier = newTier;

        this.eventBus.emit('AddLevel', { tier: newTier });
    }

    randomizeTier(currentTier) {
        // Normal range: can go down to 0, up to currentTier + 5
        let minTier = Math.max(0, currentTier - 1);
        let maxTier = currentTier + 5;

        let destinationTier;
        do {
            destinationTier = Math.floor(Math.random() * (maxTier - minTier + 1)) + minTier;
        } while (destinationTier === currentTier);

        // Risk chance: expand range, still allow 0, never currentTier
        const riskChance = Math.floor(currentTier / 10);
        if (Math.random() < riskChance / 100) {
            minTier = Math.max(0, currentTier - 2);
            maxTier = currentTier + 10;
            do {
                destinationTier = Math.floor(Math.random() * (maxTier - minTier + 1)) + minTier;
            } while (destinationTier === currentTier);
        }

        return destinationTier;
    }

    transitionViaPortal(deltaTime, destinationTier = null) {
        console.warn('LevelTransitionSystem:  transitionViaPortal called with destinationTier:', destinationTier);
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        const renderControl = this.entityManager.getEntity('renderState').getComponent('RenderControl');
        const currentLevel = this.entityManager.getEntitiesWith(['Tier']).find(e => e.getComponent('Tier').value === gameState.tier);
        if (!currentLevel) return;

        const currentTier = gameState.tier;
        
        console.warn('LevelTransitionSystem: Starting transitionViaPortal for currentTier:', currentTier, 'destinationTier:', destinationTier);
        if ((destinationTier === null || destinationTier === undefined) && destinationTier !==0) {
            destinationTier = this.randomizeTier(currentTier);
        }
        let teleportMessage = `You step through a mysterious portal surging with chaotic energy and are transported to Tier`;

        if (this.pendingTransition== 'teleportToTier') {
            teleportMessage = `The power of the stone surges with chaotic energy and instsantly transports you to Tier`;
        }
        this.utilities.logMessage({ channel: "system", message: `${teleportMessage} ${destinationTier}!` });
        gameState.tier = destinationTier;

        const transitionDirection = destinationTier > currentTier ? 'down' : destinationTier < currentTier ? 'up' : null;
        
        renderControl.locked = true;
        console.log('LevelTransitionSystem: Render locked for TransitionViaPortal');

        //this.eventBus.emit('RenderNeeded');
        gameState.needsRender = true;
        this.eventBus.emit('AddLevel', { tier: destinationTier, transitionDirection });
        console.warn('LevelTransitionSystem: Emitted AddLevel for destinationTier:', destinationTier);
        const sfxQueue = this.entityManager.getEntity('gameState').getComponent('AudioQueue').SFX || [];

        setTimeout(() => { sfxQueue.push({ sfx: 'portal1', volume: .5 }); }, 1000 * deltaTime);
    }
    

    transitionViaLoad(tier, data) {
        console.log('LevelTransitionSystem: Starting transitionViaLoad for tier:', tier);

        // Update gameState
        const gameState = this.entityManager.getEntity('gameState');
        const gameStateComp = gameState.getComponent('GameState');
        Object.assign(gameStateComp, data.gameState.GameState);
        gameStateComp.tier = tier;
 
        // Restore journey-related components for gameState
        if (data.gameState.JourneyPaths) {
            /*
            const journeyPathsComp = gameState.getComponent('JourneyPaths');
            journeyPathsComp.paths = data.gameState.JourneyPaths.paths; // Deep copy to preserve arrays
            console.log('LevelTransitionSystem: Restored JourneyPaths:', journeyPathsComp.paths);
            */
            console.log('LevelTransitionSystem: Skipping JourneyPaths resotre to preserve original data journeyPaths.json:', data.gameState.JourneyPaths);
        }
        if (data.gameState.OfferedJourneys) {
            const offeredJourneysComp = gameState.getComponent('OfferedJourneys');
            offeredJourneysComp.journeys = data.gameState.OfferedJourneys.journeys; // Deep copy to preserve arrays
            console.log('LevelTransitionSystem: Restored OfferedJourneys:', offeredJourneysComp.journeys);
        }
        if (data.gameState.GameState.highestTier) {
            gameStateComp.highestTier = data.gameState.GameState.highestTier; // Ensure highestTier is restored
            console.warn('LevelTransitionSystem: Restored highestTier:', gameStateComp.highestTier);
        }

        // Update player (exclude Position)
        const player = this.entityManager.getEntity('player');
        console.log('Player Data: ', data.player);
        Object.entries(data.player).forEach(([compName, compData]) => {
            if (compName !== 'Position') {
                const comp = player.getComponent(compName);
                console.log(`Updating ${compName} component for player:`, comp);
                if (comp) {
                    if (compName === 'JourneyState') {
                        comp.completedPaths = compData.completedPaths; // Deep copy to preserve arrays
                        console.log('LevelTransitionSystem: Restored JourneyState:', comp.completedPaths);
                    } else if (compName === 'JourneyPath') {
                        comp.paths = compData.paths; // Deep copy to preserve arrays
                        console.log('LevelTransitionSystem: Restored JourneyPath:', comp.paths);
                    } else {
                        Object.assign(comp, compData);
                    }
                }
            }
        });

        // Restore PortalBindingComponent if it exists in saved data
        if (data.player.PortalBinding) {
            console.log('LevelTransitionSystem: Restoring PortalBindingComponent:', data.player.PortalBinding);
            this.entityManager.addComponentToEntity('player', new PortalBindingComponent(data.player.PortalBinding));
        } else {
            console.warn('LevelTransitionSystem: No PortalBindingComponent found in saved data');
        }

        // Restore StashComponent if it exists in saved data (backward compatibility)
        if (data.player.Stash) {
            console.log('LevelTransitionSystem: Restoring StashComponent:', data.player.Stash);
            this.entityManager.addComponentToEntity('player', new StashComponent({
                items: data.player.Stash.items || [],
                maxCapacity: data.player.Stash.maxCapacity || 100,
                accessCost: data.player.Stash.accessCost || 0,
                requiresNearby: data.player.Stash.requiresNearby || false
            }));
        } else {
            console.log('LevelTransitionSystem: No StashComponent found in saved data (backward compatibility)');
        }

        // Update overlay
        const overlayState = this.entityManager.getEntity('overlayState').getComponent('OverlayState');
        Object.assign(overlayState, data.overlayState.OverlayState);

        // Clear and regenerate level
        let levelEntity = this.entityManager.getEntitiesWith(['Map', 'Tier']).find(e => e.getComponent('Tier').value === tier);
        if (tier !== 0 && levelEntity) {
            this.clearLevelEntities(tier);
        }

        this.pendingTransition = 'load';
        this.eventBus.emit('AddLevel', { tier });

        /*

        // Set pendingTransition to 'load' to indicate a load operation
        if (tier !== 0) {
            this.pendingTransition = 'load';
            this.eventBus.emit('AddLevel', { tier });
        } else {
            console.log('LevelTransitionSystem: Tier 0 load, preserving existing setup');
            gameStateComp.needsInitialRender = true;
            gameStateComp.needsRender = true;
            this.eventBus.emit('PlayerStateUpdated', { entityId: 'player' });
            this.eventBus.emit('JourneyStateUpdated');
            const healthUpdates = this.entityManager.getEntity('gameState').getComponent('DataProcessQueues').HealthUpdates;
            healthUpdates.push({ entityId: 'player', amount: 0 });

            this.updatePortalsForTier(tier);
            this.eventBus.emit('GearChanged', { entityId:'player' });

        }
        */
    } 

    handleLevelAdded({ tier, entityId }) {
        this.entityManager.setActiveTier(tier);
        this.eventBus.emit('PlayTrackControl', { track: 'fountain_loop', play: false, fadeOut: 1.0 });
        console.log(`LevelAdded event for tier ${tier}, entityId: ${entityId}`);
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        const renderControl = this.entityManager.getEntity('renderState').getComponent('RenderControl');
        const player = this.entityManager.getEntity('player');
        const levelEntity = this.entityManager.getEntity(entityId);
        console.log('ActiveTier: ', this.entityManager.getActiveTier());
        const allLevelEntities = this.entityManager.getEntitiesWith(['Map', 'Tier']);
        console.log('LevelTransitionSystem: All level entities:', allLevelEntities);
        //console.log('LevelTransitionSystem: Level entity:', levelEntity.id, levelEntity);
        
        if (!levelEntity) {
            console.error(`Level entity for tier ${tier} not found after LevelAdded event`);
            return;
        }

        const mapComp = levelEntity.getComponent('Map');
        const explorationComp = levelEntity.getComponent('Exploration');
        const entityList = levelEntity.getComponent('EntityList');
        const playerPos = player.getComponent('Position');
        console.log("LevelTransitionSystem: Player position before transition:", playerPos.x, playerPos.y);
        let pos;

        const isNewTier = tier > gameState.highestTier;

        // Update highestTier if needed
        if (isNewTier) {
            gameState.highestTier = tier;
            this.eventBus.emit('AwardXp', { amount: 5 * tier });
            this.eventBus.emit('LogMessage', { message: `You Reached Tier ${tier}` });
        }

        const TILE_SIZE = 32; // Match LevelSystem's TILE_SIZE

        if (this.pendingTransition === 'down') {
            const upStair = mapComp.stairsUp;
            console.log(`LevelTransitionSystem: Transition down to tier ${tier}, positioning near stairsUp at (${upStair.x}, ${upStair.y})`);
            pos = this.findAdjacentTile(upStair.x, upStair.y);
        } else if (this.pendingTransition === 'up') {
            const downStair = mapComp.stairsDown;
            console.log(`LevelTransitionSystem: Transition up to tier ${tier}, positioning near stairsDown at (${downStair.x}, ${downStair.y})`);
            pos = this.findAdjacentTile(downStair.x, downStair.y);
        } else if (this.pendingTransition === 'portal' || this.pendingTransition === 'teleportToTier' || this.pendingTransition === 'load') {
            const upStair = mapComp.stairsUp;
            console.log(`LevelTransitionSystem: Transition via portal/load to tier ${tier}, positioning near stairsUp at (${upStair.x}, ${upStair.y})`);
            pos = this.findAdjacentTile(upStair.x, upStair.y);
        } else {
            // Fallback case (shouldn't typically happen, but preserved for safety)
            const stairsDown = entityList.stairsDown || { x: 22, y: 22 };
            console.log(`LevelTransitionSystem: Fallback positioning near stairsDown at (${stairsDown.x}, ${stairsDown.y})`);
            pos = this.findAdjacentTile(stairsDown.x, stairsDown.y);
        }

        if (tier > 1) {
            this.eventBus.emit('ClearOldPlayerPosition', { x: playerPos.x, y: playerPos.y });
        }

        // Convert tile coordinates to pixel coordinates
        const pixelX = pos.x * TILE_SIZE;
        const pixelY = pos.y * TILE_SIZE;
        playerPos.x = pixelX;
        playerPos.y = pixelY;

        this.entityManager.removeComponentFromEntity('player', 'MovementIntent');
        console.log('LevelTransitionSystem: Cleared player MovementIntent after positioning');

        // Reset player animation to idle
        const playerAnimation = player.getComponent('AnimationState');
        if (playerAnimation) {
            playerAnimation.isIdle = true;
            playerAnimation.isWalking = false;
            console.log('LevelTransitionSystem: Reset player animation to idle');
        }

        const animation = player.getComponent('Animation');
        if (animation) {
            animation.currentAnimation = 'idle';
            animation.currentFrame = 0;
            animation.frameTimer = 0;
        }


        console.log(`LevelTransitionSystem: Player position updated to pixel (${playerPos.x}, ${playerPos.y}) for tile (${pos.x}, ${pos.y})`);
        console.log("LevelTransitionSystem: Tile at player position:", mapComp.map[pos.y][pos.x]);

        // Clear lastMovementDirection to avoid stale data
        const levelTransition = this.entityManager.getEntity('gameState').getComponent('LevelTransition');
        levelTransition.lastMovementDirection = { dx: 0, dy: 0 };
        console.log('LevelTransitionSystem: Cleared lastMovementDirection after positioning');

        // Verify no wall entity exists at the player's position
        const collidingEntities = this.entityManager.getEntitiesWith(['Position', 'Hitbox']).filter(e => {
            const pos = e.getComponent('Position');
            return pos.x === playerPos.x && pos.y === playerPos.y && e.id !== 'player' ;
        });
        if (collidingEntities.length > 0) {
            console.error(`LevelTransitionSystem: Player landed in a collision at (${playerPos.x}, ${playerPos.y})! Entities present:`, collidingEntities.map(e => e.id));
        }

        if (isNewTier) {
            explorationComp.discoveredWalls.clear();
            explorationComp.discoveredFloors.clear();
        }

        gameState.needsInitialRender = true;
        gameState.needsRender = true;
        gameState.transitionLock = true;
        

        renderControl.locked = false;
        console.log('LevelTransitionSystem: Render unlocked');

        this.eventBus.emit('DiscoveredStateUpdated', { tier, entityId });

       gameState.transitionLock = false;

        console.log('Pending transition after switch:', this.pendingTransition, 'Tier:', tier);
      
        this.pendingTransition = null;
        this.eventBus.emit('GearChanged', { entityId: 'player' });
        // Trigger UI update after loading
        this.eventBus.emit('PlayerStateUpdated', { entityId: 'player' });
        
        const healthUpdates = this.entityManager.getEntity('gameState').getComponent('DataProcessQueues').HealthUpdates;
        healthUpdates.push({ entityId: 'player', amount: 0 }); 

        //if (tier < 11) {
            this.updatePortalsForTier(tier);
        //}
    }

    updatePortalsForTier(tier) {
        console.warn(`LevelTransitionSystem: updatePortalsForTier called for tier ${tier}`);
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        const portals = this.entityManager.getEntitiesWith(['Portal', 'Visuals', 'Position']);
        const player = this.entityManager.getEntity('player');
        console.warn(`LevelTransitionSystem: Found player `, player);
        let cleansedPortals = [];
        if (player.hasComponent('PortalBinding')) {
            const portalBinding = player.getComponent('PortalBinding');
            console.warn(`LevelTransitionSystem: PortalBinding for player:`, portalBinding);
            cleansedPortals = portalBinding.cleansed || [];
        }
        const unlockedPortals = this.player.getComponent('PlayerAchievements').stats.unlockedPortals || [];

        for (const portalEntity of portals) {
            // Only update portals on the current tier
            //const entityTier = parseInt(portalEntity.id.split('_')[1], 10) || 0;
            //if (entityTier !== tier) continue;
            console.warn(`LevelTransitionSystem: Updating portal for tier ${tier} on entity ${portalEntity.id}`);
            const portalComp = portalEntity.getComponent('Portal');
            const visuals = portalEntity.getComponent('Visuals');
            
            let visualsImg = 'img/anim/Portal-Animation.png';
            let cleansed = false;
            let active = portalComp.active; // default to current state
            let lightsourceDefinition = null;
            console.warn(`LevelTransitionSystem: Portal visuals before update:`, visuals.avatar);

            if (cleansedPortals.includes(tier) || unlockedPortals.includes(tier)) {
                active = true;
                cleansed = true;
                visualsImg = 'img/anim/Portal-Animation-Cleansed.png';
                lightsourceDefinition = 'portalGreen';
            } else if (tier < 11 && gameState.highestTier < 11) {
                active = false;
                cleansed = false;
                visualsImg = 'img/avatars/inactive-portal.png';
            } else if (tier < 11 && gameState.highestTier >= 11) {
                active = true;
                cleansed = true;
                visualsImg = 'img/anim/Portal-Animation-Cleansed.png';
                lightsourceDefinition = 'portalGreen';
            }
            portalComp.active = active;
            portalComp.cleansed = cleansed;
            visuals.avatar = visualsImg;
            console.warn(`LevelTransitionSystem: Portal visuals after update:`, visuals.avatar);
            if (lightsourceDefinition) {
                this.eventBus.emit('LightSourceActivated', ({ type: lightsourceDefinition, entityId: portalEntity.id }));
                console.warn(`LevelTransityionSystem: UpdatePortalsForTier - emitted light source activation request for portal at tier ${tier} with definition ${lightsourceDefinition}`);
            }
        }

        /*
        if (entityList.portals.length > 0) {
            const portal = this.entityManager.getEntity(entityList.portals[0]);
            const portalComp = portal.getComponent('Portal');
            const visuals = portal.getComponent('Visuals') || new VisualsComponent(this.TILE_SIZE, this.TILE_SIZE);
            let lightsourceDefinition = null;

            const player = this.entityManager.getEntity('player');
            const unlockedPortals = player.getComponent('PlayerAchievements').stats.unlockedPortals || [];
            const cleansedPortals = player.getComponent('PortalBindingds')?.cleansed || [];
            console.warn(`checkLevelAfterTransition: updatePortal - Starting for tier ${tier}`, unlockedPortals, cleansedPortals);
            if (portalComp && cleansedPortals.includes(tier) || unlockedPortals.includes(tier)) {
                portalComp.active = true;
                portalComp.cleansed = true;
                visuals.avatar = 'img/anim/Portal-Animation-Cleansed.png';
                lightsourceDefinition = 'portalGreen';
            } 
            if (lightsourceDefinition) {
            this.eventBus.emit('LightSourceActivated', ({ type: lightsourceDefinition, entityId: portalEntity.id }));
            console.log(`LevelSystem: generatePortal - emitted light source activation request for portal at tier ${ tier } with definition ${ lightsourceDefinition }`);
            }

        }
        */
    }

}  
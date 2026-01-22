import { System } from '../core/Systems.js';

export class MapRenderSystem extends System {
    constructor(entityManager, eventBus, state) {
        super(entityManager, eventBus);
        this.state = state;
        this.requiredComponents = ['Position', 'Visuals'];
        this.canvas = null;
        this.ctx = null;
        this.TILE_SIZE = 32;
        this.SCALE_FACTOR = 2;
        this.sprites = new Map();
        this.lightingCanvas = null;
        this.floorBuffer = null;
        this.floorBufferCtx = null;
        this.lastFloorStartX = null;
        this.lastFloorStartY = null;
        this.lastFloorWidth = null;
        this.lastFloorHeight = null;
        this.initializeCanvas();
        this.loadSprites();
        window.addEventListener('resize', () => this.resizeCanvas());
        // Portal animation properties
        this.portalFrameCount = 9;
        this.portalFrameWidth = 128;
        this.portalFrameHeight = 128;
        this.portalRenderWidth = 144;
        this.portalRenderHeight = 144;
        this.portalFrameDuration = 200;
        this.portalCurrentFrame = 0;
        this.lastPortalFrameTime = Date.now();
        // Fountain animation properties
        this.fountainFrameCount = 10;
        this.fountainFrameWidth = 384;
        this.fountainFrameHeight = 384;
        this.fountainRenderWidth = 144;
        this.fountainRenderHeight = 144;
        this.fountainFrameDuration = 120;
        this.fountainCurrentFrame = 0;
        this.lastFountainFrameTime = Date.now();

        // Floor buffer for optimized floor rendering
        this.floorBuffer = document.createElement('canvas');
        this.floorBufferCtx = this.floorBuffer.getContext('2d');
        this.lastFloorStartX = null;
        this.lastFloorStartY = null;
        this.lastFloorWidth = null;
        this.lastFloorHeight = null;
    }

    init() {
        console.log('MapRenderSystem: Loaded sprites:', Array.from(this.sprites.entries()));
    }

    initializeCanvas() {
        this.canvas = document.getElementById('viewport-canvas');
        if (!this.canvas) {
            console.error('MapRenderSystem: Canvas element with id="viewport-canvas" not found');
            return;
        }
        this.ctx = this.canvas.getContext('2d');
        // Initialize floor buffer after main canvas is available
        this.floorBuffer = document.createElement('canvas');
        this.floorBufferCtx = this.floorBuffer.getContext('2d');
        this.resizeCanvas();
    }

    resizeCanvas() {
        if (!this.canvas) return;
        this.canvas.width = Math.min(window.innerWidth, 1920);
        this.canvas.height = Math.min(window.innerHeight, 1080);
        // Also resize the floor buffer if it exists
        if (this.floorBuffer) {
            this.floorBuffer.width = this.canvas.width;
            this.floorBuffer.height = this.canvas.height;
        }
        // Force redraw of floor buffer on next update
        this.lastFloorStartX = null;
        this.lastFloorStartY = null;
        this.lastFloorWidth = null;
        this.lastFloorHeight = null;
        window.canvasSize = { h: this.canvas.height, w: this.canvas.width };

    }

    loadSprites() {
        const spritePaths = {
            floor: 'img/map/floor-gray-brick.png',
            wall: 'img/map/wall.png',
            player: 'img/avatars/player.png',
            stairsup: 'img/avatars/stairsup.png',
            stairsdown: 'img/avatars/stairsdown.png',
            portal: 'img/anim/Portal-Animation.png',
            inactivePortal: 'img/avatars/inactive-portal.png',
            cleansedPortal: 'img/anim/Portal-Animation-Cleansed.png',
            chest: 'img/avatars/chest.png',
            fountain: 'img/anim/fountain/128x64_fountain_stone_shadow_anim.png',
            inactiveFountain: 'img/avatars/fountain.png',
            player_idle: 'img/anim/Player/Idle.png',
            player_walk: 'img/anim/Player/Walk.png',
            player_walk_down: 'img/anim/Player/Walk_Down.png',
            player_walk_up: 'img/anim/Player/Walk_Up.png',
            player_attack: 'img/anim/Player/Attack_Fire_3.png',
            npc_zu_master: 'img/avatars/npcs/zu-master.png',
            npc_merchant: 'img/avatars/npcs/merchant.png',
            shop_counter: 'img/avatars/shop-counter.png',
            ashangal_guardian: `img/avatars/ashangal_guardian.png`,
        };
        for (const [key, path] of Object.entries(spritePaths)) {
            const img = new Image();
            img.src = path;
            img.onload = () => console.log(`${key} sprite preloaded at ${path}`);
            img.onerror = () => console.error(`Failed to preload sprite: ${path}`);
            this.sprites.set(path, img);
        }
    }

    getEntitiesInViewport(startX, startY, endX, endY, bucketsComp) {
        const entities = [];
        const bucketSize = 16;
        const startBucketX = Math.floor(startX / this.TILE_SIZE / bucketSize);
        const startBucketY = Math.floor(startY / this.TILE_SIZE / bucketSize);
        const endBucketX = Math.floor(endX / this.TILE_SIZE / bucketSize);
        const endBucketY = Math.floor(endY / this.TILE_SIZE / bucketSize);

        for (let by = startBucketY; by <= endBucketY; by++) {
            for (let bx = startBucketX; bx <= endBucketX; bx++) {
                const bucketKey = `${bx},${by}`;
                const bucket = bucketsComp.buckets.get(bucketKey) || [];
                for (const entityId of bucket) {
                    const entity = this.entityManager.getEntity(entityId);
                    if (!entity || !entity.hasComponent('Position') || !entity.hasComponent('Visuals')) continue;
                    const pos = entity.getComponent('Position');
                    if (pos.x >= startX && pos.x < endX && pos.y >= startY && pos.y < endY) {
                        entities.push(entity);
                    }
                }
            }
        }
        return entities;
    }

    interpolateColor(startColor, endColor, t) {
        const colors = {
            green: [0, 128, 0],
            yellow: [255, 255, 0],
            orange: [255, 165, 0],
            red: [255, 0, 0]
        };
        const startRGB = colors[startColor] || [0, 128, 0];
        const endRGB = colors[endColor] || [0, 128, 0];
        const r = Math.round(startRGB[0] + (endRGB[0] - startRGB[0]) * t);
        const g = Math.round(startRGB[1] + (endRGB[1] - startRGB[1]) * t);
        const b = Math.round(startRGB[2] + (endRGB[2] - startRGB[2]) * t);
        return `rgb(${r}, ${g}, ${b})`;
    }

    update(deltaTime) {
        if (!this.canvas || !this.ctx) {
            console.warn('MapRenderSystem: Canvas or context not initialized');
            return;
        }

        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
        if (!gameState?.gameStarted || !gameState.needsRender) return;

        const playerEntity = this.entityManager.getEntity('player');
        if (!playerEntity) return;

        const playerPos = playerEntity.getComponent('Position');
        if (!playerPos) return;

        const viewportWidth = this.canvas.width / this.SCALE_FACTOR;
        const viewportHeight = this.canvas.height / this.SCALE_FACTOR;

        const mapWidth = this.state.WIDTH * this.TILE_SIZE;
        const mapHeight = this.state.HEIGHT * this.TILE_SIZE;

        let startX = playerPos.x - viewportWidth / 2;
        let startY = playerPos.y - viewportHeight / 2;

        startX = Math.max(0, Math.min(startX, mapWidth - viewportWidth));
        startY = Math.max(0, Math.min(startY, mapHeight - viewportHeight));

        const endX = startX + viewportWidth;
        const endY = startY + viewportHeight;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // --- Optimized Floor Rendering ---
        const floorSprite = this.sprites.get('img/map/floor-gray-brick.png');
        const floorNeedsRedraw =
            this.lastFloorStartX !== startX ||
            this.lastFloorStartY !== startY ||
            this.lastFloorWidth !== this.canvas.width ||
            this.lastFloorHeight !== this.canvas.height;

        if (floorSprite && floorSprite.complete) {
            if (floorNeedsRedraw) {
                this.floorBuffer.width = this.canvas.width;
                this.floorBuffer.height = this.canvas.height;
                this.floorBufferCtx.save();
                this.floorBufferCtx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
                this.floorBufferCtx.clearRect(0, 0, this.floorBuffer.width, this.floorBuffer.height);
                this.floorBufferCtx.scale(this.SCALE_FACTOR, this.SCALE_FACTOR);
                this.floorBufferCtx.translate(-(startX % this.TILE_SIZE), -(startY % this.TILE_SIZE));
                const pattern = this.floorBufferCtx.createPattern(floorSprite, 'repeat');
                this.floorBufferCtx.fillStyle = pattern || 'black';
                const buffer = this.TILE_SIZE;
                this.floorBufferCtx.fillRect(0, 0, viewportWidth + buffer, viewportHeight + buffer);
                this.floorBufferCtx.restore();
                this.lastFloorStartX = startX;
                this.lastFloorStartY = startY;
                this.lastFloorWidth = this.canvas.width;
                this.lastFloorHeight = this.canvas.height;
            }
            this.ctx.drawImage(this.floorBuffer, 0, 0);
        } else {
            this.ctx.fillStyle = 'black';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        // --- The rest of your update method remains unchanged ---

        // Get level entity for active tier
        const levelEntity = this.entityManager.getEntity(`level_${this.entityManager.getActiveTier()}`);
        if (!levelEntity) return;

        // --- FLICKERING TORCH GLOW AROUND PLAYER --- 
        const lightingStateEntity = this.entityManager.getEntity('lightingState');
        const lightingState = lightingStateEntity ? lightingStateEntity.getComponent('LightingState') : null;
        const renderStateEntity = this.entityManager.getEntity('renderState');
        const renderState = renderStateEntity ? renderStateEntity.getComponent('RenderState') : null;

        if (lightingState && lightingState.isLit) {
            const baseRadius = lightingState.visibleRadius * this.TILE_SIZE * this.SCALE_FACTOR * 1.15;
            const flicker = 1 + 0.18 * (Math.random() - 0.5) + 0.08 * (Math.random() - 0.5);
            const radius = baseRadius * flicker;
            const playerScreenX = (playerPos.x - startX) * this.SCALE_FACTOR + this.TILE_SIZE * this.SCALE_FACTOR / 2;
            const playerScreenY = (playerPos.y - startY) * this.SCALE_FACTOR + this.TILE_SIZE * this.SCALE_FACTOR / 2;

            const gradient = this.ctx.createRadialGradient(
                playerScreenX, playerScreenY, this.TILE_SIZE * this.SCALE_FACTOR * 0.5,
                playerScreenX, playerScreenY, radius
            );
            /*
            gradient.addColorStop(0, 'rgba(255, 220, 120, 0.25)');
            gradient.addColorStop(0.5, 'rgba(255, 180, 60, 0.0666)');
            gradient.addColorStop(1, 'rgba(255, 180, 60, 0.0)');
            */
            gradient.addColorStop(0.0, 'rgba(255, 230, 180, 0.25)');
            gradient.addColorStop(0.3, 'rgba(255, 200, 140, 0.0666)');
            gradient.addColorStop(0.9, 'rgba(255, 200, 140, 0.0)');

            this.ctx.save();
            this.ctx.globalCompositeOperation = 'lighter';
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(playerScreenX, playerScreenY, radius, 0, 2 * Math.PI);
            this.ctx.fill();
            this.ctx.restore();
        }

        const bucketsComp = levelEntity.getComponent('SpatialBuckets');
        if (!bucketsComp) return;

        const buffer = this.TILE_SIZE;
        const bufferedStartX = startX - buffer;
        const bufferedStartY = startY - buffer;
        const bufferedEndX = endX + buffer;
        const bufferedEndY = endY + buffer;

        const entities = this.getEntitiesInViewport(bufferedStartX, bufferedStartY, bufferedEndX, bufferedEndY, bucketsComp);

        // Update portal animation frame
        const currentTime = Date.now();
        if (currentTime - this.lastPortalFrameTime >= this.portalFrameDuration) {
            this.portalCurrentFrame = (this.portalCurrentFrame + 1) % this.portalFrameCount;
            this.lastPortalFrameTime = currentTime;
        }

        // Update fountain animation frame
        if (currentTime - this.lastFountainFrameTime >= this.fountainFrameDuration) {
            this.fountainCurrentFrame = (this.fountainCurrentFrame + 1) % this.fountainFrameCount;
            this.lastFountainFrameTime = currentTime;
        }

        // --- ENTITY RENDER PASS ---
        for (const entity of entities) {
            if (entity.id === 'player') continue; // Skip player for this pass

            const pos = entity.getComponent('Position');
            const visuals = entity.getComponent('Visuals');
            if (!visuals) continue;

            let spritePath = visuals.avatar;
            let sprite = null;

            if (!spritePath) {
                if (entity.hasComponent('Wall')) {
                    spritePath = 'img/map/wall.png';
                } else if (entity.hasComponent('Stair')) {
                    const stairComp = entity.getComponent('Stair');
                    spritePath = stairComp.direction === 'up' ? 'img/avatars/stairsup.png' : 'img/avatars/stairsdown.png';
                } else if (entity.hasComponent('Portal')) {
                    const portalComp = entity.getComponent('Portal');
                    if (!portalComp.active) {
                        spritePath = 'img/avatars/inactive-portal.png';
                    } else {
                        if (portalComp.cleansed) {
                            spritePath = 'img/anim/Portal-Animation-Cleansed.png';
                        } else {
                            spritePath = 'img/anim/Portal-Animation.png';
                        }
                    }
                } else if (entity.hasComponent('LootData')) {
                    spritePath = 'img/avatars/chest.png';
                } else if (entity.hasComponent('NPCData')) {
                    spritePath = visuals.avatar || 'img/avatars/npcs/zu-master.png';
                }
            }
            if (!spritePath) continue;
            if (!this.sprites.has(spritePath)) {
                const img = new Image();
                img.src = spritePath;
                img.onload = () => console.log(`Dynamically loaded sprite: ${spritePath}`);
                img.onerror = () => console.error(`Failed to load sprite dynamically: ${spritePath}`);
                this.sprites.set(spritePath, img);
            }
            sprite = this.sprites.get(spritePath);
            if (!sprite || !sprite.complete) continue;

            const renderX = (pos.x - startX) * this.SCALE_FACTOR;
            const renderY = (pos.y - startY) * this.SCALE_FACTOR;
            this.ctx.save();
            if (entity.hasComponent('LightSource')) {
                const light = entity.getComponent('LightSource');
                if (light.glowEnabled && light.glowType === 'outline') {
                    this.ctx.shadowColor = light.glowColor;
                    this.ctx.shadowBlur = light.glowSize * light.currentGlowIntensity;
                }
            }
            if (entity.hasComponent('Portal')) {
                const portalComp = entity.getComponent('Portal');
                if (portalComp.active) {
                    const frameX = this.portalCurrentFrame * this.portalFrameWidth;
                    this.ctx.drawImage(
                        sprite,
                        frameX, 0,
                        this.portalFrameWidth, this.portalFrameHeight,
                        renderX, renderY,
                        this.portalRenderWidth, this.portalRenderHeight
                    );
                } else {
                    this.ctx.drawImage(
                        sprite,
                        renderX,
                        renderY,
                        visuals.w * this.SCALE_FACTOR,
                        visuals.h * this.SCALE_FACTOR
                    );
                }
            } else if (entity.hasComponent('Fountain')) {
                const fountainComp = entity.getComponent('Fountain');
                if (fountainComp.active) {
                    const actualFrame = this.fountainCurrentFrame + 2;
                    const frameX = (actualFrame % 4) * this.fountainFrameWidth;
                    const frameY = Math.floor(actualFrame / 4) * this.fountainFrameHeight;
                    this.ctx.drawImage(
                        sprite,
                        frameX, frameY,
                        this.fountainFrameWidth, this.fountainFrameHeight,
                        renderX, renderY,
                        this.fountainRenderWidth, this.fountainRenderHeight
                    );
                } else {
                    this.ctx.drawImage(
                        sprite,
                        renderX,
                        renderY,
                        this.fountainRenderWidth, this.fountainRenderHeight
                    );
                }
            } else if (entity.hasComponent('LootData')) {

                this.ctx.drawImage(
                    sprite,
                    renderX,
                    renderY,
                    visuals.w * this.SCALE_FACTOR,
                    visuals.h * this.SCALE_FACTOR
                );

            } else if (entity.hasComponent('MonsterData')) {
                const monsterData = entity.getComponent('MonsterData');

                if (visuals.faceLeft === true) {
                    this.ctx.scale(-1, 1);
                    this.ctx.drawImage(
                        sprite,
                        -(renderX + visuals.w * this.SCALE_FACTOR),
                        renderY,
                        visuals.w * this.SCALE_FACTOR,
                        visuals.h * this.SCALE_FACTOR
                    );
                } else {
                    this.ctx.drawImage(
                        sprite,
                        renderX,
                        renderY,
                        visuals.w * this.SCALE_FACTOR,
                        visuals.h * this.SCALE_FACTOR
                    );
                }
            } else if (visuals.faceLeft === true) {
                this.ctx.scale(-1, 1);
                this.ctx.drawImage(
                    sprite,
                    -(renderX + visuals.w * this.SCALE_FACTOR),
                    renderY,
                    visuals.w * this.SCALE_FACTOR,
                    visuals.h * this.SCALE_FACTOR
                );
            } else {
                this.ctx.drawImage(
                    sprite,
                    renderX,
                    renderY,
                    visuals.w * this.SCALE_FACTOR,
                    visuals.h * this.SCALE_FACTOR
                );
            }
            this.ctx.restore();
        }

        // Second pass: Render the player sprite (to ensure it appears on top)
        for (const entity of entities) {
            if (entity.id !== 'player') continue;

            const pos = entity.getComponent('Position');
            const visuals = entity.getComponent('Visuals');
            if (!visuals) continue;

            const animation = entity.hasComponent('Animation') ? entity.getComponent('Animation') : null;
            const animState = entity.hasComponent('AnimationState') ? entity.getComponent('AnimationState') : null;

            let spritePath = visuals.avatar;
            let sprite = null;

            if (animation && animState) {
                const animData = animation.animations[animation.currentAnimation];
                if (!animData) {
                    console.warn(`MapRenderSystem: No animation data for ${animation.currentAnimation} in ${entity.id}`);
                    continue;
                }
                let walkAnimCurrent = 'img/anim/Player/Walk.png';
                if (visuals.direction.dx === 0 && visuals.direction.dy < 0) {
                    walkAnimCurrent = 'img/anim/Player/Walk_Up.png';
                } else if (visuals.direction.dx === 0 && visuals.direction.dy > 0) {
                    walkAnimCurrent = 'img/anim/Player/Walk_Down.png';
                }
                console.log(visuals.direction, 'Selected walk animation:', walkAnimCurrent);
                // Use attack animation if isAttacking
                spritePath = animState.isAttacking ? 'img/anim/Player/Attack_Fire_3.png' :
                    animation.currentAnimation === 'idle' ? 'img/anim/Player/Idle.png' :
                        walkAnimCurrent;
                sprite = this.sprites.get(spritePath);
                if (!sprite || !sprite.complete) {
                    console.warn(`MapRenderSystem: Sprite ${spritePath} not loaded for ${entity.id}`);
                    sprite = this.sprites.get('img/avatars/player.png'); // Fallback
                } else {
                    const frame = animData.frames[animation.currentFrame];
                    const renderX = (pos.x - startX) * this.SCALE_FACTOR;
                    const renderY = (pos.y - startY) * this.SCALE_FACTOR;
                    this.ctx.save();
                    if (visuals.faceLeft) {
                        this.ctx.scale(-1, 1);
                        this.ctx.drawImage(
                            sprite,
                            frame.x + 32, // Center horizontally: (128 - 64) / 2
                            64, // Bottom half: 128 - 64
                            64, 64, // Source 64x64 area
                            -(renderX + visuals.w * this.SCALE_FACTOR), renderY,
                            visuals.w * this.SCALE_FACTOR, visuals.h * this.SCALE_FACTOR
                        );
                    } else {
                        this.ctx.drawImage(
                            sprite,
                            frame.x + 32,
                            64,
                            64, 64,
                            renderX, renderY,
                            visuals.w * this.SCALE_FACTOR, visuals.h * this.SCALE_FACTOR
                        );
                    }
                    this.ctx.restore();
                    continue;
                }
            } else {
                sprite = this.sprites.get(visuals.avatar);
                if (!sprite) {
                    console.warn(`MapRenderSystem: Sprite ${visuals.avatar} not found for entity ${entity.id}`);
                    continue;
                }
                if (!sprite.complete) {
                    console.warn(`MapRenderSystem: Sprite ${visuals.avatar} not loaded for entity ${entity.id}`);
                    continue;
                }
                const renderX = (pos.x - startX) * this.SCALE_FACTOR;
                const renderY = (pos.y - startY) * this.SCALE_FACTOR;
                this.ctx.save();
                if (visuals.faceLeft === true) {
                    this.ctx.scale(-1, 1);
                    this.ctx.drawImage(
                        sprite,
                        -(renderX + visuals.w * this.SCALE_FACTOR),
                        renderY,
                        visuals.w * this.SCALE_FACTOR,
                        visuals.h * this.SCALE_FACTOR
                    );
                } else {
                    this.ctx.drawImage(
                        sprite,
                        renderX,
                        renderY,
                        visuals.w * this.SCALE_FACTOR,
                        visuals.h * this.SCALE_FACTOR
                    );
                }
                this.ctx.restore();
                continue;
            }
        }

        // --- PIXEL-BASED lighting OF WAR PASS ---
        // 1. Create or resize lighting canvas
        if (!this.lightingCanvas || this.lightingCanvas.width !== this.canvas.width || this.lightingCanvas.height !== this.canvas.height) {
            this.lightingCanvas = document.createElement('canvas');
            this.lightingCanvas.width = this.canvas.width;
            this.lightingCanvas.height = this.canvas.height;
        }
        const lightingCtx = this.lightingCanvas.getContext('2d');
        lightingCtx.clearRect(0, 0, this.lightingCanvas.width, this.lightingCanvas.height);

        //2. Fill lighting canvas with darkness
        // Calculate darkness opacity based on visibility radius
        const visibilityRadius = (lightingState && typeof lightingState.visibleRadius === 'number')
            ? lightingState.visibleRadius
            : 3; // Default value if not defined
        const darknessOpacity = Math.min(1, Math.max(0, 0.87 + (visibilityRadius * 0.01))); // Clamp between 0 and 1

        // Fill lighting canvas with dynamic opacity
        lightingCtx.globalAlpha = 1;
        lightingCtx.globalCompositeOperation = 'source-over';
        lightingCtx.fillStyle = `rgba(0,0,0,${darknessOpacity})`;
        lightingCtx.fillRect(0, 0, this.lightingCanvas.width, this.lightingCanvas.height);

        // 3. Prepare gradient for clearing
        const visibleRadius = (lightingState && typeof lightingState.visibleRadius === 'number')
            ? lightingState.visibleRadius
            : 3;
        const renderRadius = (renderState && typeof renderState.renderRadius === 'number')
            ? renderState.renderRadius
            : (visibleRadius + 2);

        function safeNum(val, fallback = 0) {
            return Number.isFinite(val) ? val : fallback;
        }

        const playerScreenX = safeNum((playerPos.x - startX) * this.SCALE_FACTOR + this.TILE_SIZE * this.SCALE_FACTOR / 2);
        const playerScreenY = safeNum((playerPos.y - startY) * this.SCALE_FACTOR + this.TILE_SIZE * this.SCALE_FACTOR / 2);
        const pxVisible = safeNum(visibleRadius * this.TILE_SIZE * this.SCALE_FACTOR, 1);
        const pxRender = safeNum(renderRadius * this.TILE_SIZE * this.SCALE_FACTOR, pxVisible + 1);

        if (pxRender <= 0 || pxVisible < 0.5) {
            console.error('Invalid lighting radii:', { pxVisible, pxRender, visibleRadius, renderRadius });
            return;
        }

        // 4. Use destination-out to "erase" the gradient area
        const grad = lightingCtx.createRadialGradient(
            playerScreenX, playerScreenY, 0,
            playerScreenX, playerScreenY, pxRender
        );
        grad.addColorStop(0, 'rgba(0,0,0,.75)');
        grad.addColorStop(pxVisible / pxRender, 'rgba(0,0,0,0.02)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');

        lightingCtx.globalCompositeOperation = 'destination-out';
        lightingCtx.fillStyle = grad;
        lightingCtx.beginPath();
        lightingCtx.arc(playerScreenX, playerScreenY, pxRender, 0, 2 * Math.PI);
        lightingCtx.fill();
        lightingCtx.globalCompositeOperation = 'source-over';

        // After the player lighting clearing code, add:
        for (const entity of entities) {
            if (!entity.hasComponent('LightSource') || entity.id === 'player') continue;

            const light = entity.getComponent('LightSource');
            const pos = entity.getComponent('Position');
            

            let portalYOffset = 0;
            if (entity.hasComponent('Portal')) {
                portalYOffset = 64;
            }

            const npcScreenX = safeNum((pos.x - startX) * this.SCALE_FACTOR + this.TILE_SIZE * this.SCALE_FACTOR / 2);
            const npcScreenY = safeNum(((pos.y + portalYOffset) - startY) * this.SCALE_FACTOR + this.TILE_SIZE * this.SCALE_FACTOR / 2);

            // Handle visibility effect (if enabled)
            if (light.visibilityEnabled && light.visibilityRadius > 0) {
                const npcRadius = safeNum(light.visibilityRadius * this.TILE_SIZE * this.SCALE_FACTOR, 1);

                if (!Number.isFinite(npcScreenX) || !Number.isFinite(npcScreenY) || !Number.isFinite(npcRadius) || npcRadius <= 0) {
                    console.error('Invalid visibility parameters:', { npcScreenX, npcScreenY, npcRadius });
                    continue;
                }

                // Draw visibility gradient (clears darkness)
                const visibilityGrad = lightingCtx.createRadialGradient(
                    npcScreenX, npcScreenY, 0,
                    npcScreenX, npcScreenY, npcRadius
                );
                light.visibilityOpacitySteps.forEach((opacity, i) => {
                    const stop = i / (light.visibilityOpacitySteps.length - 1);
                    visibilityGrad.addColorStop(stop, `rgba(0,0,0,${opacity})`);
                });

                lightingCtx.globalCompositeOperation = 'destination-out';
                lightingCtx.fillStyle = visibilityGrad;
                lightingCtx.beginPath();
                lightingCtx.arc(npcScreenX, npcScreenY, npcRadius, 0, 2 * Math.PI);
                lightingCtx.fill();
                lightingCtx.globalCompositeOperation = 'source-over';

                // Apply visibility tint (if specified)
                if (light.visibilityTintColor && light.visibilityTintColor !== 'rgba(255,255,255,0)') {
                    const tintGrad = lightingCtx.createRadialGradient(
                        npcScreenX, npcScreenY, 0,
                        npcScreenX, npcScreenY, npcRadius
                    );
                    const [r, g, b, a] = light.visibilityTintColor.match(/\d+/g).map(Number);
                    tintGrad.addColorStop(0, `rgba(${r},${g},${b},${a / 255 * 0.3})`);
                    tintGrad.addColorStop(0.5, `rgba(${r},${g},${b},${a / 255 * 0.1})`);
                    tintGrad.addColorStop(1, `rgba(${r},${g},${b},0)`);

                    lightingCtx.globalCompositeOperation = 'source-over';
                    lightingCtx.fillStyle = tintGrad;
                    lightingCtx.beginPath();
                    lightingCtx.arc(npcScreenX, npcScreenY, npcRadius, 0, 2 * Math.PI);
                    lightingCtx.fill();
                }
            }
        }

        // 5. Draw lighting over main map (after all map/entity rendering)
        this.ctx.drawImage(this.lightingCanvas, 0, 0);

        // Third pass: Render health bars
        for (const entity of entities) {
            if (!entity.hasComponent('HpBar')) continue;

            const pos = entity.getComponent('Position');
            const visuals = entity.getComponent('Visuals');
            if (!pos || !visuals) continue;

            const renderX = (pos.x - startX) * this.SCALE_FACTOR;
            const renderY = (pos.y - startY) * this.SCALE_FACTOR;

            const hpBar = entity.getComponent('HpBar');
            let currentFillPercent = hpBar.fillPercent;
            let currentFillColor = hpBar.fillColor;

            if (hpBar.animationStartTime !== null) {
                const elapsed = Date.now() - hpBar.animationStartTime;
                const t = Math.min(elapsed / hpBar.animationDuration, 1);

                currentFillPercent = hpBar.lastFillPercent + (hpBar.fillPercent - hpBar.lastFillPercent) * t;
                currentFillColor = this.interpolateColor(hpBar.lastFillColor, hpBar.fillColor, t);

                if (t >= 1) {
                    hpBar.animationStartTime = null;
                }
            }

            const barWidth = visuals.w * this.SCALE_FACTOR * 0.8;
            const barHeight = 3 * this.SCALE_FACTOR;
            const barX = renderX + (visuals.w * this.SCALE_FACTOR - barWidth) / 2;
            const barY = renderY - barHeight - 4 * this.SCALE_FACTOR;

            this.ctx.save();
            this.ctx.fillStyle = 'rgba(128, 128, 128, .7)';
            this.ctx.fillRect(barX, barY, barWidth, barHeight);

            this.ctx.fillStyle = currentFillColor;
            const fillWidth = barWidth * Math.max(0, Math.min(1, currentFillPercent));
            this.ctx.fillRect(barX, barY, fillWidth, barHeight);

            this.ctx.strokeStyle = 'rgba(226,226,226,.8)';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(barX, barY, barWidth, barHeight);

            this.ctx.restore();

            hpBar.updated = false;
        }
        gameState.needsInitialRender = false;
    }
}

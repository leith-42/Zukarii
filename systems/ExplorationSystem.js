
import { System } from '../core/Systems.js';

export class ExplorationSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = ['Position', 'PlayerState'];
        this.minimapCanvas = null;
        this.minimapCtx = null;
        this.isMinimapVisible = true;
        this.PIXELS_PER_TILE = 2;
        this.WIDTH = 122;
        this.HEIGHT = 67;
        this.TILE_SIZE = 32;
        this.revealFullMinimap = false; // Set to true to reveal the full minimap
        this.lastMinimapRender = 0;
        this.minimapRenderInterval = 166.7; // ms (6 times per second)

    }

    init() {
        this.eventBus.on('ToggleMinimap', () => {
            this.isMinimapVisible = !this.isMinimapVisible;
            this.minimapWrapper.style.display = this.isMinimapVisible ? 'flex' : "none";
            this.minimapCanvas.style.display = this.isMinimapVisible ? 'block' : 'none';
            if (this.isMinimapVisible)this.throttledRenderMinimap();
        });

        this.minimapCanvas = document.getElementById('minimap-canvas');
        this.minimapWrapper = document.getElementById('minimap-wrapper');

        if (!this.minimapCanvas) {
            return;
        }
        this.minimapCtx = this.minimapCanvas.getContext('2d');
        this.minimapWrapper.style.display = this.isMinimapVisible ? 'flex' : "none";
        this.minimapCanvas.style.display = this.isMinimapVisible ? 'block' : 'none';
    }

    update(deltaTime) {
        this.updateExploration();
    }

    renderMinimap() {
        this.minimapWrapper.classList.remove('hidden');
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        const levelEntity = this.entityManager.getEntitiesWith(['Tier']).find(e => e.getComponent('Tier').value === gameState.tier);
        if (!levelEntity) return;

        const exploration = levelEntity.getComponent('Exploration');
        if (!exploration) return;

        this.minimapCtx.fillStyle = '#111';
        this.minimapCtx.fillRect(0, 0, this.minimapCanvas.width, this.minimapCanvas.height);

        if (this.revealFullMinimap) {
            const mapComp = levelEntity.getComponent('Map');
            if (mapComp && mapComp.map) {
                for (let y = 0; y < this.HEIGHT; y++) {
                    for (let x = 0; x < this.WIDTH; x++) {
                        if (mapComp.map[y] && mapComp.map[y][x]) {
                            if (mapComp.map[y][x] === ' ') {
                                this.minimapCtx.fillStyle = '#333';
                            } else if (mapComp.map[y][x] === '#') {
                                this.minimapCtx.fillStyle = '#26214b';
                            } else {
                                continue;
                            }
                            this.minimapCtx.fillRect(x * this.PIXELS_PER_TILE, y * this.PIXELS_PER_TILE, this.PIXELS_PER_TILE, this.PIXELS_PER_TILE);
                        }
                    }
                }
            }
        } else {
            this.minimapCtx.fillStyle = '#333';
            for (const tileKey of exploration.discoveredFloors) {
                const [x, y] = tileKey.split(',').map(Number);
                if (x >= 0 && x < this.WIDTH && y >= 0 && y < this.HEIGHT) {
                    this.minimapCtx.fillRect(x * this.PIXELS_PER_TILE, y * this.PIXELS_PER_TILE, this.PIXELS_PER_TILE, this.PIXELS_PER_TILE);
                }
            }

            this.minimapCtx.fillStyle = '#26214b';
            for (const tileKey of exploration.discoveredWalls) {
                const [x, y] = tileKey.split(',').map(Number);
                if (x >= 0 && x < this.WIDTH && y >= 0 && y < this.HEIGHT) {
                    this.minimapCtx.fillRect(x * this.PIXELS_PER_TILE, y * this.PIXELS_PER_TILE, this.PIXELS_PER_TILE, this.PIXELS_PER_TILE);
                }
            }
        }

        // Render markers for stairs, fountains, and portals
        const markerEntities = [
            ...this.entityManager.getEntitiesWith(['Position', 'Stair']),
            ...this.entityManager.getEntitiesWith(['Position', 'Fountain']),
            ...this.entityManager.getEntitiesWith(['Position', 'Portal'])
        ];

        for (const entity of markerEntities) {
            const pos = entity.getComponent('Position');
            const tileX = Math.floor(pos.x / this.TILE_SIZE);
            const tileY = Math.floor(pos.y / this.TILE_SIZE);
            const tileKey = `${tileX},${tileY}`;

            // Only render if the tile is discovered
            if (exploration.discoveredFloors.has(tileKey) || exploration.discoveredWalls.has(tileKey)) {
                if (entity.hasComponent('Stair')) {
                    const stairComp = entity.getComponent('Stair');
                    this.minimapCtx.fillStyle = stairComp.direction === 'up' ? '#fff' : '#ff2'; // white for up, yellow for down
                } else if (entity.hasComponent('Fountain')) {
                    this.minimapCtx.fillStyle = '#F00'; // Red for fountains
                } else if (entity.hasComponent('Portal')) {
                    this.minimapCtx.fillStyle = '#00f'; // Blue for portals
                }
                this.minimapCtx.fillRect(
                    tileX * this.PIXELS_PER_TILE,
                    tileY * this.PIXELS_PER_TILE,
                    this.PIXELS_PER_TILE,
                    this.PIXELS_PER_TILE
                );
            }
        }

        const player = this.entityManager.getEntity('player');
        if (player) {
            const playerPos = player.getComponent('Position');
            const playerX = Math.floor(playerPos.x / this.TILE_SIZE);
            const playerY = Math.floor(playerPos.y / this.TILE_SIZE);
            this.minimapCtx.fillStyle = '#0f0';
            this.minimapCtx.fillRect(playerX * this.PIXELS_PER_TILE, playerY * this.PIXELS_PER_TILE, this.PIXELS_PER_TILE, this.PIXELS_PER_TILE);
        }
    }

    updateExploration() {
        // Only get what you need for the early exit
        const gameStateEntity = this.entityManager.getEntity('gameState');
        const playerEntity = this.entityManager.getEntity('player');
        if (!gameStateEntity || !playerEntity) return;

        const gameState = gameStateEntity.getComponent('GameState');
        const playerPos = playerEntity.getComponent('Position');
        const lastPos = playerEntity.getComponent('LastPosition');
        if (!gameState || !playerPos || !lastPos) return;

        // Early exit if player hasn't moved and no initial render is needed
        if (
            ((playerPos.x === lastPos.x && playerPos.y === lastPos.y) || (lastPos.x === 0 && lastPos.y === 0)) &&
            (gameState.needsInitialRender !== true)
        ) {
            return;
        }

        // Now do the rest of the lookups only if needed
        const lightingStateEntity = this.entityManager.getEntity('lightingState');
        const stateEntity = this.entityManager.getEntity('state');
        if (!lightingStateEntity || !stateEntity) {
            console.warn('ExplorationSystem: Missing required entities or components');
            return;
        }

        const lightingState = lightingStateEntity.getComponent('LightingState');
        const playerState = playerEntity.getComponent('PlayerState');
        if (!lightingState || !playerState) return;

        const playerX = Math.floor(playerPos.x / this.TILE_SIZE);
        const playerY = Math.floor(playerPos.y / this.TILE_SIZE);

        const levelEntity = this.entityManager.getEntitiesWith(['Tier']).find(
            e => e.getComponent('Tier').value === gameState.tier
        );
        if (!levelEntity) return;

        const mapComp = levelEntity.getComponent('Map');
        const map = mapComp ? mapComp.map : null;
        if (!map) return;

        const exploration = levelEntity.getComponent('Exploration');
        if (!exploration) return;

        const visibleRadius = lightingState.visibleRadius;
        let newDiscoveryCount = 0;
        const visibleRadiusSq = visibleRadius * visibleRadius;

        // Discover tiles in visible radius
        for (
            let y = Math.max(0, playerY - visibleRadius);
            y <= Math.min(this.HEIGHT - 1, playerY + visibleRadius);
            y++
        ) {
            for (
                let x = Math.max(0, playerX - visibleRadius);
                x <= Math.min(this.WIDTH - 1, playerX + visibleRadius);
                x++
            ) {
                if (!map[y] || typeof map[y][x] === 'undefined') continue;
                const dx = x - playerX;
                const dy = y - playerY;
                if (dx * dx + dy * dy <= visibleRadiusSq) {
                    const tileKey = `${x},${y}`;
                    const wasDiscovered =
                        exploration.discoveredWalls.has(tileKey) ||
                        exploration.discoveredFloors.has(tileKey);
                    const isWall = map[y][x] === '#';
                    if (!wasDiscovered) {
                        if (isWall) {
                            exploration.discoveredWalls.add(tileKey);
                        } else {
                            exploration.discoveredFloors.add(tileKey);
                        }
                        newDiscoveryCount++;
                    }
                }
            }
        }

        // Only render minimap once per update
        let minimapRendered = false;
        if (newDiscoveryCount > 0) {
            playerState.discoveredTileCount += newDiscoveryCount;
            this.eventBus.emit('TilesDiscovered', {
                count: newDiscoveryCount,
                total: playerState.discoveredTileCount
            });
            if (this.isMinimapVisible) {
                this.throttledRenderMinimap();
                minimapRendered = true;
            }
        }

        const lastTileX = Math.floor(lastPos.x / this.TILE_SIZE);
        const lastTileY = Math.floor(lastPos.y / this.TILE_SIZE);

        if (
            lastPos &&
            !(lastPos.x === 0 && lastPos.y === 0)
        ) {
            const shouldRenderMinimap =
                this.isMinimapVisible &&
                (playerX !== lastTileX || playerY !== lastTileY);
            if (shouldRenderMinimap && !minimapRendered) {
                this.throttledRenderMinimap();
            }
        }
    }


    throttledRenderMinimap() {
        const now = Date.now();
        if (now - this.lastMinimapRender >= this.minimapRenderInterval) {
            this.renderMinimap();
            this.lastMinimapRender = now;
        }
    }

}






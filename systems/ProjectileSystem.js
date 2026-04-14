import { System } from '../core/Systems.js';
import { MovementIntentComponent, RemoveEntityComponent } from '../core/Components.js';

export class ProjectileSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = ['Projectile', 'Position', 'LastPosition', 'MovementSpeed'];
        this.TILE_SIZE = 32; // For range calculation compatibility
    }

    update(deltaTime) {
        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');
        if (gameState?.gameOver) return;

        const projectiles = this.entityManager.getEntitiesWith(this.requiredComponents);
        for (const projectile of projectiles) {
            const projData = projectile.getComponent('Projectile');
            //console.log(`ProjectileSystem: Processing projectile ${projectile.id} with data:`, projData);

            const tier = gameState.tier;
            const levelEntity = this.entityManager.getEntitiesWith(['Map', 'Tier']).find(e => e.getComponent('Tier').value === tier);
            if (!levelEntity) {
                console.warn(`ProjectileSystem: No level entity found for tier ${tier}, skipping projectile ${projectile.id}`);
                continue;
            }
            
            const pos = projectile.getComponent('Position');
            const moveSpeedComp = projectile.getComponent('MovementSpeed');
            const map = levelEntity.getComponent('Map').map;

            if (projData.rangeLeft >= 0) {

                //console.log(`ProjectileSystem: ${projectile.id} has direction:`, projData.direction);
                const { dx, dy } = projData.direction; 

                const angle = Math.atan2(dy, dx); 
                projectile.getComponent('Visuals').rotation = angle;

                // Normalize direction vector (dx, dy)
                const magnitude = Math.sqrt(dx * dx + dy * dy);
                if (magnitude === 0) {
                    projData.zeroMagFrameCount = (projData.zeroMagFrameCount || 0) + 1;
                    console.warn(`ProjectileSystem: Invalid direction for projectile ${projectile.id}, skipping movement`, projData);
                    if (projData.zeroMagFrameCount > 5) {
                        // If zero magnitude for too many frames, remove the projectile
                        if (!projectile.hasComponent('RemoveEntity')) {
                            projectile.addComponent(new RemoveEntityComponent());
                        }
                    }
                    continue;
                }

                // Calculate movement delta using pixel-per-second speed
                const speed = moveSpeedComp.movementSpeed; // Pixels per second (e.g., 320)
                const moveDistance = speed * deltaTime; // Distance to move this frame

                const moveX = (dx / magnitude) * moveDistance;
                const moveY = (dy / magnitude) * moveDistance;
                //console.log(`ProjectileSystem: ${projectile.id} moving by (${moveX.toFixed(2)}, ${moveY.toFixed(2)}) pixels`);
                const newX = pos.x + moveX;
                const newY = pos.y + moveY;

                // Check bounds
                const mapWidth = map[0].length * this.TILE_SIZE;
                const mapHeight = map.length * this.TILE_SIZE;
                const isOutOfBounds = newX < 0 || newX >= mapWidth || newY < 0 || newY >= mapHeight;

                // Update range based on distance traveled (in pixels)
                projData.rangeLeft -= moveDistance / this.TILE_SIZE; // Convert pixels to tiles for range

                if (isOutOfBounds || projData.rangeLeft <= 0) {
                    if (!projectile.hasComponent('RemoveEntity')) {
                        projectile.addComponent(new RemoveEntityComponent());
                    }
                    //console.log(`ProjectileSystem: ${projectile.id} is out of bounds (${newX}, ${newY}) or range depleted (rangeLeft: ${projData.rangeLeft})`);
                    continue;
                }

                this.entityManager.addComponentToEntity(projectile.id, new MovementIntentComponent(newX, newY));
                //console.log(`ProjectileSystem: ${projectile.id} intends to move to (${newX.toFixed(2)}, ${newY.toFixed(2)}), rangeLeft: ${projData.rangeLeft.toFixed(2)}`);
            } else {
                //console.log(`ProjectileSystem: ${projectile.id} has reached its range limit`);
                if (!projectile.hasComponent('RemoveEntity')) {
                    projectile.addComponent(new RemoveEntityComponent());
                }
            }
        }
    }
}
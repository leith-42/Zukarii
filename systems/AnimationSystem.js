import { System } from '../core/Systems.js';

export class AnimationSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = ['Animation', 'AnimationState', 'Position', 'Visuals'];
        this.baselineSpeed = 100; // Combat speed (192 * 0.66)

        // Listen for RangedAttack event to trigger attack animation
        this.eventBus.on('AnimateRangedAttack', (data) => this.animateRangedAttack(data));
    }

    animateRangedAttack({entityId}) {
        const entity = this.entityManager.getEntity(entityId);
        if (!entity)  return;


        const animState = entity.getComponent('AnimationState');
        const animation = entity.getComponent('Animation');
        if (!animState || !animation) return;

        // Trigger attack animation
        animState.isIdle = false;
        animState.isWalking = false;
        animState.isAttacking = true;
        animation.currentAnimation = 'attack';
        animation.currentFrame = 0;
        animation.frameTimer = 0;
        //console.log('AnimationSystem: Switched player to attack');
    }

    update(deltaTime) {
        const entities = this.entityManager.getEntitiesWith(this.requiredComponents);
        const gameState = this.entityManager.getEntity('gameState')?.getComponent('GameState');

        if (gameState?.transitionLock) {
            return; // Pause animations during transitions
        }

        for (const entity of entities) {
            const animation = entity.getComponent('Animation');
            const animState = entity.getComponent('AnimationState');
            const hasMovement = entity.hasComponent('MovementIntent');

            // Handle player-specific logic
            if (entity.id === 'player') {
                // Handle attack animation completion
                if (animState.isAttacking) {
                    const animData = animation.animations[animation.currentAnimation];
                    // Check if the attack animation has reached the last frame
                    if (animation.currentFrame >= animData.frames.length - 1 && animation.frameTimer >= animData.frameTime) {
                        // Animation complete, switch to idle (force idle after attack)
                        animState.isIdle = true;
                        animState.isWalking = false;
                        animState.isAttacking = false;
                        animation.currentAnimation = 'idle';
                        animation.currentFrame = 0;
                        animation.frameTimer = 0;
                        //console.log(`AnimationSystem: Switched ${entity.id} to idle after attack`);
                    }
                } else {
                    // Normal idle/walk state transitions
                    if (hasMovement && !animState.isWalking) {
                        animState.isIdle = false;
                        animState.isWalking = true;
                        animState.isAttacking = false;
                        animation.currentAnimation = 'walk';
                        animation.currentFrame = 0;
                        animation.frameTimer = 0;
                        //console.log(`AnimationSystem: Switched ${entity.id} to walk`);
                    } else if (!hasMovement && !animState.isIdle) {
                        animState.isIdle = true;
                        animState.isWalking = false;
                        animState.isAttacking = false;
                        animation.currentAnimation = 'idle';
                        animation.currentFrame = 0;
                        animation.frameTimer = 0;
                        //console.log(`AnimationSystem: Switched ${entity.id} to idle`);
                    }
                }
            } else if (entity.hasComponent('NPCData')) {
                // NPC animation logic - for now, just keep them in idle
                if (!animState.isIdle) {
                    animState.isIdle = true;
                    animState.isWalking = false;
                    animState.isAttacking = false;
                    animation.currentAnimation = 'idle';
                    animation.currentFrame = 0;
                    animation.frameTimer = 0;
                    console.log(`AnimationSystem: Set ${entity.id} to idle animation`);
                }
            }

            // Update frame timer with dynamic frame time
            const animData = animation.animations[animation.currentAnimation];
            if (!animData) {
                console.warn(`AnimationSystem: No data for ${animation.currentAnimation} in ${entity.id}`);
                continue;
            }

            // Adjust frame time based on movement speed for walk animation (player only)
            let effectiveFrameTime = animData.frameTime;
            if (entity.id === 'player' && animation.currentAnimation === 'walk' && hasMovement) {
                const movementSpeedComp = entity.getComponent('MovementSpeed');
                if (movementSpeedComp) {
                    const currentSpeed = movementSpeedComp.movementSpeed;
                    const speedRatio = currentSpeed / this.baselineSpeed;
                    effectiveFrameTime = animData.frameTime / speedRatio;
                   // //console.log(`AnimationSystem: Walk speed: ${currentSpeed.toFixed(2)}, speedRatio: ${speedRatio.toFixed(2)}, effectiveFrameTime: ${effectiveFrameTime.toFixed(2)}ms`);
                }
            }

            animation.frameTimer += deltaTime * 1000; // Convert to ms
            if (animation.frameTimer >= effectiveFrameTime) {
                // For attack animation, don't loop; stop at the last frame
                if (animation.currentAnimation === 'attack' && animation.currentFrame >= animData.frames.length - 1) {
                    // Don't increment frame, let the state switch handle the transition
                } else {
                    animation.currentFrame = (animation.currentFrame + 1) % animData.frames.length;
                    animation.frameTimer = 0;
                }
            }
        }
    }
}
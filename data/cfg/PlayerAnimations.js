// data/cfg/PlayerAnimations.js
export const PLAYER_ANIMATION_CONFIG = {
    spriteSheets: {
        idle: { src: 'img/anim/Player/Idle.png' },
        walk: { src: 'img/anim/Player/Walk.png' },
        walk_up: { src: 'img/anim/Player/Walk_Up.png' },
        walk_down: { src: 'img/anim/Player/Walk_Down.png' },
        attack: { src: 'img/anim/Player/Attack_Fire_2.png' }
    },
    animations: {
        idle: {
            frames: [
                { x: 0 }, { x: 128 }, { x: 256 }, { x: 384 },
                { x: 512 }, { x: 640 }, { x: 768 }, { x: 896 }
            ],
            frameWidth: 128,
            frameHeight: 128,
            frameTime: 100
        },
        walk: {
            frames: [
                { x: 0 }, { x: 128 }, { x: 256 }, { x: 384 },
                { x: 512 }, { x: 640 }, { x: 768 }
            ],
            frameWidth: 128,
            frameHeight: 128,
            frameTime: 100
        },
        attack: {
            frames: [
                { x: 0 }, { x: 128 }, { x: 256 }, { x: 384 },
                { x: 512 }, { x: 640 }, { x: 768 }, { x: 896 },
                { x: 1024 }
            ],
            frameWidth: 128,
            frameHeight: 128,
            frameTime: 56
        }
    }
};

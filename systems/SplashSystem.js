import { System } from '../core/Systems.js';
import {
    NewCharacterComponent,
} from '../core/Components.js';

export class SplashSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.splash = document.getElementById('splash');
        this.canvas = document.getElementById('splash-canvas');
        this.ctx = this.canvas?.getContext('2d');
        this.width = 0;
        this.height = 0;
        this.portalParticles = [];
        this.tightPortalParticles = [];
        this.riftFlicker = 1;
        this.selectedIndex = 0;
        this.menuItems = [];
        this.isActive = true;
        this.animationFrameId = null;
        this.zuImg = new Image();
        this.karnImg = new Image();
        this.zukarathImg = new Image();
        this.caerVorythImg = new Image();
        this.vortexImg = new Image();
    }

    async init() {
        if (!this.splash || !this.canvas || !this.ctx) {
            throw new Error('SplashSystem: Splash or canvas elements not found');
        }

        console.log('SplashSystem: Initializing canvas - Width:', this.canvas.width, 'Height:', this.canvas.height);

        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        // Initialize particles
        for (let i = 0; i < 50; i++) {
            this.portalParticles.push(this.createParticle());
        }
        for (let i = 0; i < 30; i++) {
            this.tightPortalParticles.push(this.createTightParticle());
        }

        // Load images with error handling
        this.zuImg.src = 'img/splash/zu-mage.png';
        this.karnImg.src = 'img/splash/karn-mage.png';
        this.zukarathImg.src = 'img/splash/zukarath.png';
        this.caerVorythImg.src = 'img/splash/caer-voryth.png';
        this.vortexImg.src = 'img/splash/vortex.png';

        // Debug image loading
        this.vortexImg.onload = () => {
            console.log('Vortex image loaded successfully:', this.vortexImg.src);
        };
        this.vortexImg.onerror = () => {
            console.error('Failed to load vortex image:', this.vortexImg.src);
        };

        this.splashMenu = document.getElementById('splash-menu');
        this.splashMenu.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });

        // Setup menu interactions
        this.menuItems = document.querySelectorAll('.splash-menu li');
        if (this.menuItems.length === 0) {
            console.warn('SplashSystem: No menu items found');
        }
        this.updateSelection();
        this.setupEventListeners();

        // Wait for audio to load
        this.eventBus.on('AudioLoaded', () => {
            console.log('SplashSystem: Audio loaded, playing sounds');
            this.eventBus.emit('PlayTrackControl', { track: 'backgroundMusic', play: true, volume: 0.25 });
            this.eventBus.emit('PlaySfxImmediate', { sfx: 'portal1', volume: 0.2 });
        });

        // Start animation loop
        this.animate();

        console.log('SplashSystem: Initialized');
    }


    createParticle() {
        return {
            x: this.width * 0.5 + (Math.random() * 150 - 75),
            y: this.height * 0.5 + (Math.random() * 150 - 75),
            radius: Math.random() * 5 + 2,
            angle: Math.random() * Math.PI * 2,
            speed: Math.random() * 4 + 2,
            opacity: Math.random() * 0.5 + 0.5
        };
    }

    createTightParticle() {
        return {
            x: this.width * 0.5 + (Math.random() * 50 - 25),
            y: this.height * 0.5 + (Math.random() * 50 - 25),
            radius: Math.random() * 4 + 1,
            angle: Math.random() * Math.PI * 2,
            speed: Math.random() * 2 + 1,
            opacity: Math.random() * 0.7 + 0.3
        };
    }

    resizeCanvas() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.portalParticles.forEach(p => {
            p.x = this.width * 0.5 + (Math.random() * 150 - 75);
            p.y = this.height * 0.5 + (Math.random() * 150 - 75);
        });
        this.tightPortalParticles.forEach(p => {
            p.x = this.width * 0.5 + (Math.random() * 50 - 25);
            p.y = this.height * 0.5 + (Math.random() * 50 - 25);
        });
        console.log('SplashSystem: Canvas resized - Width:', this.width, 'Height:', this.height);
    }

    animate() {
        if (!this.isActive) {
            console.log('SplashSystem: Animation loop stopped');
            return;
        }

        this.ctx.clearRect(0, 0, this.width, this.height);

        // Update animations
        this.riftFlicker = 0.6 + Math.sin(Date.now() * 0.005) * 0.4;

        // Draw centered vortex image with clockwise rotation (behind menu and particles)
        if (this.vortexImg.complete) {
            this.ctx.save();
            // Translate to the center of the image (pivot point for rotation)
            const vortexX = this.width * 0.5;
            const vortexY = this.height * 0.5;
            this.ctx.translate(vortexX, vortexY);
            // Apply clockwise rotation with normalized angle
            const angle = (Date.now() * 0.001) % (2 * Math.PI); // Slightly faster rotation
            this.ctx.rotate(angle);
            // Draw the image centered on the pivot point
            this.ctx.globalAlpha = 0.35;
            this.ctx.drawImage(this.vortexImg, -180, -180, 360, 360);
            this.ctx.restore();
            this.ctx.globalAlpha = 1;
            // Debug log to confirm animation loop

        } else {
            console.log('Vortex image not yet loaded');
        }

        // Draw Zukarath image in top-left corner
        if (this.zukarathImg.complete) {
            this.ctx.globalAlpha = 1;
            this.ctx.drawImage(this.zukarathImg, 0, 0, 1024, 680);
            this.ctx.globalAlpha = 1;
        }

        // Draw Caer-Voryth image in lower-right corner
        if (this.caerVorythImg.complete) {
            this.ctx.globalAlpha = 0.9;
            this.ctx.drawImage(this.caerVorythImg, this.width - 1024, this.height - 680, 1024, 680);
            this.ctx.globalAlpha = 1;
        }

        // Draw portal (spread-out vortex)
        this.portalParticles.forEach(p => {
            p.angle += 0.05;
            p.x += Math.cos(p.angle) * p.speed;
            p.y += Math.sin(p.angle) * p.speed;
            p.opacity -= 0.005;
            if (p.opacity <= 0) {
                Object.assign(p, this.createParticle());
            }
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(0, 102, 255, ${p.opacity})`;
            this.ctx.fill();
        });

        // Draw tight vortex
        this.tightPortalParticles.forEach(p => {
            p.angle += 0.07;
            p.x += Math.cos(p.angle) * p.speed;
            p.y += Math.sin(p.angle) * p.speed;
            p.opacity -= 0.004;
            if (p.opacity <= 0) {
                Object.assign(p, this.createTightParticle());
            }
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(0, 153, 255, ${p.opacity})`;
            this.ctx.fill();
        });

        // Draw Zu/Karn silhouettes with transparency
        if (this.zuImg.complete) {
            this.ctx.globalAlpha = 0.35;
            this.ctx.drawImage(this.zuImg, this.width * 0.5 - 388, this.height * 0.5 -100, 288, 288);
            this.ctx.globalAlpha = 1;
        }
        if (this.karnImg.complete) {
            this.ctx.globalAlpha = 0.35;
            this.ctx.save();
            this.ctx.translate(this.width * 0.5 + 248, this.height * 0.5);
            this.ctx.scale(-1, 1);
            this.ctx.drawImage(this.karnImg, -144, -100, 288, 288);
            this.ctx.restore();
            this.ctx.globalAlpha = 1;
        }

        this.animationFrameId = requestAnimationFrame(() => this.animate());
    }

    setupEventListeners() {
        this.menuItems.forEach((item, index) => {
            item.addEventListener('click', () => {
                this.selectedIndex = index;
        
                this.updateSelection();
                this.handleSelection(index);
            });
        });

        this.startGameButton = document.getElementById('start-new-game-button');
        this.startGameButton.addEventListener('click', () => {
            this.startGameButton.disabled = 'disabled';
            this.startGameButton.style.pointerEvents = 'none';
            this.startGameButton.style.opacity = '0.5';
            this.eventBus.emit('ToggleOverlay', { tab: 'menu' });
            
            this.splashMenu.style.transition = 'opacity 0.5s ease-in-out';
            this.splashMenu.style.opacity = '0';
            const playerNameInput = document.getElementById('player-name-input');
            const playerName = playerNameInput.value.trim();
            const player = this.entityManager.getEntity('player');
            if (playerName) {
                player.getComponent('PlayerState').name = playerName;
            } else {
                player.getComponent('PlayerState').name = 'Zukarii';
            }
            this.entityManager.addComponentToEntity('player', new NewCharacterComponent({ name: playerName }));
            this.eventBus.emit('PlayerStateUpdated', { entityId: 'player' });
            setTimeout(() => { this.createNewGame(); this.eventBus.emit('ToggleOverlay', { tab: 'character' }); }, 2000);
            this.eventBus.emit('PlaySfxImmediate', { sfx: 'portal0', volume: 0.2 });
            
            
        });

        this.handleKeydown = (e) => {
            if (!this.isActive || document.activeElement.id === 'player-name-input') return;
            if (e.key === 'ArrowUp') {
                this.selectedIndex = (this.selectedIndex - 1 + this.menuItems.length) % this.menuItems.length;
              
                this.updateSelection();
            } else if (e.key === 'ArrowDown') {
                this.selectedIndex = (this.selectedIndex + 1) % this.menuItems.length;
               
                this.updateSelection();
            } else if (e.key === 'Enter') {
                this.handleSelection(this.selectedIndex);
            }
        };
       // document.addEventListener('keydown', this.handleKeydown);
    }

    updateSelection() {
        this.menuItems.forEach((item, index) => {
            item.classList.toggle('selected', index === this.selectedIndex);
        });
    }

    handleSelection(index) {
        
        if (index === 0) {
            this.eventBus.emit('ToggleOverlay', { tab: 'menu' });
            setTimeout(() => {
                
                const newGameButton = document.getElementById('new-game-button');
                if (newGameButton) {
                    newGameButton.click();
                }
            }, 0);
        } else if (index === 1) {
            this.eventBus.emit('ToggleOverlay', { tab: 'menu' });
            setTimeout(() => {
                const loadButton = document.getElementById('load-games-button');
                if (loadButton) {
                    loadButton.click();
                }
            }, 0);
        } else if (index === 2) {
            this.eventBus.emit('ToggleOverlay', { tab: 'menu' });
            setTimeout(() => {
                const optionsButton = document.getElementById('options-button');
                if (optionsButton) {
                    optionsButton.click();
                }
            }, 0);
        } else if (index === 3) {
            this.eventBus.emit('ToggleOverlay', { tab: 'menu' });
            setTimeout(() => {
                const aboutButton = document.getElementById('about-button');
                if (aboutButton) {
                    aboutButton.click();
                }
            }, 0);
        }
    }

    createNewGame() {
        this.isActive = false;
        this.splash.style.display = 'none';
        this.eventBus.emit('StartGame');
    }

    destroy() {
        window.removeEventListener('resize', this.resizeCanvas);
        document.removeEventListener('keydown', this.handleKeydown);
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        this.isActive = false;
        this.splash.style.display = 'none';
        console.log('SplashSystem: Destroyed');
    }

}
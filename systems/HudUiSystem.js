// systems/HudUiSystem.js
import { System } from '../core/Systems.js';

export class HudUiSystem extends System {
    constructor(entityManager, eventBus, utilities) {
        super(entityManager, eventBus, utilities);
        this.playerInfo = null;
        this.playerStatus = null;
        this.hud = null;
        this.resources = null;
        this.hudDOM = {
            hpBar: null,
            hpText: null,
            manaBar: null,
            manaText: null,
            xpBar: null,
            xpText: null,
            healPotionCount: null,
            torchCount: null,
            goldCount: null,
            ashenShardCount: null,
            ashenCrystalCount: null,
            ashenGemCount: null
        };
        this.statusUpdates = {};
        this.needsUpdate = false;
        this.rafPending = null;
        this.lastHealth = null;
        this.lastMana = null;
        this.activeHudLogTab = 'all'; // Default HUD log tab
        this.lastHudLogUpdate = 0; // Track the last update time
        this.hudLogThrottleDelay = 83.35; // Throttle delay in milliseconds
    }

    init() {
        // Initialize HUD DOM elements
        this.playerInfo = document.getElementById('player-info');
        this.hud = document.getElementById('hud-layer');
        this.resources = document.getElementById('resources');

        if (!this.playerInfo ||  !this.hud || !this.resources) {
            throw new Error('HUD elements not found');
        }

        this.hudDOM.hpBar = this.hud.querySelector('#hpBar');
        this.hudDOM.hpText = this.hud.querySelector('#hpText');
        this.hudDOM.manaBar = this.hud.querySelector('#manaBar');
        this.hudDOM.manaText = this.hud.querySelector('#manaText');
        this.hudDOM.xpBar = this.hud.querySelector('#xpBar');
        this.hudDOM.xpText = this.hud.querySelector('#xpText');
        this.hudDOM.healPotionCount = this.hud.querySelector('#healPotionCount');
        this.hudDOM.torchCount = this.hud.querySelector('#torchCount');
        this.hudDOM.goldCount = this.hud.querySelector('#goldCount');
        this.hudDOM.ashenShardCount = this.hud.querySelector('#ashenShardCount');
        this.hudDOM.ashenCrystalCount = this.hud.querySelector('#ashenCrystalCount');
        this.hudDOM.ashenGemCount = this.hud.querySelector('#ashenGemCount');

        if (!this.hudDOM.hpBar || !this.hudDOM.hpText ||
            !this.hudDOM.manaBar || !this.hudDOM.manaText ||
            !this.hudDOM.xpBar || !this.hudDOM.xpText ||
            !this.hudDOM.healPotionCount || !this.hudDOM.torchCount) {
            throw new Error('HUD status elements not found');
        }

        // Set up event listeners
        this.eventBus.off('PlayerStateUpdated');
        this.eventBus.off('LogUpdated');
        this.eventBus.on('PlayerStateUpdated', (data) => this.updateStatusUI(data));
        this.eventBus.on('LogUpdated', () => this.updateHudLog());

        // Initial updates
        this.updateStatusUI({ entityId: 'player' });
        this.updateHudLog();

        // Set up HUD log tab event listeners
        this.setupHudLogTabs();
        ////console.log('HudUiSystem: Initialized and event listeners set up');
    }

    update() {
        const player = this.entityManager.getEntity('player');
        if (!player) {
            console.error('HudUiSystem: Player entity not found');
            return;
        }
        const health = player.getComponent('Health');
        const mana = player.getComponent('Mana');

        if (health.updated && health.hp !== this.lastHealth) {
            this.updateStatusUI({ entityId: 'player' });
            this.lastHealth = health.hp;
            health.updated = false;
        }
        if (mana.updated && mana.mana !== this.lastMana) {
            this.updateStatusUI({ entityId: 'player' });
            this.lastMana = mana.mana;
            mana.updated = false;
        }

        const actionTargetComp = this.entityManager.getEntity('player').getComponent('MouseActionTarget');
        if (actionTargetComp && actionTargetComp.entityId!=null) {
            this.updateHudTarget(actionTargetComp);
        }
        
    }

    updateHudTarget(actionTargetComp) {
        const hudTargetElement = document.getElementById('target-info');
        if (!hudTargetElement) {
            console.warn('HudUiSystem: HUD target element not found');
            return;
        }
       
        const targetEntity = this.entityManager.getEntity(actionTargetComp.entityId);
        if (!targetEntity) {
            this.entityManager.getEntity('player').removeComponent('MouseActionTarget');
            console.warn(`HudUiSystem: Target entity ${actionTargetComp.entityId} not found`);
            hudTargetElement.style.display = 'none';
            return;
        }

        hudTargetElement.style.display = 'flex';
        const targetNameElement = document.getElementById('target-name');
        const targetIconElement = document.querySelector('#target-nameplate-icon img');

        let targetName = 'Unknown';

        let targetImage = 'img/avatars/player.png';
        const VisualsComponent = targetEntity.getComponent('Visuals');
        if (VisualsComponent && VisualsComponent.avatar) {
            targetImage = VisualsComponent.avatar;
        }

        if (targetEntity.hasComponent('MonsterData')) {
            const monsterData = targetEntity.getComponent('MonsterData');
            targetName = monsterData.name || targetName;
        }
        else if (targetEntity.hasComponent('LootData')) {
            const lootData = targetEntity.getComponent('LootData');
            targetName = lootData.name || targetName;
        }
        else if (targetEntity.hasComponent('PlayerState')) {
            const playerState = targetEntity.getComponent('PlayerState');
            targetName = playerState.name || targetName;
        }

        if (targetNameElement) targetNameElement.textContent = targetName;
        if (targetIconElement) targetIconElement.src = targetImage;

        // Future implementation for updating HUD target info
    } 

    setupHudLogTabs() {
        const logHudTabs = document.getElementById('hud-log-tabs');
        if (logHudTabs) {
            logHudTabs.addEventListener('click', (event) => {
                ////console.log('HudUiSystem: logHudTabs click event fired', event.target.id);
                const target = event.target.closest('.hud-log-tab');
                if (!target) return;

                const tabMap = {
                    'log-tab-all': 'all',
                    'log-tab-combat': 'combat',
                    'log-tab-loot': 'loot',
                    'log-tab-journey': 'journey',
                    'log-tab-system': 'system'
                };
                const newTab = tabMap[target.id];
                if (newTab && newTab !== this.activeHudLogTab) {
                    this.activeHudLogTab = newTab;
                    logHudTabs.querySelectorAll('.hud-log-tab').forEach(tab => {
                        tab.classList.toggle('active', tab.id === target.id);
                        tab.style.background = tab.id === target.id ? '#0f0' : '#2c672c';
                    });
                    this.updateHudLog();
                }
            });
        }
    }

    applyStatusUpdates() {
        if (this.statusUpdates.hp) {
            this.hudDOM.hpText.textContent = `${this.statusUpdates.hp.value}/${this.statusUpdates.hp.max}`;
            this.hudDOM.hpBar.style.width = `${(this.statusUpdates.hp.value / this.statusUpdates.hp.max) * 100}%`;
        }
        if (this.statusUpdates.mana) {
            this.hudDOM.manaText.textContent = `${this.statusUpdates.mana.value}/${this.statusUpdates.mana.max}`;
            this.hudDOM.manaBar.style.width = `${(this.statusUpdates.mana.value / this.statusUpdates.mana.max) * 100}%`;
        }
        if (this.statusUpdates.xp) {
            this.hudDOM.xpText.textContent = `${this.statusUpdates.xp.value}/${this.statusUpdates.xp.next}`;
            this.hudDOM.xpBar.style.width = `${(this.statusUpdates.xp.value / this.statusUpdates.xp.next) * 100}%`;
        }
        if (this.statusUpdates.healPotions !== undefined) {
            this.hudDOM.healPotionCount.textContent = this.statusUpdates.healPotions;
        }
        if (this.statusUpdates.torches !== undefined) {
            this.hudDOM.torchCount.textContent = this.statusUpdates.torches;
        }
        if (this.statusUpdates.goldCount !== undefined) {
            this.hudDOM.goldCount.textContent = this.statusUpdates.goldCount;
        }
        if (this.statusUpdates.ashenShardCount !== undefined) {
            this.hudDOM.ashenShardCount.textContent = this.statusUpdates.ashenShardCount;
        }
        if (this.statusUpdates.ashenCrystalCount !== undefined) {
            this.hudDOM.ashenCrystalCount.textContent = this.statusUpdates.ashenCrystalCount;
        }
        if (this.statusUpdates.ashenGemCount !== undefined) {
            this.hudDOM.ashenGemCount.textContent = this.statusUpdates.ashenGemCount;
        }
        this.statusUpdates = {};
    }

    updateStatusUI({ entityId }) {
        if (entityId !== 'player') return;

        const player = this.entityManager.getEntity('player');
        const health = player.getComponent('Health');
        const mana = player.getComponent('Mana');
        const stats = player.getComponent('Stats');
        const playerState = player.getComponent('PlayerState');
        const resource = player.getComponent('Resource');
        ////console.log("Resource - on load", resource);

        this.statusUpdates.hp = { value: health.hp, max: health.maxHp };
        this.statusUpdates.mana = { value: mana.mana, max: mana.maxMana };
        this.statusUpdates.movementSpeed = stats.movementSpeed;
        this.statusUpdates.xp = { value: playerState.xp, next: playerState.nextLevelXp };
        this.statusUpdates.healPotions = resource.healPotions;
        this.statusUpdates.torches = resource.torches;
        this.statusUpdates.ashenShardCount = resource.craftResources.ashenShard || 0;
        this.statusUpdates.ashenCrystalCount = resource.craftResources.ashenCrystal || 0;
        this.statusUpdates.ashenGemCount = resource.craftResources.ashenGem || 0;
        this.statusUpdates.goldCount = resource.gold !== undefined ? resource.gold : 0;

        ////console.log("Resource - after statusUpdates", resource);

        if (this.playerInfo) {
            const playerNameSpan = this.playerInfo.querySelector('#playerName');
            const playerLevelSpan = this.playerInfo.querySelector('#playerLevel');
            const dungeonTierSpan = document.getElementById('dungeonTier');
            const highestTierSpan = document.getElementById('highestTier');
            const playerGoldSpan = document.getElementById('#goldCount');
            const playerAshenShardSpan = document.getElementById('#ashenShardCount');
            const playerAshenCrystalSpan = document.getElementById('#ashenCrystalCount');
            const playerAshenGemSpan = document.getElementById('#ashenGemCount');

            const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');

            if (playerNameSpan) playerNameSpan.textContent = playerState.name;
            if (playerLevelSpan) playerLevelSpan.textContent = playerState.level;
            if (dungeonTierSpan) dungeonTierSpan.textContent = gameState.tier;
            if (highestTierSpan) highestTierSpan.textContent = gameState.highestTier;
            if (playerGoldSpan) playerGoldSpan.textContent = resource.gold !== undefined ? resource.gold : 'N/A';
            if (playerAshenShardSpan) playerAshenShardSpan.textContent = resource.craftResources.ashenShard !== undefined ? resource.craftResources.ashenShard : 0;
            if (playerAshenCrystalSpan) playerAshenCrystalSpan.textContent = resource.craftResources.ashenCrystal  !== undefined ? resource.craftResources.ashenCrystal  : 0;
            if (playerAshenGemSpan) playerAshenGemSpan.textContent = resource.craftResources.ashenGem !== undefined ? resource.craftResources.ashenGem : 0;

        }

        if (!this.needsUpdate) {
            this.needsUpdate = true;
            if (this.rafPending) cancelAnimationFrame(this.rafPending);
            this.rafPending = requestAnimationFrame(() => {
                this.applyStatusUpdates();
                this.needsUpdate = false;
                this.rafPending = null;
            });
        }
    }

    updateHudLog() {
        const now = Date.now();
        if (now - this.lastHudLogUpdate < this.hudLogThrottleDelay) {
            return; // Skip update if within throttle delay
        }
        const hudLogElement = document.getElementById('hud-log-content');
        const limit = 50;
        const hudLogMessages = this.utilities.getLogMessages({ channel: this.activeHudLogTab, limit });
        //console.log('HudUiSystem: updateHudLog called', hudLogMessages);
        hudLogElement.innerHTML = hudLogMessages.map(line => `<p class="channel-${line.channel} ${line.classNames}">${line.message}</p>`).join('');
    }

    
}
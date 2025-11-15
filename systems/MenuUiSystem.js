// systems/MenuUiSystem.js
import { System } from '../core/Systems.js';
import { ShopInteractionComponent } from '../core/Components.js';

export class MenuUiSystem extends System {
    constructor(entityManager, eventBus, utilities) {
        super(entityManager, eventBus, utilities);
        this.requiredComponents = ['OverlayState'];
        this.tabs = null;
        this.logContent = null;
        this.characterContent = null;
        this.menuContent = null;
        this.journeyContent = null;
        this.shopContent = null;
        this.activeMenuSection = 'controls-button';
        this.activeJourneyTab = 'whispers'; // Default to Whispers
        this.tooltipCache = new Map();
        this.activeInventoryTab = 'all';
        this.playerEntity = this.entityManager.getEntity('player');
        this.lastInventoryHash = '';
    }

    init() {
        // Initialize non-HUD DOM elements
        this.tabs = document.getElementById('tabs');
        this.logContent = document.getElementById('log-content');
        this.characterContent = document.getElementById('character-content');
        this.menuContent = document.getElementById('menu-content');
        this.journeyContent = document.getElementById('journey-content');
        this.shopContent = document.getElementById('shop-content');

        if (!this.tabs || !this.logContent || !this.characterContent || !this.menuContent || !this.journeyContent || !this.shopContent) {
            //console.log("Menu", this.menuContent);
            //console.log("Journey", this.journeyContent);
            //console.log("Shop", this.shopContent);
            throw new Error('UI elements not found');
        }

        // Remove HUD-related event listeners
        this.eventBus.off('ToggleOverlay');
        this.eventBus.off('LogMessage');
        this.eventBus.off('StatsUpdated');
        this.eventBus.off('GameOver');
        this.eventBus.off('GearChanged');
        this.eventBus.off('GameSaved');
        this.eventBus.off('GameLoaded');
        this.eventBus.off('SaveCompleted');
        this.eventBus.off('JourneyStateUpdated');

        this.eventBus.on('ToggleOverlay', (data) => {
            //console.log('MenuUiSystem: ToggleOverlay event received:', data);
            this.toggleOverlay(data);
        });
        this.eventBus.on('LogMessage', (data) => {
            //console.log('MenuUiSystem: LogMessage event received:', data);
            this.addLogMessage(data);
        });
        this.eventBus.on('StatsUpdated', (data) => this.updateCharacterUI(data));
        this.eventBus.on('GameOver', (data) => this.gameOver(data));
        this.eventBus.on('GearChanged', (data) => this.updateCharacterUI(data));
        this.eventBus.on('GameSaved', ({ key, success, message }) => {
            //console.log('MenuUiSystem: GameSaved event received:', { key, success, message });
            this.utilities.logMessage({ channel: "system", message });
            if (success) {
                this.updateMenu();
            }
        });
        this.eventBus.on('GameLoaded', ({ saveId, success, message }) => {
            //console.log('MenuUiSystem: GameLoaded event received:', { saveId, success, message });
            if (success) {
                this.utilities.logMessage({ channel: "system", message: 'Load saved game complete' });
                this.toggleOverlay({ tab: 'log' });
            } else {
                this.utilities.logMessage({ channel: "system", message });
            }
        });
        this.eventBus.on('SaveCompleted', ({ key, success, message }) => {
            //console.log('MenuUiSystem: SaveCompleted event received:', { key, success, message });
            this.utilities.logMessage({ channel: "system", message });
            if (success) {
                this.updateMenu();
            }
        });
        this.eventBus.on('JourneyStateUpdated', () => this.updateJourney());

        this.eventBus.emit('GearChanged', { entityId: 'player' });

        this.setupEventListeners();
        //console.log('MenuUiSystem: Event listeners set up');
    }

    update() {
        // No HUD-related updates needed
    }

    setupInventoryTabs(containerId, inventoryContainerId) {
        const inventoryTabs = document.getElementById(containerId);
        if (inventoryTabs) {
            inventoryTabs.addEventListener('click', (event) => {
                const target = event.target.closest('.inventory-tab-button');
                if (!target) return;

                const player = this.entityManager.getEntity('player');
                const stats = player.getComponent('Stats');
                const inventory = player.getComponent('Inventory');

                if (target.id === 'sort-inventory-tab') {
                    this.updateCharacterUI({ entityId: 'player' });
                } else if (target.classList.contains('tab')) {
                    const tabMap = {
                        'inventory-tab-all': 'all',
                        'inventory-tab-armor': 'armor',
                        'inventory-tab-weapon': 'weapon',
                        'inventory-tab-jewelry': 'jewelry',
                        'inventory-tab-journey': 'journey',
                        'inventory-tab-consumables': 'consumables'
                    };

                    const newTab = tabMap[target.id];
                    if (newTab && newTab !== this.activeInventoryTab) {
                        this.activeInventoryTab = newTab;
                        inventoryTabs.querySelectorAll('.tab').forEach(tab => {
                            tab.classList.toggle('active', tab.id === target.id);
                            tab.style.background = tab.id === target.id ? '#0f0' : '#2c672c';
                        });
                        this.renderInventory(inventoryContainerId, inventory.items, this.activeInventoryTab);
                    }
                }
            });
        }
    }

    setupEventListeners() {

        // Sound-enabled checkbox and global volume slider
        const soundEnabledCheckbox = document.getElementById('sound-enabled');
        const globalVolumeSlider = document.getElementById('global-volume');

        if (soundEnabledCheckbox && globalVolumeSlider) {
            // Event listener for sound-enabled checkbox
            soundEnabledCheckbox.addEventListener('change', () => {
                const gameOptions = this.entityManager.getEntity('gameState').getComponent('GameOptions');
                if (!gameOptions) {
                    console.error('MenuUiSystem: GameOptionsComponent not found on gameState entity');
                    return;
                }

                if (soundEnabledCheckbox.checked) {
                    // Restore volume from slider value
                    const sliderValue = parseInt(globalVolumeSlider.value, 10) / 100;
                    gameOptions.soundEnabled = true;
                    gameOptions.globalVolume = sliderValue;
                    this.eventBus.emit('AudioEnabled', gameOptions.soundEnabled);
                } else {
                    // Mute sound
                    gameOptions.soundEnabled = false;
                    gameOptions.globalVolume = 0;
                    //globalVolumeSlider.value = 0; // Update slider to reflect muted state
                }
                this.eventBus.emit('AudioEnabled', gameOptions.soundEnabled);
            });

            // Event listener for global volume slider
            globalVolumeSlider.addEventListener('input', () => {
                const gameOptions = this.entityManager.getEntity('gameState').getComponent('GameOptions');
                if (!gameOptions) {
                    console.error('MenuUiSystem: GameOptionsComponent not found on gameState entity');
                    return;
                }

                const sliderValue = parseInt(globalVolumeSlider.value, 10) / 100;
                gameOptions.globalVolume = sliderValue;

                // If sound is disabled, re-enable it when the slider is adjusted
                if (!soundEnabledCheckbox.checked) {
                    //soundEnabledCheckbox.checked = true;
                    //gameOptions.soundEnabled = true;
                }
            });
        }

        const buttons = document.querySelectorAll('button');
        buttons.forEach(button => {
            button.addEventListener('contextmenu', (event) => {
                event.preventDefault();
            });
        });

        const menuButtons = document.getElementById('menu-buttons');
        if (menuButtons) {
            menuButtons.addEventListener('click', (event) => {
                const button = event.target.closest('button');
                if (button) {
                    this.activeMenuSection = button.id;
                    this.updateMenu();

                    if (button.id === 'exit-button') {
                        this.eventBus.emit('PlaySfxImmediate', { sfx: 'portal0', volume: 0.2 });
                        setTimeout(() => {
                            location.reload(true);
                        }, 2000);
                    }
                }
            });
        }

        const menuDataWrapper = document.getElementById('menu-data-wrapper');
        if (menuDataWrapper) {
            let saveClickCount = 0;

            const handleMenuClick = (event) => {
                const saveButton = event.target.closest('.save-game');
                const overwriteButton = event.target.closest('.overwrite-game');
                const loadButton = event.target.closest('.load-game');
                const deleteButton = event.target.closest('.delete-game');

                if (saveButton) {
                    saveClickCount++;
                    //console.log('MenuUiSystem: Save button clicked, emitting RequestSaveGame, count:', saveClickCount, 'timestamp:', Date.now());
                    const saveId = saveButton.dataset.saveId === 'new' ? null : saveButton.dataset.saveId;
                    this.eventBus.emit('RequestSaveGame', { saveId });
                }

                if (overwriteButton) {
                    //console.log('MenuUiSystem: Overwrite button clicked, emitting RequestSaveGame');
                    const saveId = overwriteButton.dataset.saveId;
                    this.eventBus.emit('RequestSaveGame', { saveId });
                }

                if (loadButton && !loadButton.disabled) {
                    //console.log('MenuUiSystem: Load button clicked, emitting RequestLoadGame');
                    const saveId = loadButton.dataset.saveId;
                    this.eventBus.emit('PlaySfxImmediate', { sfx: 'portal0', volume: 0.2 });
                    this.eventBus.emit('ToggleOverlay', { tab: 'menu' });
                    this.splashMenu = document.getElementById('splash-menu');
                    this.splashMenu.style.transition = 'opacity 0.5s ease-in-out';
                    this.splashMenu.style.opacity = '0';
                    setTimeout(() => {
                        this.eventBus.emit('RequestLoadGame', { saveId }, (result) => {
                            if (result.success) {
                                //console.log('MenuUiSystem: Load successful, waiting for TransitionLoad');
                                this.eventBus.emit('PlaySfxImmediate', { sfx: 'portal1', volume: 0.2 });
                            }
                        });
                        this.eventBus.emit('ToggleOverlay', { tab: 'journey' });
                    }, 2000);
                }

                if (deleteButton) {
                    //console.log('MenuUiSystem: Delete button clicked, emitting DeleteSave');
                    const saveId = deleteButton.dataset.saveId;
                    this.eventBus.emit('DeleteSave', { saveId });
                    this.updateMenu();
                }
            };

            menuDataWrapper.removeEventListener('click', handleMenuClick);
            menuDataWrapper.addEventListener('click', handleMenuClick);
            menuDataWrapper.addEventListener('contextmenu', (event) => {
                event.preventDefault();
            });
        }

        const tabMenu = document.getElementById('tab-menu');
        if (tabMenu) {
            tabMenu.addEventListener('click', (event) => {
                const target = event.target;
                if (target.id === 'menu-tab') {
                    this.toggleOverlay({ tab: 'menu' });
                } else if (target.id === 'character-tab') {
                    this.toggleOverlay({ tab: 'character' });
                } else if (target.id === 'log-tab') {
                    this.toggleOverlay({ tab: 'log' });
                } else if (target.id === 'journey-tab') {
                    this.toggleOverlay({ tab: 'journey' });
                } else if (target.id === 'shop-tab') {
                    this.toggleOverlay({ tab: 'shop' });
                } else if (target.id === 'close-tabs') {
                    this.toggleOverlay({});
                }
            });
            tabMenu.addEventListener('contextmenu', (event) => {
                event.preventDefault();
            });
        }

        const inventory = document.getElementById('inventory');
        if (inventory) {
            inventory.addEventListener('dragstart', (event) => {
                const target = event.target.closest('.item-icon');
                if (!target) return;
                const itemData = JSON.parse(target.getAttribute('data-item') || '{}');
                const index = parseInt(target.closest('.inventory-item').dataset.index, 10);
                event.dataTransfer.setData('text/plain', JSON.stringify({ item: itemData, index, source: 'inventory' }));
                this.hideItemTooltip(itemData);
                //console.log('MenuUiSystem: Dragstart from inventory (main):', { itemData, index });
            }, { capture: true });

            inventory.addEventListener('dragover', (e) => e.preventDefault());
            inventory.addEventListener('drop', (e) => {
                e.preventDefault();
                const rawData = e.dataTransfer.getData('text/plain');
                let data;
                try {
                    data = JSON.parse(rawData);
                    //console.log('MenuUiSystem: Drop on inventory (main):', data);
                } catch (err) {
                    console.error('Inventory drop failed - invalid data:', rawData, err);
                    return;
                }
                if (data.source === 'equip') {
                    this.eventBus.emit('UnequipItem', { entityId: 'player', slot: data.slot });
                    this.updateCharacterUI({ entityId: 'player' });
                }
            });

            inventory.addEventListener('contextmenu', (event) => {
                event.preventDefault();
                const target = event.target.closest('.inventory-item');
                if (!target) return;

                const itemElement = event.target.closest('.item-icon');
                if (!itemElement) return;
                const itemData = JSON.parse(itemElement.getAttribute('data-item') || '{}');
                if (!itemData.uniqueId) {
                    console.error('MenuUiSystem: Item missing uniqueId:', itemData);
                    return;
                }
                this.hideItemTooltip(itemData);
                if (itemData.useItem) {
                    this.eventBus.emit('UseItem', { entityId: 'player', uniqueId: itemData.uniqueId });
                } else {
                    this.eventBus.emit('DropItem', { uniqueId: itemData.uniqueId });
                }
                this.updateCharacterUI({ entityId: 'player' });
            });

            inventory.addEventListener('mouseover', (event) => {
                const target = event.target.closest('.item-icon');
                if (!target) return;
                const itemData = JSON.parse(target.getAttribute('data-item') || '{}');
                this.showItemTooltip(itemData, event);
            }, { capture: true });

            inventory.addEventListener('mouseout', (event) => {
                const target = event.target.closest('.item-icon');
                if (!target) return;
                const itemData = JSON.parse(target.getAttribute('data-item') || '{}');
                this.hideItemTooltip(itemData);
            }, { capture: true });
        }

        this.setupInventoryTabs('inventory-tabs', 'inventory-item-wrapper');

        const equippedItems = document.getElementById('equipped-items');
        if (equippedItems) {
            equippedItems.addEventListener('dragstart', (event) => {
                const slot = event.target.closest('.equip-slot');
                if (!slot) return;
                const itemElement = event.target.closest('.item-icon');
                if (!itemElement) return;
                const itemData = JSON.parse(itemElement.getAttribute('data-item') || '{}');
                const slotName = JSON.parse(slot.getAttribute('data-equip_slot') || '{}').slot;
                event.dataTransfer.setData('text/plain', JSON.stringify({ item: itemData, slot: slotName, source: 'equip' }));
                this.hideItemTooltip(itemData);
                //console.log('MenuUiSystem: Dragstart from equipped-items:', { itemData, slotName });
            });

            equippedItems.addEventListener('dragover', (e) => e.preventDefault());
            equippedItems.addEventListener('drop', (e) => {
                e.preventDefault();
                const slot = e.target.closest('.equip-slot');
                if (!slot) return;
                slot.classList.remove('drag-over');
                const rawData = e.dataTransfer.getData('text/plain');
                let data;
                try {
                    data = JSON.parse(rawData);
                    //console.log('MenuUiSystem: Drop on equipped-items:', data);
                } catch (err) {
                    console.error('Equip drop failed - invalid data:', rawData, err);
                    return;
                }
                const slotName = JSON.parse(slot.getAttribute('data-equip_slot') || '{}').slot;
                if (data.source === 'inventory' && this.isSlotCompatible(data.item, slotName)) {
                    this.eventBus.emit('EquipItem', { entityId: 'player', item: data.item, slot: slotName });
                    this.updateCharacterUI({ entityId: 'player' });
                }
            });

            equippedItems.addEventListener('mouseover', (event) => {
                const target = event.target.closest('.item-icon');
                if (!target) return;
                const itemData = JSON.parse(target.getAttribute('data-item') || '{}');
                this.showItemTooltip(itemData, event);
            }, { capture: true });

            equippedItems.addEventListener('mouseout', (event) => {
                const target = event.target.closest('.item-icon');
                if (!target) return;
                const itemData = JSON.parse(target.getAttribute('data-item') || '{}');
                this.hideItemTooltip(itemData);
            }, { capture: true });
        }

        const shopContent = document.getElementById('shop-content');
        if (shopContent) {
            shopContent.addEventListener('contextmenu', (event) => {
                event.preventDefault();
            });
        }

        const shopItems = document.getElementById('shop-items');
        if (shopItems) {
            shopItems.addEventListener('dragstart', (event) => {
                const target = event.target.closest('.item-icon');
                if (!target) return;
                const parent = target.closest('.shop-item');
                if (!parent) return;
                const itemData = JSON.parse(target.getAttribute('data-item') || '{}');
                const index = parseInt(parent.dataset.index, 10);
                event.dataTransfer.setData('text/plain', JSON.stringify({ item: itemData, index, source: 'shop' }));
                //console.log('MenuUiSystem: Dragstart from shop-items:', { itemData, index });
            }, { capture: true });

            shopItems.addEventListener('dragover', (event) => {
                event.preventDefault();
                shopItems.classList.add('drag-over');
                //console.log('MenuUiSystem: Dragover on shop-items');
            });

            shopItems.addEventListener('dragleave', (event) => {
                shopItems.classList.remove('drag-over');
                //console.log('MenuUiSystem: Dragleave on shop-items');
            });

            shopItems.addEventListener('drop', (event) => {
                event.preventDefault();
                shopItems.classList.remove('drag-over');
                //console.log('MenuUiSystem: Drop on shop-items');

                const rawData = event.dataTransfer.getData('text/plain');
                let data;
                try {
                    data = JSON.parse(rawData);
                    //console.log('MenuUiSystem: Drop data:', data);
                } catch (err) {
                    console.error('Shop drop failed - invalid data:', rawData, err);
                    return;
                }

                if (data.source === 'inventory' && data.item) {
                    this.eventBus.emit('SellItem', { item: data.item, uniqueId: data.item.uniqueId });
                    this.updateCharacterUI({ entityId: 'player' });
                }
            });

            shopItems.addEventListener('click', (event) => {
                const target = event.target.closest('.buy-item');
                if (!target) return;
                const uniqueId = target.dataset.uniqueId;
                const overlayState = this.entityManager.getEntity('overlayState').getComponent('OverlayState');
                const npcId = overlayState.activeShopNpcId;
                if (!npcId) {
                    console.error('MenuUiSystem: No active shop NPC ID found for buy');
                    return;
                }
                this.eventBus.emit('BuyItem', { entityId: 'player', npcId, uniqueId });
                //console.log('MenuUiSystem: BuyItem emitted for uniqueId:', uniqueId);
            });
        }

        const shopInventoryWrapper = document.getElementById('shop-inventory-wrapper');
        if (shopInventoryWrapper) {
            shopInventoryWrapper.addEventListener('dragover', (e) => e.preventDefault());
            shopInventoryWrapper.addEventListener('drop', (event) => {
                event.preventDefault();
                const rawData = event.dataTransfer.getData('text/plain');
                let data;
                try {
                    data = JSON.parse(rawData);
                    //console.log('MenuUiSystem: Drop data on shop-inventory-wrapper:', data);
                } catch (err) {
                    console.error('Shop buy drop failed - invalid data:', rawData, err);
                    return;
                }

                if (data.source === 'shop' && data.item) {
                    const overlayState = this.entityManager.getEntity('overlayState').getComponent('OverlayState');
                    const npcId = overlayState.activeShopNpcId;
                    if (!npcId) {
                        console.error('MenuUiSystem: No active shop NPC ID found for buy');
                        return;
                    }
                    this.eventBus.emit('BuyItem', { entityId: 'player', npcId, uniqueId: data.item.uniqueId });
                    //console.log('MenuUiSystem: BuyItem emitted for uniqueId:', data.item.uniqueId);
                }
            });
        }

        const shopInventoryWrapperInner = document.getElementById('shop-inventory-wrapper-inner');
        if (shopInventoryWrapperInner) {
            shopInventoryWrapperInner.addEventListener('contextmenu', (event) => {
                event.preventDefault();
                //console.log('MenuUiSystem: Right-click on shop-inventory-wrapper-inner');
                const target = event.target.closest('.inventory-item');
                if (!target) return;

                const itemElement = event.target.closest('.item-icon');
                if (!itemElement) return;
                const itemData = JSON.parse(itemElement.getAttribute('data-item') || '{}');
                if (!itemData.uniqueId) {
                    console.error('MenuUiSystem: Item missing uniqueId for selling:', itemData);
                    return;
                }
                if (!itemData.isSellable) {
                    this.utilities.logMessage({ channel: "system", message: 'Item Cannot Be Sold' });
                    return;
                }
                this.hideItemTooltip(itemData);
                this.eventBus.emit('SellItem', { item: itemData, uniqueId: itemData.uniqueId });
                this.updateCharacterUI({ entityId: 'player' });
            });

            shopInventoryWrapperInner.addEventListener('mouseover', (event) => {
                const target = event.target.closest('.item-icon');
                if (!target) return;
                const itemData = JSON.parse(target.getAttribute('data-item') || '{}');
                this.showItemTooltip(itemData, event);
            }, { capture: true });

            shopInventoryWrapperInner.addEventListener('mouseout', (event) => {
                const target = event.target.closest('.item-icon');
                if (!target) return;
                const itemData = JSON.parse(target.getAttribute('data-item') || '{}');
                this.hideItemTooltip(itemData);
            }, { capture: true });
        }

        this.setupInventoryTabs('shop-inventory-tabs', 'shop-inventory-wrapper-inner');

        const statWrapper = document.getElementById('character-stat-wrapper');
        if (statWrapper) {
            statWrapper.addEventListener('click', (event) => {
                const target = event.target.closest('.increment:not(.hidden)');
                if (!target) return;

                const currentStats = this.entityManager.getEntity('player').getComponent('Stats');
                if (currentStats.unallocated < 1 || currentStats.isLocked) {
                    return;
                }

                const statId = target.id;
                if (!statId) return;
                const stat = statId.replace('increment-', '');
                this.eventBus.emit('AllocateStat', { stat });
                this.updateCharacterUI({ entityId: 'player' });
            });
        }

        const journeyTabs = document.getElementById('journey-tabs');
        if (journeyTabs) {
            const player = this.entityManager.getEntity('player');
            const journeyPath = player?.getComponent('JourneyPath');
            if (!journeyPath) {
                console.error('MenuUiSystem: JourneyPath component not found on player');
                return;
            }

            const masterPaths = journeyPath.paths.filter(path => path.id === path.parentId);
            const tabMap = {
                'journey-tab-whispers': 'whispers',
                'journey-tab-echoes': 'echoes',
                'journey-tab-lore': 'lore'
            };

            // Ensure all expected tabs are present, even if no journeys exist for them
            journeyTabs.innerHTML = Object.entries(tabMap)
                .map(([tabId, tabName]) => {
                    const path = masterPaths.find(p => p.id === `master_${tabName}`);
                    const displayName = path ? path.title : this.utilities.camelToTitleCase(tabName);
                    const isActive = tabName === this.activeJourneyTab;
                    return `<button id="${tabId}" class="journey-tab-button tab" style="background: ${isActive ? '#0f0' : '#2c672c'};">${displayName}</button>`;
                })
                .join('');

            journeyTabs.addEventListener('click', (event) => {
                const target = event.target.closest('.journey-tab-button');
                if (!target) return;

                const newTab = tabMap[target.id];
                if (newTab && newTab !== this.activeJourneyTab) {
                    this.activeJourneyTab = newTab;
                    journeyTabs.querySelectorAll('.tab').forEach(tab => {
                        tab.classList.toggle('active', tab.id === target.id);
                        tab.style.background = tab.id === target.id ? '#0f0' : '#2c672c';
                    });
                    this.updateJourney();
                }
            });
        }

        const gameOver = document.getElementById('game-over');
        if (gameOver) {
            gameOver.addEventListener('click', (event) => {
                const target = event.target;
                if (target.id === 'view-log') {
                    this.toggleOverlay({ tab: 'log' });
                } else if (target.id === 'restart-button') {
                    location.reload(true);
                } else if (target.id === 'menu') {
                    this.toggleOverlay({ tab: 'menu' });
                }
            });
        }
    }

    toggleOverlay({ tab = null, fromShop = false, npcId = null }) {
        //console.log('MenuUiSystem: ToggleOverlay called with:', { tab, fromShop, npcId });
        const overlayState = this.entityManager.getEntity('overlayState').getComponent('OverlayState');
        const player = this.entityManager.getEntity('player');

        const currentTab = overlayState.activeTab;

        if (tab === currentTab || !tab) {
            overlayState.isOpen = !overlayState.isOpen;
            overlayState.activeTab = overlayState.isOpen ? (currentTab || 'menu') : null;
        } else {
            overlayState.isOpen = true;
            overlayState.activeTab = tab;
        }

        if (overlayState.isOpen && fromShop && tab === 'shop' && npcId) {
            overlayState.activeShopNpcId = npcId;
            if (!player.hasComponent('ShopInteraction')) {
                player.addComponent(new ShopInteractionComponent());
                //console.log('MenuUiSystem: Added ShopInteractionComponent to player');
            }
        } else if (!overlayState.isOpen) {
            overlayState.activeShopNpcId = null;
            if (player.hasComponent('ShopInteraction')) {
                player.removeComponent('ShopInteraction');
                //console.log('MenuUiSystem: Removed ShopInteractionComponent from player');
            }
        }

        document.getElementById('splash-menu').toggleAttribute('hidden', overlayState.isOpen);

        this.tabs.style.display = overlayState.isOpen ? 'block' : 'none';
        this.tabs.className = overlayState.isOpen ? '' : 'hidden';
        if (overlayState.isOpen) {
            this.renderOverlay(overlayState.activeTab);
            //console.log('MenuUiSystem: renderOverlay called with tab:', overlayState.activeTab);
        }
    }

    sortItemsByTypeAttackTier(items) {
        return items.sort((a, b) => {
            if (a.type !== b.type) {
                return a.type.localeCompare(b.type);
            }
            if (a.type === "weapon" && b.type === "weapon") {
                const attackTypeA = a.attackType || "z";
                const attackTypeB = b.attackType || "z";
                if (attackTypeA !== attackTypeB) {
                    return attackTypeA.localeCompare(attackTypeB);
                }
            }
            return b.tierIndex - a.tierIndex;
        });
    }

    filterItems(items, tab) {
        let filteredItems = [];
        switch (tab) {
            case 'all':
                filteredItems = items;
                break;
            case 'armor':
                filteredItems = items.filter(item =>
                    ['armor', 'head', 'gloves', 'boots'].includes(item.type)
                );
                break;
            case 'weapon':
                filteredItems = items.filter(item => item.type === 'weapon');
                break;
            case 'jewelry':
                filteredItems = items.filter(item =>
                    ['amulet', 'ring'].includes(item.type)
                );
                break;
            case 'journey':
                filteredItems = items.filter(item => item.journeyItemId !== undefined);
                break;
            case 'consumables':
                filteredItems = items.filter(item => item.type === 'consumable');
                break;
            default:
                console.warn(`MenuUiSystem: Unknown inventory tab "${tab}", defaulting to all items`);
                filteredItems = items;
                break;
        }
        return filteredItems;
    }


    renderInventory(containerId, items, tab) {
        const inventoryDiv = document.getElementById(containerId);
        if (!inventoryDiv) {
            console.error(`MenuUiSystem: Inventory container ${containerId} not found`);
            return;
        }

        let filteredItems = this.filterItems(items, tab);
        const sortedItems = this.sortItemsByTypeAttackTier(filteredItems);
        inventoryDiv.innerHTML = `
            ${sortedItems.length ? sortedItems.map((item, index) => `
                <div class="inventory-item" data-index="${index}">
                    <p class="inventory-slot ${item.itemTier} ${item.type}">
                        <img src="img/icons/items/${item.icon}" alt="${item.name}" class="item item-icon ${item.itemTier} ${item.type}" data-item='${JSON.stringify(item)}' data-index='${index}' draggable="true" onerror="this.src='img/icons/items/default.svg';">
                        <span class="item-label ${item.itemTier}">${item.type}</span>
                    </p>
                </div>
            `).join('') : '<p>Inventory empty.</p>'}
        `;

        // Reattach dragstart listeners for inventory items
        const inventoryItems = inventoryDiv.querySelectorAll('.item-icon');
        inventoryItems.forEach(item => {
            item.addEventListener('dragstart', (event) => {
                const target = event.target;
                const itemData = JSON.parse(target.getAttribute('data-item') || '{}');
                const index = parseInt(target.closest('.inventory-item').dataset.index, 10);
                event.dataTransfer.setData('text/plain', JSON.stringify({ item: itemData, index, source: 'inventory' }));
                this.hideItemTooltip(itemData);
                //console.log('MenuUiSystem: Dragstart from renderInventory:', { itemData, index });
            });
        });
    }

    renderOverlay(tab) {
        const overlayState = this.entityManager.getEntity('overlayState').getComponent('OverlayState');
        const player = this.entityManager.getEntity('player');
        const stats = player.getComponent('Stats');
        const inventory = player.getComponent('Inventory');

        this.overlayTabButtons(tab);
        this.menuContent.style.display = tab === 'menu' ? 'flex' : 'none';
        this.logContent.style.display = tab === 'log' ? 'block' : 'none';
        this.characterContent.style.display = tab === 'character' ? 'flex' : 'none';
        this.journeyContent.style.display = tab === 'journey' ? 'block' : 'none';
        this.shopContent.style.display = tab === 'shop' ? 'flex' : 'none';

        if (tab === 'log') {
            this.updateLog(overlayState.logMessages);
        } else if (tab === 'character') {
            this.updateCharacter(stats, inventory);
        } else if (tab === 'menu') {
            this.activeMenuSection = 'controls-button';
            this.updateMenu();
        } else if (tab === 'journey') {
            this.updateJourney();
        } else if (tab === 'shop') {
            this.updateShop(stats, inventory);
        }
    }

    overlayTabButtons(activeTab) {
        const tabMenuDiv = document.getElementById('tab-menu');
        if (!tabMenuDiv) return;

        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        const player = this.entityManager.getEntity('player');
        let tabIsDisabled = '';
        if (!gameState.gameStarted) {
            tabIsDisabled = 'disabled';
        }

        // Check if player has a ShopInteraction component
        const showShopButton = player.hasComponent('ShopInteraction');

        tabMenuDiv.innerHTML = `
            <button id="menu-tab" class="tabs-button" style="background: ${activeTab === 'menu' ? '#0f0' : '#2c672c'};">Menu</button>
            <button id="character-tab" ${tabIsDisabled} class="tabs-button" style="background: ${activeTab === 'character' ? '#0f0' : '#2c672c'};">Character</button>
            <button id="log-tab" ${tabIsDisabled} class="tabs-button" style="background: ${activeTab === 'log' ? '#0f0' : '#2c672c'};">Log</button>
            <button id="journey-tab" ${tabIsDisabled} class="tabs-button" style="background: ${activeTab === 'journey' ? '#0f0' : '#2c672c'};">Journey</button>
            ${showShopButton ? `<button id="shop-tab" ${tabIsDisabled} class="tabs-button" style="background: ${activeTab === 'shop' ? '#0f0' : '#2c672c'};">Shop</button>` : ''}
            <button id="close-tabs">X</button>
        `;
    }

    updateMenu() {
        const menuSections = {
            'controls-button': 'controls-data',
            'map-key-button': 'map-key-data',
            'options-button': 'options-data',
            'save-games-button': 'save-games-data',
            'load-games-button': 'load-games-data',
            'new-game-button': 'new-game-data',
            'about-button': 'about-data'
        };

        const gameStarted = this.entityManager.getEntity('gameState').getComponent('GameState').gameStarted;
        //console.log(`MenuUiSystem: updateMenu - gameStarted: ${gameStarted}`);

        document.getElementById('new-game-button').toggleAttribute("hidden", gameStarted);
        document.getElementById('load-games-button').toggleAttribute("hidden", gameStarted);
        document.getElementById('exit-button').toggleAttribute("hidden", !gameStarted);
        document.getElementById('save-games-button').toggleAttribute("hidden", !gameStarted);

        const menuDataWrapper = document.getElementById('menu-data-wrapper');
        if (menuDataWrapper) {
            Object.values(menuSections).forEach(sectionId => {
                const sectionDiv = document.getElementById(sectionId);
                if (sectionDiv) {
                    sectionDiv.style.display = sectionId === menuSections[this.activeMenuSection] ? 'block' : 'none';
                }
            });

            if (this.activeMenuSection === 'save-games-button' || this.activeMenuSection === 'load-games-button') {
                const isSaveMode = this.activeMenuSection === 'save-games-button';
                const targetDiv = document.getElementById(isSaveMode ? 'save-games-data' : 'load-games-data');
                if (targetDiv) {
                    //console.log(`MenuUiSystem: Emitting GetSavedGamesMetadata for section ${this.activeMenuSection}, timestamp: ${Date.now()}`);
                    this.eventBus.emit('GetSavedGamesMetadata', (metadata) => {
                        let html = `<h3>${isSaveMode ? 'Save Game' : 'Load Game'}</h3>`;
                        html += '<ul>';

                        let uniqueCharacterNames = [];
                        uniqueCharacterNames = [...new Set(metadata.map(save => save.characterName))];
                        const selectOptions = uniqueCharacterNames
                            .map(name => `<option value="${name}">${name}</option>`)
                            .join('');

                        if (isSaveMode) {
                            html += `<li class="new-save-game"><button class="save-game" data-save-id="new" style="background-color:#0f0;">New Save</button> |
                            <input type="text" id="save-notes" placeholder="Save Game Notes - not yet enabled :p">
                            <select id="character-select" disabled >${selectOptions}<option value="all">All Characters</option></select></li>`;
                        } else {
                            html += `<li class="new-save-game"><select id="character-select" >${selectOptions}<option value="all">All Characters</option></select></li>`;
                        }

                        metadata.forEach(save => {
                            if (isSaveMode) {
                                html += `<li class="save-game-item" data-character="${save.characterName}"><button class="overwrite-game" data-save-id="${save.saveId}">Overwrite</button> | <span class="save-game-name">${save.characterName}, Tier ${save.tier} - Saved on ${save.timestamp}</span> | <button class="delete-game" data-save-id="${save.saveId}" style="background: red;">Delete</button></li>`;
                            } else {
                                if (save.isDead) {
                                    html += `<li><button class="load-game" data-save-id="${save.saveId}" disabled>Dead</button> | <span class="save-game-name">${save.characterName}, Tier ${save.tier} - Saved on ${save.timestamp}</span>  | <button class="delete-game" data-save-id="${save.saveId}" style="background: red;">Delete</button></li>`;
                                } else {
                                    html += `<li class="save-game-item" data-character="${save.characterName}"><button class="load-game" data-save-id="${save.saveId}">Load</button> | <span class="save-game-name">${save.characterName}, Tier ${save.tier} - Saved on ${save.timestamp}</span> | <button class="delete-game" data-save-id="${save.saveId}" style="background: red;">Delete</button></li>`;
                                }
                            }
                        });

                        html += '</ul>';
                        targetDiv.innerHTML = html;

                        const characterSelect = document.getElementById('character-select');
                        characterSelect.addEventListener('change', (event) => {
                            const selectedCharacter = event.target.value;
                            const saveGameItems = document.querySelectorAll('.save-game-item');
                            saveGameItems.forEach(item => {
                                const characterName = item.getAttribute('data-character');
                                if (selectedCharacter === 'all' || characterName === selectedCharacter) {
                                    item.removeAttribute('hidden');
                                } else {
                                    item.setAttribute('hidden', '');
                                }
                            });
                        });

                        if (isSaveMode) {
                            const currentCharacter = this.entityManager.getEntity('player').getComponent('PlayerState').name;
                            characterSelect.value = currentCharacter;
                        } else {
                            characterSelect.value = uniqueCharacterNames[0];
                        }
                        characterSelect.dispatchEvent(new Event('change'));
                    });
                }
            }
        }

        const menuButtons = document.getElementById('menu-buttons');
        if (menuButtons) {
            const buttons = menuButtons.querySelectorAll('button');
            buttons.forEach(button => {
                button.style.background = button.id === this.activeMenuSection ? '#0f0' : '#2c672c';
            });
        }

        //console.log(`Menu content updated: Active section is ${this.activeMenuSection}`);
    }

    updateLog(logMessages) {
        const logDiv = document.getElementById('log');
        logDiv.innerHTML = logMessages.length
            ? logMessages.slice(0, 200).map(line => `<p>${line}</p>`).join('')
            : '<p>Nothing to log yet.</p>';
    }

    updateJourney() {
        const player = this.entityManager.getEntity('player');
        if (!player) return;

        const journeyState = player.getComponent('JourneyState');
        const journeyPath = player.getComponent('JourneyPath');
        if (!journeyState || !journeyPath) return;

        const activePaths = journeyPath.paths;
        const completedPaths = journeyState.completedPaths;
        const masterPaths = activePaths.filter(path => path.id === path.parentId);
        const masterPathNames = ['whispers', 'echoes', 'lore'];

        if (!masterPathNames.includes(this.activeJourneyTab)) {
            this.activeJourneyTab = masterPathNames[0] || '';
        }

        const journeyDiv = document.getElementById('journey-items-wrapper');
        if (masterPathNames.includes(this.activeJourneyTab)) {
            const masterPathId = `master_${this.activeJourneyTab}`;
            const masterPath = activePaths.find(path => path.id === masterPathId);
            if (!masterPath) {
                journeyDiv.innerHTML = `<p>No data available for ${this.utilities.camelToTitleCase(this.activeJourneyTab)}.</p>`;
                return;
            }

            const activeJourneys = activePaths.filter(path => path.parentId === masterPathId && path.id !== masterPathId);
            let activeContent = '';
            if (activeJourneys.length > 0) {
                activeContent = `
                <h3>Active: ${masterPath.title}</h3>
                ${activeJourneys.map(journey => `
                    <div class="journey-path">
                        <p><strong>${journey.title}</strong></p>
                        <p>${journey.description}</p>
                        <p>Progress: ${journey.tasks.filter(t => t.completed).length}/${journey.tasks.length} tasks complete</p>
                        ${journey.tasks.map(task => {
                    let progressText = '';
                    if (task.completionCondition.type === 'reachTier') {
                        const currentTier = this.entityManager.getEntity('gameState').getComponent('GameState').tier;
                        progressText = `Current Tier: ${currentTier}/${task.completionCondition.tier}`;
                    } else if (task.completionCondition.type === 'findItem') {
                        const inventory = this.entityManager.getEntity('player').getComponent('Inventory');
                        const hasItem = inventory.items.some(item => item.journeyItemId === task.completionCondition.journeyItemId) ||
                            Object.values(inventory.equipped).some(item => item && item.journeyItemId === task.completionCondition.journeyItemId);
                        progressText = `Item Found: ${hasItem ? 'Yes' : 'No'}`;
                    } else if (task.completionCondition.type === 'collectResource') {
                        const resources = this.entityManager.getEntity('player').getComponent('Resource');
                        const count = resources.craftResources[task.completionCondition.resourceType] || 0;
                        progressText = `Collected: ${count}/${task.completionCondition.quantity}`;
                    }
                    return `
                                <div class="journey-task">
                                    <p>${task.title} (${task.completed ? 'Completed' : 'In Progress'})</p>
                                    <p>${task.description}</p>
                                    ${progressText ? `<p>${progressText}</p>` : ''}
                                </div>
                            `;
                }).join('')}
                    </div>
                `).join('')}
            `;
            }

            let completedContent = '';
            const completedRelatedPaths = completedPaths.filter(path => path.parentId === masterPathId);
            if (completedRelatedPaths.length > 0) {
                completedContent = `
                <h3>Completed: ${masterPath.title}</h3>
                ${completedRelatedPaths.map(path => `
                    <div class="journey-path">
                        <p><strong>${path.title}</strong> (Completed on ${new Date(path.completedAt).toLocaleDateString()})</p>
                        <p>${path.completionText}</p>
                    </div>
                `).join('')}
            `;
            }

            journeyDiv.innerHTML = activeContent || completedContent ? `${activeContent}${completedContent}` : `<p>${masterPath.description}</p>`;
            //console.log(`MenuUiSystem: Updated journey log for ${this.activeJourneyTab}`);
        } else {
            journeyDiv.innerHTML = '<p>Invalid journey tab selected.</p>';
        }
    }

    updateCharacter(stats, inventory) {
        const statWrapper = document.getElementById('character-stat-wrapper');

        const statList = [
            { stat: 'intellect', incrementable: true },
            { stat: 'prowess', incrementable: true },
            { stat: 'agility', incrementable: true },
            { stat: 'range', incrementable: false }, 
            { stat: 'damageBonus', incrementable: false },
            { stat: 'meleeBonus', incrementable: false },
            { stat: 'rangedBonus', incrementable: false },
            { stat: 'armor', incrementable: false }, 
            { stat: 'block', incrementable: false },
            { stat: 'dodge', incrementable: false },
            { stat: 'defense', incrementable: false },
            { stat: 'resistMagic', incrementable: false },
            { stat: 'movementSpeed', incrementable: false },
        ];

        let statHtml = `
        <div><p style="font-weight:bold;">Unspent Points:</p></div>
        <div>Stat Points: <span>${stats.unallocated}</span></div>
        <div>Skill Points: <span>0</span></div>
        <div><hr></div>`;

        statList.forEach(statEntry => {
            const statName = statEntry.stat;
            const isIncrementable = statEntry.incrementable;
            const displayName = this.utilities.camelToTitleCase(statName);
            const statValue = stats[statName] || 0;
            const incrementSpan = isIncrementable
                ? `<span id="increment-${statName}" title="Add point to ${displayName}" class="increment hidden">+</span>`
                : `<span class="increment hidden"> </span>`;
            statHtml += `
            <div>${incrementSpan}<span class="stat-value">${statValue}</span> : ${displayName}</div>`;
        });

        statWrapper.innerHTML = statHtml;

        const canAllocate = stats.unallocated > 0 && !stats.isLocked;
        statList.forEach(statEntry => {
            if (statEntry.incrementable) {
                const incrementSpan = document.getElementById(`increment-${statEntry.stat}`);
                if (incrementSpan) {
                    incrementSpan.classList.toggle('hidden', !canAllocate);
                }
            }
        });

        const equipSlots = document.querySelectorAll('.equip-slot');
        equipSlots.forEach(slot => {
            const slotData = JSON.parse(slot.getAttribute('data-equip_slot') || '{}');
            const slotName = slotData.slot;
            const equippedItem = inventory.equipped[slotName] || null;

            if (equippedItem) {
                slot.innerHTML = `<img src="img/icons/items/${equippedItem.icon}" alt="${equippedItem.name}" 
                class="item item-icon ${equippedItem.itemTier} ${equippedItem.type}" data-item='${JSON.stringify(equippedItem)}' 
                draggable="true" onerror="this.src='img/icons/items/default.svg';">`;
                slot.classList.remove('empty');
                slot.classList.add('equipped');
            } else {
                slot.innerHTML = '';
                slot.classList.add('empty');
                slot.classList.remove('equipped');
            }
        });

        const inventoryHash = JSON.stringify(inventory.items.map(item => item.uniqueId)) +
            JSON.stringify(Object.values(inventory.equipped).map(item => item?.uniqueId)) +
            this.activeInventoryTab;
        if (inventoryHash === this.lastInventoryHash) {
            return;
        }
        this.lastInventoryHash = inventoryHash;

        this.renderInventory('inventory-item-wrapper', inventory.items, this.activeInventoryTab);
    }

    updateShop(stats, inventory) {
        const overlayState = this.entityManager.getEntity('overlayState').getComponent('OverlayState');
        const npcId = overlayState.activeShopNpcId;
        if (!npcId) {
            console.error('MenuUiSystem: No active shop NPC ID found');
            return;
        }

        const npc = this.entityManager.getEntity(npcId);
        if (!npc) {
            console.error('MenuUiSystem: NPC not found for ID:', npcId);
            return;
        }

        const shopComponent = npc.getComponent('ShopComponent');
        if (!shopComponent) {
            console.error('MenuUiSystem: ShopComponent not found for NPC:', npcId);
            return;
        }

        const shopItems = shopComponent.items || [];
        const shopType = this.utilities.camelToTitleCase(shopComponent.shopType);

        const shopTypeElement = document.getElementById('shop-type');
        if (shopTypeElement) {
            shopTypeElement.textContent = shopType;
        }

        const shopItemsDiv = document.getElementById('shop-items');
        if (shopItemsDiv) {
            shopItemsDiv.innerHTML = `
                ${shopItems.length ? shopItems.map((item, index) => {
                const statsHtml = item.stats ? Object.entries(item.stats)
                    .map(([stat, value]) => `${value > 0 ? '+' : ''}${value} ${this.utilities.camelToTitleCase(stat)}`)
                    .join(', ') : '';
                const weaponStats = item.type === 'weapon' ? `Damage: ${item.baseDamageMin}-${item.baseDamageMax}${item.attackType === 'melee' ? `, Block: ${item.baseBlock || 0}` : item.attackType === 'ranged' ? `, Range: ${item.baseRange || 0}` : ''}` : item.type === 'armor' ? `Armor: ${item.armor || 0}` : '';
                const affixes = item.affixes ? item.affixes.map(affix => affix.name.charAt(0).toUpperCase() + affix.name.slice(1)).join(', ') : 'None';
                return `
                        <div class="shop-item ${item.itemTier}" data-index="${index}">
                            <div class="item-name">${item.name}</div>
                            <div class="shop-item-details">
                                <div class="shop-item-left">
                                    <img src="img/icons/items/${item.icon}" alt="${item.name}" class="item-icon ${item.itemTier} ${item.type}" data-item='${JSON.stringify(item)}' draggable="true" onerror="this.src='img/icons/items/default.svg';">
                                    <div class="item-price">${item.purchasePrice} gold</div>
                                    <button class="buy-item" data-unique-id="${item.uniqueId}">Buy</button>
                                </div>
                                <div class="shop-item-right">
                                    <div class="tier-type">${item.itemTier} ${item.type}</div>
                                    <div class="item-stats">Stats: ${statsHtml}${statsHtml && weaponStats ? ', ' : ''}${weaponStats}</div>
                                    <div class="item-affixes">Affixes: ${affixes}</div>
                                </div>
                            </div>
                        </div>
                    `;
            }).join('') : '<p>No items for sale.</p>'}
            `;
        }

        this.renderInventory('shop-inventory-wrapper-inner', inventory.items, this.activeInventoryTab);
    }

    addLogMessage({ message }) {
        const overlayState = this.entityManager.getEntity('overlayState').getComponent('OverlayState');
        overlayState.logMessages.unshift(message);
        if (overlayState.logMessages.length > 200) overlayState.logMessages.pop();
        if (overlayState.isOpen && overlayState.activeTab === 'log') {
            this.renderOverlay('log');
        }
    }

    updateCharacterUI({ entityId }) {
        if (entityId !== 'player') return;

        const player = this.entityManager.getEntity('player');
        const stats = player.getComponent('Stats');
        const inventory = player.getComponent('Inventory');
        const overlayState = this.entityManager.getEntity('overlayState').getComponent('OverlayState');

        if (overlayState.isOpen && (overlayState.activeTab === 'character' || overlayState.activeTab === 'shop')) {
            this.renderOverlay(overlayState.activeTab);
        }
    }

    isSlotCompatible(item, slot) {
        const slotMap = {
            amulet: ["amulet"],
            armor: ["armor"],
            head: ["head"],
            gloves: ["gloves"],
            boots: ["boots"],
            ring: ["leftring", "rightring"],
            weapon: ["mainhand", "offhand"]
        };
        const validSlots = slotMap[item.type];
        return validSlots?.includes(slot) || false;
    }

    gameOver(dataObj) {
        const gameOverDiv = document.getElementById('game-over');
        gameOverDiv.style.display = 'block';

        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');
        gameOverDiv.classList.add(gameState.isVictory ? 'victory' : 'death');

        document.getElementById('game-over-message').textContent = dataObj.message;
        this.eventBus.emit('GameOverRendered');
    }

    showItemTooltip(itemData, event)     {
        if (!itemData || !itemData.uniqueId) {
            return;
        }

        if (!this.tooltipCache) {
            console.error("Tooltip cache not initialized");
            this.tooltipCache = new Map();
        }

        // Clear any existing timeout to prevent multiple triggers
        if (this.tooltipTimeout) {
            clearTimeout(this.tooltipTimeout);
        }

        // Set a delay before showing the tooltip
        this.tooltipTimeout = setTimeout(() => {
            let tooltip = this.tooltipCache.get(itemData.uniqueId);
            if (!tooltip) {
                tooltip = document.createElement('div');
                tooltip.id = `item-tooltip-${itemData.uniqueId}`;
                tooltip.className = `item-tooltip-class ${itemData.itemTier}`;
                tooltip.style.position = 'absolute';
                tooltip.style.whiteSpace = 'pre-wrap';

                const content = document.createElement('div');

                const name = document.createElement('div');
                name.className = 'item-tooltip-name';
                name.textContent = this.utilities.encodeHTMLEntities(itemData.name);
                content.appendChild(name);

                const iconContainerParagraph = document.createElement('p');
                iconContainerParagraph.className = `item-tooltip-icon-wrap ${itemData.itemTier}`;
                content.appendChild(iconContainerParagraph);

                const icon = document.createElement('img');
                icon.className = `item-tooltip-icon ${itemData.itemTier}`;
                icon.src = `img/icons/items/${itemData.icon}`;
                icon.alt = itemData.name;
                iconContainerParagraph.appendChild(icon);

                const typeTier = document.createElement('div');
                typeTier.className = 'item-tooltip-type-tier';
                typeTier.textContent = `${itemData.itemTier} ${itemData.type}`;
                content.appendChild(typeTier);

                if (itemData.type === "weapon") {
                    const damage = document.createElement('div');
                    damage.className = 'item-tooltip-damage';
                    damage.textContent = `Damage: ${itemData.baseDamageMin}-${itemData.baseDamageMax}`;
                    content.appendChild(damage);
                    switch (itemData.attackType) {
                        case "melee":
                            const baseBlock = document.createElement('div');
                            baseBlock.className = 'item-tooltip-base-block';
                            baseBlock.textContent = `Block: ${itemData.baseBlock || 0}`;
                            content.appendChild(baseBlock);
                            break;
                        case "ranged":
                            const baseRange = document.createElement('div');
                            baseRange.className = 'item-tooltip-base-range';
                            baseRange.textContent = `Range: ${itemData.baseRange || 0}`;
                            content.appendChild(baseRange);
                            break;
                    }
                } else if (itemData.type === "armor") {
                    const armor = document.createElement('div');
                    armor.className = 'item-tooltip-armor';
                    armor.textContent = `Armor: ${itemData.armor || 0}`;
                    content.appendChild(armor);
                } else if (itemData.type === "head") {
                    const armor = document.createElement('div');
                    armor.className = 'item-tooltip-armor';
                    armor.textContent = `Armor: ${itemData.armor || 0}`;
                    content.appendChild(armor);
                } else if (itemData.type === "gloves") {
                    const armor = document.createElement('div');
                    armor.className = 'item-tooltip-armor';
                    armor.textContent = `Armor: ${itemData.armor || 0}`;
                    content.appendChild(armor);
                } else if (itemData.type === "boots") {
                    const movementSpeed = document.createElement('div');
                    movementSpeed.className = 'item-tooltip-movementSpeed';
                    movementSpeed.textContent = `Move Speed: ${itemData.baseMovementSpeed || 0}%`;
                    content.appendChild(movementSpeed);
                }

                if ('stats' in itemData && itemData.stats) {
                    const divider = document.createElement('hr');
                    divider.className = 'tooltip-divider';
                    content.appendChild(divider);

                    const propCount = Object.keys(itemData.stats).length;
                    if (propCount > 0) {
                        const statsContainer = document.createElement('div');
                        statsContainer.className = 'tooltip-stats';
                        Object.entries(itemData.stats).forEach(([stat, value]) => {
                            let critChar = '';
                            const statLine = document.createElement('div');
                            statLine.className = 'tooltip-stat';
                            const critStats = itemData.critStats || [];
                            if (critStats.includes(stat)) {
                                statLine.className += ' crit-stat';
                                critChar = '!';
                            }
                            statLine.textContent = `${value > 0 ? '+' : ''}${value} : ${this.utilities.encodeHTMLEntities(stat)} ${this.utilities.encodeHTMLEntities(critChar)}`;
                            statsContainer.appendChild(statLine);
                        });
                        content.appendChild(statsContainer);
                    }
                }

                if (itemData.affixes && itemData.affixes.length > 0) {
                    const affixDivider = document.createElement('hr');
                    affixDivider.className = 'tooltip-divider';
                    content.appendChild(affixDivider);
                    itemData.affixes.forEach(affix => {
                        const affixElement = document.createElement('div');
                        affixElement.className = 'tooltip-affix';
                        const affixName = affix.name ? affix.name.charAt(0).toUpperCase() + affix.name.slice(1) : 'Unnamed';
                        affixElement.textContent = `${affixName}: ${affix.description || 'No description'}`;
                        content.appendChild(affixElement);
                    });
                }

                const descriptionDivider = document.createElement('hr');
                descriptionDivider.className = 'tooltip-divider';
                content.appendChild(descriptionDivider);

                const description = document.createElement('div');
                description.className = 'tooltip-description';
                description.textContent = `${itemData.description}`;
                content.appendChild(description);

                const sellInfoDivider = document.createElement('hr');
                sellInfoDivider.className = 'tooltip-divider';
                content.appendChild(sellInfoDivider);

                const sellInfo = document.createElement('div');
                sellInfo.className = 'tooltip-sellInfo';
                sellInfo.textContent = 'Item Cannot Be Sold';

                if (itemData.isSellable) {
                    sellInfo.textContent = `Sellable | Value: ${itemData.goldValue}`;
                }
                content.appendChild(sellInfo);

                tooltip.appendChild(content);
                document.body.appendChild(tooltip);
                this.tooltipCache.set(itemData.uniqueId, tooltip);
            }

            tooltip.style.display = 'block';

            // Position the tooltip relative to the triggering item
            const target = event.target.closest('.item-icon');
            if (target) {
                const rect = target.getBoundingClientRect();
                const tooltipWidth = tooltip.offsetWidth;
                const tooltipHeight = tooltip.offsetHeight;

                // Calculate position relative to the item
                // const x = rect.left + window.scrollX + rect.width + 10; // Position to the right of the item
                const x = rect.left + window.scrollX - tooltipWidth - 10; // Position to the left of the item
                const y = rect.top + window.scrollY + (rect.height / 2) - (tooltipHeight / 2); // Center vertically

                // Ensure the tooltip stays within the viewport
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;

                //tooltip.style.left = `${Math.min(x, viewportWidth - tooltipWidth - 10)}px`; // Position to the right of the item
                tooltip.style.left = `${Math.max(10, Math.min(x, viewportWidth - tooltipWidth - 10))}px`;// Position to the left of the item
                tooltip.style.top = `${Math.max(10, Math.min(y, viewportHeight - tooltipHeight - 10))}px`;
            }
        }, 300);
    }

    hideItemTooltip(itemData) {
        if (!itemData || !itemData.uniqueId) {
            return;
        }

        // Clear the timeout to prevent the tooltip from showing if the mouse leaves quickly
        if (this.tooltipTimeout) {
            clearTimeout(this.tooltipTimeout);
            this.tooltipTimeout = null;
        }

        if (!this.tooltipCache) {
            console.error("Tooltip cache not initialized");
            this.tooltipCache = new Map();
        }
        const tooltip = this.tooltipCache.get(itemData.uniqueId);
        if (tooltip) {
            tooltip.style.display = 'none';
        }
    }
}
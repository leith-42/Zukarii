// systems/GameDataIOSystem.js
import { System } from '../core/Systems.js';

let instance = null;
export class GameDataIOSystem extends System {
    constructor(entityManager, eventBus, utilities) {
        if (instance) {
            return instance;
        }

        super(entityManager, eventBus, utilities);
        this.requiredComponents = [];
        this.isProcessing = false;
    }

    init() {
        if (!this.eventBus.listeners.has('RequestSaveGame')) {
            this.eventBus.on('RequestSaveGame', (data) => this.handleSaveRequest(data));
        }
        if (!this.eventBus.listeners.has('RequestLoadGame')) {
            this.eventBus.on('RequestLoadGame', (data, callback) => this.handleLoadRequest(data, callback));
        }
        if (!this.eventBus.listeners.has('GetSavedGamesMetadata')) {
            this.eventBus.on('GetSavedGamesMetadata', (callback) => this.getSavedGamesMetadata(callback));
        }
        if (!this.eventBus.listeners.has('DeleteSave')) {
            this.eventBus.on('DeleteSave', (data) => this.deleteSave(data));
        }
    }

    async handleSaveRequest({ saveId = null, saveNotes = '' }) {
        console.log('GameDataIOSystem: handleSaveRequest called, isProcessing:', this.isProcessing, 'stack:', new Error().stack);
        if (this.isProcessing) {
            console.warn('GameDataIOSystem: Save operation already in progress, aborting');
            return;
        }
        this.isProcessing = true;
        console.log('GameDataIOSystem: Set isProcessing to true');

        const newSaveId = saveId || this.utilities.generateUniqueId();
        const saveKey = `save_${newSaveId}`;
        const saveData = this.bundleGameData();
        saveData.id = newSaveId;
        saveData.notes = saveNotes;
        console.log('GameDataIOSystem: Saving with key:', saveKey, 'data:', JSON.stringify(saveData, null, 2));

        const savePromise = new Promise((resolve) => {
            const onSaveComplete = ({ key: savedKey, success, message }) => {
                if (savedKey === saveKey) {
                    console.log('GameDataIOSystem: Save completed for key:', savedKey);
                    this.eventBus.off('GameSaved', onSaveComplete);
                    this.eventBus.emit('SaveCompleted', { key: savedKey, success, message });
                    resolve({ success, message });
                }
            };
            this.eventBus.on('GameSaved', onSaveComplete);
        });

        this.eventBus.emit('RequestSaveGameToStorage', { key: saveKey, data: saveData });
        console.log('GameDataIOSystem: Emitted RequestSaveGameToStorage for key:', saveKey);

        await savePromise;
        this.isProcessing = false;
        console.log('GameDataIOSystem: Reset isProcessing to false after save completed');
    }

    async handleLoadRequest({ saveId }, uiCallback) {
        console.log('GameDataIOSystem: handleLoadRequest called, isProcessing:', this.isProcessing, 'saveId:', saveId);
        if (this.isProcessing) {
            console.warn('GameDataIOSystem: Load operation already in progress, aborting');
            return;
        }
        this.isProcessing = true;
        console.log('GameDataIOSystem: Set isProcessing to true for load');

        const loadPromise = new Promise((resolve) => {
            this.eventBus.emit('RequestLoadGameFromStorage', { key: `save_${saveId}` }, (data) => {
                if (data) {
                    const tier = data.tier;
                    console.log("Player Data: ", data.player);
                    // Pass the entire save data to TransitionLoad, including journey state
                    this.eventBus.emit('TransitionLoad', { tier, data });
                    this.eventBus.emit('GameLoaded', { saveId, success: true, message: 'Game loaded successfully', data });
                    if (uiCallback) uiCallback({ success: true, data });
                    resolve({ success: true, message: 'Game loaded successfully' });
                } else {
                    this.eventBus.emit('GameLoaded', { saveId, success: false, message: 'Failed to load game', data: null });
                    if (uiCallback) uiCallback({ success: false });
                    resolve({ success: false, message: 'Failed to load game' });
                }
            });
        });

        await loadPromise;
        this.isProcessing = false;
        console.log('GameDataIOSystem: Reset isProcessing to false after successful load');
        this.eventBus.emit('StartGame');
    }

    bundleGameData() {
        const player = this.entityManager.getEntity('player');
        const gameState = this.entityManager.getEntity('gameState');
        const gameStateComp = gameState.getComponent('GameState');
        const overlayState = this.entityManager.getEntity('overlayState').getComponent('OverlayState');

        return {
            timestamp: new Date().toLocaleString(),
            characterName: player ? player.getComponent('PlayerState').name : 'Unknown',
            tier: gameStateComp ? gameStateComp.tier : 0,
            isDead: player ? player.getComponent('PlayerState').dead : false,
            player: player ? {
                Position: player.getComponent('Position'),
                Health: player.getComponent('Health'),
                Mana: player.getComponent('Mana'),
                Stats: player.getComponent('Stats'),
                Inventory: player.getComponent('Inventory'),
                Resource: player.getComponent('Resource'),
                AttackSpeed: player.getComponent('AttackSpeed'),
                Affix: player.getComponent('Affix'),
                PlayerState: player.getComponent('PlayerState'),
                JourneyState: player.getComponent('JourneyState'), 
                JourneyPath: player.getComponent('JourneyPath') ,   
                PlayerAchievements: player.getComponent('PlayerAchievements'),
                PortalBinding: player.hasComponent('PortalBinding') ? player.getComponent('PortalBinding') : null // Add PortalBinding conditionally
            } : null,
            gameState: gameState ? {
                GameState: gameStateComp,
                //JourneyPaths: gameState.getComponent('JourneyPaths'), // Add JourneyPaths
                OfferedJourneys: gameState.getComponent('OfferedJourneys') // Add OfferedJourneys
            } : null,
            overlayState: overlayState ? {
                OverlayState: overlayState
            } : null
        };
    }

    async getSavedGamesMetadata(callback) {
        setTimeout(async () => {
            this.eventBus.emit('RequestSavedGamesList', (savedGames) => {
                console.log('GameDataIOSystem: Received saved games:', savedGames);
                const metadata = savedGames
                    .filter(game => game.key.startsWith('save_'))
                    .map(game => {
                        const saveId = game.key.replace('save_', '');
                        return {
                            saveId,
                            characterName: game.data.characterName || 'Unknown',
                            tier: game.data.tier || 0,
                            timestamp: game.data.timestamp || null,
                            timestampDate: game.data.timestamp ? new Date(game.data.timestamp) : new Date(0),
                            isDead: game.data.isDead || false,
                            notes: game.data.notes || ''
                        };
                    })
                    .sort((a, b) => b.timestampDate - a.timestampDate);
                console.log('GameDataIOSystem: Metadata after processing:', metadata);
                callback(metadata);
            });
        }, 100);
    }

    deleteSave({ saveId }) {
        const saveKey = `save_${saveId}`;
        try {
            localStorage.removeItem(saveKey);
            console.log(`GameDataIOSystem: Deleted save with ID ${saveId}`);
            this.eventBus.emit('SaveDeleted', { saveId, success: true, message: `Save with ID ${saveId} deleted` });
        } catch (error) {
            console.error(`GameDataIOSystem: Failed to delete save with ID ${saveId}:`, error);
            this.eventBus.emit('SaveDeleted', { saveId, success: false, message: `Failed to delete save with ID ${saveId}` });
        }
    }
}
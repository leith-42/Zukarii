// systems/DataSystem.js
// Manages static game data (monsters, items, levels)

import { System } from '../core/Systems.js';
import { customLevels } from '../data/cfg/customLevels.js';

export class DataSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = [];
        this.customLevels = customLevels; // Load custom levels from external file

        console.log('DataSystem: Custom levels to load :', this.customLevels);

//console.log('DataSystem: Preloading custom levels');
        this.customLevels.forEach((level, tier) => {
            console.log(`DataSystem: Preloading custom level for tier ${tier}:`, level);
            fetch(level.jsonPath)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Failed to load custom level for tier ${tier}: ${response.status} ${response.statusText}`);
                    }
                    return response.json();
                })
                .then(data => {
                    this.customLevels.set(tier, { ...level, data }); // Store the loaded data in the Map
                    console.log(`DataSystem: Loaded custom level for tier ${tier}`);
                })
                .catch(error => {
                    console.error(`DataSystem: Failed to load custom level for tier ${tier}:`, error);
                });
        });

        // Preload custom levels
      //  console.log('DataSystem: Preloading custom levels');
        this.customLevelsPromise = Promise.all(
            Array.from(this.customLevels.entries()).map(([tier, level]) =>
                fetch(level.jsonPath)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`Failed to load custom level for tier ${tier}: ${response.status} ${response.statusText}`);
                        }
                        return response.json();
                    })
                    .then(data => {
                        this.customLevels.set(tier, { ...level, data }); // Store the loaded data in the Map
                        console.log(`DataSystem: Loaded custom level for tier ${tier}`);
                    })
                    .catch(error => {
                        console.error(`DataSystem: Failed to load custom level for tier ${tier}:`, error);
                    })
            )
        );

        // Load random monsters from JSON file asynchronously
       // console.log('DataSystem: Starting fetch for randomMonsters.json');
        this.randomMonstersPromise = fetch('data/json/randomMonsters.json')
            .then(response => {
                console.log('DataSystem: Fetch response received (randomMonsters):', response);
                if (!response.ok) {
                    throw new Error(`Failed to load randomMonsters.json: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('DataSystem: Successfully loaded randomMonsters.json:', data);
                return data;
            })
            .catch(error => {
                console.error('DataSystem: Failed to load randomMonsters.json:', error);
                console.log('DataSystem: Returning empty array as fallback for randomMonsters');
                return [];
            });

        // Load unique monsters from JSON file asynchronously
      //  console.log('DataSystem: Starting fetch for uniqueMonsters.json');
        this.uniqueMonstersPromise = fetch('data/json/uniqueMonsters.json')
            .then(response => {
                console.log('DataSystem: Fetch response received (uniqueMonsters):', response);
                if (!response.ok) {
                    throw new Error(`Failed to load uniqueMonsters.json: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('DataSystem: Successfully loaded uniqueMonsters.json:', data);
                return data;
            })
            .catch(error => {
                console.error('DataSystem: Failed to load uniqueMonsters.json:', error);
                console.log('DataSystem: Returning empty array as fallback for uniqueMonsters');
                return [];
            });

        // Load boss monsters from JSON file asynchronously
       // console.log('DataSystem: Starting fetch for bossMonsters.json');
        this.bossMonstersPromise = fetch('data/json/bossMonsters.json')
            .then(response => {
                console.log('DataSystem: Fetch response received (bossMonsters):', response);
                if (!response.ok) {
                    throw new Error(`Failed to load bossMonsters.json: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('DataSystem: Successfully loaded bossMonsters.json:', data);
                return data;
            })
            .catch(error => {
                console.error('DataSystem: Failed to load bossMonsters.json:', error);
                console.log('DataSystem: Returning empty array as fallback for bossMonsters');
                return [];
            });

        // Load unique items from JSON file asynchronously
      //  console.log('DataSystem: Starting fetch for uniqueItems.json');
        this.uniqueItemsPromise = fetch('data/json/uniqueItems.json')
            .then(response => {
                console.log('DataSystem: Fetch response received:', response);
                if (!response.ok) {
                    throw new Error(`Failed to load uniqueItems.json: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('DataSystem: Successfully loaded uniqueItems.json:', data);
                return data;
            })
            .catch(error => {
                console.error('DataSystem: Failed to load uniqueItems.json:', error);
                console.log('DataSystem: Returning empty array as fallback for uniqueItems');
                return [];
            });

        // Load NPCs from JSON file asynchronously
      //  console.log('DataSystem: Starting fetch for npcs.json');
        this.npcsPromise = fetch('data/json/npcs.json')
            .then(response => {
                console.log('DataSystem: Fetch response received (npcs):', response);
                if (!response.ok) {
                    throw new Error(`Failed to load npcs.json: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('DataSystem: Successfully loaded npcs.json:', data);
                return data;
            })
            .catch(error => {
                console.error('DataSystem: Failed to load npcs.json:', error);
                console.log('DataSystem: Returning empty array as fallback for npcs');
                return [];
            });

        // Custom surface level
        this.customSurfaceLevel = {
            map: this.generateSurfaceMap(), 
            rooms: [{ left: 1, top: 1, w: 8, h: 8, x: 5, y: 5, type: 'SurfaceRoom', connections: [] }],
            stairsUp: { x: 2, y: 2 },
            stairsDown: { x: 5, y: 5 },
            playerSpawn: { x: 1, y: 1 },
            monsters: [],
            treasures: [],
            fountains: [],
            spawn: []
        };

      //  console.log('DataSystem: Starting fetch for itemStatOptions.json');
        this.itemStatOptionsPromise = fetch('data/json/itemStatOptions.json')
            .then(response => {
                console.log('DataSystem: Fetch response received (itemStatOptions):', response);
                if (!response.ok) {
                    throw new Error(`Failed to load itemStatOptions.json: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('DataSystem: Successfully loaded itemStatOptions.json:', data);
                return data;
            })
            .catch(error => {
                console.error('DataSystem: Failed to load itemStatOptions.json:', error);
                console.log('DataSystem: Returning empty object as fallback for itemStatOptions');
                return {};
            });

       // console.log('DataSystem: Starting fetch for journeyPaths.json');
        this.journeyPathsPromise = fetch('data/json/journeyPaths.json')
            .then(response => {
                if (!response.ok) throw new Error(`Failed to load journeyPaths.json: ${response.status}`);
                return response.json();
            })
            .catch(error => {
                console.error('DataSystem: Failed to load journeyPaths.json:', error);
                return [];
            });

       // console.log('DataSystem: Starting fetch for journeyItems.json');
        this.journeyItemsPromise = fetch('data/json/journeyItems.json')
            .then(response => {
                if (!response.ok) throw new Error(`Failed to load journeyItems.json: ${response.status}`);
                return response.json();
            })
            .catch(error => {
                console.error('DataSystem: Failed to load journeyItems.json:', error);
                return [];
            });
    }

    init() {
        this.eventBus.on('GetCustomLevel', (data) => this.provideCustomLevel(data));
        this.eventBus.on('GetRandomMonsters', (data) => this.provideRandomMonsters(data));
        this.eventBus.on('GetUniqueMonsters', (data) => this.provideUniqueMonsters(data));
        this.eventBus.on('GetBossMonsters', (data) => this.provideBossMonsters(data));
        this.eventBus.on('GetUniqueItems', (data) => this.provideUniqueItems(data));
        this.eventBus.on('GetItemStatOptions', (data) => {
            this.provideItemStatOptions(data);
            console.log('DataSystem: GetItemStatOptions event received');
        });
        this.eventBus.on('RequestSaveGameToStorage', (data) => this.saveGame(data));
        this.eventBus.on('RequestLoadGameFromStorage', (data, callback) => this.loadGame(data, callback));
        this.eventBus.on('RequestSavedGamesList', (callback) => this.getSavedGamesList(callback));
        this.eventBus.on('GetNPCs', (data) => this.provideNPCs(data));
        this.eventBus.on('GetJourneyPaths', ({ callback }) => this.provideJourneyPaths({ callback }));
        this.eventBus.on('GetJourneyItems', ({ callback }) => this.provideJourneyItems({ callback }));

        // Add event for custom level JSON
        this.eventBus.on('GetCustomLevelJSON', ({ tier, callback }) => this.provideCustomLevelJSON({ tier, callback }));

        // Preload data
        this.loadData();
    }

    async loadData() {
        try {
           // console.log('DataSystem: Starting fetch for randomMonsters.json');
            this.randomMonsters = await fetch('data/json/randomMonsters.json').then(r => r.json());
            console.log('DataSystem: Successfully loaded randomMonsters.json:', this.randomMonsters);

          //  console.log('DataSystem: Starting fetch for uniqueMonsters.json');
            this.uniqueMonsters = await fetch('data/json/uniqueMonsters.json').then(r => r.json());
            console.log('DataSystem: Successfully loaded uniqueMonsters.json:', this.uniqueMonsters);

          //  console.log('DataSystem: Starting fetch for bossMonsters.json');
            this.bossMonsters = await fetch('data/json/bossMonsters.json').then(r => r.json());
            console.log('DataSystem: Successfully loaded bossMonsters.json:', this.bossMonsters);

          //  console.log('DataSystem: Starting fetch for uniqueItems.json');
            this.uniqueItems = await fetch('data/json/uniqueItems.json').then(r => r.json());
            console.log('DataSystem: Successfully loaded uniqueItems.json:', this.uniqueItems);

         //   console.log('DataSystem: Starting fetch for itemStatOptions.json');
            this.itemStatOptions = await fetch('data/json/itemStatOptions.json').then(r => r.json());
            console.log('DataSystem: Successfully loaded itemStatOptions.json:', this.itemStatOptions);

        //    console.log('DataSystem: Starting fetch for npcs.json');
            this.NPCs = await fetch('data/json/npcs.json').then(r => r.json());
            console.log('DataSystem: Successfully loaded npcs.json:', this.NPCs);

            this.journeyPaths = await fetch('data/json/journeyPaths.json').then(r => r.json()).catch(() => []);
            console.log('DataSystem: Successfully loaded journeyPaths.json:', this.journeyPaths);

            this.journeyItems = await fetch('data/json/journeyItems.json').then(r => r.json()).catch(() => []);
            console.log('DataSystem: Successfully loaded journeyItems.json:', this.journeyItems);

        } catch (error) {
            console.error('DataSystem: Failed to load data:', error);
            this.randomMonsters = [];
            this.uniqueMonsters = [];
            this.bossMonsters = [];
            this.uniqueItems = [];
            this.itemStatOptions = {};
            this.NPCs = [];
        }
    }

    // Updated: Make saveGame async
    async saveGame({ key, data }) {
        console.log('DataSystem: Attempting to save game with key:', key, 'data:', data);
        try {
            localStorage.setItem(key, JSON.stringify(data));
            console.log('DataSystem: Successfully saved game with key:', key);
            this.eventBus.emit('GameSaved', { key, success: true, message: `Game saved to ${key}` });
        } catch (error) {
            console.error('DataSystem: Failed to save game:', error);
            this.eventBus.emit('GameSaved', { key, success: false, message: 'Failed to save game' });
        }
        return Promise.resolve();
    }

    // Updated: Make loadGame async
    async loadGame({ key }, callback) {
        try {
            const savedData = localStorage.getItem(key);

            // Check if data exists and is not empty/whitespace
            if (!savedData || savedData.trim().length === 0) {
                console.warn(`DataSystem: No valid data found for key ${key}`);
                callback(null);
                return Promise.resolve();
            }

            const data = JSON.parse(savedData);
            callback(data);
        } catch (error) {
            console.error(`DataSystem: Failed to load game from key ${key}:`, error);
            console.warn(`DataSystem: Corrupted save data detected. Save may be incomplete or damaged.`);
            callback(null);
        }
        return Promise.resolve();
    }

    // Updated: Make getSavedGamesList async
    async getSavedGamesList(callback) {
        const savedGames = [];
        console.log('DataSystem: Fetching saved games from localStorage, total keys:', localStorage.length);
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);

            // Only process keys that start with 'save_' to avoid parsing non-game data
            if (!key || !key.startsWith('save_')) {
                continue;
            }

            console.log('DataSystem: Processing save key:', key);
            try {
                const rawData = localStorage.getItem(key);

                // Check if data exists and is not empty/whitespace
                if (!rawData || rawData.trim().length === 0) {
                    console.warn(`DataSystem: Empty or whitespace data for key ${key}, skipping`);
                    continue;
                }

                const data = JSON.parse(rawData);
                savedGames.push({ key, data });
            } catch (error) {
                console.error(`DataSystem: Failed to parse saved game for key ${key}:`, error);
                console.warn(`DataSystem: Corrupted save detected at ${key}. Consider removing it from localStorage.`);
                // Optionally auto-remove corrupted saves (uncomment if desired):
                // localStorage.removeItem(key);
                // console.log(`DataSystem: Removed corrupted save ${key}`);
            }
        }
        console.log('DataSystem: Saved games fetched:', savedGames);
        callback(savedGames);
        return Promise.resolve();
    }

    generateSurfaceMap() {
        const state = this.entityManager.getEntity('state');
        let map = [];
        for (let y = 0; y < 67; y++) {
            map[y] = [];
            for (let x = 0; x < 122; x++) {
                if (y < 10 && x < 10) {
                    map[y][x] = (y === 0 || y === 9 || x === 0 || x === 9) ? '#' : ' ';
                } else {
                    map[y][x] = '#';
                }
            }
        }
        map[2][2] = '⇑';
        map[5][5] = '⇓';
        return map;
    }
    async provideCustomLevelJSON({ tier, callback }) {
        try {
            await this.customLevelsPromise; // Ensure all custom levels are loaded
            const customLevel = this.customLevels.get(tier);
            if (customLevel && customLevel.data) {
                console.log(`DataSystem: Providing custom level JSON for tier ${tier}`);
                callback(JSON.parse(JSON.stringify(customLevel.data))); // Return a deep copy
            } else {
                console.warn(`DataSystem: No custom level found for tier ${tier}`);
                callback(null);
            }
        } catch (error) {
            console.error('DataSystem: Error providing custom level JSON:', error);
            callback(null);
        }
    }

    provideCustomLevel({ tier, callback }) {
        if (tier === 0) {
            callback(JSON.parse(JSON.stringify(this.customSurfaceLevel)));
        } else {
            console.error('DataSystem: No custom level available for tier:', tier);
            callback(null);
        }
    }

    provideItemStatOptions({ callback }) {
        this.itemStatOptionsPromise
            .then(itemStatOptions => {
                console.log('DataSystem: Providing item stat options:', itemStatOptions);
                callback(JSON.parse(JSON.stringify(itemStatOptions)));
            })
            .catch(error => {
                console.error('DataSystem: Error providing item stat options:', error);
                callback({});
            });
    }

    async provideRandomMonsters({ callback }) {
        try {
            const randomMonsters = await this.randomMonstersPromise;
            console.log('DataSystem: Providing random monsters:', randomMonsters);
            callback(JSON.parse(JSON.stringify(randomMonsters)));
        } catch (error) {
            console.error('DataSystem: Error providing random monsters:', error);
            callback([]);
        }
    }

    async provideUniqueMonsters({ callback }) {
        try {
            const uniqueMonsters = await this.uniqueMonstersPromise;
            console.log('DataSystem: Providing unique monsters:', uniqueMonsters);
            callback(JSON.parse(JSON.stringify(uniqueMonsters)));
        } catch (error) {
            console.error('DataSystem: Error providing unique monsters:', error);
            callback([]);
        }
    }

    async provideBossMonsters({ callback }) {
        try {
            const bossMonsters = await this.bossMonstersPromise;
            console.log('DataSystem: Providing boss monsters:', bossMonsters);
            callback(JSON.parse(JSON.stringify(bossMonsters)));
        } catch (error) {
            console.error('DataSystem: Error providing boss monsters:', error);
            callback([]);
        }
    }

    async provideUniqueItems({ callback }) {
        try {
            const uniqueItems = await this.uniqueItemsPromise;
            console.log('DataSystem: Providing unique items:', uniqueItems);
            callback(JSON.parse(JSON.stringify(uniqueItems)));
        } catch (error) {
            console.error('DataSystem: Error providing unique items:', error);
            callback([]);
        }
    }

    async provideNPCs({ callback }) {
        try {
            const npcs = await this.npcsPromise;
            console.log('DataSystem: Providing NPCs:', npcs);
            callback(JSON.parse(JSON.stringify(npcs)));
        } catch (error) {
            console.error('DataSystem: Error providing NPCs:', error);
            callback([]);
        }
    }

    async provideJourneyPaths({ callback }) {
        try {
            const journeyPaths = await this.journeyPathsPromise;
            callback(JSON.parse(JSON.stringify(journeyPaths)));
        } catch (error) {
            console.error('DataSystem: Error providing journeyPaths:', error);
            callback([]);
        }
    }

    async provideJourneyItems({ callback }) {
        try {
            const journeyItems = await this.journeyItemsPromise;
            callback(JSON.parse(JSON.stringify(journeyItems)));
        } catch (error) {
            console.error('DataSystem: Error providing journeyItems:', error);
            callback([]);
        }
    }
}
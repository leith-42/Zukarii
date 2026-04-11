import { System } from '../core/Systems.js';
export class ItemROGSystem extends System {
    constructor(entityManager, eventBus, utilities) {
        super(entityManager, eventBus, utilities);
        this.itemStatOptions = null; // Initialize as null, will be set asynchronously
    }

    async init() {
        ////console.log('ItemROGSystem: Initializing');
        // Register listener synchronously
        this.eventBus.on('GenerateROGItem', ({ partialItem, dungeonTier, callback }) => {
            ////console.log('ItemROGSystem: Received GenerateROGItem:', { partialItem, dungeonTier });
            const item = this.generateRogItem({ partialItem, dungeonTier });
            ////console.log('ItemROGSystem: Generated item for callback:', item);
            callback(item);
        });
        ////console.log('ItemROGSystem: GenerateROGItem listener registered');
        // Load itemStatOptions asynchronously
        await this.requestItemStatOptions();
        ////console.log('ItemROGSystem: itemStatOptions after init:', this.itemStatOptions);
    }

    async requestItemStatOptions() {
        ////console.log('ItemROGSystem: Requesting itemStatOptions');
        try {
            return new Promise((resolve) => {
                this.eventBus.emit('GetItemStatOptions', {
                    callback: (itemStatOptions) => {
                        this.itemStatOptions = itemStatOptions;
                        ////console.log('ItemROGSystem: Received Item stat options:', this.itemStatOptions);
                        resolve();
                    }
                });
            });
        } catch (err) {
            console.error('ItemROGSystem: Error loading itemStatOptions:', err);
            this.itemStatOptions = null;
        }
    }

    calculateGoldValue(item, dungeonTier) {
        ////console.log('ItemROGSystem: Calculating goldValue for item:', item);
        try {
            // Base gold value from LootManagerSystem: 0.95 * (30 + tier * 10)
            const baseGoldValue = 0.95 * (30 + dungeonTier * 10);

            // Item tier multiplier
            const itemTierMultiplier = {
                junk: 0.5,
                common: 1,
                rare: 2,
                magic: 4,
                mastercraft: 15,
                legendary: 20,
                relic: 35,
                artifact: 50
            }[item.itemTier] || 1;

            // Stat weights for all known stats
            const statWeights = {
                intellect: 5,
                prowess: 5,
                agility: 5,
                maxHp: 5,
                maxMana: 5,
                maxLuck: 5,
                range: 5,
                block: 5,
                didge: 5,
                armor: 5,
                defense: 5,
                baseBlock: 5,
                baseRange: 5,
                rangedBonus: 5,
                meleeBonus: 5,
                damageBonus: 5,
                baseDamageMin: 5,
                baseDamageMax: 5,
                resistMagic: 5
            };

            // Calculate sum of weighted stats
            let sumOfWeightedStats = 0;
            const stats = item.stats || {};
            Object.keys(stats).forEach(stat => {
                const weight = statWeights[stat] !== undefined ? statWeights[stat] : 5;
                if (statWeights[stat] === undefined) {
                    console.warn(`ItemROGSystem: Unknown stat '${stat}' using fallback weight 5`);
                }
                sumOfWeightedStats += stats[stat] * weight;
            });

            // Include item-level stats
            const itemStats = ['baseDamageMin', 'baseDamageMax', 'armor', 'baseBlock', 'baseRange', 'maxLuck'];
            itemStats.forEach(stat => {
                if (item[stat] !== undefined) {
                    sumOfWeightedStats += item[stat] * (statWeights[stat] || 5);
                }
            });

            // Calculate stat multiplier
            let statMultiplier = 1 + sumOfWeightedStats;
            if (!isFinite(sumOfWeightedStats) || sumOfWeightedStats <= 0) {
                console.warn(`ItemROGSystem: Invalid sumOfWeightedStats (${sumOfWeightedStats}) for item ${item.name}, using statMultiplier = 1`);
                statMultiplier = 1;
            }

            // Calculate final gold value
            const goldValue = Math.round((baseGoldValue + statMultiplier) * itemTierMultiplier);
            ////console.log(`ItemROGSystem: Calculated goldValue: base=${baseGoldValue}, tierMultiplier=${itemTierMultiplier}, sumOfWeightedStats=${sumOfWeightedStats}, statMultiplier=${statMultiplier}, total=${goldValue}`);
            return goldValue;
        } catch (err) {
            console.error('ItemROGSystem: Error in calculateGoldValue:', err);
            return 0;
        }
    }

    generateRogItem({ partialItem = { tierIndex: 0 }, dungeonTier }) {
        ////console.log('ItemROGSystem: Generating item with partialItem:', partialItem, 'dungeonTier:', dungeonTier);
        try {
            if (!this.itemStatOptions) {
                console.warn('ItemROGSystem: itemStatOptions not loaded, using fallback behavior');
                return this.generateFallbackItem(partialItem, dungeonTier);
            }

            const item = { ...partialItem };
            const itemTiers = ['junk', 'common', 'rare', 'magic', 'mastercraft', 'legendary', 'relic', 'artifact'];
            const itemTypes = ['weapon', 'armor', 'head', 'gloves', 'boots', 'amulet', 'ring'];

            // Tier handling
            if (item.tierIndex === undefined) {
                console.warn("tierIndex missing in partialItem, defaulting to 0 (junk)");
                item.tierIndex = 0;
            }
            item.itemTier = itemTiers[item.tierIndex];
            if (partialItem.itemTier && partialItem.itemTier !== item.itemTier) {
                console.warn(`Tier mismatch: partialItem.itemTier '${partialItem.itemTier}' ignored, using tierIndex ${item.tierIndex} ('${item.itemTier}')`);
            }

            // Type handling
            if (item.type) {
                if (!itemTypes.includes(item.type)) {
                    console.warn(`Invalid type '${item.type}' provided, randomizing instead`);
                    delete item.type;
                }
            }
            if (!item.type) {
                item.type = itemTypes[Math.floor(Math.random() * itemTypes.length)];
                if (item.tierIndex < 2) {
                    if (item.type === 'ring') item.type = 'weapon';
                    if (item.type === 'amulet') item.type = 'armor';
                }
            }

            // Base stats and weapon-specific logic
            let statOptions = this.itemStatOptions[item.type];
            if (item.type === 'weapon') {
                if (item.attackType) {
                    if (!['melee', 'ranged'].includes(item.attackType)) {
                        console.warn(`Invalid attackType '${item.attackType}' provided, randomizing instead`);
                        delete item.attackType;
                    }
                }
                if (!item.attackType) {
                    item.attackType = Math.random() < 0.5 ? 'melee' : 'ranged';
                }
                statOptions = statOptions[item.attackType];
                if (item.baseDamageMin === undefined || item.baseDamageMin === 0) {
                    item.baseDamageMin = Math.floor(Math.random() * 2) + this.statRoll("baseDamageMin", item) || 1;
                    if (item.tierIndex === 0) item.baseDamageMin = 1;
                }
                if (item.baseDamageMax === undefined || item.baseDamageMax === 0) {
                    item.baseDamageMax = item.baseDamageMin + Math.floor(Math.random() * 5) + this.statRoll("baseDamageMax", item);
                    if (item.tierIndex === 0) item.baseDamageMax = item.baseDamageMin + 1;
                    if (item.tierIndex === 0 && item.attackType === 'ranged') item.baseDamageMax++;
                }
                item.icon = item.attackType === 'melee' ? 'dagger.svg' : 'orb-wand.svg';
                if (item.attackType === 'melee' && (item.baseBlock === undefined || item.baseBlock === 0)) {
                    item.baseBlock = Math.floor(Math.random() * 2) + this.statRoll("baseBlock", item);
                    if (item.tierIndex === 0) item.baseBlock = 1;
                }
                if (item.attackType === 'ranged' && (item.baseRange === undefined || item.baseRange === 0)) {
                    item.baseRange = Math.floor(Math.random() * 2) + this.statRoll("baseRange", item);
                    if (item.tierIndex === 0 && item.baseRange > 3) item.baseRange = 3;
                }
            } else if (item.type === 'armor') {
                if (item.armor === undefined || item.armor === 0) {
                    item.armor = Math.floor(Math.random() * 2) + this.statRoll("armor", item);
                    if (item.tierIndex === 0) item.armor = 1;
                }
                item.icon = 'armor.svg';
            }  else if (item.type === 'head') {
                if (item.armor === undefined || item.armor === 0) {
                    item.armor = Math.floor(Math.random() * 2) + this.statRoll("armor", item);
                    if (item.tierIndex === 0) item.armor = 1;
                }
                 item.icon = 'head.svg';
            } else if (item.type === 'gloves') {
                if (item.armor === undefined || item.armor === 0) {
                    item.armor = Math.floor(Math.random() * 2) + this.statRoll("armor", item);
                    if (item.tierIndex === 0) item.armor = 1;
                }
                item.icon = 'gloves.svg';
            } else if (item.type === 'boots') {
                if (item.baseMovementSpeed === undefined || item.baseMovementSpeed === 0) {
                    item.baseMovementSpeed = Math.floor(Math.random() * 2) + this.statRoll("baseMovementSpeed", item);
                    if (item.tierIndex === 0) item.baseMovementSpeed = 1;
                }
                item.icon = 'boots.svg';
            } else if (item.type === 'amulet' || item.type === 'ring') {
                if (item.maxLuck === undefined || item.maxLuck === 0) {
                    item.maxLuck = this.rollMaxLuck(item, dungeonTier);
                }
                item.icon = item.type === 'amulet' ? 'amulet.svg' : 'ring.svg';
            }

            // Bonus stats
            if (!item.stats || Object.keys(item.stats).length === 0) {
                if ((item.tierIndex === 1 && Math.random() < .5) || item.tierIndex > 1) {
                    const bonusStats = this.getBonusStats(statOptions.bonus, item, dungeonTier);
                    item.stats = bonusStats.slected;
                    item.critStats = bonusStats.crit;
                }
            }
            
            // Check for affix
            let randomAffix = false;
            if (item.tierIndex > 4 && (!item.affixes || item.affixes.length === 0)) { // Add affix to Legendary and above if template has no affix
                randomAffix = true;
                console.warn('ItemROGSystem: ItemAffix = TRUE');
            }
            if (randomAffix) {
                const affix = this.getRandomAffix();
                if (affix) {
                    item.affixes = [affix];
                    ////console.log('ItemROGSystem: Affix added:', affix);
                } else {
                    console.warn('ItemROGSystem: getRandomAffix returned an empty string');
                }
            }

            // Required properties
            item.name = item.name || `${item.itemTier} ${item.type}`;
            item.uniqueId = item.uniqueId || this.utilities.generateUniqueId();
            item.description = item.description || `${item.itemTier} ${item.type}`;

            // Add gold value and isSellable
            item.goldValue = this.calculateGoldValue(item, dungeonTier);
            item.isSellable = true;

            // Ensure all properties from partialItem are preserved
            const finalItem = {
                ...partialItem, // Preserve all original properties
                ...item // Overwrite with generated properties
            };

            ////console.log(`ItemROGSystem: Successfully generated item:`, finalItem);
            return finalItem;
        } catch (err) {
            console.error('ItemROGSystem: Error in generateRogItem:', err);
            return null;
        }
    }

    getBonusStats(statArray, item, dungeonTier) {
        ////console.log('ItemROGSystem: getBonusStats called with statArray:', statArray, 'item:', item, 'dungeonTier:', dungeonTier);
        try {
            if (!this.itemStatOptions || !statArray) {
                console.warn('ItemROGSystem: itemStatOptions or statArray not available, returning empty stats');
                return { slected: {}, crit: [] };
            }
            const itemTier = item.tierIndex;
            let availableStats = [...statArray];
            let selectedStats = {};

            let count = itemTier;

            if (itemTier > 4) { // Add affix to Legendary and above
                count = 4;
            }

            let critCount = 0;

            if (itemTier === 4 || itemTier === 7) { // Chance for bonus stats on Mastercraft and Artifact
                const statCritChance = dungeonTier * .001;
                ////console.log('ItemROGSystem: Mastercraft stat count roll crit chance:', statCritChance);
                if (Math.random() <= statCritChance) {
                    critCount++;
                    ////console.log('ItemROGSystem: Mastercraft stat count roll CRIT - count increased to:', critCount);
                    if (Math.random() <= statCritChance) {
                        critCount++;
                        ////console.log('ItemROGSystem: Mastercraft stat count roll DOUBLE CRIT - count increased to:', critCount);
                        if (Math.random() <= statCritChance) {
                            critCount++;
                            ////console.log('ItemROGSystem: Mastercraft stat count roll TRIPLE CRIT - count increased to:', critCount);
                            if (Math.random() <= statCritChance) {
                                critCount++;
                                ////console.log('ItemROGSystem: Mastercraft stat count roll QUAD CRIT - count increased to:', critCount);
                            }
                        }
                    }
                }
            }

            const critStats = [];
            ////console.log(`ItemROGSystem: Crit count: ${critCount}, available stats:`, availableStats);
            for (let i = 0, c = 0; i < count && availableStats.length > 0; i++, c++) {
                const index = Math.floor(Math.random() * availableStats.length);
                const stat = availableStats.splice(index, 1)[0];
                let isCrit = false;
                if (c < critCount) isCrit = true; // Roll for crit stats
                const statValue = this.statRoll(stat, item, isCrit);

                if (isCrit) {
                    critStats.push(stat);
                    ////console.log('ItemROGSystem: Mastercraft stat roll CRIT - statValue increased to:', statValue);
                }

                if (selectedStats.hasOwnProperty(stat)) {
                    selectedStats[stat] += statValue;
                } else {
                    selectedStats[stat] = statValue;
                }
            }

            ////console.log(`ItemROGSystem: Returning selected stats:`, selectedStats, 'critStats:', critStats);
            return { slected: selectedStats, crit: critStats };
        } catch (err) {
            console.error('ItemROGSystem: Error in getBonusStats:', err);
            return { slected: {}, crit: [] };
        }
    }

    getRandomAffix() {
        ////console.log('ItemROGSystem: Selecting random affix');
        try {
            const itemAffixOptions = [
                {
                    "name": "lifeSteal",
                    "type": "combat",
                    "trigger": "attackHitTarget",
                    "effect": "lifeSteal",
                    "params": {
                        "minDmageHealedPercentage": 0.25,
                        "maxDamageHealedPercentage": 0.50,
                        "chanceToStealLife": 0.15
                    },
                    "description": "Chance to heal for a portion of damage dealt when hitting an enemy."
                },
                {
                    "name": "resilience",
                    "type": "combat",
                    "trigger": "hitByAttack",
                    "effect": "instantHeal",
                    "params": {
                        "minHealPercentage": 0.05,
                        "maxHealPercentage": 0.10,
                        "chanceToHeal": 0.05
                    },
                    "description": "Chance to recover a percentage of missing health on being hit."
                },
                {
                    "name": "arcaneMirror",
                    "type": "combat",
                    "trigger": "hitByAttack",
                    "effect": "reflectDamage",
                    "params": {
                        "minReflectPercentage": 1,
                        "maxReflectPercentage": 0.50,
                        "chanceToReflect": .1
                    },
                    "description": "Chance to trigger an arcane mirror reflecting damage to your attacker on being hit."
                }
            ];
            const index = Math.floor(Math.random() * itemAffixOptions.length);
            ////console.log('ItemROGSystem: Selected affix:', itemAffixOptions[index]);
            return itemAffixOptions[index];
        } catch (err) {
            console.error('ItemROGSystem: Error in getRandomAffix:', err);
            return null;
        }
    }

    rollMaxLuck(item, dungeonTier) {
        ////console.log('ItemROGSystem: Rolling maxLuck for item:', item, 'dungeonTier:', dungeonTier);
        try {
            const baseRoll = Math.floor(Math.random() * 12) - 4;
            const tierFactor = item.tierIndex + Math.floor(dungeonTier / 5);
            const positiveCap = tierFactor * 2 + 1;
            const negativeCap = -Math.floor(tierFactor * 2 / 3);
            let scaledRoll = baseRoll < 0 ? baseRoll : baseRoll + 1;
            scaledRoll = Math.max(Math.min(scaledRoll, positiveCap), negativeCap);
            const finalRoll = scaledRoll + Math.floor(Math.random() * 2);
            const rangeWidth = positiveCap - negativeCap + 1;
            const gapSize = Math.floor(rangeWidth * 0.5);
            const centerThresholdLow = Math.floor((negativeCap + positiveCap) / 2 - gapSize / 2);
            const centerThresholdHigh = centerThresholdLow + gapSize - 1;
            const result = (finalRoll >= centerThresholdLow && finalRoll <= centerThresholdHigh) ? 0 : finalRoll;
            ////console.log('ItemROGSystem: maxLuck result:', result);
            return result;
        } catch (err) {
            console.error('ItemROGSystem: Error in rollMaxLuck:', err);
            return 0;
        }
    }

    statRoll(stat, item, isCrit = false) {
        ////console.log(`ItemROGSystem: Rolling stat ${stat} crit:${isCrit} for item:`, item);
        try {
            if (item[stat] !== undefined && item[stat] !== 0) {
                ////console.log(`ItemROGSystem: Stat ${stat} already set to ${item[stat]}, skipping roll`);
                return 0;
            }

            let value = 0;

            switch (stat) {
                case 'baseDamageMin': value = Math.floor(item.tierIndex * 1.5); break;
                case 'baseDamageMax': value = Math.floor(Math.random() * item.tierIndex) + 1; break;
                case 'baseBlock': value = Math.floor(item.tierIndex) + 1; break;
                case 'baseRange': value = Math.floor(item.tierIndex) + 4; break;
                case 'baseMovementSpeed': value = Math.floor(item.tierIndex) + 4; break; 
                case 'armor': value = Math.floor(item.tierIndex) + 1; break;
                case 'maxHp':
                    if (isCrit) {
                        value = item.tierIndex * 10;
                    } else {
                        value = item.tierIndex * 5 + Math.round(Math.random() * (item.tierIndex * 5));
                    }
                    break;
                case 'maxMana':
                    if (isCrit) {
                        value = item.tierIndex * 4;
                    } else {
                        value = item.tierIndex * 2 + Math.round(Math.random() * (item.tierIndex * 2));
                    }
                    break;
                case 'prowess':
                case 'agility':
                case 'intellect':
                    value = Math.round(item.tierIndex / 2) || 1;
                    if (isCrit) { value++; }
                    break;
                case 'range':
                case 'block':
                case 'dodge':
                case 'defense':
                case'movementSpeed':
                    if (isCrit) {
                        value = item.tierIndex * .5;
                    } else {
                        value = this.randomizeStatRoll(Math.round(item.tierIndex * .5), item);
                    }
                    break;
                case 'damageBonus':
                case 'meleeBonus':
                case 'rangedBonus':
                case 'resistMagic':
                    if (isCrit) {
                        value = item.tierIndex + 1;
                    } else {
                        value = this.randomizeStatRoll((item.tierIndex + 1), item);
                    }
                    break;
                default:
                    ////console.log(`ItemROGSystem: Stat ${stat} not found while attempting to generate a value for item:`, item);
                    return 0;
            }
            ////console.log(`ItemROGSystem: Rolled value for ${stat}:`, value);
            if (isCrit) {
                value = Math.round(value * 1.5);
                ////console.log(`ItemROGSystem: ${stat} rolled CRIT - value increased to:`, value);
            }
            return value;
        } catch (err) {
            console.error('ItemROGSystem: Error in statRoll:', err);
            return 0;
        }
    }

    randomizeStatRoll(max, item) {
        ////console.log('ItemROGSystem: Randomizing stat roll with max:', max, 'item:', item);
        try {
            const baseroll = Math.floor(Math.random() * max) + 1;
            let roll = baseroll;

            if (item.tierIndex >= 3 && roll < (max - 1) && Math.random() < .05) {
                roll++;
            } else if ((item.tierIndex >= 3 && roll < (max - 1) && Math.random() < .01)) {
                roll++;
            } else if (item.tierIndex >= 3 && roll === max && Math.random() < .001) {
                roll++;
            }
            if (item.tierIndex >= 5 && roll < max && Math.random() < .005) { roll++; }
            ////console.log('ItemROGSystem: Randomized stat roll result:', roll);
            return roll;
        } catch (err) {
            console.error('ItemROGSystem: Error in randomizeStatRoll:', err);
            return 0;
        }
    }

    generateFallbackItem(partialItem, dungeonTier) {
        ////console.log('ItemROGSystem: Generating fallback item with partialItem:', partialItem, 'dungeonTier:', dungeonTier);
        try {
            const item = { ...partialItem };
            item.tierIndex = item.tierIndex || 0;
            item.itemTier = ['junk', 'common', 'rare', 'magic', 'mastercraft', 'legendary', 'relic', 'artifact'][item.tierIndex];
            item.type = item.type || ['weapon', 'armor'][Math.floor(Math.random() * 2)];
            item.name = `${item.itemTier} ${item.type}`;
            item.uniqueId = this.utilities.generateUniqueId();
            item.description = `${item.itemTier} ${item.type}`;
            item.goldValue = this.calculateGoldValue(item, dungeonTier);
            item.isSellable = true;
            ////console.log('ItemROGSystem: Generated fallback item:', item);
            return item;
        } catch (err) {
            console.error('ItemROGSystem: Error in generateFallbackItem:', err);
            return null;
        }
    }
}
// systems/HotBarSystem.js

import { System } from '../core/Systems.js';
import { HotBarActionIntentComponent } from "../core/Components.js"; 
export class HotBarSystem extends System {
    constructor(entityManager, eventBus, utilities) {
        super(entityManager, eventBus, utilities);
        this.requiredComponents = ['HotBarIntent', 'HotBarSkillMap'];
        this.lastKeyStates = {}; // To track last known key states
    }

    update(deltaTime) {
        // Get all entities with HotBarIntent
        const entities = this.entityManager.getEntitiesWith(this.requiredComponents);
        for (const entity of entities) {
            const intent = entity.getComponent('HotBarIntent');
            const skillMapComp = entity.getComponent('HotBarSkillMap');
            const skillMap = skillMapComp ? skillMapComp.skillMap : null;

            if (!intent || !skillMap) {
                return;
            }  

            for (const action of intent.hotBarActions) {
                const { slot, isKeyDown } = action;
                const skillId = skillMap[slot];

                // Check if the key state has changed
                if (this.lastKeyStates[slot] !== isKeyDown) {
                    this.lastKeyStates[slot] = isKeyDown; // Update the last key state
                    // Find the corresponding .hotbar-slot element
                    const slotElement = document.querySelector(`.hotbar-slot[data-hotbar-id="${slot}"]`);
                    if (slotElement) {
                        const img = slotElement.querySelector('.hotbar-icon');
                        if (img) {
                            img.src = isKeyDown
                                ? 'img/icons/empty-hotbar-slot-active.png' // Active image on key-down
                                : 'img/icons/empty-hotbar-slot.png'; // Default image on key-up
                        }
                    }
                }

                if (skillId && isKeyDown) {
                    // Add or update the SkillIntentComponent
                    let hotBarActionIntent = entity.getComponent('HotBarActionIntent');
                    if (!hotBarActionIntent) {
                        hotBarActionIntent = new HotBarActionIntentComponent();
                        entity.addComponent(hotBarActionIntent);
                    }
                    hotBarActionIntent.actionIntents.push({ skillId, slot });
                } else if (isKeyDown) {
                    console.log(`HotBarSystem: No skill mapped to slot ${slot}`);
                }
            }

            // Clear the intent after processing
            entity.removeComponent('HotBarIntent');
        }
    }
}

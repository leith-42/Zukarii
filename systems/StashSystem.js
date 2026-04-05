// systems/StashSystem.js
import { System } from '../core/Systems.js';
import { StashComponent } from '../core/Components.js';

export class StashSystem extends System {
    constructor(entityManager, eventBus, utilities) {
        super(entityManager, eventBus, utilities);
        this.requiredComponents = [];
    }

    init() {
        // Listen for stash unlock event
        this.eventBus.on('UnlockStash', ({ maxCapacity = 100, message = true }) => {
            this.unlockStash(maxCapacity, message);
        });

        // Listen for item deposit/withdraw events
        this.eventBus.on('DepositToStash', ({ uniqueId }) => {
            this.depositItem(uniqueId);
        });

        this.eventBus.on('WithdrawFromStash', ({ uniqueId }) => {
            this.withdrawItem(uniqueId);
        });

        // Listen for sort stash event
        this.eventBus.on('SortStash', () => {
            this.sortStash();
        });

        console.log('StashSystem: Initialized and listening for stash events');
    }

    update() {
        // No per-frame logic needed - event-driven
    }

    unlockStash(maxCapacity, showMessage) {
        const player = this.entityManager.getEntity('player');
        if (!player) {
            console.warn('StashSystem: Player entity not found');
            return;
        }

        if (player.hasComponent('Stash')) {
            console.warn('StashSystem: Stash already unlocked');
            return;
        }

        // Add stash component to player
        player.addComponent(new StashComponent({ 
            items: [], 
            maxCapacity 
        }));

        if (showMessage) {
            this.utilities.logMessage({ 
                channel: 'system', 
                message: `Stash unlocked! You now have ${maxCapacity} slots of secure storage.` 
            });
        }

        // Emit event for UI to update
        this.eventBus.emit('StashUnlocked', { maxCapacity });
        
        console.log(`StashSystem: Stash unlocked with capacity ${maxCapacity}`);
    }

    depositItem(uniqueId) {
        const player = this.entityManager.getEntity('player');
        if (!player) {
            console.warn('StashSystem: Player entity not found');
            return;
        }

        const stash = player.getComponent('Stash');
        if (!stash) {
            this.utilities.logMessage({ 
                channel: 'system', 
                message: 'Stash not unlocked yet!' 
            });
            return;
        }

        const inventory = player.getComponent('Inventory');
        if (!inventory) {
            console.warn('StashSystem: Inventory component not found');
            return;
        }

        // Find item in inventory
        const itemIndex = inventory.items.findIndex(item => item.uniqueId === uniqueId);
        if (itemIndex === -1) {
            console.warn(`StashSystem: Item ${uniqueId} not found in inventory`);
            return;
        }

        // Check stash capacity
        if (stash.items.length >= stash.maxCapacity) {
            this.utilities.logMessage({ 
                channel: 'system', 
                message: 'Stash is full!' 
            });
            return;
        }

        // Remove from inventory and add to stash
        const item = inventory.items.splice(itemIndex, 1)[0];
        stash.items.push(item);

        this.utilities.logMessage({ 
            channel: 'system', 
            message: `${item.name} deposited to stash.` 
        });

        // Emit events for UI updates
        this.eventBus.emit('StashUpdated');
        this.eventBus.emit('StatsUpdated', { entityId: 'player' });

        console.log(`StashSystem: Deposited ${item.name} to stash`);
    }

    withdrawItem(uniqueId) {
        const player = this.entityManager.getEntity('player');
        if (!player) {
            console.warn('StashSystem: Player entity not found');
            return;
        }

        const stash = player.getComponent('Stash');
        if (!stash) {
            console.warn('StashSystem: Stash component not found');
            return;
        }

        const inventory = player.getComponent('Inventory');
        if (!inventory) {
            console.warn('StashSystem: Inventory component not found');
            return;
        }

        // Find item in stash
        const itemIndex = stash.items.findIndex(item => item.uniqueId === uniqueId);
        if (itemIndex === -1) {
            console.warn(`StashSystem: Item ${uniqueId} not found in stash`);
            return;
        }

        // Check inventory capacity (you may want to add a max inventory size)
        // For now, allow unlimited inventory
        const item = stash.items.splice(itemIndex, 1)[0];
        inventory.items.push(item);

        this.utilities.logMessage({ 
            channel: 'system', 
            message: `${item.name} withdrawn from stash.` 
        });

        // Emit events for UI updates
        this.eventBus.emit('StashUpdated');
        this.eventBus.emit('StatsUpdated', { entityId: 'player' });

        console.log(`StashSystem: Withdrew ${item.name} from stash`);
    }

    sortStash() {
        const player = this.entityManager.getEntity('player');
        if (!player) {
            console.warn('StashSystem: Player entity not found');
            return;
        }

        const stash = player.getComponent('Stash');
        if (!stash) {
            console.warn('StashSystem: Stash component not found');
            return;
        }

        // Sort by type, then by tier, then by name
        stash.items.sort((a, b) => {
            // Primary sort: type
            if (a.type !== b.type) {
                return a.type.localeCompare(b.type);
            }
            // Secondary sort: tier (if available)
            const tierA = a.tierIndex || 0;
            const tierB = b.tierIndex || 0;
            if (tierA !== tierB) {
                return tierB - tierA; // Higher tier first
            }
            // Tertiary sort: name
            return a.name.localeCompare(b.name);
        });

        this.utilities.logMessage({ 
            channel: 'system', 
            message: 'Stash sorted.' 
        });

        this.eventBus.emit('StashUpdated');
        console.log('StashSystem: Stash sorted');
    }
}

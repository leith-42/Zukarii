import { System } from '../core/Systems.js';
import { SpatialBucketsComponent } from '../core/Components.js';

export class SpatialBucketsSystem extends System {
    constructor(entityManager, eventBus, state) {
        super(entityManager, eventBus);
        this.state = state;
        this.requiredComponents = ['Position', 'Visuals'];
        this.TILE_SIZE = this.state.TILE_SIZE || 32;
        this.BUCKET_SIZE = 16; // Matches existing bucket size (16 tiles)
        this.invTileBucket = 1 / (this.TILE_SIZE * this.BUCKET_SIZE);
    }

    init() {
        // Listen for tier changes to ensure we manage the correct level's buckets
        this.eventBus.on('LevelAdded', ({ tier }) => {
            this.entityManager.setActiveTier(tier);
            console.log(`SpatialBucketSystem: Active tier set to ${tier}`);
        });
    }

    update() {
        const activeTier = this.entityManager.getActiveTier();
        const levelEntity = this.entityManager.getEntitiesWith(['Tier']).find(e => e.getComponent('Tier').value === activeTier);
        
        if (!levelEntity) {
            console.warn(`SpatialBucketSystem: No level entity found for active tier ${activeTier}`);
            return;
        }

        const bucketsComp = levelEntity.getComponent('SpatialBuckets');
        if (!bucketsComp) {
            console.warn(`SpatialBucketSystem: SpatialBucketsComponent missing for level ${levelEntity.id}`);
            return;
        }
        
        // Black box optimization: clear arrays in place instead of clearing the map
        for (const arr of bucketsComp.buckets.values()) arr.length = 0;
        for (const arr of bucketsComp.monsterBuckets.values()) arr.length = 0;

        // Find all entities with Position and Visuals components
        const entities = this.entityManager.getEntitiesWith(['Position', 'Visuals']);
        const invTileBucket = this.invTileBucket;

        // Pre-allocate monster array for better performance (avoid filter)
        const monsterCount = entities.reduce((count, e) => count + (e.hasComponent('MonsterData') ? 1 : 0), 0);
        const monsters = new Array(monsterCount);
        let monsterIndex = 0;

        for (let i = 0; i < entities.length; i++) {
            const entity = entities[i];
            const pos = entity.getComponent('Position');
            const bucketX = Math.floor(pos.x * invTileBucket);
            const bucketY = Math.floor(pos.y * invTileBucket);
            const bucketKey = `${bucketX},${bucketY}`;
            let arr = bucketsComp.buckets.get(bucketKey);
            if (!arr) {
                arr = [];
                bucketsComp.buckets.set(bucketKey, arr);
            }
            arr.push(entity.id);

            // Collect monsters during the main loop to avoid second iteration
            if (entity.hasComponent('MonsterData')) {
                monsters[monsterIndex++] = entity;
            }
        }

        for (let i = 0; i < monsters.length; i++) {
            const monster = monsters[i];
            const pos = monster.getComponent('Position');
            const bucketX = Math.floor(pos.x * invTileBucket);
            const bucketY = Math.floor(pos.y * invTileBucket);
            const bucketKey = `${bucketX},${bucketY}`;

            // Monster-specific bucket for aggro checks and AOE damage
            let monsterArr = bucketsComp.monsterBuckets.get(bucketKey);
            if (!monsterArr) {
                monsterArr = [];
                bucketsComp.monsterBuckets.set(bucketKey, monsterArr);
            }
            monsterArr.push(monster.id);
            //console.log(`SpatialBucketsSystem: Added monster ${monster.id} to bucket ${bucketKey}`);
        }
       // console.log(`SpatialBucketsSystem: Updated spatial buckets for tier ${activeTier}. Total buckets: ${bucketsComp.buckets.size}, Monster Buckets: ${bucketsComp.monsterBuckets.size}`);
    }
}


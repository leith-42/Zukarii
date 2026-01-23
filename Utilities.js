//console.log("Utilities.js loaded");

export class Utilities {
    constructor() {
        this.entityManager = null; 
        this.eventBus = null;
        this.TILE_SIZE = 32;
    } 

    pushPlayerActions(actionType, actionData) {
        if (!this.entityManager) {
            console.error('Utilities: entityManager not initialized');
            return;
        }
        const playerActionQueue = this.entityManager.getEntity('player').getComponent('PlayerActionQueue');
        if (!playerActionQueue) {
            console.error(`Utilities: PlayerActionQueue component not found on player`);
            return;
        }
        const action = { type: actionType, data: actionData, timestamp: Date.now() };
        playerActionQueue.actions.push(action);
        console.warn(`Utilities: Pushed ${actionType} to PlayerActionQueue`, action);
    }

    camelToTitleCase(str) {
        return str
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .trim();
    }

    generateUniqueId() {
        const time = Date.now().toString(36);
        const rand1 = Math.random().toString(36).substring(2, 8);
        const rand2 = Math.random().toString(36).substring(2, 8);
        return `${time}-${rand1}-${rand2}`;
    }

    encodeHTMLEntities(text) {
        return text.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    escapeJsonString(str) {
        return str.replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t');
    }

    dRoll(dieSize, rollCount = 1, plus=0) {

        let total = plus; let roll = 0;
        for (let i = 0; i < rollCount; i++) {
            roll= Math.floor(Math.random() * dieSize) + 1;
            total += roll;
        }
        return total;
    }

    // Add a path to a JourneyPathComponent's paths array
    addPath(journeyPathComponent, path) {
        journeyPathComponent.paths.push({
            id: path.id || '',
            parentId: path.parentId || '',
            nextPathId: path.nextPathId || '',
            completed: path.completed || false,
            title: path.title || '',
            description: path.description || '',
            completionCondition: path.completionCondition || null,
            rewards: path.rewards || [],
            completionText: path.completionText || '',
            logCompletion: path.logCompletion !== undefined ? path.logCompletion : true
        });
    }

    // Remove a path from a JourneyPathComponent's paths array by ID
    removePath(journeyPathComponent, pathId) {
        journeyPathComponent.paths = journeyPathComponent.paths.filter(path => path.id !== pathId);
    }

    // Find a path in a JourneyPathComponent's paths array by ID
    findPath(journeyPathComponent, pathId) {
        return journeyPathComponent.paths.find(path => path.id === pathId) || null;
    }

    findPortalOnTier(tier) {
        // 1. Find the level entity for the given tier
        const levelEntity = this.entityManager.getEntitiesWith(['Tier'])
            .find(e => e.getComponent('Tier').value === tier);
        if (!levelEntity) {
            console.warn(`No level entity found for tier ${tier}`);
            return null;
        }

        // 2. Get the EntityListComponent and its portals array
        const entityList = levelEntity.getComponent('EntityList');
        if (!entityList || !Array.isArray(entityList.portals) || entityList.portals.length === 0) {
            console.warn(`No portals found in tier ${tier} EntityList`);
            return null;
        }


        // 3. Return the first portal entity (or all if you want to return an array)
        const portalId = entityList.portals[0];
        const portalEntity = this.entityManager.getEntity(portalId);
        if (!portalEntity) {
            console.warn(`Portal entity with ID ${portalId} not found`);
            return null;
        }
        return portalEntity;
    }

    findStairOnTier(tier, direction) {

        const levelEntity = this.entityManager.getEntitiesWith(['Tier'])
            .find(e => e.getComponent('Tier').value === tier);
        if (!levelEntity) {
            console.warn(`No level entity found for tier ${tier}`);
            return null;
        }

        const entityList = levelEntity.getComponent('EntityList');
        if (!entityList || !Array.isArray(entityList.stairs) || entityList.stairs.length === 0) {
            console.warn(`No stairs found in tier ${tier} EntityList`);
            return null;
        }

        for (const stairId of entityList.stairs) {
            const stairEntity = this.entityManager.getEntity(stairId);
            if (!stairEntity) continue;
            // Try to get the direction from a component, e.g., 'Stair' or 'StairData'
            const stairComp = stairEntity.getComponent('Stair') || stairEntity.getComponent('StairData');
            if (stairComp && stairComp.direction === direction) {
                return stairEntity; // or return stairId if you prefer
            }
        }

        console.warn(`No stairs with direction "${direction}" found in tier ${tier}`);
        return null;
    }

    getDistance(pos1, pos2) {
        if (!pos1 || !pos2 || typeof pos1.x !== 'number' || typeof pos1.y !== 'number' || typeof pos2.x !== 'number' || typeof pos2.y !== 'number') {
            console.warn('Utilities: Invalid positions provided to getDistance', pos1, pos2);
            return Infinity; // Return a large value to indicate invalid distance
        }
        const dx = pos2.x - pos1.x;
        const dy = pos2.y - pos1.y;
        return Math.sqrt(dx * dx + dy * dy);
    } 
    getDirectionVector(fromPos, toPos) {
        const dx = toPos.x - fromPos.x;
        const dy = toPos.y - fromPos.y;
        const magnitude = Math.sqrt(dx * dx + dy * dy);
        const direction = magnitude > 0 ? { dx: dx / magnitude, dy: dy / magnitude } : { dx: 0, dy: 0 };
        console.log(`getDirectionVector: from (${fromPos.x}, ${fromPos.y}) to (${toPos.x}, ${toPos.y}) => direction (${direction.dx}, ${direction.dy})`);
        return direction;
    }
    logMessage(logData) {
        if (!logData || typeof logData !== 'object' || !logData.message) {
            console.error("Invalid log data provided. Expected an object.");
            return;
        }
        // Default entityId to "player" if not provided
        const entityId = logData.entityId || 'player';
        const channel = logData.channel || 'system';
        const classNames = logData.classNames || [];
        const message = logData.message;
        const timestamp = Date.now(); // Generate timestamp at write time

        // Get the entity’s log component (implementation depends on your ECS)
        const logEntity = this.entityManager.getEntity(entityId);
        const logComponent = logEntity.getComponent('Log');

        // Add the log entry
        logComponent.messages.unshift({channel, classNames, message, timestamp });

        // Optional: Limit log size to prevent memory issues
        if (logComponent.messages.length > 200) {
            logComponent.messages.pop(); // Remove oldest entry
        }
        this.eventBus.emit('LogUpdated');
    }

    getLogMessages(options = {}) {
        const entityId = options.entityId || "player";
        const channel = options.channel || "all";
        const limit = options.limit || null;

        const entity = this.entityManager.getEntity(entityId);
        if (!entity) {
            console.error(`Entity with ID ${entityId} not found.`);
            return [];
        }

        const logComponent = entity.getComponent("Log");
        if (!logComponent) {
            console.error(`Entity ${entityId} does not have a Log component.`);
            return [];
        }

        let messages = logComponent.messages;

        if (channel !== "all") {

            const channels = typeof channel === "string" ? [channel] : channel;
            if (!Array.isArray(channels)) {
                console.error("Invalid channel parameter. Must be a string or an array of strings.");
                return [];
            }
            if (!channels.every(ch => typeof ch === "string")) {
                console.error("Channel array must contain only strings.");
                return [];
            }
            messages = messages.filter(msg => channels.includes(msg.channel));
        }

        if (limit !== null) {
            messages = messages.slice(0, limit);
        }

        return messages;
    }

    getTileFromPixel(x, y) {
        // Convert unscaled pixel coordinates to tile coordinates using Math.floor
        // e.g., x = 385.31156569650386 → tileX = 12 (maps to [384, 416))
        return {
            tileX: Math.floor(x / this.TILE_SIZE),
            tileY: Math.floor(y / this.TILE_SIZE)
        };
    }

    getPixelFromTile(tileX, tileY) {
        // Convert tile coordinates to unscaled pixel coordinates (top-left of tile)
        // e.g., tileX = 12 → x = 384
        return {
            x: tileX * this.TILE_SIZE,
            y: tileY * this.TILE_SIZE
        };
    }


    isWalkable(entityId, tileX, tileY) {
        if (!Number.isFinite(tileX) || !Number.isFinite(tileY)) return false;

        // Map check: Trust the map to determine if the tile has a floor
        const levelEntity = this.entityManager.getEntitiesWith(['Tier'])
            .find(e => e.getComponent('Tier').value === this.entityManager.getActiveTier());
        const mapComp = levelEntity?.getComponent('Map');
        const isFloor = mapComp && mapComp.map[tileY] && mapComp.map[tileY][tileX] === ' ';
        if (!isFloor) {
            console.log(`isWalkable: Tile (${tileX}, ${tileY}) is not a floor, returning false`, );
            return false;
        }
        // Check entities with Position and Hitbox components
        const pixel = this.getPixelFromTile(tileX, tileY);
        const blockingEntities = this.entityManager.getEntitiesWith(['Position', 'Hitbox']).filter(e => {
            // Skip overlap checks for walls since the isFloor check already handles them
            if (e.hasComponent('Wall')) return false;
            
            if (e.hasComponent('ShopCounter')) return false; // Skip shop counters
           

            const ePos = e.getComponent('Position');
            const eHitbox = e.getComponent('Hitbox');

            const entityLeft = ePos.x + eHitbox.offsetX;
            const entityRight = entityLeft + eHitbox.width;
            const entityTop = ePos.y + eHitbox.offsetY;
            const entityBottom = entityTop + eHitbox.height;

            const tileLeft = pixel.x;
            const tileRight = tileLeft + this.TILE_SIZE;
            const tileTop = pixel.y;
            const tileBottom = tileTop + this.TILE_SIZE;

            // Check if the entity's hitbox overlaps the tile
            return (
                entityRight > tileLeft && entityLeft < tileRight && // Horizontal overlap
                entityBottom > tileTop && entityTop < tileBottom    // Vertical overlap
            );
        });

        // If any entity blocks the tile, it's non-walkable
        return blockingEntities.length === 0;
    }
 

    /*
    isWalkable(entityId, tileX, tileY) {
        if (!Number.isFinite(tileX) || !Number.isFinite(tileY)) return false;
        const pixel = this.getPixelFromTile(tileX, tileY);
        const entitiesAtTarget = this.entityManager.getEntitiesWith(['Position']).filter(e => {
            const ePos = e.getComponent('Position');
            return ePos.x === pixel.x && ePos.y === pixel.y;
        });
        const isBlocked = entitiesAtTarget.some(e =>
            e.hasComponent('Wall') ||
            e.hasComponent('Stair') ||
            e.hasComponent('Portal') ||
            e.hasComponent('Fountain') ||
            e.hasComponent('LootData') ||
            (entityId !== e.id && e.hasComponent('MonsterData')) ||
            (entityId !== e.id && e.hasComponent('NPCData'))
        );
        // Map check
        const levelEntity = this.entityManager.getEntitiesWith(['Tier'])
            .find(e => e.getComponent('Tier').value === this.entityManager.getActiveTier());
        const mapComp = levelEntity?.getComponent('Map');
        const isFloor = mapComp && mapComp.map[tileY] && mapComp.map[tileY][tileX] === ' ';
        return !isBlocked && isFloor;
    }
    */

    findPathAStar(start, goal, entityId, tileSize = 1, maxIterations = 500, isWalkable = null) {
        console.log(`findPathAStar: Starting from (${start.x}, ${start.y}) to (${goal.x}, ${goal.y}), entityId=${entityId}`);

        const walkable = isWalkable || ((tileX, tileY) => this.isWalkable(entityId, tileX, tileY));

        function nodeKey(x, y) {
            return `${x},${y}`;
        }

        function heuristic(a, b) {
            return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); // Manhattan distance
        }

        const directions = [
            { x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 },
            { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: 1, y: 1 }
        ];

        const openSet = [{ x: start.x, y: start.y }];
        const cameFrom = new Map();
        const gScore = new Map();
        const fScore = new Map();

        gScore.set(nodeKey(start.x, start.y), 0);
        fScore.set(nodeKey(start.x, start.y), heuristic(start, goal));

        // Validate start and goal positions
        if (!walkable(start.x, start.y)) {
            const pixel = this.getPixelFromTile(start.x, start.y);
            const entitiesAtTarget = this.entityManager.getEntitiesWith(['Position']).filter(e => {
                const ePos = e.getComponent('Position');
                return ePos.x === pixel.x && ePos.y === pixel.y;
            });
            console.warn(`findPathAStar: Start tile (${start.x}, ${start.y}) pixel (${pixel.x}, ${pixel.y}) is not walkable, entityId=${entityId}, entities:`,
                entitiesAtTarget.map(e => ({
                    id: e.id,
                    components: Array.from(e.components.keys()),
                    pos: e.getComponent('Position')
                })));
            return [];
        }
        if (!walkable(goal.x, goal.y)) {
            const pixel = this.getPixelFromTile(goal.x, goal.y);
            const entitiesAtTarget = this.entityManager.getEntitiesWith(['Position']).filter(e => {
                const ePos = e.getComponent('Position');
                return ePos.x === pixel.x && ePos.y === pixel.y;
            });
            console.warn(`findPathAStar: Goal tile (${goal.x}, ${goal.y}) pixel (${pixel.x}, ${pixel.y}) is not walkable, entityId=${entityId}, entities:`,
                entitiesAtTarget.map(e => ({
                    id: e.id,
                    components: Array.from(e.components.keys()),
                    pos: e.getComponent('Position')
                })));
            return [];
        }

        let iterations = 0;

        while (openSet.length > 0 && iterations < maxIterations) {
            let currentIdx = 0;
            let current = openSet[0];
            for (let i = 1; i < openSet.length; i++) {
                const node = openSet[i];
                if ((fScore.get(nodeKey(node.x, node.y)) || Infinity) < (fScore.get(nodeKey(current.x, current.y)) || Infinity)) {
                    current = node;
                    currentIdx = i;
                }
            }

            if (current.x === goal.x && current.y === goal.y) {
                const path = [];
                let currKey = nodeKey(current.x, current.y);
                while (cameFrom.has(currKey)) {
                    path.unshift({ x: current.x, y: current.y });
                    current = cameFrom.get(currKey);
                    currKey = nodeKey(current.x, current.y);
                }
                path.unshift({ x: start.x, y: start.y });
                console.log(`findPathAStar: Path found with length ${path.length}:`, path);
                return path;
            }

            openSet.splice(currentIdx, 1);

            for (const dir of directions) {
                const neighbor = { x: current.x + dir.x, y: current.y + dir.y };
                const neighborKey = nodeKey(neighbor.x, neighbor.y);
                const neighborPixel = this.getPixelFromTile(neighbor.x, neighbor.y);
                const isWalkableResult = walkable(neighbor.x, neighbor.y);

                console.log(`findPathAStar: Neighbor tile (${neighbor.x}, ${neighbor.y}) pixel (${neighborPixel.x}, ${neighborPixel.y}) walkable=${isWalkableResult}`);
                if (!isWalkableResult) {
                    const entitiesAtTarget = this.entityManager.getEntitiesWith(['Position']).filter(e => {
                        const ePos = e.getComponent('Position');
                        return ePos.x === neighborPixel.x && ePos.y === neighborPixel.y;
                    });
                    console.log(`findPathAStar: Neighbor blocked, entities:`, entitiesAtTarget.map(e => ({
                        id: e.id,
                        components: Array.from(e.components.keys()),
                        pos: e.getComponent('Position')
                    })));
                    continue;
                }

                const cost = (Math.abs(dir.x) + Math.abs(dir.y) === 2 ? 1.414 : 1);
                const tentativeG = (gScore.get(nodeKey(current.x, current.y)) || 0) + cost;

                console.log(`findPathAStar: Neighbor (${neighbor.x}, ${neighbor.y}) tentativeG=${tentativeG}, gScore=${gScore.get(neighborKey) || 'undefined'}`);

                if (!gScore.has(neighborKey) || tentativeG < gScore.get(neighborKey)) {
                    cameFrom.set(neighborKey, current);
                    gScore.set(neighborKey, tentativeG);
                    fScore.set(neighborKey, tentativeG + heuristic(neighbor, goal));
                    if (!openSet.some(n => n.x === neighbor.x && n.y === neighbor.y)) {
                        openSet.push(neighbor);
                        console.log(`findPathAStar: Added neighbor (${neighbor.x}, ${neighbor.y}) to openSet`);
                    }
                }
            }
            iterations++;
        }

        console.warn(`findPathAStar: No path found after ${iterations} iterations, openSet size: ${openSet.length}`);
        return [];
    }
}
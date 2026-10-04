// ============================================================
// PROP PLACEMENT SYSTEM
// ============================================================
// Deterministic prop-exclusion registry using a lightweight
// spatial hash. It is a placement layer; it does not replace
// PropDistributionSystem or any existing cluster logic.
// ============================================================

export class PropPlacementSystem {

    constructor({ cellSize = 8 } = {}) {

        this.cellSize = cellSize;

        this.blockedBy = {
            tree: [],
            rock: ["tree"],
            bush: ["tree", "rock"],
            grass: ["tree", "rock", "bush"],
            flower: ["tree", "rock", "bush"]
        };

        this.defaultRadius = {
            tree: 3.0,
            rock: 1.5,
            bush: 1.0,
            grass: 0.15,
            flower: 0.15
        };

        // Bushes can still form clusters, but two bush centers
        // cannot occupy exactly the same small area.
        this.sameTypeMinDistance = {
            tree: 0.0,
            rock: 0.0,
            bush: 0.65,
            grass: 0.0,
            flower: 0.0
        };

        // type -> chunkKey -> entries
        this.chunkEntries = new Map();

        // type -> spatialCellKey -> entries
        this.spatial = new Map();

        // type -> Set<callback>
        this.listeners = new Map();

        for (const type of ["tree", "rock", "bush", "grass", "flower"]) {
            this.chunkEntries.set(type, new Map());
            this.spatial.set(type, new Map());
            this.listeners.set(type, new Set());
        }
    }

    chunkKey(chunkX, chunkZ) {
        return `${chunkX},${chunkZ}`;
    }

    spatialKey(cellX, cellZ) {
        return `${cellX},${cellZ}`;
    }

    getCell(x, z) {
        return {
            x: Math.floor(x / this.cellSize),
            z: Math.floor(z / this.cellSize)
        };
    }

    onChanged(type, callback) {
        if (!this.listeners.has(type)) {
            throw new Error(`PropPlacementSystem: Unknown type '${type}'.`);
        }

        if (typeof callback === "function") {
            this.listeners.get(type).add(callback);
        }
    }

    beginChunk(type, chunkX, chunkZ) {
        const key = this.chunkKey(chunkX, chunkZ);
        const chunks = this.chunkEntries.get(type);
        const spatial = this.spatial.get(type);

        if (!chunks || !spatial) {
            return;
        }

        const oldEntries = chunks.get(key);

        if (!oldEntries) {
            return;
        }

        for (const entry of oldEntries) {
            const cell = spatial.get(entry.spatialKey);

            if (!cell) {
                continue;
            }

            const index = cell.indexOf(entry);

            if (index !== -1) {
                cell.splice(index, 1);
            }

            if (cell.length === 0) {
                spatial.delete(entry.spatialKey);
            }
        }

        chunks.delete(key);
    }

    unregisterChunk(type, chunkX, chunkZ) {
        this.beginChunk(type, chunkX, chunkZ);
    }

    register(type, x, z, radius, chunkX, chunkZ) {
        const chunks = this.chunkEntries.get(type);
        const spatial = this.spatial.get(type);

        if (!chunks || !spatial) {
            return;
        }

        const cell = this.getCell(x, z);
        const spatialKey = this.spatialKey(cell.x, cell.z);
        const chunkKey = this.chunkKey(chunkX, chunkZ);

        const entry = {
            x,
            z,
            radius,
            spatialKey
        };

        let chunkList = chunks.get(chunkKey);

        if (!chunkList) {
            chunkList = [];
            chunks.set(chunkKey, chunkList);
        }

        let spatialList = spatial.get(spatialKey);

        if (!spatialList) {
            spatialList = [];
            spatial.set(spatialKey, spatialList);
        }

        chunkList.push(entry);
        spatialList.push(entry);
    }

    getNearby(type, x, z, searchRadius) {
        const spatial = this.spatial.get(type);

        if (!spatial) {
            return [];
        }

        const min = this.getCell(x - searchRadius, z - searchRadius);
        const max = this.getCell(x + searchRadius, z + searchRadius);
        const result = [];

        for (let cellX = min.x; cellX <= max.x; cellX++) {
            for (let cellZ = min.z; cellZ <= max.z; cellZ++) {

                const entries = spatial.get(
                    this.spatialKey(cellX, cellZ)
                );

                if (!entries) {
                    continue;
                }

                for (const entry of entries) {
                    result.push(entry);
                }
            }
        }

        return result;
    }

    canPlace(type, x, z, radius = null) {
        if (!this.spatial.has(type)) {
            return true;
        }

        const candidateRadius =
            radius ?? this.defaultRadius[type] ?? 0;

        // Higher-priority exclusion.
        for (const blockerType of this.blockedBy[type] || []) {

            const blockerRadius =
                this.defaultRadius[blockerType] || 0;

            const entries = this.getNearby(
                blockerType,
                x,
                z,
                candidateRadius + blockerRadius
            );

            for (const entry of entries) {

                const dx = x - entry.x;
                const dz = z - entry.z;
                const minDistance = candidateRadius + entry.radius;

                if (
                    dx * dx + dz * dz <
                    minDistance * minDistance
                ) {
                    return false;
                }
            }
        }

        // Bushes retain cluster behavior; this is only a small
        // same-type anti-pileup distance.
        const sameTypeDistance =
            this.sameTypeMinDistance[type] || 0;

        if (sameTypeDistance > 0) {

            const entries = this.getNearby(
                type,
                x,
                z,
                sameTypeDistance
            );

            for (const entry of entries) {

                const dx = x - entry.x;
                const dz = z - entry.z;

                if (
                    dx * dx + dz * dz <
                    sameTypeDistance * sameTypeDistance
                ) {
                    return false;
                }
            }
        }

        return true;
    }

    isBlocked(type, x, z, radius = null) {
        return this.canPlace(type, x, z, radius) ? 0 : 1;
    }

    notifyChanged(type, chunkX = null, chunkZ = null) {
        const callbacks = this.listeners.get(type);

        if (!callbacks) {
            return;
        }

        for (const callback of callbacks) {
            callback(type, chunkX, chunkZ);
        }
    }
}

export default PropPlacementSystem;

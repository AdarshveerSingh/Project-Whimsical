// ============================================================
// PLACEMENT REGISTRY
// ============================================================
//
// Stores accepted prop footprints (circles in world X/Z) in a
// spatial hash.
//
// Performance notes:
//  - Cell keys are numbers, not strings (no allocation per query).
//  - isBlocked() allocates nothing and exits on the first hit.
//  - Types are stored as bit flags, so filtering is one AND.
//  - Searches use the largest registered radius, so they are
//    both tighter and correct for big props such as rocks.
//  - collectObstacles() gives a chunk a small packed list once,
//    so per-blade tests don't need the hash at all.
// ============================================================

export class PlacementRegistry {

    constructor({
        cellSize = 8
    } = {}) {

        this.cellSize = cellSize;
        this.invCellSize = 1 / cellSize;

        // numeric cell key -> array of records
        this.cells = new Map();

        // "chunkX,chunkZ" -> Set of records (only used on load/unload)
        this.chunks = new Map();

        // Largest radius ever registered. Records are stored by
        // their center, so searches must reach this far.
        this.maxRadius = 0;

        // type string -> bit flag
        this.typeBits = new Map();
    }


    // ========================================================
    // KEYS AND TYPE MASKS
    // ========================================================

    // Valid for |cell index| < 32768 (about +-262,000 units at cellSize 8)
    cellKey(cellX, cellZ) {

        return (cellX + 32768) * 65536 + (cellZ + 32768);
    }


    getCellKey(x, z) {

        return this.cellKey(
            Math.floor(x * this.invCellSize),
            Math.floor(z * this.invCellSize)
        );
    }


    typeBit(type) {

        let bit = this.typeBits.get(type);

        if (bit === undefined) {

            bit = 1 << this.typeBits.size;
            this.typeBits.set(type, bit);
        }

        return bit;
    }


    // Accepts an array of type names (or an already built mask).
    // 0 means "all types".
    getTypeMask(types) {

        if (typeof types === "number") {
            return types;
        }

        if (!types || types.length === 0) {
            return 0;
        }

        let mask = 0;

        for (let i = 0; i < types.length; i++) {
            mask |= this.typeBit(types[i]);
        }

        return mask;
    }


    // ========================================================
    // REGISTER
    // ========================================================

    register({
        type,
        x,
        z,
        radius = 0,
        chunkX,
        chunkZ
    }) {

        const record = {
            type,
            bit: this.typeBit(type),
            x,
            z,
            radius,
            chunkX,
            chunkZ
        };

        const key = this.getCellKey(x, z);

        let cell = this.cells.get(key);

        if (!cell) {
            cell = [];
            this.cells.set(key, cell);
        }

        cell.push(record);

        const chunkKey = `${chunkX},${chunkZ}`;

        let chunkRecords = this.chunks.get(chunkKey);

        if (!chunkRecords) {
            chunkRecords = new Set();
            this.chunks.set(chunkKey, chunkRecords);
        }

        chunkRecords.add(record);

        if (radius > this.maxRadius) {
            this.maxRadius = radius;
        }

        return record;
    }


    // ========================================================
    // REMOVE
    // ========================================================

    removeFromCell(record) {

        const key = this.getCellKey(record.x, record.z);

        const cell = this.cells.get(key);

        if (!cell) {
            return;
        }

        const index = cell.indexOf(record);

        if (index !== -1) {

            // swap-remove
            cell[index] = cell[cell.length - 1];
            cell.pop();
        }

        if (cell.length === 0) {
            this.cells.delete(key);
        }
    }


    remove(record) {

        if (!record) {
            return;
        }

        this.removeFromCell(record);

        const chunkKey = `${record.chunkX},${record.chunkZ}`;

        const chunkRecords = this.chunks.get(chunkKey);

        if (chunkRecords) {

            chunkRecords.delete(record);

            if (chunkRecords.size === 0) {
                this.chunks.delete(chunkKey);
            }
        }
    }


    removeChunk(chunkX, chunkZ) {

        const chunkKey = `${chunkX},${chunkZ}`;

        const records = this.chunks.get(chunkKey);

        if (!records) {
            return;
        }

        for (const record of records) {
            this.removeFromCell(record);
        }

        this.chunks.delete(chunkKey);
    }


    removeChunkType(chunkX, chunkZ, type) {

        const records = this.chunks.get(`${chunkX},${chunkZ}`);

        if (!records) {
            return;
        }

        for (const record of [...records]) {

            if (record.type === type) {
                this.remove(record);
            }
        }
    }


    // ========================================================
    // QUERY NEARBY
    // ========================================================
    //
    // Records whose spatial cells intersect the square
    // [x - radius, x + radius] x [z - radius, z + radius].
    // Allocates an array: use isBlocked() for hot paths.
    //

    queryNearby(x, z, radius) {

        const results = [];
        const inv = this.invCellSize;

        const minCellX = Math.floor((x - radius) * inv);
        const maxCellX = Math.floor((x + radius) * inv);
        const minCellZ = Math.floor((z - radius) * inv);
        const maxCellZ = Math.floor((z + radius) * inv);

        for (let cx = minCellX; cx <= maxCellX; cx++) {
            for (let cz = minCellZ; cz <= maxCellZ; cz++) {

                const cell = this.cells.get(this.cellKey(cx, cz));

                if (!cell) {
                    continue;
                }

                for (let i = 0; i < cell.length; i++) {
                    results.push(cell[i]);
                }
            }
        }

        return results;
    }


    // ========================================================
    // RECORDS INSIDE WORLD BOUNDS
    // ========================================================

    getRecordsInBounds(minX, maxX, minZ, maxZ, blockedTypes = []) {

        const results = [];
        const mask = this.getTypeMask(blockedTypes);
        const inv = this.invCellSize;

        const minCellX = Math.floor(minX * inv);
        const maxCellX = Math.floor(maxX * inv);
        const minCellZ = Math.floor(minZ * inv);
        const maxCellZ = Math.floor(maxZ * inv);

        for (let cx = minCellX; cx <= maxCellX; cx++) {
            for (let cz = minCellZ; cz <= maxCellZ; cz++) {

                const cell = this.cells.get(this.cellKey(cx, cz));

                if (!cell) {
                    continue;
                }

                for (let i = 0; i < cell.length; i++) {

                    const record = cell[i];

                    if (mask !== 0 && (record.bit & mask) === 0) {
                        continue;
                    }

                    results.push(record);
                }
            }
        }

        return results;
    }


    // ========================================================
    // COLLECT OBSTACLES FOR A REGION
    // ========================================================
    //
    // Returns a packed Float32Array [x, z, radius, x, z, radius, ...]
    // of every matching record whose circle (grown by `padding`)
    // overlaps the rectangle. Call once per chunk, then test blades
    // against this short list with isBlockedByObstacles().
    //

    collectObstacles(minX, maxX, minZ, maxZ, types = [], padding = 0) {

        const mask = this.getTypeMask(types);
        const reach = this.maxRadius + padding;
        const inv = this.invCellSize;

        const minCellX = Math.floor((minX - reach) * inv);
        const maxCellX = Math.floor((maxX + reach) * inv);
        const minCellZ = Math.floor((minZ - reach) * inv);
        const maxCellZ = Math.floor((maxZ + reach) * inv);

        const packed = [];

        for (let cx = minCellX; cx <= maxCellX; cx++) {
            for (let cz = minCellZ; cz <= maxCellZ; cz++) {

                const cell = this.cells.get(this.cellKey(cx, cz));

                if (!cell) {
                    continue;
                }

                for (let i = 0; i < cell.length; i++) {

                    const record = cell[i];

                    if (mask !== 0 && (record.bit & mask) === 0) {
                        continue;
                    }

                    // distance from the record center to the rectangle
                    const dx = Math.max(minX - record.x, 0, record.x - maxX);
                    const dz = Math.max(minZ - record.z, 0, record.z - maxZ);

                    const r = record.radius + padding;

                    if (dx * dx + dz * dz <= r * r) {
                        packed.push(record.x, record.z, record.radius);
                    }
                }
            }
        }

        return new Float32Array(packed);
    }


    // Test a point against a list from collectObstacles()
    static isBlockedByObstacles(obstacles, x, z, radius = 0) {

        for (let i = 0; i < obstacles.length; i += 3) {

            const dx = x - obstacles[i];
            const dz = z - obstacles[i + 1];
            const r = radius + obstacles[i + 2];

            if (dx * dx + dz * dz < r * r) {
                return true;
            }
        }

        return false;
    }


    // ========================================================
    // IS BLOCKED
    // ========================================================
    //
    // No allocation, early exit. blockedTypes can be an array of
    // type names or a mask from getTypeMask().
    //

    isBlocked(x, z, radius, blockedTypes = []) {

        const mask = this.getTypeMask(blockedTypes);
        const reach = radius + this.maxRadius;
        const inv = this.invCellSize;

        const minCellX = Math.floor((x - reach) * inv);
        const maxCellX = Math.floor((x + reach) * inv);
        const minCellZ = Math.floor((z - reach) * inv);
        const maxCellZ = Math.floor((z + reach) * inv);

        for (let cx = minCellX; cx <= maxCellX; cx++) {
            for (let cz = minCellZ; cz <= maxCellZ; cz++) {

                const cell = this.cells.get(this.cellKey(cx, cz));

                if (!cell) {
                    continue;
                }

                for (let i = 0; i < cell.length; i++) {

                    const record = cell[i];

                    if (mask !== 0 && (record.bit & mask) === 0) {
                        continue;
                    }

                    const dx = x - record.x;
                    const dz = z - record.z;
                    const r = radius + record.radius;

                    if (dx * dx + dz * dz < r * r) {
                        return true;
                    }
                }
            }
        }

        return false;
    }


    // ========================================================
    // WORLD-SPACE EXCLUSION FIELD
    // ========================================================
    //
    // Values > 0 are inside an exclusion footprint. Built from
    // registered placements only (no per-blade queries).
    //

    buildExclusionField({

        minX,
        minZ,
        size,
        resolution,
        blockedTypes = [],
        radiusPadding = 0

    } = {}) {

        if (
            !Number.isFinite(minX) ||
            !Number.isFinite(minZ) ||
            !Number.isFinite(size) ||
            size <= 0 ||
            !Number.isInteger(resolution) ||
            resolution <= 0
        ) {
            return null;
        }

        const gridSize = resolution + 1;
        const field = new Float32Array(gridSize * gridSize);
        const step = size / resolution;

        // Records are stored by center, so reach the largest radius
        const searchMargin = this.maxRadius + radiusPadding;

        const records = this.getRecordsInBounds(
            minX - searchMargin,
            minX + size + searchMargin,
            minZ - searchMargin,
            minZ + size + searchMargin,
            blockedTypes
        );

        if (records.length === 0) {
            return null;
        }

        for (const record of records) {

            const radius = Math.max(0, record.radius + radiusPadding);

            if (radius <= 0) {
                continue;
            }

            const radiusSquared = radius * radius;

            const localX = record.x - minX;
            const localZ = record.z - minZ;

            const minGX = Math.max(0, Math.floor((localX - radius) / step));
            const maxGX = Math.min(resolution, Math.ceil((localX + radius) / step));
            const minGZ = Math.max(0, Math.floor((localZ - radius) / step));
            const maxGZ = Math.min(resolution, Math.ceil((localZ + radius) / step));

            for (let gz = minGZ; gz <= maxGZ; gz++) {

                const dz = minZ + gz * step - record.z;

                for (let gx = minGX; gx <= maxGX; gx++) {

                    const dx = minX + gx * step - record.x;
                    const distanceSquared = dx * dx + dz * dz;

                    if (distanceSquared > radiusSquared) {
                        continue;
                    }

                    const influence = radiusSquared - distanceSquared;
                    const index = gz * gridSize + gx;

                    if (influence > field[index]) {
                        field[index] = influence;
                    }
                }
            }
        }

        return {
            data: field,
            minX,
            minZ,
            size,
            resolution,
            step
        };
    }
}
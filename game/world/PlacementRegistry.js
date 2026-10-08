    // ============================================================
    // PLACEMENT REGISTRY
    // ============================================================
    //
    // Phase 1:
    // - Stores already accepted prop footprints.
    // - Uses a spatial hash so future exclusion checks are cheap.
    // - Does NOT reject any props yet.
    //
    // World-space X/Z coordinates are used so the registry remains
    // consistent across chunk boundaries.
    // ============================================================

    export class PlacementRegistry {

        constructor({
            cellSize = 8
        } = {}) {

            this.cellSize =
                cellSize;

            // ----------------------------------------------------
            // Spatial hash
            //
            // key -> Set of placement records
            // ----------------------------------------------------

            this.cells =
                new Map();

            // ----------------------------------------------------
            // Chunk -> placement records
            //
            // Allows efficient cleanup when a chunk unloads.
            // ----------------------------------------------------

            this.chunks =
                new Map();

        }


        // ========================================================
        // CELL KEY
        // ========================================================

        getCellKey(
            x,
            z
        ) {

            const cellX =
                Math.floor(
                    x /
                    this.cellSize
                );

            const cellZ =
                Math.floor(
                    z /
                    this.cellSize
                );

            return `${cellX},${cellZ}`;

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

                x,
                z,

                radius,

                chunkX,
                chunkZ

            };


            // ----------------------------------------------------
            // Add to spatial cell
            // ----------------------------------------------------

            const key =
                this.getCellKey(
                    x,
                    z
                );


            let cell =
                this.cells.get(
                    key
                );


            if (!cell) {

                cell =
                    new Set();

                this.cells.set(
                    key,
                    cell
                );

            }


            cell.add(
                record
            );


            // ----------------------------------------------------
            // Add to chunk registry
            // ----------------------------------------------------

            const chunkKey =
                `${chunkX},${chunkZ}`;


            let chunkRecords =
                this.chunks.get(
                    chunkKey
                );


            if (!chunkRecords) {

                chunkRecords =
                    new Set();

                this.chunks.set(
                    chunkKey,
                    chunkRecords
                );

            }


            chunkRecords.add(
                record
            );


            return record;

        }


        // ========================================================
        // REMOVE ONE RECORD
        // ========================================================

        remove(
            record
        ) {

            if (!record) {

                return;

            }


            const cellKey =
                this.getCellKey(
                    record.x,
                    record.z
                );


            const cell =
                this.cells.get(
                    cellKey
                );


            if (cell) {

                cell.delete(
                    record
                );


                if (
                    cell.size === 0
                ) {

                    this.cells.delete(
                        cellKey
                    );

                }

            }


            const chunkKey =
                `${record.chunkX},${record.chunkZ}`;


            const chunkRecords =
                this.chunks.get(
                    chunkKey
                );


            if (chunkRecords) {

                chunkRecords.delete(
                    record
                );


                if (
                    chunkRecords.size === 0
                ) {

                    this.chunks.delete(
                        chunkKey
                    );

                }

            }

        }


        // ========================================================
        // REMOVE EVERYTHING FROM CHUNK
        // ========================================================

        removeChunk(
            chunkX,
            chunkZ
        ) {

            const chunkKey =
                `${chunkX},${chunkZ}`;


            const records =
                this.chunks.get(
                    chunkKey
                );


            if (!records) {

                return;

            }


            for (
                const record
                of records
            ) {

                const cellKey =
                    this.getCellKey(
                        record.x,
                        record.z
                    );


                const cell =
                    this.cells.get(
                        cellKey
                    );


                if (cell) {

                    cell.delete(
                        record
                    );


                    if (
                        cell.size === 0
                    ) {

                        this.cells.delete(
                            cellKey
                        );

                    }

                }

            }


            this.chunks.delete(
                chunkKey
            );

        }

        
    
        // ========================================================
        // REMOVE PLACEMENTS OF ONE TYPE FROM A CHUNK
        // ========================================================

        removeChunkType(
            chunkX,
            chunkZ,
            type
        ) {
            const chunkKey =
                `${chunkX},${chunkZ}`;

            const records =
                this.chunks.get(chunkKey);

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
        // Returns records whose spatial cells could intersect
        // the requested radius.
        //
        // Actual footprint/exclusion testing will be added later.
        // ========================================================

        queryNearby(
            x,
            z,
            radius
        ) {

            const results =
                [];


            const minCellX =
                Math.floor(
                    (x - radius) /
                    this.cellSize
                );

            const maxCellX =
                Math.floor(
                    (x + radius) /
                    this.cellSize
                );

            const minCellZ =
                Math.floor(
                    (z - radius) /
                    this.cellSize
                );

            const maxCellZ =
                Math.floor(
                    (z + radius) /
                    this.cellSize
                );


            for (
                let cellX = minCellX;
                cellX <= maxCellX;
                cellX++
            ) {

                for (
                    let cellZ = minCellZ;
                    cellZ <= maxCellZ;
                    cellZ++
                ) {

                    const key =
                        `${cellX},${cellZ}`;


                    const cell =
                        this.cells.get(
                            key
                        );


                    if (!cell) {

                        continue;

                    }


                    for (
                        const record
                        of cell
                    ) {

                        results.push(
                            record
                        );

                    }

                }

            }


            return results;

        }
        // ========================================================
// QUERY PLACEMENTS INSIDE WORLD BOUNDS
// ========================================================
//
// Unlike queryNearby(), this is intended for building a
// per-chunk spatial influence field.
//
// The caller supplies bounds already expanded enough to
// account for the relevant prop footprint.
//
getRecordsInBounds(
    minX,
    maxX,
    minZ,
    maxZ,
    blockedTypes = []
) {

    const results = [];

    const typeFilter =
        blockedTypes.length > 0
            ? new Set(blockedTypes)
            : null;

    const minCellX =
        Math.floor(
            minX / this.cellSize
        );

    const maxCellX =
        Math.floor(
            maxX / this.cellSize
        );

    const minCellZ =
        Math.floor(
            minZ / this.cellSize
        );

    const maxCellZ =
        Math.floor(
            maxZ / this.cellSize
        );

    for (
        let cellX = minCellX;
        cellX <= maxCellX;
        cellX++
    ) {

        for (
            let cellZ = minCellZ;
            cellZ <= maxCellZ;
            cellZ++
        ) {

            const key =
                `${cellX},${cellZ}`;

            const cell =
                this.cells.get(key);

            if (!cell) {
                continue;
            }

            for (const record of cell) {

                if (
                    typeFilter &&
                    !typeFilter.has(record.type)
                ) {
                    continue;
                }

                results.push(record);

            }

        }

    }

    return results;

}


// ========================================================
// BUILD WORLD-SPACE EXCLUSION FIELD
// ========================================================
//
// Creates a signed-ish influence field over a rectangular
// world-space region.
//
// Values:
//
//   > 0  = inside an exclusion footprint
//   <= 0 = outside
//
// The field is built from already accepted registry
// placements. It does NOT perform any per-grass-blade
// registry queries.
//
// ========================================================

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

    const gridSize =
        resolution + 1;

    const field =
        new Float32Array(
            gridSize * gridSize
        );

    const step =
        size / resolution;

    // The existing registry uses its spatial cells as the
    // coarse lookup structure. Expand the field bounds by
    // the same cell-scale margin so props near chunk edges
    // are included.
    const searchMargin =
        this.cellSize +
        radiusPadding;

    const records =
        this.getRecordsInBounds(

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

        const radius =
            Math.max(
                0,
                record.radius +
                radiusPadding
            );

        if (radius <= 0) {
            continue;
        }

        const radiusSquared =
            radius * radius;

        const localX =
            record.x - minX;

        const localZ =
            record.z - minZ;

        let minGX =
            Math.floor(
                (localX - radius) /
                step
            );

        let maxGX =
            Math.ceil(
                (localX + radius) /
                step
            );

        let minGZ =
            Math.floor(
                (localZ - radius) /
                step
            );

        let maxGZ =
            Math.ceil(
                (localZ + radius) /
                step
            );

        minGX =
            Math.max(
                0,
                minGX
            );

        maxGX =
            Math.min(
                resolution,
                maxGX
            );

        minGZ =
            Math.max(
                0,
                minGZ
            );

        maxGZ =
            Math.min(
                resolution,
                maxGZ
            );

        for (
            let gz = minGZ;
            gz <= maxGZ;
            gz++
        ) {

            const worldZ =
                minZ +
                gz * step;

            const dz =
                worldZ -
                record.z;

            for (
                let gx = minGX;
                gx <= maxGX;
                gx++
            ) {

                const worldX =
                    minX +
                    gx * step;

                const dx =
                    worldX -
                    record.x;

                const distanceSquared =
                    dx * dx +
                    dz * dz;

                if (
                    distanceSquared >
                    radiusSquared
                ) {
                    continue;
                }

                // Positive inside the footprint.
                // Using radius² - distance² avoids sqrt.
                const influence =
                    radiusSquared -
                    distanceSquared;

                const index =
                    gz * gridSize +
                    gx;

                if (
                    influence >
                    field[index]
                ) {

                    field[index] =
                        influence;

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
    isBlocked(
        x,
        z,
        radius,
        blockedTypes = []
    ) {

        const searchRadius =
            radius +
            this.cellSize;

        const nearby =
            this.queryNearby(
                x,
                z,
                searchRadius
            );
            for (
                const record
                of nearby
            ) {

                if (
                    blockedTypes.length > 0 &&
                    !blockedTypes.includes(
                        record.type
                    )
                ) {
                    continue;
                }

                const dx =
                    x -
                    record.x;

                const dz =
                    z -
                    record.z;

                const combinedRadius =
                    radius +
                    record.radius;

                const distanceSquared =
                    dx * dx +
                    dz * dz;

                if (
                    distanceSquared <
                    combinedRadius *
                    combinedRadius
                ) {

                    return true;

                }

            }

            return false;

        }


    }
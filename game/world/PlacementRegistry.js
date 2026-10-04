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
// ============================================================
// GrassWorker.js
// ============================================================


// ============================================================
// TERRAIN HEIGHT SAMPLING
// ============================================================

function sampleTerrainHeight(
    localX,
    localZ,
    terrainGrid,
    gridResolution,
    terrainSize
) {

    const halfSize =
        terrainSize * 0.5;

    const normalizedX =
        (localX + halfSize) /
        terrainSize;

    const normalizedZ =
        (localZ + halfSize) /
        terrainSize;

    const gx =
        Math.max(
            0,
            Math.min(1, normalizedX)
        );

    const gz =
        Math.max(
            0,
            Math.min(1, normalizedZ)
        );

    const gridX =
        gx * (gridResolution - 1);

    const gridZ =
        gz * (gridResolution - 1);

    const x0 =
        Math.floor(gridX);

    const z0 =
        Math.floor(gridZ);

    const x1 =
        Math.min(
            x0 + 1,
            gridResolution - 1
        );

    const z1 =
        Math.min(
            z0 + 1,
            gridResolution - 1
        );

    const tx =
        gridX - x0;

    const tz =
        gridZ - z0;

    const row0 =
        z0 * gridResolution;

    const row1 =
        z1 * gridResolution;

    const h00 =
        terrainGrid[row0 + x0];

    const h10 =
        terrainGrid[row0 + x1];

    const h01 =
        terrainGrid[row1 + x0];

    const h11 =
        terrainGrid[row1 + x1];

    const hx0 =
        h00 + (h10 - h00) * tx;

    const hx1 =
        h01 + (h11 - h01) * tx;

    return (
        hx0 + (hx1 - hx0) * tz
    );
}


// ============================================================
// TERRAIN SLOPE
// ============================================================
//
// Returns the approximate height gradient.
//
// 0.0  = completely flat
// 0.2  = gentle
// 0.4  = noticeable
// 0.6+ = steep
//
// ============================================================

function sampleSlope(
    localX,
    localZ,
    terrainGrid,
    gridResolution,
    terrainSize
) {

    const sampleDistance =
        terrainSize /
        (gridResolution - 1);

    const left =
        sampleTerrainHeight(
            localX - sampleDistance,
            localZ,
            terrainGrid,
            gridResolution,
            terrainSize
        );

    const right =
        sampleTerrainHeight(
            localX + sampleDistance,
            localZ,
            terrainGrid,
            gridResolution,
            terrainSize
        );

    const back =
        sampleTerrainHeight(
            localX,
            localZ - sampleDistance,
            terrainGrid,
            gridResolution,
            terrainSize
        );

    const front =
        sampleTerrainHeight(
            localX,
            localZ + sampleDistance,
            terrainGrid,
            gridResolution,
            terrainSize
        );

    const dx =
        (right - left) /
        (sampleDistance * 2);

    const dz =
        (front - back) /
        (sampleDistance * 2);

    return Math.sqrt(
        dx * dx +
        dz * dz
    );
}


// ============================================================
// HASH
// ============================================================

function hash2D(
    x,
    z,
    seed
) {

    let h =
        seed >>> 0;

    h ^=
        Math.imul(
            x,
            374761393
        );

    h ^=
        Math.imul(
            z,
            668265263
        );

    h =
        Math.imul(
            h ^ (h >>> 13),
            1274126177
        );

    h ^=
        h >>> 16;

    return h >>> 0;
}


// ============================================================
// SEEDED RANDOM
// ============================================================

function createRandom(
    seed
) {

    let state =
        seed >>> 0;

    return function () {

        state +=
            0x6D2B79F5;

        let t =
            state;

        t =
            Math.imul(
                t ^ (t >>> 15),
                t | 1
            );

        t ^=
            t +
            Math.imul(
                t ^ (t >>> 7),
                t | 61
            );

        return (
            (t ^ (t >>> 14)) >>> 0
        ) / 4294967296;
    };
}


// ============================================================
// VALUE NOISE
// ============================================================
//
// Smooth 2D noise used to create natural grass patches.
//
// This is deliberately low-frequency so patches are broad
// rather than individual noisy pixels.
// ============================================================

function valueNoise(
    x,
    z,
    seed
) {

    const x0 =
        Math.floor(x);

    const z0 =
        Math.floor(z);

    const x1 =
        x0 + 1;

    const z1 =
        z0 + 1;

    const tx =
        x - x0;

    const tz =
        z - z0;


    // Smooth interpolation

    const sx =
        tx * tx *
        (3 - 2 * tx);

    const sz =
        tz * tz *
        (3 - 2 * tz);


    const n00 =
        hash2D(
            x0,
            z0,
            seed
        ) /
        4294967295;

    const n10 =
        hash2D(
            x1,
            z0,
            seed
        ) /
        4294967295;

    const n01 =
        hash2D(
            x0,
            z1,
            seed
        ) /
        4294967295;

    const n11 =
        hash2D(
            x1,
            z1,
            seed
        ) /
        4294967295;


    const nx0 =
        n00 +
        (n10 - n00) *
        sx;

    const nx1 =
        n01 +
        (n11 - n01) *
        sx;


    return (
        nx0 +
        (nx1 - nx0) *
        sz
    );
}


// ============================================================
// GRASS PATCH MASK
// ============================================================
//
// Combines several scales.
//
// Large noise:
//     controls large grass fields
//
// Medium noise:
//     breaks up the fields
//
// Small noise:
//     adds irregularity
//
// ============================================================

function getGrassPatchValue(
    worldX,
    worldZ,
    seed
) {

    const large =
        valueNoise(
            worldX * 0.035,
            worldZ * 0.035,
            seed
        );

    const medium =
        valueNoise(
            worldX * 0.085,
            worldZ * 0.085,
            seed + 137
        );

    const small =
        valueNoise(
            worldX * 0.20,
            worldZ * 0.20,
            seed + 271
        );


    return (
        large * 0.65 +
        medium * 0.25 +
        small * 0.10
    );
}


// ============================================================
// SMOOTHSTEP
// ============================================================

function smoothstep(
    edge0,
    edge1,
    value
) {

    const t =
        Math.max(
            0,
            Math.min(
                1,
                (value - edge0) /
                (edge1 - edge0)
            )
        );

    return (
        t * t *
        (3 - 2 * t)
    );
}


// ============================================================
// TERRAIN GRIDS
// ============================================================

const terrainGrids =
    new Map();


// ============================================================
// WORKER MESSAGE HANDLER
// ============================================================

self.onmessage =
    function (event) {

        const data =
            event.data;


        if (!data) {
            return;
        }


        // ====================================================
        // REGISTER TERRAIN
        // ====================================================

        if (
            data.type ===
            "setTerrainGrid"
        ) {

            terrainGrids.set(
                data.key,
                {

                    grid:
                        data.terrainGrid,

                    resolution:
                        data.gridResolution,

                    size:
                        data.terrainSize

                }
            );

            return;
        }


        // ====================================================
        // REMOVE TERRAIN
        // ====================================================

        if (
            data.type ===
            "removeTerrainGrid"
        ) {

            terrainGrids.delete(
                data.key
            );

            return;
        }


        // ====================================================
        // GENERATE
        // ====================================================

        if (
            data.type !==
            "generate"
        ) {

            return;
        }


        const {
            jobId,
            key,
            chunkX,
            chunkZ,
            chunkSize,
            density,
            seed
        } = data;


        const terrain =
            terrainGrids.get(
                key
            );


        if (!terrain) {

            self.postMessage({

                type:
                    "error",

                jobId,

                key,

                message:
                    `Terrain grid not found for ${key}.`

            });

            return;
        }


        // ====================================================
        // RANDOM
        // ====================================================

        const random =
            createRandom(

                (
                    seed +
                    chunkX * 374761393 +
                    chunkZ * 668265263
                ) >>> 0

            );


        // ====================================================
        // ARRAYS
        // ====================================================

        const positions =
            new Float32Array(
                density * 3
            );

        const rotations =
            new Float32Array(
                density
            );

        const widths =
            new Float32Array(
                density
            );

        const heights =
            new Float32Array(
                density
            );

        const curves =
            new Float32Array(
                density
            );

        const randomDensity =
            new Float32Array(
                density
            );


        // ====================================================
        // GRASS PLACEMENT
        // ====================================================

        let grassCount =
            0;


        // We may reject many points because of:
        //
        // 1. steep slopes
        // 2. empty grass patches
        //
        // Therefore we allow more attempts than the final
        // requested density.

        const maxAttempts =
            density * 4;


        for (
            let attempt = 0;

            attempt < maxAttempts;

            attempt++
        ) {

            // ------------------------------------------------
            // Stop once target density is reached
            // ------------------------------------------------

            if (
                grassCount >= density
            ) {

                break;
            }


            // ------------------------------------------------
            // Random position inside chunk
            // ------------------------------------------------

            const localX =
                (
                    random() -
                    0.5
                ) *
                chunkSize;

            const localZ =
                (
                    random() -
                    0.5
                ) *
                chunkSize;


            // ------------------------------------------------
            // WORLD POSITION
            // ------------------------------------------------

            const worldX =
                localX +
                chunkX * chunkSize;

            const worldZ =
                localZ +
                chunkZ * chunkSize;


            // =================================================
            // SLOPE
            // =================================================

            const slope =
                sampleSlope(

                    localX,
                    localZ,

                    terrain.grid,
                    terrain.resolution,
                    terrain.size

                );


            // ------------------------------------------------
            // STEEP SLOPES = NO GRASS
            // ------------------------------------------------
            //
            // Completely reject anything above this.
            //
            // 0.45 = beginning of steep
            // 0.70 = absolutely no grass
            //
            // Between those values we gradually reduce
            // probability.
            // ------------------------------------------------

            if (
                slope >= 0.70
            ) {

                continue;
            }


            let slopeMask =
                1.0;


            if (
                slope > 0.40
            ) {

                slopeMask =
                    1.0 -
                    smoothstep(
                        0.40,
                        0.70,
                        slope
                    );

            }


            // ------------------------------------------------
            // Additional rejection on slopes
            // ------------------------------------------------

            if (
                random() >
                slopeMask
            ) {

                continue;
            }


            // =================================================
            // GRASS PATCH
            // =================================================

            const patchValue =
                getGrassPatchValue(

                    worldX,
                    worldZ,
                    seed

                );


            // ------------------------------------------------
            // Convert noise into patches
            // ------------------------------------------------
            //
            // < 0.42
            //     mostly empty
            //
            // 0.42 - 0.62
            //     transition
            //
            // > 0.62
            //     grass field
            // ------------------------------------------------

            const patchMask =
                smoothstep(
                    0.42,
                    0.62,
                    patchValue
                );


            // ------------------------------------------------
            // Empty patch
            // ------------------------------------------------

            if (
                random() >
                patchMask
            ) {

                continue;
            }


            // =================================================
            // TERRAIN HEIGHT
            // =================================================

            const terrainY =
                sampleTerrainHeight(

                    localX,
                    localZ,

                    terrain.grid,
                    terrain.resolution,
                    terrain.size

                );


            // =================================================
            // STORE
            // =================================================

            const p =
                grassCount * 3;


            positions[p] =
                localX;

            positions[p + 1] =
                terrainY;

            positions[p + 2] =
                localZ;


            // ------------------------------------------------
            // Rotation
            // ------------------------------------------------

            rotations[
                grassCount
            ] =
                random() *
                Math.PI *
                2;


            // ------------------------------------------------
            // Height
            // ------------------------------------------------

            heights[
                grassCount
            ] =
                0.65 +
                random() *
                0.65;


            // ------------------------------------------------
            // Width
            // ------------------------------------------------

            widths[
                grassCount
            ] =
                0.85 +
                random() *
                0.30;


            // ------------------------------------------------
            // Wind curve
            // ------------------------------------------------

            curves[
                grassCount
            ] =
                (
                    random() -
                    0.5
                ) *
                2.0;


            // ------------------------------------------------
            // Shader variation
            // ------------------------------------------------

            randomDensity[
                grassCount
            ] =
                0.8 +
                random() *
                0.2;


            grassCount++;
        }


        // ====================================================
        // CREATE EXACT-SIZE ARRAYS
        // ====================================================

        const finalPositions =
            positions.slice(
                0,
                grassCount * 3
            );

        const finalRotations =
            rotations.slice(
                0,
                grassCount
            );

        const finalWidths =
            widths.slice(
                0,
                grassCount
            );

        const finalHeights =
            heights.slice(
                0,
                grassCount
            );

        const finalCurves =
            curves.slice(
                0,
                grassCount
            );

        const finalRandomDensity =
            randomDensity.slice(
                0,
                grassCount
            );


        // ====================================================
        // RETURN
        // ====================================================

        self.postMessage(

            {

                type:
                    "complete",

                jobId,

                key,

                chunkX,

                chunkZ,

                density:
                    grassCount,

                positions:
                    finalPositions,

                rotations:
                    finalRotations,

                widths:
                    finalWidths,

                heights:
                    finalHeights,

                curves:
                    finalCurves,

                randomDensity:
                    finalRandomDensity

            },

            [

                finalPositions.buffer,

                finalRotations.buffer,

                finalWidths.buffer,

                finalHeights.buffer,

                finalCurves.buffer,

                finalRandomDensity.buffer

            ]

        );
    };
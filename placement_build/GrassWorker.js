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
        gx *
        (gridResolution - 1);

    const gridZ =
        gz *
        (gridResolution - 1);


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
        terrainGrid[
        row0 + x0
        ];

    const h10 =
        terrainGrid[
        row0 + x1
        ];

    const h01 =
        terrainGrid[
        row1 + x0
        ];

    const h11 =
        terrainGrid[
        row1 + x1
        ];


    const hx0 =
        h00 +
        (h10 - h00) *
        tx;

    const hx1 =
        h01 +
        (h11 - h01) *
        tx;


    return (
        hx0 +
        (hx1 - hx0) *
        tz
    );
}


// ============================================================
// GRASS WEIGHT SAMPLING
// ============================================================
//
// grassWeightGrid uses the exact same grid as the terrain
// height grid.
//
// The values are:
//
// 0.0 = definitely not grass
// 1.0 = fully grass
//
// Bilinear interpolation gives smooth transitions.
// ============================================================

function sampleGrassWeight(
    localX,
    localZ,
    grassWeightGrid,
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
        gx *
        (gridResolution - 1);

    const gridZ =
        gz *
        (gridResolution - 1);


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


    const w00 =
        grassWeightGrid[
        row0 + x0
        ];

    const w10 =
        grassWeightGrid[
        row0 + x1
        ];

    const w01 =
        grassWeightGrid[
        row1 + x0
        ];

    const w11 =
        grassWeightGrid[
        row1 + x1
        ];


    const wx0 =
        w00 +
        (w10 - w00) *
        tx;

    const wx1 =
        w01 +
        (w11 - w01) *
        tx;


    return (
        wx0 +
        (wx1 - wx0) *
        tz
    );
}
function sampleSurfaceWeights(
    localX,
    localZ,
    grassWeightGrid,
    dirtWeightGrid,
    gravelWeightGrid,
    rockWeightGrid,
    gridResolution,
    terrainSize
) {
    const halfSize = terrainSize * 0.5;

    const normalizedX =
        (localX + halfSize) / terrainSize;

    const normalizedZ =
        (localZ + halfSize) / terrainSize;

    const gx = Math.max(
        0,
        Math.min(1, normalizedX)
    );

    const gz = Math.max(
        0,
        Math.min(1, normalizedZ)
    );

    const gridX =
        gx * (gridResolution - 1);

    const gridZ =
        gz * (gridResolution - 1);

    const x0 = Math.floor(gridX);
    const z0 = Math.floor(gridZ);

    const x1 = Math.min(
        x0 + 1,
        gridResolution - 1
    );

    const z1 = Math.min(
        z0 + 1,
        gridResolution - 1
    );

    const tx = gridX - x0;
    const tz = gridZ - z0;

    const row0 =
        z0 * gridResolution;

    const row1 =
        z1 * gridResolution;

    function interpolate(grid) {
        const w00 =
            grid[row0 + x0];

        const w10 =
            grid[row0 + x1];

        const w01 =
            grid[row1 + x0];

        const w11 =
            grid[row1 + x1];

        const wx0 =
            w00 +
            (w10 - w00) * tx;

        const wx1 =
            w01 +
            (w11 - w01) * tx;

        return (
            wx0 +
            (wx1 - wx0) * tz
        );
    }

    return {
        grass: interpolate(grassWeightGrid),
        dirt: interpolate(dirtWeightGrid),
        gravel: interpolate(gravelWeightGrid),
        rock: interpolate(rockWeightGrid)
    };
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
// SMOOTH VALUE NOISE
// ============================================================

function smoothstep(edge0, edge1, x) {

    const t =
        Math.max(
            0,
            Math.min(
                1,
                (x - edge0) /
                (edge1 - edge0)
            )
        );

    return (
        t *
        t *
        (3 - 2 * t)
    );
}


function valueNoise2D(
    x,
    z,
    seed,
    scale
) {

    const px = x * scale;
    const pz = z * scale;

    const x0 = Math.floor(px);
    const z0 = Math.floor(pz);

    const x1 = x0 + 1;
    const z1 = z0 + 1;

    const tx = px - x0;
    const tz = pz - z0;

    const sx = smoothstep(
        0,
        1,
        tx
    );

    const sz = smoothstep(
        0,
        1,
        tz
    );

    const n00 =
        (hash2D(x0, z0, seed) & 0xffff) /
        65535;

    const n10 =
        (hash2D(x1, z0, seed) & 0xffff) /
        65535;

    const n01 =
        (hash2D(x0, z1, seed) & 0xffff) /
        65535;

    const n11 =
        (hash2D(x1, z1, seed) & 0xffff) /
        65535;

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
// TERRAIN GRIDS
// ============================================================

const terrainGrids =
    new Map();


// ============================================================
// GRASS DISTRIBUTION SAMPLING
// ============================================================

function sampleGrassDistribution(
    localX,
    localZ,
    distribution,
    resolution,
    terrainSize
) {

    const normalizedX =
        Math.max(
            0,
            Math.min(1, (localX + terrainSize * 0.5) / terrainSize)
        );

    const normalizedZ =
        Math.max(
            0,
            Math.min(1, (localZ + terrainSize * 0.5) / terrainSize)
        );

    const gridX =
        normalizedX * (resolution - 1);

    const gridZ =
        normalizedZ * (resolution - 1);

    const x0 =
        Math.floor(gridX);

    const z0 =
        Math.floor(gridZ);

    const x1 =
        Math.min(x0 + 1, resolution - 1);

    const z1 =
        Math.min(z0 + 1, resolution - 1);

    const tx =
        gridX - x0;

    const tz =
        gridZ - z0;

    const d00 =
        distribution[z0 * resolution + x0];

    const d10 =
        distribution[z0 * resolution + x1];

    const d01 =
        distribution[z1 * resolution + x0];

    const d11 =
        distribution[z1 * resolution + x1];

    const top =
        d00 + (d10 - d00) * tx;

    const bottom =
        d01 + (d11 - d01) * tx;

    return
        top + (bottom - top) * tz;
}


// ============================================================
// PROP EXCLUSION SAMPLING
// ============================================================

function sampleExclusion(localX, localZ, grid, resolution, terrainSize) {

    if (!grid) {
        return 0.0;
    }

    const halfSize = terrainSize * 0.5;
    const nx = Math.max(0, Math.min(1, (localX + halfSize) / terrainSize));
    const nz = Math.max(0, Math.min(1, (localZ + halfSize) / terrainSize));
    const gx = nx * (resolution - 1);
    const gz = nz * (resolution - 1);
    const x0 = Math.floor(gx);
    const z0 = Math.floor(gz);
    const x1 = Math.min(x0 + 1, resolution - 1);
    const z1 = Math.min(z0 + 1, resolution - 1);
    const tx = gx - x0;
    const tz = gz - z0;

    const a = grid[z0 * resolution + x0];
    const b = grid[z0 * resolution + x1];
    const c = grid[z1 * resolution + x0];
    const d = grid[z1 * resolution + x1];

    const ab = a + (b - a) * tx;
    const cd = c + (d - c) * tx;

    return ab + (cd - ab) * tz;
}


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

                    grassWeightGrid:
                        data.grassWeightGrid,

                    dirtWeightGrid:
                        data.dirtWeightGrid,

                    gravelWeightGrid:
                        data.gravelWeightGrid,

                    rockWeightGrid:
                        data.rockWeightGrid,

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
            seed,
            grassDistribution,
            distributionResolution,
            grassExclusionGrid,
            exclusionResolution
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

        // ------------------------------------------------------------
        // WIND
        // ------------------------------------------------------------

        const curves =
            new Float32Array(
                density
            );

        // ------------------------------------------------------------
        // STATIC BLADE VARIATION
        // ------------------------------------------------------------

        const tiltX =
            new Float32Array(
                density
            );

        const tiltZ =
            new Float32Array(
                density
            );

        // ------------------------------------------------------------
        // COLOR VARIATION
        // ------------------------------------------------------------

        const colorVariation =
            new Float32Array(
                density
            );

        // ------------------------------------------------------------
        // LOD / FADE RANDOMNESS
        // ------------------------------------------------------------

        const randomDensity =
            new Float32Array(
                density
            );
        // ====================================================
        // GRASS PLACEMENT
        // ====================================================

        let grassCount =
            0;


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


            // =================================================
            // SURFACE SYSTEM GRASS WEIGHT
            // =================================================

            // =================================================
            // SURFACE WEIGHTS
            // =================================================

            const surface =
                sampleSurfaceWeights(
                    localX,
                    localZ,

                    terrain.grassWeightGrid,
                    terrain.dirtWeightGrid,
                    terrain.gravelWeightGrid,
                    terrain.rockWeightGrid,

                    terrain.resolution,
                    terrain.size
                );


            // =================================================
            // DOMINANT SURFACE
            // =================================================

            // =================================================
            // GRASS SURFACE WEIGHT
            // =================================================

            const grassWeight =
                surface.grass;


            // =================================================
            // WORLD POSITION
            // =================================================

            const worldX =
                chunkX * chunkSize +
                localX;

            const worldZ =
                chunkZ * chunkSize +
                localZ;


            // =================================================
            // PROP EXCLUSION
            // =================================================

            if (
                sampleExclusion(
                    localX,
                    localZ,
                    grassExclusionGrid,
                    exclusionResolution,
                    chunkSize
                ) >= 0.5
            ) {
                continue;
            }


            // =================================================
            // PROP DISTRIBUTION
            // =================================================
            //
            // GrassSystem sampled the authoritative
            // PropDistributionSystem field for this chunk.
            // The worker only interpolates those samples.
            //

            const grassDensity =
                sampleGrassDistribution(
                    localX,
                    localZ,
                    grassDistribution,
                    distributionResolution,
                    chunkSize
                );


            // =================================================
            // BASE SURFACE DENSITY
            // =================================================
            //
            // Grass surface:
            // roughly 60–80%
            //
            // Transitional / dirt:
            // progressively less.
            //
            // Rock:
            // naturally approaches zero.
            //

            let baseProbability;

            if (
                grassWeight >= 0.5
            ) {

                baseProbability =
                    0.60 +
                    (
                        grassWeight - 0.5
                    ) *
                    0.40;

            }
            else {

                baseProbability =
                    grassWeight *
                    0.20;
            }


            // =================================================
            // PROP DISTRIBUTION DENSITY
            // =================================================

            let grassProbability =
                baseProbability *
                grassDensity;


            // =================================================
            // FINAL LIMIT
            // =================================================

            grassProbability =
                Math.max(
                    0.0,
                    Math.min(
                        0.80,
                        grassProbability
                    )
                );


            // =================================================
            // RANDOM SPAWN
            // =================================================

            if (
                random() >
                grassProbability
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

            // =================================================
            // STATIC TILT
            // =================================================
            //
            // Small random lean so blades aren't perfectly
            // vertical.
            //

            tiltX[
                grassCount
            ] =
                (
                    random() -
                    0.5
                ) *
                0.22;

            tiltZ[
                grassCount
            ] =
                (
                    random() -
                    0.5
                ) *
                0.22;


            // =================================================
            // COLOR VARIATION
            // =================================================
            //
            // Dense patches become slightly richer.
            // Sparse patches become slightly lighter.
            //
            // Still subtle.
            //

            const colorVariationValue =
                (
                    grassDensity -
                    0.5
                ) *
                0.30
                +
                (
                    random() -
                    0.5
                ) *
                0.12;

            colorVariation[
                grassCount
            ] =
                Math.max(
                    -1.0,
                    Math.min(
                        1.0,
                        colorVariationValue
                    )
                );
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

        const finalTiltX =
            tiltX.slice(
                0,
                grassCount
            );

        const finalTiltZ =
            tiltZ.slice(
                0,
                grassCount
            );

        const finalColorVariation =
            colorVariation.slice(
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
                tiltX:
                    finalTiltX,

                tiltZ:
                    finalTiltZ,

                colorVariation:
                    finalColorVariation,

                randomDensity:
                    finalRandomDensity

            },

            [
                finalPositions.buffer,
                finalRotations.buffer,
                finalWidths.buffer,
                finalHeights.buffer,
                finalCurves.buffer,
                finalTiltX.buffer,
                finalTiltZ.buffer,
                finalColorVariation.buffer,
                finalRandomDensity.buffer
            ]

        );
    };
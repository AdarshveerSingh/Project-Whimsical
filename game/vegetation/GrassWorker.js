// ============================================================
// GrassWorker.js
//
// Generates grass blades for one chunk and returns instance
// matrices SORTED BY CELL (cellsPerAxis x cellsPerAxis grid).
//
// Inside each cell, blades stay in random order, so taking the
// first N blades of a cell is always a random subset (this is
// what makes the count-based LOD work).
// ============================================================


// ============================================================
// SEEDED RANDOM
// ============================================================

function hash2D(x, z, seed) {

    let h = seed >>> 0;

    h ^= Math.imul(x, 374761393);
    h ^= Math.imul(z, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;

    return h >>> 0;
}


function createRandom(seed) {

    let state = seed >>> 0;

    return function () {

        state += 0x6D2B79F5;

        let t = state;

        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}


// ============================================================
// GRID SAMPLING
// ============================================================
//
// Height and grass weight share one grid, so the bilinear cell
// is computed once per candidate and reused for both lookups.
// u, v are normalized chunk coordinates in [0, 1).
// ============================================================

let c00 = 0;
let c10 = 0;
let c01 = 0;
let c11 = 0;
let cellTx = 0;
let cellTz = 0;


function prepareCell(u, v, resolution) {

    const max = resolution - 1;

    const gx = u * max;
    const gz = v * max;

    const x0 = Math.floor(gx);
    const z0 = Math.floor(gz);

    const x1 = x0 + 1 < resolution ? x0 + 1 : max;
    const z1 = z0 + 1 < resolution ? z0 + 1 : max;

    const row0 = z0 * resolution;
    const row1 = z1 * resolution;

    c00 = row0 + x0;
    c10 = row0 + x1;
    c01 = row1 + x0;
    c11 = row1 + x1;

    cellTx = gx - x0;
    cellTz = gz - z0;
}


function sampleCell(grid) {

    const a = grid[c00] + (grid[c10] - grid[c00]) * cellTx;
    const b = grid[c01] + (grid[c11] - grid[c01]) * cellTx;

    return a + (b - a) * cellTz;
}


function sampleDistribution(distribution, resolution, u, v) {

    const x = u * resolution;
    const z = v * resolution;

    const x0 = Math.floor(x);
    const z0 = Math.floor(z);

    const x1 = x0 + 1 < resolution ? x0 + 1 : resolution;
    const z1 = z0 + 1 < resolution ? z0 + 1 : resolution;

    const tx = x - x0;
    const tz = z - z0;

    const stride = resolution + 1;

    const a = distribution[z0 * stride + x0];
    const b = distribution[z0 * stride + x1];
    const c = distribution[z1 * stride + x0];
    const d = distribution[z1 * stride + x1];

    const top = a + (b - a) * tx;
    const bottom = c + (d - c) * tx;

    return top + (bottom - top) * tz;
}


// ============================================================
// TERRAIN GRIDS
// ============================================================

const terrainGrids = new Map();


// ============================================================
// MESSAGE HANDLER
// ============================================================

self.onmessage = function (event) {

    const data = event.data;

    if (!data) {
        return;
    }


    // --------------------------------------------------------
    // REGISTER TERRAIN
    // --------------------------------------------------------

    if (data.type === "setTerrainGrid") {

        terrainGrids.set(data.key, {
            heightGrid: data.terrainGrid,
            grassWeightGrid: data.grassWeightGrid,
            resolution: data.gridResolution,
            size: data.terrainSize
        });

        return;
    }


    // --------------------------------------------------------
    // REMOVE TERRAIN
    // --------------------------------------------------------

    if (data.type === "removeTerrainGrid") {

        terrainGrids.delete(data.key);

        return;
    }


    if (data.type !== "generate") {
        return;
    }


    // --------------------------------------------------------
    // GENERATE
    // --------------------------------------------------------

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
        cellsPerAxis = 4
    } = data;

    const terrain = terrainGrids.get(key);

    if (!terrain) {

        self.postMessage({
            type: "error",
            jobId,
            key,
            message: `Terrain grid not found for ${key}.`
        });

        return;
    }

    const heightGrid = terrain.heightGrid;
    const grassWeightGrid = terrain.grassWeightGrid;
    const gridResolution = terrain.resolution;

    const random = createRandom(hash2D(chunkX, chunkZ, seed));


    // --------------------------------------------------------
    // OUTPUT ARRAYS (unsorted, in generation order)
    // --------------------------------------------------------

    const matrices = new Float32Array(density * 16);
    const curves = new Float32Array(density);
    const colorVariation = new Float32Array(density);
    const randomDensity = new Float32Array(density);
    const cellIds = new Uint16Array(density);


    // --------------------------------------------------------
    // PLACEMENT
    // --------------------------------------------------------

    let count = 0;

    const maxAttempts = density * 4;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {

        if (count >= density) {
            break;
        }

        const u = random();
        const v = random();

        prepareCell(u, v, gridResolution);

        const grassWeight = sampleCell(grassWeightGrid);

        // Cheap early-out: dirt and rock stop here
        if (grassWeight < 0.02) {
            continue;
        }

        const grassDensity = sampleDistribution(
            grassDistribution,
            distributionResolution,
            u,
            v
        );

        const baseProbability = grassWeight >= 0.5
            ? 0.60 + (grassWeight - 0.5) * 0.40
            : grassWeight * 0.20;

        let probability = baseProbability * grassDensity;

        if (probability > 0.80) {
            probability = 0.80;
        }

        if (probability <= 0 || random() > probability) {
            continue;
        }


        // ----------------------------------------------------
        // BLADE PARAMETERS
        // ----------------------------------------------------

        const localX = (u - 0.5) * chunkSize;
        const localZ = (v - 0.5) * chunkSize;
        const y = sampleCell(heightGrid);

        const rotationY = random() * Math.PI * 2;
        const scaleY = 0.65 + random() * 0.65;
        const scaleX = 0.85 + random() * 0.30;

        const tiltX = (random() - 0.5) * 0.22;
        const tiltZ = (random() - 0.5) * 0.22;

        curves[count] = (random() - 0.5) * 2.0;

        let variation =
            (grassDensity - 0.5) * 0.30 +
            (random() - 0.5) * 0.12;

        if (variation > 1.0) variation = 1.0;
        if (variation < -1.0) variation = -1.0;

        colorVariation[count] = variation;
        randomDensity[count] = random();

        // Cell index (x grows with u, z grows with v)
        cellIds[count] =
            Math.min(cellsPerAxis - 1, (u * cellsPerAxis) | 0) +
            Math.min(cellsPerAxis - 1, (v * cellsPerAxis) | 0) * cellsPerAxis;


        // ----------------------------------------------------
        // INSTANCE MATRIX
        // ----------------------------------------------------
        //
        // Same as Matrix4.compose with Euler order XYZ
        // (tiltX, rotationY, tiltZ) and scale (scaleX, scaleY, 1).
        //

        const a = Math.cos(tiltX);
        const b = Math.sin(tiltX);
        const c = Math.cos(rotationY);
        const d = Math.sin(rotationY);
        const e = Math.cos(tiltZ);
        const f = Math.sin(tiltZ);

        const ae = a * e;
        const af = a * f;
        const be = b * e;
        const bf = b * f;

        const o = count * 16;

        matrices[o] = c * e * scaleX;
        matrices[o + 1] = (af + be * d) * scaleX;
        matrices[o + 2] = (bf - ae * d) * scaleX;
        matrices[o + 3] = 0;

        matrices[o + 4] = -c * f * scaleY;
        matrices[o + 5] = (ae - bf * d) * scaleY;
        matrices[o + 6] = (be + af * d) * scaleY;
        matrices[o + 7] = 0;

        matrices[o + 8] = d;
        matrices[o + 9] = -b * c;
        matrices[o + 10] = a * c;
        matrices[o + 11] = 0;

        matrices[o + 12] = localX;
        matrices[o + 13] = y;
        matrices[o + 14] = localZ;
        matrices[o + 15] = 1;

        count++;
    }


    // --------------------------------------------------------
    // COUNTING SORT BY CELL (stable)
    // --------------------------------------------------------

    const cellTotal = cellsPerAxis * cellsPerAxis;
    const cellCounts = new Uint32Array(cellTotal);

    for (let i = 0; i < count; i++) {
        cellCounts[cellIds[i]]++;
    }

    const cursor = new Uint32Array(cellTotal);

    for (let c = 1; c < cellTotal; c++) {
        cursor[c] = cursor[c - 1] + cellCounts[c - 1];
    }

    const sortedMatrices = new Float32Array(count * 16);
    const sortedCurves = new Float32Array(count);
    const sortedColor = new Float32Array(count);
    const sortedDensity = new Float32Array(count);

    for (let i = 0; i < count; i++) {

        const dest = cursor[cellIds[i]]++;

        sortedMatrices.set(
            matrices.subarray(i * 16, i * 16 + 16),
            dest * 16
        );

        sortedCurves[dest] = curves[i];
        sortedColor[dest] = colorVariation[i];
        sortedDensity[dest] = randomDensity[i];
    }


    // --------------------------------------------------------
    // RETURN
    // --------------------------------------------------------

    self.postMessage(
        {
            type: "complete",
            jobId,
            key,
            chunkX,
            chunkZ,
            density: count,
            cellsPerAxis,
            cellCounts,
            matrices: sortedMatrices,
            curves: sortedCurves,
            colorVariation: sortedColor,
            randomDensity: sortedDensity
        },
        [
            cellCounts.buffer,
            sortedMatrices.buffer,
            sortedCurves.buffer,
            sortedColor.buffer,
            sortedDensity.buffer
        ]
    );
};
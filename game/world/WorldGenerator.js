import * as THREE from "../node_modules/three/build/three.module.js";

const SEA_LEVEL_OVERRIDE = null;     // e.g. 9.5 to hard-code a level, null = automatic
const SEA_LEVEL_PERCENTILE = 0.10;   // fraction of the world that ends up below sea level
const seaLevelCache = new Map();

export class WorldGenerator {

constructor({
    seed = 482917,
    baseHeight = 0.0,
    maxHeight = 14.2,
    heightScale = 6.0,
    worldSize = 8192
} = {}) {

        this.seed =
            seed;

        this.baseHeight =
            baseHeight;

        this.maxHeight =
            maxHeight;

        this.heightScale =
    heightScale;

        this.worldSize =
            worldSize;

        this.halfWorldSize =
            worldSize * 0.5;


        // ==================================================
        // WORLD GENERATION SETTINGS
        // ==================================================

        /*
         * Each macro cell covers a large section
         * of the world.
         *
         * 512 world units gives us large geographical
         * formations rather than tiny hills.
         */

        this.macroCellSize =
            512;


        /*
         * Maximum distance at which a formation can
         * influence the terrain.
         */

        this.maxHillRadius =
            340;


        /*
         * Number of hills generated inside each
         * macro cell.
         *
         * Two gives us more varied geography while
         * remaining cheap enough for procedural queries.
         */

        this.hillsPerCell =
            2;


        /*
         * Controls how strongly overlapping hills
         * combine.
         */

        this.combinationPower =
            4.0;


        // ==================================================
        // HEIGHT NORMALIZATION
        // ==================================================

        this.fieldMin =
            0.0;

        this.fieldMax =
            1.0;

        this.fieldRange =
            1.0;
        this._cellCache = new Map();
        // constructor
this._nc = [];
for (let i = 0; i < 8; i++) {
    this._nc.push({ x0: NaN, z0: NaN, v00: 0, v10: 0, v01: 0, v11: 0 });
}

    }


    // ==================================================
    // SEEDED RANDOM
    // ==================================================

    hash(value) {

        const x =
            Math.sin(

                value *
                127.1 +

                this.seed *
                74.7

            ) *
            43758.5453123;


        return (
            x -
            Math.floor(x)
        );

    }


    // ==================================================
    // SEEDED 2D RANDOM
    // ==================================================

    hash2D(
        x,
        z,
        offset = 0
    ) {

        const value =
            Math.sin(

                x *
                127.1 +

                z *
                311.7 +

                this.seed *
                74.7 +

                offset *
                91.13

            ) *
            43758.5453123;


        return (

            value -
            Math.floor(value)

        );

    }


    // ==================================================
    // SMOOTH INTERPOLATION
    // ==================================================

    smooth(t) {

        return (

            t *
            t *
            (3.0 - 2.0 * t)

        );

    }


    // ==================================================
    // VALUE NOISE
    // ==================================================

valueNoise(x, z, slot) {

    const x0 = Math.floor(x);
    const z0 = Math.floor(z);
    const c = this._nc[slot];

    if (c.x0 !== x0 || c.z0 !== z0) {
        c.x0 = x0;
        c.z0 = z0;
        c.v00 = this.hash2D(x0,     z0,     0);
        c.v10 = this.hash2D(x0 + 1, z0,     0);
        c.v01 = this.hash2D(x0,     z0 + 1, 0);
        c.v11 = this.hash2D(x0 + 1, z0 + 1, 0);
    }

    const fx = x - x0, fz = z - z0;
    const tx = fx * fx * (3 - 2 * fx);
    const tz = fz * fz * (3 - 2 * fz);

    const a = c.v00 + (c.v10 - c.v00) * tx;
    const b = c.v01 + (c.v11 - c.v01) * tx;
    return a + (b - a) * tz;
}

fractalNoise(x, z, layer) {

    let value = 0, amplitude = 1, frequency = 1, sum = 0;

    for (let o = 0; o < 4; o++) {
        value += this.valueNoise(x * frequency, z * frequency, layer * 4 + o) * amplitude;
        sum += amplitude;
        amplitude *= 0.5;
        frequency *= 2;
    }
    return value / sum;
}

    // ==================================================
    // MACRO CELL COORDINATE
    // ==================================================

    getMacroCell(
        x,
        z
    ) {

        return {

            x:
                Math.floor(
                    x /
                    this.macroCellSize
                ),

            z:
                Math.floor(
                    z /
                    this.macroCellSize
                )

        };

    }

    getSeaLevel() {

    if (this._seaLevel !== undefined) {
        return this._seaLevel;
    }

    if (SEA_LEVEL_OVERRIDE !== null) {
        this._seaLevel = SEA_LEVEL_OVERRIDE;
        return this._seaLevel;
    }

    // Computed once per configuration and shared by every instance.
    // (TerrainSystem creates one WorldGenerator per chunk.)
    const key = `${this.seed}|${this.baseHeight}|${this.maxHeight}|${this.heightScale}`;

    let level = seaLevelCache.get(key);

    if (level === undefined) {
        level = this.computeSeaLevel();
        seaLevelCache.set(key, level);
    }

    this._seaLevel = level;

    return level;
}

computeSeaLevel(samplesPerAxis = 100) {

    const heights = new Float32Array(samplesPerAxis * samplesPerAxis);
    const step = this.worldSize / samplesPerAxis;

    let k = 0;

    for (let iz = 0; iz < samplesPerAxis; iz++) {

        const z = -this.halfWorldSize + (iz + 0.5) * step;

        for (let ix = 0; ix < samplesPerAxis; ix++) {

            const x = -this.halfWorldSize + (ix + 0.5) * step;

            heights[k++] = this.getHeight(x, z);
        }
    }

    heights.sort();

    const index = Math.min(
        heights.length - 1,
        Math.floor(heights.length * SEA_LEVEL_PERCENTILE)
    );

    return heights[index];
}

getWaterLevel(x, z) {
    return this.getSeaLevel();
}

getWaterDepth(x, z) {
    return Math.max(0, this.getSeaLevel() - this.getHeight(x, z));
}
    // ==================================================
    // CREATE HILLS FOR ONE MACRO CELL
    // ==================================================

getCellHills(cellX, cellZ) {

    const key = (cellX + 32768) * 65536 + (cellZ + 32768);
    let hills = this._cellCache.get(key);
    if (hills !== undefined) return hills;

    hills = [];
    const cellSize = this.macroCellSize;
    const p = this.combinationPower;

    for (let i = 0; i < this.hillsPerCell; i++) {

        const randomX = this.hash2D(
            cellX * 13.17 + i * 17.31,
            cellZ * 19.73 + i * 31.73,
            1
        );

        const randomZ = this.hash2D(
            cellX * 23.91 + i * 37.91,
            cellZ * 29.17 + i * 47.91,
            2
        );

        const randomStrength = this.hash2D(
            cellX * 41.27 + i * 53.17,
            cellZ * 59.83 + i * 63.17,
            3
        );

        const randomRadius = this.hash2D(
            cellX * 67.19 + i * 71.43,
            cellZ * 73.91 + i * 79.21,
            4
        );

        const x = cellX * cellSize + THREE.MathUtils.lerp(cellSize * 0.10, cellSize * 0.90, randomX);
        const z = cellZ * cellSize + THREE.MathUtils.lerp(cellSize * 0.10, cellSize * 0.90, randomZ);
        const strength = THREE.MathUtils.lerp(0.45, 1.0, randomStrength);
        const radius = THREE.MathUtils.lerp(170.0, 340.0, randomRadius);

        hills.push({
            x,
            z,
            strengthPow: Math.pow(strength, p),
            k: 1.6 * p / (radius * radius),
            cullSq: (radius * 2.5) * (radius * 2.5)
        });
    }

    this._cellCache.set(key, hills);
    return hills;
}

    // ==================================================
    // GAUSSIAN INFLUENCE
    // ==================================================

    gaussian(
        distance,
        radius
    ) {

        const normalized =
            distance /
            radius;


        return Math.exp(

            -normalized *
            normalized *
            1.6

        );

    }


    // ==================================================
    // RAW TERRAIN FIELD
    // ==================================================

    getRawField(x, z) {
    
    
    const size = this.macroCellSize;
    const cx = Math.floor(x / size);   // no {x, z} object allocation
    const cz = Math.floor(z / size);

    let poweredSum = 0.0;

    for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {

            const hills = this.getCellHills(cx + dx, cz + dz);

            for (let i = 0; i < hills.length; i++) {
                const h = hills[i];
                const ox = x - h.x;
                const oz = z - h.z;
                const d2 = ox * ox + oz * oz;

                if (d2 > h.cullSq) continue;

                poweredSum += h.strengthPow * Math.exp(-d2 * h.k);
            }
        }
    }

    let field = Math.pow(poweredSum, 1.0 / this.combinationPower);



        /*
         * Large-scale noise adds variation
         * between major formations.
         */

        const broadNoise = this.fractalNoise(x * 0.0045, z * 0.0045, 0);


        field =

            field * 0.88 +

            broadNoise * 0.12;


        /*
         * Additional very broad noise keeps
         * the world from feeling like a collection
         * of isolated circular hills.
         */

        const continentalNoise = this.fractalNoise(x * 0.0012, z * 0.0012, 1);


        field =

            field * 0.82 +

            continentalNoise * 0.18;


        return THREE.MathUtils.clamp(

            field,

            0.0,

            1.0

        );

    }


    // ==================================================
    // HEIGHT
    // ==================================================

getHeight(
    x,
    z
) {

    const rawField =
        this.getRawField(
            x,
            z
        );


    let normalized =

        (
            rawField -
            this.fieldMin
        ) /
        this.fieldRange;


    normalized =

        THREE.MathUtils.clamp(

            normalized,

            0.0,

            1.0

        );


    /*
     * Slightly flatten low terrain while
     * preserving strong mountain peaks.
     */

    normalized =

        Math.pow(

            normalized,

            1.15

        );


    return (
        this.baseHeight +
        normalized *
        (this.maxHeight - this.baseHeight) *
        this.heightScale
    );

}


    // ==================================================
    // NORMAL
    // ==================================================

    getNormal(
        x,
        z
    ) {

        const epsilon =
            0.5;


        const heightLeft =
            this.getHeight(

                x - epsilon,

                z

            );


        const heightRight =
            this.getHeight(

                x + epsilon,

                z

            );


        const heightBack =
            this.getHeight(

                x,

                z - epsilon

            );


        const heightForward =
            this.getHeight(

                x,

                z + epsilon

            );


        const dx =
            heightRight -
            heightLeft;


        const dz =
            heightForward -
            heightBack;


        const normal =
            new THREE.Vector3(

                -dx,

                epsilon * 2.0,

                -dz

            );


        normal.normalize();


        return normal;

    }


    // ==================================================
    // SLOPE
    // ==================================================

  getSlope(x, z) {
      const e = 0.5;
      const dx = this.getHeight(x + e, z) - this.getHeight(x - e, z);
      const dz = this.getHeight(x, z + e) - this.getHeight(x, z - e);
      return Math.atan(Math.hypot(dx, dz) / (2 * e)); // same value as acos(normal.y)
  }

// ==================================================
// TERRAIN SAMPLE
// ==================================================

getTerrainSample(
    x,
    z
) {
    const height =
        this.getHeight(
            x,
            z
        );

    const epsilon =
        0.5;

    const heightLeft =
        this.getHeight(
            x - epsilon,
            z
        );

    const heightRight =
        this.getHeight(
            x + epsilon,
            z
        );

    const heightBack =
        this.getHeight(
            x,
            z - epsilon
        );

    const heightForward =
        this.getHeight(
            x,
            z + epsilon
        );

    const dx =
        heightRight -
        heightLeft;

    const dz =
        heightForward -
        heightBack;

    const normal =
        new THREE.Vector3(
            -dx,
            epsilon * 2.0,
            -dz
        );

    normal.normalize();

    const slope =
        Math.acos(
            THREE.MathUtils.clamp(
                normal.y,
                -1.0,
                1.0
            )
        );

    const slopeDegrees =
        THREE.MathUtils.radToDeg(
            slope
        );

    return {
        height,
        normal,
        slope,
        slopeDegrees
    };
}



    // ==================================================
    // WORLD BOUNDS
    // ==================================================

    isInsideWorld(
        x,
        z
    ) {

        return (

            x >=
            -this.halfWorldSize &&

            x <=
            this.halfWorldSize &&

            z >=
            -this.halfWorldSize &&

            z <=
            this.halfWorldSize

        );

    }


    // ==================================================
    // WORLD BOUNDS DATA
    // ==================================================

    getWorldBounds() {

        return {

            minX:
                -this.halfWorldSize,

            maxX:
                this.halfWorldSize,

            minZ:
                -this.halfWorldSize,

            maxZ:
                this.halfWorldSize,

            size:
                this.worldSize

        };

    }


    // ==================================================
    // SEED
    // ==================================================

    getSeed() {

        return this.seed;

    }

}
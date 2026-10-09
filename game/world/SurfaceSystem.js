import * as THREE from "../node_modules/three/build/three.module.js";


export class SurfaceSystem {

    constructor({
        seed = 482917
    } = {}) {

        this.seed = seed;

        // ==================================================
        // SURFACE TYPES
        // ==================================================

        this.SURFACE = {
            GRASS: "grass",
            DIRT: "dirt",
            GRAVEL: "gravel",
            ROCK: "rock"
        };


        // ==================================================
        // TUNING
        // ==================================================

        /*
        * Large-scale variation.
        *
        * Lower frequency = larger patches.
        */
        this.largeNoiseScale = 0.018;


        /*
        * Medium-scale variation.
        *
        * Breaks up the large regions.
        */
        this.mediumNoiseScale = 0.055;


        /*
        * Small variation.
        *
        * Used very lightly so the surface does
        * not look overly noisy.
        */
        this.smallNoiseScale = 0.14;


        /*
        * Slope at which terrain starts becoming
        * unsuitable for normal grass/dirt.
        */
        this.grassSlopeStart = 32.0;
        this.grassSlopeEnd = 48.0;

        this.rockSlopeStart = 48.0;
        this.rockSlopeEnd = 62.0;


        /*
        * Height influence.
        *
        * Kept weak for now because elevation
        * should not dominate the surface.
        */
        this.heightInfluence = 0.12;
    }


    // ==================================================
    // SEEDED HASH
    // ==================================================

    hash2D(x, z) {

        const value =
            Math.sin(
                x * 127.1 +
                z * 311.7 +
                this.seed * 74.7
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

    valueNoise(x, z) {

        const x0 = Math.floor(x);
        const z0 = Math.floor(z);

        const x1 = x0 + 1;
        const z1 = z0 + 1;


        const tx =
            this.smooth(
                x - x0
            );


        const tz =
            this.smooth(
                z - z0
            );


        const v00 =
            this.hash2D(
                x0,
                z0
            );


        const v10 =
            this.hash2D(
                x1,
                z0
            );


        const v01 =
            this.hash2D(
                x0,
                z1
            );


        const v11 =
            this.hash2D(
                x1,
                z1
            );


        const a =
            THREE.MathUtils.lerp(
                v00,
                v10,
                tx
            );


        const b =
            THREE.MathUtils.lerp(
                v01,
                v11,
                tx
            );


        return THREE.MathUtils.lerp(
            a,
            b,
            tz
        );
    }


    // ==================================================
    // FRACTAL NOISE
    // ==================================================

    fractalNoise(
        x,
        z
    ) {

        let value = 0.0;

        let amplitude = 1.0;

        let frequency = 1.0;

        let amplitudeSum = 0.0;


        /*
        * Three octaves.
        *
        * Large octave dominates.
        */
        for (
            let octave = 0;
            octave < 3;
            octave++
        ) {

            value +=
                this.valueNoise(
                    x * frequency,
                    z * frequency
                ) *
                amplitude;


            amplitudeSum +=
                amplitude;


            amplitude *= 0.5;

            frequency *= 2.0;
        }


        return (
            value /
            amplitudeSum
        );
    }


    // ==================================================
    // SURFACE NOISE
    // ==================================================

    getSurfaceNoise(
        x,
        z
    ) {

        const large =
            this.fractalNoise(
                x *
                this.largeNoiseScale,
                z *
                this.largeNoiseScale
            );


        const medium =
            this.fractalNoise(
                x *
                this.mediumNoiseScale,
                z *
                this.mediumNoiseScale
            );


        const small =
            this.valueNoise(
                x *
                this.smallNoiseScale,
                z *
                this.smallNoiseScale
            );


        /*
        * Large formations dominate.
        *
        * Medium noise creates patches.
        *
        * Small noise only breaks up
        * perfectly smooth boundaries.
        */
        const combined =
            large * 0.62 +
            medium * 0.30 +
            small * 0.08;


        return THREE.MathUtils.clamp(
            combined,
            0.0,
            1.0
        );
    }


    // ==================================================
    // HEIGHT NORMALIZATION
    // ==================================================

    getHeightFactor(
        height,
        minHeight = 0.0,
        maxHeight = 2.2
    ) {

        return THREE.MathUtils.clamp(
            (
                height -
                minHeight
            ) /
            Math.max(
                maxHeight -
                minHeight,
                0.000001
            ),
            0.0,
            1.0
        );
    }


    // ==================================================
    // SLOPE FACTORS
    // ==================================================

    getSlopeFactors(
        slopeDegrees
    ) {

        /*
        * Grass suitability.
        *
        * 0 = completely unsuitable
        * 1 = completely suitable
        */
        const grassSuitability =
            1.0 -
            THREE.MathUtils.smoothstep(
                slopeDegrees,
                this.grassSlopeStart,
                this.grassSlopeEnd
            );


        /*
        * Rock suitability.
        */
        const rockAmount =
            THREE.MathUtils.smoothstep(
                slopeDegrees,
                this.rockSlopeStart,
                this.rockSlopeEnd
            );


        return {

            grassSuitability:
                THREE.MathUtils.clamp(
                    grassSuitability,
                    0.0,
                    1.0
                ),

            rockAmount:
                THREE.MathUtils.clamp(
                    rockAmount,
                    0.0,
                    1.0
                )
        };
    }


    // ==================================================
    // SURFACE WEIGHTS
    // ==================================================

getSurfaceWeights(
    x,
    z,
    terrain,
    terrainSample = null,
    noise = null
) {

  const height =
    terrainSample !== null
        ? terrainSample.height
        : terrain.getHeight(
            x,
            z
        );

const slope =
    terrainSample !== null
        ? terrainSample.slope
        : terrain.getSlope(
            x,
            z
        );

const slopeDegrees =
    THREE.MathUtils.radToDeg(
        slope
    );

const surfaceNoise =
    noise !== null
        ? noise
        : this.getSurfaceNoise(
            x,
            z
        );


        // ==================================================
        // GRASS / DIRT DISTRIBUTION
        //
        // Plains are intentionally grass-dominant.
        //
        // Higher noise = grass
        // Lower noise  = dirt
        // ==================================================

        const grassNoise =
            THREE.MathUtils.smoothstep(
                surfaceNoise,
                0.3,
                0.55
            );

        const dirtNoise =
            1.0 - grassNoise;


        // ==================================================
        // HEIGHT
        // ==================================================

        const heightFactor =
            this.getHeightFactor(
                height
            );

        const heightGrassBias =
            THREE.MathUtils.lerp(
                0.96,
                1.04,
                heightFactor
            );


        let grass =
            grassNoise *
            heightGrassBias;

        let dirt =
            dirtNoise;


        // ==================================================
        // SLOPE
        // ==================================================

        const slopeFactors =
            this.getSlopeFactors(
                slopeDegrees
            );

        grass *=
            slopeFactors.grassSuitability;


        // ==================================================
        // ROCK
        // ==================================================

        const rock =
            slopeFactors.rockAmount;


        // ==================================================
        // GRAVEL
        //
        // Keep it very low for Plains.
        // It can become more important later
        // for paths / Forest / Desert.
        // ==================================================

        const transition =
            1.0 -
            Math.abs(
                grassNoise * 2.0 -
                1.0
            );

        let gravel =
            transition *
            0.04;


        gravel *=
            1.0 -
            rock;


        // ==================================================
        // REMOVE GRASS / DIRT WHERE ROCK DOMINATES
        // ==================================================

        grass *=
            1.0 -
            rock;

        dirt *=
            1.0 -
            rock;

            // ==================================================
// WATER / SHORE
// ==================================================
//
// Gravel replaces grass and dirt in and near water, so
// grass, flowers and trees all stay out of the water.
//

const worldGenerator = terrain.worldGenerator ?? terrain;

const seaLevel = worldGenerator.getSeaLevel
    ? worldGenerator.getSeaLevel()
    : -Infinity;

const depth = seaLevel - height;          // > 0 means underwater

const wet = THREE.MathUtils.smoothstep(depth, -0.35, 0.25);

if (wet > 0) {

    grass *= 1.0 - wet;
    dirt *= 1.0 - wet;
    gravel = gravel * (1.0 - wet) + wet * (1.0 - rock);
}
        // ==================================================
        // NORMALIZE
        // ==================================================

        let total =
            grass +
            dirt +
            gravel +
            rock;


        if (
            total <=
            0.000001
        ) {

            return {
                grass: 0.0,
                dirt: 0.0,
                gravel: 0.0,
                rock: 1.0
            };
        }


        grass /= total;
        dirt /= total;
        gravel /= total;

        const normalizedRock =
            rock / total;


        return {
            grass,
            dirt,
            gravel,

            rock:
                normalizedRock
        };
    }

    // ==================================================
    // SURFACE TYPE
    // ==================================================

getSurface(
    x,
    z,
    terrain,
    terrainSample = null,
    surfaceNoise = null
) {

    // --------------------------------------------------
    // SHARED TERRAIN SAMPLE
    // --------------------------------------------------

    if (terrainSample === null) {

        const worldGenerator =
            terrain.worldGenerator ?? terrain;

        terrainSample =
            worldGenerator.getTerrainSample(
                x,
                z
            );
    }


    // --------------------------------------------------
    // SHARED SURFACE NOISE
    // --------------------------------------------------

    if (surfaceNoise === null) {

        surfaceNoise =
            this.getSurfaceNoise(
                x,
                z
            );
    }


    // --------------------------------------------------
    // SURFACE WEIGHTS
    // --------------------------------------------------

    const weights =
        this.getSurfaceWeights(
            x,
            z,
            terrain,
            terrainSample,
            surfaceNoise
        );


    // --------------------------------------------------
    // DETERMINE SURFACE TYPE
    // --------------------------------------------------

    let type =
        this.SURFACE.GRASS;

    let highest =
        weights.grass;


    if (
        weights.dirt >
        highest
    ) {

        highest =
            weights.dirt;

        type =
            this.SURFACE.DIRT;
    }


    if (
        weights.gravel >
        highest
    ) {

        highest =
            weights.gravel;

        type =
            this.SURFACE.GRAVEL;
    }


    if (
        weights.rock >
        highest
    ) {

        highest =
            weights.rock;

        type =
            this.SURFACE.ROCK;
    }


    // --------------------------------------------------
    // RETURN
    // --------------------------------------------------

    return {

        type,

        weights,

        noise:
            surfaceNoise,

        height:
            terrainSample.height,

        slope:
            terrainSample.slope
    };
}


    // ==================================================
    // SURFACE ID
    // ==================================================

    getSurfaceId(
        x,
        z,
        terrain
    ) {

        return this.getSurface(
            x,
            z,
            terrain
        ).type;
    }


    // ==================================================
    // VEGETATION CHECK
    // ==================================================

    canSpawnGrass(
        x,
        z,
        terrain
    ) {

        const surface =
            this.getSurface(
                x,
                z,
                terrain
            );


        /*
        * Grass only belongs to areas
        * classified primarily as grass.
        */
        return (
            surface.type ===
            this.SURFACE.GRASS
            &&
            surface.weights.grass >
            0.45
        );
    }


    // ==================================================
    // SURFACE COLOR
    // ==================================================
getSurfaceColor(
    x,
    z,
    terrain,
    terrainSample = null,
    surfaceWeights = null,
    surfaceNoise = null
) {

    let weights =
        surfaceWeights;


    // --------------------------------------------------
    // FALLBACK
    // --------------------------------------------------

    if (weights === null) {

        const surface =
            this.getSurface(
                x,
                z,
                terrain,
                terrainSample,
                surfaceNoise
            );

        weights =
            surface.weights;
    }


    // --------------------------------------------------
    // DETERMINE DOMINANT SURFACE
    // --------------------------------------------------

    let type =
        this.SURFACE.GRASS;

    let highest =
        weights.grass;


    if (
        weights.dirt >
        highest
    ) {

        highest =
            weights.dirt;

        type =
            this.SURFACE.DIRT;
    }


    if (
        weights.gravel >
        highest
    ) {

        highest =
            weights.gravel;

        type =
            this.SURFACE.GRAVEL;
    }


    if (
        weights.rock >
        highest
    ) {

        highest =
            weights.rock;

        type =
            this.SURFACE.ROCK;
    }


    // --------------------------------------------------
    // COLOR
    // --------------------------------------------------

    switch (
        type
    ) {

        case this.SURFACE.GRASS:

            return new THREE.Color(
                0x55a832
            );


        case this.SURFACE.DIRT:

            return new THREE.Color(
                0x8b6542
            );


        case this.SURFACE.GRAVEL:

            return new THREE.Color(
                0x8b8a80
            );


        case this.SURFACE.ROCK:

            return new THREE.Color(
                0x55585a
            );


        default:

            return new THREE.Color(
                0xff00ff
            );
    }
}

    // ==================================================
    // DEBUG INFORMATION
    // ==================================================

    getDebugInfo(
        x,
        z,
        terrain
    ) {

        const surface =
            this.getSurface(
                x,
                z,
                terrain
            );


        return {

            x,
            z,

            height:
                surface.height,

            slopeRadians:
                surface.slope,

            slopeDegrees:
                THREE.MathUtils.radToDeg(
                    surface.slope
                ),

            noise:
                surface.noise,

            type:
                surface.type,

            grass:
                surface.weights.grass,

            dirt:
                surface.weights.dirt,

            gravel:
                surface.weights.gravel,

            rock:
                surface.weights.rock
        };
    }
}
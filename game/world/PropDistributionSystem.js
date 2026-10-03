import * as THREE from "three";

import {
    createNoise2D
} from "../node_modules/simplex-noise/dist/esm/simplex-noise.js";


/*
====================================================================
SEEDED RANDOM GENERATOR
====================================================================
*/

function mulberry32(seed) {

    return function () {

        let t = seed += 0x6D2B79F5;

        t = Math.imul(
            t ^ (t >>> 15),
            t | 1
        );

        t ^= t + Math.imul(
            t ^ (t >>> 7),
            t | 61
        );

        return (
            (t ^ (t >>> 14)) >>> 0
        ) / 4294967296;

    };

}


/*
====================================================================
PROP DISTRIBUTION SYSTEM
====================================================================
*/

export default class PropDistributionSystem {

    constructor({
        seed = 482917
    } = {}) {

        this.seed = seed;


        /*
        ------------------------------------------------------------
        SEEDED SIMPLEX NOISE
        ------------------------------------------------------------
        */

        const random = mulberry32(this.seed);

        this.noise2D = createNoise2D(random);


        /*
        ------------------------------------------------------------
        NOISE SCALES
        ------------------------------------------------------------

        Large:
            Large environmental regions.

        Medium:
            Patches inside those regions.

        Small:
            Local variation.
        */

        this.largeScale = {

            grass: 0.004,
            tree: 0.003,
            rock: 0.006,
            flower: 0.005,
            bush: 0.004

        };


        this.mediumScale = {

            grass: 0.018,
            tree: 0.012,
            rock: 0.025,
            flower: 0.022,
            bush: 0.016

        };


        this.smallScale = {

            grass: 0.060,
            tree: 0.045,
            rock: 0.080,
            flower: 0.070,
            bush: 0.055

        };


        /*
        ------------------------------------------------------------
        LAYER WEIGHTS
        ------------------------------------------------------------
        */

        this.layerWeights = {

            large: 0.55,
            medium: 0.30,
            small: 0.15

        };


        /*
        ------------------------------------------------------------
        DISTRIBUTION REMAPPING
        ------------------------------------------------------------

        inputMin:
            Below this value the density becomes 0.

        inputMax:
            Above this value the density becomes 1.

        power:
            Controls how strongly the high-density areas are
            concentrated.

        These values are intentionally different for each prop.
        */

this.remapSettings = {

    grass: {
        inputMin: 0.34,
        inputMax: 0.66,
        power: 0.90
    },

tree: {
    inputMin: 0.42,
    inputMax: 0.68,
    power: 1.35
},

rock: {
    inputMin: 0.34,
    inputMax: 0.62,
    power: 1.05
},

    flower: {
        inputMin: 0.36,
        inputMax: 0.64,
        power: 1.05
    },

    bush: {
        inputMin: 0.35,
        inputMax: 0.64,
        power: 1.05
    }

};

    }


    /*
    ================================================================
    RAW SIMPLEX SAMPLE
    ================================================================
    */

    sampleNoise(
        x,
        z,
        scale,
        offsetX = 0,
        offsetZ = 0
    ) {

        const value = this.noise2D(
            x * scale + offsetX,
            z * scale + offsetZ
        );


        /*
        Simplex:

            -1 → +1

        Convert:

             0 → 1
        */

        return value * 0.5 + 0.5;

    }


    /*
    ================================================================
    RAW MULTI-SCALE FIELD
    ================================================================
    */

    sampleRawField(
        x,
        z,
        scales,
        offset
    ) {

        const large = this.sampleNoise(
            x,
            z,
            scales.large,
            offset,
            offset * 0.37
        );


        const medium = this.sampleNoise(
            x,
            z,
            scales.medium,
            offset + 17.31,
            offset * 0.61
        );


        const small = this.sampleNoise(
            x,
            z,
            scales.small,
            offset + 43.72,
            offset * 0.83
        );


        const value =
            large * this.layerWeights.large +
            medium * this.layerWeights.medium +
            small * this.layerWeights.small;


        return THREE.MathUtils.clamp(
            value,
            0.0,
            1.0
        );

    }


    /*
    ================================================================
    CONTRAST / DISTRIBUTION REMAP
    ================================================================
    */

    remapDensity(
        value,
        inputMin,
        inputMax,
        power = 1.0
    ) {

        /*
        Convert the selected range into:

            0 → 1
        */

        let result =
            (value - inputMin) /
            (inputMax - inputMin);


        result = THREE.MathUtils.clamp(
            result,
            0.0,
            1.0
        );


        /*
        Smooth the transition.

        This prevents harsh edges between
        high and low density areas.
        */

        result =
            result *
            result *
            (3.0 - 2.0 * result);


        /*
        Shape the density.

        power < 1:
            More widespread.

        power > 1:
            More concentrated.
        */

        result = Math.pow(
            result,
            power
        );


        return result;

    }


    /*
    ================================================================
    FINAL FIELD
    ================================================================
    */

    sampleField(
        x,
        z,
        scales,
        offset,
        type
    ) {

        const raw = this.sampleRawField(
            x,
            z,
            scales,
            offset
        );


        const settings =
            this.remapSettings[type];


        if (!settings) {
            return raw;
        }


        return this.remapDensity(
            raw,
            settings.inputMin,
            settings.inputMax,
            settings.power
        );

    }


    /*
    ================================================================
    GRASS
    ================================================================
    */

    getGrassDensity(x, z) {

        return this.sampleField(
            x,
            z,
            {
                large: this.largeScale.grass,
                medium: this.mediumScale.grass,
                small: this.smallScale.grass
            },
            100,
            "grass"
        );

    }


    /*
    ================================================================
    TREES
    ================================================================
    */

/*
====================================================================
TREES
====================================================================

Trees have:

    1. Normal environmental tree distribution
    2. Very sparse low-frequency peaks

The sparse field creates occasional isolated trees
without filling the entire map.
====================================================================
*/

getTreeDensity(x, z) {

    const baseDensity =
        this.sampleField(
            x,
            z,
            {
                large: this.largeScale.tree,
                medium: this.mediumScale.tree,
                small: this.smallScale.tree
            },
            200,
            "tree"
        );


    /*
    ------------------------------------------------------------
    SPARSE TREE FIELD
    ------------------------------------------------------------

    Extremely low frequency.

    Most of the map receives almost nothing from this field.
    Only strong peaks contribute meaningful density.
    */

    const sparseTree =
        this.sampleNoise(
            x,
            z,
            0.055,
            1200,
            743.2
        );


    /*
    ------------------------------------------------------------
    ISOLATE THE HIGH PEAKS
    ------------------------------------------------------------

    Values below ~0.72 are suppressed.

    This means the sparse field behaves more like
    occasional points instead of another broad biome.
    */

    let sparsePeak =
        THREE.MathUtils.clamp(
            (sparseTree - 0.72) /
            0.28,
            0.0,
            1.0
        );


    /*
    Smooth the peak.
    */

    sparsePeak =
        sparsePeak *
        sparsePeak *
        (3.0 - 2.0 * sparsePeak);


    /*
    Make the isolated trees strong enough
    to actually pass the spawning probability.
    */

    sparsePeak *= 0.95;


    /*
    ------------------------------------------------------------
    COMBINE
    ------------------------------------------------------------
    */

    return THREE.MathUtils.clamp(
        Math.max(
            baseDensity,
            sparsePeak
        ),
        0.0,
        1.0
    );

}
    /*
    ================================================================
    ROCKS
    ================================================================
    */

/*
====================================================================
ROCKS
====================================================================

Rocks have:

    1. Normal rock distribution
    2. Sparse localized clusters

The sparse field is slightly higher frequency than
the tree field so nearby peaks can form small groups.
====================================================================
*/

getRockDensity(x, z) {

    const baseDensity =
        this.sampleField(
            x,
            z,
            {
                large: this.largeScale.rock,
                medium: this.mediumScale.rock,
                small: this.smallScale.rock
            },
            300,
            "rock"
        );


    /*
    ------------------------------------------------------------
    SPARSE ROCK FIELD
    ------------------------------------------------------------
    */

    const sparseRock =
        this.sampleNoise(
            x,
            z,
            0.085,
            1500,
            421.7
        );


    /*
    ------------------------------------------------------------
    CREATE LOCALIZED PEAKS
    ------------------------------------------------------------

    Only the upper portion of the noise becomes
    a meaningful rock cluster.
    */

    let sparsePeak =
        THREE.MathUtils.clamp(
            (sparseRock - 0.67) /
            0.33,
            0.0,
            1.0
        );


    /*
    Smooth the cluster edges.
    */

    sparsePeak =
        sparsePeak *
        sparsePeak *
        (3.0 - 2.0 * sparsePeak);


    /*
    Keep the clusters sparse.
    */

    sparsePeak *= 0.90;


    /*
    ------------------------------------------------------------
    COMBINE
    ------------------------------------------------------------
    */

    return THREE.MathUtils.clamp(
        Math.max(
            baseDensity,
            sparsePeak
        ),
        0.0,
        1.0
    );

}

    /*
    ================================================================
    FLOWERS
    ================================================================
    */

    getFlowerDensity(x, z) {

        return this.sampleField(
            x,
            z,
            {
                large: this.largeScale.flower,
                medium: this.mediumScale.flower,
                small: this.smallScale.flower
            },
            400,
            "flower"
        );

    }


    /*
    ================================================================
    BUSHES
    ================================================================
    */

    getBushDensity(x, z) {

        return this.sampleField(
            x,
            z,
            {
                large: this.largeScale.bush,
                medium: this.mediumScale.bush,
                small: this.smallScale.bush
            },
            500,
            "bush"
        );

    }


    /*
    ================================================================
    RAW DENSITY
    ================================================================
    */

    getRawDensity(type, x, z) {

        switch (type) {

            case "grass":

                return this.sampleRawField(
                    x,
                    z,
                    {
                        large: this.largeScale.grass,
                        medium: this.mediumScale.grass,
                        small: this.smallScale.grass
                    },
                    100
                );


            case "tree":

                return this.sampleRawField(
                    x,
                    z,
                    {
                        large: this.largeScale.tree,
                        medium: this.mediumScale.tree,
                        small: this.smallScale.tree
                    },
                    200
                );


            case "rock":

                return this.sampleRawField(
                    x,
                    z,
                    {
                        large: this.largeScale.rock,
                        medium: this.mediumScale.rock,
                        small: this.smallScale.rock
                    },
                    300
                );


            case "flower":

                return this.sampleRawField(
                    x,
                    z,
                    {
                        large: this.largeScale.flower,
                        medium: this.mediumScale.flower,
                        small: this.smallScale.flower
                    },
                    400
                );


            case "bush":

                return this.sampleRawField(
                    x,
                    z,
                    {
                        large: this.largeScale.bush,
                        medium: this.mediumScale.bush,
                        small: this.smallScale.bush
                    },
                    500
                );


            default:

                return 0.0;

        }

    }


    /*
    ================================================================
    GENERIC FINAL ACCESS
    ================================================================
    */

    getDensity(type, x, z) {

        switch (type) {

            case "grass":
                return this.getGrassDensity(x, z);

            case "tree":
                return this.getTreeDensity(x, z);

            case "rock":
                return this.getRockDensity(x, z);

            case "flower":
                return this.getFlowerDensity(x, z);

            case "bush":
                return this.getBushDensity(x, z);

            default:
                return 0.0;

        }

    }

}
// import {
//     createNoise2D
// } from "../node_modules/simplex-noise/dist/esm/simplex-noise.js";
import { createNoise2D } from "simplex-noise";


// ============================================================
// PROP DISTRIBUTION SYSTEM
// ============================================================
//
// Same output values as before. Differences:
//  - No dependency on three.js, so this file can also be
//    imported inside a Web Worker.
//  - Per-type constants (scales, offsets, remap settings) are
//    precomputed once instead of rebuilt on every call.
//  - No object allocation per density query.
//
// If you change largeScale / mediumScale / smallScale /
// layerWeights / remapSettings at runtime, call rebuildLayers().
// ============================================================


function mulberry32(seed) {

    return function () {

        let t = seed += 0x6D2B79F5;

        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}


function clamp01(value) {

    return value < 0 ? 0 : value > 1 ? 1 : value;
}


// Per-type noise offsets (unchanged from the original)
const TYPE_OFFSETS = {
    grass: 100,
    tree: 200,
    rock: 300,
    flower: 400,
    bush: 500
};


export default class PropDistributionSystem {

    constructor({
        seed = 482917
    } = {}) {

        this.seed = seed;

        this.noise2D = createNoise2D(mulberry32(this.seed));


        // Large: environmental regions
        // Medium: patches inside them
        // Small: local variation
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

        this.layerWeights = {
            large: 0.55,
            medium: 0.30,
            small: 0.15
        };

        // inputMin: below it density is 0
        // inputMax: above it density is 1
        // power:    > 1 concentrates, < 1 spreads
        this.remapSettings = {

            grass: { inputMin: 0.34, inputMax: 0.66, power: 0.90 },
            tree: { inputMin: 0.42, inputMax: 0.68, power: 1.35 },
            rock: { inputMin: 0.34, inputMax: 0.62, power: 1.05 },
            flower: { inputMin: 0.36, inputMax: 0.64, power: 1.05 },
            bush: { inputMin: 0.35, inputMax: 0.64, power: 1.05 }
        };

        this.rebuildLayers();
    }


    // ========================================================
    // PRECOMPUTED LAYERS
    // ========================================================

    rebuildLayers() {

        this.layers = {};

        for (const type of Object.keys(TYPE_OFFSETS)) {

            const offset = TYPE_OFFSETS[type];
            const remap = this.remapSettings[type];

            this.layers[type] = {

                largeScale: this.largeScale[type],
                mediumScale: this.mediumScale[type],
                smallScale: this.smallScale[type],

                // offsets for the three noise layers
                lx: offset,
                lz: offset * 0.37,

                mx: offset + 17.31,
                mz: offset * 0.61,

                sx: offset + 43.72,
                sz: offset * 0.83,

                wl: this.layerWeights.large,
                wm: this.layerWeights.medium,
                ws: this.layerWeights.small,

                min: remap.inputMin,
                range: remap.inputMax - remap.inputMin,
                power: remap.power
            };
        }
    }


    // ========================================================
    // CORE FIELD
    // ========================================================

    rawField(layer, x, z) {

        const noise = this.noise2D;

        const large =
            noise(
                x * layer.largeScale + layer.lx,
                z * layer.largeScale + layer.lz
            ) * 0.5 + 0.5;

        const medium =
            noise(
                x * layer.mediumScale + layer.mx,
                z * layer.mediumScale + layer.mz
            ) * 0.5 + 0.5;

        const small =
            noise(
                x * layer.smallScale + layer.sx,
                z * layer.smallScale + layer.sz
            ) * 0.5 + 0.5;

        return clamp01(
            large * layer.wl +
            medium * layer.wm +
            small * layer.ws
        );
    }


    remapField(layer, value) {

        let result = clamp01((value - layer.min) / layer.range);

        // Smooth the transition
        result = result * result * (3.0 - 2.0 * result);

        return layer.power === 1.0
            ? result
            : Math.pow(result, layer.power);
    }


    field(layer, x, z) {

        return this.remapField(layer, this.rawField(layer, x, z));
    }


    // ========================================================
    // COMPATIBILITY HELPERS (same behavior as before)
    // ========================================================

    sampleNoise(x, z, scale, offsetX = 0, offsetZ = 0) {

        return this.noise2D(x * scale + offsetX, z * scale + offsetZ) * 0.5 + 0.5;
    }


    sampleRawField(x, z, scales, offset) {

        const large = this.sampleNoise(x, z, scales.large, offset, offset * 0.37);
        const medium = this.sampleNoise(x, z, scales.medium, offset + 17.31, offset * 0.61);
        const small = this.sampleNoise(x, z, scales.small, offset + 43.72, offset * 0.83);

        return clamp01(
            large * this.layerWeights.large +
            medium * this.layerWeights.medium +
            small * this.layerWeights.small
        );
    }


    remapDensity(value, inputMin, inputMax, power = 1.0) {

        let result = clamp01((value - inputMin) / (inputMax - inputMin));

        result = result * result * (3.0 - 2.0 * result);

        return Math.pow(result, power);
    }


    // ========================================================
    // GRASS
    // ========================================================

    getGrassDensity(x, z) {

        return this.field(this.layers.grass, x, z);
    }


    // ========================================================
    // TREES
    // ========================================================
    //
    // Normal environmental distribution plus very sparse
    // low-frequency peaks (occasional isolated trees).
    //

    getTreeDensity(x, z) {

        const baseDensity = this.field(this.layers.tree, x, z);

        const sparseTree = this.sampleNoise(x, z, 0.055, 1200, 743.2);

        let sparsePeak = clamp01((sparseTree - 0.72) / 0.28);

        sparsePeak = sparsePeak * sparsePeak * (3.0 - 2.0 * sparsePeak);

        sparsePeak *= 0.95;

        return clamp01(Math.max(baseDensity, sparsePeak));
    }


    // ========================================================
    // ROCKS
    // ========================================================
    //
    // Normal distribution plus sparse localized clusters.
    //

    getRockDensity(x, z) {

        const baseDensity = this.field(this.layers.rock, x, z);

        const sparseRock = this.sampleNoise(x, z, 0.085, 1500, 421.7);

        let sparsePeak = clamp01((sparseRock - 0.67) / 0.33);

        sparsePeak = sparsePeak * sparsePeak * (3.0 - 2.0 * sparsePeak);

        sparsePeak *= 0.90;

        return clamp01(Math.max(baseDensity, sparsePeak));
    }


    // ========================================================
    // FLOWERS
    // ========================================================

    getFlowerDensity(x, z) {

        return this.field(this.layers.flower, x, z);
    }


    // ========================================================
    // BUSHES
    // ========================================================

    getBushDensity(x, z) {

        return this.field(this.layers.bush, x, z);
    }


    // ========================================================
    // RAW DENSITY
    // ========================================================

    getRawDensity(type, x, z) {

        const layer = this.layers[type];

        return layer ? this.rawField(layer, x, z) : 0.0;
    }


    // ========================================================
    // GENERIC ACCESS
    // ========================================================

    getDensity(type, x, z) {

        switch (type) {

            case "grass": return this.getGrassDensity(x, z);
            case "tree": return this.getTreeDensity(x, z);
            case "rock": return this.getRockDensity(x, z);
            case "flower": return this.getFlowerDensity(x, z);
            case "bush": return this.getBushDensity(x, z);

            default: return 0.0;
        }
    }
}
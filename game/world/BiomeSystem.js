import * as THREE from "three";


export class BiomeSystem {

    constructor({
        seed = 482917
    } = {}) {

        this.seed = seed;


        // ==================================================
        // BIOME DEFINITIONS
        // ==================================================

        this.biomes = {

            plains: {

                id: "plains",

                name: "Plains",

                // Terrain color range
                baseColor:
                    new THREE.Color(
                        0x47ad29
                    ),

                tipColor:
                    new THREE.Color(
                        0xe0e84a
                    ),

                // Vegetation settings
                grassDensity: 1.0,

                treeDensity: 0.08,

                flowerDensity: 0.15,

                rockDensity: 0.03

            },


            forest: {

                id: "forest",

                name: "Forest",

                baseColor:
                    new THREE.Color(
                        0x245c2b
                    ),

                tipColor:
                    new THREE.Color(
                        0x72a83c
                    ),

                grassDensity: 0.8,

                treeDensity: 0.75,

                flowerDensity: 0.1,

                rockDensity: 0.08

            },


            desert: {

                id: "desert",

                name: "Desert",

                baseColor:
                    new THREE.Color(
                        0xc29b55
                    ),

                tipColor:
                    new THREE.Color(
                        0xe6c978
                    ),

                grassDensity: 0.05,

                treeDensity: 0.01,

                flowerDensity: 0.0,

                rockDensity: 0.12

            }

        };
    }


    // ==================================================
    // SEEDED HASH
    // ==================================================

    hash2D(
        x,
        z
    ) {

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
    // GET BIOME
    // ==================================================

    getBiome(
        x,
        z,
        terrain
    ) {

        const height =
            terrain.getHeight(
                x,
                z
            );


        const slope =
            terrain.getSlope(
                x,
                z
            );


        /*
         * ----------------------------------------------
         * CURRENT WORLD
         * ----------------------------------------------
         *
         * For now the entire generated world is Plains.
         *
         * We still calculate the terrain information
         * because future biome rules will use it.
         */

        return this.biomes.plains;
    }


    // ==================================================
    // GET BIOME ID
    // ==================================================

    getBiomeId(
        x,
        z,
        terrain
    ) {

        return this.getBiome(
            x,
            z,
            terrain
        ).id;
    }


    // ==================================================
    // GET VEGETATION SETTINGS
    // ==================================================

    getVegetationSettings(
        x,
        z,
        terrain
    ) {

        const biome =
            this.getBiome(
                x,
                z,
                terrain
            );


        return {

            grassDensity:
                biome.grassDensity,

            treeDensity:
                biome.treeDensity,

            flowerDensity:
                biome.flowerDensity,

            rockDensity:
                biome.rockDensity

        };
    }


    // ==================================================
    // GET TERRAIN COLORS
    // ==================================================

    getTerrainColors(
        x,
        z,
        terrain
    ) {

        const biome =
            this.getBiome(
                x,
                z,
                terrain
            );


        return {

            baseColor:
                biome.baseColor.clone(),

            tipColor:
                biome.tipColor.clone()

        };
    }


    // ==================================================
    // GET BIOME NAME
    // ==================================================

    getBiomeName(
        x,
        z,
        terrain
    ) {

        return this.getBiome(
            x,
            z,
            terrain
        ).name;
    }


    // ==================================================
    // DEBUG
    // ==================================================

    getDebugInfo(
        x,
        z,
        terrain
    ) {

        const biome =
            this.getBiome(
                x,
                z,
                terrain
            );


        const height =
            terrain.getHeight(
                x,
                z
            );


        const slope =
            terrain.getSlope(
                x,
                z
            );


        return {

            biome:
                biome.id,

            biomeName:
                biome.name,

            height,

            slope,

            slopeDegrees:
                THREE.MathUtils.radToDeg(
                    slope
                )

        };
    }
}
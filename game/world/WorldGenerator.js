import * as THREE from "three";


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

    valueNoise(
        x,
        z
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
                z0,
                0
            );


        const v10 =
            this.hash2D(
                x1,
                z0,
                0
            );


        const v01 =
            this.hash2D(
                x0,
                z1,
                0
            );


        const v11 =
            this.hash2D(
                x1,
                z1,
                0
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

        let value =
            0.0;

        let amplitude =
            1.0;

        let frequency =
            1.0;

        let amplitudeSum =
            0.0;


        for (
            let octave = 0;
            octave < 4;
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


            amplitude *=
                0.5;


            frequency *=
                2.0;

        }


        return (

            value /
            amplitudeSum

        );

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


    // ==================================================
    // CREATE HILLS FOR ONE MACRO CELL
    // ==================================================

    getCellHills(
        cellX,
        cellZ
    ) {

        const hills =
            [];


        const cellSize =
            this.macroCellSize;


        const cellOriginX =
            cellX *
            cellSize;


        const cellOriginZ =
            cellZ *
            cellSize;


        for (
            let i = 0;
            i < this.hillsPerCell;
            i++
        ) {

            /*
             * Every value here depends only on:
             *
             * seed
             * cellX
             * cellZ
             * hill index
             *
             * Therefore this cell can be regenerated
             * anywhere without storing it.
             */

            const randomX =
                this.hash2D(
                    cellX * 13.17 +
                    i * 17.31,

                    cellZ * 19.73 +
                    i * 31.73,

                    1
                );


            const randomZ =
                this.hash2D(
                    cellX * 23.91 +
                    i * 37.91,

                    cellZ * 29.17 +
                    i * 47.91,

                    2
                );


            const randomStrength =
                this.hash2D(
                    cellX * 41.27 +
                    i * 53.17,

                    cellZ * 59.83 +
                    i * 63.17,

                    3
                );


            const randomRadius =
                this.hash2D(
                    cellX * 67.19 +
                    i * 71.43,

                    cellZ * 73.91 +
                    i * 79.21,

                    4
                );


            /*
             * Keep formations away from the exact
             * cell boundaries so neighboring cells
             * overlap naturally.
             */

            const x =
                cellOriginX +

                THREE.MathUtils.lerp(
                    cellSize * 0.10,
                    cellSize * 0.90,
                    randomX
                );


            const z =
                cellOriginZ +

                THREE.MathUtils.lerp(
                    cellSize * 0.10,
                    cellSize * 0.90,
                    randomZ
                );


            /*
             * Formation strength.
             */

            const strength =
                THREE.MathUtils.lerp(
                    0.45,
                    1.0,
                    randomStrength
                );


            /*
             * Large radius creates broad rolling
             * geographical formations.
             */

            const radius =
                THREE.MathUtils.lerp(
                    170.0,
                    340.0,
                    randomRadius
                );


            hills.push({

                x,

                z,

                strength,

                radius

            });

        }


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

    getRawField(
        x,
        z
    ) {

        /*
         * Find which macro cell contains this position.
         */

        const cell =
            this.getMacroCell(
                x,
                z
            );


        let poweredSum =
            0.0;


        /*
         * Only inspect the surrounding cells.
         *
         * Because the largest hill radius is 340
         * and cells are 512 wide, a 3×3 neighborhood
         * is sufficient.
         */

        for (
            let dz = -1;
            dz <= 1;
            dz++
        ) {

            for (
                let dx = -1;
                dx <= 1;
                dx++
            ) {

                const hills =
                    this.getCellHills(

                        cell.x + dx,

                        cell.z + dz

                    );


                for (
                    const hill
                    of hills
                ) {

                    const offsetX =
                        x -
                        hill.x;


                    const offsetZ =
                        z -
                        hill.z;


                    const distance =
                        Math.sqrt(

                            offsetX *
                            offsetX +

                            offsetZ *
                            offsetZ

                        );


                    if (
                        distance >
                        hill.radius * 2.5
                    ) {

                        continue;

                    }


                    const influence =
                        this.gaussian(

                            distance,

                            hill.radius

                        );


                    const contribution =
                        influence *
                        hill.strength;


                    poweredSum +=

                        Math.pow(

                            contribution,

                            this.combinationPower

                        );

                }

            }

        }


        /*
         * Combine overlapping geographical
         * formations.
         */

        let field =
            Math.pow(

                poweredSum,

                1.0 /
                this.combinationPower

            );


        /*
         * Large-scale noise adds variation
         * between major formations.
         */

        const broadNoise =
            this.fractalNoise(

                x * 0.0045,

                z * 0.0045

            );


        field =

            field * 0.88 +

            broadNoise * 0.12;


        /*
         * Additional very broad noise keeps
         * the world from feeling like a collection
         * of isolated circular hills.
         */

        const continentalNoise =
            this.fractalNoise(

                x * 0.0012,

                z * 0.0012

            );


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

    getSlope(
        x,
        z
    ) {

        const normal =
            this.getNormal(
                x,
                z
            );


        return Math.acos(

            THREE.MathUtils.clamp(

                normal.y,

                -1.0,

                1.0

            )

        );

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
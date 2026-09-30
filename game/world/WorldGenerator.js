import * as THREE from "three";


export class WorldGenerator {

    constructor({

        seed = 482917,

        baseHeight = 0.0,

        maxHeight = 2.2

    } = {}) {

        this.seed =
            seed;

        this.baseHeight =
            baseHeight;

        this.maxHeight =
            maxHeight;


        this.fieldMin =
            0.0;

        this.fieldMax =
            1.0;

        this.fieldRange =
            1.0;


        this.hills =
            [];


        this.generateHillField();

    }


    // ==================================================
    // SEEDED RANDOM
    // ==================================================

    hash(value) {

        const x =
            Math.sin(
                value * 127.1 +
                this.seed * 74.7
            ) *
            43758.5453123;


        return (
            x -
            Math.floor(x)
        );

    }


    // ==================================================
    // 2D SEEDED RANDOM
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


        const n00 =
            this.hash2D(
                x0,
                z0
            );

        const n10 =
            this.hash2D(
                x1,
                z0
            );

        const n01 =
            this.hash2D(
                x0,
                z1
            );

        const n11 =
            this.hash2D(
                x1,
                z1
            );


        const nx0 =
            THREE.MathUtils.lerp(
                n00,
                n10,
                tx
            );

        const nx1 =
            THREE.MathUtils.lerp(
                n01,
                n11,
                tx
            );


        return THREE.MathUtils.lerp(
            nx0,
            nx1,
            tz
        );

    }


    // ==================================================
    // GAUSSIAN
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
    // WORLD HILL FIELD
    // ==================================================

    /*
     * IMPORTANT:
     *
     * This is now WORLD based.
     *
     * It does NOT depend on a terrain chunk.
     *
     * Therefore:
     *
     * WorldGenerator.getHeight(x, z)
     *
     * will always return the same result for
     * the same seed + world coordinate.
     *
     */

    generateHillField() {

        this.hills =
            [];


        const regionSize =
            100;


        const regionRange =
            2;


        /*
         * Generate a large deterministic
         * geographical field around the
         * current origin.
         *
         * This matches the current terrain
         * generation so the game does not
         * visually change during this refactor.
         */

        for (
            let rz = -regionRange;
            rz <= regionRange;
            rz++
        ) {

            for (
                let rx = -regionRange;
                rx <= regionRange;
                rx++
            ) {

                const regionX =
                    rx;

                const regionZ =
                    rz;


                const randomX =
                    this.hash2D(
                        regionX * 13.17 + 17.31,
                        regionZ * 19.73 + 1.7
                    );


                const randomZ =
                    this.hash2D(
                        regionX * 23.91 + 31.73,
                        regionZ * 29.17 + 8.2
                    );


                const randomStrength =
                    this.hash2D(
                        regionX * 37.91 + 47.91,
                        regionZ * 41.27 + 15.4
                    );


                const randomWidth =
                    this.hash2D(
                        regionX * 53.17 + 63.17,
                        regionZ * 59.83 + 22.8
                    );


                const centerX =
                    regionX *
                    regionSize;


                const centerZ =
                    regionZ *
                    regionSize;


                const x =
                    centerX +
                    THREE.MathUtils.lerp(
                        -regionSize * 0.42,
                        regionSize * 0.42,
                        randomX
                    );


                const z =
                    centerZ +
                    THREE.MathUtils.lerp(
                        -regionSize * 0.42,
                        regionSize * 0.42,
                        randomZ
                    );


                const strength =
                    THREE.MathUtils.lerp(
                        0.35,
                        1.0,
                        randomStrength
                    );


                const radius =
                    THREE.MathUtils.lerp(
                        24.0,
                        46.0,
                        randomWidth
                    );


                this.hills.push({

                    x,

                    z,

                    strength,

                    radius

                });

            }

        }

    }


    // ==================================================
    // RAW TERRAIN FIELD
    // ==================================================

    getRawField(
        x,
        z
    ) {

        let poweredSum =
            0.0;


        const combinationPower =
            4.0;


        for (
            const hill
            of this.hills
        ) {

            const dx =
                x -
                hill.x;

            const dz =
                z -
                hill.z;


            const distance =
                Math.sqrt(
                    dx * dx +
                    dz * dz
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
                    combinationPower
                );

        }


        let field =
            Math.pow(
                poweredSum,
                1.0 /
                combinationPower
            );


        const broadNoise =
            this.valueNoise(
                x * 0.012,
                z * 0.012
            );


        field =
            field * 0.94 +
            broadNoise * 0.06;


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


        normalized =
            Math.pow(
                normalized,
                1.15
            );


        return THREE.MathUtils.lerp(

            this.baseHeight,

            this.maxHeight,

            normalized

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
    // TERRAIN DATA
    // ==================================================

    getTerrainData(
        x,
        z
    ) {

        const height =
            this.getHeight(
                x,
                z
            );


        const normal =
            this.getNormal(
                x,
                z
            );


        const slope =
            Math.acos(

                THREE.MathUtils.clamp(
                    normal.y,
                    -1.0,
                    1.0
                )

            );


        return {

            x,

            z,

            height,

            normal,

            slope,

            slopeDegrees:
                THREE.MathUtils.radToDeg(
                    slope
                )

        };

    }


    // ==================================================
    // SEED
    // ==================================================

    getSeed() {

        return this.seed;

    }

}
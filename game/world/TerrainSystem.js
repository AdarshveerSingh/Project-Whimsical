import * as THREE from "three";
import { TerrainShader } from "../shaders/TerrainShader.js";

export class TerrainSystem {

    constructor({
        scene,
        size = 115,
        resolution = 150,
        baseHeight = 0.0,
        maxHeight = 1.5,
        seed = 482917
    }) {

        this.scene = scene;

        this.size = size;
        this.resolution = resolution;

        /*
         * Absolute vertical limits for this biome.
         *
         * BASE:
         * lowest possible terrain
         *
         * MAX:
         * highest possible terrain
         */
        this.baseHeight = baseHeight;
        this.maxHeight = maxHeight;

        this.seed = seed;

        this.geometry = null;
        this.material = new THREE.ShaderMaterial({

    uniforms:
        THREE.UniformsUtils.clone(
            TerrainShader.uniforms
        ),

    vertexShader:
        TerrainShader.vertexShader,

    fragmentShader:
        TerrainShader.fragmentShader,

    side:
        THREE.DoubleSide,

    fog:
        false
});

this.material.uniforms.minHeight.value =
    this.baseHeight;

this.material.uniforms.maxHeight.value =
    this.maxHeight;
        this.mesh = null;

        this.hills = [];

        /*
         * Generate the broad geographical
         * formations first.
         */
        this.generateHillField();

        /*
         * Find the raw terrain range so that
         * the generated geography can be mapped
         * cleanly between BASE and MAX.
         */
        this.calculateFieldRange();

        this.generate();
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
    // GENERATE BROAD TERRAIN FORMATIONS
    // ==================================================

    generateHillField() {

        this.hills = [];

        /*
         * Fewer formations produce the large,
         * open geographical shapes we want.
         */
        const hillCount = 9;

        const halfSize =
            this.size * 0.5;


        for (
            let i = 0;
            i < hillCount;
            i++
        ) {

            const randomX =
                this.hash(
                    i * 17.31 + 1.7
                );

            const randomZ =
                this.hash(
                    i * 31.73 + 8.2
                );

            const randomStrength =
                this.hash(
                    i * 47.91 + 15.4
                );

            const randomWidth =
                this.hash(
                    i * 63.17 + 22.8
                );


            /*
             * Allow formations to extend slightly
             * outside the playable terrain.
             *
             * This avoids obvious edges.
             */
            const x =
                THREE.MathUtils.lerp(
                    -halfSize * 1.15,
                    halfSize * 1.15,
                    randomX
                );


            const z =
                THREE.MathUtils.lerp(
                    -halfSize * 1.15,
                    halfSize * 1.15,
                    randomZ
                );


            /*
             * This is the relative height of
             * this geographical formation.
             *
             * It is NOT the final world height.
             */
            const strength =
                THREE.MathUtils.lerp(
                    0.35,
                    1.0,
                    randomStrength
                );


            /*
             * Very broad horizontal formations.
             *
             * Large radius = long gentle slopes.
             */
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


    // ==================================================
    // SMOOTH NOISE
    // ==================================================

    smooth(t) {

        return (
            t *
            t *
            (3 - 2 * t)
        );
    }


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
    // BELL CURVE
    // ==================================================

    gaussian(
        distance,
        radius
    ) {

        const normalized =
            distance /
            radius;


        /*
         * Broad Gaussian curve.
         *
         * The lower the exponent,
         * the wider the hill.
         */
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

        /*
         * We use a smooth power combination
         * instead of adding hills together.
         *
         * This is important:
         *
         * hill + hill + hill
         *
         * is what previously caused the terrain
         * to become too tall.
         *
         * A power combination behaves more like
         * a smooth maximum:
         *
         *      /\          /\
         * ____/  \________/  \____
         */

        let poweredSum = 0;


        const combinationPower = 4.0;


        for (
            const hill of this.hills
        ) {

            const dx =
                x - hill.x;

            const dz =
                z - hill.z;


            const distance =
                Math.sqrt(
                    dx * dx +
                    dz * dz
                );


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


        /*
         * Convert the power sum back into
         * normal scale.
         *
         * This approximates the strongest
         * nearby formation without allowing
         * simple addition to create huge hills.
         */

        let field =
            Math.pow(
                poweredSum,
                1.0 /
                combinationPower
            );


        // ==================================================
        // VERY LOW-FREQUENCY GEOGRAPHICAL VARIATION
        // ==================================================

        const broadNoise =
            this.valueNoise(
                x * 0.012,
                z * 0.012
            );


        /*
         * Only a small influence.
         *
         * This keeps the terrain organic without
         * creating visible bumps.
         */

        field =
            field * 0.94 +
            broadNoise * 0.06;


        return field;
    }


    // ==================================================
    // CALCULATE FIELD RANGE
    // ==================================================

    calculateFieldRange() {

        /*
         * Sample the actual terrain field over
         * the terrain area.
         *
         * This lets us normalize the generated
         * geography into the exact BASE → MAX
         * range.
         */

        const samples = 80;

        const halfSize =
            this.size * 0.5;


        let minField =
            Infinity;

        let maxField =
            -Infinity;


        for (
            let zIndex = 0;
            zIndex <= samples;
            zIndex++
        ) {

            const z =
                THREE.MathUtils.lerp(
                    -halfSize,
                    halfSize,
                    zIndex / samples
                );


            for (
                let xIndex = 0;
                xIndex <= samples;
                xIndex++
            ) {

                const x =
                    THREE.MathUtils.lerp(
                        -halfSize,
                        halfSize,
                        xIndex / samples
                    );


                const field =
                    this.getRawField(
                        x,
                        z
                    );


                minField =
                    Math.min(
                        minField,
                        field
                    );


                maxField =
                    Math.max(
                        maxField,
                        field
                    );
            }
        }


        this.fieldMin =
            minField;

        this.fieldMax =
            maxField;


        /*
         * Avoid division by zero in the
         * extremely unlikely case that the
         * entire field is identical.
         */
        this.fieldRange =
            Math.max(
                this.fieldMax -
                this.fieldMin,
                0.000001
            );
    }


    // ==================================================
    // TERRAIN HEIGHT
    // ==================================================

    getHeight(x, z) {

        const rawField =
            this.getRawField(
                x,
                z
            );


        /*
         * Normalize geographical field
         * into 0 → 1.
         */

        let normalized =
            (
                rawField -
                this.fieldMin
            ) /
            this.fieldRange;


        normalized =
            THREE.MathUtils.clamp(
                normalized,
                0,
                1
            );


        /*
         * Slightly compress the upper part.
         *
         * This gives us broad plains with
         * relatively few locations reaching
         * the absolute maximum.
         */

        normalized =
            Math.pow(
                normalized,
                1.15
            );


        /*
         * Convert normalized geography
         * into the absolute terrain range.
         */

        return THREE.MathUtils.lerp(
            this.baseHeight,
            this.maxHeight,
            normalized
        );
    }


    // ==================================================
    // TERRAIN NORMAL
    // ==================================================

    getNormal(x, z) {

        /*
         * Sample around the requested point
         * and estimate the surface gradient.
         */

        const epsilon = 0.5;


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
    // TERRAIN SLOPE
    // ==================================================

    getSlope(x, z) {

        const normal =
            this.getNormal(
                x,
                z
            );


        /*
         * 0 radians = flat
         *
         * PI / 2 = vertical
         */

        return Math.acos(
            THREE.MathUtils.clamp(
                normal.y,
                -1,
                1
            )
        );
    }


    // ==================================================
    // TERRAIN SURFACE
    // ==================================================

    getSurface(x, z) {

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
                    -1,
                    1
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
    // GENERATE TERRAIN MESH
    // ==================================================

    generate() {

        this.geometry =
            new THREE.PlaneGeometry(
                this.size,
                this.size,
                this.resolution,
                this.resolution
            );


        /*
         * Convert plane into X/Z terrain.
         */

        this.geometry.rotateX(
            -Math.PI / 2
        );


        const position =
            this.geometry.attributes.position;


        for (
            let i = 0;
            i < position.count;
            i++
        ) {

            const x =
                position.getX(i);

            const z =
                position.getZ(i);


            const y =
                this.getHeight(
                    x,
                    z
                );


            position.setY(
                i,
                y
            );
        }


        position.needsUpdate = true;


        /*
         * Generate smooth normals.
         */

        this.geometry.computeVertexNormals();


        // // ==================================================
        // // MATERIAL
        // // ==================================================

        // this.material =
        //     new THREE.MeshStandardMaterial({

        //         color: 0xb5e06f,

        //         roughness: 0.95,

        //         metalness: 0.0,

        //         side: THREE.DoubleSide

        //     });


        // ==================================================
        // MESH
        // ==================================================

        this.mesh =
            new THREE.Mesh(
                this.geometry,
                this.material
            );


        this.mesh.name =
            "ProceduralTerrain";


        this.mesh.receiveShadow =
            true;

        this.mesh.castShadow =
            false;


        this.scene.add(
            this.mesh
        );
    }


    // ==================================================
    // CLEANUP
    // ==================================================

    dispose() {

        if (this.mesh) {

            this.scene.remove(
                this.mesh
            );
        }


        if (this.geometry) {

            this.geometry.dispose();
        }


        if (this.material) {

            this.material.dispose();
        }


        this.mesh = null;

        this.geometry = null;

        this.material = null;
    }
}
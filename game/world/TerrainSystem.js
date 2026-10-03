import * as THREE from "three";
import { TerrainShader } from "../shaders/TerrainShader.js";
import PropDistributionSystem from "./PropDistributionSystem.js";
import { SurfaceSystem } from "./SurfaceSystem.js";
import { WorldGenerator } from "./WorldGenerator.js";

export class TerrainSystem {

    constructor({
        scene,
        sun = null,
        size = 64,
        resolution = 64,
        baseHeight = 0.0,
        maxHeight = 14.2,
        heightScale = 6.0,
        seed = 482917,
        worldOffsetX = 0,
        worldOffsetZ = 0,
        surfaceSystem = null
    }) {

        this.scene = scene;

        this.sun = sun;
        this.size = size;
        this.resolution = resolution;

        this.baseHeight = baseHeight;
        this.maxHeight = maxHeight;
        this.heightScale = heightScale;

        this.effectiveMaxHeight =
            this.baseHeight +
            (this.maxHeight - this.baseHeight) *
            this.heightScale;

        this.seed = seed;
        this.worldGenerator =
            new WorldGenerator({

                seed:
                    this.seed,

                baseHeight:
                    this.baseHeight,

                maxHeight:
                    this.maxHeight,

                heightScale:
                    this.heightScale

            });

        this.worldOffsetX = worldOffsetX;
        this.worldOffsetZ = worldOffsetZ;
        this.surfaceSystem =
            surfaceSystem ||
            new SurfaceSystem({
                seed: this.seed
            });
        this.propDistributionSystem =
            new PropDistributionSystem({
                seed: this.seed
            });

        this.geometry = null;

        this.material = null;

        this.mesh = null;

        this.skirtGeometry = null;

        this.skirtMesh = null;


        // this.hills = [];


        this.fieldMin = 0.0;

        this.fieldMax = 1.0;

        this.fieldRange = 1.0;


        // ==================================================
        // MATERIAL
        // ==================================================

this.material =
    new THREE.ShaderMaterial({

        uniforms:
            THREE.UniformsUtils.merge([

                THREE.UniformsLib.lights,

                TerrainShader.uniforms

            ]),

        vertexShader:
            TerrainShader.vertexShader,

        fragmentShader:
            TerrainShader.fragmentShader,

        side:
            THREE.DoubleSide,

        fog:
            true,

        lights:
            true
    });
        // ==================================================
        // TERRAIN
        // ==================================================

        // this.generateHillField();

        // this.calculateFieldRange();

        this.generate();
    }
    // ==================================================
    // SHADOW UNIFORMS
    // ==================================================

updateShadowUniforms() {
    // Shadows are now handled automatically by Three.js
    // through the shadowmap shader chunks.
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
    // SMOOTH
    // ==================================================

    smooth(t) {

        return (
            t *
            t *
            (3 - 2 * t)
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
    // GENERATE WORLD-SPACE HILLS
    // ==================================================

    generateHillField() {

        this.hills = [];


        const regionSize = 100;


        const currentRegionX =
            Math.floor(
                this.worldOffsetX /
                regionSize
            );

        const currentRegionZ =
            Math.floor(
                this.worldOffsetZ /
                regionSize
            );


        const regionRange = 2;


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
                    currentRegionX + rx;

                const regionZ =
                    currentRegionZ + rz;


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

    getRawField(x, z) {

        let poweredSum = 0;

        const combinationPower = 4.0;


        for (
            const hill of this.hills
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
    // FIELD RANGE
    // ==================================================

    calculateFieldRange() {

        /*
         * IMPORTANT:
         *
         * Do not calculate an independent range for
         * every chunk.
         *
         * Every chunk uses the same world-space
         * normalization.
         */

        this.fieldMin = 0.0;

        this.fieldMax = 1.0;

        this.fieldRange = 1.0;
    }


    // ==================================================
    // TERRAIN HEIGHT
    // ==================================================

    // ==================================================
    // TERRAIN HEIGHT
    // ==================================================

    getHeight(
        x,
        z
    ) {

        return this.worldGenerator.getHeight(
            x,
            z
        );

    }


    // ==================================================
    // TERRAIN NORMAL
    // ==================================================

    // ==================================================
    // TERRAIN NORMAL
    // ==================================================

    getNormal(
        x,
        z
    ) {

        return this.worldGenerator.getNormal(
            x,
            z
        );

    }


    // ==================================================
    // TERRAIN SLOPE
    // ==================================================

    // ==================================================
    // TERRAIN SLOPE
    // ==================================================

    getSlope(
        x,
        z
    ) {

        return this.worldGenerator.getSlope(
            x,
            z
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
    // TERRAIN HEIGHT GRID
    // ==================================================
    //
    // Creates the height data used by GrassWorker.
    //
    // The grid is LOCAL to this terrain chunk:
    //
    //     -size/2 ---------------- +size/2
    //          terrain chunk
    //
    // This means the grass worker can use the same
    // local coordinates as the terrain mesh.
    //

    getHeightGrid() {

        const gridResolution =
            this.resolution + 1;

        const total =
            gridResolution *
            gridResolution;

        const grid =
            new Float32Array(total);

        const grassWeightData =
            new Float32Array(total);

        const dirtWeightData =
            new Float32Array(total);

        const gravelWeightData =
            new Float32Array(total);

        const rockWeightData =
            new Float32Array(total);

        const halfSize =
            this.size * 0.5;

        const step =
            this.size /
            this.resolution;


        for (
            let z = 0;
            z < gridResolution;
            z++
        ) {

            const localZ =
                -halfSize +
                z * step;


            for (
                let x = 0;
                x < gridResolution;
                x++
            ) {

                const localX =
                    -halfSize +
                    x * step;

                const worldX =
                    localX +
                    this.worldOffsetX;

                const worldZ =
                    localZ +
                    this.worldOffsetZ;

                const index =
                    z * gridResolution + x;


                // =========================================
                // HEIGHT
                // =========================================

                grid[index] =
                    this.getHeight(
                        worldX,
                        worldZ
                    );


                // =========================================
                // SURFACE
                // =========================================

                const weights =
                    this.surfaceSystem.getSurfaceWeights(
                        worldX,
                        worldZ,
                        this
                    );


                grassWeightData[index] =
                    weights.grass;

                dirtWeightData[index] =
                    weights.dirt;

                gravelWeightData[index] =
                    weights.gravel;

                rockWeightData[index] =
                    weights.rock;
            }
        }


        return {

            data:
                grid,

            grassWeightData:
                grassWeightData,

            dirtWeightData:
                dirtWeightData,

            gravelWeightData:
                gravelWeightData,

            rockWeightData:
                rockWeightData,

            resolution:
                gridResolution,

            size:
                this.size
        };
    }

    // ==================================================
    // GENERATE
    // ==================================================

    generate() {

        // --------------------------------------------------
        // MAIN TERRAIN GEOMETRY
        // --------------------------------------------------

        this.geometry =
            new THREE.PlaneGeometry(

                this.size,

                this.size,

                this.resolution,

                this.resolution

            );


        this.geometry.rotateX(
            -Math.PI / 2
        );


        // --------------------------------------------------
        // HEIGHT + SURFACE
        // --------------------------------------------------

        const position =
            this.geometry.attributes.position;

        const colors = [];

        const surfaceWeights = [];


        // --------------------------------------------------
        // HEIGHT + SURFACE WEIGHTS
        // --------------------------------------------------

        for (
            let i = 0;
            i < position.count;
            i++
        ) {

            const localX =
                position.getX(i);

            const localZ =
                position.getZ(i);


            const worldX =
                localX +
                this.worldOffsetX;

            const worldZ =
                localZ +
                this.worldOffsetZ;


            const y =
                this.getHeight(
                    worldX,
                    worldZ
                );


            position.setY(
                i,
                y
            );


            // --------------------------------------------------
            // SURFACE WEIGHTS
            // --------------------------------------------------

            const weights =
                this.surfaceSystem.getSurfaceWeights(
                    worldX,
                    worldZ,
                    this
                );


            // --------------------------------------------------
            // SURFACE DEBUG COLOR
            // --------------------------------------------------

            const surfaceColor =
                this.surfaceSystem.getSurfaceColor(
                    worldX,
                    worldZ,
                    this
                );


            colors.push(
                surfaceColor.r,
                surfaceColor.g,
                surfaceColor.b
            );


            // --------------------------------------------------
            // DIRECT SURFACE WEIGHTS
            //
            // R = grass
            // G = dirt
            // B = gravel
            // A = rock
            // --------------------------------------------------

            surfaceWeights.push(
                weights.grass,
                weights.dirt,
                weights.gravel,
                weights.rock
            );
        }


        position.needsUpdate =
            true;


        // --------------------------------------------------
        // DEBUG COLOR ATTRIBUTE
        // --------------------------------------------------

        this.geometry.setAttribute(
            "color",
            new THREE.Float32BufferAttribute(
                colors,
                3
            )
        );


        // --------------------------------------------------
        // SURFACE WEIGHTS ATTRIBUTE
        // --------------------------------------------------

        this.geometry.setAttribute(
            "surfaceWeights",
            new THREE.Float32BufferAttribute(
                surfaceWeights,
                4
            )
        );


        // --------------------------------------------------
        // WORLD-SPACE NORMALS
        // --------------------------------------------------

        const normalAttribute =
            new THREE.BufferAttribute(

                new Float32Array(
                    position.count * 3
                ),

                3
            );


        for (
            let i = 0;
            i < position.count;
            i++
        ) {

            const localX =
                position.getX(i);

            const localZ =
                position.getZ(i);


            const worldX =
                localX +
                this.worldOffsetX;


            const worldZ =
                localZ +
                this.worldOffsetZ;


            const normal =
                this.getNormal(
                    worldX,
                    worldZ
                );


            normalAttribute.setXYZ(

                i,

                normal.x,

                normal.y,

                normal.z

            );
        }


        this.geometry.setAttribute(
            "normal",
            normalAttribute
        );


        // --------------------------------------------------
        // MAIN MESH
        // --------------------------------------------------

        this.mesh =
            new THREE.Mesh(
                this.geometry,
                this.material
            );


        this.mesh.position.set(

            this.worldOffsetX,

            0,

            this.worldOffsetZ

        );


        this.mesh.name =
            `TerrainChunk_${this.worldOffsetX}_${this.worldOffsetZ}`;


        this.mesh.receiveShadow =
            true;


        this.mesh.castShadow =
            false;


        this.scene.add(
            this.mesh
        );


        // --------------------------------------------------
        // LOD SKIRT
        // --------------------------------------------------

        this.generateSkirt();
    }
    // ==================================================
    // GENERATE LOD SKIRT
    // ==================================================

    generateSkirt() {

        /*
         * The skirt extends downward from the chunk
         * boundary.
         *
         * It is intentionally small.
         */

        const skirtDepth = 1.0;


        const halfSize =
            this.size * 0.5;


        const segments =
            this.resolution;


        const vertices = [];

        const normals = [];

        const indices = [];


        // ==================================================
        // EDGE BUILDER
        // ==================================================

        const addEdge =
            (
                startX,
                startZ,
                endX,
                endZ
            ) => {

                const startIndex =
                    vertices.length / 3;


                for (
                    let i = 0;
                    i <= segments;
                    i++
                ) {

                    const t =
                        i /
                        segments;


                    const localX =
                        THREE.MathUtils.lerp(
                            startX,
                            endX,
                            t
                        );


                    const localZ =
                        THREE.MathUtils.lerp(
                            startZ,
                            endZ,
                            t
                        );


                    const worldX =
                        localX +
                        this.worldOffsetX;


                    const worldZ =
                        localZ +
                        this.worldOffsetZ;


                    const y =
                        this.getHeight(
                            worldX,
                            worldZ
                        );


                    const normal =
                        this.getNormal(
                            worldX,
                            worldZ
                        );


                    // TOP
                    vertices.push(
                        localX,
                        y,
                        localZ
                    );


                    normals.push(
                        normal.x,
                        normal.y,
                        normal.z
                    );


                    // BOTTOM
                    vertices.push(
                        localX,
                        y - skirtDepth,
                        localZ
                    );


                    normals.push(
                        normal.x,
                        normal.y,
                        normal.z
                    );
                }


                for (
                    let i = 0;
                    i < segments;
                    i++
                ) {

                    const topA =
                        startIndex +
                        i * 2;

                    const bottomA =
                        topA + 1;

                    const topB =
                        startIndex +
                        (i + 1) * 2;

                    const bottomB =
                        topB + 1;


                    /*
                     * Two triangles.
                     */

                    indices.push(

                        topA,
                        bottomA,
                        topB,

                        topB,
                        bottomA,
                        bottomB

                    );
                }
            };


        // ==================================================
        // NORTH
        // ==================================================

        addEdge(

            -halfSize,

            -halfSize,

            halfSize,

            -halfSize

        );


        // ==================================================
        // EAST
        // ==================================================

        addEdge(

            halfSize,

            -halfSize,

            halfSize,

            halfSize

        );


        // ==================================================
        // SOUTH
        // ==================================================

        addEdge(

            halfSize,

            halfSize,

            -halfSize,

            halfSize

        );


        // ==================================================
        // WEST
        // ==================================================

        addEdge(

            -halfSize,

            halfSize,

            -halfSize,

            -halfSize

        );


        // ==================================================
        // CREATE GEOMETRY
        // ==================================================

        this.skirtGeometry =
            new THREE.BufferGeometry();


        this.skirtGeometry.setAttribute(

            "position",

            new THREE.Float32BufferAttribute(

                vertices,

                3

            )

        );


        this.skirtGeometry.setAttribute(

            "normal",

            new THREE.Float32BufferAttribute(

                normals,

                3

            )

        );


        this.skirtGeometry.setIndex(
            indices
        );


        // --------------------------------------------------
        // SKIRT MESH
        // --------------------------------------------------

        this.skirtMesh =
            new THREE.Mesh(

                this.skirtGeometry,

                this.material

            );


        this.skirtMesh.position.set(

            this.worldOffsetX,

            0,

            this.worldOffsetZ

        );


        this.skirtMesh.name =
            `TerrainSkirt_${this.worldOffsetX}_${this.worldOffsetZ}`;


        this.skirtMesh.receiveShadow =
            true;


        this.skirtMesh.castShadow =
            false;


        this.scene.add(
            this.skirtMesh
        );
    }


    // ==================================================
    // CHANGE RESOLUTION
    // ==================================================

    setResolution(
        resolution
    ) {

        if (
            this.resolution ===
            resolution
        ) {

            return;
        }


        this.resolution =
            resolution;


        // --------------------------------------------------
        // REMOVE OLD MAIN GEOMETRY
        // --------------------------------------------------

        if (
            this.geometry
        ) {

            this.geometry.dispose();

            this.geometry =
                null;
        }


        // --------------------------------------------------
        // REMOVE OLD SKIRT
        // --------------------------------------------------

        if (
            this.skirtGeometry
        ) {

            this.skirtGeometry.dispose();

            this.skirtGeometry =
                null;
        }


        if (
            this.skirtMesh
        ) {

            this.scene.remove(
                this.skirtMesh
            );

            this.skirtMesh =
                null;
        }


        // --------------------------------------------------
        // REGENERATE
        // --------------------------------------------------

        this.generate();
        this.updateShadowUniforms();
    }

    // ==================================================
    // DISPLACEMENT MAP
    // ==================================================

    generateDisplacementMap(
        resolution = 512
    ) {

        const canvas =
            document.createElement("canvas");

        canvas.width =
            resolution;

        canvas.height =
            resolution;

        const ctx =
            canvas.getContext("2d");

        const image =
            ctx.createImageData(
                resolution,
                resolution
            );

        const data =
            image.data;

        const range =
            this.maxHeight -
            this.baseHeight;


        for (
            let py = 0;
            py < resolution;
            py++
        ) {

            const v =
                py /
                (resolution - 1);

            const worldZ =
                this.worldOffsetZ +
                (
                    v -
                    0.5
                ) *
                this.size;


            for (
                let px = 0;
                px < resolution;
                px++
            ) {

                const u =
                    px /
                    (resolution - 1);

                const worldX =
                    this.worldOffsetX +
                    (
                        u -
                        0.5
                    ) *
                    this.size;


                const height =
                    this.getHeight(
                        worldX,
                        worldZ
                    );


                const normalized =
                    THREE.MathUtils.clamp(
                        (
                            height -
                            this.baseHeight
                        ) /
                        Math.max(
                            range,
                            0.000001
                        ),
                        0,
                        1
                    );


                const value =
                    Math.round(
                        normalized *
                        255
                    );


                const index =
                    (
                        py *
                        resolution +
                        px
                    ) *
                    4;


                data[index] =
                    value;

                data[index + 1] =
                    value;

                data[index + 2] =
                    value;

                data[index + 3] =
                    255;
            }
        }


        ctx.putImageData(
            image,
            0,
            0
        );


        return canvas;
    }


    // ==================================================
    // SURFACE MAP
    // ==================================================

    generateSurfaceMap(
        resolution = 512
    ) {

        const canvas =
            document.createElement("canvas");

        canvas.width =
            resolution;

        canvas.height =
            resolution;

        const ctx =
            canvas.getContext("2d");

        const image =
            ctx.createImageData(
                resolution,
                resolution
            );

        const data =
            image.data;


        for (
            let py = 0;
            py < resolution;
            py++
        ) {

            const v =
                py /
                (resolution - 1);

            const worldZ =
                this.worldOffsetZ +
                (
                    v -
                    0.5
                ) *
                this.size;


            for (
                let px = 0;
                px < resolution;
                px++
            ) {

                const u =
                    px /
                    (resolution - 1);

                const worldX =
                    this.worldOffsetX +
                    (
                        u -
                        0.5
                    ) *
                    this.size;


                const surface =
                    this.surfaceSystem.getSurface(
                        worldX,
                        worldZ,
                        this
                    );


                let r = 0;
                let g = 0;
                let b = 0;


                switch (
                surface.type
                ) {

                    case this.surfaceSystem.SURFACE.GRASS:

                        r = 70;
                        g = 170;
                        b = 50;

                        break;


                    case this.surfaceSystem.SURFACE.DIRT:

                        r = 190;
                        g = 155;
                        b = 95;

                        break;


                    case this.surfaceSystem.SURFACE.GRAVEL:

                        r = 145;
                        g = 140;
                        b = 125;

                        break;


                    case this.surfaceSystem.SURFACE.ROCK:

                        r = 75;
                        g = 78;
                        b = 80;

                        break;
                }


                const index =
                    (
                        py *
                        resolution +
                        px
                    ) *
                    4;


                data[index] =
                    r;

                data[index + 1] =
                    g;

                data[index + 2] =
                    b;

                data[index + 3] =
                    255;
            }
        }


        ctx.putImageData(
            image,
            0,
            0
        );


        return canvas;
    }
    // ==================================================
    // GENERATE DISPLACEMENT MAP
    // ==================================================
    // ==================================================
    // PROP DISTRIBUTION MAP
    // ==================================================

    generatePropDistributionMap(
        type = "grass",
        resolution = 512
    ) {

        const canvas =
            document.createElement("canvas");

        canvas.width =
            resolution;

        canvas.height =
            resolution;

        const ctx =
            canvas.getContext("2d");

        const image =
            ctx.createImageData(
                resolution,
                resolution
            );

        const data =
            image.data;


        for (
            let py = 0;
            py < resolution;
            py++
        ) {

            const v =
                py /
                (resolution - 1);

            const worldZ =
                this.worldOffsetZ +
                (v - 0.5) *
                this.size;


            for (
                let px = 0;
                px < resolution;
                px++
            ) {

                const u =
                    px /
                    (resolution - 1);

                const worldX =
                    this.worldOffsetX +
                    (u - 0.5) *
                    this.size;


                const density =
                    this.propDistributionSystem.getDensity(
                        type,
                        worldX,
                        worldZ
                    );


                const value =
                    Math.round(
                        THREE.MathUtils.clamp(
                            density,
                            0,
                            1
                        ) * 255
                    );


                const index =
                    (
                        py *
                        resolution +
                        px
                    ) * 4;


                data[index] =
                    value;

                data[index + 1] =
                    value;

                data[index + 2] =
                    value;

                data[index + 3] =
                    255;
            }
        }


        ctx.putImageData(
            image,
            0,
            0
        );


        return canvas;
    }
    generateDisplacementMap(
        resolution = 512

    ) {

        const canvas =
            document.createElement("canvas");

        canvas.width =
            resolution;

        canvas.height =
            resolution;


        const ctx =
            canvas.getContext("2d");

        const image =
            ctx.createImageData(
                resolution,
                resolution
            );

        const data =
            image.data;


        const heightRange =
            Math.max(
                this.maxHeight -
                this.baseHeight,

                0.000001
            );


        for (
            let py = 0;
            py < resolution;
            py++
        ) {

            const v =
                py /
                (resolution - 1);


            const worldZ =
                this.worldOffsetZ +
                (v - 0.5) *
                this.size;


            for (
                let px = 0;
                px < resolution;
                px++
            ) {

                const u =
                    px /
                    (resolution - 1);


                const worldX =
                    this.worldOffsetX +
                    (u - 0.5) *
                    this.size;


                const height =
                    this.getHeight(
                        worldX,
                        worldZ
                    );


                const normalized =
                    THREE.MathUtils.clamp(

                        (
                            height -
                            this.baseHeight
                        ) /
                        heightRange,

                        0,
                        1

                    );


                const value =
                    Math.round(
                        normalized * 255
                    );


                const index =
                    (
                        py *
                        resolution +
                        px
                    ) * 4;


                data[index] =
                    value;

                data[index + 1] =
                    value;

                data[index + 2] =
                    value;

                data[index + 3] =
                    255;

            }

        }


        ctx.putImageData(
            image,
            0,
            0
        );


        return canvas;

    }


    // ==================================================
    // GENERATE SURFACE MAP
    // ==================================================

    generateSurfaceMap(
        resolution = 512
    ) {

        const canvas =
            document.createElement("canvas");

        canvas.width =
            resolution;

        canvas.height =
            resolution;


        const ctx =
            canvas.getContext("2d");

        const image =
            ctx.createImageData(
                resolution,
                resolution
            );

        const data =
            image.data;


        for (
            let py = 0;
            py < resolution;
            py++
        ) {

            const v =
                py /
                (resolution - 1);


            const worldZ =
                this.worldOffsetZ +
                (v - 0.5) *
                this.size;


            for (
                let px = 0;
                px < resolution;
                px++
            ) {

                const u =
                    px /
                    (resolution - 1);


                const worldX =
                    this.worldOffsetX +
                    (u - 0.5) *
                    this.size;


                const surface =
                    this.surfaceSystem.getSurface(

                        worldX,
                        worldZ,
                        this

                    );


                let r = 0;
                let g = 0;
                let b = 0;


                switch (
                surface.type
                ) {

                    case this.surfaceSystem.SURFACE.GRASS:

                        r = 70;
                        g = 170;
                        b = 50;

                        break;


                    case this.surfaceSystem.SURFACE.DIRT:

                        r = 190;
                        g = 155;
                        b = 95;

                        break;


                    case this.surfaceSystem.SURFACE.GRAVEL:

                        r = 145;
                        g = 140;
                        b = 125;

                        break;


                    case this.surfaceSystem.SURFACE.ROCK:

                        r = 75;
                        g = 78;
                        b = 80;

                        break;

                }


                const index =
                    (
                        py *
                        resolution +
                        px
                    ) * 4;


                data[index] =
                    r;

                data[index + 1] =
                    g;

                data[index + 2] =
                    b;

                data[index + 3] =
                    255;

            }

        }


        ctx.putImageData(
            image,
            0,
            0
        );


        return canvas;

    }
    // ==================================================
    // CLEANUP
    // ==================================================

    dispose() {

        if (
            this.mesh
        ) {

            this.scene.remove(
                this.mesh
            );
        }


        if (
            this.skirtMesh
        ) {

            this.scene.remove(
                this.skirtMesh
            );
        }


        if (
            this.geometry
        ) {

            this.geometry.dispose();
        }


        if (
            this.skirtGeometry
        ) {

            this.skirtGeometry.dispose();
        }


        if (
            this.material
        ) {

            this.material.dispose();
        }


        this.mesh =
            null;

        this.skirtMesh =
            null;

        this.geometry =
            null;

        this.skirtGeometry =
            null;

        this.material =
            null;

        this.hills = [];
    }
}
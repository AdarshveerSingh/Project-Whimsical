import * as THREE from "three";

import {
    GLTFLoader
} from "../node_modules/three/examples/jsm/loaders/GLTFLoader.js";

import PropDistributionSystem from "./PropDistributionSystem.js";


export class FlowerSystem {

    constructor({

        scene,

        surfaceSystem = null,

        seed = 482917,

        chunkSize = 64,

        modelPath = "./models/flowers.glb"

    } = {}) {

        this.scene =
            scene;

        this.surfaceSystem =
            surfaceSystem;

        this.seed =
            seed;

        this.chunkSize =
            chunkSize;

        this.modelPath =
            modelPath;


        // ==================================================
        // DISTRIBUTION
        // ==================================================

        this.distribution =
            new PropDistributionSystem({

                seed:
                    this.seed

            });


        // ==================================================
        // CHUNKS
        // ==================================================

        this.chunks =
            new Map();


        // ==================================================
        // FLOWER MODELS
        // ==================================================

        this.flowerModels =
            new Map();

        this.modelReady =
            false;


        // ==================================================
        // LOADER
        // ==================================================

        this.loader =
            new GLTFLoader();


        // ==================================================
        // TEMP OBJECTS
        // ==================================================

        this.tempMatrix =
            new THREE.Matrix4();

        this.tempPosition =
            new THREE.Vector3();

        this.tempQuaternion =
            new THREE.Quaternion();

        this.tempScale =
            new THREE.Vector3();


        // ==================================================
        // SETTINGS
        // ==================================================

        this.spacing =
            2.0;

        this.flowerDensityMultiplier =
            0.07;

        this.minScale =
            0.45;

        this.maxScale =
            0.55;

        // ==================================================
// FLOWER CLUSTERS
// ==================================================

this.clusterMin =
    3;

this.clusterMax =
    7;

this.clusterRadius =
    2.0;
        // ==================================================
        // LOAD MODEL
        // ==================================================

        this.loadModel();

    }

// ==================================================
// FLOWER WIND SHADER
// ==================================================

// ==================================================
// FLOWER WIND SHADER
// ==================================================

// ==================================================
// FLOWER WIND SHADER
// ==================================================

applyWindShader(material, geometry) {

    // ==================================================
    // GEOMETRY HEIGHT
    // ==================================================

    if (!geometry.boundingBox) {
        geometry.computeBoundingBox();
    }

    const minY = geometry.boundingBox.min.y;
    const maxY = geometry.boundingBox.max.y;

    const height = Math.max(
        maxY - minY,
        0.001
    );


    material.onBeforeCompile = (shader) => {

        // ==================================================
        // UNIFORMS
        // ==================================================

        shader.uniforms.time = {
            value: 0
        };

        shader.uniforms.flowerMinY = {
            value: minY
        };

        shader.uniforms.flowerHeight = {
            value: height
        };


        // ==================================================
        // DECLARE UNIFORMS
        // ==================================================

        shader.vertexShader =
            shader.vertexShader.replace(

                "#include <common>",

                `
                #include <common>

                uniform float time;
                uniform float flowerMinY;
                uniform float flowerHeight;
                `
            );


        // ==================================================
        // WIND
        // ==================================================

        shader.vertexShader =
            shader.vertexShader.replace(

                "#include <project_vertex>",

                `
                #include <project_vertex>


                // ==================================================
                // ROOT → TIP
                // ==================================================

                float flowerHeight01 =
                    clamp(
                        (
                            position.y -
                            flowerMinY
                        ) /
                        flowerHeight,

                        0.0,
                        1.0
                    );


                // ==================================================
                // ROOT LOCK
                // ==================================================

                // Bottom 30% stays completely still.
                // Movement gradually starts above it.

                float upperPart =
                    smoothstep(
                        0.30,
                        0.65,
                        flowerHeight01
                    );


                // Stronger movement toward the tip.

                float bend =
                    upperPart *
                    upperPart;


                // ==================================================
                // INSTANCE POSITION
                // ==================================================

                vec3 flowerWorldPosition =
                    (instanceMatrix *
                     vec4(transformed, 1.0)).xyz;


                // ==================================================
                // WIND PHASE
                // ==================================================

                float phase =
                    flowerWorldPosition.x * 0.08 +
                    flowerWorldPosition.z * 0.06;


                // ==================================================
                // MAIN WIND
                // ==================================================

                float largeWind =
                    sin(
                        time * 2.2 +
                        phase
                    );


                // ==================================================
                // SECONDARY WIND
                // ==================================================

                float smallWind =
                    sin(
                        time * 4.0 +
                        phase * 1.7
                    );


                // ==================================================
                // COMBINE
                // ==================================================

                float wind =
                    largeWind * 0.75 +
                    smallWind * 0.25;


                // ==================================================
                // WIND OFFSET
                // ==================================================

                vec3 windOffset =
                    vec3(
                        wind * 0.32 * bend,
                        0.0,
                        wind * 0.11 * bend
                    );


                // ==================================================
                // APPLY WIND
                // ==================================================

                mvPosition.xyz +=
                    (
                        modelViewMatrix *
                        vec4(
                            windOffset,
                            0.0
                        )
                    ).xyz;


                gl_Position =
                    projectionMatrix *
                    mvPosition;
                `
            );


        material.userData.flowerWind =
            shader;

    };


    material.needsUpdate = true;

}
    // ==================================================
    // LOAD FLOWER GLB
    // ==================================================

    loadModel() {

        this.loader.load(

            this.modelPath,

            (gltf) => {

                const root =
                    gltf.scene;

                root.updateMatrixWorld(
                    true
                );


                root.traverse(
                    (object) => {

                        if (
                            !object.isMesh
                        ) {
                            return;
                        }


                        const match =
                            object.name.match(
                                /^Flower_(0[1-9])$/
                            );


                        if (!match) {
                            return;
                        }


                        const variation =
                            match[1];


// ==================================================
// FLOWER MATERIAL
// ==================================================

const sourceMaterial =
    object.material;


// Use MeshBasicMaterial so the flowers are not
// affected by lighting and therefore don't become
// unnaturally dark.

const flowerMaterial =
    new THREE.MeshBasicMaterial({

        map:
            sourceMaterial.map || null,

        color:
            sourceMaterial.color
                ? sourceMaterial.color.clone()
                : new THREE.Color(0xffffff),

        transparent:
            false,

        alphaTest:
            0.5,

        depthTest:
            true,

        depthWrite:
            true,

        side:
            THREE.DoubleSide

    });

this.applyWindShader(
    flowerMaterial,
    object.geometry
);
this.flowerModels.set(

    variation,

    {

        geometry:
            object.geometry,

        material:
            flowerMaterial,

        matrix:
            object.matrixWorld.clone()

    }

);

                    }
                );


                if (
                    this.flowerModels.size === 0
                ) {

                    console.warn(
                        "FlowerSystem: No Flower_01 ... Flower_09 meshes found."
                    );

                    return;

                }


                this.modelReady =
                    true;


                console.log(
                    `FlowerSystem: Loaded ${this.flowerModels.size} flower variations.`
                );


                // ==================================================
                // REBUILD ALREADY REGISTERED CHUNKS
                // ==================================================

                for (
                    const chunk
                    of this.chunks.values()
                ) {

                    this.buildChunk(
                        chunk
                    );

                }

            },

            undefined,

            (error) => {

                console.error(
                    "FlowerSystem: Failed to load flower model.",
                    error
                );

            }

        );

    }


    // ==================================================
    // HASH
    // ==================================================

    hash2D(
        x,
        z
    ) {

        let h =
            Math.imul(
                x | 0,
                374761393
            );

        h =
            Math.imul(
                h ^
                    Math.imul(
                        z | 0,
                        668265263
                    ),
                1274126177
            );

        h ^=
            h >>> 13;

        h =
            Math.imul(
                h,
                1274126177
            );

        h ^=
            h >>> 16;

        return (
            h >>> 0
        ) / 4294967296;

    }


    // ==================================================
    // SURFACE SUITABILITY
    // ==================================================

    getSurfaceSuitability(
        x,
        z,
        terrain
    ) {

        if (
            !this.surfaceSystem
        ) {

            return 1.0;

        }


        const surface =
            this.surfaceSystem.getSurface(

                x,
                z,

                terrain.terrain.worldGenerator

            );


        // Flowers prefer relatively flat ground.

        if (
            surface.slope > 35
        ) {

            return 0.0;

        }


        const grass =
            surface.weights.grass || 0;

        const dirt =
            surface.weights.dirt || 0;


        return THREE.MathUtils.clamp(

            grass * 1.20 +
            dirt * 0.15,

            0.0,
            1.0

        );

    }


    // ==================================================
    // REGISTER CHUNK
    // ==================================================

    registerTerrainChunk(
        terrainChunk
    ) {

        const key =
            `${terrainChunk.x},${terrainChunk.z}`;


        // Already registered.

        if (
            this.chunks.has(key)
        ) {

            return;

        }


        const group =
            new THREE.Group();


        group.name =
            `Flowers_${key}`;


        this.scene.add(
            group
        );


        const chunk = {

            x:
                terrainChunk.x,

            z:
                terrainChunk.z,

            terrain:
                terrainChunk,
            
                terrainSystem:
        terrainChunk.terrain,

            group,

            instancedMeshes: []

        };


        this.chunks.set(
            key,
            chunk
        );


        if (
            this.modelReady
        ) {

            this.buildChunk(
                chunk
            );

        }

    }


    // ==================================================
    // BUILD CHUNK
    // ==================================================

    buildChunk(
        chunk
    ) {

        if (
            !this.modelReady
        ) {

            return;

        }


        // Remove old instances.

        for (
            const mesh
            of chunk.instancedMeshes
        ) {

            chunk.group.remove(
                mesh
            );

            mesh.dispose?.();

        }


        chunk.instancedMeshes =
            [];


        // ==================================================
        // GRID
        // ==================================================

        const cellsPerAxis =
            Math.ceil(
                this.chunkSize /
                this.spacing
            );


        const positionsByFlower =
            new Map();


        for (
            let i = 1;
            i <= 9;
            i++
        ) {

            positionsByFlower.set(
                `0${i}`,
                []
            );

        }


        let lastFlower =
            -1;


        // ==================================================
        // SAMPLE GRID
        // ==================================================

        for (
            let gx = 0;
            gx < cellsPerAxis;
            gx++
        ) {

            for (
                let gz = 0;
                gz < cellsPerAxis;
                gz++
            ) {

                const localX =
                    gx * this.spacing +
                    this.spacing * 0.5 -
                    this.chunkSize * 0.5;

                const localZ =
                    gz * this.spacing +
                    this.spacing * 0.5 -
                    this.chunkSize * 0.5;


                const worldX =
                    chunk.x *
                    this.chunkSize +
                    localX;

                const worldZ =
                    chunk.z *
                    this.chunkSize +
                    localZ;


                // ==================================================
                // FLOWER DISTRIBUTION
                // ==================================================

                const density =
                    this.distribution.getFlowerDensity(

                        worldX,
                        worldZ

                    );

                const grassDensity =
    this.distribution.getGrassDensity(
        worldX,
        worldZ
    );
    const grassAffinity =
    THREE.MathUtils.smoothstep(
        grassDensity,
        0.18,
        0.50
    );
    if (grassAffinity <= 0.01) {
    continue;
}
                if (
                    density <= 0
                ) {

                    continue;

                }


                // ==================================================
                // SURFACE
                // ==================================================

                const suitability =
                    this.getSurfaceSuitability(

                        worldX,
                        worldZ,

                        chunk.terrain

                    );


                if (
                    suitability <= 0
                ) {

                    continue;

                }


                // ==================================================
                // SPAWN PROBABILITY
                // ==================================================

               const probability =
    THREE.MathUtils.clamp(

        density *
        suitability *
        this.flowerDensityMultiplier,

        0.0,
        1.0

    );


                const random =
                    this.hash2D(

                        Math.floor(
                            worldX * 100
                        ) +
                            this.seed,

                        Math.floor(
                            worldZ * 100
                        ) +
                            this.seed * 7

                    );


                if (
                    random >
                    probability
                ) {

                    continue;

                }

                // ==================================================
// FLOWER CLUSTER
// ==================================================

const clusterRandom =
    this.hash2D(

        Math.floor(
            worldX * 37
        ) +
            this.seed * 41,

        Math.floor(
            worldZ * 37
        ) +
            this.seed * 43

    );


const clusterCount =
    this.clusterMin +
    Math.floor(

        clusterRandom *
        (
            this.clusterMax -
            this.clusterMin +
            1
        )

    );


// ==================================================
// CREATE FLOWERS INSIDE CLUSTER
// ==================================================

for (
    let clusterIndex = 0;
    clusterIndex < clusterCount;
    clusterIndex++
) {

    // --------------------------------------------------
    // Deterministic random values
    // --------------------------------------------------

    const randomA =
        this.hash2D(

            Math.floor(
                worldX * 100
            ) +
                this.seed * 47 +
                clusterIndex * 101,

            Math.floor(
                worldZ * 100
            ) +
                this.seed * 53 +
                clusterIndex * 137

        );


    const randomB =
        this.hash2D(

            Math.floor(
                worldX * 100
            ) +
                this.seed * 59 +
                clusterIndex * 149,

            Math.floor(
                worldZ * 100
            ) +
                this.seed * 61 +
                clusterIndex * 173

        );


    // --------------------------------------------------
    // Position inside cluster
    // --------------------------------------------------

    const angle =
        randomA *
        Math.PI *
        2;


    // sqrt gives a more even circular distribution.

    const radius =
        Math.sqrt(randomB) *
        this.clusterRadius;


    const flowerX =
        worldX +
        Math.cos(angle) *
        radius;


    const flowerZ =
        worldZ +
        Math.sin(angle) *
        radius;


    // --------------------------------------------------
    // Flower variation
    // --------------------------------------------------

    let variation =
        Math.floor(

            this.hash2D(

                Math.floor(
                    flowerX * 50
                ) +
                    this.seed * 13 +
                    clusterIndex * 17,

                Math.floor(
                    flowerZ * 50
                ) +
                    this.seed * 19 +
                    clusterIndex * 23

            ) * 9

        );


    // Avoid immediate repetition.

    if (
        variation ===
        lastFlower
    ) {

        variation =
            (
                variation +
                1 +
                Math.floor(
                    randomA * 8
                )
            ) % 9;

    }


    lastFlower =
        variation;


    const flowerName =
        `0${variation + 1}`;


    // --------------------------------------------------
    // Terrain height
    // --------------------------------------------------

    const flowerY =
        chunk.terrainSystem
            .worldGenerator
            .getHeight(

                flowerX,
                flowerZ

            );


    // --------------------------------------------------
    // Rotation
    // --------------------------------------------------

    const rotation =
        this.hash2D(

            Math.floor(
                flowerX * 30
            ) +
                this.seed * 67 +
                clusterIndex * 71,

            Math.floor(
                flowerZ * 30
            ) +
                this.seed * 73 +
                clusterIndex * 79

        ) *
        Math.PI *
        2;


    // --------------------------------------------------
    // Scale
    // --------------------------------------------------

    const scaleRandom =
        this.hash2D(

            Math.floor(
                flowerX * 40
            ) +
                this.seed * 83 +
                clusterIndex * 89,

            Math.floor(
                flowerZ * 40
            ) +
                this.seed * 97 +
                clusterIndex * 103

        );


    const scale =
        THREE.MathUtils.lerp(

            this.minScale,
            this.maxScale,

            scaleRandom

        );


    // --------------------------------------------------
    // Store instance
    // --------------------------------------------------

    positionsByFlower
        .get(flowerName)
        .push({

            x:
                flowerX,

            y:
                flowerY,

            z:
                flowerZ,

            rotation,

            scale

        });

}
                // ==================================================
                // FLOWER VARIATION
                // ==================================================

                let variation =
                    Math.floor(
                        this.hash2D(

                            Math.floor(
                                worldX * 50
                            ) +
                                this.seed * 13,

                            Math.floor(
                                worldZ * 50
                            ) +
                                this.seed * 17

                        ) * 9
                    );


                // Avoid immediately repeating the same variation.

                if (
                    variation ===
                    lastFlower
                ) {

                    variation =
                        (
                            variation +
                            1 +
                            Math.floor(
                                random * 8
                            )
                        ) % 9;

                }


                lastFlower =
                    variation;


                const flowerName =
                    `0${variation + 1}`;


                // ==================================================
                // TERRAIN HEIGHT
                // ==================================================

                const y =
                    chunk.terrainSystem
                        .worldGenerator
                        .getHeight(

                            worldX,
                            worldZ

                        );


                // ==================================================
                // TRANSFORM
                // ==================================================

                const rotation =
                    this.hash2D(

                        Math.floor(
                            worldX * 30
                        ) +
                            this.seed * 23,

                        Math.floor(
                            worldZ * 30
                        ) +
                            this.seed * 29

                    ) *
                    Math.PI *
                    2;


                const scaleRandom =
                    this.hash2D(

                        Math.floor(
                            worldX * 40
                        ) +
                            this.seed * 31,

                        Math.floor(
                            worldZ * 40
                        ) +
                            this.seed * 37

                    );


                const scale =
                    THREE.MathUtils.lerp(

                        this.minScale,
                        this.maxScale,

                        scaleRandom

                    );


                positionsByFlower
                    .get(flowerName)
                    .push({

                        x:
                            worldX,

                        y,

                        z:
                            worldZ,

                        rotation,

                        scale

                    });

            }

        }


        // ==================================================
        // CREATE INSTANCED MESHES
        // ==================================================

        for (
            const [
                variation,
                instances
            ]
            of positionsByFlower
        ) {

            if (
                instances.length === 0
            ) {

                continue;

            }


            const model =
                this.flowerModels.get(
                    variation
                );


            if (!model) {
                continue;
            }


            const mesh =
                new THREE.InstancedMesh(

                    model.geometry,

                    model.material,

                    instances.length

                );


            mesh.name =
                `Flower_${variation}`;


            mesh.castShadow =
                false;

            mesh.receiveShadow =
                false;


            for (
                let i = 0;
                i < instances.length;
                i++
            ) {

                const instance =
                    instances[i];


                this.tempPosition.set(

                    instance.x,
                    instance.y,
                    instance.z

                );


                this.tempQuaternion.setFromAxisAngle(

                    new THREE.Vector3(
                        0,
                        1,
                        0
                    ),

                    instance.rotation

                );


                this.tempScale.set(

                    instance.scale,
                    instance.scale,
                    instance.scale

                );


                this.tempMatrix.compose(

                    this.tempPosition,

                    this.tempQuaternion,

                    this.tempScale

                );


                // Preserve the original GLB transform.

                this.tempMatrix.multiply(
                    model.matrix
                );


                mesh.setMatrixAt(

                    i,

                    this.tempMatrix

                );

            }


            mesh.instanceMatrix.needsUpdate =
                true;


            mesh.computeBoundingSphere();


            chunk.group.add(
                mesh
            );


            chunk.instancedMeshes.push(
                mesh
            );

        }

    }
// ==================================================
// UPDATE WIND
// ==================================================

update(
    delta
) {

    for (
        const model
        of this.flowerModels.values()
    ) {

        const windShader =
            model.material
                .userData
                ?.flowerWind;


        if (
            windShader
        ) {

            windShader.uniforms
                .time
                .value += delta;

        }

    }

}

    // ==================================================
    // UNREGISTER CHUNK
    // ==================================================

    unregisterTerrainChunk(
        chunkX,
        chunkZ
    ) {

        const key =
            `${chunkX},${chunkZ}`;


        const chunk =
            this.chunks.get(
                key
            );


        if (!chunk) {

            return;

        }


        for (
            const mesh
            of chunk.instancedMeshes
        ) {

            chunk.group.remove(
                mesh
            );

        }


        this.scene.remove(
            chunk.group
        );


        this.chunks.delete(
            key
        );

    }


    // ==================================================
    // DISPOSE
    // ==================================================

    dispose() {

        for (
            const chunk
            of this.chunks.values()
        ) {

            for (
                const mesh
                of chunk.instancedMeshes
            ) {

                chunk.group.remove(
                    mesh
                );

            }


            this.scene.remove(
                chunk.group
            );

        }


        this.chunks.clear();

    }

}
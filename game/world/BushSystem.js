import * as THREE from "three";

import {
    GLTFLoader
} from "../node_modules/three/examples/jsm/loaders/GLTFLoader.js";

import PropDistributionSystem from "./PropDistributionSystem.js";
import { BushShader } from "../shaders/BushShader.js";

export class BushSystem {

    constructor({
        scene,
        surfaceSystem,
        seed = 482917,
        chunkSize = 64,
        modelPath = "./models/bushes.glb"
    }) {

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
                seed: this.seed
            });


        // ==================================================
        // CHUNKS
        // ==================================================

        this.chunks =
            new Map();


        // ==================================================
        // BUSH VARIATIONS
        // ==================================================

        /*
         * Bush_01
         * Bush_02
         * Bush_03
         * Bush_04
         * Bush_05
         */

        this.bushModels =
            new Map();


        this.modelReady =
            false;


        // ==================================================
        // LOADER
        // ==================================================
this.loader =
    new GLTFLoader();


this.noiseTexture =
    new THREE.TextureLoader().load(
        "./textures/mapForTest.png"
    );

this.noiseTexture.wrapS =
    THREE.ClampToEdgeWrapping;

this.noiseTexture.wrapT =
    THREE.ClampToEdgeWrapping;

this.noiseTexture.minFilter =
    THREE.LinearFilter;

this.noiseTexture.magFilter =
    THREE.LinearFilter;


        // ==================================================
        // TEMPORARY TRANSFORMS
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
            5.0;


        /*
         * Probability that an accepted bush
         * becomes a cluster rather than a solo bush.
         */

        this.clusterProbability =
            0.55;


        this.clusterMin =
            2;

        this.clusterMax =
            5;


        /*
         * Maximum distance from the cluster
         * center for additional bushes.
         */

        this.clusterRadius =
            3.5;


        /*
         * Overall bush size.
         */

        this.minScale =
            0.25;

        this.maxScale =
            0.75;


        this.loadModel();

    }

createBushMaterial(
    sourceMaterial,
    sourceMatrix,
    bushMin,
    bushMax
) {

    const material =
        new THREE.ShaderMaterial({

            uniforms:
                THREE.UniformsUtils.clone(
                    BushShader.uniforms
                ),

            vertexShader:
                BushShader.vertexShader,

            fragmentShader:
                BushShader.fragmentShader,

            side:
                THREE.DoubleSide,

            transparent:
                false,

            depthWrite:
                true,

            depthTest:
                true

        });


    /*
     * --------------------------------------------------
     * ORIGINAL GLB TEXTURE
     * --------------------------------------------------
     */
    if (
        sourceMaterial.map
    ) {

        material.uniforms.map.value =
            sourceMaterial.map;

    }


    /*
     * --------------------------------------------------
     * BUSH-LOCAL MAP
     * --------------------------------------------------
     */
    material.uniforms.noiseMap.value =
        this.noiseTexture;


    /*
     * --------------------------------------------------
     * COMPLETE BUSH BOUNDS
     * --------------------------------------------------
     */
    material.uniforms.bushMin.value =
        bushMin.clone();


    material.uniforms.bushMax.value =
        bushMax.clone();


    /*
     * --------------------------------------------------
     * SOURCE MESH TRANSFORM
     * --------------------------------------------------
     */
    material.uniforms.sourceMatrix.value =
        sourceMatrix.clone();


    return material;

}
    // ==================================================
    // LOAD BUSH MODEL
    // ==================================================

// ==================================================
// LOAD BUSH MODEL
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


            // ==================================================
            // FIND BUSH VARIATIONS
            // ==================================================

            for (
                let i = 1;
                i <= 5;
                i++
            ) {

                const name =
                    `Bush_${String(i).padStart(2, "0")}`;


                const variation =
                    root.getObjectByName(
                        name
                    );


                if (!variation) {

                    console.warn(
                        `BushSystem: ${name} was not found in ${this.modelPath}`
                    );

                    continue;

                }


                variation.updateMatrixWorld(
                    true
                );


                // ==================================================
                // COLLECT SOURCE MESHES
                // ==================================================

                const rawSources =
                    [];


                if (
                    variation.isMesh
                ) {

                    variation.updateMatrixWorld(
                        true
                    );


                    if (
                        variation.geometry &&
                        variation.material
                    ) {

                        rawSources.push({

                            geometry:
                                variation.geometry,

                            material:
                                variation.material,

                            worldMatrix:
                                variation.matrixWorld.clone()

                        });

                    }

                }


                else {

                    variation.traverse(
                        (object) => {

                            if (
                                !object.isMesh
                            ) {

                                return;

                            }


                            if (
                                !object.geometry ||
                                !object.material
                            ) {

                                return;

                            }


                            object.updateMatrixWorld(
                                true
                            );


                            rawSources.push({

                                geometry:
                                    object.geometry,

                                material:
                                    object.material,

                                worldMatrix:
                                    object.matrixWorld.clone()

                            });

                        }
                    );

                }


                if (
                    rawSources.length === 0
                ) {

                    continue;

                }


                // ==================================================
                // CONVERT EVERYTHING INTO VARIATION-LOCAL SPACE
                // ==================================================

                const variationInverse =
                    variation.matrixWorld
                        .clone()
                        .invert();


                const localSources =
                    [];


                const bushMin =
                    new THREE.Vector3(
                        Infinity,
                        Infinity,
                        Infinity
                    );


                const bushMax =
                    new THREE.Vector3(
                        -Infinity,
                        -Infinity,
                        -Infinity
                    );


                const geometryBox =
                    new THREE.Box3();


                const transformedBox =
                    new THREE.Box3();


                for (
                    const source
                    of rawSources
                ) {

                    // --------------------------------------------------
                    // Source mesh -> variation-local transform
                    // --------------------------------------------------

                    const localMatrix =
                        variationInverse
                            .clone()
                            .multiply(
                                source.worldMatrix
                            );


                    // --------------------------------------------------
                    // Calculate geometry bounds
                    // --------------------------------------------------

                    if (
                        !source.geometry.boundingBox
                    ) {

                        source.geometry.computeBoundingBox();

                    }


                    geometryBox.copy(
                        source.geometry.boundingBox
                    );


                    transformedBox
                        .copy(
                            geometryBox
                        )
                        .applyMatrix4(
                            localMatrix
                        );


                    bushMin.min(
                        transformedBox.min
                    );

                    bushMax.max(
                        transformedBox.max
                    );


                    localSources.push({

                        geometry:
                            source.geometry,

                        material:
                            source.material,

                        matrix:
                            localMatrix

                    });

                }


                // ==================================================
                // CREATE SHADER MATERIALS
                // ==================================================

                const meshes =
                    [];


                for (
                    const source
                    of localSources
                ) {

                    const material =
                        this.createBushMaterial(

                            source.material,

                            source.matrix,

                            bushMin,

                            bushMax

                        );


                    meshes.push({

                        geometry:
                            source.geometry,

                        material,

                        matrix:
                            source.matrix.clone()

                    });

                }


                // ==================================================
                // STORE VARIATION
                // ==================================================

                if (
                    meshes.length > 0
                ) {

                    this.bushModels.set(

                        i - 1,

                        meshes

                    );

                }

            }


            // ==================================================
            // CHECK MODEL
            // ==================================================

            if (
                this.bushModels.size === 0
            ) {

                console.error(
                    "BushSystem: No Bush_01 ... Bush_05 meshes were found."
                );

                return;

            }


            this.modelReady =
                true;


            console.log(
                `BushSystem: Loaded ${this.bushModels.size} bush variations.`
            );


            // ==================================================
            // BUILD ALREADY LOADED CHUNKS
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
                "BushSystem: Failed to load bush model.",
                this.modelPath,
                error
            );

        }

    );

}

    // ==================================================
    // DETERMINISTIC RANDOM
    // ==================================================

    hash2D(
        x,
        z,
        seed
    ) {

        const value =
            Math.sin(
                x * 127.1 +
                z * 311.7 +
                seed * 74.7
            ) *
            43758.5453123;


        return (
            value -
            Math.floor(value)
        );

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
                terrain.worldGenerator
            );


        const weights =
            surface.weights;


if (
    surface.slope > 35
) {

    return 0.0;

}


        /*
         * Bushes primarily prefer grass,
         * but can tolerate some dirt.
         */

        return THREE.MathUtils.clamp(

            weights.grass * 1.15 +
            weights.dirt * 0.20,

            0.0,
            1.0

        );

    }


    // ==================================================
    // REGISTER TERRAIN CHUNK
    // ==================================================

    registerTerrainChunk(
        chunk
    ) {

        const key =
            `${chunk.x},${chunk.z}`;


        if (
            this.chunks.has(key)
        ) {

            return;

        }


        const record = {

            x:
                chunk.x,

            z:
                chunk.z,

            terrain:
                chunk.terrain,

            group:
                new THREE.Group(),

            instancedMeshes:
                []

        };


        record.group.name =
            `Bushes_${key}`;


        this.chunks.set(
            key,
            record
        );


        this.scene.add(
            record.group
        );


        if (
            this.modelReady
        ) {

            this.buildChunk(
                record
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


        // ==================================================
        // REMOVE PREVIOUS INSTANCES
        // ==================================================

        for (
            const mesh
            of chunk.instancedMeshes
        ) {

            chunk.group.remove(
                mesh
            );

        }


        chunk.instancedMeshes =
            [];


        // ==================================================
        // BUSH POSITIONS BY VARIATION
        // ==================================================

        const positionsByVariation =
            new Map();


        for (
            let i = 0;
            i < 5;
            i++
        ) {

            positionsByVariation.set(
                i,
                []
            );

        }


        // ==================================================
        // CANDIDATE GRID
        // ==================================================

        const cellsPerAxis =
            Math.ceil(
                this.chunkSize /
                this.spacing
            );


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

                const baseX =
                    chunk.x *
                    this.chunkSize +
                    gx * this.spacing +
                    this.spacing * 0.5;

                const baseZ =
                    chunk.z *
                    this.chunkSize +
                    gz * this.spacing +
                    this.spacing * 0.5;


                // ==================================================
                // CHUNK BOUNDS
                // ==================================================

                if (
                    baseX < chunk.x * this.chunkSize ||
                    baseX >= (chunk.x + 1) * this.chunkSize ||
                    baseZ < chunk.z * this.chunkSize ||
                    baseZ >= (chunk.z + 1) * this.chunkSize
                ) {

                    continue;

                }


                // ==================================================
                // BUSH DISTRIBUTION
                // ==================================================

                const density =
                    this.distribution.getBushDensity(
                        baseX,
                        baseZ
                    );


                // ==================================================
                // SURFACE
                // ==================================================

                const suitability =
                    this.getSurfaceSuitability(
                        baseX,
                        baseZ,
                        chunk.terrain
                    );


                // ==================================================
                // SPAWN PROBABILITY
                // ==================================================

                const BUSH_DENSITY_MULTIPLIER =
                    0.05;


                const probability =
                    THREE.MathUtils.clamp(

                        density *
                        suitability *
                        BUSH_DENSITY_MULTIPLIER,

                        0.0,
                        1.0

                    );


                const spawnRandom =
                    this.hash2D(

                        gx +
                        chunk.x * 1000,

                        gz +
                        chunk.z * 1000,

                        this.seed + 15001

                    );


                if (
                    spawnRandom >
                    probability
                ) {

                    continue;

                }


                // ==================================================
                // SOLO OR CLUSTER
                // ==================================================

                const clusterRandom =
                    this.hash2D(

                        gx +
                        chunk.x * 1371,

                        gz +
                        chunk.z * 1973,

                        this.seed + 16001

                    );


                const isCluster =
                    clusterRandom <
                    this.clusterProbability;


                let bushCount =
                    1;


                if (
                    isCluster
                ) {

                    const countRandom =
                        this.hash2D(

                            gx +
                            chunk.x * 2311,

                            gz +
                            chunk.z * 3197,

                            this.seed + 17001

                        );


                    bushCount =
                        this.clusterMin +
                        Math.floor(

                            countRandom *
                            (
                                this.clusterMax -
                                this.clusterMin +
                                1
                            )

                        );

                }


                // ==================================================
                // CREATE BUSHES
                // ==================================================

                for (
                    let clusterIndex = 0;
                    clusterIndex < bushCount;
                    clusterIndex++
                ) {

                    let bushX =
                        baseX;

                    let bushZ =
                        baseZ;


                    // ==================================================
                    // CLUSTER OFFSET
                    // ==================================================

                    if (
                        clusterIndex > 0
                    ) {

                        const angle =
                            this.hash2D(

                                gx +
                                clusterIndex * 17 +
                                chunk.x * 101,

                                gz +
                                clusterIndex * 31 +
                                chunk.z * 149,

                                this.seed + 18001

                            ) *
                            Math.PI *
                            2.0;


                        const radiusRandom =
                            this.hash2D(

                                gx +
                                clusterIndex * 43 +
                                chunk.x * 173,

                                gz +
                                clusterIndex * 59 +
                                chunk.z * 211,

                                this.seed + 19001

                            );


                        const radius =
                            0.8 +
                            radiusRandom *
                            (
                                this.clusterRadius -
                                0.8
                            );


                        bushX +=
                            Math.cos(angle) *
                            radius;

                        bushZ +=
                            Math.sin(angle) *
                            radius;

                    }


                    // ==================================================
                    // KEEP BUSH INSIDE CHUNK
                    // ==================================================

                    if (
                        bushX < chunk.x * this.chunkSize ||
                        bushX >= (chunk.x + 1) * this.chunkSize ||
                        bushZ < chunk.z * this.chunkSize ||
                        bushZ >= (chunk.z + 1) * this.chunkSize
                    ) {

                        continue;

                    }


                    // ==================================================
                    // TERRAIN HEIGHT
                    // ==================================================

                    const y =
                        chunk.terrain.worldGenerator.getHeight(
                            bushX,
                            bushZ
                        );


                    // ==================================================
                    // VARIATION
                    // ==================================================

                    const variationRandom =
                        this.hash2D(

                            Math.floor(bushX * 10),

                            Math.floor(bushZ * 10),

                            this.seed +
                            20001 +
                            clusterIndex * 37

                        );


                    const variation =
                        Math.floor(
                            variationRandom * 5
                        );


                    // ==================================================
                    // ROTATION
                    // ==================================================

                    const rotationRandom =
                        this.hash2D(

                            Math.floor(bushX * 17),

                            Math.floor(bushZ * 17),

                            this.seed +
                            21001 +
                            clusterIndex * 41

                        );


                    const rotation =
                        rotationRandom *
                        Math.PI *
                        2.0;


                    // ==================================================
                    // SCALE
                    // ==================================================

                    const scaleRandom =
                        this.hash2D(

                            Math.floor(bushX * 23),

                            Math.floor(bushZ * 23),

                            this.seed +
                            22001 +
                            clusterIndex * 47

                        );


                    /*
                     * Cluster bushes are slightly
                     * more varied in size.
                     */

                    const clusterScale =
                        isCluster
                            ? (
                                0.85 +
                                scaleRandom * 0.30
                            )
                            : (
                                0.95 +
                                scaleRandom * 0.20
                            );


                    const scale =
                        THREE.MathUtils.lerp(
                            this.minScale,
                            this.maxScale,
                            scaleRandom
                        ) *
                        clusterScale;


                    positionsByVariation
                        .get(variation)
                        .push({

                            x:
                                bushX,

                            y,

                            z:
                                bushZ,

                            rotation,

                            scale

                        });

                }

            }

        }


        // ==================================================
        // CREATE INSTANCED MESHES
        // ==================================================

        for (
            const [
                variation,
                positions
            ]
            of positionsByVariation
        ) {

            if (
                positions.length === 0
            ) {

                continue;

            }


            const sources =
                this.bushModels.get(
                    variation
                );


            if (
                !sources
            ) {

                continue;

            }


            /*
             * A variation may contain
             * more than one mesh.
             */

            for (
                const source
                of sources
            ) {

                const mesh =
                    new THREE.InstancedMesh(

                        source.geometry,

                        source.material,

                        positions.length

                    );


                mesh.castShadow =
                    true;

                mesh.receiveShadow =
                    true;

                mesh.frustumCulled =
                    true;


                for (
                    let i = 0;
                    i < positions.length;
                    i++
                ) {

                    const bush =
                        positions[i];


                    this.tempPosition.set(

                        bush.x,

                        bush.y,

                        bush.z

                    );


                    this.tempQuaternion.setFromAxisAngle(

                        new THREE.Vector3(
                            0,
                            1,
                            0
                        ),

                        bush.rotation

                    );


                    this.tempScale.set(

                        bush.scale,

                        bush.scale,

                        bush.scale

                    );


                    this.tempMatrix.compose(

                        this.tempPosition,

                        this.tempQuaternion,

                        this.tempScale

                    );


                    /*
                     * Preserve the original
                     * transform from the GLB.
                     */

                    this.tempMatrix.multiply(
                        source.matrix
                    );


                    mesh.setMatrixAt(
                        i,
                        this.tempMatrix
                    );

                }


                mesh.instanceMatrix.needsUpdate =
                    true;


                chunk.group.add(
                    mesh
                );


                chunk.instancedMeshes.push(
                    mesh
                );

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


        if (
            !chunk
        ) {

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

            this.scene.remove(
                chunk.group
            );

        }


        this.chunks.clear();

    }

}
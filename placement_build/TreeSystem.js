import * as THREE from "three";

import {
    GLTFLoader
} from "../node_modules/three/examples/jsm/loaders/GLTFLoader.js";

import PropDistributionSystem from "./PropDistributionSystem.js";

import {
    applyLeafShader
} from "../shaders/LeafShader.js";


// ============================================================
// TREE SYSTEM
// ============================================================

export class TreeSystem {

    constructor({
        scene,
        surfaceSystem,
        seed = 482917,
        chunkSize = 64,
        modelPath = "./models/TreeMine.glb",
        placementSystem = null
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

        this.placementSystem =
            placementSystem;


        // --------------------------------------------------------
        // DISTRIBUTION
        // --------------------------------------------------------

        this.distribution =
            new PropDistributionSystem({
                seed: this.seed
            });


        // --------------------------------------------------------
        // CHUNKS
        // --------------------------------------------------------

        this.chunks =
            new Map();


        // --------------------------------------------------------
        // MODEL
        // --------------------------------------------------------

        this.modelMeshes =
            [];


        this.modelReady =
            false;


        this.loader =
            new GLTFLoader();


        // --------------------------------------------------------
        // TEMP OBJECTS
        // --------------------------------------------------------

        this.tempMatrix =
            new THREE.Matrix4();

        this.tempPosition =
            new THREE.Vector3();

        this.tempQuaternion =
            new THREE.Quaternion();

        this.tempScale =
            new THREE.Vector3();


        // --------------------------------------------------------
        // LOAD
        // --------------------------------------------------------

        this.loadModel();

    }


    // ============================================================
    // LOAD TREE MODEL
    // ============================================================

    loadModel() {

        this.loader.load(

            this.modelPath,

            (gltf) => {

                const root =
                    gltf.scene;


                root.updateMatrixWorld(
                    true
                );


                // ------------------------------------------------
                // NORMALIZE MODEL TO GROUND
                // ------------------------------------------------

                const bounds =
                    new THREE.Box3()
                        .setFromObject(root);


                const minY =
                    bounds.min.y;


                root.position.y -=
                    minY;


                root.updateMatrixWorld(
                    true
                );


                // ------------------------------------------------
                // COLLECT MESHES
                // ------------------------------------------------

                root.traverse(
                    (object) => {

                        if (
                            !object.isMesh
                        ) {

                            return;

                        }


                        object.updateMatrixWorld(
                            true
                        );


                        const geometry =
                            object.geometry;


                        let material =
                            object.material;


                        if (
                            !geometry ||
                            !material
                        ) {

                            return;

                        }


                        // ------------------------------------------------
                        // LEAF DETECTION
                        // ------------------------------------------------

                        const isLeaf =
                            this.isLeafMesh(
                                object,
                                material
                            );


                        // ------------------------------------------------
                        // APPLY LEAF SHADER
                        // ------------------------------------------------

                        if (
                            isLeaf
                        ) {

                            material =
                                this.createLeafMaterial(
                                    material
                                );

                        }


                        // ------------------------------------------------
                        // STORE MESH
                        // ------------------------------------------------

                        this.modelMeshes.push({

                            geometry,

                            material,

                            matrix:
                                object.matrixWorld.clone(),

                            isLeaf

                        });

                    }
                );


                this.modelReady =
                    this.modelMeshes.length > 0;


                // ------------------------------------------------
                // BUILD ALREADY LOADED CHUNKS
                // ------------------------------------------------

                if (
                    this.modelReady
                ) {

                    for (
                        const chunk
                        of this.chunks.values()
                    ) {

                        this.buildChunk(
                            chunk
                        );

                    }

                }


                if (this.placementSystem) {
                    this.placementSystem.notifyChanged("tree");
                }

                console.log(
                    `Tree model loaded: ${this.modelMeshes.length} mesh batches`
                );

                console.log(
                    `Leaf shader meshes: ${
                        this.modelMeshes.filter(
                            mesh => mesh.isLeaf
                        ).length
                    }`
                );

            },

            undefined,

            (error) => {

                console.error(
                    "Failed to load tree model:",
                    this.modelPath,
                    error
                );

            }

        );

    }


    // ============================================================
    // DETECT LEAF MESH
    // ============================================================

    isLeafMesh(
        object,
        material
    ) {

        const objectName =
            (
                object.name ||
                ""
            ).toLowerCase();


        const materialName =
            (
                material?.name ||
                ""
            ).toLowerCase();


        const combinedName =
            `${objectName} ${materialName}`;


        return (

            combinedName.includes("leaf") ||

            combinedName.includes("leaves") ||

            combinedName.includes("foliage") ||

            combinedName.includes("foliage") ||

            combinedName.includes("crown")

        );

    }


    // ============================================================
    // CREATE LEAF MATERIAL
    // ============================================================

    createLeafMaterial(
        originalMaterial
    ) {

        console.log(
            "Applying leaf shader to:",
            originalMaterial.name || "unnamed material"
        );


        const leafMaterial =
            applyLeafShader(
                originalMaterial,
                {

                    windStrength:
                        0.28,

                    windSpeed:
                        1.2,

                    windScale:
                        0.8,

                    leafColor:
                        new THREE.Color(
                            0.32,
                            0.72,
                            0.18
                        )

                }
            );


        return leafMaterial;

    }


    // ============================================================
    // DETERMINISTIC RANDOM
    // ============================================================

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


    // ============================================================
    // TREE SURFACE SUITABILITY
    // ============================================================

    getSurfaceSuitability(
        x,
        z,
        terrain
    ) {

        const surface =
            this.surfaceSystem.getSurface(
                x,
                z,
                terrain.worldGenerator
            );


        const weights =
            surface.weights;


        const slopeDegrees =
            THREE.MathUtils.radToDeg(
                surface.slope
            );


        // --------------------------------------------------------
        // TREES PREFER PLAINS
        // --------------------------------------------------------

        if (
            slopeDegrees > 28
        ) {

            return 0.0;

        }


        return THREE.MathUtils.clamp(

            weights.grass * 1.15 +
            weights.dirt * 0.25,

            0.0,
            1.0

        );

    }


    // ============================================================
    // REGISTER CHUNK
    // ============================================================

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


        record.group.position.set(
            0,
            0,
            0
        );


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

            if (this.placementSystem) {
                this.placementSystem.notifyChanged("tree", record.x, record.z);
            }

        }

    }


    // ============================================================
    // BUILD CHUNK
    // ============================================================

    buildChunk(
        chunk
    ) {

        if (this.placementSystem) {
            this.placementSystem.beginChunk("tree", chunk.x, chunk.z);
        }


        // --------------------------------------------------------
        // REMOVE PREVIOUS INSTANCES
        // --------------------------------------------------------

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


        // --------------------------------------------------------
        // TREE POSITIONS
        // --------------------------------------------------------

        const positions = [];


        const spacing =
            4;


        const cellsPerAxis =
            Math.ceil(
                this.chunkSize /
                spacing
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

                const worldX =
                    chunk.x *
                    this.chunkSize +
                    gx * spacing +
                    spacing * 0.5;


                const worldZ =
                    chunk.z *
                    this.chunkSize +
                    gz * spacing +
                    spacing * 0.5;


                // ------------------------------------------------
                // KEEP INSIDE CHUNK
                // ------------------------------------------------

                if (

                    worldX <
                    chunk.x *
                    this.chunkSize ||

                    worldX >=
                    (chunk.x + 1) *
                    this.chunkSize ||

                    worldZ <
                    chunk.z *
                    this.chunkSize ||

                    worldZ >=
                    (chunk.z + 1) *
                    this.chunkSize

                ) {

                    continue;

                }


                // ------------------------------------------------
                // DISTRIBUTION MAP
                // ------------------------------------------------

                const density =
                    this.distribution.getTreeDensity(
                        worldX,
                        worldZ
                    );


                // ------------------------------------------------
                // SURFACE
                // ------------------------------------------------

                const suitability =
                    this.getSurfaceSuitability(
                        worldX,
                        worldZ,
                        chunk.terrain
                    );


                // ------------------------------------------------
                // TREE DENSITY
                // ------------------------------------------------

                const TREE_DENSITY_MULTIPLIER =
                    0.009;


                const probability =
                    THREE.MathUtils.clamp(

                        density *
                        suitability *
                        TREE_DENSITY_MULTIPLIER,

                        0.0,
                        1.0

                    );


                // ------------------------------------------------
                // DETERMINISTIC SPAWN
                // ------------------------------------------------

                const random =
                    this.hash2D(

                        gx +
                        chunk.x * 1000,

                        gz +
                        chunk.z * 1000,

                        this.seed + 7123

                    );


                if (
                    random >
                    probability
                ) {

                    continue;

                }


                // ------------------------------------------------
                // HEIGHT
                // ------------------------------------------------

                const y =
                    chunk.terrain.worldGenerator.getHeight(
                        worldX,
                        worldZ
                    );


                // ------------------------------------------------
                // ROTATION
                // ------------------------------------------------

                const rotation =
                    this.hash2D(

                        gx +
                        chunk.x * 173,

                        gz +
                        chunk.z * 271,

                        this.seed + 8001

                    ) *
                    Math.PI *
                    2.0;


                // ------------------------------------------------
                // RANDOM SIZE
                // ------------------------------------------------

                const scaleRandom =
                    this.hash2D(

                        gx +
                        chunk.x * 421,

                        gz +
                        chunk.z * 613,

                        this.seed + 9001

                    );


                const scale =
                    0.65 +
                    scaleRandom * 0.75;


                if (this.placementSystem) {
                    const placementRadius = THREE.MathUtils.clamp(scale * 2.75, 2.4, 4.0);
                    if (!this.placementSystem.canPlace("tree", worldX, worldZ, placementRadius)) {
                        continue;
                    }
                    this.placementSystem.register(
                        "tree",
                        worldX,
                        worldZ,
                        placementRadius,
                        chunk.x,
                        chunk.z
                    );
                }

                positions.push({

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


        // --------------------------------------------------------
        // NOTHING TO SPAWN
        // --------------------------------------------------------

        if (
            positions.length === 0
        ) {

            return;

        }


        // --------------------------------------------------------
        // CREATE INSTANCED MESHES
        // --------------------------------------------------------

        for (
            const source
            of this.modelMeshes
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
                false;


            mesh.frustumCulled =
                true;

            // mesh.occlusionCulled = true;


            // ----------------------------------------------------
            // INSTANCE TRANSFORMS
            // ----------------------------------------------------

            for (
                let i = 0;
                i < positions.length;
                i++
            ) {

                const tree =
                    positions[i];


                this.tempPosition.set(

                    tree.x,

                    tree.y,

                    tree.z

                );


                this.tempQuaternion.setFromAxisAngle(

                    new THREE.Vector3(
                        0,
                        1,
                        0
                    ),

                    tree.rotation

                );


                this.tempScale.set(

                    tree.scale,
                    tree.scale,
                    tree.scale

                );


                this.tempMatrix.compose(

                    this.tempPosition,

                    this.tempQuaternion,

                    this.tempScale

                );


                // ------------------------------------------------
                // ORIGINAL GLB TRANSFORM
                // ------------------------------------------------

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


            // ----------------------------------------------------
            // ADD
            // ----------------------------------------------------

            chunk.group.add(
                mesh
            );


            chunk.instancedMeshes.push(
                mesh
            );

        }

    }


    // ============================================================
    // UNREGISTER CHUNK
    // ============================================================

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

        if (this.placementSystem) {
            this.placementSystem.unregisterChunk("tree", chunkX, chunkZ);
            this.placementSystem.notifyChanged("tree", chunkX, chunkZ);
        }

    }


    // ============================================================
    // DISPOSE
    // ============================================================

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
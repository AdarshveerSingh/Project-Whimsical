import * as THREE from "three";

import {
    GLTFLoader
} from "../node_modules/three/examples/jsm/loaders/GLTFLoader.js";

import PropDistributionSystem from "./PropDistributionSystem.js";
// ============================================================
// ROCK SYSTEM
// ============================================================

export class RockSystem {

    constructor({

        scene,

        seed = 482917,

        chunkSize = 64,

        modelPath =
            "./models/rocks.glb",

        placementSystem = null

    }) {

        this.scene =
            scene;

        this.seed =
            seed;

        this.chunkSize =
            chunkSize;

        this.modelPath =
            modelPath;

        this.placementSystem =
            placementSystem;


        // ====================================================
        // DISTRIBUTION
        // ====================================================

        this.distribution =
    new PropDistributionSystem({
        seed: this.seed
    });


        // ====================================================
        // CHUNKS
        // ====================================================

        this.chunks =
            new Map();


        // ====================================================
        // ROCK VARIATIONS
        // ====================================================

        this.rockVariations =
            new Map();

        this.variationNames =
            [];


        this.modelReady =
            false;


        // ====================================================
        // LOADER
        // ====================================================

        this.loader =
            new GLTFLoader();


        // ====================================================
        // SETTINGS
        // ====================================================

        // Distance between possible cluster centers.
        this.clusterSpacing =
            12;


        // Maximum number of rocks in one cluster.
        this.maxClusterSize =
            5;


        // Probability multiplier applied
        // to PropDistributionSystem rock density.
        this.clusterProbability =
            0.14;


        // Minimum distance between rocks
        // inside the same cluster.
        this.minRockDistance =
            1.8;


        // Random scale range.
// Target world-space height for spawned rocks.
this.minRockHeight =
    0.50;

this.maxRockHeight =
    10.00;


        // Random rotation.
        this.randomRotation =
            true;


        // ====================================================
        // LOAD
        // ====================================================

        if (this.placementSystem) {
            this.placementSystem.onChanged(
                "tree",
                (_type, chunkX, chunkZ) => {
                    this.rebuildAffectedChunks(chunkX, chunkZ);
                }
            );
        }


        this.loadModel();

    }


    // ========================================================
    // LOAD ROCK MODEL
    // ========================================================

    loadModel() {

        this.loader.load(

            this.modelPath,

            (gltf) => {

                const root =
                    gltf.scene;


                root.updateMatrixWorld(
                    true
                );


                // =================================================
                // FIND ROCK VARIATIONS
                // =================================================

                for (
                    let i = 1;
                    i <= 11;
                    i++
                ) {

                    const name =
                        `SM_Rocks_${String(i).padStart(2, "0")}`;


                    let variation =
                        null;


                    root.traverse(
                        (object) => {

                            if (
                                object.name ===
                                name
                            ) {

                                variation =
                                    object;

                            }

                        }
                    );


                    if (
                        !variation
                    ) {

                        console.warn(
                            `Rock variation not found: ${name}`
                        );

                        continue;
                    }


                    // =================================================
                    // NORMALIZE TO GROUND
                    // =================================================

                    const clone =
                        variation.clone(
                            true
                        );


                    clone.updateMatrixWorld(
                        true
                    );


                    const bounds =
                        new THREE.Box3()
                            .setFromObject(
                                clone
                            );


                    const minY =
                        bounds.min.y;


                    clone.position.y -=
                        minY;


                    clone.updateMatrixWorld(
                        true
                    );

                    const normalizedBounds =
    new THREE.Box3()
        .setFromObject(
            clone
        );

const rockHeight =
    normalizedBounds.max.y -
    normalizedBounds.min.y;

clone.userData.rockHeight =
    rockHeight;
                    // =================================================
                    // SHADOW SETTINGS
                    // =================================================

                    clone.traverse(
                        (object) => {

                            if (
                                !object.isMesh
                            ) {

                                return;
                            }


                            object.castShadow =
                                true;

                            object.receiveShadow =
                                true;

                        }
                    );


                    // =================================================
                    // STORE
                    // =================================================

                    this.rockVariations.set(
                        name,
                        clone
                    );

                    this.variationNames.push(
                        name
                    );

                }


                this.modelReady =
                    this.variationNames.length >
                    0;


                // =================================================
                // BUILD ALREADY REGISTERED CHUNKS
                // =================================================

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
                    this.placementSystem.notifyChanged("rock");
                }

                console.log(
                    `Rock model loaded: ${this.variationNames.length} variations`
                );

            },

            undefined,

            (error) => {

                console.error(
                    "Failed to load rock model:",
                    this.modelPath,
                    error
                );

            }

        );

    }


    // ========================================================
    // DETERMINISTIC RANDOM
    // ========================================================

    hash2D(
        x,
        z,
        seed
    ) {

        let h =
            seed >>> 0;


        h ^=
            Math.imul(
                x,
                374761393
            );


        h ^=
            Math.imul(
                z,
                668265263
            );


        h =
            Math.imul(
                h ^
                (h >>> 13),
                1274126177
            );


        h ^=
            h >>> 16;


        return h >>> 0;

    }


    // ========================================================
    // SEEDED RANDOM
    // ========================================================

    createRandom(
        seed
    ) {

        let state =
            seed >>> 0;


        return function () {

            state +=
                0x6D2B79F5;


            let t =
                state;


            t =
                Math.imul(
                    t ^
                    (t >>> 15),
                    t | 1
                );


            t ^=
                t +
                Math.imul(
                    t ^
                    (t >>> 7),
                    t | 61
                );


            return (
                (t ^
                    (t >>> 14)
                ) >>> 0
            ) /
            4294967296;

        };

    }


    // ========================================================
    // SHUFFLE ARRAY
    // ========================================================

    shuffle(
        array,
        random
    ) {

        for (
            let i =
                array.length - 1;

            i > 0;

            i--
        ) {

            const j =
                Math.floor(
                    random() *
                    (i + 1)
                );


            const temp =
                array[i];


            array[i] =
                array[j];

            array[j] =
                temp;

        }


        return array;

    }


    // ========================================================
    // CREATE VARIATION BAG
    // ========================================================
    //
    // Every rock variation appears once before
    // any variation is reused.
    //
    // This bag belongs to ONE cluster.
    // ========================================================

    createVariationBag(
        random
    ) {

        const bag =
            [];


        for (
            let i = 0;
            i < this.variationNames.length;
            i++
        ) {

            bag.push(i);

        }


        return this.shuffle(
            bag,
            random
        );

    }


    // ========================================================
    // GET ROCK VARIATION
    // ========================================================

    getNextVariation(
        bag,
        random
    ) {

        // If the bag is empty, refill it.
        if (
            bag.length ===
            0
        ) {

            for (
                let i = 0;
                i < this.variationNames.length;
                i++
            ) {

                bag.push(i);

            }


            this.shuffle(
                bag,
                random
            );

        }


        const index =
            bag.pop();


        return this.variationNames[
            index
        ];

    }


    // ========================================================
    // TERRAIN HEIGHT
    // ========================================================

    sampleTerrainHeight(

        localX,
        localZ,

        grid,
        resolution,
        terrainSize

    ) {

        const halfSize =
            terrainSize *
            0.5;


        const normalizedX =
            (
                localX +
                halfSize
            ) /
            terrainSize;


        const normalizedZ =
            (
                localZ +
                halfSize
            ) /
            terrainSize;


        const gx =
            Math.max(
                0,
                Math.min(
                    1,
                    normalizedX
                )
            );


        const gz =
            Math.max(
                0,
                Math.min(
                    1,
                    normalizedZ
                )
            );


        const gridX =
            gx *
            (resolution - 1);


        const gridZ =
            gz *
            (resolution - 1);


        const x0 =
            Math.floor(
                gridX
            );

        const z0 =
            Math.floor(
                gridZ
            );


        const x1 =
            Math.min(
                x0 + 1,
                resolution - 1
            );


        const z1 =
            Math.min(
                z0 + 1,
                resolution - 1
            );


        const tx =
            gridX - x0;

        const tz =
            gridZ - z0;


        const row0 =
            z0 *
            resolution;

        const row1 =
            z1 *
            resolution;


        const h00 =
            grid.data[
                row0 + x0
            ];

        const h10 =
            grid.data[
                row0 + x1
            ];

        const h01 =
            grid.data[
                row1 + x0
            ];

        const h11 =
            grid.data[
                row1 + x1
            ];


        const hx0 =
            h00 +
            (
                h10 - h00
            ) *
            tx;


        const hx1 =
            h01 +
            (
                h11 - h01
            ) *
            tx;


        return (
            hx0 +
            (
                hx1 - hx0
            ) *
            tz
        );

    }


    // ========================================================
    // REGISTER TERRAIN CHUNK
    // ========================================================

    registerTerrainChunk(
        terrainChunk
    ) {

        const key =
            `${terrainChunk.x},${terrainChunk.z}`;


        if (
            this.chunks.has(key)
        ) {

            return;

        }


        const terrain =
            terrainChunk.terrain;


        const grid =
            terrain.getHeightGrid();


        const chunk = {

            x:
                terrainChunk.x,

            z:
                terrainChunk.z,

            worldX:
                terrain.worldOffsetX,

            worldZ:
                terrain.worldOffsetZ,

            size:
                terrain.size,

            grid:
                grid,

            group:
                null

        };


        this.chunks.set(
            key,
            chunk
        );


        // =================================================
        // BUILD IF MODEL READY
        // =================================================

        if (
            this.modelReady
        ) {

            this.buildChunk(
                chunk
            );

            if (this.placementSystem) {
                this.placementSystem.notifyChanged("rock", chunk.x, chunk.z);
            }

        }

    }


    // ========================================================
    // UNREGISTER TERRAIN CHUNK
    // ========================================================

    rebuildAffectedChunks(chunkX, chunkZ) {

        if (chunkX === null || chunkZ === null) {
            for (const chunk of this.chunks.values()) {
                this.buildChunk(chunk);
            }
            return;
        }

        for (const chunk of this.chunks.values()) {
            if (
                Math.abs(chunk.x - chunkX) <= 1 &&
                Math.abs(chunk.z - chunkZ) <= 1
            ) {
                this.buildChunk(chunk);
            }
        }
    }


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


        if (
            chunk.group
        ) {

            this.scene.remove(
                chunk.group
            );


            chunk.group.traverse(
                (object) => {

                    if (
                        object.isMesh
                    ) {

                        if (
                            object.geometry
                        ) {

                            object.geometry =
                                object.geometry;

                        }

                    }

                }
            );

        }


        this.chunks.delete(
            key
        );

        if (this.placementSystem) {
            this.placementSystem.unregisterChunk("rock", chunkX, chunkZ);
            this.placementSystem.notifyChanged("rock", chunkX, chunkZ);
        }

    }


    // ========================================================
    // BUILD CHUNK
    // ========================================================

    buildChunk(
        chunk
    ) {

        if (
            !this.modelReady
        ) {

            return;

        }


        if (this.placementSystem) {
            this.placementSystem.beginChunk("rock", chunk.x, chunk.z);
        }


        // =================================================
        // REMOVE OLD GROUP
        // =================================================

        if (
            chunk.group
        ) {

            this.scene.remove(
                chunk.group
            );

        }


        const group =
            new THREE.Group();


        group.name =
            `RockChunk_${chunk.x}_${chunk.z}`;


        // =================================================
        // DISTRIBUTION SYSTEM
        // =================================================

const distribution =
    this.distribution;


        // =================================================
        // RANDOM
        // =================================================

        const random =
            this.createRandom(

                (
                    this.seed +

                    chunk.x *
                    374761393 +

                    chunk.z *
                    668265263
                ) >>> 0

            );


        // =================================================
        // CLUSTER GRID
        // =================================================

        const clusterCount =
            Math.ceil(
                chunk.size /
                this.clusterSpacing
            );


        // =================================================
        // GENERATE CLUSTERS
        // =================================================

        for (
            let gz = 0;
            gz < clusterCount;
            gz++
        ) {

            for (
                let gx = 0;
                gx < clusterCount;
                gx++
            ) {

                // -----------------------------------------
                // Base local position
                // -----------------------------------------

                const baseX =
                    -chunk.size *
                    0.5 +

                    (
                        gx + 0.5
                    ) *
                    (
                        chunk.size /
                        clusterCount
                    );


                const baseZ =
                    -chunk.size *
                    0.5 +

                    (
                        gz + 0.5
                    ) *
                    (
                        chunk.size /
                        clusterCount
                    );


                // -----------------------------------------
                // Small deterministic jitter
                // -----------------------------------------

                const jitterX =
                    (
                        random() -
                        0.5
                    ) *
                    5;


                const jitterZ =
                    (
                        random() -
                        0.5
                    ) *
                    5;


                const localX =
                    THREE.MathUtils.clamp(

                        baseX +
                        jitterX,

                        -chunk.size * 0.5 + 2,

                        chunk.size * 0.5 - 2

                    );


                const localZ =
                    THREE.MathUtils.clamp(

                        baseZ +
                        jitterZ,

                        -chunk.size * 0.5 + 2,

                        chunk.size * 0.5 - 2

                    );


                // -----------------------------------------
                // WORLD POSITION
                // -----------------------------------------

                const worldX =
                    chunk.worldX +
                    localX;


                const worldZ =
                    chunk.worldZ +
                    localZ;


                // -----------------------------------------
                // ROCK DISTRIBUTION
                // -----------------------------------------

                const density =
                    distribution.getRockDensity(
                        worldX,
                        worldZ
                    );


                // -----------------------------------------
                // SPAWN TEST
                // -----------------------------------------

                const probability =
                    THREE.MathUtils.clamp(

                        density *
                        this.clusterProbability,

                        0,
                        1

                    );


                if (
                    random() >
                    probability
                ) {

                    continue;

                }


                // =================================================
                // CLUSTER SIZE
                // =================================================

                let clusterSize =
                    1;


                if (
                    density >=
                    0.75
                ) {

                    clusterSize =
                        3 +
                        Math.floor(
                            random() *
                            3
                        );

                }

                else if (
                    density >=
                    0.50
                ) {

                    clusterSize =
                        2 +
                        Math.floor(
                            random() *
                            2
                        );

                }

                else if (
                    density >=
                    0.25
                ) {

                    clusterSize =
                        1 +
                        Math.floor(
                            random() *
                            2
                        );

                }


                clusterSize =
                    Math.min(
                        clusterSize,
                        this.maxClusterSize,
                        this.variationNames.length
                    );


                // =================================================
                // VARIATION BAG
                // =================================================
                //
                // New bag for every cluster.
                //
                // This guarantees:
                //
                // Rock 1 != Rock 2
                // Rock 2 != Rock 3
                // ...
                //
                // until all 11 are consumed.
                // =================================================

                const variationBag =
                    this.createVariationBag(
                        random
                    );


                // =================================================
                // CLUSTER ROCKS
                // =================================================

                const placedPositions =
                    [];


                for (
                    let rockIndex = 0;
                    rockIndex < clusterSize;
                    rockIndex++
                ) {

                    // -----------------------------------------
                    // FIND POSITION
                    // -----------------------------------------

                    let rockX =
                        localX;

                    let rockZ =
                        localZ;


                    if (
                        rockIndex > 0
                    ) {

                        let validPosition =
                            false;


                        for (
                            let attempt = 0;
                            attempt < 10;
                            attempt++
                        ) {

                            const angle =
                                random() *
                                Math.PI *
                                2;


                            const distance =
                                this.minRockDistance +
                                random() *
                                4.0;


                            rockX =
                                localX +
                                Math.cos(angle) *
                                distance;


                            rockZ =
                                localZ +
                                Math.sin(angle) *
                                distance;


                            // ---------------------------------
                            // Keep inside chunk
                            // ---------------------------------

                            if (
                                rockX <
                                -chunk.size * 0.5 + 1 ||

                                rockX >
                                chunk.size * 0.5 - 1 ||

                                rockZ <
                                -chunk.size * 0.5 + 1 ||

                                rockZ >
                                chunk.size * 0.5 - 1
                            ) {

                                continue;

                            }


                            // ---------------------------------
                            // Avoid overlap
                            // ---------------------------------

                            validPosition =
                                true;


                            for (
                                const existing
                                of placedPositions
                            ) {

                                const dx =
                                    rockX -
                                    existing.x;


                                const dz =
                                    rockZ -
                                    existing.z;


                                const distanceSquared =
                                    dx * dx +
                                    dz * dz;


                                if (
                                    distanceSquared <
                                    this.minRockDistance *
                                    this.minRockDistance
                                ) {

                                    validPosition =
                                        false;

                                    break;

                                }

                            }


                            if (
                                validPosition
                            ) {

                                break;

                            }

                        }


                        if (
                            !validPosition
                        ) {

                            continue;

                        }

                    }


                    if (this.placementSystem) {
                        const placementRadius = 1.5;
                        if (!this.placementSystem.canPlace(
                            "rock",
                            chunk.worldX + rockX,
                            chunk.worldZ + rockZ,
                            placementRadius
                        )) {
                            continue;
                        }
                        this.placementSystem.register(
                            "rock",
                            chunk.worldX + rockX,
                            chunk.worldZ + rockZ,
                            placementRadius,
                            chunk.x,
                            chunk.z
                        );
                    }

                    placedPositions.push({

                        x:
                            rockX,

                        z:
                            rockZ

                    });


                    // =================================================
                    // TERRAIN HEIGHT
                    // =================================================

                    const terrainY =
                        this.sampleTerrainHeight(

                            rockX,
                            rockZ,

                            chunk.grid,

                            chunk.grid.resolution,
                            chunk.size

                        );


                    // =================================================
                    // GET VARIATION
                    // =================================================

                    const variationName =
                        this.getNextVariation(
                            variationBag,
                            random
                        );


                    const source =
                        this.rockVariations.get(
                            variationName
                        );


                    if (
                        !source
                    ) {

                        continue;

                    }


                    // =================================================
                    // CLONE
                    // =================================================

                    const rock =
                        source.clone(
                            true
                        );


                    rock.name =
                        variationName;


                    // =================================================
                    // POSITION
                    // =================================================

                    rock.position.set(

                        chunk.worldX +
                        rockX,

                        terrainY,

                        chunk.worldZ +
                        rockZ

                    );


                    // =================================================
                    // ROTATION
                    // =================================================

                    if (
                        this.randomRotation
                    ) {

                        rock.rotation.y =
                            random() *
                            Math.PI *
                            2;

                    }


// =================================================
// SCALE TO TARGET WORLD HEIGHT
// =================================================

const targetHeight =
    this.minRockHeight +
    random() *
    (
        this.maxRockHeight -
        this.minRockHeight
    );

const originalHeight =
    source.userData.rockHeight;

const scale =
    originalHeight > 0
        ? targetHeight / originalHeight
        : 1.0;

rock.scale.setScalar(
    scale
);

                    // =================================================
                    // SHADOWS
                    // =================================================

                    rock.traverse(
                        (object) => {

                            if (
                                !object.isMesh
                            ) {

                                return;
                            }


                            object.castShadow =
                                true;

                            object.receiveShadow =
                                true;

                        }
                    );


                    // =================================================
                    // ADD
                    // =================================================

                    group.add(
                        rock
                    );

                }

            }

        }


        // =================================================
        // ADD GROUP TO SCENE
        // =================================================

        this.scene.add(
            group
        );


        chunk.group =
            group;

    }


    // ========================================================
    // RETURN CHUNK
    // ========================================================

    getChunk(
        chunkX,
        chunkZ
    ) {

        return this.chunks.get(
            `${chunkX},${chunkZ}`
        );

    }


    // ========================================================
    // CLEAR ALL ROCKS
    // ========================================================

    clear() {

        for (
            const chunk
            of this.chunks.values()
        ) {

            if (
                chunk.group
            ) {

                this.scene.remove(
                    chunk.group
                );

            }

        }


        this.chunks.clear();

    }

}
import * as THREE from "three";

import {
    applyGrassShader
} from "./GrassShader.js";


export class GrassSystem
    extends THREE.Object3D {


    constructor({

        density = 12000,

        seed = 482917,

        lodNear = 32,

        lodMedium = 64,

        lodFar = 100

    } = {}) {

        super();


        // ==================================================
        // SETTINGS
        // ==================================================

        this.density =
            density;

        this.seed =
            seed;


        this.lodNear =
            lodNear;

        this.lodMedium =
            lodMedium;

        this.lodFar =
            lodFar;


        this.lodNearSquared =
            lodNear *
            lodNear;

        this.lodMediumSquared =
            lodMedium *
            lodMedium;

        this.lodFarSquared =
            lodFar *
            lodFar;


        // ==================================================
        // TERRAIN CHUNKS
        // ==================================================

        this.terrainChunks =
            new Map();


        // ==================================================
        // GRASS CHUNKS
        // ==================================================

        this.chunks =
            new Map();


        // ==================================================
        // GENERATION QUEUE
        // ==================================================

        this.generationQueue =
            [];


        this.generatingChunk =
            null;


        // ==================================================
        // PLAYER
        // ==================================================

        this.playerX =
            0;

        this.playerZ =
            0;


        // ==================================================
        // GEOMETRY
        // ==================================================

        this.createGeometry();


        // ==================================================
        // MATERIAL
        // ==================================================

        this.createMaterial();


        // ==================================================
        // WORKER
        // ==================================================

        this.createWorker();

    }


    // ==================================================
    // GEOMETRY
    // ==================================================

    createGeometry() {

        this.bladeGeometry =
            new THREE.PlaneGeometry(

                0.07,

                0.8,

                1,

                1

            );


        this.bladeGeometry.translate(

            0,

            0.4,

            0

        );
    }


    // ==================================================
    // MATERIAL
    // ==================================================

    createMaterial() {

        const loader =
            new THREE.TextureLoader();


        const texture =
            loader.load(
                "./textures/GrassBlade.png"
            );


        texture.colorSpace =
            THREE.SRGBColorSpace;


        this.grassMaterial =
            new THREE.MeshBasicMaterial({

                map:
                    texture,

                transparent:
                    true,

                alphaTest:
                    0.5,

                side:
                    THREE.DoubleSide,

                fog:
                    true,

                color:
                    0xffffff

            });


        applyGrassShader(

            this.grassMaterial,

            0.35,

            0.12

        );
    }


    // ==================================================
    // WORKER
    // ==================================================

    createWorker() {

        this.worker =
            new Worker(

                new URL(

                    "./GrassWorker.js",

                    import.meta.url

                ),

                {
                    type:
                        "module"
                }

            );


        this.worker.onmessage =
            (event) => {

                const data =
                    event.data;


                if (
                    data.type ===
                    "error"
                ) {

                    console.error(
                        "Grass Worker:",
                        data.message
                    );


                    this.generatingChunk =
                        null;


                    this.startNextGeneration();


                    return;
                }


                if (
                    data.type !==
                    "complete"
                ) {

                    return;
                }


                this.finishGeneration(
                    data
                );
            };


        this.worker.onerror =
            (error) => {

                console.error(
                    "Grass Worker Error:",
                    error
                );


                this.generatingChunk =
                    null;


                this.startNextGeneration();
            };
    }


    // ==================================================
    // TERRAIN CHUNK REGISTRATION
    // ==================================================

    registerTerrainChunk(
        terrainChunk
    ) {

        const key =
            `${terrainChunk.x},${terrainChunk.z}`;


        const terrain =
            terrainChunk.terrain;


        if (
            this.terrainChunks.has(key)
        ) {

            return;
        }


        const grid =
            terrain.getHeightGrid();


        this.terrainChunks.set(

            key,

            {

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
                    grid

            }

        );


        // ==================================================
        // SEND GRID TO WORKER
        // ==================================================

        this.worker.postMessage(

            {

                type:
                    "setTerrainGrid",

                key:
                    key,

                terrainGrid:
                    grid.data,

                gridResolution:
                    grid.resolution,

                terrainSize:
                    grid.size

            },

            [

                grid.data.buffer

            ]

        );


        // ==================================================
        // CREATE GRASS CHUNK
        // ==================================================

        this.queueChunk(

            terrainChunk.x,
            terrainChunk.z

        );
    }


    // ==================================================
    // REMOVE TERRAIN CHUNK
    // ==================================================

    unregisterTerrainChunk(
        chunkX,
        chunkZ
    ) {

        const key =
            `${chunkX},${chunkZ}`;


        const grassChunk =
            this.chunks.get(key);


        if (grassChunk) {

            this.removeGrassChunk(
                grassChunk
            );
        }


        this.terrainChunks.delete(
            key
        );


        this.generationQueue =
            this.generationQueue.filter(

                job =>

                    !(
                        job.x ===
                        chunkX &&

                        job.z ===
                        chunkZ
                    )

            );


        this.worker.postMessage({

            type:
                "removeTerrainGrid",

            key:
                key

        });
    }


    // ==================================================
    // QUEUE CHUNK
    // ==================================================

queueChunk(
    chunkX,
    chunkZ
) {

    const key =
        `${chunkX},${chunkZ}`;


    // Already generated
    if (
        this.chunks.has(key)
    ) {
        return;
    }


    // Already queued
    for (
        const job
        of this.generationQueue
    ) {

        if (
            job.x === chunkX &&
            job.z === chunkZ
        ) {

            return;
        }
    }


    // Already generating
    if (
        this.generatingChunk &&
        this.generatingChunk.x === chunkX &&
        this.generatingChunk.z === chunkZ
    ) {

        return;
    }


    // Terrain must exist
    if (
        !this.terrainChunks.has(key)
    ) {

        return;
    }


    // --------------------------------------------------------
    // NO PLAYER DISTANCE CALCULATION
    // --------------------------------------------------------

    this.generationQueue.push({

        x:
            chunkX,

        z:
            chunkZ

    });


    // FIFO generation
    this.startNextGeneration();
}
    // ==================================================
    // START GENERATION
    // ==================================================

    startNextGeneration() {

        if (
            this.generatingChunk
        ) {

            return;
        }


        if (
            this.generationQueue.length ===
            0
        ) {

            return;
        }


        const job =
            this.generationQueue.shift();


        const key =
            `${job.x},${job.z}`;


        if (
            !this.terrainChunks.has(key)
        ) {

            this.startNextGeneration();

            return;
        }


        this.generatingChunk =
            job;


        this.worker.postMessage({

            type:
                "generate",

            jobId:
                Date.now() +
                Math.random(),

            key:
                key,

            chunkX:
                job.x,

            chunkZ:
                job.z,

            chunkSize:
                this.terrainChunks.get(key).size,

            density:
                this.density,

            seed:
                this.seed,
        });
    }


    // ==================================================
    // FINISH GENERATION
    // ==================================================

    finishGeneration(
        data
    ) {

        const key =
            data.key;


        const terrain =
            this.terrainChunks.get(
                key
            );


        const generating =
            this.generatingChunk;


        if (
            !terrain ||
            !generating
        ) {

            this.generatingChunk =
                null;

            this.startNextGeneration();

            return;
        }


        // ==================================================
        // GEOMETRY
        // ==================================================

        const geometry =
            this.bladeGeometry.clone();


        geometry.setAttribute(

            "instanceCurve",

            new THREE.InstancedBufferAttribute(

                data.curves,

                1

            )

        );


        geometry.setAttribute(

            "instanceDensity",

            new THREE.InstancedBufferAttribute(

                data.randomDensity,

                1

            )

        );


        // ==================================================
        // INSTANCE MESH
        // ==================================================

        const mesh =
            new THREE.InstancedMesh(

                geometry,

                this.grassMaterial,

                data.density

            );


        const matrix =
            new THREE.Matrix4();

        const position =
            new THREE.Vector3();

        const rotation =
            new THREE.Euler();

        const quaternion =
            new THREE.Quaternion();

        const scale =
            new THREE.Vector3();


        // ==================================================
        // MATRICES
        // ==================================================

        for (
            let i = 0;
            i < data.density;
            i++
        ) {

            const p =
                i * 3;


            position.set(

                data.positions[p],

                data.positions[p + 1],

                data.positions[p + 2]

            );


            rotation.set(

                0,

                data.rotations[i],

                0

            );


            quaternion.setFromEuler(
                rotation
            );


            scale.set(

                data.widths[i],

                data.heights[i],

                1

            );


            matrix.compose(

                position,

                quaternion,

                scale

            );


            mesh.setMatrixAt(

                i,

                matrix

            );
        }


        mesh.instanceMatrix.needsUpdate =
            true;


        mesh.castShadow =
            false;

        mesh.receiveShadow =
            false;


        // ==================================================
        // WORLD POSITION
        // ==================================================

        const object =
            new THREE.Object3D();


        object.position.set(

            terrain.worldX,

            0,

            terrain.worldZ

        );


        object.add(
            mesh
        );


        this.add(
            object
        );


        // ==================================================
        // CHUNK DATA
        // ==================================================

        const chunk = {

            object:
                object,

            mesh:
                mesh,

            geometry:
                geometry,

            x:
                data.chunkX,

            z:
                data.chunkZ,

            density:
                data.density,

            currentLOD:
                0

        };


        this.chunks.set(

            key,

            chunk

        );


        this.applyLOD(
            chunk
        );


        this.generatingChunk =
            null;


        this.startNextGeneration();
    }


    // ==================================================
    // GET LOD
    // ==================================================

    getLOD(
        chunk
    ) {

        const terrain =
            this.terrainChunks.get(

                `${chunk.x},${chunk.z}`

            );


        if (!terrain) {

            return 2;
        }


        const dx =
            this.playerX -
            terrain.worldX;

        const dz =
            this.playerZ -
            terrain.worldZ;


        const distanceSquared =
            dx * dx +
            dz * dz;


        if (
            distanceSquared <=
            this.lodNearSquared
        ) {

            return 0;
        }


        if (
            distanceSquared <=
            this.lodMediumSquared
        ) {

            return 1;
        }


        return 2;
    }


    // ==================================================
    // APPLY LOD
    // ==================================================

    applyLOD(
        chunk
    ) {

        const lod =
            this.getLOD(
                chunk
            );


        chunk.currentLOD =
            lod;


        if (
            lod === 0
        ) {

            chunk.mesh.count =
                chunk.density;

            return;
        }


        if (
            lod === 1
        ) {

            chunk.mesh.count =
                Math.max(

                    1,

                    Math.floor(
                        chunk.density *
                        0.5
                    )

                );

            return;
        }


        chunk.mesh.count =
            Math.max(

                1,

                Math.floor(
                    chunk.density *
                    0.25
                )

            );
    }


    // ==================================================
    // UPDATE
    // ==================================================

    update(
        delta,
        playerPosition
    ) {

        // ==================================================
        // WIND
        // ==================================================

        if (

            this.grassMaterial &&

            this.grassMaterial.userData.shader

        ) {

            const shader =
                this.grassMaterial
                    .userData
                    .shader;


            if (
                shader.uniforms.time
            ) {

                shader.uniforms.time.value +=
                    delta;

            }
        }


        if (
            !playerPosition
        ) {

            return;
        }


        this.playerX =
            playerPosition.x;

        this.playerZ =
            playerPosition.z;


        // ==================================================
        // UPDATE LOD
        // ==================================================

        for (
            const chunk
            of this.chunks.values()
        ) {

            const oldLOD =
                chunk.currentLOD;


            const newLOD =
                this.getLOD(
                    chunk
                );


            if (
                oldLOD !==
                newLOD
            ) {

                this.applyLOD(
                    chunk
                );
            }
        }


        // ==================================================
        // QUEUE MISSING TERRAIN CHUNKS
        // ==================================================

        for (
            const terrain
            of this.terrainChunks.values()
        ) {

            const key =
                `${terrain.x},${terrain.z}`;


            if (
                !this.chunks.has(key)
            ) {

                this.queueChunk(
                    terrain.x,
                    terrain.z
                );
            }
        }


        // ==================================================
        // RE-SORT QUEUE
        // ==================================================

        for (
            const job
            of this.generationQueue
        ) {

            const terrain =
                this.terrainChunks.get(

                    `${job.x},${job.z}`

                );


            if (!terrain) {
                continue;
            }


            const dx =
                this.playerX -
                terrain.worldX;

            const dz =
                this.playerZ -
                terrain.worldZ;


            job.distanceSquared =
                dx * dx +
                dz * dz;
        }


        this.generationQueue.sort(

            (a, b) =>

                a.distanceSquared -
                b.distanceSquared

        );


        this.startNextGeneration();
    }


    // ==================================================
    // REMOVE GRASS CHUNK
    // ==================================================

    removeGrassChunk(
        chunk
    ) {

        this.remove(
            chunk.object
        );


        chunk.geometry.dispose();


        const key =
            `${chunk.x},${chunk.z}`;


        this.chunks.delete(
            key
        );
    }


    // ==================================================
    // DISPOSE
    // ==================================================

    dispose() {

        if (
            this.worker
        ) {

            this.worker.terminate();

            this.worker =
                null;
        }


        for (
            const chunk
            of this.chunks.values()
        ) {

            this.remove(
                chunk.object
            );

            chunk.geometry.dispose();
        }


        this.chunks.clear();


        this.terrainChunks.clear();


        this.generationQueue.length =
            0;


        this.generatingChunk =
            null;


        this.bladeGeometry.dispose();


        this.grassMaterial.dispose();
    }
}
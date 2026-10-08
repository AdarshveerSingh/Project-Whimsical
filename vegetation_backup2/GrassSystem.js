import * as THREE from "three";

import {
    applyGrassShader
} from "./GrassShader.js";

import {
    PlacementRegistry
} from "../world/PlacementRegistry.js";

export class GrassSystem
    extends THREE.Object3D {


    constructor({

        density = 12000,

        seed = 482917,

        lodNear = 32,

        lodMedium = 64,

        lodFar = 100,

        placementRegistry = null

    } = {}) {

        super();


        // ==================================================
        // SETTINGS
        // ==================================================

        this.density =
            density;

        this.seed =
            seed;

        this.placementRegistry =
    placementRegistry;
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
            new THREE.MeshLambertMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
    fog: true,
    color: 0xffffff
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

    const terrainGridCopy =
    new Float32Array(
        grid.data
    );


const grassWeightGridCopy =
    new Float32Array(
        grid.grassWeightData
    );


const dirtWeightGridCopy =
    new Float32Array(
        grid.dirtWeightData
    );


const gravelWeightGridCopy =
    new Float32Array(
        grid.gravelWeightData
    );


const rockWeightGridCopy =
    new Float32Array(
        grid.rockWeightData
    );

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
                grid,

            propDistributionSystem:
                terrain.propDistributionSystem

        }

    );


    // ==================================================
    // SEND TERRAIN GRID TO WORKER
    // ==================================================
this.worker.postMessage(

    {

        type:
            "setTerrainGrid",

        key:
            key,

        terrainGrid:
            terrainGridCopy,

        grassWeightGrid:
            grassWeightGridCopy,

        dirtWeightGrid:
            dirtWeightGridCopy,

        gravelWeightGrid:
            gravelWeightGridCopy,

        rockWeightGrid:
            rockWeightGridCopy,

        gridResolution:
            grid.resolution,

        terrainSize:
            grid.size

    },

    [

        terrainGridCopy.buffer,

        grassWeightGridCopy.buffer,

        dirtWeightGridCopy.buffer,

        gravelWeightGridCopy.buffer,

        rockWeightGridCopy.buffer

    ]

);
    // ==================================================
    // QUEUE GRASS GENERATION
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


        const terrain =
            this.terrainChunks.get(key);


        this.generatingChunk =
            job;


        // ==================================================
        // GRASS DISTRIBUTION
        // ==================================================

        const distributionResolution =
            32;

        const distributionSize =
            distributionResolution + 1;

        const grassDistribution =
            new Float32Array(
                distributionSize *
                distributionSize
            );


        const propDistribution =
            terrain.propDistributionSystem;


        const chunkSize =
            terrain.size;

        const halfChunk =
            chunkSize * 0.5;


        for (
            let z = 0;
            z < distributionSize;
            z++
        ) {

            for (
                let x = 0;
                x < distributionSize;
                x++
            ) {

                const localX =
                    (x / distributionResolution) *
                    chunkSize -
                    halfChunk;

                const localZ =
                    (z / distributionResolution) *
                    chunkSize -
                    halfChunk;


                const worldX =
                    terrain.worldX +
                    localX;

                const worldZ =
                    terrain.worldZ +
                    localZ;


                grassDistribution[
                    z * distributionSize + x
                ] =
                    propDistribution.getGrassDensity(
                        worldX,
                        worldZ
                    );

            }
        }


        // ==================================================
        // SEND TO WORKER
        // ==================================================

        const jobId =
            Date.now() +
            Math.random();


        this.worker.postMessage(

            {

                type:
                    "generate",

                jobId,

                key,

                chunkX:
                    job.x,

                chunkZ:
                    job.z,

                chunkSize,

                density:
                    this.density,

                seed:
                    this.seed,

                grassDistribution,

                distributionResolution

            },

            [

                grassDistribution.buffer

            ]

        );
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
// PLACEMENT EXCLUSION
// ==================================================

if (this.placementRegistry) {

    const acceptedPositions = [];

    for (let i = 0; i < data.density; i++) {

        const p = i * 3;

        const localX =
            data.positions[p];

        const localZ =
            data.positions[p + 2];

        const worldX =
            terrain.worldX + localX;

        const worldZ =
            terrain.worldZ + localZ;

        const blocked =
            this.placementRegistry.isBlocked(
                worldX,
                worldZ,
                0.15,
                ["tree", "rock", "bush"]
            );

        if (!blocked) {
            acceptedPositions.push(i);
        }
    }

    // Rebuild arrays using only accepted grass blades
    const filteredPositions =
        new Float32Array(
            acceptedPositions.length * 3
        );

    const filteredRotations =
        new Float32Array(
            acceptedPositions.length
        );

    const filteredWidths =
        new Float32Array(
            acceptedPositions.length
        );

    const filteredHeights =
        new Float32Array(
            acceptedPositions.length
        );

    const filteredCurves =
        new Float32Array(
            acceptedPositions.length
        );

    const filteredTiltX =
        new Float32Array(
            acceptedPositions.length
        );

    const filteredTiltZ =
        new Float32Array(
            acceptedPositions.length
        );

    const filteredColorVariation =
        new Float32Array(
            acceptedPositions.length
        );

    const filteredRandomDensity =
        new Float32Array(
            acceptedPositions.length
        );

    for (
        let i = 0;
        i < acceptedPositions.length;
        i++
    ) {

        const source =
            acceptedPositions[i];

        const sourceP =
            source * 3;

        const targetP =
            i * 3;

        filteredPositions[targetP] =
            data.positions[sourceP];

        filteredPositions[targetP + 1] =
            data.positions[sourceP + 1];

        filteredPositions[targetP + 2] =
            data.positions[sourceP + 2];

        filteredRotations[i] =
            data.rotations[source];

        filteredWidths[i] =
            data.widths[source];

        filteredHeights[i] =
            data.heights[source];

        filteredCurves[i] =
            data.curves[source];

        filteredTiltX[i] =
            data.tiltX[source];

        filteredTiltZ[i] =
            data.tiltZ[source];

        filteredColorVariation[i] =
            data.colorVariation[source];

        filteredRandomDensity[i] =
            data.randomDensity[source];
    }

    data.positions =
        filteredPositions;

    data.rotations =
        filteredRotations;

    data.widths =
        filteredWidths;

    data.heights =
        filteredHeights;

    data.curves =
        filteredCurves;

    data.tiltX =
        filteredTiltX;

    data.tiltZ =
        filteredTiltZ;

    data.colorVariation =
        filteredColorVariation;

    data.randomDensity =
        filteredRandomDensity;

    data.density =
        acceptedPositions.length;
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


        // geometry.setAttribute(

        //     "instanceTiltX",

        //     new THREE.InstancedBufferAttribute(
        //         data.tiltX,
        //         1
        //     )

        // );


        // geometry.setAttribute(

        //     "instanceTiltZ",

        //     new THREE.InstancedBufferAttribute(
        //         data.tiltZ,
        //         1
        //     )

        // );


        geometry.setAttribute(

            "instanceColorVariation",

            new THREE.InstancedBufferAttribute(

                data.colorVariation,

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

                data.tiltX[i],

                data.rotations[i],

                data.tiltZ[i]

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
            true;


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
                        0.25
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
import { TerrainSystem } from "./TerrainSystem.js";
import { BiomeSystem } from "./BiomeSystem.js";
import { GrassSystem } from "../vegetation/GrassSystem.js";
import { TreeSystem } from "./TreeSystem.js";
import { RockSystem } from "./RockSystem.js";
import { FlowerSystem } from "./FlowerSystem.js";
import { BushSystem } from "./BushSystem.js";
import { TerrainWorkerPool } from "./TerrainWorkerPool.js";

export class ChunkManager {

    constructor({

        scene,
        sun,
        player,

        grassSystem = null,
        surfaceSystem = null,
        treeSystem = null,
        rockSystem = null,
        flowerSystem = null,
        bushSystem = null,
        chunkSize = 64,

        viewDistance = 3,

        baseHeight = 0.0,
        maxHeight = 14.2,
        heightScale = 6.0,
        seed = 482917

    }) {

        this.scene =
            scene;

        this.sun = sun;

        this.player =
            player;

        this.grassSystem =
            grassSystem;

        this.surfaceSystem =
            surfaceSystem;

        this.treeSystem =
            treeSystem;
        this.rockSystem =
            rockSystem;
        this.flowerSystem =
            flowerSystem;
        this.bushSystem =
            bushSystem;
        // ==================================================
        // VEGETATION DEBUG TOGGLES
        // ==================================================

        this.vegetationEnabled = {

            grass: true,

            trees: true,

            rocks: true,

            flowers: true,

            bushes: true

        };
        this.chunkSize =
            chunkSize;

        this.viewDistance =
            viewDistance;

        this.baseHeight =
            baseHeight;

        this.maxHeight =
            maxHeight;
        this.heightScale = heightScale;
        this.seed =
            seed;


        // ==================================================
        // BIOME SYSTEM
        // ==================================================

        this.biomeSystem =
            new BiomeSystem({

                seed:
                    this.seed

            });


        // ==================================================
        // TERRAIN LOD
        // ==================================================

        /*
        *
        * LOD 0 = highest quality
        * LOD 1 = medium
        * LOD 2 = lowest
        *
        */

        this.lodResolutions = [

            32,
            16,
            8

        ];


        // ==================================================
        // CHUNKS
        // ==================================================

        this.chunks =
            new Map();


        // ==================================================
        // CURRENT PLAYER CHUNK
        // ==================================================

        this.currentChunkX =
            null;

        this.currentChunkZ =
            null;

        this.terrainWorkerPool =
            new TerrainWorkerPool({
                workerCount: 2
            });
        this.loadQueue = [];
        this.loadQueued = new Set();

    }


    // ==================================================
    // CHUNK KEY
    // ==================================================

    getChunkKey(
        x,
        z
    ) {

        return `${x},${z}`;
    }


    // ==================================================
    // WORLD → CHUNK
    // ==================================================

    worldToChunk(
        x,
        z
    ) {

        return {

            x:
                Math.floor(
                    x /
                    this.chunkSize
                ),

            z:
                Math.floor(
                    z /
                    this.chunkSize
                )

        };
    }

processLoadQueue(budget = 1) {

    if (this.currentChunkX === null || this.loadQueue.length === 0) return;

    for (const job of this.loadQueue) {
        job.distance = this.getChunkDistance(
            job.chunkX, job.chunkZ,
            this.currentChunkX, this.currentChunkZ
        );
    }
    this.loadQueue.sort((a, b) => a.distance - b.distance);

    while (budget-- > 0 && this.loadQueue.length) {
        const job = this.loadQueue.shift();
        this.loadQueued.delete(job.key);

        if (job.distance > this.viewDistance) continue;

        this.loadChunk(job.chunkX, job.chunkZ, job.lod = this.getLOD(job.distance));
    }
}
    // ==================================================
    // CHUNK DISTANCE
    // ==================================================

    getChunkDistance(
        chunkX,
        chunkZ,
        playerChunkX,
        playerChunkZ
    ) {

        /*
        * Chebyshev distance.
        *
        * This creates square rings.
        */

        return Math.max(

            Math.abs(
                chunkX -
                playerChunkX
            ),

            Math.abs(
                chunkZ -
                playerChunkZ
            )

        );
    }


    // ==================================================
    // GET TERRAIN LOD
    // ==================================================

    getLOD(
        distance
    ) {

        if (
            distance <= 1
        ) {

            return 0;
        }


        if (
            distance <= 2
        ) {

            return 1;
        }


        return 2;
    }


    // ==================================================
    // GET RESOLUTION
    // ==================================================

    getResolution(
        lod
    ) {

        return this.lodResolutions[
            lod
        ];
    }


    // ==================================================
    // LOAD CHUNK
    // ==================================================

    loadChunk(
        chunkX,
        chunkZ,
        lod
    ) {


        const key =
            this.getChunkKey(
                chunkX,
                chunkZ
            );


        // ==================================================
        // ALREADY LOADED
        // ==================================================

        if (
            this.chunks.has(
                key
            )
        ) {

            return;

        }


        // ==================================================
        // WORLD POSITION
        // ==================================================

        const worldX =
            chunkX *
            this.chunkSize;

        const worldZ =
            chunkZ *
            this.chunkSize;


        // ==================================================
        // TERRAIN RESOLUTION
        // ==================================================

        const resolution =
            this.getResolution(
                lod
            );


        // ==================================================
        // TERRAIN
        // ==================================================


        const terrain =
            new TerrainSystem({

                scene:
                    this.scene,

                size:
                    this.chunkSize,

                resolution:
                    resolution,

                baseHeight:
                    this.baseHeight,

                maxHeight:
                    this.maxHeight,

                heightScale:
                    this.heightScale,

                seed:
                    this.seed,

                worldOffsetX:
                    worldX,

                worldOffsetZ:
                    worldZ,

                surfaceSystem:
                    this.surfaceSystem,

                terrainWorkerPool:
                    this.terrainWorkerPool,

                onTerrainReady: (readyTerrain) => {

    const currentChunk =
        this.chunks.get(key);

    if (!currentChunk) {
        return;
    }

    if (currentChunk.terrain !== readyTerrain) {
        return;
    }

    const biome =
        this.biomeSystem.getBiome(
            worldX,
            worldZ,
            readyTerrain
        );

    // GRASS
    if (
        this.grassSystem &&
        this.vegetationEnabled.grass
    ) {
        this.grassSystem.registerTerrainChunk(
            currentChunk
        );
    }

    // TREES
    if (
        this.treeSystem &&
        this.vegetationEnabled.trees
    ) {
        this.treeSystem.registerTerrainChunk(
            currentChunk
        );
    }

    // ROCKS
    if (
        this.rockSystem &&
        this.vegetationEnabled.rocks
    ) {
        this.rockSystem.registerTerrainChunk(
            currentChunk
        );
    }

    // FLOWERS
    if (
        this.flowerSystem &&
        this.vegetationEnabled.flowers
    ) {
        this.flowerSystem.registerTerrainChunk(
            currentChunk
        );
    }

    // BUSHES
    if (
        this.bushSystem &&
        this.vegetationEnabled.bushes
    ) {
        this.bushSystem.registerTerrainChunk(
            currentChunk
        );
    }
},

                sun:
                    this.sun

            });



        // ==================================================
        // CHUNK OBJECT
        // ==================================================

        const chunk = {

            x:
                chunkX,

            z:
                chunkZ,

            lod:
                lod,

            terrain:
                terrain

        };


        // ==================================================
        // STORE CHUNK
        // ==================================================

        this.chunks.set(
            key,
            chunk
        );


    }
    // updateShadowUniforms() {

    //     for (const chunk of this.chunks.values()) {

    //         if (
    //             chunk.terrain &&
    //             chunk.terrain.updateShadowUniforms
    //         ) {
    //             chunk.terrain.updateShadowUniforms();
    //         }
    //     }
    // }
    // ==================================================
    // UPDATE CHUNK LOD
    // ==================================================

    updateChunkLOD(
        chunk,
        newLOD
    ) {

        if (
            chunk.lod ===
            newLOD
        ) {

            return;
        }


        // ==================================================
        // OLD RESOLUTION
        // ==================================================

        const oldResolution =
            this.getResolution(
                chunk.lod
            );


        // ==================================================
        // NEW LOD
        // ==================================================

        chunk.lod =
            newLOD;


        const resolution =
            this.getResolution(
                newLOD
            );


        // ==================================================
        // TERRAIN
        // ==================================================

        chunk.terrain.setResolution(
            resolution
        );


        // ==================================================
        // GRASS
        // ==================================================

        /*
        *
        * Grass does not need to be regenerated here.
        *
        * Its terrain height function is continuous
        * and deterministic, so the existing grass
        * positions remain valid.
        *
        * Grass has its own visual LOD.
        *
        */

    }


    // ==================================================
    // UNLOAD CHUNK
    // ==================================================

    unloadChunk(
        chunkX,
        chunkZ
    ) {

        const key =
            this.getChunkKey(
                chunkX,
                chunkZ
            );


        const chunk =
            this.chunks.get(
                key
            );


        if (!chunk) {

            return;
        }


        // ==================================================
        // GRASS
        // ==================================================

        if (
            this.grassSystem
        ) {

            this.grassSystem.unregisterTerrainChunk(

                chunkX,
                chunkZ

            );

        }
        if (
            this.treeSystem
        ) {

            this.treeSystem.unregisterTerrainChunk(
                chunkX,
                chunkZ
            );

        }
        if (
            this.rockSystem
        ) {

            this.rockSystem.unregisterTerrainChunk(
                chunkX,
                chunkZ
            );

        }
        if (
            this.flowerSystem
        ) {

            this.flowerSystem.unregisterTerrainChunk(
                chunkX,
                chunkZ
            );

        }
        if (
            this.bushSystem
        ) {

            this.bushSystem.unregisterTerrainChunk(
                chunkX,
                chunkZ
            );

        }
        // ==================================================
        // TERRAIN
        // ==================================================

        chunk.terrain.dispose();


        // ==================================================
        // REMOVE CHUNK
        // ==================================================

        this.chunks.delete(
            key
        );


    }


    // ==================================================
    // UPDATE
    // ==================================================

    update() {


        const playerPosition =
            this.player.getPosition();


        const playerChunk =
            this.worldToChunk(

                playerPosition.x,

                playerPosition.z

            );
           this.processLoadQueue()
            
        // ==================================================
        // PLAYER STILL IN SAME CHUNK
        // ==================================================

        if (

            playerChunk.x ===
            this.currentChunkX &&

            playerChunk.z ===
            this.currentChunkZ

        ) {

            return;
        }


        // ==================================================
        // UPDATE CURRENT CHUNK
        // ==================================================

        this.currentChunkX =
            playerChunk.x;

        this.currentChunkZ =
            playerChunk.z;


        const requiredChunks =
            new Set();


        // ==================================================
        // LOAD REQUIRED CHUNKS
        // ==================================================

        for (

            let z =
                -this.viewDistance;

            z <=
            this.viewDistance;

            z++

        ) {

            for (

                let x =
                    -this.viewDistance;

                x <=
                this.viewDistance;

                x++

            ) {

                const chunkX =
                    playerChunk.x +
                    x;

                const chunkZ =
                    playerChunk.z +
                    z;


                // ==================================================
                // DISTANCE
                // ==================================================

                const distance =
                    this.getChunkDistance(

                        chunkX,

                        chunkZ,

                        playerChunk.x,

                        playerChunk.z

                    );


                // ==================================================
                // LOD
                // ==================================================

                const lod =
                    this.getLOD(
                        distance
                    );


                // ==================================================
                // KEY
                // ==================================================

                const key =
                    this.getChunkKey(

                        chunkX,

                        chunkZ

                    );


                requiredChunks.add(
                    key
                );


                // ==================================================
                // LOAD
                // ==================================================

                if (
                    !this.chunks.has(
                        key
                    )
                ) {

                    if (!this.chunks.has(key) && !this.loadQueued.has(key)) {
    this.loadQueued.add(key);
    this.loadQueue.push({ chunkX, chunkZ, lod, key, distance });
}

                }

                // ==================================================
                // UPDATE LOD
                // ==================================================

                else {

                    const chunk =
                        this.chunks.get(
                            key
                        );


                    this.updateChunkLOD(

                        chunk,

                        lod

                    );

                }

            }

        }


        // ==================================================
        // UNLOAD DISTANT CHUNKS
        // ==================================================

        for (
            const chunk
            of this.chunks.values()
        ) {

            const key =
                this.getChunkKey(

                    chunk.x,

                    chunk.z

                );


            if (
                !requiredChunks.has(
                    key
                )
            ) {

                this.unloadChunk(

                    chunk.x,

                    chunk.z

                );

            }

        }


    }




    // ==================================================
    // TERRAIN HEIGHT
    // ==================================================

    getHeight(
        x,
        z
    ) {

        const chunk =
            this.worldToChunk(

                x,
                z

            );


        const key =
            this.getChunkKey(

                chunk.x,

                chunk.z

            );


        const loadedChunk =
            this.chunks.get(
                key
            );


        /*
        * If the requested terrain chunk is not
        * loaded, use the base height.
        */

        if (
            !loadedChunk
        ) {

            return this.baseHeight;
        }


        return loadedChunk.terrain.getHeight(

            x,

            z

        );

    }


    // ==================================================
    // GET CHUNK
    // ==================================================

    getChunk(
        chunkX,
        chunkZ
    ) {

        return this.chunks.get(

            this.getChunkKey(
                chunkX,
                chunkZ
            )

        );

    }


    // ==================================================
    // GET BIOME SYSTEM
    // ==================================================

    getBiomeSystem() {

        return this.biomeSystem;

    }


    // ==================================================
    // DEBUG INFORMATION
    // ==================================================

    getLoadedChunkCount() {

        return this.chunks.size;

    }

    // ==================================================
    // DEBUG MAPS
    // ==================================================

    generateDisplacementMap(
        chunkX = 0,
        chunkZ = 0,
        resolution = 512
    ) {

        const chunk =
            this.getChunk(
                chunkX,
                chunkZ
            );

        if (!chunk) {

            console.warn(
                `Chunk ${chunkX}, ${chunkZ} is not loaded.`
            );

            return null;
        }

        return chunk.terrain.generateDisplacementMap(
            resolution
        );
    }


    // ==================================================
    // SURFACE MAP
    // ==================================================

    generateSurfaceMap(
        chunkX = 0,
        chunkZ = 0,
        resolution = 512
    ) {

        const chunk =
            this.getChunk(
                chunkX,
                chunkZ
            );

        if (!chunk) {

            console.warn(
                `Chunk ${chunkX}, ${chunkZ} is not loaded.`
            );

            return null;
        }

        return chunk.terrain.generateSurfaceMap(
            resolution
        );
    }
    
    // ==================================================
    // VEGETATION DEBUG CONTROL
    // ==================================================

    setVegetationEnabled(
        type,
        enabled
    ) {

        if (
            !Object.prototype.hasOwnProperty.call(
                this.vegetationEnabled,
                type
            )
        ) {

            console.warn(
                `Unknown vegetation type: ${type}`
            );

            return;

        }

        this.vegetationEnabled[type] =
            enabled;

        const systemMap = {

            grass:
                this.grassSystem,

            trees:
                this.treeSystem,

            rocks:
                this.rockSystem,

            flowers:
                this.flowerSystem,

            bushes:
                this.bushSystem

        };

        const system =
            systemMap[type];

        if (!system) {

            return;

        }


        // --------------------------------------------------
        // DESPAWN
        // --------------------------------------------------

        if (!enabled) {

            for (
                const chunk
                of this.chunks.values()
            ) {

                system.unregisterTerrainChunk(
                    chunk.x,
                    chunk.z
                );

            }

            return;

        }


        // --------------------------------------------------
        // RESPAWN
        // --------------------------------------------------

        for (
            const chunk
            of this.chunks.values()
        ) {

            system.registerTerrainChunk(
                chunk
            );

        }

    }
    // ==================================================
    // TOGGLE ALL VEGETATION
    // ==================================================

    setAllVegetationEnabled(
        enabled
    ) {

        const types = [

            "grass",
            "trees",
            "rocks",
            "flowers",
            "bushes"

        ];

        for (
            const type
            of types
        ) {

            this.setVegetationEnabled(
                type,
                enabled
            );

        }

    }
    // ==================================================
    // DISPOSE
    // ==================================================

 dispose() {
    if (this.disposed) return;
    this.disposed = true;

    console.log("Chunks before shutdown:", this.chunks.size);

    for (const chunk of this.chunks.values()) {
        const { x, z, terrain } = chunk;

        this.grassSystem?.unregisterTerrainChunk(x, z);
        this.treeSystem?.unregisterTerrainChunk(x, z);
        this.rockSystem?.unregisterTerrainChunk(x, z);
        this.flowerSystem?.unregisterTerrainChunk(x, z);
        this.bushSystem?.unregisterTerrainChunk(x, z);

        terrain.dispose();
    }

    this.chunks.clear();
    this.loadQueue.length = 0;
    this.loadQueued.clear();

    // Terminate workers and reject pending terrain jobs.
    this.terrainWorkerPool.dispose();

    console.log("Chunks after shutdown:", this.chunks.size);
    console.log(
        "Worker pool disposed:",
        this.terrainWorkerPool.disposed
    );
}

}
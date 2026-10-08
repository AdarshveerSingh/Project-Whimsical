import * as THREE from "three";

import {
    applyGrassShader
} from "./GrassShader.js";


// ============================================================
// CONSTANTS
// ============================================================

// Fraction of blades drawn per tier
const MID_FRACTION = 0.25;
const FAR_FRACTION = 0.15;

// Added to every cell bounding sphere so wind bending and blade
// height can never push grass outside it (which would cause
// culling while the grass is still on screen).
const BOUNDS_MARGIN = 2.5;

// Placement registry types that grass must avoid
const BLOCKING_TYPES = ["tree", "rock", "bush"];

// Per-blade instance attributes shared by the three tiers
const INSTANCE_ATTRIBUTES = [
    "instanceCurve",
    "instanceColorVariation",
    "instanceDensity"
];

// Grass itself is treated as a tiny footprint when
// determining the exclusion boundary.
const GRASS_EXCLUSION_RADIUS = 0.15;

// 64 world units / 128 intervals = 0.5 world-unit
// spatial resolution.
//
// This is deliberately finer than the existing
// distribution grid so tree/rock/bush boundaries
// do not become obvious square holes.
const EXCLUSION_FIELD_RESOLUTION = 128;


function sampleExclusionField(
    field,
    worldX,
    worldZ
) {

    if (!field) {
        return 0;
    }

    const resolution =
        field.resolution;

    const gridSize =
        resolution + 1;

    const fx =
        (
            worldX -
            field.minX
        ) /
        field.step;

    const fz =
        (
            worldZ -
            field.minZ
        ) /
        field.step;

    if (
        fx < 0 ||
        fz < 0 ||
        fx > resolution ||
        fz > resolution
    ) {

        return 0;

    }

    const x0 =
        Math.min(
            resolution - 1,
            Math.max(
                0,
                Math.floor(fx)
            )
        );

    const z0 =
        Math.min(
            resolution - 1,
            Math.max(
                0,
                Math.floor(fz)
            )
        );

    const x1 =
        Math.min(
            resolution,
            x0 + 1
        );

    const z1 =
        Math.min(
            resolution,
            z0 + 1
        );

    const tx =
        fx - x0;

    const tz =
        fz - z0;

    const i00 =
        z0 * gridSize + x0;

    const i10 =
        z0 * gridSize + x1;

    const i01 =
        z1 * gridSize + x0;

    const i11 =
        z1 * gridSize + x1;

    const top =
        field.data[i00] +
        (
            field.data[i10] -
            field.data[i00]
        ) * tx;

    const bottom =
        field.data[i01] +
        (
            field.data[i11] -
            field.data[i01]
        ) * tx;

    return (
        top +
        (
            bottom -
            top
        ) * tz
    );

}
export class GrassSystem
    extends THREE.Object3D {


    constructor({

        density = 12000,

        seed = 482917,

        // Distances are measured to the NEAREST EDGE of a cell
        //   0 .. lodNear    : detailed blades (near mesh)
        //   lodNear .. lodMedium : medium planes (mid mesh)
        //   lodMedium .. lodFar  : wide planes (far mesh)
        //   beyond lodFar   : hidden
        lodNear = 32,
        lodMedium = 64,
        lodFar = 1000,

        // Extra distance before a cell switches tier again
        lodHysteresis = 4,

        // Each chunk is split into cellsPerAxis x cellsPerAxis cells,
        // each with its own meshes and bounding sphere.
        cellsPerAxis = 4,

        // Grid resolution of the density map sampled on the main thread
        distributionResolution = 32,

        placementRegistry = null,

        // Draws a wireframe sphere per cell:
        // green = near, yellow = mid, red = far
        debug = false

    } = {}) {

        super();

        // ==================================================
        // SETTINGS
        // ==================================================

        this.density = density;
        this.seed = seed;
        this.placementRegistry = placementRegistry;

        this.lodNear = lodNear;
        this.lodMedium = lodMedium;
        this.lodFar = lodFar;

        this.lodThresholds = [lodNear, lodMedium, lodFar];
        this.lodHysteresis = lodHysteresis;
        this.lodTimer = 0;

        this.cellsPerAxis = cellsPerAxis;
        this.distributionResolution = distributionResolution;
        this.debug = debug;

        // ==================================================
        // STATE
        // ==================================================

        this.terrainChunks = new Map();
        this.chunks = new Map();

        this.generationQueue = [];
        this.queuedKeys = new Set();
        this.generatingChunk = null;
        this.nextJobId = 1;

        this.playerX = 0;
        this.playerZ = 0;

        // ==================================================
        // GPU RESOURCES + WORKER
        // ==================================================

        this.createGeometry();
        this.createMaterial();
        this.createDebugResources();
        this.createWorker();
    }


    // ==================================================
    // GEOMETRY
    // ==================================================

    createGeometry() {

        // Near: thin blade (textured, alpha tested)
        this.bladeGeometry =
            new THREE.PlaneGeometry(0.07, 0.8, 1, 1);

        this.bladeGeometry.translate(0, 0.4, 0);

        // Mid: wider plane, same height as a blade so the
        // root-to-tip gradient lines up with the near mesh
        this.midBladeGeometry =
            new THREE.PlaneGeometry(0.18, 0.8, 1, 1);

        this.midBladeGeometry.translate(0, 0.4, 0);

        // Far: widest plane
        this.farBladeGeometry =
            new THREE.PlaneGeometry(0.28, 0.8, 1, 1);

        this.farBladeGeometry.translate(0, 0.4, 0);
    }


    // ==================================================
    // MATERIAL
    // ==================================================

    createMaterial() {

        const loader = new THREE.TextureLoader();

        const texture =
            loader.load("./textures/GrassBlade.png");

        texture.colorSpace = THREE.SRGBColorSpace;

        // ---------------- NEAR ----------------

        this.grassMaterial =
            new THREE.MeshLambertMaterial({
                map: texture,
                transparent: true,
                alphaTest: 0.5,
                side: THREE.DoubleSide,
                fog: false,
                color: 0xffffff
            });

        applyGrassShader(this.grassMaterial, 0.35, 0.12);

        this.grassMaterial.customProgramCacheKey =
            () => "grass-near";

        // ---------------- MID ----------------

        this.midMaterial =
            new THREE.MeshLambertMaterial({
                side: THREE.FrontSide,
                fog: true,
                color: 0xffffff
            });

        applyGrassShader(this.midMaterial, 0.35, 0.12, {
            animateWind: false
        });

        this.midMaterial.customProgramCacheKey =
            () => "grass-mid";

        // ---------------- FAR ----------------

        this.farMaterial =
            new THREE.MeshLambertMaterial({
                side: THREE.FrontSide,
                fog: true,
                color: 0xffffff
            });

        applyGrassShader(this.farMaterial, 0.35, 0.12, {
            animateWind: false
        });

        this.farMaterial.customProgramCacheKey =
            () => "grass-far";
    }


    // ==================================================
    // DEBUG RESOURCES
    // ==================================================

    createDebugResources() {

        if (!this.debug) {
            return;
        }

        this.debugGeometry = new THREE.SphereGeometry(1, 12, 8);

        const make = (color) =>
            new THREE.MeshBasicMaterial({
                color,
                wireframe: true,
                transparent: true,
                opacity: 0.6,
                depthTest: false
            });

        // index = LOD (0 near, 1 mid, 2 far)
        this.debugMaterials = [
            make(0x00ff00),
            make(0xffff00),
            make(0xff0000)
        ];
    }


    // ==================================================
    // WORKER
    // ==================================================

    createWorker() {

        this.worker = new Worker(
            new URL("./GrassWorker.js", import.meta.url),
            { type: "module" }
        );

        this.worker.onmessage = (event) => {

            const data = event.data;

            if (data.type === "error") {

                console.error("Grass Worker:", data.message);

                this.generatingChunk = null;
                this.startNextGeneration();

                return;
            }

            if (data.type !== "complete") {
                return;
            }

            this.finishGeneration(data);
        };

        this.worker.onerror = (error) => {

            console.error("Grass Worker Error:", error);

            this.generatingChunk = null;
            this.startNextGeneration();
        };
    }


    // ==================================================
    // TERRAIN CHUNK REGISTRATION
    // ==================================================

    registerTerrainChunk(terrainChunk) {

        const key = `${terrainChunk.x},${terrainChunk.z}`;

        if (this.terrainChunks.has(key)) {
            return;
        }

        const terrain = terrainChunk.terrain;
        const grid = terrain.getHeightGrid();

        // Terrain not ready yet
        if (!grid || !grid.data || !grid.grassWeightData) {
            return;
        }

        // The worker only needs height + grass weight
        const heightCopy = new Float32Array(grid.data);
        const grassCopy = new Float32Array(grid.grassWeightData);

        this.terrainChunks.set(key, {
            x: terrainChunk.x,
            z: terrainChunk.z,
            worldX: terrain.worldOffsetX,
            worldZ: terrain.worldOffsetZ,
            size: terrain.size,
            propDistributionSystem: terrain.propDistributionSystem
        });

        this.worker.postMessage(
            {
                type: "setTerrainGrid",
                key,
                terrainGrid: heightCopy,
                grassWeightGrid: grassCopy,
                gridResolution: grid.resolution,
                terrainSize: grid.size
            },
            [
                heightCopy.buffer,
                grassCopy.buffer
            ]
        );

        this.queueChunk(terrainChunk.x, terrainChunk.z);
    }


    // ==================================================
    // REMOVE TERRAIN CHUNK
    // ==================================================

    unregisterTerrainChunk(chunkX, chunkZ) {

        const key = `${chunkX},${chunkZ}`;

        const grassChunk = this.chunks.get(key);

        if (grassChunk) {
            this.removeGrassChunk(grassChunk);
        }

        if (this.queuedKeys.delete(key)) {

            this.generationQueue =
                this.generationQueue.filter(
                    job => job.key !== key
                );
        }

        this.terrainChunks.delete(key);

        if (this.worker) {

            this.worker.postMessage({
                type: "removeTerrainGrid",
                key
            });
        }
    }


    // ==================================================
    // QUEUE CHUNK
    // ==================================================

    queueChunk(chunkX, chunkZ) {

        const key = `${chunkX},${chunkZ}`;

        if (
            this.chunks.has(key) ||
            this.queuedKeys.has(key)
        ) {
            return;
        }

        if (
            this.generatingChunk &&
            this.generatingChunk.key === key
        ) {
            return;
        }

        if (!this.terrainChunks.has(key)) {
            return;
        }

        this.generationQueue.push({
            x: chunkX,
            z: chunkZ,
            key
        });

        this.queuedKeys.add(key);

        this.startNextGeneration();
    }


    // ==================================================
    // START GENERATION
    // ==================================================

    startNextGeneration() {

        if (
            this.generatingChunk ||
            this.generationQueue.length === 0
        ) {
            return;
        }

        // Pick the queued chunk nearest to the player
        let bestIndex = 0;
        let bestDistance = Infinity;

        for (let i = 0; i < this.generationQueue.length; i++) {

            const t = this.terrainChunks.get(
                this.generationQueue[i].key
            );

            if (!t) {
                continue;
            }

            const dx = this.playerX - t.worldX;
            const dz = this.playerZ - t.worldZ;
            const d = dx * dx + dz * dz;

            if (d < bestDistance) {
                bestDistance = d;
                bestIndex = i;
            }
        }

        const job = this.generationQueue.splice(bestIndex, 1)[0];

        this.queuedKeys.delete(job.key);

        const terrain = this.terrainChunks.get(job.key);

        if (!terrain) {
            this.startNextGeneration();
            return;
        }

        this.generatingChunk = job;


        // --------------------------------------------------
        // GRASS DISTRIBUTION (needs main-thread systems)
        // --------------------------------------------------

        const resolution = this.distributionResolution;
        const size = resolution + 1;

        const distribution = new Float32Array(size * size);

        const propDistribution = terrain.propDistributionSystem;
        const chunkSize = terrain.size;
        const halfChunk = chunkSize * 0.5;

        for (let z = 0; z < size; z++) {

            const worldZ =
                terrain.worldZ +
                (z / resolution) * chunkSize -
                halfChunk;

            for (let x = 0; x < size; x++) {

                const worldX =
                    terrain.worldX +
                    (x / resolution) * chunkSize -
                    halfChunk;

                distribution[z * size + x] =
                    propDistribution.getGrassDensity(
                        worldX,
                        worldZ
                    );
            }
        }


        // --------------------------------------------------
        // SEND TO WORKER
        // --------------------------------------------------

        this.worker.postMessage(
            {
                type: "generate",
                jobId: this.nextJobId++,
                key: job.key,
                chunkX: job.x,
                chunkZ: job.z,
                chunkSize,
                density: this.density,
                seed: this.seed,
                grassDistribution: distribution,
                distributionResolution: resolution,
                cellsPerAxis: this.cellsPerAxis
            },
            [distribution.buffer]
        );
    }


    // ==================================================
    // FINISH GENERATION
    // ==================================================

    finishGeneration(data) {

        const key = data.key;
        const terrain = this.terrainChunks.get(key);

        // Skip stale results (chunk unloaded or already built)
        if (
            terrain &&
            !this.chunks.has(key) &&
            data.density > 0
        ) {
            this.buildChunk(key, terrain, data);
        }

        this.generatingChunk = null;
        this.startNextGeneration();
    }


    // ==================================================
    // BUILD CHUNK
    // ==================================================
    //
    // One object per chunk, three InstancedMeshes (near / mid /
    // far) per CELL. Every cell has its own bounding sphere,
    // computed from the real blade positions, so frustum culling
    // works per cell.
    //

    buildChunk(key, terrain, data) {

        const matrices = data.matrices;
        const curves = data.curves;
        const colorVariation = data.colorVariation;
        const randomDensity = data.randomDensity;
        const cellCounts = data.cellCounts;

        const registry = this.placementRegistry;

        const cells = data.cellsPerAxis;
        const cellTotal = cells * cells;
        const cellSize = terrain.size / cells;
        const half = terrain.size * 0.5;

        // --------------------------------------------------
        // BUILD EXCLUSION FIELD
        // --------------------------------------------------

        const exclusionField =
            registry
                ? registry.buildExclusionField({

                    minX:
                        terrain.worldX -
                        half,

                    minZ:
                        terrain.worldZ -
                        half,

                    size:
                        terrain.size,

                    resolution:
                        EXCLUSION_FIELD_RESOLUTION,

                    blockedTypes:
                        BLOCKING_TYPES,

                    radiusPadding:
                        GRASS_EXCLUSION_RADIUS

                })
                : null;


        // --------------------------------------------------
        // PLACEMENT EXCLUSION + BOUNDS (single pass per cell)
        // --------------------------------------------------
        //
        // Blades arrive sorted by cell. Compaction preserves
        // that order; `written` never passes `read`, so
        // overwriting in place is safe.
        //

        const cellStart = new Uint32Array(cellTotal);
        const cellCount = new Uint32Array(cellTotal);

        const minX = new Float32Array(cellTotal).fill(Infinity);
        const minY = new Float32Array(cellTotal).fill(Infinity);
        const minZ = new Float32Array(cellTotal).fill(Infinity);
        const maxX = new Float32Array(cellTotal).fill(-Infinity);
        const maxY = new Float32Array(cellTotal).fill(-Infinity);
        const maxZ = new Float32Array(cellTotal).fill(-Infinity);

        let written = 0;
        let read = 0;

        for (let c = 0; c < cellTotal; c++) {

            cellStart[c] = written;

            const end = read + cellCounts[c];

            for (; read < end; read++) {

                const o = read * 16;

                if (
                    exclusionField &&
                    sampleExclusionField(
                        exclusionField,
                        terrain.worldX + matrices[o + 12],
                        terrain.worldZ + matrices[o + 14]
                    ) > 0.0
                ) {

                    continue;

                }
                if (written !== read) {

                    matrices.copyWithin(written * 16, o, o + 16);

                    curves[written] = curves[read];
                    colorVariation[written] = colorVariation[read];
                    randomDensity[written] = randomDensity[read];
                }

                const w = written * 16;

                const x = matrices[w + 12];
                const y = matrices[w + 13];
                const z = matrices[w + 14];

                if (x < minX[c]) minX[c] = x;
                if (x > maxX[c]) maxX[c] = x;
                if (y < minY[c]) minY[c] = y;
                if (y > maxY[c]) maxY[c] = y;
                if (z < minZ[c]) minZ[c] = z;
                if (z > maxZ[c]) maxZ[c] = z;

                written++;
            }

            cellCount[c] = written - cellStart[c];
        }

        // Nothing left: skip the chunk entirely
        if (written === 0) {
            return;
        }


        // --------------------------------------------------
        // CHUNK OBJECT
        // --------------------------------------------------

        const object = new THREE.Object3D();

        object.position.set(terrain.worldX, 0, terrain.worldZ);
        object.matrixAutoUpdate = false;
        object.updateMatrix();

        const cellList = [];

        for (let c = 0; c < cellTotal; c++) {

            const n = cellCount[c];

            if (n === 0) {
                continue;
            }

            const s = cellStart[c];

            // Geometric cell center (chunk-local), used for LOD
            const localX = -half + ((c % cells) + 0.5) * cellSize;
            const localZ = -half + (((c / cells) | 0) + 0.5) * cellSize;


            // ----------------------------------------------
            // BOUNDING SPHERE FROM REAL BLADE POSITIONS
            // ----------------------------------------------

            const center = new THREE.Vector3(
                (minX[c] + maxX[c]) * 0.5,
                (minY[c] + maxY[c]) * 0.5,
                (minZ[c] + maxZ[c]) * 0.5
            );

            const radius =
                0.5 * Math.hypot(
                    maxX[c] - minX[c],
                    maxY[c] - minY[c],
                    maxZ[c] - minZ[c]
                ) + BOUNDS_MARGIN;

            const sphere = new THREE.Sphere(center, radius);


            // ----------------------------------------------
            // NEAR GEOMETRY + MESH
            // ----------------------------------------------

            const geometry = this.bladeGeometry.clone();

            geometry.setAttribute(
                "instanceCurve",
                new THREE.InstancedBufferAttribute(
                    curves.slice(s, s + n), 1
                )
            );

            geometry.setAttribute(
                "instanceColorVariation",
                new THREE.InstancedBufferAttribute(
                    colorVariation.slice(s, s + n), 1
                )
            );

            geometry.setAttribute(
                "instanceDensity",
                new THREE.InstancedBufferAttribute(
                    randomDensity.slice(s, s + n), 1
                )
            );

            const mesh = new THREE.InstancedMesh(
                geometry,
                this.grassMaterial,
                n
            );

            mesh.instanceMatrix.array.set(
                matrices.subarray(s * 16, (s + n) * 16)
            );

            mesh.instanceMatrix.needsUpdate = true;


            // ----------------------------------------------
            // MID + FAR (share matrices and instance attributes)
            // ----------------------------------------------

            const midGeometry = this.midBladeGeometry.clone();
            const farGeometry = this.farBladeGeometry.clone();

            for (const name of INSTANCE_ATTRIBUTES) {

                const attribute = geometry.getAttribute(name);

                midGeometry.setAttribute(name, attribute);
                farGeometry.setAttribute(name, attribute);
            }

            const midMesh = new THREE.InstancedMesh(
                midGeometry,
                this.midMaterial,
                n
            );

            const farMesh = new THREE.InstancedMesh(
                farGeometry,
                this.farMaterial,
                n
            );

            midMesh.instanceMatrix = mesh.instanceMatrix;
            farMesh.instanceMatrix = mesh.instanceMatrix;


            // ----------------------------------------------
            // COMMON MESH SETTINGS
            // ----------------------------------------------

            for (const m of [mesh, midMesh, farMesh]) {

                m.boundingSphere = sphere;      // shared, never mutated
                m.castShadow = false;
                m.receiveShadow = true;
                m.matrixAutoUpdate = false;
                m.visible = false;              // applyLOD enables one

                object.add(m);
            }


            // ----------------------------------------------
            // CELL RECORD
            // ----------------------------------------------

            const cell = {
                mesh,
                midMesh,
                farMesh,
                geometry,
                midGeometry,
                farGeometry,
                density: n,
                currentLOD: -1,
                localX,
                localZ,
                helper: null
            };

            if (this.debug) {

                const helper = new THREE.Mesh(
                    this.debugGeometry,
                    this.debugMaterials[0]
                );

                helper.position.copy(center);
                helper.scale.setScalar(radius);
                helper.visible = false;

                object.add(helper);

                cell.helper = helper;
            }

            cellList.push(cell);

            this.applyLOD(
                cell,
                this.computeLOD(
                    this.getCellDistance(cell, terrain),
                    0,
                    0
                )
            );
        }

        this.add(object);

        this.chunks.set(key, {
            object,
            cells: cellList,
            x: data.chunkX,
            z: data.chunkZ,
            density: written
        });
    }


    // ==================================================
    // LOD
    // ==================================================

    getCellDistance(cell, terrain) {

        const half = (terrain.size / this.cellsPerAxis) * 0.5;

        const dx = Math.max(
            Math.abs(this.playerX - (terrain.worldX + cell.localX)) - half,
            0
        );

        const dz = Math.max(
            Math.abs(this.playerZ - (terrain.worldZ + cell.localZ)) - half,
            0
        );

        return Math.hypot(dx, dz);
    }


    computeLOD(distance, current, hysteresis) {

        const t = this.lodThresholds;

        let lod = current;

        while (lod < t.length && distance > t[lod] + hysteresis) {
            lod++;
        }

        while (lod > 0 && distance < t[lod - 1] - hysteresis) {
            lod--;
        }

        return lod;
    }


    applyLOD(cell, lod) {

        cell.currentLOD = lod;

        cell.mesh.visible = false;
        cell.midMesh.visible = false;
        cell.farMesh.visible = false;

        // Beyond lodFar: hide the cell
        if (lod >= 3) {

            if (cell.helper) {
                cell.helper.visible = false;
            }

            return;
        }

        if (lod === 2) {

            cell.farMesh.count = Math.max(
                1,
                Math.floor(cell.density * FAR_FRACTION)
            );

            cell.farMesh.visible = true;

        } else if (lod === 1) {

            cell.midMesh.count = Math.max(
                1,
                Math.floor(cell.density * MID_FRACTION)
            );

            cell.midMesh.visible = true;

        } else {

            cell.mesh.count = cell.density;
            cell.mesh.visible = true;
        }

        if (cell.helper) {
            cell.helper.material = this.debugMaterials[lod];
            cell.helper.visible = true;
        }
    }


    // Number of cells per LOD tier: [near, mid, far, hidden]
    getLODCounts() {

        const counts = [0, 0, 0, 0];

        for (const chunk of this.chunks.values()) {
            for (const cell of chunk.cells) {
                counts[cell.currentLOD]++;
            }
        }

        return counts;
    }


    // ==================================================
    // UPDATE
    // ==================================================

    update(delta, playerPosition) {

        // --------------------------------------------------
        // WIND (near mesh only)
        // --------------------------------------------------

        const shader = this.grassMaterial.userData.shader;

        if (shader && shader.uniforms.time) {
            shader.uniforms.time.value += delta;
        }

        if (!playerPosition) {
            return;
        }

        this.playerX = playerPosition.x;
        this.playerZ = playerPosition.z;

        // --------------------------------------------------
        // LOD (10 times per second is plenty)
        // --------------------------------------------------

        this.lodTimer += delta;

        if (this.lodTimer < 0.1) {
            return;
        }

        this.lodTimer = 0;

        for (const chunk of this.chunks.values()) {

            const terrain = this.terrainChunks.get(
                `${chunk.x},${chunk.z}`
            );

            if (!terrain) {
                continue;
            }

            for (const cell of chunk.cells) {

                const lod = this.computeLOD(
                    this.getCellDistance(cell, terrain),
                    cell.currentLOD,
                    this.lodHysteresis
                );

                if (lod !== cell.currentLOD) {
                    this.applyLOD(cell, lod);
                }
            }
        }
    }


    // ==================================================
    // REMOVE GRASS CHUNK
    // ==================================================

    removeGrassChunk(chunk) {

        this.remove(chunk.object);

        this.disposeCells(chunk);

        this.chunks.delete(`${chunk.x},${chunk.z}`);
    }


    disposeCells(chunk) {

        // Materials are shared by every chunk: never dispose them here
        for (const cell of chunk.cells) {

            cell.mesh.dispose();
            cell.midMesh.dispose();
            cell.farMesh.dispose();

            cell.geometry.dispose();
            cell.midGeometry.dispose();
            cell.farGeometry.dispose();
        }
    }


    // ==================================================
    // DISPOSE
    // ==================================================

    dispose() {

        if (this.worker) {

            this.worker.terminate();
            this.worker = null;
        }

        for (const chunk of this.chunks.values()) {

            this.remove(chunk.object);
            this.disposeCells(chunk);
        }

        this.chunks.clear();
        this.terrainChunks.clear();

        this.generationQueue.length = 0;
        this.queuedKeys.clear();
        this.generatingChunk = null;

        this.bladeGeometry.dispose();
        this.midBladeGeometry.dispose();
        this.farBladeGeometry.dispose();

        this.grassMaterial.dispose();
        this.midMaterial.dispose();
        this.farMaterial.dispose();

        if (this.debug) {

            this.debugGeometry.dispose();

            for (const material of this.debugMaterials) {
                material.dispose();
            }
        }
    }
}
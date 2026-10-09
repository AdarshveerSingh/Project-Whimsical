import * as THREE from "three";

import {
    GLTFLoader
} from "../node_modules/three/examples/jsm/loaders/GLTFLoader.js";

import PropDistributionSystem from "./PropDistributionSystem.js";

import { applyShadowOnly } from "../rendering/ShadowOnly.js";

import { buildMergedGeometry } from "../tools/FlowerMerge.js";


export class FlowerSystem {

    constructor({

        scene,

        surfaceSystem = null,

        seed = 482917,

        chunkSize = 64,

        modelPath = "./models/flowers.glb",

        // Flower chunks farther than this (distance to the nearest
        // chunk edge) are hidden.
        hideDistance = 90,

        // How many chunks may be built per frame
        buildsPerFrame = 1

    } = {}) {

        this.scene = scene;
        this.surfaceSystem = surfaceSystem;
        this.seed = seed;
        this.chunkSize = chunkSize;
        this.modelPath = modelPath;

        this.hideDistance = hideDistance;
        this.buildsPerFrame = buildsPerFrame;

        // ==================================================
        // DISTRIBUTION
        // ==================================================

        this.distribution =
            new PropDistributionSystem({ seed: this.seed });

        // ==================================================
        // STATE
        // ==================================================

        this.chunks = new Map();
        this.buildQueue = [];
        this.cullTimer = 0;

        this.flowerModels = new Map();
        this.flowerMaterial = null;
        this.modelReady = false;

        this.loader = new GLTFLoader();

        // ==================================================
        // SETTINGS
        // ==================================================

        this.spacing = 2.0;
        this.flowerDensityMultiplier = 0.07;

        this.minScale = 0.45;
        this.maxScale = 0.55;

        // Clusters
        this.clusterMin = 3;
        this.clusterMax = 7;
        this.clusterRadius = 2.0;

        // ==================================================
        // LOAD MODEL
        // ==================================================

        this.loadModel();
    }


    // ==================================================
    // FLOWER WIND SHADER
    // ==================================================
    //
    // Vertices are baked in world space and the mesh sits at the
    // origin, so `position` is the world position.
    //

    applyWindShader(material) {

        material.onBeforeCompile = (shader) => {

            shader.uniforms.time = { value: 0 };

            shader.vertexShader = shader.vertexShader.replace(
                "#include <common>",
                `
                #include <common>

                uniform float time;

                attribute float flowerHeight01;
                `
            );

            shader.vertexShader = shader.vertexShader.replace(
                "#include <project_vertex>",
                `
                #include <project_vertex>

                // Root stays still, the upper part sways
                float upperPart = smoothstep(
                    0.30,
                    0.65,
                    flowerHeight01
                );

                float bend = upperPart * upperPart;

                float phase =
                    position.x * 0.08 +
                    position.z * 0.06;

                float largeWind = sin(time * 2.2 + phase);
                float smallWind = sin(time * 4.0 + phase * 1.7);

                float wind =
                    largeWind * 0.75 +
                    smallWind * 0.25;

                vec3 windOffset = vec3(
                    wind * 0.32 * bend,
                    0.0,
                    wind * 0.11 * bend
                );

                mvPosition.xyz += (
                    modelViewMatrix * vec4(windOffset, 0.0)
                ).xyz;

                gl_Position = projectionMatrix * mvPosition;
                `
            );

            material.userData.flowerWind = shader;
        };

        material.customProgramCacheKey = () => "merged-flower-wind-v2";
        material.needsUpdate = true;
    }


    // ==================================================
    // LOAD FLOWER GLB
    // ==================================================

    loadModel() {

        this.loader.load(

            this.modelPath,

            (gltf) => {

                const root = gltf.scene;

                root.updateMatrixWorld(true);

                root.traverse((object) => {

                    if (!object.isMesh) {
                        return;
                    }

                    const match = object.name.match(/^Flower_(0[1-9])$/);

                    if (!match) {
                        return;
                    }

                    const variation = match[1];
                    const sourceMaterial = object.material;

                    // All nine variations share one atlas and material
                    if (!this.flowerMaterial) {

                        this.flowerMaterial = new THREE.MeshLambertMaterial({
                            map: sourceMaterial.map || null,

                            color: sourceMaterial.color
                                ? sourceMaterial.color.clone()
                                : new THREE.Color(0xffffff),

                            transparent: false,
                            alphaTest: 0.5,
                            depthTest: true,
                            depthWrite: true,
                            side: THREE.DoubleSide
                        });

                        this.applyWindShader(this.flowerMaterial);
                        applyShadowOnly(this.flowerMaterial, 0.45);
                    }

                    this.flowerModels.set(variation, {
                        geometry: object.geometry,
                        matrix: object.matrixWorld.clone(),
                        template: null      // filled lazily by FlowerMerge
                    });
                });

                if (this.flowerModels.size === 0) {

                    console.warn(
                        "FlowerSystem: No Flower_01 ... Flower_09 meshes found."
                    );

                    return;
                }

                this.modelReady = true;

                console.log(
                    `FlowerSystem: Loaded ${this.flowerModels.size} flower variations.`
                );

                // Build already registered chunks over the next frames
                for (const chunk of this.chunks.values()) {
                    this.queueBuild(chunk);
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

    hash2D(x, z) {

        let h = Math.imul(x | 0, 374761393);

        h = Math.imul(
            h ^ Math.imul(z | 0, 668265263),
            1274126177
        );

        h ^= h >>> 13;
        h = Math.imul(h, 1274126177);
        h ^= h >>> 16;

        return (h >>> 0) / 4294967296;
    }


    // ==================================================
    // SURFACE SUITABILITY
    // ==================================================

    getSurfaceSuitability(x, z, worldGenerator) {

        if (!this.surfaceSystem) {
            return 1.0;
        }

        const surface =
            this.surfaceSystem.getSurface(x, z, worldGenerator);

        // Flowers prefer relatively flat ground
        const slopeDegrees =
            surface.slopeDegrees ??
            THREE.MathUtils.radToDeg(surface.slope);

        if (slopeDegrees > 35) {
            return 0.0;
        }

        const grass = surface.weights.grass || 0;
        const dirt = surface.weights.dirt || 0;

        return THREE.MathUtils.clamp(
            grass * 1.20 + dirt * 0.15,
            0.0,
            1.0
        );
    }


    // ==================================================
    // HEIGHT FROM THE TERRAIN GRID (4 array reads, no noise)
    // ==================================================

    sampleGridHeight(grid, localX, localZ, size) {

        const n = grid.resolution;
        const max = n - 1;

        const gx = THREE.MathUtils.clamp(localX / size + 0.5, 0, 1) * max;
        const gz = THREE.MathUtils.clamp(localZ / size + 0.5, 0, 1) * max;

        const x0 = Math.floor(gx);
        const z0 = Math.floor(gz);
        const x1 = Math.min(x0 + 1, max);
        const z1 = Math.min(z0 + 1, max);

        const tx = gx - x0;
        const tz = gz - z0;

        const d = grid.data;

        const h00 = d[z0 * n + x0];
        const h10 = d[z0 * n + x1];
        const h01 = d[z1 * n + x0];
        const h11 = d[z1 * n + x1];

        const a = h00 + (h10 - h00) * tx;
        const b = h01 + (h11 - h01) * tx;

        return a + (b - a) * tz;
    }


    // ==================================================
    // REGISTER CHUNK
    // ==================================================

    registerTerrainChunk(terrainChunk) {

        const key = `${terrainChunk.x},${terrainChunk.z}`;

        if (this.chunks.has(key)) {
            return;
        }

        const group = new THREE.Group();

        group.name = `Flowers_${key}`;

        this.scene.add(group);

        const chunk = {
            x: terrainChunk.x,
            z: terrainChunk.z,
            terrain: terrainChunk,
            terrainSystem: terrainChunk.terrain,
            group,
            mesh: null,
            queued: false,
            removed: false
        };

        this.chunks.set(key, chunk);

        if (this.modelReady) {
            this.queueBuild(chunk);
        }
    }


    // ==================================================
    // BUILD QUEUE
    // ==================================================

    queueBuild(chunk) {

        if (chunk.queued || chunk.removed) {
            return;
        }

        chunk.queued = true;

        this.buildQueue.push(chunk);
    }


    // Nearest queued chunk first
    takeNextChunk(playerPosition) {

        if (!playerPosition) {
            return this.buildQueue.shift();
        }

        let best = 0;
        let bestDistance = Infinity;

        for (let i = 0; i < this.buildQueue.length; i++) {

            const c = this.buildQueue[i];

            const dx = playerPosition.x - c.x * this.chunkSize;
            const dz = playerPosition.z - c.z * this.chunkSize;
            const d = dx * dx + dz * dz;

            if (d < bestDistance) {
                bestDistance = d;
                best = i;
            }
        }

        return this.buildQueue.splice(best, 1)[0];
    }


    // ==================================================
    // BUILD CHUNK
    // ==================================================

    buildChunk(chunk) {

        if (!this.modelReady || chunk.removed) {
            return;
        }

        const terrainSystem = chunk.terrainSystem;
        const grid = terrainSystem.getHeightGrid();

        // Terrain data not available (yet)
        if (!grid) {
            return;
        }

        const worldGenerator = terrainSystem.worldGenerator;

        // Remove the previous mesh when rebuilding
        if (chunk.mesh) {

            chunk.group.remove(chunk.mesh);
            chunk.mesh.geometry.dispose();
            chunk.mesh = null;
        }

        // ==================================================
        // GRID
        // ==================================================

        const cellsPerAxis = Math.ceil(this.chunkSize / this.spacing);

        const positionsByFlower = new Map();

        for (let i = 1; i <= 9; i++) {
            positionsByFlower.set(`0${i}`, []);
        }

        let lastFlower = -1;

        // ==================================================
        // SAMPLE GRID
        // ==================================================

        for (let gx = 0; gx < cellsPerAxis; gx++) {

            for (let gz = 0; gz < cellsPerAxis; gz++) {

                const localX =
                    gx * this.spacing +
                    this.spacing * 0.5 -
                    this.chunkSize * 0.5;

                const localZ =
                    gz * this.spacing +
                    this.spacing * 0.5 -
                    this.chunkSize * 0.5;

                const worldX = chunk.x * this.chunkSize + localX;
                const worldZ = chunk.z * this.chunkSize + localZ;


                // ----------------------------------------------
                // CHEAP REJECTIONS FIRST
                // ----------------------------------------------

                const density =
                    this.distribution.getFlowerDensity(worldX, worldZ);

                if (density <= 0) {
                    continue;
                }

                // Suitability is at most 1, so the final probability can
                // never exceed density * multiplier. Rejecting here gives
                // the same result and skips the expensive surface lookup
                // for most cells.
                const random = this.hash2D(
                    Math.floor(worldX * 100) + this.seed,
                    Math.floor(worldZ * 100) + this.seed * 7
                );

                if (random > density * this.flowerDensityMultiplier) {
                    continue;
                }

                const grassDensity =
                    this.distribution.getGrassDensity(worldX, worldZ);

                const grassAffinity = THREE.MathUtils.smoothstep(
                    grassDensity,
                    0.18,
                    0.50
                );

                if (grassAffinity <= 0.01) {
                    continue;
                }


                // ----------------------------------------------
                // SURFACE (expensive, only for survivors)
                // ----------------------------------------------

                const suitability = this.getSurfaceSuitability(
                    worldX,
                    worldZ,
                    worldGenerator
                );

                if (suitability <= 0) {
                    continue;
                }

                const probability = THREE.MathUtils.clamp(
                    density * suitability * this.flowerDensityMultiplier,
                    0.0,
                    1.0
                );

                if (random > probability) {
                    continue;
                }


                // ----------------------------------------------
                // CLUSTER
                // ----------------------------------------------

                const clusterRandom = this.hash2D(
                    Math.floor(worldX * 37) + this.seed * 41,
                    Math.floor(worldZ * 37) + this.seed * 43
                );

                const clusterCount =
                    this.clusterMin +
                    Math.floor(
                        clusterRandom *
                        (this.clusterMax - this.clusterMin + 1)
                    );

                for (
                    let clusterIndex = 0;
                    clusterIndex < clusterCount;
                    clusterIndex++
                ) {

                    const randomA = this.hash2D(
                        Math.floor(worldX * 100) + this.seed * 47 + clusterIndex * 101,
                        Math.floor(worldZ * 100) + this.seed * 53 + clusterIndex * 137
                    );

                    const randomB = this.hash2D(
                        Math.floor(worldX * 100) + this.seed * 59 + clusterIndex * 149,
                        Math.floor(worldZ * 100) + this.seed * 61 + clusterIndex * 173
                    );

                    // Position inside the cluster (sqrt = even disc)
                    const angle = randomA * Math.PI * 2;
                    const radius = Math.sqrt(randomB) * this.clusterRadius;

                    const flowerX = worldX + Math.cos(angle) * radius;
                    const flowerZ = worldZ + Math.sin(angle) * radius;

                    // Variation, avoiding immediate repetition
                    let variation = Math.floor(
                        this.hash2D(
                            Math.floor(flowerX * 50) + this.seed * 13 + clusterIndex * 17,
                            Math.floor(flowerZ * 50) + this.seed * 19 + clusterIndex * 23
                        ) * 9
                    );

                    if (variation === lastFlower) {
                        variation =
                            (variation + 1 + Math.floor(randomA * 8)) % 9;
                    }

                    lastFlower = variation;

                    const flowerName = `0${variation + 1}`;

                    // Terrain height from the grid
                    const flowerY = this.sampleGridHeight(
                        grid,
                        flowerX - terrainSystem.worldOffsetX,
                        flowerZ - terrainSystem.worldOffsetZ,
                        terrainSystem.size
                    );

                    const rotation =
                        this.hash2D(
                            Math.floor(flowerX * 30) + this.seed * 67 + clusterIndex * 71,
                            Math.floor(flowerZ * 30) + this.seed * 73 + clusterIndex * 79
                        ) *
                        Math.PI *
                        2;

                    const scaleRandom = this.hash2D(
                        Math.floor(flowerX * 40) + this.seed * 83 + clusterIndex * 89,
                        Math.floor(flowerZ * 40) + this.seed * 97 + clusterIndex * 103
                    );

                    const scale = THREE.MathUtils.lerp(
                        this.minScale,
                        this.maxScale,
                        scaleRandom
                    );

                    positionsByFlower.get(flowerName).push({
                        x: flowerX,
                        y: flowerY,
                        z: flowerZ,
                        rotation,
                        scale
                    });
                }
            }
        }


        // ==================================================
        // MERGE ALL FLOWERS OF THE CHUNK INTO ONE MESH
        // ==================================================

        const geometry = buildMergedGeometry(
            this.flowerModels,
            positionsByFlower
        );

        if (!geometry) {
            return;
        }

        geometry.computeBoundingSphere();

        // Margin so wind sway can't push flowers outside the sphere
        geometry.boundingSphere.radius += 0.5;

        const mesh = new THREE.Mesh(geometry, this.flowerMaterial);

        mesh.name = `Flowers_${chunk.x},${chunk.z}`;
        mesh.castShadow = false;
        mesh.receiveShadow = true;

        // Static: positions are baked in world space
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();

        chunk.group.add(mesh);
        chunk.mesh = mesh;
    }


    // ==================================================
    // UPDATE
    // ==================================================
    //
    // Call every frame: flowerSystem.update(delta, playerPosition)
    // Builds queued chunks (one per frame by default), advances
    // the wind and hides far chunks.
    //

    update(delta, playerPosition) {

        // --------------------------------------------------
        // WIND
        // --------------------------------------------------

        const windShader = this.flowerMaterial?.userData?.flowerWind;

        if (windShader) {
            windShader.uniforms.time.value += delta;
        }

        // --------------------------------------------------
        // BUILD QUEUE
        // --------------------------------------------------

        let budget = this.buildsPerFrame;

        while (budget > 0 && this.buildQueue.length > 0) {

            const chunk = this.takeNextChunk(playerPosition);

            chunk.queued = false;

            if (chunk.removed) {
                continue;
            }

            this.buildChunk(chunk);

            budget--;
        }

        // --------------------------------------------------
        // DISTANCE CULLING (4 times per second)
        // --------------------------------------------------

        if (!playerPosition) {
            return;
        }

        this.cullTimer += delta;

        if (this.cullTimer < 0.25) {
            return;
        }

        this.cullTimer = 0;

        const half = this.chunkSize * 0.5;
        const hideSq = this.hideDistance * this.hideDistance;

        for (const chunk of this.chunks.values()) {

            const dx = Math.max(
                Math.abs(playerPosition.x - chunk.x * this.chunkSize) - half,
                0
            );

            const dz = Math.max(
                Math.abs(playerPosition.z - chunk.z * this.chunkSize) - half,
                0
            );

            chunk.group.visible = dx * dx + dz * dz < hideSq;
        }
    }


    // ==================================================
    // UNREGISTER CHUNK
    // ==================================================

    unregisterTerrainChunk(chunkX, chunkZ) {

        const key = `${chunkX},${chunkZ}`;

        const chunk = this.chunks.get(key);

        if (!chunk) {
            return;
        }

        // The build queue skips removed chunks
        chunk.removed = true;

        this.disposeChunk(chunk);

        this.chunks.delete(key);
    }


    disposeChunk(chunk) {

        if (chunk.mesh) {

            chunk.group.remove(chunk.mesh);
            chunk.mesh.geometry.dispose();
            chunk.mesh = null;
        }

        this.scene.remove(chunk.group);
    }


    // ==================================================
    // DISPOSE
    // ==================================================

    dispose() {

        for (const chunk of this.chunks.values()) {

            chunk.removed = true;
            this.disposeChunk(chunk);
        }

        this.chunks.clear();
        this.buildQueue.length = 0;

        this.flowerModels.clear();

        if (this.flowerMaterial) {

            this.flowerMaterial.dispose();
            this.flowerMaterial = null;
        }
    }
}
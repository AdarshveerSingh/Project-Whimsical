import * as THREE from "three";
import { TerrainShader } from "../shaders/TerrainShader.js";
import PropDistributionSystem from "./PropDistributionSystem.js";
import { SurfaceSystem } from "./SurfaceSystem.js";
import { WorldGenerator } from "./WorldGenerator.js";


const SKIRT_DEPTH = 1.0;


// ============================================================
// GRID TEMPLATES
// ============================================================
//
// Index and UV arrays depend only on the segment count, so they
// are built once and reused. Only the typed arrays are shared;
// every geometry still gets its own BufferAttribute objects
// (sharing attribute objects across geometries is unsafe with
// geometry.dispose()).
//
// Layout matches PlaneGeometry after rotateX(-PI/2):
// x grows with ix, z grows with iz, index = iz * n + ix.
// ============================================================

const gridTemplates = new Map();

function getGridTemplate(segments) {

    let template = gridTemplates.get(segments);

    if (template) {
        return template;
    }

    const n = segments + 1;

    const uvs = new Float32Array(n * n * 2);

    for (let iz = 0; iz < n; iz++) {
        for (let ix = 0; ix < n; ix++) {

            const i = (iz * n + ix) * 2;

            uvs[i] = ix / segments;
            uvs[i + 1] = 1 - iz / segments;
        }
    }

    const IndexArray = n * n > 65535 ? Uint32Array : Uint16Array;

    const indices = new IndexArray(segments * segments * 6);

    let k = 0;

    for (let iz = 0; iz < segments; iz++) {
        for (let ix = 0; ix < segments; ix++) {

            const a = ix + n * iz;
            const b = ix + n * (iz + 1);
            const c = (ix + 1) + n * (iz + 1);
            const d = (ix + 1) + n * iz;

            indices[k++] = a;
            indices[k++] = b;
            indices[k++] = d;

            indices[k++] = b;
            indices[k++] = c;
            indices[k++] = d;
        }
    }

    template = { uvs, indices };

    gridTemplates.set(segments, template);

    return template;
}


export class TerrainSystem {

    // ==================================================
    // SHARED MATERIAL
    // ==================================================
    //
    // Create one of these in ChunkManager and pass it to every
    // chunk, instead of one ShaderMaterial per chunk.
    //

    static createMaterial() {

        return new THREE.ShaderMaterial({

            uniforms:
                THREE.UniformsUtils.merge([
                    THREE.UniformsLib.lights,
                    TerrainShader.uniforms
                ]),

            vertexShader: TerrainShader.vertexShader,
            fragmentShader: TerrainShader.fragmentShader,

            side: THREE.DoubleSide,
            fog: true,
            lights: true
        });
    }


    constructor({
        scene,
        sun = null,

        size = 64,

        // Mesh resolution (LOD). Must divide dataResolution.
        resolution = 64,

        // Resolution of the generated data grid. Always generated
        // once at this resolution; lower LOD meshes are subsampled
        // from it, so LOD changes never touch the worker.
        dataResolution = 32,

        baseHeight = 0.0,
        maxHeight = 14.2,
        heightScale = 6.0,
        seed = 482917,

        worldOffsetX = 0,
        worldOffsetZ = 0,

        surfaceSystem = null,
        terrainWorkerPool = null,
        onTerrainReady = null,

        // Optional shared instances (recommended)
        worldGenerator = null,
        propDistributionSystem = null,
        material = null
    }) {

        this.scene = scene;
        this.sun = sun;

        this.size = size;
        this.resolution = resolution;
        this.dataResolution = Math.max(dataResolution, resolution);

        this.baseHeight = baseHeight;
        this.maxHeight = maxHeight;
        this.heightScale = heightScale;

        this.effectiveMaxHeight =
            this.baseHeight +
            (this.maxHeight - this.baseHeight) *
            this.heightScale;

        this.seed = seed;

        this.worldOffsetX = worldOffsetX;
        this.worldOffsetZ = worldOffsetZ;

        this.worldGenerator =
            worldGenerator ||
            new WorldGenerator({
                seed: this.seed,
                baseHeight: this.baseHeight,
                maxHeight: this.maxHeight,
                heightScale: this.heightScale
            });

        this.surfaceSystem =
            surfaceSystem ||
            new SurfaceSystem({ seed: this.seed });

        this.propDistributionSystem =
            propDistributionSystem ||
            new PropDistributionSystem({ seed: this.seed });

        this.terrainWorkerPool = terrainWorkerPool;
        this.onTerrainReady = onTerrainReady;

        this.ownsMaterial = !material;
        this.material = material || TerrainSystem.createMaterial();

        this.geometry = null;
        this.mesh = null;

        this.skirtGeometry = null;
        this.skirtMesh = null;

        this.terrainGrid = null;

        this.generationVersion = 0;
        this.readyNotified = false;
        this.disposed = false;

        // ==================================================
        // GENERATE (must be last)
        // ==================================================

        if (this.terrainWorkerPool) {
            this.requestGeneration();
        } else {
            this.generate();
        }
    }


    // ==================================================
    // SHADOW UNIFORMS (handled by three.js shadow chunks)
    // ==================================================

    updateShadowUniforms() { }


    // ==================================================
    // WORLD QUERIES
    // ==================================================

    getHeight(x, z) {
        return this.worldGenerator.getHeight(x, z);
    }

    getNormal(x, z) {
        return this.worldGenerator.getNormal(x, z);
    }

    getSlope(x, z) {
        return this.worldGenerator.getSlope(x, z);
    }

    getSurface(x, z) {

        const sample =
            this.worldGenerator.getTerrainSample(x, z);

        return {
            height: sample.height,
            normal: sample.normal,
            slope: sample.slope,
            slopeDegrees: sample.slopeDegrees
        };
    }


    // ==================================================
    // HEIGHT GRID
    // ==================================================
    //
    // Always the full data grid (dataResolution), regardless of
    // the current mesh LOD, so grass and other props keep
    // consistent heights when the terrain LOD changes.
    //

    getHeightGrid() {
        return this.terrainGrid;
    }


    // ==================================================
    // REQUEST GENERATION (worker)
    // ==================================================

    requestGeneration() {

        const version = ++this.generationVersion;

        this.terrainWorkerPool
            .generate({

                key: `${this.worldOffsetX},${this.worldOffsetZ}`,

                size: this.size,

                resolution: this.dataResolution,

                worldOffsetX: this.worldOffsetX,
                worldOffsetZ: this.worldOffsetZ,

                seed: this.seed,

                baseHeight: this.baseHeight,
                maxHeight: this.maxHeight,
                heightScale: this.heightScale
            })
            .then((data) => {

                if (
                    this.disposed ||
                    version !== this.generationVersion
                ) {
                    return;
                }

                this.applyGeneratedTerrain(data, false);
            })
            .catch((error) => {
                console.error("Terrain generation failed:", error);
            });
    }


    // ==================================================
    // GENERATE (main-thread fallback)
    // ==================================================
    //
    // Produces data in the same format as the worker and goes
    // through the same code path as worker results.
    //

    generate() {

        const segments = this.dataResolution;
        const n = segments + 1;
        const total = n * n;

        const half = this.size * 0.5;
        const step = this.size / segments;

        const heightData = new Float32Array(total);
        const normalData = new Float32Array(total * 3);

        const grassWeightData = new Float32Array(total);
        const dirtWeightData = new Float32Array(total);
        const gravelWeightData = new Float32Array(total);
        const rockWeightData = new Float32Array(total);

        const colors = new Float32Array(total * 3);
        const surfaceWeights = new Float32Array(total * 4);

        for (let iz = 0; iz < n; iz++) {
            for (let ix = 0; ix < n; ix++) {

                const i = iz * n + ix;

                const worldX = ix * step - half + this.worldOffsetX;
                const worldZ = iz * step - half + this.worldOffsetZ;

                const sample =
                    this.worldGenerator.getTerrainSample(
                        worldX,
                        worldZ
                    );

                heightData[i] = sample.height;

                normalData[i * 3] = sample.normal.x;
                normalData[i * 3 + 1] = sample.normal.y;
                normalData[i * 3 + 2] = sample.normal.z;

                const noise =
                    this.surfaceSystem.getSurfaceNoise(
                        worldX,
                        worldZ
                    );

                const weights =
                    this.surfaceSystem.getSurfaceWeights(
                        worldX,
                        worldZ,
                        this,
                        sample,
                        noise
                    );

                const color =
                    this.surfaceSystem.getSurfaceColor(
                        worldX,
                        worldZ,
                        this,
                        sample,
                        weights,
                        noise
                    );

                colors[i * 3] = color.r;
                colors[i * 3 + 1] = color.g;
                colors[i * 3 + 2] = color.b;

                grassWeightData[i] = weights.grass;
                dirtWeightData[i] = weights.dirt;
                gravelWeightData[i] = weights.gravel;
                rockWeightData[i] = weights.rock;

                surfaceWeights[i * 4] = weights.grass;
                surfaceWeights[i * 4 + 1] = weights.dirt;
                surfaceWeights[i * 4 + 2] = weights.gravel;
                surfaceWeights[i * 4 + 3] = weights.rock;
            }
        }

        this.applyGeneratedTerrain(
            {
                heightData,
                normalData,
                grassWeightData,
                dirtWeightData,
                gravelWeightData,
                rockWeightData,
                colors,
                surfaceWeights,
                resolution: n,
                size: this.size
            },
            true
        );
    }


    // ==================================================
    // APPLY GENERATED DATA
    // ==================================================

    applyGeneratedTerrain(data, isSync) {

        if (this.disposed) {
            return;
        }

        this.terrainGrid = {

            data: data.heightData,
            normalData: data.normalData,

            grassWeightData: data.grassWeightData,
            dirtWeightData: data.dirtWeightData,
            gravelWeightData: data.gravelWeightData,
            rockWeightData: data.rockWeightData,

            colorData: data.colors,
            surfaceWeightData: data.surfaceWeights,

            // number of vertices per side (segments + 1)
            resolution: data.resolution,

            size: data.size
        };

        this.buildMesh();

        // Only the first generation announces readiness. LOD
        // changes reuse the data and don't re-register vegetation.
        if (this.readyNotified) {
            return;
        }

        this.readyNotified = true;

        if (isSync) {

            // The caller hasn't stored this terrain yet
            queueMicrotask(() => {
                if (!this.disposed) {
                    this.onTerrainReady?.(this);
                }
            });

        } else {

            this.onTerrainReady?.(this);
        }
    }


    // ==================================================
    // BUILD MESH FROM DATA GRID (cheap, used for every LOD)
    // ==================================================

    buildMesh() {

        const grid = this.terrainGrid;

        if (!grid) {
            return;
        }

        const dataVerts = grid.resolution;
        const dataSegments = dataVerts - 1;

        // Nearest stride that divides the data grid evenly, so
        // the mesh always covers the whole chunk.
        let stride = Math.max(
            1,
            Math.round(dataSegments / this.resolution)
        );

        while (dataSegments % stride !== 0) {
            stride++;
        }

        const segments = dataSegments / stride;
        const n = segments + 1;
        const count = n * n;

        const half = this.size * 0.5;
        const step = this.size / segments;

        const positions = new Float32Array(count * 3);
        const normals = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const weights = new Float32Array(count * 4);

        for (let iz = 0; iz < n; iz++) {
            for (let ix = 0; ix < n; ix++) {

                const i = iz * n + ix;
                const s = (iz * stride) * dataVerts + ix * stride;

                const p = i * 3;
                const sp = s * 3;

                positions[p] = ix * step - half;
                positions[p + 1] = grid.data[s];
                positions[p + 2] = iz * step - half;

                normals[p] = grid.normalData[sp];
                normals[p + 1] = grid.normalData[sp + 1];
                normals[p + 2] = grid.normalData[sp + 2];

                colors[p] = grid.colorData[sp];
                colors[p + 1] = grid.colorData[sp + 1];
                colors[p + 2] = grid.colorData[sp + 2];

                const w = i * 4;
                const sw = s * 4;

                weights[w] = grid.surfaceWeightData[sw];
                weights[w + 1] = grid.surfaceWeightData[sw + 1];
                weights[w + 2] = grid.surfaceWeightData[sw + 2];
                weights[w + 3] = grid.surfaceWeightData[sw + 3];
            }
        }

        const template = getGridTemplate(segments);

        const geometry = new THREE.BufferGeometry();

        geometry.setAttribute(
            "position",
            new THREE.BufferAttribute(positions, 3)
        );

        geometry.setAttribute(
            "normal",
            new THREE.BufferAttribute(normals, 3)
        );

        geometry.setAttribute(
            "uv",
            new THREE.BufferAttribute(template.uvs, 2)
        );

        geometry.setAttribute(
            "color",
            new THREE.BufferAttribute(colors, 3)
        );

        geometry.setAttribute(
            "surfaceWeights",
            new THREE.BufferAttribute(weights, 4)
        );

        geometry.setIndex(
            new THREE.BufferAttribute(template.indices, 1)
        );

        const oldGeometry = this.geometry;

        this.geometry = geometry;

        if (!this.mesh) {

            this.mesh = new THREE.Mesh(geometry, this.material);

            this.mesh.position.set(
                this.worldOffsetX,
                0,
                this.worldOffsetZ
            );

            this.mesh.name =
                `TerrainChunk_${this.worldOffsetX}_${this.worldOffsetZ}`;

            this.mesh.receiveShadow = true;
            this.mesh.castShadow = false;

            // Static: no per-frame matrix recompute
            this.mesh.matrixAutoUpdate = false;
            this.mesh.updateMatrix();

            this.scene.add(this.mesh);

        } else {

            this.mesh.geometry = geometry;
        }

        if (oldGeometry) {
            oldGeometry.dispose();
        }

        this.buildSkirt(positions, normals, segments);
    }


    // ==================================================
    // SKIRT (hides cracks between LOD levels)
    // ==================================================

    buildSkirt(positions, normals, segments) {
        const skirtDepth = Math.max(SKIRT_DEPTH, this.size * 0.012);

        const n = segments + 1;

        // Grid index of the i-th vertex along each edge,
        // in the same order as the original implementation.
        const edgeIndex = (edge, i) => {

            switch (edge) {

                case 0: return i;                          // north
                case 1: return i * n + (n - 1);            // east
                case 2: return (n - 1) * n + (n - 1 - i);  // south
                default: return (n - 1 - i) * n;           // west
            }
        };

        const verticesPerEdge = (segments + 1) * 2;
        const vertexTotal = verticesPerEdge * 4;

        const skirtPositions = new Float32Array(vertexTotal * 3);
        const skirtNormals = new Float32Array(vertexTotal * 3);

        const IndexArray = vertexTotal > 65535 ? Uint32Array : Uint16Array;

        const indices = new IndexArray(segments * 4 * 6);

        let v = 0;
        let k = 0;

        for (let edge = 0; edge < 4; edge++) {

            const start = v;

            for (let i = 0; i <= segments; i++) {

                const p = edgeIndex(edge, i) * 3;

                // top
                let o = v * 3;

                skirtPositions[o] = positions[p];
                skirtPositions[o + 1] = positions[p + 1];
                skirtPositions[o + 2] = positions[p + 2];

                skirtNormals[o] = normals[p];
                skirtNormals[o + 1] = normals[p + 1];
                skirtNormals[o + 2] = normals[p + 2];

                v++;

                // bottom
                o = v * 3;

                skirtPositions[o] = positions[p];
                skirtPositions[o + 1] = positions[p + 1] - skirtDepth;
                skirtPositions[o + 2] = positions[p + 2];

                skirtNormals[o] = normals[p];
                skirtNormals[o + 1] = normals[p + 1];
                skirtNormals[o + 2] = normals[p + 2];

                v++;
            }

            for (let i = 0; i < segments; i++) {

                const topA = start + i * 2;
                const bottomA = topA + 1;
                const topB = start + (i + 1) * 2;
                const bottomB = topB + 1;

                indices[k++] = topA;
                indices[k++] = bottomA;
                indices[k++] = topB;

                indices[k++] = topB;
                indices[k++] = bottomA;
                indices[k++] = bottomB;
            }
        }

        const geometry = new THREE.BufferGeometry();

        geometry.setAttribute(
            "position",
            new THREE.BufferAttribute(skirtPositions, 3)
        );

        geometry.setAttribute(
            "normal",
            new THREE.BufferAttribute(skirtNormals, 3)
        );

        geometry.setIndex(
            new THREE.BufferAttribute(indices, 1)
        );

        const oldGeometry = this.skirtGeometry;

        this.skirtGeometry = geometry;

        if (!this.skirtMesh) {

            this.skirtMesh = new THREE.Mesh(geometry, this.material);

            this.skirtMesh.position.set(
                this.worldOffsetX,
                0,
                this.worldOffsetZ
            );

            this.skirtMesh.name =
                `TerrainSkirt_${this.worldOffsetX}_${this.worldOffsetZ}`;

            this.skirtMesh.receiveShadow = true;
            this.skirtMesh.castShadow = false;

            this.skirtMesh.matrixAutoUpdate = false;
            this.skirtMesh.updateMatrix();

            this.scene.add(this.skirtMesh);

        } else {

            this.skirtMesh.geometry = geometry;
        }

        if (oldGeometry) {
            oldGeometry.dispose();
        }
    }


    // ==================================================
    // CHANGE RESOLUTION (LOD)
    // ==================================================
    //
    // No worker call and no noise: just resample the data grid.
    //

    setResolution(resolution) {

        if (this.resolution === resolution) {
            return;
        }

        this.resolution = resolution;

        if (this.terrainGrid) {
            this.buildMesh();
        }
    }


    // ==================================================
    // DEBUG MAPS
    // ==================================================

    renderMap(resolution, getColor) {

        const canvas = document.createElement("canvas");

        canvas.width = resolution;
        canvas.height = resolution;

        const ctx = canvas.getContext("2d");
        const image = ctx.createImageData(resolution, resolution);
        const pixels = image.data;

        const color = [0, 0, 0];

        for (let py = 0; py < resolution; py++) {

            const worldZ =
                this.worldOffsetZ +
                (py / (resolution - 1) - 0.5) * this.size;

            for (let px = 0; px < resolution; px++) {

                const worldX =
                    this.worldOffsetX +
                    (px / (resolution - 1) - 0.5) * this.size;

                color[0] = 0;
                color[1] = 0;
                color[2] = 0;

                getColor(worldX, worldZ, color);

                const index = (py * resolution + px) * 4;

                pixels[index] = color[0];
                pixels[index + 1] = color[1];
                pixels[index + 2] = color[2];
                pixels[index + 3] = 255;
            }
        }

        ctx.putImageData(image, 0, 0);

        return canvas;
    }


    generateDisplacementMap(resolution = 512) {

        const range = Math.max(
            this.maxHeight - this.baseHeight,
            0.000001
        );

        return this.renderMap(resolution, (x, z, color) => {

            const normalized = THREE.MathUtils.clamp(
                (this.getHeight(x, z) - this.baseHeight) / range,
                0,
                1
            );

            const value = Math.round(normalized * 255);

            color[0] = value;
            color[1] = value;
            color[2] = value;
        });
    }


    generateSurfaceMap(resolution = 512) {

        const S = this.surfaceSystem.SURFACE;

        const table = new Map([
            [S.GRASS, [70, 170, 50]],
            [S.DIRT, [190, 155, 95]],
            [S.GRAVEL, [145, 140, 125]],
            [S.ROCK, [75, 78, 80]]
        ]);

        return this.renderMap(resolution, (x, z, color) => {

            const surface =
                this.surfaceSystem.getSurface(x, z, this);

            const rgb = table.get(surface.type);

            if (rgb) {
                color[0] = rgb[0];
                color[1] = rgb[1];
                color[2] = rgb[2];
            }
        });
    }


    generatePropDistributionMap(type = "grass", resolution = 512) {

        return this.renderMap(resolution, (x, z, color) => {

            const density =
                this.propDistributionSystem.getDensity(type, x, z);

            const value = Math.round(
                THREE.MathUtils.clamp(density, 0, 1) * 255
            );

            color[0] = value;
            color[1] = value;
            color[2] = value;
        });
    }


    // ==================================================
    // CLEANUP
    // ==================================================

    dispose() {

        if (this.disposed) {
            return;
        }

        this.disposed = true;
        this.generationVersion++;

        if (this.mesh) {
            this.scene.remove(this.mesh);
        }

        if (this.skirtMesh) {
            this.scene.remove(this.skirtMesh);
        }

        if (this.geometry) {
            this.geometry.dispose();
        }

        if (this.skirtGeometry) {
            this.skirtGeometry.dispose();
        }

        // A shared material is owned by ChunkManager
        if (this.ownsMaterial && this.material) {
            this.material.dispose();
        }

        this.mesh = null;
        this.skirtMesh = null;
        this.geometry = null;
        this.skirtGeometry = null;
        this.material = null;

        // Release the large data arrays
        this.terrainGrid = null;
    }
}
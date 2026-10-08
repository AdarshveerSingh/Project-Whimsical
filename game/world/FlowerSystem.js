import * as THREE from "three";

import {
    GLTFLoader
} from "../node_modules/three/examples/jsm/loaders/GLTFLoader.js";

import PropDistributionSystem from "./PropDistributionSystem.js";

import { applyShadowOnly } from "../rendering/ShadowOnly.js";

import {
    mergeGeometries
} from "../node_modules/three/examples/jsm/utils/BufferGeometryUtils.js";

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
        this.flowerMaterial = null;

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

    applyWindShader(material) {
        material.onBeforeCompile = (shader) => {
            shader.uniforms.time = { value: 0 };

            shader.vertexShader = shader.vertexShader.replace(
                "#include <common>",
                `
            #include <common>

            uniform float time;

            attribute float flowerHeight01;
            attribute vec3 flowerWindPosition;
            `
            );

            shader.vertexShader = shader.vertexShader.replace(
                "#include <project_vertex>",
                `
            #include <project_vertex>

            // Per-vertex height is preserved from the original flower.
            float upperPart = smoothstep(
                0.30,
                0.65,
                flowerHeight01
            );

            float bend = upperPart * upperPart;

            // World position was baked into the merged geometry.
            float phase =
                flowerWindPosition.x * 0.08 +
                flowerWindPosition.z * 0.06;

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

        material.customProgramCacheKey = () => "merged-flower-wind-v1";
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


                        const sourceMaterial = object.material;

                        // All nine variations use the same atlas and shared material.
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
                            material: this.flowerMaterial,
                            matrix: object.matrixWorld.clone()
                        });

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
        terrain,
        surfaceData = null
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
        if (surfaceData) {
            surfaceData.surface = surface;
        }

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

        for (const mesh of chunk.instancedMeshes) {
            chunk.group.remove(mesh);
            mesh.geometry?.dispose();
        }

        chunk.instancedMeshes = [];

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

                const surfaceData = {};

                const suitability =
                    this.getSurfaceSuitability(
                        worldX,
                        worldZ,
                        chunk.terrain,
                        surfaceData
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
                    surfaceData.surface.height;


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
        // MERGE ALL FLOWER VARIATIONS INTO ONE CHUNK MESH
        // ==================================================

        const geometries = [];

        for (const [variation, instances] of positionsByFlower) {
            if (instances.length === 0) continue;

            const model = this.flowerModels.get(variation);
            if (!model) continue;

            const sourceGeometry = model.geometry;

            if (!sourceGeometry.boundingBox) {
                sourceGeometry.computeBoundingBox();
            }

            const minY = sourceGeometry.boundingBox.min.y;
            const height = Math.max(
                sourceGeometry.boundingBox.max.y - minY,
                0.001
            );

            const sourcePosition = sourceGeometry.getAttribute("position");

            for (const instance of instances) {
                // Each placed flower gets its own geometry copy.
                const geometry = sourceGeometry.clone();

                // Preserve the original variation's root-to-tip ratio.
                const heightData = new Float32Array(sourcePosition.count);

                for (let vertex = 0; vertex < sourcePosition.count; vertex++) {
                    heightData[vertex] = THREE.MathUtils.clamp(
                        (sourcePosition.getY(vertex) - minY) / height,
                        0,
                        1
                    );
                }

                geometry.setAttribute(
                    "flowerHeight01",
                    new THREE.BufferAttribute(heightData, 1)
                );

                // Recreate the exact transform used by the old InstancedMesh.
                this.tempPosition.set(
                    instance.x,
                    instance.y,
                    instance.z
                );

                this.tempQuaternion.setFromAxisAngle(
                    new THREE.Vector3(0, 1, 0),
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

                // Retain the original transform stored in the GLB.
                this.tempMatrix.multiply(model.matrix);

                // Bake placement and model transforms into the vertices.
                geometry.applyMatrix4(this.tempMatrix);

                // Store the baked position for spatially varied wind.
                const bakedPosition = geometry.getAttribute("position");
                const windPositionData = new Float32Array(
                    bakedPosition.count * 3
                );

                for (let vertex = 0; vertex < bakedPosition.count; vertex++) {
                    const offset = vertex * 3;

                    windPositionData[offset] = bakedPosition.getX(vertex);
                    windPositionData[offset + 1] = bakedPosition.getY(vertex);
                    windPositionData[offset + 2] = bakedPosition.getZ(vertex);
                }

                geometry.setAttribute(
                    "flowerWindPosition",
                    new THREE.BufferAttribute(windPositionData, 3)
                );

                geometries.push(geometry);
            }
        }

        if (geometries.length === 0) {
            return;
        }

        // mergeGeometries requires consistent indexing across its inputs.
        const hasIndexedGeometry = geometries.some(
            geometry => geometry.index !== null
        );
        const hasNonIndexedGeometry = geometries.some(
            geometry => geometry.index === null
        );

        if (hasIndexedGeometry && hasNonIndexedGeometry) {
            for (let i = 0; i < geometries.length; i++) {
                if (geometries[i].index !== null) {
                    const nonIndexed = geometries[i].toNonIndexed();
                    geometries[i].dispose();
                    geometries[i] = nonIndexed;
                }
            }
        }

        let mergedGeometry = null;

        try {
            mergedGeometry = mergeGeometries(geometries, false);
        } finally {
            // The merged geometry owns its own buffers.
            for (const geometry of geometries) {
                geometry.dispose();
            }
        }

        if (!mergedGeometry) {
            console.error(
                `FlowerSystem: Could not merge flower geometry for chunk ${chunk.x}, ${chunk.z}.`
            );
            return;
        }

        mergedGeometry.computeBoundingBox();
        mergedGeometry.computeBoundingSphere();

        const mesh = new THREE.Mesh(
            mergedGeometry,
            this.flowerMaterial
        );

        mesh.name = `Flowers_${chunk.x},${chunk.z}`;
        mesh.castShadow = false;
        mesh.receiveShadow = true;

        chunk.group.add(mesh);
        chunk.instancedMeshes.push(mesh);
    }
    // ==================================================
    // UPDATE WIND
    // ==================================================

    update(delta) {
        const windShader = this.flowerMaterial?.userData?.flowerWind;

        if (windShader) {
            windShader.uniforms.time.value += delta;
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


        for (const mesh of chunk.instancedMeshes) {
            chunk.group.remove(mesh);
            mesh.geometry?.dispose();
        }

        this.scene.remove(chunk.group);
        this.chunks.delete(key);

    }


    // ==================================================
    // DISPOSE
    // ==================================================

    dispose() {

        for (
            const chunk
            of this.chunks.values()
        ) {

            for (const mesh of chunk.instancedMeshes) {
                chunk.group.remove(mesh);
                mesh.geometry?.dispose();
            }

            this.scene.remove(
                chunk.group
            );

        }


        this.chunks.clear();

    }

}
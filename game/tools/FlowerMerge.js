import * as THREE from "three";


// ============================================================
// FLOWER TEMPLATE (computed once per variation)
// ============================================================
//
// Vertex data with the GLB node transform already baked in, so
// placing a flower only needs a Y rotation, a uniform scale and
// a translation.
//
// Assumes the flower geometry uses position / normal / uv, which
// is all the Lambert material reads.
//

export function getFlowerTemplate(flowerModels, variation) {

    const model = flowerModels.get(variation);

    if (!model) {
        return null;
    }

    if (model.template) {
        return model.template;
    }

    const source = model.geometry;

    if (!source.boundingBox) {
        source.computeBoundingBox();
    }

    const minY = source.boundingBox.min.y;

    const height = Math.max(
        source.boundingBox.max.y - minY,
        0.001
    );

    const sourcePosition = source.getAttribute("position");
    const count = sourcePosition.count;

    // Root-to-tip ratio from the ORIGINAL local positions
    const height01 = new Float32Array(count);

    for (let i = 0; i < count; i++) {

        height01[i] = THREE.MathUtils.clamp(
            (sourcePosition.getY(i) - minY) / height,
            0,
            1
        );
    }

    // Bake the GLB node transform once
    const baked = source.clone();

    baked.applyMatrix4(model.matrix);

    if (!baked.getAttribute("normal")) {
        baked.computeVertexNormals();
    }

    const bakedPosition = baked.getAttribute("position");
    const bakedNormal = baked.getAttribute("normal");
    const bakedUv = baked.getAttribute("uv");

    // Copy through the accessors so quantized or interleaved
    // attributes also end up as plain Float32Arrays.
    const positions = new Float32Array(count * 3);
    const normals = new Float32Array(count * 3);
    const uvs = new Float32Array(count * 2);

    for (let i = 0; i < count; i++) {

        positions[i * 3] = bakedPosition.getX(i);
        positions[i * 3 + 1] = bakedPosition.getY(i);
        positions[i * 3 + 2] = bakedPosition.getZ(i);

        normals[i * 3] = bakedNormal.getX(i);
        normals[i * 3 + 1] = bakedNormal.getY(i);
        normals[i * 3 + 2] = bakedNormal.getZ(i);

        if (bakedUv) {
            uvs[i * 2] = bakedUv.getX(i);
            uvs[i * 2 + 1] = bakedUv.getY(i);
        }
    }

    let indices;

    if (baked.index) {

        indices = new Uint32Array(baked.index.count);

        for (let i = 0; i < indices.length; i++) {
            indices[i] = baked.index.getX(i);
        }

    } else {

        indices = new Uint32Array(count);

        for (let i = 0; i < count; i++) {
            indices[i] = i;
        }
    }

    baked.dispose();

    model.template = {
        vertexCount: count,
        indexCount: indices.length,
        positions,
        normals,
        uvs,
        height01,
        indices
    };

    return model.template;
}


// ============================================================
// MERGE ALL FLOWERS OF A CHUNK INTO ONE GEOMETRY
// ============================================================
//
// No clone(), no applyMatrix4(), no mergeGeometries().
// Each flower is transformed straight into the output arrays.
//
// flowerModels:      the Map stored on FlowerSystem
// positionsByFlower: Map of variation name -> array of
//                    { x, y, z, rotation, scale } (world space)
//

export function buildMergedGeometry(flowerModels, positionsByFlower) {

    let totalVertices = 0;
    let totalIndices = 0;

    for (const [variation, instances] of positionsByFlower) {

        if (instances.length === 0) {
            continue;
        }

        const template = getFlowerTemplate(flowerModels, variation);

        if (!template) {
            continue;
        }

        totalVertices += template.vertexCount * instances.length;
        totalIndices += template.indexCount * instances.length;
    }

    if (totalVertices === 0) {
        return null;
    }

    const positions = new Float32Array(totalVertices * 3);
    const normals = new Float32Array(totalVertices * 3);
    const uvs = new Float32Array(totalVertices * 2);
    const height01 = new Float32Array(totalVertices);

    const IndexArray =
        totalVertices > 65535 ? Uint32Array : Uint16Array;

    const indices = new IndexArray(totalIndices);

    let vertexOffset = 0;
    let indexOffset = 0;

    for (const [variation, instances] of positionsByFlower) {

        const t = getFlowerTemplate(flowerModels, variation);

        if (!t) {
            continue;
        }

        for (const instance of instances) {

            const cos = Math.cos(instance.rotation);
            const sin = Math.sin(instance.rotation);
            const s = instance.scale;

            for (let i = 0; i < t.vertexCount; i++) {

                const i3 = i * 3;
                const o3 = (vertexOffset + i) * 3;

                const px = t.positions[i3];
                const py = t.positions[i3 + 1];
                const pz = t.positions[i3 + 2];

                // scale, rotate around Y, translate
                positions[o3] = (px * cos + pz * sin) * s + instance.x;
                positions[o3 + 1] = py * s + instance.y;
                positions[o3 + 2] = (-px * sin + pz * cos) * s + instance.z;

                const nx = t.normals[i3];
                const ny = t.normals[i3 + 1];
                const nz = t.normals[i3 + 2];

                // uniform scale: rotation only
                normals[o3] = nx * cos + nz * sin;
                normals[o3 + 1] = ny;
                normals[o3 + 2] = -nx * sin + nz * cos;
            }

            uvs.set(t.uvs, vertexOffset * 2);
            height01.set(t.height01, vertexOffset);

            for (let i = 0; i < t.indexCount; i++) {
                indices[indexOffset + i] = t.indices[i] + vertexOffset;
            }

            vertexOffset += t.vertexCount;
            indexOffset += t.indexCount;
        }
    }

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
        new THREE.BufferAttribute(uvs, 2)
    );

    geometry.setAttribute(
        "flowerHeight01",
        new THREE.BufferAttribute(height01, 1)
    );

    geometry.setIndex(
        new THREE.BufferAttribute(indices, 1)
    );

    return geometry;
}
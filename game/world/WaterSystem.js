import * as THREE from "three";


// ============================================================
// WATER SYSTEM (sea level + lakes, Ghibli-style shader)
// ============================================================
//
// For every terrain chunk that has ground below sea level, builds
// one transparent mesh sitting at sea level.
//
// The mesh uses the SAME triangulation as the terrain mesh and
// stores depth = seaLevel - terrainHeight per vertex. Depth is
// interpolated linearly across each triangle, exactly like the
// terrain height, so depth = 0 lands on the real shoreline.
//
// The fragment shader is a port of a Blender node graph:
//
//   base color = mix(A, Screen(A, B), screenFactor)
//     A = 4-stop color ramp, driven by water depth
//         (Blender: Linear gradient on Generated X)
//     B = fBM noise (scale 5) -> gamma 2.9 -> black..noiseColor ramp
//
//   sparkle mask = streaks * patches * dots
//     streaks  = stretched fBM noise thresholded at streakCut
//     dots     = Voronoi F1 distance, white at 0 -> black at sparkleRadius
//     patches  = low-frequency noise (Blender: one spherical blob)
//
//   final = mix(baseColor, sparkleColor, mask)
//
// All tunables are uniforms: waterSystem.material.uniforms.<name>.value
// ============================================================


// ------------------------------------------------------------
// DEFAULTS
// ------------------------------------------------------------
// The four ramp colors are ESTIMATES read from a screenshot.
// Click each stop in the Blender color ramp, copy its hex value
// and paste it here.
// ------------------------------------------------------------

const DEFAULTS = {

    // Water chunks farther than this (distance to the nearest
    // chunk edge) are hidden. Match it to your fog distance.
    hideDistance: 300,

    // ---------------- base color ----------------

    rampColor0: 0xb4eaf7,       // shore (depth 0), ramp stop at 0.000
    rampColor1: 0x1f94b9,       // ramp stop at 0.225
    rampColor2: 0x0e6a96,       // ramp stop at 0.650
    rampColor3: 0x0b4f7a,       // deep water, ramp stop at 1.000

    // Depth (world units) at which the ramp reaches its last stop
    deepDepth: 3.0,

    noiseColor: 0x00aaff,       // ramp 2 end color
    noiseGamma: 2.9,
    colorNoiseScale: 5.0,       // per patch
    screenFactor: 0.5,

    // World units per Blender "generated" unit.
    // Use the size of your Blender plane. Bigger = larger patterns.
    patchSize: 24,

    // Rotates all patterns around the vertical axis (radians)
    patternRotation: 0,

    // Slow drift of the color noise
    flowSpeed: 1.01,

    // ---------------- sparkles ----------------

    sparkleColor: 0xffffff,
    sparkleStrength: 1.0,

    // Streaks: 30 * Blender mapping scale (2.0, 0.2, 1.0)
    streakFreq: [60, 6],
    streakCut: 0.355,
    streakSoft: 0.06,
    streakSpeed: 0.01,

    // Dots: 200 * Blender mapping scale (1.0, 0.4, 1.0)
    sparkleFreq: [200, 80],
    sparkleRadius: 0.30,

    // Speed of the twinkle (stands in for Blender's driven W value)
    sparkleSpeed: 0.6,

    // Patch noise that replaces the single spherical blob
    patchFreq: 3.0,
    patchRange: [0.40, 0.65],

    // Sparkles fade out between these camera distances
    sparkleFadeStart: 12,
    sparkleFadeEnd: 45,

    // ---------------- surface ----------------

    skyColor: 0xbfe6ff,
    fresnelStrength: 0.6,

    opacityShallow: 0.50,
    opacityDeep: 0.7,

    // Depth over which the shoreline fades from clear to opaque
    edgeFade: 0.35,

    // Shore foam (not in the Blender graph). 0 turns it off.
    foamColor: 0xffffff,
    foamWidth: 0.30,
    foamStrength: 0.7
};


const VERTEX_SHADER = /* glsl */`

    attribute float waterDepth;

    varying float vDepth;
    varying vec3 vWorldPos;

    #include <fog_pars_vertex>

    void main() {

        vDepth = waterDepth;

        vec4 worldPosition = modelMatrix * vec4(position, 1.0);

        vWorldPos = worldPosition.xyz;

        vec4 mvPosition = viewMatrix * worldPosition;

        gl_Position = projectionMatrix * mvPosition;

        #include <fog_vertex>
    }
`;


const FRAGMENT_SHADER = /* glsl */`

    uniform float time;

    uniform vec3 rampColor0;
    uniform vec3 rampColor1;
    uniform vec3 rampColor2;
    uniform vec3 rampColor3;
    uniform vec3 noiseColor;
    uniform vec3 sparkleColor;
    uniform vec3 skyColor;
    uniform vec3 foamColor;

    uniform float deepDepth;
    uniform float noiseGamma;
    uniform float colorNoiseScale;
    uniform float screenFactor;
    uniform float patchSize;
    uniform float patternRotation;
    uniform float flowSpeed;

    uniform float sparkleStrength;
    uniform vec2 streakFreq;
    uniform float streakCut;
    uniform float streakSoft;
    uniform float streakSpeed;
    uniform vec2 sparkleFreq;
    uniform float sparkleRadius;
    uniform float sparkleSpeed;
    uniform float patchFreq;
    uniform vec2 patchRange;
    uniform float sparkleFadeStart;
    uniform float sparkleFadeEnd;

    uniform float fresnelStrength;
    uniform float opacityShallow;
    uniform float opacityDeep;
    uniform float edgeFade;
    uniform float foamWidth;
    uniform float foamStrength;

    varying float vDepth;
    varying vec3 vWorldPos;

    #include <fog_pars_fragment>


    // ----------------------------------------------------
    // HASHES (no sin(): stable at large world coordinates)
    // ----------------------------------------------------

    float hash12(vec2 p) {

        vec3 p3 = fract(vec3(p.xyx) * 0.1031);

        p3 += dot(p3, p3.yzx + 33.33);

        return fract((p3.x + p3.y) * p3.z);
    }

    vec2 hash22(vec2 p) {

        vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));

        p3 += dot(p3, p3.yzx + 33.33);

        return fract((p3.xx + p3.yz) * p3.zy);
    }


    // ----------------------------------------------------
    // VALUE NOISE + fBM
    // Same shape as Blender's fBM, detail 2, roughness 0.5,
    // lacunarity 2, normalized: octaves 1, 0.5, 0.25.
    // ----------------------------------------------------

    float vnoise(vec2 p) {

        vec2 i = floor(p);
        vec2 f = fract(p);

        vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);

        float a = hash12(i);
        float b = hash12(i + vec2(1.0, 0.0));
        float c = hash12(i + vec2(0.0, 1.0));
        float d = hash12(i + vec2(1.0, 1.0));

        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
    }

    float fbm3(vec2 p) {

        float v =
            vnoise(p) +
            0.5 * vnoise(p * 2.0 + 17.3) +
            0.25 * vnoise(p * 4.0 + 41.7);

        return v / 1.75;
    }


    // ----------------------------------------------------
    // VORONOI F1 (2D, animated feature points)
    // Stands in for Blender's 4D Voronoi with a driven W.
    // ----------------------------------------------------

    float voronoiF1(vec2 p, float t) {

        vec2 cell = floor(p);
        vec2 local = fract(p);

        float minDist = 8.0;

        for (int y = -1; y <= 1; y++) {
            for (int x = -1; x <= 1; x++) {

                vec2 g = vec2(float(x), float(y));

                vec2 o = hash22(cell + g);

                o = 0.5 + 0.5 * sin(t + 6.2831853 * o);

                vec2 r = g + o - local;

                minDist = min(minDist, dot(r, r));
            }
        }

        return sqrt(minDist);
    }


    vec2 rotate2(vec2 p, float a) {

        float c = cos(a);
        float s = sin(a);

        return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
    }


    // ----------------------------------------------------
    // COLOR RAMP (stops at 0, 0.225, 0.65, 1; eased like
    // Blender's Cardinal interpolation)
    // ----------------------------------------------------

    vec3 rampBase(float t) {

        vec3 c = mix(rampColor0, rampColor1, smoothstep(0.0, 0.225, t));

        c = mix(c, rampColor2, smoothstep(0.225, 0.65, t));
        c = mix(c, rampColor3, smoothstep(0.65, 1.0, t));

        return c;
    }


    void main() {

        // Outside the water (interpolated depth crossed zero)
        if (vDepth <= 0.0) {
            discard;
        }

        float depthT = clamp(vDepth / deepDepth, 0.0, 1.0);

        // Pattern space: world XZ in "patch" units
        vec2 sp = rotate2(vWorldPos.xz, patternRotation) / patchSize;


        // ------------------------------------------------
        // BASE COLOR
        // ------------------------------------------------

        vec3 A = rampBase(depthT);

        float n = fbm3(
            sp * colorNoiseScale +
            vec2(time * flowSpeed, time * flowSpeed * 0.6)
        );

        float g = pow(clamp(n, 0.0, 1.0), noiseGamma);

        vec3 B = noiseColor * g;

        // Blender "Screen" mix at screenFactor
        vec3 screened = 1.0 - (1.0 - A) * (1.0 - B);

        vec3 color = mix(A, screened, screenFactor);


        // ------------------------------------------------
        // FRESNEL (replaces the roughness-0 Principled reflection)
        // ------------------------------------------------

        vec3 viewDir = normalize(cameraPosition - vWorldPos);

        float ndv = clamp(viewDir.y, 0.0, 1.0);

        float fresnel = 0.034 + 0.966 * pow(1.0 - ndv, 5.0);

        color = mix(color, skyColor, fresnel * fresnelStrength);


        // ------------------------------------------------
        // SPARKLES: streaks * patches * dots
        // Skipped beyond the fade distance (cheap far water).
        // ------------------------------------------------

        float mask = 0.0;

        float camDist = distance(cameraPosition, vWorldPos);

        float fade = 1.0 - smoothstep(sparkleFadeStart, sparkleFadeEnd, camDist);

        if (fade > 0.0) {

            float sn = fbm3(sp * streakFreq + vec2(0.0, time * streakSpeed));

            float streak = 1.0 - smoothstep(streakCut, streakCut + streakSoft, sn);

            if (streak > 0.0) {

                float patches = smoothstep(
                    patchRange.x,
                    patchRange.y,
                    vnoise(sp * patchFreq + vec2(37.0, 11.0))
                );

                if (patches > 0.0) {

                    float vd = voronoiF1(sp * sparkleFreq, time * sparkleSpeed);

                    float dots = 1.0 - clamp(vd / sparkleRadius, 0.0, 1.0);

                    mask = streak * patches * dots * fade * sparkleStrength;
                }
            }
        }

        mask = clamp(mask, 0.0, 1.0);

        color = mix(color, sparkleColor, mask);


        // ------------------------------------------------
        // SHORE FOAM (optional, not in the Blender graph)
        // ------------------------------------------------

        float shore = 1.0 - smoothstep(0.0, foamWidth, vDepth);

        float foamNoise =
            vnoise(vWorldPos.xz * 1.6 + vec2(time * 0.25, -time * 0.18));

        float foam =
            foamStrength *
            shore *
            smoothstep(0.30, 0.70, foamNoise + shore * 0.35);

        color = mix(color, foamColor, foam);


        // ------------------------------------------------
        // ALPHA: soft shoreline, sparkles and foam stay opaque
        // ------------------------------------------------

        float alpha =
            smoothstep(0.0, edgeFade, vDepth) *
            mix(opacityShallow, opacityDeep, depthT);

        alpha = max(
            alpha,
            max(foam, mask) * smoothstep(0.0, edgeFade * 0.5, vDepth)
        );

        gl_FragColor = vec4(color, alpha);

        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
    }
`;


export class WaterSystem {

    constructor({ scene, ...options } = {}) {

        const p = { ...DEFAULTS, ...options };

        this.scene = scene;
        this.hideDistance = p.hideDistance;

        this.chunks = new Map();
        this.cullTimer = 0;

        const color = (hex) => ({ value: new THREE.Color(hex) });
        const vec2 = (a) => ({ value: new THREE.Vector2(a[0], a[1]) });
        const num = (v) => ({ value: v });

        this.material = new THREE.ShaderMaterial({

            uniforms: THREE.UniformsUtils.merge([

                THREE.UniformsLib.fog,

                {
                    time: num(0),

                    rampColor0: color(p.rampColor0),
                    rampColor1: color(p.rampColor1),
                    rampColor2: color(p.rampColor2),
                    rampColor3: color(p.rampColor3),
                    noiseColor: color(p.noiseColor),
                    sparkleColor: color(p.sparkleColor),
                    skyColor: color(p.skyColor),
                    foamColor: color(p.foamColor),

                    deepDepth: num(p.deepDepth),
                    noiseGamma: num(p.noiseGamma),
                    colorNoiseScale: num(p.colorNoiseScale),
                    screenFactor: num(p.screenFactor),
                    patchSize: num(p.patchSize),
                    patternRotation: num(p.patternRotation),
                    flowSpeed: num(p.flowSpeed),

                    sparkleStrength: num(p.sparkleStrength),
                    streakFreq: vec2(p.streakFreq),
                    streakCut: num(p.streakCut),
                    streakSoft: num(p.streakSoft),
                    streakSpeed: num(p.streakSpeed),
                    sparkleFreq: vec2(p.sparkleFreq),
                    sparkleRadius: num(p.sparkleRadius),
                    sparkleSpeed: num(p.sparkleSpeed),
                    patchFreq: num(p.patchFreq),
                    patchRange: vec2(p.patchRange),
                    sparkleFadeStart: num(p.sparkleFadeStart),
                    sparkleFadeEnd: num(p.sparkleFadeEnd),

                    fresnelStrength: num(p.fresnelStrength),
                    opacityShallow: num(p.opacityShallow),
                    opacityDeep: num(p.opacityDeep),
                    edgeFade: num(p.edgeFade),
                    foamWidth: num(p.foamWidth),
                    foamStrength: num(p.foamStrength)
                }
            ]),

            vertexShader: VERTEX_SHADER,
            fragmentShader: FRAGMENT_SHADER,

            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            fog: true
        });
    }


    // ==================================================
    // REGISTER CHUNK
    // ==================================================

    registerTerrainChunk(terrainChunk) {

        const key = `${terrainChunk.x},${terrainChunk.z}`;

        if (this.chunks.has(key)) {
            return;
        }

        const record = {
            x: terrainChunk.x,
            z: terrainChunk.z,
            mesh: null,
            centerX: 0,
            centerZ: 0,
            half: 0
        };

        // Registered even when there is no water, so the chunk
        // isn't rebuilt every time it is announced again.
        this.chunks.set(key, record);

        this.buildChunk(record, terrainChunk.terrain);
    }


    // ==================================================
    // BUILD CHUNK
    // ==================================================

    buildChunk(record, terrain) {

        const grid = terrain.getHeightGrid();

        if (!grid) {
            return;
        }

        const seaLevel = terrain.worldGenerator.getSeaLevel();

        const n = grid.resolution;          // vertices per side
        const segments = n - 1;
        const count = n * n;

        // ----------------------------------------------
        // DEPTH PER VERTEX
        // ----------------------------------------------

        const depth = new Float32Array(count);

        let anyWater = false;

        for (let i = 0; i < count; i++) {

            const d = seaLevel - grid.data[i];

            depth[i] = d;

            if (d > 0) {
                anyWater = true;
            }
        }

        // Most chunks are fully above water: no mesh at all
        if (!anyWater) {
            return;
        }

        // ----------------------------------------------
        // QUADS THAT TOUCH WATER
        // ----------------------------------------------
        //
        // Same triangle layout as the terrain mesh
        // (a, b, d) and (b, c, d), so depth = 0 matches the
        // rendered shoreline exactly.
        //

        const IndexArray = count > 65535 ? Uint32Array : Uint16Array;

        const indices = new IndexArray(segments * segments * 6);

        let k = 0;

        for (let iz = 0; iz < segments; iz++) {
            for (let ix = 0; ix < segments; ix++) {

                const a = ix + n * iz;
                const b = ix + n * (iz + 1);
                const c = (ix + 1) + n * (iz + 1);
                const d = (ix + 1) + n * iz;

                if (
                    depth[a] <= 0 &&
                    depth[b] <= 0 &&
                    depth[c] <= 0 &&
                    depth[d] <= 0
                ) {
                    continue;
                }

                indices[k++] = a;
                indices[k++] = b;
                indices[k++] = d;

                indices[k++] = b;
                indices[k++] = c;
                indices[k++] = d;
            }
        }

        if (k === 0) {
            return;
        }

        // ----------------------------------------------
        // GEOMETRY (flat at sea level, chunk-local)
        // ----------------------------------------------

        const half = grid.size * 0.5;
        const step = grid.size / segments;

        const positions = new Float32Array(count * 3);

        for (let iz = 0; iz < n; iz++) {
            for (let ix = 0; ix < n; ix++) {

                const o = (iz * n + ix) * 3;

                positions[o] = ix * step - half;
                positions[o + 1] = seaLevel;
                positions[o + 2] = iz * step - half;
            }
        }

        const geometry = new THREE.BufferGeometry();

        geometry.setAttribute(
            "position",
            new THREE.BufferAttribute(positions, 3)
        );

        geometry.setAttribute(
            "waterDepth",
            new THREE.BufferAttribute(depth, 1)
        );

        geometry.setIndex(
            new THREE.BufferAttribute(indices.slice(0, k), 1)
        );

        // ----------------------------------------------
        // MESH
        // ----------------------------------------------

        const mesh = new THREE.Mesh(geometry, this.material);

        mesh.name = `Water_${record.x},${record.z}`;

        mesh.position.set(
            terrain.worldOffsetX,
            0,
            terrain.worldOffsetZ
        );

        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();

        // Drawn after every other transparent object (grass),
        // so water blends over whatever is underneath.
        mesh.renderOrder = 10;

        mesh.castShadow = false;
        mesh.receiveShadow = false;

        this.scene.add(mesh);

        record.mesh = mesh;
        record.centerX = terrain.worldOffsetX;
        record.centerZ = terrain.worldOffsetZ;
        record.half = half;
    }


    // ==================================================
    // UPDATE
    // ==================================================

    update(delta, playerPosition) {

        this.material.uniforms.time.value += delta;

        if (!playerPosition) {
            return;
        }

        this.cullTimer += delta;

        if (this.cullTimer < 0.25) {
            return;
        }

        this.cullTimer = 0;

        const hideSq = this.hideDistance * this.hideDistance;

        for (const chunk of this.chunks.values()) {

            if (!chunk.mesh) {
                continue;
            }

            const dx = Math.max(
                Math.abs(playerPosition.x - chunk.centerX) - chunk.half,
                0
            );

            const dz = Math.max(
                Math.abs(playerPosition.z - chunk.centerZ) - chunk.half,
                0
            );

            chunk.mesh.visible = dx * dx + dz * dz < hideSq;
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

        this.disposeChunk(chunk);

        this.chunks.delete(key);
    }


    disposeChunk(chunk) {

        if (chunk.mesh) {

            this.scene.remove(chunk.mesh);
            chunk.mesh.geometry.dispose();
            chunk.mesh = null;
        }
    }


    // ==================================================
    // DISPOSE
    // ==================================================

    dispose() {

        for (const chunk of this.chunks.values()) {
            this.disposeChunk(chunk);
        }

        this.chunks.clear();

        this.material.dispose();
    }
}
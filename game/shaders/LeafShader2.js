import * as THREE from "three";

// ============================================================
// LEAF SHADER
// MeshStandardMaterial + wind + 1-octave procedural simplex
// ============================================================

export function applyLeafShader(
    originalMaterial,
    {
        windStrength = 0.28,
        windSpeed = 1.2,
        windScale = 0.8,

        leafColor =
            new THREE.Color(
                0.32,
                0.72,
                0.18
            )
    } = {}
) {

    // ========================================================
    // ORIGINAL GLB TEXTURE
    // ========================================================

    const texture =
        originalMaterial.map;

    console.log(
        "Leaf texture:",
        texture
    );

    console.log(
        "Leaf alphaMap:",
        originalMaterial.alphaMap
    );

    if (!texture) {

        console.error(
            "LEAF SHADER ERROR: No texture found."
        );

        return originalMaterial;
    }

    // ========================================================
    // VISIBLE MATERIAL
    // ========================================================

    const leafMaterial =
        new THREE.MeshStandardMaterial({

            map:
                texture,

            // KEEP EXISTING ALPHA CUTTING
            alphaTest:
                0.5,

            transparent:
                false,

            depthWrite:
                true,

            depthTest:
                true,

            side:
                THREE.DoubleSide,

            // NORMAL STANDARD MATERIAL LIGHTING
            roughness:
                0.85,

            metalness:
                0.0,

            // Base tint
            color:
                new THREE.Color(
                    1.0,
                    1.0,
                    1.0
                ),

            // NORMAL THREE.JS FOG
            fog:
                true
        });

    // ========================================================
    // CUSTOM SHADER MODIFICATION
    // ========================================================

    leafMaterial.onBeforeCompile =
        (shader) => {

            // ==================================================
            // UNIFORMS
            // ==================================================

            shader.uniforms.uLeafTime = {
                value: 0
            };

            shader.uniforms.uWindStrength = {
                value:
                    windStrength
            };

            shader.uniforms.uWindSpeed = {
                value:
                    windSpeed
            };

            shader.uniforms.uWindScale = {
                value:
                    windScale
            };

            // ==================================================
            // PROCEDURAL SIMPLEX PALETTE
            // One projection (YZ) + one simplex octave.
            // ==================================================

            shader.uniforms.uNoiseSeed = {
                value: 482917
            };

            shader.uniforms.uNoiseScale = {
                value: 2.0
            };

            shader.uniforms.uNoiseContrast = {
                value: 0.23
            };

            shader.uniforms.uNoiseBrightness = {
                value: 0.0
            };

            shader.uniforms.uNoiseThreshold = {
                value: 0.43
            };

            shader.uniforms.uNoiseSoftness = {
                value: 0.496
            };

            shader.uniforms.uProjectionScale = {
                value: 0.25
            };

            shader.uniforms.uProjectionRotation = {
                value:
                    THREE.MathUtils.degToRad(
                        30.0
                    )
            };

            shader.uniforms.uProjectionOffset = {
                value:
                    new THREE.Vector2(
                        0.35,
                        0.455
                    )
            };

            shader.uniforms.uNoiseInvert = {
                value: true
            };

            shader.uniforms.uColor0 = {
                value:
                    new THREE.Color(
                        "#2f755d"
                    )
            };

            shader.uniforms.uColor1 = {
                value:
                    new THREE.Color(
                        "#409179"
                    )
            };

            shader.uniforms.uColor2 = {
                value:
                    new THREE.Color(
                        "#6abb94"
                    )
            };

            shader.uniforms.uColor3 = {
                value:
                    new THREE.Color(
                        "#c0fc6d"
                    )
            };

            // ==================================================
            // STORE COMPILED SHADER
            // ==================================================

            leafMaterial.userData.leafShader =
                shader;

            // ==================================================
            // VERTEX UNIFORMS
            // ==================================================

            shader.vertexShader = `

                uniform float uLeafTime;
                uniform float uWindStrength;
                uniform float uWindSpeed;
                uniform float uWindScale;

                varying vec3 vLeafPosition;

            ` + shader.vertexShader;

            // ==================================================
            // WIND
            // ==================================================

            shader.vertexShader =
                shader.vertexShader.replace(

                    "#include <begin_vertex>",

                    `

                    #include <begin_vertex>

                    // =========================================
                    // ORIGINAL LEAF LOCAL POSITION
                    // Captured BEFORE wind displacement.
                    // =========================================

                    vLeafPosition =
                        transformed;

                    // =========================================
                    // WORLD POSITION
                    // =========================================

                    vec3 leafWorldPos =
                        (
                            modelMatrix *
                            vec4(
                                transformed,
                                1.0
                            )
                        ).xyz;

                    // =========================================
                    // WIND PHASE
                    // =========================================

                    float leafPhase =
                        leafWorldPos.x *
                        uWindScale *
                        0.35

                        +

                        leafWorldPos.z *
                        uWindScale *
                        0.25

                        +

                        uLeafTime *
                        uWindSpeed;

                    // =========================================
                    // WIND WAVES
                    // =========================================

                    float wind1 =
                        sin(
                            leafPhase
                        );

                    float wind2 =
                        sin(
                            leafPhase *
                            1.73
                            +
                            2.4
                        );

                    float wind3 =
                        sin(
                            leafPhase *
                            3.91
                            +
                            1.2
                        );

                    float wind =
                        wind1 * 0.55
                        +
                        wind2 * 0.30
                        +
                        wind3 * 0.15;

                    // =========================================
                    // HEIGHT MASK
                    // =========================================

                    float leafHeight =
                        clamp(
                            position.y *
                            0.5 +
                            0.5,
                            0.20,
                            1.0
                        );

                    // =========================================
                    // MAIN SWAY
                    // =========================================

                    transformed.x +=
                        wind *
                        uWindStrength *
                        leafHeight;

                    transformed.z +=
                        wind *
                        uWindStrength *
                        0.40 *
                        leafHeight;

                    // =========================================
                    // FLUTTER
                    // =========================================

                    float flutter =
                        sin(
                            uLeafTime *
                            uWindSpeed *
                            2.5

                            +

                            leafWorldPos.x *
                            4.0

                            +

                            leafWorldPos.z *
                            3.0
                        );

                    transformed.x +=
                        flutter *
                        uWindStrength *
                        0.12 *
                        leafHeight;

                    transformed.z +=
                        flutter *
                        uWindStrength *
                        0.05 *
                        leafHeight;

                    `
                );

// ==================================================
// FRAGMENT UNIFORMS
// ==================================================

shader.fragmentShader = `

    uniform float uNoiseSeed;
    uniform float uNoiseScale;
    uniform float uNoiseContrast;
    uniform float uNoiseBrightness;
    uniform float uNoiseThreshold;
    uniform float uNoiseSoftness;

    uniform float uProjectionScale;
    uniform float uProjectionRotation;
    uniform vec2 uProjectionOffset;

    uniform bool uNoiseInvert;

    uniform vec3 uColor0;
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform vec3 uColor3;

    varying vec3 vLeafPosition;

` + shader.fragmentShader;


// ==================================================
// PROCEDURAL SIMPLEX FUNCTIONS
//
// IMPORTANT:
// These are inserted at GLOBAL fragment-shader scope,
// NOT inside main().
// ==================================================

shader.fragmentShader = `

    // ==================================================
    // SEEDED HASH
    // ==================================================

    float leafHash21(
        vec2 p,
        float seed
    )
    {
        vec3 p3 =
            fract(
                vec3(
                    p.x,
                    p.y,
                    seed
                ) *
                0.1031
            );

        p3 +=
            dot(
                p3,
                p3.yzx +
                33.33
            );

        return fract(
            (
                p3.x +
                p3.y
            ) *
            p3.z
        );
    }


    // ==================================================
    // GRADIENT
    // ==================================================

    vec2 leafGradient(
        vec2 cell,
        float seed
    )
    {
        float angle =
            leafHash21(
                cell,
                seed
            ) *
            6.28318530718;

        return vec2(
            cos(angle),
            sin(angle)
        );
    }


    // ==================================================
    // SIMPLEX 2D
    //
    // ONE-OCTAVE VERSION
    // ==================================================

    float leafSimplex2D(
        vec2 p,
        float seed
    )
    {
        const float F2 =
            0.3660254037844386;

        const float G2 =
            0.2113248654051871;


        // ==================================================
        // SIMPLEX CELL
        // ==================================================

        float s =
            (
                p.x +
                p.y
            ) *
            F2;

        vec2 ij =
            floor(
                p +
                s
            );

        float t =
            (
                ij.x +
                ij.y
            ) *
            G2;

        vec2 cellOrigin =
            ij -
            t;

        vec2 x0 =
            p -
            cellOrigin;


        // ==================================================
        // CORNER ORDER
        // ==================================================

        vec2 i1;

        if (
            x0.x >
            x0.y
        )
        {
            i1 =
                vec2(
                    1.0,
                    0.0
                );
        }
        else
        {
            i1 =
                vec2(
                    0.0,
                    1.0
                );
        }


        // ==================================================
        // CORNER POSITIONS
        // ==================================================

        vec2 x1 =
            x0 -
            i1 +
            G2;

        vec2 x2 =
            x0 -
            1.0 +
            2.0 *
            G2;


        // ==================================================
        // CONTRIBUTION WEIGHTS
        // ==================================================

        float q0 =
            0.5 -
            dot(
                x0,
                x0
            );

        float q1 =
            0.5 -
            dot(
                x1,
                x1
            );

        float q2 =
            0.5 -
            dot(
                x2,
                x2
            );


        float n0 =
            0.0;

        float n1 =
            0.0;

        float n2 =
            0.0;


        // ==================================================
        // CORNER 0
        // ==================================================

        if (
            q0 >
            0.0
        )
        {
            vec2 g0 =
                leafGradient(
                    ij,
                    seed
                );

            n0 =
                q0 *
                q0 *
                q0 *
                q0 *
                dot(
                    g0,
                    x0
                );
        }


        // ==================================================
        // CORNER 1
        // ==================================================

        if (
            q1 >
            0.0
        )
        {
            vec2 g1 =
                leafGradient(
                    ij +
                    i1,
                    seed
                );

            n1 =
                q1 *
                q1 *
                q1 *
                q1 *
                dot(
                    g1,
                    x1
                );
        }


        // ==================================================
        // CORNER 2
        // ==================================================

        if (
            q2 >
            0.0
        )
        {
            vec2 g2 =
                leafGradient(
                    ij +
                    vec2(
                        1.0,
                        1.0
                    ),
                    seed
                );

            n2 =
                q2 *
                q2 *
                q2 *
                q2 *
                dot(
                    g2,
                    x2
                );
        }


        // ==================================================
        // NORMALIZATION
        // ==================================================

        float result =
            0.5 +
            (
                70.0 *
                (
                    n0 +
                    n1 +
                    n2
                )
            ) /
            1.5;

        return clamp(
            result,
            0.0,
            1.0
        );
    }


` + shader.fragmentShader;


// ==================================================
// FOLIAGE COLOR
// ==================================================

shader.fragmentShader =
    shader.fragmentShader.replace(

        "#include <map_fragment>",

        `

        // ==================================================
        // ORIGINAL GLB TEXTURE
        //
        // RGB is replaced by procedural color.
        // Alpha is preserved.
        // ==================================================

        vec4 sampledDiffuseColor =
            texture2D(
                map,
                vMapUv
            );

        diffuseColor.a *=
            sampledDiffuseColor.a;


        // ==================================================
        // YZ PROJECTION
        //
        // Configuration:
        //
        // noiseScale       = 2.0
        // projectionScale  = 0.25
        // rotation         = 30 degrees
        // offset           = (0.35, 0.455)
        // mirror           = true
        // invert           = true
        // ==================================================

        vec2 leafNoiseUV =
            vLeafPosition.yz;


        leafNoiseUV *=
            uProjectionScale *
            uNoiseScale;


        // Center
        leafNoiseUV -=
            0.5;


        // Rotation
        float projectionCos =
            cos(
                uProjectionRotation
            );

        float projectionSin =
            sin(
                uProjectionRotation
            );


        leafNoiseUV =
            mat2(
                projectionCos,
                -projectionSin,
                projectionSin,
                projectionCos
            ) *
            leafNoiseUV;


        // Offset
        leafNoiseUV +=
            0.5 +
            uProjectionOffset;


        // ==================================================
        // MIRROR
        // ==================================================

        leafNoiseUV =
            abs(
                leafNoiseUV
            );


        // ==================================================
        // ONE-OCTAVE SIMPLEX
        //
        // EXACTLY ONE CALL.
        //
        // No:
        // - FBM
        // - domain warp
        // - triplanar
        // ==================================================

        float noise =
            leafSimplex2D(
                leafNoiseUV,
                uNoiseSeed
            );


        // ==================================================
        // CONTRAST
        // ==================================================

        noise =
            pow(
                max(
                    0.0,
                    min(
                        1.0,
                        noise
                    )
                ),
                1.0 /
                max(
                    0.001,
                    uNoiseContrast
                )
            );


        // ==================================================
        // BRIGHTNESS
        // ==================================================

        noise =
            min(
                1.0,
                max(
                    0.0,
                    noise +
                    uNoiseBrightness
                )
            );


        // ==================================================
        // THRESHOLD
        // ==================================================

        float edge =
            max(
                0.0001,
                uNoiseSoftness
            );


        noise =
            smoothstep(
                uNoiseThreshold -
                edge,

                uNoiseThreshold +
                edge,

                noise
            );


        // ==================================================
        // INVERT
        // ==================================================

        if (
            uNoiseInvert
        )
        {
            noise =
                1.0 -
                noise;
        }


        // ==================================================
        // FOUR-COLOR PALETTE
        // ==================================================

        vec3 proceduralColor;


        if (
            noise <
            0.3333
        )
        {
            proceduralColor =
                mix(
                    uColor0,
                    uColor1,
                    noise *
                    3.0
                );
        }
        else if (
            noise <
            0.6666
        )
        {
            proceduralColor =
                mix(
                    uColor1,
                    uColor2,
                    (
                        noise -
                        0.3333
                    ) *
                    3.0
                );
        }
        else
        {
            proceduralColor =
                mix(
                    uColor2,
                    uColor3,
                    (
                        noise -
                        0.6666
                    ) *
                    3.0
                );
        }


        // ==================================================
        // FINAL COLOR
        // ==================================================

        diffuseColor.rgb =
            proceduralColor;

        `
    );


        };

    // ========================================================
    // CUSTOM LEAF SHADOW MATERIAL
    //
    // SAME GLB TEXTURE
    // SAME ALPHA
    // SAME WIND
    // ========================================================

    const shadowMaterial =
        new THREE.ShaderMaterial({

            uniforms: {

                map: {
                    value:
                        texture
                },

                uTime: {
                    value:
                        0
                },

                uWindStrength: {
                    value:
                        windStrength
                },

                uWindSpeed: {
                    value:
                        windSpeed
                },

                uWindScale: {
                    value:
                        windScale
                }
            },

            // ==================================================
            // SHADOW VERTEX SHADER
            // ==================================================

            vertexShader: /* glsl */`

                uniform float uTime;
                uniform float uWindStrength;
                uniform float uWindSpeed;
                uniform float uWindScale;

                varying vec2 vUv;

                void main() {

                    // =========================================
                    // UV
                    // =========================================

                    vUv =
                        uv;

                    vec3 p =
                        position;

                    // =========================================
                    // WORLD POSITION
                    // =========================================

                    vec3 worldPos =
                        (
                            modelMatrix *
                            vec4(
                                position,
                                1.0
                            )
                        ).xyz;

                    // =========================================
                    // WIND PHASE
                    // =========================================

                    float phase =
                        worldPos.x *
                        uWindScale *
                        0.35

                        +

                        worldPos.z *
                        uWindScale *
                        0.25

                        +

                        uTime *
                        uWindSpeed;

                    // =========================================
                    // WIND WAVES
                    // =========================================

                    float wind1 =
                        sin(
                            phase
                        );

                    float wind2 =
                        sin(
                            phase *
                            1.73
                            +
                            2.4
                        );

                    float wind3 =
                        sin(
                            phase *
                            3.91
                            +
                            1.2
                        );

                    float wind =
                        wind1 *
                        0.55

                        +

                        wind2 *
                        0.30

                        +

                        wind3 *
                        0.15;

                    // =========================================
                    // HEIGHT
                    // =========================================

                    float height =
                        clamp(
                            position.y *
                            0.5 +
                            0.5,
                            0.20,
                            1.0
                        );

                    // =========================================
                    // MAIN SWAY
                    // =========================================

                    p.x +=
                        wind *
                        uWindStrength *
                        height;

                    p.z +=
                        wind *
                        uWindStrength *
                        0.40 *
                        height;

                    // =========================================
                    // FLUTTER
                    // =========================================

                    float flutter =
                        sin(
                            uTime *
                            uWindSpeed *
                            2.5

                            +

                            worldPos.x *
                            4.0

                            +

                            worldPos.z *
                            3.0
                        );

                    p.x +=
                        flutter *
                        uWindStrength *
                        0.12 *
                        height;

                    p.z +=
                        flutter *
                        uWindStrength *
                        0.05 *
                        height;

                    // =========================================
                    // FINAL POSITION
                    // =========================================

                    gl_Position =
                        projectionMatrix *
                        modelViewMatrix *
                        vec4(
                            p,
                            1.0
                        );
                }

            `,

            // ==================================================
            // SHADOW FRAGMENT SHADER
            // ==================================================

            fragmentShader: /* glsl */`

                uniform sampler2D map;

                varying vec2 vUv;

                void main() {

                    // =========================================
                    // SAMPLE SAME GLB TEXTURE
                    // =========================================

                    vec4 diffuse =
                        texture2D(
                            map,
                            vUv
                        );

                    // =========================================
                    // ALPHA CUTOUT
                    //
                    // KEEP EXACTLY AS BEFORE
                    // =========================================

                    if (
                        diffuse.a <
                        0.5
                    )
                    {
                        discard;
                    }

                    // =========================================
                    // SHADOW OUTPUT
                    // =========================================

                    gl_FragColor =
                        vec4(
                            0.0,
                            0.0,
                            0.0,
                            1.0
                        );
                }

            `,

            side:
                THREE.DoubleSide,

            transparent:
                false,

            depthWrite:
                true,

            depthTest:
                true
        });

    // ========================================================
    // TIME UPDATE
    // ========================================================

    function updateTime() {

        const time =
            performance.now() /
            1000.0;

        // ================================================
        // VISIBLE LEAF SHADER
        // ================================================

        const shader =
            leafMaterial
                .userData
                .leafShader;

        if (
            shader &&
            shader.uniforms.uLeafTime
        ) {

            shader
                .uniforms
                .uLeafTime
                .value =
                    time;
        }

        // ================================================
        // SHADOW
        // ================================================

        shadowMaterial
            .uniforms
            .uTime
            .value =
                time;
    }

    // ========================================================
    // RENDER CALLBACKS
    // ========================================================

    leafMaterial.onBeforeRender =
        updateTime;

    shadowMaterial.onBeforeRender =
        updateTime;

    // ========================================================
    // STORE SHADOW MATERIAL
    // ========================================================

    leafMaterial.userData =
        leafMaterial.userData ||
        {};

    leafMaterial.userData.leafShadowMaterial =
        shadowMaterial;

    // ========================================================
    // UPDATE
    // ========================================================

    leafMaterial.needsUpdate =
        true;

    shadowMaterial.needsUpdate =
        true;

    return leafMaterial;
}
import * as THREE from "three";

// ============================================================
// LEAF SHADER
// MeshStandardMaterial + wind + stylized foliage gradient
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
            // COLOR UNIFORMS
            // ==================================================
            // const R=1.0;
            // const G=0.13;
            // const B=1.0;
            shader.uniforms.uDarkGreen = {
                value:
                    new THREE.Color(
                        0.015, 
                        0.16,
                        0.21
                        // R,G,B
                    )
            };

            shader.uniforms.uTealGreen = {
                value:
                    new THREE.Color(
                        0.015,
                        0.48,
                        0.39
                        // R,G,B
                    )
            };

            shader.uniforms.uBrightGreen = {
                value:
                    new THREE.Color(
                        0.03,
                        0.95,
                        0.34
                        // R,G,B
                    )
            };

            shader.uniforms.uLeafTint = {
                value:
                    leafColor.clone()
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
                            position.y * 0.5 + 0.5,
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

                uniform vec3 uDarkGreen;
                uniform vec3 uTealGreen;
                uniform vec3 uBrightGreen;
                uniform vec3 uLeafTint;

            ` + shader.fragmentShader;

            // ==================================================
            // FOLIAGE COLOR
            // ==================================================

            shader.fragmentShader =
                shader.fragmentShader.replace(

                    "#include <map_fragment>",

                    `

                    // =========================================
                    // ORIGINAL TEXTURE
                    // =========================================

                    vec4 sampledDiffuseColor =
                        texture2D(
                            map,
                            vMapUv
                        );

                    // =========================================
                    // PRESERVE ORIGINAL ALPHA
                    // =========================================

                    diffuseColor.a *=
                        sampledDiffuseColor.a;

                    // =========================================
                    // LEAF GRADIENT
                    // =========================================
                    //
                    // Left  = deep blue / teal
                    // Middle = turquoise
                    // Right = vivid green
                    //
                    // =========================================

                    float leafGradient =
                        smoothstep(
                            0.0,
                            1.0,
                            vMapUv.x
                        );

                    vec3 leafGradientColor;

                    if (
                        leafGradient < 0.5
                    ) {

                        leafGradientColor =
                            mix(
                                uDarkGreen,
                                uTealGreen,
                                leafGradient * 2.0
                            );

                    } else {

                        leafGradientColor =
                            mix(
                                uTealGreen,
                                uBrightGreen,
                                (leafGradient - 0.5) * 2.0
                            );
                    }

                    // =========================================
                    // TEXTURE BRIGHTNESS
                    // =========================================
                    //
                    // Keep the original texture's detail,
                    // but let the gradient dominate.
                    //
                    // =========================================

                    float textureBrightness =
                        dot(
                            sampledDiffuseColor.rgb,
                            vec3(
                                0.2126,
                                0.7152,
                                0.0722
                            )
                        );

                    textureBrightness =
                        mix(
                            0.75,
                            1.15,
                            textureBrightness
                        );

                    // =========================================
                    // APPLY STRONG GRADIENT
                    // =========================================

                    diffuseColor.rgb =
                        leafGradientColor *
                        textureBrightness;

                    // =========================================
                    // TINT CONTROL
                    // =========================================

                    diffuseColor.rgb *=
                        mix(
                            vec3(1.0),
                            uLeafTint * 2.0,
                            0.20
                        );

                    `
                );

        };

    // ========================================================
    // CUSTOM LEAF SHADOW MATERIAL
    // ========================================================
    //
    // SAME GLB TEXTURE
    // SAME ALPHA
    // SAME WIND
    //
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
                        wind1 * 0.55
                        +
                        wind2 * 0.30
                        +
                        wind3 * 0.15;

                    // =========================================
                    // HEIGHT
                    // =========================================

                    float height =
                        clamp(
                            position.y * 0.5 + 0.5,
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
                    // =========================================
                    //
                    // KEEP EXACTLY AS BEFORE
                    //
                    // =========================================

                    if (
                        diffuse.a < 0.5
                    ) {

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
        leafMaterial.userData || {};

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
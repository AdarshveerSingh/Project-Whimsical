import * as THREE from "three";

// ============================================================
// LEAF SHADER
// MeshStandardMaterial + wind + stylized foliage gradient
// ============================================================
const LEAF_WIND_GLSL = /* glsl */`
    #ifdef USE_INSTANCING
        vec3 leafWorldPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
    #else
        vec3 leafWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
    #endif

    float leafPhase = leafWorldPos.x * uWindScale * 0.35
                    + leafWorldPos.z * uWindScale * 0.25
                    + uLeafTime * uWindSpeed;

    float wind = sin(leafPhase) * 0.55
               + sin(leafPhase * 1.73 + 2.4) * 0.30
               + sin(leafPhase * 3.91 + 1.2) * 0.15;

    float leafHeight = clamp(position.y * 0.5 + 0.5, 0.20, 1.0);

    transformed.x += wind * uWindStrength * leafHeight;
    transformed.z += wind * uWindStrength * 0.40 * leafHeight;

    float flutter = sin(uLeafTime * uWindSpeed * 2.5
                      + leafWorldPos.x * 4.0 + leafWorldPos.z * 3.0);

    transformed.x += flutter * uWindStrength * 0.12 * leafHeight;
    transformed.z += flutter * uWindStrength * 0.05 * leafHeight;
`;

const LEAF_WIND_UNIFORMS_GLSL = /* glsl */`
    uniform float uLeafTime;
    uniform float uWindStrength;
    uniform float uWindSpeed;
    uniform float uWindScale;
`;
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
    const sharedUniforms = {
    uLeafTime:     { value: 0 },
    uWindStrength: { value: windStrength },
    uWindSpeed:    { value: windSpeed },
    uWindScale:    { value: windScale }
};
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
        new THREE.MeshLambertMaterial({

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

            Object.assign(shader.uniforms, sharedUniforms);

            // ==================================================
            // COLOR UNIFORMS
            // ==================================================
            // const R=1.0;
            // const G=0.13;
            // const B=1.0;
            shader.uniforms.uDarkGreen = {
                value:
                    new THREE.Color(
                    "#213a35"
                        // R,G,B
                    )
            };

            shader.uniforms.uTealGreen = {
                value:
                    new THREE.Color(
                      "#57b6a3"
                    )
            };

            shader.uniforms.uBrightGreen = {
                value:
                    new THREE.Color(
                       "#56f6ab"
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

            // ==================================================
            // WIND
            // ==================================================

            shader.vertexShader = LEAF_WIND_UNIFORMS_GLSL + shader.vertexShader;

shader.vertexShader = shader.vertexShader.replace(
    "#include <begin_vertex>",
    `#include <begin_vertex>
     ${LEAF_WIND_GLSL}`
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

const depthMaterial = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    map: texture,
    alphaTest: 0.5,
    side: THREE.DoubleSide
});

depthMaterial.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, sharedUniforms);

    shader.vertexShader = LEAF_WIND_UNIFORMS_GLSL + shader.vertexShader;

    shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
         ${LEAF_WIND_GLSL}`
    );
};

// separate cache key so it never shares a program with a plain depth material
depthMaterial.customProgramCacheKey = () => "leaf-depth-wind";

leafMaterial.userData.leafDepthMaterial = depthMaterial;
leafMaterial.userData.leafTime = sharedUniforms.uLeafTime;

leafMaterial.needsUpdate = true;
depthMaterial.needsUpdate = true;
   leafMaterial.customProgramCacheKey = () => "leaf-lambert-wind";
return leafMaterial;
}
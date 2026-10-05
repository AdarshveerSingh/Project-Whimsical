import * as THREE from "three";


// ============================================================
// LEAF SHADER
// ============================================================

export function applyLeafShader(
    originalMaterial,
    {
        windStrength = 0.28,
        windSpeed = 1.2,
        windScale = 0.8,

        leafMin = new THREE.Vector3(0, 0, 0),
        leafMax = new THREE.Vector3(1, 1, 1)
    } = {}
) {

    // --------------------------------------------------------
    // MATERIAL
    // --------------------------------------------------------

    const material =
        originalMaterial.clone();

    material.transparent = false;
    material.depthWrite = true;
    material.depthTest = true;
    material.side = THREE.DoubleSide;

    material.roughness = 0.85;
    material.metalness = 0.0;

    material.fog = true;

    if (material.map) {
        material.map.wrapS = THREE.RepeatWrapping;
        material.map.wrapT = THREE.RepeatWrapping;
    }


    // ========================================================
    // SHADER COMPILE
    // ========================================================

    material.onBeforeCompile = (shader) => {

        // ----------------------------------------------------
        // WIND UNIFORMS
        // ----------------------------------------------------

        shader.uniforms.uLeafTime = {
            value: 0
        };

        shader.uniforms.uWindStrength = {
            value: windStrength
        };

        shader.uniforms.uWindSpeed = {
            value: windSpeed
        };

        shader.uniforms.uWindScale = {
            value: windScale
        };


        // ----------------------------------------------------
        // PALETTE
        // ----------------------------------------------------

        shader.uniforms.uColor0 = {
            value: new THREE.Color("#213a35")
        };

        shader.uniforms.uColor1 = {
            value: new THREE.Color("#57b6a3")
        };

        shader.uniforms.uColor2 = {
            value: new THREE.Color("#62ac96")
        };

        shader.uniforms.uColor3 = {
            value: new THREE.Color("#56f6ab")
        };


        // ----------------------------------------------------
        // NOISE
        // ----------------------------------------------------

        shader.uniforms.uNoiseScale = {
            value: 2.0
        };

        shader.uniforms.uNoiseContrast = {
            value: 1.23
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

        shader.uniforms.uMapRotation = {
            value: THREE.MathUtils.degToRad(30)
        };

        shader.uniforms.uOffsetX = {
            value: 0.35
        };

        shader.uniforms.uOffsetY = {
            value: 0.455
        };


        // ----------------------------------------------------
        // MODEL BOUNDS
        // ----------------------------------------------------

        shader.uniforms.uLeafMin = {
            value: leafMin.clone()
        };

        shader.uniforms.uLeafMax = {
            value: leafMax.clone()
        };


        // ====================================================
        // VERTEX SHADER
        // ====================================================

        shader.vertexShader =
            shader.vertexShader.replace(

                "#include <common>",

                `
                #include <common>

uniform float uLeafTime;
uniform float uWindStrength;
uniform float uWindSpeed;
uniform float uWindScale;

uniform vec3 uLeafMin;
uniform vec3 uLeafMax;

varying vec3 vLeafLocalPosition;
varying vec2 vLeafMapUv;
                `
            );


        // ----------------------------------------------------
        // IMPORTANT:
        // ONE begin_vertex replacement only.
        //
        // This preserves the original wind logic while also
        // capturing the position BEFORE wind is applied.
        // ----------------------------------------------------

        shader.vertexShader =
            shader.vertexShader.replace(

                "#include <begin_vertex>",

                `
#include <begin_vertex>

vLeafLocalPosition = position;
vLeafMapUv = uv;


// ============================================================
// WIND
// ============================================================

float windTime =
    uLeafTime * uWindSpeed;


// ------------------------------------------------------------
// ONE PHASE PER TREE
// ------------------------------------------------------------

float treeWindPhase = 0.0;

#ifdef USE_INSTANCING

    treeWindPhase =
        instanceMatrix[3].x * 0.017 +
        instanceMatrix[3].z * 0.013;

#else

    treeWindPhase =
        modelMatrix[3].x * 0.017 +
        modelMatrix[3].z * 0.013;

#endif


// ------------------------------------------------------------
// LARGE SWAY
// ------------------------------------------------------------

float wave1 =
    sin(
        windTime +
        treeWindPhase
    );

float wave2 =
    sin(
        windTime * 1.73 +
        treeWindPhase * 1.37
    );

float wave3 =
    sin(
        windTime * 3.91 +
        treeWindPhase * 2.71
    );

float combinedWind =
    wave1 * 0.55 +
    wave2 * 0.30 +
    wave3 * 0.15;


// ------------------------------------------------------------
// HEIGHT
// ------------------------------------------------------------

float leafHeight =
    max(
        uLeafMax.y -
        uLeafMin.y,
        0.0001
    );

float normalizedHeight =
    clamp(
        (
            position.y -
            uLeafMin.y
        ) /
        leafHeight,
        0.0,
        1.0
    );

float heightMask =
    smoothstep(
        0.0,
        1.0,
        normalizedHeight
    );


// ------------------------------------------------------------
// MAIN SWAY
// ------------------------------------------------------------

float sway =
    combinedWind *
    uWindStrength *
    heightMask;

transformed.x += sway;

transformed.z +=
    sway * 0.35;


// ------------------------------------------------------------
// SMALL LEAF FLUTTER
// ------------------------------------------------------------

float leafFlutterPhase =
    position.x * 0.17 +
    position.z * 0.13;

float flutter =
    sin(
        windTime * 3.7 +
        treeWindPhase * 5.1 +
        leafFlutterPhase
    ) *
    0.035 *
    heightMask;

transformed.x += flutter;

transformed.z +=
    flutter * 0.5;
                `
            );


        // ====================================================
        // FRAGMENT SHADER
        // ====================================================

        shader.fragmentShader =
            shader.fragmentShader.replace(

                "#include <common>",

                `
                #include <common>

                uniform vec3 uColor0;
                uniform vec3 uColor1;
                uniform vec3 uColor2;
                uniform vec3 uColor3;

                uniform float uNoiseScale;
                uniform float uNoiseContrast;
                uniform float uNoiseBrightness;
                uniform float uNoiseThreshold;
                uniform float uNoiseSoftness;

                uniform float uProjectionScale;
                uniform float uMapRotation;

                uniform float uOffsetX;
                uniform float uOffsetY;

                uniform vec3 uLeafMin;
                uniform vec3 uLeafMax;

                varying vec3 vLeafLocalPosition;
                varying vec2 vLeafMapUv;
                `
            );


        // ====================================================
        // PROCEDURAL COLOR
        // ====================================================

        shader.fragmentShader =
            shader.fragmentShader.replace(

                "#include <color_fragment>",

                `

                // ------------------------------------------------
                // ORIGINAL TEXTURE
                //
                // "map" already exists because this is a
                // MeshStandardMaterial.
                // DO NOT redeclare it.
                // ------------------------------------------------

                vec4 leafSample =
                    texture2D(
                        map,
                        vLeafMapUv
                    );


                // Preserve alpha from the original leaf texture.

                diffuseColor.a *=
                    leafSample.a;


                if (diffuseColor.a < 0.5) {
                    discard;
                }


                // ------------------------------------------------
                // NORMALIZE POSITION USING MODEL BOUNDS
                // ------------------------------------------------

                vec3 leafSize =
                    max(
                        uLeafMax -
                        uLeafMin,

                        vec3(0.0001)
                    );


                vec3 normalizedLeafPosition =
                    (
                        vLeafLocalPosition -
                        uLeafMin
                    ) /
                    leafSize;


                // ------------------------------------------------
                // YZ PROJECTION
                // ------------------------------------------------

                vec2 noiseUV =
                    normalizedLeafPosition.yz;


                noiseUV *=
                    uProjectionScale *
                    uNoiseScale;


                // ------------------------------------------------
                // ROTATION
                // ------------------------------------------------

                float noiseCos =
                    cos(uMapRotation);

                float noiseSin =
                    sin(uMapRotation);


                noiseUV =
                    mat2(
                        noiseCos,
                        -noiseSin,

                        noiseSin,
                        noiseCos
                    ) *
                    noiseUV;


                // ------------------------------------------------
                // OFFSET
                // ------------------------------------------------

                noiseUV +=
                    vec2(
                        uOffsetX,
                        uOffsetY
                    );


                // ------------------------------------------------
                // MIRROR
                // ------------------------------------------------

                noiseUV =
                    abs(noiseUV);


                // =================================================
                // SIMPLEX 2D
                // =================================================

                vec2 simplexCell =
                    floor(
                        noiseUV +
                        dot(
                            noiseUV,
                            vec2(0.3660254)
                        )
                    );


                vec2 simplexX0 =
                    noiseUV -
                    simplexCell +
                    dot(
                        simplexCell,
                        vec2(0.2113249)
                    );


                vec2 simplexI1;

                if (
                    simplexX0.x >
                    simplexX0.y
                ) {

                    simplexI1 =
                        vec2(1.0, 0.0);

                } else {

                    simplexI1 =
                        vec2(0.0, 1.0);
                }


                vec2 simplexX1 =
                    simplexX0 -
                    simplexI1 +
                    0.2113249;


                vec2 simplexX2 =
                    simplexX0 -
                    1.0 +
                    0.4226498;


                // ------------------------------------------------
                // HASHED GRADIENTS
                // ------------------------------------------------

                vec3 simplexP0 =
                    vec3(
                        simplexCell,
                        0.0
                    );


                vec3 simplexP1 =
                    vec3(
                        simplexCell +
                        simplexI1,
                        0.0
                    );


                vec3 simplexP2 =
                    vec3(
                        simplexCell +
                        1.0,
                        0.0
                    );


                vec2 simplexG0 =
                    normalize(
                        vec2(
                            sin(
                                dot(
                                    simplexP0,
                                    vec3(
                                        127.1,
                                        311.7,
                                        74.7
                                    )
                                )
                            ),

                            cos(
                                dot(
                                    simplexP0,
                                    vec3(
                                        269.5,
                                        183.3,
                                        246.1
                                    )
                                )
                            )
                        )
                    );


                vec2 simplexG1 =
                    normalize(
                        vec2(
                            sin(
                                dot(
                                    simplexP1,
                                    vec3(
                                        127.1,
                                        311.7,
                                        74.7
                                    )
                                )
                            ),

                            cos(
                                dot(
                                    simplexP1,
                                    vec3(
                                        269.5,
                                        183.3,
                                        246.1
                                    )
                                )
                            )
                        )
                    );


                vec2 simplexG2 =
                    normalize(
                        vec2(
                            sin(
                                dot(
                                    simplexP2,
                                    vec3(
                                        127.1,
                                        311.7,
                                        74.7
                                    )
                                )
                            ),

                            cos(
                                dot(
                                    simplexP2,
                                    vec3(
                                        269.5,
                                        183.3,
                                        246.1
                                    )
                                )
                            )
                        )
                    );


                // ------------------------------------------------
                // CONTRIBUTIONS
                // ------------------------------------------------

                float simplexN0 =
                    dot(
                        simplexG0,
                        simplexX0
                    );


                float simplexN1 =
                    dot(
                        simplexG1,
                        simplexX1
                    );


                float simplexN2 =
                    dot(
                        simplexG2,
                        simplexX2
                    );


                float simplexT0 =
                    max(
                        0.5 -
                        dot(
                            simplexX0,
                            simplexX0
                        ),

                        0.0
                    );


                float simplexT1 =
                    max(
                        0.5 -
                        dot(
                            simplexX1,
                            simplexX1
                        ),

                        0.0
                    );


                float simplexT2 =
                    max(
                        0.5 -
                        dot(
                            simplexX2,
                            simplexX2
                        ),

                        0.0
                    );


                float leafNoise =
                    70.0 *
                    (
                        simplexT0 *
                        simplexT0 *
                        simplexT0 *
                        simplexT0 *
                        simplexN0 +

                        simplexT1 *
                        simplexT1 *
                        simplexT1 *
                        simplexT1 *
                        simplexN1 +

                        simplexT2 *
                        simplexT2 *
                        simplexT2 *
                        simplexT2 *
                        simplexN2
                    );


                // ------------------------------------------------
                // NORMALIZE
                // ------------------------------------------------

                leafNoise =
                    leafNoise * 0.5 +
                    0.5;


                // ------------------------------------------------
                // CONTRAST / BRIGHTNESS
                // ------------------------------------------------

                leafNoise =
                    clamp(
                        (
                            leafNoise -
                            0.5
                        ) *
                        uNoiseContrast +
                        0.5 +
                        uNoiseBrightness,

                        0.0,
                        1.0
                    );


                // ------------------------------------------------
                // THRESHOLD
                // ------------------------------------------------

                float noiseLower =
                    uNoiseThreshold -
                    uNoiseSoftness;


                float noiseUpper =
                    uNoiseThreshold +
                    uNoiseSoftness;


                leafNoise =
                    smoothstep(
                        noiseLower,
                        noiseUpper,
                        leafNoise
                    );


                // =================================================
                // FOUR COLOR PALETTE
                // =================================================

                vec3 leafPalette;


                if (
                    leafNoise <
                    0.333333
                ) {

                    float paletteT =
                        leafNoise /
                        0.333333;


                    leafPalette =
                        mix(
                            uColor0,
                            uColor1,
                            paletteT
                        );

                }

                else if (
                    leafNoise <
                    0.666666
                ) {

                    float paletteT =
                        (
                            leafNoise -
                            0.333333
                        ) /
                        0.333333;


                    leafPalette =
                        mix(
                            uColor1,
                            uColor2,
                            paletteT
                        );

                }

                else {

                    float paletteT =
                        (
                            leafNoise -
                            0.666666
                        ) /
                        0.333334;


                    leafPalette =
                        mix(
                            uColor2,
                            uColor3,
                            paletteT
                        );
                }


                // ------------------------------------------------
                // ORIGINAL TEXTURE BRIGHTNESS
                // ------------------------------------------------

                float textureBrightness =
                    dot(
                        leafSample.rgb,
                        vec3(
                            0.2126,
                            0.7152,
                            0.0722
                        )
                    );


                float leafBrightness =
                    mix(
                        0.75,
                        1.15,
                        textureBrightness
                    );


                leafPalette *=
                    leafBrightness;


                // ------------------------------------------------
                // APPLY PALETTE
                // ------------------------------------------------

                diffuseColor.rgb =
                    leafPalette;

                `
            );
            material.userData.shader = shader;
    };


    // ============================================================
    // SHADOW MATERIAL
    // ============================================================

    const shadowMaterial =
        new THREE.MeshBasicMaterial({
            map:
                originalMaterial.map ||
                null,

            transparent: true,
            alphaTest: 0.5,

            depthWrite: true,
            depthTest: true,

            side: THREE.DoubleSide,

            color: 0x000000
        });


    shadowMaterial.onBeforeCompile =
        (shader) => {

            shader.uniforms.uLeafTime = {
                value: 0
            };

            shader.uniforms.uWindStrength = {
                value: windStrength
            };

            shader.uniforms.uWindSpeed = {
                value: windSpeed
            };

            shader.uniforms.uWindScale = {
                value: windScale
            };


            shader.vertexShader =
                shader.vertexShader.replace(

                    "#include <common>",

                    `
                    #include <common>

                    uniform float uLeafTime;
                    uniform float uWindStrength;
                    uniform float uWindSpeed;
                    uniform float uWindScale;
                    `
                );


            shader.vertexShader =
                shader.vertexShader.replace(

                    "#include <begin_vertex>",

                    `
                    #include <begin_vertex>

                    float shadowWindTime =
                        uLeafTime *
                        uWindSpeed;


                    vec3 shadowWindWorldPosition =
                        (
                            modelMatrix *
                            vec4(
                                position,
                                1.0
                            )
                        ).xyz;


                    float shadowWindPhase =
                        shadowWindWorldPosition.x * 0.17 +
                        shadowWindWorldPosition.z * 0.13;


                    float shadowWave1 =
                        sin(
                            shadowWindTime +
                            shadowWindPhase
                        );


                    float shadowWave2 =
                        sin(
                            shadowWindTime * 1.73 +
                            shadowWindPhase * 1.37
                        );


                    float shadowWave3 =
                        sin(
                            shadowWindTime * 3.91 +
                            shadowWindPhase * 2.71
                        );


                    float shadowCombinedWind =
                        shadowWave1 * 0.55 +
                        shadowWave2 * 0.30 +
                        shadowWave3 * 0.15;


                    float shadowHeightMask =
                        smoothstep(
                            0.0,
                            1.0,
                            position.y *
                            uWindScale
                        );


                    float shadowSway =
                        shadowCombinedWind *
                        uWindStrength *
                        shadowHeightMask;


                    transformed.x +=
                        shadowSway;


                    transformed.z +=
                        shadowSway * 0.35;


                    float shadowFlutter =
                        sin(
                            shadowWindTime * 3.7 +
                            shadowWindPhase * 5.1
                        ) *
                        0.035 *
                        shadowHeightMask;


                    transformed.x +=
                        shadowFlutter;


                    transformed.z +=
                        shadowFlutter * 0.5;
                    `
                );
        };


    // ============================================================
    // TIME UPDATE
    // ============================================================

material.onBeforeRender =
    (
        renderer,
        scene,
        camera,
        geometry,
        object
    ) => {

        const shader =
            material.userData.shader;

        if (!shader) {
            return;
        }

        shader.uniforms.uLeafTime.value =
            performance.now() * 0.001;
    };

    material.userData.leafShadowMaterial =
        shadowMaterial;


    // ------------------------------------------------------------
    // STORE COMPILED SHADER
    // ------------------------------------------------------------

    


    return material;
}
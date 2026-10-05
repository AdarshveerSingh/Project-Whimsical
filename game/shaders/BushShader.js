import * as THREE from "three";

export const BushShader = {

    uniforms: {

        // ==================================================
        // ORIGINAL GLB TEXTURE
        // Used ONLY for foliage alpha / silhouette.
        // ==================================================

        map: {
            value: null
        },

        noiseMap: {
            value: null
        },


        // ==================================================
        // FOUR-COLOR FOLIAGE PALETTE
        // ==================================================

        colorMap: {
            value: [
                new THREE.Color("#225158"),
                new THREE.Color("#409171"),
                new THREE.Color("#62ACA0"),
                new THREE.Color("#DFFBAC")
            ]
        },


        // ==================================================
        // COMPLETE BUSH BOUNDS
        // ==================================================

        bushMin: {
            value: new THREE.Vector3()
        },

        bushMax: {
            value: new THREE.Vector3()
        },


        // ==================================================
        // SOURCE MESH TRANSFORM
        // ==================================================

        sourceMatrix: {
            value: new THREE.Matrix4()
        },
        sourceInverseMatrix: {
    value: new THREE.Matrix4()
},

        // ==================================================
        // PALETTE TRANSITION
        // ==================================================

        transitionWidth: {
            value: 0.08
        },


        // ==================================================
        // PROCEDURAL NOISE
        // ==================================================

        noiseSeed: {
            value: 482917
        },

        noiseScale: {
            value: 9.9
        },

        noiseOctaves: {
            value: 7.0
        },

        noiseLacunarity: {
            value: 1.84
        },

        noiseGain: {
            value: 0.57
        },

        noiseContrast: {
            value: 2.03
        },

        noiseBrightness: {
            value: 0.01
        },

        noiseThreshold: {
            value: 0.67
        },

        noiseSoftness: {
            value: 0.496
        },


        // ==================================================
        // DOMAIN WARP
        // ==================================================

        noiseWarpStrength: {
            value: 0.0
        },

        noiseWarpFrequency: {
            value: 0.2
        },


        // ==================================================
        // PROJECTION
        // ==================================================

        projectionScale: {
            value: 0.1
        },

        triplanarSharpness: {
            value: 6.0
        },

        projectionRotation: {
            value: 0.0
        },

        projectionOffset: {
            value: new THREE.Vector2(0.0, 0.0)
        },

        noiseInvert: {
            value: false
        },


        // ==================================================
        // WIND
        // ==================================================

        time: {
            value: 0.0
        },

        windStrength: {
            value: 0.16
        },

        windFrequency: {
            value: 0.18
        },

        windSpeed: {
            value: 0.75
        },

        windDirection: {
            value: new THREE.Vector2(
                1.0,
                0.35
            ).normalize()
        },


        // ==================================================
        // FOG
        // ==================================================

        fogColor: {
            value: new THREE.Color(0x9fc9e8)
        },

        fogNear: {
            value: 100.0
        },

        fogFar: {
            value: 900.0
        }

    },


    // ======================================================
    // VERTEX SHADER
    // ======================================================

    vertexShader: /* glsl */ `

        precision highp float;
        precision highp int;


        // ==================================================
        // THREE.JS SHADOW SYSTEM
        // ==================================================

        #include <common>
        #include <shadowmap_pars_vertex>


        // ==================================================
        // ORIGINAL GLB UV
        // ==================================================

        varying vec2 vUv;


        // ==================================================
        // POSITION IN COMPLETE BUSH LOCAL SPACE
        // ==================================================

        varying vec3 vBushPosition;


        // ==================================================
        // BUSH LOCAL NORMAL
        // ==================================================

        varying vec3 vBushNormal;


        // ==================================================
        // FOG DEPTH
        // ==================================================

        varying float vFogDepth;


        // ==================================================
        // SOURCE MESH TRANSFORM
        // ==================================================

        uniform mat4 sourceMatrix;


        // ==================================================
        // BUSH BOUNDS
        // ==================================================

        uniform vec3 bushMin;
        uniform vec3 bushMax;


        // ==================================================
        // WIND
        // ==================================================

        uniform float time;
        uniform float windStrength;
        uniform float windFrequency;
        uniform float windSpeed;
        uniform vec2 windDirection;


        // ==================================================
        // WIND HASH
        // ==================================================

        float windHash(
            vec2 p
        )
        {

            p =
                fract(
                    p *
                    vec2(
                        123.34,
                        456.21
                    )
                );

            p +=
                dot(
                    p,
                    p + 45.32
                );

            return fract(
                p.x *
                p.y
            );

        }


        // ==================================================
        // VALUE NOISE
        // ==================================================

        float windNoise(
            vec2 p
        )
        {

            vec2 i =
                floor(p);

            vec2 f =
                fract(p);


            f =
                f *
                f *
                (
                    3.0 -
                    2.0 *
                    f
                );


            float a =
                windHash(
                    i
                );

            float b =
                windHash(
                    i +
                    vec2(
                        1.0,
                        0.0
                    )
                );

            float c =
                windHash(
                    i +
                    vec2(
                        0.0,
                        1.0
                    )
                );

            float d =
                windHash(
                    i +
                    vec2(
                        1.0,
                        1.0
                    )
                );


            return mix(
                mix(
                    a,
                    b,
                    f.x
                ),

                mix(
                    c,
                    d,
                    f.x
                ),

                f.y
            );

        }


        // ==================================================
        // WIND FIELD
        // ==================================================

        float getWind(
            vec2 worldXZ
        )
        {

            vec2 direction =
                normalize(
                    windDirection
                );


            // Large-scale movement
            vec2 largeUV =
                worldXZ *
                windFrequency;

            largeUV +=
                direction *
                time *
                windSpeed;


            float largeWind =
                windNoise(
                    largeUV
                );


            // Smaller secondary movement
            vec2 smallUV =
                worldXZ *
                (
                    windFrequency *
                    2.5
                );

            smallUV +=
                direction *
                time *
                windSpeed *
                1.7;


            float smallWind =
                windNoise(
                    smallUV
                );


            // Main + secondary wind
            float wind =
                largeWind *
                0.70 +
                smallWind *
                0.30;


            // Convert 0..1 into a softer
            // positive movement range.
            wind =
                (
                    wind -
                    0.5
                ) *
                2.0;


            return wind;

        }


        // ==================================================
        // MAIN
        // ==================================================

        void main()
        {

            // ==================================================
            // ORIGINAL UV
            // ==================================================

            vUv =
                uv;


            // ==================================================
            // ORIGINAL BUSH LOCAL POSITION
            // ==================================================

            vec4 bushLocalPosition =
                sourceMatrix *
                vec4(
                    position,
                    1.0
                );


            vec3 originalBushPosition =
                bushLocalPosition.xyz;


            vBushPosition =
                originalBushPosition;


            // ==================================================
            // BUSH LOCAL NORMAL
            // ==================================================

            vec3 bushNormal =
                mat3(
                    sourceMatrix
                ) *
                normal;


            vBushNormal =
                normalize(
                    bushNormal
                );


            // ==================================================
            // HEIGHT
            // ==================================================

            float bushHeight =
                max(
                    bushMax.y -
                    bushMin.y,

                    0.0001
                );


            float heightPercent =
                clamp(

                    (
                        originalBushPosition.y -
                        bushMin.y
                    ) /
                    bushHeight,

                    0.0,
                    1.0

                );


            // ==================================================
            // WIND BEND PROFILE
            // ==================================================

            /*
             * Roots remain almost stationary.
             *
             * Upper foliage receives most of the movement.
             */

            float bendProfile =
                heightPercent *
                heightPercent;


            // Keep a little movement near the middle
            // while making the canopy move more.
            bendProfile =
                smoothstep(
                    0.05,
                    0.5,
                    bendProfile
                );


            // ==================================================
            // INSTANCE WORLD POSITION
            // ==================================================

            vec3 instanceWorldPosition =
                (
                    modelMatrix *
                    instanceMatrix *
                    vec4(
                        0.0,
                        0.0,
                        0.0,
                        1.0
                    )
                ).xyz;


            // ==================================================
            // WORLD WIND
            // ==================================================

            float wind =
                getWind(
                    instanceWorldPosition.xz
                );


            // ==================================================
            // SECONDARY SIDE MOVEMENT
            // ==================================================

            float sideNoise =
                windNoise(
                    instanceWorldPosition.xz *
                    0.37 +
                    windDirection *
                    time *
                    windSpeed *
                    0.55
                );


            sideNoise =
                (
                    sideNoise -
                    0.5
                ) *
                2.0;


            // ==================================================
            // WIND DISPLACEMENT
            // ==================================================

            vec2 windOffset =
                windDirection *
                wind *
                windStrength *
                bendProfile;


            // Slight perpendicular movement gives the bush
            // a less mechanical motion.
            vec2 perpendicular =
                vec2(
                    -windDirection.y,
                    windDirection.x
                );


            windOffset +=
                perpendicular *
                sideNoise *
                windStrength *
                0.18 *
                bendProfile;


 bushLocalPosition.xz +=
    windOffset;


// ==================================================
// PRESERVE ORIGINAL INSTANCE TRANSFORM
// ==================================================

vec4 worldPosition =
    modelMatrix *
    instanceMatrix *
    bushLocalPosition;
            // ==================================================
            // SHADOW NORMAL
            // ==================================================

            vec3 transformedNormal =
                normal;


            // ==================================================
            // SHADOW COORDINATES
            // ==================================================

            #include <shadowmap_vertex>


            // ==================================================
            // VIEW POSITION
            // ==================================================

            vec4 mvPosition =
                viewMatrix *
                worldPosition;


            vFogDepth =
                -mvPosition.z;


            // ==================================================
            // FINAL POSITION
            // ==================================================

            gl_Position =
                projectionMatrix *
                mvPosition;

        }

    `,


    // ======================================================
    // FRAGMENT SHADER
    // ======================================================

    fragmentShader: /* glsl */ `

        precision highp float;
        precision highp int;


        // ==================================================
        // THREE.JS SHADOW SYSTEM
        // ==================================================

        #include <common>
        #include <packing>
        #include <lights_pars_begin>
        #include <shadowmap_pars_fragment>
        #include <shadowmask_pars_fragment>


        // ==================================================
        // ORIGINAL GLB TEXTURE
        // ==================================================

        uniform sampler2D map;


        // ==================================================
        // PALETTE
        // ==================================================

        uniform vec3 colorMap[4];


        // ==================================================
        // BUSH BOUNDS
        // ==================================================

        uniform vec3 bushMin;
        uniform vec3 bushMax;


        // ==================================================
        // PALETTE TRANSITION
        // ==================================================

        uniform float transitionWidth;


        // ==================================================
        // NOISE PARAMETERS
        // ==================================================

        uniform float noiseSeed;
        uniform float noiseScale;
        uniform float noiseOctaves;
        uniform float noiseLacunarity;
        uniform float noiseGain;
        uniform float noiseContrast;
        uniform float noiseBrightness;
        uniform float noiseThreshold;
        uniform float noiseSoftness;


        // ==================================================
        // DOMAIN WARP
        // ==================================================

        uniform float noiseWarpStrength;
        uniform float noiseWarpFrequency;


        // ==================================================
        // PROJECTION
        // ==================================================

        uniform float projectionScale;
        uniform float triplanarSharpness;
        uniform float projectionRotation;
        uniform vec2 projectionOffset;
        uniform bool noiseInvert;


        // ==================================================
        // FOG
        // ==================================================

        uniform vec3 fogColor;
        uniform float fogNear;
        uniform float fogFar;


        // ==================================================
        // VARYINGS
        // ==================================================

        varying vec2 vUv;
        varying vec3 vBushPosition;
        varying vec3 vBushNormal;
        varying float vFogDepth;


        // ==================================================
        // SEEDED FLOAT HASH
        // ==================================================

        float hash21(
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
        // GRADIENT VECTOR
        // ==================================================

        vec2 gradient(
            vec2 cell,
            float seed
        )
        {

            float angle =
                hash21(
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
        // ==================================================

        float simplex2D(
            vec2 p,
            float seed
        )
        {

            const float F2 =
                0.3660254037844386;

            const float G2 =
                0.2113248654051871;


            // --------------------------------------------------
            // Simplex cell
            // --------------------------------------------------

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


            // --------------------------------------------------
            // Simplex corner ordering
            // --------------------------------------------------

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


            // --------------------------------------------------
            // Corner positions
            // --------------------------------------------------

            vec2 x1 =
                x0 -
                i1 +
                G2;


            vec2 x2 =
                x0 -
                1.0 +
                2.0 *
                G2;


            // --------------------------------------------------
            // Corner contribution
            // --------------------------------------------------

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


            if (
                q0 >
                0.0
            )
            {

                vec2 g0 =
                    gradient(
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


            if (
                q1 >
                0.0
            )
            {

                vec2 g1 =
                    gradient(
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


            if (
                q2 >
                0.0
            )
            {

                vec2 g2 =
                    gradient(
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


            // --------------------------------------------------
            // Normalization
            // --------------------------------------------------

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


        // ==================================================
        // DOMAIN WARP
        // ==================================================

        vec2 warpPosition(
            vec2 p
        )
        {

            float wx =
                simplex2D(
                    p *
                    noiseWarpFrequency +
                    vec2(
                        13.7,
                        7.1
                    ),
                    noiseSeed +
                    9001.0
                ) -
                0.5;


            float wy =
                simplex2D(
                    p *
                    noiseWarpFrequency +
                    vec2(
                        -5.2,
                        19.4
                    ),
                    noiseSeed +
                    9007.0
                ) -
                0.5;


            return
                p +
                vec2(
                    wx,
                    wy
                ) *
                noiseWarpStrength;

        }


        // ==================================================
        // MULTI-OCTAVE SIMPLEX
        // ==================================================

        float sampleFBM(
            vec2 p
        )
        {

            float amplitude =
                1.0;

            float frequency =
                1.0;

            float sum =
                0.0;

            float normalization =
                0.0;


            for (
                int o = 0;
                o < 8;
                o++
            )
            {

                if (
                    float(o) >=
                    noiseOctaves
                )
                {

                    break;

                }


                float octaveNoise =
                    simplex2D(
                        p *
                        frequency,

                        noiseSeed +
                        float(o) *
                        1013.0
                    );


                sum +=
                    octaveNoise *
                    amplitude;


                normalization +=
                    amplitude;


                frequency *=
                    noiseLacunarity;


                amplitude *=
                    noiseGain;

            }


            return
                sum /
                max(
                    normalization,
                    0.0001
                );

        }


        // ==================================================
        // PLAYGROUND POST PROCESSING
        // ==================================================

        float processNoise(
            vec2 p
        )
        {

            // --------------------------------------------------
            // Domain warp
            // --------------------------------------------------

            p =
                warpPosition(
                    p
                );


            // --------------------------------------------------
            // FBM
            // --------------------------------------------------

            float n =
                sampleFBM(
                    p
                );


            // --------------------------------------------------
            // Contrast
            // --------------------------------------------------

            n =
                pow(
                    max(
                        0.0,
                        min(
                            1.0,
                            n
                        )
                    ),

                    1.0 /
                    max(
                        0.001,
                        noiseContrast
                    )
                );


            // --------------------------------------------------
            // Brightness
            // --------------------------------------------------

            n =
                min(
                    1.0,
                    max(
                        0.0,
                        n +
                        noiseBrightness
                    )
                );


            // --------------------------------------------------
            // Threshold
            // --------------------------------------------------

            float edge =
                max(
                    0.0001,
                    noiseSoftness
                );


            n =
                smoothstep(
                    noiseThreshold -
                    edge,

                    noiseThreshold +
                    edge,

                    n
                );


            // --------------------------------------------------
            // Invert
            // --------------------------------------------------

            if (
                noiseInvert
            )
            {

                n =
                    1.0 -
                    n;

            }


            return clamp(
                n,
                0.0,
                1.0
            );

        }


        // ==================================================
        // BUSH LOCAL COORDINATES
        // ==================================================

        vec3 getBushUV()
        {

            vec3 size =
                max(
                    bushMax -
                    bushMin,

                    vec3(
                        0.0001
                    )
                );


            return
                (
                    vBushPosition -
                    bushMin
                )
                /
                size;

        }


        // ==================================================
        // ROTATE UV
        // ==================================================

        vec2 rotateProjection(
            vec2 uv
        )
        {

            float c =
                cos(
                    projectionRotation
                );

            float s =
                sin(
                    projectionRotation
                );


            vec2 p =
                uv -
                0.5;


            p =
                mat2(
                    c,
                    -s,
                    s,
                    c
                )
                *
                p;


            return
                p +
                0.5 +
                projectionOffset;

        }


        // ==================================================
        // SINGLE PROCEDURAL PROJECTION
        // ==================================================

        float sampleProjection(
            vec2 uv
        )
        {

            uv =
                rotateProjection(
                    uv
                );


            return
                processNoise(
                    uv *
                    projectionScale *
                    noiseScale
                );

        }


        // ==================================================
        // TRIPLANAR
        // ==================================================

        float projectedNoise()
        {

            vec3 q =
                getBushUV();


            vec3 n =
                normalize(
                    abs(
                        vBushNormal
                    )
                );


            n =
                pow(
                    n,
                    vec3(
                        triplanarSharpness
                    )
                );


            n /=
                max(
                    0.0001,
                    n.x +
                    n.y +
                    n.z
                );


            // --------------------------------------------------
            // YZ
            // --------------------------------------------------

            vec2 uvYZ =
                (
                    vBushPosition.yz -
                    bushMin.yz
                )
                /
                max(
                    bushMax.yz -
                    bushMin.yz,

                    vec2(
                        0.0001
                    )
                );


            // --------------------------------------------------
            // XZ
            // --------------------------------------------------

            vec2 uvXZ =
                (
                    vBushPosition.xz -
                    bushMin.xz
                )
                /
                max(
                    bushMax.xz -
                    bushMin.xz,

                    vec2(
                        0.0001
                    )
                );


            // --------------------------------------------------
            // XY
            // --------------------------------------------------

            vec2 uvXY =
                (
                    vBushPosition.xy -
                    bushMin.xy
                )
                /
                max(
                    bushMax.xy -
                    bushMin.xy,

                    vec2(
                        0.0001
                    )
                );


            // --------------------------------------------------
            // SAMPLE
            // --------------------------------------------------

            float a =
                sampleProjection(
                    uvYZ
                );


            float b =
                sampleProjection(
                    uvXZ
                );


            float c =
                sampleProjection(
                    uvXY
                );


            // --------------------------------------------------
            // BLEND
            // --------------------------------------------------

            return
                a * n.x +
                b * n.y +
                c * n.z;

        }


        // ==================================================
        // FOUR COLOR PALETTE
        // ==================================================

        vec3 palette(
            float n
        )
        {

            if (
                n <
                0.3333
            )
            {

                return mix(
                    colorMap[0],
                    colorMap[1],

                    n *
                    3.0
                );

            }


            if (
                n <
                0.6666
            )
            {

                return mix(
                    colorMap[1],
                    colorMap[2],

                    (
                        n -
                        0.3333
                    ) *
                    3.0
                );

            }


            return mix(
                colorMap[2],
                colorMap[3],

                (
                    n -
                    0.6666
                ) *
                3.0
            );

        }


        // ==================================================
        // MAIN
        // ==================================================

        void main()
        {

            // ==================================================
            // ORIGINAL GLB TEXTURE
            // RGB ignored.
            // Alpha preserves leaf silhouette.
            // ==================================================

            vec4 bushTexture =
                texture2D(
                    map,
                    vUv
                );


            // ==================================================
            // ALPHA TEST
            // ==================================================

            if (
                bushTexture.a <
                0.5
            )
            {

                discard;

            }


            // ==================================================
            // PROCEDURAL NOISE
            // ==================================================

            float n =
                projectedNoise();


            // ==================================================
            // PALETTE
            // ==================================================

            vec3 finalColor =
                palette(
                    n
                );


            // ==================================================
            // THREE.JS SHADOW
            // ==================================================

            float shadowMask =
                getShadowMask();


            // ==================================================
            // STYLIZED SHADOW STRENGTH
            //
            // 0.35 = darkest shadow
            // 1.0  = fully lit
            // ==================================================

            float shadowStrength =
                mix(
                    0.35,
                    1.0,
                    shadowMask
                );


            finalColor *=
                shadowStrength;


            // ==================================================
            // FOG
            // ==================================================

            float fogFactor =
                smoothstep(
                    fogNear,
                    fogFar,
                    vFogDepth
                );


            finalColor =
                mix(
                    finalColor,
                    fogColor,
                    fogFactor
                );


            // ==================================================
            // FINAL OUTPUT
            // ==================================================

            gl_FragColor =
                vec4(
                    finalColor,
                    1.0
                );

        }

    `
};
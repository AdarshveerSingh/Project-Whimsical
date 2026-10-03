import * as THREE from "three";

export const BushShader = {

    uniforms: {

        /*
         * ==================================================
         * ORIGINAL GLB TEXTURE
         * ==================================================
         *
         * Used ONLY for the foliage alpha/silhouette.
         */

        map: {
            value: null
        },


        /*
         * ==================================================
         * BUSH MAP
         * ==================================================
         *
         * mapForTest.png
         *
         * This controls the foliage color distribution.
         */

        noiseMap: {
            value: null
        },


        /*
         * ==================================================
         * FOUR-COLOR FOLIAGE PALETTE
         * ==================================================
         */

        colorMap: {
            value: [

                new THREE.Color("#2E6650"),

                new THREE.Color("#43865B"),

                new THREE.Color("#63AD63"),

                new THREE.Color("#87DB53")

            ]
        },


        /*
         * ==================================================
         * COMPLETE BUSH BOUNDS
         * ==================================================
         *
         * These are calculated for the entire Bush_XX
         * variation in variation-local space.
         */

        bushMin: {
            value:
                new THREE.Vector3()
        },

        bushMax: {
            value:
                new THREE.Vector3()
        },


        /*
         * ==================================================
         * SOURCE MESH TRANSFORM
         * ==================================================
         *
         * Converts each source mesh into the common
         * Bush_XX coordinate system.
         */

        sourceMatrix: {
            value:
                new THREE.Matrix4()
        },


        /*
         * ==================================================
         * COLOR TRANSITION
         * ==================================================
         */

        transitionWidth: {
            value: 0.08
        }

    },


    /*
     * ======================================================
     * VERTEX SHADER
     * ======================================================
     */

    vertexShader: /* glsl */ `

        precision highp float;
        precision highp int;


        /*
         * --------------------------------------------------
         * ORIGINAL GLB UV
         * --------------------------------------------------
         *
         * Used for the original texture alpha.
         */

        varying vec2 vUv;


        /*
         * --------------------------------------------------
         * BUSH-LOCAL POSITION
         * --------------------------------------------------
         *
         * Position inside the complete bush variation.
         */

        varying vec3 vBushPosition;


        /*
         * --------------------------------------------------
         * BUSH-LOCAL NORMAL
         * --------------------------------------------------
         *
         * Used to determine which projection of the map
         * should influence the current foliage surface.
         */

        varying vec3 vBushNormal;


        /*
         * --------------------------------------------------
         * SOURCE TRANSFORM
         * --------------------------------------------------
         */

        uniform mat4 sourceMatrix;


        void main() {

            /*
             * ==================================================
             * ORIGINAL UV
             * ==================================================
             */

            vUv =
                uv;


            /*
             * ==================================================
             * BUSH-LOCAL POSITION
             * ==================================================
             *
             * This converts the source mesh position into the
             * shared coordinate system of the complete bush.
             *
             * IMPORTANT:
             *
             * No instance position, rotation or scale is
             * included here.
             */

            vec4 bushLocalPosition =
                sourceMatrix *
                vec4(
                    position,
                    1.0
                );


            vBushPosition =
                bushLocalPosition.xyz;


            /*
             * ==================================================
             * BUSH-LOCAL NORMAL
             * ==================================================
             *
             * Used by the fragment shader for triplanar
             * projection.
             */

            vec3 bushNormal =
                mat3(
                    sourceMatrix
                ) *
                normal;


            vBushNormal =
                normalize(
                    bushNormal
                );


            /*
             * ==================================================
             * EXISTING WORLD TRANSFORM
             * ==================================================
             *
             * Preserve the current InstancedMesh architecture.
             */

            vec4 worldPosition =
                modelMatrix *
                instanceMatrix *
                vec4(
                    position,
                    1.0
                );


            /*
             * ==================================================
             * FINAL POSITION
             * ==================================================
             */

            gl_Position =
                projectionMatrix *
                viewMatrix *
                worldPosition;

        }

    `,


    /*
     * ======================================================
     * FRAGMENT SHADER
     * ======================================================
     */

    fragmentShader: /* glsl */ `

        precision highp float;
        precision highp int;


        /*
         * ==================================================
         * ORIGINAL GLB TEXTURE
         * ==================================================
         *
         * Used ONLY for alpha.
         */

        uniform sampler2D map;


        /*
         * ==================================================
         * BUSH COLOR MAP
         * ==================================================
         */

        uniform sampler2D noiseMap;


        /*
         * ==================================================
         * FOUR-COLOR PALETTE
         * ==================================================
         */

        uniform vec3 colorMap[4];


        /*
         * ==================================================
         * COMPLETE BUSH BOUNDS
         * ==================================================
         */

        uniform vec3 bushMin;

        uniform vec3 bushMax;


        /*
         * ==================================================
         * COLOR TRANSITION
         * ==================================================
         */

        uniform float transitionWidth;


        /*
         * ==================================================
         * VARYINGS
         * ==================================================
         */

        varying vec2 vUv;

        varying vec3 vBushPosition;

        varying vec3 vBushNormal;


        /*
         * ==================================================
         * NORMALIZE BUSH POSITION
         * ==================================================
         *
         * Converts the complete bush into a 0 → 1 coordinate
         * system.
         */

        vec3 getBushUV()
        {

            vec3 bushSize =
                max(

                    bushMax -
                    bushMin,

                    vec3(
                        0.0001
                    )

                );


            return clamp(

                (
                    vBushPosition -
                    bushMin
                )
                /
                bushSize,

                0.0,

                1.0

            );

        }


        /*
         * ==================================================
         * TRIPLANAR MAP SAMPLING
         * ==================================================
         *
         * Instead of projecting mapForTest.png from only
         * the front, we project it from:
         *
         *     X/Y
         *     Z/Y
         *
         * and blend the projections according to the
         * foliage normal.
         *
         * This is particularly useful for billboard foliage.
         */

        float sampleBushMap()
        {

            /*
             * --------------------------------------------------
             * NORMAL
             * --------------------------------------------------
             */

            vec3 normal =
                normalize(
                    vBushNormal
                );


            /*
             * --------------------------------------------------
             * ABSOLUTE NORMAL WEIGHTS
             * --------------------------------------------------
             */

            vec3 weights =
                abs(
                    normal
                );


            /*
             * We mainly care about vertical foliage surfaces.
             *
             * X/Y projection:
             *
             *     x → horizontal
             *     y → vertical
             *
             * Z/Y projection:
             *
             *     z → horizontal
             *     y → vertical
             *
             * X/Z is intentionally given much less influence
             * because it would make the top of the bush behave
             * like a ground plane.
             */

            weights.x =
                weights.x;

            weights.z =
                weights.z;

            weights.y *=
                0.15;


            /*
             * Normalize the weights.
             */

            float weightSum =
                weights.x +
                weights.y +
                weights.z;


            if (
                weightSum < 0.0001
            ) {

                weightSum =
                    1.0;

            }


            weights /=
                weightSum;


            /*
             * --------------------------------------------------
             * BUSH UV
             * --------------------------------------------------
             */

            vec3 bushUV =
                getBushUV();


            /*
             * --------------------------------------------------
             * X/Y PROJECTION
             * --------------------------------------------------
             *
             * This is the projection that gives us the nice
             * front-facing result we already achieved.
             */

            vec2 uvXY =
                clamp(

                    vec2(
                        bushUV.x,
                        bushUV.y
                    ),

                    0.001,
                    0.999

                );


            /*
             * --------------------------------------------------
             * Z/Y PROJECTION
             * --------------------------------------------------
             *
             * This is the projection that prevents the
             * side of the bush from collapsing into a narrow
             * version of the front map.
             */

            vec2 uvZY =
                clamp(

                    vec2(
                        bushUV.z,
                        bushUV.y
                    ),

                    0.001,
                    0.999

                );


            /*
             * --------------------------------------------------
             * X/Z PROJECTION
             * --------------------------------------------------
             *
             * A very weak top projection.
             *
             * This prevents the upper foliage from having
             * completely uniform coloring.
             */

            vec2 uvXZ =
                clamp(

                    vec2(
                        bushUV.x,
                        bushUV.z
                    ),

                    0.001,
                    0.999

                );


            /*
             * --------------------------------------------------
             * SAMPLE THREE DIRECTIONS
             * --------------------------------------------------
             */

            float mapXY =
                dot(

                    texture2D(
                        noiseMap,
                        uvXY
                    ).rgb,

                    vec3(
                        0.299,
                        0.587,
                        0.114
                    )

                );


            float mapZY =
                dot(

                    texture2D(
                        noiseMap,
                        uvZY
                    ).rgb,

                    vec3(
                        0.299,
                        0.587,
                        0.114
                    )

                );


            float mapXZ =
                dot(

                    texture2D(
                        noiseMap,
                        uvXZ
                    ).rgb,

                    vec3(
                        0.299,
                        0.587,
                        0.114
                    )

                );


            /*
             * --------------------------------------------------
             * BLEND THE PROJECTIONS
             * --------------------------------------------------
             */

            float value =
                mapXY *
                weights.x

                +

                mapZY *
                weights.z

                +

                mapXZ *
                weights.y;


            return clamp(

                value,

                0.0,

                1.0

            );

        }


        /*
         * ==================================================
         * FOUR-COLOR PALETTE
         * ==================================================
         *
         * Grayscale:
         *
         * 0.00 → dark green
         * 0.25 → dark/mid
         * 0.50 → mid
         * 0.75 → light
         * 1.00 → bright green
         */

        vec3 getBushColor(
            float value
        ) {

            /*
             * --------------------------------------------------
             * DARK → DARK-MID
             * --------------------------------------------------
             */

            if (
                value < 0.25
            ) {

                float t =
                    smoothstep(

                        0.25 -
                        transitionWidth,

                        0.25 +
                        transitionWidth,

                        value

                    );


                return mix(

                    colorMap[0],

                    colorMap[1],

                    t

                );

            }


            /*
             * --------------------------------------------------
             * DARK-MID → LIGHT-MID
             * --------------------------------------------------
             */

            if (
                value < 0.50
            ) {

                float t =
                    smoothstep(

                        0.50 -
                        transitionWidth,

                        0.50 +
                        transitionWidth,

                        value

                    );


                return mix(

                    colorMap[1],

                    colorMap[2],

                    t

                );

            }


            /*
             * --------------------------------------------------
             * LIGHT-MID → LIGHT
             * --------------------------------------------------
             */

            if (
                value < 0.75
            ) {

                float t =
                    smoothstep(

                        0.75 -
                        transitionWidth,

                        0.75 +
                        transitionWidth,

                        value

                    );


                return mix(

                    colorMap[2],

                    colorMap[3],

                    t

                );

            }


            /*
             * --------------------------------------------------
             * BRIGHTEST
             * --------------------------------------------------
             */

            return colorMap[3];

        }


        /*
         * ======================================================
         * MAIN
         * ======================================================
         */

        void main()
        {

            /*
             * ==================================================
             * ORIGINAL GLB TEXTURE
             * ==================================================
             *
             * The RGB values are completely ignored.
             *
             * We only use alpha to preserve the actual
             * foliage silhouette.
             */

            vec4 bushTexture =
                texture2D(

                    map,

                    vUv

                );


            /*
             * ==================================================
             * ALPHA TEST
             * ==================================================
             */

            if (
                bushTexture.a < 0.5
            ) {

                discard;

            }


            /*
             * ==================================================
             * SAMPLE BUSH MAP
             * ==================================================
             */

            float value =
                sampleBushMap();


            /*
             * ==================================================
             * APPLY PALETTE
             * ==================================================
             */

            vec3 finalColor =
                getBushColor(
                    value
                );


            /*
             * ==================================================
             * FINAL OUTPUT
             * ==================================================
             */

            gl_FragColor =
                vec4(

                    finalColor,

                    1.0

                );

        }

    `

};
// ==================================================
// GOD RAYS SHADER
// ==================================================

import * as THREE from "three";

const GodRaysShader = {

    uniforms: {

        tDiffuse: {
            value: null
        },

        sunPosition: {
            value: new THREE.Vector2(
                0.75,
                0.8
            )
        },

        density: {
            value: 0.35
        },

        decay: {
            value: 0.96
        },

        weight: {
            value: 0.06
        },

        exposure: {
            value: 0.5
        },

        intensity: {
            value: 1.0
        },

        color: {
            value: new THREE.Color(
                1.0,
                0.92,
                0.72
            )
        }

    },


    vertexShader: /* glsl */`

        varying vec2 vUv;

        void main() {

            vUv = uv;

            gl_Position =
                projectionMatrix *
                modelViewMatrix *
                vec4(
                    position,
                    1.0
                );

        }

    `,


    fragmentShader: /* glsl */`

        uniform sampler2D tDiffuse;

        uniform vec2 sunPosition;

        uniform float density;
        uniform float decay;
        uniform float weight;
        uniform float exposure;
        uniform float intensity;

        uniform vec3 color;

        varying vec2 vUv;


        void main() {

            vec4 base =
                texture2D(
                    tDiffuse,
                    vUv
                );


            vec2 delta =
                sunPosition -
                vUv;


            vec2 stepUV =
                delta *
                density /
                32.0;


            vec2 uv =
                vUv;


            vec3 ray =
                vec3(
                    0.0
                );


            float illumination =
                1.0;


            for (
                int i = 0;
                i < 32;
                i++
            ) {

                uv +=
                    stepUV;


                uv =
                    clamp(
                        uv,
                        0.0,
                        1.0
                    );


                vec3 sampleColor =
                    texture2D(
                        tDiffuse,
                        uv
                    ).rgb;


                /*
                 * Approximate brightness.
                 */

                float brightness =
                    dot(
                        sampleColor,
                        vec3(
                            0.2126,
                            0.7152,
                            0.0722
                        )
                    );


                /*
                 * Bright areas contribute
                 * to the light shafts.
                 */

                float bright =
                    smoothstep(
                        0.65,
                        1.0,
                        brightness
                    );


                ray +=
                    sampleColor *
                    bright *
                    illumination *
                    weight;


                illumination *=
                    decay;

            }


            /*
             * Fade rays away from the sun.
             */

            float sunDistance =
                distance(
                    vUv,
                    sunPosition
                );


            float fade =
                1.0 -
                smoothstep(
                    0.05,
                    0.75,
                    sunDistance
                );


            ray *=
                fade;


            /*
             * Warm stylized sunlight.
             */

            ray *=
                color *
                exposure *
                intensity;


            vec3 finalColor =
                base.rgb +
                ray;


            gl_FragColor =
                vec4(
                    finalColor,
                    base.a
                );

        }

    `

};


export { GodRaysShader };
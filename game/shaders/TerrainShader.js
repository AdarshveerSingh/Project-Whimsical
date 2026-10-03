import * as THREE from "three";

export const TerrainShader = {

    uniforms: {

        lowColor: {
            value: new THREE.Color(0x0044ff)
        },

        baseColor: {
            value: new THREE.Color(0x00ff00)
        },

        highColor: {
            value: new THREE.Color(0xff2200)
        },

        slopeColor: {
            value: new THREE.Color(0xffff00)
        },

        minHeight: {
            value: 0.0
        },

        maxHeight: {
            value: 2.2
        },

        slopeStart: {
            value: 0.15
        },

        slopeEnd: {
            value: 0.65
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


    // ============================================================
    // VERTEX SHADER
    // ============================================================

    vertexShader: `

        #include <common>
        #include <shadowmap_pars_vertex>

        attribute vec3 color;

        // Surface weights:
        //
        // R = grass
        // G = dirt
        // B = gravel
        // A = rock
        //
        attribute vec4 surfaceWeights;


        varying vec3 vWorldPosition;
        varying vec3 vWorldNormal;

        varying vec3 vSurfaceColor;
        varying vec4 vSurfaceWeights;


        // ==================================================
        // FOG
        // ==================================================

        varying float vFogDepth;


        void main() {

            // ==================================================
            // STANDARD THREE.JS VERTEX TRANSFORMS
            // ==================================================

            #include <beginnormal_vertex>
            #include <defaultnormal_vertex>
            #include <begin_vertex>


            // ==================================================
            // WORLD POSITION
            // ==================================================

            #include <worldpos_vertex>


            vWorldPosition =
                worldPosition.xyz;


            // ==================================================
            // WORLD NORMAL
            // ==================================================

            vWorldNormal =
                normalize(
                    mat3(modelMatrix) *
                    normal
                );


            // ==================================================
            // SURFACE DATA
            // ==================================================

            vSurfaceColor =
                color;


            vSurfaceWeights =
                surfaceWeights;


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
            // OUTPUT
            // ==================================================

            gl_Position =
                projectionMatrix *
                mvPosition;

        }

    `,


    // ============================================================
    // FRAGMENT SHADER
    // ============================================================

    fragmentShader: `

        #include <common>
        #include <packing>
        #include <lights_pars_begin>
        #include <shadowmap_pars_fragment>
        #include <shadowmask_pars_fragment>


        varying vec3 vWorldPosition;
        varying vec3 vWorldNormal;

        varying vec3 vSurfaceColor;
        varying vec4 vSurfaceWeights;


        uniform float minHeight;
        uniform float maxHeight;

        uniform float slopeStart;
        uniform float slopeEnd;


        // ==================================================
        // FOG
        // ==================================================

        uniform vec3 fogColor;

        uniform float fogNear;
        uniform float fogFar;

        varying float vFogDepth;


        // ==================================================
        // HASH
        // ==================================================

        float hash(
            vec2 p
        ) {

            p =
                fract(
                    p *
                    vec2(
                        127.1,
                        311.7
                    )
                );


            p +=
                dot(
                    p,
                    p + 34.5
                );


            return fract(
                sin(
                    p.x *
                    p.y *
                    43758.5453
                )
            );

        }


        // ==================================================
        // VALUE NOISE
        // ==================================================

        float noise(
            vec2 p
        ) {

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
                hash(
                    i
                );


            float b =
                hash(
                    i +
                    vec2(
                        1.0,
                        0.0
                    )
                );


            float c =
                hash(
                    i +
                    vec2(
                        0.0,
                        1.0
                    )
                );


            float d =
                hash(
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
        // FRACTAL TERRAIN NOISE
        // ==================================================

        float surfaceNoise(
            vec2 p
        ) {

            float large =
                noise(
                    p * 0.025
                );


            float medium =
                noise(
                    p * 0.055
                );


            float small =
                noise(
                    p * 0.11
                );


            return
                large * 0.60 +
                medium * 0.30 +
                small * 0.10;

        }


        void main() {

            // ==================================================
            // SURFACE WEIGHTS
            // ==================================================

            float grassWeight =
                vSurfaceWeights.r;


            float dirtWeight =
                vSurfaceWeights.g;


            float gravelWeight =
                vSurfaceWeights.b;


            float rockWeight =
                vSurfaceWeights.a;


            // ==================================================
            // GRASS COLORS
            // ==================================================

            vec3 tipColor =
                vec3(
                    0.50,
                    0.91,
                    0.28
                );


            vec3 darkRootColor =
                vec3(
                    0.08,
                    0.28,
                    0.10
                );


            vec3 grassColor =
                mix(
                    darkRootColor,
                    tipColor,
                    0.55
                );


            // ==================================================
            // DIRT COLORS
            // ==================================================

            vec3 sandDark =
                vec3(
                    0.68,
                    0.56,
                    0.38
                );


            vec3 sandLight =
                vec3(
                    0.92,
                    0.84,
                    0.65
                );


            vec3 sandColor =
                mix(
                    sandDark,
                    sandLight,
                    0.55
                );


            // ==================================================
            // GRAVEL
            // ==================================================

            vec3 gravelColor =
                vec3(
                    0.545,
                    0.541,
                    0.502
                );


            // ==================================================
            // ROCK
            // ==================================================

            vec3 rockColor =
                vec3(
                    0.333,
                    0.345,
                    0.353
                );


            // ==================================================
            // TERRAIN COLOR
            // ==================================================

            vec3 terrainColor =
                grassColor * grassWeight +
                sandColor * dirtWeight +
                gravelColor * gravelWeight +
                rockColor * rockWeight;


            // ==================================================
            // COLOR VARIATION
            // ==================================================

            float variation =
                dot(
                    vSurfaceColor,
                    vec3(
                        0.299,
                        0.587,
                        0.114
                    )
                );


            variation =
                mix(
                    0.94,
                    1.06,
                    variation
                );


            terrainColor *=
                variation;


            // ==================================================
            // SLOPE
            // ==================================================

            float flatness =
                clamp(
                    vWorldNormal.y,
                    0.0,
                    1.0
                );


            float slope =
                1.0 -
                flatness;


            float slopeMask =
                smoothstep(
                    slopeStart,
                    slopeEnd,
                    slope
                );


            // ==================================================
            // SLOPE DARKENING
            // ==================================================

            terrainColor =
                mix(
                    terrainColor,
                    terrainColor * 0.78,
                    slopeMask * 0.28
                );


// ==================================================
// THREE.JS SHADOW
// ==================================================

float shadow = getShadowMask();

// Keep ambient visibility inside shadows.
// 0.50 = darkest possible shadow is 50% of the terrain color.
shadow = mix(0.30, 1.0, shadow);

terrainColor *= shadow;

            // ==================================================
            // FOG
            // ==================================================

            float fogFactor =
                smoothstep(
                    fogNear,
                    fogFar,
                    vFogDepth
                );


            terrainColor =
                mix(
                    terrainColor,
                    fogColor,
                    fogFactor
                );


            // ==================================================
            // OUTPUT
            // ==================================================

            gl_FragColor =
                vec4(
                    terrainColor,
                    1.0
                );

        }

    `
};
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
        }
    },


    vertexShader: `

        attribute vec3 color;

        varying vec3 vWorldPosition;
        varying vec3 vWorldNormal;
        varying vec3 vSurfaceColor;

        void main() {

            vec4 worldPosition =
                modelMatrix *
                vec4(position, 1.0);

            vWorldPosition =
                worldPosition.xyz;

            vWorldNormal =
                normalize(
                    mat3(modelMatrix) *
                    normal
                );

            vSurfaceColor =
                color;

            gl_Position =
                projectionMatrix *
                viewMatrix *
                worldPosition;
        }

    `,


    fragmentShader: `

        varying vec3 vWorldPosition;
        varying vec3 vWorldNormal;
        varying vec3 vSurfaceColor;

        uniform float minHeight;
        uniform float maxHeight;

        uniform float slopeStart;
        uniform float slopeEnd;


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
                mix(a, b, f.x),
                mix(c, d, f.x),
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
            // SOURCE SURFACE
            // ==================================================

            vec3 sourceColor =
                vSurfaceColor;


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
// SURFACE SYSTEM MASK
// SurfaceSystem remains the authority.
// ==================================================

float greenAmount =
    sourceColor.g -
    max(
        sourceColor.r,
        sourceColor.b
    );


// ==================================================
// BASE GRASS MASK
// ==================================================

float grassMask =
    smoothstep(
        0.015,
        0.20,
        greenAmount
    );


// ==================================================
// CONTINUOUS EDGE VARIATION
//
// This does NOT create new grass regions.
// It only breaks up the boundary.
// ==================================================

float edgeNoise =
    surfaceNoise(
        vWorldPosition.xz
    );


// Distance from the middle of the transition.
// 0 = middle of boundary
// 1 = solid grass/dirt
float edgeStrength =
    1.0 -
    abs(
        grassMask * 2.0 -
        1.0
    );


// Very subtle displacement of the boundary.
float edgeOffset =
    (
        edgeNoise -
        0.5
    ) *
    0.035 *
    edgeStrength;


// Apply only to the transition.
grassMask =
    clamp(
        grassMask +
        edgeOffset,
        0.0,
        1.0
    );


// ==================================================
// FINAL GRASS / DIRT COLOR
// ==================================================

vec3 terrainColor =
    mix(
        sandColor,
        grassColor,
        grassMask
    );
            // ==================================================
            // SUBTLE COLOR VARIATION
            // ==================================================

            float variation =
                dot(
                    sourceColor,
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
            // SOFT SLOPE DARKENING
            // ==================================================

            terrainColor =
                mix(
                    terrainColor,
                    terrainColor * 0.78,
                    slopeMask * 0.28
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
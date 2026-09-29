import * as THREE from "three";

export const TerrainShader = {

    uniforms: {

        // LOW = BLUE
        lowColor: {
            value: new THREE.Color(0x0044ff)
        },

        // MID = GREEN
        baseColor: {
            value: new THREE.Color(0x00ff00)
        },

        // HIGH = RED
        highColor: {
            value: new THREE.Color(0xff2200)
        },

        // STEEP SLOPES = YELLOW
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
        varying vec3 vWorldPosition;
        varying vec3 vWorldNormal;

        void main() {

            vec4 worldPosition =
                modelMatrix * vec4(position, 1.0);

            vWorldPosition = worldPosition.xyz;

            vWorldNormal =
                normalize(
                    mat3(modelMatrix) * normal
                );

            gl_Position =
                projectionMatrix *
                viewMatrix *
                worldPosition;
        }
    `,

    fragmentShader: `

        uniform vec3 lowColor;
        uniform vec3 baseColor;
        uniform vec3 highColor;
        uniform vec3 slopeColor;

        uniform float minHeight;
        uniform float maxHeight;

        uniform float slopeStart;
        uniform float slopeEnd;

        varying vec3 vWorldPosition;
        varying vec3 vWorldNormal;


void main() {

    // =========================================
    // HEIGHT
    // =========================================

    float height =
        smoothstep(
            minHeight,
            maxHeight,
            vWorldPosition.y
        );


    // =========================================
    // PLAINS COLOR GRADIENT
    // =========================================

    vec3 baseColor =
        vec3(
            0.28,
            0.68,
            0.16
        );

    vec3 tipColor =
        vec3(
            0.88,
            0.91,
            0.28
        );

    vec3 terrainColor =
        mix(
            baseColor,
            tipColor,
            height
        );


    // =========================================
    // SLOPE
    // =========================================

    float flatness =
        clamp(
            vWorldNormal.y,
            0.0,
            1.0
        );

    float slope =
        1.0 - flatness;

    float slopeMask =
        smoothstep(
            slopeStart,
            slopeEnd,
            slope
        );


    // Slightly darken steep slopes
    terrainColor =
        mix(
            terrainColor,
            terrainColor * 0.72,
            slopeMask * 0.35
        );


    gl_FragColor =
        vec4(
            terrainColor,
            1.0
        );
}
    `
};
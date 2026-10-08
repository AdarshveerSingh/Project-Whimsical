import * as THREE from "three";
// ==================================================
// GrassShader.js
// ==================================================


export function applyGrassShader(
    material,
    curveStrength = 0.35,
    grassWidth = 0.12,
    { animateWind = true } = {}
) {
if (!animateWind) {
    material.defines = {
        ...material.defines,
        GRASS_STATIC: 1
    };
}
    material.onBeforeCompile = (shader) => {

        // ==================================================
        // UNIFORMS
        // ==================================================

        shader.uniforms.curveStrength = {
            value: curveStrength
        };

        shader.uniforms.grassWidth = {
            value: grassWidth
        };

        shader.uniforms.time = {
            value: 0
        };

        shader.uniforms.showNoise = {
            value: false
        };
        shader.uniforms.shadowDarkness = { value: 0.45 };
        shader.uniforms.shadowRootColor = { value: new THREE.Color('#1b7264') };
        shader.uniforms.shadowTipColor = { value: new THREE.Color('#2a8f6a') };
        material.userData.shader = shader;


        // ==================================================
        // VERTEX VARIABLES
        // ==================================================

        shader.vertexShader = `

            uniform float curveStrength;
            uniform float grassWidth;
            uniform float time;

            attribute float instanceCurve;

attribute float instanceColorVariation;

varying float vGrassHeight;
varying float vWindNoise;

// Actual wind bending amount
varying float vBendAmount;

varying float vColorVariation;

        ` + shader.vertexShader;


        // ==================================================
        // NOISE FUNCTIONS
        // ==================================================

        shader.vertexShader =
            shader.vertexShader.replace(

                "#include <common>",

                `

                #include <common>


                // ==================================================
                // RANDOM
                // ==================================================

                float grassRandom2D(vec2 p) {

                    return fract(

                        sin(

                            dot(
                                p,
                                vec2(
                                    127.1,
                                    311.7
                                )
                            )

                        ) *

                        43758.5453123

                    );

                }


                // ==================================================
                // FADE
                // ==================================================

                vec2 grassFade(vec2 t) {

                    return

                        t * t * t *

                        (

                            t *

                            (

                                t * 6.0 -

                                15.0

                            )

                            + 10.0

                        );

                }


                // ==================================================
                // VALUE NOISE
                // ==================================================

                float grassNoise(vec2 p) {

                    vec2 i =
                        floor(p);

                    vec2 f =
                        fract(p);

                    vec2 u =
                        grassFade(f);


                    float a =
                        grassRandom2D(i);


                    float b =
                        grassRandom2D(

                            i +

                            vec2(
                                1.0,
                                0.0
                            )

                        );


                    float c =
                        grassRandom2D(

                            i +

                            vec2(
                                0.0,
                                1.0
                            )

                        );


                    float d =
                        grassRandom2D(

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
                            u.x
                        ),

                        mix(
                            c,
                            d,
                            u.x
                        ),

                        u.y

                    );

                }


                // ==================================================
                // ROTATE AROUND AXIS
                // ==================================================

                vec3 rotateAroundAxis(

                    vec3 point,

                    vec3 axis,

                    float angle

                ) {

                    float s =
                        sin(angle);

                    float c =
                        cos(angle);


                    return

                        point * c

                        +

                        cross(
                            axis,
                            point
                        ) * s

                        +

                        axis *

                        dot(
                            axis,
                            point
                        )

                        *

                        (1.0 - c);

                }

                `

            );


        // ==================================================
        // BEGIN VERTEX
        // ==================================================

 shader.vertexShader = shader.vertexShader.replace(
    "#include <begin_vertex>",
    `
        #include <begin_vertex>

        // ==================================================
        // HEIGHT AND INSTANCE VARIATION
        // ==================================================

        float heightPercent = clamp(
            position.y / 0.8,
            0.0,
            1.0
        );

        vGrassHeight = heightPercent;
        vColorVariation = instanceColorVariation;

        #ifndef GRASS_STATIC

        // ==================================================
        // ROOT WORLD POSITION
        // ==================================================

        vec3 grassBladeWorldPos = (
            modelMatrix *
            instanceMatrix *
            vec4(0.0, 0.0, 0.0, 1.0)
        ).xyz;

        // ==================================================
        // WIND POSITION AND DIRECTION
        // ==================================================

        vec2 windPosition = grassBladeWorldPos.xz;

        // Precalculated normalized direction.
        vec2 windDirection = vec2(0.943858, 0.330350);

        // ==================================================
        // LARGE WIND NOISE
        // ==================================================

        float largeWind = grassNoise(
            windPosition * 0.18 +
            windDirection * time * 0.75
        );

        // ==================================================
        // SMALL WIND NOISE
        // ==================================================

        float smallWind = grassNoise(
            windPosition * 0.45 +
            windDirection * time * 0.60
        );

        // ==================================================
        // COMBINE AND REMAP WIND NOISE
        // ==================================================

        float windNoise = clamp(
            ((largeWind * 0.70 + smallWind * 0.30) - 0.5) * 1.6 + 0.5,
            0.0,
            1.0
        );

        vWindNoise = windNoise;

        // ==================================================
        // BEND PROFILE
        // ==================================================

        float rootBend = smoothstep(
            0.0,
            0.9,
            heightPercent
        );

        float bendProfile = pow(rootBend, 0.65);

        float windAngle = windNoise * bendProfile;

        vBendAmount = clamp(
            windAngle,
            0.0,
            1.0
        );

        // ==================================================
        // INITIAL BEND AND TOTAL BEND
        // ==================================================

        float initialAngle = instanceCurve *
            curveStrength *
            pow(heightPercent, 1.15);

        float totalAngle = initialAngle + windAngle;

        // ==================================================
        // WIND VECTOR AND ROTATION AXIS
        // ==================================================

        vec3 windVector = vec3(
            windDirection.x,
            0.0,
            windDirection.y
        );

        vec3 worldUp = vec3(0.0, 1.0, 0.0);

        vec3 rotationAxis = normalize(
            cross(worldUp, windVector)
        );

        // ==================================================
        // WORLD POSITION
        // ==================================================

        vec3 worldVertex = (
            modelMatrix *
            instanceMatrix *
            vec4(transformed, 1.0)
        ).xyz;

        // ==================================================
        // POSITION RELATIVE TO ROOT
        // ==================================================

        vec3 relativePosition =
            worldVertex - grassBladeWorldPos;

        // ==================================================
        // APPLY BEND
        // ==================================================

        relativePosition = rotateAroundAxis(
            relativePosition,
            rotationAxis,
            totalAngle
        );

        // ==================================================
        // FINAL WORLD POSITION
        // ==================================================

        worldVertex =
            grassBladeWorldPos + relativePosition;

        #else

        // ==================================================
        // STATIC LOD: NO WIND OR BENDING
        // ==================================================

        vWindNoise = 0.0;
        vBendAmount = 0.0;

        vec3 worldVertex = (
            modelMatrix *
            instanceMatrix *
            vec4(transformed, 1.0)
        ).xyz;

        #endif

        // ==================================================
        // VIEW POSITION
        // ==================================================

        vec4 mvPosition = viewMatrix * vec4(worldVertex, 1.0);
    `
);


        // ==================================================
        // PROJECTION
        // ==================================================

        shader.vertexShader =
            shader.vertexShader.replace(

                "#include <project_vertex>",

                `

                gl_Position =

                    projectionMatrix *

                    mvPosition;

                `

            );

        // ==================================================
// SHADOW COORDINATES FOR WIND-DEFORMED GRASS
// ==================================================

shader.vertexShader = shader.vertexShader.replace(
    "#include <shadowmap_vertex>",
    `
        #include <shadowmap_vertex>

        #if NUM_DIR_LIGHT_SHADOWS > 0
            for (
                int i = 0;
                i < NUM_DIR_LIGHT_SHADOWS;
                i++
            ) {
                vDirectionalShadowCoord[i] =
                    directionalShadowMatrix[i] *
                    vec4(worldVertex, 1.0);
            }
        #endif
    `
);
        // ==================================================
        // FRAGMENT VARIABLES
        // ==================================================

        shader.fragmentShader = `

            uniform bool showNoise;

varying float vGrassHeight;

varying float vWindNoise;

varying float vBendAmount;
uniform float shadowDarkness;
uniform vec3 shadowRootColor;
uniform vec3 shadowTipColor;
varying float vColorVariation;

        ` + shader.fragmentShader;

    // Pull in getShadowMask(), which Lambert doesn't include by default.
// It must come after shadowmap_pars_fragment, which it depends on.
shader.fragmentShader = shader.fragmentShader.replace(
    "#include <shadowmap_pars_fragment>",
    `
    #include <shadowmap_pars_fragment>
    #include <shadowmask_pars_fragment>
    `
);
        // ==================================================
        // TEXTURE
        // ==================================================

        // PNG RGB is ignored.
        // Only alpha controls the blade shape.

        shader.fragmentShader =
            shader.fragmentShader.replace(

                "#include <map_fragment>",

                `

                #ifdef USE_MAP

                    vec4 grassTexel =

                        texture2D(

                            map,

                            vMapUv

                        );


                    diffuseColor.a =

                        grassTexel.a;

                #endif

                `

            );


        // ==================================================
        // COLOR
        // ==================================================

        shader.fragmentShader =
            shader.fragmentShader.replace(

                "#include <color_fragment>",

                `

                #include <color_fragment>


                // ==================================================
                // ORIGINAL ROOT COLOR
                // ==================================================

                vec3 rootColor =

                    vec3(

                        0.28,
                        0.68,
                        0.16

                    );


                // ==================================================
                // ORIGINAL TIP COLOR
                // ==================================================

                vec3 tipColor =

                    vec3(

                        0.88,
                        0.91,
                        0.28

                    );


                // ==================================================
                // DARK ROOT COLOR
                // ==================================================

                vec3 darkRootColor =

                    vec3(

                        0.07,
                        0.20,
                        0.20

                    );


                // ==================================================
                // DARK TIP COLOR
                // ==================================================

                vec3 darkTipColor =

                    vec3(

                        0.0,
                        0.36,
                        0.20

                    );


                // ==================================================
                // NOISE CONTROLS COLOR
                // ==================================================
                //
                // BLACK  = original colors
                // GREY   = partially darkened
                // WHITE  = dark colors
                //

                float colorDarkness =

                    smoothstep(

                        0.0,

                        1.0,

                        vWindNoise

                    );


                // ==================================================
                // ROOT COLOR
                // ==================================================

                rootColor =

                    mix(

                        rootColor,

                        darkRootColor,

                        colorDarkness

                    );


                // ==================================================
                // TIP COLOR
                // ==================================================

                tipColor =

                    mix(

                        tipColor,

                        darkTipColor,

                        colorDarkness

                    );


                // ==================================================
                // HEIGHT GRADIENT
                // ==================================================

                float heightColor =

                    smoothstep(

                        0.05,
                        0.95,

                        vGrassHeight

                    );


                vec3 grassColor =

                    mix(

                        rootColor,

                        tipColor,

                        heightColor

                    );


                // ==================================================
                // FINAL COLOR
                // ==================================================

// ==================================================
// PATCH COLOR VARIATION
// ==================================================

float variation =
    vColorVariation *
    0.10;


// ==================================================
// APPLY SUBTLE VARIATION
// ==================================================

grassColor *=
    1.0 +
    variation;


// ==================================================
// FINAL COLOR
// ==================================================

diffuseColor.rgb =
    grassColor;


                // ==================================================
                // NOISE DEBUG OVERLAY
                // ==================================================

                if (

                    showNoise

                ) {

                    diffuseColor.rgb =

                        vec3(

                            vWindNoise

                        );

                }

                `

            );
            // ==================================================
// UNLIT + SHADOWS ONLY
// ==================================================
// Ignore diffuse/ambient/hemisphere lighting entirely.
// Only use the shadow map to darken the grass.

const opaqueChunk = shader.fragmentShader.includes("#include <opaque_fragment>")
    ? "#include <opaque_fragment>"
    : "#include <output_fragment>"; // older three.js versions

shader.fragmentShader = shader.fragmentShader.replace(
    opaqueChunk,
    `
    // 1.0 = fully lit, 0.0 = fully in shadow
    float grassShadow = getShadowMask();

// gradient from root to tip, matching the normal grass gradient
float shadowGradient = smoothstep(0.05, 0.95, vGrassHeight);
vec3 shadowColor = mix(shadowRootColor, shadowTipColor, shadowGradient);

// 1.0 = lit (original color), 0.0 = shadowed (gradient color)
outgoingLight = mix(shadowColor, diffuseColor.rgb, grassShadow);
    

    ${opaqueChunk}
    `
);

    };


    // ==================================================
    // MATERIAL UPDATE
    // ==================================================

    material.needsUpdate = true;

}
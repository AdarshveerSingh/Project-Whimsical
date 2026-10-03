// ==================================================
// GrassShader.js
// ==================================================

export function applyGrassShader(
    material,
    curveStrength = 0.35,
    grassWidth = 0.12
) {

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

        shader.vertexShader =
            shader.vertexShader.replace(

                "#include <begin_vertex>",

                `

                #include <begin_vertex>


                // ==================================================
                // HEIGHT
                // ==================================================

                float heightPercent =

                    clamp(

                        position.y / 0.8,

                        0.0,

                        1.0

                    );


                vGrassHeight =

                    heightPercent;
                
                vColorVariation =
    instanceColorVariation;


                // ==================================================
                // ROOT WORLD POSITION
                // ==================================================

                vec3 grassBladeWorldPos =

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
                // WIND POSITION
                // ==================================================

                vec2 windPosition =

                    grassBladeWorldPos.xz;


                // ==================================================
                // GLOBAL WIND DIRECTION
                // ==================================================

                vec2 windDirection =

                    normalize(

                        vec2(

                            1.0,

                            0.35

                        )

                    );


                // ==================================================
                // LARGE NOISE
                // ==================================================

                float largeWind =

                    grassNoise(

                        windPosition *

                        0.18

                        +

                        windDirection *

                        time *

                        0.75

                    );


                // ==================================================
                // SMALL NOISE
                // ==================================================

                float smallWind =

                    grassNoise(

                        windPosition *

                        0.45

                        +

                        windDirection *

                        time *

                        0.60

                    );


                // ==================================================
                // COMBINE NOISE
                // ==================================================

                float windNoise =

                    largeWind *

                    0.70

                    +

                    smallWind *

                    0.30;


                // ==================================================
                // REMAP NOISE
                // ==================================================

                windNoise =

                    clamp(

                        (windNoise - 0.5) *

                        1.6 +

                        0.5,

                        0.0,

                        1.0

                    );


                // ==================================================
                // SEND NOISE TO FRAGMENT
                // ==================================================

                vWindNoise =

                    windNoise;


                // ==================================================
                // ROOT BEND PROFILE
                // ==================================================

                float rootBend =

                    smoothstep(

                        0.0,

                        0.9,

                        heightPercent

                    );


                // ==================================================
                // BEND PROFILE
                // ==================================================

                float bendProfile =

                    pow(

                        rootBend,

                        0.65

                    );


                // ==================================================
                // WIND ANGLE
                // ==================================================

                float windAngle =

                    windNoise *

                    bendProfile *

                    1.0;


                // ==================================================
                // ACTUAL WIND BEND AMOUNT
                // ==================================================

                vBendAmount =

                    clamp(

                        windAngle,

                        0.0,

                        1.0

                    );


                // ==================================================
                // INITIAL BEND
                // ==================================================

                float initialAngle =

                    instanceCurve *

                    curveStrength *

                    pow(

                        heightPercent,

                        1.15

                    );


                // ==================================================
                // TOTAL BEND
                // ==================================================

                float totalAngle =

                    initialAngle +

                    windAngle;


                // ==================================================
                // WIND VECTOR
                // ==================================================

                vec3 windVector =

                    normalize(

                        vec3(

                            windDirection.x,

                            0.0,

                            windDirection.y

                        )

                    );


                // ==================================================
                // WORLD UP
                // ==================================================

                vec3 worldUp =

                    vec3(

                        0.0,
                        1.0,
                        0.0

                    );


                // ==================================================
                // ROTATION AXIS
                // ==================================================

                vec3 rotationAxis =

                    normalize(

                        cross(

                            worldUp,

                            windVector

                        )

                    );


                // ==================================================
                // WORLD POSITION
                // ==================================================

                vec3 worldVertex =

                    (

                        modelMatrix *

                        instanceMatrix *

                        vec4(

                            transformed,

                            1.0

                        )

                    ).xyz;


                // ==================================================
                // POSITION RELATIVE TO ROOT
                // ==================================================

                vec3 relativePosition =

                    worldVertex -

                    grassBladeWorldPos;


                // ==================================================
                // APPLY BEND
                // ==================================================

                relativePosition =

                    rotateAroundAxis(

                        relativePosition,

                        rotationAxis,

                        totalAngle

                    );


                // ==================================================
                // FINAL WORLD POSITION
                // ==================================================

                worldVertex =

                    grassBladeWorldPos +

                    relativePosition;


                // ==================================================
                // VIEW POSITION
                // ==================================================

                vec4 mvPosition =

                    viewMatrix *

                    vec4(

                        worldVertex,

                        1.0

                    );

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
        // FRAGMENT VARIABLES
        // ==================================================

        shader.fragmentShader = `

            uniform bool showNoise;

varying float vGrassHeight;

varying float vWindNoise;

varying float vBendAmount;

varying float vColorVariation;

        ` + shader.fragmentShader;


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

    };


    // ==================================================
    // MATERIAL UPDATE
    // ==================================================

    material.needsUpdate = true;

}
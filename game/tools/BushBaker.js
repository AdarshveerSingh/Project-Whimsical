import * as THREE from "three";

import {
    GLTFLoader
} from "../node_modules/three/examples/jsm/loaders/GLTFLoader.js";


export class BushBaker {

    constructor(renderer) {

        this.renderer =
            renderer;

        this.loader =
            new GLTFLoader();

    }


    async bakeBush03() {

        const gltf =
            await this.loadGLB(
                "./models/bushes_gn_shader.glb"
            );


        const root =
            gltf.scene;

        root.updateMatrixWorld(true);


        const bush =
            root.getObjectByName(
                "Bush_03_LOD1"
            );


        if (!bush) {

            throw new Error(
                "Bush_03_LOD1 was not found in bushes_gn_shader.glb"
            );

        }


        if (!bush.isMesh) {

            throw new Error(
                "Bush_03_LOD1 is not a Mesh"
            );

        }


        console.log(
            "[BushBaker] Baking:",
            bush.name
        );


        const geometry =
            bush.geometry;


        /*
         * --------------------------------------------------
         * BOUNDS
         * --------------------------------------------------
         */

        geometry.computeBoundingBox();
        geometry.computeVertexNormals();


        const bounds =
            geometry.boundingBox.clone();


        console.log(
            "[BushBaker] bounds:",
            bounds.min,
            bounds.max
        );


        /*
         * --------------------------------------------------
         * SOURCE MATERIAL
         * --------------------------------------------------
         */

        const sourceMaterial =
            Array.isArray(bush.material)
                ? bush.material[0]
                : bush.material;


        const alphaMap =
            sourceMaterial?.map || null;


        /*
         * --------------------------------------------------
         * UV-BAKE GEOMETRY
         *
         * We render the actual bush geometry,
         * but position it in clip-space using UV.
         *
         * Therefore every fragment in the render target
         * corresponds to the original GLB UV.
         * --------------------------------------------------
         */

        const bakeGeometry =
            geometry.clone();


        /*
         * --------------------------------------------------
         * RENDER TARGET
         * --------------------------------------------------
         */

        const size =
            1024;


        const renderTarget =
            new THREE.WebGLRenderTarget(
                size,
                size,
                {

                    minFilter:
                        THREE.LinearFilter,

                    magFilter:
                        THREE.LinearFilter,

                    format:
                        THREE.RGBAFormat,

                    type:
                        THREE.UnsignedByteType,

                    depthBuffer:
                        false,

                    stencilBuffer:
                        false

                }
            );


        renderTarget.texture.name =
            "Bush_03_LOD1_Baked";


        /*
         * --------------------------------------------------
         * BAKE SCENE
         * --------------------------------------------------
         */

        const bakeScene =
            new THREE.Scene();


        const bakeCamera =
            new THREE.OrthographicCamera(
                -1,
                1,
                1,
                -1,
                -1,
                1
            );


        /*
         * --------------------------------------------------
         * MATERIAL
         * --------------------------------------------------
         */

        const material =
            new THREE.ShaderMaterial({

                uniforms: {

                    bushMin: {

                        value:
                            bounds.min.clone()

                    },

                    bushMax: {

                        value:
                            bounds.max.clone()

                    },

                    /*
                     * JSON AUTHORITATIVE VALUES
                     */

                    noiseSeed: {

                        value:
                            482917

                    },

                    noiseScale: {

                        value:
                            2.0

                    },

                    noiseOctaves: {

                        value:
                            7

                    },

                    noiseLacunarity: {

                        value:
                            1.84

                    },

                    noiseGain: {

                        value:
                            0.58

                    },

                    noiseContrast: {

                        value:
                            0.99

                    },

                    noiseBrightness: {

                        value:
                            0.0

                    },

                    noiseThreshold: {

                        value:
                            0.5

                    },

                    noiseSoftness: {

                        value:
                            0.446

                    },

                    noiseWarpStrength: {

                        value:
                            0.0

                    },

                    noiseWarpFrequency: {

                        value:
                            0.2

                    },

                    projectionScale: {

                        value:
                            0.25

                    },

                    triplanarSharpness: {

                        value:
                            1.0

                    },

                    projectionRotation: {

                        value:
                            THREE.MathUtils.degToRad(30)

                    },

                    projectionOffset: {

                        value:
                            new THREE.Vector2(
                                0.35,
                                0.455
                            )

                    },

                    noiseInvert: {

                        value:
                            true

                    },

                    /*
                     * ORIGINAL GLB TEXTURE
                     *
                     * Used only to preserve the
                     * foliage silhouette.
                     */

                    map: {

                        value:
                            alphaMap

                    },

                    colorMap: {

                        value: [

                            new THREE.Color(
                                "#225846"
                            ),

                            new THREE.Color(
                                "#409167"
                            ),

                            new THREE.Color(
                                "#62ac94"
                            ),

                            new THREE.Color(
                                "#d2ff80"
                            )

                        ]

                    }

                },


                vertexShader: /* glsl */ `

                    precision highp float;


                    varying vec2 vUv;

                    varying vec3 vBushPosition;

                    varying vec3 vBushNormal;


                    void main() {

                        vUv =
                            uv;


                        vBushPosition =
                            position;


                        vBushNormal =
                            normalize(
                                normal
                            );


                        /*
                         * UV SPACE
                         *
                         * Convert:
                         *
                         * 0 -> -1
                         * 1 -> +1
                         */

                        vec2 uvPosition =
                            uv * 2.0 - 1.0;


                        gl_Position =
                            vec4(
                                uvPosition,
                                0.0,
                                1.0
                            );

                    }

                `,


                fragmentShader:
                    BUSH_BAKE_FRAGMENT_SHADER

            });


        /*
         * --------------------------------------------------
         * MESH
         * --------------------------------------------------
         */

        const mesh =
            new THREE.Mesh(
                bakeGeometry,
                material
            );


        mesh.frustumCulled =
            false;


        bakeScene.add(
            mesh
        );


        /*
         * --------------------------------------------------
         * CLEAR
         * --------------------------------------------------
         */

        const previousTarget =
            this.renderer.getRenderTarget();


        const previousClearColor =
            this.renderer.getClearColor(
                new THREE.Color()
            ).clone();


        const previousClearAlpha =
            this.renderer.getClearAlpha();


        this.renderer.setRenderTarget(
            renderTarget
        );


        this.renderer.setClearColor(
            0x000000,
            0
        );


        this.renderer.clear(
            true,
            false,
            false
        );


        /*
         * --------------------------------------------------
         * BAKE
         * --------------------------------------------------
         */

        this.renderer.render(
            bakeScene,
            bakeCamera
        );


        /*
         * --------------------------------------------------
         * RESTORE RENDER STATE
         * --------------------------------------------------
         */

        this.renderer.setRenderTarget(
            previousTarget
        );


        this.renderer.setClearColor(
            previousClearColor,
            previousClearAlpha
        );


        /*
         * --------------------------------------------------
         * READ PIXELS
         * --------------------------------------------------
         */

        const pixels =
            new Uint8Array(
                size *
                size *
                4
            );


        this.renderer.readRenderTargetPixels(
            renderTarget,
            0,
            0,
            size,
            size,
            pixels
        );


        /*
         * --------------------------------------------------
         * CREATE CANVAS IMAGE
         * --------------------------------------------------
         */

        const canvas =
            document.createElement(
                "canvas"
            );


        canvas.width =
            size;

        canvas.height =
            size;


        const context =
            canvas.getContext(
                "2d"
            );


        /*
         * WebGL framebuffer is
         * bottom-to-top.
         *
         * Canvas is
         * top-to-bottom.
         */

        const flipped =
            new Uint8ClampedArray(
                pixels.length
            );


        const rowSize =
            size * 4;


        for (
            let y = 0;
            y < size;
            y++
        ) {

            const sourceRow =
                y * rowSize;


            const targetRow =
                (size - y - 1) *
                rowSize;


            flipped.set(
                pixels.subarray(
                    sourceRow,
                    sourceRow + rowSize
                ),
                targetRow
            );

        }


        const imageData =
            new ImageData(
                flipped,
                size,
                size
            );


        context.putImageData(
            imageData,
            0,
            0
        );


        /*
         * --------------------------------------------------
         * DOWNLOAD
         * --------------------------------------------------
         */

        const link =
            document.createElement(
                "a"
            );


        link.download =
            "Bush_03_LOD1_baked.png";


        link.href =
            canvas.toDataURL(
                "image/png"
            );


        link.click();


        /*
         * --------------------------------------------------
         * CLEANUP
         * --------------------------------------------------
         */

        bakeGeometry.dispose();
        material.dispose();
        renderTarget.dispose();


        console.log(
            "[BushBaker] Bush_03_LOD1 bake complete."
        );


        return canvas;

    }


    loadGLB(path) {

        return new Promise(
            (resolve, reject) => {

                this.loader.load(
                    path,
                    resolve,
                    undefined,
                    reject
                );

            }
        );

    }

}


/*
 * ==========================================================
 * STATIC BUSH COLOR SHADER
 * ==========================================================
 *
 * This contains ONLY the part of BushShader that we want
 * to move into the baked texture.
 *
 * Wind / shadows / fog are intentionally NOT here.
 *
 * ==========================================================
 */

const BUSH_BAKE_FRAGMENT_SHADER =
/* glsl */ `

    precision highp float;


    uniform sampler2D map;


    uniform vec3 bushMin;
    uniform vec3 bushMax;


    uniform float noiseSeed;
    uniform float noiseScale;
    uniform int noiseOctaves;
    uniform float noiseLacunarity;
    uniform float noiseGain;

    uniform float noiseContrast;
    uniform float noiseBrightness;

    uniform float noiseThreshold;
    uniform float noiseSoftness;


    uniform float noiseWarpStrength;
    uniform float noiseWarpFrequency;


    uniform float projectionScale;
    uniform float triplanarSharpness;

    uniform float projectionRotation;

    uniform vec2 projectionOffset;


    uniform bool noiseInvert;


    uniform vec3 colorMap[4];


    varying vec2 vUv;
    varying vec3 vBushPosition;
    varying vec3 vBushNormal;


    /*
     * ------------------------------------------------------
     * HASH
     * ------------------------------------------------------
     */

    float hash21(
        vec2 p
    ) {

        p += noiseSeed;

        p =
            fract(
                p * vec2(
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
            p.x * p.y
        );

    }


    /*
     * ------------------------------------------------------
     * SIMPLEX 2D
     * ------------------------------------------------------
     */

    vec3 mod289(
        vec3 x
    ) {

        return x -
            floor(
                x / 289.0
            ) *
            289.0;

    }


    vec2 mod289(
        vec2 x
    ) {

        return x -
            floor(
                x / 289.0
            ) *
            289.0;

    }


    vec3 permute(
        vec3 x
    ) {

        return mod289(
            (
                x * 34.0 + 1.0
            ) * x
        );

    }


    float simplex2D(
        vec2 v
    ) {

        const vec4 C =
            vec4(
                0.211324865405187,
                0.366025403784439,
               -0.577350269189626,
                0.024390243902439
            );


        vec2 i =
            floor(
                v +
                dot(
                    v,
                    C.yy
                )
            );


        vec2 x0 =
            v -
            i +
            dot(
                i,
                C.xx
            );


        vec2 i1;


        if (
            x0.x >
            x0.y
        ) {

            i1 =
                vec2(
                    1.0,
                    0.0
                );

        } else {

            i1 =
                vec2(
                    0.0,
                    1.0
                );

        }


        vec4 x12 =
            x0.xyxy +
            C.xxzz;


        x12.xy -=
            i1;


        i =
            mod289(i);


        vec3 p =
            permute(
                permute(
                    i.y +
                    vec3(
                        0.0,
                        i1.y,
                        1.0
                    )
                )
                +
                i.x +
                vec3(
                    0.0,
                    i1.x,
                    1.0
                )
            );


        vec3 m =
            max(
                0.5 -
                vec3(
                    dot(x0, x0),
                    dot(x12.xy, x12.xy),
                    dot(x12.zw, x12.zw)
                ),
                0.0
            );


        m =
            m * m;


        m =
            m * m;


        vec3 x =
            2.0 *
            fract(
                p * C.www
            ) -
            1.0;


        vec3 h =
            abs(x) -
            0.5;


        vec3 ox =
            floor(
                x + 0.5
            );


        vec3 a0 =
            x -
            ox;


        m *=
            1.79284291400159 -
            0.85373472095314 *
            (
                a0 * a0 +
                h * h
            );


        vec3 g;


        g.x =
            a0.x * x0.x +
            h.x * x0.y;


        g.yz =
            a0.yz *
            x12.xz +
            h.yz *
            x12.yw;


        return 130.0 *
            dot(
                m,
                g
            );

    }


    /*
     * ------------------------------------------------------
     * FBM
     * ------------------------------------------------------
     */

    float fbm(
        vec2 p
    ) {

        float value =
            0.0;


        float amplitude =
            0.5;


        float frequency =
            1.0;


        for (
            int i = 0;
            i < 12;
            i++
        ) {

            if (
                i >=
                noiseOctaves
            ) {

                break;

            }


            value +=
                amplitude *
                simplex2D(
                    p *
                    frequency
                );


            frequency *=
                noiseLacunarity;


            amplitude *=
                noiseGain;

        }


        return value;

    }


    /*
     * ------------------------------------------------------
     * DOMAIN WARP
     * ------------------------------------------------------
     */

    vec2 domainWarp(
        vec2 p
    ) {

        if (
            noiseWarpStrength ==
            0.0
        ) {

            return p;

        }


        float wx =
            fbm(
                p *
                noiseWarpFrequency +
                vec2(
                    17.3,
                    4.7
                )
            );


        float wy =
            fbm(
                p *
                noiseWarpFrequency +
                vec2(
                    -9.1,
                    13.8
                )
            );


        return p +
            vec2(
                wx,
                wy
            ) *
            noiseWarpStrength;

    }


    /*
     * ------------------------------------------------------
     * PROCESS NOISE
     * ------------------------------------------------------
     */

    float processNoise(
        vec2 uv
    ) {

        uv =
            domainWarp(
                uv
            );


        float n =
            fbm(
                uv *
                noiseScale
            );


        /*
         * Convert simplex range
         * approximately [-1,1]
         * into [0,1].
         */

        n =
            n *
            0.5 +
            0.5;


        n =
            clamp(
                n,
                0.0,
                1.0
            );


        /*
         * Contrast
         */

        n =
            pow(
                n,
                1.0 /
                max(
                    noiseContrast,
                    0.0001
                )
            );


        /*
         * Brightness
         */

        n =
            clamp(
                n +
                noiseBrightness,
                0.0,
                1.0
            );


        /*
         * Threshold / softness
         */

        n =
            smoothstep(
                noiseThreshold -
                noiseSoftness,

                noiseThreshold +
                noiseSoftness,

                n
            );


        if (
            noiseInvert
        ) {

            n =
                1.0 -
                n;

        }


        return n;

    }


    /*
     * ------------------------------------------------------
     * ROTATE UV
     * ------------------------------------------------------
     */

    vec2 rotateUV(
        vec2 uv,
        float angle
    ) {

        float c =
            cos(angle);

        float s =
            sin(angle);


        uv -=
            0.5;


        uv =
            mat2(
                c,
               -s,
                s,
                c
            ) *
            uv;


        uv +=
            0.5;


        return uv;

    }


    /*
     * ------------------------------------------------------
     * PROJECTION
     * ------------------------------------------------------
     */

    float sampleProjection(
        vec2 uv
    ) {

        uv =
            rotateUV(
                uv,
                projectionRotation
            );


        uv +=
            projectionOffset;


        return processNoise(
            uv *
            projectionScale
        );

    }


    /*
     * ------------------------------------------------------
     * TRIPLANAR
     * ------------------------------------------------------
     */

    float projectedNoise() {

        vec3 localSize =
            max(
                bushMax -
                bushMin,
                vec3(
                    0.0001
                )
            );


        vec3 normalizedPosition =
            (
                vBushPosition -
                bushMin
            ) /
            localSize;


        vec3 normal =
            normalize(
                abs(
                    vBushNormal
                )
            );


        vec3 weights =
            pow(
                normal,
                vec3(
                    triplanarSharpness
                )
            );


        weights /=
            max(
                dot(
                    weights,
                    vec3(
                        1.0
                    )
                ),
                0.0001
            );


        /*
         * YZ projection
         */

        float xProjection =
            sampleProjection(
                normalizedPosition.yz
            );


        /*
         * XZ projection
         */

        float yProjection =
            sampleProjection(
                normalizedPosition.xz
            );


        /*
         * XY projection
         */

        float zProjection =
            sampleProjection(
                normalizedPosition.xy
            );


        return
            xProjection *
            weights.x +

            yProjection *
            weights.y +

            zProjection *
            weights.z;

    }


    /*
     * ------------------------------------------------------
     * PALETTE
     * ------------------------------------------------------
     */

    vec3 paletteColor(
        float n
    ) {

        if (
            n <
            0.333333
        ) {

            float t =
                n /
                0.333333;


            return mix(
                colorMap[0],
                colorMap[1],
                t
            );

        }


        if (
            n <
            0.666666
        ) {

            float t =
                (
                    n -
                    0.333333
                ) /
                0.333333;


            return mix(
                colorMap[1],
                colorMap[2],
                t
            );

        }


        float t =
            (
                n -
                0.666666
            ) /
            0.333333;


        return mix(
            colorMap[2],
            colorMap[3],
            t
        );

    }


    void main() {

        /*
         * Preserve the original foliage silhouette.
         */

        if (
            map !=
            sampler2D(0)
        ) {

            vec4 foliage =
                texture2D(
                    map,
                    vUv
                );


            if (
                foliage.a <
                0.5
            ) {

                discard;

            }

        }


        float n =
            projectedNoise();


        vec3 finalColor =
            paletteColor(
                n
            );


        gl_FragColor =
            vec4(
                finalColor,
                1.0
            );

    }

`;
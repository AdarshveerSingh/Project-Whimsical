import * as THREE from "three";

import {
    OrbitControls
} from "../node_modules/three/examples/jsm/controls/OrbitControls.js";

import PropDistributionSystem
    from "../world/PropDistributionSystem.js";
import { WorldGenerator } from "../world/WorldGenerator.js";
import { SurfaceSystem } from "../world/SurfaceSystem.js";
import { TerrainShader } from "../shaders/TerrainShader.js";
/*
====================================================================
CONFIG
====================================================================
*/

const CHUNK_SIZE = 64;

const GRID_SPACING = 2;

const GRID_COUNT =
    Math.floor(CHUNK_SIZE / GRID_SPACING);

const SEED = 482917;


/*
====================================================================
SCENE
====================================================================
*/

const scene = new THREE.Scene();

scene.background =
    new THREE.Color(0x9fc9e8);


/*
====================================================================
CAMERA
====================================================================
*/

const camera =
    new THREE.PerspectiveCamera(
        60,
        window.innerWidth /
        window.innerHeight,
        0.1,
        500
    );

camera.position.set(
    55,
    55,
    55
);


/*
====================================================================
RENDERER
====================================================================
*/

const renderer =
    new THREE.WebGLRenderer({
        antialias: true
    });

renderer.setPixelRatio(
    Math.min(
        window.devicePixelRatio,
        2
    )
);

renderer.setSize(
    window.innerWidth,
    window.innerHeight
);

document.body.appendChild(
    renderer.domElement
);


/*
====================================================================
CONTROLS
====================================================================
*/

const controls =
    new OrbitControls(
        camera,
        renderer.domElement
    );

controls.target.set(
    CHUNK_SIZE / 2,
    0,
    CHUNK_SIZE / 2
);

controls.enableDamping = true;


/*
====================================================================
LIGHTING
====================================================================
*/

const hemisphereLight =
    new THREE.HemisphereLight(
        0xffffff,
        0x555555,
        2.0
    );

scene.add(
    hemisphereLight
);


const directionalLight =
    new THREE.DirectionalLight(
        0xffffff,
        2.5
    );

directionalLight.position.set(
    30,
    60,
    20
);

scene.add(
    directionalLight
);


/*
====================================================================
GROUND
====================================================================
*/

const groundGeometry =
    new THREE.PlaneGeometry(
        CHUNK_SIZE,
        CHUNK_SIZE
    );

const groundMaterial =
    new THREE.MeshStandardMaterial({
        color: 0x777777,
        roughness: 1.0
    });

const ground =
    new THREE.Mesh(
        groundGeometry,
        groundMaterial
    );

ground.rotation.x =
    -Math.PI / 2;

ground.position.set(
    CHUNK_SIZE / 2,
    -0.05,
    CHUNK_SIZE / 2
);

scene.add(
    ground
);


/*
====================================================================
CHUNK BORDER
====================================================================
*/

const borderGeometry =
    new THREE.BoxGeometry(
        CHUNK_SIZE,
        0.15,
        CHUNK_SIZE
    );

const borderMaterial =
    new THREE.MeshBasicMaterial({
        wireframe: true,
        color: 0xffffff
    });

const border =
    new THREE.Mesh(
        borderGeometry,
        borderMaterial
    );

border.position.set(
    CHUNK_SIZE / 2,
    0,
    CHUNK_SIZE / 2
);

scene.add(
    border
);


/*
====================================================================
PROP DISTRIBUTION SYSTEM
====================================================================
*/

/*
====================================================================
WORLD + SURFACE SYSTEM
====================================================================
*/

const worldGenerator =
    new WorldGenerator({
        seed: SEED,
        baseHeight: 0.0,
        maxHeight: 14.2,
        heightScale: 6.0,
        worldSize: 8192
    });


const surfaceSystem =
    new SurfaceSystem({
        seed: SEED
    });


const propDistribution =
    new PropDistributionSystem({
        seed: SEED
    });

    function getPropSurfaceSuitability(
    type,
    x,
    z
) {

    const surface =
        surfaceSystem.getSurface(
            x,
            z,
            worldGenerator
        );


    const weights =
        surface.weights;


    const slopeDegrees =
        THREE.MathUtils.radToDeg(
            surface.slope
        );


    switch (type) {

        case "grass":

            return (
                surface.type ===
                surfaceSystem.SURFACE.GRASS &&
                weights.grass > 0.45
            )
                ? 1.0
                : 0.0;


        case "tree":

            /*
            Trees prefer open grass,
            but can occasionally exist
            on dirt.
            */

            if (
                slopeDegrees > 28
            ) {
                return 0.0;
            }

            return THREE.MathUtils.clamp(
                weights.grass * 1.15 +
                weights.dirt * 0.25,
                0.0,
                1.0
            );


        case "rock":

            /*
            Rocks strongly prefer gravel/rock,
            but a small amount can appear
            in ordinary grassland.
            */

            return THREE.MathUtils.clamp(
                weights.rock * 1.2 +
                weights.gravel * 0.9 +
                weights.grass * 0.12,
                0.0,
                1.0
            );


        case "flower":

            return THREE.MathUtils.clamp(
                weights.grass * 1.2,
                0.0,
                1.0
            );


        case "bush":

            return THREE.MathUtils.clamp(
                weights.grass * 1.0 +
                weights.dirt * 0.2,
                0.0,
                1.0
            );


        default:

            return 0.0;

    }

}

/*
====================================================================
PROP GROUP
====================================================================
*/

const propGroup =
    new THREE.Group();

scene.add(
    propGroup
);


/*
====================================================================
MATERIALS
====================================================================
*/

const materials = {

    grass:
        new THREE.MeshStandardMaterial({
            color: 0x5fae45,
            side: THREE.DoubleSide
        }),


    treeTrunk:
        new THREE.MeshStandardMaterial({
            color: 0x6b4328
        }),


    treeLeaves:
        new THREE.MeshStandardMaterial({
            color: 0x3f8f45
        }),


    rock:
        new THREE.MeshStandardMaterial({
            color: 0x777777
        }),


    flower:
        new THREE.MeshStandardMaterial({
            color: 0xdd88cc
        }),


    bush:
        new THREE.MeshStandardMaterial({
            color: 0x448844
        })

};


/*
====================================================================
GEOMETRIES
====================================================================
*/


/*
--------------------------------------------------------------------
GRASS
--------------------------------------------------------------------

Single 2D grass blade.

The geometry is translated upward so that
the BASE of the blade is exactly Y = 0.
--------------------------------------------------------------------
*/

const grassGeometry =
    new THREE.PlaneGeometry(
        0.22,
        0.8
    );

grassGeometry.translate(
    0,
    0.4,
    0
);


/*
--------------------------------------------------------------------
TREE TRUNK
--------------------------------------------------------------------
*/

const treeTrunkGeometry =
    new THREE.CylinderGeometry(
        0.14,
        0.25,
        1.8,
        7
    );

treeTrunkGeometry.translate(
    0,
    0.9,
    0
);


/*
--------------------------------------------------------------------
TREE LEAVES
--------------------------------------------------------------------
*/

const treeLeafGeometry =
    new THREE.SphereGeometry(
        0.65,
        7,
        5
    );


/*
--------------------------------------------------------------------
ROCK
--------------------------------------------------------------------
*/

const rockGeometry =
    new THREE.DodecahedronGeometry(
        0.6,
        0
    );


/*
--------------------------------------------------------------------
FLOWER
--------------------------------------------------------------------
*/

const flowerGeometry =
    new THREE.SphereGeometry(
        0.12,
        6,
        4
    );


/*
--------------------------------------------------------------------
BUSH
--------------------------------------------------------------------
*/

const bushGeometry =
    new THREE.SphereGeometry(
        0.42,
        7,
        5
    );


const geometries = {

    grass:
        grassGeometry,


    tree:
        {
            trunk:
                treeTrunkGeometry,

            leaves:
                treeLeafGeometry
        },


    rock:
        rockGeometry,


    flower:
        flowerGeometry,


    bush:
        bushGeometry

};


/*
====================================================================
DETERMINISTIC PLACEMENT RANDOM
====================================================================
*/

function hash2D(
    x,
    z,
    seed
) {

    const value =
        Math.sin(
            x * 127.1 +
            z * 311.7 +
            seed * 74.7
        ) *
        43758.5453123;

    return (
        value -
        Math.floor(value)
    );

}


/*
====================================================================
GRASS CLUSTER SETTINGS
====================================================================
*/

const GRASS_CLUSTER_MIN =
    5;

const GRASS_CLUSTER_MAX =
    11;

const GRASS_CLUSTER_RADIUS =
    0.9;


/*
====================================================================
PROP HEIGHT / SCALE
====================================================================
*/

function configureProp(
    mesh,
    type,
    random
) {

    let scale =
        0.7 +
        random * 0.6;


    /*
    ------------------------------------------------------------
    TYPE-SPECIFIC SCALE
    ------------------------------------------------------------
    */

    if (type === "grass") {

        /*
        Keep individual blades relatively small.
        */

        scale =
            0.75 +
            random * 0.45;

    }


    if (type === "flower") {

        /*
        Flowers are intentionally tiny.
        */

        scale =
            0.55 +
            random * 0.35;

    }


    if (type === "bush") {

        /*
        Small ground-level bush.
        */

        scale =
            0.65 +
            random * 0.35;

    }


    if (type === "tree") {

        /*
        Trees remain larger.
        */

        scale =
            0.85 +
            random * 0.45;

    }


    mesh.scale.set(
        scale,
        scale,
        scale
    );


    mesh.rotation.y =
        random *
        Math.PI *
        2;


    switch (type) {

        case "grass":

            /*
            IMPORTANT:

            The grass geometry has already been translated
            so its base is at Y = 0.

            Therefore the mesh itself MUST remain at Y = 0.
            */

            mesh.position.y =
                0;

            break;


        case "tree":

            /*
            Tree trunk geometry also starts at ground level.
            */

            mesh.position.y =
                0;

            break;


        case "rock":

            mesh.position.y =
                0.45 * scale;

            break;


        case "flower":

            mesh.position.y =
                0.12 * scale;

            break;


        case "bush":

            mesh.position.y =
                0.38 * scale;

            break;

    }

}


/*
====================================================================
CURRENT PROP
====================================================================
*/

let currentProp =
    "grass";

let densityMultiplier =
    1.0;


/*
====================================================================
CLEAR PROPS
====================================================================
*/

function clearProps() {

    while (
        propGroup.children.length > 0
    ) {

        const child =
            propGroup.children.pop();

        propGroup.remove(
            child
        );

    }

}


/*
====================================================================
CREATE GRASS CLUSTER
====================================================================
*/

function createGrassCluster(
    worldX,
    worldZ,
    gx,
    gz,
    baseRandom
) {

    const clusterSeed =
        SEED +
        gx * 9176 +
        gz * 6113;


    const bladeCount =
        GRASS_CLUSTER_MIN +
        Math.floor(
            baseRandom *
            (
                GRASS_CLUSTER_MAX -
                GRASS_CLUSTER_MIN +
                1
            )
        );


    for (
        let blade = 0;
        blade < bladeCount;
        blade++
    ) {

        /*
        ------------------------------------------------------------
        DETERMINISTIC BLADE RANDOMNESS
        ------------------------------------------------------------
        */

        const bladeRandom =
            hash2D(
                gx * 31 + blade * 17,
                gz * 47 + blade * 23,
                clusterSeed
            );


        const angle =
            bladeRandom *
            Math.PI *
            2;


        const radius =
            Math.sqrt(
                hash2D(
                    gx * 53 + blade * 7,
                    gz * 71 + blade * 11,
                    clusterSeed + 101
                )
            ) *
            GRASS_CLUSTER_RADIUS;


        /*
        ------------------------------------------------------------
        CREATE BLADE
        ------------------------------------------------------------
        */

        const grass =
            new THREE.Mesh(
                geometries.grass,
                materials.grass
            );


        /*
        ------------------------------------------------------------
        CLUSTER POSITION
        ------------------------------------------------------------
        */

        grass.position.x =
            worldX +
            Math.cos(angle) *
            radius;


        grass.position.z =
            worldZ +
            Math.sin(angle) *
            radius;


        /*
        ------------------------------------------------------------
        GRASS SCALE
        ------------------------------------------------------------
        */

        const heightRandom =
            hash2D(
                gx * 83 + blade * 19,
                gz * 97 + blade * 29,
                clusterSeed + 201
            );


        const widthRandom =
            hash2D(
                gx * 101 + blade * 13,
                gz * 109 + blade * 31,
                clusterSeed + 301
            );


        const height =
            0.75 +
            heightRandom *
            0.55;


        const width =
            0.75 +
            widthRandom *
            0.45;


        grass.scale.set(
            width,
            height,
            1
        );


        /*
        ------------------------------------------------------------
        RANDOM ROTATION
        ------------------------------------------------------------
        */

        grass.rotation.y =
            hash2D(
                gx * 131 + blade * 37,
                gz * 137 + blade * 41,
                clusterSeed + 401
            ) *
            Math.PI *
            2;


        /*
        ------------------------------------------------------------
        SMALL RANDOM LEAN
        ------------------------------------------------------------
        */

        grass.rotation.x =
            (
                hash2D(
                    gx * 149 + blade * 43,
                    gz * 151 + blade * 47,
                    clusterSeed + 501
                ) -
                0.5
            ) *
            0.25;


        grass.rotation.z =
            (
                hash2D(
                    gx * 157 + blade * 53,
                    gz * 163 + blade * 59,
                    clusterSeed + 601
                ) -
                0.5
            ) *
            0.25;


        /*
        ------------------------------------------------------------
        GROUND LEVEL

        The blade geometry has its base at Y = 0,
        so there is NO vertical offset.
        ------------------------------------------------------------
        */

        grass.position.y =
            0;


        propGroup.add(
            grass
        );

    }


    return bladeCount;

}


/*
====================================================================
GENERATE PROPS
====================================================================
*/

function generateProps() {

    clearProps();

    let objectCount = 0;


    const propTypes =
        currentProp === "all"
            ? [
                "grass",
                "tree",
                "rock",
                "flower",
                "bush"
            ]
            : [
                currentProp
            ];


    for (
        const propType
        of propTypes
    ) {

        for (
            let gx = 0;
            gx < GRID_COUNT;
            gx++
        ) {

            for (
                let gz = 0;
                gz < GRID_COUNT;
                gz++
            ) {

                const worldX =
                    gx *
                    GRID_SPACING +
                    GRID_SPACING *
                    0.5;


                const worldZ =
                    gz *
                    GRID_SPACING +
                    GRID_SPACING *
                    0.5;


                /*
                ----------------------------------------------------
                DISTRIBUTION FIELD
                ----------------------------------------------------
                */

                const density =
                    propDistribution.getDensity(
                        propType,
                        worldX,
                        worldZ
                    );


                /*
                ----------------------------------------------------
                DETERMINISTIC RANDOMNESS
                ----------------------------------------------------
                */

                const propSeed =
                    SEED +
                    propType.length *
                    100 +
                    propTypes.indexOf(
                        propType
                    ) *
                    1000;


                const random =
                    hash2D(
                        gx,
                        gz,
                        propSeed
                    );


                /*
                ====================================================
                GRASS
                ====================================================

                Instead of spawning one grass blade per grid point,
                accepted points become dense grass clusters.

                This makes the playground behave much closer to
                the actual grass in the main game.
                ====================================================
                */

                if (
                    propType === "grass"
                ) {

                    /*
                    Grass gets a slightly more aggressive
                    probability so accepted regions become dense.
                    */

                    const grassProbability =
                        THREE.MathUtils.clamp(
                            density *
                            densityMultiplier *
                            1.35,
                            0,
                            1
                        );


                    if (
                        random >
                        grassProbability
                    ) {

                        continue;

                    }


                    objectCount +=
                        createGrassCluster(
                            worldX,
                            worldZ,
                            gx,
                            gz,
                            random
                        );


                    continue;

                }


                /*
                ----------------------------------------------------
                OTHER PROP PROBABILITY
                ----------------------------------------------------
                */

const surfaceSuitability =
    getPropSurfaceSuitability(
        propType,
        worldX,
        worldZ
    );


const probability =
    THREE.MathUtils.clamp(
        density *
        surfaceSuitability *
        densityMultiplier,
        0,
        1
    );


                if (
                    random >
                    probability
                ) {

                    continue;

                }


                /*
                ----------------------------------------------------
                CREATE PROP
                ----------------------------------------------------
                */

                let mesh;


                /*
                ----------------------------------------------------
                TREE
                ----------------------------------------------------
                */

                if (
                    propType === "tree"
                ) {

                    mesh =
                        new THREE.Group();


                    /*
                    ==================================================
                    TRUNK
                    ==================================================
                    */

                    const trunk =
                        new THREE.Mesh(
                            geometries.tree.trunk,
                            materials.treeTrunk
                        );

                    mesh.add(
                        trunk
                    );


                    /*
                    ==================================================
                    MAIN FOLIAGE
                    ==================================================
                    */

                    const mainLeaves =
                        new THREE.Mesh(
                            geometries.tree.leaves,
                            materials.treeLeaves
                        );

                    mainLeaves.position.set(
                        0,
                        2.15,
                        0
                    );

                    mainLeaves.scale.set(
                        1.15,
                        0.85,
                        1.05
                    );

                    mesh.add(
                        mainLeaves
                    );


                    /*
                    ==================================================
                    LEFT FOLIAGE
                    ==================================================
                    */

                    const leftLeaves =
                        new THREE.Mesh(
                            geometries.tree.leaves,
                            materials.treeLeaves
                        );

                    leftLeaves.position.set(
                        -0.48,
                        1.85,
                        0.05
                    );

                    leftLeaves.scale.set(
                        0.72,
                        0.68,
                        0.72
                    );

                    mesh.add(
                        leftLeaves
                    );


                    /*
                    ==================================================
                    RIGHT FOLIAGE
                    ==================================================
                    */

                    const rightLeaves =
                        new THREE.Mesh(
                            geometries.tree.leaves,
                            materials.treeLeaves
                        );

                    rightLeaves.position.set(
                        0.48,
                        1.88,
                        -0.02
                    );

                    rightLeaves.scale.set(
                        0.78,
                        0.7,
                        0.75
                    );

                    mesh.add(
                        rightLeaves
                    );


                    /*
                    ==================================================
                    BACK FOLIAGE
                    ==================================================
                    */

                    const backLeaves =
                        new THREE.Mesh(
                            geometries.tree.leaves,
                            materials.treeLeaves
                        );

                    backLeaves.position.set(
                        0,
                        1.82,
                        -0.42
                    );

                    backLeaves.scale.set(
                        0.7,
                        0.65,
                        0.7
                    );

                    mesh.add(
                        backLeaves
                    );

                }


                /*
                ----------------------------------------------------
                ROCK
                ----------------------------------------------------
                */

                else if (
                    propType === "rock"
                ) {

                    mesh =
                        new THREE.Mesh(
                            geometries.rock,
                            materials.rock
                        );

                }


                /*
                ----------------------------------------------------
                FLOWER
                ----------------------------------------------------
                */

                else if (
                    propType === "flower"
                ) {

                    mesh =
                        new THREE.Mesh(
                            geometries.flower,
                            materials.flower
                        );

                }


                /*
                ----------------------------------------------------
                BUSH
                ----------------------------------------------------
                */

                else if (
                    propType === "bush"
                ) {

                    mesh =
                        new THREE.Mesh(
                            geometries.bush,
                            materials.bush
                        );

                }


                /*
                ----------------------------------------------------
                POSITION
                ----------------------------------------------------
                */

                const offsetX =
                    random -
                    0.5;


                const offsetZ =
                    hash2D(
                        gx,
                        gz,
                        SEED +
                        999 +
                        propTypes.indexOf(
                            propType
                        ) *
                        1000
                    ) -
                    0.5;


                mesh.position.x =
                    worldX +
                    offsetX *
                    GRID_SPACING *
                    0.8;


                mesh.position.z =
                    worldZ +
                    offsetZ *
                    GRID_SPACING *
                    0.8;


                /*
                ----------------------------------------------------
                SCALE / ROTATION / HEIGHT
                ----------------------------------------------------
                */

                configureProp(
                    mesh,
                    propType,
                    random
                );


                propGroup.add(
                    mesh
                );


                objectCount++;

            }

        }

    }


    document
        .getElementById(
            "stats"
        )
        .textContent =
        `Objects: ${objectCount}`;

}


/*
====================================================================
PROP LABEL
====================================================================
*/

function updateLabel() {

    const label =
        currentProp
            .charAt(0)
            .toUpperCase() +
        currentProp.slice(1);


    document
        .getElementById(
            "currentProp"
        )
        .textContent =
        `${label} Distribution`;

}


/*
====================================================================
BUTTONS
====================================================================
*/

const buttons =
    document.querySelectorAll(
        "[data-prop]"
    );


buttons.forEach(
    button => {

        button.addEventListener(
            "click",
            () => {

                currentProp =
                    button.dataset.prop;


                buttons.forEach(
                    other => {

                        other.classList.toggle(
                            "active",
                            other ===
                            button
                        );

                    }
                );


                updateLabel();

                generateProps();

            }
        );

    }
);


/*
====================================================================
OPEN ALL DISTRIBUTION MAPS
====================================================================
*/

function openAllDistributionMaps() {

    const types = [
        "grass",
        "tree",
        "rock",
        "flower",
        "bush"
    ];


    const mapSize = 512;


    const mapWindow =
        window.open(
            "",
            "_blank"
        );


    if (!mapWindow) {

        console.warn(
            "Popup blocked. Allow popups for this page."
        );

        return;

    }


    mapWindow.document.write(`
        <!DOCTYPE html>

        <html>

        <head>

            <title>
                Prop Distribution Maps
            </title>

            <style>

                * {
                    box-sizing: border-box;
                }


                html,
                body {

                    margin: 0;
                    padding: 0;

                    background: #111;

                    color: white;

                    font-family:
                        Arial,
                        Helvetica,
                        sans-serif;

                }


                body {

                    padding: 30px;

                }


                h1 {

                    margin:
                        0 0 30px 0;

                    font-size: 24px;

                }


                .maps {

                    display: grid;

                    grid-template-columns:
                        repeat(
                            auto-fit,
                            minmax(
                                300px,
                                1fr
                            )
                        );

                    gap: 24px;

                    max-width: 1200px;

                    margin: 0 auto;

                }


                .map {

                    background: #1c1c1c;

                    padding: 14px;

                    border-radius: 10px;

                }


                .map h2 {

                    margin:
                        0 0 10px 0;

                    font-size: 17px;

                }


                .map canvas {

                    display: block;

                    width: 100%;

                    height: auto;

                    image-rendering:
                        pixelated;

                    background: black;

                    border-radius: 5px;

                }

            </style>

        </head>


        <body>

            <h1>
                Prop Distribution Maps
            </h1>


            <div class="maps">

                ${types.map(
                    type => `

                    <div class="map">

                        <h2>
                            ${
                                type
                                    .charAt(0)
                                    .toUpperCase() +
                                type.slice(1)
                            }
                        </h2>

                        <canvas
                            id="map-${type}"
                            width="${mapSize}"
                            height="${mapSize}">
                        </canvas>

                    </div>

                `
                ).join("")}

            </div>

        </body>

        </html>
    `);


    /*
    ------------------------------------------------------------
    GENERATE MAPS
    ------------------------------------------------------------
    */

    for (
        const type
        of types
    ) {

        const canvas =
            mapWindow.document
                .getElementById(
                    `map-${type}`
                );


        const context =
            canvas.getContext(
                "2d"
            );


        const imageData =
            context.createImageData(
                mapSize,
                mapSize
            );


        for (
            let y = 0;
            y < mapSize;
            y++
        ) {

            for (
                let x = 0;
                x < mapSize;
                x++
            ) {

                /*
                ------------------------------------------------
                MAP WORLD
                ------------------------------------------------

                The playground represents:

                    64 × 64 world units

                ------------------------------------------------
                */

                const worldX =
                    (
                        x /
                        mapSize
                    ) *
                    CHUNK_SIZE;


                const worldZ =
                    (
                        y /
                        mapSize
                    ) *
                    CHUNK_SIZE;


                const density =
                    propDistribution.getDensity(
                        type,
                        worldX,
                        worldZ
                    );


                const value =
                    Math.round(
                        THREE.MathUtils.clamp(
                            density,
                            0,
                            1
                        ) *
                        255
                    );


                const index =
                    (
                        y *
                        mapSize +
                        x
                    ) *
                    4;


                imageData.data[index] =
                    value;

                imageData.data[index + 1] =
                    value;

                imageData.data[index + 2] =
                    value;

                imageData.data[index + 3] =
                    255;

            }

        }


        context.putImageData(
            imageData,
            0,
            0
        );

    }

}


/*
====================================================================
DENSITY SLIDER
====================================================================
*/

const densitySlider =
    document.getElementById(
        "densitySlider"
    );


const densityValue =
    document.getElementById(
        "densityValue"
    );


densitySlider.addEventListener(
    "input",
    () => {

        densityMultiplier =
            Number(
                densitySlider.value
            );


        densityValue.textContent =
            densityMultiplier.toFixed(
                2
            );


        generateProps();

    }
);


/*
====================================================================
KEYBOARD
====================================================================
*/

window.addEventListener(
    "keydown",
    event => {

        const key =
            event.key.toLowerCase();


        /*
        ------------------------------------------------------------
        SHIFT + M
        ------------------------------------------------------------
        */

        if (
            event.shiftKey &&
            key === "m"
        ) {

            openAllDistributionMaps();

            return;

        }


        /*
        ------------------------------------------------------------
        PROP HOTKEYS
        ------------------------------------------------------------
        */

        const mapping = {

            a: "all",
            g: "grass",
            t: "tree",
            r: "rock",
            f: "flower",
            b: "bush"

        };


        if (
            mapping[key]
        ) {

            currentProp =
                mapping[key];


            buttons.forEach(
                button => {

                    button.classList.toggle(
                        "active",
                        button.dataset.prop ===
                        currentProp
                    );

                }
            );


            updateLabel();

            generateProps();

        }

    }
);


/*
====================================================================
INITIAL STATE
====================================================================
*/

buttons[0].classList.add(
    "active"
);

updateLabel();

generateProps();


/*
====================================================================
RESIZE
====================================================================
*/

window.addEventListener(
    "resize",
    () => {

        camera.aspect =
            window.innerWidth /
            window.innerHeight;

        camera.updateProjectionMatrix();

        renderer.setSize(
            window.innerWidth,
            window.innerHeight
        );

    }
);


/*
====================================================================
ANIMATION
====================================================================
*/

function animate() {

    requestAnimationFrame(
        animate
    );

    controls.update();

    renderer.render(
        scene,
        camera
    );

}


animate();
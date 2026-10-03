import * as THREE from "three";

import {
    OrbitControls
} from "./node_modules/three/examples/jsm/controls/OrbitControls.js";

import {
    EffectComposer
} from "./node_modules/three/examples/jsm/postprocessing/EffectComposer.js";

import {
    RenderPass
} from "./node_modules/three/examples/jsm/postprocessing/RenderPass.js";

import {
    ShaderPass
} from "./node_modules/three/examples/jsm/postprocessing/ShaderPass.js";

import {
    FirstPersonController
} from "./player/FirstPersonController.js";

import {
    createShadowSystem
} from "./rendering/LightingSystem.js";

import {
    GodRaysShader
} from "./rendering/GodRaysShader.js";

import {
    ChunkManager
} from "./world/ChunkManager.js";
import {
    GrassSystem
} from "./vegetation/GrassSystem.js"
import Stats from "./node_modules/three/examples/jsm/libs/stats.module.js";
import { SurfaceSystem } from "./world/SurfaceSystem.js";
import { Sky } from "./node_modules/three/examples/jsm/objects/Sky.js";
import {
    TreeSystem
} from "./world/TreeSystem.js";
import { RockSystem } from "./world/RockSystem.js";
import { FlowerSystem } from "./world/FlowerSystem.js";
import {
    BushSystem
} from "./world/BushSystem.js";
// ==================================================
// OPEN MAP IN NEW TAB
// ==================================================

function openMapInNewTab(canvas, title) {

    const imageURL =
        canvas.toDataURL("image/png");

    const newTab =
        window.open("", "_blank");

    if (!newTab) {
        console.warn(
            "Browser blocked the map tab."
        );
        return;
    }

    newTab.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${title}</title>

            <style>
                html,
                body {
                    margin: 0;
                    width: 100%;
                    height: 100%;
                    background: #111;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    overflow: auto;
                }

                img {
                    max-width: 100%;
                    max-height: 100%;
                    object-fit: contain;
                    image-rendering: pixelated;
                }
            </style>
        </head>

        <body>
            <img
                src="${imageURL}"
                alt="${title}"
            >
        </body>
        </html>
    `);

    newTab.document.close();
}

// ==================================================
// OPEN DISPLACEMENT MAP
// ==================================================

function openDisplacementMap() {

    const canvas =
        chunkManager.generateDisplacementMap(
            0,
            0,
            1024
        );


    if (!canvas) {

        console.warn(
            "Cannot generate displacement map."
        );

        return;

    }


    openMapInNewTab(
        canvas,
        "Terrain Displacement Map"
    );

}


// ==================================================
// OPEN SURFACE MAP
// ==================================================

function openSurfaceMap() {

    const canvas =
        chunkManager.generateSurfaceMap(
            0,
            0,
            1024
        );


    if (!canvas) {

        console.warn(
            "Cannot generate surface map."
        );

        return;

    }


    openMapInNewTab(
        canvas,
        "Terrain Surface Map"
    );

}
window.openDisplacementMap =
    openDisplacementMap;

window.openSurfaceMap =
    openSurfaceMap;

// ==================================================
// OPEN PROP DISTRIBUTION MAP
// ==================================================

function openPropDistributionMap(
    type = "grass"
) {

    const debugTerrain =
        chunkManager.getChunk(
            0,
            0
        );


    if (!debugTerrain) {

        console.warn(
            "Debug terrain chunk (0,0) is not loaded."
        );

        return;
    }


    const canvas =
        debugTerrain.terrain
            .generatePropDistributionMap(
                type,
                512
            );


    if (!canvas) {

        console.warn(
            `Cannot generate ${type} distribution map.`
        );

        return;
    }


    openMapInNewTab(
        canvas,
        `${type} Distribution Map`
    );
}

window.openPropDistributionMap =
    openPropDistributionMap;
// ==================================================
// SCENE
// ==================================================

const scene =
    new THREE.Scene();


// ==================================================
// FOG
// ==================================================

scene.fog =
    new THREE.Fog(
        0x8fb9d4,
        // 0xffffff,
        0,
        200
    );


// ==================================================
// TEXTURE LOADER
// ==================================================

const textureLoader =
    new THREE.TextureLoader();


// =========================================
// SKY SPHERE
// =========================================

const skyTexture = new THREE.TextureLoader().load(
    "./textures/mySkyTest.png"
);

skyTexture.colorSpace = THREE.SRGBColorSpace;
skyTexture.offset.y =- 0.07;
const skyGeometry = new THREE.SphereGeometry(
    10000,
    64,
    32
);

const skyMaterial = new THREE.MeshBasicMaterial({
    map: skyTexture,
    side: THREE.BackSide,
    depthWrite: false,
    fog:false
});

const skySphere = new THREE.Mesh(
    skyGeometry,
    skyMaterial
);

scene.add(skySphere);
// ==================================================
// CAMERA
// ==================================================

const camera =
    new THREE.PerspectiveCamera(

        75,

        window.innerWidth /
        window.innerHeight,

        0.1,

        20000

    );


camera.position.set(
    8,
    6,
    10
);


camera.lookAt(
    0,
    0,
    0
);


// ==================================================
// RENDERER
// ==================================================

const renderer =
    new THREE.WebGLRenderer({

        antialias:
            true

    });


renderer.setSize(
    window.innerWidth,
    window.innerHeight
);


renderer.setPixelRatio(
    Math.min(
        window.devicePixelRatio,
        2
    )
);


renderer.toneMapping =
    THREE.ACESFilmicToneMapping;


renderer.toneMappingExposure =
    1.25;


renderer.shadowMap.enabled =
    true;

renderer.shadowMap.type =
    THREE.PCFSoftShadowMap;


document.body.appendChild(
    renderer.domElement
);

const stats = new Stats();

stats.showPanel(0); // 0 = FPS, 1 = MS, 2 = memory

stats.dom.style.position = "fixed";
stats.dom.style.left = "0px";
stats.dom.style.top = "0px";
stats.dom.style.zIndex = "9999";

document.body.appendChild(stats.dom);

// ==================================================
// LIGHTING
// ==================================================

const lighting =
    createShadowSystem(
        scene,
        renderer
    );

// ==================================================
// GOD RAY SUN
//
// Completely independent from the shadow sun.
//
// This represents the visual sun direction for
// atmospheric god rays only.
// ==================================================

const godRaySunDirection =
    new THREE.Vector3(
        0.35,
        0.75,
        1.50
    ).normalize();


// Distance used to place the virtual sun
// far away from the player/camera.
const godRaySunDistance =
    1000;
// ==================================================
// ORBIT CONTROLS
// ==================================================

const controls =
    new OrbitControls(
        camera,
        renderer.domElement
    );


controls.enableDamping =
    true;


controls.dampingFactor =
    0.05;


controls.minDistance =
    2;


controls.maxDistance =
    150;


controls.maxPolarAngle =
    Math.PI / 2.05;


// ==================================================
// POST PROCESSING
// ==================================================

const composer =
    new EffectComposer(
        renderer
    );


const renderPass =
    new RenderPass(
        scene,
        camera
    );


composer.addPass(
    renderPass
);


// ==================================================
// GOD RAYS
// ==================================================

const godRaysPass =
    new ShaderPass(
        GodRaysShader
    );


godRaysPass.renderToScreen =
    true;


composer.addPass(
    godRaysPass
);


// ==================================================
// GOD RAY SETTINGS
// ==================================================

godRaysPass.uniforms
    .density
    .value =
    0.35;


godRaysPass.uniforms
    .decay
    .value =
    0.96;


godRaysPass.uniforms
    .weight
    .value =
    0.06;


godRaysPass.uniforms
    .exposure
    .value =
    0.5;


godRaysPass.uniforms
    .intensity
    .value =
    1.0;


// ==================================================
// CHUNK MANAGER
// ==================================================

/*
 * The terrain is now divided into chunks.
 *
 * 64 × 64 world-unit chunks
 * 32 × 32 terrain subdivisions
 *
 * viewDistance = 1
 *
 * means:
 *
 *       [-1] [ 0] [ 1]
 *       [-1] [ 0] [ 1]
 *       [-1] [ 0] [ 1]
 *
 * 9 chunks around the player.
 */

// let chunkManager;


// ==================================================
// FIRST PERSON CONTROLLER
// ==================================================

let fpsController;


// ==================================================
// TEMPORARY TERRAIN HEIGHT FUNCTION
// ==================================================

/*
 * We need the player controller before the
 * ChunkManager can use the player's position.
 *
 * Therefore we create the controller first with
 * a temporary height function.
 *
 * This gets replaced immediately after the
 * ChunkManager is created.
 */

const fallbackTerrainHeight =
    () => 0;


// ==================================================
// PLAYER
// ==================================================

fpsController =
    new FirstPersonController({

        camera,

        domElement:
            renderer.domElement,

        scene,

        terrainHeightFunction:
            fallbackTerrainHeight,

        movementSpeed: 5,

        jumpHeight: 2,

        gravity: 18,

        playerHeight: 1.7,

        playerRadius: 0.35,

        debugCapsule: true

    });

const grassSystem =
    new GrassSystem({

        density: 120000,

        seed: 482917,

        lodNear: 32,

        lodMedium: 64,

        lodFar: 100

    });

scene.add(
    grassSystem
);

const surfaceSystem = new SurfaceSystem({
    seed: 482917
});
const treeSystem =
    new TreeSystem({

        scene,

        surfaceSystem,

        seed: 482917,

        chunkSize: 64,

        modelPath:
            "./models/TreeMine.glb"

    });

const rockSystem =
    new RockSystem({

        scene,

        seed: 482917,

        chunkSize: 64,

        modelPath:
            "./models/rocks.glb"

    });
const flowerSystem =
    new FlowerSystem({

        scene,

        surfaceSystem,

        seed: 482917,

        chunkSize: 64,

        modelPath:
            "./models/flowers.glb"

    });
const bushSystem =
    new BushSystem({

        scene,

        surfaceSystem,

        seed: 482917,

        chunkSize: 64,

        modelPath:
            "./models/bushes.glb"

    });
const chunkManager =
    new ChunkManager({

        scene,

        player:
            fpsController,

        grassSystem,

        treeSystem,

        rockSystem,

        flowerSystem,

        bushSystem,

        chunkSize: 64,

        viewDistance: 3,

        baseHeight: 0,

        maxHeight: 14.2,

        heightScale: 6.0,

        seed: 482917,

        surfaceSystem,

        sun: lighting.sun

    });

// ==================================================
// CONNECT PLAYER TO CHUNK TERRAIN
// ==================================================

/*
 * The controller needs to query terrain height.
 *
 * ChunkManager now handles that.
 *
 * IMPORTANT:
 *
 * FirstPersonController must expose a way to
 * replace terrainHeightFunction.
 */

fpsController.terrainHeightFunction =
    chunkManager.getHeight.bind(
        chunkManager
    );

    const displacementCanvas =
    chunkManager.generateDisplacementMap(
        0,
        0,
        512
    );

const surfaceCanvas =
    chunkManager.generateSurfaceMap(
        0,
        0,
        512
    );
// ==================================================
// DEBUG MAP VIEWERS
// ==================================================

const debugTerrain =
    chunkManager.getChunk(
        0,
        0
    );

if (debugTerrain) {

    const displacementCanvas =
        debugTerrain.terrain
            .generateDisplacementMap(
                512
            );

    const surfaceCanvas =
        debugTerrain.terrain
            .generateSurfaceMap(
                512
            );

}
// ==================================================
// CAMERA MODE
// ==================================================

let fpsMode =
    false;


// ==================================================
// V = TOGGLE CAMERA
// ==================================================

window.addEventListener(

    "keydown",

    (event) => {

        if (
            event.key.toLowerCase() !==
            "v"
        ) {

            return;

        }


        fpsMode =
            !fpsMode;


        // ==============================================
        // FPS MODE
        // ==============================================

        if (
            fpsMode
        ) {

            controls.enabled =
                false;


            camera.rotation.order =
                "YXZ";


            fpsController.yaw =
                camera.rotation.y;


            fpsController.pitch =
                camera.rotation.x;


            fpsController.updateCameraRotation();


            fpsController.enable();


            console.log(
                "Camera Mode: FPS"
            );

        }


        // ==============================================
        // ORBIT MODE
        // ==============================================

        else {

            if (
                document.pointerLockElement ===
                renderer.domElement
            ) {

                document.exitPointerLock();

            }


            fpsController.disable();


            controls.enabled =
                true;


            controls.target.copy(
                fpsController.getPosition()
            );


            controls.update();


            console.log(
                "Camera Mode: Orbit"
            );

        }

    }

);

// ==================================================
// PROP DISTRIBUTION DEBUG
// ==================================================

window.addEventListener(
    "keydown",
    (event) => {

        const key =
            event.key.toLowerCase();


        switch (key) {

            case "g":
                openPropDistributionMap(
                    "grass"
                );
                break;


            case "t":
                openPropDistributionMap(
                    "tree"
                );
                break;


            case "r":
                openPropDistributionMap(
                    "rock"
                );
                break;


            case "f":
                openPropDistributionMap(
                    "flower"
                );
                break;


            case "b":
                openPropDistributionMap(
                    "bush"
                );
                break;
        }
    }
);
// ==================================================
// CLOCK
// ==================================================

const clock =
    new THREE.Clock();


// ==================================================
// CHUNK DEBUG
// ==================================================

let lastChunkX = null;
let lastChunkZ = null;


function updateChunkDebug() {

    const position =
        fpsController.getPosition();


    const chunkX =
        Math.floor(
            position.x / 64
        );


    const chunkZ =
        Math.floor(
            position.z / 64
        );


    if (
        chunkX !== lastChunkX ||
        chunkZ !== lastChunkZ
    ) {

        lastChunkX =
            chunkX;

        lastChunkZ =
            chunkZ;


        console.log(
            `Player Chunk: ${chunkX}, ${chunkZ}`
        );

    }

}


// ==================================================
// GOD RAY SUN POSITION
//
// Completely independent from the shadow sun.
//
// The virtual god-ray sun is positioned far away
// from the player along a fixed world-space direction.
// ==================================================

function updateGodRaySunPosition() {

    const playerPosition =
        fpsController.getPosition();


    if (!playerPosition) {
        return;
    }


    // ==================================================
    // VIRTUAL GOD-RAY SUN WORLD POSITION
    // ==================================================

    const godRayWorldPosition =
        playerPosition
            .clone()
            .add(
                godRaySunDirection
                    .clone()
                    .multiplyScalar(
                        godRaySunDistance
                    )
            );


    // ==================================================
    // PROJECT INTO SCREEN SPACE
    // ==================================================

    const projectedSun =
        godRayWorldPosition
            .clone()
            .project(
                camera
            );


    const sunX =
        projectedSun.x *
        0.5 +
        0.5;


    const sunY =
        projectedSun.y *
        0.5 +
        0.5;


    const inFront =
        projectedSun.z <
        1;


    const onScreen =
        sunX > -0.25 &&
        sunX < 1.25 &&
        sunY > -0.25 &&
        sunY < 1.25;


    // ==================================================
    // UPDATE GOD RAYS
    // ==================================================

    if (
        inFront &&
        onScreen
    ) {

        godRaysPass
            .uniforms
            .sunPosition
            .value
            .set(
                sunX,
                sunY
            );


        godRaysPass
            .uniforms
            .intensity
            .value =
            1.0;

    }

    else {

        godRaysPass
            .uniforms
            .intensity
            .value =
            0.0;

    }

}

// ==================================================
// ANIMATION
// ==================================================

function animate() {

    requestAnimationFrame(
        animate
    );
    stats.begin();

    const delta =
        clock.getDelta();


    // ==============================================
    // PLAYER
    // ==============================================

    fpsController.update(
        delta
    );


    // ==============================================
    // CHUNKS
    // ==============================================


    chunkManager.update();

    grassSystem.update(
        delta,
        fpsController.getPosition()
    );
    flowerSystem.update(
    delta
);
bushSystem.update(
    delta
);
    updateChunkDebug();


    // ==============================================
    // LIGHTING
    // ==============================================

    lighting.update(
        fpsController.getPosition()
    );
    // chunkManager.updateShadowUniforms();

    // ==============================================
    // CAMERA
    // ==============================================

    if (
        !fpsMode
    ) {

        const playerPosition =
            fpsController.getPosition();


        controls.target.set(

            playerPosition.x,

            playerPosition.y,

            playerPosition.z

        );


        controls.update();

    }


    // ==============================================
    // GOD RAYS
    // ==============================================

    updateGodRaySunPosition();


    // ==============================================
    // RENDER
    // ==============================================

    composer.render();

    stats.end();

}


animate();


// ==================================================
// RESIZE
// ==================================================

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


        composer.setSize(
            window.innerWidth,
            window.innerHeight
        );

    }

);
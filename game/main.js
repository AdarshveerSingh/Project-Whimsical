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
import { TerrainSystem } from "./world/TerrainSystem.js";
import { TerrainDebug } from "./debug/debugTerrain.js";
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
        5,
        32
    );


// ==================================================
// TEXTURE LOADER
// ==================================================

const textureLoader =
    new THREE.TextureLoader();


// ==================================================
// SKY
// ==================================================

const skyTexture =
    textureLoader.load(
        "./textures/skybox9_hd.png"
    );

skyTexture.offset.y =
    -0.07;


const skyGeometry =
    new THREE.SphereGeometry(
        250,
        64,
        64
    );


const skyMaterial =
    new THREE.MeshBasicMaterial({

        map:
            skyTexture,

        side:
            THREE.BackSide,

        fog:
            false

    });


const skybox =
    new THREE.Mesh(
        skyGeometry,
        skyMaterial
    );


scene.add(
    skybox
);


// ==================================================
// CAMERA
// ==================================================

const camera =
    new THREE.PerspectiveCamera(

        60,

        window.innerWidth /
        window.innerHeight,

        0.1,

        500

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


document.body.appendChild(
    renderer.domElement
);


// ==================================================
// LIGHTING
// ==================================================

const lighting =
    createShadowSystem(
        scene,
        renderer
    );


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
// TERRAIN
// ==================================================

const terrain =
    new TerrainSystem({

        scene,

        size: 115,

        resolution: 150,

        baseHeight: 0.0,

        maxHeight: 4.0,

        seed: 482917

    });

const terrainDebug =
    new TerrainDebug({

        scene,

        terrain

    });

// ==================================================
// FIRST PERSON CONTROLLER
// ==================================================

const fpsController =
    new FirstPersonController({

        camera,

        domElement:
            renderer.domElement,

        scene,

        terrainHeightFunction:
            terrain.getHeight.bind(
                terrain
            ),

        movementSpeed: 5,

        jumpHeight: 2,

        gravity: 18,

        playerHeight: 1.7,

        playerRadius: 0.35,

        debugCapsule: true

    });


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
// CLOCK
// ==================================================

const clock =
    new THREE.Clock();


// ==================================================
// GOD RAY SUN POSITION
// ==================================================

function updateGodRaySunPosition() {

    const projectedSun =
        lighting.sun
            .position
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


    if (
        inFront &&
        onScreen
    ) {

        godRaysPass.uniforms
            .sunPosition
            .value.set(
                sunX,
                sunY
            );


        godRaysPass.uniforms
            .intensity
            .value =
            1.0;

    }

    else {

        godRaysPass.uniforms
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


    const delta =
        clock.getDelta();


    // ==============================================
    // PLAYER
    // ==============================================

    fpsController.update(
        delta
    );


    // ==============================================
    // LIGHTING
    // ==============================================

    lighting.update(
        fpsController.getPosition()
    );


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
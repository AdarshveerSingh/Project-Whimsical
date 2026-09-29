import * as THREE from "three";

import {
    LightProbeGrid
} from "../node_modules/three/examples/jsm/lighting/LightProbeGrid.js";

// ============================================================
// CREATE LIGHTING + SHADOW SYSTEM
// ============================================================

export function createShadowSystem(
    scene,
    renderer
) {

    // ========================================================
    // ENABLE SHADOWS
    // ========================================================

    renderer.shadowMap.enabled =
        true;

    renderer.shadowMap.type =
        THREE.PCFSoftShadowMap;


    // ========================================================
    // SUN
    // ========================================================

    const sun =
        new THREE.DirectionalLight(
            0xffffff,
            2.5
        );

    sun.name =
        "Sun";


    // ========================================================
    // SUN POSITION
    // ========================================================

    sun.position.set(
        -20,
        70,
        20
    );


    // ========================================================
    // SUN TARGET
    // ========================================================

    sun.target.position.set(
        0,
        0,
        0
    );

    scene.add(
        sun.target
    );


    // ========================================================
    // ENABLE SUN SHADOWS
    // ========================================================

    sun.castShadow =
        true;


    // ========================================================
    // SHADOW MAP
    // ========================================================

    sun.shadow.mapSize.set(
        2048,
        2048
    );


    // ========================================================
    // SHADOW CAMERA
    // ========================================================

    sun.shadow.camera.left =
        -60;

    sun.shadow.camera.right =
        60;

    sun.shadow.camera.top =
        60;

    sun.shadow.camera.bottom =
        -60;

    sun.shadow.camera.near =
        0.1;

    sun.shadow.camera.far =
        250;


    // ========================================================
    // SHADOW BIAS
    // ========================================================

    sun.shadow.bias =
        -0.0001;

    sun.shadow.normalBias =
        0.025;

    sun.shadow.radius =
        1.8;


    // ========================================================
    // ADD SUN
    // ========================================================

    scene.add(
        sun
    );


    // ========================================================
    // SUN HELPER
    // ========================================================

    const sunHelper =
        new THREE.DirectionalLightHelper(
            sun,
            10
        );

    sunHelper.name =
        "SunHelper";

    scene.add(
        sunHelper
    );


    // ========================================================
    // SOFT AMBIENT LIGHT
    // ========================================================

    const ambientLight =
        new THREE.HemisphereLight(

            0x8fcbea, // blue sky fill
            0x52677a, // cool blue-gray ground fill

            1.0

        );

    ambientLight.name =
        "SoftAmbientLight";

    scene.add(
        ambientLight
    );


    // ========================================================
    // LIGHT PROBE GRID
    // ========================================================

    const probes =
        new LightProbeGrid(
            80,
            20,
            80,
            12,
            6,
            12
        );

    probes.name =
        "LightProbeGrid";


    probes.position.set(
        0,
        10,
        0
    );


    scene.add(
        probes
    );


    // ========================================================
    // BAKE INDIRECT LIGHT
    // ========================================================

    function bakeLighting() {

        try {

            probes.bake(
                renderer,
                scene,
                {
                    cubemapSize:
                        32,

                    near:
                        0.05,

                    far:
                        200,

                    bounces:
                        1
                }
            );


            console.log(
                "LightProbeGrid baked."
            );

        }
        catch (error) {

            console.error(
                "LightProbeGrid bake failed:",
                error
            );

        }

    }


    // ========================================================
    // INITIAL BAKE
    // ========================================================

    bakeLighting();


    // ========================================================
    // PLAYER-FOLLOWING SHADOWS
    // ========================================================

    function update(
        playerPosition
    ) {

        if (!playerPosition) {
            return;
        }


        const x =
            playerPosition.x;

        const y =
            playerPosition.y;

        const z =
            playerPosition.z;


        // ====================================================
        // MOVE SUN
        // ====================================================

        sun.position.set(
            x - 0,
            y + 20,
            z + 50
        );


        // ====================================================
        // MOVE SUN TARGET
        // ====================================================

        sun.target.position.set(
            x,
            y,
            z
        );


        // ====================================================
        // UPDATE TARGET
        // ====================================================

        sun.target.updateMatrixWorld();


        // ====================================================
        // UPDATE HELPER
        // ====================================================

        sunHelper.update();

    }


    // ========================================================
    // SET SHADOW MAP SIZE
    // ========================================================

    function setMapSize(
        size
    ) {

        size =
            Math.max(
                256,
                Math.floor(size)
            );


        sun.shadow.mapSize.width =
            size;

        sun.shadow.mapSize.height =
            size;


        if (
            sun.shadow.map
        ) {

            sun.shadow.map.dispose();

            sun.shadow.map =
                null;

        }

    }


    // ========================================================
    // ENABLE / DISABLE SHADOWS
    // ========================================================

    function setShadowsEnabled(
        enabled
    ) {

        renderer.shadowMap.enabled =
            enabled;

        sun.castShadow =
            enabled;

    }


    // ========================================================
    // RETURN
    // ========================================================

    return {

        sun,

        sunHelper,

        ambientLight,

        probes,

        update,

        bakeLighting,

        setMapSize,

        setShadowsEnabled

    };

}
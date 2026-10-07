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
    // SHADOW SUN
    //
    // This sun is ONLY responsible for:
    // - terrain shadows
    // - tree shadows
    // - object shadows
    //
    // God rays do NOT use this sun.
    // ========================================================

    const sun =
        new THREE.DirectionalLight(
            0xffffff,
            1.8
        );

    sun.name =
        "ShadowSun";


    // ========================================================
    // PLAYER-RELATIVE SHADOW SUN OFFSET
    // ========================================================

    const shadowSunOffset =
        new THREE.Vector3(
            70,
            140,
            140
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

sun.shadow.bias =
    -0.0005;

sun.shadow.normalBias =
    0.05;

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
        "ShadowSunHelper";

    scene.add(
        sunHelper
    );


    // ========================================================
    // SOFT AMBIENT LIGHT
    // ========================================================

    const ambientLight =
        new THREE.HemisphereLight(

            0x8fcbea, // sky
            0x6f8290, // ground
            0.25

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

    // scene.add(
    //     probes
    // );


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
    // UPDATE SHADOW SUN
    //
    // The shadow sun follows the player.
    // Its direction remains fixed by shadowSunOffset.
    // ========================================================

    function update(
        playerPosition
    ) {

        if (!playerPosition) {
            return;
        }


        // ====================================================
        // MOVE SHADOW SUN
        // ====================================================

        sun.position
            .copy(playerPosition)
            .add(shadowSunOffset);


        // ====================================================
        // MOVE SHADOW TARGET
        // ====================================================

        sun.target.position
            .copy(playerPosition);


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

        // Shadow sun only
        sun,

        sunHelper,

        ambientLight,

        probes,

        shadowSunOffset,

        update,

        bakeLighting,

        setMapSize,

        setShadowsEnabled

    };

}
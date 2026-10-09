import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";


export class FireBall {

    constructor(scene) {

        this.scene = scene;

        this.group = new THREE.Group();

        this.group.visible = false;

        scene.add(this.group);


        // ====================================================
        // CORE
        // ====================================================

        const coreGeometry =
            new THREE.SphereGeometry(
                22,
                32,
                32
            );

        const coreMaterial =
            new THREE.MeshBasicMaterial({
                color: 0xffffdd
            });

        this.core =
            new THREE.Mesh(
                coreGeometry,
                coreMaterial
            );

        this.group.add(
            this.core
        );


        // ====================================================
        // INNER FIRE
        // ====================================================

        const innerGeometry =
            new THREE.SphereGeometry(
                32,
                32,
                32
            );

        const innerMaterial =
            new THREE.MeshBasicMaterial({
                color: 0xffaa22,

                transparent: true,

                opacity: 0.8,

                blending:
                    THREE.AdditiveBlending,

                depthWrite: false
            });

        this.inner =
            new THREE.Mesh(
                innerGeometry,
                innerMaterial
            );

        this.group.add(
            this.inner
        );


        // ====================================================
        // OUTER FIRE GLOW
        // ====================================================

        const glowGeometry =
            new THREE.SphereGeometry(
                55,
                32,
                32
            );

        const glowMaterial =
            new THREE.MeshBasicMaterial({
                color: 0xff4400,

                transparent: true,

                opacity: 0.22,

                blending:
                    THREE.AdditiveBlending,

                depthWrite: false
            });

        this.glow =
            new THREE.Mesh(
                glowGeometry,
                glowMaterial
            );

        this.group.add(
            this.glow
        );


        // ====================================================
        // OUTER ATMOSPHERE
        // ====================================================

        const atmosphereGeometry =
            new THREE.SphereGeometry(
                85,
                32,
                32
            );

        const atmosphereMaterial =
            new THREE.MeshBasicMaterial({
                color: 0xff2200,

                transparent: true,

                opacity: 0.06,

                blending:
                    THREE.AdditiveBlending,

                depthWrite: false
            });

        this.atmosphere =
            new THREE.Mesh(
                atmosphereGeometry,
                atmosphereMaterial
            );

        this.group.add(
            this.atmosphere
        );


        // ====================================================
        // FIRE RINGS
        // ====================================================

        const ringGeometry =
            new THREE.TorusGeometry(
                45,
                2,
                8,
                48
            );

        const ringMaterial =
            new THREE.MeshBasicMaterial({
                color: 0xffaa33,

                transparent: true,

                opacity: 0.75,

                blending:
                    THREE.AdditiveBlending
            });


        this.ring1 =
            new THREE.Mesh(
                ringGeometry,
                ringMaterial
            );

        this.ring1.rotation.x =
            Math.PI / 2;

        this.group.add(
            this.ring1
        );


        this.ring2 =
            new THREE.Mesh(
                ringGeometry,
                ringMaterial
            );

        this.ring2.rotation.y =
            Math.PI / 2;

        this.group.add(
            this.ring2
        );


        // ====================================================
        // REAL FIRE LIGHT
        // ====================================================

        this.light =
            new THREE.PointLight(
                0xff5500,
                0,
                500,
                1.5
            );

        this.light.castShadow =
            true;

        this.light.shadow.mapSize.width =
            512;

        this.light.shadow.mapSize.height =
            512;

        this.light.shadow.camera.near =
            1;

        this.light.shadow.camera.far =
            500;

        this.light.shadow.bias =
            -0.002;

        this.group.add(
            this.light
        );


        // ====================================================
        // STATE
        // ====================================================

        this.active = false;

        this.spawnTime = 0;

        this.spawnDuration = 350;
    }


    // ========================================================
    // SPAWN
    // ========================================================

    spawn(position) {

        this.active = true;

        this.group.visible = true;

        this.group.position.copy(
            position
        );

        this.spawnTime =
            performance.now();

        this.group.scale.setScalar(
            0.1
        );

        this.light.intensity = 0;

        console.log(
            "🔥 FIREBALL FORMED"
        );
    }


    // ========================================================
    // FOLLOW PALM
    // ========================================================

    setPosition(position) {

        if (!this.active) {
            return;
        }

        this.group.position.lerp(
            position,
            0.45
        );
    }

    hide() {

    this.active =
        false;

    this.group.visible =
        false;

    this.light.intensity =
        0;

    console.log(
        "🔥 FIREBALL DISAPPEARED"
    );
}
    // ========================================================
    // UPDATE
    // ========================================================

    update(now) {

        if (!this.active) {
            return;
        }


        const elapsed =
            now - this.spawnTime;


        // ====================================================
        // FORMATION
        // ====================================================

        const progress =
            Math.min(
                elapsed /
                this.spawnDuration,
                1
            );


        const eased =
            1 -
            Math.pow(
                1 - progress,
                3
            );


        this.group.scale.setScalar(
            0.1 +
            eased * 0.9
        );


        // ====================================================
        // FIRE FLICKER
        // ====================================================

        const flicker =
            1 +
            Math.sin(now * 0.025) * 0.12 +
            Math.sin(now * 0.047) * 0.08;


        // ====================================================
        // LIGHT
        // ====================================================

        this.light.intensity =
            35 *
            eased *
            flicker;


        // ====================================================
        // CORE
        // ====================================================

        const coreScale =
            1 +
            Math.sin(
                now * 0.015
            ) * 0.08;


        this.core.scale.setScalar(
            coreScale
        );


        // ====================================================
        // INNER FIRE
        // ====================================================

        this.inner.scale.setScalar(
            1 +
            Math.sin(
                now * 0.012
            ) * 0.15
        );


        // ====================================================
        // OUTER GLOW
        // ====================================================

        this.glow.scale.setScalar(
            1 +
            Math.sin(
                now * 0.009
            ) * 0.18
        );


        this.atmosphere.scale.setScalar(
            1 +
            Math.sin(
                now * 0.006
            ) * 0.15
        );


        // ====================================================
        // ROTATING FIRE
        // ====================================================

        this.ring1.rotation.z +=
            0.025;

        this.ring2.rotation.x +=
            0.018;

        this.ring2.rotation.z -=
            0.012;
    }
}
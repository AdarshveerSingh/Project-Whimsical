import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";


export class ShinyOrb {

    constructor(scene) {

        this.scene = scene;

        this.group = new THREE.Group();
        this.group.visible = false;

        scene.add(this.group);


        // ====================================================
        // BRIGHT CORE
        // ====================================================

        const coreGeometry =
            new THREE.SphereGeometry(26, 32, 32);

        const coreMaterial =
            new THREE.MeshBasicMaterial({
                color: 0xffffff
            });

        this.core =
            new THREE.Mesh(
                coreGeometry,
                coreMaterial
            );

        this.group.add(this.core);


        // ====================================================
        // INNER ENERGY
        // ====================================================

        const innerGeometry =
            new THREE.SphereGeometry(34, 32, 32);

        const innerMaterial =
            new THREE.MeshBasicMaterial({
                color: 0xbbeeff,
                transparent: true,
                opacity: 0.65,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });

        this.innerGlow =
            new THREE.Mesh(
                innerGeometry,
                innerMaterial
            );

        this.group.add(this.innerGlow);


        // ====================================================
        // LARGE OUTER GLOW
        // ====================================================

        const outerGeometry =
            new THREE.SphereGeometry(70, 32, 32);

        const outerMaterial =
            new THREE.MeshBasicMaterial({
                color: 0x55bbff,
                transparent: true,
                opacity: 0.18,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });

        this.outerGlow =
            new THREE.Mesh(
                outerGeometry,
                outerMaterial
            );

        this.group.add(this.outerGlow);


        // ====================================================
        // HUGE ATMOSPHERIC GLOW
        // ====================================================

        const atmosphereGeometry =
            new THREE.SphereGeometry(120, 32, 32);

        const atmosphereMaterial =
            new THREE.MeshBasicMaterial({
                color: 0x3388ff,
                transparent: true,
                opacity: 0.055,
                blending: THREE.AdditiveBlending,
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
        // WIREFRAME ENERGY SHELL
        // ====================================================

        const wireGeometry =
            new THREE.IcosahedronGeometry(
                48,
                2
            );

        const wireMaterial =
            new THREE.MeshBasicMaterial({
                color: 0x99ddff,
                wireframe: true,
                transparent: true,
                opacity: 0.7,
                blending: THREE.AdditiveBlending
            });

        this.wire =
            new THREE.Mesh(
                wireGeometry,
                wireMaterial
            );

        this.group.add(
            this.wire
        );


        // ====================================================
        // ORBIT RING 1
        // ====================================================

        const ringGeometry =
            new THREE.TorusGeometry(
                62,
                2.5,
                8,
                64
            );

        const ringMaterial =
            new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.9,
                blending: THREE.AdditiveBlending
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


        // ====================================================
        // ORBIT RING 2
        // ====================================================

        this.ring2 =
            new THREE.Mesh(
                ringGeometry,
                ringMaterial
            );

        this.ring2.rotation.x =
            Math.PI / 3;

        this.ring2.rotation.z =
            Math.PI / 4;

        this.group.add(
            this.ring2
        );


        // ====================================================
        // REAL LIGHT #1
        // ====================================================

        this.light =
            new THREE.PointLight(
                0xffffff,
                0,
                1000,
                1.2
            );

        this.light.castShadow = true;

        this.light.shadow.mapSize.width =
            1024;

        this.light.shadow.mapSize.height =
            1024;

        this.light.shadow.camera.near =
            1;

        this.light.shadow.camera.far =
            1000;

        this.light.shadow.bias =
            -0.002;

        this.group.add(
            this.light
        );


        // ====================================================
        // BLUE FILL LIGHT
        // ====================================================

        this.blueLight =
            new THREE.PointLight(
                0x55aaff,
                0,
                700,
                1.5
            );

        this.group.add(
            this.blueLight
        );


        // ====================================================
        // SECOND LIGHT
        // ====================================================

        this.whiteLight =
            new THREE.PointLight(
                0xaaddff,
                0,
                450,
                1.7
            );

        this.group.add(
            this.whiteLight
        );


        // ====================================================
        // LIGHT RAYS
        // ====================================================

        const rayGeometry =
            new THREE.ConeGeometry(
                90,
                300,
                32,
                1,
                true
            );

        const rayMaterial =
            new THREE.MeshBasicMaterial({
                color: 0x55bbff,
                transparent: true,
                opacity: 0.035,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                side: THREE.DoubleSide
            });


        this.rayTop =
            new THREE.Mesh(
                rayGeometry,
                rayMaterial
            );

        this.rayTop.rotation.x =
            Math.PI;

        this.rayTop.position.y =
            120;

        this.group.add(
            this.rayTop
        );


        this.rayBottom =
            new THREE.Mesh(
                rayGeometry,
                rayMaterial
            );

        this.rayBottom.position.y =
            -120;

        this.group.add(
            this.rayBottom
        );


        // ====================================================
        // PARTICLES
        // ====================================================

        const particleCount = 80;

        const particlePositions =
            new Float32Array(
                particleCount * 3
            );


        for (
            let i = 0;
            i < particleCount;
            i++
        ) {

            const radius =
                60 +
                Math.random() * 100;

            const angle =
                Math.random() *
                Math.PI * 2;

            const height =
                (Math.random() - 0.5) *
                180;


            particlePositions[
                i * 3
            ] =
                Math.cos(angle) *
                radius;

            particlePositions[
                i * 3 + 1
            ] =
                height;

            particlePositions[
                i * 3 + 2
            ] =
                Math.sin(angle) *
                radius;
        }


        const particleGeometry =
            new THREE.BufferGeometry();

        particleGeometry.setAttribute(
            "position",
            new THREE.BufferAttribute(
                particlePositions,
                3
            )
        );


        const particleMaterial =
            new THREE.PointsMaterial({
                color: 0xaaddff,
                size: 4,
                transparent: true,
                opacity: 0.8,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });


        this.particles =
            new THREE.Points(
                particleGeometry,
                particleMaterial
            );

        this.group.add(
            this.particles
        );


        // ====================================================
        // STATE
        // ====================================================

        this.targetIntensity = 85;

        this.spawnTime = 0;

        this.spawnDuration = 500;
    }


    // ========================================================
    // SPAWN
    // ========================================================

    spawn(position) {

        this.group.visible = true;

        this.group.position.copy(
            position
        );

        this.spawnTime =
            performance.now();


        // Start small

        this.group.scale.setScalar(
            0.1
        );


        // Start lights at zero

        this.light.intensity = 0;
        this.blueLight.intensity = 0;
        this.whiteLight.intensity = 0;


        console.log(
            "GUIDING LIGHT SPAWNED"
        );
    }


    // ========================================================
    // UPDATE
    // ========================================================

    update(now) {

        if (!this.group.visible) {
            return;
        }


        // ====================================================
        // SPAWN FADE
        // ====================================================

        const elapsed =
            now -
            this.spawnTime;


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
                4
            );


        this.group.scale.setScalar(
            0.1 +
            eased * 0.9
        );


        // ====================================================
        // LIGHT PULSE
        // ====================================================

        const pulse =
            1 +
            Math.sin(
                now * 0.004
            ) * 0.12;


        const pulse2 =
            1 +
            Math.sin(
                now * 0.007
            ) * 0.08;


        // ====================================================
        // REAL LIGHT
        // ====================================================

        this.light.intensity =
            this.targetIntensity *
            eased *
            pulse;


        this.blueLight.intensity =
            50 *
            eased *
            pulse2;


        this.whiteLight.intensity =
            50 *
            eased;


        // ====================================================
        // CORE PULSE
        // ====================================================

        const coreScale =
            1 +
            Math.sin(
                now * 0.006
            ) * 0.08;


        this.core.scale.setScalar(
            coreScale
        );


        this.innerGlow.scale.setScalar(
            1.05 +
            Math.sin(
                now * 0.005
            ) * 0.12
        );


        this.outerGlow.scale.setScalar(
            1 +
            Math.sin(
                now * 0.003
            ) * 0.15
        );


        this.atmosphere.scale.setScalar(
            1 +
            Math.sin(
                now * 0.002
            ) * 0.12
        );


        // ====================================================
        // ROTATION
        // ====================================================

        this.wire.rotation.y +=
            0.008;

        this.wire.rotation.x +=
            0.004;


        this.ring1.rotation.z +=
            0.018;

        this.ring2.rotation.z -=
            0.013;


        // ====================================================
        // PARTICLES
        // ====================================================

        this.particles.rotation.y +=
            0.002;

        this.particles.rotation.x =
            Math.sin(
                now * 0.0005
            ) * 0.15;


        // ====================================================
        // LIGHT RAYS
        // ====================================================

        const rayPulse =
            1 +
            Math.sin(
                now * 0.003
            ) * 0.15;


        this.rayTop.scale.setScalar(
            rayPulse
        );

        this.rayBottom.scale.setScalar(
            rayPulse
        );
    }
}
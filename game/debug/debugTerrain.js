import * as THREE from "three";


export class TerrainDebug {

    constructor({
        scene,
        terrain
    }) {

        this.scene = scene;
        this.terrain = terrain;

        this.enabled = false;

        this.overlay = null;

        this.tKeyHeld = false;
        this.tHoldTimer = null;

        this.createOverlay();

        this.handleKeyDown =
            this.handleKeyDown.bind(this);

        this.handleKeyUp =
            this.handleKeyUp.bind(this);

        window.addEventListener(
            "keydown",
            this.handleKeyDown
        );

        window.addEventListener(
            "keyup",
            this.handleKeyUp
        );
    }


    // ==================================================
    // CREATE DEBUG OVERLAY
    // ==================================================

    createOverlay() {

        const size =
            this.terrain.size;

        const resolution =
            this.terrain.resolution;


        const geometry =
            new THREE.PlaneGeometry(
                size,
                size,
                resolution,
                resolution
            );


        geometry.rotateX(
            -Math.PI / 2
        );


        const position =
            geometry.attributes.position;

        const colors = [];


        for (
            let i = 0;
            i < position.count;
            i++
        ) {

            const x =
                position.getX(i);

            const z =
                position.getZ(i);


            const height =
                this.terrain.getHeight(
                    x,
                    z
                );


            let value =
                (
                    height /
                    this.terrain.heightScale +
                    1
                ) * 0.5;


            value =
                THREE.MathUtils.clamp(
                    value,
                    0,
                    1
                );


            /*
             * Lift the overlay slightly above
             * the actual terrain to prevent
             * z-fighting.
             */

            position.setY(
                i,
                height + 0.03
            );


            colors.push(
                value,
                value,
                value
            );
        }


        position.needsUpdate = true;


        geometry.setAttribute(
            "color",
            new THREE.Float32BufferAttribute(
                colors,
                3
            )
        );


        const material =
            new THREE.MeshBasicMaterial({

                vertexColors: true,

                side: THREE.DoubleSide,

                transparent: true,

                opacity: 0.85,

                depthWrite: false

            });


        this.overlay =
            new THREE.Mesh(
                geometry,
                material
            );


        this.overlay.name =
            "TerrainNoiseDebug";


        this.overlay.visible =
            false;


        this.scene.add(
            this.overlay
        );
    }


    // ==================================================
    // KEY DOWN
    // ==================================================

    handleKeyDown(event) {

        if (
            event.key.toLowerCase() !== "t"
        ) {
            return;
        }


        /*
         * Ignore browser key-repeat events.
         */

        if (this.tKeyHeld) {
            return;
        }


        this.tKeyHeld = true;


        /*
         * Must hold T for 5 seconds.
         */

        this.tHoldTimer =
            setTimeout(() => {

                /*
                 * Only toggle if T is still
                 * being held.
                 */

                if (this.tKeyHeld) {

                    this.toggle();

                }

                this.tHoldTimer = null;

            }, 2500);
    }


    // ==================================================
    // KEY UP
    // ==================================================

    handleKeyUp(event) {

        if (
            event.key.toLowerCase() !== "t"
        ) {
            return;
        }


        this.tKeyHeld = false;


        /*
         * Releasing T before 5 seconds
         * cancels the toggle.
         */

        if (this.tHoldTimer !== null) {

            clearTimeout(
                this.tHoldTimer
            );

            this.tHoldTimer = null;
        }
    }


    // ==================================================
    // TOGGLE
    // ==================================================

    toggle() {

        this.enabled =
            !this.enabled;


        this.overlay.visible =
            this.enabled;


        console.log(
            `Terrain Debug: ${
                this.enabled
                    ? "ON"
                    : "OFF"
            }`
        );
    }


    // ==================================================
    // DISPOSE
    // ==================================================

    dispose() {

        window.removeEventListener(
            "keydown",
            this.handleKeyDown
        );

        window.removeEventListener(
            "keyup",
            this.handleKeyUp
        );


        if (this.tHoldTimer !== null) {

            clearTimeout(
                this.tHoldTimer
            );

            this.tHoldTimer = null;
        }


        if (this.overlay) {

            this.scene.remove(
                this.overlay
            );

            this.overlay.geometry.dispose();

            this.overlay.material.dispose();

            this.overlay = null;
        }
    }
}
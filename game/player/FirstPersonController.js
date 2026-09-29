import * as THREE from "three";

export class FirstPersonController {

    constructor({

        camera,
        domElement,
        scene = null,

        terrainHeightFunction = null,

        movementSpeed = 5,
        jumpHeight = 2,
        gravity = 18,

        playerHeight = 1.7,
        playerRadius = 0.35,

        debugCapsule = true

    }) {

        // ==================================================
        // REFERENCES
        // ==================================================

        this.camera = camera;
        this.domElement = domElement;
        this.scene = scene;


        // ==================================================
        // SETTINGS
        // ==================================================

        this.movementSpeed = movementSpeed;
        this.jumpHeight = jumpHeight;
        this.gravity = gravity;

        this.playerHeight = playerHeight;
        this.playerRadius = playerRadius;


        // ==================================================
        // FPS MODE
        // ==================================================
        //
        // enabled means FPS CAMERA mode.
        //
        // Movement itself works regardless of this value.
        //

        this.enabled = false;


        // ==================================================
        // TERRAIN
        // ==================================================

        this.terrainHeightFunction =
            terrainHeightFunction;


        // ==================================================
        // PLAYER POSITION
        // ==================================================

        this.playerPosition =
            new THREE.Vector3(

                camera.position.x,
                camera.position.y,
                camera.position.z

            );


        // ==================================================
        // VELOCITY
        // ==================================================

        this.velocity =
            new THREE.Vector3();


        // ==================================================
        // MOVEMENT
        // ==================================================

        this.direction =
            new THREE.Vector3();

        this.moveDirection =
            new THREE.Vector3();


        // ==================================================
        // GROUND
        // ==================================================

        this.isGrounded = false;


        // ==================================================
        // CAMERA LOOK
        // ==================================================

        this.yaw =
            camera.rotation.y;

        this.pitch =
            camera.rotation.x;

        this.mouseSensitivity =
            0.002;


        // ==================================================
        // INPUT
        // ==================================================

        this.keys = {

            forward: false,
            backward: false,
            left: false,
            right: false,
            jump: false

        };


        // ==================================================
        // POINTER LOCK
        // ==================================================

        this.isLocked = false;


        // ==================================================
        // DEBUG CAPSULE
        // ==================================================

        this.debugCapsule = null;


        if (
            debugCapsule &&
            this.scene
        ) {

            this.createDebugCapsule();

        }


        // ==================================================
        // BIND
        // ==================================================

        this.onKeyDown =
            this.onKeyDown.bind(this);

        this.onKeyUp =
            this.onKeyUp.bind(this);

        this.onMouseMove =
            this.onMouseMove.bind(this);

        this.onPointerLockChange =
            this.onPointerLockChange.bind(this);

        this.onClick =
            this.onClick.bind(this);


        // ==================================================
        // EVENTS
        // ==================================================

        window.addEventListener(
            "keydown",
            this.onKeyDown
        );

        window.addEventListener(
            "keyup",
            this.onKeyUp
        );

        document.addEventListener(
            "mousemove",
            this.onMouseMove
        );

        document.addEventListener(
            "pointerlockchange",
            this.onPointerLockChange
        );

        this.domElement.addEventListener(
            "click",
            this.onClick
        );


        // ==================================================
        // INITIAL TERRAIN POSITION
        // ==================================================

        const startX =
            camera.position.x;

        const startZ =
            camera.position.z;


        let terrainY = 0;


        if (
            this.terrainHeightFunction
        ) {

            terrainY =
                this.terrainHeightFunction(
                    startX,
                    startZ
                );

        }


        this.playerPosition.y =
            terrainY +
            this.playerHeight;


        this.camera.position.copy(
            this.playerPosition
        );


        // ==================================================
        // INITIAL ROTATION
        // ==================================================

        this.yaw =
            this.camera.rotation.y;

        this.pitch =
            this.camera.rotation.x;


        this.updateCameraRotation();


        this.updateDebugCapsule();

    }


    // ==================================================
    // DEBUG CAPSULE
    // ==================================================

    createDebugCapsule() {

        const capsuleHeight =
            Math.max(

                this.playerHeight -
                this.playerRadius * 2,

                0.1

            );


        const geometry =
            new THREE.CapsuleGeometry(

                this.playerRadius,

                capsuleHeight,

                8,
                16

            );


        const material =
            new THREE.MeshBasicMaterial({

                color: 0xff4444,

                transparent: true,

                opacity: 0.35,

                depthWrite: false

            });


        this.debugCapsule =
            new THREE.Mesh(

                geometry,
                material

            );


        this.debugCapsule.position.set(

            this.playerPosition.x,

            this.playerPosition.y -
            this.playerHeight / 2,

            this.playerPosition.z

        );


        this.debugCapsule.renderOrder =
            999;


        this.scene.add(
            this.debugCapsule
        );

    }


    // ==================================================
    // UPDATE DEBUG CAPSULE
    // ==================================================

    updateDebugCapsule() {

        if (
            !this.debugCapsule
        ) {

            return;

        }


        this.debugCapsule.position.set(

            this.playerPosition.x,

            this.playerPosition.y -
            this.playerHeight / 2,

            this.playerPosition.z

        );

    }


    // ==================================================
    // CLICK
    // ==================================================

    onClick() {

        // Only FPS mode uses pointer lock.

        if (
            !this.enabled
        ) {

            return;

        }


        if (
            !this.isLocked
        ) {

            this.domElement.requestPointerLock();

        }

    }


    // ==================================================
    // POINTER LOCK
    // ==================================================

    onPointerLockChange() {

        this.isLocked =

            document.pointerLockElement ===
            this.domElement;

    }


    // ==================================================
    // KEY DOWN
    // ==================================================

    onKeyDown(event) {

        // IMPORTANT:
        //
        // There is deliberately NO
        // "if (!this.enabled)" here.
        //
        // WASD works in both FPS and Orbit.

        switch (event.code) {

            case "KeyW":

                this.keys.forward = true;

                break;


            case "KeyS":

                this.keys.backward = true;

                break;


            case "KeyA":

                this.keys.left = true;

                break;


            case "KeyD":

                this.keys.right = true;

                break;


            case "Space":

                this.keys.jump = true;

                break;

        }

    }


    // ==================================================
    // KEY UP
    // ==================================================

    onKeyUp(event) {

        switch (event.code) {

            case "KeyW":

                this.keys.forward = false;

                break;


            case "KeyS":

                this.keys.backward = false;

                break;


            case "KeyA":

                this.keys.left = false;

                break;


            case "KeyD":

                this.keys.right = false;

                break;


            case "Space":

                this.keys.jump = false;

                break;

        }

    }


    // ==================================================
    // MOUSE LOOK
    // ==================================================

    onMouseMove(event) {

        // Mouse look only exists in FPS mode.

        if (
            !this.enabled ||
            !this.isLocked
        ) {

            return;

        }


        this.yaw -=
            event.movementX *
            this.mouseSensitivity;


        this.pitch -=
            event.movementY *
            this.mouseSensitivity;


        const maxPitch =
            Math.PI / 2 - 0.05;


        this.pitch =

            Math.max(

                -maxPitch,

                Math.min(
                    maxPitch,
                    this.pitch
                )

            );


        this.updateCameraRotation();

    }


    // ==================================================
    // CAMERA ROTATION
    // ==================================================

    updateCameraRotation() {

        this.camera.rotation.order =
            "YXZ";


        this.camera.rotation.y =
            this.yaw;


        this.camera.rotation.x =
            this.pitch;


        this.camera.rotation.z =
            0;

    }


    // ==================================================
    // GET POSITION
    // ==================================================

    getPosition() {

        return this.playerPosition;

    }


    // ==================================================
    // SET POSITION
    // ==================================================

    setPosition(
        x,
        y,
        z
    ) {

        this.playerPosition.set(

            x,
            y,
            z

        );


        // Only move camera if FPS mode
        // currently owns the camera.

        if (
            this.enabled
        ) {

            this.camera.position.copy(
                this.playerPosition
            );

        }


        this.updateDebugCapsule();

    }


    // ==================================================
    // ENABLE FPS
    // ==================================================

    enable() {

        this.enabled = true;


        // FPS mode takes ownership of camera.

        this.camera.position.copy(
            this.playerPosition
        );


        this.updateCameraRotation();

    }


    // ==================================================
    // DISABLE FPS
    // ==================================================

    disable() {

        this.enabled = false;


        if (
            document.pointerLockElement ===
            this.domElement
        ) {

            document.exitPointerLock();

        }

    }


    // ==================================================
    // UPDATE
    // ==================================================

    update(delta) {

        // ==================================================
        // DELTA LIMIT
        // ==================================================

        delta =
            Math.min(
                delta,
                0.05
            );


        // ==================================================
        // INPUT DIRECTION
        // ==================================================

        this.direction.set(
            0,
            0,
            0
        );


        if (
            this.keys.forward
        ) {

            this.direction.z -= 1;

        }


        if (
            this.keys.backward
        ) {

            this.direction.z += 1;

        }


        if (
            this.keys.left
        ) {

            this.direction.x -= 1;

        }


        if (
            this.keys.right
        ) {

            this.direction.x += 1;

        }


        // ==================================================
        // NORMALIZE
        // ==================================================

        if (
            this.direction.lengthSq() > 0
        ) {

            this.direction.normalize();

        }


        // ==================================================
        // CAMERA-RELATIVE MOVEMENT
        // ==================================================
        //
        // Use yaw only.
        //
        // Looking up/down won't make the player fly.

        this.moveDirection.copy(
            this.direction
        );


        const yawRotation =
            new THREE.Euler(

                0,
                this.yaw,
                0,
                "YXZ"

            );


        this.moveDirection.applyEuler(
            yawRotation
        );


        // ==================================================
        // MOVE PLAYER
        // ==================================================

        this.playerPosition.x +=

            this.moveDirection.x *
            this.movementSpeed *
            delta;


        this.playerPosition.z +=

            this.moveDirection.z *
            this.movementSpeed *
            delta;


        // ==================================================
        // JUMP
        // ==================================================

        if (

            this.keys.jump &&
            this.isGrounded

        ) {

            this.velocity.y =

                Math.sqrt(

                    2 *
                    this.gravity *
                    this.jumpHeight

                );


            this.isGrounded = false;

        }


        // ==================================================
        // GRAVITY
        // ==================================================

        this.velocity.y -=
            this.gravity *
            delta;


        this.playerPosition.y +=

            this.velocity.y *
            delta;


        // ==================================================
        // TERRAIN
        // ==================================================

        let terrainY = 0;


        if (
            this.terrainHeightFunction
        ) {

            terrainY =

                this.terrainHeightFunction(

                    this.playerPosition.x,

                    this.playerPosition.z

                );

        }


        const groundY =

            terrainY +
            this.playerHeight;


        // ==================================================
        // GROUND COLLISION
        // ==================================================

        if (

            this.playerPosition.y <=
            groundY

        ) {

            this.playerPosition.y =
                groundY;


            this.velocity.y =
                0;


            this.isGrounded =
                true;

        }

        else {

            this.isGrounded =
                false;

        }


        // ==================================================
        // FPS CAMERA POSITION
        // ==================================================
        //
        // THIS IS THE IMPORTANT FIX.
        //
        // In FPS:
        //     controller controls camera.
        //
        // In Orbit:
        //     OrbitControls controls camera.
        //
        // Therefore NEVER overwrite camera.position
        // while in Orbit mode.

        if (
            this.enabled
        ) {

            this.camera.position.copy(
                this.playerPosition
            );

        }


        // ==================================================
        // FPS CAMERA ROTATION
        // ==================================================

        if (
            this.enabled
        ) {

            this.updateCameraRotation();

        }


        // ==================================================
        // DEBUG CAPSULE
        // ==================================================

        this.updateDebugCapsule();

    }


    // ==================================================
    // DISPOSE
    // ==================================================

    dispose() {

        window.removeEventListener(
            "keydown",
            this.onKeyDown
        );


        window.removeEventListener(
            "keyup",
            this.onKeyUp
        );


        document.removeEventListener(
            "mousemove",
            this.onMouseMove
        );


        document.removeEventListener(
            "pointerlockchange",
            this.onPointerLockChange
        );


        this.domElement.removeEventListener(
            "click",
            this.onClick
        );


        if (
            this.debugCapsule
        ) {

            this.scene.remove(
                this.debugCapsule
            );


            this.debugCapsule.geometry.dispose();

            this.debugCapsule.material.dispose();


            this.debugCapsule = null;

        }

    }

}
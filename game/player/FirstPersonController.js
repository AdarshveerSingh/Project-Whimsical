
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
        debugCapsule = true,
    }) {
        // REFERENCES
        this.camera = camera;
        this.domElement = domElement;
        this.scene = scene;

        // SETTINGS
        this.movementSpeed = movementSpeed;
        this.jumpHeight = jumpHeight;
        this.gravity = gravity;
        this.playerHeight = playerHeight;
        this.playerRadius = playerRadius;

        // Sprint
        this.sprintMultiplier = 1.7;

        // Momentum-based movement
        this.horizontalVelocity = new THREE.Vector3();
        this.groundAcceleration = 32;
        this.airAcceleration = 3.5;
        this.groundFriction = 14;
        this.airDrag = 0.8;

        this.maxGroundSpeed =
            this.movementSpeed * this.sprintMultiplier;
        this.maxAirSpeed = 8;

        // Dash
        this.dashHorizontalSpeed = 25;
        this.dashDuration = 0.18;
        this.dashCooldown = 0.55;

        this.dashTime = 0;
        this.dashCooldownTimer = 0;
        this.dashRequested = false;
        this.dashDirection = new THREE.Vector3();

        // Camera effects (visual only)
        this.cameraBobTime = 0;
        this.cameraBobAmount = 0;

        this.jumpCameraTime = -1;

        this.dashLeanTime = 0;
        this.dashLeanDuration = 0.32;
        this.dashLeanRoll = 0;
        this.dashLeanPitch = 0;

        // Dash-jump
        this.dashJumpWindow = 0.32;
        this.dashJumpWindowTimer = 0;
        this.dashJumpHeightMultiplier = 1.45;
        this.dashJumpForwardBoost = 1.0;
        this.dashJumpDirection = new THREE.Vector3();

        // Double jump
        this.maxJumps = 2;
        this.jumpsUsed = 0;
        this.jumpRequested = false;

        // FPS mode
        this.enabled = false;

        // Terrain
        this.terrainHeightFunction = terrainHeightFunction;

        // Player position
        this.playerPosition = new THREE.Vector3(
            camera.position.x,
            camera.position.y,
            camera.position.z
        );

        // Vertical velocity
        this.velocity = new THREE.Vector3();

        // Movement
        this.direction = new THREE.Vector3();
        this.moveDirection = new THREE.Vector3();

        // Ground
        this.isGrounded = false;

        // Camera look
        this.yaw = camera.rotation.y;
        this.pitch = camera.rotation.x;
        this.mouseSensitivity = 0.002;

        // Input
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            jump: false,
            sprint: false,
        };

        // Pointer lock
        this.isLocked = false;

        // Debug capsule
        this.debugCapsule = null;

        // Initial terrain position
        const startX = camera.position.x;
        const startZ = camera.position.z;

        let terrainY = 0;

        if (this.terrainHeightFunction) {
            const sampledHeight = this.terrainHeightFunction(
                startX,
                startZ
            );

            if (Number.isFinite(sampledHeight)) {
                terrainY = sampledHeight;
            } else {
                console.error(
                    "Invalid terrain height at initialization:",
                    {
                        startX,
                        startZ,
                        sampledHeight,
                    }
                );
            }
        }

        // playerPosition.y represents camera/eye height.
        this.playerPosition.y = terrainY + this.playerHeight;

        this.camera.position.copy(this.playerPosition);

        console.log("Player initialization:", {
            terrainY,
            playerHeight: this.playerHeight,
            playerY: this.playerPosition.y,
        });

        // Initial rotation
        this.updateCameraRotation();

        // Bind event handlers
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onKeyUp = this.onKeyUp.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onPointerLockChange =
            this.onPointerLockChange.bind(this);
        this.onClick = this.onClick.bind(this);

        // Events
        window.addEventListener("keydown", this.onKeyDown);
        window.addEventListener("keyup", this.onKeyUp);

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

        // Create debug capsule after position is initialized.
        if (debugCapsule && this.scene) {
            this.createDebugCapsule();
        }

        this.updateDebugCapsule();
    }

    // DEBUG CAPSULE
    createDebugCapsule() {
        const radius = Number.isFinite(this.playerRadius)
            ? Math.max(this.playerRadius, 0.01)
            : 0.35;

        const height = Number.isFinite(this.playerHeight)
            ? Math.max(this.playerHeight, radius * 2 + 0.1)
            : 1.7;

        const capsuleHeight = Math.max(
            height - radius * 2,
            0.1
        );

        const geometry = new THREE.CapsuleGeometry(
            radius,
            capsuleHeight,
            8,
            16
        );

        const material = new THREE.MeshBasicMaterial({
            color: 0xff4444,
            transparent: true,
            opacity: 0.35,
            depthWrite: false,
        });

        this.debugCapsule = new THREE.Mesh(
            geometry,
            material
        );

        this.debugCapsule.renderOrder = 999;

        this.scene.add(this.debugCapsule);
        this.updateDebugCapsule();
    }

    // UPDATE DEBUG CAPSULE
    updateDebugCapsule() {
        if (!this.debugCapsule) {
            return;
        }

        // Never pass invalid coordinates to the mesh.
        if (
            !Number.isFinite(this.playerPosition.x) ||
            !Number.isFinite(this.playerPosition.y) ||
            !Number.isFinite(this.playerPosition.z)
        ) {
            return;
        }

        this.debugCapsule.position.set(
            this.playerPosition.x,
            this.playerPosition.y - this.playerHeight / 2,
            this.playerPosition.z
        );
    }

    // CLICK
    onClick() {
        if (!this.enabled) {
            return;
        }

        if (!this.isLocked) {
            this.domElement.requestPointerLock();
        }
    }

    // POINTER LOCK
    onPointerLockChange() {
        this.isLocked =
            document.pointerLockElement === this.domElement;
    }

    // KEY DOWN
    onKeyDown(event) {
        
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

            case "ShiftLeft":
            case "ShiftRight":
                this.keys.sprint = true;
                break;

            case "Space":
                if (!event.repeat) {
                    this.jumpRequested = true;
                }

                this.keys.jump = true;
                break;

            case "KeyC":

    if (!event.repeat) {
        this.dashRequested = true;
    }
    break;
        }
    }

    // KEY UP
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

            case "ShiftLeft":
            case "ShiftRight":
                this.keys.sprint = false;
                break;

            case "Space":
                this.keys.jump = false;
                break;
        }
    }

    // MOUSE LOOK
    onMouseMove(event) {
        if (!this.enabled || !this.isLocked) {
            return;
        }

        this.yaw -=
            event.movementX * this.mouseSensitivity;

        this.pitch -=
            event.movementY * this.mouseSensitivity;

        const maxPitch = Math.PI / 2 - 0.05;

        this.pitch = Math.max(
            -maxPitch,
            Math.min(maxPitch, this.pitch)
        );

        this.updateCameraRotation();
    }

    // CAMERA ROTATION
    // CAMERA ROTATION
    updateCameraRotation() {
        this.camera.rotation.order = "YXZ";

        this.camera.rotation.y = this.yaw;

        let leanFade = 0;

        if (this.dashLeanTime > 0 && this.dashLeanDuration > 0) {
            const t = Math.min(
                1,
                this.dashLeanTime / this.dashLeanDuration
            );

            // Smoothly fade the dash lean out.
            leanFade = t * t * (3 - 2 * t);
        }

        this.camera.rotation.x =
            this.pitch + this.dashLeanPitch * leanFade;

        this.camera.rotation.z =
            this.dashLeanRoll * leanFade;
    }

    // GET POSITION
    getPosition() {
        return this.playerPosition;
    }

    // SET POSITION
    setPosition(x, y, z) {
        if (
            !Number.isFinite(x) ||
            !Number.isFinite(y) ||
            !Number.isFinite(z)
        ) {
            console.error("Invalid player position:", {
                x,
                y,
                z,
            });
            return;
        }

        this.playerPosition.set(x, y, z);

        if (this.enabled) {
            this.camera.position.copy(this.playerPosition);
        }

        this.updateDebugCapsule();
    }

    // ENABLE FPS
    enable() {
        this.enabled = true;

        this.camera.position.copy(this.playerPosition);
        this.updateCameraRotation();
    }

    // DISABLE FPS
    disable() {
        this.enabled = false;

        if (
            document.pointerLockElement === this.domElement
        ) {
            document.exitPointerLock();
        }
    }

    // UPDATE
    update(delta) {
        // Validate state before performing calculations.
        const invalidState = {
            positionX: this.playerPosition.x,
            positionY: this.playerPosition.y,
            positionZ: this.playerPosition.z,
            verticalVelocity: this.velocity.y,
            horizontalVelocityX: this.horizontalVelocity.x,
            horizontalVelocityY: this.horizontalVelocity.y,
            horizontalVelocityZ: this.horizontalVelocity.z,
        };

        const invalidEntries = Object.entries(invalidState)
            .filter(([, value]) => !Number.isFinite(value));

        if (invalidEntries.length > 0) {
            console.error(
                "Invalid player movement values:",
                invalidState
            );
            return;
        }

        if (!Number.isFinite(delta)) {
            console.error("Invalid frame delta:", delta);
            return;
        }

        // Prevent huge physics steps after a frame hitch.
        delta = Math.min(Math.max(delta, 0), 0.05);

        // Remember the previous ground state before processing movement.
        // This lets us follow small downhill height changes without
        // treating them as a jump or a fall.
        const wasGrounded = this.isGrounded;

        // INPUT DIRECTION
        this.direction.set(0, 0, 0);

        if (this.keys.forward) this.direction.z -= 1;
        if (this.keys.backward) this.direction.z += 1;
        if (this.keys.left) this.direction.x -= 1;
        if (this.keys.right) this.direction.x += 1;

        if (this.direction.lengthSq() > 0) {
            this.direction.normalize();
        }

        this.moveDirection.copy(this.direction);

        this.moveDirection.applyAxisAngle(
            new THREE.Vector3(0, 1, 0),
            this.yaw
        );

        // TIMERS
        this.dashCooldownTimer = Math.max(
            0,
            this.dashCooldownTimer - delta
        );

        this.dashJumpWindowTimer = Math.max(
            0,
            this.dashJumpWindowTimer - delta
        );

        // DASH
        if (
            this.dashRequested &&
            this.dashCooldownTimer <= 0
        ) {
            this.dashDirection.copy(this.moveDirection);

            // If no direction is pressed, dash forward.
            if (this.dashDirection.lengthSq() === 0) {
                this.dashDirection.set(0, 0, -1);

                this.dashDirection.applyAxisAngle(
                    new THREE.Vector3(0, 1, 0),
                    this.yaw
                );
            }

            this.dashDirection.y = 0;
            this.dashDirection.normalize();

            // Preserve existing momentum in the dash direction.
            const carriedSpeed = this.horizontalVelocity.dot(
                this.dashDirection
            );

            // Add a new burst on top of carried momentum.
            const dashSpeed = Math.max(
                this.dashHorizontalSpeed,
                carriedSpeed + this.dashHorizontalSpeed * 0.35
            );

            this.horizontalVelocity.addScaledVector(
                this.dashDirection,
                dashSpeed - carriedSpeed
            );

            this.dashTime = this.dashDuration;

            // Calculate camera lean from the dash direction.
            this.dashLeanRoll = -(
                this.dashDirection.x * Math.cos(this.yaw) -
                this.dashDirection.z * Math.sin(this.yaw)
            ) * 0.10;

            this.dashLeanPitch = (
                this.dashDirection.x * Math.sin(this.yaw) +
                this.dashDirection.z * Math.cos(this.yaw)
            ) * 0.035;

            this.dashLeanTime = this.dashLeanDuration;

            this.dashCooldownTimer = this.dashCooldown;

            // Remember the dash direction for a boosted jump.
            this.dashJumpDirection.copy(this.dashDirection);
            this.dashJumpWindowTimer = this.dashJumpWindow;
        }

        this.dashRequested = false;
        let applyDashJumpBoost = false;
        // JUMP / DOUBLE JUMP / DASH-JUMP
        if (
            this.jumpRequested &&
            this.jumpsUsed < this.maxJumps
        ) {
            const canDashJump =
                this.dashJumpWindowTimer > 0;
            // Camera-only anticipation for the initial jump.
            // Does not change jump velocity or physics.
            if (this.jumpsUsed === 0) {
                this.jumpCameraTime = 0;
            }
            const jumpMultiplier = canDashJump
                ? this.dashJumpHeightMultiplier
                : 1;

            // Calculate jump velocity from desired jump height.
            this.velocity.y = Math.sqrt(
                2 *
                this.gravity *
                this.jumpHeight *
                jumpMultiplier
            );

            this.jumpsUsed++;
            this.isGrounded = false;

            if (canDashJump) {
                applyDashJumpBoost = true;

                this.dashJumpWindowTimer = 0;
                this.dashTime = 0;
            }
        }

        this.jumpRequested = false;

        // HORIZONTAL MOVEMENT
        const hasMoveInput =
            this.moveDirection.lengthSq() > 0;

        const isDashing = this.dashTime > 0;

        if (isDashing) {
            this.dashTime = Math.max(
                0,
                this.dashTime - delta
            );
        }

        if (!isDashing && hasMoveInput) {
            const sprinting = this.keys.sprint;

            const targetSpeed = this.isGrounded
                ? this.movementSpeed *
                (sprinting ? this.sprintMultiplier : 1)
                : this.maxAirSpeed;

            const targetVelocity = this.moveDirection
                .clone()
                .multiplyScalar(targetSpeed);

            const acceleration = this.isGrounded
                ? this.groundAcceleration
                : this.airAcceleration;

            // Accelerate smoothly without instantly replacing momentum.
            this.horizontalVelocity.x = THREE.MathUtils.damp(
                this.horizontalVelocity.x,
                targetVelocity.x,
                acceleration,
                delta
            );

            this.horizontalVelocity.z = THREE.MathUtils.damp(
                this.horizontalVelocity.z,
                targetVelocity.z,
                acceleration,
                delta
            );
        } else if (!isDashing && this.isGrounded) {
            // Friction when movement input is released on the ground.
            const friction = Math.exp(
                -this.groundFriction * delta
            );

            this.horizontalVelocity.x *= friction;
            this.horizontalVelocity.z *= friction;

            if (this.horizontalVelocity.lengthSq() < 0.001) {
                this.horizontalVelocity.x = 0;
                this.horizontalVelocity.z = 0;
            }
        } else if (!isDashing && !this.isGrounded) {
            // Light air drag preserves momentum after dashing.
            const drag = Math.exp(-this.airDrag * delta);

            this.horizontalVelocity.x *= drag;
            this.horizontalVelocity.z *= drag;
        }
        // Apply dash-jump boost AFTER directional acceleration.
// This preserves the burst even while a movement key is held.
if (applyDashJumpBoost) {
    this.horizontalVelocity.addScaledVector(
        this.dashJumpDirection,
        this.movementSpeed * this.dashJumpForwardBoost
    );
}

        // Apply horizontal velocity.
        this.playerPosition.x +=
            this.horizontalVelocity.x * delta;

        this.playerPosition.z +=
            this.horizontalVelocity.z * delta;

        // GRAVITY / VERTICAL MOVEMENT
        if (!this.isGrounded || this.velocity.y > 0) {
            this.velocity.y -= this.gravity * delta;
        }

        this.playerPosition.y += this.velocity.y * delta;

        // TERRAIN HEIGHT
        // Sample at the player's CURRENT horizontal position.
        let terrainY = 0;

        if (this.terrainHeightFunction) {
            const sampledHeight = this.terrainHeightFunction(
                this.playerPosition.x,
                this.playerPosition.z
            );

            if (Number.isFinite(sampledHeight)) {
                terrainY = sampledHeight;
            } else {
                console.error("Invalid terrain height:", {
                    x: this.playerPosition.x,
                    z: this.playerPosition.z,
                    sampledHeight,
                });
            }
        }

        // Ground height for the camera/eye position.
        const groundY = terrainY + this.playerHeight;

        // GROUND COLLISION
        // Do not reset player Y while airborne.

        // GROUND COLLISION
        // Follow small downhill height changes while grounded,
        // but preserve normal jumping and falling behavior.

        const horizontalStep =
            Math.hypot(
                this.horizontalVelocity.x,
                this.horizontalVelocity.z
            ) * delta;

        // Allow a small downward adjustment based on movement
        // distance, with a strict cap to avoid snapping over drops.
        const maxGroundDrop = Math.min(
            0.12 + horizontalStep * 1.5,
            0.4
        );

        const groundGap = this.playerPosition.y - groundY;

        const shouldFollowGround =
            wasGrounded &&
            this.velocity.y <= 0 &&
            groundGap > 0 &&
            groundGap <= maxGroundDrop;

        if (this.playerPosition.y <= groundY || shouldFollowGround) {
            this.playerPosition.y = groundY;
            this.velocity.y = 0;
            this.isGrounded = true;

            // Restore jumps on landing.
            this.jumpsUsed = 0;

            // Expire the dash-jump window after landing.
            this.dashJumpWindowTimer = 0;
        } else {
            this.isGrounded = false;
        }


        // UPDATE CAMERA EFFECTS

        const horizontalSpeed = Math.hypot(
            this.horizontalVelocity.x,
            this.horizontalVelocity.z
        );

        // Walking / sprinting bob
        const bobActive =
            this.enabled &&
            this.isGrounded &&
            hasMoveInput &&
            !isDashing &&
            horizontalSpeed > 0.5;

        if (bobActive) {
            const sprinting = this.keys.sprint;

            const maxSpeed = this.movementSpeed *
                (sprinting ? this.sprintMultiplier : 1);

            const speedFactor = Math.min(
                1,
                horizontalSpeed / Math.max(0.01, maxSpeed)
            );

            this.cameraBobTime +=
                delta * (sprinting ? 13.5 : 9.5);

            const targetBobAmount =
                (sprinting ? 0.075 : 0.045) * speedFactor;

            this.cameraBobAmount +=
                (targetBobAmount - this.cameraBobAmount) *
                Math.min(1, delta * 10);
        } else {
            this.cameraBobAmount *= Math.exp(-12 * delta);
        }

        // Advance and finish the jump-camera animation
        if (this.jumpCameraTime >= 0) {
            this.jumpCameraTime += delta;

            if (this.jumpCameraTime >= 0.30) {
                this.jumpCameraTime = -1;
            }
        }

        // Fade dash lean independently of dash physics
        if (this.dashLeanTime > 0) {
            this.dashLeanTime = Math.max(
                0,
                this.dashLeanTime - delta
            );
        }

        // Apply visual camera position offset
        if (this.enabled) {
            let cameraYOffset = 0;

            if (this.cameraBobAmount > 0.001) {
                cameraYOffset +=
                    Math.abs(Math.sin(this.cameraBobTime)) *
                    this.cameraBobAmount;
            }

            // Dip briefly, then spring upward
            if (this.jumpCameraTime >= 0) {
                const t = this.jumpCameraTime;

                if (t < 0.07) {
                    cameraYOffset -= 0.10 * (t / 0.07);
                } else {
                    const springT = Math.min(
                        1,
                        (t - 0.07) / 0.23
                    );

                    cameraYOffset +=
                        0.12 *
                        Math.sin(Math.PI * springT) *
                        Math.exp(-1.8 * springT);
                }
            }

            this.camera.position.copy(this.playerPosition);
            this.camera.position.y += cameraYOffset;

            this.updateCameraRotation();
        }

        // DEBUG CAPSULE
        this.updateDebugCapsule();


        // DEBUG CAPSULE
        this.updateDebugCapsule();
    }

    // DISPOSE
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

        if (this.debugCapsule) {
            this.scene.remove(this.debugCapsule);

            this.debugCapsule.geometry.dispose();
            this.debugCapsule.material.dispose();

            this.debugCapsule = null;
        }
    }
}

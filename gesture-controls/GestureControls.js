import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

import {
    FilesetResolver,
    HandLandmarker
} from "https://esm.sh/@mediapipe/tasks-vision@0.10.14";

import  HandMesh   from "./HandMesh.js";
import { ShinyOrb } from "./ShinyOrb.js";
import { FireBall } from "./FireBall.js";


export class GestureControls {

    constructor(
        scene,
        {
            camera,
            renderDiv,
            videoElement = null,
            maxHands = 2,
            smoothing = 0.42,
            inferenceFPS = 30,
            worldWidth = null,
            worldHeight = null,
            debug = true
        } = {}
    ) {

        if (!scene) {
            throw new Error(
                "GestureControls requires a Three.js scene."
            );
        }

        this.scene = scene;
        this.camera = camera;

        this.renderDiv =
            renderDiv || document.body;

        this.videoElement =
            videoElement;

        this.maxHands =
            maxHands;

        this.smoothing =
            smoothing;

        this.inferenceFPS =
            inferenceFPS;

        this.worldWidth =
            worldWidth || window.innerWidth;

        this.worldHeight =
            worldHeight || window.innerHeight;

        this.debug =
            debug;


        // ====================================================
        // MEDIAPIPE
        // ====================================================

        this.handLandmarker =
            null;

        this.lastVideoTime =
            -1;

        this.lastInferenceTime =
            0;

        this.lastMediaPipeTimestamp =
            0;

        this.inferenceInterval =
            1000 / this.inferenceFPS;


        // ====================================================
        // HANDS
        // ====================================================

        this.hands =
            new Map();


        // ====================================================
        // SNAP
        // ====================================================

        this.snapStates =
            new Map();

        this.snapConfig = {

            contactDistance:
                0.065,

            releaseDistance:
                0.095,

            minimumReleaseSpeed:
                0.55,

            cooldown:
                400
        };


        // ====================================================
        // FIREBALL / PALM GESTURE
        // ====================================================

        this.palmStates =
            new Map();

        this._lastPalmDebug =
            0;

        this.fireBall =
            null;


        // ====================================================
        // FIREBALL TIMING
        // ====================================================

        // Maximum time allowed between the fist
        // and the palm becoming open.

        this.fastOpenTime =
            450;


        // ====================================================
        // GUIDING ORB
        // ====================================================

        this.orb =
            null;


        // ====================================================
        // STATE
        // ====================================================

        this.initialized =
            false;
    }


    // ========================================================
    // INITIALIZE
    // ========================================================

    async init() {

        if (this.initialized) {
            return;
        }


        // ====================================================
        // WEBCAM
        // ====================================================

        await this._ensureVideo();


        // ====================================================
        // MEDIAPIPE
        // ====================================================

        const vision =
            await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
            );


        this.handLandmarker =
            await HandLandmarker.createFromOptions(
                vision,
                {
                    baseOptions: {

                        modelAssetPath:
                            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",

                        delegate:
                            "GPU"
                    },

                    numHands:
                        this.maxHands,

                    runningMode:
                        "VIDEO",

                    minHandDetectionConfidence:
                        0.55,

                    minHandPresenceConfidence:
                        0.55,

                    minTrackingConfidence:
                        0.55
                }
            );


        // ====================================================
        // GUIDING ORB
        // ====================================================

        this.orb =
            new ShinyOrb(
                this.scene
            );


        // ====================================================
        // FIREBALL
        // ====================================================

        this.fireBall =
            new FireBall(
                this.scene
            );


        this.initialized =
            true;


        if (this.debug) {

            console.log(
                "MediaPipe HandLandmarker initialized"
            );
        }
    }


    // ========================================================
    // VIDEO
    // ========================================================

    async _ensureVideo() {

        if (!this.videoElement) {

            this.videoElement =
                document.createElement("video");


            this.videoElement.autoplay =
                true;

            this.videoElement.playsInline =
                true;

            this.videoElement.muted =
                true;


            this.videoElement.style.position =
                "fixed";

            this.videoElement.style.left =
                "0";

            this.videoElement.style.top =
                "0";

            this.videoElement.style.width =
                "100%";

            this.videoElement.style.height =
                "100%";

            this.videoElement.style.objectFit =
                "cover";

            this.videoElement.style.transform =
                "scaleX(-1)";

            this.videoElement.style.zIndex =
                "-1";

            this.videoElement.style.opacity =
                "0";


            this.renderDiv.appendChild(
                this.videoElement
            );
        }


        const stream =
            await navigator.mediaDevices.getUserMedia({

                video: {

                    facingMode:
                        "user",

                    width: {
                        ideal:
                            1920
                    },

                    height: {
                        ideal:
                            1080
                    }
                },

                audio:
                    false
            });


        this.videoElement.srcObject =
            stream;


        await this.videoElement.play();


        if (this.debug) {

            console.log(
                "Webcam started:",
                this.videoElement.videoWidth,
                "x",
                this.videoElement.videoHeight
            );
        }
    }


    // ========================================================
    // UPDATE
    // ========================================================

    update(now) {

        if (!this.initialized) {
            return;
        }


        if (!this.handLandmarker) {
            return;
        }


        if (!this.videoElement) {
            return;
        }


        if (
            this.videoElement.readyState <
            HTMLMediaElement.HAVE_CURRENT_DATA
        ) {

            return;
        }


        // ====================================================
        // FPS LIMIT
        // ====================================================

        if (
            now - this.lastInferenceTime <
            this.inferenceInterval
        ) {

            return;
        }


        this.lastInferenceTime =
            now;


        // ====================================================
        // SAME VIDEO FRAME
        // ====================================================

        if (
            this.videoElement.currentTime ===
            this.lastVideoTime
        ) {

            return;
        }


        this.lastVideoTime =
            this.videoElement.currentTime;


        // ====================================================
        // MEDIAPIPE TIMESTAMP
        // ====================================================

        let timestamp =
            Math.round(
                performance.now()
            );


        if (
            timestamp <=
            this.lastMediaPipeTimestamp
        ) {

            timestamp =
                this.lastMediaPipeTimestamp + 1;
        }


        this.lastMediaPipeTimestamp =
            timestamp;


        // ====================================================
        // DETECT
        // ====================================================

        let result;


        try {

            result =
                this.handLandmarker.detectForVideo(
                    this.videoElement,
                    timestamp
                );

        } catch (error) {

            console.error(
                "MediaPipe detection error:",
                error
            );

            return;
        }


        // ====================================================
        // PROCESS
        // ====================================================

        this._processResult(
            result,
            now
        );
    }


    // ========================================================
    // PROCESS RESULT
    // ========================================================

    _processResult(
        result,
        now
    ) {

        const detectedHands =
            result?.landmarks || [];


        // ====================================================
        // DETECTED HANDS
        // ====================================================

        for (
            let i = 0;
            i < detectedHands.length;
            i++
        ) {

            const landmarks =
                detectedHands[i];


            if (
                !landmarks ||
                landmarks.length < 21
            ) {
                continue;
            }


            const handedness =
                result.handednesses?.[i]?.[0];


            const label =
                handedness?.categoryName ||
                `Hand${i}`;


            let hand =
                this.hands.get(
                    label
                );


            // =================================================
            // CREATE HAND
            // =================================================

            if (!hand) {

                const color =
                    label === "Left"
                        ? 0x73fff0
                        : 0xff73d1;


                const mesh =
                    new HandMesh(
                        this.scene,
                        {
                            color,

                            activeColor:
                                0xffffff,

                            worldWidth:
                                this.worldWidth,

                            worldHeight:
                                this.worldHeight,

                            depthScale:
                                130
                        }
                    );


                mesh._video =
                    this.videoElement;


                hand = {

                    mesh,

                    previousLandmarks:
                        null,

                    previousTime:
                        now
                };


                this.hands.set(
                    label,
                    hand
                );


                // ---------------------------------------------
                // SNAP STATE
                // ---------------------------------------------

                this.snapStates.set(
                    hand,
                    {

                        phase:
                            "idle",

                        lastSnap:
                            -Infinity,

                        contactTime:
                            0
                    }
                );


                // ---------------------------------------------
                // PALM STATE
                // ---------------------------------------------

                this.palmStates.set(
                    hand,
                    {

                        phase:
                            "unknown",

                        closeDetected:
                            false,

                        lastSpawn:
                            -Infinity,

                        openFrames:
                            0,

                        closedFrames:
                            0,

                        openStartTime:
                            0
                    }
                );


                if (this.debug) {

                    console.log(
                        "NEW HAND:",
                        label
                    );
                }
            }


            // =================================================
            // HAND SIZE
            // =================================================

            hand.mesh.setSize(
                this.videoElement.videoWidth,
                this.videoElement.videoHeight
            );


            // =================================================
            // HAND MESH
            // =================================================

            hand.mesh.update(
                landmarks,
                this.smoothing
            );


            // =================================================
            // FIREBALL GESTURE
            // =================================================

            const palmGesture =
                this._updatePalmGesture(
                    hand,
                    landmarks,
                    now
                );


            // =================================================
            // SPAWN FIREBALL
            // =================================================

            if (
                palmGesture.spawn &&
                this.fireBall
            ) {

                const palmPosition =
                    this._landmarkToWorld(
                        landmarks[9]
                    );


                // Move slightly in front of palm

                palmPosition.z +=
                    35;


                this.fireBall.spawn(
                    palmPosition
                );
            }


            // =================================================
            // EXTINGUISH FIREBALL
            // =================================================

            if (
                palmGesture.extinguish &&
                this.fireBall
            ) {

                if (
                    this.fireBall.active
                ) {

                    this.fireBall.hide();
                }
            }


            // =================================================
            // FIREBALL FOLLOWS PALM
            // =================================================

            if (
                this.fireBall &&
                this.fireBall.active
            ) {

                const palmPosition =
                    this._landmarkToWorld(
                        landmarks[9]
                    );


                palmPosition.z +=
                    35;


                this.fireBall.setPosition(
                    palmPosition
                );
            }


            // =================================================
            // SNAP
            // =================================================

            const snap =
                this._updateSnapState(
                    hand,
                    landmarks,
                    now
                );


            hand.mesh.setActive(
                snap.contact
            );


            // =================================================
            // GUIDING LIGHT
            // =================================================

            if (
                snap.triggered &&
                this.orb
            ) {

                const middle =
                    landmarks[12];


                const position =
                    this._landmarkToWorld(
                        middle
                    );


                position.y +=
                    100;


                this.orb.spawn(
                    position
                );
            }
        }


        // ====================================================
        // VISIBLE HANDS
        // ====================================================

        const visibleLabels =
            new Set();


        for (
            let i = 0;
            i < detectedHands.length;
            i++
        ) {

            const label =
                result.handednesses?.[i]?.[0]
                    ?.categoryName ||
                `Hand${i}`;


            visibleLabels.add(
                label
            );
        }


        // ====================================================
        // HIDE LOST HANDS
        // ====================================================

        for (
            const [label, hand]
            of this.hands
        ) {

            if (
                !visibleLabels.has(
                    label
                )
            ) {

                hand.mesh.setVisible(
                    false
                );
            }
        }


        // ====================================================
        // UPDATE ORB
        // ====================================================

        if (this.orb) {

            this.orb.update(
                now
            );
        }


        // ====================================================
        // UPDATE FIREBALL
        // ====================================================

        if (this.fireBall) {

            this.fireBall.update(
                now
            );
        }
    }


    // ========================================================
    // PALM GESTURE
    //
    // OPEN → FIST → FAST OPEN
    //
    // FIST:
    //      extinguishes existing fireball
    //
    // FAST FIST → OPEN:
    //      creates fireball
    //
    // SLOW FIST → OPEN:
    //      nothing happens
    // ========================================================

    _updatePalmGesture(
        hand,
        landmarks,
        now
    ) {

        const wrist =
            landmarks[0];


        // ====================================================
        // FINGER DEFINITIONS
        // ====================================================

        const fingers = [

            {
                name:
                    "Index",

                tip:
                    8,

                pip:
                    6
            },

            {
                name:
                    "Middle",

                tip:
                    12,

                pip:
                    10
            },

            {
                name:
                    "Ring",

                tip:
                    16,

                pip:
                    14
            },

            {
                name:
                    "Pinky",

                tip:
                    20,

                pip:
                    18
            }
        ];


        let extendedCount =
            0;


        const fingerStatus =
            [];


        // ====================================================
        // CHECK EACH FINGER
        // ====================================================

        for (
            const finger
            of fingers
        ) {

            const tipDistance =
                this._distance3(
                    landmarks[finger.tip],
                    wrist
                );


            const pipDistance =
                this._distance3(
                    landmarks[finger.pip],
                    wrist
                );


            const extended =
                tipDistance >
                pipDistance * 1.18;


            if (extended) {
                extendedCount++;
            }


            fingerStatus.push({

                Finger:
                    finger.name,

                Extended:
                    extended,

                TipDistance:
                    Number(
                        tipDistance.toFixed(3)
                    ),

                PIPDistance:
                    Number(
                        pipDistance.toFixed(3)
                    )
            });
        }


        // ====================================================
        // OPEN / CLOSED
        // ====================================================

        const isOpen =
            extendedCount >= 3;


        const isClosed =
            extendedCount <= 1;


        // ====================================================
        // GET STATE
        // ====================================================

        let state =
            this.palmStates.get(
                hand
            );


        if (!state) {

            state = {

                phase:
                    "unknown",

                closeDetected:
                    false,

                lastSpawn:
                    -Infinity,

                openFrames:
                    0,

                closedFrames:
                    0,

                openStartTime:
                    0
            };


            this.palmStates.set(
                hand,
                state
            );
        }


        // ====================================================
        // STABILITY
        // ====================================================

        if (isOpen) {

            state.openFrames++;

            state.closedFrames =
                0;

        }

        else if (isClosed) {

            state.closedFrames++;

            state.openFrames =
                0;

        }

        else {

            state.openFrames =
                0;

            state.closedFrames =
                0;
        }


        // ====================================================
        // DEBUG
        // ====================================================

        if (
            this.debug &&
            (
                !this._lastPalmDebug ||
                now - this._lastPalmDebug > 150
            )
        ) {

            console.log(
                "================ PALM DEBUG ================"
            );


            console.log(
                "Hand:",
                this.hands
                    ? [...this.hands.entries()]
                        .find(
                            ([, h]) => h === hand
                        )?.[0]
                    : "Unknown"
            );


            console.log(
                "Extended fingers:",
                extendedCount,
                "/ 4"
            );


            console.log(
                "Open:",
                isOpen
            );


            console.log(
                "Closed:",
                isClosed
            );


            console.log(
                "State:",
                state.phase
            );


            console.log(
                "Close detected:",
                state.closeDetected
            );


            console.log(
                "Open frames:",
                state.openFrames
            );


            console.log(
                "Closed frames:",
                state.closedFrames
            );


            if (
                state.openStartTime > 0
            ) {

                console.log(
                    "Opening time:",
                    now -
                    state.openStartTime,
                    "ms"
                );
            }


            console.log(
                "Fast open limit:",
                this.fastOpenTime,
                "ms"
            );


            console.log(
                "Fireball active:",
                this.fireBall
                    ? this.fireBall.active
                    : false
            );


            console.table(
                fingerStatus
            );


            console.log(
                "============================================"
            );


            this._lastPalmDebug =
                now;
        }


        let spawn =
            false;


        let extinguish =
            false;


        // ====================================================
        // INITIAL STATE
        // ====================================================

        if (
            state.phase === "unknown"
        ) {

            if (
                state.openFrames >= 3
            ) {

                state.phase =
                    "open";


                if (this.debug) {

                    console.log(
                        "🖐️ INITIAL STATE → OPEN"
                    );
                }
            }

            else if (
                state.closedFrames >= 3
            ) {

                state.phase =
                    "closed";


                if (this.debug) {

                    console.log(
                        "✊ INITIAL STATE → CLOSED"
                    );
                }
            }


            return {

                spawn:
                    false,

                extinguish:
                    false
            };
        }


        // ====================================================
        // OPEN → CLOSED
        //
        // CLOSE PALM
        // ====================================================

        if (
            state.phase === "open" &&
            state.closedFrames >= 3
        ) {

            state.phase =
                "closed";


            state.closeDetected =
                true;


            // Start measuring how quickly
            // the hand opens again.

            state.openStartTime =
                now;


            // =================================================
            // EXTINGUISH EXISTING FIREBALL
            // =================================================

            if (
                this.fireBall &&
                this.fireBall.active
            ) {

                extinguish =
                    true;


                if (this.debug) {

                    console.log(
                        "============================================"
                    );

                    console.log(
                        "✊ PALM CLOSED"
                    );

                    console.log(
                        "🔥 FIREBALL EXTINGUISHED"
                    );

                    console.log(
                        "============================================"
                    );
                }
            }


            if (this.debug) {

                console.log(
                    "✊ FIST DETECTED"
                );

                console.log(
                    "⚡ OPENING TIMER STARTED"
                );

                console.log(
                    "Fast open limit:",
                    this.fastOpenTime,
                    "ms"
                );
            }
        }


        // ====================================================
        // CLOSED → OPEN
        //
        // FIREBALL ONLY IF OPENED QUICKLY
        // ====================================================

        if (
            state.phase === "closed" &&
            state.openFrames >= 3
        ) {

            const openingTime =
                state.openStartTime > 0
                    ? now -
                        state.openStartTime
                    : Infinity;


            const openedQuickly =
                openingTime <=
                this.fastOpenTime;


            if (this.debug) {

                console.log(
                    "============================================"
                );

                console.log(
                    "🖐️ OPEN PALM DETECTED"
                );

                console.log(
                    "Opening time:",
                    openingTime,
                    "ms"
                );

                console.log(
                    "Fast enough:",
                    openedQuickly
                );

                console.log(
                    "Required:",
                    this.fastOpenTime,
                    "ms or less"
                );
            }


            // =================================================
            // FIREBALL
            // =================================================

            if (
                state.closeDetected &&
                openedQuickly &&
                now -
                    state.lastSpawn >
                    600
            ) {

                spawn =
                    true;


                state.lastSpawn =
                    now;


                if (this.debug) {

                    console.log(
                        "🔥🔥🔥 FAST PALM OPEN → FIREBALL 🔥🔥🔥"
                    );
                }
            }


            // =================================================
            // TOO SLOW
            // =================================================

            else if (
                state.closeDetected &&
                !openedQuickly
            ) {

                if (this.debug) {

                    console.log(
                        "❌ PALM OPENED TOO SLOWLY"
                    );

                    console.log(
                        "Opening took:",
                        openingTime,
                        "ms"
                    );

                    console.log(
                        "Maximum allowed:",
                        this.fastOpenTime,
                        "ms"
                    );
                }
            }


            // =================================================
            // COOLDOWN
            // =================================================

            else if (this.debug) {

                console.log(
                    "❌ FIREBALL BLOCKED BY COOLDOWN"
                );
            }


            state.phase =
                "open";


            state.closeDetected =
                false;


            state.openStartTime =
                0;


            if (this.debug) {

                console.log(
                    "============================================"
                );
            }
        }


        return {

            spawn,

            extinguish
        };
    }


    // ========================================================
    // SNAP GESTURE
    //
    // Thumb + middle only.
    //
    // 1. Contact
    // 2. Fast separation
    // 3. Middle ends below thumb
    // ========================================================

    _updateSnapState(
        hand,
        landmarks,
        now
    ) {

        const thumb =
            landmarks[4];


        const middle =
            landmarks[12];


        // ====================================================
        // DISTANCE
        // ====================================================

        const distance =
            this._distance3(
                thumb,
                middle
            );


        // ====================================================
        // VELOCITY
        // ====================================================

        let velocity =
            0;


        if (
            hand.previousLandmarks
        ) {

            const previousThumb =
                hand.previousLandmarks[4];


            const dt =
                Math.max(
                    0.001,
                    (
                        now -
                        hand.previousTime
                    ) / 1000
                );


            const dx =
                thumb.x -
                previousThumb.x;


            const dy =
                thumb.y -
                previousThumb.y;


            const dz =
                thumb.z -
                previousThumb.z;


            velocity =
                Math.sqrt(
                    dx * dx +
                    dy * dy +
                    dz * dz
                ) / dt;
        }


        // ====================================================
        // SAVE PREVIOUS
        // ====================================================

        hand.previousLandmarks =
            landmarks.map(
                p => ({

                    x:
                        p.x,

                    y:
                        p.y,

                    z:
                        p.z
                })
            );


        hand.previousTime =
            now;


        // ====================================================
        // STATE
        // ====================================================

        let state =
            this.snapStates.get(
                hand
            );


        if (!state) {

            state = {

                phase:
                    "idle",

                lastSnap:
                    -Infinity,

                contactTime:
                    0
            };


            this.snapStates.set(
                hand,
                state
            );
        }


        let triggered =
            false;


        // ====================================================
        // IDLE → CONTACT
        // ====================================================

        if (
            state.phase === "idle"
        ) {

            if (
                distance <
                    this.snapConfig.contactDistance &&

                now -
                    state.lastSnap >
                    this.snapConfig.cooldown
            ) {

                state.phase =
                    "contact";


                state.contactTime =
                    now;


                if (this.debug) {

                    console.log(
                        "MIDDLE CONTACT"
                    );
                }
            }
        }


        // ====================================================
        // CONTACT → SNAP
        // ====================================================

        else if (
            state.phase === "contact"
        ) {

            const fastEnough =
                velocity >
                this.snapConfig.minimumReleaseSpeed;


            const released =
                distance >
                this.snapConfig.releaseDistance;


            const middleBelowThumb =
                middle.y >
                thumb.y + 0.015;


            if (
                released &&
                fastEnough &&
                middleBelowThumb
            ) {

                triggered =
                    true;


                state.phase =
                    "idle";


                state.lastSnap =
                    now;


                if (this.debug) {

                    console.log(
                        "SNAP ✓"
                    );
                }
            }


            // ------------------------------------------------
            // TIMEOUT
            // ------------------------------------------------

            else if (
                now -
                    state.contactTime >
                    300
            ) {

                state.phase =
                    "idle";
            }


            // ------------------------------------------------
            // TOO FAR APART
            // ------------------------------------------------

            else if (
                distance >
                    this.snapConfig.releaseDistance *
                    1.8
            ) {

                state.phase =
                    "idle";
            }
        }


        return {

            contact:
                state.phase === "contact",

            triggered
        };
    }


    // ========================================================
    // DISTANCE
    // ========================================================

    _distance3(
        a,
        b
    ) {

        const dx =
            a.x -
            b.x;


        const dy =
            a.y -
            b.y;


        const dz =
            a.z -
            b.z;


        return Math.sqrt(
            dx * dx +
            dy * dy +
            dz * dz
        );
    }


    // ========================================================
    // LANDMARK → WORLD
    // ========================================================

    _landmarkToWorld(
        landmark
    ) {

        let x =
            landmark.x;


        let y =
            landmark.y;


        const video =
            this.videoElement;


        // ====================================================
        // OBJECT-FIT: COVER
        // ====================================================

        if (
            video &&
            video.videoWidth > 0 &&
            video.videoHeight > 0
        ) {

            const videoAspect =
                video.videoWidth /
                video.videoHeight;


            const screenAspect =
                this.worldWidth /
                this.worldHeight;


            // ------------------------------------------------
            // Horizontal crop
            // ------------------------------------------------

            if (
                videoAspect >
                screenAspect
            ) {

                const visibleWidth =
                    screenAspect /
                    videoAspect;


                const cropX =
                    (
                        1 -
                        visibleWidth
                    ) / 2;


                x =
                    (
                        x -
                        cropX
                    ) /
                    visibleWidth;
            }


            // ------------------------------------------------
            // Vertical crop
            // ------------------------------------------------

            else {

                const visibleHeight =
                    videoAspect /
                    screenAspect;


                const cropY =
                    (
                        1 -
                        visibleHeight
                    ) / 2;


                y =
                    (
                        y -
                        cropY
                    ) /
                    visibleHeight;
            }
        }


        // ====================================================
        // MIRROR
        // ====================================================

        x =
            1 -
            x;


        // ====================================================
        // SCREEN → THREE.JS
        // ====================================================

        const worldX =
            (
                x -
                0.5
            ) *
            this.worldWidth;


        const worldY =
            (
                0.5 -
                y
            ) *
            this.worldHeight;


        const worldZ =
            10 -
            landmark.z *
            130;


        return new THREE.Vector3(
            worldX,
            worldY,
            worldZ
        );
    }
}


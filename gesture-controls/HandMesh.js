import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";


// ============================================================
// ONE EURO FILTER
// ============================================================

class OneEuroFilter {

    constructor(
        minCutoff = 1.2,
        beta = 0.015,
        dCutoff = 1.0
    ) {

        this.minCutoff = minCutoff;
        this.beta = beta;
        this.dCutoff = dCutoff;

        this.xPrev = null;
        this.dxPrev = 0;
        this.tPrev = null;
    }


    // ----------------------------------------------------------
    // ALPHA
    // ----------------------------------------------------------

    _alpha(cutoff, dt) {

        const tau =
            1 /
            (2 * Math.PI * cutoff);

        return 1 /
            (1 + tau / dt);
    }


    // ----------------------------------------------------------
    // FILTER
    // ----------------------------------------------------------

    filter(value, timestamp) {

        if (
            this.xPrev === null ||
            this.tPrev === null
        ) {

            this.xPrev = value;
            this.tPrev = timestamp;

            return value;
        }


        let dt =
            (timestamp - this.tPrev) / 1000;


        if (
            dt <= 0 ||
            !Number.isFinite(dt)
        ) {

            dt = 1 / 60;
        }


        this.tPrev =
            timestamp;


        // ------------------------------------------------------
        // DERIVATIVE
        // ------------------------------------------------------

        const dx =
            (value - this.xPrev) / dt;


        const alphaD =
            this._alpha(
                this.dCutoff,
                dt
            );


        const dxHat =
            alphaD * dx +
            (1 - alphaD) * this.dxPrev;


        this.dxPrev =
            dxHat;


        // ------------------------------------------------------
        // ADAPTIVE CUTOFF
        // ------------------------------------------------------

        const cutoff =
            this.minCutoff +
            this.beta *
            Math.abs(dxHat);


        const alpha =
            this._alpha(
                cutoff,
                dt
            );


        const result =
            alpha * value +
            (1 - alpha) * this.xPrev;


        this.xPrev =
            result;


        return result;
    }

}


// ============================================================
// HAND MESH
// ============================================================

class HandMesh {

    constructor(
        scene,
        {
            color = 0xff00ff,
            activeColor = 0xffffff,
            worldWidth = null,
            worldHeight = null,
            depthScale = 130
        } = {}
    ) {

        this.scene =
            scene;


        // ------------------------------------------------------
        // THREE.JS WORLD SIZE
        // ------------------------------------------------------
        //
        // IMPORTANT:
        //
        // These are SCREEN dimensions, not webcam dimensions.
        //
        // GestureControls later calls:
        //
        //     setSize(videoWidth, videoHeight)
        //
        // but we deliberately do NOT replace the world size
        // with the video resolution.
        // ------------------------------------------------------

        this.worldWidth =
            worldWidth ??
            window.innerWidth;

        this.worldHeight =
            worldHeight ??
            window.innerHeight;


        this.depthScale =
            depthScale;


        // GestureControls assigns this:
        //
        //     mesh._video = this.videoElement;
        //
        this._video =
            null;


        // ------------------------------------------------------
        // STATE
        // ------------------------------------------------------

        this.visible =
            true;

        this.active =
            false;


        // ------------------------------------------------------
        // LANDMARK POSITIONS
        // ------------------------------------------------------

        this.joints = [];


        // GestureControls / main.js reads this.
        //
        // These are filtered THREE.Vector3 positions.
        //
        this.smoothedPositions =
            this.joints;


        // ------------------------------------------------------
        // ONE EURO SETTINGS
        // ------------------------------------------------------

        this.filterMinCutoff =
            1.2;

        this.filterBeta =
            0.015;

        this.filterDCutoff =
            1.0;


        this.filters = [];


        for (
            let i = 0;
            i < 21;
            i++
        ) {

            this.filters.push({

                x:
                    new OneEuroFilter(
                        this.filterMinCutoff,
                        this.filterBeta,
                        this.filterDCutoff
                    ),

                y:
                    new OneEuroFilter(
                        this.filterMinCutoff,
                        this.filterBeta,
                        this.filterDCutoff
                    ),

                z:
                    new OneEuroFilter(
                        this.filterMinCutoff,
                        this.filterBeta,
                        this.filterDCutoff
                    )

            });

        }


        // ------------------------------------------------------
        // TRACKING
        // ------------------------------------------------------

        this.lastValidTime =
            0;

        this.lostTimeout =
            150;


        // ======================================================
        // JOINTS
        // ======================================================

        this.jointGeometry =
            new THREE.SphereGeometry(
                5,
                12,
                12
            );


        this.jointMaterial =
            new THREE.MeshBasicMaterial({
                color
            });


        this.activeMaterial =
            new THREE.MeshBasicMaterial({
                color:
                    activeColor
            });


        this.jointMeshes = [];


        for (
            let i = 0;
            i < 21;
            i++
        ) {

            const mesh =
                new THREE.Mesh(
                    this.jointGeometry,
                    this.jointMaterial
                );


            mesh.visible =
                this.visible;


            mesh.frustumCulled =
                false;


            this.scene.add(
                mesh
            );


            this.jointMeshes.push(
                mesh
            );


            this.joints.push(
                new THREE.Vector3()
            );

        }


        // ======================================================
        // MEDIAPIPE CONNECTIONS
        // ======================================================

        this.connections = [

            // Thumb
            [0, 1],
            [1, 2],
            [2, 3],
            [3, 4],

            // Index
            [0, 5],
            [5, 6],
            [6, 7],
            [7, 8],

            // Middle
            [0, 9],
            [9, 10],
            [10, 11],
            [11, 12],

            // Ring
            [0, 13],
            [13, 14],
            [14, 15],
            [15, 16],

            // Pinky
            [0, 17],
            [17, 18],
            [18, 19],
            [19, 20],

            // Palm
            [5, 9],
            [9, 13],
            [13, 17]

        ];


        // ======================================================
        // LINE MATERIAL
        // ======================================================

        this.lineMaterial =
            new THREE.LineBasicMaterial({
                color,
                transparent: true,
                opacity: 1
            });


        this.lines = [];


        for (
            const [a, b]
            of this.connections
        ) {

            const geometry =
                new THREE.BufferGeometry();


            geometry.setFromPoints([
                this.joints[a],
                this.joints[b]
            ]);


            const line =
                new THREE.Line(
                    geometry,
                    this.lineMaterial
                );


            line.visible =
                this.visible;


            line.frustumCulled =
                false;


            this.scene.add(
                line
            );


            this.lines.push(
                line
            );

        }

    }


    // ==========================================================
    // SET SIZE
    // ==========================================================
    //
    // GestureControls calls this with:
    //
    //     video.videoWidth
    //     video.videoHeight
    //
    // We intentionally IGNORE those values for the Three.js
    // world dimensions.
    //
    // The actual Three.js coordinate space is the browser
    // viewport.
    // ==========================================================

    setSize(
        worldWidth,
        worldHeight
    ) {

        // Do NOT use the camera/video resolution here.
        //
        // Keep the Three.js screen coordinate system.

        this.worldWidth =
            window.innerWidth;

        this.worldHeight =
            window.innerHeight;

    }


    // ==========================================================
    // MAP LANDMARK
    // ==========================================================
    //
    // MediaPipe:
    //
    //     x = 0..1
    //     y = 0..1
    //
    // These coordinates describe the ORIGINAL camera frame.
    //
    // But the webcam is displayed with:
    //
    //     object-fit: cover
    //
    // and:
    //
    //     scaleX(-1)
    //
    // Therefore we reproduce that exact transformation.
    // ==========================================================

    _mapLandmark(
        landmark
    ) {

        const screenWidth =
            this.worldWidth;

        const screenHeight =
            this.worldHeight;


        // ------------------------------------------------------
        // VIDEO
        // ------------------------------------------------------

        const video =
            this._video;


        const videoWidth =
            video?.videoWidth ||
            1920;


        const videoHeight =
            video?.videoHeight ||
            1080;


        // ------------------------------------------------------
        // ASPECT RATIOS
        // ------------------------------------------------------

        const videoAspect =
            videoWidth /
            videoHeight;


        const screenAspect =
            screenWidth /
            screenHeight;


        let x =
            landmark.x;

        let y =
            landmark.y;


        // ======================================================
        // OBJECT-FIT: COVER
        // ======================================================

        if (
            videoAspect >
            screenAspect
        ) {

            // --------------------------------------------------
            // CAMERA IS WIDER
            //
            // The left/right sides are cropped.
            // --------------------------------------------------

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

        } else {

            // --------------------------------------------------
            // CAMERA IS TALLER
            //
            // Top/bottom are cropped.
            // --------------------------------------------------

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


        // ======================================================
        // MIRROR
        // ======================================================
        //
        // main.js / GestureControls displays:
        //
        //     scaleX(-1)
        //
        // so we mirror X as well.
        // ======================================================

        x =
            1 -
            x;


        // ======================================================
        // NORMALIZED → THREE.JS
        // ======================================================

        const worldX =
            (
                x -
                0.5
            ) *
            screenWidth;


        const worldY =
            (
                0.5 -
                y
            ) *
            screenHeight;


        // ======================================================
        // DEPTH
        // ======================================================

        const worldZ =
            10 -
            landmark.z *
            this.depthScale;


        return new THREE.Vector3(
            worldX,
            worldY,
            worldZ
        );

    }


    // ==========================================================
    // UPDATE
    // ==========================================================

    update(
        landmarks,
        smoothing = 0.42
    ) {

        if (
            !landmarks ||
            landmarks.length < 21
        ) {

            return;
        }


        const now =
            performance.now();


        this.lastValidTime =
            now;


        // ======================================================
        // PROCESS LANDMARKS
        // ======================================================

        for (
            let i = 0;
            i < 21;
            i++
        ) {

            const landmark =
                landmarks[i];


            if (!landmark) {
                continue;
            }


            // --------------------------------------------------
            // MAP CAMERA → SCREEN
            // --------------------------------------------------

            const target =
                this._mapLandmark(
                    landmark
                );


            const filter =
                this.filters[i];


            // --------------------------------------------------
            // FILTER X
            // --------------------------------------------------

            const filteredX =
                filter.x.filter(
                    target.x,
                    now
                );


            // --------------------------------------------------
            // FILTER Y
            // --------------------------------------------------

            const filteredY =
                filter.y.filter(
                    target.y,
                    now
                );


            // --------------------------------------------------
            // FILTER Z
            // --------------------------------------------------

            const filteredZ =
                filter.z.filter(
                    target.z,
                    now
                );


            this.joints[i].set(
                filteredX,
                filteredY,
                filteredZ
            );


            // --------------------------------------------------
            // MOVE VISIBLE JOINT
            // --------------------------------------------------

            this.jointMeshes[i]
                .position.copy(
                    this.joints[i]
                );

        }


        // ======================================================
        // UPDATE CONNECTIONS
        // ======================================================

        for (
            let i = 0;
            i < this.connections.length;
            i++
        ) {

            const [a, b] =
                this.connections[i];


            const line =
                this.lines[i];


            const position =
                line.geometry
                    .attributes
                    .position;


            position.setXYZ(
                0,
                this.joints[a].x,
                this.joints[a].y,
                this.joints[a].z
            );


            position.setXYZ(
                1,
                this.joints[b].x,
                this.joints[b].y,
                this.joints[b].z
            );


            position.needsUpdate =
                true;

        }


        // ======================================================
        // PROVIDE DATA TO GESTURECONTROLS
        // ======================================================
        //
        // GestureControls emits this through:
        //
        //     landmarks: hand.mesh.smoothedPositions
        //
        // main.js then sends these positions into the GLB
        // retargeter.
        // ======================================================

        this.smoothedPositions =
            this.joints;

    }


    // ==========================================================
    // VISIBILITY
    // ==========================================================

    setVisible(
        visible
    ) {

        this.visible =
            visible;


        for (
            const joint
            of this.jointMeshes
        ) {

            joint.visible =
                visible;

        }


        for (
            const line
            of this.lines
        ) {

            line.visible =
                visible;

        }

    }


    // ==========================================================
    // ACTIVE
    // ==========================================================

    setActive(
        active
    ) {

        this.active =
            active;


        const material =
            active
                ? this.activeMaterial
                : this.jointMaterial;


        for (
            const joint
            of this.jointMeshes
        ) {

            joint.material =
                material;

        }

    }


    // ==========================================================
    // DISPOSE
    // ==========================================================

    dispose() {

        // ------------------------------------------------------
        // JOINTS
        // ------------------------------------------------------

        for (
            const joint
            of this.jointMeshes
        ) {

            this.scene.remove(
                joint
            );

        }


        // ------------------------------------------------------
        // LINES
        // ------------------------------------------------------

        for (
            const line
            of this.lines
        ) {

            this.scene.remove(
                line
            );

            line.geometry.dispose();

        }


        // ------------------------------------------------------
        // MATERIALS
        // ------------------------------------------------------

        this.jointGeometry.dispose();

        this.jointMaterial.dispose();

        this.activeMaterial.dispose();

        this.lineMaterial.dispose();

    }

}


// ============================================================
// DEFAULT EXPORT
// ============================================================
//
// Your actual GestureControls.js uses:
//
//     import HandMesh from "./HandMesh.js";
//
// Therefore this MUST be a default export.
// ============================================================

export default HandMesh;
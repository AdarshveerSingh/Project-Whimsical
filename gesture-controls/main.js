import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";
import { GestureControls } from "./GestureControls.js";


// ============================================================
// SCENE
// ============================================================

const scene = new THREE.Scene();


// ============================================================
// CAMERA
// ============================================================

const camera = new THREE.OrthographicCamera(
    -window.innerWidth / 2,
    window.innerWidth / 2,
    window.innerHeight / 2,
    -window.innerHeight / 2,
    0.1,
    2000
);

camera.position.set(0, 0, 500);
camera.lookAt(0, 0, 0);


// ============================================================
// RENDERER
// ============================================================

const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true
});

renderer.setSize(
    window.innerWidth,
    window.innerHeight
);

renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, 2)
);

renderer.outputColorSpace =
    THREE.SRGBColorSpace;

renderer.toneMapping =
    THREE.ACESFilmicToneMapping;

renderer.toneMappingExposure = 1;

renderer.shadowMap.enabled = true;

renderer.setClearColor(
    0x000000,
    0
);

renderer.domElement.style.position = "fixed";
renderer.domElement.style.left = "0";
renderer.domElement.style.top = "0";
renderer.domElement.style.width = "100%";
renderer.domElement.style.height = "100%";
renderer.domElement.style.zIndex = "1";
renderer.domElement.style.pointerEvents = "none";

document.body.appendChild(
    renderer.domElement
);


// ============================================================
// WEBCAM
// ============================================================

const video = document.createElement("video");

video.autoplay = true;
video.playsInline = true;
video.muted = true;

video.style.position = "fixed";
video.style.left = "0";
video.style.top = "0";

video.style.width = "100%";
video.style.height = "100%";

video.style.objectFit = "cover";

video.style.transform =
    "scaleX(-1)";

video.style.zIndex = "0";
video.style.opacity = "1";
video.style.pointerEvents = "none";

document.body.appendChild(video);


// ============================================================
// LIGHTING
// ============================================================

const ambientLight =
    new THREE.AmbientLight(
        0xffffff,
        2
    );

scene.add(
    ambientLight
);


const directionalLight =
    new THREE.DirectionalLight(
        0xffffff,
        3
    );

directionalLight.position.set(
    200,
    300,
    500
);

directionalLight.castShadow = true;

directionalLight.shadow.mapSize.width =
    2048;

directionalLight.shadow.mapSize.height =
    2048;

scene.add(
    directionalLight
);


// ============================================================
// TEST CUBE
// ============================================================

const cubeGeometry =
    new THREE.BoxGeometry(
        100,
        100,
        100
    );

const cubeMaterial =
    new THREE.MeshStandardMaterial({
        color: 0x44aaff
    });

const cube =
    new THREE.Mesh(
        cubeGeometry,
        cubeMaterial
    );

cube.position.set(
    0,
    0,
    0
);

cube.castShadow = true;
cube.receiveShadow = true;

scene.add(cube);


// ============================================================
// GLB GROUP
// ============================================================

const glbGroup =
    new THREE.Group();

scene.add(
    glbGroup
);

glbGroup.position.set(
    0,
    0,
    0
);


// ============================================================
// INITIAL GLB ORIENTATION
// ============================================================

// glbGroup.rotation.set(
//     0,
//     Math.PI,
//     0
// );


// ============================================================
// MODEL GROUP
// ============================================================

const modelGroup =
    new THREE.Group();

glbGroup.add(
    modelGroup
);

modelGroup.position.set(
    0,
    0,
    0
);

modelGroup.rotation.set(
    0,
    0,
    0
);

modelGroup.scale.setScalar(
    1
);


// ============================================================
// SKELETON HELPER
// ============================================================

let skeletonHelper = null;


// ============================================================
// MODEL REFERENCES
// ============================================================

let model = null;
let skinnedMesh = null;
let handRetargeter = null;


// ============================================================
// MEDIAPIPE LANDMARK NAMES
// ============================================================

const landmarkNames = {

    0: "wrist",

    1: "thumb_cmc",
    2: "thumb_mcp",
    3: "thumb_ip",
    4: "thumb_tip",

    5: "index_mcp",
    6: "index_pip",
    7: "index_dip",
    8: "index_tip",

    9: "middle_mcp",
    10: "middle_pip",
    11: "middle_dip",
    12: "middle_tip",

    13: "ring_mcp",
    14: "ring_pip",
    15: "ring_dip",
    16: "ring_tip",

    17: "pinky_mcp",
    18: "pinky_pip",
    19: "pinky_dip",
    20: "pinky_tip"
};


// ============================================================
// GLB → MEDIAPIPE MAPPING
// ============================================================
//
// IMPORTANT:
//
// J_Left_Hand is now the WRIST/ROOT for retargeting.
//
// J_Left is treated as structural and is NOT moved
// to MediaPipe landmark 0.
//
// ============================================================

const boneLandmarkMap = {

    // Structural forearm/root bone
    J_Left:
        null,

    // THIS IS NOW THE WRIST
    J_Left_Hand:
        0,


    // THUMB

    J_Left_HandThumb1:
        1,

    J_Left_HandThumb2:
        2,

    J_Left_HandThumb3:
        3,

    J_Left_HandThumb4:
        4,


    // INDEX

    J_Left_HandIndex1:
        5,

    J_Left_HandIndex2:
        6,

    J_Left_HandIndex3:
        7,

    J_Left_HandIndex4:
        8,


    // MIDDLE

    J_Left_HandMiddle1:
        9,

    J_Left_HandMiddle2:
        10,

    J_Left_HandMiddle3:
        11,

    J_Left_HandMiddle4:
        12,


    // RING

    J_Left_HandRing1:
        13,

    J_Left_HandRing2:
        14,

    J_Left_HandRing3:
        15,

    J_Left_HandRing4:
        16,


    // PINKY

    J_Left_HandPinky1:
        17,

    J_Left_HandPinky2:
        18,

    J_Left_HandPinky3:
        19,

    J_Left_HandPinky4:
        20
};


// ============================================================
// PRINT MAPPING
// ============================================================

function printBoneMapping(
    skeleton
) {

    console.log(
        "============================================"
    );

    console.log(
        "GLB → MEDIAPIPE BONE MAPPING"
    );

    console.log(
        "============================================"
    );

    for (
        const bone of skeleton.bones
    ) {

        const landmarkIndex =
            boneLandmarkMap[
                bone.name
            ];

        if (
            landmarkIndex === null ||
            landmarkIndex === undefined
        ) {

            console.log(
                `${bone.name} → structural bone`
            );

        } else {

            console.log(
                `${bone.name} → MP ${landmarkIndex} (${landmarkNames[landmarkIndex]})`
            );
        }
    }

    console.log(
        "============================================"
    );
}


// ============================================================
// HAND RETARGETER
// ============================================================

class HandRetargeter {

    constructor(
        skinnedMesh,
        model,
        glbGroup
    ) {

        this.skinnedMesh =
            skinnedMesh;

        this.model =
            model;

        this.glbGroup =
            glbGroup;

        this.skeleton =
            skinnedMesh.skeleton;


        // ----------------------------------------------------
        // TEMPORARY VECTORS
        // ----------------------------------------------------

        this.tmpRootPosition =
            new THREE.Vector3();

        this.tmpTargetPosition =
            new THREE.Vector3();

        this.tmpDelta =
            new THREE.Vector3();

        this.tmpTargetDir =
            new THREE.Vector3();


        // ----------------------------------------------------
        // TEMPORARY QUATERNIONS
        // ----------------------------------------------------

        this.tmpDeltaQuat =
            new THREE.Quaternion();

        this.tmpDesiredWorldQuat =
            new THREE.Quaternion();

        this.tmpParentWorldQuat =
            new THREE.Quaternion();

        this.tmpParentInverseQuat =
            new THREE.Quaternion();

        this.tmpLocalQuat =
            new THREE.Quaternion();


        // ----------------------------------------------------
        // BONES
        // ----------------------------------------------------

        this.wristBone =
            this._findExactBone(
                "J_Left_Hand"
            );

        this.handBone =
            this._findExactBone(
                "J_Left_Hand"
            );


        console.log(
            "[HandRetargeter] Wrist bone:",
            this.wristBone?.name ??
            "not found"
        );


        console.log(
            "[HandRetargeter] J_Left:",
            this._findExactBone(
                "J_Left"
            )?.name ??
            "not found"
        );


        // ----------------------------------------------------
        // FINGER CHAINS
        // ----------------------------------------------------

        this.fingerChains = [

            [
                "Thumb",
                [1, 2, 3, 4]
            ],

            [
                "Index",
                [5, 6, 7, 8]
            ],

            [
                "Middle",
                [9, 10, 11, 12]
            ],

            [
                "Ring",
                [13, 14, 15, 16]
            ],

            [
                "Pinky",
                [17, 18, 19, 20]
            ]
        ];


        // ----------------------------------------------------
        // REST POSE
        // ----------------------------------------------------

        this.restPose =
            new Map();


        this.glbGroup
            .updateMatrixWorld(true);

        this.model
            .updateMatrixWorld(true);


        this.prepareRestPose();


        console.log(
            "[HandRetargeter] J_Left_Hand is now the wrist anchor."
        );
    }


    // ========================================================
    // FIND EXACT BONE
    // ========================================================

    _findExactBone(
        name
    ) {

        return this.skeleton.bones.find(
            bone =>
                bone.name === name
        ) ?? null;
    }


    // ========================================================
    // PREPARE REST POSE
    // ========================================================

    prepareRestPose() {

        for (
            const [finger, mp]
            of this.fingerChains
        ) {

            // Bone 4 is the fingertip.
            // Only bones 1, 2 and 3 have
            // another bone segment after them.

            for (
                let i = 0;
                i < 3;
                i++
            ) {

                const boneIndex =
                    i + 1;


                const boneName =
                    `J_Left_Hand${finger}${boneIndex}`;


                const nextBoneName =
                    `J_Left_Hand${finger}${boneIndex + 1}`;


                const bone =
                    this._findExactBone(
                        boneName
                    );


                const nextBone =
                    this._findExactBone(
                        nextBoneName
                    );


                if (
                    !bone ||
                    !nextBone
                ) {

                    continue;
                }


                const start =
                    new THREE.Vector3();

                const end =
                    new THREE.Vector3();


                bone.getWorldPosition(
                    start
                );

                nextBone.getWorldPosition(
                    end
                );


                const restDirection =
                    new THREE.Vector3()
                        .subVectors(
                            end,
                            start
                        )
                        .normalize();


                const restWorldQuaternion =
                    bone.getWorldQuaternion(
                        new THREE.Quaternion()
                    );


                this.restPose.set(
                    boneName,
                    {
                        restDirection,
                        restWorldQuaternion
                    }
                );
            }
        }


        console.log(
            "[HandRetargeter] Rest pose prepared."
        );
    }


    // ========================================================
    // UPDATE
    // ========================================================

    update(
        landmarks
    ) {

        if (
            !landmarks ||
            landmarks.length < 21
        ) {

            return;
        }


        // ----------------------------------------------------
        // J_LEFT_HAND IS THE WRIST
        // ----------------------------------------------------

        if (
            !this.wristBone
        ) {

            return;
        }


        const wrist =
            landmarks[0];


        if (!wrist) {

            return;
        }


        // ----------------------------------------------------
        // UPDATE WORLD MATRICES
        // ----------------------------------------------------

        this.glbGroup
            .updateMatrixWorld(true);

        this.model
            .updateMatrixWorld(true);


        // ====================================================
        // GET CURRENT J_LEFT_HAND POSITION
        // ====================================================

        this.wristBone
            .getWorldPosition(
                this.tmpRootPosition
            );


        // ====================================================
        // TARGET = MEDIAPIPE WRIST
        // ====================================================

        this.tmpTargetPosition
            .copy(wrist);


        // ====================================================
        // CALCULATE MOVEMENT
        // ====================================================

        this.tmpDelta
            .subVectors(
                this.tmpTargetPosition,
                this.tmpRootPosition
            );


        // ====================================================
        // MOVE ENTIRE GLB
        // ====================================================
        //
        // J_Left_Hand → MediaPipe landmark 0
        //
        // J_Left is NOT used here.
        //
        // ====================================================

        this.glbGroup.position.add(
            this.tmpDelta
        );


        this.glbGroup
            .updateMatrixWorld(true);


        // ====================================================
        // UPDATE FINGERS
        // ====================================================

        this.updateFinger(
            "Thumb",
            [1, 2, 3, 4],
            landmarks
        );


        this.updateFinger(
            "Index",
            [5, 6, 7, 8],
            landmarks
        );


        this.updateFinger(
            "Middle",
            [9, 10, 11, 12],
            landmarks
        );


        this.updateFinger(
            "Ring",
            [13, 14, 15, 16],
            landmarks
        );


        this.updateFinger(
            "Pinky",
            [17, 18, 19, 20],
            landmarks
        );
    }


    // ========================================================
    // UPDATE ONE FINGER
    // ========================================================

    updateFinger(
        finger,
        mp,
        landmarks
    ) {

        for (
            let i = 0;
            i < 3;
            i++
        ) {

            const boneIndex =
                i + 1;


            const boneName =
                `J_Left_Hand${finger}${boneIndex}`;


            const bone =
                this._findExactBone(
                    boneName
                );


            if (!bone) {
                continue;
            }


            const rest =
                this.restPose.get(
                    boneName
                );


            if (!rest) {
                continue;
            }


            // ------------------------------------------------
            // MEDIAPIPE SEGMENT
            // ------------------------------------------------

            const start =
                landmarks[mp[i]];

            const end =
                landmarks[mp[i + 1]];


            if (
                !start ||
                !end
            ) {

                continue;
            }


            // ------------------------------------------------
            // TARGET DIRECTION
            // ------------------------------------------------

            this.tmpTargetDir
                .set(
                    end.x - start.x,
                    end.y - start.y,
                    end.z - start.z
                )
                .normalize();


            // ------------------------------------------------
            // REST → TARGET ROTATION
            // ------------------------------------------------

            this.tmpDeltaQuat
                .setFromUnitVectors(
                    rest.restDirection,
                    this.tmpTargetDir
                );


            // ------------------------------------------------
            // DESIRED WORLD ROTATION
            // ------------------------------------------------

            this.tmpDesiredWorldQuat
                .copy(
                    this.tmpDeltaQuat
                )
                .multiply(
                    rest.restWorldQuaternion
                );


            // ------------------------------------------------
            // WORLD → LOCAL
            // ------------------------------------------------

            if (
                bone.parent
            ) {

                bone.parent.getWorldQuaternion(
                    this.tmpParentWorldQuat
                );


                this.tmpParentInverseQuat
                    .copy(
                        this.tmpParentWorldQuat
                    )
                    .invert();


                this.tmpLocalQuat
                    .copy(
                        this.tmpParentInverseQuat
                    )
                    .multiply(
                        this.tmpDesiredWorldQuat
                    );


                // ------------------------------------------------
                // SMOOTH ROTATION
                // ------------------------------------------------

                bone.quaternion.slerp(
                    this.tmpLocalQuat,
                    0.35
                );
            }
        }
    }
}


// ============================================================
// LOAD HANDS2.GLB
// ============================================================

const loader =
    new GLTFLoader();


loader.load(

    "./hands2.glb",

    gltf => {

        model =
            gltf.scene;


        console.log(
            "GLB loaded"
        );


        // ----------------------------------------------------
        // ADD MODEL
        // ----------------------------------------------------

        modelGroup.add(
            model
        );


        // ----------------------------------------------------
        // FIND SKINNED MESH
        // ----------------------------------------------------

        model.traverse(
            object => {

                if (
                    object.isSkinnedMesh
                ) {

                    skinnedMesh =
                        object;


                    object.castShadow =
                        true;

                    object.receiveShadow =
                        true;
                }
            }
        );


        if (
            !skinnedMesh
        ) {

            console.error(
                "No SkinnedMesh found in GLB."
            );

            return;
        }


        // ----------------------------------------------------
        // SKELETON
        // ----------------------------------------------------

        const skeleton =
            skinnedMesh.skeleton;


        console.log(
            "Skeleton bones:",
            skeleton.bones.map(
                bone =>
                    bone.name
            )
        );


        // ----------------------------------------------------
        // PRINT MAPPING
        // ----------------------------------------------------

        printBoneMapping(
            skeleton
        );


        // ----------------------------------------------------
        // SKELETON HELPER
        // ----------------------------------------------------

        skeletonHelper =
            new THREE.SkeletonHelper(
                model
            );


        skeletonHelper.renderOrder =
            1000;


        skeletonHelper.material.depthTest =
            false;

        skeletonHelper.material.depthWrite =
            false;


        scene.add(
            skeletonHelper
        );


        // ----------------------------------------------------
        // MODEL SIZE
        // ----------------------------------------------------

        const box =
            new THREE.Box3()
                .setFromObject(
                    model
                );


        const size =
            new THREE.Vector3();


        box.getSize(
            size
        );


        const maxDimension =
            Math.max(
                size.x,
                size.y,
                size.z
            );


        // IMPORTANT:
        // Preferred model size = 180
        //
        const targetSize =
            180;


        if (
            maxDimension > 0
        ) {

            const scale =
                targetSize /
                maxDimension;


            model.scale.setScalar(
                scale
            );
        }


        // ----------------------------------------------------
        // UPDATE MATRICES
        // ----------------------------------------------------

        model.updateMatrixWorld(
            true
        );

        modelGroup.updateMatrixWorld(
            true
        );

        glbGroup.updateMatrixWorld(
            true
        );


        // ----------------------------------------------------
        // RETARGETER
        // ----------------------------------------------------

        handRetargeter =
            new HandRetargeter(
                skinnedMesh,
                model,
                glbGroup
            );


        console.log(
            "Hand retargeter ready."
        );

        console.log(
            "J_Left_Hand → MediaPipe wrist (0)"
        );
    },


    undefined,


    error => {

        console.error(
            "Failed to load hands2.glb:",
            error
        );
    }
);


// ============================================================
// GESTURE CONTROLS
// ============================================================

const gestureControls =
    new GestureControls(
        scene,
        {

            camera,

            renderDiv:
                document.body,

            videoElement:
                video,

            maxHands:
                2,

            smoothing:
                0.42,

            inferenceFPS:
                30,

            worldWidth:
                window.innerWidth,

            worldHeight:
                window.innerHeight,

            debug:
                true
        }
    );


// ============================================================
// INITIALIZE GESTURES
// ============================================================

async function initializeGestures() {

    try {

        await gestureControls.init();

        console.log(
            "GestureControls initialized."
        );

    } catch (error) {

        console.error(
            "GestureControls initialization failed:",
            error
        );
    }
}


initializeGestures();


// ============================================================
// MEDIAPIPE → GLB
// ============================================================
//
// MediaPipe
//     ↓
// HandMesh
//     ↓
// smoothedPositions
//     ↓
// Left hand
//     ↓
// HandRetargeter
//
// J_Left_Hand is the wrist anchor.
//
// ============================================================

function updateHandRetargeting() {

    if (
        !handRetargeter
    ) {

        return;
    }


    const leftHand =
        gestureControls
            .hands
            ?.get("Left");


    if (!leftHand) {

        return;
    }


    const positions =
        leftHand
            .mesh
            ?.smoothedPositions;


    if (
        !positions ||
        positions.length < 21
    ) {

        return;
    }


    handRetargeter.update(
        positions
    );
}


// ============================================================
// RESIZE
// ============================================================

window.addEventListener(
    "resize",
    () => {

        camera.left =
            -window.innerWidth / 2;

        camera.right =
            window.innerWidth / 2;

        camera.top =
            window.innerHeight / 2;

        camera.bottom =
            -window.innerHeight / 2;


        camera.updateProjectionMatrix();


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
    }
);


// ============================================================
// ANIMATION
// ============================================================

function animate(
    now
) {

    requestAnimationFrame(
        animate
    );


    // --------------------------------------------------------
    // TEST CUBE
    // --------------------------------------------------------

    cube.rotation.x +=
        0.005;

    cube.rotation.y +=
        0.008;


    // --------------------------------------------------------
    // MEDIAPIPE
    // --------------------------------------------------------

    gestureControls.update(
        now
    );


    // --------------------------------------------------------
    // MEDIAPIPE → GLB
    // --------------------------------------------------------

    updateHandRetargeting();


    // --------------------------------------------------------
    // MATRICES
    // --------------------------------------------------------

    glbGroup
        .updateMatrixWorld(true);


    if (
        skeletonHelper
    ) {

        skeletonHelper
            .updateMatrixWorld(true);
    }


    // --------------------------------------------------------
    // RENDER
    // --------------------------------------------------------

    renderer.render(
        scene,
        camera
    );
}


// ============================================================
// START
// ============================================================

animate();
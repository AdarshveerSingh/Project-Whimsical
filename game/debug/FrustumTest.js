
import * as THREE from "three";

export class FrustumTest {
    constructor({ renderer, scene, camera, player }) {
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
        this.player = player;
        this.enabled = false;

        this.viewWidth = 360;
        this.viewHeight = 240;
        this.padding = 12;

        this.debugCamera = new THREE.OrthographicCamera(
            -100, 100, 100, -100, 0.1, 2000
        );

        this.debugCamera.layers.enable(1);

        // Display the gameplay camera's viewing volume.
        // Temporary visualization only — does not affect gameplay culling.
this.frustumCamera = camera.clone();
this.frustumCamera.far = 250;
this.frustumCamera.updateProjectionMatrix();

this.cameraHelper = new THREE.CameraHelper(this.frustumCamera);
        this.cameraHelper.layers.set(1);

        // Keep the helper visible even when terrain is in front of it.
        this.cameraHelper.traverse((object) => {
            if (object.material) {
                const materials = Array.isArray(object.material)
                    ? object.material
                    : [object.material];

                for (const material of materials) {
                    material.depthTest = false;
                    material.transparent = true;
                    material.opacity = 0.95;
                }
            }
        });

        this.scene.add(this.cameraHelper);

        this._onResize = () => this.resize();
        this.resize();

        window.addEventListener("resize", this._onResize);
    }

    resize() {
    const halfHeight = 300;
    const aspect = this.viewWidth / this.viewHeight;

    this.debugCamera.left = -halfHeight * aspect;
    this.debugCamera.right = halfHeight * aspect;
    this.debugCamera.top = halfHeight;
    this.debugCamera.bottom = -halfHeight;

    this.debugCamera.updateProjectionMatrix();
}

    toggle() {
        this.enabled = !this.enabled;
        this.cameraHelper.visible = this.enabled;

        console.log(
            `Frustum visualization: ${this.enabled ? "ON" : "OFF"}`
        );
    }

    update() {
        if (!this.enabled) return;

        const position = this.player.getPosition();
        if (!position) return;

        // Follow the player from above.
        this.debugCamera.position.set(
            position.x,
            position.y + 180,
            position.z
        );

        this.debugCamera.up.set(0, 0, -1);
        this.debugCamera.lookAt(
            position.x,
            position.y,
            position.z
        );

        this.debugCamera.updateMatrixWorld(true);
        this.frustumCamera.position.copy(this.camera.position);
this.frustumCamera.quaternion.copy(this.camera.quaternion);
this.frustumCamera.updateMatrixWorld(true);
        this.cameraHelper.update();
    }

render() {
    if (!this.enabled) return;

    const renderer = this.renderer;
    const canvas = renderer.domElement;

    const canvasWidth = canvas.clientWidth;
    const canvasHeight = canvas.clientHeight;

    const width = Math.min(this.viewWidth, canvasWidth);
    const height = Math.min(this.viewHeight, canvasHeight);
    const padding = this.padding;

    // Keep the debug viewport inside the actual canvas.
    const left = Math.max(0, canvasWidth - width - padding);
    const bottom = Math.max(0, padding);

    const oldViewport = renderer.getViewport(new THREE.Vector4());
    const oldScissor = renderer.getScissor(new THREE.Vector4());
    const oldScissorTest = renderer.getScissorTest();
    const oldAutoClear = renderer.autoClear;

    try {
        renderer.autoClear = false;

        renderer.setScissorTest(true);
        renderer.setViewport(left, bottom, width, height);
        renderer.setScissor(left, bottom, width, height);

        renderer.clearDepth();
        renderer.render(this.scene, this.debugCamera);
    } finally {
        renderer.setViewport(oldViewport);
        renderer.setScissor(oldScissor);
        renderer.setScissorTest(oldScissorTest);
        renderer.autoClear = oldAutoClear;
    }
}
    dispose() {
        window.removeEventListener("resize", this._onResize);

        this.scene.remove(this.cameraHelper);
        this.cameraHelper.dispose();

        this.enabled = false;
    }
}

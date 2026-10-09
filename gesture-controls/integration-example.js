/*
 * Add this beside your existing Game class.
 *
 * Your current game already creates:
 *   this.scene
 *   this.camera
 *   this.renderDiv
 *   this.videoElement
 *
 * It also already runs its own animation loop.
 *
 * 1) Import:
 *
 *   import { GestureControls } from "./gesture-controls/index.js";
 *
 * 2) After your existing _setupThree() / _setupHandTracking() setup,
 *    create the gesture controller:
 */

import { GestureControls } from "./index.js";

export async function setupGestureControls(game) {
    game.gestureControls = new GestureControls({
        scene: game.scene,
        camera: game.camera,
        renderDiv: game.renderDiv,
        videoElement: game.videoElement,
        maxHands: 2,
        smoothing: 0.42,
        inferenceFPS: 30,
        debug: true
    });

    // This fires only when a snap is detected.
    game.gestureControls.on("snap", ({ hand }) => {
        console.log(`SNAP detected: ${hand}`);
    });

    // Optional: future gesture/game systems can subscribe here.
    game.gestureControls.on("hands", ({ count }) => {
        // console.log("Hands:", count);
    });

    await game.gestureControls.init();
    await game.gestureControls.start();
}

/*
 * Then, inside your game's existing _animate():
 *
 *   if (this.gameState === "tracking") {
 *       this._updateHands();                 // existing system, if desired
 *       this.gestureControls?.update();      // new system
 *   }
 *
 * For this first prototype, you can also temporarily comment out
 * the old hand-line renderer if you don't want both systems visible.
 *
 * Important:
 * We pass your existing videoElement into GestureControls, so it does
 * NOT request a second webcam stream.
 */

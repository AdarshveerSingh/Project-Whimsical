# Gesture Controls — Phase 1

This folder is intentionally separate from the main game.

## What it does

- Tracks up to two hands with MediaPipe Hand Landmarker.
- Renders each detected hand as persistent Three.js geometry.
- Smooths landmark motion.
- Detects a custom snap motion using:
  - thumb tip = landmark 4
  - middle-finger tip = landmark 12
  - rapid contact → separation
- Spawns a shiny orb above whichever hand snapped.
- Emits `snap`, `hands`, and `orb` events for future game controls.

## Files

- `GestureControls.js` — MediaPipe + gesture state + events.
- `HandMesh.js` — reusable 3D hand renderer.
- `ShinyOrb.js` — shiny orb effect.
- `index.js` — exports the module.
- `integration-example.js` — how to connect it to the existing `Game`.

## Current project compatibility

Your existing game already uses:
- Three.js modules.
- `@mediapipe/tasks-vision@0.10.14`.
- a webcam `<video>`.
- an OrthographicCamera-like screen-space setup.

The module is designed around those assumptions.

## Snap tuning

The detector is intentionally configurable because a webcam cannot directly observe the physical sound of a finger snap.

Default values:

```js
game.gestureControls.setSnapConfig({
    contactDistance: 0.075,
    releaseDistance: 0.125,
    minimumReleaseSpeed: 0.32,
    cooldown: 420
});
```

If snaps trigger too easily:
- lower `contactDistance`
- raise `minimumReleaseSpeed`

If snaps are hard to trigger:
- raise `contactDistance`
- lower `minimumReleaseSpeed`

## Performance

Inference is throttled to 30 FPS by default while Three.js can still render at the normal display refresh rate. The hand mesh does not recreate all line geometries every frame.

This is important because MediaPipe inference is much more expensive than moving already-created Three.js meshes.

## Next phase

The landmark stream is already separated from gesture actions, so future controls can be layered on top:

- pinch → interact
- fist → grab
- palm → release
- point → aim
- two-hand distance → scale
- hand rotation → rotate

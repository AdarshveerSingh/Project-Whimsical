# Noise Map Playground

A standalone Three.js playground for developing the grayscale maps used by the stylized vegetation shaders in the main game.

## Included

- `index.html` — playground UI
- `src/main.js` — application + Three.js preview
- `src/noise.js` — deterministic Perlin, Simplex, Value and FBM generation
- `src/shader.js` — reusable object-map palette shader
- `src/style.css` — UI
- `assets/bushes.glb` — current five-bush GLB

## Run

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

Do not open `index.html` directly with `file://`; the browser blocks module/GLB requests in that mode.

## PNG reference

The playground has a PNG file picker. Load the exact `mapForTest.png` from the main project with **Load PNG**. The chosen PNG is kept in memory and is not modified.

## Why this is structured for future models

The map generator does not know anything about bushes. It produces a reusable grayscale `THREE.DataTexture`. The preview layer accepts any GLB and can use UV, object-local planar, or triplanar projection. A future model can therefore be dropped into the asset loader without changing the noise generator.

## Export

- `Export PNG` saves the current grayscale map.
- `Export Config` saves the current generator/projection/palette settings as JSON.
- `Import Config` restores those settings.

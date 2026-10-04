# Prop Placement / Exclusion Build

Replace the corresponding project files with these versions:

- `PropPlacementSystem.js` -> `world/PropPlacementSystem.js`
- `TreeSystem.js` -> `world/TreeSystem.js`
- `RockSystem.js` -> `world/RockSystem.js`
- `BushSystem.js` -> `world/BushSystem.js`
- `FlowerSystem.js` -> `world/FlowerSystem.js`
- `GrassSystem.js` -> `vegetation/GrassSystem.js`
- `GrassWorker.js` -> `vegetation/GrassWorker.js`
- `ChunkManager.js` -> `world/ChunkManager.js`
- `main.js` -> project `main.js`

The system keeps PropDistributionSystem and existing cluster logic intact. It adds a spatial-hash exclusion layer:

TREE -> ROCK -> BUSH -> GRASS / FLOWER

Rock-rock overlap remains allowed. Bushes have only a small same-type anti-pileup distance. Grass and flowers do not block each other.

The registry is world-coordinate based, so chunk boundaries do not create separate local exclusion spaces. When a higher-priority prop chunk loads/unloads, affected lower-priority chunks are rebuilt. Grass receives a compact exclusion grid and applies it in its worker.

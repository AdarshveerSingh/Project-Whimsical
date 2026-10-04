from pathlib import Path
import shutil

OUT=Path('/mnt/data/placement_build')

# ---------- Tree ----------
src=Path('/mnt/data/Pasted code (4)(7).js')
s=src.read_text()
s=s.replace('import PropDistributionSystem from "./PropDistributionSystem.js";\n', 'import PropDistributionSystem from "./PropDistributionSystem.js";\nimport PropPlacementSystem from "./PropPlacementSystem.js";\n')
s=s.replace('        modelPath = "./models/TreeMine.glb"\n    }) {', '        modelPath = "./models/TreeMine.glb",\n        placementSystem = null\n    }) {')
s=s.replace('        this.modelPath =\n            modelPath;\n', '        this.modelPath =\n            modelPath;\n\n        this.placementSystem =\n            placementSystem;\n',1)
# Model-ready bulk rebuild notification
needle='''                    for (\n                        const chunk\n                        of this.chunks.values()\n                    ) {\n\n                        this.buildChunk(\n                            chunk\n                        );\n\n                    }\n\n                }\n\n\n                console.log(\n                    `Tree model loaded:'''
repl='''                    for (\n                        const chunk\n                        of this.chunks.values()\n                    ) {\n\n                        this.buildChunk(\n                            chunk\n                        );\n\n                    }\n\n                    if (this.placementSystem) {\n                        this.placementSystem.notifyChanged("tree");\n                    }\n\n                }\n\n\n                console.log(\n                    `Tree model loaded:'''
assert needle in s
s=s.replace(needle,repl,1)
# register chunk notify
needle='''        if (\n            this.modelReady\n        ) {\n\n            this.buildChunk(\n                record\n            );\n\n        }\n\n    }\n\n\n    // ============================================================\n    // UNREGISTER'''
repl='''        if (\n            this.modelReady\n        ) {\n\n            this.buildChunk(\n                record\n            );\n\n            if (this.placementSystem) {\n                this.placementSystem.notifyChanged(\n                    "tree",\n                    record.x,\n                    record.z\n                );\n            }\n\n        }\n\n    }\n\n\n    // ============================================================\n    // UNREGISTER'''
assert needle in s
s=s.replace(needle,repl,1)
# begin placement at build start
needle='''        if (\n            !this.modelReady\n        ) {\n\n            return;\n\n        }\n\n\n        // ============================================================\n        // REMOVE PREVIOUS INSTANCES'''
repl='''        if (\n            !this.modelReady\n        ) {\n\n            return;\n\n        }\n\n\n        if (this.placementSystem) {\n            this.placementSystem.beginChunk(\n                "tree",\n                chunk.x,\n                chunk.z\n            );\n        }\n\n\n        // ============================================================\n        // REMOVE PREVIOUS INSTANCES'''
assert needle in s
s=s.replace(needle,repl,1)
# register tree immediately before positions.push
needle='''                positions.push({\n\n                    x:\n                        worldX,'''
repl='''                if (this.placementSystem) {\n\n                    const placementRadius =\n                        THREE.MathUtils.clamp(\n                            scale * 2.75,\n                            2.4,\n                            4.0\n                        );\n\n                    if (!this.placementSystem.canPlace(\n                        "tree",\n                        worldX,\n                        worldZ,\n                        placementRadius\n                    )) {\n                        continue;\n                    }\n\n                    this.placementSystem.register(\n                        "tree",\n                        worldX,\n                        worldZ,\n                        placementRadius,\n                        chunk.x,\n                        chunk.z\n                    );\n                }\n\n                positions.push({\n\n                    x:\n                        worldX,'''
assert needle in s
s=s.replace(needle,repl,1)
# unregister
needle='''        this.chunks.delete(\n            key\n        );\n\n    }\n\n\n    // ============================================================\n    // DISPOSE'''
repl='''        this.chunks.delete(\n            key\n        );\n\n        if (this.placementSystem) {\n            this.placementSystem.unregisterChunk(\n                "tree",\n                chunkX,\n                chunkZ\n            );\n\n            this.placementSystem.notifyChanged(\n                "tree",\n                chunkX,\n                chunkZ\n            );\n        }\n\n    }\n\n\n    // ============================================================\n    // DISPOSE'''
assert needle in s
s=s.replace(needle,repl,1)
(OUT/'TreeSystem.js').write_text(s)

# ---------- Rock ----------
src=Path('/mnt/data/Pasted code (3)(20261003-120925).js')
s=src.read_text()
s=s.replace('import PropDistributionSystem from "./PropDistributionSystem.js";\n', 'import PropDistributionSystem from "./PropDistributionSystem.js";\nimport PropPlacementSystem from "./PropPlacementSystem.js";\n')
s=s.replace('        modelPath =\n            "./models/rocks.glb"\n    }) {', '        modelPath =\n            "./models/rocks.glb",\n\n        placementSystem = null\n    }) {')
s=s.replace('        this.modelPath =\n            modelPath;\n', '        this.modelPath =\n            modelPath;\n\n        this.placementSystem =\n            placementSystem;\n',1)
# bulk model load notify
needle='''                    for (\n                        const chunk\n                        of this.chunks.values()\n                    ) {\n\n                        this.buildChunk(\n                            chunk\n                        );\n\n                    }\n\n                }\n\n\n                console.log(\n                    `Rock model loaded:'''
repl='''                    for (\n                        const chunk\n                        of this.chunks.values()\n                    ) {\n\n                        this.buildChunk(\n                            chunk\n                        );\n\n                    }\n\n                    if (this.placementSystem) {\n                        this.placementSystem.notifyChanged("rock");\n                    }\n\n                }\n\n\n                console.log(\n                    `Rock model loaded:'''
assert needle in s
s=s.replace(needle,repl,1)
# register notify
needle='''        if (\n            this.modelReady\n        ) {\n\n            this.buildChunk(\n                chunk\n            );\n\n        }\n\n    }\n\n\n    // ========================================================\n    // UNREGISTER'''
repl='''        if (\n            this.modelReady\n        ) {\n\n            this.buildChunk(\n                chunk\n            );\n\n            if (this.placementSystem) {\n                this.placementSystem.notifyChanged(\n                    "rock",\n                    chunk.x,\n                    chunk.z\n                );\n            }\n\n        }\n\n    }\n\n\n    // ========================================================\n    // UNREGISTER'''
assert needle in s
s=s.replace(needle,repl,1)
# begin build after model check
needle='''        if (\n            !this.modelReady\n        ) {\n\n            return;\n\n        }\n\n\n        // =================================================\n        // REMOVE OLD INSTANCES'''
repl='''        if (\n            !this.modelReady\n        ) {\n\n            return;\n\n        }\n\n\n        if (this.placementSystem) {\n            this.placementSystem.beginChunk(\n                "rock",\n                chunk.x,\n                chunk.z\n            );\n        }\n\n\n        // =================================================\n        // REMOVE OLD INSTANCES'''
assert needle in s
s=s.replace(needle,repl,1)
# placement check before placedPositions.push
needle='''                    placedPositions.push({\n\n                        x:\n                            rockX,\n\n                        z:\n                            rockZ\n\n                    });'''
repl='''                    if (this.placementSystem) {\n\n                        const placementRadius =\n                            1.5;\n\n                        if (!this.placementSystem.canPlace(\n                            "rock",\n                            chunk.worldX + rockX,\n                            chunk.worldZ + rockZ,\n                            placementRadius\n                        )) {\n                            continue;\n                        }\n\n                        this.placementSystem.register(\n                            "rock",\n                            chunk.worldX + rockX,\n                            chunk.worldZ + rockZ,\n                            placementRadius,\n                            chunk.x,\n                            chunk.z\n                        );\n                    }\n\n                    placedPositions.push({\n\n                        x:\n                            rockX,\n\n                        z:\n                            rockZ\n\n                    });'''
assert needle in s
s=s.replace(needle,repl,1)
# unregister add
needle='''        this.chunks.delete(\n            key\n        );\n\n    }\n\n\n    // =================================================\n    // DISPOSE'''
repl='''        this.chunks.delete(\n            key\n        );\n\n        if (this.placementSystem) {\n            this.placementSystem.unregisterChunk(\n                "rock",\n                chunkX,\n                chunkZ\n            );\n\n            this.placementSystem.notifyChanged(\n                "rock",\n                chunkX,\n                chunkZ\n            );\n        }\n\n    }\n\n\n    // =================================================\n    // DISPOSE'''
assert needle in s
s=s.replace(needle,repl,1)
(OUT/'RockSystem.js').write_text(s)

# ---------- Bush ----------
src=Path('/mnt/data/Pasted code(20261003-120914).js')
s=src.read_text()
s=s.replace('import PropDistributionSystem from "./PropDistributionSystem.js";\n', 'import PropDistributionSystem from "./PropDistributionSystem.js";\nimport PropPlacementSystem from "./PropPlacementSystem.js";\n')
s=s.replace('        modelPath = "./models/bushes.glb"\n    } = {}) {', '        modelPath = "./models/bushes.glb",\n        placementSystem = null\n    } = {}) {')
s=s.replace('        this.modelPath =\n            modelPath;\n', '        this.modelPath =\n            modelPath;\n\n        this.placementSystem =\n            placementSystem;\n',1)
# bulk load notify
needle='''                for (\n                    const chunk\n                    of this.chunks.values()\n                ) {\n\n                    this.buildChunk(\n                        chunk\n                    );\n\n                }\n\n            },\n\n            undefined,'''
repl='''                for (\n                    const chunk\n                    of this.chunks.values()\n                ) {\n\n                    this.buildChunk(\n                        chunk\n                    );\n\n                }\n\n                if (this.placementSystem) {\n                    this.placementSystem.notifyChanged("bush");\n                }\n\n            },\n\n            undefined,'''
assert needle in s
s=s.replace(needle,repl,1)
# register notify
needle='''        if (\n            this.modelReady\n        ) {\n\n            this.buildChunk(\n                record\n            );\n\n        }\n\n    }\n\n\n    // ==================================================\n    // BUILD CHUNK'''
repl='''        if (\n            this.modelReady\n        ) {\n\n            this.buildChunk(\n                record\n            );\n\n            if (this.placementSystem) {\n                this.placementSystem.notifyChanged(\n                    "bush",\n                    record.x,\n                    record.z\n                );\n            }\n\n        }\n\n    }\n\n\n    // ==================================================\n    // BUILD CHUNK'''
assert needle in s
s=s.replace(needle,repl,1)
# begin chunk
needle='''        if (\n            !this.modelReady\n        ) {\n\n            return;\n\n        }\n\n\n        // ==================================================\n        // REMOVE PREVIOUS INSTANCES'''
repl='''        if (\n            !this.modelReady\n        ) {\n\n            return;\n\n        }\n\n\n        if (this.placementSystem) {\n            this.placementSystem.beginChunk(\n                "bush",\n                chunk.x,\n                chunk.z\n            );\n        }\n\n\n        // ==================================================\n        // REMOVE PREVIOUS INSTANCES'''
assert needle in s
s=s.replace(needle,repl,1)
# check before terrain height
needle='''                    // ==================================================\n                    // TERRAIN HEIGHT\n                    // ==================================================\n\n                    const y ='''
repl='''                    // ==================================================\n                    // PROP PLACEMENT\n                    // ==================================================\n\n                    if (this.placementSystem) {\n\n                        const placementRadius =\n                            1.0;\n\n                        if (!this.placementSystem.canPlace(\n                            "bush",\n                            bushX,\n                            bushZ,\n                            placementRadius\n                        )) {\n                            continue;\n                        }\n                    }\n\n                    // ==================================================\n                    // TERRAIN HEIGHT\n                    // ==================================================\n\n                    const y ='''
assert needle in s
s=s.replace(needle,repl,1)
# register before positionsByVariation push
needle='''                    positionsByVariation\n                        .get(variation)\n                        .push({'''
repl='''                    if (this.placementSystem) {\n                        this.placementSystem.register(\n                            "bush",\n                            bushX,\n                            bushZ,\n                            1.0,\n                            chunk.x,\n                            chunk.z\n                        );\n                    }\n\n                    positionsByVariation\n                        .get(variation)\n                        .push({'''
assert needle in s
s=s.replace(needle,repl,1)
# unregister
needle='''        this.chunks.delete(\n            key\n        );\n\n    }\n\n\n    // ==================================================\n    // DISPOSE'''
repl='''        this.chunks.delete(\n            key\n        );\n\n        if (this.placementSystem) {\n            this.placementSystem.unregisterChunk(\n                "bush",\n                chunkX,\n                chunkZ\n            );\n\n            this.placementSystem.notifyChanged(\n                "bush",\n                chunkX,\n                chunkZ\n            );\n        }\n\n    }\n\n\n    // ==================================================\n    // DISPOSE'''
assert needle in s
s=s.replace(needle,repl,1)
(OUT/'BushSystem.js').write_text(s)

# ---------- Flower ----------
src=Path('/mnt/data/Pasted code (2)(20261003-120921).js')
s=src.read_text()
s=s.replace('import PropDistributionSystem from "./PropDistributionSystem.js";\n', 'import PropDistributionSystem from "./PropDistributionSystem.js";\nimport PropPlacementSystem from "./PropPlacementSystem.js";\n')
s=s.replace('        modelPath = "./models/flowers.glb"\n    } = {}) {', '        modelPath = "./models/flowers.glb",\n        placementSystem = null\n    } = {}) {')
s=s.replace('        this.modelPath =\n            modelPath;\n', '        this.modelPath =\n            modelPath;\n\n        this.placementSystem =\n            placementSystem;\n',1)
# bulk load notify
needle='''                for (\n                    const chunk\n                    of this.chunks.values()\n                ) {\n\n                    this.buildChunk(\n                        chunk\n                    );\n\n                }\n\n            },\n\n            undefined,'''
repl='''                for (\n                    const chunk\n                    of this.chunks.values()\n                ) {\n\n                    this.buildChunk(\n                        chunk\n                    );\n\n                }\n\n                if (this.placementSystem) {\n                    this.placementSystem.notifyChanged("flower");\n                }\n\n            },\n\n            undefined,'''
assert needle in s
s=s.replace(needle,repl,1)
# register no notify needed because flowers don't block anything, but build can use blockers
# begin build
needle='''        if (\n            !this.modelReady\n        ) {\n\n            return;\n\n        }\n\n\n        // Remove old instances.'''
repl='''        if (\n            !this.modelReady\n        ) {\n\n            return;\n\n        }\n\n\n        // Flower placement is blocked by tree/rock/bush, but\n        // flowers do not register footprints of their own.\n\n        // Remove old instances.'''
assert needle in s
s=s.replace(needle,repl,1)
# check before flower terrain height
needle='''    // --------------------------------------------------\n    // Terrain height\n    // --------------------------------------------------\n\n    const flowerY ='''
repl='''    // --------------------------------------------------\n    // Placement exclusion\n    // --------------------------------------------------\n\n    if (this.placementSystem) {\n\n        if (!this.placementSystem.canPlace(\n            "flower",\n            flowerX,\n            flowerZ,\n            0.15\n        )) {\n            continue;\n        }\n    }\n\n    // --------------------------------------------------\n    // Terrain height\n    // --------------------------------------------------\n\n    const flowerY ='''
assert needle in s
s=s.replace(needle,repl,1)
(OUT/'FlowerSystem.js').write_text(s)

# ---------- GrassSystem ----------
src=Path('/mnt/data/Pasted code (5)(2).js')
s=src.read_text()
s=s.replace('import {\n    applyGrassShader\n} from "./GrassShader.js";\n', 'import {\n    applyGrassShader\n} from "./GrassShader.js";\n\nimport PropPlacementSystem from "../world/PropPlacementSystem.js";\n')
s=s.replace('        lodFar = 100\n\n    } = {}) {', '        lodFar = 100,\n\n        placementSystem = null\n\n    } = {}) {')
s=s.replace('        this.seed =\n            seed;\n', '        this.seed =\n            seed;\n\n        this.placementSystem =\n            placementSystem;\n',1)
# Add callback after worker setup block: before constructor closing, locate worker.onerror end
needle='''            };\n    }\n\n\n    // ==================================================\n    // TERRAIN CHUNK REGISTRATION'''
repl='''            };\n\n        if (this.placementSystem) {\n            for (const type of ["tree", "rock", "bush"]) {\n                this.placementSystem.onChanged(\n                    type,\n                    (_changedType, chunkX, chunkZ) => {\n                        this.invalidateAffectedChunks(\n                            chunkX,\n                            chunkZ\n                        );\n                    }\n                );\n            }\n        }\n    }\n\n\n    // ==================================================\n    // TERRAIN CHUNK REGISTRATION'''
assert needle in s
s=s.replace(needle,repl,1)
# Insert exclusion grid before SEND TO WORKER
needle='''        // ==================================================\n        // SEND TO WORKER\n        // ==================================================\n\n        const jobId ='''
repl='''        // ==================================================\n        // PROP EXCLUSION GRID\n        // ==================================================\n\n        const exclusionResolution =\n            distributionResolution;\n\n        const exclusionSize =\n            exclusionResolution + 1;\n\n        const grassExclusionGrid =\n            new Float32Array(\n                exclusionSize *\n                exclusionSize\n            );\n\n        if (this.placementSystem) {\n\n            for (let z = 0; z < exclusionSize; z++) {\n                for (let x = 0; x < exclusionSize; x++) {\n\n                    const localX =\n                        (x / exclusionResolution) *\n                        chunkSize -\n                        halfChunk;\n\n                    const localZ =\n                        (z / exclusionResolution) *\n                        chunkSize -\n                        halfChunk;\n\n                    const worldX =\n                        terrain.worldX + localX;\n\n                    const worldZ =\n                        terrain.worldZ + localZ;\n\n                    grassExclusionGrid[\n                        z * exclusionSize + x\n                    ] =\n                        this.placementSystem.isBlocked(\n                            "grass",\n                            worldX,\n                            worldZ,\n                            0.15\n                        );\n                }\n            }\n        }\n\n\n        // ==================================================\n        // SEND TO WORKER\n        // ==================================================\n\n        const jobId ='''
assert needle in s
s=s.replace(needle,repl,1)
# add fields to postMessage
needle='''                grassDistribution,\n\n                distributionResolution\n\n            },\n\n            [\n\n                grassDistribution.buffer'''
repl='''                grassDistribution,\n\n                distributionResolution,\n\n                grassExclusionGrid,\n\n                exclusionResolution\n\n            },\n\n            [\n\n                grassDistribution.buffer,\n\n                grassExclusionGrid.buffer'''
assert needle in s
s=s.replace(needle,repl,1)
# Add invalidate method before unregisterTerrainChunk
needle='''    // ==================================================\n    // REMOVE TERRAIN CHUNK\n    // ==================================================\n\n    unregisterTerrainChunk('''
repl='''    // ==================================================\n    // INVALIDATE AFFECTED GRASS CHUNKS\n    // ==================================================\n\n    invalidateAffectedChunks(\n        chunkX,\n        chunkZ\n    ) {\n\n        const targets = [];\n\n        if (chunkX === null || chunkZ === null) {\n            for (const terrain of this.terrainChunks.values()) {\n                targets.push([terrain.x, terrain.z]);\n            }\n        }\n        else {\n            for (const terrain of this.terrainChunks.values()) {\n\n                if (\n                    Math.abs(terrain.x - chunkX) <= 1 &&\n                    Math.abs(terrain.z - chunkZ) <= 1\n                ) {\n                    targets.push([terrain.x, terrain.z]);\n                }\n            }\n        }\n\n        for (const [x, z] of targets) {\n\n            const key = `${x},${z}`;\n            const existing = this.chunks.get(key);\n\n            if (existing) {\n                this.removeGrassChunk(existing);\n            }\n\n            this.generationQueue =\n                this.generationQueue.filter(\n                    job => !(job.x === x && job.z === z)\n                );\n\n            if (\n                this.generatingChunk &&\n                this.generatingChunk.x === x &&\n                this.generatingChunk.z === z\n            ) {\n                // The worker job already in flight cannot be cancelled\n                // safely; the next generation will use the latest mask.\n                continue;\n            }\n\n            this.queueChunk(x, z);\n        }\n    }\n\n\n    // ==================================================\n    // REMOVE TERRAIN CHUNK\n    // ==================================================\n\n    unregisterTerrainChunk('''
assert needle in s
s=s.replace(needle,repl,1)
(OUT/'GrassSystem.js').write_text(s)

# ---------- Grass Worker ----------
src=Path('/mnt/data/GrassWorker_prop_distribution.js')
s=src.read_text()
# add sampler before message handler
marker='// ============================================================\n// WORKER MESSAGE HANDLER\n// ============================================================' 
sampler='''// ============================================================\n// PROP EXCLUSION SAMPLING\n// ============================================================\n\nfunction sampleExclusion(\n    localX,\n    localZ,\n    exclusionGrid,\n    resolution,\n    terrainSize\n) {\n\n    if (!exclusionGrid) {\n        return 0.0;\n    }\n\n    const halfSize =\n        terrainSize * 0.5;\n\n    const normalizedX =\n        Math.max(0, Math.min(1, (localX + halfSize) / terrainSize));\n\n    const normalizedZ =\n        Math.max(0, Math.min(1, (localZ + halfSize) / terrainSize));\n\n    const gridX =\n        normalizedX * (resolution - 1);\n\n    const gridZ =\n        normalizedZ * (resolution - 1);\n\n    const x0 = Math.floor(gridX);\n    const z0 = Math.floor(gridZ);\n    const x1 = Math.min(x0 + 1, resolution - 1);\n    const z1 = Math.min(z0 + 1, resolution - 1);\n\n    const tx = gridX - x0;\n    const tz = gridZ - z0;\n\n    const a = exclusionGrid[z0 * resolution + x0];\n    const b = exclusionGrid[z0 * resolution + x1];\n    const c = exclusionGrid[z1 * resolution + x0];\n    const d = exclusionGrid[z1 * resolution + x1];\n\n    const ab = a + (b - a) * tx;\n    const cd = c + (d - c) * tx;\n\n    return ab + (cd - ab) * tz;\n}\n\n\n'''
assert marker in s
s=s.replace(marker,sampler+marker,1)
# destructure
needle='''            grassDistribution,\n            distributionResolution\n        } = data;'''
repl='''            grassDistribution,\n            distributionResolution,\n            grassExclusionGrid,\n            exclusionResolution\n        } = data;'''
assert needle in s
s=s.replace(needle,repl,1)
# add sample after world position before prop distribution
needle='''            const worldZ =\n                chunkZ * chunkSize +\n                localZ;\n\n\n            // =================================================\n            // PROP DISTRIBUTION'''
repl='''            const worldZ =\n                chunkZ * chunkSize +\n                localZ;\n\n\n            // =================================================\n            // PROP EXCLUSION\n            // =================================================\n\n            const exclusion =\n                sampleExclusion(\n                    localX,\n                    localZ,\n                    grassExclusionGrid,\n                    exclusionResolution,\n                    chunkSize\n                );\n\n            if (exclusion >= 0.5) {\n                continue;\n            }\n\n\n            // =================================================\n            // PROP DISTRIBUTION'''
assert needle in s
s=s.replace(needle,repl,1)
(OUT/'GrassWorker.js').write_text(s)

print('built files')

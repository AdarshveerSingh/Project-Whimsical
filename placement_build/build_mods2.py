from pathlib import Path
import re
OUT=Path('/mnt/data/placement_build')

def ins_once(s, old, new, label):
    if old not in s:
        raise RuntimeError('missing '+label)
    return s.replace(old,new,1)

# TREE
s=Path('/mnt/data/Pasted code (4)(7).js').read_text()
s=ins_once(s,'import PropDistributionSystem from "./PropDistributionSystem.js";\n','import PropDistributionSystem from "./PropDistributionSystem.js";\nimport PropPlacementSystem from "./PropPlacementSystem.js";\n','tree import')
s=ins_once(s,'        modelPath = "./models/TreeMine.glb"\n    }) {','        modelPath = "./models/TreeMine.glb",\n        placementSystem = null\n    }) {','tree ctor')
s=ins_once(s,'        this.modelPath =\n            modelPath;\n','        this.modelPath =\n            modelPath;\n\n        this.placementSystem =\n            placementSystem;\n', 'tree prop')
s=ins_once(s,'                console.log(\n                    `Tree model loaded:', '                if (this.placementSystem) {\n                    this.placementSystem.notifyChanged("tree");\n                }\n\n                console.log(\n                    `Tree model loaded:', 'tree bulk notify')
# register chunk: target exact build call + closing, scoped by first occurrence after register via split
idx=s.index('    registerTerrainChunk('); tail=s[idx:]
target='''            this.buildChunk(\n                record\n            );\n\n        }\n\n    }'''
repl='''            this.buildChunk(\n                record\n            );\n\n            if (this.placementSystem) {\n                this.placementSystem.notifyChanged("tree", record.x, record.z);\n            }\n\n        }\n\n    }'''
if target not in tail: raise RuntimeError('tree register')
tail=tail.replace(target,repl,1); s=s[:idx]+tail
# build start
s=ins_once(s,'''        if (\n            !this.modelReady\n        ) {\n\n            return;\n\n        }\n\n\n        // ============================================================\n        // REMOVE PREVIOUS INSTANCES''','''        if (\n            !this.modelReady\n        ) {\n\n            return;\n\n        }\n\n\n        if (this.placementSystem) {\n            this.placementSystem.beginChunk("tree", chunk.x, chunk.z);\n        }\n\n\n        // ============================================================\n        // REMOVE PREVIOUS INSTANCES''','tree build begin')
s=ins_once(s,'''                positions.push({\n\n                    x:\n                        worldX,''','''                if (this.placementSystem) {\n                    const placementRadius = THREE.MathUtils.clamp(scale * 2.75, 2.4, 4.0);\n                    if (!this.placementSystem.canPlace("tree", worldX, worldZ, placementRadius)) {\n                        continue;\n                    }\n                    this.placementSystem.register("tree", worldX, worldZ, placementRadius, chunk.x, chunk.z);\n                }\n\n                positions.push({\n\n                    x:\n                        worldX,''','tree register')
idx=s.index('    unregisterTerrainChunk('); tail=s[idx:]
target='''        this.chunks.delete(\n            key\n        );\n\n    }'''
repl='''        this.chunks.delete(\n            key\n        );\n\n        if (this.placementSystem) {\n            this.placementSystem.unregisterChunk("tree", chunkX, chunkZ);\n            this.placementSystem.notifyChanged("tree", chunkX, chunkZ);\n        }\n\n    }'''
if target not in tail: raise RuntimeError('tree unregister')
tail=tail.replace(target,repl,1); s=s[:idx]+tail
(OUT/'TreeSystem.js').write_text(s)

# ROCK
s=Path('/mnt/data/Pasted code (3)(20261003-120925).js').read_text()
s=ins_once(s,'import PropDistributionSystem from "./PropDistributionSystem.js";\n','import PropDistributionSystem from "./PropDistributionSystem.js";\nimport PropPlacementSystem from "./PropPlacementSystem.js";\n','rock import')
s=ins_once(s,'        modelPath =\n            "./models/rocks.glb"\n    }) {','        modelPath =\n            "./models/rocks.glb",\n\n        placementSystem = null\n    }) {','rock ctor')
s=ins_once(s,'        this.modelPath =\n            modelPath;\n','        this.modelPath =\n            modelPath;\n\n        this.placementSystem =\n            placementSystem;\n','rock prop')
s=ins_once(s,'                console.log(\n                    `Rock model loaded:', '                if (this.placementSystem) {\n                    this.placementSystem.notifyChanged("rock");\n                }\n\n                console.log(\n                    `Rock model loaded:', 'rock bulk notify')
idx=s.index('    registerTerrainChunk('); tail=s[idx:]
target='''            this.buildChunk(\n                chunk\n            );\n\n        }\n\n    }'''
repl='''            this.buildChunk(\n                chunk\n            );\n\n            if (this.placementSystem) {\n                this.placementSystem.notifyChanged("rock", chunk.x, chunk.z);\n            }\n\n        }\n\n    }'''
if target not in tail: raise RuntimeError('rock register')
tail=tail.replace(target,repl,1); s=s[:idx]+tail
# build begin (use actual comment)
needle='''        if (\n            !this.modelReady\n        ) {\n\n            return;\n\n        }\n\n\n        // =================================================\n        // REMOVE PREVIOUS INSTANCES'''
if needle not in s:
    needle='''        if (\n            !this.modelReady\n        ) {\n\n            return;\n\n        }\n\n\n        // =================================================\n        // REMOVE OLD INSTANCES'''
replacement='''        if (\n            !this.modelReady\n        ) {\n\n            return;\n\n        }\n\n\n        if (this.placementSystem) {\n            this.placementSystem.beginChunk("rock", chunk.x, chunk.z);\n        }\n\n\n        // =================================================\n        // REMOVE OLD INSTANCES'''
s=ins_once(s,needle,replacement,'rock build begin')
needle='''                    placedPositions.push({\n\n                        x:\n                            rockX,\n\n                        z:\n                            rockZ\n\n                    });'''
replacement='''                    if (this.placementSystem) {\n                        const placementRadius = 1.5;\n                        if (!this.placementSystem.canPlace(\n                            "rock",\n                            chunk.worldX + rockX,\n                            chunk.worldZ + rockZ,\n                            placementRadius\n                        )) {\n                            continue;\n                        }\n                        this.placementSystem.register(\n                            "rock",\n                            chunk.worldX + rockX,\n                            chunk.worldZ + rockZ,\n                            placementRadius,\n                            chunk.x,\n                            chunk.z\n                        );\n                    }\n\n                    placedPositions.push({\n\n                        x:\n                            rockX,\n\n                        z:\n                            rockZ\n\n                    });'''
s=ins_once(s,needle,replacement,'rock placement')
idx=s.index('    unregisterTerrainChunk('); tail=s[idx:]
target='''        this.chunks.delete(\n            key\n        );\n\n    }'''
repl='''        this.chunks.delete(\n            key\n        );\n\n        if (this.placementSystem) {\n            this.placementSystem.unregisterChunk("rock", chunkX, chunkZ);\n            this.placementSystem.notifyChanged("rock", chunkX, chunkZ);\n        }\n\n    }'''
if target not in tail: raise RuntimeError('rock unregister')
tail=tail.replace(target,repl,1); s=s[:idx]+tail
(OUT/'RockSystem.js').write_text(s)

# BUSH
s=Path('/mnt/data/Pasted code(20261003-120914).js').read_text()
s=ins_once(s,'import PropDistributionSystem from "./PropDistributionSystem.js";\n','import PropDistributionSystem from "./PropDistributionSystem.js";\nimport PropPlacementSystem from "./PropPlacementSystem.js";\n','bush import')
s=ins_once(s,'        modelPath = "./models/bushes.glb"\n    } = {}) {','        modelPath = "./models/bushes.glb",\n        placementSystem = null\n    } = {}) {','bush ctor')
s=ins_once(s,'        this.modelPath =\n            modelPath;\n','        this.modelPath =\n            modelPath;\n\n        this.placementSystem =\n            placementSystem;\n','bush prop')
# bulk notify: use first build-loop ending before callback undefined
needle='''                for (\n                    const chunk\n                    of this.chunks.values()\n                ) {\n\n                    this.buildChunk(\n                        chunk\n                    );\n\n                }\n\n            },\n\n            undefined,'''
replacement='''                for (\n                    const chunk\n                    of this.chunks.values()\n                ) {\n\n                    this.buildChunk(\n                        chunk\n                    );\n\n                }\n\n                if (this.placementSystem) {\n                    this.placementSystem.notifyChanged("bush");\n                }\n\n            },\n\n            undefined,'''
s=ins_once(s,needle,replacement,'bush bulk notify')
idx=s.index('    registerTerrainChunk('); tail=s[idx:]
target='''            this.buildChunk(\n                record\n            );\n\n        }\n\n    }'''
repl='''            this.buildChunk(\n                record\n            );\n\n            if (this.placementSystem) {\n                this.placementSystem.notifyChanged("bush", record.x, record.z);\n            }\n\n        }\n\n    }'''
if target not in tail: raise RuntimeError('bush register')
tail=tail.replace(target,repl,1); s=s[:idx]+tail
s=ins_once(s,'''        if (\n            !this.modelReady\n        ) {\n\n            return;\n\n        }\n\n\n        // ==================================================\n        // REMOVE PREVIOUS INSTANCES''','''        if (\n            !this.modelReady\n        ) {\n\n            return;\n\n        }\n\n\n        if (this.placementSystem) {\n            this.placementSystem.beginChunk("bush", chunk.x, chunk.z);\n        }\n\n\n        // ==================================================\n        // REMOVE PREVIOUS INSTANCES''','bush build begin')
needle='''                    // ==================================================\n                    // TERRAIN HEIGHT\n                    // ==================================================\n\n                    const y ='''
replacement='''                    // ==================================================\n                    // PROP PLACEMENT\n                    // ==================================================\n\n                    if (this.placementSystem) {\n                        if (!this.placementSystem.canPlace(\n                            "bush",\n                            bushX,\n                            bushZ,\n                            1.0\n                        )) {\n                            continue;\n                        }\n                    }\n\n                    // ==================================================\n                    // TERRAIN HEIGHT\n                    // ==================================================\n\n                    const y ='''
s=ins_once(s,needle,replacement,'bush placement check')
needle='''                    positionsByVariation\n                        .get(variation)\n                        .push({'''
replacement='''                    if (this.placementSystem) {\n                        this.placementSystem.register(\n                            "bush",\n                            bushX,\n                            bushZ,\n                            1.0,\n                            chunk.x,\n                            chunk.z\n                        );\n                    }\n\n                    positionsByVariation\n                        .get(variation)\n                        .push({'''
s=ins_once(s,needle,replacement,'bush register')
idx=s.index('    unregisterTerrainChunk('); tail=s[idx:]
target='''        this.chunks.delete(\n            key\n        );\n\n    }'''
repl='''        this.chunks.delete(\n            key\n        );\n\n        if (this.placementSystem) {\n            this.placementSystem.unregisterChunk("bush", chunkX, chunkZ);\n            this.placementSystem.notifyChanged("bush", chunkX, chunkZ);\n        }\n\n    }'''
if target not in tail: raise RuntimeError('bush unregister')
tail=tail.replace(target,repl,1); s=s[:idx]+tail
(OUT/'BushSystem.js').write_text(s)

# FLOWER
s=Path('/mnt/data/Pasted code (2)(20261003-120921).js').read_text()
s=ins_once(s,'import PropDistributionSystem from "./PropDistributionSystem.js";\n','import PropDistributionSystem from "./PropDistributionSystem.js";\nimport PropPlacementSystem from "./PropPlacementSystem.js";\n','flower import')
s=ins_once(s,'        modelPath = "./models/flowers.glb"\n    } = {}) {','        modelPath = "./models/flowers.glb",\n        placementSystem = null\n    } = {}) {','flower ctor')
s=ins_once(s,'        this.modelPath =\n            modelPath;\n','        this.modelPath =\n            modelPath;\n\n        this.placementSystem =\n            placementSystem;\n','flower prop')
# No flower notification needed; insert exclusion before terrain height
needle='''    // --------------------------------------------------\n    // Terrain height\n    // --------------------------------------------------\n\n    const flowerY ='''
replacement='''    // --------------------------------------------------\n    // Placement exclusion\n    // --------------------------------------------------\n\n    if (this.placementSystem) {\n        if (!this.placementSystem.canPlace(\n            "flower",\n            flowerX,\n            flowerZ,\n            0.15\n        )) {\n            continue;\n        }\n    }\n\n    // --------------------------------------------------\n    // Terrain height\n    // --------------------------------------------------\n\n    const flowerY ='''
s=ins_once(s,needle,replacement,'flower placement')
(OUT/'FlowerSystem.js').write_text(s)

# GRASS SYSTEM
s=Path('/mnt/data/Pasted code (5)(2).js').read_text()
s=ins_once(s,'import {\n    applyGrassShader\n} from "./GrassShader.js";\n','import {\n    applyGrassShader\n} from "./GrassShader.js";\n\nimport PropPlacementSystem from "../world/PropPlacementSystem.js";\n','grass import')
s=ins_once(s,'        lodFar = 100\n\n    } = {}) {','        lodFar = 100,\n\n        placementSystem = null\n\n    } = {}) {','grass ctor')
s=ins_once(s,'        this.seed =\n            seed;\n','        this.seed =\n            seed;\n\n        this.placementSystem =\n            placementSystem;\n','grass prop')
# callback before constructor close
needle='''            };\n    }\n\n\n    // ==================================================\n    // TERRAIN CHUNK REGISTRATION'''
replacement='''            };\n\n        if (this.placementSystem) {\n            for (const type of ["tree", "rock", "bush"]) {\n                this.placementSystem.onChanged(\n                    type,\n                    (_changedType, chunkX, chunkZ) => {\n                        this.invalidateAffectedChunks(chunkX, chunkZ);\n                    }\n                );\n            }\n        }\n    }\n\n\n    // ==================================================\n    // TERRAIN CHUNK REGISTRATION'''
s=ins_once(s,needle,replacement,'grass callback')
# exclusion grid before send
needle='''        // ==================================================\n        // SEND TO WORKER\n        // ==================================================\n\n        const jobId ='''
replacement='''        // ==================================================\n        // PROP EXCLUSION GRID\n        // ==================================================\n\n        const exclusionResolution = distributionResolution;\n        const exclusionSize = exclusionResolution + 1;\n        const grassExclusionGrid = new Float32Array(\n            exclusionSize * exclusionSize\n        );\n\n        if (this.placementSystem) {\n            for (let z = 0; z < exclusionSize; z++) {\n                for (let x = 0; x < exclusionSize; x++) {\n\n                    const localX =\n                        (x / exclusionResolution) * chunkSize - halfChunk;\n\n                    const localZ =\n                        (z / exclusionResolution) * chunkSize - halfChunk;\n\n                    const worldX = terrain.worldX + localX;\n                    const worldZ = terrain.worldZ + localZ;\n\n                    grassExclusionGrid[\n                        z * exclusionSize + x\n                    ] = this.placementSystem.isBlocked(\n                        "grass",\n                        worldX,\n                        worldZ,\n                        0.15\n                    );\n                }\n            }\n        }\n\n\n        // ==================================================\n        // SEND TO WORKER\n        // ==================================================\n\n        const jobId ='''
s=ins_once(s,needle,replacement,'grass exclusion')
needle='''                grassDistribution,\n\n                distributionResolution\n\n            },\n\n            [\n\n                grassDistribution.buffer'''
replacement='''                grassDistribution,\n\n                distributionResolution,\n\n                grassExclusionGrid,\n\n                exclusionResolution\n\n            },\n\n            [\n\n                grassDistribution.buffer,\n\n                grassExclusionGrid.buffer'''
s=ins_once(s,needle,replacement,'grass post')
# invalidate method
needle='''    // ==================================================\n    // REMOVE TERRAIN CHUNK\n    // ==================================================\n\n    unregisterTerrainChunk('''
replacement='''    // ==================================================\n    // INVALIDATE AFFECTED GRASS CHUNKS\n    // ==================================================\n\n    invalidateAffectedChunks(chunkX, chunkZ) {\n\n        const targets = [];\n\n        if (chunkX === null || chunkZ === null) {\n            for (const terrain of this.terrainChunks.values()) {\n                targets.push([terrain.x, terrain.z]);\n            }\n        }\n        else {\n            for (const terrain of this.terrainChunks.values()) {\n                if (\n                    Math.abs(terrain.x - chunkX) <= 1 &&\n                    Math.abs(terrain.z - chunkZ) <= 1\n                ) {\n                    targets.push([terrain.x, terrain.z]);\n                }\n            }\n        }\n\n        for (const [x, z] of targets) {\n\n            const key = `${x},${z}`;\n            const existing = this.chunks.get(key);\n\n            if (existing) {\n                this.removeGrassChunk(existing);\n            }\n\n            this.generationQueue = this.generationQueue.filter(\n                job => !(job.x === x && job.z === z)\n            );\n\n            if (\n                this.generatingChunk &&\n                this.generatingChunk.x === x &&\n                this.generatingChunk.z === z\n            ) {\n                continue;\n            }\n\n            this.queueChunk(x, z);\n        }\n    }\n\n\n    // ==================================================\n    // REMOVE TERRAIN CHUNK\n    // ==================================================\n\n    unregisterTerrainChunk('''
s=ins_once(s,needle,replacement,'grass invalidation')
(OUT/'GrassSystem.js').write_text(s)

# GRASS WORKER
s=Path('/mnt/data/GrassWorker_prop_distribution.js').read_text()
marker='// ============================================================\n// WORKER MESSAGE HANDLER\n// ============================================================'
sampler='''// ============================================================\n// PROP EXCLUSION SAMPLING\n// ============================================================\n\nfunction sampleExclusion(localX, localZ, grid, resolution, terrainSize) {\n\n    if (!grid) {\n        return 0.0;\n    }\n\n    const halfSize = terrainSize * 0.5;\n    const nx = Math.max(0, Math.min(1, (localX + halfSize) / terrainSize));\n    const nz = Math.max(0, Math.min(1, (localZ + halfSize) / terrainSize));\n\n    const gx = nx * (resolution - 1);\n    const gz = nz * (resolution - 1);\n\n    const x0 = Math.floor(gx);\n    const z0 = Math.floor(gz);\n    const x1 = Math.min(x0 + 1, resolution - 1);\n    const z1 = Math.min(z0 + 1, resolution - 1);\n\n    const tx = gx - x0;\n    const tz = gz - z0;\n\n    const a = grid[z0 * resolution + x0];\n    const b = grid[z0 * resolution + x1];\n    const c = grid[z1 * resolution + x0];\n    const d = grid[z1 * resolution + x1];\n\n    const ab = a + (b - a) * tx;\n    const cd = c + (d - c) * tx;\n\n    return ab + (cd - ab) * tz;\n}\n\n\n'''
s=ins_once(s,marker,sampler+marker,'worker sampler')
s=ins_once(s,'''            grassDistribution,\n            distributionResolution\n        } = data;''','''            grassDistribution,\n            distributionResolution,\n            grassExclusionGrid,\n            exclusionResolution\n        } = data;''','worker destructure')
needle='''            const worldZ =\n                chunkZ * chunkSize +\n                localZ;\n\n\n            // =================================================\n            // PROP DISTRIBUTION'''
replacement='''            const worldZ =\n                chunkZ * chunkSize +\n                localZ;\n\n\n            // =================================================\n            // PROP EXCLUSION\n            // =================================================\n\n            if (\n                sampleExclusion(\n                    localX,\n                    localZ,\n                    grassExclusionGrid,\n                    exclusionResolution,\n                    chunkSize\n                ) >= 0.5\n            ) {\n                continue;\n            }\n\n\n            // =================================================\n            // PROP DISTRIBUTION'''
s=ins_once(s,needle,replacement,'worker exclusion check')
(OUT/'GrassWorker.js').write_text(s)

print('done')

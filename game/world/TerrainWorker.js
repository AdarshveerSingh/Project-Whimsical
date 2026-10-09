console.log("TerrainWorker.js loaded");

self.onmessage = async (event) => {
    try {
        const {
            type,
            jobId,
            key,
            size,
            resolution,
            worldOffsetX,
            worldOffsetZ,
            seed,
            baseHeight,
            maxHeight,
            heightScale
        } = event.data;

        if (type !== "generate") {
            return;
        }
        let modulesPromise = null;
        const contexts = new Map();

        async function getContext(seed, baseHeight, maxHeight, heightScale) {

            modulesPromise ??= Promise.all([
                import("./WorldGenerator.js"),
                import("./SurfaceSystem.js")
            ]);

            const [{ WorldGenerator }, { SurfaceSystem }] = await modulesPromise;

            const key = `${seed}|${baseHeight}|${maxHeight}|${heightScale}`;

            let context = contexts.get(key);

            if (!context) {

                context = {
                    worldGenerator: new WorldGenerator({ seed, baseHeight, maxHeight, heightScale }),
                    surfaceSystem: new SurfaceSystem({ seed })
                };

                contexts.set(key, context);
            }

            return context;
        }
        const { worldGenerator, surfaceSystem } =
            await getContext(seed, baseHeight, maxHeight, heightScale);
        const gridResolution = resolution + 1;
        const total = gridResolution * gridResolution;

        const heightData = new Float32Array(total);

        const grassWeightData = new Float32Array(total);
        const dirtWeightData = new Float32Array(total);
        const gravelWeightData = new Float32Array(total);
        const rockWeightData = new Float32Array(total);

        const normalData = new Float32Array(total * 3);
        const colors = new Float32Array(total * 3);
        const surfaceWeights = new Float32Array(total * 4);

        for (let iz = 0; iz < gridResolution; iz++) {

            const localZ =
                (iz / resolution - 0.5) * size;

            for (let ix = 0; ix < gridResolution; ix++) {

                const i =
                    iz * gridResolution + ix;

                const localX =
                    (ix / resolution - 0.5) * size;

                const worldX =
                    worldOffsetX + localX;

                const worldZ =
                    worldOffsetZ + localZ;

                const terrainSample =
                    worldGenerator.getTerrainSample(
                        worldX,
                        worldZ
                    );

                const height =
                    terrainSample.height;

                heightData[i] = height;

                const normal =
                    terrainSample.normal;

                const normalIndex = i * 3;

                normalData[normalIndex] =
                    normal.x;

                normalData[normalIndex + 1] =
                    normal.y;

                normalData[normalIndex + 2] =
                    normal.z;

                const surfaceNoise =
                    surfaceSystem.getSurfaceNoise(
                        worldX,
                        worldZ
                    );

                const weights =
                    surfaceSystem.getSurfaceWeights(
                        worldX,
                        worldZ,
                        worldGenerator,
                        terrainSample,
                        surfaceNoise
                    );

                const surfaceColor =
                    surfaceSystem.getSurfaceColor(
                        worldX,
                        worldZ,
                        worldGenerator,
                        terrainSample,
                        weights,
                        surfaceNoise
                    );

                const colorIndex = i * 3;

                colors[colorIndex] =
                    surfaceColor.r;

                colors[colorIndex + 1] =
                    surfaceColor.g;

                colors[colorIndex + 2] =
                    surfaceColor.b;

                grassWeightData[i] =
                    weights.grass;

                dirtWeightData[i] =
                    weights.dirt;

                gravelWeightData[i] =
                    weights.gravel;

                rockWeightData[i] =
                    weights.rock;

                const surfaceIndex = i * 4;

                surfaceWeights[surfaceIndex] =
                    weights.grass;

                surfaceWeights[surfaceIndex + 1] =
                    weights.dirt;

                surfaceWeights[surfaceIndex + 2] =
                    weights.gravel;

                surfaceWeights[surfaceIndex + 3] =
                    weights.rock;
            }
        }

        // console.log(
        //     "Terrain worker generated:",
        //     total,
        //     "vertices"
        // );

        self.postMessage(
            {
                type: "complete",

                jobId,
                key,

                heightData,
                grassWeightData,
                dirtWeightData,
                gravelWeightData,
                rockWeightData,

                normalData,
                colors,
                surfaceWeights,

                resolution: gridResolution,
                size
            },
            [
                heightData.buffer,
                grassWeightData.buffer,
                dirtWeightData.buffer,
                gravelWeightData.buffer,
                rockWeightData.buffer,
                normalData.buffer,
                colors.buffer,
                surfaceWeights.buffer
            ]
        );

    } catch (error) {

        console.error(
            "Terrain worker generation failed:",
            error
        );

        self.postMessage({
            type: "error",
            jobId: event.data?.jobId ?? null,
            key: event.data?.key ?? null,
            message: error?.message ?? String(error),
            stack: error?.stack ?? null,
            name: error?.name ?? null
        });
    }
};
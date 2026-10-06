export class PerformanceDebug {

    constructor({ renderer, scene, player, chunkManager }) {

        this.renderer = renderer;
        this.scene = scene;
        this.player = player;
        this.chunkManager = chunkManager;

        // Debug is disabled until enable() is called.
        // The always-visible FPS Stats panel is handled separately by Main.js.
        this.enabled = false;

        this.performanceBox = null;
        this.performanceControls = null;
        this.vegetationControls = null;

        this.keyHandler = null;

        this.startRecordingButton = null;
        this.stopRecordingButton = null;

        this.elapsed = 0;
        this.recordingTime = 0;
        this.frameCount = 0;

        this.totalDrawCalls = 0;
        this.totalTriangles = 0;
        this.totalPoints = 0;
        this.totalLines = 0;

        this.lastRenderCalls = this.renderer.info.render.calls;
        this.lastRenderTriangles = this.renderer.info.render.triangles;
        this.lastRenderPoints = this.renderer.info.render.points;
        this.lastRenderLines = this.renderer.info.render.lines;

        this.recording = false;
        this.samples = [];

        // ---------------------------------------------------------
// CPU / GPU TIMING
// ---------------------------------------------------------

this.cpuFrameStart = 0;
this.cpuFrameMs = 0;
this.totalCpuMs = 0;

this.gpuFrameMs = null;

this.gpuQuery = null;
this.gpuQueryPending = false;
this.gpuTimer = null;
this.gpuQuerySupported = false;

this.initGPUTimer();
    }

initGPUTimer() {

    const gl = this.renderer.getContext();

    // WebGL 2
    if (gl instanceof WebGL2RenderingContext) {

        this.gpuTimer =
            gl.getExtension("EXT_disjoint_timer_query_webgl2");

        if (this.gpuTimer) {

            this.gpuQuerySupported = true;

        }

        return;
    }


    // WebGL 1 fallback
    this.gpuTimer =
        gl.getExtension("EXT_disjoint_timer_query");

    if (this.gpuTimer) {

        this.gpuQuerySupported = true;

    }

}
beginFrame() {

    if (!this.enabled) return;

    this.cpuFrameStart = performance.now();

    this.pollGPUQuery();

    this.beginGPUQuery();

}


beginGPUQuery() {

    if (
        !this.enabled ||
        !this.gpuQuerySupported ||
        this.gpuQueryPending
    ) {
        return;
    }

    const gl = this.renderer.getContext();

    // WebGL 2
    if (gl instanceof WebGL2RenderingContext) {

        this.gpuQuery = gl.createQuery();

        gl.beginQuery(
            this.gpuTimer.TIME_ELAPSED_EXT,
            this.gpuQuery
        );

        this.gpuQueryPending = true;

        return;
    }

    // WebGL 1
    this.gpuQuery =
        this.gpuTimer.createQueryEXT();

    this.gpuTimer.beginQueryEXT(
        this.gpuTimer.TIME_ELAPSED_EXT,
        this.gpuQuery
    );

    this.gpuQueryPending = true;

}


endGPUQuery() {

    if (
        !this.enabled ||
        !this.gpuQuerySupported ||
        !this.gpuQueryPending
    ) {
        return;
    }

    const gl = this.renderer.getContext();

    // WebGL 2
    if (gl instanceof WebGL2RenderingContext) {

        gl.endQuery(
            this.gpuTimer.TIME_ELAPSED_EXT
        );

        return;
    }

    // WebGL 1
    this.gpuTimer.endQueryEXT(
        this.gpuTimer.TIME_ELAPSED_EXT
    );

}


pollGPUQuery() {

    if (
        !this.gpuQuerySupported ||
        !this.gpuQueryPending ||
        !this.gpuQuery
    ) {
        return;
    }

    const gl = this.renderer.getContext();

    let available = false;
    let disjoint = false;
    let time = null;

    // WebGL 2
    if (gl instanceof WebGL2RenderingContext) {

        available =
            gl.getQueryParameter(
                this.gpuQuery,
                gl.QUERY_RESULT_AVAILABLE
            );

        disjoint =
            gl.getParameter(
                this.gpuTimer.GPU_DISJOINT_EXT
            );

        if (available && !disjoint) {

            time =
                gl.getQueryParameter(
                    this.gpuQuery,
                    gl.QUERY_RESULT
                );

        }

    }

    // WebGL 1
    else {

        available =
            this.gpuTimer.getQueryObjectEXT(
                this.gpuQuery,
                this.gpuTimer.QUERY_RESULT_AVAILABLE_EXT
            );

        disjoint =
            gl.getParameter(
                this.gpuTimer.GPU_DISJOINT_EXT
            );

        if (available && !disjoint) {

            time =
                this.gpuTimer.getQueryObjectEXT(
                    this.gpuQuery,
                    this.gpuTimer.QUERY_RESULT_EXT
                );

        }

    }

    if (!available) {

        return;

    }

    if (time !== null) {

        // GPU timer is in nanoseconds.
        this.gpuFrameMs = time / 1000000;

    }

    if (
        gl instanceof WebGL2RenderingContext
    ) {

        gl.deleteQuery(this.gpuQuery);

    }
    else {

        this.gpuTimer.deleteQueryEXT(
            this.gpuQuery
        );

    }

    this.gpuQuery = null;
    this.gpuQueryPending = false;

}
    enable() {

        if (this.enabled) return;

        this.enabled = true;

        // Keep renderer statistics accumulated while debugging.
        this.renderer.info.autoReset = false;


        // ---------------------------------------------------------
        // PERFORMANCE BOX
        // ---------------------------------------------------------

        this.performanceBox = document.createElement("div");

        Object.assign(this.performanceBox.style, {
            position: "fixed",
            top: "10px",
            right: "10px",
            padding: "10px 14px",
            background: "rgba(0, 0, 0, 0.75)",
            color: "#fff",
            fontFamily: "monospace",
            fontSize: "13px",
            lineHeight: "1.5",
            borderRadius: "6px",
            zIndex: "10000",
            minWidth: "220px",
            pointerEvents: "none"
        });

        document.body.appendChild(this.performanceBox);


        // ---------------------------------------------------------
        // DEBUG CONTROLS
        // ---------------------------------------------------------

        this.createRecordingControls();
        this.createVegetationControls();
        this.installMapDebug();


        // Render diagnostic
        window.runRenderDiagnostic =
            () => this.runRenderDiagnostic();


        // Reset renderer baselines when debug starts.
        this.lastRenderCalls =
            this.renderer.info.render.calls;

        this.lastRenderTriangles =
            this.renderer.info.render.triangles;

        this.lastRenderPoints =
            this.renderer.info.render.points;

        this.lastRenderLines =
            this.renderer.info.render.lines;
    }


    disable() {

        if (!this.enabled) return;

        this.cpuFrameMs =
    performance.now() - this.cpuFrameStart;

        this.enabled = false;

        this.recording = false;


        // Remove keyboard listener.
        if (this.keyHandler) {

            window.removeEventListener(
                "keydown",
                this.keyHandler
            );

            this.keyHandler = null;
        }


        // Remove debug UI.
        for (const element of [
            this.performanceBox,
            this.performanceControls,
            this.vegetationControls
        ]) {

            if (element?.parentNode) {
                element.parentNode.removeChild(element);
            }
        }


        // Remove global debug functions.
        delete window.openDisplacementMap;
        delete window.openSurfaceMap;
        delete window.openPropDistributionMap;
        delete window.runRenderDiagnostic;


        // Clear references.
        this.performanceBox = null;
        this.performanceControls = null;
        this.vegetationControls = null;

        this.startRecordingButton = null;
        this.stopRecordingButton = null;


        // Restore normal renderer behaviour.
        this.renderer.info.autoReset = true;
    }


    toggle() {

        if (this.enabled) {
            this.disable();
        } else {
            this.enable();
        }
    }


    // =============================================================
    // RECORDING CONTROLS
    // =============================================================

    createRecordingControls() {

        const controls = document.createElement("div");

        Object.assign(controls.style, {
            position: "fixed",
            top: "10px",
            right: "340px",
            zIndex: "10001",
            display: "flex",
            gap: "6px"
        });


        this.startRecordingButton =
            document.createElement("button");

        this.startRecordingButton.textContent =
            "Start Recording";


        this.stopRecordingButton =
            document.createElement("button");

        this.stopRecordingButton.textContent =
            "Stop & Download Log";

        this.stopRecordingButton.disabled = true;


        for (const button of [
            this.startRecordingButton,
            this.stopRecordingButton
        ]) {

            Object.assign(button.style, {
                padding: "7px 10px",
                border: "none",
                borderRadius: "5px",
                background: "#222",
                color: "#fff",
                fontFamily: "monospace",
                fontSize: "12px",
                cursor: "pointer"
            });
        }


        this.startRecordingButton.addEventListener(
            "click",
            () => this.startRecording()
        );


        this.stopRecordingButton.addEventListener(
            "click",
            () => this.stopRecording()
        );


        controls.append(
            this.startRecordingButton,
            this.stopRecordingButton
        );

        document.body.appendChild(controls);

        this.performanceControls = controls;
    }


    // =============================================================
    // VEGETATION CONTROLS
    // =============================================================

    createVegetationControls() {

        const controls = document.createElement("div");

        Object.assign(controls.style, {
            position: "fixed",
            top: "250px",
            right: "10px",
            zIndex: "10001",
            display: "flex",
            gap: "5px",
            flexWrap: "wrap",
            width: "230px"
        });


        for (const [label, type] of [
            ["Grass", "grass"],
            ["Trees", "trees"],
            ["Rocks", "rocks"],
            ["Flowers", "flowers"],
            ["Bushes", "bushes"]
        ]) {

            const button =
                document.createElement("button");

            button.textContent = label;


            Object.assign(button.style, {
                padding: "6px 8px",
                border: "none",
                borderRadius: "5px",
                background: "#222",
                color: "#fff",
                fontFamily: "monospace",
                fontSize: "11px",
                cursor: "pointer"
            });


            button.addEventListener(
                "click",
                () => {

                    const enabled =
                        this.chunkManager
                            .vegetationEnabled[type];


                    this.chunkManager.setVegetationEnabled(
                        type,
                        !enabled
                    );


                    button.style.opacity =
                        enabled ? "0.5" : "1";
                }
            );


            controls.appendChild(button);
        }


        // ---------------------------------------------------------
        // ALL OFF
        // ---------------------------------------------------------

        const allOff =
            document.createElement("button");

        allOff.textContent = "ALL OFF";


        Object.assign(allOff.style, {
            padding: "6px 8px",
            border: "none",
            borderRadius: "5px",
            background: "#722",
            color: "#fff",
            fontFamily: "monospace",
            fontSize: "11px",
            cursor: "pointer"
        });


        allOff.addEventListener(
            "click",
            () =>
                this.chunkManager
                    .setAllVegetationEnabled(false)
        );


        // ---------------------------------------------------------
        // ALL ON
        // ---------------------------------------------------------

        const allOn =
            document.createElement("button");

        allOn.textContent = "ALL ON";


        Object.assign(allOn.style, {
            padding: "6px 8px",
            border: "none",
            borderRadius: "5px",
            background: "#272",
            color: "#fff",
            fontFamily: "monospace",
            fontSize: "11px",
            cursor: "pointer"
        });


        allOn.addEventListener(
            "click",
            () =>
                this.chunkManager
                    .setAllVegetationEnabled(true)
        );


        controls.append(allOff, allOn);

        document.body.appendChild(controls);

        this.vegetationControls = controls;
    }


    // =============================================================
    // MAP DEBUG
    // =============================================================

    installMapDebug() {

        window.openDisplacementMap =
            () => this.openDisplacementMap();


        window.openSurfaceMap =
            () => this.openSurfaceMap();


        window.openPropDistributionMap =
            (type = "grass") =>
                this.openPropDistributionMap(type);


        this.keyHandler = (event) => {

            const key =
                event.key.toLowerCase();


            const types = {
                g: "grass",
                t: "tree",
                r: "rock",
                f: "flower",
                b: "bush"
            };


            if (types[key]) {

                this.openPropDistributionMap(
                    types[key]
                );
            }
        };


        window.addEventListener(
            "keydown",
            this.keyHandler
        );
    }


    openMapInNewTab(canvas, title) {

        const imageURL =
            canvas.toDataURL("image/png");


        const newTab =
            window.open("", "_blank");


        if (!newTab) {

            console.warn(
                "Browser blocked the map tab."
            );

            return;
        }


        newTab.document.write(`
            <!DOCTYPE html>

            <html>

            <head>

                <title>${title}</title>

                <style>

                    html, body {
                        margin: 0;
                        width: 100%;
                        height: 100%;
                        background: #111;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        overflow: auto;
                    }

                    img {
                        max-width: 100%;
                        max-height: 100%;
                        object-fit: contain;
                        image-rendering: pixelated;
                    }

                </style>

            </head>

            <body>

                <img src="${imageURL}" alt="${title}">

            </body>

            </html>
        `);


        newTab.document.close();
    }


    openDisplacementMap() {

        const canvas =
            this.chunkManager.generateDisplacementMap(
                0,
                0,
                1024
            );


        if (canvas) {

            this.openMapInNewTab(
                canvas,
                "Terrain Displacement Map"
            );
        }
    }


    openSurfaceMap() {

        const canvas =
            this.chunkManager.generateSurfaceMap(
                0,
                0,
                1024
            );


        if (canvas) {

            this.openMapInNewTab(
                canvas,
                "Terrain Surface Map"
            );
        }
    }


    openPropDistributionMap(
        type = "grass"
    ) {

        const terrain =
            this.chunkManager.getChunk(
                0,
                0
            );


        if (!terrain) {

            console.warn(
                "Debug terrain chunk (0,0) is not loaded."
            );

            return;
        }


        const canvas =
            terrain.terrain
                .generatePropDistributionMap(
                    type,
                    512
                );


        if (canvas) {

            this.openMapInNewTab(
                canvas,
                `${type} Distribution Map`
            );
        }
    }


    // =============================================================
    // PERFORMANCE UPDATE
    // =============================================================

    update(delta) {

        // Absolutely nothing happens while debug is disabled.
        if (!this.enabled) return;

        this.cpuFrameMs =
    performance.now() - this.cpuFrameStart;

this.totalCpuMs += this.cpuFrameMs;

        this.frameCount++;

        this.elapsed += delta;


        if (this.recording) {
            this.recordingTime += delta;
        }


        const info =
            this.renderer.info;


        const callsDelta =
            info.render.calls -
            this.lastRenderCalls;


        const trianglesDelta =
            info.render.triangles -
            this.lastRenderTriangles;


        const pointsDelta =
            info.render.points -
            this.lastRenderPoints;


        const linesDelta =
            info.render.lines -
            this.lastRenderLines;


        this.lastRenderCalls =
            info.render.calls;

        this.lastRenderTriangles =
            info.render.triangles;

        this.lastRenderPoints =
            info.render.points;

        this.lastRenderLines =
            info.render.lines;


        this.totalDrawCalls +=
            callsDelta;

        this.totalTriangles +=
            trianglesDelta;

        this.totalPoints +=
            pointsDelta;

        this.totalLines +=
            linesDelta;


        // ---------------------------------------------------------
        // UPDATE DISPLAY EVERY ~1 SECOND
        // ---------------------------------------------------------

        if (this.elapsed >= 1.0) {

            const fps =
                this.frameCount /
                this.elapsed;


            const frameTime =
                1000 / fps;


            const avgDrawCalls =
                this.totalDrawCalls /
                this.frameCount;


            const avgTriangles =
                this.totalTriangles /
                this.frameCount;


            const avgPoints =
                this.totalPoints /
                this.frameCount;


            const avgLines =
                this.totalLines /
                this.frameCount;


            const position =
                this.player.getPosition();


            const x =
                position
                    ? position.x
                    : null;


            const y =
                position
                    ? position.y
                    : null;


            const z =
                position
                    ? position.z
                    : null;

                    const frameBudget = 1000 / 144;

const avgCpuMs =
    this.totalCpuMs / this.frameCount;

const cpuUsage =
    Math.min(
        (avgCpuMs / frameBudget) * 100,
        200
    );

const gpuUsage =
    this.gpuFrameMs === null
        ? null
        : Math.min(
            (this.gpuFrameMs / frameBudget) * 100,
            200
        );

            // -----------------------------------------------------
            // RECORDING SAMPLE
            // -----------------------------------------------------

 const sample = {
    time: Number(
        this.recordingTime.toFixed(2)
    ),

    fps: Number(
        fps.toFixed(2)
    ),

    frameTime: Number(
        frameTime.toFixed(2)
    ),

    cpuMs: Number(
        avgCpuMs.toFixed(3)
    ),

    cpuUsage: Number(
        cpuUsage.toFixed(1)
    ),

    gpuMs:
        this.gpuFrameMs === null
            ? null
            : Number(
                this.gpuFrameMs.toFixed(3)
            ),

    gpuUsage:
        gpuUsage === null
            ? null
            : Number(
                gpuUsage.toFixed(1)
            ),

    avgDrawCalls: Number(
        avgDrawCalls.toFixed(2)
    ),

                avgTriangles:
                    Math.round(avgTriangles),

                avgPoints:
                    Number(
                        avgPoints.toFixed(2)
                    ),

                avgLines:
                    Number(
                        avgLines.toFixed(2)
                    ),

                geometries:
                    info.memory.geometries,

                textures:
                    info.memory.textures,

                player: {

                    x:
                        x === null
                            ? null
                            : Number(
                                x.toFixed(2)
                            ),

                    y:
                        y === null
                            ? null
                            : Number(
                                y.toFixed(2)
                            ),

                    z:
                        z === null
                            ? null
                            : Number(
                                z.toFixed(2)
                            )
                },

                chunk: {

                    x:
                        x === null
                            ? null
                            : Math.floor(
                                x / 64
                            ),

                    z:
                        z === null
                            ? null
                            : Math.floor(
                                z / 64
                            )
                }
            };


            if (this.recording) {
                this.samples.push(sample);
            }


            // -----------------------------------------------------
            // PERFORMANCE UI
            // -----------------------------------------------------


const getUsageColor = (usage) => {

    if (usage === null) {
        return "#888";
    }

    if (usage <= 50) {
        return "#4ade80";
    }

    if (usage <= 75) {
        return "#facc15";
    }

    if (usage <= 100) {
        return "#fb923c";
    }

    return "#ef4444";

};


const cpuColor =
    getUsageColor(cpuUsage);

const gpuColor =
    getUsageColor(gpuUsage);

            this.performanceBox.innerHTML = `

            <div style="
    font-weight:bold;
    margin-bottom:6px;
">
    PERFORMANCE
    ${this.recording ? " • RECORDING" : ""}
</div>

<div style="
    display:flex;
    justify-content:space-between;
    color:${cpuColor};
">
    <span>CPU</span>
    <span>
        ${cpuUsage.toFixed(0)}%
        &nbsp;
        ${avgCpuMs.toFixed(2)} ms
    </span>
</div>

<div style="
    display:flex;
    justify-content:space-between;
    color:${gpuColor};
">
    <span>GPU</span>
    <span>
        ${
            gpuUsage === null
                ? "N/A"
                : `${gpuUsage.toFixed(0)}%`
        }
        ${
            this.gpuFrameMs === null
                ? ""
                : `&nbsp; ${this.gpuFrameMs.toFixed(2)} ms`
        }
    </span>
</div>

                <div style="
                    font-weight:bold;
                    margin-bottom:4px;
                ">

                    PERFORMANCE
                    ${this.recording
                        ? " • RECORDING"
                        : ""}

                </div>


                <div>
                    FPS: ${fps.toFixed(1)}
                </div>


                <div>
                    Frame: ${frameTime.toFixed(2)} ms
                </div>


                <div>
                    Draw Calls:
                    ${avgDrawCalls.toFixed(1)}
                </div>


                <div>
                    Triangles:
                    ${Math.round(
                        avgTriangles
                    ).toLocaleString()}
                </div>


                <div>
                    Points:
                    ${avgPoints.toFixed(1)}
                </div>


                <div>
                    Lines:
                    ${avgLines.toFixed(1)}
                </div>


                <div>
                    Geometries:
                    ${info.memory.geometries}
                </div>


                <div>
                    Textures:
                    ${info.memory.textures}
                </div>

                ${
                    this.recording

                        ? `
                            <div style="margin-top:5px;">
                                Samples:
                                ${this.samples.length}
                            </div>
                        `

                        : ""
                }

            `;


            // -----------------------------------------------------
            // RESET ONE-SECOND WINDOW
            // -----------------------------------------------------

            this.elapsed = 0;

            this.frameCount = 0;

            this.totalDrawCalls = 0;

            this.totalTriangles = 0;

            this.totalPoints = 0;

            this.totalLines = 0;
            this.totalCpuMs = 0;
        }
    }


    // =============================================================
    // START RECORDING
    // =============================================================

    startRecording() {

        if (!this.enabled) return;


        this.samples = [];

        this.recording = true;

        this.recordingTime = 0;


        const info =
            this.renderer.info;


        this.lastRenderCalls =
            info.render.calls;

        this.lastRenderTriangles =
            info.render.triangles;

        this.lastRenderPoints =
            info.render.points;

        this.lastRenderLines =
            info.render.lines;


        this.elapsed = 0;

        this.frameCount = 0;

        this.totalDrawCalls = 0;

        this.totalTriangles = 0;

        this.totalPoints = 0;

        this.totalLines = 0;

        this.totalCpuMs = 0;

        this.startRecordingButton.disabled =
            true;

        this.stopRecordingButton.disabled =
            false;


        this.startRecordingButton.style.opacity =
            "0.5";

        this.stopRecordingButton.style.opacity =
            "1";
    }


    // =============================================================
    // STOP RECORDING
    // =============================================================

    stopRecording() {

        if (!this.recording) {
            return;
        }


        this.recording = false;


        this.startRecordingButton.disabled =
            false;

        this.stopRecordingButton.disabled =
            true;


        this.startRecordingButton.style.opacity =
            "1";

        this.stopRecordingButton.style.opacity =
            "0.5";


        const log = {

            version: 2,

            createdAt:
                new Date().toISOString(),

            sampleInterval:
                "approximately 1 second",

            sampleCount:
                this.samples.length,

            samples:
                this.samples
        };


        const blob = new Blob(
            [
                JSON.stringify(
                    log,
                    null,
                    2
                )
            ],
            {
                type: "application/json"
            }
        );


        const url =
            URL.createObjectURL(blob);


        const link =
            document.createElement("a");


        const timestamp =
            new Date()
                .toISOString()
                .replace(
                    /[:.]/g,
                    "-"
                );


        link.href = url;


        link.download =
            `performance-log-${timestamp}.json`;


        document.body.appendChild(link);

        link.click();

        document.body.removeChild(link);

        URL.revokeObjectURL(url);
    }


    // =============================================================
    // RENDER DIAGNOSTIC
    // =============================================================

    runRenderDiagnostic() {

        let objects = 0;
        let meshes = 0;
        let instancedMeshes = 0;
        let visibleMeshes = 0;


        this.scene.traverse(
            (object) => {

                objects++;


                if (object.isMesh) {

                    meshes++;


                    if (object.visible) {
                        visibleMeshes++;
                    }
                }


                if (object.isInstancedMesh) {
                    instancedMeshes++;
                }
            }
        );


        console.log(
            "===== RENDER DIAGNOSTIC ====="
        );


        console.log(
            "Scene Objects:",
            objects
        );


        console.log(
            "Meshes:",
            meshes
        );


        console.log(
            "Visible Meshes:",
            visibleMeshes
        );


        console.log(
            "InstancedMeshes:",
            instancedMeshes
        );


        console.log(
            "Draw Calls:",
            this.renderer.info.render.calls
        );


        console.log(
            "Triangles:",
            this.renderer.info.render.triangles
        );


        console.log(
            "Points:",
            this.renderer.info.render.points
        );


        console.log(
            "Lines:",
            this.renderer.info.render.lines
        );


        console.log(
            "Geometries:",
            this.renderer.info.memory.geometries
        );


        console.log(
            "Textures:",
            this.renderer.info.memory.textures
        );


        console.log(
            "============================"
        );
    }


    // =============================================================
    // DISPOSE
    // =============================================================

    dispose() {

        if (this.enabled) {

            this.disable();

        } else {

            delete window.openDisplacementMap;
            delete window.openSurfaceMap;
            delete window.openPropDistributionMap;
            delete window.runRenderDiagnostic;
        }


        this.renderer.info.autoReset = true;

        this.samples = [];

        this.recording = false;
    }
}
export class TerrainWorkerPool {

    constructor({
        workerCount = 2,
        workerUrl = "./world/TerrainWorker.js"
    } = {}) {

        this.workers = [];
        this.queue = [];
        this.jobs = new Map();
        this.disposed=false;
        for (let i = 0; i < workerCount; i++) {

            const worker = new Worker(
                workerUrl,
                { type: "module" }
            );

            const entry = {
                worker,
                busy: false,
                job: null
            };

            worker.onmessage = (event) => {
                this.handleMessage(entry, event.data);
            };

 worker.onerror = (error) => {

    console.error("Terrain worker pool error:");
    console.error("message:", error.message);
    console.error("filename:", error.filename);
    console.error("lineno:", error.lineno);
    console.error("colno:", error.colno);
    console.error("event:", error);

    if (entry.job) {
        const job = entry.job;

        this.jobs.delete(job.jobId);

        job.reject(error);

        entry.busy = false;
        entry.job = null;

        this.processQueue();
    }
};

            this.workers.push(entry);
        }
    }

generate(data) {
    if (this.disposed) {
        return Promise.reject(
            new Error("TerrainWorkerPool has been disposed.")
        );
    }

    return new Promise((resolve, reject) => {
        const jobId = `terrain_${Date.now()}_${Math.random()}`;

        const job = {
            jobId,
            data: {
                ...data,
                type: "generate",
                jobId
            },
            resolve,
            reject
        };

        this.jobs.set(jobId, job);
        this.queue.push(job);

        this.processQueue();
    });
}

processQueue() {
    if (this.disposed) {
        return;
    }

    for (const entry of this.workers) {
        if (entry.busy) {
            continue;
        }

        const job = this.queue.shift();

        if (!job) {
            return;
        }

        entry.busy = true;
        entry.job = job;

        try {
            entry.worker.postMessage(job.data);
        } catch (error) {
            this.jobs.delete(job.jobId);
            entry.busy = false;
            entry.job = null;
            job.reject(error);
        }
    }
}


    handleMessage(entry, data) {

        const job = entry.job;

        if (!job) {
            return;
        }

        if (data.type === "complete") {

            this.jobs.delete(job.jobId);

            entry.busy = false;
            entry.job = null;

            job.resolve(data);

            this.processQueue();

            return;
        }

        if (data.type === "error") {

            this.jobs.delete(job.jobId);

            entry.busy = false;
            entry.job = null;

            const error =
                new Error(data.message);

            error.stack =
                data.stack ??
                error.stack;

            job.reject(error);

            this.processQueue();
        }
    }

 dispose() {
    if (this.disposed) {
        return;
    }

    this.disposed = true;

    const error = new Error(
        "TerrainWorkerPool was disposed before the job completed."
    );

    // Reject active and queued jobs so callers cannot hang.
    for (const job of this.jobs.values()) {
        job.reject(error);
    }

    this.jobs.clear();
    this.queue.length = 0;

    for (const entry of this.workers) {
        entry.worker.onmessage = null;
        entry.worker.onerror = null;
        entry.worker.terminate();

        entry.busy = false;
        entry.job = null;
    }

    this.workers.length = 0;
}
}
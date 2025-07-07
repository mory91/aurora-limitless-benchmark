import { Worker, isMainThread, parentPort, workerData } from "worker_threads";

import {
  type BenchmarkConfig,
  type LatencyMeasurement,
  type WorkerResult
} from "./types";

import { calculateDataSizeMB, generateBatch } from "./data-generator";
import { createAuroraLimitlessConnection, getTable } from "./database";

interface WorkerMessage {
  type: "start" | "stop";
  config: BenchmarkConfig;
  workerId: number;
  connectionId: number;
}

interface WorkerResponse {
  type: "result";
  result: WorkerResult;
}

// Main thread code - export the function
export const runWorker = (
  config: BenchmarkConfig,
  workerId: number,
  connectionId: number
): Promise<WorkerResult> => {
  return new Promise((resolve, reject) => {
    const worker = new Worker(__filename, {
      workerData: { config, workerId, connectionId }
    });

    worker.on("message", (message: WorkerResponse) => {
      if (message.type === "result") {
        resolve(message.result);
      }
    });

    worker.on("error", reject);
    worker.on("exit", code => {
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
    });
  });
};

// Worker thread code - only run if not main thread
if (!isMainThread) {
  const { config, workerId, connectionId } = workerData as WorkerMessage;

  const runBenchmark = async (): Promise<WorkerResult> => {
    const db = createAuroraLimitlessConnection(config);
    const benchmarkTable = getTable(db, "CapturedTextsDistributedv2");

    const startTime = Date.now();
    const measurements: Array<LatencyMeasurement> = [];
    const errors: Array<string> = [];
    let recordsInserted = 0;
    let totalDataSizeMB = 0;

    try {
      // Warmup phase
      const warmupStart = Date.now();
      while (Date.now() - warmupStart < config.warmupDuration * 1000) {
        const batch = generateBatch(config, config.batchSize);
        const batchStart = Date.now();

        try {
          await benchmarkTable.insert(batch);
          const batchEnd = Date.now();
          const latency = batchEnd - batchStart;

          measurements.push({
            startTime: batchStart,
            endTime: batchEnd,
            latency,
            success: true
          });

          recordsInserted += batch.length;
          totalDataSizeMB += calculateDataSizeMB(batch);
        } catch (error) {
          const batchEnd = Date.now();
          const latency = batchEnd - batchStart;

          measurements.push({
            startTime: batchStart,
            endTime: batchEnd,
            latency,
            success: false,
            error: error instanceof Error ? error.message : String(error)
          });

          errors.push(error instanceof Error ? error.message : String(error));
        }
      }

      // Actual benchmark phase
      const benchmarkStart = Date.now();
      while (Date.now() - benchmarkStart < config.testDuration * 1000) {
        const batch = generateBatch(config, config.batchSize);
        const batchStart = Date.now();

        try {
          await benchmarkTable.insert(batch);
          const batchEnd = Date.now();
          const latency = batchEnd - batchStart;

          measurements.push({
            startTime: batchStart,
            endTime: batchEnd,
            latency,
            success: true
          });

          recordsInserted += batch.length;
          totalDataSizeMB += calculateDataSizeMB(batch);
        } catch (error) {
          const batchEnd = Date.now();
          const latency = batchEnd - batchStart;

          measurements.push({
            startTime: batchStart,
            endTime: batchEnd,
            latency,
            success: false,
            error: error instanceof Error ? error.message : String(error)
          });

          errors.push(error instanceof Error ? error.message : String(error));
          console.log(error)
        }
      }

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      // Calculate statistics
      const latencies = measurements.map(m => m.latency).sort((a, b) => a - b);
      const successCount = measurements.filter(m => m.success).length;
      const errorCount = measurements.filter(m => !m.success).length;

      const result: WorkerResult = {
        workerId,
        connectionId,
        recordsInserted,
        dataSizeMB: totalDataSizeMB,
        duration,
        avgLatencyMs:
          latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length,
        p50LatencyMs: latencies[Math.floor(latencies.length * 0.5)],
        p95LatencyMs: latencies[Math.floor(latencies.length * 0.95)],
        p99LatencyMs: latencies[Math.floor(latencies.length * 0.99)],
        minLatencyMs: latencies[0],
        maxLatencyMs: latencies[latencies.length - 1],
        successCount,
        errorCount,
        errors: errors.slice(0, 10) // Limit error messages
      };

      await db.destroy();
      return result;
    } catch (error) {
      await db.destroy();
      throw error;
    }
  };

  // Start the benchmark when worker is created
  runBenchmark()
    .then(result => {
      parentPort?.postMessage({ type: "result", result });
    })
    .catch(error => {
      parentPort?.postMessage({ type: "error", error: error.message });
    });
}

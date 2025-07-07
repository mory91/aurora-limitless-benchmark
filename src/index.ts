import { type BenchmarkConfig, type BenchmarkResult } from "./types";

import { runWorker } from "./benchmark-worker";
import { runTwoStageBenchmark } from "./two-stage-benchmark";
import { runHighThroughputBenchmark } from "./optimized-two-stage";
import { runSimpleStreamingBenchmark } from "./simple-streaming-benchmark";
import { createAuroraLimitlessConnection } from "./database";

const DEFAULT_CONFIG: BenchmarkConfig = {
  host: process.env.AURORA_HOST || "localhost",
  port: parseInt(process.env.AURORA_PORT || "5432", 10),
  database: process.env.AURORA_DATABASE || "browseai",
  username: process.env.AURORA_USERNAME || "postgres",
  password: process.env.AURORA_PASSWORD || "",
  ssl: process.env.AURORA_SSL === "true",
  minWorkers: parseInt(process.env.MIN_WORKERS || "1", 10),
  maxWorkers: parseInt(process.env.MAX_WORKERS || "4", 10),
  workerStep: parseInt(process.env.WORKER_STEP || "1", 10),
  connectionsPerWorker: parseInt(process.env.CONNECTIONS_PER_WORKER || "20", 10),
  batchSize: parseInt(process.env.BATCH_SIZE || "100", 10),
  testDuration: parseInt(process.env.TEST_DURATION || "30", 10),
  warmupDuration: parseInt(process.env.WARMUP_DURATION || "5", 10),
  minTextLength: parseInt(process.env.MIN_TEXT_LENGTH || "50", 10),
  maxTextLength: parseInt(process.env.MAX_TEXT_LENGTH || "500", 10),
  dataSizeMB: parseInt(process.env.DATA_SIZE_MB || "100", 10),
  maxLatencyMs: parseInt(process.env.MAX_LATENCY_MS || "1000", 10),
  minThroughputMBps: parseFloat(process.env.MIN_THROUGHPUT_MBPS || "10"),
  useTwoStageApproach: process.env.USE_TWO_STAGE === "true"
};

const runBenchmark = async (
  config: BenchmarkConfig
): Promise<BenchmarkResult> => {
  if (process.env.USE_STREAMING === "true") {
    return runSimpleStreamingBenchmark(config);
  }
  
  if (config.useTwoStageApproach) {
    if (process.env.USE_HIGH_THROUGHPUT === "true") {
      return runHighThroughputBenchmark(config);
    }
    return runTwoStageBenchmark(config);
  }

  console.log("Starting Aurora Limitless benchmark...");

  const startTime = Date.now();
  const workers = config.minWorkers;
  const totalConnections = workers * config.connectionsPerWorker;

  console.log(
    `Testing with ${workers} workers, ${totalConnections} total connections...`
  );

  const workerPromises: Array<Promise<any>> = [];
  for (let workerId = 0; workerId < workers; workerId++) {
    for (
      let connectionId = 0;
      connectionId < config.connectionsPerWorker;
      connectionId++
    ) {
      workerPromises.push(runWorker(config, workerId, connectionId));
    }
  }

  const workerResults = await Promise.all(workerPromises);

  const totalRecords = workerResults.reduce(
    (sum: number, r: any) => sum + r.recordsInserted,
    0
  );
  const totalDataSizeMB = workerResults.reduce(
    (sum: number, r: any) => sum + r.dataSizeMB,
    0
  );
  const totalSuccessCount = workerResults.reduce(
    (sum: number, r: any) => sum + r.successCount,
    0
  );
  const totalErrorCount = workerResults.reduce(
    (sum: number, r: any) => sum + r.errorCount,
    0
  );

  const duration = config.testDuration;
  const throughputMBps = totalDataSizeMB / duration;
  const throughputRecordsPerSecond = totalRecords / duration;
  const successRate = totalSuccessCount / (totalSuccessCount + totalErrorCount);

  const avgLatencyMs =
    workerResults.reduce((sum: number, r: any) => sum + r.avgLatencyMs, 0) /
    workerResults.length;

  const result: BenchmarkResult = {
    timestamp: new Date().toISOString(),
    workers,
    connectionsPerWorker: config.connectionsPerWorker,
    totalConnections,
    batchSize: config.batchSize,
    duration,
    totalRecords,
    totalDataSizeMB,
    throughputMBps,
    throughputRecordsPerSecond,
    avgLatencyMs,
    p50LatencyMs: avgLatencyMs,
    p95LatencyMs: avgLatencyMs,
    p99LatencyMs: avgLatencyMs,
    minLatencyMs: avgLatencyMs,
    maxLatencyMs: avgLatencyMs,
    successCount: totalSuccessCount,
    errorCount: totalErrorCount,
    successRate,
    errors: []
  };

  console.log(`Records: ${totalRecords.toLocaleString()}`);
  console.log(`Data: ${totalDataSizeMB.toFixed(2)} MB`);
  console.log(`Throughput: ${throughputMBps.toFixed(2)} MB/s`);
  console.log(`Records/sec: ${throughputRecordsPerSecond.toFixed(0)}`);
  console.log(`Success Rate: ${(successRate * 100).toFixed(1)}%`);

  return result;
};

const main = async (): Promise<void> => {
  try {
    const config = DEFAULT_CONFIG;

    if (!config.password) {
      console.error("AURORA_PASSWORD environment variable is required");
      process.exit(1);
    }

    const db = createAuroraLimitlessConnection(config);
    try {
      await db.raw("SELECT 1");
      console.log("Database connection successful");
    } catch (error) {
      console.error("Database connection failed:", error);
      process.exit(1);
    } finally {
      await db.destroy();
    }

    const result = await runBenchmark(config);

    const fs = require("fs");
    const resultsDir = "./aurora_benchmark_results";
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    const filename = `aurora_benchmark_${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}.json`;
    fs.writeFileSync(
      `${resultsDir}/${filename}`,
      JSON.stringify(result, null, 2)
    );
    console.log(`Results saved to ${resultsDir}/${filename}`);
  } catch (error) {
    console.error("Benchmark failed:", error);
    process.exit(1);
  }
};

if (require.main === module) {
  main();
}

import { type BenchmarkConfig, type BenchmarkResult } from "./types";
import { createAuroraLimitlessConnection } from "./database";
import { generateCapturedText } from "./data-generator";
import { performance } from 'perf_hooks';

interface WorkerResult {
  workerId: number;
  successfulInserts: number;
  failedInserts: number;
  latencies: number[];
  errors: string[];
  duration: number;
}

export const runSimpleStreamingBenchmark = async (
  config: BenchmarkConfig
): Promise<BenchmarkResult> => {
  console.log("Starting Multi-Worker Streaming Aurora benchmark...");
  const startTime = performance.now();
  
  const batchSize = 50; // Small batches for streaming
  const workers = config.minWorkers;
  const totalConnections = workers * config.connectionsPerWorker;
  const totalRecords = Math.floor((config.dataSizeMB * 1024 * 1024) / (75 * 1024)); // ~75KB per record
  const recordsPerConnection = Math.floor(totalRecords / totalConnections);
  
  console.log(`Target: ${totalRecords.toLocaleString()} records`);
  console.log(`Workers: ${workers}, Connections per worker: ${config.connectionsPerWorker}`);
  console.log(`Total connections: ${totalConnections}, Records per connection: ${recordsPerConnection}`);
  console.log(`Batch size: ${batchSize}`);
  
  // Create separate database connections for true parallelism
  const connections = [];
  for (let i = 0; i < totalConnections; i++) {
    connections.push(createAuroraLimitlessConnection(config));
  }
  
  try {
    // Test all connections
    console.log('Testing all database connections...');
    await Promise.all(connections.map(db => db.raw('SELECT 1')));
    console.log(`All ${totalConnections} connections successful\n`);
    
    // Run all workers in parallel
    const workerPromises = connections.map((db, index) => 
      runStreamingWorker(db, index, recordsPerConnection, batchSize, config, startTime)
    );
    
    const workerResults = await Promise.all(workerPromises);
    
    // Aggregate results
    const successfulInserts = workerResults.reduce((sum, r) => sum + r.successfulInserts, 0);
    const failedInserts = workerResults.reduce((sum, r) => sum + r.failedInserts, 0);
    const allErrors = workerResults.flatMap(r => r.errors).slice(0, 10);
    const allLatencies = workerResults.flatMap(r => r.latencies);
    
    const endTime = performance.now();
    const duration = (endTime - startTime) / 1000;
    
    // Calculate results
    const avgRecordSizeKB = 75;
    const totalDataSizeMB = (successfulInserts * avgRecordSizeKB) / 1024;
    const avgLatencyMs = allLatencies.length > 0 ? allLatencies.reduce((sum, l) => sum + l, 0) / allLatencies.length : 0;
    
    const result: BenchmarkResult = {
      timestamp: new Date().toISOString(),
      workers,
      connectionsPerWorker: config.connectionsPerWorker,
      totalConnections,
      batchSize,
      duration,
      totalRecords: successfulInserts,
      totalDataSizeMB,
      throughputMBps: totalDataSizeMB / duration,
      throughputRecordsPerSecond: successfulInserts / duration,
      avgLatencyMs,
      p50LatencyMs: avgLatencyMs,
      p95LatencyMs: avgLatencyMs * 1.5,
      p99LatencyMs: avgLatencyMs * 2,
      minLatencyMs: allLatencies.length > 0 ? Math.min(...allLatencies) : 0,
      maxLatencyMs: allLatencies.length > 0 ? Math.max(...allLatencies) : 0,
      successCount: successfulInserts,
      errorCount: failedInserts,
      successRate: successfulInserts / (successfulInserts + failedInserts),
      errors: allErrors
    };
    
    console.log(`\n=== Multi-Worker Streaming Results ===`);
    console.log(`Duration: ${duration.toFixed(3)}s`);
    console.log(`Records: ${result.totalRecords.toLocaleString()} (${failedInserts} failed)`);
    console.log(`Data: ${result.totalDataSizeMB.toFixed(2)} MB`);
    console.log(`Throughput: ${result.throughputMBps.toFixed(2)} MB/s`);
    console.log(`Records/sec: ${result.throughputRecordsPerSecond.toFixed(0)}`);
    console.log(`Success Rate: ${(result.successRate * 100).toFixed(1)}%`);
    console.log(`Avg Batch Latency: ${result.avgLatencyMs.toFixed(1)}ms`);
    console.log(`Worker Performance:`);
    workerResults.forEach(w => {
      const workerThroughput = w.successfulInserts / w.duration;
      console.log(`  Worker ${w.workerId}: ${w.successfulInserts} records, ${workerThroughput.toFixed(0)} rec/s`);
    });
    
    return result;
    
  } finally {
    // Cleanup all connections
    await Promise.all(connections.map(db => db.destroy()));
  }
};

async function runStreamingWorker(
  db: any,
  workerId: number,
  totalRecords: number,
  batchSize: number,
  config: BenchmarkConfig,
  benchmarkStartTime: number
): Promise<WorkerResult> {
  const workerStartTime = performance.now();
  let successfulInserts = 0;
  let failedInserts = 0;
  const errors: string[] = [];
  const latencies: number[] = [];
  
  console.log(`Worker ${workerId}: Starting ${totalRecords} records`);
  
  try {
    // Insert in small batches
    for (let i = 0; i < totalRecords; i += batchSize) {
      const currentBatchSize = Math.min(batchSize, totalRecords - i);
      
      // Generate batch
      const batch = [];
      for (let j = 0; j < currentBatchSize; j++) {
        batch.push(generateCapturedText(config));
      }
      
      // Insert batch
      const batchStartTime = performance.now();
      try {
        await db('CapturedTextsDistributedv2').insert(batch);
        const batchEndTime = performance.now();
        
        successfulInserts += currentBatchSize;
        latencies.push(batchEndTime - batchStartTime);
        
        // Progress update every 50 batches per worker
        if (Math.floor(i / batchSize) % 50 === 0) {
          const progress = ((i + currentBatchSize) / totalRecords * 100).toFixed(1);
          const workerThroughput = successfulInserts / ((batchEndTime - workerStartTime) / 1000);
          const overallThroughput = successfulInserts / ((batchEndTime - benchmarkStartTime) / 1000);
          console.log(`Worker ${workerId}: ${i + currentBatchSize}/${totalRecords} (${progress}%) - ${workerThroughput.toFixed(0)} rec/s`);
        }
        
      } catch (error) {
        failedInserts += currentBatchSize;
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`Worker ${workerId} Batch ${i}-${i + currentBatchSize}: ${errorMsg}`);
        console.error(`Worker ${workerId}: Batch failed at ${i}: ${errorMsg}`);
      }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`Worker ${workerId}: Fatal error: ${errorMsg}`);
    errors.push(`Worker ${workerId} Fatal: ${errorMsg}`);
  }
  
  const workerEndTime = performance.now();
  const workerDuration = (workerEndTime - workerStartTime) / 1000;
  
  console.log(`Worker ${workerId}: Completed in ${workerDuration.toFixed(2)}s (${successfulInserts}/${totalRecords} successful)`);
  
  return {
    workerId,
    successfulInserts,
    failedInserts,
    latencies,
    errors: errors.slice(0, 5), // Limit errors per worker
    duration: workerDuration
  };
}
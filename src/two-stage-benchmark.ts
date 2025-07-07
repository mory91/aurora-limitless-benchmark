import { type BenchmarkConfig, type BenchmarkResult, type FileGenerationResult, type CopyExecutionResult } from "./types";
import { runFileGeneration, runCopyExecution } from "./two-stage-worker";
import { cleanupFiles } from "./csv-utils";

export const runTwoStageBenchmark = async (
  config: BenchmarkConfig
): Promise<BenchmarkResult> => {
  console.log("Starting Two-Stage Aurora Limitless benchmark...");
  const overallStartTime = Date.now();
  
  const workers = config.minWorkers;
  const totalConnections = workers * config.connectionsPerWorker;
  const recordsPerConnection = Math.floor((config.dataSizeMB * 1024 * 1024) / (totalConnections * 75 * 1024)); // Assume ~75KB per record
  
  console.log(`Stage 1: Generating CSV files...`);
  console.log(`${workers} workers, ${totalConnections} connections, ${recordsPerConnection} records per connection`);
  
  // Stage 1: Generate CSV files
  const generationStartTime = Date.now();
  const generationPromises: Array<Promise<FileGenerationResult>> = [];
  
  for (let workerId = 0; workerId < workers; workerId++) {
    for (let connectionId = 0; connectionId < config.connectionsPerWorker; connectionId++) {
      generationPromises.push(
        runFileGeneration(config, workerId, connectionId, recordsPerConnection)
      );
    }
  }
  
  const generationResults = await Promise.all(generationPromises);
  const generationEndTime = Date.now();
  
  const successfulGenerations = generationResults.filter(r => r.success);
  const failedGenerations = generationResults.filter(r => !r.success);
  
  console.log(`Stage 1 completed: ${successfulGenerations.length} files generated, ${failedGenerations.length} failed`);
  console.log(`Generation time: ${(generationEndTime - generationStartTime) / 1000}s`);
  
  if (successfulGenerations.length === 0) {
    throw new Error("No CSV files were generated successfully");
  }
  
  // Stage 2: Execute COPY commands
  console.log(`Stage 2: Executing COPY commands...`);
  const copyStartTime = Date.now();
  const copyPromises: Array<Promise<CopyExecutionResult>> = [];
  
  for (const genResult of successfulGenerations) {
    copyPromises.push(
      runCopyExecution(config, genResult.workerId, genResult.connectionId, genResult.filePath)
    );
  }
  
  // Execute COPY operations with controlled concurrency for better monitoring
  const maxConcurrentCopies = Math.min(10, successfulGenerations.length);
  const copyResults: CopyExecutionResult[] = [];
  
  console.log(`Running ${successfulGenerations.length} COPY operations with max ${maxConcurrentCopies} concurrent`);
  
  for (let i = 0; i < successfulGenerations.length; i += maxConcurrentCopies) {
    const batch = successfulGenerations.slice(i, i + maxConcurrentCopies);
    const batchPromises = batch.map(genResult =>
      runCopyExecution(config, genResult.workerId, genResult.connectionId, genResult.filePath)
    );
    
    const batchStart = Date.now();
    const batchResults = await Promise.all(batchPromises);
    const batchEnd = Date.now();
    
    copyResults.push(...batchResults);
    
    const batchSuccessful = batchResults.filter(r => r.success);
    const batchThroughput = batchSuccessful.reduce((sum, r) => sum + r.dataSizeMB, 0) / ((batchEnd - batchStart) / 1000);
    
    console.log(`Batch ${Math.floor(i/maxConcurrentCopies) + 1}: ${batchSuccessful.length}/${batch.length} successful, ${batchThroughput.toFixed(2)} MB/s`);
  }
  const copyEndTime = Date.now();
  
  const successfulCopies = copyResults.filter(r => r.success);
  const failedCopies = copyResults.filter(r => !r.success);
  
  console.log(`Stage 2 completed: ${successfulCopies.length} COPY operations succeeded, ${failedCopies.length} failed`);
  console.log(`COPY time: ${(copyEndTime - copyStartTime) / 1000}s`);
  
  // Calculate overall results
  const totalRecords = successfulCopies.reduce((sum, r) => sum + r.recordsInserted, 0);
  const totalDataSizeMB = successfulCopies.reduce((sum, r) => sum + r.dataSizeMB, 0);
  const totalSuccessCount = successfulCopies.length;
  const totalErrorCount = failedCopies.length;
  
  const overallEndTime = Date.now();
  const overallDuration = (overallEndTime - overallStartTime) / 1000;
  const copyDuration = (copyEndTime - copyStartTime) / 1000;
  
  const throughputMBps = totalDataSizeMB / copyDuration; // Only measure COPY throughput
  const throughputRecordsPerSecond = totalRecords / copyDuration;
  const successRate = totalSuccessCount / (totalSuccessCount + totalErrorCount);
  
  const avgCopyLatencyMs = successfulCopies.length > 0 
    ? successfulCopies.reduce((sum, r) => sum + r.executionTimeMs, 0) / successfulCopies.length
    : 0;
  
  const errors = [
    ...failedGenerations.map(r => r.error || "Generation failed"),
    ...failedCopies.map(r => r.error || "COPY failed")
  ];
  
  // Cleanup files
  const allFilePaths = generationResults.map(r => r.filePath).filter(p => p);
  cleanupFiles(allFilePaths);
  console.log(`Cleaned up ${allFilePaths.length} temporary files`);
  
  const result: BenchmarkResult = {
    timestamp: new Date().toISOString(),
    workers,
    connectionsPerWorker: config.connectionsPerWorker,
    totalConnections: successfulGenerations.length,
    batchSize: recordsPerConnection,
    duration: copyDuration, // Report only COPY duration for throughput calculation
    totalRecords,
    totalDataSizeMB,
    throughputMBps,
    throughputRecordsPerSecond,
    avgLatencyMs: avgCopyLatencyMs,
    p50LatencyMs: avgCopyLatencyMs, // Simplified for now
    p95LatencyMs: avgCopyLatencyMs,
    p99LatencyMs: avgCopyLatencyMs,
    minLatencyMs: avgCopyLatencyMs,
    maxLatencyMs: avgCopyLatencyMs,
    successCount: totalSuccessCount,
    errorCount: totalErrorCount,
    successRate,
    errors: errors.slice(0, 10)
  };
  
  console.log(`\n=== Two-Stage Benchmark Results ===`);
  console.log(`Generation phase: ${(generationEndTime - generationStartTime) / 1000}s`);
  console.log(`COPY phase: ${copyDuration}s`);
  console.log(`Total time: ${overallDuration}s`);
  console.log(`Records: ${totalRecords.toLocaleString()}`);
  console.log(`Data: ${totalDataSizeMB.toFixed(2)} MB`);
  console.log(`Throughput: ${throughputMBps.toFixed(2)} MB/s`);
  console.log(`Records/sec: ${throughputRecordsPerSecond.toFixed(0)}`);
  console.log(`Success Rate: ${(successRate * 100).toFixed(1)}%`);
  
  return result;
};
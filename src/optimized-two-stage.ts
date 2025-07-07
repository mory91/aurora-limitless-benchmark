import { type BenchmarkConfig, type BenchmarkResult } from "./types";
import { runTwoStageBenchmark } from "./two-stage-benchmark";
// import { globalMonitor } from "./enhanced-monitoring";

export interface HighThroughputConfig extends BenchmarkConfig {
  maxConcurrentCopies?: number;
  enableRealtimeStats?: boolean;
  statsPrintInterval?: number;
  targetThroughputMBps?: number;
  adaptiveBatchSizing?: boolean;
}

export const runHighThroughputBenchmark = async (
  config: HighThroughputConfig
): Promise<BenchmarkResult & { optimizationStats: any }> => {
  
  // Apply high-throughput optimizations
  const optimizedConfig: HighThroughputConfig = {
    ...config,
    maxConcurrentCopies: config.maxConcurrentCopies || Math.min(20, config.minWorkers * config.connectionsPerWorker),
    enableRealtimeStats: config.enableRealtimeStats ?? true,
    statsPrintInterval: config.statsPrintInterval || 3000,
  };

  console.log(`🚀 High-Throughput Aurora Benchmark`);
  console.log(`Optimizations:`);
  console.log(`  - Max concurrent COPY ops: ${optimizedConfig.maxConcurrentCopies}`);
  console.log(`  - Real-time monitoring: ${optimizedConfig.enableRealtimeStats}`);
  console.log(`  - Target throughput: ${config.targetThroughputMBps || 'auto'} MB/s`);
  
  const result = await runTwoStageBenchmark(optimizedConfig);
  
  const optimizationStats = {
    configuredConcurrency: optimizedConfig.maxConcurrentCopies,
    connectionPoolSize: Math.max(20, optimizedConfig.minWorkers * optimizedConfig.connectionsPerWorker * 2)
  };
  
  return {
    ...result,
    optimizationStats
  };
};

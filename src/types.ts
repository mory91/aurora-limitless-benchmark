// Standalone interface for benchmark data
export interface CapturedText {
  id?: string;
  taskId: string;
  stepIndex: number;
  name: string;
  text: string;
  selector?: string;
  url?: string;
  createdAt?: Date;
  targetNotFound: boolean;
  detectedChange: boolean;
  comparedToTextId: string | null;
  comparedToRecording: boolean;
  listId: string | null;
  listItemIndex: number | null;
  listPageNumber: number | null;
  listPageItemIndex: number | null;
  attachmentS3Key: string | null;
  attachmentMimeType: string | null;
  type: string;
}

export interface BenchmarkConfig {
  // Database configuration
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;

  // Benchmark configuration
  minWorkers: number;
  maxWorkers: number;
  workerStep: number;
  connectionsPerWorker: number;
  batchSize: number;
  testDuration: number; // seconds
  warmupDuration: number; // seconds

  // Data generation
  minTextLength: number;
  maxTextLength: number;
  dataSizeMB: number; // Target data size in MB

  // Performance thresholds
  maxLatencyMs: number;
  minThroughputMBps: number;
  
  // Benchmark mode
  useTwoStageApproach?: boolean;
}

export interface BenchmarkResult {
  timestamp: string;
  workers: number;
  connectionsPerWorker: number;
  totalConnections: number;
  batchSize: number;
  duration: number; // seconds
  totalRecords: number;
  totalDataSizeMB: number;
  throughputMBps: number;
  throughputRecordsPerSecond: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  successCount: number;
  errorCount: number;
  successRate: number;
  errors: Array<string>;
}

export interface WorkerResult {
  workerId: number;
  connectionId: number;
  recordsInserted: number;
  dataSizeMB: number;
  duration: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  successCount: number;
  errorCount: number;
  errors: Array<string>;
}

export interface LatencyMeasurement {
  startTime: number;
  endTime: number;
  latency: number;
  success: boolean;
  error?: string;
}

export interface CopyStreamResult {
  recordsInserted: number;
  dataSizeMB: number;
  duration: number;
  avgLatencyMs: number;
  success: boolean;
  error?: string;
}

export interface FileGenerationResult {
  workerId: number;
  connectionId: number;
  filePath: string;
  recordsGenerated: number;
  fileSizeMB: number;
  generationTimeMs: number;
  success: boolean;
  error?: string;
}

export interface CopyExecutionResult {
  workerId: number;
  connectionId: number;
  filePath: string;
  recordsInserted: number;
  dataSizeMB: number;
  executionTimeMs: number;
  success: boolean;
  error?: string;
}

import { Worker, isMainThread, parentPort, workerData } from "worker_threads";
import * as fs from "fs";
import * as path from "path";

import {
  type BenchmarkConfig,
  type FileGenerationResult,
  type CopyExecutionResult
} from "./types";

import { generateCapturedText } from "./data-generator";
import { createAuroraLimitlessConnection } from "./database";
import { createCsvFile, convertToCsvRow, calculateFileSizeMB } from "./csv-utils";

interface WorkerMessage {
  stage: "generate" | "copy";
  config: BenchmarkConfig;
  workerId: number;
  connectionId: number;
  filePath?: string;
  recordCount?: number;
}

interface WorkerResponse {
  type: "generation_result" | "copy_result";
  result: FileGenerationResult | CopyExecutionResult;
}

// Main thread functions
export const runFileGeneration = (
  config: BenchmarkConfig,
  workerId: number,
  connectionId: number,
  recordCount: number
): Promise<FileGenerationResult> => {
  return new Promise((resolve, reject) => {
    const worker = new Worker(__filename, {
      workerData: { 
        stage: "generate", 
        config, 
        workerId, 
        connectionId, 
        recordCount 
      }
    });

    worker.on("message", (message: WorkerResponse) => {
      if (message.type === "generation_result") {
        resolve(message.result as FileGenerationResult);
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

export const runCopyExecution = (
  config: BenchmarkConfig,
  workerId: number,
  connectionId: number,
  filePath: string
): Promise<CopyExecutionResult> => {
  return new Promise((resolve, reject) => {
    const worker = new Worker(__filename, {
      workerData: { 
        stage: "copy", 
        config, 
        workerId, 
        connectionId, 
        filePath 
      }
    });

    worker.on("message", (message: WorkerResponse) => {
      if (message.type === "copy_result") {
        resolve(message.result as CopyExecutionResult);
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

// Worker thread code
if (!isMainThread) {
  const { stage, config, workerId, connectionId, filePath, recordCount } = workerData as WorkerMessage;

  if (stage === "generate") {
    generateCsvFile(config, workerId, connectionId, recordCount!)
      .then(result => {
        parentPort?.postMessage({ type: "generation_result", result });
      })
      .catch(error => {
        parentPort?.postMessage({ 
          type: "generation_result", 
          result: {
            workerId,
            connectionId,
            filePath: "",
            recordsGenerated: 0,
            fileSizeMB: 0,
            generationTimeMs: 0,
            success: false,
            error: error.message
          } as FileGenerationResult
        });
      });
  } else if (stage === "copy") {
    executeCopyCommand(config, workerId, connectionId, filePath!)
      .then(result => {
        parentPort?.postMessage({ type: "copy_result", result });
      })
      .catch(error => {
        parentPort?.postMessage({ 
          type: "copy_result", 
          result: {
            workerId,
            connectionId,
            filePath: filePath!,
            recordsInserted: 0,
            dataSizeMB: 0,
            executionTimeMs: 0,
            success: false,
            error: error.message
          } as CopyExecutionResult
        });
      });
  }
}

async function generateCsvFile(
  config: BenchmarkConfig,
  workerId: number,
  connectionId: number,
  recordCount: number
): Promise<FileGenerationResult> {
  const startTime = Date.now();
  const fileName = `worker_${workerId}_conn_${connectionId}_${startTime}.csv`;
  const filePath = path.join("./temp_csv_files", fileName);
  
  try {
    const csvStream = createCsvFile(filePath);
    
    let recordsGenerated = 0;
    for (let i = 0; i < recordCount; i++) {
      const record = generateCapturedText(config);
      const csvRow = convertToCsvRow(record);
      csvStream.write(csvRow + "\n");
      recordsGenerated++;
    }
    
    csvStream.end();
    
    // Wait for stream to finish
    await new Promise<void>((resolve, reject) => {
      csvStream.on("finish", () => resolve());
      csvStream.on("error", reject);
    });
    
    const endTime = Date.now();
    const fileSizeMB = calculateFileSizeMB(filePath);
    
    return {
      workerId,
      connectionId,
      filePath,
      recordsGenerated,
      fileSizeMB,
      generationTimeMs: endTime - startTime,
      success: true
    };
  } catch (error) {
    const endTime = Date.now();
    return {
      workerId,
      connectionId,
      filePath,
      recordsGenerated: 0,
      fileSizeMB: 0,
      generationTimeMs: endTime - startTime,
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function executeCopyCommand(
  config: BenchmarkConfig,
  workerId: number,
  connectionId: number,
  filePath: string
): Promise<CopyExecutionResult> {
  const startTime = Date.now();
  const db = createAuroraLimitlessConnection(config);
  
  try {
    const absoluteFilePath = path.resolve(filePath);
    const fileSizeMB = calculateFileSizeMB(absoluteFilePath);
    
    // Get the raw PostgreSQL client from Knex
    const client = await db.client.acquireConnection();
    
    try {
      // Use COPY FROM STDIN with file streaming (no memory loading)
      const stream = client.query(require('pg-copy-streams').from(`
        COPY "CapturedTextsDistributedv2" (
          "taskId", "stepIndex", "name", "text", "targetNotFound", 
          "detectedChange", "comparedToTextId", "comparedToRecording", 
          "listId", "listItemIndex", "listPageNumber", "listPageItemIndex",
          "attachmentS3Key", "attachmentMimeType", "type"
        ) FROM STDIN WITH (FORMAT csv, HEADER true)
      `));
      
      // Stream the CSV file directly without loading into memory
      await new Promise<void>((resolve, reject) => {
        const fileStream = fs.createReadStream(absoluteFilePath, {
          encoding: 'utf8',
          highWaterMark: 64 * 1024 // 64KB chunks for better performance
        });
        
        fileStream.pipe(stream);
        
        fileStream.on('error', reject);
        stream.on('error', reject);
        stream.on('finish', () => resolve());
      });
      
      const recordsInserted = stream.rowCount || 0;
      
      const endTime = Date.now();
      
      return {
        workerId,
        connectionId,
        filePath,
        recordsInserted,
        dataSizeMB: fileSizeMB,
        executionTimeMs: endTime - startTime,
        success: true
      };
    } finally {
      db.client.releaseConnection(client);
    }
  } catch (error) {
    console.log(error);
    const endTime = Date.now();
    
    return {
      workerId,
      connectionId,
      filePath,
      recordsInserted: 0,
      dataSizeMB: 0,
      executionTimeMs: endTime - startTime,
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  } finally {
    await db.destroy();
  }
}

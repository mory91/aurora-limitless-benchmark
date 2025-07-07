import { type CapturedText } from "./types";
import * as fs from "fs";
import * as path from "path";

export const CSV_HEADERS = [
  "taskId",
  "stepIndex", 
  "name",
  "text",
  "targetNotFound",
  "detectedChange",
  "comparedToTextId",
  "comparedToRecording",
  "listId",
  "listItemIndex",
  "listPageNumber",
  "listPageItemIndex",
  "attachmentS3Key",
  "attachmentMimeType",
  "type"
].join(",");

export const convertToCsvRow = (record: CapturedText): string => {
  const escapeCsvValue = (value: any): string => {
    if (value === null || value === undefined) return "";
    const str = String(value);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  return [
    escapeCsvValue(record.taskId),
    escapeCsvValue(record.stepIndex),
    escapeCsvValue(record.name),
    escapeCsvValue(record.text),
    escapeCsvValue(record.targetNotFound),
    escapeCsvValue(record.detectedChange),
    escapeCsvValue(record.comparedToTextId),
    escapeCsvValue(record.comparedToRecording),
    escapeCsvValue(record.listId),
    escapeCsvValue(record.listItemIndex),
    escapeCsvValue(record.listPageNumber),
    escapeCsvValue(record.listPageItemIndex),
    escapeCsvValue(record.attachmentS3Key),
    escapeCsvValue(record.attachmentMimeType),
    escapeCsvValue(record.type)
  ].join(",");
};

export const createCsvFile = (filePath: string): fs.WriteStream => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  const stream = fs.createWriteStream(filePath);
  stream.write(CSV_HEADERS + "\n");
  return stream;
};

export const calculateFileSizeMB = (filePath: string): number => {
  const stats = fs.statSync(filePath);
  return stats.size / (1024 * 1024);
};

export const cleanupFiles = (filePaths: string[]): void => {
  for (const filePath of filePaths) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.warn(`Failed to cleanup file ${filePath}:`, error);
    }
  }
};
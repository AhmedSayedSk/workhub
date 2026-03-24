import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';

const LOG_PATH = join(dirname(new URL(import.meta.url).pathname), '..', 'generation-log.json');

export interface LogEntry {
  timestamp: string;
  prompt: string;
  model: string;
  aspectRatio: string;
  count: number;
  imagesGenerated: number;
  seed?: number;
  email?: string;
  hadReferences: boolean;
  savedPaths: string[];
}

interface LogData {
  totalRequests: number;
  totalImagesGenerated: number;
  entries: LogEntry[];
}

function readLog(): LogData {
  if (!existsSync(LOG_PATH)) {
    return { totalRequests: 0, totalImagesGenerated: 0, entries: [] };
  }
  try {
    return JSON.parse(readFileSync(LOG_PATH, 'utf-8'));
  } catch {
    return { totalRequests: 0, totalImagesGenerated: 0, entries: [] };
  }
}

function writeLog(data: LogData) {
  writeFileSync(LOG_PATH, JSON.stringify(data, null, 2));
}

export function logGeneration(entry: LogEntry) {
  const data = readLog();
  data.totalRequests++;
  data.totalImagesGenerated += entry.imagesGenerated;
  data.entries.push(entry);
  writeLog(data);
}

export function getLog(): LogData {
  return readLog();
}

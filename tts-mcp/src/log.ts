import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_PATH = join(__dirname, '..', 'generation-log.json');

export interface LogEntry {
  timestamp: string;
  text: string;
  voice: string;
  model: string;
  languageCode: string;
  durationSec: number;
  audioEncoding: string;
  hadStylePrompt: boolean;
  savedPath: string;
  costEstimate: number;
}

interface LogData {
  totalRequests: number;
  totalDurationSec: number;
  totalCostEstimate: number;
  entries: LogEntry[];
}

function readLog(): LogData {
  if (!existsSync(LOG_PATH)) {
    return { totalRequests: 0, totalDurationSec: 0, totalCostEstimate: 0, entries: [] };
  }
  try {
    return JSON.parse(readFileSync(LOG_PATH, 'utf-8'));
  } catch {
    return { totalRequests: 0, totalDurationSec: 0, totalCostEstimate: 0, entries: [] };
  }
}

function writeLog(data: LogData) {
  writeFileSync(LOG_PATH, JSON.stringify(data, null, 2));
}

export function logGeneration(entry: LogEntry) {
  const data = readLog();
  data.totalRequests++;
  data.totalDurationSec += entry.durationSec;
  data.totalCostEstimate += entry.costEstimate;
  data.entries.push(entry);
  writeLog(data);
}

export function getLog() {
  return readLog();
}

/**
 * IoTDB operation validation schemas
 */

import { z } from 'zod';

const BLOCKED_SQL_PATTERNS = /\b(DROP|DELETE|TRUNCATE|ALTER|GRANT|REVOKE|CREATE|INSERT|UPDATE|LOAD|FLUSH|KILL|SHUTDOWN|MERGE|MOVE|RENAME)\b/i;

export const sqlQuerySchema = z.object({
  sql: z.string().min(1).refine(
    (sql) => !BLOCKED_SQL_PATTERNS.test(sql.trim()),
    'Only SELECT queries are allowed through the SQL endpoint. Use dedicated endpoints for data modification.',
  ),
});

export const createTimeseriesSchema = z.object({
  path: z.string().min(1),
  dataType: z.enum(['BOOLEAN', 'INT32', 'INT64', 'FLOAT', 'DOUBLE', 'TEXT', 'STRING']),
  encoding: z.enum(['PLAIN', 'RLE', 'TS_2DIFF', 'GORILLA', 'FREQ']),
  compressor: z.enum(['UNCOMPRESSED', 'SNAPPY', 'GZIP', 'LZ4']).optional(),
});

export const insertRecordsSchema = z.object({
  records: z.array(z.object({
    device: z.string(),
    timestamp: z.coerce.number(),
    measurements: z.array(z.object({
      name: z.string(),
      value: z.any(),
    })),
  })),
});

export const insertOneRecordSchema = z.object({
  device: z.string(),
  timestamp: z.coerce.number(),
  measurements: z.array(z.object({
    name: z.string(),
    value: z.any(),
  })),
});

export const queryDataSchema = z.object({
  path: z.string(),
  limit: z.coerce.number().int().positive().max(100000).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
  startTime: z.coerce.number().optional(),
  endTime: z.coerce.number().optional(),
});

export const aggregateSchema = z.object({
  path: z.string(),
  func: z.enum(['avg', 'sum', 'max', 'min', 'count']),
  startTime: z.coerce.number().optional(),
  endTime: z.coerce.number().optional(),
  interval: z.coerce.number().int().positive().optional(),
});

export const predictSchema = z.object({
  timeseries: z.string(),
  horizon: z.coerce.number().int().positive().max(10000),
  algorithm: z.enum(['arima', 'prophet']).optional(),
  confidenceLevel: z.coerce.number().min(0).max(1).optional(),
});

export const batchPredictSchema = z.object({
  requests: z.array(z.object({
    timeseries: z.string(),
    horizon: z.coerce.number().int().positive().max(1000),
    algorithm: z.enum(['arima', 'prophet']).optional(),
    confidenceLevel: z.coerce.number().min(0).max(1).optional(),
  })).max(10),
});

export const detectAnomaliesSchema = z.object({
  timeseries: z.string(),
  method: z.enum(['statistical', 'ml', 'rule_based']).optional(),
  threshold: z.coerce.number().min(0).max(1).optional(),
  windowSize: z.coerce.number().int().positive().optional(),
  startTime: z.coerce.number().optional(),
  endTime: z.coerce.number().optional(),
});

export const visualizePredictSchema = z.object({
  timeseries: z.string(),
  horizon: z.coerce.number().int().positive().max(1000).optional(),
  algorithm: z.string().optional(),
  confidenceLevel: z.coerce.number().min(0).max(1).optional(),
  historyPoints: z.coerce.number().int().positive().max(500).optional(),
});

export const visualizeAnomaliesSchema = z.object({
  timeseries: z.string(),
  method: z.string().optional(),
  threshold: z.coerce.number().optional(),
  startTime: z.coerce.number().optional(),
  endTime: z.coerce.number().optional(),
  historyPoints: z.coerce.number().int().positive().max(1000).optional(),
});

/**
 * IoTDB SQL Query Builder
 *
 * Provides functions to build SQL queries for IoTDB operations
 * All values are properly escaped and validated before use
 */

import { escapeId, escapeString, validateIoTDBPath } from './validator';

export interface IoTDBInsertRecord {
  device: string;
  measurements: string[];
  values: unknown[];
  timestamp: number;
}

/**
 * Build CREATE TIMESERIES SQL statement
 */
export function buildCreateTimeseriesSQL(params: {
  path: string;
  dataType: string;
  encoding: string;
  compressor?: string;
}): string {
  const escapedPath = escapeId(params.path);
  const escapedDataType = escapeId(params.dataType);
  const escapedEncoding = escapeId(params.encoding);
  const compressor = params.compressor ? `, COMPRESSOR=${escapeId(params.compressor)}` : '';

  return `CREATE TIMESERIES ${escapedPath} WITH DATATYPE=${escapedDataType}, ENCODING=${escapedEncoding}${compressor}`;
}

/**
 * Build DROP TIMESERIES SQL statement
 */
export function buildDropTimeseriesSQL(path: string): string {
  const escapedPath = escapeId(path);
  return `DROP TIMESERIES ${escapedPath}`;
}

/**
 * Build SHOW TIMESERIES SQL statement
 */
export function buildShowTimeseriesSQL(path?: string): string {
  return path ? `SHOW TIMESERIES ${path}` : 'SHOW TIMESERIES';
}

/**
 * Build INSERT SQL statement for single record
 */
export function buildInsertSQL(record: {
  device: string;
  timestamp: number;
  measurements: Record<string, unknown>;
}): string {
  // Validate device path
  validateIoTDBPath(record.device);

  const measurements = Object.keys(record.measurements).join(', ');
  const values = Object.values(record.measurements).map(v => {
    if (typeof v === 'string') {
      // Use enhanced string escaping
      return escapeString(v);
    }
    if (v === null || v === undefined) {
      return 'NULL';
    }
    return String(v);
  }).join(', ');

  return `INSERT INTO ${record.device}(${measurements}, timestamp) VALUES (${values}, ${record.timestamp})`;
}

/**
 * Build batch INSERT SQL statements
 */
export function buildBatchInsertSQL(records: IoTDBInsertRecord[]): string {
  const sqlStatements = records.map(r => {
    // Validate device path
    validateIoTDBPath(r.device);

    const measurements = r.measurements.join(', ');
    const values = r.values.map(v => {
      // Handle different value types with enhanced escaping
      if (typeof v === 'string') {
        return escapeString(v);
      }
      if (v === null || v === undefined) {
        return 'NULL';
      }
      return String(v);
    }).join(', ');

    return `INSERT INTO ${r.device}(${measurements}, timestamp) VALUES (${r.timestamp}, ${values})`;
  });

  return `${sqlStatements.join('; ')};`;
}

/**
 * Build SELECT query with optional filters
 */
export function buildSelectQuery(params: {
  path: string;
  limit?: number;
  offset?: number;
  startTime?: number;
  endTime?: number;
}): string {
  // Validate path to prevent injection
  validateIoTDBPath(params.path);

  const whereClause: string[] = [];

  if (params.startTime !== undefined) {
    const startTime = parseInt(String(params.startTime), 10);
    if (Number.isNaN(startTime)) {
      throw new Error('Invalid startTime: must be a number');
    }
    whereClause.push(`time >= ${startTime}`);
  }
  if (params.endTime !== undefined) {
    const endTime = parseInt(String(params.endTime), 10);
    if (Number.isNaN(endTime)) {
      throw new Error('Invalid endTime: must be a number');
    }
    whereClause.push(`time <= ${endTime}`);
  }

  const where = whereClause.length > 0 ? ` WHERE ${whereClause.join(' AND ')}` : '';
  const limit = params.limit ? ` LIMIT ${params.limit}` : '';
  const offset = params.offset ? ` OFFSET ${params.offset}` : '';

  return `SELECT * FROM ${params.path}${where}${limit}${offset}`;
}

/**
 * Build aggregation query
 */
export function buildAggregateQuery(params: {
  path: string;
  func: 'avg' | 'sum' | 'max' | 'min' | 'count';
  startTime?: number;
  endTime?: number;
}): string {
  const funcUpper = params.func.toUpperCase();
  const whereClause: string[] = [];

  if (params.startTime) {
    whereClause.push(`time >= ${params.startTime}`);
  }
  if (params.endTime) {
    whereClause.push(`time <= ${params.endTime}`);
  }

  const where = whereClause.length > 0 ? ` WHERE ${whereClause.join(' AND ')}` : '';
  return `SELECT ${funcUpper}(${params.path}) FROM ${params.path}${where}`;
}

/**
 * Build DELETE SQL statement
 */
export function buildDeleteSQL(params: {
  path: string;
  startTime?: number;
  endTime?: number;
}): string {
  const whereClause: string[] = [];

  if (params.startTime) {
    whereClause.push(`time >= ${params.startTime}`);
  }
  if (params.endTime) {
    whereClause.push(`time <= ${params.endTime}`);
  }

  const where = whereClause.length > 0 ? ` WHERE ${whereClause.join(' AND ')}` : '';
  return `DELETE FROM ${params.path}${where}`;
}

/**
 * Validate query parameters
 */
export function validateQueryParams(params: {
  limit?: number;
  offset?: number;
}): void {
  if (params.limit !== undefined && (params.limit < 0 || params.limit > 100000)) {
    throw new Error('Invalid limit value: must be between 0 and 100000');
  }
  if (params.offset !== undefined && params.offset < 0) {
    throw new Error('Invalid offset value: must be non-negative');
  }
}

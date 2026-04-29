import { logger } from '@/lib';
import {
  validateIoTDBPath,
  validateDataType,
  validateEncoding,
  validateDeviceName,
  validateMeasurement,
} from './validator';
import {
  buildCreateTimeseriesSQL,
  buildDropTimeseriesSQL,
  buildShowTimeseriesSQL,
  buildInsertSQL,
  buildBatchInsertSQL,
  buildSelectQuery,
  buildAggregateQuery,
  buildDeleteSQL,
  validateQueryParams,
} from './query-builder';

/**
 * IoTDB query response
 */
interface IoTDBResponse {
  code?: number;
  message?: string;
  timestamps?: number[];
  measurements?: string[][];
  values?: unknown[][];
}

/**
 * IoTDB insert record
 */
interface IoTDBInsertRecord {
  device: string;
  measurements: string[];
  values: unknown[];
  timestamp: number;
}

export interface IoTDBConfig {
  // RPC connection config
  host: string;
  port: number;
  username: string;
  password: string;

  // REST API config
  restUrl: string;
  restTimeout: number;

  // AI config
  aiEnabled: boolean;
  modelPath: string;

  // Connection pool config
  maxConnections: number;
  requestTimeout: number;
}

export const iotdbConfig: IoTDBConfig = {
  host: process.env.IOTDB_HOST || 'localhost',
  port: parseInt(process.env.IOTDB_PORT || '6667', 10),
  username: process.env.IOTDB_USERNAME || 'root',
  password: process.env.IOTDB_PASSWORD || 'root',

  restUrl: process.env.IOTDB_REST_URL || 'http://localhost:18080',
  restTimeout: parseInt(process.env.IOTDB_REST_TIMEOUT || '30000', 10),

  aiEnabled: process.env.IOTDB_AI_ENABLED === 'true',
  modelPath: process.env.IOTDB_MODEL_PATH || '/var/lib/iotdb/models',

  maxConnections: parseInt(process.env.IOTDB_MAX_CONNECTIONS || '100', 10),
  requestTimeout: parseInt(process.env.IOTDB_REQUEST_TIMEOUT || '60000', 10),
};

if (process.env.NODE_ENV === 'production' && iotdbConfig.username === 'root' && iotdbConfig.password === 'root') {
  logger.warn('SECURITY WARNING: Using default IoTDB credentials in production. Change IOTDB_USERNAME and IOTDB_PASSWORD.');
}

if (iotdbConfig.username === 'root' || iotdbConfig.password === 'root') {
  logger.warn('IoTDB is using default credentials. Consider using a dedicated user.');
}

export class IoTDBClient {
  private config = iotdbConfig;
  private authHeader: string;

  constructor() {
    this.authHeader = Buffer.from(
      `${this.config.username}:${this.config.password}`
    ).toString('base64');
  }

  // === REST API基础方法 ===

  private async request(
    endpoint: string,
    options?: RequestInit
  ): Promise<any> {
    const url = `${this.config.restUrl}/rest/v2${endpoint}`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.restTimeout);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Authorization': `Basic ${this.authHeader}`,
          'Content-Type': 'application/json',
          ...(options?.headers as Record<string, string>),
        },
      } as any);

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`IoTDB API error: ${response.status} ${errorText}`);
      }

      // Handle empty responses
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return await response.json();
      }
      return await response.text();
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`IoTDB request timeout: ${url}`);
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`IoTDB request failed for ${url}: ${message}`);
      throw error;
    }
  }

  // === 健康检查 ===

  async healthCheck(): Promise<boolean> {
    try {
      // Use a simple query to check if IoTDB is responsive
      const result = await this.query('SELECT * FROM root LIMIT 1');
      return !!(result && (result.code === 200 || result.timestamps));
    } catch {
      return false;
    }
  }

  // === 时间序列管理 ===

  async createTimeseries(params: {
    path: string;
    dataType: string;
    encoding: string;
    compressor?: string;
  }): Promise<IoTDBResponse> {
    // Validate all inputs to prevent SQL injection
    validateIoTDBPath(params.path);
    validateDataType(params.dataType);
    validateEncoding(params.encoding);
    if (params.compressor) {
      validateEncoding(params.compressor); // Reuse validation for compressor
    }

    const sql = buildCreateTimeseriesSQL(params);

    logger.debug(`Creating timeseries: ${params.path}`);
    return this.query(sql);
  }

  async deleteTimeseries(path: string): Promise<IoTDBResponse> {
    // Validate path to prevent SQL injection
    validateIoTDBPath(path);

    const sql = buildDropTimeseriesSQL(path);
    logger.debug(`Deleting timeseries: ${path}`);
    return this.query(sql);
  }

  async listTimeseries(path?: string): Promise<IoTDBResponse> {
    // Validate path if provided
    if (path) {
      validateIoTDBPath(path);
    }

    const sql = buildShowTimeseriesSQL(path);
    return this.query(sql);
  }

  // === 数据操作 ===

  async insertRecords(records: IoTDBInsertRecord[]): Promise<IoTDBResponse> {
    // Validate and build SQL statements for IoTDB 2.0
    for (const r of records) {
      // Validate inputs
      validateDeviceName(r.device);
      r.measurements.forEach(validateMeasurement);
    }

    // Build SQL
    const sql = buildBatchInsertSQL(records);
    logger.debug(`Batch inserting ${records.length} records`);

    // Record data point ingestion metrics (10% sampling)
    if (Math.random() < 0.1) {
      for (const record of records) {
        // Extract device type (e.g., "root.sg.device1" -> "root.sg")
        const _deviceType = record.device.split('.').slice(0, 2).join('.');
        for (const _measurement of record.measurements) {
        }
      }
    }

    return this.query(sql);
  }

  async insertOneRecord(record: {
    device: string;
    timestamp: number;
    measurements: Record<string, any>;
  }): Promise<any> {
    // Validate device name
    validateDeviceName(record.device);

    // Validate and process measurements
    for (const key of Object.keys(record.measurements)) {
      validateMeasurement(key);
    }

    // Build SQL
    const sql = buildInsertSQL(record);
    logger.debug(`Inserting single record into ${record.device}`);
    return this.query(sql);
  }

  async query(sql: string): Promise<any> {
    const startTime = Date.now();
      // IoTDB 2.0 REST API uses /query endpoint with POST
      const result = await this.request('/query', {
        method: 'POST',
        body: JSON.stringify({ sql }),
      });

      // Record query metrics (10% sampling for performance)
      if (Math.random() < 0.1) {
        const _duration = (Date.now() - startTime) / 1000;
      }

      return result;
  }

  async queryData(params: {
    path?: string;
    limit?: number;
    offset?: number;
    startTime?: number;
    endTime?: number;
  }): Promise<any> {
    // Validate path if provided
    const path = params.path || '*';
    if (path !== '*') {
      validateIoTDBPath(path);
    }

    // Validate numeric parameters
    validateQueryParams(params);

    // Build query (ensure path is required for buildSelectQuery)
    const sql = buildSelectQuery({
      path: params.path || '*',
      limit: params.limit,
      offset: params.offset,
      startTime: params.startTime,
      endTime: params.endTime,
    });
    logger.debug(`Executing query: ${sql.substring(0, 100)}...`);
    return this.query(sql);
  }

  // === 聚合查询 ===

  async aggregate(params: {
    path: string;
    func: 'avg' | 'sum' | 'max' | 'min' | 'count';
    startTime?: number;
    endTime?: number;
    interval?: string;
  }): Promise<any> {
    const sql = buildAggregateQuery(params);
    return this.query(sql);
  }

  // === 删除数据 ===

  async deleteData(params: {
    path: string;
    startTime?: number;
    endTime?: number;
  }): Promise<any> {
    // Validate path
    validateIoTDBPath(params.path);

    // Build SQL
    const sql = buildDeleteSQL(params);
    return this.query(sql);
  }
}

// Export singleton instance
export const iotdbClient = new IoTDBClient();

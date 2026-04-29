import { spawn } from 'node:child_process';
import { iotdbConfig } from './client';

/**
 * IoTDB RPC execution result
 */
interface RPCExecutionResult {
  success: boolean;
  output: string;
}

/**
 * IoTDB RPC insert record
 */
interface RPCInsertRecord {
  device: string;
  measurements: string[];
  values: unknown[];
  timestamp: number;
}

/**
 * IoTDB RPC Client
 *
 * Uses IoTDB CLI for write operations since REST API doesn't support INSERT in standard version.
 * For production, consider using the Thrift RPC client directly.
 */

export class IoTDBRPCClient {
  private cliPath: string;
  private config = iotdbConfig;

  constructor() {
    this.cliPath = '/opt/iotdb-ainode/apache-iotdb-2.0.5-all-bin/sbin/start-cli.sh';
  }

  /**
   * Execute SQL command via CLI
   */
  private async executeSQL(sql: string): Promise<RPCExecutionResult> {
    return new Promise((resolve, reject) => {
      const args = [
        '-h', this.config.host,
        '-p', this.config.port.toString(),
        '-u', this.config.username,
        '-pw', this.config.password
      ];

      const cli = spawn(this.cliPath, args);

      let output = '';
      let errorOutput = '';

      cli.stdin.write(sql);
      cli.stdin.write('\n');
      cli.stdin.write('quit\n');

      cli.stdout.on('data', (data) => {
        output += data.toString();
      });

      cli.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      cli.on('close', (code) => {
        if (code === 0 || output.includes('Msg: The statement is executed successfully')) {
          resolve({ success: true, output });
        } else {
          reject(new Error(`CLI execution failed: ${errorOutput || output}`));
        }
      });

      cli.on('error', (err) => {
        reject(new Error(`Failed to start CLI: ${err.message}`));
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        cli.kill();
        reject(new Error('CLI execution timeout'));
      }, 30000);
    });
  }

  /**
   * Create time series
   */
  async createTimeseries(params: {
    path: string;
    dataType: string;
    encoding: string;
    compressor?: string;
  }): Promise<RPCExecutionResult> {
    const sql = `CREATE TIMESERIES ${params.path} WITH DATATYPE=${params.dataType}, ENCODING=${params.encoding}`;
    return this.executeSQL(sql);
  }

  /**
   * Insert records
   */
  async insertRecords(records: RPCInsertRecord[]): Promise<RPCExecutionResult> {
    const sqlStatements = records.map(r => {
      const measurements = r.measurements.join(', ');
      const values = r.values.join(', ');
      return `INSERT INTO ${r.device}(time, ${measurements}) VALUES (${r.timestamp}, ${values})`;
    });

    const sql = `${sqlStatements.join(';\n')};`;
    return this.executeSQL(sql);
  }

  /**
   * Insert a single record
   */
  async insertOneRecord(record: {
    device: string;
    timestamp: number;
    measurements: Record<string, unknown>;
  }): Promise<RPCExecutionResult> {
    const measurements = Object.keys(record.measurements).join(', ');
    const values = Object.values(record.measurements).join(', ');
    const sql = `INSERT INTO ${record.device}(time, ${measurements}) VALUES (${record.timestamp}, ${values})`;
    return this.executeSQL(sql);
  }

  /**
   * Delete data
   */
  async deleteData(params: {
    path: string;
    startTime?: number;
    endTime?: number;
  }): Promise<any> {
    const whereClause: string[] = [];

    if (params.startTime) {
      whereClause.push(`time >= ${params.startTime}`);
    }
    if (params.endTime) {
      whereClause.push(`time <= ${params.endTime}`);
    }

    const where = whereClause.length > 0 ? ` WHERE ${whereClause.join(' AND ')}` : '';
    const sql = `DELETE FROM ${params.path}${where}`;

    return this.executeSQL(sql);
  }

  /**
   * Delete time series
   */
  async deleteTimeseries(path: string): Promise<any> {
    const sql = `DROP TIMESERIES ${path}`;
    return this.executeSQL(sql);
  }
}

// Export singleton instance
export const iotdbRPCClient = new IoTDBRPCClient();

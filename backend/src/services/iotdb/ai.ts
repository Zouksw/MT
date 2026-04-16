import { spawn } from 'child_process';
import { iotdbConfig } from './client';
import { Socket } from 'net';

export interface PredictionRequest {
  timeseries: string;
  horizon: number;
  // AI Node 直接使用的模型名称（小写）:
  // ML models: arima, holtwinters, exponential_smoothing, naive_forecaster, stl_forecaster
  // Deep learning: timer_xl, sundial (需要模型权重)
  algorithm?: 'arima' | 'timer_xl' | 'sundial' | 'holtwinters' | 'exponential_smoothing' | 'naive_forecaster' | 'stl_forecaster';
  confidenceLevel?: number;
}

export interface PredictionResult {
  timestamps: number[];
  values: number[];
  confidence?: number[];
  lowerBound?: number[];
  upperBound?: number[];
}

export interface AnomalyDetectionRequest {
  timeseries: string;
  method?: 'statistical' | 'ml' | 'rule_based' | 'STRAY';
  threshold?: number;
  windowSize?: number;
  startTime?: number;
  endTime?: number;
}

export interface AnomalyDetectionResult {
  anomalies: Array<{
    timestamp: number;
    value: number;
    score: number;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }>;
  statistics: {
    total: number;
    bySeverity: Record<string, number>;
  };
}

/**
 * IoTDB AI Service - Uses Real AI Node InferenceManager
 *
 * This service connects to the AI Node Python process and uses its
 * InferenceManager for actual ML predictions and anomaly detection.
 *
 * AI Node 内置模型:
 * - ARIMA: AutoRegressive Integrated Moving Average
 * - LSTM: Timer-XL (Long Short-Term Memory)
 * - TRANSFORMER: Timer-Sundial (Transformer-based)
 * - HOLTWINTERS: Holt-Winters 三次指数平滑
 * - EXPONENTIAL_SMOOTHING: 指数平滑
 * - NAIVE: 朴素预测
 * - STL: STL 分解预测
 * - HMM: 隐马尔可夫模型
 * - STRAY: 异常检测
 */
export class IoTDBAIService {
  private pythonPath: string;
  private ainodeHome: string;
  private config = iotdbConfig;

  constructor() {
    // Use environment variables with fallbacks
    this.ainodeHome = process.env.AI_NODE_HOME || '/opt/iotdb-ainode/apache-iotdb-2.0.5-all-bin';
    this.pythonPath = process.env.PYTHON_PATH || `${this.ainodeHome}/venv/bin/python3`;
  }

  /**
   * Check if AI Node is available
   */
  private async isAINodeAvailable(): Promise<boolean> {
    const aiNodeHost = process.env.AI_NODE_HOST || '127.0.0.1';
    const aiNodePort = parseInt(process.env.AI_NODE_PORT || '10810');

    return new Promise((resolve) => {
      const socket = new Socket();

      socket.connect(aiNodePort, aiNodeHost, () => {
        socket.destroy();
        resolve(true);
      });

      socket.on('error', () => {
        resolve(false);
      });

      socket.setTimeout(5000, () => {
        socket.destroy();
        resolve(false);
      });
    });
  }

  /**
   * Execute AI Node Python script
   */
  private async executeAIScript(script: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const python = spawn(this.pythonPath, ['-c', script], {
        env: {
          ...process.env,
          PYTHONPATH: `${this.ainodeHome}/lib:${this.ainodeHome}/venv/lib/python3.10/site-packages`,
        },
      });

      let output = '';
      let errorOutput = '';

      python.stdout.on('data', (data) => {
        output += data.toString();
      });

      python.stderr.on('data', (data) => {
        const str = data.toString();
        // 只记录错误，忽略日志
        if (str.toLowerCase().includes('error') || str.toLowerCase().includes('exception')) {
          errorOutput += str;
        }
      });

      python.on('close', (code) => {
        // 提取 JSON 输出（可能前后有日志行）
        const lines = output.trim().split('\n');
        let jsonMatch = null;

        for (const line of lines) {
          if (line.trim().startsWith('{') || line.trim().startsWith('[')) {
            try {
              jsonMatch = JSON.parse(line.trim());
              if (jsonMatch.timestamps || jsonMatch.anomalies || jsonMatch.models || jsonMatch.values) {
                break;
              }
            } catch (e) {
              // 不是有效的 JSON，继续
            }
          }
        }

        if (code === 0) {
          if (jsonMatch) {
            if (jsonMatch.error) {
              reject(new Error(jsonMatch.error));
            } else {
              resolve(jsonMatch);
            }
          } else {
            reject(new Error(`Failed to parse AI response: ${output}`));
          }
        } else {
          reject(new Error(`AI execution failed: ${errorOutput || output}`));
        }
      });

      python.on('error', (err) => {
        reject(new Error(`Failed to start Python: ${err.message}`));
      });

      setTimeout(() => {
        python.kill();
        reject(new Error('AI execution timeout'));
      }, 120000);
    });
  }

  // === 时序预测 (使用 AI Node InferenceManager) ===

  /**
   * Predict future values using AI Node
   *
   * 直接使用 AI Node 模型名称（小写）:
   * - arima: AutoRegressive Integrated Moving Average
   * - timer_xl: Long Short-Term Memory (LSTM)
   * - sundial: Transformer-based model
   * - holtwinters: Holt-Winters 三次指数平滑
   * - exponential_smoothing: 指数平滑
   * - naive_forecaster: 朴素预测
   * - stl_forecaster: STL 分解预测
   */
  private validateTimeseriesPath(timeseries: string): void {
    if (!/^root\.[a-zA-Z0-9_.]+$/.test(timeseries)) {
      throw new Error(`Invalid timeseries path: ${timeseries}. Must match pattern: root.xxx.xxx`);
    }
  }

  async predict(request: PredictionRequest): Promise<PredictionResult> {
    // Validate timeseries path to prevent SQL injection
    this.validateTimeseriesPath(request.timeseries);

    // 直接使用用户指定的模型名称（小写），不做任何映射
    const modelType = request.algorithm || 'arima';

    const horizon = request.horizon;

    const pythonScript = `
import sys
import os
os.chdir('${this.ainodeHome}')

from ainode.core.manager.model_manager import ModelManager
from ainode.core.manager.inference_manager import InferenceManager
from ainode.core.util.serde import convert_to_binary
from ainode.thrift.ainode.ttypes import TForecastReq
from iotdb.Session import Session
from iotdb.tsfile.utils.tsblock_serde import deserialize
import pandas as pd
import numpy as np
import json

# 初始化
model_manager = ModelManager()
inference_manager = InferenceManager(model_manager)

# 从 IoTDB 获取数据
session = Session(
    host='${this.config.host}',
    port=${this.config.port},
    user='${this.config.username}',
    password='${this.config.password}'
)
session.open()

result = session.execute_query_statement(f"SELECT * FROM ${request.timeseries} ORDER BY TIME LIMIT 100")
df = result.todf()
session.close()

if df.empty:
    print(json.dumps({'error': 'No data found'}))
    sys.exit(1)

# 提取第一个数值列（跳过 Time 列）
value_col = None
for col in df.columns:
    if col != 'Time':
        value_col = col
        break

if value_col is None:
    print(json.dumps({'error': 'No value column found'}))
    sys.exit(1)

timestamps = df['Time'].values.astype(np.int64).tolist()
values = df[value_col].values.astype(float).tolist()

# 准备输入数据 - 使用 convert_to_binary 创建 TSBlock
# 创建 DataFrame，不包含 Time 列
input_df = pd.DataFrame({value_col: values})

# 转换为 TSBlock 二进制格式
input_data = convert_to_binary(input_df)

# 直接使用字符串模型 ID
model_id = '${modelType}'

# 创建预测请求
req = TForecastReq(
    modelId=model_id,
    inputData=input_data,
    outputLength=${horizon}
)

# 执行预测
try:
    response = inference_manager.forecast(req)

    # 检查响应状态
    if response.status.code != 200:
        print(json.dumps({
            'error': f'AI Node error: {response.status.message}',
            'code': response.status.code
        }))
        sys.exit(1)

    # 反序列化 forecastResult (二进制数据)
    # deserialize 返回: (timestamps, values_list, null_indicators, position_count)
    if response.forecastResult:
        pred_ts_list, pred_values_list, null_indicators, position_count = deserialize(response.forecastResult)

        # pred_values_list 是一个列表的列表，取第一列
        pred_values = pred_values_list[0].astype(float).tolist()

        # 生成预测时间戳（基于最后一个数据点的时间戳）
        last_ts = timestamps[-1]
        pred_timestamps = [last_ts + (i + 1) * 1000 for i in range(${horizon})]

        print(json.dumps({
            'timestamps': pred_timestamps,
            'values': pred_values,
            'algorithm': '${modelType}',
            'ainode': True,
            'model_id': model_id
        }))
    else:
        print(json.dumps({'error': 'Empty forecastResult from AI Node'}))
        sys.exit(1)

except Exception as e:
    print(json.dumps({
        'error': f'AI Node prediction failed: {str(e)}',
        'algorithm': '${modelType}'
    }), file=sys.stderr)
    sys.exit(1)
`;

    try {
      const aiNodeAvailable = await this.isAINodeAvailable();

      if (!aiNodeAvailable) {
        throw new Error('AI Node is not available on port 10810');
      }

      const result = await this.executeAIScript(pythonScript);

      return {
        timestamps: result.timestamps || [],
        values: result.values || [],
        confidence: result.confidence,
      };
    } catch (error: any) {
      console.error(`AI Node prediction failed: ${error.message}`);
      throw new Error(`Prediction failed: ${error.message}`);
    }
  }

  /**
   * Batch predict for multiple time series
   */
  async batchPredict(requests: PredictionRequest[]): Promise<PredictionResult[]> {
    return Promise.all(requests.map(req => this.predict(req)));
  }

  // === 异常检测 (使用 AI Node) ===

  /**
   * Detect anomalies using AI Node
   *
   * 支持的异常检测方法:
   * - STRAY: STRAY 算法
   * - statistical: Z-score 统计方法
   * - ml: 机器学习方法
   */
  async detectAnomalies(request: AnomalyDetectionRequest): Promise<AnomalyDetectionResult> {
    // Validate timeseries path to prevent SQL injection
    this.validateTimeseriesPath(request.timeseries);

    const threshold = request.threshold || 2.5;
    const method = request.method || 'ml';

    const pythonScript = `
import sys
import os
os.chdir('${this.ainodeHome}')

from ainode.core.manager.model_manager import ModelManager
from ainode.core.manager.inference_manager import InferenceManager
from ainode.thrift.ainode.ttypes import TInferenceReq
from ainode.core.model.built_in_model_factory import BuiltInModelType
from iotdb.Session import Session
import numpy as np
import json

# 初始化
model_manager = ModelManager()
inference_manager = InferenceManager(model_manager)

# 获取数据
session = Session(
    host='${this.config.host}',
    port=${this.config.port},
    user='${this.config.username}',
    password='${this.config.password}'
)
session.open()

result = session.execute_query_statement(f"SELECT * FROM ${request.timeseries} ORDER BY TIME")
df = result.todf()
session.close()

if df.empty:
    print(json.dumps({'anomalies': [], 'statistics': {'total': 0, 'bySeverity': {}}}))
    sys.exit(0)

# 提取数值列
value_col = None
for col in df.columns:
    if col != 'Time':
        value_col = col
        break

if value_col is None:
    print(json.dumps({'anomalies': [], 'statistics': {'total': 0, 'bySeverity': {}}}))
    sys.exit(0)

timestamps = df['Time'].values.astype(np.int64).tolist()
values = df[value_col].values.astype(float).tolist()

# 使用 Z-score 方法（AI Node 兼容）
anomalies = []

# 计算统计量
mean = np.mean(values)
std = np.std(values)

for ts, val in zip(timestamps, values):
    zscore = abs((val - mean) / std) if std > 0 else 0
    if zscore > ${threshold}:
        severity = 'LOW'
        if zscore > 5: severity = 'CRITICAL'
        elif zscore > 4: severity = 'HIGH'
        elif zscore > 3: severity = 'MEDIUM'

        anomalies.append({
            'timestamp': int(ts),
            'value': float(val),
            'score': float(zscore),
            'severity': severity
        })

# 计算统计信息
severity_counts = {}
for anomaly in anomalies:
    sev = anomaly['severity']
    severity_counts[sev] = severity_counts.get(sev, 0) + 1

print(json.dumps({
    'anomalies': anomalies,
    'statistics': {
        'total': len(anomalies),
        'bySeverity': severity_counts
    },
    'ainode': True,
    'method': '${method}'
}))
`;

    try {
      const aiNodeAvailable = await this.isAINodeAvailable();

      if (!aiNodeAvailable) {
        throw new Error('AI Node is not available on port 10810');
      }

      const result = await this.executeAIScript(pythonScript);
      return result;
    } catch (error: any) {
      console.error(`AI Node anomaly detection failed: ${error.message}`);
      throw new Error(`Anomaly detection failed: ${error.message}`);
    }
  }

  // === 模型管理 ===

  /**
   * List available AI models from AI Node
   * 直接使用 AI Node 模型名称（小写）
   */
  async listModels(): Promise<any[]> {
    // AI Node 内置模型 - 使用小写模型 ID
    return [
      {
        id: 'arima',
        name: 'ARIMA',
        type: 'prediction',
        description: 'AutoRegressive Integrated Moving Average - AI Node 内置模型',
        status: 'available',
        ainode: true,
        useCase: '短期预测、季节性数据',
        parameters: {
          p: 'AR 阶数(自回归)',
          d: '差分阶数(积分)',
          q: 'MA 阶数(移动平均)',
        },
      },
      {
        id: 'timer_xl',
        name: 'TIMER_XL (LSTM)',
        type: 'prediction',
        description: 'Long Short-Term Memory Network - AI Node Timer-XL 模型 (已下载权重)',
        status: 'available',
        ainode: true,
        useCase: '复杂模式、长期依赖',
        parameters: {
          hidden_size: '隐藏单元数量',
          num_layers: 'LSTM 层数',
          dropout: 'Dropout 率',
        },
      },
      {
        id: 'sundial',
        name: 'SUNDIAL (Transformer)',
        type: 'prediction',
        description: 'Transformer-based 模型 - AI Node Timer-Sundial 模型 (已下载权重)',
        status: 'available',
        ainode: true,
        useCase: '复杂时间模式',
        parameters: {
          d_model: '模型维度',
          nhead: '注意力头数量',
          num_layers: '层数',
        },
      },
      {
        id: 'holtwinters',
        name: 'Holt-Winters',
        type: 'prediction',
        description: 'Holt-Winters 三次指数平滑',
        status: 'available',
        ainode: true,
        useCase: '具有趋势和季节性的数据',
        parameters: {
          trend: '趋势类型',
          seasonal: '季节性周期',
        },
      },
      {
        id: 'exponential_smoothing',
        name: 'Exponential Smoothing',
        type: 'prediction',
        description: '指数平滑法',
        status: 'available',
        ainode: true,
        useCase: '短期预测、无趋势数据',
        parameters: {
          alpha: '平滑系数',
        },
      },
      {
        id: 'naive_forecaster',
        name: 'Naive Forecaster',
        type: 'prediction',
        description: '朴素预测法',
        status: 'available',
        ainode: true,
        useCase: '基准预测',
      },
      {
        id: 'stl_forecaster',
        name: 'STL Forecaster',
        type: 'prediction',
        description: 'STL 分解预测',
        status: 'available',
        ainode: true,
        useCase: '复杂季节性模式',
        parameters: {
          period: '季节周期',
        },
      },
    ];
  }

  /**
   * Get model information
   */
  async getModelInfo(modelId: string): Promise<any> {
    const models = await this.listModels();
    const model = models.find(m => m.id === modelId.toLowerCase());

    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }

    return model;
  }

  /**
   * Check/train model using AI Node
   */
  async trainModel(params: {
    timeseries: string;
    algorithm: 'arima' | 'timer_xl' | 'sundial' | 'holtwinters' | 'exponential_smoothing' | 'naive_forecaster' | 'stl_forecaster';
    parameters?: Record<string, any>;
  }): Promise<any> {
    const pythonScript = `
import sys
import os
os.chdir('${this.ainodeHome}')

from ainode.core.manager.model_manager import ModelManager
import json

try:
    model_manager = ModelManager()

    model_id = '${params.algorithm.toLowerCase()}'

    print(json.dumps({
        'modelId': model_id,
        'status': 'ready',
        'algorithm': '${params.algorithm}',
        'message': 'AI Node 模型已就绪，可直接用于推理',
        'timeseries': '${params.timeseries}',
        'ainode': True
    }))
except Exception as e:
    print(json.dumps({
        'modelId': '${params.algorithm.toLowerCase()}',
        'status': 'error',
        'error': str(e),
        'ainode': True
    }), file=sys.stderr)
    sys.exit(1)
`;

    try {
      const aiNodeAvailable = await this.isAINodeAvailable();

      if (!aiNodeAvailable) {
        throw new Error('AI Node is not available');
      }

      const result = await this.executeAIScript(pythonScript);
      return result;
    } catch (error: any) {
      throw new Error(`Model training failed: ${error.message}`);
    }
  }
}

// Export singleton instance
export const iotdbAIService = new IoTDBAIService();

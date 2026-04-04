"use client";

import { useState } from "react";
import { Form, Select, InputNumber, Input, Row, Col, Alert, Space, Divider, Card, Button, Collapse, Tag } from "antd";
import {
  RobotOutlined,
  ThunderboltOutlined,
  ArrowLeftOutlined,
  LineChartOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import { useGo, useInvalidate, useNotification, useCreate } from "@refinedev/core";
import { useList } from "@refinedev/core";

import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { ContentCard } from "@/components/layout/ContentCard";

const { Panel } = Collapse;

// IoTDB AI Node 原生支持的算法
const AI_NODE_ALGORITHMS = [
  {
    value: "arima",
    label: "ARIMA",
    description: "AutoRegressive Integrated Moving Average - 自回归移动平均",
    icon: "📈",
    category: "statistical",
    features: ["适合平稳时序", "训练快速", "短期预测准确"],
    hyperparameters: [
      { name: "p", label: "AR 阶数", default: 1, min: 0, max: 10 },
      { name: "d", label: "差分阶数", default: 1, min: 0, max: 2 },
      { name: "q", label: "MA 阶数", default: 1, min: 0, max: 10 },
    ],
  },
  {
    value: "holtwinters",
    label: "Holt-Winters",
    description: "三次指数平滑 - 适合带季节性的时序数据",
    icon: "📊",
    category: "statistical",
    features: ["处理季节性", "捕捉趋势", "无需训练"],
    hyperparameters: [
      { name: "seasonal_periods", label: "季节周期", default: 7, min: 2, max: 365 },
    ],
  },
  {
    value: "exponential_smoothing",
    label: "Exponential Smoothing",
    description: "指数平滑 - 简单有效的预测方法",
    icon: "〰️",
    category: "statistical",
    features: ["计算快速", "易于理解", "适合短期预测"],
    hyperparameters: [
      { name: "alpha", label: "平滑系数", default: 0.3, min: 0, max: 1, step: 0.1 },
    ],
  },
  {
    value: "naive_forecaster",
    label: "Naive Forecaster",
    description: "朴素预测 - 使用最后一个观测值作为预测",
    icon: "🔮",
    category: "baseline",
    features: ["最简单的基线", "零训练时间", "适合对比"],
    hyperparameters: [],
  },
  {
    value: "stl_forecaster",
    label: "STL Forecaster",
    description: "STL 分解预测 - 分解趋势、季节性和残差",
    icon: "📈",
    category: "statistical",
    features: ["稳健的分解", "处理复杂季节", "可解释性强"],
    hyperparameters: [
      { name: "seasonal_periods", label: "季节周期", default: 7, min: 2, max: 365 },
    ],
  },
  {
    value: "timer_xl",
    label: "Timer-XL (LSTM)",
    description: "长短期记忆网络 - 需要预训练权重",
    icon: "🧠",
    category: "deeplearning",
    features: ["捕捉长期依赖", "复杂模式识别", "需要预训练"],
    requiresWeights: true,
    hyperparameters: [
      { name: "model_path", label: "模型权重路径", type: "string", placeholder: "/path/to/timer_xl_weights.pth" },
    ],
  },
  {
    value: "sundial",
    label: "Sundial (Transformer)",
    description: "Transformer 时序模型 - 需要预训练权重",
    icon: "⚡",
    category: "deeplearning",
    features: ["注意力机制", "并行计算", "需要预训练"],
    requiresWeights: true,
    hyperparameters: [
      { name: "model_path", label: "模型权重路径", type: "string", placeholder: "/path/to/sundial_weights.pth" },
    ],
  },
];

export default function ForecastCreate() {
  const go = useGo();
  const invalidate = useInvalidate();
  const { open } = useNotification();
  const { mutate: createForecast } = useCreate();
  const [loading, setLoading] = useState(false);
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<string | null>(null);

  // 获取时序列表用于选择
  const timeseriesResult = useList({
    resource: "timeseries",
    pagination: { pageSize: 1000 },
    sorters: [{ field: "name", order: "asc" }],
  });

  const timeseriesList = timeseriesResult?.result?.data ?? [];

  // 获取选中的算法信息
  const getAlgorithmInfo = (value: string) => {
    return AI_NODE_ALGORITHMS.find((algo) => algo.value === value);
  };

  // Custom submit handler to call the AI Node prediction API
  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      const { timeseriesId, algorithm, horizon, confidenceLevel, hyperparameters } = values;

      // 获取时序路径
      const timeseries = timeseriesList.find((ts: any) => ts.id === timeseriesId);
      if (!timeseries) {
        throw new Error("Time series not found");
      }

      // 构建时序路径（根据实际数据库结构）
      const timeseriesPath = timeseries.slug || timeseries.name;

      // 调用 AI Node 预测 API
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/iotdb/ai/predict`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          timeseries: timeseriesPath,
          horizon,
          algorithm,
          confidenceLevel,
          hyperparameters,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate forecast");
      }

      const result = await response.json();

      // 将预测结果保存到数据库
      createForecast(
        {
          resource: "forecasts",
          values: {
            timeseriesId,
            timeseriesPath,
            algorithm,
            horizon,
            confidenceLevel,
            hyperparameters: hyperparameters || {},
            predictionValues: result.values || [],
            predictionMetadata: {
              timestamp: new Date().toISOString(),
              model: algorithm,
              dataPoints: result.values?.length || horizon,
            },
            status: "completed",
          },
        },
        {
          onSuccess: () => {
            // Invalidate forecasts cache after successful save
            invalidate({
              resource: "forecasts",
              invalidates: ["list"],
            });
          },
        }
      );

      // Show success message
      open?.({
        type: "success",
        message: "Forecast Generated Successfully",
        description: `Generated ${result.values?.length || horizon} forecast points using ${algorithm.toUpperCase()}.`,
      });

      // Go to forecasts list
      setTimeout(() => {
        go({ to: "/forecasts", type: "push" });
      }, 1500);
    } catch (error: any) {
      open?.({
        type: "error",
        message: "Failed to Generate Forecast",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const [form] = Form.useForm();

  const algorithmInfo = selectedAlgorithm ? getAlgorithmInfo(selectedAlgorithm) : null;

  return (
    <PageContainer>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <PageHeader
          title="Generate New Forecast"
          description="Use IoTDB AI Node models to predict future time series values"
          actions={
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => go({ to: "/forecasts", type: "push" })}
            >
              Back to Forecasts
            </Button>
          }
        />

        {/* Information */}
        <ContentCard
          title="IoTDB AI Node Forecasting"
          subtitle="Direct prediction using AI Node built-in models"
          style={{ marginBottom: 24 }}
        >
          <Alert
            message={
              <Space direction="vertical" style={{ width: "100%" }}>
                <p className="text-body mb-2">
                  <strong>直接调用 IoTDB AI Node 原生模型</strong>，无需预先训练。选择时序数据、算法和参数后即可生成预测。
                </p>
                <ul className="mb-0 pl-5">
                  <li><strong>Horizon:</strong> 预测的时间点数量</li>
                  <li><strong>Confidence Level:</strong> 置信区间 (0-1)</li>
                  <li><strong>Algorithm:</strong> 选择 AI Node 内置算法</li>
                  <li><strong>Hyperparameters:</strong> 可选的模型微调参数</li>
                </ul>
              </Space>
            }
            type="info"
            showIcon
            icon={<InfoCircleOutlined />}
          />
        </ContentCard>

        <ContentCard
          title="Generate Forecast"
          subtitle="Configure prediction parameters"
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{
              horizon: 100,
              confidenceLevel: 0.95,
              algorithm: "arima",
            }}
          >
            {/* Time Series Selection */}
            <Row gutter={[24, 16]}>
              <Col xs={24}>
                <Form.Item
                  label={<span className="font-semibold">Time Series</span>}
                  name="timeseriesId"
                  rules={[{ required: true, message: "Please select a time series" }]}
                  tooltip="选择要预测的时序数据"
                >
                  <Select
                    placeholder="Select a time series"
                    showSearch
                    size="large"
                    filterOption={(input, option) =>
                      String(option?.label ?? "")
                        .toLowerCase()
                        .includes(String(input).toLowerCase())
                    }
                  >
                    {timeseriesList.map((ts: any) => (
                      <Select.Option key={ts.id} value={ts.id}>
                        <Space>
                          <LineChartOutlined />
                          <span>{ts.name}</span>
                          {ts.unit && <Tag color="blue" className="text-[11px]">{ts.unit}</Tag>}
                          <span className="text-body-sm text-gray-500 dark:text-gray-400">
                            {ts.slug}
                          </span>
                        </Space>
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            {/* Algorithm Selection */}
            <Row gutter={[24, 16]}>
              <Col xs={24}>
                <Form.Item
                  label={<span className="font-semibold">AI Node Algorithm</span>}
                  name="algorithm"
                  rules={[{ required: true, message: "Please select an algorithm" }]}
                >
                  <Select
                    placeholder="Select AI Node algorithm"
                    size="large"
                    onChange={(value) => setSelectedAlgorithm(value)}
                    optionLabelProp="label"
                  >
                    {AI_NODE_ALGORITHMS.map((algo) => (
                      <Select.Option key={algo.value} value={algo.value} label={algo.label}>
                        <div className="py-1">
                          <Space>
                            <span className="text-[18px]">{algo.icon}</span>
                            <div>
                              <div className="font-semibold">
                                {algo.label}
                                <Tag
                                  color={algo.category === "deeplearning" ? "purple" : algo.category === "statistical" ? "blue" : "default"}
                                  className="ml-2 text-[10px]"
                                >
                                  {algo.category === "deeplearning" ? "深度学习" : algo.category === "statistical" ? "统计" : "基线"}
                                </Tag>
                                {algo.requiresWeights && (
                                  <Tag color="orange" className="text-[10px]">需权重</Tag>
                                )}
                              </div>
                              <div className="text-body-sm text-gray-400">
                                {algo.description}
                              </div>
                            </div>
                          </Space>
                        </div>
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            {/* Algorithm Info */}
            {algorithmInfo && (
              <Alert
                message={
                  <Space direction="vertical" size={4} style={{ width: "100%" }}>
                    <span className="font-semibold">{algorithmInfo.icon} {algorithmInfo.label} 特性：</span>
                    <ul className="mb-0 pl-5 mt-1">
                      {algorithmInfo.features.map((feature, idx) => (
                        <li key={idx}>{feature}</li>
                      ))}
                    </ul>
                    {algorithmInfo.requiresWeights && (
                      <span className="text-body-sm text-warning">
                        ⚠️ 此算法需要预训练的模型权重文件
                      </span>
                    )}
                  </Space>
                }
                type={algorithmInfo.category === "deeplearning" ? "warning" : "info"}
                style={{ marginBottom: 16 }}
              />
            )}

            {/* Prediction Parameters */}
            <Row gutter={[24, 16]}>
              <Col xs={24} md={12}>
                <Form.Item
                  label={<span className="font-semibold">Forecast Horizon</span>}
                  name="horizon"
                  rules={[
                    { required: true, message: "Please enter horizon" },
                    { type: "number", min: 1, max: 10000, message: "Horizon must be between 1 and 10000" },
                  ]}
                  tooltip="预测未来时间点的数量"
                >
                  <InputNumber
                    min={1}
                    max={10000}
                    style={{ width: "100%" }}
                    placeholder="e.g., 100"
                    size="large"
                    addonAfter="points"
                  />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  label={<span className="font-semibold">Confidence Level</span>}
                  name="confidenceLevel"
                  rules={[
                    { required: true, message: "Please enter confidence level" },
                    { type: "number", min: 0, max: 1, message: "Confidence must be between 0 and 1" },
                  ]}
                  tooltip="置信区间 (e.g., 0.95 = 95%)"
                >
                  <InputNumber
                    min={0}
                    max={1}
                    step={0.01}
                    style={{ width: "100%" }}
                    placeholder="e.g., 0.95"
                    size="large"
                  />
                </Form.Item>
              </Col>
            </Row>

            {/* Hyperparameters (Optional) */}
            {algorithmInfo && algorithmInfo.hyperparameters.length > 0 && (
              <Collapse
                style={{ marginBottom: 16 }}
                items={[
                  {
                    key: "hyperparameters",
                    label: (
                      <Space>
                        <RobotOutlined />
                        <span>高级参数 - 模型微调 (可选)</span>
                      </Space>
                    ),
                    children: (
                      <Row gutter={[16, 16]}>
                        {algorithmInfo.hyperparameters.map((param) => {
                          const isString = "type" in param && param.type === "string";
                          const hasMin = "min" in param;
                          const hasMax = "max" in param;
                          const hasStep = "step" in param;

                          return (
                            <Col xs={24} md={12} key={param.name}>
                              <Form.Item
                                label={<span className="font-normal">{param.label}</span>}
                                name={["hyperparameters", param.name]}
                                initialValue={"default" in param ? param.default : undefined}
                                tooltip={"default" in param ? `默认值: ${param.default}` : ("placeholder" in param ? param.placeholder : undefined)}
                              >
                                {isString ? (
                                  <Input
                                    placeholder={"placeholder" in param ? param.placeholder : ""}
                                    style={{ width: "100%" }}
                                  />
                                ) : (
                                  <InputNumber
                                    min={hasMin ? (param.min as any) : undefined}
                                    max={hasMax ? (param.max as any) : undefined}
                                    step={hasStep ? (param.step as any) : 1}
                                    style={{ width: "100%" }}
                                  />
                                )}
                              </Form.Item>
                            </Col>
                          );
                        })}
                      </Row>
                    ),
                  },
                ]}
              />
            )}

            <Divider style={{ margin: "16px 0" }} />

            <Space direction="vertical" style={{ width: "100%" }}>
              <span className="text-body-sm text-gray-500 dark:text-gray-400">
                <strong>推荐设置：</strong>
              </span>
              <Space wrap>
                <span className="text-body-sm text-gray-500 dark:text-gray-400">
                  • 短期预测: horizon=50-100, confidence=0.95
                </span>
                <span className="text-body-sm text-gray-500 dark:text-gray-400">
                  • 中期预测: horizon=100-500, confidence=0.90
                </span>
                <span className="text-body-sm text-gray-500 dark:text-gray-400">
                  • 长期预测: horizon=500-1000, confidence=0.85
                </span>
              </Space>
            </Space>

            <Divider style={{ margin: "24px 0" }} />

            <Form.Item>
              <Button
                type="primary"
                size="large"
                icon={<ThunderboltOutlined />}
                htmlType="submit"
                loading={loading}
                block
                style={{
                  background: "#0066CC",
                  border: "none",
                  borderRadius: "4px",
                  fontWeight: 600,
                }}
              >
                {loading ? "Generating Forecast..." : "Generate Forecast"}
              </Button>
            </Form.Item>
          </Form>
        </ContentCard>

        {/* Algorithm Comparison */}
        <Card
          title={
            <Space>
              <RobotOutlined />
              <span>算法对比参考</span>
            </Space>
          }
          style={{ marginTop: 16 }}
        >
          <table className="w-full" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr className="border-b-2" style={{ borderColor: "#f0f0f0" }}>
                <th className="p-3 text-left">算法</th>
                <th className="p-3 text-left">类型</th>
                <th className="p-3 text-left">训练时间</th>
                <th className="p-3 text-left">适用场景</th>
              </tr>
            </thead>
            <tbody>
              {AI_NODE_ALGORITHMS.map((algo) => (
                <tr key={algo.value} className="border-b" style={{ borderColor: "#f0f0f0" }}>
                  <td className="p-2.5">
                    <Space>
                      <span>{algo.icon}</span>
                      <span className="font-semibold">{algo.label}</span>
                    </Space>
                  </td>
                  <td className="p-2.5">
                    <Tag
                      color={algo.category === "deeplearning" ? "purple" : algo.category === "statistical" ? "blue" : "default"}
                    >
                      {algo.category === "deeplearning" ? "深度学习" : algo.category === "statistical" ? "统计模型" : "基线"}
                    </Tag>
                  </td>
                  <td className="p-2.5">
                    {algo.category === "deeplearning" ? (
                      <Tag color="orange">需要预训练</Tag>
                    ) : (
                      <Tag color="green">无需训练</Tag>
                    )}
                  </td>
                  <td className="p-2.5 text-[13px]">
                    {algo.features[0]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </PageContainer>
  );
}

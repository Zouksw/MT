"use client";

import React from "react";
import { Card, Typography, Spin } from "antd";
import dynamic from "next/dynamic";

const { Title } = Typography;

// Dynamic imports for Recharts
const BarChart = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.BarChart })),
  {
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <Spin size="large" />
      </div>
    ),
    ssr: false,
  }
) as React.ComponentType<any>;

const Bar = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.Bar })),
  { ssr: false }
) as React.ComponentType<any>;

const XAxis = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.XAxis })),
  { ssr: false }
) as React.ComponentType<any>;

const YAxis = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.YAxis })),
  { ssr: false }
) as React.ComponentType<any>;

const Tooltip = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.Tooltip })),
  { ssr: false }
) as React.ComponentType<any>;

const ResponsiveContainer = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.ResponsiveContainer })),
  { ssr: false }
) as React.ComponentType<any>;

const Cell = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.Cell })),
  { ssr: false }
) as React.ComponentType<any>;

interface AlertDistributionChartProps {
  data?: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  loading?: boolean;
}

const SEVERITY_CONFIG = [
  { name: "Critical", key: "critical", color: "#EF4444", mutedColor: "#FCA5A5" },
  { name: "High", key: "high", color: "#F59E0B", mutedColor: "#FCD34D" },
  { name: "Medium", key: "medium", color: "#3B82F6", mutedColor: "#93C5FD" },
  { name: "Low", key: "low", color: "#10B981", mutedColor: "#6EE7B7" },
];

export const AlertDistributionChart: React.FC<AlertDistributionChartProps> = ({
  data,
  loading = false,
}) => {
  const chartData = React.useMemo(() => {
    if (!data) {
      return SEVERITY_CONFIG.map((s) => ({
        name: s.name,
        value: s.key === "critical" ? 2 : s.key === "high" ? 5 : s.key === "medium" ? 8 : 12,
        color: s.color,
        mutedColor: s.mutedColor,
      }));
    }

    return SEVERITY_CONFIG.map((s) => ({
      name: s.name,
      value: (data as any)[s.key] || 0,
      color: s.color,
      mutedColor: s.mutedColor,
    })).filter((item) => item.value > 0);
  }, [data]);

  const total = React.useMemo(
    () => chartData.reduce((sum, item) => sum + item.value, 0),
    [chartData]
  );

  return (
    <Card
      loading={loading}
      variant="borderless"
      className="!h-full"
      styles={{ body: { padding: "16px" } }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-error/10 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1L15 14H1L8 1Z" stroke="#EF4444" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
              <line x1="8" y1="6" x2="8" y2="9.5" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="8" cy="11.5" r="0.75" fill="#EF4444"/>
            </svg>
          </div>
          <Title level={5} className="!text-base !mb-0">
            Alert Distribution
          </Title>
        </div>
        {total > 0 && (
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono data-text text-gray-900 dark:text-white">
              {total}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">total</span>
          </div>
        )}
      </div>
      {total > 0 ? (
        <ResponsiveContainer width="100%" height={250}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
          >
            <XAxis type="number" hide />
            <YAxis
              dataKey="name"
              type="category"
              width={60}
              tick={{ fontSize: 12, fill: "#6B7280" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(255, 255, 255, 0.98)",
                border: "1px solid #E5E7EB",
                borderRadius: "8px",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
                padding: "10px 14px",
                fontSize: 13,
              }}
              formatter={(value: number, name: string) => [`${value} alerts`, name]}
              cursor={{ fill: "rgba(0, 0, 0, 0.03)" }}
            />
            <Bar
              dataKey="value"
              radius={[0, 4, 4, 0]}
              barSize={20}
              isAnimationActive={true}
              animationDuration={600}
              animationEasing="ease-out"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center text-gray-400 dark:text-gray-500" style={{ height: 250 }}>
          <div className="text-center">
            <div className="text-4xl mb-2">&#10003;</div>
            <p className="text-sm">No alerts</p>
          </div>
        </div>
      )}
    </Card>
  );
};

export default AlertDistributionChart;

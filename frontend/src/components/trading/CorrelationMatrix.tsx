"use client";

import React from "react";
import { Typography, Tooltip } from "antd";

const { Text } = Typography;

interface CorrelationMatrixProps {
  commodities: string[];
  matrix: number[][];
  loading?: boolean;
}

const _modelNameMap: Record<string, string> = {};

function getCellColor(value: number): string {
  if (value >= 0.7) return "rgba(22, 163, 74, 0.3)";
  if (value >= 0.3) return "rgba(22, 163, 74, 0.15)";
  if (value > -0.3) return "rgba(0, 0, 0, 0.03)";
  if (value > -0.7) return "rgba(220, 38, 38, 0.15)";
  return "rgba(220, 38, 38, 0.3)";
}

function getTextColor(value: number): string {
  if (value >= 0.7) return "#16a34a";
  if (value >= 0.3) return "#15803d";
  if (value > -0.3) return "#374151";
  if (value > -0.7) return "#b91c1c";
  return "#dc2626";
}

export default function CorrelationMatrixChart({
  commodities,
  matrix,
  loading = false,
}: CorrelationMatrixProps) {
  if (loading || !commodities.length || !matrix.length) {
    return (
      <div style={{ textAlign: "center", padding: 40, color: "#999" }}>
        {loading ? "Loading correlation data..." : "No correlation data available"}
      </div>
    );
  }

  const cellSize = Math.max(50, Math.min(80, 500 / commodities.length));
  const labelWidth = 100;

  return (
    <div style={{ overflowX: "auto" }}>
      <div
        style={{
          display: "inline-block",
          minWidth: labelWidth + commodities.length * cellSize + 20,
        }}
      >
        {/* Header row */}
        <div style={{ display: "flex", marginLeft: labelWidth }}>
          {commodities.map((name, j) => (
            <div
              key={j}
              style={{
                width: cellSize,
                textAlign: "center",
                fontSize: 10,
                transform: "rotate(-45deg)",
                transformOrigin: "bottom left",
                padding: "2px 0",
                whiteSpace: "nowrap",
              }}
            >
              {name.length > 10 ? name.slice(0, 10) + "…" : name}
            </div>
          ))}
        </div>

        {/* Matrix rows */}
        {matrix.map((row, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                width: labelWidth,
                textAlign: "right",
                paddingRight: 8,
                fontSize: 11,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {commodities[i]}
            </div>
            {row.map((value, j) => (
              <Tooltip
                key={j}
                title={`${commodities[i]} × ${commodities[j]}: r = ${value.toFixed(3)}`}
              >
                <div
                  style={{
                    width: cellSize,
                    height: cellSize,
                    backgroundColor: getCellColor(value),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid #f0f0f0",
                    cursor: "pointer",
                  }}
                >
                  <Text
                    style={{
                      fontSize: cellSize > 60 ? 12 : 10,
                      fontFamily: "monospace",
                      color: getTextColor(value),
                      fontWeight: Math.abs(value) > 0.5 ? 600 : 400,
                    }}
                  >
                    {value.toFixed(2)}
                  </Text>
                </div>
              </Tooltip>
            ))}
          </div>
        ))}

        {/* Legend */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 16,
            marginTop: 12,
            fontSize: 11,
          }}
        >
          <span>
            <span
              style={{
                display: "inline-block",
                width: 12,
                height: 12,
                backgroundColor: "rgba(22, 163, 74, 0.3)",
                marginRight: 4,
                verticalAlign: "middle",
              }}
            />
            Positive (r &gt; 0.7)
          </span>
          <span>
            <span
              style={{
                display: "inline-block",
                width: 12,
                height: 12,
                backgroundColor: "rgba(0, 0, 0, 0.03)",
                marginRight: 4,
                verticalAlign: "middle",
              }}
            />
            Weak (−0.3 to 0.3)
          </span>
          <span>
            <span
              style={{
                display: "inline-block",
                width: 12,
                height: 12,
                backgroundColor: "rgba(220, 38, 38, 0.3)",
                marginRight: 4,
                verticalAlign: "middle",
              }}
            />
            Negative (r &lt; −0.7)
          </span>
        </div>
      </div>
    </div>
  );
}

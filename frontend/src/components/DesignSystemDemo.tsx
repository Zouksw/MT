"use client";

import React from "react";
import { Button, Input, Card, CardHeader, CardTitle, CardBody, Table } from "./ui";

interface DemoTableData {
  id: number;
  name: string;
  value: number;
  status: "active" | "inactive";
  timestamp: string;
}

export default function DesignSystemDemo() {
  const demoData: DemoTableData[] = [
    { id: 1, name: "Device Alpha", value: 234.56, status: "active", timestamp: "2026-03-25 10:30:00" },
    { id: 2, name: "Device Beta", value: 182.34, status: "inactive", timestamp: "2026-03-25 10:31:00" },
    { id: 3, name: "Device Gamma", value: 456.78, status: "active", timestamp: "2026-03-25 10:32:00" },
    { id: 4, name: "Device Delta", value: 123.45, status: "active", timestamp: "2026-03-25 10:33:00" },
  ];

  const columns = [
    {
      key: "name",
      title: "Device Name",
      dataIndex: "name" as keyof DemoTableData,
    },
    {
      key: "value",
      title: "Value",
      dataIndex: "value" as keyof DemoTableData,
      align: "right" as const,
      render: (value: number) => `${value.toFixed(2)}°C`,
    },
    {
      key: "status",
      title: "Status",
      dataIndex: "status" as keyof DemoTableData,
      render: (status: string) => (
        <span className={`px-2 py-1 rounded text-body-sm ${
          status === "active"
            ? "bg-success-light text-success-dark"
            : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
        }`}>
          {status}
        </span>
      ),
    },
    {
      key: "timestamp",
      title: "Timestamp",
      dataIndex: "timestamp" as keyof DemoTableData,
      className: "font-mono",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-display text-gray-900 dark:text-gray-50 mb-2">
            Design System Demo
          </h1>
          <p className="text-body-lg text-gray-600 dark:text-gray-400">
            Industrial Data + Aesthetic — Base Components
          </p>
        </div>

        {/* Buttons Section */}
        <Card>
          <CardHeader>
            <CardTitle>Buttons</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="flex flex-wrap gap-4">
              <Button variant="primary" size="sm">
                Primary Small
              </Button>
              <Button variant="primary" size="md">
                Primary Medium
              </Button>
              <Button variant="primary" size="lg">
                Primary Large
              </Button>
              <Button variant="secondary" size="md">
                Secondary
              </Button>
              <Button variant="ghost" size="md">
                Ghost
              </Button>
              <Button variant="danger" size="md">
                Danger
              </Button>
              <Button variant="primary" size="md" isLoading>
                Loading
              </Button>
              <Button variant="primary" size="md" disabled>
                Disabled
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* Inputs Section */}
        <Card>
          <CardHeader>
            <CardTitle>Inputs</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Default Input"
                placeholder="Enter text..."
                fullWidth
              />
              <Input
                label="With Error"
                placeholder="Enter text..."
                error="This field is required"
                fullWidth
              />
              <Input
                label="With Helper Text"
                placeholder="Enter text..."
                helperText="This is helper text"
                fullWidth
              />
              <div>
                <label className="block text-body-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Disabled Input
                </label>
                <Input
                  placeholder="Disabled..."
                  disabled
                  fullWidth
                />
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Cards Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card hover>
            <CardHeader>
              <CardTitle>Hover Card</CardTitle>
            </CardHeader>
            <CardBody>
              <p className="text-body text-gray-600 dark:text-gray-400">
                This card has a hover effect with elevation and shadow.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Stat Card</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="text-4xl font-display font-bold text-primary mb-2">
                1,234
              </div>
              <p className="text-body-sm text-gray-500 dark:text-gray-400">
                Total Devices
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Alert Card</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-error-light flex items-center justify-center">
                    <span className="text-error">⚠</span>
                  </div>
                </div>
                <div>
                  <p className="text-body font-medium text-gray-900 dark:text-gray-50">
                    Warning
                  </p>
                  <p className="text-body-sm text-gray-500 dark:text-gray-400">
                    System alert active
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Table Section */}
        <Card>
          <CardHeader>
            <CardTitle>Data Table</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            <Table
              columns={columns}
              dataSource={demoData}
              rowKey="id"
            />
          </CardBody>
        </Card>

        {/* Typography Section */}
        <Card>
          <CardHeader>
            <CardTitle>Typography</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <div>
              <h1 className="text-display text-gray-900 dark:text-gray-50">
                Display Heading
              </h1>
              <p className="text-body-sm text-gray-500 dark:text-gray-400">
                Satoshi Bold 48px
              </p>
            </div>
            <div>
              <h2 className="text-h1 text-gray-900 dark:text-gray-50">
                Heading 1
              </h2>
              <p className="text-body-sm text-gray-500 dark:text-gray-400">
                Satoshi Bold 36px
              </p>
            </div>
            <div>
              <h3 className="text-h2 text-gray-900 dark:text-gray-50">
                Heading 2
              </h3>
              <p className="text-body-sm text-gray-500 dark:text-gray-400">
                Satoshi Bold 28px
              </p>
            </div>
            <div>
              <p className="text-body-lg text-gray-700 dark:text-gray-300">
                Body Large - DM Sans Regular 16px
              </p>
            </div>
            <div>
              <p className="text-body text-gray-700 dark:text-gray-300">
                Body - DM Sans Regular 14px. Lorem ipsum dolor sit amet, consectetur adipiscing elit.
              </p>
            </div>
            <div>
              <p className="text-body-sm text-gray-600 dark:text-gray-400">
                Body Small - DM Sans Regular 12px
              </p>
            </div>
            <div>
              <p className="data-text text-gray-900 dark:text-gray-50">
                Data Text - Geist Mono 14px with tabular nums: 1234.56 789.01 456.78
              </p>
            </div>
            <div>
              <code className="code-block bg-gray-100 dark:bg-gray-900 px-3 py-2 rounded text-sm text-gray-800 dark:text-gray-200">
                Code - JetBrains Mono 13px
              </code>
            </div>
          </CardBody>
        </Card>

        {/* Colors Section */}
        <Card>
          <CardHeader>
            <CardTitle>Color Palette</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="h-20 bg-primary rounded-md mb-2"></div>
                <p className="text-body font-medium">Primary</p>
                <p className="text-body-sm text-gray-500 dark:text-gray-400">#0066CC</p>
              </div>
              <div>
                <div className="h-20 bg-secondary rounded-md mb-2"></div>
                <p className="text-body font-medium">Secondary</p>
                <p className="text-body-sm text-gray-500 dark:text-gray-400">#475569</p>
              </div>
              <div>
                <div className="h-20 bg-success rounded-md mb-2"></div>
                <p className="text-body font-medium">Success</p>
                <p className="text-body-sm text-gray-500 dark:text-gray-400">#10B981</p>
              </div>
              <div>
                <div className="h-20 bg-error rounded-md mb-2"></div>
                <p className="text-body font-medium">Error</p>
                <p className="text-body-sm text-gray-500 dark:text-gray-400">#EF4444</p>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

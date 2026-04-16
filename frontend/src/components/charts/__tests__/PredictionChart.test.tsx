/**
 * Tests for PredictionChart component
 *
 * Tests rendering with data, empty state, and export buttons.
 * Recharts components are mocked as simple divs since they don't render in JSDOM.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock recharts dynamic imports
jest.mock('recharts', () => {
  const createComponent = (name: string) => {
    const Comp = React.forwardRef((props: any, ref: any) => (
      <div ref={ref} data-testid={`recharts-${name}`} {...props} />
    ));
    Comp.displayName = name;
    return Comp;
  };
  return {
    Line: createComponent('Line'),
    XAxis: createComponent('XAxis'),
    YAxis: createComponent('YAxis'),
    CartesianGrid: createComponent('CartesianGrid'),
    Tooltip: createComponent('Tooltip'),
    Legend: createComponent('Legend'),
    ResponsiveContainer: ({ children, ...props }: any) => (
      <div data-testid="recharts-ResponsiveContainer" {...props}>{children}</div>
    ),
    ComposedChart: ({ children, ...props }: any) => (
      <div data-testid="recharts-ComposedChart" {...props}>{children}</div>
    ),
    Area: createComponent('Area'),
    ReferenceLine: createComponent('ReferenceLine'),
  };
});

// Mock html2canvas
jest.mock('html2canvas', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue({
    toDataURL: () => 'data:image/png;base64,test',
  }),
}));

// Mock antd message
jest.mock('antd', () => {
  const actual = jest.requireActual('antd');
  return {
    ...actual,
    message: {
      success: jest.fn(),
      error: jest.fn(),
    },
  };
});

import { PredictionChart } from '../PredictionChart';

const defaultPredictionData = {
  timestamps: [1700000000000, 1700000060000, 1700000120000],
  values: [25.5, 26.0, 24.8],
  confidence: [1.2, 1.5, 1.3],
};

const defaultHistoricalData = [
  { timestamp: 1699999000000, value: 24.0 },
  { timestamp: 1699999600000, value: 24.5 },
  { timestamp: 1699999800000, value: 25.0 },
];

describe('PredictionChart', () => {
  it('should render loading spinner when no data', () => {
    render(
      <PredictionChart
        timeseries="root.test.temp"
        historicalData={[]}
        predictionData={{ timestamps: [], values: [] }}
        algorithm="arima"
      />
    );

    // Antd Spin renders an aria-busy spinner
    expect(document.querySelector('.ant-spin')).toBeInTheDocument();
  });

  it('should render chart header with timeseries name and algorithm', () => {
    render(
      <PredictionChart
        timeseries="root.test.temp"
        historicalData={defaultHistoricalData}
        predictionData={defaultPredictionData}
        algorithm="arima"
      />
    );

    expect(screen.getByText(/Prediction Chart: root\.test\.temp/)).toBeInTheDocument();
    expect(screen.getByText(/ARIMA/)).toBeInTheDocument();
  });

  it('should display data point count', () => {
    render(
      <PredictionChart
        timeseries="root.test.temp"
        historicalData={defaultHistoricalData}
        predictionData={defaultPredictionData}
        algorithm="arima"
      />
    );

    // 3 historical + 3 prediction = 6 data points
    expect(screen.getByText(/6 data points/)).toBeInTheDocument();
  });

  it('should render export buttons', () => {
    render(
      <PredictionChart
        timeseries="root.test.temp"
        historicalData={defaultHistoricalData}
        predictionData={defaultPredictionData}
        algorithm="arima"
      />
    );

    expect(screen.getByLabelText('Export chart as PNG image')).toBeInTheDocument();
    expect(screen.getByLabelText('Export chart data as CSV spreadsheet')).toBeInTheDocument();
  });

  it('should render expand/collapse button', () => {
    render(
      <PredictionChart
        timeseries="root.test.temp"
        historicalData={defaultHistoricalData}
        predictionData={defaultPredictionData}
        algorithm="arima"
      />
    );

    const expandBtn = screen.getByLabelText('Expand chart to full size');
    expect(expandBtn).toBeInTheDocument();

    fireEvent.click(expandBtn);
    expect(screen.getByLabelText('Collapse chart to normal size')).toBeInTheDocument();
  });

  it('should render chart container for Recharts', () => {
    render(
      <PredictionChart
        timeseries="root.test.temp"
        historicalData={defaultHistoricalData}
        predictionData={defaultPredictionData}
        algorithm="arima"
      />
    );

    expect(screen.getByTestId('recharts-ResponsiveContainer')).toBeInTheDocument();
  });

  it('should call onExport callback when CSV export clicked', () => {
    const onExport = jest.fn();
    // Mock URL.createObjectURL for JSDOM
    global.URL.createObjectURL = jest.fn(() => 'blob:test');
    render(
      <PredictionChart
        timeseries="root.test.temp"
        historicalData={defaultHistoricalData}
        predictionData={defaultPredictionData}
        algorithm="arima"
        onExport={onExport}
      />
    );

    fireEvent.click(screen.getByLabelText('Export chart data as CSV spreadsheet'));
    expect(onExport).toHaveBeenCalledWith('csv');
  });

  it('should render with prediction-only data (no historical)', () => {
    render(
      <PredictionChart
        timeseries="root.test.sensor"
        historicalData={[]}
        predictionData={defaultPredictionData}
        algorithm="lstm"
      />
    );

    expect(screen.getByText(/Prediction Chart: root\.test\.sensor/)).toBeInTheDocument();
    expect(screen.getByText(/LSTM/)).toBeInTheDocument();
    expect(screen.getByTestId('recharts-ResponsiveContainer')).toBeInTheDocument();
  });

  it('should render with historical-only data (no predictions)', () => {
    render(
      <PredictionChart
        timeseries="root.test.temp"
        historicalData={defaultHistoricalData}
        predictionData={{ timestamps: [], values: [] }}
        algorithm="prophet"
      />
    );

    expect(screen.getByText(/PROPHET/)).toBeInTheDocument();
    expect(screen.getByTestId('recharts-ResponsiveContainer')).toBeInTheDocument();
  });

  it('should render chart with aria-label for accessibility', () => {
    render(
      <PredictionChart
        timeseries="root.test.temp"
        historicalData={defaultHistoricalData}
        predictionData={defaultPredictionData}
        algorithm="arima"
      />
    );

    // Antd icons also have role="img", so use getAllByRole and find the chart one
    const imgs = screen.getAllByRole('img');
    const chart = imgs.find(el => el.getAttribute('aria-label')?.includes('root.test.temp'));
    expect(chart).toBeTruthy();
    expect(chart?.getAttribute('aria-label')).toContain('arima');
  });
});

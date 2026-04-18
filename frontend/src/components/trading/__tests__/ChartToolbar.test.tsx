/**
 * Tests for ChartToolbar component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ChartToolbar from '../ChartToolbar';

const defaultIndicators = { sma20: true, sma50: true, bollinger: false };

describe('ChartToolbar', () => {
  it('should render chart type buttons', () => {
    render(
      <ChartToolbar
        chartType="candlestick"
        onChartTypeChange={jest.fn()}
        indicators={defaultIndicators}
        onIndicatorsChange={jest.fn()}
      />,
    );

    expect(screen.getByText('K线')).toBeInTheDocument();
    expect(screen.getByText('折线')).toBeInTheDocument();
  });

  it('should highlight active chart type', () => {
    render(
      <ChartToolbar
        chartType="candlestick"
        onChartTypeChange={jest.fn()}
        indicators={defaultIndicators}
        onIndicatorsChange={jest.fn()}
      />,
    );

    const candleBtn = screen.getByText('K线').closest('button')!;
    expect(candleBtn.className).toContain('bg-[#171717]');
  });

  it('should call onChartTypeChange when switching type', () => {
    const onChange = jest.fn();
    render(
      <ChartToolbar
        chartType="candlestick"
        onChartTypeChange={onChange}
        indicators={defaultIndicators}
        onIndicatorsChange={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByText('折线'));

    expect(onChange).toHaveBeenCalledWith('line');
  });

  it('should render indicator checkboxes', () => {
    render(
      <ChartToolbar
        chartType="candlestick"
        onChartTypeChange={jest.fn()}
        indicators={defaultIndicators}
        onIndicatorsChange={jest.fn()}
      />,
    );

    expect(screen.getByText('SMA 20')).toBeInTheDocument();
    expect(screen.getByText('SMA 50')).toBeInTheDocument();
    expect(screen.getByText('Bollinger')).toBeInTheDocument();
  });

  it('should check active indicators', () => {
    render(
      <ChartToolbar
        chartType="candlestick"
        onChartTypeChange={jest.fn()}
        indicators={defaultIndicators}
        onIndicatorsChange={jest.fn()}
      />,
    );

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0]).toBeChecked(); // sma20
    expect(checkboxes[1]).toBeChecked(); // sma50
    expect(checkboxes[2]).not.toBeChecked(); // bollinger
  });

  it('should call onIndicatorsChange when toggling indicator', () => {
    const onChange = jest.fn();
    render(
      <ChartToolbar
        chartType="candlestick"
        onChartTypeChange={jest.fn()}
        indicators={defaultIndicators}
        onIndicatorsChange={onChange}
      />,
    );

    const bollingerLabel = screen.getByText('Bollinger');
    fireEvent.click(bollingerLabel);

    expect(onChange).toHaveBeenCalledWith({
      ...defaultIndicators,
      bollinger: true,
    });
  });

  it('should not render fullscreen button by default', () => {
    render(
      <ChartToolbar
        chartType="candlestick"
        onChartTypeChange={jest.fn()}
        indicators={defaultIndicators}
        onIndicatorsChange={jest.fn()}
      />,
    );

    expect(screen.queryByLabelText('Toggle fullscreen')).not.toBeInTheDocument();
  });

  it('should render fullscreen button when handler provided', () => {
    render(
      <ChartToolbar
        chartType="candlestick"
        onChartTypeChange={jest.fn()}
        indicators={defaultIndicators}
        onIndicatorsChange={jest.fn()}
        onFullscreenToggle={jest.fn()}
      />,
    );

    expect(screen.getByLabelText('Toggle fullscreen')).toBeInTheDocument();
  });

  it('should call onFullscreenToggle when clicked', () => {
    const onFullscreen = jest.fn();
    render(
      <ChartToolbar
        chartType="candlestick"
        onChartTypeChange={jest.fn()}
        indicators={defaultIndicators}
        onIndicatorsChange={jest.fn()}
        onFullscreenToggle={onFullscreen}
      />,
    );

    fireEvent.click(screen.getByLabelText('Toggle fullscreen'));
    expect(onFullscreen).toHaveBeenCalledTimes(1);
  });
});

/**
 * Tests for EmptyState component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  EmptyState,
  NoData,
  NoDatasets,
  NoTimeseries,
  NoAlerts,
  NoAnomalies,
  NoForecasts,
  NoSearchResults,
} from '../EmptyState';

describe('EmptyState', () => {
  it('should render with default type (shows "Nothing Here Yet")', () => {
    render(<EmptyState />);

    expect(screen.getByText('Nothing Here Yet')).toBeInTheDocument();
    expect(screen.getByText("When you add items, they'll appear here.")).toBeInTheDocument();
  });

  it('should render data type', () => {
    render(<EmptyState type="data" />);

    expect(screen.getByText('No Data Yet')).toBeInTheDocument();
    expect(screen.getByText('Start by adding your first time series or importing existing data.')).toBeInTheDocument();
  });

  it('should render datasets type', () => {
    render(<EmptyState type="datasets" />);

    expect(screen.getByText('No Datasets')).toBeInTheDocument();
    expect(screen.getByText('Create your first dataset to organize and manage your time series data.')).toBeInTheDocument();
  });

  it('should render timeseries type', () => {
    render(<EmptyState type="timeseries" />);

    expect(screen.getByText('No Time Series')).toBeInTheDocument();
    expect(screen.getByText('Create a time series to start collecting and analyzing your data.')).toBeInTheDocument();
  });

  it('should render alerts type', () => {
    render(<EmptyState type="alerts" />);

    expect(screen.getByText('No Alerts')).toBeInTheDocument();
    expect(screen.getByText("You're all caught up! No alerts need your attention right now.")).toBeInTheDocument();
  });

  it('should render anomalies type', () => {
    render(<EmptyState type="anomalies" />);

    expect(screen.getByText('No Anomalies Detected')).toBeInTheDocument();
    expect(screen.getByText('Great! Your data looks normal. No anomalies have been detected.')).toBeInTheDocument();
  });

  it('should render forecasts type', () => {
    render(<EmptyState type="forecasts" />);

    expect(screen.getByText('No Forecasts')).toBeInTheDocument();
    expect(screen.getByText('Create AI-powered forecasts to predict future trends in your data.')).toBeInTheDocument();
  });

  it('should render errors type', () => {
    render(<EmptyState type="errors" />);

    expect(screen.getByText('No Errors Detected')).toBeInTheDocument();
    expect(screen.getByText('Everything is running smoothly. No errors to display.')).toBeInTheDocument();
  });

  it('should render search type', () => {
    render(<EmptyState type="search" />);

    expect(screen.getByText('No Results Found')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting your search terms or filters to find what you\'re looking for.')).toBeInTheDocument();
  });

  it('should render custom title and description', () => {
    render(
      <EmptyState
        title="Custom Title"
        description="Custom description text"
      />
    );

    expect(screen.getByText('Custom Title')).toBeInTheDocument();
    expect(screen.getByText('Custom description text')).toBeInTheDocument();
  });

  it('should render action button when both actionText and onAction are provided', () => {
    const handleClick = jest.fn();

    render(
      <EmptyState actionText="Create Item" onAction={handleClick} />
    );

    const button = screen.getByRole('button', { name: 'Create Item' });
    expect(button).toBeInTheDocument();
  });

  it('should call onAction when button is clicked', () => {
    const handleClick = jest.fn();

    render(
      <EmptyState actionText="Create Item" onAction={handleClick} />
    );

    const button = screen.getByRole('button', { name: 'Create Item' });
    fireEvent.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should not render action button when actionText is missing', () => {
    render(<EmptyState onAction={jest.fn()} />);

    const button = screen.queryByRole('button');
    expect(button).not.toBeInTheDocument();
  });

  it('should not render action button when onAction is missing', () => {
    render(<EmptyState actionText="Create Item" />);

    const button = screen.queryByRole('button');
    expect(button).not.toBeInTheDocument();
  });

  it('should render custom illustration', () => {
    const customIllustration = <div data-testid="custom-illustration">Custom Icon</div>;

    render(<EmptyState illustration={customIllustration} />);

    expect(screen.getByTestId('custom-illustration')).toBeInTheDocument();
    expect(screen.getByText('Custom Icon')).toBeInTheDocument();
  });

  it('should apply the scale-in animation class to the illustration container', () => {
    const { container } = render(<EmptyState />);

    const animatedDiv = container.querySelector('.scale-in');
    expect(animatedDiv).toBeInTheDocument();
  });
});

describe('Pre-configured Empty States', () => {
  it('should render NoData component', () => {
    render(<NoData />);

    expect(screen.getByText('No Data Yet')).toBeInTheDocument();
  });

  it('should render NoData with action button', () => {
    const handleClick = jest.fn();

    render(<NoData actionText="Add Data" onAction={handleClick} />);

    const button = screen.getByRole('button', { name: 'Add Data' });
    expect(button).toBeInTheDocument();
  });

  it('should render NoDatasets with default action text', () => {
    const handleClick = jest.fn();
    render(<NoDatasets onAction={handleClick} />);

    expect(screen.getByText('No Datasets')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Dataset' })).toBeInTheDocument();
  });

  it('should render NoDatasets with custom action', () => {
    const handleClick = jest.fn();

    render(<NoDatasets actionText="New Dataset" onAction={handleClick} />);

    expect(screen.getByRole('button', { name: 'New Dataset' })).toBeInTheDocument();
  });

  it('should render NoTimeseries with default action text', () => {
    const handleClick = jest.fn();
    render(<NoTimeseries onAction={handleClick} />);

    expect(screen.getByText('No Time Series')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Time Series' })).toBeInTheDocument();
  });

  it('should render NoAlerts component', () => {
    render(<NoAlerts />);

    expect(screen.getByText('No Alerts')).toBeInTheDocument();
  });

  it('should render NoAnomalies component', () => {
    render(<NoAnomalies />);

    expect(screen.getByText('No Anomalies Detected')).toBeInTheDocument();
  });

  it('should render NoForecasts with default action text', () => {
    const handleClick = jest.fn();
    render(<NoForecasts onAction={handleClick} />);

    expect(screen.getByText('No Forecasts')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Forecast' })).toBeInTheDocument();
  });

  it('should render NoSearchResults', () => {
    render(<NoSearchResults />);

    expect(screen.getByText('No Results Found')).toBeInTheDocument();
  });
});

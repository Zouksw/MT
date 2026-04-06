"use client";

import React from "react";

export type EmptyStateType =
  | "default"
  | "data"
  | "datasets"
  | "timeseries"
  | "alerts"
  | "anomalies"
  | "forecasts"
  | "errors"
  | "search";

export interface EmptyStateProps {
  type?: EmptyStateType;
  title?: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
  illustration?: React.ReactNode;
}

// --- Inline SVG Illustrations ---

function DataIllustration() {
  return (
    <svg width="120" height="80" viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Rising bar chart */}
      <rect x="10" y="50" width="16" height="24" rx="2" fill="#0066CC" opacity="0.2" />
      <rect x="32" y="38" width="16" height="36" rx="2" fill="#0066CC" opacity="0.4" />
      <rect x="54" y="26" width="16" height="48" rx="2" fill="#0066CC" opacity="0.6" />
      <rect x="76" y="14" width="16" height="60" rx="2" fill="#0066CC" opacity="0.8" />
      {/* Trend line */}
      <path d="M18 46 L40 34 L62 22 L84 10" stroke="#0066CC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="84" cy="10" r="3" fill="#0066CC">
        <animate attributeName="r" values="3;4;3" dur="2s" repeatCount="indefinite" />
      </circle>
      {/* Baseline */}
      <line x1="6" y1="74" x2="96" y2="74" stroke="#94A3B8" strokeWidth="1" opacity="0.4" />
    </svg>
  );
}

function DatasetsIllustration() {
  return (
    <svg width="120" height="80" viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Stacked database icons */}
      <ellipse cx="40" cy="24" rx="24" ry="8" stroke="#0066CC" strokeWidth="1.5" fill="#0066CC" fillOpacity="0.08" />
      <path d="M16 24 V40 C16 44.4 27 48 40 48 C53 48 64 44.4 64 40 V24" stroke="#0066CC" strokeWidth="1.5" fill="none" />
      <path d="M16 32 C16 36.4 27 40 40 40 C53 40 64 36.4 64 32" stroke="#0066CC" strokeWidth="1.5" fill="none" opacity="0.5" />
      {/* Plus icon */}
      <circle cx="82" cy="40" r="16" fill="#0066CC" fillOpacity="0.1" stroke="#0066CC" strokeWidth="1.5" />
      <line x1="82" y1="32" x2="82" y2="48" stroke="#0066CC" strokeWidth="2" strokeLinecap="round" />
      <line x1="74" y1="40" x2="90" y2="40" stroke="#0066CC" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function TimeseriesIllustration() {
  return (
    <svg width="120" height="80" viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* ECG/heartbeat line */}
      <path d="M8 40 L24 40 L30 40 L36 20 L42 60 L48 30 L54 50 L60 40 L72 40 L78 40 L84 25 L90 55 L96 35 L102 45 L108 40 L112 40"
        stroke="#0066CC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <animate attributeName="stroke-dashoffset" from="300" to="0" dur="2s" repeatCount="indefinite" />
      </path>
      {/* Glow dot at end */}
      <circle cx="112" cy="40" r="3" fill="#0066CC">
        <animate attributeName="opacity" values="1;0.4;1" dur="1.5s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

function AlertsIllustration() {
  return (
    <svg width="120" height="80" viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Bell */}
      <path d="M50 18 C50 10 70 10 70 18 L74 42 C74 42 80 48 80 52 L40 52 C40 48 46 42 46 42 Z"
        stroke="#10B981" strokeWidth="1.5" fill="#10B981" fillOpacity="0.08" />
      <line x1="48" y1="52" x2="72" y2="52" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
      <circle cx="60" cy="60" r="4" fill="#10B981" />
      {/* Checkmark */}
      <circle cx="86" cy="28" r="14" fill="#10B981" fillOpacity="0.1" stroke="#10B981" strokeWidth="1.5" />
      <path d="M80 28 L84 32 L92 24" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SearchIllustration() {
  return (
    <svg width="120" height="80" viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Magnifying glass */}
      <circle cx="50" cy="34" r="20" stroke="#64748B" strokeWidth="2" fill="#64748B" fillOpacity="0.05" />
      <line x1="64" y1="48" x2="80" y2="64" stroke="#64748B" strokeWidth="3" strokeLinecap="round" />
      {/* Dotted lines inside */}
      <line x1="38" y1="30" x2="58" y2="30" stroke="#94A3B8" strokeWidth="1.5" strokeDasharray="3 3" />
      <line x1="38" y1="36" x2="52" y2="36" stroke="#94A3B8" strokeWidth="1.5" strokeDasharray="3 3" />
      <line x1="38" y1="42" x2="56" y2="42" stroke="#94A3B8" strokeWidth="1.5" strokeDasharray="3 3" />
    </svg>
  );
}

function ForecastsIllustration() {
  return (
    <svg width="120" height="80" viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Crystal ball with sparkles */}
      <circle cx="52" cy="38" r="24" stroke="#8B5CF6" strokeWidth="1.5" fill="#8B5CF6" fillOpacity="0.06" />
      <ellipse cx="52" cy="62" rx="16" ry="4" fill="#8B5CF6" fillOpacity="0.15" />
      {/* Inner trend line */}
      <path d="M36 42 L44 36 L52 44 L60 32 L68 38" stroke="#8B5CF6" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.6" />
      {/* Sparkles */}
      <circle cx="80" cy="18" r="2" fill="#8B5CF6">
        <animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx="88" cy="30" r="1.5" fill="#8B5CF6">
        <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx="76" cy="28" r="1" fill="#8B5CF6">
        <animate attributeName="opacity" values="0.5;1;0.5" dur="1.5s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

function DefaultIllustration() {
  return (
    <svg width="120" height="80" viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Inbox */}
      <rect x="20" y="16" width="80" height="48" rx="6" stroke="#64748B" strokeWidth="1.5" fill="#64748B" fillOpacity="0.04" />
      <path d="M20 44 L44 44 C44 44 48 52 60 52 C72 52 76 44 76 44 L100 44" stroke="#64748B" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

// --- Illustration map ---

const illustrationMap: Record<EmptyStateType, { title: string; description: string; svg: React.ReactNode; color: string; bgColor: string }> = {
  default: {
    title: "Nothing Here Yet",
    description: "When you add items, they'll appear here.",
    svg: <DefaultIllustration />,
    color: "#6B7280",
    bgColor: "bg-gray-50 dark:bg-gray-800/50",
  },
  data: {
    title: "No Data Yet",
    description: "Start by adding your first time series or importing existing data.",
    svg: <DataIllustration />,
    color: "#0066CC",
    bgColor: "bg-blue-50/50 dark:bg-blue-900/10",
  },
  datasets: {
    title: "No Datasets",
    description: "Create your first dataset to organize and manage your time series data.",
    svg: <DatasetsIllustration />,
    color: "#0066CC",
    bgColor: "bg-blue-50/50 dark:bg-blue-900/10",
  },
  timeseries: {
    title: "No Time Series",
    description: "Create a time series to start collecting and analyzing your data.",
    svg: <TimeseriesIllustration />,
    color: "#0066CC",
    bgColor: "bg-blue-50/50 dark:bg-blue-900/10",
  },
  alerts: {
    title: "No Alerts",
    description: "You're all caught up! No alerts need your attention right now.",
    svg: <AlertsIllustration />,
    color: "#10B981",
    bgColor: "bg-green-50/50 dark:bg-green-900/10",
  },
  anomalies: {
    title: "No Anomalies Detected",
    description: "Great! Your data looks normal. No anomalies have been detected.",
    svg: <AlertsIllustration />,
    color: "#10B981",
    bgColor: "bg-green-50/50 dark:bg-green-900/10",
  },
  forecasts: {
    title: "No Forecasts",
    description: "Create AI-powered forecasts to predict future trends in your data.",
    svg: <ForecastsIllustration />,
    color: "#8B5CF6",
    bgColor: "bg-purple-50/50 dark:bg-purple-900/10",
  },
  errors: {
    title: "No Errors Detected",
    description: "Everything is running smoothly. No errors to display.",
    svg: <AlertsIllustration />,
    color: "#10B981",
    bgColor: "bg-green-50/50 dark:bg-green-900/10",
  },
  search: {
    title: "No Results Found",
    description: "Try adjusting your search terms or filters to find what you're looking for.",
    svg: <SearchIllustration />,
    color: "#64748B",
    bgColor: "bg-gray-50/50 dark:bg-gray-800/30",
  },
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  type = "default",
  title,
  description,
  actionText,
  onAction,
  illustration,
}) => {
  const config = illustrationMap[type];
  const displayTitle = title || config.title;
  const displayDescription = description || config.description;

  return (
    <div className={`text-center py-12 px-6 rounded-lg ${config.bgColor}`}>
      {/* SVG Illustration */}
      <div className="scale-in inline-block mb-4">
        {illustration || config.svg}
      </div>

      {/* Text */}
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 font-display">
        {displayTitle}
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto leading-relaxed">
        {displayDescription}
      </p>

      {/* CTA */}
      {actionText && onAction && (
        <button
          onClick={onAction}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,102,204,0.3)] active:translate-y-0"
        >
          {actionText}
        </button>
      )}
    </div>
  );
};

// Pre-configured empty states
export const NoData: React.FC<{ actionText?: string; onAction?: () => void }> = ({
  actionText = "Add Data",
  onAction,
}) => <EmptyState type="data" actionText={actionText} onAction={onAction} />;

export const NoDatasets: React.FC<{
  actionText?: string;
  onAction?: () => void;
}> = ({ actionText = "Create Dataset", onAction }) => (
  <EmptyState type="datasets" actionText={actionText} onAction={onAction} />
);

export const NoTimeseries: React.FC<{
  actionText?: string;
  onAction?: () => void;
}> = ({ actionText = "Create Time Series", onAction }) => (
  <EmptyState type="timeseries" actionText={actionText} onAction={onAction} />
);

export const NoAlerts: React.FC = () => <EmptyState type="alerts" />;
export const NoAnomalies: React.FC = () => <EmptyState type="anomalies" />;

export const NoForecasts: React.FC<{
  actionText?: string;
  onAction?: () => void;
}> = ({ actionText = "Create Forecast", onAction }) => (
  <EmptyState type="forecasts" actionText={actionText} onAction={onAction} />
);

export const NoSearchResults: React.FC = () => <EmptyState type="search" />;

export default EmptyState;

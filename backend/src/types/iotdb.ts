/**
 * IoTDB Data Type Definitions
 *
 * Provides strongly-typed interfaces for IoTDB REST API operations
 * replacing `any` types with proper type definitions
 */

/**
 * IoTDB connection configuration
 */
export interface IoTDBConfig {
	host: string;
	port: number;
	username: string;
	password: string;
	database: string;
}

/**
 * IoTDB value types supported by the database
 */
export type IoTDBValue = string | number | boolean | null;

/**
 * Dynamic query result row from IoTDB
 * Using unknown for truly dynamic data - better than any
 */
export type IoTDBQueryRow = Record<string, unknown>;

/**
 * IoTDB query result with metadata
 * This represents the raw response from IoTDB REST API
 * Renamed from IoTDBQueryResult to avoid conflict with types/api.ts
 */
export interface IoTDBInternalQueryResult {
	expressions?: string[] | null;
	column_names?: string[] | null;
	timestamps?: number[] | null;
	values: IoTDBValue[][];
}

/**
 * IoTDB REST API response structure
 */
export interface IoTDBResponse {
	code: number;
	message: string;
	expressions?: string[] | null;
	column_names?: string[] | null;
	timestamps?: number[] | null;
	values?: IoTDBValue[][] | null;
}

/**
 * Query request body
 */
export interface IoTDBQueryRequest {
	sql: string;
	row_limit?: number;
}

/**
 * Insert tablet request for aligned timeseries
 */
export interface IoTDBInsertTabletRequest {
	device: string;
	timestamps: number[];
	measurements: string[];
	data_types: string[];
	values: IoTDBValue[][];
	is_aligned?: boolean;
}

/**
 * Insert records request for non-aligned timeseries
 */
export interface IoTDBInsertRecordsRequest {
	devices: string[];
	timestamps: number[];
	measurements_list: string[][];
	data_types_list: string[][];
	values_list: IoTDBValue[][];
	is_aligned?: boolean;
}

/**
 * AI training hyperparameters
 */
export interface IoTDBTrainingHyperparameters {
	[key: string]: IoTDBValue | IoTDBValue[];
}

/**
 * AI model training request
 */
export interface IoTDBTrainModelRequest {
	path: string;
	algorithm: "ARIMA" | "PROPHET" | "LSTM" | "TRANSFORMER";
	hyperparameters?: IoTDBTrainingHyperparameters;
}

/**
 * AI model training response
 */
export interface IoTDBTrainModelResponse {
	success: boolean;
	message: string;
	modelId?: string;
}

/**
 * Forecast data point
 */
export interface IoTDBForecast {
	timestamp: Date;
	predictedValue: IoTDBValue | null;
	lowerBound: IoTDBValue | null;
	upperBound: IoTDBValue | null;
}

/**
 * AI prediction request
 */
export interface IoTDBPredictRequest {
	path: string;
	model_id: string;
	horizon: number;
	confidence_level?: number;
}

/**
 * AI prediction response
 */
export interface IoTDBPredictResponse {
	success: boolean;
	message: string;
	forecasts?: IoTDBForecast[];
}

/**
 * AI model information
 */
export interface IoTDBModel {
	modelId: IoTDBValue | null;
	algorithm: IoTDBValue | null;
	path: IoTDBValue | null;
	trainedAt: IoTDBValue | null;
}

/**
 * List models response
 */
export interface IoTDBListModelsResponse {
	success: boolean;
	models?: IoTDBModel[];
	message: string;
}

/**
 * Generic operation result
 */
export interface IoTDBOperationResult {
	success: boolean;
	message: string;
}

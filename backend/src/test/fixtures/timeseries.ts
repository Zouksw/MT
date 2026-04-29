/**
 * Time series test fixtures
 *
 * Pre-defined time series data for testing different scenarios
 */

export interface TimeSeriesFixture {
  name: string;
  dataType: 'INT32' | 'INT64' | 'FLOAT' | 'DOUBLE' | 'BOOLEAN' | 'TEXT';
  encoding: 'PLAIN' | 'RLE' | 'DIFF' | 'TS_2DIFF' | 'GORILLA';
  compression?: 'SNAPPY' | 'LZ4' | 'GZIP' | 'UNCOMPRESSED';
}

export interface DataPointFixture {
  timestamp: number;
  value: number;
}

/**
 * Standard time series fixtures
 */
export const standardTimeSeries: TimeSeriesFixture = {
  name: 'root.sg.device1.temperature',
  dataType: 'DOUBLE',
  encoding: 'GORILLA',
  compression: 'SNAPPY',
};

export const integerTimeSeries: TimeSeriesFixture = {
  name: 'root.sg.device1.count',
  dataType: 'INT32',
  encoding: 'RLE',
  compression: 'SNAPPY',
};

export const booleanTimeSeries: TimeSeriesFixture = {
  name: 'root.sg.device1.status',
  dataType: 'BOOLEAN',
  encoding: 'PLAIN',
  compression: 'UNCOMPRESSED',
};

export const textTimeSeries: TimeSeriesFixture = {
  name: 'root.sg.device1.message',
  dataType: 'TEXT',
  encoding: 'PLAIN',
  compression: 'SNAPPY',
};

/**
 * Multiple time series for batch operations
 */
export const multipleTimeSeries: TimeSeriesFixture[] = [
  {
    name: 'root.sg.device1.temperature',
    dataType: 'DOUBLE',
    encoding: 'GORILLA',
    compression: 'SNAPPY',
  },
  {
    name: 'root.sg.device1.humidity',
    dataType: 'DOUBLE',
    encoding: 'GORILLA',
    compression: 'SNAPPY',
  },
  {
    name: 'root.sg.device1.pressure',
    dataType: 'DOUBLE',
    encoding: 'GORILLA',
    compression: 'SNAPPY',
  },
  {
    name: 'root.sg.device2.temperature',
    dataType: 'DOUBLE',
    encoding: 'GORILLA',
    compression: 'SNAPPY',
  },
];

/**
 * Temperature data fixture (typical range: 15-35°C)
 */
export const temperatureData: DataPointFixture[] = [
  { timestamp: 1648120000000, value: 20.5 },
  { timestamp: 1648120060000, value: 21.0 },
  { timestamp: 1648120120000, value: 21.5 },
  { timestamp: 1648120180000, value: 22.0 },
  { timestamp: 1648120240000, value: 21.8 },
  { timestamp: 1648120300000, value: 21.3 },
  { timestamp: 1648120360000, value: 20.9 },
  { timestamp: 1648120420000, value: 20.5 },
];

/**
 * Humidity data fixture (typical range: 30-70%)
 */
export const humidityData: DataPointFixture[] = [
  { timestamp: 1648120000000, value: 45.0 },
  { timestamp: 1648120060000, value: 46.5 },
  { timestamp: 1648120120000, value: 48.0 },
  { timestamp: 1648120180000, value: 50.0 },
  { timestamp: 1648120240000, value: 52.0 },
  { timestamp: 1648120300000, value: 51.0 },
  { timestamp: 1648120360000, value: 49.0 },
  { timestamp: 1648120420000, value: 47.0 },
];

/**
 * Pressure data fixture (typical range: 980-1040 hPa)
 */
export const pressureData: DataPointFixture[] = [
  { timestamp: 1648120000000, value: 1013.25 },
  { timestamp: 1648120060000, value: 1013.50 },
  { timestamp: 1648120120000, value: 1013.75 },
  { timestamp: 1648120180000, value: 1014.00 },
  { timestamp: 1648120240000, value: 1013.80 },
  { timestamp: 1648120300000, value: 1013.50 },
  { timestamp: 1648120360000, value: 1013.25 },
  { timestamp: 1648120420000, value: 1013.00 },
];

/**
 * Anomaly data fixtures for testing anomaly detection
 */
export const anomalyData = {
  temperature: [
    { timestamp: 1648120000000, value: 20.5 },
    { timestamp: 1648120060000, value: 21.0 },
    { timestamp: 1648120120000, value: 21.5 },
    { timestamp: 1648120180000, value: 85.0 }, // Anomaly: extreme high
    { timestamp: 1648120240000, value: 21.8 },
    { timestamp: 1648120300000, value: 21.3 },
  ],
  suddenDrop: [
    { timestamp: 1648120000000, value: 50.0 },
    { timestamp: 1648120060000, value: 51.0 },
    { timestamp: 1648120120000, value: 52.0 },
    { timestamp: 1648120180000, value: 5.0 }, // Anomaly: sudden drop
    { timestamp: 1648120240000, value: 51.0 },
    { timestamp: 1648120300000, value: 52.0 },
  ],
  multipleAnomalies: [
    { timestamp: 1648120000000, value: 20.0 },
    { timestamp: 1648120060000, value: 95.0 }, // Anomaly 1
    { timestamp: 1648120120000, value: 20.5 },
    { timestamp: 1648120180000, value: 21.0 },
    { timestamp: 1648120240000, value: -10.0 }, // Anomaly 2
    { timestamp: 1648120300000, value: 21.5 },
  ],
};

/**
 * Time series data with trend for prediction testing
 */
export const trendData = {
  linearUp: Array.from({ length: 20 }, (_, i) => ({
    timestamp: 1648120000000 + i * 60000,
    value: 20 + i * 0.5, // Linear increase
  })),
  linearDown: Array.from({ length: 20 }, (_, i) => ({
    timestamp: 1648120000000 + i * 60000,
    value: 30 - i * 0.5, // Linear decrease
  })),
  seasonal: Array.from({ length: 24 }, (_, i) => ({
    timestamp: 1648120000000 + i * 60000,
    value: 25 + Math.sin(i * Math.PI / 6) * 5, // Seasonal pattern
  })),
  constant: Array.from({ length: 20 }, (_, i) => ({
    timestamp: 1648120000000 + i * 60000,
    value: 25.0, // Constant value
  })),
};

/**
 * Invalid time series names for testing validation
 */
export const invalidTimeSeriesNames = [
  '', // Empty
  'invalid', // No root prefix
  'root..device', // Double dot
  'root.device.', // Trailing dot
  'root device sensor', // Spaces
  'root/device/sensor', // Forward slash
  'root\\device\\sensor', // Backslash
  123, // Number instead of string
];

/**
 * Valid time series patterns
 */
export const validTimeSeriesPatterns = {
  singleLevel: 'root.sensor',
  twoLevel: 'root.sg.sensor',
  threeLevel: 'root.sg.device.sensor',
  fourLevel: 'root.sg.device.location.sensor',
  withNumbers: 'root.sg1.device1.sensor1',
  withUnderscores: 'root_sg_device_sensor',
  longPath: 'root.organization.building.floor.room.device.sensor',
};

/**
 * Data type fixtures
 */
export const dataTypeFixtures = {
  int32: { value: 42, dataType: 'INT32' },
  int64: { value: 9223372036854775807n as unknown as number, dataType: 'INT64' },
  float: { value: 3.14, dataType: 'FLOAT' },
  double: { value: Math.PI, dataType: 'DOUBLE' },
  boolean: { value: true, dataType: 'BOOLEAN' },
  text: { value: 'sensor reading', dataType: 'TEXT' },
};

/**
 * Encoding fixtures
 */
export const encodingFixtures = ['PLAIN', 'RLE', 'DIFF', 'TS_2DIFF', 'GORILLA'];

/**
 * Compression fixtures
 */
export const compressionFixtures = ['SNAPPY', 'LZ4', 'GZIP', 'UNCOMPRESSED'];

/**
 * Large dataset for performance testing
 *
 * @param count - Number of data points to generate
 * @returns Array of data points
 */
export function generateLargeDataset(count: number = 10000): DataPointFixture[] {
  return Array.from({ length: count }, (_, i) => ({
    timestamp: Date.now() - (count - i) * 1000,
    value: 20 + Math.sin(i * 0.1) * 5 + Math.random() * 2,
  }));
}

/**
 * Time series with gaps for testing interpolation
 */
export const gappedData = [
  { timestamp: 1648120000000, value: 20.0 },
  { timestamp: 1648120060000, value: 21.0 },
  { timestamp: 1648120120000, value: 22.0 },
  // Gap: 1648120180000 - missing
  // Gap: 1648120240000 - missing
  { timestamp: 1648120300000, value: 25.0 },
  { timestamp: 1648120360000, value: 26.0 },
];

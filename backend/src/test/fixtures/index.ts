/**
 * Test fixtures - unified export
 *
 * Centralizes all test fixtures for easy importing
 *
 * @example
 * ```typescript
 * import { standardUser, adminUser } from '@/test/fixtures/users';
 * import { standardTimeSeries, temperatureData } from '@/test/fixtures/timeseries';
 * ```
 */

// Time series fixtures
export {
	anomalyData,
	booleanTimeSeries,
	compressionFixtures,
	type DataPointFixture,
	dataTypeFixtures,
	encodingFixtures,
	gappedData,
	generateLargeDataset,
	humidityData,
	integerTimeSeries,
	invalidTimeSeriesNames,
	multipleTimeSeries,
	pressureData,
	standardTimeSeries,
	type TimeSeriesFixture,
	temperatureData,
	textTimeSeries,
	trendData,
	validTimeSeriesPatterns,
} from "./timeseries";
// User fixtures
export {
	adminUser,
	createUserWithPassword,
	edgeCaseUsers,
	fullUser,
	generateUserFixtures,
	invalidUsers,
	loginScenarios,
	passwordFixtures,
	permissionScenarios,
	premiumUser,
	standardUser,
} from "./users";

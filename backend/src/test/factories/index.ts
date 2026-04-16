/**
 * Test Factories
 *
 * Factory functions for generating test data with sensible defaults.
 * Use these instead of hard-coding test data inline.
 *
 * @example
 * ```typescript
 * import { createDataset, createUser } from '@/test/factories';
 *
 * const user = createUser({ role: 'ADMIN' });
 * const dataset = createDataset({ ownerId: user.id });
 * ```
 */

export interface DatasetFactoryInput {
  id?: string;
  name?: string;
  slug?: string;
  description?: string;
  storageFormat?: string;
  ownerId?: string;
  organization_id?: string;
  sizeBytes?: bigint | null;
  rowsCount?: bigint | null;
  isImported?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  owner?: {
    id: string;
    name: string;
    email: string;
  } | null;
  timeseries?: any[];
  _count?: { timeseries: number };
}

export interface TimeseriesFactoryInput {
  id?: string;
  name?: string;
  slug?: string;
  dataType?: string;
  datasetId?: string;
  createdAt?: Date;
}

export interface DatapointFactoryInput {
  id?: string;
  value?: number;
  timestamp?: Date;
  isOutlier?: boolean;
  timeseriesId?: string;
}

let _counter = 0;

/** Reset factory counter (call in beforeEach) */
export function resetFactoryCounter() {
  _counter = 0;
}

function _nextId(prefix: string): string {
  return `${prefix}-${++_counter}`;
}

/** Create a dataset with sensible defaults */
export function createDataset(overrides: Partial<DatasetFactoryInput> = {}) {
  const id = overrides.id ?? _nextId('ds');
  const name = overrides.name ?? `Test Dataset ${_counter}`;
  return {
    id,
    name,
    slug: overrides.slug ?? name.toLowerCase().replace(/\s+/g, '-'),
    description: overrides.description ?? `Description for ${name}`,
    storageFormat: overrides.storageFormat ?? 'CSV',
    ownerId: overrides.ownerId ?? 'test-user-id',
    organization_id: overrides.organization_id ?? 'default-org-id',
    sizeBytes: overrides.sizeBytes ?? BigInt(0),
    rowsCount: overrides.rowsCount ?? BigInt(0),
    isImported: overrides.isImported ?? false,
    createdAt: overrides.createdAt ?? new Date('2024-01-01'),
    updatedAt: overrides.updatedAt ?? new Date('2024-01-01'),
    owner: overrides.owner ?? {
      id: overrides.ownerId ?? 'test-user-id',
      name: 'Test User',
      email: 'test@example.com',
    },
    timeseries: overrides.timeseries ?? [],
    _count: overrides._count ?? { timeseries: 0 },
  };
}

/** Create a dataset owned by a different user (for ownership tests) */
export function createOtherOwnerDataset(overrides: Partial<DatasetFactoryInput> = {}) {
  return createDataset({
    ownerId: 'different-user-id',
    owner: {
      id: 'different-user-id',
      name: 'Other User',
      email: 'other@example.com',
    },
    ...overrides,
  });
}

/** Create a timeseries with sensible defaults */
export function createTimeseries(overrides: Partial<TimeseriesFactoryInput> = {}) {
  const name = overrides.name ?? `temperature_${_counter}`;
  return {
    id: overrides.id ?? _nextId('ts'),
    name,
    slug: overrides.slug ?? name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    dataType: overrides.dataType ?? 'FLOAT',
    datasetId: overrides.datasetId ?? 'dataset-123',
    createdAt: overrides.createdAt ?? new Date('2024-01-01'),
  };
}

/** Create a datapoint with sensible defaults */
export function createDatapoint(overrides: Partial<DatapointFactoryInput> = {}) {
  return {
    id: overrides.id ?? _nextId('dp'),
    value: overrides.value ?? 25.5,
    timestamp: overrides.timestamp ?? new Date('2024-01-01T00:00:00Z'),
    isOutlier: overrides.isOutlier ?? false,
    timeseriesId: overrides.timeseriesId ?? 'ts-1',
  };
}

/** Create multiple datapoints with sequential timestamps */
export function createDatapoints(
  count: number,
  overrides: Partial<DatapointFactoryInput> = {}
) {
  const baseDate = overrides.timestamp ?? new Date('2024-01-01T00:00:00Z');
  return Array.from({ length: count }, (_, i) => {
    const timestamp = new Date(baseDate.getTime() + i * 3600_000); // 1 hour apart
    return createDatapoint({ ...overrides, timestamp });
  });
}

/** Create a Prisma dataset record (matches Prisma schema shape) */
export function createPrismaDataset(overrides: Partial<DatasetFactoryInput> = {}) {
  const dataset = createDataset(overrides);
  return {
    ...dataset,
    sizeBytes: dataset.sizeBytes ?? null,
    rowsCount: dataset.rowsCount ?? null,
  };
}

/** Create batch of datasets for pagination tests */
export function createDatasetBatch(
  count: number,
  overrides: Partial<DatasetFactoryInput> = {}
) {
  return Array.from({ length: count }, () => createDataset(overrides));
}

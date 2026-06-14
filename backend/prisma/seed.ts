import { PrismaClient, type AlertSeverity, type AlertType, type AnomalySeverity, type DetectionMethod, type ModelAlgorithm, type StorageFormat, type UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ============================================================================
// Configuration
// ============================================================================

const SALT_ROUNDS = 12;
const NOW = new Date();
const THIRTY_DAYS_AGO = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000);
const SEVEN_DAYS_AGO = new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000);

// Production guard: seed credentials must come from env in prod. The dev
// fallbacks below (Admin123! etc.) are intentionally weak and committed — they
// must never run against a production database.
if (process.env.NODE_ENV === 'production' && !process.env.SEED_ADMIN_PASSWORD) {
  console.error(
    '\n[FATAL] Refusing to seed with committed dev credentials in production.\n' +
    'Set SEED_ADMIN_PASSWORD / SEED_USER_PASSWORD / SEED_DEMO_PASSWORD env vars before seeding.\n',
  );
  process.exit(1);
}

// ============================================================================
// Helpers
// ============================================================================

/** Generate a random number between min and max */
function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/** Generate a random integer between min and max (inclusive) */
function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}

/** Pick a random element from an array */
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Generate a sine wave with noise - simulates realistic sensor data */
function sineWave(
  index: number,
  baseValue: number,
  amplitude: number,
  period: number,
  noiseAmplitude: number,
): number {
  const signal = Math.sin((2 * Math.PI * index) / period) * amplitude;
  const noise = (Math.random() - 0.5) * 2 * noiseAmplitude;
  return parseFloat((baseValue + signal + noise).toFixed(4));
}

/** Add an occasional anomaly spike */
function withSpike(value: number, index: number, spikeChance: number = 0.02): number {
  if (Math.random() < spikeChance) {
    return parseFloat((value * (1 + (Math.random() > 0.5 ? 1 : -1) * rand(0.3, 0.8))).toFixed(4));
  }
  return value;
}

/** Generate a slug from a name */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Sleep for ms milliseconds */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Seed Data Definitions
// ============================================================================

interface UserInfo {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
}

const USERS: UserInfo[] = [
  {
    email: process.env.SEED_ADMIN_EMAIL ?? 'admin@trademind.com',
    // Password sourced from env so real credentials are never committed.
    // Falls back to a dev-only placeholder when SEED_ADMIN_PASSWORD is unset.
    password: process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!',
    name: 'System Administrator',
    role: 'ADMIN',
    avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=SA&backgroundColor=3b82f6',
  },
  {
    email: process.env.SEED_USER_EMAIL ?? 'user@trademind.com',
    password: process.env.SEED_USER_PASSWORD ?? 'User123!',
    name: 'Jane DataScientist',
    role: 'EDITOR',
    avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=JD&backgroundColor=10b981',
  },
  {
    email: process.env.SEED_DEMO_EMAIL ?? 'demo@trademind.com',
    password: process.env.SEED_DEMO_PASSWORD ?? 'Demo123!',
    name: 'Demo User',
    role: 'VIEWER',
    avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=DU&backgroundColor=f59e0b',
  },
];

interface DatasetDef {
  name: string;
  description: string;
  storageFormat: StorageFormat;
  isPublic: boolean;
  timeseries: TimeseriesDef[];
}

interface TimeseriesDef {
  name: string;
  description: string;
  unit: string;
  colorHex: string;
  baseValue: number;
  amplitude: number;
  period: number;
  noiseAmplitude: number;
}

const DATASETS: DatasetDef[] = [
  {
    name: 'Temperature Sensors - Building A',
    description: 'Multi-zone temperature monitoring across Building A floors and rooms. Data collected from IoT sensors deployed in HVAC systems.',
    storageFormat: 'IOTDB_CACHE',
    isPublic: true,
    timeseries: [
      {
        name: 'Zone 1 - Lobby Temperature',
        description: 'Ground floor lobby ambient temperature readings',
        unit: '\u00B0C',
        colorHex: '#ef4444',
        baseValue: 22,
        amplitude: 4,
        period: 288, // daily cycle in 5-min intervals
        noiseAmplitude: 0.8,
      },
      {
        name: 'Zone 2 - Server Room Temperature',
        description: 'Server room rack inlet temperature',
        unit: '\u00B0C',
        colorHex: '#dc2626',
        baseValue: 19,
        amplitude: 2,
        period: 288,
        noiseAmplitude: 0.5,
      },
      {
        name: 'Zone 3 - Rooftop Ambient',
        description: 'Outdoor rooftop weather station temperature',
        unit: '\u00B0C',
        colorHex: '#f87171',
        baseValue: 15,
        amplitude: 8,
        period: 288,
        noiseAmplitude: 1.5,
      },
    ],
  },
  {
    name: 'Server Room Monitoring',
    description: 'Comprehensive server room environmental and power monitoring system with real-time alerts.',
    storageFormat: 'IOTDB_CACHE',
    isPublic: false,
    timeseries: [
      {
        name: 'Rack Power Consumption',
        description: 'Total power draw from primary server rack in kilowatts',
        unit: 'kW',
        colorHex: '#3b82f6',
        baseValue: 4.5,
        amplitude: 1.2,
        period: 288,
        noiseAmplitude: 0.3,
      },
      {
        name: 'UPS Battery Level',
        description: 'Uninterruptible power supply battery charge percentage',
        unit: '%',
        colorHex: '#22c55e',
        baseValue: 98,
        amplitude: 2,
        period: 1440, // weekly discharge/charge cycle
        noiseAmplitude: 0.5,
      },
      {
        name: 'Network Latency',
        description: 'Round-trip time to core switch in milliseconds',
        unit: 'ms',
        colorHex: '#a855f7',
        baseValue: 2,
        amplitude: 1,
        period: 288,
        noiseAmplitude: 0.5,
      },
    ],
  },
  {
    name: 'Solar Panel Array - East Wing',
    description: 'Performance metrics from the 50kW solar panel installation on the East Wing rooftop.',
    storageFormat: 'IOTDB_CACHE',
    isPublic: true,
    timeseries: [
      {
        name: 'Power Output',
        description: 'Total DC power output from the solar array',
        unit: 'kW',
        colorHex: '#f59e0b',
        baseValue: 25,
        amplitude: 20,
        period: 288,
        noiseAmplitude: 2,
      },
      {
        name: 'Panel Temperature',
        description: 'Average panel surface temperature',
        unit: '\u00B0C',
        colorHex: '#f97316',
        baseValue: 35,
        amplitude: 15,
        period: 288,
        noiseAmplitude: 2,
      },
    ],
  },
  {
    name: 'Weather Station - Rooftop',
    description: 'Comprehensive weather data collection from the rooftop meteorological station.',
    storageFormat: 'CSV',
    isPublic: true,
    timeseries: [
      {
        name: 'Atmospheric Pressure',
        description: 'Barometric pressure readings from the weather station',
        unit: 'hPa',
        colorHex: '#6366f1',
        baseValue: 1013,
        amplitude: 10,
        period: 1440,
        noiseAmplitude: 2,
      },
      {
        name: 'Relative Humidity',
        description: 'Ambient relative humidity percentage',
        unit: '%',
        colorHex: '#06b6d4',
        baseValue: 60,
        amplitude: 20,
        period: 288,
        noiseAmplitude: 5,
      },
      {
        name: 'Wind Speed',
        description: 'Anemometer wind speed measurements',
        unit: 'm/s',
        colorHex: '#14b8a6',
        baseValue: 4,
        amplitude: 3,
        period: 144,
        noiseAmplitude: 1.5,
      },
    ],
  },
  {
    name: 'Manufacturing Line - Motor Vibration',
    description: 'Vibration analysis data from industrial motors on Assembly Line 3. Used for predictive maintenance.',
    storageFormat: 'IOTDB_CACHE',
    isPublic: false,
    timeseries: [
      {
        name: 'Motor A - Axial Vibration',
        description: 'Axial vibration frequency from Motor A on assembly line',
        unit: 'Hz',
        colorHex: '#ec4899',
        baseValue: 50,
        amplitude: 8,
        period: 288,
        noiseAmplitude: 3,
      },
      {
        name: 'Motor A - Radial Vibration',
        description: 'Radial vibration frequency from Motor A on assembly line',
        unit: 'Hz',
        colorHex: '#d946ef',
        baseValue: 45,
        amplitude: 6,
        period: 288,
        noiseAmplitude: 2,
      },
    ],
  },
  {
    name: 'Water Treatment Plant',
    description: 'Water quality parameters from the municipal water treatment facility monitoring system.',
    storageFormat: 'IOTDB_CACHE',
    isPublic: true,
    timeseries: [
      {
        name: 'pH Level',
        description: 'Water pH level from treatment output',
        unit: 'pH',
        colorHex: '#84cc16',
        baseValue: 7.2,
        amplitude: 0.4,
        period: 1440,
        noiseAmplitude: 0.1,
      },
      {
        name: 'Dissolved Oxygen',
        description: 'Dissolved oxygen concentration in mg/L',
        unit: 'mg/L',
        colorHex: '#22d3ee',
        baseValue: 8,
        amplitude: 1.5,
        period: 288,
        noiseAmplitude: 0.3,
      },
      {
        name: 'Turbidity',
        description: 'Water turbidity measured in NTU',
        unit: 'NTU',
        colorHex: '#fbbf24',
        baseValue: 0.5,
        amplitude: 0.3,
        period: 288,
        noiseAmplitude: 0.1,
      },
    ],
  },
  {
    name: 'HVAC Energy Consumption',
    description: 'Heating, ventilation and air conditioning energy usage across campus buildings.',
    storageFormat: 'CSV',
    isPublic: false,
    timeseries: [
      {
        name: 'Chiller Power Draw',
        description: 'Main chiller unit power consumption',
        unit: 'kW',
        colorHex: '#64748b',
        baseValue: 120,
        amplitude: 40,
        period: 288,
        noiseAmplitude: 8,
      },
      {
        name: 'Air Handler Flow Rate',
        description: 'Total air flow rate through AHU-1',
        unit: 'm\u00B3/h',
        colorHex: '#78716c',
        baseValue: 5000,
        amplitude: 1500,
        period: 288,
        noiseAmplitude: 200,
      },
    ],
  },
  {
    name: 'Electric Vehicle Charging Stations',
    description: 'Usage and performance data from the 12-station EV charging hub in parking garage B2.',
    storageFormat: 'IOTDB_CACHE',
    isPublic: true,
    timeseries: [
      {
        name: 'Grid Load',
        description: 'Total grid power demand from all charging stations',
        unit: 'kW',
        colorHex: '#16a34a',
        baseValue: 80,
        amplitude: 60,
        period: 288,
        noiseAmplitude: 10,
      },
      {
        name: 'Average Charging Rate',
        description: 'Average charging rate across active stations',
        unit: 'kW',
        colorHex: '#059669',
        baseValue: 22,
        amplitude: 15,
        period: 288,
        noiseAmplitude: 3,
      },
    ],
  },
];

const MODEL_DEFS: { algorithm: ModelAlgorithm; description: string }[] = [
  { algorithm: 'ARIMA', description: 'Auto-Regressive Integrated Moving Average model' },
  { algorithm: 'PROPHET', description: 'Facebook Prophet decomposition model' },
  { algorithm: 'LSTM', description: 'Long Short-Term Memory neural network' },
  { algorithm: 'TRANSFORMER', description: 'Attention-based Transformer model' },
  { algorithm: 'ENSEMBLE', description: 'Weighted ensemble of multiple models' },
];

const SEVERITIES: AnomalySeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const DETECTION_METHODS: DetectionMethod[] = ['STATISTICAL', 'ML_AUTOENCODER', 'RULE_BASED'];

// ============================================================================
// Main Seed Function
// ============================================================================

async function main() {
  console.log('');
  console.log('==========================================');
  console.log('  TradeMind AI - Database Seeding');
  console.log('==========================================');
  console.log('');

  // ------------------------------------------------------------------
  // 1. Clean existing data (respecting FK order)
  // ------------------------------------------------------------------
  console.log('[1/9] Cleaning existing data...');

  // Delete in correct order respecting foreign key constraints
  await prisma.forecast.deleteMany();
  await prisma.forecastingModel.deleteMany();
  await prisma.anomaly.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.alertRule.deleteMany();
  await prisma.datapoint.deleteMany();
  await prisma.timeseries.deleteMany();
  await prisma.saved_queries.deleteMany();
  await prisma.dataset.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.securityAuditLog.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.session.deleteMany();
  await prisma.organization_members.deleteMany();
  await prisma.organizations.deleteMany();
  await prisma.user.deleteMany();
  console.log('       All tables cleared.');

  // ------------------------------------------------------------------
  // 2. Create users
  // ------------------------------------------------------------------
  console.log('[2/9] Creating users...');

  const users = [];
  for (const u of USERS) {
    const passwordHash = await bcrypt.hash(u.password, SALT_ROUNDS);
    const user = await prisma.user.create({
      data: {
        email: u.email,
        passwordHash,
        name: u.name,
        role: u.role,
        avatarUrl: u.avatarUrl ?? null,
        preferences: { theme: 'system', notifications: true, language: 'en' },
        lastLoginAt: new Date(NOW.getTime() - randInt(1, 48) * 60 * 60 * 1000),
      },
    });
    users.push(user);
    console.log(`       Created: ${u.name} (${u.role}) <${u.email}>`);
  }

  const adminUser = users[0];
  const editorUser = users[1];
  const viewerUser = users[2];

  // ------------------------------------------------------------------
  // 3. Create organizations and memberships
  // ------------------------------------------------------------------
  console.log('[3/9] Creating organizations...');

  const org = await prisma.organizations.create({
    data: {
      id: 'org-trademind',
      owner_id: adminUser.id,
      name: 'TradeMind AI Corp',
      slug: 'trademind-corp',
      description: 'Primary organization for TradeMind AI platform development and operations.',
      logo_url: 'https://api.dicebear.com/7.x/identicon/svg?seed=trademind&backgroundColor=3b82f6',
      settings: { defaultTimezone: 'UTC', dataRetentionDays: 365 },
    },
  });

  // Add members to organization
  await prisma.organization_members.createMany({
    data: [
      { id: 'mem-admin', organization_id: org.id, user_id: adminUser.id, role: 'ADMIN' },
      { id: 'mem-editor', organization_id: org.id, user_id: editorUser.id, role: 'EDITOR' },
      { id: 'mem-viewer', organization_id: org.id, user_id: viewerUser.id, role: 'VIEWER' },
    ],
  });
  console.log(`       Created: ${org.name}`);

  // ------------------------------------------------------------------
  // 4. Create datasets and timeseries
  // ------------------------------------------------------------------
  console.log('[4/9] Creating datasets and timeseries...');

  const allTimeseries: { id: string; datasetId: string; name: string; unit: string; def: TimeseriesDef }[] = [];
  let totalDatapoints = 0;

  for (let di = 0; di < DATASETS.length; di++) {
    const ds = DATASETS[di];
    const owner = pick(users);
    const dataset = await prisma.dataset.create({
      data: {
        organization_id: org.id,
        ownerId: owner.id,
        name: ds.name,
        slug: slugify(ds.name),
        description: ds.description,
        storageFormat: ds.storageFormat,
        isPublic: ds.isPublic,
        isImported: ds.storageFormat === 'CSV',
        sizeBytes: BigInt(0),
        rowsCount: 0,
        metadata: { source: 'seed-script', version: 1 },
        lastAccessedAt: new Date(NOW.getTime() - randInt(0, 7) * 24 * 60 * 60 * 1000),
      },
    });

    const tsIds: string[] = [];
    for (const ts of ds.timeseries) {
      const timeseries = await prisma.timeseries.create({
        data: {
          datasetId: dataset.id,
          name: ts.name,
          slug: slugify(ts.name),
          description: ts.description,
          colorHex: ts.colorHex,
          unit: ts.unit,
          timezone: 'UTC',
          isAnomalyDetectionEnabled: true,
        },
      });
      tsIds.push(timeseries.id);
      allTimeseries.push({ id: timeseries.id, datasetId: dataset.id, name: ts.name, unit: ts.unit, def: ts });
    }

    // Generate datapoints for each timeseries in this dataset
    // 30 days at 5-minute intervals = 8640 points per series
    const POINTS_PER_SERIES = 8640;
    const INTERVAL_MS = 5 * 60 * 1000;
    const BATCH_SIZE = 500;

    for (let ti = 0; ti < ds.timeseries.length; ti++) {
      const tsDef = ds.timeseries[ti];
      const tsId = tsIds[ti];

      const batch: {
        timeseriesId: string;
        timestamp: Date;
        valueJson: number;
        qualityScore: number;
        isOutlier: boolean;
        isAnomaly: boolean;
      }[] = [];

      for (let i = 0; i < POINTS_PER_SERIES; i++) {
        const timestamp = new Date(THIRTY_DAYS_AGO.getTime() + i * INTERVAL_MS);
        let value = sineWave(i, tsDef.baseValue, tsDef.amplitude, tsDef.period, tsDef.noiseAmplitude);
        const isOutlier = Math.random() < 0.015;
        const isAnomaly = Math.random() < 0.005;

        if (isOutlier) {
          value = withSpike(value, i, 1.0);
        }
        if (isAnomaly) {
          value = parseFloat((value * (1 + (Math.random() > 0.5 ? 1 : -1) * rand(0.5, 1.5))).toFixed(4));
        }

        batch.push({
          timeseriesId: tsId,
          timestamp,
          valueJson: value,
          qualityScore: parseFloat((0.9 + Math.random() * 0.1).toFixed(2)),
          isOutlier,
          isAnomaly,
        });

        if (batch.length >= BATCH_SIZE) {
          await prisma.datapoint.createMany({ data: batch, skipDuplicates: true });
          totalDatapoints += batch.length;
          batch.length = 0;
        }
      }

      // Flush remaining
      if (batch.length > 0) {
        await prisma.datapoint.createMany({ data: batch, skipDuplicates: true });
        totalDatapoints += batch.length;
      }
    }

    // Update dataset stats
    await prisma.dataset.update({
      where: { id: dataset.id },
      data: {
        sizeBytes: BigInt(POINTS_PER_SERIES * ds.timeseries.length * 128),
        rowsCount: POINTS_PER_SERIES * ds.timeseries.length,
      },
    });

    console.log(`       Dataset: ${ds.name} (${ds.timeseries.length} series, ${POINTS_PER_SERIES * ds.timeseries.length} points)`);
  }

  console.log(`       Total datapoints: ${totalDatapoints.toLocaleString()}`);

  // ------------------------------------------------------------------
  // 5. Create forecasting models
  // ------------------------------------------------------------------
  console.log('[5/9] Creating forecasting models...');

  const models: { id: string; timeseriesId: string }[] = [];

  // Create models for the first 5 timeseries
  for (let i = 0; i < Math.min(5, allTimeseries.length); i++) {
    const ts = allTimeseries[i];
    const modelDef = MODEL_DEFS[i % MODEL_DEFS.length];
    const trainedAt = new Date(NOW.getTime() - randInt(1, 14) * 24 * 60 * 60 * 1000);

    const model = await prisma.forecastingModel.create({
      data: {
        timeseriesId: ts.id,
        trainedById: pick(users).id,
        algorithm: modelDef.algorithm,
        hyperparameters: {
          description: modelDef.description,
          lookbackWindow: randInt(24, 168),
          forecastHorizon: randInt(12, 72),
          learningRate: parseFloat(rand(0.001, 0.01).toFixed(4)),
          epochs: randInt(50, 200),
          batchSize: pick([16, 32, 64, 128]),
        },
        trainingMetrics: {
          mae: parseFloat(rand(0.1, 5).toFixed(4)),
          rmse: parseFloat(rand(0.2, 7).toFixed(4)),
          mape: parseFloat(rand(1, 15).toFixed(2)),
          r2: parseFloat(rand(0.7, 0.99).toFixed(4)),
          trainingTimeSeconds: randInt(30, 600),
        },
        version: randInt(1, 5),
        isActive: Math.random() > 0.2,
        trainedAt,
        deployedAt: Math.random() > 0.3 ? new Date(trainedAt.getTime() + randInt(1, 60) * 60 * 1000) : null,
      },
    });
    models.push({ id: model.id, timeseriesId: ts.id });
    console.log(`       Model: ${modelDef.algorithm} -> ${ts.name}`);
  }

  // ------------------------------------------------------------------
  // 6. Create forecasts
  // ------------------------------------------------------------------
  console.log('[6/9] Creating forecasts...');

  let totalForecasts = 0;

  for (const model of models) {
    // Generate 48 forecast points (4 hours ahead at 5-min intervals)
    const forecastBatch: {
      modelId: string;
      timeseriesId: string;
      timestamp: Date;
      predictedValue: number;
      lowerBound: number;
      upperBound: number;
      confidence: number;
      anomalyProbability: number | null;
      isAnomaly: boolean;
    }[] = [];

    const baseTs = allTimeseries.find((t) => t.id === model.timeseriesId);
    const baseValue = baseTs?.def.baseValue ?? 50;

    for (let i = 0; i < 48; i++) {
      const timestamp = new Date(NOW.getTime() + i * 5 * 60 * 1000);
      const predicted = baseValue + Math.sin(i / 6) * (baseTs?.def.amplitude ?? 5) + (Math.random() - 0.5) * 2;
      const uncertainty = (i / 48) * 5 + 1; // uncertainty grows with horizon
      const confidence = Math.max(0.5, 0.98 - i * 0.008);

      forecastBatch.push({
        modelId: model.id,
        timeseriesId: model.timeseriesId,
        timestamp,
        predictedValue: parseFloat(predicted.toFixed(6)),
        lowerBound: parseFloat((predicted - uncertainty).toFixed(6)),
        upperBound: parseFloat((predicted + uncertainty).toFixed(6)),
        confidence: parseFloat(confidence.toFixed(2)),
        anomalyProbability: i > 30 ? parseFloat(rand(0.05, 0.4).toFixed(2)) : null,
        isAnomaly: false,
      });
    }

    await prisma.forecast.createMany({ data: forecastBatch });
    totalForecasts += forecastBatch.length;
  }

  console.log(`       Created ${totalForecasts} forecast points across ${models.length} models`);

  // ------------------------------------------------------------------
  // 7. Create anomalies
  // ------------------------------------------------------------------
  console.log('[7/9] Creating anomalies...');

  const anomalies: string[] = [];
  const anomalyDescriptions: Record<AnomalySeverity, string[]> = {
    LOW: ['Slightly elevated reading within tolerance', 'Brief minor fluctuation detected', 'Marginally outside normal range'],
    MEDIUM: ['Sustained deviation from baseline', 'Repeated pattern break detected', 'Two-sigma deviation sustained over 1 hour'],
    HIGH: ['Significant spike beyond threshold', 'Rapid change rate exceeding safety limits', 'Critical parameter drift detected'],
    CRITICAL: ['Emergency threshold exceeded', 'Sensor reading in dangerous range', 'System health critically degraded'],
  };

  for (let i = 0; i < 20; i++) {
    const ts = pick(allTimeseries);
    const severity = i < 3 ? 'CRITICAL' : i < 8 ? 'HIGH' : i < 14 ? 'MEDIUM' : 'LOW';
    const method = pick(DETECTION_METHODS);
    const createdAt = new Date(THIRTY_DAYS_AGO.getTime() + randInt(0, 29) * 24 * 60 * 60 * 1000);
    const isResolved = severity === 'LOW' || (severity === 'MEDIUM' && Math.random() > 0.4);
    const isInvestigated = isResolved || Math.random() > 0.3;

    const anomaly = await prisma.anomaly.create({
      data: {
        timeseriesId: ts.id,
        severity,
        detectionMethod: method,
        score: parseFloat(rand(50, 99).toFixed(2)),
        context: {
          description: pick(anomalyDescriptions[severity]),
          expectedRange: [ts.def.baseValue - ts.def.amplitude, ts.def.baseValue + ts.def.amplitude],
          actualValue: parseFloat(rand(ts.def.baseValue - ts.def.amplitude * 2, ts.def.baseValue + ts.def.amplitude * 2).toFixed(2)),
          sensorId: `SENSOR-${randInt(100, 999)}`,
          zone: `Zone ${randInt(1, 5)}`,
        },
        isInvestigated,
        isResolved,
        resolutionNotes: isResolved
          ? pick([
              'Confirmed as sensor calibration drift. Recalibrated sensor.',
              'Transient spike caused by power cycle. No action needed.',
              'Replaced faulty sensor. Values back to normal.',
              'Software update resolved false positive readings.',
              'Maintenance performed. Anomaly no longer present.',
            ])
          : null,
        resolvedAt: isResolved ? new Date(createdAt.getTime() + randInt(1, 48) * 60 * 60 * 1000) : null,
        createdAt,
      },
    });
    anomalies.push(anomaly.id);
  }

  console.log(`       Created ${anomalies.length} anomalies (mixed severity)`);

  // ------------------------------------------------------------------
  // 8. Create alert rules and alerts
  // ------------------------------------------------------------------
  console.log('[8/9] Creating alert rules and alerts...');

  const alertRuleDefs = [
    { name: 'High Temperature Warning', type: 'ANOMALY', severity: 'WARNING', conditions: { metric: 'value', operator: '>', threshold: 30, duration: '5m' } },
    { name: 'Critical Temperature Alert', type: 'ANOMALY', severity: 'ERROR', conditions: { metric: 'value', operator: '>', threshold: 40, duration: '1m' } },
    { name: 'Power Consumption Spike', type: 'ANOMALY', severity: 'WARNING', conditions: { metric: 'value', operator: '>', threshold: 6, duration: '10m' } },
    { name: 'Forecast Model Ready', type: 'FORECAST_READY', severity: 'INFO', conditions: { metric: 'accuracy', operator: '>', threshold: 0.9 } },
    { name: 'Low Battery Alert', type: 'ANOMALY', severity: 'ERROR', conditions: { metric: 'value', operator: '<', threshold: 20, duration: '5m' } },
  ];

  const alertRules: { id: string; timeseriesId: string }[] = [];
  for (let i = 0; i < alertRuleDefs.length; i++) {
    const ruleDef = alertRuleDefs[i];
    const ts = allTimeseries[i % allTimeseries.length];
    const rule = await prisma.alertRule.create({
      data: {
        userId: pick([adminUser.id, editorUser.id]),
        timeseriesId: ts.id,
        name: ruleDef.name,
        description: `Automated alert for ${ts.name}`,
        type: ruleDef.type,
        enabled: Math.random() > 0.1,
        conditions: ruleDef.conditions,
        severity: ruleDef.severity,
        channels: { email: true, webhook: Math.random() > 0.5 ? 'https://hooks.example.com/alert' : null },
        cooldownMinutes: pick([5, 10, 15, 30]),
        lastTriggeredAt: Math.random() > 0.3 ? new Date(NOW.getTime() - randInt(1, 48) * 60 * 60 * 1000) : null,
      },
    });
    alertRules.push({ id: rule.id, timeseriesId: ts.id });
  }

  // Create alerts
  const alertMessages: Record<string, string[]> = {
    ANOMALY: [
      'Anomaly detected: value exceeded threshold for the past 5 minutes',
      'Anomaly detected: statistical outlier in recent readings',
      'Anomaly detected: pattern deviation from historical baseline',
      'Anomaly detected: rapid change rate exceeds configured threshold',
    ],
    FORECAST_READY: [
      'Forecast model training completed successfully',
      'Forecast model updated with latest data and deployed',
    ],
    SYSTEM: [
      'System health check: data ingestion pipeline delayed',
      'System notification: maintenance window scheduled',
      'System notification: sensor firmware update available',
    ],
  };

  const alertSeverities: AlertSeverity[] = ['INFO', 'WARNING', 'ERROR'];

  let totalAlerts = 0;
  for (let i = 0; i < 15; i++) {
    const alertType: AlertType = i < 8 ? 'ANOMALY' : i < 11 ? 'FORECAST_READY' : 'SYSTEM';
    const ts = allTimeseries[i % allTimeseries.length];
    const rule = alertRules.find((r) => r.timeseriesId === ts.id);
    const severity = alertType === 'ANOMALY' ? pick(['WARNING', 'ERROR'] as AlertSeverity[]) : alertType === 'FORECAST_READY' ? 'INFO' : pick(alertSeverities);
    const isRead = i < 5; // first 5 are read

    await prisma.alert.create({
      data: {
        userId: pick([adminUser.id, editorUser.id]),
        timeseriesId: ts.id,
        alertRuleId: rule?.id ?? null,
        type: alertType,
        severity,
        message: pick(alertMessages[alertType]),
        metadata: {
          triggeredBy: alertType === 'ANOMALY' ? 'rule-engine' : 'system',
          datasetName: DATASETS.find((d) => d.timeseries.some((t) => t.name === ts.name))?.name ?? 'Unknown',
          timeseriesName: ts.name,
          threshold: alertType === 'ANOMALY' ? parseFloat(rand(20, 50).toFixed(1)) : null,
          actualValue: alertType === 'ANOMALY' ? parseFloat(rand(25, 55).toFixed(1)) : null,
        },
        isRead,
        sentAt: isRead ? new Date(NOW.getTime() - randInt(1, 24) * 60 * 60 * 1000) : null,
        createdAt: new Date(NOW.getTime() - randInt(0, 48) * 60 * 60 * 1000),
      },
    });
    totalAlerts++;
  }

  console.log(`       Created ${alertRules.length} alert rules and ${totalAlerts} alerts`);

  // ------------------------------------------------------------------
  // 9. Create API keys and misc
  // ------------------------------------------------------------------
  console.log('[9/9] Creating API keys and additional data...');

  const apiKeyHashes = [
    { name: 'Production API Key', hash: await bcrypt.hash('iotdb_prod_sk_a1b2c3d4e5f6g7h8', 4), lastChars: 'g7h8' },
    { name: 'Development API Key', hash: await bcrypt.hash('iotdb_dev_sk_x9y8z7w6v5u4t3s2', 4), lastChars: 's3s2' },
    { name: 'Monitoring Integration', hash: await bcrypt.hash('iotdb_mon_sk_p0o9i8u7y6t5r4e3', 4), lastChars: 'r4e3' },
  ];

  for (const keyData of apiKeyHashes) {
    await prisma.apiKey.create({
      data: {
        userId: adminUser.id,
        name: keyData.name,
        keyHash: keyData.hash,
        lastCharacters: parseInt(keyData.lastChars.slice(0, 4), 36) % 10000,
        isActive: true,
        usageCount: randInt(10, 5000),
        expiresAt: new Date(NOW.getTime() + randInt(30, 365) * 24 * 60 * 60 * 1000),
        lastUsedAt: new Date(NOW.getTime() - randInt(0, 48) * 60 * 60 * 1000),
      },
    });
  }

  // Create saved queries
  const savedQueries = [
    { name: 'Daily Temperature Average', params: { aggregation: 'avg', interval: '1d', metric: 'temperature' } },
    { name: 'Weekly Power Summary', params: { aggregation: 'sum', interval: '1w', metric: 'power' } },
    { name: 'Anomaly Count by Severity', params: { groupBy: 'severity', type: 'anomalies', period: '30d' } },
  ];

  for (const q of savedQueries) {
    await prisma.saved_queries.create({
      data: {
        id: `sq-${slugify(q.name)}`,
        user_id: adminUser.id,
        organization_id: org.id,
        name: q.name,
        description: `Saved query: ${q.name}`,
        query_params: q.params,
        is_public: true,
        usage_count: randInt(5, 200),
        last_used_at: new Date(NOW.getTime() - randInt(0, 72) * 60 * 60 * 1000),
      },
    });
  }

  // Create audit logs
  const auditActions = ['CREATE', 'READ', 'UPDATE', 'DELETE', 'EXPORT', 'LOGIN'] as const;
  const auditResources = [
    { type: 'dataset', actions: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'EXPORT'] },
    { type: 'timeseries', actions: ['CREATE', 'READ', 'UPDATE'] },
    { type: 'user', actions: ['CREATE', 'UPDATE', 'LOGIN'] },
    { type: 'forecast', actions: ['CREATE', 'READ'] },
    { type: 'anomaly', actions: ['READ', 'UPDATE'] },
  ];

  for (let i = 0; i < 30; i++) {
    const resource = pick(auditResources);
    const action = pick(resource.actions) as (typeof auditActions)[number];
    const user = pick(users);

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        resourceType: resource.type,
        resourceId: i < 10 ? pick(allTimeseries).datasetId : null,
        action,
        ipAddress: `192.168.${randInt(1, 10)}.${randInt(1, 254)}`,
        userAgent: pick([
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          'TradeMind-CLI/1.0',
        ]),
        success: Math.random() > 0.05,
        errorCode: Math.random() < 0.05 ? 'PERMISSION_DENIED' : null,
        createdAt: new Date(THIRTY_DAYS_AGO.getTime() + randInt(0, 29) * 24 * 60 * 60 * 1000),
      },
    });
  }

  // Create security audit logs
  const securityEvents = [
    { event: 'login_success', severity: 'INFO' },
    { event: 'login_failed', severity: 'WARNING' },
    { event: 'token_refresh', severity: 'INFO' },
    { event: 'password_change', severity: 'INFO' },
    { event: 'api_key_created', severity: 'INFO' },
    { event: 'permission_denied', severity: 'WARNING' },
    { event: 'rate_limit_exceeded', severity: 'WARNING' },
    { event: 'suspicious_activity', severity: 'HIGH' },
  ];

  for (let i = 0; i < 25; i++) {
    const evt = pick(securityEvents);
    await prisma.securityAuditLog.create({
      data: {
        event: evt.event,
        userId: pick(users).id,
        sessionId: `sess-${randInt(10000, 99999)}`,
        details: {
          ip: `192.168.${randInt(1, 10)}.${randInt(1, 254)}`,
          browser: pick(['Chrome', 'Firefox', 'Safari']),
          path: pick(['/api/datasets', '/api/timeseries', '/api/auth/login', '/api/alerts']),
        },
        severity: evt.severity,
        userAgent: pick([
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          'TradeMind-CLI/1.0',
        ]),
        url: pick(['/api/datasets', '/api/timeseries', '/api/auth/login', '/api/alerts', '/api/forecasts']),
        receivedAt: new Date(THIRTY_DAYS_AGO.getTime() + randInt(0, 29) * 24 * 60 * 60 * 1000),
      },
    });
  }

  console.log(`       Created ${apiKeyHashes.length} API keys`);
  console.log(`       Created ${savedQueries.length} saved queries`);
  console.log(`       Created 30 audit logs`);
  console.log(`       Created 25 security audit logs`);

  // ------------------------------------------------------------------
  // 10. Create TradeMind AI commodity data
  // ------------------------------------------------------------------
  console.log('[10/10] Creating TradeMind AI commodity data...');

  await prisma.commodityPrice.deleteMany();
  await prisma.marketFactor.deleteMany();
  await prisma.commodity.deleteMany();

  const COMMODITIES = [
    // Domestic beef cuts
    { slug: 'brisket_cn', name: 'Brisket (Domestic)', nameCn: '牛腩（国产）', category: 'beef_cuts', subcategory: 'brisket', originCountry: 'CN', unit: 'CNY/kg', currency: 'CNY' },
    { slug: 'shin_cn', name: 'Shin/Shank (Domestic)', nameCn: '牛腱（国产）', category: 'beef_cuts', subcategory: 'shin', originCountry: 'CN', unit: 'CNY/kg', currency: 'CNY' },
    { slug: 'sirloin_cn', name: 'Sirloin (Domestic)', nameCn: '西冷（国产）', category: 'beef_cuts', subcategory: 'sirloin', originCountry: 'CN', unit: 'CNY/kg', currency: 'CNY' },
    { slug: 'fatty_brisket_cn', name: 'Fatty Brisket (Domestic)', nameCn: '肥牛（国产）', category: 'beef_cuts', subcategory: 'fatty_brisket', originCountry: 'CN', unit: 'CNY/kg', currency: 'CNY' },
    { slug: 'thick_flank_cn', name: 'Thick Flank (Domestic)', nameCn: '牛展（国产）', category: 'beef_cuts', subcategory: 'thick_flank', originCountry: 'CN', unit: 'CNY/kg', currency: 'CNY' },
    { slug: 'oyster_blade_cn', name: 'Oyster Blade (Domestic)', nameCn: '板腱（国产）', category: 'beef_cuts', subcategory: 'oyster_blade', originCountry: 'CN', unit: 'CNY/kg', currency: 'CNY' },

    // Imported beef - Australia
    { slug: 'aus_brisket_m7', name: 'Australian Brisket M7', nameCn: '澳洲牛腩 M7', category: 'beef_cuts', subcategory: 'brisket', grade: 'M7', originCountry: 'AUS', factoryCode: '847', unit: 'CNY/kg', currency: 'CNY' },
    { slug: 'aus_sirloin_m9', name: 'Australian Sirloin M9', nameCn: '澳洲西冷 M9', category: 'beef_cuts', subcategory: 'sirloin', grade: 'M9', originCountry: 'AUS', factoryCode: '239', unit: 'CNY/kg', currency: 'CNY' },
    { slug: 'aus_shin_m5', name: 'Australian Shin M5', nameCn: '澳洲牛腱 M5', category: 'beef_cuts', subcategory: 'shin', grade: 'M5', originCountry: 'AUS', factoryCode: '1260', unit: 'CNY/kg', currency: 'CNY' },
    { slug: 'aus_oyster_blade_m7', name: 'Australian Oyster Blade M7', nameCn: '澳洲板腱 M7', category: 'beef_cuts', subcategory: 'oyster_blade', grade: 'M7', originCountry: 'AUS', factoryCode: '514', unit: 'CNY/kg', currency: 'CNY' },
    { slug: 'aus_thick_flank_m7', name: 'Australian Thick Flank M7', nameCn: '澳洲牛展 M7', category: 'beef_cuts', subcategory: 'thick_flank', grade: 'M7', originCountry: 'AUS', factoryCode: '847', unit: 'CNY/kg', currency: 'CNY' },

    // Imported beef - Brazil
    { slug: 'bra_brisket', name: 'Brazilian Brisket', nameCn: '巴西牛腩', category: 'beef_cuts', subcategory: 'brisket', originCountry: 'BRA', factoryCode: 'SIF2057', unit: 'CNY/kg', currency: 'CNY' },
    { slug: 'bra_shin', name: 'Brazilian Shin', nameCn: '巴西牛腱', category: 'beef_cuts', subcategory: 'shin', originCountry: 'BRA', factoryCode: 'SIF431', unit: 'CNY/kg', currency: 'CNY' },
    { slug: 'bra_frozen_boneless', name: 'Brazilian Frozen Boneless Beef', nameCn: '巴西冷冻去骨牛肉', category: 'beef_cuts', subcategory: 'boneless', originCountry: 'BRA', factoryCode: 'SIF2583', unit: 'CNY/kg', currency: 'CNY' },

    // Imported beef - Argentina
    { slug: 'arg_shin', name: 'Argentine Shin', nameCn: '阿根廷牛腱', category: 'beef_cuts', subcategory: 'shin', originCountry: 'ARG', factoryCode: '1920', unit: 'CNY/kg', currency: 'CNY' },
    { slug: 'arg_brisket', name: 'Argentine Brisket', nameCn: '阿根廷牛腩', category: 'beef_cuts', subcategory: 'brisket', originCountry: 'ARG', factoryCode: '2077', unit: 'CNY/kg', currency: 'CNY' },

    // Imported beef - Uruguay
    { slug: 'ury_thick_flank', name: 'Uruguayan Thick Flank', nameCn: '乌拉圭牛展', category: 'beef_cuts', subcategory: 'thick_flank', originCountry: 'URY', factoryCode: '379', unit: 'CNY/kg', currency: 'CNY' },
    { slug: 'ury_shin', name: 'Uruguayan Shin', nameCn: '乌拉圭牛腱', category: 'beef_cuts', subcategory: 'shin', originCountry: 'URY', factoryCode: '310', unit: 'CNY/kg', currency: 'CNY' },

    // Live cattle
    { slug: 'live_cattle_cn', name: 'Live Cattle (China)', nameCn: '国内活牛', category: 'live_cattle', originCountry: 'CN', unit: 'CNY/kg', currency: 'CNY' },

    // International futures
    { slug: 'cme_live_cattle', name: 'CME Live Cattle Futures', nameCn: 'CME活牛期货', category: 'futures', originCountry: 'USA', unit: 'USD/cwt', currency: 'USD' },
    { slug: 'cme_feeder_cattle', name: 'CME Feeder Cattle Futures', nameCn: 'CME育肥牛期货', category: 'futures', originCountry: 'USA', unit: 'USD/cwt', currency: 'USD' },

    // Grain & Feed
    { slug: 'corn_cn', name: 'Corn (China)', nameCn: '玉米', category: 'grain', originCountry: 'CN', unit: 'CNY/ton', currency: 'CNY' },
    { slug: 'soybean_meal_cn', name: 'Soybean Meal (China)', nameCn: '豆粕', category: 'feed', originCountry: 'CN', unit: 'CNY/ton', currency: 'CNY' },

    // Exchange rates
    { slug: 'usd_cny', name: 'USD/CNY', nameCn: '美元/人民币', category: 'forex', unit: 'rate', currency: 'CNY' },
    { slug: 'aud_usd', name: 'AUD/USD', nameCn: '澳元/美元', category: 'forex', unit: 'rate', currency: 'USD' },
    { slug: 'brl_usd', name: 'BRL/USD', nameCn: '雷亚尔/美元', category: 'forex', unit: 'rate', currency: 'USD' },

    // Additional domestic beef cuts
    { slug: 'ribeye_cn', name: 'Ribeye (Domestic)', nameCn: '眼肉（国产）', category: 'beef_cuts', subcategory: 'ribeye', originCountry: 'CN', unit: 'CNY/kg', currency: 'CNY' },
    { slug: 'tenderloin_cn', name: 'Tenderloin (Domestic)', nameCn: '牛柳（国产）', category: 'beef_cuts', subcategory: 'tenderloin', originCountry: 'CN', unit: 'CNY/kg', currency: 'CNY' },
    { slug: 'beef_tripe_cn', name: 'Beef Tripe (Domestic)', nameCn: '牛肚（国产）', category: 'beef_cuts', subcategory: 'offal', originCountry: 'CN', unit: 'CNY/kg', currency: 'CNY' },
    { slug: 'beef_tendon_cn', name: 'Beef Tendon (Domestic)', nameCn: '牛筋（国产）', category: 'beef_cuts', subcategory: 'offal', originCountry: 'CN', unit: 'CNY/kg', currency: 'CNY' },

    // Additional imported beef
    { slug: 'aus_rump_m5', name: 'Australian Rump M5', nameCn: '澳洲黄瓜条 M5', category: 'beef_cuts', subcategory: 'rump', grade: 'M5', originCountry: 'AUS', factoryCode: '239', unit: 'CNY/kg', currency: 'CNY' },
    { slug: 'aus_cube_roll_m9', name: 'Australian Cube Roll M9', nameCn: '澳洲眼肉 M9', category: 'beef_cuts', subcategory: 'cube_roll', grade: 'M9', originCountry: 'AUS', factoryCode: '239', unit: 'CNY/kg', currency: 'CNY' },
    { slug: 'bra_topside', name: 'Brazilian Topside', nameCn: '巴西小米龙', category: 'beef_cuts', subcategory: 'topside', originCountry: 'BRA', factoryCode: 'SIF2057', unit: 'CNY/kg', currency: 'CNY' },
    { slug: 'bra_round', name: 'Brazilian Round', nameCn: '巴西大黄瓜条', category: 'beef_cuts', subcategory: 'round', originCountry: 'BRA', factoryCode: 'SIF431', unit: 'CNY/kg', currency: 'CNY' },
    { slug: 'arg_forequarter', name: 'Argentine Forequarter', nameCn: '阿根廷前腱', category: 'beef_cuts', subcategory: 'forequarter', originCountry: 'ARG', factoryCode: '1920', unit: 'CNY/kg', currency: 'CNY' },
    { slug: 'ury_boneless', name: 'Uruguayan Boneless Beef', nameCn: '乌拉圭去骨牛肉', category: 'beef_cuts', subcategory: 'boneless', originCountry: 'URY', factoryCode: '379', unit: 'CNY/kg', currency: 'CNY' },

    // Other meat
    { slug: 'nz_lamb_leg', name: 'NZ Lamb Leg', nameCn: '新西兰羊腿', category: 'other_meat', subcategory: 'lamb', originCountry: 'NZ', unit: 'CNY/kg', currency: 'CNY' },

    // Additional grain & feed
    { slug: 'wheat_cn', name: 'Wheat (China)', nameCn: '小麦', category: 'grain', originCountry: 'CN', unit: 'CNY/ton', currency: 'CNY' },
    { slug: 'sorghum_cn', name: 'Sorghum (China)', nameCn: '高粱', category: 'grain', originCountry: 'CN', unit: 'CNY/ton', currency: 'CNY' },
    { slug: 'soybean_oil_cn', name: 'Soybean Oil (China)', nameCn: '豆油', category: 'feed', originCountry: 'CN', unit: 'CNY/ton', currency: 'CNY' },
    { slug: 'dalian_palm_oil', name: 'Palm Oil (Dalian)', nameCn: '棕榈油（大商所）', category: 'feed', originCountry: 'MY', unit: 'CNY/ton', currency: 'CNY' },

    // Additional forex
    { slug: 'eur_usd', name: 'EUR/USD', nameCn: '欧元/美元', category: 'forex', unit: 'rate', currency: 'USD' },
    { slug: 'gbp_usd', name: 'GBP/USD', nameCn: '英镑/美元', category: 'forex', unit: 'rate', currency: 'USD' },

    // Shipping index
    { slug: 'bdi', name: 'Baltic Dry Index', nameCn: '波罗的海干散货指数', category: 'shipping', unit: 'index', currency: 'USD' },

    // USDA AMS sourced (US livestock prices)
    { slug: 'live_cattle_us', name: 'US Live Cattle (5-Area)', nameCn: '美国活牛（五区加权）', category: 'futures', originCountry: 'USA', unit: 'USD/cwt', currency: 'USD' },
    { slug: 'feeder_cattle_us', name: 'US Feeder Cattle', nameCn: '美国育肥牛', category: 'futures', originCountry: 'USA', unit: 'USD/cwt', currency: 'USD' },
    { slug: 'boxed_beef_choice', name: 'US Boxed Beef Choice Cutout', nameCn: '美国Choice级箱切牛肉', category: 'beef_cuts', subcategory: 'cutout', originCountry: 'USA', unit: 'USD/cwt', currency: 'USD' },
    { slug: 'beef_cutout_us', name: 'US Beef Cutout Composite', nameCn: '美国牛肉综合切割价值', category: 'beef_cuts', subcategory: 'cutout', originCountry: 'USA', unit: 'USD/cwt', currency: 'USD' },

    // FAO Food Price Indices
    { slug: 'fao_food_index', name: 'FAO Food Price Index', nameCn: 'FAO食品价格指数', category: 'index', unit: 'index', currency: 'USD' },
    { slug: 'fao_meat_index', name: 'FAO Meat Price Index', nameCn: 'FAO肉类价格指数', category: 'index', unit: 'index', currency: 'USD' },
    { slug: 'fao_dairy_index', name: 'FAO Dairy Price Index', nameCn: 'FAO乳制品价格指数', category: 'index', unit: 'index', currency: 'USD' },
    { slug: 'fao_cereals_index', name: 'FAO Cereals Price Index', nameCn: 'FAO谷物价格指数', category: 'index', unit: 'index', currency: 'USD' },
    { slug: 'fao_oils_index', name: 'FAO Oils Price Index', nameCn: 'FAO油脂价格指数', category: 'index', unit: 'index', currency: 'USD' },

    // US grain futures
    { slug: 'us_soybean', name: 'US Soybean Futures', nameCn: '美豆期货', category: 'futures', originCountry: 'USA', unit: 'US cents/bushel', currency: 'USD' },

    // ── World Bank commodities (energy) ──
    { slug: 'crude_oil_wti', name: 'Crude Oil (WTI)', nameCn: 'WTI原油', category: 'energy', unit: 'USD/bbl', currency: 'USD' },
    { slug: 'crude_oil_brent', name: 'Crude Oil (Brent)', nameCn: '布伦特原油', category: 'energy', unit: 'USD/bbl', currency: 'USD' },
    { slug: 'natural_gas_us', name: 'Natural Gas (US)', nameCn: '天然气（美国）', category: 'energy', unit: 'USD/MMBtu', currency: 'USD' },
    { slug: 'coal_australia', name: 'Coal (Australia)', nameCn: '澳洲煤炭', category: 'energy', unit: 'USD/ton', currency: 'USD' },

    // ── World Bank commodities (metals) ──
    { slug: 'copper_lme', name: 'Copper (LME)', nameCn: 'LME铜', category: 'metals', unit: 'USD/ton', currency: 'USD' },
    { slug: 'aluminum_lme', name: 'Aluminum (LME)', nameCn: 'LME铝', category: 'metals', unit: 'USD/ton', currency: 'USD' },
    { slug: 'iron_ore_cfr', name: 'Iron Ore (CFR China)', nameCn: '铁矿石（中国CFR）', category: 'metals', unit: 'USD/ton', currency: 'USD' },
    { slug: 'gold_lbma', name: 'Gold (LBMA)', nameCn: '黄金（LBMA）', category: 'metals', unit: 'USD/troy oz', currency: 'USD' },
    { slug: 'silver_lbma', name: 'Silver (LBMA)', nameCn: '白银（LBMA）', category: 'metals', unit: 'USD/troy oz', currency: 'USD' },

    // ── World Bank commodities (grains & oilseeds) ──
    { slug: 'soybeans_cbot', name: 'Soybeans (CBOT)', nameCn: '大豆（CBOT）', category: 'grain', unit: 'USD/ton', currency: 'USD' },
    { slug: 'soybean_meal_cbot', name: 'Soybean Meal (CBOT)', nameCn: '豆粕（CBOT）', category: 'feed', unit: 'USD/ton', currency: 'USD' },
    { slug: 'soybean_oil_cbot', name: 'Soybean Oil (CBOT)', nameCn: '豆油（CBOT）', category: 'feed', unit: 'USD/ton', currency: 'USD' },
    { slug: 'wheat_us_srw', name: 'Wheat (US SRW)', nameCn: '小麦（美国软红冬）', category: 'grain', unit: 'USD/ton', currency: 'USD' },
    { slug: 'wheat_us_hrw', name: 'Wheat (US HRW)', nameCn: '小麦（美国硬红冬）', category: 'grain', unit: 'USD/ton', currency: 'USD' },
    { slug: 'corn_cbot', name: 'Corn (CBOT)', nameCn: '玉米（CBOT）', category: 'grain', unit: 'USD/ton', currency: 'USD' },
    { slug: 'rice_thai', name: 'Rice (Thai 5%)', nameCn: '大米（泰国5%）', category: 'grain', unit: 'USD/ton', currency: 'USD' },

    // ── World Bank commodities (soft commodities) ──
    { slug: 'sugar_world', name: 'Sugar (World)', nameCn: '糖（国际）', category: 'soft_commodities', unit: 'USD/kg', currency: 'USD' },
    { slug: 'coffee_arabica', name: 'Coffee (Arabica)', nameCn: '咖啡（阿拉比卡）', category: 'soft_commodities', unit: 'USD/kg', currency: 'USD' },
    { slug: 'coffee_robusta', name: 'Coffee (Robusta)', nameCn: '咖啡（罗布斯塔）', category: 'soft_commodities', unit: 'USD/kg', currency: 'USD' },
    { slug: 'cocoa', name: 'Cocoa', nameCn: '可可', category: 'soft_commodities', unit: 'USD/kg', currency: 'USD' },
    { slug: 'cotton_cotlook', name: 'Cotton (Cotlook A)', nameCn: '棉花（Cotlook A）', category: 'soft_commodities', unit: 'USD/kg', currency: 'USD' },
    { slug: 'rubber_tsr20', name: 'Rubber (TSR20)', nameCn: '橡胶（TSR20）', category: 'soft_commodities', unit: 'USD/kg', currency: 'USD' },

    // ── World Bank commodities (meat & dairy) ──
    { slug: 'beef_australia', name: 'Beef (Australia)', nameCn: '牛肉（澳洲）', category: 'meat_dairy', unit: 'USD/kg', currency: 'USD' },
    { slug: 'beef_us_choice', name: 'Beef (US Choice)', nameCn: '牛肉（美国Choice）', category: 'meat_dairy', unit: 'USD/kg', currency: 'USD' },
    { slug: 'chicken_whole', name: 'Chicken (Whole)', nameCn: '整鸡', category: 'meat_dairy', unit: 'USD/kg', currency: 'USD' },

    // ── World Bank commodities (fertilizers) ──
    { slug: 'urea', name: 'Urea', nameCn: '尿素', category: 'fertilizer', unit: 'USD/ton', currency: 'USD' },
    { slug: 'diammonium_phosphate', name: 'DAP Fertilizer', nameCn: '磷酸二铵', category: 'fertilizer', unit: 'USD/ton', currency: 'USD' },
    { slug: 'potassium_chloride', name: 'Potash (MOP)', nameCn: '氯化钾', category: 'fertilizer', unit: 'USD/ton', currency: 'USD' },

    // ── CME Futures (additional) ──
    { slug: 'live_cattle_cme', name: 'Live Cattle Futures (CME)', nameCn: '活牛期货（CME）', category: 'futures', originCountry: 'USA', unit: 'USD/cwt', currency: 'USD' },
    { slug: 'feeder_cattle_cme', name: 'Feeder Cattle Futures (CME)', nameCn: '育肥牛期货（CME）', category: 'futures', originCountry: 'USA', unit: 'USD/cwt', currency: 'USD' },
    { slug: 'lean_hogs_cme', name: 'Lean Hogs Futures (CME)', nameCn: '瘦肉猪期货（CME）', category: 'futures', originCountry: 'USA', unit: 'USD/cwt', currency: 'USD' },
    { slug: 'corn_cme', name: 'Corn Futures (CME)', nameCn: '玉米期货（CME）', category: 'futures', originCountry: 'USA', unit: 'USD/bu', currency: 'USD' },
    { slug: 'soybeans_cme', name: 'Soybean Futures (CME)', nameCn: '大豆期货（CME）', category: 'futures', originCountry: 'USA', unit: 'USD/bu', currency: 'USD' },
    { slug: 'wheat_cme', name: 'Wheat Futures (CME)', nameCn: '小麦期货（CME）', category: 'futures', originCountry: 'USA', unit: 'USD/bu', currency: 'USD' },
    { slug: 'soybean_meal_cme', name: 'Soybean Meal Futures (CME)', nameCn: '豆粕期货（CME）', category: 'futures', originCountry: 'USA', unit: 'USD/ton', currency: 'USD' },
    { slug: 'soybean_oil_cme', name: 'Soybean Oil Futures (CME)', nameCn: '豆油期货（CME）', category: 'futures', originCountry: 'USA', unit: 'USD/lb', currency: 'USD' },
    { slug: 'crude_oil_cme', name: 'Crude Oil Futures (CME)', nameCn: '原油期货（CME）', category: 'futures', originCountry: 'USA', unit: 'USD/bbl', currency: 'USD' },
    { slug: 'natural_gas_cme', name: 'Natural Gas Futures (CME)', nameCn: '天然气期货（CME）', category: 'futures', originCountry: 'USA', unit: 'USD/MMBtu', currency: 'USD' },
    { slug: 'gold_cme', name: 'Gold Futures (CME)', nameCn: '黄金期货（CME）', category: 'futures', originCountry: 'USA', unit: 'USD/troy oz', currency: 'USD' },
    { slug: 'coffee_cme', name: 'Coffee Futures (CME)', nameCn: '咖啡期货（CME）', category: 'futures', unit: 'USD/lb', currency: 'USD' },
    { slug: 'sugar11_cme', name: 'Sugar #11 Futures (CME)', nameCn: '糖11号期货（CME）', category: 'futures', unit: 'USD/lb', currency: 'USD' },
    { slug: 'cotton2_cme', name: 'Cotton #2 Futures (CME)', nameCn: '棉花2号期货（CME）', category: 'futures', unit: 'USD/lb', currency: 'USD' },

    // ── Indices ──
    { slug: 'commodity_price_index', name: 'Commodity Price Index', nameCn: '大宗商品价格指数', category: 'indices', unit: 'index', currency: 'USD' },
  ];

  // Price baselines for generating realistic data
  const PRICE_BASELINES: Record<string, { base: number; volatility: number }> = {
    brisket_cn: { base: 52, volatility: 3 },
    shin_cn: { base: 68, volatility: 4 },
    sirloin_cn: { base: 85, volatility: 5 },
    fatty_brisket_cn: { base: 45, volatility: 3 },
    thick_flank_cn: { base: 60, volatility: 4 },
    oyster_blade_cn: { base: 72, volatility: 4 },
    aus_brisket_m7: { base: 42, volatility: 3 },
    aus_sirloin_m9: { base: 95, volatility: 6 },
    aus_shin_m5: { base: 38, volatility: 2 },
    aus_oyster_blade_m7: { base: 58, volatility: 4 },
    aus_thick_flank_m7: { base: 48, volatility: 3 },
    bra_brisket: { base: 32, volatility: 2 },
    bra_shin: { base: 36, volatility: 2 },
    bra_frozen_boneless: { base: 28, volatility: 2 },
    arg_shin: { base: 38, volatility: 2 },
    arg_brisket: { base: 30, volatility: 2 },
    ury_thick_flank: { base: 40, volatility: 3 },
    ury_shin: { base: 42, volatility: 3 },
    live_cattle_cn: { base: 24, volatility: 1.5 },
    cme_live_cattle: { base: 185, volatility: 8 },
    cme_feeder_cattle: { base: 245, volatility: 12 },
    corn_cn: { base: 2600, volatility: 100 },
    soybean_meal_cn: { base: 3800, volatility: 150 },
    usd_cny: { base: 7.25, volatility: 0.1 },
    aud_usd: { base: 0.65, volatility: 0.015 },
    brl_usd: { base: 0.18, volatility: 0.008 },
    ribeye_cn: { base: 120, volatility: 5 },
    tenderloin_cn: { base: 180, volatility: 8 },
    beef_tripe_cn: { base: 35, volatility: 2 },
    beef_tendon_cn: { base: 55, volatility: 3 },
    aus_rump_m5: { base: 48, volatility: 2 },
    aus_cube_roll_m9: { base: 110, volatility: 6 },
    bra_topside: { base: 28, volatility: 1.5 },
    bra_round: { base: 25, volatility: 1.2 },
    arg_forequarter: { base: 24, volatility: 1 },
    ury_boneless: { base: 30, volatility: 1.5 },
    nz_lamb_leg: { base: 65, volatility: 4 },
    wheat_cn: { base: 2900, volatility: 60 },
    sorghum_cn: { base: 2400, volatility: 50 },
    soybean_oil_cn: { base: 8200, volatility: 200 },
    dalian_palm_oil: { base: 7800, volatility: 180 },
    eur_usd: { base: 1.08, volatility: 0.008 },
    gbp_usd: { base: 1.27, volatility: 0.01 },
    bdi: { base: 1800, volatility: 60 },
    live_cattle_us: { base: 185, volatility: 8 },
    feeder_cattle_us: { base: 245, volatility: 12 },
    boxed_beef_choice: { base: 310, volatility: 10 },
    beef_cutout_us: { base: 290, volatility: 8 },
    fao_food_index: { base: 125, volatility: 3 },
    fao_meat_index: { base: 118, volatility: 4 },
    fao_dairy_index: { base: 130, volatility: 5 },
    fao_cereals_index: { base: 135, volatility: 6 },
    fao_oils_index: { base: 150, volatility: 7 },
    us_soybean: { base: 1400, volatility: 30 },

    // World Bank energy
    crude_oil_wti: { base: 72, volatility: 3 },
    crude_oil_brent: { base: 76, volatility: 3 },
    natural_gas_us: { base: 2.5, volatility: 0.2 },
    coal_australia: { base: 130, volatility: 8 },

    // World Bank metals
    copper_lme: { base: 9200, volatility: 200 },
    aluminum_lme: { base: 2350, volatility: 50 },
    iron_ore_cfr: { base: 120, volatility: 5 },
    gold_lbma: { base: 2350, volatility: 30 },
    silver_lbma: { base: 28, volatility: 0.8 },

    // World Bank grains
    soybeans_cbot: { base: 420, volatility: 15 },
    soybean_meal_cbot: { base: 380, volatility: 12 },
    soybean_oil_cbot: { base: 950, volatility: 25 },
    wheat_us_srw: { base: 240, volatility: 10 },
    wheat_us_hrw: { base: 280, volatility: 12 },
    corn_cbot: { base: 190, volatility: 8 },
    rice_thai: { base: 560, volatility: 20 },

    // World Bank soft commodities
    sugar_world: { base: 0.28, volatility: 0.02 },
    coffee_arabica: { base: 4.5, volatility: 0.3 },
    coffee_robusta: { base: 3.2, volatility: 0.2 },
    cocoa: { base: 8.5, volatility: 0.5 },
    cotton_cotlook: { base: 1.9, volatility: 0.08 },
    rubber_tsr20: { base: 1.6, volatility: 0.06 },

    // World Bank meat & dairy
    beef_australia: { base: 5.8, volatility: 0.2 },
    beef_us_choice: { base: 6.2, volatility: 0.25 },
    chicken_whole: { base: 2.5, volatility: 0.1 },

    // World Bank fertilizers
    urea: { base: 350, volatility: 15 },
    diammonium_phosphate: { base: 580, volatility: 20 },
    potassium_chloride: { base: 320, volatility: 12 },

    // CME futures
    live_cattle_cme: { base: 188, volatility: 5 },
    feeder_cattle_cme: { base: 255, volatility: 8 },
    lean_hogs_cme: { base: 82, volatility: 3 },
    corn_cme: { base: 4.5, volatility: 0.15 },
    soybeans_cme: { base: 12.5, volatility: 0.3 },
    wheat_cme: { base: 5.8, volatility: 0.2 },
    soybean_meal_cme: { base: 340, volatility: 10 },
    soybean_oil_cme: { base: 0.52, volatility: 0.02 },
    crude_oil_cme: { base: 72, volatility: 2 },
    natural_gas_cme: { base: 2.4, volatility: 0.15 },
    gold_cme: { base: 2350, volatility: 25 },
    coffee_cme: { base: 1.85, volatility: 0.08 },
    sugar11_cme: { base: 0.22, volatility: 0.01 },
    cotton2_cme: { base: 0.72, volatility: 0.03 },

    // Indices
    commodity_price_index: { base: 180, volatility: 4 },
  };

  // Create commodities
  let commodityCount = 0;
  for (const c of COMMODITIES) {
    await prisma.commodity.create({
      data: {
        slug: c.slug,
        name: c.name,
        nameCn: c.nameCn ?? null,
        category: c.category,
        subcategory: c.subcategory ?? null,
        grade: c.grade ?? null,
        originCountry: c.originCountry ?? null,
        factoryCode: c.factoryCode ?? null,
        unit: c.unit,
        currency: c.currency,
        metadata: { source: 'seed', importType: c.category === 'forex' ? 'api' : 'manual' },
      },
    });
    commodityCount++;
  }

  // Generate 180 days of daily price data for each commodity
  const DAYS = 180;
  let priceCount = 0;
  const priceBatch: {
    commodityId: string;
    date: Date;
    interval: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number | null;
    source: string;
    metadata: any;
  }[] = [];

  const commodities = await prisma.commodity.findMany();
  const BATCH_SIZE = 500;

  for (const commodity of commodities) {
    const baseline = PRICE_BASELINES[commodity.slug];
    if (!baseline) continue;

    let price = baseline.base;

    for (let d = 0; d < DAYS; d++) {
      const date = new Date(NOW.getTime() - (DAYS - d) * 24 * 60 * 60 * 1000);
      // Skip weekends for futures
      if (commodity.category === 'futures' && (date.getDay() === 0 || date.getDay() === 6)) continue;

      const change = (Math.random() - 0.48) * baseline.volatility;
      price = Math.max(price * 0.8, Math.min(price * 1.2, price + change));

      const open = parseFloat((price + (Math.random() - 0.5) * baseline.volatility * 0.3).toFixed(4));
      const close = parseFloat(price.toFixed(4));
      const high = parseFloat(Math.max(open, close, price + Math.random() * baseline.volatility * 0.5).toFixed(4));
      const low = parseFloat(Math.min(open, close, price - Math.random() * baseline.volatility * 0.5).toFixed(4));

      let metadata: Record<string, unknown> | null = null;
      if (commodity.category === 'beef_cuts' && commodity.originCountry !== 'CN') {
        metadata = {
          spot_cny_kg: close,
          shipping_cost_usd_ton: 250 + Math.random() * 60,
          tariff_rate: commodity.originCountry === 'AUS' ? 0 : 0.12,
        };
      } else if (commodity.category === 'futures') {
        metadata = {
          futures_usd_ton: close * 2.20462, // cwt to ton
          open_interest: Math.floor(Math.random() * 50000 + 10000),
        };
      }

      priceBatch.push({
        commodityId: commodity.id,
        date,
        interval: 'daily',
        open,
        high,
        low,
        close,
        volume: commodity.category === 'futures' ? Math.floor(Math.random() * 20000 + 5000) : null,
        source: 'seed',
        metadata,
      });

      if (priceBatch.length >= BATCH_SIZE) {
        await prisma.commodityPrice.createMany({ data: priceBatch, skipDuplicates: true });
        priceCount += priceBatch.length;
        priceBatch.length = 0;
      }
    }
  }

  // Flush remaining
  if (priceBatch.length > 0) {
    await prisma.commodityPrice.createMany({ data: priceBatch, skipDuplicates: true });
    priceCount += priceBatch.length;
  }

  // Multi-source overlay: add a second source for key commodities so the
  // multi-source chart toggle can be demonstrated.
  const MULTI_SOURCE_SLUGS = [
    'aus_sirloin_m9',
    'aus_cube_roll_m9',
    'corn_cbot',
    'soybeans_cbot',
    'wheat_us_srw',
    'sugar_world',
    'coffee_arabica',
    'cotton_cotlook',
    'crude_oil_brent',
    'live_cattle_cme',
    'crude_oil_wti',
    'gold_lbma',
    'copper_lme',
    'beef_australia',
    'wheat_cn',
    'corn_cme',
  ];
  const multiBatch: typeof priceBatch = [];
  for (const commodity of commodities) {
    if (!MULTI_SOURCE_SLUGS.includes(commodity.slug)) continue;
    const baseline = PRICE_BASELINES[commodity.slug];
    if (!baseline) continue;

    let price = baseline.base;
    for (let d = 0; d < DAYS; d++) {
      const date = new Date(NOW.getTime() - (DAYS - d) * 24 * 60 * 60 * 1000);
      if (commodity.category === 'futures' && (date.getDay() === 0 || date.getDay() === 6)) continue;

      const change = (Math.random() - 0.48) * baseline.volatility;
      price = Math.max(price * 0.8, Math.min(price * 1.2, price + change));

      const close = parseFloat(price.toFixed(4));
      const open = parseFloat((price + (Math.random() - 0.5) * baseline.volatility * 0.3).toFixed(4));
      const high = parseFloat(Math.max(open, close) * (1 + Math.random() * 0.005).toFixed(4));
      const low = parseFloat(Math.min(open, close) * (1 - Math.random() * 0.005).toFixed(4));

      multiBatch.push({
        commodityId: commodity.id,
        date,
        interval: 'daily',
        open,
        high,
        low,
        close,
        volume: null,
        source: 'usda_ams',
        metadata: null,
      });

      if (multiBatch.length >= BATCH_SIZE) {
        await prisma.commodityPrice.createMany({ data: multiBatch, skipDuplicates: true });
        priceCount += multiBatch.length;
        multiBatch.length = 0;
      }
    }
  }
  if (multiBatch.length > 0) {
    await prisma.commodityPrice.createMany({ data: multiBatch, skipDuplicates: true });
    priceCount += multiBatch.length;
  }

  // Generate exchange rate market factors
  const fxRates = [
    { type: 'exchange_rate', region: 'US/CN', value: 7.25, unit: 'CNY/USD' },
    { type: 'exchange_rate', region: 'AU/US', value: 0.65, unit: 'AUD/USD' },
    { type: 'exchange_rate', region: 'BR/US', value: 0.18, unit: 'BRL/USD' },
  ];

  for (const fx of fxRates) {
    let rate = fx.value;
    for (let d = 0; d < 30; d++) {
      rate += (Math.random() - 0.5) * 0.01;
      await prisma.marketFactor.create({
        data: {
          type: fx.type,
          region: fx.region,
          date: new Date(NOW.getTime() - (30 - d) * 24 * 60 * 60 * 1000),
          value: parseFloat(rate.toFixed(6)),
          unit: fx.unit,
          source: 'seed',
        },
      });
    }
  }

  console.log(`       Created ${commodityCount} commodities`);
  console.log(`       Created ${priceCount} price records (${DAYS} days each)`);
  console.log(`       Created ${fxRates.length * 30} market factor records`);

  // ------------------------------------------------------------------
  // Beef Data: Factories, Cut Taxonomy, Sample Prices
  // ------------------------------------------------------------------
  console.log('');
  console.log('  Seeding Beef Data...');

  // Factories
  const FACTORIES = [
    // Australia
    { code: 'AU-847', name: 'Teys Wagga Wagga', nameLocal: 'Teys Wagga Wagga', country: 'AU', region: 'NSW', capacity: 1200, accredited: ['CN', 'US', 'JP', 'EU', 'KR'] },
    { code: 'AU-239', name: 'JBS Beef City', nameLocal: 'JBS Beef City', country: 'AU', region: 'QLD', capacity: 1400, accredited: ['CN', 'US', 'JP', 'EU', 'KR'] },
    { code: 'AU-1260', name: 'Teys Naracoorte', nameLocal: 'Teys Naracoorte', country: 'AU', region: 'SA', capacity: 900, accredited: ['CN', 'US', 'JP', 'EU'] },
    { code: 'AU-514', name: 'Australian Meat Holdings', nameLocal: 'AMH Dinmore', country: 'AU', region: 'QLD', capacity: 1500, accredited: ['CN', 'US', 'JP', 'EU'] },
    { code: 'AU-235', name: 'JBS Riverina', nameLocal: 'JBS Riverina', country: 'AU', region: 'NSW', capacity: 1000, accredited: ['CN', 'US', 'JP', 'EU'] },
    { code: 'AU-93', name: 'Thomas Foods International', nameLocal: 'Thomas Foods', country: 'AU', region: 'SA', capacity: 800, accredited: ['CN', 'US', 'EU'] },
    // Brazil
    { code: 'BR-SIF2057', name: 'JBS Lins', nameLocal: 'JBS Lins', country: 'BR', region: 'SP', capacity: 2000, accredited: ['CN', 'US', 'EU', 'KR', 'JP'] },
    { code: 'BR-SIF431', name: 'Marfrig Bataguassu', nameLocal: 'Marfrig Bataguassu', country: 'BR', region: 'MS', capacity: 1800, accredited: ['CN', 'US', 'EU', 'KR'] },
    { code: 'BR-SIF2583', name: 'Minerva Uberaba', nameLocal: 'Minerva Uberaba', country: 'BR', region: 'MG', capacity: 1200, accredited: ['CN', 'EU', 'KR'] },
    { code: 'BR-SIF2011', name: 'JBS Barretos', nameLocal: 'JBS Barretos', country: 'BR', region: 'SP', capacity: 2500, accredited: ['CN', 'US', 'EU', 'KR', 'JP'] },
    { code: 'BR-SIF379', name: 'Marfrig Várzea Grande', nameLocal: 'Marfrig Várzea Grande', country: 'BR', region: 'MT', capacity: 1500, accredited: ['CN', 'EU'] },
    // Argentina
    { code: 'AR-1920', name: 'Swift Rosario', nameLocal: 'Swift Rosario', country: 'AR', region: 'Santa Fe', capacity: 1100, accredited: ['CN', 'EU', 'IL', 'CL'] },
    { code: 'AR-2077', name: 'Quickfood', nameLocal: 'Quickfood', country: 'AR', region: 'Buenos Aires', capacity: 800, accredited: ['CN', 'EU', 'US'] },
    { code: 'AR-2008', name: 'Friar San Jorge', nameLocal: 'Friar San Jorge', country: 'AR', region: 'Córdoba', capacity: 600, accredited: ['CN', 'EU'] },
    // Uruguay
    { code: 'UY-379', name: 'Frigorífico Rosario', nameLocal: 'Frigorífico Rosario', country: 'UY', region: 'Colonia', capacity: 500, accredited: ['CN', 'US', 'EU', 'KR'] },
    { code: 'UY-310', name: 'Frigorífico pul', nameLocal: 'Frigorífico pul', country: 'UY', region: 'Canelones', capacity: 450, accredited: ['CN', 'US', 'EU'] },
    // USA
    { code: 'US-JBS-GREELEY', name: 'JBS USA Greeley', nameLocal: 'JBS Greeley', country: 'US', region: 'CO', capacity: 5500, accredited: ['JP', 'KR', 'MX'] },
    { code: 'US-CARGILL-DODGE', name: 'Cargill Dodge City', nameLocal: 'Cargill Dodge City', country: 'US', region: 'KS', capacity: 5000, accredited: ['JP', 'KR', 'MX'] },
    { code: 'US-TYSON-DAKOTA', name: 'Tyson Dakota City', nameLocal: 'Tyson Dakota City', country: 'US', region: 'NE', capacity: 6000, accredited: ['JP', 'KR', 'MX'] },
    { code: 'US-NATIONAL-DENVER', name: 'National Beef Denver', nameLocal: 'National Denver', country: 'US', region: 'CO', capacity: 3000, accredited: ['JP', 'KR'] },
  ];

  for (const f of FACTORIES) {
    await prisma.factory.upsert({
      where: { code: f.code },
      update: { name: f.name, nameLocal: f.nameLocal, region: f.region, capacity: f.capacity, accredited: f.accredited },
      create: f,
    });
  }
  console.log(`       Created ${FACTORIES.length} factories`);

  // Beef Cut Taxonomy — use the normalizer data
  const { getAllCutMappings } = await import('../src/services/dataIngestion/beefCutNormalizer');
  const cutMappings = getAllCutMappings();
  let cutCount = 0;
  for (const cut of cutMappings) {
    await prisma.beefCutTaxonomy.upsert({
      where: { cutCode: cut.cutCode },
      update: {},
      create: {
        cutCode: cut.cutCode,
        nameEn: cut.nameEn,
        nameZh: cut.nameZh ?? null,
        nameEs: cut.nameEs ?? null,
        namePt: cut.namePt ?? null,
        primal: cut.primal ?? null,
        subprimal: cut.subprimal ?? null,
        impsCode: cut.impsCode ?? null,
        hsCode: cut.hsCode ?? null,
      },
    });
    cutCount++;
  }
  console.log(`       Created ${cutCount} beef cut taxonomy entries`);

  // Sample beef cut prices (last 30 days for major cuts from AU/BR factories)
  const majorCuts = ['RIB_EYE_ROLL', 'STRIPLOIN', 'TENDERLOIN', 'BRISKET_NAVEL', 'CHUCK_ROLL', 'TOPSIDE', 'SILVERSIDE', 'OUTSIDE_SKIRT', 'INSIDE_SKIRT', 'SHORT_RIBS', 'TONGUE', 'KNUCKLE', 'EYE_ROUND', 'BLADE', 'FLAP', 'TRI_TIP'];
  const auFactories = FACTORIES.filter(f => f.country === 'AU');
  const brFactories = FACTORIES.filter(f => f.country === 'BR');
  const samplePrices: Array<{ factoryId: string; cutCode: string; price: number; currency: string; unit: string; source: string; date: Date; grade: string }> = [];

  const basePricesUSD: Record<string, number> = {
    RIB_EYE_ROLL: 16.5, STRIPLOIN: 14.2, TENDERLOIN: 28.0, BRISKET_NAVEL: 7.8,
    CHUCK_ROLL: 8.5, TOPSIDE: 6.2, SILVERSIDE: 5.8, OUTSIDE_SKIRT: 12.0,
    INSIDE_SKIRT: 11.5, SHORT_RIBS: 13.0, TONGUE: 8.0, KNUCKLE: 6.8,
    EYE_ROUND: 5.5, BLADE: 9.0, FLAP: 7.5, TRI_TIP: 10.0,
  };

  const auPremium: Record<string, number> = {
    RIB_EYE_ROLL: 3.0, STRIPLOIN: 2.5, TENDERLOIN: 5.0, BRISKET_NAVEL: 1.5,
    CHUCK_ROLL: 1.0, TOPSIDE: 0.5, SILVERSIDE: 0.5, OUTSIDE_SKIRT: 2.0,
    INSIDE_SKIRT: 1.8, SHORT_RIBS: 2.5, TONGUE: 1.0, KNUCKLE: 0.3,
    EYE_ROUND: 0.3, BLADE: 1.0, FLAP: 0.8, TRI_TIP: 1.5,
  };

  for (let d = 0; d < 30; d++) {
    const date = new Date(NOW.getTime() - (29 - d) * 24 * 60 * 60 * 1000);

    for (const cut of majorCuts) {
      const base = basePricesUSD[cut] ?? 8.0;
      const jitter = (Math.random() - 0.5) * base * 0.04;

      // AU factory prices
      for (const f of auFactories.slice(0, 3)) {
        const factoryPremium = auPremium[cut] ?? 0.5;
        samplePrices.push({
          factoryId: f.code,
          cutCode: cut,
          price: parseFloat((base + factoryPremium + jitter).toFixed(2)),
          currency: 'USD',
          unit: 'USD/kg',
          source: 'mla_nlrs',
          date,
          grade: 'Grain-fed',
        });
      }

      // BR factory prices (slightly lower)
      const brJitter = (Math.random() - 0.5) * base * 0.04;
      for (const f of brFactories.slice(0, 2)) {
        samplePrices.push({
          factoryId: f.code,
          cutCode: cut,
          price: parseFloat((base - 0.5 + brJitter).toFixed(2)),
          currency: 'USD',
          unit: 'USD/kg',
          source: 'cepea_export',
          date,
          grade: 'Grass-fed',
        });
      }
    }
  }

  // Resolve factoryIds to actual IDs
  const factoryMap = new Map<string, string>();
  for (const f of FACTORIES) {
    const record = await prisma.factory.findUnique({ where: { code: f.code } });
    if (record) factoryMap.set(f.code, record.id);
  }

  const priceRecords = samplePrices
    .filter(p => factoryMap.has(p.factoryId))
    .map(p => ({
      factoryId: factoryMap.get(p.factoryId)!,
      cutCode: p.cutCode,
      price: p.price,
      currency: p.currency,
      unit: p.unit,
      source: p.source,
      date: p.date,
      grade: p.grade,
    }));

  if (priceRecords.length > 0) {
    await prisma.beefCutPrice.createMany({ data: priceRecords, skipDuplicates: true });
  }
  console.log(`       Created ${priceRecords.length} sample beef cut prices`);

  // Sample weekly kill data (12 weeks)
  const killData = [
    { country: 'AU', headCount: 120000, source: 'mla_nlrs' },
    { country: 'BR', headCount: 380000, source: 'abiec' },
    { country: 'AR', headCount: 48000, source: 'ciccra' },
    { country: 'US', headCount: 620000, source: 'usda_ams' },
    { country: 'UY', headCount: 18000, source: 'inac' },
  ];

  for (let w = 0; w < 12; w++) {
    const weekEnding = new Date(NOW.getTime() - (11 - w) * 7 * 24 * 60 * 60 * 1000);
    for (const kd of killData) {
      const jitter = Math.round((Math.random() - 0.5) * kd.headCount * 0.05);
      await prisma.weeklyKill.create({
        data: {
          country: kd.country,
          headCount: kd.headCount + jitter,
          avgWeight: kd.country === 'AU' ? 280 + Math.random() * 20 : kd.country === 'BR' ? 260 + Math.random() * 20 : 320 + Math.random() * 30,
          weekEnding,
          source: kd.source,
        },
      }).catch(() => {});
    }
  }
  console.log(`       Created ${killData.length * 12} weekly kill records`);

  // Sample cold storage (6 months)
  const storageData = [
    { country: 'US', totalLbs: 520, source: 'usda_nass' },
    { country: 'AU', totalLbs: 85, source: 'abs' },
    { country: 'BR', totalLbs: 180, source: 'abiec' },
  ];

  for (let m = 0; m < 6; m++) {
    const date = new Date(NOW.getTime() - (5 - m) * 30 * 24 * 60 * 60 * 1000);
    for (const sd of storageData) {
      const jitter = (Math.random() - 0.5) * sd.totalLbs * 0.03;
      await prisma.coldStorage.create({
        data: {
          country: sd.country,
          totalLbs: parseFloat((sd.totalLbs + jitter).toFixed(1)),
          category: 'beef',
          date,
          source: sd.source,
        },
      }).catch(() => {});
    }
  }
  console.log(`       Created ${storageData.length * 6} cold storage records`);

  // ------------------------------------------------------------------
  // Summary
  // ------------------------------------------------------------------
  console.log('');
  console.log('==========================================');
  console.log('  Seeding Complete!');
  console.log('==========================================');
  console.log('');
  console.log('  Users:');
  console.log(`    ${USERS[0].email} / ********  (ADMIN)`);
  console.log(`    ${USERS[1].email} / ********  (EDITOR)`);
  console.log(`    ${USERS[2].email} / ********  (VIEWER)`);
  console.log('  (passwords sourced from SEED_*_PASSWORD env vars, or dev fallbacks)');
  console.log('');
  console.log(`  Datasets:      ${DATASETS.length}`);
  console.log(`  Timeseries:    ${allTimeseries.length}`);
  console.log(`  Datapoints:    ${totalDatapoints.toLocaleString()}`);
  console.log(`  Models:        ${models.length}`);
  console.log(`  Forecasts:     ${totalForecasts}`);
  console.log(`  Anomalies:     ${anomalies.length}`);
  console.log(`  Alert Rules:   ${alertRules.length}`);
  console.log(`  Alerts:        ${totalAlerts}`);
  console.log(`  API Keys:      ${apiKeyHashes.length}`);
  console.log('');
}

// ============================================================================
// Entry Point
// ============================================================================

main()
  .catch((error) => {
    console.error('');
    console.error('==========================================');
    console.error('  Seeding Failed!');
    console.error('==========================================');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

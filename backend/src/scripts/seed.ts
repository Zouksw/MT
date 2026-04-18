import { prisma } from '@/lib';
import bcrypt from 'bcrypt';

async function main() {
  console.log('🌱 Starting database seed...');

  // Get first user
  const user = await prisma.user.findFirst({
    where: { email: 'admin@trademind.com' },
  });

  if (!user) {
    console.error('❌ No user found. Please register a user first.');
    return;
  }

  console.log(`✅ Found user: ${user.email}`);

  // Get or create default organization
  const defaultOrgId = 'default-org-id';
  let organization = await prisma.organizations.findFirst({
    where: { name: 'Default' },
  });

  if (!organization) {
    organization = await prisma.organizations.create({
      data: {
        id: defaultOrgId,
        owner_id: user.id,
        name: 'Default',
        slug: 'default',
      },
    });
    console.log(`✅ Created organization: ${organization.name}`);
  }

  // Create dataset
  const dataset = await prisma.dataset.upsert({
    where: {
      id: user.id + '-demo-dataset',
    },
    create: {
      id: user.id + '-demo-dataset',
      ownerId: user.id,
      organization_id: organization.id,
      name: 'Demo IoT Sensor Data',
      slug: 'demo-iot-sensor-data',
      description: 'Sample IoT sensor readings for demonstration',
      storageFormat: 'IOTDB_CACHE',
      isPublic: true,
      isImported: true,
      sizeBytes: BigInt(1024000),
      rowsCount: 1024,
    },
    update: {},
  });

  console.log(`✅ Created/upserted dataset: ${dataset.name}`);

  // Create timeseries
  const tempSeries = await prisma.timeseries.upsert({
    where: {
      id: dataset.id + '-temperature',
    },
    create: {
      id: dataset.id + '-temperature',
      datasetId: dataset.id,
      name: 'Temperature Sensor',
      slug: 'temperature-sensor',
      description: 'Temperature readings from industrial sensor',
      colorHex: '#ef4444',
      unit: '°C',
      timezone: 'UTC',
      isAnomalyDetectionEnabled: true,
    },
    update: {},
  });

  const pressureSeries = await prisma.timeseries.upsert({
    where: {
      id: dataset.id + '-pressure',
    },
    create: {
      id: dataset.id + '-pressure',
      datasetId: dataset.id,
      name: 'Pressure Sensor',
      slug: 'pressure-sensor',
      description: 'Pressure readings from hydraulic system',
      colorHex: '#3b82f6',
      unit: 'bar',
      timezone: 'UTC',
      isAnomalyDetectionEnabled: true,
    },
    update: {},
  });

  const vibrationSeries = await prisma.timeseries.upsert({
    where: {
      id: dataset.id + '-vibration',
    },
    create: {
      id: dataset.id + '-vibration',
      datasetId: dataset.id,
      name: 'Vibration Sensor',
      slug: 'vibration-sensor',
      description: 'Vibration frequency readings from motor',
      colorHex: '#f59e0b',
      unit: 'Hz',
      timezone: 'UTC',
      isAnomalyDetectionEnabled: true,
    },
    update: {},
  });

  console.log(`✅ Created/upserted 3 timeseries`);

  // Generate sample datapoints for the last 24 hours (every 5 minutes)
  const now = Date.now();
  const hours = 24;
  const interval = 5 * 60 * 1000; // 5 minutes in ms

  const datapoints = [];
  const tempValues = [];

  for (let i = 0; i < (hours * 60 * 60 * 1000) / interval; i++) {
    const timestamp = new Date(now - i * interval);
    const baseTemp = 25 + Math.sin(i / 24) * 5; // Daily temperature cycle
    const noise = (Math.random() - 0.5) * 2; // Random noise
    const tempValue = parseFloat((baseTemp + noise).toFixed(2));

    tempValues.push(tempValue);

    // Temperature datapoint
    datapoints.push({
      id: `${tempSeries.id}-${i}`,
      timeseriesId: tempSeries.id,
      timestamp: timestamp,
      valueJson: tempValue,
      qualityScore: 0.95 + Math.random() * 0.05,
      isOutlier: Math.abs(noise) > 1.5,
      isAnomaly: false,
      createdAt: new Date(),
    });

    // Pressure datapoint
    const pressureValue = parseFloat((1000 + Math.sin(i / 12) * 50 + (Math.random() - 0.5) * 20).toFixed(2));
    datapoints.push({
      id: `${pressureSeries.id}-${i}`,
      timeseriesId: pressureSeries.id,
      timestamp: timestamp,
      valueJson: pressureValue,
      qualityScore: 0.9 + Math.random() * 0.1,
      isOutlier: false,
      isAnomaly: false,
      createdAt: new Date(),
    });

    // Vibration datapoint
    const vibrationValue = parseFloat((50 + Math.sin(i / 6) * 10 + (Math.random() - 0.5) * 5).toFixed(2));
    datapoints.push({
      id: `${vibrationSeries.id}-${i}`,
      timeseriesId: vibrationSeries.id,
      timestamp: timestamp,
      valueJson: vibrationValue,
      qualityScore: 0.92 + Math.random() * 0.08,
      isOutlier: false,
      isAnomaly: false,
      createdAt: new Date(),
    });
  }

  // Batch insert datapoints (in smaller batches to avoid issues)
  const batchSize = 100;
  for (let i = 0; i < datapoints.length; i += batchSize) {
    const batch = datapoints.slice(i, i + batchSize);
    await prisma.datapoint.createMany({
      data: batch.map((dp: any) => ({
        timeseriesId: dp.timeseriesId,
        timestamp: dp.timestamp,
        valueJson: dp.valueJson as any,
        qualityScore: dp.qualityScore,
        isOutlier: dp.isOutlier,
        isAnomaly: dp.isAnomaly,
      })),
      skipDuplicates: true,
    });
    console.log(`✅ Inserted datapoints batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(datapoints.length / batchSize)}`);
  }

  console.log(`✅ Created ${datapoints.length} sample datapoints`);

  // Update dataset stats
  await prisma.dataset.update({
    where: { id: dataset.id },
    data: {
      sizeBytes: BigInt(datapoints.length * 100),
      rowsCount: datapoints.length / 3,
      lastAccessedAt: new Date(),
    },
  });

  console.log('✅ Seed completed successfully!');
  console.log(`
📊 Summary:
   - User: ${user.email}
   - Dataset: ${dataset.name}
   - Timeseries: 3 (Temperature, Pressure, Vibration)
   - Datapoints: ${datapoints.length}
  `);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

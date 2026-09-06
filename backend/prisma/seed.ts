import {
	type AlertSeverity,
	type AlertType,
	type AnomalySeverity,
	type DetectionMethod,
	PrismaClient,
	type StorageFormat,
	type UserRole,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { FACTORIES } from "./seed/beefData";
import {
	COMMODITIES,
	DECLARED_SOURCES,
	MULTI_SOURCE_SLUGS,
	PRICE_BASELINES,
} from "./seed/commodityData";
import { DATASETS, DETECTION_METHODS, type TimeseriesDef } from "./seed/datasets";
import { pick, rand, randInt, sineWave, slugify, withSpike } from "./seed/random";
import { USERS } from "./seed/users";

const prisma = new PrismaClient();

// ============================================================================
// Configuration
// ============================================================================

const SALT_ROUNDS = 12;
const NOW = new Date();
const THIRTY_DAYS_AGO = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000);

// Production guard: seed credentials must come from env in prod. The dev
// fallbacks below (Admin123! etc.) are intentionally weak and committed — they
// must never run against a production database.
if (process.env.NODE_ENV === "production" && !process.env.SEED_ADMIN_PASSWORD) {
	console.error(
		"\n[FATAL] Refusing to seed with committed dev credentials in production.\n" +
			"Set SEED_ADMIN_PASSWORD / SEED_USER_PASSWORD / SEED_DEMO_PASSWORD env vars before seeding.\n",
	);
	process.exit(1);
}

// ============================================================================
// Helpers
// ============================================================================

/** Generate a random number between min and max */

async function main() {
	console.log("");
	console.log("==========================================");
	console.log("  TradeMind AI - Database Seeding");
	console.log("==========================================");
	console.log("");

	// Safety gate: this script's first act is a wipe. If real accounts exist,
	// refuse unless SEED_FORCE=1 is set explicitly. (Added after a scratch-DB
	// verification ran without the DATABASE_URL override and wiped the
	// production user tables — restored from the nightly dump, but never
	// again. NODE_ENV alone is not a guard: production shells often leave it
	// unset.)
	const existingUsers = await prisma.user.count();
	if (existingUsers > 0 && process.env.SEED_FORCE !== "1") {
		throw new Error(
			`[FATAL] Database already has ${existingUsers} users — seeding would WIPE them. ` +
				"Point DATABASE_URL at a scratch database, or set SEED_FORCE=1 to wipe intentionally.",
		);
	}

	// ------------------------------------------------------------------
	// 1. Clean existing data (respecting FK order)
	// ------------------------------------------------------------------
	console.log("[1/9] Cleaning existing data...");

	// Delete in correct order respecting foreign key constraints
	await prisma.anomaly.deleteMany();
	await prisma.alert.deleteMany();
	await prisma.alertRule.deleteMany();
	await prisma.datapoint.deleteMany();
	await prisma.timeseries.deleteMany();
	await prisma.dataset.deleteMany();
	await prisma.auditLog.deleteMany();
	await prisma.apiKey.deleteMany();
	await prisma.session.deleteMany();
	// prisma.organizations went with the model itself (round-114 multi-tenant
	// teardown) — the stale deleteMany crashed the first re-seed after it.
	await prisma.user.deleteMany();
	console.log("       All tables cleared.");

	// ------------------------------------------------------------------
	// 2. Create users
	// ------------------------------------------------------------------
	console.log("[2/9] Creating users...");

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
				preferences: { theme: "system", notifications: true, language: "en" },
				lastLoginAt: new Date(NOW.getTime() - randInt(1, 48) * 60 * 60 * 1000),
			},
		});
		users.push(user);
		console.log(`       Created: ${u.name} (${u.role}) <${u.email}>`);
	}

	const adminUser = users[0];
	const editorUser = users[1];

	// ------------------------------------------------------------------
	// 4. Create datasets and timeseries
	// ------------------------------------------------------------------
	console.log("[4/9] Creating datasets and timeseries...");

	const allTimeseries: {
		id: string;
		datasetId: string;
		name: string;
		unit: string;
		def: TimeseriesDef;
	}[] = [];
	let totalDatapoints = 0;

	for (let di = 0; di < DATASETS.length; di++) {
		const ds = DATASETS[di];
		const owner = pick(users);
		const dataset = await prisma.dataset.create({
			data: {
				ownerId: owner.id,
				name: ds.name,
				slug: slugify(ds.name),
				description: ds.description,
				storageFormat: ds.storageFormat,
				isPublic: ds.isPublic,
				isImported: ds.storageFormat === "CSV",
				sizeBytes: BigInt(0),
				rowsCount: 0,
				metadata: { source: "seed-script", version: 1 },
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
					timezone: "UTC",
					isAnomalyDetectionEnabled: true,
				},
			});
			tsIds.push(timeseries.id);
			allTimeseries.push({
				id: timeseries.id,
				datasetId: dataset.id,
				name: ts.name,
				unit: ts.unit,
				def: ts,
			});
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
				let value = sineWave(
					i,
					tsDef.baseValue,
					tsDef.amplitude,
					tsDef.period,
					tsDef.noiseAmplitude,
				);
				const isOutlier = Math.random() < 0.015;
				const isAnomaly = Math.random() < 0.005;

				if (isOutlier) {
					value = withSpike(value, i, 1.0);
				}
				if (isAnomaly) {
					value = parseFloat(
						(value * (1 + (Math.random() > 0.5 ? 1 : -1) * rand(0.5, 1.5))).toFixed(4),
					);
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

		console.log(
			`       Dataset: ${ds.name} (${ds.timeseries.length} series, ${POINTS_PER_SERIES * ds.timeseries.length} points)`,
		);
	}

	console.log(`       Total datapoints: ${totalDatapoints.toLocaleString()}`);

	// ------------------------------------------------------------------
	// 7. Create anomalies
	// ------------------------------------------------------------------
	console.log("[7/9] Creating anomalies...");

	const anomalies: string[] = [];
	const anomalyDescriptions: Record<AnomalySeverity, string[]> = {
		LOW: [
			"Slightly elevated reading within tolerance",
			"Brief minor fluctuation detected",
			"Marginally outside normal range",
		],
		MEDIUM: [
			"Sustained deviation from baseline",
			"Repeated pattern break detected",
			"Two-sigma deviation sustained over 1 hour",
		],
		HIGH: [
			"Significant spike beyond threshold",
			"Rapid change rate exceeding safety limits",
			"Critical parameter drift detected",
		],
		CRITICAL: [
			"Emergency threshold exceeded",
			"Sensor reading in dangerous range",
			"System health critically degraded",
		],
	};

	for (let i = 0; i < 20; i++) {
		const ts = pick(allTimeseries);
		const severity = i < 3 ? "CRITICAL" : i < 8 ? "HIGH" : i < 14 ? "MEDIUM" : "LOW";
		const method = pick(DETECTION_METHODS);
		const createdAt = new Date(THIRTY_DAYS_AGO.getTime() + randInt(0, 29) * 24 * 60 * 60 * 1000);
		const isResolved = severity === "LOW" || (severity === "MEDIUM" && Math.random() > 0.4);
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
					actualValue: parseFloat(
						rand(
							ts.def.baseValue - ts.def.amplitude * 2,
							ts.def.baseValue + ts.def.amplitude * 2,
						).toFixed(2),
					),
					sensorId: `SENSOR-${randInt(100, 999)}`,
					zone: `Zone ${randInt(1, 5)}`,
				},
				isInvestigated,
				isResolved,
				resolutionNotes: isResolved
					? pick([
							"Confirmed as sensor calibration drift. Recalibrated sensor.",
							"Transient spike caused by power cycle. No action needed.",
							"Replaced faulty sensor. Values back to normal.",
							"Software update resolved false positive readings.",
							"Maintenance performed. Anomaly no longer present.",
						])
					: null,
				resolvedAt: isResolved
					? new Date(createdAt.getTime() + randInt(1, 48) * 60 * 60 * 1000)
					: null,
				createdAt,
			},
		});
		anomalies.push(anomaly.id);
	}

	console.log(`       Created ${anomalies.length} anomalies (mixed severity)`);

	// ------------------------------------------------------------------
	// 8. Create alert rules and alerts
	// ------------------------------------------------------------------
	console.log("[8/9] Creating alert rules and alerts...");

	const alertRuleDefs = [
		{
			name: "High Temperature Warning",
			type: "ANOMALY",
			severity: "WARNING",
			conditions: { metric: "value", operator: ">", threshold: 30, duration: "5m" },
		},
		{
			name: "Critical Temperature Alert",
			type: "ANOMALY",
			severity: "ERROR",
			conditions: { metric: "value", operator: ">", threshold: 40, duration: "1m" },
		},
		{
			name: "Power Consumption Spike",
			type: "ANOMALY",
			severity: "WARNING",
			conditions: { metric: "value", operator: ">", threshold: 6, duration: "10m" },
		},
		{
			name: "Forecast Model Ready",
			type: "FORECAST_READY",
			severity: "INFO",
			conditions: { metric: "accuracy", operator: ">", threshold: 0.9 },
		},
		{
			name: "Low Battery Alert",
			type: "ANOMALY",
			severity: "ERROR",
			conditions: { metric: "value", operator: "<", threshold: 20, duration: "5m" },
		},
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
				channels: {
					email: true,
					webhook: Math.random() > 0.5 ? "https://hooks.example.com/alert" : null,
				},
				cooldownMinutes: pick([5, 10, 15, 30]),
				lastTriggeredAt:
					Math.random() > 0.3 ? new Date(NOW.getTime() - randInt(1, 48) * 60 * 60 * 1000) : null,
			},
		});
		alertRules.push({ id: rule.id, timeseriesId: ts.id });
	}

	// Create alerts
	const alertMessages: Record<string, string[]> = {
		ANOMALY: [
			"Anomaly detected: value exceeded threshold for the past 5 minutes",
			"Anomaly detected: statistical outlier in recent readings",
			"Anomaly detected: pattern deviation from historical baseline",
			"Anomaly detected: rapid change rate exceeds configured threshold",
		],
		FORECAST_READY: [
			"Forecast model training completed successfully",
			"Forecast model updated with latest data and deployed",
		],
		SYSTEM: [
			"System health check: data ingestion pipeline delayed",
			"System notification: maintenance window scheduled",
			"System notification: sensor firmware update available",
		],
	};

	const alertSeverities: AlertSeverity[] = ["INFO", "WARNING", "ERROR"];

	let totalAlerts = 0;
	for (let i = 0; i < 15; i++) {
		const alertType: AlertType = i < 8 ? "ANOMALY" : i < 11 ? "FORECAST_READY" : "SYSTEM";
		const ts = allTimeseries[i % allTimeseries.length];
		const rule = alertRules.find((r) => r.timeseriesId === ts.id);
		const severity =
			alertType === "ANOMALY"
				? pick(["WARNING", "ERROR"] as AlertSeverity[])
				: alertType === "FORECAST_READY"
					? "INFO"
					: pick(alertSeverities);
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
					triggeredBy: alertType === "ANOMALY" ? "rule-engine" : "system",
					datasetName:
						DATASETS.find((d) => d.timeseries.some((t) => t.name === ts.name))?.name ?? "Unknown",
					timeseriesName: ts.name,
					threshold: alertType === "ANOMALY" ? parseFloat(rand(20, 50).toFixed(1)) : null,
					actualValue: alertType === "ANOMALY" ? parseFloat(rand(25, 55).toFixed(1)) : null,
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
	console.log("[9/9] Creating API keys and additional data...");

	const apiKeyHashes = [
		{
			name: "Production API Key",
			hash: await bcrypt.hash("iotdb_prod_sk_a1b2c3d4e5f6g7h8", 4),
			lastChars: "g7h8",
		},
		{
			name: "Development API Key",
			hash: await bcrypt.hash("iotdb_dev_sk_x9y8z7w6v5u4t3s2", 4),
			lastChars: "s3s2",
		},
		{
			name: "Monitoring Integration",
			hash: await bcrypt.hash("iotdb_mon_sk_p0o9i8u7y6t5r4e3", 4),
			lastChars: "r4e3",
		},
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

	// Create audit logs
	const auditActions = ["CREATE", "READ", "UPDATE", "DELETE", "EXPORT", "LOGIN"] as const;
	const auditResources = [
		{ type: "dataset", actions: ["CREATE", "READ", "UPDATE", "DELETE", "EXPORT"] },
		{ type: "timeseries", actions: ["CREATE", "READ", "UPDATE"] },
		{ type: "user", actions: ["CREATE", "UPDATE", "LOGIN"] },
		{ type: "forecast", actions: ["CREATE", "READ"] },
		{ type: "anomaly", actions: ["READ", "UPDATE"] },
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
					"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
					"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
					"TradeMind-CLI/1.0",
				]),
				success: Math.random() > 0.05,
				errorCode: Math.random() < 0.05 ? "PERMISSION_DENIED" : null,
				createdAt: new Date(THIRTY_DAYS_AGO.getTime() + randInt(0, 29) * 24 * 60 * 60 * 1000),
			},
		});
	}

	console.log(`       Created ${apiKeyHashes.length} API keys`);
	console.log(`       Created 30 audit logs`);

	// ------------------------------------------------------------------
	// 10. Create TradeMind AI commodity data
	// ------------------------------------------------------------------
	console.log("[10/10] Creating TradeMind AI commodity data...");

	await prisma.commodityPrice.deleteMany();
	await prisma.marketFactor.deleteMany();
	await prisma.commodity.deleteMany();

	// Price baselines for generating realistic data (no `_cn` entries — the
	// domestic dimension was removed, round-155)

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
				// §十七 fix (v3.3.0 批2): beef_carcass_us mirrors its PROD
				// metadata (fred / PBEEFUSDM); other slugs keep the generic
				// seed marker.
				metadata:
					c.slug === "beef_carcass_us"
						? {
								source: "fred",
								seriesId: "PBEEFUSDM",
								note: "seed mirrors prod identity (round-126 fix)",
							}
						: { source: "seed", importType: c.category === "forex" ? "api" : "manual" },
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

	// Synthetic-row source labels for declared multi-source slugs (mirror of
	// AUTHORITATIVE_SOURCES minus brl_usd, which the ternary below handles).
	// v3.2.0 批2: read paths filter by the declared authoritative source, so
	// seeded history for those slugs must carry that label to stay visible.

	for (const commodity of commodities) {
		const baseline = PRICE_BASELINES[commodity.slug];
		if (!baseline) continue;

		let price = baseline.base;

		// §十七 fix (v3.3.0 批2): beef_carcass_us is a MONTHLY series in prod
		// — seeding 180 daily rows for it is a cadence lie (mt_test drifted
		// from prod until landing-cost tests needed a beforeAll unit hack).
		// Generate month-start points instead, labeled "fred" as in prod.
		if (commodity.slug === "beef_carcass_us") {
			let monthlyPrice = baseline.base;
			for (let m = 5; m >= 0; m--) {
				const date = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() - m, 1));
				monthlyPrice = Math.max(
					monthlyPrice * 0.9,
					Math.min(monthlyPrice * 1.1, monthlyPrice + (Math.random() - 0.48) * baseline.volatility),
				);
				priceBatch.push({
					commodityId: commodity.id,
					date,
					interval: "monthly",
					open: null,
					high: null,
					low: null,
					close: parseFloat(monthlyPrice.toFixed(4)),
					volume: null,
					source: "fred",
					metadata: null,
				});
			}
			continue;
		}

		for (let d = 0; d < DAYS; d++) {
			const date = new Date(NOW.getTime() - (DAYS - d) * 24 * 60 * 60 * 1000);
			// Skip weekends for futures
			if (commodity.category === "futures" && (date.getDay() === 0 || date.getDay() === 6))
				continue;

			const change = (Math.random() - 0.48) * baseline.volatility;
			price = Math.max(price * 0.8, Math.min(price * 1.2, price + change));

			const open = parseFloat(
				(price + (Math.random() - 0.5) * baseline.volatility * 0.3).toFixed(4),
			);
			const close = parseFloat(price.toFixed(4));
			const high = parseFloat(
				Math.max(open, close, price + Math.random() * baseline.volatility * 0.5).toFixed(4),
			);
			const low = parseFloat(
				Math.min(open, close, price - Math.random() * baseline.volatility * 0.5).toFixed(4),
			);

			let metadata: Record<string, unknown> | null = null;
			// Domestic-CN beef cuts were removed (round-155) — every beef_cuts
			// commodity is imported now, so the old `originCountry !== "CN"`
			// guard is gone.
			if (commodity.category === "beef_cuts") {
				metadata = {
					spot_cny_kg: close,
					shipping_cost_usd_ton: 250 + Math.random() * 60,
					tariff_rate: commodity.originCountry === "AUS" ? 0 : 0.12,
				};
			} else if (commodity.category === "futures") {
				metadata = {
					futures_usd_ton: close * 2.20462, // cwt to ton
					open_interest: Math.floor(Math.random() * 50000 + 10000),
				};
			}

			priceBatch.push({
				commodityId: commodity.id,
				date,
				interval: "daily",
				open,
				high,
				low,
				close,
				volume: commodity.category === "futures" ? Math.floor(Math.random() * 20000 + 5000) : null,
				// brl_usd's baseline rows carry the inverted exchange_rate_api
				// scale — label them as that source so the conflict with the
				// authoritative fred fixture below is realistic. Other declared
				// slugs carry their authoritative label (DECLARED_SOURCES above)
				// so authority-filtered reads still see the seeded history.
				source:
					commodity.slug === "brl_usd"
						? "exchange_rate_api"
						: (DECLARED_SOURCES[commodity.slug] ?? "seed"),
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

	// Authoritative-source fixture (round-41/67 regression guards): fred
	// DEXBZUS writes USD/BRL ≈ 5.x while exchange_rate_api writes the inverted
	// 1/BRL ≈ 0.2 above. signals/watchlist/marketService/inference tests pin
	// that every read path resolves brl_usd to the fred magnitude.
	{
		const brl = await prisma.commodity.findUnique({ where: { slug: "brl_usd" } });
		if (brl) {
			const fredRows: {
				commodityId: string;
				date: Date;
				interval: string;
				open: number;
				high: number;
				low: number;
				close: number;
				volume: number | null;
				source: string;
				metadata: Record<string, unknown> | null;
			}[] = [];
			let rate = 5.05;
			for (let d = 0; d < 120; d++) {
				const date = new Date(NOW.getTime() - (120 - d) * 24 * 60 * 60 * 1000);
				if (date.getDay() === 0 || date.getDay() === 6) continue;
				rate = Math.max(4.6, Math.min(5.6, rate + (Math.random() - 0.5) * 0.06));
				const close = parseFloat(rate.toFixed(4));
				fredRows.push({
					commodityId: brl.id,
					date,
					interval: "daily",
					open: close,
					high: parseFloat((close + 0.015).toFixed(4)),
					low: parseFloat((close - 0.015).toFixed(4)),
					close,
					volume: null,
					source: "fred",
					metadata: { series: "DEXBZUS" },
				});
			}
			await prisma.commodityPrice.createMany({ data: fredRows, skipDuplicates: true });
			priceCount += fredRows.length;
		}
	}

	// Ingestion-log fixtures: getSourceFreshness and dataHealth observability
	// read ingestion_logs (recent window). Without rows the freshness table is
	// empty and the round-58 empty-flag guards have nothing to iterate. One
	// deliberately-void source exercises the empty:true path.
	{
		const logSources = [
			{ source: "fred", inserted: 85 },
			{ source: "exchange_rate_api", inserted: 180 },
			{ source: "usda_ams", inserted: 42 },
			{ source: "cme", inserted: 0 },
		];
		for (const s of logSources) {
			await prisma.ingestionLog.create({
				data: {
					source: s.source,
					status: "success",
					inserted: s.inserted,
					updated: 0,
					durationMs: randInt(200, 4000),
				},
			});
		}
	}

	// Market-news fixtures: the /api/news list test asserts a non-empty feed.
	{
		const NEWS: Array<{
			title: string;
			summary: string;
			category: "PRICE_MOVE" | "SUPPLY" | "TRADE_POLICY" | "MARKET_INSIGHT" | "COMPANY";
			source: string;
		}> = [
			{
				title: "Brazil beef exports steady as BRL firms",
				summary: "Weekly export volumes held flat while the real appreciated against the USD.",
				category: "TRADE_POLICY",
				source: "Trade Wire",
			},
			{
				title: "US carcass prices edge higher on tight supplies",
				summary:
					"Choice carcass cutout gained for a third week as feedlot placements stayed light.",
				category: "PRICE_MOVE",
				source: "USDA summary",
			},
			{
				title: "CME live cattle futures consolidate",
				summary: "Front-month live cattle held a narrow range ahead of the Cattle on Feed report.",
				category: "MARKET_INSIGHT",
				source: "CME daily",
			},
			{
				title: "Oceania grinding beef demand firms",
				summary: "Manufacturing beef premiums widened as US lean demand picked up.",
				category: "SUPPLY",
				source: "Trade Wire",
			},
		];
		for (const n of NEWS) {
			await prisma.marketNews.create({
				data: {
					title: n.title,
					slug: slugify(n.title),
					summary: n.summary,
					body: `${n.summary} Full article body seeded for integration fixtures.`,
					category: n.category,
					source: n.source,
					sourceUrl: `https://example.com/${slugify(n.title)}`,
					tags: [],
					publishedAt: new Date(NOW.getTime() - randInt(1, 72) * 60 * 60 * 1000),
					author: { connect: { email: "admin@trademind.com" } },
				},
			});
		}
	}

	// Multi-source overlay: add a second source for key commodities so the
	// multi-source chart toggle can be demonstrated.
	const multiBatch: typeof priceBatch = [];
	for (const commodity of commodities) {
		if (!MULTI_SOURCE_SLUGS.includes(commodity.slug)) continue;
		const baseline = PRICE_BASELINES[commodity.slug];
		if (!baseline) continue;

		let price = baseline.base;
		for (let d = 0; d < DAYS; d++) {
			const date = new Date(NOW.getTime() - (DAYS - d) * 24 * 60 * 60 * 1000);
			if (commodity.category === "futures" && (date.getDay() === 0 || date.getDay() === 6))
				continue;

			const change = (Math.random() - 0.48) * baseline.volatility;
			price = Math.max(price * 0.8, Math.min(price * 1.2, price + change));

			const close = parseFloat(price.toFixed(4));
			const open = parseFloat(
				(price + (Math.random() - 0.5) * baseline.volatility * 0.3).toFixed(4),
			);
			const high = parseFloat(Math.max(open, close) * (1 + Math.random() * 0.005).toFixed(4));
			const low = parseFloat(Math.min(open, close) * (1 - Math.random() * 0.005).toFixed(4));

			multiBatch.push({
				commodityId: commodity.id,
				date,
				interval: "daily",
				open,
				high,
				low,
				close,
				volume: null,
				source: "usda_ams",
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
		{ type: "exchange_rate", region: "US/CN", value: 7.25, unit: "CNY/USD" },
		{ type: "exchange_rate", region: "AU/US", value: 0.65, unit: "AUD/USD" },
		{ type: "exchange_rate", region: "BR/US", value: 0.18, unit: "BRL/USD" },
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
					source: "seed",
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
	console.log("");
	console.log("  Seeding Beef Data...");

	// Factories

	for (const f of FACTORIES) {
		await prisma.factory.upsert({
			where: { code: f.code },
			update: {
				name: f.name,
				nameLocal: f.nameLocal,
				region: f.region,
				capacity: f.capacity,
				accredited: f.accredited,
			},
			create: f,
		});
	}
	console.log(`       Created ${FACTORIES.length} factories`);

	// Beef Cut Taxonomy — use the normalizer data
	const { getAllCutMappings } = await import("../src/services/dataIngestion/beefCutNormalizer");
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
	const majorCuts = [
		"RIB_EYE_ROLL",
		"STRIPLOIN",
		"TENDERLOIN",
		"BRISKET_NAVEL",
		"CHUCK_ROLL",
		"TOPSIDE",
		"SILVERSIDE",
		"OUTSIDE_SKIRT",
		"INSIDE_SKIRT",
		"SHORT_RIBS",
		"TONGUE",
		"KNUCKLE",
		"EYE_ROUND",
		"BLADE",
		"FLAP",
		"TRI_TIP",
	];
	const auFactories = FACTORIES.filter((f) => f.country === "AU");
	const brFactories = FACTORIES.filter((f) => f.country === "BR");
	const samplePrices: Array<{
		factoryId: string;
		cutCode: string;
		price: number;
		currency: string;
		unit: string;
		source: string;
		date: Date;
		grade: string;
	}> = [];

	const basePricesUSD: Record<string, number> = {
		RIB_EYE_ROLL: 16.5,
		STRIPLOIN: 14.2,
		TENDERLOIN: 28.0,
		BRISKET_NAVEL: 7.8,
		CHUCK_ROLL: 8.5,
		TOPSIDE: 6.2,
		SILVERSIDE: 5.8,
		OUTSIDE_SKIRT: 12.0,
		INSIDE_SKIRT: 11.5,
		SHORT_RIBS: 13.0,
		TONGUE: 8.0,
		KNUCKLE: 6.8,
		EYE_ROUND: 5.5,
		BLADE: 9.0,
		FLAP: 7.5,
		TRI_TIP: 10.0,
	};

	const auPremium: Record<string, number> = {
		RIB_EYE_ROLL: 3.0,
		STRIPLOIN: 2.5,
		TENDERLOIN: 5.0,
		BRISKET_NAVEL: 1.5,
		CHUCK_ROLL: 1.0,
		TOPSIDE: 0.5,
		SILVERSIDE: 0.5,
		OUTSIDE_SKIRT: 2.0,
		INSIDE_SKIRT: 1.8,
		SHORT_RIBS: 2.5,
		TONGUE: 1.0,
		KNUCKLE: 0.3,
		EYE_ROUND: 0.3,
		BLADE: 1.0,
		FLAP: 0.8,
		TRI_TIP: 1.5,
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
					currency: "USD",
					unit: "USD/kg",
					source: "mla_nlrs",
					date,
					grade: "Grain-fed",
				});
			}

			// BR factory prices (slightly lower)
			const brJitter = (Math.random() - 0.5) * base * 0.04;
			for (const f of brFactories.slice(0, 2)) {
				samplePrices.push({
					factoryId: f.code,
					cutCode: cut,
					price: parseFloat((base - 0.5 + brJitter).toFixed(2)),
					currency: "USD",
					unit: "USD/kg",
					source: "cepea_export",
					date,
					grade: "Grass-fed",
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
		.filter((p) => factoryMap.has(p.factoryId))
		.map((p) => ({
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
		{ country: "AU", headCount: 120000, source: "mla_nlrs" },
		{ country: "BR", headCount: 380000, source: "abiec" },
		{ country: "AR", headCount: 48000, source: "ciccra" },
		{ country: "US", headCount: 620000, source: "usda_ams" },
		{ country: "UY", headCount: 18000, source: "inac" },
	];

	for (let w = 0; w < 12; w++) {
		const weekEnding = new Date(NOW.getTime() - (11 - w) * 7 * 24 * 60 * 60 * 1000);
		for (const kd of killData) {
			const jitter = Math.round((Math.random() - 0.5) * kd.headCount * 0.05);
			await prisma.weeklyKill
				.create({
					data: {
						country: kd.country,
						headCount: kd.headCount + jitter,
						avgWeight:
							kd.country === "AU"
								? 280 + Math.random() * 20
								: kd.country === "BR"
									? 260 + Math.random() * 20
									: 320 + Math.random() * 30,
						weekEnding,
						source: kd.source,
					},
				})
				.catch(() => {});
		}
	}
	console.log(`       Created ${killData.length * 12} weekly kill records`);

	// Sample cold storage (6 months)
	const storageData = [
		{ country: "US", totalLbs: 520, source: "usda_nass" },
		{ country: "AU", totalLbs: 85, source: "abs" },
		{ country: "BR", totalLbs: 180, source: "abiec" },
	];

	for (let m = 0; m < 6; m++) {
		const date = new Date(NOW.getTime() - (5 - m) * 30 * 24 * 60 * 60 * 1000);
		for (const sd of storageData) {
			const jitter = (Math.random() - 0.5) * sd.totalLbs * 0.03;
			await prisma.coldStorage
				.create({
					data: {
						country: sd.country,
						totalLbs: parseFloat((sd.totalLbs + jitter).toFixed(1)),
						category: "beef",
						date,
						source: sd.source,
					},
				})
				.catch(() => {});
		}
	}
	console.log(`       Created ${storageData.length * 6} cold storage records`);

	// ------------------------------------------------------------------
	// Summary
	// ------------------------------------------------------------------
	console.log("");
	console.log("==========================================");
	console.log("  Seeding Complete!");
	console.log("==========================================");
	console.log("");
	console.log("  Users:");
	console.log(`    ${USERS[0].email} / ********  (ADMIN)`);
	console.log(`    ${USERS[1].email} / ********  (EDITOR)`);
	console.log(`    ${USERS[2].email} / ********  (VIEWER)`);
	console.log("  (passwords sourced from SEED_*_PASSWORD env vars, or dev fallbacks)");
	console.log("");
	console.log(`  Datasets:      ${DATASETS.length}`);
	console.log(`  Timeseries:    ${allTimeseries.length}`);
	console.log(`  Datapoints:    ${totalDatapoints.toLocaleString()}`);
	console.log(`  Anomalies:     ${anomalies.length}`);
	console.log(`  Alert Rules:   ${alertRules.length}`);
	console.log(`  Alerts:        ${totalAlerts}`);
	console.log(`  API Keys:      ${apiKeyHashes.length}`);
	console.log("");
}

// ============================================================================
// Entry Point
// ============================================================================

main()
	.catch((error) => {
		console.error("");
		console.error("==========================================");
		console.error("  Seeding Failed!");
		console.error("==========================================");
		console.error(error);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});

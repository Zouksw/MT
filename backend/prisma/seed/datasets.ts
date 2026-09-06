/** Extracted from prisma/seed.ts (round-156 批3a) — data-only move, logic unchanged. */
import type { DetectionMethod, StorageFormat } from "@prisma/client";

export interface DatasetDef {
	name: string;
	description: string;
	storageFormat: StorageFormat;
	isPublic: boolean;
	timeseries: TimeseriesDef[];
}

export interface TimeseriesDef {
	name: string;
	description: string;
	unit: string;
	colorHex: string;
	baseValue: number;
	amplitude: number;
	period: number;
	noiseAmplitude: number;
}

export const DATASETS: DatasetDef[] = [
	{
		name: "Temperature Sensors - Building A",
		description:
			"Multi-zone temperature monitoring across Building A floors and rooms. Data collected from IoT sensors deployed in HVAC systems.",
		storageFormat: "TIMESERIES",
		isPublic: true,
		timeseries: [
			{
				name: "Zone 1 - Lobby Temperature",
				description: "Ground floor lobby ambient temperature readings",
				unit: "\u00B0C",
				colorHex: "#ef4444",
				baseValue: 22,
				amplitude: 4,
				period: 288, // daily cycle in 5-min intervals
				noiseAmplitude: 0.8,
			},
			{
				name: "Zone 2 - Server Room Temperature",
				description: "Server room rack inlet temperature",
				unit: "\u00B0C",
				colorHex: "#dc2626",
				baseValue: 19,
				amplitude: 2,
				period: 288,
				noiseAmplitude: 0.5,
			},
			{
				name: "Zone 3 - Rooftop Ambient",
				description: "Outdoor rooftop weather station temperature",
				unit: "\u00B0C",
				colorHex: "#f87171",
				baseValue: 15,
				amplitude: 8,
				period: 288,
				noiseAmplitude: 1.5,
			},
		],
	},
	{
		name: "Server Room Monitoring",
		description:
			"Comprehensive server room environmental and power monitoring system with real-time alerts.",
		storageFormat: "TIMESERIES",
		isPublic: false,
		timeseries: [
			{
				name: "Rack Power Consumption",
				description: "Total power draw from primary server rack in kilowatts",
				unit: "kW",
				colorHex: "#3b82f6",
				baseValue: 4.5,
				amplitude: 1.2,
				period: 288,
				noiseAmplitude: 0.3,
			},
			{
				name: "UPS Battery Level",
				description: "Uninterruptible power supply battery charge percentage",
				unit: "%",
				colorHex: "#22c55e",
				baseValue: 98,
				amplitude: 2,
				period: 1440, // weekly discharge/charge cycle
				noiseAmplitude: 0.5,
			},
			{
				name: "Network Latency",
				description: "Round-trip time to core switch in milliseconds",
				unit: "ms",
				colorHex: "#a855f7",
				baseValue: 2,
				amplitude: 1,
				period: 288,
				noiseAmplitude: 0.5,
			},
		],
	},
	{
		name: "Solar Panel Array - East Wing",
		description:
			"Performance metrics from the 50kW solar panel installation on the East Wing rooftop.",
		storageFormat: "TIMESERIES",
		isPublic: true,
		timeseries: [
			{
				name: "Power Output",
				description: "Total DC power output from the solar array",
				unit: "kW",
				colorHex: "#f59e0b",
				baseValue: 25,
				amplitude: 20,
				period: 288,
				noiseAmplitude: 2,
			},
			{
				name: "Panel Temperature",
				description: "Average panel surface temperature",
				unit: "\u00B0C",
				colorHex: "#f97316",
				baseValue: 35,
				amplitude: 15,
				period: 288,
				noiseAmplitude: 2,
			},
		],
	},
	{
		name: "Weather Station - Rooftop",
		description: "Comprehensive weather data collection from the rooftop meteorological station.",
		storageFormat: "CSV",
		isPublic: true,
		timeseries: [
			{
				name: "Atmospheric Pressure",
				description: "Barometric pressure readings from the weather station",
				unit: "hPa",
				colorHex: "#6366f1",
				baseValue: 1013,
				amplitude: 10,
				period: 1440,
				noiseAmplitude: 2,
			},
			{
				name: "Relative Humidity",
				description: "Ambient relative humidity percentage",
				unit: "%",
				colorHex: "#06b6d4",
				baseValue: 60,
				amplitude: 20,
				period: 288,
				noiseAmplitude: 5,
			},
			{
				name: "Wind Speed",
				description: "Anemometer wind speed measurements",
				unit: "m/s",
				colorHex: "#14b8a6",
				baseValue: 4,
				amplitude: 3,
				period: 144,
				noiseAmplitude: 1.5,
			},
		],
	},
	{
		name: "Manufacturing Line - Motor Vibration",
		description:
			"Vibration analysis data from industrial motors on Assembly Line 3. Used for predictive maintenance.",
		storageFormat: "TIMESERIES",
		isPublic: false,
		timeseries: [
			{
				name: "Motor A - Axial Vibration",
				description: "Axial vibration frequency from Motor A on assembly line",
				unit: "Hz",
				colorHex: "#ec4899",
				baseValue: 50,
				amplitude: 8,
				period: 288,
				noiseAmplitude: 3,
			},
			{
				name: "Motor A - Radial Vibration",
				description: "Radial vibration frequency from Motor A on assembly line",
				unit: "Hz",
				colorHex: "#d946ef",
				baseValue: 45,
				amplitude: 6,
				period: 288,
				noiseAmplitude: 2,
			},
		],
	},
	{
		name: "Water Treatment Plant",
		description:
			"Water quality parameters from the municipal water treatment facility monitoring system.",
		storageFormat: "TIMESERIES",
		isPublic: true,
		timeseries: [
			{
				name: "pH Level",
				description: "Water pH level from treatment output",
				unit: "pH",
				colorHex: "#84cc16",
				baseValue: 7.2,
				amplitude: 0.4,
				period: 1440,
				noiseAmplitude: 0.1,
			},
			{
				name: "Dissolved Oxygen",
				description: "Dissolved oxygen concentration in mg/L",
				unit: "mg/L",
				colorHex: "#22d3ee",
				baseValue: 8,
				amplitude: 1.5,
				period: 288,
				noiseAmplitude: 0.3,
			},
			{
				name: "Turbidity",
				description: "Water turbidity measured in NTU",
				unit: "NTU",
				colorHex: "#fbbf24",
				baseValue: 0.5,
				amplitude: 0.3,
				period: 288,
				noiseAmplitude: 0.1,
			},
		],
	},
	{
		name: "HVAC Energy Consumption",
		description: "Heating, ventilation and air conditioning energy usage across campus buildings.",
		storageFormat: "CSV",
		isPublic: false,
		timeseries: [
			{
				name: "Chiller Power Draw",
				description: "Main chiller unit power consumption",
				unit: "kW",
				colorHex: "#64748b",
				baseValue: 120,
				amplitude: 40,
				period: 288,
				noiseAmplitude: 8,
			},
			{
				name: "Air Handler Flow Rate",
				description: "Total air flow rate through AHU-1",
				unit: "m\u00B3/h",
				colorHex: "#78716c",
				baseValue: 5000,
				amplitude: 1500,
				period: 288,
				noiseAmplitude: 200,
			},
		],
	},
	{
		name: "Electric Vehicle Charging Stations",
		description:
			"Usage and performance data from the 12-station EV charging hub in parking garage B2.",
		storageFormat: "TIMESERIES",
		isPublic: true,
		timeseries: [
			{
				name: "Grid Load",
				description: "Total grid power demand from all charging stations",
				unit: "kW",
				colorHex: "#16a34a",
				baseValue: 80,
				amplitude: 60,
				period: 288,
				noiseAmplitude: 10,
			},
			{
				name: "Average Charging Rate",
				description: "Average charging rate across active stations",
				unit: "kW",
				colorHex: "#059669",
				baseValue: 22,
				amplitude: 15,
				period: 288,
				noiseAmplitude: 3,
			},
		],
	},
];

export const DETECTION_METHODS: DetectionMethod[] = ["STATISTICAL", "ML_AUTOENCODER", "RULE_BASED"];

// ============================================================================
// Main Seed Function
// ============================================================================

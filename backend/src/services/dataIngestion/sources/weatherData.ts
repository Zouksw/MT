/**
 * Weather Data Scraper
 *
 * Fetches weather data for major beef-producing regions.
 * Uses OpenWeatherMap free tier (60 calls/min).
 * Only stores real API data — no estimates.
 */

import { logger, prisma } from "@/lib";
import type { Scraper, ScraperResult } from "../scraperManager";

interface WeatherStation {
	name: string;
	lat: number;
	lon: number;
	country: string;
}

const WEATHER_STATIONS: WeatherStation[] = [
	{ name: "Beijing", lat: 39.9, lon: 116.4, country: "CN" },
	{ name: "Shanghai", lat: 31.2, lon: 121.5, country: "CN" },
	{ name: "Guangzhou", lat: 23.1, lon: 113.3, country: "CN" },
	{ name: "Zhengzhou", lat: 34.7, lon: 113.7, country: "CN" },
	{ name: "Sydney", lat: -33.9, lon: 151.2, country: "AU" },
	{ name: "Sao_Paulo", lat: -23.5, lon: -46.6, country: "BR" },
	{ name: "Buenos_Aires", lat: -34.6, lon: -58.4, country: "AR" },
	{ name: "Chicago", lat: 41.9, lon: -87.6, country: "US" },
];

interface OpenWeatherMapResponse {
	main: {
		temp: number;
		humidity: number;
	};
	rain?: {
		"1h"?: number;
	};
}

async function fetchFromAPI(
	apiKey: string,
	station: WeatherStation,
): Promise<{ temp: number; humidity: number; rainfall: number } | null> {
	const url = `https://api.openweathermap.org/data/2.5/weather?lat=${station.lat}&lon=${station.lon}&appid=${apiKey}&units=metric`;
	const res = await fetch(url);
	if (!res.ok) return null;
	const data = (await res.json()) as OpenWeatherMapResponse;
	return {
		temp: data.main.temp,
		humidity: data.main.humidity,
		rainfall: data.rain ? data.rain["1h"] || 0 : 0,
	};
}

export async function ingestWeatherData(): Promise<ScraperResult> {
	let inserted = 0;
	let updated = 0;

	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const apiKey = process.env.OPENWEATHER_API_KEY || "";

	if (!apiKey) {
		logger.warn("[Weather] OPENWEATHER_API_KEY not set, skipping");
		return { inserted: 0, updated: 0 };
	}

	for (const station of WEATHER_STATIONS) {
		let weather: Awaited<ReturnType<typeof fetchFromAPI>> = null;

		try {
			weather = await fetchFromAPI(apiKey, station);
		} catch {
			logger.warn(`[Weather] API failed for ${station.name}`);
		}

		if (!weather) continue;

		const region = `${station.name}_${station.country}`;

		for (const [metric, value] of [
			["temperature", weather.temp],
			["humidity", weather.humidity],
			["rainfall", weather.rainfall],
		] as const) {
			const existing = await prisma.marketFactor.findUnique({
				where: {
					type_region_date: { type: `weather_${metric}`, region, date: today },
				},
			});

			const data = {
				value,
				unit: metric === "temperature" ? "celsius" : metric === "humidity" ? "percent" : "mm",
				source: "openweathermap",
			};

			if (existing) {
				await prisma.marketFactor.update({ where: { id: existing.id }, data });
				updated++;
			} else {
				await prisma.marketFactor.create({
					data: { type: `weather_${metric}`, region, date: today, ...data },
				});
				inserted++;
			}
		}
	}

	return { inserted, updated };
}

export const weatherScraper: Scraper = {
	name: "weather",
	fetch: ingestWeatherData,
};

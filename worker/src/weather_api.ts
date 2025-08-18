import { Temporal } from '@js-temporal/polyfill';
import { z } from 'zod';

const PointsResponseSchema = z.object({
	properties: z.object({
		forecastHourly: z.url(),
	}),
});

const PeriodSchema = z.object({
	startTime: z.string(),
	endTime: z.string(),
	isDaytime: z.boolean(),
});

const ForecastResponseSchema = z.object({
	properties: z.object({
		periods: z.array(PeriodSchema),
	}),
});

const USER_AGENT = 'powerbuddy-lamp-controller, moosingin3space@gmail.com';

export interface SunsetHours {
	sundownTime: Temporal.Instant;
}

export async function retrieveSunsetHours(lat: string, lon: string): Promise<SunsetHours> {
	const pointsUrl = `https://api.weather.gov/points/${lat},${lon}`;
	const pointsResponse = await fetch(pointsUrl, {
		headers: {
			'User-Agent': USER_AGENT,
		},
	});
	const pointsData = PointsResponseSchema.parse(await pointsResponse.json());
	const forecastHourlyUrl = pointsData.properties.forecastHourly;
	console.log({
		scope: 'weather api',
		message: 'retrieved hourly forecast URL',
		forecastHourlyUrl,
	});

	const forecastResponse = await fetch(forecastHourlyUrl, {
		headers: {
			'User-Agent': USER_AGENT,
		},
	});
	const forecastData = ForecastResponseSchema.parse(await forecastResponse.json());

	// Find the first period that is nighttime (isDaytime === false) and use its endTime as sundownTime
	const sunsetPeriod = forecastData.properties.periods.find((period) => !period.isDaytime);
	if (!sunsetPeriod) {
		throw new Error('No sunset period found in forecast data');
	}

	console.log({
		scope: 'weather api',
		message: 'Fetched sunset period for today',
		sunsetPeriod,
	});
	const sundownTime = Temporal.Instant.from(sunsetPeriod.endTime);

	return { sundownTime };
}

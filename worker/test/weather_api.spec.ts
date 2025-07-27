import { afterEach, beforeAll, describe, it, expect } from 'vitest';
import * as nws_api from '../src/weather_api.ts';
import * as secrets from './secrets.ts';
import * as forecastResponse from './weather-forecast-response.json';
import { fetchMock } from 'cloudflare:test';

describe('The weather API client', () => {
	// Turn on mocking of outbound fetches
	beforeAll(() => {
		fetchMock.activate();
		fetchMock.disableNetConnect();
	});
	// Ensure that we don't have any remaining mocks
	afterEach(() => {
		fetchMock.assertNoPendingInterceptors();
	});

	it('fails if the first query fails', async () => {
		firstQueryFails();
		await expect(apiClient).rejects.toThrow();
	});

	it('fails if the second query fails', async () => {
		firstQuerySucceeds();
		secondQueryFails();
		await expect(apiClient).rejects.toThrow();
	});

	it('correctly determines the sunset hour given the forecast provided', async () => {
		firstQuerySucceeds();
		secondQuerySucceeds();
		const sunset = (await apiClient()).sundownTime.toZonedDateTimeISO(secrets.MY_TIMEZONE);
		expect(sunset.hour).toBe(19);
	});
});

const API_SERVER = 'https://api.weather.gov';
const HOURLY_URL = '/get-your-forecast-here';

function firstQueryFails() {
	initialQueryInterceptor().reply(400, 'something went wrong');
}

function firstQuerySucceeds() {
	initialQueryInterceptor().reply(200, {
		properties: {
			forecastHourly: `${API_SERVER}${HOURLY_URL}`,
		},
	});
}

function secondQueryFails() {
	secondQueryInterceptor().reply(400, 'something went wrong');
}

function secondQuerySucceeds() {
	secondQueryInterceptor().reply(200, forecastResponse);
}

function initialQueryInterceptor() {
	return fetchMock.get(API_SERVER).intercept({
		path: `/points/${secrets.LATITUDE},${secrets.LONGITUDE}`,
	});
}

function secondQueryInterceptor() {
	return fetchMock.get(API_SERVER).intercept({
		path: HOURLY_URL,
	});
}

async function apiClient() {
	return nws_api.retrieveSunsetHours(secrets.LATITUDE, secrets.LONGITUDE);
}

import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';

import worker from '../src/index.ts';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

async function invoke({ method, body }: { method: 'GET' | 'POST'; body?: Object }): Promise<Response> {
	const request = new IncomingRequest('https://example.com/hook', {
		method: method,
		body: body && JSON.stringify(body),
	});

	const ctx = createExecutionContext();
	const response = await worker.fetch(request, env, ctx);
	await waitOnExecutionContext(ctx);
	return response;
}

describe('The webhook', () => {
	it('should reject a non-POST method', async () => {
		const response = await invoke({ method: 'GET' });
		expect(response.status).toBe(405);
	});

	it('should return 400 when presented with non-conforming request data', async () => {
		const response = await invoke({ method: 'POST', body: {} });
		expect(response.status).toBe(400);
	});

	// TODO negative tests:
	// 1) improperly-formed JSON
	// 2) incorrect shared secret
});

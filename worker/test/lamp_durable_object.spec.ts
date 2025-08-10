import { env, listDurableObjectIds, runInDurableObject } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';

import { LampDurableObject } from '../src/index.ts';
import * as secrets from './secrets.ts';

describe('The lamp durable object', () => {
	it('matches the right type', async () => {
		await runWithLamp((instance: LampDurableObject) => {
			expect(instance).toBeInstanceOf(LampDurableObject);
		});
	});

	// TODO
	// 1) step through the state machine by sending signals
});

async function runWithLamp(f: (instance: LampDurableObject, state?: DurableObjectState) => unknown) {
	const id = env.LAMP.newUniqueId();
	const stub = env.LAMP.get(id);
	return await runInDurableObject(stub, f);
}

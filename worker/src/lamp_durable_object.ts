import { type ActorRefFrom, createActor } from 'xstate';
import { createLampMachine } from './lamp_fsm.ts';
import * as api from './meraki_api.ts';
import { DurableObject } from 'cloudflare:workers';
import { Temporal, Intl } from '@js-temporal/polyfill';

function isLateNight(env: Env): boolean {
	const now = Temporal.Now.instant().toZonedDateTimeISO(env.MY_TIMEZONE);

	return now.hour < 2 || now.hour > 22;
}

/** This class implements a lamp controlled with an MT40. */
export class LampDurableObject extends DurableObject {
	#fsm: ActorRefFrom<ReturnType<typeof createLampMachine>>;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);

		const mt40_api_call = ({ power }: { power: boolean }) => {
			return api.set_mt40_power(env.MERAKI_API_KEY, env.LAMP_MT40_SERIAL, { power });
		};

		const machine = createLampMachine({
			meraki_api: mt40_api_call,
			isAfterSunset: () => {
				throw new Error('isAfterSunset not implemented');
			},
			isLateNight: () => isLateNight(env),
		});

		this.#fsm = createActor(machine);
	}

	myDeviceDetected(connected: boolean) {
		// TODO
	}

	// Cron-triggered reconciliation stub
	reconcile() {
		// TODO
	}

	// Manual override control stub
	setManualOverride(action: 'on' | 'off') {
		this.#fsm.send({ type: `manual_override_${action}` });
	}
}

import { type ActorRefFrom, createActor, SnapshotFrom } from 'xstate';
import { createLampMachine } from './lamp_fsm.ts';
import * as api from './meraki_api.ts';
import { DurableObject } from 'cloudflare:workers';
import { Temporal, Intl } from '@js-temporal/polyfill';

function isLateNight(env: Env): boolean {
	const now = Temporal.Now.instant().toZonedDateTimeISO(env.MY_TIMEZONE);

	return now.hour < 2 || now.hour > 22;
}

type LampMachine = ReturnType<typeof createLampMachine>;

/** This class implements a lamp controlled with an MT40. */
export class LampDurableObject extends DurableObject {
	#fsm: ActorRefFrom<LampMachine> | null = null;

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

		ctx.blockConcurrencyWhile(async () => {
			await this.restoreOrCreate(machine);
		});
	}

	// Sets up a subscription for this finite state machine,
	// which will persist the state to storage whenever it changes.
	subscribeToSnapshot() {
		if (!this.#fsm) {
			throw new Error('FSM not initialized');
		}
		this.#fsm.subscribe(async () => {
			const snapshot = this.#fsm ? this.#fsm.getPersistedSnapshot() : null;
			await this.ctx.storage.put('snapshot', snapshot);
		});
	}

	async restoreOrCreate(machine: LampMachine) {
		if (this.#fsm) {
			throw new Error('actor already initialized');
		}

		const snapshot = await this.ctx.storage.get<SnapshotFrom<LampMachine>>('snapshot');
		if (snapshot) {
			this.#fsm = createActor(machine, { snapshot });
		} else {
			this.#fsm = createActor(machine);
		}
		this.#fsm.start();
		this.subscribeToSnapshot();
	}

	myDeviceDetected(connected: boolean) {
		// TODO
	}

	doorSignal(door: boolean) {
		// TODO
	}

	// Cron-triggered reconciliation stub
	reconcile() {
		// TODO
	}

	// Manual override control stub
	setManualOverride(action: 'on' | 'off') {
		if (this.#fsm) {
			this.#fsm.send({ type: `manual_override_${action}` });
		}
	}
}

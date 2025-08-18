import { type ActorRefFrom, createActor, SnapshotFrom } from 'xstate';
import { createLampMachine } from './lamp_fsm.ts';
import * as api from './meraki_api.ts';
import * as nws_api from './weather_api.ts';
import { DurableObject } from 'cloudflare:workers';
import { Temporal, Intl } from '@js-temporal/polyfill';

function isLateNight(env: Env): boolean {
	const now = Temporal.Now.instant().toZonedDateTimeISO(env.MY_TIMEZONE);

	return now.hour < 2 || now.hour > 22;
}

type LampMachine = ReturnType<typeof createLampMachine>;

interface PersistedSunset {
	forecast: nws_api.SunsetHours;
	queryTime: Temporal.Instant;
}

/** This class implements a lamp controlled with an MT40. */
export class LampDurableObject extends DurableObject<Env> {
	#fsm: ActorRefFrom<LampMachine> | null = null;
	#sunsetHours: PersistedSunset | null = null;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		try {
			console.debug({ message: 'constructor start', scope: 'LampDurableObject' });

			const mt40_api_call = ({ power }: { power: boolean }) => {
				return api.set_mt40_power(env.MERAKI_API_KEY, env.LAMP_MT40_SERIAL, { power });
			};

			const machine = createLampMachine({
				meraki_api: mt40_api_call,
				isAfterSunset: () => {
					const now = Temporal.Now.instant();
					if (this.#sunsetHours) {
						return Temporal.Instant.compare(this.#sunsetHours.forecast.sundownTime, now) > 0;
					}
					return false;
				},
				isLateNight: () => isLateNight(env),
			});

			ctx.blockConcurrencyWhile(async () => {
				try {
					await this.restoreOrCreate(machine);
					await this.getWeatherData();
				} catch (error) {
					console.error({
						scope: 'LampDurableObject',
						message: 'initial asynchronous setup failed',
						error,
					});
				}
			});
		} catch (error) {
			console.error({ message: 'constructor error', scope: 'LampDurableObject', error });
		}
	}

	// Sets up a subscription for this finite state machine,
	// which will persist the state to storage whenever it changes.
	subscribeToSnapshot() {
		console.debug({ message: 'subscribeToSnapshot start', scope: 'LampDurableObject' });
		if (!this.#fsm) {
			throw new Error('FSM not initialized');
		}
		this.#fsm.subscribe(async () => {
			const snapshot = this.#fsm ? this.#fsm.getPersistedSnapshot() : null;
			await this.ctx.storage.put('snapshot', snapshot);
		});
	}

	async restoreOrCreate(machine: LampMachine) {
		console.debug({ message: 'restoreOrCreate start', scope: 'LampDurableObject' });
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

	async getWeatherData() {
		console.debug({ message: 'getWeatherData start', scope: 'LampDurableObject' });
		if (this.#sunsetHours) {
			console.log({
				scope: 'LampDurableObject',
				message: 'sunsetHours already initialized, skipping',
			});
			return;
		}

		const now = Temporal.Now.instant();
		let saved;
		try {
			saved = await this.ctx.storage.get<PersistedSunset>('most_recent_sunsets');
		} catch (error) {
			console.error({ message: 'Error fetching persisted sunset data', scope: 'LampDurableObject', error });
			saved = null;
		}
		let shouldQueryAgain;
		if (saved) {
			// It's too old if the forecast age exceeds 2 hours.
			const hoursElapsed = now.since(saved.queryTime).total({ unit: 'hours' });
			const tooOld = hoursElapsed > 2;
			if (tooOld) {
				shouldQueryAgain = true;
			} else {
				shouldQueryAgain = false;
			}
		}

		if (shouldQueryAgain || !saved) {
			const result = await nws_api.retrieveSunsetHours(this.env.LATITUDE, this.env.LONGITUDE);
			const persistedSunset = {
				queryTime: now,
				forecast: result,
			};
			this.ctx.storage.put('most_recent_sunsets', persistedSunset);
			this.#sunsetHours = persistedSunset;
		} else {
			this.#sunsetHours = saved;
		}
	}

	myDeviceDetected(connected: boolean) {
		console.debug({ message: 'myDeviceDetected start', scope: 'LampDurableObject', connected });
		if (this.#fsm) {
			if (connected) {
				// We arrived
				this.#fsm.send({ type: 'arrive' });
			} else {
				this.#fsm.send({ type: 'leave' });
			}
		}
	}

	doorSignal(door: boolean) {
		console.debug({ message: 'doorSignal start', scope: 'LampDurableObject', door });
		if (this.#fsm) {
			this.#fsm.send({ type: door ? 'door_open' : 'door_close' });
		}
	}

	// Cron-triggered reconciliation stub
	reconcile() {
		try {
			console.debug({ message: 'reconcile start', scope: 'LampDurableObject' });
			if (this.#fsm) {
				this.#fsm.send({ type: 'time_check' });
			}
		} catch (error) {
			console.error({ message: 'reconcile error', scope: 'LampDurableObject', error });
		}
	}

	// Manual override control stub
	setManualOverride(action: 'on' | 'off') {
		console.debug({ message: 'setManualOverride start', scope: 'LampDurableObject', action });
		if (this.#fsm) {
			this.#fsm.send({ type: `manual_override_${action}` });
		}
	}
}

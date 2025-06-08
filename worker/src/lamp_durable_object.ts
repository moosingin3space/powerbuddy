import { createLampMachine } from "./lamp_fsm.ts";
import api from "./meraki_api.ts";
import { DurableObject } from "cloudflare:workers";

function isLateNight(): boolean {
  // TODO
  throw new Error('isLateNight not implemented');
}

/** This class implements a lamp controlled with an MT40. */
export class LampDurableObject extends DurableObject {
  #fsm: ReturnType<typeof createLampMachine>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    const mt40_api_call = ({ power }: { power: boolean }) => {
      return api.set_mt40_power(env.MERAKI_API_KEY, env.LAMP_MT40_SERIAL, { power });
    };

    this.#fsm = createLampMachine({
      meraki_api: mt40_api_call,
      isAfterSunset: () => { throw new Error('isAfterSunset not implemented') },
      isLateNight
    });
  }

  // Webhook event handler stub
  handleWebhook(event: { type: string }) {
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

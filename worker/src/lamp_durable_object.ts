import { createLampMachine } from "./lamp_fsm.ts";
import api from "./meraki_api.ts";
import { DurableObject } from "cloudflare:workers";

/** This class implements a lamp controlled with an MT40. */
export class LampDurableObject extends DurableObject {
  /**
   * The constructor creates a new FSM, with appropriate backends.
   */
   constructor(ctx: DurableObjectState, env: Env) {
     super(ctx, env);

     const mt40_api_call = ({power}: {power: boolean}) {
       return api.set_mt40_power(env.MERAKI_API_KEY, env.LAMP_MT40_SERIAL, { power });
     };

     this.#fsm = createLampMachine({
         meraki_api: mt40_api_call,
         isAfterSunset: null,
         isLateNight: null,
     });
   }

   // create stubs for a few events: 1) a webhook received, 2) a cron-triggered reconciliation, and 3) a manual override set. AI!
   // - Do not use the CloudFlare API. Just write the function stubs. The calling worker will parse the ingress data and pass it
   //   to the Durable Object in this file.
}

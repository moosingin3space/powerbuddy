import { createLampMachine } from "./lamp_fsm.ts";
import api from "./meraki_api.ts";
import { DurableObject } from "cloudflare:workers";

// implement a function called isLateNight that returns true between the hours of 2am-8am in Pacific Time. AI!

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

     this.#fsm = createLampMachine(
       mt40_api_call,
     );
   }
}

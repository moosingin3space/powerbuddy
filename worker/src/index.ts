import { DurableObject } from "cloudflare:workers";
import { LampDurableObject } from "./lamp_durable_object.ts";

async function webhook(request: Request, livingRoomLamp): Promise<Response> {
 // TODO
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
   const id: DurableObjectId = env.LAMP.idFromName("living_room");
   const livingRoomLamp = env.LAMP.get(id);

   const hookPattern = new URLPattern({ pathname: "/hook" });

   if (hookPattern.test(request.url)) {
    return await webhook(request, livingRoomLamp);
   }

   return new Response(null, { status: 404 });
  },
} satisfies ExportedHandler<Env>;

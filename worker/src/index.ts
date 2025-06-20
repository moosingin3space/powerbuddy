import { DurableObject } from 'cloudflare:workers';
import { LampDurableObject } from './lamp_durable_object.ts';
import { z } from 'zod';

export { LampDurableObject };

// Zod schema for the webhook request body, focusing on interested fields and sharedSecret
const webhookSchema = z.object({
	sharedSecret: z.string(),
	alertData: z
		.object({
			clientName: z.string().optional(),
			connected: z.string().optional(),
		})
		.optional(),
});

// The handler function for a Meraki Dashboard webhook
async function webhook(request: Request, livingRoomLamp: DurableObjectStub<LampDurableObject>, env: Env): Promise<Response> {
	try {
		const body = await request.json();
		const parsed = webhookSchema.safeParse(body);
		if (!parsed.success) {
			// If schema validation fails, return 400 Bad Request
			return new Response(null, { status: 400 });
		}

		const data = parsed.data;

		// Check shared secret
		if (data.sharedSecret !== env.MERAKI_SHARED_SECRET) {
			return new Response('Forbidden', { status: 403 });
		}

		// Load clients of interest from environment variable (already parsed as string array)
		const interestedClients = new Set(env.INTERESTED_CLIENTS || []);

		// Extract client name and connected state from the webhook payload
		const clientName = data.alertData?.clientName;
		const connectedStr = data.alertData?.connected;
		const connected = connectedStr === 'true';

		if (clientName && interestedClients.has(clientName)) {
			// Forward connected state to durable object via RPC method call
			await livingRoomLamp.myDeviceDetected(connected);
		}

		return new Response(null, { status: 200 });
	} catch {
		// Return 404 NOT FOUND if the webhook is improperly formed.
		return new Response(null, { status: 404 });
	}
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const id: DurableObjectId = env.LAMP.idFromName('living_room');
		const livingRoomLamp = env.LAMP.get(id);

		const hookPattern = new URLPattern({ pathname: '/hook' });

		if (hookPattern.test(request.url)) {
			return await webhook(request, livingRoomLamp, env);
		}

		return new Response(null, { status: 404 });
	},

	async scheduled(controller, env, ctx) {
		const id = env.LAMP.idFromName('living_room');
		const livingRoomLamp = env.LAMP.get(id);

		await livingRoomLamp.reconcile();
	},
} satisfies ExportedHandler<Env>;

import { LampDurableObject } from './lamp_durable_object.ts';
import { z } from 'zod';

export { LampDurableObject };

const clientConnectivitySchema = z.object({
	clientName: z.string(),
	connected: z.string(),
});

const sensorAlertSchema = z.object({
	alertConfigName: z.string(),
	triggerData: z.array(
		z.object({
			trigger: z.object({
				type: z.literal('door'),
				sensorValue: z.int(),
			}),
		}),
	),
});

// Zod schema for the webhook request body using discriminated union on alertTypeId
const webhookSchema = z.discriminatedUnion('alertTypeId', [
	z.object({
		sharedSecret: z.string(),
		alertTypeId: z.literal('client_connectivity'),
		alertData: clientConnectivitySchema,
	}),
	z.object({
		sharedSecret: z.string(),
		alertTypeId: z.literal('sensor_alert'),
		alertData: sensorAlertSchema,
	}),
]);

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

		switch (data.alertTypeId) {
			case 'client_connectivity':
				return await handleClientConnectivityUpdate(data.alertData, livingRoomLamp, env);
			case 'sensor_alert':
				return await handleSensorAlertUpdate(data.alertData, livingRoomLamp);
		}
	} catch {
		// Return 404 NOT FOUND if the webhook is improperly formed.
		return new Response(null, { status: 404 });
	}
}

async function handleClientConnectivityUpdate(
	alertData: z.infer<typeof clientConnectivitySchema>,
	livingRoomLamp: DurableObjectStub<LampDurableObject>,
	env: Env,
): Promise<Response> {
	// Load clients of interest from environment variable (already parsed as string array)
	const interestedClients = new Set(env.INTERESTED_CLIENTS || []);

	// Extract client name and connected state from the webhook payload
	const connected = alertData.connected === 'true';

	if (interestedClients.has(alertData.clientName)) {
		// Forward connected state to durable object via RPC method call
		await livingRoomLamp.myDeviceDetected(connected);
	}

	return new Response(null, { status: 200 });
}

async function handleSensorAlertUpdate(
	alertData: z.infer<typeof sensorAlertSchema>,
	livingRoomLamp: DurableObjectStub<LampDurableObject>,
): Promise<Response> {
	// Error handling: return 400 if triggerData is missing or empty
	if (!alertData.triggerData || alertData.triggerData.length === 0) {
		return new Response('Missing triggerData', { status: 400 });
	}
	const doorOpen = alertData.triggerData[0].trigger.sensorValue === 1;

	await livingRoomLamp.doorSignal(doorOpen);

	return new Response(null, { status: 200 });
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const id: DurableObjectId = env.LAMP.idFromName('living_room');
		const livingRoomLamp = env.LAMP.get(id);

		const hookPattern = new URLPattern({ pathname: '/hook' });

		if (hookPattern.test(request.url)) {
			if (request.method !== 'POST') {
				// 405 if not POST.
				return new Response(null, { status: 405 });
			}
			return await webhook(request, livingRoomLamp, env);
		}

		return new Response(null, { status: 404 });
	},

	async scheduled(controller, env, ctx) {
		try {
			const id = env.LAMP.idFromName('living_room');
			const livingRoomLamp = env.LAMP.get(id);

			// This should probably be invoked with waitUntil,
			// but in order to ensure the logging is correctly
			// set up, I'm invoking this in-line.
			await livingRoomLamp.reconcile();
		} catch (error) {
			console.error('[Worker] scheduled evaluation error', error);
		}
	},
} satisfies ExportedHandler<Env>;

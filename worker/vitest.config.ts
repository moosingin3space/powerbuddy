import { defineWorkersProject } from '@cloudflare/vitest-pool-workers/config';
import * as secrets from './test/secrets.ts';

export default defineWorkersProject({
	test: {
		poolOptions: {
			workers: {
				wrangler: { configPath: './wrangler.jsonc' },
				miniflare: {
					bindings: secrets,
				},
			},
		},
	},
});

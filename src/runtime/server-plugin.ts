import { defineNitroPlugin, useRuntimeConfig, defineEventHandler } from '#imports'

export default defineNitroPlugin(async (nitroApp) => {
    const config = useRuntimeConfig();

    const zoneId = config.cfPurge?.zoneId;
    const apiToken = config.cfPurge?.apiToken;
    const endpoint = config.cfPurge?.endpoint;
    const checkHealth = config.cfPurge?.checkHealth;
    const invalidations = config.cfPurge?.invalidations || [];

    if (!zoneId || !apiToken) {
        console.warn('[nuxt-cf-purge] Missing Cloudflare credentials. Execution restricted.');
    }

    // Startup Health Check
    if (checkHealth && zoneId && apiToken) {
        try {
            await $fetch(`${endpoint}/user/tokens/verify`, {
                headers: { 'Authorization': `Bearer ${apiToken}` }
            });
            console.info('[nuxt-cf-purge] Cloudflare credentials verified.');
        } catch (e) {
            console.error('[nuxt-cf-purge] Cloudflare credential verification failed. Check your API Token.', e);
        }
    }

    const chunkArray = <T>(array: T[], size: number): T[][] => {
        const chunks: T[][] = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    };

    const cloudflarePurge = async (payload: any) => {
        if (!zoneId || !apiToken) return false;
        try {
            await $fetch(`${endpoint}/zones/${zoneId}/purge_cache`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiToken}`,
                    'Content-Type': 'application/json'
                },
                body: payload,
                onResponseError({ response }) {
                    console.error('[nuxt-cf-purge] Cloudflare API Error:', {
                        status: response.status,
                        statusText: response.statusText,
                        errors: response._data?.errors || 'Unknown error'
                    });
                }
            });
            return true;
        } catch (e) {
            return false;
        }
    };

    nitroApp.hooks.hook('request', (event) => {
        // Core Purge Methods
        event.context.purgeCache = async (urls: string[]) => {
            const chunks = chunkArray(urls, 100);
            const results = await Promise.all(chunks.map(chunk => cloudflarePurge({ files: chunk })));
            return results.every(r => r === true);
        };

        event.context.purgeTags = async (tags: string[]) => {
            const chunks = chunkArray(tags, 30);
            const results = await Promise.all(chunks.map(chunk => cloudflarePurge({ tags: chunk })));
            return results.every(r => r === true);
        };

        event.context.purgeEverything = () => cloudflarePurge({ purge_everything: true });

        // Smart Invalidations Middleware
        if (invalidations.length > 0) {
            const path = event.path.split('?')[0];
            const method = event.method.toUpperCase();

            for (const rule of invalidations) {
                const ruleMethods = rule.methods || ['POST', 'PUT', 'PATCH', 'DELETE'];
                const match = rule.route.endsWith('/**') 
                    ? path.startsWith(rule.route.replace('/**', ''))
                    : path === rule.route;

                if (match && ruleMethods.includes(method)) {
                    // Trigger purges in background to not block response
                    if (rule.purgeEverything) event.context.purgeEverything();
                    if (rule.purgeUrls) event.context.purgeCache(rule.purgeUrls);
                    if (rule.purgeTags) event.context.purgeTags(rule.purgeTags);
                }
            }
        }
    });
});
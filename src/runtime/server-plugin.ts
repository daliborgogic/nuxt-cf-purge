import { defineNitroPlugin, useRuntimeConfig } from '#imports'

export default defineNitroPlugin((nitroApp) => {
    const config = useRuntimeConfig();

    const zoneId = config.cfPurge?.zoneId;
    const apiToken = config.cfPurge?.apiToken;
    // Normalize endpoint and fallback to official Cloudflare API
    const endpoint = config.cfPurge?.endpoint?.replace(/\/$/, '') || 'https://api.cloudflare.com/client/v4';
    const checkHealth = config.cfPurge?.checkHealth;
    const invalidations = config.cfPurge?.invalidations || [];

    if (!zoneId || !apiToken) {
        console.warn('[nuxt-cf-purge] Missing Cloudflare credentials. Runtime execution restricted.');
    }

    /**
     * Startup Health Check
     * Executed asynchronously to avoid blocking Nitro initialization/deployment.
     * Prevents Cloudflare API outages from crashing the application startup.
     */
    if (checkHealth && zoneId && apiToken) {
        $fetch(`${endpoint}/user/tokens/verify`, {
            headers: { 'Authorization': `Bearer ${apiToken}` }
        })
        .then(() => console.info('[nuxt-cf-purge] Cloudflare credentials successfully verified.'))
        .catch((e) => console.error('[nuxt-cf-purge] Cloudflare token verification failed on startup. Check API permissions.', e.message));
    }

    /**
     * Utility to split arrays into Cloudflare-compatible chunks.
     * Declared once at plugin level to prevent per-request memory allocation.
     */
    const chunkArray = <T>(array: T[], size: number): T[][] => {
        const chunks: T[][] = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    };

    /**
     * Centralized Cloudflare API request handler.
     * Reused by all purge methods to maintain clean logs and uniform error handling.
     */
    const cloudflarePurge = async (payload: any): Promise<boolean> => {
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
                        errors: response._data?.errors || 'Unknown upstream validation error.'
                    });
                }
            });
            return true;
        } catch (e) {
            console.error('[nuxt-cf-purge] Network context failure during purge execution:', e);
            return false;
        }
    };

    nitroApp.hooks.hook('request', (event) => {
        /**
         * Core Purge Methods
         * Assigned to event context by reference.
         * Zero new allocations per request, minimizing GC pressure under high traffic.
         */
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

        event.context.purgeHosts = async (hosts: string[]) => {
            const chunks = chunkArray(hosts, 100);
            const results = await Promise.all(chunks.map(chunk => cloudflarePurge({ hosts: chunk })));
            return results.every(r => r === true);
        };

        event.context.purgePrefixes = async (prefixes: string[]) => {
            const chunks = chunkArray(prefixes, 100);
            const results = await Promise.all(chunks.map(chunk => cloudflarePurge({ prefixes: chunk })));
            return results.every(r => r === true);
        };

        event.context.purgeEverything = () => cloudflarePurge({ purge_everything: true });

        /**
         * Smart Invalidations Middleware
         * Intercepts mutating requests (POST/PUT/PATCH/DELETE) and triggers purges.
         */
        if (invalidations.length > 0) {
            const path = event.path.split('?')[0];
            const method = event.method.toUpperCase();

            for (const rule of invalidations) {
                const ruleMethods = rule.methods || ['POST', 'PUT', 'PATCH', 'DELETE'];
                const match = rule.route.endsWith('/**') 
                    ? path.startsWith(rule.route.replace('/**', ''))
                    : path === rule.route;

                if (match && ruleMethods.includes(method)) {
                    /**
                     * Serverless Stability: waitUntil
                     * Signal the runtime (Cloudflare Workers/Pages) to keep the process alive
                     * until the asynchronous network calls to Cloudflare API are finished.
                     * We execute all tasks in parallel to minimize CPU runtime.
                     */
                    const executePurge = async () => {
                        const tasks: Promise<boolean>[] = [];
                        if (rule.purgeEverything) tasks.push(event.context.purgeEverything());
                        if (rule.purgeUrls) tasks.push(event.context.purgeCache(rule.purgeUrls));
                        if (rule.purgeTags) tasks.push(event.context.purgeTags(rule.purgeTags));
                        if (rule.purgeHosts) tasks.push(event.context.purgeHosts(rule.purgeHosts));
                        if (rule.purgePrefixes) tasks.push(event.context.purgePrefixes(rule.purgePrefixes));
                        
                        await Promise.all(tasks);
                    };

                    if (event.waitUntil) {
                        event.waitUntil(executePurge());
                    } else {
                        // Fallback for standard Node environments
                        executePurge().catch(() => {});
                    }
                }
            }
        }
    });
});
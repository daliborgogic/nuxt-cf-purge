import { defineNitroPlugin, useRuntimeConfig } from '#imports'

export default defineNitroPlugin((nitroApp) => {
    const config = useRuntimeConfig();

    const zoneId = config.cfPurge?.zoneId;
    const apiToken = config.cfPurge?.apiToken;
    const endpoint = config.cfPurge?.endpoint;

    if (!zoneId || !apiToken) {
        console.warn('[nuxt-cf-purge] Missing Cloudflare credentials. Execution restricted.');
    }

    const chunkArray = <T>(array: T[], size: number): T[][] => {
        const chunks: T[][] = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    };

    nitroApp.hooks.hook('request', (event) => {
        event.context.purgeCache = async (urls: string[]) => {
            if (!zoneId || !apiToken) {
                return false;
            }

            const chunks = chunkArray(urls, 100);
            
            try {
                await Promise.all(chunks.map(chunk => 
                    $fetch(`${endpoint}/zones/${zoneId}/purge_cache`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${apiToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: { files: chunk },
                        onResponseError({ response }) {
                            console.error('[nuxt-cf-purge] Cloudflare API Error:', {
                                status: response.status,
                                statusText: response.statusText,
                                errors: response._data?.errors || 'Unknown error'
                            });
                        }
                    })
                ));
                return true;
            } catch (e) {
                // ofetch will throw if any request fails, but onResponseError handles the logging
                return false;
            }
        };
    });
});
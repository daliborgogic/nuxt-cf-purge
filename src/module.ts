import { defineNuxtModule, addServerPlugin, createResolver } from '@nuxt/kit'
import { defu } from 'defu'
import { $fetch } from 'ofetch'

export interface InvalidationRule {
    route: string;
    methods?: string[];
    purgeUrls?: string[];
    purgeTags?: string[];
    purgeEverything?: boolean;
}

export interface ModuleOptions {
    zoneId?: string;
    apiToken?: string;
    endpoint?: string;
    autoPurge?: boolean;
    baseURL?: string;
    checkHealth?: boolean;
    invalidations?: InvalidationRule[];
}

export default defineNuxtModule<ModuleOptions>({
    meta: {
        name: 'nuxt-cf-purge',
        configKey: 'cfPurge',
        compatibility: {
            nuxt: '^3.0.0 || ^4.0.0'
        }
    },
    defaults: {
        zoneId: process.env.CLOUDFLARE_ZONE_ID,
        apiToken: process.env.CLOUDFLARE_API_TOKEN,
        endpoint: 'https://api.cloudflare.com/client/v4',
        autoPurge: false,
        baseURL: process.env.CF_PURGE_BASE_URL,
        checkHealth: false,
        invalidations: []
    },
    setup(options, nuxt) {
        const resolver = createResolver(import.meta.url)

        // Only allow endpoint override in non-production environments to prevent accidental leakage
        const isProd = process.env.NODE_ENV === 'production'
        const endpoint = (isProd || !options.endpoint) 
            ? 'https://api.cloudflare.com/client/v4' 
            : options.endpoint

        // Inject configuration nested under the shorthand key
        nuxt.options.runtimeConfig.cfPurge = defu(
            nuxt.options.runtimeConfig.cfPurge,
            {
                zoneId: options.zoneId,
                apiToken: options.apiToken,
                endpoint,
                baseURL: options.baseURL,
                invalidations: options.invalidations,
            }
        )

        addServerPlugin(resolver.resolve('./runtime/server-plugin'))

        // Auto-purge on build completion via manifest
        nuxt.hook('build:manifest', async (manifest) => {
            if (!options.autoPurge || !options.baseURL || !options.zoneId || !options.apiToken) {
                return
            }

            const buildAssetsDir = nuxt.options.app.buildAssetsDir || '/_nuxt/'
            const base = options.baseURL.replace(/\/$/, '')
            const prefix = `${base}${buildAssetsDir}`

            const urlsToPurge: Set<string> = new Set()

            for (const key in manifest) {
                const chunk = manifest[key]
                if (chunk.file) urlsToPurge.add(`${prefix}${chunk.file}`)
                if (chunk.css) chunk.css.forEach(c => urlsToPurge.add(`${prefix}${c}`))
                if (chunk.assets) chunk.assets.forEach(a => urlsToPurge.add(`${prefix}${a}`))
            }

            const urls = Array.from(urlsToPurge)
            if (urls.length === 0) return

            const chunkArray = <T>(array: T[], size: number): T[][] => {
                const chunks: T[][] = [];
                for (let i = 0; i < array.length; i += size) {
                    chunks.push(array.slice(i, i + size));
                }
                return chunks;
            };

            const chunks = chunkArray(urls, 100);
            
            try {
                console.info(`[nuxt-cf-purge] Auto-purging ${urls.length} assets from Cloudflare build manifest...`)
                await Promise.all(chunks.map(chunk => 
                    $fetch(`${endpoint}/zones/${options.zoneId}/purge_cache`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${options.apiToken}`,
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
                console.info(`[nuxt-cf-purge] Successfully purged build artifacts.`)
            } catch (e) {
                console.error('[nuxt-cf-purge] Build-time auto-purge failed:', e);
            }
        })

        // Add types for the augmented event context
        nuxt.hook('nitro:config', (nitroConfig) => {
            nitroConfig.typescript = nitroConfig.typescript || {}
            nitroConfig.typescript.tsConfig = nitroConfig.typescript.tsConfig || {}
            nitroConfig.typescript.tsConfig.compilerOptions = nitroConfig.typescript.tsConfig.compilerOptions || {}
            nitroConfig.typescript.tsConfig.compilerOptions.paths = nitroConfig.typescript.tsConfig.compilerOptions.paths || {}
        })
    }
})

declare module 'h3' {
    interface H3EventContext {
        purgeCache: (urls: string[]) => Promise<boolean>;
        purgeTags: (tags: string[]) => Promise<boolean>;
        purgeEverything: () => Promise<boolean>;
    }
}
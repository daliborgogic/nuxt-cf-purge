import { defineNuxtModule, addServerPlugin, createResolver } from '@nuxt/kit'
import { defu } from 'defu'

export interface ModuleOptions {
    zoneId?: string;
    apiToken?: string;
    endpoint?: string;
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
        endpoint: 'https://api.cloudflare.com/client/v4'
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
            }
        )

        addServerPlugin(resolver.resolve('./runtime/server-plugin'))

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
    }
}
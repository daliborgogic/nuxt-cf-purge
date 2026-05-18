export default defineNuxtConfig({
    modules: [
        '../src/module'
    ],

    cfPurge: {
        zoneId: process.env.CLOUDFLARE_ZONE_ID,
        apiToken: process.env.CLOUDFLARE_API_TOKEN
    }
})
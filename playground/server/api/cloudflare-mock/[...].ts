export default defineEventHandler(async (event) => {
    // This mocks https://api.cloudflare.com/client/v4/zones/:zoneId/purge_cache
    // But we are hitting it at /api/cloudflare-mock/zones/:zoneId/purge_cache
    
    const body = await readBody(event)
    const { zoneId } = event.context.params || {}

    if (body.files && body.files.length > 100) {
        setResponseStatus(event, 400)
        return { success: false, errors: ['Payload too large'] }
    }

    return { success: true, result: { id: zoneId } }
})
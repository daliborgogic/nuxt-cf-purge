export default defineEventHandler(async (event) => {
    const path = event.path;
    const method = event.method.toUpperCase();

    // Mock User Token Verification
    if (path.includes('/user/tokens/verify') && method === 'GET') {
        return { success: true, message: 'Token is valid' };
    }

    // Mock Purge Cache
    if (path.includes('/purge_cache') && method === 'POST') {
        const body = await readBody(event)
        
        if (body.files && body.files.length > 100) {
            setResponseStatus(event, 400)
            return { success: false, errors: ['URL payload too large'] }
        }

        if (body.tags && body.tags.length > 30) {
            setResponseStatus(event, 400)
            return { success: false, errors: ['Tag payload too large'] }
        }

        if (body.hosts && body.hosts.length > 100) {
            setResponseStatus(event, 400)
            return { success: false, errors: ['Host payload too large'] }
        }

        if (body.prefixes && body.prefixes.length > 100) {
            setResponseStatus(event, 400)
            return { success: false, errors: ['Prefix payload too large'] }
        }

        return { success: true, result: { id: 'mock-id' } }
    }

    setResponseStatus(event, 404)
    return { error: 'Not Found' }
})
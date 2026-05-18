import { http, HttpResponse } from 'msw'

export const handlers = [
    http.post('https://api.cloudflare.com/client/v4/zones/:zoneId/purge_cache', async ({ request, params }) => {
        const body = await request.json() as { files?: string[] }

        // Simulate Cloudflare breaking if a payload exceeds 100 elements
        if (body.files && body.files.length > 100) {
            return new HttpResponse(JSON.stringify({ success: false, errors: ['Payload too large'] }), { status: 400 })
        }

        // Mock successful eviction
        return HttpResponse.json({ success: true, result: { id: params.zoneId } })
    })
]
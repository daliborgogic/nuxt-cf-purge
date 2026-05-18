import { http, HttpResponse } from 'msw'

export const handlers = [
    http.get('https://api.cloudflare.com/client/v4/user/tokens/verify', () => {
        return HttpResponse.json({ success: true, message: 'Token is valid' })
    }),

    http.post('https://api.cloudflare.com/client/v4/zones/:zoneId/purge_cache', async ({ request, params }) => {
        const body = await request.json() as { files?: string[], tags?: string[], purge_everything?: boolean }

        if (body.files && body.files.length > 100) {
            return new HttpResponse(JSON.stringify({ success: false, errors: ['URL payload too large'] }), { status: 400 })
        }

        if (body.tags && body.tags.length > 30) {
            return new HttpResponse(JSON.stringify({ success: false, errors: ['Tag payload too large'] }), { status: 400 })
        }

        return HttpResponse.json({ success: true, result: { id: params.zoneId } })
    })
]
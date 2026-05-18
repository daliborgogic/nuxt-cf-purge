import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { setup, $fetch } from '@nuxt/test-utils'
import { setupServer } from 'msw/node'
import { handlers } from './mocks/handlers'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { existsSync } from 'node:fs'

// Vitest compiles this natively now that missing explicit imports are resolved
import MyCloudflareModule from '../src/module'

const server = setupServer(...handlers)

const findProjectRoot = (): string => {
    let currentDir = dirname(fileURLToPath(import.meta.url))
    while (currentDir !== resolve(currentDir, '..')) {
        if (existsSync(resolve(currentDir, 'package.json'))) {
            return currentDir
        }
        currentDir = resolve(currentDir, '..')
    }
    throw new Error('Critical: Could not dynamically determine module project root.')
}

const projectRoot = findProjectRoot()

describe('nuxt-cf-purge Integration Tests', async () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
    afterEach(() => server.resetHandlers())
    afterAll(() => server.close())

    await setup({
        rootDir: resolve(projectRoot, 'playground'),
        nuxtConfig: {
            modules: [
                '../src/module'
            ],
            cfPurge: {
                zoneId: 'mock-zone-id-123',
                apiToken: 'mock-token-xyz',
                endpoint: '/api/cloudflare-mock'
            }
        }
    })

    it('should execute cache purges successfully through the event context', async () => {
        const response = await $fetch('/api/test-purge', {
            method: 'POST',
            body: { urls: ['https://example.com/asset.css'] }
        })
        expect(response).toEqual({ success: true })
    })

    it('should chunk inputs and hit the endpoint multiple times if over 100 items', async () => {
        const bulkyPayload = Array.from({ length: 150 }, (_, i) => `https://example.com/${i}`)
        const response = await $fetch('/api/test-purge', {
            method: 'POST',
            body: { urls: bulkyPayload }
        })
        expect(response).toEqual({ success: true })
    })
})
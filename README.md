# nuxt-cf-purge

[![npm version](https://badge.fury.io/js/nuxt-cf-purge.svg)](https://badge.fury.io/js/nuxt-cf-purge)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Blazing fast, parallel-chunked Cloudflare Edge Cache purger for Nuxt 4 and Nitro.

## Features

- 🚀 **Parallel Execution:** Purges multiple batches concurrently for maximum performance.
- 📦 **Automatic Chunking:** Automatically splits large URL lists into batches of 100 to respect Cloudflare API limits.
- 🧹 **Build-Time Auto Purge:** Automatically reads your build manifest and purges new assets from Cloudflare upon build completion.
- 🏷️ **Cache-Tag Support:** Purge entire categories of content using Cloudflare Cache-Tags (Enterprise/Business).
- 🪄 **Self-Healing Cache:** Automated route-to-cache mapping triggers purges when specific API routes are hit.
- 🛡️ **Type Safe:** Fully typed helpers added directly to the H3 event context.
- 🔧 **Zero Config:** Falls back to standard Cloudflare environment variables out of the box.
- 🧪 **Test-Ready:** Includes a configurable endpoint for local mocking and integration testing.

## Architecture & Stability

This module is built for high-performance production environments and enterprise-grade reliability.

- 💎 **Zero Allocation Runtime:** Core purge functions are initialized once during startup and assigned by reference to the request context. This eliminates per-request memory overhead and Garbage Collection pressure.
- ⚡ **Serverless-First:** Uses Nitro's `event.waitUntil` to ensure background purge tasks are completed on serverless platforms (Cloudflare Workers/Pages) even after the HTTP response is sent.
- 🩺 **Non-Blocking Initialization:** Startup health checks are asynchronous. Your application will boot instantly even if the Cloudflare API is temporarily unreachable.
- 🛡️ **Parallel Execution:** High-concurrency network calls with automatic chunking ensure your cache is cleared as fast as possible while respecting Cloudflare API rate limits.

## Installation

```bash
# npm
npm install nuxt-cf-purge

# pnpm
pnpm add nuxt-cf-purge

# yarn
yarn add nuxt-cf-purge
```

## Setup

Add `nuxt-cf-purge` to the `modules` section of `nuxt.config.ts`. 

### Method A: Environment Variables (Recommended)
The module automatically looks for these variables. If they are set, no further configuration is needed in your code.

```bash
# .env
CLOUDFLARE_ZONE_ID=your-zone-id
CLOUDFLARE_API_TOKEN=your-api-token
```

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['nuxt-cf-purge']
})
```

### Method B: Manual Configuration
Use this if you need to override environment variables or handle multiple environments manually.

```typescript
export default defineNuxtConfig({
  modules: ['nuxt-cf-purge'],

  cfPurge: {
    zoneId: 'your-zone-id',
    apiToken: 'your-api-token',
    baseURL: 'https://example.com',
    autoPurge: true,
    checkHealth: true, // Verify credentials on startup
    invalidations: [
      { 
        route: '/api/posts/**', 
        methods: ['POST', 'PUT', 'DELETE'], 
        purgeUrls: ['/blog', '/api/posts'],
        purgeTags: ['all-posts']
      }
    ]
  }
})
```

> **Note:** While the `cfPurge` config block is optional, the **credentials themselves are required** for the purger to work. If neither environment variables nor config values are found, the module will log a warning and return `false` during execution without crashing your server.

## Build-Time Auto Purge

If you enable `autoPurge`, the module hooks into the Nuxt build process (`build:manifest`). It extracts all generated JS, CSS, and static asset paths from the manifest and purges them from Cloudflare immediately.

**Requirements:**
1. `autoPurge: true`
2. `baseURL`: Your production domain (e.g., `https://example.com`). This is needed to construct the absolute URLs required by the Cloudflare API.

```typescript
export default defineNuxtConfig({
  cfPurge: {
    autoPurge: true,
    baseURL: 'https://example.com'
  }
})
```

## Usage

The module injects several helpers into the Nitro event context.
### URL Purging
> **Note:** Cloudflare requires **absolute URLs** (e.g., `https://example.com/page-1`). Relative paths (e.g., `/page-1`) will not be recognized by the Cache API.

```typescript
await event.context.purgeCache(['https://example.com/page-1'])
```

### Cache-Tag Purging
> **Plan Requirement:** This is a **Cloudflare Enterprise/Business** feature.

```typescript
await event.context.purgeTags(['blog-posts', 'user-profile'])
```

### Host Purging
> **Plan Requirement:** This is a **Cloudflare Enterprise** feature.

```typescript
await event.context.purgeHosts(['shop.example.com', 'dev.example.com'])
```

### Prefix Purging
> **Plan Requirement:** This is a **Cloudflare Enterprise** feature.

```typescript
await event.context.purgePrefixes(['https://example.com/assets/images'])
```

### Global Purge (Nuke Everything)
```typescript
await event.context.purgeEverything()
```

## Smart Invalidations (The "Self-Healing" Cache)

You can automate your cache management by defining `invalidations` in your config. This eliminates the need to manually call purge helpers inside your business logic.

> **Important:** Features like `purgeTags`, `purgeHosts`, and `purgePrefixes` still require their respective Cloudflare Plan tiers even when automated.

```typescript
cfPurge: {
...
  invalidations: [
    {
      // Matches /api/posts and /api/posts/123
      route: '/api/posts/**',
      // Triggers for these HTTP methods (defaults to all mutating methods)
      methods: ['POST', 'PUT', 'DELETE'],
      // URLs to purge when the route is hit
      purgeUrls: ['/blog', '/api/posts'],
      // Tags to purge
      purgeTags: ['posts-archive'],
      // Hosts to purge
      purgeHosts: ['blog.example.com'],
      // Prefixes to purge
      purgePrefixes: ['https://example.com/static']
    }
  ]
}
```

## Build-Time Auto Purge

| Option | Environment Variable | Description |
| --- | --- | --- |
| `zoneId` | `CLOUDFLARE_ZONE_ID` | Your Cloudflare Zone ID. |
| `apiToken` | `CLOUDFLARE_API_TOKEN` | A Cloudflare API Token with `Zone.Cache Purge` permissions. |
| `autoPurge` | - | Enable automatic purging on build completion (default: `false`). |
| `baseURL` | `CF_PURGE_BASE_URL` | Your production domain (required for `autoPurge` and `invalidations`). |
| `checkHealth` | - | Verify API token validity during Nitro startup (default: `false`). |
| `invalidations` | - | Array of rules for automated route-triggered purges. |
| `endpoint` | - | Custom API endpoint (ignored in production; used for testing). |

## Error Handling

If a purge fails, the module logs the specific error payload from the Cloudflare API to `consola.error`, helping you diagnose issues like invalid tokens or malformed URLs immediately.

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build module
npm run prepack
```

## License

MIT

# nuxt-cf-purge

[![npm version](https://badge.fury.io/js/nuxt-cf-purge.svg)](https://badge.fury.io/js/nuxt-cf-purge)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Blazing fast, parallel-chunked Cloudflare Edge Cache purger for Nuxt 4 and Nitro.

## Features

- 🚀 **Parallel Execution:** Purges multiple batches concurrently for maximum performance.
- 📦 **Automatic Chunking:** Automatically splits large URL lists into batches of 100 to respect Cloudflare API limits.
- 🛡️ **Type Safe:** Fully typed `purgeCache` helper added directly to the H3 event context.
- 🔧 **Zero Config:** Falls back to standard Cloudflare environment variables out of the box.
- 🧪 **Test-Ready:** Includes a configurable endpoint for local mocking and integration testing.

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

Add `nuxt-cf-purge` to the `modules` section of `nuxt.config.ts`:

```typescript
export default defineNuxtConfig({
  modules: [
    'nuxt-cf-purge'
  ],

  cfPurge: {
    // Optional: Defaults to process.env.CLOUDFLARE_ZONE_ID
    zoneId: 'your-zone-id',
    
    // Optional: Defaults to process.env.CLOUDFLARE_API_TOKEN
    apiToken: 'your-api-token'
  }
})
```

## Usage

The module injects a `purgeCache` function into the Nitro event context. You can use it in any server route or middleware:

```typescript
// server/api/purge.ts
export default defineEventHandler(async (event) => {
  const urls = [
    'https://example.com/styles.css',
    'https://example.com/logo.png'
  ]

  const success = await event.context.purgeCache(urls)

  return {
    purged: success
  }
})
```

### Automatic Chunking
If you pass more than 100 URLs, the module will automatically split them into batches of 100 and send the requests in parallel to Cloudflare.

```typescript
// This will trigger 3 parallel API calls to Cloudflare
const massiveList = Array.from({ length: 250 }, (_, i) => `https://example.com/${i}`)
await event.context.purgeCache(massiveList)
```

## Configuration

| Option | Environment Variable | Description |
| --- | --- | --- |
| `zoneId` | `CLOUDFLARE_ZONE_ID` | Your Cloudflare Zone ID. |
| `apiToken` | `CLOUDFLARE_API_TOKEN` | A Cloudflare API Token with `Zone.Cache Purge` permissions. |
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

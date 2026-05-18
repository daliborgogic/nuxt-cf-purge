export default defineEventHandler(async (event) => {
    const body = await readBody(event)

    let success = false
    if (body.urls) {
        success = await event.context.purgeCache(body.urls)
    } else if (body.tags) {
        success = await event.context.purgeTags(body.tags)
    } else if (body.everything) {
        success = await event.context.purgeEverything()
    }

    return { success }
})
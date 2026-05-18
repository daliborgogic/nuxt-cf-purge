export default defineEventHandler(async (event) => {
    const body = await readBody(event)

    // Call the module's runtime injection
    const success = await event.context.purgeCache(body.urls)

    return { success }
})
export default defineEventHandler(async (event) => {
    // This route is used to test the automated invalidations middleware
    return { status: 'mutated' }
})
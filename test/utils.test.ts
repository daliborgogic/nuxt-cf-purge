import { describe, it, expect } from 'vitest'

// Helper function from your plugin/module
const chunkArray = <T>(array: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
};

describe('Chunking Utility', () => {
    it('should split an array into equal segments of 100', () => {
        const massiveArray = Array.from({ length: 250 }, (_, i) => `https://e.com/${i}`)
        const chunks = chunkArray(massiveArray, 100)

        expect(chunks).toHaveLength(3)
        expect(chunks[0]).toHaveLength(100)
        expect(chunks[1]).toHaveLength(100)
        expect(chunks[2]).toHaveLength(50)
    })

    it('should handle arrays smaller than the threshold gracefully', () => {
        const smallArray = ['https://e.com/1', 'https://e.com/2']
        const chunks = chunkArray(smallArray, 100)

        expect(chunks).toHaveLength(1)
        expect(chunks[0]).toEqual(smallArray)
    })
})
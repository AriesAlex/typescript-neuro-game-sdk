import { defineConfig } from 'tsdown'

export default defineConfig([
    {
        entry: 'src/index.ts',
        outDir: 'dist',
        platform: 'node',
        format: ['esm', 'cjs'],
        dts: true,
        attw: true
    },
    {
        entry: 'src/index.ts',
        outDir: 'dist/browser',
        platform: 'browser',
        format: 'umd',
        outputOptions: {
            name: 'NeuroGameSdk'
        }
    }
])

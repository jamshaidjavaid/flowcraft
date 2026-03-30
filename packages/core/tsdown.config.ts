import { defineConfig } from 'tsdown'

export default defineConfig({
	entry: ['src/index.ts', 'src/sdk.ts', 'src/testing/index.ts'],
	format: ['esm'],
	target: 'esnext',
	dts: true,
	clean: true,
	sourcemap: true,
	splitting: true,
	treeshake: true,
	minify: false,
})

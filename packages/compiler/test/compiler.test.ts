import { describe, expect, it } from 'vitest'
import { Compiler } from '../src/compiler'

describe('Compiler', () => {
	it('should compile a simple project', () => {
		const compiler = new Compiler('tsconfig.json')
		const result = compiler.compileProject(['src/index.ts'])
		expect(result.blueprints).toBeDefined()
		expect(result.registry).toBeDefined()
		expect(result.diagnostics).toBeDefined()
	})

	it('should compile all test fixtures', () => {
		const compiler = new Compiler('tsconfig.json')
		const result = compiler.compileProject(['fixtures/index.ts'])

		expect(result.blueprints).toBeDefined()
		expect(Object.keys(result.blueprints).length).toBeGreaterThan(0)

		expect(result.registry).toBeDefined()
		expect(Object.keys(result.registry).length).toBeGreaterThan(0)

		expect(result.diagnostics).toBeDefined()

		expect(result.manifestSource).toBeDefined()
		expect(result.manifestSource).toContain('export const registry')
		expect(result.manifestSource).toContain('export const blueprints')

		const blueprintNames = Object.keys(result.blueprints)
		expect(blueprintNames).toContain('simpleFlow')
		expect(blueprintNames).toContain('parallelFlow')
		expect(blueprintNames).toContain('whileLoopWithBreak')
	})

	it('should preserve source locations in blueprints', () => {
		const compiler = new Compiler('tsconfig.json')
		const result = compiler.compileProject(['fixtures/simple-flow.ts'])

		const simpleFlow = result.blueprints.simpleFlow
		expect(simpleFlow).toBeDefined()

		const fetchUser = simpleFlow.nodes.find((n) => n.id === 'fetchUser_1')
		expect(fetchUser).toBeDefined()
		expect(fetchUser._sourceLocation).toBeDefined()
		expect(fetchUser._sourceLocation.file).toContain('simple-flow.ts')
		expect(fetchUser._sourceLocation.line).toBe(3)
		expect(fetchUser._sourceLocation.column).toBe(2)
	})

	it('should handle conditional edges correctly', () => {
		const compiler = new Compiler('tsconfig.json')
		const result = compiler.compileProject(['fixtures/simple-if-else.ts'])

		const ifElseFlow = result.blueprints.simpleIfElseFlow
		expect(ifElseFlow).toBeDefined()

		const conditionalEdges = ifElseFlow.edges.filter((e) => e.condition)
		expect(conditionalEdges.length).toBe(2)
	})

	it('should handle loop constructs correctly', () => {
		const compiler = new Compiler('tsconfig.json')
		const result = compiler.compileProject(['fixtures/loop-control-flow.ts'])

		const whileLoop = result.blueprints.whileLoopWithBreak
		expect(whileLoop).toBeDefined()

		const loopController = whileLoop.nodes.find((n) => n.uses === 'loop-controller')
		expect(loopController).toBeDefined()
		expect(loopController.params?.condition).toBeDefined()

		const breakEdges = whileLoop.edges.filter((e) => e.action === 'break')
		expect(breakEdges.length).toBeGreaterThan(0)
	})

	it('should handle parallel execution correctly', () => {
		const compiler = new Compiler('tsconfig.json')
		const result = compiler.compileProject(['fixtures/parallel-flow.ts'])

		const parallelFlow = result.blueprints.parallelFlow
		expect(parallelFlow).toBeDefined()

		const parallelNodes = parallelFlow.nodes.filter((n) => n.id?.endsWith('_parallel_1'))
		expect(parallelNodes.length).toBe(3)

		const joinNode = parallelFlow.nodes.find(
			(n) => n.uses === 'aggregateData' && n.config?.joinStrategy === 'all',
		)
		expect(joinNode).toBeDefined()
	})

	it('should compile complex control flow with loops and error handling', () => {
		const compiler = new Compiler('tsconfig.json')
		const result = compiler.compileProject(['fixtures/complex-control-flow.ts'])

		expect(result.blueprints.complexControlFlow).toBeDefined()
		expect(result.blueprints.nestedControlFlow).toBeDefined()

		const complex = result.blueprints.complexControlFlow

		const loopController = complex.nodes.find((n) => n.uses === 'loop-controller')
		expect(loopController).toBeDefined()
		expect(loopController.params?.condition).toContain('currentBatch')

		const fallbackNode = complex.nodes.find((n) => n.config?.fallback)
		expect(fallbackNode).toBeDefined()
		expect(fallbackNode.config.fallback).toContain('handleBatchError')
	})

	it('should handle subflows correctly', () => {
		const compiler = new Compiler('tsconfig.json')
		const result = compiler.compileProject(['fixtures/main-flow.ts'])

		const mainFlow = result.blueprints.mainFlow
		expect(mainFlow).toBeDefined()

		const subflowNode = mainFlow.nodes.find((n) => n.uses === 'subflow')
		expect(subflowNode).toBeDefined()
		expect(subflowNode.params?.blueprintId).toBe('subFlow')
	})

	it('should handle for-of loops with break/continue', () => {
		const compiler = new Compiler('tsconfig.json')
		const result = compiler.compileProject(['fixtures/loop-control-flow.ts'])

		const forOfWithBreak = result.blueprints.forOfLoopWithBreak
		expect(forOfWithBreak).toBeDefined()

		const continueEdges = forOfWithBreak.edges.filter((e) => e.action === 'continue')
		expect(continueEdges.length).toBeGreaterThan(0)

		const forOfWithContinue = result.blueprints.forOfLoopWithContinue
		expect(forOfWithContinue).toBeDefined()
	})

	it('should handle while loops with continue', () => {
		const compiler = new Compiler('tsconfig.json')
		const result = compiler.compileProject(['fixtures/loop-control-flow.ts'])

		const whileContinue = result.blueprints.whileLoopWithContinue
		expect(whileContinue).toBeDefined()

		const continueEdges = whileContinue.edges.filter((e) => e.action === 'continue')
		expect(continueEdges.length).toBeGreaterThan(0)
	})

	it('should register all step functions in registry', () => {
		const compiler = new Compiler('tsconfig.json')
		const result = compiler.compileProject(['fixtures/simple-flow.ts'])

		expect(result.registry.fetchUser).toBeDefined()
		expect(result.registry.fetchUser.exportName).toBe('fetchUser')
		expect(result.registry.fetchUser.importPath).toContain('simple-flow.ts')

		expect(result.registry.processOrders).toBeDefined()
	})

	it('should generate valid manifest source code', () => {
		const compiler = new Compiler('tsconfig.json')
		const result = compiler.compileProject(['fixtures/simple-flow.ts'])

		expect(result.manifestSource).toContain('import { fetchUser }')
		expect(result.manifestSource).toContain('import { processOrders }')
		expect(result.manifestSource).toContain('export const registry')
		expect(result.manifestSource).toContain('export const blueprints')
	})

	it('should handle type mismatch errors in diagnostics', () => {
		const compiler = new Compiler('tsconfig.json')
		const result = compiler.compileProject(['fixtures/type-mismatch.ts'])

		expect(result.diagnostics.length).toBeGreaterThan(0)
		const typeError = result.diagnostics.find((d) => d.severity === 'error')
		expect(typeError).toBeDefined()
	})

	it('should handle invalid await errors', () => {
		const compiler = new Compiler('tsconfig.json')
		const result = compiler.compileProject(['fixtures/invalid-await.ts'])

		const awaitError = result.diagnostics.find((d) => d.severity === 'error')
		expect(awaitError).toBeDefined()
		expect(awaitError.message).toContain('await')
	})
})

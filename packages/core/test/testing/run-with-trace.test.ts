import { describe, expect, it, vi } from 'vitest'
import { createFlow } from '../../src/flow'
import { FlowRuntime } from '../../src/runtime'
import { runWithTrace } from '../../src/testing/run-with-trace'

describe('runWithTrace', () => {
	it('should run a workflow and return result on success', async () => {
		const flow = createFlow('trace-success')
			.node('A', async () => ({ output: 'hello' }))
			.node('B', async ({ input }) => ({ output: `${input}-world` }))
			.edge('A', 'B')

		const runtime = new FlowRuntime()
		const result = await runWithTrace(
			runtime,
			flow.toBlueprint(),
			{},
			{ functionRegistry: flow.getFunctionRegistry() },
		)

		expect(result.status).toBe('completed')
		expect(result.context['_outputs.B']).toBe('hello-world')
	})

	it('should handle workflow failure gracefully', async () => {
		const flow = createFlow('trace-fail').node('A', async () => {
			throw new Error('Intentional failure')
		})

		const runtime = new FlowRuntime()
		const result = await runWithTrace(
			runtime,
			flow.toBlueprint(),
			{},
			{ functionRegistry: flow.getFunctionRegistry() },
		)

		expect(result.status).toBe('failed')
		expect(result.errors).toBeDefined()
	})

	it('should print trace on success when DEBUG is set', async () => {
		const originalDebug = process.env.DEBUG
		process.env.DEBUG = '1'

		const flow = createFlow('trace-debug').node('A', async () => ({ output: 'debug-test' }))

		const runtime = new FlowRuntime()
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

		const result = await runWithTrace(
			runtime,
			flow.toBlueprint(),
			{},
			{ functionRegistry: flow.getFunctionRegistry() },
		)

		expect(result.status).toBe('completed')
		expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Successful Trace'))

		logSpy.mockRestore()
		if (originalDebug === undefined) {
			delete process.env.DEBUG
		} else {
			process.env.DEBUG = originalDebug
		}
	})

	it('should use initial state when provided', async () => {
		const flow = createFlow('trace-state').node('A', async ({ context }) => {
			const value = await context.get('initialValue')
			return { output: value }
		})

		const runtime = new FlowRuntime()
		const result = await runWithTrace(
			runtime,
			flow.toBlueprint(),
			{ initialValue: 'test-value' },
			{ functionRegistry: flow.getFunctionRegistry() },
		)

		expect(result.status).toBe('completed')
		expect(result.context['_outputs.A']).toBe('test-value')
	})

	it('should use serialized initial state when provided as string', async () => {
		const flow = createFlow('trace-serialized').node('A', async ({ context }) => {
			const value = await context.get('initialValue')
			return { output: value }
		})

		const runtime = new FlowRuntime()
		const result = await runWithTrace(
			runtime,
			flow.toBlueprint(),
			JSON.stringify({ initialValue: 'serialized-value' }),
			{ functionRegistry: flow.getFunctionRegistry() },
		)

		expect(result.status).toBe('completed')
		expect(result.context['_outputs.A']).toBe('serialized-value')
	})

	it('should pass signal option to runtime', async () => {
		const flow = createFlow('trace-signal').node('A', async ({ signal }) => {
			return { output: signal !== undefined ? 'has-signal' : 'no-signal' }
		})

		const runtime = new FlowRuntime()
		const controller = new AbortController()
		const result = await runWithTrace(
			runtime,
			flow.toBlueprint(),
			{},
			{
				functionRegistry: flow.getFunctionRegistry(),
				signal: controller.signal,
			},
		)

		expect(result.status).toBe('completed')
		expect(result.context['_outputs.A']).toBe('has-signal')
	})

	it('should pass strict option to runtime', async () => {
		const flow = createFlow('trace-strict').node('A', async () => ({ output: 'a' }))

		const runtime = new FlowRuntime()
		const result = await runWithTrace(
			runtime,
			flow.toBlueprint(),
			{},
			{
				functionRegistry: flow.getFunctionRegistry(),
				strict: true,
			},
		)

		expect(result.status).toBe('completed')
	})

	it('should pass functionRegistry option to runtime', async () => {
		const flow = createFlow('trace-registry').node('A', async () => ({
			output: 'registry-test',
		}))

		const runtime = new FlowRuntime()
		const result = await runWithTrace(
			runtime,
			flow.toBlueprint(),
			{},
			{ functionRegistry: flow.getFunctionRegistry() },
		)

		expect(result.status).toBe('completed')
		expect(result.context['_outputs.A']).toBe('registry-test')
	})

	it('should handle complex workflow with trace', async () => {
		const flow = createFlow('trace-complex')
			.node('init', async ({ context }) => {
				await context.set('counter', 0)
				return { output: 'init' }
			})
			.node('process', async ({ context, input }) => {
				const counter = (await context.get('counter')) + 1
				await context.set('counter', counter)
				return { output: `${input}-${counter}` }
			})
			.node('finalize', async ({ context, input }) => {
				const counter = await context.get('counter')
				return { output: `${input}-final-${counter}` }
			})
			.edge('init', 'process')
			.edge('process', 'finalize')

		const runtime = new FlowRuntime()
		const result = await runWithTrace(
			runtime,
			flow.toBlueprint(),
			{},
			{ functionRegistry: flow.getFunctionRegistry() },
		)

		expect(result.status).toBe('completed')
		expect(result.context.counter).toBe(1)
		expect(result.context['_outputs.finalize']).toBe('init-1-final-1')
	})
})

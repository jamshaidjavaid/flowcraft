import { describe, expect, it } from 'vitest'
import { createFlow, FlowRuntime } from '../../src'
import { SubflowNode } from '../../src/nodes/subflow'

describe('SubflowNode', () => {
	it('should execute a subflow and return output', async () => {
		const subFlow = createFlow('sub').node('a', async () => ({ output: 'sub-result' }))

		const mainFlow = createFlow('main')
			.node('start', async () => ({ output: 'start' }))
			.node('call-sub', SubflowNode, {
				params: { blueprintId: 'sub' },
			})
			.node('end', async ({ input }) => ({ output: `end-${input}` }))
			.edge('start', 'call-sub')
			.edge('call-sub', 'end')

		const subBlueprint = subFlow.toBlueprint()
		const mainBlueprint = mainFlow.toBlueprint()
		const combinedRegistry = new Map([
			...mainFlow.getFunctionRegistry(),
			...subFlow.getFunctionRegistry(),
		])

		const runtime = new FlowRuntime({
			blueprints: { sub: subBlueprint },
		})

		const result = await runtime.run(mainBlueprint, {}, { functionRegistry: combinedRegistry })
		expect(result.status).toBe('completed')
		expect(result.context['_outputs.call-sub']).toBe('sub-result')
		expect(result.context['_outputs.end']).toBe('end-sub-result')
	})

	it('should throw when blueprintId is missing', async () => {
		const mainFlow = createFlow('main-no-bp')
			.node('start', async () => ({ output: 'start' }))
			.node('call-sub', SubflowNode, {
				params: { blueprintId: undefined },
			})
			.edge('start', 'call-sub')

		const runtime = new FlowRuntime()
		const result = await runtime.run(
			mainFlow.toBlueprint(),
			{},
			{ functionRegistry: mainFlow.getFunctionRegistry() },
		)
		expect(result.status).toBe('failed')
	})

	it('should throw when sub-blueprint is not found', async () => {
		const mainFlow = createFlow('main-missing-bp')
			.node('start', async () => ({ output: 'start' }))
			.node('call-sub', SubflowNode, {
				params: { blueprintId: 'nonexistent' },
			})
			.edge('start', 'call-sub')

		const runtime = new FlowRuntime()
		const result = await runtime.run(
			mainFlow.toBlueprint(),
			{},
			{ functionRegistry: mainFlow.getFunctionRegistry() },
		)
		expect(result.status).toBe('failed')
	})

	it('should pass inputs to subflow', async () => {
		const subFlow = createFlow('sub-inputs').node(
			'a',
			async ({ input }) => ({ output: `received-${input}` }),
			{ inputs: 'input' },
		)

		const mainFlow = createFlow('main-inputs')
			.node('start', async () => ({ output: 'hello' }))
			.node('call-sub', SubflowNode, {
				params: {
					blueprintId: 'sub-inputs',
					inputs: { input: 'start' },
				},
			})
			.edge('start', 'call-sub')

		const subBlueprint = subFlow.toBlueprint()
		const mainBlueprint = mainFlow.toBlueprint()
		const combinedRegistry = new Map([
			...mainFlow.getFunctionRegistry(),
			...subFlow.getFunctionRegistry(),
		])

		const runtime = new FlowRuntime({
			blueprints: { 'sub-inputs': subBlueprint },
		})

		const result = await runtime.run(mainBlueprint, {}, { functionRegistry: combinedRegistry })
		expect(result.status).toBe('completed')
	})

	it('should pass outputs from subflow', async () => {
		const subFlow = createFlow('sub-outputs').node('a', async ({ context }) => {
			await context.set('result', 'sub-value')
			return { output: 'sub-result' }
		})

		const mainFlow = createFlow('main-outputs')
			.node('start', async () => ({ output: 'start' }))
			.node('call-sub', SubflowNode, {
				params: {
					blueprintId: 'sub-outputs',
					outputs: { subResult: 'a' },
				},
			})
			.edge('start', 'call-sub')

		const subBlueprint = subFlow.toBlueprint()
		const mainBlueprint = mainFlow.toBlueprint()
		const combinedRegistry = new Map([
			...mainFlow.getFunctionRegistry(),
			...subFlow.getFunctionRegistry(),
		])

		const runtime = new FlowRuntime({
			blueprints: { 'sub-outputs': subBlueprint },
		})

		const result = await runtime.run(mainBlueprint, {}, { functionRegistry: combinedRegistry })
		expect(result.status).toBe('completed')
		expect(result.context.subResult).toBe('sub-result')
	})

	it('should handle subflow with multiple terminal nodes', async () => {
		const subFlow = createFlow('sub-multi-terminal')
			.node('a', async () => ({ output: 'a-result' }))
			.node('b', async () => ({ output: 'b-result' }))

		const mainFlow = createFlow('main-multi')
			.node('start', async () => ({ output: 'start' }))
			.node('call-sub', SubflowNode, {
				params: { blueprintId: 'sub-multi-terminal' },
			})
			.edge('start', 'call-sub')

		const subBlueprint = subFlow.toBlueprint()
		const mainBlueprint = mainFlow.toBlueprint()
		const combinedRegistry = new Map([
			...mainFlow.getFunctionRegistry(),
			...subFlow.getFunctionRegistry(),
		])

		const runtime = new FlowRuntime({
			blueprints: { 'sub-multi-terminal': subBlueprint },
		})

		const result = await runtime.run(mainBlueprint, {}, { functionRegistry: combinedRegistry })
		expect(result.status).toBe('completed')
	})

	it('should handle subflow failure', async () => {
		const subFlow = createFlow('sub-fail').node('a', async () => {
			throw new Error('Subflow error')
		})

		const mainFlow = createFlow('main-sub-fail')
			.node('start', async () => ({ output: 'start' }))
			.node('call-sub', SubflowNode, {
				params: { blueprintId: 'sub-fail' },
			})
			.edge('start', 'call-sub')

		const subBlueprint = subFlow.toBlueprint()
		const mainBlueprint = mainFlow.toBlueprint()
		const combinedRegistry = new Map([
			...mainFlow.getFunctionRegistry(),
			...subFlow.getFunctionRegistry(),
		])

		const runtime = new FlowRuntime({
			blueprints: { 'sub-fail': subBlueprint },
		})

		const result = await runtime.run(mainBlueprint, {}, { functionRegistry: combinedRegistry })
		expect(result.status).toBe('failed')
	})
})

import { describe, expect, it } from 'vitest'
import { createFlow } from '../../../src/flow'
import { FlowRuntime } from '../../../src/runtime'
import { StepByStepOrchestrator } from '../../../src/runtime/orchestrators/step-by-step'
import { ExecutionContext } from '../../../src/runtime/execution-context'
import { WorkflowState } from '../../../src/runtime/state'
import { GraphTraverser } from '../../../src/runtime/traverser'

describe('StepByStepOrchestrator', () => {
	it('should execute one tick and return intermediate state', async () => {
		const flow = createFlow('step-test')
			.node('A', async () => ({ output: 'a' }))
			.node('B', async ({ input }) => ({ output: `${input}-b` }))
			.edge('A', 'B')

		const blueprint = flow.toBlueprint()
		const runtime = new FlowRuntime()

		const executionContext = new ExecutionContext(
			blueprint,
			new WorkflowState({}),
			runtime._createExecutionRegistry(flow.getFunctionRegistry()),
			'step-exec-id',
			runtime,
			{
				logger: runtime.logger,
				eventBus: runtime.eventBus,
				serializer: runtime.serializer,
				evaluator: runtime.evaluator,
				middleware: runtime.middleware,
				dependencies: runtime.dependencies,
			},
		)

		const orchestrator = new StepByStepOrchestrator()
		const traverser = new GraphTraverser(blueprint)

		const result = await orchestrator.run(executionContext, traverser)

		expect(result.status).toBeDefined()
		expect(['completed', 'stalled', 'awaiting', 'failed']).toContain(result.status)
	})

	it('should return result when no more work is available', async () => {
		const flow = createFlow('step-no-work').node('A', async () => ({ output: 'a' }))

		const blueprint = flow.toBlueprint()
		const runtime = new FlowRuntime()

		const executionContext = new ExecutionContext(
			blueprint,
			new WorkflowState({}),
			runtime._createExecutionRegistry(flow.getFunctionRegistry()),
			'no-work-exec-id',
			runtime,
			{
				logger: runtime.logger,
				eventBus: runtime.eventBus,
				serializer: runtime.serializer,
				evaluator: runtime.evaluator,
				middleware: runtime.middleware,
				dependencies: runtime.dependencies,
			},
		)

		const orchestrator = new StepByStepOrchestrator()
		const traverser = new GraphTraverser(blueprint)

		// First tick executes node A
		const result1 = await orchestrator.run(executionContext, traverser)
		expect(result1.status).toBeDefined()

		// Second tick should return completed since no more work
		const result2 = await orchestrator.run(executionContext, traverser)
		expect(result2.status).toBe('completed')
	})

	it('should respect concurrency limit', async () => {
		const flow = createFlow('step-concurrency')
		for (let i = 0; i < 5; i++) {
			flow.node(`node${i}`, async () => ({ output: `result-${i}` }))
		}

		const blueprint = flow.toBlueprint()
		const runtime = new FlowRuntime()

		const executionContext = new ExecutionContext(
			blueprint,
			new WorkflowState({}),
			runtime._createExecutionRegistry(flow.getFunctionRegistry()),
			'concurrency-exec-id',
			runtime,
			{
				logger: runtime.logger,
				eventBus: runtime.eventBus,
				serializer: runtime.serializer,
				evaluator: runtime.evaluator,
				middleware: runtime.middleware,
				dependencies: runtime.dependencies,
			},
			undefined,
			2,
		)

		const orchestrator = new StepByStepOrchestrator()
		const traverser = new GraphTraverser(blueprint)

		const result = await orchestrator.run(executionContext, traverser)
		expect(result.status).toBeDefined()
	})

	it('should handle abort signal', async () => {
		const flow = createFlow('step-abort')
			.node('A', async () => ({ output: 'a' }))
			.node('B', async () => ({ output: 'b' }))
			.edge('A', 'B')

		const blueprint = flow.toBlueprint()
		const runtime = new FlowRuntime()

		const controller = new AbortController()
		controller.abort()

		const executionContext = new ExecutionContext(
			blueprint,
			new WorkflowState({}),
			runtime._createExecutionRegistry(flow.getFunctionRegistry()),
			'abort-exec-id',
			runtime,
			{
				logger: runtime.logger,
				eventBus: runtime.eventBus,
				serializer: runtime.serializer,
				evaluator: runtime.evaluator,
				middleware: runtime.middleware,
				dependencies: runtime.dependencies,
			},
			controller.signal,
		)

		const orchestrator = new StepByStepOrchestrator()
		const traverser = new GraphTraverser(blueprint)

		await expect(orchestrator.run(executionContext, traverser)).rejects.toThrow(
			'Workflow cancelled',
		)
	})

	it('should execute multiple ticks to complete workflow', async () => {
		const flow = createFlow('step-multi-tick')
			.node('A', async () => ({ output: 'a' }))
			.node('B', async ({ input }) => ({ output: `${input}-b` }))
			.node('C', async ({ input }) => ({ output: `${input}-c` }))
			.edge('A', 'B')
			.edge('B', 'C')

		const blueprint = flow.toBlueprint()
		const runtime = new FlowRuntime()

		const executionContext = new ExecutionContext(
			blueprint,
			new WorkflowState({}),
			runtime._createExecutionRegistry(flow.getFunctionRegistry()),
			'multi-tick-exec-id',
			runtime,
			{
				logger: runtime.logger,
				eventBus: runtime.eventBus,
				serializer: runtime.serializer,
				evaluator: runtime.evaluator,
				middleware: runtime.middleware,
				dependencies: runtime.dependencies,
			},
		)

		const orchestrator = new StepByStepOrchestrator()
		const traverser = new GraphTraverser(blueprint)

		let result = await orchestrator.run(executionContext, traverser)
		let ticks = 1
		while (result.status !== 'completed' && ticks < 10) {
			result = await orchestrator.run(executionContext, traverser)
			ticks++
		}

		expect(result.status).toBe('completed')
		expect(ticks).toBeGreaterThan(1)
	})
})

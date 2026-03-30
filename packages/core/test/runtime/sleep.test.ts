import { describe, expect, it } from 'vitest'
import { createFlow, FlowRuntime } from '../../src'

describe('SleepNode output passthrough', () => {
	it('should pass through the output from the previous node', async () => {
		const flow = createFlow('sleep-passthrough-test')
			.node('start', async () => {
				return { output: 42 }
			})
			.sleep('pause', { duration: 10 })
			.node('double', async ({ input }) => {
				return { output: input * 2 }
			})
			.edge('start', 'pause')
			.edge('pause', 'double')

		const runtime = new FlowRuntime({})

		const result1 = await flow.run(runtime)
		expect(result1.status).toBe('awaiting')

		await new Promise((resolve) => setTimeout(resolve, 20))

		const result2 = await flow.resume(runtime, result1.serializedContext, {}, 'pause')
		expect(result2.status).toBe('completed')
		expect(result2.context['_outputs.double']).toBe(84)
	})

	it('should auto-resume via WorkflowScheduler', async () => {
		const flow = createFlow('sleep-scheduler-test')
			.node('start', async () => {
				return { output: 42 }
			})
			.sleep('pause', { duration: 1 })
			.node('double', async ({ input }) => {
				return { output: input * 2 }
			})
			.edge('start', 'pause')
			.edge('pause', 'double')

		const blueprint = flow.toBlueprint()

		// Register blueprint so the scheduler can find it when resuming
		const runtime = new FlowRuntime({
			blueprints: { [blueprint.id]: blueprint },
		})

		// Start scheduler with fast check interval for testing
		runtime.startScheduler(50)

		const result = await flow.run(runtime)
		expect(result.status).toBe('awaiting')

		// The scheduler will detect the expired timer and call resume automatically
		await new Promise((resolve) => setTimeout(resolve, 200))

		// Workflow should have been resumed and removed from active tracking
		expect(runtime.scheduler.getActiveWorkflows().length).toBe(0)

		// Retrieve the result from the scheduler's auto-resume
		const executionId = result.context._executionId as string
		const resumed = runtime.scheduler.getResumeResult(executionId)
		expect(resumed).toBeDefined()
		if (!resumed) return
		expect(resumed.status).toBe('completed')
		expect(resumed.context['_outputs.double']).toBe(84)

		runtime.stopScheduler()
	})
})

import { describe, expect, it } from 'vitest'
import { createFlow, FlowRuntime } from '../../src'

describe('SleepNode duration formats', () => {
	it('should accept minutes duration string', async () => {
		const flow = createFlow('sleep-minutes')
			.node('start', async () => ({ output: 'start' }))
			.sleep('pause', { duration: '1m' })

		const runtime = new FlowRuntime()
		const result = await flow.run(runtime)
		expect(result.status).toBe('awaiting')
	})

	it('should accept hours duration string', async () => {
		const flow = createFlow('sleep-hours')
			.node('start', async () => ({ output: 'start' }))
			.sleep('pause', { duration: '1h' })

		const runtime = new FlowRuntime()
		const result = await flow.run(runtime)
		expect(result.status).toBe('awaiting')
	})

	it('should accept days duration string', async () => {
		const flow = createFlow('sleep-days')
			.node('start', async () => ({ output: 'start' }))
			.sleep('pause', { duration: '1d' })

		const runtime = new FlowRuntime()
		const result = await flow.run(runtime)
		expect(result.status).toBe('awaiting')
	})

	it('should reject invalid duration string', async () => {
		const flow = createFlow('sleep-invalid')
			.node('start', async () => ({ output: 'start' }))
			.sleep('pause', { duration: 'invalid' })

		const runtime = new FlowRuntime()
		const result = await flow.run(runtime)
		expect(result.status).toBe('failed')
	})

	it('should reject invalid duration type', async () => {
		const flow = createFlow('sleep-invalid-type')
			.node('start', async () => ({ output: 'start' }))
			.sleep('pause', { duration: null as any })

		const runtime = new FlowRuntime()
		const result = await flow.run(runtime)
		expect(result.status).toBe('failed')
	})

	it('should accept zero duration', async () => {
		const flow = createFlow('sleep-zero')
			.node('start', async () => ({ output: 'start' }))
			.sleep('pause', { duration: 0 })

		const runtime = new FlowRuntime()
		const result = await flow.run(runtime)
		expect(result.status).toBe('awaiting')
	})
})

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

		const runtime = new FlowRuntime()

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

		const runtime = new FlowRuntime({
			blueprints: { [blueprint.id]: blueprint },
		})

		runtime.startScheduler(50)

		const result = await flow.run(runtime)
		expect(result.status).toBe('awaiting')

		await new Promise((resolve) => setTimeout(resolve, 200))

		expect(runtime.scheduler.getActiveWorkflows().length).toBe(0)

		const executionId = result.context._executionId as string
		const resumed = runtime.scheduler.getResumeResult(executionId)
		expect(resumed).toBeDefined()
		if (!resumed) return
		expect(resumed.status).toBe('completed')
		expect(resumed.context['_outputs.double']).toBe(84)

		runtime.stopScheduler()
	})
})

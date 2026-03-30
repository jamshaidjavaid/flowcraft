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
		const blueprint = flow.toBlueprint()

		const result1 = await runtime.run(blueprint, {}, { functionRegistry: flow.getFunctionRegistry() })
		expect(result1.status).toBe('awaiting')

		await new Promise((resolve) => setTimeout(resolve, 20))

		const result2 = await runtime.resume(blueprint, result1.serializedContext, {}, 'pause', {
			functionRegistry: flow.getFunctionRegistry(),
		})
		expect(result2.status).toBe('completed')
		expect(result2.context['_outputs.double']).toBe(84)
	})
})

import { describe, expect, it, vi } from 'vitest'
import { InMemoryEventLogger } from '../../src/testing/event-logger'
import type { FlowcraftEvent } from '../../src/types'
import { FlowcraftError } from '../../src/errors'

describe('InMemoryEventLogger', () => {
	it('should capture events via emit', async () => {
		const logger = new InMemoryEventLogger()
		const event: FlowcraftEvent = {
			type: 'workflow:start',
			payload: { blueprintId: 'test', executionId: 'exec-1' },
		}

		await logger.emit(event)
		expect(logger.events).toHaveLength(1)
		expect(logger.events[0]).toBe(event)
	})

	it('should clear all captured events', () => {
		const logger = new InMemoryEventLogger()
		logger.events.push({
			type: 'workflow:start',
			payload: { blueprintId: 'test', executionId: 'exec-1' },
		})
		logger.events.push({
			type: 'node:start',
			payload: { nodeId: 'A', executionId: 'exec-1', input: {}, blueprintId: 'test' },
		})

		logger.clear()
		expect(logger.events).toHaveLength(0)
	})

	it('should find the first event of a specific type', async () => {
		const logger = new InMemoryEventLogger()

		await logger.emit({
			type: 'workflow:start',
			payload: { blueprintId: 'test', executionId: 'exec-1' },
		})
		await logger.emit({
			type: 'node:start',
			payload: { nodeId: 'A', executionId: 'exec-1', input: {}, blueprintId: 'test' },
		})
		await logger.emit({
			type: 'node:finish',
			payload: {
				nodeId: 'A',
				result: { output: 1 },
				executionId: 'exec-1',
				blueprintId: 'test',
			},
		})

		const found = logger.find('node:start')
		expect(found).toBeDefined()
		expect(found?.type).toBe('node:start')
	})

	it('should return undefined when find has no match', async () => {
		const logger = new InMemoryEventLogger()

		await logger.emit({
			type: 'workflow:start',
			payload: { blueprintId: 'test', executionId: 'exec-1' },
		})

		const found = logger.find('node:error')
		expect(found).toBeUndefined()
	})

	it('should filter events by type', async () => {
		const logger = new InMemoryEventLogger()

		await logger.emit({
			type: 'workflow:start',
			payload: { blueprintId: 'test', executionId: 'exec-1' },
		})
		await logger.emit({
			type: 'node:start',
			payload: { nodeId: 'A', executionId: 'exec-1', input: {}, blueprintId: 'test' },
		})
		await logger.emit({
			type: 'node:start',
			payload: { nodeId: 'B', executionId: 'exec-1', input: {}, blueprintId: 'test' },
		})
		await logger.emit({
			type: 'node:finish',
			payload: {
				nodeId: 'A',
				result: { output: 1 },
				executionId: 'exec-1',
				blueprintId: 'test',
			},
		})

		const startEvents = logger.filter('node:start')
		expect(startEvents).toHaveLength(2)
		expect(startEvents[0].payload.nodeId).toBe('A')
		expect(startEvents[1].payload.nodeId).toBe('B')
	})

	it('should return empty array when filter has no match', async () => {
		const logger = new InMemoryEventLogger()

		await logger.emit({
			type: 'workflow:start',
			payload: { blueprintId: 'test', executionId: 'exec-1' },
		})

		const errors = logger.filter('node:error')
		expect(errors).toEqual([])
	})

	it('should print log with no events', () => {
		const logger = new InMemoryEventLogger()
		const spy = vi.spyOn(console, 'log').mockImplementation(() => {})

		logger.printLog('Empty Trace')

		expect(spy).toHaveBeenCalledWith('\n--- Empty Trace ---')
		expect(spy).toHaveBeenCalledWith('No events were captured.')
		spy.mockRestore()
	})

	it('should print log with events', async () => {
		const logger = new InMemoryEventLogger()
		const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

		await logger.emit({
			type: 'workflow:start',
			payload: { blueprintId: 'test', executionId: 'e1' },
		})
		await logger.emit({
			type: 'node:start',
			payload: { nodeId: 'A', input: { x: 1 }, executionId: 'e1', blueprintId: 'test' },
		})
		await logger.emit({
			type: 'node:finish',
			payload: { nodeId: 'A', result: { output: 1 }, executionId: 'e1', blueprintId: 'test' },
		})
		await logger.emit({
			type: 'workflow:finish',
			payload: { blueprintId: 'test', executionId: 'e1', status: 'completed', errors: [] },
		})

		logger.printLog('Test Trace')

		expect(spy).toHaveBeenCalledWith('\n--- Test Trace ---')
		expect(spy).toHaveBeenCalledWith('\n[1] workflow:start')
		expect(spy).toHaveBeenCalledWith('\n[2] node:start')
		expect(spy).toHaveBeenCalledWith('\n[3] node:finish')
		expect(spy).toHaveBeenCalledWith('\n[4] workflow:finish')

		spy.mockRestore()
		errorSpy.mockRestore()
	})

	it('should print edge:evaluate events', async () => {
		const logger = new InMemoryEventLogger()
		const spy = vi.spyOn(console, 'log').mockImplementation(() => {})

		await logger.emit({
			type: 'edge:evaluate',
			payload: { source: 'A', target: 'B', condition: 'x > 0', result: true },
		})

		logger.printLog()

		expect(spy).toHaveBeenCalledWith('  - Edge: "A" -> "B"')
		expect(spy).toHaveBeenCalledWith('  - Condition: x > 0 | Result: true')
		spy.mockRestore()
	})

	it('should print context:change set events', async () => {
		const logger = new InMemoryEventLogger()
		const spy = vi.spyOn(console, 'log').mockImplementation(() => {})

		await logger.emit({
			type: 'context:change',
			payload: {
				op: 'set',
				key: 'myKey',
				value: 'myValue',
				sourceNode: 'A',
				executionId: 'exec-1',
			},
		})

		logger.printLog()

		expect(spy).toHaveBeenCalledWith(
			'  - Node "A" wrote to context -> Key: "myKey" | Value: "myValue"',
		)
		spy.mockRestore()
	})

	it('should print context:change delete events', async () => {
		const logger = new InMemoryEventLogger()
		const spy = vi.spyOn(console, 'log').mockImplementation(() => {})

		await logger.emit({
			type: 'context:change',
			payload: { op: 'delete', key: 'myKey', sourceNode: 'A', executionId: 'exec-1' },
		})

		logger.printLog()

		expect(spy).toHaveBeenCalledWith('  - Node "A" deleted from context -> Key: "myKey"')
		spy.mockRestore()
	})

	it('should print node:error events', async () => {
		const logger = new InMemoryEventLogger()
		const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

		await logger.emit({
			type: 'node:error',
			payload: {
				nodeId: 'A',
				error: new FlowcraftError('Test error'),
				executionId: 'exec-1',
				blueprintId: 'test',
			},
		})

		logger.printLog()

		expect(spy).toHaveBeenCalledWith('  - Node: "A"')
		expect(errorSpy).toHaveBeenCalledWith('  - Error:', expect.any(Error))
		spy.mockRestore()
		errorSpy.mockRestore()
	})

	it('should print default payload for unknown event types', async () => {
		const logger = new InMemoryEventLogger()
		const spy = vi.spyOn(console, 'log').mockImplementation(() => {})

		await logger.emit({
			type: 'custom:event',
			payload: { custom: 'data' },
		} as unknown as FlowcraftEvent)

		logger.printLog()

		expect(spy).toHaveBeenCalledWith(expect.stringContaining('custom:event'))
		spy.mockRestore()
	})

	it('should handle multiple captures of the same event', async () => {
		const logger = new InMemoryEventLogger()
		const event: FlowcraftEvent = {
			type: 'node:start',
			payload: { nodeId: 'A', executionId: 'exec-1', input: {}, blueprintId: 'test' },
		}

		await logger.emit(event)
		await logger.emit(event)
		await logger.emit(event)

		expect(logger.events).toHaveLength(3)
	})
})

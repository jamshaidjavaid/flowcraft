import { describe, expect, it } from 'vitest'
import {
	InMemoryEventStore,
	PersistentEventBusAdapter,
} from '../../src/adapters/persistent-event-bus'
import type { FlowcraftEvent } from '../../src/types'

describe('InMemoryEventStore', () => {
	it('should store and retrieve events for a single execution', async () => {
		const store = new InMemoryEventStore()
		const event: FlowcraftEvent = {
			type: 'workflow:start',
			payload: { blueprintId: 'test', executionId: 'exec-1' },
		}

		await store.store(event, 'exec-1')
		const retrieved = await store.retrieve('exec-1')

		expect(retrieved).toHaveLength(1)
		expect(retrieved[0]).toBe(event)
	})

	it('should return empty array for unknown execution', async () => {
		const store = new InMemoryEventStore()
		const retrieved = await store.retrieve('unknown')
		expect(retrieved).toEqual([])
	})

	it('should store multiple events in order', async () => {
		const store = new InMemoryEventStore()
		const events: FlowcraftEvent[] = [
			{ type: 'workflow:start', payload: { blueprintId: 'test', executionId: 'exec-1' } },
			{
				type: 'node:start',
				payload: { nodeId: 'A', executionId: 'exec-1', input: {}, blueprintId: 'test' },
			},
			{
				type: 'node:finish',
				payload: {
					nodeId: 'A',
					result: { output: 1 },
					executionId: 'exec-1',
					blueprintId: 'test',
				},
			},
		]

		for (const event of events) {
			await store.store(event, 'exec-1')
		}

		const retrieved = await store.retrieve('exec-1')
		expect(retrieved).toHaveLength(3)
		expect(retrieved[0].type).toBe('workflow:start')
		expect(retrieved[1].type).toBe('node:start')
		expect(retrieved[2].type).toBe('node:finish')
	})

	it('should isolate events by execution ID', async () => {
		const store = new InMemoryEventStore()
		await store.store(
			{ type: 'workflow:start', payload: { blueprintId: 'test', executionId: 'exec-1' } },
			'exec-1',
		)
		await store.store(
			{ type: 'workflow:start', payload: { blueprintId: 'test', executionId: 'exec-2' } },
			'exec-2',
		)

		const events1 = await store.retrieve('exec-1')
		const events2 = await store.retrieve('exec-2')

		expect(events1).toHaveLength(1)
		expect(events2).toHaveLength(1)
	})

	it('should retrieve events for multiple executions', async () => {
		const store = new InMemoryEventStore()
		await store.store(
			{ type: 'workflow:start', payload: { blueprintId: 'test', executionId: 'exec-1' } },
			'exec-1',
		)
		await store.store(
			{ type: 'workflow:start', payload: { blueprintId: 'test', executionId: 'exec-2' } },
			'exec-2',
		)

		const result = await store.retrieveMultiple(['exec-1', 'exec-2', 'exec-3'])

		expect(result.size).toBe(3)
		expect(result.get('exec-1')).toHaveLength(1)
		expect(result.get('exec-2')).toHaveLength(1)
		expect(result.get('exec-3')).toEqual([])
	})

	it('should clear all stored events', async () => {
		const store = new InMemoryEventStore()
		await store.store(
			{ type: 'workflow:start', payload: { blueprintId: 'test', executionId: 'exec-1' } },
			'exec-1',
		)

		store.clear()
		const retrieved = await store.retrieve('exec-1')
		expect(retrieved).toEqual([])
	})
})

describe('PersistentEventBusAdapter', () => {
	it('should store events via the underlying store', async () => {
		const store = new InMemoryEventStore()
		const adapter = new PersistentEventBusAdapter(store)

		const event: FlowcraftEvent = {
			type: 'workflow:start',
			payload: { blueprintId: 'test', executionId: 'exec-1' },
		}

		await adapter.emit(event)
		const retrieved = await store.retrieve('exec-1')

		expect(retrieved).toHaveLength(1)
		expect(retrieved[0]).toBe(event)
	})

	it('should extract executionId from event payload', async () => {
		const store = new InMemoryEventStore()
		const adapter = new PersistentEventBusAdapter(store)

		await adapter.emit({
			type: 'node:finish',
			payload: {
				nodeId: 'A',
				result: { output: 1 },
				executionId: 'my-exec',
				blueprintId: 'test',
			},
		})

		const events = await store.retrieve('my-exec')
		expect(events).toHaveLength(1)
	})

	it('should default to unknown executionId when not present', async () => {
		const store = new InMemoryEventStore()
		const adapter = new PersistentEventBusAdapter(store)

		await adapter.emit({
			type: 'workflow:start',
			payload: { blueprintId: 'test', executionId: 'unknown' },
		})

		const events = await store.retrieve('unknown')
		expect(events).toHaveLength(1)
	})

	it('should store multiple events in sequence', async () => {
		const store = new InMemoryEventStore()
		const adapter = new PersistentEventBusAdapter(store)

		await adapter.emit({
			type: 'workflow:start',
			payload: { blueprintId: 'test', executionId: 'e1' },
		})
		await adapter.emit({
			type: 'node:start',
			payload: { nodeId: 'A', executionId: 'e1', input: {}, blueprintId: 'test' },
		})
		await adapter.emit({
			type: 'node:finish',
			payload: { nodeId: 'A', result: { output: 1 }, executionId: 'e1', blueprintId: 'test' },
		})
		await adapter.emit({
			type: 'workflow:finish',
			payload: { blueprintId: 'test', executionId: 'e1', status: 'completed', errors: [] },
		})

		const events = await store.retrieve('e1')
		expect(events).toHaveLength(4)
		expect(events[0].type).toBe('workflow:start')
		expect(events[3].type).toBe('workflow:finish')
	})
})

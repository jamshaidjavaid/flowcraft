import type { StartedRedisContainer } from '@testcontainers/redis'
import { RedisContainer } from '@testcontainers/redis'
import type { JobPayload, PatchOperation } from 'flowcraft'
import Redis from 'ioredis'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BullMQAdapter } from './adapter'
import { RedisContext } from './context'
import { RedisCoordinationStore } from './store'

const QUEUE_NAME = 'test-bullmq-queue'

describe('BullMQAdapter - Testcontainers Integration', () => {
	let redisContainer: StartedRedisContainer
	let redis: Redis

	beforeAll(async () => {
		redisContainer = await new RedisContainer('redis:8.2.2').start()
		redis = new Redis(redisContainer.getConnectionUrl())
	}, 30000)

	afterAll(async () => {
		await redis.quit()
		await redisContainer.stop()
	})

	it('should successfully enqueue a job into the BullMQ Redis structures', async () => {
		const coordinationStore = new RedisCoordinationStore(redis)
		const adapter = new BullMQAdapter({
			connection: redis,
			queueName: QUEUE_NAME,
			coordinationStore,
			runtimeOptions: {},
		})

		const job: JobPayload = {
			runId: 'run-bull-1',
			blueprintId: 'bp-bull',
			nodeId: 'node-bull',
		}

		await (adapter as any).enqueueJob(job)
		const waitingJobs = await (adapter as any).queue.getWaiting()
		expect(waitingJobs.length).toBe(1)
		expect(waitingJobs[0].data).toEqual(job)
	})

	it('should support delta-based persistence with patch operations', async () => {
		const runId = 'test-delta-run'
		const context = new RedisContext(redis, runId)

		// Set initial data
		await context.set('user', { id: 1, name: 'Alice' })
		await context.set('count', 5)
		await context.set('items', ['a', 'b', 'c'])

		// Verify initial state
		expect(await context.get('user')).toEqual({ id: 1, name: 'Alice' })
		expect(await context.get('count')).toBe(5)
		expect(await context.get('items')).toEqual(['a', 'b', 'c'])

		// Apply patch operations
		const operations: PatchOperation[] = [
			{ op: 'set', key: 'user', value: { id: 1, name: 'Alice Updated' } },
			{ op: 'set', key: 'count', value: 10 },
			{ op: 'delete', key: 'items' },
			{ op: 'set', key: 'status', value: 'completed' },
		]

		await context.patch(operations)

		// Verify patched state
		expect(await context.get('user')).toEqual({ id: 1, name: 'Alice Updated' })
		expect(await context.get('count')).toBe(10)
		expect(await context.get('items')).toBeUndefined()
		expect(await context.get('status')).toBe('completed')

		// Verify full state
		const fullState = await context.toJSON()
		expect(fullState).toEqual({
			user: { id: 1, name: 'Alice Updated' },
			count: 10,
			status: 'completed',
		})
	})
})

describe('BullMQAdapter - State Key TTL', () => {
	let redisContainer: StartedRedisContainer
	let redis: Redis

	beforeAll(async () => {
		redisContainer = await new RedisContainer('redis:8.2.2').start()
		redis = new Redis(redisContainer.getConnectionUrl())
	}, 30000)

	afterAll(async () => {
		await redis.quit()
		await redisContainer.stop()
	})

	it('should apply stateTtlSeconds TTL to both state and status keys after a run finishes', async () => {
		const runId = 'ttl-run'
		const coordinationStore = new RedisCoordinationStore(redis)
		const adapter = new BullMQAdapter({
			connection: redis,
			queueName: 'ttl-test-queue',
			coordinationStore,
			runtimeOptions: {},
			stateTtlSeconds: 300,
		})

		await redis.hset(`workflow:state:${runId}`, 'someKey', 'someValue')
		await (adapter as any).publishFinalResult(runId, { status: 'completed' })

		const statusTtl = await redis.ttl(`workflow:status:${runId}`)
		const stateTtl = await redis.ttl(`workflow:state:${runId}`)

		expect(statusTtl).toBeGreaterThan(300 - 5)
		expect(statusTtl).toBeLessThanOrEqual(300)
		expect(stateTtl).toBeGreaterThan(300 - 5)
		expect(stateTtl).toBeLessThanOrEqual(300)

		await adapter.close()
	})

	it('should not set a TTL when stateTtlSeconds is 0 (persist indefinitely)', async () => {
		const runId = 'ttl-disabled-run'
		const coordinationStore = new RedisCoordinationStore(redis)
		const adapter = new BullMQAdapter({
			connection: redis,
			queueName: 'ttl-test-queue-2',
			coordinationStore,
			runtimeOptions: {},
			stateTtlSeconds: 0,
		})

		await redis.hset(`workflow:state:${runId}`, 'someKey', 'someValue')
		await (adapter as any).publishFinalResult(runId, { status: 'completed' })

		// TTL of -1 means the key exists with no expiry
		expect(await redis.ttl(`workflow:status:${runId}`)).toBe(-1)
		expect(await redis.ttl(`workflow:state:${runId}`)).toBe(-1)

		await adapter.close()
	})
})

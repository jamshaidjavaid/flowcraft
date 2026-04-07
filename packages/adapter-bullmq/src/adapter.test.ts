import type { StartedRedisContainer } from '@testcontainers/redis'
import { RedisContainer } from '@testcontainers/redis'
import type { JobPayload, PatchOperation } from 'flowcraft'
import Redis from 'ioredis'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
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
		expect(waitingJobs[0].opts.jobId).toBe('run-bull-1_node-bull')
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

describe('BullMQAdapter - Queue-Native Retries', () => {
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

	it('should append attempts and exponential backoff parameters to BullMQ opts when retryMode is queue', async () => {
		const coordinationStore = new RedisCoordinationStore(redis)
		const adapter = new BullMQAdapter({
			connection: redis,
			queueName: 'retry-test-queue-1',
			coordinationStore,
			runtimeOptions: {
				blueprints: {
					'bp-test': {
						id: 'bp-test',
						nodes: [
							{
								id: 'node-1',
								uses: 'SomeFunc',
								config: {
									maxRetries: 5,
									retryDelay: 3000,
								},
							},
						],
						edges: [],
					} as any,
				},
			},
			retryMode: 'queue',
		})

		const job: JobPayload = {
			runId: 'run-1',
			blueprintId: 'bp-test',
			nodeId: 'node-1',
		}

		await (adapter as any).enqueueJob(job)
		const waitingJobs = await (adapter as any).queue.getWaiting()
		
		expect(waitingJobs.length).toBe(1)
		const queuedJob = waitingJobs[0]
		expect(queuedJob.opts.attempts).toBe(5)
		expect(queuedJob.opts.backoff).toEqual({
			type: 'exponential',
			delay: 3000,
		})
		expect(queuedJob.opts.jobId).toBe('run-1_node-1')

		await adapter.close()
	})

	it('should not append queue retry options when retryMode is in-process (default)', async () => {
		const coordinationStore = new RedisCoordinationStore(redis)
		const adapter = new BullMQAdapter({
			connection: redis,
			queueName: 'retry-test-queue-2',
			coordinationStore,
			runtimeOptions: {
				blueprints: {
					'bp-test': {
						id: 'bp-test',
						nodes: [
							{
								id: 'node-1',
								uses: 'SomeFunc',
								config: {
									maxRetries: 5,
									retryDelay: 3000,
								},
							},
						],
						edges: [],
					} as any,
				},
			},
		})

		const job: JobPayload = {
			runId: 'run-2',
			blueprintId: 'bp-test',
			nodeId: 'node-1',
		}

		await (adapter as any).enqueueJob(job)
		const waitingJobs = await (adapter as any).queue.getWaiting()
		
		const queuedJob = waitingJobs[0]
		expect(queuedJob.opts.attempts).not.toBe(5)
		expect(queuedJob.opts.backoff).toBeUndefined()
		expect(queuedJob.opts.jobId).toBe('run-2_node-1')

		await adapter.close()
	})

it('should NOT call publishFinalResult when queue retries are still pending', async () => {
		const coordinationStore = new RedisCoordinationStore(redis)
		const adapter = new BullMQAdapter({
			connection: redis,
			queueName: 'retry-test-queue-3',
			coordinationStore,
			runtimeOptions: {
				blueprints: {
					'bp-test': {
						id: 'bp-test',
						nodes: [
							{
								id: 'node-fail',
								uses: 'FailingNode',
								config: { maxRetries: 3 },
							},
						],
						edges: [],
					} as any,
				},
				registry: {
					FailingNode: async () => {
						throw new Error('Simulated intermediate failure')
					},
				},
			},
			retryMode: 'queue',
		})

		const publishSpy = vi.spyOn(adapter as any, 'publishFinalResult').mockResolvedValue(undefined)
		const poisonPillSpy = vi.spyOn(adapter as any, 'writePoisonPillForSuccessors').mockResolvedValue(undefined)

		const runId = 'run-retry-1'
		const nodeId = 'node-fail'

		await redis.hset(`workflow:state:${runId}`, 'blueprintVersion', JSON.stringify(null))

		const job: any = {
			runId,
			blueprintId: 'bp-test',
			nodeId,
			isLastAttempt: false, // Simulate attempt 1/3
			attempt: 1,
		}

		await expect((adapter as any).handleJob(job)).resolves.toBeUndefined()
		expect(publishSpy).not.toHaveBeenCalled()
		expect(poisonPillSpy).not.toHaveBeenCalled()

		await adapter.close()
	})

	it('should skip execution entirely if idempotency outputs map proves job completed fully', async () => {
		const coordinationStore = new RedisCoordinationStore(redis)
		const adapter = new BullMQAdapter({
			connection: redis,
			queueName: 'retry-test-queue-4',
			coordinationStore,
			runtimeOptions: {
				blueprints: {
					'bp-test': {
						id: 'bp-test',
						nodes: [{ id: 'node-success', uses: 'SuccessNode' }],
						edges: [],
						metadata: { version: '1.0' },
					} as any,
				},
				registry: {
					SuccessNode: async () => {
						throw new Error('This should never execute because it is skipped!')
					},
				},
			},
		})

		const runId = 'run-idempotency-mock'
		const nodeId = 'node-success'

		// Artificially stub the output variables meaning this executed once before
		await redis.hset(`workflow:state:${runId}`, `_outputs.${nodeId}`, JSON.stringify({ ok: true }))
		await redis.hset(`workflow:state:${runId}`, 'blueprintId', JSON.stringify('bp-test'))
		await redis.hset(`workflow:state:${runId}`, 'blueprintVersion', JSON.stringify('1.0'))

		const executeNodeSpy = vi.spyOn((adapter as any).runtime, 'executeNode')
		vi.spyOn(adapter as any, 'enqueueJob').mockResolvedValue(undefined)
		const publishSpy = vi.spyOn(adapter as any, 'publishFinalResult').mockResolvedValue(undefined)

		const job: any = {
			runId,
			blueprintId: 'bp-test',
			nodeId,
		}

		// Executes flawlessly and resolves without triggering node logic execution
		await expect((adapter as any).handleJob(job)).resolves.toBeUndefined()
		expect(executeNodeSpy).not.toHaveBeenCalled()
		expect(publishSpy).toHaveBeenCalledWith(runId, expect.objectContaining({ status: 'completed' }))

		await adapter.close()
	})
})

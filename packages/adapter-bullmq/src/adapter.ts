import type { ConnectionOptions, Job } from 'bullmq'
import { Queue, Worker } from 'bullmq'
import type { AdapterOptions, JobPayload } from 'flowcraft'
import { BaseDistributedAdapter } from 'flowcraft'
import Redis, { type RedisOptions } from 'ioredis'
import { RedisContext } from './context'

const STATUS_KEY_PREFIX = 'workflow:status:'
const STATE_KEY_PREFIX = 'workflow:state:'

/** Default TTL for workflow state and status keys in Redis (24 hours). */
const DEFAULT_STATE_TTL_SECONDS = 86400

export interface BullMQAdapterOptions extends AdapterOptions {
	connection: RedisOptions | Redis
	queueName?: string
	/**
	 * How long (in seconds) workflow state and status keys are retained in Redis
	 * after a run completes or fails.
	 *
	 * Defaults to `86400` (24 hours). Set to `0` to disable TTL entirely
	 */
	stateTtlSeconds?: number
}

export class BullMQAdapter extends BaseDistributedAdapter {
	private readonly connection: RedisOptions | Redis
	private readonly redisClient: Redis
	private readonly queue: Queue
	private readonly queueName: string
	private readonly stateTtlSeconds: number
	private worker?: Worker

	constructor(options: BullMQAdapterOptions) {
		super(options)
		this.connection = options.connection
		this.redisClient =
			options.connection instanceof Redis
				? options.connection
				: new Redis(options.connection as RedisOptions)
		this.queueName = options.queueName || 'flowcraft-queue'
		this.stateTtlSeconds =
			options.stateTtlSeconds !== undefined
				? options.stateTtlSeconds
				: DEFAULT_STATE_TTL_SECONDS
		this.queue = new Queue(this.queueName, {
			connection: this.redisClient as ConnectionOptions,
		})
		this.logger.info(`[BullMQAdapter] Connected to queue '${this.queueName}'.`)
	}

	protected createContext(runId: string) {
		return new RedisContext(this.redisClient, runId)
	}

	protected processJobs(handler: (job: JobPayload) => Promise<void>): void {
		this.worker = new Worker(
			this.queueName,
			async (job: Job) => {
				this.logger.info(
					`[BullMQAdapter] ==> Picked up job ID: ${job.id}, Name: ${job.name}`,
				)
				await handler(job.data as JobPayload)
			},
			{ connection: this.redisClient as ConnectionOptions, concurrency: 5 },
		)

		this.logger.info(`[BullMQAdapter] Worker listening for jobs on queue: "${this.queueName}".`)
	}

	protected async enqueueJob(job: JobPayload): Promise<void> {
		await this.queue.add('executeNode', job)
	}

	protected async publishFinalResult(runId: string, result: any): Promise<void> {
		const statusKey = `${STATUS_KEY_PREFIX}${runId}`
		const stateKey = `${STATE_KEY_PREFIX}${runId}`

		if (this.stateTtlSeconds > 0) {
			await this.redisClient.set(
				statusKey,
				JSON.stringify(result),
				'EX',
				this.stateTtlSeconds,
			)
			await this.redisClient.expire(stateKey, this.stateTtlSeconds)
		} else {
			// stateTtlSeconds === 0: persist indefinitely
			await this.redisClient.set(statusKey, JSON.stringify(result))
		}
	}

	public async registerWebhookEndpoint(
		_runId: string,
		_nodeId: string,
	): Promise<{ url: string; event: string }> {
		// TODO: Implement webhook endpoint registration for BullMQ adapter
		// This would typically involve setting up an HTTP endpoint that can trigger the workflow
		throw new Error('registerWebhookEndpoint not implemented for BullMQAdapter')
	}

	public async close(): Promise<void> {
		this.logger.info('[BullMQAdapter] Closing worker and queue...')
		await this.worker?.close()
		await this.queue.close()
		const wasCreatedInternally = !(this.connection instanceof Redis)
		if (wasCreatedInternally) {
			await this.redisClient.quit()
		}
	}
}

import { createFlow, type NodeContext, SubflowNode } from 'flowcraft'

// ============================================================================
// NODE IMPLEMENTATIONS
// ============================================================================

interface LoopContext {
	counter: number
	maxIterations: number
	items: string[]
	processedItems: string[]
	success: boolean
}

// --- Simple loop nodes ---

async function initialize(ctx: NodeContext<LoopContext>) {
	await ctx.context.set('counter', 0)
	await ctx.context.set('maxIterations', 5)
	console.log('   Initialized counter=0, maxIterations=5')
	return { output: 0 }
}

async function increment(ctx: NodeContext<LoopContext>) {
	const count = (await ctx.context.get('counter')) ?? 0
	const newCount = count + 1
	await ctx.context.set('counter', newCount)
	console.log(`   Iteration ${newCount}`)
	return { output: newCount }
}

async function done(_ctx: NodeContext<LoopContext>) {
	console.log('   Loop finished')
	return { output: 'Done' }
}

// --- Multi-node loop nodes ---

async function prepareItems(ctx: NodeContext<LoopContext>) {
	const items = ['task-1', 'task-2', 'task-3']
	await ctx.context.set('items', items)
	await ctx.context.set('processedItems', [])
	await ctx.context.set('counter', 0)
	console.log(`   Prepared ${items.length} items`)
	return { output: items }
}

async function processItem(ctx: NodeContext<LoopContext>) {
	const items: string[] = (await ctx.context.get('items')) ?? []
	const item = items[0]
	const count = (await ctx.context.get('counter')) ?? 0
	await ctx.context.set('counter', count + 1)
	console.log(`   Processing: ${item}`)
	return { output: item }
}

async function markComplete(ctx: NodeContext<LoopContext>) {
	const processed: string[] = (await ctx.context.get('processedItems')) ?? []
	const items: string[] = (await ctx.context.get('items')) ?? []
	const item = items.shift()
	if (item) processed.push(item)
	await ctx.context.set('items', items)
	await ctx.context.set('processedItems', processed)
	console.log(`   Completed: ${item} (${items.length} remaining)`)
	return { output: item }
}

// --- Subflow nodes ---

async function validateInput(ctx: NodeContext<LoopContext>) {
	const data = await ctx.context.get('inputData')
	console.log(`   Validating: ${JSON.stringify(data)}`)
	return { output: { valid: true, data } }
}

async function enrichData(ctx: NodeContext<LoopContext>) {
	const input = ctx.input
	console.log(`   Enriching: ${JSON.stringify(input)}`)
	return { output: { ...input, enriched: true } }
}

// --- Retry loop nodes ---

async function attemptOperation(ctx: NodeContext<LoopContext>) {
	const count = (await ctx.context.get('counter')) ?? 0
	await ctx.context.set('counter', count + 1)
	const success = count + 1 >= 3 // succeed on attempt 3
	await ctx.context.set('success', success)
	console.log(`   Attempt ${count + 1}: ${success ? 'success' : 'failed, retrying'}`)
	return { output: { attempt: count + 1, success } }
}

async function onSuccess(_ctx: NodeContext<LoopContext>) {
	console.log('   Operation completed successfully')
	return { output: 'completed' }
}

// ============================================================================
// WORKFLOW FACTORIES
// ============================================================================

/**
 * Simple single-node loop. The loop body is one node that increments
 * a counter until the condition is met.
 */
export function createSimpleLoop() {
	return createFlow<LoopContext>('simple-loop')
		.node('initialize', initialize)
		.node('increment', increment)
		.node('done', done)
		.edge('initialize', 'counter') // entry edge to loop controller
		.edge('counter', 'done') // break edge
		.loop('counter', {
			startNodeId: 'increment',
			endNodeId: 'increment',
			condition: 'counter < maxIterations',
		})
}

/**
 * Multi-node loop body. The loop runs a process -> mark-complete
 * pipeline, checking each iteration whether more items remain.
 *
 * Key pattern: edge('source', 'loopId') creates an entry edge to the
 * loop controller so the loop body start node can become ready.
 */
export function createMultiNodeLoop() {
	return createFlow<LoopContext>('multi-node-loop')
		.node('prepare', prepareItems)
		.node('process', processItem)
		.node('markComplete', markComplete)
		.node('done', done)
		.edge('prepare', 'itemLoop') // entry edge to loop controller
		.edge('process', 'markComplete')
		.edge('itemLoop', 'done') // break edge
		.loop('itemLoop', {
			startNodeId: 'process',
			endNodeId: 'markComplete',
			condition: 'items.length > 0',
		})
}

/**
 * Subflow using the exported SubflowNode class for type-safe
 * builder API usage.
 */
export function createSubflowDemo() {
	const processingSubflow = createFlow<LoopContext>('processing-pipeline')
		.node('validate', validateInput)
		.node('enrich', enrichData)
		.edge('validate', 'enrich')

	const parentFlow = createFlow<LoopContext>('parent-with-subflow')
		.node('prepare', prepareItems)
		.node('runPipeline', SubflowNode, {
			params: {
				blueprintId: 'processing-pipeline',
				inputs: { inputData: 'items' },
			},
		})
		.node('done', done)
		.edge('prepare', 'runPipeline')
		.edge('runPipeline', 'done')

	return { parentFlow, processingSubflow }
}

/**
 * Retry loop with early exit. Uses a loop condition plus a conditional
 * edge from the loop controller to break early on success.
 */
export function createRetryLoop() {
	return (
		createFlow<LoopContext>('retry-loop')
			.node('attempt', attemptOperation)
			.node('success', onSuccess)
			.loop('retry', {
				startNodeId: 'attempt',
				endNodeId: 'attempt',
				condition: 'counter < 5',
			})
			// Early exit: break on success
			.edge('retry', 'success', { condition: 'success === true' })
	)
}

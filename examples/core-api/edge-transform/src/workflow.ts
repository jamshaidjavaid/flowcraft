import { createFlow, type NodeContext } from 'flowcraft'

interface WorkflowContext {
	rawOrder?: any
}

// ============================================================================
// PROPERTY EXTRACTION
// Extract a deeply nested value from a node's output using a dot-path
// transform on the edge. The `input` variable in the transform expression
// refers to the edge source node's output.
// ============================================================================

async function fetchAndValidate(ctx: NodeContext<WorkflowContext>) {
	const { context } = ctx
	console.log('📦 [Fetch] Retrieving order...')

	const rawOrder = await context.get('rawOrder')
	console.log(`📦 Order #${rawOrder.id} validated`)

	return {
		output: {
			id: rawOrder.id,
			customer: rawOrder.customer,
			shipping: {
				address: rawOrder.shipping.address,
				method: rawOrder.shipping.method,
			},
		},
	}
}

async function notifyWarehouse(ctx: NodeContext<WorkflowContext>) {
	console.log('🏭 [Notify] Forwarding to warehouse...')
	console.log(`🏭 Address received: ${ctx.input}`)

	return { output: ctx.input }
}

export function createPropertyExtractionWorkflow() {
	return createFlow<WorkflowContext>('edge-transform-property')
		.node('fetchAndValidate', fetchAndValidate)
		.node('notifyWarehouse', notifyWarehouse)
		.edge('fetchAndValidate', 'notifyWarehouse', {
			transform: 'input.shipping.address',
		})
}

// ============================================================================
// EXPLICIT INPUTS + TRANSFORM
// When a node has `inputs` pointing to a different node, the edge transform
// is evaluated against the inputs-referenced node's output — not the edge
// source's output. This lets you route data through intermediate nodes while
// transforming based on a specific source.
// ============================================================================

async function enrichOrder(ctx: NodeContext<WorkflowContext>) {
	const { context } = ctx
	console.log('✨ [Enrich] Looking up customer loyalty tier...')

	const rawOrder = await context.get('rawOrder')
	const enriched = {
		...rawOrder,
		customerTier: 'gold',
		loyaltyDiscount: 0.15,
	}

	console.log(`✨ Customer ${rawOrder.customer} is ${enriched.customerTier} tier`)
	return { output: enriched }
}

async function parseOrder(_ctx: NodeContext<WorkflowContext>) {
	console.log('📋 [Parse] Parsing order structure...')
	return { output: 'Order parsed' }
}

async function applyPricing(ctx: NodeContext<WorkflowContext>) {
	const { context } = ctx
	console.log('💲 [Price] Calculating pricing with discount...')

	const discount = await context.get('_inputs.applyPricing')
	console.log(`💲 Loyalty discount: ${discount * 100}%`)

	return { output: `${discount * 100}% discount applied` }
}

export function createExplicitInputsWorkflow() {
	return createFlow<WorkflowContext>('edge-transform-explicit-inputs')
		.node('enrichOrder', enrichOrder)
		.node('parseOrder', parseOrder)
		.node('applyPricing', applyPricing, { inputs: 'enrichOrder' })
		.edge('enrichOrder', 'parseOrder')
		.edge('parseOrder', 'applyPricing', {
			transform: 'input.loyaltyDiscount',
		})
}

<script setup>
import { createFlow } from 'flowcraft'

// Expense Report Processing Pipeline
// Demonstrates: batches, loops, conditionals, and HITL

const LAG = 800

const expenseFlow = createFlow('expense-report-pipeline')
	// 1. Fetch expense report line items (array output for batch)
	.node('fetch-report', async ({ context }) => {
		await new Promise((r) => setTimeout(r, LAG))
		await context.set('reportId', 'EXP-001')
		await context.set('employee', 'Alice')
		return {
			output: [
				{ amount: 45, type: 'meals', receipt: 'receipt-1.jpg' },
				{ amount: 120, type: 'travel', receipt: 'receipt-2.jpg' },
				{ amount: 1500, type: 'equipment', receipt: 'receipt-3.jpg' },
			],
		}
	})
	// 2. Batch: Validate each line item in parallel
	.batch(
		'validate-items',
		async ({ input }) => {
			await new Promise((r) => setTimeout(r, LAG))
			const ocrConfidence = input.amount > 1000 ? 0.7 : 0.95
			return { output: { ...input, ocrConfidence, status: 'validated' } }
		},
		{
			inputKey: 'fetch-report',
			outputKey: 'validated',
		},
	)
	// 3. Compute totals from validated items
	.node(
		'compute-total',
		async ({ input, context }) => {
			await new Promise((r) => setTimeout(r, LAG))
			const total = input.reduce((sum, item) => sum + item.amount, 0)
			const minConfidence = Math.min(...input.map((i) => i.ocrConfidence))
			await context.set('total', total)
			await context.set('minConfidence', minConfidence)
			await context.set('ocrAttempts', 0)
			return { output: { total, minConfidence } }
		},
		{ inputs: 'validated' },
	)
	// Wire batch edges
	.edge('fetch-report', 'validate-items')
	.edge('validate-items', 'compute-total')
	// 4. Loop: Re-scan if OCR confidence is too low
	.node('enhance-ocr', async ({ context }) => {
		await new Promise((r) => setTimeout(r, LAG))
		const attempts = (await context.get('ocrAttempts')) || 0
		const currentMin = (await context.get('minConfidence')) || 0
		const newAttempts = attempts + 1
		const improved = Math.min(0.95, currentMin + 0.1 * newAttempts)
		await context.set('minConfidence', improved)
		await context.set('ocrAttempts', newAttempts)
		return { output: { minConfidence: improved, ocrAttempts: newAttempts } }
	})
	.loop('ocrRetry', {
		startNodeId: 'enhance-ocr',
		endNodeId: 'enhance-ocr',
		condition: 'minConfidence < 0.9 && ocrAttempts < 3',
	})
	.edge('compute-total', 'ocrRetry')
	.edge('ocrRetry', 'route-by-total')
	// 5. Conditional routing based on total amount
	.node('route-by-total', async ({ context }) => {
		await new Promise((r) => setTimeout(r, LAG))
		const total = (await context.get('total')) || 0
		return { output: { total } }
	})
	.edge('route-by-total', 'wait-manager', {
		condition: 'route-by-total.total >= 500 && route-by-total.total <= 2000',
	})
	.edge('route-by-total', 'auto-approve', { condition: 'route-by-total.total < 500' })
	.edge('route-by-total', 'auto-reject', { condition: 'route-by-total.total > 2000' })
	// 5a. HITL: Manager approval required ($500-$2000)
	.wait('wait-manager')
	// 5b. Auto-approve path (under $500)
	.node('auto-approve', async () => ({
		output: { status: 'approved', method: 'auto' },
	}))
	// 5c. Reject path (over $2000)
	.node('auto-reject', async () => ({
		output: { status: 'rejected', reason: 'Exceeds single-report limit' },
	}))
	// 6. Converge and send notification
	.node(
		'send-notification',
		async ({ input }) => {
			await new Promise((r) => setTimeout(r, LAG))
			return { output: { message: `Notification sent: ${input.status}` } }
		},
		{ config: { joinStrategy: 'any' } },
	)
	// Wire convergence
	.edge('wait-manager', 'send-notification')
	.edge('auto-approve', 'send-notification')
	.edge('auto-reject', 'send-notification')

const positionsMap = {
	'fetch-report': { x: 0, y: 150 },
	'validate-items': { x: 0, y: 300 },
	'compute-total': { x: 0, y: 450 },
	'enhance-ocr': { x: 150, y: 650 },
	'route-by-total': { x: 430, y: 500 },
	'wait-manager': { x: 700, y: 300 },
	'auto-approve': { x: 700, y: 430 },
	'auto-reject': { x: 700, y: 540 },
	'send-notification': { x: 1000, y: 430 },
}
const typesMap = {
	'fetch-report': 'input',
	'validate-items': 'default',
	'compute-total': 'default',
	'enhance-ocr': 'default',
	'route-by-total': 'default',
	'wait-manager': 'default',
	'auto-approve': 'default',
	'auto-reject': 'default',
	'send-notification': 'output',
}
</script>

<template>
	<div class="flowcraft-flow h-110!">
		<Flow :flow="expenseFlow" :positions-map :types-map />
	</div>
</template>

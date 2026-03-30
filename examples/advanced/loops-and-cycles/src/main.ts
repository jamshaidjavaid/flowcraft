import { FlowRuntime, UnsafeEvaluator } from 'flowcraft'
import { createMultiNodeLoop, createRetryLoop, createSimpleLoop, createSubflowDemo } from './workflow'

async function main() {
	console.log('🚀 Flowcraft Loops, Cycles & Subflows Example\n')

	// ============================================================================
	// 1. SIMPLE LOOP
	// ============================================================================
	console.log('='.repeat(60))
	console.log('🔄 SIMPLE LOOP')
	console.log('='.repeat(60))

	try {
		const workflow = createSimpleLoop()
		const runtime = new FlowRuntime({ evaluator: new UnsafeEvaluator() })
		const result = await runtime.run(
			workflow.toBlueprint(),
			{ counter: 0, maxIterations: 5, items: [], processedItems: [], success: false },
			{ functionRegistry: workflow.getFunctionRegistry() },
		)

		console.log(`\n✅ Simple loop completed`)
		console.log(`   Counter: ${result.context.counter}`)
		console.log(`   Status: ${result.status}`)
	} catch (error) {
		console.error('❌ Simple loop failed:', error)
	}

	// ============================================================================
	// 2. MULTI-NODE LOOP
	// ============================================================================
	console.log(`\n${'='.repeat(60)}`)
	console.log('🔄 MULTI-NODE LOOP')
	console.log('='.repeat(60))

	try {
		const workflow = createMultiNodeLoop()
		const runtime = new FlowRuntime({ evaluator: new UnsafeEvaluator() })
		const result = await runtime.run(
			workflow.toBlueprint(),
			{ counter: 0, maxIterations: 0, items: [], processedItems: [], success: false },
			{ functionRegistry: workflow.getFunctionRegistry() },
		)

		console.log(`\n✅ Multi-node loop completed`)
		console.log(`   Items processed: ${result.context.processedItems?.length ?? 0}`)
		console.log(`   Status: ${result.status}`)
	} catch (error) {
		console.error('❌ Multi-node loop failed:', error)
	}

	// ============================================================================
	// 3. SUBFLOW
	// ============================================================================
	console.log(`\n${'='.repeat(60)}`)
	console.log('📦 SUBFLOW')
	console.log('='.repeat(60))

	try {
		const { parentFlow, processingSubflow } = createSubflowDemo()
		const combinedRegistry = new Map([...parentFlow.getFunctionRegistry(), ...processingSubflow.getFunctionRegistry()])
		const runtime = new FlowRuntime({
			evaluator: new UnsafeEvaluator(),
			blueprints: { 'processing-pipeline': processingSubflow.toBlueprint() },
		})
		const result = await runtime.run(
			parentFlow.toBlueprint(),
			{ counter: 0, maxIterations: 0, items: [], processedItems: [], success: false },
			{ functionRegistry: combinedRegistry },
		)

		console.log(`\n✅ Subflow completed`)
		console.log(`   Status: ${result.status}`)
	} catch (error) {
		console.error('❌ Subflow failed:', error)
	}

	// ============================================================================
	// 4. RETRY LOOP
	// ============================================================================
	console.log(`\n${'='.repeat(60)}`)
	console.log('🔄 RETRY LOOP (with early exit)')
	console.log('='.repeat(60))

	try {
		const workflow = createRetryLoop()
		const runtime = new FlowRuntime({ evaluator: new UnsafeEvaluator() })
		const result = await runtime.run(
			workflow.toBlueprint(),
			{ counter: 0, maxIterations: 0, items: [], processedItems: [], success: false },
			{ functionRegistry: workflow.getFunctionRegistry() },
		)

		console.log(`\n✅ Retry loop completed`)
		console.log(`   Attempts: ${result.context.counter}`)
		console.log(`   Status: ${result.status}`)
	} catch (error) {
		console.error('❌ Retry loop failed:', error)
	}

	// ============================================================================
	console.log('\n🎉 Loops, cycles & subflows example completed!')
}

main().catch((error) => {
	console.error('💥 An error occurred:', error)
	process.exit(1)
})

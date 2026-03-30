import { ConsoleLogger, FlowRuntime } from 'flowcraft'
import { createExplicitInputsWorkflow, createPropertyExtractionWorkflow } from './workflow'

const sampleOrder = {
	id: 'ORD-4521',
	customer: 'Alice Cooper',
	items: [
		{ name: 'Widget', qty: 3 },
		{ name: 'Gadget', qty: 1 },
	],
	shipping: {
		address: '123 Main St, Springfield, IL 62704',
		method: 'express',
	},
}

// ============================================================================
// SCENARIO 1: PROPERTY EXTRACTION
// ============================================================================

async function demonstratePropertyExtraction() {
	console.log('🔍 SCENARIO 1: PROPERTY EXTRACTION')
	console.log('='.repeat(50))
	console.log()
	console.log('Workflow demonstrates:')
	console.log('• Extracting a deeply nested value from a node output')
	console.log('• Using a dot-path transform on an edge')
	console.log()

	const workflow = createPropertyExtractionWorkflow()
	const blueprint = workflow.toBlueprint()

	console.log('📋 Workflow Blueprint:')
	console.log(`   ID: ${blueprint.id}`)
	console.log(`   Nodes: ${blueprint.nodes.map((n) => n.id).join(' → ')}`)
	console.log(`   Edge transform: "input.shipping.address"`)
	console.log()

	console.log('📦 Input Order:')
	console.log(JSON.stringify(sampleOrder, null, 2))
	console.log()

	const runtime = new FlowRuntime({ logger: new ConsoleLogger() })

	try {
		const result = await runtime.run(
			blueprint,
			{ rawOrder: sampleOrder },
			{ functionRegistry: workflow.getFunctionRegistry() },
		)

		console.log('\n✅ Workflow completed!')
		console.log()
		console.log('📊 Results:')
		console.log(`   Shipping address: ${result.context['_outputs.notifyWarehouse']}`)
		console.log()
	} catch (error) {
		console.error('❌ Workflow failed:', error)
	}
}

// ============================================================================
// SCENARIO 2: EXPLICIT INPUTS + TRANSFORM
// ============================================================================

async function demonstrateExplicitInputs() {
	console.log('🔀 SCENARIO 2: EXPLICIT INPUTS + TRANSFORM')
	console.log('='.repeat(50))
	console.log()
	console.log('Workflow demonstrates:')
	console.log('• Using `inputs` to reference a different node than the edge source')
	console.log('• Edge transform evaluated against the inputs-referenced node output')
	console.log()

	const workflow = createExplicitInputsWorkflow()
	const blueprint = workflow.toBlueprint()

	console.log('📋 Workflow Blueprint:')
	console.log(`   ID: ${blueprint.id}`)
	console.log(`   Nodes: ${blueprint.nodes.map((n) => n.id).join(' → ')}`)
	console.log(`   "applyPricing" has inputs: "enrichOrder"`)
	console.log(`   Edge "parseOrder → applyPricing" has transform: "input.loyaltyDiscount"`)
	console.log()

	console.log('📦 Input Order:')
	console.log(JSON.stringify(sampleOrder, null, 2))
	console.log()

	const runtime = new FlowRuntime({ logger: new ConsoleLogger() })

	try {
		const result = await runtime.run(
			blueprint,
			{ rawOrder: sampleOrder },
			{ functionRegistry: workflow.getFunctionRegistry() },
		)

		console.log('\n✅ Workflow completed!')
		console.log()
		console.log('📊 Results:')
		console.log(`   Pricing result: ${result.context['_outputs.applyPricing']}`)
		console.log()
	} catch (error) {
		console.error('❌ Workflow failed:', error)
	}
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
	console.log('🚀 Flowcraft Edge Transform Example\n')

	await demonstratePropertyExtraction()
	await demonstrateExplicitInputs()

	console.log('='.repeat(60))
	console.log('🎓 EDGE TRANSFORM KEY CONCEPTS')
	console.log('='.repeat(60))
	console.log()
	console.log('📐 TRANSFORM EXPRESSION:')
	console.log('   • Set `transform` on an edge definition')
	console.log('   • The `input` variable refers to the source node output')
	console.log('   • Default evaluator supports dot-path access (e.g. "a.b.c")')
	console.log()
	console.log('🔀 EXPLICIT INPUTS:')
	console.log('   • When target node has `inputs: "otherNode"`, the transform')
	console.log("     is evaluated against that node's output")
	console.log('   • This lets you route data through intermediate nodes')
	console.log('     while transforming based on a specific source')
	console.log()
	console.log('⚡ UNSAFE EVALUATOR:')
	console.log('   • For arithmetic or JS expressions, use UnsafeEvaluator')
	console.log('   • Example: `transform: "input.total * 0.9"`')
	console.log('   • Only use with trusted workflow definitions')
	console.log('='.repeat(60))
}

main()

# Edge Transforms

This example demonstrates how to use edge transforms to reshape data as it flows between workflow nodes. Transforms let you extract, filter, or compute values on the edge itself, before the target node receives its input.

## Overview

The example showcases two core patterns:

1. **Property Extraction** — Use a dot-path expression to pull a deeply nested value from the source node's output
2. **Explicit Inputs + Transform** — Use `inputs` to reference a specific node, with the transform evaluated against that node's output rather than the edge source

## Running the Example

```bash
# Install dependencies
pnpm install

# Run the example
pnpm start
```

## What You'll Learn

### Basic Transform

Add a `transform` string to any edge. The `input` variable in the expression refers to the **edge source** node's output.

```typescript
import { createFlow } from 'flowcraft'

const workflow = createFlow('my-workflow')
  .node('fetch', fetchOrder)
  .node('ship', shipOrder)
  .edge('fetch', 'ship', {
    transform: 'input.shipping.address',
  })
```

In this example, `fetch` returns an order object. The edge transform extracts `order.shipping.address` so that `ship` receives only the address string.

### Explicit Inputs + Transform

When a target node has an `inputs` mapping, the transform is evaluated against the **inputs-referenced** node's output — not the edge source.

```typescript
const workflow = createFlow('my-workflow')
  .node('enrich', enrichOrder)   // returns { items, loyaltyDiscount, ... }
  .node('parse', parseOrder)
  .node('price', applyPricing, { inputs: 'enrich' })
  .edge('enrich', 'parse')
  .edge('parse', 'price', {
    transform: 'input.loyaltyDiscount',
  })
```

Here `price` has `inputs: 'enrich'`. Even though the incoming edge comes from `parse`, the transform resolves `enrich`'s output and evaluates `input.loyaltyDiscount` against it. `price` receives the discount value directly.

### Unsafe Evaluator

The default `PropertyEvaluator` supports dot-path expressions only. For arithmetic or JavaScript expressions, pass `UnsafeEvaluator` to the runtime:

```typescript
import { FlowRuntime, UnsafeEvaluator } from 'flowcraft'

const runtime = new FlowRuntime({
  evaluator: new UnsafeEvaluator(),
})

// Now edge transforms can use JS expressions:
.edge('fetch', 'applyDiscount', {
  transform: 'Math.round((input.subtotal + input.tax) * 0.9 * 100) / 100',
})
```

> **Note:** Only use `UnsafeEvaluator` with trusted workflow definitions, as it executes arbitrary expressions.

## Expected Output

```
🚀 Flowcraft Edge Transform Example

🔍 SCENARIO 1: PROPERTY EXTRACTION
==================================================

Workflow demonstrates:
• Extracting a deeply nested value from a node output
• Using a dot-path transform on an edge

📋 Workflow Blueprint:
   ID: edge-transform-property
   Nodes: fetchAndValidate → notifyWarehouse
   Edge transform: "input.shipping.address"

📦 Input Order:
{
  "id": "ORD-4521",
  "customer": "Alice Cooper",
  ...
  "shipping": {
    "address": "123 Main St, Springfield, IL 62704",
    "method": "express"
  }
}

📦 [Fetch] Retrieving order...
📦 Order #ORD-4521 validated
🏭 [Notify] Forwarding to warehouse...
🏭 Address received: 123 Main St, Springfield, IL 62704

✅ Workflow completed!

📊 Results:
   Shipping address: 123 Main St, Springfield, IL 62704

🔀 SCENARIO 2: EXPLICIT INPUTS + TRANSFORM
==================================================

Workflow demonstrates:
• Using `inputs` to reference a different node than the edge source
• Edge transform evaluated against the inputs-referenced node output

📋 Workflow Blueprint:
   ID: edge-transform-explicit-inputs
   Nodes: enrichOrder → parseOrder → applyPricing
   "applyPricing" has inputs: "enrichOrder"
   Edge "parseOrder → applyPricing" has transform: "input.loyaltyDiscount"

✨ [Enrich] Looking up customer loyalty tier...
✨ Customer Alice Cooper is gold tier
📋 [Parse] Parsing order structure...
💲 [Price] Calculating pricing with discount...
💲 Loyalty discount: 15%

✅ Workflow completed!

📊 Results:
   Pricing result: 15% discount applied
```

## Key Concepts Demonstrated

- **Dot-path expressions** — The default evaluator walks nested properties using string paths like `"input.shipping.address"`
- **Transform scope** — The `input` variable always refers to a node output: the edge source, or the `inputs`-referenced node when explicit inputs are set
- **Data narrowing** — Transforms let downstream nodes receive only the slice of data they need
- **Composability** — Transforms work alongside `inputs` mappings, edge conditions, and actions

## Files

- `src/workflow.ts` — Workflow definitions for both scenarios
- `src/main.ts` — Runtime execution and output
- `package.json` — Dependencies and scripts
- `tsconfig.json` — TypeScript configuration

## Next Steps

After understanding edge transforms, explore:
- `context-state-management` — Advanced context manipulation and data flow
- `built-in-nodes` — Flowcraft's built-in node types
- `function-class-nodes` — Different ways to define node logic

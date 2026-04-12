# @flowcraft/opentelemetry-middleware

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![NPM Version](https://img.shields.io/npm/v/@flowcraft/opentelemetry-middleware.svg)](https://www.npmjs.com/package/@flowcraft/opentelemetry-middleware)
[![Codecov](https://img.shields.io/codecov/c/github/gorango/flowcraft/middleware-opentelemetry)](https://codecov.io/github/gorango/flowcraft)

[OpenTelemetry](https://opentelemetry.io/) middleware for Flowcraft workflows, providing distributed tracing and observability.

## Installation

```bash
npm install @flowcraft/opentelemetry-middleware
```

## Usage

```typescript
import { FlowRuntime } from 'flowcraft'
import { OpenTelemetryMiddleware } from '@flowcraft/opentelemetry-middleware'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'

// Set up OpenTelemetry SDK
const sdk = new NodeSDK({
	traceExporter: new OTLPTraceExporter(),
})
sdk.start()

// Create middleware
const otelMiddleware = new OpenTelemetryMiddleware('flowcraft-worker')

// Add to FlowRuntime
const runtime = new FlowRuntime({
	middleware: [otelMiddleware],
})
```

## Features

- Distributed tracing across workflow executions
- Automatic span creation for each node
- Context propagation between nodes
- Error recording and status tracking

## License

This package is licensed under the [MIT License](https://github.com/gorango/flowcraft/blob/master/LICENSE).

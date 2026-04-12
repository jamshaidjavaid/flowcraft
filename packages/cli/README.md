# @flowcraft/cli

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![NPM Version](https://img.shields.io/npm/v/@flowcraft/cli.svg)](https://www.npmjs.com/package/@flowcraft/cli)
[![Codecov](https://img.shields.io/codecov/c/github/gorango/flowcraft/cli)](https://codecov.io/github/gorango/flowcraft)

Command-line interface for Flowcraft workflow observability and debugging.

## Installation

```bash
npm install -g @flowcraft/cli
```

## Usage

### Inspect Workflow Executions

Inspect a completed workflow execution to see its timeline, node executions, and final state:

```bash
# Inspect using SQLite history
flowcraft inspect <run-id> --database ./workflow-events.db

# Inspect using PostgreSQL history
flowcraft inspect <run-id> \
  --host localhost \
  --port 5432 \
  --user flowcraft \
  --password password \
  --dbname flowcraft

# Output in JSON format
flowcraft inspect <run-id> --database ./events.db --json
```

### Example Output

```
🚀 Workflow Execution Summary
──────────────────────────────────────────────────
Run ID: run_abc123
Blueprint: order-processing-workflow
Status: Completed

📊 Execution Statistics
──────────────────────────────
Total Events: 24
Nodes Started: 5
Nodes Completed: 5
Nodes Failed: 0

⏱️  Node Execution Timeline
────────────────────────────────────────
┌─────────────┬───────────┬──────────┐
│ Node ID     │ Status    │ Duration │
├─────────────┼───────────┼──────────┤
│ validate    │ Completed │ ~        │
│ process     │ Completed │ ~        │
│ ship        │ Completed │ ~        │
│ notify      │ Completed │ ~        │
│ complete    │ Completed │ ~        │
└─────────────┴───────────┴──────────┘

📋 Final Context
────────────────────
orderId: ORD-2024-001
status: shipped
trackingNumber: 1Z999AA1234567890
customerEmail: customer@example.com
```

## Commands

### `flowcraft inspect <run-id>`

Inspect a workflow execution and display detailed information including:

- **Execution Summary**: Run ID, blueprint, status, and error counts
- **Statistics**: Total events, node execution counts
- **Node Timeline**: Execution status and timing for each node
- **Final Context**: Key-value pairs from the workflow's final state

#### Options

- `--database <path>`: Path to SQLite database file
- `--host <host>`: PostgreSQL host
- `--port <port>`: PostgreSQL port (default: 5432)
- `--user <user>`: PostgreSQL username
- `--password <password>`: PostgreSQL password
- `--dbname <dbname>`: PostgreSQL database name
- `--table <table>`: History table name (default: 'flowcraft_events')
- `--json`: Output raw event data in JSON format

## Configuration

The CLI connects to your history backend to retrieve workflow events. You can configure the connection in several ways (in order of precedence):

### 1. Command Line Options

#### SQLite Backend

```bash
flowcraft inspect <run-id> --database ./workflow-events.db
```

#### PostgreSQL Backend

```bash
flowcraft inspect <run-id> \
  --host localhost \
  --port 5432 \
  --user flowcraft \
  --password password \
  --dbname flowcraft \
  --table workflow_events
```

### 2. Environment Variables

#### SQLite

```bash
export FLOWCRAFT_HISTORY_TYPE=sqlite
export FLOWCRAFT_SQLITE_PATH=./workflow-events.db
```

#### PostgreSQL

```bash
export FLOWCRAFT_HISTORY_TYPE=postgres
export FLOWCRAFT_POSTGRES_HOST=localhost
export FLOWCRAFT_POSTGRES_PORT=5432
export FLOWCRAFT_POSTGRES_USER=flowcraft
export FLOWCRAFT_POSTGRES_PASSWORD=password
export FLOWCRAFT_POSTGRES_DB=flowcraft
export FLOWCRAFT_POSTGRES_TABLE=workflow_events  # optional
```

### 3. Configuration File

Create a `.flowcraft.json` file in your project directory or `~/.flowcraft/config.json`:

#### SQLite Configuration

```json
{
	"history": {
		"type": "sqlite",
		"sqlite": {
			"databasePath": "./workflow-events.db"
		}
	}
}
```

#### PostgreSQL Configuration

```json
{
	"history": {
		"type": "postgres",
		"postgres": {
			"host": "localhost",
			"port": 5432,
			"user": "flowcraft",
			"password": "password",
			"database": "flowcraft",
			"tableName": "workflow_events"
		}
	}
}
```

## Roadmap

- `flowcraft list`: List recent workflow executions
- `flowcraft reconcile <run-id>`: Manually trigger reconciliation for stuck workflows
- `flowcraft inspect --web`: Launch web UI for richer visualization
- `flowcraft compare <run-id-1> <run-id-2>`: Compare two workflow executions

## License

This package is licensed under the [MIT License](https://github.com/gorango/flowcraft/blob/master/LICENSE).

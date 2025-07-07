# Aurora Limitless Database Insert Throughput Benchmark

This benchmark tests Aurora Limitless (PostgreSQL-based) database insert throughput using multiple worker threads and concurrent connections.

## Features

- **Multi-worker benchmarking**: Tests different numbers of worker threads
- **Concurrent connections**: Each worker can use multiple database connections
- **Batch inserts**: Uses Knex.js for efficient batch insert operations
- **Performance metrics**: Measures throughput, latency, and success rates
- **Realistic data**: Generates CapturedText records matching the existing schema

## Environment Variables

Set these environment variables to configure the benchmark:

```bash
# Database configuration
export AURORA_HOST="your-aurora-cluster-endpoint"
export AURORA_PORT="5432"
export AURORA_DATABASE="browseai"
export AURORA_USERNAME="your-username"
export AURORA_PASSWORD="your-password"
export AURORA_SSL="true"  # Set to "true" for SSL connections

# Benchmark configuration
export MIN_WORKERS="1"
export MAX_WORKERS="4"
export WORKER_STEP="1"
export CONNECTIONS_PER_WORKER="2"
export BATCH_SIZE="100"
export TEST_DURATION="30"  # seconds
export WARMUP_DURATION="5"  # seconds

# Data generation
export MIN_TEXT_LENGTH="50"
export MAX_TEXT_LENGTH="500"
export DATA_SIZE_MB="100"

# Performance thresholds
export MAX_LATENCY_MS="1000"
export MIN_THROUGHPUT_MBPS="10"
```

## Quick Start

### Option 1: Using the Script (Recommended)

1. **Set up environment variables**:

   ```bash
   # Copy example configuration
   cp example.env .env

   # Edit .env with your Aurora cluster details
   nano .env
   ```

2. **Run the benchmark**:
   ```bash
   cd packages/backend/services/tables/src/lambdas/aurora-limitless-benchmark
   ./run-benchmark.sh
   ```

### Option 2: Manual Setup

1. **Set environment variables** for your Aurora Limitless cluster
2. **Build and run**:
   ```bash
   cd packages/backend/services/tables/src/lambdas/aurora-limitless-benchmark
   npx tsc
   node dist/index.js
   ```

### View Results

Results are saved to `./aurora_benchmark_results/` directory as JSON files.

## Output

The benchmark outputs:

- **Throughput**: MB/s and records/second
- **Latency**: Average, P50, P95, P99 latencies
- **Success rate**: Percentage of successful inserts
- **Error details**: Any errors encountered during testing

## Architecture

- **Main thread**: Orchestrates workers and aggregates results
- **Worker threads**: Each worker runs independent database connections
- **Database layer**: Uses Knex.js with connection pooling
- **Data generation**: Creates realistic CapturedText records

## Dependencies

Uses existing backend dependencies:

- `@browseai/backend`: For database types and utilities
- `knex`: Database query builder (from backend)
- `uuid`: For generating unique IDs
- `worker_threads`: Node.js built-in module

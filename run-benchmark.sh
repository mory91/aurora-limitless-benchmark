#!/bin/bash

# Aurora Limitless Benchmark Runner
# This script sets up the environment and runs the benchmark

set -e  # Exit on any error

echo "🚀 Aurora Limitless Database Insert Throughput Benchmark"
echo "=================================================="

# Check if required environment variables are set
if [ -z "$AURORA_HOST" ]; then
    echo "❌ Error: AURORA_HOST environment variable is required"
    echo "Please set it to your Aurora cluster endpoint"
    exit 1
fi

if [ -z "$AURORA_PASSWORD" ]; then
    echo "❌ Error: AURORA_PASSWORD environment variable is required"
    echo "Please set it to your Aurora database password"
    exit 1
fi

# Set default values for optional environment variables
export AURORA_PORT=${AURORA_PORT:-"5432"}
export AURORA_DATABASE=${AURORA_DATABASE:-"browseai"}
export AURORA_USERNAME=${AURORA_USERNAME:-"postgres"}
export AURORA_SSL=${AURORA_SSL:-"true"}

# Benchmark configuration
export MIN_WORKERS=${MIN_WORKERS:-"1"}
export MAX_WORKERS=${MAX_WORKERS:-"4"}
export WORKER_STEP=${WORKER_STEP:-"1"}
export CONNECTIONS_PER_WORKER=${CONNECTIONS_PER_WORKER:-"2"}
export BATCH_SIZE=${BATCH_SIZE:-"100"}
export TEST_DURATION=${TEST_DURATION:-"30"}
export WARMUP_DURATION=${WARMUP_DURATION:-"5"}

# Data generation
export MIN_TEXT_LENGTH=${MIN_TEXT_LENGTH:-"50"}
export MAX_TEXT_LENGTH=${MAX_TEXT_LENGTH:-"500"}
export DATA_SIZE_MB=${DATA_SIZE_MB:-"100"}

# Performance thresholds
export MAX_LATENCY_MS=${MAX_LATENCY_MS:-"1000"}
export MIN_THROUGHPUT_MBPS=${MIN_THROUGHPUT_MBPS:-"10"}

echo "📋 Configuration:"
echo "  Database: $AURORA_HOST:$AURORA_PORT/$AURORA_DATABASE"
echo "  Username: $AURORA_USERNAME"
echo "  SSL: $AURORA_SSL"
echo "  Workers: $MIN_WORKERS-$MAX_WORKERS (step: $WORKER_STEP)"
echo "  Connections per worker: $CONNECTIONS_PER_WORKER"
echo "  Batch size: $BATCH_SIZE"
echo "  Test duration: ${TEST_DURATION}s"
echo "  Warmup duration: ${WARMUP_DURATION}s"
echo ""

# Check if we're in the right directory
if [ ! -f "src/index.ts" ]; then
    echo "❌ Error: Please run this script from the aurora-limitless-benchmark directory"
    exit 1
fi

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed or not in PATH"
    exit 1
fi

# Check if TypeScript is available
if ! command -v npx &> /dev/null; then
    echo "❌ Error: npx is not available"
    exit 1
fi

echo "🔧 Building benchmark..."
# Build the TypeScript code
npx tsc --project . || {
    echo "❌ Error: TypeScript compilation failed"
    exit 1
}

echo "✅ Build completed successfully"
echo ""

echo "🏃 Starting benchmark..."
echo "=================================================="

# Run the benchmark
node dist/index.js

echo ""
echo "✅ Benchmark completed!"
echo "📊 Results saved to ./aurora_benchmark_results/"
echo ""

# List the results files
if [ -d "./aurora_benchmark_results" ]; then
    echo "📁 Available results:"
    ls -la ./aurora_benchmark_results/*.json 2>/dev/null || echo "  No results files found"
fi

echo ""
echo "🎉 Benchmark run completed successfully!" 
# Hybrid Interpolation-Based Search Performance Profiler

A high-performance benchmark suite built in Vanilla JS, HTML5, and CSS3 designed to import datasets, execute complex hybrid-interpolation search benchmarks, and render interactive performance metrics.

## Features

1. **Step-by-Step Wizard Layout**: Guide users sequentially through dataset ingestion, benchmarking parameters setup, and detailed results reporting.
2. **Flexible Ingestion & Realistic Generation**: Upload custom JSON/CSV tables or generate synthetic e-commerce collections across 5 standardized tiers:
   - **10,000 records**: Small Baseline
   - **50,000 records**: Medium Testbed
   - **100,000 records**: Large Baseline
   - **500,000 records**: Very Large Testbed
   - **1,000,000 records**: Massive / Stress-Test Scale
3. **Realistic Category-Based Product Names**: Generated records feature realistic product names mapped specifically to their categories (`Electronics`, `Clothing`, `Home`, and `Toys`) with distinct brand names, product titles, and model variants.
4. **Uniform vs. Non-Uniform Key Distribution Profiling**:
   - **Uniform Distribution**: Linear key spacing ($O(1)$ to $O(\log \log N)$ interpolation efficiency) to observe optimal probe performance.
   - **Non-Uniform Distribution**: Skewed power-law curve ($t^{2.5}$) and cluster leap gaps to simulate real-world non-linear data distributions and stress-test the fallback bisection mechanics of Binary, Fibonacci, and Exponential hybrid algorithms.
5. **Dataset Schema & Validation**: Every record comprises 5 core fields: `SKU`, `Name`, `Category`, `Price`, and `Stock`. Incomplete imports with missing fields or values are rejected while displaying an alert notification indicating that the dataset is wrong.
6. **Advanced Performance Analytics**: Visualize search run comparisons on latency and memory footprints using dynamic Chart.js canvases with distribution-aware analytical commentary.
7. **Algorithmic Profiling**:
   - Interpolation-Binary Hybrid Search
   - Interpolation-Fibonacci Hybrid Search
   - Interpolation-Exponential Hybrid Search
8. **Integrated Algorithm Visualizer**: Real-time synchronized multi-track playback demonstrating step-by-step convergence across all 3 search variants with speed control, range bars, and comparative telemetry.
9. **Data Export**: Export execution histories as JSON or CSV reports.

## Setup & Running

To run the application locally, start the integrated lightweight HTTP server:

```bash
# Install dependencies (none required for the client app)
npm install

# Start the local web server
npm start
```

Open your browser and navigate to `http://localhost:5000`.

## Directory Structure

```
hybrid-interpolation-profiler/
├── index.html              # Main application layout
├── css/
│   ├── main.css            # Base styles and resets
│   └── components.css      # Stepper, dropzone, metrics, cards, etc.
├── js/
│   ├── app.js              # State manager & page events
│   ├── dataset.js          # File parser & synthetic generator
│   ├── profiler.js         # Benchmark runner
│   ├── visualizer.js       # Synchronized multi-track algorithm visualizer
│   ├── ui.js               # Render functions
│   ├── charts.js           # Chart.js initialization & rendering
│   └── algorithms/         # Search algorithms
│       ├── binary.js
│       ├── fibonacci.js
│       └── exponential.js
├── data/
│   └── sample-1k.json      # Small default benchmark dataset
└── docs/
    └── architecture.md     # Architecture documentation
```

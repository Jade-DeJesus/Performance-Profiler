# Architecture Documentation - Hybrid Interpolation-Based Search Profiler

This document details the software architecture, modular decomposition, and algorithmic design of the Hybrid Interpolation Search Profiler application.

## Directory Structure

The project has been restructured into a modular, clean layout:

```
hybrid-interpolation-profiler/
├── index.html              # Main multi-step wizard application layout
├── css/
│   ├── main.css            # Base styles, typography, layout grid
│   └── components.css      # Stepper, dropzone, cards, metrics, and tables
├── js/
│   ├── app.js              # State manager & step wizard navigation
│   ├── dataset.js          # File upload parser (CSV/JSON) & synthetic generator
│   ├── profiler.js         # Benchmark runner using performance.now()
│   ├── visualizer.js       # Synchronized multi-track algorithm playback visualizer
│   ├── ui.js               # Render functions for tables, cards, & text insights
│   ├── charts.js           # Chart.js initialization & rendering
│   └── algorithms/         # Search algorithm implementations
│       ├── binary.js
│       ├── fibonacci.js
│       └── exponential.js
├── data/
│   └── sample-1k.json      # Small default benchmark dataset
├── docs/
│   ├── architecture.md     # Architecture documentation
│   └── wireframes/         # Reference designs / screenshots (directory)
├── .gitignore
└── README.md
```

## Modular Components

### 1. Presentation Layer (`index.html`, `css/`)
- **`index.html`**: Formulates the user interface using a multi-step stepper flow (Wizard style).
- **`css/main.css`**: Defines design tokens, typography, CSS resets, layout grid, and utility classes.
- **`css/components.css`**: Houses specific encapsulated styling for modals, tables, configuration panels, tabs, steps, dropzones, and charts.

### 2. Application & State Layer (`js/app.js`, `js/ui.js`, `js/charts.js`, `js/visualizer.js`)
- **`js/app.js`**: Manages the application lifecycle, global variables, wizard page navigation transitions, file-upload events, and reporting hooks.
- **`js/ui.js`**: Populates the UI nodes with dynamic contents, including the dataset preview modal table (incorporating lazy-pagination to avoid blocking the main UI thread), performance results, and textual interpretations.
- **`js/charts.js`**: Generates responsive, high-performance canvas visualizers utilizing `Chart.js` for execution times, memory usage, and dual-axis overlay comparison.
- **`js/visualizer.js`**: Synchronized multi-track visualizer executing Interpolation-Binary, Interpolation-Fibonacci, and Interpolation-Exponential searches in frame-accurate lockstep with play, pause, step, speed, and real-time comparative telemetry.

### 3. Business & Core Processing Layer (`js/dataset.js`, `js/profiler.js`)
- **`js/dataset.js`**: Parses and validates CSV/JSON datasets uploaded by the user (ensuring `SKU`, `Name`, `Category`, `Price`, and `Stock` are present, triggering an alert and blocking navigation if incomplete data is uploaded), and incorporates a high-performance synthetic data generator producing records across 5 calibrated scale tiers: 10K (Small Baseline), 50K (Medium Testbed), 100K (Large Baseline), 500K (Very Large Testbed), and 1M (Massive / Stress-Test Scale). Features realistic category-based naming pools (`Electronics`, `Clothing`, `Home`, `Toys`) and dual key distribution profiles:
  - **Uniform**: Linear key stepping for near-ideal interpolation probing.
  - **Non-Uniform**: Skewed power-law curve ($t^{2.5}$) and cluster leap gaps to simulate real-world non-linear indexing.
- **`js/profiler.js`**: Orchestrates benchmarks on in-memory collections using high-precision timers (`performance.now()`). Automatically runs multiple search iteration groups across the collection to ensure statistical significance.

### 4. Algorithmic Search Module (`js/algorithms/`)
Contains specialized interpolation-hybrid search implementations. These methods calculate search boundaries based on key distribution to converge faster than conventional logarithmic searches on linear, uniform datasets:
- **`binary.js`**: Interpolation with fallback to Binary Search bisection logic.
- **`fibonacci.js`**: Interpolation with fallback to Fibonacci golden-ratio interval partitioning.
- **`exponential.js`**: Interpolation with fallback to Exponential doubling range expansion ($2^k$).

## Search Algorithmic Design & Key Distribution Effects

Interpolation search works by calculating a probing position `pos` based on key distribution:

\[pos = low + \left\lfloor \frac{high - low}{arr[high].key - arr[low].key} \times (key - arr[low].key) \right\rfloor\]

- **Under Uniform Distribution**: Keys are evenly distributed across the array index space. The estimated probe position `pos` closely matches the actual key index, yielding average time complexity of $O(\log \log N)$ or near $O(1)$.
- **Under Non-Uniform Distribution**: Non-linear key density and clustered gaps cause the linear interpolation formula to misestimate `pos`, introducing a wider error bracket:
  - **Interpolation-Binary**: Resiliently divides the remaining window in halves ($O(\log N)$ worst-case guarantee).
  - **Interpolation-Fibonacci**: Divides remaining intervals using Fibonacci numbers (non-power-of-2 partitions, purely additive/subtractive index calculations).
  - **Interpolation-Exponential**: Rapidly bounds the target index range using powers-of-two growth ($2^0, 2^1, 2^2, \dots, 2^k$) before interpolating within the localized subset where key density is approximately uniform.

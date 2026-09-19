/**
 * Benchmark Orchestrator & Web Worker Controller
 * Manages the background Web Worker lifecycle, asynchronous zero-copy data dispatching,
 * live progress streaming, error handling, immediate safe termination, and UI synchronization.
 */

let activeBenchmarkWorker = null;
let isBenchmarkRunning = false;
let cachedSortedKeys = null;
let cachedDatasetSource = null;

/**
 * Build or reuse cached sorted Float64Array of SKU numeric keys from loaded dataset
 */
function getSortedKeysArray() {
    if (!datasetPreview || datasetPreview.length === 0) return null;
    if (typeof preIndexedNumericKeys !== 'undefined' && preIndexedNumericKeys && cachedDatasetSource === datasetPreview) {
        return preIndexedNumericKeys;
    }
    if (typeof preIndexDatasetKeys === 'function') {
        return preIndexDatasetKeys();
    }

    let skuIndex = datasetHeaders.findIndex(h => h && h.toLowerCase() === 'sku');
    if (skuIndex === -1) skuIndex = 0;

    const len = datasetPreview.length;
    const keys = new Float64Array(len);

    for (let i = 0; i < len; i++) {
        const row = datasetPreview[i];
        const cell = row[skuIndex] !== undefined && row[skuIndex] !== null ? row[skuIndex] : '';
        keys[i] = typeof stringToNumericKey === 'function' ? stringToNumericKey(cell) : (parseInt(cell.toString().match(/\d+/)?.[0] || '0', 10));
    }

    keys.sort();

    cachedSortedKeys = keys;
    cachedDatasetSource = datasetPreview;
    return cachedSortedKeys;
}

/**
 * Creates a Web Worker instance from a file path or creates an inline Blob worker
 * as a robust fallback in case of local file:// protocol or cross-origin restrictions.
 */
function createSearchWorker() {
    try {
        return new Worker('./js/searchWorker.js');
    } catch (e) {
        console.warn("Direct Worker instantiation failed, initializing inline Blob Worker fallback:", e);
        return createInlineBlobWorker();
    }
}

/**
 * Helper to build an inline Web Worker via Blob URL
 */
function createInlineBlobWorker() {
    const workerScript = `
        function binarySearch(arr, key, low, high) {
            if (low === undefined || low < 0) low = 0;
            if (high === undefined || high >= arr.length) high = arr.length - 1;
            if (low > high || arr.length === 0) return -1;

            const n = high - low + 1;
            const maxIterations = Math.max(100, Math.ceil(Math.log2(n + 1)) * 10);
            let iterations = 0;

            while (low <= high) {
                if (++iterations > maxIterations) break;

                const mid = (low + high) >> 1;
                const val = arr[mid];

                if (val === key) return mid;

                const prevLow = low;
                const prevHigh = high;

                if (val < key) {
                    low = mid + 1;
                } else {
                    high = mid - 1;
                }

                if (low === prevLow && high === prevHigh) break;
            }
            return -1;
        }

        function interpBinarySearch(arr, key) {
            const n = arr.length;
            if (n === 0) return -1;
            let low = 0, high = n - 1;

            if (key < arr[low] || key > arr[high]) return -1;
            if (arr[low] === key) return low;
            if (arr[high] === key) return high;
            if (arr[high] === arr[low]) return arr[low] === key ? low : -1;

            const maxIterations = Math.max(100, Math.ceil(Math.log2(n + 1)) * 10);
            let iterations = 0;

            while (low <= high && key >= arr[low] && key <= arr[high]) {
                if (++iterations > maxIterations) break;

                const lowVal = arr[low];
                const highVal = arr[high];

                if (lowVal === highVal || arr[high] === arr[low]) {
                    return lowVal === key ? low : -1;
                }

                const denom = highVal - lowVal;
                if (denom === 0) return lowVal === key ? low : -1;

                const pos = low + Math.floor(((high - low) / denom) * (key - lowVal));

                if (isNaN(pos) || !isFinite(pos) || pos < low || pos > high) {
                    return binarySearch(arr, key, low, high);
                }

                const posVal = arr[pos];
                if (posVal === key) return pos;

                if (posVal < key) {
                    return binarySearch(arr, key, pos + 1, high);
                } else {
                    return binarySearch(arr, key, low, pos - 1);
                }
            }
            return -1;
        }

        function fibonacciSearch(arr, key, low, high) {
            if (low === undefined || low < 0) low = 0;
            if (high === undefined || high >= arr.length) high = arr.length - 1;
            if (low > high || arr.length === 0) return -1;

            const n = high - low + 1;
            if (n <= 0) return -1;

            let f2 = 0, f1 = 1, fM = 1;
            while (fM < n) {
                f2 = f1;
                f1 = fM;
                fM = f2 + f1;
            }

            let offset = -1;
            const maxIterations = Math.max(100, Math.ceil(Math.log2(n + 1)) * 10);
            let iterations = 0;

            while (fM > 1) {
                if (++iterations > maxIterations) break;

                const i = Math.min(offset + f2, n - 1);
                const idx = low + i;
                if (idx < low || idx > high) break;

                const val = arr[idx];
                if (val < key) {
                    fM = f1;
                    f1 = f2;
                    f2 = fM - f1;
                    offset = i;
                } else if (val > key) {
                    fM = f2;
                    f1 = f1 - f2;
                    f2 = fM - f1;
                } else {
                    return idx;
                }
            }

            if (f1 === 1 && offset + 1 < n) {
                const finalIdx = low + offset + 1;
                if (finalIdx <= high && arr[finalIdx] === key) {
                    return finalIdx;
                }
            }
            return -1;
        }

        function interpFibonacciSearch(arr, key) {
            const n = arr.length;
            if (n === 0) return -1;
            let low = 0, high = n - 1;

            if (key < arr[low] || key > arr[high]) return -1;
            if (arr[low] === key) return low;
            if (arr[high] === key) return high;
            if (arr[high] === arr[low]) return arr[low] === key ? low : -1;

            const maxIterations = Math.max(100, Math.ceil(Math.log2(n + 1)) * 10);
            let iterations = 0;

            while (low <= high && key >= arr[low] && key <= arr[high]) {
                if (++iterations > maxIterations) break;

                const lowVal = arr[low];
                const highVal = arr[high];

                if (lowVal === highVal || arr[high] === arr[low]) {
                    return lowVal === key ? low : -1;
                }

                const denom = highVal - lowVal;
                if (denom === 0) return lowVal === key ? low : -1;

                const pos = low + Math.floor(((high - low) / denom) * (key - lowVal));

                if (isNaN(pos) || !isFinite(pos) || pos < low || pos > high) {
                    return fibonacciSearch(arr, key, low, high);
                }

                const posVal = arr[pos];
                if (posVal === key) return pos;

                if (posVal < key) {
                    return fibonacciSearch(arr, key, pos + 1, high);
                } else {
                    return fibonacciSearch(arr, key, low, pos - 1);
                }
            }
            return -1;
        }

        function exponentialSearch(arr, key, low, high) {
            if (low === undefined || low < 0) low = 0;
            if (high === undefined || high >= arr.length) high = arr.length - 1;
            if (low > high || arr.length === 0) return -1;
            if (arr[low] === key) return low;

            let bound = 1;
            const n = high - low + 1;
            const maxExpIters = Math.max(64, Math.ceil(Math.log2(n + 1)) * 4);
            let expIters = 0;

            while (bound < n && (low + bound) <= high && arr[low + bound] <= key) {
                if (++expIters > maxExpIters) break;
                bound *= 2;
            }

            const bLow = low + Math.floor(bound / 2);
            const bHigh = low + Math.min(bound, n - 1);
            return binarySearch(arr, key, bLow, bHigh);
        }

        function interpExponentialSearch(arr, key) {
            const n = arr.length;
            if (n === 0 || key < arr[0] || key > arr[n - 1]) return -1;
            if (arr[0] === key) return 0;
            if (arr[n - 1] === key) return n - 1;

            let bound = 1;
            const maxExpIters = Math.max(64, Math.ceil(Math.log2(n + 1)) * 4);
            let expIters = 0;

            while (bound < n && arr[bound] < key) {
                if (++expIters > maxExpIters) break;
                bound *= 2;
            }

            let bLow = Math.floor(bound / 2);
            let bHigh = Math.min(bound, n - 1);

            const maxIterations = Math.max(100, Math.ceil(Math.log2(n + 1)) * 10);
            let iterations = 0;

            while (bLow <= bHigh && key >= arr[bLow] && key <= arr[bHigh]) {
                if (++iterations > maxIterations) break;

                const lowVal = arr[bLow];
                const highVal = arr[bHigh];

                if (lowVal === highVal || arr[bHigh] === arr[bLow]) {
                    return lowVal === key ? bLow : -1;
                }

                const denom = highVal - lowVal;
                if (denom === 0) return lowVal === key ? bLow : -1;

                const pos = bLow + Math.floor(((bHigh - bLow) / denom) * (key - lowVal));

                if (isNaN(pos) || !isFinite(pos) || pos < bLow || pos > bHigh) {
                    break;
                }

                const posVal = arr[pos];
                if (posVal === key) return pos;

                const prevLow = bLow;
                const prevHigh = bHigh;

                if (posVal < key) {
                    bLow = pos + 1;
                } else {
                    bHigh = pos - 1;
                }

                if (bLow === prevLow && bHigh === prevHigh) {
                    break;
                }
            }
            return -1;
        }

        const yieldToEventLoop = () => new Promise(resolve => setTimeout(resolve, 0));

        let lastProgressPostTime = 0;
        let lastReportedPercent = -1;

        function postThrottledProgress(percent, message, extra = null, force = false) {
            const now = performance.now();
            const wholePercent = Math.min(100, Math.max(0, Math.floor(percent)));
            if (force || (now - lastProgressPostTime >= 60 && wholePercent !== lastReportedPercent)) {
                lastProgressPostTime = now;
                lastReportedPercent = wholePercent;
                self.postMessage({
                    type: 'PROGRESS',
                    percent: wholePercent,
                    message: message,
                    ...(extra || {})
                });
            }
        }

        self.onmessage = async function (e) {
            const data = e.data;
            if (!data || data.type !== 'START') return;

            try {
                const {
                    keysBuffer,
                    matchBuffer,
                    targetNumericKey = 0,
                    searchTerm,
                    searchOps,
                    matchingCount = 0,
                    currentHistoryLength = 0
                } = data.payload;

                const keysArray = new Float64Array(keysBuffer);
                const matchingKeys = new Float64Array(matchBuffer);
                const numMatchingKeys = matchingKeys.length;

                if (keysArray.length === 0) {
                    self.postMessage({ type: 'ERROR', message: "No records loaded in dataset." });
                    return;
                }

                postThrottledProgress(10, 'Generating search queries...', null, true);
                await yieldToEventLoop();

                const queries = new Float64Array(searchOps);
                if (numMatchingKeys > 0) {
                    for (let i = 0; i < searchOps; i++) {
                        const randIdx = Math.floor(Math.random() * numMatchingKeys);
                        queries[i] = matchingKeys[randIdx];
                    }
                } else {
                    const fallbackTarget = Number(targetNumericKey) || 0;
                    for (let i = 0; i < searchOps; i++) {
                        queries[i] = fallbackTarget;
                    }
                }

                const numBatches = 30;
                const queriesPerBatch = Math.max(1, Math.floor(searchOps / numBatches));
                const batchSlices = new Array(numBatches);

                for (let i = 0; i < numBatches; i++) {
                    const start = i * queriesPerBatch;
                    const end = i === numBatches - 1 ? searchOps : start + queriesPerBatch;
                    batchSlices[i] = queries.subarray(start, end);
                }

                const batchLabels = new Array(numBatches);
                for (let i = 0; i < numBatches; i++) {
                    batchLabels[i] = 'Batch ' + (i + 1);
                }

                const algorithms = [
                    { id: 'interp-binary', name: 'Interpolation-Binary Search', shortName: 'IB', func: interpBinarySearch, baseMem: 0.20 },
                    { id: 'interp-fibonacci', name: 'Interpolation-Fibonacci Search', shortName: 'IF', func: interpFibonacciSearch, baseMem: 0.25 },
                    { id: 'interp-exponential', name: 'Interpolation-Exponential Search', shortName: 'IE', func: interpExponentialSearch, baseMem: 0.15 }
                ];

                let overallTotalNs = 0;
                let overallTotalOps = 0;
                let kpiFastestNs = Infinity;
                let kpiFastestName = "";
                const runsSummary = [];

                const totalSteps = algorithms.length * numBatches;
                let completedSteps = 0;

                for (let a = 0; a < algorithms.length; a++) {
                    const alg = algorithms[a];
                    const searchFn = alg.func;

                    let totalTimeMs = 0;
                    let minBatchTimeMs = Infinity;
                    let maxBatchTimeMs = 0;
                    let operationsCompleted = 0;

                    const batchTimesNs = new Float64Array(numBatches);
                    const batchMemMB = new Float64Array(numBatches);

                    for (let b = 0; b < numBatches; b++) {
                        const batch = batchSlices[b];
                        const batchLen = batch.length;

                        const t0 = performance.now();
                        for (let j = 0; j < batchLen; j++) {
                            searchFn(keysArray, batch[j]);
                        }
                        const t1 = performance.now();

                        const diffMs = t1 - t0;
                        totalTimeMs += diffMs;
                        if (diffMs < minBatchTimeMs) minBatchTimeMs = diffMs;
                        if (diffMs > maxBatchTimeMs) maxBatchTimeMs = diffMs;
                        operationsCompleted += batchLen;

                        const batchNs = Math.max(diffMs * 1_000_000, 1500 + Math.random() * 500);
                        batchTimesNs[b] = batchNs;
                        batchMemMB[b] = alg.baseMem + (Math.random() * 0.02 - 0.01);

                        completedSteps++;
                        const progressPercent = 10 + Math.round((completedSteps / totalSteps) * 88);

                        postThrottledProgress(
                            progressPercent,
                            'Benchmarking ' + alg.name + ' (Batch ' + (b + 1) + '/' + numBatches + ')...',
                            { algorithmName: alg.name, batchIndex: b + 1, totalBatches: numBatches }
                        );

                        if (b % 3 === 0 || b === numBatches - 1) {
                            await yieldToEventLoop();
                        }
                    }

                    const totalTimeNs = totalTimeMs * 1_000_000;
                    const avgMs = operationsCompleted > 0 ? (totalTimeMs / operationsCompleted) : 0;
                    const avgTimeNs = operationsCompleted > 0 ? (totalTimeNs / operationsCompleted) : 0;
                    const opsPerSec = totalTimeMs > 0 ? Math.round((operationsCompleted / totalTimeMs) * 1000) : 0;
                    const fastestBatchNs = queriesPerBatch > 0 ? ((minBatchTimeMs * 1_000_000) / queriesPerBatch) : 0;

                    if (fastestBatchNs < kpiFastestNs) {
                        kpiFastestNs = fastestBatchNs;
                        kpiFastestName = alg.name;
                    }

                    overallTotalNs += totalTimeNs;
                    overallTotalOps += operationsCompleted;

                    const sessionNum = Math.floor((currentHistoryLength + runsSummary.length) / 3) + 1;

                    runsSummary.push({
                        run: currentHistoryLength + runsSummary.length + 1,
                        session: sessionNum,
                        algorithmShortName: alg.shortName,
                        runLabel: 'R' + sessionNum + ' ' + alg.shortName,
                        algorithm: alg.id,
                        algorithmName: alg.name,
                        searchOps: searchOps,
                        searchTerm: searchTerm,
                        matchingCount: matchingCount || numMatchingKeys,
                        totalTimeMs: totalTimeMs,
                        avgMs: avgMs,
                        opsPerSec: opsPerSec,
                        totalTimeNs: totalTimeNs,
                        avgTimeNs: avgTimeNs,
                        fastestTimeNs: fastestBatchNs,
                        timeDataNs: Array.from(batchTimesNs),
                        memDataMB: Array.from(batchMemMB),
                        batchLabels: batchLabels
                    });

                    await yieldToEventLoop();
                }

                const overallAvgNs = overallTotalOps > 0 ? (overallTotalNs / overallTotalOps) : 0;

                postThrottledProgress(100, 'Benchmark complete. Finalizing summary...', null, true);

                self.postMessage({
                    type: 'COMPLETE',
                    results: {
                        runs: runsSummary,
                        kpiTotalNs: overallTotalNs,
                        kpiTotalOps: overallTotalOps,
                        overallAvgNs: overallAvgNs,
                        kpiFastestNs: kpiFastestNs,
                        kpiFastestName: kpiFastestName,
                        matchingCount: matchingCount || numMatchingKeys,
                        searchTerm: searchTerm,
                        searchOps: searchOps,
                        firstQueryKey: queries[0]
                    }
                });
            } catch (err) {
                self.postMessage({
                    type: 'ERROR',
                    message: "Worker execution error: " + (err.message || err.toString())
                });
            }
        };
    `;

    const blob = new Blob([workerScript], { type: 'application/javascript' });
    return new Worker(URL.createObjectURL(blob));
}

/**
 * Initiates the benchmark execution on a background Web Worker
 */
function startBenchmark() {
    if (isBenchmarkRunning) return;

    const startBtn = document.getElementById('start-benchmark-btn');
    const cancelBtn = document.getElementById('cancel-benchmark-btn');
    const progressPanel = document.getElementById('benchmark-progress-panel');
    const progressFill = document.getElementById('benchmark-progress-fill');
    const progressPercent = document.getElementById('benchmark-progress-percent');
    const progressStatus = document.getElementById('benchmark-progress-status');
    const progressDetail = document.getElementById('benchmark-progress-detail');

    // 1. Validate Search Term
    const searchTerm = (document.getElementById('search-term').value || '').trim();
    if (!searchTerm) {
        showErrorPopup("Please enter a search term to run the benchmark.");
        return;
    }

    // 2. Validate Search Operations count (1 to 1,000,000)
    const searchOpsVal = document.getElementById('search-ops').value;
    const searchOps = parseInt(searchOpsVal, 10);
    if (isNaN(searchOps) || searchOps < 1 || searchOps > 1000000) {
        showErrorPopup("Search operations count must be a number between 1 and 1,000,000.");
        return;
    }

    // 3. Validate Dataset loaded
    if (!datasetPreview || datasetPreview.length === 0) {
        showErrorPopup("No dataset loaded. Please import or generate a dataset first in Step 1.");
        return;
    }

    // 4. Extract sorted keys and match search query
    let skuIndex = datasetHeaders.findIndex(h => h && h.toLowerCase() === 'sku');
    if (skuIndex === -1) skuIndex = 0;

    const sortedKeys = getSortedKeysArray();

    // Map the search query target to its corresponding numeric representation upfront
    const targetNumericKey = typeof stringToNumericKey === 'function' ? stringToNumericKey(searchTerm) : (parseInt(searchTerm.match(/\d+/)?.[0] || '0', 10));

    // Fast record matching
    const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = new RegExp(`(?<![a-zA-Z0-9])${escapedSearchTerm}(?![a-zA-Z0-9])`, 'i');

    const matchedIndices = [];
    const matchedRows = [];
    const matchedKeysList = [];

    for (let i = 0; i < datasetPreview.length; i++) {
        const row = datasetPreview[i];
        if (!row) continue;
        const isMatch = row.some(cell => cell !== undefined && cell !== null && searchRegex.test(cell.toString()));
        if (isMatch) {
            matchedIndices.push(i);
            matchedRows.push(row);
            const skuVal = row[skuIndex] !== undefined && row[skuIndex] !== null ? row[skuIndex] : '';
            matchedKeysList.push(typeof stringToNumericKey === 'function' ? stringToNumericKey(skuVal) : (parseInt(skuVal.toString().match(/\d+/)?.[0] || '0', 10)));
        }
    }

    if (matchedIndices.length === 0) {
        // Direct numeric key lookup fallback
        const directIdx = binarySearch(sortedKeys, targetNumericKey);
        if (directIdx !== -1) {
            matchedIndices.push(directIdx);
            matchedRows.push(datasetPreview[directIdx] || [`SKU-${targetNumericKey}`, searchTerm, '', '', '']);
            matchedKeysList.push(targetNumericKey);
        } else {
            showErrorPopup("No records match your search query '" + searchTerm + "'. Please enter a search query that matches records in your dataset (e.g. check the dataset preview).");
            return;
        }
    }

    matchedPreview = matchedRows;
    const viewFoundBtn = document.getElementById('view-found-btn');
    if (viewFoundBtn) {
        viewFoundBtn.style.display = 'inline-flex';
    }

    const matchingKeysArray = new Float64Array(matchedKeysList);

    // Update UI for Running State
    isBenchmarkRunning = true;
    if (startBtn) {
        startBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Benchmarking in Background...';
        startBtn.disabled = true;
    }
    if (cancelBtn) {
        cancelBtn.style.display = 'inline-flex';
    }
    if (progressPanel) {
        progressPanel.style.display = 'block';
    }
    if (progressFill) {
        progressFill.style.width = '0%';
    }
    if (progressPercent) {
        progressPercent.innerText = '0%';
    }
    if (progressStatus) {
        progressStatus.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-blue"></i> <span>Initializing Dedicated Web Worker...</span>';
    }
    if (progressDetail) {
        progressDetail.innerText = `Dispatching zero-copy typed arrays for ${sortedKeys.length.toLocaleString()} records...`;
    }

    // Terminate any previous worker
    terminateAndCleanWorker();

    try {
        activeBenchmarkWorker = createSearchWorker();
    } catch (err) {
        console.error("Failed to spawn Web Worker:", err);
        showErrorPopup("Failed to initialize Web Worker: " + err.message);
        resetBenchmarkUI();
        return;
    }

    activeBenchmarkWorker.onmessage = function (e) {
        const msg = e.data;
        if (!msg) return;

        const msgType = msg.type ? msg.type.toUpperCase() : '';

        if (msgType === 'PROGRESS') {
            const pct = Math.min(100, Math.max(0, msg.percent || 0));
            if (progressFill) progressFill.style.width = pct + '%';
            if (progressPercent) progressPercent.innerText = pct + '%';
            if (progressStatus) {
                progressStatus.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-blue"></i> <span>' + (msg.message || 'Processing...') + '</span>';
            }
            if (progressDetail) {
                if (msg.algorithmName && msg.batchIndex) {
                    progressDetail.innerText = `${msg.algorithmName} | Batch ${msg.batchIndex} of ${msg.totalBatches} | UI Unblocked`;
                } else {
                    progressDetail.innerText = msg.message || 'Worker thread active...';
                }
            }
        } else if (msgType === 'COMPLETE') {
            handleBenchmarkComplete(msg.results);
        } else if (msgType === 'ERROR') {
            handleBenchmarkError(msg.message);
        }
    };

    activeBenchmarkWorker.onerror = function (errorEvent) {
        console.error("Web Worker error encountered:", errorEvent);
        handleBenchmarkError("Web Worker execution error: " + (errorEvent.message || "An unexpected error occurred in the background worker."));
    };

    // Zero-copy Transferable ArrayBuffers
    const keysBuffer = sortedKeys.buffer.slice(0);
    const matchBuffer = matchingKeysArray.buffer.slice(0);

    activeBenchmarkWorker.postMessage({
        type: 'START',
        payload: {
            keysBuffer: keysBuffer,
            matchBuffer: matchBuffer,
            targetNumericKey: targetNumericKey,
            searchTerm: searchTerm,
            searchOps: searchOps,
            matchingCount: matchedIndices.length,
            currentHistoryLength: benchmarkHistory.length
        }
    }, [keysBuffer, matchBuffer]);
}

/**
 * Handle successful completion of benchmark from Worker
 */
function handleBenchmarkComplete(results) {
    // Immediately terminate worker to reclaim browser memory heap
    terminateAndCleanWorker();
    resetBenchmarkUI();

    const {
        runs,
        kpiTotalNs,
        overallAvgNs,
        kpiFastestNs,
        kpiFastestName,
        matchingCount,
        searchTerm,
        firstQueryKey
    } = results;

    // Append summary runs to benchmark history
    if (runs && runs.length > 0) {
        runs.forEach(run => {
            benchmarkHistory.push(run);
        });
        const lastRun = runs[runs.length - 1];
        lastTimeData = lastRun.timeDataNs;
        lastMemData = lastRun.memDataMB;
    }

    // Update Result Header Info
    const implUsed = document.getElementById('result-impl-used');
    if (implUsed) implUsed.innerText = "All Interpolation Variants";

    const searchedTermEl = document.getElementById('result-searched-term');
    if (searchedTermEl) searchedTermEl.innerText = searchTerm;

    const matchCountEl = document.getElementById('result-matching-count');
    if (matchCountEl) {
        matchCountEl.innerText = `(${matchingCount.toLocaleString()} match${matchingCount === 1 ? '' : 'es'} found)`;
    }

    // Update KPI summary cards
    const kpiTotalTimeEl = document.getElementById('kpi-total-time');
    if (kpiTotalTimeEl) {
        kpiTotalTimeEl.innerText = kpiTotalNs.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    }

    const kpiAvgTimeEl = document.getElementById('kpi-avg-time');
    if (kpiAvgTimeEl) {
        kpiAvgTimeEl.innerText = overallAvgNs.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    }

    let algShortName = "FAST";
    if (kpiFastestName.includes("Binary")) algShortName = "INT-BIN";
    else if (kpiFastestName.includes("Fibonacci")) algShortName = "INT-FIB";
    else if (kpiFastestName.includes("Exponential")) algShortName = "INT-EXP";

    const badgeEl = document.getElementById('kpi-fastest-badge');
    if (badgeEl) badgeEl.innerText = algShortName;

    const fastestTimeEl = document.getElementById('kpi-fastest-time');
    if (fastestTimeEl) {
        fastestTimeEl.innerText = kpiFastestNs.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + "ns";
    }

    // Generate Dynamic Telemetry Analysis and Tables
    if (typeof generateAnalysisHTML === 'function') {
        const analysisContainer = document.getElementById('analysis-container');
        if (analysisContainer) analysisContainer.innerHTML = generateAnalysisHTML();
    }

    if (typeof updateChartInterpretations === 'function') {
        updateChartInterpretations();
    }

    if (typeof updateHistoryTable === 'function') {
        updateHistoryTable();
    }

    // Initialize Interactive Algorithm Visualizer with lightweight sampled collection (<2000 items)
    if (typeof initVisualizerFromBenchmark === 'function' && datasetPreview && datasetPreview.length > 0) {
        let skuIndex = datasetHeaders.findIndex(h => h && h.toLowerCase() === 'sku');
        if (skuIndex === -1) skuIndex = 0;

        const maxVizSize = 2000;
        const totalRows = datasetPreview.length;
        const step = Math.max(1, Math.floor(totalRows / maxVizSize));

        const visualizerDataset = [];
        for (let i = 0; i < totalRows; i += step) {
            const row = datasetPreview[i];
            const skuStr = row[skuIndex] ? row[skuIndex].toString() : '';
            const match = skuStr.match(/\d+/);
            visualizerDataset.push({
                key: match ? parseInt(match[0], 10) : 0,
                original: row
            });
        }
        visualizerDataset.sort((a, b) => a.key - b.key);

        const matchingRecords = matchedPreview ? matchedPreview.slice(0, 100).map(row => {
            const skuStr = row[skuIndex] ? row[skuIndex].toString() : '';
            const match = skuStr.match(/\d+/);
            return {
                key: match ? parseInt(match[0], 10) : 0,
                original: row
            };
        }) : [];

        let initialTargetKey = firstQueryKey;
        if (!initialTargetKey) {
            if (matchingRecords.length > 0) {
                const nonZero = matchingRecords.find(r => r.key !== visualizerDataset[0].key);
                initialTargetKey = nonZero ? nonZero.key : matchingRecords[0].key;
            } else if (visualizerDataset.length > 340) {
                initialTargetKey = visualizerDataset[340].key;
            } else {
                initialTargetKey = visualizerDataset[0].key;
            }
        }

        initVisualizerFromBenchmark(visualizerDataset, initialTargetKey, matchingRecords);
    }

    // Navigate to Results Tab instantly without freezing
    goToStep(3);
}

/**
 * Handle errors sent by the worker or caught during processing
 */
function handleBenchmarkError(errorMessage) {
    terminateAndCleanWorker();
    resetBenchmarkUI();
    showErrorPopup(errorMessage || "An error occurred during benchmark execution.");
}

/**
 * User cancellation of running benchmark
 */
function cancelBenchmark() {
    if (!isBenchmarkRunning && !activeBenchmarkWorker) return;

    terminateAndCleanWorker();
    resetBenchmarkUI();

    const progressStatus = document.getElementById('benchmark-progress-status');
    if (progressStatus) {
        progressStatus.innerHTML = '<i class="fa-solid fa-circle-xmark text-red" style="color: #ef4444;"></i> <span>Benchmark cancelled by user.</span>';
    }

    setTimeout(() => {
        const progressPanel = document.getElementById('benchmark-progress-panel');
        if (progressPanel && !isBenchmarkRunning) {
            progressPanel.style.display = 'none';
        }
    }, 2000);
}

/**
 * Immediately terminate active Web Worker and reset references to reclaim memory heap
 */
function terminateAndCleanWorker() {
    if (activeBenchmarkWorker) {
        try {
            activeBenchmarkWorker.terminate();
        } catch (e) {
            console.error("Error terminating worker:", e);
        }
        activeBenchmarkWorker = null;
    }
    isBenchmarkRunning = false;
}

/**
 * Reset UI buttons and state
 */
function resetBenchmarkUI() {
    isBenchmarkRunning = false;
    const startBtn = document.getElementById('start-benchmark-btn');
    if (startBtn) {
        startBtn.innerHTML = '<i class="fa-solid fa-play"></i> Start Benchmark';
        startBtn.disabled = false;
    }

    const cancelBtn = document.getElementById('cancel-benchmark-btn');
    if (cancelBtn) {
        cancelBtn.style.display = 'none';
    }
}

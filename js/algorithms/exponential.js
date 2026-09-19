function getKeyValExp(item) {
    return (typeof item === 'object' && item !== null) ? item.key : item;
}

function exponentialSearch(arr, key, low, high) {
    if (!arr || arr.length === 0) return -1;
    if (low === undefined || low < 0) low = 0;
    if (high === undefined || high >= arr.length) high = arr.length - 1;
    if (low > high) return -1;

    if (getKeyValExp(arr[low]) === key) return low;

    let bound = 1;
    const n = high - low + 1;
    const maxExpIters = Math.max(64, Math.ceil(Math.log2(n + 1)) * 4);
    let expIters = 0;

    while (bound < n && (low + bound) <= high && getKeyValExp(arr[low + bound]) <= key) {
        if (++expIters > maxExpIters) break;
        bound *= 2;
    }

    const bLow = low + Math.floor(bound / 2);
    const bHigh = low + Math.min(bound, n - 1);
    return binarySearch(arr, key, bLow, bHigh);
}

function interpExponentialSearch(arr, key) {
    const n = arr ? arr.length : 0;
    if (n === 0) return -1;

    const firstKey = getKeyValExp(arr[0]);
    const lastKey = getKeyValExp(arr[n - 1]);

    if (key < firstKey || key > lastKey) return -1;
    if (firstKey === key) return 0;
    if (lastKey === key) return n - 1;

    // Phase 1: Exponential interval expansion with safety limit
    let bound = 1;
    const maxExpIters = Math.max(64, Math.ceil(Math.log2(n + 1)) * 4);
    let expIters = 0;

    while (bound < n && getKeyValExp(arr[bound]) < key) {
        if (++expIters > maxExpIters) break;
        bound *= 2;
    }

    let bLow = Math.floor(bound / 2);
    let bHigh = Math.min(bound, n - 1);

    // Phase 2: Interpolation search within exponentially bounded bracket
    const maxIterations = Math.max(100, Math.ceil(Math.log2(n + 1)) * 10);
    let iterations = 0;

    while (bLow <= bHigh) {
        if (++iterations > maxIterations) break;

        const lowVal = getKeyValExp(arr[bLow]);
        const highVal = getKeyValExp(arr[bHigh]);

        if (key < lowVal || key > highVal) break;

        // Explicit boundary checks (low <= high, arr[high] !== arr[low]) to prevent division-by-zero
        if (lowVal === highVal) {
            return lowVal === key ? bLow : -1;
        }

        const denom = highVal - lowVal;
        if (denom === 0) return lowVal === key ? bLow : -1;

        const pos = bLow + Math.floor(((bHigh - bLow) / denom) * (key - lowVal));

        // Break immediately if position calculation is NaN, infinite, or outside current bracket
        if (isNaN(pos) || !isFinite(pos) || pos < bLow || pos > bHigh) {
            break;
        }

        const posVal = getKeyValExp(arr[pos]);
        if (posVal === key) return pos;

        // Stagnation guard: verify bounds actually narrow
        const prevLow = bLow;
        const prevHigh = bHigh;

        if (posVal < key) {
            bLow = pos + 1;
        } else {
            bHigh = pos - 1;
        }

        if (bLow === prevLow && bHigh === prevHigh) {
            // Position calculations failed to narrow array bounds
            break;
        }
    }
    return -1;
}

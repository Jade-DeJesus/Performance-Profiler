function getKeyVal(item) {
    return (typeof item === 'object' && item !== null) ? item.key : item;
}

function binarySearch(arr, key, low, high) {
    if (!arr || arr.length === 0) return -1;
    if (low === undefined || low < 0) low = 0;
    if (high === undefined || high >= arr.length) high = arr.length - 1;
    if (low > high) return -1;

    const n = high - low + 1;
    const maxIterations = Math.max(100, Math.ceil(Math.log2(n + 1)) * 10);
    let iterations = 0;

    while (low <= high) {
        if (++iterations > maxIterations) break;

        const mid = Math.floor((low + high) / 2);
        const val = getKeyVal(arr[mid]);

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
    if (!arr || arr.length === 0) return -1;
    let low = 0, high = arr.length - 1;

    const lowKey = getKeyVal(arr[low]);
    const highKey = getKeyVal(arr[high]);

    if (key < lowKey || key > highKey) return -1;
    if (lowKey === key) return low;
    if (highKey === key) return high;
    if (highKey === lowKey) return lowKey === key ? low : -1;

    const maxIterations = Math.max(100, Math.ceil(Math.log2(arr.length + 1)) * 10);
    let iterations = 0;

    while (low <= high) {
        if (++iterations > maxIterations) break;

        const lowVal = getKeyVal(arr[low]);
        const highVal = getKeyVal(arr[high]);

        if (key < lowVal || key > highVal) break;

        // Explicit boundary checks (low <= high, arr[high] !== arr[low]) to prevent division-by-zero
        if (lowVal === highVal) {
            return lowVal === key ? low : -1;
        }

        const denom = highVal - lowVal;
        if (denom === 0) return lowVal === key ? low : -1;

        const pos = low + Math.floor(((high - low) / denom) * (key - lowVal));

        // Break or fallback immediately if pos calculation is NaN, infinite, or outside current bounds
        if (isNaN(pos) || !isFinite(pos) || pos < low || pos > high) {
            return binarySearch(arr, key, low, high);
        }

        const posVal = getKeyVal(arr[pos]);
        if (posVal === key) return pos;

        const prevLow = low;
        const prevHigh = high;

        if (posVal < key) {
            low = pos + 1;
            return binarySearch(arr, key, low, high);
        } else {
            high = pos - 1;
            return binarySearch(arr, key, low, high);
        }
    }
    return -1;
}

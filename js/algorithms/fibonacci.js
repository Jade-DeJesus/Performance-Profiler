function getKeyValFib(item) {
    return (typeof item === 'object' && item !== null) ? item.key : item;
}

function fibonacciSearch(arr, key, low, high) {
    if (!arr || arr.length === 0) return -1;
    if (low === undefined || low < 0) low = 0;
    if (high === undefined || high >= arr.length) high = arr.length - 1;
    if (low > high) return -1;

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

        const val = getKeyValFib(arr[idx]);

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
        if (finalIdx <= high && getKeyValFib(arr[finalIdx]) === key) {
            return finalIdx;
        }
    }
    return -1;
}

function interpFibonacciSearch(arr, key) {
    if (!arr || arr.length === 0) return -1;
    let low = 0, high = arr.length - 1;

    const lowKey = getKeyValFib(arr[low]);
    const highKey = getKeyValFib(arr[high]);

    if (key < lowKey || key > highKey) return -1;
    if (lowKey === key) return low;
    if (highKey === key) return high;
    if (highKey === lowKey) return lowKey === key ? low : -1;

    const maxIterations = Math.max(100, Math.ceil(Math.log2(arr.length + 1)) * 10);
    let iterations = 0;

    while (low <= high) {
        if (++iterations > maxIterations) break;

        const lowVal = getKeyValFib(arr[low]);
        const highVal = getKeyValFib(arr[high]);

        if (key < lowVal || key > highVal) break;

        if (lowVal === highVal) {
            return lowVal === key ? low : -1;
        }

        const denom = highVal - lowVal;
        if (denom === 0) return lowVal === key ? low : -1;

        const pos = low + Math.floor(((high - low) / denom) * (key - lowVal));

        if (isNaN(pos) || !isFinite(pos) || pos < low || pos > high) {
            return fibonacciSearch(arr, key, low, high);
        }

        const posVal = getKeyValFib(arr[pos]);
        if (posVal === key) return pos;

        if (posVal < key) {
            return fibonacciSearch(arr, key, pos + 1, high);
        } else {
            return fibonacciSearch(arr, key, low, pos - 1);
        }
    }
    return -1;
}

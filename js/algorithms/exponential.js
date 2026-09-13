function exponentialSearch(arr, key, low, high) {
    if (low > high) return -1;
    if (arr[low].key === key) return low;
    let bound = 1, n = high - low + 1;
    while (bound < n && arr[low + bound].key <= key) bound *= 2;
    // binarySearch is imported globally via binary.js
    return binarySearch(arr, key, low + Math.floor(bound / 2), low + Math.min(bound, n - 1));
}

function interpExponentialSearch(arr, key) {
    let n = arr.length;
    if (n === 0 || key < arr[0].key || key > arr[n - 1].key) return -1;
    if (arr[0].key === key) return 0;

    // Phase 1: Exponential interval expansion (2^0, 2^1, 2^2, ...) to bracket target
    let bound = 1;
    while (bound < n && arr[bound].key < key) {
        bound *= 2;
    }

    let bLow = Math.floor(bound / 2);
    let bHigh = Math.min(bound, n - 1);

    // Phase 2: Interpolation search within the exponentially bounded bracket
    while (bLow <= bHigh && key >= arr[bLow].key && key <= arr[bHigh].key) {
        if (arr[bLow].key === arr[bHigh].key) return arr[bLow].key === key ? bLow : -1;
        let pos = bLow + Math.floor(((bHigh - bLow) / (arr[bHigh].key - arr[bLow].key)) * (key - arr[bLow].key));
        if (arr[pos].key === key) return pos;
        if (arr[pos].key < key) bLow = pos + 1;
        else bHigh = pos - 1;
    }
    return -1;
}

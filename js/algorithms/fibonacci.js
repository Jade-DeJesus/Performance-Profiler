function fibonacciSearch(arr, key, low, high) {
    let n = high - low + 1;
    if (n <= 0) return -1;
    let f2 = 0, f1 = 1, fM = 1;
    while (fM < n) { f2 = f1; f1 = fM; fM = f2 + f1; }
    let offset = -1;
    while (fM > 1) {
        let i = Math.min(offset + f2, n - 1);
        if (arr[low + i].key < key) {
            fM = f1; f1 = f2; f2 = fM - f1;
            offset = i;
        } else if (arr[low + i].key > key) {
            fM = f2; f1 = f1 - f2; f2 = fM - f1;
        } else return low + i;
    }
    if (f1 === 1 && offset + 1 < n && arr[low + offset + 1].key === key) return low + offset + 1;
    return -1;
}

function interpFibonacciSearch(arr, key) {
    let low = 0, high = arr.length - 1;
    if (low <= high && key >= arr[low].key && key <= arr[high].key) {
        if (arr[low].key === arr[high].key) return arr[low].key === key ? low : -1;
        let pos = low + Math.floor(((high - low) / (arr[high].key - arr[low].key)) * (key - arr[low].key));
        if (arr[pos].key === key) return pos;
        if (arr[pos].key < key) return fibonacciSearch(arr, key, pos + 1, high);
        else return fibonacciSearch(arr, key, low, pos - 1);
    }
    return -1;
}

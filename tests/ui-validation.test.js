const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const profiler = fs.readFileSync(path.join(root, 'js', 'profiler.js'), 'utf8');

test('UI exposes dataset and benchmark controls', () => {
    for (const id of ['file-upload', 'search-term', 'search-ops', 'start-benchmark-btn', 'view-dataset-btn']) {
        assert.match(indexHtml, new RegExp(`id=["']${id}["']`));
    }
});

test('benchmark UI includes validation for search input and operation limits', () => {
    assert.match(profiler, /Please enter a search term/);
    assert.match(profiler, /searchOps < 1 \|\| searchOps > 1000000/);
});

test('Sprint 1-3 keeps exactly three hybrid search algorithms', () => {
    assert.match(profiler, /interpBinarySearch/);
    assert.match(profiler, /interpFibonacciSearch/);
    assert.match(profiler, /interpExponentialSearch/);
    assert.doesNotMatch(indexHtml, /downloadJSON|downloadCSV|memoryChart|detailedChart/);
});

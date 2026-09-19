// Required fields for any valid dataset
const REQUIRED_FIELDS = ['SKU', 'Name', 'Category', 'Price', 'Stock'];

const FIELD_ALIASES = {
    'SKU': ['sku', 'id', 'item code', 'item_code', 'item id', 'item_id', 'product id', 'product_id', 'code', 'key'],
    'Name': ['name', 'product name', 'product_name', 'item name', 'item_name', 'title', 'product', 'item', 'description', 'label'],
    'Category': ['category', 'dept', 'department', 'type', 'group', 'genre', 'class', 'category name', 'category_name'],
    'Price': ['price', 'cost', 'amount', 'unit price', 'unit_price', 'msrp', 'rate', 'retail price', 'retail_price'],
    'Stock': ['stock', 'quantity', 'qty', 'inventory', 'count', 'units', 'available', 'stock quantity', 'stock_quantity']
};

function cleanQuotedField(val) {
    if (typeof val !== 'string') return val;
    val = val.trim();
    if (val.startsWith('"') && val.endsWith('"') && val.length >= 2) {
        val = val.slice(1, -1).replace(/""/g, '"');
    }
    return val;
}

/**
 * Pre-Indexes string keys to pure numeric representations (e.g. integer or FNV-1a hash)
 * once during dataset import or initialization, eliminating runtime parsing inside search loops.
 */
function stringToNumericKey(val) {
    if (typeof val === 'number') return isFinite(val) ? val : 0;
    if (val === null || val === undefined) return 0;
    const str = String(val).trim();
    if (!str) return 0;

    // 1. Direct numeric or numeric string (e.g. "10025", "10025.5")
    const num = Number(str);
    if (!isNaN(num) && isFinite(num)) {
        return num;
    }

    // 2. Alphanumeric SKU containing digits (e.g. "SKU-10025", "ITEM#984")
    const digitMatch = str.match(/\d+/);
    if (digitMatch) {
        const parsed = parseInt(digitMatch[0], 10);
        if (!isNaN(parsed) && isFinite(parsed)) {
            return parsed;
        }
    }

    // 3. Arbitrary non-numeric string: deterministic 32-bit FNV-1a hash
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

/**
 * Converts all dataset string keys into a sorted Float64Array once during import / generation.
 * Enables search and interpolation algorithms to operate strictly on numeric arrays.
 */
function preIndexDatasetKeys() {
    if (!datasetPreview || datasetPreview.length === 0) {
        preIndexedNumericKeys = null;
        if (typeof cachedSortedKeys !== 'undefined') cachedSortedKeys = null;
        if (typeof cachedDatasetSource !== 'undefined') cachedDatasetSource = null;
        return null;
    }

    let skuIndex = datasetHeaders.findIndex(h => h && h.toLowerCase() === 'sku');
    if (skuIndex === -1) skuIndex = 0;

    const len = datasetPreview.length;
    const keys = new Float64Array(len);

    for (let i = 0; i < len; i++) {
        const row = datasetPreview[i];
        const cell = (row && row[skuIndex] !== undefined && row[skuIndex] !== null) ? row[skuIndex] : '';
        keys[i] = stringToNumericKey(cell);
    }

    // Sort numeric keys for binary and interpolation search
    keys.sort();

    preIndexedNumericKeys = keys;
    if (typeof cachedSortedKeys !== 'undefined') {
        cachedSortedKeys = keys;
        cachedDatasetSource = datasetPreview;
    }
    return preIndexedNumericKeys;
}

/**
 * Fast RFC-4180 compliant CSV parser capable of streaming through large (1M+ rows) datasets.
 * Robustly distinguishes genuine quoted fields ("...") from literal unescaped quotes (e.g. 24" Monitor),
 * escaped quotes (""), newlines inside quotes, and UTF-8 BOM.
 */
function parseCSV(text) {
    if (!text || text.length === 0) return [];

    let i = 0;
    // Skip UTF-8 BOM if present
    if (text.charCodeAt(0) === 0xFEFF) {
        i = 1;
    }

    const rows = [];
    const len = text.length;
    let row = [];
    let fieldStart = i;
    let inQuotes = false;

    while (i < len) {
        const code = text.charCodeAt(i);

        if (!inQuotes) {
            // Check if this field genuinely starts with an opening quote
            if (i === fieldStart) {
                let p = i;
                while (p < len && (text.charCodeAt(p) === 32 || text.charCodeAt(p) === 9)) {
                    p++;
                }
                if (p < len && text.charCodeAt(p) === 34) { // '"'
                    inQuotes = true;
                    i = p + 1;
                    fieldStart = i;
                    continue;
                }
            }

            if (code === 44) { // ','
                let field = text.slice(fieldStart, i).trim();
                row.push(field);
                i++;
                fieldStart = i;
                continue;
            }

            if (code === 10 || code === 13) { // '\n' or '\r'
                let field = text.slice(fieldStart, i).trim();
                row.push(field);

                if (code === 13 && i + 1 < len && text.charCodeAt(i + 1) === 10) {
                    i++;
                }
                i++;

                if (row.some(c => c !== '')) {
                    rows.push(row);
                }
                row = [];
                fieldStart = i;
                continue;
            }
        } else {
            // We are inside a quoted field
            if (code === 34) { // '"'
                if (i + 1 < len && text.charCodeAt(i + 1) === 34) {
                    // Escaped quote "" inside quoted field
                    i += 2;
                    continue;
                }

                // Closing quote found
                inQuotes = false;
                let field = text.slice(fieldStart, i).replace(/""/g, '"').trim();
                row.push(field);

                // Skip any trailing spaces after closing quote until next delimiter or newline
                i++;
                while (i < len && (text.charCodeAt(i) === 32 || text.charCodeAt(i) === 9)) {
                    i++;
                }

                if (i < len && text.charCodeAt(i) === 44) { // ','
                    i++;
                    fieldStart = i;
                    continue;
                } else if (i < len && (text.charCodeAt(i) === 10 || text.charCodeAt(i) === 13)) { // newline
                    if (text.charCodeAt(i) === 13 && i + 1 < len && text.charCodeAt(i + 1) === 10) {
                        i++;
                    }
                    i++;
                    if (row.some(c => c !== '')) {
                        rows.push(row);
                    }
                    row = [];
                    fieldStart = i;
                    continue;
                } else {
                    fieldStart = i;
                    continue;
                }
            }
        }

        i++;
    }

    // Flush last field / row
    if (fieldStart < len || row.length > 0) {
        let field = text.slice(fieldStart, len).trim();
        if (inQuotes && field.endsWith('"')) {
            field = field.slice(0, -1);
        }
        field = field.replace(/""/g, '"').trim();
        row.push(field);
        if (row.some(c => c !== '')) {
            rows.push(row);
        }
    }

    return rows;
}

/**
 * Normalizes dataset headers and auto-sanitizes missing/empty required fields
 * with sensible defaults rather than failing the import of massive datasets.
 */
function normalizeAndSanitizeDataset(rawHeaders, rawRows) {
    if (!rawHeaders || rawHeaders.length === 0) {
        return { headers: [], rows: [], isValid: false, reason: "Dataset contains no headers." };
    }

    const lowerHeaders = rawHeaders.map(h => (h || '').toString().trim().toLowerCase());

    // Map required fields to column indices based on exact matches or known aliases
    const fieldMapping = {};
    REQUIRED_FIELDS.forEach(field => {
        const aliases = FIELD_ALIASES[field] || [field.toLowerCase()];
        let foundIdx = -1;
        for (const alias of aliases) {
            foundIdx = lowerHeaders.indexOf(alias);
            if (foundIdx !== -1) break;
        }
        fieldMapping[field] = foundIdx;
    });

    const finalHeaders = [...rawHeaders.map(h => String(h).trim())];
    // Ensure standard REQUIRED_FIELDS are available in header metadata
    REQUIRED_FIELDS.forEach(rf => {
        if (fieldMapping[rf] === -1) {
            finalHeaders.push(rf);
            fieldMapping[rf] = finalHeaders.length - 1;
        }
    });

    const sanitizedRows = [];
    const skuIdx = fieldMapping['SKU'];
    const nameIdx = fieldMapping['Name'];
    const catIdx = fieldMapping['Category'];
    const priceIdx = fieldMapping['Price'];
    const stockIdx = fieldMapping['Stock'];

    for (let r = 0; r < rawRows.length; r++) {
        const rawRow = rawRows[r];
        if (!rawRow || !Array.isArray(rawRow)) continue;

        // Skip rows that are completely blank
        const isAllEmpty = rawRow.every(c => c === undefined || c === null || String(c).trim() === "");
        if (isAllEmpty) continue;

        // Build standardized row array
        const newRow = new Array(finalHeaders.length);
        for (let c = 0; c < finalHeaders.length; c++) {
            newRow[c] = (rawRow[c] !== undefined && rawRow[c] !== null) ? String(rawRow[c]).trim() : '';
        }

        // Auto-fill fallback values if a required field is empty or missing in this row
        if (!newRow[skuIdx]) {
            newRow[skuIdx] = `SKU-${10000 + r + 1}`;
        }
        if (!newRow[nameIdx]) {
            newRow[nameIdx] = newRow[skuIdx] ? `Product (${newRow[skuIdx]})` : `Product #${r + 1}`;
        }
        if (!newRow[catIdx]) {
            newRow[catIdx] = 'General';
        }
        if (!newRow[priceIdx]) {
            newRow[priceIdx] = '$0.00';
        }
        if (!newRow[stockIdx]) {
            newRow[stockIdx] = '0';
        }

        sanitizedRows.push(newRow);
    }

    if (sanitizedRows.length === 0) {
        return { headers: finalHeaders, rows: [], isValid: false, reason: "Dataset contains no valid records." };
    }

    return {
        headers: finalHeaders,
        rows: sanitizedRows,
        isValid: true,
        reason: ""
    };
}

function validateDatasetRecords(headers, rows) {
    if (!headers || !Array.isArray(headers) || headers.length === 0) {
        return {
            isValid: false,
            reason: "Dataset contains no headers."
        };
    }
    if (!rows || rows.length === 0) {
        return {
            isValid: false,
            reason: "Dataset contains no records."
        };
    }
    return {
        isValid: true,
        reason: ""
    };
}

function parseNumeric(val) {
    if (typeof val === 'number') return val;
    if (!val) return NaN;
    const str = String(val).replace(/[^0-9.-]/g, '');
    const num = parseFloat(str);
    return isNaN(num) ? NaN : num;
}

function analyzeKeyField(values) {
    if (!values || values.length < 10) return { isUniform: true, score: 1.0 };

    const keys = [];
    for (let i = 0; i < values.length; i++) {
        const val = values[i];
        if (typeof val === 'number') {
            keys.push(val);
        } else {
            const match = String(val).match(/\d+/);
            keys.push(match ? parseInt(match[0], 10) : i);
        }
    }

    keys.sort((a, b) => a - b);
    const N = keys.length;
    const keyRange = keys[N - 1] - keys[0];
    if (keyRange === 0) return { isUniform: true, score: 1.0 };

    let sumGaps = 0;
    const gaps = new Array(N - 1);
    for (let i = 0; i < N - 1; i++) {
        const gap = keys[i + 1] - keys[i];
        gaps[i] = gap;
        sumGaps += gap;
    }
    const meanGap = sumGaps / (N - 1);
    if (meanGap === 0) return { isUniform: true, score: 1.0 };

    let sumSqGapDiff = 0;
    let maxGap = 0;
    for (let i = 0; i < N - 1; i++) {
        const diff = gaps[i] - meanGap;
        sumSqGapDiff += diff * diff;
        if (gaps[i] > maxGap) maxGap = gaps[i];
    }
    const stdGap = Math.sqrt(sumSqGapDiff / (N - 1));
    const cvGap = stdGap / meanGap;

    let sumI = 0, sumK = 0, sumIK = 0, sumI2 = 0, sumK2 = 0;
    for (let i = 0; i < N; i++) {
        const k = keys[i];
        sumI += i;
        sumK += k;
        sumIK += i * k;
        sumI2 += i * i;
        sumK2 += k * k;
    }
    const num = N * sumIK - sumI * sumK;
    const den = Math.sqrt((N * sumI2 - sumI * sumI) * (N * sumK2 - sumK * sumK));
    const r = den !== 0 ? num / den : 1;
    const r2 = r * r;

    const gapRatio = maxGap / meanGap;
    const linScore = Math.max(0, Math.min(1, r2));
    const gapScore = Math.max(0, Math.min(1, 1 - (cvGap / 2.0)));
    const keyScore = (linScore * 0.6) + (gapScore * 0.4);

    const isUniform = (r2 >= 0.95 && cvGap < 1.1 && gapRatio < 20);
    return { isUniform, score: keyScore };
}

function analyzeNumericField(values) {
    if (!values || values.length < 10) return { isUniform: true, score: 1.0 };

    const nums = [];
    for (let i = 0; i < values.length; i++) {
        const n = parseNumeric(values[i]);
        if (!isNaN(n)) nums.push(n);
    }
    if (nums.length < 10) return { isUniform: true, score: 1.0 };

    const N = nums.length;
    let sum = 0;
    for (let i = 0; i < N; i++) sum += nums[i];
    const mean = sum / N;

    let sumSqDiff = 0;
    let sumCubeDiff = 0;
    for (let i = 0; i < N; i++) {
        const d = nums[i] - mean;
        sumSqDiff += d * d;
        sumCubeDiff += d * d * d;
    }
    const variance = sumSqDiff / N;
    const std = Math.sqrt(variance);
    if (std === 0) return { isUniform: true, score: 1.0 };

    const skewness = (sumCubeDiff / N) / Math.pow(std, 3);

    nums.sort((a, b) => a - b);
    let sumI = 0, sumV = 0, sumIV = 0, sumI2 = 0, sumV2 = 0;
    for (let i = 0; i < N; i++) {
        const v = nums[i];
        sumI += i;
        sumV += v;
        sumIV += i * v;
        sumI2 += i * i;
        sumV2 += v * v;
    }
    const num = N * sumIV - sumI * sumV;
    const den = Math.sqrt((N * sumI2 - sumI * sumI) * (N * sumV2 - sumV * sumV));
    const r = den !== 0 ? num / den : 1;
    const r2 = r * r;

    const skewScore = Math.max(0, Math.min(1, 1 - (Math.abs(skewness) / 2.0)));
    const cdfScore = Math.max(0, Math.min(1, r2));
    const score = (skewScore * 0.5) + (cdfScore * 0.5);

    const isUniform = (Math.abs(skewness) < 0.75 && r2 >= 0.88);
    return { isUniform, score };
}

function analyzeCategoricalField(values) {
    if (!values || values.length < 10) return { isUniform: true, score: 1.0 };

    const counts = {};
    let total = 0;
    for (let i = 0; i < values.length; i++) {
        const val = String(values[i] || '').trim().toLowerCase();
        if (!val) continue;
        counts[val] = (counts[val] || 0) + 1;
        total++;
    }

    const categories = Object.keys(counts);
    const K = categories.length;
    if (K <= 1) return { isUniform: true, score: 1.0 };

    let entropy = 0;
    let maxProportion = 0;
    for (let i = 0; i < K; i++) {
        const p = counts[categories[i]] / total;
        if (p > 0) entropy -= p * Math.log2(p);
        if (p > maxProportion) maxProportion = p;
    }
    const maxEntropy = Math.log2(K);
    const normEntropy = maxEntropy > 0 ? entropy / maxEntropy : 1;

    const expectedProp = 1 / K;
    const maxRatio = maxProportion / expectedProp;

    const isUniform = (normEntropy >= 0.85 && maxRatio <= 2.2);
    return { isUniform, score: normEntropy };
}

/**
 * Multi-field dataset uniformity assessor:
 * Inspects all columns in the dataset (search keys, categories, prices, quantities, attributes)
 * and assesses statistical uniformity across all dimensions.
 * @param {Array<string>} headers
 * @param {Array<Array>} rows
 * @returns {'uniform' | 'non-uniform'}
 */
function assessDatasetDistribution(headers, rows) {
    if (!rows || rows.length < 10 || !headers || headers.length === 0) return 'uniform';

    const sampleLimit = Math.min(rows.length, 10000);
    const step = Math.max(1, Math.floor(rows.length / sampleLimit));
    const sampleRows = [];
    for (let i = 0; i < rows.length; i += step) {
        if (rows[i]) sampleRows.push(rows[i]);
    }

    const lowerHeaders = headers.map(h => (h || '').toString().trim().toLowerCase());

    // Identify SKU / Primary Key column
    let skuIdx = lowerHeaders.findIndex(h => h === 'sku' || h === 'id' || h.includes('code') || h.includes('key'));
    if (skuIdx === -1) skuIdx = 0;

    const fieldResults = [];
    let skuAnalysis = null;

    for (let col = 0; col < headers.length; col++) {
        const colName = headers[col];
        const values = sampleRows.map(r => r[col]);

        if (col === skuIdx) {
            skuAnalysis = analyzeKeyField(values);
            fieldResults.push({ name: colName, weight: 0.40, ...skuAnalysis });
        } else {
            // Determine column type: check if mostly numeric or categorical
            let numericCount = 0;
            let sampleCount = Math.min(values.length, 100);
            for (let j = 0; j < sampleCount; j++) {
                if (!isNaN(parseNumeric(values[j]))) numericCount++;
            }

            const isNumeric = (numericCount / sampleCount) >= 0.70;
            let analysis;
            if (isNumeric) {
                analysis = analyzeNumericField(values);
            } else {
                analysis = analyzeCategoricalField(values);
            }
            fieldResults.push({ name: colName, weight: 0.20, ...analysis });
        }
    }

    let totalWeight = 0;
    let weightedScore = 0;
    let nonUniformCount = 0;

    fieldResults.forEach(f => {
        weightedScore += f.score * f.weight;
        totalWeight += f.weight;
        if (!f.isUniform) nonUniformCount++;
    });

    const overallScore = totalWeight > 0 ? weightedScore / totalWeight : 1.0;
    const isSkuUniform = skuAnalysis ? skuAnalysis.isUniform : true;

    // Decision:
    // Dataset is Uniform if primary search key is uniform, at most 1 secondary field is non-uniform, and overallScore >= 0.80
    const isUniform = isSkuUniform && nonUniformCount <= 1 && overallScore >= 0.80;

    return isUniform ? 'uniform' : 'non-uniform';
}

/**
 * Updates both the loaded-distribution badge and result-distribution badge
 * and keeps active distribution state synchronized.
 */
function updateDistributionBadges(distMode) {
    currentDatasetDistribution = distMode;
    if (typeof selectedDistributionMode !== 'undefined') {
        selectedDistributionMode = distMode;
    }
    if (typeof setDistributionMode === 'function') {
        setDistributionMode(distMode);
    }

    const distBadge = document.getElementById('loaded-distribution-badge');
    if (distBadge) {
        if (distMode === 'uniform') {
            distBadge.className = 'badge-dist badge-dist-uniform';
            distBadge.innerHTML = '<i class="fa-solid fa-chart-line"></i> Uniform';
        } else {
            distBadge.className = 'badge-dist badge-dist-non-uniform';
            distBadge.innerHTML = '<i class="fa-solid fa-chart-pie"></i> Non-Uniform';
        }
    }

    const resDistBadge = document.getElementById('result-distribution-badge');
    if (resDistBadge) {
        if (distMode === 'uniform') {
            resDistBadge.className = 'badge-dist badge-dist-uniform';
            resDistBadge.innerHTML = '<i class="fa-solid fa-chart-line"></i> Uniform';
        } else {
            resDistBadge.className = 'badge-dist badge-dist-non-uniform';
            resDistBadge.innerHTML = '<i class="fa-solid fa-chart-pie"></i> Non-Uniform';
        }
    }
}

function handleFileUpload(file) {
    if (!file) return;

    const reader = new FileReader();

    reader.onload = function (e) {
        const content = e.target.result;
        let rawHeaders = [];
        let rawRows = [];

        if (file.name.toLowerCase().endsWith('.json')) {
            try {
                const data = JSON.parse(content);
                if (!Array.isArray(data)) {
                    showErrorPopup("Invalid JSON structure. Expected a JSON array of records.");
                    return;
                }
                if (data.length === 0) {
                    showErrorPopup("The uploaded file contains no records.");
                    return;
                }

                const firstItem = data[0];
                if (typeof firstItem === 'object' && firstItem !== null && !Array.isArray(firstItem)) {
                    const allKeys = new Set();
                    const sampleLimit = Math.min(data.length, 200);
                    for (let i = 0; i < sampleLimit; i++) {
                        if (data[i] && typeof data[i] === 'object') {
                            Object.keys(data[i]).forEach(k => allKeys.add(k));
                        }
                    }

                    const keysSet = new Set();
                    REQUIRED_FIELDS.forEach(rf => {
                        for (const k of allKeys) {
                            if (k.toLowerCase() === rf.toLowerCase()) {
                                keysSet.add(k);
                                break;
                            }
                        }
                    });
                    allKeys.forEach(k => keysSet.add(k));

                    rawHeaders = Array.from(keysSet);
                    rawRows = data.map(item => {
                        if (!item || typeof item !== 'object') return rawHeaders.map(() => '');
                        return rawHeaders.map(h => (item[h] !== undefined && item[h] !== null) ? item[h] : '');
                    });
                } else if (Array.isArray(firstItem)) {
                    rawHeaders = firstItem.map(h => String(h).trim());
                    rawRows = data.slice(1);
                } else {
                    rawHeaders = ['Value'];
                    rawRows = data.map(item => [item]);
                }
            } catch (err) {
                console.error("Error parsing JSON:", err);
                showErrorPopup("Invalid JSON file.");
                return;
            }
        } else if (file.name.toLowerCase().endsWith('.csv')) {
            const parsed = parseCSV(content);
            if (parsed.length === 0) {
                showErrorPopup("The uploaded file is empty.");
                return;
            }
            rawHeaders = parsed[0];
            rawRows = parsed.slice(1);
        } else {
            showErrorPopup("Unsupported file format. Please upload a CSV or JSON file.");
            return;
        }

        // Sanitize dataset & map required fields
        const processed = normalizeAndSanitizeDataset(rawHeaders, rawRows);

        if (!processed.isValid || processed.rows.length === 0) {
            datasetHeaders = [];
            datasetPreview = null;
            datasetSize = 0;

            const fileInput = document.getElementById('file-upload');
            if (fileInput) fileInput.value = '';

            showErrorPopup(
                `Failed to import dataset: ${processed.reason || 'No valid records found.'}`,
                "Dataset Error",
                "fa-solid fa-circle-xmark",
                "#ef4444"
            );
            return;
        }

        datasetHeaders = processed.headers;
        datasetPreview = processed.rows;
        datasetSize = datasetPreview.length;

        // Pre-Index string keys into numeric values upfront once during import
        preIndexDatasetKeys();

        // Detect distribution from filename or statistical assessment
        let detectedDist = 'uniform';
        const lowerName = file.name.toLowerCase();

        const isNonUniformName = /non[\s_-]?uniform|zipf|skewed|exponential|powerlaw|cluster|pareto/i.test(lowerName);
        const isUniformName = !isNonUniformName && (/(?:^|[\s_-])uniform(?:[\s_-]|\.|$)/i.test(lowerName) || lowerName.includes('uniform'));

        if (isNonUniformName) {
            detectedDist = 'non-uniform';
        } else if (isUniformName) {
            detectedDist = 'uniform';
        } else if (datasetPreview && datasetPreview.length > 0) {
            // Statistical assessment on loaded dataset
            if (typeof assessDatasetDistribution === 'function') {
                detectedDist = assessDatasetDistribution(datasetHeaders, datasetPreview);
            } else {
                const sample = datasetPreview.slice(0, Math.min(datasetPreview.length, 1000));
                const skuIdx = datasetHeaders.findIndex(h => h.toLowerCase() === 'sku');
                if (skuIdx !== -1) {
                    const counts = {};
                    sample.forEach(r => { counts[r[skuIdx]] = (counts[r[skuIdx]] || 0) + 1; });
                    const maxFreq = Math.max(...Object.values(counts));
                    const uniqueCount = Object.keys(counts).length;
                    if (maxFreq > sample.length * 0.05 || (sample.length > 0 && (uniqueCount / sample.length) < 0.35)) {
                        detectedDist = 'non-uniform';
                    }
                }
            }
        }

        if (typeof currentDatasetDistribution !== 'undefined') {
            currentDatasetDistribution = detectedDist;
        }
        if (typeof selectedDistributionMode !== 'undefined') {
            selectedDistributionMode = detectedDist;
        }
        if (typeof setDistributionMode === 'function') {
            setDistributionMode(detectedDist);
        }

        // Update badges
        ['loaded-distribution-badge', 'result-distribution-badge'].forEach(id => {
            const badge = document.getElementById(id);
            if (badge) {
                if (detectedDist === 'uniform') {
                    badge.className = 'badge-dist badge-dist-uniform';
                    badge.innerHTML = '<i class="fa-solid fa-chart-line"></i> Uniform';
                } else {
                    badge.className = 'badge-dist badge-dist-non-uniform';
                    badge.innerHTML = '<i class="fa-solid fa-chart-pie"></i> Non-Uniform';
                }
            }
        });

        document.getElementById('loaded-records').innerText = datasetSize.toLocaleString();
        document.getElementById('search-ops').value = Math.min(1000, datasetSize);

        // Pre-populate search term with the first record's name or SKU
        if (datasetPreview && datasetPreview.length > 0) {
            let nameIndex = datasetHeaders.findIndex(h => h.toLowerCase() === 'name');
            let skuIndex = datasetHeaders.findIndex(h => h.toLowerCase() === 'sku');
            let defaultSearch = "";
            if (nameIndex !== -1 && datasetPreview[0][nameIndex]) {
                defaultSearch = datasetPreview[0][nameIndex];
            } else if (skuIndex !== -1 && datasetPreview[0][skuIndex]) {
                defaultSearch = datasetPreview[0][skuIndex];
            } else if (datasetPreview[0][0]) {
                defaultSearch = datasetPreview[0][0];
            }
            document.getElementById('search-term').value = defaultSearch;
        }

        // Hide view-found-btn since the dataset has changed and no search has run yet
        const viewFoundBtn = document.getElementById('view-found-btn');
        if (viewFoundBtn) viewFoundBtn.style.display = 'none';

        // Proceed to Step 2 (Run Benchmark tab)
        goToStep(2);
    };

    reader.onerror = function () {
        console.error("Error reading file");
        showErrorPopup("Failed to read file.");
    };

    reader.readAsText(file);
}

// Realistic product naming catalog organized by category
const PRODUCT_NAME_POOLS = {
    'Electronics': {
        brands: ['Apex', 'Quantum', 'Titan', 'SonicPulse', 'Vortex', 'CyberWave', 'Horizon', 'CoreTech', 'Nova', 'Zenith', 'Hyperion', 'Pulse', 'Edge', 'Spectrum', 'Lumina', 'Matrix'],
        items: [
            'Wireless Noise-Canceling Headphones',
            'Ultra HD 4K Smart TV',
            'Mechanical RGB Gaming Keyboard',
            'Portable Waterproof Bluetooth Speaker',
            'Pro Smartphone 5G',
            'Ergonomic Optical Wireless Mouse',
            'Smartwatch Health & Fitness Tracker',
            'USB-C 7-in-1 Hub Adapter',
            'True Wireless Earbuds with Case',
            '1080p HD Streaming Webcam',
            'Curved Ultra-Wide Gaming Monitor',
            'Fast Charging Power Bank 20000mAh',
            'Compact Mirrorless Digital Camera',
            'Smart Home Voice Assistant Speaker',
            'Noise-Isolating Studio Headphones',
            'Dual-Band Wi-Fi 6 Mesh Router',
            'High-Speed NVMe External SSD',
            'Wireless Qi Fast Charging Pad',
            'Active Stylus Digital Pen',
            'Portable Mini Projector 1080p'
        ],
        variants: ['Pro Edition', 'Series X', 'Elite v2', 'Ultra Plus', 'Max Stealth', 'Studio Prime', 'Air Lite', 'Core Edition', 'Neo Edition', 'Carbon Black']
    },
    'Clothing': {
        brands: ['UrbanStyle', 'EcoThread', 'NorthPeak', 'Heritage', 'Vanguard', 'Driftwood', 'Coastal', 'Summit', 'Horizon', 'ClassicFit', 'AeroWeave', 'Alpine', 'Nomad', 'Atelier', 'Solstice', 'PureComfort'],
        items: [
            'Classic Cotton Crewneck T-Shirt',
            'Slim-Fit Stretch Denim Jeans',
            'Waterproof Hooded Rain Parka',
            'Casual Linen Button-Down Shirt',
            'Athletic Breathable Running Shorts',
            'Merino Wool Thermal Knit Sweater',
            'High-Waisted Performance Leggings',
            'Vintage Distressed Leather Jacket',
            'Fleece Pullover Relaxed Hoodie',
            'Tailored Modern Fit Blazer',
            'Thermal Waffle Long-Sleeve Shirt',
            'Casual Stretch Chino Pants',
            'All-Weather Softshell Windbreaker',
            'Quick-Dry UV Protection Polo Shirt',
            'Quilted Lightweight Down Puffer Vest',
            'Heavyweight Cotton Zip-Up Cardigan',
            'Seamless Moisture-Wicking Sports Top',
            'Straight-Leg Vintage Corduroy Trousers',
            'Relaxed Fit French Terry Sweatpants',
            'Breathable Bamboo Fiber Undershirt'
        ],
        variants: ['Classic Navy', 'Midnight Black', 'Heather Gray', 'Olive Green', 'Vintage Wash', 'Crimson Red', 'Sand Beige', 'Charcoal', 'Pure White', 'Stone Indigo']
    },
    'Home': {
        brands: ['NestCraft', 'LivingPure', 'CasaBella', 'HavenWood', 'SimpleElegance', 'NordicHome', 'EcoLiving', 'KitchenPro', 'Solace', 'TerraForm', 'PureBliss', 'Serenity', 'ModLiving', 'HearthStone', 'AquaPure', 'CraftHaven'],
        items: [
            'Artisan Stainless Steel Chef Knife Set',
            'Non-Stick Ceramic Cookware Fry Pan',
            'Ergonomic Contour Memory Foam Pillow',
            'Ultrasonic Aromatherapy Cool Mist Diffuser',
            'Robotic Smart Vacuum & Mop Cleaner',
            'Stainless Steel French Press Coffee Maker',
            'Microfiber Breathable Bedding Sheet Set',
            'Enameled Cast Iron Dutch Oven Pot',
            'Dimmable LED Touch Desk Lamp',
            'Organic Bamboo Kitchen Cutting Board Set',
            'Double-Wall Vacuum Insulated Tumbler',
            'Compact Air Purifier with HEPA Filter',
            'Electric Gooseneck Precision Kettle',
            'Multi-Tier Bamboo Shoe Storage Rack',
            'Weighted Deep Sleep Calming Blanket',
            'Automatic Touchless Foam Soap Dispenser',
            'Digital Multifunctional Air Fryer Oven',
            'Ceramic Stoneware Dinnerware Set',
            'High-Pressure Handheld Shower Head',
            'Stackable Airtight Food Storage Containers'
        ],
        variants: ['Deluxe 8-Piece', 'Standard Edition', 'Artisan Finish', 'Matte Black', 'Brushed Nickel', 'Natural Wood', 'Pro Series', 'Eco Edition', 'Comfort Plus', 'Grand Reserve']
    },
    'Toys': {
        brands: ['TurboTech', 'Galactic', 'AstroPlay', 'STEMCraft', 'WonderWorld', 'SpeedX', 'MegaBuild', 'ActionPro', 'SparkKids', 'DiscoveryLab', 'RoboQuest', 'HeroForce', 'SkyHigh', 'FutureLab', 'QuantumPlay', 'TinyTitans'],
        items: [
            'RC Quadcopter Drone with HD Camera',
            'Magnetic 3D Architectural Building Blocks',
            'Interactive AI Smart Robot Puppy',
            'Programmable STEM Robotics Coding Kit',
            'High-Speed Remote Control Drift Car',
            '1000-Piece Panoramic Jigsaw Puzzle',
            'Compound Microscope Science Lab Kit',
            'Die-Cast Alloy Supercar Model Racer',
            'Classic Wooden Railway Train Set',
            'Deluxe Art Studio Easel & Painting Kit',
            'Super Stunt Articulated Action Figure',
            'Glow-in-the-Dark Mechanical Marble Run',
            'Walkie Talkie Long-Range Adventure Set',
            'DIY Solar Powered Wooden Model Engine',
            'Kinetic Magic Play Sand Sensory Box',
            'Precision Electronic Dartboard Game Set',
            'Educational Interactive Talking World Globe',
            'Metal Speed Cube Puzzle Toy',
            'Miniature Chemistry Science Experiment Set',
            'Rocket Launcher Air-Powered Stunt Kit'
        ],
        variants: ['Turbo Edition', 'Adventure Pack', 'Series 3', 'Glow Edition', 'Mega Kit', 'Pro Racer', 'Space Mission', 'Explorer Set', 'Ultimate Edition', 'Master Builder']
    }
};

function getRealisticProductName(category, index) {
    const pool = PRODUCT_NAME_POOLS[category] || PRODUCT_NAME_POOLS['Electronics'];
    const brandIdx = (index * 7 + 3) % pool.brands.length;
    const itemIdx = (index + Math.floor(index / 16)) % pool.items.length;
    const variantIdx = (index * 13 + 5) % pool.variants.length;
    
    return `${pool.brands[brandIdx]} ${pool.items[itemIdx]} (${pool.variants[variantIdx]})`;
}

function generateData(records, distributionType) {
    const distMode = distributionType || (typeof selectedDistributionMode !== 'undefined' ? selectedDistributionMode : 'uniform');
    if (typeof currentDatasetDistribution !== 'undefined') {
        currentDatasetDistribution = distMode;
    }
    datasetSize = records;

    // Generate data preview with realistic e-commerce distribution
    // Required fields: SKU, Name, Category, Price, Stock
    datasetHeaders = ['SKU', 'Name', 'Category', 'Price', 'Stock'];
    let currentKey = 10000;

    const categories = ['Electronics', 'Clothing', 'Home', 'Toys'];
    datasetPreview = new Array(records);

    for (let i = 0; i < records; i++) {
        if (i > 0) {
            if (distMode === 'uniform') {
                // Uniform Distribution: Linear step spacing (~5 per step with slight jitter)
                currentKey += 4 + (i % 3);
            } else {
                // Non-Uniform Distribution: Skewed power-law curve with clustered burst gaps
                const t = i / records;
                let step = Math.max(1, Math.floor(1 + 30 * Math.pow(t, 2.5)));
                if (i % 250 === 0) {
                    step += Math.floor(400 * (1 + t * 3)); // Category cluster gap
                } else if (i % 50 === 0) {
                    step += Math.floor(60 * (1 + t * 2)); // Subcategory gap
                }
                currentKey += step;
            }
        }

        const cat = categories[i % 4];
        const productName = getRealisticProductName(cat, i);
        const price = (12.5 + ((i * 17) % 890) / 10).toFixed(2);
        const stock = ((i * 19) % 950) + 5;

        datasetPreview[i] = [
            `SKU-${currentKey}`,
            productName,
            cat,
            `$${price}`,
            stock
        ];
    }

    // Pre-Index string keys into numeric values upfront once during data generation
    preIndexDatasetKeys();

    // Simulate generation time / visual feedback
    let btn = null;
    let originalHtml = "";
    if (typeof event !== 'undefined' && event && event.currentTarget) {
        btn = event.currentTarget;
        originalHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-blue" style="font-size: 1.5rem;"></i>';
        btn.style.pointerEvents = 'none';
    }

    setTimeout(() => {
        if (btn) {
            btn.innerHTML = originalHtml;
            btn.style.pointerEvents = 'auto';
        }

        document.getElementById('loaded-records').innerText = records.toLocaleString();

        // Update distribution badges
        updateDistributionBadges(distMode);

        // Update max values for inputs based on dataset size
        document.getElementById('search-ops').value = Math.min(1000, records);

        // Pre-populate search term with a realistic product name query
        if (datasetPreview && datasetPreview.length > 0) {
            document.getElementById('search-term').value = "Headphones";
        }

        // Hide view-found-btn since the dataset has changed and no search has run yet
        const viewFoundBtn = document.getElementById('view-found-btn');
        if (viewFoundBtn) viewFoundBtn.style.display = 'none';

        goToStep(2);
    }, records >= 500000 ? 500 : 300);
}

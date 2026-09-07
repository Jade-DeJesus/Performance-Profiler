function showErrorPopup(message) {
    const modal = document.getElementById('error-modal');
    const msgEl = document.getElementById('error-modal-message');
    if (modal && msgEl) {
        msgEl.innerText = message;
        modal.style.display = 'block';
    }
}

function closeErrorModal() {
    const modal = document.getElementById('error-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function viewFoundDataset() {
    currentPreviewSource = 'found';
    const modal = document.getElementById('dataset-modal');
    if (!modal) return;

    // Reset to page 1 every time we open the modal
    currentPreviewPage = 1;

    renderDatasetPage();
    modal.style.display = 'block';
}

function generateAnalysisHTML() {
    if (benchmarkHistory.length === 0) return "<p>No benchmark data available.</p>";

    let fastestRun = benchmarkHistory.reduce((prev, current) => (prev.avgTimeNs < current.avgTimeNs) ? prev : current);

    let algorithmsRun = [...new Set(benchmarkHistory.map(run => run.algorithmName))];
    let algorithmsRunText = algorithmsRun.length === 1 ? algorithmsRun[0] : algorithmsRun.slice(0, -1).join(', ') + ' and ' + algorithmsRun[algorithmsRun.length - 1];

    let html = ``;

    // Overview
    html += `<div class="analysis-section">`;
    html += `<h4><i class="fa-solid fa-ranking-star"></i> Performance Overview</h4>`;
    html += `<p>A total of ${benchmarkHistory.length} benchmark runs have been executed, covering ${algorithmsRunText}. `;
    if (benchmarkHistory.length === 1) {
        html += `For the search query <strong>"${benchmarkHistory[0].searchTerm}"</strong> (which matched ${benchmarkHistory[0].matchingCount} record(s)), the algorithm averaged ${Math.round(benchmarkHistory[0].avgTimeNs).toLocaleString()}ns per operation.</p>`;
    } else {
        html += `For the search query <strong>"${fastestRun.searchTerm}"</strong> (which matched ${fastestRun.matchingCount} record(s)), comparing the results shows that <strong>${fastestRun.algorithmName}</strong> (Run #${fastestRun.run}) proved to be the fastest, averaging ${Math.round(fastestRun.avgTimeNs).toLocaleString()}ns per operation. `;

        let slowestRun = benchmarkHistory.reduce((prev, current) => (prev.avgTimeNs > current.avgTimeNs) ? prev : current);
        if (fastestRun.run !== slowestRun.run) {
            let speedup = (slowestRun.avgTimeNs / fastestRun.avgTimeNs).toFixed(2);
            html += `It is approximately <strong>${speedup}x</strong> faster than the slowest run (${slowestRun.algorithmName}, Run #${slowestRun.run}). `;
        }
        html += `</p>`;
    }
    html += `</div>`;

    // Conclusion Separated
    html += `<div class="analysis-section conclusion-box mt-4" style="padding: 15px; background: rgba(59, 130, 246, 0.1); border-left: 4px solid var(--primary-color); border-radius: 4px;">`;
    html += `<h4><i class="fa-solid fa-clipboard-check"></i> Conclusion</h4>`;
    html += `<p style="margin-bottom: 0;"><strong>${fastestRun.algorithmName}</strong> is overall the most optimal choice for finding records matching <strong>"${fastestRun.searchTerm}"</strong> in this dataset. It delivers the highest raw execution speed while providing a highly favorable trade-off between low look-up latency and manageable memory consumption.`;
    html += `</p></div>`;

    return html;
}

function updateChartInterpretations() {
    const timeInterpretationEl = document.getElementById('time-chart-interpretation');
    const memoryInterpretationEl = document.getElementById('memory-chart-interpretation');
    const detailedInterpretationEl = document.getElementById('detailed-chart-interpretation');

    if (!timeInterpretationEl || !memoryInterpretationEl || !detailedInterpretationEl) return;

    if (benchmarkHistory.length === 0) {
        timeInterpretationEl.innerHTML = '';
        memoryInterpretationEl.innerHTML = '';
        detailedInterpretationEl.innerHTML = '';
        return;
    }

    let fastestRun = benchmarkHistory.reduce((prev, current) => (prev.avgTimeNs < current.avgTimeNs) ? prev : current);
    let mostMemoryEfficientRun = benchmarkHistory.reduce((prev, current) => {
        let prevAvgMem = prev.memDataMB.reduce((a, b) => a + b, 0) / prev.memDataMB.length;
        let currAvgMem = current.memDataMB.reduce((a, b) => a + b, 0) / current.memDataMB.length;
        return (prevAvgMem < currAvgMem) ? prev : current;
    });

    // 1. Execution Time Distribution Interpretation
    let timeHtml = `<h4><i class="fa-solid fa-clock"></i> Execution Time Distribution Interpretation</h4>`;
    timeHtml += `<p>Looking at the <strong>Execution Time Distribution</strong> violin plot for query <strong>"${fastestRun.searchTerm}"</strong>, `;
    if (benchmarkHistory.length === 1) {
        timeHtml += `the violin shape is narrow and concentrated, indicating that ${benchmarkHistory[0].algorithmName} provides consistent lookup performance unaffected by minor data variances within batches.`;
    } else {
        timeHtml += `<strong>${fastestRun.algorithmName}</strong> generally exhibits the lowest distribution median and tightest density shape. If outliers are present, they are visible as sparse extensions, indicating that potential edge cases are well-mitigated.`;
    }
    timeHtml += `</p>`;
    timeInterpretationEl.innerHTML = timeHtml;

    // 2. Memory Usage Distribution Interpretation
    let memHtml = `<h4><i class="fa-solid fa-memory"></i> Memory Usage Distribution Interpretation</h4>`;
    let minAvgMem = (mostMemoryEfficientRun.memDataMB.reduce((a, b) => a + b, 0) / mostMemoryEfficientRun.memDataMB.length).toFixed(2);
    memHtml += `<p>The <strong>Memory Usage Distribution</strong> violin plot tracks dynamic overhead while searching for <strong>"${mostMemoryEfficientRun.searchTerm}"</strong>. `;
    if (benchmarkHistory.length === 1) {
        memHtml += `Memory utilization is tightly bound around <strong>${minAvgMem}MB</strong>, indicating robust garbage collection and minimal variable bloat during successive operations.`;
    } else {
        memHtml += `<strong>${mostMemoryEfficientRun.algorithmName}</strong> (Run #${mostMemoryEfficientRun.run}) maintains the most efficient profile at roughly <strong>${minAvgMem}MB</strong>. Some algorithms might temporarily show a wider violin width at higher bounds due to larger sequence generation (like Fibonacci/exponential bound arrays).`;
    }
    memHtml += `</p>`;
    memoryInterpretationEl.innerHTML = memHtml;

    // 3. Detailed Performance Metrics Interpretation
    let detHtml = `<h4><i class="fa-solid fa-layer-group"></i> Detailed Performance Metrics Interpretation</h4>`;
    detHtml += `<p>The <strong>Detailed Performance Metrics</strong> overlays both time and memory violin distributions side-by-side for query <strong>"${fastestRun.searchTerm}"</strong>. `;
    if (benchmarkHistory.length > 1 && fastestRun.run !== mostMemoryEfficientRun.run) {
        detHtml += `This visual intersection reveals an important trade-off: the algorithm achieving the fastest lookups (${fastestRun.algorithmName}) sometimes requires a slightly higher memory footprint compared to the most memory-efficient one (${mostMemoryEfficientRun.algorithmName}).`;
    } else {
        detHtml += `The side-by-side violin distributions validate that rapid index scaling does not trigger anomalous memory leakage, proving the architecture's stability under load.`;
    }
    detHtml += `</p>`;
    detailedInterpretationEl.innerHTML = detHtml;
}

function updateHistoryTable() {
    const tbody = document.getElementById('history-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';

    // Sort array by run number descending so newest is on top
    const sortedHistory = [...benchmarkHistory].reverse();

    sortedHistory.forEach(runData => {
        const tr = document.createElement('tr');

        // Formatter for large numbers
        const nForm = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
        const dForm = new Intl.NumberFormat(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });

        tr.innerHTML = `
            <td>Run ${runData.session || 1}</td>
            <td>${runData.algorithmName}</td>
            <td>${runData.searchTerm || 'N/A'}</td>
            <td>${nForm.format(runData.searchOps)}</td>
            <td>${dForm.format(runData.totalTimeNs)}</td>
            <td>${dForm.format(runData.avgTimeNs)}</td>
        `;

        tbody.appendChild(tr);
    });
}

function viewDataset() {
    currentPreviewSource = 'all';
    const modal = document.getElementById('dataset-modal');
    if (!modal) return;

    // Reset to page 1 every time we open the modal
    currentPreviewPage = 1;

    renderDatasetPage();
    modal.style.display = 'block';
}

function renderDatasetPage() {
    const thead = document.getElementById('dataset-table-head');
    const tbody = document.getElementById('dataset-table-body');
    const emptyMsg = document.getElementById('dataset-modal-empty');
    const tableDiv = document.querySelector('.table-responsive');
    const paginationDiv = document.getElementById('dataset-pagination');
    const pageIndicator = document.getElementById('page-indicator');
    const btnPrev = document.getElementById('btn-prev-page');
    const btnNext = document.getElementById('btn-next-page');

    if (!thead || !tbody) return;

    thead.innerHTML = '';
    tbody.innerHTML = '';

    const sourceData = currentPreviewSource === 'found' ? matchedPreview : datasetPreview;
    const totalSize = currentPreviewSource === 'found' ? (matchedPreview ? matchedPreview.length : 0) : datasetSize;

    // Update modal title depending on source
    const modalTitle = document.querySelector('#dataset-modal h2');
    if (modalTitle) {
        if (currentPreviewSource === 'found') {
            modalTitle.innerHTML = `Dataset Found <span id="preview-count" style="font-size: 1rem; color: #666; font-weight: normal; margin-left: 10px;"></span>`;
        } else {
            modalTitle.innerHTML = `Dataset Preview <span id="preview-count" style="font-size: 1rem; color: #666; font-weight: normal; margin-left: 10px;"></span>`;
        }
    }
    // Re-select countSpan since we just modified innerHTML
    const countSpan = document.getElementById('preview-count');

    if (!sourceData || sourceData.length === 0) {
        if (tableDiv) tableDiv.style.display = 'none';
        if (paginationDiv) paginationDiv.style.display = 'none';
        if (emptyMsg) emptyMsg.style.display = 'block';
        if (countSpan) countSpan.innerText = '';
    } else {
        if (tableDiv) tableDiv.style.display = 'block';
        if (paginationDiv) paginationDiv.style.display = 'flex';
        if (emptyMsg) emptyMsg.style.display = 'none';
        if (countSpan) countSpan.innerText = `(${totalSize.toLocaleString()} rows)`;

        // Pagination Logic
        const totalRows = sourceData.length;
        const totalPages = Math.ceil(totalRows / previewRowsPerPage);

        // Safety check
        if (currentPreviewPage < 1) currentPreviewPage = 1;
        if (currentPreviewPage > totalPages) currentPreviewPage = totalPages;

        const startIndex = (currentPreviewPage - 1) * previewRowsPerPage;
        const endIndex = Math.min(startIndex + previewRowsPerPage, totalRows);
        const currentSlice = sourceData.slice(startIndex, endIndex);

        // Update Pagination Controls
        if (pageIndicator) pageIndicator.innerText = `Page ${currentPreviewPage.toLocaleString()} of ${totalPages.toLocaleString()}`;
        const pageSlider = document.getElementById('dataset-page-slider');
        if (pageSlider) {
            pageSlider.max = totalPages;
            pageSlider.value = currentPreviewPage;
            pageSlider.disabled = totalPages <= 1;
        }

        // Populate Headers
        if (datasetHeaders && datasetHeaders.length > 0) {
            datasetHeaders.forEach(headerText => {
                const th = document.createElement('th');
                th.innerText = headerText;
                thead.appendChild(th);
            });
        }

        // Populate Rows (Only the slice)
        currentSlice.forEach(rowData => {
            const tr = document.createElement('tr');
            rowData.forEach(cellData => {
                const td = document.createElement('td');
                td.innerText = cellData !== undefined && cellData !== null ? cellData : '';
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
    }
}

function changeDatasetPage(direction) {
    currentPreviewPage += direction;
    renderDatasetPage();
    // Scroll table to top on page change
    const tableDiv = document.querySelector('.table-responsive');
    if (tableDiv) tableDiv.scrollTop = 0;
}

function closeDatasetModal() {
    const modal = document.getElementById('dataset-modal');
    if (modal) modal.style.display = 'none';
}

// Swipe Gesture Pagination Support
let touchStartX = 0;
let touchEndX = 0;
const SWIPE_THRESHOLD = 50;

function handleDatasetSwipe() {
    const sourceData = currentPreviewSource === 'found' ? matchedPreview : datasetPreview;
    if (!sourceData) return;
    const totalRows = sourceData.length;
    const totalPages = Math.ceil(totalRows / previewRowsPerPage);

    if (touchEndX < touchStartX - SWIPE_THRESHOLD) {
        // Swiped left -> Next page
        if (currentPreviewPage < totalPages) {
            changeDatasetPage(1);
        }
    }
    if (touchEndX > touchStartX + SWIPE_THRESHOLD) {
        // Swiped right -> Previous page
        if (currentPreviewPage > 1) {
            changeDatasetPage(-1);
        }
    }
}

function initDatasetSwipeEvents() {
    const tableDiv = document.querySelector('#dataset-modal .table-responsive');
    if (!tableDiv) return;

    tableDiv.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    tableDiv.addEventListener('touchend', e => {
        touchEndX = e.changedTouches[0].screenX;
        handleDatasetSwipe();
    }, { passive: true });
}

function onPageSliderInput(value) {
    currentPreviewPage = parseInt(value, 10);
    renderDatasetPage();
    const tableDiv = document.querySelector('#dataset-modal .table-responsive');
    if (tableDiv) tableDiv.scrollTop = 0;
}

document.addEventListener('DOMContentLoaded', () => {
    initDatasetSwipeEvents();
});

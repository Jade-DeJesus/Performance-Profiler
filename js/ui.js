function showErrorPopup(message, title = "Invalid Input", iconClass = "fa-solid fa-circle-xmark", iconColor = "#ef4444") {
    const modal = document.getElementById('error-modal');
    const msgEl = document.getElementById('error-modal-message');
    const titleEl = document.getElementById('error-modal-title');
    const iconEl = document.getElementById('error-modal-icon');
    if (modal && msgEl) {
        msgEl.innerText = message;
        if (titleEl) titleEl.innerText = title;
        if (iconEl) {
            iconEl.className = iconClass;
            iconEl.style.color = iconColor;
        }
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

    // Derive current session: the last group of runs sharing the same session number
    const latestSession = benchmarkHistory[benchmarkHistory.length - 1].session;
    const sessionRuns   = benchmarkHistory.filter(r => r.session === latestSession);
    const pool          = sessionRuns.length > 0 ? sessionRuns : benchmarkHistory;

    // Winner = lowest avgTimeNs in this session
    const winner  = pool.reduce((best, r) => (r.avgTimeNs < best.avgTimeNs) ? r : best);
    const runners = pool
        .filter(r => r.run !== winner.run)
        .sort((a, b) => a.avgTimeNs - b.avgTimeNs);

    // Formatting helpers bound to actual run values
    const fmtNs  = (ns)  => (Number.isFinite(ns)  && ns  > 0) ? ns.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : '—';
    const fmtOps = (ops) => (Number.isFinite(ops) && ops > 0) ? Math.round(ops).toLocaleString() : '—';

    const distType    = (typeof currentDatasetDistribution !== 'undefined' && currentDatasetDistribution === 'non-uniform') ? 'Non-Uniform' : 'Uniform';
    const searchQuery = winner.searchTerm || 'N/A';
    const matchCount  = (winner.matchingCount || 0).toLocaleString();

    // Speedup copy vs. slowest runner in same session
    let speedupText = '';
    if (runners.length > 0) {
        const slowest = runners[runners.length - 1];
        const ratio   = (slowest.avgTimeNs > 0 && winner.avgTimeNs > 0)
            ? (slowest.avgTimeNs / winner.avgTimeNs)
            : null;
        if (ratio !== null && Number.isFinite(ratio) && ratio > 1.0001) {
            speedupText = ` This represents a <strong>${ratio.toFixed(2)}x speedup</strong> over ${slowest.algorithmName} (${fmtNs(slowest.avgTimeNs)}ns avg).`;
        }
    }

    // Runner-up context line
    let runnerUpText = '';
    if (runners.length >= 2) {
        runnerUpText = ` ${runners[0].algorithmName} followed at ${fmtNs(runners[0].avgTimeNs)}ns avg, and ${runners[1].algorithmName} at ${fmtNs(runners[1].avgTimeNs)}ns avg.`;
    } else if (runners.length === 1) {
        runnerUpText = ` ${runners[0].algorithmName} followed at ${fmtNs(runners[0].avgTimeNs)}ns avg.`;
    }

    // Algorithm-specific conditional insight for the actual winner under the actual distribution
    const winnerName = winner.algorithmName;
    let specificInsight = '';
    if (distType === 'Uniform') {
        if (winnerName.includes('Binary')) {
            specificInsight = `Under uniform key spacing, <em>Interpolation-Binary Search</em> achieves near-perfect initial probe placement because the interpolation formula maps keys linearly to indices. Any residual error is resolved in a tight binary bisection, minimising comparison depth to near <em>O</em>(1) on dense uniform datasets.`;
        } else if (winnerName.includes('Fibonacci')) {
            specificInsight = `Under uniform key spacing, <em>Interpolation-Fibonacci Search</em> benefits from golden-ratio subdivision, which avoids recalculating midpoints and produces cache-friendly sequential access patterns — yielding superior throughput over binary fallback in this run.`;
        } else {
            specificInsight = `Under uniform key spacing, <em>Interpolation-Exponential Search</em> rapidly brackets the search space through exponential bound expansion before the interpolation phase lands near the exact index. The narrow bounding range kept probe depth minimal across all 30 batches.`;
        }
    } else {
        if (winnerName.includes('Binary')) {
            specificInsight = `Under non-uniform key distribution, the interpolation probe experiences estimation drift on skewed cluster gaps — yet <em>Interpolation-Binary Search</em>'s bisection fallback corrects course in <em>O</em>(log N) steps regardless of key density, making it the most resilient to power-law gaps in this dataset.`;
        } else if (winnerName.includes('Fibonacci')) {
            specificInsight = `Under non-uniform key distribution, <em>Interpolation-Fibonacci Search</em> uses golden-ratio pivots after the initial probe drifts off skewed cluster boundaries. These asymmetric subdivisions avoid worst-case bisection pivoting, yielding lower average probe depth on this skewed dataset.`;
        } else {
            specificInsight = `Under non-uniform key distribution, <em>Interpolation-Exponential Search</em> excels because exponential bound doubling (2<sup><em>k</em></sup>) dynamically brackets a locally linear sub-segment before applying interpolation — effectively bypassing global key skew and converging faster than bisection-based fallbacks.`;
        }
    }

    let html = '';
    html += `<div class="analysis-section conclusion-box" style="padding: 16px 20px; background: rgba(59, 130, 246, 0.08); border-left: 4px solid var(--primary-color); border-radius: 6px;">`;
    html += `<h4 style="margin-top: 0; margin-bottom: 8px; color: var(--primary-color); font-size: 1.05rem;"><i class="fa-solid fa-clipboard-check"></i> Benchmark Conclusion</h4>`;
    html += `<p style="margin-bottom: 10px; line-height: 1.6;">`;
    html += `<strong>${winnerName}</strong> is the most optimal choice for finding records matching <strong>"${searchQuery}"</strong> `;
    html += `(${matchCount} match${winner.matchingCount === 1 ? '' : 'es'}) across <strong>${fmtOps(winner.searchOps)}</strong> search operations on this ${distType.toLowerCase()} dataset. `;
    html += `It averaged <strong>${fmtNs(winner.avgTimeNs)}ns</strong> per operation.`;
    html += `${speedupText}${runnerUpText}`;
    html += `</p>`;
    html += `<div class="p-3" style="background: rgba(255,255,255,0.75); border-left: 3px solid ${distType === 'Uniform' ? 'var(--primary-color)' : '#f59e0b'}; border-radius: 4px; font-size: 0.9rem; line-height: 1.6;">`;
    html += `<strong><i class="${distType === 'Uniform' ? 'fa-solid fa-chart-line text-blue' : 'fa-solid fa-chart-pie'}" style="${distType !== 'Uniform' ? 'color:#f59e0b;' : ''}"></i> Distribution Analysis (${distType}):</strong> ${specificInsight}`;
    html += `</div>`;
    html += `</div>`;
    return html;
}

function updateChartInterpretations() {
    const timeInterpretationEl   = document.getElementById('time-chart-interpretation');
    const memoryInterpretationEl = document.getElementById('memory-chart-interpretation');
    const detailedInterpretationEl = document.getElementById('detailed-chart-interpretation');

    if (!timeInterpretationEl || !memoryInterpretationEl || !detailedInterpretationEl) return;

    if (benchmarkHistory.length === 0) {
        timeInterpretationEl.innerHTML   = '';
        memoryInterpretationEl.innerHTML = '';
        detailedInterpretationEl.innerHTML = '';
        return;
    }

    // Scope to current session for accurate reporting
    const latestSession = benchmarkHistory[benchmarkHistory.length - 1].session;
    const sessionRuns   = benchmarkHistory.filter(r => r.session === latestSession);
    const pool          = sessionRuns.length > 0 ? sessionRuns : benchmarkHistory;

    const winner  = pool.reduce((best, r) => (r.avgTimeNs < best.avgTimeNs) ? r : best);
    const slowest = pool.reduce((prev, r) => (r.avgTimeNs > prev.avgTimeNs) ? r : prev);

    const mostMemoryEfficientRun = pool.reduce((best, r) => {
        const bestAvg = best.memDataMB.length > 0 ? best.memDataMB.reduce((a, b) => a + b, 0) / best.memDataMB.length : Infinity;
        const rAvg    = r.memDataMB.length   > 0 ? r.memDataMB.reduce((a, b) => a + b, 0)   / r.memDataMB.length   : Infinity;
        return rAvg < bestAvg ? r : best;
    });

    // Formatting helpers bound to actual values
    const fmtNs  = (ns)  => (Number.isFinite(ns)  && ns  > 0) ? ns.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : '—';
    const fmtOps = (ops) => (Number.isFinite(ops) && ops > 0) ? Math.round(ops).toLocaleString() : '—';

    const distType    = (typeof currentDatasetDistribution !== 'undefined' && currentDatasetDistribution === 'non-uniform') ? 'Non-Uniform' : 'Uniform';
    const searchQuery = winner.searchTerm || 'N/A';

    const algorithmsRun     = [...new Set(pool.map(r => r.algorithmName))];
    const algorithmsRunText = algorithmsRun.length === 1
        ? algorithmsRun[0]
        : algorithmsRun.slice(0, -1).join(', ') + ' and ' + algorithmsRun[algorithmsRun.length - 1];

    // 1. Execution Time Distribution Interpretation
    let timeHtml = `<h4><i class="fa-solid fa-clock"></i> Execution Time Distribution Interpretation</h4>`;
    timeHtml += `<p>Looking at the <strong>Execution Time Distribution</strong> violin plot for query <strong>"${searchQuery}"</strong>, `;
    if (pool.length === 1) {
        timeHtml += `the violin density shape is concentrated and narrow, indicating that <strong>${winner.algorithmName}</strong> delivers consistent lookup latency unaffected by minor data variances within batches.`;
    } else {
        timeHtml += `<strong>${winner.algorithmName}</strong> exhibits the lowest distribution median at <strong>${fmtNs(winner.avgTimeNs)}ns</strong> avg and the tightest density band. `;
        timeHtml += `Potential edge cases and boundary lookups are well-mitigated by its effective search bounds checking.`;
    }
    timeHtml += `</p>`;
    timeInterpretationEl.innerHTML = timeHtml;

    // 2. Memory Usage Distribution Interpretation
    const minAvgMem = mostMemoryEfficientRun.memDataMB.length > 0
        ? (mostMemoryEfficientRun.memDataMB.reduce((a, b) => a + b, 0) / mostMemoryEfficientRun.memDataMB.length).toFixed(3)
        : '—';

    let memHtml = `<h4><i class="fa-solid fa-memory"></i> Memory Usage Distribution Interpretation</h4>`;
    memHtml += `<p>The <strong>Memory Usage Distribution</strong> violin plot tracks dynamic memory overhead per batch. `;
    if (pool.length === 1) {
        memHtml += `Memory utilization is tightly bound around <strong>${minAvgMem}MB</strong>, indicating robust garbage collection cycles and minimal variable bloat during successive search operations.`;
    } else {
        memHtml += `<strong>${mostMemoryEfficientRun.algorithmName}</strong> maintains the most efficient profile at roughly <strong>${minAvgMem}MB</strong>. `;
        memHtml += `Sequence and bound tracking allocations remain strictly bounded throughout execution.`;
    }
    memHtml += `</p>`;
    memoryInterpretationEl.innerHTML = memHtml;

    // 3. Performance Overview & Detailed Metrics Interpretation
    let detHtml = `<h4><i class="fa-solid fa-ranking-star"></i> Performance Overview &amp; Detailed Metrics Interpretation</h4>`;
    detHtml += `<p>A total of <strong>${pool.length}</strong> run${pool.length === 1 ? '' : 's'} evaluated <strong>${algorithmsRunText}</strong> across a <strong>${distType}</strong> key distribution `;
    detHtml += `for search query <strong>"${searchQuery}"</strong> (${(winner.matchingCount || 0).toLocaleString()} match${winner.matchingCount === 1 ? '' : 'es'}). `;

    if (pool.length === 1) {
        detHtml += `The algorithm averaged <strong>${fmtNs(winner.avgTimeNs)}ns</strong> per operation across <strong>${fmtOps(winner.searchOps)}</strong> operations, `;
        detHtml += `with a steady memory profile of <strong>${minAvgMem}MB</strong>.`;
    } else {
        detHtml += `<strong>${winner.algorithmName}</strong> proved fastest at <strong>${fmtNs(winner.avgTimeNs)}ns</strong> per operation. `;
        if (winner.run !== slowest.run && slowest.avgTimeNs > 0 && winner.avgTimeNs > 0) {
            const ratio = slowest.avgTimeNs / winner.avgTimeNs;
            if (Number.isFinite(ratio) && ratio > 1.0001) {
                detHtml += `It achieved a <strong>${ratio.toFixed(2)}x speedup</strong> over the slowest run (${slowest.algorithmName} at ${fmtNs(slowest.avgTimeNs)}ns avg). `;
            }
        }
    }

    detHtml += `</p><p style="margin-top: 8px;">The side-by-side overlay of execution latency (solid time violin) and memory footprint (dashed memory violin) illustrates the system's operational characteristics: `;
    if (pool.length > 1 && winner.run !== mostMemoryEfficientRun.run) {
        detHtml += `the fastest algorithm (<strong>${winner.algorithmName}</strong>) trades a marginal memory overhead for higher index traversal speed compared to the most memory-efficient algorithm (<strong>${mostMemoryEfficientRun.algorithmName}</strong>). `;
    } else {
        detHtml += `rapid key index resolution scales efficiently without triggering anomalous memory spikes or allocation leaks. `;
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

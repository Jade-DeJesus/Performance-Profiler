// Global State
let currentStep = 1;
let datasetSize = 0;
let datasetPreview = null; // Store a preview of the dataset
let matchedPreview = []; // Store the rows matching the search query
let currentPreviewSource = 'all'; // Track whether we preview full dataset ('all') or search matches ('found')
let lastTimeData = [];
let lastMemData = [];
let benchmarkHistory = []; // Track all benchmarking runs
let datasetHeaders = []; // Store the headers for the dataset tabular view
let currentPreviewPage = 1; // Track the current page in the dataset modal
const previewRowsPerPage = 100; // Only display 100 rows per page to prevent browser freeze
let selectedDistributionMode = 'uniform'; // 'uniform' | 'non-uniform' for synthetic generator
let currentDatasetDistribution = 'uniform'; // Active loaded dataset distribution

// Distribution Selector Mode Switcher
function setDistributionMode(mode) {
    selectedDistributionMode = mode;
    const optUniform = document.getElementById('dist-opt-uniform');
    const optNonUniform = document.getElementById('dist-opt-non-uniform');
    if (optUniform && optNonUniform) {
        if (mode === 'uniform') {
            optUniform.classList.add('active');
            optNonUniform.classList.remove('active');
            const iconUni = optUniform.querySelector('.dist-radio-icon');
            const iconNon = optNonUniform.querySelector('.dist-radio-icon');
            if (iconUni) iconUni.className = 'fa-solid fa-circle-check dist-radio-icon';
            if (iconNon) iconNon.className = 'fa-regular fa-circle dist-radio-icon';
        } else {
            optNonUniform.classList.add('active');
            optUniform.classList.remove('active');
            const iconUni = optUniform.querySelector('.dist-radio-icon');
            const iconNon = optNonUniform.querySelector('.dist-radio-icon');
            if (iconUni) iconUni.className = 'fa-regular fa-circle dist-radio-icon';
            if (iconNon) iconNon.className = 'fa-solid fa-circle-check dist-radio-icon';
        }
    }
}

// Step Wizard Navigation
function goToStep(step) {
    // Update Stepper UI
    document.querySelectorAll('.step').forEach((el, index) => {
        if (index + 1 <= step) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    });

    // Hide all tabs, show target tab
    document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));

    if (step === 1) {
        if (typeof pauseVisualizer === 'function') pauseVisualizer();
        document.getElementById('tab-import').classList.add('active');
    }
    if (step === 2) {
        if (typeof pauseVisualizer === 'function') pauseVisualizer();
        document.getElementById('tab-benchmark').classList.add('active');
    }
    if (step === 3) {
        document.getElementById('tab-results').classList.add('active');
        if (typeof renderCharts === 'function') {
            renderCharts(); // Render charts when moving to step 3
        }
    }

    currentStep = step;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Export Functions
function downloadJSON() {
    if (benchmarkHistory.length === 0) {
        alert("No benchmark data available to export.");
        return;
    }

    // Create export payload
    const exportData = {
        exportedAt: new Date().toISOString(),
        datasetSize: datasetSize,
        totalRuns: benchmarkHistory.length,
        runs: benchmarkHistory
    };

    // Create downloaded JSON file
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "benchmark_report.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

function downloadCSV() {
    if (benchmarkHistory.length === 0) {
        alert("No benchmark data available to export.");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Find the maximum number of batches in history to create headers dynamically
    const maxBatches = benchmarkHistory.reduce((max, run) => Math.max(max, run.timeDataNs.length), 0);
    
    // Header
    const headers = [
        "Run Number", "Algorithm", "Total Operations", "Total Time (ns)", "Avg Time (ns)", "Fastest Time (ns)"
    ];
    for (let i = 1; i <= maxBatches; i++) {
        headers.push(`Batch ${i} Time (ns)`);
    }
    for (let i = 1; i <= maxBatches; i++) {
        headers.push(`Batch ${i} Mem (MB)`);
    }
    
    csvContent += headers.map(h => `"${h}"`).join(",") + "\r\n";

    benchmarkHistory.forEach(run => {
        const row = [
            run.run,
            `"${run.algorithmName}"`,
            run.searchOps,
            run.totalTimeNs,
            run.avgTimeNs,
            run.fastestTimeNs,
            ...(run.timeDataNs.map(v => v || 0)),
            ...(run.memDataMB.map(v => v || 0))
        ];
        csvContent += row.join(",") + "\r\n";
    });

    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", encodeURI(csvContent));
    downloadAnchorNode.setAttribute("download", "benchmark_report.csv");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

// Global Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // File Upload handling
    const uploadArea = document.querySelector('.upload-area');
    const fileInput = document.getElementById('file-upload');

    if (uploadArea && fileInput) {
        uploadArea.addEventListener('click', () => fileInput.click());

        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = 'var(--primary-color)';
            uploadArea.style.backgroundColor = 'var(--blue-bg)';
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.style.borderColor = 'var(--border-color)';
            uploadArea.style.backgroundColor = '#fafafa';
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = 'var(--border-color)';
            uploadArea.style.backgroundColor = '#fafafa';
            if (e.dataTransfer.files.length > 0) {
                if (typeof handleFileUpload === 'function') {
                    handleFileUpload(e.dataTransfer.files[0]);
                }
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                if (typeof handleFileUpload === 'function') {
                    handleFileUpload(e.target.files[0]);
                }
            }
        });
    }

    // Close modal when clicking outside of the content
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('dataset-modal');
        if (e.target === modal) {
            if (typeof closeDatasetModal === 'function') {
                closeDatasetModal();
            }
        }
    });

    // Start benchmark on Enter key press in search input elements
    const searchTermInput = document.getElementById('search-term');
    const searchOpsInput = document.getElementById('search-ops');
    if (searchTermInput) {
        searchTermInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (typeof startBenchmark === 'function') {
                    startBenchmark();
                }
            }
        });
    }
    if (searchOpsInput) {
        searchOpsInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (typeof startBenchmark === 'function') {
                    startBenchmark();
                }
            }
        });
    }
});

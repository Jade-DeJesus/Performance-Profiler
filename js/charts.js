// Charts State
let timeChart, memoryChart, detailedChart;

function renderCharts() {
    const timeCtxEl = document.getElementById('timeChart');
    const memoryCtxEl = document.getElementById('memoryChart1');
    const detailedCtxEl = document.getElementById('detailedChart');

    if (!timeCtxEl || !memoryCtxEl || !detailedCtxEl) return;

    const timeCtx = timeCtxEl.getContext('2d');
    const memCtx1 = memoryCtxEl.getContext('2d');
    const detCtx = detailedCtxEl.getContext('2d');

    // Destroy existing charts to avoid overlay issues when re-running
    if (timeChart) timeChart.destroy();
    if (memoryChart) memoryChart.destroy();
    if (detailedChart) detailedChart.destroy();

    const colors = [
        '#3b82f6', // blue
        '#10b981', // green
        '#f59e0b', // yellow
        '#ef4444', // red
        '#8b5cf6', // purple
        '#ec4899', // pink
        '#06b6d4', // cyan
    ];

    // If no history, just show mock empty graph using current lastTimeData or defaults
    const historyToUse = benchmarkHistory.length > 0 ? benchmarkHistory : [{
        run: 1,
        algorithmName: 'No Data Yet',
        searchTerm: 'None',
        timeDataNs: lastTimeData.length > 0 ? lastTimeData : Array.from({ length: 30 }, () => 800000 + Math.random() * 20000 - 10000),
        memDataMB: lastMemData.length > 0 ? lastMemData : Array.from({ length: 30 }, () => 0.2 + Math.random() * 0.04 - 0.02)
    }];

    // Generate label strings (one per category/violin)
    const labels = historyToUse.map(run => {
        if (run.runLabel) return run.runLabel;
        
        let shortName = run.algorithmName;
        if (shortName.includes("Binary")) shortName = "IB";
        else if (shortName.includes("Fibonacci")) shortName = "IF";
        else if (shortName.includes("Exponential")) shortName = "IE";
        else return shortName;
        return `R${run.run || 1} ${shortName}`;
    });

    // 1. Time Chart (Violin)
    timeChart = new Chart(timeCtx, {
        type: 'violin',
        data: {
            labels: labels,
            datasets: [{
                label: 'Execution Time (ns)',
                data: historyToUse.map(run => run.timeDataNs),
                backgroundColor: historyToUse.map((_, idx) => colors[idx % colors.length] + '40'),
                borderColor: historyToUse.map((_, idx) => colors[idx % colors.length]),
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: false, grid: { borderDash: [5, 5] }, title: { display: true, text: 'Execution Time (ns)' } },
                x: { grid: { display: false } }
            }
        }
    });

    // 2. Memory Chart (Violin)
    memoryChart = new Chart(memCtx1, {
        type: 'violin',
        data: {
            labels: labels,
            datasets: [{
                label: 'Memory Usage (MB)',
                data: historyToUse.map(run => run.memDataMB),
                backgroundColor: historyToUse.map((_, idx) => colors[(idx + 1) % colors.length] + '40'),
                borderColor: historyToUse.map((_, idx) => colors[(idx + 1) % colors.length]),
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: false, grid: { borderDash: [5, 5] }, title: { display: true, text: 'Memory Usage (MB)' } },
                x: { grid: { display: false } }
            }
        }
    });

    // 3. Detailed Combined Chart (Violin with Dual Y-Axes)
    detailedChart = new Chart(detCtx, {
        type: 'violin',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Execution Time (ns)',
                    data: historyToUse.map(run => run.timeDataNs),
                    backgroundColor: 'rgba(59, 130, 246, 0.4)',
                    borderColor: 'rgb(59, 130, 246)',
                    borderWidth: 2,
                    yAxisID: 'y'
                },
                {
                    label: 'Memory Usage (MB)',
                    data: historyToUse.map(run => run.memDataMB),
                    backgroundColor: 'rgba(16, 185, 129, 0.4)',
                    borderColor: 'rgb(16, 185, 129)',
                    borderWidth: 2,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: true } },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: { display: true, text: 'Time (ns)' },
                    grid: { borderDash: [5, 5] },
                    beginAtZero: false
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: { display: true, text: 'Memory (MB)' },
                    grid: { drawOnChartArea: false },
                    beginAtZero: false
                },
                x: { grid: { display: false } }
            }
        }
    });
}

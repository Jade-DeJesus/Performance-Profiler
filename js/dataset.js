function handleFileUpload(file) {
    if (!file) return;

    // Show loading state if needed here
    const reader = new FileReader();

    reader.onload = function (e) {
        const content = e.target.result;
        let recordsCount = 0;

        if (file.name.toLowerCase().endsWith('.json')) {
            try {
                const data = JSON.parse(content);
                recordsCount = Array.isArray(data) ? data.length : 0;

                if (recordsCount > 0) {
                    // Extract headers from the first object
                    const firstItem = data[0];
                    if (typeof firstItem === 'object' && firstItem !== null) {
                        datasetHeaders = Object.keys(firstItem);
                        // Save all rows for display
                        datasetPreview = data.map(item => {
                            return datasetHeaders.map(h => item[h] !== undefined ? item[h] : '');
                        });
                    } else {
                        datasetHeaders = ['Value'];
                        datasetPreview = data.map(item => [item]);
                    }
                }
            } catch (err) {
                console.error("Error parsing JSON:", err);
                showErrorPopup("Invalid JSON file.");
                return;
            }
        } else if (file.name.toLowerCase().endsWith('.csv')) {
            // Count non-empty lines
            const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);

            if (lines.length > 0) {
                // Assuming first line is header
                datasetHeaders = lines[0].split(',').map(h => h.trim());
                recordsCount = lines.length > 1 ? lines.length - 1 : 0;

                // Save all rows for display
                datasetPreview = lines.slice(1).map(line => {
                    // Simple CSV split (doesn't handle commas inside quotes perfectly)
                    return line.split(',').map(cell => cell.trim());
                });
            } else {
                recordsCount = 0;
            }
        } else {
            showErrorPopup("Unsupported file format. Please upload a CSV or JSON file.");
            return;
        }

        datasetSize = recordsCount;
        document.getElementById('loaded-records').innerText = datasetSize.toLocaleString();

        // Update max values for inputs based on dataset size
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

        goToStep(2);
    };

    reader.onerror = function () {
        console.error("Error reading file");
        showErrorPopup("Failed to read file.");
    };

    reader.readAsText(file);
}

function generateData(records) {
    datasetSize = records;

    // Generate data preview with realistic e-commerce distribution
    datasetHeaders = ['SKU', 'Name', 'Category', 'Price', 'Stock'];
    let currentKey = 10000;
    datasetPreview = Array.from({ length: records }, (_, i) => {
        if (i > 0) {
            let step = 1 + (i % 3);
            if (i % 250 === 0) step += 200; // Category batch gap
            else if (i % 50 === 0) step += 25; // Subcategory batch gap
            currentKey += step;
        }
        return [
            `SKU-${currentKey}`,
            `Generated Product ${i + 1}`,
            ['Electronics', 'Clothing', 'Home', 'Toys'][Math.floor(Math.random() * 4)],
            `$${(Math.random() * 100).toFixed(2)}`,
            Math.floor(Math.random() * 1000)
        ];
    });

    // Simulate generation time
    const btn = event.currentTarget;
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-blue" style="font-size: 1.5rem;"></i>';
    btn.style.pointerEvents = 'none';

    setTimeout(() => {
        btn.innerHTML = originalHtml;
        btn.style.pointerEvents = 'auto';

        document.getElementById('loaded-records').innerText = records.toLocaleString();

        // Update max values for inputs based on dataset size
        document.getElementById('search-ops').value = Math.min(1000, records);

        // Pre-populate search term for generated data
        if (datasetPreview && datasetPreview.length > 0) {
            document.getElementById('search-term').value = "Product 1";
        }

        // Hide view-found-btn since the dataset has changed and no search has run yet
        const viewFoundBtn = document.getElementById('view-found-btn');
        if (viewFoundBtn) viewFoundBtn.style.display = 'none';

        goToStep(2);
    }, 600);
}

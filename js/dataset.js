// Required fields for any valid dataset
const REQUIRED_FIELDS = ['SKU', 'Name', 'Category', 'Price', 'Stock'];

/**
 * Validates that dataset headers contain all required fields (case-insensitive)
 * and that each record row contains non-empty values for these fields.
 * @param {Array<string>} headers 
 * @param {Array<Array>} rows 
 * @returns {{isValid: boolean, missingHeaders?: Array<string>, reason?: string}}
 */
function validateDatasetRecords(headers, rows) {
    if (!headers || !Array.isArray(headers) || headers.length === 0) {
        return {
            isValid: false,
            reason: "Dataset contains no headers."
        };
    }

    const lowerHeaders = headers.map(h => (h || '').toString().trim().toLowerCase());
    const missingHeaders = REQUIRED_FIELDS.filter(rf => !lowerHeaders.includes(rf.toLowerCase()));
    const colIndices = REQUIRED_FIELDS.map(rf => lowerHeaders.indexOf(rf.toLowerCase()));

    if (missingHeaders.length > 0) {
        return {
            isValid: false,
            missingHeaders: missingHeaders,
            reason: `Missing required field(s): ${missingHeaders.join(', ')}.`
        };
    }

    if (!rows || rows.length === 0) {
        return {
            isValid: false,
            reason: "Dataset contains no records."
        };
    }

    // Check records for missing or empty required fields
    for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        if (!row || !Array.isArray(row)) {
            return {
                isValid: false,
                reason: `Record #${r + 1} is empty or malformed.`
            };
        }
        for (let i = 0; i < REQUIRED_FIELDS.length; i++) {
            const colIdx = colIndices[i];
            const val = row[colIdx];
            if (val === undefined || val === null || String(val).trim() === "") {
                return {
                    isValid: false,
                    reason: `Record #${r + 1} is missing '${REQUIRED_FIELDS[i]}'.`
                };
            }
        }
    }

    return {
        isValid: true,
        reason: ""
    };
}

function handleFileUpload(file) {
    if (!file) return;

    const reader = new FileReader();

    reader.onload = function (e) {
        const content = e.target.result;
        let recordsCount = 0;

        if (file.name.toLowerCase().endsWith('.json')) {
            try {
                const data = JSON.parse(content);
                if (!Array.isArray(data)) {
                    showErrorPopup("Invalid JSON structure. Expected a JSON array of records.");
                    return;
                }
                recordsCount = data.length;

                if (recordsCount > 0) {
                    const firstItem = data[0];
                    if (typeof firstItem === 'object' && firstItem !== null && !Array.isArray(firstItem)) {
                        // Gather unique keys, prioritizing standard REQUIRED_FIELDS first
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

                        datasetHeaders = Array.from(keysSet);
                        datasetPreview = data.map(item => {
                            if (!item || typeof item !== 'object') return datasetHeaders.map(() => '');
                            return datasetHeaders.map(h => (item[h] !== undefined && item[h] !== null) ? item[h] : '');
                        });
                    } else if (Array.isArray(firstItem)) {
                        datasetHeaders = firstItem.map(h => String(h).trim());
                        datasetPreview = data.slice(1);
                        recordsCount = datasetPreview.length;
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
            const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);

            if (lines.length > 0) {
                datasetHeaders = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
                recordsCount = lines.length > 1 ? lines.length - 1 : 0;

                datasetPreview = lines.slice(1).map(line => {
                    return line.split(',').map(cell => cell.trim().replace(/^["']|["']$/g, ''));
                });
            } else {
                recordsCount = 0;
            }
        } else {
            showErrorPopup("Unsupported file format. Please upload a CSV or JSON file.");
            return;
        }

        if (recordsCount === 0) {
            showErrorPopup("The uploaded file contains no records.");
            return;
        }

        // Validate dataset records for required fields: SKU, Name, Category, Price, Stock
        const validation = validateDatasetRecords(datasetHeaders, datasetPreview);

        // If any required field or data is missing, reject and do NOT continue to the benchmark tab
        if (!validation.isValid) {
            // Reset dataset state
            datasetHeaders = [];
            datasetPreview = null;
            datasetSize = 0;

            const fileInput = document.getElementById('file-upload');
            if (fileInput) fileInput.value = '';

            showErrorPopup(
                `The dataset is wrong. Each dataset record must contain SKU, Name, Category, Price, and Stock. (${validation.reason}) Please upload a valid dataset file.`,
                "Dataset Error",
                "fa-solid fa-circle-xmark",
                "#ef4444"
            );
            return;
        }

        // Only accept and proceed to Step 2 if dataset is valid
        datasetSize = recordsCount;
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

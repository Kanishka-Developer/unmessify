// PWA and App State
let deferredPrompt;
let allData = {};
let filteredData = {};
let currentFilter = 'all';

// DOM Elements
const elements = {
    loading: document.getElementById('loading'),
    dataGrid: document.getElementById('dataGrid'),
    searchInput: document.getElementById('searchInput'),
    noResults: document.getElementById('noResults'),
    modal: document.getElementById('dataModal'),
    modalTitle: document.getElementById('modalTitle'),
    modalBody: document.getElementById('modalBody'),
    modalClose: document.getElementById('modalClose'),
    installBtn: document.getElementById('installBtn'),
    aboutBtn: document.getElementById('aboutBtn'),
    filterTabs: document.querySelectorAll('.tab-btn')
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initializePWA();
    handleURLParameters();
    loadData();
    bindEvents();
});

// PWA Setup
function initializePWA() {
    // Register Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    }

    // Install Prompt
    window.addEventListener('beforeinstallprompt', (e) => {
        console.log('beforeinstallprompt event fired');
        e.preventDefault();
        deferredPrompt = e;
        elements.installBtn.style.display = 'block';
    });

    // Check if already installed
    window.addEventListener('appinstalled', () => {
        console.log('PWA was installed');
        elements.installBtn.style.display = 'none';
        deferredPrompt = null;
    });

    // Fallback: Show install button after a delay if not shown naturally
    // This helps with testing and browsers that don't fire the event immediately
    setTimeout(() => {
        if (elements.installBtn.style.display === 'none' && !window.matchMedia('(display-mode: standalone)').matches) {
            console.log('Showing install button as fallback');
            elements.installBtn.style.display = 'block';
            elements.installBtn.textContent = '📱 Add to Home Screen';
        }
    }, 3000);

    // Install Button Handler
    elements.installBtn.addEventListener('click', async () => {
        if (!deferredPrompt) {
            // Fallback: Show instructions for manual installation
            showInstallInstructions();
            return;
        }
        
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
            elements.installBtn.style.display = 'none';
        }
        
        deferredPrompt = null;
    });
}

// Bind Event Listeners
function bindEvents() {
    // Search Input
    elements.searchInput.addEventListener('input', debounce(handleSearch, 300));
    
    // Filter Tabs
    elements.filterTabs.forEach(tab => {
        tab.addEventListener('click', () => handleFilterChange(tab.dataset.filter));
    });
    
    // Modal Controls
    elements.modalClose.addEventListener('click', closeModal);
    elements.modal.addEventListener('click', (e) => {
        if (e.target === elements.modal) closeModal();
    });
    
    // About Button
    elements.aboutBtn.addEventListener('click', showAbout);
    
    // Escape Key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
}

// Handle URL Parameters for PWA shortcuts
function handleURLParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const filter = urlParams.get('filter');
    
    if (filter && ['all', 'rooms', 'menus'].includes(filter)) {
        currentFilter = filter;
        
        // Update active tab
        elements.filterTabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.filter === filter);
        });
    }
}

// Data Loading
async function loadData() {
    try {
        elements.loading.style.display = 'flex';
        
        // List of all JSON files
        const dataFiles = [
            'VITC-A-L', 'VITC-B-L', 'VITC-CB-L', 'VITC-CG-L',
            'VITC-D1-L', 'VITC-D2-L', 'VITC-M-N', 'VITC-M-S',
            'VITC-M-V', 'VITC-W-N', 'VITC-W-S', 'VITC-W-V'
        ];
        
        // Load all data files
        const loadPromises = dataFiles.map(async (fileName) => {
            try {
                const response = await fetch(`json/en/${fileName}.json`);
                if (response.ok) {
                    const data = await response.json();
                    allData[fileName] = data;
                }
            } catch (error) {
                console.warn(`Failed to load ${fileName}.json:`, error);
            }
        });
        
        await Promise.all(loadPromises);
        
        filteredData = { ...allData };
        renderData();
        
    } catch (error) {
        console.error('Error loading data:', error);
        showError('Failed to load data. Please try again later.');
    } finally {
        elements.loading.style.display = 'none';
    }
}

// Render Data
function renderData() {
    const hasData = Object.keys(filteredData).length > 0;
    
    elements.dataGrid.style.display = hasData ? 'grid' : 'none';
    elements.noResults.style.display = hasData ? 'none' : 'block';
    
    if (!hasData) return;
    
    elements.dataGrid.innerHTML = '';
    
    Object.entries(filteredData).forEach(([tableName, tableData]) => {
        const card = createDataCard(tableName, tableData);
        elements.dataGrid.appendChild(card);
    });
}

// Create Data Card
function createDataCard(tableName, tableData) {
    const card = document.createElement('div');
    card.className = 'data-card';
    card.addEventListener('click', () => openModal(tableName, tableData));
    
    const isMenu = tableName.includes('M-') || tableName.includes('W-');
    const emoji = isMenu ? '🍽️' : '🧺';
    const type = isMenu ? 'Menu' : 'Laundry';
    
    // Calculate stats
    const totalRecords = tableData.list?.length || 0;
    const nonNullRecords = tableData.list?.filter(record => 
        Object.values(record).some(value => value !== null && value !== '')
    ).length || 0;
    
    card.innerHTML = `
        <div class="card-header">
            <div>
                <div class="card-title">
                    ${emoji} ${formatTableName(tableName)}
                    <span class="card-badge">${type}</span>
                </div>
                <div class="card-meta">Last updated: ${getLastUpdated(tableData)}</div>
            </div>
        </div>
        <div class="card-content">
            <p>${getTableDescription(tableName, isMenu)}</p>
        </div>
        <div class="card-stats">
            <div class="stat">
                <span class="stat-value">${totalRecords}</span>
                <span class="stat-label">Total Records</span>
            </div>
            <div class="stat">
                <span class="stat-value">${nonNullRecords}</span>
                <span class="stat-label">With Data</span>
            </div>
            <div class="stat">
                <span class="stat-value">${(tableData.stats?.dbQueryTime || '0')}ms</span>
                <span class="stat-label">Query Time</span>
            </div>
        </div>
    `;
    
    return card;
}

// Format Table Name
function formatTableName(tableName) {
    const parts = tableName.split('-');
    if (parts.length >= 2) {
        const building = parts[1];
        const type = parts[2] || '';
        
        if (building === 'M' || building === 'W') {
            const gender = building === 'M' ? 'Men' : 'Women';
            const mealType = type === 'N' ? 'Non-Veg' : type === 'V' ? 'Veg' : type === 'S' ? 'Special' : '';
            return `${gender} ${mealType} Menu`;
        } else {
            return `${building} Block ${type === 'L' ? 'Laundry' : ''}`;
        }
    }
    return tableName;
}

// Get Table Description
function getTableDescription(tableName, isMenu) {
    if (isMenu) {
        const parts = tableName.split('-');
        const gender = parts[1] === 'M' ? 'Men\'s' : 'Women\'s';
        const type = parts[2] === 'N' ? 'Non-Vegetarian' : parts[2] === 'V' ? 'Vegetarian' : 'Special';
        return `${gender} hostel ${type.toLowerCase()} menu with daily meal schedules including breakfast, lunch, snacks, and dinner.`;
    } else {
        const block = tableName.split('-')[1];
        return `Laundry schedules for ${block} block hostels with date-wise allocation and room number ranges.`;
    }
}

// Get Last Updated
function getLastUpdated(tableData) {
    if (tableData.list && tableData.list.length > 0) {
        const latest = tableData.list.reduce((latest, record) => {
            const recordDate = new Date(record.UpdatedAt || record.CreatedAt);
            return recordDate > latest ? recordDate : latest;
        }, new Date(0));
        
        return latest.toLocaleDateString();
    }
    return 'Unknown';
}

// Handle Search
function handleSearch() {
    const searchTerm = elements.searchInput.value.toLowerCase().trim();
    
    if (!searchTerm) {
        filteredData = filterByType(allData, currentFilter);
        renderData();
        return;
    }
    
    const filtered = {};
    
    Object.entries(allData).forEach(([tableName, tableData]) => {
        // Check if table name matches
        if (formatTableName(tableName).toLowerCase().includes(searchTerm)) {
            filtered[tableName] = tableData;
            return;
        }
        
        // Check if any record data matches
        const matchingRecords = tableData.list?.filter(record => {
            return Object.values(record).some(value => {
                if (value === null || value === undefined) return false;
                return String(value).toLowerCase().includes(searchTerm);
            });
        });
        
        if (matchingRecords && matchingRecords.length > 0) {
            filtered[tableName] = {
                ...tableData,
                list: matchingRecords
            };
        }
    });
    
    filteredData = filterByType(filtered, currentFilter);
    renderData();
}

// Handle Filter Change
function handleFilterChange(filter) {
    currentFilter = filter;
    
    // Update active tab
    elements.filterTabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.filter === filter);
    });
    
    filteredData = filterByType(allData, filter);
    renderData();
    
    // Re-apply search if there's a search term
    if (elements.searchInput.value.trim()) {
        handleSearch();
    }
}

// Filter by Type
function filterByType(data, filter) {
    if (filter === 'all') return { ...data };
    
    const filtered = {};
    Object.entries(data).forEach(([tableName, tableData]) => {
        const isMenu = tableName.includes('M-') || tableName.includes('W-');
        
        if (filter === 'menus' && isMenu) {
            filtered[tableName] = tableData;
        } else if (filter === 'rooms' && !isMenu) {
            filtered[tableName] = tableData;
        }
    });
    
    return filtered;
}

// Open Modal
function openModal(tableName, tableData) {
    elements.modalTitle.textContent = formatTableName(tableName);
    elements.modalBody.innerHTML = createModalContent(tableData);
    elements.modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

// Close Modal
function closeModal() {
    elements.modal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

// Create Modal Content
function createModalContent(tableData) {
    if (!tableData.list || tableData.list.length === 0) {
        return '<p>No data available.</p>';
    }
    
    let html = '<div class="record-grid">';
    
    tableData.list.forEach((record, index) => {
        html += `
            <div class="record-item">
                <h4 style="margin-bottom: 1rem; color: var(--primary-color);">Record ${index + 1}</h4>
        `;
        
        Object.entries(record).forEach(([key, value]) => {
            if (key === 'ncRecordId' || key === 'ncRecordHash') return;
            
            const displayValue = value === null || value === undefined || value === '' 
                ? 'Not assigned' 
                : String(value);
            
            const isNull = value === null || value === undefined || value === '';
            
            html += `
                <div class="record-field">
                    <span class="field-label">${formatFieldName(key)}:</span>
                    <span class="field-value ${isNull ? 'null' : ''}">${displayValue}</span>
                </div>
            `;
        });
        
        html += '</div>';
    });
    
    html += '</div>';
    
    // Add page info
    if (tableData.pageInfo) {
        html += `
            <div style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--border-color); text-align: center; color: var(--text-muted);">
                <p>Total Records: ${tableData.pageInfo.totalRows} | Query Time: ${tableData.stats?.dbQueryTime || 'N/A'}ms</p>
            </div>
        `;
    }
    
    return html;
}

// Format Field Name
function formatFieldName(fieldName) {
    const fieldMappings = {
        'Id': 'ID',
        'CreatedAt': 'Created',
        'UpdatedAt': 'Updated',
        'RoomNumber': 'Room Number',
        'Date': 'Date/Day'
    };
    
    return fieldMappings[fieldName] || fieldName;
}

// Show About
function showAbout() {
    elements.modalTitle.textContent = 'About Unmessify';
    elements.modalBody.innerHTML = `
        <div style="line-height: 1.8;">
            <h3 style="margin-bottom: 1rem; color: var(--primary-color);">📊 What is this?</h3>
            <p style="margin-bottom: 1rem;">
                This is a Progressive Web App (PWA) that provides easy access to VITC hostel data, 
                including room assignments and mess menu information.
            </p>
            
            <h3 style="margin-bottom: 1rem; color: var(--primary-color);">🏠 Laundry Data</h3>
            <p style="margin-bottom: 1rem;">
                Laundry schedule data shows which room ranges are allocated on specific dates 
                for different hostel blocks (A, B, CB, CG, D1, D2).
            </p>
            
            <h3 style="margin-bottom: 1rem; color: var(--primary-color);">🍽️ Menu Data</h3>
            <p style="margin-bottom: 1rem;">
                Menu data includes daily meal schedules for both men's and women's hostels, 
                with separate menus for vegetarian, non-vegetarian, and special meals.
            </p>
            
            <h3 style="margin-bottom: 1rem; color: var(--primary-color);">📱 Features</h3>
            <ul style="margin-bottom: 1rem; padding-left: 1.5rem;">
                <li>🔍 Search across all data</li>
                <li>📱 Install as a mobile app</li>
                <li>🌙 Dark mode support</li>
                <li>📊 Responsive design</li>
                <li>⚡ Fast and lightweight</li>
            </ul>
            
            <h3 style="margin-bottom: 1rem; color: var(--primary-color);">🔗 Source</h3>
            <p>
                Data is automatically generated from CSV files and updated via GitHub Actions. 
                <a href="https://github.com/Kanishka-Developer/unmessify-data" target="_blank" 
                   style="color: var(--primary-color); text-decoration: none;">
                    View the repository →
                </a>
            </p>
        </div>
    `;
    elements.modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

// Show Error
function showError(message) {
    elements.dataGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--error-color);">
            <h3>⚠️ Error</h3>
            <p>${message}</p>
        </div>
    `;
}

// Show Install Instructions
function showInstallInstructions() {
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isChrome = /Chrome/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !isChrome;
    
    let instructions = '';
    
    if (isMobile) {
        if (isSafari) {
            instructions = `To install this app on iOS:
1. Tap the Share button (⬆️) at the bottom
2. Scroll down and tap "Add to Home Screen"
3. Tap "Add" to confirm`;
        } else {
            instructions = `To install this app on Android:
1. Tap the menu (⋮) in your browser
2. Select "Add to Home Screen" or "Install App"
3. Tap "Add" or "Install" to confirm`;
        }
    } else {
        instructions = `To install this app on desktop:
1. Look for an install icon (⬇️) in your browser's address bar
2. Or use your browser's menu to find "Install App" option
3. Click to install for offline access`;
    }
    
    alert(`📱 Install Unmessify App\n\n${instructions}\n\nOnce installed, you can use the app offline and access it quickly from your home screen!`);
}

// Utility: Debounce
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

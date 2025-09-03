// Editor App State
let originalData = {};
let currentData = {};
let currentFile = null;
let hasChanges = false;

// File definitions with metadata
const fileDefinitions = {
    // Laundry files
    'VITC-A-L.csv': {
        name: 'VITC-A-L.csv',
        displayName: 'Block A - Laundry',
        description: 'Laundry schedule for Block A',
        category: 'laundry',
        subcategory: 'blocks',
        icon: '🏢',
        structure: ['Date', 'RoomNumber']
    },
    'VITC-B-L.csv': {
        name: 'VITC-B-L.csv',
        displayName: 'Block B - Laundry',
        description: 'Laundry schedule for Block B',
        category: 'laundry',
        subcategory: 'blocks',
        icon: '🏢',
        structure: ['Date', 'RoomNumber']
    },
    'VITC-CB-L.csv': {
        name: 'VITC-CB-L.csv',
        displayName: 'Block CB - Laundry',
        description: 'Laundry schedule for Block CB',
        category: 'laundry',
        subcategory: 'blocks',
        icon: '🏢',
        structure: ['Date', 'RoomNumber']
    },
    'VITC-CG-L.csv': {
        name: 'VITC-CG-L.csv',
        displayName: 'Block CG - Laundry',
        description: 'Laundry schedule for Block CG',
        category: 'laundry',
        subcategory: 'blocks',
        icon: '🏢',
        structure: ['Date', 'RoomNumber']
    },
    'VITC-D1-L.csv': {
        name: 'VITC-D1-L.csv',
        displayName: 'Block D1 - Laundry',
        description: 'Laundry schedule for Block D1',
        category: 'laundry',
        subcategory: 'blocks',
        icon: '🏢',
        structure: ['Date', 'RoomNumber']
    },
    'VITC-D2-L.csv': {
        name: 'VITC-D2-L.csv',
        displayName: 'Block D2 - Laundry',
        description: 'Laundry schedule for Block D2',
        category: 'laundry',
        subcategory: 'blocks',
        icon: '🏢',
        structure: ['Date', 'RoomNumber']
    },
    
    // Men's menu files
    'VITC-M-N.csv': {
        name: 'VITC-M-N.csv',
        displayName: 'Non-Veg - Men\'s Menu',
        description: 'Men\'s mess menu with non-vegetarian options',
        category: 'menu',
        subcategory: 'men',
        icon: '🍖',
        structure: ['Day', 'Breakfast', 'Lunch', 'Snacks', 'Dinner']
    },
    'VITC-M-S.csv': {
        name: 'VITC-M-S.csv',
        displayName: 'Special - Men\'s Menu',
        description: 'Men\'s mess special menu options',
        category: 'menu',
        subcategory: 'men',
        icon: '⭐',
        structure: ['Day', 'Breakfast', 'Lunch', 'Snacks', 'Dinner']
    },
    'VITC-M-V.csv': {
        name: 'VITC-M-V.csv',
        displayName: 'Veg - Men\'s Menu',
        description: 'Men\'s mess vegetarian menu',
        category: 'menu',
        subcategory: 'men',
        icon: '🥬',
        structure: ['Day', 'Breakfast', 'Lunch', 'Snacks', 'Dinner']
    },
    
    // Women's menu files
    'VITC-W-N.csv': {
        name: 'VITC-W-N.csv',
        displayName: 'Non-Veg - Women\'s Menu',
        description: 'Women\'s mess menu with non-vegetarian options',
        category: 'menu',
        subcategory: 'women',
        icon: '🍖',
        structure: ['Day', 'Breakfast', 'Lunch', 'Snacks', 'Dinner']
    },
    'VITC-W-S.csv': {
        name: 'VITC-W-S.csv',
        displayName: 'Special - Women\'s Menu',
        description: 'Women\'s mess special menu options',
        category: 'menu',
        subcategory: 'women',
        icon: '⭐',
        structure: ['Day', 'Breakfast', 'Lunch', 'Snacks', 'Dinner']
    },
    'VITC-W-V.csv': {
        name: 'VITC-W-V.csv',
        displayName: 'Veg - Women\'s Menu',
        description: 'Women\'s mess vegetarian menu',
        category: 'menu',
        subcategory: 'women',
        icon: '🥬',
        structure: ['Day', 'Breakfast', 'Lunch', 'Snacks', 'Dinner']
    }
};

// DOM Elements
const elements = {
    // File selection
    laundryFiles: document.getElementById('laundryFiles'),
    menMenuFiles: document.getElementById('menMenuFiles'),
    womenMenuFiles: document.getElementById('womenMenuFiles'),
    
    // Editor section
    editorSection: document.getElementById('editorSection'),
    currentFileName: document.getElementById('currentFileName'),
    currentFileDesc: document.getElementById('currentFileDesc'),
    editTable: document.getElementById('editTable'),
    
    // Actions
    cancelEditBtn: document.getElementById('cancelEditBtn'),
    resetBtn: document.getElementById('resetBtn'),
    previewBtn: document.getElementById('previewBtn'),
    addRowBtn: document.getElementById('addRowBtn'),
    deleteRowBtn: document.getElementById('deleteRowBtn'),
    downloadBtn: document.getElementById('downloadBtn'),
    submitBtn: document.getElementById('submitBtn'),
    
    // Changes summary
    changesSummary: document.getElementById('changesSummary'),
    changesList: document.getElementById('changesList'),
    
    // Modals
    previewModal: document.getElementById('previewModal'),
    previewModalClose: document.getElementById('previewModalClose'),
    previewTable: document.getElementById('previewTable'),
    csvPreviewCode: document.getElementById('csvPreviewCode'),
    diffContent: document.getElementById('diffContent'),
    previewCancelBtn: document.getElementById('previewCancelBtn'),
    saveChangesBtn: document.getElementById('saveChangesBtn'),
    
    prModal: document.getElementById('prModal'),
    prModalClose: document.getElementById('prModalClose'),
    prTitle: document.getElementById('prTitle'),
    prDescription: document.getElementById('prDescription'),
    prCancelBtn: document.getElementById('prCancelBtn'),
    copyPRInfoBtn: document.getElementById('copyPRInfoBtn'),
    downloadUpdatedBtn: document.getElementById('downloadUpdatedBtn'),
    
    // Loading
    loadingOverlay: document.getElementById('loadingOverlay'),
    loadingText: document.getElementById('loadingText'),
    
    // Help
    editorHelpBtn: document.getElementById('editorHelpBtn')
};

// Initialize Editor
document.addEventListener('DOMContentLoaded', () => {
    initializeEditor();
    bindEvents();
    renderFileSelection();
});

function initializeEditor() {
    console.log('Unmessify Data Editor initialized');
    
    // Check for file parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const fileParam = urlParams.get('file');
    
    if (fileParam && fileDefinitions[fileParam]) {
        // Load specific file if provided in URL
        setTimeout(() => selectFile(fileParam), 100);
    }
}

function bindEvents() {
    // Modal events
    elements.previewModalClose.addEventListener('click', closePreviewModal);
    elements.previewCancelBtn.addEventListener('click', closePreviewModal);
    elements.saveChangesBtn.addEventListener('click', saveChanges);
    
    elements.prModalClose.addEventListener('click', closePRModal);
    elements.prCancelBtn.addEventListener('click', closePRModal);
    elements.copyPRInfoBtn.addEventListener('click', copyPRInfo);
    elements.downloadUpdatedBtn.addEventListener('click', downloadUpdatedCSV);
    
    // Editor actions
    elements.cancelEditBtn.addEventListener('click', cancelEdit);
    elements.resetBtn.addEventListener('click', resetChanges);
    elements.previewBtn.addEventListener('click', showPreview);
    elements.addRowBtn.addEventListener('click', addRow);
    elements.deleteRowBtn.addEventListener('click', deleteSelectedRow);
    elements.downloadBtn.addEventListener('click', downloadCSV);
    elements.submitBtn.addEventListener('click', showPRModal);
    
    // Preview tabs
    document.querySelectorAll('.preview-tabs .tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchPreviewTab(btn.dataset.tab));
    });
    
    // Help
    elements.editorHelpBtn.addEventListener('click', showHelp);
    
    // Prevent accidental navigation
    window.addEventListener('beforeunload', (e) => {
        if (hasChanges) {
            e.preventDefault();
            e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        }
    });
    
    // Close modals on escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closePreviewModal();
            closePRModal();
        }
    });
}

function renderFileSelection() {
    // Clear existing content
    elements.laundryFiles.innerHTML = '';
    elements.menMenuFiles.innerHTML = '';
    elements.womenMenuFiles.innerHTML = '';
    
    // Render files by category
    Object.values(fileDefinitions).forEach(file => {
        const fileCard = createFileCard(file);
        
        if (file.category === 'laundry') {
            elements.laundryFiles.appendChild(fileCard);
        } else if (file.category === 'menu') {
            if (file.subcategory === 'men') {
                elements.menMenuFiles.appendChild(fileCard);
            } else if (file.subcategory === 'women') {
                elements.womenMenuFiles.appendChild(fileCard);
            }
        }
    });
}

function createFileCard(file) {
    const card = document.createElement('div');
    card.className = 'file-card';
    card.dataset.filename = file.name;
    
    card.innerHTML = `
        <span class="file-icon">${file.icon}</span>
        <h4>${file.displayName}</h4>
        <p>${file.description}</p>
    `;
    
    card.addEventListener('click', () => selectFile(file.name));
    
    return card;
}

async function selectFile(filename) {
    if (hasChanges) {
        const confirm = window.confirm('You have unsaved changes. Do you want to discard them and switch files?');
        if (!confirm) return;
    }
    
    showLoading('Loading file data...');
    
    try {
        // Clear current selection
        document.querySelectorAll('.file-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        // Mark selected file
        const selectedCard = document.querySelector(`[data-filename="${filename}"]`);
        if (selectedCard) {
            selectedCard.classList.add('selected');
        }
        
        // Load file data
        await loadFileData(filename);
        
        // Show editor
        elements.editorSection.style.display = 'block';
        
        // Scroll to editor
        elements.editorSection.scrollIntoView({ behavior: 'smooth' });
        
    } catch (error) {
        console.error('Error loading file:', error);
        alert('Error loading file. Please try again.');
    } finally {
        hideLoading();
    }
}

async function loadFileData(filename) {
    currentFile = filename;
    const file = fileDefinitions[filename];
    
    // Update file info
    elements.currentFileName.textContent = `📄 ${file.displayName}`;
    elements.currentFileDesc.textContent = file.description;
    
    // Load CSV data
    try {
        const response = await fetch(`csv/${filename}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const csvText = await response.text();
        const data = parseCSV(csvText);
        
        originalData = JSON.parse(JSON.stringify(data));
        currentData = JSON.parse(JSON.stringify(data));
        
        renderTable();
        updateButtonStates();
        updateChangesSummary();
        
    } catch (error) {
        throw new Error(`Failed to load ${filename}: ${error.message}`);
    }
}

function parseCSV(csvText) {
    // Split the CSV into proper records, handling quoted multi-line fields
    const records = parseCSVRecords(csvText);
    if (records.length === 0) return { headers: [], rows: [] };
    
    const headers = records[0];
    const rows = records.slice(1).map((record, index) => {
        // Ensure all rows have the same number of columns as headers
        while (record.length < headers.length) {
            record.push('');
        }
        return { id: index, values: record };
    });
    
    return { headers, rows };
}

function parseCSVRecords(csvText) {
    const records = [];
    let currentRecord = [];
    let currentField = '';
    let inQuotes = false;
    let i = 0;
    
    while (i < csvText.length) {
        const char = csvText[i];
        
        if (char === '"') {
            if (inQuotes && csvText[i + 1] === '"') {
                // Escaped quote within quoted field
                currentField += '"';
                i += 2;
                continue;
            } else {
                // Toggle quote state
                inQuotes = !inQuotes;
                i++;
                continue;
            }
        }
        
        if (!inQuotes && char === ',') {
            // End of field
            currentRecord.push(currentField.trim());
            currentField = '';
            i++;
            continue;
        }
        
        if (!inQuotes && (char === '\n' || char === '\r')) {
            // End of record
            if (currentField.trim() || currentRecord.length > 0) {
                currentRecord.push(currentField.trim());
                if (currentRecord.some(field => field.length > 0)) {
                    records.push(currentRecord);
                }
                currentRecord = [];
                currentField = '';
            }
            
            // Skip \r\n combinations
            if (char === '\r' && csvText[i + 1] === '\n') {
                i += 2;
            } else {
                i++;
            }
            continue;
        }
        
        // Regular character
        currentField += char;
        i++;
    }
    
    // Handle last field/record if CSV doesn't end with newline
    if (currentField.trim() || currentRecord.length > 0) {
        currentRecord.push(currentField.trim());
        if (currentRecord.some(field => field.length > 0)) {
            records.push(currentRecord);
        }
    }
    
    return records;
}

function renderTable() {
    const { headers, rows } = currentData;
    
    let tableHTML = '<thead><tr>';
    tableHTML += '<th style="width: 50px;">#</th>';
    tableHTML += '<th style="width: 30px;">☑️</th>';
    
    headers.forEach(header => {
        tableHTML += `<th>${escapeHtml(header)}</th>`;
    });
    
    tableHTML += '</tr></thead><tbody>';
    
    rows.forEach((row, index) => {
        tableHTML += `<tr data-row-id="${row.id}">`;
        tableHTML += `<td class="row-number">${index + 1}</td>`;
        tableHTML += `<td><input type="checkbox" class="row-selector" data-row-id="${row.id}"></td>`;
        
        row.values.forEach((value, colIndex) => {
            const isMenuField = headers[colIndex] && ['Breakfast', 'Lunch', 'Snacks', 'Dinner'].includes(headers[colIndex]);
            const inputType = isMenuField ? 'textarea' : 'input';
            const className = isMenuField ? 'edit-textarea' : 'edit-input';
            
            // Clean up the value - remove extra quotes if they exist
            let cleanValue = value;
            if (typeof value === 'string' && value.startsWith('"') && value.endsWith('"')) {
                cleanValue = value.slice(1, -1).replace(/""/g, '"');
            }
            
            if (inputType === 'textarea') {
                tableHTML += `<td><textarea class="${className}" data-row-id="${row.id}" data-col-index="${colIndex}">${escapeHtml(cleanValue)}</textarea></td>`;
            } else {
                tableHTML += `<td><input type="text" class="${className}" data-row-id="${row.id}" data-col-index="${colIndex}" value="${escapeHtml(cleanValue)}"></td>`;
            }
        });
        
        tableHTML += '</tr>';
    });
    
    tableHTML += '</tbody>';
    elements.editTable.innerHTML = tableHTML;
    
    // Bind input events
    bindTableEvents();
}

function bindTableEvents() {
    // Input change events
    elements.editTable.addEventListener('input', (e) => {
        if (e.target.matches('.edit-input, .edit-textarea')) {
            handleCellChange(e.target);
        }
    });
    
    // Row selection events
    elements.editTable.addEventListener('change', (e) => {
        if (e.target.matches('.row-selector')) {
            handleRowSelection();
        }
    });
    
    // Row click events for selection
    elements.editTable.addEventListener('click', (e) => {
        if (e.target.closest('tr[data-row-id]') && !e.target.matches('input, textarea')) {
            const row = e.target.closest('tr[data-row-id]');
            const checkbox = row.querySelector('.row-selector');
            checkbox.checked = !checkbox.checked;
            handleRowSelection();
        }
    });
}

function handleCellChange(input) {
    const rowId = parseInt(input.dataset.rowId);
    const colIndex = parseInt(input.dataset.colIndex);
    const newValue = input.value;
    
    // Find the row and update the value
    const row = currentData.rows.find(r => r.id === rowId);
    if (row) {
        row.values[colIndex] = newValue;
        checkForChanges();
    }
}

function handleRowSelection() {
    const selectedCheckboxes = elements.editTable.querySelectorAll('.row-selector:checked');
    const hasSelection = selectedCheckboxes.length > 0;
    
    elements.deleteRowBtn.style.display = hasSelection ? 'inline-flex' : 'none';
    
    // Update row highlighting
    elements.editTable.querySelectorAll('tr[data-row-id]').forEach(row => {
        const checkbox = row.querySelector('.row-selector');
        row.classList.toggle('selected', checkbox.checked);
    });
}

function addRow() {
    const newRowId = Math.max(...currentData.rows.map(r => r.id), -1) + 1;
    const newRow = {
        id: newRowId,
        values: new Array(currentData.headers.length).fill('')
    };
    
    currentData.rows.push(newRow);
    renderTable();
    checkForChanges();
    
    // Scroll to new row
    const newRowElement = elements.editTable.querySelector(`tr[data-row-id="${newRowId}"]`);
    if (newRowElement) {
        newRowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const firstInput = newRowElement.querySelector('input, textarea');
        if (firstInput) {
            firstInput.focus();
        }
    }
}

function deleteSelectedRow() {
    const selectedCheckboxes = elements.editTable.querySelectorAll('.row-selector:checked');
    const selectedRowIds = Array.from(selectedCheckboxes).map(cb => parseInt(cb.dataset.rowId));
    
    if (selectedRowIds.length === 0) return;
    
    const confirmMessage = selectedRowIds.length === 1 
        ? 'Are you sure you want to delete this row?' 
        : `Are you sure you want to delete ${selectedRowIds.length} rows?`;
    
    if (!confirm(confirmMessage)) return;
    
    // Remove selected rows
    currentData.rows = currentData.rows.filter(row => !selectedRowIds.includes(row.id));
    
    renderTable();
    checkForChanges();
    handleRowSelection(); // Update button states
}

function checkForChanges() {
    const originalStr = JSON.stringify(originalData);
    const currentStr = JSON.stringify(currentData);
    hasChanges = originalStr !== currentStr;
    
    updateButtonStates();
    updateChangesSummary();
}

function updateButtonStates() {
    elements.downloadBtn.style.display = hasChanges ? 'inline-flex' : 'none';
    elements.submitBtn.style.display = hasChanges ? 'inline-flex' : 'none';
    elements.resetBtn.disabled = !hasChanges;
    elements.previewBtn.disabled = !hasChanges;
}

function updateChangesSummary() {
    if (!hasChanges) {
        elements.changesSummary.style.display = 'none';
        return;
    }
    
    elements.changesSummary.style.display = 'block';
    
    const changes = calculateChanges();
    elements.changesList.innerHTML = '';
    
    changes.forEach(change => {
        const changeItem = document.createElement('div');
        changeItem.className = `change-item ${change.type}`;
        changeItem.innerHTML = `
            <strong>${change.type.charAt(0).toUpperCase() + change.type.slice(1)}:</strong> 
            ${escapeHtml(change.description)}
        `;
        elements.changesList.appendChild(changeItem);
    });
}

function calculateChanges() {
    const changes = [];
    
    // Check for added rows
    const originalRowIds = new Set(originalData.rows.map(r => r.id));
    const currentRowIds = new Set(currentData.rows.map(r => r.id));
    
    currentData.rows.forEach(row => {
        if (!originalRowIds.has(row.id)) {
            changes.push({
                type: 'added',
                description: `Row ${currentData.rows.indexOf(row) + 1}: ${row.values.slice(0, 2).join(', ')}...`
            });
        }
    });
    
    // Check for deleted rows
    originalData.rows.forEach(row => {
        if (!currentRowIds.has(row.id)) {
            changes.push({
                type: 'deleted',
                description: `Row with data: ${row.values.slice(0, 2).join(', ')}...`
            });
        }
    });
    
    // Check for modified rows
    currentData.rows.forEach(currentRow => {
        const originalRow = originalData.rows.find(r => r.id === currentRow.id);
        if (originalRow) {
            const hasRowChanges = JSON.stringify(currentRow.values) !== JSON.stringify(originalRow.values);
            if (hasRowChanges) {
                changes.push({
                    type: 'modified',
                    description: `Row ${currentData.rows.indexOf(currentRow) + 1}: ${currentRow.values.slice(0, 2).join(', ')}...`
                });
            }
        }
    });
    
    return changes;
}

function resetChanges() {
    if (!confirm('Are you sure you want to reset all changes? This cannot be undone.')) {
        return;
    }
    
    currentData = JSON.parse(JSON.stringify(originalData));
    renderTable();
    checkForChanges();
}

function cancelEdit() {
    if (hasChanges) {
        if (!confirm('You have unsaved changes. Are you sure you want to cancel editing?')) {
            return;
        }
    }
    
    // Clear selection and hide editor
    document.querySelectorAll('.file-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    elements.editorSection.style.display = 'none';
    currentFile = null;
    hasChanges = false;
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showPreview() {
    if (!hasChanges) return;
    
    elements.previewModal.style.display = 'flex';
    
    // Show table preview by default
    switchPreviewTab('table');
}

function switchPreviewTab(tab) {
    // Update tab buttons
    document.querySelectorAll('.preview-tabs .tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    
    // Update tab content
    document.querySelectorAll('.preview-tab').forEach(tabContent => {
        tabContent.classList.toggle('active', tabContent.id === `preview${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
    });
    
    // Load content for active tab
    switch (tab) {
        case 'table':
            renderPreviewTable();
            break;
        case 'csv':
            renderPreviewCSV();
            break;
        case 'diff':
            renderPreviewDiff();
            break;
    }
}

function renderPreviewTable() {
    const { headers, rows } = currentData;
    
    let tableHTML = '<table class="edit-table"><thead><tr>';
    headers.forEach(header => {
        tableHTML += `<th>${escapeHtml(header)}</th>`;
    });
    tableHTML += '</tr></thead><tbody>';
    
    rows.forEach(row => {
        tableHTML += '<tr>';
        row.values.forEach(value => {
            tableHTML += `<td>${escapeHtml(value)}</td>`;
        });
        tableHTML += '</tr>';
    });
    
    tableHTML += '</tbody></table>';
    elements.previewTable.innerHTML = tableHTML;
}

function renderPreviewCSV() {
    const csvContent = generateCSVContent();
    elements.csvPreviewCode.textContent = csvContent;
}

function renderPreviewDiff() {
    const changes = calculateChanges();
    
    let diffHTML = '';
    if (changes.length === 0) {
        diffHTML = '<p>No changes detected.</p>';
    } else {
        diffHTML = '<div class="diff-summary">';
        diffHTML += `<h4>Summary: ${changes.length} change(s)</h4>`;
        diffHTML += '<ul>';
        
        changes.forEach(change => {
            diffHTML += `<li class="diff-${change.type}">
                <strong>${change.type.charAt(0).toUpperCase() + change.type.slice(1)}:</strong> 
                ${escapeHtml(change.description)}
            </li>`;
        });
        
        diffHTML += '</ul></div>';
    }
    
    elements.diffContent.innerHTML = diffHTML;
}

function closePreviewModal() {
    elements.previewModal.style.display = 'none';
}

function saveChanges() {
    // In a real implementation, this would save to the server
    // For now, we'll just update the original data
    originalData = JSON.parse(JSON.stringify(currentData));
    hasChanges = false;
    
    updateButtonStates();
    updateChangesSummary();
    closePreviewModal();
    
    alert('Changes saved successfully! You can now download the updated CSV or create a PR.');
}

function generateCSVContent() {
    const { headers, rows } = currentData;
    
    // Helper function to properly escape and quote CSV fields
    function escapeCSVField(field) {
        const stringValue = String(field);
        
        // Always quote fields that contain commas, quotes, or newlines
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
        }
        
        return stringValue;
    }
    
    // Generate headers
    let csvContent = headers.map(escapeCSVField).join(',') + '\n';
    
    // Generate rows
    rows.forEach(row => {
        const csvRow = row.values.map(escapeCSVField).join(',');
        csvContent += csvRow + '\n';
    });
    
    return csvContent;
}

function downloadCSV() {
    const csvContent = generateCSVContent();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', currentFile);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

function showPRModal() {
    if (!hasChanges) return;
    
    // Pre-fill PR information
    const file = fileDefinitions[currentFile];
    elements.prTitle.value = `Update ${file.displayName} data`;
    
    const changes = calculateChanges();
    const changesSummary = changes.map(c => `- ${c.type}: ${c.description}`).join('\n');
    
    elements.prDescription.value = `Updated ${file.displayName} with the following changes:

${changesSummary}

These changes improve the accuracy and completeness of the ${file.category === 'laundry' ? 'laundry schedule' : 'mess menu'} information.`;
    
    elements.prModal.style.display = 'flex';
}

function closePRModal() {
    elements.prModal.style.display = 'none';
}

function copyPRInfo() {
    const prInfo = `Title: ${elements.prTitle.value}

Description:
${elements.prDescription.value}`;
    
    navigator.clipboard.writeText(prInfo).then(() => {
        alert('PR information copied to clipboard!');
    }).catch(err => {
        console.error('Failed to copy text: ', err);
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = prInfo;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('PR information copied to clipboard!');
    });
}

function downloadUpdatedCSV() {
    downloadCSV();
    closePRModal();
}

function showHelp() {
    alert(`Unmessify Data Editor Help

How to use:
1. Select a file to edit from the categories above
2. Make your changes in the table editor
3. Add or delete rows as needed
4. Preview your changes before saving
5. Download the updated CSV file
6. Create a pull request on GitHub

Tips:
- Use Tab to move between cells
- For menu items, use multi-line text in meal fields
- Always preview your changes before submitting
- Keep descriptions clear and concise

For more help, visit the GitHub repository.`);
}

function showLoading(text = 'Loading...') {
    elements.loadingText.textContent = text;
    elements.loadingOverlay.style.display = 'flex';
}

function hideLoading() {
    elements.loadingOverlay.style.display = 'none';
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, (m) => map[m]);
}

// Utility function for debouncing
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

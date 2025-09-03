# Unmessify Data
Data for Unmessify

## Overview

This repository contains CSV data files and their corresponding JSON representations in NocoDB API format. The JSON files are automatically generated from CSV files using GitHub Actions.

## Structure

```
├── csv/                       # Source CSV files
│   ├── VITC-A-L.csv          # Laundry: Date and RoomNumber data
│   ├── VITC-B-L.csv          # Laundry: Date and RoomNumber data
│   ├── VITC-CB-L.csv         # Laundry: Date and RoomNumber data
│   ├── VITC-CG-L.csv         # Laundry: Date and RoomNumber data
│   ├── VITC-D1-L.csv         # Laundry: Date and RoomNumber data
│   ├── VITC-D2-L.csv         # Laundry: Date and RoomNumber data
│   ├── VITC-M-N.csv          # Men's Non-Veg Menu (Day, Breakfast, Lunch, Snacks, Dinner)
│   ├── VITC-M-S.csv          # Men's Special Menu (Day, Breakfast, Lunch, Snacks, Dinner)
│   ├── VITC-M-V.csv          # Men's Veg Menu (Day, Breakfast, Lunch, Snacks, Dinner)
│   ├── VITC-W-N.csv          # Women's Non-Veg Menu (Day, Breakfast, Lunch, Snacks, Dinner)
│   ├── VITC-W-S.csv          # Women's Special Menu (Day, Breakfast, Lunch, Snacks, Dinner)
│   └── VITC-W-V.csv          # Women's Veg Menu (Day, Breakfast, Lunch, Snacks, Dinner)
├── json/                     # Generated JSON files (NocoDB API format)
│   ├── en/                  # Source (English) JSONs generated from CSV
│   ├── ta/                  # Tamil translations (generated via Gemini)
│   └── hi/                  # Hindi translations (generated via Gemini)
├── assets/                   # PWA icons and static assets
│   ├── icon-*.png           # App icons (various sizes)
│   └── icon.svg             # Source icon
├── index.html               # Main PWA application
├── styles.css               # Application styles
├── app.js                   # Application JavaScript
├── manifest.json            # PWA manifest
├── sw.js                    # Service Worker for offline support
├── convert_csv_to_json.py   # Python script for CSV to JSON conversion
└── .github/workflows/       # GitHub Actions workflows
    ├── csv-to-json.yml      # Auto-conversion workflow
    └── deploy-pages.yml     # GitHub Pages deployment
```

## JSON Format

The generated JSON files follow the NocoDB API format with the following structure:

```json
{
  "list": [
    {
      "Id": 1,
      "ncRecordId": "rec...",
      "ncRecordHash": "...",
      "Date": "1",
      "RoomNumber": null,
      "CreatedAt": "2025-07-01 00:00:00+00:00",
      "UpdatedAt": "2025-07-01 12:34:56+00:00"
    }
  ],
  "pageInfo": {
    "totalRows": 31,
    "page": 1,
    "pageSize": 50,
    "isFirstPage": true,
    "isLastPage": true
  },
  "stats": {
    "dbQueryTime": "1.234"
  }
}
```

## Automatic Conversion

When CSV files in the `csv/` directory are modified:

1. GitHub Actions automatically triggers the conversion workflow
2. The `convert_csv_to_json.py` script processes all CSV files
3. Updated JSON files are generated in the `json/` directory
4. Changes are automatically committed back to the repository

## Manual Conversion (English -> json/en)

To manually convert CSV files to JSON:

```powershell
# From project root (Windows PowerShell)
python .\convert_csv_to_json.py
```
JSON files will be written to `json/en/`.

## Data Types

### Laundry Assignment Files (VITC-*-L.csv)
- **Date**: Day number (1-31)
- **RoomNumber**: Room range assignment (e.g., "101 - 248") or null for no assignment

### Menu Files (VITC-M-*.csv, VITC-W-*.csv)
- **Day**: Day of the week (Monday, Tuesday, etc.)
- **Breakfast**: Breakfast menu items
- **Lunch**: Lunch menu items  
- **Snacks**: Snacks menu items
- **Dinner**: Dinner menu items

## Translations: English -> Tamil/Hindi

We provide a helper script to translate menu JSONs (Men/Women menus) using the Gemini API.

Prerequisites:
- Python 3.9+
- Install dependencies: `pip install -r requirements.txt`
- A valid Gemini API key

Usage (Windows PowerShell):
```powershell
$env:GEMINI_API_KEY = "<your_api_key>"
# Translate to both Tamil (ta) and Hindi (hi):
python .\translate_menus.py

# Or choose languages explicitly:
python .\translate_menus.py --langs ta hi
```
Outputs will be saved under `json/ta/` and `json/hi/` with the same filenames.

Note: The translator only processes menu files (VITC-M-*.json and VITC-W-*.json). Laundry files are skipped.

## Frontend Application

The repository includes a modern, responsive Progressive Web App (PWA) that provides an intuitive interface to explore the data:

🌐 **Live Site**: [https://kanishka-developer.github.io/unmessify/](https://kanishka-developer.github.io/unmessify/)

### Features

- **📱 Progressive Web App**: Install as a mobile app for offline access
- **🔍 Smart Search**: Search across all tables and data records
- **📊 Interactive Cards**: Visual overview of each data table with statistics
- **🎯 Filtering**: Filter by data type (Laundry or Menus)
- **📱 Responsive Design**: Optimized for both desktop and mobile devices
- **🌙 Dark Mode**: Automatic dark mode support based on system preferences
- **⚡ Fast Performance**: Lightweight design with service worker caching
- **🔗 Direct Links**: PWA shortcuts for quick access to specific data types

### PWA Installation

On mobile devices:
1. Open the website in your browser
2. Tap "Install App" button or browser's "Add to Home Screen"
3. Use the app like any native mobile application

On desktop:
1. Visit the website in Chrome/Edge
2. Click the install icon in the address bar
3. Install for quick access from your desktop

## Data Editor

The repository includes a web-based editor for updating the CSV data files:

🖊️ **Editor**: [https://kanishka-developer.github.io/unmessify/editor.html](https://kanishka-developer.github.io/unmessify/editor.html)

### Editor Features

- **📁 File Selection**: Easy selection from categorized file lists
- **📝 Table Editor**: Intuitive spreadsheet-like interface for editing data
- **➕ Row Management**: Add or delete rows as needed
- **👁️ Preview Changes**: Preview your changes before saving
- **📋 Change Tracking**: See exactly what changes you're making
- **💾 CSV Download**: Download the updated CSV file
- **🚀 PR Integration**: Pre-filled pull request templates for GitHub

### How to Update Data

1. **Access the Editor**: Go to the editor URL or click "Edit Data" in the main app
2. **Select File**: Choose the CSV file you want to edit from the categorized lists
3. **Make Changes**: Use the table interface to edit, add, or delete data
4. **Preview**: Review your changes using the preview feature
5. **Download**: Save the updated CSV file to your computer
6. **Create PR**: Fork the repository and create a pull request with your changes

### Supported Data Types

**Laundry Schedules** (Block A, B, CB, CG, D1, D2):
- Date: Day of the month
- RoomNumber: Room number ranges for laundry

**Mess Menus** (Men's & Women's - Non-Veg, Special, Veg):
- Day: Day of the week
- Breakfast: Morning meal items
- Lunch: Afternoon meal items  
- Snacks: Evening snack items
- Dinner: Night meal items

**Menu Types**:
- **N (Non-Veg)**: Menus with non-vegetarian options
- **S (Special)**: Special menu options and dishes
- **V (Veg)**: Vegetarian menu options

### Contributing

To contribute data updates:
1. Use the web editor to make your changes
2. Download the updated CSV file
3. Fork this repository on GitHub
4. Replace the old CSV file with your updated version
5. Create a pull request with a clear description of changes
6. Wait for review and merge

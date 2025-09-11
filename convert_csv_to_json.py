#!/usr/bin/env python3
"""
Script to convert CSV files to NocoDB API JSON format
"""

import csv
import json
import os
from datetime import datetime, timezone, timedelta
import hashlib
import uuid
import argparse
from typing import List

# Add IST timezone (UTC+5:30)
IST = timezone(timedelta(hours=5, minutes=30))

def generate_record_id():
    """Generate a unique record ID in NocoDB format"""
    return f"rec{uuid.uuid4().hex[:13]}"

def generate_record_hash():
    """Generate a record hash"""
    # use IST for consistency
    return hashlib.md5(f"{datetime.now(IST).isoformat()}{uuid.uuid4()}".encode()).hexdigest()

def convert_csv_to_nocodb_json(csv_file_path, table_name):
    """Convert a CSV file to NocoDB API JSON format"""
    records = []
    
    with open(csv_file_path, 'r', encoding='utf-8') as csvfile:
        # Read the CSV
        reader = csv.DictReader(csvfile)
        
        for index, row in enumerate(reader, start=1):
            # Convert empty strings to None for consistency with example
            cleaned_row = {}
            for key, value in row.items():
                cleaned_row[key] = value if value.strip() else None
            
            # Create record in NocoDB format
            now_ist = datetime.now(IST).isoformat(timespec='seconds').replace('T', ' ')
            record = {
                "Id": index,
                "ncRecordId": generate_record_id(),
                "ncRecordHash": generate_record_hash(),
                **cleaned_row,
                "CreatedAt": now_ist,
                "UpdatedAt": now_ist
            }
            
            records.append(record)
    
    # Calculate page info
    total_rows = len(records)
    
    # Create the final JSON structure
    result = {
        "list": records,
        "pageInfo": {
            "totalRows": total_rows,
            "page": 1,
            "pageSize": 50,
            "isFirstPage": True,
            "isLastPage": True
        },
        "stats": {
            "dbQueryTime": "1.234"
        }
    }
    
    return result

def _read_lines_file(path: str) -> List[str]:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return [ln.strip() for ln in f.readlines() if ln.strip()]
    except FileNotFoundError:
        return []


def main():
    """Main function to process CSV files (optionally only a provided subset)"""
    parser = argparse.ArgumentParser(description="Convert CSV files to json/en/*.json (NocoDB API-like format)")
    parser.add_argument("--files", nargs="*", help="Specific CSV files to process (e.g., csv/VITC-A-L.csv)")
    parser.add_argument("--from-file", dest="from_file", help="Text file containing newline-separated CSV paths to process selectively")
    args = parser.parse_args()

    csv_dir = "csv"
    json_dir = os.path.join("json", "en")

    # Create json/en directory if it doesn't exist
    os.makedirs(json_dir, exist_ok=True)

    # Build list of CSVs to process
    selected: List[str] = []
    if args.files:
        selected.extend(args.files)
    if args.from_file:
        selected.extend(_read_lines_file(args.from_file))

    # Normalize to paths within csv_dir when needed
    selected = [
        p if os.path.isabs(p) or p.startswith(csv_dir + os.sep) or p.startswith(csv_dir + "/")
        else os.path.join(csv_dir, p)
        for p in selected
    ]
    selected = [p for p in selected if p and p.lower().endswith(".csv") and os.path.exists(p)]

    # When no selection provided, process all CSV files (local/dev use)
    if not selected:
        selected = [os.path.join(csv_dir, f) for f in os.listdir(csv_dir) if f.lower().endswith(".csv")]

    if not selected:
        print("No CSV files to process.")
        return

    print(f"Processing {len(selected)} CSV file(s)...")

    # Process each selected CSV file
    for idx, csv_path in enumerate(sorted(selected), 1):
        filename = os.path.basename(csv_path)
        table_name = filename[:-4]  # Remove .csv extension

        print(f"[{idx}/{len(selected)}] Converting {filename} -> json/en/{table_name}.json")

        try:
            json_data = convert_csv_to_nocodb_json(csv_path, table_name)

            # Save JSON file
            json_filename = f"{table_name}.json"
            json_path = os.path.join(json_dir, json_filename)

            with open(json_path, 'w', encoding='utf-8') as jsonfile:
                json.dump(json_data, jsonfile, indent=2, ensure_ascii=False)

            print(f"  ✓ Wrote {json_filename}")

        except Exception as e:
            print(f"  ✗ Error processing {filename}: {str(e)}")

    print("\nConversion complete!")

if __name__ == "__main__":
    main()

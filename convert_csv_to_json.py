#!/usr/bin/env python3
"""
Script to convert CSV files to NocoDB API JSON format
"""

import csv
import json
import os
from datetime import datetime
import hashlib
import uuid

def generate_record_id():
    """Generate a unique record ID in NocoDB format"""
    return f"rec{uuid.uuid4().hex[:13]}"

def generate_record_hash():
    """Generate a record hash"""
    return hashlib.md5(f"{datetime.now().isoformat()}{uuid.uuid4()}".encode()).hexdigest()

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
            record = {
                "Id": index,
                "ncRecordId": generate_record_id(),
                "ncRecordHash": generate_record_hash(),
                **cleaned_row,
                "CreatedAt": "2025-07-01 00:00:00+00:00",
                "UpdatedAt": "2025-07-01 12:34:56+00:00"
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

def main():
    """Main function to process all CSV files"""
    csv_dir = "csv"
    json_dir = os.path.join("json", "en")
    
    # Create json/en directory if it doesn't exist
    os.makedirs(json_dir, exist_ok=True)
    
    # Process each CSV file
    for filename in os.listdir(csv_dir):
        if filename.endswith('.csv'):
            csv_path = os.path.join(csv_dir, filename)
            table_name = filename[:-4]  # Remove .csv extension
            
            print(f"Converting {filename} to JSON...")
            
            try:
                json_data = convert_csv_to_nocodb_json(csv_path, table_name)
                
                # Save JSON file
                json_filename = f"{table_name}.json"
                json_path = os.path.join(json_dir, json_filename)
                
                with open(json_path, 'w', encoding='utf-8') as jsonfile:
                    json.dump(json_data, jsonfile, indent=2, ensure_ascii=False)
                
                print(f"✓ Created {json_filename}")
                
            except Exception as e:
                print(f"✗ Error processing {filename}: {str(e)}")
    
    print("\nConversion complete!")

if __name__ == "__main__":
    main()

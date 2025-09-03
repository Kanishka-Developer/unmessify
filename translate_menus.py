#!/usr/bin/env python3
"""
Translate English menu JSONs (json/en) into Tamil (ta) and Hindi (hi) using the Gemini API,
saving outputs into json/<lang>/ with the same filenames.

Only menu files (VITC-M-*.json, VITC-W-*.json) are processed. Laundry files are skipped.

Requirements:
- Set environment variable GEMINI_API_KEY with your API key
- pip install -r requirements.txt

Usage (PowerShell):
  $env:GEMINI_API_KEY = "<your_key>"
  python translate_menus.py --langs ta hi

By default, translates to both ta and hi if --langs is not provided.
"""
import os
import json
import glob
import time
import argparse
from typing import Dict, List, Any

try:
    import google.generativeai as genai
except ImportError:
    raise SystemExit("google-generativeai is not installed. Run: pip install -r requirements.txt")

SRC_DIR = os.path.join("json", "en")
OUT_DIRS = {
    "ta": os.path.join("json", "ta"),
    "hi": os.path.join("json", "hi"),
}
MODEL_NAME = os.environ.get("GEMINI_MODEL", "gemini-1.5-flash")

MENU_FIELDS = ["Day", "Breakfast", "Lunch", "Snacks", "Dinner"]

SYSTEM_PROMPT = (
    "You are a careful localization assistant for canteen menus. Translate the given JSON values "
    "from English to the target language. Preserve the JSON structure and keys exactly. "
    "Translate food names idiomatically. Keep punctuation and separators (commas, slashes, hyphens). "
    "Do not add comments or extra fields. Return ONLY valid JSON."
)


def ensure_dirs(langs: List[str]):
    for lang in langs:
        os.makedirs(OUT_DIRS[lang], exist_ok=True)


def is_menu_file(filename: str) -> bool:
    base = os.path.basename(filename)
    name, _ = os.path.splitext(base)
    return ("-M-" in name) or ("-W-" in name)


def load_json(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path: str, data: Dict[str, Any]):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def build_translation_payload(record: Dict[str, Any]) -> Dict[str, Any]:
    payload = {}
    for key in MENU_FIELDS:
        val = record.get(key)
        if val is None:
            payload[key] = None
        else:
            payload[key] = str(val)
    return payload


def translate_fields(model: genai.GenerativeModel, payload: Dict[str, Any], target_lang: str) -> Dict[str, Any]:
    # Use JSON response to reduce parsing issues
    prompt = {
        "instruction": SYSTEM_PROMPT,
        "target_lang": target_lang,
        "fields": payload,
    }
    # generation_config response JSON
    response = model.generate_content(
        [
            "Translate the JSON values in 'fields' to the language code in 'target_lang'.\n"
            "Return ONLY the translated 'fields' object as strict JSON with the same keys.",
            f"target_lang: {target_lang}",
            "fields:",
            json.dumps(payload, ensure_ascii=False),
        ],
        generation_config={
            "response_mime_type": "application/json",
        },
    )

    text = response.text or ""
    # Gemini often returns just the JSON string when mime is set
    try:
        translated = json.loads(text)
        # If the model wraps in an object, try to access 'fields'
        if isinstance(translated, dict) and all(k in translated for k in MENU_FIELDS):
            return translated
        if isinstance(translated, dict) and "fields" in translated and isinstance(translated["fields"], dict):
            return translated["fields"]
        # As last resort, return payload unchanged
        return payload
    except json.JSONDecodeError:
        # Fallback: return original payload to avoid breaking structure
        return payload


def translate_record(model: genai.GenerativeModel, record: Dict[str, Any], lang: str) -> Dict[str, Any]:
    out = dict(record)
    payload = build_translation_payload(record)
    translated = translate_fields(model, payload, lang)
    for k, v in translated.items():
        out[k] = v
    return out


def translate_file(src_path: str, langs: List[str]) -> Dict[str, str]:
    base = os.path.basename(src_path)
    data = load_json(src_path)

    results = {}
    for lang in langs:
        model = genai.GenerativeModel(MODEL_NAME)
        translated_data = dict(data)
        translated_list = []
        for i, rec in enumerate(data.get("list", [])):
            # Only modify menu fields; keep other keys as-is
            translated_rec = translate_record(model, rec, lang)
            translated_list.append(translated_rec)
            # brief pacing to avoid rate limits
            if (i + 1) % 8 == 0:
                time.sleep(0.5)
        translated_data["list"] = translated_list

        out_path = os.path.join(OUT_DIRS[lang], base)
        save_json(out_path, translated_data)
        results[lang] = out_path
    return results


def main():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise SystemExit("GEMINI_API_KEY is not set. Please export it before running.")

    genai.configure(api_key=api_key)

    parser = argparse.ArgumentParser(description="Translate menu JSONs to ta/hi using Gemini")
    parser.add_argument("--langs", nargs="*", default=["ta", "hi"], choices=["ta", "hi"], help="Languages to translate to")
    args = parser.parse_args()

    langs: List[str] = args.langs if args.langs else ["ta", "hi"]
    ensure_dirs(langs)

    files = sorted(glob.glob(os.path.join(SRC_DIR, "*.json")))
    menu_files = [f for f in files if is_menu_file(f)]

    if not menu_files:
        print("No menu JSON files found in json/en. Nothing to translate.")
        return

    print(f"Translating {len(menu_files)} menu files to: {', '.join(langs)}")
    for idx, path in enumerate(menu_files, 1):
        print(f"[{idx}/{len(menu_files)}] {os.path.basename(path)}")
        try:
            out_map = translate_file(path, langs)
            for lang, outp in out_map.items():
                print(f"  -> {lang}: {outp}")
        except Exception as e:
            print(f"  !! Failed: {e}")
            # continue with next file
            continue

    print("\nDone.")


if __name__ == "__main__":
    main()

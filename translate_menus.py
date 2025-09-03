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
MODEL_NAME = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")

MENU_FIELDS = ["Day", "Breakfast", "Lunch", "Snacks", "Dinner"]
# Only these fields should be translated; 'Day' must remain exactly as-is
TRANSLATABLE_FIELDS = ["Breakfast", "Lunch", "Snacks", "Dinner"]

SYSTEM_PROMPT = (
    "You are a careful localization assistant for mess menus. Translate ONLY the provided JSON values "
    "from English to the target language. Preserve the JSON structure and keys exactly. "
    "Translate food names idiomatically and in the native script of the target language. "
    "Keep punctuation and separators (commas, slashes, hyphens, numbers) unchanged. "
    "Do not add comments or extra fields. Return ONLY valid JSON. "
    "Do NOT translate or modify the 'Day' field."
)

# Hints per language to strongly discourage Latin transliteration
SCRIPT_HINTS = {
    "hi": "Use Devanagari script for Hindi (e.g., देवनागरी). Do NOT use Latin letters for words.",
    "ta": "Use Tamil script for Tamil (e.g., தமிழ்). Do NOT use Latin letters for words.",
}


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


def build_translation_payload(record: Dict[str, Any], fields_to_translate: List[str]) -> Dict[str, Any]:
    payload = {}
    for key in fields_to_translate:
        val = record.get(key)
        if val is None:
            payload[key] = None
        else:
            payload[key] = str(val)
    return payload


def _has_target_script(text: str, lang: str) -> bool:
    if not isinstance(text, str) or not text:
        return False
    # Unicode ranges
    ranges = {
        "hi": [(0x0900, 0x097F)],  # Devanagari
        "ta": [(0x0B80, 0x0BFF)],  # Tamil
    }
    latin = 0
    target = 0
    total_letters = 0
    for ch in text:
        code = ord(ch)
        if (65 <= code <= 90) or (97 <= code <= 122):
            latin += 1
            total_letters += 1
        # count letters in target ranges
        for lo, hi in ranges.get(lang, []):
            if lo <= code <= hi:
                target += 1
                total_letters += 1
                break
    # Heuristic: require some target script and avoid high latin proportion
    if target >= 10:
        return True
    if target >= 5 and (latin == 0 or target / max(1, (latin + target)) >= 0.6):
        return True
    return False


def translate_fields(
    model: genai.GenerativeModel,
    payload: Dict[str, Any],
    target_lang: str,
    keys: List[str],
) -> Dict[str, Any]:
    # Common content to send
    base_content = [
        SYSTEM_PROMPT,
        f"Target language code: {target_lang}",
        SCRIPT_HINTS.get(target_lang, ""),
        "Translate the JSON values in 'fields' to the target language using its native script.\n"
        "Return ONLY the translated 'fields' object as strict JSON with exactly the same keys.",
        "fields:",
        json.dumps(payload, ensure_ascii=False),
    ]

    def _invoke(stronger: bool = False) -> Dict[str, Any]:
        content = list(base_content)
        if stronger:
            content.insert(
                0,
                "STRICT: Use only the native script (no Latin letters) for words. Keep numbers and punctuation as-is.",
            )
        response = model.generate_content(
            content,
            generation_config={
                "response_mime_type": "application/json",
                "temperature": 0.2,
            },
        )
        text = (response.text or "").strip()
        try:
            translated = json.loads(text)
            # If the model wraps in an object, try to access 'fields'
            if isinstance(translated, dict) and all(k in translated for k in keys):
                return {k: translated[k] for k in keys}
            if isinstance(translated, dict) and "fields" in translated and isinstance(translated["fields"], dict):
                inner = translated["fields"]
                if all(k in inner for k in keys):
                    return {k: inner[k] for k in keys}
            return {}
        except json.JSONDecodeError:
            return {}

    # First attempt
    out = _invoke(stronger=False)
    if not out:
        out = payload.copy()
    # Validate for transliteration issues; retry once if needed
    needs_retry = any(
        isinstance(v, str) and len(v) > 0 and not _has_target_script(v, target_lang)
        for v in out.values()
        if v is not None
    )
    if needs_retry:
        retry = _invoke(stronger=True)
        if retry:
            out = retry
    # Ensure missing keys are filled from payload
    for k in keys:
        if k not in out or out[k] is None:
            out[k] = payload.get(k)
    return out


def translate_record(model: genai.GenerativeModel, record: Dict[str, Any], lang: str) -> Dict[str, Any]:
    out = dict(record)
    # Build payload only for translatable fields; keep Day unchanged
    payload = build_translation_payload(record, TRANSLATABLE_FIELDS)
    translated = translate_fields(model, payload, lang, TRANSLATABLE_FIELDS)
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

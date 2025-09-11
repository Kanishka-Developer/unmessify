#!/usr/bin/env python3
"""
Translate English menu JSONs (json/en) into Tamil (ta) and Hindi (hi) using the Gemini API,
saving outputs into json/<lang>/ with the same filenames.

Default behavior:
- Translates only menu files (VITC-M-*.json, VITC-W-*.json).
- Laundry files (e.g., *-L.json) are not translated, but can be copied 1:1 for parity.

Selective mode for CI:
- Provide --files or --from-file with a list of json/en/*.json files. The script will:
    - Translate only changed menu files.
    - Copy only changed laundry files.
- Use --parity-only to skip translation entirely and only copy laundry files (no API needed).

Requirements:
- pip install -r requirements.txt (only needed for translation)
- Set GEMINI_API_KEY when translation is required.

Usage (PowerShell):
    # Translate all menus (requires API key)
    $env:GEMINI_API_KEY = "<your_key>"
    python translate_menus.py --langs ta hi

    # Translate only changed files listed in changed.txt and ensure laundry parity
    python translate_menus.py --from-file changed.txt --langs ta hi

    # Copy laundry files only (no API key required)
    python translate_menus.py --parity-only --from-file changed.txt --langs ta hi
"""
import os
import json
import glob
import time
import argparse
from typing import Dict, List, Any, Optional

# Import Gemini SDK lazily only when translation is required
genai = None  # type: ignore

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


def is_laundry_file(filename: str) -> bool:
    base = os.path.basename(filename)
    name, _ = os.path.splitext(base)
    # Treat files ending with -L as laundry files
    return name.endswith("-L") and not is_menu_file(filename)


def load_json(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path: str, data: Dict[str, Any]):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def copy_file(src_path: str, lang: str) -> str:
    base = os.path.basename(src_path)
    out_path = os.path.join(OUT_DIRS[lang], base)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(src_path, "r", encoding="utf-8") as fsrc, open(out_path, "w", encoding="utf-8") as fdst:
        fdst.write(fsrc.read())
    return out_path


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
    model,
    payload: Dict[str, Any],
    target_lang: str,
    keys: List[str],
) -> Dict[str, Any]:
    """
    Legacy helper kept for potential reuse. Not used by the new batch flow.
    Performs a single-record translation request.
    """
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


def translate_menu_batch(
    model,
    records: List[Dict[str, Any]],
    target_lang: str,
) -> List[Dict[str, Any]]:
    """
    Translate all menu records in ONE API REQUEST for a given language.

    Returns a list of dicts with translated values for TRANSLATABLE_FIELDS,
    preserving array length and order.
    """
    keys = TRANSLATABLE_FIELDS
    # Build minimal payload of only translatable fields to avoid any accidental edits.
    payload_list: List[Dict[str, Any]] = []
    for rec in records:
        item: Dict[str, Any] = {}
        for k in keys:
            val = rec.get(k)
            item[k] = (str(val) if val is not None else None)
        payload_list.append(item)

    # Compose the prompt content
    base_content = [
        SYSTEM_PROMPT,
        f"Target language code: {target_lang}",
        SCRIPT_HINTS.get(target_lang, ""),
        (
            "You will receive an array named 'records'. Each item has keys: "
            f"{', '.join(keys)}. Translate ONLY the values to the target language using its native script. "
            "Keep numbers, commas, slashes, hyphens, and parentheses exactly as-is. "
            "Do NOT add or remove items, do NOT reorder, and return EXACTLY a JSON object with key 'records' "
            "whose value is an array of the same length of objects with the SAME keys."
        ),
        "records:",
        json.dumps(payload_list, ensure_ascii=False),
    ]

    def _invoke(stronger: bool = False) -> List[Dict[str, Any]]:
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
            obj = json.loads(text)
        except json.JSONDecodeError:
            return []
        # Accept either {"records": [...]} or just [...]
        recs = None
        if isinstance(obj, dict) and isinstance(obj.get("records"), list):
            recs = obj.get("records")
        elif isinstance(obj, list):
            recs = obj
        else:
            return []
        # Validate structure: list of dicts with required keys
        if not isinstance(recs, list) or len(recs) != len(payload_list):
            return []
        cleaned: List[Dict[str, Any]] = []
        for item in recs:
            if not isinstance(item, dict):
                return []
            cleaned.append({k: item.get(k) for k in keys})
        return cleaned

    # First attempt in one request
    out_list = _invoke(stronger=False)
    if not out_list:
        # fallback to original payload (no translation)
        out_list = payload_list
    # Check for transliteration issues; if too many look wrong, retry once stronger
    bad_count = 0
    total_checked = 0
    for item in out_list:
        for v in item.values():
            if v is None:
                continue
            total_checked += 1
            if isinstance(v, str) and v.strip():
                if not _has_target_script(v, target_lang):
                    bad_count += 1
    # Retry if more than 25% of checked values appear transliterated
    if total_checked > 0 and bad_count / total_checked > 0.25:
        retry = _invoke(stronger=True)
        if retry:
            out_list = retry
    # Ensure all mandatory keys present; fill missing with source
    fixed: List[Dict[str, Any]] = []
    for src_item, out_item in zip(payload_list, out_list):
        merged: Dict[str, Any] = {}
        for k in keys:
            val = out_item.get(k) if isinstance(out_item, dict) else None
            if val is None:
                val = src_item.get(k)
            merged[k] = val
        fixed.append(merged)
    return fixed


def translate_record(model, record: Dict[str, Any], lang: str) -> Dict[str, Any]:
    """Single-record translation (unused in batch flow). Kept for completeness."""
    out = dict(record)
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
        model = genai.GenerativeModel(MODEL_NAME)  # type: ignore
        translated_data = dict(data)
        src_list: List[Dict[str, Any]] = list(data.get("list", []))
        # ONE REQUEST per menu file per language
        translated_fields_list = translate_menu_batch(model, src_list, lang)
        # Merge translated fields back into full records (preserve Day and other keys)
        merged_list: List[Dict[str, Any]] = []
        for rec, tfields in zip(src_list, translated_fields_list):
            new_rec = dict(rec)
            for k in TRANSLATABLE_FIELDS:
                if tfields is not None and isinstance(tfields, dict) and k in tfields:
                    new_rec[k] = tfields[k]
            # Explicitly preserve Day as-is from source
            if "Day" in rec:
                new_rec["Day"] = rec["Day"]
            merged_list.append(new_rec)
        translated_data["list"] = merged_list

        out_path = os.path.join(OUT_DIRS[lang], base)
        save_json(out_path, translated_data)
        results[lang] = out_path
    return results


def read_lines_file(path: str) -> List[str]:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return [ln.strip() for ln in f.readlines() if ln.strip()]
    except FileNotFoundError:
        return []


def main():
    parser = argparse.ArgumentParser(description="Translate menu JSONs to ta/hi using Gemini, with optional parity-only mode")
    parser.add_argument("--langs", nargs="*", default=["ta", "hi"], choices=["ta", "hi"], help="Languages to translate/copy to")
    parser.add_argument("--files", nargs="*", help="Specific json/en/*.json files to process selectively")
    parser.add_argument("--from-file", dest="from_file", help="Path to a text file containing newline-separated json/en/*.json paths")
    parser.add_argument("--parity-only", action="store_true", help="Only ensure laundry JSON parity (copy -L files); do not translate")
    parser.add_argument("--no-ensure-laundry-parity", dest="ensure_parity", action="store_false", help="Do not perform laundry parity copying")
    parser.set_defaults(ensure_parity=True)
    args = parser.parse_args()

    langs: List[str] = args.langs if args.langs else ["ta", "hi"]
    ensure_dirs(langs)

    # Build candidate file list
    selected: List[str] = []
    if args.files:
        selected.extend(args.files)
    if args.from_file:
        selected.extend(read_lines_file(args.from_file))
    # Normalize paths to use SRC_DIR base if relative
    selected = [p if os.path.isabs(p) or p.startswith(SRC_DIR) else os.path.join(SRC_DIR, p) for p in selected]
    selected = [p for p in selected if p and os.path.splitext(p)[1].lower() == ".json" and os.path.exists(p)]

    # If parity-only is requested, copy laundry files and exit
    if args.parity_only:
        # In parity-only mode, only consider laundry files from 'selected' (if provided), else scan all
        if selected:
            laundry = [p for p in selected if is_laundry_file(p)]
        else:
            laundry = [p for p in glob.glob(os.path.join(SRC_DIR, "*.json")) if is_laundry_file(p)]
        if not laundry:
            print("No laundry JSON files to copy for parity.")
            return
        print(f"Copying {len(laundry)} laundry JSON files for parity -> {', '.join(langs)}")
        for idx, path in enumerate(laundry, 1):
            base = os.path.basename(path)
            print(f"[{idx}/{len(laundry)}] {base}")
            for lang in langs:
                outp = copy_file(path, lang)
                print(f"  -> {lang}: {outp}")
        print("\nDone (parity-only).")
        return

    # Translation required: initialize Gemini API lazily
    try:
        import google.generativeai as _genai  # type: ignore
        global genai
        genai = _genai
    except Exception as e:
        raise SystemExit("google-generativeai is not installed. Run: pip install -r requirements.txt")

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise SystemExit("GEMINI_API_KEY is not set. Please export it before running.")
    genai.configure(api_key=api_key)  # type: ignore

    # Determine which files to translate
    if selected:
        menu_files = [p for p in selected if is_menu_file(p)]
        laundry_files = [p for p in selected if is_laundry_file(p)]
    else:
        files = sorted(glob.glob(os.path.join(SRC_DIR, "*.json")))
        menu_files = [f for f in files if is_menu_file(f)]
        laundry_files = []

    if not menu_files and not (args.ensure_parity and laundry_files):
        if not menu_files:
            print("No menu JSON files to translate.")
        # It's okay if no laundry files either
        return

    if menu_files:
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

    # Optionally ensure laundry parity by copying selected laundry files (if any)
    if args.ensure_parity and laundry_files:
        print(f"Ensuring laundry parity for {len(laundry_files)} files -> {', '.join(langs)}")
        for idx, path in enumerate(laundry_files, 1):
            base = os.path.basename(path)
            print(f"[L {idx}/{len(laundry_files)}] {base}")
            for lang in langs:
                outp = copy_file(path, lang)
                print(f"  -> {lang}: {outp}")

    print("\nDone.")


if __name__ == "__main__":
    main()

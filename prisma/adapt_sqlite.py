#!/usr/bin/env python3
"""Adapt MASOMO Postgres-specific code to SQLite.

Changes:
1. Remove `, mode: 'insensitive'` from all Prisma queries (SQLite uses default
   case-insensitive LIKE for ASCII).
2. Replace `array_to_string("Teacher"."subjects", ' ') ILIKE` raw SQL with a
   SQLite-compatible equivalent using LOWER() and LIKE.
"""
import re
from pathlib import Path

SRC = Path("/home/z/my-project/src")

def strip_insensitive(text: str) -> str:
    patterns = [
        r",\s*mode:\s*['\"]insensitive['\"]\s+as\s+const",
        r",\s*mode:\s*['\"]insensitive['\"]",
    ]
    for p in patterns:
        text = re.sub(p, "", text)
    # Standalone leftover
    text = re.sub(r"mode:\s*['\"]insensitive['\"]\s+as\s+const,\s*", "", text)
    text = re.sub(r"mode:\s*['\"]insensitive['\"]\s+as\s+const", "", text)
    text = re.sub(r"mode:\s*['\"]insensitive['\"]", "", text)
    return text

def fix_raw_sql(text: str) -> str:
    text = text.replace(
        "array_to_string(\"subjects\", ' ') ILIKE",
        "LOWER(subjects) LIKE LOWER",
    )
    return text

count_files = 0
for path in list(SRC.rglob("*.ts")) + list(SRC.rglob("*.tsx")):
    if "/node_modules/" in str(path):
        continue
    try:
        text = path.read_text(encoding="utf-8")
    except Exception:
        continue
    orig = text
    text = strip_insensitive(text)
    text = fix_raw_sql(text)
    if text != orig:
        path.write_text(text, encoding="utf-8")
        count_files += 1

print(f"Modified {count_files} files")

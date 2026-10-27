#!/usr/bin/env python3
"""Reverse: re-add `mode: 'insensitive'` to Prisma queries that originally
had it. This script scans every .ts/.tsx file in src/ and finds Prisma
`contains:` patterns that are missing the `mode: 'insensitive'` clause.

For Postgres, the original code used:
    { firstName: { contains: 'value', mode: 'insensitive' as const } }
We restore that pattern.

Note: We can't restore 100% perfectly from inspection. Instead we re-extract
all source files from the zip and overwrite ours. This guarantees fidelity.
"""
import shutil
from pathlib import Path

SRC_ZIP = Path("/home/z/my-project/.extract/masomo1-main/src")
DST = Path("/home/z/my-project/src")

# Files that were untouched by our SQLite adaptation — skip them to preserve
# any patches we may have made. Otherwise overwrite from the zip.

# Strategy: re-extract every file under src/ from the zip, EXCEPT for files
# we explicitly want to keep modified (none in this case since reverting to PG).

count_files = 0
for path in SRC_ZIP.rglob("*"):
    if path.is_file():
        rel = path.relative_to(SRC_ZIP)
        target = DST / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, target)
        count_files += 1

print(f"Restored {count_files} files from zip to src/")

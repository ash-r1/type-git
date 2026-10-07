#!/usr/bin/env python3
"""Compile pinned Git option tables without executing Git, and record integer metadata."""
import hashlib
import json
import os
import re
from pathlib import Path
import shlex
import subprocess
import sys
import tempfile
from git_numeric_dump import extract_numeric_tables

root = Path(sys.argv[1]).resolve()
repo = Path(__file__).resolve().parent.parent
if 'DEF_VER=v2.55.0' not in (root / 'GIT-VERSION-GEN').read_text():
    raise ValueError('Expected Git 2.55.0 source tree')
compiler = os.environ.get('TYPE_GIT_SPEC_CC', 'cc')
macros = subprocess.check_output([compiler, '-dM', '-E', '-x', 'c', '-'], input='', text=True)
char_bits = int(re.search(r'^#define __CHAR_BIT__ (\d+)$', macros, re.M)[1])
if char_bits != 8:
    raise ValueError('The recorded profile requires 8-bit bytes')
upstream = json.loads((repo / 'spec/upstream/git-option-tables.json').read_text())
files = [f for f in upstream['files'] if any(o['kind'] in ['OPTION_INTEGER', 'OPTION_UNSIGNED'] for t in f['tables'] for o in t['options'])]
expected = {(f['file'], t.get('function'), t['name'], o.get('long') or o.get('short'), o['kind']) for f in files for t in f['tables'] for o in t['options'] if o['kind'] in ['OPTION_INTEGER', 'OPTION_UNSIGNED']}
sources = {'parse-options.c', 'parse.c', 'GIT-VERSION-GEN'}
records = []
with tempfile.TemporaryDirectory(prefix='type-git-numeric-') as directory:
    folder = Path(directory)
    for f in files:
        dump = folder / 'original.txt'
        dependencies = folder / 'dependencies.d'
        args = [compiler, '-I', str(root), '-O0', '-MMD', '-MF', str(dependencies), '-MT', 'typegit', '-fdump-tree-original-raw=' + str(dump), '-c', str(root / f['file']), '-o', str(folder / 'object.o')]
        process = subprocess.run(args, cwd=root, capture_output=True, text=True, timeout=120)
        if process.returncode:
            raise ValueError(f"{f['file']}: compiler failed\n{process.stderr}")
        text = dependencies.read_text().replace('\\\n', '')
        for entry in shlex.split(text.split(':', 1)[1]):
            dependency = Path(entry)
            if not dependency.is_absolute():
                dependency = root / dependency
            try:
                sources.add(dependency.resolve().relative_to(root).as_posix())
            except ValueError:
                raise ValueError(f'Unexpected non-Git dependency: {dependency}')
        rows = extract_numeric_tables(dump, char_bits)
        for row in rows:
            identity = (f['file'], row['function'], row['table'], row['flag'], row['kind'])
            if identity not in expected:
                raise ValueError(f'Unexpected numeric table entry: {identity}')
            records.append({'file': f['file'], **row})
        print(f"Compiled {f['file']}: {len(rows)} numeric options.", flush=True)
actual = {(r['file'], r['function'], r['table'], r['flag'], r['kind']) for r in records}
if actual != expected or len(actual) != len(records):
    raise ValueError(f'Numeric table coverage mismatch: missing={expected - actual}, extra={actual - expected}')
profile = {
    'command': compiler,
    'charBits': char_bits,
    'version': subprocess.check_output([compiler, '--version'], text=True).splitlines()[0],
    'target': subprocess.check_output([compiler, '-dumpmachine'], text=True).strip(),
    'flags': ['-I<git-root>', '-O0', '-MMD', '-fdump-tree-original-raw', '-c'],
}
result = {
    'format': 1,
    'version': '2.55.0',
    'scope': 'Every OPTION_INTEGER and OPTION_UNSIGNED entry in the pinned preprocessed tables. Compiler-evaluated precision, defaults and flags; no Git execution.',
    'profile': profile,
    'sources': {name: hashlib.sha256((root / name).read_bytes()).hexdigest() for name in sorted(sources)},
    'options': sorted(records, key=lambda r: (r['file'], r['function'] or '', r['table'], r['flag'], r['kind'])),
}
target = repo / 'spec/upstream/git-numeric-options.json'
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(result, indent=2) + '\n')
print(f'Recorded {len(records)} numeric options and {len(sources)} source fingerprints.')

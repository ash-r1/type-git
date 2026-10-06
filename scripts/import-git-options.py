#!/usr/bin/env python3
"""Extract Git's expanded parse-options tables without executing Git commands.

Input is a Git 2.55.0 source tree and a C preprocessor for the target profile.
Tables are candidates until command/operation scope and callback semantics are audited.
"""
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys

root = Path(sys.argv[1]).resolve()
if 'DEF_VER=v2.55.0' not in (root / 'GIT-VERSION-GEN').read_text():
    raise ValueError('Expected Git 2.55.0 source tree')
compiler = os.environ.get('TYPE_GIT_SPEC_CC', 'cc')

def split(text, delimiter=','):
    parts, start, stack, quote, escaped = [], 0, [], None, False
    for i, char in enumerate(text):
        if quote:
            if escaped: escaped = False
            elif char == '\\': escaped = True
            elif char == quote: quote = None
        elif char in ['"', "'"]: quote = char
        elif char in '([{': stack.append(char)
        elif char in ')]}':
            if stack: stack.pop()
        elif char == delimiter and not stack:
            parts.append(text[start:i].strip()); start = i + 1
    if text[start:].strip(): parts.append(text[start:].strip())
    return parts

def closing(text, start):
    depth, quote, escaped = 0, None, False
    for i in range(start, len(text)):
        char = text[i]
        if quote:
            if escaped: escaped = False
            elif char == '\\': escaped = True
            elif char == quote: quote = None
        elif char in ['"', "'"]: quote = char
        elif char == '{': depth += 1
        elif char == '}':
            depth -= 1
            if depth == 0: return i
    raise ValueError('Unterminated initializer')

def decode_string(expr):
    tokens = re.findall(r'"(?:\\.|[^"\\])*"', expr)
    if not tokens: return None
    remaining = re.sub(r'"(?:\\.|[^"\\])*"', '', expr)
    if re.sub(r'[\s()]', '', remaining): return None
    return ''.join(json.loads(t) for t in tokens)

fields_order = ['type', 'short_name', 'long_name', 'value', 'precision', 'argh', 'help', 'flags', 'callback', 'defval', 'll_callback', 'extra', 'subcommand_fn']

def extract(file):
    result = subprocess.run([compiler, '-E', '-P', '-I.', str(file)], cwd=root, text=True, capture_output=True)
    if result.returncode:
        return dict(file=str(file), error=result.stderr.strip())
    source = result.stdout
    functions = []
    # Enclosing parser functions identify local tables. Header functions have no
    # parse-options tables, so retaining them in this interval list is harmless.
    for match in re.finditer(r'(?m)^(?:(?:static|inline|__inline__)\s+)*(?:int|void|char\s*\*|struct\s+\w+\s*\*)\s*(\w+)\s*\([^;{}]*\)\s*\{', source):
        functions.append((match.start(), closing(source, match.end()-1), match[1]))
    tables = []
    for match in re.finditer(r'\bstruct\s+option\s+(\w+)\s*\[[^\]]*\]\s*=\s*\{', source):
        end = closing(source, match.end()-1)
        owner = next((name for begin, finish, name in reversed(functions) if begin <= match.start() < finish), None)
        options = []
        for entry in split(source[match.end():end]):
            if not entry.startswith('{') or not entry.endswith('}'):
                raise ValueError(f'{file}:{match[1]}: nonliteral table entry {entry[:80]}')
            fields = {}
            cursor = 0
            for item in split(entry[1:-1]):
                designated = re.match(r'\.(\w+)\s*=\s*(.*)', item, re.S)
                if designated:
                    key, value = designated.groups()
                    fields[key] = re.sub(r'\s+', ' ', value).strip()
                    if key in fields_order: cursor = fields_order.index(key) + 1
                else:
                    fields[fields_order[cursor]] = re.sub(r'\s+', ' ', item).strip(); cursor += 1
            fields.pop('help', None)
            kind = fields.get('type', '')
            if kind in ['OPTION_END', 'OPTION_GROUP']: continue
            long = decode_string(fields.get('long_name', ''))
            short = re.search(r"'((?:\\.|[^'])*)'", fields.get('short_name', ''))
            short = short[1] if short else None
            if short in [r'\0', r'\000', r'\x00']: short = None
            options.append(dict(kind=kind, long=long, short=short, fields=fields))
        tables.append(dict(name=match[1], function=owner, options=options))
    return dict(file=str(file), sha256=hashlib.sha256((root/file).read_bytes()).hexdigest(), tables=tables)

files = sorted(Path('builtin')/p.name for p in (root/'builtin').glob('*.c'))
files += sorted(Path(p.name) for p in root.glob('*.c') if 'struct option' in p.read_text())
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
    results = list(executor.map(extract, files))
report = dict(baseline='2.55.0', profile=dict(compiler=compiler, compilerVersion=subprocess.check_output([compiler, '--version'], text=True).splitlines()[0], target=subprocess.check_output([compiler, '-dumpmachine'], text=True).strip(), flags=['-E','-P','-I.']), extraction='Expanded option table candidates. Not a command scope map or completeness claim.', headers={'parse-options.h':hashlib.sha256((root/'parse-options.h').read_bytes()).hexdigest()}, files=results)
output = Path(__file__).resolve().parent.parent/'spec/upstream/git-option-tables.json'
output.write_text(json.dumps(report, indent=2)+'\n')
errors = [r for r in results if 'error' in r]
print(f'Extracted {sum(len(r.get("tables", [])) for r in results)} tables from {len(results)-len(errors)} sources; {len(errors)} preprocessing failures recorded.')
for error in errors: print(error['file']+': '+error['error'].splitlines()[-1])

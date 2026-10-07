#!/usr/bin/env python3
"""Deterministic candidates from pinned Git's manual revision parsers.

Literal tests establish spellings, not semantics. Scopes and state transitions are
reviewed separately. Numeric shorthand and repository-dependent branches remain explicit.
"""
import hashlib
import json
from pathlib import Path
import re
import sys
root = Path(sys.argv[1]).resolve()
if 'DEF_VER=v2.55.0' not in (root/'GIT-VERSION-GEN').read_text():
    raise ValueError('Expected Git 2.55.0 source')

def body(text, name):
    # Keep quoted text while removing comments, then match a function definition.
    clean = re.sub(r'"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|/\*.*?\*/|//[^\n]*', lambda m: m[0] if m[0][0] in '\"\'' else ' ', text, flags=re.S)
    match = re.search(r'\b'+re.escape(name)+r'\([^;{}]*\)\s*\{', clean)
    if not match: raise ValueError('Missing function '+name)
    start = match.end(); depth=1; quote=None; escaped=False
    for i in range(start,len(clean)):
        c=clean[i]
        if quote:
            if escaped: escaped=False
            elif c=='\\': escaped=True
            elif c==quote: quote=None
        elif c in '\"\'': quote=c
        elif c=='{': depth+=1
        elif c=='}':
            depth-=1
            if depth==0:return clean[start:i]
    raise ValueError('Unclosed function '+name)

files=[]; options={}
for file, functions in [('revision.c',['handle_revision_opt','handle_revision_pseudo_opt','setup_revisions']),('diff-merges.c',['diff_merges_parse_opts'])]:
    text=(root/file).read_text(); files.append({'file':file,'sha256':hashlib.sha256((root/file).read_bytes()).hexdigest(),'functions':functions})
    for function in functions:
        source=body(text,function)
        patterns=[('flag',r'strcmp\(arg,\s*"(-[^"=]+)"\)'),('value',r'(?:skip_prefix|starts_with)\(arg,\s*"(-[^"=]+)="'),('value',r'parse_long_opt\("([^"]+)"')]
        for kind,pattern in patterns:
            for match in re.finditer(pattern,source):
                flag=match[1] if match[1].startswith('-') else '--'+match[1]
                if flag=='--':continue
                item=options.setdefault(flag,{'forms':[],'sources':[]})
                if kind not in item['forms']:item['forms'].append(kind)
                origin=f'{file}:{function}'
                if origin not in item['sources']:item['sources'].append(origin)
report={'baseline':'2.55.0','scope':'Literal option-test candidates; not proof of complete argument or callback semantics. Numeric shorthand -<n> and attached -n<n> require separate handling.','files':files,'options':dict(sorted(options.items()))}
out=Path(__file__).resolve().parent.parent/'spec/upstream/git-revision-options.json'
out.write_text(json.dumps(report,indent=2)+'\n')
print(f'Extracted {len(options)} manual revision option candidates.')

#!/usr/bin/env python3
"""Extract the pinned git-svn declaration tables without loading Perl/SVN code.

Usage: python3 scripts/extract-svn-options.py /path/to/git-2.55.0 [--check]
This intentionally supports the pinned table syntax, not arbitrary Perl.
"""
import hashlib
import json
import re
import sys
from pathlib import Path

if 'DEF_VER=v2.55.0' not in (Path(sys.argv[1]) / 'GIT-VERSION-GEN').read_text():
    raise ValueError('Expected Git 2.55.0 source tree')

source_path = Path(sys.argv[1]) / 'git-svn.perl'
source = source_path.read_text()
shared = {}
for name in ['remote_opts', 'fc_opts', 'init_opts', 'cmt_opts']:
    shared[name] = source.split('my %' + name + ' = (', 1)[1].split(');', 1)[0]


def declarations(text):
    result = []
    for match in re.finditer(r"'([A-Za-z][A-Za-z0-9|:=!@+_-]*)'\s*=>|%(\w+_opts)", text):
        if match[1]:
            result.append(match[1])
        else:
            result.extend(declarations(shared[match[2]]))
    return result


def options(decls):
    result = {}
    for decl in decls:
        # read_git_config removes these mixedCase config-only names before GetOptions.
        if re.fullmatch('[a-zA-Z]+', decl) and re.search('[A-Z]', decl) and len(decl) > 1:
            continue
        match = re.fullmatch(r'([A-Za-z0-9|_-]+)([=:][si]@?|[!+])?', decl)
        if not match:
            raise ValueError('Unsupported declaration: ' + decl)
        names, suffix = match[1].split('|'), match[2] or ''
        key = names[0]
        if key in ['h', 'H']: key = 'help'
        kind = 'integer' if 'i' in suffix else 'string' if 's' in suffix else 'flag'
        if suffix.startswith(':'): kind = 'optional-' + kind
        opt = {'key': key, 'value': kind}
        if suffix == ':s': opt['set'] = ''
        if suffix == ':i': opt['set'] = 0
        if '@' in suffix: opt['repeat'] = True
        if key == 'version': opt['effects'] = [{'key': 'help', 'set': True}]
        for name in names:
            flags = ['--' + name] + (['-' + name] if len(name) == 1 else [])
            for flag in flags: result[flag] = opt.copy()
            if suffix == '!':
                for neg in ['--no-' + name, '--no' + name]:
                    result[neg] = dict(opt, set=False)
    return result

# Entries are uniquely delimited by command keys followed by array constructors.
table = source.split('my %cmd = (', 1)[1].split('\n);', 1)[0]
starts = list(re.finditer(r"^\s*(?:'([\w-]+)'|([\w-]+))\s*=>\s*\[", table, re.M))
global_decls = ['h|H', 'version|V', 'minimize-connections', 'id|i=s', 'svn-remote|remote|R=s']
entries = {}
for i, match in enumerate(starts):
    name = match[1] or match[2]
    body = table[match.end():starts[i+1].start() if i+1 < len(starts) else len(table)]
    decls = declarations(body) + global_decls
    entries['svn ' + name] = {'declarations': decls, 'options': options(decls)}
if len(entries) != 25:
    raise ValueError(f'Expected 25 pinned SVN operations; found {len(entries)}')
entries['svn'] = {'declarations': global_decls, 'options': options(global_decls)}
output = json.dumps({'version': '2.55.0', 'source': 'git-svn.perl', 'sha256': hashlib.sha256(source_path.read_bytes()).hexdigest(), 'commands': entries}, indent=2) + '\n'
target = Path(__file__).resolve().parent.parent / 'spec/upstream/svn-options.json'
if '--check' in sys.argv:
    if target.read_text() != output: raise SystemExit('SVN option snapshot is stale')
else:
    target.write_text(output)
print(f'Extracted/checked {len(entries) - 1} SVN operation tables without loading upstream Perl code.')

#!/usr/bin/env python3
"""Extract Git 2.55's git-p4 option declarations without executing its Python code.

Usage: python3 scripts/extract-p4-options.py /path/to/git-2.55.0 [--check]
"""
import ast
import hashlib
import json
import sys
from pathlib import Path

source_path = Path(sys.argv[1]) / 'git-p4.py'
source = source_path.read_text()
module = ast.parse(source)
classes = {node.name: node for node in module.body if isinstance(node, ast.ClassDef)}
command_node = next(node.value for node in module.body if isinstance(node, ast.Assign) and any(isinstance(target, ast.Name) and target.id == 'commands' for target in node.targets))
commands = {ast.literal_eval(key): value.id for key, value in zip(command_node.keys, command_node.values)}


def options_for(name):
    cls = classes[name]
    inherited = {}
    for base in cls.bases:
        if isinstance(base, ast.Name) and base.id.startswith('P4') and base.id in classes:
            inherited.update(options_for(base.id))
    constants = {target.id: ast.literal_eval(node.value) for node in cls.body if isinstance(node, ast.Assign) for target in node.targets if isinstance(target, ast.Name) and target.id.endswith('_choices')}
    init = next(node for node in cls.body if isinstance(node, ast.FunctionDef) and node.name == '__init__')
    for call in ast.walk(init):
        if not (isinstance(call, ast.Call) and isinstance(call.func, ast.Attribute) and isinstance(call.func.value, ast.Name) and call.func.value.id == 'optparse' and call.func.attr == 'make_option'):
            continue
        flags = [ast.literal_eval(arg) for arg in call.args]
        kwargs = {kw.arg: kw.value for kw in call.keywords}
        value = lambda key, default=None: ast.literal_eval(kwargs[key]) if key in kwargs else default
        action = value('action', 'store')
        option = {'key': value('dest', flags[0].lstrip('-')), 'value': 'flag' if action in ['store_true', 'store_false'] else 'integer' if value('type') == 'int' else 'string'}
        if action == 'store_false':
            option['set'] = False
        if action == 'append' or action == 'callback':
            option['repeat'] = True
        if 'choices' in kwargs:
            choice = kwargs['choices']
            option['allowed'] = list(constants[choice.attr] if isinstance(choice, ast.Attribute) else ast.literal_eval(choice))
        for flag in flags:
            inherited[flag] = option
    return inherited

entries = {}
for command, cls in commands.items():
    options = options_for(cls)
    options.update({flag: {'key': 'verbose', 'value': 'flag'} for flag in ['--verbose', '-v']})
    if command != 'clone':
        options['--git-dir'] = {'key': 'gitdir', 'value': 'string'}
    options.update({flag: {'key': 'help', 'value': 'flag'} for flag in ['--help', '-h']})
    entries['p4 ' + command] = {'class': cls, 'options': options}
output = json.dumps({'version': '2.55.0', 'source': 'git-p4.py', 'sha256': hashlib.sha256(source_path.read_bytes()).hexdigest(), 'commands': entries}, indent=2) + '\n'
target = Path(__file__).resolve().parent.parent / 'spec/upstream/p4-options.json'
if '--check' in sys.argv:
    if target.read_text() != output:
        raise SystemExit('P4 option snapshot is stale')
else:
    target.write_text(output)
print(f'Extracted/checked {len(entries)} P4 operation grammars without running upstream code.')

"""Read evaluated option initializers from the recorded GCC raw tree format.

Each function dump is a graph. Follow initializer/field references instead of
matching C spelling: sizeof, enum flags, and defaults have already been evaluated.
Global arrays can appear in multiple function graphs; require identical values.
"""
import re
from pathlib import Path


def extract_numeric_tables(path, char_bits):
    rows = {}
    for chunk in Path(path).read_text().split(';; Function ')[1:]:
        nodes = {
            match[1]: (match[2], match[3])
            for match in re.finditer(
                r'^@(\d+)\s+(\w+)\s+(.*?)(?=^@\d+\s|\Z)', chunk, re.M | re.S
            )
        }

        def field(node, key):
            match = re.search(r'\b' + re.escape(key) + r'\s*:\s*@([0-9]+)', nodes[node][1])
            return match[1] if match else None

        def name(node):
            if not node:
                return None
            match = re.search(r'\bstrg:\s*(.*?)\s+lngt:', nodes[node][1], re.S)
            return match[1] if match else None

        def integer(node):
            match = re.search(r'\bint:\s*(-?[0-9]+)', nodes[node][1])
            return int(match[1]) if match else None

        def string(node):
            if not node:
                return None
            for _ in range(8):
                if nodes[node][0] == 'string_cst':
                    return name(node)
                node = field(node, 'op 0')
                if not node:
                    return None
            raise ValueError('Unexpectedly deep string initializer expression')

        def constructor(node):
            if not node or nodes[node][0] != 'constructor':
                return []
            return re.findall(r'idx\s*:\s*@(\d+)\s+val\s*:\s*@(\d+)', nodes[node][1])

        kinds = {
            integer(field(node, 'cnst')): name(field(node, 'name'))
            for node, (kind, _) in nodes.items()
            if kind == 'const_decl'
            and name(field(node, 'name')) in ('OPTION_INTEGER', 'OPTION_UNSIGNED')
        }
        for node, (kind, _) in nodes.items():
            if kind != 'var_decl':
                continue
            table = name(field(node, 'name'))
            for _, item in constructor(field(node, 'init')):
                fields = {
                    name(field(key, 'name')): value
                    for key, value in constructor(item)
                    if nodes[key][0] == 'field_decl'
                }
                if 'precision' not in fields or 'type' not in fields:
                    continue
                numeric_kind = kinds.get(integer(fields['type']))
                if not numeric_kind:
                    continue
                short = integer(fields['short_name']) if 'short_name' in fields else 0
                flag = string(fields.get('long_name')) or chr(short)
                width = integer(fields['precision'])
                scope = field(node, 'scpe')
                function = name(field(scope, 'name')) if scope and nodes[scope][0] == 'function_decl' else None
                key = (function, table, flag, numeric_kind)
                default = integer(fields['defval']) if 'defval' in fields else 0
                flags = integer(fields['flags']) if 'flags' in fields else 0
                if width not in (1, 2, 4, 8) or default is None or flags is None:
                    raise ValueError(f'Nonconstant numeric metadata: {key}')
                value = {
                    'function': function, 'table': table, 'flag': flag,
                    'kind': numeric_kind, 'bits': width * char_bits,
                    'default': default, 'flags': flags,
                }
                if key in rows and rows[key] != value:
                    raise ValueError(f'Inconsistent repeated initializer: {key}')
                rows[key] = value
    return list(rows.values())

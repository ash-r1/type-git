import json, shutil, subprocess
from common import ROOT, LEDGER, WORK, HELPERS
if subprocess.check_output(['git', 'rev-parse', '--is-shallow-repository'], cwd=ROOT, text=True).strip() == 'true':
    subprocess.run(['git', 'fetch', '--unshallow', 'origin'], cwd=ROOT, check=True)
subprocess.run(['git', 'fetch', 'origin'], cwd=ROOT, check=True)
if LEDGER.exists():
    raise SystemExit('State already exists; inspect it instead of overwriting progress: ' + str(LEDGER))
data = json.loads((HELPERS.parent / 'ledger.json').read_text())
for row in data['prs']:
    for key in ['preparedCommit', 'mainPreparedCommit']:
        if row.get(key) and (key == 'preparedCommit' or row['status'] != 'merged'):
            subprocess.run(['git', 'cat-file', '-e', row[key] + '^{commit}'], cwd=ROOT, check=True)
    if row.get('preparedCommit'):
        row['preparedWorktree'] = str(WORK / ('prep-' + str(row['number'])))
    if row.get('mainWorktree'):
        row['mainWorktree'] = str(WORK / ('main-' + str(row['number'])))
LEDGER.write_text(json.dumps(data, indent=2) + '\n')
print('Restored portable ledger:', LEDGER)
print('Worktrees will be created only when needed under:', WORK)
print('Front is PR 136. Follow README to apply the archived correction before fresh CI/review.')

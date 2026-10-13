import subprocess
from pathlib import Path
ROOT = Path(subprocess.check_output(['git', 'rev-parse', '--show-toplevel'], text=True).strip()).resolve()
gitdir = Path(subprocess.check_output(['git', 'rev-parse', '--git-common-dir'], cwd=ROOT, text=True).strip())
COMMON = gitdir.resolve() if gitdir.is_absolute() else (ROOT / gitdir).resolve()
STATE = COMMON / 'type-git-sequential-merge'
STATE.mkdir(parents=True, exist_ok=True)
LEDGER = STATE / 'ledger.json'
WORK = ROOT.parent / ('.' + ROOT.name + '-merge-worktrees')
HELPERS = Path(__file__).resolve().parent

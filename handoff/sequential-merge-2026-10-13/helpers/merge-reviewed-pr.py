from common import STATE, LEDGER, HELPERS
import json, subprocess, sys
from pathlib import Path
n=int(sys.argv[1]); expected=sys.argv[2]; repo='ash-r1/type-git'
subprocess.run([sys.executable,str(HELPERS / 'review-status.py'),str(n)],check=True)
p=json.loads((STATE / f'pr-{n}-current-status.json').read_text())
assert p['state']=='OPEN' and not p['isDraft'] and p['baseRefName']=='main', 'PR must be open, ready and based on main'
assert p['headRefOid']==expected, 'Reviewed head changed'
assert p['mergeStateStatus']=='CLEAN', 'Merge state is not clean'
assert p['statusCheckRollup'], 'No checks found'
for c in p['statusCheckRollup']:
    assert c.get('conclusion',c.get('state'))=='SUCCESS', 'Check has not succeeded: '+str(c)
assert not p['threads']['pageInfo']['hasNextPage'], 'Uninspected thread pagination'
assert all(t['isResolved'] for t in p['threads']['nodes']), 'Unresolved review thread'
reviews=[r for r in p['reviews'] if r['author']['login']=='copilot-pull-request-reviewer']
assert reviews and reviews[-1]['commit']['oid']==expected, 'No current-head Copilot review'
assert reviews[-1]['state']!='CHANGES_REQUESTED', 'Copilot requests changes'
body=reviews[-1]['body']
assert 'Review effort' in body or 'Copilot review overview' in body, 'No completed Copilot assessment'
assert 'unable to review' not in body.lower() and 'encountered an error' not in body.lower(), 'Copilot review failed'
# The caller separately reads the review overview (including non-inline observations) and code.
subprocess.run(['gh','pr','merge',str(n),'--repo',repo,'--squash','--match-head-commit',expected],check=True)
merged=json.loads(subprocess.check_output(['gh','pr','view',str(n),'--repo',repo,'--json','state,mergeCommit,mergedAt,headRefOid'],text=True))
assert merged['state']=='MERGED', 'Merge did not complete'
ledger=LEDGER; data=json.loads(ledger.read_text())
for row in data['prs']:
    if row['number']==n: row.update(status='merged',validatedHead=expected,mergeCommit=merged['mergeCommit']['oid'],mergedAt=merged['mergedAt'])
ledger.write_text(json.dumps(data,indent=2)+'\n')
print(json.dumps(merged,indent=2))

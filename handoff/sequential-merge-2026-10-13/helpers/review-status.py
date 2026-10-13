from common import STATE
import json, re, subprocess, sys
from pathlib import Path
n=int(sys.argv[1]); repo='ash-r1/type-git'
def gh(*args):
    return json.loads(subprocess.check_output(['gh',*args],text=True))
p=gh('pr','view',str(n),'--repo',repo,'--json','number,state,isDraft,baseRefName,headRefName,headRefOid,mergeStateStatus,statusCheckRollup,reviews,reviewDecision')
query='query { repository(owner:"ash-r1", name:"type-git") { pullRequest(number:%d) { reviewThreads(first:100) { pageInfo { hasNextPage } nodes { id isResolved isOutdated path line comments(first:30) { nodes { databaseId author { login } body url } } } } } } }' % n
t=gh('api','graphql','-f','query='+query)['data']['repository']['pullRequest']['reviewThreads']
p['threads']=t
(STATE / f'pr-{n}-current-status.json').write_text(json.dumps(p,indent=2)+'\n')
checks=p['statusCheckRollup']; passed=[c for c in checks if c.get('conclusion',c.get('state'))=='SUCCESS']; remaining=[c for c in checks if c not in passed]
reviews=[r for r in p['reviews'] if r['author']['login']=='copilot-pull-request-reviewer']; review=reviews[-1] if reviews else None
print(json.dumps({k:p[k] for k in ['number','state','isDraft','baseRefName','headRefName','headRefOid','mergeStateStatus']},indent=2))
print('Passed checks:',len(passed),'/',len(checks))
print('Remaining:',json.dumps([{k:c.get(k) for k in ['name','context','status','state','conclusion','detailsUrl']} for c in remaining],indent=2))
print('Latest Copilot review:',None if not review else {'head':review['commit']['oid'],'at':review['submittedAt'],'matchesHead':review['commit']['oid']==p['headRefOid'],'body':re.sub('<[^>]*>','',review['body']) if review['commit']['oid']==p['headRefOid'] else '(previous-head review; body saved in status JSON)'})
print('Unresolved threads:',json.dumps([x for x in t['nodes'] if not x['isResolved']],indent=2))
print('Thread pagination pending:',t['pageInfo']['hasNextPage'])

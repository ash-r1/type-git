from common import ROOT, LEDGER, WORK
import json,subprocess,sys
from pathlib import Path
n=int(sys.argv[1]);root=ROOT;ledger=LEDGER;d=json.loads(ledger.read_text());rows=d['prs'];i=next(i for i,r in enumerate(rows) if r['number']==n);parent,r=rows[i-1:i+1]
def git(*a):return subprocess.check_output(['git',*a],cwd=root,text=True).strip()
def gh(*a):return json.loads(subprocess.check_output(['gh',*a],cwd=root,text=True))
actualParent=gh('pr','view',str(parent['number']),'--repo','ash-r1/type-git','--json','state,mergeCommit')
assert actualParent['state']=='MERGED','Finish predecessor first'
remote=gh('pr','view',str(n),'--repo','ash-r1/type-git','--json','headRefOid,state,title')
assert remote['state']=='OPEN' and remote['headRefOid']==r['originalHead'],'Remote changed; inspect rather than overwriting'
subprocess.run(['git','fetch','origin','main'],cwd=root,check=True)
base=git('rev-parse','origin/main');assert subprocess.run(['git','merge-base','--is-ancestor',actualParent['mergeCommit']['oid'],base],cwd=root).returncode==0
prepared=r['preparedCommit'];assert git('rev-parse',prepared+'^1^{tree}')==r['preparedParentTree'];assert git('rev-parse',prepared+'^{tree}')==r['preparedTree']
source=WORK / f'prep-{n}'
if not source.exists():
    WORK.mkdir(parents=True, exist_ok=True)
    subprocess.run(['git','worktree','add','--detach',str(source),prepared],cwd=root,check=True)
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=source,text=True).strip()==prepared, 'Prepared worktree changed'
assert not subprocess.check_output(['git','diff','HEAD','--name-only'],cwd=source)
r['preparedWorktree']=str(source)
w=(WORK / f'main-{n}');assert not w.exists(),'Inspect existing worktree'
subprocess.run(['git','worktree','add','--detach',str(w),base],cwd=root,check=True)
patch=(WORK / f'pr-{n}-prepared-feature-delta.patch');patch.write_bytes(subprocess.check_output(['git','diff','--binary',prepared+'^1',prepared],cwd=root))
# Apply only this feature delta, retaining newer unrelated main changes.
subprocess.run(['git','apply','--3way','--index',str(patch)],cwd=w,check=True)
assert not subprocess.check_output(['git','ls-files','--unmerged'],cwd=w)
subprocess.run(['git','diff','--cached','--check'],cwd=w,check=True)
(w/'node_modules').symlink_to(root/'node_modules',target_is_directory=True)
subprocess.run(['git','commit','-m',remote['title']],cwd=w,check=True)
r.update(mainWorktree=str(w),mainPreparedCommit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=w,text=True).strip(),mainPreparedTree=subprocess.check_output(['git','rev-parse','HEAD^{tree}'],cwd=w,text=True).strip(),mainParent=base,status='feature delta reapplied onto actual main; fresh validation pending; unpublished')
ledger.write_text(json.dumps(d,indent=2)+'\n');print(f'Prepared #{n} on actual main without changing remote',flush=True)

/**
 * Ref name syntax from Git 2.55.0 refs.c (check_refname_format with no flags) and the branch
 * name checks of refs.c:check_branch_ref, which branch.c:validate_branchname applies to every
 * new branch name.
 */

/** refs.c refname_disposition: 4 forbidden, 5 '*' (forbidden without a refspec pattern). */
function forbiddenRefnameByte(code: number): boolean {
  return (
    code < 0x20 ||
    code === 0x20 ||
    code === 0x7f ||
    code === 0x2a ||
    code === 0x3a ||
    code === 0x3f ||
    code === 0x5b ||
    code === 0x5c ||
    code === 0x5e ||
    code === 0x7e
  );
}

/**
 * refs.c:check_refname_format without REFNAME_REFSPEC_PATTERN. Without `allowOnelevel`
 * (flags 0) a ref needs at least two components; REFNAME_ALLOW_ONELEVEL lifts that.
 */
export function validRefnameFormat(refname: string, allowOnelevel: boolean = false): boolean {
  if (refname === '@' || refname.includes('\0')) {
    return false;
  }
  const components = refname.split('/');
  if (components.length < 2 && !allowOnelevel) {
    return false;
  }
  for (const component of components) {
    if (
      component === '' ||
      component.startsWith('.') ||
      component.endsWith('.lock') ||
      component.includes('..') ||
      component.includes('@{')
    ) {
      return false;
    }
    for (let index = 0; index < component.length; index += 1) {
      // Non-ASCII UTF-16 units encode to bytes >= 0x80, which the table allows.
      if (forbiddenRefnameByte(component.charCodeAt(index))) {
        return false;
      }
    }
  }
  return !refname.endsWith('.');
}

/**
 * repo_interpret_branch_name (INTERPRET_BRANCH_LOCAL) can rewrite a leading @{-N} from the
 * reflog (interpret_nth_prior_checkout reads N with strtol up to the first '}' and needs it
 * positive) and an @{upstream}, @{u} or @{push} mark from configuration, unless a ':' precedes
 * the mark. copy_branchname appends the text after the last rewritten part literally.
 */
const NTH_PRIOR = /^@\{-[ \t\n\v\f\r]*\+?0*[1-9][0-9]*\}/;
const BRANCH_MARK = /@\{(?:upstream|u|push)\}/gi;

/**
 * Whether a new branch name (branch creation, rename and copy targets, switch -c/-C/--orphan,
 * checkout -b/-B, worktree add -b/-B) can pass refs.c:check_branch_ref. `true` means valid,
 * `false` means refused in every repository, and `'repository'` means the repository decides,
 * because @{-N} or an upstream/push mark is rewritten first. A rewritten part is a valid
 * branch name, so the name is refused whenever ':' appears (it is forbidden, and before a mark
 * it stops the rewrite) or the literal text after the last rewritable part cannot follow one.
 */
export function branchNameSyntax(name: string): boolean | 'repository' {
  if (name.startsWith('-')) {
    return false;
  }
  if (name.includes('@{')) {
    let end = NTH_PRIOR.exec(name)?.[0].length ?? 0;
    for (const mark of name.matchAll(BRANCH_MARK)) {
      end = Math.max(end, mark.index + mark[0].length);
    }
    if (end > 0) {
      // 'x' stands in for the rewritten branch name, which never ends in '.' or '/'.
      return !name.includes(':') && validRefnameFormat(`refs/heads/x${name.slice(end)}`)
        ? 'repository'
        : false;
    }
  }
  return name !== 'HEAD' && validRefnameFormat(`refs/heads/${name}`);
}

/** Runtime check for one new branch name; repository-dependent names are left to Git. */
export function validNewBranchName(value: unknown): boolean {
  return typeof value === 'string' && branchNameSyntax(value) !== false;
}

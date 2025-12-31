# Git API リファレンス

本ドキュメントは、Git CLI および Git LFS に存在するすべてのコマンド（API）の一覧です。
type-git プロジェクトの進捗状況の指標として使用します。

## 凡例

| 状態 | 説明 |
|------|------|
| - | 未着手 |
| WIP | 進行中 |
| Done | 完了 |
| N/A | 対象外（raw で対応） |

---

## 1. Git Main Porcelain Commands（主要ユーザー向けコマンド）

これらは日常的に使用される高レベルコマンドです。

| コマンド | 説明 | 状態 | 優先度 | 備考 |
|----------|------|------|--------|------|
| `add` | ファイルの内容をインデックスに追加 | - | 高 | |
  - `-n, --dry-run`
  - `-v, --verbose`
  - `-i, --interactive`
  - `-p, --patch`
  - `-e, --edit`
  - `-f, --force`
  - `-u, --update`
  - `-A, --all`
  - `-N, --intent-to-add`
  - `--renormalize`
  - `--ignore-removal`
  - `--refresh`
  - `--ignore-errors`
  - `--ignore-missing`
  - `--sparse`
  - `--chmod`
  - `--pathspec-from-file`
| `am` | メールボックスから一連のパッチを適用 | - | 低 | |
| `archive` | 名前付きツリーからファイルのアーカイブを作成 | - | 低 | |
| `backfill` | 部分クローンで欠落しているオブジェクトをダウンロード | - | 低 | Git 2.41+ |
| `bisect` | バイナリサーチでバグを導入したコミットを特定 | - | 低 | |
| `branch` | ブランチの一覧表示、作成、削除 | - | 高 | |
  - `-v, --verbose`
  - `-q, --quiet`
  - `-t, --track`
  - `-u, --set-upstream-to`
  - `--unset-upstream`
  - `--color`
  - `-r, --remotes`
  - `--contains`
  - `--no-contains`
  - `--abbrev`
  - `-a, --all`
  - `-d, --delete`
  - `-D` (force delete)
  - `-m, --move`
  - `-M` (force move)
  - `-c, --copy`
  - `-C` (force copy)
  - `-l, --list`
  - `--show-current`
  - `--create-reflog`
  - `--edit-description`
  - `-f, --force`
  - `--merged`
  - `--no-merged`
  - `--column`
  - `--sort`
  - `--points-at`
  - `-i, --ignore-case`
  - `--recurse-submodules`
  - `--format`
| `bundle` | アーカイブでオブジェクトと参照を移動 | - | 低 | |
| `checkout` | ブランチの切り替えまたはワーキングツリーファイルの復元 | - | 高 | |
  - `-b` (create branch)
  - `-B` (create/reset branch)
  - `-l` (create reflog)
  - `--guess`
  - `--overlay`
  - `-q, --quiet`
  - `--recurse-submodules`
  - `--progress`
  - `-m, --merge`
  - `--conflict`
  - `-d, --detach`
  - `-t, --track`
  - `-f, --force`
  - `--orphan`
  - `--overwrite-ignore`
  - `--ignore-other-worktrees`
  - `-2, --ours`
  - `-3, --theirs`
  - `-p, --patch`
  - `--ignore-skip-worktree-bits`
  - `--pathspec-from-file`
| `cherry-pick` | 既存コミットによる変更を適用 | - | 中 | |
  - `--quit`
  - `--continue`
  - `--abort`
  - `--skip`
  - `--cleanup`
  - `-n, --no-commit`
  - `-e, --edit`
  - `-s, --signoff`
  - `-m, --mainline`
  - `--rerere-autoupdate`
  - `--strategy`
  - `-X, --strategy-option`
  - `-S, --gpg-sign`
  - `-x` (append commit name)
  - `--ff`
  - `--allow-empty`
  - `--allow-empty-message`
  - `--empty`
| `citool` | git-commit の GUI 代替 | - | N/A | GUI ツール |
| `clean` | ワーキングツリーから追跡されていないファイルを削除 | - | 中 | |
  - `-q, --quiet`
  - `-n, --dry-run`
  - `-f, --force`
  - `-i, --interactive`
  - `-d` (remove directories)
  - `-e, --exclude`
  - `-x` (remove ignored files)
  - `-X` (remove only ignored files)
| `clone` | リポジトリを新しいディレクトリにクローン | - | 高 | MVP |
  - `-v, --verbose`
  - `-q, --quiet`
  - `--progress`
  - `--reject-shallow`
  - `-n, --no-checkout`
  - `--bare`
  - `--mirror`
  - `-l, --local`
  - `--no-hardlinks`
  - `-s, --shared`
  - `--recurse-submodules`
  - `-j, --jobs`
  - `--template`
  - `--reference`
  - `--reference-if-able`
  - `--dissociate`
  - `-o, --origin`
  - `-b, --branch`
  - `--revision`
  - `-u, --upload-pack`
  - `--depth`
  - `--shallow-since`
  - `--shallow-exclude`
  - `--single-branch`
  - `--tags`
  - `--shallow-submodules`
  - `--separate-git-dir`
  - `--ref-format`
  - `-c, --config`
  - `--server-option`
  - `-4, --ipv4`
  - `-6, --ipv6`
  - `--filter`
  - `--also-filter-submodules`
  - `--remote-submodules`
  - `--sparse`
  - `--bundle-uri`
| `commit` | リポジトリに変更を記録 | - | 高 | |
  - `-q, --quiet`
  - `-v, --verbose`
  - `-F, --file`
  - `--author`
  - `--date`
  - `-m, --message`
  - `-c, --reedit-message`
  - `-C, --reuse-message`
  - `--fixup`
  - `--squash`
  - `--reset-author`
  - `--trailer`
  - `-s, --signoff`
  - `-t, --template`
  - `-e, --edit`
  - `--cleanup`
  - `--status`
  - `-S, --gpg-sign`
  - `-a, --all`
  - `-i, --include`
  - `--interactive`
  - `-p, --patch`
  - `-o, --only`
  - `-n, --no-verify`
  - `--dry-run`
  - `--short`
  - `--branch`
  - `--ahead-behind`
  - `--porcelain`
  - `--long`
  - `-z, --null`
  - `--amend`
  - `--no-post-rewrite`
  - `-u, --untracked-files`
  - `--pathspec-from-file`
| `describe` | 利用可能な参照に基づいてオブジェクトに人間可読な名前を付与 | - | 低 | |
| `diff` | コミット間、コミットとワーキングツリー間などの変更を表示 | - | 高 | |
  - `-z` (NUL-terminated)
  - `-p, -u` (patch format)
  - `--patch-with-raw`
  - `--stat`
  - `--numstat`
  - `--patch-with-stat`
  - `--name-only`
  - `--name-status`
  - `--full-index`
  - `--abbrev`
  - `-R` (reverse)
  - `-B` (detect rewrites)
  - `-M` (detect renames)
  - `-C` (detect copies)
  - `--find-copies-harder`
  - `-l` (limit rename attempts)
  - `-O` (reorder diffs)
  - `-S` (pickaxe)
  - `--pickaxe-all`
  - `-a, --text`
  - `--cached`
  - `--merge-base`
  - `--no-index`
| `fetch` | 別のリポジトリからオブジェクトと参照をダウンロード | - | 高 | MVP |
  - `-v, --verbose`
  - `-q, --quiet`
  - `--all`
  - `--set-upstream`
  - `-a, --append`
  - `--atomic`
  - `--upload-pack`
  - `-f, --force`
  - `-m, --multiple`
  - `-t, --tags`
  - `-n` (no tags)
  - `-j, --jobs`
  - `--prefetch`
  - `-p, --prune`
  - `-P, --prune-tags`
  - `--recurse-submodules`
  - `--dry-run`
  - `--porcelain`
  - `--write-fetch-head`
  - `-k, --keep`
  - `-u, --update-head-ok`
  - `--progress`
  - `--depth`
  - `--shallow-since`
  - `--shallow-exclude`
  - `--deepen`
  - `--unshallow`
  - `--refetch`
  - `--update-shallow`
  - `--refmap`
  - `-o, --server-option`
  - `-4, --ipv4`
  - `-6, --ipv6`
  - `--negotiation-tip`
  - `--negotiate-only`
  - `--filter`
  - `--auto-maintenance`
  - `--show-forced-updates`
  - `--write-commit-graph`
  - `--stdin`
| `format-patch` | メール送信用のパッチを準備 | - | 低 | |
| `gc` | 不要なファイルをクリーンアップし、ローカルリポジトリを最適化 | - | 低 | |
| `gitk` | Git リポジトリブラウザ | - | N/A | GUI ツール |
| `grep` | パターンに一致する行を出力 | - | 中 | |
  - `--cached`
  - `--no-index`
  - `--untracked`
  - `--exclude-standard`
  - `--recurse-submodules`
  - `-v, --invert-match`
  - `-i, --ignore-case`
  - `-w, --word-regexp`
  - `-a, --text`
  - `-I` (skip binary)
  - `--textconv`
  - `-r, --recursive`
  - `--max-depth`
  - `-E, --extended-regexp`
  - `-G, --basic-regexp`
  - `-F, --fixed-strings`
  - `-P, --perl-regexp`
  - `-n, --line-number`
  - `--column`
  - `-h` (no filename)
  - `-H` (show filename)
  - `--full-name`
  - `-l, --files-with-matches`
  - `--name-only`
  - `-L, --files-without-match`
  - `-z, --null`
  - `-o, --only-matching`
  - `-c, --count`
  - `--color`
  - `--break`
  - `--heading`
  - `-C, --context`
  - `-B, --before-context`
  - `-A, --after-context`
  - `--threads`
  - `-p, --show-function`
  - `-W, --function-context`
  - `-f` (read patterns from file)
  - `-e` (pattern)
  - `--and`, `--or`, `--not`
  - `-q, --quiet`
  - `--all-match`
  - `-O, --open-files-in-pager`
  - `-m, --max-count`
| `gui` | Git のポータブル GUI | - | N/A | GUI ツール |
| `init` | 空の Git リポジトリを作成または既存のものを再初期化 | - | 高 | MVP |
  - `--template`
  - `--bare`
  - `--shared`
  - `-q, --quiet`
  - `--separate-git-dir`
  - `-b, --initial-branch`
  - `--object-format`
  - `--ref-format`
| `log` | コミットログを表示 | - | 高 | MVP |
  - `-q, --quiet`
  - `--source`
  - `--use-mailmap`
  - `--decorate-refs`
  - `--decorate-refs-exclude`
  - `--decorate`
  - `-L` (line range)
  - `--max-count`
  - `--skip`
  - `--since`, `--after`
  - `--until`, `--before`
  - `--author`
  - `--grep`
  - `--all`
  - `--first-parent`
  - `--oneline`
  - `--format`
  - `--graph`
  - `--stat`
  - `--shortstat`
  - `--name-only`
  - `--name-status`
| `maintenance` | Git リポジトリデータを最適化するタスクを実行 | - | 低 | |
| `merge` | 2つ以上の開発履歴を結合 | - | 高 | |
  - `-n` (no diffstat)
  - `--stat`
  - `--summary`
  - `--compact-summary`
  - `--log`
  - `--squash`
  - `--commit`
  - `-e, --edit`
  - `--cleanup`
  - `--ff`
  - `--ff-only`
  - `--rerere-autoupdate`
  - `--verify-signatures`
  - `-s, --strategy`
  - `-X, --strategy-option`
  - `-m, --message`
  - `-F, --file`
  - `--into-name`
  - `-v, --verbose`
  - `-q, --quiet`
  - `--abort`
  - `--quit`
  - `--continue`
  - `--allow-unrelated-histories`
  - `--progress`
  - `-S, --gpg-sign`
  - `--autostash`
  - `--overwrite-ignore`
  - `--signoff`
  - `--no-verify`
| `mv` | ファイル、ディレクトリ、シンボリックリンクを移動または名前変更 | - | 中 | |
  - `-v, --verbose`
  - `-n, --dry-run`
  - `-f, --force`
  - `-k` (skip errors)
  - `--sparse`
| `notes` | オブジェクトノートを追加または検査 | - | 低 | |
| `pull` | 別のリポジトリまたはローカルブランチからフェッチして統合 | - | 高 | |
  - `-v, --verbose`
  - `-q, --quiet`
  - `--progress`
  - `--recurse-submodules`
  - `-r, --rebase`
  - `-n` (no stat)
  - `--stat`
  - `--compact-summary`
  - `--log`
  - `--signoff`
  - `--squash`
  - `--commit`
  - `--edit`
  - `--cleanup`
  - `--ff`
  - `--ff-only`
  - `--verify`
  - `--verify-signatures`
  - `--autostash`
  - `-s, --strategy`
  - `-X, --strategy-option`
  - `-S, --gpg-sign`
  - `--allow-unrelated-histories`
  - `--all`
  - `-a, --append`
  - `--upload-pack`
  - `-f, --force`
  - `-t, --tags`
  - `-p, --prune`
  - `-j, --jobs`
  - `--dry-run`
  - `-k, --keep`
  - `--depth`
  - `--shallow-since`
  - `--shallow-exclude`
  - `--deepen`
  - `--unshallow`
  - `--update-shallow`
  - `--refmap`
  - `-o, --server-option`
  - `-4, --ipv4`
  - `-6, --ipv6`
  - `--negotiation-tip`
  - `--show-forced-updates`
  - `--set-upstream`
| `push` | リモート参照を関連オブジェクトと共に更新 | - | 高 | MVP |
  - `-v, --verbose`
  - `-q, --quiet`
  - `--repo`
  - `--all`
  - `--branches`
  - `--mirror`
  - `-d, --delete`
  - `--tags`
  - `-n, --dry-run`
  - `--porcelain`
  - `-f, --force`
  - `--force-with-lease`
  - `--force-if-includes`
  - `--recurse-submodules`
  - `--thin`
  - `--receive-pack`
  - `--exec`
  - `-u, --set-upstream`
  - `--progress`
  - `--prune`
  - `--no-verify`
  - `--follow-tags`
  - `--signed`
  - `--atomic`
  - `-o, --push-option`
  - `-4, --ipv4`
  - `-6, --ipv6`
| `range-diff` | 2つのコミット範囲を比較 | - | 低 | |
| `rebase` | 別のベースチップ上にコミットを再適用 | - | 中 | |
  - `--onto`
  - `--keep-base`
  - `--no-verify`
  - `-q, --quiet`
  - `-v, --verbose`
  - `-n, --no-stat`
  - `--signoff`
  - `--committer-date-is-author-date`
  - `--reset-author-date`
  - `-C`
  - `--ignore-whitespace`
  - `--whitespace`
  - `-f, --force-rebase`
  - `--no-ff`
  - `--continue`
  - `--skip`
  - `--abort`
  - `--quit`
  - `--edit-todo`
  - `--show-current-patch`
  - `--apply`
  - `-m, --merge`
  - `-i, --interactive`
  - `--rerere-autoupdate`
  - `--empty`
  - `--autosquash`
  - `--update-refs`
  - `-S, --gpg-sign`
  - `--autostash`
  - `-x, --exec`
  - `-r, --rebase-merges`
  - `--fork-point`
  - `-s, --strategy`
  - `-X, --strategy-option`
  - `--root`
  - `--reschedule-failed-exec`
  - `--reapply-cherry-picks`
| `reset` | 現在の HEAD を指定された状態にリセット | - | 高 | |
  - `-q, --quiet`
  - `--no-refresh`
  - `--mixed`
  - `--soft`
  - `--hard`
  - `--merge`
  - `--keep`
  - `--recurse-submodules`
  - `-p, --patch`
  - `-N, --intent-to-add`
  - `--pathspec-from-file`
| `restore` | ワーキングツリーファイルを復元 | - | 中 | Git 2.23+ |
  - `-s, --source`
  - `-S, --staged`
  - `-W, --worktree`
  - `--ignore-unmerged`
  - `--overlay`
  - `-q, --quiet`
  - `--recurse-submodules`
  - `--progress`
  - `-m, --merge`
  - `--conflict`
  - `-2, --ours`
  - `-3, --theirs`
  - `-p, --patch`
  - `--ignore-skip-worktree-bits`
  - `--pathspec-from-file`
| `revert` | 既存のコミットを取り消す | - | 中 | |
  - `--quit`
  - `--continue`
  - `--abort`
  - `--skip`
  - `--cleanup`
  - `-n, --no-commit`
  - `-e, --edit`
  - `-s, --signoff`
  - `-m, --mainline`
  - `--rerere-autoupdate`
  - `--strategy`
  - `-X, --strategy-option`
  - `-S, --gpg-sign`
  - `--reference`
| `rm` | ワーキングツリーとインデックスからファイルを削除 | - | 高 | |
  - `-n, --dry-run`
  - `-q, --quiet`
  - `--cached`
  - `-f, --force`
  - `-r` (recursive)
  - `--ignore-unmatch`
  - `--sparse`
  - `--pathspec-from-file`
| `scalar` | 大規模 Git リポジトリを管理するツール | - | 低 | Git 2.38+ |
| `shortlog` | git log 出力を要約 | - | 低 | |
| `show` | 様々な種類のオブジェクトを表示 | - | 中 | |
  - `-q, --quiet`
  - `--source`
  - `--use-mailmap`
  - `--decorate-refs`
  - `--decorate-refs-exclude`
  - `--decorate`
  - `-L` (line range)
| `sparse-checkout` | ワーキングツリーを追跡ファイルのサブセットに縮小 | - | 低 | |
| `stash` | ダーティなワーキングディレクトリの変更を退避 | - | 高 | |
  - `list`
  - `show`
  - `drop`
  - `pop`
  - `apply`
  - `branch`
  - `push`
  - `save`
  - `clear`
  - `create`
  - `store`
  - `export`
  - `import`
  - `-p, --patch`
  - `-S, --staged`
  - `-k, --keep-index`
  - `-q, --quiet`
  - `-u, --include-untracked`
  - `-a, --all`
  - `-m, --message`
  - `--index`
  - `--pathspec-from-file`
| `status` | ワーキングツリーの状態を表示 | - | 高 | MVP |
  - `-v, --verbose`
  - `-s, --short`
  - `-b, --branch`
  - `--show-stash`
  - `--ahead-behind`
  - `--porcelain`
  - `--long`
  - `-z, --null`
  - `-u, --untracked-files`
  - `--ignored`
  - `--ignore-submodules`
  - `--column`
  - `--no-renames`
  - `-M, --find-renames`
| `submodule` | サブモジュールの初期化、更新、検査 | - | 中 | |
  - `--quiet`
  - `--cached`
  - `add`
    - `-b, --branch`
    - `-f, --force`
    - `--name`
    - `--reference`
  - `status`
    - `--cached`
    - `--recursive`
  - `init`
  - `deinit`
    - `-f, --force`
    - `--all`
  - `update`
    - `--init`
    - `--remote`
    - `-N, --no-fetch`
    - `-f, --force`
    - `--checkout`
    - `--merge`
    - `--rebase`
    - `--recommend-shallow`
    - `--reference`
    - `--recursive`
    - `--single-branch`
    - `--filter`
  - `set-branch`
    - `--default`
    - `--branch`
  - `set-url`
  - `summary`
    - `--cached`
    - `--files`
    - `--summary-limit`
  - `foreach`
    - `--recursive`
  - `sync`
    - `--recursive`
  - `absorbgitdirs`
| `switch` | ブランチを切り替える | - | 高 | Git 2.23+ |
  - `-c, --create`
  - `-C, --force-create`
  - `--guess`
  - `--discard-changes`
  - `-q, --quiet`
  - `--recurse-submodules`
  - `--progress`
  - `-m, --merge`
  - `--conflict`
  - `-d, --detach`
  - `-t, --track`
  - `-f, --force`
  - `--orphan`
  - `--overwrite-ignore`
  - `--ignore-other-worktrees`
| `tag` | タグを作成、一覧表示、削除、検証 | - | 高 | |
  - `-l, --list`
  - `-n` (print lines)
  - `-d, --delete`
  - `-v, --verify`
  - `-a, --annotate`
  - `-m, --message`
  - `-F, --file`
  - `--trailer`
  - `-e, --edit`
  - `-s, --sign`
  - `--cleanup`
  - `-u, --local-user`
  - `-f, --force`
  - `--create-reflog`
  - `--column`
  - `--contains`
  - `--no-contains`
  - `--merged`
  - `--no-merged`
  - `--sort`
  - `--points-at`
  - `--format`
  - `--color`
  - `-i, --ignore-case`
| `worktree` | 複数のワーキングツリーを管理 | - | 中 | Design Doc で言及 |
  - `add`
    - `-f, --force`
    - `--detach`
    - `--checkout`
    - `--lock`
    - `--reason`
    - `--orphan`
    - `-b, -B`
  - `list`
    - `-v, --verbose`
    - `--porcelain`
    - `-z`
  - `lock`
    - `--reason`
  - `move`
  - `prune`
    - `-n, --dry-run`
    - `-v, --verbose`
    - `--expire`
  - `remove`
    - `-f, --force`
  - `repair`
  - `unlock`

---

## 2. Git Ancillary Commands / Manipulators（補助コマンド / 操作系）

| コマンド | 説明 | 状態 | 優先度 | 備考 |
|----------|------|------|--------|------|
| `config` | リポジトリまたはグローバルオプションを取得・設定 | - | 高 | |
  - `list`
  - `get`
  - `set`
  - `unset`
  - `rename-section`
  - `remove-section`
  - `edit`
  - `--get-colorbool`
  - `--global`
  - `--local`
  - `--system`
  - `--worktree`
  - `--file`
  - `--blob`
  - `--type`
  - `--show-origin`
  - `--show-scope`
  - `--includes`
  - `--all`
  - `--regexp`
  - `--value`
  - `--fixed-value`
  - `--default`
  - `--url`
| `fast-export` | Git データエクスポーター | - | 低 | |
| `fast-import` | 高速 Git データインポーターのバックエンド | - | 低 | |
| `filter-branch` | ブランチを書き換え | - | 低 | 非推奨（filter-repo 推奨） |
| `mergetool` | マージコンフリクト解決ツールを実行 | - | 低 | |
| `pack-refs` | 効率的なリポジトリアクセスのためにヘッドとタグをパック | - | 低 | |
| `prune` | オブジェクトデータベースから到達不能なオブジェクトを削除 | - | 低 | |
| `reflog` | reflog 情報を管理 | - | 中 | |
  - `show`
  - `list`
  - `exists`
  - `write`
  - `delete`
    - `--rewrite`
    - `--updateref`
    - `--dry-run`
    - `--verbose`
  - `drop`
    - `--all`
    - `--single-worktree`
  - `expire`
    - `--expire`
    - `--expire-unreachable`
    - `--rewrite`
    - `--updateref`
    - `--stale-fix`
    - `--dry-run`
    - `--verbose`
    - `--all`
    - `--single-worktree`
| `refs` | 参照への低レベルアクセス | - | 低 | Git 2.42+ |
| `remote` | 追跡リポジトリのセットを管理 | - | 高 | |
  - `-v, --verbose`
  - `add`
    - `-t` (track branch)
    - `-m` (master branch)
    - `-f` (fetch)
    - `--tags`, `--no-tags`
    - `--mirror`
  - `rename`
    - `--progress`
  - `remove`
  - `set-head`
    - `-a, --auto`
    - `-d, --delete`
  - `show`
    - `-n`
  - `prune`
    - `-n, --dry-run`
  - `update`
    - `-p, --prune`
  - `set-branches`
    - `--add`
  - `get-url`
    - `--push`
    - `--all`
  - `set-url`
    - `--push`
    - `--add`
    - `--delete`
| `repack` | リポジトリ内の未パックオブジェクトをパック | - | 低 | |
| `replace` | オブジェクトを置換する参照を作成、一覧表示、削除 | - | 低 | |

---

## 3. Git Ancillary Commands / Interrogators（補助コマンド / 照会系）

| コマンド | 説明 | 状態 | 優先度 | 備考 |
|----------|------|------|--------|------|
| `annotate` | コミット情報でファイル行を注釈 | - | 低 | blame のエイリアス |
| `blame` | 各行を最後に変更したリビジョンと作成者を表示 | - | 中 | |
  - `--incremental`
  - `-b` (boundary)
  - `--root`
  - `--show-stats`
  - `--progress`
  - `--score-debug`
  - `-f, --show-name`
  - `-n, --show-number`
  - `-p, --porcelain`
  - `--line-porcelain`
  - `-c` (git-annotate mode)
  - `-t` (raw timestamp)
  - `-l` (long SHA)
  - `-s` (suppress author)
  - `-e, --show-email`
  - `-w` (ignore whitespace)
  - `--ignore-rev`
  - `--ignore-revs-file`
  - `--color-lines`
  - `--color-by-age`
  - `--minimal`
  - `-S` (revisions file)
  - `--contents`
  - `-C` (detect copies)
  - `-M` (detect moves)
  - `-L` (line range)
  - `--abbrev`
| `bugreport` | バグレポート用の情報を収集 | - | 低 | |
| `count-objects` | 未パックオブジェクトの数とディスク消費量をカウント | - | 低 | |
| `diagnose` | 診断情報の zip アーカイブを生成 | - | 低 | Git 2.38+ |
| `difftool` | 一般的な diff ツールを使用して変更を表示 | - | 低 | |
| `fsck` | データベース内のオブジェクトの接続性と有効性を検証 | - | 低 | |
| `gitweb` | Git Web インターフェース | - | N/A | Web フロントエンド |
| `help` | Git に関するヘルプ情報を表示 | - | 低 | |
| `instaweb` | gitweb で作業リポジトリを即座にブラウズ | - | N/A | Web ツール |
| `merge-tree` | インデックスやワーキングツリーに触れずにマージを実行 | - | 低 | |
| `rerere` | コンフリクトマージの記録された解決を再利用 | - | 低 | |
| `show-branch` | ブランチとそのコミットを表示 | - | 低 | |
| `verify-commit` | コミットの GPG 署名を確認 | - | 低 | |
| `verify-tag` | タグの GPG 署名を確認 | - | 低 | |
| `version` | Git のバージョン情報を表示 | - | 中 | |
  - `--build-options`
| `whatchanged` | 各コミットが導入した差分と共にログを表示 | - | 低 | |

---

## 4. Git Interacting with Others（他システム連携）

| コマンド | 説明 | 状態 | 優先度 | 備考 |
|----------|------|------|--------|------|
| `archimport` | GNU Arch リポジトリを Git にインポート | - | N/A | レガシー |
| `cvsexportcommit` | 単一のコミットを CVS チェックアウトにエクスポート | - | N/A | レガシー |
| `cvsimport` | CVS からデータを救出 | - | N/A | レガシー |
| `cvsserver` | Git 用 CVS サーバーエミュレータ | - | N/A | レガシー |
| `imap-send` | stdin からパッチのコレクションを IMAP フォルダに送信 | - | 低 | |
| `p4` | Perforce リポジトリからのインポートと送信 | - | N/A | レガシー |
| `quiltimport` | quilt パッチセットを現在のブランチに適用 | - | 低 | |
| `request-pull` | 保留中の変更の要約を生成 | - | 低 | |
| `send-email` | パッチのコレクションをメールとして送信 | - | 低 | |
| `svn` | Subversion リポジトリと Git 間の双方向操作 | - | N/A | レガシー |

---

## 5. Git Low-level Commands / Manipulators（低レベルコマンド / 操作系）

| コマンド | 説明 | 状態 | 優先度 | 備考 |
|----------|------|------|--------|------|
| `apply` | ファイルやインデックスにパッチを適用 | - | 中 | |
  - `--exclude`
  - `--include`
  - `-p` (strip slashes)
  - `--no-add`
  - `--stat`
  - `--numstat`
  - `--summary`
  - `--check`
  - `--index`
  - `-N, --intent-to-add`
  - `--cached`
  - `--unsafe-paths`
  - `--apply`
  - `-3, --3way`
  - `--ours`
  - `--theirs`
  - `--union`
  - `--build-fake-ancestor`
  - `-z`
  - `-C`
  - `--whitespace`
  - `--ignore-space-change`
  - `--ignore-whitespace`
  - `-R, --reverse`
  - `--unidiff-zero`
  - `--reject`
  - `--allow-overlap`
  - `-v, --verbose`
  - `-q, --quiet`
  - `--inaccurate-eof`
  - `--recount`
  - `--directory`
  - `--allow-empty`
| `checkout-index` | インデックスからワーキングツリーにファイルをコピー | - | 低 | |
| `commit-graph` | Git commit-graph ファイルを書き込み・検証 | - | 低 | |
| `commit-tree` | 新しいコミットオブジェクトを作成 | - | 低 | |
| `hash-object` | オブジェクト ID を計算し、オプションでファイルからオブジェクトを作成 | - | 中 | |
  - `-t` (type)
  - `-w` (write)
  - `--stdin`
  - `--stdin-paths`
  - `--no-filters`
  - `--literally`
  - `--path`
| `index-pack` | 既存のパックアーカイブのパックインデックスファイルをビルド | - | 低 | |
| `merge-file` | 3方向ファイルマージを実行 | - | 低 | |
| `merge-index` | マージが必要なファイルに対してマージを実行 | - | 低 | |
| `mktag` | 追加検証付きでタグオブジェクトを作成 | - | 低 | |
| `mktree` | ls-tree フォーマットのテキストからツリーオブジェクトをビルド | - | 低 | |
| `multi-pack-index` | マルチパックインデックスを書き込み・検証 | - | 低 | |
| `pack-objects` | オブジェクトのパックアーカイブを作成 | - | 低 | |
| `prune-packed` | パックファイルに既にある余分なオブジェクトを削除 | - | 低 | |
| `read-tree` | ツリー情報をインデックスに読み込む | - | 低 | |
| `replay` | 新しいベースにコミットを再生（実験的） | - | 低 | Git 2.44+ |
| `symbolic-ref` | シンボリック参照を読み取り、変更、削除 | - | 中 | Design Doc で言及 |
  - `-q, --quiet`
  - `-d, --delete`
  - `--short`
  - `--recurse`
  - `-m` (reason)
| `unpack-objects` | パックアーカイブからオブジェクトをアンパック | - | 低 | |
| `update-index` | ワーキングツリーのファイル内容をインデックスに登録 | - | 低 | |
| `update-ref` | 参照に格納されたオブジェクト名を安全に更新 | - | 低 | |
| `write-tree` | 現在のインデックスからツリーオブジェクトを作成 | - | 低 | |

---

## 6. Git Low-level Commands / Interrogators（低レベルコマンド / 照会系）

| コマンド | 説明 | 状態 | 優先度 | 備考 |
|----------|------|------|--------|------|
| `cat-file` | リポジトリオブジェクトの内容または詳細を提供 | - | 中 | |
  - `-e` (check existence)
  - `-p` (pretty-print)
  - `-t` (show type)
  - `-s` (show size)
  - `--use-mailmap`
  - `--batch`
  - `--batch-check`
  - `-Z` (NUL-terminated)
  - `--batch-command`
  - `--batch-all-objects`
  - `--buffer`
  - `--follow-symlinks`
  - `--unordered`
  - `--textconv`
  - `--filters`
  - `--path`
  - `--filter`
| `cherry` | アップストリームにまだ適用されていないコミットを検索 | - | 低 | |
| `diff-files` | ワーキングツリーとインデックスのファイルを比較 | - | 低 | |
| `diff-index` | ツリーをワーキングツリーまたはインデックスと比較 | - | 低 | |
| `diff-pairs` | 提供された blob ペアの内容とモードを比較 | - | 低 | Git 2.47+ |
| `diff-tree` | 2つのツリーオブジェクトで見つかった blob の内容とモードを比較 | - | 低 | |
| `for-each-ref` | 各参照の情報を出力 | - | 中 | |
  - `-s, --shell`
  - `-p, --perl`
  - `--python`
  - `--tcl`
  - `--omit-empty`
  - `--count`
  - `--format`
  - `--start-after`
  - `--color`
  - `--exclude`
  - `--sort`
  - `--points-at`
  - `--merged`
  - `--no-merged`
  - `--contains`
  - `--no-contains`
  - `--ignore-case`
  - `--stdin`
  - `--include-root-refs`
| `for-each-repo` | リポジトリのリストに対して Git コマンドを実行 | - | 低 | |
| `get-tar-commit-id` | git-archive で作成されたアーカイブからコミット ID を抽出 | - | 低 | |
| `last-modified` | ファイルの最終更新日時を表示（実験的） | - | 低 | Git 2.48+ |
| `ls-files` | インデックスとワーキングツリー内のファイル情報を表示 | - | 中 | |
  - `-z` (NUL-separated)
  - `-t` (file status tags)
  - `-v` (lowercase for assume unchanged)
  - `-f` (lowercase for fsmonitor clean)
  - `-c, --cached`
  - `-d, --deleted`
  - `-m, --modified`
  - `-o, --others`
  - `-i, --ignored`
  - `-s, --stage`
  - `-k, --killed`
  - `--directory`
  - `--eol`
  - `--empty-directory`
  - `-u, --unmerged`
  - `--resolve-undo`
  - `-x, --exclude`
  - `-X, --exclude-from`
  - `--exclude-per-directory`
  - `--exclude-standard`
  - `--full-name`
  - `--recurse-submodules`
  - `--error-unmatch`
  - `--with-tree`
  - `--abbrev`
  - `--debug`
  - `--deduplicate`
  - `--sparse`
  - `--format`
| `ls-remote` | リモートリポジトリの参照を一覧表示 | - | 高 | MVP |
  - `-q, --quiet`
  - `--upload-pack`
  - `-t, --tags`
  - `-b, --branches`
  - `--refs`
  - `--get-url`
  - `--sort`
  - `--exit-code`
  - `--symref`
  - `-o, --server-option`
| `ls-tree` | ツリーオブジェクトの内容を一覧表示 | - | 中 | |
  - `-d` (only trees)
  - `-r` (recurse)
  - `-t` (show trees when recursing)
  - `-z` (NUL-terminated)
  - `-l, --long`
  - `--name-only`
  - `--name-status`
  - `--object-only`
  - `--full-name`
  - `--full-tree`
  - `--format`
  - `--abbrev`
| `merge-base` | マージのための可能な限り良い共通祖先を検索 | - | 中 | |
  - `-a, --all`
  - `--octopus`
  - `--independent`
  - `--is-ancestor`
  - `--fork-point`
| `name-rev` | 与えられた rev のシンボリック名を検索 | - | 低 | |
| `pack-redundant` | 冗長なパックファイルを検索 | - | 低 | |
| `repo` | リポジトリに関する情報を取得 | - | 低 | Git 2.48+ |
| `rev-list` | 逆時系列でコミットオブジェクトを一覧表示 | - | 中 | Design Doc で言及 |
  - `--max-count`
  - `--max-age`
  - `--min-age`
  - `--sparse`
  - `--no-merges`
  - `--min-parents`
  - `--max-parents`
  - `--remove-empty`
  - `--all`
  - `--branches`
  - `--tags`
  - `--remotes`
  - `--stdin`
  - `--exclude-hidden`
  - `--quiet`
  - `--topo-order`
  - `--date-order`
  - `--reverse`
  - `--parents`
  - `--children`
  - `--objects`
  - `--objects-edge`
  - `--disk-usage`
  - `--unpacked`
  - `--header`
  - `--pretty`
  - `--object-names`
  - `--abbrev`
  - `--abbrev-commit`
  - `--left-right`
  - `--count`
  - `-z`
  - `--bisect`
  - `--bisect-vars`
  - `--bisect-all`
| `rev-parse` | パラメータを抽出・加工 | - | 高 | |
  - `--parseopt`
  - `--sq-quote`
  - `--verify`
  - `--quiet`
  - `--short`
  - `--symbolic`
  - `--symbolic-full-name`
  - `--abbrev-ref`
  - `--is-inside-git-dir`
  - `--is-inside-work-tree`
  - `--is-bare-repository`
  - `--git-dir`
  - `--git-common-dir`
  - `--resolve-git-dir`
  - `--show-toplevel`
  - `--show-prefix`
  - `--show-cdup`
  - `--show-object-format`
  - `--default`
  - `--prefix`
| `show-index` | パックアーカイブインデックスを表示 | - | 低 | |
| `show-ref` | ローカルリポジトリの参照を一覧表示 | - | 中 | |
  - `--tags`
  - `--branches`
  - `--exists`
  - `--verify`
  - `--head`
  - `-d, --dereference`
  - `-s, --hash`
  - `--abbrev`
  - `-q, --quiet`
  - `--exclude-existing`
| `unpack-file` | blob の内容で一時ファイルを作成 | - | 低 | |
| `var` | Git 論理変数を表示 | - | 低 | |
| `verify-pack` | パック Git アーカイブファイルを検証 | - | 低 | |

---

## 7. Git Low-level Commands / Syncing Repositories（低レベルコマンド / 同期系）

| コマンド | 説明 | 状態 | 優先度 | 備考 |
|----------|------|------|--------|------|
| `daemon` | Git リポジトリ用のシンプルなサーバー | - | N/A | サーバーデーモン |
| `fetch-pack` | 別のリポジトリから欠落オブジェクトを受信 | - | 低 | |
| `http-backend` | HTTP 経由の Git のサーバーサイド実装 | - | N/A | サーバーサイド |
| `send-pack` | Git プロトコルで別のリポジトリにオブジェクトをプッシュ | - | 低 | |
| `update-server-info` | ダムサーバーを支援する補助情報ファイルを更新 | - | 低 | |

---

## 8. Git Low-level Commands / Internal Helpers（低レベルコマンド / 内部ヘルパー）

| コマンド | 説明 | 状態 | 優先度 | 備考 |
|----------|------|------|--------|------|
| `check-attr` | gitattributes 情報を表示 | - | 低 | |
| `check-ignore` | gitignore / exclude ファイルをデバッグ | - | 低 | |
| `check-mailmap` | 連絡先の正規名とメールアドレスを表示 | - | 低 | |
| `check-ref-format` | 参照名が適切な形式であることを確認 | - | 低 | |
| `column` | データを列で表示 | - | 低 | |
| `credential` | ユーザー認証情報を取得・保存 | - | 高 | Design Doc で言及 |
  - `fill`
  - `approve`
  - `reject`
| `credential-cache` | パスワードを一時的にメモリに保存するヘルパー | - | 中 | |
| `credential-store` | 認証情報をディスクに保存するヘルパー | - | 中 | |
| `fmt-merge-msg` | マージコミットメッセージを生成 | - | 低 | |
| `hook` | Git フックを実行 | - | 低 | Git 2.36+ |
| `interpret-trailers` | コミットメッセージに構造化情報を追加またはパース | - | 低 | |
| `mailinfo` | 単一のメールメッセージからパッチと作成者情報を抽出 | - | 低 | |
| `mailsplit` | シンプルな UNIX mbox 分割プログラム | - | 低 | |
| `merge-one-file` | git-merge-index で使用する標準ヘルパープログラム | - | 低 | |
| `patch-id` | パッチの一意な ID を計算 | - | 低 | |
| `sh-i18n` | シェルスクリプト用の Git i18n セットアップコード | - | N/A | 内部スクリプト |
| `sh-setup` | 共通 Git シェルスクリプトセットアップコード | - | N/A | 内部スクリプト |
| `stripspace` | 不要な空白を削除 | - | 低 | |

---

## 9. Git LFS High-level Commands（Git LFS 高レベルコマンド）

| コマンド | 説明 | 状態 | 優先度 | 備考 |
|----------|------|------|--------|------|
| `lfs checkout` | Git LFS ファイルから実際のコンテンツでワーキングコピーを作成 | Done | 中 | |
  - `--base`
  - `--ours`
  - `--theirs`
  - `--to`
  - `--include`
  - `--exclude`
| `lfs completion` | Git LFS コマンドのタブ補完用シェルスクリプトを生成 | N/A | 低 | CLI 専用 |
| `lfs dedup` | Git LFS ファイルを重複排除 | - | 低 | |
| `lfs env` | Git LFS 環境を表示 | Done | 中 | |
| `lfs ext` | Git LFS 拡張詳細を表示 | - | 低 | |
| `lfs fetch` | リモートから Git LFS ファイルをダウンロード | Done | 高 | |
  - `-I, --include`
  - `-X, --exclude`
  - `--recent`
  - `--all`
  - `--prune`
  - `--refetch`
  - `--dry-run`
  - `--json`
  - `--remote`
  - `--refs`
| `lfs fsck` | Git LFS ファイルの一貫性をチェック | - | 低 | |
| `lfs install` | Git LFS 設定をインストール | Done | 高 | |
  - `--force`
  - `--local`
  - `--worktree`
  - `--manual`
  - `--system`
  - `--skip-smudge`
  - `--skip-repo`
| `lfs lock` | Git LFS サーバーでファイルを「ロック」に設定 | Done | 中 | |
  - `-r, --remote`
  - `-j, --json`
| `lfs locks` | Git LFS サーバーで現在「ロック」されているファイルを一覧表示 | Done | 中 | |
  - `-r, --remote`
  - `-i, --id`
  - `-p, --path`
  - `--local`
  - `--cached`
  - `--verify`
  - `-l, --limit`
  - `-j, --json`
| `lfs logs` | Git LFS コマンドからのエラーを表示 | - | 低 | |
| `lfs ls-files` | インデックスとワーキングツリー内の Git LFS ファイル情報を表示 | Done | 高 | |
  - `-l, --long`
  - `-s, --size`
  - `-d, --debug`
  - `-a, --all`
  - `--deleted`
  - `-I, --include`
  - `-X, --exclude`
  - `-n, --name-only`
  - `-j, --json`
  - `--ref`
| `lfs migrate` | 履歴を Git LFS に/から移行 | Done | 中 | info/import/export |
  - `info`
    - `--above`
    - `--top`
    - `--unit`
    - `--pointers`
    - `--fixup`
  - `import`
    - `--verbose`
    - `--above`
    - `--object-map`
    - `--no-rewrite`
    - `--fixup`
    - `-m, --message`
    - `--object`
  - `export`
    - `--verbose`
    - `--object-map`
    - `--remote`
  - `-I, --include`
  - `-X, --exclude`
  - `--include-ref`
  - `--exclude-ref`
  - `--skip-fetch`
  - `--everything`
  - `--yes`
| `lfs prune` | ローカルストレージから古い Git LFS ファイルを削除 | Done | 中 | |
  - `--dry-run`
  - `--force`
  - `--recent`
  - `--verify-remote`
  - `--no-verify-remote`
  - `--verify-unreachable`
  - `--no-verify-unreachable`
  - `--when-unverified`
  - `--verbose`
| `lfs pull` | リモートから Git LFS 変更をフェッチし、必要なワーキングツリーファイルをチェックアウト | Done | 高 | MVP |
  - `-I, --include`
  - `-X, --exclude`
| `lfs push` | キューに入った大きなファイルを Git LFS エンドポイントにプッシュ | Done | 高 | MVP |
  - `--dry-run`
  - `--all`
  - `--object-id`
  - `--stdin`
| `lfs status` | ワーキングツリー内の Git LFS ファイルのステータスを表示 | Done | 高 | MVP |
  - `-p, --porcelain`
  - `-j, --json`
| `lfs track` | Git LFS パスを Git attributes に表示または追加 | Done | 高 | |
  - `-v, --verbose`
  - `-d, --dry-run`
  - `--filename`
  - `-l, --lockable`
  - `--not-lockable`
  - `--no-excluded`
  - `--no-modify-attrs`
| `lfs uninstall` | フックと smudge/clean フィルター設定を削除して Git LFS をアンインストール | Done | 中 | |
  - `--local`
  - `--worktree`
  - `--system`
  - `--skip-repo`
| `lfs unlock` | Git LFS サーバーでファイルの「ロック」設定を解除 | Done | 中 | |
  - `-r, --remote`
  - `-f, --force`
  - `-i, --id`
  - `-j, --json`
| `lfs untrack` | Git Attributes から Git LFS パスを削除 | Done | 中 | |
| `lfs update` | 現在の Git リポジトリの Git フックを更新 | - | 低 | |
| `lfs version` | バージョン番号を報告 | Done | 低 | |

---

## 10. Git LFS Low-level Commands（Git LFS 低レベルコマンド）

| コマンド | 説明 | 状態 | 優先度 | 備考 |
|----------|------|------|--------|------|
| `lfs clean` | 大きなファイルをポインタに変換する Git clean フィルター | - | 中 | |
| `lfs filter-process` | 大きなファイルとポインタ間を変換する Git process フィルター | - | 中 | |
| `lfs merge-driver` | テキストベースの LFS ファイルをマージ | - | 低 | |
| `lfs pointer` | ポインタをビルドおよび比較 | - | 中 | |
  - `--file`
  - `--pointer`
  - `--stdin`
  - `--check`
  - `--strict`
  - `--no-strict`
| `lfs post-checkout` | Git post-checkout フック実装 | - | 低 | フック |
| `lfs post-commit` | Git post-commit フック実装 | - | 低 | フック |
| `lfs post-merge` | Git post-merge フック実装 | - | 低 | フック |
| `lfs pre-push` | Git pre-push フック実装 | - | 中 | フック |
| `lfs smudge` | blob 内のポインタを実際のコンテンツに変換する Git smudge フィルター | - | 中 | |
  - `--skip`
| `lfs standalone-file` | ファイル URL（ローカルパス）用の Git LFS スタンドアロン転送アダプタ | - | 低 | |

---

## 統計サマリー

### Git コマンド

| カテゴリ | 総数 | 高優先度 | 中優先度 | 低優先度 | N/A |
|----------|------|----------|----------|----------|-----|
| Main Porcelain | 49 | 18 | 10 | 17 | 4 |
| Ancillary / Manipulators | 12 | 2 | 1 | 9 | 0 |
| Ancillary / Interrogators | 17 | 0 | 2 | 14 | 1 |
| Interacting with Others | 10 | 0 | 0 | 4 | 6 |
| Low-level / Manipulators | 20 | 0 | 2 | 18 | 0 |
| Low-level / Interrogators | 24 | 2 | 6 | 16 | 0 |
| Low-level / Syncing | 5 | 0 | 0 | 3 | 2 |
| Low-level / Internal Helpers | 18 | 1 | 2 | 12 | 3 |
| **合計** | **155** | **23** | **23** | **93** | **16** |

### Git LFS コマンド

| カテゴリ | 総数 | 高優先度 | 中優先度 | 低優先度 |
|----------|------|----------|----------|----------|
| High-level (Porcelain) | 23 | 7 | 8 | 8 |
| Low-level (Plumbing) | 10 | 0 | 5 | 5 |
| **合計** | **33** | **7** | **13** | **13** |

### MVP スコープ

MVP で対応予定のコマンド（Design Doc より）：

- `Git.clone` / `Git.init` / `Git.lsRemote` / `Git.raw`
- `WorktreeRepo.status` / `WorktreeRepo.log` / `WorktreeRepo.fetch` / `WorktreeRepo.push` / `WorktreeRepo.raw`
- `WorktreeRepo.lfs.pull` / `WorktreeRepo.lfs.push` / `WorktreeRepo.lfs.status`

---

## 参考リンク

- [Git Documentation](https://git-scm.com/docs)
- [Git LFS Documentation](https://github.com/git-lfs/git-lfs/tree/main/docs)
- [Git LFS Man Pages](https://github.com/git-lfs/git-lfs/tree/main/docs/man)

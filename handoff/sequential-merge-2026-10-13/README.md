# Type-Git: 別マシンへの引き継ぎ（2026-10-13）

ユーザーの依頼で作業を一時停止した時点の状態です。この資料・保存ブランチの追加自体は、既存 PR の CI／レビュー完了を意味しません。

## 再開する作業

ユーザーの指示は「95,99 は保留・対象外。129 から順番に、CI を通し、Copilot レビューの指摘を確認・修正し、良ければマージ、を繰り返す」です。#129 → #132 → #133 → … → #192 の順番で進めます。#130/#131 は既に #129 に取り込まれています。

現在 #129、#132、#133、#134、#135 はマージ済みです。次は #136。#136 の既存 PR は open、base は main、公開 head は `7404b6cbe7715c4df6a372af7a25912de65a8d51` です。この head は CI 全 15 件成功ですが、最新 Copilot に 2 件、CodeRabbit に 1 件の未解決スレッドがあります。追加対応は保存ブランチにコミットしてあり、PR 本体へは未反映です。ここを再開してください。

main には別作業でリリースされた 0.5.0 と #194 の revParse 修正があります。現在の main を保ったまま進め、リリース PR は操作しません。

## 保存したブランチ

| ブランチ | 内容 | 用途 |
| --- | --- | --- |
| `checkpoint/sequential-merge-handoff-2026-10-13` | この資料、台帳、移植可能な補助スクリプト、証拠ログ | 再開時に最初に読む |
| `checkpoint/pr-136-review-wip-2026-10-13` | 公開 #136 head + 未反映の追加レビュー対応（`50f310a3d50e1a0a4ea4c5876d2ce58a5065e9de`） | 最初に PR #136 に反映するコード |
| `checkpoint/pr-192-prepared-wip-2026-10-13` | #133〜#192 の準備済みコミット全体と #192 の途中修正（`880ad6c0203ba32dd7e321ae3ea205b9e13ec815`） | 後続 PR ごとの増分を取り出す履歴 |

**準備済み履歴は古い 0.4.0 の baseline です。tip の tree を main に上書きしないでください。** 外部リリースや既にマージしたレビュー修正を失います。台帳の各 `preparedCommit` の第一親との差分だけを、実際の新しい main に適用します。全準備済みコミットが #192 保存ブランチの祖先に含まれることを確認済みです。証拠ログの保存時には末尾の空白と余分な末尾空行だけを正規化しています。

## 別マシンでの初期化

新しい clone を使用すると、既存のユーザー変更と干渉しません。

```bash
git clone --branch checkpoint/sequential-merge-handoff-2026-10-13 https://github.com/ash-r1/type-git.git
cd type-git
pnpm install --frozen-lockfile
python3 handoff/sequential-merge-2026-10-13/helpers/bootstrap.py
```

GitHub CLI の認証、Node.js 20 以上、pnpm 10.26.2 が必要です。ネイティブ corpus の再生成には Git 2.55.0 が必要です。Git 2.25.1 は legacy 検証用です。追加の Git LFS／SVN／GUI 等の依存は該当テスト・devcontainer 定義を確認してください。旧マシンの `/tmp`、node_modules、Git ソースのキャッシュは前提にしていません。

bootstrap は mutable な台帳を共通 Git ディレクトリの `type-git-sequential-merge/ledger.json` に復元し、commit の存在を確認します。準備用 worktree は必要な PR ごとに作成します。既存の復元済み台帳は上書きしません。公開／保存ブランチや GitHub の最新状態を再確認してください。

## #136 を再開する具体的な手順

1. `helpers/review-status.py 136` で最新公開 head、CI、レビュー全文、未解決スレッドを読みます。保存済みの証拠は古くなるのでライブ状態を優先します。
2. 公開 head が引き続き `7404b6c...` なら、その head の専用 worktree を作り、保存コミット `50f310a...` を cherry-pick します。保存用の handoff 資料を PR に混ぜる必要はありません。
3. main が進んでいる場合は、台帳の `mainParent`（#135 の squash commit `7a93d8d10963b79b9ce1febae6149c433802f725`）から保存コード tip までの **#136 全体の feature delta** を、新しい main の別 worktree に三方向適用してください。
4. 生成物、lint、ソース／契約型検査、関連 native／legacy テストを確認し、PR branch に明示的な expected-head lease で push します。現在の公開 head が変わっていたら上書きせず変更を照合します。
5. レビュー返信・スレッド解決を行い、最新 head の全 CI と Copilot 再レビューを確認します。条件が揃えば squash merge し、#137 へ進めます。

保存した追加修正は次のとおりです。

- `parse_opt_strvec` のクリア後の `[]` が trailer の `present` 条件を満たしてしまう問題：Git の `trailer_args.nr` に合わせ、tag の 12 predicate を `nonempty` に変更。明示／暗黙 listing と、クリア後の再追加に回帰テストを追加。
- C long の幅：Windows LLP64、32-bit Unix ILP32、64-bit Unix LP64 を runtime architecture から選択する `c-abi.ts` を追加。生成スクリプトの一時 transpilation にも依存を追加。
- CodeRabbit の空 `--rebase-merges=` の指摘は、現状 `active` が空文字を含み、両順序とも native と wrapper が拒否するため再現しません。回帰テストを追加済み。規則を無条件に変えず、証拠付きで返信してください。

未解決スレッド：Copilot `PRRT_kwDOQwrwXs6rujtd`（trailer）、`PRRT_kwDOQwrwXs6rujt9`（32-bit Unix）、CodeRabbit `PRRT_kwDOQwrwXs6rulKu`（空 rebase-merges）。

追加修正について生成物、lint（0 errors）、全ソース／契約型検査、関連テスト 10 件は成功済みです。**保存 tip に対する GitHub CI／Copilot は未実施**です。先行する mainline 修正では、宣言が LP64 と 32-bit-long ABI の両変換を計算し、両方で無効な literal を拒否します。21 個の型の回帰ケースも通っています。

## #192 の保存状態

後段 ONE_SHOT diff parser が最後の completion word で終了する場合を追加し、未知の revision word の最終 usage 検査を適切に遅延しています。先に到達した callback の値検査は保持します。KEEP_UNKNOWN_OPT では abbreviation 登録をしないため、後段の native long-form metadata は exact resolution です。

opaque な stash 引数を「サンプルに ref が存在しない」という理由で型が拒否しないよう、oracle には有効な stash とダッシュで始まる ref を用意しました。最終 990 native outcomes／51 scopes に対する runtime 比較は成功。生成物・lint も成功です。全 source roots + completion 3 shards の型検査は直前の 930-case 版で成功しましたが、**最終 990-case 版の compiler 検査、全契約、npm integration は未実施**です。old baseline のため、#136 以降の main 修正を保持した実際の main 上で再検証してください。

## 後続を進める補助スクリプト

```bash
python3 handoff/sequential-merge-2026-10-13/helpers/prepare-main-pr.py 137
python3 handoff/sequential-merge-2026-10-13/helpers/review-status.py 137
```

prepare は直前 PR の MERGED、現在の remote head が記録した original head と一致、準備済み tree／parent tree の一致を検査します。独立 worktree に feature delta だけを適用し、競合時には停止します。競合解消後には生成物を再検査してください。push や draft 解除は検証後に行います。#136 は既に main 用 worktree を作って途中更新しているため、上の専用再開手順を使ってください。

`merge-reviewed-pr.py PR_NUMBER EXACT_HEAD` は squash merge を実行する mutation です。使用前にレビュー **全文**（非 inline の Previously missed を含む）を人間／エージェントが読み、全指摘を評価する必要があります。補助スクリプトだけではレビュー内容の正しさを判定しません。全 exact-head checks が SUCCESS、最新 Copilot が同一 head に対する完了した評価、未解決スレッドなし、最新 main に clean に適用できることを確認してから使います。

既存 branch の push は expected head を指定した lease を使い、main の直接 push、保護設定の緩和、merge policy の変更、リリース操作は行いません。#187〜#192 は draft なので必要な検証を揃えてから ready にします。保存 branch をそのまま一括 merge しないでください。

## 引き継ぐ修正と未完了事項

- main に入った #132 の GitEnabled literal、#134 の numeric range／positive／safe integer／revision-count literal、`--unpacked` の source-backed 証拠、#135 の stash 必須短縮値の空文字拒否を保持。
- #157 companion binary の explicit undefined、#158 PATH の大小文字と platform delimiter、#163 SVN の独立テスト分割、#175/#180 の数値 callback 検証順序、#191 の block statement 修正は prepared 履歴に含まれます。
- #169 以降は numeric callback の旧 LP64 固定 profile と今回の native C ABI 修正が衝突し得ます。mainline の ABI 差を戻さず、仕様データ／runtime／literal の対応を確認してください。旧 revision-count literal gate を新 callback profile と整合させることも必要です。
- old baseline の全ソース／契約型検査は #174 まで成功。#175 以降の全型／package checks は台帳の pending を確認。過去のローカル成功を新しい main 上の CI 成功として扱いません。
- 全 430 audit scopes は partial、complete は 0。有限 corpus と snapshot の一致を完全網羅と報告しません。
- 大きい compiler/native suite を同時に走らせすぎるとタイムアウトします。一つずつ実行し、失敗理由を評価し、健康な CI を不用意に再実行しません。

ユーザーは CI／レビュー対応後の feature branch 更新と順次 merge を既に承認しています。再開時に同じ許可を尋ね直す必要はありません。最後のユーザー指示は今回の一時停止・移行であり、この状態では追加マージをしていません。

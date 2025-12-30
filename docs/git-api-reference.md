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
| `am` | メールボックスから一連のパッチを適用 | - | 低 | |
| `archive` | 名前付きツリーからファイルのアーカイブを作成 | - | 低 | |
| `backfill` | 部分クローンで欠落しているオブジェクトをダウンロード | - | 低 | Git 2.41+ |
| `bisect` | バイナリサーチでバグを導入したコミットを特定 | - | 低 | |
| `branch` | ブランチの一覧表示、作成、削除 | - | 高 | |
| `bundle` | アーカイブでオブジェクトと参照を移動 | - | 低 | |
| `checkout` | ブランチの切り替えまたはワーキングツリーファイルの復元 | - | 高 | |
| `cherry-pick` | 既存コミットによる変更を適用 | - | 中 | |
| `citool` | git-commit の GUI 代替 | - | N/A | GUI ツール |
| `clean` | ワーキングツリーから追跡されていないファイルを削除 | - | 中 | |
| `clone` | リポジトリを新しいディレクトリにクローン | - | 高 | MVP |
| `commit` | リポジトリに変更を記録 | - | 高 | |
| `describe` | 利用可能な参照に基づいてオブジェクトに人間可読な名前を付与 | - | 低 | |
| `diff` | コミット間、コミットとワーキングツリー間などの変更を表示 | - | 高 | |
| `fetch` | 別のリポジトリからオブジェクトと参照をダウンロード | - | 高 | MVP |
| `format-patch` | メール送信用のパッチを準備 | - | 低 | |
| `gc` | 不要なファイルをクリーンアップし、ローカルリポジトリを最適化 | - | 低 | |
| `gitk` | Git リポジトリブラウザ | - | N/A | GUI ツール |
| `grep` | パターンに一致する行を出力 | - | 中 | |
| `gui` | Git のポータブル GUI | - | N/A | GUI ツール |
| `init` | 空の Git リポジトリを作成または既存のものを再初期化 | - | 高 | MVP |
| `log` | コミットログを表示 | - | 高 | MVP |
| `maintenance` | Git リポジトリデータを最適化するタスクを実行 | - | 低 | |
| `merge` | 2つ以上の開発履歴を結合 | - | 高 | |
| `mv` | ファイル、ディレクトリ、シンボリックリンクを移動または名前変更 | - | 中 | |
| `notes` | オブジェクトノートを追加または検査 | - | 低 | |
| `pull` | 別のリポジトリまたはローカルブランチからフェッチして統合 | - | 高 | |
| `push` | リモート参照を関連オブジェクトと共に更新 | - | 高 | MVP |
| `range-diff` | 2つのコミット範囲を比較 | - | 低 | |
| `rebase` | 別のベースチップ上にコミットを再適用 | - | 中 | |
| `reset` | 現在の HEAD を指定された状態にリセット | - | 高 | |
| `restore` | ワーキングツリーファイルを復元 | - | 中 | Git 2.23+ |
| `revert` | 既存のコミットを取り消す | - | 中 | |
| `rm` | ワーキングツリーとインデックスからファイルを削除 | - | 高 | |
| `scalar` | 大規模 Git リポジトリを管理するツール | - | 低 | Git 2.38+ |
| `shortlog` | git log 出力を要約 | - | 低 | |
| `show` | 様々な種類のオブジェクトを表示 | - | 中 | |
| `sparse-checkout` | ワーキングツリーを追跡ファイルのサブセットに縮小 | - | 低 | |
| `stash` | ダーティなワーキングディレクトリの変更を退避 | - | 高 | |
| `status` | ワーキングツリーの状態を表示 | - | 高 | MVP |
| `submodule` | サブモジュールの初期化、更新、検査 | - | 中 | |
| `switch` | ブランチを切り替える | - | 高 | Git 2.23+ |
| `tag` | タグを作成、一覧表示、削除、検証 | - | 高 | |
| `worktree` | 複数のワーキングツリーを管理 | - | 中 | Design Doc で言及 |

---

## 2. Git Ancillary Commands / Manipulators（補助コマンド / 操作系）

| コマンド | 説明 | 状態 | 優先度 | 備考 |
|----------|------|------|--------|------|
| `config` | リポジトリまたはグローバルオプションを取得・設定 | - | 高 | |
| `fast-export` | Git データエクスポーター | - | 低 | |
| `fast-import` | 高速 Git データインポーターのバックエンド | - | 低 | |
| `filter-branch` | ブランチを書き換え | - | 低 | 非推奨（filter-repo 推奨） |
| `mergetool` | マージコンフリクト解決ツールを実行 | - | 低 | |
| `pack-refs` | 効率的なリポジトリアクセスのためにヘッドとタグをパック | - | 低 | |
| `prune` | オブジェクトデータベースから到達不能なオブジェクトを削除 | - | 低 | |
| `reflog` | reflog 情報を管理 | - | 中 | |
| `refs` | 参照への低レベルアクセス | - | 低 | Git 2.42+ |
| `remote` | 追跡リポジトリのセットを管理 | - | 高 | |
| `repack` | リポジトリ内の未パックオブジェクトをパック | - | 低 | |
| `replace` | オブジェクトを置換する参照を作成、一覧表示、削除 | - | 低 | |

---

## 3. Git Ancillary Commands / Interrogators（補助コマンド / 照会系）

| コマンド | 説明 | 状態 | 優先度 | 備考 |
|----------|------|------|--------|------|
| `annotate` | コミット情報でファイル行を注釈 | - | 低 | blame のエイリアス |
| `blame` | 各行を最後に変更したリビジョンと作成者を表示 | - | 中 | |
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
| `checkout-index` | インデックスからワーキングツリーにファイルをコピー | - | 低 | |
| `commit-graph` | Git commit-graph ファイルを書き込み・検証 | - | 低 | |
| `commit-tree` | 新しいコミットオブジェクトを作成 | - | 低 | |
| `hash-object` | オブジェクト ID を計算し、オプションでファイルからオブジェクトを作成 | - | 中 | |
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
| `unpack-objects` | パックアーカイブからオブジェクトをアンパック | - | 低 | |
| `update-index` | ワーキングツリーのファイル内容をインデックスに登録 | - | 低 | |
| `update-ref` | 参照に格納されたオブジェクト名を安全に更新 | - | 低 | |
| `write-tree` | 現在のインデックスからツリーオブジェクトを作成 | - | 低 | |

---

## 6. Git Low-level Commands / Interrogators（低レベルコマンド / 照会系）

| コマンド | 説明 | 状態 | 優先度 | 備考 |
|----------|------|------|--------|------|
| `cat-file` | リポジトリオブジェクトの内容または詳細を提供 | - | 中 | |
| `cherry` | アップストリームにまだ適用されていないコミットを検索 | - | 低 | |
| `diff-files` | ワーキングツリーとインデックスのファイルを比較 | - | 低 | |
| `diff-index` | ツリーをワーキングツリーまたはインデックスと比較 | - | 低 | |
| `diff-pairs` | 提供された blob ペアの内容とモードを比較 | - | 低 | Git 2.47+ |
| `diff-tree` | 2つのツリーオブジェクトで見つかった blob の内容とモードを比較 | - | 低 | |
| `for-each-ref` | 各参照の情報を出力 | - | 中 | |
| `for-each-repo` | リポジトリのリストに対して Git コマンドを実行 | - | 低 | |
| `get-tar-commit-id` | git-archive で作成されたアーカイブからコミット ID を抽出 | - | 低 | |
| `last-modified` | ファイルの最終更新日時を表示（実験的） | - | 低 | Git 2.48+ |
| `ls-files` | インデックスとワーキングツリー内のファイル情報を表示 | - | 中 | |
| `ls-remote` | リモートリポジトリの参照を一覧表示 | - | 高 | MVP |
| `ls-tree` | ツリーオブジェクトの内容を一覧表示 | - | 中 | |
| `merge-base` | マージのための可能な限り良い共通祖先を検索 | - | 中 | |
| `name-rev` | 与えられた rev のシンボリック名を検索 | - | 低 | |
| `pack-redundant` | 冗長なパックファイルを検索 | - | 低 | |
| `repo` | リポジトリに関する情報を取得 | - | 低 | Git 2.48+ |
| `rev-list` | 逆時系列でコミットオブジェクトを一覧表示 | - | 中 | Design Doc で言及 |
| `rev-parse` | パラメータを抽出・加工 | - | 高 | |
| `show-index` | パックアーカイブインデックスを表示 | - | 低 | |
| `show-ref` | ローカルリポジトリの参照を一覧表示 | - | 中 | |
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
| `lfs checkout` | Git LFS ファイルから実際のコンテンツでワーキングコピーを作成 | - | 中 | |
| `lfs completion` | Git LFS コマンドのタブ補完用シェルスクリプトを生成 | - | 低 | |
| `lfs dedup` | Git LFS ファイルを重複排除 | - | 低 | |
| `lfs env` | Git LFS 環境を表示 | - | 中 | |
| `lfs ext` | Git LFS 拡張詳細を表示 | - | 低 | |
| `lfs fetch` | リモートから Git LFS ファイルをダウンロード | - | 高 | |
| `lfs fsck` | Git LFS ファイルの一貫性をチェック | - | 低 | |
| `lfs install` | Git LFS 設定をインストール | - | 高 | |
| `lfs lock` | Git LFS サーバーでファイルを「ロック」に設定 | - | 中 | |
| `lfs locks` | Git LFS サーバーで現在「ロック」されているファイルを一覧表示 | - | 中 | |
| `lfs logs` | Git LFS コマンドからのエラーを表示 | - | 低 | |
| `lfs ls-files` | インデックスとワーキングツリー内の Git LFS ファイル情報を表示 | - | 高 | |
| `lfs migrate` | 履歴を Git LFS に/から移行 | - | 中 | |
| `lfs prune` | ローカルストレージから古い Git LFS ファイルを削除 | - | 中 | |
| `lfs pull` | リモートから Git LFS 変更をフェッチし、必要なワーキングツリーファイルをチェックアウト | - | 高 | MVP |
| `lfs push` | キューに入った大きなファイルを Git LFS エンドポイントにプッシュ | - | 高 | MVP |
| `lfs status` | ワーキングツリー内の Git LFS ファイルのステータスを表示 | - | 高 | MVP |
| `lfs track` | Git LFS パスを Git attributes に表示または追加 | - | 高 | |
| `lfs uninstall` | フックと smudge/clean フィルター設定を削除して Git LFS をアンインストール | - | 中 | |
| `lfs unlock` | Git LFS サーバーでファイルの「ロック」設定を解除 | - | 中 | |
| `lfs untrack` | Git Attributes から Git LFS パスを削除 | - | 中 | |
| `lfs update` | 現在の Git リポジトリの Git フックを更新 | - | 低 | |
| `lfs version` | バージョン番号を報告 | - | 低 | |

---

## 10. Git LFS Low-level Commands（Git LFS 低レベルコマンド）

| コマンド | 説明 | 状態 | 優先度 | 備考 |
|----------|------|------|--------|------|
| `lfs clean` | 大きなファイルをポインタに変換する Git clean フィルター | - | 中 | |
| `lfs filter-process` | 大きなファイルとポインタ間を変換する Git process フィルター | - | 中 | |
| `lfs merge-driver` | テキストベースの LFS ファイルをマージ | - | 低 | |
| `lfs pointer` | ポインタをビルドおよび比較 | - | 中 | |
| `lfs post-checkout` | Git post-checkout フック実装 | - | 低 | フック |
| `lfs post-commit` | Git post-commit フック実装 | - | 低 | フック |
| `lfs post-merge` | Git post-merge フック実装 | - | 低 | フック |
| `lfs pre-push` | Git pre-push フック実装 | - | 中 | フック |
| `lfs smudge` | blob 内のポインタを実際のコンテンツに変換する Git smudge フィルター | - | 中 | |
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

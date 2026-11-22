# チャットボット運用手順書

ログインしているとき、各ページ（公開ページと組合員専用ページ）の右下に出る「サイト案内チャット」の運用手順です。
ホームページの使い方と、どのページに何があるかを、Claude API（Anthropic）で答えます。

## 目次

1. [仕組み](#1-仕組み)
2. [日常の操作（オン・オフ、回数の上限、質問ログと評価）](#2-日常の操作オンオフ回数の上限質問ログと評価)
3. [利用状況と費用の確認](#3-利用状況と費用の確認)
4. [案内文・モデルを変える](#4-案内文モデルを変える)
5. [Anthropic の API キーと支払い](#5-anthropic-の-api-キーと支払い)
6. [ログイン記録アプリ（kintone）](#6-ログイン記録アプリkintone)
7. [困ったとき](#7-困ったとき)
8. [初回セットアップ（記録）](#8-初回セットアップ記録)
9. [ローカルで試す](#9-ローカルで試す)

---

## 1. 仕組み

| 部品 | 場所 | 役割 |
|---|---|---|
| チャット欄 | `src/components/member/ChatWidget.tsx`、`ChatWidgetGate.tsx` | 各ページの右下に「質問する」ボタンを出す。サイト全体（`layout.tsx`）に置き、ログインしていて（`ChatWidgetGate`）、チャットがオンのときだけ出る。ログインしていない人には何も出さず、ログイン画面へも飛ばさない |
| 認証 Worker（`miyosino-auth`） | `workers/api/auth.ts` | kintone でログインした人に JWT を発行する。「ログイン記録」アプリを使って、JWT にその人の kintone のユーザーコードを入れる |
| チャット Worker（`miyosino-chat`） | `workers/api/chat.ts` | JWT を確かめ、回数を数え、Claude API に質問を送って答えを返す |
| Claude とのやりとり | `workers/api/_chat-core.ts` | 案内文と道具（`get_page_content`）を渡して質問し、Claude が道具を使えば公開ページの中身を渡して、答えが出るまで繰り返す（道具は3回まで） |
| 公開ページの中身 | `workers/api/_chat-knowledge.ts` | 公開ページの HTML（`<main>` の中）と、microCMS・周辺施設・団地のあゆみを取り、1時間覚えておく |
| ページの一覧 | `src/shared/constants/sitePages.ts` | パス・呼び方・説明・公開か組合員専用か。案内文のページ一覧、答えのリンク、チャットが読んでよいページ、サイトマップは、ここから作る |
| 案内文 | `workers/api/chat-guide.ts` | 答え方の決まりと、画面の操作の説明（ページ一覧は sitePages.ts から作る） |
| D1（`miyosino-chat`） | Cloudflare | 日ごとの利用回数、設定（オン・オフ、回数の上限、質問ログと評価）、質問ログ、評価を置く |
| Claude API | Anthropic | 答えを作る。モデルは `claude-haiku-5-5` |

- **使える人**: ログインし、kintone のユーザーコードで識別された人だけです。ログイン中は、公開ページでも組合員専用ページでも使えます
- **回数の上限**: 1人1日の上限と、全員合計の1日の上限があります。日本時間の 0 時に戻ります。答えられなかった分は数えません
- **会話の保存**: 会話はブラウザの sessionStorage に残り、ページを移っても続きます。タブを閉じたときとログアウトしたときに消えます。サーバー（D1）には、質問ログと評価をオンにしたときだけ、だれのものかわからない形で保存します（[2章](#2-日常の操作オンオフ回数の上限質問ログと評価)）
- **ページへのリンク**: 答えの中の「ページ名（/パス）」は、ページ名がそのページへのリンクになります（決まったページだけ。パスは表示しない）
- **入力した内容の行き先**: 質問は、答えを作るために Anthropic（米国）のサーバーに送られます。チャット欄には「個人情報を入力しないでください」と出しています

### チャットが参照する情報

| 参照する（答えに使う） | 参照しない |
|---|---|
| だれでも見られる公開ページ（`sitePages.ts` で `visibility: 'public'` のページ）の文章と、そこに表示される microCMS・周辺施設・団地のあゆみ | 組合員専用ページ（`visibility: 'member'`）の中身すべて。お知らせ、イベント情報、会議情報、回覧板・配布資料、グリーンウェルネス、各種申請、団地運営 |

- 参照した内容は、質問といっしょに Anthropic に送られます。**組合員専用ページの情報を Anthropic に送ることについては承認を得ていないので、参照しません**（プライバシーポリシーにもそう書いています）。組合員専用ページの中身を答えに使うようにするには、先に承認を得て、プライバシーポリシーを直してください
- 公開ページの文章は、`wrangler.chat.toml` の `SITE_URL`（いまは GitHub Pages）で公開しているページから読みます。ページを直して公開すれば、1時間以内にチャットの知識も同じになります（チャット Worker のデプロイは不要）。`staging` に入れる前の変更は、まだ読めません
- サイトの公開先を変えたら（例: `https://k-miyosino.com`）、`SITE_URL` を変えてチャット Worker をデプロイしてください
- microCMS・周辺施設・団地のあゆみは、`contents`・`places`・`history` の各 Worker からサービスバインディングで取ります

---

## 2. 日常の操作（オン・オフ、回数の上限、質問ログと評価）

コマンドはどれも **`workers` フォルダーで** 実行します。Windows の PowerShell でも動きます。
事前に `npx wrangler login` で Cloudflare にログインしておいてください。

```bash
cd workers
npm run chat:status               # 今の設定を見る
npm run chat:off                  # チャットを止める（「質問する」ボタンが消える）
npm run chat:on                   # チャットを再開する
npm run chat:limits -- 30 500     # 上限を1人1日30回、全員合計で1日500回にする
```

`chat:status` は次のように表示されます。

```
key                │ value
enabled            │ 1      ← 1 ならオン、0 ならオフ
feedback_enabled   │ 0      ← 評価のボタン（1 なら出す）
limit_per_user     │ 20     ← 1人1日の上限
limit_total        │ 300    ← 全員合計の1日の上限
log_enabled        │ 0      ← 質問ログ（1 なら保存する）
log_retention_days │ 180    ← 質問ログと評価を残す日数
```

- 変更はすぐに反映され、デプロイし直しても戻りません
- 上限を上げると、その日のうちから効きます（今日すでに上限まで使った人も、その分だけ使えるようになります）
- 上限を 0 にすると、誰も使えなくなります。止めたいときは `chat:off` を使ってください（ボタンごと消えます）

Cloudflare ダッシュボードの D1（`miyosino-chat`）のコンソールで SQL を実行しても同じです。

```sql
UPDATE chat_settings SET value = '0' WHERE key = 'enabled';          -- オフ（'1' でオン）
UPDATE chat_settings SET value = '30' WHERE key = 'limit_per_user';  -- 1人1日の上限
UPDATE chat_settings SET value = '500' WHERE key = 'limit_total';    -- 全員合計の上限
```

### 質問ログと評価

答えを良くするための記録です。**どちらも最初はオフです。** だれの質問・評価かは保存しません。

| 記録 | 中身 | オンのときの画面 |
|---|---|---|
| 質問ログ | 日時、ページ、会話ごとのランダムな番号、質問と答え（電話番号・メールアドレス・部屋番号らしい文字列は「＊＊＊」に置き換える）、答えたか断られたか、トークン数 | 入力欄の下に「質問と回答は…○日間保存します」と「この会話を保存しない」が出る |
| 評価 | 日時、ページ、会話ごとの番号、何番目の答えか、わかった／少しわかった／わからなかった | 最新の答えの下に3つのボタンが出る。「わからなかった」には事務所とお問い合わせページを案内する |

```bash
cd workers
npm run chat:log -- on            # 質問ログを保存する（off で止める）
npm run chat:rating -- on         # 評価のボタンを出す（off で止める）
npm run chat:log-days -- 180      # 質問ログと評価を残す日数（1〜3650）
```

- 利用者が「この会話を保存しない」を選ぶと、質問ログは保存しません。評価は、質問と答えを含まない形で保存します
- 名前は「＊＊＊」に置き換えられません（ふつうの言葉と見分けられないため）。チャット欄で、個人情報を入力しないよう案内しています
- 保存期間を過ぎた質問ログと評価は、チャット Worker の定期実行が毎日（日本時間 4:00）消します。回数の記録（kintone のユーザーコードを含む `chat_usage`）は7日で消します

**オンにする前に**

1. プライバシーポリシー（`/privacy` の「7. 組合員向けチャットボット」）が公開されていること
2. 保存期間がプライバシーポリシーの日数（180日）と同じであること。**`chat:log-days` で日数を変えたら、`src/app/privacy/page.tsx` の日数も直して公開してください**
3. 必要なら、組合員にお知らせで伝えておく

---

## 3. 利用状況と費用の確認

### 回数（D1）

```bash
cd workers
# 直近14日の、全員合計の利用回数
npx wrangler d1 execute miyosino-chat --remote --config wrangler.chat.toml --command "SELECT date_jst, count FROM chat_usage_total ORDER BY date_jst DESC LIMIT 14"
```

1人ごとの回数は `chat_usage` テーブルにあります（`user_id` は kintone のユーザーコードなので、扱いに注意してください。7日で消えます）。

### 質問ログと評価

```bash
cd workers
npm run chat:logs                         # 直近の質問ログ（20件）
npm run chat:logs -- --limit 100          # 件数を変える
npm run chat:logs -- --limit 1000 --csv logs.csv   # CSV に書き出す（Excel で開ける）
npm run chat:ratings                      # 直近30日の評価の集計と、「わからなかった」の質問と答え
npm run chat:ratings -- --days 7          # 集計する日数を変える
```

- 「わからなかった」の質問と答えは、案内文（`workers/api/chat-guide.ts`）を直すいちばんの手がかりです。よく来る質問は、評価用の想定質問（`workers/eval/chat-questions.md`）にも足してください
- 運用ダッシュボード（`/member/ops`）の「チャット」→「見直し」に、評価が「わからなかった」「少しわかった」の質問と、答えられなかった・断った答えがまとまります。直したら「直した」を記録し、「想定質問の行をコピー」で想定質問に足します（OPS.md）
- 書き出した CSV には質問の文章が入ります。共有するときは扱いに注意し、使い終わったら消してください

### 費用（Anthropic）

- Anthropic コンソール（https://console.anthropic.com）の「Usage」で、使った量と金額を見られます
- 目安: 質問1回あたり 0.1 円程度。全員合計の上限（300回）まで毎日使われても、1か月 1,500 円前後です
- 残高は「Billing」で見られます。残高がなくなると、チャットは「答えを受け取れませんでした」になります

---

## 4. 案内文・モデルを変える

### 案内文（答えられる範囲）

答え方の決まりと画面の操作の説明は `workers/api/chat-guide.ts`、ページの一覧は `src/shared/constants/sitePages.ts` を直します。案内文と、公開ページから読んだ内容に書かれていないことには答えず、管理組合事務所やお問い合わせページを案内します。

**ページを追加・削除・改名したときは、`sitePages.ts` だけを直します。** 案内文のページ一覧、答えのリンク、チャットが読んでよいページ、サイトマップが、まとめて変わります。公開ページを足したときは、画面が表示されてから読み込む中身（microCMS など）があれば `extraContent` にも書きます。

案内文は次の節でできています。

| 節 | 内容 |
|---|---|
| 役割 | 何に答えるか |
| 書き方 | 答えの長さ（全体で3文まで、手順は5つまで、1文はおおむね40字まで）、手順の書き方、言葉の選び方。[yomiyasu](https://github.com/nanaism/yomiyasu)（MIT License）の推敲のルールから、短い答えに関係するものを抜き出してまとめたもの |
| 答えられないとき | 案内にないこと、関係のない質問、個人情報の扱い |
| 公開ページの内容を調べる | 内容を聞かれたら道具で調べてから答える、調べた内容にないことは答えない、一覧は5件まで、組合員専用ページの中身は調べられない |
| ホームページの案内 | ページの一覧（sitePages.ts から作る）と、ログイン・資料の保存・文字の拡大などの操作の手順 |

書くときの注意:

- 画面の表示（ボタンの名前など）は、実際の画面と同じ言葉で書きます。画面を変えたら案内文も直します
- 答えの中の「ページ名（/パス）」は、画面でページ名がリンクになり、パスは表示されません。リンクにするのは `sitePages.ts` にあるページだけです
  - 「イベント情報」（/member/events）のように、ページ名がかぎ括弧（「」『』）で囲まれていても、中の名前がリンクになります
  - 括弧の直前が一覧の呼び方と違うときは「（開く）」のリンクになります。答えの書き方の揺れは、一覧に呼び方を足して吸収できます
  - 一覧にないパスは画面から消えます
- 日付など毎回変わる値は入れません（プロンプトキャッシュが効かなくなります）

### 想定質問で試す（chat:eval。案内文を直したら流す）

`workers/eval/chat-questions.md` の想定質問を1問ずつ送り、答えを比べられるように保存します。チャットの利用回数には数えません。

```bash
cd workers
# .dev.vars に ANTHROPIC_API_KEY=... を書いておく（コミットしない）
npm run chat:eval                                   # 全問を送る（1回で数円）
npm run chat:eval -- --model claude-sonnet-5-5      # モデルを変えて比べる
npm run chat:eval -- --dry-run                      # API を呼ばずに、読み込んだ質問だけ表示する
```

結果は `workers/eval/results/<日時>.md` に保存されます（コミットされません）。

- 評価は Worker と同じ部品（`_chat-core.ts`、`_chat-knowledge.ts`）を使い、公開ページの中身は公開の URL（`SITE_URL` と、`contents`・`places`・`history` の各 Worker）から読みます。インターネットにつながった環境で流してください
- 表の「読んだページ」に、道具で読んだ公開ページが出ます。内容を聞く質問で何も読んでいない、組合員専用ページの質問で何か読んでいる、といったときは案内文を見直します

- 表の「注意」に、書き方の決まりから外れた答えが出ます（文が多い、手順が5つより多い、長い文、記号・絵文字、挨拶・締め、電話番号や部屋番号のくり返し）
- 「注意」は目安です。中身が正しいか（案内にないことを作っていないか、ページを正しく案内しているか）は、`chat-questions.md` の「期待:」を見ながら読んで確かめます
- 前の結果のファイルと並べて、良くなったか悪くなったかを比べます
- 想定質問は、質問ログを始めたら、実際によく来る質問に入れ替えます

yomiyasu を手元に入れていれば、結果の日本語を点検できます（Python 3 が必要です）。

```bash
python3 <yomiyasu を置いた場所>/skills/yomiyasu/scripts/yomiyasu_lint.py --doc-type manual eval/results/<日時>.md
```

点検の結果は見直しの候補で、合否ではありません。表や質問の行にも候補が出るので、答えの部分だけを見てください。

### 反映

反映にはチャット Worker のデプロイが必要です。

- `develop` → `staging` → `main` とマージすると、`main` へのマージで自動でデプロイされます
- 先に反映したいときは、GitHub の Actions →「Deploy Workers」→「Run workflow」で、ブランチを選んで `chat` を実行します

### モデル

`workers/wrangler.chat.toml` の `[vars]` の `CHAT_MODEL` を変えて、デプロイします。費用が大きく変わるので注意してください（`claude-haiku-5-5` に比べ、`claude-sonnet-5-5` は約20倍、`claude-opus-5-5` は約40倍）。

---

## 5. Anthropic の API キーと支払い

### API キー

- **ワークスペースに属したキーを使います。** 組織全体のキー（ワークスペースに属さないキー）だと、次のエラーで答えが返りません
  ```
  This API key is not scoped to a workspace, so this request must include the anthropic-workspace-id header
  ```
- キーは作ったときに一度しか表示されません。忘れたら作り直して、登録し直します
- 作り方: コンソールの「Settings」→「Workspaces」でワークスペース（例: `miyosino-chat`）を作る →「API Keys」→「Create Key」でそのワークスペースを選ぶ
- 登録（すぐに反映され、デプロイは不要）:
  ```bash
  cd workers
  npx wrangler secret put ANTHROPIC_API_KEY --config wrangler.chat.toml
  ```
- キーはチャットやメール、リポジトリに貼らないでください。入れ替えたら、古いキーはコンソールで削除します
- ワークスペースの地域は「アメリカ合衆国」で問題ありません

### 支払い

- 前払いのクレジット制です。買った残高より多く引かれることはありません
- **クレジットは購入日から1年で失効し、返金されません。** 少額ずつ買い足すのがおすすめです
- 自動チャージ（auto-reload）はオフのままにします
- ワークスペースの設定で、月の利用額の上限（spend limit）も設定しておきます

---

## 6. ログイン記録アプリ（kintone）

kintone の OAuth には「ログイン中のユーザー」を返す API がありません。そこで認証 Worker は、ログインとトークン更新のたびに、本人のトークンで「ログイン記録」アプリにレコードを1件追加し、その「作成者」から kintone のユーザーコードを得ます。チャットの「1人1日の回数」は、このユーザーコードで数えます。

### アプリの設定

- **置き場所**: 通常のアプリか、組合員全員が入っているスペース。**ゲストスペースには置かない**（API のアドレスが変わり、使えません）
- **フォーム**: フィールドは追加しない。**必須項目のフィールドは置かない**（空のレコードを追加するので、必須項目があると失敗します）
- **アプリのアクセス権**: 組合員（全員が入るグループや組織）に「レコード閲覧」と「レコード追加」だけを許可する
- **レコードのアクセス権**（おすすめ）: 条件「すべてのレコード」で、管理者は閲覧・編集・削除、**作成者は閲覧**、Everyone はなし。作成者が自分のレコードを閲覧できることは必須です（追加した直後に読み返すため）
- **API トークン**: 不要
- **プロセス管理・通知**: オフ
- **OAuth クライアント**: cybozu.com 共通管理の OAuth クライアントにスコープの設定があれば、「アプリのレコードの追加・編集・削除」（`k:app_record:write`）を加える

アプリ ID（URL の `/k/123/` の `123`）は、認証 Worker に登録します。

```bash
cd workers
npx wrangler secret put KINTONE_LOGIN_LOG_APP_ID --config wrangler.auth.toml
```

### 運用

- レコードは、ログインとトークン更新（7日ごと）のたびに増えます。古いもの（例: 半年より前）は消してかまいません。消しても動作には影響しません
- 識別できなかった人（アプリ ID が未設定、権限不足など）もログインはできます。その人のチャットには「いったんログアウトして、もう一度ログインしてください」と出ます

---

## 7. 困ったとき

### まずログを見る

```bash
cd workers
npx wrangler tail --config wrangler.chat.toml   # チャット Worker のログ（auth は wrangler.auth.toml）
```

ログが流れる状態で、ブラウザから質問すると `[Chat]` で始まる行が出ます。Cloudflare ダッシュボードの Worker の「ログ」でも見られます。

### 症状と原因

| 症状 | 考えられる原因と対処 |
|---|---|
| 「質問する」ボタンが出ない | チャットがオフ（`npm run chat:status`）／チャット Worker の `ANTHROPIC_API_KEY` か `JWT_SECRET` が未登録／チャット Worker の `JWT_SECRET` がほかの Worker と違う／組合員専用ページにログインしていない |
| 「利用者を確認できませんでした」 | ログアウトしてから再ログインしていない／ログイン記録アプリの権限・置き場所／OAuth のスコープ。ログイン記録アプリに自分のレコードが増えるか確かめる |
| 「答えを受け取れませんでした」 | ログに `Claude API error: <番号>` が出る。401 はキーの誤り、400 で `not scoped to a workspace` はワークスペースに属さないキー（[5章](#5-anthropic-の-api-キーと支払い)）、400 で `credit balance` は残高不足 |
| 「今日の利用回数の上限に達しました」 | 1人1日の上限。必要なら `npm run chat:limits` で上げる |
| 「今日はチャットの利用が混み合っているため…」 | 全員合計の上限。必要なら `npm run chat:limits` で上げる |
| 保存の表示・評価のボタンが出ない | 質問ログ・評価がオフ（`npm run chat:status` の `log_enabled`・`feedback_enabled`）。評価のボタンは、最新の答えにだけ出る |
| `chat:logs` に何も出ない | 質問ログがオフ、利用者が「この会話を保存しない」を選んでいる、または保存期間を過ぎて消えた |

### コマンドのエラー

| エラー | 対処 |
|---|---|
| `Could not read file: wrangler.chat.toml`（パスが二重に表示される） | `workers` フォルダーで実行していない。`cd workers` してから実行する |
| `Invalid property: databaseId => Invalid uuid` | 手元の `wrangler.chat.toml` が古い。`git pull` で最新にする |
| `execvpe(/bin/bash) failed`（Windows） | bash のスクリプトを呼んでいる。`npm run set-jwt-secret` などの bash のスクリプトは、Windows では WSL か Git Bash で実行する |
| 最後に `Assertion failed ... async.c` | Windows で wrangler がエラーで終わるときに出る表示。無視してよい |

---

## 8. 初回セットアップ（記録）

2026年11月に済ませた手順です。作り直すときの参考にしてください。

1. kintone に「ログイン記録」アプリを作る（[6章](#6-ログイン記録アプリkintone)）
2. 認証 Worker にアプリ ID を登録する: `npx wrangler secret put KINTONE_LOGIN_LOG_APP_ID --config wrangler.auth.toml`
3. D1 を作る: `npx wrangler d1 create miyosino-chat`。表示された `database_id` を `workers/wrangler.chat.toml` に書いてコミットする（Actions のデプロイがファイルを読むため）
4. テーブルを作る: `npx wrangler d1 migrations apply miyosino-chat --remote --config wrangler.chat.toml`（最初はオン、上限は1人20回・全員300回）
5. Anthropic でクレジットを買い、ワークスペースに属した API キーを作る（[5章](#5-anthropic-の-api-キーと支払い)）
6. チャット Worker にシークレットを登録する: `ANTHROPIC_API_KEY` と `JWT_SECRET`（ほかの Worker と同じ値）
7. GitHub の Actions →「Deploy Workers」で `auth` と `chat` をデプロイする（Workers は本番・テスト共通。`auth` をデプロイした時点で本番のログインも切り替わる）
8. `staging` にマージして、画面を公開する
9. 組合員専用ページで **ログアウトしてから再ログイン** し、ログイン記録アプリに自分のレコードが増えること、「質問する」から答えが返ることを確かめる

---

## 9. ローカルで試す

```bash
cd workers
# .dev.vars に ANTHROPIC_API_KEY と JWT_SECRET（本番と同じ値）を書いておく（.dev.vars はコミットしない）
npx wrangler d1 migrations apply miyosino-chat --local --config wrangler.chat.toml  # ローカルの D1 にテーブルを作る（初回だけ）
npm run dev:chat                                                                      # http://localhost:8787 で起動

# 別のターミナルで、.env.local に NEXT_PUBLIC_CHAT_API_URL=http://localhost:8787 を書いてから
cd ..
npm run dev
```

http://localhost:3000/member/ でログインすると、右下に「質問する」ボタンが出ます。ログインは本番の認証 Worker を使います。ローカルの設定は `--remote` を外したコマンドで変えます（例: `npx wrangler d1 execute miyosino-chat --local --config wrangler.chat.toml --command "..."`）。

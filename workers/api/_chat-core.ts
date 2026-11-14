/**
 * チャットボットの Claude とのやりとり（Worker と評価スクリプトの両方から使う）
 *
 * - 案内文（chat-guide.ts）と道具 get_page_content を渡して質問する
 * - Claude が道具を使いたいと言ったら、公開ページの中身（_chat-knowledge.ts）を取ってきて渡し、答えが出るまで繰り返す
 * - 道具は公開ページだけを選べる。組合員専用ページの中身は読まない
 */

import Anthropic from '@anthropic-ai/sdk';
import { CHAT_SYSTEM_PROMPT } from './chat-guide';
import { READABLE_PAGE_PATHS } from './_chat-knowledge';

type BetaMessageParam = Anthropic.Beta.Messages.BetaMessageParam;
type BetaTool = Anthropic.Beta.Messages.BetaTool;
type BetaToolResultBlockParam = Anthropic.Beta.Messages.BetaToolResultBlockParam;

export const DEFAULT_MODEL = 'claude-haiku-5-5';
// 1回の答えの上限。考える分のトークンも含む
const MAX_TOKENS = 8000;
// 道具を使ってよい回数（これを超えたら道具を使わせずに答えを出させる）
const MAX_TOOL_ROUNDS = 3;
// サーバー側の自動フォールバック（fallbacks: "default"）に対応しているモデル
const MODELS_WITH_SERVER_FALLBACK = new Set([
  'claude-fable-5-1',
  'claude-opus-5-5',
  'claude-opus-5',
  'claude-sonnet-5-5',
]);

export const REFUSAL_REPLY =
  'すみません、この質問にはお答えできません。管理組合事務所かお問い合わせページ（/contact）にお問い合わせください。';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeReply {
  reply: string;
  outcome: 'answered' | 'refused';
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** 道具で読んだページのパス（読んだ順） */
  pagesRead: string[];
}

export const PAGE_CONTENT_TOOL_NAME = 'get_page_content';

const PAGE_CONTENT_TOOL: BetaTool = {
  name: PAGE_CONTENT_TOOL_NAME,
  description:
    'だれでも見られる公開ページに書かれている内容（ページの文章と、そのページに表示される一覧）を取り出す。' +
    '公開ページの内容（バスの時間、駐車場の料金、集会所、サークル、周辺のお店、団地のあゆみなど）を聞かれたら、答える前にこれで調べる。' +
    '組合員専用ページの中身は取り出せない。',
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        enum: [...READABLE_PAGE_PATHS],
        description: '調べるページのパス（例: /access）',
      },
    },
    required: ['path'],
    additionalProperties: false,
  },
};

/** 道具を実行する関数（Worker と評価スクリプトで、ページの取り方だけが違う） */
export type PageContentReader = (path: string) => Promise<string>;

async function runTool(
  block: { id: string; name: string; input: unknown },
  readPage: PageContentReader,
  pagesRead: string[]
): Promise<BetaToolResultBlockParam> {
  const path = (block.input as { path?: unknown } | null)?.path;
  if (block.name !== PAGE_CONTENT_TOOL_NAME || typeof path !== 'string') {
    return { type: 'tool_result', tool_use_id: block.id, content: '使えない道具か、パスがありません', is_error: true };
  }
  try {
    const content = await readPage(path);
    pagesRead.push(path); // 読めたページだけを記録する（拒否された組合員専用ページなどは入れない）
    return { type: 'tool_result', tool_use_id: block.id, content };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { type: 'tool_result', tool_use_id: block.id, content: message, is_error: true };
  }
}

/** 会話を送り、必要なら公開ページを調べて、答えを返す */
export async function runChat(options: {
  apiKey: string;
  model?: string;
  messages: ChatTurn[];
  readPage: PageContentReader;
}): Promise<ClaudeReply> {
  const model = options.model || DEFAULT_MODEL;
  const client = new Anthropic({ apiKey: options.apiKey, maxRetries: 1 });
  const useFallback = MODELS_WITH_SERVER_FALLBACK.has(model);
  const conversation: BetaMessageParam[] = options.messages.map((m) => ({ role: m.role, content: m.content }));
  const pagesRead: string[] = [];
  let inputTokens = 0;
  let outputTokens = 0;

  for (let round = 0; ; round++) {
    const toolsAllowed = round < MAX_TOOL_ROUNDS;
    const response = await client.beta.messages.create({
      model,
      max_tokens: MAX_TOKENS,
      // 案内の質問は難しくないので、考える量を抑えて速さと費用を優先する
      output_config: { effort: 'low' },
      // 安全上の理由で断られたとき、サーバー側で別のモデルに答えさせる
      ...(useFallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
      tools: [PAGE_CONTENT_TOOL],
      tool_choice: toolsAllowed ? { type: 'auto' } : { type: 'none' },
      system: [{ type: 'text', text: CHAT_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: conversation,
    });
    inputTokens += response.usage.input_tokens;
    outputTokens += response.usage.output_tokens;
    const usage = { model, inputTokens, outputTokens, pagesRead };

    if (response.stop_reason === 'refusal') {
      return { reply: REFUSAL_REPLY, outcome: 'refused', ...usage };
    }
    if (response.stop_reason === 'tool_use' && toolsAllowed) {
      // 答えの途中の内容（考えた跡を含む）はそのまま返し、道具の結果を足して続ける
      conversation.push({ role: 'assistant', content: response.content });
      const toolUses = response.content.flatMap((b) => (b.type === 'tool_use' ? [b] : []));
      const results = await Promise.all(toolUses.map((b) => runTool(b, options.readPage, pagesRead)));
      conversation.push({ role: 'user', content: results });
      continue;
    }

    const reply = response.content
      .flatMap((block) => (block.type === 'text' ? [block.text] : []))
      .join('')
      .trim();
    if (!reply) {
      throw new Error(`Empty reply (stop_reason: ${response.stop_reason})`);
    }
    return { reply, outcome: 'answered', ...usage };
  }
}

// SPDX-License-Identifier: BUSL-1.1
import { randomUUID } from 'node:crypto';
import {
  AnthropicProvider,
  ConsentGuard,
  CostController,
  InMemoryConsentRepository,
  InMemoryCostStore,
  InMemoryInvocationLedgerSink,
  InvocationLedger,
  LLMOrchestrator,
  LlamaCppProvider,
  OllamaProvider,
  OpenAIProvider,
  PromptTemplateRegistry,
  TierRouter,
  VllmProvider,
} from '../src/index.js';
import type {
  AnthropicMessagesClient,
  AnthropicMessageRequest,
  AnthropicResponse,
  HttpFetch,
  LLMProvider,
  OpenAIClient,
  OpenAIChatRequest,
  OpenAIChatResponse,
  OpenAIEmbeddingRequest,
  OpenAIEmbeddingResponse,
} from '../src/index.js';

export const PT_VERSION = 'pt:test:v1';

export function buildTemplates(): PromptTemplateRegistry {
  const t = new PromptTemplateRegistry();
  t.register(PT_VERSION, 'You are an ISO 42001 audit assistant. Respond concisely.');
  return t;
}

export function buildEngagement() {
  return { firmId: randomUUID(), engagementId: randomUUID() };
}

export class MockHttp {
  public readonly calls: { url: string; body: unknown; method: string }[] = [];
  constructor(
    private readonly handler: (
      url: string,
      body: unknown,
    ) =>
      | { status: number; body: unknown }
      | Promise<{ status: number; body: unknown }>,
  ) {}
  fetch: HttpFetch = async (url, init) => {
    const parsed = init?.body ? JSON.parse(init.body) : null;
    this.calls.push({ url, body: parsed, method: init?.method ?? 'POST' });
    const out = await this.handler(url, parsed);
    return {
      status: out.status,
      text: async () => JSON.stringify(out.body),
      json: async () => out.body,
    };
  };
}

export class MockAnthropicClient implements AnthropicMessagesClient {
  public readonly calls: AnthropicMessageRequest[] = [];
  constructor(
    private readonly handler: (
      req: AnthropicMessageRequest,
    ) => AnthropicResponse | Promise<AnthropicResponse>,
  ) {}
  async create(req: AnthropicMessageRequest): Promise<AnthropicResponse> {
    this.calls.push(req);
    return this.handler(req);
  }
}

export class MockOpenAIClient implements OpenAIClient {
  public readonly chatCalls: OpenAIChatRequest[] = [];
  public readonly embeddingCalls: OpenAIEmbeddingRequest[] = [];
  constructor(
    private readonly chatHandler: (
      req: OpenAIChatRequest,
    ) => OpenAIChatResponse | Promise<OpenAIChatResponse>,
    private readonly embeddingHandler: (
      req: OpenAIEmbeddingRequest,
    ) => OpenAIEmbeddingResponse | Promise<OpenAIEmbeddingResponse> = (req) => ({
      data: req.input.map((_, i) => ({ embedding: [0.1, 0.2], index: i })),
      model: req.model,
    }),
  ) {}
  async chatCompletions(req: OpenAIChatRequest): Promise<OpenAIChatResponse> {
    this.chatCalls.push(req);
    return this.chatHandler(req);
  }
  async embeddings(req: OpenAIEmbeddingRequest): Promise<OpenAIEmbeddingResponse> {
    this.embeddingCalls.push(req);
    return this.embeddingHandler(req);
  }
}

export interface BuiltProviderHarness {
  templates: PromptTemplateRegistry;
  ollama: OllamaProvider;
  vllm: VllmProvider;
  llamacpp: LlamaCppProvider;
  anthropic: AnthropicProvider;
  openai: OpenAIProvider;
  ollamaHttp: MockHttp;
  vllmHttp: MockHttp;
  llamacppHttp: MockHttp;
  anthropicClient: MockAnthropicClient;
  openaiClient: MockOpenAIClient;
}

export function buildAllProviders(): BuiltProviderHarness {
  const templates = buildTemplates();
  const ollamaHttp = new MockHttp((url) => {
    if (url.endsWith('/api/embeddings')) {
      return { status: 200, body: { embedding: [0.1, 0.2, 0.3] } };
    }
    if (url.endsWith('/api/show')) {
      return { status: 200, body: { digest: 'sha256:abc123' } };
    }
    return {
      status: 200,
      body: {
        response: '{"answer":"42"}',
        prompt_eval_count: 4,
        eval_count: 2,
        digest: 'sha256:abc123',
      },
    };
  });
  const vllmHttp = new MockHttp((url) => {
    if (url.endsWith('/v1/embeddings')) {
      return {
        status: 200,
        body: { data: [{ embedding: [0.1, 0.2] }] },
      };
    }
    return {
      status: 200,
      body: {
        choices: [{ text: '{"answer":"42"}' }],
        usage: { prompt_tokens: 4, completion_tokens: 2 },
        model: 'llama-3.1-8b',
      },
    };
  });
  const llamacppHttp = new MockHttp((url) => {
    if (url.endsWith('/embedding')) {
      return { status: 200, body: { embedding: [0.1, 0.2] } };
    }
    return {
      status: 200,
      body: { content: '{"answer":"42"}', tokens_evaluated: 4, tokens_predicted: 2 },
    };
  });
  const anthropicClient = new MockAnthropicClient((req) => {
    if (req.tools && req.tool_choice) {
      return {
        id: 'msg_1',
        model: req.model,
        content: [
          {
            type: 'tool_use',
            name: req.tools[0]!.name,
            input: { answer: '42' },
          },
        ],
        usage: { input_tokens: 4, output_tokens: 2 },
        stop_reason: 'tool_use',
      };
    }
    if (req.thinking) {
      return {
        id: 'msg_2',
        model: req.model,
        content: [
          { type: 'thinking', thinking: 'considering both options' },
          { type: 'text', text: '{"answer":"42"}' },
        ],
        usage: { input_tokens: 4, output_tokens: 6 },
        stop_reason: 'end_turn',
      };
    }
    return {
      id: 'msg_3',
      model: req.model,
      content: [{ type: 'text', text: '{"answer":"42"}' }],
      usage: { input_tokens: 4, output_tokens: 2 },
      stop_reason: 'end_turn',
    };
  });
  const openaiClient = new MockOpenAIClient((req) => {
    return {
      id: 'cmpl_1',
      model: req.model,
      choices: [
        {
          message: {
            content: '{"answer":"42"}',
            ...(req.reasoning ? { reasoning: 'considered both options' } : {}),
          },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 4, completion_tokens: 2 },
    };
  });

  const ollama = new OllamaProvider({
    baseUrl: 'http://localhost:11434',
    defaultModel: 'llama3.1:8b',
    embeddingModel: 'nomic-embed-text',
    templates,
    fetchImpl: ollamaHttp.fetch,
  });
  const vllm = new VllmProvider({
    baseUrl: 'http://localhost:8000',
    defaultModel: 'llama-3.1-8b',
    templates,
    fetchImpl: vllmHttp.fetch,
  });
  const llamacpp = new LlamaCppProvider({
    baseUrl: 'http://localhost:8080',
    defaultModel: 'llama-3.1-8b',
    templates,
    fetchImpl: llamacppHttp.fetch,
  });
  const anthropic = new AnthropicProvider({
    defaultModel: 'claude-opus-4-5',
    reasoningModel: 'claude-opus-4-5',
    templates,
    client: anthropicClient,
    costPerKToken: { input: 0.015, output: 0.075 },
  });
  const openai = new OpenAIProvider({
    defaultModel: 'gpt-4.1',
    reasoningModel: 'o1',
    embeddingModel: 'text-embedding-3-small',
    templates,
    client: openaiClient,
    costPerKToken: { input: 0.01, output: 0.03 },
  });

  return {
    templates,
    ollama,
    vllm,
    llamacpp,
    anthropic,
    openai,
    ollamaHttp,
    vllmHttp,
    llamacppHttp,
    anthropicClient,
    openaiClient,
  };
}

export interface OrchestratorHarness {
  templates: PromptTemplateRegistry;
  ledger: InvocationLedger;
  ledgerSink: InMemoryInvocationLedgerSink;
  consent: ConsentGuard;
  consentRepo: InMemoryConsentRepository;
  cost: CostController;
  costStore: InMemoryCostStore;
  router: TierRouter;
  orchestrator: LLMOrchestrator;
  cloud: LLMProvider;
  local: LLMProvider;
}

export interface OrchestratorOpts {
  airGap?: boolean;
}

export function buildOrchestratorHarness(
  opts: OrchestratorOpts = {},
): OrchestratorHarness {
  const built = buildAllProviders();
  const ledgerSink = new InMemoryInvocationLedgerSink();
  const ledger = new InvocationLedger(ledgerSink);
  const consentRepo = new InMemoryConsentRepository();
  const consent = new ConsentGuard({ airGap: opts.airGap ?? false, consentRepo });
  const costStore = new InMemoryCostStore();
  const cost = new CostController(costStore);
  const router = new TierRouter({
    airGap: opts.airGap ?? false,
    tierMap: {
      small: [{ provider: built.ollama }],
      medium: [{ provider: built.openai }, { provider: built.ollama, isFallback: true }],
      large: [{ provider: built.openai }, { provider: built.ollama, isFallback: true }],
      reasoning: [
        { provider: built.anthropic },
        { provider: built.ollama, isFallback: true },
      ],
    },
  });
  const orchestrator = new LLMOrchestrator({
    router,
    ledger,
    consent,
    cost,
    templates: built.templates,
  });
  return {
    templates: built.templates,
    ledger,
    ledgerSink,
    consent,
    consentRepo,
    cost,
    costStore,
    router,
    orchestrator,
    cloud: built.openai,
    local: built.ollama,
  };
}

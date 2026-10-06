/**
 * Milestone 2.10E: AI Provider Abstraction & Hardening
 * Supports configurable providers (OpenAI-compatible, Groq, local LLM)
 * and a deterministic MockAIProvider for offline testing and fallback.
 */

import { z } from "zod";
import { loadAIConfig, type AIConfig } from "./ai-config";
import { AIError } from "./ai-errors";

export interface AIProviderInput {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  correlationId?: string;
}

export interface AIProviderResponse {
  rawText: string;
  model: string;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface AIProvider {
  name: string;
  generateText(input: AIProviderInput): Promise<AIProviderResponse>;
}

// Zod schema to validate provider JSON responses safely (Phase 13)
const openAIResponseSchema = z.object({
  model: z.string().optional(),
  choices: z
    .array(
      z.object({
        message: z
          .object({
            content: z.string().nullable().optional(),
          })
          .optional(),
        text: z.string().optional(),
      })
    )
    .min(1, "No choices returned by AI provider"),
  usage: z
    .object({
      prompt_tokens: z.number().optional(),
      completion_tokens: z.number().optional(),
      total_tokens: z.number().optional(),
    })
    .optional(),
});

/**
 * OpenAI-compatible HTTP Provider using native fetch.
 * Fully hardened with Zod validation, timeouts, and error normalization.
 */
export class OpenAICompatibleProvider implements AIProvider {
  public name = "openai-compatible";
  private config: AIConfig;

  constructor(customConfig?: Partial<AIConfig>) {
    const baseConfig = loadAIConfig();
    this.config = {
      ...baseConfig,
      ...customConfig,
    };
  }

  async generateText(input: AIProviderInput): Promise<AIProviderResponse> {
    if (!this.config.enabled) {
      throw new AIError(
        "PROVIDER_NOT_CONFIGURED",
        "AI intelligence is disabled on this instance.",
        503,
        input.correlationId
      );
    }

    if (!this.config.apiKey) {
      throw new AIError(
        "PROVIDER_NOT_CONFIGURED",
        "AI provider API key is not configured.",
        503,
        input.correlationId
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const res = await fetch(this.config.baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            { role: "system", content: input.systemPrompt },
            { role: "user", content: input.userPrompt },
          ],
          temperature: input.temperature ?? this.config.temperature,
          max_tokens: input.maxTokens ?? this.config.maxTokens,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new AIError(
            "PROVIDER_AUTH_ERROR",
            "AI provider authentication failed.",
            502,
            input.correlationId
          );
        }
        if (res.status === 429) {
          throw new AIError(
            "PROVIDER_RATE_LIMITED",
            "AI provider rate limit reached.",
            429,
            input.correlationId
          );
        }
        if (res.status >= 500) {
          throw new AIError(
            "PROVIDER_UNAVAILABLE",
            "Upstream AI service is currently unavailable.",
            503,
            input.correlationId
          );
        }
        throw new AIError(
          "PROVIDER_UNAVAILABLE",
          `AI provider returned error status HTTP ${res.status}.`,
          502,
          input.correlationId
        );
      }

      let rawJson: unknown;
      try {
        rawJson = await res.json();
      } catch {
        throw new AIError(
          "INVALID_PROVIDER_RESPONSE",
          "AI provider returned invalid JSON.",
          502,
          input.correlationId
        );
      }

      const parsed = openAIResponseSchema.safeParse(rawJson);
      if (!parsed.success) {
        throw new AIError(
          "INVALID_PROVIDER_RESPONSE",
          "AI provider response structure was malformed.",
          502,
          input.correlationId
        );
      }

      const choice = parsed.data.choices[0];
      const content = choice.message?.content || choice.text || "";

      if (!content || content.trim().length === 0) {
        throw new AIError(
          "INVALID_PROVIDER_RESPONSE",
          "AI provider returned empty response content.",
          502,
          input.correlationId
        );
      }

      return {
        rawText: content,
        model: parsed.data.model || this.config.model,
        tokenUsage: parsed.data.usage
          ? {
              promptTokens: parsed.data.usage.prompt_tokens ?? 0,
              completionTokens: parsed.data.usage.completion_tokens ?? 0,
              totalTokens: parsed.data.usage.total_tokens ?? 0,
            }
          : undefined,
      };
    } catch (err) {
      if (err instanceof AIError) {
        throw err;
      }
      if (err instanceof Error && err.name === "AbortError") {
        throw new AIError(
          "PROVIDER_TIMEOUT",
          `AI request timed out after ${Math.round(this.config.timeoutMs / 1000)} seconds.`,
          504,
          input.correlationId
        );
      }
      throw new AIError(
        "PROVIDER_UNAVAILABLE",
        "Failed to communicate with AI provider.",
        503,
        input.correlationId
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * Deterministic Mock AI Provider for testing, development, and offline operation.
 * Generates structured, grounded CRM responses based on the provided prompt context.
 */
export class MockAIProvider implements AIProvider {
  public name = "mock-provider";
  private mockModel = "mock-crm-intelligence-v1";

  // Optional custom responder for unit tests to simulate errors or custom payloads
  private customResponder?: (input: AIProviderInput) => Promise<AIProviderResponse>;

  constructor(customResponder?: (input: AIProviderInput) => Promise<AIProviderResponse>) {
    this.customResponder = customResponder;
  }

  setCustomResponder(responder?: (input: AIProviderInput) => Promise<AIProviderResponse>) {
    this.customResponder = responder;
  }

  async generateText(input: AIProviderInput): Promise<AIProviderResponse> {
    if (this.customResponder) {
      return this.customResponder(input);
    }

    const promptText = input.userPrompt;
    const lowerPrompt = promptText.toLowerCase();

    // 1. Briefing request
    if (lowerPrompt.includes("daily_briefing") || lowerPrompt.includes("daily briefing")) {
      return {
        rawText: JSON.stringify({
          summary:
            "CRM operational status evaluated. Critical attention required for overdue follow-ups and unassigned workload.",
          priorities: [
            {
              rank: 1,
              title: "Address Overdue Follow-ups",
              category: "follow_ups",
              explanation:
                "Action is needed on pending client tasks that have passed their scheduled due dates.",
              evidence: ["Overdue follow-ups detected in organization attention items"],
            },
            {
              rank: 2,
              title: "Assign Unowned Workload",
              category: "workload",
              explanation:
                "Unassigned leads or deals are awaiting team allocation to prevent conversion drop-off.",
              evidence: ["Unassigned workload identified in team intelligence"],
            },
            {
              rank: 3,
              title: "Review Pipeline Bottlenecks",
              category: "pipeline",
              explanation:
                "Stage concentration detected in open deals requiring progression review.",
              evidence: ["Pipeline stage bottleneck indicators"],
            },
          ],
          risks: [
            {
              id: "risk_overdue_tasks",
              title: "Client engagement delay from overdue follow-ups",
              severity: "high",
              explanation:
                "Follow-ups past due date risk reducing customer engagement velocity.",
              evidence: ["Overdue follow-ups present"],
              recommendedAction: "Review and reschedule or complete overdue follow-ups.",
            },
          ],
          recommendedActions: [
            {
              id: "act_review_follow_ups",
              title: "Review overdue follow-ups",
              reason: "Ensure prospective deals and leads receive timely communication.",
              priority: "high",
              confidence: "high",
              evidence: ["Pending follow-ups overdue"],
            },
            {
              id: "act_allocate_workload",
              title: "Allocate unassigned records",
              reason: "Distribute open leads to available team owners.",
              priority: "medium",
              confidence: "high",
              evidence: ["Unassigned workload in organization"],
            },
          ],
          limitations: [
            "Analysis grounded purely in existing deterministic CRM database metrics.",
          ],
        }),
        model: this.mockModel,
        tokenUsage: { promptTokens: 350, completionTokens: 420, totalTokens: 770 },
      };
    }

    // 2. Metric explanation request
    if (promptText.includes('"intent": "explain_metric"') || promptText.includes("Explain why")) {
      return {
        rawText: JSON.stringify({
          metric: "conversion_rate",
          fact: "Calculated conversion metrics show current stage transition rates across the funnel.",
          interpretation:
            "The highest drop-off rate occurs between qualification and deal conversion.",
          contributingFactors: [
            "Overdue follow-ups on qualified leads",
            "Unassigned prospect distribution",
            "Stalled pipeline stage progression",
          ],
          recommendations: [
            "Establish automated next actions for newly qualified leads.",
            "Balance workload across available sales team members.",
          ],
          limitations: ["Based strictly on recorded CRM activities and pipeline transitions."],
          confidence: "high",
        }),
        model: this.mockModel,
        tokenUsage: { promptTokens: 280, completionTokens: 260, totalTokens: 540 },
      };
    }

    // 3. Question answering request
    return {
      rawText: JSON.stringify({
        question: "CRM query",
        answer:
          "Based on current CRM data, operational metrics reflect active organization pipelines and attention signals.",
        groundedFacts: [
          "Operational metrics are deterministically calculated from CRM tables.",
        ],
        interpretation:
          "Pipeline activity shows steady movement with specific attention items flagged.",
        recommendedActions: [
          "Address highest severity attention items flagged on the dashboard.",
        ],
        evidence: ["Verified against organization health and pipeline state."],
        limitations: ["No external or unrecorded factors are factored in."],
        confidence: "high",
      }),
      model: this.mockModel,
      tokenUsage: { promptTokens: 220, completionTokens: 210, totalTokens: 430 },
    };
  }
}

// Global / singleton provider instance
let _activeProvider: AIProvider | null = null;

/**
 * Returns the currently active AI provider based on validated configuration.
 */
export function getAIProvider(): AIProvider {
  if (_activeProvider) {
    return _activeProvider;
  }

  const config = loadAIConfig();
  if (config.providerType === "openai-compatible" && config.apiKey) {
    _activeProvider = new OpenAICompatibleProvider(config);
  } else {
    _activeProvider = new MockAIProvider();
  }

  return _activeProvider;
}

/**
 * Allows switching the AI provider (e.g. for unit tests or custom integrations).
 */
export function setAIProvider(provider: AIProvider | null): void {
  _activeProvider = provider;
}

/**
 * Checks if a live AI provider API key is configured.
 */
export function isLiveAIConfigured(): boolean {
  const config = loadAIConfig();
  return Boolean(config.apiKey && config.apiKey.trim() !== "");
}

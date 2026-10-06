import {
  type CRMIntelligenceContext,
  type EntityIntelligenceContext,
} from "./ai-types";
import { AI_SYSTEM_SAFETY_PROMPT, sanitizeCrmText } from "./ai-safety";

/**
 * Builds the system prompt ensuring strict adherence to CRM grounding and safety rules.
 */
export function getSystemPrompt(): string {
  return AI_SYSTEM_SAFETY_PROMPT;
}

/**
 * Assembles a structured JSON prompt for the AI Daily Briefing.
 */
export function buildBriefingPrompt(context: CRMIntelligenceContext): {
  systemPrompt: string;
  userPrompt: string;
} {
  const contextSummary = {
    organization: context.organizationSummary.name,
    dateRange: context.dateRange,
    attentionOverview: context.healthSummary,
    topAttentionItems: context.attentionItems.slice(0, 10).map((item) => ({
      id: item.id,
      entityType: item.entityType,
      entityName: sanitizeCrmText(item.entityName, 80),
      signalType: item.signalType,
      severity: item.severity,
      description: sanitizeCrmText(item.description, 200),
      recommendedAction: sanitizeCrmText(item.recommendedAction, 200),
      value: item.value,
      currency: item.currency,
      stageName: item.stageName,
      ownerName: item.ownerName,
    })),
    leadFunnel: context.funnel,
    leadSources: context.leadSources.slice(0, 5),
    pipelines: context.pipelines.map((p) => ({
      pipelineName: p.pipelineName,
      openDealCount: p.openDealCount,
      openValueByCurrency: p.openValueByCurrency,
      wonDealCount: p.wonDealCount,
      stages: p.stages.map((s) => ({
        stageName: s.stageName,
        openDealCount: s.openDealCount,
        openValueByCurrency: s.openValueByCurrency,
      })),
    })),
    bottlenecks: context.bottlenecks.map((b) => ({
      pipelineName: b.pipelineName,
      stageName: b.stageName,
      openDealCount: b.openDealCount,
      openValueByCurrency: b.openValueByCurrency,
      staleDealCount: b.staleDealCount,
      reason: b.reason,
      recommendation: b.recommendation,
    })),
    workload: {
      unassigned: context.unassignedWorkload,
      concentration: context.workloadIndicators,
      ownersCount: context.owners.length,
    },
    periodComparison: context.periodComparison,
    automations: context.automationsSummary,
  };

  const userPrompt = `
You are asked to generate an "AI Daily Briefing" for the CRM organization.
Analyze the structured CRM data below.

<crm_context>
${JSON.stringify(contextSummary, null, 2)}
</crm_context>

Instructions:
1. Intent: "daily_briefing"
2. Synthesize:
   - High-priority risks and overdue follow-ups
   - Stalled deals and pipeline bottlenecks
   - Unassigned leads/deals
   - Workload concentration or period trends
3. Ground all numbers directly in the context. Never invent values.
4. Output MUST be a valid JSON object matching this schema:
{
  "summary": "1-3 sentence executive operational summary",
  "priorities": [
    {
      "rank": 1,
      "title": "Short title",
      "category": "follow_ups|pipeline|workload|conversion|stale",
      "explanation": "Clear explanation citing CRM numbers",
      "evidence": ["Evidence string 1", "Evidence string 2"]
    }
  ],
  "risks": [
    {
      "id": "risk_unique_id",
      "title": "Risk title",
      "severity": "low|medium|high|critical",
      "explanation": "Why this is a risk based on CRM data",
      "evidence": ["Evidence string"],
      "recommendedAction": "Actionable next step"
    }
  ],
  "recommendedActions": [
    {
      "id": "action_id",
      "title": "Action title",
      "reason": "Why this action is recommended",
      "entityType": "lead|deal|pipeline|owner|team|follow_up",
      "priority": "high|medium|low",
      "confidence": "high|medium|low",
      "evidence": ["Evidence string"]
    }
  ],
  "limitations": [
    "Grounding statement citing that data reflects recorded CRM records."
  ]
}
Return only JSON. Do not wrap in markdown or backticks.`;

  return {
    systemPrompt: getSystemPrompt(),
    userPrompt: userPrompt.trim(),
  };
}

/**
 * Assembles a structured prompt for explaining a specific metric.
 */
export function buildMetricExplanationPrompt(
  context: CRMIntelligenceContext,
  metricKey: string,
  entityContext?: EntityIntelligenceContext
): {
  systemPrompt: string;
  userPrompt: string;
} {
  const userPrompt = `
Intent: "explain_metric"
Requested Metric to Explain: "${sanitizeCrmText(metricKey, 100)}"

<crm_context>
${JSON.stringify(
  {
    organization: context.organizationSummary.name,
    dateRange: context.dateRange,
    leadFunnel: context.funnel,
    leadSources: context.leadSources,
    pipelines: context.pipelines,
    bottlenecks: context.bottlenecks,
    attentionOverview: context.healthSummary,
    periodComparison: context.periodComparison,
    entityContext: entityContext || null,
  },
  null,
  2
)}
</crm_context>

Instructions:
1. Explain the metric thoroughly based solely on the provided CRM data.
2. Distinguish:
   - FACT: Authoritative metric value(s) from deterministic CRM calculations.
   - INTERPRETATION: Logical deduction (e.g. drop-off stage, bottleneck location).
   - RECOMMENDATION: Concrete operational steps for sales/ops users.
3. If data is insufficient to explain the metric, state "I don't have enough CRM data to determine that."
4. Output MUST be valid JSON:
{
  "metric": "${sanitizeCrmText(metricKey, 50)}",
  "fact": "Authoritative verified metric statement",
  "interpretation": "Objective operational interpretation",
  "contributingFactors": ["Factor 1", "Factor 2"],
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "limitations": ["Data boundary statement"],
  "confidence": "high|medium|low"
}
Return only JSON. Do not wrap in markdown or backticks.`;

  return {
    systemPrompt: getSystemPrompt(),
    userPrompt: userPrompt.trim(),
  };
}

/**
 * Assembles a structured prompt for answering ad-hoc natural language CRM questions.
 */
export function buildQuestionPrompt(
  context: CRMIntelligenceContext,
  question: string,
  entityContext?: EntityIntelligenceContext
): {
  systemPrompt: string;
  userPrompt: string;
} {
  const userPrompt = `
Intent: "crm_qa"
User Question: "${sanitizeCrmText(question, 500)}"

<crm_context>
${JSON.stringify(
  {
    organization: context.organizationSummary.name,
    dateRange: context.dateRange,
    attentionOverview: context.healthSummary,
    attentionItems: context.attentionItems.slice(0, 15).map((i) => ({
      id: i.id,
      entityType: i.entityType,
      entityName: sanitizeCrmText(i.entityName, 80),
      signalType: i.signalType,
      severity: i.severity,
      description: sanitizeCrmText(i.description, 200),
      value: i.value,
      currency: i.currency,
      recommendedAction: sanitizeCrmText(i.recommendedAction, 200),
    })),
    leadFunnel: context.funnel,
    leadSources: context.leadSources.slice(0, 5),
    pipelines: context.pipelines,
    bottlenecks: context.bottlenecks,
    owners: context.owners.map((o) => ({
      name: o.name,
      leads: o.leads,
      deals: o.deals,
      followUps: o.followUps,
      activities: o.activities,
    })),
    unassignedWorkload: context.unassignedWorkload,
    periodComparison: context.periodComparison,
    entityContext: entityContext
      ? {
          entityType: entityContext.entityType,
          entityId: entityContext.entityId,
          entityName: sanitizeCrmText(entityContext.entityName, 100),
          details: entityContext.details,
          health: entityContext.health,
          signals: entityContext.signals,
        }
      : null,
  },
  null,
  2
)}
</crm_context>

Instructions:
1. Answer the user question concisely and accurately using ONLY the information in <crm_context>.
2. If the user question cannot be answered from the CRM data provided, state: "I don't have enough CRM data to determine that."
3. Never invent metrics, revenue, or customer data.
4. Distinguish between FACT and INTERPRETATION.
5. Output MUST be valid JSON:
{
  "question": "${sanitizeCrmText(question, 200).replace(/"/g, '\\"')}",
  "answer": "Direct, business-focused answer",
  "groundedFacts": ["Fact 1", "Fact 2"],
  "interpretation": "Contextual operational interpretation",
  "recommendedActions": ["Recommended next step if applicable"],
  "evidence": ["Evidence 1", "Evidence 2"],
  "limitations": ["Data boundary note"],
  "confidence": "high|medium|low"
}
Return only JSON. Do not wrap in markdown or backticks.`;

  return {
    systemPrompt: getSystemPrompt(),
    userPrompt: userPrompt.trim(),
  };
}

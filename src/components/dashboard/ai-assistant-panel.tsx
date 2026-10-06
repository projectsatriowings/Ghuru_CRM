"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { type AIQuestionResult } from "@/lib/types/ai";
import {
  MessageSquare,
  Send,
  Sparkles,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  Lightbulb,
} from "lucide-react";

const SUGGESTED_QUESTIONS = [
  "What needs attention today?",
  "Which pipeline is performing best?",
  "Which source generated the most converted leads?",
  "Which deals have been inactive the longest?",
  "Who has the largest open pipeline?",
  "How many unassigned leads do we have?",
];

export function AIAssistantPanel() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<AIQuestionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAsk = async (queryToAsk?: string) => {
    const q = (queryToAsk || question).trim();
    if (!q) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/intelligence/ai/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to process your question.");
      }

      setResult(json.data);
      if (queryToAsk) {
        setQuestion(queryToAsk);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "AI Assistant is temporarily unavailable. Your CRM data remains fully operational."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-indigo-100 shadow-xs">
      <CardHeader className="pb-3 border-b border-indigo-50/60 bg-gradient-to-r from-indigo-50/30 to-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-indigo-600 text-white">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold text-slate-900">
                CRM Intelligence Assistant
              </CardTitle>
              <p className="text-[11px] text-slate-500">
                Ask operational questions grounded in verified CRM metrics
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] border-indigo-200 text-indigo-700 bg-white">
            Grounded Q&A
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Suggested Queries Chips */}
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-slate-500">Suggested Queries:</p>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_QUESTIONS.map((sq, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleAsk(sq)}
                disabled={isLoading}
                className="text-[11px] px-2.5 py-1 rounded-full bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 transition-colors border border-slate-200/60 cursor-pointer disabled:opacity-50"
              >
                {sq}
              </button>
            ))}
          </div>
        </div>

        {/* Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAsk();
          }}
          className="flex items-center gap-2"
        >
          <div className="relative flex-1">
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask about leads, deals, pipelines, or bottlenecks..."
              maxLength={500}
              disabled={isLoading}
              className="text-xs pr-12 focus-visible:ring-indigo-500"
            />
            <span className="absolute right-2.5 top-2.5 text-[10px] text-slate-400">
              {question.length}/500
            </span>
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={isLoading || !question.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3"
          >
            {isLoading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </Button>
        </form>

        {/* Error Notice */}
        {error && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Assistant Notice</p>
              <p className="text-amber-700 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-500 animate-pulse">
            <Sparkles className="w-4 h-4 text-indigo-600 animate-spin" />
            Analyzing deterministic CRM records...
          </div>
        )}

        {/* Structured Result Display */}
        {result && !isLoading && (
          <div className="p-4 rounded-lg border border-indigo-100 bg-slate-50/50 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                Q: {result.question}
              </span>
              <Badge variant="outline" className="text-[10px] border-indigo-200 text-indigo-700 bg-white">
                {result.confidence} confidence
              </Badge>
            </div>

            {/* Answer Body */}
            <p className="text-xs text-slate-700 leading-relaxed bg-white p-3 rounded border border-slate-200">
              {result.answer}
            </p>

            {/* Grounded Facts */}
            {result.groundedFacts?.length > 0 && (
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Verified CRM Facts
                </span>
                <ul className="text-xs text-slate-600 space-y-1">
                  {result.groundedFacts.map((fact, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-emerald-500 font-bold">•</span>
                      <span>{fact}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendations */}
            {result.recommendedActions?.length > 0 && (
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Lightbulb className="w-3 h-3 text-amber-500" />
                  Recommended Operational Next Steps
                </span>
                <ul className="text-xs text-slate-600 space-y-1">
                  {result.recommendedActions.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-indigo-500 font-bold">→</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Limitations Footer */}
            <div className="pt-2 border-t border-slate-200/60 flex items-center gap-1.5 text-[10px] text-slate-400">
              <ShieldCheck className="w-3 h-3 text-slate-400" />
              <span>
                {result.limitations?.[0] ||
                  "Response derived strictly from deterministic CRM intelligence services."}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

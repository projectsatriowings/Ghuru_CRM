"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Sliders, Loader2, CheckCircle2, AlertTriangle, Info } from "lucide-react";

interface AILimitsFormProps {
  initialSettings: {
    organizationId: string;
    aiEnabled: boolean;
    dailyRequestLimit: number;
    monthlyRequestLimit: number;
  };
  canManage: boolean;
  onSettingsUpdated?: (updated: {
    aiEnabled: boolean;
    dailyRequestLimit: number;
    monthlyRequestLimit: number;
  }) => void;
}

export function AILimitsForm({
  initialSettings,
  canManage,
  onSettingsUpdated,
}: AILimitsFormProps) {
  const [aiEnabled, setAiEnabled] = useState(initialSettings.aiEnabled);
  const [dailyLimit, setDailyLimit] = useState(initialSettings.dailyRequestLimit.toString());
  const [monthlyLimit, setMonthlyLimit] = useState(initialSettings.monthlyRequestLimit.toString());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage) return;

    setError(null);
    setSuccess(null);

    const parsedDaily = parseInt(dailyLimit, 10);
    const parsedMonthly = parseInt(monthlyLimit, 10);

    if (isNaN(parsedDaily) || parsedDaily < 1 || parsedDaily > 100000) {
      setError("Daily request limit must be a positive integer between 1 and 100,000.");
      return;
    }

    if (isNaN(parsedMonthly) || parsedMonthly < 1 || parsedMonthly > 1000000) {
      setError("Monthly request limit must be a positive integer between 1 and 1,000,000.");
      return;
    }

    if (parsedDaily > parsedMonthly) {
      setError("Daily request limit cannot exceed monthly request limit.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/v1/intelligence/ai/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          aiEnabled,
          dailyRequestLimit: parsedDaily,
          monthlyRequestLimit: parsedMonthly,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data?.error?.message || "Failed to update AI limits.");
        setLoading(false);
        return;
      }

      setSuccess("AI governance limits and operational policy updated successfully.");
      if (onSettingsUpdated) {
        onSettingsUpdated({
          aiEnabled,
          dailyRequestLimit: parsedDaily,
          monthlyRequestLimit: parsedMonthly,
        });
      }
    } catch {
      setError("A network error occurred while updating settings. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-slate-200 shadow-xs">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <Sliders className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold text-slate-900">
              Organization AI Quotas & Policy Control
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Configure request thresholds and AI enablement for your workspace
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-1">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-800 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-800 flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* AI Enable/Disable Toggle */}
          <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-lg border border-slate-100">
            <div className="space-y-0.5 pr-4">
              <Label className="text-sm font-semibold text-slate-900 cursor-pointer">
                AI Advisory Intelligence
              </Label>
              <p className="text-xs text-slate-500">
                Enable or disable AI briefings, next actions, and CRM question assistance for this organization.
              </p>
            </div>
            <Switch
              checked={aiEnabled}
              onCheckedChange={setAiEnabled}
              disabled={!canManage || loading}
            />
          </div>

          {!aiEnabled && (
            <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-md text-xs text-amber-900 flex items-start gap-2">
              <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Safe Disablement:</strong> When AI is turned off, AI advisory endpoints return a safe policy rejection message. Standard CRM pipelines, activities, leads, deals, contacts, companies, and deterministic operational analytics remain completely unaffected.
              </span>
            </div>
          )}

          {/* Quota Limits */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="dailyLimit" className="text-xs font-semibold text-slate-700">
                Daily Request Limit
              </Label>
              <Input
                id="dailyLimit"
                type="number"
                min="1"
                max="100000"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(e.target.value)}
                disabled={!canManage || loading}
                className="text-xs"
              />
              <p className="text-[11px] text-slate-500">
                Maximum allowed requests per 24-hour UTC window.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="monthlyLimit" className="text-xs font-semibold text-slate-700">
                Monthly Request Limit
              </Label>
              <Input
                id="monthlyLimit"
                type="number"
                min="1"
                max="1000000"
                value={monthlyLimit}
                onChange={(e) => setMonthlyLimit(e.target.value)}
                disabled={!canManage || loading}
                className="text-xs"
              />
              <p className="text-[11px] text-slate-500">
                Maximum allowed requests per calendar month.
              </p>
            </div>
          </div>

          {canManage ? (
            <div className="flex items-center justify-end pt-2">
              <Button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Saving Changes...
                  </>
                ) : (
                  "Save Quota Settings"
                )}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">
              Viewing in read-only mode. Requires [ai_governance.manage] permission to modify organization AI quotas.
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

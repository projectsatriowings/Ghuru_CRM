"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type AutomationWithRelations,
  type AutomationExecutionWithRelations,
} from "@/lib/types/automations";
import {
  AutomationStatusBadge,
  ExecutionStatusBadge,
} from "./automation-status-badge";
import { ArchiveAutomationDialog } from "./archive-automation-dialog";
import { toggleAutomationActiveAction } from "@/lib/actions/automation.actions";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Edit2,
  Archive,
  RotateCcw,
  Zap,
  Briefcase,
  UserPlus,
  Contact,
  Building,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Activity,
} from "lucide-react";
import { TRIGGER_REGISTRY } from "@/lib/automation/trigger-registry";

interface AutomationDetailViewProps {
  automation: AutomationWithRelations;
  executions: AutomationExecutionWithRelations[];
  canUpdate: boolean;
  canDelete: boolean;
}

export function AutomationDetailView({
  automation,
  executions,
  canUpdate,
  canDelete,
}: AutomationDetailViewProps) {
  const router = useRouter();
  const [toggling, setToggling] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"archive" | "restore">("archive");
  const [expandedExecId, setExpandedExecId] = useState<string | null>(null);

  const triggerDef =
    TRIGGER_REGISTRY[automation.triggerType] || {
      label: automation.triggerType,
      description: "",
    };

  async function handleToggleActive() {
    if (!canUpdate || toggling || automation.archivedAt) return;
    setToggling(true);
    try {
      await toggleAutomationActiveAction(automation.id, !automation.active);
      router.refresh();
    } finally {
      setToggling(false);
    }
  }

  function renderEntityBadge() {
    switch (automation.entityType) {
      case "deal":
        return (
          <Badge
            variant="outline"
            className="bg-indigo-50 text-indigo-700 border-indigo-200 gap-1 font-medium text-xs"
          >
            <Briefcase className="h-3 w-3" />
            Deal
          </Badge>
        );
      case "lead":
        return (
          <Badge
            variant="outline"
            className="bg-blue-50 text-blue-700 border-blue-200 gap-1 font-medium text-xs"
          >
            <UserPlus className="h-3 w-3" />
            Lead
          </Badge>
        );
      case "contact":
        return (
          <Badge
            variant="outline"
            className="bg-teal-50 text-teal-700 border-teal-200 gap-1 font-medium text-xs"
          >
            <Contact className="h-3 w-3" />
            Contact
          </Badge>
        );
      case "company":
        return (
          <Badge
            variant="outline"
            className="bg-purple-50 text-purple-700 border-purple-200 gap-1 font-medium text-xs"
          >
            <Building className="h-3 w-3" />
            Company
          </Badge>
        );
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Breadcrumb & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <Link href="/automations">
            <Button variant="ghost" size="sm" className="gap-1 px-2.5">
              <ArrowLeft className="h-4 w-4" />
              Automations
            </Button>
          </Link>

          <div className="space-y-0.5">
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                {automation.name}
              </h1>
              <AutomationStatusBadge
                active={automation.active}
                archivedAt={automation.archivedAt}
              />
            </div>
            {automation.description && (
              <p className="text-xs text-slate-500">{automation.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-center">
          {canUpdate && !automation.archivedAt && (
            <div className="flex items-center gap-2 mr-2">
              <Switch
                checked={automation.active}
                onCheckedChange={handleToggleActive}
                disabled={toggling}
                id="active-toggle"
              />
              <label
                htmlFor="active-toggle"
                className="text-xs text-slate-600 font-medium cursor-pointer"
              >
                {automation.active ? "Active" : "Paused"}
              </label>
            </div>
          )}

          {canUpdate && !automation.archivedAt && (
            <Link href={`/automations/${automation.id}/edit`}>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <Edit2 className="h-3.5 w-3.5" />
                Edit
              </Button>
            </Link>
          )}

          {automation.archivedAt ? (
            canUpdate && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDialogMode("restore");
                  setDialogOpen(true);
                }}
                className="gap-1.5 text-xs text-blue-600 hover:text-blue-700"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Restore
              </Button>
            )
          ) : (
            canDelete && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDialogMode("archive");
                  setDialogOpen(true);
                }}
                className="gap-1.5 text-xs text-rose-600 hover:text-rose-700"
              >
                <Archive className="h-3.5 w-3.5" />
                Archive
              </Button>
            )
          )}
        </div>
      </div>

      {/* STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Total Executions
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {automation.executionStats?.total || 0}
          </p>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Target Entity
          </p>
          <div className="mt-1.5">{renderEntityBadge()}</div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Trigger Event
          </p>
          <p className="text-sm font-semibold text-slate-800 mt-1">
            {triggerDef.label}
          </p>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Last Execution
          </p>
          <div className="mt-1">
            {automation.executionStats?.lastExecutedAt ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-slate-700">
                  {new Date(
                    automation.executionStats.lastExecutedAt
                  ).toLocaleDateString()}
                </span>
                {automation.executionStats.lastStatus && (
                  <ExecutionStatusBadge
                    status={automation.executionStats.lastStatus}
                  />
                )}
              </div>
            ) : (
              <span className="text-xs text-slate-400">Never executed</span>
            )}
          </div>
        </div>
      </div>

      {/* WORKFLOW RULE DEFINITION VISUAL BREAKDOWN */}
      <Card className="shadow-xs border-slate-200 overflow-hidden">
        <CardHeader className="py-3 px-6 border-b border-slate-100 bg-slate-50/75">
          <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Zap className="h-4 w-4 text-blue-600" />
            Workflow Rule Specification
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* WHEN */}
          <div className="flex items-start gap-4">
            <div className="w-16 shrink-0 pt-0.5">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800 uppercase tracking-wider">
                WHEN
              </span>
            </div>
            <div className="flex-1 bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs">
              <p className="font-semibold text-slate-800">
                {triggerDef.label} on {automation.entityType.toUpperCase()}
              </p>
              <p className="text-slate-500 text-[11px] mt-0.5">
                {triggerDef.description}
              </p>
            </div>
          </div>

          {/* IF */}
          <div className="flex items-start gap-4">
            <div className="w-16 shrink-0 pt-0.5">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 uppercase tracking-wider">
                IF
              </span>
            </div>
            <div className="flex-1 space-y-2">
              {automation.conditions.length === 0 ? (
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs text-slate-500 italic">
                  Always passes (no condition filters defined)
                </div>
              ) : (
                automation.conditions.map((group, gIdx) => (
                  <div
                    key={gIdx}
                    className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5"
                  >
                    {gIdx > 0 && (
                      <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block mb-1">
                        OR Group #{gIdx + 1}
                      </span>
                    )}
                    {group.conditions.map((cond, cIdx) => (
                      <div
                        key={cIdx}
                        className="flex items-center gap-2 text-xs text-slate-700 bg-white px-2.5 py-1.5 rounded border border-slate-200/80 font-mono"
                      >
                        <span className="font-semibold text-blue-700">
                          {cond.field}
                        </span>
                        <span className="text-slate-500">{cond.operator}</span>
                        {cond.operator !== "is_empty" &&
                          cond.operator !== "is_not_empty" && (
                            <span className="font-medium text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                              {String(cond.value)}
                            </span>
                          )}
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* THEN */}
          <div className="flex items-start gap-4">
            <div className="w-16 shrink-0 pt-0.5">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                THEN
              </span>
            </div>
            <div className="flex-1 space-y-2">
              {automation.actions.map((act, actIdx) => (
                <div
                  key={actIdx}
                  className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs text-slate-700 flex items-start gap-3"
                >
                  <div className="p-1 rounded bg-emerald-100 text-emerald-700 mt-0.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-semibold text-slate-900">
                      {act.type.replace(/_/g, " ").toUpperCase()}
                    </p>
                    <div className="text-[11px] text-slate-600 flex flex-wrap gap-x-3 gap-y-1">
                      {Object.entries(act.params).map(([key, val]) => (
                        <span key={key}>
                          <span className="text-slate-400">{key}:</span>{" "}
                          <strong>{String(val)}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* EXECUTION HISTORY SECTION */}
      <Card className="shadow-xs border-slate-200 overflow-hidden">
        <CardHeader className="py-3 px-6 border-b border-slate-100 bg-slate-50/75 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Activity className="h-4 w-4 text-slate-600" />
            Execution History
          </CardTitle>
          <span className="text-xs text-slate-500">
            {executions.length} recent run{executions.length === 1 ? "" : "s"}
          </span>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead className="text-xs font-semibold text-slate-700">
                  Status
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-700">
                  Trigger Event
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-700">
                  Target Entity
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-700">
                  Executed At
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-700">
                  Duration / Error
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {executions.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-28 text-center text-xs text-slate-400"
                  >
                    No execution events recorded yet. When matching domain
                    changes occur, executions will be logged here.
                  </TableCell>
                </TableRow>
              ) : (
                executions.map((exec) => {
                  const isExpanded = expandedExecId === exec.id;

                  return (
                    <>
                      <TableRow
                        key={exec.id}
                        className="cursor-pointer hover:bg-slate-50/60 transition-colors"
                        onClick={() =>
                          setExpandedExecId(isExpanded ? null : exec.id)
                        }
                      >
                        <TableCell className="text-slate-400">
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                        </TableCell>
                        <TableCell>
                          <ExecutionStatusBadge status={exec.status} />
                        </TableCell>
                        <TableCell className="text-xs font-medium text-slate-800">
                          {exec.eventType}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 font-mono">
                          {exec.entityType}:{exec.entityId.slice(0, 8)}...
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">
                          {new Date(exec.startedAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs">
                          {exec.errorMessage ? (
                            <span className="text-rose-600 font-medium line-clamp-1">
                              {exec.errorMessage}
                            </span>
                          ) : exec.metadata?.skippedReason ? (
                            <span className="text-slate-500 italic">
                              {String(exec.metadata.skippedReason)}
                            </span>
                          ) : (
                            <span className="text-emerald-600">Success</span>
                          )}
                        </TableCell>
                      </TableRow>

                      {isExpanded && (
                        <TableRow className="bg-slate-50/75 border-b border-slate-200">
                          <TableCell colSpan={6} className="p-4 space-y-3">
                            <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs space-y-2">
                              <p className="font-semibold text-slate-800 border-b pb-1 text-xs">
                                Execution Diagnostics & Trace
                              </p>

                              {exec.metadata?.correlationId && (
                                <p className="text-[11px] text-slate-500 font-mono">
                                  Correlation ID:{" "}
                                  <strong>
                                    {String(exec.metadata.correlationId)}
                                  </strong>
                                </p>
                              )}

                              {/* Conditions Evaluation breakdown */}
                              {exec.metadata?.conditionResults && (
                                <div className="space-y-1">
                                  <p className="font-medium text-[11px] text-slate-700">
                                    Condition Evaluation:
                                  </p>
                                  {(
                                    exec.metadata
                                      .conditionResults as Array<{
                                      groupIndex: number;
                                      passed: boolean;
                                      results: Array<{
                                        field: string;
                                        operator: string;
                                        expected: unknown;
                                        actual: unknown;
                                        matched: boolean;
                                      }>;
                                    }>
                                  ).map((group, gi) => (
                                    <div
                                      key={gi}
                                      className="p-2 bg-slate-50 rounded text-[11px] space-y-1"
                                    >
                                      <span className="font-semibold text-slate-600">
                                        Group #{gi + 1}:{" "}
                                        {group.passed ? "Passed" : "Failed"}
                                      </span>
                                      {group.results.map((r, ri) => (
                                        <div
                                          key={ri}
                                          className="flex items-center gap-2 pl-2"
                                        >
                                          {r.matched ? (
                                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                          ) : (
                                            <XCircle className="h-3 w-3 text-rose-500" />
                                          )}
                                          <span>
                                            {r.field} {r.operator}{" "}
                                            <strong>{String(r.expected)}</strong>{" "}
                                            (actual:{" "}
                                            <em>{String(r.actual)}</em>)
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Actions Execution breakdown */}
                              {exec.metadata?.actionsExecuted && (
                                <div className="space-y-1 pt-1">
                                  <p className="font-medium text-[11px] text-slate-700">
                                    Actions Executed:
                                  </p>
                                  {(
                                    exec.metadata.actionsExecuted as Array<{
                                      type: string;
                                      status: string;
                                      output?: unknown;
                                      error?: string;
                                    }>
                                  ).map((a, ai) => (
                                    <div
                                      key={ai}
                                      className="p-2 bg-slate-50 rounded text-[11px] flex items-center justify-between"
                                    >
                                      <div className="flex items-center gap-2">
                                        {a.status === "success" ? (
                                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                        ) : (
                                          <XCircle className="h-3.5 w-3.5 text-rose-600" />
                                        )}
                                        <span className="font-medium text-slate-800">
                                          {a.type}
                                        </span>
                                      </div>
                                      {a.error && (
                                        <span className="text-rose-600 text-[10px]">
                                          {a.error}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ArchiveAutomationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        automation={automation}
        mode={dialogMode}
      />
    </div>
  );
}

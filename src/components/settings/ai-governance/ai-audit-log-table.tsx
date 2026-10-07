"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AIAuditDetailDialog } from "./ai-audit-detail-dialog";
import { AIAuditLogItem, PaginatedAIAuditLogs } from "@/lib/types/ai-governance";
import { ShieldCheck, CheckCircle2, XCircle, ChevronLeft, ChevronRight, Loader2, Filter, RotateCcw } from "lucide-react";

interface AIAuditLogTableProps {
  initialData?: PaginatedAIAuditLogs;
}

export function AIAuditLogTable({ initialData }: AIAuditLogTableProps) {
  const [data, setData] = useState<PaginatedAIAuditLogs>(
    initialData || {
      items: [],
      pagination: { page: 1, pageSize: 25, totalCount: 0, totalPages: 1 },
    }
  );
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(initialData?.pagination.page || 1);
  const pageSize = initialData?.pagination.pageSize || 25;
  const [endpoint, setEndpoint] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [selectedEvent, setSelectedEvent] = useState<AIAuditLogItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchAuditLogs = useCallback(
    async (targetPage: number, targetEndpoint = endpoint, targetStatus = status) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("page", targetPage.toString());
        params.set("pageSize", pageSize.toString());
        if (targetEndpoint !== "all") params.set("endpoint", targetEndpoint);
        if (targetStatus !== "all") params.set("status", targetStatus);

        const res = await fetch(`/api/v1/intelligence/ai/audit?${params.toString()}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            setData(json.data);
            setPage(targetPage);
          }
        }
      } catch (err) {
        console.warn("[AIAuditLogTable] Fetch failed:", err);
      } finally {
        setLoading(false);
      }
    },
    [endpoint, status, pageSize]
  );

  const handleRowClick = (event: AIAuditLogItem) => {
    setSelectedEvent(event);
    setDialogOpen(true);
  };

  const handleEndpointChange = (val: string | null) => {
    const next = val || "all";
    setEndpoint(next);
    fetchAuditLogs(1, next, status);
  };

  const handleStatusChange = (val: string | null) => {
    const next = val || "all";
    setStatus(next);
    fetchAuditLogs(1, endpoint, next);
  };

  const handleResetFilters = () => {
    setEndpoint("all");
    setStatus("all");
    fetchAuditLogs(1, "all", "all");
  };

  return (
    <Card className="border-slate-200 shadow-xs">
      <CardHeader className="pb-3 border-b border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold text-slate-900">
              AI Operational Audit Trail
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Durable metadata log of all AI requests with server-side tenant isolation
            </CardDescription>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              <span>Filters:</span>
            </div>

            <Select value={endpoint} onValueChange={handleEndpointChange}>
              <SelectTrigger className="h-8 text-xs w-[130px]">
                <SelectValue placeholder="Endpoint" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Endpoints</SelectItem>
                <SelectItem value="briefing">Briefing</SelectItem>
                <SelectItem value="next-actions">Next Actions</SelectItem>
                <SelectItem value="explain">Explain</SelectItem>
                <SelectItem value="ask">Ask</SelectItem>
              </SelectContent>
            </Select>

            <Select value={status} onValueChange={handleStatusChange}>
              <SelectTrigger className="h-8 text-xs w-[120px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failure">Failure</SelectItem>
              </SelectContent>
            </Select>

            {(endpoint !== "all" || status !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="h-8 text-xs px-2 text-slate-600 hover:text-slate-900"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Reset
              </Button>
            )}
          </div>
        </div>

        {/* Safe Metadata Disclosure Banner */}
        <div className="mt-2.5 flex items-center gap-2 p-2 bg-slate-50 rounded-md border border-slate-100 text-[11px] text-slate-600">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
          <span>
            <strong>Safe Metadata Standard:</strong> This log captures operational telemetry only (latency, tokens, status, model). Raw user prompts, CRM notes, and confidential credentials are never recorded.
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="relative overflow-x-auto min-h-[220px]">
          {loading && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] flex items-center justify-center z-10">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          )}

          {data.items.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500">
              No audit events found matching the specified filters.
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/75">
                <TableRow>
                  <TableHead className="text-xs font-semibold text-slate-700">Timestamp</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700">User</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700">Endpoint</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700">Provider / Model</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700 text-right">Duration</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700 text-right">Tokens</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700">Status</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700">Correlation ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((event) => (
                  <TableRow
                    key={event.id}
                    onClick={() => handleRowClick(event)}
                    className="hover:bg-slate-50/80 cursor-pointer text-xs transition-colors"
                  >
                    <TableCell className="text-slate-600 whitespace-nowrap">
                      {new Date(event.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}{" "}
                      <span className="text-[10px] text-slate-400 block">
                        {new Date(event.createdAt).toLocaleDateString()}
                      </span>
                    </TableCell>

                    <TableCell>
                      <div className="font-medium text-slate-900">{event.userName}</div>
                      <div className="text-[10px] text-slate-400">{event.userEmail}</div>
                    </TableCell>

                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[10px] bg-slate-50 text-slate-700">
                        /{event.endpoint}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <span className="font-medium text-slate-800 capitalize text-[11px] block">
                        {event.provider}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">
                        {event.model}
                      </span>
                    </TableCell>

                    <TableCell className="text-right text-slate-700 font-mono">
                      {event.durationMs}ms
                    </TableCell>

                    <TableCell className="text-right font-mono text-purple-700 font-medium">
                      {event.totalTokens ? event.totalTokens.toLocaleString() : "—"}
                    </TableCell>

                    <TableCell>
                      {event.status === "success" ? (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-medium gap-1">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          Success
                        </Badge>
                      ) : (
                        <Badge className="bg-rose-50 text-rose-700 border-rose-200 text-[10px] font-medium gap-1">
                          <XCircle className="h-3 w-3 text-rose-600" />
                          {event.errorCategory || "Failure"}
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell className="font-mono text-[10px] text-slate-400 max-w-[100px] truncate">
                      {event.correlationId}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Pagination Footer */}
        {data.pagination.totalPages > 1 && (
          <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 bg-slate-50/50">
            <div>
              Showing{" "}
              <strong>
                {(data.pagination.page - 1) * data.pagination.pageSize + 1}
              </strong>{" "}
              to{" "}
              <strong>
                {Math.min(
                  data.pagination.totalCount,
                  data.pagination.page * data.pagination.pageSize
                )}
              </strong>{" "}
              of <strong>{data.pagination.totalCount.toLocaleString()}</strong> events
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchAuditLogs(page - 1)}
                disabled={page <= 1 || loading}
                className="h-7 text-xs px-2"
              >
                <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                Previous
              </Button>
              <span className="px-2 text-xs font-semibold text-slate-700">
                Page {page} of {data.pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchAuditLogs(page + 1)}
                disabled={page >= data.pagination.totalPages || loading}
                className="h-7 text-xs px-2"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      <AIAuditDetailDialog
        event={selectedEvent}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </Card>
  );
}

"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AIUserUsageItem } from "@/lib/types/ai-governance";
import { Users, Info } from "lucide-react";

interface AIUserUsageTableProps {
  users: AIUserUsageItem[];
}

export function AIUserUsageTable({ users }: AIUserUsageTableProps) {
  if (users.length === 0) {
    return (
      <Card className="border-slate-200 shadow-xs">
        <CardContent className="p-6 text-center text-xs text-slate-500">
          No member activity recorded yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200 shadow-xs">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-slate-900">
                Member Capacity Consumption
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Operational usage distribution across workspace members
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/75">
              <TableRow>
                <TableHead className="text-xs font-semibold text-slate-700">Team Member</TableHead>
                <TableHead className="text-xs font-semibold text-slate-700 text-right">Total Requests</TableHead>
                <TableHead className="text-xs font-semibold text-slate-700 text-right">Successful</TableHead>
                <TableHead className="text-xs font-semibold text-slate-700 text-right">Failed</TableHead>
                <TableHead className="text-xs font-semibold text-slate-700 text-right">Tokens Consumed</TableHead>
                <TableHead className="text-xs font-semibold text-slate-700 text-right">Last Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.userId} className="hover:bg-slate-50/50 text-xs">
                  <TableCell>
                    <div>
                      <p className="font-medium text-slate-900">{u.userName}</p>
                      <p className="text-[11px] text-slate-500">{u.userEmail}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold text-slate-900">
                    {u.totalRequests.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-emerald-600 font-medium">
                    {u.successfulRequests.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-rose-600 font-medium">
                    {u.failedRequests.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono text-slate-700">
                    {u.totalTokens.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-slate-500 text-[11px]">
                    {u.lastActiveAt
                      ? new Date(u.lastActiveAt).toLocaleString()
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex items-center gap-2 text-[11px] text-slate-500">
          <Info className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <span>
            Operational telemetry for capacity governance only. No employee evaluation or surveillance scoring.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

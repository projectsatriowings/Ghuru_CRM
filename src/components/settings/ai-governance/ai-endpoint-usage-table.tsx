"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AIEndpointUsageItem } from "@/lib/types/ai-governance";
import { Network } from "lucide-react";

interface AIEndpointUsageTableProps {
  endpoints: AIEndpointUsageItem[];
}

export function AIEndpointUsageTable({ endpoints }: AIEndpointUsageTableProps) {
  if (endpoints.length === 0) {
    return (
      <Card className="border-slate-200 shadow-xs">
        <CardContent className="p-6 text-center text-xs text-slate-500">
          No endpoint activity recorded yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200 shadow-xs">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <Network className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold text-slate-900">
              Endpoint Activity Breakdown
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Operational request counts and token volume by advisory capability
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/75">
              <TableRow>
                <TableHead className="text-xs font-semibold text-slate-700">Endpoint</TableHead>
                <TableHead className="text-xs font-semibold text-slate-700 text-right">Total Requests</TableHead>
                <TableHead className="text-xs font-semibold text-slate-700 text-right">Successful</TableHead>
                <TableHead className="text-xs font-semibold text-slate-700 text-right">Failed</TableHead>
                <TableHead className="text-xs font-semibold text-slate-700 text-right">Total Tokens</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {endpoints.map((ep) => (
                <TableRow key={ep.endpoint} className="hover:bg-slate-50/50 text-xs">
                  <TableCell className="font-mono font-medium text-slate-900">
                    <Badge variant="outline" className="font-mono bg-slate-50 text-slate-800">
                      /{ep.endpoint}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold text-slate-900">
                    {ep.totalRequests.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-emerald-600 font-medium">
                    {ep.successfulRequests.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-rose-600 font-medium">
                    {ep.failedRequests.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono text-slate-700">
                    {ep.totalTokens.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

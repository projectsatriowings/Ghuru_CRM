"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  OrganizationIntegrationItem,
  IntegrationProviderItem,
} from "@/lib/types/integrations";
import {
  Blocks,
  CheckCircle2,
  AlertTriangle,
  Play,
  Power,
  Trash2,
  Plus,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

interface IntegrationsTabProps {
  initialIntegrations: OrganizationIntegrationItem[];
  providers: IntegrationProviderItem[];
  canConnect: boolean;
  canUpdate: boolean;
  canDisconnect: boolean;
  canTest: boolean;
}

export function IntegrationsTab({
  initialIntegrations,
  providers,
  canConnect,
  canUpdate,
  canDisconnect,
  canTest,
}: IntegrationsTabProps) {
  const [integrations, setIntegrations] = useState<OrganizationIntegrationItem[]>(
    initialIntegrations
  );
  const [testingId, setTestingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  // Connect dialog state
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState<string>(
    providers[0]?.id || ""
  );
  const [connectionName, setConnectionName] = useState("");
  const [connecting, setConnecting] = useState(false);

  const reloadIntegrations = async () => {
    try {
      const res = await fetch("/api/v1/integrations");
      if (res.ok) {
        const json = await res.json();
        setIntegrations(json.data || []);
      }
    } catch {
      // ignore
    }
  };

  const handleTest = async (id: string) => {
    if (!canTest) return;
    setTestingId(id);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/v1/integrations/${id}/test`, {
        method: "POST",
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setActionMessage({
          text: json.data?.message || "Connection test succeeded!",
          type: "success",
        });
        await reloadIntegrations();
      } else {
        setActionMessage({
          text: json.error?.message || "Connection test failed.",
          type: "error",
        });
      }
    } catch {
      setActionMessage({
        text: "Network error occurred during connection test.",
        type: "error",
      });
    } finally {
      setTestingId(null);
    }
  };

  const handleToggle = async (id: string, currentStatus: string) => {
    if (!canUpdate) return;
    setTogglingId(id);
    setActionMessage(null);
    const endpoint =
      currentStatus === "disabled"
        ? `/api/v1/integrations/${id}/enable`
        : `/api/v1/integrations/${id}/disable`;
    try {
      const res = await fetch(endpoint, { method: "POST" });
      if (res.ok) {
        setActionMessage({
          text: `Integration ${
            currentStatus === "disabled" ? "enabled" : "disabled"
          } successfully.`,
          type: "success",
        });
        await reloadIntegrations();
      } else {
        const json = await res.json();
        setActionMessage({
          text: json.error?.message || "Failed to toggle status.",
          type: "error",
        });
      }
    } catch {
      setActionMessage({ text: "Error toggling integration.", type: "error" });
    } finally {
      setTogglingId(null);
    }
  };

  const handleDisconnect = async (id: string) => {
    if (!canDisconnect) return;
    setDisconnectingId(id);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/v1/integrations/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setActionMessage({
          text: "Integration disconnected.",
          type: "success",
        });
        await reloadIntegrations();
      } else {
        const json = await res.json();
        setActionMessage({
          text: json.error?.message || "Failed to disconnect.",
          type: "error",
        });
      }
    } catch {
      setActionMessage({ text: "Error disconnecting integration.", type: "error" });
    } finally {
      setDisconnectingId(null);
    }
  };

  const handleCreateConnection = async () => {
    if (!canConnect || !selectedProviderId || !connectionName.trim()) return;
    setConnecting(true);
    setActionMessage(null);
    try {
      const res = await fetch("/api/v1/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: selectedProviderId,
          name: connectionName.trim(),
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setActionMessage({
          text: `Connection "${connectionName}" configured successfully.`,
          type: "success",
        });
        setIsConnectOpen(false);
        setConnectionName("");
        await reloadIntegrations();
      } else {
        setActionMessage({
          text: json.error?.message || "Failed to create connection.",
          type: "error",
        });
      }
    } catch {
      setActionMessage({ text: "Error creating connection.", type: "error" });
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Platform Status Banner */}
      <Card className="border-blue-100 bg-gradient-to-r from-blue-50/40 via-white to-slate-50">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center shrink-0">
                <Blocks className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-slate-900">
                    Integration Platform Engine
                  </h3>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                    Active & Ready
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Universal foundation for webhooks, programmatic API tokens, and multi-tenant connections.
                </p>
              </div>
            </div>
            {canConnect && providers.length > 0 && (
              <Button
                onClick={() => setIsConnectOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm shrink-0"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Connect Provider
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Action feedback */}
      {actionMessage && (
        <div
          className={`p-3.5 rounded-lg text-sm flex items-center gap-2 ${
            actionMessage.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          {actionMessage.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
          )}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Connected Integrations Section */}
      <Card>
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-slate-900">
                Connected Integrations
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-1">
                Active provider connections configured for your workspace.
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={reloadIntegrations}
              className="text-slate-500 hover:text-slate-800"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {integrations.length === 0 ? (
            <div className="py-12 text-center">
              <div className="h-12 w-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
                <Blocks className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-medium text-slate-800">
                No connected integrations yet
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
                Your integration platform is ready. Connect external systems as providers become available, or manage webhooks and API keys.
              </p>
              {canConnect && providers.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsConnectOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Connect a Provider
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {integrations.map((item) => (
                <div
                  key={item.id}
                  className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-900">
                        {item.name}
                      </span>
                      <Badge variant="outline" className="text-xs font-normal">
                        {item.providerName}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className={
                          item.status === "connected"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : item.status === "pending"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : item.status === "disabled"
                            ? "bg-slate-100 text-slate-600 border-slate-200"
                            : "bg-rose-50 text-rose-700 border-rose-200"
                        }
                      >
                        {item.status}
                      </Badge>
                      {item.hasCredentials && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                          <ShieldCheck className="h-3.5 w-3.5 text-blue-500" />
                          Secured
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      Last tested:{" "}
                      {item.lastSuccessAt
                        ? new Date(item.lastSuccessAt).toLocaleString()
                        : "Never"}
                      {item.lastErrorCode && (
                        <span className="text-rose-600 ml-2">
                          (Error: {item.lastErrorCode})
                        </span>
                      )}
                    </p>
                    <div className="flex items-center gap-1.5 pt-1 text-[11px] text-slate-500 font-mono">
                      <span className="text-slate-400 font-sans">Inbound Webhook:</span>
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 select-all">
                        /api/v1/integrations/{item.id}/inbound-webhook
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {canTest && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={testingId === item.id || item.status === "disabled"}
                        onClick={() => handleTest(item.id)}
                      >
                        <Play className="h-3.5 w-3.5 mr-1 text-slate-500" />
                        {testingId === item.id ? "Testing..." : "Test"}
                      </Button>
                    )}
                    {canUpdate && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={togglingId === item.id}
                        onClick={() => handleToggle(item.id, item.status)}
                      >
                        <Power className="h-3.5 w-3.5 mr-1 text-slate-500" />
                        {item.status === "disabled" ? "Enable" : "Disable"}
                      </Button>
                    )}
                    {canDisconnect && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                        disabled={disconnectingId === item.id}
                        onClick={() => handleDisconnect(item.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Disconnect
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Available Providers Section */}
      <Card>
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-base font-semibold text-slate-900">
            Provider Ecosystem Registry
          </CardTitle>
          <CardDescription className="text-xs text-slate-500 mt-1">
            Registered adapter specifications available for workspace connection.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {providers.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">
              <p className="font-medium text-slate-700">No provider connectors installed yet.</p>
              <p className="mt-1 text-slate-400">
                The generic connector framework is active. External provider adapters will register here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {providers.map((p) => (
                <div
                  key={p.id}
                  className="p-3.5 border border-slate-200 rounded-lg bg-slate-50/50 hover:bg-white transition-all space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-slate-900">
                      {p.name}
                    </span>
                    <Badge variant="outline" className="text-[11px] capitalize">
                      {p.category}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-2">
                    {p.description || "Generic integration provider."}
                  </p>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {p.capabilities.map((cap) => (
                      <span
                        key={cap}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-mono"
                      >
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Connect Provider Dialog */}
      <Dialog open={isConnectOpen} onOpenChange={setIsConnectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect Provider</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Set up a new organization-scoped integration connection.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="providerSelect" className="text-xs font-semibold">
                Select Provider
              </Label>
              <select
                id="providerSelect"
                value={selectedProviderId}
                onChange={(e) => setSelectedProviderId(e.target.value)}
                className="w-full text-xs rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600"
              >
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.category})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="connName" className="text-xs font-semibold">
                Connection Name
              </Label>
              <Input
                id="connName"
                placeholder="e.g. Production Webhook Gateway"
                value={connectionName}
                onChange={(e) => setConnectionName(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsConnectOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={connecting || !connectionName.trim()}
              onClick={handleCreateConnection}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {connecting ? "Connecting..." : "Confirm Connection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

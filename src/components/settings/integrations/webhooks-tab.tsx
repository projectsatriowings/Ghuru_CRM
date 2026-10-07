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
  OrganizationWebhookItem,
  WebhookDeliveryItem,
  INTEGRATION_EVENT_TYPES,
} from "@/lib/types/integrations";
import {
  Radio,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Copy,
  Check,
  History,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";

interface WebhooksTabProps {
  initialWebhooks: OrganizationWebhookItem[];
  canManage: boolean;
}

export function WebhooksTab({ initialWebhooks, canManage }: WebhooksTabProps) {
  const [webhooks, setWebhooks] = useState<OrganizationWebhookItem[]>(initialWebhooks);
  const [actionMessage, setActionMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  // Create Webhook State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>(["*"]);
  const [creating, setCreating] = useState(false);

  // Secret display modal (shows secret ONCE)
  const [newlyCreatedSecret, setNewlyCreatedSecret] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Deliveries history modal
  const [activeWebhookId, setActiveWebhookId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDeliveryItem[]>([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  const reloadWebhooks = async () => {
    try {
      const res = await fetch("/api/v1/webhooks");
      if (res.ok) {
        const json = await res.json();
        setWebhooks(json.data || []);
      }
    } catch {
      // ignore
    }
  };

  const handleCreateWebhook = async () => {
    if (!canManage || !name.trim() || !url.trim() || selectedEvents.length === 0) return;
    setCreating(true);
    setActionMessage(null);
    try {
      const res = await fetch("/api/v1/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          url: url.trim(),
          subscribedEvents: selectedEvents,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setIsAddOpen(false);
        setNewlyCreatedSecret(json.data?.secret || null);
        setName("");
        setUrl("");
        setSelectedEvents(["*"]);
        await reloadWebhooks();
      } else {
        setActionMessage({
          text: json.error?.message || "Failed to create webhook.",
          type: "error",
        });
      }
    } catch {
      setActionMessage({ text: "Error creating webhook.", type: "error" });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!canManage) return;
    setActionMessage(null);
    try {
      const res = await fetch(`/api/v1/webhooks/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setActionMessage({
          text: "Webhook endpoint deleted.",
          type: "success",
        });
        await reloadWebhooks();
      } else {
        const json = await res.json();
        setActionMessage({
          text: json.error?.message || "Failed to delete webhook.",
          type: "error",
        });
      }
    } catch {
      setActionMessage({ text: "Error deleting webhook.", type: "error" });
    }
  };

  const handleTestPing = async (id: string) => {
    if (!canManage) return;
    setTestingId(id);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/v1/webhooks/${id}/test`, {
        method: "POST",
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setActionMessage({
          text: json.data?.success
            ? "Test ping delivered successfully! (HTTP 200 OK)"
            : "Test ping attempt recorded. Check deliveries for status details.",
          type: "success",
        });
      } else {
        setActionMessage({
          text: json.error?.message || "Test ping failed.",
          type: "error",
        });
      }
    } catch {
      setActionMessage({ text: "Error executing test ping.", type: "error" });
    } finally {
      setTestingId(null);
    }
  };

  const handleOpenDeliveries = async (webhookId: string) => {
    setActiveWebhookId(webhookId);
    setLoadingDeliveries(true);
    try {
      const res = await fetch(`/api/v1/webhooks/${webhookId}/deliveries`);
      if (res.ok) {
        const json = await res.json();
        setDeliveries(json.data || []);
      }
    } catch {
      setDeliveries([]);
    } finally {
      setLoadingDeliveries(false);
    }
  };

  const toggleEvent = (evt: string) => {
    if (evt === "*") {
      setSelectedEvents(["*"]);
      return;
    }
    const withoutWildcard = selectedEvents.filter((e) => e !== "*");
    if (withoutWildcard.includes(evt)) {
      const updated = withoutWildcard.filter((e) => e !== evt);
      setSelectedEvents(updated.length > 0 ? updated : ["*"]);
    } else {
      setSelectedEvents([...withoutWildcard, evt]);
    }
  };

  return (
    <div className="space-y-6">
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

      {/* Webhooks Header Card */}
      <Card>
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Outbound Webhooks
                </CardTitle>
                <Badge variant="outline" className="text-xs bg-slate-50 text-slate-600">
                  HMAC-SHA256 Signed
                </Badge>
              </div>
              <CardDescription className="text-xs text-slate-500 mt-1">
                Deliver CRM domain events (leads, contacts, deals, activities) asynchronously to external endpoints.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={reloadWebhooks}
                className="text-slate-500 hover:text-slate-800"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                Refresh
              </Button>
              {canManage && (
                <Button
                  size="sm"
                  onClick={() => setIsAddOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add Webhook
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {webhooks.length === 0 ? (
            <div className="py-12 text-center">
              <div className="h-12 w-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
                <Radio className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-medium text-slate-800">
                No webhooks configured
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
                Configure webhooks to receive real-time notifications whenever leads, deals, or contacts are updated in Ghuru CRM.
              </p>
              {canManage && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add your first webhook
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {webhooks.map((wh) => (
                <div
                  key={wh.id}
                  className="py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 max-w-xl">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-900">
                        {wh.name}
                      </span>
                      <Badge
                        variant="secondary"
                        className={
                          wh.active
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }
                      >
                        {wh.active ? "Active" : "Inactive"}
                      </Badge>
                      <span className="text-[11px] font-mono text-slate-400">
                        Secret: {wh.secretMasked}
                      </span>
                    </div>
                    <p className="text-xs font-mono text-slate-600 truncate bg-slate-50 px-2 py-1 rounded border border-slate-200/60 max-w-md">
                      {wh.url}
                    </p>
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {wh.subscribedEvents.map((evt) => (
                        <span
                          key={evt}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-mono"
                        >
                          {evt}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {canManage && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={testingId === wh.id}
                        onClick={() => handleTestPing(wh.id)}
                      >
                        <Send className="h-3.5 w-3.5 mr-1 text-slate-500" />
                        {testingId === wh.id ? "Pinging..." : "Test Ping"}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDeliveries(wh.id)}
                    >
                      <History className="h-3.5 w-3.5 mr-1 text-slate-500" />
                      Deliveries
                    </Button>
                    {canManage && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                        onClick={() => handleDelete(wh.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Webhook Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Outbound Webhook</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Ghuru CRM will send signed POST requests to your URL with event details.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="webhookName" className="text-xs font-semibold">
                Webhook Name
              </Label>
              <Input
                id="webhookName"
                placeholder="e.g. Lead Ingestion Service"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="webhookUrl" className="text-xs font-semibold">
                Destination URL
              </Label>
              <Input
                id="webhookUrl"
                placeholder="https://api.yourdomain.com/webhooks"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Subscribed Events
              </Label>
              <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto p-2 border border-slate-200 rounded-md bg-slate-50/50">
                {INTEGRATION_EVENT_TYPES.map((evt) => {
                  const isChecked = selectedEvents.includes(evt);
                  return (
                    <label
                      key={evt}
                      className="flex items-center gap-2 text-[11px] font-mono text-slate-700 p-1 rounded hover:bg-white cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleEvent(evt)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>{evt}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={creating || !name.trim() || !url.trim()}
              onClick={handleCreateWebhook}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {creating ? "Saving..." : "Create Webhook"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Secret Reveal Modal (ONCE) */}
      <Dialog
        open={!!newlyCreatedSecret}
        onOpenChange={(open) => !open && setNewlyCreatedSecret(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="h-10 w-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <DialogTitle>Webhook Signing Secret Generated</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Save this secret now! Used to verify HMAC-SHA256 signatures in the{" "}
              <code className="text-slate-700 font-mono">X-Ghuru-Signature</code>{" "}
              header. It will not be shown again.
            </DialogDescription>
          </DialogHeader>

          <div className="my-2 p-3 bg-slate-900 text-slate-100 rounded-lg font-mono text-xs flex items-center justify-between break-all">
            <span>{newlyCreatedSecret}</span>
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-300 hover:text-white shrink-0 ml-2"
              onClick={() => {
                if (newlyCreatedSecret) {
                  navigator.clipboard.writeText(newlyCreatedSecret);
                  setCopiedSecret(true);
                  setTimeout(() => setCopiedSecret(false), 2000);
                }
              }}
            >
              {copiedSecret ? (
                <Check className="h-4 w-4 text-emerald-400" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>

          <DialogFooter>
            <Button
              size="sm"
              onClick={() => setNewlyCreatedSecret(null)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              I have safely copied the secret
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deliveries History Dialog */}
      <Dialog
        open={!!activeWebhookId}
        onOpenChange={(open) => !open && setActiveWebhookId(null)}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Webhook Delivery Logs</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Recent outbound delivery attempts for this endpoint.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-96 overflow-y-auto py-2">
            {loadingDeliveries ? (
              <div className="py-8 text-center text-xs text-slate-500">
                Loading delivery history...
              </div>
            ) : deliveries.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No delivery records found for this webhook.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {deliveries.map((del) => (
                  <div key={del.id} className="py-2.5 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className={
                            del.status === "delivered"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : del.status === "pending"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-rose-50 text-rose-700 border-rose-200"
                          }
                        >
                          {del.status}
                        </Badge>
                        <span className="font-mono text-slate-800 font-medium">
                          {del.eventType}
                        </span>
                        {del.responseStatus && (
                          <span className="text-[11px] font-mono text-slate-500">
                            HTTP {del.responseStatus}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {new Date(del.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center justify-between font-mono">
                      <span>Event ID: {del.eventId}</span>
                      <span>Attempts: {del.attemptCount} / {del.maxAttempts}</span>
                    </div>
                    {del.failureReason && (
                      <p className="text-[11px] text-rose-600 bg-rose-50/50 p-1 rounded font-mono">
                        Error: {del.failureReason}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveWebhookId(null)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

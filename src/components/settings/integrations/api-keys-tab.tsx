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
  ApiKeyItem,
  API_KEY_SCOPES,
  ApiKeyScope,
} from "@/lib/types/integrations";
import {
  Key,
  Plus,
  RefreshCw,
  Trash2,
  Copy,
  Check,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";

interface ApiKeysTabProps {
  initialKeys: ApiKeyItem[];
  canManage: boolean;
}

export function ApiKeysTab({ initialKeys, canManage }: ApiKeysTabProps) {
  const [keys, setKeys] = useState<ApiKeyItem[]>(initialKeys);
  const [actionMessage, setActionMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  // Generate Key State
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<ApiKeyScope[]>([
    "leads.read",
    "contacts.read",
  ]);
  const [expiresInDays, setExpiresInDays] = useState<number | undefined>(undefined);
  const [generating, setGenerating] = useState(false);

  // Secret display modal (shows secret ONCE)
  const [newlyCreatedSecret, setNewlyCreatedSecret] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const reloadKeys = async () => {
    try {
      const res = await fetch("/api/v1/api-keys?includeRevoked=true");
      if (res.ok) {
        const json = await res.json();
        setKeys(json.data || []);
      }
    } catch {
      // ignore
    }
  };

  const handleGenerateKey = async () => {
    if (!canManage || !keyName.trim() || selectedScopes.length === 0) return;
    setGenerating(true);
    setActionMessage(null);
    try {
      const res = await fetch("/api/v1/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: keyName.trim(),
          scopes: selectedScopes,
          expiresInDays: expiresInDays || undefined,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setIsGenerateOpen(false);
        setNewlyCreatedSecret(json.data?.secret || null);
        setKeyName("");
        setSelectedScopes(["leads.read", "contacts.read"]);
        setExpiresInDays(undefined);
        await reloadKeys();
      } else {
        setActionMessage({
          text: json.error?.message || "Failed to generate API key.",
          type: "error",
        });
      }
    } catch {
      setActionMessage({ text: "Error generating API key.", type: "error" });
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!canManage) return;
    setActionMessage(null);
    try {
      const res = await fetch(`/api/v1/api-keys/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setActionMessage({
          text: "API key permanently revoked.",
          type: "success",
        });
        await reloadKeys();
      } else {
        const json = await res.json();
        setActionMessage({
          text: json.error?.message || "Failed to revoke key.",
          type: "error",
        });
      }
    } catch {
      setActionMessage({ text: "Error revoking API key.", type: "error" });
    }
  };

  const toggleScope = (scope: ApiKeyScope) => {
    if (selectedScopes.includes(scope)) {
      if (selectedScopes.length > 1) {
        setSelectedScopes(selectedScopes.filter((s) => s !== scope));
      }
    } else {
      setSelectedScopes([...selectedScopes, scope]);
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

      {/* API Keys Header Card */}
      <Card>
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Organization API Keys
                </CardTitle>
                <Badge variant="outline" className="text-xs bg-slate-50 text-slate-600">
                  SHA-256 Hashed
                </Badge>
              </div>
              <CardDescription className="text-xs text-slate-500 mt-1">
                Manage scoped programmatic credentials for customer applications and machine-to-machine integrations.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={reloadKeys}
                className="text-slate-500 hover:text-slate-800"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                Refresh
              </Button>
              {canManage && (
                <Button
                  size="sm"
                  onClick={() => setIsGenerateOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Generate API Key
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {keys.length === 0 ? (
            <div className="py-12 text-center">
              <div className="h-12 w-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
                <Key className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-medium text-slate-800">
                No API keys generated
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
                Generate an API key to securely access Ghuru CRM programmatically from external scripts and custom services.
              </p>
              {canManage && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsGenerateOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Generate your first API key
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {keys.map((k) => (
                <div
                  key={k.id}
                  className="py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 max-w-xl">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-900">
                        {k.name}
                      </span>
                      <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                        {k.keyPrefix}
                      </span>
                      <Badge
                        variant="secondary"
                        className={
                          k.revokedAt
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        }
                      >
                        {k.revokedAt ? "Revoked" : "Active"}
                      </Badge>
                    </div>

                    <p className="text-xs text-slate-500">
                      Created: {new Date(k.createdAt).toLocaleDateString()}
                      {k.lastUsedAt && (
                        <span className="ml-2">
                          | Last used: {new Date(k.lastUsedAt).toLocaleString()}
                        </span>
                      )}
                      {k.expiresAt && (
                        <span className="ml-2">
                          | Expires: {new Date(k.expiresAt).toLocaleDateString()}
                        </span>
                      )}
                    </p>

                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {k.scopes.map((scope) => (
                        <span
                          key={scope}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono"
                        >
                          {scope}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {canManage && !k.revokedAt && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                        onClick={() => handleRevoke(k.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Revoke Key
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generate Key Dialog */}
      <Dialog open={isGenerateOpen} onOpenChange={setIsGenerateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Generate New API Key</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Create a token with granular scopes for programmatic CRM access.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="keyNameInput" className="text-xs font-semibold">
                Key Name
              </Label>
              <Input
                id="keyNameInput"
                placeholder="e.g. Analytics Pipeline Ingest"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="expiresInput" className="text-xs font-semibold">
                Expiration (Optional days)
              </Label>
              <Input
                id="expiresInput"
                type="number"
                placeholder="e.g. 30, 90, or leave blank for never"
                value={expiresInDays ?? ""}
                onChange={(e) =>
                  setExpiresInDays(
                    e.target.value ? parseInt(e.target.value, 10) : undefined
                  )
                }
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Scopes & Permissions
              </Label>
              <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto p-2 border border-slate-200 rounded-md bg-slate-50/50">
                {API_KEY_SCOPES.map((scope) => {
                  const isChecked = selectedScopes.includes(scope);
                  return (
                    <label
                      key={scope}
                      className="flex items-center gap-2 text-[11px] font-mono text-slate-700 p-1 rounded hover:bg-white cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleScope(scope)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>{scope}</span>
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
              onClick={() => setIsGenerateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={generating || !keyName.trim() || selectedScopes.length === 0}
              onClick={handleGenerateKey}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {generating ? "Generating..." : "Generate Secret"}
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
            <div className="h-10 w-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mb-1">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <DialogTitle>Save Your Secret Key</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Please copy your API key now. For your security, this secret will{" "}
              <strong>never be shown again</strong>.
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
              I have copied the key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

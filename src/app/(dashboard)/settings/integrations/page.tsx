import { Metadata } from "next";
import { requirePermission } from "@/lib/context/organization-context";
import { getOrganizationIntegrations } from "@/lib/services/integrations/organization-integration.service";
import { getProviders } from "@/lib/services/integrations/provider-registry.service";
import { getWebhooks } from "@/lib/services/integrations/webhook.service";
import { getOrganizationApiKeys } from "@/lib/services/integrations/api-key.service";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IntegrationsTab } from "@/components/settings/integrations/integrations-tab";
import { WebhooksTab } from "@/components/settings/integrations/webhooks-tab";
import { ApiKeysTab } from "@/components/settings/integrations/api-keys-tab";
import { Blocks, Radio, Key } from "lucide-react";

export const metadata: Metadata = {
  title: "Integrations & API | Settings | Ghuru CRM",
  description:
    "Manage external provider connections, outbound webhooks, and programmatic API keys.",
};

export default async function IntegrationsPage() {
  const ctx = await requirePermission("integrations.view");

  const [integrations, providers, webhooksResult, apiKeys] = await Promise.all([
    getOrganizationIntegrations(ctx.organization.id),
    getProviders(),
    getWebhooks(ctx.organization.id),
    getOrganizationApiKeys(ctx.organization.id, { includeRevoked: true }),
  ]);

  const canConnect = ctx.hasPermission("integrations.connect");
  const canUpdate = ctx.hasPermission("integrations.update");
  const canDisconnect = ctx.hasPermission("integrations.disconnect");
  const canTest = ctx.hasPermission("integrations.test");
  const canManageWebhooks = ctx.hasPermission("webhooks.manage");
  const canManageApiKeys = ctx.hasPermission("api_keys.manage");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">
          Integrations & API Platform
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Configure external system connections, outbound webhook subscriptions, and programmatic credentials for your workspace.
        </p>
      </div>

      <Tabs defaultValue="integrations" className="space-y-6">
        <TabsList className="bg-slate-100 p-1 border border-slate-200">
          <TabsTrigger
            value="integrations"
            className="flex items-center gap-1.5 text-xs data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm"
          >
            <Blocks className="h-3.5 w-3.5" />
            <span>Connections ({integrations.length})</span>
          </TabsTrigger>

          <TabsTrigger
            value="webhooks"
            className="flex items-center gap-1.5 text-xs data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm"
          >
            <Radio className="h-3.5 w-3.5" />
            <span>Webhooks ({webhooksResult.total})</span>
          </TabsTrigger>

          <TabsTrigger
            value="api-keys"
            className="flex items-center gap-1.5 text-xs data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm"
          >
            <Key className="h-3.5 w-3.5" />
            <span>API Keys ({apiKeys.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="integrations">
          <IntegrationsTab
            initialIntegrations={integrations}
            providers={providers}
            canConnect={canConnect}
            canUpdate={canUpdate}
            canDisconnect={canDisconnect}
            canTest={canTest}
          />
        </TabsContent>

        <TabsContent value="webhooks">
          <WebhooksTab
            initialWebhooks={webhooksResult.items}
            canManage={canManageWebhooks}
          />
        </TabsContent>

        <TabsContent value="api-keys">
          <ApiKeysTab
            initialKeys={apiKeys}
            canManage={canManageApiKeys}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

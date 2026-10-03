import { requirePermission } from "@/lib/context/organization-context";
import { getPipelines } from "@/lib/services/pipeline.service";
import { PipelineList } from "@/components/pipelines/pipeline-list";

export const metadata = {
  title: "Pipelines - Settings - Ghuru CRM",
  description: "Configure custom pipelines and stages for your organization",
};

export default async function PipelinesSettingsPage() {
  const ctx = await requirePermission("pipelines.view");
  const pipelines = await getPipelines(ctx.organization.id);

  return (
    <div className="space-y-6">
      <PipelineList
        pipelines={pipelines}
        canCreate={ctx.hasPermission("pipelines.create")}
        canUpdate={ctx.hasPermission("pipelines.update")}
        canDelete={ctx.hasPermission("pipelines.delete")}
      />
    </div>
  );
}

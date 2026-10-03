import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/context/organization-context";
import { getPipelineById } from "@/lib/services/pipeline.service";
import { PipelineStagesList } from "@/components/pipelines/pipeline-stages-list";
import { ArrowLeft } from "lucide-react";
import { PipelineDetailHeader } from "./pipeline-detail-header";

interface PipelineDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata() {
  return {
    title: `Pipeline Details - Settings - Ghuru CRM`,
  };
}

export default async function PipelineDetailPage({
  params,
}: PipelineDetailPageProps) {
  const { id: pipelineId } = await params;
  const ctx = await requirePermission("pipelines.view");

  let pipeline;
  try {
    pipeline = await getPipelineById(ctx.organization.id, pipelineId);
  } catch {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb navigation */}
      <div>
        <Link
          href="/settings/pipelines"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Pipelines</span>
        </Link>
      </div>

      {/* Pipeline Header */}
      <PipelineDetailHeader
        pipeline={pipeline}
        canUpdate={ctx.hasPermission("pipelines.update")}
      />

      {/* Stages Section */}
      <div className="pt-2">
        <PipelineStagesList
          pipelineId={pipeline.id}
          stages={pipeline.stages}
          canCreate={ctx.hasPermission("pipelines.create")}
          canUpdate={ctx.hasPermission("pipelines.update")}
          canDelete={ctx.hasPermission("pipelines.delete")}
        />
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { type FollowUpWithRelations } from "@/lib/types/follow-ups";
import { selectPrimaryNextAction } from "@/lib/utils/follow-up-utils";
import { NextActionCard } from "./next-action-card";
import { FollowUpHistory } from "./follow-up-history";
import { EditFollowUpDialog } from "./edit-follow-up-dialog";

interface FollowUpSectionProps {
  leadId?: string;
  dealId?: string;
  followUps: FollowUpWithRelations[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  members: Array<{ id: string; name: string; email: string }>;
  currentUserId?: string;
  onRefresh?: () => void;
}

export function FollowUpSection({
  leadId,
  dealId,
  followUps,
  canCreate,
  canUpdate,
  canDelete,
  members,
  currentUserId,
  onRefresh,
}: FollowUpSectionProps) {
  const [editingFollowUp, setEditingFollowUp] =
    useState<FollowUpWithRelations | null>(null);

  // Compute Primary Next Action and History
  const primaryAction = selectPrimaryNextAction(followUps);

  // History list contains all follow-ups except the primaryAction
  const historyList = primaryAction
    ? followUps.filter((f) => f.id !== primaryAction.id)
    : followUps;

  return (
    <div className="space-y-6">
      {/* 1. Primary Next Action Card */}
      <NextActionCard
        leadId={leadId}
        dealId={dealId}
        primaryAction={primaryAction}
        canCreate={canCreate}
        canUpdate={canUpdate}
        members={members}
        currentUserId={currentUserId}
        onEdit={(fu) => setEditingFollowUp(fu)}
        onRefresh={onRefresh}
      />

      {/* 2. Follow-up History */}
      <FollowUpHistory
        leadId={leadId}
        dealId={dealId}
        historyList={historyList}
        canUpdate={canUpdate}
        canDelete={canDelete}
        onEdit={(fu) => setEditingFollowUp(fu)}
        onRefresh={onRefresh}
      />

      {/* 3. Edit Dialog */}
      <EditFollowUpDialog
        open={Boolean(editingFollowUp)}
        onOpenChange={(op) => {
          if (!op) setEditingFollowUp(null);
        }}
        followUp={editingFollowUp}
        leadId={leadId}
        dealId={dealId}
        members={members}
        onSuccess={onRefresh}
      />
    </div>
  );
}

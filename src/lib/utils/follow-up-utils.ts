import { type FollowUpWithRelations } from "@/lib/types/follow-ups";

/**
 * Helper to select the primary Next Action from a list of follow-ups.
 * Criteria (Section 17):
 * - Status must be 'pending'
 * - Sorted by:
 *   1. due_date ascending
 *   2. due_time ascending (nulls last)
 *   3. created_at ascending
 */
export function selectPrimaryNextAction(
  list: FollowUpWithRelations[]
): FollowUpWithRelations | null {
  const pending = list.filter(
    (item) => item.status === "pending" && !item.archivedAt
  );

  if (pending.length === 0) return null;

  pending.sort((a, b) => {
    // 1. Due date ascending
    if (a.dueDate !== b.dueDate) {
      return a.dueDate.localeCompare(b.dueDate);
    }

    // 2. Due time ascending (nulls last)
    if (a.dueTime && b.dueTime) {
      if (a.dueTime !== b.dueTime) {
        return a.dueTime.localeCompare(b.dueTime);
      }
    } else if (a.dueTime && !b.dueTime) {
      return -1;
    } else if (!a.dueTime && b.dueTime) {
      return 1;
    }

    // 3. Created at ascending
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  return pending[0] || null;
}

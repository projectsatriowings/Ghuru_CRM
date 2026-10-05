import {
  AutomationEntityType,
  AutomationTriggerType,
} from "@/lib/types/automations";

export interface TriggerDefinition {
  key: AutomationTriggerType;
  label: string;
  description: string;
  supportedEntities: AutomationEntityType[];
}

export const TRIGGER_REGISTRY: Record<AutomationTriggerType, TriggerDefinition> =
  {
    entity_created: {
      key: "entity_created",
      label: "Created",
      description: "Triggered when a new record is created",
      supportedEntities: ["lead", "contact", "company", "deal"],
    },
    entity_updated: {
      key: "entity_updated",
      label: "Updated",
      description: "Triggered when any field on the record is updated",
      supportedEntities: ["lead", "contact", "company", "deal"],
    },
    entity_status_changed: {
      key: "entity_status_changed",
      label: "Status Changed",
      description: "Triggered when the record's status changes",
      supportedEntities: ["lead", "deal"],
    },
    entity_assigned: {
      key: "entity_assigned",
      label: "Owner / Assignee Changed",
      description: "Triggered when the record is assigned to a new user",
      supportedEntities: ["lead", "contact", "company", "deal"],
    },
    pipeline_stage_changed: {
      key: "pipeline_stage_changed",
      label: "Pipeline Stage Changed",
      description: "Triggered when the record moves to a different pipeline stage",
      supportedEntities: ["lead", "deal"],
    },
  };

/**
 * Checks whether a given trigger is valid and supported for a given entity type.
 */
export function isTriggerSupportedForEntity(
  entityType: AutomationEntityType,
  triggerType: AutomationTriggerType
): boolean {
  const def = TRIGGER_REGISTRY[triggerType];
  if (!def) return false;
  return def.supportedEntities.includes(entityType);
}

/**
 * Returns all supported triggers for a given entity type.
 */
export function getSupportedTriggersForEntity(
  entityType: AutomationEntityType
): TriggerDefinition[] {
  return Object.values(TRIGGER_REGISTRY).filter((def) =>
    def.supportedEntities.includes(entityType)
  );
}

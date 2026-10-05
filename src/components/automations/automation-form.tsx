"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  type AutomationWithRelations,
  type AutomationEntityType,
  type AutomationTriggerType,
  type AutomationConditionOperator,
  type AutomationActionType,
  type AutomationConditionGroup,
  type AutomationActionConfig,
  AUTOMATION_CONDITION_OPERATORS,
} from "@/lib/types/automations";
import {
  createAutomationAction,
  updateAutomationAction,
} from "@/lib/actions/automation.actions";
import {
  getSupportedTriggersForEntity,
  TRIGGER_REGISTRY,
} from "@/lib/automation/trigger-registry";
import { ACTIVITY_TYPES } from "@/db/schema/activities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Briefcase,
  UserPlus,
  Contact,
  Building,
} from "lucide-react";

interface PipelineWithStages {
  id: string;
  name: string;
  stages: Array<{ id: string; name: string }>;
}

interface MemberItem {
  id: string;
  name: string | null;
  email: string;
}

interface AutomationFormProps {
  initialData?: AutomationWithRelations;
  members: MemberItem[];
  pipelines: PipelineWithStages[];
  isEdit?: boolean;
}

export function AutomationForm({
  initialData,
  members,
  pipelines,
  isEdit = false,
}: AutomationFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(
    initialData?.description || ""
  );
  const [active, setActive] = useState(
    initialData?.active !== undefined ? initialData.active : true
  );
  const [entityType, setEntityType] = useState<AutomationEntityType>(
    initialData?.entityType || "deal"
  );
  const [triggerType, setTriggerType] = useState<AutomationTriggerType>(
    initialData?.triggerType || "pipeline_stage_changed"
  );

  // Condition Groups
  const [conditionGroups, setConditionGroups] = useState<
    AutomationConditionGroup[]
  >(
    initialData?.conditions?.length
      ? initialData.conditions
      : [
          {
            conditions: [
              {
                field: "value",
                operator: "greater_than",
                value: 100000,
              },
            ],
          },
        ]
  );

  // Actions
  const [actions, setActions] = useState<AutomationActionConfig[]>(
    initialData?.actions?.length
      ? initialData.actions
      : [
          {
            type: "create_follow_up",
            params: {
              title: "Follow up on high value opportunity",
              dueDate: "+2d",
              assignedToUserId: "current_owner",
            },
          },
        ]
  );

  // Available triggers for current entity
  const availableTriggers = getSupportedTriggersForEntity(entityType);

  function handleEntityChange(newEntity: AutomationEntityType) {
    setEntityType(newEntity);
    const supported = getSupportedTriggersForEntity(newEntity);
    if (!supported.some((t) => t.key === triggerType)) {
      setTriggerType(supported[0]?.key || "entity_created");
    }
  }

  // Condition Group helpers
  function addCondition(groupIndex: number) {
    const next = [...conditionGroups];
    const defaultField =
      entityType === "deal"
        ? "value"
        : entityType === "lead"
        ? "status"
        : "ownerUserId";
    next[groupIndex].conditions.push({
      field: defaultField,
      operator: "equals",
      value: "",
    });
    setConditionGroups(next);
  }

  function removeCondition(groupIndex: number, condIndex: number) {
    const next = [...conditionGroups];
    next[groupIndex].conditions.splice(condIndex, 1);
    if (next[groupIndex].conditions.length === 0) {
      next.splice(groupIndex, 1);
    }
    setConditionGroups(next);
  }

  function updateCondition(
    groupIndex: number,
    condIndex: number,
    updates: Partial<{
      field: string;
      operator: AutomationConditionOperator;
      value: unknown;
    }>
  ) {
    const next = [...conditionGroups];
    next[groupIndex].conditions[condIndex] = {
      ...next[groupIndex].conditions[condIndex],
      ...updates,
    };
    setConditionGroups(next);
  }

  function addConditionGroup() {
    setConditionGroups([
      ...conditionGroups,
      {
        conditions: [
          {
            field: entityType === "deal" ? "status" : "status",
            operator: "equals",
            value: "",
          },
        ],
      },
    ]);
  }

  // Action helpers
  function addAction(type: AutomationActionType = "create_activity") {
    let defaultParams: Record<string, unknown> = {};
    switch (type) {
      case "create_activity":
        defaultParams = {
          type: "note",
          title: "Automated Note",
          description: "",
          assignedToUserId: "current_owner",
        };
        break;
      case "create_follow_up":
        defaultParams = {
          title: "Follow up with client",
          dueDate: "+2d",
          assignedToUserId: "current_owner",
        };
        break;
      case "assign_owner":
        defaultParams = {
          targetUserId: members[0]?.id || "",
        };
        break;
      case "update_field":
        defaultParams = {
          field: entityType === "deal" ? "status" : "status",
          value: entityType === "deal" ? "won" : "qualified",
        };
        break;
      case "move_pipeline_stage":
        defaultParams = {
          pipelineId: pipelines[0]?.id || "",
          stageId: pipelines[0]?.stages[0]?.id || "",
        };
        break;
    }
    setActions([...actions, { type, params: defaultParams }]);
  }

  function removeAction(index: number) {
    const next = [...actions];
    next.splice(index, 1);
    setActions(next);
  }

  function updateActionType(index: number, newType: AutomationActionType) {
    const next = [...actions];
    let defaultParams: Record<string, unknown> = {};
    switch (newType) {
      case "create_activity":
        defaultParams = {
          type: "note",
          title: "Automated Activity",
          description: "",
          assignedToUserId: "current_owner",
        };
        break;
      case "create_follow_up":
        defaultParams = {
          title: "Follow up with client",
          dueDate: "+2d",
          assignedToUserId: "current_owner",
        };
        break;
      case "assign_owner":
        defaultParams = {
          targetUserId: members[0]?.id || "",
        };
        break;
      case "update_field":
        defaultParams = {
          field: entityType === "deal" ? "status" : "status",
          value: entityType === "deal" ? "won" : "qualified",
        };
        break;
      case "move_pipeline_stage":
        defaultParams = {
          pipelineId: pipelines[0]?.id || "",
          stageId: pipelines[0]?.stages[0]?.id || "",
        };
        break;
    }
    next[index] = { type: newType, params: defaultParams };
    setActions(next);
  }

  function updateActionParam(
    index: number,
    paramKey: string,
    value: unknown
  ) {
    const next = [...actions];
    next[index].params = {
      ...next[index].params,
      [paramKey]: value,
    };
    setActions(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please provide a name for this automation.");
      return;
    }
    if (actions.length === 0) {
      setError("Please add at least one action for this automation.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        active,
        entityType,
        triggerType,
        conditions: conditionGroups,
        actions,
      };

      const res = isEdit && initialData
        ? await updateAutomationAction(initialData.id, payload)
        : await createAutomationAction(payload);

      if (!res.success) {
        setError(res.error || "Failed to save automation.");
        setLoading(false);
        return;
      }

      router.push(`/automations/${res.data.id}`);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(msg);
      setLoading(false);
    }
  }

  // Field suggestions based on entity
  function getFieldSuggestions() {
    switch (entityType) {
      case "deal":
        return [
          { value: "value", label: "Deal Value (Amount)" },
          { value: "status", label: "Status (open, won, lost)" },
          { value: "probability", label: "Probability (0-100%)" },
          { value: "pipelineId", label: "Pipeline ID" },
          { value: "pipelineStageId", label: "Pipeline Stage ID" },
          { value: "currency", label: "Currency (e.g. USD)" },
          { value: "ownerUserId", label: "Owner User ID" },
        ];
      case "lead":
        return [
          { value: "status", label: "Status (new, contacted, qualified...)" },
          { value: "source", label: "Source" },
          { value: "pipelineId", label: "Pipeline ID" },
          { value: "stageId", label: "Stage ID" },
          { value: "assignedToUserId", label: "Assigned User ID" },
          { value: "email", label: "Email" },
          { value: "phone", label: "Phone" },
        ];
      case "contact":
        return [
          { value: "jobTitle", label: "Job Title" },
          { value: "ownerUserId", label: "Owner User ID" },
          { value: "email", label: "Email" },
          { value: "phone", label: "Phone" },
        ];
      case "company":
        return [
          { value: "industry", label: "Industry" },
          { value: "companySize", label: "Company Size" },
          { value: "ownerUserId", label: "Owner User ID" },
          { value: "website", label: "Website" },
        ];
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Top Breadcrumb & Action bar */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <Link href="/automations">
            <Button variant="ghost" size="sm" className="gap-1 px-2.5">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              {isEdit ? "Edit Automation" : "Create Automation"}
            </h1>
            <p className="text-xs text-slate-500">
              Configure trigger event, matching conditions, and resulting actions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/automations">
            <Button
              variant="outline"
              size="sm"
              type="button"
              disabled={loading}
            >
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            size="sm"
            disabled={loading}
            className="gap-2 bg-blue-600 hover:bg-blue-700"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isEdit ? "Update Automation" : "Save Automation"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {/* SECTION 1: DETAILS */}
      <Card className="shadow-xs border-slate-200">
        <CardHeader className="py-4 px-6 border-b border-slate-100 bg-slate-50/50">
          <CardTitle className="text-sm font-semibold text-slate-800">
            1. Automation Details
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="auto-name" className="text-xs font-semibold text-slate-700">
                Automation Name *
              </Label>
              <Input
                id="auto-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. High Value Deal Follow-up"
                required
                className="text-xs sm:text-sm h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 block">
                Status
              </Label>
              <div className="flex items-center gap-3 pt-1">
                <Switch
                  checked={active}
                  onCheckedChange={setActive}
                  id="active-switch"
                />
                <Label htmlFor="active-switch" className="text-xs text-slate-600 font-normal cursor-pointer">
                  {active ? "Active (Running)" : "Inactive (Paused)"}
                </Label>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="auto-desc" className="text-xs font-semibold text-slate-700">
              Description (Optional)
            </Label>
            <Input
              id="auto-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Automatically creates a follow-up when a deal reaches proposal stage with value > 100k"
              className="text-xs sm:text-sm h-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* SECTION 2: WHEN (Trigger) */}
      <Card className="shadow-xs border-slate-200">
        <CardHeader className="py-4 px-6 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
            2
          </div>
          <CardTitle className="text-sm font-semibold text-slate-800">
            WHEN (Trigger Event)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Target Entity
              </Label>
              <Select
                value={entityType}
                onValueChange={(val) =>
                  val && handleEntityChange(val as AutomationEntityType)
                }
              >
                <SelectTrigger className="h-9 text-xs sm:text-sm">
                  <SelectValue placeholder="Select entity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deal">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-3.5 w-3.5 text-indigo-600" />
                      <span>Deal (Commercial Opportunity)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="lead">
                    <div className="flex items-center gap-2">
                      <UserPlus className="h-3.5 w-3.5 text-blue-600" />
                      <span>Lead (Inbound Prospect)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="contact">
                    <div className="flex items-center gap-2">
                      <Contact className="h-3.5 w-3.5 text-teal-600" />
                      <span>Contact (Individual Person)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="company">
                    <div className="flex items-center gap-2">
                      <Building className="h-3.5 w-3.5 text-purple-600" />
                      <span>Company (Organization)</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Trigger Event
              </Label>
              <Select
                value={triggerType}
                onValueChange={(val) =>
                  val && setTriggerType(val as AutomationTriggerType)
                }
              >
                <SelectTrigger className="h-9 text-xs sm:text-sm">
                  <SelectValue placeholder="Select trigger" />
                </SelectTrigger>
                <SelectContent>
                  {availableTriggers.map((trig) => (
                    <SelectItem key={trig.key} value={trig.key}>
                      <div className="flex flex-col text-left py-0.5">
                        <span className="font-medium">{trig.label}</span>
                        <span className="text-[10px] text-slate-400">
                          {trig.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 3: IF (Conditions) */}
      <Card className="shadow-xs border-slate-200">
        <CardHeader className="py-4 px-6 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold">
              3
            </div>
            <div>
              <CardTitle className="text-sm font-semibold text-slate-800">
                IF (Conditions)
              </CardTitle>
              <p className="text-[11px] text-slate-400">
                Optional filters. If no conditions are defined, the automation always executes on trigger.
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addConditionGroup}
            className="text-xs gap-1 h-7 text-blue-600 hover:text-blue-700"
          >
            <Plus className="h-3 w-3" />
            Add Group (OR)
          </Button>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {conditionGroups.length === 0 ? (
            <div className="p-4 rounded-lg bg-slate-50 border border-dashed border-slate-200 text-center">
              <p className="text-xs text-slate-500">
                No conditions defined. This rule will trigger on{" "}
                <strong>every</strong> {entityType}{" "}
                {TRIGGER_REGISTRY[triggerType]?.label?.toLowerCase() || triggerType}.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addConditionGroup}
                className="mt-2 text-xs gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Condition Filter
              </Button>
            </div>
          ) : (
            conditionGroups.map((group, gIdx) => (
              <div
                key={gIdx}
                className="p-4 rounded-xl bg-slate-50/75 border border-slate-200 space-y-3 relative"
              >
                <div className="flex items-center justify-between pb-1 border-b border-slate-200/60">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    {gIdx > 0 && <span className="text-amber-600 mr-1.5">OR</span>}
                    Condition Group #{gIdx + 1} (AND between rows)
                  </span>

                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => addCondition(gIdx)}
                      className="h-6 text-[11px] text-blue-600 hover:text-blue-700 px-2 gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      Add AND Row
                    </Button>
                    {conditionGroups.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const next = [...conditionGroups];
                          next.splice(gIdx, 1);
                          setConditionGroups(next);
                        }}
                        className="h-6 text-[11px] text-rose-600 hover:text-rose-700 px-2 gap-1"
                      >
                        <Trash2 className="h-3 w-3" />
                        Remove Group
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  {group.conditions.map((cond, cIdx) => (
                    <div
                      key={cIdx}
                      className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-white p-2.5 rounded-lg border border-slate-200"
                    >
                      {/* Field */}
                      <div className="sm:col-span-4">
                        <Select
                          value={cond.field}
                          onValueChange={(val) =>
                            updateCondition(gIdx, cIdx, { field: val || "" })
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Select field" />
                          </SelectTrigger>
                          <SelectContent>
                            {getFieldSuggestions().map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Operator */}
                      <div className="sm:col-span-3">
                        <Select
                          value={cond.operator}
                          onValueChange={(val) =>
                            updateCondition(gIdx, cIdx, {
                              operator:
                                (val as AutomationConditionOperator) ||
                                "equals",
                            })
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Operator" />
                          </SelectTrigger>
                          <SelectContent>
                            {AUTOMATION_CONDITION_OPERATORS.map((op) => (
                              <SelectItem key={op} value={op}>
                                {op.replace(/_/g, " ")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Expected Value */}
                      <div className="sm:col-span-4">
                        {cond.operator !== "is_empty" &&
                        cond.operator !== "is_not_empty" ? (
                          <Input
                            value={
                              cond.value !== undefined && cond.value !== null
                                ? String(cond.value)
                                : ""
                            }
                            onChange={(e) =>
                              updateCondition(gIdx, cIdx, {
                                value: e.target.value,
                              })
                            }
                            placeholder="Value to compare..."
                            className="h-8 text-xs"
                          />
                        ) : (
                          <div className="text-[11px] text-slate-400 italic px-2">
                            (No value required)
                          </div>
                        )}
                      </div>

                      {/* Remove Row */}
                      <div className="sm:col-span-1 flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeCondition(gIdx, cIdx)}
                          className="h-7 w-7 text-slate-400 hover:text-rose-600"
                          title="Delete condition"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* SECTION 4: THEN (Actions) */}
      <Card className="shadow-xs border-slate-200">
        <CardHeader className="py-4 px-6 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">
              4
            </div>
            <div>
              <CardTitle className="text-sm font-semibold text-slate-800">
                THEN (Actions)
              </CardTitle>
              <p className="text-[11px] text-slate-400">
                Actions executed sequentially when conditions match
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addAction("create_activity")}
            className="text-xs gap-1 h-7 text-blue-600 hover:text-blue-700"
          >
            <Plus className="h-3 w-3" />
            Add Action
          </Button>
        </CardHeader>

        <CardContent className="p-6 space-y-4">
          {actions.map((act, actIdx) => (
            <div
              key={actIdx}
              className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="bg-white text-slate-700 border-slate-200 font-bold text-xs"
                  >
                    Action #{actIdx + 1}
                  </Badge>
                  <Select
                    value={act.type}
                    onValueChange={(val) =>
                      val &&
                      updateActionType(actIdx, val as AutomationActionType)
                    }
                  >
                    <SelectTrigger className="h-7 text-xs w-[180px] bg-white font-medium">
                      <SelectValue placeholder="Action Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="create_activity">
                        Create Activity
                      </SelectItem>
                      {(entityType === "lead" || entityType === "deal") && (
                        <SelectItem value="create_follow_up">
                          Create Follow-up
                        </SelectItem>
                      )}
                      <SelectItem value="assign_owner">
                        Assign Owner
                      </SelectItem>
                      <SelectItem value="update_field">
                        Update Field
                      </SelectItem>
                      {(entityType === "lead" || entityType === "deal") && (
                        <SelectItem value="move_pipeline_stage">
                          Move Pipeline Stage
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {actions.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeAction(actIdx)}
                    className="h-7 w-7 text-slate-400 hover:text-rose-600"
                    title="Remove action"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              {/* ACTION PARAMETERS */}
              {/* 1. Create Activity */}
              {act.type === "create_activity" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-600">
                      Activity Type
                    </Label>
                    <Select
                      value={String(act.params.type || "note")}
                      onValueChange={(val) =>
                        val && updateActionParam(actIdx, "type", val)
                      }
                    >
                      <SelectTrigger className="h-8 text-xs bg-white">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        {ACTIVITY_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t.replace(/_/g, " ").toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-slate-600">
                      Activity Title *
                    </Label>
                    <Input
                      value={String(act.params.title || "")}
                      onChange={(e) =>
                        updateActionParam(actIdx, "title", e.target.value)
                      }
                      placeholder="e.g. Schedule introductory meeting"
                      required
                      className="h-8 text-xs bg-white"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-xs text-slate-600">
                      Description / Notes (Optional)
                    </Label>
                    <Input
                      value={String(act.params.description || "")}
                      onChange={(e) =>
                        updateActionParam(actIdx, "description", e.target.value)
                      }
                      placeholder="e.g. Automated task generated on proposal stage"
                      className="h-8 text-xs bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-slate-600">
                      Assign To
                    </Label>
                    <Select
                      value={String(act.params.assignedToUserId || "current_owner")}
                      onValueChange={(val) =>
                        updateActionParam(actIdx, "assignedToUserId", val)
                      }
                    >
                      <SelectTrigger className="h-8 text-xs bg-white">
                        <SelectValue placeholder="Assignee" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="current_owner">
                          Current Record Owner
                        </SelectItem>
                        {members.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name || m.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-slate-600">
                      Due Date Offset
                    </Label>
                    <Select
                      value={String(act.params.dueDate || "today")}
                      onValueChange={(val) =>
                        updateActionParam(actIdx, "dueDate", val)
                      }
                    >
                      <SelectTrigger className="h-8 text-xs bg-white">
                        <SelectValue placeholder="Due Date" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="+1d">In 1 day</SelectItem>
                        <SelectItem value="+2d">In 2 days</SelectItem>
                        <SelectItem value="+3d">In 3 days</SelectItem>
                        <SelectItem value="+7d">In 1 week</SelectItem>
                        <SelectItem value="+14d">In 2 weeks</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* 2. Create Follow-up */}
              {act.type === "create_follow_up" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-xs text-slate-600">
                      Follow-up Title *
                    </Label>
                    <Input
                      value={String(act.params.title || "")}
                      onChange={(e) =>
                        updateActionParam(actIdx, "title", e.target.value)
                      }
                      placeholder="e.g. Call client regarding proposal"
                      required
                      className="h-8 text-xs bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-slate-600">
                      Due Date *
                    </Label>
                    <Select
                      value={String(act.params.dueDate || "+2d")}
                      onValueChange={(val) =>
                        updateActionParam(actIdx, "dueDate", val)
                      }
                    >
                      <SelectTrigger className="h-8 text-xs bg-white">
                        <SelectValue placeholder="Select due date" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="+1d">In 1 day</SelectItem>
                        <SelectItem value="+2d">In 2 days</SelectItem>
                        <SelectItem value="+3d">In 3 days</SelectItem>
                        <SelectItem value="+7d">In 7 days (1 week)</SelectItem>
                        <SelectItem value="+14d">In 14 days (2 weeks)</SelectItem>
                        <SelectItem value="+30d">In 30 days (1 month)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-slate-600">
                      Assign To
                    </Label>
                    <Select
                      value={String(act.params.assignedToUserId || "current_owner")}
                      onValueChange={(val) =>
                        updateActionParam(actIdx, "assignedToUserId", val)
                      }
                    >
                      <SelectTrigger className="h-8 text-xs bg-white">
                        <SelectValue placeholder="Assignee" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="current_owner">
                          Current Record Owner
                        </SelectItem>
                        {members.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name || m.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-xs text-slate-600">
                      Description (Optional)
                    </Label>
                    <Input
                      value={String(act.params.description || "")}
                      onChange={(e) =>
                        updateActionParam(actIdx, "description", e.target.value)
                      }
                      placeholder="Notes or instructions for next action..."
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                </div>
              )}

              {/* 3. Assign Owner */}
              {act.type === "assign_owner" && (
                <div className="space-y-2 pt-1">
                  <Label className="text-xs text-slate-600">
                    Assign Record To User *
                  </Label>
                  <Select
                    value={String(act.params.targetUserId || "")}
                    onValueChange={(val) =>
                      updateActionParam(actIdx, "targetUserId", val)
                    }
                  >
                    <SelectTrigger className="h-8 text-xs bg-white">
                      <SelectValue placeholder="Select member" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name || m.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* 4. Update Field */}
              {act.type === "update_field" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-600">
                      Field to Update *
                    </Label>
                    <Select
                      value={String(act.params.field || "")}
                      onValueChange={(val) =>
                        updateActionParam(actIdx, "field", val)
                      }
                    >
                      <SelectTrigger className="h-8 text-xs bg-white">
                        <SelectValue placeholder="Select field" />
                      </SelectTrigger>
                      <SelectContent>
                        {entityType === "deal" && (
                          <>
                            <SelectItem value="status">Status</SelectItem>
                            <SelectItem value="probability">Probability</SelectItem>
                          </>
                        )}
                        {entityType === "lead" && (
                          <SelectItem value="status">Status</SelectItem>
                        )}
                        {entityType === "contact" && (
                          <SelectItem value="jobTitle">Job Title</SelectItem>
                        )}
                        {entityType === "company" && (
                          <>
                            <SelectItem value="industry">Industry</SelectItem>
                            <SelectItem value="size">Company Size</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-slate-600">
                      New Value *
                    </Label>
                    {act.params.field === "status" && entityType === "deal" ? (
                      <Select
                        value={String(act.params.value || "won")}
                        onValueChange={(val) =>
                          updateActionParam(actIdx, "value", val)
                        }
                      >
                        <SelectTrigger className="h-8 text-xs bg-white">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="won">Won</SelectItem>
                          <SelectItem value="lost">Lost</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : act.params.field === "status" && entityType === "lead" ? (
                      <Select
                        value={String(act.params.value || "qualified")}
                        onValueChange={(val) =>
                          updateActionParam(actIdx, "value", val)
                        }
                      >
                        <SelectTrigger className="h-8 text-xs bg-white">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="contacted">Contacted</SelectItem>
                          <SelectItem value="qualified">Qualified</SelectItem>
                          <SelectItem value="unqualified">Unqualified</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={
                          act.params.value !== undefined
                            ? String(act.params.value)
                            : ""
                        }
                        onChange={(e) =>
                          updateActionParam(actIdx, "value", e.target.value)
                        }
                        placeholder="Value to set..."
                        className="h-8 text-xs bg-white"
                      />
                    )}
                  </div>
                </div>
              )}

              {/* 5. Move Pipeline Stage */}
              {act.type === "move_pipeline_stage" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-600">
                      Pipeline *
                    </Label>
                    <Select
                      value={String(act.params.pipelineId || "")}
                      onValueChange={(val) => {
                        updateActionParam(actIdx, "pipelineId", val);
                        const p = pipelines.find((pipe) => pipe.id === val);
                        if (p && p.stages.length > 0) {
                          updateActionParam(actIdx, "stageId", p.stages[0].id);
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs bg-white">
                        <SelectValue placeholder="Select pipeline" />
                      </SelectTrigger>
                      <SelectContent>
                        {pipelines.map((pipe) => (
                          <SelectItem key={pipe.id} value={pipe.id}>
                            {pipe.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-slate-600">
                      Destination Stage *
                    </Label>
                    <Select
                      value={String(act.params.stageId || "")}
                      onValueChange={(val) =>
                        updateActionParam(actIdx, "stageId", val)
                      }
                    >
                      <SelectTrigger className="h-8 text-xs bg-white">
                        <SelectValue placeholder="Select stage" />
                      </SelectTrigger>
                      <SelectContent>
                        {(
                          pipelines.find(
                            (p) => p.id === act.params.pipelineId
                          )?.stages || []
                        ).map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Bottom Save bar */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Link href="/automations">
          <Button
            variant="outline"
            type="button"
            disabled={loading}
          >
            Cancel
          </Button>
        </Link>
        <Button
          type="submit"
          disabled={loading}
          className="gap-2 bg-blue-600 hover:bg-blue-700 min-w-[140px]"
        >
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {isEdit ? "Update Automation" : "Create Automation"}
        </Button>
      </div>
    </form>
  );
}

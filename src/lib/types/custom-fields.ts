export const ENTITY_TYPES = ["lead", "contact", "company"] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  lead: "Lead",
  contact: "Contact",
  company: "Company",
};

export const FIELD_TYPES = [
  "text",
  "textarea",
  "number",
  "currency",
  "date",
  "datetime",
  "boolean",
  "select",
  "multiselect",
  "email",
  "phone",
  "url",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Text",
  textarea: "Text Area",
  number: "Number",
  currency: "Currency",
  date: "Date",
  datetime: "Date & Time",
  boolean: "Checkbox (Boolean)",
  select: "Dropdown (Select)",
  multiselect: "Multi-Select",
  email: "Email",
  phone: "Phone",
  url: "URL / Website",
};

export interface SelectOption {
  value: string;
  label: string;
}

export interface CustomFieldConfig {
  options?: SelectOption[];
  currencySymbol?: string;
  placeholder?: string;
  [key: string]: unknown;
}

export interface CustomFieldDefinition {
  id: string;
  organizationId: string;
  entityType: EntityType;
  key: string;
  label: string;
  description: string | null;
  fieldType: FieldType;
  required: boolean;
  active: boolean;
  displayOrder: number;
  config: CustomFieldConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomFieldValue {
  id: string;
  organizationId: string;
  fieldDefinitionId: string;
  entityType: EntityType;
  entityId: string;
  value: unknown;
  createdAt: Date;
  updatedAt: Date;
}

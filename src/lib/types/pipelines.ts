export interface Pipeline {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  active: boolean;
  isDefault: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}

export interface PipelineStage {
  id: string;
  organizationId: string;
  pipelineId: string;
  name: string;
  description: string | null;
  displayOrder: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}

export interface PipelineWithStages extends Pipeline {
  stages: PipelineStage[];
}

export interface PipelineWithCount extends Pipeline {
  stageCount: number;
}

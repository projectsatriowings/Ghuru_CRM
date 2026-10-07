import { SafePublicAIConfig } from "@/lib/services/ai/ai-config";

export interface AIGovernanceProviderStatus extends SafePublicAIConfig {
  availability: "available" | "not_configured" | "disabled";
  lastActiveAt?: string | null;
}

export interface AIGovernanceUsageQuota {
  used: number;
  limit: number;
  remaining: number;
  percentage: number;
}

export interface AIGovernanceUsageMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalTokensConsumed: number;
  dailyUsage: AIGovernanceUsageQuota;
  monthlyUsage: AIGovernanceUsageQuota;
}

export interface AIErrorSummaryItem {
  errorCategory: string;
  count: number;
  lastOccurredAt: string;
  affectedEndpoints: string[];
}

export interface AIEndpointUsageItem {
  endpoint: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalTokens: number;
}

export interface AIUserUsageItem {
  userId: string;
  userName: string;
  userEmail: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalTokens: number;
  lastActiveAt: string | null;
}

export interface AIAuditLogItem {
  id: string;
  organizationId: string;
  userId: string;
  userName: string;
  userEmail: string;
  endpoint: string;
  provider: string;
  model: string;
  correlationId: string;
  durationMs: number;
  status: "success" | "failure";
  errorCategory: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  createdAt: string;
}

export interface PaginatedAIAuditLogs {
  items: AIAuditLogItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}

export interface AIGovernanceSummary {
  organizationId: string;
  providerStatus: AIGovernanceProviderStatus;
  settings: {
    organizationId: string;
    aiEnabled: boolean;
    dailyRequestLimit: number;
    monthlyRequestLimit: number;
  };
  usage: AIGovernanceUsageMetrics;
  errors: AIErrorSummaryItem[];
  endpointUsage: AIEndpointUsageItem[];
  userUsage: AIUserUsageItem[];
}

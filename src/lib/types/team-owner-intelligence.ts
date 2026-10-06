import { type CurrencyAmountMap } from "./pipeline-intelligence";

export type { CurrencyAmountMap };

export interface OwnerLeadWorkload {
  totalLeads: number;
  newLeads: number;
  contactedLeads: number;
  qualifiedLeads: number;
  unqualifiedLeads: number;
  convertedLeads: number;
  lostLeads: number;
}

export interface OwnerLeadPerformance {
  qualificationRate: number; // (qualified + converted) / totalLeads * 100
  conversionRate: number; // converted / totalLeads * 100
  lostRate: number; // lost / totalLeads * 100
}

export interface OwnerDealWorkload {
  totalDeals: number;
  openDeals: number;
  wonDeals: number;
  lostDeals: number;
  closedDeals: number; // won + lost
  winRate: number; // won / (won + lost) * 100 (strictly won / closedDeals)
  hasSufficientClosedDeals: boolean; // sample size threshold (>= 3)
}

export interface OwnerDealValue {
  openValueByCurrency: CurrencyAmountMap;
  wonValueByCurrency: CurrencyAmountMap;
  lostValueByCurrency: CurrencyAmountMap;
  totalClosedValueByCurrency: CurrencyAmountMap;
}

export interface OwnerFollowUpWorkload {
  totalFollowUps: number;
  pendingFollowUps: number;
  completedFollowUps: number;
  overdueFollowUps: number;
  dueTodayFollowUps: number;
  upcomingFollowUps: number;
}

export interface OwnerActivityWorkload {
  totalActivities: number;
  completedActivities: number;
  pendingActivities: number;
  byType: Record<string, number>;
}

export interface OwnerWorkloadConcentration {
  leadSharePercentage: number; // owner leads / org leads * 100
  openDealSharePercentage: number; // owner open deals / org open deals * 100
}

export interface OwnerIntelligenceItem {
  userId: string;
  name: string;
  email: string;
  teams: Array<{ id: string; name: string }>;
  leads: OwnerLeadWorkload;
  leadPerformance: OwnerLeadPerformance;
  deals: OwnerDealWorkload;
  dealValue: OwnerDealValue;
  followUps: OwnerFollowUpWorkload;
  activities: OwnerActivityWorkload;
  concentration: OwnerWorkloadConcentration;
}

export interface UnassignedWorkload {
  unassignedLeads: number;
  unassignedOpenDeals: number;
  unassignedFollowUps: number;
  unassignedDealsByStatus: {
    open: number;
    won: number;
    lost: number;
  };
  unassignedOpenDealValueByCurrency: CurrencyAmountMap;
}

export interface WorkloadConcentrationIndicators {
  highestLeadWorkload: { userId: string; name: string; count: number } | null;
  highestOpenDealWorkload: { userId: string; name: string; count: number } | null;
  highestOverdueFollowUps: { userId: string; name: string; count: number } | null;
  highestActivityVolume: { userId: string; name: string; count: number } | null;
}

export interface TeamIntelligenceItem {
  teamId: string;
  name: string;
  description: string | null;
  memberCount: number;
  memberUserIds: string[];
  totalLeads: number;
  qualifiedLeads: number;
  convertedLeads: number;
  openDeals: number;
  wonDeals: number;
  lostDeals: number;
  closedDeals: number;
  winRate: number; // won / (won + lost) * 100
  hasSufficientClosedDeals: boolean;
  overdueFollowUps: number;
  completedFollowUps: number;
  activityVolume: number;
  openValueByCurrency: CurrencyAmountMap;
  wonValueByCurrency: CurrencyAmountMap;
}

export interface TeamAndOwnerIntelligenceData {
  owners: OwnerIntelligenceItem[];
  teams: TeamIntelligenceItem[];
  unassigned: UnassignedWorkload;
  indicators: WorkloadConcentrationIndicators;
  totalOrgOwners: number;
  totalOrgTeams: number;
}

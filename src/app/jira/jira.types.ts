import { JiraIssue } from './jira.service';

export type AssigneeLoadStat = {
  assignee: string;
  totalClosedSp: number;
  sprintsCount: number;
  avgPerSprint: number;
};

export type AgingMetrics = {
  avgInProgressHours: number;
  avgInReviewHours: number;
  avgCycleTimeHours: number;
  avgFlowEfficiency: number;
};

export type RiskIssue = {
  issue: JiraIssue;
  reason: string;
};

export type IssueAnalysis = {
  issue: JiraIssue;
  kind: 'bug' | 'feature' | 'tech_debt';
  isTooLarge: boolean;
  isPoorlyDescribed: boolean;
  suggestions: string[];
};

export type RetroReport = {
  wentWell: string[];
  wentBadly: string[];
  failingTypes: {
    kind: 'bug' | 'feature' | 'tech_debt';
    failureRate: number;
    total: number;
  }[];
  carryOverByAssignee: {
    assignee: string;
    carryOverSp: number;
    sprintsCount: number;
  }[];
};

export type ReleaseForecast = {
  remainingSp: number;
  p50Sprints: number;
  p80Sprints: number;
  p50Date: Date;
  p80Date: Date;
};

export type ProcessAntipattern = {
  title: string;
  description: string;
};

export type ExecutiveDashboard = {
  deliveryPredictabilityPct: number;
  predictabilityTrend: 'up' | 'down' | 'flat';
  throughputPerSprint: number;
  slaCompliancePct: number;
  burnRatePerPerson: number;
};

export type SprintStatRow = {
  sprintName: string;
  plannedSp: number;
  closedSp: number;
  addedMidSprintSp: number;
  carryOverPercent: number;
  addedVolumePercent: number;
};

export type VelocityStats = {
  average: number;
  stdDev: number;
  trend: 'up' | 'down' | 'flat';
  forecastNext: number;
  history: { sprintName: string; velocity: number }[];
};

export type BlockedIssueWithDays = {
  issue: JiraIssue;
  daysBlocked: number;
};

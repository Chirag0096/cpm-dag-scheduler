/**
 * Resource types for kitchen equipment and execution hardware.
 */
export type ResourceType = 'OVEN' | 'BURNER_1' | 'BURNER_2' | 'BURNER_3' | 'BURNER_4' | 'NONE' | string;

/**
 * Task execution lifecycle state.
 */
export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';

/**
 * Cooking / execution session status.
 */
export type SessionStatus = 'PLANNING' | 'LIVE' | 'PAUSED' | 'COMPLETE';

/**
 * Replanning proposal status.
 */
export type ProposalStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'STALE';

/**
 * Schedule feasibility outcome.
 */
export type FeasibilityStatus = 'FEASIBLE' | 'FEASIBLE_LATE' | 'INFEASIBLE';

/**
 * Task node in the Directed Acyclic Graph (DAG).
 */
export interface TaskNode {
  id: string;
  dishId?: string;
  label: string;
  instructions?: string;
  durationSeconds: number;
  minDurationSeconds?: number;
  maxDurationSeconds?: number;
  isActive: boolean; // Requires cook / worker hands-on attention
  resource: ResourceType;
  temperatureF?: number;
  predecessors: string[]; // List of predecessor task IDs
  status: TaskStatus;
  startedAt?: string; // ISO 8601
  completedAt?: string; // ISO 8601
  actualDurationSeconds?: number;
  stepType?: 'prep' | 'active-hands' | 'thermal' | 'rest' | 'stovetop' | 'holding' | string;
  constraints?: {
    minRestSeconds?: number;
    maxHoldSeconds?: number;
    canCompressRest?: boolean;
    compressedMinSeconds?: number;
    [key: string]: unknown;
  };
}

/**
 * Scheduled task output from the Critical Path Method (CPM) calculation.
 */
export interface ScheduledTask {
  taskId: string;
  dishId?: string;
  label: string;
  // Computed schedule fields (seconds relative to plan start)
  earliestStart: number;
  earliestFinish: number;
  latestStart: number;
  latestFinish: number;
  totalFloat: number; // Slack in seconds (LS - ES)
  scheduledStart: number;
  scheduledFinish: number;
  assignedResource: ResourceType;
  isCriticalPath: boolean;
  feasible: boolean;
  scheduleRevision: number;
  shiftReason?: string;
}

/**
 * Resource constraints configuration.
 */
export interface KitchenConfig {
  ovenCount: number;
  burnerCount: number;
  maxActiveAttention: number;
  ovenTempToleranceF: number;
}

/**
 * Full schedule outcome returned by the CPM engine.
 */
export interface ScheduleResult {
  scheduledTasks: ScheduledTask[];
  criticalPath: string[]; // Critical task IDs
  expectedLandingTime: string; // ISO 8601
  landingDriftSeconds: number;
  feasibilityStatus: FeasibilityStatus;
  resourceConflicts: ResourceConflict[];
  attentionConflicts: AttentionConflict[];
  ovenFeasibility: OvenFeasibility;
  warnings: string[];
  planStartTime: string; // ISO 8601
  scheduleRevision: number;
}

/**
 * Resource collision detail.
 */
export interface ResourceConflict {
  resource: ResourceType;
  taskIds: string[];
  overlapStartSeconds: number;
  overlapEndSeconds: number;
  resolved: boolean;
  resolution?: string;
}

/**
 * Worker / cook active attention collision detail.
 */
export interface AttentionConflict {
  taskIds: string[];
  overlapStartSeconds: number;
  overlapEndSeconds: number;
  resolved: boolean;
}

/**
 * Thermal oven capacity feasibility.
 */
export interface OvenFeasibility {
  feasible: boolean;
  conflicts: {
    taskIds: string[];
    temperatures: number[];
    reason: string;
  }[];
}

/**
 * Individual task delta proposed during replanning.
 */
export interface ProposedChange {
  taskId: string;
  changeType: 'SHIFTED' | 'DURATION_CHANGED' | 'RESOURCE_CHANGED' | 'ADDED_HOLD';
  previousStartSeconds: number;
  proposedStartSeconds: number;
  previousDurationSeconds: number;
  proposedDurationSeconds: number;
  secondsRecovered: number;
  reason: string;
  constraintsChecked: string[];
  requiresConfirmation: boolean;
  safetyOrQualityNotes?: string;
}

/**
 * Shock-absorber replan proposal.
 */
export interface ReplanProposal {
  proposalId: string;
  sessionId: string;
  baseRevision: number;
  status: ProposalStatus;
  triggerTaskId: string;
  delaySeconds: number;
  proposedSchedule: ScheduledTask[];
  changes: ProposedChange[];
  projectedLandingTime: string; // ISO 8601
  landingDriftSeconds: number;
  explanation: string;
  feasibilityStatus: FeasibilityStatus;
  warnings: string[];
  createdAt: string; // ISO 8601
}

/**
 * Minimal session state required by the replanner.
 */
export interface ScheduleSession {
  sessionId: string;
  targetServingAt: string;
  tasks: TaskNode[];
  currentSchedule: ScheduledTask[];
  scheduleRevision: number;
  planStartTime?: string;
}

/**
 * Default kitchen hardware constraints.
 */
export const DEFAULT_KITCHEN_CONFIG: KitchenConfig = {
  ovenCount: 1,
  burnerCount: 4,
  maxActiveAttention: 1,
  ovenTempToleranceF: 25,
};

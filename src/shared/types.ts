import { z } from "zod";

export const engineKind = z.enum(["codex", "claude"]);
export type EngineKind = z.infer<typeof engineKind>;
export const commandSchema = z.object({
  name: z.string().min(1),
  command: z.string().min(1),
  args: z.array(z.string()).default([]),
  cwd: z.string().default("."),
  phase: z.enum(["setup", "check"]).default("check"),
});
export const agentSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  role: z.enum(["developer", "qa", "po", "custom"]),
  engine: z.enum(["project", "codex", "claude"]).default("project"),
  model: z.string().default(""),
  instructions: z.string().min(1),
  tools: z.array(z.enum(["read", "edit", "command", "data"])).default(["read"]),
  timeoutMinutes: z.number().int().min(1).max(240).default(30),
  maxTurns: z.number().int().min(1).max(200).default(30),
  trigger: z
    .enum(["manual", "after-development", "schedule"])
    .default("manual"),
});
export type AgentDefinition = z.infer<typeof agentSchema>;
export const setupProfileSchema = z.object({
  engine: engineKind,
  model: z.string().min(1),
  reasoning: z.enum(["low", "medium", "high", "xhigh", "max"]),
});
export type SetupProfile = z.infer<typeof setupProfileSchema>;
export const projectConfigSchema = z.object({
  setup: setupProfileSchema.optional(),
  version: z.literal(1).default(1),
  name: z.string().min(1),
  engine: engineKind.default("codex"),
  context: z.string().default(""),
  commands: z.array(commandSchema).default([]),
  targetBranch: z.string().default("main"),
});
export type ProjectConfig = z.infer<typeof projectConfigSchema>;
export interface Project {
  setupDraft?: boolean;
  id: string;
  name: string;
  path: string;
  engine: EngineKind;
  createdAt: string;
}
export interface EngineConfig {
  id: EngineKind;
  path: string;
  connected: boolean;
  probe?: EngineProbe;
  login?: EngineLoginStatus;
}
export interface EngineLoginStatus {
  status:
    | "idle"
    | "starting"
    | "waiting"
    | "connected"
    | "failed"
    | "canceled"
    | "expired";
  path?: string;
  verificationUrl?: string;
  userCode?: string;
  expiresAt?: string;
  error?: string;
}
export interface EngineLoginRequest {
  signal: AbortSignal;
  onChallenge(challenge: { verificationUrl: string; userCode: string }): void;
}
export interface EngineProbe {
  installed: boolean;
  version?: string;
  compatible: boolean;
  authenticated: boolean | null;
  detail: string;
  capabilities: string[];
}
export interface SpecFile {
  path: string;
  name: string;
  kind: "project" | "spec" | "change" | "archive";
  change?: string;
  content: string;
  hash: string;
}
export interface FileEdit {
  encoding?: "base64";
  path: string;
  before: string | null;
  beforeHash: string | null;
  after: string;
  diff: string;
}
export interface Proposal {
  setupDraftId?: string;
  id: string;
  projectId: string;
  title: string;
  source: "setup" | "baseline" | "product" | "manual" | "agent";
  inventoryHash?: string;
  change?: string;
  files: FileEdit[];
  contextBases?: { path: string; hash: string }[];
  status: "pending" | "applied" | "rejected";
  createdAt: string;
}
export type ChangeState =
  | "draft"
  | "ready"
  | "developing"
  | "qa"
  | "review"
  | "ready-to-integrate"
  | "done";
export interface ChangeRecord {
  id: string;
  projectId: string;
  name: string;
  state: ChangeState;
  approvedHash?: string;
  branch?: string;
  worktree?: string;
  codeRevision?: string;
  baseRevision?: string;
  qaRunId?: string;
  finalRevision?: string;
  updatedAt: string;
}
export type RunStatus =
  "queued" | "running" | "waiting" | "completed" | "failed" | "interrupted";
export interface Run {
  clarificationId?: string;
  id: string;
  projectId: string;
  kind:
    | "chat"
    | "developer"
    | "qa"
    | "po"
    | "custom"
    | "planning"
    | "setup-analysis"
    | "connection-test";
  status: RunStatus;
  title: string;
  engine: EngineKind;
  agentId?: string;
  change?: string;
  conversationId?: string;
  sessionId?: string;
  skillName?:
    "analyze-request" | "create-spec" | "refine-spec" | "implement-spec";
  specHash?: string;
  codeRevision?: string;
  workspace?: string;
  proposalId?: string;
  output?: string;
  error?: string;
  qa?: QaReport;
  startedAt: string;
  endedAt?: string;
}
export interface RunEvent {
  id: number;
  runId: string;
  type: string;
  data: unknown;
  createdAt: string;
}
export interface Conversation {
  id: string;
  projectId: string;
  contextPath: string;
  change?: string;
  engine: EngineKind;
  sessionId?: string;
  messages: { role: "user" | "assistant"; text: string; at: string }[];
}
export interface Approval {
  id: string;
  projectId: string;
  runId: string;
  title: string;
  details: unknown;
  status: "pending" | "approved" | "denied";
  kind: "tool" | "question";
  answer?: string;
}
export interface CheckResult {
  name: string;
  status: "passed" | "failed" | "unverified";
  output: string;
  exitCode: number | null;
}
export interface ImplementationReview {
  branch: string;
  baseRevision: string;
  codeRevision: string;
  worktree: string;
  files: string;
  diff: string;
  uncommitted: string;
  qaCurrent: boolean;
}
export interface QaReport {
  verdict: "passed" | "failed" | "unverified";
  checks: CheckResult[];
  summary: string;
  specHash: string;
  codeRevision: string;
  criteria: {
    scenario: string;
    status: "passed" | "failed" | "unverified";
    evidence: string;
  }[];
}
export const connectionSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(["postgres", "mysql", "mongodb", "sqlite", "ssh"]),
  host: z.string().default("localhost"),
  port: z.number().int().min(1).max(65535).optional(),
  database: z.string().default(""),
  username: z.string().default(""),
  path: z.string().default(""),
  tls: z.boolean().default(true),
  sshConnectionId: z.string().optional(),
  allowedPaths: z.array(z.string()).default([]),
  hostKey: z.string().default(""),
  readOnlyConfirmed: z.boolean().default(false),
  agentIds: z.array(z.string()).optional(),
  authSource: z.string().optional(),
  srv: z.boolean().optional(),
});
export type ConnectionProfile = z.infer<typeof connectionSchema> & {
  id: string;
  projectId: string;
  secretStorage: "keyring" | "encrypted" | "session" | "none";
  updatedAt?: string;
};
export interface ConnectionSecret {
  password?: string;
  privateKey?: string;
  passphrase?: string;
}
export const metricSchema = z.object({
  name: z.string().min(1),
  feature: z.string().min(1),
  connectionId: z.string(),
  query: z.string(),
  expected: z.string().min(1),
  period: z.string().min(1),
  reviewed: z.boolean().default(false),
});
export type MetricMapping = z.infer<typeof metricSchema> & {
  id: string;
  projectId: string;
};
export interface Evidence {
  id: string;
  projectId: string;
  connectionId: string;
  source: string;
  observedAt: string;
  result: unknown;
  rowCount: number;
  truncated: boolean;
  period?: string;
}
export const findingSchema = z.object({
  title: z.string().min(1),
  kind: z.enum(["bug", "improvement", "investigation", "instrumentation"]),
  feature: z.string().min(1),
  evidenceIds: z.array(z.string()).min(1),
  observed: z.string().min(1),
  expected: z.string().min(1),
  uncertainty: z.string().min(1),
  action: z.string().min(1),
  priority: z.enum(["low", "medium", "high"]),
  rationale: z.string().min(1),
  sampleSize: z.number().nonnegative().nullable().default(null),
  denominator: z.number().nonnegative().nullable().default(null),
  period: z.string().min(1),
  fingerprint: z.string().min(1),
  confirmed: z.boolean().default(false),
});
export type Finding = z.infer<typeof findingSchema> & {
  id: string;
  projectId: string;
  status: "triage" | "ready" | "dismissed" | "converted" | "resolved";
  createdAt: string;
  updatedAt: string;
  change?: string;
};
export interface Schedule {
  id: string;
  projectId: string;
  enabled: boolean;
  intervalHours: number;
  nextRunAt: string;
  lastRunAt?: string;
  skipped?: number;
}
export interface EngineRequest {
  images?: { path: string; mime: "image/png" | "image/jpeg" }[];
  tools?: string[];
  cwd: string;
  prompt: string;
  sessionId?: string;
  reasoning?: string;
  model?: string;
  instructions?: string;
  mode: "read-only" | "workspace-write";
  timeoutMs: number;
  maxTurns: number;
  signal: AbortSignal;
  mcp?: { url: string; token: string };
  onEvent: (type: string, data: unknown) => void;
  onApproval: (
    title: string,
    details: unknown,
    kind?: "tool" | "question",
  ) => Promise<{ approved: boolean; answer?: string }>;
}
export interface EngineResult {
  text: string;
  sessionId: string;
}
export interface SetupModel {
  model: string;
  name: string;
  efforts: string[];
}
export interface EngineAdapter {
  setupModels?(path: string, cwd: string): Promise<SetupModel[] | null>;
  login?(path: string, request: EngineLoginRequest): Promise<void>;
  probe(path: string): Promise<EngineProbe>;
  run(path: string, request: EngineRequest): Promise<EngineResult>;
}
export interface DataConnector {
  test(profile: ConnectionProfile, secret: ConnectionSecret): Promise<unknown>;
  inspect(
    profile: ConnectionProfile,
    secret: ConnectionSecret,
  ): Promise<unknown>;
  query(
    profile: ConnectionProfile,
    secret: ConnectionSecret,
    query: string,
  ): Promise<{ rows: unknown[]; truncated: boolean }>;
}
export interface ServerConnector {
  test(profile: ConnectionProfile, secret: ConnectionSecret): Promise<unknown>;
  read(
    profile: ConnectionProfile,
    secret: ConnectionSecret,
    path: string,
  ): Promise<string>;
  tunnel(
    profile: ConnectionProfile,
    secret: ConnectionSecret,
    host: string,
    port: number,
  ): Promise<{ port: number; close(): void }>;
}
export interface IntegrationAdapter {
  id: string;
  listTools(): Promise<{ name: string; description: string }[]>;
  invokeTool(name: string, input: unknown): Promise<unknown>;
}

export interface DeveloperWorkflow {
  clarifications?: Clarification[];
  clarificationId?: string;
  resumeStage?: string;
  resumeWorkspace?: boolean;
  previousWorkflowId?: string;
  id: string;
  projectId: string;
  agentId: string;
  prompt: string;
  stage:
    | "analyzing"
    | "specifying"
    | "needs-input"
    | "awaiting-review"
    | "continuing"
    | "implementing"
    | "qa"
    | "review"
    | "failed"
    | "interrupted"
    | "canceled";
  runId?: string;
  proposalId?: string;
  reviewHash?: string;
  change?: string;
  summary?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}
export const agentScheduleSchema = z.object({
  agentId: z.string().regex(/^[a-z0-9-]+$/),
  prompt: z.string().max(30000).default(""),
  change: z.string().max(200).optional(),
  intervalHours: z.number().min(1).max(8760),
  enabled: z.boolean().default(false),
});
export type AgentSchedule = z.infer<typeof agentScheduleSchema> & {
  id: string;
  projectId: string;
  nextRunAt?: string;
  lastRunAt?: string;
  lastOutcome?: string;
  skipped?: number;
  runId?: string;
  workflowId?: string;
};

export interface Clarification {
  id: string;
  projectId: string;
  ownerId: string;
  stage: string;
  questions: string[];
  status: "pending" | "answered" | "canceled";
  answer?: string;
  change?: string;
  specHash?: string;
  codeRevision?: string;
  createdAt: string;
  answeredAt?: string;
}
export interface SetupAttachment {
  id: string;
  name: string;
  mime: string;
  bytes: number;
  hash: string;
  text: string;
  error?: string;
  image?: boolean;
}
export interface SetupDraft {
  id: string;
  projectId: string;
  name: string;
  destination: string;
  newDirectory: boolean;
  engine: EngineKind;
  prompt: string;
  attachments: SetupAttachment[];
  status:
    | "draft"
    | "running"
    | "needs-input"
    | "review"
    | "applied"
    | "failed"
    | "interrupted";
  runId?: string;
  proposalId?: string;
  clarificationId?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

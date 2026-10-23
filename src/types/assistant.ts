export interface AssistantAllowance {
  limit: number;
  used: number;
  remaining: number;
  resets_at: string;
  resets_text: string;
  timezone: string;
}

export interface AssistantStatus {
  name: string;
  enabled: boolean;
  reason?: string;
  welcome?: string;
  suggestions?: string[];
  allowance?: AssistantAllowance;
}

export interface AssistantSource {
  report: string;
  period: { from: string; to: string } | null;
  filters: { machine?: string | null; shift?: string | null };
  view: string | null;
  download: { path: string; params: Record<string, string | number | undefined>; filename: string } | null;
}

export type AssistantKind = 'answer' | 'clarify' | 'out_of_scope' | 'restricted' | 'not_found' | 'limit' | 'note';
export interface AssistantReply {
  kind: AssistantKind;
  text: string;
  sources: AssistantSource[];
  allowance?: AssistantAllowance;
  /** The server's signature is kept unchanged with its exact reply text. */
  sig?: string;
}

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  kind?: AssistantKind | 'error';
  sources?: AssistantSource[];
  sig?: string;
  retry?: string;
}

export type AssistantTurn = { role: 'user' | 'assistant'; content: string; sig?: string };

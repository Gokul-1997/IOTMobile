import { create } from 'zustand';
import { askAssistant, getAssistantStatus } from '../api/assistant';
import { LatestRequest } from '../api/latestRequest';
import { sessionVersion } from '../api/session';
import { mayUseAssistant } from '../auth/permissions';
import { useAuthStore } from './authStore';
import type { AuthUser } from '../types/auth';
import type { AssistantMessage, AssistantStatus } from '../types/assistant';

interface AssistantState {
  status: AssistantStatus | null;
  statusLoading: boolean;
  statusError: string | null;
  unavailable: boolean;
  messages: AssistantMessage[];
  sending: boolean;
  fetchStatus: () => Promise<void>;
  send: (text: string) => Promise<boolean>;
  retry: (id: string) => Promise<boolean>;
  newChat: () => void;
  /** Cancel the pending question while retaining completed turns. */
  cancel: () => void;
  /** Sign-out or scope change: erase every company-specific value. */
  reset: () => void;
  /** Feature removed while signed in: cancel and hide it immediately. */
  revoke: () => void;
}

const statusRequest = new LatestRequest();
let question: AbortController | null = null;
let generation = 0;
let allowanceRevision = 0;
let messageId = 0;
const nextId = () => `assistant-${++messageId}`;
const allowed = () => {
  const auth = useAuthStore.getState();
  return auth.status === 'signedIn' && mayUseAssistant(auth.user);
};
const empty = { status: null, statusLoading: false, statusError: null, unavailable: false, messages: [], sending: false };

function stopAll() {
  generation++;
  statusRequest.cancel();
  question?.abort();
  question = null;
}

function errorMessage(error: any, fallback: string): string {
  const text = error?.response?.data?.message;
  return typeof text === 'string' && text.trim() ? text.trim().slice(0, 700) : fallback;
}

/** Session memory only. Nothing is written to device storage or sent to an AI provider directly. */
export const useAssistantStore = create<AssistantState>((set, get) => {
  const closed = () => !allowed() || !get().status?.enabled || get().unavailable
    || (get().status?.allowance?.remaining ?? 1) <= 0;

  async function put(history: AssistantMessage[], text: string): Promise<boolean> {
    if (closed() || get().sending) return false;
    const scope = generation, version = sessionVersion();
    const controller = question = new AbortController();
    const current = () => question === controller && !controller.signal.aborted
      && generation === scope && sessionVersion() === version && allowed() && !!get().status?.enabled;
    set({ messages: history.slice(-80), sending: true });
    try {
      const reply = await askAssistant(history, controller.signal);
      if (!current()) return true;
      allowanceRevision++;
      const status = get().status!;
      set({ status: reply.allowance ? { ...status, allowance: reply.allowance } : status,
        messages: [...get().messages, { id: nextId(), role: 'assistant' as const, text: reply.text,
          kind: reply.kind, sig: reply.sig, sources: reply.sources }].slice(-80) });
    } catch (error: any) {
      if (!current()) return true;
      const code = error?.response?.data?.code;
      if (error?.response?.status === 403 || code === 'ASSISTANT_OFF' || code === 'ASSISTANT_SWITCHED_OFF') {
        get().revoke();
        return true;
      }
      set({ messages: [...get().messages, { id: nextId(), role: 'assistant' as const, kind: 'error' as const, retry: text,
        text: errorMessage(error, `${get().status?.name || 'AI assistant'} is not available right now. Please try again in a few minutes.`) }].slice(-80) });
    } finally {
      if (question === controller) { question = null; set({ sending: false }); }
    }
    return true;
  }

  return {
    ...empty,
    fetchStatus: async () => {
      if (!allowed()) { get().reset(); return; }
      const scope = generation, version = sessionVersion(), revision = allowanceRevision;
      set({ statusLoading: true });
      try {
        const status = await statusRequest.run(getAssistantStatus);
        if (!status || scope !== generation || version !== sessionVersion() || !allowed()) return;
        if (!status.enabled) {
          stopAll();
          set({ ...empty, status });
          return;
        }
        const allowance = revision !== allowanceRevision ? get().status?.allowance : status.allowance;
        set({ status: { ...status, allowance }, statusError: null, unavailable: false });
      } catch (error: any) {
        if (scope !== generation || version !== sessionVersion() || !allowed()) return;
        if (error?.response?.status === 403 || error?.response?.status === 404) { get().revoke(); return; }
        set({ unavailable: true, statusError: errorMessage(error, 'Unable to connect. Please try again.') });
      } finally {
        if (scope === generation) set({ statusLoading: false });
      }
    },
    send: async text => {
      const clean = String(text || '').trim().slice(0, 500);
      if (!clean) return false;
      return put([...get().messages, { id: nextId(), role: 'user', text: clean }], clean);
    },
    retry: async id => {
      const index = get().messages.findIndex(message => message.id === id);
      const failed = get().messages[index];
      if (index < 0 || !failed.retry || failed.kind !== 'error') return false;
      return put(get().messages.slice(0, index), failed.retry);
    },
    cancel: () => {
      question?.abort();
      question = null;
      set({ sending: false });
    },
    newChat: () => { get().cancel(); set({ messages: [] }); },
    reset: () => { stopAll(); set({ ...empty }); },
    revoke: () => {
      const name = get().status?.name || 'AI assistant';
      stopAll();
      set({ ...empty, status: { name, enabled: false, reason: 'ACCESS_REMOVED' } });
    },
  };
});

function scopeKey(user: AuthUser | null): string {
  return JSON.stringify(user && [user.id, user.company_id, user.plant_id, user.auth_revision, user.is_snt_super,
    [...(user.roles ?? [])].sort(), [...(user.permissions ?? [])].sort(),
    Array.isArray(user.company_permissions) ? [...user.company_permissions].sort() : user.company_permissions]);
}

// Reset synchronously when refreshed access changes, including an auth revision
// with the same grants: signatures from an earlier authorization must not survive.
useAuthStore.subscribe((state, previous) => {
  if (state.status !== previous.status || scopeKey(state.user) !== scopeKey(previous.user)) {
    useAssistantStore.getState().reset();
  }
});

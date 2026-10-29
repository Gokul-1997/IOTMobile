import { apiClient } from './client';
import type { AssistantMessage, AssistantReply, AssistantStatus, AssistantTurn } from '../types/assistant';

export async function getAssistantStatus(signal?: AbortSignal): Promise<AssistantStatus> {
  const { data } = await apiClient.get<{ data: AssistantStatus }>('/assistant/status', { signal });
  return data.data;
}

/** Errors and local notes are never sent as signed conversation history. */
export function assistantTurns(messages: AssistantMessage[]): AssistantTurn[] {
  const turns: AssistantTurn[] = [];
  for (const message of messages) {
    if (message.kind === 'error' || message.kind === 'note' || !message.text) continue;
    const turn: AssistantTurn = message.role === 'assistant'
      ? { role: 'assistant', content: message.text, ...(message.sig ? { sig: message.sig } : {}) }
      : { role: 'user', content: message.text };
    if (turns.at(-1)?.role === turn.role) turns[turns.length - 1] = turn;
    else turns.push(turn);
  }
  // Match the server's bounded history; a conversation must start with a question.
  const recent = turns.slice(-12);
  while (recent.length && recent[0].role !== 'user') recent.shift();
  return recent;
}

/** Flag an answer as wrong or offensive, from inside the app (Google Play's AI content policy). */
export async function reportAnswer(answer: string, question?: string): Promise<void> {
  await apiClient.post('/assistant/report', { answer, question });
}

export async function askAssistant(messages: AssistantMessage[], signal?: AbortSignal): Promise<AssistantReply> {
  const { data } = await apiClient.post<{ data: AssistantReply }>('/assistant/chat', {
    messages: assistantTurns(messages),
  }, { signal, timeout: 190000 });
  return data.data;
}

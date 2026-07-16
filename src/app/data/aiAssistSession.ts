import {
  newAiAssistId,
  type AiAssistCandidateHistoryEntry,
  type AiAssistCreationType,
  type AiAssistEntryPage,
  type AiAssistGenerationSource,
  type AiAssistSession,
  type AiAssistStep,
  type CandidateDraft,
} from './aiAssistCreationTypes';

export function createAiAssistSession(
  entryPage: AiAssistEntryPage,
  creationType?: AiAssistCreationType,
): AiAssistSession {
  const type = creationType ?? (entryPage === 'goals' ? 'goal' : 'task');
  return {
    sessionId: newAiAssistId('aisess'),
    entryPage,
    creationType: type,
    brainDump: { text: '', updatedAt: Date.now() },
    requestSeq: 0,
    activeRequestId: null,
    candidates: null,
    history: [],
    selectedCandidateId: null,
    goalDraft: null,
    taskDraft: null,
    step: 'capture',
    dirty: false,
    createdIds: {},
  };
}

export function bumpRequest(session: AiAssistSession, requestId: string): AiAssistSession {
  return {
    ...session,
    requestSeq: session.requestSeq + 1,
    activeRequestId: requestId,
  };
}

export function acceptGeneration(
  session: AiAssistSession,
  opts: {
    requestId: string;
    creationType: AiAssistCreationType;
    source: AiAssistGenerationSource;
    candidates: CandidateDraft[];
  },
): AiAssistSession | null {
  if (session.activeRequestId !== opts.requestId) return null;
  if (session.creationType !== opts.creationType) return null;
  const titles = opts.candidates.map(c => c.title);
  const entry: AiAssistCandidateHistoryEntry = {
    requestId: opts.requestId,
    createdAt: Date.now(),
    creationType: opts.creationType,
    source: opts.source,
    titles,
  };
  return {
    ...session,
    candidates: opts.candidates,
    history: [...session.history, entry],
    selectedCandidateId: null,
    step: 'candidates',
    dirty: false,
    activeRequestId: null,
  };
}

export function priorTitles(session: AiAssistSession): string[] {
  return session.history.flatMap(h => h.titles);
}

export function resetHistoryForTypeChange(session: AiAssistSession, next: AiAssistCreationType): AiAssistSession {
  return {
    ...session,
    creationType: next,
    candidates: null,
    history: [],
    selectedCandidateId: null,
    goalDraft: null,
    taskDraft: null,
    step: 'capture',
    dirty: false,
    activeRequestId: null,
    requestSeq: session.requestSeq + 1,
  };
}

export function resetHistoryForDumpChange(session: AiAssistSession, text: string): AiAssistSession {
  return {
    ...session,
    brainDump: { text, updatedAt: Date.now() },
    candidates: null,
    history: [],
    selectedCandidateId: null,
    goalDraft: null,
    taskDraft: null,
    step: 'capture',
    dirty: false,
    activeRequestId: null,
    requestSeq: session.requestSeq + 1,
  };
}

export function setStep(session: AiAssistSession, step: AiAssistStep, dirty = session.dirty): AiAssistSession {
  return { ...session, step, dirty };
}

export function invalidateInFlight(session: AiAssistSession): AiAssistSession {
  return {
    ...session,
    requestSeq: session.requestSeq + 1,
    activeRequestId: null,
  };
}

export type StageTimerStatus = 'idle' | 'running' | 'paused' | 'completed';

export interface StageTimerNote {
  id: string;
  timerId: string;
  body: string;
  createdAt: string;
}

export interface StageTimerUrgentNote {
  id: string;
  timerId: string;
  body: string;
  createdAt: string;
  acknowledgedAt: string | null;
}

export interface StageTimer {
  id: string;
  orgSlug: string;
  sceneId: string;
  name: string;
  durationSeconds: number;
  remainingSeconds: number;
  status: StageTimerStatus;
  code: string;
  startAt: string | null;
  endAt: string | null;
  createdAt: string;
  updatedAt: string;
  notes: StageTimerNote[];
  urgentNote: StageTimerUrgentNote | null;
}

export interface CreateStageTimerPayload {
  name: string;
  durationMinutes: number;
  durationSeconds: number;
  sceneId?: string;
}

export interface StageTimerSnapshot {
  timers: StageTimer[];
}

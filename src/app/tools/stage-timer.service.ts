import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { SupabaseService } from '../shared/supabase-service/supabase.service';
import { environment } from '../../environments/environment';
import {
  CreateStageTimerPayload,
  StageTimer,
  StageTimerNote,
  StageTimerSnapshot,
  StageTimerStatus,
  StageTimerUrgentNote,
} from './stage-timer.models';

interface EdgeResponse<T> {
  data?: T;
  timers?: StageTimer[];
  timer?: StageTimer;
  note?: StageTimerNote;
  urgentNote?: StageTimerUrgentNote | null;
}

@Injectable({ providedIn: 'root' })
export class StageTimerService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly authService = inject(AuthService);

  private readonly edgeFunctionName = environment.stageTimerEdgeFunction;
  private readonly timersSubject = new BehaviorSubject<StageTimer[]>([]);
  private readonly tickers = new Map<string, number>();
  private hasLoaded = false;

  readonly timers$ = this.timersSubject.asObservable();

  constructor() {
    const snapshot = this.readSnapshotFromStorage();
    if (snapshot) {
      this.applySnapshot(snapshot);
    }
  }

  get orgSlug(): string {
    return this.authService.orgSlug || environment.defaultOrgSlug;
  }

  async loadTimers(): Promise<void> {
    if (this.hasLoaded) return;
    this.hasLoaded = true;

    const remote = await this.fetchFromEdge();
    if (remote && remote.length) {
      this.applySnapshot({ timers: remote });
    }
  }

  async createTimer(payload: CreateStageTimerPayload): Promise<StageTimer> {
    await this.loadTimers();

    const durationSeconds = Math.max(
      0,
      payload.durationMinutes * 60 + payload.durationSeconds,
    );
    const now = new Date().toISOString();
    const timer: StageTimer = {
      id: this.generateId(),
      orgSlug: this.orgSlug,
      sceneId: payload.sceneId ?? 'master',
      name: payload.name.trim() || 'Untitled Timer',
      durationSeconds,
      remainingSeconds: durationSeconds,
      status: 'idle',
      code: this.generateCode(),
      startAt: null,
      endAt: null,
      createdAt: now,
      updatedAt: now,
      notes: [],
      urgentNote: null,
    };

    this.upsertTimer(timer);
    await this.persistTimerToEdge(timer, 'create_timer');
    return timer;
  }

  async startTimer(timerId: string): Promise<void> {
    const updated = await this.updateTimer(timerId, (timer) => {
      if (timer.status === 'running') return timer;
      const now = new Date().toISOString();
      return {
        ...timer,
        status: 'running',
        startAt: timer.startAt ?? now,
        updatedAt: now,
      };
    });
    if (updated) {
      this.startTicker(updated.id);
      await this.persistTimerToEdge(updated, 'update_timer');
    }
  }

  async pauseTimer(timerId: string): Promise<void> {
    this.stopTicker(timerId);
    const updated = await this.updateTimer(timerId, (timer) => {
      if (timer.status !== 'running') return timer;
      return {
        ...timer,
        status: 'paused',
        updatedAt: new Date().toISOString(),
      };
    });
    if (updated) {
      await this.persistTimerToEdge(updated, 'update_timer');
    }
  }

  async resetTimer(timerId: string): Promise<void> {
    this.stopTicker(timerId);
    const updated = await this.updateTimer(timerId, (timer) => ({
      ...timer,
      status: 'idle',
      remainingSeconds: timer.durationSeconds,
      startAt: null,
      endAt: null,
      updatedAt: new Date().toISOString(),
    }));
    if (updated) {
      await this.persistTimerToEdge(updated, 'update_timer');
    }
  }

  async completeTimer(timerId: string): Promise<void> {
    this.stopTicker(timerId);
    const updated = await this.updateTimer(timerId, (timer) => ({
      ...timer,
      status: 'completed',
      remainingSeconds: 0,
      endAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    if (updated) {
      await this.persistTimerToEdge(updated, 'update_timer');
    }
  }

  async deleteTimer(timerId: string): Promise<void> {
    this.stopTicker(timerId);
    const timers = this.timersSubject.getValue();
    const next = timers.filter((timer) => timer.id !== timerId);
    if (next.length === timers.length) return;
    this.timersSubject.next(next);
    this.persistSnapshot();
    await this.invokeEdge('delete_timer', { timerId });
  }

  async addNote(timerId: string, body: string): Promise<StageTimerNote | null> {
    const trimmed = body.trim();
    if (!trimmed) return null;

    const note: StageTimerNote = {
      id: this.generateId(),
      timerId,
      body: trimmed,
      createdAt: new Date().toISOString(),
    };

    const updated = await this.updateTimer(timerId, (timer) => ({
      ...timer,
      notes: [...timer.notes, note],
      updatedAt: note.createdAt,
    }));

    if (updated) {
      await this.invokeEdge('add_note', { timerId, note });
      return note;
    }
    return null;
  }

  async addUrgentNote(
    timerId: string,
    body: string,
  ): Promise<StageTimerUrgentNote | null> {
    const trimmed = body.trim();
    if (!trimmed) return null;

    const urgentNote: StageTimerUrgentNote = {
      id: this.generateId(),
      timerId,
      body: trimmed,
      createdAt: new Date().toISOString(),
      acknowledgedAt: null,
    };

    const updated = await this.updateTimer(timerId, (timer) => ({
      ...timer,
      urgentNote,
      updatedAt: urgentNote.createdAt,
    }));

    if (updated) {
      await this.invokeEdge('add_urgent_note', { timerId, urgentNote });
      return urgentNote;
    }
    return null;
  }

  async acknowledgeUrgentNote(timerId: string): Promise<void> {
    const updated = await this.updateTimer(timerId, (timer) => {
      if (!timer.urgentNote) return timer;
      return {
        ...timer,
        urgentNote: {
          ...timer.urgentNote,
          acknowledgedAt: new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
      };
    });

    if (updated && updated.urgentNote) {
      await this.invokeEdge('acknowledge_urgent_note', {
        timerId,
        urgentNoteId: updated.urgentNote.id,
      });
    }
  }

  async clearUrgentNote(timerId: string): Promise<void> {
    const updated = await this.updateTimer(timerId, (timer) => ({
      ...timer,
      urgentNote: null,
      updatedAt: new Date().toISOString(),
    }));

    if (updated) {
      await this.invokeEdge('clear_urgent_note', { timerId });
    }
  }

  timerByCode$(code: string): Observable<StageTimer | null> {
    return this.timers$.pipe(
      map((timers) =>
        timers.find((timer) =>
          timer.code.toLowerCase() === code.toLowerCase()
        ) ?? null,
      ),
    );
  }

  getTimerByCode(code: string): StageTimer | null {
    const timers = this.timersSubject.getValue();
    return (
      timers.find((timer) => timer.code.toLowerCase() === code.toLowerCase()) ||
      null
    );
  }

  stopTicker(timerId: string): void {
    const handle = this.tickers.get(timerId);
    if (handle) {
      clearInterval(handle);
      this.tickers.delete(timerId);
    }
  }

  private async fetchFromEdge(): Promise<StageTimer[] | null> {
    if (!this.edgeFunctionName) return null;
    const payload = await this.invokeEdge<StageTimerSnapshot>('list', {});
    if (!payload) return null;

    if (Array.isArray(payload.timers)) {
      return payload.timers.map((timer) => this.withDefaults(timer));
    }
    if (Array.isArray((payload as unknown as StageTimer[]))) {
      return (payload as unknown as StageTimer[]).map((timer) =>
        this.withDefaults(timer)
      );
    }
    return null;
  }

  private applySnapshot(snapshot: StageTimerSnapshot): void {
    const timers = (snapshot.timers ?? []).map((timer) =>
      this.withDefaults(timer),
    );
    this.timersSubject.next(timers);
    this.persistSnapshot();
  }

  private withDefaults(timer: StageTimer): StageTimer {
    return {
      ...timer,
      orgSlug: timer.orgSlug || this.orgSlug,
      sceneId: timer.sceneId || 'master',
      name: timer.name || 'Untitled Timer',
      durationSeconds: timer.durationSeconds ?? timer.remainingSeconds ?? 0,
      remainingSeconds:
        timer.remainingSeconds ?? timer.durationSeconds ?? 0,
      status: (timer.status as StageTimerStatus) || 'idle',
      code: timer.code || this.generateCode(),
      startAt: timer.startAt ?? null,
      endAt: timer.endAt ?? null,
      createdAt: timer.createdAt ?? new Date().toISOString(),
      updatedAt: timer.updatedAt ?? new Date().toISOString(),
      notes: Array.isArray(timer.notes)
        ? timer.notes.map((note) => ({ ...note }))
        : [],
      urgentNote: timer.urgentNote
        ? { ...timer.urgentNote }
        : null,
    };
  }

  private upsertTimer(timer: StageTimer): void {
    const timers = this.timersSubject.getValue();
    const index = timers.findIndex((item) => item.id === timer.id);
    const next = [...timers];
    if (index >= 0) {
      next[index] = timer;
    } else {
      next.push(timer);
    }
    this.timersSubject.next(next);
    this.persistSnapshot();
  }

  private async updateTimer(
    timerId: string,
    mutator: (timer: StageTimer) => StageTimer,
  ): Promise<StageTimer | null> {
    const timers = this.timersSubject.getValue();
    const index = timers.findIndex((timer) => timer.id === timerId);
    if (index === -1) return null;
    const current = this.cloneTimer(timers[index]);
    const updated = this.withDefaults(mutator(current));
    const next = [...timers];
    next[index] = updated;
    this.timersSubject.next(next);
    this.persistSnapshot();
    return updated;
  }

  private startTicker(timerId: string): void {
    this.stopTicker(timerId);
    const scheduler =
      typeof window !== 'undefined' && typeof window.setInterval === 'function'
        ? window.setInterval.bind(window)
        : setInterval;
    const handle = scheduler(() => {
      this.tick(timerId);
    }, 1000);
    this.tickers.set(timerId, handle as unknown as number);
  }

  private tick(timerId: string): void {
    const timers = this.timersSubject.getValue();
    const index = timers.findIndex((timer) => timer.id === timerId);
    if (index === -1) {
      this.stopTicker(timerId);
      return;
    }

    const timer = timers[index];
    if (timer.status !== 'running') {
      this.stopTicker(timerId);
      return;
    }

    const remaining = Math.max(0, timer.remainingSeconds - 1);
    const updated: StageTimer = {
      ...timer,
      remainingSeconds: remaining,
      status: remaining === 0 ? 'completed' : timer.status,
      endAt:
        remaining === 0 && !timer.endAt
          ? new Date().toISOString()
          : timer.endAt,
      updatedAt: new Date().toISOString(),
    };

    const next = [...timers];
    next[index] = updated;
    this.timersSubject.next(next);
    this.persistSnapshot();

    if (remaining === 0) {
      this.stopTicker(timerId);
      void this.persistTimerToEdge(updated, 'update_timer');
    }
  }

  private persistSnapshot(): void {
    if (typeof window === 'undefined') return;
    try {
      const snapshot: StageTimerSnapshot = {
        timers: this.timersSubject.getValue(),
      };
      window.localStorage.setItem(
        this.storageKey(),
        JSON.stringify(snapshot),
      );
    } catch (error) {
      console.warn('Unable to persist stage timer snapshot', error);
    }
  }

  private readSnapshotFromStorage(): StageTimerSnapshot | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(this.storageKey());
      if (!raw) return null;
      return JSON.parse(raw) as StageTimerSnapshot;
    } catch (error) {
      console.warn('Unable to read stage timer snapshot', error);
      return null;
    }
  }

  private storageKey(): string {
    return `stage-timers:${this.orgSlug}`;
  }

  private cloneTimer(timer: StageTimer): StageTimer {
    return {
      ...timer,
      notes: timer.notes.map((note) => ({ ...note })),
      urgentNote: timer.urgentNote ? { ...timer.urgentNote } : null,
    };
  }

  private generateCode(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    do {
      code = Array.from({ length: 5 })
        .map(
          () => alphabet[Math.floor(Math.random() * alphabet.length)] ?? 'A',
        )
        .join('');
    } while (this.timersSubject.getValue().some((timer) => timer.code === code));
    return code;
  }

  private generateId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return Math.random().toString(36).slice(2);
  }

  private async persistTimerToEdge(
    timer: StageTimer,
    action: 'create_timer' | 'update_timer',
  ): Promise<void> {
    await this.invokeEdge(action, { timer });
  }

  private async invokeEdge<T = EdgeResponse<unknown>>(
    action: string,
    body: Record<string, unknown>,
  ): Promise<T | null> {
    if (!this.edgeFunctionName) return null;
    try {
      const { data, error } = await this.supabaseService.client.functions.invoke(
        this.edgeFunctionName,
        {
          body: { action, ...body },
          headers: this.orgHeaders(),
        },
      );
      if (error) throw error;
      return data as T;
    } catch (error) {
      console.warn(`Stage timer edge function ${action} failed`, error);
      return null;
    }
  }

  private orgHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.orgSlug) {
      headers['x-org-slug'] = this.orgSlug;
    }
    return headers;
  }
}

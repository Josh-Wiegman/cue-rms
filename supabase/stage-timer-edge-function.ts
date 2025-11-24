// Supabase Edge Function for Stage Timer operations.
// Deploy as functions/stage-timer/index.ts in your Supabase project.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-org-slug',
};

type TimerRow = {
  id: string;
  org_slug: string;
  scene_id: string;
  name: string;
  duration_seconds: number;
  remaining_seconds: number;
  status: string;
  code: string;
  start_at: string | null;
  end_at: string | null;
  created_at: string;
  updated_at: string;
  notes?: NoteRow[];
};

type NoteRow = {
  id: string;
  org_slug: string;
  timer_id: string;
  body: string;
  is_urgent: boolean;
  created_at: string;
  acknowledged_at: string | null;
};

type StageTimerPayload = {
  id: string;
  sceneId?: string;
  name?: string;
  durationSeconds?: number;
  remainingSeconds?: number;
  status?: string;
  code: string;
  startAt?: string | null;
  endAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type StageTimerNotePayload = {
  id: string;
  body: string;
  createdAt?: string;
  acknowledgedAt?: string | null;
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.warn('Supabase environment variables are not set for stage-timer edge.');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as Record<string, unknown>;
    const rawAction = payload['action'];
    if (typeof rawAction !== 'string') {
      return json({ error: 'Action is required' }, 400);
    }
    const action = rawAction;
    const orgSlug = (req.headers.get('x-org-slug') ?? 'public').toLowerCase();

    const client = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    await ensureMasterScene(client, orgSlug);

    let result: unknown = { ok: true };

    switch (action) {
      case 'list':
        result = await listTimers(client, orgSlug);
        break;
      case 'create_timer':
        result = await upsertTimer(
          client,
          orgSlug,
          (payload['timer'] as StageTimerPayload | undefined) ?? null,
        );
        break;
      case 'update_timer':
        result = await upsertTimer(
          client,
          orgSlug,
          (payload['timer'] as StageTimerPayload | undefined) ?? null,
        );
        break;
      case 'delete_timer':
        result = await deleteTimer(
          client,
          orgSlug,
          (payload['timerId'] as string | undefined) ?? '',
        );
        break;
      case 'add_note':
        result = await addNote(
          client,
          orgSlug,
          (payload['timerId'] as string | undefined) ?? '',
          (payload['note'] as StageTimerNotePayload | undefined) ?? null,
          false,
        );
        break;
      case 'add_urgent_note':
        result = await addNote(
          client,
          orgSlug,
          (payload['timerId'] as string | undefined) ?? '',
          (payload['urgentNote'] as StageTimerNotePayload | undefined) ?? null,
          true,
        );
        break;
      case 'acknowledge_urgent_note':
        result = await acknowledgeUrgentNote(
          client,
          orgSlug,
          (payload['timerId'] as string | undefined) ?? '',
          (payload['urgentNoteId'] as string | undefined) ?? '',
        );
        break;
      case 'clear_urgent_note':
        result = await clearUrgentNotes(
          client,
          orgSlug,
          (payload['timerId'] as string | undefined) ?? '',
        );
        break;
      default:
        return json({ error: `Unsupported action: ${action}` }, 400);
    }

    return json(result ?? { ok: true });
  } catch (error) {
    console.error('Stage timer edge error', error);
    return json({ error: error?.message ?? 'Unexpected error' }, 500);
  }
}, { addr: ':8000' });

async function ensureMasterScene(client: ReturnType<typeof createClient>, orgSlug: string) {
  const { error } = await client.rpc('ensure_stage_timer_master_scene', {
    target_org: orgSlug,
  });
  if (error) {
    console.error('Failed to ensure master scene', error);
  }
}

async function listTimers(client: ReturnType<typeof createClient>, orgSlug: string) {
  const { data, error } = await client
    .from('stage_timer_timers')
    .select(
      `id, org_slug, scene_id, name, duration_seconds, remaining_seconds, status, code, start_at, end_at, created_at, updated_at,
        notes:stage_timer_notes (id, org_slug, timer_id, body, is_urgent, created_at, acknowledged_at)`,
    )
    .eq('org_slug', orgSlug)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const timers = (data ?? []).map((row) => mapTimer(row as TimerRow));
  return { timers };
}

async function upsertTimer(
  client: ReturnType<typeof createClient>,
  orgSlug: string,
  timer: StageTimerPayload | null,
) {
  if (!timer) return { ok: true };

  const payload = {
    id: timer.id,
    org_slug: orgSlug,
    scene_id: timer.sceneId ?? (await getMasterSceneId(client, orgSlug)),
    name: timer.name ?? 'Untitled Timer',
    duration_seconds: timer.durationSeconds ?? 0,
    remaining_seconds: timer.remainingSeconds ?? timer.durationSeconds ?? 0,
    status: timer.status ?? 'idle',
    code: timer.code,
    start_at: timer.startAt ?? null,
    end_at: timer.endAt ?? null,
    created_at: timer.createdAt ?? new Date().toISOString(),
    updated_at: timer.updatedAt ?? new Date().toISOString(),
  };

  const { data, error } = await client
    .from('stage_timer_timers')
    .upsert(payload, { onConflict: 'id' })
    .select(
      `id, org_slug, scene_id, name, duration_seconds, remaining_seconds, status, code, start_at, end_at, created_at, updated_at,
        notes:stage_timer_notes (id, org_slug, timer_id, body, is_urgent, created_at, acknowledged_at)`,
    )
    .eq('org_slug', orgSlug)
    .eq('id', payload.id)
    .single();

  if (error) throw error;
  return { timer: mapTimer(data as TimerRow) };
}

async function deleteTimer(
  client: ReturnType<typeof createClient>,
  orgSlug: string,
  timerId: string,
) {
  if (!timerId) return { ok: true };
  const { error } = await client
    .from('stage_timer_timers')
    .delete()
    .eq('org_slug', orgSlug)
    .eq('id', timerId);
  if (error) throw error;
  return { ok: true };
}

async function addNote(
  client: ReturnType<typeof createClient>,
  orgSlug: string,
  timerId: string,
  note: StageTimerNotePayload | null,
  isUrgent: boolean,
) {
  if (!timerId || !note) return { ok: true };
  const payload = {
    id: note.id,
    org_slug: orgSlug,
    timer_id: timerId,
    body: note.body,
    is_urgent: isUrgent,
    created_at: note.createdAt ?? new Date().toISOString(),
    acknowledged_at: note.acknowledgedAt ?? null,
  };

  const { data, error } = await client
    .from('stage_timer_notes')
    .upsert(payload, { onConflict: 'id' })
    .select('id, org_slug, timer_id, body, is_urgent, created_at, acknowledged_at')
    .single();

  if (error) throw error;

  if (isUrgent) {
    return { urgentNote: mapUrgent(data as NoteRow) };
  }

  return { note: mapNote(data as NoteRow) };
}

async function acknowledgeUrgentNote(
  client: ReturnType<typeof createClient>,
  orgSlug: string,
  timerId: string,
  urgentNoteId: string,
) {
  if (!timerId || !urgentNoteId) return { ok: true };
  const { data, error } = await client
    .from('stage_timer_notes')
    .update({ acknowledged_at: new Date().toISOString() })
    .eq('org_slug', orgSlug)
    .eq('timer_id', timerId)
    .eq('id', urgentNoteId)
    .eq('is_urgent', true)
    .select('id, org_slug, timer_id, body, is_urgent, created_at, acknowledged_at')
    .single();

  if (error) throw error;
  return { urgentNote: mapUrgent(data as NoteRow) };
}

async function clearUrgentNotes(
  client: ReturnType<typeof createClient>,
  orgSlug: string,
  timerId: string,
) {
  if (!timerId) return { ok: true };
  const { error } = await client
    .from('stage_timer_notes')
    .update({ acknowledged_at: new Date().toISOString() })
    .eq('org_slug', orgSlug)
    .eq('timer_id', timerId)
    .eq('is_urgent', true)
    .is('acknowledged_at', null);
  if (error) throw error;
  return { ok: true };
}

async function getMasterSceneId(
  client: ReturnType<typeof createClient>,
  orgSlug: string,
): Promise<string> {
  const { data, error } = await client
    .from('stage_timer_scenes')
    .select('id')
    .eq('org_slug', orgSlug)
    .eq('is_master', true)
    .single();
  if (error) throw error;
  return data?.id as string;
}

function mapTimer(row: TimerRow) {
  const notes = (row.notes ?? []).filter((note) => !note.is_urgent);
  const urgentNotes = (row.notes ?? [])
    .filter((note) => note.is_urgent)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return {
    id: row.id,
    orgSlug: row.org_slug,
    sceneId: row.scene_id,
    name: row.name,
    durationSeconds: row.duration_seconds,
    remainingSeconds: row.remaining_seconds,
    status: row.status,
    code: row.code,
    startAt: row.start_at,
    endAt: row.end_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    notes: notes.map((note) => mapNote(note)),
    urgentNote: urgentNotes.length ? mapUrgent(urgentNotes[0]) : null,
  };
}

function mapNote(note: NoteRow) {
  return {
    id: note.id,
    timerId: note.timer_id,
    body: note.body,
    createdAt: note.created_at,
  };
}

function mapUrgent(note: NoteRow) {
  return {
    id: note.id,
    timerId: note.timer_id,
    body: note.body,
    createdAt: note.created_at,
    acknowledgedAt: note.acknowledged_at,
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

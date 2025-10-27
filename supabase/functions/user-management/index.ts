import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.3/mod.js";

/* =========================
 * Environment
 * ========================= */
const DATABASE_URL = Deno.env.get("SUPABASE_DB_URL");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ADMIN_SECRET = Deno.env.get("ADMIN_SECRET");
const BASE_TENANT_DOMAIN = Deno.env.get("BASE_TENANT_DOMAIN") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const INVITE_EMAIL_FROM = Deno.env.get("INVITE_EMAIL_FROM") ?? "";
const INVITE_EMAIL_REPLY_TO = Deno.env.get("INVITE_EMAIL_REPLY_TO") ?? "";

const DEFAULT_SCHEMA = "public";
const DEFAULT_ORG_ID = "public";

if (!DATABASE_URL) throw new Error("SUPABASE_DB_URL is not set.");
if (!SUPABASE_URL) throw new Error("SUPABASE_URL is not set.");
if (!ANON_KEY) throw new Error("SUPABASE_ANON_KEY is not set.");

/* =========================
 * Helpers – HTTP
 * ========================= */
function buildCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "*";
  const reqHeaders = req.headers.get("access-control-request-headers");
  const allowHeaders = reqHeaders
    ? reqHeaders
    : "authorization, apikey, x-client-info, content-type, x-admin-secret, x-org-slug";
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": allowHeaders,
    "access-control-max-age": "86400",
    "vary": "origin, access-control-request-headers",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...buildCorsHeaders(req),
    },
  });
}

/* =========================
 * Helpers – org resolution
 * ========================= */
function orgSchemaFromId(orgId: string) {
  const prefix = orgId.replace(/-/g, "").slice(0, 8);
  return `org_${prefix}`;
}

function parseHeaderUrl(value: string | null) {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

function subdomainFromHost(hostname: string, baseDomain: string) {
  const host = hostname.toLowerCase();
  const base = baseDomain.toLowerCase();
  if (!host.endsWith(base)) return null;
  let remainder = host.slice(0, host.length - base.length);
  if (remainder.endsWith(".")) remainder = remainder.slice(0, -1);
  if (!remainder) return null;
  const [slug] = remainder.split(".").filter(Boolean);
  return slug ?? null;
}

async function lookupOrgIdBySlug(client: any, slug: string) {
  try {
    const rows = await client`
      select id
      from public.organisations
      where slug = ${slug}
      limit 1
    `;
    if (rows.length === 0) return null;
    return rows[0].id as string;
  } catch (error) {
    console.warn("Organisation lookup failed", error);
    return null;
  }
}

async function resolveOrgIdFromReq(client: any, req: Request, body: Record<string, unknown>) {
  const fallback = { orgId: DEFAULT_ORG_ID, schema: DEFAULT_SCHEMA };

  const bodyOrgId = typeof body?.org_id === "string" ? body.org_id : null;
  if (bodyOrgId) {
    return { orgId: bodyOrgId, schema: orgSchemaFromId(bodyOrgId) };
  }

  const bodySlug = typeof body?.org_slug === "string" ? body.org_slug : null;
  if (bodySlug) {
    const orgId = await lookupOrgIdBySlug(client, bodySlug);
    if (!orgId) throw new Error("org not found (slug)");
    return { orgId, schema: orgSchemaFromId(orgId) };
  }

  const bodyOrgSlug = typeof body?.orgSlug === "string" ? body.orgSlug : null;
  if (bodyOrgSlug) {
    const orgId = await lookupOrgIdBySlug(client, bodyOrgSlug);
    if (!orgId) throw new Error("org not found (orgSlug)");
    return { orgId, schema: orgSchemaFromId(orgId) };
  }

  const headerSlug = req.headers.get("x-org-slug");
  if (headerSlug) {
    const orgId = await lookupOrgIdBySlug(client, headerSlug);
    if (!orgId) throw new Error("org not found (header slug)");
    return { orgId, schema: orgSchemaFromId(orgId) };
  }

  if (!BASE_TENANT_DOMAIN) return fallback;

  const origin =
    parseHeaderUrl(req.headers.get("origin")) ?? parseHeaderUrl(req.headers.get("referer"));
  if (!origin) throw new Error("cannot infer org: provide org_id/org_slug or send an Origin/Referer");
  const slug = subdomainFromHost(origin.hostname, BASE_TENANT_DOMAIN);
  if (!slug) throw new Error("origin host not under tenant base domain");
  if (!SLUG_RE.test(slug)) throw new Error("invalid subdomain slug");
  const orgId = await lookupOrgIdBySlug(client, slug);
  if (!orgId) throw new Error("org not found (from subdomain)");
  return { orgId, schema: orgSchemaFromId(orgId) };
}

/* =========================
 * Helpers – request parsing
 * ========================= */
async function parseJsonBody(req: Request) {
  const text = await req.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("invalid JSON body");
  }
}

function getActionAndPayload(raw: Record<string, unknown>) {
  const action = typeof raw?.action === "string" ? raw.action : "login";
  const payload = raw?.payload && typeof raw.payload === "object" ? raw.payload : raw || {};
  return { action, payload };
}

/* =========================
 * Helpers – validation
 * ========================= */
function validEmail(value: unknown): value is string {
  return typeof value === "string" && value.includes("@");
}

function validPassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= 8;
}

function normaliseDisplayName(value: unknown, fallback: string) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed : fallback;
}

/* =========================
 * Supabase helpers
 * ========================= */
async function authPasswordGrant(email: string, password: string) {
  const url = `${SUPABASE_URL}/auth/v1/token?grant_type=password`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: ANON_KEY!,
    },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

interface InvitationBranding {
  name: string;
  logoUrl: string | null;
}

interface InvitationDetails {
  sendEmail: boolean;
  message?: string;
  organisation: InvitationBranding;
  resetPasswordRedirect: string;
  invitedBy?: { displayName: string; email?: string };
}

interface InvitePayload {
  email: string;
  displayName?: string;
  permissionLevel?: number;
  role?: string;
  invitation?: InvitationDetails;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderInvitationEmail(params: {
  inviteeEmail: string;
  displayName: string;
  organisation: InvitationBranding;
  invitedBy?: { displayName: string; email?: string };
  message?: string;
  resetLink: string;
}) {
  const subject = `You\'ve been invited to ${params.organisation.name}`;
  const safeMessage = params.message ? escapeHtml(params.message) : null;
  const inviter = params.invitedBy
    ? `${escapeHtml(params.invitedBy.displayName)}${
        params.invitedBy.email ? ` (${escapeHtml(params.invitedBy.email)})` : ""
      }`
    : null;

  const htmlParts: string[] = [];
  htmlParts.push(`<!doctype html>`);
  htmlParts.push(`<html lang="en">`);
  htmlParts.push(`<head><meta charset="utf-8"><title>${subject}</title></head>`);
  htmlParts.push(`<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #f5f5f7; margin: 0; padding: 24px;">`);
  htmlParts.push(`<table role="presentation" style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);">`);
  if (params.organisation.logoUrl) {
    const logo = escapeHtml(params.organisation.logoUrl);
    htmlParts.push(`<tr><td style="padding: 32px 32px 0; text-align: center;"><img src="${logo}" alt="${escapeHtml(params.organisation.name)}" style="max-height: 64px; width: auto;" /></td></tr>`);
  }
  htmlParts.push(`<tr><td style="padding: 32px; color: #0f172a;">`);
  htmlParts.push(`<h1 style="margin-top: 0; font-size: 24px; font-weight: 600;">${escapeHtml(params.organisation.name)} has invited you</h1>`);
  htmlParts.push(`<p style="font-size: 16px; line-height: 1.5; margin-bottom: 24px;">Hello ${escapeHtml(params.displayName)},<br/>You've been invited to join ${escapeHtml(params.organisation.name)}'s workspace. Use the button below to set your password and get started.</p>`);
  if (safeMessage) {
    htmlParts.push(`<blockquote style="margin: 0 0 24px; padding: 16px 20px; background: #f8fafc; border-left: 4px solid #3b82f6; color: #1f2937; border-radius: 8px;">${safeMessage}</blockquote>`);
  }
  if (inviter) {
    htmlParts.push(`<p style="font-size: 14px; color: #475569; margin-bottom: 24px;">Invitation sent by ${inviter}</p>`);
  }
  htmlParts.push(`<p style="text-align: center; margin: 0 0 32px;"><a href="${escapeHtml(params.resetLink)}" style="display: inline-block; padding: 14px 28px; background: #2563eb; color: #ffffff; font-weight: 600; text-decoration: none; border-radius: 999px;">Set your password</a></p>`);
  htmlParts.push(`<p style="font-size: 13px; color: #6b7280;">If the button doesn't work, copy and paste this link into your browser:<br/><a href="${escapeHtml(params.resetLink)}" style="color: #2563eb;">${escapeHtml(params.resetLink)}</a></p>`);
  htmlParts.push(`</td></tr>`);
  htmlParts.push(`<tr><td style="padding: 24px 32px; background: #0f172a; color: #e2e8f0; font-size: 12px;">You're receiving this because you were invited to join ${escapeHtml(params.organisation.name)}. If you weren't expecting this, you can ignore this message.</td></tr>`);
  htmlParts.push(`</table></body></html>`);

  const textLines: string[] = [];
  textLines.push(`Hello ${params.displayName},`);
  textLines.push(``);
  textLines.push(`You've been invited to join ${params.organisation.name}.`);
  if (params.message) {
    textLines.push(``);
    textLines.push(`Message from the team:`);
    textLines.push(params.message);
  }
  if (params.invitedBy) {
    textLines.push(``);
    textLines.push(`Invitation sent by ${params.invitedBy.displayName}${
      params.invitedBy.email ? ` (${params.invitedBy.email})` : ""
    }.`);
  }
  textLines.push(``);
  textLines.push(`Use this link to set your password: ${params.resetLink}`);
  textLines.push(``);
  textLines.push(`If you weren't expecting this email you can ignore it.`);

  return {
    subject,
    html: htmlParts.join(""),
    text: textLines.join("\n"),
  };
}

async function sendInvitationEmail(params: {
  inviteeEmail: string;
  displayName: string;
  organisation: InvitationBranding;
  invitedBy?: { displayName: string; email?: string };
  message?: string;
  resetLink: string;
}) {
  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  if (!INVITE_EMAIL_FROM) {
    throw new Error("INVITE_EMAIL_FROM is not configured");
  }

  const payload = renderInvitationEmail(params);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: INVITE_EMAIL_FROM,
      to: params.inviteeEmail,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      reply_to: INVITE_EMAIL_REPLY_TO || undefined,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`failed to send invitation email: ${res.status} ${errorBody}`);
  }
}

/* =========================
 * Handlers
 * ========================= */
async function handleLogin(args: {
  body: Record<string, unknown>;
  sql: any;
  schema: string;
  orgId: string;
  req: Request;
}) {
  const { body, sql, schema, orgId, req } = args;
  const email = body?.email;
  const password = body?.password;
  if (!validEmail(email)) return json(req, { error: "invalid email" }, 400);
  if (!validPassword(password)) return json(req, { error: "invalid password" }, 400);

  const { ok, status, body: auth } = await authPasswordGrant(email, password);
  if (!ok) {
    const message = auth?.error_description ?? auth?.error ?? "authentication failed";
    return json(
      req,
      {
        ok: false,
        error: message,
        code: status,
        org_id: orgId,
        schema,
      },
      status === 400 || status === 401 ? status : 401,
    );
  }

  const access_token = auth?.access_token;
  const refresh_token = auth?.refresh_token;
  const user = auth?.user;
  if (!access_token || !refresh_token || !user?.id) {
    return json(
      req,
      {
        ok: false,
        error: "invalid auth response",
        org_id: orgId,
        schema,
      },
      500,
    );
  }

  const membershipRows = await sql`
    select permission_level, role
    from ${sql(schema)}.org_users
    where user_id = ${user.id}::uuid
    limit 1
  `;
  if (membershipRows.length === 0) {
    return json(
      req,
      {
        ok: false,
        error: "not a member of this organization",
        org_id: orgId,
        schema,
      },
      403,
    );
  }
  const membership = membershipRows[0];

  const profileRows = await sql`
    select display_name, permission_level
    from public.user_profiles
    where id = ${user.id}::uuid
    limit 1
  `;
  const profile = profileRows[0] ?? null;

  return json(req, {
    ok: true,
    org_id: orgId,
    schema,
    user: {
      id: user.id,
      email: user.email,
      displayName: profile?.display_name ?? user.email ?? "Unknown user",
      permissionLevel: profile?.permission_level ?? membership.permission_level,
      role: membership.role,
    },
    session: {
      access_token,
      refresh_token,
      expires_in: auth?.expires_in ?? null,
      token_type: auth?.token_type ?? "bearer",
    },
  });
}

async function createSupabaseUser(params: { email: string; password?: string }) {
  if (!SERVICE_ROLE_KEY) {
    throw new Error("server misconfigured: no service role key");
  }

  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: SERVICE_ROLE_KEY,
      authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      email: params.email,
      password: params.password,
      email_confirm: true,
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body?.id) {
    const msg = body?.message ?? body?.error_description ?? body?.error ?? "failed to create user";
    const error = new Error(msg);
    (error as any).status = res.status;
    throw error;
  }

  return body;
}

async function generateResetLink(email: string, redirect?: string) {
  if (!SERVICE_ROLE_KEY) {
    throw new Error("server misconfigured: no service role key");
  }

  const payload: Record<string, unknown> = {
    type: "recovery",
    email,
  };
  if (redirect) payload.redirect_to = redirect;

  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: SERVICE_ROLE_KEY,
      authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.message ?? body?.error_description ?? body?.error ?? "failed to generate reset link";
    throw new Error(msg);
  }

  const link = body?.action_link ?? body?.properties?.action_link;
  if (typeof link !== "string" || link.length === 0) {
    throw new Error("reset link missing from Supabase response");
  }

  return { link, expiresAt: body?.expires_at ?? null };
}

async function seedOrgMembership(sql: any, schema: string, params: {
  userId: string;
  permissionLevel: number;
  role: string;
}) {
  await sql`
    insert into ${sql(schema)}.org_users (user_id, permission_level, role)
    values (${params.userId}::uuid, ${params.permissionLevel}, ${params.role})
    on conflict (user_id) do update set
      permission_level = excluded.permission_level,
      role = excluded.role
  `;
}

async function seedUserProfile(sql: any, params: {
  userId: string;
  displayName: string;
  permissionLevel: number;
}) {
  await sql`
    insert into public.user_profiles (id, display_name, permission_level)
    values (${params.userId}::uuid, ${params.displayName}, ${params.permissionLevel})
    on conflict (id) do update set
      display_name = excluded.display_name,
      permission_level = excluded.permission_level
  `;
}

async function handleRegister(args: {
  body: Record<string, unknown>;
  sql: any;
  schema: string;
  orgId: string;
  req: Request;
}) {
  const { body, sql, schema, orgId, req } = args;
  if (!SERVICE_ROLE_KEY) {
    return json(req, { error: "server misconfigured: no service role key" }, 500);
  }

  const email = String(body?.email ?? "").trim().toLowerCase();
  const displayName = normaliseDisplayName(body?.displayName, email);
  const permissionLevel = Number(body?.permissionLevel ?? 3);
  const role = String(body?.role ?? "member");
  const password = typeof body?.password === "string" && body.password.length >= 8 ? body.password : undefined;
  if (!validEmail(email)) return json(req, { error: "invalid email" }, 400);
  if (!password) return json(req, { error: "invalid password" }, 400);

  let created;
  try {
    created = await createSupabaseUser({ email, password });
  } catch (error) {
    const status = typeof (error as any)?.status === "number" ? (error as any).status : 400;
    return json(req, { ok: false, error: (error as Error).message, code: status }, status);
  }

  const userId = created.id as string;

  await seedOrgMembership(sql, schema, { userId, permissionLevel, role });
  await seedUserProfile(sql, { userId, displayName, permissionLevel });

  return json(
    req,
    {
      ok: true,
      action: "register",
      org_id: orgId,
      schema,
      user: {
        id: userId,
        email,
        displayName,
        permissionLevel,
        role,
      },
    },
    201,
  );
}

async function handleInvite(args: {
  body: InvitePayload;
  sql: any;
  schema: string;
  orgId: string;
  req: Request;
}) {
  const { body, sql, schema, orgId, req } = args;
  if (!SERVICE_ROLE_KEY) {
    return json(req, { error: "server misconfigured: no service role key" }, 500);
  }

  const email = String(body?.email ?? "").trim().toLowerCase();
  if (!validEmail(email)) return json(req, { error: "invalid email" }, 400);

  const permissionLevel = Number(body?.permissionLevel ?? 3);
  const role = typeof body?.role === "string" && body.role.length > 0 ? body.role : "member";
  const displayName = normaliseDisplayName(body?.displayName, email);

  let created;
  try {
    created = await createSupabaseUser({ email });
  } catch (error) {
    const status = typeof (error as any)?.status === "number" ? (error as any).status : 400;
    return json(req, { ok: false, error: (error as Error).message, code: status }, status);
  }

  const userId = created.id as string;

  await seedOrgMembership(sql, schema, { userId, permissionLevel, role });
  await seedUserProfile(sql, { userId, displayName, permissionLevel });

  const resetRedirect = typeof body?.invitation?.resetPasswordRedirect === "string"
    ? body.invitation.resetPasswordRedirect
    : undefined;
  let resetLink: string | null = null;
  let resetExpiresAt: string | null = null;
  try {
    const result = await generateResetLink(email, resetRedirect);
    resetLink = result.link;
    resetExpiresAt = typeof result.expiresAt === "string" ? result.expiresAt : null;
  } catch (error) {
    console.error("Failed to generate reset link", error);
    return json(req, { ok: false, error: (error as Error).message }, 500);
  }

  const invitation = body?.invitation;
  let emailSent = false;
  if (invitation?.sendEmail) {
    try {
      await sendInvitationEmail({
        inviteeEmail: email,
        displayName,
        organisation: invitation.organisation,
        invitedBy: invitation.invitedBy,
        message: invitation.message,
        resetLink: resetLink!,
      });
      emailSent = true;
    } catch (error) {
      console.error("Failed to send invitation email", error);
      return json(req, { ok: false, error: (error as Error).message }, 502);
    }
  }

  return json(
    req,
    {
      ok: true,
      action: "invite",
      org_id: orgId,
      schema,
      user: {
        id: userId,
        email,
        displayName,
        permissionLevel,
        role,
      },
      invitation: {
        emailSent,
        resetLink: emailSent ? null : resetLink,
        resetExpiresAt,
      },
    },
    201,
  );
}

/* =========================
 * Entry point
 * ========================= */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: buildCorsHeaders(req) });
  }

  if (ADMIN_SECRET && req.headers.get("x-admin-secret") !== ADMIN_SECRET) {
    return json(req, { error: "unauthorized" }, 401);
  }

  let sqlClient: any = null;
  try {
    sqlClient = postgres(DATABASE_URL!, { prepare: true });

    if (req.method !== "POST") {
      return json(req, { error: "Method Not Allowed" }, 405);
    }

    let rawBody;
    try {
      rawBody = await parseJsonBody(req);
    } catch (error) {
      return json(req, { error: (error as Error).message ?? "invalid body" }, 400);
    }

    const { action, payload } = getActionAndPayload(rawBody as Record<string, unknown>);

    return await sqlClient.begin(async (tx: any) => {
      const { orgId, schema } = await resolveOrgIdFromReq(tx, req, payload as Record<string, unknown>);

      if (action === "register") {
        return handleRegister({ body: payload as Record<string, unknown>, sql: tx, schema, orgId, req });
      }

      if (action === "invite") {
        return handleInvite({ body: payload as InvitePayload, sql: tx, schema, orgId, req });
      }

      return handleLogin({ body: payload as Record<string, unknown>, sql: tx, schema, orgId, req });
    });
  } catch (error) {
    console.error(error);
    return json(req, { error: String((error as Error).message ?? error) }, 500);
  } finally {
    if (sqlClient) await sqlClient.end();
  }
});

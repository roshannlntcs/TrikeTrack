import { randomBytes } from "node:crypto"
import type { AdminProfile } from "./admin-auth-db"
import { ensureDatabaseReady, query, withTransaction } from "./database"
import { sendExpoPushNotification } from "./expo-push"

export type DriverPasswordResetStatus =
  | "pending"
  | "approved"
  | "denied"
  | "completed"
  | "expired"

export type DriverPasswordResetRequestRecord = {
  requestId: number
  driverId: number
  driverCode: string
  driverName: string
  todaId: number
  todaName: string
  barangayId: number
  barangayName: string
  status: DriverPasswordResetStatus
  requestedAt: string
  approvedAt?: string
  approvedBy?: number
  expiresAt?: string
  resolvedAt?: string
}

type DriverPasswordResetRequestRow = {
  request_id: number | string
  driver_id: number | string
  driver_code: string
  first_name: string
  last_name: string
  toda_id: number | string
  toda_name: string
  barangay_id: number | string
  barangay_name: string
  status: DriverPasswordResetStatus
  requested_at: Date
  approved_at: Date | null
  approved_by: number | string | null
  expires_at: Date | null
  resolved_at: Date | null
  device_push_token: string | null
}

export type DriverPasswordResetDecision =
  | {
      request: DriverPasswordResetRequestRecord
      temporaryPassword: string
      pushNotificationSent: boolean
      pushNotificationError?: string
    }
  | { request: DriverPasswordResetRequestRecord; temporaryPassword?: never }

declare global {
  // eslint-disable-next-line no-var
  var __triketrackPasswordResetReady: Promise<void> | undefined
}

const toIso = (value?: Date | null) => value?.toISOString()

const mapRequest = (row: DriverPasswordResetRequestRow): DriverPasswordResetRequestRecord => ({
  requestId: Number(row.request_id),
  driverId: Number(row.driver_id),
  driverCode: row.driver_code,
  driverName: `${row.first_name} ${row.last_name}`.trim(),
  todaId: Number(row.toda_id),
  todaName: row.toda_name,
  barangayId: Number(row.barangay_id),
  barangayName: row.barangay_name,
  status: row.status,
  requestedAt: row.requested_at.toISOString(),
  approvedAt: toIso(row.approved_at),
  approvedBy: row.approved_by === null ? undefined : Number(row.approved_by),
  expiresAt: toIso(row.expires_at),
  resolvedAt: toIso(row.resolved_at)
})

const buildScopeClause = (profile: AdminProfile) => {
  if (profile.role === "superadmin") return { clause: "", params: [] as unknown[] }
  if (profile.role === "barangay_admin" && profile.barangayId) {
    return { clause: "AND b.barangay_id = $1", params: [profile.barangayId] }
  }
  if (profile.role === "toda_admin" && profile.todaId) {
    return { clause: "AND t.toda_id = $1", params: [profile.todaId] }
  }
  return { clause: "AND 1 = 0", params: [] as unknown[] }
}

const ensurePasswordResetSchemaReady = async () => {
  await ensureDatabaseReady()

  await query(`
    CREATE TABLE IF NOT EXISTS public.driver_password_reset_requests (
      request_id bigint generated always as identity primary key,
      driver_id bigint not null references public.drivers(driver_id) on delete cascade,
      driver_code text not null,
      status text not null default 'pending',
      requested_at timestamptz not null default now(),
      approved_at timestamptz,
      approved_by bigint references public.admin_accounts(admin_id) on delete set null,
      temporary_password_hash text,
      temporary_password text,
      temporary_password_used_at timestamptz,
      expires_at timestamptz,
      device_push_token text,
      device_platform text,
      push_sent_at timestamptz,
      push_error text,
      resolved_at timestamptz,
      constraint driver_password_reset_requests_status_check
        check (status in ('pending', 'approved', 'denied', 'completed', 'expired'))
    )
  `)
  await query(`ALTER TABLE public.driver_password_reset_requests ADD COLUMN IF NOT EXISTS approved_at timestamptz`)
  await query(`ALTER TABLE public.driver_password_reset_requests ADD COLUMN IF NOT EXISTS approved_by bigint references public.admin_accounts(admin_id) on delete set null`)
  await query(`ALTER TABLE public.driver_password_reset_requests ADD COLUMN IF NOT EXISTS temporary_password_hash text`)
  await query(`ALTER TABLE public.driver_password_reset_requests ADD COLUMN IF NOT EXISTS temporary_password text`)
  await query(`ALTER TABLE public.driver_password_reset_requests ADD COLUMN IF NOT EXISTS temporary_password_used_at timestamptz`)
  await query(`ALTER TABLE public.driver_password_reset_requests ADD COLUMN IF NOT EXISTS expires_at timestamptz`)
  await query(`ALTER TABLE public.driver_password_reset_requests ADD COLUMN IF NOT EXISTS device_push_token text`)
  await query(`ALTER TABLE public.driver_password_reset_requests ADD COLUMN IF NOT EXISTS device_platform text`)
  await query(`ALTER TABLE public.driver_password_reset_requests ADD COLUMN IF NOT EXISTS push_sent_at timestamptz`)
  await query(`ALTER TABLE public.driver_password_reset_requests ADD COLUMN IF NOT EXISTS push_error text`)
  await query(`ALTER TABLE public.driver_password_reset_requests ADD COLUMN IF NOT EXISTS resolved_at timestamptz`)
  await query(`
    CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
      audit_id bigint generated always as identity primary key,
      admin_id bigint references public.admin_accounts(admin_id) on delete set null,
      action text not null,
      entity_type text not null,
      entity_id text not null,
      details jsonb,
      created_at timestamptz not null default now()
    )
  `)
  await query(`
    CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_created_at
    ON public.admin_audit_logs(admin_id, created_at desc)
  `)
  await query(`
    CREATE INDEX IF NOT EXISTS idx_driver_password_reset_requests_status_requested_at_desc
    ON public.driver_password_reset_requests(status, requested_at desc)
  `)
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_driver_password_reset_requests_one_pending
    ON public.driver_password_reset_requests(driver_id)
    WHERE status = 'pending'
  `)
}

export const ensureDriverPasswordResetReady = () => {
  if (!globalThis.__triketrackPasswordResetReady) {
    globalThis.__triketrackPasswordResetReady = ensurePasswordResetSchemaReady().catch((error) => {
      globalThis.__triketrackPasswordResetReady = undefined
      throw error
    })
  }

  return globalThis.__triketrackPasswordResetReady
}

export const listDriverPasswordResetRequestsForAdmin = async (
  profile: AdminProfile,
  options: { limit?: number } = {}
) => {
  await ensureDriverPasswordResetReady()

  const scope = buildScopeClause(profile)
  const result = await query<DriverPasswordResetRequestRow>(
    `
      SELECT
        r.request_id,
        r.driver_id,
        r.driver_code,
        d.first_name,
        d.last_name,
        t.toda_id,
        t.toda_name,
        b.barangay_id,
        b.barangay_name,
        r.status,
        r.requested_at,
        r.approved_at,
        r.approved_by,
        r.expires_at,
        r.resolved_at,
        r.device_push_token
      FROM public.driver_password_reset_requests r
      JOIN public.drivers d
        ON d.driver_id = r.driver_id
      JOIN public.todas t
        ON t.toda_id = d.toda_id
      JOIN public.barangays b
        ON b.barangay_id = t.barangay_id
      WHERE r.requested_at >= NOW() - INTERVAL '30 days'
      ${scope.clause}
      ORDER BY
        CASE r.status
          WHEN 'pending' THEN 0
          WHEN 'approved' THEN 1
          ELSE 2
        END,
        r.requested_at DESC
      LIMIT $${scope.params.length + 1}
    `,
    [...scope.params, options.limit ?? 50]
  )

  return result.rows.map(mapRequest)
}

const generateTemporaryPassword = () =>
  `TRK-${randomBytes(2).toString("hex").toUpperCase()}`

export const decideDriverPasswordResetRequest = async (
  profile: AdminProfile,
  requestId: number,
  decision: "approve" | "deny"
): Promise<DriverPasswordResetDecision> => {
  await ensureDriverPasswordResetReady()

  const scope = buildScopeClause(profile)
  const temporaryPassword = decision === "approve" ? generateTemporaryPassword() : null

  const decisionResult = await withTransaction(async (client) => {
    const scoped = await client.query<DriverPasswordResetRequestRow>(
      `
        SELECT
          r.request_id,
          r.driver_id,
          r.driver_code,
          d.first_name,
          d.last_name,
          t.toda_id,
          t.toda_name,
          b.barangay_id,
          b.barangay_name,
          r.status,
          r.requested_at,
          r.approved_at,
          r.approved_by,
          r.expires_at,
          r.resolved_at,
          r.device_push_token
        FROM public.driver_password_reset_requests r
        JOIN public.drivers d
          ON d.driver_id = r.driver_id
        JOIN public.todas t
          ON t.toda_id = d.toda_id
        JOIN public.barangays b
          ON b.barangay_id = t.barangay_id
        WHERE r.request_id = $${scope.params.length + 1}
          ${scope.clause}
        LIMIT 1
      `,
      [...scope.params, requestId]
    )

    const request = scoped.rows[0]
    if (!request) throw new Error("Password reset request not found in your admin scope.")
    if (request.status !== "pending") throw new Error("Only pending password reset requests can be updated.")

    const updated = await client.query<DriverPasswordResetRequestRow>(
      decision === "approve"
        ? `
          UPDATE public.driver_password_reset_requests r
          SET
            status = 'approved',
            approved_at = NOW(),
            approved_by = $2,
            temporary_password = $3,
            temporary_password_hash = extensions.crypt($3, extensions.gen_salt('bf')),
            temporary_password_used_at = NULL,
            expires_at = NOW() + INTERVAL '15 minutes',
            push_sent_at = NULL,
            push_error = NULL,
            resolved_at = NULL
          FROM public.drivers d
          JOIN public.todas t ON t.toda_id = d.toda_id
          JOIN public.barangays b ON b.barangay_id = t.barangay_id
          WHERE r.request_id = $1
            AND d.driver_id = r.driver_id
          RETURNING
            r.request_id,
            r.driver_id,
            r.driver_code,
            d.first_name,
            d.last_name,
            t.toda_id,
            t.toda_name,
            b.barangay_id,
            b.barangay_name,
            r.status,
            r.requested_at,
            r.approved_at,
            r.approved_by,
            r.expires_at,
            r.resolved_at,
            r.device_push_token
        `
        : `
          UPDATE public.driver_password_reset_requests r
          SET
            status = 'denied',
            temporary_password = NULL,
            temporary_password_hash = NULL,
            temporary_password_used_at = NULL,
            expires_at = NULL,
            push_sent_at = NULL,
            push_error = NULL,
            resolved_at = NOW()
          FROM public.drivers d
          JOIN public.todas t ON t.toda_id = d.toda_id
          JOIN public.barangays b ON b.barangay_id = t.barangay_id
          WHERE r.request_id = $1
            AND d.driver_id = r.driver_id
          RETURNING
            r.request_id,
            r.driver_id,
            r.driver_code,
            d.first_name,
            d.last_name,
            t.toda_id,
            t.toda_name,
            b.barangay_id,
            b.barangay_name,
            r.status,
            r.requested_at,
            r.approved_at,
            r.approved_by,
            r.expires_at,
            r.resolved_at,
            r.device_push_token
        `,
      decision === "approve"
        ? [requestId, profile.adminId, temporaryPassword]
        : [requestId]
    )

    const mapped = mapRequest(updated.rows[0])
    await client.query(
      `
        INSERT INTO public.admin_audit_logs (
          admin_id,
          action,
          entity_type,
          entity_id,
          details
        )
        VALUES ($1, $2, 'driver_password_reset_request', $3, $4::jsonb)
      `,
      [
        profile.adminId,
        decision === "approve" ? "password_reset_approved" : "password_reset_denied",
        String(requestId),
        JSON.stringify({
          driverId: mapped.driverId,
          driverCode: mapped.driverCode,
          status: mapped.status,
          expiresAt: mapped.expiresAt ?? null
        })
      ]
    )

    return temporaryPassword
      ? {
          request: mapped,
          temporaryPassword,
          devicePushToken: updated.rows[0]?.device_push_token ?? null
        }
      : {
          request: mapped,
          devicePushToken: updated.rows[0]?.device_push_token ?? null
        }
  })

  if (decision === "approve" && decisionResult.temporaryPassword) {
    let pushNotificationSent = false
    let pushNotificationError: string | undefined

    if (!decisionResult.devicePushToken) {
      pushNotificationError = "Driver device push token is not registered. Give the temporary password to the verified driver manually."
    } else {
      try {
        await sendExpoPushNotification({
          to: decisionResult.devicePushToken,
          title: "TrikeTrack",
          body: [
            "Password reset approved.",
            "",
            `Temporary Password: ${decisionResult.temporaryPassword}`,
            "",
            "Open TrikeTrack Login, enter your Driver Code, then use this as your Temporary Password.",
            "This password can only be used once and will expire in 15 minutes."
          ].join("\n"),
          data: {
            type: "password_reset_approved",
            targetScreen: "login",
            requestId,
            driverId: decisionResult.request.driverId,
            expiresAt: decisionResult.request.expiresAt
          },
          channelId: "password-reset"
        })
        pushNotificationSent = true
        await query(
          `
            UPDATE public.driver_password_reset_requests
            SET push_sent_at = NOW(), push_error = NULL
            WHERE request_id = $1
          `,
          [requestId]
        )
      } catch (error) {
        pushNotificationError = error instanceof Error ? error.message : String(error)
      }
    }

    if (pushNotificationError) {
      await query(
        `
          UPDATE public.driver_password_reset_requests
          SET push_error = $2
          WHERE request_id = $1
        `,
        [requestId, pushNotificationError]
      )
    }

    return {
      request: decisionResult.request,
      temporaryPassword: decisionResult.temporaryPassword,
      pushNotificationSent,
      pushNotificationError
    }
  }

  return decisionResult.temporaryPassword
    ? {
        request: decisionResult.request,
        temporaryPassword: decisionResult.temporaryPassword,
        pushNotificationSent: false,
        pushNotificationError: "Password reset approval did not attempt a push notification."
      }
    : { request: decisionResult.request }
}

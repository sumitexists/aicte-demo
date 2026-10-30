import React, { createContext, useCallback, useContext, useMemo, useReducer } from 'react'
import type {
  Application,
  AppNotification,
  AppTypeCode,
  AuditEvent,
  EVCSchedule,
  LeaseDocument,
  Obligation,
  RegulatoryConfig,
  RoleCode,
  StageCode,
} from './types'
import {
  STAGE_ACTOR,
  STAGE_DURATION,
  STAGE_LABEL,
  actionsForStage,
  appTypeDef,
  canActAtStage,
  roleLabel,
  type StageAction,
} from './workflow'
import {
  addDays,
  allocatedDueFor,
  buildObligations,
  crossedThresholds,
  daysBetween,
  deadlineState,
  DEFAULT_REGULATORY_CONFIG,
  DEMO_START,
  ESCALATION_LADDER,
  ladderRecipient,
  leaseGate,
  nextEscalationTo,
} from './deadlines'
import { ACTOR_NAME, INSTITUTION_PROFILE, seedApplications, seedAudit, seedNotifications } from './seed'

/* ------------------------------------------------------------------ *
 * DERIVED STATE — nothing here is stored, everything is computed
 * ------------------------------------------------------------------ */
export type AppStatus = 'OPEN' | 'APPROVED' | 'REJECTED' | 'CLOSED'

export const currentStage = (app: Application) => {
  const active = [...app.stages].reverse().find((s) => s.status === 'active')
  return active ?? app.stages[app.stages.length - 1]
}

export const statusOf = (app: Application): AppStatus => {
  if (app.decision === 'APPROVED' || app.decision === 'APPROVED_WITH_CONDITIONS') return 'APPROVED'
  if (app.decision === 'REJECTED') return 'REJECTED'
  return 'OPEN'
}

export const isOverdue = (app: Application, now: string, rungs = ESCALATION_LADDER) => {
  const st = currentStage(app)
  return statusOf(app) === 'OPEN' && deadlineState(st.dueAt, now, rungs).overdue
}

export const ageDays = (app: Application, now: string) => daysBetween(app.createdAt, now)

export const leaseFor = (app: Application, now: string) =>
  app.lease ? leaseGate(app.lease.endDate, app.lease.maxCourseDurationYears, now) : null

/* ------------------------------------------------------------------ *
 * STATE
 * ------------------------------------------------------------------ */
interface State {
  now: string
  role: RoleCode
  apps: Application[]
  audit: AuditEvent[]
  notifications: AppNotification[]
  emitted: string[]
  seq: number
  config: RegulatoryConfig
}

const SEED_APPS = seedApplications()

const initial: State = {
  now: DEMO_START,
  role: 'BUREAU',
  apps: SEED_APPS,
  audit: seedAudit(SEED_APPS),
  notifications: seedNotifications(SEED_APPS),
  emitted: [],
  seq: 1,
  config: DEFAULT_REGULATORY_CONFIG,
}

type Action =
  | { type: 'SET_ROLE'; role: RoleCode }
  | { type: 'SET_NOW'; now: string }
  | { type: 'ADVANCE'; days: number }
  | { type: 'RESET' }
  | { type: 'ACT'; appId: string; actionCode: string; reason: string; actorNote?: string }
  | { type: 'SUBMIT_APP'; spec: NewAppSpec }
  | { type: 'VERIFY_OBLIGATION'; obligationId: string }
  | { type: 'SUBMIT_EVIDENCE'; obligationId: string; docName: string; docRef: string; note: string }
  | { type: 'REVIEW_EVIDENCE'; obligationId: string; approved: boolean; remarks: string }
  | { type: 'SCHEDULE_EVC'; appId: string; scheduledDate: string; panel: { name: string; designation: string; institution: string }[]; mode: 'PHYSICAL' | 'HYBRID' | 'VIRTUAL'; remarks?: string }
  | { type: 'COMPLETE_EVC'; appId: string; report: string; shortcomings: boolean }
  | { type: 'FILE_APPEAL'; appId: string; grounds: string }
  | { type: 'UPLOAD_SUPPORTING_DOCUMENT'; appId: string; title: string; docRef: string }
  | { type: 'UPLOAD_RENEWED_LEASE'; appId: string; docRef: string; newEndDate: string; notes?: string }
  | { type: 'VERIFY_LEASE_RENEWAL'; appId: string; docId: string }
  | { type: 'UPDATE_CONFIG'; config: Partial<RegulatoryConfig> }
  | { type: 'RESET_CONFIG' }
  | { type: 'MARK_READ'; ids?: string[]; onlyRole?: RoleCode }
  | { type: 'OUTCOME'; appId: string; done: boolean; deficiencies: string; remarks: string }

export interface NewAppSpec {
  institution: string
  region: string
  type: AppTypeCode
  leaseEnd: string
  maxCourseDurationYears: number
}

let uid = 1000
const nextId = (p: string) => `${p}-${++uid}`

function logEvent(e: Omit<AuditEvent, 'id'>): AuditEvent {
  return { id: nextId('EV'), ...e }
}

function nextStageAfter(app: Application, current: StageCode): StageCode | null {
  const plan = appTypeDef(app.type).plan
  if (current === 'INSTITUTION_REPLY') return 'RE_SCRUTINY'
  if (current === 'RE_SCRUTINY') {
    const i = plan.indexOf('SCRUTINY')
    return plan[i + 1] ?? 'EC_DECISION'
  }
  if (current === 'SHC') return 'EC_DECISION'
  if (current === 'COUNCIL_RATIFICATION') return 'EC_DECISION'
  const idx = plan.indexOf(current)
  if (idx === -1) return null
  return plan[idx + 1] ?? null
}

function pushStage(
  app: Application,
  code: StageCode,
  at: string,
  note?: string,
  config = DEFAULT_REGULATORY_CONFIG,
): Application {
  const stages = app.stages.map((s) => (s.status === 'active' ? { ...s, status: 'done' as const } : s))
  // deadline allocated from the time left before decision wall, dynamic with config
  const { dueAt } = allocatedDueFor(
    app.type,
    code,
    at,
    config.decisionDeadline,
    config.stageDurations,
    config.paceGamma,
  )
  stages.push({
    code,
    actorRole: STAGE_ACTOR[code],
    enteredAt: at,
    dueAt,
    slaDays: config.stageDurations[code] ?? STAGE_DURATION[code],
    source: code === 'APPEAL' ? 'REGULATION' : 'ADMIN',
    status: 'active',
    note,
  })
  return { ...app, stages }
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_ROLE':
      return { ...state, role: action.role }

    case 'SET_NOW':
      return applyClock(state, action.now)

    case 'ADVANCE':
      return applyClock(state, addDays(state.now, action.days))

    case 'RESET': {
      const apps = seedApplications()
      return {
        ...initial,
        apps,
        audit: seedAudit(apps),
        notifications: seedNotifications(apps),
        role: state.role,
        config: state.config,
      }
    }

    case 'UPDATE_CONFIG': {
      const nextConfig = { ...state.config, ...action.config }
      return {
        ...state,
        config: nextConfig,
        audit: [
          ...state.audit,
          logEvent({
            appId: null,
            ts: `${state.now}T09:30:00`,
            role: state.role,
            actor: ACTOR_NAME[state.role],
            type: 'CONFIG_CHANGE',
            action: 'Regulatory Configuration Updated',
            message: `APH configuration parameters updated by ${ACTOR_NAME[state.role]}. Dynamic deadline allocations recomputed.`,
          }),
        ],
      }
    }

    case 'RESET_CONFIG': {
      return {
        ...state,
        config: DEFAULT_REGULATORY_CONFIG,
        audit: [
          ...state.audit,
          logEvent({
            appId: null,
            ts: `${state.now}T09:30:00`,
            role: state.role,
            actor: ACTOR_NAME[state.role],
            type: 'CONFIG_CHANGE',
            action: 'Regulatory Configuration Reset to APH Defaults',
            message: 'All stage SLAs and escalation parameters reset to APH 2026-27 standard defaults.',
          }),
        ],
      }
    }

    case 'MARK_READ':
      return {
        ...state,
        notifications: state.notifications.map((n) =>
          (!action.ids || action.ids.includes(n.id)) &&
          (!action.onlyRole || n.to === action.onlyRole)
            ? { ...n, read: true }
            : n,
        ),
      }

    case 'OUTCOME': {
      const app = state.apps.find((a) => a.id === action.appId)
      if (!app) return state
      const stage = currentStage(app)
      if (STAGE_ACTOR[stage.code] !== state.role) return state
      if (!action.done && !action.deficiencies.trim()) return state

      // Cross-case dependency check APH cl. 1.8(i)
      if (action.done && app.blockedByAppId) {
        const blocker = state.apps.find((a) => a.id === app.blockedByAppId)
        if (blocker && blocker.decision !== 'APPROVED') {
          return {
            ...state,
            notifications: [
              {
                id: nextId('NT'),
                appId: app.id,
                ts: state.now,
                to: state.role,
                level: 2,
                kind: 'ESCALATION',
                subject: `Movement Blocked: Dependency on ${blocker.ref}`,
                body: `Cannot complete stage for ${app.ref}. APH cl. 1.8(i) mandates that closure application ${blocker.ref} at the same premises must be approved first.`,
              },
              ...state.notifications,
            ],
            audit: [
              ...state.audit,
              logEvent({
                appId: app.id,
                ts: `${state.now}T11:20:00`,
                role: state.role,
                actor: ACTOR_NAME[state.role],
                type: 'ALERT',
                action: 'Stage movement blocked by regulatory dependency',
                message: `Movement blocked under APH cl. 1.8(i): Closure application ${blocker.ref} must reach approval before ${app.ref} can proceed.`,
              }),
            ],
          }
        }
      }

      const at = state.now
      let next = { ...app }
      const events: AuditEvent[] = []

      if (action.done) {
        const code = nextStageAfter(app, stage.code)
        if (code) {
          next = pushStage(next, code, at, action.remarks.trim() || undefined, state.config)
          events.push(
            logEvent({
              appId: app.id,
              ts: `${at}T11:20:00`,
              role: state.role,
              actor: ACTOR_NAME[state.role],
              type: 'TRANSITION',
              action: `Stage completed — forwarded to ${STAGE_LABEL[code]}`,
              message: action.remarks.trim() || 'Stage recorded as complete by the officer holding it.',
            }),
          )
        }
      } else {
        next = pushStage(next, 'INSTITUTION_REPLY', at, action.deficiencies, state.config)
        next.returns = next.returns + 1
        next.deficiencies = [
          ...next.deficiencies,
          { id: nextId('D'), stage: stage.code, text: action.deficiencies.trim(), raisedAt: at },
        ]
        events.push(
          logEvent({
            appId: app.id,
            ts: `${at}T11:20:00`,
            role: state.role,
            actor: ACTOR_NAME[state.role],
            type: 'RETURN',
            action: 'Stage not cleared — returned with deficiencies',
            message: action.remarks.trim() || 'Deficiencies recorded by the officer holding the stage.',
            reason: action.deficiencies.trim(),
          }),
        )
      }

      next = {
        ...next,
        stages: next.stages.map((s, i, arr) =>
          i === arr.length - 1 ? s : s.status === 'active' ? { ...s, status: 'done' as const } : s,
        ),
      }

      return {
        ...state,
        apps: state.apps.map((a) => (a.id === app.id ? next : a)),
        audit: [...state.audit, ...events],
      }
    }

    case 'VERIFY_OBLIGATION': {
      let verified: Obligation | undefined
      const apps = state.apps.map((a) => ({
        ...a,
        obligations: a.obligations.map((o) => {
          if (o.id !== action.obligationId) return o
          verified = o
          return {
            ...o,
            status: 'verified' as const,
            verifiedBy: ACTOR_NAME[state.role],
            verifiedAt: state.now,
          }
        }),
      }))
      if (!verified) return state
      return {
        ...state,
        apps,
        audit: [
          ...state.audit,
          logEvent({
            appId: verified.appId,
            ts: `${state.now}T12:00:00`,
            role: state.role,
            actor: ACTOR_NAME[state.role],
            type: 'VERIFY',
            action: 'Evidence verified and compliance closed',
            message: `Verified compliance evidence for: ${verified.label}`,
          }),
        ],
      }
    }

    case 'SUBMIT_EVIDENCE': {
      let targetObligation: Obligation | undefined
      let targetApp: Application | undefined

      const apps = state.apps.map((a) => {
        const has = a.obligations.some((o) => o.id === action.obligationId)
        if (!has) return a
        targetApp = a
        return {
          ...a,
          obligations: a.obligations.map((o) => {
            if (o.id !== action.obligationId) return o
            targetObligation = {
              ...o,
              status: 'submitted' as const,
              submittedAt: state.now,
              submittedDocName: action.docName,
              submittedDocRef: action.docRef,
              evidenceNote: action.note,
              rejectionNote: undefined,
            }
            return targetObligation
          }),
        }
      })

      if (!targetObligation || !targetApp) return state

      const notif: AppNotification = {
        id: nextId('NT'),
        appId: targetApp.id,
        ts: state.now,
        to: 'SCRUTINY',
        level: 0,
        kind: 'REMINDER',
        subject: `Compliance evidence submitted: ${targetObligation.label}`,
        body: `${targetApp.institution} has submitted proof for "${targetObligation.label}". Review and verify on portal.`,
      }

      return {
        ...state,
        apps,
        notifications: [notif, ...state.notifications],
        audit: [
          ...state.audit,
          logEvent({
            appId: targetApp.id,
            ts: `${state.now}T14:30:00`,
            role: state.role,
            actor: ACTOR_NAME[state.role],
            type: 'DOCUMENT',
            action: 'Compliance evidence submitted by institution',
            message: `Uploaded "${action.docName}" (Ref: ${action.docRef}). Remarks: ${action.note}`,
          }),
        ],
      }
    }

    case 'REVIEW_EVIDENCE': {
      let targetObligation: Obligation | undefined
      let targetApp: Application | undefined

      const apps = state.apps.map((a) => {
        const has = a.obligations.some((o) => o.id === action.obligationId)
        if (!has) return a
        targetApp = a
        return {
          ...a,
          obligations: a.obligations.map((o) => {
            if (o.id !== action.obligationId) return o
            if (action.approved) {
              targetObligation = {
                ...o,
                status: 'verified' as const,
                verifiedBy: ACTOR_NAME[state.role],
                verifiedAt: state.now,
              }
            } else {
              targetObligation = {
                ...o,
                status: 'open' as const,
                rejectionNote: action.remarks,
              }
            }
            return targetObligation
          }),
        }
      })

      if (!targetObligation || !targetApp) return state

      const notif: AppNotification = {
        id: nextId('NT'),
        appId: targetApp.id,
        ts: state.now,
        to: 'INSTITUTION',
        level: action.approved ? 0 : 1,
        kind: action.approved ? 'DECISION' : 'ESCALATION',
        subject: action.approved
          ? `Compliance Verified: ${targetObligation.label}`
          : `Compliance Evidence Deficient: ${targetObligation.label}`,
        body: action.approved
          ? `Your evidence for "${targetObligation.label}" was verified and cleared by ${ACTOR_NAME[state.role]}.`
          : `Deficiencies observed: ${action.remarks}. Upload rectified evidence immediately.`,
      }

      return {
        ...state,
        apps,
        notifications: [notif, ...state.notifications],
        audit: [
          ...state.audit,
          logEvent({
            appId: targetApp.id,
            ts: `${state.now}T15:00:00`,
            role: state.role,
            actor: ACTOR_NAME[state.role],
            type: action.approved ? 'VERIFY' : 'RETURN',
            action: action.approved ? 'Compliance evidence verified' : 'Evidence rejected with deficiencies',
            message: action.remarks || (action.approved ? 'Satisfactory evidence verified.' : 'Evidence does not meet requirements.'),
          }),
        ],
      }
    }

    case 'SCHEDULE_EVC': {
      const app = state.apps.find((a) => a.id === action.appId)
      if (!app) return state

      const evcSchedule: EVCSchedule = {
        id: `EVC-${app.id}`,
        appId: app.id,
        scheduledDate: action.scheduledDate,
        mode: action.mode,
        status: 'SCHEDULED',
        assignedPanel: action.panel,
        scheduledAt: state.now,
        scheduledBy: ACTOR_NAME[state.role],
        venue: action.remarks || `${app.institution} Main Campus`,
        shortcomingsFound: false,
      }

      const notif: AppNotification = {
        id: nextId('NT'),
        appId: app.id,
        ts: state.now,
        to: 'INSTITUTION',
        level: 0,
        kind: 'REMINDER',
        subject: `EVC Inspection Scheduled: ${app.ref}`,
        body: `Expert Visit Committee scheduled for ${action.scheduledDate} (${action.mode} mode). Prepare requisite physical and documentary evidence.`,
      }

      const nextApps = state.apps.map((a) => (a.id === app.id ? { ...a, evcSchedule } : a))

      return {
        ...state,
        apps: nextApps,
        notifications: [notif, ...state.notifications],
        audit: [
          ...state.audit,
          logEvent({
            appId: app.id,
            ts: `${state.now}T16:00:00`,
            role: state.role,
            actor: ACTOR_NAME[state.role],
            type: 'EVC_SCHEDULE',
            action: `EVC Inspection Scheduled for ${action.scheduledDate}`,
            message: `Panel constituted: ${action.panel.map((p) => p.name).join(', ')}. Mode: ${action.mode}.`,
          }),
        ],
      }
    }

    case 'COMPLETE_EVC': {
      const app = state.apps.find((a) => a.id === action.appId)
      if (!app?.evcSchedule || state.role !== 'EVC') return state
      const evcSchedule = { ...app.evcSchedule, status: 'REPORT_SUBMITTED' as const, reportSummary: action.report, shortcomingsFound: action.shortcomings, reportSubmittedAt: state.now }
      const updated = state.apps.map((a) => a.id === app.id ? { ...a, evcSchedule } : a)
      return { ...state, apps: updated, audit: [...state.audit, logEvent({ appId: app.id, ts: `${state.now}T16:30:00`, role: state.role, actor: ACTOR_NAME[state.role], type: 'EVC_REPORT', action: action.shortcomings ? 'EVC report submitted with shortcomings' : 'EVC report submitted — no shortcomings', message: action.report })] }
    }

    case 'FILE_APPEAL': {
      const app = state.apps.find((a) => a.id === action.appId)
      if (!app || state.role !== 'INSTITUTION' || !app.decision || !app.appealUntil || state.now > app.appealUntil) return state
      let next = pushStage({ ...app, decision: null }, 'APPEAL', state.now, action.grounds, state.config)
      next = { ...next, stages: next.stages.map((s, i, arr) => i === arr.length - 1 ? { ...s, dueAt: app.appealUntil!, source: 'REGULATION' as const } : s) }
      return { ...state, apps: state.apps.map(a => a.id === app.id ? next : a), notifications: [{ id: nextId('NT'), appId: app.id, ts: state.now, to: 'SAC', level: 0, kind: 'REMINDER', subject: `Appeal filed: ${app.ref}`, body: `${app.institution} filed an appeal within the statutory window. Grounds: ${action.grounds}` }, ...state.notifications], audit: [...state.audit, logEvent({ appId: app.id, ts: `${state.now}T14:00:00`, role: 'INSTITUTION', actor: ACTOR_NAME.INSTITUTION, type: 'APPEAL', action: 'Appeal filed before SAC', message: 'Institution appeal accepted into SAC queue.', reason: action.grounds })] }
    }

    case 'UPLOAD_SUPPORTING_DOCUMENT': {
      const app = state.apps.find((a) => a.id === action.appId)
      if (!app || state.role !== 'INSTITUTION') return state
      const doc: LeaseDocument = { id: nextId('LD'), title: action.title, docRef: action.docRef, startDate: state.now, endDate: addDays(state.now, 365), uploadedAt: state.now, status: 'RENEWAL_SUBMITTED', fileSize: '2.4 MB', notes: 'Renewed supporting document uploaded through Compliance Passport.' }
      return { ...state, apps: state.apps.map(a => a.id === app.id ? { ...a, leaseDocuments: [doc, ...(a.leaseDocuments || [])] } : a), notifications: [{ id: nextId('NT'), appId: app.id, ts: state.now, to: 'SCRUTINY', level: 0, kind: 'REMINDER', subject: `Supporting document submitted: ${app.ref}`, body: `${app.institution} uploaded ${action.title} for verification.` }, ...state.notifications], audit: [...state.audit, logEvent({ appId: app.id, ts: `${state.now}T14:10:00`, role: 'INSTITUTION', actor: ACTOR_NAME.INSTITUTION, type: 'DOCUMENT', action: 'Supporting document submitted', message: `${action.title} uploaded; Ref: ${action.docRef}.` })] }
    }

    case 'UPLOAD_RENEWED_LEASE': {
      const app = state.apps.find((a) => a.id === action.appId)
      if (!app || !app.lease) return state

      const updatedLease = {
        ...app.lease,
        endDate: action.newEndDate,
      }

      const newGate = leaseGate(action.newEndDate, app.lease.maxCourseDurationYears, state.now, true)

      const renewedDoc: LeaseDocument = {
        id: nextId('LD'),
        title: 'Renewed / Extended Registered Lease Agreement',
        docRef: action.docRef,
        startDate: state.now,
        endDate: action.newEndDate,
        uploadedAt: state.now,
        status: 'RENEWAL_SUBMITTED',
        fileSize: '5.1 MB',
        notes: action.notes || 'Submitted by institution for lease validity extension.',
      }

      const nextDocs = [renewedDoc, ...(app.leaseDocuments || [])]

      // Update lease gate obligations if present
      const nextObligations = app.obligations.map((o) => {
        if (o.kind !== 'COMPUTED_GATE') return o
        return {
          ...o,
          expiryDate: action.newEndDate,
          dueAt: addDays(action.newEndDate, -365),
          gate: newGate,
          status: newGate.blocked ? ('breached' as const) : ('open' as const),
        }
      })

      const nextApps = state.apps.map((a) =>
        a.id === app.id
          ? {
              ...a,
              lease: updatedLease,
              leaseDocuments: nextDocs,
              obligations: nextObligations,
            }
          : a,
      )

      return {
        ...state,
        apps: nextApps,
        notifications: [
          {
            id: nextId('NT'),
            appId: app.id,
            ts: state.now,
            to: 'BUREAU',
            level: 0,
            kind: 'REMINDER',
            subject: `Renewed Lease Deed Submitted: ${app.ref}`,
            body: `${app.institution} has uploaded a renewed lease deed expiring on ${action.newEndDate}. Requires legal verification.`,
          },
          ...state.notifications,
        ],
        audit: [
          ...state.audit,
          logEvent({
            appId: app.id,
            ts: `${state.now}T16:30:00`,
            role: state.role,
            actor: ACTOR_NAME[state.role],
            type: 'DOCUMENT',
            action: 'Renewed lease deed submitted by institution',
            message: `Document Ref: ${action.docRef}. New lease validity extended to ${action.newEndDate}. Live lease re-evaluated: ${newGate.liveLeaseYears} years.`,
          }),
        ],
      }
    }

    case 'VERIFY_LEASE_RENEWAL': {
      const app = state.apps.find((a) => a.id === action.appId)
      if (!app) return state

      const nextDocs = (app.leaseDocuments || []).map((d) =>
        d.id === action.docId
          ? { ...d, status: 'VERIFIED' as const, verifiedBy: ACTOR_NAME[state.role] }
          : d,
      )

      const nextApps = state.apps.map((a) => (a.id === app.id ? { ...a, leaseDocuments: nextDocs } : a))

      return {
        ...state,
        apps: nextApps,
        audit: [
          ...state.audit,
          logEvent({
            appId: app.id,
            ts: `${state.now}T17:00:00`,
            role: state.role,
            actor: ACTOR_NAME[state.role],
            type: 'VERIFY',
            action: 'Renewed lease deed verified by legal cell',
            message: `Registered lease deed verified against land authority records. Lease validity confirmed.`,
          }),
        ],
      }
    }

    case 'SUBMIT_APP': {
      const ref = `AP/2026/${1200 + state.seq}`
      const def = appTypeDef(action.spec.type)
      const createdAt = state.now
      const first = def.plan[1] ?? 'SCRUTINY'
      const app: Application = {
        id: ref,
        ref,
        type: action.spec.type,
        institution: action.spec.institution,
        region: action.spec.region,
        createdAt,
        stages: [
          {
            code: 'SUBMITTED',
            actorRole: 'INSTITUTION',
            enteredAt: createdAt,
            dueAt: addDays(createdAt, state.config.stageDurations.SUBMITTED ?? STAGE_DURATION.SUBMITTED),
            slaDays: state.config.stageDurations.SUBMITTED ?? STAGE_DURATION.SUBMITTED,
            source: 'ADMIN',
            status: 'done',
          },
          {
            code: first,
            actorRole: STAGE_ACTOR[first],
            enteredAt: createdAt,
            dueAt: allocatedDueFor(
              action.spec.type,
              first,
              createdAt,
              state.config.decisionDeadline,
              state.config.stageDurations,
              state.config.paceGamma,
            ).dueAt,
            slaDays: state.config.stageDurations[first] ?? STAGE_DURATION[first],
            source: 'ADMIN',
            status: 'active',
          },
        ],
        deficiencies: [],
        returns: 0,
        decision: null,
        obligations: [],
        lease: {
          startDate: addDays(createdAt, -365),
          endDate: action.spec.leaseEnd,
          maxCourseDurationYears: action.spec.maxCourseDurationYears,
        },
        leaseDocuments: [
          {
            id: nextId('LD'),
            title: 'Initial Land & Building Lease Deed',
            docRef: `AP/REG/${ref.split('/')[2]}`,
            startDate: addDays(createdAt, -365),
            endDate: action.spec.leaseEnd,
            uploadedAt: createdAt,
            status: action.spec.leaseEnd < '2027-01-01' ? 'EXPIRING_SOON' : 'VALID',
            fileSize: '3.6 MB',
            verifiedBy: 'AICTE Legal Scrutiny Cell',
          },
        ],
      }
      return {
        ...state,
        seq: state.seq + 1,
        apps: [app, ...state.apps],
        audit: [
          ...state.audit,
          logEvent({
            appId: app.id,
            ts: `${createdAt}T10:15:00`,
            role: 'INSTITUTION',
            actor: ACTOR_NAME.INSTITUTION,
            type: 'SUBMIT',
            action: 'Application submitted',
            message: `${def.label} application received; routed automatically to ${STAGE_LABEL[first]}.`,
          }),
        ],
      }
    }

    case 'ACT': {
      const app = state.apps.find((a) => a.id === action.appId)
      if (!app) return state
      const stage = currentStage(app)
      const allowed = canActAtStage(state.role, stage.code)
      if (!allowed) return state
      const def: StageAction | undefined = actionsForStage(stage.code).find((a) => a.code === action.actionCode)
      if (!def) return state
      const reason = action.reason.trim()
      if (def.reasonRequired && !reason) return state

      // Cross-case dependency check under APH cl. 1.8(i)
      if (app.blockedByAppId && (def.effect === 'NEXT' || def.effect === 'CLOSE_APPROVED')) {
        const blocker = state.apps.find((a) => a.id === app.blockedByAppId)
        if (blocker && blocker.decision !== 'APPROVED') {
          const warn = `Regulatory Safeguard Blocked (APH cl. 1.8(i)): Case ${app.ref} cannot advance until closure application ${blocker.ref} at the same premises is approved.`
          return {
            ...state,
            notifications: [
              {
                id: nextId('NT'),
                appId: app.id,
                ts: state.now,
                to: state.role,
                level: 2,
                kind: 'ESCALATION',
                subject: `Action Blocked: Dependency on ${blocker.ref}`,
                body: warn,
              },
              ...state.notifications,
            ],
            audit: [
              ...state.audit,
              logEvent({
                appId: app.id,
                ts: `${state.now}T11:00:00`,
                role: state.role,
                actor: ACTOR_NAME[state.role],
                type: 'ALERT',
                action: 'Action blocked by regulatory dependency',
                message: warn,
              }),
            ],
          }
        }
      }

      const at = state.now
      let next = { ...app }
      const audit: AuditEvent[] = []

      switch (def.effect) {
        case 'RETURN_TO_INSTITUTION': {
          next = pushStage(next, 'INSTITUTION_REPLY', at, reason, state.config)
          next.returns = next.returns + 1
          next.deficiencies = [
            ...next.deficiencies,
            { id: nextId('D'), stage: stage.code, text: reason, raisedAt: at },
          ]
          audit.push(
            logEvent({
              appId: app.id,
              ts: `${at}T11:00:00`,
              role: state.role,
              actor: ACTOR_NAME[state.role],
              type: 'RETURN',
              action: 'Returned to institution',
              message: `Case returned from ${stage.code.replaceAll('_', ' ').toLowerCase()}; institution must reply before Re-Scrutiny.`,
              reason,
            }),
          )
          break
        }
        case 'TO_RE_SCRUTINY': {
          next = pushStage(next, 'RE_SCRUTINY', at, 'Scope limited to raised deficiencies (APH cl. 1.8(g))', state.config)
          next.deficiencies = next.deficiencies.map((d) => (d.clearedAt ? d : { ...d, clearedAt: at }))
          audit.push(
            logEvent({
              appId: app.id,
              ts: `${at}T11:00:00`,
              role: state.role,
              actor: ACTOR_NAME[state.role],
              type: 'DOCUMENT',
              action: 'Compliance submitted',
              message: reason,
            }),
          )
          break
        }
        case 'TO_SHC': {
          next = pushStage(next, 'SHC', at, reason, state.config)
          audit.push(
            logEvent({
              appId: app.id,
              ts: `${at}T11:00:00`,
              role: state.role,
              actor: ACTOR_NAME[state.role],
              type: 'TRANSITION',
              action: 'Referred to Standing Hearing Committee',
              message: 'EVC report recorded shortcomings; institution may comply before the SHC (APH cl. 2.23.3).',
              reason,
            }),
          )
          break
        }
        case 'CLOSE_APPROVED':
        case 'CLOSE_REJECTED': {
          const approved = def.effect === 'CLOSE_APPROVED'
          next = {
            ...next,
            stages: next.stages.map((s) => (s.status === 'active' ? { ...s, status: 'done' as const } : s)),
            decision: approved ? 'APPROVED' : 'REJECTED',
            decisionAt: at,
            appealUntil: addDays(at, 7),
            obligations: approved ? buildObligations(app.id, app.type, at, app.lease) : next.obligations,
          }
          audit.push(
            logEvent({
              appId: app.id,
              ts: `${at}T15:20:00`,
              role: state.role,
              actor: ACTOR_NAME[state.role],
              type: 'DECISION',
              action: approved ? 'Approved — Letter of Approval issued' : 'Rejected — Letter of Rejection with speaking order',
              message: approved
                ? `Approval recorded. ${next.obligations.length} obligation(s) created from this approval event.`
                : 'Rejection recorded with reasons on the portal.',
              reason: reason || undefined,
            }),
          )
          audit.push(
            logEvent({
              appId: app.id,
              ts: `${at}T15:25:00`,
              role: 'SYSTEM',
              actor: ACTOR_NAME.SYSTEM,
              type: 'APPEAL',
              action: 'Appeal window opened',
              message: '7-day window under APH cl. 2.24(a) runs from the date the decision is uploaded.',
            }),
          )
          break
        }
        case 'REOPEN': {
          next = pushStage(next, 'EC_DECISION', at, reason, state.config)
          break
        }
        case 'NEXT':
        default: {
          const code = nextStageAfter(app, stage.code)
          if (!code) {
            next = {
              ...next,
              stages: next.stages.map((s) => (s.status === 'active' ? { ...s, status: 'done' as const } : s)),
            }
            break
          }
          next = pushStage(next, code, at, reason || undefined, state.config)
          audit.push(
            logEvent({
              appId: app.id,
              ts: `${at}T11:00:00`,
              role: state.role,
              actor: ACTOR_NAME[state.role],
              type: 'TRANSITION',
              action: `Forwarded to ${STAGE_LABEL[code]}`,
              message: `Stage completed by ${STAGE_ACTOR[stage.code] === state.role ? state.role.toLowerCase() : 'the committee'}; case routed onward by rule (Table-2.3).`,
              reason: reason || undefined,
            }),
          )
          break
        }
      }

      next = {
        ...next,
        stages: next.stages.map((s, i, arr) =>
          i === arr.length - 1 ? s : s.status === 'active' ? { ...s, status: 'done' as const } : s,
        ),
      }

      return {
        ...state,
        apps: state.apps.map((a) => (a.id === app.id ? next : a)),
        audit: [...state.audit, ...audit],
      }
    }

    default:
      return state
  }
}

/* ------------------------------------------------------------------ *
 * CLOCK — crossing deadlines generates alerts and escalations
 * ------------------------------------------------------------------ */
function applyClock(state: State, to: string): State {
  const from = state.now
  if (to === from) return state
  const forward = daysBetween(from, to) > 0
  if (!forward) return { ...state, now: to }

  const notifications: AppNotification[] = []
  const audit: AuditEvent[] = [...state.audit]
  const emitted = new Set(state.emitted)
  const rungs = state.config.escalationRungs

  for (const app of state.apps) {
    const st = currentStage(app)
    if (statusOf(app) === 'OPEN') {
      const before = deadlineState(st.dueAt, from, rungs)
      const after = deadlineState(st.dueAt, to, rungs)
      if (before.level !== after.level) {
        const key = `${st.code}-${st.dueAt}-L${after.level}`
        if (!emitted.has(key)) {
          emitted.add(key)
          const rung = rungs[Math.max(0, after.level - 1)] ?? rungs[0]
          const overdue = after.overdue ? `overdue by ${Math.abs(after.daysLeft)} day(s)` : `${after.daysLeft} day(s) remaining`
          const owner = STAGE_ACTOR[st.code]
          const recipient = ladderRecipient(after.level, owner)
          const nxt = nextEscalationTo(after.level, owner)
          const ladderDays = rungs[Math.min(rungs.length - 1, after.level)]?.afterDays ?? 30
          notifications.push({
            id: nextId('NT'),
            appId: app.id,
            ts: to,
            to: recipient,
            level: after.level,
            kind: after.overdue ? 'ESCALATION' : 'REMINDER',
            subject: `${app.ref} — ${STAGE_LABEL[st.code]} ${overdue}`,
            body:
              `${app.institution}: ${STAGE_LABEL[st.code]} ${overdue} (due ${st.dueAt}). ` +
              `Addressed to ${roleLabel(recipient)}. ` +
              (nxt
                ? `If not cleared, it escalates to ${roleLabel(nxt)} on ${addDays(st.dueAt, ladderDays)} under the ladder.`
                : `Final rung — reported to the Council as critical pendency.`),
          })
          audit.push(
            logEvent({
              appId: app.id,
              ts: `${to}T08:00:00`,
              role: 'SYSTEM',
              actor: ACTOR_NAME.SYSTEM,
              type: after.level >= 2 ? 'ESCALATION' : 'ALERT',
              action: after.overdue ? `Escalation L${after.level} → ${roleLabel(recipient)}` : `Reminder → ${roleLabel(recipient)}`,
              message: `Stage ${st.code} at ${app.ref} is ${overdue}.${after.level ? ` Notified: ${rung.notify}.` : ''}`,
            }),
          )
        }
      }
    }

    for (const ob of app.obligations) {
      if (ob.status === 'verified') continue
      for (const off of crossedThresholds(ob.dueAt, from, to, ob.kind)) {
        const key = `${ob.id}-${off}`
        if (emitted.has(key)) continue
        emitted.add(key)
        notifications.push({
          id: nextId('NT'),
          appId: app.id,
          ts: to,
          to: 'INSTITUTION',
          level: 0,
          kind: 'REMINDER',
          subject: `${off} days to: ${ob.label}`,
          body:
            `${app.institution} — ${ob.label} is due on ${ob.dueAt}. ` +
            `Upload evidence on the portal; if it lapses the case is escalated to the Regulation Bureau.`,
        })
        audit.push(
          logEvent({
            appId: app.id,
            ts: `${to}T07:30:00`,
            role: 'SYSTEM',
            actor: ACTOR_NAME.SYSTEM,
            type: 'ALERT',
            action: `${off}-day reminder issued`,
            message: `Reminder for "${ob.label}" (due ${ob.dueAt}) sent to the institution.`,
          }),
        )
      }
      const before = deadlineState(ob.dueAt, from, rungs)
      const after = deadlineState(ob.dueAt, to, rungs)
      if (before.level !== after.level && after.overdue) {
        const key = `${ob.id}-esc-${after.level}`
        if (!emitted.has(key)) {
          emitted.add(key)
          const rung = rungs[Math.min(rungs.length - 1, after.level - 1)] ?? rungs[0]
          const escTo = ladderRecipient(after.level, 'INSTITUTION')
          const nxt = nextEscalationTo(after.level, 'INSTITUTION')
          notifications.push({
            id: nextId('NT'),
            appId: app.id,
            ts: to,
            to: escTo,
            level: after.level,
            kind: 'ESCALATION',
            subject: `Overdue: ${ob.label}`,
            body:
              `${app.institution} — ${ob.label} is ${Math.abs(after.daysLeft)} day(s) overdue. ` +
              `Escalated to ${roleLabel(escTo)}. ` +
              (nxt ? `Next rung: ${roleLabel(nxt)}.` : `Final rung — Council.`),
          })
          audit.push(
            logEvent({
              appId: app.id,
              ts: `${to}T08:10:00`,
              role: 'SYSTEM',
              actor: ACTOR_NAME.SYSTEM,
              type: 'ESCALATION',
              action: `Escalation L${after.level} → ${roleLabel(escTo)}`,
              message: `"${ob.label}" is ${Math.abs(after.daysLeft)} day(s) overdue. Notified: ${rung.notify}.`,
            }),
          )
        }
      }
    }
  }

  return {
    ...state,
    now: to,
    notifications: [...notifications, ...state.notifications],
    audit,
    emitted: [...emitted],
  }
}

/* ------------------------------------------------------------------ *
 * CONTEXT
 * ------------------------------------------------------------------ */
interface Ctx extends State {
  setRole: (r: RoleCode) => void
  setNow: (d: string) => void
  advance: (days: number) => void
  reset: () => void
  act: (appId: string, actionCode: string, reason: string) => boolean
  submitApp: (spec: NewAppSpec) => string
  verifyObligation: (id: string) => void
  submitEvidence: (obligationId: string, docName: string, docRef: string, note: string) => void
  reviewEvidence: (obligationId: string, approved: boolean, remarks: string) => void
  scheduleEVC: (
    appId: string,
    scheduledDate: string,
    panel: { name: string; designation: string; institution: string }[],
    mode: 'PHYSICAL' | 'HYBRID' | 'VIRTUAL',
    remarks?: string,
  ) => void
  completeEVC: (appId: string, report: string, shortcomings: boolean) => void
  fileAppeal: (appId: string, grounds: string) => boolean
  uploadSupportingDocument: (appId: string, title: string, docRef: string) => void
  uploadRenewedLease: (appId: string, docRef: string, newEndDate: string, notes?: string) => void
  verifyLeaseRenewal: (appId: string, docId: string) => void
  updateConfig: (config: Partial<RegulatoryConfig>) => void
  resetConfig: () => void
  recordOutcome: (appId: string, done: boolean, deficiencies: string, remarks: string) => boolean
  markAllRead: () => void
  institution: typeof INSTITUTION_PROFILE
  alerts: AppNotification[]
  unread: number
}

const StoreCtx = createContext<Ctx | null>(null)

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial)

  const act = useCallback(
    (appId: string, actionCode: string, reason: string) => {
      const app = state.apps.find((a) => a.id === appId)
      if (!app) return false
      const stage = currentStage(app)
      if (!canActAtStage(state.role, stage.code)) return false
      const def = actionsForStage(stage.code).find((a) => a.code === actionCode)
      if (!def) return false
      if (def.reasonRequired && !reason.trim()) return false

      // Check cross-case dependency before calling action
      if (app.blockedByAppId && (def.effect === 'NEXT' || def.effect === 'CLOSE_APPROVED')) {
        const blocker = state.apps.find((a) => a.id === app.blockedByAppId)
        if (blocker && blocker.decision !== 'APPROVED') {
          dispatch({ type: 'ACT', appId, actionCode, reason })
          return false
        }
      }

      dispatch({ type: 'ACT', appId, actionCode, reason })
      return true
    },
    [state.apps, state.role],
  )

  const value = useMemo<Ctx>(
    () => ({
      ...state,
      setRole: (role) => dispatch({ type: 'SET_ROLE', role }),
      setNow: (now) => dispatch({ type: 'SET_NOW', now }),
      advance: (days) => dispatch({ type: 'ADVANCE', days }),
      reset: () => dispatch({ type: 'RESET' }),
      act,
      submitApp: (spec) => {
        const ref = `AP/2026/${1200 + state.seq}`
        dispatch({ type: 'SUBMIT_APP', spec })
        return ref
      },
      verifyObligation: (id) => dispatch({ type: 'VERIFY_OBLIGATION', obligationId: id }),
      submitEvidence: (obligationId, docName, docRef, note) =>
        dispatch({ type: 'SUBMIT_EVIDENCE', obligationId, docName, docRef, note }),
      reviewEvidence: (obligationId, approved, remarks) =>
        dispatch({ type: 'REVIEW_EVIDENCE', obligationId, approved, remarks }),
      scheduleEVC: (appId, scheduledDate, panel, mode, remarks) =>
        dispatch({ type: 'SCHEDULE_EVC', appId, scheduledDate, panel, mode, remarks }),
      completeEVC: (appId, report, shortcomings) => dispatch({ type: 'COMPLETE_EVC', appId, report, shortcomings }),
      fileAppeal: (appId, grounds) => {
        const app = state.apps.find(a => a.id === appId)
        if (!app || state.role !== 'INSTITUTION' || !app.decision || !app.appealUntil || state.now > app.appealUntil || !grounds.trim()) return false
        dispatch({ type: 'FILE_APPEAL', appId, grounds })
        return true
      },
      uploadSupportingDocument: (appId, title, docRef) => dispatch({ type: 'UPLOAD_SUPPORTING_DOCUMENT', appId, title, docRef }),
      uploadRenewedLease: (appId, docRef, newEndDate, notes) =>
        dispatch({ type: 'UPLOAD_RENEWED_LEASE', appId, docRef, newEndDate, notes }),
      verifyLeaseRenewal: (appId, docId) => dispatch({ type: 'VERIFY_LEASE_RENEWAL', appId, docId }),
      updateConfig: (config) => dispatch({ type: 'UPDATE_CONFIG', config }),
      resetConfig: () => dispatch({ type: 'RESET_CONFIG' }),
      recordOutcome: (appId, done, deficiencies, remarks) => {
        const app = state.apps.find((a) => a.id === appId)
        if (!app) return false
        if (STAGE_ACTOR[currentStage(app).code] !== state.role) return false
        if (!done && !deficiencies.trim()) return false
        dispatch({ type: 'OUTCOME', appId, done, deficiencies, remarks })
        return true
      },
      markAllRead: () => dispatch({ type: 'MARK_READ', onlyRole: state.role }),
      institution: INSTITUTION_PROFILE,
      alerts: state.notifications.filter((n) => n.to === state.role),
      unread: state.notifications.filter((n) => n.to === state.role && !n.read).length,
    }),
    [state, act],
  )

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}

export function useStore() {
  const ctx = useContext(StoreCtx)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}

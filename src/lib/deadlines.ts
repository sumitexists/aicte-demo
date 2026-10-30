import type { AppTypeCode, DeadlineSource, EscalationRungConfig, Obligation, ObligationKind, RegulatoryConfig, RoleCode, StageCode } from './types'
import { STAGE_DURATION, appTypeDef } from './workflow'

/* ------------------------------------------------------------------ *
 * DATE HELPERS  (all dates are ISO yyyy-mm-dd, no time zones)
 * ------------------------------------------------------------------ */
export const DAY = 86_400_000

export const iso = (d: Date) => d.toISOString().slice(0, 10)

export const parse = (s: string) => new Date(`${s}T00:00:00Z`)

export const addDays = (s: string, n: number) => iso(new Date(parse(s).getTime() + n * DAY))

export const daysBetween = (from: string, to: string) =>
  Math.round((parse(to).getTime() - parse(from).getTime()) / DAY)

export const fmt = (s?: string) =>
  s ? parse(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—'

export const fmtShort = (s?: string) =>
  s ? parse(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' }) : '—'

/* ------------------------------------------------------------------ *
 * ACADEMIC CALENDAR ANCHORS  — the only hard dates in the system
 * ------------------------------------------------------------------ */
export const ACADEMIC_YEAR = '2026-27'

export interface Anchor {
  code: string
  label: string
  date: string
  source: DeadlineSource
  ref: string
}

export const ANCHORS: Anchor[] = [
  { code: 'CUTOFF', label: 'Last date to submit applications', date: '2026-01-12', source: 'REGULATION', ref: 'Public Notice (extended from earlier date)' },
  { code: 'DECISION', label: 'Last date for AICTE to grant approval', date: '2026-04-30', source: 'REGULATION', ref: 'Academic Calendar, APH cl. 1.10(c)' },
  { code: 'AFFILIATION', label: 'Affiliation by University / Board', date: '2026-05-31', source: 'REGULATION', ref: 'Academic Calendar' },
]

export const DECISION_DEADLINE = '2026-04-30'
export const APPEAL_WINDOW_DAYS = 7

/** The cycle opened here — used only for the progress bar. */
export const CYCLE_START = '2025-11-15'

/**
 * Demo clock. Starts mid-cycle so every seeded history already exists,
 * then runs six months forward: past the 30 April decision wall, through
 * affiliation (31 May) and into the period where post-approval obligations
 * and lease gates actually bite.
 */
export const DEMO_START = '2026-02-16'
export const DEMO_END = '2026-08-31'

/* ------------------------------------------------------------------ *
 * BACK-PLANNING — derived stage deadlines from the 30 April wall
 * ------------------------------------------------------------------ */
export interface PlannedStage {
  code: StageCode
  latestStart: string
  latestEnd: string
  days: number
}

export interface BackPlan {
  stages: PlannedStage[]
  latestStart: string
  totalDays: number
  /** every duration used here is an ASSUMED processing duration */
  assumptions: { code: StageCode; days: number }[]
}

export const DEFAULT_REGULATORY_CONFIG: RegulatoryConfig = {
  academicYear: ACADEMIC_YEAR,
  decisionDeadline: DECISION_DEADLINE,
  cutoffDate: '2026-01-12',
  affiliationDeadline: '2026-05-31',
  stageDurations: { ...STAGE_DURATION },
  escalationRungs: [
    { level: 1, afterDays: 0, notify: 'Case assignee', label: 'Reminder to assignee' },
    { level: 2, afterDays: 7, notify: 'Regulation Bureau', label: 'Bureau escalation' },
    { level: 3, afterDays: 15, notify: 'Executive Committee', label: 'EC escalation' },
    { level: 4, afterDays: 30, notify: 'Council', label: 'Critical pendency — Council' },
  ],
  paceGamma: 1.7,
  paceMax: 3.0,
  paceMin: 0.2,
}

export function backPlan(
  type: AppTypeCode,
  decisionDeadline = DECISION_DEADLINE,
  durations: Record<StageCode, number> = STAGE_DURATION,
): BackPlan {
  const def = appTypeDef(type)
  // everything before the decision must fit before the wall
  const pre = def.plan.filter((s) => s !== 'SUBMITTED')
  const stages: PlannedStage[] = []
  let cursor = decisionDeadline
  for (let i = pre.length - 1; i >= 0; i--) {
    const code = pre[i]
    const days = durations[code] ?? STAGE_DURATION[code]
    const latestEnd = cursor
    const latestStart = addDays(latestEnd, -days)
    stages.unshift({ code, latestStart, latestEnd, days })
    cursor = latestStart
  }
  return {
    stages,
    latestStart: cursor,
    totalDays: daysBetween(cursor, decisionDeadline),
    assumptions: pre.map((code) => ({ code, days: durations[code] ?? STAGE_DURATION[code] })),
  }
}

/** Can a case starting today still reach a decision before the wall? */
export function feasibility(type: AppTypeCode, now: string) {
  const plan = backPlan(type)
  const slackDays = daysBetween(now, plan.latestStart)
  return {
    plan,
    slackDays,
    feasible: slackDays >= 0,
    /** how many days past the safe start we already are */
    behindBy: slackDays < 0 ? -slackDays : 0,
  }
}

/* ------------------------------------------------------------------ *
 * DYNAMIC PACE ALLOCATION
 *
 * Fixed per-stage durations ignore the only thing that actually matters:
 * the case must be decided before 30 April. So every stage deadline is
 * allocated from the time remaining, scaled against the stage weights:
 *
 *   factor = clamp( (daysLeft / sum(remaining weights)) ^ GAMMA, 0.2 .. 3 )
 *   due(i) = start + sum of the first i scaled weights
 *
 * GAMMA > 1 makes the curve exponential: a case sitting comfortably gets a
 * due date pushed out disproportionately far, while a case that is short on
 * time is squeezed much harder than a linear rule would. That mirrors how a
 * backlog actually behaves — comfortable work drifts, tight work collapses.
 * A case that cannot fit even at maximum compression is flagged infeasible.
 * ------------------------------------------------------------------ */
export const PACE_MAX = 3
export const PACE_MIN = 0.2
/** exponent: >1 stretches slack, <1 shortens it. This is the "lil more" knob. */
export const PACE_GAMMA = 1.7

export interface Pace {
  /** multiplier actually applied */
  factor: number
  /** what the raw arithmetic asked for, before clamping */
  raw: number
  availableDays: number
  neededDays: number
  /** can the remaining chain still fit before the deadline? */
  feasible: boolean
  /** relaxed / on pace / compressed */
  band: 'RELAXED' | 'ON_PACE' | 'COMPRESSED' | 'INFEASIBLE'
}

export function paceFor(
  weights: number[],
  at: string,
  deadline = DECISION_DEADLINE,
  gamma = PACE_GAMMA,
  maxPace = PACE_MAX,
  minPace = PACE_MIN,
): Pace {
  const neededDays = weights.reduce((a, b) => a + b, 0)
  const availableDays = Math.max(0, daysBetween(at, deadline))
  const raw = neededDays === 0 ? 1 : availableDays / neededDays
  const factor = Math.min(maxPace, Math.max(minPace, Math.pow(raw, gamma)))
  const feasible = availableDays >= neededDays * minPace
  const band: Pace['band'] = !feasible
    ? 'INFEASIBLE'
    : factor >= 1.25
      ? 'RELAXED'
      : factor <= 0.8
        ? 'COMPRESSED'
        : 'ON_PACE'
  return { factor, raw, availableDays, neededDays, feasible, band }
}

/** Stages still to be processed once `stage` is the current one. */
function stagesAfter(type: AppTypeCode, stage: StageCode): StageCode[] {
  const plan = appTypeDef(type).plan
  if (stage === 'INSTITUTION_REPLY' || stage === 'RE_SCRUTINY') {
    const i = plan.indexOf('SCRUTINY')
    return i >= 0 ? plan.slice(i + 1) : []
  }
  if (stage === 'SHC') return plan.filter((c) => c === 'EC_DECISION' || c === 'COUNCIL_RATIFICATION')
  if (stage === 'APPEAL') return []
  const i = plan.indexOf(stage)
  return i >= 0 ? plan.slice(i + 1) : []
}

/** Weights for the current stage plus everything still ahead of it. */
export function remainingWeights(
  type: AppTypeCode,
  stage: StageCode,
  durations: Record<StageCode, number> = STAGE_DURATION,
): number[] {
  const d = (code: StageCode) => durations[code] ?? STAGE_DURATION[code]
  return [d(stage), ...stagesAfter(type, stage).map((c) => d(c))]
}

/** The deadline the current stage should carry, and the pace that produced it. */
export function allocatedDueFor(
  type: AppTypeCode,
  stage: StageCode,
  at: string,
  deadline = DECISION_DEADLINE,
  durations: Record<StageCode, number> = STAGE_DURATION,
  gamma = PACE_GAMMA,
): { dueAt: string; pace: Pace } {
  const weights = remainingWeights(type, stage, durations)
  const pace = paceFor(weights, at, deadline, gamma)
  const first = Math.max(1, Math.round(weights[0] * pace.factor))
  return { dueAt: addDays(at, first), pace }
}

/* ------------------------------------------------------------------ *
 * DEADLINE STATE + ESCALATION LADDER
 * ------------------------------------------------------------------ */
export interface DeadlineState {
  daysLeft: number
  overdue: boolean
  /** 0 = on time, 1..4 = escalation rungs */
  level: number
}

/** Administrative ladder: 0 / 7 / 15 / 30 days overdue. Not in the APH. */
export const ESCALATION_LADDER = [
  { level: 1, afterDays: 0, notify: 'Case assignee', label: 'Reminder to assignee' },
  { level: 2, afterDays: 7, notify: 'Regulation Bureau', label: 'Bureau escalation' },
  { level: 3, afterDays: 15, notify: 'Executive Committee', label: 'EC escalation' },
  { level: 4, afterDays: 30, notify: 'Council', label: 'Critical pendency — Council' },
]

/**
 * Who an alert is addressed to at a given escalation rung.
 * Level 1 (and every pre-due reminder) stays with the officer who holds the
 * stage; past that it climbs: Bureau → Executive Committee → Council.
 */
export function ladderRecipient(level: number, stageOwner: RoleCode): RoleCode {
  if (level <= 1) return stageOwner
  if (level === 2) return 'BUREAU'
  if (level === 3) return 'EC'
  return 'COUNCIL'
}

/** The rung a one-rung-up escalation would hand off to — shown on the alert. */
export function nextEscalationTo(level: number, stageOwner: RoleCode): RoleCode | null {
  if (level >= 4) return null
  return ladderRecipient(level + 1, stageOwner)
}

export function deadlineState(
  dueAt: string,
  now: string,
  rungs: EscalationRungConfig[] = ESCALATION_LADDER,
): DeadlineState {
  const daysLeft = daysBetween(now, dueAt)
  if (daysLeft >= 0) return { daysLeft, overdue: false, level: 0 }
  const late = -daysLeft
  const sorted = [...rungs].sort((a, b) => b.afterDays - a.afterDays)
  for (const r of sorted) {
    if (late >= r.afterDays) {
      return { daysLeft, overdue: true, level: r.level }
    }
  }
  return { daysLeft, overdue: true, level: 1 }
}

/** Reminder offsets before a deadline, per obligation kind. */
export const REMINDER_OFFSETS: Record<ObligationKind, number[]> = {
  DOC_VALIDITY: [90, 60, 30, 15, 7],
  TIME_BOUND: [30, 15, 7, 1],
  COMPUTED_GATE: [120, 90, 60, 30],
}

/** Thresholds crossed between two clock positions — used to emit alerts. */
export function crossedThresholds(dueAt: string, from: string, to: string, kind: ObligationKind): number[] {
  const offsets = REMINDER_OFFSETS[kind]
  return offsets.filter((off) => {
    const fire = addDays(dueAt, -off)
    return daysBetween(from, fire) > 0 && daysBetween(to, fire) <= 0
  })
}

/* ------------------------------------------------------------------ *
 * LEASE GATE — APH cl. 2.4(e)
 * ------------------------------------------------------------------ */
/**
 * "The Council shall not issue EoA from the year in which the Live Lease
 *  is equal to the number of years of the Course having the maximum duration."
 */
export function leaseGate(
  leaseEnd: string,
  maxCourseDurationYears: number,
  evaluationDate: string,
  extendedBy30Years = false,
) {
  const liveLeaseYears = daysBetween(evaluationDate, leaseEnd) / 365.25
  const blocked = !extendedBy30Years && liveLeaseYears <= maxCourseDurationYears
  return {
    liveLeaseYears: Math.max(0, Math.round(liveLeaseYears * 10) / 10),
    maxCourseDurationYears,
    evaluatedForYear: ACADEMIC_YEAR,
    blocked,
    escape: extendedBy30Years ? 'Lease extension of 30 years filed — application may be considered.' : null,
  }
}

/* ------------------------------------------------------------------ *
 * OBLIGATION FACTORY — created BY the approval event, not typed in later
 * ------------------------------------------------------------------ */
let obSeq = 0
const nextObligationId = () => `OB-${String(++obSeq).padStart(3, '0')}`

export function buildObligations(
  appId: string,
  type: AppTypeCode,
  approvedOn: string,
  lease?: { endDate: string; maxCourseDurationYears: number },
): Obligation[] {
  const def = appTypeDef(type)
  const out: Obligation[] = []

  const push = (o: Omit<Obligation, 'id' | 'appId'>) =>
    out.push({ id: nextObligationId(), appId, ...o })

  for (const code of def.createsObligations) {
    switch (code) {
      case 'FACULTY_PRINCIPAL':
        push({
          kind: 'TIME_BOUND', code, label: 'Appoint Principal/Director and faculty (APH cl. 1.6)',
          dueAt: addDays(approvedOn, 180), source: 'DERIVED', status: 'open',
        })
        break
      case 'SECURITY_DEPOSIT':
        push({
          kind: 'TIME_BOUND', code, label: 'Security deposit credit (doubled for leased buildings)',
          dueAt: addDays(approvedOn, 30), source: 'DERIVED', status: 'open',
        })
        break
      case 'LAB_READINESS':
        push({
          kind: 'TIME_BOUND', code, label: 'Laboratory equipment installed and verified',
          dueAt: addDays(approvedOn, 180), source: 'DERIVED', status: 'open',
        })
        break
      case 'ANNUAL_DATA':
        push({
          kind: 'TIME_BOUND', code, label: `Annual data submission (AY ${ACADEMIC_YEAR}) even where multi-year EoA granted`,
          dueAt: '2026-01-12', source: 'REGULATION', status: 'open',
        })
        break
      case 'STUDENT_TRANSFER':
        push({
          kind: 'TIME_BOUND', code, label: 'Student transfer to other institutions completed',
          dueAt: addDays(approvedOn, 90), source: 'DERIVED', status: 'open',
        })
        break
      case 'RECORD_PRESERVATION':
        push({
          kind: 'TIME_BOUND', code, label: 'Records preserved for the prescribed period',
          dueAt: addDays(approvedOn, 1825), source: 'DERIVED', status: 'open',
        })
        break
      case 'LEASE_GATE':
        if (lease) {
          const gate = leaseGate(lease.endDate, lease.maxCourseDurationYears, approvedOn)
          push({
            kind: 'COMPUTED_GATE', code, label: 'Live lease must exceed maximum course duration',
            dueAt: addDays(lease.endDate, -365), source: 'REGULATION', status: gate.blocked ? 'breached' : 'open',
            expiryDate: lease.endDate, gate,
          })
        }
        break
    }
  }
  return out
}

import type {
  Application,
  AppNotification,
  AppTypeCode,
  AuditEvent,
  Decision,
  RoleCode,
  StageCode,
  StageStatus,
} from './types'
import { APP_TYPES, STAGE_ACTOR, STAGE_DURATION, appTypeDef } from './workflow'
import { addDays, allocatedDueFor, buildObligations, daysBetween, ladderRecipient } from './deadlines'

export const REGIONS = ['Western', 'Southern', 'Northern', 'Eastern', 'Central'] as const

/** The institution the demo is signed in as. */
export const INSTITUTION_PROFILE = {
  name: 'Sahyadri Institute of Technology, Pune',
  code: 'INST-PNQ-0442',
  region: 'Western',
  authorisedSignatory: 'Anita Deshpande, Registrar',
}

export const PEOPLE: Record<RoleCode, { name: string; designation: string }> = {
  INSTITUTION: { name: 'Anita Deshpande', designation: 'Registrar' },
  SCRUTINY: { name: 'Dr. R. Menon', designation: 'Scrutiny Committee' },
  EVC: { name: 'Prof. A. Kulkarni', designation: 'EVC Chair' },
  SHC: { name: 'S. Bhandari (Retd.)', designation: 'SHC Chair' },
  SAC: { name: 'Prof. M. Iyer', designation: 'SAC Chair' },
  BUREAU: { name: 'K. Raghavan', designation: 'Deputy Director, Regulation Bureau' },
  EC: { name: 'Dr. P. Nair', designation: 'Member Secretary, Executive Committee' },
  COUNCIL: { name: 'Prof. V. Sharma', designation: 'Chairman, AICTE Council' },
}

export const ACTOR_NAME: Record<RoleCode | 'SYSTEM', string> = {
  INSTITUTION: `${PEOPLE.INSTITUTION.name} — ${INSTITUTION_PROFILE.name}`,
  SCRUTINY: `${PEOPLE.SCRUTINY.name} — Scrutiny Committee`,
  EVC: `${PEOPLE.EVC.name} — EVC Chair`,
  SHC: `${PEOPLE.SHC.name} — SHC Chair`,
  SAC: `${PEOPLE.SAC.name} — SAC Chair`,
  BUREAU: `${PEOPLE.BUREAU.name} — Regulation Bureau`,
  EC: `${PEOPLE.EC.name} — Executive Committee`,
  COUNCIL: `${PEOPLE.COUNCIL.name} — Council`,
  SYSTEM: 'System',
}

export const DEMO_TODAY = '2026-02-16'

/* ------------------------------------------------------------------ *
 * SPEC + BUILDER
 * ------------------------------------------------------------------ */
interface Spec {
  ref: string
  type: AppTypeCode
  institution: string
  region: string
  createdAt: string
  stages: [StageCode, string][]
  returns?: number
  deficiencies?: { text: string; raisedAt: string; clearedAt?: string }[]
  decision?: Decision
  decisionAt?: string
  appealUntil?: string
  lease?: { startDate: string; endDate: string; maxCourseDurationYears: number }
  closedAt?: string
  blockedByAppId?: string
  blockedReason?: string
}

function make(spec: Spec): Application {
  const stages = spec.stages.map(([code, enteredAt], i) => {
    const isLast = i === spec.stages.length - 1
    const status: StageStatus = isLast ? 'active' : 'done'
    return {
      code,
      actorRole: STAGE_ACTOR[code],
      enteredAt,
      // the same pace allocator the running app uses, applied at entry time
      dueAt: allocatedDueFor(spec.type, code, enteredAt).dueAt,
      slaDays: STAGE_DURATION[code],
      source: code === 'APPEAL' ? ('REGULATION' as const) : ('ADMIN' as const),
      status,
    }
  })

  const appId = spec.ref
  const obligations =
    spec.decision === 'APPROVED' || spec.decision === 'APPROVED_WITH_CONDITIONS'
      ? buildObligations(appId, spec.type, spec.decisionAt ?? spec.createdAt, spec.lease)
      : []

  if (appId === 'AP/2026/1078' && obligations.length > 0) {
    obligations[0].status = 'submitted'
    obligations[0].submittedAt = '2026-02-14'
    obligations[0].submittedDocName = 'Director_Appointment_Order_and_Joining.pdf'
    obligations[0].submittedDocRef = 'CIE/ADMIN/2026/DIR-01'
    obligations[0].evidenceNote = 'Interview committee approved candidate Dr. P. Verghese. Full appointment letter, council qualification verification and joining report uploaded.'
  }

  const leaseDocuments = spec.lease
    ? [
        {
          id: `LD-${appId}`,
          title: 'Registered 30-Year Campus Lease Deed',
          docRef: `MH-REG/PUN/${appId.split('/')[2]}`,
          startDate: spec.lease.startDate,
          endDate: spec.lease.endDate,
          uploadedAt: spec.createdAt,
          status: spec.lease.endDate < '2027-01-01' ? ('EXPIRING_SOON' as const) : ('VALID' as const),
          fileSize: '4.2 MB',
          verifiedBy: 'AICTE Legal Scrutiny Cell',
          notes: 'Registered with Sub-Registrar Office, Haveli, Pune.',
        },
      ]
    : undefined

  const evcStage = stages.find((s) => s.code === 'EVC')
  let evcSchedule = undefined
  if (evcStage) {
    const isCompleted = stages.some((_, idx) => {
      const evcIdx = stages.findIndex((st) => st.code === 'EVC')
      return idx > evcIdx
    })
    evcSchedule = {
      id: `EVC-${appId}`,
      appId,
      scheduledDate: isCompleted ? addDays(evcStage.enteredAt, 5) : addDays(evcStage.enteredAt, 7),
      mode: 'PHYSICAL' as const,
      status: isCompleted ? ('VISIT_COMPLETED' as const) : ('SCHEDULED' as const),
      assignedPanel: [
        { name: 'Prof. A. Kulkarni', designation: 'EVC Chair', institution: 'IIT Bombay' },
        { name: 'Dr. Neha Verma', designation: 'Expert Member (Architecture)', institution: 'SPA Delhi' },
        { name: 'Er. R. Singhania', designation: 'Industry Representative', institution: 'CII Council' },
      ],
      scheduledAt: evcStage.enteredAt,
      scheduledBy: 'Prof. A. Kulkarni — EVC Chair',
      venue: `${spec.institution} Main Campus`,
      reportSummary: isCompleted ? 'Infrastructure and faculty verified on site. Found fully compliant with APH standards.' : undefined,
      shortcomingsFound: false,
    }
  }

  return {
    id: appId,
    ref: spec.ref,
    type: spec.type,
    institution: spec.institution,
    region: spec.region,
    createdAt: spec.createdAt,
    stages,
    deficiencies: (spec.deficiencies ?? []).map((d, i) => ({ id: `${appId}-D${i + 1}`, stage: 'SCRUTINY' as StageCode, ...d })),
    returns: spec.returns ?? 0,
    decision: spec.decision ?? null,
    decisionAt: spec.decisionAt,
    appealUntil: spec.appealUntil,
    closedAt: spec.closedAt,
    lease: spec.lease,
    leaseDocuments,
    evcSchedule,
    blockedByAppId: spec.blockedByAppId,
    blockedReason: spec.blockedReason,
    obligations,
  }
}

/* ------------------------------------------------------------------ *
 * CURATED CASES — the demo story
 * ------------------------------------------------------------------ */
const CURATED: Spec[] = [
  {
    ref: 'AP/2026/5022', type: 'CLOSURE', institution: 'Sahyadri Polytechnic, Pune (Old Campus)',
    region: 'Western', createdAt: '2025-11-15',
    stages: [['SUBMITTED', '2025-11-15'], ['SCRUTINY', '2025-11-25']],
  },
  {
    ref: 'AP/2026/1104', type: 'NEW_INSTITUTION', institution: INSTITUTION_PROFILE.name,
    region: 'Western', createdAt: '2025-11-20',
    stages: [['SUBMITTED', '2025-11-20'], ['SCRUTINY', '2025-11-24'], ['EVC', '2026-02-02']],
    lease: { startDate: '2024-06-01', endDate: '2027-03-31', maxCourseDurationYears: 4 },
    blockedByAppId: 'AP/2026/5022',
    blockedReason: 'APH cl. 1.8(i): Closure of existing polytechnic on the same campus premises must be decided first before this New Institution case can be approved.',
  },
  {
    ref: 'AP/2026/1121', type: 'NEW_INSTITUTION', institution: 'Ganga Valley Technical Campus, Kanpur',
    region: 'Central', createdAt: '2025-12-02',
    stages: [['SUBMITTED', '2025-12-02'], ['SCRUTINY', '2026-02-10']],
    lease: { startDate: '2025-01-10', endDate: '2056-01-09', maxCourseDurationYears: 4 },
  },
  {
    ref: 'AP/2026/1078', type: 'NEW_INSTITUTION', institution: 'Coastal Institute of Engineering, Kochi',
    region: 'Southern', createdAt: '2025-11-18',
    stages: [['SUBMITTED', '2025-11-18'], ['SCRUTINY', '2025-11-22'], ['EVC', '2025-12-18'], ['EC_DECISION', '2026-01-20'], ['COUNCIL_RATIFICATION', '2026-02-04']],
    decision: 'APPROVED', decisionAt: '2026-02-10', closedAt: '2026-02-10',
    lease: { startDate: '2024-04-01', endDate: '2027-03-31', maxCourseDurationYears: 4 },
  },
  {
    ref: 'AP/2026/1090', type: 'NEW_INSTITUTION', institution: 'Vatsalya Institute of Design, Ahmedabad',
    region: 'Western', createdAt: '2025-11-22',
    stages: [['SUBMITTED', '2025-11-22'], ['SCRUTINY', '2025-11-26'], ['EVC', '2025-12-22'], ['EC_DECISION', '2026-01-28'], ['APPEAL', '2026-02-06']],
    decision: 'REJECTED', decisionAt: '2026-01-30', appealUntil: '2026-02-06',
    lease: { startDate: '2023-07-01', endDate: '2026-06-30', maxCourseDurationYears: 4 },
  },
  {
    ref: 'AP/2026/1988', type: 'EOA_SELF_DISCLOSURE', institution: 'Yamuna Business School, Delhi',
    region: 'Northern', createdAt: '2025-12-20',
    stages: [['SUBMITTED', '2025-12-20'], ['SELF_DISCLOSURE', '2025-12-22']],
    decision: 'APPROVED', decisionAt: '2025-12-30', closedAt: '2025-12-30',
    lease: { startDate: '2019-07-01', endDate: '2027-06-30', maxCourseDurationYears: 2 },
  },
  {
    ref: 'AP/2026/3044', type: 'INCREASE_INTAKE', institution: 'Kalinga Engineering College, Bhubaneswar',
    region: 'Eastern', createdAt: '2025-12-01',
    stages: [['SUBMITTED', '2025-12-01'], ['SCRUTINY', '2025-12-05'], ['INSTITUTION_REPLY', '2025-12-22'], ['RE_SCRUTINY', '2026-02-11']],
    returns: 1,
    deficiencies: [{ text: 'Faculty list shows 6 vacancies against the increased intake; appointment letters not uploaded.', raisedAt: '2025-12-16' }],
    lease: { startDate: '2021-06-01', endDate: '2031-05-31', maxCourseDurationYears: 4 },
  },
  {
    ref: 'AP/2026/4012', type: 'NEW_PROGRAMME', institution: 'Ashoka Technical University, Bengaluru',
    region: 'Southern', createdAt: '2025-11-28',
    stages: [['SUBMITTED', '2025-11-28'], ['SCRUTINY', '2025-12-02'], ['EVC', '2025-12-24'], ['SHC', '2026-02-03']],
    lease: { startDate: '2015-06-01', endDate: '2045-05-31', maxCourseDurationYears: 2 },
  },
  {
    ref: 'AP/2026/5015', type: 'CLOSURE', institution: 'Rural Engineering College, Raipur',
    region: 'Central', createdAt: '2025-11-30',
    stages: [['SUBMITTED', '2025-11-30'], ['SCRUTINY', '2025-12-04'], ['EC_DECISION', '2026-01-05'], ['COUNCIL_RATIFICATION', '2026-01-19']],
    decision: 'APPROVED', decisionAt: '2026-01-24', closedAt: '2026-01-24',
  },
]

/* ------------------------------------------------------------------ *
 * GENERATED CASES — 10 per type, spread across regions and outcomes
 * ------------------------------------------------------------------ */
const PREFIXES: Record<string, string[]> = {
  Western: ['Konkan', 'Marathwada', 'Sahyadri', 'Vidarbha', 'Khandesh'],
  Southern: ['Kaveri', 'Coromandel', 'Nilgiri', 'Malabar', 'Tungabhadra'],
  Northern: ['Shivalik', 'Aravalli', 'Saraswati', 'Kurukshetra', 'Pir Panjal'],
  Eastern: ['Brahmaputra', 'Chilika', 'Subarnarekha', 'Darjeeling', 'Mahanadi'],
  Central: ['Satpura', 'Bundelkhand', 'Vindhya', 'Chambal', 'Gondwana'],
}

const KINDS = ['Institute of Technology', 'Engineering College', 'Polytechnic', 'College of Management', 'Institute of Computer Applications']
const CITIES: Record<string, string[]> = {
  Western: ['Pune', 'Nashik', 'Nagpur', 'Kolhapur', 'Aurangabad'],
  Southern: ['Mysuru', 'Coimbatore', 'Vijayawada', 'Thiruvananthapuram', 'Hubballi'],
  Northern: ['Jaipur', 'Dehradun', 'Chandigarh', 'Lucknow', 'Srinagar'],
  Eastern: ['Guwahati', 'Bhubaneswar', 'Patna', 'Kolkata', 'Ranchi'],
  Central: ['Bhopal', 'Raipur', 'Jabalpur', 'Gwalior', 'Indore'],
}

function prng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

type Profile = 'fresh' | 'scrutiny' | 'returned' | 'evc' | 'shc' | 'ec' | 'council' | 'approved' | 'rejected' | 'appeal' | 'selfdisc'

const PROFILES: Record<AppTypeCode, Profile[]> = {
  NEW_INSTITUTION: ['fresh', 'evc', 'council', 'approved', 'rejected', 'appeal', 'ec', 'evc', 'approved', 'fresh'],
  EOA_SELF_DISCLOSURE: ['selfdisc', 'selfdisc', 'approved', 'selfdisc', 'approved', 'selfdisc', 'approved', 'selfdisc', 'selfdisc', 'approved'],
  INCREASE_INTAKE: ['scrutiny', 'evc', 'returned', 'ec', 'approved', 'council', 'evc', 'rejected', 'scrutiny', 'approved'],
  NEW_PROGRAMME: ['scrutiny', 'evc', 'shc', 'approved', 'returned', 'ec', 'evc', 'approved', 'council', 'rejected'],
  CLOSURE: ['scrutiny', 'ec', 'approved', 'council', 'approved', 'scrutiny', 'rejected', 'ec', 'approved', 'scrutiny'],
}

function stageChainFor(type: AppTypeCode, profile: Profile): StageCode[] {
  const plan = appTypeDef(type).plan
  const base = plan.filter((s) => s !== 'SUBMITTED')
  switch (profile) {
    case 'fresh':
      return [base[0]]
    case 'scrutiny':
      return [base[0]]
    case 'returned':
      return [base[0], 'INSTITUTION_REPLY']
    case 'selfdisc':
      return ['SELF_DISCLOSURE']
    case 'evc':
      return base.slice(0, 2)
    case 'shc':
      return [...base.slice(0, 2), 'SHC']
    case 'ec':
      return [...base.slice(0, 2), 'EC_DECISION']
    case 'council':
      return [...base.slice(0, 2), 'EC_DECISION', 'COUNCIL_RATIFICATION']
    case 'approved':
      return [...base.slice(0, 2), 'EC_DECISION', 'COUNCIL_RATIFICATION']
    case 'rejected':
      return [...base.slice(0, 3)]
    case 'appeal':
      return ['SCRUTINY', 'EVC', 'EC_DECISION', 'APPEAL']
    default:
      return base.slice(0, 1)
  }
}

function generatedSpecs(): Spec[] {
  const random = prng(20260216)
  const refs = 1200
  let refCounter = refs
  const out: Spec[] = []

  for (const type of APP_TYPES.map((t) => t.code)) {
    const profiles = PROFILES[type]
    // top up to exactly ten cases of each type, alongside the curated ones
    const need = Math.max(0, 10 - CURATED.filter((s) => s.type === type).length)
    for (let i = 0; i < need; i++) {
      const r = random()
      const region = REGIONS[Math.floor(r * REGIONS.length)]
      const prefix = PREFIXES[region][Math.floor(random() * 5)]
      const kind = KINDS[Math.floor(random() * KINDS.length)]
      const city = CITIES[region][Math.floor(random() * 5)]
      const profile = profiles[i % profiles.length]

      const chain = stageChainFor(type, profile)
      const currentCode = chain[chain.length - 1]

      // How much time does the pace allocator give this stage if it began today?
      const allocDays = Math.max(
        1,
        daysBetween(DEMO_TODAY, allocatedDueFor(type, currentCode, DEMO_TODAY).dueAt),
      )

      // Deliberate mix on the board: ~20% already late, ~60% comfortably
      // inside their window (the exponential curve pushes these far out),
      // ~20% about to fall due.
      const slot = i % 10
      const mode = slot <= 1 ? 'overdue' : slot <= 7 ? 'ontrack' : 'near'

      const backSpan = (chain.length - 1) * 9 + 6
      const maxGap = Math.max(0, daysBetween('2025-11-18', DEMO_TODAY) - backSpan)

      let gap: number
      if (mode === 'overdue') gap = Math.min(maxGap, allocDays + 3 + Math.floor(random() * 22))
      else if (mode === 'near') gap = Math.max(1, allocDays - (1 + Math.floor(random() * 5)))
      else gap = Math.floor(random() * Math.max(1, Math.min(4, allocDays - 2)))

      // closed cases must already have their decision behind today
      if (profile === 'approved' || profile === 'rejected' || profile === 'appeal') {
        gap = Math.max(gap, 14)
      }

      // stamp the chain backwards from the current stage so history stays consistent
      const current = addDays(DEMO_TODAY, -gap)
      const stages: [StageCode, string][] = []
      let cursor = current
      for (let k = chain.length - 1; k >= 0; k--) {
        const code = chain[k]
        stages.unshift([code, cursor])
        cursor = addDays(cursor, -(STAGE_DURATION[code] + 1 + Math.floor(random() * 3)))
      }
      stages.unshift(['SUBMITTED', cursor])

      const createdAt = stages[0][1]
      const lastEntered = stages[stages.length - 1][1]

      const ref = `AP/2026/${refCounter++}`
      const spec: Spec = {
        ref,
        type,
        institution: `${prefix} ${kind}, ${city}`,
        region,
        createdAt,
        stages,
        lease: {
          startDate: addDays(createdAt, -900),
          endDate: addDays(createdAt, 900 + Math.floor(random() * 1200)),
          maxCourseDurationYears: type === 'EOA_SELF_DISCLOSURE' ? 2 : 4,
        },
      }

      if (profile === 'returned') {
        spec.returns = 1
        spec.deficiencies = [
          {
            text: 'Lease deed uploaded is not registered; registered deed required as per Annexure-2.',
            raisedAt: addDays(createdAt, 12),
          },
        ]
      }

      if (profile === 'approved' || profile === 'appeal') {
        const decisionAt = addDays(lastEntered, 4)
        spec.decision = 'APPROVED'
        spec.decisionAt = decisionAt
        spec.appealUntil = addDays(decisionAt, 7)
        spec.closedAt = decisionAt
      }

      if (profile === 'rejected') {
        const decisionAt = addDays(lastEntered, 4)
        spec.decision = 'REJECTED'
        spec.decisionAt = decisionAt
        spec.appealUntil = addDays(decisionAt, 7)
      }

      out.push(spec)
    }
  }

  // Four of the generated cases belong to the signed-in institution,
  // so the Institution role sees five cases in total (with AP/2026/1104).
  const owned: AppTypeCode[] = ['INCREASE_INTAKE', 'NEW_PROGRAMME', 'CLOSURE', 'EOA_SELF_DISCLOSURE']
  for (const t of owned) {
    const target = out.find((s) => s.type === t && s.institution !== INSTITUTION_PROFILE.name)
    if (target) {
      target.institution = INSTITUTION_PROFILE.name
      target.region = INSTITUTION_PROFILE.region
    }
  }

  return out
}

/**
 * Keep the demo register current and believable: every seeded filing starts
 * between 16 and 20 January, while retaining a mixed stage distribution for
 * dashboard, EVC and escalation demonstrations.
 */
function compactToJanuary(spec: Spec, index: number): Spec {
  const start = addDays('2026-01-16', index % 5)
  let cursor = start
  const stages = spec.stages.map(([code, enteredAt], stageIndex, original) => {
    if (stageIndex > 0) {
      const originalGap = daysBetween(original[stageIndex - 1][1], enteredAt)
      cursor = addDays(cursor, Math.max(2, Math.min(4, originalGap)))
    }
    return [code, cursor] as [StageCode, string]
  })
  const last = stages[stages.length - 1][1]
  const decisionAt = spec.decision ? addDays(last, 2) : undefined
  return {
    ...spec,
    createdAt: start,
    stages,
    decisionAt,
    closedAt: spec.closedAt ? decisionAt : undefined,
    appealUntil: spec.appealUntil && decisionAt ? addDays(decisionAt, 7) : undefined,
    deficiencies: spec.deficiencies?.map((d) => ({ ...d, raisedAt: addDays(start, 4) })),
  }
}

export const seedApplications = (): Application[] =>
  [...CURATED, ...generatedSpecs()].map(compactToJanuary).map(make)

/* ------------------------------------------------------------------ *
 * AUDIT TRAIL — consistent history for every case
 * ------------------------------------------------------------------ */
export function seedAudit(apps: Application[]): AuditEvent[] {
  const events: AuditEvent[] = []
  let n = 0
  const log = (e: Omit<AuditEvent, 'id'>) => {
    events.push({ id: `EV-${String(++n).padStart(5, '0')}`, ...e })
  }

  for (const app of apps) {
    log({
      appId: app.id, ts: `${app.createdAt}T10:15:00`, role: 'INSTITUTION',
      actor: ACTOR_NAME.INSTITUTION, type: 'SUBMIT',
      action: 'Application submitted',
      message: `${appTypeDef(app.type).label} application received on the AICTE portal; TER charges paid; unique ID ${app.ref} allotted.`,
    })

    app.stages.forEach((st, i) => {
      if (i === 0) return
      const prev = app.stages[i - 1]
      if (st.code === 'INSTITUTION_REPLY') {
        log({
          appId: app.id, ts: `${prev.dueAt}T12:40:00`, role: 'SCRUTINY', actor: ACTOR_NAME.SCRUTINY,
          type: 'RETURN', action: 'Returned to institution',
          message: 'Deficiencies communicated on the web-portal for compliance.',
          reason: app.deficiencies[0]?.text ?? 'Deficiency observed during scrutiny.',
        })
        log({
          appId: app.id, ts: `${st.enteredAt}T16:05:00`, role: 'INSTITUTION', actor: ACTOR_NAME.INSTITUTION,
          type: 'DOCUMENT', action: 'Compliance evidence uploaded',
          message: 'Institution uploaded revised documents against the deficiency list.',
        })
        return
      }
      if (st.code === 'RE_SCRUTINY') {
        log({
          appId: app.id, ts: `${st.enteredAt}T11:00:00`, role: 'SCRUTINY', actor: ACTOR_NAME.SCRUTINY,
          type: 'TRANSITION', action: 'Re-Scrutiny opened',
          message: 'Re-Scrutiny verifies ONLY the deficiencies already raised (APH cl. 1.8(g)).',
        })
        return
      }
      log({
        appId: app.id, ts: `${st.enteredAt}T09:30:00`, role: st.actorRole, actor: ACTOR_NAME[st.actorRole],
        type: 'TRANSITION', action: `Moved to ${STAGE_LABEL_SAFE(st.code)}`,
        message: 'Previous stage completed; case routed onward by rule (APH Table-2.3).',
      })
    })

    if (app.decisionAt) {
      const approved = app.decision === 'APPROVED' || app.decision === 'APPROVED_WITH_CONDITIONS'
      log({
        appId: app.id, ts: `${app.decisionAt}T15:20:00`, role: 'EC', actor: ACTOR_NAME.EC,
        type: 'DECISION', action: approved ? 'Approved (LoA)' : 'Rejected (LoR)',
        message: approved ? 'Decision uploaded on the portal with the Letter of Approval.' : 'Decision uploaded with a speaking order.',
        reason: approved ? undefined : 'Insufficient infrastructure readiness against the norms for the applied intake.',
      })
      if (approved) {
        log({
          appId: app.id, ts: `${app.decisionAt}T16:00:00`, role: 'SYSTEM', actor: ACTOR_NAME.SYSTEM,
          type: 'ALERT', action: 'Obligations created by the approval',
          message: `${app.obligations.length} obligation(s) generated from this approval event.`,
        })
      }
    }

    if (app.stages.some((s) => s.code === 'APPEAL')) {
      log({
        appId: app.id, ts: `${addDays(app.appealUntil ?? app.createdAt, -3)}T11:10:00`, role: 'INSTITUTION',
        actor: ACTOR_NAME.INSTITUTION, type: 'APPEAL', action: 'Appeal filed before SAC',
        message: 'Appeal filed within the 7-day window under APH cl. 2.24(a).',
      })
    }
  }

  return events.sort((a, b) => a.ts.localeCompare(b.ts))
}

function STAGE_LABEL_SAFE(code: StageCode) {
  return code.replaceAll('_', ' ').toLowerCase()
}

/* ------------------------------------------------------------------ *
 * SEEDED INBOX
 * ------------------------------------------------------------------ */
export function seedNotifications(apps: Application[]): AppNotification[] {
  const out: AppNotification[] = []
  let n = 0
  const add = (n0: Omit<AppNotification, 'id'>) => out.push({ id: `NT-S${++n}`, ...n0 })

  for (const app of apps.slice(0, 40)) {
    const st = app.stages[app.stages.length - 1]
    if (app.decision) continue
    const overdue = st.dueAt < DEMO_TODAY
    if (!overdue) continue
    add({
      appId: app.id,
      ts: `${st.dueAt}T08:00:00`,
      // addressed to whichever officer owns the stage that is running late
      to: ladderRecipient(1, STAGE_ACTOR[st.code]),
      level: 1,
      kind: 'ESCALATION',
      subject: `${app.ref} — ${st.code.replaceAll('_', ' ').toLowerCase()} past its stage deadline`,
      body: `${app.institution}: action pending since ${st.dueAt}. Escalation ladder armed.`,
    })
  }

  const withObligations = apps.find((a) => a.obligations.length > 0)
  if (withObligations) {
    add({
      appId: withObligations.id,
      ts: '2026-02-10T07:30:00',
      to: 'INSTITUTION',
      level: 0,
      kind: 'REMINDER',
      subject: `60-day reminder: ${withObligations.obligations[0].label}`,
      body: `Due ${withObligations.obligations[0].dueAt}. Upload evidence on the portal to avoid escalation.`,
    })
  }

  return out.sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 8)
}

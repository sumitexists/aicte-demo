import type {
  AppTypeCode,
  AuditType,
  DeadlineSource,
  RoleCode,
  StageCode,
} from './types'

/* ------------------------------------------------------------------ *
 * 1. THE EIGHT AUTHORITIES
 * Role names follow the APH. "Institution" is an applicant, not a
 * department, but it sits in the same switcher because the demo needs
 * to show the institution-facing view.
 * ------------------------------------------------------------------ */
export const ROLES: { code: RoleCode; label: string; short: string; scope: string; homeView: string }[] = [
  { code: 'INSTITUTION', label: 'Institution / Applicant', short: 'Institution', scope: 'own applications', homeView: 'My applications' },
  { code: 'SCRUTINY', label: 'Scrutiny / Re-Scrutiny Committee', short: 'Scrutiny', scope: 'assigned cases, paper check', homeView: 'Scrutiny queue' },
  { code: 'EVC', label: 'Expert Visit Committee', short: 'EVC', scope: 'scheduled visits', homeView: 'Visit schedule' },
  { code: 'SHC', label: 'Standing Hearing Committee', short: 'SHC', scope: 'cases with shortcomings', homeView: 'Hearing queue' },
  { code: 'SAC', label: 'Standing Appellate Committee', short: 'SAC', scope: 'appeals only', homeView: 'Appeal docket' },
  { code: 'BUREAU', label: 'Regulation Bureau', short: 'Bureau', scope: 'all regions, scheduling & issuance', homeView: 'All-region pendency' },
  { code: 'EC', label: 'Executive Committee', short: 'EC', scope: 'cases awaiting decision', homeView: 'Decision board' },
  { code: 'COUNCIL', label: 'Council', short: 'Council', scope: 'ratification & final appeals', homeView: 'Ratification board' },
]

export const roleLabel = (r: RoleCode | 'SYSTEM') =>
  r === 'SYSTEM' ? 'System' : ROLES.find((x) => x.code === r)?.short ?? r

/* ------------------------------------------------------------------ *
 * 2. APPLICATION TYPES  (APH Table-2.3, transcribed)
 * ------------------------------------------------------------------ */
export interface AppTypeDef {
  code: AppTypeCode
  label: string
  aphRef: string
  /** base pipeline; conditional stages are appended at runtime */
  plan: StageCode[]
  /** APH Table-2.3 columns */
  matrix: { selfDisclosure: boolean; scrutiny: boolean; evc: boolean; sacShc: boolean | 'AA' }
  createsObligations: string[]
  note: string
}

export const APP_TYPES: AppTypeDef[] = [
  {
    code: 'NEW_INSTITUTION',
    label: 'New Institution',
    aphRef: 'APH Ch-I, cl. 1.8-1.11',
    plan: ['SUBMITTED', 'SCRUTINY', 'EVC', 'EC_DECISION', 'COUNCIL_RATIFICATION'],
    matrix: { selfDisclosure: false, scrutiny: true, evc: true, sacShc: 'AA' },
    createsObligations: ['FACULTY_PRINCIPAL', 'SECURITY_DEPOSIT', 'LEASE_GATE'],
    note: 'LoA valid 2 academic years; EVC may be held any time before the first batch passes out.',
  },
  {
    code: 'EOA_SELF_DISCLOSURE',
    label: 'Extension of Approval (Self-Disclosure)',
    aphRef: 'APH Table-2.3, row 1',
    plan: ['SUBMITTED', 'SELF_DISCLOSURE'],
    matrix: { selfDisclosure: true, scrutiny: false, evc: false, sacShc: false },
    createsObligations: ['ANNUAL_DATA', 'LEASE_GATE'],
    note: 'No scrutiny and no EVC. A 3-year EoA still requires annual data submission.',
  },
  {
    code: 'INCREASE_INTAKE',
    label: 'Increase in Intake / Additional Course',
    aphRef: 'APH Table-2.3',
    plan: ['SUBMITTED', 'SCRUTINY', 'EVC', 'EC_DECISION', 'COUNCIL_RATIFICATION'],
    matrix: { selfDisclosure: false, scrutiny: true, evc: true, sacShc: 'AA' },
    createsObligations: ['FACULTY_PRINCIPAL', 'LEASE_GATE'],
    note: 'EVC verifies incremental infrastructure and faculty for the additional seats.',
  },
  {
    code: 'NEW_PROGRAMME',
    label: 'New Programme / Level',
    aphRef: 'APH Table-2.3',
    plan: ['SUBMITTED', 'SCRUTINY', 'EVC', 'EC_DECISION', 'COUNCIL_RATIFICATION'],
    matrix: { selfDisclosure: false, scrutiny: true, evc: true, sacShc: 'AA' },
    createsObligations: ['FACULTY_PRINCIPAL', 'LAB_READINESS', 'LEASE_GATE'],
    note: 'Same route as Increase in Intake. Only the EVC checklist differs.',
  },
  {
    code: 'CLOSURE',
    label: 'Closure of Institution / Programme',
    aphRef: 'APH Table-2.3 (closure rows)',
    plan: ['SUBMITTED', 'SCRUTINY', 'EC_DECISION', 'COUNCIL_RATIFICATION'],
    matrix: { selfDisclosure: false, scrutiny: true, evc: false, sacShc: false },
    createsObligations: ['STUDENT_TRANSFER', 'RECORD_PRESERVATION'],
    note: 'No EVC, no SHC/SAC. Still creates obligations that outlive the case.',
  },
]

export const appTypeDef = (code: AppTypeCode) =>
  APP_TYPES.find((t) => t.code === code) as AppTypeDef

/* ------------------------------------------------------------------ *
 * 3. STAGE DEFINITIONS
 * ------------------------------------------------------------------ */
export const STAGE_LABEL: Record<StageCode, string> = {
  SUBMITTED: 'Submitted on portal',
  SELF_DISCLOSURE: 'Self-disclosure review',
  SCRUTINY: 'Scrutiny',
  INSTITUTION_REPLY: 'Institution compliance reply',
  RE_SCRUTINY: 'Re-Scrutiny',
  EVC: 'Expert Visit Committee',
  SHC: 'Standing Hearing Committee',
  EC_DECISION: 'Executive Committee decision',
  COUNCIL_RATIFICATION: 'Council ratification',
  APPEAL: 'Appeal before SAC',
  CLOSED: 'Closed',
}

export const STAGE_ACTOR: Record<StageCode, RoleCode> = {
  SUBMITTED: 'INSTITUTION',
  SELF_DISCLOSURE: 'BUREAU',
  SCRUTINY: 'SCRUTINY',
  INSTITUTION_REPLY: 'INSTITUTION',
  RE_SCRUTINY: 'SCRUTINY',
  EVC: 'EVC',
  SHC: 'SHC',
  EC_DECISION: 'EC',
  COUNCIL_RATIFICATION: 'COUNCIL',
  APPEAL: 'SAC',
  CLOSED: 'BUREAU',
}

/** Assumed processing durations in DAYS. The APH prescribes none of these. */
export const STAGE_DURATION: Record<StageCode, number> = {
  SUBMITTED: 3,
  SELF_DISCLOSURE: 10,
  SCRUTINY: 10,
  INSTITUTION_REPLY: 7,
  RE_SCRUTINY: 5,
  EVC: 10,
  SHC: 5,
  EC_DECISION: 5,
  COUNCIL_RATIFICATION: 5,
  APPEAL: 7,
  CLOSED: 0,
}

/** Only the appeal window comes from the regulations. */
export const STAGE_SOURCE: Record<StageCode, DeadlineSource> = {
  SUBMITTED: 'ADMIN',
  SELF_DISCLOSURE: 'ADMIN',
  SCRUTINY: 'ADMIN',
  INSTITUTION_REPLY: 'ADMIN',
  RE_SCRUTINY: 'ADMIN',
  EVC: 'ADMIN',
  SHC: 'ADMIN',
  EC_DECISION: 'ADMIN',
  COUNCIL_RATIFICATION: 'ADMIN',
  APPEAL: 'REGULATION',
  CLOSED: 'REGULATION',
}

/* ------------------------------------------------------------------ *
 * 4. ACTIONS AVAILABLE AT EACH STAGE
 * ------------------------------------------------------------------ */
export interface StageAction {
  code: string
  label: string
  /** non-empty reason is mandatory before this action is accepted */
  reasonRequired: boolean
  reasonPrompt?: string
  tone: 'primary' | 'warn' | 'danger' | 'neutral'
  /** what the case does next */
  effect:
    | 'NEXT'
    | 'RETURN_TO_INSTITUTION'
    | 'TO_SHC'
    | 'TO_RE_SCRUTINY'
    | 'CLOSE_APPROVED'
    | 'CLOSE_REJECTED'
    | 'REOPEN'
}

export const STAGE_ACTIONS: Partial<Record<StageCode, StageAction[]>> = {
  SELF_DISCLOSURE: [
    { code: 'ACCEPT', label: 'Accept self-disclosure, grant EoA', reasonRequired: false, tone: 'primary', effect: 'CLOSE_APPROVED' },
    { code: 'RETURN', label: 'Return for clarification', reasonRequired: true, reasonPrompt: 'What is unclear in the self-disclosure?', tone: 'warn', effect: 'RETURN_TO_INSTITUTION' },
  ],
  SCRUTINY: [
    { code: 'FORWARD', label: 'Records in order — forward', reasonRequired: false, tone: 'primary', effect: 'NEXT' },
    { code: 'RETURN', label: 'Return with deficiencies', reasonRequired: true, reasonPrompt: 'List the deficiencies to be cleared (e.g. lease deed not registered)', tone: 'warn', effect: 'RETURN_TO_INSTITUTION' },
  ],
  INSTITUTION_REPLY: [
    { code: 'SUBMIT', label: 'Submit compliance evidence', reasonRequired: true, reasonPrompt: 'Describe the evidence submitted against each deficiency', tone: 'primary', effect: 'TO_RE_SCRUTINY' },
  ],
  RE_SCRUTINY: [
    { code: 'FORWARD', label: 'Deficiencies cleared — forward', reasonRequired: false, tone: 'primary', effect: 'NEXT' },
    { code: 'PERSIST', label: 'Deficiencies persist — return again', reasonRequired: true, reasonPrompt: 'Why do the deficiencies remain?', tone: 'warn', effect: 'RETURN_TO_INSTITUTION' },
  ],
  EVC: [
    { code: 'RECOMMEND', label: 'Recommend — no shortcomings', reasonRequired: false, tone: 'primary', effect: 'NEXT' },
    { code: 'SHORTCOMINGS', label: 'Recommend with shortcomings (to SHC)', reasonRequired: true, reasonPrompt: 'What shortcomings were observed during the visit?', tone: 'warn', effect: 'TO_SHC' },
  ],
  SHC: [
    { code: 'REFER', label: 'Compliance accepted — refer to EC', reasonRequired: false, tone: 'primary', effect: 'NEXT' },
    { code: 'RETURN', label: 'Not satisfied — return to institution', reasonRequired: true, reasonPrompt: 'What remains incomplete?', tone: 'warn', effect: 'RETURN_TO_INSTITUTION' },
  ],
  EC_DECISION: [
    { code: 'APPROVE', label: 'Grant approval (LoA)', reasonRequired: false, tone: 'primary', effect: 'NEXT' },
    { code: 'CONDITIONAL', label: 'Approve with conditions', reasonRequired: true, reasonPrompt: 'State the conditions and their timelines', tone: 'neutral', effect: 'NEXT' },
    { code: 'REJECT', label: 'Reject (LoR with speaking order)', reasonRequired: true, reasonPrompt: 'Give the reasons for rejection (speaking order)', tone: 'danger', effect: 'CLOSE_REJECTED' },
  ],
  COUNCIL_RATIFICATION: [
    { code: 'RATIFY', label: 'Ratify the decision', reasonRequired: false, tone: 'primary', effect: 'CLOSE_APPROVED' },
    { code: 'REMIT', label: 'Remit back to EC', reasonRequired: true, reasonPrompt: 'Why is the decision remitted?', tone: 'warn', effect: 'NEXT' },
  ],
  APPEAL: [
    { code: 'ALLOW', label: 'Allow the appeal', reasonRequired: true, reasonPrompt: 'Reason for allowing the appeal', tone: 'primary', effect: 'CLOSE_APPROVED' },
    { code: 'DISMISS', label: 'Dismiss the appeal', reasonRequired: true, reasonPrompt: 'Reason for dismissal', tone: 'danger', effect: 'CLOSE_REJECTED' },
  ],
}

export const actionsForStage = (stage: StageCode): StageAction[] => STAGE_ACTIONS[stage] ?? []

/** Only this role may act at this stage. Everyone else sees it read-only. */
export const canActAtStage = (role: RoleCode, stage: StageCode) => STAGE_ACTOR[stage] === role

/* ------------------------------------------------------------------ *
 * 5. CONDITIONS
 * ------------------------------------------------------------------ */
export function newInstitutionAndClosureConflict(): string {
  return 'APH cl. 1.8(i): the closure application must be processed first; the new-institution case can proceed only if closure is recommended.'
}

export const AUDIT_LABEL: Record<AuditType, string> = {
  SUBMIT: 'Submission',
  TRANSITION: 'Stage movement',
  RETURN: 'Return to institution',
  DECISION: 'Decision',
  RATIFY: 'Ratification',
  APPEAL: 'Appeal',
  DOCUMENT: 'Document',
  VERIFY: 'Verification',
  ALERT: 'Alert',
  ESCALATION: 'Escalation',
  COMMENT: 'Comment',
  EVC_SCHEDULE: 'EVC visit scheduled',
  EVC_REPORT: 'EVC report submitted',
  CONFIG_CHANGE: 'Regulatory config updated',
}

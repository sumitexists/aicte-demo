export type RoleCode =
  | 'INSTITUTION'
  | 'SCRUTINY'
  | 'EVC'
  | 'SHC'
  | 'SAC'
  | 'BUREAU'
  | 'EC'
  | 'COUNCIL'

export type AppTypeCode =
  | 'NEW_INSTITUTION'
  | 'EOA_SELF_DISCLOSURE'
  | 'INCREASE_INTAKE'
  | 'NEW_PROGRAMME'
  | 'CLOSURE'

export type StageCode =
  | 'SUBMITTED'
  | 'SELF_DISCLOSURE'
  | 'SCRUTINY'
  | 'INSTITUTION_REPLY'
  | 'RE_SCRUTINY'
  | 'EVC'
  | 'SHC'
  | 'EC_DECISION'
  | 'COUNCIL_RATIFICATION'
  | 'APPEAL'
  | 'CLOSED'

export type StageStatus = 'done' | 'active' | 'pending'

/** Every deadline in the system declares where it comes from. */
export type DeadlineSource = 'REGULATION' | 'DERIVED' | 'ADMIN'

export interface StageInstance {
  code: StageCode
  actorRole: RoleCode
  enteredAt: string
  dueAt: string
  slaDays: number
  source: DeadlineSource
  status: StageStatus
  note?: string
}

export type ObligationKind = 'TIME_BOUND' | 'DOC_VALIDITY' | 'COMPUTED_GATE'
export type ObligationStatus = 'open' | 'submitted' | 'verified' | 'breached'

export interface Obligation {
  id: string
  appId: string
  kind: ObligationKind
  code: string
  label: string
  dueAt: string
  source: DeadlineSource
  status: ObligationStatus
  /** for DOC_VALIDITY / COMPUTED_GATE */
  expiryDate?: string
  /** for COMPUTED_GATE - the lease vs course duration predicate */
  gate?: {
    liveLeaseYears: number
    maxCourseDurationYears: number
    evaluatedForYear: string
    blocked: boolean
  }
  verifiedBy?: string
  verifiedAt?: string
  evidenceNote?: string
  submittedAt?: string
  submittedDocName?: string
  submittedDocRef?: string
  rejectionNote?: string
}

export type AuditType =
  | 'SUBMIT'
  | 'TRANSITION'
  | 'RETURN'
  | 'DECISION'
  | 'RATIFY'
  | 'APPEAL'
  | 'DOCUMENT'
  | 'VERIFY'
  | 'ALERT'
  | 'ESCALATION'
  | 'COMMENT'
  | 'EVC_SCHEDULE'
  | 'EVC_REPORT'
  | 'CONFIG_CHANGE'

export interface AuditEvent {
  id: string
  appId: string | null
  ts: string
  role: RoleCode | 'SYSTEM'
  actor: string
  type: AuditType
  action: string
  message: string
  reason?: string
}

export type Decision = 'APPROVED' | 'APPROVED_WITH_CONDITIONS' | 'REJECTED' | null

export interface LeaseDocument {
  id: string
  title: string
  docRef: string
  startDate: string
  endDate: string
  uploadedAt: string
  status: 'VALID' | 'EXPIRING_SOON' | 'EXPIRED' | 'RENEWAL_SUBMITTED' | 'VERIFIED'
  fileSize?: string
  verifiedBy?: string
  renewedEndDate?: string
  renewalDocRef?: string
  renewalSubmittedAt?: string
  notes?: string
}

export interface EVCSchedule {
  id: string
  appId: string
  scheduledDate: string
  mode: 'PHYSICAL' | 'HYBRID' | 'VIRTUAL'
  status: 'UNSCHEDULED' | 'SCHEDULED' | 'VISIT_COMPLETED' | 'REPORT_SUBMITTED'
  assignedPanel: { name: string; designation: string; institution: string }[]
  scheduledAt?: string
  scheduledBy?: string
  venue?: string
  reportSummary?: string
  shortcomingsFound?: boolean
  reportSubmittedAt?: string
}

export interface Application {
  id: string
  ref: string
  type: AppTypeCode
  institution: string
  region: string
  createdAt: string
  stages: StageInstance[]
  deficiencies: { id: string; stage: StageCode; text: string; raisedAt: string; clearedAt?: string }[]
  returns: number
  decision: Decision
  decisionAt?: string
  appealUntil?: string
  obligations: Obligation[]
  lease?: { startDate: string; endDate: string; maxCourseDurationYears: number }
  leaseDocuments?: LeaseDocument[]
  evcSchedule?: EVCSchedule
  /** Cross-case dependency under APH cl. 1.8(i) */
  blockedByAppId?: string
  blockedReason?: string
  closedAt?: string
}

export interface AppNotification {
  id: string
  appId: string
  ts: string
  to: RoleCode | 'INSTITUTION'
  level: number
  subject: string
  body: string
  kind: 'REMINDER' | 'ESCALATION' | 'DECISION'
  read?: boolean
}

export interface EscalationRungConfig {
  level: number
  afterDays: number
  notify: string
  label: string
}

export interface RegulatoryConfig {
  academicYear: string
  decisionDeadline: string
  cutoffDate: string
  affiliationDeadline: string
  stageDurations: Record<StageCode, number>
  escalationRungs: EscalationRungConfig[]
  paceGamma: number
  paceMax: number
  paceMin: number
}

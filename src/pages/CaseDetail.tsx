import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  ExternalLink,
  FileCheck2,
  FileText,
  History,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Upload,
  UploadCloud,
  X,
} from 'lucide-react'
import { AppTypeBadge, Badge, Button, Card, CardHeader, Empty, SourceBadge, cn } from '@/components/ui/primitives'
import { useStore, ageDays, currentStage, leaseFor, statusOf } from '@/lib/store'
import {
  AUDIT_LABEL,
  STAGE_ACTOR,
  STAGE_LABEL,
  actionsForStage,
  appTypeDef,
  canActAtStage,
  roleLabel,
} from '@/lib/workflow'
import { ACADEMIC_YEAR, allocatedDueFor, deadlineState, fmt } from '@/lib/deadlines'
import type { AuditEvent, Obligation } from '@/lib/types'

type Tab = 'overview' | 'obligations' | 'documents' | 'history'

const AUDIT_TONE: Record<string, 'blue' | 'green' | 'red' | 'amber' | 'violet' | 'gray'> = {
  SUBMIT: 'blue',
  TRANSITION: 'blue',
  RETURN: 'amber',
  DECISION: 'green',
  RATIFY: 'violet',
  APPEAL: 'amber',
  DOCUMENT: 'gray',
  VERIFY: 'green',
  ALERT: 'amber',
  ESCALATION: 'red',
  COMMENT: 'gray',
  EVC_SCHEDULE: 'blue',
  EVC_REPORT: 'blue',
  CONFIG_CHANGE: 'violet',
}

export default function CaseDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const {
    apps,
    now,
    role,
    audit,
    act,
    verifyObligation,
    submitEvidence,
    reviewEvidence,
    uploadRenewedLease,
    verifyLeaseRenewal,
    fileAppeal,
    recordOutcome,
    config,
  } = useStore()

  const app = apps.find((a) => a.id === id)
  const [tab, setTab] = useState<Tab>(role === 'INSTITUTION' ? 'obligations' : 'overview')
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [flash, setFlash] = useState<string | null>(null)
  const [outcomeDone, setOutcomeDone] = useState(true)
  const [deficiencies, setDeficiencies] = useState('')
  const [remarks, setRemarks] = useState('')
  const [appealGrounds, setAppealGrounds] = useState('')

  // Evidence submission modal state
  const [evidenceModalObligation, setEvidenceModalObligation] = useState<Obligation | null>(null)
  const [evidenceDocName, setEvidenceDocName] = useState('')
  const [evidenceDocRef, setEvidenceDocRef] = useState('')
  const [evidenceNote, setEvidenceNote] = useState('')

  // Evidence review modal state
  const [reviewModalObligation, setReviewModalObligation] = useState<Obligation | null>(null)
  const [reviewRemarks, setReviewRemarks] = useState('')

  // Lease renewal modal state
  const [leaseModalOpen, setLeaseModalOpen] = useState(false)
  const [renewalEndDate, setRenewalEndDate] = useState('2056-03-31')
  const [renewalDocRef, setRenewalDocRef] = useState('')
  const [renewalNotes, setRenewalNotes] = useState('')

  const history = useMemo(
    () => audit.filter((e) => e.appId === id).sort((a, b) => b.ts.localeCompare(a.ts)),
    [audit, id],
  )

  if (!app) {
    return (
      <div className="space-y-4">
        <Button onClick={onBack} variant="ghost" size="sm">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Button>
        <Card>
          <Empty title="Application not found" />
        </Card>
      </div>
    )
  }

  const stage = currentStage(app)
  const def = appTypeDef(app.type)
  const status = statusOf(app)
  const dl = deadlineState(stage.dueAt, now, config.escalationRungs)
  const actions = actionsForStage(stage.code)
  const canAct = canActAtStage(role, stage.code) && status === 'OPEN'
  const lease = leaseFor(app, now)
  const chosen = actions.find((a) => a.code === pendingAction)
  const pace = allocatedDueFor(
    app.type,
    stage.code,
    now,
    config.decisionDeadline,
    config.stageDurations,
    config.paceGamma,
  ).pace

  // Check Cross-Case Dependency blocker
  const blocker = app.blockedByAppId ? apps.find((a) => a.id === app.blockedByAppId) : null
  const isBlockedByDependency = blocker !== null && blocker !== undefined && blocker.decision !== 'APPROVED'

  const run = () => {
    if (!pendingAction) return
    const ok = act(app.id, pendingAction, reason)
    if (ok) {
      setFlash(
        chosen?.reasonRequired
          ? 'Action recorded with your reason in the audit trail.'
          : 'Action recorded in the audit trail.',
      )
      setPendingAction(null)
      setReason('')
      setTimeout(() => setFlash(null), 4000)
    } else {
      setFlash('Action was blocked by system regulatory checks. Check audit log for details.')
      setTimeout(() => setFlash(null), 4000)
    }
  }

  const handleEvidenceSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!evidenceModalObligation) return
    submitEvidence(evidenceModalObligation.id, evidenceDocName, evidenceDocRef, evidenceNote)
    setEvidenceModalObligation(null)
    setEvidenceDocName('')
    setEvidenceDocRef('')
    setEvidenceNote('')
    setFlash('Compliance evidence submitted successfully! Forwarded for regulatory verification.')
    setTimeout(() => setFlash(null), 4000)
  }

  const handleLeaseRenewalSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    uploadRenewedLease(app.id, renewalDocRef, renewalEndDate, renewalNotes)
    setLeaseModalOpen(false)
    setRenewalDocRef('')
    setRenewalNotes('')
    setFlash('Renewed lease agreement submitted! Live lease gate automatically re-evaluated.')
    setTimeout(() => setFlash(null), 4000)
  }

  return (
    <div className="space-y-6">
      {/* Top Navigation & Status Bar */}
      <div className="flex items-center justify-between gap-3">
        <Button onClick={onBack} variant="ghost" size="sm">
          <ArrowLeft className="h-3.5 w-3.5" /> All applications
        </Button>
        <div className="flex items-center gap-2">
          {status === 'OPEN' && <Badge tone="blue">Open Case</Badge>}
          {status === 'APPROVED' && <Badge tone="green">Approved</Badge>}
          {status === 'REJECTED' && <Badge tone="red">Rejected</Badge>}
          <Badge tone="slate">{app.region} Region</Badge>
        </div>
      </div>

      {/* Cross-Case Dependency Regulatory Banner (APH cl. 1.8(i)) */}
      {app.blockedByAppId && (
        <div
          className={cn(
            'rounded-xl border p-4 transition-all',
            isBlockedByDependency
              ? 'border-amber-400 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'
              : 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/20',
          )}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <ShieldAlert
                className={cn(
                  'mt-0.5 h-5 w-5 shrink-0',
                  isBlockedByDependency ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600',
                )}
              />
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200">
                    Cross-Case Dependency Enforced · APH cl. 1.8(i)
                  </h4>
                  {isBlockedByDependency ? (
                    <Badge tone="amber">Action Locked</Badge>
                  ) : (
                    <Badge tone="green">Blocker Cleared</Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-700 dark:text-gray-300">
                  {app.blockedReason ||
                    'Where an institution applies for closure and a new institution in the same premises, the closure application must be processed and approved first before this new institution application can advance.'}
                </p>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    Dependent on Closure Case: {app.blockedByAppId}
                  </span>
                  {blocker && (
                    <span className="text-gray-500">
                      ({blocker.institution}) — Currently{' '}
                      <strong className={blocker.decision === 'APPROVED' ? 'text-emerald-600' : 'text-amber-600'}>
                        {blocker.decision === 'APPROVED' ? 'APPROVED' : STAGE_LABEL[currentStage(blocker).code]}
                      </strong>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {blocker && (
              <Button size="sm" variant="secondary" onClick={() => onBack()}>
                View Closure Application <ExternalLink className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Case Header with Highlighted Approval Type */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-bold text-gray-500 dark:text-gray-400">{app.ref}</span>
            <AppTypeBadge type={app.type} size="md" />
            <SourceBadge source="REGULATION" />
          </div>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
            {app.institution}
          </h1>
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
            Received {fmt(app.createdAt)} · Application Age {ageDays(app, now)} days · Route: {def.aphRef}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-3.5 text-right shadow-2xs dark:border-gray-800 dark:bg-gray-900">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Current Stage
          </p>
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{STAGE_LABEL[stage.code]}</p>
          <p className={cn('text-xs font-semibold', dl.overdue ? 'text-red-600 dark:text-red-400' : 'text-gray-600')}>
            {status === 'OPEN'
              ? dl.overdue
                ? `${Math.abs(dl.daysLeft)} days overdue`
                : `${dl.daysLeft} days remaining`
              : 'Case Closed'}
          </p>
          <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] text-gray-500">
            <PaceChip band={pace.band} factor={pace.factor} />
            <span>
              {pace.availableDays}d to 30-Apr / {pace.neededDays}d needed
            </span>
          </div>
        </div>
      </header>

      {flash && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {flash}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-1 dark:border-gray-800">
        <button
          onClick={() => setTab('overview')}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
            tab === 'overview'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800',
          )}
        >
          <FileText className="h-3.5 w-3.5" /> Pipeline & Overview
        </button>
        <button
          onClick={() => setTab('obligations')}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
            tab === 'obligations'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800',
          )}
        >
          <ShieldCheck className="h-3.5 w-3.5" /> Undertakings & Compliance ({app.obligations.length})
        </button>
        <button
          onClick={() => setTab('documents')}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
            tab === 'documents'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800',
          )}
        >
          <FileCheck2 className="h-3.5 w-3.5" /> Documents & Lease Validity
        </button>
        <button
          onClick={() => setTab('history')}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
            tab === 'history'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800',
          )}
        >
          <History className="h-3.5 w-3.5" /> Audit Trail ({history.length})
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content Area (2 Cols) */}
        <div className="space-y-6 lg:col-span-2">
          {/* TAB 1: OVERVIEW */}
          {tab === 'overview' && (
            <div className="space-y-6">
              {/* Pipeline Card */}
              <Card>
                <CardHeader title="Approval Pipeline" subtitle="Prescribed sequence of evaluation stages" />
                <div className="px-5 py-4">
                  <ol className="relative space-y-4 border-l border-gray-200 dark:border-gray-800 ml-3">
                    {app.stages.map((st, i) => {
                      const isDone = st.status === 'done'
                      const isActive = st.status === 'active'
                      return (
                        <li key={i} className="ml-4 space-y-1">
                          <span
                            className={cn(
                              'absolute -left-2 grid h-4 w-4 place-content-center rounded-full text-white',
                              isDone ? 'bg-emerald-500' : isActive ? 'bg-blue-600 ring-4 ring-blue-100 dark:ring-blue-900/40' : 'bg-gray-300 dark:bg-gray-700',
                            )}
                          >
                            {isDone ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-2 w-2" />}
                          </span>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                              {STAGE_LABEL[st.code]}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <Badge tone={isDone ? 'green' : isActive ? 'blue' : 'gray'}>
                                {isDone ? 'Completed' : isActive ? 'Active Now' : 'Pending'}
                              </Badge>
                              <SourceBadge source={st.source} />
                            </div>
                          </div>
                          <p className="text-[11px] text-gray-500">
                            Owned by {roleLabel(st.actorRole)} · Entered {fmt(st.enteredAt)} · Due {fmt(st.dueAt)}
                          </p>
                          {st.note && (
                            <p className="rounded bg-gray-50 px-2 py-1 text-[11px] text-gray-600 dark:bg-gray-800/60 dark:text-gray-300">
                              Note: {st.note}
                            </p>
                          )}
                        </li>
                      )
                    })}
                  </ol>
                </div>
              </Card>

              {/* Deficiencies Raised */}
              {app.deficiencies.length > 0 && (
                <Card>
                  <CardHeader
                    title="Deficiencies Recorded"
                    subtitle="Raised during Scrutiny / EVC; re-scrutiny is strictly limited to these items"
                  />
                  <ul className="divide-y divide-gray-100 px-5 py-2 dark:divide-gray-800">
                    {app.deficiencies.map((d) => (
                      <li key={d.id} className="py-2.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-amber-800 dark:text-amber-300">{d.text}</span>
                          <Badge tone={d.clearedAt ? 'green' : 'amber'}>
                            {d.clearedAt ? 'Cleared' : 'Pending Rectification'}
                          </Badge>
                        </div>
                        <p className="mt-1 text-[10px] text-gray-400">
                          Raised {fmt(d.raisedAt)} {d.clearedAt && `· Cleared ${fmt(d.clearedAt)}`}
                        </p>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {/* EVC Schedule Details if available */}
              {app.evcSchedule && (
                <Card>
                  <CardHeader
                    title="Expert Visit Committee (EVC) Schedule"
                    subtitle="Panel constitution and inspection venue details"
                  />
                  <div className="space-y-3 px-5 py-4 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Inspection Modality</span>
                      <Badge tone="blue">{app.evcSchedule.mode} Inspection</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Scheduled Visit Date</span>
                      <span className="font-bold tabular-nums text-gray-900 dark:text-gray-100">
                        {fmt(app.evcSchedule.scheduledDate)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Inspection Venue</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{app.evcSchedule.venue}</span>
                    </div>

                    <div className="border-t border-gray-100 pt-2 dark:border-gray-800">
                      <p className="mb-1 font-semibold text-gray-700 dark:text-gray-300">Constituted Expert Panel:</p>
                      <ul className="space-y-1">
                        {app.evcSchedule.assignedPanel.map((p, idx) => (
                          <li key={idx} className="text-[11px] text-gray-600 dark:text-gray-400">
                            • <strong>{p.name}</strong> ({p.designation}) — {p.institution}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* TAB 2: OBLIGATIONS & COMPLIANCE */}
          {tab === 'obligations' && (
            <Card>
              <CardHeader
                title="Time-Bound Undertakings & Post-Approval Obligations"
                subtitle="Institutions must upload evidence before due dates; AICTE officials verify online"
              />
              {app.obligations.length === 0 ? (
                <Empty
                  title="No compliance obligations currently generated"
                  hint="Time-bound undertakings are created automatically when the Letter of Approval (LoA) is issued."
                />
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {app.obligations.map((o) => {
                    const odl = deadlineState(o.dueAt, now, config.escalationRungs)
                    const isOfficer = role === 'SCRUTINY' || role === 'EVC' || role === 'BUREAU' || role === 'EC'

                    return (
                      <div key={o.id} className="space-y-2 p-5 text-xs">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-gray-900 dark:text-gray-100">{o.label}</span>
                              <Badge tone="slate">{o.kind.replaceAll('_', ' ')}</Badge>
                              {o.status === 'verified' && <Badge tone="green">Verified & Cleared</Badge>}
                              {o.status === 'submitted' && <Badge tone="blue">Evidence Submitted</Badge>}
                              {o.status === 'open' && (
                                <Badge tone={odl.overdue ? 'red' : 'amber'}>
                                  {odl.overdue ? 'Overdue' : 'Action Required'}
                                </Badge>
                              )}
                              {o.status === 'breached' && <Badge tone="red">Breached</Badge>}
                            </div>
                            <p className="text-[11px] text-gray-500">
                              Prescribed Deadline: <strong>{fmt(o.dueAt)}</strong> (
                              {odl.overdue ? `${Math.abs(odl.daysLeft)} days overdue` : `${odl.daysLeft} days left`})
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Institution Submit Evidence Button */}
                            {o.status !== 'verified' && (
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => {
                                  setEvidenceModalObligation(o)
                                  setEvidenceDocName(`${o.label.split(' ')[0]}_Evidence_${app.ref.split('/')[2]}.pdf`)
                                  setEvidenceDocRef(`DOC/${app.ref.split('/')[2]}/${o.code}`)
                                  setEvidenceNote('Uploaded compliance report with verified board resolution and physical proof.')
                                }}
                              >
                                <Upload className="h-3 w-3" /> Submit Evidence
                              </Button>
                            )}

                            {/* Officer Review Evidence Button */}
                            {o.status === 'submitted' && isOfficer && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  setReviewModalObligation(o)
                                  setReviewRemarks('Evidence examined and found compliant with APH guidelines.')
                                }}
                              >
                                Review Evidence
                              </Button>
                            )}

                            {/* Direct Verify (for quick testing) */}
                            {o.status !== 'verified' && isOfficer && (
                              <Button size="sm" variant="ghost" onClick={() => verifyObligation(o.id)}>
                                Quick Verify
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Submitted evidence info card */}
                        {o.submittedDocName && (
                          <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3 text-[11px] dark:border-blue-900/30 dark:bg-blue-950/20">
                            <p className="font-semibold text-blue-900 dark:text-blue-300">
                              Uploaded Evidence File: {o.submittedDocName}
                            </p>
                            <p className="text-gray-600 dark:text-gray-400">
                              Document Ref: {o.submittedDocRef} · Submitted on {fmt(o.submittedAt)}
                            </p>
                            {o.evidenceNote && (
                              <p className="mt-1 text-gray-500 dark:text-gray-400 italic">"{o.evidenceNote}"</p>
                            )}
                          </div>
                        )}

                        {/* Deficiencies note if rejected */}
                        {o.rejectionNote && (
                          <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-[11px] text-red-800 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                            <strong>Regulatory Deficiencies Noted:</strong> {o.rejectionNote}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>
          )}

          {/* TAB 3: DOCUMENTS & LEASE VALIDITY */}
          {tab === 'documents' && (
            <div className="space-y-6">
              {/* Lease Gate Evaluation Card */}
              {lease && (
                <Card>
                  <CardHeader
                    title="Live-Lease Predicate & Expiry Evaluation · APH cl. 2.4(e)"
                    subtitle="Rule: Council shall not issue EoA from the year in which Live Lease is ≤ Course Duration"
                    action={<SourceBadge source="REGULATION" />}
                  />
                  <div className="space-y-4 px-5 py-4 text-xs">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800/40">
                        <p className="text-[10px] text-gray-400 uppercase">Lease End Date</p>
                        <p className="mt-1 text-base font-bold text-gray-900 dark:text-gray-100">
                          {fmt(app.lease?.endDate)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800/40">
                        <p className="text-[10px] text-gray-400 uppercase">Live Lease Remaining</p>
                        <p
                          className={cn(
                            'mt-1 text-base font-bold',
                            lease.blocked ? 'text-red-600' : 'text-emerald-600',
                          )}
                        >
                          {lease.liveLeaseYears} Years
                        </p>
                      </div>
                      <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800/40">
                        <p className="text-[10px] text-gray-400 uppercase">Maximum Course Duration</p>
                        <p className="mt-1 text-base font-bold text-gray-900 dark:text-gray-100">
                          {lease.maxCourseDurationYears} Years
                        </p>
                      </div>
                    </div>

                    <div
                      className={cn(
                        'rounded-lg border p-3',
                        lease.blocked
                          ? 'border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-300',
                      )}
                    >
                      <p className="font-bold">
                        Predicate Result:{' '}
                        {lease.blocked
                          ? '❌ Live Lease is LESS than or EQUAL to Course Duration — EoA Withheld'
                          : '✅ Lease Condition Satisfied for AY ' + ACADEMIC_YEAR}
                      </p>
                      <p className="mt-0.5 text-[11px] opacity-90">
                        {lease.blocked
                          ? 'To unlock approval, the institution must upload a 30-year registered lease extension deed.'
                          : 'Valid lease registered with appropriate government authority.'}
                      </p>
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button variant="primary" size="sm" onClick={() => setLeaseModalOpen(true)}>
                        <UploadCloud className="h-3.5 w-3.5" /> Upload Renewed Lease / Extension
                      </Button>
                    </div>
                  </div>
                </Card>
              )}

              {/* Document Registry Table */}
              <Card>
                <CardHeader
                  title="Registered Documents & Validity Tracker"
                  subtitle="Prescribed land documents, trust deeds, and lease validity status"
                />
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {(app.leaseDocuments || []).map((doc) => {
                    const isExpiring = doc.status === 'EXPIRING_SOON'
                    return (
                      <div key={doc.id} className="flex flex-col gap-2 p-5 text-xs sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-gray-900 dark:text-gray-100">{doc.title}</span>
                            <Badge
                              tone={
                                doc.status === 'VERIFIED'
                                  ? 'green'
                                  : doc.status === 'RENEWAL_SUBMITTED'
                                    ? 'blue'
                                    : isExpiring
                                      ? 'amber'
                                      : 'slate'
                              }
                            >
                              {doc.status.replaceAll('_', ' ')}
                            </Badge>
                          </div>
                          <p className="mt-1 text-[11px] text-gray-500">
                            Doc Ref: <strong>{doc.docRef}</strong> · Validity: {fmt(doc.startDate)} to{' '}
                            <strong>{fmt(doc.endDate)}</strong>
                          </p>
                          {doc.notes && <p className="text-[10px] text-gray-400 mt-0.5">{doc.notes}</p>}
                        </div>

                        <div className="flex items-center gap-2">
                          {doc.status === 'RENEWAL_SUBMITTED' && role !== 'INSTITUTION' && (
                            <Button size="sm" variant="primary" onClick={() => verifyLeaseRenewal(app.id, doc.id)}>
                              Verify Deed
                            </Button>
                          )}
                          <Button size="sm" variant="secondary" onClick={() => setLeaseModalOpen(true)}>
                            Renew Document
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            </div>
          )}

          {/* TAB 4: AUDIT TRAIL */}
          {tab === 'history' && (
            <Card>
              <CardHeader
                title="Digital Audit History"
                subtitle="Append-only regulatory trail. All decisions, returns, submissions, and alerts are timestamped and signed."
              />
              <ol className="divide-y divide-gray-100 dark:divide-gray-800">
                {history.map((e) => (
                  <AuditRow key={e.id} e={e} />
                ))}
              </ol>
            </Card>
          )}
        </div>

        {/* Right Sidebar: Actions & Facts */}
        <div className="space-y-6">
          {/* Record Stage Outcome */}
          <Card>
            <CardHeader
              title="Record Stage Outcome"
              subtitle="Holders of this desk may mark stage complete or return for deficiencies"
              action={<Badge tone="slate">{roleLabel(STAGE_ACTOR[stage.code])}</Badge>}
            />
            <div className="space-y-3 px-5 py-4">
              {isBlockedByDependency && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                  <strong>Action Disabled:</strong> Application is locked to Closure Case {app.blockedByAppId}. APH cl. 1.8(i) prohibits stage completion until closure is ratified.
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setOutcomeDone(true)}
                  disabled={!canAct || isBlockedByDependency}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50',
                    outcomeDone
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300'
                      : 'border-gray-300 text-gray-600 dark:border-gray-700 dark:text-gray-400',
                  )}
                >
                  Stage Completed
                </button>
                <button
                  onClick={() => setOutcomeDone(false)}
                  disabled={!canAct}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50',
                    !outcomeDone
                      ? 'border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300'
                      : 'border-gray-300 text-gray-600 dark:border-gray-700 dark:text-gray-400',
                  )}
                >
                  Return with Deficiencies
                </button>
              </div>

              {!outcomeDone && (
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                    Deficiencies Observed (Mandatory)
                  </label>
                  <textarea
                    rows={3}
                    value={deficiencies}
                    onChange={(e) => setDeficiencies(e.target.value)}
                    disabled={!canAct}
                    placeholder={'e.g. Registered lease deed not submitted\nCadre ratio short by 3 Associate Professors'}
                    className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 outline-none focus:border-blue-500 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  />
                </div>
              )}

              <div>
                <label className="mb-1 block text-[11px] font-medium text-gray-600 dark:text-gray-400">
                  Officer Remarks {outcomeDone ? '(Optional)' : ''}
                </label>
                <textarea
                  rows={2}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  disabled={!canAct || (isBlockedByDependency && outcomeDone)}
                  placeholder="Official observations recorded into the audit trail"
                  className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 outline-none focus:border-blue-500 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
              </div>

              <Button
                variant={outcomeDone ? 'primary' : 'warn'}
                className="w-full"
                disabled={!canAct || (isBlockedByDependency && outcomeDone) || (!outcomeDone && !deficiencies.trim())}
                onClick={() => {
                  const ok = recordOutcome(app.id, outcomeDone, deficiencies, remarks)
                  if (ok) {
                    setFlash(
                      outcomeDone
                        ? 'Stage completed and automatically routed to next prescribed stage.'
                        : 'Application returned to the institution with deficiencies recorded.',
                    )
                    setDeficiencies('')
                    setRemarks('')
                    setTimeout(() => setFlash(null), 4000)
                  }
                }}
              >
                {outcomeDone ? 'Mark Stage Complete & Forward' : 'Return to Institution'}
              </Button>
            </div>
          </Card>

          {/* Statutory Actions Panel */}
          <Card>
            <CardHeader
              title="Statutory Stage Actions"
              subtitle={`Actions reserved for ${roleLabel(STAGE_ACTOR[stage.code])}`}
              action={canAct ? <Badge tone="green">Your Desk</Badge> : <Lock className="h-3.5 w-3.5 text-gray-400" />}
            />
            <div className="space-y-3 px-5 py-4">
              {status !== 'OPEN' ? (
                <div className="space-y-3 text-xs text-gray-500 dark:text-gray-400">
                  <p>Case decision rendered. {app.appealUntil ? `Appeal window: ${fmt(app.appealUntil)}.` : ''}</p>
                  {role === 'INSTITUTION' && app.appealUntil && now <= app.appealUntil && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-gray-700">
                      <p className="font-semibold text-amber-900">File statutory appeal before SAC</p>
                      <textarea value={appealGrounds} onChange={(e) => setAppealGrounds(e.target.value)} rows={3} placeholder="State the grounds for appeal and reference supporting evidence" className="mt-2 w-full rounded border border-amber-300 bg-white p-2 text-xs" />
                      <Button size="sm" variant="warn" className="mt-2" disabled={!appealGrounds.trim()} onClick={() => { if (fileAppeal(app.id, appealGrounds)) { setAppealGrounds(''); setFlash('Appeal filed and routed to the Standing Appellate Committee.'); setTimeout(() => setFlash(null), 4000) } }}>File appeal to SAC</Button>
                    </div>
                  )}
                </div>
              ) : !canAct ? (
                <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-400">
                  You are signed in as <span className="font-semibold">{roleLabel(role)}</span>. This stage is reserved for{' '}
                  <span className="font-semibold">{roleLabel(STAGE_ACTOR[stage.code])}</span>. Switch role in the sidebar to act.
                </p>
              ) : (
                <>
                  {actions.map((a) => (
                    <div key={a.code}>
                      <Button
                        variant={
                          a.tone === 'primary'
                            ? 'primary'
                            : a.tone === 'danger'
                              ? 'danger'
                              : a.tone === 'warn'
                                ? 'warn'
                                : 'secondary'
                        }
                        className="w-full"
                        disabled={isBlockedByDependency && (a.effect === 'NEXT' || a.effect === 'CLOSE_APPROVED')}
                        onClick={() => {
                          if (a.reasonRequired) {
                            setPendingAction(a.code)
                            setReason('')
                          } else if (act(app.id, a.code, '')) {
                            setFlash('Action recorded in the digital audit trail.')
                            setTimeout(() => setFlash(null), 4000)
                          }
                        }}
                      >
                        {a.label}
                      </Button>
                      {pendingAction === a.code && (
                        <div className="mt-2 rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                          <label className="mb-1 block text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                            {a.reasonPrompt || 'Reason (Mandatory speaking order):'}
                          </label>
                          <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={3}
                            className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                            placeholder="State formal findings and regulatory justifications"
                          />
                          <div className="mt-2 flex justify-end gap-2">
                            <Button size="sm" variant="ghost" onClick={() => setPendingAction(null)}>
                              Cancel
                            </Button>
                            <Button size="sm" variant="primary" disabled={!reason.trim()} onClick={run}>
                              Record Action
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          </Card>

          {/* Case Facts Summary */}
          <Card>
            <CardHeader title="Regulatory Facts" />
            <div className="space-y-2.5 px-5 py-4">
              <Fact label="Approval Type" value={def.label} />
              <Fact
                label="Prescribed Matrix"
                value={
                  def.matrix.selfDisclosure
                    ? 'Self-disclosure Only'
                    : def.matrix.evc
                      ? 'Scrutiny + EVC'
                      : 'Scrutiny Only'
                }
              />
              <Fact label="AICTE Region" value={app.region} />
              <Fact label="Returns Count" value={`${app.returns} time(s)`} />
              <Fact label="Max Course Duration" value={`${app.lease?.maxCourseDurationYears || 4} Years`} />
            </div>
            <p className="border-t border-gray-100 px-5 py-3 text-[11px] leading-relaxed text-gray-500 dark:border-gray-800 dark:text-gray-400">
              {def.note}
            </p>
          </Card>
        </div>
      </div>

      {/* MODAL 1: SUBMIT COMPLIANCE EVIDENCE */}
      {evidenceModalObligation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-100 bg-blue-50/50 px-5 py-3 dark:border-gray-800 dark:bg-blue-950/20">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                Upload Compliance Evidence & Undertaking Proof
              </h3>
              <button
                onClick={() => setEvidenceModalObligation(null)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleEvidenceSubmit} className="space-y-4 p-5 text-xs">
              <div>
                <p className="text-gray-500">Target Obligation:</p>
                <p className="font-semibold text-gray-900 dark:text-gray-100">{evidenceModalObligation.label}</p>
                <p className="text-[10px] text-gray-400">Due by: {fmt(evidenceModalObligation.dueAt)}</p>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300">Supporting Document Title</label>
                <input
                  type="text"
                  required
                  value={evidenceDocName}
                  onChange={(e) => setEvidenceDocName(e.target.value)}
                  placeholder="e.g. Director_Appointment_Order_Resolution.pdf"
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300">Document Reference Number</label>
                <input
                  type="text"
                  required
                  value={evidenceDocRef}
                  onChange={(e) => setEvidenceDocRef(e.target.value)}
                  placeholder="e.g. SREC/REG/2026/FDR-092"
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300">Remarks / Submission Note</label>
                <textarea
                  rows={2}
                  value={evidenceNote}
                  onChange={(e) => setEvidenceNote(e.target.value)}
                  placeholder="Describe compliance proof submitted"
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
                <Button variant="secondary" size="sm" type="button" onClick={() => setEvidenceModalObligation(null)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Submit to AICTE Portal
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: REVIEW COMPLIANCE EVIDENCE (OFFICER) */}
      {reviewModalObligation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-5 py-3 dark:border-gray-800 dark:bg-gray-800/40">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                Regulatory Evidence Verification
              </h3>
              <button
                onClick={() => setReviewModalObligation(null)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 p-5 text-xs">
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800/40">
                <p className="text-gray-500">Obligation: <strong>{reviewModalObligation.label}</strong></p>
                <p className="mt-1 text-gray-700 dark:text-gray-300">
                  Document: <strong>{reviewModalObligation.submittedDocName}</strong> (Ref: {reviewModalObligation.submittedDocRef})
                </p>
                <p className="text-gray-500 mt-0.5">Submitted on: {fmt(reviewModalObligation.submittedAt)}</p>
                {reviewModalObligation.evidenceNote && (
                  <p className="mt-1 italic text-gray-600 dark:text-gray-400">"{reviewModalObligation.evidenceNote}"</p>
                )}
              </div>

              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300">Verification Remarks</label>
                <textarea
                  rows={3}
                  value={reviewRemarks}
                  onChange={(e) => setReviewRemarks(e.target.value)}
                  placeholder="Official finding of the verifying committee"
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>

              <div className="flex items-center justify-between border-t border-gray-100 pt-3 dark:border-gray-800">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    reviewEvidence(reviewModalObligation.id, false, reviewRemarks || 'Deficiencies in submitted proof')
                    setReviewModalObligation(null)
                  }}
                >
                  Flag Deficiencies
                </Button>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setReviewModalObligation(null)}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      reviewEvidence(reviewModalObligation.id, true, reviewRemarks)
                      setReviewModalObligation(null)
                    }}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Verify & Clear Obligation
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: UPLOAD RENEWED LEASE DEED */}
      {leaseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-5 py-3 dark:border-gray-800 dark:bg-gray-800/40">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                Upload Registered Lease Extension (30-Year Deed)
              </h3>
              <button
                onClick={() => setLeaseModalOpen(false)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleLeaseRenewalSubmit} className="space-y-4 p-5 text-xs">
              <p className="text-gray-600 dark:text-gray-400">
                Per APH cl. 2.4(e), registering an extended lease of at least 30 years clears the live-lease duration block.
              </p>

              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300">
                  New Extended Lease End Date
                </label>
                <input
                  type="date"
                  required
                  value={renewalEndDate}
                  onChange={(e) => setRenewalEndDate(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300">
                  Registered Deed Registration Number / Book Ref
                </label>
                <input
                  type="text"
                  required
                  value={renewalDocRef}
                  onChange={(e) => setRenewalDocRef(e.target.value)}
                  placeholder="e.g. SRO-HAVELI/MH/2026/LEASE-9821"
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300">Registrar & Sub-Registrar Notes</label>
                <textarea
                  rows={2}
                  value={renewalNotes}
                  onChange={(e) => setRenewalNotes(e.target.value)}
                  placeholder="30-year lease extension agreement registered on Rs. 500 stamp paper"
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
                <Button variant="secondary" size="sm" type="button" onClick={() => setLeaseModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Submit Lease Extension
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function PaceChip({
  band,
  factor,
}: {
  band: 'RELAXED' | 'ON_PACE' | 'COMPRESSED' | 'INFEASIBLE'
  factor: number
}) {
  const map = {
    RELAXED: { tone: 'blue' as const, label: 'relaxed' },
    ON_PACE: { tone: 'green' as const, label: 'on pace' },
    COMPRESSED: { tone: 'amber' as const, label: 'compressed' },
    INFEASIBLE: { tone: 'red' as const, label: 'cannot fit' },
  }
  const m = map[band]
  return (
    <Badge tone={m.tone} title={`Deadline allocated at ${factor.toFixed(2)}x the baseline stage weight`}>
      pace ×{factor.toFixed(2)} · {m.label}
    </Badge>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-right font-medium text-gray-800 dark:text-gray-200">{value}</span>
    </div>
  )
}

function AuditRow({ e }: { e: AuditEvent }) {
  return (
    <li className="flex gap-3 px-5 py-3">
      <div className="w-24 shrink-0">
        <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">{fmt(e.ts.slice(0, 10))}</p>
        <p className="text-[11px] text-gray-400">{e.ts.slice(11, 16)}</p>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={AUDIT_TONE[e.type] ?? 'gray'}>{AUDIT_LABEL[e.type]}</Badge>
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{e.action}</span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-400">{e.message}</p>
        {e.reason && (
          <p className="mt-1 rounded border-l-2 border-amber-400 bg-amber-50 px-2 py-1 text-[11px] text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
            Reason: {e.reason}
          </p>
        )}
        <p className="mt-1 text-[11px] text-gray-400">
          {e.actor} · {e.role === 'SYSTEM' ? 'system' : roleLabel(e.role as never)}
        </p>
      </div>
    </li>
  )
}

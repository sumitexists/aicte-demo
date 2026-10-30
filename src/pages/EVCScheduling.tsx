import { useMemo, useState } from 'react'
import {
  AlertCircle,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Filter,
  Users,
  X,
} from 'lucide-react'
import { AppTypeBadge, Badge, Button, Card, CardHeader, Empty, StatCard, cn } from '@/components/ui/primitives'
import { useStore, currentStage } from '@/lib/store'
import { appTypeDef } from '@/lib/workflow'
import { addDays, daysBetween, deadlineState, fmt } from '@/lib/deadlines'
import type { Application } from '@/lib/types'

const EXPERT_POOL = [
  { name: 'Prof. A. Kulkarni', designation: 'EVC Chair & Dean (Engineering)', institution: 'IIT Bombay' },
  { name: 'Dr. Neha Verma', designation: 'Expert Member (Architecture & Infra)', institution: 'SPA Delhi' },
  { name: 'Er. R. Singhania', designation: 'Industry Representative', institution: 'CII Technical Council' },
  { name: 'Dr. S. K. Roy', designation: 'Professor & Head (Computer Engg)', institution: 'Jadavpur University' },
  { name: 'Prof. Lakshmi Raman', designation: 'AICTE Regional Academic Nominee', institution: 'Anna University' },
]

export default function EVCScheduling({ onOpenCase }: { onOpenCase: (id: string) => void }) {
  const { apps, now, scheduleEVC, completeEVC, act, config } = useStore()
  const [activeTab, setActiveTab] = useState<'queue' | 'scheduled' | 'completed'>('queue')
  const [selectedRegion, setSelectedRegion] = useState('ALL')
  const [modalApp, setModalApp] = useState<Application | null>(null)
  const [reportApp, setReportApp] = useState<Application | null>(null)
  const [reportText, setReportText] = useState('Infrastructure, faculty credentials and prescribed documents were physically verified by the constituted EVC panel.')
  const [reportShortcomings, setReportShortcomings] = useState(false)

  // Form state for scheduling
  const [visitDate, setVisitDate] = useState(addDays(now, 7))
  const [visitMode, setVisitMode] = useState<'PHYSICAL' | 'HYBRID' | 'VIRTUAL'>('PHYSICAL')
  const [selectedExperts, setSelectedExperts] = useState<string[]>([
    EXPERT_POOL[0].name,
    EXPERT_POOL[1].name,
    EXPERT_POOL[2].name,
  ])
  const [venueRemarks, setVenueRemarks] = useState('')

  // Identify all applications requiring an EVC (per APH Table-2.3)
  const evcRequiringApps = useMemo(() => {
    return apps.filter((a) => {
      const def = appTypeDef(a.type)
      return def.matrix.evc === true
    })
  }, [apps])

  // Split into unscheduled queue vs scheduled vs completed
  const unscheduledQueue = useMemo(() => {
    return evcRequiringApps.filter((a) => {
      const st = currentStage(a)
      // At EVC stage or ready for EVC, but not yet scheduled
      const isAtEVC = st.code === 'EVC'
      const isScheduled = a.evcSchedule && a.evcSchedule.status !== 'UNSCHEDULED'
      if (selectedRegion !== 'ALL' && a.region !== selectedRegion) return false
      return isAtEVC && !isScheduled
    })
  }, [evcRequiringApps, selectedRegion])

  const scheduledVisits = useMemo(() => {
    return evcRequiringApps.filter((a) => {
      if (selectedRegion !== 'ALL' && a.region !== selectedRegion) return false
      return a.evcSchedule?.status === 'SCHEDULED'
    })
  }, [evcRequiringApps, selectedRegion])

  const completedVisits = useMemo(() => {
    return evcRequiringApps.filter((a) => {
      if (selectedRegion !== 'ALL' && a.region !== selectedRegion) return false
      return a.evcSchedule?.status === 'VISIT_COMPLETED' || a.evcSchedule?.status === 'REPORT_SUBMITTED'
    })
  }, [evcRequiringApps, selectedRegion])

  const openScheduleModal = (app: Application) => {
    setModalApp(app)
    setVisitDate(addDays(now, 6))
    setVenueRemarks(`${app.institution} Campus Inspection, Admin Block`)
  }

  const handleConfirmSchedule = (e: React.FormEvent) => {
    e.preventDefault()
    if (!modalApp) return

    const panel = EXPERT_POOL.filter((exp) => selectedExperts.includes(exp.name))
    scheduleEVC(modalApp.id, visitDate, panel, visitMode, venueRemarks)
    setModalApp(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
              Expert Visit Committee (EVC) Scheduling
            </h1>
            <Badge tone="blue">APH Section C</Badge>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Automated queue identification, expert panel constitution, inspection tracking, and deadline monitoring.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-gray-400" />
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          >
            <option value="ALL">All Regions</option>
            {['Western', 'Southern', 'Northern', 'Eastern', 'Central'].map((r) => (
              <option key={r} value={r}>
                {r} Region
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Clock}
          label="Pending Scheduling"
          value={unscheduledQueue.length}
          hint="At EVC stage awaiting panel assignment"
          tone="amber"
        />
        <StatCard
          icon={Calendar}
          label="Visits Scheduled"
          value={scheduledVisits.length}
          hint="Panel constituted & date notified"
          tone="blue"
        />
        <StatCard
          icon={CheckCircle2}
          label="Completed Inspections"
          value={completedVisits.length}
          hint="Field scrutiny reports recorded"
          tone="green"
        />
        <StatCard
          icon={AlertCircle}
          label="Total EVC Tracked Cases"
          value={evcRequiringApps.length}
          hint="New Institution & Intake Increases"
          tone="slate"
        />
      </div>

      {/* Queue View Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2 dark:border-gray-800">
        <button
          onClick={() => setActiveTab('queue')}
          className={cn(
            'flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
            activeTab === 'queue'
              ? 'bg-amber-600 text-white'
              : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800',
          )}
        >
          <span>Unscheduled Queue</span>
          <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px]">{unscheduledQueue.length}</span>
        </button>
        <button
          onClick={() => setActiveTab('scheduled')}
          className={cn(
            'flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
            activeTab === 'scheduled'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800',
          )}
        >
          <span>Scheduled Visits</span>
          <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px]">{scheduledVisits.length}</span>
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={cn(
            'flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
            activeTab === 'completed'
              ? 'bg-emerald-600 text-white'
              : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800',
          )}
        >
          <span>Completed Inspections</span>
          <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px]">{completedVisits.length}</span>
        </button>
      </div>

      {/* TAB 1: UNSCHEDULED QUEUE */}
      {activeTab === 'queue' && (
        <Card>
          <CardHeader
            title="Cases Awaiting EVC Panel Constitution & Date Assignment"
            subtitle="Preliminary scrutiny cleared. Applications placed in EVC queue per APH rules."
          />
          {unscheduledQueue.length === 0 ? (
            <div className="p-10 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
              <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                All EVC cases are currently scheduled!
              </p>
              <p className="text-xs text-gray-500">No pending unassigned cases in this queue.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {unscheduledQueue.map((app) => {
                const st = currentStage(app)
                const dl = deadlineState(st.dueAt, now, config.escalationRungs)
                return (
                  <div key={app.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-gray-600 dark:text-gray-400">{app.ref}</span>
                        <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{app.institution}</span>
                        <AppTypeBadge type={app.type} />
                        <Badge tone="slate">{app.region} Region</Badge>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Entered EVC Stage on {fmt(st.enteredAt)} · Waiting in queue for{' '}
                        {daysBetween(st.enteredAt, now)} days
                      </p>
                      <div className="flex items-center gap-3 text-[11px]">
                        <span className="text-gray-500">
                          Prescribed Target Date:{' '}
                          <strong className={dl.overdue ? 'text-red-600' : 'text-gray-800 dark:text-gray-200'}>
                            {fmt(st.dueAt)}
                          </strong>
                        </span>
                        {dl.overdue && <Badge tone="red">Overdue by {Math.abs(dl.daysLeft)}d</Badge>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button variant="secondary" size="sm" onClick={() => onOpenCase(app.id)}>
                        View Case
                      </Button>
                      <Button variant="primary" size="sm" onClick={() => openScheduleModal(app)}>
                        <CalendarCheck className="h-3.5 w-3.5" /> Schedule Visit
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      )}

      {/* TAB 2: SCHEDULED VISITS */}
      {activeTab === 'scheduled' && (
        <Card>
          <CardHeader
            title="Constituted EVC Panels & Scheduled Visits"
            subtitle="Inspection dates notified to institutions with committee rosters"
          />
          {scheduledVisits.length === 0 ? (
            <Empty title="No scheduled visits currently pending" />
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {scheduledVisits.map((app) => {
                const sched = app.evcSchedule!
                const daysUntil = daysBetween(now, sched.scheduledDate)
                const isPast = daysUntil < 0
                return (
                  <div key={app.id} className="space-y-3 p-5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-gray-600">{app.ref}</span>
                          <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{app.institution}</span>
                          <AppTypeBadge type={app.type} />
                          <Badge tone="blue">Scheduled</Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-gray-500">
                          Venue: {sched.venue} · Inspection Mode:{' '}
                          <span className="font-semibold">{sched.mode}</span>
                        </p>
                      </div>

                      <div className="text-right">
                        <span
                          className={cn(
                            'inline-block rounded-md px-2.5 py-1 text-xs font-semibold',
                            isPast
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
                          )}
                        >
                          {isPast
                            ? `Inspection held ${Math.abs(daysUntil)} days ago`
                            : `Visit in ${daysUntil} days (${fmt(sched.scheduledDate)})`}
                        </span>
                      </div>
                    </div>

                    {/* Committee Panel Members Box */}
                    <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800/40">
                      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
                        <Users className="h-3.5 w-3.5 text-blue-600" /> Constituted Expert Panel Members:
                      </p>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        {sched.assignedPanel.map((p, idx) => (
                          <div
                            key={idx}
                            className="rounded border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-900"
                          >
                            <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">{p.name}</p>
                            <p className="text-[11px] text-gray-500">{p.designation}</p>
                            <p className="text-[10px] text-gray-400">{p.institution}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      {sched.status === 'SCHEDULED' && <Button size="sm" variant="primary" onClick={() => { setReportApp(app); setReportShortcomings(false) }}>Complete visit & submit report</Button>}
                      <Button variant="secondary" size="sm" onClick={() => onOpenCase(app.id)}>
                        Case Detail & Record Outcome
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      )}

      {/* TAB 3: COMPLETED INSPECTIONS */}
      {activeTab === 'completed' && (
        <Card>
          <CardHeader
            title="Conducted EVC Inspections & Reports"
            subtitle="Archive of completed physical and virtual committee evaluations"
          />
          {completedVisits.length === 0 ? (
            <Empty title="No completed inspections yet" />
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {completedVisits.map((app) => {
                const sched = app.evcSchedule!
                return (
                  <div key={app.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-gray-500">{app.ref}</span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{app.institution}</span>
                        <AppTypeBadge type={app.type} />
                        <Badge tone="green">Visit Completed</Badge>
                      </div>
                      <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                        {sched.reportSummary || 'Physical inspection of infrastructure and faculty roster concluded.'}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        Inspected on {fmt(sched.scheduledDate)} by Chair {sched.assignedPanel[0]?.name}
                      </p>
                    </div>

                    <Button variant="secondary" size="sm" onClick={() => onOpenCase(app.id)}>
                      Inspect Report
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      )}

      {/* SCHEDULE EVC MODAL */}
      {modalApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-5 py-3 dark:border-gray-800 dark:bg-gray-800/50">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  Constitute Expert Visit Committee (EVC)
                </h3>
                <p className="text-xs text-gray-500">Assign inspection date, mode and 3-member expert panel</p>
              </div>
              <button
                onClick={() => setModalApp(null)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmSchedule} className="space-y-4 p-5">
              {/* Target Institution Info */}
              <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3 dark:border-blue-900/40 dark:bg-blue-900/20">
                <p className="text-xs text-gray-500 dark:text-gray-400">Target Institution:</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{modalApp.institution}</span>
                  <AppTypeBadge type={modalApp.type} />
                  <span className="font-mono text-xs text-gray-500">{modalApp.ref}</span>
                </div>
              </div>

              {/* Date & Mode Fields */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Proposed Inspection Date
                  </label>
                  <input
                    type="date"
                    required
                    value={visitDate}
                    onChange={(e) => setVisitDate(e.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  />
                  <p className="mt-1 text-[10px] text-gray-400">Must be scheduled prior to 30 April wall</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Inspection Modality
                  </label>
                  <select
                    value={visitMode}
                    onChange={(e) => setVisitMode(e.target.value as typeof visitMode)}
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  >
                    <option value="PHYSICAL">Physical On-Site Inspection</option>
                    <option value="HYBRID">Hybrid (On-Site Chair + Virtual Experts)</option>
                    <option value="VIRTUAL">Virtual Live Geo-tagged Video EVC</option>
                  </select>
                </div>
              </div>

              {/* Panel Member Selection */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Select Expert Committee Members (3 Nominees)
                </label>
                <div className="max-h-36 space-y-1.5 overflow-y-auto rounded-md border border-gray-200 p-2 dark:border-gray-700">
                  {EXPERT_POOL.map((exp) => {
                    const checked = selectedExperts.includes(exp.name)
                    return (
                      <label
                        key={exp.name}
                        className={cn(
                          'flex cursor-pointer items-start gap-2 rounded p-1.5 text-xs transition-colors',
                          checked ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedExperts([...selectedExperts, exp.name])
                            } else {
                              setSelectedExperts(selectedExperts.filter((n) => n !== exp.name))
                            }
                          }}
                          className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-900 dark:text-gray-100">{exp.name}</p>
                          <p className="text-[10px] text-gray-500">{exp.designation} · {exp.institution}</p>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Venue & Notes */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Venue / Inspection Instructions
                </label>
                <textarea
                  rows={2}
                  value={venueRemarks}
                  onChange={(e) => setVenueRemarks(e.target.value)}
                  placeholder="e.g. Campus address, specific departments to inspect, biometric logs verification"
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
                <Button variant="secondary" size="sm" type="button" onClick={() => setModalApp(null)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Constitute & Notify Panel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
      {reportApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={(e) => { e.preventDefault(); completeEVC(reportApp.id, reportText, reportShortcomings); act(reportApp.id, reportShortcomings ? 'SHORTCOMINGS' : 'RECOMMEND', reportShortcomings ? reportText : 'EVC report submitted with recommendation'); setReportApp(null); setActiveTab('completed') }} className="w-full max-w-xl rounded-xl bg-white shadow-2xl dark:bg-gray-900">
            <div className="flex items-center justify-between border-b p-5"><div><h3 className="font-bold text-[#123b63]">Submit EVC Inspection Report</h3><p className="text-xs text-gray-500">{reportApp.ref} · {reportApp.institution}</p></div><button type="button" onClick={()=>setReportApp(null)}><X className="h-4 w-4" /></button></div>
            <div className="space-y-4 p-5"><div className="grid grid-cols-3 gap-2 text-center text-xs"><div className="rounded bg-emerald-50 p-2 text-emerald-700">1. Visit conducted</div><div className="rounded bg-[#edf4f9] p-2 text-[#123b63]">2. Report submitted</div><div className="rounded bg-amber-50 p-2 text-amber-700">3. Route decision</div></div><textarea rows={5} required value={reportText} onChange={e=>setReportText(e.target.value)} className="w-full rounded border p-2 text-sm" /><label className="flex gap-2 rounded border border-amber-200 bg-amber-50 p-3 text-xs"><input type="checkbox" checked={reportShortcomings} onChange={e=>setReportShortcomings(e.target.checked)} />Shortcomings found. Route the case to the Standing Hearing Committee.</label><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={()=>setReportApp(null)}>Cancel</Button><Button type="submit" variant={reportShortcomings ? 'warn' : 'primary'}>{reportShortcomings ? 'Submit & route to SHC' : 'Submit & recommend'}</Button></div></div>
          </form>
        </div>
      )}
    </div>
  )
}

import { useMemo, useState } from 'react'
import {
  CheckCircle2,
  Clock,
  Download,
  FileBarChart2,
  Filter,
  Printer,
  ShieldAlert,
} from 'lucide-react'
import { AppTypeBadge, Badge, Button, Card, CardHeader, Empty, StatCard, cn } from '@/components/ui/primitives'
import { useStore, ageDays, currentStage, isOverdue, statusOf } from '@/lib/store'
import { APP_TYPES, STAGE_LABEL, roleLabel } from '@/lib/workflow'
import { ACADEMIC_YEAR, deadlineState, fmt } from '@/lib/deadlines'
import type { StageCode } from '@/lib/types'

type ReportTab = 'pendency' | 'evc' | 'compliance' | 'overdue'

const REGIONS = ['Western', 'Southern', 'Northern', 'Eastern', 'Central']
const STAGES: StageCode[] = ['SCRUTINY', 'EVC', 'SHC', 'EC_DECISION', 'COUNCIL_RATIFICATION', 'APPEAL']

export default function Reports({ onOpenCase }: { onOpenCase: (id: string) => void }) {
  const { apps, now, config } = useStore()
  const [tab, setTab] = useState<ReportTab>('pendency')
  const [selectedRegion, setSelectedRegion] = useState<string>('ALL')
  const [selectedType, setSelectedType] = useState<string>('ALL')

  // Filtered applications
  const filteredApps = useMemo(() => {
    return apps.filter((a) => {
      if (selectedRegion !== 'ALL' && a.region !== selectedRegion) return false
      if (selectedType !== 'ALL' && a.type !== selectedType) return false
      return true
    })
  }, [apps, selectedRegion, selectedType])

  // Aggregate metrics
  const totalOpen = useMemo(() => filteredApps.filter((a) => statusOf(a) === 'OPEN').length, [filteredApps])
  const totalOverdue = useMemo(
    () => filteredApps.filter((a) => isOverdue(a, now, config.escalationRungs)).length,
    [filteredApps, now, config.escalationRungs],
  )

  // All obligations
  const allObligations = useMemo(() => {
    return filteredApps.flatMap((a) =>
      a.obligations.map((o) => ({
        ...o,
        appRef: a.ref,
        institution: a.institution,
        region: a.region,
        appType: a.type,
      })),
    )
  }, [filteredApps])

  // EVC applications
  const evcApps = useMemo(() => {
    return filteredApps.filter(
      (a) => a.stages.some((s) => s.code === 'EVC') || a.evcSchedule !== undefined,
    )
  }, [filteredApps])

  // CSV Exporter helper
  const exportCSV = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const csvContent = [
      headers.join(','),
      ...rows.map((r) =>
        r
          .map((v) => {
            const str = String(v ?? '')
            return str.includes(',') || str.includes('"') || str.includes('\n')
              ? `"${str.replaceAll('"', '""')}"`
              : str
          })
          .join(','),
      ),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `${filename}-${now}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Handle Tab-specific CSV Downloads
  const handleDownload = () => {
    if (tab === 'pendency') {
      const headers = [
        'Application Ref',
        'Institution Name',
        'Approval Type',
        'Region',
        'Submission Date',
        'Current Stage',
        'Stage Due Date',
        'Ageing Days',
        'Status',
        'Overdue',
      ]
      const rows = filteredApps.map((a) => {
        const st = currentStage(a)
        const od = isOverdue(a, now, config.escalationRungs)
        return [
          a.ref,
          a.institution,
          a.type,
          a.region,
          a.createdAt,
          STAGE_LABEL[st.code],
          st.dueAt,
          ageDays(a, now),
          statusOf(a),
          od ? 'YES' : 'NO',
        ]
      })
      exportCSV(`aicte-pendency-report`, headers, rows)
    } else if (tab === 'evc') {
      const headers = [
        'Application Ref',
        'Institution Name',
        'Approval Type',
        'Region',
        'EVC Status',
        'Scheduled Date',
        'Inspection Mode',
        'Panel Chairman',
        'Panel Members',
        'Venue',
        'Shortcomings Noted',
      ]
      const rows = evcApps.map((a) => {
        const sched = a.evcSchedule
        const panel = sched?.assignedPanel || []
        return [
          a.ref,
          a.institution,
          a.type,
          a.region,
          sched?.status || 'UNSCHEDULED',
          sched?.scheduledDate || 'Not Fixed',
          sched?.mode || 'PHYSICAL',
          panel[0]?.name || 'Pending Assignment',
          panel.slice(1).map((p) => p.name).join('; ') || 'N/A',
          sched?.venue || 'Campus',
          sched?.shortcomingsFound ? 'YES' : 'NO',
        ]
      })
      exportCSV(`aicte-evc-inspections-report`, headers, rows)
    } else if (tab === 'compliance') {
      const headers = [
        'Obligation ID',
        'Application Ref',
        'Institution Name',
        'Approval Type',
        'Obligation Label',
        'Kind',
        'Due Date',
        'Status',
        'Submitted Ref',
        'Verified By',
      ]
      const rows = allObligations.map((o) => [
        o.id,
        o.appRef,
        o.institution,
        o.appType,
        o.label,
        o.kind,
        o.dueAt,
        o.status.toUpperCase(),
        o.submittedDocRef || 'None',
        o.verifiedBy || 'Pending',
      ])
      exportCSV(`aicte-undertakings-compliance-report`, headers, rows)
    } else if (tab === 'overdue') {
      const overdueList = filteredApps.filter((a) => isOverdue(a, now, config.escalationRungs))
      const headers = [
        'Application Ref',
        'Institution Name',
        'Approval Type',
        'Region',
        'Delayed Stage',
        'Due Date',
        'Days Overdue',
        'Escalation Level',
        'Responsible Authority',
      ]
      const rows = overdueList.map((a) => {
        const st = currentStage(a)
        const dl = deadlineState(st.dueAt, now, config.escalationRungs)
        return [
          a.ref,
          a.institution,
          a.type,
          a.region,
          STAGE_LABEL[st.code],
          st.dueAt,
          Math.abs(dl.daysLeft),
          `L${dl.level}`,
          roleLabel(st.actorRole),
        ]
      })
      exportCSV(`aicte-overdue-escalations-report`, headers, rows)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
              Consolidated Regulatory Reports
            </h1>
            <Badge tone="blue">AY {ACADEMIC_YEAR}</Badge>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Mandated audit & MIS reporting across processing pendency, EVC scheduling, institutional compliance, and overdue escalations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" /> Print / PDF
          </Button>
          <Button variant="primary" size="sm" onClick={handleDownload}>
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={FileBarChart2}
          label="Total Cases Evaluated"
          value={filteredApps.length}
          hint="Under active approval cycle"
          tone="blue"
        />
        <StatCard
          icon={Clock}
          label="Open In-Progress Cases"
          value={totalOpen}
          hint="Routing across committees"
          tone="amber"
        />
        <StatCard
          icon={ShieldAlert}
          label="Overdue SLA Breaches"
          value={totalOverdue}
          hint="Escalation ladder active"
          tone="red"
        />
        <StatCard
          icon={CheckCircle2}
          label="Compliance Undertakings"
          value={allObligations.length}
          hint={`${allObligations.filter((o) => o.status === 'verified').length} verified, ${allObligations.filter((o) => o.status === 'open').length} pending`}
          tone="green"
        />
      </div>

      {/* Filters & Tabs Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 pb-3 dark:border-gray-800">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTab('pendency')}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              tab === 'pendency'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800',
            )}
          >
            Stage & Region Pendency
          </button>
          <button
            onClick={() => setTab('evc')}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              tab === 'evc'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800',
            )}
          >
            EVC Scheduling & Visits ({evcApps.length})
          </button>
          <button
            onClick={() => setTab('compliance')}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              tab === 'compliance'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800',
            )}
          >
            Institutional Undertakings ({allObligations.length})
          </button>
          <button
            onClick={() => setTab('overdue')}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              tab === 'overdue'
                ? 'bg-red-600 text-white'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800',
            )}
          >
            Overdue Cases Register ({totalOverdue})
          </button>
        </div>

        {/* Region & Type Filter Selectors */}
        <div className="flex items-center gap-2 print:hidden">
          <Filter className="h-3.5 w-3.5 text-gray-400" />
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          >
            <option value="ALL">All Regions</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r} Region
              </option>
            ))}
          </select>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          >
            <option value="ALL">All Approval Types</option>
            {APP_TYPES.map((t) => (
              <option key={t.code} value={t.code}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* TAB 1: PENDENCY REPORT */}
      {tab === 'pendency' && (
        <div className="space-y-6">
          {/* Region-wise Pendency Matrix */}
          <Card>
            <CardHeader
              title="Region × Stage Pendency Distribution Matrix"
              subtitle="Live case breakdown across AICTE regional offices and regulatory committees"
            />
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/80 text-gray-500 dark:border-gray-800 dark:bg-gray-800/40">
                    <th className="px-4 py-3 font-semibold">Region</th>
                    {STAGES.map((s) => (
                      <th key={s} className="px-3 py-3 text-center font-semibold">
                        {s.replaceAll('_', ' ')}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right font-semibold">Total Open</th>
                    <th className="px-4 py-3 text-right font-semibold">Overdue Breaches</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {REGIONS.map((region) => {
                    const regApps = filteredApps.filter((a) => a.region === region && statusOf(a) === 'OPEN')
                    const regOverdue = regApps.filter((a) => isOverdue(a, now, config.escalationRungs)).length
                    return (
                      <tr key={region} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/30">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{region}</td>
                        {STAGES.map((s) => {
                          const count = regApps.filter((a) => currentStage(a).code === s).length
                          return (
                            <td key={s} className="px-3 py-3 text-center tabular-nums">
                              {count > 0 ? (
                                <span className="inline-block rounded bg-gray-100 px-2 py-0.5 font-semibold text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                                  {count}
                                </span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                          )
                        })}
                        <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-gray-100">
                          {regApps.length}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {regOverdue > 0 ? (
                            <Badge tone="red">{regOverdue} overdue</Badge>
                          ) : (
                            <Badge tone="green">All on track</Badge>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Detailed Applications List */}
          <Card>
            <CardHeader
              title="Individual Applications Case Register"
              subtitle="Full audit listing showing institution name alongside highlighted approval type"
            />
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/80 text-gray-500 dark:border-gray-800 dark:bg-gray-800/40">
                    <th className="px-4 py-3 font-semibold">Application Ref</th>
                    <th className="px-4 py-3 font-semibold">Institution Name & Approval Type</th>
                    <th className="px-3 py-3 font-semibold">Region</th>
                    <th className="px-3 py-3 font-semibold">Current Stage</th>
                    <th className="px-3 py-3 font-semibold">Stage Due</th>
                    <th className="px-3 py-3 font-semibold">Ageing</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredApps.map((a) => {
                    const st = currentStage(a)
                    const od = isOverdue(a, now, config.escalationRungs)
                    const s = statusOf(a)
                    return (
                      <tr key={a.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/30">
                        <td className="px-4 py-3 font-mono font-semibold text-gray-900 dark:text-gray-100">{a.ref}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-gray-900 dark:text-gray-100">{a.institution}</span>
                            <AppTypeBadge type={a.type} />
                          </div>
                        </td>
                        <td className="px-3 py-3 text-gray-600 dark:text-gray-400">{a.region}</td>
                        <td className="px-3 py-3 font-medium text-gray-800 dark:text-gray-200">
                          {STAGE_LABEL[st.code]}
                        </td>
                        <td className="px-3 py-3">
                          <span className={cn('tabular-nums', od ? 'font-semibold text-red-600' : 'text-gray-600')}>
                            {fmt(st.dueAt)}
                          </span>
                        </td>
                        <td className="px-3 py-3 tabular-nums text-gray-600">{ageDays(a, now)}d</td>
                        <td className="px-3 py-3">
                          {s === 'OPEN' && <Badge tone={od ? 'red' : 'blue'}>{od ? 'Overdue' : 'Active'}</Badge>}
                          {s === 'APPROVED' && <Badge tone="green">Approved</Badge>}
                          {s === 'REJECTED' && <Badge tone="red">Rejected</Badge>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => onOpenCase(a.id)}
                            className="rounded border border-gray-300 px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                          >
                            View Case
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: EVC STATUS & SCHEDULING REPORT */}
      {tab === 'evc' && (
        <Card>
          <CardHeader
            title="Expert Visit Committee (EVC) Monitoring & Inspection Register"
            subtitle="Tracking of inspection panels, scheduled dates, visit modes, and field reports"
          />
          {evcApps.length === 0 ? (
            <Empty title="No EVC cases found matching filters" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/80 text-gray-500 dark:border-gray-800 dark:bg-gray-800/40">
                    <th className="px-4 py-3 font-semibold">Ref</th>
                    <th className="px-4 py-3 font-semibold">Institution Name & Approval Type</th>
                    <th className="px-3 py-3 font-semibold">Region</th>
                    <th className="px-3 py-3 font-semibold">EVC Status</th>
                    <th className="px-3 py-3 font-semibold">Scheduled Date</th>
                    <th className="px-3 py-3 font-semibold">Mode</th>
                    <th className="px-4 py-3 font-semibold">Constituted Panel</th>
                    <th className="px-4 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {evcApps.map((a) => {
                    const sched = a.evcSchedule
                    const status = sched?.status || 'UNSCHEDULED'
                    return (
                      <tr key={a.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/30">
                        <td className="px-4 py-3 font-mono font-medium text-gray-900 dark:text-gray-100">{a.ref}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-gray-900 dark:text-gray-100">{a.institution}</span>
                            <AppTypeBadge type={a.type} />
                          </div>
                        </td>
                        <td className="px-3 py-3 text-gray-600">{a.region}</td>
                        <td className="px-3 py-3">
                          {status === 'VISIT_COMPLETED' && <Badge tone="green">Completed</Badge>}
                          {status === 'SCHEDULED' && <Badge tone="blue">Scheduled</Badge>}
                          {status === 'UNSCHEDULED' && <Badge tone="amber">Pending Scheduling</Badge>}
                        </td>
                        <td className="px-3 py-3 tabular-nums">
                          {sched?.scheduledDate ? fmt(sched.scheduledDate) : <span className="text-gray-400">TBD</span>}
                        </td>
                        <td className="px-3 py-3">
                          <Badge tone="slate">{sched?.mode || 'PHYSICAL'}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          {sched?.assignedPanel && sched.assignedPanel.length > 0 ? (
                            <div>
                              <p className="font-medium text-gray-900 dark:text-gray-100">
                                {sched.assignedPanel[0].name} ({sched.assignedPanel[0].designation})
                              </p>
                              <p className="text-[10px] text-gray-500">
                                + {sched.assignedPanel.length - 1} expert members
                              </p>
                            </div>
                          ) : (
                            <span className="text-gray-400">Panel not assigned</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => onOpenCase(a.id)}
                            className="rounded border border-gray-300 px-2.5 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* TAB 3: INSTITUTIONAL COMPLIANCE REPORT */}
      {tab === 'compliance' && (
        <Card>
          <CardHeader
            title="Institutional Undertakings & Document Validity Compliance Summary"
            subtitle="Full register of post-approval undertakings, evidence submissions, and lease gate predicates"
          />
          {allObligations.length === 0 ? (
            <Empty title="No undertakings recorded for current selection" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/80 text-gray-500 dark:border-gray-800 dark:bg-gray-800/40">
                    <th className="px-4 py-3 font-semibold">ID</th>
                    <th className="px-4 py-3 font-semibold">Institution Name & Approval Type</th>
                    <th className="px-4 py-3 font-semibold">Undertaking / Compliance Condition</th>
                    <th className="px-3 py-3 font-semibold">Kind</th>
                    <th className="px-3 py-3 font-semibold">Due Date</th>
                    <th className="px-3 py-3 font-semibold">Compliance Status</th>
                    <th className="px-4 py-3 font-semibold">Evidence Details</th>
                    <th className="px-4 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {allObligations.map((o) => {
                    const late = o.dueAt < now && o.status !== 'verified'
                    return (
                      <tr key={o.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/30">
                        <td className="px-4 py-3 font-mono font-medium text-gray-500">{o.id}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-gray-900 dark:text-gray-100">{o.institution}</span>
                            <AppTypeBadge type={o.appType} />
                          </div>
                          <span className="text-[10px] text-gray-400">{o.appRef}</span>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{o.label}</td>
                        <td className="px-3 py-3">
                          <Badge tone="slate">{o.kind.replaceAll('_', ' ')}</Badge>
                        </td>
                        <td className="px-3 py-3 tabular-nums">
                          <span className={cn(late ? 'font-semibold text-red-600' : 'text-gray-700 dark:text-gray-300')}>
                            {fmt(o.dueAt)}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          {o.status === 'verified' && <Badge tone="green">Verified & Cleared</Badge>}
                          {o.status === 'submitted' && <Badge tone="blue">Submitted for Review</Badge>}
                          {o.status === 'open' && (
                            <Badge tone={late ? 'red' : 'amber'}>{late ? 'Overdue' : 'Pending Submission'}</Badge>
                          )}
                          {o.status === 'breached' && <Badge tone="red">Breached</Badge>}
                        </td>
                        <td className="px-4 py-3 text-[11px] text-gray-600 dark:text-gray-400">
                          {o.submittedDocName ? (
                            <div>
                              <p className="font-medium text-blue-600 dark:text-blue-400">{o.submittedDocName}</p>
                              {o.submittedDocRef && <p className="text-[10px] text-gray-400">Ref: {o.submittedDocRef}</p>}
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => onOpenCase(o.appId)}
                            className="rounded border border-gray-300 px-2.5 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* TAB 4: OVERDUE CASES REGISTER */}
      {tab === 'overdue' && (
        <Card>
          <CardHeader
            title="Overdue Approvals & Escalation Ladder Audit"
            subtitle="Cases that exceeded stage SLAs with automatic escalation rungs and responsible authorities"
          />
          {totalOverdue === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
              <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                Zero SLA breaches on record!
              </p>
              <p className="text-xs text-gray-500">All applications in selected filters are moving within timelines.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/80 text-gray-500 dark:border-gray-800 dark:bg-gray-800/40">
                    <th className="px-4 py-3 font-semibold">Ref</th>
                    <th className="px-4 py-3 font-semibold">Institution Name & Approval Type</th>
                    <th className="px-3 py-3 font-semibold">Region</th>
                    <th className="px-3 py-3 font-semibold">Pending Stage</th>
                    <th className="px-3 py-3 font-semibold">Prescribed Due</th>
                    <th className="px-3 py-3 font-semibold">Overdue Duration</th>
                    <th className="px-3 py-3 font-semibold">Escalation Rung</th>
                    <th className="px-4 py-3 font-semibold">Notified Authority</th>
                    <th className="px-4 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredApps
                    .filter((a) => isOverdue(a, now, config.escalationRungs))
                    .map((a) => {
                      const st = currentStage(a)
                      const dl = deadlineState(st.dueAt, now, config.escalationRungs)
                      const rung = config.escalationRungs[Math.max(0, dl.level - 1)]
                      return (
                        <tr key={a.id} className="hover:bg-red-50/20 dark:hover:bg-red-900/10">
                          <td className="px-4 py-3 font-mono font-semibold text-red-600 dark:text-red-400">{a.ref}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-gray-900 dark:text-gray-100">{a.institution}</span>
                              <AppTypeBadge type={a.type} />
                            </div>
                          </td>
                          <td className="px-3 py-3 text-gray-600">{a.region}</td>
                          <td className="px-3 py-3 font-medium text-gray-800 dark:text-gray-200">
                            {STAGE_LABEL[st.code]}
                          </td>
                          <td className="px-3 py-3 tabular-nums text-gray-600">{fmt(st.dueAt)}</td>
                          <td className="px-3 py-3 font-bold tabular-nums text-red-600">
                            {Math.abs(dl.daysLeft)} days late
                          </td>
                          <td className="px-3 py-3">
                            <Badge tone="red">Level {dl.level}</Badge>
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                            {rung?.notify || roleLabel(st.actorRole)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => onOpenCase(a.id)}
                              className="rounded border border-red-300 bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
                            >
                              Escalate
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}

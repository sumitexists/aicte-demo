import { useMemo } from 'react'
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  CheckCircle2,
  FilePlus2,
  FileWarning,
  Flame,
  Gauge,
  Layers,
  Timer,
  TrendingUp,
} from 'lucide-react'
import {
  AppTypeBadge,
  Badge,
  Button,
  Card,
  CardHeader,
  Empty,
  Progress,
  SourceBadge,
  StatCard,
  cn,
} from '@/components/ui/primitives'
import { useStore, ageDays, currentStage, isOverdue, statusOf } from '@/lib/store'
import { APP_TYPES, STAGE_ACTOR, STAGE_LABEL, appTypeDef, roleLabel } from '@/lib/workflow'
import {
  ACADEMIC_YEAR,
  CYCLE_START,
  allocatedDueFor,
  deadlineState,
  daysBetween,
  fmt,
} from '@/lib/deadlines'
import type { Application, RoleCode, StageCode } from '@/lib/types'

const STAGE_ORDER: StageCode[] = ['SCRUTINY', 'EVC', 'SHC', 'EC_DECISION', 'COUNCIL_RATIFICATION', 'APPEAL']
const REGIONS = ['Western', 'Southern', 'Northern', 'Eastern', 'Central']

function relevantToRole(app: Application, role: string) {
  if (role === 'BUREAU' || role === 'INSTITUTION') return true
  return STAGE_ACTOR[currentStage(app).code] === role
}

export default function Dashboard({
  onOpen,
  onOpenInbox,
  onNewApplication,
}: {
  onOpen: (id: string) => void
  onOpenInbox: () => void
  onNewApplication: () => void
}) {
  const { apps: allApps, now, role, alerts, institution, unread, config } = useStore()
  // the institution portal is scoped to the signed-in institution's own filings
  const apps = role === 'INSTITUTION' ? allApps.filter((a) => a.institution === institution.name) : allApps

  const stats = useMemo(() => {
    const open = apps.filter((a) => statusOf(a) === 'OPEN')
    const overdue = open.filter((a) => isOverdue(a, now, config.escalationRungs))
    const paceOf = (a: Application) =>
      allocatedDueFor(
        a.type,
        currentStage(a).code,
        now,
        config.decisionDeadline,
        config.stageDurations,
        config.paceGamma,
      ).pace
    const nearCutoff = open.filter((a) => !paceOf(a).feasible)
    const compressed = open.filter((a) => {
      const p = paceOf(a)
      return p.feasible && p.band === 'COMPRESSED'
    })
    const obligations = apps.flatMap((a) => a.obligations)
    const docAlerts = obligations.filter((o) => {
      if (o.status === 'verified') return false
      const d = daysBetween(now, o.dueAt)
      return d <= 90
    })
    const escalations = alerts.filter((n) => n.level >= 3)
    return { open, overdue, nearCutoff, compressed, obligations, docAlerts, escalations }
  }, [apps, now, alerts, config])

  const myQueue = useMemo(
    () =>
      apps
        .filter((a) => statusOf(a) === 'OPEN' && relevantToRole(a, role))
        .sort((a, b) => currentStage(a).dueAt.localeCompare(currentStage(b).dueAt)),
    [apps, role],
  )

  // Bottleneck Detection Logic (PS Section B)
  const bottleneckData = useMemo(() => {
    const stageCounts: Record<StageCode, { open: number; overdue: number; totalAge: number }> = {
      SUBMITTED: { open: 0, overdue: 0, totalAge: 0 },
      SELF_DISCLOSURE: { open: 0, overdue: 0, totalAge: 0 },
      SCRUTINY: { open: 0, overdue: 0, totalAge: 0 },
      INSTITUTION_REPLY: { open: 0, overdue: 0, totalAge: 0 },
      RE_SCRUTINY: { open: 0, overdue: 0, totalAge: 0 },
      EVC: { open: 0, overdue: 0, totalAge: 0 },
      SHC: { open: 0, overdue: 0, totalAge: 0 },
      EC_DECISION: { open: 0, overdue: 0, totalAge: 0 },
      COUNCIL_RATIFICATION: { open: 0, overdue: 0, totalAge: 0 },
      APPEAL: { open: 0, overdue: 0, totalAge: 0 },
      CLOSED: { open: 0, overdue: 0, totalAge: 0 },
    }

    for (const a of apps) {
      if (statusOf(a) !== 'OPEN') continue
      const st = currentStage(a)
      const od = isOverdue(a, now, config.escalationRungs)
      const age = ageDays(a, now)
      if (stageCounts[st.code]) {
        stageCounts[st.code].open += 1
        if (od) stageCounts[st.code].overdue += 1
        stageCounts[st.code].totalAge += age
      }
    }

    // Find stage with most overdue cases or highest volume
    let maxOverdueStage: StageCode = 'SCRUTINY'
    let maxOverdueCount = -1

    for (const code of STAGE_ORDER) {
      const item = stageCounts[code]
      if (item.overdue > maxOverdueCount) {
        maxOverdueCount = item.overdue
        maxOverdueStage = code
      }
    }

    // Desk workloads (active counts across desks)
    const desks = [
      { role: 'SCRUTINY', label: 'Scrutiny Committee', count: stageCounts.SCRUTINY.open + stageCounts.RE_SCRUTINY.open },
      { role: 'EVC', label: 'Expert Visit Committee', count: stageCounts.EVC.open },
      { role: 'SHC', label: 'Standing Hearing Committee', count: stageCounts.SHC.open },
      { role: 'EC', label: 'Executive Committee', count: stageCounts.EC_DECISION.open },
      { role: 'COUNCIL', label: 'Council Ratification', count: stageCounts.COUNCIL_RATIFICATION.open },
      { role: 'SAC', label: 'Standing Appellate Committee', count: stageCounts.APPEAL.open },
    ]

    return {
      worstStage: maxOverdueStage,
      worstOverdueCount: maxOverdueCount,
      avgAgeing:
        stageCounts[maxOverdueStage].open > 0
          ? Math.round(stageCounts[maxOverdueStage].totalAge / stageCounts[maxOverdueStage].open)
          : 0,
      desks,
    }
  }, [apps, now, config])

  const matrix = useMemo(() => {
    return REGIONS.map((r) => {
      const row: Record<string, number> = {}
      for (const s of STAGE_ORDER) row[s] = 0
      for (const a of apps) {
        if (a.region !== r || statusOf(a) !== 'OPEN') continue
        const code = currentStage(a).code
        if (row[code] !== undefined) row[code] += 1
        else if (code === 'INSTITUTION_REPLY' || code === 'RE_SCRUTINY') row.SCRUTINY += 1
        else if (code === 'SELF_DISCLOSURE') row.SCRUTINY += 1
      }
      return { region: r, row }
    })
  }, [apps])

  // Feed addressed to this desk only
  const feed = [...alerts]
    .sort((a, b) => b.ts.localeCompare(a.ts))
    .slice(0, 7)

  const myRoleLabel = roleLabel(role)

  return (
    <div className="space-y-6">
      <header>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50">Dashboard</h1>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
              {role === 'INSTITUTION' ? (
                <>
                  <span className="font-semibold text-gray-900 dark:text-gray-200">{institution.name}</span> ·{' '}
                  {apps.length} application(s) filed by you · as on{' '}
                  <span className="font-semibold text-gray-900 dark:text-gray-200">{fmt(now)}</span>
                </>
              ) : (
                <>
                  Viewing as <span className="font-semibold text-gray-900 dark:text-gray-200">{myRoleLabel}</span> · as
                  on <span className="font-semibold text-gray-900 dark:text-gray-200">{fmt(now)}</span> · AY{' '}
                  {ACADEMIC_YEAR}
                </>
              )}
            </p>
          </div>

          {role === 'INSTITUTION' && (
            <Button variant="primary" onClick={onNewApplication}>
              <FilePlus2 className="h-4 w-4" /> New application
            </Button>
          )}
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Layers}
          label="Open applications"
          value={stats.open.length}
          hint={`${apps.length} total this cycle`}
          tone="blue"
        />
        <StatCard
          icon={AlertTriangle}
          label="Overdue at current stage"
          value={stats.overdue.length}
          hint={stats.overdue.length ? 'Escalation ladder active' : 'All stages on schedule'}
          tone={stats.overdue.length ? 'red' : 'green'}
        />
        <StatCard
          icon={CalendarClock}
          label="Cannot meet 30 April"
          value={stats.nearCutoff.length}
          hint={`${stats.compressed.length} more compressed to fit the wall`}
          tone={stats.nearCutoff.length ? 'amber' : 'green'}
        />
        <StatCard
          icon={FileWarning}
          label="Compliance due ≤ 90 days"
          value={stats.docAlerts.length}
          hint={`${stats.escalations.length} escalation(s) at L3+`}
          tone={stats.docAlerts.length ? 'violet' : 'green'}
        />
      </div>

      {/* BOTTLENECK INTELLIGENCE & WORKLOAD DISTRIBUTION (PS Section B) */}
      <Card className="border-amber-200 bg-linear-to-r from-amber-50/40 via-white to-white dark:border-amber-900/40 dark:from-amber-950/20 dark:via-gray-900 dark:to-gray-900">
        <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1 lg:max-w-xl">
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-content-center rounded-md bg-amber-500 text-white">
                <Flame className="h-3.5 w-3.5" />
              </span>
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                Processing Bottleneck Detection Intelligence
              </h3>
              <Badge tone="red">Live Diagnostic</Badge>
            </div>
            <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-300">
              Critical congestion identified at{' '}
              <strong className="text-red-700 dark:text-red-400">
                {STAGE_LABEL[bottleneckData.worstStage]}
              </strong>
              . Currently holding <strong>{bottleneckData.worstOverdueCount}</strong> overdue cases with average ageing
              of <strong>{bottleneckData.avgAgeing} days</strong>.
            </p>
            <p className="text-[11px] text-gray-500">
              Prescribed action: Expedite expert committee constitution or trigger L2 Bureau escalation.
            </p>
          </div>

          {/* Workload Distribution Bars */}
          <div className="flex-1 space-y-2 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-800/60 lg:max-w-md">
            <p className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
              <span>Desk Workload Capacity</span>
              <span>Active Cases</span>
            </p>
            <div className="space-y-1.5">
              {bottleneckData.desks.slice(0, 4).map((d) => {
                const pct = stats.open.length > 0 ? Math.round((d.count / stats.open.length) * 100) : 0
                return (
                  <div key={d.role} className="space-y-0.5 text-xs">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-gray-700 dark:text-gray-300">{d.label}</span>
                      <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                        {d.count} ({pct}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          pct > 40 ? 'bg-red-500' : pct > 20 ? 'bg-amber-500' : 'bg-blue-500',
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Role Queue Card with Highlighted Approval Type on Every Item */}
          <Card>
            <CardHeader
              title={`${myRoleLabel} Queue`}
              subtitle={
                role === 'BUREAU'
                  ? 'All regions — every open case in the cycle'
                  : role === 'INSTITUTION'
                    ? 'Your applications awaiting action from AICTE'
                    : `Cases currently sitting at a stage this role owns (${role})`
              }
              action={<Badge tone="blue">{myQueue.length} Pending</Badge>}
            />
            {myQueue.length === 0 ? (
              <Empty
                title="Nothing pending at this desk"
                hint="Switch role or advance the demo clock to see cases move."
              />
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {myQueue.slice(0, 8).map((a) => {
                  const st = currentStage(a)
                  const dl = deadlineState(st.dueAt, now, config.escalationRungs)
                  return (
                    <button
                      key={a.id}
                      onClick={() => onOpen(a.id)}
                      className="flex w-full items-center gap-4 px-5 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/60"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-gray-500 dark:text-gray-400">
                            {a.ref}
                          </span>
                          <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{a.institution}</span>
                          {/* HIGHLIGHTED APPROVAL TYPE BADGE */}
                          <AppTypeBadge type={a.type} />
                          <Badge tone="slate">{a.region}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {STAGE_LABEL[st.code]} · Stage Age {ageDays(a, now)}d
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p
                          className={cn(
                            'text-xs font-semibold',
                            dl.overdue
                              ? 'text-red-600 dark:text-red-400'
                              : dl.daysLeft <= 3
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-gray-600 dark:text-gray-300',
                          )}
                        >
                          {dl.overdue ? `${Math.abs(dl.daysLeft)}d overdue` : `${dl.daysLeft}d left`}
                        </p>
                        <p className="mt-0.5 text-[11px] text-gray-400">due {fmt(st.dueAt)}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </Card>

          {/* Region × Stage Matrix */}
          <Card>
            <CardHeader
              title="Pendency by Region and Stage"
              subtitle="Live query over case state — not a manually compiled report"
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-[11px] uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400">
                    <th className="px-5 py-2 font-medium">Region</th>
                    {STAGE_ORDER.map((s) => (
                      <th key={s} className="px-2 py-2 text-center font-medium">
                        {s.replace('_', ' ').slice(0, 12)}
                      </th>
                    ))}
                    <th className="px-5 py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.map(({ region, row }) => {
                    const total = Object.values(row).reduce((a, b) => a + b, 0)
                    return (
                      <tr key={region} className="border-b border-gray-50 last:border-0 dark:border-gray-800/60">
                        <td className="px-5 py-2.5 font-medium text-gray-800 dark:text-gray-200">{region}</td>
                        {STAGE_ORDER.map((s) => (
                          <td key={s} className="px-2 py-2.5 text-center">
                            <span
                              className={cn(
                                'inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 text-xs',
                                row[s]
                                  ? 'bg-blue-50 font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                  : 'text-gray-300 dark:text-gray-600',
                              )}
                            >
                              {row[s]}
                            </span>
                          </td>
                        ))}
                        <td className="px-5 py-2.5 text-right font-semibold text-gray-900 dark:text-gray-100">
                          {total}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Sidebar Cards */}
        <div className="space-y-6">
          {/* Deadline Feed */}
          <Card>
            <CardHeader
              title="Deadline Feed"
              subtitle="Generated automatically by the clock engine"
              action={
                <button
                  onClick={onOpenInbox}
                  className="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[11px] font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <Bell className="h-3 w-3" /> Inbox{unread > 0 ? ` (${unread})` : ''}
                </button>
              }
            />
            {feed.length === 0 ? (
              <Empty title="No alerts yet" hint="Advance the demo clock to cross a threshold." />
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {feed.map((e) => (
                  <li key={e.id} className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      {e.kind === 'ESCALATION' ? (
                        <TrendingUp className="h-3.5 w-3.5 text-red-500 shrink-0" />
                      ) : (
                        <Timer className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      )}
                      <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{e.subject}</span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-400">{e.body}</p>
                    <p className="mt-1 flex items-center gap-2 text-[11px] text-gray-400">
                      {fmt(e.ts.slice(0, 10))}
                      <Badge tone="slate">to {roleLabel(e.to as RoleCode)}</Badge>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Cycle Position Card */}
          <Card>
            <CardHeader title="Cycle Position" subtitle={`Approval must issue by ${fmt(config.decisionDeadline)}`} />
            <div className="space-y-4 px-5 py-4">
              {(() => {
                const total = daysBetween(CYCLE_START, config.decisionDeadline)
                const done = Math.max(0, Math.min(total, daysBetween(CYCLE_START, now)))
                return (
                  <>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Elapsed</span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {done} / {total} days
                      </span>
                    </div>
                    <Progress value={(done / total) * 100} tone={done / total > 0.85 ? 'red' : 'blue'} />
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>15 Nov 2025</span>
                      <span>{fmt(config.decisionDeadline)}</span>
                    </div>
                  </>
                )
              })()}
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/60">
                <div className="flex items-center gap-2">
                  <Gauge className="h-3.5 w-3.5 text-gray-500" />
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Stage deadlines are</span>
                  <SourceBadge source="ADMIN" />
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
                  Allocated from the cut-off, scaled exponentially (γ = {config.paceGamma.toFixed(1)}) — slack stretches
                  the due date, a short window squeezes it.
                </p>
              </div>
            </div>
          </Card>

          {/* Application Category Mix */}
          <Card>
            <CardHeader title="Application Mix" />
            <div className="space-y-2 px-5 py-4">
              {APP_TYPES.map((t) => {
                const n = apps.filter((a) => a.type === t.code).length
                return (
                  <div key={t.code} className="flex items-center justify-between">
                    <span className="text-xs text-gray-600 dark:text-gray-400">{t.label}</span>
                    <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">{n}</span>
                  </div>
                )
              })}
              <div className="mt-3 flex items-center gap-1.5 border-t border-gray-100 pt-3 text-[11px] text-gray-500 dark:border-gray-800 dark:text-gray-400">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                {appTypeDef('EOA_SELF_DISCLOSURE').matrix.scrutiny
                  ? 'Scrutiny'
                  : 'Self-disclosure: no scrutiny, no EVC'}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import {
  ArrowDownRight,
  CheckCircle2,
  RotateCcw,
  Save,
} from 'lucide-react'
import { Badge, Button, Card, CardHeader, SourceBadge } from '@/components/ui/primitives'
import { APP_TYPES, STAGE_LABEL, STAGE_DURATION } from '@/lib/workflow'
import {
  ACADEMIC_YEAR,
  ANCHORS,
  addDays,
  allocatedDueFor,
  backPlan,
  fmt,
} from '@/lib/deadlines'
import { useStore } from '@/lib/store'
import type { AppTypeCode, StageCode } from '@/lib/types'

const yes = <Badge tone="green">Yes</Badge>
const no = <span className="text-gray-400">—</span>

export default function Rules() {
  const { now, config, updateConfig, resetConfig } = useStore()
  const [type, setType] = useState<AppTypeCode>('NEW_INSTITUTION')
  const [flashSaved, setFlashSaved] = useState(false)

  // Local editable draft state initialized from global config
  const [stageDurations, setStageDurations] = useState<Record<StageCode, number>>({
    ...config.stageDurations,
  })

  const [escalationDays, setEscalationDays] = useState<number[]>([
    config.escalationRungs[0]?.afterDays ?? 0,
    config.escalationRungs[1]?.afterDays ?? 7,
    config.escalationRungs[2]?.afterDays ?? 15,
    config.escalationRungs[3]?.afterDays ?? 30,
  ])

  const [paceGamma, setPaceGamma] = useState(config.paceGamma)

  // Presets
  const applyPreset = (preset: 'standard' | 'fastTrack' | 'buffer') => {
    if (preset === 'standard') {
      setStageDurations({ ...STAGE_DURATION })
      setEscalationDays([0, 7, 15, 30])
      setPaceGamma(1.7)
    } else if (preset === 'fastTrack') {
      setStageDurations({
        ...STAGE_DURATION,
        SCRUTINY: 5,
        RE_SCRUTINY: 3,
        EVC: 5,
        SHC: 3,
        EC_DECISION: 3,
        COUNCIL_RATIFICATION: 3,
      })
      setEscalationDays([0, 4, 8, 15])
      setPaceGamma(1.3)
    } else if (preset === 'buffer') {
      setStageDurations({
        ...STAGE_DURATION,
        SCRUTINY: 14,
        RE_SCRUTINY: 7,
        EVC: 14,
        SHC: 7,
        EC_DECISION: 7,
        COUNCIL_RATIFICATION: 7,
      })
      setEscalationDays([0, 10, 20, 45])
      setPaceGamma(2.0)
    }
  }

  const handleSave = () => {
    const nextRungs = config.escalationRungs.map((r, i) => ({
      ...r,
      afterDays: escalationDays[i] ?? r.afterDays,
    }))

    updateConfig({
      stageDurations,
      escalationRungs: nextRungs,
      paceGamma,
    })

    setFlashSaved(true)
    setTimeout(() => setFlashSaved(false), 4000)
  }

  const handleReset = () => {
    resetConfig()
    setStageDurations({ ...STAGE_DURATION })
    setEscalationDays([0, 7, 15, 30])
    setPaceGamma(1.7)
    setFlashSaved(true)
    setTimeout(() => setFlashSaved(false), 3000)
  }

  // Live calculation derived from active settings
  const plan = backPlan(type, config.decisionDeadline, config.stageDurations)

  const paceRows = APP_TYPES.map((t) => {
    const first = t.plan[1] ?? 'SCRUTINY'
    const factorAt = (d: number) =>
      allocatedDueFor(
        t.code,
        first,
        addDays(now, d),
        config.decisionDeadline,
        config.stageDurations,
        config.paceGamma,
      ).pace
    return {
      code: t.code,
      label: t.label,
      needed: factorAt(0).neededDays,
      now: factorAt(0),
      in30: factorAt(30),
      in60: factorAt(60),
    }
  })

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
            Regulatory Rules & Live Configuration Engine
          </h1>
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
            Configure processing timelines, escalation ladder triggers, and pace allocation parameters aligned with APH directives.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleReset}>
            <RotateCcw className="h-3.5 w-3.5" /> Reset Defaults
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave}>
            <Save className="h-3.5 w-3.5" /> Save Configuration
          </Button>
        </div>
      </div>

      {flashSaved && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> Regulatory parameters updated! All deadline engines recomputed in real time.
        </div>
      )}

      {/* EDITABLE CONFIGURATION PANEL */}
      <Card className="border-blue-200 shadow-sm dark:border-blue-900/50">
        <CardHeader
          title="Interactive Timelines & Rules Configuration"
          subtitle="Directly edit stage SLA day limits, escalation triggers, and dynamic curve parameters"
          action={
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-gray-500">Presets:</span>
              <button
                onClick={() => applyPreset('standard')}
                className="rounded border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >
                Standard APH
              </button>
              <button
                onClick={() => applyPreset('fastTrack')}
                className="rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
              >
                Fast-Track Window
              </button>
              <button
                onClick={() => applyPreset('buffer')}
                className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
              >
                Surge Buffer
              </button>
            </div>
          }
        />
        <div className="space-y-6 px-5 py-4">
          {/* Stage SLA Durations Config */}
          <div>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
              1. Prescribed Stage Processing Durations (Days)
            </h4>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {(['SCRUTINY', 'RE_SCRUTINY', 'EVC', 'SHC', 'EC_DECISION', 'COUNCIL_RATIFICATION'] as StageCode[]).map(
                (code) => (
                  <div
                    key={code}
                    className="rounded-lg border border-gray-200 bg-white p-2.5 dark:border-gray-700 dark:bg-gray-900"
                  >
                    <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400">
                      {STAGE_LABEL[code].split(' ')[0]}
                    </label>
                    <div className="mt-1 flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={stageDurations[code]}
                        onChange={(e) =>
                          setStageDurations({
                            ...stageDurations,
                            [code]: Math.max(1, Number(e.target.value)),
                          })
                        }
                        className="w-16 rounded border border-gray-300 px-2 py-1 text-xs font-bold tabular-nums text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                      />
                      <span className="text-[11px] text-gray-400">days</span>
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>

          {/* Escalation Ladder Triggers Config */}
          <div className="border-t border-gray-100 pt-4 dark:border-gray-800">
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
              2. Escalation Ladder Trigger Days Overdue
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              {config.escalationRungs.map((rung, idx) => (
                <div
                  key={rung.level}
                  className="rounded-lg border border-gray-200 bg-white p-2.5 dark:border-gray-700 dark:bg-gray-900"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-900 dark:text-gray-100">Level {rung.level}</span>
                    <Badge tone={rung.level >= 3 ? 'red' : 'amber'}>{rung.notify}</Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[11px] text-gray-500">Trigger at:</span>
                    <input
                      type="number"
                      min={0}
                      max={90}
                      value={escalationDays[idx]}
                      onChange={(e) => {
                        const next = [...escalationDays]
                        next[idx] = Math.max(0, Number(e.target.value))
                        setEscalationDays(next)
                      }}
                      className="w-16 rounded border border-gray-300 px-2 py-1 text-xs font-bold tabular-nums text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    />
                    <span className="text-[11px] text-gray-400">days late</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Dynamic Pace Curve Tuning */}
          <div className="border-t border-gray-100 pt-4 dark:border-gray-800">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  3. Dynamic Pace Exponential Knob (γ = {paceGamma.toFixed(1)})
                </h4>
                <p className="text-[11px] text-gray-500">
                  Controls deadline elasticity: higher γ accelerates pressure as the 30 April cutoff approaches.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1.0}
                  max={2.5}
                  step={0.1}
                  value={paceGamma}
                  onChange={(e) => setPaceGamma(Number(e.target.value))}
                  className="w-36 accent-blue-600"
                />
                <span className="w-10 text-right font-mono text-xs font-bold text-blue-600">
                  {paceGamma.toFixed(1)}x
                </span>
              </div>
            </div>

            <div className="mt-3 overflow-x-auto border-t border-gray-100 pt-3 dark:border-gray-800">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-gray-500 text-[10px] uppercase">
                    <th className="py-1">Application Category</th>
                    <th className="py-1">Stage Weight</th>
                    <th className="py-1">Pace Today</th>
                    <th className="py-1">In +30 Days</th>
                    <th className="py-1">In +60 Days</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {paceRows.map((r) => (
                    <tr key={r.code}>
                      <td className="py-1.5 font-medium text-gray-900 dark:text-gray-100">{r.label}</td>
                      <td className="py-1.5 tabular-nums text-gray-500">{r.needed}d</td>
                      <td className="py-1.5">
                        <Badge tone={r.now.band === 'COMPRESSED' ? 'amber' : 'green'}>
                          x{r.now.factor.toFixed(2)} · {r.now.band}
                        </Badge>
                      </td>
                      <td className="py-1.5">
                        <Badge tone={r.in30.band === 'COMPRESSED' ? 'amber' : 'green'}>
                          x{r.in30.factor.toFixed(2)} · {r.in30.band}
                        </Badge>
                      </td>
                      <td className="py-1.5">
                        <Badge
                          tone={
                            r.in60.band === 'INFEASIBLE'
                              ? 'red'
                              : r.in60.band === 'COMPRESSED'
                                ? 'amber'
                                : 'green'
                          }
                        >
                          x{r.in60.factor.toFixed(2)} · {r.in60.band}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Card>

      {/* ROUTING MATRIX */}
      <Card>
        <CardHeader
          title="APH Routing Matrix (Table-2.3)"
          subtitle="Statutory determination of processing committees by application category"
          action={<Badge tone="slate">5 Application Types</Badge>}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-gray-500 dark:border-gray-800 dark:bg-gray-800/40">
                <th className="px-5 py-3 font-semibold">Application Type</th>
                <th className="px-3 py-3 font-semibold">Self-Disclosure</th>
                <th className="px-3 py-3 font-semibold">Scrutiny / Re-Scrutiny</th>
                <th className="px-3 py-3 font-semibold">EVC Inspection</th>
                <th className="px-3 py-3 font-semibold">SAC / SHC Hearing</th>
                <th className="px-5 py-3 font-semibold">Statutory Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {APP_TYPES.map((t) => (
                <tr key={t.code} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20">
                  <td className="px-5 py-3 font-semibold text-gray-900 dark:text-gray-100">{t.label}</td>
                  <td className="px-3 py-3">{t.matrix.selfDisclosure ? yes : no}</td>
                  <td className="px-3 py-3">{t.matrix.scrutiny ? yes : no}</td>
                  <td className="px-3 py-3">{t.matrix.evc ? yes : no}</td>
                  <td className="px-3 py-3">
                    {t.matrix.sacShc === 'AA' ? (
                      <Badge tone="amber" title="As Applicable: Held only if EVC reports shortcomings">
                        AA (As Applicable)
                      </Badge>
                    ) : (
                      no
                    )}
                  </td>
                  <td className="px-5 py-3 font-mono text-[11px] text-gray-500">{t.aphRef}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* SCHEDULES & PACING */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Calendar Anchors */}
        <Card>
          <CardHeader title="Academic Calendar Anchors" subtitle={`Hard dates for AY ${ACADEMIC_YEAR}`} />
          <ul className="divide-y divide-gray-100 text-xs dark:divide-gray-800">
            {ANCHORS.map((a) => (
              <li key={a.code} className="flex items-start justify-between gap-3 px-5 py-3">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{a.label}</p>
                  <p className="text-[11px] text-gray-500">{a.ref}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold tabular-nums text-gray-900 dark:text-gray-100">{fmt(a.date)}</p>
                  <SourceBadge source={a.source} />
                </div>
              </li>
            ))}
            <li className="flex items-start justify-between gap-3 px-5 py-3">
              <div>
                <p className="font-semibold text-gray-900 dark:text-gray-100">Statutory Appeal Window</p>
                <p className="text-[11px] text-gray-500">APH cl. 2.24(a)</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-gray-900 dark:text-gray-100">7 Calendar Days</p>
                <SourceBadge source="REGULATION" />
              </div>
            </li>
          </ul>
        </Card>

        {/* Back-planning live calculation */}
        <Card>
          <CardHeader
            title="Back-Planned Stage Targets"
            subtitle="Calculated backward from 30 April using active configured durations"
            action={
              <select
                className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs dark:border-gray-700 dark:bg-gray-900"
                value={type}
                onChange={(e) => setType(e.target.value as AppTypeCode)}
              >
                {APP_TYPES.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.label}
                  </option>
                ))}
              </select>
            }
          />
          <div className="divide-y divide-gray-100 text-xs dark:divide-gray-800">
            <div className="grid grid-cols-3 gap-2 p-4 text-center">
              <div className="rounded bg-gray-50 p-2 dark:bg-gray-800/40">
                <p className="text-[10px] text-gray-400">Latest Start</p>
                <p className="font-bold text-gray-900 dark:text-gray-100">{fmt(plan.latestStart)}</p>
              </div>
              <div className="rounded bg-gray-50 p-2 dark:bg-gray-800/40">
                <p className="text-[10px] text-gray-400">Total Duration</p>
                <p className="font-bold text-gray-900 dark:text-gray-100">{plan.totalDays} Days</p>
              </div>
              <div className="rounded bg-gray-50 p-2 dark:bg-gray-800/40">
                <p className="text-[10px] text-gray-400">Decision Wall</p>
                <p className="font-bold text-gray-900 dark:text-gray-100">30 Apr 2026</p>
              </div>
            </div>

            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/60 text-[11px] text-gray-500 dark:bg-gray-800/30">
                  <th className="px-5 py-2 font-medium">Stage</th>
                  <th className="px-3 py-2 font-medium">Configured SLA</th>
                  <th className="px-3 py-2 font-medium">Latest Start</th>
                  <th className="px-3 py-2 font-medium">Must Finish By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {plan.stages.map((s) => (
                  <tr key={s.code}>
                    <td className="px-5 py-2 font-medium text-gray-800 dark:text-gray-200">
                      {STAGE_LABEL[s.code as StageCode]}
                    </td>
                    <td className="px-3 py-2 font-bold tabular-nums text-blue-600">{s.days}d</td>
                    <td className="px-3 py-2 text-gray-500">{fmt(s.latestStart)}</td>
                    <td className="px-3 py-2 font-medium text-gray-700 dark:text-gray-300">{fmt(s.latestEnd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* SPECIAL APH POLICIES & ENFORCEMENT */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Live-Lease Gate Rule" subtitle="APH cl. 2.4(e) Multi-Year Evaluation" />
          <div className="space-y-3 px-5 py-4 text-xs">
            <div className="rounded-lg bg-gray-900 p-3 font-mono text-[11px] text-emerald-400">
              liveLeaseYears = (leaseEndDate - evalDate) / 365.25;
              <br />
              blocked = (liveLeaseYears &lt;= maxCourseDurationYears);
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              Unlike a simple document expiration check, AICTE evaluates whether the remaining lease duration covers the full academic tenure of incoming students.
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader title="Cross-Case Dependency Safeguard" subtitle="APH cl. 1.8(i) Closure Priority Rule" />
          <div className="space-y-3 px-5 py-4 text-xs">
            <div className="flex items-center gap-2">
              <Badge tone="red">Closure Application</Badge>
              <ArrowDownRight className="h-4 w-4 text-gray-400" />
              <Badge tone="blue">New Institution</Badge>
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              Where an institution seeks closure of an existing programme and simultaneously establishes a new institution on the same premises, the closure case must be decided first. The new institution workflow is automatically locked.
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}

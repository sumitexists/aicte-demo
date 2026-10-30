import { useMemo, useState } from 'react'
import { ArrowRight, CheckCircle2, Info, Route, ShieldAlert } from 'lucide-react'
import { AppTypeBadge, Badge, Button, Card, CardHeader, SourceBadge, cn } from '@/components/ui/primitives'
import { APP_TYPES, STAGE_LABEL, appTypeDef } from '@/lib/workflow'
import { DECISION_DEADLINE, daysBetween, fmt, leaseGate } from '@/lib/deadlines'
import { useStore } from '@/lib/store'
import type { AppTypeCode } from '@/lib/types'

export default function NewApplication({ onCreated }: { onCreated: (id: string) => void }) {
  const { submitApp, now } = useStore()
  const [institution, setInstitution] = useState('')
  const [region, setRegion] = useState('Western')
  const [type, setType] = useState<AppTypeCode>('NEW_INSTITUTION')
  const [leaseEnd, setLeaseEnd] = useState('2028-03-31')
  const [duration, setDuration] = useState(4)

  const def = appTypeDef(type)

  const preview = useMemo(() => {
    const chain = def.plan
    return chain.map((code, i) => ({ code, n: i + 1 }))
  }, [def])

  const left = daysBetween(now, DECISION_DEADLINE)

  const gate = leaseGate(leaseEnd, duration, now)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!institution.trim()) return
    const ref = submitApp({ institution: institution.trim(), region, type, leaseEnd, maxCourseDurationYears: duration })
    onCreated(ref)
  }

  const input =
    'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100'

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50">New application</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          The route on the right is generated from the type — it is not hardcoded.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Application details" subtitle={`Submission date ${fmt(now)} · AY 2026-27`} />
          <form onSubmit={submit} className="space-y-4 px-5 py-5">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Institution name</label>
              <input
                className={input}
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="e.g. Konkan Institute of Technology, Ratnagiri"
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Region</label>
                <select className={input} value={region} onChange={(e) => setRegion(e.target.value)}>
                  {['Western', 'Southern', 'Northern', 'Eastern', 'Central'].map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Application type</label>
                  <AppTypeBadge type={type} />
                </div>
                <select className={input} value={type} onChange={(e) => setType(e.target.value as AppTypeCode)}>
                  {APP_TYPES.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
              <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
                <ShieldAlert className="h-3.5 w-3.5" /> Land / lease details
                <SourceBadge source="REGULATION" />
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Lease ends on</label>
                  <input type="date" className={input} value={leaseEnd} onChange={(e) => setLeaseEnd(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                    Max course duration (years)
                  </label>
                  <select className={input} value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                    {[2, 3, 4, 5].map((d) => (
                      <option key={d} value={d}>
                        {d} years
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div
                className={cn(
                  'mt-3 rounded-md p-3 text-xs',
                  gate.blocked
                    ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                    : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300',
                )}
              >
                <p className="font-semibold">
                  {gate.blocked ? 'EoA would be blocked' : 'Lease condition satisfied'}
                </p>
                <p className="mt-1 leading-relaxed">
                  Live lease {gate.liveLeaseYears} yr vs maximum course duration {gate.maxCourseDurationYears} yr
                  (APH cl. 2.4(e)).{' '}
                  {gate.blocked
                    ? 'The Council shall not issue EoA from the year the live lease equals the course duration — file a 30-year extension.'
                    : 'Live lease exceeds the longest course duration.'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {left > 0 ? `${left} days left before the 30 April cut-off.` : 'The 30 April cut-off has passed for this cycle.'}
              </p>
              <Button type="submit" variant="primary" disabled={!institution.trim()}>
                Submit application <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </form>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Generated route"
              subtitle={def.aphRef}
              action={<Badge tone="blue">{preview.length - 1} stages</Badge>}
            />
            <div className="px-5 py-4">
              <ol className="relative space-y-3 border-l border-dashed border-gray-300 pl-5 dark:border-gray-700">
                {preview.map(({ code, n }) => (
                  <li key={code} className="relative">
                    <span className="absolute -left-[26px] grid h-4 w-4 place-content-center rounded-full bg-blue-600 text-[9px] font-bold text-white">
                      {n}
                    </span>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{STAGE_LABEL[code]}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      {code === 'SUBMITTED' ? 'Institution submission' : `Actor: ${code.toLowerCase()}`}
                    </p>
                  </li>
                ))}
              </ol>

              <div className="mt-4 space-y-2 border-t border-gray-100 pt-3 dark:border-gray-800">
                {!def.matrix.scrutiny && (
                  <p className="flex items-start gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    No scrutiny and no EVC — accepted on self-disclosure.
                  </p>
                )}
                {!def.matrix.evc && def.matrix.scrutiny && (
                  <p className="flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-400">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    No EVC — documentary scrutiny only.
                  </p>
                )}
                {def.matrix.sacShc === 'AA' && (
                  <p className="flex items-start gap-1.5 text-[11px] text-gray-600 dark:text-gray-400">
                    <Route className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    SHC / SAC is “as applicable” — inserted only if the EVC reports shortcomings or the institution appeals.
                  </p>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="What this approval will create" subtitle="Obligations are born from the approval event" />
            <ul className="space-y-2 px-5 py-4">
              {def.createsObligations.map((o) => (
                <li key={o} className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400">{o.replaceAll('_', ' ').toLowerCase()}</span>
                  <Badge tone="slate">{o === 'LEASE_GATE' ? 'computed' : 'time-bound'}</Badge>
                </li>
              ))}
            </ul>
            <p className="border-t border-gray-100 px-5 py-3 text-[11px] text-gray-500 dark:border-gray-800 dark:text-gray-400">
              Example: appointment of faculty within 180 days of approval, tracked automatically from the day the LoA is
              issued — not remembered by an officer.
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { AppTypeBadge, Badge, Card, Empty, SourceBadge, cn } from '@/components/ui/primitives'
import { useStore, ageDays, currentStage, statusOf } from '@/lib/store'
import { APP_TYPES, STAGE_LABEL } from '@/lib/workflow'
import { deadlineState, fmt } from '@/lib/deadlines'

type StatusOption = 'ALL' | 'OPEN' | 'APPROVED' | 'REJECTED'

export default function Applications({ onOpen }: { onOpen: (id: string) => void }) {
  const { apps: allApps, now, role, institution, config } = useStore()
  const apps = role === 'INSTITUTION' ? allApps.filter((a) => a.institution === institution.name) : allApps
  const [q, setQ] = useState('')
  const [type, setType] = useState('ALL')
  const [region, setRegion] = useState('ALL')
  const [status, setStatus] = useState<StatusOption>('ALL')

  const rows = useMemo(() => {
    return apps
      .filter((a) => (type === 'ALL' ? true : a.type === type))
      .filter((a) => (region === 'ALL' ? true : a.region === region))
      .filter((a) => (status === 'ALL' ? true : statusOf(a) === status))
      .filter((a) =>
        q.trim()
          ? `${a.ref} ${a.institution}`.toLowerCase().includes(q.toLowerCase().trim())
          : true,
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }, [apps, q, type, region, status])

  const select =
    'rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200'

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
            {role === 'INSTITUTION' ? 'My Applications' : 'Applications Master Register'}
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {role === 'INSTITUTION'
              ? `${rows.length} application(s) filed by ${institution.name}`
              : `${rows.length} of ${apps.length} cases · Academic Year 2026-27`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search ref or institution"
              className={cn(select, 'w-56 pl-8')}
            />
          </div>
          <select className={select} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="ALL">All Types</option>
            {APP_TYPES.map((t) => (
              <option key={t.code} value={t.code}>
                {t.label}
              </option>
            ))}
          </select>
          <select className={select} value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="ALL">All Regions</option>
            {['Western', 'Southern', 'Northern', 'Eastern', 'Central'].map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select className={select} value={status} onChange={(e) => setStatus(e.target.value as StatusOption)}>
            <option value="ALL">Any Status</option>
            <option value="OPEN">Open</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </header>

      <Card>
        {rows.length === 0 ? (
          <Empty title="No matching applications" hint="Clear the filters to see all cases." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-[11px] uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400">
                  <th className="px-5 py-3 font-semibold">Application Ref</th>
                  <th className="px-4 py-3 font-semibold">Institution Name & Approval Type</th>
                  <th className="px-3 py-3 font-semibold">Region</th>
                  <th className="px-3 py-3 font-semibold">Current Stage</th>
                  <th className="px-3 py-3 font-semibold">Stage Due</th>
                  <th className="px-3 py-3 font-semibold">Age</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {rows.map((a) => {
                  const st = currentStage(a)
                  const dl = deadlineState(st.dueAt, now, config.escalationRungs)
                  const s = statusOf(a)
                  return (
                    <tr
                      key={a.id}
                      onClick={() => onOpen(a.id)}
                      className="cursor-pointer transition-colors hover:bg-gray-50/80 dark:hover:bg-gray-800/40"
                    >
                      <td className="px-5 py-3 font-mono text-xs font-semibold text-gray-500 dark:text-gray-400">
                        {a.ref}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-gray-900 dark:text-gray-100">{a.institution}</span>
                          {/* HIGHLIGHTED APPROVAL TYPE BADGE */}
                          <AppTypeBadge type={a.type} />
                        </div>
                      </td>
                      <td className="px-3 py-3 text-gray-600 dark:text-gray-400">{a.region}</td>
                      <td className="px-3 py-3 text-gray-700 dark:text-gray-300 font-medium">
                        {STAGE_LABEL[st.code]}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs text-gray-600 dark:text-gray-400">{fmt(st.dueAt)}</span>
                          {s === 'OPEN' && (
                            <span
                              className={cn(
                                'text-[11px] font-semibold',
                                dl.overdue
                                  ? 'text-red-600 dark:text-red-400'
                                  : dl.daysLeft <= 3
                                    ? 'text-amber-600'
                                    : 'text-gray-400',
                              )}
                            >
                              {dl.overdue ? `${Math.abs(dl.daysLeft)}d overdue` : `${dl.daysLeft}d left`}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 tabular-nums text-gray-600 dark:text-gray-400">{ageDays(a, now)}d</td>
                      <td className="px-3 py-3">
                        {s === 'OPEN' && <Badge tone={dl.overdue ? 'red' : 'blue'}>{dl.overdue ? 'Overdue' : 'Open'}</Badge>}
                        {s === 'APPROVED' && <Badge tone="green">Approved</Badge>}
                        {s === 'REJECTED' && <Badge tone="red">Rejected</Badge>}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onOpen(a.id)
                          }}
                          className="rounded-md border border-gray-300 px-2.5 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                        >
                          View details
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

      <p className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        Stage deadlines shown here are <SourceBadge source="ADMIN" /> — dynamically allocated from the 30 April cut-off.
      </p>
    </div>
  )
}

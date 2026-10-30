import { useState } from 'react'
import { Bell, CheckCheck, TriangleAlert, X } from 'lucide-react'
import { AppTypeBadge, Badge, Button, cn } from './primitives'
import { useStore } from '@/lib/store'
import { fmt } from '@/lib/deadlines'
import { roleLabel } from '@/lib/workflow'
import type { RoleCode } from '@/lib/types'

export function InboxPanel({
  onOpenCase,
  onClose,
}: {
  onOpenCase: (id: string) => void
  onClose: () => void
}) {
  const { alerts, markAllRead, role, apps } = useStore()

  return (
    <div className="absolute right-0 top-11 z-40 w-[420px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
        <p className="text-xs font-bold text-gray-800 dark:text-gray-200">Regulatory Alert Inbox</p>
        <div className="flex items-center gap-1">
          <button
            onClick={markAllRead}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <CheckCheck className="h-3 w-3" /> Mark all read
          </button>
          <button onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="max-h-[420px] overflow-y-auto">
        {alerts.length === 0 && (
          <p className="px-4 py-8 text-center text-xs text-gray-500 dark:text-gray-400">
            No active alerts addressed to {roleLabel(role)}.
            <br />
            <span className="text-gray-400">Switch role in the sidebar to review alerts addressed to other desks.</span>
          </p>
        )}
        {alerts.map((n) => {
          const app = apps.find((a) => a.id === n.appId)
          return (
            <button
              key={n.id}
              onClick={() => {
                onOpenCase(n.appId)
                onClose()
              }}
              className={cn(
                'block w-full border-b border-gray-50 px-4 py-3 text-left transition-colors last:border-0 hover:bg-gray-50 dark:border-gray-800/60 dark:hover:bg-gray-800/60',
                !n.read && 'bg-blue-50/50 dark:bg-blue-900/10',
              )}
            >
              <div className="flex items-start gap-2.5">
                <span
                  className={cn(
                    'mt-0.5 grid h-6 w-6 shrink-0 place-content-center rounded-md',
                    n.kind === 'ESCALATION'
                      ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                      : 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
                  )}
                >
                  <TriangleAlert className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  {/* Institution Name alongside Highlighted Approval Type */}
                  {app && (
                    <div className="mb-1 flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-xs font-bold text-gray-900 dark:text-gray-100">
                        {app.institution}
                      </span>
                      <AppTypeBadge type={app.type} />
                    </div>
                  )}

                  <p className="text-xs font-semibold leading-snug text-gray-900 dark:text-gray-100">{n.subject}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">{n.body}</p>
                  <p className="mt-1 flex items-center gap-2 text-[10px] text-gray-400">
                    <span>{fmt(n.ts.slice(0, 10))}</span>
                    {n.level > 0 && <Badge tone="red">Level {n.level}</Badge>}
                    <span>Addressed to {roleLabel(n.to as RoleCode)}</span>
                  </p>
                </div>
                {!n.read && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Small floating window for the dashboard. */
export function AlertMiniWindow({
  onOpenCase,
  onOpenInbox,
}: {
  onOpenCase: (id: string) => void
  onOpenInbox: () => void
}) {
  const { alerts, unread, markAllRead, role, apps } = useStore()
  const [dismissed, setDismissed] = useState(false)

  if (dismissed || unread === 0) return null
  const latest = alerts.filter((n) => !n.read).slice(0, 3)

  return (
    <div className="fixed bottom-5 right-5 z-30 w-[380px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between border-b border-gray-100 bg-amber-50 px-4 py-2.5 dark:border-gray-800 dark:bg-amber-900/20">
        <p className="flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-200">
          <Bell className="h-3.5 w-3.5" /> {unread} new alert{unread > 1 ? 's' : ''} · Desk: {roleLabel(role)}
        </p>
        <button
          onClick={() => setDismissed(true)}
          className="rounded p-0.5 text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/40"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <ul className="divide-y divide-gray-50 dark:divide-gray-800">
        {latest.map((n) => {
          const app = apps.find((a) => a.id === n.appId)
          return (
            <li key={n.id}>
              <button
                onClick={() => onOpenCase(n.appId)}
                className="block w-full px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/60"
              >
                {app && (
                  <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-[11px] font-bold text-gray-900 dark:text-gray-100">
                      {app.institution}
                    </span>
                    <AppTypeBadge type={app.type} />
                  </div>
                )}
                <p className="text-[11px] font-medium leading-snug text-gray-800 dark:text-gray-200">{n.subject}</p>
                <p className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                  {fmt(n.ts.slice(0, 10))} · to {roleLabel(n.to as RoleCode)}
                </p>
              </button>
            </li>
          )
        })}
      </ul>
      <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2 dark:border-gray-800">
        <Button size="sm" variant="ghost" onClick={markAllRead}>
          Dismiss all
        </Button>
        <Button size="sm" variant="primary" onClick={onOpenInbox}>
          Open inbox
        </Button>
      </div>
    </div>
  )
}

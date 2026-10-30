import React from 'react'

export const cn = (...parts: (string | false | undefined | null)[]) => parts.filter(Boolean).join(' ')

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

type Tone = 'gray' | 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'slate'

const TONES: Record<Tone, string> = {
  gray: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  blue: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  red: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  violet: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
}

export function Badge({ tone = 'gray', children, title, className }: { tone?: Tone; children: React.ReactNode; title?: string; className?: string }) {
  return (
    <span
      title={title}
      className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium', TONES[tone], className)}
    >
      {children}
    </span>
  )
}

/** Distinct, prominent badge for application approval type placed alongside institution names */
export function AppTypeBadge({
  type,
  size = 'sm',
  className,
}: {
  type: string
  size?: 'sm' | 'md'
  className?: string
}) {
  const map: Record<string, { label: string; tone: Tone; border: string }> = {
    NEW_INSTITUTION: {
      label: 'New Institution',
      tone: 'blue',
      border: 'border border-blue-300 dark:border-blue-700 font-semibold',
    },
    EOA_SELF_DISCLOSURE: {
      label: 'EoA Self-Disclosure',
      tone: 'green',
      border: 'border border-emerald-300 dark:border-emerald-700 font-semibold',
    },
    INCREASE_INTAKE: {
      label: 'Increase in Intake',
      tone: 'amber',
      border: 'border border-amber-300 dark:border-amber-700 font-semibold',
    },
    NEW_PROGRAMME: {
      label: 'New Programme',
      tone: 'violet',
      border: 'border border-violet-300 dark:border-violet-700 font-semibold',
    },
    CLOSURE: {
      label: 'Closure',
      tone: 'red',
      border: 'border border-red-300 dark:border-red-700 font-semibold',
    },
  }

  const m = map[type] ?? {
    label: type.replaceAll('_', ' '),
    tone: 'gray' as Tone,
    border: 'border border-gray-300',
  }

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 tracking-tight shadow-2xs transition-transform',
        size === 'sm' ? 'text-[10px] leading-3' : 'text-xs leading-4',
        TONES[m.tone],
        m.border,
        className,
      )}
    >
      <span className="mr-1 h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {m.label}
    </span>
  )
}

/** The badge that keeps the prototype honest about where a deadline comes from. */
export function SourceBadge({ source }: { source: 'REGULATION' | 'DERIVED' | 'ADMIN' }) {
  const map = {
    REGULATION: { tone: 'green' as Tone, label: 'REGULATION', title: 'Fixed by the APH / Academic Calendar — a hard date.' },
    DERIVED: { tone: 'blue' as Tone, label: 'DERIVED', title: 'Back-planned from the 30 April cut-off using assumed processing durations.' },
    ADMIN: { tone: 'amber' as Tone, label: 'ADMIN', title: 'Administrative target. The APH does not prescribe per-stage durations.' },
  }
  const m = map[source]
  return (
    <Badge tone={m.tone} title={m.title}>
      {m.label}
    </Badge>
  )
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'warn'
  size?: 'sm' | 'md'
}) {
  const variants = {
    primary: 'bg-[#123b63] text-white hover:bg-[#0d2d4a] border-transparent',
    secondary: 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 dark:border-gray-700',
    ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 border-transparent dark:text-gray-300 dark:hover:bg-gray-800',
    danger: 'bg-red-600 text-white hover:bg-red-700 border-transparent',
    warn: 'bg-amber-500 text-white hover:bg-amber-600 border-transparent',
  }
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-lg border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'blue',
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: React.ReactNode
  hint?: string
  tone?: Tone
}) {
  const iconTone: Record<Tone, string> = {
    gray: 'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
    green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
    red: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400',
    violet: 'bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-400',
    slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  }
  return (
    <Card className="p-5 transition-shadow hover:shadow-md">
      <div className="mb-3 flex items-center justify-between">
        <div className={cn('rounded-lg p-2', iconTone[tone])}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-0.5 text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50">{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
    </Card>
  )
}

export function Progress({ value, tone = 'blue' }: { value: number; tone?: 'blue' | 'amber' | 'red' | 'green' }) {
  const colors = { blue: 'bg-blue-500', amber: 'bg-amber-500', red: 'bg-red-500', green: 'bg-emerald-500' }
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
      <div className={cn('h-full rounded-full transition-all', colors[tone])} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  )
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="px-5 py-12 text-center">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{title}</p>
      {hint && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
    </div>
  )
}

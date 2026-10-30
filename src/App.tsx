import { useEffect, useState } from 'react'
import {
  Bell,
  Building2,
  CalendarCheck2,
  CalendarDays,
  FilePlus2,
  FileSpreadsheet,
  LayoutDashboard,
  Pause,
  Play,
  RotateCcw,
  Rows3,
  Settings2,
  SkipForward,
  Sparkles,
  UserRound,
} from 'lucide-react'
import { Sidebar, type NavItem } from '@/components/ui/dashboard-with-collapsible-sidebar'
import { Badge, Button, cn } from '@/components/ui/primitives'
import { AlertMiniWindow, InboxPanel } from '@/components/ui/inbox'
import { GuidedDemo, type DemoStep } from '@/components/ui/guided-demo'
import { StoreProvider, useStore, currentStage, statusOf } from '@/lib/store'
import { DEMO_END, DEMO_START, daysBetween, fmt } from '@/lib/deadlines'
import { ROLES, roleLabel } from '@/lib/workflow'
import { PEOPLE } from '@/lib/seed'
import Dashboard from '@/pages/Dashboard'
import Applications from '@/pages/Applications'
import EVCScheduling from '@/pages/EVCScheduling'
import Reports from '@/pages/Reports'
import NewApplication from '@/pages/NewApplication'
import CaseDetail from '@/pages/CaseDetail'
import Rules from '@/pages/Rules'
import DemoHub from '@/pages/DemoHub'

type Page = 'dashboard' | 'applications' | 'evc' | 'reports' | 'new' | 'rules' | 'case' | 'demo'

const NAV: NavItem[] = [
  { key: 'dashboard', title: 'Dashboard', Icon: LayoutDashboard },
  { key: 'applications', title: 'Applications', Icon: Rows3 },
  { key: 'evc', title: 'EVC Scheduling', Icon: CalendarCheck2 },
  { key: 'reports', title: 'Reports & Export', Icon: FileSpreadsheet },
  { key: 'new', title: 'New application', Icon: FilePlus2 },
  { key: 'rules', title: 'Rules & config', Icon: Settings2 },
  { key: 'demo', title: 'Compliance & deadlines', Icon: CalendarDays },
]

/** Filing a fresh application is an institution act — nobody else gets the entry point. */
const navFor = (role: string): NavItem[] =>
  role === 'INSTITUTION' ? NAV : NAV.filter((n) => n.key !== 'new')

function Shell() {
  const { now, role, setRole, advance, setNow, reset, apps, unread, institution } = useStore()
  const [page, setPage] = useState<Page>('dashboard')
  const [selected, setSelected] = useState<string | null>(null)
  const [open, setOpen] = useState(true)
  const [isDark, setIsDark] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [inboxOpen, setInboxOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
  }, [isDark])

  useEffect(() => {
    if (!playing) return
    const t = setInterval(() => {
      const left = daysBetween(now, DEMO_END)
      if (left <= 0) {
        setPlaying(false)
        return
      }
      advance(Math.min(7, left))
    }, 700)
    return () => clearInterval(t)
  }, [playing, now, advance])

  const openCase = (id: string) => {
    setSelected(id)
    setPage('case')
  }

  // the filing form belongs to the institution desk only — bounce anyone else
  useEffect(() => {
    if (page === 'new' && role !== 'INSTITUTION') setPage('dashboard')
  }, [page, role])

  const person = PEOPLE[role]
  const identityName = role === 'INSTITUTION' ? institution.name : person.name
  const identitySub = role === 'INSTITUTION' ? `${person.name} · ${person.designation}` : person.designation

  const totalDays = daysBetween(DEMO_START, DEMO_END)
  const elapsed = Math.max(0, Math.min(totalDays, daysBetween(DEMO_START, now)))

  // Unscheduled EVC count
  const pendingEvcCount = apps.filter(
    (a) => a.stages.some((s) => s.code === 'EVC' && s.status === 'active') && !a.evcSchedule,
  ).length
  const roleQueueCount = apps.filter((a) => {
    if (role === 'INSTITUTION') return a.institution === institution.name && statusOf(a) === 'OPEN'
    if (role === 'BUREAU') return statusOf(a) === 'OPEN'
    return statusOf(a) === 'OPEN' && currentStage(a).actorRole === role
  }).length
  const roleEvcCount = role === 'EVC' || role === 'BUREAU' ? pendingEvcCount : 0

  const demoSteps: DemoStep[] = [
    {
      title: '1. One Unified Platform with Congestion Intelligence',
      body: 'You are viewing as the Regulation Bureau. Every figure is dynamically calculated from case state. Notice the new Bottleneck Detection banner identifying stage congestion and active desk workload capacity.',
      apply: () => {
        setRole('BUREAU')
        setNow('2026-02-16')
        setPage('dashboard')
        setSelected(null)
      },
    },
    {
      title: '2. EVC Inspection Queue & Expert Panel Constitution',
      body: 'Switch to the new EVC Scheduling module. The system automatically identifies applications requiring an EVC under APH Table-2.3, tracks unscheduled queues, and allows assigning visit dates, modalities, and a 3-member expert panel.',
      apply: () => {
        setRole('EVC')
        setPage('evc')
        setSelected(null)
      },
    },
    {
      title: '3. Cross-Case Dependency Safeguard (APH cl. 1.8(i))',
      body: 'Open Sahyadri Institute’s New Institution application (AP/2026/1104). Notice the prominent regulatory alert: action is locked because Closure Case AP/2026/5022 on the same campus premises must be approved first.',
      apply: () => {
        setRole('SCRUTINY')
        openCase('AP/2026/1104')
      },
    },
    {
      title: '4. Evidence Submission & Verification Workflow',
      body: 'Look at the Undertakings & Compliance tab. Institutions can submit documentary proof with document reference numbers. Regulatory officers review the evidence on the portal and verify or return with deficiencies.',
      apply: () => {
        openCase('AP/2026/1078')
      },
    },
    {
      title: '5. Lease Validity Tracking & 30-Year Extension Renewal',
      body: 'Open Documents & Lease Validity. The live-lease gate evaluates remaining lease against course duration. Institutions can submit a 30-year registered lease extension deed, instantly clearing the regulatory block.',
      apply: () => {
        openCase('AP/2026/1104')
      },
    },
    {
      title: '6. Fully Configurable Regulatory Rules Engine',
      body: 'Explore the Rules & Configuration page. You can customize stage SLA durations, escalation trigger days, and pace allocation curves, or toggle between Standard, Fast-Track, and Surge presets.',
      apply: () => {
        setRole('BUREAU')
        setPage('rules')
        setSelected(null)
      },
    },
    {
      title: '7. Consolidated Audit & MIS Reports with CSV Export',
      body: 'Open the new Reports page. Comprehensive registers for Pendency, EVC Inspections, Undertakings, and Overdue Cases. Every report features one-click CSV download and print capabilities.',
      apply: () => {
        setPage('reports')
        setSelected(null)
      },
    },
    {
      title: '8. Advance to the 30 April Decision Wall',
      body: 'Scrub the clock forward to 30 April. Watch overdue cases climb the 4-level escalation ladder to the Council, and see live notifications alert each designated official desk.',
      apply: () => {
        setRole('BUREAU')
        setNow('2026-04-30')
        setPage('dashboard')
        setSelected(null)
      },
    },
  ]

  return (
    <div className="flex min-h-screen w-full bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <Sidebar
        open={open}
        items={navFor(role).map((n) => {
          if (n.key === 'dashboard' && unread > 0) return { ...n, badge: unread }
          if (n.key === 'applications' && roleQueueCount > 0) return { ...n, badge: roleQueueCount }
          if (n.key === 'evc' && roleEvcCount > 0) return { ...n, badge: roleEvcCount }
          return n
        })}
        selected={page === 'case' ? 'applications' : page}
        onSelect={(k) => {
          setPage(k as Page)
          setSelected(null)
        }}
        isDark={isDark}
        onToggleDark={() => setIsDark((d) => !d)}
        onToggleOpen={() => setOpen((o) => !o)}
        roleSlot={
          open ? (
            <div className="mb-4 rounded-lg border border-gray-200 p-2.5 dark:border-gray-800">
              <p className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <UserRound className="h-3 w-3" /> Signed in as
              </p>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as typeof role)}
                className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs font-medium text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              >
                {ROLES.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.label}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-[10px] leading-snug text-gray-500 dark:text-gray-400">
                {ROLES.find((r) => r.code === role)?.scope}
              </p>
            </div>
          ) : (
            <div className="mb-4 grid place-content-center rounded-lg border border-gray-200 py-2 dark:border-gray-800">
              <UserRound className="h-4 w-4 text-gray-500" />
            </div>
          )
        }
      />

      <main className="min-w-0 flex-1">
        <div className="sticky top-0 z-20 border-b-2 border-[#e99424] bg-white/90 backdrop-blur dark:border-gray-800 dark:bg-gray-900/90">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
            <div className="flex items-center gap-3">
              <img src="/aicte-logo.png" alt="AICTE logo" className="h-9 w-12 object-contain" />
              <div className="mr-2 hidden leading-tight sm:block"><p className="text-xs font-bold text-[#123b63]">AICTE</p><p className="text-[9px] text-gray-500">All India Council for Technical Education</p></div>
              <Badge tone="blue">AY 2026-27</Badge>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {role === 'INSTITUTION' ? 'Institution portal' : `Viewing as ${roleLabel(role)}`}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 dark:border-gray-700 dark:bg-gray-900">
                <CalendarDays className="h-3.5 w-3.5 text-gray-500" />
                <span className="text-xs font-semibold tabular-nums text-gray-800 dark:text-gray-100">{fmt(now)}</span>
                <div className="mx-1 h-4 w-px bg-gray-200 dark:bg-gray-700" />
                <button
                  title="Play the season (1 week per tick)"
                  onClick={() => setPlaying((p) => !p)}
                  className={cn(
                    'grid h-6 w-6 place-content-center rounded-md transition-colors',
                    playing ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800',
                  )}
                >
                  {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                </button>
                <button
                  title="Advance 7 days"
                  onClick={() => advance(7)}
                  className="grid h-6 w-6 place-content-center rounded-md text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <SkipForward className="h-3 w-3" />
                </button>
                <button
                  title="Reset demo"
                  onClick={() => {
                    setPlaying(false)
                    reset()
                    setPage('dashboard')
                    setSelected(null)
                  }}
                  className="grid h-6 w-6 place-content-center rounded-md text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
              </div>

              <Button variant="secondary" size="sm" onClick={() => setGuideOpen(true)}>
                <Sparkles className="h-3.5 w-3.5" /> Guide
              </Button>

              <div className="relative">
                <Button variant="secondary" size="sm" className="relative" onClick={() => setInboxOpen((o) => !o)}>
                  <Bell className="h-3.5 w-3.5" />
                  {unread > 0 && (
                    <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-content-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </Button>
                {inboxOpen && <InboxPanel onOpenCase={openCase} onClose={() => setInboxOpen(false)} />}
              </div>

              {/* signed-in identity */}
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 dark:border-gray-700 dark:bg-gray-900">
                <span
                  className={cn(
                    'grid h-7 w-7 place-content-center rounded-full text-[11px] font-bold text-white',
                    role === 'INSTITUTION' ? 'bg-emerald-600' : 'bg-blue-600',
                  )}
                >
                  {identityName.slice(0, 1)}
                </span>
                <div className="max-w-[190px]">
                  <p className="truncate text-[11px] font-semibold leading-tight text-gray-900 dark:text-gray-100">
                    {identityName}
                  </p>
                  <p className="truncate text-[10px] leading-tight text-gray-500 dark:text-gray-400">{identitySub}</p>
                </div>
                {role === 'INSTITUTION' ? (
                  <Building2 className="h-3.5 w-3.5 text-gray-400" />
                ) : (
                  <UserRound className="h-3.5 w-3.5 text-gray-400" />
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 px-6 pb-2">
            <span className="text-[10px] text-gray-400">{fmt(DEMO_START)}</span>
            <input
              type="range"
              min={0}
              max={totalDays}
              value={elapsed}
              onChange={(e) => {
                setPlaying(false)
                const d = new Date(`${DEMO_START}T00:00:00Z`)
                d.setUTCDate(d.getUTCDate() + Number(e.target.value))
                setNow(d.toISOString().slice(0, 10))
              }}
              className="h-1 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-blue-600 dark:bg-gray-800"
            />
            <span className="text-[10px] text-gray-400">{fmt(DEMO_END)}</span>
          </div>
        </div>

        <div className="p-6">
          {page === 'dashboard' && (
            <Dashboard
              onOpen={openCase}
              onOpenInbox={() => setInboxOpen(true)}
              onNewApplication={() => setPage('new')}
            />
          )}
          {page === 'applications' && <Applications onOpen={openCase} />}
          {page === 'evc' && <EVCScheduling onOpenCase={openCase} />}
          {page === 'reports' && <Reports onOpenCase={openCase} />}
          {page === 'new' && <NewApplication onCreated={(id) => openCase(id)} />}
          {page === 'rules' && <Rules />}
          {page === 'demo' && <DemoHub onOpenCase={openCase} />}
          {page === 'case' && selected && <CaseDetail id={selected} onBack={() => setPage('applications')} />}
        </div>

        {page === 'dashboard' && (
          <AlertMiniWindow onOpenCase={openCase} onOpenInbox={() => setInboxOpen(true)} />
        )}

        {guideOpen && <GuidedDemo steps={demoSteps} onExit={() => setGuideOpen(false)} />}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}

import { useMemo } from 'react'
import { Badge, Card, CardHeader, Button } from '@/components/ui/primitives'
import { useStore, currentStage, isOverdue } from '@/lib/store'
import { STAGE_LABEL, appTypeDef, roleLabel } from '@/lib/workflow'
import { daysBetween, fmt } from '@/lib/deadlines'

export default function DemoHub({ onOpenCase }: { onOpenCase: (id: string) => void }) {
  const { apps: all, role, institution, now, config, uploadSupportingDocument } = useStore()
  const apps = role === 'INSTITUTION' ? all.filter(a => a.institution === institution.name) : all
  const items = useMemo(() => apps.flatMap(a => {
    const documentStatus = (title: string, fallback: string) => a.leaseDocuments?.find(d => d.title === title)?.status ?? fallback
    return [
    ...a.obligations.map(o => ({ app: a, title: o.label, due: o.dueAt, status: o.status })),
    ...(a.lease ? [{ app: a, title: 'Lease agreement renewal', due: a.lease.endDate, status: 'document' }] : []),
    { app: a, title: 'Faculty & Principal appointment records', due: a.lease ? a.lease.endDate : a.createdAt, status: documentStatus('Faculty & Principal appointment records', a.deficiencies.length ? 'review required' : 'expiring soon') },
    { app: a, title: 'Infrastructure & laboratory readiness certificate', due: a.lease ? a.lease.endDate : a.createdAt, status: documentStatus('Infrastructure & laboratory readiness certificate', a.type === 'NEW_PROGRAMME' ? 'expiring soon' : 'review required') },
    ...(a.evcSchedule ? [{ app: a, title: 'EVC inspection', due: a.evcSchedule.scheduledDate, status: a.evcSchedule.status }] : []),
  ]}).sort((a,b) => a.due.localeCompare(b.due)), [apps])
  const rescue = apps.filter(a => !a.decision && isOverdue(a, now, config.escalationRungs))
  const passportStats = { verified: items.filter(x => String(x.status).toLowerCase().includes('verified')).length, attention: items.filter(x => daysBetween(now, x.due) <= 90 && !String(x.status).toLowerCase().includes('verified')).length }
  return <div className="space-y-6">
    <header><h1 className="text-2xl font-bold text-[#123b63]">Compliance Passport & Deadline Control</h1><p className="text-sm text-gray-500">Institution obligations, document validity, case routing and deadline risks · {fmt(now)}</p></header>
    <div className="grid gap-4 sm:grid-cols-3"><Card className="border-[#c9ddea] p-4"><p className="text-xs text-gray-500">Verified requirements</p><p className="text-2xl font-bold text-[#123b63]">{passportStats.verified}</p></Card><Card className="border-amber-200 p-4"><p className="text-xs text-gray-500">Due within 90 days</p><p className="text-2xl font-bold text-amber-700">{passportStats.attention}</p></Card><Card className="border-red-200 p-4"><p className="text-xs text-gray-500">Cases in rescue queue</p><p className="text-2xl font-bold text-red-700">{rescue.length}</p></Card></div>
    <Card><CardHeader title="Deadline Rescue Queue" subtitle={`${rescue.length} open cases need attention now`} />
      <div className="divide-y">{rescue.slice(0,8).map(a => { const st=currentStage(a); return <div key={a.id} className="flex items-center justify-between gap-4 p-4"><div><b>{a.institution}</b><p className="text-xs text-gray-500">{a.ref} · {STAGE_LABEL[st.code]} · {Math.abs(daysBetween(st.dueAt,now))} days overdue · owner {roleLabel(st.actorRole)}</p></div><Button size="sm" variant="secondary" onClick={()=>onOpenCase(a.id)}>Open case</Button></div>})}</div>
    </Card>
    <Card><CardHeader title="Institution Compliance Passport" subtitle="Live demo register of undertakings, evidence and validity dates" />
      <div className="overflow-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b text-gray-500"><th className="p-3">Institution / case</th><th>Requirement</th><th>Due / expiry</th><th>Status</th><th></th></tr></thead><tbody>{items.map((x,i)=>{ const renewable = x.title === 'Faculty & Principal appointment records' || x.title === 'Infrastructure & laboratory readiness certificate'; return <tr className="border-b" key={`${x.app.id}-${i}`}><td className="p-3">{x.app.institution}<div className="text-gray-400">{x.app.ref}</div></td><td>{x.title}</td><td>{fmt(x.due)}<div className="text-gray-400">{daysBetween(now,x.due)} days</div></td><td><Badge tone={x.status==='verified'||x.status==='VERIFIED'?'green':daysBetween(now,x.due)<0?'red':'amber'}>{String(x.status).replaceAll('_',' ')}</Badge></td><td className="space-x-2">{role === 'INSTITUTION' && renewable && !['VERIFIED','verified'].includes(String(x.status)) && <button className="text-[#123b63]" onClick={()=>uploadSupportingDocument(x.app.id, x.title, `AICTE/REN/${x.app.ref.split('/').pop()}/${i}`)}>Submit renewal</button>}<button className="text-blue-700" onClick={()=>onOpenCase(x.app.id)}>Review</button></td></tr>})}</tbody></table></div>
    </Card>
    <Card><CardHeader title="Explainable APH Routing" subtitle="Why the current stage and what comes next" />
      <div className="grid gap-3 p-4 md:grid-cols-2">{apps.slice(0,8).map(a=>{const st=currentStage(a), def=appTypeDef(a.type);const idx=def.plan.indexOf(st.code);return <div key={a.id} className="rounded-lg border p-3"><p className="font-semibold">{a.ref} · {a.institution}</p><p className="mt-1 text-xs text-gray-600">{def.label}: {def.plan.map(s=>STAGE_LABEL[s]).join(' → ')}</p><p className="mt-1 text-xs">Now: <b>{STAGE_LABEL[st.code]}</b> · owner {roleLabel(st.actorRole)} · next {def.plan[idx+1]?STAGE_LABEL[def.plan[idx+1]]:'decision/closure'}</p><p className="text-[11px] text-gray-400">Basis: {def.aphRef} · EVC {def.matrix.evc?'required':'not required'}</p></div>})}</div>
    </Card>
    <Card><CardHeader title="Upcoming Calendar" subtitle="EVC, compliance and document validity deadlines" />{items.slice(0,12).map((x,i)=><div className="flex justify-between border-b p-3 text-xs" key={i}><span>{x.app.institution} · {x.title}</span><span className="font-medium">{fmt(x.due)}</span></div>)}</Card>
  </div>
}

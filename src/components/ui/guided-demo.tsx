import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Sparkles, X } from 'lucide-react'
import { Button, cn } from './primitives'

export interface DemoStep {
  title: string
  body: string
  /** called when the step becomes active — drives role, page or clock */
  apply?: () => void
}

export function GuidedDemo({ steps, onExit }: { steps: DemoStep[]; onExit: () => void }) {
  const [i, setI] = useState(0)

  useEffect(() => {
    steps[i]?.apply?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i])

  const step = steps[i]
  const last = i === steps.length - 1

  const next = () => (last ? onExit() : setI(i + 1))
  const prev = () => (i === 0 ? onExit() : setI(i - 1))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'Escape') onExit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-4">
      <div className="pointer-events-auto w-full max-w-2xl overflow-hidden rounded-xl border border-blue-200 bg-white shadow-2xl dark:border-blue-900 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-100 bg-blue-50 px-4 py-2 dark:border-gray-800 dark:bg-blue-900/20">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-blue-800 dark:text-blue-300">
            <Sparkles className="h-3.5 w-3.5" /> Guided demo · step {i + 1} of {steps.length}
          </p>
          <button onClick={onExit} className="rounded p-0.5 text-blue-700 hover:bg-blue-100 dark:text-blue-300 dark:hover:bg-blue-900/40">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="px-5 py-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">{step.title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-400">{step.body}</p>
        </div>
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2.5 dark:border-gray-800">
          <div className="flex items-center gap-1">
            {steps.map((_, n) => (
              <span
                key={n}
                className={cn('h-1.5 rounded-full transition-all', n === i ? 'w-5 bg-blue-600' : 'w-1.5 bg-gray-300 dark:bg-gray-700')}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={prev}>
              <ArrowLeft className="h-3 w-3" /> Back
            </Button>
            <Button size="sm" variant="primary" onClick={next}>
              {last ? 'Finish' : 'Next'} <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

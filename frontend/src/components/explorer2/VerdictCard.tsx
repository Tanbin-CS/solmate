import { AlertTriangle, CheckCircle2, CircleSlash, Compass, Wrench } from 'lucide-react'
import type { Verdict } from '@/science/v2/verdict'

function Section({ icon, title, tone, children }: { icon: React.ReactNode; title: string; tone: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className={`mb-1.5 flex items-center gap-1.5 text-[12px] font-medium ${tone}`}>
        {icon}
        {title}
      </h3>
      <ul className="space-y-1 text-[12.5px] leading-relaxed text-slate-300">{children}</ul>
    </section>
  )
}

/** Where the analogy holds, where it differs, where Earth cannot follow, and what the place is good for. */
export function VerdictCard({ verdict }: { verdict: Verdict }) {
  const always = verdict.breaks_down.filter((b) => b.kind === 'always')
  const other = verdict.breaks_down.filter((b) => b.kind !== 'always')
  return (
    <div className="space-y-4">
      {verdict.matches.length > 0 && (
        <Section icon={<CheckCircle2 className="size-3.5" />} title="Matches" tone="text-positive">
          {verdict.matches.map((m) => (
            <li key={m.id}>{m.text}</li>
          ))}
        </Section>
      )}
      {verdict.differs.length > 0 && (
        <Section icon={<CircleSlash className="size-3.5" />} title="Differs" tone="text-negative">
          {verdict.differs.map((d) => (
            <li key={d.id}>{d.text}</li>
          ))}
        </Section>
      )}
      <Section icon={<AlertTriangle className="size-3.5" />} title="Where the analogy breaks down" tone="text-derived">
        {[...other, ...always].map((b) => (
          <li key={b.id}>{b.text}</li>
        ))}
      </Section>
      {verdict.process_tags.length > 0 && (
        <Section icon={<Compass className="size-3.5" />} title="Processes it can teach" tone="text-data">
          {verdict.process_tags.map((t) => (
            <li key={t.id}>
              <span className="text-slate-100">{t.name}:</span> {t.analog}.{' '}
              <span className="font-mono text-[10.5px] text-slate-400">
                {Object.entries(t.evidence)
                  .map(([k, v]) => `${k} ${v}`)
                  .join(' · ')}
              </span>
            </li>
          ))}
        </Section>
      )}
      {verdict.use_it_for.length > 0 && (
        <Section icon={<Wrench className="size-3.5" />} title="Use it for" tone="text-slate-100">
          {verdict.use_it_for.map((u) => (
            <li key={u.id}>{u.text}</li>
          ))}
        </Section>
      )}
    </div>
  )
}

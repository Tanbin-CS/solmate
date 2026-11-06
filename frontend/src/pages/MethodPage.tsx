import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { ErrorState, PanelSkeleton } from '@/components/common/States'
import { Button } from '@/components/ui/button'
import { fadeUp } from '@/design/motion'
import { useHomeData, type HomeData } from '@/hooks/useHomeData'
import { DIMENSION_CARDS } from '@/components/home/dimensions'
import { BODY } from '@/components/explorer/roles'
import { siteName } from '@/components/explorer2/labels'
import { DIMENSION_NAMES, INDICATOR_LABELS } from '@/science/v2/verdict'
import type { TargetValidation } from '@/science/v2/validation'
import { cn } from '@/lib/utils'
import facts from '@/data/site_facts.json'

export default function MethodPage() {
  const state = useHomeData()
  return (
    <>
      <PageHeader
        title="How SolMate finds Earth analogs."
        lead={`Eleven NASA targets, ${facts.nasa_layers} NASA data layers over every land cell on Earth, seven characteristics combined into one index you can take apart, and a validation test written down before the results were seen.`}
      />
      {state.status === 'loading' && (
        <div className="mx-auto w-full max-w-4xl px-6">
          <PanelSkeleton />
        </div>
      )}
      {state.status === 'error' && <ErrorState title="Results could not be loaded." detail={state.error.message} />}
      {state.status === 'ready' && <MethodBody data={state.data} />}
    </>
  )
}

function Block({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  const reduced = useReducedMotion()
  return (
    <motion.section
      id={id}
      variants={fadeUp(reduced)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-10% 0px' }}
      className="scroll-mt-24 border-t border-border py-14"
    >
      <h2 className="text-balance text-2xl font-semibold tracking-tight md:text-3xl">{title}</h2>
      <div className="mt-6 space-y-5 text-[15px] leading-relaxed text-slate-300 [&>ol]:max-w-[62ch] [&>p]:max-w-[62ch] [&>ul]:max-w-[62ch] [&_li]:text-pretty [&>p]:text-pretty">{children}</div>
    </motion.section>
  )
}

function Stat({ label, value, note, tone = 'text-slate-100' }: { label: string; value: string; note?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-sm text-slate-300">{label}</p>
      <p className={`mt-2 font-mono text-3xl tabular ${tone}`}>{value}</p>
      {note && <p className="mt-1.5 text-xs text-slate-400">{note}</p>}
    </div>
  )
}

const TH = 'px-4 py-3 font-mono text-[11px] font-normal uppercase tracking-wider text-slate-400'

function MethodBody({ data }: { data: HomeData }) {
  const { hash } = useLocation()
  useEffect(() => {
    // content renders after data loads, so honour #anchors once it exists
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' })
  }, [hash])
  const v = data.validation
  const moon = data.targets.filter((t) => t.body === 'moon')
  const mars = data.targets.filter((t) => t.body === 'mars')
  const jez = v.targets.jezero_crater!
  const arc = v.targets.arcadia_planitia!
  const [shown, setShown] = useState('jezero_crater')
  const sel = v.targets[shown]!
  const reg = v.addendum_1
  const known = data.model.known_analogs

  return (
    <div className="mx-auto w-full max-w-4xl px-6 pb-24">
      <Block title="Seven characteristics, not a claim of sameness.">
        <p>
          The question is narrow: which places on Earth come closest to a candidate Moon landing region or a Mars site in the conditions a crew, a rover or an instrument would meet there?
          No place on Earth matches another world in everything, so each characteristic is scored on its own, and the index says how many of them line up at once.
        </p>
        <p>
          What Earth cannot reproduce (gravity, near-vacuum, radiation without a magnetic field) is never scored. It is stated with every result under{' '}
          <em>where the analogy breaks down</em>.
        </p>
      </Block>

      <Block title="Targets from NASA, Earth from NASA data.">
        <ul className="list-disc space-y-2 pl-5 marker:text-slate-400">
          <li>
            <strong className="text-slate-100">Moon:</strong> all {moon.length} candidate landing regions near the lunar south pole that NASA named on 28 October 2024 (announced for Artemis III; NASA now plans the first crewed landing for Artemis IV), located at the centroid of the
            published candidate landing sites (Wueller et al. 2026). Terrain from LRO LOLA, temperatures from LRO Diviner.
          </li>
          <li>
            <strong className="text-slate-100">Mars:</strong> {mars.map((t) => t.name).join(' and ')}. Jezero is where Perseverance landed; Arcadia is NASA’s leading
            ice target for a human base (SWIM). Terrain from MOLA and CTX; climate from Mars 2020 MEDA and cited studies.
          </li>
          <li>
            <strong className="text-slate-100">Earth:</strong> {facts.nasa_layers} NASA layers resampled to a 0.1° grid (about 11 km), every land cell from 83° N to 83° S, about 1.9 million cells.
            Each target value is either computed from NASA data or cited from the literature with its DOI.
          </li>
        </ul>
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-ink-850">
              <tr>
                <th className={TH}>Characteristic</th>
                <th className={TH}>Earth indicators</th>
                <th className={cn(TH, 'hidden md:table-cell')}>NASA data</th>
              </tr>
            </thead>
            <tbody>
              {DIMENSION_CARDS.map((d) => {
                const dim = data.model.dimensions[d.id]
                return (
                  <tr key={d.id} className="border-t border-border align-top">
                    <td className="px-4 py-3 text-slate-100">
                      {DIMENSION_NAMES[d.id]}
                      {dim && dim.applies_to.length < 2 && <span className="block text-xs text-slate-400">{dim.applies_to.includes('mars') ? 'Mars only' : 'Moon only'}</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {Object.keys(dim?.indicators ?? {})
                        .map((k) => dim?.indicators[k]?.label ?? INDICATOR_LABELS[k] ?? k)
                        .join(', ')}
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-slate-400 md:table-cell">{d.sources}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <Link to="/provenance" className="inline-flex items-center gap-1.5 font-mono text-xs text-data hover:underline">
          Data sources and licences <ArrowRight className="size-3" />
        </Link>
      </Block>

      <Block title="A score you can take apart.">
        <ol className="list-decimal space-y-2 pl-5 marker:font-mono marker:text-slate-400">
          <li>
            <strong className="text-slate-100">Match</strong> when the target’s value lies inside Earth’s range (between the 1st and 99th percentile of land cells): similarity falls
            off with the distance from the target, in units of Earth’s spread σ.
          </li>
          <li>
            <strong className="text-slate-100">Toward</strong> when no place on Earth gets there, such as the cold of the lunar south pole or the dryness of Mars: similarity is
            the share of Earth’s land the place beats in the target’s direction.
          </li>
          <li>Each characteristic is the weighted mean of its indicators; the SolMate Analog Index (0–100) is the weighted mean of the characteristics.</li>
        </ol>
        <div className="rounded-xl border border-border bg-ink-850 p-5 font-mono text-sm text-slate-200">
          <p>
            match: s = exp( −½ · ((x − t) / σ)² ) · toward: s = ECDF<sub>Earth</sub>(x) in the target’s direction
          </p>
          <p className="mt-2">
            SAI = 100 · Σ W<sub>k</sub> D<sub>k</sub> / Σ W<sub>k</sub> over the characteristics with data
          </p>
        </div>
        <p>
          Earth statistics come from all land cells, weighted by area, so a score means the same anywhere. The browser and the Python pipeline run the same rules; automated tests
          check 153 real places against all eleven targets and require identical results, wording included.
        </p>
      </Block>

      <Block id="terrain-check" title="Screen everything, then look closer.">
        <ul className="list-disc space-y-2 pl-5 marker:text-slate-400">
          <li>Every land cell is scored for every target. The best are kept at least 50 km apart, so one plateau cannot fill the list.</li>
          <li>
            Cells more than {known.novelty_km} km from all {known.sites.length} known analog sites (NASA field sites, the Atacama, Antarctica, Iceland, Hawaii, Devon Island and
            others) are listed as <strong className="text-slate-100">novel leads</strong>.
          </li>
          <li>
            The top cells and leads also get a <strong className="text-slate-100">100 m terrain check from NASA ASTER GDEM v3</strong>: median slope, steep-slope tail and
            hypsometry in a 20 km window, judged against 500 random land windows. It is shown next to the index, not inside it. On the validation sites, terrain alone at
            1 km told Moon analog sites from controls (AUC 0.70 to 0.75); the 100 m check did not (0.33 to 0.57). One likely reason: ASTER GDEM measures the tops of trees and
            buildings, so forests look rugged. Any other place can be checked the same way in the Explorer.
          </li>
        </ul>
      </Block>

      <Block title="Where the analogy breaks down, and what a place is good for.">
        <ul className="list-disc space-y-2 pl-5 marker:text-slate-400">
          <li>Gravity, surface pressure and radiation dose are always shown as ratios to Earth.</li>
          <li>
            For Moon targets, sunlight is always compared: near the south pole the Sun never rises more than a few degrees, while the place on Earth gets its own midsummer
            noon Sun (from its latitude).
          </li>
          <li>Every result states that caves, lava tubes and other underground environments are not assessed: satellite data see only the surface.</li>
          <li>Any characteristic below 0.4 is listed as different; where the target lies beyond anything on Earth, the result says how far of the way the place gets.</li>
          <li>More than 30% vegetation is flagged: biology has no lunar or Martian counterpart, and canopy inflates terrain roughness.</li>
          <li>
            Biology and habitability are described for every place, never scored: how dry it is, how bare, how thin the air and how long the ground stays frozen, and what
            that means for testing life-detection instruments. They stay out of the score for four reasons:
            <ul className="mt-2 list-[circle] space-y-1.5 pl-5">
              <li>The notes come from data already in the score (dryness, bare ground, temperature, frost days). Scoring them again would count the same data twice.</li>
              <li>
                A score measures how close a place is to a known value at the target. The Moon has no life. Mars&rsquo;s ancient lakes show it was once habitable, but whether
                life ever existed there is the open question, so there is no value to match.
              </li>
              <li>
                NASA&rsquo;s global land cover maps plants, and the score already uses it. Microbial life and biosignatures are known only from field studies of a few sites;
                scoring them would favour famous analogs over new ones.
              </li>
              <li>The validation test was fixed before the results were seen. A new scored part added now would change the method after the outcome is known.</li>
            </ul>
          </li>
          <li>
            Fixed, published rules add the Earth processes a place can teach (dust, salt flats, volcanic rock, frozen ground, rugged highlands) and what it could be used for:
            rover trials, landing-pad tests, thermal cycling, ice drilling, dust mitigation, life-detection instruments.
          </li>
        </ul>
      </Block>

      <Block id="validation" title="Does it find the sites NASA already uses?">
        <p>
          The test was written down before the results were seen (<span className="font-mono text-sm">docs/VALIDATION.md</span>): sites NASA and its partners have already used as
          analogs should score above controls, farmland, rainforest, cities and glaciers. AUC is the chance that a random analog site outscores a random control; 0.5 is chance.
          Every target is reported, with its 95% bootstrap confidence interval.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Jezero Crater" value={jez.auc_equal.toFixed(2)} note={`95% CI ${jez.auc_ci95[0].toFixed(2)}–${jez.auc_ci95[1].toFixed(2)} · ${jez.n_positives} analogs vs ${jez.n_controls} controls`} tone="text-positive" />
          <Stat label="Lunar regions, median" value={v.summary.moon!.auc_median.toFixed(2)} note={`${moon.length} regions · ${v.targets[moon[0]!.id]!.n_positives} analogs each, so intervals are wide`} />
          <Stat label="Arcadia Planitia" value={arc.auc_equal.toFixed(2)} note={`95% CI ${arc.auc_ci95[0].toFixed(2)}–${arc.auc_ci95[1].toFixed(2)} · not better than chance`} tone="text-negative" />
        </div>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-ink-850">
              <tr>
                <th className={TH}>Target</th>
                <th className={cn(TH, 'text-right')}>AUC</th>
                <th className={cn(TH, 'text-right')}>95% CI</th>
                {reg && <th className={cn(TH, 'text-right')}>Each region once</th>}
                {reg && <th className={cn(TH, 'text-right')}>95% CI by region</th>}
                <th className={cn(TH, 'hidden text-right md:table-cell')}>Analogs’ land percentile</th>
              </tr>
            </thead>
            <tbody>
              {data.targets.map((t) => {
                const r = v.targets[t.id]!
                return (
                  <tr key={t.id} className="border-t border-border">
                    <td className="px-4 py-2.5 text-slate-200">
                      <span className="mr-2 inline-block size-1.5 rounded-full align-middle" style={{ background: BODY[t.body].color }} aria-hidden="true" />
                      {t.name}
                    </td>
                    <td className={cn('px-4 py-2.5 text-right font-mono tabular', r.auc_equal < 0.65 ? 'text-negative' : 'text-slate-100')}>{r.auc_equal.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular text-slate-400">
                      {r.auc_ci95[0].toFixed(2)}–{r.auc_ci95[1].toFixed(2)}
                    </td>
                    {reg && (
                      <td className={cn('px-4 py-2.5 text-right font-mono tabular', reg.targets[t.id]!.equal.auc_region_weighted < 0.65 ? 'text-negative' : 'text-slate-100')}>
                        {reg.targets[t.id]!.equal.auc_region_weighted.toFixed(2)}
                      </td>
                    )}
                    {reg && (
                      <td className="px-4 py-2.5 text-right font-mono tabular text-slate-400">
                        {reg.targets[t.id]!.equal.auc_ci95_regions[0].toFixed(2)}–{reg.targets[t.id]!.equal.auc_ci95_regions[1].toFixed(2)}
                      </td>
                    )}
                    <td className="hidden px-4 py-2.5 text-right font-mono tabular text-slate-300 md:table-cell">{Math.round(r.positives_median_land_percentile)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <ScoreStrip validation={sel} targets={data.targets} shown={shown} onShow={setShown} />

        <p className="font-medium text-slate-100">What the results do and do not show</p>
        <ul className="list-disc space-y-2 pl-5 marker:text-slate-400">
          <li>
            <strong className="text-slate-100">Jezero works.</strong> Its {jez.n_positives} analog sites sit at the {Math.round(jez.positives_median_land_percentile)}th percentile of
            all land, and the AUC stays between {jez.random_weights_auc_p5_p50_p95[0].toFixed(2)} and {jez.random_weights_auc_p5_p50_p95[2].toFixed(2)} under 90% of random
            weightings.
          </li>
          <li>
            <strong className="text-slate-100">The Moon is a looser test.</strong> Each Moon target is checked against only {v.targets[moon[0]!.id]!.n_positives} analog sites, so the intervals reach
            down to about 0.5. Those sites were chosen mainly for terrain and operations, while the score also weighs climate, temperature and ice.
          </li>
          <li>
            <strong className="text-slate-100">Arcadia is weak, and stays in.</strong> Buried ice plains have few documented Earth analogs, and Earth’s ice signals (frost days,
            snow months) are coarse. It is NASA’s leading human-base target, so it is reported rather than hidden.
          </li>
          {reg ? (
            <>
              <li>
                <strong className="text-slate-100">Nearby sites flatter the AUC a little, not much.</strong> After mentor review, sites within {reg.region_km} km of each other were
                grouped into regions, a rule written down before the check was run. Counting each region once, Jezero scores{' '}
                {reg.targets.jezero_crater!.equal.auc_region_weighted.toFixed(2)} ({reg.targets.jezero_crater!.equal.auc_ci95_regions[0].toFixed(2)}–
                {reg.targets.jezero_crater!.equal.auc_ci95_regions[1].toFixed(2)} when whole regions are resampled), the Moon regions a median of{' '}
                {reg.summary.moon.equal.auc_region_weighted_median.toFixed(2)}, and Arcadia {reg.targets.arcadia_planitia!.equal.auc_region_weighted.toFixed(2)}. Learned weights
                tested on regions they never saw reach {reg.targets.jezero_crater!.learned_loro_auc.toFixed(2)} for Jezero.
              </li>
              <li>
                <strong className="text-slate-100">Terrain-first Moon weights were tested, and not adopted.</strong> The mentor suggested weighting terrain and operations
                more for the Moon. These Lunar ops weights help the rugged massifs (Malapert Massif {reg.targets.malapert_massif!.lunar_ops!.auc.toFixed(2)}, Peak near Cabeus B{' '}
                {reg.targets.peak_near_cabeus_b!.lunar_ops!.auc.toFixed(2)}) but hurt the plateaus and plains (Mons Mouton Plateau{' '}
                {reg.targets.mons_mouton_plateau!.lunar_ops!.auc.toFixed(2)}, Haworth {reg.targets.haworth!.lunar_ops!.auc.toFixed(2)}): a median of{' '}
                {reg.summary.moon.lunar_ops.auc_median.toFixed(2)} against {reg.summary.moon.equal.auc_median.toFixed(2)}. By the rule fixed in advance, equal weights stay the
                default and Lunar ops is an option in the Explorer.
              </li>
            </>
          ) : (
            <li>
              <strong className="text-slate-100">Nearby sites may flatter the AUC.</strong> Several analog sites cluster in the same regions (Atacama, Utah, Iceland).
            </li>
          )}
        </ul>
      </Block>

      <Block title="Weights you can change, including learned ones.">
        <p>
          Equal weights are the default and drive every ranking. The Explorer also offers Expert, Ops (adds gentle slopes and low wind), Learned and, for the Moon, Lunar ops weights. Learned weights come from
          a non-negative logistic regression of analogs against controls, cross-validated; it is the only machine learning in SolMate, and no deep learning is used.
        </p>
        <p>
          The learned model gives mineralogy a weight of zero for every target: with this few sites, the ASTER mineral indices do not separate analogs from controls. Mineralogy
          still appears in every result, so a reader can judge it.
        </p>
      </Block>

      <Block id="limitations" title="What SolMate cannot tell you.">
        <ul className="list-disc space-y-2 pl-5 marker:text-slate-400">
          <li>Gravity, atmosphere, radiation and surface chemistry differ from Earth everywhere; they are stated, never scored.</li>
          <li>
            Caves and lava tubes cannot be seen from orbit. Documented underground analogs (Lava Beds, La Corona, Sa Grutta, Boulby Mine) are listed on the{' '}
            <Link to="/findings" className="text-data hover:underline">
              Findings page
            </Link>
            .
          </li>
          <li>Similar conditions do not mean a similar origin: landscapes on Earth, Mars and the Moon formed under different processes.</li>
          <li>A 0.1° cell averages about 11 km of ground. The index uses terrain at about 1 km, with a 100 m check beside it; climate, temperature and minerals stay at the coarse scale.</li>
          <li>Novel leads are unreviewed. They need expert review and field data before anyone plans a test there.</li>
          <li>Validation labels come from documented field use, which reflects logistics as well as science; they are a check, not ground truth.</li>
          <li>
            MODIS is near the end of its mission. Our MODIS inputs are fixed 2023–24 files that stay in NASA&apos;s archive, so every result can be rebuilt. A future refresh would switch to the VIIRS
            successors on NOAA-20 (land temperature VJ121C3, albedo VJ143C3, snow VJ110C1); the full plan is in{' '}
            <a href="https://github.com/Tanbin-CS/solmate/blob/main/docs/DATA_SOURCES.md#after-modis-the-viirs-path" className="text-data hover:underline" target="_blank" rel="noreferrer">
              DATA_SOURCES
            </a>
            .
          </li>
        </ul>
        <div className="flex flex-wrap gap-3 pt-2">
          <Button asChild>
            <Link to="/explorer">
              Open the Explorer <ArrowRight />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/provenance">See every data source</Link>
          </Button>
        </div>
      </Block>
    </div>
  )
}

function ScoreStrip({ validation, targets, shown, onShow }: { validation: TargetValidation; targets: HomeData['targets']; shown: string; onShow: (id: string) => void }) {
  const groups = [
    { label: 'Analog sites', color: 'var(--data)', dashed: false, items: Object.entries(validation.positives) },
    { label: 'Controls', color: 'var(--slate-400)', dashed: true, items: Object.entries(validation.controls) },
  ]
  return (
    <figure className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <figcaption className="text-sm text-slate-300">Analog Index of every validation site</figcaption>
        <label className="flex items-center gap-2 text-xs text-slate-400">
          Target
          <select value={shown} onChange={(e) => onShow(e.target.value)} className="rounded-md border border-border bg-ink-850 px-2 py-1 text-sm text-slate-100">
            {targets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.label} className="grid grid-cols-[6rem_1fr] items-center gap-4">
            <span className="text-xs text-slate-300">{g.label}</span>
            <div className="relative h-8 rounded-md bg-ink-850">
              {[25, 50, 75].map((t) => (
                <span key={t} className="absolute inset-y-0 w-px bg-ink-600" style={{ left: `${t}%` }} aria-hidden="true" />
              ))}
              {g.items.map(([id, s]) => (
                <span
                  key={id}
                  title={`${siteName(id)}: ${s.sai === null ? '–' : Math.round(s.sai)}`}
                  className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
                  style={{ left: `${s.sai ?? 0}%`, borderColor: g.color, borderStyle: g.dashed ? 'dashed' : 'solid', background: 'var(--ink-900)' }}
                />
              ))}
            </div>
          </div>
        ))}
        <div className="grid grid-cols-[6rem_1fr] gap-4 font-mono text-[11px] text-slate-400">
          <span />
          <div className="flex justify-between">
            <span>0</span>
            <span>50</span>
            <span>100</span>
          </div>
        </div>
      </div>
    </figure>
  )
}

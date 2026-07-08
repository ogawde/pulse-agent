import type React from 'react'

const Pill = ({ label }: { label: string }) => (
  <span className="hover-chip rounded-full border border-slate-700/70 bg-slate-900/60 px-3 py-1 text-xs text-slate-300">
    {label}
  </span>
)

export const App: React.FC = () => {
  return (
    <div className="pulse-gradient flex min-h-full flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 grid-cols-2 grid-rows-2 gap-1 rounded-xl bg-slate-900/70 p-1 ring-1 ring-slate-700/60">
            <div className="rounded-sm bg-[#36C5F0]" />
            <div className="rounded-sm bg-[#2EB67D]" />
            <div className="rounded-sm bg-[#ECB22E]" />
            <div className="rounded-sm bg-[#E01E5A]" />
          </div>
          <div className="text-xl font-semibold tracking-tight text-slate-100 sm:text-2xl">Pulse for Slack</div>
        </div>
        <div className="hidden gap-4 text-xs text-slate-300/80 sm:flex">
          <span>MCP + RTS</span>
          <span className="text-slate-500">|</span>
          <span>Slack Agent for Good</span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 pb-16 pt-4 md:flex-row md:items-stretch">
        <section className="flex flex-1 flex-col justify-center space-y-6">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Built for Slack Agent for Good
          </div>
          <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight text-slate-50 sm:text-5xl">
            Team health pulse checks,
            <span className="block text-slate-400">not surveillance dashboards.</span>
          </h1>
          <p className="max-w-xl text-balance text-sm leading-relaxed text-slate-300">
            Pulse lives inside Slack as an HR wellbeing agent. It turns noisy team activity into
            explainable health cards and proactive alerts for People Ops without exporting or
            ranking individual employees.
          </p>
          <div className="flex flex-wrap gap-2">
            <Pill label="DM @Pulse: How is Engineering doing this week?" />
            <Pill label="/pulse check-alerts in #people-ops" />
            <Pill label="Aggregate scores only (0–10)" />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <span className="font-medium text-slate-300">Live endpoint: api.pulse.curr.xyz</span>
            <span>Slack Agent · MCP Server · Real-Time Search</span>
          </div>
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              className="cursor-not-allowed rounded-xl bg-slate-500/50 px-4 py-2 text-sm font-semibold text-slate-200 opacity-70"
              disabled
              type="button"
            >
              Ask Invite
            </button>
          </div>
        </section>

        <section className="mt-8 flex flex-1 items-center justify-center md:mt-0">
          <div className="glass-panel floating-soft relative w-full max-w-md overflow-hidden rounded-3xl p-5">
            <div className="pulse-orb absolute inset-x-8 top-0 h-24 rounded-b-full bg-gradient-to-b from-[#36C5F0]/25 to-transparent blur-3xl" />
            <div className="relative flex items-center justify-between pb-4">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 grid-cols-2 grid-rows-2 gap-0.5 rounded-xl bg-slate-800/70 p-1">
                  <div className="rounded-sm bg-[#36C5F0]" />
                  <div className="rounded-sm bg-[#2EB67D]" />
                  <div className="rounded-sm bg-[#ECB22E]" />
                  <div className="rounded-sm bg-[#E01E5A]" />
                </div>
                <div className="text-xs text-slate-200">
                  <div className="font-medium">Pulse DM</div>
                  <div className="text-[11px] text-slate-400">pulsesandbox</div>
                </div>
              </div>
              <span className="rounded-full bg-slate-900/80 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-emerald-300">
                Live demo
              </span>
            </div>

            <div className="relative space-y-3">
              <div className="flex justify-start">
                <div className="max-w-[82%] rounded-2xl bg-slate-800/90 px-3 py-2 text-[11px] text-slate-100 shadow transition-all duration-300 hover:-translate-y-0.5">
                  How is Engineering doing this week?
                </div>
              </div>

              <div className="flex justify-end">
                <div className="max-w-[92%] animate-[slideUp_420ms_ease-out] rounded-2xl bg-slate-950/90 px-3 py-3 text-[11px] text-slate-200 shadow-md shadow-sky-500/30 transition-all duration-500 hover:-translate-y-1 hover:shadow-sky-400/35">
                  <div className="mb-1 flex items-center justify-between">
                    <div className="text-[11px] font-semibold text-slate-50">Engineering Watch</div>
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-300">
                      4.8 / 10
                    </span>
                  </div>
                  <div className="mb-2 text-[10px] text-slate-400">Drivers</div>
                  <ul className="mb-3 space-y-1 text-[10px] text-slate-200">
                    <li>• Sentiment drift over the last 2 weeks</li>
                    <li>• After-hours messages creeping up</li>
                    <li>• Lower participation in #engineering</li>
                  </ul>
                  <div className="mb-2 flex gap-2">
                    <button className="flex-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-[10px] font-medium text-slate-950 shadow transition-colors hover:bg-emerald-400">
                      Suggest check-in
                    </button>
                    <button className="flex-1 rounded-lg border border-slate-600 bg-slate-900/60 px-3 py-1.5 text-[10px] font-medium text-slate-100 transition-colors hover:bg-slate-800">
                      View open alerts
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>Aggregate team insight only, no individual rankings</span>
                  </div>
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-slate-700/70 bg-slate-900/80 px-3 py-2 text-[10px] text-slate-300">
                <div className="mb-1 font-semibold text-slate-100">Behind the scenes</div>
                <div>
                  Slack Agent → MCP tools → team snapshots. RTS optionally refreshes signals from opted-in channels,
                  but only aggregates are stored.
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-6 pb-6 text-[11px] text-slate-500">
        <span>Pulse · HR wellbeing agent for Slack</span>
        <span>Built for Slack Agent for Good · Team health pulse checks, not surveillance.</span>
      </footer>
    </div>
  )
}

export default App


import { useCallback, useMemo, useState } from 'react';
import { Renderer } from 'jsx2ui/react';
import { catalog } from './catalog.js';
import { toUIJSON } from './genui/core.js';
import type { Verdict } from './gate-types.js';
import { buildPage } from './page-ui.js';
import { ScenarioContext, type ScenarioController } from './scenario-context.js';
import { SCENARIOS, type ScenarioKey } from './scenarios.js';
import { verdictToUI } from './verdict-to-ui.js';

const SCENARIO_OPTIONS = (Object.keys(SCENARIOS) as ScenarioKey[]).map((key) => ({
  key,
  label: SCENARIOS[key].label,
}));

export function App() {
  const [key, setKey] = useState<ScenarioKey>('leak');
  const [verdict, setVerdict] = useState<Verdict>(SCENARIOS.leak.sampleVerdict);
  const [source, setSource] = useState<'worker' | 'offline-sample'>('offline-sample');
  const [busy, setBusy] = useState(false);
  const [showJSON, setShowJSON] = useState(false);

  const run = useCallback(async (k: string) => {
    const sk = k as ScenarioKey;
    setKey(sk);
    setBusy(true);
    try {
      const res = await fetch('/api/gate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(SCENARIOS[sk].input),
      });
      if (!res.ok) throw new Error(`gate api ${res.status}`);
      setVerdict((await res.json()) as Verdict);
      setSource('worker');
    } catch {
      setVerdict(SCENARIOS[sk].sampleVerdict);
      setSource('offline-sample');
    } finally {
      setBusy(false);
    }
  }, []);

  const pageTree = useMemo(
    () => buildPage({ scenarios: SCENARIO_OPTIONS, verdictTree: verdictToUI(verdict) }),
    [verdict],
  );

  const controller: ScenarioController = useMemo(
    () => ({ activeKey: key, busy, source, onSelect: run }),
    [key, busy, source, run],
  );

  return (
    <main className="ax-app">
      <div className="ax-topbar">
        <div className="ax-brand">
          <span className="ax-brand__mark" aria-hidden>
            AX
          </span>
          <div>
            <h1 className="ax-brand__title">toolprivacy</h1>
            <p className="ax-brand__tag">a privacy check for AI agents that handle your data</p>
          </div>
        </div>
        <button
          type="button"
          className={`ax-jsontoggle ${showJSON ? 'ax-jsontoggle--on' : ''}`}
          onClick={() => setShowJSON((s) => !s)}
          aria-pressed={showJSON}
        >
          {showJSON ? 'hide how this page is built' : 'see how this page is built'}
        </button>
      </div>

      {showJSON ? (
        <section className="ax-jsonpanel" aria-label="UI-JSON for the current page">
          <p className="ax-jsonpanel__note">
            This is the entire page as one serializable tree. Everything below is rendered from it.
          </p>
          <Renderer
            node={{ type: 'JsonView', props: { json: toUIJSON(pageTree) } }}
            catalog={catalog}
          />
        </section>
      ) : null}

      <ScenarioContext.Provider value={controller}>
        <div className="ax-render">
          <Renderer node={pageTree} catalog={catalog} />
        </div>
      </ScenarioContext.Provider>

      <footer className="ax-footer">
        rendered with the jsx2ui gen-ui package · no raw secret leaves the gate
      </footer>
    </main>
  );
}

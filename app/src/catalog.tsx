import { type ReactNode, useContext } from 'react';
import { createCatalog } from 'jsx2ui/react';
import { ScenarioContext } from './scenario-context.js';

type Props = Record<string, unknown> & { children?: ReactNode };

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

export function Hero({ eyebrow, title, lede, children }: Props) {
  return (
    <header className="ax-hero">
      {eyebrow ? <div className="ax-hero__eyebrow">{str(eyebrow)}</div> : null}
      <h1 className="ax-hero__title">{str(title)}</h1>
      {lede ? <p className="ax-hero__lede">{str(lede)}</p> : null}
      {children ? <div className="ax-hero__body">{children}</div> : null}
    </header>
  );
}

export function Section({ title, subtitle, children }: Props) {
  return (
    <section className="ax-section">
      {title ? <h2 className="ax-section__title">{str(title)}</h2> : null}
      {subtitle ? <p className="ax-section__subtitle">{str(subtitle)}</p> : null}
      <div className="ax-section__body">{children}</div>
    </section>
  );
}

export function Step({ index, title, children }: Props) {
  return (
    <div className="ax-step">
      <div className="ax-step__index">{str(index, '•')}</div>
      <div className="ax-step__main">
        {title ? <div className="ax-step__title">{str(title)}</div> : null}
        <div className="ax-step__body">{children}</div>
      </div>
    </div>
  );
}

export function BeforeAfter({ children }: Props) {
  return <div className="ax-beforeafter">{children}</div>;
}

export function CodeBlock({ caption, lang, code }: Props) {
  return (
    <figure className="ax-code">
      {caption ? <figcaption className="ax-code__caption">{str(caption)}</figcaption> : null}
      <pre className="ax-code__pre" data-lang={str(lang, 'text')}>
        <code>{str(code)}</code>
      </pre>
    </figure>
  );
}

export function Callout({ tone, title, children }: Props) {
  const t = str(tone, 'info');
  return (
    <aside className={`ax-callout ax-callout--${t}`} data-tone={t}>
      {title ? <div className="ax-callout__title">{str(title)}</div> : null}
      <div className="ax-callout__body">{children}</div>
    </aside>
  );
}

export function FlowDiagram({ steps }: Props) {
  const items = strArray(steps);
  return (
    <ol className="ax-flow" aria-label="flow">
      {items.map((s, i) => (
        <li className="ax-flow__node" key={`${i}-${s}`}>
          <span className="ax-flow__dot">{i + 1}</span>
          <span className="ax-flow__label">{s}</span>
        </li>
      ))}
    </ol>
  );
}

export function Legend({ items }: Props) {
  const rows = Array.isArray(items)
    ? (items as Array<Record<string, unknown>>).filter((r) => r && typeof r === 'object')
    : [];
  return (
    <dl className="ax-legend">
      {rows.map((r, i) => (
        <div className="ax-legend__row" key={`${i}-${str(r.term)}`}>
          <dt className="ax-legend__term">{str(r.term)}</dt>
          <dd className="ax-legend__plain">{str(r.plain)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function JsonView({ json }: Props) {
  let body = str(json);
  try {
    body = JSON.stringify(JSON.parse(body), null, 2);
  } catch {

  }
  return (
    <pre className="ax-jsonview">
      <code>{body}</code>
    </pre>
  );
}

export function ScenarioPicker({ options }: Props) {
  const ctrl = useContext(ScenarioContext);
  const opts = Array.isArray(options)
    ? (options as Array<Record<string, unknown>>).filter((o) => o && typeof o === 'object')
    : [];
  return (
    <div className="ax-runner">
      <div className="ax-scenarios" aria-label="scenarios">
        {opts.map((o) => {
          const k = str(o.key);
          return (
            <button
              key={k}
              type="button"
              className={`ax-tab ${k === ctrl.activeKey ? 'ax-tab--active' : ''}`}
              onClick={() => ctrl.onSelect(k)}
              disabled={ctrl.busy}
            >
              {str(o.label, k)}
            </button>
          );
        })}
      </div>
      <div className="ax-source" data-source={ctrl.source}>
        {ctrl.source === 'worker'
          ? 'live: checked by the Cloudflare service'
          : 'offline: showing a saved example (live check unavailable right now)'}
      </div>
    </div>
  );
}

export function Panel({ title, subtitle, children }: Props) {
  return (
    <section className="ax-panel">
      {title ? <h2 className="ax-panel__title">{str(title)}</h2> : null}
      {subtitle ? <p className="ax-panel__subtitle">{str(subtitle)}</p> : null}
      <div className="ax-panel__body">{children}</div>
    </section>
  );
}

export function VerdictBadge({ verdict }: Props) {
  const v = str(verdict, 'inconclusive');
  return (
    <span className={`ax-badge ax-badge--${v}`} data-verdict={v}>
      {v.toUpperCase()}
    </span>
  );
}

export function Stat({ label, value }: Props) {
  return (
    <div className="ax-stat">
      <div className="ax-stat__value">{str(value)}</div>
      <div className="ax-stat__label">{str(label)}</div>
    </div>
  );
}

export function StatRow({ children }: Props) {
  return <div className="ax-statrow">{children}</div>;
}

export function ViolationCard({ fieldPath, privateClass, fetchedFor, usedIn, reason }: Props) {
  return (
    <article className="ax-violation">
      <header className="ax-violation__head">
        <code className="ax-violation__field">{str(fieldPath)}</code>
        <span className="ax-chip">{str(privateClass)}</span>
      </header>
      <div className="ax-violation__flow">
        <div className="ax-purpose">
          <span className="ax-purpose__label">fetched for</span>
          <span className="ax-purpose__value ax-purpose--bound">{str(fetchedFor)}</span>
        </div>
        <div className="ax-purpose">
          <span className="ax-purpose__label">used in</span>
          <span className="ax-purpose__value ax-purpose--observed">{str(usedIn)}</span>
        </div>
      </div>
      <div className="ax-violation__reason">{str(reason)}</div>
      <div className="ax-violation__safe">The real email is never copied into this report.</div>
    </article>
  );
}

export function Note({ children }: Props) {
  return <p className="ax-note">{children}</p>;
}

export function EmptyState({ children }: Props) {
  return <div className="ax-empty">{children}</div>;
}

export const catalog = createCatalog({
  Hero,
  Section,
  Step,
  BeforeAfter,
  CodeBlock,
  Callout,
  FlowDiagram,
  Legend,
  JsonView,
  ScenarioPicker,
  Panel,
  VerdictBadge,
  Stat,
  StatRow,
  ViolationCard,
  Note,
  EmptyState,
});

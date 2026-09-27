import { gate } from '../src/gate.js';
import { CORPUS, type CorpusCase } from './corpus.js';

interface CaseResult extends CorpusCase {
  readonly verdict: string;
  readonly caught: boolean;
}

const results: CaseResult[] = CORPUS.map((c) => {
  const v = gate(c.input);
  return { ...c, verdict: v.verdict, caught: v.verdict === 'leak' };
});

const leaks = results.filter((r) => r.truthLeak);
const benign = results.filter((r) => !r.truthLeak);

const caughtLeaks = leaks.filter((r) => r.caught).length;
const recall = leaks.length ? caughtLeaks / leaks.length : 0;

const flaggedBenign = benign.filter((r) => r.caught).length;
const fpRate = benign.length ? flaggedBenign / benign.length : 0;

function scopeRecall(scope: string) {
  const s = leaks.filter((r) => r.scope === scope);
  const c = s.filter((r) => r.caught).length;
  return { total: s.length, caught: c, recall: s.length ? c / s.length : 0 };
}

const inScope = scopeRecall('in_scope');
const knownGap = scopeRecall('known_gap');

const categories = [...new Set(results.map((r) => r.category))];
const perCategory = categories.map((cat) => {
  const rows = results.filter((r) => r.category === cat);
  const truth = rows.filter((r) => r.truthLeak);
  const caught = rows.filter((r) => r.truthLeak && r.caught).length;
  const benignRows = rows.filter((r) => !r.truthLeak);
  const benignFlagged = benignRows.filter((r) => r.caught).length;
  return {
    category: cat,
    scope: rows[0]!.scope,
    leakCases: truth.length,
    leaksCaught: caught,
    benignCases: benignRows.length,
    benignFlagged,
  };
});

const N = 10000;
const latInput = CORPUS.find((c) => c.id === 'leak-email-literal')!.input;

for (let i = 0; i < 1000; i++) gate(latInput);
const samplesUs: number[] = new Array(N);
for (let i = 0; i < N; i++) {
  const t0 = Bun.nanoseconds();
  gate(latInput);
  samplesUs[i] = (Bun.nanoseconds() - t0) / 1000;
}
samplesUs.sort((a, b) => a - b);
const avgUs = samplesUs.reduce((s, x) => s + x, 0) / N;
const medianUs = samplesUs[Math.floor(N / 2)]!;
const p95Us = samplesUs[Math.floor(N * 0.95)]!;

const round = (x: number, d = 3) => Number(x.toFixed(d));

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

console.log('\n=== toolprivacy gate — measured coverage (E1+E2) ===\n');
console.log(`corpus: ${results.length} cases  (${leaks.length} true leaks, ${benign.length} benign)`);
console.log('');
console.log('OVERALL');
console.log(`  recall (true leaks caught)   : ${caughtLeaks}/${leaks.length}  = ${pct(recall)}`);
console.log(`  false-positive rate (benign) : ${flaggedBenign}/${benign.length}  = ${pct(fpRate)}`);
console.log('');
console.log('RECALL BY SCOPE');
console.log(`  in_scope (literal+digit-norm): ${inScope.caught}/${inScope.total} = ${pct(inScope.recall)}`);
console.log(`  known_gap (encode/split/para): ${knownGap.caught}/${knownGap.total} = ${pct(knownGap.recall)}`);
console.log('');
console.log('PER-CATEGORY');
console.log('  category                       scope      leaks  caught  benign  flagged');
for (const c of perCategory) {
  console.log(
    `  ${c.category.padEnd(30)} ${c.scope.padEnd(10)} ${String(c.leakCases).padStart(4)}  ${String(
      c.leaksCaught,
    ).padStart(6)}  ${String(c.benignCases).padStart(6)}  ${String(c.benignFlagged).padStart(7)}`,
  );
}
console.log('');
console.log(`LATENCY  (gate() pure fn, N=${N} runs, microseconds)`);
console.log(`  avg    : ${round(avgUs)} us`);
console.log(`  median : ${round(medianUs)} us`);
console.log(`  p95    : ${round(p95Us)} us`);
console.log('');

const summary = {
  corpus: { total: results.length, trueLeaks: leaks.length, benign: benign.length },
  recall: { caught: caughtLeaks, total: leaks.length, rate: round(recall, 4) },
  falsePositiveRate: { flagged: flaggedBenign, total: benign.length, rate: round(fpRate, 4) },
  byScope: {
    in_scope: { ...inScope, recall: round(inScope.recall, 4) },
    known_gap: { ...knownGap, recall: round(knownGap.recall, 4) },
  },
  perCategory,
  latencyUs: { n: N, avg: round(avgUs), median: round(medianUs), p95: round(p95Us) },
  perCase: results.map((r) => ({
    id: r.id,
    scope: r.scope,
    truthLeak: r.truthLeak,
    verdict: r.verdict,
    caught: r.caught,
  })),
};

console.log('--- JSON SUMMARY (redaction-safe; no raw secrets) ---');
console.log(JSON.stringify(summary, null, 2));

export { summary };

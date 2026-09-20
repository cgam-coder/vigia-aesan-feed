import assert from "node:assert/strict";
import test from "node:test";

import { createDeadline, createEvidenceJournal } from "../scripts/closure-evidence-runtime.mjs";

test("el deadline incluye pausas y limita cada petición al presupuesto restante", async () => {
  let now = 1_000;
  const deadline = createDeadline({ totalMs:100, now:() => now, sleep:async (ms) => { now += ms; } });
  assert.equal(deadline.timeout(1_000, "request"), 100);
  await deadline.pause(60, "wait");
  assert.equal(deadline.timeout(1_000, "request"), 40);
  await assert.rejects(() => deadline.pause(40, "final wait"), /deadline exceeded/u);
});

test("la evidencia por fases sobrevive a un fallo temprano", () => {
  let text = "";
  const journal = createEvidenceJournal({ path:"evidence.json", writeFileSync:(_path, value) => { text = value; },
    now:() => "2026-09-20T06:00:00.000Z" });
  journal.record("observes", { observes:{ RASFF:{ lease:null } } });
  journal.fail(new Error("upstream non-JSON"));
  const evidence = JSON.parse(text);
  assert.equal(evidence.phase, "failed");
  assert.equal(evidence.observes.RASFF.lease, null);
  assert.equal(evidence.failure.message, "upstream non-JSON");
  assert.deepEqual(evidence.phases.map(({ phase }) => phase), ["observes", "failed"]);
});

export function createDeadline({ totalMs, now = () => Date.now(), sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }) {
  if (!Number.isSafeInteger(totalMs) || totalMs <= 0) throw new Error("totalMs must be a positive safe integer");
  const startedAt = now();
  const expiresAt = startedAt + totalMs;
  const remaining = () => Math.max(0, expiresAt - now());
  const assertRemaining = (phase) => {
    const value = remaining();
    if (value <= 0) throw new Error(`Closure verifier deadline exceeded during ${phase}`);
    return value;
  };
  return {
    startedAt, expiresAt, remaining, assertRemaining,
    timeout(requestedMs, phase) { return Math.max(1, Math.min(requestedMs, assertRemaining(phase))); },
    async pause(requestedMs, phase) {
      const wait = Math.min(requestedMs, assertRemaining(phase));
      await sleep(wait);
      assertRemaining(phase);
    },
  };
}

export function createEvidenceJournal({ path, writeFileSync, now = () => new Date().toISOString() }) {
  if (!path || typeof writeFileSync !== "function") throw new Error("Evidence journal path and writer are required");
  const evidence = { checkedAt:now(), phase:"started", phases:[], failure:null };
  const flush = () => writeFileSync(path, JSON.stringify(evidence, null, 2));
  const record = (phase, values = {}) => {
    evidence.phase = phase;
    Object.assign(evidence, values);
    evidence.phases.push({ phase, at:now() });
    flush();
    return evidence;
  };
  const fail = (error) => {
    evidence.phase = "failed";
    evidence.failure = { at:now(), message:error instanceof Error ? error.message : String(error) };
    evidence.phases.push({ phase:"failed", at:evidence.failure.at });
    flush();
    return evidence;
  };
  flush();
  return { evidence, record, fail, flush };
}

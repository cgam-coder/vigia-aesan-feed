import assert from "node:assert/strict";
import test from "node:test";

import {
  FLOATING_ACTION_EXCEPTIONS,
  KNOWN_DEBT,
  analyzeWorkflows,
  loadWorkflows,
  DIAGNOSTIC_FILE,
  isReviewedDiagnosticWorkflow,
} from "./workflow-security.mjs";

const repositoryWorkflows = await loadWorkflows(process.cwd());

test("current public workflow contract has no unreviewed security regression", () => {
  const result = analyzeWorkflows(repositoryWorkflows);
  assert.deepEqual(result.violations, []);
  assert.deepEqual(KNOWN_DEBT.map(({ id }) => id), []);
  assert.equal(
    FLOATING_ACTION_EXCEPTIONS.reduce((sum, item) => sum + item.maxOccurrences, 0),
    0,
  );
  assert.ok(FLOATING_ACTION_EXCEPTIONS.every((item) => item.rationale && item.removalGate));
});


test("all production sync tokens are step-scoped", () => {
  for (const source of repositoryWorkflows.values()) {
    for (const line of source.split(/\r?\n/u).filter((line) => line.includes("VIGIA_SYNC_TOKEN:"))) {
      assert.match(line, /^          VIGIA_SYNC_TOKEN:/u);
    }
  }
});

test("production sync token cannot expand back to job scope", () => {
  const mutated = cloneWorkflows();
  mutated.set(
    "freshness-watchdog.yml",
    mutated.get("freshness-watchdog.yml").replace(
      "          VIGIA_SYNC_TOKEN:",
      "      VIGIA_SYNC_TOKEN:",
    ),
  );
  assertViolation(mutated, "PRODUCTION_TOKEN_JOB_SCOPE");
});

test("retired GH-FIXES workflow surfaces stay absent", () => {
  assert.equal(repositoryWorkflows.has("gh-fixes-closure-once.yml"), false);
  assert.equal(repositoryWorkflows.has("gh-fixes-closure-verify.yml"), false);
});

test("only SEO and the exact owner-authorized temporary diagnostic may publish artifacts", () => {
  const uploaders = [...repositoryWorkflows.entries()]
    .filter(([, source]) => /uses:\s*actions\/upload-artifact@/u.test(source))
    .map(([file]) => file);
  const expected = ["seo-public-snapshot.yml"];
  if (repositoryWorkflows.has(DIAGNOSTIC_FILE)) {
    assert.ok(isReviewedDiagnosticWorkflow(DIAGNOSTIC_FILE, repositoryWorkflows.get(DIAGNOSTIC_FILE)));
    expected.push(DIAGNOSTIC_FILE);
  }
  assert.deepEqual(uploaders, expected);
  assert.match(
    repositoryWorkflows.get("seo-public-snapshot.yml"),
    /path:\s*public-monitoring\/seo\/seo-validation-evidence\//u,
  );
});

test("a new operational artifact publisher is rejected", () => {
  const mutated = cloneWorkflows();
  mutated.set(
    "freshness-watchdog.yml",
    mutated.get("freshness-watchdog.yml") +
      "\n      - name: Unexpected evidence artifact\n" +
      "        uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02\n" +
      "        with:\n" +
      "          name: unexpected-evidence\n" +
      "          path: bounded-evidence.json\n",
  );
  assertViolation(mutated, "UNEXPECTED_PUBLIC_ARTIFACT");
});


test("RASFF carrier keeps pinned non-persistent checkouts and step-scoped secrets", () => {
  const source = repositoryWorkflows.get("rasff-control.yml");
  assert.equal((source.match(/actions\/checkout@[0-9a-f]{40}/gu) ?? []).length, 2);
  assert.equal((source.match(/persist-credentials:\s*false/gu) ?? []).length, 2);
  assert.equal((source.match(/VIGIA_SYNC_TOKEN:\s*\$\{\{\s*secrets\.VIGIA_SYNC_TOKEN\s*\}\}/gu) ?? []).length, 2);
  for (const line of source.split(/\r?\n/u).filter((line) => /VIGIA_SYNC_TOKEN:\s*\$\{\{/u.test(line))) {
    assert.match(line, /^          VIGIA_SYNC_TOKEN:/u);
  }
});

test("RASFF carrier cannot expand token scope back to a job", () => {
  const mutated = cloneWorkflows();
  mutated.set(
    "rasff-control.yml",
    mutated.get("rasff-control.yml").replace(
      "    steps:\n      - uses:",
      "    env:\n      VIGIA_SYNC_TOKEN: $" + "{{ secrets.VIGIA_SYNC_TOKEN }}\n    steps:\n      - uses:",
    ),
  );
  assertViolation(mutated, "RASFF_SECRET_SCOPE");
});

test("Safety Gate/OECD carrier keeps pinned checkout and step-scoped secrets", () => {
  const source = repositoryWorkflows.get("safety-gate-sync.yml");
  assert.equal((source.match(/actions\/checkout@[0-9a-f]{40}/gu) ?? []).length, 1);
  assert.equal((source.match(/persist-credentials:\s*false/gu) ?? []).length, 1);
  assert.equal((source.match(/VIGIA_SYNC_TOKEN:\s*\$\{\{\s*secrets\.VIGIA_SYNC_TOKEN\s*\}\}/gu) ?? []).length, 8);
  for (const line of source.split(/\r?\n/u).filter((line) => /VIGIA_SYNC_TOKEN:\s*\$\{\{/u.test(line))) {
    assert.match(line, /^          VIGIA_SYNC_TOKEN:/u);
  }
});

test("Safety Gate/OECD carrier cannot expand token scope back to a job", () => {
  const mutated = cloneWorkflows();
  mutated.set(
    "safety-gate-sync.yml",
    mutated.get("safety-gate-sync.yml").replace(
      "    steps:\n",
      "    env:\n      VIGIA_SYNC_TOKEN: $" + "{{ secrets.VIGIA_SYNC_TOKEN }}\n    steps:\n",
    ),
  );
  assertViolation(mutated, "SAFETY_OECD_SECRET_SCOPE");
});

test("five-source freshness watchdog keeps its token step-scoped", () => {
  const source = repositoryWorkflows.get("freshness-watchdog.yml");
  assert.equal((source.match(/VIGIA_SYNC_TOKEN:\s*\$\{\{\s*secrets\.VIGIA_SYNC_TOKEN\s*\}\}/gu) ?? []).length, 1);
  assert.match(source, /^          VIGIA_SYNC_TOKEN:/mu);
});

test("five-source freshness watchdog cannot expand token scope back to a job", () => {
  const mutated = cloneWorkflows();
  mutated.set(
    "freshness-watchdog.yml",
    mutated.get("freshness-watchdog.yml").replace(
      "    steps:\n",
      "    env:\n      VIGIA_SYNC_TOKEN: $" + "{{ secrets.VIGIA_SYNC_TOKEN }}\n    steps:\n",
    ),
  );
  assertViolation(mutated, "FRESHNESS_SECRET_SCOPE");
});

test("OECD historical reconcile keeps its token step-scoped", () => {
  const source = repositoryWorkflows.get("oecd-historical-reconcile.yml");
  assert.equal((source.match(/VIGIA_SYNC_TOKEN:\s*\$\{\{\s*secrets\.VIGIA_SYNC_TOKEN\s*\}\}/gu) ?? []).length, 1);
  assert.match(source, /^          VIGIA_SYNC_TOKEN:/mu);
});

test("OECD historical reconcile cannot expand token scope back to a job", () => {
  const mutated = cloneWorkflows();
  mutated.set(
    "oecd-historical-reconcile.yml",
    mutated.get("oecd-historical-reconcile.yml").replace(
      "    steps:\n",
      "    env:\n      VIGIA_SYNC_TOKEN: $" + "{{ secrets.VIGIA_SYNC_TOKEN }}\n    steps:\n",
    ),
  );
  assertViolation(mutated, "OECD_HISTORICAL_SECRET_SCOPE");
});

test("OECD recent freshness retry keeps its token step-scoped", () => {
  const source = repositoryWorkflows.get("oecd-recent-freshness-retry.yml");
  assert.equal((source.match(/VIGIA_SYNC_TOKEN:\s*\$\{\{\s*secrets\.VIGIA_SYNC_TOKEN\s*\}\}/gu) ?? []).length, 1);
  assert.match(source, /^          VIGIA_SYNC_TOKEN:/mu);
});

test("OECD recent freshness retry cannot expand token scope back to a job", () => {
  const mutated = cloneWorkflows();
  mutated.set(
    "oecd-recent-freshness-retry.yml",
    mutated.get("oecd-recent-freshness-retry.yml").replace(
      "    steps:\n",
      "    env:\n      VIGIA_SYNC_TOKEN: $" + "{{ secrets.VIGIA_SYNC_TOKEN }}\n    steps:\n",
    ),
  );
  assertViolation(mutated, "OECD_RECENT_RETRY_SECRET_SCOPE");
});

test("runtime writer freeze certification keeps credentials at step scope", () => {
  const source = repositoryWorkflows.get("runtime-writer-freeze-cert.yml");
  const vigiaLines = source.split(/\r?\n/u).filter((line) => line.includes("VIGIA_SYNC_TOKEN:"));
  const cloudflareLines = source.split(/\r?\n/u).filter((line) => line.includes("CLOUDFLARE_API_TOKEN:"));
  assert.equal(vigiaLines.length, 2);
  assert.equal(cloudflareLines.length, 2);
  assert.ok(vigiaLines.every((line) => /^          VIGIA_SYNC_TOKEN:/u.test(line)));
  assert.ok(cloudflareLines.every((line) => /^          CLOUDFLARE_API_TOKEN:/u.test(line)));
});

test("runtime writer freeze certification rejects wider VIGIA scope", () => {
  const mutated = cloneWorkflows();
  mutated.set(
    "runtime-writer-freeze-cert.yml",
    mutated.get("runtime-writer-freeze-cert.yml").replace(
      "          VIGIA_SYNC_TOKEN:",
      "      VIGIA_SYNC_TOKEN:",
    ),
  );
  assertViolation(mutated, "FREEZE_CERT_VIGIA_SECRET_SCOPE");
});

test("only the two reviewed AESAN publishers can request contents write", () => {
  const writers = [...repositoryWorkflows]
    .filter(([, source]) => /^\s*contents:\s*write\s*(?:#.*)?$/mu.test(source))
    .map(([file]) => file)
    .sort();
  assert.deepEqual(writers, ["update-feed.yml", "update-full-feed.yml"]);
});

test("a production secret added to public SEO fails", () => {
  const mutated = cloneWorkflows();
  mutated.set(
    "seo-public-snapshot.yml",
    mutated.get("seo-public-snapshot.yml") +
      "\n    env:\n      TOKEN: $" + "{{ secrets.VIGIA_SYNC_TOKEN }}\n",
  );
  assertViolation(mutated, "OFFLINE_BOUNDARY");
});

test("write-all fails because no exception exists", () => {
  const mutated = cloneWorkflows();
  mutated.set(
    "ci.yml",
    mutated.get("ci.yml").replace(
      "permissions:\n  contents: read",
      "permissions: write-all",
    ),
  );
  assertViolation(mutated, "WRITE_ALL");
});

test("a privileged pull_request_target event fails for untrusted checkout", () => {
  const mutated = cloneWorkflows();
  mutated.set(
    "ci.yml",
    mutated.get("ci.yml").replace(
      "  pull_request:\n",
      "  pull_request_target:\n",
    ),
  );
  assertViolation(mutated, "PRIVILEGED_EVENT");
});

test("a new floating action in a hardened workflow fails", () => {
  const mutated = cloneWorkflows();
  mutated.set(
    "ci.yml",
    mutated.get("ci.yml").replace(
      /actions\/checkout@[0-9a-f]{40}/,
      "actions/checkout@v4",
    ),
  );
  assertViolation(mutated, "ACTION_NOT_PINNED");
});

test("full AESAN publisher cannot reintroduce a floating action", () => {
  const mutated = cloneWorkflows();
  mutated.set(
    "update-full-feed.yml",
    mutated.get("update-full-feed.yml").replace(
      /actions\/checkout@[0-9a-f]{40}/,
      "actions/checkout@v4",
    ),
  );
  assertViolation(mutated, "ACTION_NOT_PINNED");
});

test("recent AESAN publisher cannot reintroduce a floating action", () => {
  const mutated = cloneWorkflows();
  mutated.set(
    "update-feed.yml",
    mutated.get("update-feed.yml").replace(
      /actions\/checkout@[0-9a-f]{40}/,
      "actions/checkout@v4",
    ),
  );
  assertViolation(mutated, "ACTION_NOT_PINNED");
});

test("environment and broad artifact dumps fail", () => {
  const mutated = cloneWorkflows();
  mutated.set("ci.yml", mutated.get("ci.yml") + "\n      - run: printenv\n");
  assertViolation(mutated, "ENVIRONMENT_DUMP");

  const artifactMutation = cloneWorkflows();
  artifactMutation.set(
    "ci.yml",
    artifactMutation.get("ci.yml") + "\n" +
      "      - uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02\n" +
      "        with:\n" +
      "          path: $" + "{{ github.workspace }}\n",
  );
  assertViolation(artifactMutation, "BROAD_OR_SENSITIVE_ARTIFACT");
});

function cloneWorkflows() {
  return new Map(repositoryWorkflows);
}

function assertViolation(workflows, code) {
  const result = analyzeWorkflows(workflows);
  assert.ok(
    result.violations.some((violation) => violation.code === code),
    "Expected " + code + "; received " + JSON.stringify(result.violations),
  );
}

test("temporary diagnostic cannot expand its artifact, privileges, code pin or trigger", () => {
  const source = repositoryWorkflows.get(DIAGNOSTIC_FILE);
  assert.ok(isReviewedDiagnosticWorkflow(DIAGNOSTIC_FILE, source));
  assert.equal(isReviewedDiagnosticWorkflow("other.yml", source), false);
  for (const [from, to] of [
    ["contents: read", "contents: write"],
    ["ios-safari-evidence/iphone-simulator.png", "."],
    ["retention-days: 1", "retention-days: 90"],
    ["persist-credentials: false", "persist-credentials: true"],
    ["runs-on: macos-15", "runs-on: macos-15-large"],
    ["runs-on: ubuntu-latest", "runs-on: ubuntu-latest-16-cores"],
    ["chromium-evidence/mobile-header.png", "."],
    ["38825bb0fb00c8211691f0c05a47119d60b36730c1e0d9de28b304c08cbbfeb2", "1".repeat(64)],
    ["6b50b4976956752646ef9c1fa931c0c3363e4828e9cc4e32ae60113647b3759e", "0".repeat(64)],
    ["branches: [diag/ui-f1a-ios-simulator-20261001]", "branches: [main]"],
  ]) {
    assert.ok(source.includes(from));
    const mutated = cloneWorkflows();
    mutated.set(DIAGNOSTIC_FILE, source.replace(from, to));
    assert.equal(isReviewedDiagnosticWorkflow(DIAGNOSTIC_FILE, mutated.get(DIAGNOSTIC_FILE)), false);
    assertViolation(mutated, "UNEXPECTED_PUBLIC_ARTIFACT");
  }
  const secret = cloneWorkflows();
  secret.set(DIAGNOSTIC_FILE, source + "\n    env:\n      TOKEN: $" + "{{ secrets.VIGIA_SYNC_TOKEN }}\n");
  assertViolation(secret, "UNEXPECTED_PUBLIC_ARTIFACT");
});


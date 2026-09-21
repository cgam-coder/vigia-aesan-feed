import assert from "node:assert/strict";
import test from "node:test";

import {
  FLOATING_ACTION_EXCEPTIONS,
  KNOWN_DEBT,
  analyzeWorkflows,
  loadWorkflows,
} from "./workflow-security.mjs";

const repositoryWorkflows = await loadWorkflows(process.cwd());

test("current public workflow contract has no unreviewed security regression", () => {
  const result = analyzeWorkflows(repositoryWorkflows);
  assert.deepEqual(result.violations, []);
  assert.deepEqual(KNOWN_DEBT.map(({ id }) => id), [
    "PUB-DEBT-01",
    "PUB-DEBT-02",
    "PUB-DEBT-03",
    "PUB-DEBT-04",
  ]);
  assert.equal(
    FLOATING_ACTION_EXCEPTIONS.reduce((sum, item) => sum + item.maxOccurrences, 0),
    5,
  );
  assert.ok(FLOATING_ACTION_EXCEPTIONS.every((item) => item.rationale && item.removalGate));
});


test("extraordinary repair remains manual-only, confirmed and step-scoped", () => {
  const source = repositoryWorkflows.get("gh-fixes-closure-once.yml");
  assert.match(source, /^  workflow_dispatch:/mu);
  assert.doesNotMatch(source, /^  (?:push|schedule):/mu);
  assert.match(source, /^      confirm:/mu);
  assert.match(source, /RUN-GH-FIXES-CLOSURE/u);
  assert.equal((source.match(/VIGIA_SYNC_TOKEN:\s*\$\{\{\s*secrets\.VIGIA_SYNC_TOKEN\s*\}\}/gu) ?? []).length, 1);
  assert.match(source, /^          VIGIA_SYNC_TOKEN:/mu);
  assert.match(source, /actions\/upload-artifact@[0-9a-f]{40}/u);
});

test("extraordinary repair cannot regain an automatic trigger", () => {
  const mutated = cloneWorkflows();
  mutated.set(
    "gh-fixes-closure-once.yml",
    mutated.get("gh-fixes-closure-once.yml").replace(
      "  workflow_dispatch:\n",
      "  push:\n    branches: [main]\n",
    ),
  );
  assertViolation(mutated, "EXTRAORDINARY_AUTOMATIC_TRIGGER");
});

test("extraordinary repair cannot lose explicit confirmation", () => {
  const mutated = cloneWorkflows();
  mutated.set(
    "gh-fixes-closure-once.yml",
    mutated.get("gh-fixes-closure-once.yml").replaceAll("RUN-GH-FIXES-CLOSURE", "REMOVED-CONFIRMATION"),
  );
  assertViolation(mutated, "EXTRAORDINARY_CONFIRMATION");
});


test("retired closure verifier remains manual-only, pinned and step-scoped", () => {
  const source = repositoryWorkflows.get("gh-fixes-closure-verify.yml");
  assert.match(source, /^  workflow_dispatch:/mu);
  assert.doesNotMatch(source, /^  (?:push|schedule):/mu);
  assert.equal((source.match(/VIGIA_SYNC_TOKEN:\s*\$\{\{\s*secrets\.VIGIA_SYNC_TOKEN\s*\}\}/gu) ?? []).length, 1);
  assert.match(source, /^          VIGIA_SYNC_TOKEN:/mu);
  assert.match(source, /actions\/checkout@[0-9a-f]{40}/u);
  assert.match(source, /actions\/upload-artifact@[0-9a-f]{40}/u);
  assert.match(source, /persist-credentials:\s*false/u);
});

test("retired closure verifier cannot regain an automatic trigger", () => {
  const mutated = cloneWorkflows();
  mutated.set(
    "gh-fixes-closure-verify.yml",
    mutated.get("gh-fixes-closure-verify.yml").replace(
      "  workflow_dispatch:\n",
      "  push:\n    branches: [main]\n",
    ),
  );
  assertViolation(mutated, "RETIRED_VERIFIER_AUTOMATIC_TRIGGER");
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

test("expanding a historical floating exception fails", () => {
  const mutated = cloneWorkflows();
  mutated.set(
    "rasff-control.yml",
    mutated.get("rasff-control.yml") +
      "\n      - uses: actions/checkout@v4\n",
  );
  assertViolation(mutated, "FLOATING_EXCEPTION_EXPANDED");
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

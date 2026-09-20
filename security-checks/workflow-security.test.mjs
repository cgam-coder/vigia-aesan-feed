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
    10,
  );
  assert.ok(FLOATING_ACTION_EXCEPTIONS.every((item) => item.rationale && item.removalGate));
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

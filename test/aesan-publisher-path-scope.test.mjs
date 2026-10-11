import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const expected = [
  "scripts/update-feed.mjs",
  "scripts/aesan.mjs",
  "scripts/aesan-publications.mjs",
  "scripts/aesan-taxonomy.mjs",
  "test/fixtures/aesan-taxonomy-f0-reviewed.json",
  "package.json",
  ".github/workflows/update-feed.yml",
];

const publisherPaths = () => {
  const yaml = read(".github/workflows/update-feed.yml");
  const eventBlock = yaml.split("\n  push:\n")[1]?.split("\n  schedule:\n")[0];
  assert.ok(eventBlock, "publisher must keep the push event AND native scheduled event");
  return [...eventBlock.matchAll(/^      - "([^"]+)"$/gmu)].map(match => match[1]);
};

test("public AESAN feed publisher triggers only on actual generator input changes", () => {
  assert.deepEqual(publisherPaths(), expected);
  for (const irrelevant of [
    "scripts/freshness-watchdog.mjs",
    "test/freshness-watchdog.test.mjs",
    "scripts/revision-control.mjs",
    "test/revision-control-workflow.test.mjs",
    "test/scheduled-publisher-cost-f1.test.mjs",
    ".github/workflows/update-full-feed.yml",
    "docs/some-document.md",
  ]) assert.equal(publisherPaths().includes(irrelevant), false, irrelevant);
  for (const relevant of expected) assert.equal(publisherPaths().includes(relevant), true, relevant);
});

test("all local runtime generator imports and reviewed input fixtures remain push triggers", () => {
  const paths = new Set(publisherPaths());
  for (const path of expected.filter(p => p.startsWith("scripts/"))) {
    const source = read(path);
    for (const match of source.matchAll(/\bfrom\s*["']\.\/([^"']+\.mjs)["']/gu))
      assert.ok(paths.has("scripts/" + match[1]), path + ": untracked runtime module " + match[1]);
    for (const match of source.matchAll(/new URL\(["']\.\.\/(test\/fixtures\/[^"']+)["']/gu))
      assert.ok(paths.has(match[1]), path + ": untracked input fixture " + match[1]);
  }
  assert.match(read("scripts/update-feed.mjs"), /test\/fixtures\/aesan-taxonomy-f0-reviewed\.json/u);
});

test("unchanged schedule, manual replay, writer fencing and publication verification survive", () => {
  const yaml = read(".github/workflows/update-feed.yml");
  const full = read(".github/workflows/update-full-feed.yml");
  const ci = read(".github/workflows/ci.yml");
  assert.match(yaml,/cron: "3,18,33,48 \* \* \* \*"/u);
  assert.match(full,/cron: "27 3 \* \* 0,1,3,5"/u);
  assert.match(yaml,/  workflow_dispatch:/u);
  assert.match(yaml,/  writer_gate:\n    uses: \.\/\.github\/workflows\/runtime-writer-gate\.yml/u);
  assert.match(yaml,/if: needs\.writer_gate\.outputs\.allowed == 'true'/u);
  assert.match(yaml,/group: update-aesan-feed/u);
  assert.match(yaml,/      - run: npm run update/u);
  assert.match(yaml,/AESAN_FULL_HISTORY: \$\{\{ \(github.event_name == 'push' \|\| github.event_name == 'workflow_dispatch'\) && '1' \|\| '0' \}\}/u);
  assert.match(yaml,/      - name: Confirm published feed/u);
  assert.match(yaml,/native coordinator owns D1 ingestion/u);
  assert.match(ci,/      - "scripts\/\*\*"/u);
  assert.match(ci,/      - "test\/\*\*"/u);
  assert.match(ci,/        run: npm test/u);
});

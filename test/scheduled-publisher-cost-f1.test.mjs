import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("scheduled AESAN publisher jobs skip duplicate offline tests but retain parser/publish gates", () => {
  for(const path of [".github/workflows/update-feed.yml", ".github/workflows/update-full-feed.yml"]){
    const yaml=read(path);
    assert.match(yaml,/      - run: npm test\n(?:        #.*\n)*        if: github\.event_name != 'schedule'\n      - run: npm run update\n/u,path);
    assert.equal((yaml.match(/- run: npm test/g)||[]).length,1,path);
    assert.match(yaml,/writer_gate:\n    uses: \.\/\.github\/workflows\/runtime-writer-gate\.yml/u,path);
    assert.match(yaml,/needs: \[writer_gate, runtime_target\]/u,path);
    assert.match(yaml,/if: needs\.writer_gate\.outputs\.allowed == 'true'/u,path);
    assert.match(yaml,/      - name: Publish changed feed/u,path);
    assert.match(yaml,/      - name: Confirm published feed/u,path);
    assert.match(yaml,/      - name: Ingest published feed into VIGIA/u,path);
    assert.match(yaml,/VIGIA_SYNC_TOKEN: \$\{\{ secrets\.VIGIA_SYNC_TOKEN \}\}/u,path);
    assert.match(yaml,/  workflow_dispatch:/u,path);
  }
});

test("independent CI still tests all workflow or parser changes on pushes and PRs",()=>{
  const ci=read(".github/workflows/ci.yml");
  assert.match(ci,/  push:\n    paths:/u);
  assert.match(ci,/  pull_request:\n    paths:/u);
  assert.match(ci,/      - "\.github\/workflows\/\*\*"/u);
  assert.match(ci,/      - "scripts\/\*\*"/u);
  assert.match(ci,/      - "test\/\*\*"/u);
  assert.match(ci,/      - name: Run offline tests without production credentials\n        run: npm test/u);
});

test("recent cadence and full-history data mode remain unchanged after bounded archive-cadence adjustment",()=>{
  const recent=read(".github/workflows/update-feed.yml");
  const full=read(".github/workflows/update-full-feed.yml");
  assert.match(recent,/cron: "3,18,33,48 \* \* \* \*"/u);
  assert.match(full,/cron: "27 3 \* \* 0,1,3,5"/u);
  assert.match(recent,/AESAN_FULL_HISTORY: \$\{\{ \(github.event_name == 'push' \|\| github.event_name == 'workflow_dispatch'\) && '1' \|\| '0' \}\}/u);
  assert.match(full,/AESAN_FULL_HISTORY: "1"/u);
  assert.match(recent,/concurrency:\n  group: update-aesan-feed\n  cancel-in-progress: false/u);
  assert.match(full,/concurrency:\n  group: update-aesan-feed\n  cancel-in-progress: false/u);
});

test("full archive checks have exactly four UTC days/week and at most 48h nominal gap",()=>{
  const full=read(".github/workflows/update-full-feed.yml");
  const match=full.match(/cron: "27 3 \* \* ([0-6](?:,[0-6])*)"/u);
  assert.ok(match,"exact bounded weekly Cron schedule");
  const days=match[1].split(",").map(Number).sort((a,b)=>a-b);
  assert.deepEqual(days,[0,1,3,5]); // Sun, Mon, Wed, Fri
  const gaps=days.map((day,i)=>(days[(i+1)%days.length]-day+7)%7);
  assert.ok(gaps.every(d=>d>0&&d<=2),"no planned gap longer than two days");
  assert.equal(days.length,4);
  assert.match(full,/workflow_dispatch:/u);
  assert.ok(full.includes('    paths:\n      - ".github/workflows/update-full-feed.yml"'));
});

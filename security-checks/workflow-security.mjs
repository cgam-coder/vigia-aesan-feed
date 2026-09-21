import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const OFFLINE_PUBLIC_WORKFLOWS = new Set([
  "ci.yml",
  "seo-public-snapshot.yml",
  "seo-public-watchdog.yml",
]);

const CONTENTS_WRITE_PUBLISHERS = new Set([
  "update-feed.yml",
  "update-full-feed.yml",
]);

const PRIVILEGED_EVENTS = new Set([
  "pull_request_target",
  "workflow_run",
  "issue_comment",
]);

// Reviewed historical exceptions: explicit debt, not a safety claim.
export const FLOATING_ACTION_EXCEPTIONS = Object.freeze([
  debt("safety-gate-sync.yml", "actions/checkout", "v4", 1,
    "Operational OECD helper checkout; pin only with its carrier coordinated."),
  debt("rasff-control.yml", "actions/checkout", "v4", 2,
    "Both RASFF lanes are operational and require coordinated pinning."),
  debt("update-full-feed.yml", "actions/checkout", "v4", 1,
    "AESAN publisher credentials and push path must be validated together."),
  debt("update-full-feed.yml", "actions/setup-node", "v4", 1,
    "AESAN full publisher pin remains an operational change."),
  debt("update-feed.yml", "actions/checkout", "v4", 1,
    "AESAN publisher credentials and push path must be validated together."),
  debt("update-feed.yml", "actions/setup-node", "v4", 1,
    "AESAN recent publisher pin remains an operational change."),
  debt("gh-fixes-closure-verify.yml", "actions/checkout", "v4", 1,
    "Closure verifier is controlled by GITHUB FIXES."),
  debt("gh-fixes-closure-verify.yml", "actions/upload-artifact", "v4", 1,
    "Closure evidence channel is controlled by GITHUB FIXES."),
]);

export const KNOWN_DEBT = Object.freeze([
  {
    id: "PUB-DEBT-01",
    scope: "operational-action-pins",
    statement: "Nine operational action references remain on reviewed @v4 exceptions.",
    removalGate: "Coordinate each carrier, preserve behavior and observe a legitimate run.",
  },
  {
    id: "PUB-DEBT-02",
    scope: "production-secret-injection",
    statement: "Several operational workflows inject VIGIA_SYNC_TOKEN at job scope.",
    removalGate: "Move per step without changing behavior; this is not server-side capability separation.",
  },
  {
    id: "PUB-DEBT-03",
    scope: "public-operational-diagnostics",
    statement: "Historical workflows publish broader status and evidence than the target projection.",
    removalGate: "Add a tested projection and retain required private evidence through an authorized channel.",
  },
  {
    id: "PUB-DEBT-04",
    scope: "platform-protection",
    statement: "Main protection and administrative Actions controls are outside this code-only contract.",
    removalGate: "Verify settings and apply only an owner-approved publisher-compatible configuration.",
  },
]);

function debt(file, action, ref, maxOccurrences, rationale) {
  return {
    file,
    action,
    ref,
    maxOccurrences,
    rationale,
    removalGate: "Replace the floating ref with a verified full SHA in a coordinated operational PR.",
  };
}

export async function loadWorkflows(rootDirectory) {
  const directory = join(rootDirectory, ".github", "workflows");
  const names = (await readdir(directory))
    .filter((name) => /\.ya?ml$/i.test(name))
    .sort();
  return new Map(await Promise.all(names.map(async (name) => [
    name,
    await readFile(join(directory, name), "utf8"),
  ])));
}

export function analyzeWorkflows(workflows) {
  const violations = [];
  const floatingCounts = new Map();

  for (const [file, source] of workflows) {
    checkOfflineBoundary(file, source, violations);
    checkPermissions(file, source, violations);
    checkPrivilegedEvents(file, source, violations);
    checkRunBlocks(file, source, violations);
    checkArtifacts(file, source, violations);
    checkExtraordinaryClosure(file, source, violations);

    for (const actionUse of findActionUses(source)) {
      if (actionUse.local || actionUse.pinned) continue;
      const key = [file, actionUse.action, actionUse.ref].join("\u0000");
      floatingCounts.set(key, (floatingCounts.get(key) ?? 0) + 1);
    }
  }

  for (const [key, count] of floatingCounts) {
    const [file, action, ref] = key.split("\u0000");
    const exception = FLOATING_ACTION_EXCEPTIONS.find((entry) =>
      entry.file === file && entry.action === action && entry.ref === ref);
    if (!exception) {
      violations.push(problem(file, "ACTION_NOT_PINNED",
        action + "@" + ref + " is not pinned to a full commit SHA and has no reviewed exception."));
    } else if (count > exception.maxOccurrences) {
      violations.push(problem(file, "FLOATING_EXCEPTION_EXPANDED",
        action + "@" + ref + " occurs " + count +
        " times; reviewed maximum is " + exception.maxOccurrences + "."));
    }
  }

  return {
    violations,
    knownDebt: KNOWN_DEBT,
    floatingExceptions: FLOATING_ACTION_EXCEPTIONS,
  };
}

function checkOfflineBoundary(file, source, violations) {
  if (!OFFLINE_PUBLIC_WORKFLOWS.has(file)) return;
  const forbidden = [
    [/\$\{\{\s*secrets\./i, "a GitHub secret expression"],
    [/VIGIA_SYNC_TOKEN/i, "the production synchronization credential"],
    [/vigia-runtime/i, "the private runtime repository"],
  ];
  for (const [pattern, label] of forbidden) {
    if (pattern.test(source)) {
      violations.push(problem(file, "OFFLINE_BOUNDARY",
        "Offline public workflow references " + label + "."));
    }
  }
}

function checkPermissions(file, source, violations) {
  if (/^\s*permissions:\s*write-all\s*(?:#.*)?$/im.test(source) ||
      /^\s*write-all\s*(?:#.*)?$/im.test(source)) {
    violations.push(problem(file, "WRITE_ALL", "write-all is forbidden."));
  }
  if (/^\s*contents:\s*write\s*(?:#.*)?$/im.test(source) &&
      !CONTENTS_WRITE_PUBLISHERS.has(file)) {
    violations.push(problem(file, "UNEXPECTED_CONTENTS_WRITE",
      "contents: write is limited to the two AESAN feed publishers."));
  }
}

function checkPrivilegedEvents(file, source, violations) {
  const lines = source.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const indent = line.match(/^\s*/)[0].length;
    if (indent > 2) continue;
    const event = line.match(/^\s*(pull_request_target|workflow_run|issue_comment)\s*:/)?.[1];
    if (event && PRIVILEGED_EVENTS.has(event)) {
      violations.push(problem(file, "PRIVILEGED_EVENT",
        event + " requires exact contextual review before entering a public workflow.", index + 1));
    }
    const inline = line.match(/^\s*on\s*:\s*\[([^\]]+)\]/)?.[1] ?? "";
    for (const token of inline.split(",").map((value) => value.trim())) {
      if (PRIVILEGED_EVENTS.has(token)) {
        violations.push(problem(file, "PRIVILEGED_EVENT",
          token + " requires exact contextual review before entering a public workflow.", index + 1));
      }
    }
  }
}


function checkExtraordinaryClosure(file, source, violations) {
  if (file !== "gh-fixes-closure-once.yml") return;
  if (/^\s{2}(?:push|schedule):/mu.test(source)) {
    violations.push(problem(file, "EXTRAORDINARY_AUTOMATIC_TRIGGER",
      "Extraordinary repair must never run from push or schedule."));
  }
  if (!/^\s{2}workflow_dispatch:/mu.test(source)) {
    violations.push(problem(file, "EXTRAORDINARY_MANUAL_ONLY",
      "Extraordinary repair must retain workflow_dispatch."));
  }
  if (!/^\s{6}confirm:/mu.test(source) || !source.includes("RUN-GH-FIXES-CLOSURE")) {
    violations.push(problem(file, "EXTRAORDINARY_CONFIRMATION",
      "Extraordinary repair requires the reviewed explicit confirmation contract."));
  }
  const secretLines = source.split(/\r?\n/u)
    .map((line, index) => ({ line, index:index + 1 }))
    .filter(({ line }) => /VIGIA_SYNC_TOKEN:\s*\$\{\{\s*secrets\.VIGIA_SYNC_TOKEN\s*\}\}/u.test(line));
  if (secretLines.length !== 1 || !/^\s{10}VIGIA_SYNC_TOKEN:/u.test(secretLines[0]?.line ?? "")) {
    violations.push(problem(file, "EXTRAORDINARY_SECRET_SCOPE",
      "VIGIA_SYNC_TOKEN must exist exactly once at the authenticated step scope.",
      secretLines[0]?.index ?? null));
  }
}

function findActionUses(source) {
  const result = [];
  for (const [index, line] of source.split(/\r?\n/).entries()) {
    const token = line.match(/^\s*(?:-\s*)?uses:\s*([^\s#]+)/)?.[1];
    if (!token || token.startsWith("./") || token.startsWith("docker://")) continue;
    const splitAt = token.lastIndexOf("@");
    const action = splitAt < 0 ? token : token.slice(0, splitAt);
    const ref = splitAt < 0 ? "" : token.slice(splitAt + 1);
    result.push({
      action,
      ref,
      line: index + 1,
      local: false,
      pinned: /^[0-9a-f]{40}$/i.test(ref),
    });
  }
  return result;
}

function checkRunBlocks(file, source, violations) {
  for (const block of findRunBlocks(source)) {
    const dangerous =
      /(?:^|[;&|]\s*)(?:env|printenv|set)(?:\s|$)|toJSON\s*\(\s*(?:env|secrets|github)\s*\)/im;
    if (dangerous.test(block.body)) {
      violations.push(problem(file, "ENVIRONMENT_DUMP",
        "Run block appears to dump an environment or complete sensitive context.", block.line));
    }
  }
}

function findRunBlocks(source) {
  const lines = source.split(/\r?\n/);
  const blocks = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(\s*)(?:-\s*)?run:\s*(.*)$/);
    if (!match) continue;
    const indent = match[1].length;
    const body = [];
    if (match[2] && !/^[>|][-+0-9]*\s*$/.test(match[2])) body.push(match[2]);
    let cursor = index + 1;
    while (cursor < lines.length) {
      const next = lines[cursor];
      if (next.trim() && next.match(/^\s*/)[0].length <= indent) break;
      body.push(next);
      cursor += 1;
    }
    blocks.push({ line: index + 1, body: body.join("\n") });
    index = cursor - 1;
  }
  return blocks;
}

function checkArtifacts(file, source, violations) {
  const lines = source.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    if (!/uses:\s*actions\/upload-artifact@/.test(lines[index])) continue;
    const stepIndent = nearestStepIndent(lines, index);
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const line = lines[cursor];
      const dash = line.match(/^(\s*)-\s+(?:name:|uses:|run:)/);
      if (dash && dash[1].length <= stepIndent) break;
      const rawPath = line.match(/^\s*path:\s*(.+?)\s*(?:#.*)?$/)?.[1];
      if (!rawPath) continue;
      const path = rawPath.replace(/^['"]|['"]$/g, "").trim();
      const broad = new Set([
        ".", "./", "/", "~",
        "$" + "{{ github.workspace }}",
        "$" + "{{ runner.temp }}",
        "$RUNNER_TEMP",
        "$" + "{RUNNER_TEMP}",
      ]);
      if (broad.has(path) || /[*?]/.test(path) ||
          /(?:^|\/)(?:\.env|\.git|credentials?|secrets?|id_rsa|tokens?)(?:\/|$)/i.test(path)) {
        violations.push(problem(file, "BROAD_OR_SENSITIVE_ARTIFACT",
          "Artifact path is broad or credential-like: " + path, cursor + 1));
      }
    }
  }
}

function nearestStepIndent(lines, from) {
  for (let index = from; index >= 0; index -= 1) {
    const match = lines[index].match(/^(\s*)-\s+(?:name:|uses:|run:)/);
    if (match) return match[1].length;
  }
  return 0;
}

function problem(file, code, message, line = null) {
  return { file, line, code, message };
}

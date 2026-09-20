import assert from "node:assert/strict";
import test from "node:test";
import { HOME_SNAPSHOT_TARGETS, validateHomepageSnapshot, extractHomepageSignals } from "../scripts/seo-home-contracts.mjs";

const fixture = () => ({ pages:HOME_SNAPSHOT_TARGETS.map((target) => ({
  url:`https://nagamealert.com${target.path}`, status:200,
  canonical:`https://nagamealert.com${target.canonicalPath}`,
  robots:target.indexable ? "index, follow" : "noindex, follow", xRobots:null,
  homeDiscovery:"present", rawAlertLinks:6, invalidQuery:target.invalidQuery,
})) });
const verdict = (mutate) => { const report = fixture(); mutate(report); return validateHomepageSnapshot(report); };
const page = (report, name) => report.pages.find((candidate) => candidate.url.includes(HOME_SNAPSHOT_TARGETS.find((target) => target.name === name).path));
const rejects = (mutate, expected) => {
  const result = verdict(mutate);
  assert.equal(result.status, "FAIL");
  assert.ok(result.failures.some((failure) => failure.includes(expected)), JSON.stringify(result));
};

test("clean ES/EN and correctly handled query variants pass", () => assert.equal(validateHomepageSnapshot(fixture()).status, "PASS"));
test("HTTP 200 with missing discovery cannot pass", () => rejects((r) => { r.pages[0].homeDiscovery = "absent"; r.pages[0].rawAlertLinks = 0; }, "block is absent"));
test("a marker without real anchors cannot pass", () => rejects((r) => { r.pages[1].rawAlertLinks = 0; }, "no real alert anchors"));
test("hydration-only links represented by zero raw anchors cannot pass", () => rejects((r) => { r.pages[0].rawAlertLinks = 0; }, "no real alert anchors"));
test("UTM landing-page errors cannot pass", () => rejects((r) => { page(r, "es-utm").invalidQuery = true; }, "valid landing page"));
test("English UTM landing-page errors cannot pass", () => rejects((r) => { page(r, "en-utm").invalidQuery = true; }, "valid landing page"));
test("archive UTM landing-page errors cannot pass", () => rejects((r) => { page(r, "es-archive-utm").invalidQuery = true; }, "valid landing page"));
test("a missing error detector cannot pass", () => rejects((r) => { delete page(r, "es-utm").invalidQuery; }, "detector is missing"));
test("unsupported-parameter negative control must be detected", () => rejects((r) => { page(r, "es-invalid").invalidQuery = false; }, "negative control"));
test("filtered pages retain noindex", () => rejects((r) => { r.pages[2].robots = "index, follow"; }, "missing noindex"));
test("tagged URLs retain the existing noindex contract", () => rejects((r) => { page(r, "es-utm").robots = "index, follow"; }, "missing noindex"));
test("an HTTP header can block an otherwise indexable page", () => rejects((r) => { r.pages[0].xRobots = "googlebot: noindex"; }, "blocked by robots"));
test("none is also a blocking directive", () => rejects((r) => { r.pages[0].robots = "none"; }, "blocked by robots"));
test("nofollow is not silently accepted", () => rejects((r) => { r.pages[2].xRobots = "nofollow"; }, "blocked by nofollow"));
test("canonical cannot retain tracking parameters", () => rejects((r) => { page(r, "es-utm").canonical = page(r, "es-utm").url; }, "canonical"));
test("archive canonical remains on the clean archive", () => rejects((r) => { page(r, "en-archive-utm").canonical = "https://nagamealert.com/en/"; }, "canonical"));
test("canonical must use the correct locale", () => rejects((r) => { r.pages[1].canonical = "https://nagamealert.com/es/"; }, "canonical"));
test("missing observations fail closed", () => rejects((r) => { r.pages.pop(); }, "expected one HTTP observation"));
test("duplicate observations fail closed", () => rejects((r) => { r.pages.push(r.pages[0]); }, "expected one HTTP observation"));
test("fetch errors do not produce a green result", () => rejects((r) => { r.pages[0].error = "timeout"; }, "fetch failed"));
test("HTTP failures cannot pass", () => rejects((r) => { r.pages[0].status = 500; }, "HTTP 500"));
test("missing reports cannot pass", () => assert.equal(validateHomepageSnapshot(null).status, "FAIL"));
test("no noindex directive is required on a clean page", () => assert.equal(verdict((r) => { r.pages[0].robots = null; }).status, "PASS"));
test("all problems are reported, not just the first", () => { const result = verdict((r) => { r.pages[0].homeDiscovery = "absent"; r.pages[1].rawAlertLinks = 0; page(r, "es-utm").invalidQuery = true; }); assert.equal(result.failures.length, 3); });

const anchor = '<a href="/es/alerta/rasff/id/product">View</a>';
test("HTML extractor finds actual alert anchors", () => assert.equal(extractHomepageSignals(anchor).rawAlertLinks, 1));
test("HTML extractor ignores script-only links", () => assert.equal(extractHomepageSignals(`<script>${anchor}</script>`).rawAlertLinks, 0));
test("HTML extractor ignores comments and inert templates", () => assert.equal(extractHomepageSignals(`<!-- ${anchor} --><template>${anchor}</template>`).rawAlertLinks, 0));
test("HTML extractor supports reversed attributes and single quotes", () => assert.equal(extractHomepageSignals("<link href='https://nagamealert.com/es/' rel='canonical'>").canonical, "https://nagamealert.com/es/"));
test("HTML extractor rejects ambiguous canonicals", () => assert.equal(extractHomepageSignals('<link rel="canonical" href="a"><link rel="canonical" href="b">').canonical, null));
test("HTML extractor does not count external links", () => assert.equal(extractHomepageSignals('<a href="https://example.com/es/alerta/rasff/id/product">View</a>').rawAlertLinks, 0));
test("HTML extractor detects the demonstrated Spanish error", () => assert.equal(extractHomepageSignals('<p>La URL contiene una consulta no válida</p>').invalidQuery, true));
test("HTML extractor ignores error strings inside hydration", () => assert.equal(extractHomepageSignals('<script>La URL contiene una consulta no válida</script>').invalidQuery, false));
test("HTML extractor combines robots and Googlebot restrictions", () => assert.match(extractHomepageSignals('<meta name="robots" content="index, follow"><meta name="googlebot" content="noindex">').robots, /noindex/u));

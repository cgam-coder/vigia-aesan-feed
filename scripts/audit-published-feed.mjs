import { readFile } from "node:fs/promises";

const [baselinePath = "feed.json", candidatePath] = process.argv.slice(2);
if (!candidatePath) throw new Error("Uso: node scripts/audit-published-feed.mjs <baseline.json> <candidate.json>");
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const [baseline, candidate] = await Promise.all([readJson(baselinePath), readJson(candidatePath)]);
const baselineById = new Map(baseline.alerts.map((alert) => [alert.id, alert]));
const labelFrequency = new Map();
for (const alert of candidate.alerts) for (const field of alert.publishedFields ?? []) {
  labelFrequency.set(field.label, (labelFrequency.get(field.label) ?? 0) + 1);
}
const duplicates = (values) => [...values.reduce((counts, value) => counts.set(value, (counts.get(value) ?? 0) + 1), new Map())]
  .filter(([, count]) => count > 1).map(([value, count]) => ({ value, count }));
const preservationMismatch = (field) => candidate.alerts.flatMap((alert) => {
  const before = baselineById.get(alert.id);
  return before && before[field] !== alert[field] ? [{ id:alert.id, before:before[field], after:alert[field] }] : [];
});
const samples = new Set(["ES2026/543", "ES2026/517", "ES2026/473", "ES2026/160", "ES2025/507"]);
const result = {
  corpus:{ baseline:baseline.alerts.length, candidate:candidate.alerts.length,
    withStructuredFields:candidate.alerts.filter((alert) => alert.publishedFields?.length).length,
    totalPublishedFields:candidate.alerts.reduce((sum, alert) => sum + (alert.publishedFields?.length ?? 0), 0),
    distinctLabels:labelFrequency.size,
    labelFrequency:Object.fromEntries([...labelFrequency].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "es"))),
    withMaterialParagraphs:candidate.alerts.filter((alert) => alert.materialParagraphs?.length).length,
    totalMaterialParagraphs:candidate.alerts.reduce((sum, alert) => sum + (alert.materialParagraphs?.length ?? 0), 0),
    withImages:candidate.alerts.filter((alert) => alert.resources?.some(({ kind }) => kind === "image")).length,
    withMultipleImages:candidate.alerts.filter((alert) => alert.resources?.filter(({ kind }) => kind === "image").length > 1).length,
    totalImages:candidate.alerts.reduce((sum, alert) => sum + (alert.resources?.filter(({ kind }) => kind === "image").length ?? 0), 0),
    withDocumentsOrLinks:candidate.alerts.filter((alert) => alert.resources?.some(({ kind }) => kind !== "image")).length,
    totalDocumentsOrLinks:candidate.alerts.reduce((sum, alert) => sum + (alert.resources?.filter(({ kind }) => kind !== "image").length ?? 0), 0) },
  exactTitle:{ mismatches:candidate.alerts.filter((alert) => alert.title !== alert.officialTitle)
    .map((alert) => ({ id:alert.id, title:alert.title, officialTitle:alert.officialTitle })) },
  identity:{ duplicateIds:duplicates(candidate.alerts.map((alert) => alert.id)),
    duplicateReferences:duplicates(candidate.alerts.map((alert) => alert.reference)),
    duplicateSourceRecordIds:duplicates(candidate.alerts.map((alert) => alert.sourceRecordId)),
    idsMissingFromCandidate:baseline.alerts.map((alert) => alert.id).filter((id) => !candidate.alerts.some((entry) => entry.id === id)),
    idsAddedToCandidate:candidate.alerts.map((alert) => alert.id).filter((id) => !baselineById.has(id)),
    correctionPage:candidate.alerts.filter((alert) => alert.url === "https://www.aesan.gob.es/alertas/2026_67")
      .map((alert) => ({ id:alert.id, reference:alert.reference, sourceRecordId:alert.sourceRecordId, previousReferences:alert.previousReferences })) },
  baselinePreservation:{ detectedAt:preservationMismatch("detectedAt"), updatedAt:preservationMismatch("updatedAt"),
    versionCount:preservationMismatch("versionCount"), contentHash:preservationMismatch("contentHash") },
  rareLabels:[...labelFrequency].filter(([, count]) => count <= 2).map(([label, count]) => ({ label, count,
    examples:candidate.alerts.filter((alert) => alert.publishedFields?.some((field) => field.label === label)).map((alert) => alert.reference) })),
  samples:candidate.alerts.filter((alert) => samples.has(alert.reference)).map((alert) => ({ id:alert.id, reference:alert.reference,
    url:alert.url, officialTitle:alert.officialTitle, publishedFields:alert.publishedFields,
    materialParagraphs:alert.materialParagraphs, resources:alert.resources, officialDates:alert.officialDates })),
};
console.log(JSON.stringify(result, null, 2));

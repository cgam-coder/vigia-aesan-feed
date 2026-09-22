import { createHash } from "node:crypto";
import {
  cardFallback, isOfficialAesanAlertUrl, officialPagePath,
  parseDetail, previousForCard, sourceIdentityForHtml,
} from "./aesan.mjs";

const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const fail = (code, reference) => { throw new Error(`${code}: ${reference || "referencia no disponible"}`); };
const madridDate = new Intl.DateTimeFormat("en-CA", {
  timeZone:"Europe/Madrid", year:"numeric", month:"2-digit", day:"2-digit",
});
const dayFor = (value) => {
  if (typeof value !== "string" || !value || !Number.isFinite(Date.parse(value))) return null;
  const parts = Object.fromEntries(madridDate.formatToParts(new Date(value)).map(({ type, value:part }) => [type, part]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};
const printedDate = (value) => {
  const match = String(value ?? "").trim().match(/^(\d{2})\/(\d{2})\/(20\d{2})(?:\s+(\d{1,2}):(\d{2}))?$/u);
  if (!match) return null;
  const [, d, m, y, h, minute] = match;
  const date = `${y}-${m}-${d}`;
  const parsed = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date ||
      (h !== undefined && (+h > 23 || +minute > 59))) return null;
  return { day:date, minute:h === undefined ? null : +h * 60 + +minute };
};

// Compare publication chronology, never the ingestion time or a lexical URL order.
// Preserve the original date strings: this evidence is only used for selection.
export function publicationDateEvidence(record) {
  const dates = record.officialDates ?? [];
  const pageDays = [...new Set(dates.filter((date) => date.sourceField === "pageInfo.date")
    .map((date) => printedDate(date.value)?.day).filter(Boolean))];
  const storedDay = dayFor(record.publishedAt);
  if (pageDays.length > 1 || (pageDays.length === 1 && storedDay && pageDays[0] !== storedDay)) {
    fail("AESAN_PUBLICATION_DATE_CONFLICT", record.reference);
  }
  const day = pageDays[0] ?? storedDay;
  const times = [...new Set(dates.filter((date) => date.label === "Fecha y hora")
    .map((date) => printedDate(date.value)).filter((date) => date?.day === day && date.minute !== null)
    .map((date) => date.minute))];
  if (times.length > 1) fail("AESAN_PUBLICATION_TIME_CONFLICT", record.reference);
  return { day, minute:times[0] ?? null };
}

const linkedFrom = (newer, older) => Boolean(newer.isUpdate && (newer.resources ?? [])
  .some((resource) => resource.kind === "link" && isOfficialAesanAlertUrl(resource.url) &&
    officialPagePath(resource.url) === officialPagePath(older.url)));

// null means that the order has NOT been established. It is not a tie-break invitation.
export function comparePublications(left, right) {
  const a = publicationDateEvidence(left);
  const b = publicationDateEvidence(right);
  if (a.day && b.day && a.day !== b.day) return a.day > b.day ? 1 : -1;
  if (a.day && a.day === b.day && a.minute !== null && b.minute !== null && a.minute !== b.minute) {
    return a.minute > b.minute ? 1 : -1;
  }
  const leftLinks = linkedFrom(left, right);
  const rightLinks = linkedFrom(right, left);
  if (leftLinks !== rightLinks) return leftLinks ? 1 : -1;
  return null;
}

// A reference is a case, not a publication. Deduplicate URLs before HTTP requests,
// but do NOT discard the other publication pages of a case before reading them.
export function publicationCards(cards) {
  const unique = new Map();
  for (const card of [...cards].sort((a, b) =>
    String(b.publishedAt ?? "").localeCompare(String(a.publishedAt ?? "")) ||
    String(a.url).localeCompare(String(b.url)) || String(a.title).localeCompare(String(b.title)))) {
    if (!isOfficialAesanAlertUrl(card.url)) fail("AESAN_INVALID_PUBLICATION_URL", card.reference);
    const path = officialPagePath(card.url);
    if (!unique.has(path)) unique.set(path, card);
  }
  return [...unique.values()];
}

const materialKeys = ["officialTitle", "publishedFields", "materialParagraphs", "resources", "officialDates"];
const materialFor = (record) => Object.fromEntries(materialKeys.map((key) => [key, record[key]]));
const materialIsVerifiable = (record) => record.sourceRecordSchemaVersion === 2 &&
  typeof record.officialTitle === "string" && materialKeys.slice(1).every((key) => Array.isArray(record[key])) &&
  typeof record.sourceRecordHash === "string" && record.sourceRecordHash === hash(materialFor(record));

// The ledger records source snapshots, not invented ingestion versions. It includes
// the current publication and past observed states, keyed by page + source hash.
// Legacy referenceHistory is retained unchanged; absent old fields are never invented.
function publicationSnapshot(record) {
  if (!materialIsVerifiable(record)) return null;
  const path = officialPagePath(record.url);
  const validIdentity = record.sourceRecordIdType === "idAlert"
    ? /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(record.sourceRecordId ?? "")
    : record.sourceRecordIdType === "official_page_path" && record.sourceRecordId === `official_page_path:${path}`;
  if (!path || !validIdentity) return null;
  return {
    reference:record.reference,
    sourceRecordId:record.sourceRecordId,
    sourceRecordIdType:record.sourceRecordIdType,
    url:record.url,
    publishedAt:record.publishedAt ?? null,
    sourceRecordSchemaVersion:2,
    sourceRecordHash:record.sourceRecordHash,
    ...materialFor(record),
  };
}

function mergePublicationHistory(previous, observations, current) {
  const history = previous?.publicationHistory ?? [];
  if (!Array.isArray(history)) fail("AESAN_INVALID_PUBLICATION_HISTORY", current.reference);
  const snapshots = new Map();
  const insert = (record, strict = false) => {
    const snapshot = publicationSnapshot(record);
    if (!snapshot) {
      if (strict) fail("AESAN_INVALID_PUBLICATION_HISTORY", current.reference);
      return;
    }
    const path = officialPagePath(snapshot.url);
    if (!path || !isOfficialAesanAlertUrl(snapshot.url) || typeof snapshot.reference !== "string") {
      fail("AESAN_INVALID_PUBLICATION_HISTORY", current.reference);
    }
    const key = `${path}\u0000${snapshot.sourceRecordHash}`;
    const existing = snapshots.get(key);
    if (existing?.sourceRecordIdType === "idAlert" && snapshot.sourceRecordIdType === "idAlert" &&
        existing.sourceRecordId !== snapshot.sourceRecordId) fail("AESAN_PUBLICATION_UUID_CONFLICT", current.reference);
    if (!existing || existing.sourceRecordIdType !== "idAlert" || snapshot.sourceRecordIdType === "idAlert") snapshots.set(key, snapshot);
  };
  for (const record of history) insert(record, true);
  if (previous) insert(previous);
  for (const record of observations) insert(record);
  insert(current);
  const references = new Set([current.reference, previous?.reference,
    ...(previous?.previousReferences ?? []), ...(current.previousReferences ?? []),
    ...(previous?.referenceHistory ?? []).map((entry) => entry.reference),
    ...(current.referenceHistory ?? []).map((entry) => entry.reference)]);
  if ([...snapshots.values()].some((record) => !references.has(record.reference))) {
    fail("AESAN_UNRELATED_PUBLICATION_HISTORY", current.reference);
  }
  validateObservedIdentities([...snapshots.values()]);
  const values = [...snapshots.values()].sort((a, b) =>
    String(a.publishedAt ?? "").localeCompare(String(b.publishedAt ?? "")) ||
    a.url.localeCompare(b.url) || a.sourceRecordHash.localeCompare(b.sourceRecordHash));
  // Do not add a bookkeeping field to every existing single-publication record.
  return values.length > 1 || history.length ? values : null;
}

function validateObservedIdentities(records) {
  const identityPaths = new Map();
  const pathIdentities = new Map();
  for (const record of records) {
    const path = officialPagePath(record.url);
    const priorPath = identityPaths.get(record.sourceRecordId);
    if (priorPath && priorPath !== path) fail("AESAN_PUBLICATION_ID_MULTIPLE_PATHS", record.reference);
    identityPaths.set(record.sourceRecordId, path);
    if (record.sourceRecordIdType === "idAlert") {
      const priorId = pathIdentities.get(path);
      if (priorId && priorId !== record.sourceRecordId) fail("AESAN_PUBLICATION_UUID_CONFLICT", record.reference);
      pathIdentities.set(path, record.sourceRecordId);
    }
  }
}

/**
 * Pure batch reconciliation used by update-feed. observations contains the details
 * actually fetched in this cycle: {card, html}, or {card, html:null} after a logged
 * transport failure. No HTTP, filesystem, D1, timestamps or mutations occur here.
 */
export function reconcilePublicationBatch(previousAlerts, observations, now) {
  const groups = new Map();
  const parsed = [];
  for (const observation of observations) {
    const { card, html } = observation;
    const identity = html === null ? null : sourceIdentityForHtml(html, card.url);
    const raw = html === null ? null : parseDetail(html, card, null, now, identity);
    // The fetched title/reference, not stale listing metadata, resolves corrections.
    const lookup = raw ?? card;
    const referenceMatches = previousAlerts.filter((alert) => lookup.reference && alert.reference === lookup.reference);
    if (new Set(referenceMatches.map((alert) => alert.id)).size > 1) {
      fail("AESAN_AMBIGUOUS_PREVIOUS_CASE", lookup.reference);
    }
    const previous = previousForCard(previousAlerts, lookup, identity);
    if (raw && previous) validateObservedIdentities([raw, previous]);
    const record = raw ?? previous ?? cardFallback(card, null, now);
    const key = previous?.id ?? record.id;
    if (!groups.has(key)) groups.set(key, { previous, entries:[] });
    const group = groups.get(key);
    if (group.previous && previous && group.previous.id !== previous.id) fail("AESAN_AMBIGUOUS_PREVIOUS_CASE", record.reference);
    group.previous ??= previous;
    group.entries.push({ record, observation, identity, verified:html !== null });
    if (raw) parsed.push(raw);
  }
  validateObservedIdentities(parsed);
  const result = [];
  for (const { previous, entries } of groups.values()) {
    // One HTTP response per page is expected. Repeated byte-equivalent observations
    // are harmless; contradictory responses in the SAME cycle are not ordered by arrival.
    const pages = new Map();
    for (const entry of entries.filter((item) => item.verified || !previous)) {
      const path = officialPagePath(entry.record.url);
      const prior = pages.get(path);
      if (prior && prior.record.sourceRecordHash !== entry.record.sourceRecordHash) {
        fail("AESAN_CONFLICTING_PUBLICATION_RESPONSES", entry.record.reference);
      }
      if (!prior || entry.verified) pages.set(path, entry);
    }
    if (previous && !pages.has(officialPagePath(previous.url))) {
      pages.set(officialPagePath(previous.url), { record:previous, verified:false });
    }
    const candidates = [...pages.values()];
    const maxima = candidates.filter((candidate) => !candidates.some((other) =>
      other !== candidate && comparePublications(other.record, candidate.record) === 1));
    if (maxima.length !== 1) fail("AESAN_PUBLICATION_ORDER_UNPROVEN", previous?.reference ?? candidates[0]?.record.reference);
    const selected = maxima[0];
    // A unique maximum alone is insufficient when another candidate is incomparable.
    if (candidates.some((other) => other !== selected && comparePublications(selected.record, other.record) !== 1)) {
      fail("AESAN_PUBLICATION_ORDER_UNPROVEN", selected.record.reference);
    }
    const current = selected.verified
      ? parseDetail(selected.observation.html, selected.observation.card, previous, now, selected.identity)
      : selected.record;
    const history = mergePublicationHistory(previous, entries.filter((entry) => entry.verified).map((entry) => entry.record), current);
    result.push(history ? { ...current, publicationHistory:history } : current);
  }
  return result;
}

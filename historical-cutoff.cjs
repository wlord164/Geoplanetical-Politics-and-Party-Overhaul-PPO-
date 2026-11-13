"use strict";

const cutoff = "2026-01-01";
const live = new Set(["active", "ceasefire", "occupation", "dormant"]);
const dispositions = new Set([...live, "unverified", "ended", "merged"]);

function applyHistoricalCutoff(conflicts, actors, audit) {
  if (audit.asOf !== cutoff) throw new Error("Historical conflict audit has the wrong cutoff");
  const conflictById = new Map(conflicts.map(row => [row.id, row]));
  const uncertain = new Set(conflicts.filter(row => row.status === "uncertain").map(row => row.id));
  const decisions = new Map();
  for (const decision of audit.decisions) {
    const { id, disposition, evidenceDate, note, sources, patch, canonicalId } = decision;
    const row = conflictById.get(id);
    if (!row || decisions.has(id) || !dispositions.has(disposition) || !note || !sources?.length ||
        evidenceDate && (!/^\d{4}-\d{2}-\d{2}$/.test(evidenceDate) || evidenceDate > cutoff) ||
        live.has(disposition) && !evidenceDate) {
      throw new Error(`Invalid January 1 historical conflict decision: ${id}`);
    }
    decisions.set(id, decision);
    uncertain.delete(id);
    if (live.has(disposition)) {
      const { replaceSources, ...scenario } = patch || {};
      Object.assign(row, scenario, { status: disposition, note, evidenceDate,
        confidence: decision.confidence || "medium", sources: [...new Set([...sources, ...(replaceSources ? [] : row.sources)])] });
    } else if (disposition === "merged") {
      const canonical = conflictById.get(canonicalId);
      if (!canonical || canonicalId === id) throw new Error(`Invalid merged conflict target: ${id}`);
      canonical.catalogRefs = [...new Set([...(canonical.catalogRefs || []), id])];
      canonical.sources = [...new Set([...canonical.sources, ...sources])];
    }
  }
  if (uncertain.size) throw new Error("Missing cutoff decisions: " + [...uncertain].join(", "));
  const included = conflicts.filter(row => live.has(decisions.get(row.id)?.disposition || row.status));
  const includedIds = new Set(included.map(row => row.id));
  for (const decision of decisions.values()) {
    if (decision.disposition === "merged" && !includedIds.has(decision.canonicalId)) {
      throw new Error(`Merged conflict is missing from the opening roster: ${decision.id}`);
    }
  }

  const actorById = new Map(actors.map(actor => [actor.id, actor]));
  for (const { id, ...profile } of audit.profiles || []) {
    const actor = actorById.get(id);
    if (!actor) throw new Error("Unknown audited historical actor: " + id);
    const laws = new Map([...(actor.laws || []), ...(profile.laws || [])].map(law => [law.name, law]));
    Object.assign(actor, profile);
    if (laws.size) actor.laws = [...laws.values()];
  }
  return included;
}

module.exports = { applyHistoricalCutoff };

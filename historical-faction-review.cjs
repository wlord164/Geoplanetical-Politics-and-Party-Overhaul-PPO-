"use strict";

const stateKinds = new Set(["state", "state-force", "government", "military-government"]);
const scopes = new Set(["military", "agreement", "local", "national", "autonomy", "independence"]);
const fits = new Set(["close", "partial", "none", "unknown"]);
const presets = require("./party-ideology-presets.cjs");

function hasSources(sources) {
  return Array.isArray(sources) && sources.length > 0 &&
    sources.every(source => typeof source === "string" && /^https?:\/\//.test(source));
}

function readIdeology(profile, id) {
  const hasPreset = profile?.preset != null;
  if (!profile || !fits.has(profile.fit) || (hasPreset && !Object.hasOwn(presets, profile.preset)) ||
      hasPreset !== ["close", "partial"].includes(profile.fit) || !profile.note?.trim() ||
      !hasSources(profile.sources) || (profile.historicalLabel != null && !profile.historicalLabel.trim())) {
    throw new Error("Invalid or missing historical ideology review " + id);
  }
  return { ...profile, label: hasPreset ? presets[profile.preset].label : null };
}

function defaultOutcomeTitle(front, actor) {
  if (front.native || front.mode === "stock") {
    return "Native peace settlement";
  }
  if (front.status === "occupation") {
    return "Territorial status settlement";
  }
  if (front.kind === "interstate") {
    return "Bilateral security settlement";
  }
  if (actor.kind === "community-group") {
    return "Local community settlement";
  }
  if (stateKinds.has(actor.kind)) {
    return "State authority upheld";
  }
  if (front.kind === "nonstate") {
    return "Local rival checked";
  }
  return "Bounded armed victory";
}

function readHistoricalFactionReview(catalog, regional) {
  if (regional.asOf !== catalog.asOf) throw new Error("Historical faction review has the wrong date");
  const frontIds = new Set(catalog.conflicts.map(front => front.id));
  const unexpectedActors = Object.keys(regional.actors).filter(id => !Object.hasOwn(catalog.actors, id));
  const unexpectedFronts = Object.keys(regional.fronts).filter(id => !frontIds.has(id));
  if (unexpectedActors.length || unexpectedFronts.length) {
    throw new Error("Unexpected historical review IDs: " + [...unexpectedActors, ...unexpectedFronts].join(", "));
  }

  const actors = {};
  const fronts = {};
  for (const actor of Object.values(catalog.actors)) {
    const profile = readIdeology(regional.actors[actor.id], actor.id);
    if (profile.relatedAdministration) {
      const administration = readIdeology(profile.relatedAdministration, actor.id + " administration");
      if (!administration.name?.trim() || !administration.historicalLabel ||
          administration.name !== actor.administrationName) {
        throw new Error("Invalid historical administration review " + actor.id);
      }
      profile.relatedAdministration = administration;
    }
    actors[actor.id] = profile;
  }
  for (const front of catalog.conflicts) {
    const authored = regional.fronts[front.id] || {};
    const plans = catalog.victories[front.id] || {};
    const sides = front.sides.flat();
    if (Object.keys(authored).some(id => !sides.includes(id))) throw new Error("Nonparticipant outcome " + front.id);
    const withdrawalActors = sides.filter(id => authored[id]?.withdrawal != null);
    if (withdrawalActors.length) {
      const id = withdrawalActors[0];
      const terms = authored[id];
      const governments = sides.map(actorId => catalog.actors[actorId]);
      if (withdrawalActors.length !== 1 || front.status !== "occupation" ||
          front.sides.length !== 2 || front.sides.some(side => side.length !== 1) ||
          governments.some(actor => !stateKinds.has(actor?.kind) || !actor.countryKey) ||
          governments[0].countryKey === governments[1].countryKey ||
          !terms.title?.trim() || !Number.isFinite(terms.withdrawal.willingness) ||
          terms.withdrawal.willingness < 0 || terms.withdrawal.willingness > 1 ||
          !front.regions?.length || front.regions.some(region => region.controller || region.administrator || region.contested)) {
        throw new Error("Invalid reported-occupation withdrawal " + front.id);
      }
    }
    fronts[front.id] = {};
    for (const id of sides) {
      const entry = authored[id];
      const plan = plans[id];
      if (!entry || !scopes.has(entry.scope) || !entry.note?.trim() || !hasSources(entry.sources) ||
          (entry.goal !== undefined && (typeof entry.goal !== "string" || !entry.goal.trim())) ||
          entry.policies?.some(policy => !policy.name || !policy.note || !policy.source)) {
        throw new Error("Invalid or missing historical faction outcome " + front.id + "/" + id);
      }
      const native = front.native || front.mode === "stock";
      const outcome = { ...entry, title: entry.title || defaultOutcomeTitle(front, catalog.actors[id]) };
      if (!plan && ["national", "autonomy", "independence", "local"].includes(outcome.scope)) {
        outcome.scope = outcome.policies?.length ? "agreement" : "military";
      }
      if (plan) {
        Object.assign(outcome, { scope: plan.regionalOnly ? "local" : plan.scope, title: plan.title,
          note: plan.government || entry?.note || "Applies the existing documented victory profile for this front." });
      }
      if (native) {
        outcome.scope = "native";
      }
      if (front.status === "occupation") {
        outcome.scope = "occupation";
      }
      fronts[front.id][id] = outcome;
    }
  }
  return { actors, fronts };
}

module.exports = { readHistoricalFactionReview };

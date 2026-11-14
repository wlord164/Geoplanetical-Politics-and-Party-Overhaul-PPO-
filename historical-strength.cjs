"use strict";

const stateKinds = new Set(["government", "state", "state-force", "military-government"]);
const defaultReadiness = .55;

const iissSyria = "https://www.iiss.org/globalassets/global-content---content--migration/research-reports/2025/10/syria-report/pub25_114-csdp_nsags-in-syria_online.pdf";
const euaaSyria = "https://www.euaa.europa.eu/coi/syria/2025/country-focus/1-state-structure-and-governance/13-security-institutions";
const yemen = "https://sanaacenter.org/the-yemen-review/oct-dec-2025/26133";
const unSahel = "https://digitallibrary.un.org/record/4086112/files/S_2025_482-EN.pdf";

const documented = {
  "ucdp-actor-118": {
    gamePersonnel: 80000, readiness: .55, asOf: "2025-06", confidence: "low",
    range: "About 100,000 recruits reported by the military in June 2025",
    note: "Many brigades were still understrength. PPO uses a lower scenario pool for the transitional forces. The stock Syrian roster remains the ceiling for the native opening split.",
    sources: [euaaSyria, iissSyria],
  },
  "ucdp-actor-7514": {
    gamePersonnel: 25000, readiness: .55, asOf: "2025-10", confidence: "medium",
    range: "About 30,000 across the Syrian National Army network",
    note: "The game models this pool on the separate SNA front. It adds no formations to Damascus's native roster.",
    sources: [iissSyria],
  },
  "ucdp-actor-717": { gamePersonnel: 12000, readiness: .60 },
  "per-mpcp": { gamePersonnel: 100, readiness: .45 },
  "ucdp-actor-7922": { gamePersonnel: 500, readiness: .50 },
};

// Comparative pools represent the armed component available in the scenario.
// National stocks, civilians, foreign sponsors and members of unrelated forces are excluded.
const comparative = {
  "sdn-joint-force": [8000, .55],
  "sdn-sla-aw": [3000, .50],
  "mmr-cndf": [800, .50],
  "libya-gnu": [25000, .55],
  "libya-gns": [30000, .55],
  "syr-suwayda-local-groups": [3000, .45],
  "ucdp-actor-6254": [45000, .50],
  "ucdp-actor-7344": [20000, .55],
  "ucdp-actor-671": [5000, .55],
  "ucdp-actor-8622": [2500, .45],
  "is-sahel": [2000, .55],
  "ucdp-actor-7463": [3000, .50],
  "ucdp-actor-7734": [1200, .45],
  "ucdp-actor-8832": [2000, .45],
  "ucdp-actor-4226": [8500, .45],
  "ucdp-actor-4364": [500, .50],
  "ucdp-actor-6287": [650, .45],
  "ucdp-actor-7332": [2500, .45],
  "ucdp-actor-7412": [350, .45],
  "ucdp-actor-7542": [2400, .55],
  "ucdp-actor-7870": [3000, .45],
  "ucdp-actor-8114": [1500, .45],
  "ucdp-actor-8822": [3500, .55],
  "ucdp-actor-9360": [350, .45],
  "ucdp-actor-9371": [500, .45],
  "ucdp-actor-9449": [750, .40],
  "ucdp-actor-9505": [400, .45],
  "ucdp-actor-9529": [600, .45],
  "ucdp-actor-195": [150, .40],
  "ucdp-actor-266": [1200, .45],
  "ucdp-actor-325": [400, .45],
  "ucdp-actor-365": [1800, .50],
  "ucdp-actor-366": [15000, .55],
  "ucdp-actor-208": [2500, .45],
  "warwatch-actor-2138": [400, .45],
  "warwatch-actor-2319": [1400, .45],
  "warwatch-actor-2519": [250, .40],
  "warwatch-actor-2572": [550, .45],
  "warwatch-actor-3096": [750, .45],
  "sen-mfdc-south": [300, .45],
  "warwatch-actor-3242": [5000, .55],
  "warwatch-actor-700": [350, .45],
  "warwatch-actor-703": [1000, .50],
  "phl-dawlah-islamiyah": [150, .45],
  "ucdp-actor-6769": [750, .40],
  "ucdp-actor-7092": [1400, .45],
  "ucdp-actor-772": [4000, .40],
  "ucdp-actor-1151": [4500, .45],
  "ucdp-actor-775": [3800, .45],
  "ucdp-actor-3176": [3000, .40],
  "ucdp-actor-7795": [1600, .45],
  "ucdp-actor-7796": [1500, .45],
  "ucdp-actor-7984": [1800, .45],
  "ucdp-actor-9392": [2600, .45],
  "ucdp-actor-9755": [3000, .45],
  "ucdp-actor-8009": [1300, .40],
  "ucdp-actor-7971": [1000, .40],
  "som-north-east": [3000, .45],
  "som-somaliland-authority": [10000, .55],
};

const contextSources = {
  "ucdp-actor-6254": [yemen],
  "ucdp-actor-7344": [yemen],
  "syr-suwayda-local-groups": ["https://www.euaa.europa.eu/syria-security-situation/2133-security-trends"],
  "is-sahel": [unSahel],
};

function comparativeGroup(actor, fronts) {
  const countries = new Set(fronts.flatMap(front => front.countryKeys));
  const regions = new Set(fronts.flatMap(front => (front.regions || []).map(region => region.key)));
  const reach = Math.max(countries.size, Math.ceil(regions.size / 2), Math.min(3, fronts.length));
  if (actor.kind === "community-group") return [reach > 1 ? 300 : 150, .35];
  if (actor.strategicOnly) return [reach > 1 ? 750 : 250, .40];
  if (actor.kind === "regional-administration" || actor.kind === "de-facto-authority") return [4000, .45];
  if (actor.kind === "regional-armed-group" || actor.kind === "armed-coalition") return [2000, .50];
  return [reach > 1 ? 1000 : 350, .45];
}

function reviewHistoricalStrength(catalog) {
  const frontsByActor = new Map();
  for (const front of [...catalog.conflicts, ...catalog.legacyOnly]) {
    for (const id of front.sides.flat()) {
      const fronts = frontsByActor.get(id) || [];
      fronts.push(front);
      frontsByActor.set(id, fronts);
    }
  }
  for (const actor of [...Object.values(catalog.actors), ...Object.values(catalog.legacyActors)]) {
    const existing = actor.strength || {};
    if (existing.sharedPoolId || existing.gamePersonnel > 0) {
      actor.strength = { readiness: defaultReadiness, ...existing };
      continue;
    }
    if (Object.hasOwn(documented, actor.id)) {
      actor.strength = { readiness: defaultReadiness, ...existing, ...documented[actor.id], basis: "documented-range" };
      continue;
    }
    if (stateKinds.has(actor.kind) && actor.countryKey && !Object.hasOwn(comparative, actor.id)) {
      actor.strength = { readiness: defaultReadiness, ...existing, basis: "native-roster" };
      continue;
    }
    const [gamePersonnel, readiness] = Object.hasOwn(comparative, actor.id) ? comparative[actor.id] :
      comparativeGroup(actor, frontsByActor.get(actor.id) || []);
    actor.strength = { confidence: "low", ...existing, gamePersonnel, readiness, basis: "scenario-estimate",
      ...(contextSources[actor.id] ? { sources: [...new Set([...(existing.sources || []), ...contextSources[actor.id]])] } : {}) };
  }
}

module.exports = { reviewHistoricalStrength };

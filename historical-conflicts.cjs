"use strict";

const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");
const { applyHistoricalCutoff } = require("./historical-cutoff.cjs");
const victoryDefinitions = require("./historical-victories.cjs");
const { readHistoricalFactionReview } = require("./historical-faction-review.cjs");
const { readIdentities } = require("./historical-identities.cjs");
const regionalReview = require("./historical-faction-review.json");
const opening = require("./historical-opening-governments.cjs");
const asiaContested = require("./historical-contested-opening.json");

const asOf = "2026-01-01";
const dataFiles = ["historical-pilots.json", "historical-world.json"];

function readCatalog() {
  const actors = [];
  const conflicts = [];
  const covered = new Map();
  for (const file of dataFiles) {
    const filename = join(__dirname, file);
    if (!existsSync(filename)) throw new Error("Missing conflict data: " + file);
    const data = JSON.parse(readFileSync(filename, "utf8"));
    actors.push(...data.actors);
    conflicts.push(...data.conflicts);
    for (const [id, canonical] of Object.entries(data.covered || {})) covered.set(id, canonical);
  }

  const actorById = new Map();
  for (const actor of actors) {
    if (actorById.has(actor.id) || !actor.name || !/^[a-z\d:-]+$/.test(actor.id)) {
      throw new Error("Invalid or duplicate historical actor: " + actor.id);
    }
    actorById.set(actor.id, actor);
  }
  const result = { version: 2, asOf, conflicts: [], legacyOnly: [], actors: {} };
  const baseline = conflicts.map(conflict => ({ ...conflict }));
  const conflictIds = new Set();
  const audit = JSON.parse(readFileSync(join(__dirname, "historical-cutoff.json"), "utf8"));
  const current = applyHistoricalCutoff(conflicts, actors, audit);
  const currentIds = new Set(current.map(row => row.id));
  for (const conflict of [...current, ...baseline.filter(row => !currentIds.has(row.id))]) {
    const { id, name, countryKeys, sides, sources, status, kind } = conflict;
    if (covered.has(id)) continue;
    if (!id || !name || conflictIds.has(id) || !countryKeys?.length || !sources?.length ||
        !["active", "ceasefire", "occupation", "dormant", "uncertain"].includes(status) ||
        !["civil", "interstate", "nonstate", "insurgency"].includes(kind) ||
        sides?.length !== 2 || sides.some(side => !side.length) ||
        new Set(sides.flat()).size !== sides.flat().length) {
      throw new Error("Invalid or duplicate historical conflict: " + id);
    }
    conflictIds.add(id);
    for (const actorId of new Set([...sides.flat(), ...(conflict.associatedActorIds || []), ...(conflict.regions || []).flatMap(region =>
      [region.controller, region.administrator]).filter(Boolean)])) {
      if (!actorById.has(actorId)) throw new Error(`Unknown historical actor ${actorId} in ${id}`);
      result.actors[actorId] = actorById.get(actorId);
    }
    const keys = countryKeys.map(key => /^\d+$/.test(key) ? String(Number(key)) : String(key));
    const target = currentIds.has(id) ? result.conflicts : result.legacyOnly;
    target.push({ ...conflict, asOf, countryKeys: [...new Set(keys)] });
  }
  for (const [id, canonical] of covered) {
    if (!conflictIds.has(canonical)) throw new Error(`Invalid historical conflict alias ${id}: ${canonical}`);
  }
  if (result.conflicts.filter(row => row.mode === "stock").length !== 1) {
    throw new Error("The historical catalog must reference exactly one stock war");
  }
  const currentActors = new Set(result.conflicts.flatMap(row => [...row.sides.flat(), ...(row.associatedActorIds || []), ...
    (row.regions || []).flatMap(region => [region.controller, region.administrator]).filter(Boolean)]));
  result.legacyActors = Object.fromEntries(Object.entries(result.actors).filter(([id]) => !currentActors.has(id)));
  for (const id of Object.keys(result.legacyActors)) delete result.actors[id];
  for (const actor of [...Object.values(result.actors), ...Object.values(result.legacyActors)]) {
    if (/^\d+$/.test(actor.countryKey)) actor.countryKey = String(Number(actor.countryKey));
    const poolId = actor.strength?.sharedPoolId;
    const owner = poolId && actorById.get(poolId);
    if (poolId && (!owner || poolId === actor.id || owner.strength?.sharedPoolId ||
        !Number.isFinite(owner.strength?.gamePersonnel) || owner.strength.gamePersonnel <= 0 ||
        actor.strength.gamePersonnel != null)) {
      throw new Error("Invalid historical shared force pool: " + actor.id);
    }
    for (const estimate of actor.strength?.components || []) {
      if (!["regulars", "reserves", "allies", "cumulative-recruits", "authorized-positions"].includes(estimate.kind) ||
          !estimate.estimate?.trim() || !/^\d{4}(-\d{2})?(-\d{2})?$/.test(estimate.asOf) ||
          estimate.asOf > asOf || !/^https?:\/\//.test(estimate.source)) {
        throw new Error("Invalid historical strength component: " + actor.id);
      }
    }
  }
  result.victories = {};
  for (const [id, plans] of Object.entries(victoryDefinitions)) {
    const conflict = result.conflicts.find(row => row.id === id);
    if (!conflict || conflict.native || conflict.mode === "stock") throw new Error("Invalid victory conflict " + id);
    result.victories[id] = {};
    for (const [actorId, plan] of Object.entries(plans)) {
      const actor = result.actors[actorId];
      const title = plan.title || actor?.victoryName;
      if (!title || (!plan.regionalOnly && Array.from(title).length > 40) || !conflict.sides.flat().includes(actorId) ||
          !conflict.countryKeys.includes(plan.countryKey) || !plan.regime ||
          !["national", "autonomy", "independence"].includes(plan.scope) ||
          (plan.scope !== "national" && !plan.regionKeys?.length)) throw new Error("Invalid victory profile " + id + " / " + actorId);
      result.victories[id][actorId] = { title, administration: actor.victoryAdministration || actor.administrationName,
        government: actor.victoryGovernment, ...plan };
    }
  }
  for (const front of result.conflicts) {
    if (front.native || front.mode === "stock" || front.status === "occupation") continue;
    for (const [actorId, record] of Object.entries(regionalReview.fronts[front.id] || {})) {
      if (result.victories[front.id]?.[actorId] || record.scope !== "local" ||
          !record.title || !record.countryKey || !record.regionKeys?.length || !record.policies?.length) continue;
      if (!front.sides.flat().includes(actorId) || !front.countryKeys.includes(record.countryKey)) {
        throw new Error("Local victory outside the front: " + front.id + "/" + actorId);
      }
      (result.victories[front.id] ??= {})[actorId] = {
        scope: "autonomy", regionalOnly: true, mixed: true, regime: "regional_council",
        title: record.title, countryKey: record.countryKey, regionKeys: record.regionKeys,
        administration: record.administration || null, government: record.government || null,
        regionalLaws: record.policies,
      };
    }
  }
  result.factionReview = readHistoricalFactionReview(result, regionalReview);
  for (const [id, identity] of Object.entries(readIdentities())) {
    const actor = result.actors[id] || result.legacyActors[id];
    if (!actor) throw new Error("Unknown historical identity: " + id);
    actor.identity = identity;
  }
  const claimedOpeningRegions = new Set();
  for (const [id, government] of Object.entries(opening.governments)) {
    const front = result.conflicts.find(row => row.id === id);
    const sides = front?.sides;
    const party = sides?.findIndex(side => side.includes(government.actorId));
    const actor = result.actors[government.actorId];
    if (!(party >= 0) || !sides[1 - party].includes(government.parentActorId) || !actor ||
        !front.countryKeys.includes(government.parentKey) || actor.countryKey && actor.countryKey !== government.parentKey ||
        !government.provinceKeys.length || !government.sources.length) throw new Error("Invalid opening government " + id);
    for (const key of government.provinceKeys) {
      if (claimedOpeningRegions.has(key)) throw new Error("Conflicting opening province " + key);
      claimedOpeningRegions.add(key);
    }
    front.openingGovernment = government;
    actor.countryKey ??= government.parentKey;
    actor.mapColor = government.color;
    actor.wartimeMapName = government.mapName || actor.shortName || actor.name;
    const regions = new Map((front.regions || []).map(region => [region.key, region]));
    for (const key of government.provinceKeys) {
      regions.set(key, { ...regions.get(key), key, controller: government.actorId, administrator: government.actorId,
        contested: false, note: "Documented wartime administration at the January 2026 opening." });
    }
    front.regions = [...regions.values()];
    front.sources = [...new Set([...front.sources, ...government.sources])];
  }
  for (const [id, contested] of Object.entries({ ...opening.contested, ...asiaContested })) {
    const front = result.conflicts.find(row => row.id === id);
    if (!front) throw new Error("Unknown contested front " + id);
    const regions = new Map((front.regions || []).map(region => [region.key, region]));
    for (const { key, name, dominantActorId, secondaryActorId, dominance, color, source, note } of contested) {
      if (claimedOpeningRegions.has(key) || ![dominantActorId, secondaryActorId].every(actor => !actor || result.actors[actor])) {
        throw new Error("Invalid contested authority " + id + " / " + key);
      }
      regions.set(key, { ...regions.get(key), key, ...(name ? { name } : {}), contested: true,
        ...(dominantActorId ? { controller: dominantActorId, administrator: dominantActorId } : {}),
        dominantActorId, secondaryActorId, dominance, color, note });
      if (source && !front.sources.includes(source)) front.sources = [...front.sources, source];
    }
    front.regions = [...regions.values()];
  }
  return result;
}

function patchHistoricalConflictsWorker(source, replaceOnce) {
  const catalog = readCatalog();
  const worker = ["historical-victory-government.js", "historical-victory-regions.js", "historical-victory-worker.js",
    "historical-conflicts-worker.js"].map(file => readFileSync(join(__dirname, file), "utf8")).join("\n");
  const anchors = [
    ["registerPartyCongressSize();\nconst gpmUprisingOfficialNames",
      "registerPartyCongressSize();\nconst gpmHistoricalCatalog = " + JSON.stringify(catalog) + ";\n" +
      worker + "\nconst gpmUprisingOfficialNames"],
    ["this.sim=b,!o&&gpmUprising.captureStartingIdentities(b)",
      "(o?(gpmSudanRestoreIdentity(b),gpmHistoricalRestoreOpeningCapitals(b)):await gpmHistoricalInitialize(b,this.commitTransportBoundary)),this.sim=b,!o&&gpmUprising.captureStartingIdentities(b)"],
    ['function ol(e){return hae.byCountry&&hae.byCountry[e]||"generic"}',
      'function ol(e){return hae.byCountry&&hae.byCountry[gpmHistoricalCultureCountry(e)]||"generic"}'],
    ['role:e.role||null,_station:e._station||null}:null}function M7o',
      'role:e.role||null,_station:e._station||null,...e.gpmHistoricalPerson?{gpmHistoricalPerson:e.gpmHistoricalPerson}:{}}:null}function M7o'],
    ['(a==="gpm.uprising"?',
      '(a==="gpm.historicalMap"?gpmHistoricalMapView(r):a==="gpm.historicalConflicts"?gpmHistoricalView(r,t.params||{}):a==="gpm.uprising"?'],
    ['gpmUprisingFlags:gpmUprising.flags(e)', 'gpmUprisingFlags:gpmUprising.flags(e),gpmHistoricalFlags:gpmHistoricalFlags(e)'],
    ["function*oxo(e,t){gpmUprising.settle(e);",
      "function*oxo(e,t){gpmHistoricalAdvance(e);gpmUprising.settle(e);"],
    ['e.domesticSectorAvailability[Wn[t]]:1,0,1),R=n?',
      'e.domesticSectorAvailability[Wn[t]]:1,0,1)*(kv(e)?.gpmHistoricalSupplyFactor??1),R=n?'],
    ["function B9(e,t){let a=t?.id;if(!a)return!1;",
      "function B9(e,t){let a=t?.id;if(!a)return!1;gpmHistoricalCloseNative(e,t);"],
    ['e._onWarEnd&&e._onWarEnd(u),gpmUprising.record(e,s,a)',
      'e._onWarEnd&&e._onWarEnd(u),gpmUprising.record(e,s,a),gpmHistoricalCloseNative(e,s,a)'],
  ];
  return anchors.reduce((code, [anchor, replacement]) => replaceOnce(code, anchor, replacement), source);
}

module.exports = { readCatalog, patchHistoricalConflictsWorker };

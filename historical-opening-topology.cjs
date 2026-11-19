"use strict";

const topologyDelta = require("./historical-opening-topology.json");

function applyHistoricalOpeningTopology(stock, delta) {
  const object = stock.objects.provinces;
  if (stock.arcs.length !== delta.baseArcCount || object.geometries.length !== delta.baseProvinceCount) {
    throw new Error("PPO opening provinces require the supported stock province map.");
  }
  const added = [];
  const subdivisions = new Map();
  for (const child of delta.children) {
    const { sourceIndex, sourceKey, anchor, landShare, populationHint, id, name, type, arcs } = child;
    const source = object.geometries[sourceIndex];
    if (source.id !== sourceKey) throw new Error("PPO opening province index changed: " + sourceKey);
    const properties = source.properties;
    const parentPopulation = properties.popw || 0;
    const population = Math.min(parentPopulation, populationHint ?? Math.round(parentPopulation * landShare));
    subdivisions.set(sourceKey, (subdivisions.get(sourceKey) || 0) + population);
    added.push({ id, type, arcs, properties: {
      a2: properties.a2, a3: properties.a3, name, lon: anchor[0], lat: anchor[1], popw: population,
      gpmOpeningSourceProvince: sourceKey, gpmOpeningLandShare: landShare,
    } });
  }
  const originals = object.geometries.map(source => {
    const replacement = delta.replacements[source.id];
    if (!replacement) return source;
    const { anchor, type, arcs } = replacement;
    const properties = { ...source.properties, gpmOpeningSubdivision: true,
      popw: Math.max(0, source.properties.popw - subdivisions.get(source.id)) };
    if (anchor) [properties.lon, properties.lat] = anchor;
    return { ...source, type, arcs, properties };
  });
  const { precision } = delta;
  return { ...stock,
    transform: { ...stock.transform, scale: stock.transform.scale.map(value => value / precision) },
    arcs: [...stock.arcs.map(arc => arc.map(([x, y]) => [x * precision, y * precision])), ...delta.arcs],
    objects: { ...stock.objects, provinces: { ...object, geometries: [...originals, ...added] } },
  };
}

function gpmMigrateHistoricalOpeningOccupation(war, children) {
  if (!war?.occupationCredit || !["active", "suspended"].includes(war.status)) return war;
  let occupationCredit;
  const replacementLists = {};
  for (const [key, related] of children) {
    const occupier = war.occupationCredit[key];
    if (!occupier) continue;
    occupationCredit ??= { ...war.occupationCredit };
    const childKeys = related.map(province => province.__provKey);
    for (const childKey of childKeys) occupationCredit[childKey] = occupier;
    for (const field of ["occupied", "lost"]) {
      if (war[field]?.includes(key)) {
        replacementLists[field] ??= [...war[field]];
        for (const childKey of childKeys) {
          if (!replacementLists[field].includes(childKey)) replacementLists[field].push(childKey);
        }
      }
    }
  }
  return occupationCredit ? { ...war, occupationCredit, ...replacementLists } : war;
}

function gpmMigrateHistoricalOpeningTerritory(world, save) {
  const territory = save.sat?.territory;
  if (!Array.isArray(territory?.provs)) return;
  const subdivisions = new Map();
  for (const province of world.provinces) {
    const parent = province.properties?.gpmOpeningSourceProvince;
    if (!parent) continue;
    const related = subdivisions.get(parent) || [];
    related.push(province);
    subdivisions.set(parent, related);
  }
  const openingKeys = new Set([...subdivisions.values()].flat().map(province => province.__provKey));
  const records = new Map();
  for (const [index, record] of territory.provs.entries()) {
    const key = record?.k;
    if (!key) continue;
    if (typeof key === "string" && key.startsWith("PPO-") && !openingKeys.has(key)) {
      throw new Error(`PPO save territory row ${index} refers to an unknown province ${key}`);
    }
    if ((openingKeys.has(key) || subdivisions.has(key)) && records.has(key)) {
      throw new Error(`PPO save territory has multiple rows for ${key}`);
    }
    records.set(key, record);
  }
  const orders = new Map();
  for (const [countryKey, country] of Object.entries(save.countries || {})) {
    if (!Array.isArray(country?.provOrder)) continue;
    for (const key of country.provOrder) {
      if (typeof key === "string" && key.startsWith("PPO-") && !openingKeys.has(key)) {
        throw new Error(`PPO save country ${countryKey} refers to an unknown province ${key}`);
      }
      if (!openingKeys.has(key) && !subdivisions.has(key)) continue;
      if (orders.has(key)) throw new Error(`PPO save has multiple province order entries for ${key}`);
      orders.set(key, countryKey);
    }
  }
  for (const childKey of openingKeys) {
    if (!records.has(childKey) && orders.has(childKey)) {
      const province = world.provByKey.get(childKey);
      if (orders.get(childKey) !== String(province.__polityKey || province.__countryKey)) {
        throw new Error(`PPO save province ${childKey} has a country order entry without its territory row`);
      }
    }
  }
  const wars = save.sat.wars;
  const aiWars = save.aiWars?.wars;
  const activeWars = [...(Array.isArray(wars?.wars) ? wars.wars : []),
    ...(Array.isArray(aiWars) ? aiWars.map(entry => entry?.[1]) : [])]
    .filter(war => war?.status === "active" || war?.status === "suspended");
  for (const war of activeWars) {
    const ids = [...Object.keys(war.occupationCredit || {}),
      ...(Array.isArray(war.occupied) ? war.occupied : []), ...(Array.isArray(war.lost) ? war.lost : [])];
    for (const key of ids) {
      if (typeof key === "string" && key.startsWith("PPO-") && !openingKeys.has(key)) {
        throw new Error(`PPO save war ${war.id ?? "(unknown)"} refers to an unknown province ${key}`);
      }
      if (openingKeys.has(key) && !records.has(key) && !orders.has(key)) {
        throw new Error(`PPO save war ${war.id ?? "(unknown)"} refers to province ${key} without a territory row or country order`);
      }
    }
  }
  const children = new Map();
  const newRows = [];
  const replacements = new Map();
  for (const [key, related] of subdivisions) {
    const missing = related.filter(province => !records.has(province.__provKey) && !orders.has(province.__provKey));
    if (!missing.length) continue;
    const before = records.get(key);
    const source = world.provByKey.get(key);
    if (!before && orders.has(key) && orders.get(key) !== String(source.__polityKey || source.__countryKey)) {
      throw new Error(`PPO save parent province ${key} has a country order entry without its territory row`);
    }
    children.set(key, missing);
    const carriesOccupation = activeWars.some(war => war.occupationCredit?.[key]);
    if (!before) {
      if (carriesOccupation) {
        for (const child of missing) newRows.push({ k: child.__provKey });
      }
      continue;
    }
    // Existing children have already received their share. Split the saved
    // remainder between the parent and the newly introduced children only.
    const total = [source, ...missing].reduce((sum, province) => sum + (province.__pop || 0), 0);
    const landShare = 1 - related.filter(province => records.has(province.__provKey) || orders.has(province.__provKey))
      .reduce((sum, province) => sum + province.properties.gpmOpeningLandShare, 0);
    const inherited = Object.fromEntries(["sov", "pol", "dead", "claimants"]
      .filter(field => Object.hasOwn(before, field)).map(field => [field, before[field]]));
    const parent = { ...before };
    for (const child of missing) {
      const split = { k: child.__provKey, ...inherited };
      const share = total > 0 ? (child.__pop || 0) / total : child.properties.gpmOpeningLandShare / landShare;
      for (const field of ["pop", "gdp"]) {
        if (!Number.isFinite(before[field]) || before[field] < 0) continue;
        split[field] = before[field] * share;
        parent[field] = Math.max(0, parent[field] - split[field]);
      }
      if (Object.keys(split).length > 1 || carriesOccupation) newRows.push(split);
    }
    replacements.set(key, parent);
  }
  if (!children.size) return;
  if (newRows.length) {
    const rows = territory.provs.map(record => replacements.get(record?.k) || record);
    save.sat = { ...save.sat, territory: { ...territory, provs: [...rows, ...newRows] } };
  }
  if (Array.isArray(wars?.wars)) {
    save.sat.wars = { ...wars, wars: wars.wars.map(war => gpmMigrateHistoricalOpeningOccupation(war, children)) };
  }
  if (Array.isArray(save.aiWars?.wars)) {
    save.aiWars = { ...save.aiWars, wars: save.aiWars.wars.map(([id, war]) =>
      [id, gpmMigrateHistoricalOpeningOccupation(war, children)]) };
  }
}

const declaration = `const gpmHistoricalOpeningTopology = ${JSON.stringify(topologyDelta)};\n${applyHistoricalOpeningTopology.toString()}\n`;

function patchHistoricalOpeningTopology(source, replaceOnce, target) {
  const renderer = target === "renderer";
  const stock = renderer ? "sx" : "uoe";
  const world = renderer ? "function Ffe(){let e=W4(vh,vh.objects.countries)," :
    "function bRt(){let e=Ghe(MHe,MHe.objects.countries),";
  const stockCopy = `t={...${stock},objects:{...${stock}.objects,provinces:{...${stock}.objects.provinces,geometries:${stock}.objects.provinces.geometries.map(`;
  const openingCopy = stockCopy.replaceAll(stock, "openingTopology");
  let result = replaceOnce(source, world + stockCopy, declaration + world +
    `openingTopology=applyHistoricalOpeningTopology(${stock},gpmHistoricalOpeningTopology),` + openingCopy);
  if (renderer) {
    // Fill and borders must use the same vertices on both sides of a subdivided province.
    result = replaceOnce(result, "p=(_,P=0)=>{let R=_;if(P)",
      "p=(_,P=0,keepVertices=false)=>{let R=_;if(P)");
    result = replaceOnce(result, "N*N+O*O<a||(M.push([I,A]),x=I,C=A)",
      "(!keepVertices&&N*N+O*O<a)||(M.push([I,A]),x=I,C=A)");
    result = replaceOnce(result, "A=[],N=[],O=[];m(p(L[0],I),I,A,N);for(let B=1;B<L.length;B++)L[B].length<4||(O.push(A.length/2),m(p(L[B],I),I,A,N))",
      "A=[],N=[],O=[],keepVertices=!!(_.properties?.gpmOpeningSubdivision||_.properties?.gpmOpeningSourceProvince);m(p(L[0],I,keepVertices),I,A,N);for(let B=1;B<L.length;B++)L[B].length<4||(O.push(A.length/2),m(p(L[B],I,keepVertices),I,A,N))");
  } else {
    const validator = "function HCt(e,t){let a=t.sat?.territory";
    result = replaceOnce(result, validator, gpmMigrateHistoricalOpeningOccupation.toString() + "\n" +
      gpmMigrateHistoricalOpeningTerritory.toString() +
      "\nfunction HCt(e,t){gpmMigrateHistoricalOpeningTerritory(e.world,t);let a=t.sat?.territory");
  }
  return result;
}

module.exports = { applyHistoricalOpeningTopology, gpmMigrateHistoricalOpeningTerritory, patchHistoricalOpeningTopology };

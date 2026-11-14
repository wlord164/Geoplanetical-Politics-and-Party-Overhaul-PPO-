"use strict";

const topologyDelta = require("./historical-opening-topology.json");

function applyHistoricalOpeningTopology(stock) {
  const delta = gpmHistoricalOpeningTopology;
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
        replacementLists[field].push(...childKeys);
      }
    }
  }
  return occupationCredit ? { ...war, occupationCredit, ...replacementLists } : war;
}

function gpmMigrateHistoricalOpeningTerritory(world, save) {
  const territory = save.sat?.territory;
  if (!Array.isArray(territory?.provs)) return;
  const children = new Map();
  const known = new Set(territory.provs.map(province => province?.k));
  for (const country of Object.values(save.countries || {})) {
    if (Array.isArray(country?.provOrder)) {
      for (const key of country.provOrder) known.add(key);
    }
  }
  for (const province of world.provinces) {
    const key = province.properties?.gpmOpeningSourceProvince;
    if (!key) continue;
    if (known.has(province.__provKey)) return;
    const related = children.get(key) || [];
    related.push(province);
    children.set(key, related);
  }
  if (!children.size) return;
  const records = new Map(territory.provs.filter(record => record?.k).map(record => [record.k, record]));
  for (const [key, related] of children) {
    const before = records.get(key);
    if (!before) continue;
    const source = world.provByKey.get(key);
    const total = [source, ...related].reduce((sum, province) => sum + (province.__pop || 0), 0);
    const inherited = Object.fromEntries(["sov", "pol", "dead", "claimants"]
      .filter(field => Object.hasOwn(before, field)).map(field => [field, before[field]]));
    const parent = { ...before };
    for (const child of related) {
      const split = { k: child.__provKey, ...inherited };
      const share = total > 0 ? (child.__pop || 0) / total : child.properties.gpmOpeningLandShare;
      for (const field of ["pop", "gdp"]) {
        if (!Number.isFinite(before[field]) || before[field] < 0) continue;
        split[field] = before[field] * share;
        parent[field] -= split[field];
      }
      if (Object.keys(split).length > 1) records.set(split.k, split);
    }
    records.set(key, parent);
  }
  const wars = save.sat.wars;
  save.sat = { ...save.sat, territory: { ...territory, provs: [...records.values()] } };
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
  const stock = renderer ? "t_" : "aae";
  const world = renderer ? "function d0e(){let e=o3(Zm,Zm.objects.countries)," :
    "function vPt(){let e=lye(dFe,dFe.objects.countries),";
  const stockCopy = `t={...${stock},objects:{...${stock}.objects,provinces:{...${stock}.objects.provinces,geometries:${stock}.objects.provinces.geometries.map(`;
  const openingCopy = stockCopy.replaceAll(stock, "openingTopology");
  let result = replaceOnce(source, world + stockCopy, declaration + world +
    `openingTopology=applyHistoricalOpeningTopology(${stock}),` + openingCopy);
  if (renderer) {
    // Fill and borders must use the same vertices on both sides of a subdivided province.
    result = replaceOnce(result, "p=(_,R=0)=>{let P=_;if(R)",
      "p=(_,R=0,keepVertices=false)=>{let P=_;if(R)");
    result = replaceOnce(result, "N*N+O*O<a||(M.push([A,T]),x=A,C=T)",
      "(!keepVertices&&N*N+O*O<a)||(M.push([A,T]),x=A,C=T)");
    result = replaceOnce(result, "T=[],N=[],O=[];m(p(L[0],A),A,T,N);for(let $=1;$<L.length;$++)L[$].length<4||(O.push(T.length/2),m(p(L[$],A),A,T,N))",
      "T=[],N=[],O=[],keepVertices=!!(_.properties?.gpmOpeningSubdivision||_.properties?.gpmOpeningSourceProvince);m(p(L[0],A,keepVertices),A,T,N);for(let $=1;$<L.length;$++)L[$].length<4||(O.push(T.length/2),m(p(L[$],A,keepVertices),A,T,N))");
  } else {
    const validator = "function Yvt(e,t){let a=t.sat?.territory";
    result = replaceOnce(result, validator, gpmMigrateHistoricalOpeningOccupation.toString() + "\n" +
      gpmMigrateHistoricalOpeningTerritory.toString() +
      "\nfunction Yvt(e,t){gpmMigrateHistoricalOpeningTerritory(e.world,t);let a=t.sat?.territory");
  }
  return result;
}

module.exports = { patchHistoricalOpeningTopology };

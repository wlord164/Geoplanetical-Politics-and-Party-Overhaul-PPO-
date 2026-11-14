const gpmStockSurfaceFields = ["roadKm", "motorwayKm", "railKm",
  "roadCeilingKm", "motorwayCeilingKm", "railCeilingKm", "observedRoadKm", "observedMotorwayKm"];
const gpmStockSurfaceSeeds = new Map();

function gpmHistoricalProvinceTransport(world, seeds, saved) {
  const bySource = new Map();
  for (const province of world.provinces) {
    const source = province.properties?.gpmOpeningSourceProvince;
    if (!source) continue;
    if (!bySource.has(source)) bySource.set(source, [world.provByKey.get(source)]);
    bySource.get(source).push(province);
  }
  for (const [key, parts] of bySource) {
    const seed = gpmStockSurfaceSeeds.get(key) || seeds.get(key);
    if (!seed || !parts[0]) throw new Error("Missing opening province transport source: " + key);
    gpmStockSurfaceSeeds.set(key, seed);
    const population = parts.reduce((total, part) => total + Number(part.properties.popw || 0), 0);
    const childrenShare = parts.slice(1).reduce((total, part) => total + part.properties.gpmOpeningLandShare, 0);
    const oldSave = saved && saved[key] && parts.slice(1).every(part => !Object.hasOwn(saved, part.__provKey));
    const savedSeed = oldSave ? { ...saved[key] } : null;
    for (const [index, part] of parts.entries()) {
      const share = population ? Number(part.properties.popw || 0) / population :
        index ? part.properties.gpmOpeningLandShare : 1 - childrenShare;
      const values = Object.fromEntries(gpmStockSurfaceFields.map(field => [field, (seed[field] || 0) * share]));
      seeds.set(part.__provKey, Object.freeze({ ...seed, ...values, id: part.__provKey }));
      if (savedSeed) {
        saved[part.__provKey] = { ...savedSeed, roadKm: savedSeed.roadKm * share, motorwayKm: savedSeed.motorwayKm * share,
          railKm: savedSeed.railKm * share };
      }
    }
  }
}

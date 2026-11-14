function gpmHistoricalClimateProvinceMap(world, source) {
  const provinces = world.provinces;
  const bytes = source instanceof ArrayBuffer
    ? new Uint8Array(source)
    : new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
  const headerSize = 32;
  const current = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const stockCount = current.getUint32(20, true);
  if (stockCount === provinces.length) return source;
  const width = current.getUint32(12, true);
  const height = current.getUint32(16, true);
  if (stockCount > provinces.length || provinces.length > 65535 ||
      current.getUint32(24, true) !== width * height * 2 || bytes.length !== headerSize + width * height * 2) {
    throw new Error("Incompatible climate raster for opening province boundaries");
  }
  const childrenBySource = new Map();
  for (let index = stockCount; index < provinces.length; index++) {
    const child = provinces[index];
    const original = world.provByKey.get(child.properties?.gpmOpeningSourceProvince);
    if (!original || original.__provId >= stockCount || child.__provId !== index) {
      throw new Error("Opening province source is missing for climate: " + child.__provKey);
    }
    const children = childrenBySource.get(original.__provId + 1) || [];
    children.push(child);
    childrenBySource.set(original.__provId + 1, children);
  }
  const adjusted = bytes.slice();
  const raster = new DataView(adjusted.buffer);
  raster.setUint32(20, provinces.length, true);
  for (let index = 0; index < width * height; index++) {
    const offset = headerSize + 2 * index;
    const children = childrenBySource.get(raster.getUint16(offset, true));
    if (!children) continue;
    const lon = (index % width + 0.5) * 360 / width - 180;
    const lat = (Math.floor(index / width) + 0.5) * 180 / height - 90;
    const child = children.find(province => w3(province, lon, lat));
    if (child) raster.setUint16(offset, child.__provId + 1, true);
  }
  // The stock climate model samples the centroid for sub-grid provinces.
  return adjusted;
}

const gpmHistoricalStockHazardProvinces = new Map();

function gpmHistoricalProvinceHazards(world, hazards) {
  const bySource = new Map();
  for (const province of world.provinces) {
    const sourceKey = province.properties?.gpmOpeningSourceProvince;
    if (!sourceKey) continue;
    const parts = bySource.get(sourceKey) || [world.provByKey.get(sourceKey)];
    parts.push(province);
    bySource.set(sourceKey, parts);
  }
  for (const [key, parts] of bySource) {
    const source = gpmHistoricalStockHazardProvinces.get(key) || hazards.get(key);
    if (!source || parts.some(part => !part)) throw new Error("Missing opening province hazard source: " + key);
    gpmHistoricalStockHazardProvinces.set(key, source);
    const population = parts.reduce((sum, part) => sum + (part.properties.popw || 0), 0);
    const landShare = parts.slice(1).reduce((sum, part) => sum + part.properties.gpmOpeningLandShare, 0);
    for (const [index, part] of parts.entries()) {
      const fraction = population > 0 ? (part.properties.popw || 0) / population :
        index === 0 ? 1 - landShare : part.properties.gpmOpeningLandShare;
      hazards.set(part.__provKey, Object.freeze({
        ...source, provinceKey: part.__provKey, populationWeight: source.populationWeight * fraction,
      }));
    }
  }
}

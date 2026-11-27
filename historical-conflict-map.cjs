"use strict";

const arakanOpeningArea = require("./historical-arakan-opening-area.json");
const openingControlAreas = [{
  ...arakanOpeningArea, id: "arakan-opening", frontId: "myanmar-arakan-conflict", color: "#9d7245",
}, ...[
  ...require("./historical-kivu-opening-areas.json"),
  ...require("./historical-myanmar-town-opening-areas.json"),
  ...require("./historical-syria-town-opening-areas.json"),
].map(area => ({ ...area, allowUnknownController: true }))];
const compactFactionNames = {
  "mmr-aa": "AA", "mmr-kio": "KIO", "mmr-knu": "KNU", "mmr-cnf": "CHIN", "sdn-rsf": "RSF",
  "ucdp-actor-8885": "AFC/M23", "syr-suwayda-local-groups": "SNG", "ucdp-actor-6288": "AANES",
};

const labelPathCacheLimit = 256;

const style = `
  .gpm-history-map-control { position: relative; align-self: center; }
  .gpm-history-map-control[hidden], .gpm-history-map-legend[hidden],
  .gpm-history-map-popup[hidden] { display: none; }
  .gpm-history-map-toggle { gap: 5px; padding-inline: 7px; }
  .gpm-history-map-toggle[aria-expanded="true"] { color: #ffcf82; }
  .gpm-history-map-legend, .gpm-history-map-popup {
    display: grid; gap: 6px; padding: 9px 11px; width: max-content; max-width: min(300px, 90vw);
    color: var(--text, #eff3f7); background: #172029; border: 1px solid #56606b;
    border-radius: 5px; box-shadow: 0 3px 12px #0009; font-size: 12px;
  }
  .gpm-history-map-legend { position: absolute; top: calc(100% + 5px); left: 0; }
  .gpm-history-map-legend label, .gpm-history-map-legend span { display: flex; align-items: center; gap: 6px; }
  .gpm-history-map-legend i { display: inline-block; width: 17px; border-top: 2px solid var(--ink); }
  .gpm-history-map-legend small { color: var(--text-2, #aab6c4); }
  .gpm-history-map-locations { position: fixed; inset: 0; z-index: 26; pointer-events: none; }
  .gpm-history-map-locations[hidden] { display: none; }
  .gpm-history-map-marker {
    position: absolute; left: 0; top: 0; margin: -10px 0 0 -10px; width: 20px; height: 20px;
    display: grid; place-items: center; padding: 0; border: 0; color: #121a22;
    background: transparent; cursor: pointer; pointer-events: auto; will-change: transform;
  }
  .gpm-history-map-marker[hidden] { display: none; }
  .gpm-history-map-marker::before {
    content: ""; width: 9px; height: 9px; background: var(--ink); transform: rotate(45deg);
    border: 1px solid #121a22; box-shadow: 0 0 0 1px var(--ink), 0 2px 6px #000b;
  }
  .gpm-history-map-marker:is(:hover, :focus-visible)::before { outline: 2px solid #fff; outline-offset: 2px; }
  .gpm-history-faction-label {
    position: absolute; inset: 0 auto auto 0; pointer-events: none;
  }
  .gpm-history-faction-label[hidden] { display: none; }
  .gpm-history-faction-label button {
    position: absolute; inset: 0 auto auto 0; padding: 0;
    border: 0; background: transparent; color: transparent; font-size: 0;
    pointer-events: auto; cursor: pointer;
  }
  .gpm-history-faction-label button:focus-visible { outline: 1px solid #ffdf9d; }
  .gpm-history-faction-label button[hidden] { display: none; }
  .gpm-history-map-popup { position: fixed; z-index: 27; max-height: 300px; overflow: auto; }
  .gpm-history-map-popup button.k {
    height: auto; min-height: 2rem; padding-block: 5px; line-height: 1.25;
    text-align: start; white-space: normal; overflow-wrap: anywhere;
  }
  .gpm-history-map-marker[data-selected-war]::before { outline: 2px solid #ffe1a0; outline-offset: 2px; }
  .gpm-history-map-marker[data-selected-war] { z-index: 1; }
  .gpm-history-map-popup small { display: block; }
  #tooltip.gpm-history-map-tip { max-width: min(300px, 90vw); white-space: normal; overflow-wrap: anywhere; }
  .gpm-history-map-tip small { display: block; }
`;

const colors = {
  contested: 0x6f7a84,
  controlled: 0x6f7a84,
  reported: 0x6f7a84,
  captured: 0xb6a153,
  active: 0xfb7665,
  occupation: 0xc3a1fa,
  ceasefire: 0x69d0b8,
  suspended: 0x9bacbc,
  selected: 0xffe1a0,
};

function gpmHistoricalPrimaryFront(fronts) {
  return fronts.find(front => front.captured && !front.contested) ||
    fronts.find(front => front.contested && front.control?.length) ||
    fronts.find(front => front.contested && front.reportedDominantId) ||
    fronts.find(front => front.contested && (front.dominantKey || front.dominantColor)) ||
    fronts.find(front => front.contested) ||
    fronts.find(front => front.controlled) || fronts[0];
}

function gpmHistoricalOrderedFronts(fronts, primary = gpmHistoricalPrimaryFront(fronts)) {
  return primary ? [primary, ...fronts.filter(front => front !== primary)] : [];
}

function gpmHistoricalMapStatus(fronts) {
  return ["active", "occupation", "ceasefire", "suspended"].find(status =>
    fronts.some(front => front.status === status)) || "suspended";
}

function gpmHistoricalMapInk(status) {
  return "#" + gpmHistoricalMapColors[status].toString(16).padStart(6, "0");
}

function gpmHistoricalMapVisible(globe) {
  return globe?._mode === "game" && globe.activeBody === "earth" && !globe._cinema && !globe._militaryMode &&
    !Se.warRoomActive && !Se.resRoomActive && !Se.energyRoomActive && !Se.baseRoomActive &&
    !Se.transportRoomActive && !Se.telecomRoomActive && !Se.publicFacilityPlannerActive && !Se.gpmRegionalActive && !tla();
}

function gpmHistoricalMapName(actor) {
  return actor?.mapName || actor?.shortName || actor?.name;
}

function gpmHistoricalNativeMapName(key, fallback) {
  const actor = gpmHistoricalNativeMapActor(key);
  return gpmHistoricalMapName(actor) || (key === "gpm-historical-sdn-rsf" ? "Rapid Support Forces" : fallback);
}

function gpmHistoricalNativeMapFlag(key, fallback) {
  b9();
  return OE.get(gd(key))?.url || gpmHistoricalAssetUrl(gpmHistoricalNativeMapActor(key)?.identity?.flag?.asset) || fallback;
}

function gpmHistoricalNativeMapActor(key) {
  if (typeof key !== "string" || !key.startsWith("gpm-historical-") || typeof Me === "undefined") return null;
  const state = Me?._gpmHistoricalMap;
  const id = state?.data?.nativeCountryActors?.[key] || (key === "gpm-historical-sdn-rsf" ? "sdn-rsf" : null);
  return id ? state?.actors[id] : null;
}

function gpmHistoricalCountryRetired(globe, key) {
  // The world can keep a projected feature after its country leaves the simulation.
  return key.startsWith("gpm-historical-") && globe._polCountryRows && !globe._polCountryRows.has(key);
}

function gpmHistoricalNationLabel(globe, feature) {
  const key = feature.__key;
  if (globe._gpmHistoricalMap?.data?.nativeCountryActors?.[key] || gpmHistoricalCountryRetired(globe, key)) return "";
  return gpmHistoricalNativeMapName(key, feature.__name || "").toLocaleUpperCase(ee());
}

function gpmHistoricalLabelOwnerAt(globe, lon, lat) {
  const state = globe._gpmHistoricalMap;
  if (!state?.nativeLabelCells?.has(gbe(Tae(qq(lon)), Eae(lat)))) return -1;
  const province = globe.world.provinces[globe._provinceAt(lon, lat)];
  const key = province?.__polityKey || province?.__countryKey;
  if (!state.data.nativeCountryActors[key]) return -1;
  const feature = globe.world.byKey?.get(key);
  return Number.isInteger(feature?.__idx) ? feature.__idx : -1;
}

function gpmHistoricalLabelCells(provinces, nativeActors) {
  const cells = new Set();
  let index = fbe.get(provinces);
  if (!index || index.count !== provinces.length) {
    index = { ...T0t(provinces), count: provinces.length };
    fbe.set(provinces, index);
  }
  for (const [cell, entries] of index.buckets) {
    if (entries.some(({ id }) => nativeActors[provinces[id].__polityKey || provinces[id].__countryKey])) cells.add(cell);
  }
  return cells;
}

function gpmHistoricalProvinceColor(value) {
  if (Array.isArray(value) && value.length === 3 && value.every(Number.isFinite)) {
    return value.map(channel => Math.round(Math.max(0, Math.min(255, channel))));
  }
  if (typeof value !== "string") return null;
  if (/^#[0-9a-f]{6}$/i.test(value)) return [1, 3, 5].map(offset => Number.parseInt(value.slice(offset, offset + 2), 16));
  const hsl = /^hsl\((\d+) (\d+)% (\d+)%\)$/.exec(value);
  if (!hsl) return null;
  const [, h, s, l] = hsl.map(Number);
  const light = l / 100;
  const chroma = s / 100 * Math.min(light, 1 - light);
  return [0, 8, 4].map(offset => {
    const k = (offset + h / 30) % 12;
    return Math.round(255 * (light - chroma * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  });
}

function gpmHistoricalAreaMask(globe, state, area) {
  const masks = state.controlMasks ||= new Map();
  if (masks.has(area.id)) return masks.get(area.id);
  const { bounds: [west, south, east, north], geometry } = area;
  const raster = document.createElement("canvas");
  raster.width = 384;
  raster.height = 768;
  const ctx = raster.getContext("2d");
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  ctx.fillStyle = area.color;
  ctx.beginPath();
  for (const polygon of polygons) {
    for (const ring of polygon) {
      ring.forEach(([lon, lat], index) => {
        const x = (lon - west) / (east - west) * raster.width;
        const y = (lat - south) / (north - south) * raster.height;
        if (index) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      ctx.closePath();
    }
  }
  ctx.fill("evenodd");
  const bytes = new Uint8Array(ctx.getImageData(0, 0, raster.width, raster.height).data);
  const index = gpmHistoricalOpeningAreas.findIndex(entry => entry.id === area.id);
  const atlasWidth = raster.width * gpmHistoricalOpeningAreas.length;
  if (!state.controlAtlas) {
    const pixels = new Uint8Array(atlasWidth * raster.height * 4);
    const texture = new cn(pixels, atlasWidth, raster.height, Na);
    texture.minFilter = jn;
    texture.magFilter = jn;
    state.controlAtlas = { pixels, texture };
  }
  const rowLength = raster.width * 4;
  for (let row = 0; row < raster.height; row++) {
    state.controlAtlas.pixels.set(bytes.subarray(row * rowLength, (row + 1) * rowLength),
      (row * atlasWidth + index * raster.width) * 4);
  }
  state.controlAtlas.texture.needsUpdate = true;
  const mask = { widthDegrees: east - west, bounds: [west, south, 1 / (east - west), 1 / (north - south)],
    contains(lon, lat) {
      const x = Math.floor((lon - west) / (east - west) * raster.width);
      const y = Math.floor((lat - south) / (north - south) * raster.height);
      return x >= 0 && x < raster.width && y >= 0 && y < raster.height &&
        bytes[(y * raster.width + x) * 4 + 3] === 255;
    } };
  masks.set(area.id, mask);
  return mask;
}

function gpmHistoricalPaintFills(globe, state) {
  const uniforms = globe.fillMat?.uniforms;
  if (!uniforms || !globe._provDataW || !globe._provDataH) return;
  state.paletteSignature = globe._polCountrySignature;
  if (!state.fills.size && !state.controlAreas.size && !state.fillTexture) return;
  if (!state.fillTexture) {
    const width = globe._provDataW;
    const height = globe._provDataH;
    state.fillPixels = new Uint8Array(width * height * 4);
    state.fillTexture = new cn(state.fillPixels, width, height, Na);
    state.fillTexture.minFilter = jn;
    state.fillTexture.magFilter = jn;
  }
  const palette = globe.politicalPalette();
  const color = (key, fallback) => palette.get(key)?.fill || gpmHistoricalProvinceColor(fallback);
  const pixels = state.fillPixels;
  pixels.fill(0);
  let count = 0;
  for (const [provinceId, { front, ownerKey }] of state.fills) {
    const actor = state.actors[front.controllerId || front.administratorId];
    const owner = color(ownerKey);
    const faction = !front.captured && gpmHistoricalProvinceColor(front.dominantColor || (!front.dominantKey && actor?.color));
    const primary = front.contested && !front.controllerId && !front.dominantKey && !front.dominantColor
      ? [119, 125, 130] : faction || color(front.dominantKey || front.occupationKey || actor?.countryKey, actor?.color) || owner;
    if (!primary || provinceId < 0 || provinceId * 4 >= pixels.length) continue;
    const secondary = color(front.secondaryKey) || owner;
    const opposing = secondary && secondary.some((channel, index) => channel !== primary[index])
      ? secondary : primary.map(channel => (channel + 116) / 2);
    const dominance = Number.isFinite(front.dominance) ? Math.max(.5, Math.min(.81, front.dominance)) : .67;
    const ink = front.captured ? primary.map(channel => Math.round(channel + .10 * (255 - channel))) :
      front.controlled ? primary : primary.map((channel, index) => {
      const blend = channel * dominance + opposing[index] * (1 - dominance);
      return Math.round(.64 * blend + .36 * 143);
    });
    pixels.set([...ink, front.captured || front.controlled ? 255 : 239], provinceId * 4);
    count++;
  }
  state.hasFills = count > 0;
  state.fillTexture.needsUpdate = true;
  uniforms.gpmHistoricalFill.value = state.fillTexture;
  state.presentationDirty = true;
}

function gpmHistoricalMapOpenFront(front, provinceKey = null, actorId = null) {
  const state = Se._gpmHistory;
  if (state?.session === Ve && state.busy) return;
  if (Se._gpmFactionInspector) Se.closeInspector();
  gpmCloseRegionalControlBox(Se);
  const map = Me?._gpmHistoricalMap;
  if (map) map.selectedWar = front.id;
  Se._gpmHistoryMapSelection = { session: Ve, id: front.id, provinceKey, actorId };
  if (Se.activeModule === "military" && Se._subSel.military === "historical-conflicts") {
    gpmHistoricalConflictsView(Y("content-body")?.querySelector("[data-gpm-history]"), Se, Ve);
  } else {
    Se.openModule("military", "historical-conflicts");
  }
}

function gpmHistoricalSelectMapFront(front, region, pointer, opener) {
  if ((front.contested || front.captured) && region.provinceKey) {
    const map = Me?._gpmHistoricalMap;
    if (map) map.selectedWar = front.id;
    gpmOpenRegionalControlBox(Se, Ve, {
      region, x: pointer?.clientX, y: pointer?.clientY, opener,
      mode: Xsa("earth"), map,
    });
  } else {
    gpmHistoricalMapOpenFront(front, region.provinceKey);
  }
}

function gpmHistoricalFrontsAt(region, mode, area) {
  if (area) return area.fronts;
  return mode === "atlas" ? region?.politicalFronts || [] : region?.strategicFronts || [];
}

function gpmHistoricalFactionCountry(globe, actorId) {
  const key = globe._gpmHistoricalMap?.actors[actorId]?.countryKey;
  const feature = key && globe.world.byKey?.get(key);
  return feature?.__playable ? feature : null;
}

function gpmOpenHistoricalCountry(globe, country) {
  globe.setSelected(country.__key);
  Se.openInspector(country.__key, Ve, OR, m6e(country));
}

function gpmHistoricalFactionActions(globe, state, actorId) {
  const actor = gpmHistoricalNamedFaction(state, actorId);
  if (!actor) return null;
  const country = gpmHistoricalFactionCountry(globe, actorId);
  const holding = state.holdings?.get(actorId);
  if (!country && !holding) return null;
  return {
    id: actorId,
    openLabel: country ? "Open " + (actorId === "mmr-knu" ? "Karen National Union" : actor.name) : null,
    zoomLabel: holding ? "Zoom to " + (actor.shortName || actor.name) + " territory" : null,
  };
}

function gpmHistoricalRunFactionAction(globe, state, actorId, action) {
  if (!gpmHistoricalFactionActions(globe, state, actorId)) return;
  if (action === "open") {
    const country = gpmHistoricalFactionCountry(globe, actorId);
    if (!country) return;
    gpmCloseRegionalControlBox(Se);
    gpmOpenHistoricalCountry(globe, country);
  } else if (action === "zoom") {
    const holding = state.holdings?.get(actorId);
    if (!holding) return;
    gpmCloseRegionalControlBox(Se);
    // A country may include an occupied or disputed outlying province. Center on verified land.
    const [lon, lat] = holding.coords;
    const distance = Xsa("earth") === "atlas" ? 2.04 : 2.17;
    globe.focusLatLon(lon, lat, distance);
  }
}

function gpmHistoricalWarHighlight(globe, state, id) {
  state.selectionDirty = false;
  const rings = [];
  if (id) {
    for (const [key, region] of state.regions) {
      const province = globe.world.provByKey?.get(key);
      const territory = state.fills?.get(province?.__provId)?.front;
      if (!region.strategicFronts.some(front => front.id === id && !front.crimeReport && front !== territory)) continue;
      const shape = province?.geometry;
      if (shape?.type === "Polygon") rings.push(...shape.coordinates);
      if (shape?.type === "MultiPolygon") rings.push(...shape.coordinates.flat());
    }
  }
  let border = state.borders.get("selected");
  if (border || rings.length) {
    const geometry = { type: "MultiLineString", coordinates: rings };
    if (border) IRt(border, geometry, ht * 1.0022, .018);
    else {
      border = VG(globe, geometry, { radius: ht * 1.0022, minDeg: .018, order: 44, color: gpmHistoricalMapColors.selected,
        width: 1.4, opacity: .88, casingColor: 0x111920, casingWidth: 2.2, casingOpacity: .50 });
      state.borders.set("selected", border);
    }
    GT(border, state.showSituation && border.count > 0);
  }
  for (const marker of state.markers || []) {
    const picked = !!id && marker.el._gpmHistoricalLocation?.fronts.some(front => front.id === id);
    marker.el.toggleAttribute("data-selected-war", !!picked);
  }
}

function gpmHistoricalOpenFaction(globe, item, actorId) {
  const state = globe._gpmHistoricalMap;
  const faction = state.actors[actorId];
  const nativeKey = Object.keys(state.data.nativeCountryActors || {}).find(key => state.data.nativeCountryActors[key] === actorId) ||
    (faction?.kind === "uprising" && faction.countryKey);
  const country = nativeKey && globe.world.byKey?.get(nativeKey);
  if (country?.__playable) {
    globe.focusCountry(country);
    gpmOpenHistoricalCountry(globe, country);
    return;
  }
  const front = item.fronts.find(front => [front.controllerId, front.administratorId, ...front.actorIds].includes(actorId));
  if (!front) return;
  if (faction && (item.status === "controlled" || front.controllerId === actorId && (front.controlled || front.captured))) {
    void gpmOpenHistoricalFactionInspector(Se, Ve, item, front, faction);
  } else {
    gpmHistoricalMapOpenFront(front, item.provinceKey, actorId);
  }
}

function gpmHistoricalNamedFaction(state, id) {
  const actor = state.actors[id];
  return actor && !actor.strategicOnly && !["state", "state-force", "government"].includes(actor.kind) ? actor : null;
}

function gpmDropHistoricalLabel(mesh) {
  mesh.removeFromParent();
  mesh.geometry.dispose();
  mesh.material.map.dispose();
  mesh.material.dispose();
}

function gpmHistoricalLabelMesh(globe, state, key, text, path, localArea = false) {
  const layer = state.nativeLabelLayer ||= new Xa();
  if (!layer.parent) globe.scene.add(layer);
  const nodes = state.nativeLabels ||= new Map();
  const signature = [text, path.cap, ...path.pts.flat()].join("|");
  let node = nodes.get(key);
  if (node?.signature !== signature) {
    if (node) gpmDropHistoricalLabel(node.mesh);
    const previousGroup = globe._nlGroup;
    const previousNodes = globe._nlNodes;
    const temporary = new Map();
    try {
      globe._nlGroup = layer;
      globe._nlNodes = temporary;
      globe._nlOne(null, key, text, globe._nlTextEm(text), path, 0, { noCap: 0, built: 0 });
    } finally {
      globe._nlGroup = previousGroup;
      globe._nlNodes = previousNodes;
    }
    const stock = temporary.get(key);
    if (stock && localArea) {
      // Keep local names immediately above the province fill at city-scale zoom.
      const scale = ht * 1.00087 / $Te;
      stock.mesh.geometry.scale(scale, scale, scale);
    }
    node = stock && { ...stock, signature };
    if (node) nodes.set(key, node);
    else nodes.delete(key);
  }
  if (node) {
    node.mesh.visible = true;
    node.mesh.material.opacity = state.atlasLabelOpacity ?? 0;
  }
}

function gpmHistoricalLabelPath(globe, state, item, id, text) {
  const shapes = state.labelPaths ||= new Map();
  const key = item.id + "|" + id + "|" + text + "|" + (item.provinceKeys || []).join(",");
  if (shapes.has(key)) return shapes.get(key);
  const measure = globe._nlTextEm(text) / mce;
  const province = item.provinceKey && globe.world.provByKey?.get(item.provinceKey);
  const nativeKey = item.id.startsWith("polity:") && item.id.slice("polity:".length);
  let path = null;
  if (province?.geometry) {
    const [lon, lat] = item.coords;
    const feature = { __key: key, __idx: 0, geometry: item.geometry || province.geometry };
    const provinces = (item.provinceKeys || [province.__provKey]).map(key => globe.world.provByKey.get(key));
    const allowed = new Set(provinces.map(part => part.__provId));
    const anchors = provinces.map(part => ({ ...part, __countryKey: key, properties: {
      ...part.properties, lon: item.mask ? lon : part.__centroid[0], lat: item.mask ? lat : part.__centroid[1],
    } }));
    const localWorld = { byKey: new Map([[key, feature]]), provinces: anchors };
    const ownerAt = (x, y) => allowed.has(globe._provinceAt(x, y)) &&
      (!item.mask || item.mask.contains(x, y)) ? 0 : -1;
    const fit = candidate => {
      const samples = candidate.pts;
      const inside = scale => samples.every(([x, y], index) => {
        const a = samples[Math.max(0, index - 1)];
        const b = samples[Math.min(samples.length - 1, index + 1)];
        const cosine = Math.max(.3, Math.cos(y * Math.PI / 180));
        const east = (b[0] - a[0]) * cosine;
        const north = b[1] - a[1];
        const norm = Math.hypot(east, north);
        if (!norm) return ownerAt(x, y) === 0;
        const half = scale * candidate.cap * QG / mce / 2;
        return [-1, 0, 1].every(side =>
          ownerAt(x - side * north * half / norm / cosine, y + side * east * half / norm) === 0);
      });
      const scale = [1, .88, .74, .60, .48, .36].find(inside);
      if (!scale) return null;
      const length = samples.slice(1).reduce((sum, [x, y], index) => {
        const [previousX, previousY] = samples[index];
        return sum + Math.hypot((x - previousX) * Math.cos(y * Math.PI / 180), y - previousY);
      }, 0);
      return { ...candidate, length, cap: candidate.cap * scale };
    };
    const fallback = () => {
      const axis = CTe(feature);
      if (!axis) return null;
      const [x, y] = axis.pia;
      const [ax, ay] = axis.a;
      const [bx, by] = axis.b;
      const cosine = Math.max(.3, Math.cos(y * Math.PI / 180));
      for (const span of [.92, .75, .55, .35]) {
        const pts = Array.from({ length: 25 }, (_, index) =>
          [x + (bx - ax) * (index / 24 - .5) * span, y + (by - ay) * (index / 24 - .5) * span]);
        const cap = Math.hypot((bx - ax) * cosine, by - ay) * span / Math.max(measure, 3);
        const fitted = fit({ pts, cap });
        if (fitted) return fitted;
      }
      return null;
    };
    path = WG(localWorld, key, ownerAt, measure).map(fit).find(Boolean);
    if (!path || item.mask?.widthDegrees < .025) {
      const alternate = fallback();
      const score = value => value && Math.min(value.length / Math.max(1, measure), value.cap * QG / mce);
      if (!path || score(alternate) > score(path)) path = alternate;
    }
  } else if (nativeKey) {
    path = WG(globe.world, nativeKey, (x, y) => globe._nlOwnerAt(x, y), measure)[0] || null;
  }
  if (shapes.size >= gpmHistoricalLabelPathCacheLimit) shapes.delete(shapes.keys().next().value);
  shapes.set(key, path);
  return path;
}

function gpmHistoricalProvinceGroups(provinces) {
  const remaining = new Map(provinces.map(province => [province.__provId, province]));
  const groups = [];
  while (remaining.size) {
    const first = remaining.values().next().value;
    const connected = [first];
    remaining.delete(first.__provId);
    for (const province of connected) {
      for (const adjacent of province.__adjAll || []) {
        const neighbor = remaining.get(adjacent);
        if (!neighbor) continue;
        remaining.delete(adjacent);
        connected.push(neighbor);
      }
    }
    groups.push(connected);
  }
  return groups;
}

function gpmHistoricalAreaLabel(provinces, actorId, title, fronts, nativeKey) {
  const first = provinces[0];
  const provinceKeys = provinces.map(province => province.__provKey).sort();
  const geometry = { type: "MultiPolygon", coordinates: provinces.flatMap(({ geometry }) =>
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates) };
  return { id: (nativeKey ? "owned:" : "controlled:") + provinceKeys[0], provinceKey: first.__provKey,
    provinceKeys, name: title, fronts, actorIds: [actorId], nativeKey,
    status: nativeKey ? "native" : "controlled", title, priority: nativeKey ? 3 : 2,
    coords: first.__centroid, geometry };
}

function gpmHistoricalAreaAt(state, province, coords) {
  if (!coords) return null;
  const [lat, lon] = coords;
  for (const area of state.controlAreas?.values() || []) {
    if (area.provinceKey === province.__provKey && area.mask.contains(lon, lat)) return area;
  }
  return null;
}

function gpmHistoricalClickProvince(globe, province, coords) {
  const state = globe?._gpmHistoricalMap;
  if (!province || !state?.visible || !gpmHistoricalMapVisible(globe)) return false;
  const mode = Xsa("earth");
  const region = state.regions.get(province.__provKey);
  const owner = province.__polityKey || province.__countryKey;
  const nativeOwner = state.data.nativeCountryActors?.[owner];
  const area = gpmHistoricalAreaAt(state, province, coords);
  if (mode === "strategic") {
    const fronts = gpmHistoricalFrontsAt(region, mode, area);
    if (!fronts.length) return false;
    const picked = fronts[0];
    if (picked.contested || picked.captured) {
      gpmHistoricalSelectMapFront(picked, { name: area?.name || region.name, provinceKey: province.__provKey, fronts });
      return true;
    }
    if (picked.controlled && gpmHistoricalNamedFaction(state, picked.controllerId)) {
      gpmHistoricalOpenFaction(globe, area || { fronts: [picked], provinceKey: province.__provKey }, picked.controllerId);
      return true;
    }
    if (nativeOwner && owner !== Ve.playerKey && !picked.modeledContact && !picked.reportedRegion) {
      gpmHistoricalOpenFaction(globe, { fronts, provinceKey: province.__provKey }, nativeOwner);
      return true;
    }
    gpmHistoricalMapPopup(state, { ...region, provinceKey: province.__provKey, fronts }, null);
    return true;
  }
  if (mode !== "atlas") return false;
  if (area) {
    gpmHistoricalOpenFaction(globe, area, area.actorIds[0]);
    return true;
  }
  const picked = state.fills.get(province.__provId)?.front;
  if (picked?.contested) {
    gpmHistoricalSelectMapFront(picked, { name: region.name, provinceKey: province.__provKey,
      fronts: gpmHistoricalFrontsAt(region, mode) });
    return true;
  }
  if (gpmHistoricalNamedFaction(state, picked?.controllerId) &&
      (picked.captured || picked.controlled && picked.controllerId !== nativeOwner)) {
    gpmHistoricalOpenFaction(globe, { fronts: [picked], provinceKey: province.__provKey }, picked.controllerId);
    return true;
  }
  if (picked?.captured) {
    gpmHistoricalSelectMapFront(picked, { name: region.name, provinceKey: province.__provKey,
      fronts: gpmHistoricalFrontsAt(region, mode) });
    return true;
  }
  if (nativeOwner && owner !== Ve.playerKey) {
    gpmHistoricalOpenFaction(globe, { fronts: region?.fronts || [], provinceKey: province.__provKey }, nativeOwner);
    return true;
  }
  return false;
}

function gpmHistoricalMapPopup(state, item, button, pointer) {
  Se.tooltip(null);
  const primary = item.fronts[0];
  if (!primary) return;
  if (primary.contested || primary.captured) {
    gpmHistoricalSelectMapFront(primary, item, pointer, button);
    return;
  }
  state.selectedWar = primary.id;
  if (item.fronts.length === 1) {
    gpmHistoricalSelectMapFront(item.fronts[0], item, pointer);
    return;
  }
  const popup = state.popup;
  popup.replaceChildren();
  const title = document.createElement("strong");
  title.textContent = item.name;
  popup.append(title);
  for (const front of item.fronts) {
    const choice = document.createElement("button");
    choice.type = "button";
    choice.className = "k k-sm";
    choice.textContent = (front.shortTitle || front.name) + " · " + gpmHistoricalFrontSummary(front, state.actors).status;
    choice.addEventListener("click", event => {
      popup.hidden = true;
      gpmHistoricalSelectMapFront(front, { ...item, fronts: gpmHistoricalOrderedFronts(item.fronts, front) }, event, button);
    });
    popup.append(choice);
  }
  state.opener = button;
  const box = button?.getBoundingClientRect() || { right: nm[0], top: nm[1] };
  popup.hidden = false;
  popup.style.left = Math.max(8, Math.min(box.right + 6, window.innerWidth - popup.offsetWidth - 8)) + "px";
  popup.style.top = Math.max(8, Math.min(box.top, window.innerHeight - popup.offsetHeight - 8)) + "px";
  popup.querySelector("button")?.focus({ preventScroll: true });
}

function gpmMountHistoricalMap(globe, session) {
  const state = {
    session, statusFilter: new Set(["active"]), controls: document.createElement("div"),
    popup: document.createElement("div"), borders: new Map(), regions: new Map(), actors: {},
    markers: [], fills: new Map(), lastDay: -1, lastRequest: -Infinity,
  };
  state.controls.className = "gpm-history-map-control";
  state.controls.hidden = true;
  state.controls.innerHTML = `
    <button class="hud-tray-btn gpm-history-map-toggle" type="button" data-gpm-history-map-toggle
      aria-expanded="false" aria-controls="gpm-history-map-legend">
      <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M8 2l6 6-6 6-6-6z" fill="none" stroke="currentColor" stroke-width="1.6"/>
        <path d="M8 5v4m0 2h.01" stroke="currentColor" stroke-width="1.6"/>
      </svg><span>Conflicts</span>
    </button>
    <div class="gpm-history-map-legend" id="gpm-history-map-legend" data-gpm-history-map-legend hidden>
      ${[["active", "Active fighting"], ["ceasefire", "Ceasefires"], ["occupation", "Occupations"]].map(([status, label]) => `
        <label><input type="checkbox" value="${status}" data-gpm-history-map-status${state.statusFilter.has(status) ? " checked" : ""}>
          <i style="--ink:${gpmHistoricalMapInk(status)}" aria-hidden="true"></i>${label}</label>`).join("")}
      <span><i style="--ink:#202930" aria-hidden="true"></i>Dark borders and muted fills mark contested territory</span>
      <span><i style="--ink:${gpmHistoricalMapInk("captured")}" aria-hidden="true"></i>Yellow dashes mark confirmed wartime captures</span>
      <small>In Strategic view, a ceasefire diamond marks paused fighting. An occupation diamond can mark a report with exact control unknown.</small>
      <small>Select a diamond or province to see control, overlapping conflicts, and available actions.</small>
    </div>`;
  const toggle = state.controls.querySelector("button");
  const legend = state.controls.querySelector("[data-gpm-history-map-legend]");
  const showLegend = shown => {
    legend.hidden = !shown;
    toggle.setAttribute("aria-expanded", String(shown));
  };
  toggle.addEventListener("click", () => showLegend(legend.hidden));
  legend.addEventListener("change", event => {
    const checkbox = event.target.closest("[data-gpm-history-map-status]");
    if (!checkbox) return;
    if (checkbox.checked) state.statusFilter.add(checkbox.value);
    else state.statusFilter.delete(checkbox.value);
    gpmCloseRegionalControlBox(Se);
    state.popup.hidden = true;
    if (state.data) gpmPaintHistoricalMap(globe, state, state.data);
  });
  legend.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    showLegend(false);
    toggle.focus({ preventScroll: true });
  });
  ct("view-toggle")?.after(state.controls);
  state.popup.className = "gpm-history-map-popup";
  state.popup.setAttribute("data-gpm-history-map-popup", "");
  state.popup.hidden = true;
  state.popup.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    state.popup.hidden = true;
    state.opener?.focus({ preventScroll: true });
  });
  globe.container.append(state.popup);
  const dismiss = event => {
    if (!state.controls.contains(event.target)) showLegend(false);
    if (!event.target.closest("[data-gpm-history-front-marker], [data-gpm-history-faction-label]") && !state.popup.contains(event.target)) {
      state.popup.hidden = true;
    }
  };
  document.addEventListener("pointerdown", dismiss);
  state.removeListener = () => document.removeEventListener("pointerdown", dismiss);
  globe._gpmHistoricalMap = state;
  return state;
}

function gpmClearHistoricalMap(globe) {
  const state = globe._gpmHistoricalMap;
  if (!state) return;
  clearTimeout(state.refreshTimer);
  if (Se._gpmFactionInspector?.session === state.session) Se.closeInspector();
  gpmCloseRegionalControlBox(Se);
  for (const border of state.borders.values()) {
    border.mesh.removeFromParent();
    border.casingMesh.removeFromParent();
    border.mesh.geometry.dispose();
    if (border.sharedMaterial) continue;
    border.mat.dispose();
    border.casingMat.dispose();
    for (const material of [border.mat, border.casingMat]) {
      const index = globe._lineMats.indexOf(material);
      if (index >= 0) globe._lineMats.splice(index, 1);
    }
  }
  if (state.markerLayer) {
    Jkt(globe).clear("gpm-history");
    state.markerLayer.hidden = true;
  }
  if (state.labelLayer) Jkt(globe).clear("gpm-history-factions");
  if (state.nativeLabelLayer) {
    for (const { mesh } of state.nativeLabels.values()) gpmDropHistoricalLabel(mesh);
    state.nativeLabelLayer.removeFromParent();
  }
  const uniforms = globe.fillMat?.uniforms;
  if (uniforms?.gpmHistoricalFill) {
    uniforms.gpmHistoricalFill.value = null;
    uniforms.gpmHistoricalFillOn.value = 0;
    uniforms.gpmHistoricalAreaAtlas.value = null;
    for (const index of gpmHistoricalOpeningAreas.keys()) {
      uniforms["gpmHistoricalAreaProvince" + index].value = -1;
    }
  }
  state.controlAtlas?.texture.dispose();
  state.fillTexture?.dispose();
  globe._refreshFillVis?.();
  state.controls.remove();
  state.popup.remove();
  state.removeListener();
  globe._gpmHistoricalMap = null;
}

function gpmHistoricalPoliticalEdge(left, right, fills) {
  const a = fills.get(left.__provId)?.front;
  const b = fills.get(right.__provId)?.front;
  const leftCapture = a?.captured ? a.occupationKey || a.dominantKey : null;
  const rightCapture = b?.captured ? b.occupationKey || b.dominantKey : null;
  if (leftCapture !== rightCapture) return "captured";
  if (leftCapture || left.__countryKey !== right.__countryKey) return null;
  const status = front => front?.contested ? "contested" : front?.controlled ? "controlled" : null;
  const aStatus = status(a);
  const bStatus = status(b);
  if (!aStatus && !bStatus) return null;
  return aStatus !== bStatus ||
    (a.dominantKey || a.controllerId) !== (b.dominantKey || b.controllerId) ? "control" : null;
}

function gpmHistoricalPoliticalBorders(globe, state) {
  const areas = [...state.controlAreas.values()];
  const signature = JSON.stringify([
    [...state.fills].map(([id, { front }]) =>
      [id, !!front.captured, !!front.contested, !!front.controlled, front.occupationKey, front.dominantKey, front.controllerId]),
    areas.map(area => area.id),
  ]);
  if (state.politicalBorderSignature === signature && state.politicalBaseBorders === globe.world.borders) return;
  state.politicalBorderSignature = signature;
  state.politicalBaseBorders = globe.world.borders;
  const geometry = globe.world.gpmPoliticalEdges((a, b) => gpmHistoricalPoliticalEdge(a, b, state.fills));
  for (const { geometry: area } of areas) {
    geometry.control.coordinates.push(...(area.type === "Polygon" ? area.coordinates : area.coordinates.flat()));
  }
  const radius = ht * 1.00135;
  for (const [kind, shape] of Object.entries(geometry)) {
    const current = state.borders.get(kind);
    if (current) {
      IRt(current, shape, radius, .012);
    } else if (shape.coordinates.length) {
      const base = globe.borderLines;
      if (kind === "control") {
        const { geometry, positions } = _Te(shape, radius, .012);
        const mesh = new Cu(geometry, base.mat);
        const casingMesh = new Cu(geometry, base.casingMat);
        mesh.renderOrder = base.mesh.renderOrder;
        casingMesh.renderOrder = base.casingMesh.renderOrder;
        mesh.frustumCulled = casingMesh.frustumCulled = false;
        globe._borderScene.add(casingMesh, mesh);
        state.borders.set(kind, { mesh, casingMesh, count: positions.length / 6, sharedMaterial: true });
      } else {
        const border = VG(globe, shape, {
          radius, minDeg: .012, order: 43, color: gpmHistoricalMapColors.captured, width: .92,
          opacity: .72, casingColor: pi.casing, casingWidth: 2.1, casingOpacity: .13,
        });
        for (const material of [border.mat, border.casingMat]) {
          material.dashed = true;
          material.dashSize = .013;
          material.gapSize = .008;
        }
        state.borders.set(kind, border);
      }
    }
    const border = state.borders.get(kind);
    if (kind === "captured" && border?.count) border.mesh.computeLineDistances();
  }
  state.presentationDirty = true;
}

function gpmPaintHistoricalMap(globe, state, data) {
  state.data = data;
  const lines = new Map(["reported", "active", "occupation", "ceasefire", "suspended"]
    .map(status => [status, { keys: [], rings: [] }]));
  const regions = new Map();
  const fills = new Map();
  const locations = [];
  const labels = [];
  const controlled = new Map();
  const holdings = new Map();
  state.controlAreas = new Map();
  const provinceByKey = globe.world.provByKey || new Map(globe.world.provinces.map(province => [province.__provKey, province]));
  state.actors = data.actors || {};
  for (const region of data.regions) {
    const province = provinceByKey.get(region.key);
    if (!province) continue;
    const shown = region.fronts.filter(front => state.statusFilter.has(front.status));
    if (!shown.length) continue;
    const name = Dt(region.key, region.name || province.__name);
    const shape = province.geometry;
    const territorial = shown.filter(front => front.political !== false && !front.strategicOnly);
    const politicalFronts = gpmHistoricalOrderedFronts(territorial);
    const strategicFronts = gpmHistoricalOrderedFronts(shown.filter(front => front.strategic !== false));
    regions.set(region.key, { ...region, name, fronts: shown, politicalFronts, strategicFronts });
    const primary = politicalFronts[0];
    const nativeCapture = primary?.captured && !primary.contested;
    const contested = primary?.contested;
    const ownerKey = province.__polityKey || province.__countryKey;
    const fullControl = primary?.controlled && (!primary.native || primary.recognizedControl) &&
      gpmHistoricalNamedFaction(state, primary.controllerId);
    const colorFront = nativeCapture || contested || fullControl ? primary : null;
    if (colorFront && Number.isInteger(province.__provId)) {
      fills.set(province.__provId, { front: colorFront, ownerKey });
    }
    const strategic = strategicFronts;
    const outlined = strategic.filter(front => !front.crimeReport && front !== colorFront);
    const hasShape = shape?.type === "Polygon" || shape?.type === "MultiPolygon";
    const status = nativeCapture ? "captured" : contested ? "contested" : fullControl ? "controlled" :
      territorial.some(front => !front.native) ? "reported" : null;
    const situationStatus = outlined.length ? gpmHistoricalMapStatus(outlined) : null;
    if (hasShape) {
      const rings = shape.type === "Polygon" ? shape.coordinates : shape.coordinates.flat();
      for (const type of [status === "reported" && status, situationStatus]) {
        if (!type) continue;
        const line = lines.get(type);
        line.keys.push(region.key);
        line.rings.push(...rings);
      }
    }
    if (strategic.length && province.__centroid?.every(Number.isFinite)) {
      locations.push({ id: region.key, provinceKey: region.key, name, fronts: strategic, status: gpmHistoricalMapStatus(strategic),
        priority: strategic.some(front => front.native && (front.captured || front.contested)) ? 2 : 1,
        coords: province.__centroid });
    }
    for (const area of gpmHistoricalOpeningAreas) {
      if (region.key !== area.provinceKey || nativeCapture || !hasShape) continue;
      const key = area.id === "arakan-opening" ? "PPO-ARAKAN-RAKHINE" : "PPO-" + area.id.toUpperCase();
      if (provinceByKey.has(key)) continue;
      const front = territorial.find(row => row.id === area.frontId && row.status === "active" &&
        !row.occupationKey && (row.controllerId === area.actorId || area.allowUnknownController && !row.controllerId));
      if (!front || !gpmHistoricalNamedFaction(state, area.actorId)) continue;
      const item = { id: area.id, provinceKey: region.key, provinceId: province.__provId, name: area.name || name,
        fronts: [{ ...front, controllerId: area.actorId, administratorId: area.actorId, contested: false, controlled: true }],
        actorIds: [area.actorId], actorId: area.actorId, status: "controlled", priority: 4,
        title: area.label, geometry: area.geometry, coords: area.anchor, mask: gpmHistoricalAreaMask(globe, state, area) };
      state.controlAreas.set(area.id, item);
      labels.push(item);
    }
    const controller = gpmHistoricalNamedFaction(state, colorFront?.controllerId);
    if (controller && status === "controlled" && (!primary.recognizedControl || data.nativeCountryActors?.[ownerKey] !== controller.id) &&
        hasShape && province.__centroid?.every(Number.isFinite)) {
      if (!controlled.has(controller.id)) controlled.set(controller.id, new Map());
      controlled.get(controller.id).set(province.__provId, { province, front: colorFront });
    }
  }
  for (const [actorId, provinces] of controlled) {
    for (const group of gpmHistoricalProvinceGroups([...provinces.values()].map(part => part.province))) {
      const fronts = group.map(province => provinces.get(province.__provId).front);
      labels.push(gpmHistoricalAreaLabel(group, actorId, gpmHistoricalMapName(state.actors[actorId]), fronts));
    }
  }
  const byCountry = new Map();
  const selectableFactions = Object.values(state.actors).filter(actor => actor.countryKey &&
    gpmHistoricalNamedFaction(state, actor.id));
  const factionKeySet = new Set([...Object.keys(data.nativeCountryActors || {}), ...selectableFactions.map(actor => actor.countryKey)]);
  for (const province of globe.world.provinces) {
    const key = province.__polityKey || province.__countryKey;
    const front = fills.get(province.__provId)?.front;
    if (!factionKeySet.has(key) || front?.captured || !province.__centroid?.every(Number.isFinite) ||
        !["Polygon", "MultiPolygon"].includes(province.geometry?.type)) continue;
    if (!byCountry.has(key)) byCountry.set(key, []);
    byCountry.get(key).push(province);
  }
  for (const [key, id] of Object.entries(data.nativeCountryActors || {})) {
    const country = globe.world.byKey?.get(key);
    if (!state.actors[id] || !country) continue;
    const owned = byCountry.get(key) || [];
    const stateName = gpmHistoricalMapName(state.actors[id]);
    for (const group of gpmHistoricalProvinceGroups(owned)) {
      const fronts = group.flatMap(province => regions.get(province.__provKey)?.fronts || []);
      labels.push(gpmHistoricalAreaLabel(group, id, stateName, fronts, key));
    }
  }
  for (const label of labels) {
    const actorId = label.actorIds[0];
    if (label.nativeKey && label.provinceKeys.some(key => regions.get(key)?.politicalFronts[0]?.contested)) continue;
    const previous = holdings.get(actorId);
    if (!previous || label.priority > previous.priority) holdings.set(actorId, label);
  }
  for (const actor of selectableFactions) {
    const owned = byCountry.get(actor.countryKey);
    const province = owned?.find(province => !fills.get(province.__provId)?.front.contested);
    if (province) holdings.set(actor.id, { coords: province.__centroid });
  }
  for (const [status, line] of lines) {
    const current = state.borders.get(status);
    const signature = line.keys.sort().join("|");
    if (current?.signature === signature || !current && !signature) continue;
    const geometry = { type: "MultiLineString", coordinates: line.rings };
    if (current) {
      IRt(current, geometry, ht * 1.0021, .018);
      current.signature = signature;
    } else {
      const territory = status === "reported";
      const border = VG(globe, geometry, { radius: ht * 1.0021, minDeg: .018, order: 40,
        color: territory ? pi.atlasProvince : gpmHistoricalMapColors[status],
        width: territory ? .72 : 1.05,
        opacity: territory ? .26 : .56,
        casingColor: territory ? pi.casing : 0x111920,
        casingWidth: territory ? 1.15 : 1.9,
        casingOpacity: territory ? 0 : .4 });
      state.borders.set(status, { ...border, signature });
    }
  }
  state.regions = regions;
  state.fills = fills;
  gpmHistoricalPoliticalBorders(globe, state);
  state.holdings = holdings;
  state.selectionDirty = true;
  const controlBox = Se._gpmRegionControlBox;
  if (controlBox) {
    const region = regions.get(controlBox.provinceKey);
    const fronts = gpmHistoricalFrontsAt(region, controlBox.mode);
    if (fronts[0]?.contested || fronts[0]?.captured) controlBox.render({ ...region, provinceKey: controlBox.provinceKey, fronts });
    else gpmCloseRegionalControlBox(Se);
  }
  gpmHistoricalPaintFills(globe, state);
  const nativeLabels = new Map(Object.entries(data.nativeCountryActors || {}).map(([key, id]) => {
    const actor = state.actors[id];
    const provinceKeys = labels.filter(label => label.nativeKey === key).flatMap(label => label.provinceKeys).sort();
    return [key, { parent: actor?.sourceCountryKey, signature: [gpmHistoricalMapName(actor), ...provinceKeys].join("|") }];
  }));
  state.nativeLabelCells = gpmHistoricalLabelCells(globe.world.provinces, data.nativeCountryActors || {});
  const previousNativeLabels = state.nativeLabelOwners || new Map();
  const changedNativeLabels = state.pendingNativeLabelRefits ||= new Set();
  for (const key of new Set([...nativeLabels.keys(), ...previousNativeLabels.keys()])) {
    const current = nativeLabels.get(key);
    const previous = previousNativeLabels.get(key);
    if (current?.signature === previous?.signature) continue;
    changedNativeLabels.add(key);
    const parentKey = current?.parent || previous?.parent;
    if (parentKey) changedNativeLabels.add(parentKey);
  }
  for (const key of changedNativeLabels) {
    const feature = globe.world.byKey?.get(key);
    if (!feature) globe._nlDropAll?.(key);
    else if (globe._nlOn) globe._nlBuild(feature);
    else continue;
    changedNativeLabels.delete(key);
  }
  state.nativeLabelOwners = nativeLabels;
  const markerLayout = hc(globe, "gpm-history", locations.sort((a, b) => (b.priority || 0) - (a.priority || 0)), {
    layerClass: "gpm-history-map-locations",
    contentKey: item => JSON.stringify([item.name, item.status, item.fronts.map(front => [front.id, front.shortTitle, front.status])]),
    projectionKey: item => item.coords.join("|"),
    createElement: () => {
      const button = document.createElement("button");
      button.className = "gpm-history-map-marker";
      button.type = "button";
      button.hidden = true;
      button.setAttribute("data-gpm-history-front-marker", "");
      button.addEventListener("click", event => {
        event.stopPropagation();
        gpmHistoricalMapPopup(state, button._gpmHistoricalLocation, button, event);
      });
      const tooltip = (x, y) => {
        const region = button._gpmHistoricalLocation;
        if (region && state.popup.hidden) Se.tooltip({ type: "gpmHistoricalMap", region, actors: state.actors }, x, y);
      };
      button.addEventListener("pointermove", event => {
        event.stopPropagation();
        tooltip(event.clientX, event.clientY);
      });
      button.addEventListener("pointerleave", () => Se.tooltip(null));
      button.addEventListener("focus", () => {
        const box = button.getBoundingClientRect();
        tooltip(box.right, box.bottom);
      });
      button.addEventListener("blur", () => Se.tooltip(null));
      return button;
    },
    patch: ({ el }, item) => {
      el._gpmHistoricalLocation = item;
      el.dataset.fronts = item.fronts.map(front => front.id).join(" ");
      el.dataset.location = "province";
      el.dataset.provinceKey = item.provinceKey;
      el.style.setProperty("--ink", gpmHistoricalMapInk(item.status));
      const label = item.name + " · " +
        (item.fronts.length === 1 ? item.fronts[0].shortTitle || item.fronts[0].name : item.fronts.length + " conflicts");
      el.setAttribute("aria-label", label);
    },
    project: item => {
      const position = ft(item.coords[1], item.coords[0], ht);
      return { pos: position, nrm: position.clone().normalize() };
    },
  });
  state.markerLayer = markerLayout.layer;
  state.markers = markerLayout.nodes;
  const locationsById = new Map(locations.map(item => [item.id, item]));
  for (const marker of state.markers) marker.el._gpmHistoricalLocation = locationsById.get(marker.id);
  const labelLayout = hc(globe, "gpm-history-factions", labels.sort((a, b) => b.priority - a.priority), {
    layerClass: "gpm-history-map-locations",
    contentKey: item => JSON.stringify([item.name, item.priority, item.title, item.status,
      item.actorIds.map(id => [id, gpmHistoricalMapName(state.actors[id]), state.actors[id].color])]),
    projectionKey: item => item.coords.join("|"),
    createElement: () => {
      const el = document.createElement("div");
      el.className = "gpm-history-faction-label";
      el.hidden = true;
      el.setAttribute("data-gpm-history-faction-label", "");
      el.addEventListener("click", event => {
        const button = event.target.closest("button[data-actor-id]");
        if (!button) return;
        event.stopPropagation();
        gpmHistoricalOpenFaction(globe, el._gpmHistoricalLocation, button.dataset.actorId);
      });
      return el;
    },
    patch: ({ el }, item) => {
      el.dataset.actorIds = item.actorIds.join(" ");
      el.dataset.provinceKey = item.provinceKey || "";
      el.dataset.priority = item.priority;
      el.dataset.status = item.status;
      el.replaceChildren(...item.actorIds.map(id => {
        const actor = state.actors[id];
        const title = item.title || gpmHistoricalMapName(actor);
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.actorId = id;
        button.title = item.name + " · " + title +
          (item.id.startsWith("country:") ? " · Country-level report" : "");
        button.textContent = title;
        return button;
      }));
    },
    project: item => {
      const position = ft(item.coords[1], item.coords[0], ht);
      return { pos: position, nrm: position.clone().normalize() };
    },
  });
  const currentLabelKeys = new Set(labels.flatMap(label =>
    label.actorIds.map(id => "gpm-faction:" + id + ":" + label.id)));
  for (const [key, { mesh }] of state.nativeLabels || []) {
    if (currentLabelKeys.has(key)) continue;
    gpmDropHistoricalLabel(mesh);
    state.nativeLabels.delete(key);
  }
  const labelsById = new Map(labels.map(item => [item.id, item]));
  state.labelLayer = labelLayout.layer;
  state.labels = labelLayout.nodes;
  for (const label of state.labels) label.el._gpmHistoricalLocation = labelsById.get(label.id);
  state.hasData = !!(regions.size || labels.length || fills.size);
  state.presentationDirty = true;
  state.viewMatrix = null;
  gpmPositionHistoricalMap(globe);
  globe._frameGate.invalidate();
}

function gpmPrefetchHistoricalMap(session) {
  const day = session.day;
  const revision = session.status?.commitRevision;
  session._gpmHistoricalPrefetch = Ze(session, "gpm.historicalMap").then(
    data => ({ data, day, revision }),
    () => null
  );
}

async function gpmPrepareHistoricalMap(globe, session) {
  const start = performance.now();
  const state = globe._gpmHistoricalMap || gpmMountHistoricalMap(globe, session);
  await gpmRefreshHistoricalMap(globe, session);
  if (globe._gpmHistoricalMap !== state || Ve !== session || !state.hasData) return;
  try {
    if (state.fillTexture) globe.renderer.initTexture(state.fillTexture);
    if (state.controlAtlas) globe.renderer.initTexture(state.controlAtlas.texture);
    let frame = performance.now();
    for (const label of state.labels) {
      if (globe._gpmHistoricalMap !== state || Ve !== session) return;
      const item = label.el._gpmHistoricalLocation;
      for (const button of label.el.children) {
        const id = button.dataset.actorId;
        const text = button.textContent.toLocaleUpperCase(ee());
        const compact = (item.mask?.widthDegrees < .25 || item.nativeKey && item.provinceKeys.length === 1) &&
          gpmHistoricalCompactFactionNames[id];
        gpmHistoricalLabelPath(globe, state, item, id, text);
        if (compact && text !== compact) gpmHistoricalLabelPath(globe, state, item, id, compact);
      }
      if (performance.now() - frame >= 8) {
        await zc();
        frame = performance.now();
      }
    }
    if (globe._nlNodes) {
      for (const key of state.pendingNativeLabelRefits || []) {
        const feature = globe.world.byKey.get(key);
        if (feature) globe._nlBuild(feature);
        state.pendingNativeLabelRefits.delete(key);
      }
    }
  } catch (error) {
    console.warn("[PPO] Conflict map resource preparation failed", error);
  }
  console.log(`[game-load] conflict map: ${Math.round(performance.now() - start)} ms`);
}

async function gpmRefreshHistoricalMap(globe, session, territoryChanged = false) {
  if (!globe || !session) return;
  const state = globe._gpmHistoricalMap || gpmMountHistoricalMap(globe, session);
  if (state.session !== session) return;
  if (territoryChanged) {
    state.lastDay = -1;
    state.lastRequest = -Infinity;
    state.territoryRevision = (state.territoryRevision || 0) + 1;
  }
  const now = performance.now();
  const day = session.day;
  const commitRevision = session.status?.commitRevision;
  if (state.pending || (state.lastDay === day && state.lastCommitRevision === commitRevision)) return;
  const wait = 1500 - (now - state.lastRequest);
  if (wait > 0) {
    state.refreshTimer ??= setTimeout(() => {
      state.refreshTimer = undefined;
      if (globe._gpmHistoricalMap === state && Ve === session) void gpmRefreshHistoricalMap(globe, session);
    }, Math.ceil(wait));
    return;
  }
  clearTimeout(state.refreshTimer);
  state.refreshTimer = undefined;
  state.pending = true;
  state.lastRequest = now;
  const revision = state.territoryRevision;
  try {
    const prefetch = session._gpmHistoricalPrefetch;
    session._gpmHistoricalPrefetch = null;
    const initial = prefetch && await prefetch;
    const result = !territoryChanged && initial && initial.day === day && initial.revision === commitRevision
      ? initial.data : await Ze(session, "gpm.historicalMap");
    if (globe._gpmHistoricalMap === state && Ve === session && revision === state.territoryRevision &&
        Array.isArray(result?.regions)) {
      gpmPaintHistoricalMap(globe, state, result);
      state.lastDay = day;
      state.lastCommitRevision = commitRevision;
    }
  } catch (error) {
    console.warn("[PPO] Historical conflict map could not refresh", error);
  } finally {
    state.pending = false;
    if (globe._gpmHistoricalMap === state && Ve === session &&
        (revision !== state.territoryRevision || day !== session.day || commitRevision !== session.status?.commitRevision)) {
      void gpmRefreshHistoricalMap(globe, session);
    }
  }
}

function gpmPositionHistoricalMap(globe) {
  const state = globe._gpmHistoricalMap;
  if (!state?.markerLayer) return;
  const mode = Xsa("earth");
  const allowed = mode !== "satellite" && gpmHistoricalMapVisible(globe);
  const visible = allowed && state.hasData && state.statusFilter.size > 0;
  const political = mode === "atlas";
  const showSituation = visible && mode === "strategic";
  const showTerritory = visible && political;
  const showControl = showTerritory || showSituation;
  if (showControl && state.politicalBaseBorders !== globe.world.borders) gpmHistoricalPoliticalBorders(globe, state);
  if (globe.controls && !globe._cinema && globe.activeBody === "earth") {
    const minimum = showTerritory ? 2.010 : 2.15;
    const near = showTerritory ? .004 : .1;
    if (globe.controls.minDistance !== minimum || globe.camera.near !== near) {
      globe.controls.minDistance = minimum;
      globe.camera.near = near;
      globe.camera.updateProjectionMatrix();
      if (globe._zoomTarget < minimum) globe._zoomTarget = minimum;
    }
  }
  if (showTerritory && globe._nlOn && state.pendingNativeLabelRefits?.size) {
    for (const key of state.pendingNativeLabelRefits) {
      const feature = globe.world.byKey.get(key);
      if (feature) globe._nlBuild(feature);
    }
    state.pendingNativeLabelRefits.clear();
  }
  if (state.paletteSignature !== globe._polCountrySignature) gpmHistoricalPaintFills(globe, state);
  const fillUniform = globe.fillMat?.uniforms.gpmHistoricalFillOn;
  const fillShown = Number(showControl && (state.hasFills || state.controlAreas.size > 0));
  if (fillUniform && fillUniform.value !== fillShown) {
    fillUniform.value = fillShown;
    globe._refreshFillVis();
  }
  if (state.allowed !== allowed || state.visible !== visible || state.political !== political ||
      state.showSituation !== showSituation || state.presentationDirty) {
    if (state.allowed !== allowed || state.political !== political || state.showSituation !== showSituation) {
      gpmCloseRegionalControlBox(Se);
    }
    state.allowed = allowed;
    state.visible = visible;
    state.political = political;
    state.showSituation = showSituation;
    state.presentationDirty = false;
    if (globe.fillMat) {
      const uniforms = globe.fillMat.uniforms;
      uniforms.gpmHistoricalAreaAtlas.value = state.controlAtlas?.texture || null;
      for (const [index, area] of gpmHistoricalOpeningAreas.entries()) {
        const item = state.controlAreas.get(area.id);
        uniforms["gpmHistoricalAreaBounds" + index].value = item?.mask.bounds || [0, 0, 0, 0];
        uniforms["gpmHistoricalAreaProvince" + index].value = showControl && item ? item.provinceId : -1;
      }
    }
    state.controls.hidden = !allowed;
    state.viewMatrix = null;
    if (!showSituation) {
      state.popup.hidden = true;
    }
    if (!visible && Y("tooltip")?.classList.contains("gpm-history-map-tip")) Se.tooltip(null);
    for (const [status, border] of state.borders) {
      const shown = status === "captured" || status === "control" ? showControl :
        status === "reported" ? showTerritory : showSituation;
      GT(border, shown && border.count > 0);
    }
    state.markerLayer.hidden = !showSituation;
    if (state.labelLayer) state.labelLayer.hidden = !showTerritory;
    if (state.nativeLabelLayer) state.nativeLabelLayer.visible = showTerritory;
  }
  if (showSituation && (state.selectionDirty || state.drawnWar !== state.selectedWar)) {
    gpmHistoricalWarHighlight(globe, state, state.selectedWar);
    state.drawnWar = state.selectedWar;
  }
  if (!showSituation && !showTerritory) return;
  const camera = globe.camera;
  const cameraDirection = camera.position;
  const horizon = ht;
  const point = state.point ||= new le;
  const width = window.innerWidth;
  const height = window.innerHeight;
  const projection = camera.projectionMatrix.elements;
  const view = camera.matrixWorld.elements;
  if (state.viewWidth === width && state.viewHeight === height &&
      state.viewMatrix?.every((value, index) => value === view[index]) &&
      state.projectionMatrix?.every((value, index) => value === projection[index])) return;
  state.viewWidth = width;
  state.viewHeight = height;
  state.viewMatrix = view.slice();
  state.projectionMatrix = projection.slice();
  const cells = new Set();
  if (showTerritory) {
    if (state.nativeLabelLayer) state.nativeLabelLayer.visible = true;
    for (const { mesh } of state.nativeLabels?.values() || []) mesh.visible = false;
    const footprints = [];
    const project = ([lon, lat]) => {
      const vector = ft(lat, lon, ht);
      if (vector.dot(cameraDirection) <= horizon * horizon) return null;
      point.copy(vector).project(camera);
      return [(point.x * .5 + .5) * width, (-point.y * .5 + .5) * height];
    };
    for (const label of state.labels || []) {
      label.el.hidden = true;
      const item = label.el._gpmHistoricalLocation;
      if (label.nrm.dot(cameraDirection) <= horizon && !item.mask) continue;

      const buttons = [...label.el.children];
      for (const button of buttons) {
        button.hidden = true;
        const id = button.dataset.actorId;
        let text = button.textContent.toLocaleUpperCase(ee());
        let path = gpmHistoricalLabelPath(globe, state, item, id, text);
        const compact = (item.mask?.widthDegrees < .25 || item.nativeKey && item.provinceKeys.length === 1) &&
          gpmHistoricalCompactFactionNames[id];
        if (compact && text !== compact) {
          const pixelsPerRadian = height * ht / (2 * Math.tan(camera.fov * Math.PI / 360) *
            Math.max(.001, cameraDirection.length() - ht));
          const capPixels = path && Math.min(path.cap * QG / mce, path.length ? path.length / globe._nlTextEm(text) : path.cap) *
            (Math.PI / 180) * pixelsPerRadian;
          if (!capPixels || capPixels < 6) {
            const smaller = gpmHistoricalLabelPath(globe, state, item, id, compact);
            if (smaller) {
              path = smaller;
              text = compact;
            }
          }
        }
        if (!path) continue;
        const center = project(path.pts[Math.floor(path.pts.length / 2)]);
        const start = project(path.pts[0]);
        const end = project(path.pts.at(-1));
        if (!center || !start || !end) continue;
        const [x, y] = center;
        const dx = end[0] - start[0], dy = end[1] - start[1];
        const length = Math.hypot(dx, dy);
        if (x < 8 || x > width - 8 || y < 75 || y > height - 28 || length < (text === compact ? 8 : 16)) continue;
        const box = { left: Math.min(start[0], end[0]) - 4, right: Math.max(start[0], end[0]) + 4,
          top: Math.min(start[1], end[1]) - 5, bottom: Math.max(start[1], end[1]) + 5 };
        if (footprints.some(previous => box.left < previous.right && box.right > previous.left &&
            box.top < previous.bottom && box.bottom > previous.top)) continue;
        let heading = Math.atan2(dy, dx) * 180 / Math.PI;
        if (heading > 90) heading -= 180;
        if (heading < -90) heading += 180;
        const left = (x - length / 2).toFixed(1);
        const top = (y - 5).toFixed(1);
        button.style.width = length.toFixed(1) + "px";
        button.style.height = "10px";
        button.style.transform = `translate3d(${left}px, ${top}WR, 0) rotate(${heading.toFixed(1)}deg)`;
        button.hidden = false;
        label.el.hidden = false;
        const areaKey = id + ":" + item.id;
        gpmHistoricalLabelMesh(globe, state, "gpm-faction:" + areaKey, text, path, !!item.mask);
        footprints.push(box);
      }
    }
    return;
  }
  for (const marker of state.markers) {
    if (marker.nrm.dot(cameraDirection) <= horizon) {
      if (!marker.el.hidden) marker.el.hidden = true;
      continue;
    }
    point.copy(marker.pos).project(camera);
    const x = (point.x * .5 + .5) * width;
    const y = (-point.y * .5 + .5) * height;
    const cell = Math.floor(x / 18) + ":" + Math.floor(y / 18);
    const shown = point.z <= 1 && x >= 0 && x <= width && y >= 0 && y <= height && !cells.has(cell);
    if (marker.el.hidden === shown) marker.el.hidden = !shown;
    if (shown) {
      cells.add(cell);
      const transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      if (marker.el.style.transform !== transform) marker.el.style.transform = transform;
    }
  }
}

function gpmHistoricalMapHover(globe, coords) {
  const state = globe?._gpmHistoricalMap;
  if (!coords || !state?.regions.size || Xsa("earth") === "satellite" || !gpmHistoricalMapVisible(globe)) return null;
  const [lat, lon] = coords;
  const province = globe.world.provinces[globe._provinceAt(lon, lat)];
  const region = state.regions.get(province?.__provKey);
  if (!region) return null;
  const mode = Xsa("earth");
  const area = gpmHistoricalAreaAt(state, province, coords);
  const fronts = gpmHistoricalFrontsAt(region, mode, area);
  return fronts.length ? { type: "gpmHistoricalMap", region: { ...region, name: area?.name || region.name, fronts },
    actors: state.actors } : null;
}

function gpmHistoricalMapHoverAt(event) {
  if (!Me || event.target !== Me.renderer.domElement || !Me.interactive || Me._dragging ||
      !Me._gpmHistoricalMap?.regions.size || !gpmHistoricalMapVisible(Me)) return null;
  return gpmHistoricalMapHover(Me, Me._latLonAt(event.clientX, event.clientY));
}

function gpmRenderHistoricalMapTip(node, { region, actors }) {
  const front = region.fronts[0];
  const summary = gpmHistoricalFrontSummary(front, actors);
  const title = front.shortTitle || front.name;
  const html = `<strong>${b(region.name)} · ${b(summary.status)}</strong>
    <small>${b(title)}</small>
    ${summary.sides && summary.sides !== title ? `<small>${b(summary.sides)}</small>` : ""}
    ${summary.clue ? `<small>${b(summary.clue)}</small>` : ""}
    ${region.fronts.length > 1 ? `<small>+${region.fronts.length - 1} more</small>` : ""}`;
  if (!node.classList.contains("gpm-history-map-tip") || node._gpmHistoricalMapHtml !== html) {
    node.classList.remove(...w1e);
    node.classList.add("gpm-history-map-tip");
    node.innerHTML = html;
    node._gpmHistoricalMapHtml = html;
  }
}

function patchHistoricalConflictMapRenderer(source, replaceOnce) {
  const functions = [gpmHistoricalPrimaryFront, gpmHistoricalOrderedFronts, gpmHistoricalMapStatus, gpmHistoricalMapInk, gpmHistoricalMapVisible, gpmHistoricalMapName, gpmHistoricalNativeMapName,
    gpmHistoricalNativeMapFlag, gpmHistoricalNativeMapActor, gpmHistoricalCountryRetired, gpmHistoricalNationLabel,
    gpmHistoricalLabelOwnerAt, gpmHistoricalLabelCells, gpmHistoricalProvinceColor,
    gpmHistoricalAreaMask, gpmHistoricalPaintFills, gpmHistoricalMapOpenFront, gpmHistoricalSelectMapFront,
    gpmHistoricalFrontsAt, gpmHistoricalFactionCountry, gpmOpenHistoricalCountry, gpmHistoricalFactionActions,
    gpmHistoricalRunFactionAction, gpmHistoricalWarHighlight, gpmHistoricalOpenFaction, gpmHistoricalNamedFaction, gpmDropHistoricalLabel, gpmHistoricalLabelMesh,
    gpmHistoricalLabelPath, gpmHistoricalProvinceGroups, gpmHistoricalAreaLabel, gpmHistoricalAreaAt, gpmHistoricalClickProvince,
    gpmHistoricalMapPopup, gpmMountHistoricalMap, gpmClearHistoricalMap,
    gpmHistoricalPoliticalEdge, gpmHistoricalPoliticalBorders, gpmPaintHistoricalMap,
    gpmPrefetchHistoricalMap, gpmPrepareHistoricalMap, gpmRefreshHistoricalMap, gpmPositionHistoricalMap, gpmHistoricalMapHover, gpmHistoricalMapHoverAt,
    gpmRenderHistoricalMapTip];
  const mount = "\nmountPartyButtons();\n";
  let js = replaceOnce(source, mount, "\nconst gpmHistoricalMapColors = " + JSON.stringify(colors) +
    ";\nconst gpmHistoricalOpeningAreas = " + JSON.stringify(openingControlAreas) +
    ";\nconst gpmHistoricalCompactFactionNames = " + JSON.stringify(compactFactionNames) +
    ";\nconst gpmHistoricalLabelPathCacheLimit = " + labelPathCacheLimit +
    ";\nconst gpmHistoricalMapStyle = " + JSON.stringify(style) + ";\n" + functions.join("\n") + mount);
  const areaUniformValues = openingControlAreas.map((area, index) =>
    `gpmHistoricalAreaBounds${index}:{value:[0,0,0,0]},gpmHistoricalAreaProvince${index}:{value:-1},`).join("");
  const areaUniforms = openingControlAreas.map((area, index) =>
    `uniform vec4 gpmHistoricalAreaBounds${index};\n        uniform float gpmHistoricalAreaProvince${index};`)
    .join("\n        ");
  const areaPicked = openingControlAreas.map((area, index) =>
    `abs(pid - gpmHistoricalAreaProvince${index}) < 0.5`);
  const areaPaint = openingControlAreas.map((area, index) => `if (${areaPicked[index]}) {
                vec2 areaUV = (vec2(lon, lat) - gpmHistoricalAreaBounds${index}.xy) * gpmHistoricalAreaBounds${index}.zw;
                if (all(greaterThanEqual(areaUV, vec2(0.0))) && all(lessThan(areaUV, vec2(1.0)))) {
                  vec2 atlasUV = vec2((areaUV.x + ${index}.0) / ${openingControlAreas.length}.0, areaUV.y);
                  base = overLayer(base, texture2D(gpmHistoricalAreaAtlas, atlasUV), 1.0);
                }
              }`).join("\n              ");
  js = replaceOnce(js, 'polTex:{value:this.polTexture},uCountryTexW:',
    `polTex:{value:this.polTexture},gpmHistoricalFill:{value:null},gpmHistoricalFillOn:{value:0},gpmHistoricalAreaAtlas:{value:null},${areaUniformValues}uCountryTexW:`);
  js = replaceOnce(js, 'uniform sampler2D polTex;\n        uniform float uCountryTexW;',
    `uniform sampler2D polTex;\n        uniform sampler2D gpmHistoricalFill;\n        uniform float gpmHistoricalFillOn;\n        uniform sampler2D gpmHistoricalAreaAtlas;\n        ${areaUniforms}\n        uniform float uCountryTexW;`);
  js = replaceOnce(js, 'if (uChoroPrevMix > 0.001) {\n            vec4 choroPrevSample',
    `if (gpmHistoricalFillOn > 0.5 && pid > -0.5 && uAttack < 0.5) {
            vec4 historical = texture2D(gpmHistoricalFill, choroProvinceUv);
            base = overLayer(base, historical, 1.0);
            if (${areaPicked.join(" || ")}) {
              vec3 normal = normalize(vPos);
              float lon = mod(degrees(atan(normal.z, -normal.x)), 360.0) - 180.0;
              float lat = degrees(asin(clamp(normal.y, -1.0, 1.0)));
              ${areaPaint}
            }
          }
          if (uChoroPrevMix > 0.001) {
            vec4 choroPrevSample`);
  js = replaceOnce(js, 'this.fillMesh.visible=this._attack||(this._strategicMix',
    'this.fillMesh.visible=(this.activeBody==="earth"&&e.gpmHistoricalFillOn.value>.5)||this._attack||(this._strategicMix');
  js = replaceOnce(js, 'this._prevBodyQuat=a.quaternion.clone(),this.activeBody=e}else{let n=this._earthCam',
    `this._prevBodyQuat=a.quaternion.clone(),this.activeBody=e;
    if(t==="earth"){
      if(this.camera.near===.004){this.camera.near=.1;this.camera.updateProjectionMatrix()}
      if(this._savedNear===.004)this._savedNear=.1;
    }
    }else{let n=this._earthCam`);
  js = replaceOnce(js, " + gpmHistoricalConflictsStyle;", " + gpmHistoricalConflictsStyle + gpmHistoricalMapStyle;");
  js = replaceOnce(js, 'var w1e=["climate-tip","climate-stress-tip","war-target-tip"]',
    'var w1e=["climate-tip","climate-stress-tip","war-target-tip","gpm-history-map-tip"]');
  js = replaceOnce(js, 'else{n.classList.remove(...w1e);let r=String(e);(n.childElementCount||n.textContent!==r)&&(n.textContent=r)}this._positionTip(t,a)',
    'else if(e?.type==="gpmHistoricalMap")gpmRenderHistoricalMapTip(n,e);else n.classList.remove(...w1e),n.textContent=String(e);this._positionTip(t,a)');
  js = replaceOnce(js, 'let n=L3&&Me._latLonAt&&Me.interactive&&!Me._dragging?Me._latLonAt(e.clientX,e.clientY):null,r=',
    'const gpmHistoryTip=gpmHistoricalMapHoverAt(e);if(gpmHistoryTip){Se._hideTooltip?.();Se.tooltip(gpmHistoryTip,e.clientX,e.clientY);return}let n=L3&&Me._latLonAt&&Me.interactive&&!Me._dragging?Me._latLonAt(e.clientX,e.clientY):null,r=');
  js = replaceOnce(js, 'e?Se.tooltip(u6e(e),nm[0],nm[1]):Se.tooltip(null)},Me.onBodyRegionHover=',
    'e?Se.tooltip(gpmHistoricalMapHover(Me,Me._hoverLL)||u6e(e),nm[0],nm[1]):Se.tooltip(null)},Me.onBodyRegionHover=');
  js = replaceOnce(js,
    "r=Mr.localPolityForProvince?.(n),i=r?Vue(r,e):e.__label;if(Ve&&L3",
    "r=Mr.localPolityForProvince?.(n),i=gpmHistoricalNativeMapName(r?.__key||e.__key,r?Vue(r,e):e.__label);if(Ve&&L3");
  js = replaceOnce(js, 'let i=(e.__name||"").toLocaleUpperCase(ee())',
    'let i=gpmHistoricalNationLabel(this,e)');
  js = replaceOnce(js, 'for(let[n,r]of this._nlNodes){let i=this._polPalette.get(n);',
    'for(let[n,r]of this._nlNodes){if(n.startsWith("gpm-historical-")){const key=n.split("#",1)[0];if(gpmHistoricalCountryRetired(this,key)){this._nlDropAll(key);continue}}let i=this._polPalette.get(n);');
  js = replaceOnce(js, '_nlOwnerAt(e,t){let a=this._pickData;',
    '_nlOwnerAt(e,t){let gpmOwner=gpmHistoricalLabelOwnerAt(this,e,t);if(gpmOwner>=0)return gpmOwner;let a=this._pickData;');
  js = replaceOnce(js, 'let a=(this._atlasMix||0)*Pt.clamp((e-.1)/.45,0,1)',
    'let a=(this._atlasMix||0)*Pt.clamp((e-.1)/.45,0,1)*(this.activeBody==="earth"&&Xsa("earth")==="atlas"&&this._mode==="game"?Pt.smoothstep(this.camera.position.length(),vT.sm,qRe):1)');
  js = replaceOnce(js, "if(t.visible!==n&&(t.visible=n),!!n)for(let r of this._nlNodes.values())",
    "if(this._gpmHistoricalMap){let gpmMap=this._gpmHistoricalMap;gpmMap.atlasLabelOpacity=this.interactive&&this.activeBody===\"earth\"&&Xsa(\"earth\")===\"atlas\"?this._polMix||0:0;for(let gpmLabel of gpmMap.nativeLabels?.values()||[])gpmLabel.mesh.material.opacity=gpmMap.atlasLabelOpacity}if(t.visible!==n&&(t.visible=n),!!n)for(let r of this._nlNodes.values())");
  js = replaceOnce(js, "this._atlasHold=Pt.smoothstep(n,vT.sm,qRe)",
    'this._atlasHold=this.activeBody==="earth"&&Xsa("earth")==="atlas"&&this._mode==="game"?1:Pt.smoothstep(n,vT.sm,qRe)');
  js = replaceOnce(js, 'name:j(n||{key:a,name:e.__label||""},a),flagUrl:Li(n?.a2)||""',
    'name:gpmHistoricalNativeMapName(a,j(n||{key:a,name:e.__label||""},a)),flagUrl:gpmHistoricalNativeMapFlag(a,Li(n?.a2)||"")');
  js = replaceOnce(js, "r=Mr.localPolityForProvince?.(n);if(r){Me.setSelected",
    "r=Mr.localPolityForProvince?.(n);if(gpmHistoricalClickProvince(Me,n,t))return;if(r){Me.setSelected");
  js = replaceOnce(js, "resetSessionVisuals(){this._resetStrikes()", "resetSessionVisuals(){gpmClearHistoricalMap(this);this._resetStrikes()");
  js = replaceOnce(js, "this._updateBaseMarkers(),this._updateFormationMarkers()",
    "this._updateBaseMarkers(),gpmPositionHistoricalMap(this),this._updateFormationMarkers()");
  js = replaceOnce(js, 'QK("load",u?.saveRepairs)', 'QK("load",u?.saveRepairs),gpmPrefetchHistoricalMap(s)');
  js = replaceOnce(js, 'Ws.applyWorld(),Ws.syncLights()', 'Ws.applyWorld(),Ws.structure()?.bornCountries?.length&&(Me._territoryMutated=!0),Ws.syncLights()');
  // Keep compact border loops aligned with the fine province fill at close zoom.
  js = replaceOnce(js, 'function PAe(e,t,a,n){if(!e||e.length<2)return;',
    `function PAe(e,t,a,n){if(!e||e.length<2)return;
    const first=e[0],last=e[e.length-1];
    if(a===.012&&t===ht*1.00135&&first[0]===last[0]&&first[1]===last[1]&&
      e.every(([lon,lat])=>Math.hypot(lon-first[0],lat-first[1])<10*a)){
      a=Number.EPSILON;t=ht*1.0008;
    }`);
  js = replaceOnce(js, 'provinceBordersFor:X,adjacency:A', `provinceBordersFor:X,gpmPartyMapFeatures:gpmCreatePartyMapFeatures(t,N),gpmPoliticalEdges:classify=>{
    const edges={control:{type:"MultiLineString",coordinates:[]},captured:{type:"MultiLineString",coordinates:[]}};
    for(const [arc,owners] of se){
      if(owners.length!==2)continue;
      const kind=classify(p[owners[0]],p[owners[1]]);
      if(kind)edges[kind].coordinates.push(N(arc));
    }
    return edges;
  },adjacency:A`);
  js = replaceOnce(js, 'Me._forceStrategic=!1,Xu("earth"),Me.capitalPop=',
    'ela("earth","atlas"),Xu("earth"),Me.capitalPop=');
  js = replaceOnce(js, 'Se.showScreen("game"),ct("hud-focus")',
    'await gpmPrepareHistoricalMap(Me,Ve),Se.showScreen("game"),gpmPositionHistoricalMap(Me),ct("hud-focus")');
  js = replaceOnce(js, 'nut(Ws.applyTerritoryChange(m)),DB.clear(),NR()',
    'nut(Ws.applyTerritoryChange(m)),DB.clear(),NR();void gpmRefreshHistoricalMap(Me,Ve,true)');
  js = replaceOnce(js, "Ws.onTerritoryProjected=m=>{Me._territoryMutated=!0,nut(m)}",
    "Ws.onTerritoryProjected=m=>{Me._territoryMutated=!0,nut(m);void gpmRefreshHistoricalMap(Me,Ve,true)}");
  js = replaceOnce(js, '{id:"module",run:()=>Se.refreshTabTick(Ve,e)},',
    '{id:"module",run:()=>Se.refreshTabTick(Ve,e)},{id:"ppo-historical-map",run:()=>{void gpmRefreshHistoricalMap(Me,Ve)}},');
  return js;
}

module.exports = { patchHistoricalConflictMapRenderer };



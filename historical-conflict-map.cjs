"use strict";

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
  .gpm-history-map-marker[data-location="country"]::before { background: #121a22; border-color: var(--ink); }
  .gpm-history-map-marker:is(:hover, :focus-visible)::before { outline: 2px solid #fff; outline-offset: 2px; }
  .gpm-history-map-popup { position: fixed; z-index: 27; max-height: 300px; overflow: auto; }
  .gpm-history-map-popup button { text-align: start; }
  .gpm-history-map-popup small { display: block; }
  #tooltip.gpm-history-map-tip { max-width: min(350px, 90vw); white-space: normal; }
  .gpm-history-map-tip section { border-top: 1px solid #8995a045; padding-top: 3px; }
  .gpm-history-map-tip small { display: block; }
  .gpm-history-map-tip img {
    width: 16px; height: 11px; margin-inline-end: 4px; object-fit: contain; vertical-align: middle;
  }
`;

const colors = {
  contested: 0xc5cbd2,
  captured: 0xffd94a,
  active: 0xfb7665,
  occupation: 0xc3a1fa,
  ceasefire: 0x69d0b8,
  suspended: 0x9bacbc,
};

function gpmHistoricalMapStatus(fronts) {
  if (fronts.some(front => front.contested)) return "contested";
  return Object.keys(gpmHistoricalMapColors).find(status => fronts.some(front => front.status === status)) || "suspended";
}

function gpmHistoricalMapInk(status) {
  return "#" + gpmHistoricalMapColors[status].toString(16).padStart(6, "0");
}

function gpmHistoricalMapVisible(globe) {
  return globe?._mode === "game" && globe.activeBody === "earth" && !globe._cinema && !globe._militaryMode &&
    !he.warRoomActive && !he.resRoomActive && !he.energyRoomActive && !he.baseRoomActive &&
    !he.transportRoomActive && !he.publicFacilityPlannerActive && !he.gpmRegionalActive && !sCt();
}

function gpmHistoricalNativeMapName(key, fallback) {
  const actor = gpmHistoricalNativeMapActor(key);
  return actor?.mapName || (key === "gpm-historical-sdn-rsf" ? "Rapid Support Forces" : fallback);
}

function gpmHistoricalNativeMapFlag(key, fallback) {
  return gpmHistoricalNativeMapActor(key)?.identity?.flag?.image || fallback;
}

function gpmHistoricalNativeMapActor(key) {
  if (typeof key !== "string" || !key.startsWith("gpm-historical-") || typeof ke === "undefined") return null;
  const state = ke?._gpmHistoricalMap;
  const id = state?.data?.nativeCountryActors?.[key] || (key === "gpm-historical-sdn-rsf" ? "sdn-rsf" : null);
  return id ? state?.actors[id] : null;
}

function gpmHistoricalProvinceColor(value) {
  if (Array.isArray(value) && value.length === 3 && value.every(Number.isFinite)) {
    return value.map(channel => Math.round(Math.max(0, Math.min(255, channel))));
  }
  if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value)) return null;
  return [1, 3, 5].map(offset => Number.parseInt(value.slice(offset, offset + 2), 16));
}

function gpmHistoricalPaintFills(globe, state) {
  const uniforms = globe.fillMat?.uniforms;
  if (!uniforms || !globe._provDataW || !globe._provDataH) return;
  state.paletteSignature = globe._polCountrySignature;
  if (!state.fills.size && !state.fillTexture) return;
  if (!state.fillTexture) {
    const width = globe._provDataW;
    const height = globe._provDataH;
    state.fillPixels = new Uint8Array(width * height * 4);
    state.fillTexture = new Cn(state.fillPixels, width, height, Oa);
    state.fillTexture.minFilter = Xn;
    state.fillTexture.magFilter = Xn;
  }
  const palette = globe.politicalPalette();
  const color = (key, fallback) => palette.get(key)?.fill || gpmHistoricalProvinceColor(fallback);
  const pixels = state.fillPixels;
  pixels.fill(0);
  let count = 0;
  for (const [provinceId, { front, ownerKey }] of state.fills) {
    const actor = state.actors[front.controllerId || front.administratorId];
    const owner = color(ownerKey);
    const primary = color(front.dominantKey || front.occupationKey || actor?.countryKey, front.dominantColor || actor?.color) || owner;
    if (!primary || provinceId < 0 || provinceId * 4 >= pixels.length) continue;
    const secondary = color(front.secondaryKey) || owner;
    const opposing = secondary && secondary.some((channel, index) => channel !== primary[index])
      ? secondary : primary.map(channel => (channel + 116) / 2);
    const dominance = Number.isFinite(front.dominance) ? Math.max(.5, Math.min(.94, front.dominance)) : .67;
    const ink = front.captured ? primary : primary.map((channel, index) => Math.round(channel * dominance + opposing[index] * (1 - dominance)));
    pixels.set([...ink, front.captured ? 255 : 239], provinceId * 4);
    count++;
  }
  state.hasFills = count > 0;
  state.fillTexture.needsUpdate = true;
  uniforms.gpmHistoricalFill.value = state.fillTexture;
  state.presentationDirty = true;
}

function gpmHistoricalMapOpenFront(front, provinceKey = null) {
  const state = he._gpmHistory;
  if (state?.session === ze && state.busy) return;
  he._gpmHistoryMapSelection = { session: ze, id: front.id, provinceKey };
  if (he.activeModule === "military" && he._subSel.military === "historical-conflicts") {
    gpmHistoricalConflictsView(K("content-body")?.querySelector("[data-gpm-history]"), he, ze);
  } else {
    he.openModule("military", "historical-conflicts");
  }
}

function gpmHistoricalMapPopup(state, item, button) {
  he.tooltip(null);
  if (item.fronts.length === 1) {
    gpmHistoricalMapOpenFront(item.fronts[0], item.provinceKey);
    return;
  }
  const popup = state.popup;
  popup.replaceChildren();
  const title = document.createElement("strong");
  title.textContent = item.name;
  popup.append(title);
  if (!item.provinceKey) {
    const detail = document.createElement("small");
    detail.textContent = "Country location only";
    popup.append(detail);
  }
  for (const front of item.fronts) {
    const choice = document.createElement("button");
    choice.type = "button";
    choice.className = "k k-sm";
    choice.textContent = front.name;
    choice.addEventListener("click", () => {
      popup.hidden = true;
      gpmHistoricalMapOpenFront(front, item.provinceKey);
    });
    popup.append(choice);
  }
  state.opener = button;
  const box = button.getBoundingClientRect();
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
      <span><i style="--ink:${gpmHistoricalMapInk("contested")}" aria-hidden="true"></i>Contested areas use the dominant side’s hue</span>
      <span><i style="--ink:${gpmHistoricalMapInk("captured")}" aria-hidden="true"></i>Yellow border shows captured territory</span>
      <small>Strategic view shows situation outlines and hollow pins. Hollow pins mark country-level locations.</small>
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
    state.popup.hidden = true;
    if (state.data) gpmPaintHistoricalMap(globe, state, state.data);
  });
  legend.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    showLegend(false);
    toggle.focus({ preventScroll: true });
  });
  Xe("view-toggle")?.after(state.controls);
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
    if (!event.target.closest("[data-gpm-history-front-marker]") && !state.popup.contains(event.target)) {
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
  for (const border of state.borders.values()) {
    border.mesh.removeFromParent();
    border.casingMesh.removeFromParent();
    border.mesh.geometry.dispose();
    border.mat.dispose();
    border.casingMat.dispose();
    for (const material of [border.mat, border.casingMat]) {
      const index = globe._lineMats.indexOf(material);
      if (index >= 0) globe._lineMats.splice(index, 1);
    }
  }
  if (state.markerLayer) {
    Cot(globe).clear("gpm-history");
    state.markerLayer.hidden = true;
  }
  const uniforms = globe.fillMat?.uniforms;
  if (uniforms?.gpmHistoricalFill) {
    uniforms.gpmHistoricalFill.value = null;
    uniforms.gpmHistoricalFillOn.value = 0;
  }
  state.fillTexture?.dispose();
  globe._refreshFillVis?.();
  state.controls.remove();
  state.popup.remove();
  state.removeListener();
  globe._gpmHistoricalMap = null;
}

function gpmPaintHistoricalMap(globe, state, data) {
  state.data = data;
  const lines = new Map(Object.keys(gpmHistoricalMapColors).map(status => [status, { keys: [], rings: [] }]));
  const regions = new Map();
  const fills = new Map();
  const locations = [];
  const provinceByKey = globe.world.provByKey || new Map(globe.world.provinces.map(province => [province.__provKey, province]));
  for (const region of data.regions) {
    const province = provinceByKey.get(region.key);
    if (!province) continue;
    const shown = region.fronts.filter(front => state.statusFilter.has(front.status));
    if (!shown.length) continue;
    const name = Ut(region.key, region.name || province.__name);
    regions.set(region.key, { ...region, name, fronts: shown });
    const shape = province.geometry;
    const nativeCapture = shown.find(front => front.captured && !front.contested);
    const contested = shown.find(front => front.contested && (front.dominantKey || front.dominantColor)) ||
      shown.find(front => front.contested);
    const colorFront = nativeCapture || contested;
    if (colorFront && Number.isInteger(province.__provId)) {
      fills.set(province.__provId, { front: colorFront, ownerKey: province.__polityKey || province.__countryKey });
    }
    const background = shown.filter(front => !front.native);
    const status = nativeCapture ? "captured" : contested ? "contested" : background.length ? gpmHistoricalMapStatus(background) : null;
    const hasShape = shape?.type === "Polygon" || shape?.type === "MultiPolygon";
    if (status && hasShape) {
      const line = lines.get(status);
      line.keys.push(region.key);
      line.rings.push(...(shape.type === "Polygon" ? shape.coordinates : shape.coordinates.flat()));
    } else if (!hasShape && background.length && province.__centroid?.every(Number.isFinite)) {
      locations.push({ id: region.key, provinceKey: region.key, name, fronts: background, status,
        coords: province.__centroid });
    }
  }
  const countries = new Map();
  for (const front of data.unmappedFronts || []) {
    if (!state.statusFilter.has(front.status)) continue;
    for (const key of front.countryKeys || []) {
      const countryKey = String(key);
      const country = globe.world.byKey?.get(countryKey) ||
        globe.world.byKey?.get(countryKey.padStart(3, "0"));
      if (!country?.__centroid?.every(Number.isFinite)) continue;
      if (!countries.has(country.__key)) {
        countries.set(country.__key, { id: "country:" + country.__key, name: U(country.__key),
          coords: country.__centroid, fronts: [] });
      }
      countries.get(country.__key).fronts.push(front);
    }
  }
  for (const country of countries.values()) {
    locations.push({ ...country, status: gpmHistoricalMapStatus(country.fronts) });
  }
  for (const [status, line] of lines) {
    const current = state.borders.get(status);
    const signature = line.keys.sort().join("|");
    if (current?.signature === signature || !current && !signature) continue;
    const geometry = { type: "MultiLineString", coordinates: line.rings };
    if (current) {
      Mut(current, geometry, yt * 1.0021, .018);
      current.signature = signature;
    } else {
      const captured = status === "captured";
      const border = GO(globe, geometry, { radius: yt * 1.0021, minDeg: .018, order: captured ? 43 : 40,
        color: gpmHistoricalMapColors[status], width: captured ? 2.4 : 1.05, opacity: captured ? .99 : .56,
        casingColor: 0x111920, casingWidth: captured ? 4.1 : 1.9, casingOpacity: captured ? .8 : .4 });
      state.borders.set(status, { ...border, signature });
    }
  }
  state.regions = regions;
  state.actors = data.actors || {};
  state.fills = fills;
  gpmHistoricalPaintFills(globe, state);
  const nativeNames = new Map(Object.entries(data.nativeCountryActors || {}).map(([key, id]) => [key, state.actors[id]?.mapName]));
  for (const [key, name] of nativeNames) {
    const feature = globe.world.byKey?.get(key);
    const previous = state.nativeNames?.get(key);
    if (name && name !== previous && feature && globe._nlNodes?.has(key)) globe._nlBuild(feature);
  }
  state.nativeNames = nativeNames;
  const markerLayout = dd(globe, "gpm-history", locations, {
    layerClass: "gpm-history-map-locations",
    contentKey: item => JSON.stringify([item.name, item.status, item.fronts.map(front => [front.id, front.name, front.status])]),
    projectionKey: item => item.coords.join("|"),
    createElement: () => {
      const button = document.createElement("button");
      button.className = "gpm-history-map-marker";
      button.type = "button";
      button.hidden = true;
      button.setAttribute("data-gpm-history-front-marker", "");
      button.addEventListener("click", event => {
        event.stopPropagation();
        gpmHistoricalMapPopup(state, button._gpmHistoricalLocation, button);
      });
      const tooltip = (x, y) => {
        const region = button._gpmHistoricalLocation;
        if (region && state.popup.hidden) he.tooltip({ type: "gpmHistoricalMap", region, actors: state.actors,
          wholeCountry: !region.provinceKey }, x, y);
      };
      button.addEventListener("pointermove", event => {
        event.stopPropagation();
        tooltip(event.clientX, event.clientY);
      });
      button.addEventListener("pointerleave", () => he.tooltip(null));
      button.addEventListener("focus", () => {
        const box = button.getBoundingClientRect();
        tooltip(box.right, box.bottom);
      });
      button.addEventListener("blur", () => he.tooltip(null));
      return button;
    },
    patch: ({ el }, item) => {
      el._gpmHistoricalLocation = item;
      el.dataset.fronts = item.fronts.map(front => front.id).join(" ");
      el.dataset.location = item.provinceKey ? "province" : "country";
      if (item.provinceKey) el.dataset.provinceKey = item.provinceKey;
      else el.dataset.countryKey = item.id.slice("country:".length);
      el.style.setProperty("--ink", gpmHistoricalMapInk(item.status));
      const label = item.name + (item.provinceKey ? "" : " · Country location only") + " · " +
        (item.fronts.length === 1 ? item.fronts[0].name : item.fronts.length + " conflicts");
      el.setAttribute("aria-label", label);
    },
    project: item => {
      const position = ft(item.coords[1], item.coords[0], yt);
      return { pos: position, nrm: position.clone().normalize() };
    },
  });
  state.markerLayer = markerLayout.layer;
  state.markers = markerLayout.nodes;
  state.hasData = !!(data.regions.length || data.unmappedFronts?.length);
  state.presentationDirty = true;
  state.viewMatrix = null;
  gpmPositionHistoricalMap(globe);
  globe._frameGate.invalidate();
}

async function gpmRefreshHistoricalMap(globe, session, territoryChanged = false) {
  if (!globe || !session) return;
  const state = globe._gpmHistoricalMap || gpmMountHistoricalMap(globe, session);
  if (territoryChanged) {
    state.lastDay = -1;
    state.lastRequest = -Infinity;
    state.territoryRevision = (state.territoryRevision || 0) + 1;
  }
  const now = performance.now();
  if (state.session !== session || state.pending || state.lastDay === session.day ||
      now - state.lastRequest < 1500) return;
  state.pending = true;
  state.lastRequest = now;
  const day = session.day;
  const revision = state.territoryRevision;
  try {
    const result = await at(session, "gpm.historicalMap");
    if (globe._gpmHistoricalMap === state && ze === session && revision === state.territoryRevision &&
        Array.isArray(result?.regions)) {
      gpmPaintHistoricalMap(globe, state, result);
      state.lastDay = day;
    }
  } catch (error) {
    console.warn("[PPO] Historical conflict map could not refresh", error);
  } finally {
    state.pending = false;
    if (globe._gpmHistoricalMap === state && ze === session && revision !== state.territoryRevision) {
      void gpmRefreshHistoricalMap(globe, session);
    }
  }
}

function gpmPositionHistoricalMap(globe) {
  const state = globe._gpmHistoricalMap;
  if (!state?.hasData) return;
  const allowed = gpmHistoricalMapVisible(globe);
  const visible = allowed && state.statusFilter.size > 0;
  const political = !!globe._politicalMap;
  const showSituation = visible && iCt("earth") === "strategic";
  if (state.paletteSignature !== globe._polCountrySignature) gpmHistoricalPaintFills(globe, state);
  const fillUniform = globe.fillMat?.uniforms.gpmHistoricalFillOn;
  const fillShown = Number(visible && !!state.hasFills && political);
  if (fillUniform && fillUniform.value !== fillShown) {
    fillUniform.value = fillShown;
    globe._refreshFillVis();
  }
  if (state.allowed !== allowed || state.visible !== visible || state.political !== political ||
      state.showSituation !== showSituation || state.presentationDirty) {
    state.allowed = allowed;
    state.visible = visible;
    state.political = political;
    state.showSituation = showSituation;
    state.presentationDirty = false;
    state.controls.hidden = !allowed;
    if (!showSituation) {
      state.popup.hidden = true;
      state.viewMatrix = null;
    }
    for (const [status, border] of state.borders) {
      const shown = status === "captured" ? visible && political :
        status === "contested" ? visible : showSituation;
      DP(border, shown && border.count > 0);
    }
    state.markerLayer.hidden = !showSituation;
  }
  if (!showSituation) return;
  const camera = globe.camera;
  const cameraDirection = camera.position;
  const horizon = yt;
  const point = state.point ||= new ne;
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
  if (!coords || !state?.regions.size || !gpmHistoricalMapVisible(globe)) return null;
  const [lat, lon] = coords;
  const province = globe.world.provinces[globe._provinceAt(lon, lat)];
  const region = state.regions.get(province?.__provKey);
  return region ? { type: "gpmHistoricalMap", region, actors: state.actors } : null;
}

function gpmHistoricalMapHoverAt(event) {
  if (!ke || event.target !== ke.renderer.domElement || !ke.interactive || ke._dragging ||
      !ke._gpmHistoricalMap?.regions.size || !gpmHistoricalMapVisible(ke)) return null;
  return gpmHistoricalMapHover(ke, ke._latLonAt(event.clientX, event.clientY));
}

function gpmRenderHistoricalMapTip(node, { region, actors, wholeCountry }) {
  const flag = media => {
    const image = media?.image;
    return typeof image === "string" && /^data:image\/(?:png|jpeg|webp|svg\+xml);base64,/.test(image)
      ? `<img src="${b(image)}" alt="${b(media.name || "")}">` : "";
  };
  const shownFronts = region.fronts.slice(0, 3).map(front => {
    const heading = `<b>${b(front.name)}</b><small>${b(gpmHistoricalLabel(front.status))}</small>`;
    if (wholeCountry) {
      const actorLabels = (front.actorIds || []).map(id => actors[id]).filter(Boolean).map(actor =>
        `<small>${flag(actor.identity?.flag)}${b(actor.shortName || actor.name)}</small>`);
      return `<section>${heading}${actorLabels.join("")}</section>`;
    }
    const controller = actors[front.controllerId];
    const administrator = actors[front.administratorId];
    const controllerName = (controller?.shortName || controller?.name) || (front.occupationKey && U(front.occupationKey));
    const dominator = front.dominantKey && front.dominantKey === front.secondaryKey ? null :
      controllerName || (front.dominantKey && U(front.dominantKey));
    const localControl = front.captured && !front.contested ? `Captured · ${controllerName || dominator || "Unspecified"}`
      : front.contested ? `Contested${dominator ? " · " + dominator + " dominant" : ""}` : controllerName || "Unspecified";
    const civilAuthority = administrator?.id !== "sdn-rsf" && (administrator?.administrationName || administrator?.name);
    const parties = !controller && !front.occupationKey ? (front.actorIds || []).map(id => actors[id]).filter(Boolean) : [];
    return `<section>${heading}
      <small>Military control · ${flag(controller?.identity?.flag)}${b(localControl)}</small>
      ${civilAuthority ? `<small>Administration · ${flag(administrator?.identity?.administrationFlag)}${b(civilAuthority)}</small>` : ""}
      ${parties.map(actor => `<small>${flag(actor.identity?.flag)}${b(actor.shortName || actor.name)}</small>`).join("")}</section>`;
  }).join("");
  const html = `<strong>${b(region.name)}</strong>` + (wholeCountry ? "<small>Country location only</small>" : "") +
    shownFronts + (region.fronts.length > 3 ? `<small>+${region.fronts.length - 3} more conflicts</small>` : "");
  if (!node.classList.contains("gpm-history-map-tip") || node._gpmHistoricalMapHtml !== html) {
    node.classList.remove(...bae);
    node.classList.add("gpm-history-map-tip");
    node.innerHTML = html;
    node._gpmHistoricalMapHtml = html;
  }
}

function patchHistoricalConflictMapRenderer(source, replaceOnce) {
  const functions = [gpmHistoricalMapStatus, gpmHistoricalMapInk, gpmHistoricalMapVisible, gpmHistoricalNativeMapName,
    gpmHistoricalNativeMapFlag, gpmHistoricalNativeMapActor, gpmHistoricalProvinceColor, gpmHistoricalPaintFills, gpmHistoricalMapOpenFront,
    gpmHistoricalMapPopup, gpmMountHistoricalMap, gpmClearHistoricalMap, gpmPaintHistoricalMap,
    gpmRefreshHistoricalMap, gpmPositionHistoricalMap, gpmHistoricalMapHover, gpmHistoricalMapHoverAt,
    gpmRenderHistoricalMapTip];
  const mount = "\nmountPartyButtons();\n";
  let js = replaceOnce(source, mount, "\nconst gpmHistoricalMapColors = " + JSON.stringify(colors) +
    ";\nconst gpmHistoricalMapStyle = " + JSON.stringify(style) + ";\n" + functions.join("\n") + mount);
  js = replaceOnce(js, 'polTex:{value:this.polTexture},uCountryTexW:',
    'polTex:{value:this.polTexture},gpmHistoricalFill:{value:null},gpmHistoricalFillOn:{value:0},uCountryTexW:');
  js = replaceOnce(js, 'uniform sampler2D polTex;\n        uniform float uCountryTexW;',
    'uniform sampler2D polTex;\n        uniform sampler2D gpmHistoricalFill;\n        uniform float gpmHistoricalFillOn;\n        uniform float uCountryTexW;');
  js = replaceOnce(js, 'if (uChoroPrevMix > 0.001) {\n            vec4 choroPrevSample',
    `if (gpmHistoricalFillOn > 0.5 && pid > -0.5 && uAttack < 0.5) {
            vec4 historical = texture2D(gpmHistoricalFill, choroProvinceUv);
            base = overLayer(base, historical, 1.0);
          }
          if (uChoroPrevMix > 0.001) {
            vec4 choroPrevSample`);
  js = replaceOnce(js, 'this.fillMesh.visible=this._attack||(this._strategicMix',
    'this.fillMesh.visible=e.gpmHistoricalFillOn.value>.5||this._attack||(this._strategicMix');
  js = replaceOnce(js, " + gpmHistoricalConflictsStyle;", " + gpmHistoricalConflictsStyle + gpmHistoricalMapStyle;");
  js = replaceOnce(js, 'var bae=["climate-tip","climate-stress-tip","war-target-tip"]',
    'var bae=["climate-tip","climate-stress-tip","war-target-tip","gpm-history-map-tip"]');
  js = replaceOnce(js, 'else n.classList.remove(...bae),n.textContent=String(e);this._positionTip(t,a)',
    'else if(e?.type==="gpmHistoricalMap")gpmRenderHistoricalMapTip(n,e);else n.classList.remove(...bae),n.textContent=String(e);this._positionTip(t,a)');
  js = replaceOnce(js, 'let n=t3&&ke._latLonAt&&ke.interactive&&!ke._dragging?ke._latLonAt(e.clientX,e.clientY):null,r=',
    'const gpmHistoryTip=gpmHistoricalMapHoverAt(e);if(gpmHistoryTip){he.tooltip(gpmHistoryTip,e.clientX,e.clientY);return}let n=t3&&ke._latLonAt&&ke.interactive&&!ke._dragging?ke._latLonAt(e.clientX,e.clientY):null,r=');
  js = replaceOnce(js, 'e?he.tooltip(lFe(e),g1[0],g1[1]):he.tooltip(null),e&&an.sfx("hover")',
    'e?he.tooltip(gpmHistoricalMapHover(ke,ke._hoverLL)||lFe(e),g1[0],g1[1]):he.tooltip(null),e&&an.sfx("hover")');
  js = replaceOnce(js,
    "r=br.localPolityForProvince?.(n),i=r?pX(r,e):e.__label;if(ze&&t3",
    "r=br.localPolityForProvince?.(n),i=gpmHistoricalNativeMapName(r?.__key||e.__key,r?pX(r,e):e.__label);if(ze&&t3");
  js = replaceOnce(js, 'let i=(e.__name||"").toLocaleUpperCase(X())',
    'let i=gpmHistoricalNativeMapName(t,e.__name||"").toLocaleUpperCase(X())');
  js = replaceOnce(js, 'name:U(n||{key:a,name:e.__label||""},a),flagUrl:Cs(n?.a2)||""',
    'name:gpmHistoricalNativeMapName(a,U(n||{key:a,name:e.__label||""},a)),flagUrl:gpmHistoricalNativeMapFlag(a,Cs(n?.a2)||"")');
  js = replaceOnce(js, "resetSessionVisuals(){this._resetStrikes()", "resetSessionVisuals(){gpmClearHistoricalMap(this);this._resetStrikes()");
  js = replaceOnce(js, "this._updateBaseMarkers(),this._updateFormationMarkers()",
    "this._updateBaseMarkers(),gpmPositionHistoricalMap(this),this._updateFormationMarkers()");
  js = replaceOnce(js, 'he.showScreen("game"),Xe("hud-focus")', 'he.showScreen("game"),void gpmRefreshHistoricalMap(ke,ze),Xe("hud-focus")');
  js = replaceOnce(js, "$s.onTerritoryProjected=p=>{ke._territoryMutated=!0,eFe(p)}",
    "$s.onTerritoryProjected=p=>{ke._territoryMutated=!0,eFe(p);void gpmRefreshHistoricalMap(ke,ze,true)}");
  js = replaceOnce(js, '{id:"module",run:()=>he.refreshTabTick(ze,e)},',
    '{id:"module",run:()=>he.refreshTabTick(ze,e)},{id:"ppo-historical-map",run:()=>{void gpmRefreshHistoricalMap(ke,ze)}},');
  const existingPanel = "  if (state.host === host && state.playerKey === session.playerKey) {";
  return replaceOnce(js, existingPanel, `
  const mapSelection = ui._gpmHistoryMapSelection;
  const fromMap = mapSelection?.session === session;
  if (fromMap) {
    ui._gpmHistoryMapSelection = null;
    state.selectedId = mapSelection.id;
    state.regionKey = mapSelection.provinceKey;
    state.filter = "";
    state.query = "";
    state.term = null;
  }
${existingPanel}
    if (fromMap) {
      host.querySelector("[data-history-search]").value = "";
      void state.load(state.selectedId, true);
      return;
    }`);
}

module.exports = { patchHistoricalConflictMapRenderer };

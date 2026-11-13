"use strict";

const style = `
  .gpm-regional-overview { display: grid; gap: var(--gap-2); min-width: 0; }
  .gpm-regional-overview button { justify-self: start; }
  .gpm-support-map { min-width: 0; display: grid; gap: var(--gap-1); padding: var(--gap-2); border: 1px solid var(--line); background: var(--well); border-radius: var(--r-cell); }
  .gpm-support-map svg { display: block; width: 100%; height: auto; }
  .gpm-support-map path { stroke: #202b38; stroke-width: 1; vector-effect: non-scaling-stroke; cursor: pointer; }
  .gpm-support-map path:hover, .gpm-support-map path[data-selected] { stroke: #fff2cb; stroke-width: 2; }
  .gpm-support-insets { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 80px), 1fr)); gap: var(--gap-2); }
  .gpm-support-insets > div { min-width: 0; text-align: center; overflow-wrap: anywhere; }
  .gpm-support-insets svg { max-height: 86px; }
  .gpm-support-scale { display: grid; grid-template-columns: auto minmax(0, 12rem) auto; align-items: center; gap: var(--gap-2); }
  .gpm-support-scale > span { display: flex; height: .5rem; }
  .gpm-support-scale i { flex: 1; }
  .gpm-support-readout { display: flex; align-items: center; flex-wrap: wrap; gap: var(--gap-1) var(--gap-2); }
  .gpm-support-readout select { min-width: 0; max-width: 100%; }
  .gpm-regional-map {
    position: absolute; z-index: 48; top: 76px; right: 16px; bottom: 64px;
    width: min(350px, calc(100% - 32px)); display: grid; align-content: start; gap: 12px;
    box-sizing: border-box; padding: 16px; overflow: auto; color: var(--text, #f0f3f7);
    background: var(--panel, #141c25); border: 1px solid var(--line, #546373); border-radius: 8px;
    box-shadow: 0 8px 24px #0006;
  }
  .gpm-regional-map header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .gpm-regional-map h2, .gpm-regional-map h3, .gpm-regional-map p, .gpm-regional-map dl { margin: 0; }
  .gpm-regional-map small, .gpm-regional-map [data-gpm-region-status] { color: var(--text-2, #b7c6d3); }
  .gpm-regional-map label, .gpm-region-detail { display: grid; gap: 8px; }
  .gpm-regional-map select { width: 100%; }
  .gpm-region-detail dl { display: grid; grid-template-columns: 1fr auto; gap: 4px 12px; }
  .gpm-region-detail dd { margin: 0; text-align: right; font-variant-numeric: tabular-nums; }
  .gpm-region-action { display: grid; gap: 4px; padding-top: 8px; border-top: 1px solid var(--line, #546373); }
  .gpm-region-action button { justify-self: start; }
  @media (max-width: 720px) {
    .gpm-regional-map { top: auto; bottom: 52px; right: 8px; max-height: 46%; width: min(350px, calc(100% - 16px)); }
  }
`;

function gpmRegionalActionName(kind) {
  return { rally: "Hold rally", investment: "Invest in local party", headquarters: "Establish headquarters" }[kind];
}

function gpmRegionalReason(quote, ui) {
  if (!quote || quote.ok) return "";
  if (quote.reason === "cooldown") return "Another rally is available here on " + ui.gameDate(quote.availableDay) + ".";
  return {
    active: "A project of this type is already underway.",
    headquarters: "Your party already has a headquarters.",
    saturated: "Local party presence is at its limit.",
    budget: "The party treasury is too low.",
    resources: "You need more available activists.",
    party: "This action is unavailable for your party.",
    region: "Choose an eligible region in your country.",
  }[quote.reason] || "The action could not be started.";
}

function gpmRegionalRegionName(region) {
  return Gt(region.key, region.name);
}

function gpmRenderRegionalOverview() {
  return `<section class="mcard gpm-regional-overview" aria-label="Regional Campaigning">
    <h3 class="mc-title">Regional party support</h3>
    <div class="gpm-support-map" data-gpm-support-map></div>
    <div class="gpm-support-scale" data-gpm-support-scale></div>
    <label class="gpm-support-readout">Region <select class="k" data-gpm-support-select data-gpm-profile-focus="region"></select></label>
    <small data-gpm-support-readout role="status"></small>
    <button class="k" type="button" data-gpm-open-regional data-gpm-profile-focus="map">Open Campaign Map</button>
  </section>`;
}

function gpmRegionalSupportScale(regions) {
  const colors = [[49, 60, 78], [52, 88, 112], [43, 123, 145], [54, 166, 176], [126, 219, 207]];
  const min = Math.min(...regions.map(region => region.support));
  const max = Math.max(...regions.map(region => region.support));
  const color = support => colors[max > min
    ? Math.min(colors.length - 1, Math.floor((support - min) / (max - min) * colors.length)) : 2];
  return { min, max, colors, color };
}

function gpmBindRegionalOverview(profile, view, ui) {
  const panel = profile.querySelector(".gpm-regional-overview");
  const data = view.party?.regionalCampaign;
  const world = ui.globe?.world;
  if (!panel || !data || (panel._gpmRegionalOverviewData === data && panel._gpmRegionalWorld === world)) return;
  panel._gpmRegionalOverviewData = data;
  panel._gpmRegionalWorld = world;
  const regions = data.regions;
  const map = panel.querySelector("[data-gpm-support-map]");
  const select = panel.querySelector("[data-gpm-support-select]");
  const legend = panel.querySelector("[data-gpm-support-scale]");
  const readout = panel.querySelector("[data-gpm-support-readout]");
  const open = panel.querySelector("[data-gpm-open-regional]");
  if (!regions.length) {
    map.textContent = "Regional support estimates are unavailable.";
    legend.textContent = select.textContent = readout.textContent = "";
    select.disabled = open.disabled = true;
    return;
  }
  select.disabled = open.disabled = false;
  const percent = new Intl.NumberFormat(cs(), { style: "percent", maximumFractionDigits: 2 });
  const format = value => percent.format(value);
  const { min, max, colors, color } = gpmRegionalSupportScale(regions);
  const byId = new Map(regions.map(region => [region.id, region]));
  const names = new Map(regions.map(region => [region.id, gpmRegionalRegionName(region)]));
  const features = regions.map(region => world?.provinces?.[region.id])
    .filter(feature => feature?.geometry && byId.get(feature.__provId)?.key === feature.__provKey);
  const signature = JSON.stringify(features.map(feature => feature.__provKey));
  if (ui._gpmSupportGeometry?.world !== world || ui._gpmSupportGeometry?.signature !== signature) {
    ui._gpmSupportGeometry = { world, signature, layout: XS(features, 620, 350, { pad: 10 }) };
  }
  const layout = ui._gpmSupportGeometry.layout;
  const svg = (paths, width, height) => `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Estimated regional party support">
    ${paths.map(({ provId, d }) => {
      const region = byId.get(provId);
      return `<path d="${b(d)}" data-gpm-support-region="${provId}" fill="rgb(${color(region.support).join(",")})">
        <title>${b(names.get(provId))} · ${b(format(region.support))}</title></path>`;
    }).join("")}</svg>`;
  map.innerHTML = layout ? svg(layout.paths, layout.W, layout.H) +
    (layout.insets.length ? `<div class="gpm-support-insets">${layout.insets.map(inset =>
      `<div>${svg(inset.paths, layout.box, layout.box)}<small>${b(inset.label)}</small></div>`).join("")}</div>` : "")
    : "Map geometry is unavailable. Choose a region below to view its support.";
  legend.innerHTML = layout && max > min ? `<small>${b(format(min))} · Weaker</small><span aria-hidden="true">
    ${colors.map(rgb => `<i style="background:rgb(${rgb.join(",")})"></i>`).join("")}</span><small>${b(format(max))} · Stronger</small>` : "";
  select.innerHTML = [...regions].sort((a, b) => names.get(a.id).localeCompare(names.get(b.id), cs()))
    .map(region => `<option value="${region.id}">${b(names.get(region.id))} · ${b(format(region.support))}</option>`).join("");
  const strongest = regions.reduce((best, region) => region.support > best.support ? region : best);
  const update = region => {
    ui._gpmSupportSelection = { key: data.countryKey, party: data.partyId, province: region.key };
    select.value = String(region.id);
    map.querySelector("[data-selected]")?.removeAttribute("data-selected");
    map.querySelector(`[data-gpm-support-region="${region.id}"]`)?.setAttribute("data-selected", "");
    const leader = view.player.pol.parties.find(party => party.id === region.leadId);
    readout.textContent = `${names.get(region.id)} · ${format(region.support)} estimated vote share` +
      (leader ? ` · ${Sa(leader)} leads` : "") + (region.headquarters ? " · Party headquarters" : "");
    open.onclick = () => gpmOpenRegionalMap(ui, open, region.key);
  };
  const previous = ui._gpmSupportSelection;
  update((previous?.key === data.countryKey && previous.party === data.partyId &&
    regions.find(region => region.key === previous.province)) || strongest);
  select.onchange = () => update(byId.get(Number(select.value)));
  map.onclick = event => {
    const path = event.target.closest("[data-gpm-support-region]");
    if (path) update(byId.get(Number(path.dataset.gpmSupportRegion)));
  };
}

function gpmRenderRegionalMap(ui, state) {
  const { data, view, panel } = state;
  const region = data.regions.find(entry => entry.id === state.selected);
  const active = panel.contains(document.activeElement) ? document.activeElement : null;
  const focusTarget = active?.matches("[data-gpm-region-select]") ? "[data-gpm-region-select]" :
    active?.matches("[data-gpm-region-action]") ? '[data-gpm-region-action="' + active.dataset.gpmRegionAction + '"]' : null;
  const money = amount => nr(amount * 1e6 * sx(), cx());
  const pct = value => new Intl.NumberFormat(cs(), { style: "percent", maximumFractionDigits: 1 }).format(value);
  const points = value => (value > 0 ? "+" : "") + (value * 100).toFixed(2) + " pp";
  const regionName = key => {
    const entry = data.regions.find(item => item.key === key);
    return entry ? gpmRegionalRegionName(entry) : key;
  };
  const options = data.regions.map(entry => [entry, gpmRegionalRegionName(entry)])
    .sort((a, b) => a[1].localeCompare(b[1], cs()))
    .map(([entry, name]) => `<option value="${entry.id}" ${entry.id === region?.id ? "selected" : ""}>${b(name)}</option>`).join("");
  const jobs = data.projects.map(project => `<small>${b(gpmRegionalActionName(project.kind))} · ${b(regionName(project.key))}
    · Finishes ${b(ui.gameDate(project.endDay))}</small>`).join("");
  const headquarters = data.regions.find(entry => entry.headquarters);
  const header = `<small>${b(money(data.treasuryM))} in party funds · ${b(Math.round(data.activistsK * 1000).toLocaleString(cs()))} available activists</small>
    ${headquarters ? `<small>Party headquarters · ${b(gpmRegionalRegionName(headquarters))}</small>` : ""}
    ${jobs}<label>Region <select class="k" data-gpm-region-select ${data.regions.length ? "" : "disabled"}>
      <option value="" ${region ? "" : "selected"}>Choose a region</option>${options}</select></label>`;
  let detail = `<p>${data.regions.length ? "Click a highlighted state or province on the globe." : "No campaign regions are available for this country."}</p>`;
  if (region) {
    const leader = view.player.pol.parties.find(party => party.id === region.leadId);
    const actions = Object.entries(region.quotes).map(([kind, quote]) => {
      const effect = kind === "investment"
        ? pct(quote.chance) + " chance of strong growth. Otherwise you gain a modest local presence."
        : "+" + pct(quote.gain) + " local voting weight" + (kind === "rally" ? " at completion, halving every 45 days." : " while the headquarters is here.");
      const cost = quote.cash == null ? "" : `${money(quote.cash)} · ${Math.round(quote.activistsK * 1000).toLocaleString(cs())} activists · ${quote.days} days`;
      return `<div class="gpm-region-action"><button type="button" class="k" data-gpm-region-action="${kind}"
        ${quote.ok && !state.busy && !state.pending.has(kind) ? "" : "disabled"}>${gpmRegionalActionName(kind)}</button>
        ${cost ? `<small>${b(cost)}</small><small>${b(effect)}</small>` : ""}
        ${quote.ok ? "" : `<small>${b(gpmRegionalReason(quote, ui))}</small>`}</div>`;
    }).join("");
    const last = region.lastAction;
    const receipt = last && { cancelled: "Cancelled", completed: "Completed", strong: "Strong growth", partial: "Modest growth" }[last.result];
    detail = `<div class="gpm-region-detail"><h3>${b(gpmRegionalRegionName(region))}</h3>
      <dl><dt>Estimated party support</dt><dd>${b(pct(region.support))}</dd>
      <dt>Leading party</dt><dd>${b(leader ? Sa(leader) : "—")}</dd>
      <dt>Margin vs. strongest rival</dt><dd>${b(points(region.margin))}</dd>
      <dt>Regional campaign effect</dt><dd>${b(points(region.boost))}</dd>
      <dt>Local party presence</dt><dd>${b(pct(region.presence))}</dd></dl>
      ${receipt ? `<small>${b(gpmRegionalActionName(last.kind))} · ${b(receipt)} · ${b(ui.gameDate(last.day))}</small>` : ""}
      ${actions}</div>`;
  }
  panel.querySelector("[data-gpm-region-content]").innerHTML = header + detail;
  panel.querySelector("[data-gpm-region-status]").textContent = state.status;
  if (focusTarget) {
    const target = panel.querySelector(focusTarget);
    (target?.disabled ? panel.querySelector("[data-gpm-region-select]") : target)?.focus({ preventScroll: true });
  }
  const colors = {};
  for (const entry of data.regions) {
    colors[entry.id] = entry.id === state.selected ? [241, 202, 105, 246]
      : entry.headquarters ? [180, 138, 64, 225] : [63, 144, 168, 185];
  }
  state.globe.setProvinceChoropleth(colors);
}

function gpmRefreshRegionalMap(ui, snapshot = null) {
  const state = ui.gpmRegionalActive;
  if (!state || state.busy) return;
  if (state.session !== ze || !state.panel.isConnected) {
    gpmCloseRegionalMap(ui);
    return;
  }
  const view = Ka(state.session, snapshot);
  const data = view?.party?.regionalCampaign;
  if (!data) return;
  if (data.partyId !== state.data.partyId || data.countryKey !== state.data.countryKey) {
    gpmCloseRegionalMap(ui);
    return;
  }
  if (data !== state.data) {
    state.view = view;
    state.data = data;
    for (const [kind, endDay] of state.pending) {
      if (view.day >= endDay || data.projects.some(project => project.kind === kind)) state.pending.delete(kind);
    }
    gpmRenderRegionalMap(ui, state);
  }
}

function gpmSelectRegionalProvince(ui, id) {
  const state = ui.gpmRegionalActive;
  if (!state || state.busy) return;
  const region = state.data.regions.find(entry => entry.id === id);
  if (id !== null && !region) {
    state.status = "Choose a highlighted region in your country.";
    state.panel.querySelector("[data-gpm-region-status]").textContent = state.status;
    return;
  }
  state.selected = region?.id ?? null;
  state.status = "";
  gpmRenderRegionalMap(ui, state);
}

function gpmRegionalGlobeClick(ui, coords) {
  const state = ui.gpmRegionalActive;
  if (!state) return false;
  if (state.session !== ze) {
    gpmCloseRegionalMap(ui);
    return false;
  }
  if (coords) gpmSelectRegionalProvince(ui, state.globe._provinceAt(coords[1], coords[0]));
  return true;
}

async function gpmSubmitRegionalAction(ui, kind) {
  const state = ui.gpmRegionalActive;
  const region = state?.data.regions.find(entry => entry.id === state.selected);
  if (!region?.quotes[kind]?.ok || state.busy || state.pending.has(kind) || state.session !== ze) return;
  state.busy = true;
  state.status = "Scheduling project…";
  gpmRenderRegionalMap(ui, state);
  let snapshot = null;
  try {
    const result = await Te(state.session, "applyPlayerAction", [{
      verb: "gpm.party.regional." + kind, provinceId: region.id, provinceKey: region.key,
    }]);
    state.status = result?.ok ? "Project scheduled for " + ui.gameDate(result.endDay) + "."
      : gpmRegionalReason(result, ui) || "The action could not be started.";
    if (result?.ok) {
      // Block a second submission against stale quotes until the worker publishes a fresh view.
      state.pending.set(kind, result.endDay);
      try { snapshot = await et(state.session, G.POLITICS); }
      catch (error) { console.error("[PPO] Regional campaign refresh failed", error); }
    }
  } catch (error) {
    console.error("[PPO] Regional campaign action failed", error);
    state.status = "The action could not be started.";
  } finally {
    state.busy = false;
    if (ui.gpmRegionalActive === state) {
      gpmRefreshRegionalMap(ui, snapshot);
      if (ui.gpmRegionalActive === state) gpmRenderRegionalMap(ui, state);
    }
  }
}

async function gpmOpenRegionalMap(ui, button, provinceKey) {
  const session = ui._mpSession;
  if (ui.gpmRegionalActive || session !== ze || !ui.globe || button.disabled) return;
  button.disabled = true;
  try {
    if (ui.globe.activeBody === "moon") await pue("earth");
    await ui.acquireSimulationViewLease("gpm-regional", [G.POLITICS]);
    const view = Ka(session);
    const data = view?.party?.regionalCampaign;
    if (!button.isConnected || session !== ze || !data || ui.globe.activeBody === "moon") {
      await ui.releaseSimulationViewLease("gpm-regional");
      return;
    }
    Xve(ui);
    if (TRt()) Zg(false);
    ui.closeModule();
    ui.deselectCountry();
    const panel = document.createElement("aside");
    panel.className = "gpm-regional-map";
    panel.setAttribute("aria-label", "Regional Campaigning");
    panel.innerHTML = '<header><h2>Regional Campaigning</h2><button class="k k-sm" type="button" data-gpm-region-close>Back to My Party</button></header>' +
      '<div class="gpm-region-detail" data-gpm-region-content></div><small role="status" data-gpm-region-status></small>';
    const globe = ui.globe;
    const selected = data.regions.find(region => region.key === provinceKey)?.id ?? null;
    const state = { session, view, data, globe, panel, selected, busy: false, status: "", pending: new Map(),
      previousStrategic: globe._forceStrategic, previousMap: globe._choroNextKey };
    ui.gpmRegionalActive = state;
    ui.closeGpmRegionalMap = () => gpmCloseRegionalMap(ui);
    Je("screen-game").append(panel);
    panel.addEventListener("click", event => {
      if (event.target.closest("[data-gpm-region-close]")) gpmCloseRegionalMap(ui, true);
      const action = event.target.closest("[data-gpm-region-action]")?.dataset.gpmRegionAction;
      if (action) void gpmSubmitRegionalAction(ui, action);
    });
    panel.addEventListener("change", event => {
      if (event.target.matches("[data-gpm-region-select]")) {
        gpmSelectRegionalProvince(ui, event.target.value === "" ? null : Number(event.target.value));
      }
    });
    Ok("gpm-regional");
    globe._forceStrategic = true;
    globe.setDataMapIdentity("gpm-regional");
    Xu();
    const country = ay(data.countryKey);
    if (country) globe.focusCountry(country, 3.45);
    gpmRenderRegionalMap(ui, state);
    panel.querySelector("[data-gpm-region-close]").focus({ preventScroll: true });
  } catch (error) {
    console.error("[PPO] Regional campaign map failed to open", error);
    if (ui.gpmRegionalActive) gpmCloseRegionalMap(ui);
    else await ui.releaseSimulationViewLease("gpm-regional");
  } finally {
    button.disabled = false;
  }
}

function gpmCloseRegionalMap(ui, returnToParty = false) {
  const state = ui.gpmRegionalActive;
  if (!state) return;
  ui.gpmRegionalActive = null;
  state.panel.remove();
  state.globe.clearChoropleth();
  state.globe.setDataMapIdentity(state.previousMap);
  state.globe._forceStrategic = state.previousStrategic;
  Dk("gpm-regional");
  Xu();
  if (returnToParty && state.session === ze) ui.openModule("politics", "myparty");
  ui.releaseSimulationViewLease("gpm-regional").catch(error => console.error("[PPO] Regional campaign view release failed", error));
}

module.exports = {
  style,
  rendererFunctions: [gpmRegionalActionName, gpmRegionalReason, gpmRegionalRegionName, gpmRenderRegionalOverview,
    gpmRegionalSupportScale, gpmBindRegionalOverview, gpmRenderRegionalMap,
    gpmRefreshRegionalMap, gpmSelectRegionalProvince, gpmRegionalGlobeClick, gpmSubmitRegionalAction,
    gpmOpenRegionalMap, gpmCloseRegionalMap],
};

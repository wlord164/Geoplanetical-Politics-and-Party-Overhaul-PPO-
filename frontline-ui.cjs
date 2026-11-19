"use strict";

const style = `
.gpm-frontline { display: grid; gap: var(--gap-3); min-width: 0; }
.gpm-frontline :is(p,h3,h4,ul) { margin: 0; }
.gpm-frontline button { min-height: 28px; }
.gpm-frontline .k[aria-pressed="true"] { border-color: var(--text); color: var(--text); background: var(--raised); }
.gpm-frontline-war { display: flex; flex-wrap: wrap; gap: var(--gap-2); }
.gpm-frontline-war > .k { text-align: start; }
#war-registry.gpm-frontline-open { align-self: stretch; width: clamp(18rem,27vw,25rem); }
#war-registry.gpm-frontline-open > #war-inspector { display: none; }
.gpm-frontline-dock { padding: var(--gap-4); min-height: 0; overflow: auto; }
.gpm-frontline-dock :is(header, .gpm-frontline-actions) { display: flex; align-items: center; gap: var(--gap-2); flex-wrap: wrap; }
.gpm-frontline-dock header h3 { margin-right: auto; }
.gpm-frontline-feedback { min-height: 1.4em; color: var(--text-2); }
.gpm-frontline-group, .gpm-frontline-editor { display: grid; gap: var(--gap-2); border: 1px solid var(--hairline); padding: var(--gap-3); border-radius: var(--r-sm); }
.gpm-frontline-order { display: grid; gap: var(--gap-2); border-top: 1px solid var(--hairline); padding-top: var(--gap-2); }
.gpm-frontline-order small, .gpm-frontline-group small, .gpm-frontline-editor p { color: var(--text-2); }
.gpm-frontline-order-label { display: flex; gap: var(--gap-2); align-items: center; }
.gpm-frontline-swatch { flex: none; width: 10px; height: 10px; border-radius: 50%; background: var(--frontline-color); }
.gpm-frontline-color { display: flex; align-items: center; gap: var(--gap-2); }
.gpm-frontline-roster { display: grid; gap: 2px; max-height: 26vh; overflow: auto; border-block: 1px solid var(--hairline); padding-block: var(--gap-1); }
.gpm-frontline-roster label { display: grid; grid-template-columns: auto minmax(0,1fr); gap: var(--gap-2); align-items: center; padding: 4px; }
.gpm-frontline-roster small { display: block; }
.gpm-frontline-roster label:has(input:disabled) { color: var(--text-3); }
.gpm-frontline-crosshair { cursor: crosshair !important; touch-action: none; }
.gpm-frontline-selection-box { position: fixed; z-index: 990; pointer-events: none; border: 1px solid #82ddf9; background: #82ddf926; box-shadow: 0 0 0 1px #0a1d3099; }
.gpm-frontline-roster-bar { position: fixed; z-index: 46; bottom: 0; left: 50%; transform: translateX(-50%); display: flex; padding: 4px 6px 0; gap: 5px; max-width: calc(100vw - 26px); overflow-x: auto; box-sizing: border-box; }
body.gpm-frontline-planning #war-console { margin-bottom: calc(var(--pad) + 96px); }
.gpm-frontline-slot { flex: 0 0 var(--frontline-slot-width, 98px); min-width: 0; position: relative; }
.gpm-frontline-slot > button[data-gpm-frontline-slot] { display: grid; grid-template-rows: 16px 52px; align-content: center; justify-items: center; gap: 0; box-sizing: border-box; width: 100%; height: 76px; min-height: 76px; padding: 3px 5px; }
.gpm-frontline-slot-name { color: white; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font: var(--fw-semi) 11px/14px var(--font-display); }
.gpm-frontline-slot [data-slot-state="filled"] .gpm-frontline-slot-name { max-width: calc(100% - 28px); }
.gpm-frontline-slot [data-gpm-frontline-slot][data-slot-state="empty"] { background: #35383e; color: #a4a7ac; }
.gpm-frontline-slot [data-gpm-frontline-slot][data-slot-state="empty"] .gpm-frontline-slot-name { color: #b8bbc2; }
.gpm-frontline-portrait { display: block; width: 42px; height: 52px; border-radius: 3px; object-fit: cover; object-position: top; }
.gpm-frontline-portrait-empty { background: #666a73; opacity: .42; }
.gpm-frontline-slot [data-gpm-frontline-remove-army] { position: absolute; z-index: 1; right: 3px; top: 3px; height: 16px; min-height: 16px; width: 16px; padding: 0; border: 1px solid #9e3139; border-radius: 3px; background: #67282e; color: #fff0f1; font: 700 13px/14px var(--font-display); cursor: pointer; }
.gpm-frontline-slot [data-gpm-frontline-remove-army]:hover { background: #ab3845; }
.gpm-frontline-add-slot { flex: 0 0 48px; box-sizing: border-box; height: 76px; min-height: 76px; font-size: 21px; }
.gpm-frontline-army-meta { display: grid; gap: var(--gap-2); }
.gpm-frontline-army-meta label { display: grid; gap: 2px; min-width: 0; }
.gpm-frontline-army-meta :is(input,select) { width: 100%; box-sizing: border-box; }
.gpm-frontline-arrow-labels { position: fixed; inset: 0; pointer-events: none; z-index: 44; overflow: hidden; }
.gpm-frontline-arrow-label { position: absolute; box-sizing: border-box; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 0 3px; border-radius: 2px; color: white; background: var(--frontline-color); font: var(--fw-semi) 10px/13px var(--font-display); text-shadow: 0 0 2px #000, 0 1px 2px #000; }
`;

const palette = { blue: 0x77a9ff, amber: 0xffb45f, green: 0x82dd87, violet: 0xc490fc, red: 0xff727b, cyan: 0x67d4fb };

function gpmFrontlineMountStyle() {
  if (document.getElementById("gpm-frontline-style")) return;
  const element = document.createElement("style");
  element.id = "gpm-frontline-style";
  element.textContent = gpmFrontlineStyle;
  document.head.append(element);
}

function gpmBuildFrontline(container, ui, session) {
  gpmFrontlineMountStyle();
  container.innerHTML = `<section class="mcard wide gpm-frontline" data-gpm-frontline-entry>
    <h3 class="mc-title">Frontline</h3><p data-gpm-frontline-entry-status role="status">Loading active wars…</p>
    <div class="gpm-frontline-war" data-gpm-frontline-wars></div>
  </section>`;
  const host = container.querySelector("[data-gpm-frontline-entry]");
  host.addEventListener("click", event => {
    const button = event.target.closest("[data-gpm-frontline-open]");
    if (button) void gpmOpenFrontline(ui, session, button.dataset.gpmFrontlineOpen);
  });
  gpmRefreshFrontlineEntry(ui);
}

function gpmRefreshFrontlineEntry(ui) {
  if (ui.activeModule !== "military" || ui._subSel.military !== "frontline") return;
  const host = K("content-body")?.querySelector("[data-gpm-frontline-entry]");
  const session = ui.sim;
  if (!host || !session || host.frontlinePending) return;
  const revision = `${session.playerKey}|${session.day}|${session.status?.commitRevision}`;
  if (host.frontlineRevision === revision || performance.now() - (host.frontlineLastRequest ?? -Infinity) < 1000) return;
  host.frontlinePending = true;
  host.frontlineLastRequest = performance.now();
  const status = host.querySelector("[data-gpm-frontline-entry-status]");
  const wars = host.querySelector("[data-gpm-frontline-wars]");
  void Xe(session, "gpm.frontline", {}).then(result => {
    if (!host.isConnected || ui.sim !== session) return;
    if (!Array.isArray(result?.wars)) throw new Error("Frontline wars unavailable");
    host.frontlineRevision = revision;
    const signature = JSON.stringify(result.wars);
    if (wars.frontlineSignature !== signature) {
      wars.frontlineSignature = signature;
      wars.innerHTML = result.wars.map(war => `<button type="button" class="k" data-authority-safe data-gpm-frontline-open="${v(war.id)}">${v(war.name || war.id)}</button>`).join("");
    }
    status.textContent = result.wars.length ? "Choose a war to plan its front." : "No ground war under your command.";
  }).catch(error => {
    console.warn("[PPO] Could not load Frontline wars", error);
    if (host.isConnected) status.textContent = "Frontline could not load. Reopen the tab to retry.";
  }).finally(() => { host.frontlinePending = false; });
}

async function gpmOpenFrontline(ui, session, warId) {
  if (ui.sim !== session || !ui.canOpenMilitaryMode?.()) return;
  gpmCloseFrontline(ui);
  if (!ui.militaryModeActive) await ui.openMilitaryMode();
  if (ui.sim !== session || !ui.militaryModeActive) return;
  ui.selectWarTheatre(warId);
  const registry = K("war-registry");
  const globe = ui.globe;
  const canvas = globe?.renderer?.domElement;
  if (!registry || !canvas) return;
  const host = document.createElement("section");
  host.className = "gpm-frontline gpm-frontline-dock";
  host.setAttribute("data-gpm-frontline-panel", "");
  host.setAttribute("aria-label", "Frontline planner");
  registry.append(host);
  registry.classList.add("gpm-frontline-open");
  const state = ui._gpmFrontline = { session, ui, playerKey: session.playerKey, warId, host, registry, globe, canvas,
    events: new AbortController(), data: null, draft: null, drawing: null, feedback: "Loading frontline…", meshes: [], request: 0 };
  const options = { signal: state.events.signal };
  gpmMountFrontlineRoster(state, options);
  host.addEventListener("click", event => gpmFrontlineClick(state, event), options);
  host.addEventListener("input", event => {
    const input = event.target.closest("[data-gpm-frontline-army-name]");
    if (input && state.draft) {
      state.draft.name = input.value;
      gpmPaintFrontlinePaths(state);
    }
  }, options);
  host.addEventListener("change", event => {
    if (!state.draft || state.busy) return;
    const general = event.target.closest("[data-gpm-frontline-general]");
    if (general) {
      state.draft.generalId = general.value || null;
      return;
    }
    const color = event.target.closest("[data-gpm-frontline-color]");
    if (color) {
      state.draft.color = color.value;
      return gpmPaintFrontline(state);
    }
    const input = event.target.closest("[data-gpm-frontline-formation]");
    if (!input) return;
    if (input.checked) state.draft.ids.add(input.value);
    else state.draft.ids.delete(input.value);
    gpmPaintFrontline(state);
  }, options);
  gpmBindFrontlineDraw(state);
  gpmPaintFrontline(state);
  await gpmLoadFrontline(state, true);
  if (ui._gpmFrontline === state) host.querySelector('[data-gpm-frontline-action="new"]')?.focus({ preventScroll: true });
}

function gpmCloseFrontline(ui) {
  const state = ui._gpmFrontline;
  if (!state) return;
  ui._gpmFrontline = null;
  state.events.abort();
  state.host.remove();
  state.selectionBox?.remove();
  state.roster?.remove();
  state.labelLayer?.remove();
  document.body.classList.remove("gpm-frontline-planning");
  state.registry.classList.remove("gpm-frontline-open");
  state.canvas.classList.remove("gpm-frontline-crosshair");
  gpmClearFrontlinePaths(state);
}

function gpmRefreshFrontlineMap(ui) {
  const state = ui._gpmFrontline;
  if (!state) return;
  if (ui.sim !== state.session || ui.sim.playerKey !== state.playerKey || state.globe !== ui.globe) return gpmCloseFrontline(ui);
  if (!state.busy && !state.drawing) void gpmLoadFrontline(state);
}

async function gpmLoadFrontline(state, force = false) {
  if (state.ui._gpmFrontline !== state) return;
  const revision = `${state.session.day}|${state.session.status?.commitRevision}`;
  if (!force && (state.pending || state.revision === revision || performance.now() - state.lastRequest < 900)) return;
  const request = ++state.request;
  state.pending = true;
  state.lastRequest = performance.now();
  try {
    const result = await Xe(state.session, "gpm.frontline", { warId: state.warId });
    if (state.ui._gpmFrontline !== state || request !== state.request) return;
    if (!Array.isArray(result?.wars)) throw new Error("Unexpected Frontline view");
    const first = !state.data;
    state.data = result.warId === state.warId ? result : { plans: [], formations: [], stations: [], status: "unavailable" };
    state.revision = revision;
    if (first && state.feedback === "Loading frontline…") state.feedback = "";
    gpmPaintFrontline(state);
    if (first && state.data.stations?.length) gpmFocusFrontlineStation(state);
  } catch (error) {
    if (state.ui._gpmFrontline !== state || request !== state.request) return;
    console.warn("[PPO] Could not load Frontline plan", error);
    state.feedback = "Frontline could not load. Close and reopen the planner to retry.";
    gpmPaintFrontline(state);
  } finally {
    if (request === state.request) state.pending = false;
  }
}

function gpmFocusFrontlineStation(state) {
  const point = state.data?.stations?.[Math.floor(state.data.stations.length / 2)]?.position;
  if (point) state.globe.focusLatLon?.(point[0], point[1], 2.4);
}

function gpmFrontlineStatus(plan) {
  const labels = { hold: "Holding", holding: "Holding", advance: "Advancing", advancing: "Advancing",
    assembling: "Assembling", regrouping: "Regrouping", resupply: "Resupplying", resupplying: "Resupplying", completed: "Objective secured",
    complete: "Objective secured", paused: "Paused", ceasefire: "Ceasefire", blocked: "Advance blocked",
    "no-contact": "Front has moved", no_contact: "Front has moved", "no-route": "No route to objective", queued: "Queued", unassigned: "No front assigned" };
  return labels[plan.status] || (plan.mode === "advance" ? "Advance ordered" : "Hold ordered");
}

function gpmFrontlineColor(value) {
  return `#${(gpmFrontlinePalette[value] || gpmFrontlinePalette.cyan).toString(16).padStart(6, "0")}`;
}

function gpmFrontlineObjective(state, plan) {
  if (!plan.objectiveProvinceKey) return "";
  const province = state.globe.world?.provByKey?.get?.(plan.objectiveProvinceKey);
  return province?.__name || province?.properties?.name || "Drawn objective";
}

function gpmMountFrontlineRoster(state, options) {
  state.slots = 2;
  const roster = state.roster = document.createElement("nav");
  roster.className = "gpm-frontline-roster-bar";
  roster.setAttribute("data-gpm-frontline-roster-bar", "");
  roster.setAttribute("aria-label", "Armies");
  const layer = state.labelLayer = document.createElement("div");
  layer.className = "gpm-frontline-arrow-labels";
  layer.setAttribute("aria-hidden", "true");
  document.body.append(layer, roster);
  document.body.classList.add("gpm-frontline-planning");
  roster.addEventListener("click", event => {
    if (state.busy || state.drawing?.validating) return;
    const remove = event.target.closest("[data-gpm-frontline-remove-army]");
    if (remove) return void gpmSendFrontline(state, "remove", { id: remove.dataset.gpmFrontlineRemoveArmy, army: true });
    if (event.target.closest("[data-gpm-frontline-add-slot]")) {
      state.slots++;
      return gpmPaintFrontlineRoster(state);
    }
    const button = event.target.closest("[data-gpm-frontline-slot]");
    if (!button || !state.data || state.data.status !== "active") return;
    const plan = state.data.plans.find(item => item.id === button.dataset.armyId);
    gpmEditFrontlineDraft(state, plan, null, Number(button.dataset.gpmFrontlineSlot), Boolean(plan));
  }, options);
}

function gpmFrontlineArmySlots(plans) {
  const roots = plans.filter(plan => !plan.afterId || !plans.some(parent => parent.id === plan.afterId));
  const slots = new Map(roots.filter(plan => plan.slot > 0).map(plan => [plan.slot, plan]));
  let next = 1;
  for (const plan of roots) if (!plan.slot) {
    while (slots.has(next)) next++;
    slots.set(next, plan);
  }
  return slots;
}

function gpmFrontlinePortrait(state, id) {
  const person = state.data?.generals?.find(item => String(item.id) === String(id));
  const year = state.data?.year || new Date().getUTCFullYear();
  const url = person && loe(person, year, "militaire");
  return url ? `<img class="gpm-frontline-portrait" alt="${v(person.name)}" src="${v(url)}">`
    : '<span class="gpm-frontline-portrait gpm-frontline-portrait-empty" aria-hidden="true"></span>';
}

function gpmPaintFrontlineRoster(state) {
  const slots = gpmFrontlineArmySlots(state.data?.plans || []);
  state.slots = Math.max(state.slots, ...slots.keys());
  const html = Array.from({ length: state.slots }, (_, index) => {
    const slot = index + 1;
    const plan = slots.get(slot);
    const name = plan?.name || `Army ${slot}`;
    const enabled = state.data?.status === "active" && !state.busy && !state.drawing?.validating;
    return `<div class="gpm-frontline-slot">
      <button type="button" class="k" data-gpm-frontline-slot="${slot}" data-army-id="${v(plan?.id || "")}" data-slot-state="${plan ? "filled" : "empty"}" aria-label="${v(plan ? name : `Create ${name}`)}" title="${v(name)}"${enabled ? "" : " disabled"}>
        <span class="gpm-frontline-slot-name">${plan ? v(name) : "Empty"}</span>${gpmFrontlinePortrait(state, plan?.generalId)}
      </button>${plan ? `<button type="button" data-gpm-frontline-remove-army="${v(plan.id)}" title="${v(`Disband ${name}`)}" aria-label="${v(`Disband ${name}`)}"${enabled ? "" : " disabled"}>×</button>` : ""}
    </div>`;
  }).join("") + '<button type="button" class="k gpm-frontline-add-slot" data-gpm-frontline-add-slot aria-label="Add army slot" title="Add army slot">+</button>';
  if (state.rosterHtml !== html) {
    state.rosterHtml = html;
    state.roster.style.setProperty("--frontline-slot-width", `clamp(64px, calc((100vw - 64px) / ${state.slots}), 102px)`);
    state.roster.innerHTML = html;
  }
}

function gpmPaintFrontline(state) {
  const { host, data, draft, busy } = state;
  if (!host.isConnected) return;
  const plans = data?.plans || [];
  const roots = plans.filter(plan => !plan.afterId || !plans.some(other => other.id === plan.afterId));
  const nextBy = new Map(plans.filter(plan => plan.afterId).map(plan => [plan.afterId, plan]));
  const ownedBy = new Map(roots.flatMap(plan => plan.formationIds.map(id => [id, plan.id])));
  const currentWar = data?.wars?.find(war => war.id === state.warId);
  const canEdit = data?.warId === state.warId && (!data.status || data.status === "active");
  const canDraft = canEdit && !busy && !state.drawing?.validating;
  const disabled = canDraft ? "" : " disabled";
  const opt = (action, title, extra = "") => `<button type="button" class="k" data-gpm-frontline-action="${action}" ${extra}>${title}</button>`;
  const command = (mode, label, plan) => `<button type="button" class="k" data-gpm-frontline-mode="${mode}" data-gpm-fl-focus="${v(plan.id)}-${mode}" aria-pressed="${plan.mode === mode}"${disabled}${mode === "advance" && !plan.arrow?.length ? " disabled" : ""}>${label}</button>`;
  const focusKey = document.activeElement?.getAttribute("data-gpm-fl-focus");
  const rosterScroll = host.querySelector(".gpm-frontline-roster")?.scrollTop || 0;
  const fixedRoster = draft && (draft.afterId || nextBy.has(draft.id));
  const allGenerals = data?.generals || [];
  const otherGenerals = new Set(roots.filter(plan => plan.id !== draft?.id).map(plan => String(plan.generalId)));
  const armyMeta = draft && !draft.afterId ? `<div class="gpm-frontline-army-meta">
    <label>Army name<input class="k" type="text" maxlength="80" data-gpm-frontline-army-name data-gpm-fl-focus="army-name" value="${v(draft.name)}"${disabled}></label>
    <label>General<select class="k" data-gpm-frontline-general data-gpm-fl-focus="army-general"${disabled}>
      <option value=""${!draft.generalId ? " selected" : ""}>Unassigned</option>
      ${allGenerals.map(general => `<option value="${v(general.id)}"${draft.generalId === String(general.id) ? " selected" : ""}${otherGenerals.has(String(general.id)) ? " disabled" : ""}>${v(general.name)}</option>`).join("")}
    </select></label>
  </div>` : "";
  const editing = draft && `<section class="gpm-frontline-editor" aria-label="Edit army">
    <h4>${draft.id ? draft.afterId ? "Edit order" : "Edit army" : draft.afterId ? "Queue next order" : "New army"}</h4>
    ${armyMeta}
    ${draft.metadataOnly ? "" : `${fixedRoster ? `<small>${draft.ids.size} formations in the order sequence</small>` : `<div class="gpm-frontline-actions">${opt("select", "Select on map", `data-gpm-fl-focus="select-formations" aria-pressed="${state.drawing?.kind === "select"}"${disabled}`)}</div>
    <div class="gpm-frontline-roster" role="group" aria-label="Ground formations">${(data?.formations || []).map(formation => {
      const taken = ownedBy.get(formation.id) && ownedBy.get(formation.id) !== draft.id;
      const note = taken ? "Assigned to another army" : formation.eligible === false ? "Unavailable" : formation.posture === "resupply" ? "Resupplying" : "";
      return `<label><input type="checkbox" data-gpm-frontline-formation data-gpm-fl-focus="${v(formation.id)}" value="${v(formation.id)}"${draft.ids.has(formation.id) ? " checked" : ""}${disabled}${(taken || formation.eligible === false) && !draft.ids.has(formation.id) ? " disabled" : ""}><span>${v(formation.name || formation.id)}${note ? `<small>${note}</small>` : ""}</span></label>`;
    }).join("") || '<p>No eligible ground formations are available.</p>'}</div>`}
    <label class="gpm-frontline-color">Color <span class="gpm-frontline-swatch" style="--frontline-color:${gpmFrontlineColor(draft.color)}"></span>
      <select class="k" data-gpm-frontline-color data-gpm-fl-focus="group-color"${disabled}>${Object.keys(gpmFrontlinePalette).map(color => `<option value="${color}"${draft.color === color ? " selected" : ""}>${color[0].toUpperCase() + color.slice(1)}</option>`).join("")}</select>
    </label>
    <div class="gpm-frontline-actions">
      ${opt("line", draft.line.length ? "Redraw front" : "Draw front", `data-gpm-fl-focus="draw-front" aria-pressed="${state.drawing?.kind === "line"}"${disabled}`)}
      ${opt("arrow", draft.arrow.length ? "Redraw arrow" : "Draw arrow", `data-gpm-fl-focus="draw-arrow" aria-pressed="${state.drawing?.kind === "arrow"}"${!draft.line.length || !canDraft ? " disabled" : ""}`)}
    </div>
    <small>${draft.ids.size} selected · ${draft.line.length ? "Front drawn" : "No front assigned"}${draft.arrow.length ? " · Arrow drawn" : ""}</small>`}
    <div class="gpm-frontline-actions">
      ${opt("save", draft.afterId ? "Save order" : "Save army", `data-gpm-fl-focus="save-group"${!canDraft || (!draft.metadataOnly && ((draft.line.length > 0 && !draft.ids.size) || (draft.afterId && (draft.arrow.length < 2 || draft.line.length < 2)))) ? " disabled" : ""}`)}
      ${opt("cancel", "Cancel", busy ? "disabled" : "")}
    </div>
  </section>`;
  const groups = roots.map((root, index) => {
    const unitNames = root.formationIds.map(id => (data.formations || []).find(row => row.id === id)?.name || id);
    const sequence = [];
    for (let next = root; next && sequence.length < plans.length; next = nextBy.get(next.id)) sequence.push(next);
    return `<section class="gpm-frontline-group"><h4>${v(root.name || `Army ${root.slot || index + 1}`)}</h4>
      ${unitNames.length ? `<small>${v(unitNames.join(", "))}</small>` : ""}
      ${sequence.map((plan, order) => {
        const completed = plan.status === "completed";
        const unassigned = plan.status === "unassigned";
        const tail = !nextBy.has(plan.id);
        const unavailable = completed && plan.reason === "no_connected_front";
        const lostRoute = plan.status === "blocked" && ["water", "no_land_route"].includes(plan.reason);
        const objective = gpmFrontlineObjective(state, plan);
        return `<article class="gpm-frontline-order" data-gpm-frontline-plan="${v(plan.id)}" data-mode="${v(plan.mode)}" data-status="${v(plan.status)}">
        <strong class="gpm-frontline-order-label"><span class="gpm-frontline-swatch" style="--frontline-color:${gpmFrontlineColor(plan.color)}"></span>${sequence.length > 1 ? `Order ${order + 1} · ` : ""}${v(gpmFrontlineStatus(plan))}${completed && tail && !unavailable ? " · Holding" : ""}</strong>
        ${objective ? `<small>${v(objective)}</small>` : ""}
        ${unavailable ? "<small>No connected front near the objective.</small>" : ""}
        ${lostRoute ? "<small>No reachable land route. Edit the order to choose another objective.</small>" : ""}
        <div class="gpm-frontline-actions">
          ${plan.status !== "queued" && !completed && !unassigned ? command("hold", "Hold", plan) + command("advance", "Advance", plan) : ""}
          ${!completed ? opt("edit", unassigned ? "Set front" : "Edit", disabled) : ""}
          ${tail ? opt("remove", "Remove", disabled) : ""}
          ${tail && ((completed && !unavailable) || plan.arrow?.length) ? opt("queue", "Queue next order", disabled) : ""}
        </div>
      </article>`;
      }).join("")}
    </section>`;
  }).join("");
  const html = `<header><h3 class="mc-title">Frontline</h3>${opt("close", "Close")}</header>
    ${currentWar ? `<p>${v(currentWar.name || currentWar.id)}</p>` : ""}
    <p class="gpm-frontline-feedback" data-gpm-frontline-feedback role="status">${v(state.feedback || (data && !canEdit ? "This war is unavailable for new orders." : ""))}</p>
    ${groups}${editing || (canEdit ? `<div>${opt("new", "New army", disabled)}</div>` : "")}`;
  if (state.html !== html) {
    state.html = html;
    host.innerHTML = html;
    if (focusKey) host.querySelector(`[data-gpm-fl-focus="${CSS.escape(focusKey)}"]`)?.focus({ preventScroll: true });
    const roster = host.querySelector(".gpm-frontline-roster");
    if (roster) roster.scrollTop = rosterScroll;
  }
  gpmPaintFrontlineRoster(state);
  gpmPaintFrontlinePaths(state);
}

function gpmEditFrontlineDraft(state, plan, predecessor = null, slot = null, metadataOnly = false) {
  const defaults = Object.keys(gpmFrontlinePalette);
  const allPlans = state.data.plans;
  const slots = gpmFrontlineArmySlots(allPlans);
  if (slot == null) {
    slot = plan?.slot || predecessor?.slot || 1;
    if (!plan && !predecessor) while (slots.has(slot)) slot++;
  }
  const color = plan?.color || predecessor?.color || defaults[(slot - 1) % defaults.length];
  const heldLine = predecessor?.status === "completed" ? predecessor.liveLine || predecessor.line : null;
  const usedGenerals = new Set(allPlans.filter(item => !item.afterId).map(item => String(item.generalId)));
  const availableGeneral = state.data.generals?.find(item => !usedGenerals.has(String(item.id)))?.id;
  const general = plan ? plan.generalId : predecessor ? predecessor.generalId : availableGeneral;
  state.draft = { id: plan?.id, afterId: plan?.afterId || predecessor?.id, ids: new Set(plan?.formationIds || predecessor?.formationIds),
    line: plan?.liveLine || plan?.line || heldLine || [], arrow: plan?.arrow || [], objectiveProvinceKey: plan?.objectiveProvinceKey,
    mode: plan?.mode || (predecessor ? "advance" : "hold"), color, slot, metadataOnly,
    name: plan?.name || predecessor?.name || `Army ${slot}`, generalId: general == null ? null : String(general) };
  gpmFrontlineSetDraw(state, null);
  state.host.querySelector(".gpm-frontline-editor")?.scrollIntoView({ block: "nearest" });
  const target = heldLine?.[Math.floor(heldLine.length / 2)] || predecessor?.arrow?.at(-1);
  if (target) state.globe.focusLatLon?.(target[0], target[1], 2.4);
}

function gpmFrontlineClick(state, event) {
  const button = event.target.closest("button");
  if (!button || button.disabled) return;
  const { gpmFrontlineAction: action, gpmFrontlineMode: mode } = button.dataset;
  if (action === "close") {
    gpmCloseFrontline(state.ui);
    state.ui.closeMilitaryMode();
    state.ui.openModule("military", "frontline");
    return;
  }
  if (state.busy) return;
  const id = button.closest("[data-gpm-frontline-plan]")?.dataset.gpmFrontlinePlan;
  if (mode) return void gpmSendFrontline(state, "mode", { id, mode });
  if (action === "remove") return void gpmSendFrontline(state, "remove", { id });
  if (action === "new" || action === "edit" || action === "queue") {
    const plan = action === "edit" && state.data.plans.find(row => row.id === id);
    const predecessor = action === "queue" && state.data.plans.find(row => row.id === id);
    gpmEditFrontlineDraft(state, plan, predecessor);
  } else if (action === "cancel") {
    state.draft = null;
    gpmFrontlineSetDraw(state, null);
  } else if (action === "line" || action === "arrow" || action === "select") {
    gpmFrontlineSetDraw(state, state.drawing?.kind === action ? null : action);
  } else if (action === "save" && state.draft) {
    const { id: draftId, ids, line, arrow, objectiveProvinceKey, mode: draftMode, color, afterId, name, generalId, slot, metadataOnly } = state.draft;
    if (metadataOnly) return void gpmSendFrontline(state, "army", { id: draftId, name, generalId, slot });
    void gpmSendFrontline(state, "upsert", { id: draftId, formationIds: [...ids], line, arrow, objectiveProvinceKey, mode: draftMode, color, afterId, name, generalId, slot });
  }
}

function gpmFrontlineSetDraw(state, kind, message = null) {
  state.selectionBox?.remove();
  state.selectionBox = null;
  state.drawing = kind ? { kind } : null;
  if (kind === "arrow") state.drawing.start = gpmFrontlineMidpoint(state.draft.line);
  state.canvas.classList.toggle("gpm-frontline-crosshair", !!kind);
  state.feedback = message ?? (kind === "line" ? state.draft?.afterId ? "Draw the next front near the previous objective." : "Drag along the front, or click its two ends."
    : kind === "arrow" ? "Draw toward the objective, or click its province."
    : kind === "select" ? "Drag a box around formations. Hold Shift to add to the selection." : "");
  gpmPaintFrontline(state);
}

function gpmFrontlineDistance(a, b) {
  const rad = Math.PI / 180;
  const dy = (a[1] - b[1]) * rad;
  const dx = (a[0] - b[0]) * rad;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(Math.sin(dy / 2) ** 2
    + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dx / 2) ** 2)));
}

function gpmFrontlineMidpoint(line) {
  const spans = line.slice(1).map((point, index) => gpmFrontlineDistance(line[index], point));
  let remaining = spans.reduce((sum, distance) => sum + distance, 0) / 2;
  for (let index = 0; index < spans.length; index++) {
    const distance = spans[index];
    if (distance > 0 && remaining <= distance) {
      const from = ct(line[index][1], line[index][0], 1).normalize();
      const to = ct(line[index + 1][1], line[index + 1][0], 1).normalize();
      const fraction = remaining / distance;
      const angle = from.angleTo(to);
      const vector = from.clone().multiplyScalar(Math.sin((1 - fraction) * angle)).addScaledVector(to, Math.sin(fraction * angle));
      if (vector.lengthSq() < 1e-12) return line[index];
      const [lat, lon] = Gg(vector);
      return [lon, lat];
    }
    remaining -= distance;
  }
  return line[0];
}

function gpmNearestFrontlineStation(state, point) {
  let nearest = null;
  let distance = Infinity;
  for (const station of state.data?.stations || []) {
    if (!station.position) continue;
    const next = gpmFrontlineDistance(station.position, point);
    if (next < distance) {
      nearest = station.position;
      distance = next;
    }
  }
  return distance <= 250 ? nearest : null;
}

function gpmBindFrontlineDraw(state) {
  const options = { capture: true, signal: state.events.signal };
  const at = event => {
    const coords = state.globe._latLonAt(event.clientX, event.clientY);
    return coords && [coords[1], coords[0]];
  };
  const eat = event => {
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  window.addEventListener("pointerdown", event => {
    const draw = state.drawing;
    if (!draw || event.target !== state.canvas || event.button !== 0 || state.globe.activeBody !== "earth") return;
    eat(event);
    if (draw.validating) return;
    const point = draw.kind === "select" ? null : at(event);
    if (draw.kind !== "select" && !point) return;
    draw.pointer = event.pointerId;
    draw.screen = [event.clientX, event.clientY];
    draw.origin = draw.screen;
    draw.points = point ? [point] : [];
    draw.preview = null;
    if (draw.kind === "select") {
      state.globe._focusAnim = null;
      gpmFrontlineSelectionRect(state, draw.origin, draw.origin);
    }
  }, options);
  window.addEventListener("pointermove", event => {
    const draw = state.drawing;
    if (!draw || draw.pointer !== event.pointerId) return;
    eat(event);
    if (draw.kind === "select") {
      gpmFrontlineSelectionRect(state, draw.origin, [event.clientX, event.clientY]);
      return;
    }
    if (Math.hypot(event.clientX - draw.screen[0], event.clientY - draw.screen[1]) < 12) return;
    if (draw.kind === "line" && draw.points.length >= 20) return;
    const point = at(event);
    if (!point) return;
    draw.screen = [event.clientX, event.clientY];
    if (draw.kind === "arrow") draw.preview = gpmClipFrontlinePreview(state.globe, draw.start, point);
    else draw.points.push(point);
    gpmPaintFrontlinePaths(state);
  }, options);
  window.addEventListener("pointerup", event => {
    const draw = state.drawing;
    if (!draw || draw.pointer !== event.pointerId) return;
    eat(event);
    draw.pointer = null;
    if (draw.kind === "select") {
      gpmSelectFrontlineFormations(state, draw.origin, [event.clientX, event.clientY], event.shiftKey);
      return;
    }
    const point = at(event);
    if (point) gpmFinishFrontlineDraw(state, draw, point, Math.hypot(event.clientX - draw.origin[0], event.clientY - draw.origin[1]) > 8);
    else {
      state.feedback = "End the stroke on the globe.";
      gpmPaintFrontline(state);
    }
  }, options);
  window.addEventListener("pointercancel", event => {
    if (state.drawing?.pointer === event.pointerId) gpmFrontlineSetDraw(state, null);
  }, options);
  window.addEventListener("keydown", event => {
    if (event.key === "Escape" && state.drawing) {
      eat(event);
      gpmFrontlineSetDraw(state, null);
    }
  }, options);
}

function gpmFrontlineSelectionRect(state, start, end) {
  const left = Math.min(start[0], end[0]);
  const top = Math.min(start[1], end[1]);
  const right = Math.max(start[0], end[0]);
  const bottom = Math.max(start[1], end[1]);
  if (!state.selectionBox) {
    state.selectionBox = document.createElement("div");
    state.selectionBox.className = "gpm-frontline-selection-box";
    state.selectionBox.setAttribute("aria-hidden", "true");
    document.body.append(state.selectionBox);
  }
  Object.assign(state.selectionBox.style, { left: `${left}px`, top: `${top}px`, width: `${right - left}px`, height: `${bottom - top}px` });
  return { left, top, right, bottom };
}

function gpmSelectFrontlineFormations(state, start, end, add) {
  const bounds = gpmFrontlineSelectionRect(state, start, end);
  const draft = state.draft;
  const { camera, sphere } = state.globe;
  const radius = sphere.geometry.parameters.radius;
  const reserved = new Set((state.data?.plans || []).filter(plan => !plan.afterId && plan.id !== draft.id)
    .flatMap(plan => plan.formationIds));
  const found = [];
  const padding = bounds.right - bounds.left < 5 && bounds.bottom - bounds.top < 5 ? 8 : 0;
  camera.updateMatrixWorld();
  for (const formation of state.data?.formations || []) {
    if (!formation.position || formation.eligible === false || reserved.has(formation.id)) continue;
    const [lon, lat] = formation.position;
    const position = ct(lat, lon, radius);
    if (position.dot(camera.position) <= radius ** 2) continue;
    const projected = position.project(camera);
    if (projected.z < -1 || projected.z > 1) continue;
    const x = (projected.x * .5 + .5) * window.innerWidth;
    const y = (.5 - projected.y * .5) * window.innerHeight;
    if (x < bounds.left - padding || x > bounds.right + padding || y < bounds.top - padding || y > bounds.bottom + padding) continue;
    if (document.elementFromPoint(x, y) === state.canvas) found.push(formation.id);
  }
  if (!found.length) return gpmFrontlineSetDraw(state, "select", "No available formations in that box.");
  draft.ids = new Set(add ? [...draft.ids, ...found] : found);
  const count = draft.ids.size;
  gpmFrontlineSetDraw(state, null, count === 1 ? "1 formation selected." : `${count} formations selected.`);
}

function gpmFinishFrontlineDraw(state, draw, point, dragged) {
  if (draw.kind === "line") {
    const forecast = Boolean(state.draft.afterId);
    const valid = p => forecast ? state.globe._provinceAt(p[0], p[1]) >= 0 : Boolean(gpmNearestFrontlineStation(state, p));
    if (!valid(point)) {
      state.feedback = forecast ? "Choose a land point for the next front." : "Choose a point closer to this war's contact line.";
      return gpmPaintFrontline(state);
    }
    const start = draw.anchorInput || (dragged && valid(draw.points[0]) ? draw.points[0] : null);
    if (!start) {
      draw.anchor = forecast ? point : gpmNearestFrontlineStation(state, point);
      draw.anchorInput = point;
      state.feedback = "Choose the other end of the front.";
      return gpmPaintFrontline(state);
    }
    if (gpmFrontlineDistance(start, point) < 1) {
      state.feedback = "Choose a different point on the front.";
      return gpmPaintFrontline(state);
    }
    const points = dragged && !draw.anchorInput ? draw.points.slice(1).filter(valid) : [];
    const line = [start, ...points, point].filter((p, index, list) => !index || gpmFrontlineDistance(p, list[index - 1]) > 1);
    return void gpmTraceFrontline(state, draw, line);
  }
  if (!draw.start || gpmFrontlineDistance(draw.start, point) <= 1) {
    state.feedback = "Choose an objective beyond this front.";
    return gpmPaintFrontline(state);
  }
  void gpmRouteFrontlineArrow(state, draw, [draw.start, point]);
}

async function gpmTraceFrontline(state, draw, line) {
  const draft = state.draft;
  draw.validating = true;
  state.feedback = "Tracing the front…";
  gpmPaintFrontline(state);
  const current = () => state.ui._gpmFrontline === state && state.draft === draft && state.drawing === draw;
  try {
    const result = await Xe(state.session, "gpm.frontline.line", { warId: state.warId, line, afterId: draft.afterId });
    if (!current()) return;
    if (!result?.ok || !Array.isArray(result.line) || result.line.length < 2) {
      return gpmFrontlineSetDraw(state, "line", gpmFrontlineError(result?.reason || "front"));
    }
    draft.line = result.line;
    draft.arrow = [];
    draft.objectiveProvinceKey = undefined;
    draft.mode = draft.afterId ? "advance" : "hold";
    gpmFrontlineSetDraw(state, null, result.forecast ? "The queued front will follow the contact line when this order starts." : "");
  } catch (error) {
    if (!current()) return;
    console.warn("[PPO] Frontline sector preview failed", error);
    gpmFrontlineSetDraw(state, "line", "The front could not be traced. Draw the sector again.");
  }
}

function gpmClipFrontlinePreview(globe, from, to) {
  if (!from) return [];
  const fromVector = ct(from[1], from[0], 1).normalize();
  const toVector = ct(to[1], to[0], 1).normalize();
  const steps = Math.max(1, Math.ceil(gpmFrontlineDistance(from, to) / 5));
  let last = null;
  for (let step = 1; step <= steps; step++) {
    const [lat, lon] = Gg(fromVector.clone().lerp(toVector, step / steps).normalize());
    if (globe._provinceAt(lon, lat) < 0) break;
    last = [lon, lat];
  }
  return last ? [from, last] : [];
}

async function gpmRouteFrontlineArrow(state, draw, arrow) {
  const draft = state.draft;
  draw.validating = true;
  state.feedback = "Checking the land route…";
  gpmPaintFrontline(state);
  const current = () => state.ui._gpmFrontline === state && state.draft === draft && state.drawing === draw;
  try {
    const result = await Xe(state.session, "gpm.frontline.route", { warId: state.warId, line: draft.line, afterId: draft.afterId, validateArrow: arrow });
    if (!current()) return;
    if (!result?.ok || !Array.isArray(result.arrow) || result.arrow.length < 2) {
      return gpmFrontlineSetDraw(state, "arrow", gpmFrontlineError(result?.reason));
    }
    draft.arrow = result.arrow;
    draft.objectiveProvinceKey = result.objectiveProvinceKey;
    gpmFrontlineSetDraw(state, null, result.corrected ? "Arrow adjusted to stay on land." : "");
  } catch (error) {
    if (!current()) return;
    console.warn("[PPO] Frontline route preview failed", error);
    gpmFrontlineSetDraw(state, "arrow", "The land route could not be checked. Draw the arrow again.");
  }
}

async function gpmSendFrontline(state, action, params) {
  state.busy = true;
  gpmFrontlineSetDraw(state, null);
  let result;
  try {
    result = await Le(state.session, "applyPlayerAction", [{ verb: `gpm.frontline.${action}`, warId: state.warId,
      ...params, ...gpmExpectedActor(state.playerKey) }]);
    if (state.ui._gpmFrontline !== state) return;
    if (result?.ok) {
      if (action === "upsert" || action === "army") state.draft = null;
      if (action === "remove" && state.draft?.id === params.id) state.draft = null;
      await gpmLoadFrontline(state, true);
    }
    state.feedback = result?.message || (result?.ok ? "Order saved." : gpmFrontlineError(result?.reason || result?.reasonId));
  } catch (error) {
    console.warn("[PPO] Frontline order failed", error);
    state.feedback = "The order could not be submitted. Try again.";
  } finally {
    state.busy = false;
    if (state.ui._gpmFrontline === state) gpmPaintFrontline(state);
  }
}

function gpmFrontlineError(reason) {
  const labels = { authority: "You no longer control this army.", formation: "A selected formation is no longer available.",
    formations: "A selected formation is no longer available.", line: "Draw a sector on the current front.",
    front: "Draw a sector on the current front.", queue_front: "Draw the next front near the previous objective.",
    disconnected_front: "Choose both ends on the same connected front.",
    no_connected_front: "No connected front here. Select another sector.",
    formation_overlap: "A selected formation is already assigned to another group.", queue: "This order's formation selection must match its group.",
    arrow: "Draw an arrow ending inside the enemy's territory in this war.", objective: "Choose an eligible objective in this war.",
    arrow_start: "Start the arrow on the group's front.", objective_held: "Your side already controls that objective.",
    water: "No reachable land route to that objective. Choose another point.",
    no_land_route: "No reachable land route to that objective. Choose another point.",
    regional_scope: "This objective is outside the war's allowed territory.", ceasefire: "Orders are paused during the ceasefire.",
    war: "This war is unavailable for new orders.", conflict: "This war is unavailable for new orders." };
  return labels[reason] || "The order was declined. Check the group and its objective.";
}

function gpmClearFrontlinePaths(state) {
  for (const mesh of state.meshes) {
    state.globe.scene.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();
    const lineMaterials = state.globe._lineMats;
    const index = lineMaterials?.indexOf(mesh.material) ?? -1;
    if (index >= 0) lineMaterials.splice(index, 1);
  }
  state.meshes.length = 0;
  state.globe._frameGate?.invalidate?.();
}

function gpmPaintFrontlinePaths(state) {
  const plans = state.data?.plans || [];
  const draft = state.draft;
  const strokes = plans.filter(plan => plan.id !== draft?.id).flatMap((plan, index) => {
    const completed = plan.status === "completed";
    if (completed && plans.some(next => next.afterId === plan.id && next.status !== "queued")) return [];
    const color = gpmFrontlinePalette[plan.color] || gpmFrontlinePalette.cyan;
    const alpha = plan.status === "queued" ? .45 : .96;
    const line = completed && plan.reason === "no_connected_front" ? [] : plan.liveLine || plan.line;
    return [[line, color, false, alpha], [completed ? [] : plan.arrow, color, true, alpha, plan.name || `Army ${plan.slot || index + 1}`]];
  });
  if (draft) {
    const color = gpmFrontlinePalette[draft.color] || gpmFrontlinePalette.cyan;
    strokes.push([draft.line, color, false, .92], [draft.arrow, color, true, .92, draft.name || `Army ${draft.slot}`]);
    const draw = state.drawing;
    const preview = draw?.pointer != null && draw.kind === "arrow" && draw.preview;
    if (preview?.length > 1) strokes.push([preview, color, true, .65]);
    else if (draw?.anchor) strokes.push([[draw.anchor, [draw.anchor[0], draw.anchor[1] + .12]], color, false, .92]);
  }
  const signature = JSON.stringify(strokes);
  if (state.pathSignature === signature) return;
  state.pathSignature = signature;
  gpmClearFrontlinePaths(state);
  state.labelLayer.replaceChildren();
  state.labels = [];
  for (const [path, color, arrow, opacity, name] of strokes) {
    if (!path || path.length < 2) continue;
    gpmAddFrontlinePath(state, path, color, arrow, opacity);
    if (arrow && name) gpmAddFrontlineLabel(state, path, color, opacity, name);
  }
  gpmTickFrontlineLabels(state.ui);
  state.globe._frameGate?.invalidate?.();
}

function gpmAddFrontlineLabel(state, path, color, opacity, name) {
  const element = document.createElement("span");
  element.className = "gpm-frontline-arrow-label";
  element.setAttribute("data-gpm-frontline-arrow-label", "");
  element.textContent = name;
  element.hidden = true;
  element.style.setProperty("--frontline-color", `#${color.toString(16).padStart(6, "0")}`);
  element.style.opacity = opacity;
  const radius = ht * 1.007;
  const vectors = path.map(([lon, lat]) => ct(lat, lon, 1).normalize());
  const spans = vectors.slice(1).map((b, index) => {
    const a = vectors[index];
    const tipSegment = index === vectors.length - 2;
    const clip = tipSegment ? Math.min(.37, .023 / Math.max(.003, a.angleTo(b))) : .07;
    return { start: a.clone().lerp(b, .09).normalize().multiplyScalar(radius), end: a.clone().lerp(b, 1 - clip).normalize().multiplyScalar(radius),
      center: a.clone().lerp(b, (.09 + 1 - clip) / 2).normalize().multiplyScalar(radius), length: a.angleTo(b) };
  }).sort((a, b) => b.length - a.length).slice(0, 24);
  state.labelLayer.append(element);
  state.labels.push({ element, spans });
}

function gpmTickFrontlineLabels(ui) {
  const state = ui._gpmFrontline;
  if (!state?.labels?.length) return;
  const { camera, sphere } = state.globe;
  const radius = sphere.geometry.parameters.radius;
  camera.updateMatrixWorld();
  const project = world => {
    if (world.dot(camera.position) <= radius * Math.sqrt(world.lengthSq())) return null;
    const point = world.clone().project(camera);
    return point.z >= -1 && point.z <= 1 ? [(point.x * .5 + .5) * window.innerWidth, (.5 - point.y * .5) * window.innerHeight] : null;
  };
  for (const { element, spans } of state.labels) {
    let visible = null;
    for (const span of spans) {
      const a = project(span.start);
      const b = project(span.end);
      const center = project(span.center);
      if (!a || !b || !center || center[0] < 4 || center[0] > window.innerWidth - 4 || center[1] < 4 || center[1] > window.innerHeight - 4) continue;
      const width = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (width < 28 || width <= (visible?.width || 0)) continue;
      let angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
      if (angle > Math.PI / 2) angle -= Math.PI;
      else if (angle < -Math.PI / 2) angle += Math.PI;
      visible = { center, width, angle };
    }
    element.hidden = !visible;
    if (visible) {
      const { center, width, angle } = visible;
      Object.assign(element.style, { left: `${center[0].toFixed(1)}px`, top: `${center[1].toFixed(1)}px`, maxWidth: `${Math.floor(width - 8)}px`,
        fontSize: width < 72 ? "9px" : "10px", transform: `translate(-50%, -50%) rotate(${angle.toFixed(4)}rad)` });
    }
  }
}

function gpmAddFrontlinePath(state, path, color, arrow, opacity) {
  const segments = [];
  const radius = ht * 1.007;
  const add = (a, b) => segments.push(a.x, a.y, a.z, b.x, b.y, b.z);
  const points = path.map(([lon, lat]) => ct(lat, lon, 1).normalize());
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1];
    const b = points[index];
    const steps = Math.max(2, Math.ceil(a.angleTo(b) * 100));
    let previous = a.clone().multiplyScalar(radius);
    for (let step = 1; step <= steps; step++) {
      const next = a.clone().lerp(b, step / steps).normalize().multiplyScalar(radius);
      add(previous, next);
      previous = next;
    }
  }
  if (arrow) {
    const tip = points.at(-1);
    const previous = points.at(-2);
    const back = previous.clone().addScaledVector(tip, -previous.dot(tip)).normalize();
    const side = tip.clone().cross(back).normalize();
    const size = Math.min(.022, Math.max(.004, tip.angleTo(previous) * .38));
    for (const sign of [-1, 1]) {
      const corner = tip.clone().addScaledVector(back, size).addScaledVector(side, sign * size * .28).normalize().multiplyScalar(radius);
      add(tip.clone().multiplyScalar(radius), corner);
    }
  }
  const geometry = new ds();
  geometry.setPositions(segments);
  const material = new zc({ color, linewidth: arrow ? 1.9 : 4.5, transparent: true, opacity, depthTest: true, depthWrite: false });
  material.resolution.set(window.innerWidth, window.innerHeight);
  (state.globe._lineMats ||= []).push(material);
  const mesh = new cd(geometry, material);
  mesh.renderOrder = 28;
  mesh.frustumCulled = false;
  state.globe.scene.add(mesh);
  state.meshes.push(mesh);
}

function patchFrontlineRenderer(source, replaceOnce) {
  const functions = [gpmFrontlineMountStyle, gpmBuildFrontline, gpmRefreshFrontlineEntry, gpmOpenFrontline, gpmCloseFrontline,
    gpmRefreshFrontlineMap, gpmLoadFrontline, gpmFocusFrontlineStation, gpmFrontlineStatus, gpmFrontlineColor, gpmFrontlineObjective,
    gpmMountFrontlineRoster, gpmFrontlineArmySlots, gpmFrontlinePortrait, gpmPaintFrontlineRoster, gpmPaintFrontline, gpmEditFrontlineDraft, gpmFrontlineClick,
    gpmFrontlineSetDraw, gpmFrontlineDistance, gpmFrontlineMidpoint, gpmNearestFrontlineStation, gpmBindFrontlineDraw, gpmFinishFrontlineDraw,
    gpmFrontlineSelectionRect, gpmSelectFrontlineFormations, gpmTraceFrontline, gpmClipFrontlinePreview, gpmRouteFrontlineArrow,
    gpmSendFrontline, gpmFrontlineError, gpmClearFrontlinePaths, gpmPaintFrontlinePaths, gpmAddFrontlineLabel, gpmTickFrontlineLabels, gpmAddFrontlinePath];
  const insertion = "\nmountPartyButtons();\n";
  let js = replaceOnce(source, insertion, `\nconst gpmFrontlineStyle = ${JSON.stringify(style)};\nconst gpmFrontlinePalette = ${JSON.stringify(palette)};\n${functions.join("\n")}${insertion}`);
  const translate = 'if(e==="gpm.historicalConflicts.title")return "Historical Conflicts";';
  js = replaceOnce(js, translate, `${translate}if(e==="gpm.frontline.title")return "Frontline";`);
  const before = '{id:"historical-conflicts",k:"gpm.historicalConflicts.title"';
  js = replaceOnce(js, before, '{id:"frontline",k:"gpm.frontline.title",build:(n,r)=>gpmBuildFrontline(n,this,r)},' + before);
  const subscriptions = 'if(t==="historical-conflicts")return [];';
  js = replaceOnce(js, subscriptions, 'if(t==="historical-conflicts"||t==="frontline")return [];');
  const foot = 'this._subSel.military==="historical-conflicts"?null:';
  js = replaceOnce(js, foot, '(this._subSel.military==="historical-conflicts"||this._subSel.military==="frontline")?null:');
  const refresh = '_refreshTabUnsafe(e=null){gpmRefreshRegionalMap(this);';
  js = replaceOnce(js, refresh, refresh + 'gpmRefreshFrontlineEntry(this);');
  const refreshMap = 'this._warAlliesRefresh?.(),this._renderWarInspector()}finally';
  js = replaceOnce(js, refreshMap, 'this._warAlliesRefresh?.(),this._renderWarInspector(),gpmRefreshFrontlineMap(this)}finally');
  const labels = 'tickWarVisual(e,t=null){e=e||.016,';
  js = replaceOnce(js, labels, 'tickWarVisual(e,t=null){gpmTickFrontlineLabels(this);e=e||.016,');
  js = replaceOnce(js, 'closeMilitaryMode(){this._warConflictHeader', 'closeMilitaryMode(){gpmCloseFrontline(this);this._warConflictHeader');
  const leaveGame = 'showScreen(e){if(e!=="game")gpmCloseRegionalMap(this);';
  js = replaceOnce(js, leaveGame, 'showScreen(e){if(e!=="game")gpmCloseFrontline(this);if(e!=="game")gpmCloseRegionalMap(this);');
  const selectWar = 'selectWarTheatre(e){let t=xi(this.sim);';
  js = replaceOnce(js, selectWar, 'selectWarTheatre(e){let t=xi(this.sim);const plan=this._gpmFrontline;const target=$S(t,e)||e;if(plan&&target!==($S(t,plan.warId)||plan.warId))gpmCloseFrontline(this);');
  return js;
}

module.exports = { patchFrontlineRenderer };

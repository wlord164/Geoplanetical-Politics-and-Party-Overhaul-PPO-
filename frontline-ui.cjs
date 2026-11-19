"use strict";

const style = `
.gpm-frontline { display: grid; gap: var(--gap-3); min-width: 0; }
.gpm-frontline :is(p,h3,h4,ul) { margin: 0; }
.gpm-frontline button { min-height: 28px; }
.gpm-frontline .k[aria-pressed="true"] { border-color: var(--text); color: var(--text); background: var(--raised); }
.gpm-frontline-war { display: flex; flex-wrap: wrap; gap: var(--gap-2); }
.gpm-frontline-war > .k { text-align: start; }
#war-registry.gpm-frontline-open { align-self: stretch; width: min(calc(100vw - 2 * var(--pad)), clamp(18rem,27vw,25rem)); }
#war-registry.gpm-frontline-open > #war-inspector { display: none; }
.gpm-frontline-dock { padding: var(--gap-4); min-height: 0; overflow: auto; }
.gpm-frontline-dock[hidden], .gpm-frontline-roster-bar[hidden] { display: none; }
.gpm-frontline-dock :is(header, .gpm-frontline-actions) { display: flex; align-items: center; gap: var(--gap-2); flex-wrap: wrap; }
.gpm-frontline-dock header h3 { margin-right: auto; }
.gpm-frontline-feedback { color: var(--text-2); }
.gpm-frontline-feedback:empty { display: none; }
.gpm-frontline-group, .gpm-frontline-editor { display: grid; gap: var(--gap-2); min-width: 0; overflow-wrap: anywhere; border: 1px solid var(--hairline); padding: var(--gap-3); border-radius: var(--r-sm); }
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
#mil-frame.gpm-frontline-planning { grid-template-rows: auto minmax(0, 1fr) auto auto; }
#mil-frame.gpm-frontline-planning > #war-console { grid-row: 4; margin-bottom: 0; border-end-start-radius: 0; border-end-end-radius: 0; }
.gpm-frontline-roster-bar {
  --frontline-tile-height: 64px; --frontline-face-height: 34px; --frontline-face-width: 30px;
  --frontline-max-slot-width: 86px; --frontline-add-width: 40px;
  grid-row: 3; justify-self: center; align-self: end; pointer-events: auto; display: flex;
  width: max-content; min-width: 0; max-width: calc(100% - 2 * var(--pad)); box-sizing: border-box;
  margin: 0 0 3px; padding: 2px 4px 0; gap: 4px; overflow-x: auto; scrollbar-width: thin;
}
@media (max-width: 1024px) {
  .gpm-frontline-roster-bar {
    --frontline-tile-height: 56px; --frontline-face-height: 27px; --frontline-face-width: 24px;
    --frontline-max-slot-width: 76px; --frontline-add-width: 36px;
  }
}
.gpm-frontline-slot { flex: 0 0 var(--frontline-slot-width, 98px); min-width: 0; position: relative; }
.gpm-frontline-slot > button[data-gpm-frontline-slot] { display: grid; grid-template: 12px var(--frontline-face-height) 10px / minmax(0, 1fr); align-content: center; justify-items: center; gap: 0; box-sizing: border-box; width: 100%; height: var(--frontline-tile-height); min-height: var(--frontline-tile-height); padding: 1px 4px; }
.gpm-frontline-slot-name { color: white; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font: var(--fw-semi) 11px/12px var(--font-display); }
.gpm-frontline-slot-status { color: var(--text-2); max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font: var(--fw-semi) 10px/10px var(--font-display); }
.gpm-frontline-slot [data-slot-state="filled"] .gpm-frontline-slot-name { width: calc(100% - 17px); justify-self: start; text-align: center; }
.gpm-frontline-slot button[aria-pressed="true"] { outline: 2px solid var(--frontline-color, #82ddf9); outline-offset: -2px; }
.gpm-frontline-slot [data-gpm-frontline-slot][data-slot-state="empty"] { background: #35383e; color: #a4a7ac; }
.gpm-frontline-slot [data-gpm-frontline-slot][data-slot-state="empty"] .gpm-frontline-slot-name { color: #b8bbc2; }
.gpm-frontline-portrait { display: block; width: var(--frontline-face-width); height: var(--frontline-face-height); border-radius: 3px; object-fit: cover; object-position: top; }
.gpm-frontline-portrait-empty { background: #666a73; opacity: .42; }
.gpm-frontline-slot [data-gpm-frontline-remove-army] { position: absolute; z-index: 1; right: 3px; top: 3px; height: 16px; min-height: 16px; width: 16px; padding: 0; border: 1px solid #9e3139; border-radius: 3px; background: #67282e; color: #fff0f1; font: 700 13px/14px var(--font-display); cursor: pointer; }
.gpm-frontline-slot [data-gpm-frontline-remove-army]:hover { background: #ab3845; }
.gpm-frontline-add-slot { flex: 0 0 var(--frontline-add-width); box-sizing: border-box; height: var(--frontline-tile-height); min-height: var(--frontline-tile-height); font-size: 18px; }
.gpm-frontline-army-meta { display: grid; gap: var(--gap-2); }
.gpm-frontline-army-meta label { display: grid; gap: 2px; min-width: 0; }
.gpm-frontline-army-meta :is(input,select) { width: 100%; box-sizing: border-box; }
.gpm-frontline-editor details[open] > summary { margin-bottom: var(--gap-2); }
.gpm-frontline-editor details > .gpm-frontline-color { margin-top: var(--gap-2); }
.gpm-frontline-arrow-labels { position: fixed; inset: 0; pointer-events: none; z-index: 44; overflow: hidden; }
.gpm-frontline-arrow-label { position: absolute; box-sizing: border-box; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 0 2px; border-radius: 2px; color: white; background: var(--frontline-color); font: var(--fw-semi) 10px/13px var(--font-display); text-shadow: 0 0 2px #000, 0 1px 2px #000; }
.gpm-frontline-objective-dot { position: absolute; box-sizing: border-box; width: 7px; height: 7px; transform: translate(-50%, -50%); border: 1px solid #151c26; border-radius: 50%; background: var(--frontline-color); box-shadow: 0 0 0 1px #151c26a6; }
.gpm-frontline-objective-dot.is-muted { width: 5px; height: 5px; }
.gpm-frontline-formation-mark { position: absolute; width: 34px; height: 34px; transform: translate(-50%, -50%); border: 2px solid var(--frontline-color); border-radius: 7px; box-shadow: 0 0 0 1px #111a24, inset 0 0 0 1px #111a24; box-sizing: border-box; }
.gpm-frontline-contact-keyboard { display: flex; flex-wrap: wrap; gap: var(--gap-2); align-items: center; }
.gpm-frontline-formation-state { display: grid; gap: 5px; margin: 0; }
.gpm-frontline-formation-state div { display: grid; gap: 2px; }
.gpm-frontline-formation-state dd { margin: 0; color: var(--text-2); }
.gpm-frontline-roster-status { align-self: center; padding: 8px 12px; margin: 0; color: var(--text-2); border-radius: var(--r-sm); background: var(--body); }
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
    if (button) void gpmOpenFrontline(ui, session);
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
  void Je(session, "gpm.frontline", {}).then(result => {
    if (!host.isConnected || ui.sim !== session) return;
    if (!Array.isArray(result?.wars)) throw new Error("Frontline wars unavailable");
    host.frontlineRevision = revision;
    const signature = JSON.stringify(result.wars);
    if (wars.frontlineSignature !== signature) {
      wars.frontlineSignature = signature;
      wars.innerHTML = result.wars.length ? '<button type="button" class="k" data-authority-safe data-gpm-frontline-open>Open War Theatre</button>' : "";
    }
    status.textContent = result.wars.length ? "Select an army in the War Theatre to give it frontline orders." : "No ground war under your command.";
  }).catch(error => {
    console.warn("[PPO] Could not load Frontline wars", error);
    if (host.isConnected) status.textContent = "Frontline could not load. Reopen the tab to retry.";
  }).finally(() => { host.frontlinePending = false; });
}

async function gpmOpenFrontline(ui, session) {
  if (ui.sim !== session || !ui.canOpenMilitaryMode?.()) return;
  if (!ui.militaryModeActive) await ui.openMilitaryMode();
  if (ui.sim === session) gpmRefreshFrontlineMap(ui);
}

function gpmMountFrontline(ui, session, warId) {
  const registry = K("war-registry");
  const frame = K("mil-frame");
  const consoleHost = K("war-console");
  const globe = ui.globe;
  const canvas = globe?.renderer?.domElement;
  if (!registry || !frame || !canvas || !consoleHost || consoleHost.parentElement !== frame) return;
  gpmFrontlineMountStyle();
  const host = document.createElement("section");
  host.className = "gpm-frontline gpm-frontline-dock";
  host.hidden = true;
  host.setAttribute("data-gpm-frontline-panel", "");
  host.setAttribute("aria-label", "Frontline planner");
  registry.append(host);
  const state = ui._gpmFrontline = { session, ui, playerKey: session.playerKey, warId, host, registry, frame, globe, canvas,
    events: new AbortController(), data: null, draft: null, drawing: null, selectedSlot: null, selectedArmyId: null,
    feedback: "", meshes: [], request: 0 };
  const options = { signal: state.events.signal };
  gpmMountFrontlineRoster(state, options, consoleHost);
  host.addEventListener("click", event => gpmFrontlineClick(state, event), options);
  host.addEventListener("input", event => {
    const input = event.target.closest("[data-gpm-frontline-army-name]");
    if (input && state.draft && !state.busy && state.draft.name !== input.value) {
      state.draft.name = input.value;
      state.draft.changed = true;
      gpmPaintFrontlinePaths(state);
    }
  }, options);
  host.addEventListener("change", event => {
    if (!state.draft || state.busy) return;
    const contact = event.target.closest("[data-gpm-frontline-contact]");
    if (contact && state.drawing?.kind === "line") {
      state.drawing.keyboard = state.data?.contacts?.find(item => item.id === contact.value) || null;
      state.drawing.preview = state.drawing.keyboard?.line || null;
      return gpmPaintFrontline(state);
    }
    const general = event.target.closest("[data-gpm-frontline-general]");
    if (general) {
      state.draft.generalId = general.value || null;
      state.draft.changed = true;
      return;
    }
    const color = event.target.closest("[data-gpm-frontline-color]");
    if (color) {
      state.draft.color = color.value;
      state.draft.changed = true;
      return gpmPaintFrontline(state);
    }
    const input = event.target.closest("[data-gpm-frontline-formation]");
    if (!input) return;
    if (input.checked) state.draft.ids.add(input.value);
    else state.draft.ids.delete(input.value);
    state.draft.changed = true;
    gpmPaintFrontline(state);
  }, options);
  gpmBindFrontlineDraw(state);
  gpmPaintFrontline(state);
  void gpmLoadFrontline(state, true);
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
  state.selectionLayer?.remove();
  state.frame.classList.remove("gpm-frontline-planning");
  state.registry.classList.remove("gpm-frontline-open");
  state.canvas.classList.remove("gpm-frontline-crosshair");
  gpmClearFrontlinePaths(state);
}

function gpmRefreshFrontlineMap(ui) {
  const state = ui._gpmFrontline;
  const session = ui.sim;
  const view = session && Ci(session);
  const key = view && ui._activeWarKey();
  const warId = view?.wars?.[key]?.id;
  if (state && (!ui.militaryModeActive || !warId || state.warId !== warId || session !== state.session ||
      session.playerKey !== state.playerKey || state.globe !== ui.globe)) gpmCloseFrontline(ui);
  if (!ui.militaryModeActive || !warId) return;
  const current = ui._gpmFrontline;
  if (!current) return gpmMountFrontline(ui, session, warId);
  if (!current.busy && !current.drawing?.pointer && !current.drawing?.validating) void gpmLoadFrontline(current);
}

async function gpmLoadFrontline(state, force = false) {
  if (state.ui._gpmFrontline !== state) return;
  const revision = `${state.session.day}|${state.session.status?.commitRevision}`;
  if (!force && (state.pending || state.revision === revision || performance.now() - state.lastRequest < 900)) return;
  const request = ++state.request;
  state.pending = true;
  state.lastRequest = performance.now();
  try {
    const result = await Je(state.session, "gpm.frontline", { warId: state.warId });
    if (state.ui._gpmFrontline !== state || request !== state.request) return;
    if (!Array.isArray(result?.wars)) throw new Error("Unexpected Frontline view");
    const wasWaiting = state.drawing?.kind === "line" && !state.data?.contacts?.length;
    state.data = result.warId === state.warId ? result : { plans: [], formations: [], contacts: [], status: "unavailable" };
    state.revision = revision;
    if (wasWaiting && state.data.contacts?.length && !state.drawing?.validating) state.feedback = "Click the front for its full length, or drag along it to take a section.";
    gpmPaintFrontline(state);
  } catch (error) {
    if (state.ui._gpmFrontline !== state || request !== state.request) return;
    console.warn("[PPO] Could not load Frontline plan", error);
    state.feedback = "Frontline could not load. Close and reopen the planner to retry.";
    gpmPaintFrontline(state);
  } finally {
    if (request === state.request) state.pending = false;
  }
}

function gpmFrontlineStatus(plan) {
  const labels = { hold: "Holding", holding: "Holding", advance: "Advancing", advancing: "Advancing",
    assembling: "Assembling", regrouping: "Regrouping", resupply: "Resupplying", resupplying: "Resupplying", completed: "Objective secured",
    complete: "Objective secured", paused: "Paused", ceasefire: "Ceasefire", blocked: "Order blocked",
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

function gpmKeepFrontlineDraft(state) {
  if (!state.draft?.changed) return false;
  state.feedback = "Save or cancel this draft before switching armies or orders.";
  gpmPaintFrontline(state);
  return true;
}

function gpmMountFrontlineRoster(state, options, consoleHost) {
  state.slots = 2;
  const roster = state.roster = document.createElement("nav");
  roster.className = "gpm-frontline-roster-bar";
  roster.setAttribute("data-gpm-frontline-roster-bar", "");
  roster.setAttribute("aria-label", "Armies");
  const layer = state.labelLayer = document.createElement("div");
  layer.className = "gpm-frontline-arrow-labels";
  layer.setAttribute("aria-hidden", "true");
  const selection = state.selectionLayer = layer.cloneNode(false);
  state.formationMarks = new Map();
  document.body.append(layer, selection);
  consoleHost.before(roster);
  state.frame.classList.add("gpm-frontline-planning");
  roster.addEventListener("click", event => {
    if (state.busy || state.drawing?.validating || state.data?.status !== "active") return;
    const remove = event.target.closest("[data-gpm-frontline-remove-army]");
    if (remove) {
      if (!gpmKeepFrontlineDraft(state)) void gpmSendFrontline(state, "remove", { id: remove.dataset.gpmFrontlineRemoveArmy, army: true });
      return;
    }
    if (event.target.closest("[data-gpm-frontline-add-slot]")) {
      if (gpmKeepFrontlineDraft(state)) return;
      const occupied = gpmFrontlineArmySlots(state.data.plans);
      let slot = 1;
      while (occupied.has(slot)) slot++;
      gpmSelectFrontlineArmy(state, null, slot);
      return;
    }
    const button = event.target.closest("[data-gpm-frontline-slot]");
    if (!button) return;
    const slot = Number(button.dataset.gpmFrontlineSlot);
    if ((state.draft && state.selectedSlot === slot) || gpmKeepFrontlineDraft(state)) return;
    const plan = state.data.plans.find(item => item.id === button.dataset.armyId);
    gpmSelectFrontlineArmy(state, plan, slot);
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
  const url = person && yse(person, year, "militaire");
  return url ? `<img class="gpm-frontline-portrait" alt="${b(person.name)}" src="${b(url)}">`
    : '<span class="gpm-frontline-portrait gpm-frontline-portrait-empty" aria-hidden="true"></span>';
}

function gpmPaintFrontlineRoster(state) {
  if (state.data?.status === "unavailable") {
    state.rosterHtml = '<p class="gpm-frontline-roster-status" role="status">Frontline orders are unavailable in this war.</p>';
    state.roster.innerHTML = state.rosterHtml;
    return;
  }
  const plans = state.data?.plans || [];
  const slots = gpmFrontlineArmySlots(plans);
  const currentOrders = new Map(plans.filter(plan => plan.status !== "queued").map(plan => [plan.armyId || plan.id, plan]));
  state.slots = Math.max(state.slots, ...slots.keys());
  const enabled = state.data?.status === "active" && !state.busy && !state.drawing?.validating;
  const html = Array.from({ length: state.slots }, (_, index) => {
    const slot = index + 1;
    const plan = slots.get(slot);
    const name = plan?.name || `Army ${slot}`;
    const order = plan && (currentOrders.get(plan.id) || plan);
    const status = order && (order.status === "unassigned" ? "No front" : gpmFrontlineStatus(order));
    return `<div class="gpm-frontline-slot">
      <button type="button" class="k" data-gpm-frontline-slot="${slot}" data-army-id="${b(plan?.id || "")}" data-slot-state="${plan ? "filled" : "empty"}" aria-pressed="${state.selectedSlot === slot}" aria-label="${b(plan ? `Select ${name}, ${status}` : `Create ${name}`)}" title="${b(status ? `${name} · ${status}` : name)}" style="--frontline-color:${gpmFrontlineColor(plan?.color)}"${enabled ? "" : " disabled"}>
        <span class="gpm-frontline-slot-name">${plan ? b(name) : "Empty"}</span>${gpmFrontlinePortrait(state, plan?.generalId)}${status ? `<small class="gpm-frontline-slot-status" data-gpm-frontline-army-status>${b(status)}</small>` : ""}
      </button>${plan ? `<button type="button" data-gpm-frontline-remove-army="${b(plan.id)}" title="${b(`Disband ${name}`)}" aria-label="${b(`Disband ${name}`)}"${enabled ? "" : " disabled"}>×</button>` : ""}
    </div>`;
  }).join("") + `<button type="button" class="k gpm-frontline-add-slot" data-gpm-frontline-add-slot aria-label="Add army" title="Add army"${enabled ? "" : " disabled"}>+</button>`;
  if (state.rosterHtml !== html) {
    const active = state.roster.contains(document.activeElement) ? document.activeElement.dataset : null;
    const focus = active?.gpmFrontlineSlot
      ? `[data-gpm-frontline-slot="${CSS.escape(active.gpmFrontlineSlot)}"]`
      : active?.gpmFrontlineRemoveArmy
        ? `[data-gpm-frontline-remove-army="${CSS.escape(active.gpmFrontlineRemoveArmy)}"]`
        : active?.gpmFrontlineAddSlot != null ? "[data-gpm-frontline-add-slot]" : null;
    state.rosterHtml = html;
    state.roster.style.setProperty("--frontline-slot-width", `clamp(56px, calc((100vw - 64px) / ${state.slots}), var(--frontline-max-slot-width))`);
    state.roster.innerHTML = html;
    if (focus) state.roster.querySelector(focus)?.focus({ preventScroll: true });
  }
}

function gpmSelectFrontlineArmy(state, plan, slot) {
  state.slots = Math.max(state.slots, slot);
  state.selectedSlot = slot;
  state.selectedArmyId = plan?.id || null;
  if (!plan) {
    gpmEditFrontlineDraft(state, null, null, slot);
    gpmFrontlineSetDraw(state, "select");
    return;
  }
  const orders = state.data.plans.filter(order => order.id === plan.id || order.armyId === plan.id);
  const live = orders.findLast(order => !["completed", "queued"].includes(order.status));
  if (live && !live.line?.length) {
    gpmEditFrontlineDraft(state, live, null, slot);
    gpmFrontlineSetDraw(state, live.formationIds.length ? "line" : "select");
    return;
  }
  state.draft = null;
  gpmFrontlineSetDraw(state, null);
}

function gpmFrontlineFormationState(unit) {
  const execution = unit?.execution;
  if (!execution) return "";
  const combat = execution.pressuring ? "Attacking" :
    execution.fighting && execution.received && unit.nativeOrder?.kind === "hold" ? "Defending" : "In combat";
  const status = { available: "Available", unassigned: "No front assigned", waiting: "Awaiting orders", moving: "Moving to assigned position",
    ready: "Ready", holding: "Holding", advancing: "Advancing", fighting: combat, resupplying: "Resupplying", regrouping: "Regrouping",
    blocked: "Movement blocked", paused: "Paused", staff: "General staff command" }[execution.status] || "Waiting for orders";
  const reason = { no_connected_front: "Waiting for a connected front", front_changed: "The front moved", no_land_route: "No land route to the position",
    no_route: "No route to the position", "assigned-other-conflict": "Assigned to another war", other_conflict: "Assigned to another war",
    ceasefire: "Paused by ceasefire", resume_required: "Awaiting a new order to resume", staff_dispatch: "Awaiting dispatch",
    deployment: "Waiting to deploy", no_slot: "Waiting for a position on the front", awaiting_position: "Preparing to move to the assigned position",
    ammunition: "Resupplying ammunition", cohesion: "Regrouping to recover cohesion", low_ammunition: "Waiting for ammunition",
    low_readiness: "Waiting to recover readiness", not_deployed: "Waiting to deploy" }[execution.reason];
  const assignment = execution.control === "player" && execution.requestedDay != null ?
    execution.received ? "Order received" : "Order pending" : "";
  const progress = execution.status === "moving" && Number.isFinite(unit.destination?.progress) ? `${Math.round(unit.destination.progress * 100)}% of route` : "";
  return [reason || status, assignment, progress].filter(Boolean).join(" · ");
}

function gpmPaintFrontline(state) {
  const { host, data, draft, busy } = state;
  if (!host.isConnected) return;
  const selected = state.selectedSlot != null;
  host.hidden = !selected;
  state.registry.classList.toggle("gpm-frontline-open", selected);
  if (!selected) {
    gpmPaintFrontlineRoster(state);
    return gpmPaintFrontlinePaths(state);
  }
  const plans = data?.plans || [];
  const roots = plans.filter(plan => !plan.afterId || !plans.some(other => other.id === plan.afterId));
  const nextBy = new Map(plans.filter(plan => plan.afterId).map(plan => [plan.afterId, plan]));
  const ownedBy = new Map(roots.flatMap(plan => plan.formationIds.map(id => [id, plan.id])));
  const currentWar = data?.wars?.find(war => war.id === state.warId);
  const canEdit = data?.warId === state.warId && (!data.status || data.status === "active");
  const canDraft = canEdit && !busy && !state.drawing?.validating;
  const disabled = canDraft ? "" : " disabled";
  const opt = (action, title, extra = "") => `<button type="button" class="k" data-gpm-frontline-action="${action}" ${extra}>${title}</button>`;
  const command = (mode, label, plan) => `<button type="button" class="k" data-gpm-frontline-mode="${mode}" data-gpm-fl-focus="${b(plan.id)}-${mode}" aria-pressed="${plan.mode === mode}"${disabled}${mode === "advance" && !plan.arrow?.length ? " disabled" : ""}>${label}</button>`;
  const focusKey = document.activeElement?.getAttribute("data-gpm-fl-focus");
  const rosterScroll = host.querySelector(".gpm-frontline-roster")?.scrollTop || 0;
  const detailsOpen = host.querySelector("[data-gpm-frontline-army-details]")?.open;
  const unitDetails = host.querySelector("[data-gpm-frontline-formation-details]");
  const fixedRoster = draft && (draft.afterId || nextBy.has(draft.id));
  const allGenerals = data?.generals || [];
  const otherGenerals = new Set(roots.filter(plan => plan.id !== draft?.id).map(plan => String(plan.generalId)));
  const armyMeta = draft && !draft.afterId ? `<div class="gpm-frontline-army-meta">
    <label>Army name<input class="k" type="text" maxlength="80" data-gpm-frontline-army-name data-gpm-fl-focus="army-name" value="${b(draft.name)}"${disabled}></label>
    <label>General<select class="k" data-gpm-frontline-general data-gpm-fl-focus="army-general"${disabled}>
      <option value=""${!draft.generalId ? " selected" : ""}>Unassigned</option>
      ${allGenerals.map(general => `<option value="${b(general.id)}"${draft.generalId === String(general.id) ? " selected" : ""}${otherGenerals.has(String(general.id)) ? " disabled" : ""}>${b(general.name)}</option>`).join("")}
    </select></label>
  </div>` : "";
  const color = draft && !draft.metadataOnly ? `<label class="gpm-frontline-color">Color <span class="gpm-frontline-swatch" style="--frontline-color:${gpmFrontlineColor(draft.color)}"></span>
    <select class="k" data-gpm-frontline-color data-gpm-fl-focus="group-color"${disabled}>${Object.keys(gpmFrontlinePalette).map(color => `<option value="${color}"${draft.color === color ? " selected" : ""}>${color[0].toUpperCase() + color.slice(1)}</option>`).join("")}</select>
  </label>` : "";
  const contacts = data?.contacts || [];
  const hasFront = draft?.line.length >= 2;
  const chooseMode = draft?.chooseMode && hasFront;
  const canSave = canDraft && draft && !draft.needsFront &&
    (draft.metadataOnly || ((!hasFront || draft.ids.size) && (!draft.afterId || hasFront && draft.arrow.length >= 2)));
  const saveLabel = draft?.afterId ? "Save order" : chooseMode ? "Save &amp; Hold" :
    draft?.chooseMode ? "Save without front" : "Save army";
  const commit = opt("save", saveLabel, `data-gpm-fl-focus="save-group"${draft?.chooseMode ? ' data-gpm-frontline-save-mode="hold"' : ""}${canSave ? "" : " disabled"}`);
  const advance = chooseMode ? opt("save-advance", "Save &amp; Advance",
    `data-gpm-fl-focus="save-advance" data-gpm-frontline-save-mode="advance"${canSave && draft.arrow.length >= 2 ? "" : " disabled"}`) : "";
  const keyboard = state.drawing?.kind === "line" && contacts.length ? `<div class="gpm-frontline-contact-keyboard">
    <label>Choose a front <select class="k" data-gpm-frontline-contact data-gpm-fl-focus="contact"${disabled}>
      <option value="">Select</option>${contacts.map((contact, index) => `<option value="${b(contact.id)}"${state.drawing.keyboard?.id === contact.id ? " selected" : ""}>Front ${index + 1}</option>`).join("")}
    </select></label>${opt("assign-contact", "Use entire front", !state.drawing.keyboard || !canDraft ? "disabled" : "")}
  </div>` : "";
  const formationRoster = draft && !draft.metadataOnly && !fixedRoster ? `<div class="gpm-frontline-roster" role="group" aria-label="Ground formations">${(data?.formations || []).map(formation => {
    const taken = ownedBy.get(formation.id) && ownedBy.get(formation.id) !== draft.id;
    const note = taken ? "Assigned to another army" : formation.eligible === false ? "Unavailable" : formation.posture === "resupply" ? "Resupplying" : "";
    return `<label><input type="checkbox" data-gpm-frontline-formation data-gpm-fl-focus="${b(formation.id)}" value="${b(formation.id)}"${draft.ids.has(formation.id) ? " checked" : ""}${disabled}${(taken || formation.eligible === false) && !draft.ids.has(formation.id) ? " disabled" : ""}><span>${b(formation.name || formation.id)}${note ? `<small>${note}</small>` : ""}</span></label>`;
  }).join("") || '<p>No eligible ground formations are available.</p>'}</div>` : "";
  const editing = draft && `<section class="gpm-frontline-editor" aria-label="Edit army">
    <h4>${draft.id ? draft.afterId ? "Edit order" : "Edit army" : draft.afterId ? "Queue next order" : "New army"}</h4>
    ${draft.metadataOnly ? armyMeta : `
    <div class="gpm-frontline-actions">
      ${fixedRoster ? "" : opt("select", "Select on map", `data-gpm-fl-focus="select-formations" aria-pressed="${state.drawing?.kind === "select"}"${disabled}`)}
      ${opt("line", draft.line.length ? "Change front" : "Set frontline", `data-gpm-fl-focus="draw-front" aria-pressed="${state.drawing?.kind === "line"}"${disabled}`)}
      ${opt("arrow", draft.arrow.length ? "Change objective" : "Set objective", `data-gpm-fl-focus="draw-arrow" aria-pressed="${state.drawing?.kind === "arrow"}"${!hasFront || !canDraft ? " disabled" : ""}`)}
    </div>
    ${keyboard}
    <small>${draft.ids.size} ${draft.ids.size === 1 ? "formation" : "formations"}${fixedRoster ? " in order sequence" : " selected"} · ${draft.contact?.scope === "whole" ? "Entire front" : draft.contact?.scope === "section" ? "Front section" : hasFront ? "Front assigned" : "No front assigned"}${draft.arrow.length ? " · Objective set" : ""}</small>`}
    <div class="gpm-frontline-actions">
      ${commit}${advance}
      ${opt("cancel", "Cancel", busy ? "disabled" : "")}
    </div>
    ${formationRoster}
    ${draft.metadataOnly ? "" : `<details data-gpm-frontline-army-details${detailsOpen ? " open" : ""}><summary>${draft.afterId ? "Order details" : "Army details"}</summary>${armyMeta}${color}</details>`}
  </section>`;
  const groups = roots.map((root, index) => {
    if (root.id !== state.selectedArmyId) return "";
    const units = root.formationIds.map(id => (data.formations || []).find(row => row.id === id)).filter(Boolean);
    const sequence = [];
    for (let next = root; next && sequence.length < plans.length; next = nextBy.get(next.id)) sequence.push(next);
    return `<section class="gpm-frontline-group"><h4>${b(root.name || `Army ${root.slot || index + 1}`)}</h4>
      ${sequence.map((plan, order) => {
        const completed = plan.status === "completed";
        const unassigned = plan.status === "unassigned";
        const tail = !nextBy.has(plan.id);
        const unavailable = completed && plan.reason === "no_connected_front";
        const lostRoute = plan.status === "blocked" && ["water", "no_land_route"].includes(plan.reason);
        const liveOrder = plan.status !== "queued" && !completed && !unassigned;
        const objective = gpmFrontlineObjective(state, plan);
        return `<article class="gpm-frontline-order" data-gpm-frontline-plan="${b(plan.id)}" data-mode="${b(plan.mode)}" data-status="${b(plan.status)}">
        <strong class="gpm-frontline-order-label"><span class="gpm-frontline-swatch" style="--frontline-color:${gpmFrontlineColor(plan.color)}"></span>${sequence.length > 1 ? `Order ${order + 1} · ` : ""}${b(gpmFrontlineStatus(plan))}${completed && tail && !unavailable ? " · Holding" : ""}</strong>
        ${objective ? `<small>${b(objective)}</small>` : ""}
        ${unavailable ? "<small>No connected front near the objective.</small>" : ""}
        ${liveOrder && plan.reason === "no_connected_front" ? "<small>Waiting for a connected front.</small>" : ""}
        ${lostRoute ? "<small>No reachable land route. Edit the order to choose another objective.</small>" : ""}
        ${liveOrder ? `<div class="gpm-frontline-actions">
          ${command("hold", "Hold", plan)}${command("advance", "Advance", plan)}
          ${!plan.arrow?.length && draft?.id !== plan.id ? opt("objective", "Set objective", disabled) : ""}
        </div>` : ""}
        <div class="gpm-frontline-actions">
          ${!completed ? opt("edit", unassigned ? "Set frontline" : "Edit order", disabled) : ""}
          ${tail ? opt("remove", "Remove", disabled) : ""}
          ${tail && ((completed && !unavailable) || plan.arrow?.length) ? opt("queue", "Queue next order", disabled) : ""}
        </div>
      </article>`;
      }).join("")}
      ${units.length ? `<details data-gpm-frontline-formation-details data-army-id="${b(root.id)}"${unitDetails?.dataset.armyId !== root.id || unitDetails.open ? " open" : ""}><summary>${units.length} ${units.length === 1 ? "formation" : "formations"}</summary><dl class="gpm-frontline-formation-state">${units.map(unit => `<div data-gpm-frontline-unit="${b(unit.id)}" data-status="${b(unit.execution?.status || "")}" data-received="${Boolean(unit.execution?.received)}"><dt>${b(unit.name || unit.id)}</dt><dd>${b(gpmFrontlineFormationState(unit))}</dd></div>`).join("")}</dl></details>` : ""}
      <div>${opt("metadata", "Edit army", `data-gpm-army-id="${b(root.id)}"${disabled}`)}</div>
    </section>`;
  }).join("");
  const html = `<header><h3 class="mc-title">Army orders</h3>${opt("close", "Deselect")}</header>
    ${currentWar ? `<p>${b(currentWar.name || currentWar.id)}</p>` : ""}
    <p class="gpm-frontline-feedback" data-gpm-frontline-feedback role="status">${b(state.feedback ||
      (data && !canEdit ? "This war is unavailable for new orders." : ""))}</p>
    ${groups}${editing || (!state.selectedArmyId && canEdit ? `<div>${opt("new", "New army", disabled)}</div>` : "")}`;
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
  state.selectedSlot = slot;
  if (plan || predecessor) state.selectedArmyId = (plan || predecessor).armyId || (plan || predecessor).id;
  const color = plan?.color || predecessor?.color || defaults[(slot - 1) % defaults.length];
  const heldLine = predecessor?.status === "completed"
    ? predecessor.liveLine?.length ? predecessor.liveLine : predecessor.line : null;
  const assignedLine = plan?.liveLine?.length ? plan.liveLine : plan?.line;
  const usedGenerals = new Set(allPlans.filter(item => !item.afterId).map(item => String(item.generalId)));
  const availableGeneral = state.data.generals?.find(item => !usedGenerals.has(String(item.id)))?.id;
  const general = plan ? plan.generalId : predecessor ? predecessor.generalId : availableGeneral;
  state.draft = { id: plan?.id, afterId: plan?.afterId || predecessor?.id, ids: new Set(plan?.formationIds || predecessor?.formationIds),
    line: assignedLine || heldLine || [], arrow: plan?.arrow || [], objectiveProvinceKey: plan?.objectiveProvinceKey,
    mode: plan?.mode || (predecessor ? "advance" : "hold"), color, slot, metadataOnly,
    chooseMode: !metadataOnly && !predecessor && !plan?.afterId && !plan?.line?.length,
    name: plan?.name || predecessor?.name || `Army ${slot}`, generalId: general == null ? null : String(general) };
  gpmFrontlineSetDraw(state, null);
  state.host.querySelector(".gpm-frontline-editor")?.scrollIntoView({ block: "nearest" });
  const target = heldLine?.[Math.floor(heldLine.length / 2)] || predecessor?.arrow?.at(-1);
  if (target) state.globe.focusLatLon?.(target[0], target[1], 2.4);
}

function gpmFrontlineClick(state, event) {
  const button = event.target.closest("button");
  if (!button || button.disabled || state.busy) return;
  const { gpmFrontlineAction: action, gpmFrontlineMode: mode } = button.dataset;
  if (!action && !mode) return;
  if (["close", "remove", "metadata", "new", "edit", "objective", "queue"].includes(action) && gpmKeepFrontlineDraft(state)) return;
  if (action === "close") {
    state.selectedSlot = null;
    state.selectedArmyId = null;
    state.draft = null;
    gpmFrontlineSetDraw(state, null);
    return;
  }
  const id = button.closest("[data-gpm-frontline-plan]")?.dataset.gpmFrontlinePlan;
  if (mode) return void gpmSendFrontline(state, "mode", { id, mode });
  if (action === "remove") return void gpmSendFrontline(state, "remove", { id });
  if (action === "metadata") {
    const army = state.data.plans.find(row => row.id === button.dataset.gpmArmyId);
    if (army) gpmEditFrontlineDraft(state, army, null, null, true);
    return;
  }
  if (action === "assign-contact" && state.drawing?.keyboard) {
    return void gpmTraceFrontline(state, state.drawing, { contactId: state.drawing.keyboard.id });
  }
  if (action === "new" || action === "edit" || action === "objective" || action === "queue") {
    const plan = (action === "edit" || action === "objective") && state.data.plans.find(row => row.id === id);
    const predecessor = action === "queue" && state.data.plans.find(row => row.id === id);
    gpmEditFrontlineDraft(state, plan, predecessor);
    if (action === "objective" && state.draft.line.length >= 2) gpmFrontlineSetDraw(state, "arrow");
    else if (plan?.status === "unassigned" && plan.formationIds.length) gpmFrontlineSetDraw(state, "line");
  } else if (action === "cancel") {
    state.draft = null;
    gpmFrontlineSetDraw(state, null);
  } else if (action === "line" || action === "arrow" || action === "select") {
    gpmFrontlineSetDraw(state, state.drawing?.kind === action ? null : action);
  } else if ((action === "save" || action === "save-advance") && state.draft && !state.drawing?.validating) {
    const { id: draftId, ids, line, arrow, objectiveProvinceKey, mode: draftMode, color, afterId, name, generalId, slot, metadataOnly, contact, chooseMode, needsFront } = state.draft;
    if (needsFront) return;
    if (metadataOnly) return void gpmSendFrontline(state, "army", { id: draftId, name, generalId, slot });
    const advancing = action === "save-advance";
    if (advancing && (!chooseMode || line.length < 2 || !ids.size || arrow.length < 2)) return;
    const orderMode = chooseMode ? (advancing ? "advance" : "hold") : draftMode;
    void gpmSendFrontline(state, "upsert", { id: draftId, formationIds: [...ids], line: contact ? undefined : line, arrow, objectiveProvinceKey, mode: orderMode, color, afterId, name, generalId, slot,
      ...gpmFrontlineContactParams(contact) });
  }
}

function gpmFrontlineSetDraw(state, kind, message = null) {
  state.selectionBox?.remove();
  state.selectionBox = null;
  state.drawing = kind ? { kind } : null;
  if (kind === "arrow") state.drawing.start = gpmFrontlineMidpoint(state.draft.line);
  state.canvas.classList.toggle("gpm-frontline-crosshair", !!kind);
  state.feedback = message ?? (kind === "line" ? state.data?.contacts?.length ? "Click the front for its full length, or drag along it to take a section." : "No live land contact yet. Let the war clock advance, then select the front."
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
      const [lat, lon] = n2(vector);
      return [lon, lat];
    }
    remaining -= distance;
  }
  return line[0];
}

function gpmFrontlineContactParams(contact) {
  if (!contact?.id) return {};
  return { contactId: contact.id, startIndex: contact.startIndex, endIndex: contact.endIndex };
}

function gpmFrontlineScreenPoint(globe, point, lift = 1) {
  const radius = globe.sphere.geometry.parameters.radius;
  const [lon, lat] = point;
  const world = ct(lat, lon, radius);
  if (world.dot(globe.camera.position) <= radius ** 2) return null;
  const map = world.multiplyScalar(lift).project(globe.camera);
  if (map.z < -1 || map.z > 1) return null;
  return [(map.x * .5 + .5) * window.innerWidth, (.5 - map.y * .5) * window.innerHeight];
}

function gpmPickFrontlineContact(state, x, y) {
  const contacts = state.data?.contacts;
  if (!contacts?.length) return null;
  const { globe } = state;
  const { camera } = globe;
  camera.updateMatrixWorld();
  const viewport = [window.innerWidth, window.innerHeight, ...camera.matrixWorldInverse.elements, ...camera.projectionMatrix.elements].join(",");
  let projection = state.contactProjection;
  if (projection?.contacts !== contacts || projection.viewport !== viewport) {
    const chains = contacts.map(contact => ({ contact, points: contact.line.map(point => gpmFrontlineScreenPoint(globe, point, 1.0012)) }));
    projection = state.contactProjection = { contacts, viewport, chains };
  }
  let closest = null;
  let threshold = 14 ** 2;
  for (const { contact, points } of projection.chains) {
    for (let index = 1; index < points.length; index++) {
      const a = points[index - 1];
      const b = points[index];
      if (!a || !b) continue;
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const fraction = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1)));
      const distance = (x - a[0] - fraction * dx) ** 2 + (y - a[1] - fraction * dy) ** 2;
      if (distance >= threshold) continue;
      threshold = distance;
      closest = { contact, index: fraction < .5 ? index - 1 : index };
    }
  }
  return closest;
}

function gpmFrontlineContactSection(contact, start, end) {
  if (start === end) return [];
  const a = Math.min(start, end);
  const b = Math.max(start, end);
  const section = contact.line.slice(a, b + 1);
  if (!contact.closed) return section;
  const length = line => line.slice(1).reduce((sum, point, index) => sum + gpmFrontlineDistance(line[index], point), 0);
  return length(section) > length(contact.line) / 2 ? contact.line.slice(b).concat(contact.line.slice(1, a + 1)) : section;
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
    if (draw.kind === "line") {
      const hit = gpmPickFrontlineContact(state, event.clientX, event.clientY);
      if (!hit) {
        state.feedback = "Point at the visible contact line to highlight a front.";
        return gpmPaintFrontline(state);
      }
      draw.pointer = event.pointerId;
      draw.origin = [event.clientX, event.clientY];
      draw.hit = hit;
      draw.preview = hit.contact.line;
      state.globe._focusAnim = null;
      return gpmPaintFrontlinePaths(state);
    }
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
    if (draw?.kind === "line" && !draw.validating) {
      if (event.target !== state.canvas && draw.pointer == null) {
        draw.preview = null;
        return gpmPaintFrontlinePaths(state);
      }
      const hit = gpmPickFrontlineContact(state, event.clientX, event.clientY);
      if (draw.pointer === event.pointerId) {
        eat(event);
        draw.preview = hit?.contact.id === draw.hit.contact.id ? gpmFrontlineContactSection(hit.contact, draw.hit.index, hit.index) : null;
      } else draw.preview = hit?.contact.line || null;
      return gpmPaintFrontlinePaths(state);
    }
    if (!draw || draw.pointer !== event.pointerId) return;
    eat(event);
    if (draw.kind === "select") {
      gpmFrontlineSelectionRect(state, draw.origin, [event.clientX, event.clientY]);
      return;
    }
    if (Math.hypot(event.clientX - draw.screen[0], event.clientY - draw.screen[1]) < 12) return;
    const point = at(event);
    if (!point) return;
    draw.screen = [event.clientX, event.clientY];
    if (draw.kind === "arrow") draw.preview = gpmClipFrontlinePreview(state.globe, draw.start, point);
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
    if (draw.kind === "line") {
      const end = gpmPickFrontlineContact(state, event.clientX, event.clientY);
      const start = draw.hit;
      const drag = Math.hypot(event.clientX - draw.origin[0], event.clientY - draw.origin[1]) >= 8;
      if (!end || end.contact.id !== start.contact.id || drag && end.index === start.index) {
        draw.preview = null;
        state.feedback = "Drag between two points on the same highlighted front.";
        return gpmPaintFrontline(state);
      }
      const contactId = start.contact.id;
      return void gpmTraceFrontline(state, draw, drag ? { contactId, startIndex: start.index, endIndex: end.index } : { contactId });
    }
    const point = at(event);
    if (point) gpmFinishFrontlineDraw(state, draw, point);
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
  const { camera } = state.globe;
  const reserved = new Set((state.data?.plans || []).filter(plan => !plan.afterId && plan.id !== draft.id)
    .flatMap(plan => plan.formationIds));
  const found = [];
  const padding = bounds.right - bounds.left < 5 && bounds.bottom - bounds.top < 5 ? 8 : 0;
  camera.updateMatrixWorld();
  for (const formation of state.data?.formations || []) {
    if (!formation.position || formation.eligible === false || reserved.has(formation.id)) continue;
    const location = gpmFrontlineScreenPoint(state.globe, formation.position);
    if (!location) continue;
    const [x, y] = location;
    if (x < bounds.left - padding || x > bounds.right + padding || y < bounds.top - padding || y > bounds.bottom + padding) continue;
    if (document.elementFromPoint(x, y) === state.canvas) found.push(formation.id);
  }
  if (!found.length) return gpmFrontlineSetDraw(state, "select", "No available formations in that box.");
  draft.ids = new Set(add ? [...draft.ids, ...found] : found);
  draft.changed = true;
  const count = draft.ids.size;
  gpmFrontlineSetDraw(state, null, count === 1 ? "1 formation selected." : `${count} formations selected.`);
}

function gpmFinishFrontlineDraw(state, draw, point) {
  if (!draw.start || gpmFrontlineDistance(draw.start, point) <= 1) {
    state.feedback = "Choose an objective beyond this front.";
    return gpmPaintFrontline(state);
  }
  void gpmRouteFrontlineArrow(state, draw, [draw.start, point]);
}

async function gpmTraceFrontline(state, draw, contact) {
  const draft = state.draft;
  draw.validating = true;
  state.feedback = "Tracing the front…";
  gpmPaintFrontline(state);
  const current = () => state.ui._gpmFrontline === state && state.draft === draft && state.drawing === draw;
  try {
    const result = await Je(state.session, "gpm.frontline.line", { warId: state.warId, afterId: draft.afterId, ...contact });
    if (!current()) return;
    if (!result?.ok || !Array.isArray(result.line) || result.line.length < 2) {
      if (result?.reason === "front_changed") await gpmLoadFrontline(state, true);
      if (current()) return gpmFrontlineSetDraw(state, "line", gpmFrontlineError(result?.reason || "front"));
      return;
    }
    draft.line = result.line;
    draft.contact = { id: result.contactId || contact.contactId, scope: result.scope, startIndex: contact.startIndex, endIndex: contact.endIndex };
    draft.arrow = [];
    draft.objectiveProvinceKey = undefined;
    draft.mode = draft.afterId ? "advance" : "hold";
    draft.changed = true;
    draft.needsFront = false;
    const feedback = result.forecast ? "The queued front will update when this order starts."
      : result.scope === "whole" ? "Entire front selected. Save to assign it." : "Front section selected. Save to assign it.";
    gpmFrontlineSetDraw(state, null, feedback);
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
    const [lat, lon] = n2(fromVector.clone().lerp(toVector, step / steps).normalize());
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
    const result = await Je(state.session, "gpm.frontline.route", { warId: state.warId, line: draft.contact ? undefined : draft.line, afterId: draft.afterId,
      validateArrow: arrow, ...gpmFrontlineContactParams(draft.contact) });
    if (!current()) return;
    if (!result?.ok || !Array.isArray(result.arrow) || result.arrow.length < 2) {
      return gpmFrontlineSetDraw(state, "arrow", gpmFrontlineError(result?.reason));
    }
    draft.arrow = result.arrow;
    draft.objectiveProvinceKey = result.objectiveProvinceKey;
    draft.changed = true;
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
      if (action === "upsert" && !params.afterId) state.selectedArmyId = result.id || params.id;
      if (action === "upsert" || action === "army") state.draft = null;
      if (action === "remove" && state.draft?.id === params.id) state.draft = null;
      if (action === "remove" && params.army && state.selectedArmyId === params.id) {
        state.selectedArmyId = null;
        state.selectedSlot = null;
      }
      await gpmLoadFrontline(state, true);
    }
    const reason = result?.reason || result?.reasonId;
    if (!result?.ok && reason === "front_changed" && action === "upsert" && state.draft) {
      Object.assign(state.draft, { line: [], contact: null, arrow: [], objectiveProvinceKey: undefined, needsFront: true, changed: true });
      await gpmLoadFrontline(state, true);
      if (state.ui._gpmFrontline === state) gpmFrontlineSetDraw(state, "line", gpmFrontlineError(reason));
    } else state.feedback = result?.ok ? action === "mode" ? "" : result.message || "Order saved." : result?.message || gpmFrontlineError(reason);
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
    front_changed: "The contact line changed. Choose the front again.",
    formation_overlap: "A selected formation is already assigned to another group.", queue: "This order's formation selection must match its group.",
    arrow: "Draw an arrow ending inside the enemy's territory in this war.", objective: "Choose an eligible objective in this war.",
    arrow_start: "Start the arrow on the group's front.", objective_held: "Your side already controls that objective.",
    water: "No reachable land route to that objective. Choose another point.",
    no_land_route: "No reachable land route to that objective. Choose another point.",
    regional_scope: "This objective is outside the war's allowed territory.", ceasefire: "Orders are paused during the ceasefire.",
    war: "This war is unavailable for new orders.", conflict: "This war is unavailable for new orders." };
  return labels[reason] || "The order was declined. Check the group and its objective.";
}

function gpmDisposeFrontlineMesh(state, mesh) {
  state.globe.scene.remove(mesh);
  mesh.geometry.dispose();
  mesh.material.dispose();
  const lineMaterials = state.globe._lineMats;
  const index = lineMaterials?.indexOf(mesh.material) ?? -1;
  if (index >= 0) lineMaterials.splice(index, 1);
}

function gpmClearFrontlinePaths(state) {
  for (const mesh of state.meshes) gpmDisposeFrontlineMesh(state, mesh);
  state.meshes.length = 0;
  state.objectives = [];
  state.globe._frameGate?.invalidate?.();
}

function gpmFrontlineObjectiveBoundary(geometry, arrow, emphasized) {
  const tip = arrow?.at(-1);
  if (!tip?.every(Number.isFinite)) return null;
  const polygons = geometry?.type === "Polygon" ? [geometry.coordinates] :
    geometry?.type === "MultiPolygon" ? geometry.coordinates : [];
  if (!polygons?.length) return null;

  // Project the actual border arcs into a local plane where great circles are straight.
  const rad = Math.PI / 180;
  const sin = Math.sin(tip[1] * rad), cos = Math.cos(tip[1] * rad);
  const project = point => {
    if (!Number.isFinite(point?.[0]) || !Number.isFinite(point[1])) return null;
    const lon = (point[0] - tip[0]) * rad, lat = point[1] * rad;
    const z = Math.sin(lat), x = Math.cos(lat) * Math.cos(lon);
    const depth = cos * x + sin * z;
    return depth > .01 ? [6371 * Math.cos(lat) * Math.sin(lon) / depth, 6371 * (cos * z - sin * x) / depth] : null;
  };
  const unproject = ([x, y]) => {
    const forward = cos - sin * y / 6371, east = x / 6371;
    const lon = tip[0] + Math.atan2(east, forward) / rad;
    return [(lon + 540) % 360 - 180, Math.atan2(sin + cos * y / 6371, Math.hypot(forward, east)) / rad];
  };
  const previous = arrow.slice(0, -1).map(project).findLast(point => point && Math.hypot(...point) > .01);
  if (!previous) return null;
  const approach = Math.hypot(...previous);
  const heading = previous.map(value => -value / approach);
  const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const interpolate = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
  const inside = ring => ring.reduce((found, a, index) => {
    const b = ring[(index + 1) % ring.length];
    const crosses = (a[1] > 0) !== (b[1] > 0) && a[0] - a[1] * (b[0] - a[0]) / (b[1] - a[1]) > 0;
    return crosses ? !found : found;
  }, false);
  const areas = polygons.flatMap(polygon => {
    if (!Array.isArray(polygon)) return [];
    const rings = polygon.map(ring => Array.isArray(ring) ? ring.map(project) : []);
    const [exterior, ...holes] = rings;
    return exterior?.length >= 3 && exterior.every(Boolean) ? [{ exterior, holes }] : [];
  });
  const enclosing = areas.filter(({ exterior }) => inside(exterior));
  const component = enclosing.find(({ holes }) => !holes.some(ring => ring.length >= 3 && ring.every(Boolean) && inside(ring)));
  if (enclosing.length && !component) return null;

  let ahead, nearby;
  for (const { exterior: ring } of component ? [component] : areas) {
    for (let index = 0; index < ring.length; index++) {
      const a = ring[index], b = ring[(index + 1) % ring.length];
      const edge = [b[0] - a[0], b[1] - a[1]];
      const lengthSq = dot(edge, edge);
      if (lengthSq < 1e-10) continue;
      const divisor = cross(heading, edge);
      if (Math.abs(divisor) > 1e-8) {
        const ray = cross(a, edge) / divisor;
        const along = cross(a, heading) / divisor;
        if (ray >= 0 && (component || ray <= 45) && along >= 0 && along <= 1 && (!ahead || ray < ahead.distance)) {
          ahead = { point: interpolate(a, b, along), index, ring, distance: ray };
        }
      }
      const factor = Math.max(0, Math.min(1, -dot(a, edge) / lengthSq));
      const point = interpolate(a, b, factor);
      const offset = Math.hypot(...point);
      if (offset <= (component ? 125 : 25) && dot(point, heading) >= -Math.min(8, offset * .2) &&
          (!nearby || offset < nearby.distance)) nearby = { point, index, ring, distance: offset };
    }
  }
  const hit = ahead || nearby;
  if (!hit) return null;
  const { ring, index, point } = hit;
  const perimeter = ring.reduce((sum, a, i) => sum + distance(a, ring[(i + 1) % ring.length]), 0);
  const span = emphasized ? Math.min(perimeter * .22, 260) :
    Math.min(perimeter * .16, Math.min(52, 29 + hit.distance * .14));
  if (span <= .01) return null;

  const walk = direction => {
    const path = [];
    let remaining = span, at = point, vertex = direction > 0 ? (index + 1) % ring.length : index;
    for (let visited = 0; remaining > .001 && visited <= ring.length; visited++) {
      const next = ring[vertex];
      const edge = distance(at, next);
      if (edge > remaining) {
        path.push(interpolate(at, next, remaining / edge));
        break;
      }
      if (edge > .001) path.push(next);
      remaining -= edge;
      at = next;
      vertex = (vertex + direction + ring.length) % ring.length;
    }
    return path;
  };
  return { center: unproject(point), sides: [walk(-1).map(unproject), walk(1).map(unproject)] };
}

function gpmAddFrontlineObjective(state, arrow, objective, color, opacity, emphasis) {
  const radius = dt * 1.007;
  const world = ([lon, lat]) => ct(lat, lon, radius);
  const tip = arrow.at(-1);
  const dot = document.createElement("span");
  dot.className = "gpm-frontline-objective-dot" + (emphasis ? "" : " is-muted");
  dot.setAttribute("data-gpm-frontline-objective-dot", objective);
  dot.dataset.lon = tip[0];
  dot.dataset.lat = tip[1];
  dot.hidden = true;
  dot.style.setProperty("--frontline-color", `#${color.toString(16).padStart(6, "0")}`);
  dot.style.opacity = opacity;
  state.labelLayer.append(dot);
  const geometry = state.globe.world?.provByKey?.get(objective)?.geometry;
  const arc = gpmFrontlineObjectiveBoundary(geometry, arrow, emphasis);
  const center = arc && world(arc.center);
  const sides = arc?.sides.map(side => side.map(world));
  const probes = sides?.map(side => side.find(point => point.distanceTo(center) >= radius * .004) || side.at(-1));
  state.objectives.push({ dot, tip: world(tip), center, sides, probes, objective, color, opacity, emphasis, meshes: [] });
}

function gpmFrontlineScreenBoundary(marker, origin, project) {
  const walk = side => {
    const path = [];
    const limit = marker.emphasis ? 26 : 16;
    let length = 0, previous = marker.center, from = origin;
    for (const point of side) {
      const to = project(point);
      if (!to) break;
      const step = Math.hypot(to[0] - from[0], to[1] - from[1]);
      if (step + length > limit) {
        const end = previous.clone().lerp(point, (limit - length) / step).normalize();
        path.push(end);
        length = limit;
        break;
      }
      path.push(point);
      length += step;
      previous = point;
      from = to;
    }
    return { path, length };
  };
  const [left, right] = marker.sides.map(walk);
  return {
    points: [...left.path.reverse(), marker.center, ...right.path].map(point => {
      const [lat, lon] = n2(point);
      return [lon, lat];
    }),
    pixels: left.length + right.length,
  };
}

function gpmTickFrontlineObjectives(state, project) {
  const viewport = window.innerWidth + "x" + window.innerHeight;
  for (const marker of state.objectives || []) {
    const tip = project(marker.tip);
    marker.dot.hidden = !tip || tip[0] < 0 || tip[0] >= window.innerWidth || tip[1] < 0 || tip[1] >= window.innerHeight;
    if (!marker.dot.hidden) Object.assign(marker.dot.style, { left: tip[0].toFixed(1) + "px", top: tip[1].toFixed(1) + "px" });
    if (!marker.center) continue;

    const origin = project(marker.center);
    const scale = origin && Math.max(0, ...marker.probes.map(point => {
      const p = point && project(point);
      return p && Math.hypot(p[0] - origin[0], p[1] - origin[1]) || 0;
    }));
    if (!scale) {
      if (marker.scale != null) {
        for (const mesh of marker.meshes) mesh.visible = false;
        state.globe._frameGate?.invalidate?.();
      }
      marker.scale = null;
      continue;
    }
    // Preserve the arrow and border mesh during panning or imperceptible zoom updates.
    if (marker.viewport === viewport && Math.abs(scale - marker.scale) < marker.scale * .13) continue;
    marker.viewport = viewport;
    marker.scale = scale;
    for (const mesh of marker.meshes) {
      gpmDisposeFrontlineMesh(state, mesh);
      const index = state.meshes.indexOf(mesh);
      if (index >= 0) state.meshes.splice(index, 1);
    }
    const { points, pixels } = gpmFrontlineScreenBoundary(marker, origin, project);
    marker.meshes = pixels >= 5 && points.length >= 2
      ? gpmAddFrontlinePath(state, points, marker.color, false, marker.opacity, marker.emphasis, marker.objective, pixels) || []
      : [];
    state.globe._frameGate?.invalidate?.();
  }
}

function gpmPaintFrontlinePaths(state) {
  const plans = state.data?.plans || [];
  const draft = state.draft;
  const strokes = plans.filter(plan => plan.id !== draft?.id).flatMap((plan, index) => {
    const completed = plan.status === "completed";
    if (completed && plans.some(next => next.afterId === plan.id && next.status !== "queued")) return [];
    const color = gpmFrontlinePalette[plan.color] || gpmFrontlinePalette.cyan;
    const selected = (plan.armyId || plan.id) === state.selectedArmyId;
    const alpha = plan.status === "queued" ? .45 : !state.selectedArmyId || selected ? .96 : .53;
    const line = completed && plan.reason === "no_connected_front" ? [] : plan.liveLine || plan.line;
    return [[line, color, false, alpha, null, selected ? 1 : 0],
      [completed ? [] : plan.arrow, color, true, alpha, plan.name || `Army ${plan.slot || index + 1}`, selected ? 1 : 0,
        !completed && plan.status !== "queued" ? plan.objectiveProvinceKey : null]];
  });
  if (draft) {
    const color = gpmFrontlinePalette[draft.color] || gpmFrontlinePalette.cyan;
    const draw = state.drawing;
    strokes.push([draft.line, color, false, .92, null, 1], [draft.arrow, color, true, .92, draft.name || `Army ${draft.slot}`, 1,
      !draft.afterId && draw?.kind !== "arrow" ? draft.objectiveProvinceKey : null]);
    if (draw?.kind === "line" && draw.preview?.length > 1) strokes.push([draw.preview, 0xffffec, false, .88, null, 2]);
    if (draw?.pointer != null && draw.kind === "arrow" && draw.preview?.length > 1) strokes.push([draw.preview, color, true, .65]);
  }
  const signature = JSON.stringify(strokes);
  if (state.pathSignature === signature) return;
  state.pathSignature = signature;
  gpmClearFrontlinePaths(state);
  state.labelLayer.replaceChildren();
  state.labels = [];
  for (const [path, color, arrow, opacity, name, emphasis, objective] of strokes) {
    if (!path || path.length < 2) continue;
    gpmAddFrontlinePath(state, path, color, arrow, opacity, emphasis);
    if (arrow && name) gpmAddFrontlineLabel(state, path, color, opacity, name);
    if (objective) gpmAddFrontlineObjective(state, path, objective, color, opacity, emphasis);
  }
  gpmTickFrontlineLabels(state.ui);
  state.globe._frameGate?.invalidate?.();
}

function gpmFrontlineHeadSize(angle) {
  return Math.min(.017, angle * .42, Math.max(.0025, angle * .26));
}

function gpmAddFrontlineLabel(state, path, color, opacity, name) {
  const element = document.createElement("span");
  element.className = "gpm-frontline-arrow-label";
  element.setAttribute("data-gpm-frontline-arrow-label", "");
  element.textContent = name;
  element.hidden = true;
  element.style.setProperty("--frontline-color", `#${color.toString(16).padStart(6, "0")}`);
  element.style.opacity = opacity;
  const radius = dt * 1.007;
  const vectors = path.map(([lon, lat]) => ct(lat, lon, 1).normalize());
  const spans = vectors.slice(1).map((b, index) => {
    const a = vectors[index];
    const tipSegment = index === vectors.length - 2;
    const length = a.angleTo(b);
    const start = .035;
    const end = tipSegment && length ? 1 - Math.atan(gpmFrontlineHeadSize(length)) / length - .035 : .965;
    return { start: a.clone().lerp(b, start).normalize().multiplyScalar(radius), end: a.clone().lerp(b, end).normalize().multiplyScalar(radius),
      center: a.clone().lerp(b, (start + end) / 2).normalize().multiplyScalar(radius), length };
  }).sort((a, b) => b.length - a.length).slice(0, 24);
  state.labelLayer.append(element);
  const measure = state.labelMeasure ||= document.createElement("canvas").getContext("2d");
  const font = getComputedStyle(element);
  if (measure) measure.font = `${font.fontWeight} 10px ${font.fontFamily}`;
  state.labels.push({ element, spans, textWidth: measure?.measureText(name).width || 1 });
}

function gpmTickFrontlineLabels(ui) {
  const state = ui._gpmFrontline;
  if (!state || !state.labels?.length && !state.objectives?.length && state.selectedSlot == null && !state.formationMarks.size) return;
  const { camera, sphere } = state.globe;
  const radius = sphere.geometry.parameters.radius;
  camera.updateMatrixWorld();
  gpmTickFrontlineFormationMarks(state);
  const project = world => {
    if (world.dot(camera.position) <= radius * Math.sqrt(world.lengthSq())) return null;
    const point = world.clone().project(camera);
    return point.z >= -1 && point.z <= 1 ? [(point.x * .5 + .5) * window.innerWidth, (.5 - point.y * .5) * window.innerHeight] : null;
  };
  gpmTickFrontlineObjectives(state, project);
  for (const { element, spans, textWidth } of state.labels || []) {
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
      const available = Math.floor(width - 2);
      const size = Math.min(10, Math.max(6.75, (available - 5) / textWidth * 10));
      Object.assign(element.style, { left: `${center[0].toFixed(1)}px`, top: `${center[1].toFixed(1)}px`, maxWidth: `${available}px`,
        fontSize: `${size.toFixed(2)}px`, transform: `translate(-50%, -50%) rotate(${angle.toFixed(4)}rad)` });
    }
  }
}

function gpmTickFrontlineFormationMarks(state) {
  const army = state.data?.plans?.find(plan => plan.id === state.selectedArmyId);
  const ids = state.draft?.ids || new Set(army?.formationIds);
  for (const [id, mark] of state.formationMarks) if (!ids.has(id)) {
    mark.remove();
    state.formationMarks.delete(id);
  }
  if (!ids.size) return;
  const color = gpmFrontlineColor(state.draft?.color || army?.color);
  for (const formation of state.data?.formations || []) {
    if (!ids.has(formation.id)) continue;
    let mark = state.formationMarks.get(formation.id);
    if (!mark) {
      mark = document.createElement("span");
      mark.className = "gpm-frontline-formation-mark";
      mark.setAttribute("data-gpm-frontline-selected-unit", formation.id);
      state.selectionLayer.append(mark);
      state.formationMarks.set(formation.id, mark);
    }
    const position = formation.position && gpmFrontlineScreenPoint(state.globe, formation.position);
    mark.hidden = !position || position[0] < 0 || position[0] >= window.innerWidth || position[1] < 0 || position[1] >= window.innerHeight;
    if (mark.hidden) continue;
    mark.style.setProperty("--frontline-color", color);
    mark.style.left = `${Math.round(position[0])}px`;
    mark.style.top = `${Math.round(position[1])}px`;
  }
}

function gpmAddFrontlinePath(state, path, color, arrow, opacity, emphasis = 0, objective = null, pixels = 0) {
  const segments = [];
  const radius = dt * (arrow || objective ? 1.007 : 1.0012);
  const add = (a, b) => segments.push(a.x, a.y, a.z, b.x, b.y, b.z);
  const points = path.map(([lon, lat]) => ct(lat, lon, 1).normalize());
  let length = 0;
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1];
    const b = points[index];
    const angle = a.angleTo(b);
    const steps = Math.max(2, Math.ceil(angle * 100));
    length += angle * radius;
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
    const size = gpmFrontlineHeadSize(tip.angleTo(previous));
    for (const sign of [-1, 1]) {
      const corner = tip.clone().addScaledVector(back, size).addScaledVector(side, sign * size * .28).normalize().multiplyScalar(radius);
      add(tip.clone().multiplyScalar(radius), corner);
    }
  }
  const addMesh = (ink, linewidth, alpha, order, name) => {
    const geometry = new ys();
    geometry.setPositions(segments);
    const style = { color: ink, linewidth, transparent: true, opacity: alpha, depthTest: true, depthWrite: false };
    if (objective) {
      const dashes = Math.max(2, Math.min(5, Math.round(pixels / 10.5)));
      Object.assign(style, { dashed: true, dashSize: length * .64 / dashes, gapSize: length * .36 / dashes });
    }
    const material = new Uc(style);
    material.resolution.set(window.innerWidth, window.innerHeight);
    (state.globe._lineMats ||= []).push(material);
    const mesh = new fd(geometry, material);
    mesh.renderOrder = order + emphasis;
    mesh.frustumCulled = false;
    if (objective) {
      mesh.name = name;
      mesh.userData.objectiveProvinceKey = objective;
      mesh.computeLineDistances();
    }
    state.globe.scene.add(mesh);
    state.meshes.push(mesh);
    return mesh;
  };
  if (objective) {
    if (length < 1e-7) return;
    const core = pixels < 17 ? 1.7 : emphasis ? 2.4 : 2;
    return [
      addMesh(0x111923, core + 1.6, opacity * .92, 26, "gpm-frontline-objective-boundary-casing"),
      addMesh(color, core, opacity, 27, "gpm-frontline-objective-boundary"),
    ];
  } else addMesh(color, arrow ? 1.9 : emphasis ? 5.4 : 4.5, opacity, 28);
}

function patchFrontlineRenderer(source, replaceOnce) {
  const functions = [gpmFrontlineMountStyle, gpmBuildFrontline, gpmRefreshFrontlineEntry, gpmOpenFrontline, gpmMountFrontline, gpmCloseFrontline,
    gpmRefreshFrontlineMap, gpmLoadFrontline, gpmFrontlineStatus, gpmFrontlineColor, gpmFrontlineObjective, gpmKeepFrontlineDraft,
    gpmMountFrontlineRoster, gpmFrontlineArmySlots, gpmFrontlinePortrait, gpmPaintFrontlineRoster, gpmSelectFrontlineArmy, gpmFrontlineFormationState,
    gpmPaintFrontline, gpmEditFrontlineDraft, gpmFrontlineClick, gpmFrontlineSetDraw, gpmFrontlineDistance, gpmFrontlineMidpoint,
    gpmFrontlineContactParams, gpmFrontlineScreenPoint, gpmPickFrontlineContact, gpmFrontlineContactSection, gpmBindFrontlineDraw, gpmFinishFrontlineDraw,
    gpmFrontlineSelectionRect, gpmSelectFrontlineFormations, gpmTraceFrontline, gpmClipFrontlinePreview, gpmRouteFrontlineArrow,
    gpmSendFrontline, gpmFrontlineError, gpmDisposeFrontlineMesh, gpmClearFrontlinePaths, gpmFrontlineObjectiveBoundary,
    gpmAddFrontlineObjective, gpmFrontlineScreenBoundary, gpmTickFrontlineObjectives, gpmPaintFrontlinePaths, gpmFrontlineHeadSize,
    gpmAddFrontlineLabel, gpmTickFrontlineLabels, gpmTickFrontlineFormationMarks, gpmAddFrontlinePath];
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
  return js;
}

module.exports = { patchFrontlineRenderer };

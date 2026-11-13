"use strict";

const style = `
  .gpm-history { display: grid; gap: var(--gap-3); min-width: 0; }
  .gpm-history :is(p, ul, dl) { margin: 0; }
  .gpm-history h3, .gpm-history h4 { margin-block: 0 var(--gap-1); }
  .gpm-history-tools, .gpm-history-actions { display: flex; flex-wrap: wrap; align-items: end; gap: var(--gap-2); }
  .gpm-history-tools label { display: grid; gap: var(--gap-1); }
  .gpm-history-tools label:first-child { flex: 1 1 14rem; }
  .gpm-history-tools :is(input, select) { width: 100%; min-width: 0; }
  .gpm-history-layout { display: grid; grid-template-columns: minmax(10rem, .8fr) minmax(0, 1.6fr); gap: var(--gap-3); }
  .gpm-history-list { display: grid; align-content: start; gap: var(--gap-1); max-height: 34rem; overflow: auto; }
  .gpm-history-list button, .gpm-history-region-list button { display: grid; gap: var(--gap-1); text-align: left; white-space: normal; }
  .gpm-history-list button[aria-pressed=true], .gpm-history-region-list button[aria-pressed=true] { border-color: var(--mark-late, #edc583); }
  .gpm-history-detail, .gpm-history-side, .gpm-history-actor, .gpm-history-region-list { display: grid; align-content: start; gap: var(--gap-2); min-width: 0; }
  .gpm-history-sides { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr)); gap: var(--gap-2); }
  .gpm-history-side, .gpm-history-region { padding: var(--gap-2); }
  .gpm-history-actor + .gpm-history-actor { border-top: 1px solid var(--line, #545861); padding-top: var(--gap-2); }
  .gpm-history-actor li, .gpm-history-sources li { margin-top: var(--gap-1); }
  .gpm-history-sources { overflow-wrap: anywhere; user-select: text; }
  .gpm-history-sources button { margin-inline-start: var(--gap-1); }
  .gpm-history-map { display: grid; gap: var(--gap-1); }
  .gpm-history-map svg { display: block; width: 100%; max-height: 16rem; background: var(--bg, #12191f); }
  .gpm-history-map path { stroke: #141b21; stroke-width: 1px; vector-effect: non-scaling-stroke; cursor: pointer; }
  .gpm-history-map path[data-selected] { stroke: #fff2bd; stroke-width: 2px; }
  .gpm-history-map-key { display: flex; flex-wrap: wrap; gap: var(--gap-2); }
  .gpm-history-map-key i { display: inline-block; width: .8em; height: .8em; margin-inline-end: .3em; border: 1px solid currentColor; }
  .gpm-history-region-list { grid-template-columns: repeat(auto-fit, minmax(min(100%, 10rem), 1fr)); max-height: 12rem; overflow: auto; }
  .gpm-history-region dl { display: grid; grid-template-columns: max-content 1fr; gap: var(--gap-1) var(--gap-2); }
  .gpm-history-region dd { margin: 0; }
  @media (max-width: 1200px) { .gpm-history-layout { grid-template-columns: minmax(0, 1fr); } .gpm-history-list { max-height: 16rem; } }
`;

function gpmHistoricalLabel(value) {
  const labels = {
    active: "Active", ended: "Ended", suspended: "Suspended", ceasefire: "Ceasefire", settled: "Settled",
    frozen: "Frozen", contested: "Contested", occupation: "Occupation", dormant: "Dormant armed conflict", uncertain: "Uncertain", civil_war: "Civil war", civil: "Civil war",
    interstate: "Interstate war", nonstate: "Conflict between non-state groups", insurgency: "Insurgency", coalition: "Coalition",
    strategic: "Strategic", operational: "War Theatre", regional: "Regional simulation", native: "Native war", stock: "Base-game war",
    "aid-access": "Humanitarian access agreement", autonomy: "Regional autonomy agreement",
    transition: "Transitional government agreement", "native-settlement": "War settlement",
    "political-agreement": "Political agreement", "decisive-victory": "Decisive victory", "government-transition": "Government transition", postwar: "Postwar policy",
    historical_term_unavailable: "That proposal is no longer available",
  };
  return Object.hasOwn(labels, value) ? labels[value] : String(value || "Unknown")
    .replaceAll(/[-_]+/g, " ").replace(/^./, letter => letter.toUpperCase());
}

function gpmHistoricalSource(source) {
  const entry = typeof source === "string" ? { url: source } : source || {};
  let url = null;
  try {
    const parsed = new URL(entry.url);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") url = parsed.href;
  } catch {}
  const label = [entry.title || entry.label || entry.name || entry.publisher, entry.date || entry.asOf].filter(Boolean).join(" · ");
  if (!url && !label) return "";
  return `<li>${label ? `<b>${b(label)}</b>${url ? "<br>" : ""}` : ""}${url ? `<span>${b(url)}</span><button type="button" class="k" data-authority-safe data-history-source="${b(url)}" aria-label="Copy source URL">Copy URL</button>` : ""}</li>`;
}

function gpmHistoricalSourceList(sources) {
  return (Array.isArray(sources) ? sources : sources ? [sources] : []).map(gpmHistoricalSource).join("");
}

function gpmHistoricalActor(actor, outcome) {
  const ideology = actor.ppoIdeology;
  const related = ideology?.relatedAdministration;
  const fit = { close: "Close fit", partial: "Partial fit", none: "No party preset", unknown: "Insufficient evidence" };
  const strength = actor.strength;
  const estimates = strength ? gpmHistoricalSourceList(strength.sources) : "";
  const strengthKinds = {
    regulars: "Regulars", reserves: "Reserves", allies: "Allied personnel",
    "cumulative-recruits": "Cumulative recruits", "authorized-positions": "Authorized positions",
  };
  const components = (strength?.components || []).map(item =>
    `<li><b>${b(strengthKinds[item.kind])}</b> · ${b(item.estimate)} · ${b(item.asOf)}<ul class="gpm-history-sources">${gpmHistoricalSourceList(item.source)}</ul></li>`).join("");
  const simulation = strength ? [
    Number.isFinite(strength.gamePersonnel) ? `${strength.gamePersonnel.toLocaleString(cs())} scenario personnel` : null,
    Number.isFinite(strength.readiness) ? `${new Intl.NumberFormat(cs(), { style: "percent", maximumFractionDigits: 0 }).format(strength.readiness)} scenario readiness` : null,
  ].filter(Boolean).join(" · ") : "";
  const native = actor.nativeForces;
  const nativeForces = native && [
    native.active == null ? null : `${native.active.toLocaleString(cs())} active`,
    native.reserve == null ? null : `${native.reserve.toLocaleString(cs())} reserve`,
  ].filter(Boolean).join(" · ");
  const laws = (actor.laws || []).map(law => {
    const sources = gpmHistoricalSourceList(law.source);
    return `<li><b>${b(law.name)}</b>${law.status ? ` · ${b(gpmHistoricalLabel(law.status))}` : ""}${law.note ? `<br>${b(law.note)}` : ""}${sources ? `<ul class="gpm-history-sources">${sources}</ul>` : ""}</li>`;
  }).join("");
  return `<article class="gpm-history-actor">
    <div><b>${b(actor.name || actor.id)}</b>${actor.shortName && actor.shortName !== actor.name ? ` <small>(${b(actor.shortName)})</small>` : ""}
      ${actor.kind || actor.role ? `<br><small>${b([actor.kind, actor.role].filter(Boolean).map(gpmHistoricalLabel).join(" · "))}</small>` : ""}</div>
    ${actor.armedWingName ? `<p><b>Armed wing</b> · ${b(actor.armedWingName)}</p>` : ""}
    ${ideology?.historicalLabel ? `<p><b>Historical ideology</b> · ${b(ideology.historicalLabel)}</p>` : ""}
    ${actor.ideology ? `<div><b>Ideology or political program</b><p>${b(actor.ideology)}</p><ul class="gpm-history-sources">${gpmHistoricalSourceList(actor.ideologySources)}</ul></div>` : ""}
    ${ideology ? `<div><b>PPO ideological equivalent</b><p>${b(ideology.label || fit[ideology.fit])}${ideology.label ? ` · ${b(fit[ideology.fit])}` : ""}${ideology.territorial ? ` · ${b(gpmHistoricalLabel(ideology.territorial))}` : ""}</p><small>${b(ideology.note)}</small><ul class="gpm-history-sources">${gpmHistoricalSourceList(ideology.sources)}</ul></div>` : ""}
    ${related ? `<div><b>Related civil administration</b><p>${b(related.name)} · ${b(related.historicalLabel)}</p>${related.label ? `<p>PPO equivalent · ${b(related.label)} · ${b(fit[related.fit])}</p>` : ""}<small>${b(related.note)}</small><ul class="gpm-history-sources">${gpmHistoricalSourceList(related.sources)}</ul></div>` : ""}
    ${outcome ? `<div><b>Result on this front</b><p>${b(outcome.title)}</p><small>${b(outcome.note)}</small></div>` : ""}
    ${actor.governingProgram ? `<div><b>Governing program</b><p>${b(actor.governingProgram)}</p><ul class="gpm-history-sources">${gpmHistoricalSourceList(actor.governingProgramSources)}</ul></div>` : ""}
    ${actor.victoryName && (!outcome || ["national", "autonomy", "independence", "native", "local"].includes(outcome.scope)) ? `<div><b>Formal name if victorious</b><p>${b(actor.victoryName)}${actor.victoryAdministration ? ` · ${b(actor.victoryAdministration)}` : ""}</p>${actor.victoryGovernment ? `<p>${b(actor.victoryGovernment)}</p>` : ""}<small>${b(actor.victoryKind)}</small><ul class="gpm-history-sources">${gpmHistoricalSourceList(actor.victorySources)}</ul></div>` : ""}
    ${actor.objectives?.length ? `<div><b>Objectives</b><ul>${actor.objectives.map(objective => `<li>${b(objective)}</li>`).join("")}</ul></div>` : ""}
    ${strength ? `<div><b>Strength estimate</b><br>${b(strength.range || "Uncertain")}
      ${strength.asOf ? `<small> · ${b(strength.asOf)}</small>` : ""}${strength.confidence ? `<small> · ${b(gpmHistoricalLabel(strength.confidence))} confidence</small>` : ""}
      ${strength.note ? `<p>${b(strength.note)}</p>` : ""}${estimates ? `<ul class="gpm-history-sources">${estimates}</ul>` : ""}
      ${components ? `<ul>${components}</ul>` : ""}
      ${simulation ? `<p><b>Starting simulation values</b> · ${b(simulation)}</p>` : ""}</div>` : `<p>No corroborated force estimate in this catalog.</p>`}
    ${nativeForces ? `<p><b>National armed forces in the game</b> · ${b(nativeForces)}</p>` : ""}
    ${laws ? `<details><summary>Governing laws and policies</summary><ul>${laws}</ul></details>` : ""}
    ${actor.nativeGovernment ? `<p>See the Laws screen for national laws.</p>` : ""}
  </article>`;
}

function gpmHistoricalRegions(conflict, actors, state, ui) {
  if (!conflict.regions?.length) return "";
  const selected = conflict.regions.find(region => region.key === state.regionKey) || conflict.regions[0];
  const name = region => Ut(region.key, region.name);
  const authority = id => actors.get(id)?.shortName || actors.get(id)?.name || U(id);
  const category = region => {
    if (region.currentContested ?? region.contested) return "contested";
    const controller = region.currentController ?? region.controller;
    if (!controller) return "unmapped";
    const side = conflict.sides?.findIndex(members => members.includes(controller));
    return side === 0 ? "first" : side === 1 ? "second" : "other";
  };
  const colors = { contested: "#af7643", first: "#416b86", second: "#7d64a3", other: "#56826d", unmapped: "#525b66" };
  const world = ui.globe?.world;
  const byKey = new Map(conflict.regions.map(region => [region.key, region]));
  const signature = JSON.stringify([...byKey.keys()]);
  if (state.geometry?.world !== world || state.geometry?.signature !== signature) {
    const features = world?.provinces?.filter(feature => feature.geometry && byKey.has(feature.__provKey)) || [];
    state.geometry = { world, signature, layout: features.length ? ok(features, 620, 420, { pad: 12, maxInsets: 8 }) : null,
      keys: new Map(features.map(feature => [feature.__provId, feature.__provKey])) };
  }
  const { layout, keys } = state.geometry;
  const paths = (items, width, height) => `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Regional control and contestation">
    ${items.map(item => {
      const region = byKey.get(keys.get(item.provId));
      return region ? `<path d="${b(item.d)}" fill="${colors[category(region)]}" data-history-region="${b(region.key)}" ${region === selected ? "data-selected" : ""}>
        <title>${b(name(region))} · ${b(region.contested ? "Contested" : region.controller ? authority(region.controller) : "Control unspecified")}</title></path>` : "";
    }).join("")}</svg>`;
  const labels = {
    contested: "Contested", first: authority(conflict.sides?.[0]?.[0]), second: authority(conflict.sides?.[1]?.[0]),
    other: "Other actor", unmapped: "Control unspecified",
  };
  const categories = new Set(conflict.regions.map(category));
  return `<section class="gpm-history-detail" aria-label="Regional control">
    <h4>Regional control</h4>
    ${layout ? `<div class="gpm-history-map">${paths(layout.paths, layout.W, layout.H)}${layout.insets.map(inset => paths(inset.paths, layout.box, layout.box)).join("")}
      <div class="gpm-history-map-key">${[...categories].map(key =>
        `<small><i aria-hidden="true" style="background:${colors[key]}"></i>${b(labels[key])}</small>`).join("")}</div></div>` : ""}
    <div class="gpm-history-region-list" data-keep-scroll="historical-regions">
      ${conflict.regions.map(region => `<button type="button" class="k" data-authority-safe data-history-region="${b(region.key)}" data-focus-key="history-region-${b(region.key)}" aria-pressed="${region === selected}">
        <b>${b(name(region))}</b><small>${b(region.contested ? "Contested" : region.controller ? authority(region.controller) : "Control unspecified")}</small></button>`).join("")}</div>
    <div class="sh-inset gpm-history-region"><b>${b(name(selected))}</b>
      <dl><dt>Opening controller</dt><dd>${b(selected.controller ? authority(selected.controller) : "Unspecified")}</dd>
      ${Object.hasOwn(selected, "currentController") && selected.currentController !== selected.controller ? `<dt>Current controller</dt><dd>${b(selected.currentController ? authority(selected.currentController) : "Unspecified")}</dd>` : ""}
      ${selected.administrator ? `<dt>Administrator</dt><dd>${b(authority(selected.administrator))}</dd>` : ""}
      ${selected.legalOwner ? `<dt>Legal owner</dt><dd>${b(U(selected.legalOwner))}</dd>` : ""}
      ${selected.occupationKey ? `<dt>Current occupation</dt><dd>${b(U(selected.occupationKey))}</dd>` : ""}
      ${Number.isFinite(selected.disruption) ? `<dt>Disruption</dt><dd>${b(selected.disruption)} / 100</dd>` : ""}
      ${(selected.currentContested ?? selected.contested) ? "<dt>Control</dt><dd>Contested</dd>" : ""}</dl>
      ${selected.localOutcomes?.length ? `<div><b>Local administrations</b><ul>${selected.localOutcomes.map(local => `<li>${b(local.administration || local.title)}</li>`).join("")}</ul></div>` : ""}
      ${selected.note ? `<p>${b(selected.note)}</p>` : ""}</div>
  </section>`;
}

function gpmHistoricalDetail(conflict, state, ui) {
  if (!conflict) return `<p>${state.pending ? "Loading conflict details…" : "Select a conflict to view its participants and regions."}</p>`;
  const actors = new Map((conflict.actors || []).map(actor => [actor.id, actor]));
  const sides = (conflict.sides || []).map((side, index) => {
    const entries = side.map(id => actors.get(id) || { id, name: U(id) });
    return `<section class="sh-inset gpm-history-side" aria-label="${b(entries[0]?.shortName || entries[0]?.name || `Side ${index + 1}`)}">${entries.map(actor => gpmHistoricalActor(actor, conflict.factionOutcomes?.[actor.id])).join("")}</section>`;
  });
  const combatants = new Set((conflict.sides || []).flat());
  const others = [...actors.values()].filter(actor => !combatants.has(actor.id));
  const sources = gpmHistoricalSourceList(conflict.sources);
  const pendingTerm = (conflict.options || []).find(option => option.id === state.term);
  const action = (id, label, extra = "") => `<button type="button" class="k" data-history-action="${id}" data-focus-key="history-${id}" ${extra}>${label}</button>`;
  const history = (conflict.history || []).toReversed().map(entry => `<li>${b(ui.gameDate(entry.day))} · ${b(gpmHistoricalLabel(entry.term))} · ${b(gpmHistoricalLabel(entry.outcome))}</li>`).join("");
  const proposals = conflict.canNegotiate && conflict.options?.length ? (pendingTerm ? `<p>Submit ${b(pendingTerm.label)}?</p><div class="gpm-history-actions">
    ${action("confirm", "Submit proposal", `data-authority-command ${state.busy ? "disabled" : ""}`)}
    ${action("cancel", "Cancel", `data-authority-safe data-history-cancel-term="${b(pendingTerm.id)}"`)}</div>`
    : `<div class="gpm-history-actions">${conflict.options.map(option => `<button type="button" class="k" data-authority-command data-history-term="${b(option.id)}" data-focus-key="history-term-${b(option.id)}">${b(option.label)}</button>`).join("")}</div>`) : "";
  const outcome = conflict.victoryOutcome;
  const winner = outcome && actors.get(outcome.actorId);
  const postwar = outcome ? `<section class="gpm-history-detail" aria-label="Postwar outcome"><h4>Postwar outcome</h4>
    ${winner ? `<p>${outcome.negotiated ? "Agreement" : "Winner"} · ${b(winner.name)}</p>` : ""}
    ${outcome.title ? `<p><b>${b(outcome.title)}</b>${outcome.administration ? ` · ${b(outcome.administration)}` : ""}</p>` : ""}
    ${!outcome.negotiated && outcome.coWinners?.length ? `<p>Other winners · ${b(outcome.coWinners.map(id => actors.get(id)?.name || id).join(", "))}</p>` : ""}
    ${outcome.note ? `<p>${b(outcome.note)}</p>` : ""}
    ${outcome.government ? `<p>${b(outcome.government)}</p>` : ""}
    ${outcome.sources?.length ? `<ul class="gpm-history-sources">${gpmHistoricalSourceList(outcome.sources)}</ul>` : ""}
    ${outcome.polityKey ? `<p>${b(outcome.scope === "autonomy" ? "Self-governing territory" : "New sovereign polity")}</p>` : ""}
    ${outcome.scope === "local" || outcome.scope === "autonomy" && outcome.native === false ? "<p>Local authority recorded within the stock region.</p>" : ""}
    ${outcome.regionalLaws?.length ? `<ul>${outcome.regionalLaws.map(law => `<li><b>${b(law.name)}</b><br>${b(law.note)}<ul class="gpm-history-sources">${gpmHistoricalSourceList(law.source)}</ul></li>`).join("")}</ul>` : ""}</section>` : "";
  const negotiations = proposals || conflict.pending || history || conflict.settlement ? `<section class="gpm-history-detail" aria-label="Negotiations">
    <h4>Negotiations</h4>
    ${conflict.pending ? `<p>${b(conflict.pending.label)} proposed by ${b(U(conflict.pending.offeredBy))}. Review due ${b(ui.gameDate(conflict.pending.reviewDay))}.</p>` : ""}
    ${conflict.settlement ? `<p>Settlement · ${b(gpmHistoricalLabel(conflict.settlement))}</p>` : ""}
    ${proposals}${history ? `<ul>${history}</ul>` : ""}
  </section>` : "";
  return `<article class="gpm-history-detail" aria-label="${b(conflict.name)}">
    <header><h3>${b(conflict.name)}</h3><small>${b([conflict.status, conflict.kind, conflict.mode].filter(Boolean).map(gpmHistoricalLabel).join(" · "))}</small></header>
    ${conflict.note ? `<p>${b(conflict.note)}</p>` : ""}
    ${conflict.geographicContext?.length ? `<div><h4>Areas affected</h4><ul>${conflict.geographicContext.map(area => `<li>${b(area)}</li>`).join("")}</ul></div>` : ""}
    ${conflict.asOf || conflict.confidence ? `<small>${b([conflict.asOf && `Snapshot ${conflict.asOf}`, conflict.confidence && `${gpmHistoricalLabel(conflict.confidence)} confidence`].filter(Boolean).join(" · "))}</small>` : ""}
    ${Number.isInteger(conflict.durationDays) && conflict.durationDays >= 0 ? `<small>War duration ${b(conflict.durationDays.toLocaleString(cs()))} days</small>` : ""}
    ${Number.isFinite(conflict.pressure) || Number.isFinite(conflict.disruption) ? `<small>${b([
      Number.isFinite(conflict.pressure) ? `Conflict pressure ${conflict.pressure} / 100` : null,
      Number.isFinite(conflict.disruption) ? `Regional disruption ${conflict.disruption} / 100` : null,
    ].filter(Boolean).join(" · "))}</small>` : ""}
    ${Number.isInteger(conflict.ceasefireUntil) && conflict.ceasefireUntil > state.data.day ? `<small>Ceasefire until ${b(ui.gameDate(conflict.ceasefireUntil))}</small>` : ""}
    ${Number.isInteger(conflict.aidUntil) && conflict.aidUntil > state.data.day ? `<small>Humanitarian access until ${b(ui.gameDate(conflict.aidUntil))}</small>` : ""}
    ${conflict.theatreKey ? `<div class="gpm-history-actions">${action("theatre", "Open War Theatre", "data-authority-safe")}</div>` : ""}
    ${sides.length ? `<div class="gpm-history-sides">${sides.join("")}</div>` : ""}
    ${others.length ? `<section class="gpm-history-side sh-inset" aria-label="Other actors"><h4>Other actors</h4>${others.map(actor => gpmHistoricalActor(actor)).join("")}</section>` : ""}
    ${conflict.advantage && conflict.status === "active" ? `<p>Advantage · ${b(actors.get(conflict.sides[conflict.advantage > 0 ? 1 : 0][0])?.name || "")} · ${b(Math.abs(conflict.advantage))} / 100</p>` : ""}
    ${conflict.transitionReview ? "<p>The former national government has been replaced. The new administration is reviewing this truce.</p>" : ""}
    ${conflict.victoryBlocked ? `<p>${b(conflict.victoryBlocked)}</p>` : ""}
    ${gpmHistoricalRegions(conflict, actors, state, ui)}
    ${postwar}
    ${negotiations}
    ${sources ? `<details data-history-sources><summary>Sources</summary><ul class="gpm-history-sources">${sources}</ul></details>` : ""}
  </article>`;
}

function gpmHistoricalConflictsView(host, ui, session) {
  if (!host || !session) return;
  let state = ui._gpmHistory;
  if (!state || state.session !== session) state = ui._gpmHistory = { session, query: "", status: "", request: 0 };
  if (state.host === host && state.playerKey === session.playerKey) {
    if (!state.pending && !state.busy && state.data?.day !== session.day && performance.now() - state.lastRequest > 1500) void state.load();
    return;
  }
  if (state.playerKey !== session.playerKey) {
    state.data = null;
    state.term = null;
    state.status = "";
  }
  state.host = host;
  state.playerKey = session.playerKey;
  const feedback = host.querySelector("[data-history-feedback]");
  const filter = host.querySelector("[data-history-filter]");
  const search = host.querySelector("[data-history-search]");
  const list = host.querySelector("[data-history-list]");
  const detail = host.querySelector("[data-history-detail]");
  const current = () => ui.sim === session && ui._gpmHistory === state && state.host === host && host.isConnected;
  const active = () => host.contains(document.activeElement) ? document.activeElement?.dataset.focusKey : null;
  const restoreFocus = key => key && host.querySelector(`[data-focus-key="${CSS.escape(key)}"]`)?.focus({ preventScroll: true });
  const setHtml = (element, html) => {
    if (element._historyHtml === html) return;
    const key = active();
    const scroll = element.scrollTop;
    const sourceOpen = element.querySelector("[data-history-sources]")?.open;
    element.innerHTML = html;
    element._historyHtml = html;
    element.scrollTop = scroll;
    const sources = element.querySelector("[data-history-sources]");
    if (sources && sourceOpen) sources.open = true;
    restoreFocus(key);
  };
  const paint = () => {
    if (state.host !== host || ui._gpmHistory !== state) return;
    const data = state.data;
    const all = data?.conflicts || [];
    const statuses = [...new Set(all.map(conflict => conflict.status).filter(Boolean))].sort();
    if (state.filter && !statuses.includes(state.filter)) state.filter = "";
    setHtml(filter, `<option value="">All statuses</option>${statuses.map(status => `<option value="${b(status)}"${state.filter === status ? " selected" : ""}>${b(gpmHistoricalLabel(status))}</option>`).join("")}`);
    const query = kt(state.query.trim());
    const rows = all.filter(conflict => (!state.filter || conflict.status === state.filter) && (!query || kt([
      conflict.name, gpmHistoricalLabel(conflict.kind), ...(conflict.countryKeys || []).map(key => U(key)),
    ].join(" ")).includes(query)));
    const text = data?.asOf ? `${rows.length} of ${all.length} conflicts · ${data.asOf} scenario` : "";
    host.querySelector("[data-history-count]").textContent = text;
    setHtml(list, rows.length ? rows.map(conflict => `<button type="button" class="k" data-authority-safe data-history-select="${b(conflict.id)}" data-focus-key="history-select-${b(conflict.id)}" aria-pressed="${state.selectedId === conflict.id}">
      <b>${b(conflict.name)}</b><small>${b([conflict.status, conflict.kind].filter(Boolean).map(gpmHistoricalLabel).join(" · "))}</small></button>`).join("")
      : `<p>${data ? all.length ? "No conflicts match the filters." : "This campaign has no historical conflict snapshot." : state.pending ? "Loading conflicts…" : "Conflict data is unavailable."}</p>`);
    const selected = data?.selected;
    setHtml(detail, gpmHistoricalDetail(selected?.id && selected.id === state.selectedId ? selected : null, state, ui));
    feedback.textContent = state.status;
    host.setAttribute("aria-busy", String(!!state.pending || !!state.busy));
  };
  state.load = async (id = state.selectedId, force = false) => {
    if (!current() || state.busy || (state.pending && !force)) return;
    const request = ++state.request;
    state.pending = true;
    state.lastRequest = performance.now();
    paint();
    try {
      const result = await at(session, "gpm.historicalConflicts", id ? { id } : {});
      if (!current() || state.request !== request) return;
      if (!Array.isArray(result?.conflicts)) throw new Error("Unexpected conflict data");
      state.data = result;
      if (!state.selectedId && result.selected?.id) state.selectedId = result.selected.id;
      if (state.status === "Could not load the historical conflicts. Try Refresh.") state.status = "";
    } catch (error) {
      console.warn("[PPO] Historical Conflicts could not load", error);
      if (current() && state.request === request) state.status = "Could not load the historical conflicts. Try Refresh.";
    } finally {
      if (state.request === request) {
        state.pending = false;
        if (current()) paint();
      }
    }
  };
  search.value = state.query;
  search.oninput = () => { state.query = search.value; paint(); };
  filter.onchange = () => { state.filter = filter.value; paint(); };
  host.onclick = async event => {
    if (!current()) return;
    const control = event.target.closest("[data-history-select], [data-history-region], [data-history-action], [data-history-source], [data-history-term]");
    if (!control || control.disabled) return;
    const { historySelect, historyRegion, historyAction, historySource, historyTerm } = control.dataset;
    if (historySource) {
      state.status = await y0(historySource) ? "Source URL copied." : "Clipboard access is unavailable. Select the URL to copy it.";
    } else if (state.busy) return;
    else if (historySelect) {
      state.selectedId = historySelect;
      state.regionKey = null;
      state.term = null;
      state.status = "";
      void state.load(historySelect, true);
    } else if (historyRegion) state.regionKey = historyRegion;
    else if (historyTerm) state.term = historyTerm;
    else if (historyAction === "cancel") state.term = null;
    else if (historyAction === "refresh") {
      state.status = "";
      void state.load(state.selectedId, true);
    } else if (historyAction === "theatre") {
      const key = state.data?.selected?.theatreKey;
      if (key) ui.openWarTarget(key);
      return;
    } else if (historyAction === "confirm") {
      const conflict = state.data?.selected;
      const term = conflict?.options?.find(option => option.id === state.term);
      if (!conflict?.canNegotiate || !term || state.selectedId !== conflict.id || state.pending) return;
      state.busy = true;
      state.status = ["concede-victory", "claim-victory"].includes(term.id) ? "Implementing settlement…" : "Submitting proposal…";
      paint();
      try {
        const result = await Te(session, "applyPlayerAction", [{ verb: "gpm.historicalConflicts.negotiate", id: conflict.id, term: term.id }]);
        if (result?.ok) state.status = result.message || "Proposal recorded.";
        else state.status = result?.message || `Proposal unavailable${result?.reason ? ` · ${gpmHistoricalLabel(result.reason)}` : ""}.`;
      } catch (error) {
        console.warn("[PPO] Historical Conflicts negotiation could not be verified", error);
        state.status = "Could not verify the proposal. Refresh to check its status.";
      } finally {
        state.busy = false;
        state.term = null;
        if (current()) await state.load(state.selectedId, true);
      }
    }
    if (current()) paint();
    if (historyTerm) restoreFocus("history-confirm");
    if (historyAction === "cancel") restoreFocus("history-term-" + control.dataset.historyCancelTerm);
  };
  paint();
  // The native module may build detached content before attaching it to the panel.
  queueMicrotask(() => { if (current()) void state.load(state.selectedId, true); });
}

function gpmBuildHistoricalConflicts(container, ui, session) {
  container.innerHTML = `<section class="mcard wide gpm-history" data-gpm-history aria-label="Historical Conflicts">
    <header><h3 class="mc-title">Historical Conflicts</h3><small data-history-count></small></header>
    <div class="gpm-history-tools">
      <label>Search conflicts <input type="search" class="k" data-history-search data-focus-key="history-search"></label>
      <label>Status <select class="k" data-authority-safe data-history-filter data-focus-key="history-filter"></select></label>
      <button type="button" class="k" data-authority-safe data-history-action="refresh" data-focus-key="history-refresh">Refresh</button>
    </div>
    <small role="status" data-history-feedback></small>
    <div class="gpm-history-layout"><div class="gpm-history-list" role="group" aria-label="Conflicts" data-history-list data-keep-scroll="historical-conflicts"></div><div data-history-detail></div></div>
  </section>`;
  gpmHistoricalConflictsView(container.querySelector("[data-gpm-history]"), ui, session);
}

function patchHistoricalConflictsRenderer(source, replaceOnce) {
  const rendererFunctions = [gpmHistoricalLabel, gpmHistoricalSource, gpmHistoricalSourceList, gpmHistoricalActor,
    gpmHistoricalRegions, gpmHistoricalDetail, gpmHistoricalConflictsView, gpmBuildHistoricalConflicts];
  const initialize = "\nmountPartyButtons();\n";
  let js = replaceOnce(source, initialize, "\nconst gpmHistoricalConflictsStyle = " + JSON.stringify(style) + ";\n"
    + rendererFunctions.join("\n") + initialize);
  const mountStyle = "style.textContent += gpmRegionalMapStyle + gpmForeignFundingStyle + gpmLawShortlistStyle + gpmUprisingStyle;";
  js = replaceOnce(js, mountStyle, mountStyle.replace(";", " + gpmHistoricalConflictsStyle;"));
  const translate = 'function F1e(e){\n    const officialName';
  js = replaceOnce(js, translate, 'function F1e(e){\n    if(e==="gpm.historicalConflicts.title")return "Historical Conflicts";\n    const officialName');
  const views = 'if(e==="military"){let a=G.BUDGET;';
  js = replaceOnce(js, views, 'if(e==="military"){if(t==="historical-conflicts")return [];let a=G.BUDGET;');
  const foot = 'foot:n=>this._subSel.military==="oob"?this._budgetReformFoot(n,!0):this._budgetReformFoot(n)';
  js = replaceOnce(js, foot, 'foot:n=>this._subSel.military==="historical-conflicts"?null:this._subSel.military==="oob"?this._budgetReformFoot(n,!0):this._budgetReformFoot(n)');
  const militaryTab = '{id:"command",k:"sub.military.war",rerender:!0,renderMode:"live",sig:n=>this._milNuclearSig(n),build:(n,r)=>this._bMilCommand(n,r),refresh:n=>this._rMilCommand(n),deactivate:()=>{this.deterrenceLayer?.active&&this.deterrenceLayer.set(!1)}},';
  js = replaceOnce(js, militaryTab, militaryTab + '{id:"historical-conflicts",k:"gpm.historicalConflicts.title",build:(n,r)=>gpmBuildHistoricalConflicts(n,this,r)},');
  const refresh = '_refreshTabUnsafe(e=null){gpmRefreshRegionalMap(this);';
  return replaceOnce(js, refresh, refresh + 'if(this.activeModule==="military"&&this._subSel.military==="historical-conflicts")gpmHistoricalConflictsView(K("content-body")?.querySelector("[data-gpm-history]"),this,this.sim);');
}

module.exports = { patchHistoricalConflictsRenderer };

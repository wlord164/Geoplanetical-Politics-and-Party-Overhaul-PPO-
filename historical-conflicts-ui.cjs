"use strict";

const { readIdentityIllustrations } = require("./historical-identities.cjs");

const style = `
  .gpm-history { display: grid; gap: var(--gap-3); min-width: 0; }
  .gpm-history :is(p, ul, dl) { margin: 0; }
  .gpm-history h3, .gpm-history h4 { margin-block: 0 var(--gap-1); }
  .gpm-history-tools, .gpm-history-actions { display: flex; flex-wrap: wrap; align-items: end; gap: var(--gap-2); }
  .gpm-history-tools label { display: grid; gap: var(--gap-1); }
  .gpm-history-tools label:first-child { flex: 1 1 14rem; }
  .gpm-history-tools :is(input, select) { width: 100%; min-width: 0; }
  .gpm-history-layout { display: grid; grid-template-columns: minmax(9rem, .7fr) minmax(0, 1.6fr); gap: var(--gap-3); }
  .gpm-history-list { display: grid; align-content: start; gap: var(--gap-1); max-height: 34rem; overflow: auto; }
  .gpm-history-list button {
    display: grid; justify-items: start; align-content: center; gap: 3px;
    height: auto; min-height: 36px; padding: 6px 9px;
    text-align: left; white-space: normal; overflow-wrap: anywhere; line-height: 1.2;
  }
  .gpm-history-list button[aria-pressed=true] { border-color: var(--mark-late, #edc583); }
  .gpm-history-detail, .gpm-history-side, .gpm-history-actor { display: grid; align-content: start; gap: var(--gap-2); min-width: 0; }
  .gpm-history-sides { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr)); gap: var(--gap-2); }
  .gpm-history-side, .gpm-history-region { padding: var(--gap-2); }
  .gpm-history-actor + .gpm-history-actor { border-top: 1px solid var(--line, #545861); padding-top: var(--gap-2); }
  .gpm-history-actor-heading, .gpm-history-leader { display: flex; align-items: center; gap: var(--gap-2); }
  .gpm-history-flag { width: 2.6rem; max-height: 1.75rem; object-fit: contain; }
  .gpm-history-leader img { width: 3.25rem; height: 3.25rem; object-fit: cover; object-position: center 25%; border-radius: var(--radius, 4px); }
  .gpm-history-actor li, .gpm-history-sources li { margin-top: var(--gap-1); }
  .gpm-history-sources { overflow-wrap: anywhere; user-select: text; }
  .gpm-history-sources button { margin-inline-start: var(--gap-1); }
  .gpm-history-map { display: grid; gap: var(--gap-1); }
  .gpm-history-map svg { display: block; width: 100%; max-height: 16rem; background: var(--bg, #12191f); }
  .gpm-history-map path { stroke: #141b21; stroke-width: 1px; vector-effect: non-scaling-stroke; cursor: pointer; }
  .gpm-history-map path[data-selected] { stroke: #fff2bd; stroke-width: 2px; }
  .gpm-history-map-key { display: flex; flex-wrap: wrap; gap: var(--gap-2); }
  .gpm-history-map-key i { display: inline-block; width: .8em; height: .8em; margin-inline-end: .3em; border: 1px solid currentColor; }
  .gpm-history-section { padding-block-start: var(--gap-2); border-top: 1px solid var(--line, #545861); }
  .gpm-history-section > summary { cursor: pointer; }
  .gpm-history-section > :not(summary) { margin-block-start: var(--gap-2); }
  .gpm-history-region-select { display: grid; gap: var(--gap-1); }
  .gpm-history-region-select select { min-width: 0; width: 100%; }
  .gpm-history-region dl { display: grid; grid-template-columns: max-content 1fr; gap: var(--gap-1) var(--gap-2); }
  .gpm-history-region dd { margin: 0; }
  .gpm-history-control { display: grid; gap: var(--gap-1); }
  .gpm-history-control-bar { display: flex; gap: 1px; overflow: hidden; height: .55rem; background: var(--bg, #12191f); border-radius: var(--radius, 4px); }
  .gpm-history-control-bar > span { height: 100%; }
  .gpm-history-control-list { display: grid; gap: 3px; padding: 0; list-style: none; }
  .gpm-history-control-list > li { display: grid; grid-template-columns: 8px 1fr auto; align-items: center; gap: 6px; }
  .gpm-history-control-list i { width: 8px; height: 8px; }
  .gpm-history-control-list b { font-variant-numeric: tabular-nums; }
  [data-gpm-region-control-box] {
    position: fixed; z-index: 28; display: grid; gap: 5px; box-sizing: border-box;
    width: max-content; min-width: min(9rem, calc(100vw - 16px)); max-width: min(17rem, calc(100vw - 16px));
    max-height: min(17rem, calc(100vh - 16px)); padding: 8px 10px; overflow: auto; overflow-wrap: anywhere;
    color: var(--text, #eff3f7); background: #172029; border: 1px solid #56606b;
    border-radius: var(--radius, 4px); box-shadow: 0 4px 14px #0006; font-size: .82rem;
  }
  [data-gpm-region-control-box] :is(ul, p) { margin: 0; }
  [data-gpm-region-control-box] ul { padding: 0; list-style: none; }
  [data-gpm-region-control-box] [data-gpm-control-row] { display: flex; justify-content: space-between; gap: 12px; padding-block: 2px; }
  [data-gpm-region-control-box] [data-gpm-control-row] > b { flex: none; font-variant-numeric: tabular-nums; }
  body:has([data-gpm-region-control-box]) #tooltip.gpm-history-map-tip { visibility: hidden; }
  [data-gpm-faction-inspector] .insp-head img.flag { object-fit: contain; }
  [data-gpm-faction-inspector] .insp-leader { cursor: default; }
  [data-gpm-faction-inspector] .insp-econ { grid-template-columns: repeat(auto-fit, minmax(5rem, 1fr)); }
  [data-gpm-faction-inspector] .insp-rel { display: grid; gap: var(--gap-2); }
  [data-gpm-faction-inspector] .ir-cell { text-align: left; }
  [data-gpm-faction-inspector] .gpm-faction-laws { padding-inline-start: var(--gap-4); margin-block: var(--gap-1) 0; }
  [data-gpm-faction-inspector] .gpm-faction-laws li + li { margin-top: var(--gap-1); }
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
    "political-agreement": "Political agreement", "decisive-victory": "Decisive victory", "negotiated-concession": "Negotiated concession",
    "government-transition": "Government transition", postwar: "Postwar policy",
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
  const identity = actor.identity;
  const flag = identity?.flag;
  const roles = ["leader", "headOfGovernment"];
  const documentedRoles = ["leader", "headOfState", "headOfGovernment"];
  const openingOfficials = documentedRoles.map(role => identity?.[role]).filter(Boolean);
  const officials = roles.flatMap(role => {
    const currentIdentity = role === "leader" && identity?.headOfState ? "headOfState" : role;
    const opening = identity?.[currentIdentity];
    if (!actor.leadership) return [];
    const person = actor.leadership[role];
    if (!person) return [];
    if (person.gpmHistoricalPerson === `${actor.id}:${currentIdentity}`) {
      return [{ ...opening, name: zt(person), image: Ts(person, actor.leadership.year) }];
    }
    return [{ name: zt(person), role: Bp(person.role, person.g), image: Ts(person, actor.leadership.year) }];
  });
  const administrationFlag = identity?.administrationFlag;
  const historicalOfficials = documentedRoles.flatMap(role => {
    const person = identity?.[role];
    const currentRole = role === "headOfState" ? "leader" : role;
    return person && actor.leadership?.[currentRole]?.gpmHistoricalPerson !== `${actor.id}:${role}`
      ? [{ ...person, image: person.portrait?.image }] : [];
  });
  const renderOfficial = person => `<div class="gpm-history-leader">
      ${person.image ? `<img src="${b(person.image)}" alt="${b(person.name)}">` : ""}
      <div><b>${b(person.name)}${person.alias ? ` (${b(person.alias)})` : ""}</b>${person.role ? `<br><small>${b(person.role)}</small>` : ""}</div></div>`;
  const representative = identity?.representative;
  const illustration = !representative?.portrait?.image && !officials.some(person => person.image) &&
    !openingOfficials.some(person => person.portrait?.image) && gpmHistoricalDossierIllustrations[actor.id];
  const fictionalName = !openingOfficials.length && !officials.length && illustration?.fictionalName;
  const illustrationLabel = fictionalName ? "Fictional scenario character" : "Illustrative portrait";
  const media = [flag, administrationFlag, identity?.victoryFlag, representative?.portrait,
    ...openingOfficials.map(person => person.portrait)].filter(Boolean);
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
  return `<article class="gpm-history-actor" data-history-actor="${b(actor.id)}">
    <div class="gpm-history-actor-heading">${flag ? `<img class="gpm-history-flag" src="${b(flag.image)}" alt="${b(flag.name)}" title="${b(flag.name)}">` : ""}
      <div><b>${b(actor.name || actor.id)}</b>${actor.shortName && actor.shortName !== actor.name ? ` <small>(${b(actor.shortName)})</small>` : ""}
        ${actor.kind || actor.role ? `<br><small>${b([actor.kind, actor.role].filter(Boolean).map(gpmHistoricalLabel).join(" · "))}</small>` : ""}</div></div>
    ${administrationFlag ? `<div class="gpm-history-actor-heading"><img class="gpm-history-flag" src="${b(administrationFlag.image)}" alt="${b(administrationFlag.name)}" title="${b(administrationFlag.name)}"><small>${b(actor.administrationName)}</small></div>` : ""}
    ${officials.length ? `<small>${actor.leadership ? "Current leadership" : "Opening leadership"}</small>` : ""}
    ${officials.map(renderOfficial).join("")}
    ${historicalOfficials.length ? `<small>Opening leadership</small>${historicalOfficials.map(renderOfficial).join("")}` : ""}
    ${representative ? `<small>Faction representative</small>${renderOfficial({
      ...representative, image: representative.portrait.image,
    })}` : ""}
    ${illustration ? `<div class="gpm-history-leader" data-history-illustration>
      <img src="${b(illustration.image)}" alt="${b(fictionalName ? illustrationLabel + " · " + fictionalName : illustrationLabel)}">
      <div><small>${illustrationLabel}</small>${fictionalName ? `<br><b data-history-fictional-name>${b(fictionalName)}</b>` : ""}</div>
    </div>` : ""}
    ${openingOfficials.length || media.length ? `<details><summary>Identity sources and image credits</summary><ul class="gpm-history-sources">
      ${openingOfficials.map(person => gpmHistoricalSource({ title: person.name, url: person.source })).join("")}
      ${representative ? gpmHistoricalSource({ title: representative.name, url: representative.source }) : ""}
      ${openingOfficials.map(person => person.portraitReference &&
        gpmHistoricalSource({ title: `${person.name} photograph`, url: person.portraitReference }) || "").join("")}
      ${media.map(item => gpmHistoricalSource({ title: item.credit, url: item.source }) +
        gpmHistoricalSource({ title: "Image license", url: item.license }) +
        (item.evidence ? gpmHistoricalSource({ title: "Documented flag use", url: item.evidence }) : "")).join("")}</ul></details>` : ""}
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

function gpmMountHistoricalInspector(ui, session, shell) {
  const host = K("insp-body");
  if (!host || ui.sim !== session) return false;
  if (ui.inspectedKey) ui.closeInspector();
  ui._resetInspectorTransient();
  ui.globe?.setSelected(null);
  ui.tooltip(null);
  host.replaceChildren(shell);
  host.scrollTop = 0;
  ui._showInspectorPanel();
  return true;
}

function gpmHistoricalFactionHeading(actor) {
  const flag = actor.identity?.flag;
  const ratio = Number.isFinite(flag?.ratio) && flag.ratio > 0 ? flag.ratio : 1.5;
  return `<div class="insp-head">
    ${flag?.image ? `<img class="flag fl-xl" data-gpm-faction-flag style="--flag-ratio:${ratio}"
      src="${b(flag.image)}" alt="${b(flag.name || actor.name)}">` : ""}
    <div class="insp-id">
      <div class="insp-name">${b(actor.mapName || actor.wartimeMapName || actor.shortName || actor.name)}</div>
      <div class="insp-regime">${b(gpmHistoricalLabel(actor.kind))}</div>
    </div>
  </div>`;
}

function gpmHistoricalFactionProfile(actor, front) {
  const identity = actor.identity;
  const opening = identity?.headOfState || identity?.leader || identity?.headOfGovernment;
  const leader = actor.leadership?.leader;
  const representative = identity?.representative;
  const illustration = gpmHistoricalDossierIllustrations[actor.id];
  const currentName = leader ? zt(leader) : opening?.name;
  const documented = !leader || !!leader.gpmHistoricalPerson;
  const portrait = leader ? Ts(leader, actor.leadership.year) : opening?.portrait?.image;
  const representativeImage = documented && !portrait && representative?.portrait?.image;
  const illustrativeImage = documented && !portrait && !representativeImage && illustration?.image;
  const photo = portrait || representativeImage || illustrativeImage;
  const leaderName = currentName || (representativeImage && representative.name) ||
    (illustrativeImage && illustration.fictionalName) || "Leadership not documented";
  const leaderRole = (leader && !documented ? Bp(leader.role, leader.g) : opening?.role) ||
    (representativeImage ? "Faction representative" : illustrativeImage && illustration.fictionalName ? "Fictional scenario character" : null);
  const photoCredit = representativeImage ? "Photo: " + representative.name + " (faction representative)" :
    illustrativeImage ? "Illustrative portrait" : null;
  const ideology = actor.ppoIdeology;
  const politics = ideology?.historicalLabel || ideology?.label ||
    (actor.ideology?.length <= 80 ? actor.ideology.replace(/\.$/, "") : null) ||
    (ideology?.territorial ? gpmHistoricalLabel(ideology.territorial) : null);
  const badges = front.status === "active" ? `<span class="badge alert">${o("inspector.badge.atWar")}</span>` :
    front.status ? `<span class="badge">${b(gpmHistoricalLabel(front.status))}</span>` : "";
  const stats = [
    ["Active forces", actor.nativeForces?.active],
    ["Reserve forces", actor.nativeForces?.reserve],
    ["Scenario forces", actor.nativeForces?.active == null ? actor.strength?.gamePersonnel : null],
  ].filter(([, value]) => Number.isFinite(value));
  const government = actor.administrationName || ideology?.relatedAdministration?.name;
  const details = [["Administration", government], ["Ideology", politics]].filter(([, value]) => value);
  const laws = (actor.laws || []).filter(law => law.name);
  const policy = law => {
    const statuses = { in_force: "In force", in_practice: "In practice", charter: "Charter" };
    const status = law.status && (statuses[law.status] || gpmHistoricalLabel(law.status));
    return `<li>${b(law.name)}${status ? ` <small class="regime-class">${b(status)}</small>` : ""}</li>`;
  };
  return `${gpmHistoricalFactionHeading(actor)}
    ${badges ? `<div class="badges insp-badges">${badges}</div>` : ""}
    <div class="k insp-leader" data-gpm-faction-leader>
      <span class="insp-ic il-ic">${photo ? `<img class="il-av" src="${b(photo)}" alt="${b(photoCredit || leaderName)}">` : Q.user}</span>
      <span class="il-txt"><span class="il-role">${b(leaderName)}</span>
        ${leaderRole || photoCredit ? `<span class="il-sub">${b([leaderRole, photoCredit].filter(Boolean).join(" · "))}</span>` : ""}
      </span>
    </div>
    ${stats.length ? `<div class="insp-econ">${stats.map(([label, value]) =>
      `<div class="stat" data-gpm-faction-stat><label>${b(label)}</label><span class="v">${b(value.toLocaleString(cs()))}</span></div>`).join("")}</div>` : ""}
    ${details.length ? `<div class="insp-rel">${details.map(([label, value]) =>
      `<div class="ir-cell"><label>${b(label)}</label><span>${b(value)}</span></div>`).join("")}</div>` : ""}
    ${laws.length ? `<div data-gpm-faction-policies><div class="insp-tier">Policies</div>
      <ul class="gpm-faction-laws">${laws.slice(0, 3).map(policy).join("")}</ul>
      ${laws.length > 3 ? `<details><summary>More policies</summary><ul class="gpm-faction-laws">${laws.slice(3).map(policy).join("")}</ul></details>` : ""}</div>` : ""}`;
}

async function gpmOpenHistoricalFactionInspector(ui, session, item, front, faction) {
  const shell = document.createElement("section");
  shell.setAttribute("data-gpm-faction-inspector", "");
  shell.dataset.factionId = faction.id;
  const heading = gpmHistoricalFactionHeading(faction);
  shell.innerHTML = heading + '<p class="empty-note" role="status">Loading faction profile…</p>';
  if (!gpmMountHistoricalInspector(ui, session, shell)) return;
  const selection = { session, factionId: faction.id, provinceKey: item.provinceKey };
  ui._gpmFactionInspector = selection;
  try {
    const result = await at(session, "gpm.historicalConflicts", { id: front.id });
    if (ui._gpmFactionInspector !== selection || ui.sim !== session || !shell.isConnected) return;
    const conflict = result?.selected;
    const actor = conflict?.actors?.find(candidate => candidate.id === faction.id);
    if (!actor) throw new Error("Faction absent from conflict view");
    shell.innerHTML = gpmHistoricalFactionProfile({ ...actor, mapName: faction.mapName }, front);
  } catch (error) {
    if (ui._gpmFactionInspector !== selection || ui.sim !== session || !shell.isConnected) return;
    console.warn("[PPO] Faction inspector could not load", error);
    shell.innerHTML = heading + '<p class="empty-note">Could not load the faction profile.</p>';
  }
}

function gpmHistoricalControlSummary(region, conflict, authority, compact = false, chart = false) {
  let rows = region.control;
  const military = region.militaryControl;
  if (!rows?.length && military?.totalCells > 0 && military.sides?.length === 2) {
    const first = Math.round(1000 * military.sides[0].cells / military.totalCells) / 10;
    rows = military.sides.map((side, index) => ({
      name: side.actorId ? authority(side.actorId) : U(side.countryKey),
      percent: index ? 100 - first : first,
    }));
  }
  if (rows?.length) {
    const percentage = new Intl.NumberFormat(cs(), { style: "percent", maximumFractionDigits: 1 });
    if (chart) {
      const palette = ["#648aa4", "#b48a60", "#a18ab5", "#77a18d"];
      const visual = rows.map((side, index) => ({
        name: side.name, share: Math.min(100, Math.max(0, side.percent)),
        color: /^#[0-9a-f]{6}$/i.test(side.color) ? side.color : palette[index % palette.length],
      }));
      return `<div class="gpm-history-control-bar" aria-hidden="true" data-gpm-control-chart>
        ${visual.filter(side => side.share > 0).map(side => `<span style="flex:${side.share};background:${side.color}"></span>`).join("")}</div>
        <ul class="gpm-history-control-list">${visual.map(side => `<li data-gpm-control-row><i aria-hidden="true" style="background:${side.color}"></i>
          <span>${b(side.name)}</span><b>${b(percentage.format(side.share / 100))}</b></li>`).join("")}</ul>`;
    }
    return `${compact ? "" : "<small>Modeled share of regional control.</small>"}
      <ul>${rows.map(side => `<li data-gpm-control-row><span>${b(side.name)}</span>
        <b>${b(percentage.format(side.percent / 100))}</b></li>`).join("")}</ul>`;
  }
  if (compact) return "<p>Control percentages unavailable.</p>";
  if (chart) return "<p>Military control percentages unavailable.</p>";
  const names = [...new Set([region.dominantActorId, region.secondaryActorId, region.currentController,
    ...(conflict.sides || []).flat()].filter(Boolean).map(authority))];
  return `<p>Military control percentages unavailable.</p>${names.length ? `<p>Known parties · ${b(names.join(" / "))}</p>` : ""}`;
}

function gpmCloseRegionalControlBox(ui) {
  const selection = ui._gpmRegionControlBox;
  if (!selection) return;
  ui._gpmRegionControlBox = null;
  selection.controller.abort();
  selection.shell.remove();
}

async function gpmOpenRegionalControlBox(ui, session, { name, conflictId, provinceKey, x = g1[0], y = g1[1] }) {
  if (ui.sim !== session) return;
  gpmCloseRegionalControlBox(ui);
  ui.tooltip(null);
  const shell = document.createElement("aside");
  shell.setAttribute("data-gpm-region-control-box", "");
  shell.setAttribute("aria-label", "Military control in " + (name || Ut(provinceKey, provinceKey)));
  shell.dataset.provinceKey = provinceKey;
  shell.innerHTML = '<strong>Military control</strong><div role="status" data-history-military-control>Loading…</div>';
  document.body.append(shell);
  const content = shell.querySelector("[data-history-military-control]");
  const place = () => {
    const left = x + 12 + shell.offsetWidth <= window.innerWidth - 8 ? x + 12 : x - shell.offsetWidth - 12;
    const top = y + 12 + shell.offsetHeight <= window.innerHeight - 8 ? y + 12 : y - shell.offsetHeight - 12;
    shell.style.left = Math.max(8, Math.min(left, window.innerWidth - shell.offsetWidth - 8)) + "px";
    shell.style.top = Math.max(8, Math.min(top, window.innerHeight - shell.offsetHeight - 8)) + "px";
  };
  place();
  const controller = new AbortController();
  const { signal } = controller;
  const selection = { session, conflictId, provinceKey, shell, controller };
  ui._gpmRegionControlBox = selection;
  const current = () => ui._gpmRegionControlBox === selection && ui.sim === session && shell.isConnected;
  document.addEventListener("pointerdown", event => {
    if (!shell.contains(event.target)) gpmCloseRegionalControlBox(ui);
  }, { capture: true, signal });
  document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    gpmCloseRegionalControlBox(ui);
  }, { capture: true, signal });
  window.addEventListener("resize", place, { signal });
  try {
    const result = await at(session, "gpm.historicalConflicts", { id: conflictId });
    if (!current()) return;
    const conflict = result?.selected;
    const region = conflict?.regions?.find(entry => entry.key === provinceKey);
    if (!region) throw new Error("Region absent from conflict view");
    const actors = new Map((conflict.actors || []).map(actor => [actor.id, actor]));
    const authority = id => actors.get(id)?.shortName || actors.get(id)?.name || U(id);
    content.innerHTML = gpmHistoricalControlSummary(region, conflict, authority, true);
    place();
  } catch (error) {
    if (!current()) return;
    console.warn("[PPO] Regional control could not load", error);
    content.textContent = "Could not load regional control.";
    place();
  }
}

function gpmHistoricalRegions(conflict, actors, state, ui) {
  if (!conflict.regions?.length) return '<p class="empty-note">No regional control data available.</p>';
  const selected = conflict.regions.find(region => region.key === state.regionKey) ||
    conflict.regions.find(region => (region.currentContested ?? region.contested) && (region.control?.length || region.militaryControl)) ||
    conflict.regions.find(region => region.currentContested ?? region.contested) || conflict.regions[0];
  const name = region => Ut(region.key, region.name);
  const authority = id => actors.get(id)?.shortName || actors.get(id)?.name || U(id);
  const category = region => {
    if (region.currentContested ?? region.contested) return "contested";
    const controller = region.currentController ?? region.controller;
    if (!controller || region.modeledContact && !region.occupationKey) return "unmapped";
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
      if (!region) return "";
      return `<path d="${b(item.d)}" fill="${colors[category(region)]}" data-history-region="${b(region.key)}" ${region === selected ? "data-selected" : ""}>
        <title>${b(name(region))} · ${b(regionStatus(region))}</title></path>`;
    }).join("")}</svg>`;
  const labels = {
    contested: "Contested", first: authority(conflict.sides?.[0]?.[0]), second: authority(conflict.sides?.[1]?.[0]),
    other: "Other actor", unmapped: "Control unspecified",
  };
  const categories = new Set(conflict.regions.map(category));
  const regionStatus = region => (region.currentContested ?? region.contested) ? "Contested"
    : region.occupationKey ? "Occupied"
    : region.modeledContact ? "War front"
    : (region.currentController ?? region.controller) ? "Controlled" : "Control unspecified";
  const militaryControl = (selected.currentContested ?? selected.contested) || selected.control?.length
    ? `<section class="gpm-history-control" aria-label="Military control breakdown" data-history-military-control>
      <b>Military control</b>${gpmHistoricalControlSummary(selected, conflict, authority, false, true)}</section>` : "";
  return `<section class="gpm-history-detail" aria-label="Regional control">
    <h4>Regional control</h4>
    ${layout ? `<div class="gpm-history-map">${paths(layout.paths, layout.W, layout.H)}${layout.insets.map(inset => paths(inset.paths, layout.box, layout.box)).join("")}
      <div class="gpm-history-map-key">${[...categories].map(key =>
        `<small><i aria-hidden="true" style="background:${colors[key]}"></i>${b(labels[key])}</small>`).join("")}</div></div>` : ""}
    <label class="gpm-history-region-select">Region
      <select class="k" data-authority-safe data-history-region-picker data-focus-key="history-region-picker">${conflict.regions.map(region =>
        `<option value="${b(region.key)}"${region === selected ? " selected" : ""}>${b(name(region))} · ${b(regionStatus(region))}</option>`).join("")}</select></label>
    <div class="sh-inset gpm-history-region">${militaryControl || `<p><b>${b(regionStatus(selected))}</b>
      ${(!selected.modeledContact || selected.occupationKey) && (selected.currentController ?? selected.controller) ? ` · ${b(authority(selected.currentController ?? selected.controller))}` : ""}</p>`}
    <details class="gpm-history-section" data-history-panel="region"><summary>Region details</summary>
      <dl>${selected.controller && selected.controller !== selected.currentController ? `<dt>Opening controller</dt><dd>${b(authority(selected.controller))}</dd>` : ""}
      ${selected.currentController && (!selected.modeledContact || selected.occupationKey) ? `<dt>Current controller</dt><dd>${b(authority(selected.currentController))}</dd>` : ""}
      ${selected.administrator ? `<dt>Administrator</dt><dd>${b(authority(selected.administrator))}</dd>` : ""}
      ${selected.legalOwner ? `<dt>Legal owner</dt><dd>${b(U(selected.legalOwner))}</dd>` : ""}
      ${selected.occupationKey ? `<dt>Current occupation</dt><dd>${b(U(selected.occupationKey))}</dd>` : ""}
      ${Number.isFinite(selected.disruption) ? `<dt>Disruption</dt><dd>${b(selected.disruption)} / 100</dd>` : ""}</dl>
      ${selected.localOutcomes?.length ? `<div><b>Local administrations</b><ul>${selected.localOutcomes.map(local => `<li>${b(local.administration || local.title)}</li>`).join("")}</ul></div>` : ""}
      ${selected.note ? `<p>${b(selected.note)}</p>` : ""}</details></div>
  </section>`;
}

function gpmHistoricalDetail(conflict, state, ui) {
  if (!conflict) return `<p>${state.pending ? "Loading conflict details…" : "Select a conflict to view its participants and regions."}</p>`;
  const actors = new Map((conflict.actors || []).map(actor => [actor.id, actor]));
  const selectedActor = actors.get(state.actorId);
  const sides = (conflict.sides || []).map((side, index) => {
    const entries = side.map(id => actors.get(id) || { id, name: U(id) });
    return `<section class="sh-inset gpm-history-side" aria-label="${b(entries[0]?.shortName || entries[0]?.name || `Side ${index + 1}`)}">${entries.filter(actor => actor.id !== state.actorId).map(actor => gpmHistoricalActor(actor, conflict.factionOutcomes?.[actor.id])).join("")}</section>`;
  });
  const combatants = new Set((conflict.sides || []).flat());
  const others = [...actors.values()].filter(actor => actor.id !== state.actorId && !combatants.has(actor.id));
  const parties = (conflict.sides || []).map(side => side.map(id => actors.get(id)?.shortName || actors.get(id)?.name || U(id)).join(", "));
  const sources = gpmHistoricalSourceList(conflict.sources);
  const pendingTerm = (conflict.options || []).find(option => option.id === state.term);
  const action = (id, label, extra = "") => `<button type="button" class="k" data-history-action="${id}" data-focus-key="history-${id}" ${extra}>${label}</button>`;
  const history = (conflict.history || []).toReversed().map(entry => {
    const provinces = entry.gainedProvinceKeys?.map(key => conflict.regions.find(region => region.key === key)?.name || key);
    const basis = entry.basis === "negotiated-concession" ? "Negotiated concession" : "";
    const gains = provinces?.length ? `Territorial gains · ${provinces.join(", ")}` : "";
    return `<li>${[ui.gameDate(entry.day), gpmHistoricalLabel(entry.term), gpmHistoricalLabel(entry.outcome), basis, gains].filter(Boolean).map(b).join(" · ")}</li>`;
  }).join("");
  const proposals = conflict.canNegotiate && conflict.options?.length ? (pendingTerm ? `<p>Submit ${b(pendingTerm.label)}?</p><div class="gpm-history-actions">
    ${action("confirm", "Submit proposal", `data-authority-command ${state.busy ? "disabled" : ""}`)}
    ${action("cancel", "Cancel", `data-authority-safe data-history-cancel-term="${b(pendingTerm.id)}"`)}</div>`
    : `<div class="gpm-history-actions">${conflict.options.map(option => `<button type="button" class="k" data-authority-command data-history-term="${b(option.id)}" data-focus-key="history-term-${b(option.id)}">${b(option.label)}</button>`).join("")}</div>`) : "";
  const outcome = conflict.victoryOutcome;
  const winner = outcome && actors.get(outcome.actorId);
  const victoryFlag = winner && ["national", "independence", "autonomy"].includes(outcome.scope)
    ? winner.identity?.victoryFlag || winner.identity?.administrationFlag || winner.identity?.flag : null;
  const provisionalFlag = victoryFlag && winner.identity.flag === victoryFlag;
  const postwar = outcome ? `<section class="gpm-history-detail" aria-label="Postwar outcome"><h4>Postwar outcome</h4>
    ${winner ? `<p>${outcome.negotiated ? "Agreement" : "Winner"} · ${b(winner.name)}</p>` : ""}
    ${outcome.concessionBy ? `<p>Conceded by ${b(U(outcome.concessionBy))}</p>` : ""}
    ${outcome.title ? `<p><b>${b(outcome.title)}</b>${outcome.administration ? ` · ${b(outcome.administration)}` : ""}</p>` : ""}
    ${victoryFlag ? `<div class="gpm-history-actor-heading"><img class="gpm-history-flag" src="${b(victoryFlag.image)}" alt="${b(victoryFlag.name)}">
      <small>${provisionalFlag ? "Provisional flag · " : ""}${b(victoryFlag.name)}</small></div>` : ""}
    ${!outcome.negotiated && outcome.coWinners?.length ? `<p>Other winners · ${b(outcome.coWinners.map(id => actors.get(id)?.name || id).join(", "))}</p>` : ""}
    ${outcome.note ? `<p>${b(outcome.note)}</p>` : ""}
    ${outcome.government ? `<p>${b(outcome.government)}</p>` : ""}
    ${outcome.sources?.length ? `<ul class="gpm-history-sources">${gpmHistoricalSourceList(outcome.sources)}</ul>` : ""}
    ${outcome.polityKey ? `<p>${b(outcome.scope === "autonomy" ? "Self-governing territory" : "New sovereign polity")}</p>` : ""}
    ${outcome.scope === "local" || outcome.scope === "autonomy" && outcome.native === false ? "<p>Local authority recorded within the stock region.</p>" : ""}
    ${outcome.regionalLaws?.length ? `<ul>${outcome.regionalLaws.map(law => `<li><b>${b(law.name)}</b><br>${b(law.note)}<ul class="gpm-history-sources">${gpmHistoricalSourceList(law.source)}</ul></li>`).join("")}</ul>` : ""}</section>` : "";
  const negotiations = proposals || conflict.pending || history || conflict.settlement ? `<details class="gpm-history-section" data-history-panel="negotiations"${state.term || conflict.pending ? " open" : ""}>
    <summary>Negotiations</summary><div class="gpm-history-detail">
    ${conflict.pending ? `<p>${b(conflict.pending.label)} proposed by ${b(U(conflict.pending.offeredBy))}. Review due ${b(ui.gameDate(conflict.pending.reviewDay))}.</p>` : ""}
    ${conflict.settlement ? `<p>Settlement · ${b(gpmHistoricalLabel(conflict.settlement))}</p>` : ""}
    ${proposals}${history ? `<ul>${history}</ul>` : ""}
  </div></details>` : "";
  return `<article class="gpm-history-detail" aria-label="${b(conflict.name)}">
    <header><h3>${b(conflict.name)}</h3><small>${b(gpmHistoricalLabel(conflict.status))}</small></header>
    ${parties.some(Boolean) ? `<p>${b(parties.filter(Boolean).join(" vs. "))}</p>` : ""}
    ${gpmHistoricalRegions(conflict, actors, state, ui)}
    ${conflict.theatreKey ? `<div class="gpm-history-actions">${action("theatre", "Open War Theatre", "data-authority-safe")}</div>` : ""}
    ${negotiations}
    ${postwar ? `<details class="gpm-history-section" data-history-panel="outcome"><summary>Postwar outcome</summary>${postwar}</details>` : ""}
    ${actors.size ? `<details class="gpm-history-section" data-history-panel="participants"${selectedActor ? " open" : ""}>
      <summary>Participants</summary>
      ${selectedActor ? gpmHistoricalActor(selectedActor, conflict.factionOutcomes?.[selectedActor.id]) : ""}
      ${sides.length ? `<div class="gpm-history-sides">${sides.join("")}</div>` : ""}
      ${others.length ? `<section class="gpm-history-side sh-inset" aria-label="Other actors"><h4>Other actors</h4>${others.map(actor => gpmHistoricalActor(actor)).join("")}</section>` : ""}
    </details>` : ""}
    <details class="gpm-history-section" data-history-panel="background"><summary>Background and sources</summary><div class="gpm-history-detail">
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
    ${conflict.advantage && conflict.status === "active" ? `<p>Advantage · ${b(actors.get(conflict.sides[conflict.advantage > 0 ? 1 : 0][0])?.name || "")} · ${b(Math.abs(conflict.advantage))} / 100</p>` : ""}
    ${conflict.transitionReview ? "<p>The former national government has been replaced. The new administration is reviewing this truce.</p>" : ""}
    ${conflict.victoryBlocked ? `<p>${b(conflict.victoryBlocked)}</p>` : ""}
    ${sources ? `<ul class="gpm-history-sources">${sources}</ul>` : ""}
    </div></details>
  </article>`;
}

function gpmHistoricalConflictsView(host, ui, session) {
  if (!host || !session) return;
  let state = ui._gpmHistory;
  if (!state || state.session !== session) state = ui._gpmHistory = { session, query: "", status: "", request: 0 };
  if (state.host === host && state.playerKey === session.playerKey) {
    const changed = state.data?.day !== session.day || state.lastCommitRevision !== session.status?.commitRevision;
    if (!state.pending && !state.busy && changed && performance.now() - state.lastRequest > 1500) void state.load();
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
  const incidents = host.querySelector("[data-history-incidents]");
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
    const panelOwner = element._historyPanelOwner;
    const opened = panelOwner === state.selectedId
      ? [...element.querySelectorAll("[data-history-panel][open]")].map(panel => panel.dataset.historyPanel) : [];
    element.innerHTML = html;
    element._historyHtml = html;
    element.scrollTop = scroll;
    element._historyPanelOwner = state.selectedId;
    for (const panel of element.querySelectorAll("[data-history-panel]")) {
      if (opened.includes(panel.dataset.historyPanel)) panel.open = true;
    }
    restoreFocus(key);
  };
  const paint = () => {
    if (state.host !== host || ui._gpmHistory !== state) return;
    const data = state.data;
    const all = data?.conflicts || [];
    const wars = all.filter(conflict => !conflict.crimeReport && !conflict.strategicOnly);
    const incidentReports = all.filter(conflict => conflict.crimeReport || conflict.strategicOnly);
    const statuses = [...new Set(wars.map(conflict => conflict.status).filter(Boolean))].sort();
    if (state.filter && !statuses.includes(state.filter)) state.filter = "";
    setHtml(filter, `<option value="">All statuses</option>${statuses.map(status => `<option value="${b(status)}"${state.filter === status ? " selected" : ""}>${b(gpmHistoricalLabel(status))}</option>`).join("")}`);
    const query = kt(state.query.trim());
    const matches = conflict => !query || kt([
      conflict.name, gpmHistoricalLabel(conflict.kind), ...(conflict.countryKeys || []).map(key => U(key)),
    ].join(" ")).includes(query);
    const statusOrder = ["active", "occupation", "ceasefire", "suspended", "settled"];
    const order = status => statusOrder.includes(status) ? statusOrder.indexOf(status) : statusOrder.length;
    const byStatus = (a, b) => order(a.status) - order(b.status) || a.name.localeCompare(b.name, cs());
    const rows = wars.filter(conflict => (!state.filter || conflict.status === state.filter) && matches(conflict)).sort(byStatus);
    const incidentRows = incidentReports.filter(matches).sort(byStatus);
    const buttons = conflicts => conflicts.map(conflict => `<button type="button" class="k" data-authority-safe data-history-select="${b(conflict.id)}" data-focus-key="history-select-${b(conflict.id)}" aria-pressed="${state.selectedId === conflict.id}">
      <b>${b(conflict.name)}</b><small>${b(gpmHistoricalLabel(conflict.status))}</small></button>`).join("");
    host.querySelector("[data-history-count]").textContent = wars.length ? `${wars.filter(conflict => conflict.status === "active").length} active` : "";
    setHtml(list, rows.length ? buttons(rows)
      : `<p>${data ? wars.length ? "No wars match these filters." : "No wars available." : state.pending ? "Loading wars…" : "Conflict data is unavailable."}</p>`);
    incidents.hidden = !incidentRows.length;
    if (incidents._historySelection !== state.selectedId && incidentRows.some(conflict => conflict.id === state.selectedId)) incidents.open = true;
    incidents._historySelection = state.selectedId;
    setHtml(incidents.querySelector("[data-history-incident-list]"), buttons(incidentRows));
    const selected = data?.selected;
    setHtml(detail, gpmHistoricalDetail(selected?.id && selected.id === state.selectedId ? selected : null, state, ui));
    feedback.textContent = state.status;
    host.setAttribute("aria-busy", String(!!state.pending || !!state.busy));
  };
  state.load = async (id = state.selectedId, force = false) => {
    if (!current() || state.busy || (state.pending && !force)) return;
    const request = ++state.request;
    const commitRevision = session.status?.commitRevision;
    state.pending = true;
    state.lastRequest = performance.now();
    paint();
    try {
      const result = await at(session, "gpm.historicalConflicts", id ? { id } : {});
      if (!current() || state.request !== request) return;
      if (!Array.isArray(result?.conflicts)) throw new Error("Unexpected conflict data");
      state.data = result;
      state.lastCommitRevision = commitRevision;
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
  host.onchange = event => {
    if (!event.target.matches("[data-history-region-picker]")) return;
    state.regionKey = event.target.value;
    paint();
  };
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
      state.actorId = null;
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
    <div class="gpm-history-layout">
      <div class="gpm-history-detail">
        <div class="gpm-history-list" role="group" aria-label="Wars" data-history-list data-keep-scroll="historical-conflicts"></div>
        <details class="gpm-history-section" data-history-incidents hidden><summary>Incident reports</summary>
          <div class="gpm-history-list" data-history-incident-list></div></details>
      </div><div data-history-detail></div>
    </div>
  </section>`;
  gpmHistoricalConflictsView(container.querySelector("[data-gpm-history]"), ui, session);
}

function patchHistoricalConflictsRenderer(source, replaceOnce) {
  const rendererFunctions = [gpmHistoricalLabel, gpmHistoricalSource, gpmHistoricalSourceList, gpmHistoricalActor,
    gpmMountHistoricalInspector, gpmHistoricalFactionHeading, gpmHistoricalFactionProfile, gpmOpenHistoricalFactionInspector,
    gpmHistoricalControlSummary, gpmCloseRegionalControlBox, gpmOpenRegionalControlBox,
    gpmHistoricalRegions, gpmHistoricalDetail, gpmHistoricalConflictsView, gpmBuildHistoricalConflicts];
  const initialize = "\nmountPartyButtons();\n";
  let js = replaceOnce(source, initialize, "\nconst gpmHistoricalConflictsStyle = " + JSON.stringify(style) + ";\n"
    + "const gpmHistoricalDossierIllustrations = " + JSON.stringify(readIdentityIllustrations()) + ";\n"
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
  js = replaceOnce(js, 'async openInspector(e,t,a,n=null){let r=this.inspectedKey;',
    'async openInspector(e,t,a,n=null){this._gpmFactionInspector=null;let r=this.inspectedKey;');
  js = replaceOnce(js, 'closeInspector(){this.inspectedKey=null,',
    'closeInspector(){this._gpmFactionInspector=null;this.inspectedKey=null,');
  js = replaceOnce(js, '_resetInspectorTransient(){this._inspSig=null,',
    '_resetInspectorTransient(){this._gpmFactionInspector=null;this._inspSig=null,');
  const refresh = '_refreshTabUnsafe(e=null){gpmRefreshRegionalMap(this);';
  return replaceOnce(js, refresh, refresh + 'if(this.activeModule==="military"&&this._subSel.military==="historical-conflicts")gpmHistoricalConflictsView(K("content-body")?.querySelector("[data-gpm-history]"),this,this.sim);');
}

module.exports = { patchHistoricalConflictsRenderer };

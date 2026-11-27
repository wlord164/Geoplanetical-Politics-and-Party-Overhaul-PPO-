const { patchUprisingWorker } = require("./party-uprising.cjs");
const { patchUprisingRenderer } = require("./party-uprising-ui.cjs");
const { patchHistoricalConflictsRenderer } = require("./historical-conflicts-ui.cjs");
const { patchHistoricalConflictMapRenderer } = require("./historical-conflict-map.cjs");
const { patchHistoricalOpeningTopology } = require("./historical-opening-topology.cjs");
const { patchSudanReunificationWorker, patchSudanReunificationRenderer } = require("./historical-sudan-reunification.cjs");
"use strict";

const { createHash } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const officialCountryNames = require("./party-official-country-names.cjs");
const { data: openingRegister, patchOpeningRegisterRenderer, patchOpeningRegisterWorker } = require("./opening-register.cjs");
const { patchRegisterPeopleRenderer, patchRegisterPeopleWorker } = require("./opening-register-people.cjs");
const { workerFunctions: organizingWorker, rendererFunctions: organizingRenderer } = require("./party-organizing.cjs");
const { workerFunctions: congressWorker } = require("./party-congress-model.cjs");
const { workerFunctions: congressCurrents } = require("./party-congress-currents.cjs");
const { workerFunctions: congressCharter } = require("./party-congress-charter.cjs");
const { workerFunctions: ideologyIdentityWorker } = require("./party-ideology-identity.cjs");
const { rendererFunctions: congressRenderer } = require("./party-congress.cjs");
const { sharedFunctions: congressDoctrines } = require("./party-congress-doctrines.cjs");
const { sharedFunctions: congressVoting, workerFunctions: congressVoteWorker } = require("./party-congress-vote.cjs");
const { workerFunctions: factionPeople, patchFactionPeopleWorker, patchFactionPeopleRenderer } = require("./party-faction-people.cjs");
const { workerFunctions: factionBargaining } = require("./party-faction-bargaining.cjs");
const { workerFunctions: factionDevelopment, patchFactionDevelopmentWorker } = require("./party-faction-development.cjs");
const { workerFunctions: supportWorker, rendererFunctions: supportRenderer } = require("./party-support-base.cjs");
const { workerFunctions: aiWorker } = require("./party-ai.cjs");
const { patchLawLabels, patchLawVoteSnapshots } = require("./party-law-labels.cjs");
const { workerFunctions: lawShortlistWorker } = require("./party-law-shortlist.cjs");
const { rules: regionalRules, workerFunctions: regionalWorker } = require("./party-regional-campaign.cjs");
const { style: regionalMapStyle, rendererFunctions: regionalRenderer } = require("./party-regional-map.cjs");
const { workerFunctions: fundingWorker } = require("./party-foreign-funding.cjs");
const { style: fundingStyle, rendererFunctions: fundingRenderer } = require("./party-foreign-funding-ui.cjs");
const { style: lawShortlistStyle, rendererFunctions: lawShortlistRenderer } = require("./party-law-shortlist-ui.cjs");
const campaignRules = require("./party-campaign-rules.cjs");
const { setupStyle, setupFunctions } = require("./party-campaign-rules-ui.cjs");
const { workerFunctions: campaignFounding } = require("./party-campaign-founding.cjs");
const { workerFunctions: domesticForecast } = require("./party-domestic-forecast.cjs");
const { patchDomesticWorker } = require("./party-domestic-worker.cjs");
const { patchAgreementWorker } = require("./party-agreements.cjs");
const { patchPartyDomesticRenderer } = require("./party-domestic-ui.cjs");
const { patchSimulationViewTimeout } = require("./simulation-view-timeout.cjs");

const version = "1.1.9";
const rendererHash = "5bf93822d46c2a59bca6dfb382bfcbaa9dfdf775af60bbb05e1f998bc753decc";
const workerHash = "346cb7a4d21cc9d9c963c8340a621acbb85e67e80400788a206d090ae74d8bc5";
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const axes = [
  { id: "econ", title: "Economy", low: "Statist", high: "Market" },
  { id: "social", title: "Social policy", low: "Progressive", high: "Conservative" },
  { id: "gov", title: "Governance", low: "Liberal", high: "Authoritarian" },
  { id: "nat", title: "National outlook", low: "Globalist", high: "Nationalist" },
];
const presets = require("./party-ideology-presets.cjs");

function gpmExpectedActor(countryKey, partyId, control = null) {
  const expected = {};
  if (countryKey !== undefined) expected.expectedCountryKey = countryKey;
  if (partyId !== undefined) expected.expectedPartyId = partyId;
  if (control?.campaignId !== undefined) expected.expectedCampaignId = control.campaignId;
  if (control?.controlRevision !== undefined) expected.expectedControlRevision = control.controlRevision;
  return expected;
}

function gpmActionMatchesActor(action, control) {
  const verb = action.verb;
  if (typeof verb !== "string" || !verb.startsWith("gpm.")) return true;
  if (verb.startsWith("gpm.party.") && action.partyId != null && action.partyId !== control.partyId) return false;
  return (action.expectedCountryKey === undefined || action.expectedCountryKey === control.countryKey) &&
    (action.expectedPartyId === undefined || action.expectedPartyId === control.partyId) &&
    (action.expectedCampaignId === undefined || action.expectedCampaignId === control.campaignId) &&
    (action.expectedControlRevision === undefined || action.expectedControlRevision === control.controlRevision);
}

function replaceOnce(source, before, after) {
  const offset = source.indexOf(before);
  if (offset < 0 || source.indexOf(before, offset + before.length) >= 0) {
    throw new Error(`Unexpected game code near ${before.slice(0, 65)}`);
  }
  return source.slice(0, offset) + after + source.slice(offset + before.length);
}

function estimatePartyIdeology(ideology) {
  if (!ideology || !gpmAxes.every(({ id }) => Number.isFinite(ideology[id]) && Math.abs(ideology[id]) <= 1)) return null;

  const { econ, social, gov, nat } = ideology;
  const statist = econ <= -.3;
  const market = econ >= .3;
  const progressive = social <= -.35;
  const conservative = social >= .35;
  const authoritarian = gov >= .45;
  const liberal = gov <= -.35;
  const nationalist = nat >= .5;
  const internationalist = nat <= -.5;

  if (nationalist) {
    if (statist) {
      if (authoritarian) return "Authoritarian Left Nationalism";
      if (progressive) return "Progressive Left Nationalism";
      if (conservative) return "Socially Conservative Left Nationalism";
      return "Left Nationalism";
    }
    if (conservative) return authoritarian ? "Authoritarian National Conservatism" : "National Conservatism";
    if (authoritarian) return "Authoritarian Nationalism";
    if (liberal) return "Liberal Nationalism";
    if (market) return "Market-Oriented Nationalism";
    return "Nationalism";
  }

  if (authoritarian) {
    if (statist) return conservative ? "Socially Conservative Authoritarian Left" : "Authoritarian Left";
    if (market) return "Authoritarian Market Right";
    if (conservative) return "Authoritarian Conservatism";
    if (progressive) return "Socially Progressive Authoritarianism";
    return "Authoritarian Centrism";
  }

  if (statist) {
    if (conservative) return "Socially Conservative Left";
    if (econ <= -.6) return internationalist ? "Internationalist Statist Left" : "Statist Left";
    if (progressive && liberal) return "Social Democracy";
    if (internationalist) return "Internationalist Left";
    return progressive ? "Progressive Left" : "Centre-Left";
  }

  if (market) {
    if (conservative) return liberal ? "Liberal Conservatism" : "Market Conservatism";
    if (liberal) return "Market Liberalism";
    if (progressive) return "Socially Progressive Market Right";
    return econ >= .6 ? "Market Right" : "Centre-Right";
  }

  if (progressive) return liberal ? "Social Liberalism" : "Progressivism";
  if (conservative) return "Social Conservatism";
  if (liberal) return "Liberal Centrism";
  if (internationalist) return "Internationalist Centrism";
  return "Centrism";
}

function partyIdeologyLabel(party) {
  const id = party?.nameDesc?.gpmDeclaredIdeology || party?.nameDesc?.gpmIdeologyPreset || party?.nameDesc?.gpmOpeningIdeology;
  if (Object.hasOwn(gpmPresets, id)) return gpmPresets[id].label;
  if (party?.nameDesc?.gpmOpeningKind === "aggregate") return "";
  if (party?.nameDesc?.gpmOpeningName && !party.nameDesc.gpmOpeningIdeologySource) return "Ideology unverified";
  return estimatePartyIdeology(party?.ideology) ?? o("pol.family." + rN(party));
}

function partyIdeologyBadge(party) {
  const opening = party.nameDesc?.gpmOpeningIdeology;
  const presetId = party.nameDesc?.gpmDeclaredIdeology || party.nameDesc?.gpmIdeologyPreset || opening;
  const preset = Object.hasOwn(gpmPresets, presetId) ? gpmPresets[presetId] : null;
  const label = partyIdeologyLabel(party);
  if (!label) return "";
  const evidence = party.nameDesc?.gpmOpeningIdeologySource;
  const registerTooltip = evidence?.endsWith("_estimate") ?
    ' data-tip="Closest PPO equivalent estimated from published party-position data."' :
    ' data-tip="Closest PPO equivalent from the opening register."';
  const tooltip = opening && presetId === opening ? registerTooltip :
    label === "Ideology unverified" ? ' data-tip="The register has no reliable party-wide ideology match."' :
    evidence === "game-model" ? ' data-tip="Estimated from this party’s existing game model."' :
    label !== preset?.label && estimatePartyIdeology(party.ideology) ? ' data-tip="Estimated from the party’s four current ideology scores."' : "";
  const historical = party.nameDesc?.gpmHistoricalIdeology;
  const historicalEquivalent = party.nameDesc?.gpmHistoricalIdeologyEquivalent;
  const founding = historical || historicalEquivalent
    ? (historical ? `<small>Historical ideology · ${b(historical)}</small>` : "") +
      (historicalEquivalent ? `<small>PPO equivalent · ${b(historicalEquivalent)}</small>` : "")
    : preset ? (label !== preset.label ? `<small>Founding preset · ${b(preset.label)}</small>` : "") +
      (preset.program ? `<small>${b(preset.program)}</small>` : "") : "";
  return `<span class="gpm-party-ideology"${tooltip}>${b(label)}${founding}</span>`;
}

function partyAxisScore(value) {
  if (!Number.isFinite(value) || Math.abs(value) > 1) return "—";
  const points = Math.round(Math.abs(value) * 100);
  if (!points) return "0";
  return `${value < 0 ? "−" : "+"}${points}`;
}

function setupIdeology(form) {
  const preset = form.elements.platform;
  for (const [id, entry] of Object.entries(gpmPresets)) {
    if (entry.foundingChoice !== false) preset.add(new Option(entry.label, id));
  }
  preset.add(new Option("Custom", "custom"));
  const details = form.querySelector("[data-ideology-details]");
  const estimate = form.querySelector("[data-ideology-estimate]");
  const sliders = gpmAxes.map(axis => {
    const slider = form.elements[axis.id];
    const output = details.querySelector(`output[for="gpm-axis-${axis.id}"]`);
    function update() {
      const value = Number(slider.value);
      output.textContent = value === 0 ? "Balanced" : `${value < 0 ? axis.low : axis.high} ${Math.abs(value)}`;
      slider.setAttribute("aria-valuetext", output.textContent);
    }
    slider.addEventListener("input", () => { preset.value = "custom"; update(); refreshEstimate(); });
    return { axis, slider, update };
  });
  const readIdeology = () => Object.fromEntries(sliders.map(({ axis, slider }) => [axis.id, Number(slider.value) / 100]));
  const refreshEstimate = () => {
    estimate.textContent = gpmPresets[preset.value]?.program || `Estimated ideology · ${estimatePartyIdeology(readIdeology())}`;
  };
  function applyPreset() {
    if (preset.value === "custom") { details.open = true; return; }
    const values = gpmPresets[preset.value].values;
    sliders.forEach(({ slider, update }, index) => { slider.value = values[index]; update(); });
    refreshEstimate();
  }
  preset.addEventListener("change", applyPreset);
  applyPreset();
  return readIdeology;
}

function partyDialog({ create, parties = [], selectedPartyId, countryKey, submit }) {
  const dialog = document.createElement("dialog");
  dialog.className = "gpm-party-dialog";
  dialog.innerHTML = `<form>
    <h2>${create ? "Create Party" : "Rename Party"}</h2>
    ${create ? "" : '<label>Party to rename<select name="targetParty" required></select></label>'}
    <label>Party name<input name="partyName" required maxlength="100" autocomplete="off"></label>
    <label>Abbreviation<input name="partyTag" maxlength="24" autocomplete="off" placeholder="Optional"></label>
    ${create ? `<label>Ideology preset<select name="platform"></select></label><small data-ideology-estimate></small>
      <details data-ideology-details><summary>Adjust ideology</summary>
        ${gpmAxes.map(axis => `<div class="gpm-axis">
          <div><label for="gpm-axis-${axis.id}">${axis.title}</label><output for="gpm-axis-${axis.id}"></output></div>
          <input id="gpm-axis-${axis.id}" name="${axis.id}" type="range" min="-100" max="100" step="5" value="0">
          <div><span>${axis.low}</span><span>${axis.high}</span></div>
        </div>`).join("")}
      </details><small>${gpmCampaignFoundingSummary()}</small>` : ""}
    <p role="alert" hidden></p>
    <div><button type="button" class="k" data-cancel>Cancel</button>
    <button type="submit" class="k primary">${create ? "Create & Start" : "Save"}</button></div>
  </form>`;
  const form = dialog.querySelector("form");
  const readIdeology = create ? setupIdeology(form) : null;
  const nameField = form.elements.partyName;
  const tagField = form.elements.partyTag;
  const error = form.querySelector('[role="alert"]');
  const save = form.querySelector('[type="submit"]');
  const target = form.elements.targetParty;
  if (target) {
    for (const party of parties) target.add(new Option(Sa(party, countryKey), party.id));
    target.value = selectedPartyId;
    const fillIdentity = () => {
      const party = parties.find(item => item.id === target.value);
      nameField.value = party ? Sa(party, countryKey) : "";
      tagField.value = party ? party.nameDesc?.gpmTag ?? _c(party, parties, countryKey) : "";
      error.hidden = true;
    };
    target.addEventListener("change", fillIdentity);
    fillIdentity();
  }
  const cancel = dialog.querySelector("[data-cancel]");
  cancel.onclick = () => dialog.close();
  dialog.addEventListener("close", () => dialog.remove(), { once: true });
  dialog.addEventListener("cancel", event => { if (save.disabled) event.preventDefault(); });
  form.onsubmit = async event => {
    event.preventDefault();
    const partyName = nameField.value.trim();
    if (!partyName) { nameField.focus(); return; }
    save.disabled = cancel.disabled = true;
    if (target) target.disabled = true;
    error.hidden = true;
    try {
      await submit({ name: partyName, tag: tagField.value.trim(), ideology: readIdeology?.(),
        ideologyPreset: form.elements.platform?.value, targetPartyId: target?.value });
      dialog.close();
    } catch (failure) {
      error.textContent = failure.message || "The party could not be updated.";
      error.hidden = false;
      save.disabled = cancel.disabled = false;
      if (target) target.disabled = false;
    }
  };
  document.body.append(dialog);
  dialog.showModal();
  nameField.focus();
  nameField.select();
}

function mountPartyButtons() {
  const style = document.createElement("style");
  style.textContent = ".gpm-party-dialog{box-sizing:border-box;width:min(420px,90vw);padding:24px;color:#e9eff4;background:#151d27;border:1px solid #546373;border-radius:8px}.gpm-party-dialog::backdrop{background:#0a0e14bc}.gpm-party-dialog form,.gpm-party-dialog label{display:grid;gap:8px}.gpm-party-dialog form{gap:14px}.gpm-party-dialog h2,.gpm-party-dialog p{margin:0}.gpm-party-dialog p{color:#ffb1a7}.gpm-party-dialog input,.gpm-party-dialog select{width:100%;box-sizing:border-box;padding:8px;color:inherit;background:#101720;border:1px solid #546373;border-radius:4px;font:inherit}.gpm-party-dialog form>div{display:flex;justify-content:flex-end;gap:8px}.mp-vd-name+[data-gpm-rename]{margin-block:6px}";
  style.textContent += ".gpm-party-dialog{max-height:90vh;overflow:auto}.gpm-party-dialog summary{cursor:pointer}.gpm-axis{display:grid;gap:3px;margin-top:12px}.gpm-axis>div{display:flex;justify-content:space-between;gap:12px}.gpm-axis span,.gpm-axis output{color:#b7c6d3;font-size:.85em}.gpm-axis input[type=range]{margin:0;padding:0;accent-color:#e26865}";
  style.textContent += `
    .gpm-party-ideology { display: inline-flex; flex-direction: column; gap: var(--gap-0); min-width: 0; }
    .gpm-party-ideology small { color: var(--text-2); font-weight: var(--fw-regular); }
    .gpm-my-ideology { margin-block: var(--gap-2); }
    .pa-axis > div:first-child:has(.gpm-axis-score) { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); gap: var(--gap-1); }
    .gpm-axis-score { font-variant-numeric: tabular-nums; color: var(--text); }
    .gpm-axis-score + span { text-align: right; }
    .gpm-organizing { display: grid; gap: var(--gap-2); }
    .gpm-organizing h4 { margin: var(--gap-2) 0 0; }
    .gpm-organizing small { color: var(--text-2); }
    .gpm-organizing-action { display: grid; gap: var(--gap-1); align-items: start; }
    .gpm-organizing-action button { justify-self: start; }
    .gpm-organizing-action label { display: flex; flex-wrap: wrap; gap: var(--gap-2); align-items: center; }
    .gpm-party-congress { display: grid; gap: var(--gap-2); }
    .gpm-congress-leading { display: grid; gap: var(--gap-1); padding: var(--gap-2); border: 1px solid var(--line, #474950); border-radius: var(--radius-1, 6px); }
    .gpm-congress-leading div { display: flex; align-items: baseline; justify-content: space-between; gap: var(--gap-2); flex-wrap: wrap; }
    .gpm-congress-leading strong { font-size: 1.15em; }
    .gpm-congress-chart > .gpm-congress-leading + .hemicycle { margin-block-start: var(--gap-4); }
    .gpm-congress-evidence { margin-top: var(--gap-2); }
    .gpm-congress-evidence ul { display: grid; gap: var(--gap-2); padding-left: var(--gap-3); }
    .gpm-congress-evidence li small { display: block; color: var(--text-2); }
    .gpm-congress-control { display: flex; align-items: center; flex-wrap: wrap; gap: var(--gap-2); }
    .gpm-congress-size { box-sizing: border-box; inline-size: 8rem; max-inline-size: 100%; margin: 0; }
    .gpm-congress-size-picks { display: flex; flex-wrap: wrap; gap: var(--gap-1); min-width: 0; }
    .gpm-congress-size-picks .k { flex: 0 0 auto; }
    .gpm-congress-size-summary { display: flex; flex-wrap: wrap; align-items: center; gap: var(--gap-1) var(--gap-2); }
    .gpm-party-congress button { justify-self: start; }
    .gpm-congress-ballot { min-width: 0; display: grid; gap: var(--gap-2); padding-block-start: var(--gap-2); border-top: 1px solid var(--line, #474950); }
    .gpm-congress-ballot h4 { margin: 0; }
    .gpm-congress-control select { min-width: 0; max-width: 100%; }
    .gpm-congress-grant { min-width: 0; display: grid; gap: var(--gap-1); }
    .gpm-congress-vote-rows { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr)); gap: var(--gap-1); margin: 0; padding: 0; list-style: none; }
    .gpm-congress-vote-rows:empty { display: none; }
    .gpm-congress-faction { min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: var(--gap-1); padding: var(--gap-2); border: 1px solid var(--line, #474950); }
    .gpm-congress-faction strong { overflow-wrap: anywhere; }
    .gpm-congress-faction > span:first-of-type { display: grid; justify-items: end; text-align: right; }
    .gpm-congress-faction > span:not(.num), .gpm-congress-faction > small { grid-column: 1 / -1; }
    .gpm-congress-roster { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--gap-1); margin: 0; padding: 0; list-style: none; }
    .gpm-congress-representative { display: grid; min-width: 0; gap: var(--gap-1); padding: var(--gap-2); border: 1px solid var(--line, #474950); overflow-wrap: anywhere; }
    @supports (grid-template-rows: subgrid) {
      .gpm-congress-roster { grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr)); }
      .gpm-congress-representative { grid-row: span 3; grid-template-rows: subgrid; }
    }
    .gpm-congress-rep-header { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; gap: var(--gap-1); }
    .gpm-congress-rep-header .num { white-space: nowrap; }
    .gpm-congress-rep-controls { display: flex; flex-wrap: wrap; align-items: flex-start; gap: var(--gap-1); min-width: 0; }
    .gpm-congress-rep-controls .k { min-width: 0; max-width: 100%; min-height: var(--h-ctl); height: auto; white-space: normal; overflow-wrap: anywhere; }
    .gpm-congress-rep-controls .gov-person { display: grid; grid-template-columns: 2.75rem minmax(0, 1fr); align-items: start; flex: 1 1 8rem; width: auto; text-align: left; }
    .gpm-congress-rep-controls .gov-person-copy { min-width: 0; padding-block-start: .3em; }
    .gpm-congress-rep-controls .gov-person-copy b { display: block; white-space: normal; overflow: visible; overflow-wrap: anywhere; text-overflow: clip; }
    .gpm-congress-rep-controls [data-gpm-faction-portrait] { width: 2.75rem; height: 2.75rem; }
    .gpm-congress-rep-controls [data-gpm-faction-portrait] img { display: block; width: 100%; height: 100%; object-fit: cover; }
    .gpm-congress-rep-details { display: grid; align-content: start; gap: var(--gap-1); min-width: 0; }
    .gpm-party-profile { grid-column: 1 / -1; display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--gap-2); }
    .gpm-party-profile-tabs { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 8rem), 1fr)); gap: var(--gap-1); }
    .gpm-party-profile-tabs .k { min-width: 0; height: auto; min-height: var(--h-ctl); padding: var(--gap-1) var(--gap-2); white-space: normal; overflow-wrap: anywhere; text-align: center; }
    .gpm-party-profile-tabs [aria-selected="true"] { border-color: var(--text-2); color: var(--text); background: var(--body-2); }
    .gpm-funding-attention { color: var(--mark-late, #edc583); margin-inline-start: var(--gap-1); }
    .gpm-party-profile [hidden] { display: none; }
    .gpm-party-profile small { color: var(--text-2); }
    .gpm-party-profile .hc-legend { flex-wrap: wrap; }
    .gpm-party-profile .hc-leg-item { white-space: normal; }
    .gpm-party-congress .hc-svg { max-width: none; }
    .gpm-party-support-base { display: grid; gap: var(--gap-2); }
    .gpm-support-blocs { list-style: none; padding: 0; margin: 0; display: grid; gap: var(--gap-2); }
    .gpm-support-bloc { display: grid; gap: var(--gap-1); }
    .gpm-support-bloc-line { display: flex; justify-content: space-between; align-items: baseline; gap: var(--gap-2); }
    .gpm-support-bloc-line .num { white-space: nowrap; }
    .gpm-support-track { height: 6px; border-radius: 3px; overflow: hidden; background: var(--line, #474950); }
    .gpm-support-track > span { display: block; height: 100%; border-radius: inherit; background: var(--accent, #c9ae79); }
  `;
  style.textContent += gpmRegionalMapStyle + gpmForeignFundingStyle + gpmLawShortlistStyle;
  document.head.append(style);
  gpmMountCampaignRules();
  const choice = document.getElementById("setup-role-note");
  const create = document.createElement("button");
  create.type = "button";
  create.className = "k";
  create.textContent = "Create Party";
  choice.after(create);
  create.onclick = () => {
    if (document.querySelector(".gpm-party-dialog")) return;
    partyDialog({ create: true, submit: async draft => {
      const start = document.getElementById("btn-start");
      if (start.disabled || !Se.setupPlayerControlIntent?.()?.partyId || !Se.setupSeedIntent?.()) {
        throw new Error("Choose a country and enter a valid world seed first.");
      }
      gpmNewParty = draft;
      try { start.click(); } finally { gpmNewParty = null; }
    }});
  };
  let openingRename = false;
  document.addEventListener("click", async event => {
    const trigger = event.target.closest?.("[data-gpm-rename]");
    if (!trigger || openingRename || document.querySelector(".gpm-party-dialog")) return;
    const session = Ve;
    const { countryKey, partyId, campaignId, controlRevision } = session?.playerControl || {};
    if (!partyId || !countryKey) return;
    const isCurrent = () => {
      const current = session.playerControl;
      return Ve === session && current?.partyId === partyId && current.countryKey === countryKey &&
        current.campaignId === campaignId && current.controlRevision === controlRevision;
    };
    openingRename = trigger.disabled = true;
    trigger.parentElement.querySelector("[data-gpm-rename-error]")?.remove();
    try {
      const view = await session.queryView("politics.country");
      if (!isCurrent() || !document.querySelector('[data-gpm-rename]')) return;
      const parties = (view?.player?.pol?.parties || []).filter(party => !gpmOpeningNonparty(party));
      if (view?.player?.key !== countryKey || !parties.some(party => party.id === partyId)) throw new Error("Your party could not be loaded.");
      partyDialog({
        parties, selectedPartyId: partyId, countryKey,
        submit: async draft => {
          if (!isCurrent()) throw new Error("The active campaign or party changed.");
          const result = await De(session, "applyPlayerAction", [{
            verb: "gpm.party.rename", countryKey, expectedPartyId: partyId,
            expectedCampaignId: campaignId, expectedControlRevision: controlRevision,
            targetPartyId: draft.targetPartyId, rename: { name: draft.name, tag: draft.tag },
          }]);
          if (!result?.ok) {
            throw new Error(result?.reason === "name"
              ? "Enter a name of 1–100 characters and an optional abbreviation of up to 24 characters."
              : "The selected party could not be renamed. Close the dialog and try again.");
          }
          if (Ve === session) Se.refreshTab?.(session);
        },
      });
    } catch (error) {
      if (trigger.isConnected) {
        const message = document.createElement("small");
        message.dataset.gpmRenameError = "";
        message.setAttribute("role", "alert");
        message.textContent = error.message || "Your party could not be loaded.";
        trigger.after(message);
      }
    } finally {
      openingRename = trigger.disabled = false;
    }
  });
}

function validatePartyName(value) {
  if (!value || typeof value.name !== "string" || typeof value.tag !== "string") return null;
  const name = value.name.trim();
  const tag = value.tag.trim();
  const invalid = /[\u0000-\u001f\u007f-\u009f]/u;
  if (!name || name.length > 100 || tag.length > 24 || invalid.test(name) || invalid.test(tag)) return null;
  return { name, tag };
}

function renameDomesticParty(sim, country, input) {
  const identity = validatePartyName(input.rename);
  if (!identity) return { ok: false, reason: "name" };
  const control = Qo(sim);
  const controlledParty = control.partyId && HS(country, control.partyId);
  if (!country || country !== sim.player || country.key !== input.countryKey || control.countryKey !== country.key ||
      !controlledParty || input.expectedPartyId !== control.partyId || gpmOpeningNonparty(controlledParty) ||
      (input.expectedCampaignId !== undefined && input.expectedCampaignId !== control.campaignId) ||
      (input.expectedControlRevision !== undefined && input.expectedControlRevision !== control.controlRevision)) {
    return { ok: false, reason: "party" };
  }
  const targetId = input.targetPartyId === undefined ? control.partyId : input.targetPartyId;
  if (typeof targetId !== "string" || !targetId) return { ok: false, reason: "party" };
  const party = HS(country, targetId);
  if (!party || gpmOpeningNonparty(party)) return { ok: false, reason: "party" };
  const descriptor = party.nameDesc || {};
  if (descriptor.gpmName === identity.name && descriptor.gpmTag === identity.tag &&
      descriptor.customName === identity.name && descriptor.customTag === identity.tag) return { ok: true, changed: false };
  // Keep the founding status separate from the display name, including for generated party IDs.
  const origin = /^np\d+$/.test(party.id) ? { gpmFounded: isCustomParty(party) } : {};
  party.nameDesc = { ...descriptor, ...origin, gpmName: identity.name, gpmTag: identity.tag,
    customName: identity.name, customTag: identity.tag };
  return { ok: true, changed: true };
}

function registerPartyRename() {
  gNt("gpm.party.rename", { apply: renameDomesticParty });
}

function isCustomParty(party) {
  const descriptor = party?.nameDesc;
  return descriptor?.gpmFounded === true ||
    (descriptor?.gpmFounded !== false && typeof descriptor?.gpmName === "string" && /^np\d+$/.test(party.id));
}

function createStartingParty(sim, draft) {
  const identity = validatePartyName(draft);
  const input = draft?.ideology;
  if (!identity || !input || !gpmAxes.every(axis => Number.isFinite(input[axis.id]) && Math.abs(input[axis.id]) <= 1)) {
    throw new Error("Invalid new party details");
  }
  const ideology = Object.fromEntries(gpmAxes.map(axis => [axis.id, input[axis.id]]));
  const preset = Object.hasOwn(gpmPresets, draft.ideologyPreset) ? gpmPresets[draft.ideologyPreset] : null;
  const presetMatches = preset && gpmAxes.every(({ id }, index) => ideology[id] === preset.values[index] / 100);
  const country = sim.player;
  const politics = country?.pol;
  if (!politics?.parties?.length || sim.day !== 0) throw new Error("This country cannot register a starting party");
  const rules = gpmCampaignRulesFor(sim);
  const supportCap = gpmFoundingSupportCap(rules);
  const seedSupport = gpmFoundingSupportSeed(politics, rules);
  if (seedSupport <= 0) throw new Error("This country has no valid starting party support");
  const previous = KXr(politics.parties);
  const change = OFA(politics, ideology, seedSupport, (party, parties) => {
    SUe(party, bs(country.key), (country.hash ^ sim.rngSeed0) >>> 0, parties);
    party.nameDesc = { ...party.nameDesc, gpmName: identity.name, gpmTag: identity.tag, gpmFounded: true };
    if (preset) party.nameDesc.gpmDeclaredIdeology = draft.ideologyPreset;
    if (presetMatches) party.nameDesc.gpmIdeologyPreset = draft.ideologyPreset;
  });
  rze(country, change, previous);
  kUe(country, change, previous);
  sim._reconcilePolity(country);
  const party = HS(country, change.id);
  if (!party) throw new Error("The new party was not registered");
  if (preset) gpmRecordPartyIdentity(party, draft.ideologyPreset);
  const hasSeats = (politics.chambers || []).some(chamber => (chamber.composition?.[party.id] || 0) > 0);
  if (!(party.support > 0 && party.support <= supportCap + 1e-9) || hasSeats ||
      !politics.parties.some(incumbent => incumbent.id !== party.id && incumbent.support > party.support)) {
    throw new Error("The new party did not qualify for a fair starting position");
  }
  if (sim.people) wXA(sim, country, sim._simYear || 2026);
  const founding = gpmApplyCampaignFounding(sim, country, party, rules, rules);
  sim.gpmCampaignFounding = { countryKey: country.key, partyId: party.id, ...founding };
  const result = sim.switchPlayerControl({ countryKey: country.key, partyId: change.id });
  if (!result?.ok) throw new Error(`Could not lead the new party (${result?.reason || "unknown"})`);
  const control = Qo(sim);
  if (control.controlsExecutive || control.controlsCabinet || control.heldOfficeIds.length) {
    throw new Error("The new party unexpectedly received a government office");
  }
}

function gpmApplyEmergingPartyFounding(sim, country, change) {
  if (change.type !== "emerge") return;
  const party = Gq(country, change.id);
  const rules = gpmCampaignRulesFor(sim);
  if (party?.organization) gpmApplyCampaignFounding(sim, country, party, rules, rules);
}

function bindElectorateWidth(view) {
  const content = view.closest("#content");
  if (!content || content.querySelector(".gpm-electorate-width")) return;
  const body = content.querySelector("#content-body");
  if (!body) return;

  if (!document.getElementById("gpm-electorate-style")) {
    const style = document.createElement("style");
    style.id = "gpm-electorate-style";
    style.textContent = `
      #content .gpm-electorate-width { display: none; }
      #workspace #content:has(#content-body[aria-labelledby="module-tab-politics-electorat"]) {
        --gpm-rail-width: var(--rail-w);
        --gpm-room: max(0px, calc(100cqw - var(--gpm-rail-width) - var(--ix-w) - 2 * var(--pad)));
        --gpm-compact: min(440px, var(--gpm-room));
        --gpm-wide: min(1320px, var(--gpm-room));
        width: calc(var(--gpm-compact) + (var(--gpm-wide) - var(--gpm-compact)) * var(--gpm-width, .32));
      }
      #workspace.map-mode #content:has(#content-body[aria-labelledby="module-tab-politics-electorat"]),
      #workspace:has(#nav-map:not(.hidden)) #content:has(#content-body[aria-labelledby="module-tab-politics-electorat"]) {
        --gpm-rail-width: calc(var(--rail-w) + var(--rail-map-w));
      }
      #content:has(#content-body[aria-labelledby="module-tab-politics-electorat"]) .gpm-electorate-width {
        display: flex; justify-content: flex-end; align-items: center; gap: var(--gap-2);
        margin: var(--gap-1) var(--gap-4); color: var(--text-2); font-size: var(--fs-body);
      }
      .gpm-electorate-width input { width: min(180px, 45%); min-width: 0; accent-color: var(--text-2); }
    `;
    document.head.append(style);
  }

  const key = "geoplanetical-party-mod:electorate-width";
  const label = document.createElement("label");
  label.className = "gpm-electorate-width";
  label.textContent = "Panel width";
  const input = document.createElement("input");
  input.type = "range";
  input.min = "0";
  input.max = "100";
  input.value = "32";
  try {
    const saved = localStorage.getItem(key);
    if (saved !== null && Number.isFinite(Number(saved))) input.value = saved;
  } catch {}
  label.append(input);
  body.before(label);

  const apply = () => content.style.setProperty("--gpm-width", String(input.valueAsNumber / 100));
  input.addEventListener("input", apply);
  input.addEventListener("change", () => {
    try { localStorage.setItem(key, input.value); } catch {}
  });
  apply();
}

function renderPartyProfile(view, party, ui) {
  if (!party || !view.party?.congress) return "";
  const tabs = [
    ["congress", "Party Congress", renderPartyCongress(view, party, ui)],
    ["support", "Support Base", renderPartySupportBase(view, ui)],
  ];
  if (view.party.regionalCampaign) tabs.push(["regional", "Regional Campaigning", gpmRenderRegionalOverview()]);
  if (view.party.foreignFunding) tabs.push(["foreign", "Foreign Funding", gpmRenderForeignFunding()]);
  tabs.push(["laws", "Law Shortlist", gpmRenderPartyLaws()]);
  return `<div class="gpm-party-profile">
    <div class="gpm-party-profile-tabs" role="tablist" aria-label="Party profile">
      ${tabs.map(([id, label], index) => `<button class="k" type="button" role="tab" id="gpm-tab-${id}"
        data-gpm-profile-focus="${id}" aria-controls="gpm-panel-${id}" aria-selected="${index === 0}"
        tabindex="${index === 0 ? 0 : -1}">${label}${id === "foreign" ? '<span class="gpm-funding-attention" hidden></span>' : ""}</button>`).join("")}</div>
    ${tabs.map(([id, , content], index) => `<div class="mp-reading" id="gpm-panel-${id}" role="tabpanel"
      aria-labelledby="gpm-tab-${id}" data-mp-reading="gpm-${id}" ${id === "support" ? 'tabindex="0"' : ""}
      ${index === 0 ? "" : "hidden"}>${content}</div>`).join("")}
  </div>`;
}

function bindPartyProfile(host, view, party, ui) {
  const profile = host.querySelector(".gpm-party-profile");
  if (!profile) return;
  const tabs = Array.from(profile.querySelectorAll('[role="tab"]'));
  const fundingAttention = profile.querySelector(".gpm-funding-attention");
  if (fundingAttention) {
    const funding = view.party.foreignFunding;
    const attention = funding?.grant?.exposed ? "Exposed" : funding?.offer ? "Offer" : "";
    fundingAttention.hidden = !attention;
    fundingAttention.textContent = attention;
  }
  const select = (tab, focus = false) => {
    ui._gpmPartyProfileTab = tab.id;
    for (const button of tabs) {
      const selected = button === tab;
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
      profile.querySelector("#" + button.getAttribute("aria-controls")).hidden = !selected;
    }
    if (tab.id === "gpm-tab-congress") bindPartyCongress(profile.querySelector("#gpm-panel-congress"), view, party, ui);
    if (tab.id === "gpm-tab-regional") gpmBindRegionalOverview(profile, view, ui);
    if (tab.id === "gpm-tab-foreign") gpmBindForeignFunding(profile, view, ui);
    if (tab.id === "gpm-tab-laws") gpmBindPartyLaws(profile, view, ui);
    if (focus) tab.focus();
  };
  select(tabs.find(tab => tab.id === ui._gpmPartyProfileTab) || tabs[0]);
  tabs.forEach((tab, index) => {
    tab.onclick = () => select(tab);
    tab.onkeydown = event => {
      const next = { ArrowLeft: (index + tabs.length - 1) % tabs.length, ArrowRight: (index + 1) % tabs.length,
        Home: 0, End: tabs.length - 1 }[event.key];
      if (next === undefined) return;
      event.preventDefault();
      select(tabs[next], true);
    };
  });
}

function patchRenderer(bytes) {
  if (sha256(bytes) !== rendererHash) throw new Error(`Unsupported Geoplanetical renderer. This mod targets ${version}.`);
  let js = patchSimulationViewTimeout(bytes.toString("utf8"), replaceOnce);
  js = patchHistoricalOpeningTopology(js, replaceOnce, "renderer");
  // Patch display lookups, leaving country IDs, native search aliases, and save data intact.
  js = replaceOnce(js, 'const __geoWorker = typeof document ===',
    `${gpmExpectedActor}\nconst gpmOfficialCountryNames = ${JSON.stringify(officialCountryNames)};\nconst __geoWorker = typeof document ===`);
  const countryName = 'function Yve(e){let t=Xd[tv];';
  js = replaceOnce(js, countryName, `function gpmOfficialCountryName(key) {
    return tv === "en" && Object.hasOwn(gpmOfficialCountryNames, key) ? gpmOfficialCountryNames[key] : null;
  }
  function Yve(e){
    const officialName = typeof e === "string" && e.startsWith("country.") ? gpmOfficialCountryName(e.slice(8)) : null;
    if (officialName) return officialName;
    let t=Xd[tv];`);
  const savedCountryName = '!Object.hasOwn(a,"customName")&&a.name?a.name:u0(a.key||e.playerKey,a.name||t)';
  js = replaceOnce(js, savedCountryName,
    '!Object.hasOwn(a,"customName")&&a.name&&!(gpmOfficialCountryName(a.key||e.playerKey)&&DE(a.key||e.playerKey).includes(a.name))?a.name:u0(a.key||e.playerKey,a.name||t)');
  const refreshCountryNames = 'function VM(e,t=null){!e||!e.features||(CNt(t),ZDe(e))}';
  js = replaceOnce(js, refreshCountryNames, `${refreshCountryNames}
  function gpmProjectCommittedCountryNames(bridge) {
    const shell = bridge.source?.readView?.(j.SHELL);
    if (!shell?.ready || !bridge.world?.features || bridge._gpmCountryNameShell === shell) return;
    bridge._gpmCountryNameShell = shell;
    const changed = new Set(h9.keys());
    for (const country of shell.countries) {
      if ((country.customName || "") === (h9.get(country.key) || "")) changed.delete(country.key);
      else changed.add(country.key);
    }
    if (!changed.size) return;
    VM(bridge.world, bridge.source);
    bridge.globe?.invalidateNationLabels?.([...changed]);
  }
  function gpmNationIdentityRow(session, hud, flags) {
    const key = session.playerKey || hud.key || flags.key;
    return [session.player, hud, flags].find(country => country?.key && country.key === key) || { key };
  }`);
  js = replaceOnce(js, 'n&&r.size&&this.onTerritoryProjected?.([...r])}return t}applyTerritoryChange(t){',
    'n&&r.size&&this.onTerritoryProjected?.([...r])}gpmProjectCommittedCountryNames(this);return t}applyTerritoryChange(t){');
  js = replaceOnce(js, '_heroHtml(e,t,a,n){let r=this._fsDraftFlag()',
    '_heroHtml(e,t,a,n){const identity=gpmNationIdentityRow(e,t,n);let r=this._fsDraftFlag()');
  js = replaceOnce(js, 's=!!n.customName,l=u0(t.key,t.name),', 's=!!identity.customName,l=u0(identity.key,identity.name),');
  js = replaceOnce(js, '<span class="nid-name">${Bi(j(n,t.key))}</span>', '<span class="nid-name">${Bi(j(identity,identity.key))}</span>');
  js = replaceOnce(js, 'function Sa(e,t=e?.countryKey){', 'function Sa(e,t=e?.countryKey){if(e?.nameDesc?.gpmName)return e.nameDesc.gpmName;');
  js = replaceOnce(js, 's=r.nameDesc?.customTag||(i?XS(`${i}:${r.id}`)?.tag:null);s&&n.add(s)', 's=r.nameDesc?.customTag||(r.nameDesc?.gpmName?r.nameDesc.gpmTag:i?XS(`${i}:${r.id}`)?.tag:null);s&&n.add(s)');
  js = replaceOnce(js, 'c=r.nameDesc?.customTag||s?.tag||pNt(l,n);n.add(c)', 'c=r.nameDesc?.customTag||(r.nameDesc?.gpmName?r.nameDesc.gpmTag:s?.tag)||pNt(l,n);n.add(c)');
  const button = '<div class="mp-vd-name">${b(a?Sa(a):s)}</div>';
  js = replaceOnce(js, button, button + '${a?`<button type="button" class="k" data-gpm-rename>Rename Party</button><div class="gpm-my-ideology">${partyIdeologyBadge(a)}</div>`:""}');
  js = replaceOnce(js, '<span>${o("pol.family."+rN(i))}</span>', '${partyIdeologyBadge(i)}');
  js = replaceOnce(js, '<div class="pa-axis" data-tip="${b(k)}"><div><span>${o(`political.ideology.${v}.neg`)}</span>', '<div class="pa-axis" data-tip="${b(k)}"><div><span>${o(`political.ideology.${v}.neg`)}</span><b class="gpm-axis-score">${partyAxisScore(i.ideology?.[v])}</b>');
  js = replaceOnce(js, 'h=d?"pol.family."+rN(d):"",f="pol.role."+(u.role==="partner"?"coalition":u.role),g=[u.id===n?"myparty.hero.titleParty":h,f].filter(k=>Qe(k)).map(k=>o(k))', 'h=d?partyIdeologyLabel(d):"",f="pol.role."+(u.role==="partner"?"coalition":u.role),g=[u.id===n?o("myparty.hero.titleParty"):h,Qe(f)?o(f):""].filter(Boolean)');
  const startButton = 'ct("btn-start").addEventListener("click",()=>';
  const rendererPresets = Object.fromEntries(Object.entries(presets).map(([id, { label, values, program, foundingChoice }]) =>
    [id, { label, values, program, foundingChoice }]));
  js = replaceOnce(js, startButton, [
    "let gpmNewParty = null;",
    "const gpmCampaignRulesUI = " + JSON.stringify({ presets: campaignRules.presets, sections: campaignRules.sections }) + ";",
    "const gpmCampaignRulesStyle = " + JSON.stringify(setupStyle) + ";",
    ...setupFunctions,
    "const gpmAxes = " + JSON.stringify(axes) + ";",
    "const gpmPresets = " + JSON.stringify(rendererPresets) + ";",
    estimatePartyIdeology, partyIdeologyLabel, partyIdeologyBadge, partyAxisScore, setupIdeology, partyDialog,
    mountPartyButtons, bindElectorateWidth,
    ...congressDoctrines, ...congressVoting, ...congressRenderer, ...supportRenderer,
    renderPartyProfile, bindPartyProfile, ...organizingRenderer,
    "const gpmRegionalMapStyle = " + JSON.stringify(regionalMapStyle) + ";",
    "const gpmForeignFundingStyle = " + JSON.stringify(fundingStyle) + ";",
    ...regionalRenderer, ...fundingRenderer,
    "const gpmLawShortlistStyle = " + JSON.stringify(lawShortlistStyle) + ";",
    ...lawShortlistRenderer,
    "mountPartyButtons();",
    startButton,
  ].join("\n"));
  const partyCard = '${this._mpVerdictHtml(t,d,p,m)}</div>';
  js = replaceOnce(js, partyCard, partyCard + '\n      ${renderPartyProfile(t,p,this)}\n      <div class="wide mp-reading" data-mp-reading="gpm-organizing">${renderPartyOrganizing(t,this)}</div>');
  js = replaceOnce(js, 'this._mpWire(e,t),sge(this,e.querySelector("[data-mp-customization]"),c,d,t),EQ(this,e,t)',
    'this._mpWire(e,t),bindPartyProfile(e,t,p,this),bindPartyOrganizing(e,t,this),sge(this,e.querySelector("[data-mp-customization]"),c,d,t),EQ(this,e,t)');
  js = replaceOnce(js, '"data-bill-line","data-party-activity","data-mp-auto-fundraise","data-mp-parl-laws","data-mp-propose","data-mp-customize"].find(y=>a?.hasAttribute(y))', '"data-bill-line","data-party-activity","data-mp-auto-fundraise","data-mp-parl-laws","data-mp-propose","data-mp-customize","data-gpm-congress-size","data-gpm-congress-bargain","data-gpm-congress-priority","data-gpm-congress-vote","data-gpm-congress-priority-vote","data-gpm-profile-focus"].find(y=>a?.hasAttribute(y))');
  const refresh = 'this._mpRefreshReading(t,"identity",this._mpVerdictHtml(e,a,c,r))';
  // Stock 1.1.9 already rebinds customization immediately after refreshing the identity.
  js = replaceOnce(js, refresh, `${refresh},this._mpRefreshReading(t,"gpm-support",renderPartySupportBase(e,this)),this._mpRefreshReading(t,"gpm-organizing",renderPartyOrganizing(e,this)),bindPartyProfile(t,e,c,this),bindPartyOrganizing(t,e,this)`);
  js = replaceOnce(js, 'Aut(DR,null,"new",!1,e,void 0,a)', 'Aut(DR,null,"new",!1,{...e,partyModRules:gpmCampaignRulesForStart(),...gpmNewParty?{partyModCreate:gpmNewParty}:{}},void 0,a)');
  js = replaceOnce(js, 'playerControl:{partyId:a.partyId}', 'playerControl:{partyId:a.partyId,partyModRules:a.partyModRules,...a.partyModCreate?{partyModCreate:a.partyModCreate}:{}}');
  js = replaceOnce(js, '_bPolElectorat(e,t){', '_bPolElectorat(e,t){bindElectorateWidth(e);');
  js = replaceOnce(js, 'let S=w.top||[],k=Math.max(0,1-S.reduce((L,O)=>L+O.v,0))', 'let S=w.votes||w.top||[],k=w.votes?0:Math.max(0,1-S.reduce((L,O)=>L+O.v,0))');
  js = replaceOnce(js, 'S.map(L=>{let O=Math.round(L.v*100);', 'S.map(L=>{let O=L.v*100;');
  js = replaceOnce(js, '${b(i(L.id))} \\xB7 ${F(O)}', '${b(i(L.id))} \\xB7 ${F(O,!1,2)}');
  js = replaceOnce(js, 'this._chipById(n,L.id,{win:O===0})}<b class="num">${F(Math.round(L.v*100))}', 'this._chipById(n,L.id,{win:O===0})}<b class="num">${F(L.v*100,!1,2)}');
  js = patchLawLabels(js, replaceOnce);
  js = replaceOnce(js, 'yg("publicFacilityPlannerActive","closePublicFacilityPlanner")',
    'yg("publicFacilityPlannerActive","closePublicFacilityPlanner"),yg("gpmRegionalActive","closeGpmRegionalMap")');
  js = replaceOnce(js, 'if(an!=="game")return;if(Se.warRoomActive)', 'if(an!=="game")return;if(gpmRegionalGlobeClick(Se,t))return;if(Se.warRoomActive)');
  js = replaceOnce(js, 'Me.onBodyChange=a=>{HB(a),bi.setActiveBody(a)',
    'Me.onBodyChange=a=>{if(a!=="earth")gpmCloseRegionalMap(Se);HB(a),bi.setActiveBody(a)');
  js = replaceOnce(js, '_refreshTabUnsafe(e=null){', '_refreshTabUnsafe(e=null){gpmRefreshRegionalMap(this);');
  js = replaceOnce(js, 'showScreen(e){for(let t of document.querySelectorAll(".screen"))',
    'showScreen(e){if(e!=="game")gpmCloseRegionalMap(this);for(let t of document.querySelectorAll(".screen"))');
  js = replaceOnce(js, '${this._mpAdvRulerHtml(n)}',
    '${this._mpAdvRulerHtml(n)}<small data-gpm-spending-preview style="white-space:pre-line">${b(gpmCampaignSpendingText(n,this))}</small>');
  js = replaceOnce(js, 'r("[data-mp-log]",this._mpLogHtml(n.campaign));let d=',
    'r("[data-mp-log]",this._mpLogHtml(n.campaign)),r("[data-gpm-spending-preview]",gpmCampaignSpendingText(u,this));let d=');
  js = replaceOnce(js, 'p.contestId&&a.party?.campaignPreviews?.[p.contestId]||a.party?.actionPreviews?.campaign',
    'p.contestId?a.party?.campaignPreviews?.[p.contestId]:a.party?.actionPreviews?.campaign');
  js = replaceOnce(js, '||e.party?.actionPreviews?.[t]||{ok:!1,reason:"resources",cost:{},effect:{}}',
    '||(t==="campaign"&&a.contestId?e.party?.campaignPreviews?.[a.contestId]:e.party?.actionPreviews?.[t])||{ok:!1,reason:"resources",cost:{},effect:{}}');
  js = patchHistoricalConflictsRenderer(patchUprisingRenderer(js), replaceOnce);
  js = patchHistoricalConflictMapRenderer(js, replaceOnce);
  const { patchHistoricalIdentityRenderer } = require("./historical-identities.cjs");
  js = patchSudanReunificationRenderer(js, replaceOnce);
  js = patchHistoricalIdentityRenderer(js, replaceOnce);
  js = patchFactionPeopleRenderer(js, replaceOnce);
  js = require("./frontline-ui.cjs").patchFrontlineRenderer(js, replaceOnce);
  js = patchOpeningRegisterRenderer(js, replaceOnce);
  js = patchRegisterPeopleRenderer(js, replaceOnce, openingRegister);
  return Buffer.from(patchPartyDomesticRenderer(js, replaceOnce));
}

function patchWorker(bytes) {
  if (sha256(bytes) !== workerHash) throw new Error(`Unsupported Geoplanetical simulation. This mod targets ${version}.`);
  let js = bytes.toString("utf8");
  // The native editor and PPO Rename Party share the visible identity for mod-named parties.
  js = replaceOnce(js, 't.name!==void 0&&(e.nameDesc.customName=t.name),t.tag!==void 0&&(e.nameDesc.customTag=t.tag)',
    't.name!==void 0&&(e.nameDesc.customName=t.name,typeof e.nameDesc.gpmName==="string"&&(e.nameDesc.gpmName=t.name)),t.tag!==void 0&&(e.nameDesc.customTag=t.tag,typeof e.nameDesc.gpmName==="string"&&(e.nameDesc.gpmTag=t.tag))');
  js = patchHistoricalOpeningTopology(js, replaceOnce, "worker");
  js = replaceOnce(js, "function Zzt(){",
    readFileSync(join(__dirname, "historical-province-climate.js"), "utf8") + "\nfunction Zzt(){");
  js = replaceOnce(js, "GbA(g,y.climate,y.provinces,M)",
    "GbA(g,y.climate,gpmHistoricalClimateProvinceMap(g.world,y.provinces),M)");
  js = replaceOnce(js, 'throw new Error("natural-hazards:world-missing");let t=new Set',
    'throw new Error("natural-hazards:world-missing");gpmHistoricalProvinceHazards(e.world,H4t);let t=new Set');
  js = replaceOnce(js, "function SkA(e){let t={};",
    readFileSync(join(__dirname, "historical-province-transport.js"), "utf8") +
    "\nfunction SkA(e){gpmHistoricalProvinceTransport(e.world,Wae);let t={};");
  js = replaceOnce(js, "function wkA(e,t,A=null){let a=vkA(t);iOe(a);",
    "function wkA(e,t,A=null){let a=vkA(t);iOe(a);gpmHistoricalProvinceTransport(e.world,Wae,a.byProvince);");
  const startSimulation = 'async function Pjt(e,t,A=[]){';
  js = replaceOnce(js, startSimulation, [
    ...campaignRules.declarations, ...campaignFounding, ...domesticForecast,
    "const gpmAxes = " + JSON.stringify(axes) + ";",
    "const gpmPresets = " + JSON.stringify(presets) + ";",
    estimatePartyIdeology, validatePartyName, renameDomesticParty, registerPartyRename,
    ...ideologyIdentityWorker, createStartingParty, ...organizingWorker,
    ...congressWorker, ...congressDoctrines, ...congressVoting, ...congressVoteWorker,
    ...supportWorker, ...aiWorker, advancePartyModDay, retirePartyCongresses, partyOrganizationForMerger,
    ...factionPeople, ...factionBargaining, ...factionDevelopment,
    "registerPartyFactionBargaining();",
    "registerPartyRename();",
    gpmTransferPartyLifecycle, gpmPartyForCountryBirth, gpmCommitCountryBirthParties,
    "registerPartyOrganizing();",
    "registerPartyCongressSize();",
    "const gpmRegionalRules = " + JSON.stringify(regionalRules) + ";",
    ...regionalWorker, ...fundingWorker, ...lawShortlistWorker,
    "registerPartyRegionalCampaign();",
    "registerPartyForeignFunding();",
    ...congressCurrents, ...congressCharter,
    "registerPartyCongressCurrents();",
    "registerPartyCongressCharter();",
    startSimulation,
  ].join("\n"));
  js = replaceOnce(js, 'yield"domestic.weekly"),t.has(ea.WEEKLY_POLITICS)', 'yield"domestic.weekly"),we("advancePartyModDay",()=>advancePartyModDay(e)),t.has(ea.WEEKLY_POLITICS)');
  js = replaceOnce(js, 'organization:t.organization?structuredClone(t.organization):null,campaigns:',
    'organization:partyOrganizationForMerger(t),funding:t.gpmForeignFunding?structuredClone(t.gpmForeignFunding):null,domestic:t.gpmDomestic?.membership?{membership:structuredClone(t.gpmDomestic.membership)}:null,currents:t.gpmCongressCurrents?structuredClone(t.gpmCongressCurrents):null,campaigns:');
  js = replaceOnce(js, 'rze(t,o,i),kUe(t,o,i),',
    'rze(t,o,i),kUe(t,o,i),gpmTransferPartyLifecycle(e,t,o,i),');
  js = replaceOnce(js, 'b.pol.parties=(n.pol.parties||[]).map(P=>({...JSON.parse(JSON.stringify(P)),campaigns:{},parliament:{lastProposalDay:null,lastConfidenceDay:null}}))',
    'b.pol.parties=(n.pol.parties||[]).map(P=>gpmPartyForCountryBirth(P,typeof t.gpmUprisingFounderId==="string"?null:y))');
  js = replaceOnce(js, 'e.people&&sIt(e,b),v&&(v.__bornIdentity=FR(Y$e(b,v))),b}function i0o',
    'e.people&&sIt(e,b),v&&(v.__bornIdentity=FR(Y$e(b,v))),gpmCommitCountryBirthParties(n,b,t.gpmUprisingFounderId,y),b}function i0o');
  // Preserve existing balances and exact refunds in base currency units.
  js = replaceOnce(js, 'A.treasuryM=rq(yT(A.treasuryM||0,0,1e4))', 'A.treasuryM=rq(yT(A.treasuryM||0,0,1e4),6)');
  js = replaceOnce(js, 'Xu=1e3,Eye=1e4,Hna=10', 'Xu=1e6,Eye=1e4,Hna=10');
  js = replaceOnce(js, 'var jna=1e8/1e3,xYr=jna/Xu', 'var jna=Xu,xYr=jna/Xu');
  js = replaceOnce(js, 'o.organization.treasuryM=Oq(o.organization.treasuryM-r.cost.budgetM)', 'o.organization.treasuryM=partyForeignFundingTreasury(o,rq(o.organization.treasuryM-r.cost.budgetM,6))');
  js = replaceOnce(js, 'o.treasuryM=Iz(se(D3(o.treasuryM),D3(n)))', 'o.treasuryM=partyForeignFundingTreasury(o,Iz(se(D3(o.treasuryM),D3(n))))');
  js = replaceOnce(js, 'n.treasuryM=Iz(se(D3(n.treasuryM),D3(i)))', 'n.treasuryM=partyForeignFundingTreasury(K0(t,a),Iz(se(D3(n.treasuryM),D3(i))))');
  js = replaceOnce(js, 'l.organization.treasuryM=B/Xu,c.organization.treasuryM=p/Xu',
    'l.organization.treasuryM=partyForeignFundingTreasury(l,B/Xu),c.organization.treasuryM=p/Xu');
  js = replaceOnce(js, 'o.treasuryM=c/Xu,o.activistsK=gn(o.activistsK-n.activistsK)',
    'o.treasuryM=partyForeignFundingTreasury(K0(e,t.parent),c/Xu),o.activistsK=gn(o.activistsK-i.activistsK)');
  js = replaceOnce(js, 'b*=_8t(h,E.id)', 'b*=_8t(h,E.id)*partyOrganizingWeight(h,E.id)');
  js = replaceOnce(js, 'function v1a(e,t,A){return TUe(e.parties,[{share:1,', 'function v1a(e,t,A){return TUe(e.parties,[{id:t.id,share:1,');
  // Build the controlled party's private summaries before publishing the public roster.
  js = replaceOnce(js, 'function RTo({querySim:e,country:t,partyId:A}){',
    'function RTo({querySim:e,country:t,partyId:A},gpmElectorate,gpmFunding,gpmPlan,gpmFactionData){');
  js = replaceOnce(js, 'function Uja(e){let t=e?.player;', 'function Uja(e){let gpmElectorate,t=e?.player;');
  js = replaceOnce(js, 'devShowIds:!!e._devShowIds,player:o,people:c,dynasties:u,',
    'devShowIds:!!e._devShowIds,player:{...o,...vt(e,t)},people:c,dynasties:u,');
  js = replaceOnce(js, 'electorate:qa(r._electorateBreakdown(o)),electoral:', 'electorate:(gpmElectorate=qa(r._electorateBreakdown(o))),electoral:');
  js = replaceOnce(js, 'party:RTo(a)}}var DTo',
    'party:RTo(a,gpmElectorate,partyForeignFundingView(e,t,a.partyId),{...gpmDomesticView(e,t,a.partyId),agenda:gpmDomesticAgenda(e,t,a.partyId),recentResult:gpmPartyElectionRecapView(t,a.partyId)},gpmFactionCongressData(e,t,a.partyId))}}var DTo');
  js = replaceOnce(js, 'outreach:mFA(e,t,A),negotiations:Rda(e,t,A)',
    'outreach:mFA(e,t,A),organizing:partyOrganizingView(e,t,A),campaignPlan:gpmPlan,congress:gpmFactionData,' +
    'regionalCampaign:partyRegionalCampaignView(e,t,A),agreement:partyAgreementView(e,t,A),foreignFunding:gpmFunding,' +
    'supportBase:partySupportBaseView(e,t,A,gpmElectorate),negotiations:Rda(e,t,A)');
  js = replaceOnce(js, 'function ZDt(e,t,A){', `${isCustomParty}\n${gpmApplyEmergingPartyFounding}\nfunction ZDt(e,t,A){`);
  js = replaceOnce(js, 'o=OFA(A,B,E*.55,c)', 'o=OFA(A,B,gpmFoundingSupportSeed(A,gpmCampaignRulesFor(e)),c)');
  js = replaceOnce(js, 'e._reconcilePolity(t),ZDt(e,t,o)',
    'e._reconcilePolity(t),gpmApplyEmergingPartyFounding(e,t,o),ZDt(e,t,o)');
  js = replaceOnce(js, 'if((p.support||0)<.06&&(Q.support||0)<.06&&_1(p.ideology,Q.ideology)<.35)', 'if(!isCustomParty(p)&&!isCustomParty(Q)&&(p.support||0)<.06&&(Q.support||0)<.06&&_1(p.ideology,Q.ideology)<.35)');
  js = replaceOnce(js, 'let E=n.find(B=>(B._starve||0)>=24);', 'let E=n.find(B=>!isCustomParty(B)&&(B._starve||0)>=24);');
  js = replaceOnce(js, 'this.sim=g,gwe(M=>be(g,{domain:"economy.finance",code:"finance-ledger.entries-off-grid",repair:"entries_settled_on_grid",context:M})),t.profileWorldTrade===!0',
    'this.sim=g,r?retirePartyCongresses(g):t.playerControl?.partyModCreate&&createStartingParty(g,t.playerControl.partyModCreate),gwe(M=>be(g,{domain:"economy.finance",code:"finance-ledger.entries-off-grid",repair:"entries_settled_on_grid",context:M})),t.profileWorldTrade===!0');
  js = replaceOnce(js, 'comp:e.nameDesc.comp||null,...e.nameDesc.customName?{customName:e.nameDesc.customName}:{},...e.nameDesc.customTag?{customTag:e.nameDesc.customTag}:{}}:null}function Aza', 'comp:e.nameDesc.comp||null,gpmName:e.nameDesc.gpmName||null,gpmTag:e.nameDesc.gpmTag||null,gpmIdeologyPreset:e.nameDesc.gpmIdeologyPreset||null,gpmDeclaredIdeology:e.nameDesc.gpmDeclaredIdeology||null,gpmHistoricalIdeology:e.nameDesc.gpmHistoricalIdeology||null,gpmHistoricalIdeologyEquivalent:e.nameDesc.gpmHistoricalIdeologyEquivalent||null,...e.nameDesc.customName?{customName:e.nameDesc.customName}:{},...e.nameDesc.customTag?{customTag:e.nameDesc.customTag}:{}}:null}function Aza');
  js = replaceOnce(js, 'top:u.slice(0,3).map(([B,p])=>({id:B,v:p}))', 'top:u.slice(0,3).map(([B,p])=>({id:B,v:p})),votes:u.map(([B,p])=>({id:B,v:p}))');
  js = patchLawVoteSnapshots(js, replaceOnce);
  js = replaceOnce(js, 'id:a.__provId,name:a.__name||"",pop:a.__pop||0,lean:a.__lean}));return{regions:A,partyPerf:',
    'id:a.__provId,key:a.__provKey,name:a.__name||"",pop:a.__pop||0,lean:a.__lean}));return{regions:A,day:e.day||0,partyPerf:');
  js = replaceOnce(js, 'function OUe(e,t,A=null){', 'function OUe(e,t,A=null,gpmApplyRegions=true){');
  js = replaceOnce(js, 'return{id:d.id,name:d.name||"",pop:d.pop||0,shares:PFA',
    'return{id:d.id,key:d.key,name:d.name||"",pop:d.pop||0,shares:PFA');
  js = replaceOnce(js, 'if(E>0)for(let Q in d.shares)d.shares[Q]/=E;let B=null,p=-1;',
    'if(E>0)for(let Q in d.shares)d.shares[Q]/=E;if(gpmApplyRegions)d.shares=partyRegionalShares(e,d.shares,d.key,t.day);let B=null,p=-1;');
  js = replaceOnce(js, 'function $qe(e,t){let A=t.pol;if(!A)return;', 'function $qe(e,t){let A=t.pol;if(!A)return;gpmBindCampaignPolity(e,A);');
  js = replaceOnce(js, 'countries.set(n.key,n);let l=[],c=(f,g,h)=>',
    'countries.set(n.key,n);gpmBindCampaignPolity(e,n.pol);let l=[],c=(f,g,h)=>');
  // Regional seat rules use the adjusted local shares. National rules use their population-weighted change.
  js = replaceOnce(js, 'function vO(e,t,A=null){let a=A?.kind||null', 'function vO(e,t,A=null,gpmForecast=null){let a=A?.kind||null');
  js = replaceOnce(js, 'u=c&&l.score||0,d=kPt(s,u,FYr(e,t,s,c?l:null));',
    'u=gpmForecast?.partyId===s.id?gpmForecast.score:c&&l.score||0,d=kPt(gpmForecast?.base?{...s,support:gpmForecast.base[s.id]??s.support}:s,u,gpmForecast?.promiseEffect?.(s,c?l:null)??FYr(e,t,s,c?l:null));');
  // Native energy promise previews read the same infrastructure totals for each party.
  js = replaceOnce(js, "function bpe(e){let t=new Map,A=(a,r)=>",
    "function bpe(e){const gpmPreview=gpmPromisePreviewInfrastructure?.get(e);if(gpmPreview?.plantSites)return gpmPreview.plantSites;let t=new Map,A=(a,r)=>");
  js = replaceOnce(js, "A(a.provKey,a.src).pendingGW+=Math.max(0,a.gw||0));return t}",
    "A(a.provKey,a.src).pendingGW+=Math.max(0,a.gw||0));if(gpmPreview)gpmPreview.plantSites=t;return t}");
  js = replaceOnce(js, "function p8r(e,t){let A=e.finance",
    "function p8r(e,t){const gpmCommitments=gpmPromisePreviewInfrastructure?.get(e)?.commitments;" +
    "if(gpmCommitments?.has(t))return gpmCommitments.get(t);let A=e.finance");
  js = replaceOnce(js, "return{committedMonthlyBn:J(r),payableBn:a.get(A)||0}}",
    'const gpmResult={committedMonthlyBn:J(r),payableBn:a.get(A)||0};' +
    'if(gpmCommitments&&t&&typeof t==="object")gpmCommitments.set(t,gpmResult);return gpmResult}');
  js = replaceOnce(js, 'let s=OI(t,n,e.day||0,r.contestId||null);return pye(e,t,A,s,r)',
    'let s=OI(t,n,e.day||0,r.contestId||null);return partyCampaignSpendPreview(e,t,A,s,r)');
  js = replaceOnce(js, 'if(i.transfer)return ykr(i,t,A,{rulingId:a,rig:DUe(e,r),polity:o,electoralMap:n});let s={},l=0;',
    'if(i.transfer)return ykr(i,t,A,{rulingId:a,rig:DUe(e,r),polity:o,electoralMap:n});if(o&&["direct","equal-per-state","delegated"].includes(e.selectMode||"direct"))t=partyRegionalNationalShares(o,n,t);let s={},l=0;');
  js = replaceOnce(js, 'let w=IFA(b,v,e.apportionment);for(let I in w)',
    'let w=IFA(b,v,e.apportionment);if(i?.gpmDistrictSeats)i.gpmDistrictSeats.set(S.id,{total:v,seats:w});for(let I in w)');
  js = replaceOnce(js, 'u=m=>{let f=q8t(l,m),g={};',
    'u=m=>{i?.gpmDistrictSeats?.clear();let f=q8t(l,m),g={};');
  js = replaceOnce(js, 'reportOrder:[]},I=a.parties.filter(te=>g[te.id]!=null).map(te=>({id:te.id,votes:Math.max(0,h[te.id]||0)}))',
    'reportOrder:[]},gpmNational=partyRegionalNationalShares(a,VO(e,t),h),I=a.parties.filter(te=>g[te.id]!=null).map(te=>({id:te.id,votes:Math.max(0,gpmNational[te.id]||0)}))');
  js = replaceOnce(js, 'c=Qye(e,t,l,n),u={day:n,electionDay:a.nextDay,kind:r,contestId:o,values:c}',
    'c=Qye(e,t,partyRegionalNationalShares(t.pol,VO(e,t),l),n),u={day:n,electionDay:a.nextDay,kind:r,contestId:o,values:c}');
  js = replaceOnce(js, 'Oot(a,A,t.params||{})',
    '(A==="gpm.foreignFunding"?partyForeignFundingDirectory(a,t.params||{}):A==="gpm.partyLawShortlist"?partyLawShortlist(a):Oot(a,A,t.params||{}))');
  // Publish summaries while keeping private party state on the worker.
  js = replaceOnce(js, 'o.pol.parties=Gja(t.pol);',
    'o.pol.parties=Gja(t.pol).map(({gpmForeignFunding,gpmDomestic,gpmFactionPolitics,gpmCharter,...party})=>party);');
  const { patchHistoricalConflictsWorker } = require("./historical-conflicts.cjs");
  const { patchHistoricalNameWorker } = require("./historical-identities.cjs");
  let historical = replaceOnce(patchHistoricalConflictsWorker(patchUprisingWorker(js, replaceOnce), replaceOnce),
    'this.sim=g,!r&&gpmUprising.captureStartingIdentities(g),r?retirePartyCongresses(g)',
    'this.sim=g,gpmInitializeCampaignRules(g,t.playerControl?.partyModRules,r),gpmMigrateDomesticCampaign(g),r&&(gpmMigrateFactionDoctrines(g),gpmCongressMigrateCurrents(g)),!r&&gpmUprising.captureStartingIdentities(g),r?retirePartyCongresses(g)');
  historical = replaceOnce(historical, '(A==="gpm.historicalMap"?',
    '(A==="gpm.partyFactionQuote"?gpmFactionQuote(a,a.player,Gq(a.player,Lo(a.player)),t.params||{},"player"):' +
    'A==="gpm.campaignRules"?{rules:gpmCampaignRulesFor(a),founding:a.gpmCampaignFounding??null}:' +
    'A==="gpm.partyCampaignPlanForecast"?partyCampaignPlanForecast(a,a.player,Lo(a.player),t.params?.contestId):A==="gpm.historicalMap"?');
  const { patchWorkingCapital } = require("./working-capital.cjs");
  const { patchTerritorialPayroll } = require("./territorial-payroll.cjs");
  historical = patchWorkingCapital(historical, replaceOnce);
  historical = patchTerritorialPayroll(historical, replaceOnce);
  let worker = patchHistoricalNameWorker(patchSudanReunificationWorker(historical, replaceOnce), replaceOnce);
  worker = patchDomesticWorker(worker, replaceOnce);
  worker = patchAgreementWorker(worker, replaceOnce);
  worker = replaceOnce(worker, ',situation:urt(e,A),space:e.space?Q_o(e,A.key):null,pressures:p_o(e,A),technology:',
    ',situation:urt(e,A),gpmDomesticAgenda:gpmDomesticAgenda(e,A,Lo(A)),space:e.space?Q_o(e,A.key):null,pressures:p_o(e,A),technology:');
  worker = replaceOnce(worker, 'e._onLegislative(t,i,E,f,d,h)?.electionResolved===!0?e._politicalCampaigns.delete(u):i.composition=E',
    '(()=>{const recap=gpmPartyElectionRecap(e,t,i,B,E,d,s);if(e._onLegislative(t,i,E,f,d,h)?.electionResolved===!0){e._politicalCampaigns.delete(u);gpmStorePartyElectionRecap(t,recap)}else i.composition=E})()');
  worker = replaceOnce(worker, '({gpmUprisingPreparations,gpmForeignFunding,...A})',
    '({gpmUprisingPreparations,gpmForeignFunding,gpmDomestic,gpmFactionPolitics,gpmCharter,...A})');
  worker = patchFactionPeopleWorker(worker, replaceOnce);
  worker = patchFactionDevelopmentWorker(worker, replaceOnce);
  worker = replaceOnce(worker, 'G5e(this,this.player),A.changed&&(Nze(this),y$e(this))',
    'G5e(this,this.player),gpmFactionSeparatePartyLeader(this,this.player,Gq(this.player,Lo(this.player))),A.changed&&(Nze(this),y$e(this))');
  worker = require("./party-radicalization.cjs").patchPoliticalCrisisWorker(worker, replaceOnce);
  worker = replaceOnce(worker, 'const __geoWorker = typeof document ===',
    `${gpmActionMatchesActor}\nconst __geoWorker = typeof document ===`);
  const playerActionActor = 'let l=Qo(e);return Ke(e,e.player,{...i,speakerId:l.representativeId,partyId:l.partyId,roleId:l.parliamentaryRole})';
  // The host stamps the currently controlled actor, so validate the captured actor first.
  worker = replaceOnce(worker, playerActionActor,
    `let l=Qo(e);
    if(!gpmActionMatchesActor(i,l))return{ok:false,reason:"stale_actor",message:"Player control changed. Refresh this view and try again."};
    return Ke(e,e.player,{...i,speakerId:l.representativeId,partyId:l.partyId,roleId:l.parliamentaryRole})`);
  worker = patchOpeningRegisterWorker(worker, replaceOnce);
  worker = patchRegisterPeopleWorker(worker, replaceOnce, openingRegister);
  return Buffer.from(require("./frontline-worker.cjs").patchFrontlineWorker(worker, replaceOnce));
}

function advancePartyModDay(sim) {
  for (const country of sim.countries.values()) {
    for (const party of country.pol?.parties || []) {
      if (party.gpmOrganizing) advancePartyOrganizing(sim, country, party);
      if (party.gpmRegional) advancePartyRegionalCampaign(sim, country, party);
      if (party.gpmForeignFunding) advancePartyForeignFunding(sim, country, party);
      if (party.gpmFactionPolitics || party.gpmCongressSizeState?.pendingResize) gpmFactionDaily(sim, country, party, true);
    }
  }
}

function retirePartyCongresses(sim) {
  for (const country of sim.countries.values()) {
    for (const party of country.pol?.parties || []) retirePartyCongress(party);
  }
}

function partyOrganizationForMerger(party) {
  if (!party.organization) return null;
  const organization = structuredClone(party.organization);
  const reservedForOrganizing = [...(party.gpmOrganizing?.projects || []), ...(party.gpmRegional?.projects || [])]
    .reduce((sum, project) => sum + project.activistsK, 0);
  organization.activistsK = Oq(Math.min(1e5, organization.activistsK + reservedForOrganizing));
  const returnedFactionEscrow = (party.gpmFactionPolitics?.offers || []).reduce((cash, offer) =>
    offer.status === "accepted" ? cash + offer.cashM : cash, 0);
  if (returnedFactionEscrow) organization.treasuryM = gpmDomesticMoney(organization.treasuryM + returnedFactionEscrow);
  return organization;
}

function gpmTransferPartyLifecycle(sim, country, event, snapshots) {
  if (event.type === "split") {
    const parent = K0(country, event.parent);
    const child = K0(country, event.child);
    if (parent && child) gpmDomesticMoveMembers(parent, child, .25);
  }
  if (!event.gone || !event.into) return;
  const survivor = K0(country, event.into);
  if (!survivor?.organization) return;
  const old = snapshots.get(event.gone);
  partyForeignFundingMerge(sim, country, survivor, event.gone, old?.funding);
  if (old?.domestic) gpmDomesticMoveMembers({ gpmDomestic: old.domestic, gpmCongressCurrents: old.currents }, survivor, 1);
}

function gpmPartyForCountryBirth(party, share) {
  const copy = { ...JSON.parse(JSON.stringify(party)), campaigns: {},
    parliament: { lastProposalDay: null, lastConfidenceDay: null } };
  delete copy.gpmDomestic;
  delete copy.gpmOrganizing;
  delete copy.gpmRegional;
  delete copy.gpmForeignFunding;
  delete copy.gpmUprisingPreparations;
  delete copy.gpmCongressSizeState;
  delete copy.gpmCongressCurrents;
  delete copy.gpmCongressCharter;
  delete copy.gpmFactionPolitics;
  if (copy.outreach) copy.outreach.project = null;

  if (copy.organization && share !== null) {
    const treasury = NI(copy.organization.treasuryM);
    const reserved = partyForeignFundingGrants(party.gpmForeignFunding)
      .reduce((sum, grant) => sum + NI(grant.unspentM), 0);
    copy.organization.treasuryM = Math.floor(Math.max(0, treasury - reserved) * share) / Xu;
    const activists = Math.round((copy.organization.activistsK || 0) * 1000);
    copy.organization.activistsK = Math.floor(activists * share) / 1000;
  }
  return copy;
}

function gpmCommitCountryBirthParties(parent, child, founderId, share) {
  if (typeof founderId === "string") return;
  for (const copy of child.pol?.parties || []) {
    if (!copy.organization) continue;
    const previous = K0(parent, copy.id);
    const organization = previous?.organization;
    if (!organization) continue;
    gpmDomesticMoveMembers(previous, copy, share);
    organization.treasuryM = (NI(organization.treasuryM) - NI(copy.organization.treasuryM)) / Xu;
    organization.activistsK = Oq(organization.activistsK - copy.organization.activistsK);
  }
}

module.exports = { version, patchRenderer, patchWorker, sha256 };

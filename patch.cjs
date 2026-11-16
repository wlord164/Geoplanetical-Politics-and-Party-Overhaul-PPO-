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

const version = "1.1.4";
const rendererHash = "a6192a73e70c0eab556629f4917a6a74b8ef582bf8bc339bc58420bfb30103d9";
const workerHash = "b6c6f5385c43515d9c10dfd920f98ba76da45fdba83575ab3d62c064e41a21f0";
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
  const id = party?.nameDesc?.gpmDeclaredIdeology || party?.nameDesc?.gpmIdeologyPreset;
  if (Object.hasOwn(gpmPresets, id)) return gpmPresets[id].label;
  return estimatePartyIdeology(party?.ideology) ?? o("pol.family." + PR(party));
}

function partyIdeologyBadge(party) {
  const presetId = party.nameDesc?.gpmDeclaredIdeology || party.nameDesc?.gpmIdeologyPreset;
  const preset = Object.hasOwn(gpmPresets, presetId) ? gpmPresets[presetId] : null;
  const label = partyIdeologyLabel(party);
  const tooltip = label !== preset?.label && estimatePartyIdeology(party.ideology) ? ' data-tip="Estimated from the party’s four current ideology scores."' : "";
  const historical = party.nameDesc?.gpmHistoricalIdeology;
  const historicalEquivalent = party.nameDesc?.gpmHistoricalIdeologyEquivalent;
  const founding = historical || historicalEquivalent
    ? (historical ? `<small>Historical ideology · ${v(historical)}</small>` : "") +
      (historicalEquivalent ? `<small>PPO equivalent · ${v(historicalEquivalent)}</small>` : "")
    : preset ? (label !== preset.label ? `<small>Founding preset · ${v(preset.label)}</small>` : "") +
      (preset.program ? `<small>${v(preset.program)}</small>` : "") : "";
  return `<span class="gpm-party-ideology"${tooltip}>${v(label)}${founding}</span>`;
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
      tagField.value = party ? party.nameDesc?.gpmTag ?? q0(party, parties, countryKey) : "";
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
      if (start.disabled || !ge.setupPlayerControlIntent?.()?.partyId || !ge.setupSeedIntent?.()) {
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
    const session = Ge;
    const { countryKey, partyId, campaignId, controlRevision } = session?.playerControl || {};
    if (!partyId || !countryKey) return;
    const isCurrent = () => {
      const current = session.playerControl;
      return Ge === session && current?.partyId === partyId && current.countryKey === countryKey &&
        current.campaignId === campaignId && current.controlRevision === controlRevision;
    };
    openingRename = trigger.disabled = true;
    trigger.parentElement.querySelector("[data-gpm-rename-error]")?.remove();
    try {
      const view = await session.queryView("politics.country");
      if (!isCurrent() || !document.querySelector('[data-gpm-rename]')) return;
      const parties = view?.player?.pol?.parties || [];
      if (view?.player?.key !== countryKey || !parties.some(party => party.id === partyId)) throw new Error("Your party could not be loaded.");
      partyDialog({
        parties, selectedPartyId: partyId, countryKey,
        submit: async draft => {
          if (!isCurrent()) throw new Error("The active campaign or party changed.");
          const result = await Le(session, "applyPlayerAction", [{
            verb: "gpm.party.rename", countryKey, expectedPartyId: partyId,
            expectedCampaignId: campaignId, expectedControlRevision: controlRevision,
            targetPartyId: draft.targetPartyId, rename: { name: draft.name, tag: draft.tag },
          }]);
          if (!result?.ok) {
            throw new Error(result?.reason === "name"
              ? "Enter a name of 1–100 characters and an optional abbreviation of up to 24 characters."
              : "The selected party could not be renamed. Close the dialog and try again.");
          }
          if (Ge === session) ge.refreshTab?.(session);
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
  const control = un(sim);
  if (!country || country !== sim.player || country.key !== input.countryKey || control.countryKey !== country.key ||
      !control.partyId || input.expectedPartyId !== control.partyId || !ES(country, control.partyId) ||
      (input.expectedCampaignId !== undefined && input.expectedCampaignId !== control.campaignId) ||
      (input.expectedControlRevision !== undefined && input.expectedControlRevision !== control.controlRevision)) {
    return { ok: false, reason: "party" };
  }
  const targetId = input.targetPartyId === undefined ? control.partyId : input.targetPartyId;
  if (typeof targetId !== "string" || !targetId) return { ok: false, reason: "party" };
  const party = ES(country, targetId);
  if (!party) return { ok: false, reason: "party" };
  const descriptor = party.nameDesc || {};
  if (descriptor.gpmName === identity.name && descriptor.gpmTag === identity.tag) return { ok: true, changed: false };
  // Keep the founding status separate from the display name, including for generated party IDs.
  const origin = /^np\d+$/.test(party.id) ? { gpmFounded: isCustomParty(party) } : {};
  party.nameDesc = { ...descriptor, ...origin, gpmName: identity.name, gpmTag: identity.tag };
  return { ok: true, changed: true };
}

function registerPartyRename() {
  Xgt("gpm.party.rename", { apply: renameDomesticParty });
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
  const previous = w1o(politics.parties);
  const change = zfa(politics, ideology, seedSupport, (party, parties) => {
    ufa(party, Il(country.key), (country.hash ^ sim.rngSeed0) >>> 0, parties);
    party.nameDesc = { ...party.nameDesc, gpmName: identity.name, gpmTag: identity.tag, gpmFounded: true };
    if (preset) party.nameDesc.gpmDeclaredIdeology = draft.ideologyPreset;
    if (presetMatches) party.nameDesc.gpmIdeologyPreset = draft.ideologyPreset;
  });
  bKa(country, change, previous);
  _fa(country, change, previous);
  sim._reconcilePolity(country);
  const party = ES(country, change.id);
  if (!party) throw new Error("The new party was not registered");
  if (preset) gpmRecordPartyIdentity(party, draft.ideologyPreset);
  const hasSeats = (politics.chambers || []).some(chamber => (chamber.composition?.[party.id] || 0) > 0);
  if (!(party.support > 0 && party.support <= supportCap + 1e-9) || hasSeats ||
      !politics.parties.some(incumbent => incumbent.id !== party.id && incumbent.support > party.support)) {
    throw new Error("The new party did not qualify for a fair starting position");
  }
  if (sim.people) FSa(sim, country, sim._simYear || 2026);
  const founding = gpmApplyCampaignFounding(sim, country, party, rules, rules);
  sim.gpmCampaignFounding = { countryKey: country.key, partyId: party.id, ...founding };
  const result = sim.switchPlayerControl({ countryKey: country.key, partyId: change.id });
  if (!result?.ok) throw new Error(`Could not lead the new party (${result?.reason || "unknown"})`);
  const control = un(sim);
  if (control.controlsExecutive || control.controlsCabinet || control.heldOfficeIds.length) {
    throw new Error("The new party unexpectedly received a government office");
  }
}

function gpmApplyEmergingPartyFounding(sim, country, change) {
  if (change.type !== "emerge") return;
  const party = pW(country, change.id);
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
  const countryName = 'function Ohe(e){let t=Uu[J6];';
  js = replaceOnce(js, countryName, `function gpmOfficialCountryName(key) {
    return J6 === "en" && Object.hasOwn(gpmOfficialCountryNames, key) ? gpmOfficialCountryNames[key] : null;
  }
  function Ohe(e){
    const officialName = typeof e === "string" && e.startsWith("country.") ? gpmOfficialCountryName(e.slice(8)) : null;
    if (officialName) return officialName;
    let t=Uu[J6];`);
  const savedCountryName = '!Object.hasOwn(a,"customName")&&a.name?a.name:td(a.key||e.playerKey,a.name||t)';
  js = replaceOnce(js, savedCountryName,
    '!Object.hasOwn(a,"customName")&&a.name&&!(gpmOfficialCountryName(a.key||e.playerKey)&&aR(a.key||e.playerKey).includes(a.name))?a.name:td(a.key||e.playerKey,a.name||t)');
  js = replaceOnce(js, 'function Sa(e,t=e?.countryKey){', 'function Sa(e,t=e?.countryKey){if(e?.nameDesc?.gpmName)return e.nameDesc.gpmName;');
  js = replaceOnce(js, 's=i?y7(`${i}:${r.id}`)?.tag:null;s&&n.add(s)', 's=r.nameDesc?.gpmName?r.nameDesc.gpmTag:i?y7(`${i}:${r.id}`)?.tag:null;s&&n.add(s)');
  js = replaceOnce(js, 'c=s?.tag||Cgt(l,n);n.add(c)', 'c=(r.nameDesc?.gpmName?r.nameDesc.gpmTag:s?.tag)||Cgt(l,n);n.add(c)');
  const button = '<div class="mp-vd-name">${v(a?Sa(a):s)}</div>';
  js = replaceOnce(js, button, button + '${a?`<button type="button" class="k" data-gpm-rename>Rename Party</button><div class="gpm-my-ideology">${partyIdeologyBadge(a)}</div>`:""}');
  js = replaceOnce(js, '<span>${o("pol.family."+PR(i))}</span>', '${partyIdeologyBadge(i)}');
  js = replaceOnce(js, '<div class="pa-axis" data-tip="${v(k)}"><div><span>${o(`political.ideology.${b}.neg`)}</span>', '<div class="pa-axis" data-tip="${v(k)}"><div><span>${o(`political.ideology.${b}.neg`)}</span><b class="gpm-axis-score">${partyAxisScore(i.ideology?.[b])}</b>');
  js = replaceOnce(js, 'f=p?"pol.family."+PR(p):"",g="pol.role."+(d.role==="partner"?"coalition":d.role),y=[d.id===n?"myparty.hero.titleParty":f,g].filter(_=>nt(_)).map(_=>o(_))', 'f=p?partyIdeologyLabel(p):"",g="pol.role."+(d.role==="partner"?"coalition":d.role),y=[d.id===n?o("myparty.hero.titleParty"):f,nt(g)?o(g):""].filter(Boolean)');
  js = replaceOnce(js, 'tt("btn-start").addEventListener("click",()=>', `let gpmNewParty = null;\nconst gpmCampaignRulesUI = ${JSON.stringify({ presets: campaignRules.presets, sections: campaignRules.sections })};\nconst gpmCampaignRulesStyle = ${JSON.stringify(setupStyle)};\n${setupFunctions.join("\n")}\nconst gpmAxes = ${JSON.stringify(axes)};\nconst gpmPresets = ${JSON.stringify(presets)};\n${estimatePartyIdeology}\n${partyIdeologyLabel}\n${partyIdeologyBadge}\n${partyAxisScore}\n${setupIdeology}\n${partyDialog}\n${mountPartyButtons}\n${bindElectorateWidth}\n${congressDoctrines.join("\n")}\n${congressVoting.join("\n")}\n${congressRenderer.join("\n")}\n${supportRenderer.join("\n")}\n${renderPartyProfile}\n${bindPartyProfile}\n${organizingRenderer.join("\n")}\nmountPartyButtons();\ntt("btn-start").addEventListener("click",()=>`);
  const partyCard = '${this._mpVerdictHtml(t,d,p,m)}</div>';
  js = replaceOnce(js, partyCard, partyCard + '\n      ${renderPartyProfile(t,p,this)}\n      <div class="wide mp-reading" data-mp-reading="gpm-organizing">${renderPartyOrganizing(t,this)}</div>');
  js = replaceOnce(js, 'this._mpWire(e,t),mU(this,e,t)', 'this._mpWire(e,t),bindPartyProfile(e,t,p,this),bindPartyOrganizing(e,t,this),mU(this,e,t)');
  js = replaceOnce(js, '"data-bill-line","data-party-activity"].find(y=>a?.hasAttribute(y))', '"data-bill-line","data-party-activity","data-gpm-congress-size","data-gpm-congress-bargain","data-gpm-congress-priority","data-gpm-congress-vote","data-gpm-congress-priority-vote","data-gpm-profile-focus"].find(y=>a?.hasAttribute(y))');
  const refresh = 'this._mpRefreshReading(t,"identity",this._mpVerdictHtml(e,a,c,r))';
  js = replaceOnce(js, refresh, `${refresh},this._mpRefreshReading(t,"gpm-support",renderPartySupportBase(e,this)),this._mpRefreshReading(t,"gpm-organizing",renderPartyOrganizing(e,this)),bindPartyProfile(t,e,c,this),bindPartyOrganizing(t,e,this)`);
  js = replaceOnce(js, 'GHe(bM,null,"new",!1,e,void 0,a)', 'GHe(bM,null,"new",!1,{...e,partyModRules:gpmCampaignRulesForStart(),...gpmNewParty?{partyModCreate:gpmNewParty}:{}},void 0,a)');
  js = replaceOnce(js, 'playerControl:{partyId:a.partyId}', 'playerControl:{partyId:a.partyId,partyModRules:a.partyModRules,...a.partyModCreate?{partyModCreate:a.partyModCreate}:{}}');
  js = replaceOnce(js, '_bPolElectorat(e,t){', '_bPolElectorat(e,t){bindElectorateWidth(e);');
  js = replaceOnce(js, 'let w=S.top||[],k=Math.max(0,1-w.reduce((L,O)=>L+O.v,0))', 'let w=S.votes||S.top||[],k=S.votes?0:Math.max(0,1-w.reduce((L,O)=>L+O.v,0))');
  js = replaceOnce(js, 'w.map(L=>{let O=Math.round(L.v*100);', 'w.map(L=>{let O=L.v*100;');
  js = replaceOnce(js, '${v(i(L.id))} \\xB7 ${z(O)}', '${v(i(L.id))} \\xB7 ${z(O,!1,2)}');
  js = replaceOnce(js, 'this._chipById(n,L.id,{win:O===0})}<b class="num">${z(Math.round(L.v*100))}', 'this._chipById(n,L.id,{win:O===0})}<b class="num">${z(L.v*100,!1,2)}');
  js = patchLawLabels(js, replaceOnce);
  js = replaceOnce(js, "\nmountPartyButtons();\n", `\nconst gpmRegionalMapStyle = ${JSON.stringify(regionalMapStyle)};\nconst gpmForeignFundingStyle = ${JSON.stringify(fundingStyle)};\n${regionalRenderer.join("\n")}\n${fundingRenderer.join("\n")}\nconst gpmLawShortlistStyle = ${JSON.stringify(lawShortlistStyle)};\n${lawShortlistRenderer.join("\n")}\nmountPartyButtons();\n`);
  js = replaceOnce(js, 'Eg("publicFacilityPlannerActive","closePublicFacilityPlanner")',
    'Eg("publicFacilityPlannerActive","closePublicFacilityPlanner"),Eg("gpmRegionalActive","closeGpmRegionalMap")');
  js = replaceOnce(js, 'if(ln!=="game")return;if(ge.warRoomActive)', 'if(ln!=="game")return;if(gpmRegionalGlobeClick(ge,t))return;if(ge.warRoomActive)');
  js = replaceOnce(js, '_refreshTabUnsafe(e=null){', '_refreshTabUnsafe(e=null){gpmRefreshRegionalMap(this);');
  js = replaceOnce(js, 'showScreen(e){for(let t of document.querySelectorAll(".screen"))',
    'showScreen(e){if(e!=="game")gpmCloseRegionalMap(this);for(let t of document.querySelectorAll(".screen"))');
  js = replaceOnce(js, '${this._mpAdvRulerHtml(n)}',
    '${this._mpAdvRulerHtml(n)}<small data-gpm-spending-preview style="white-space:pre-line">${v(gpmCampaignSpendingText(n,this))}</small>');
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
  return Buffer.from(patchPartyDomesticRenderer(js, replaceOnce));
}

function patchWorker(bytes) {
  if (sha256(bytes) !== workerHash) throw new Error(`Unsupported Geoplanetical simulation. This mod targets ${version}.`);
  let js = bytes.toString("utf8");
  js = patchHistoricalOpeningTopology(js, replaceOnce, "worker");
  js = replaceOnce(js, "function H_t(){",
    readFileSync(join(__dirname, "historical-province-climate.js"), "utf8") + "\nfunction H_t(){");
  js = replaceOnce(js, "jra(b,P.climate,P.provinces,R)",
    "jra(b,P.climate,gpmHistoricalClimateProvinceMap(b.world,P.provinces),R)");
  js = replaceOnce(js, 'throw new Error("natural-hazards:world-missing");let t=new Set',
    'throw new Error("natural-hazards:world-missing");gpmHistoricalProvinceHazards(e.world,ent);let t=new Set');
  js = replaceOnce(js, "function oua(e){let t={};",
    readFileSync(join(__dirname, "historical-province-transport.js"), "utf8") +
    "\nfunction oua(e){gpmHistoricalProvinceTransport(e.world,Kce);let t={};");
  js = replaceOnce(js, "function iua(e,t,a=null){let r=rua(t);gIe(r);",
    "function iua(e,t,a=null){let r=rua(t);gIe(r);gpmHistoricalProvinceTransport(e.world,Kce,r.byProvince);");
  js = replaceOnce(js, 'async function wIt(e,t,a=[]){', `${campaignRules.declarations.join("\n")}\n${campaignFounding.join("\n")}\n${domesticForecast.join("\n")}\nconst gpmAxes = ${JSON.stringify(axes)};\nconst gpmPresets = ${JSON.stringify(presets)};\n${estimatePartyIdeology}\n${validatePartyName}\n${renameDomesticParty}\n${registerPartyRename}\n${ideologyIdentityWorker.join("\n")}\n${createStartingParty}\n${organizingWorker.join("\n")}\n${congressWorker.join("\n")}\n${congressDoctrines.join("\n")}\n${congressVoting.join("\n")}\n${congressVoteWorker.join("\n")}\n${supportWorker.join("\n")}\n${aiWorker.join("\n")}\n${advancePartyModDay}\n${retirePartyCongresses}\n${partyOrganizationForMerger}\nregisterPartyRename();\nregisterPartyOrganizing();\nregisterPartyCongressSize();\nasync function wIt(e,t,a=[]){`);
  js = replaceOnce(js, 'yield"domestic.weekly"),t.has(tr.WEEKLY_POLITICS)', 'yield"domestic.weekly"),we("advancePartyModDay",()=>advancePartyModDay(e)),t.has(tr.WEEKLY_POLITICS)');
  js = replaceOnce(js, 'organization:t.organization?structuredClone(t.organization):null,campaigns:',
    'organization:partyOrganizationForMerger(t),funding:t.gpmForeignFunding?structuredClone(t.gpmForeignFunding):null,domestic:t.gpmDomestic?.membership?{membership:structuredClone(t.gpmDomestic.membership)}:null,currents:t.gpmCongressCurrents?structuredClone(t.gpmCongressCurrents):null,campaigns:');
  js = replaceOnce(js, 'bKa(t,n,s),_fa(t,n,s),',
    'bKa(t,n,s),_fa(t,n,s),gpmTransferPartyLifecycle(e,t,n,s),');
  js = replaceOnce(js, 'w.pol.parties=(i.pol.parties||[]).map(k=>({...JSON.parse(JSON.stringify(k)),campaigns:{},parliament:{lastProposalDay:null,lastConfidenceDay:null}}))',
    'w.pol.parties=(i.pol.parties||[]).map(k=>gpmPartyForCountryBirth(k,typeof t.gpmUprisingFounderId==="string"?null:P))');
  js = replaceOnce(js, 'e.people&&e2t(e,w),I&&(I.__bornIdentity=FM(KNe(w,I))),w}function kvo',
    'e.people&&e2t(e,w),I&&(I.__bornIdentity=FM(KNe(w,I))),gpmCommitCountryBirthParties(i,w,t.gpmUprisingFounderId,P),w}function kvo');
  js = replaceOnce(js, 'registerPartyOrganizing();\nregisterPartyCongressSize();',
    `${gpmTransferPartyLifecycle}\n${gpmPartyForCountryBirth}\n${gpmCommitCountryBirthParties}\nregisterPartyOrganizing();\nregisterPartyCongressSize();`);
  js = replaceOnce(js, 'function iTa(e,t){return wfa(e,t),KOa(e,t),e._reviewPartyParliamentAi(t)}', 'function iTa(e,t){return gpmBindCampaignPolity(e,t.pol),wfa(e,t),KOa(e,t),advancePartyModAI(e,t),e._reviewPartyParliamentAi(t)}');
  // Preserve existing balances and exact refunds in base currency units.
  js = replaceOnce(js, 'a.treasuryM=xG(yE(a.treasuryM||0,0,1e4))', 'a.treasuryM=xG(yE(a.treasuryM||0,0,1e4),6)');
  js = replaceOnce(js, 'Bu=1e3,ope=1e4,tKa=10', 'Bu=1e6,ope=1e4,tKa=10');
  js = replaceOnce(js, 'var oKa=1e8/1e3,D0o=oKa/Bu', 'var oKa=Bu,D0o=oKa/Bu');
  js = replaceOnce(js, 'n.organization.treasuryM=dW(n.organization.treasuryM-o.cost.budgetM)', 'n.organization.treasuryM=partyForeignFundingTreasury(n,xG(n.organization.treasuryM-o.cost.budgetM,6))');
  js = replaceOnce(js, 'n.treasuryM=iq(re(s4(n.treasuryM),s4(i)))', 'n.treasuryM=partyForeignFundingTreasury(o,iq(re(s4(n.treasuryM),s4(i))))');
  js = replaceOnce(js, 'i.treasuryM=iq(re(s4(i.treasuryM),s4(s)))', 'i.treasuryM=partyForeignFundingTreasury(Nu(t,a),iq(re(s4(i.treasuryM),s4(s))))');
  js = replaceOnce(js, 'c.organization.treasuryM=f/Bu,u.organization.treasuryM=y/Bu',
    'c.organization.treasuryM=partyForeignFundingTreasury(c,f/Bu),u.organization.treasuryM=y/Bu');
  js = replaceOnce(js, 'n.treasuryM=u/Bu,n.activistsK=xn(n.activistsK*.75)',
    'n.treasuryM=partyForeignFundingTreasury(Nu(e,t.parent),u/Bu),n.activistsK=xn(n.activistsK*.75)');
  js = replaceOnce(js, 'I*=ylt(b,p.id)', 'I*=ylt(b,p.id)*partyOrganizingWeight(b,p.id)');
  js = replaceOnce(js, 'function FDa(e,t,a){return _Ce(e.parties,[{share:1,', 'function FDa(e,t,a){return _Ce(e.parties,[{id:t.id,share:1,');
  js = replaceOnce(js, 'function mHo({querySim:e,country:t,partyId:a}){', 'function mHo({querySim:e,country:t,partyId:a},gpmElectorate,gpmFunding){');
  js = replaceOnce(js, 'function l3r(e){let t=e?.player;', 'function l3r(e){let gpmElectorate,t=e?.player;');
  js = replaceOnce(js, 'electorate:Fr(o._electorateBreakdown(n)),electoral:', 'electorate:(gpmElectorate=Fr(o._electorateBreakdown(n))),electoral:');
  js = replaceOnce(js, 'party:mHo(r)}}var fHo', 'party:mHo(r,gpmElectorate,partyForeignFundingView(e,t,r.partyId))}}var fHo');
  js = replaceOnce(js, 'outreach:Ifa(e,t,a),negotiations:xOa(e,t,a)', 'outreach:Ifa(e,t,a),organizing:partyOrganizingView(e,t,a),congress:partyCongressView(e,t,a,gpmElectorate),supportBase:partySupportBaseView(e,t,a,gpmElectorate),negotiations:xOa(e,t,a)');
  js = replaceOnce(js, 'function M1o(e,t){', `${isCustomParty}\n${gpmApplyEmergingPartyFounding}\nfunction M1o(e,t){`);
  js = replaceOnce(js, 'n=zfa(a,f,m*.55,u)', 'n=zfa(a,f,gpmFoundingSupportSeed(a,gpmCampaignRulesFor(e)),u)');
  js = replaceOnce(js, 'e._reconcilePolity(t),t._landscapeCd=24',
    'e._reconcilePolity(t),gpmApplyEmergingPartyFounding(e,t,n),t._landscapeCd=24');
  js = replaceOnce(js, 'if((y.support||0)<.06&&(h.support||0)<.06&&vm(y.ideology,h.ideology)<.35)', 'if(!isCustomParty(y)&&!isCustomParty(h)&&(y.support||0)<.06&&(h.support||0)<.06&&vm(y.ideology,h.ideology)<.35)');
  js = replaceOnce(js, 'let m=i.find(f=>(f._starve||0)>=24);', 'let m=i.find(f=>!isCustomParty(f)&&(f._starve||0)>=24);');
  js = replaceOnce(js, 'this.sim=b,t.profileWorldTrade===!0', 'this.sim=b,o?retirePartyCongresses(b):t.playerControl?.partyModCreate&&createStartingParty(b,t.playerControl.partyModCreate),t.profileWorldTrade===!0');
  js = replaceOnce(js, 'comp:e.nameDesc.comp||null}:null}function v3r', 'comp:e.nameDesc.comp||null,gpmName:e.nameDesc.gpmName||null,gpmTag:e.nameDesc.gpmTag||null,gpmIdeologyPreset:e.nameDesc.gpmIdeologyPreset||null,gpmDeclaredIdeology:e.nameDesc.gpmDeclaredIdeology||null,gpmHistoricalIdeology:e.nameDesc.gpmHistoricalIdeology||null,gpmHistoricalIdeologyEquivalent:e.nameDesc.gpmHistoricalIdeologyEquivalent||null}:null}function v3r');
  js = replaceOnce(js, 'top:d.slice(0,3).map(([f,y])=>({id:f,v:y}))', 'top:d.slice(0,3).map(([f,y])=>({id:f,v:y})),votes:d.map(([f,y])=>({id:f,v:y}))');
  js = patchLawVoteSnapshots(js, replaceOnce);
  js = replaceOnce(js, "registerPartyCongressSize();\nasync function wIt",
    `registerPartyCongressSize();\nconst gpmRegionalRules = ${JSON.stringify(regionalRules)};\n${regionalWorker.join("\n")}\n${fundingWorker.join("\n")}\n${lawShortlistWorker.join("\n")}\nregisterPartyRegionalCampaign();\nregisterPartyForeignFunding();\n${congressCurrents.join("\n")}\n${congressCharter.join("\n")}\nregisterPartyCongressCurrents();\nregisterPartyCongressCharter();\nasync function wIt`);
  js = replaceOnce(js, 'id:r.__provId,name:r.__name||"",pop:r.__pop||0,lean:r.__lean}));return{regions:a,partyPerf:',
    'id:r.__provId,key:r.__provKey,name:r.__name||"",pop:r.__pop||0,lean:r.__lean}));return{regions:a,day:e.day||0,partyPerf:');
  js = replaceOnce(js, 'function CCe(e,t,a=null){', 'function CCe(e,t,a=null,gpmApplyRegions=true){');
  js = replaceOnce(js, 'return{id:p.id,name:p.name||"",pop:p.pop||0,shares:Bfa',
    'return{id:p.id,key:p.key,name:p.name||"",pop:p.pop||0,shares:Bfa');
  js = replaceOnce(js, 'if(m>0)for(let h in p.shares)p.shares[h]/=m;let f=null,y=-1;',
    'if(m>0)for(let h in p.shares)p.shares[h]/=m;if(gpmApplyRegions)p.shares=partyRegionalShares(e,p.shares,p.key,t.day);let f=null,y=-1;');
  js = replaceOnce(js, 'function T_a(e,t){let a=t.pol;if(!a)return;', 'function T_a(e,t){let a=t.pol;if(!a)return;gpmBindCampaignPolity(e,a);');
  js = replaceOnce(js, 'countries.set(i.key,i);let c=[],u=(v,b,S)=>',
    'countries.set(i.key,i);gpmBindCampaignPolity(e,i.pol);let c=[],u=(v,b,S)=>');
  // Regional seat rules use the adjusted local shares. National rules use their population-weighted change.
  js = replaceOnce(js, 'function _x(e,t,a=null){let r=a?.kind||null', 'function _x(e,t,a=null,gpmForecast=null){let r=a?.kind||null');
  js = replaceOnce(js, 'd=u&&c.score||0,p=W3t(l,d,q0o(e,t,l,u?c:null));',
    'd=gpmForecast?.partyId===l.id?gpmForecast.score:u&&c.score||0,p=W3t(gpmForecast?.base?{...l,support:gpmForecast.base[l.id]??l.support}:l,d,q0o(e,t,l,u?c:null));');
  js = replaceOnce(js, 'let l=Ix(t,i,e.day||0,o.contestId||null);return ipe(e,t,a,l,o)',
    'let l=Ix(t,i,e.day||0,o.contestId||null);return partyCampaignSpendPreview(e,t,a,l,o)');
  js = replaceOnce(js, 'if(s.transfer)return kYr(s,t,a,{rulingId:r,rig:SCe(e,o),polity:n,electoralMap:i});let l={},c=0;',
    'if(s.transfer)return kYr(s,t,a,{rulingId:r,rig:SCe(e,o),polity:n,electoralMap:i});if(n&&["direct","equal-per-state","delegated"].includes(e.selectMode||"direct"))t=partyRegionalNationalShares(n,i,t);let l={},c=0;');
  js = replaceOnce(js, 'let M=xfa(w,I,e.apportionment);for(let _ in M)',
    'let M=xfa(w,I,e.apportionment);if(i?.gpmDistrictSeats)i.gpmDistrictSeats.set(S.id,{total:I,seats:M});for(let _ in M)');
  js = replaceOnce(js, 'd=g=>{let v=klt(c,g),b={};',
    'd=g=>{i?.gpmDistrictSeats?.clear();let v=klt(c,g),b={};');
  js = replaceOnce(js, 'reportOrder:[]},_=r.parties.filter(Z=>b[Z.id]!=null).map(Z=>({id:Z.id,votes:Math.max(0,S[Z.id]||0)}))',
    'reportOrder:[]},gpmNational=partyRegionalNationalShares(r,Lx(e,t),S),_=r.parties.filter(Z=>b[Z.id]!=null).map(Z=>({id:Z.id,votes:Math.max(0,gpmNational[Z.id]||0)}))');
  js = replaceOnce(js, 'u=j3t(e,t,c,i),d={day:i,electionDay:r.nextDay,kind:o,contestId:n,values:u}',
    'u=j3t(e,t,partyRegionalNationalShares(t.pol,Lx(e,t),c),i),d={day:i,electionDay:r.nextDay,kind:o,contestId:n,values:u}');
  js = replaceOnce(js, 'congress:partyCongressView(e,t,a,gpmElectorate),supportBase:',
    'congress:partyCongressView(e,t,a,gpmElectorate),regionalCampaign:partyRegionalCampaignView(e,t,a),foreignFunding:gpmFunding,supportBase:');
  js = replaceOnce(js, 'Hqe(r,a,t.params||{})',
    '(a==="gpm.foreignFunding"?partyForeignFundingDirectory(r,t.params||{}):a==="gpm.partyLawShortlist"?partyLawShortlist(r):Hqe(r,a,t.params||{}))');
  // Publish only the funding summary, never the stored outcome rolls or exposure day.
  js = replaceOnce(js, 'n.pol.parties=s3r(t.pol);',
    'n.pol.parties=s3r(t.pol).map(({gpmForeignFunding,...party})=>party);');
  const { patchHistoricalConflictsWorker } = require("./historical-conflicts.cjs");
  const { patchHistoricalNameWorker } = require("./historical-identities.cjs");
  let historical = replaceOnce(patchHistoricalConflictsWorker(patchUprisingWorker(js, replaceOnce), replaceOnce),
    'this.sim=b,!o&&gpmUprising.captureStartingIdentities(b),o?retirePartyCongresses(b)',
    'this.sim=b,gpmInitializeCampaignRules(b,t.playerControl?.partyModRules,o),gpmMigrateDomesticCampaign(b),o&&(gpmMigrateFactionDoctrines(b),gpmCongressMigrateCurrents(b)),!o&&gpmUprising.captureStartingIdentities(b),o?retirePartyCongresses(b)');
  historical = replaceOnce(historical, '(a==="gpm.historicalMap"?',
    '(a==="gpm.campaignRules"?{rules:gpmCampaignRulesFor(r),founding:r.gpmCampaignFounding??null}:a==="gpm.partyCampaignPlanForecast"?partyCampaignPlanForecast(r,r.player,cn(r.player),t.params?.contestId):a==="gpm.historicalMap"?');
  const { patchWorkingCapital } = require("./working-capital.cjs");
  const { patchTerritorialPayroll } = require("./territorial-payroll.cjs");
  historical = patchWorkingCapital(historical, replaceOnce);
  historical = patchTerritorialPayroll(historical, replaceOnce);
  let worker = patchHistoricalNameWorker(patchSudanReunificationWorker(historical, replaceOnce), replaceOnce);
  worker = patchDomesticWorker(worker, replaceOnce);
  worker = patchAgreementWorker(worker, replaceOnce);
  worker = replaceOnce(worker, 'regionalCampaign:partyRegionalCampaignView(e,t,a),',
    'regionalCampaign:partyRegionalCampaignView(e,t,a),agreement:partyAgreementView(e,t,a),');
  // Source the controlled party's summary before the public party roster strips its private state.
  worker = replaceOnce(worker, 'function mHo({querySim:e,country:t,partyId:a},gpmElectorate,gpmFunding){',
    'function mHo({querySim:e,country:t,partyId:a},gpmElectorate,gpmFunding,gpmPlan){');
  worker = replaceOnce(worker, 'campaignPlan:gpmDomesticView(e,t,a),', 'campaignPlan:gpmPlan,');
  worker = replaceOnce(worker, 'party:mHo(r,gpmElectorate,partyForeignFundingView(e,t,r.partyId))',
    'party:mHo(r,gpmElectorate,partyForeignFundingView(e,t,r.partyId),{...gpmDomesticView(e,t,r.partyId),agenda:gpmDomesticAgenda(e,t,r.partyId),recentResult:gpmPartyElectionRecapView(t,r.partyId)})');
  worker = replaceOnce(worker, ',situation:OLe(e,a),space:e.space?yae(e,a.key,void 0,{attentionOnly:!0}):null,pressures:mUo(e,a),technology:',
    ',situation:OLe(e,a),gpmDomesticAgenda:gpmDomesticAgenda(e,a,cn(a)),space:e.space?yae(e,a.key,void 0,{attentionOnly:!0}):null,pressures:mUo(e,a),technology:');
  worker = replaceOnce(worker, 'e._onLegislative(t,i,p,g,d,b)?.electionResolved===!0?e._politicalCampaigns.delete(u):i.composition=p',
    '(()=>{const recap=gpmPartyElectionRecap(e,t,i,m,p,d,s);if(e._onLegislative(t,i,p,g,d,b)?.electionResolved===!0){e._politicalCampaigns.delete(u);gpmStorePartyElectionRecap(t,recap)}else i.composition=p})()');
  worker = replaceOnce(worker, '({gpmUprisingPreparations,gpmForeignFunding,...a})',
    '({gpmUprisingPreparations,gpmForeignFunding,gpmDomestic,...a})');
  worker = replaceOnce(worker, 's3r(t.pol).map(({gpmForeignFunding,...party})=>party)',
    's3r(t.pol).map(({gpmForeignFunding,gpmDomestic,...party})=>party)');
  worker = replaceOnce(worker, 'registerPartyRename();',
    `${factionPeople.join("\n")}\n${factionBargaining.join("\n")}\n${factionDevelopment.join("\n")}\nregisterPartyFactionBargaining();\nregisterPartyRename();`);
  worker = replaceOnce(worker, 'a==="gpm.campaignRules"?',
    'a==="gpm.partyFactionQuote"?gpmFactionQuote(r,r.player,pW(r.player,cn(r.player)),t.params||{},"player"):a==="gpm.campaignRules"?');
  worker = replaceOnce(worker, 'function mHo({querySim:e,country:t,partyId:a},gpmElectorate,gpmFunding,gpmPlan){',
    'function mHo({querySim:e,country:t,partyId:a},gpmElectorate,gpmFunding,gpmPlan,gpmFactionData){');
  worker = replaceOnce(worker, 'congress:partyCongressView(e,t,a,gpmElectorate),',
    'congress:gpmFactionData,');
  worker = replaceOnce(worker, 'recentResult:gpmPartyElectionRecapView(t,r.partyId)})',
    'recentResult:gpmPartyElectionRecapView(t,r.partyId)},gpmFactionCongressData(e,t,r.partyId))');
  worker = replaceOnce(worker, '({gpmUprisingPreparations,gpmForeignFunding,gpmDomestic,...a})',
    '({gpmUprisingPreparations,gpmForeignFunding,gpmDomestic,gpmFactionPolitics,gpmCharter,...a})');
  worker = replaceOnce(worker, 's3r(t.pol).map(({gpmForeignFunding,gpmDomestic,...party})=>party)',
    's3r(t.pol).map(({gpmForeignFunding,gpmDomestic,gpmFactionPolitics,gpmCharter,...party})=>party)');
  worker = patchFactionPeopleWorker(worker, replaceOnce);
  worker = patchFactionDevelopmentWorker(worker, replaceOnce);
  worker = replaceOnce(worker, 'jpe(this,this.player),a.changed&&(eDe(this),mNe(this))',
    'jpe(this,this.player),gpmFactionSeparatePartyLeader(this,this.player,pW(this.player,cn(this.player))),a.changed&&(eDe(this),mNe(this))');
  worker = require("./party-radicalization.cjs").patchPoliticalCrisisWorker(worker, replaceOnce);
  worker = replaceOnce(worker, 'const __geoWorker = typeof document ===',
    `${gpmActionMatchesActor}\nconst __geoWorker = typeof document ===`);
  const playerActionActor = 'let c=un(e);return Ne(e,e.player,{...s,speakerId:c.representativeId,partyId:c.partyId,roleId:c.parliamentaryRole})';
  // The host stamps the currently controlled actor, so validate the captured actor first.
  worker = replaceOnce(worker, playerActionActor,
    `let c=un(e);
    if(!gpmActionMatchesActor(s,c))return{ok:false,reason:"stale_actor",message:"Player control changed. Refresh this view and try again."};
    return Ne(e,e.player,{...s,speakerId:c.representativeId,partyId:c.partyId,roleId:c.parliamentaryRole})`);
  return Buffer.from(worker);
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
  organization.activistsK = dW(Math.min(1e5, organization.activistsK + reservedForOrganizing));
  const returnedFactionEscrow = (party.gpmFactionPolitics?.offers || []).reduce((cash, offer) =>
    offer.status === "accepted" ? cash + offer.cashM : cash, 0);
  if (returnedFactionEscrow) organization.treasuryM = gpmDomesticMoney(organization.treasuryM + returnedFactionEscrow);
  return organization;
}

function gpmTransferPartyLifecycle(sim, country, event, snapshots) {
  if (event.type === "split") {
    const parent = Nu(country, event.parent);
    const child = Nu(country, event.child);
    if (parent && child) gpmDomesticMoveMembers(parent, child, .25);
  }
  if (!event.gone || !event.into) return;
  const survivor = Nu(country, event.into);
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
    const treasury = xP(copy.organization.treasuryM);
    const reserved = partyForeignFundingGrants(party.gpmForeignFunding)
      .reduce((sum, grant) => sum + xP(grant.unspentM), 0);
    copy.organization.treasuryM = Math.floor(Math.max(0, treasury - reserved) * share) / Bu;
    const activists = Math.round((copy.organization.activistsK || 0) * 1000);
    copy.organization.activistsK = Math.floor(activists * share) / 1000;
  }
  return copy;
}

function gpmCommitCountryBirthParties(parent, child, founderId, share) {
  if (typeof founderId === "string") return;
  for (const copy of child.pol?.parties || []) {
    if (!copy.organization) continue;
    const previous = Nu(parent, copy.id);
    const organization = previous?.organization;
    if (!organization) continue;
    gpmDomesticMoveMembers(previous, copy, share);
    organization.treasuryM = (xP(organization.treasuryM) - xP(copy.organization.treasuryM)) / Bu;
    organization.activistsK = dW(organization.activistsK - copy.organization.activistsK);
  }
}

module.exports = { version, patchRenderer, patchWorker, sha256 };

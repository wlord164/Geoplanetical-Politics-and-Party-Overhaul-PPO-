const { patchUprisingWorker } = require("./party-uprising.cjs");
const { patchUprisingRenderer } = require("./party-uprising-ui.cjs");
"use strict";

const { createHash } = require("node:crypto");
const officialCountryNames = require("./party-official-country-names.cjs");
const { workerFunctions: organizingWorker, rendererFunctions: organizingRenderer } = require("./party-organizing.cjs");
const { workerFunctions: congressWorker } = require("./party-congress-model.cjs");
const { rendererFunctions: congressRenderer } = require("./party-congress.cjs");
const { sharedFunctions: congressVoting, workerFunctions: congressVoteWorker } = require("./party-congress-vote.cjs");
const { workerFunctions: supportWorker, rendererFunctions: supportRenderer } = require("./party-support-base.cjs");
const { workerFunctions: aiWorker } = require("./party-ai.cjs");
const { patchLawLabels, patchLawVoteSnapshots } = require("./party-law-labels.cjs");
const { workerFunctions: lawShortlistWorker } = require("./party-law-shortlist.cjs");
const { rules: regionalRules, workerFunctions: regionalWorker } = require("./party-regional-campaign.cjs");
const { style: regionalMapStyle, rendererFunctions: regionalRenderer } = require("./party-regional-map.cjs");
const { workerFunctions: fundingWorker } = require("./party-foreign-funding.cjs");
const { style: fundingStyle, rendererFunctions: fundingRenderer } = require("./party-foreign-funding-ui.cjs");
const { style: lawShortlistStyle, rendererFunctions: lawShortlistRenderer } = require("./party-law-shortlist-ui.cjs");

const version = "1.1.2";
const rendererHash = "ad4c79040ba28d87006fd72e8e335e1d2129a6866e9f9bb3d85fc948f52591e7";
const workerHash = "20a49734f11daa32d905dc9e07c7704d9d0aa73ab8dcc0902f6e81ce7e1be0bd";
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const startingSupport = .02;
const axes = [
  { id: "econ", title: "Economy", low: "Statist", high: "Market" },
  { id: "social", title: "Social policy", low: "Progressive", high: "Conservative" },
  { id: "gov", title: "Governance", low: "Liberal", high: "Authoritarian" },
  { id: "nat", title: "National outlook", low: "Globalist", high: "Nationalist" },
];
const presets = {
  center: { label: "Centrist", values: [0, 0, 0, 0] },
  socialDemocrat: { label: "Social Democrat", values: [-35, -40, -40, -20] },
  democraticSocialist: { label: "Democratic Socialist", values: [-75, -45, -55, -30] },
  councilCommunist: { label: "Council Communist", values: [-100, -65, -75, -55] },
  anarchoCommunist: { label: "Anarcho-Communist", values: [-100, -95, -100, -90] },
  marxistLeninist: { label: "Marxist–Leninist", values: [-95, -25, 80, -45] },
  hardlineStateSocialist: { label: "Hardline State Socialist", values: [-100, 0, 100, -15] },
  leftNationalist: { label: "Left Nationalist", values: [-65, 0, 40, 75] },
  green: { label: "Green", values: [-35, -80, -55, -60] },
  classicalLiberal: { label: "Classical Liberal", values: [75, -20, -70, -35] },
  anarchoCapitalist: { label: "Anarcho-Capitalist", values: [100, 0, -100, -35] },
  liberalConservative: { label: "Liberal Conservative", values: [55, 55, -45, 20] },
  conservative: { label: "Conservative", values: [40, 60, 10, 30] },
  paternalistConservative: { label: "Paternalist Conservative", values: [-20, 65, 15, 45] },
  nationalConservative: { label: "National Conservative", values: [30, 75, 40, 80] },
  religiousTraditionalist: { label: "Religious Traditionalist", values: [0, 100, 75, 30] },
  corporatistNationalist: { label: "Corporatist Nationalist", values: [-35, 85, 85, 90] },
  authoritarianUltranationalist: { label: "Authoritarian Ultranationalist", values: [0, 95, 100, 100] },
};

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
  return estimatePartyIdeology(party?.ideology) ?? o("pol.family." + Vx(party));
}

function partyIdeologyBadge(party) {
  const presetId = party.nameDesc?.gpmIdeologyPreset;
  const preset = Object.hasOwn(gpmPresets, presetId) ? gpmPresets[presetId] : null;
  const tooltip = estimatePartyIdeology(party.ideology) ? ' data-tip="Estimated from the party’s four current ideology scores."' : "";
  const founding = preset ? `<small>Founding preset · ${b(preset.label)}</small>` : "";
  return `<span class="gpm-party-ideology"${tooltip}>${b(partyIdeologyLabel(party))}${founding}</span>`;
}

function partyAxisScore(value) {
  if (!Number.isFinite(value) || Math.abs(value) > 1) return "—";
  const points = Math.round(Math.abs(value) * 100);
  if (!points) return "0";
  return `${value < 0 ? "−" : "+"}${points}`;
}

function setupIdeology(form) {
  const preset = form.elements.platform;
  for (const [id, entry] of Object.entries(gpmPresets)) preset.add(new Option(entry.label, id));
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
  const refreshEstimate = () => { estimate.textContent = `Estimated ideology · ${estimatePartyIdeology(readIdeology())}`; };
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

function partyDialog({ create, parties = [], selectedPartyId, submit }) {
  const dialog = document.createElement("dialog");
  dialog.className = "gpm-party-dialog";
  dialog.innerHTML = `<form>
    <h2>${create ? "Create Party" : "Rename Party"}</h2>
    ${create ? "" : '<label>Party<select name="targetParty"></select></label>'}
    <label>Party name<input name="partyName" required maxlength="100" autocomplete="off"></label>
    <label>Abbreviation<input name="partyTag" maxlength="24" autocomplete="off" placeholder="Optional"></label>
    ${create ? `<label>Ideology preset<select name="platform"></select></label><small data-ideology-estimate></small>
      <details data-ideology-details><summary>Adjust ideology</summary>
        ${gpmAxes.map(axis => `<div class="gpm-axis">
          <div><label for="gpm-axis-${axis.id}">${axis.title}</label><output for="gpm-axis-${axis.id}"></output></div>
          <input id="gpm-axis-${axis.id}" name="${axis.id}" type="range" min="-100" max="100" step="5" value="0">
          <div><span>${axis.low}</span><span>${axis.high}</span></div>
        </div>`).join("")}
      </details><small>Up to ${gpmStartingSupport * 100}% starting support. Zero seats or government offices.</small>` : ""}
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
    for (const party of parties) target.add(new Option(Sa(party), party.id));
    target.value = selectedPartyId;
    const fillNames = () => {
      const party = parties.find(item => item.id === target.value);
      nameField.value = Sa(party);
      tagField.value = sp(party, parties);
    };
    target.onchange = fillNames;
    fillNames();
  }
  dialog.querySelector("[data-cancel]").onclick = () => dialog.close();
  dialog.addEventListener("close", () => dialog.remove(), { once: true });
  dialog.addEventListener("cancel", event => { if (save.disabled) event.preventDefault(); });
  form.onsubmit = async event => {
    event.preventDefault();
    const partyName = nameField.value.trim();
    if (!partyName) { nameField.focus(); return; }
    save.disabled = true;
    error.hidden = true;
    try {
      await submit({ name: partyName, tag: tagField.value.trim(), ideology: readIdeology?.(), ideologyPreset: form.elements.platform?.value, partyId: target?.value });
      dialog.close();
    } catch (failure) {
      error.textContent = failure.message || "The party could not be updated.";
      error.hidden = false;
      save.disabled = false;
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
    .gpm-congress-control { display: flex; align-items: center; flex-wrap: wrap; gap: var(--gap-2); }
    .gpm-congress-size-label { display: block; }
    .gpm-congress-size-range { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: var(--gap-2); }
    .gpm-congress-size { width: 100%; min-width: 0; margin: 0; accent-color: var(--text-2); }
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
    .gpm-congress-faction > span:last-of-type, .gpm-congress-faction > small { grid-column: 1 / -1; }
    .gpm-party-profile { grid-column: 1 / -1; display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--gap-2); }
    .gpm-party-profile-tabs { display: grid; grid-template-columns: repeat(var(--gpm-profile-tabs), minmax(0, 1fr)); gap: var(--gap-1); }
    @container party-room (max-width: 480px) { .gpm-party-profile-tabs { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
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
      if (start.disabled || !he.setupPlayerControlIntent?.()?.partyId || !he.setupSeedIntent?.()) {
        throw new Error("Choose a country and enter a valid world seed first.");
      }
      gpmNewParty = draft;
      try { start.click(); } finally { gpmNewParty = null; }
    }});
  };
  document.addEventListener("click", event => {
    if (!event.target.closest("[data-gpm-rename]") || document.querySelector(".gpm-party-dialog")) return;
    const session = ze;
    const control = session?.playerControl;
    const parties = session?.player?.pol?.parties || [];
    if (!parties.some(item => item.id === control?.partyId)) return;
    partyDialog({ parties, selectedPartyId: control.partyId, submit: async draft => {
      if (ze !== session) throw new Error("The active campaign changed.");
      const result = await Te(session, "switchPlayerControl", [{
        countryKey: control.countryKey, partyId: draft.partyId,
        partyModRename: { name: draft.name, tag: draft.tag },
      }]);
      if (!result?.ok) throw new Error("The party could not be renamed.");
      if (ze === session) he._renderModule?.();
    }});
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

function renameDomesticParty(sim, input) {
  const identity = validatePartyName(input.partyModRename);
  const player = sim.player;
  if (!identity || !player || player.key !== input.countryKey || typeof input.partyId !== "string") {
    return { ok: false, reason: "party" };
  }
  const party = Rb(player, input.partyId);
  if (!party) return { ok: false, reason: "party" };
  party.nameDesc = { ...party.nameDesc, gpmName: identity.name, gpmTag: identity.tag };
  return { ok: true, changed: true };
}

function isCustomParty(party) {
  const descriptor = party?.nameDesc;
  return descriptor?.gpmFounded === true ||
    (typeof descriptor?.gpmName === "string" && /^np\d+$/.test(party.id));
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
  const incumbentSupport = politics.parties.map(party => Math.max(0, party.support || 0));
  const totalSupport = incumbentSupport.reduce((total, support) => total + support, 0);
  if (!Number.isFinite(totalSupport) || totalSupport <= 0) throw new Error("This country has no valid starting party support");
  const seedSupport = Math.min(totalSupport * gpmStartingSupport, Math.max(...incumbentSupport) / 4);
  const previous = Aro(politics.parties);
  const change = cua(politics, ideology, seedSupport, (party, parties) => {
    A0a(party, Zs(country.key), (country.hash ^ sim.rngSeed0) >>> 0, parties);
    party.nameDesc = { ...party.nameDesc, gpmName: identity.name, gpmTag: identity.tag, gpmFounded: true };
    if (presetMatches) party.nameDesc.gpmIdeologyPreset = draft.ideologyPreset;
  });
  o_a(country, change, previous);
  G0a(country, change, previous);
  sim._reconcilePolity(country);
  const party = Rb(country, change.id);
  if (!party) throw new Error("The new party was not registered");
  const hasSeats = (politics.chambers || []).some(chamber => (chamber.composition?.[party.id] || 0) > 0);
  if (!(party.support > 0 && party.support <= gpmStartingSupport + 1e-9) || hasSeats ||
      !politics.parties.some(incumbent => incumbent.id !== party.id && incumbent.support > party.support)) {
    throw new Error("The new party did not qualify for a fair starting position");
  }
  if (sim.people) Jha(sim, country, sim._simYear || 2026);
  const result = sim.switchPlayerControl({ countryKey: country.key, partyId: change.id });
  if (!result?.ok) throw new Error(`Could not lead the new party (${result?.reason || "unknown"})`);
  const control = Wo(sim);
  if (control.controlsExecutive || control.controlsCabinet || control.heldOfficeIds.length) {
    throw new Error("The new party unexpectedly received a government office");
  }
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
    <div class="gpm-party-profile-tabs" role="tablist" aria-label="Party profile" style="--gpm-profile-tabs:${tabs.length}">
      ${tabs.map(([id, label], index) => `<button class="k" type="button" role="tab" id="gpm-tab-${id}"
        data-gpm-profile-focus="${id}" aria-controls="gpm-panel-${id}" aria-selected="${index === 0}"
        tabindex="${index === 0 ? 0 : -1}">${label}${id === "foreign" ? '<span class="gpm-funding-attention" hidden></span>' : ""}</button>`).join("")}</div>
    ${tabs.map(([id, , content], index) => `<div class="mp-reading" id="gpm-panel-${id}" role="tabpanel"
      aria-labelledby="gpm-tab-${id}" data-mp-reading="gpm-${id}" ${id === "support" ? 'tabindex="0"' : ""}
      ${index === 0 ? "" : "hidden"}>${content}</div>`).join("")}
  </div>`;
}

function bindPartyProfile(host, view, ui) {
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
  let js = bytes.toString("utf8");
  // Patch display lookups, leaving country IDs, native search aliases, and save data intact.
  js = replaceOnce(js, 'const __geoWorker = typeof document ===',
    `const gpmOfficialCountryNames = ${JSON.stringify(officialCountryNames)};\nconst __geoWorker = typeof document ===`);
  const countryName = 'function R1e(e){let t=ld[Ky];';
  js = replaceOnce(js, countryName, `function gpmOfficialCountryName(key) {
    return Ky === "en" && Object.hasOwn(gpmOfficialCountryNames, key) ? gpmOfficialCountryNames[key] : null;
  }
  function R1e(e){
    const officialName = typeof e === "string" && e.startsWith("country.") ? gpmOfficialCountryName(e.slice(8)) : null;
    if (officialName) return officialName;
    let t=ld[Ky];`);
  const savedCountryName = '!Object.hasOwn(a,"customName")&&a.name?a.name:lp(a.key||e.playerKey,a.name||t)';
  js = replaceOnce(js, savedCountryName,
    '!Object.hasOwn(a,"customName")&&a.name&&!(gpmOfficialCountryName(a.key||e.playerKey)&&Px(a.key||e.playerKey).includes(a.name))?a.name:lp(a.key||e.playerKey,a.name||t)');
  js = replaceOnce(js, 'function Sa(e,t=e?.countryKey){', 'function Sa(e,t=e?.countryKey){if(e?.nameDesc?.gpmName)return e.nameDesc.gpmName;');
  js = replaceOnce(js, 's=i?VI(`${i}:${r.id}`)?.tag:null;s&&n.add(s)', 's=r.nameDesc?.gpmName?r.nameDesc.gpmTag:i?VI(`${i}:${r.id}`)?.tag:null;s&&n.add(s)');
  js = replaceOnce(js, 'c=s?.tag||R1t(l,n);n.add(c)', 'c=(r.nameDesc?.gpmName?r.nameDesc.gpmTag:s?.tag)||R1t(l,n);n.add(c)');
  const button = '<div class="mp-vd-name">${b(a?Sa(a):s)}</div>';
  js = replaceOnce(js, button, button + '${a?`<button type="button" class="k" data-gpm-rename>Rename Party</button><div class="gpm-my-ideology">${partyIdeologyBadge(a)}</div>`:""}');
  js = replaceOnce(js, '<span>${o("pol.family."+Vx(i))}</span>', '${partyIdeologyBadge(i)}');
  js = replaceOnce(js, '<div class="pa-axis" data-tip="${b(k)}"><div><span>${o(`political.ideology.${v}.neg`)}</span>', '<div class="pa-axis" data-tip="${b(k)}"><div><span>${o(`political.ideology.${v}.neg`)}</span><b class="gpm-axis-score">${partyAxisScore(i.ideology?.[v])}</b>');
  js = replaceOnce(js, 'f=p?"pol.family."+Vx(p):"",g="pol.role."+(d.role==="partner"?"coalition":d.role),y=[d.id===n?"myparty.hero.titleParty":f,g].filter(_=>st(_)).map(_=>o(_))', 'f=p?partyIdeologyLabel(p):"",g="pol.role."+(d.role==="partner"?"coalition":d.role),y=[d.id===n?o("myparty.hero.titleParty"):f,st(g)?o(g):""].filter(Boolean)');
  js = replaceOnce(js, 'Je("btn-start").addEventListener("click",()=>', `let gpmNewParty = null;\nconst gpmStartingSupport = ${startingSupport};\nconst gpmAxes = ${JSON.stringify(axes)};\nconst gpmPresets = ${JSON.stringify(presets)};\n${estimatePartyIdeology}\n${partyIdeologyLabel}\n${partyIdeologyBadge}\n${partyAxisScore}\n${setupIdeology}\n${partyDialog}\n${mountPartyButtons}\n${bindElectorateWidth}\n${congressVoting.join("\n")}\n${congressRenderer.join("\n")}\n${supportRenderer.join("\n")}\n${renderPartyProfile}\n${bindPartyProfile}\n${organizingRenderer.join("\n")}\nmountPartyButtons();\nJe("btn-start").addEventListener("click",()=>`);
  const partyCard = '${this._mpVerdictHtml(t,d,p,m)}</div>';
  js = replaceOnce(js, partyCard, partyCard + '\n      ${renderPartyProfile(t,p,this)}\n      <div class="wide mp-reading" data-mp-reading="gpm-organizing">${renderPartyOrganizing(t,this)}</div>');
  js = replaceOnce(js, 'this._mpWire(e,t),YF(this,e,t)', 'this._mpWire(e,t),bindPartyProfile(e,t,this),bindPartyCongress(e,t,p,this),bindPartyOrganizing(e,t,this),YF(this,e,t)');
  js = replaceOnce(js, '"data-bill-line","data-party-activity"].find(y=>a?.hasAttribute(y))', '"data-bill-line","data-party-activity","data-gpm-congress-size","data-gpm-congress-bargain","data-gpm-congress-priority","data-gpm-congress-vote","data-gpm-congress-priority-vote","data-gpm-profile-focus"].find(y=>a?.hasAttribute(y))');
  const refresh = 'this._mpRefreshReading(t,"identity",this._mpVerdictHtml(e,a,c,r))';
  js = replaceOnce(js, refresh, `${refresh},bindPartyCongress(t,e,c,this),this._mpRefreshReading(t,"gpm-support",renderPartySupportBase(e,this)),this._mpRefreshReading(t,"gpm-organizing",renderPartyOrganizing(e,this)),bindPartyProfile(t,e,this),bindPartyOrganizing(t,e,this)`);
  js = replaceOnce(js, 'sFe($k,null,"new",!1,e,void 0,a)', 'sFe($k,null,"new",!1,gpmNewParty?{...e,partyModCreate:gpmNewParty}:e,void 0,a)');
  js = replaceOnce(js, 'playerControl:{partyId:a.partyId}', 'playerControl:{partyId:a.partyId,...a.partyModCreate?{partyModCreate:a.partyModCreate}:{}}');
  js = replaceOnce(js, '_bPolElectorat(e,t){', '_bPolElectorat(e,t){bindElectorateWidth(e);');
  js = replaceOnce(js, 'let w=S.top||[],k=Math.max(0,1-w.reduce((E,L)=>E+L.v,0))', 'let w=S.votes||S.top||[],k=S.votes?0:Math.max(0,1-w.reduce((E,L)=>E+L.v,0))');
  js = replaceOnce(js, 'w.map(E=>{let L=Math.round(E.v*100);', 'w.map(E=>{let L=E.v*100;');
  js = replaceOnce(js, '${b(i(E.id))} \\xB7 ${$(L)}', '${b(i(E.id))} \\xB7 ${$(L,!1,2)}');
  js = replaceOnce(js, 'this._chipById(n,E.id,{win:L===0})}<b class="num">${$(Math.round(E.v*100))}', 'this._chipById(n,E.id,{win:L===0})}<b class="num">${$(E.v*100,!1,2)}');
  js = patchLawLabels(js, replaceOnce);
  js = replaceOnce(js, "\nmountPartyButtons();\n", `\nconst gpmRegionalMapStyle = ${JSON.stringify(regionalMapStyle)};\nconst gpmForeignFundingStyle = ${JSON.stringify(fundingStyle)};\n${regionalRenderer.join("\n")}\n${fundingRenderer.join("\n")}\nconst gpmLawShortlistStyle = ${JSON.stringify(lawShortlistStyle)};\n${lawShortlistRenderer.join("\n")}\nmountPartyButtons();\n`);
  js = replaceOnce(js, 'Nf("publicFacilityPlannerActive","closePublicFacilityPlanner")',
    'Nf("publicFacilityPlannerActive","closePublicFacilityPlanner"),Nf("gpmRegionalActive","closeGpmRegionalMap")');
  js = replaceOnce(js, 'if(cn!=="game")return;if(he.warRoomActive)', 'if(cn!=="game")return;if(gpmRegionalGlobeClick(he,t))return;if(he.warRoomActive)');
  js = replaceOnce(js, '_refreshTabUnsafe(e=null){', '_refreshTabUnsafe(e=null){gpmRefreshRegionalMap(this);');
  js = replaceOnce(js, 'showScreen(e){for(let t of document.querySelectorAll(".screen"))',
    'showScreen(e){if(e!=="game")gpmCloseRegionalMap(this);for(let t of document.querySelectorAll(".screen"))');
  return patchUprisingRenderer(Buffer.from(js));
}

function patchWorker(bytes) {
  if (sha256(bytes) !== workerHash) throw new Error(`Unsupported Geoplanetical simulation. This mod targets ${version}.`);
  let js = bytes.toString("utf8");
  js = replaceOnce(js, 'async function lvt(e,t,a=[]){', `const gpmStartingSupport = ${startingSupport};\nconst gpmAxes = ${JSON.stringify(axes)};\nconst gpmPresets = ${JSON.stringify(presets)};\n${estimatePartyIdeology}\n${validatePartyName}\n${renameDomesticParty}\n${createStartingParty}\n${organizingWorker.join("\n")}\n${congressWorker.join("\n")}\n${congressVoting.join("\n")}\n${congressVoteWorker.join("\n")}\n${supportWorker.join("\n")}\n${aiWorker.join("\n")}\n${advancePartyModDay}\n${retirePartyCongresses}\n${partyOrganizationForMerger}\nregisterPartyOrganizing();\nregisterPartyCongressSize();\nasync function lvt(e,t,a=[]){`);
  js = replaceOnce(js, 'yield"domestic.weekly"),t.has(La.WEEKLY_POLITICS)', 'yield"domestic.weekly"),Pe("advancePartyModDay",()=>advancePartyModDay(e)),t.has(La.WEEKLY_POLITICS)');
  js = replaceOnce(js, 'organization:t.organization?structuredClone(t.organization):null,campaigns:', 'organization:partyOrganizationForMerger(t),campaigns:');
  js = replaceOnce(js, 'function Lka(e,t){return q0a(e,t),gMa(e,t),e._reviewPartyParliamentAi(t)}', 'function Lka(e,t){return q0a(e,t),gMa(e,t),advancePartyModAI(e,t),e._reviewPartyParliamentAi(t)}');
  // Preserve existing balances and exact refunds in base currency units.
  js = replaceOnce(js, 'a.treasuryM=sN(nR(a.treasuryM||0,0,1e4))', 'a.treasuryM=sN(nR(a.treasuryM||0,0,1e4),6)');
  js = replaceOnce(js, 'cu=1e3,Tde=1e4,Fwa=10', 'cu=1e6,Tde=1e4,Fwa=10');
  js = replaceOnce(js, 'var jwa=1e8/1e3,Zeo=jwa/cu', 'var jwa=cu,Zeo=jwa/cu');
  js = replaceOnce(js, 'n.organization.treasuryM=GN(n.organization.treasuryM-o.cost.budgetM)', 'n.organization.treasuryM=partyForeignFundingTreasury(n,sN(n.organization.treasuryM-o.cost.budgetM,6))');
  js = replaceOnce(js, 'n.treasuryM=Dq(ae(xy(n.treasuryM),xy(i)))', 'n.treasuryM=partyForeignFundingTreasury(o,Dq(ae(xy(n.treasuryM),xy(i))))');
  js = replaceOnce(js, 'i.treasuryM=Dq(ae(xy(i.treasuryM),xy(s)))', 'i.treasuryM=partyForeignFundingTreasury(uu(t,a),Dq(ae(xy(i.treasuryM),xy(s))))');
  js = replaceOnce(js, 'c.organization.treasuryM=f/cu,u.organization.treasuryM=y/cu',
    'c.organization.treasuryM=partyForeignFundingTreasury(c,f/cu),u.organization.treasuryM=y/cu');
  js = replaceOnce(js, 'n.treasuryM=u/cu,n.activistsK=fn(n.activistsK*.75)',
    'n.treasuryM=partyForeignFundingTreasury(uu(e,t.parent),u/cu),n.activistsK=fn(n.activistsK*.75)');
  js = replaceOnce(js, 'w*=Vrt(b,p.id)', 'w*=Vrt(b,p.id)*partyOrganizingWeight(b,p.id)');
  js = replaceOnce(js, 'function _ka(e,t,a){return hIe(e.parties,[{share:1,', 'function _ka(e,t,a){return hIe(e.parties,[{id:t.id,share:1,');
  js = replaceOnce(js, 'function tDo({querySim:e,country:t,partyId:a}){', 'function tDo({querySim:e,country:t,partyId:a},gpmElectorate,gpmFunding){');
  js = replaceOnce(js, 'function Gcr(e){let t=e?.player;', 'function Gcr(e){let gpmElectorate,t=e?.player;');
  js = replaceOnce(js, 'electorate:kr(o._electorateBreakdown(n)),electoral:', 'electorate:(gpmElectorate=kr(o._electorateBreakdown(n))),electoral:');
  js = replaceOnce(js, 'party:tDo(r)}}var aDo', 'party:tDo(r,gpmElectorate,partyForeignFundingView(e,t,r.partyId))}}var aDo');
  js = replaceOnce(js, 'outreach:F0a(e,t,a),negotiations:hMa(e,t,a)', 'outreach:F0a(e,t,a),organizing:partyOrganizingView(e,t,a),congress:partyCongressView(e,t,a,gpmElectorate),supportBase:partySupportBaseView(e,t,a,gpmElectorate),negotiations:hMa(e,t,a)');
  js = replaceOnce(js, 'function Ero(e,t){', `${isCustomParty}\nfunction Ero(e,t){`);
  js = replaceOnce(js, 'if((y.support||0)<.06&&(g.support||0)<.06&&Hp(y.ideology,g.ideology)<.35)', 'if(!isCustomParty(y)&&!isCustomParty(g)&&(y.support||0)<.06&&(g.support||0)<.06&&Hp(y.ideology,g.ideology)<.35)');
  js = replaceOnce(js, 'let m=i.find(f=>(f._starve||0)>=24);', 'let m=i.find(f=>!isCustomParty(f)&&(f._starve||0)>=24);');
  js = replaceOnce(js, 'if(t==="switchPlayerControl")return e.switchPlayerControl(o[0]||{});', 'if(t==="switchPlayerControl")return o[0]?.partyModRename?renameDomesticParty(e,o[0]):e.switchPlayerControl(o[0]||{});');
  js = replaceOnce(js, 'this.sim=b,t.profileWorldTrade===!0', 'this.sim=b,o?retirePartyCongresses(b):t.playerControl?.partyModCreate&&createStartingParty(b,t.playerControl.partyModCreate),t.profileWorldTrade===!0');
  js = replaceOnce(js, 'comp:e.nameDesc.comp||null}:null}function Qcr', 'comp:e.nameDesc.comp||null,gpmName:e.nameDesc.gpmName||null,gpmTag:e.nameDesc.gpmTag||null,gpmIdeologyPreset:e.nameDesc.gpmIdeologyPreset||null}:null}function Qcr');
  js = replaceOnce(js, 'top:d.slice(0,3).map(([f,y])=>({id:f,v:y}))', 'top:d.slice(0,3).map(([f,y])=>({id:f,v:y})),votes:d.map(([f,y])=>({id:f,v:y}))');
  js = patchLawVoteSnapshots(js, replaceOnce);
  js = replaceOnce(js, "registerPartyCongressSize();\nasync function lvt",
    `registerPartyCongressSize();\nconst gpmRegionalRules = ${JSON.stringify(regionalRules)};\n${regionalWorker.join("\n")}\n${fundingWorker.join("\n")}\n${lawShortlistWorker.join("\n")}\nregisterPartyRegionalCampaign();\nregisterPartyForeignFunding();\nasync function lvt`);
  js = replaceOnce(js, 'id:r.__provId,name:r.__name||"",pop:r.__pop||0,lean:r.__lean}));return{regions:a,partyPerf:',
    'id:r.__provId,key:r.__provKey,name:r.__name||"",pop:r.__pop||0,lean:r.__lean}));return{regions:a,day:e.day||0,partyPerf:');
  js = replaceOnce(js, 'function vIe(e,t,a=null){', 'function vIe(e,t,a=null,gpmApplyRegions=true){');
  js = replaceOnce(js, 'return{id:p.id,name:p.name||"",pop:p.pop||0,shares:X0a',
    'return{id:p.id,key:p.key,name:p.name||"",pop:p.pop||0,shares:X0a');
  js = replaceOnce(js, 'if(m>0)for(let g in p.shares)p.shares[g]/=m;let f=null,y=-1;',
    'if(m>0)for(let g in p.shares)p.shares[g]/=m;if(gpmApplyRegions)p.shares=partyRegionalShares(e,p.shares,p.key,t.day);let f=null,y=-1;');
  // Regional seat rules use the adjusted local shares. National rules use their population-weighted change.
  js = replaceOnce(js, 'if(s.transfer)return lLr(s,t,a,{rulingId:r,rig:mIe(e,o),polity:n,electoralMap:i});let l={},c=0;',
    'if(s.transfer)return lLr(s,t,a,{rulingId:r,rig:mIe(e,o),polity:n,electoralMap:i});if(n&&["direct","equal-per-state","delegated"].includes(e.selectMode||"direct"))t=partyRegionalNationalShares(n,i,t);let l={},c=0;');
  js = replaceOnce(js, 'reportOrder:[]},C=r.parties.filter(X=>b[X.id]!=null).map(X=>({id:X.id,votes:Math.max(0,S[X.id]||0)}))',
    'reportOrder:[]},gpmNational=partyRegionalNationalShares(r,Ix(e,t),S),C=r.parties.filter(X=>b[X.id]!=null).map(X=>({id:X.id,votes:Math.max(0,gpmNational[X.id]||0)}))');
  js = replaceOnce(js, 'u=d2t(e,t,c,i),d={day:i,electionDay:r.nextDay,kind:o,contestId:n,values:u}',
    'u=d2t(e,t,partyRegionalNationalShares(t.pol,Ix(e,t),c),i),d={day:i,electionDay:r.nextDay,kind:o,contestId:n,values:u}');
  js = replaceOnce(js, 'congress:partyCongressView(e,t,a,gpmElectorate),supportBase:',
    'congress:partyCongressView(e,t,a,gpmElectorate),regionalCampaign:partyRegionalCampaignView(e,t,a),foreignFunding:gpmFunding,supportBase:');
  js = replaceOnce(js, 'lLe(r,a,t.params||{})',
    '(a==="gpm.foreignFunding"?partyForeignFundingDirectory(r,t.params||{}):a==="gpm.partyLawShortlist"?partyLawShortlist(r):lLe(r,a,t.params||{}))');
  // Publish only the funding summary, never the stored outcome rolls or exposure day.
  js = replaceOnce(js, 'n.pol.parties=Fcr(t.pol);',
    'n.pol.parties=Fcr(t.pol).map(({gpmForeignFunding,...party})=>party);');
  return Buffer.from(patchUprisingWorker(js, replaceOnce));
}

function advancePartyModDay(sim) {
  for (const country of sim.countries.values()) {
    for (const party of country.pol?.parties || []) {
      if (party.gpmOrganizing) advancePartyOrganizing(sim, country, party);
      if (party.gpmRegional) advancePartyRegionalCampaign(sim, country, party);
      if (party.gpmForeignFunding) advancePartyForeignFunding(sim, country, party);
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
  organization.activistsK = GN(Math.min(1e5, organization.activistsK + reservedForOrganizing));
  return organization;
}

module.exports = { version, patchRenderer, patchWorker, sha256 };

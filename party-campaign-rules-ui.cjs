"use strict";

const setupStyle = `
  .gpm-campaign-rules-entry { display: flex; align-items: center; gap: .6rem; flex-wrap: wrap; margin-block: .35rem; }
  .gpm-campaign-rules-entry small { color: var(--text-2, #b7c6d3); }
  .gpm-campaign-rules { position: fixed; inset: 0; margin: auto; width: min(760px, calc(100vw - 24px)); max-height: min(86vh, 790px); overflow: hidden; padding: 0; box-sizing: border-box; color: var(--text, #edf2f6); background: var(--panel, #18212b); border: 1px solid var(--line, #566372); border-radius: 9px; }
  .gpm-campaign-rules::backdrop { background: #0a0e14bd; }
  .gpm-campaign-rules form { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; max-height: inherit; }
  .gpm-campaign-rules header, .gpm-campaign-rules footer { padding: 14px 18px; }
  .gpm-campaign-rules header { border-bottom: 1px solid var(--line, #566372); }
  .gpm-campaign-rules footer { border-top: 1px solid var(--line, #566372); display: flex; justify-content: flex-end; flex-wrap: wrap; gap: .5rem; }
  .gpm-campaign-rules h2, .gpm-campaign-rules p { margin: 0; }
  .gpm-campaign-rules small { color: var(--text-2, #b7c6d3); }
  .gpm-campaign-rules [data-campaign-fields] { overflow: auto; min-height: 0; padding: 12px 18px 18px; }
  .gpm-campaign-rules [data-campaign-preset-description] { display: block; margin-top: 5px; }
  .gpm-campaign-rules [data-campaign-fields] > p { margin-block: 8px 12px; }
  .gpm-campaign-rules label { min-width: 0; display: grid; gap: 5px; }
  .gpm-campaign-rules select, .gpm-campaign-rules input:not([type=checkbox]) { width: 100%; padding: 6px 8px; border: 1px solid var(--line, #566372); border-radius: 4px; color: inherit; background: var(--well, #101820); }
  .gpm-campaign-rules input[type=checkbox] { justify-self: start; margin: 0; accent-color: var(--accent, #dcba77); }
  .gpm-campaign-rules details { margin-block-end: 8px; border: 1px solid var(--line, #566372); border-radius: 5px; }
  .gpm-campaign-rules summary { cursor: pointer; padding: 8px 10px; font-weight: 600; }
  .gpm-campaign-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 190px), 1fr)); align-items: start; gap: 12px; padding: 0 10px 12px; }
  .gpm-campaign-rules [data-campaign-regions], .gpm-campaign-rules [data-campaign-seat-note] { grid-column: 1 / -1; }
  .gpm-campaign-rules [data-campaign-regions]:empty, .gpm-campaign-rules [hidden] { display: none; }
  .gpm-campaign-region-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr)); gap: 6px; max-height: 164px; overflow: auto; margin-top: 8px; }
  .gpm-campaign-region-list label { display: flex; align-items: center; gap: 6px; padding-inline: 2px; }
  .gpm-campaign-rules [data-campaign-seat-note] { color: var(--mark-late, #edc583); }
`;

function gpmCampaignRuleValues() {
  return gpmCampaignRulesUI.active ??= { preset: "standard", ...gpmCampaignRulesUI.presets.standard.values, startingRegions: [] };
}

function gpmCampaignFoundingRegions() {
  const key = he._suSel?.__key;
  if (key == null) return [];
  return (br?.provinces || []).filter(province => String(province.__countryKey) === String(key) && province.__provKey)
    .map(province => ({ key: province.__provKey, name: Ut(province.__provKey, province.__name) }))
    .sort((a, b) => a.name.localeCompare(b.name, cs()));
}

function gpmCampaignRulesForStart() {
  const rules = gpmCampaignRuleValues();
  const allowed = new Set(gpmCampaignFoundingRegions().map(region => region.key));
  return { ...rules, startingRegions: rules.startingRegions.filter(key => allowed.has(key)) };
}

function gpmCampaignFoundingSummary() {
  const rules = gpmCampaignRulesForStart();
  const summary = [gpmCampaignRulesUI.presets[rules.preset]?.label || "Custom", `Up to ${rules.startingSupport}% starting support`,
    rules.startingSeats > 0 ? `Up to ${rules.startingSeats} starting ${rules.startingSeats === 1 ? "seat" : "seats"}` : "Zero starting seats",
    "No government office"];
  if (rules.startingCash !== null) summary.push(`$${Number(rules.startingCash).toLocaleString(cs())} founding cash`);
  if (rules.startingPresence > 0 && rules.startingRegions.length) {
    summary.push(`${rules.startingPresence}% presence in ${rules.startingRegions.length} selected ${rules.startingRegions.length === 1 ? "region" : "regions"}`);
  }
  return b(summary.join(" · "));
}

function gpmCampaignRuleField(field, value) {
  const attributes = `name="${b(field.id)}" data-campaign-rule="${b(field.id)}"`;
  const options = field.options;
  let control;
  if (Array.isArray(options)) {
    control = `<select ${attributes}>${options.map(([key, label]) =>
      `<option value="${b(String(key))}" ${String(key) === String(value) ? "selected" : ""}>${b(label)}</option>`).join("")}</select>`;
  } else if (["boolean", "checkbox"].includes(field.type)) {
    control = `<input type="checkbox" ${attributes} ${value ? "checked" : ""}>`;
  } else {
    const range = Object.entries({ min: field.min, max: field.max, step: field.step })
      .filter(([, number]) => Number.isFinite(number)).map(([attribute, number]) => ` ${attribute}="${number}"`).join("");
    control = `<input type="number" ${attributes}${range} value="${Number.isFinite(value) ? value : ""}" ${
      field.nullable ? 'placeholder="Game default"' : "required"}>`;
  }
  return `<label>${b(field.label)}${control}${field.help ? `<small>${b(field.help)}</small>` : ""}</label>`;
}

function gpmShowCampaignRules(entry) {
  if (document.querySelector(".gpm-campaign-rules")) return;
  const { presets, sections } = gpmCampaignRulesUI;
  const initial = gpmCampaignRulesForStart();
  let draft = { ...initial, startingRegions: [...initial.startingRegions] };
  const regions = gpmCampaignFoundingRegions();
  const fields = sections.flatMap(section => section.fields).filter(field => field.id !== "startingRegions");
  const dialog = document.createElement("dialog");
  dialog.className = "gpm-campaign-rules";
  dialog.setAttribute("aria-labelledby", "gpm-campaign-rules-title");
  dialog.innerHTML = `<form>
    <header><h2 id="gpm-campaign-rules-title">Campaign Rules</h2></header>
    <div data-campaign-fields>
      <label>Preset <select data-campaign-preset>${Object.entries(presets).map(([id, preset]) =>
        `<option value="${b(id)}">${b(preset.label)}</option>`).join("")}<option value="custom">Custom</option></select></label>
      <small data-campaign-preset-description></small>
      <p>Founding settings apply when you create a party. The remaining rules apply to the entire campaign.</p>
      <div data-campaign-sections></div>
    </div>
    <footer><button class="k" type="button" data-campaign-cancel>Cancel</button><button class="k primary" type="submit">Apply rules</button></footer>
  </form>`;
  const form = dialog.querySelector("form");
  const presetSelect = form.querySelector("[data-campaign-preset]");
  const sectionsElement = form.querySelector("[data-campaign-sections]");
  const description = form.querySelector("[data-campaign-preset-description]");
  function renderContext() {
    description.textContent = presets[draft.preset]?.description || "Use your own campaign settings.";
    const seats = form.querySelector("[data-campaign-seat-note]");
    if (seats) seats.hidden = !(draft.startingSeats > 0);
    const regionOptions = form.querySelector("[data-campaign-regions]");
    if (regionOptions) {
      regionOptions.hidden = !(draft.startingPresence > 0);
      const count = regionOptions.querySelector("[data-campaign-region-count]");
      if (count) count.textContent = `${draft.startingRegions.length} selected`;
    }
  }

  function renderFields() {
    const opened = new Map([...sectionsElement.querySelectorAll("details")].map(details => [details.dataset.section, details.open]));
    sectionsElement.innerHTML = sections.map(({ title, fields }, index) => {
      const hasSeats = fields.some(field => field.id === "startingSeats");
      const hasPresence = fields.some(field => field.id === "startingPresence");
      let extra = hasSeats ? '<small data-campaign-seat-note hidden>Holding a seat makes your party ineligible to start an uprising.</small>' : "";
      if (hasPresence) {
        extra += `<div data-campaign-regions hidden>${regions.length ? `<label>Starting regions <input type="search" data-campaign-region-search placeholder="Find a region"></label>
          <small data-campaign-region-count role="status"></small><div class="gpm-campaign-region-list" role="group" aria-label="Starting regions">
          ${regions.map(region => `<label data-campaign-region><input type="checkbox" value="${b(region.key)}" ${
            draft.startingRegions.includes(region.key) ? "checked" : ""}>${b(region.name)}</label>`).join("")}</div>`
          : "<small>Choose a country with eligible regions to assign local presence.</small>"}</div>`;
      }
      return `<details data-section="${index}" ${(opened.get(String(index)) ?? index < 2) ? "open" : ""}>
        <summary>${b(title)}</summary><div class="gpm-campaign-fields">${fields.filter(field => field.id !== "startingRegions")
          .map(field => gpmCampaignRuleField(field, draft[field.id])).join("")}${extra}</div></details>`;
    }).join("");
    renderContext();
  }

  const markCustom = () => { draft.preset = presetSelect.value = "custom"; renderContext(); };
  presetSelect.value = draft.preset;
  presetSelect.addEventListener("change", () => {
    const preset = presetSelect.value;
    if (Object.hasOwn(presets, preset)) draft = { ...presets[preset].values, preset, startingRegions: [] };
    else draft.preset = "custom";
    renderFields();
  });
  sectionsElement.addEventListener("input", event => {
    const input = event.target;
    if (input.matches("[data-campaign-region-search]")) {
      const search = input.value.trim().toLocaleLowerCase(cs());
      for (const row of sectionsElement.querySelectorAll("[data-campaign-region]")) {
        row.hidden = !row.textContent.toLocaleLowerCase(cs()).includes(search);
      }
      return;
    }
    const id = input.dataset.campaignRule;
    if (!id || !input.validity.valid) return;
    if (input.type === "checkbox") draft[id] = input.checked;
    else if (input.type === "number") draft[id] = input.value === "" ? null : input.valueAsNumber;
    else {
      const field = fields.find(field => field.id === id);
      draft[id] = field?.options?.find(([key]) => String(key) === input.value)?.[0] ?? input.value;
    }
    markCustom();
  });
  sectionsElement.addEventListener("change", event => {
    const input = event.target;
    if (!input.matches("[data-campaign-region] input")) return;
    if (input.checked && draft.startingRegions.length >= 12) {
      input.checked = false;
      form.querySelector("[data-campaign-region-count]").textContent = "12 selected. Remove one to choose another.";
      return;
    }
    draft.startingRegions = input.checked ? [...draft.startingRegions, input.value]
      : draft.startingRegions.filter(key => key !== input.value);
    markCustom();
  });
  form.querySelector("[data-campaign-cancel]").onclick = () => dialog.close();
  dialog.addEventListener("close", () => { dialog.remove(); entry.querySelector("button")?.focus({ preventScroll: true }); }, { once: true });
  form.onsubmit = event => {
    event.preventDefault();
    // Surface the invalid setting even when its section has been collapsed.
    const invalid = form.querySelector(":invalid");
    if (invalid) { const details = invalid.closest("details"); if (details) details.open = true; invalid.reportValidity(); return; }
    gpmCampaignRulesUI.active = { ...draft, startingRegions: draft.startingPresence > 0 ? draft.startingRegions : [] };
    entry.querySelector("small").textContent = presets[draft.preset]?.label || "Custom";
    dialog.close();
  };
  form.noValidate = true;
  renderFields();
  document.body.append(dialog);
  dialog.showModal();
  presetSelect.focus();
}

function gpmMountCampaignRules() {
  const anchor = document.getElementById("setup-role-note");
  if (!anchor || document.querySelector(".gpm-campaign-rules-entry")) return;
  const style = document.createElement("style");
  style.textContent = gpmCampaignRulesStyle;
  document.head.append(style);
  const entry = document.createElement("div");
  entry.className = "gpm-campaign-rules-entry";
  entry.innerHTML = '<button type="button" class="k" aria-haspopup="dialog">Campaign Rules</button><small></small>';
  const rules = gpmCampaignRuleValues();
  entry.querySelector("small").textContent = gpmCampaignRulesUI.presets[rules.preset]?.label || "Custom";
  entry.querySelector("button").onclick = () => gpmShowCampaignRules(entry);
  anchor.after(entry);
}

module.exports = { setupStyle, setupFunctions: [gpmCampaignRuleValues, gpmCampaignFoundingRegions,
  gpmCampaignRulesForStart, gpmCampaignFoundingSummary, gpmCampaignRuleField, gpmShowCampaignRules, gpmMountCampaignRules] };

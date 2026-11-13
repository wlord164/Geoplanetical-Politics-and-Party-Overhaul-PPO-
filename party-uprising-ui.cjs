"use strict";

const style = [
  ".gpm-uprising { display: grid; gap: var(--gap-2); min-width: 0; }",
  ".gpm-uprising :is(p, dl, dd) { margin: 0; }",
  ".gpm-uprising [data-gpm-uprising-content] { display: grid; gap: var(--gap-2); }",
  ".gpm-uprising [data-gpm-uprising-status]:empty { display: none; }",
  ".gpm-uprising-details { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); gap: var(--gap-1) var(--gap-2); }",
  ".gpm-uprising-details dd { overflow-wrap: anywhere; }",
  ".gpm-uprising-outcomes { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr)); gap: var(--gap-2); }",
  ".gpm-uprising-outcomes > div { display: grid; align-content: start; gap: var(--gap-1); padding: var(--gap-2); }",
  ".gpm-uprising-charter { display: grid; gap: var(--gap-1); margin: 0; padding-inline-start: var(--gap-3, 1.25rem); }",
  ".gpm-uprising-preparations { display: grid; gap: var(--gap-2); min-width: 0; }",
  ".gpm-uprising-preparations h4 { margin: 0; }",
  ".gpm-uprising-prep-heading { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--gap-2); }",
  ".gpm-uprising-map-layout { display: grid; gap: var(--gap-2); min-width: 0; }",
  ".gpm-uprising-map-layout:not(.gpm-uprising-map-expanded) > .gpm-support-map > svg { max-height: 24rem; }",
  ".gpm-uprising-map-expanded > .gpm-support-map > svg { max-height: 65vh; }",
  "@media (min-width: 60rem) { .gpm-uprising-map-expanded { grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); align-items: start; } }",
  ".gpm-uprising-map-tools { display: flex; flex-wrap: wrap; gap: var(--gap-1) var(--gap-2); align-items: center; }",
  ".gpm-uprising-map-tools select { max-width: 100%; }",
  ".gpm-uprising-map-key { display: flex; flex-wrap: wrap; gap: .35rem .8rem; align-items: center; }",
  ".gpm-uprising-map-key > span { display: inline-flex; gap: .4em; align-items: center; }",
  ".gpm-uprising-swatch { width: 1.15em; height: .8em; border: 1px solid #8a9bad; border-radius: .16em; flex-shrink: 0; }",
  ".gpm-uprising-swatch-hq { border: 2px dashed #ffdc86; background: transparent; }",
  ".gpm-uprising .gpm-support-map path { stroke: #08121f; stroke-width: 1.25; }",
  ".gpm-uprising .gpm-support-map path[data-gpm-uprising-hq] { stroke: #ffdc86; stroke-width: 2.25; stroke-dasharray: 4 2; }",
  ".gpm-uprising .gpm-support-map path:is(:hover,[data-selected]):not([data-gpm-uprising-hq]) { stroke: #fff5da; stroke-width: 2.5; }",
  ".gpm-uprising .gpm-support-map path[data-gpm-uprising-hq]:is(:hover,[data-selected]) { stroke-width: 3; }",
  ".gpm-uprising-region-list { display: grid; gap: .2rem; margin: 0; padding: 0 .2rem .15rem 0; max-height: 16rem; overflow: auto; list-style: none; }",
  ".gpm-uprising-region-list button { display: grid; grid-template-columns: auto minmax(0,1fr) auto; align-items: start; gap: .5rem; text-align: start; width: 100%; }",
  ".gpm-uprising-region-list button[aria-pressed='true'] { border-color: #ffdc86; }",
  ".gpm-uprising-region-list button span:nth-child(2) { display: grid; gap: .15rem; overflow-wrap: anywhere; }",
  ".gpm-uprising-region-list strong, .gpm-uprising-foothold { font-variant-numeric: tabular-nums; }",
  ".gpm-uprising-region-list small { color: var(--text-2, #b7c6d3); }",
  ".gpm-uprising-prep-item { display: grid; align-content: start; gap: var(--gap-1); min-width: 0; }",
  ".gpm-uprising-prep-item select { width: 100%; min-width: 0; }",
  ".gpm-uprising-readiness, .gpm-uprising-roster { margin: 0; padding-inline-start: 1.25rem; }",
  ".gpm-uprising-readiness { display: grid; list-style: none; padding: 0; gap: .3rem; }",
  ".gpm-uprising-readiness li { display: flex; gap: .65rem; align-items: baseline; }",
  ".gpm-uprising-readiness li strong { min-width: 4.5rem; color: #ffdc86; }",
  ".gpm-uprising-readiness li .gpm-uprising-ready { color: #9bd6ad; }",
  ".gpm-uprising-actions { display: flex; flex-wrap: wrap; gap: var(--gap-2); align-items: center; }",
  ".gpm-uprising [data-gpm-uprising-action='declare'] { border-color: var(--mark-late, #edc583); }",
].join("\n");

function gpmRenderUprising() {
  return '<section class="mcard wide gpm-uprising" aria-label="Uprising">'
    + '<h3 class="mc-title">Uprising</h3>'
    + '<small role="status" data-gpm-uprising-status></small>' + '<div data-gpm-uprising-content></div>'
    + '</section>';
}

function gpmUprisingReason(reason) {
  return ({
    scope: "Uprisings require a sovereign country with its own government and legislature.",
    constitution: "This country cannot adopt the proposed constitution.",
    name: "Select one of the available breakaway names.",
    case_exists: "An uprising has already taken place in this campaign.",
    founder_control: "Switch to the legal founding party to review an uprising.",
    unsupported_party_roles: "Your party must hold no government offices or assembly seats.",
    existing_war: "The current conflict must end before an uprising can begin.",
    territory: "The country needs an unoccupied region outside its capital with a land border to the rest of the country.",
    headquarters_required: "Establish party headquarters to set your starting region.",
    headquarters_region: "Relocate party headquarters to an eligible region.",
    headquarters_foothold: "Raise foothold in your headquarters region to the target shown above.",
    division_required: "Finish preparing at least one division before declaring.",
    stale: "The declaration terms changed. Review the updated proposal before confirming.",
    result: "A decisive war result is required for reunification.",
    conflict_mismatch: "The uprising no longer matches the active conflict.",
  })[reason] || "The uprising is unavailable in the current situation.";
}

function gpmUprisingPreparationReason(reason) {
  return ({
    region: "The capital, occupied regions, and ineligible territories cannot receive investment.",
    resources: "The party does not have enough available activists.",
    headquarters: "The headquarters is already in this region.",
    headquarters_region: "The capital, occupied regions, and ineligible territories cannot host the uprising headquarters.",
    division_terms: "Select an available division type and equipment kit.",
    budget: "The party treasury cannot cover the cost.",
    wing: "Form the party wing first.",
    formed: "The party wing is already formed.",
    active: "This preparation is already under way.",
    saturated: "This region is at maximum foothold.",
    project_limit: "Two regional investments are already under way.",
    division_limit: "The division limit has been reached.",
    cooldown: "The party is still on cooldown.",
    donor: "The donor party is no longer available.",
    donor_funds: "The donor can no longer provide the offer.",
    expired: "The aid offer has expired.",
  })[reason] || gpmUprisingReason(reason);
}

const gpmUprisingFootholdBands = [
  { min: 0, color: "#334d69", label: "0%" },
  { min: .001, color: "#476789", label: "0.1–1.9%" },
  { min: .020, color: "#6482a0", label: "2–4.9%" },
  { min: .050, color: "#7d7294", label: "5–14.9%" },
  { min: .150, color: "#976b86", label: "15–29.9%" },
  { min: .300, color: "#b46175", label: "30–44.9%" },
  { min: .450, color: "#d1636c", label: "45–59.9%" },
  { min: .600, color: "#f38170", label: "60%+" },
];

function gpmUprisingPreparationColor(region, layer) {
  if (layer === "control") {
    return region.starting || region.defects ? "#c8514f" : "#397bb8";
  }
  return gpmUprisingFootholdBands.findLast(band => region.foothold >= band.min)?.color
    || gpmUprisingFootholdBands[0].color;
}

function gpmUprisingSelectedRegion(prep, selectedRegion) {
  return prep.regions.find(region => String(region.id) === selectedRegion)
    || prep.regions.find(region => region.headquarters || region.starting)
    || prep.regions[0];
}

function gpmUprisingRegionalStatus(region, threshold) {
  if (region.capital) return "Government capital";
  if (region.starting) return "Headquarters · starting region";
  if (region.defects) return "Joins at declaration";
  if (region.headquarters) {
    if (!region.eligible) return "Headquarters · ineligible region";
    return "Headquarters · " + (region.foothold < threshold ? "below foothold target" : "foothold target met");
  }
  if (!region.eligible) return "Government · ineligible region";
  if (region.foothold >= threshold) return "Foothold target met";
  return "Government";
}

function gpmUprisingMap(state, ui, prep, selected, percent) {
  const { regions, threshold } = prep;
  const layer = state.mapLayer || "foothold";
  const name = region => Ut(region.key, region.name);
  const control = region => gpmUprisingRegionalStatus(region, threshold);
  const byId = new Map(regions.map(region => [region.id, region]));
  const world = ui.globe?.world;
  const features = regions.map(region => world?.provinces?.[region.id])
    .filter(feature => feature?.geometry && byId.get(feature.__provId)?.key === feature.__provKey);
  const signature = JSON.stringify(features.map(feature => feature.__provKey));
  if (state.geometry?.world !== world || state.geometry?.signature !== signature) {
    state.geometry = { world, signature, layout: features.length ? ok(features, 620, 510, { pad: 12 }) : null };
  }
  const layout = state.geometry?.layout;
  const svg = (paths, width, height) => '<svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="'
    + (layer === "control" ? "Projected control at declaration" : "Regional foothold") + '">'
    + [...paths].sort((a, b) => Number(!!byId.get(a.provId)?.headquarters) - Number(!!byId.get(b.provId)?.headquarters))
      .map(({ provId, d }) => {
      const region = byId.get(provId);
      if (!region) return "";
      return '<path d="' + b(d) + '" data-gpm-uprising-region="' + b(String(provId)) + '" '
        + (region === selected ? "data-selected " : "") + (region.headquarters ? "data-gpm-uprising-hq " : "")
        + 'fill="' + gpmUprisingPreparationColor(region, layer) + '"><title>' + b(name(region))
        + ' · ' + b(percent.format(region.foothold)) + ' foothold · ' + b(control(region)) + '</title></path>';
    }).join("") + '</svg>';
  const swatch = (color, label) => '<span><i class="gpm-uprising-swatch" style="background:' + color + '" aria-hidden="true"></i>'
    + b(label) + "</span>";
  const legend = layer === "control"
    ? swatch(gpmUprisingPreparationColor({}, "control"), "Government")
      + swatch(gpmUprisingPreparationColor({ defects: true }, "control"), "Breakaway")
    : gpmUprisingFootholdBands.map(({ color, label }) => swatch(color, label)).join("");
  const controlSelect = '<label class="gpm-uprising-map-tools">Map layer <select class="k" data-gpm-uprising-map-layer data-gpm-uprising-field="layer">'
    + '<option value="foothold"' + (layer === "foothold" ? " selected" : "") + '>Foothold</option>'
    + '<option value="control"' + (layer === "control" ? " selected" : "") + '>Projected control</option></select></label>';
  const geometry = layout ? svg(layout.paths, layout.W, layout.H)
    + (layout.insets.length ? '<div class="gpm-support-insets">' + layout.insets.map(inset =>
      '<div>' + svg(inset.paths, layout.box, layout.box) + '<small>' + b(inset.label) + '</small></div>').join("") + '</div>' : "")
    : "<small>Map geometry is unavailable. Use the region list.</small>";
  return '<div class="gpm-support-map">' + controlSelect + geometry
    + '<div class="gpm-uprising-map-key">' + legend
    + '<span><i class="gpm-uprising-swatch gpm-uprising-swatch-hq" aria-hidden="true"></i>Party headquarters</span></div></div>';
}
function gpmUprisingSelectedDivision(division, state) {
  const options = division.options || [];
  const type = options.find(entry => entry.id === state.divisionType) || options[0];
  const kit = type?.kits.find(entry => entry.id === state.equipmentKit) || type?.kits[0];
  return { options, type, kit };
}

function gpmUprisingRoster(roster) {
  if (!roster?.length) return "";
  const grouped = new Map();
  for (const unit of roster) {
    const label = unit.label + " · " + unit.kitLabel;
    grouped.set(label, (grouped.get(label) || 0) + 1);
  }
  return '<ul class="gpm-uprising-roster">' + [...grouped].map(([label, count]) =>
    "<li>" + b(String(count)) + " × " + b(label) + "</li>").join("") + "</ul>";
}

function gpmUprisingEquipmentLabel(item) {
  if (item.label) return item.label;
  return ({ ifv: "Infantry fighting vehicles", mbt: "Tanks", arty: "Artillery",
    apc: "Armored personnel carriers", light: "Light equipment",
    truck: "Trucks", trucks: "Trucks", recon: "Reconnaissance vehicles" })[item.id]
    || item.id.replaceAll("_", " ").replace(/^./, first => first.toUpperCase());
}

function gpmUprisingDivisionPanel(division, state, prep, button, date, money, credits, reason, percent) {
  const { options, type, kit } = gpmUprisingSelectedDivision(division, state);
  const quote = kit?.quote;
  const cost = Number.isFinite(quote?.cash) && Number.isFinite(quote?.days)
    ? money(quote.cash) + (quote.creditCost > 0 ? " + " + credits(quote.creditCost) : "") + " · " + quote.days + " days."
    : "";
  const opts = (choices, selected) => choices.map(choice =>
    '<option value="' + b(choice.id) + '"' + (selected === choice ? " selected" : "") + ">" + b(choice.label) + "</option>").join("");
  const equipment = (kit?.equipment || []).filter(item => item.units > 0).map(item =>
    Number(item.units).toLocaleString(cs()) + " " + gpmUprisingEquipmentLabel(item)).join(" · ");
  const project = division.project;
  const controls = project
    ? "<p>" + b(project.label || "Division") + (project.kitLabel ? " · " + b(project.kitLabel) : "")
      + "</p><small>Ready " + b(date(project.endDay)) + ".</small>"
    : kit
      ? '<label class="gpm-uprising-prep-item">Division type<select class="k" data-gpm-uprising-field="division-type">'
        + opts(options, type) + '</select></label>'
        + '<label class="gpm-uprising-prep-item">Equipment kit<select class="k" data-gpm-uprising-field="equipment-kit">'
        + opts(type.kits, kit) + '</select></label>'
        + (equipment ? "<small>" + b(equipment) + "</small>" : "")
        + "<small>" + b(cost + reason(quote)) + "</small>" + button("recruit", "Prepare Division", !quote?.ok)
      : "<small>Division preparation is unavailable.</small>";
  const capacity = "Capacity grows by one for each eligible region at " + percent.format(prep.capacityThreshold)
    + " foothold, plus one when the headquarters reaches " + percent.format(prep.threshold) + ".";
  return '<div class="sh-inset"><strong>Prepared divisions</strong><p>' + b(String(division.count)) + " of "
    + b(String(division.limit)) + " ready · " + b(credits(division.credits)) + " available</p>"
    + gpmUprisingRoster(division.roster) + "<small>" + b(capacity)
    + " Completed divisions deploy at headquarters.</small>" + controls + "</div>";
}


function gpmUprisingPreparations(state, ui, button) {
  const prep = state.data.preparations;
  if (!prep || state.confirm) return "";
  const { regions, wing, division, foreignAid, threshold } = prep;
  const percent = new Intl.NumberFormat(cs(), { style: "percent", maximumFractionDigits: 1 });
  const number = new Intl.NumberFormat(cs(), { maximumFractionDigits: 1 });
  const points = value => number.format(value * 100) + " pp";
  const date = day => ui.gameDate?.(day) || "Day " + day;
  const money = amount => gpmForeignFundingMoney(amount);
  const credits = count => count + (count === 1 ? " aid credit" : " aid credits");
  const reason = quote => quote?.reason ? " " + gpmUprisingPreparationReason(quote.reason) : "";
  const name = region => Ut(region.key, region.name);
  const selected = gpmUprisingSelectedRegion(prep, state.selectedRegion);
  const hqProject = prep.headquarters?.project;
  const map = gpmUprisingMap(state, ui, prep, selected, percent);
  const regionList = '<ul class="gpm-uprising-region-list" aria-label="Regional footholds">'
    + [...regions].sort((a, b) => name(a).localeCompare(name(b), cs())).map(region => {
      const color = gpmUprisingPreparationColor(region, state.mapLayer || "foothold");
      return '<li><button class="k" type="button" data-gpm-uprising-region-row="' + b(String(region.id))
        + '" aria-pressed="' + (region === selected) + '"><i class="gpm-uprising-swatch" style="background:' + color
        + '" aria-hidden="true"></i><span><strong>' + b(name(region)) + '</strong><small>'
        + b(gpmUprisingRegionalStatus(region, threshold)) + '</small></span><strong>'
        + b(percent.format(region.foothold)) + '</strong></button></li>';
    }).join("") + '</ul>';
  let investment = "";
  if (selected) {
    const quote = selected.invest;
    const project = selected.project;
    const terms = Number.isFinite(quote?.cash) && Number.isFinite(quote?.gain) && Number.isFinite(quote?.days)
      ? `${money(quote.cash)} · +${points(quote.gain)} foothold · ${quote.days} ${quote.days === 1 ? "day" : "days"}.` : "";
    const contributors = [["Local support", selected.sources?.support], ["Regional presence", selected.sources?.presence],
      ["Headquarters", selected.sources?.headquarters], ["Uprising investments", selected.sources?.investment]]
      .filter(([, value]) => value > 0).map(([label, value]) => label + " +" + points(value));
    const hqQuote = selected.hq;

    const activeHQProject = hqProject && regions.find(region => region.key === hqProject.key);
    const hqTerms = Number.isFinite(hqQuote?.cash) && Number.isFinite(hqQuote?.activistsK)
      ? money(hqQuote.cash) + " · " + number.format(hqQuote.activistsK * 1000)
        + " activists · " + hqQuote.days + " days."
      : "";
    const hqControls = hqProject
      ? "<p>Headquarters project" + (activeHQProject ? " in " + b(name(activeHQProject)) : "")
        + " completes " + b(date(hqProject.endDay)) + "." + (prep.headquarters.key ? " Your current headquarters stays open until then." : "") + "</p>"
      : selected.headquarters ? "" : '<small>' + b(hqTerms + reason(hqQuote)) + '</small>'
        + button("headquarters", hqQuote?.relocate ? "Relocate Headquarters Here" : "Establish Headquarters Here", !hqQuote?.ok);

    investment = `<div class="sh-inset gpm-uprising-prep-item">
      <h4>${b(name(selected))}</h4>
      <p><strong class="gpm-uprising-foothold">${b(percent.format(selected.foothold))} foothold</strong> · ${b(gpmUprisingRegionalStatus(selected, threshold))}</p>
      ${contributors.length ? "<small>" + b(contributors.join(" · ")) + "</small>" : ""}
      ${hqControls}
      ${project ? `<small>Investment completes ${b(date(project.endDay))} · +${b(points(project.gain))} foothold.</small>`
        : `<small>${b(terms + reason(quote))}</small>${button("invest", "Invest in Foothold", !quote?.ok)}`}</div>`;
  }
  const wingQuote = wing.quote;
  const wingTerms = Number.isFinite(wingQuote?.cash) ? money(wingQuote.cash) + " from the party treasury." : "";
  const wingPanel = `<div class="sh-inset"><strong>Party wing</strong>
    ${wing.formed ? "<p>Formed. You can invest in footholds, prepare divisions, and request foreign aid.</p>"
      : `<p>Forming the wing unlocks foothold investments, division preparation, and foreign aid.</p><small>${b(wingTerms + reason(wingQuote))}</small>
        ${button("form", "Form Party Wing", !wingQuote?.ok)}`}</div>`;
  const divisionPanel = gpmUprisingDivisionPanel(division, state, prep, button, date, money, credits, reason, percent);
  const donors = foreignAid.donors;
  const donorKey = donor => JSON.stringify([donor.countryKey, donor.partyId]);
  const donorName = donor => gpmForeignFundingDonorName(donor);
  const donor = donors.find(entry => donorKey(entry) === state.selectedDonor) || donors[0];
  const offer = foreignAid.offer;
  const pending = foreignAid.pending;
  const last = foreignAid.last;
  const lastResult = last && ({
    accepted: "Aid accepted.",
    declined: "Offer declined.",
    refused: "Request refused.",
    expired: "Offer expired.",
  })[last.status];
  let aid = "<p>Form the party wing to request aid.</p>";
  if (offer) {
    aid = `<p>${b(donorName(offer.donor))} offered ${b(credits(offer.credits))}. Expires ${b(date(offer.expiresDay))}.</p>
      <div class="gpm-uprising-actions">${button("aidAccept", "Accept Offer")}${button("aidDecline", "Decline Offer")}</div>`;
  } else if (pending) {
    aid = `<p>Waiting for ${b(donorName(pending.donor))}. Response due ${b(date(pending.responseDay))}.</p>`;
  } else if (wing.formed) {
    const cooldown = foreignAid.nextRequestDay > state.data.day;
    const options = donors.map(entry => `<option value="${b(donorKey(entry))}" ${entry === donor ? "selected" : ""}>${b(donorName(entry))}</option>`).join("");
    aid = cooldown ? "<p>Next request available " + b(date(foreignAid.nextRequestDay)) + ".</p>" : donor ? `<label class="gpm-uprising-prep-item">Donor<select class="k" data-gpm-uprising-donor data-gpm-uprising-field="donor">${options}</select></label>
      <p>${b(percent.format(donor.chance))} chance of an offer · ${b(credits(donor.credits))} if approved</p>
        ${button("aidRequest", "Request Aid", donor.chance <= 0)}`
      : "<p>No foreign party is currently available to offer aid.</p>";
  }
  const aidPanel = `<div class="sh-inset"><strong>Foreign aid</strong>
    <small>Aid credits reduce the treasury cost of preparing divisions.</small>${aid}
    ${lastResult ? `<small>${b(date(last.day))} · ${last.donor ? b(donorName(last.donor)) + " · " : ""}${b(lastResult)}</small>` : ""}</div>`;
  const regional = selected ? `<div class="gpm-uprising-map-layout${state.mapOpen ? " gpm-uprising-map-expanded" : ""}">
    ${map}<div class="gpm-uprising-prep-item">${regionList}${investment}
      <small>Additional regions need ${b(percent.format(threshold))} foothold and a connection to the starting region.
      The government keeps its capital and at least 20% of the population.</small></div></div>`
    : "<p>No regions are available for preparation.</p>";
  const mapControl = state.mapOpen ? button("closeMap", "Back to Uprising")
    : selected ? button("openMap", "Open Uprising Map") : "";
  return `<section class="gpm-uprising-preparations" aria-label="${state.mapOpen ? "Uprising map" : "Uprising preparations"}">
    <div class="gpm-uprising-prep-heading"><h4>${state.mapOpen ? "Uprising Map" : "Uprising Preparations"}</h4>${mapControl}</div>
    ${regional}${state.mapOpen ? "" : `<div class="gpm-uprising-outcomes">${wingPanel}${divisionPanel}${aidPanel}</div>`}</section>`;
}
function gpmUprisingReadiness(prep, percent) {
  const { headquarters, division, threshold } = prep;
  const items = [
    { ready: !!headquarters?.key && !!headquarters.eligible,
      text: headquarters?.key ? Ut(headquarters.key, headquarters.name) + " headquarters in an eligible region"
        : "Establish party headquarters in an eligible region" },
    { ready: !!headquarters?.ready,
      text: "Headquarters foothold " + (headquarters?.key ? percent.format(headquarters.foothold) : "—") + " / " + percent.format(threshold) },
    { ready: division.count > 0, text: division.count > 0 ? "At least one division prepared" : "Prepare at least one division" },
  ];
  if (headquarters?.key && !headquarters.eligible) items[0].text = "Relocate headquarters to an eligible region";
  return '<ul class="gpm-uprising-readiness" aria-label="Declaration requirements">' + items.map(({ ready, text }) =>
    '<li><strong class="' + (ready ? "gpm-uprising-ready" : "") + '">' + (ready ? "Ready" : "Required")
    + "</strong><span>" + b(text) + "</span></li>").join("") + "</ul>";
}


function gpmUprisingPanel(state, ui) {
  const data = state.data;
  const button = (action, label, disabled = false) =>
    '<button class="k" type="button" data-gpm-uprising-action="' + action + '"'
    + (disabled || state.busy || (state.loading && !["openMap", "closeMap", "cancel"].includes(action)) ? " disabled" : "") + ">" + label + "</button>";
  const actions = (...buttons) => '<div class="gpm-uprising-actions">' + buttons.join("") + "</div>";
  if (!data) return state.loading ? "" : actions(button("refresh", "Load uprising"));
  const party = data.partyName || state.partyName || "Your party";
  const region = data.provinceKey ? Ut(data.provinceKey, data.regionName) : data.regionName;
  const seatOutcome = data.singleParty ? " and holds every seat in the assembly" : " under the new constitution";
  const percent = new Intl.NumberFormat(cs(), { style: "percent", maximumFractionDigits: 2 });
  const before = Number.isFinite(data.nationalSupport) ? percent.format(data.nationalSupport) : "—";
  const after = Number.isFinite(data.victorySupport) ? percent.format(data.victorySupport) : "—";
  const lawChanges = Array.isArray(data.charterLaws) ? data.charterLaws : [];
  const charter = lawChanges.length
    ? '<details data-gpm-uprising-charter><summary>' + lawChanges.length
      + (lawChanges.length === 1 ? " law change" : " law changes")
      + '</summary><ul class="gpm-uprising-charter">' + lawChanges.map(law =>
        "<li>" + b(law.name || tr(law.lawId)) + " · " + b(law.option || (dl(law.lawId) ? yo(dl(law.lawId), law.value, null) : law.choiceId)) + "</li>").join("") + "</ul></details>"
    : "<small>The policy review found no law changes.</small>";
  if (data.phase === "active") {
    const note = data.warStatus === "suspended"
      ? "Hostilities are suspended. The uprising remains unresolved."
      : "The decisive result will determine which side governs the reunited country.";
    const summary = data.warStatus === "suspended"
      ? b(data.breakawayName) + " and " + b(data.parentName)
      : b(data.breakawayName) + " is at war with " + b(data.parentName);
    const restoration = data.restoresOriginalName ? "<p>Breakaway victory restores <strong>"
      + b(data.victoryName) + "</strong>.</p>" : "";
    const startingRegions = (data.defectingRegions || []).map(key => {
      const province = ui.globe?.world?.provByKey?.get?.(key);
      return b(Ut(key, province?.__name || key));
    });
    const preparations = startingRegions.length
      ? "<p>Regions at declaration: " + startingRegions.join(", ")
        + ". Prepared divisions deployed: " + b(String(data.deployedCount || 0)) + ".</p>" + gpmUprisingRoster(data.deployedRoster)
      : "";
    return "<p><strong>" + summary + "</strong></p><p>" + note + "</p>" + restoration + preparations
      + actions(button("war", "Open War Theatre"));
  }
  if (data.phase === "settled") {
    const victory = data.result === "breakaway";
    if (data.result === "breakaway" || data.result === "government") {
      return victory
        ? "<p><strong>Breakaway victory.</strong> " + b(party) + " governs the reunited " + b(data.victoryName || data.breakawayName)
          + seatOutcome + ".</p><p>" + b(data.government) + ". The founding laws are in effect.</p>" + charter
          + (Number.isFinite(data.victorySupport) ? "<p>Base national support at reunification was " + b(after) + ".</p>" : "")
        : "<p><strong>Government victory.</strong> " + b(data.parentName) + " is reunited. " + b(party) + " is banned.</p>";
    }
    return "<p><strong>Conflict ended without a decisive result.</strong> The two governments remain separate.</p>";
  }
  const preparations = gpmUprisingPreparations(state, ui, button);
  const readiness = data.preparations && !state.confirm ? gpmUprisingReadiness(data.preparations, percent) : "";
  if (state.mapOpen && preparations) return preparations;
  if (!data.available || data.phase !== "ready" || typeof data.quoteId !== "string") {
    return readiness + preparations + "<p>" + b(gpmUprisingReason(data.reason)) + "</p>" + actions(button("refresh", "Refresh", state.loading));
  }
  const otherRegions = data.preparations?.regions.filter(entry => entry.defects && !entry.starting) || [];
  const deployment = data.preparations?.deploymentCount;
  const preparationSummary = data.preparations
    ? "<dt>Other regions joining</dt><dd>"
      + (otherRegions.length ? otherRegions.map(entry => b(Ut(entry.key, entry.name))).join(", ") : "None")
      + "</dd><dt>Prepared divisions ready to deploy</dt><dd>" + b(String(deployment ?? 0)) + gpmUprisingRoster(data.preparations.division.roster) + "</dd>"
    : "";
  const name = data.restoresOriginalName ? data.breakawayName : state.selectedName || data.breakawayName;
  const options = (data.names || []).map(option => '<option' + (option === name ? " selected" : "")
    + ">" + b(option) + "</option>").join("");
  const nameField = !data.restoresOriginalName && !state.confirm && data.names?.length > 1
    ? '<select aria-label="Breakaway name" data-gpm-uprising-name data-gpm-uprising-field="name">' + options + "</select>"
    : b(name);
  const victorySeats = data.singleParty ? " and holds every seat in its single-party assembly."
    : " under the new constitution. The reunited assembly keeps its sitting members until an election.";
  const nameOutcome = data.restoresOriginalName ? "Victory restores <strong>" + b(data.victoryName) + "</strong>."
    : "The reunited country keeps the breakaway name.";
  const heading = state.confirm ? "Confirm declaration" : "Declaration preview";
  const controls = state.confirm
    ? actions(button("cancel", "Cancel"), button("declare", "Declare Uprising", state.loading))
    : actions(button("review", "Review Declaration", state.loading), button("refresh", "Refresh", state.loading));
  return readiness + preparations + "<p><strong>" + heading + "</strong></p>"
    + '<dl class="gpm-uprising-details"><dt>Party</dt><dd>' + b(party)
    + "</dd><dt>" + (data.restoresOriginalName ? "Wartime name" : "Breakaway") + "</dt><dd>" + nameField
    + "</dd><dt>Government</dt><dd>" + b(data.government)
    + (data.ideologyProgram ? "</dd><dt>Founding program</dt><dd>" + b(data.ideologyProgram) : "")
    + "</dd><dt>Starting region</dt><dd>" + b(region)
    + "</dd>" + preparationSummary + "<dt>Current base national support</dt><dd>" + b(before) + "</dd></dl>"
    + "<p>Declaring transfers your control to the breakaway government based in " + b(region)
    + " and starts a civil war with " + b(data.parentName) + ".</p>"
    + (state.confirm && data.preparations ? "<p>Any unfinished projects and outstanding aid requests end at declaration.</p>" : "")
    + '<div class="gpm-uprising-outcomes">'
    + '<div class="sh-inset"><strong>Breakaway victory</strong><p>Your party takes executive control of the reunited country'
    + victorySeats + "</p><p>" + nameOutcome + " The founding charter takes effect nationwide.</p>"
    + charter + "<p>Base national support rises from " + b(before) + " to " + b(after) + " at reunification.</p></div>"
    + '<div class="sh-inset"><strong>Government victory</strong><p>The incumbent reunites the country and bans your party. '
    + "The campaign continues with the incumbent.</p></div></div>"
    + controls;
}

async function gpmSyncUprisingControl(session) {
  if (ze !== session || !session.playerKey) return;
  const key = session.playerKey;
  if (session._gpmUprisingPresentedKey === key) return;
  session._gpmUprisingPresentedKey = key;
  try {
    await SCt({ current: { countryKey: key } });
  } catch (error) {
    console.warn("[PPO] Uprising player control presentation failed", error);
  }
}

function gpmWatchUprisingControl(session) {
  const key = session?.playerKey;
  if (!key) return;
  const previous = session._gpmUprisingObservedKey;
  session._gpmUprisingObservedKey = key;
  if (previous && previous !== key && (previous.startsWith("ppo-uprising-") || key.startsWith("ppo-uprising-"))) {
    void gpmSyncUprisingControl(session);
  }
}

function gpmBindUprising(profile, view, ui) {
  const panel = profile.querySelector(".gpm-uprising");
  const session = ui._mpSession;
  if (!panel || !session) return;
  const countryKey = view.player?.key;
  const partyId = view.party?.dashboard?.partyId ?? view.party?.parliament?.partyId;
  let state = ui._gpmUprisingUi;
  if (!state || state.session !== session || state.countryKey !== countryKey || state.partyId !== partyId) {
    state = ui._gpmUprisingUi = { session, countryKey, partyId, loading: false, busy: false, confirm: false, status: "" };
  }

  const content = panel.querySelector("[data-gpm-uprising-content]");
  const status = panel.querySelector("[data-gpm-uprising-status]");
  const isCurrent = () => ui._mpSession === session && ui._gpmUprisingUi === state;
  const focus = action => content.querySelector('[data-gpm-uprising-action="' + action + '"]')?.focus({ preventScroll: true });

  const paint = () => {
    if (!panel.isConnected) return;
    const html = gpmUprisingPanel(state, ui);
    if (content._gpmUprisingHtml !== html) {
      const active = content.contains(document.activeElement) ? document.activeElement : null;
      const selectedField = active?.matches("select") ? active.dataset.gpmUprisingField : null;
      const activeRegion = active?.dataset.gpmUprisingRegionRow;
      const listScroll = content.querySelector(".gpm-uprising-region-list")?.scrollTop;
      const expanded = content.querySelector("[data-gpm-uprising-charter]")?.open;
      content.innerHTML = html;
      content._gpmUprisingHtml = html;
      const details = content.querySelector("[data-gpm-uprising-charter]");
      if (details && expanded) details.open = true;
      const list = content.querySelector(".gpm-uprising-region-list");
      if (list && listScroll) list.scrollTop = listScroll;
      if (selectedField) content.querySelector('[data-gpm-uprising-field="' + selectedField + '"]')?.focus({ preventScroll: true });
      else if (activeRegion) list?.querySelector('[data-gpm-uprising-region-row="' + activeRegion + '"]')?.focus({ preventScroll: true });
      else if (active?.dataset.gpmUprisingAction) focus(active.dataset.gpmUprisingAction);
    }
    status.textContent = state.loading ? "Checking the current uprising details…" : state.status;
  };
  const currentParty = view.player?.pol?.parties?.find(party => party.id === partyId);
  state.partyName = currentParty ? Sa(currentParty, countryKey) : null;
  state.paint = paint;

  const load = async () => {
    if (state.loading || state.busy || !isCurrent()) return;
    state.loading = true;
    state.requestDay = view.day;
    state.paint();
    try {
      const data = await at(session, "gpm.uprising", {});
      if (!isCurrent()) return;
      if (!data || data.countryKey !== countryKey || (partyId != null && data.partyId !== partyId)) {
        state.data = null;
        state.status = "The uprising details are unavailable for this party.";
        return;
      }
      if (state.data?.quoteId !== data.quoteId && state.confirm) {
        state.confirm = false;
        state.status = gpmUprisingReason("stale");
      }
      if (!data.names?.includes(state.selectedName)) state.selectedName = data.breakawayName;
      state.data = data;
    } catch (error) {
      console.warn("[PPO] Uprising details failed", error);
      if (isCurrent()) state.status = "Could not load the uprising details. Try refreshing.";
    } finally {
      state.loading = false;
      if (isCurrent()) state.paint();
    }
  };

  const declare = async () => {
    if (state.loading || state.busy || !state.confirm || !state.data?.available || !isCurrent()) return;
    state.busy = true;
    state.status = "Declaring the uprising…";
    const { quoteId, restoresOriginalName, breakawayName } = state.data;
    const name = restoresOriginalName ? breakawayName : state.selectedName;
    state.paint();
    let result;
    try {
      result = await Te(session, "applyPlayerAction", [{ verb: "gpm.party.uprising.declare", quoteId, name }]);
      if (result?.ok) {
        if (ze === session) {
          await gpmSyncUprisingControl(session);
          if (ze === session) await ui.openMilitaryMode?.();
        }
        return;
      }
      if (isCurrent()) {
        state.confirm = false;
        state.status = gpmUprisingReason(result?.reason);
      }
    } catch (error) {
      console.warn("[PPO] Uprising action or view refresh failed", error);
      if (isCurrent()) {
        state.confirm = false;
        state.status = result?.ok ? "The uprising began. Open the War Theatre to continue."
          : "Could not verify the declaration. Refresh to check the current status.";
      }
    } finally {
      state.busy = false;
      if (isCurrent() && !result?.ok) {
        state.paint();
        await load();
      }
    }
  };

  const prepare = async action => {
    const prep = state.data?.preparations;
    if (!prep || state.confirm || state.loading || state.busy || !isCurrent()) return;
    const payload = { verb: "gpm.party.uprising." + action, partyId: state.data.partyId };
    if (action === "invest" || action === "headquarters") {
      const region = gpmUprisingSelectedRegion(prep, state.selectedRegion);
      const quote = action === "invest" ? region?.invest : region?.hq;
      if (!quote?.ok) return;
      payload.provinceId = region.id;
      payload.provinceKey = region.key;
    } else if (action === "recruit") {
      const { type, kit } = gpmUprisingSelectedDivision(prep.division, state);
      if (!kit?.quote?.ok) return;
      payload.divisionType = type.id;
      payload.equipmentKit = kit.id;
    } else if (action === "aidRequest") {
      const donorId = content.querySelector("[data-gpm-uprising-donor]")?.value;
      const donor = prep.foreignAid.donors.find(entry => JSON.stringify([entry.countryKey, entry.partyId]) === donorId);
      if (!donor) return;
      payload.donorCountryKey = donor.countryKey;
      payload.donorPartyId = donor.partyId;
    } else if (action === "aidAccept" || action === "aidDecline") {
      if (!prep.foreignAid.offer) return;
      payload.requestId = prep.foreignAid.offer.requestId;
    }
    const success = {
      form: "Party wing formed.",
      invest: "Regional investment started.",
      headquarters: "Headquarters project started.",
      recruit: "Division preparation started.",
      aidRequest: "Foreign aid requested.",
      aidAccept: "Foreign aid accepted.",
      aidDecline: "Foreign aid declined.",
    };
    state.busy = true;
    state.status = "Applying the preparation…";
    state.paint();
    try {
      const result = await Te(session, "applyPlayerAction", [payload]);
      if (isCurrent()) state.status = result?.ok ? success[action] : gpmUprisingPreparationReason(result?.reason);
    } catch (error) {
      console.warn("[PPO] Uprising preparation failed", error);
      if (isCurrent()) state.status = "Could not verify the preparation. Check the current status.";
    } finally {
      state.busy = false;
      if (isCurrent()) await load();
    }
  };
  content.onchange = event => {
    if (event.target.matches("[data-gpm-uprising-name]")) state.selectedName = event.target.value;
    if (event.target.matches("[data-gpm-uprising-map-layer]")) {
      state.mapLayer = event.target.value;
      state.paint();
    }
    if (event.target.dataset.gpmUprisingField === "division-type") {
      state.divisionType = event.target.value;
      state.equipmentKit = null;
      state.paint();
    }
    if (event.target.dataset.gpmUprisingField === "equipment-kit") {
      state.equipmentKit = event.target.value;
      state.paint();
    }
    if (event.target.matches("[data-gpm-uprising-donor]")) {
      state.selectedDonor = event.target.value;
      state.paint();
    }
  };
  content.onclick = event => {
    const region = event.target.closest("[data-gpm-uprising-region], [data-gpm-uprising-region-row]");
    if (region && isCurrent()) {
      state.selectedRegion = region.dataset.gpmUprisingRegion ?? region.dataset.gpmUprisingRegionRow;
      state.paint();
      return;
    }
    const button = event.target.closest("[data-gpm-uprising-action]");
    if (!button || button.disabled || state.busy || !isCurrent()) return;
    const action = button.dataset.gpmUprisingAction;
    if (action === "openMap" || action === "closeMap") {
      state.mapOpen = action === "openMap";
      state.paint();
      focus(state.mapOpen ? "closeMap" : "openMap");
    } else if (action === "refresh") {
      state.status = "";
      void load();
    } else if (action === "review" || action === "cancel") {
      state.confirm = action === "review";
      state.status = "";
      state.paint();
      focus(state.confirm ? "cancel" : "review");
    } else if (action === "declare") {
      void declare();
    } else if (action === "war") {
      void ui.openMilitaryMode?.();
    } else {
      void prepare(action);
    }
  };
  state.paint();
  if (state.requestDay !== view.day) void load();
}

const rendererFunctions = [gpmRenderUprising, gpmUprisingReason, gpmUprisingPreparationReason,
  "const gpmUprisingFootholdBands = " + JSON.stringify(gpmUprisingFootholdBands) + ";",
  gpmUprisingPreparationColor, gpmUprisingSelectedRegion, gpmUprisingRegionalStatus, gpmUprisingMap,
  gpmUprisingSelectedDivision, gpmUprisingRoster, gpmUprisingEquipmentLabel, gpmUprisingDivisionPanel,
  gpmUprisingPreparations, gpmUprisingReadiness, gpmUprisingPanel, gpmSyncUprisingControl,
  gpmWatchUprisingControl, gpmBindUprising];

function patchUprisingRenderer(source) {
  const asBuffer = Buffer.isBuffer(source);
  let js = asBuffer ? source.toString("utf8") : source;
  function replaceOnce(before, after) {
    const index = js.indexOf(before);
    if (index < 0 || js.indexOf(before, index + before.length) >= 0) {
      throw new Error("Unexpected renderer code near " + before);
    }
    js = js.slice(0, index) + after + js.slice(index + before.length);
  }

  const tab = 'tabs.push(["laws", "Law Shortlist", gpmRenderPartyLaws()]);';
  replaceOnce(tab, tab + '\n  tabs.push(["uprising", "Uprising", gpmRenderUprising()]);');
  const bind = 'if (tab.id === "gpm-tab-laws") gpmBindPartyLaws(profile, view, ui);';
  replaceOnce(bind, bind + '\n    if (tab.id === "gpm-tab-uprising") gpmBindUprising(profile, view, ui);');
  const styleMount = "style.textContent += gpmRegionalMapStyle + gpmForeignFundingStyle + gpmLawShortlistStyle;";
  replaceOnce(styleMount, styleMount.replace(";", " + gpmUprisingStyle;"));
  const initialize = "\nmountPartyButtons();\n";
  replaceOnce(initialize, "\nconst gpmUprisingStyle = " + JSON.stringify(style) + ";\n"
    + rendererFunctions.join("\n") + initialize);
  const frame = "function DFe(){let e=ze.consumeViewDelta";
  replaceOnce(frame, "function DFe(){gpmWatchUprisingControl(ze);let e=ze.consumeViewDelta");
  return asBuffer ? Buffer.from(js) : js;
}

module.exports = { patchUprisingRenderer };

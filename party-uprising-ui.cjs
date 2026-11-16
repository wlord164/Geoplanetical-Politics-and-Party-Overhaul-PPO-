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
  ".gpm-uprising-flag { display: flex; align-items: center; flex-wrap: wrap; gap: var(--gap-2); }",
  ".gpm-uprising-flag img { max-width: 3.6rem; max-height: 2.4rem; object-fit: contain; }",
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
    flag: "Choose a supported flag image.",
    case_exists: "An uprising has already taken place in this campaign.",
    founder_control: "Switch to the legal founding party to review an uprising.",
    stale_actor: "Player control changed. Refresh the uprising details and try again.",
    incumbent_required: "An incumbent party must be in government before an uprising can begin.",
    unsupported_party_roles: "Your party must be outside the government and its formal support agreements.",
    war_authority: "The government that won the uprising makes this decision.",
    war_stale: "This choice is no longer available. Check the current war status.",
    territory: "The country needs an unoccupied region outside its capital with a land border to the rest of the country.",
    headquarters_required: "Establish party headquarters to set your starting region.",
    headquarters_region: "Relocate party headquarters to an eligible region.",
    headquarters_foothold: "Raise foothold in your headquarters region to the target shown above.",
    division_required: "Complete training and receive equipment for at least one division before declaring.",
    division_manpower: "The joining regions cannot staff a prepared division.",
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
    headquarters_required: "Establish an eligible party headquarters to receive equipment.",
    headquarters_region: "The capital, occupied regions, and ineligible territories cannot host the uprising headquarters.",
    division_terms: "Select an available division type and equipment kit.",
    foreign_funding_required: "Accept a grant in My Party > Foreign Funding to unlock Standard equipment.",
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
    state.geometry = { world, signature, layout: features.length ? I_(features, 620, 510, { pad: 12 }) : null };
  }
  const layout = state.geometry?.layout;
  const svg = (paths, width, height) => '<svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="'
    + (layer === "control" ? "Projected control at declaration" : "Regional foothold") + '">'
    + [...paths].sort((a, b) => Number(!!byId.get(a.provId)?.headquarters) - Number(!!byId.get(b.provId)?.headquarters))
      .map(({ provId, d }) => {
      const region = byId.get(provId);
      if (!region) return "";
      return '<path d="' + v(d) + '" data-gpm-uprising-region="' + v(String(provId)) + '" '
        + (region === selected ? "data-selected " : "") + (region.headquarters ? "data-gpm-uprising-hq " : "")
        + 'fill="' + gpmUprisingPreparationColor(region, layer) + '"><title>' + v(name(region))
        + ' · ' + v(percent.format(region.foothold)) + ' foothold · ' + v(control(region)) + '</title></path>';
    }).join("") + '</svg>';
  const swatch = (color, label) => '<span><i class="gpm-uprising-swatch" style="background:' + color + '" aria-hidden="true"></i>'
    + v(label) + "</span>";
  const legend = layer === "control"
    ? swatch(gpmUprisingPreparationColor({}, "control"), "Government")
      + swatch(gpmUprisingPreparationColor({ defects: true }, "control"), "Breakaway")
    : gpmUprisingFootholdBands.map(({ color, label }) => swatch(color, label)).join("");
  const controlSelect = '<label class="gpm-uprising-map-tools">Map layer <select class="k" data-gpm-uprising-map-layer data-gpm-uprising-field="layer">'
    + '<option value="foothold"' + (layer === "foothold" ? " selected" : "") + '>Foothold</option>'
    + '<option value="control"' + (layer === "control" ? " selected" : "") + '>Projected control</option></select></label>';
  const geometry = layout ? svg(layout.paths, layout.W, layout.H)
    + (layout.insets.length ? '<div class="gpm-support-insets">' + layout.insets.map(inset =>
      '<div>' + svg(inset.paths, layout.box, layout.box) + '<small>' + v(inset.label) + '</small></div>').join("") + '</div>' : "")
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
    const staffing = Number.isFinite(unit.manpowerK)
      ? " · " + gpmUprisingPersonnel(unit.manpowerK) + " / " + gpmUprisingPersonnel(unit.requiredK) + " personnel"
        + (unit.understrength ? " · Understrength at declaration" : "")
      : "";
    const recruits = unit.cadreK ?? unit.activistsK;
    const label = unit.label + " · " + unit.kitLabel + staffing
      + (recruits > 0 ? " · " + gpmUprisingPersonnel(recruits) + " party recruits" : "");
    grouped.set(label, (grouped.get(label) || 0) + 1);
  }
  return '<ul class="gpm-uprising-roster">' + [...grouped].map(([label, count]) =>
    "<li>" + v(String(count)) + " × " + v(label) + "</li>").join("") + "</ul>";
}

function gpmUprisingPersonnel(amountK) {
  return new Intl.NumberFormat(ks(), { maximumFractionDigits: 0 }).format(amountK * 1000);
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
  const cost = Number.isFinite(quote?.cash) && Number.isFinite(quote?.activistsK)
    ? money(quote.cash) + (quote.creditCost > 0 ? " + " + credits(quote.creditCost) : "")
      + " · " + gpmUprisingPersonnel(quote.activistsK) + " activists leave the party pool permanently."
    : "";
  const opts = (choices, selected) => choices.map(choice =>
    '<option value="' + v(choice.id) + '"' + (selected === choice ? " selected" : "") + ">" + v(choice.label) + "</option>").join("");
  const equipmentList = items => (items || []).filter(item => item.units > 0).map(item =>
    Number(item.units).toLocaleString(ks()) + " " + gpmUprisingEquipmentLabel(item)).join(" · ");
  const equipment = equipmentList(kit?.equipment);
  const stock = equipmentList(division.stockpile);
  const headquarters = prep.headquarters;
  const destination = headquarters?.eligible && headquarters.name || "party headquarters";
  const stockpile = stock || headquarters?.eligible
    ? "<p><strong>HQ stockpile</strong> · " + v(stock ? stock + " reserved for divisions" : "Empty") + "</p>"
    : "";
  const schedule = quote?.ok && Number.isFinite(quote.deliveryDay) && Number.isFinite(quote.endDay)
    ? "<small>Equipment arrives at " + v(destination) + " on " + v(date(quote.deliveryDay)) + ". Division ready on "
      + v(date(quote.endDay)) + ".</small>" : "";
  const project = division.project;
  const delivery = project?.delivered ? "Equipment reserved at headquarters."
    : project?.deliveryPaused ? "Equipment delivery is waiting for an eligible headquarters."
    : Number.isFinite(project?.deliveryDay) ? "Equipment due " + date(project.deliveryDay) + "." : "";
  const controls = project
    ? "<p>" + v(project.label || "Division") + (project.kitLabel ? " · " + v(project.kitLabel) : "")
      + "</p>" + (delivery ? "<small>" + v(delivery) + "</small>" : "")
      + "<small>" + (project.deliveryPaused ? "Training scheduled to finish " : "Ready ") + v(date(project.endDay)) + (project.activistsK
        ? " · " + v(gpmUprisingPersonnel(project.activistsK)) + " activists recruited" : "") + ".</small>"
    : kit
      ? '<label class="gpm-uprising-prep-item">Division type<select class="k" data-gpm-uprising-field="division-type">'
        + opts(options, type) + '</select></label>'
        + '<label class="gpm-uprising-prep-item">Equipment kit<select class="k" data-gpm-uprising-field="equipment-kit">'
        + opts(type.kits, kit) + '</select></label>'
        + (equipment ? "<small>" + v(equipment) + "</small>" : "")
        + "<small>" + v(cost + reason(quote)) + "</small>" + schedule + button("recruit", "Prepare Division", !quote?.ok)
      : "<small>Division preparation is unavailable.</small>";
  const capacity = "Capacity grows by one for each eligible region at " + percent.format(prep.capacityThreshold)
    + " foothold, plus one when the headquarters reaches " + percent.format(prep.threshold) + ".";
  return '<div class="sh-inset"><strong>Prepared divisions</strong><p>' + v(String(division.count)) + " of "
    + v(String(division.limit)) + " prepared · " + v(credits(division.credits)) + " available</p>"
    + stockpile + gpmUprisingRoster(division.roster) + "<small>" + v(capacity)
    + " Prepared divisions use the joining regions’ available personnel and deploy at headquarters.</small>" + controls + "</div>";
}


function gpmUprisingPreparations(state, ui, button) {
  const prep = state.data.preparations;
  if (!prep || state.confirm) return "";
  const { regions, wing, division, foreignAid, threshold } = prep;
  const percent = new Intl.NumberFormat(ks(), { style: "percent", maximumFractionDigits: 1 });
  const number = new Intl.NumberFormat(ks(), { maximumFractionDigits: 1 });
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
    + [...regions].sort((a, b) => name(a).localeCompare(name(b), ks())).map(region => {
      const color = gpmUprisingPreparationColor(region, state.mapLayer || "foothold");
      return '<li><button class="k" type="button" data-gpm-uprising-region-row="' + v(String(region.id))
        + '" aria-pressed="' + (region === selected) + '"><i class="gpm-uprising-swatch" style="background:' + color
        + '" aria-hidden="true"></i><span><strong>' + v(name(region)) + '</strong><small>'
        + v(gpmUprisingRegionalStatus(region, threshold)) + '</small></span><strong>'
        + v(percent.format(region.foothold)) + '</strong></button></li>';
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
      ? "<p>Headquarters project" + (activeHQProject ? " in " + v(name(activeHQProject)) : "")
        + " completes " + v(date(hqProject.endDay)) + "." + (prep.headquarters.key ? " Your current headquarters stays open until then." : "") + "</p>"
      : selected.headquarters ? "" : '<small>' + v(hqTerms + reason(hqQuote)) + '</small>'
        + button("headquarters", hqQuote?.relocate ? "Relocate Headquarters Here" : "Establish Headquarters Here", !hqQuote?.ok);

    investment = `<div class="sh-inset gpm-uprising-prep-item">
      <h4>${v(name(selected))}</h4>
      <p><strong class="gpm-uprising-foothold">${v(percent.format(selected.foothold))} foothold</strong> · ${v(gpmUprisingRegionalStatus(selected, threshold))}</p>
      ${contributors.length ? "<small>" + v(contributors.join(" · ")) + "</small>" : ""}
      <small>Invest in Foothold builds uprising readiness. For electoral projects, open Regional Campaigning.</small>
      ${button("regional", "Open Regional Campaigning")}
      ${hqControls}
      ${project ? `<small>Investment completes ${v(date(project.endDay))} · +${v(points(project.gain))} foothold.</small>`
        : `<small>${v(terms + reason(quote))}</small>${button("invest", "Invest in Foothold", !quote?.ok)}`}</div>`;
  }
  const wingQuote = wing.quote;
  const wingTerms = Number.isFinite(wingQuote?.cash) ? money(wingQuote.cash) + " from the party treasury." : "";
  const wingPanel = `<div class="sh-inset"><strong>Party wing</strong>
    ${wing.formed ? "<p>Formed. You can invest in footholds, prepare divisions, and request foreign aid.</p>"
      : `<p>Forming the wing unlocks foothold investments, division preparation, and foreign aid.</p><small>${v(wingTerms + reason(wingQuote))}</small>
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
    aid = `<p>${v(donorName(offer.donor))} offered ${v(credits(offer.credits))}. Expires ${v(date(offer.expiresDay))}.</p>
      <div class="gpm-uprising-actions">${button("aidAccept", "Accept Offer")}${button("aidDecline", "Decline Offer")}</div>`;
  } else if (pending) {
    aid = `<p>Waiting for ${v(donorName(pending.donor))}. Response due ${v(date(pending.responseDay))}.</p>`;
  } else if (wing.formed) {
    const cooldown = foreignAid.nextRequestDay > state.data.day;
    const options = donors.map(entry => `<option value="${v(donorKey(entry))}" ${entry === donor ? "selected" : ""}>${v(donorName(entry))}</option>`).join("");
    aid = cooldown ? "<p>Next request available " + v(date(foreignAid.nextRequestDay)) + ".</p>" : donor ? `<label class="gpm-uprising-prep-item">Donor<select class="k" data-gpm-uprising-donor data-gpm-uprising-field="donor">${options}</select></label>
      <p>${v(percent.format(donor.chance))} chance of an offer · ${v(credits(donor.credits))} if approved</p>
        ${button("aidRequest", "Request Aid", donor.chance <= 0)}`
      : "<p>No foreign party is currently available to offer aid.</p>";
  }
  const aidPanel = `<div class="sh-inset"><strong>Foreign aid</strong>
    <small>Aid credits reduce the treasury cost of preparing divisions.</small>${aid}
    ${lastResult ? `<small>${v(date(last.day))} · ${last.donor ? v(donorName(last.donor)) + " · " : ""}${v(lastResult)}</small>` : ""}</div>`;
  const regional = selected ? `<div class="gpm-uprising-map-layout${state.mapOpen ? " gpm-uprising-map-expanded" : ""}">
    ${map}<div class="gpm-uprising-prep-item">${regionList}${investment}
      <small>Additional regions need ${v(percent.format(threshold))} foothold and a connection to the starting region.
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
    { ready: division.count > 0, text: division.count > 0 ? "At least one division trained and equipped" : "Train and equip at least one division" },
  ];
  if (headquarters?.key && !headquarters.eligible) items[0].text = "Relocate headquarters to an eligible region";
  return '<ul class="gpm-uprising-readiness" aria-label="Declaration requirements">' + items.map(({ ready, text }) =>
    '<li><strong class="' + (ready ? "gpm-uprising-ready" : "") + '">' + (ready ? "Ready" : "Required")
    + "</strong><span>" + v(text) + "</span></li>").join("") + "</ul>";
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
  const percent = new Intl.NumberFormat(ks(), { style: "percent", maximumFractionDigits: 2 });
  const before = Number.isFinite(data.nationalSupport) ? percent.format(data.nationalSupport) : "—";
  const after = Number.isFinite(data.victorySupport) ? percent.format(data.victorySupport) : "—";
  const lawChanges = Array.isArray(data.charterLaws) ? data.charterLaws : [];
  const charter = lawChanges.length
    ? '<details data-gpm-uprising-charter><summary>' + lawChanges.length
      + (lawChanges.length === 1 ? " law change" : " law changes")
      + '</summary><ul class="gpm-uprising-charter">' + lawChanges.map(law =>
        "<li>" + v(law.name || Un(law.lawId)) + " · " + v(law.option || (Ds(law.lawId) ? xi(Ds(law.lawId), law.value, null) : law.choiceId)) + "</li>").join("") + "</ul></details>"
    : "<small>The policy review found no law changes.</small>";
  if (data.phase === "active") {
    const note = data.warStatus === "suspended"
      ? "Hostilities are suspended. The uprising remains unresolved."
      : "The decisive result will determine which side governs the reunited country.";
    const summary = data.warStatus === "suspended"
      ? v(data.breakawayName) + " and " + v(data.parentName)
      : v(data.breakawayName) + " is at war with " + v(data.parentName);
    const restoration = data.restoresOriginalName ? "<p>Breakaway victory restores <strong>"
      + v(data.victoryName) + "</strong>.</p>" : "";
    const startingRegions = (data.defectingRegions || []).map(key => {
      const province = ui.globe?.world?.provByKey?.get?.(key);
      return v(Ut(key, province?.__name || key));
    });
    const preparations = startingRegions.length
      ? "<p>Regions at declaration: " + startingRegions.join(", ")
        + ". Prepared divisions deployed: " + v(String(data.deployedCount || 0)) + " of "
        + v(String(data.preparedDivisionCount || 0)) + ".</p>" + gpmUprisingRoster(data.deployedRoster)
      : "";
    return "<p><strong>" + summary + "</strong></p><p>" + note + "</p>" + restoration + preparations
      + actions(button("war", "Open War Theatre"));
  }
  if (data.phase === "settled") {
    const victory = data.result === "breakaway";
    if (data.result === "breakaway" || data.result === "government") {
      return victory
        ? "<p><strong>Breakaway victory.</strong> " + v(party) + " governs the reunited " + v(data.victoryName || data.breakawayName)
          + seatOutcome + ".</p>"
          + "<p>" + v(data.government) + ". The founding laws are in effect.</p>" + charter
          + (data.integratedDivisions ? "<p>Breakaway divisions transferred to the national military: "
            + v(String(data.integratedDivisions)) + ".</p>" : "")
          + (Number.isFinite(data.victorySupport) ? "<p>Base national support at reunification was " + v(after) + ".</p>" : "")
        : "<p><strong>Government victory.</strong> " + v(data.parentName) + " is reunited. " + v(party) + " is banned.</p>";
    }
    return "<p><strong>Conflict ended without a decisive result.</strong> The two governments remain separate.</p>";
  }
  const preparations = gpmUprisingPreparations(state, ui, button);
  const readiness = data.preparations && !state.confirm ? gpmUprisingReadiness(data.preparations, percent) : "";
  if (state.mapOpen && preparations) return preparations;
  if (!data.available || data.phase !== "ready" || typeof data.quoteId !== "string") {
    return readiness + preparations + "<p>" + v(gpmUprisingReason(data.reason)) + "</p>" + actions(button("refresh", "Refresh", state.loading));
  }
  const otherRegions = data.preparations?.regions.filter(entry => entry.defects && !entry.starting) || [];
  const deployment = data.preparations?.deploymentCount;
  const manpower = data.preparations?.manpower;
  const preparationSummary = data.preparations
    ? "<dt>Other regions joining</dt><dd>"
      + (otherRegions.length ? otherRegions.map(entry => v(Ut(entry.key, entry.name))).join(", ") : "None")
      + "</dd><dt>Prepared divisions</dt><dd>" + v(String(deployment ?? 0)) + gpmUprisingRoster(data.preparations.division.roster) + "</dd>"
      + (manpower ? "<dt>Estimated deployment personnel</dt><dd>" + v(gpmUprisingPersonnel(manpower.availableK))
        + " / " + v(gpmUprisingPersonnel(manpower.requiredK)) + (manpower.availableK < manpower.requiredK
          ? ". Understrength formations need reinforcements." : "") + "</dd>" : "")
    : "";
  const name = data.restoresOriginalName ? data.breakawayName : state.selectedName || data.breakawayName;
  const options = (data.names || []).map(option => '<option' + (option === name ? " selected" : "")
    + ">" + v(option) + "</option>").join("");
  const nameField = !data.restoresOriginalName && !state.confirm && data.names?.length > 1
    ? '<select aria-label="Breakaway name" data-gpm-uprising-name data-gpm-uprising-field="name">' + options + "</select>"
    : v(name);
  const flagField = '<div class="gpm-uprising-flag">' + (state.flag
    ? '<img src="' + v(state.flag.src) + '" alt="Selected breakaway flag">'
      + (state.confirm ? "Selected flag" : button("removeFlag", "Use parent flag"))
    : "Parent country’s flag") +
    (state.confirm ? "" : '<label>Choose flag image <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" data-gpm-uprising-flag></label>') + "</div>";
  const victorySeats = data.singleParty ? " and holds every seat in its single-party assembly."
    : " under the new constitution. The reunited assembly keeps its sitting members until an election.";
  const nameOutcome = data.restoresOriginalName ? "Victory restores <strong>" + v(data.victoryName) + "</strong>."
    : "The reunited country keeps the breakaway name.";
  const heading = state.confirm ? "Confirm declaration" : "Declaration preview";
  const vacatedSeats = data.vacatedSeats > 0
    ? "<p>Your party gives up " + v(String(data.vacatedSeats))
      + (data.vacatedSeats === 1 ? " seat" : " seats")
      + " in the original legislature when you declare. Larger parties receive priority in the redistribution.</p>"
    : "";
  const controls = state.confirm
    ? actions(button("cancel", "Cancel"), button("declare", "Declare Uprising", state.loading))
    : actions(button("review", "Review Declaration", state.loading), button("refresh", "Refresh", state.loading));
  return readiness + preparations + "<p><strong>" + heading + "</strong></p>"
    + '<dl class="gpm-uprising-details"><dt>Party</dt><dd>' + v(party)
    + "</dd><dt>" + (data.restoresOriginalName ? "Wartime name" : "Breakaway") + "</dt><dd>" + nameField
    + "</dd><dt>Breakaway flag</dt><dd>" + flagField
    + "</dd><dt>Government</dt><dd>" + v(data.government)
    + (data.ideologyProgram ? "</dd><dt>Founding program</dt><dd>" + v(data.ideologyProgram) : "")
    + "</dd><dt>Starting region</dt><dd>" + v(region)
    + "</dd>" + preparationSummary + "<dt>Current base national support</dt><dd>" + v(before) + "</dd></dl>"
    + "<p>Declaring transfers your control to the breakaway government based in " + v(region)
    + " and starts a civil war with " + v(data.parentName) + ".</p>"
    + vacatedSeats
    + (state.confirm && data.preparations ? "<p>Any unfinished projects and outstanding aid requests end at declaration.</p>" : "")
    + '<div class="gpm-uprising-outcomes">'
    + '<div class="sh-inset"><strong>Breakaway victory</strong><p>Your party takes executive control of the reunited country'
    + victorySeats + "</p><p>" + nameOutcome + " The founding charter takes effect nationwide.</p>"
    + charter + "<p>Base national support rises from " + v(before) + " to " + v(after) + " at reunification.</p></div>"
    + '<div class="sh-inset"><strong>Government victory</strong><p>The incumbent reunites the country and bans your party. '
    + "The campaign continues with the incumbent.</p></div></div>"
    + controls;
}

async function gpmSyncUprisingControl(session) {
  if (Ge !== session || !session.playerKey) return;
  const key = session.playerKey;
  if (session._gpmUprisingPresentedKey === key) return;
  session._gpmUprisingPresentedKey = key;
  try {
    await YLt({ current: { countryKey: key } });
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
      const data = await Je(session, "gpm.uprising", {});
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
      result = await Le(session, "applyPlayerAction", [{ verb: "gpm.party.uprising.declare", quoteId, name, flag: state.flag,
        ...gpmExpectedActor(state.data.countryKey, state.data.partyId, state.data) }]);
      if (result?.ok) {
        if (Ge === session) {
          await gpmSyncUprisingControl(session);
          if (Ge === session) await ui.openMilitaryMode?.();
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
    const payload = { verb: "gpm.party.uprising." + action, partyId: state.data.partyId,
      ...gpmExpectedActor(state.data.countryKey, state.data.partyId, state.data) };
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
      recruit: "Division preparation and equipment delivery scheduled.",
      aidRequest: "Foreign aid requested.",
      aidAccept: "Foreign aid accepted.",
      aidDecline: "Foreign aid declined.",
    };
    state.busy = true;
    state.status = "Applying the preparation…";
    state.paint();
    try {
      const result = await Le(session, "applyPlayerAction", [payload]);
      if (isCurrent()) state.status = result?.ok ? success[action] : gpmUprisingPreparationReason(result?.reason);
    } catch (error) {
      console.warn("[PPO] Uprising preparation failed", error);
      if (isCurrent()) state.status = "Could not verify the preparation. Check the current status.";
    } finally {
      state.busy = false;
      if (isCurrent()) await load();
    }
  };
  content.onchange = async event => {
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
    if (!event.target.matches("[data-gpm-uprising-flag]") || state.busy || state.confirm || !isCurrent()) return;
    const file = event.target.files?.[0];
    if (!file) return;
    const request = state.flagRequest = {};
    state.status = "Reading flag image…";
    state.paint();
    let image;
    try { image = await WF(file); } catch {}
    if (!isCurrent() || request !== state.flagRequest) return;
    state.flagRequest = null;
    if (image) state.flag = { src: image.src, ratio: image.ratio };
    state.status = image ? "" : "That image could not be read as a flag.";
    state.paint();
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
    } else if (action === "regional") {
      if (state.selectedRegion) {
        ui._gpmSupportSelection = { key: countryKey, party: partyId, province: state.selectedRegion };
      }
      profile.querySelector("#gpm-tab-regional")?.click();
      profile.querySelector("#gpm-tab-regional")?.focus({ preventScroll: true });
    } else if (action === "removeFlag") {
      state.flagRequest = null;
      state.flag = null;
      state.status = "";
      state.paint();
    } else if (action === "review" || action === "cancel") {
      if (state.flagRequest) return;
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
  gpmUprisingSelectedDivision, gpmUprisingRoster, gpmUprisingPersonnel, gpmUprisingEquipmentLabel, gpmUprisingDivisionPanel,
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
  const flagLookup = "function d5(e){return n8(),e=du(e),e?rR.get(e)||Hq.get(e)||Zw(e):null}";
  const { dynamicFlagKey } = require("./party-uprising.cjs");
  replaceOnce("pwe=e=>u3t.test(a8(e))||zte(a8(e))!==null",
    `pwe=e=>u3t.test(a8(e))||zte(a8(e))!==null||${dynamicFlagKey}.test(a8(e))`);
  replaceOnce(flagLookup, `function d5(e){
    const data=n8(),key=du(e);
    if(!key)return null;
    const choice=data?.gpmUprisingFlags?.[key],parent=choice?.parentFlag;
    return rR.get(key)||(choice?.src?{url:choice.src,ratio:choice.ratio}:null)||Hq.get(key)||Zw(key)||
      (parent&&(rR.get(parent)||Hq.get(parent)||Zw(parent)))||null;
  }`);
  replaceOnce("function p5(e){return ywe(n8(),e)}",
    'function p5(e){const data=n8(), mode=ywe(data,e), legacy=data?.gpmUprisingFlags?.[du(e)];return mode==="base"&&legacy?.parentFlag&&legacy.src?"image":mode}');
  replaceOnce("function Jw(e){let t=n8();return t?.images?.[t?.image?.[du(e)]]||null}",
    'function Jw(e){const data=n8(),key=du(e),legacy=data?.gpmUprisingFlags?.[key];return data?.images?.[data?.image?.[key]]||(legacy?.parentFlag&&legacy.src?legacy:null)}');
  replaceOnce("function Mwe(e){return n8(),e=du(e),e?Hq.get(e)||Zw(e):null}",
    'function Mwe(e){const data=n8(),key=du(e),parent=data?.gpmUprisingFlags?.[key]?.parentFlag;return key?(Hq.get(key)||Zw(key)||(parent&&(rR.get(parent)||Hq.get(parent)||Zw(parent)))||null):null}');
  const initialize = "\nmountPartyButtons();\n";
  replaceOnce(initialize, "\nconst gpmUprisingStyle = " + JSON.stringify(style) + ";\n"
    + rendererFunctions.join("\n") + initialize);
  const frame = "function tKe(){let e=Ge.consumeViewDelta";
  replaceOnce(frame, "function tKe(){gpmWatchUprisingControl(Ge);let e=Ge.consumeViewDelta");
  return asBuffer ? Buffer.from(js) : js;
}

module.exports = { patchUprisingRenderer };

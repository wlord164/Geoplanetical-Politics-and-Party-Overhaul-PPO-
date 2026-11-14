"use strict";
const { gpmRegionalMapLayout } = require("./party-regional-layout.cjs");

const style = `
  .gpm-regional-overview { display: grid; gap: var(--gap-2); min-width: 0; }
  .gpm-regional-overview button { justify-self: start; }
  .gpm-regional-national { display: grid; gap: var(--gap-1, 4px); }
  .gpm-regional-national p { margin: 0; }
  .gpm-support-map { min-width: 0; display: grid; gap: var(--gap-1); padding: var(--gap-2); border: 1px solid var(--line); background: var(--well); border-radius: var(--r-cell); }
  .gpm-support-map:has([data-gpm-support-insets]) { grid-template-columns: minmax(0, 1fr) clamp(74px, 27%, 143px); align-items: start; }
  .gpm-support-map svg { display: block; width: 100%; height: auto; }
  .gpm-support-map [data-gpm-support-main] { align-self: center; max-height: 22rem; }
  .gpm-support-map path { stroke: #202b38; stroke-width: 1; vector-effect: non-scaling-stroke; cursor: pointer; }
  .gpm-support-map path:hover, .gpm-support-map path:focus-visible, .gpm-support-map path[data-selected] { stroke: #fff2cb; stroke-width: 2; }
  .gpm-support-insets { min-width: 0; display: grid; align-content: start; gap: var(--gap-1, 4px); max-height: 22rem; overflow: auto; }
  .gpm-support-inset { min-width: 0; display: grid; gap: 3px; padding: 5px; border: 1px solid var(--line, #434d59); border-radius: 5px; background: var(--panel, #1c232a); }
  .gpm-support-inset:has([data-selected]) { border-color: #fff2cb; }
  .gpm-support-inset svg { height: clamp(53px, 6vw, 84px); overflow: hidden; }
  .gpm-support-inset small { text-align: center; line-height: 1.2; overflow-wrap: anywhere; }
  .gpm-support-scale { display: grid; gap: .25rem; }
  .gpm-support-scale:empty { display: none; }
  .gpm-support-ramp { height: .5rem; border-radius: .25rem; }
  .gpm-support-ticks { position: relative; min-height: 1.5em; font-variant-numeric: tabular-nums; }
  .gpm-support-ticks small { position: absolute; left: var(--gpm-tick-position); transform: translateX(-50%); white-space: nowrap; }
  .gpm-support-ticks small:first-child { transform: none; }
  .gpm-support-ticks small:last-child { transform: translateX(-100%); }
  .gpm-support-readout { display: flex; align-items: center; flex-wrap: wrap; gap: var(--gap-1) var(--gap-2); }
  .gpm-support-readout select { min-width: 0; max-width: 100%; }
  .gpm-regional-tools { display: grid; gap: .5rem; min-width: 0; }
  .gpm-regional-tools p { margin: 0; }
  .gpm-regional-tools label { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; }
  .gpm-regional-tools select { max-width: 100%; }
  .gpm-regional-projects, .gpm-regional-comparison { display: grid; gap: .5rem; }
  .gpm-regional-projects article, .gpm-regional-comparison article { display: grid; gap: .25rem; min-width: 0; }
  .gpm-regional-projects progress { width: 100%; height: .6rem; }
  .gpm-regional-tools summary { cursor: pointer; }
  .gpm-regional-tools [aria-disabled="true"] { opacity: .65; }
  .gpm-regional-map {
    position: absolute; z-index: 48; top: 76px; right: 16px; bottom: 64px;
    width: min(350px, calc(100% - 32px)); display: grid; align-content: start; gap: 12px;
    box-sizing: border-box; padding: 16px; overflow: auto; color: var(--text, #f0f3f7);
    background: var(--panel, #141c25); border: 1px solid var(--line, #546373); border-radius: 8px;
    box-shadow: 0 8px 24px #0006;
  }
  .gpm-regional-map header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .gpm-regional-map h2, .gpm-regional-map h3, .gpm-regional-map p, .gpm-regional-map dl { margin: 0; }
  .gpm-regional-map small, .gpm-regional-map [data-gpm-region-status] { color: var(--text-2, #b7c6d3); }
  .gpm-regional-map label, .gpm-region-detail { display: grid; gap: 8px; }
  .gpm-regional-map select { width: 100%; }
  .gpm-region-detail dl { display: grid; grid-template-columns: 1fr auto; gap: 4px 12px; }
  .gpm-region-detail dd { margin: 0; text-align: right; font-variant-numeric: tabular-nums; }
  .gpm-region-action { display: grid; gap: 4px; padding-top: 8px; border-top: 1px solid var(--line, #546373); }
  .gpm-region-action button { justify-self: start; }
  .gpm-region-action button[aria-disabled="true"] { opacity: .65; }
  .gpm-regional-breakdown { min-width: 0; padding-block: 6px; }
  .gpm-regional-breakdown summary { cursor: pointer; }
  .gpm-regional-breakdown > summary { font-weight: 600; }
  .gpm-regional-breakdown article { border-block-start: 1px solid var(--line, #546373); padding-block: 6px; }
.gpm-regional-breakdown article summary { display: flex; align-items: start; justify-content: space-between; gap: 12px; overflow-wrap: anywhere; }
  .gpm-regional-breakdown article summary::marker { content: none; }
  .gpm-regional-breakdown article summary::before { content: "▸"; flex: 0 0 auto; }
  .gpm-regional-breakdown article details[open] summary::before { content: "▾"; }
  .gpm-regional-breakdown article strong { flex: 1; }
  .gpm-regional-breakdown article dl { display: grid; grid-template-columns: 1fr auto; gap: 4px 12px; margin: 6px 0 2px; }
  .gpm-regional-breakdown article dd { margin: 0; text-align: right; font-variant-numeric: tabular-nums; }
  @media (max-width: 720px) {
    .gpm-regional-map { top: auto; bottom: 52px; right: 8px; max-height: 46%; width: min(350px, calc(100% - 16px)); }
  }
`;

function gpmRegionalActionName(kind) {
  return { rally: "Hold rally", investment: "Build electoral presence", headquarters: "Establish headquarters",
    meeting: "Public meeting", movement: "Peaceful backing", outreach: "Outreach" }[kind];
}

function gpmRegionalReason(quote, ui) {
  if (!quote || quote.ok) return "";
  if (quote.reason === "cooldown") return "Another rally is available here on " + ui.gameDate(quote.availableDay) + ".";
  return {
    active: "A project of this type is already underway.",
    headquarters: "Your party already has a headquarters.",
    saturated: "Local party presence is at its limit.",
    budget: "The party treasury is too low.",
    resources: "You need more available activists.",
    project_limit: "Your party is at its campaign project limit.",
    limit: "Your party is at its campaign project limit.",
    party: "This action is unavailable for your party.",
    region: "Choose an eligible region in your country.",
    stale: "The quote changed. Review the updated costs and effects before starting.",
  }[quote.reason] || "The action could not be started.";
}

function gpmRegionalRegionName(region) {
  return Ut(region.key, region.name);
}

function gpmRenderRegionalOverview() {
  return `<section class="mcard gpm-regional-overview" aria-label="Regional Campaigning">
    <h3 class="mc-title">Regional party support</h3>
    <div class="gpm-regional-national" data-gpm-regional-national></div>
    <div class="gpm-support-map" data-gpm-support-map></div>
    <div class="gpm-support-scale" data-gpm-support-scale role="group" aria-label="Estimated vote share color scale"></div>
    <label class="gpm-support-readout">Region <select class="k" data-gpm-support-select data-gpm-profile-focus="region"></select></label>
    <small data-gpm-support-readout role="status"></small>
    <div class="gpm-regional-tools" data-gpm-regional-tools></div>
    <small data-gpm-regional-feedback role="status"></small>
    <div data-gpm-support-breakdown></div>
    <button class="k" type="button" data-gpm-open-regional data-gpm-profile-focus="map">Open Campaign Map</button>
  </section>`;
}

function gpmRegionalPercent(value) {
  return new Intl.NumberFormat(cs(), { style: "percent", maximumFractionDigits: 2 }).format(value);
}

function gpmRegionalPoints(value) {
  const points = value * 100;
  return (points >= .005 ? "+" : "") + (Math.abs(points) < .005 ? "0.00" : points.toFixed(2)) + " pp";
}

function gpmRegionalBreakdown(region, view, ui, opened = null) {
  if (!region.parties?.length) return "";
  const parties = new Map((view.player?.pol?.parties || []).map(party => [party.id, party]));
  const rows = [...region.parties].sort((a, b) => b.support - a.support || String(a.partyId).localeCompare(String(b.partyId)));
  return `<details class="gpm-regional-breakdown" data-gpm-region-breakdown ${opened?.open ? "open" : ""}>
    <summary>Party support breakdown</summary>
    <small>Each estimate includes the effect of rival campaigns in the same region.</small>
    ${rows.map(row => {
      const name = parties.has(row.partyId) ? Sa(parties.get(row.partyId)) : row.partyId;
      const timing = row.rallyBoost > .00005 && row.rallyFullUntil > view.day
        ? `Rally holds at full strength until ${ui.gameDate(row.rallyFullUntil)}.` : "";
      const decay = row.rallyBoost > .00005 && (row.rallyHalfLife === 0 ? "Rally does not decay."
        : row.rallyHalfLife > 0 ? `Rally boost halves every ${row.rallyHalfLife} days after the grace period.` : "");
      const expiration = row.rallyBoost > .00005 && Number.isFinite(row.rallyExpiresDay) && row.rallyExpiresDay > view.day
        ? `Fades below the tracked minimum on ${ui.gameDate(row.rallyExpiresDay)}.` : "";
      return `<article><details data-gpm-breakdown-party="${b(row.partyId)}" ${opened?.parties.has(row.partyId) ? "open" : ""}>
        <summary><strong>${b(name)}</strong><span>${b(gpmRegionalPercent(row.support))}</span></summary>
        <dl><dt>Baseline vote share</dt><dd>${b(gpmRegionalPercent(row.baseShare))}</dd>
          <dt>Rival campaign effect</dt><dd>${b(gpmRegionalPoints(row.rivalEffect || 0))}</dd>
          <dt>Local presence</dt><dd>${b(gpmRegionalPoints(row.presenceBoost || 0))}</dd>
          <dt>Headquarters</dt><dd>${b(gpmRegionalPoints(row.headquartersBoost || 0))}</dd>
          <dt>Temporary rallies</dt><dd>${b(gpmRegionalPoints(row.rallyBoost || 0))}</dd>
          <dt>Current estimate</dt><dd>${b(gpmRegionalPercent(row.support))}</dd></dl>
        ${[timing, decay, expiration].filter(Boolean).map(text => `<small>${b(text)}</small>`).join(" ")}
      </details></article>`;
    }).join("")}</details>`;
}

function gpmRegionalBreakdownOpened(root) {
  return { open: !!root.querySelector("[data-gpm-region-breakdown][open]"),
    parties: new Set([...root.querySelectorAll("[data-gpm-breakdown-party][open]")].map(el => el.dataset.gpmBreakdownParty)) };
}

function gpmRegionalNational(national) {
  if (!Number.isFinite(national?.support)) return "";
  const details = [`<strong>${b(gpmRegionalPercent(national.support))}</strong> projected national support`];
  if (Number.isFinite(national.threshold) && national.threshold > 0) {
    const gap = national.threshold - national.support;
    details.push(`${b(gpmRegionalPercent(national.threshold))} seat threshold` +
      (gap > 0 ? ` · ${b(gpmRegionalPoints(gap).replace(/^\+/, ""))} short` : " · cleared"));
  }
  if (Number.isInteger(national.seats)) {
    details.push(`${national.seats} projected ${national.seats === 1 ? "seat" : "seats"}` +
      (Number.isInteger(national.totalSeats) ? " of " + national.totalSeats : ""));
  }
  return `<p>${details.join(" · ")}</p><small>${b(gpmRegionalSeatRules(national))} · Estimate based on current conditions.</small>`;
}

function gpmRegionalSeatRules(rules) {
  const apportionment = { dhondt: "D’Hondt", "sainte-lague": "Sainte-Laguë", "hare-lr": "Hare largest remainder" };
  const system = rules.mode === "regional" ? "Seats awarded by region"
    : Number.isFinite(rules.districtMagnitude) && rules.threshold ? "National allocation with modeled district threshold"
    : rules.mode === "national" ? "National seat allocation"
    : ({ "electoral-college": "Electoral college", "two-round": "Two rounds", fptp: "Plurality",
      plurality: "Plurality", "single-round": "Single round", "one-round": "Single round" })[rules.system];
  return [system, apportionment[rules.apportionment], rules.renewalFraction &&
    gpmRegionalPercent(rules.renewalFraction) + " of seats renewed"].filter(Boolean).join(" · ") || "Current election rules";
}

function gpmCampaignSpendingText(quote, ui) {
  const forecast = quote?.forecast;
  if (!forecast) return "";
  const { before, after } = forecast;
  const headline = (forecast.kind === "presidential" ? "First-round vote estimate" : "Vote estimate") +
    " · " + gpmRegionalPercent(before.support) + " → " + gpmRegionalPercent(after.support) +
    " (" + gpmRegionalPoints(after.support - before.support) + ")";
  const seats = before.seats === null ? "" : " · " + before.seats + " → " + after.seats + " projected seats";
  const spend = " · " + li(quote.cost.activistsK) + " activists spent";
  const limit = forecast.weightHeadroom <= 0 ? "This contest has reached the effective voting-weight cap."
    : forecast.weightHeadroom <= forecast.proposedPoints ? "This operation reaches the effective voting-weight cap."
    : forecast.nextScore >= forecast.scoreCap ? "This operation reaches the campaign score cap."
    : forecast.proposedPoints >= forecast.operationCap ? "This operation reaches its " + forecast.operationCap + "-point cap."
    : "Larger commitments have diminishing returns, up to " + forecast.operationCap + " points per operation. " +
      forecast.weightHeadroom.toFixed(2) + " effective points of headroom remain.";
  const threshold = forecast.threshold > 0 ? " · " + gpmRegionalPercent(forecast.threshold) + " threshold" : "";
  return ui.gameDate(forecast.electionDay) + " · " + headline + seats + spend + "\n" + gpmRegionalSeatRules(forecast) + threshold + " · " + limit +
    " Estimate based on current conditions.";
}

function gpmRegionalProjectControls(region, data, ui, state, focusScope = "") {
  const money = amount => rr(amount * 1e6 * hA(), gA());
  const effects = {
    investment: data.presenceHalfLife > 0 ? "Builds electoral presence, which halves every " + data.presenceHalfLife + " days."
      : "Builds lasting electoral presence. Gains taper as local presence rises.",
    rally: data.rallyHalfLife === 0 ? "Boosts the party’s local vote weight without decay."
      : "Boosts local vote weight for " + data.rallyGraceDays + " days at full strength, then fades.",
    headquarters: "Adds a lasting local vote-weight boost while the headquarters is here.",
  };
  return Object.entries(region.quotes).map(([kind, quote]) => {
    const open = quote.ok && !state.busy && !state.pending.has(kind);
    const compare = quote.ok || ["budget", "resources"].includes(quote.reason);
    const cost = compare && quote.cash != null ? money(quote.cash) + " · " + li(quote.activistsK) + " activists assigned" : "";
    const timing = compare && Number.isFinite(quote.endDay) ? " · Finishes " + b(ui.gameDate(quote.endDay)) : "";
    return `<div class="gpm-region-action"><button type="button" class="k" data-gpm-region-action="${kind}"` +
      ` ${focusScope ? `data-gpm-profile-focus="${focusScope}-${kind}"` : ""} aria-disabled="${!open}">${gpmRegionalActionName(kind)}</button>` +
      (cost ? `<small>${b(cost)}${timing}</small>` : "") + `<small>${b(effects[kind])}</small>` +
      gpmRegionalProjection(quote, ui) + (quote.ok ? "" : `<small>${b(gpmRegionalReason(quote, ui))}</small>`) + "</div>";
  }).join("");
}

function gpmRegionalInlineTools(region, data, state, view, ui) {
  const byKey = new Map(data.regions.map(item => [item.key, item]));
  const partyName = key => byKey.has(key) ? gpmRegionalRegionName(byKey.get(key)) : key;
  const headquarters = data.regions.find(item => item.headquarters);
  const dates = project => " · " + li(project.activistsK || 0) + " assigned until " + ui.gameDate(project.endDay);
  const projects = data.projects.map(project => {
    const max = project.endDay - project.startDay;
    const progress = project.startDay == null || max <= 0 ? "" :
      `<progress value="${Math.max(0, Math.min(max, view.day - project.startDay))}" max="${max}" aria-label="${b(gpmRegionalActionName(project.kind) + " progress")}"></progress>`;
    return `<article><small>${b(gpmRegionalActionName(project.kind) + " in " + partyName(project.key) + dates(project))}</small>${progress}</article>`;
  });
  const otherAssignments = (data.assignments || []).filter(project => !project.key).map(project =>
    `<small>${b(gpmRegionalActionName(project.kind) + dates(project))}</small>`);
  const recent = data.recent?.length ? data.recent : region.lastAction ? [{ key: region.key, ...region.lastAction }] : [];
  const receipts = recent.slice(0, 3).map(last => {
    const result = { cancelled: "Cancelled", completed: "Completed", strong: "Strong growth", partial: "Modest growth" }[last.result];
    return [gpmRegionalActionName(last.kind) + " in " + partyName(last.key), result, ui.gameDate(last.day),
      Number.isFinite(last.activistsK) && li(last.activistsK) + " activists returned"].filter(Boolean).join(" · ");
  });
  const other = byKey.get(state.compare) || data.regions.filter(item => item.key !== region.key)
    .sort((a, b) => b.populationShare - a.populationShare)[0];
  const compare = other && `<details data-gpm-region-compare ${state.compareOpen ? "open" : ""}>` +
    `<summary data-gpm-profile-focus="compare">Compare project quotes by region</summary>` +
    `<label>Compare with <select class="k" data-gpm-profile-focus="compare-region" data-gpm-compare-region>${data.regions.filter(item => item.key !== region.key).map(item => `<option value="${b(item.key)}" ${item.key === other.key ? "selected" : ""}>${b(partyName(item.key))} · ${b(gpmRegionalPercent(item.populationShare))}</option>`).join("")}</select></label>` +
    `<div class="gpm-regional-comparison">${[region, other].map(item => `<article><strong>${b(partyName(item.key))} · ${b(gpmRegionalPercent(item.populationShare))} of modeled population</strong>` + Object.entries(item.quotes).filter(([, quote]) => Number.isFinite(quote.cash)).map(([kind, quote]) => `<small>${b(gpmRegionalActionName(kind) + " · " + rr(quote.cash * 1e6 * hA(), gA()) + " · " + li(quote.activistsK) + " activists · " + ui.gameDate(quote.endDay))}</small>` + gpmRegionalProjection(quote, ui)).join("") + "</article>").join("")}</div></details>`;
  return `<p>${b(rr(data.treasuryM * 1e6 * hA(), gA()))} in party funds · ${b(li(data.activistsK))} activists available</p>` +
    `<small>${headquarters ? `Party headquarters · ${b(gpmRegionalRegionName(headquarters))}` : "Party headquarters can be established in Regional Campaigning or Uprising."}</small>` +
    (region.district ? `<small>${region.district.projected} projected seat${region.district.projected === 1 ? "" : "s"} in this region · ${region.district.total} available before any national bonus or renewal adjustment</small>` : "") +
    `<div class="gpm-regional-projects">${projects.join("")}${otherAssignments.join("")}</div>` +
    receipts.map(receipt => `<small>${b(receipt)}</small>`).join("") +
    gpmRegionalProjectControls(region, data, ui, state, "project") + (compare || "");
}

function gpmRegionalProjection(quote, ui) {
  const forecast = quote.projection;
  if (!forecast?.outcomes?.length) return "";
  const outcomes = forecast.outcomes.map(outcome => {
    const label = outcome.id === "strong" ? "Strong growth" : outcome.id === "partial" ? "Modest growth" : "On completion";
    const chance = outcome.chance < 1 ? ` (${gpmRegionalPercent(outcome.chance)})` : "";
    const local = gpmRegionalPoints(outcome.localAfter - forecast.localBefore);
    const national = Number.isFinite(outcome.nationalAfter) && Number.isFinite(forecast.nationalBefore)
      ? ` · ${gpmRegionalPoints(outcome.nationalAfter - forecast.nationalBefore)} nationally` : "";
    return `<small>${b(label + chance + " · " + local + " locally" + national)}</small>`;
  }).join("");
  return outcomes + `<small>Estimate for ${b(ui.gameDate(forecast.day))} if other conditions hold.</small>`;
}

function gpmRegionalSupportScale(regions) {
  const shares = regions.map(region => region.support).sort((a, b) => a - b);
  const percentile = fraction => {
    const index = (shares.length - 1) * fraction;
    const lower = Math.floor(index);
    return shares[lower] + (shares[Math.ceil(index)] - shares[lower]) * (index - lower);
  };

  // Center the range on the typical region. A minimum width limits color
  // movement when support is nearly tied, and outliers clip at the ends.
  const midpoint = percentile(.5);
  const width = Math.min(1, Math.max(.02, 2 * (percentile(.75) - percentile(.25))));
  const min = Math.max(0, Math.min(1 - width, midpoint - width / 2));
  const max = min + width;
  return { min, max, clippedLow: shares[0] < min, clippedHigh: shares.at(-1) > max };
}

function gpmRegionalSupportPosition(support, scale) {
  return Math.max(0, Math.min(1, (support - scale.min) / (scale.max - scale.min)));
}

function gpmRegionalSupportColor(support, scale) {
  const lightness = 25 + 61 * gpmRegionalSupportPosition(support, scale);
  return `hsl(211 60% ${lightness.toFixed(3)}%)`;
}

function gpmRegionalSupportLegend(scale) {
  const { min, max, clippedLow, clippedHigh } = scale;
  const ticks = [min, (min + max) / 2, max].map((support, index) => {
    const prefix = index === 0 && clippedLow ? "≤" : index === 2 && clippedHigh ? "≥" : "";
    const position = gpmRegionalSupportPosition(support, scale) * 100;
    return `<small style="--gpm-tick-position:${position}%">${b(prefix + gpmRegionalPercent(support))}</small>`;
  });
  const gradient = `linear-gradient(90deg in hsl, ${gpmRegionalSupportColor(min, scale)}, ${gpmRegionalSupportColor(max, scale)})`;
  return `<small>Estimated vote share · local scale</small>
    <div class="gpm-support-ramp" style="background:${gradient}" aria-hidden="true"></div>
    <div class="gpm-support-ticks">${ticks.join("")}</div>`;
}

function gpmBindRegionalOverview(profile, view, ui) {
  const panel = profile.querySelector(".gpm-regional-overview");
  const data = view.party?.regionalCampaign;
  const world = ui.globe?.world;
  if (!panel || !data || (panel._gpmRegionalOverviewData === data && panel._gpmRegionalWorld === world)) return;
  const session = ui._mpSession;
  let state = ui._gpmRegionalInline;
  if (state?.session !== session || state?.data?.countryKey !== data.countryKey || state?.data?.partyId !== data.partyId) {
    state = ui._gpmRegionalInline = { session, busy: false, pending: new Map(), status: "" };
  }
  if (!state.data || state.view.day <= view.day) {
    state.view = view;
    state.data = data;
    gpmRegionalClearPending(state);
  }
  const active = panel.contains(document.activeElement) ? document.activeElement : null;
  const restore = active?.dataset.gpmProfileFocus;
  const restoreBreakdown = active?.matches("[data-gpm-region-breakdown] > summary") ? "[data-gpm-region-breakdown] > summary"
    : active?.matches("[data-gpm-breakdown-party] > summary")
      ? '[data-gpm-breakdown-party="' + CSS.escape(active.parentElement.dataset.gpmBreakdownParty) + '"] > summary' : null;
  const scroll = panel.querySelector(".gpm-support-insets")?.scrollTop || 0;
  panel._gpmRegionalOverviewData = data;
  panel._gpmRegionalWorld = world;
  const regions = data.regions;
  const map = panel.querySelector("[data-gpm-support-map]");
  const select = panel.querySelector("[data-gpm-support-select]");
  const legend = panel.querySelector("[data-gpm-support-scale]");
  const readout = panel.querySelector("[data-gpm-support-readout]");
  const breakdown = panel.querySelector("[data-gpm-support-breakdown]");
  const tools = panel.querySelector("[data-gpm-regional-tools]");
  const open = panel.querySelector("[data-gpm-open-regional]");
  const feedback = panel.querySelector("[data-gpm-regional-feedback]");
  panel.querySelector("[data-gpm-regional-national]").innerHTML = gpmRegionalNational(data.national);
  if (!regions.length) {
    map.textContent = "Regional support estimates are unavailable.";
    legend.textContent = select.textContent = readout.textContent = tools.textContent = breakdown.textContent = "";
    select.disabled = open.disabled = true;
    return;
  }
  select.disabled = open.disabled = false;
  const percent = new Intl.NumberFormat(cs(), { style: "percent", maximumFractionDigits: 2 });
  const format = value => percent.format(value);
  const scale = gpmRegionalSupportScale(regions);
  const byId = new Map(regions.map(region => [region.id, region]));
  const names = new Map(regions.map(region => [region.id, gpmRegionalRegionName(region)]));
  const features = regions.map(region => world?.provinces?.[region.id])
    .filter(feature => feature?.geometry && byId.get(feature.__provId)?.key === feature.__provKey);
  const signature = JSON.stringify(features.map(feature => feature.__provKey));
  if (ui._gpmSupportGeometry?.world !== world || ui._gpmSupportGeometry?.signature !== signature) {
    ui._gpmSupportGeometry = { world, signature, layout: gpmRegionalMapLayout(features) };
  }
  const layout = ui._gpmSupportGeometry.layout;
  const svg = ({ paths, viewBox }, label, attributes = "") => `<svg viewBox="${viewBox}" role="group" aria-label="${b(label)}" ${attributes}>
    ${paths.map(({ provId, d }) => {
      const region = byId.get(provId);
      const caption = `${names.get(provId)} · ${format(region.support)}`;
      return `<path d="${b(d)}" data-gpm-support-region="${provId}" data-gpm-profile-focus="map-region-${provId}" role="button" tabindex="0" aria-pressed="false" aria-label="${b(caption)}" fill="${gpmRegionalSupportColor(region.support, scale)}">
        <title>${b(caption)}</title></path>`;
    }).join("")}</svg>`;
  map.innerHTML = layout ? svg(layout, "Estimated regional party support", "data-gpm-support-main") +
    (layout.insets.length ? `<div class="gpm-support-insets" data-gpm-support-insets aria-label="Territory insets">${layout.insets.map(inset => {
      const label = inset.ids.map(id => names.get(id)).filter(Boolean).join(", ");
      return `<div class="gpm-support-inset" data-gpm-support-inset>${svg(inset, label)}<small>${b(label)}</small></div>`;
    }).join("")}</div>` : "")
    : "Map geometry is unavailable. Choose a region below to view its support.";
  legend.innerHTML = layout ? gpmRegionalSupportLegend(scale) : "";
  select.innerHTML = [...regions].sort((a, b) => names.get(a.id).localeCompare(names.get(b.id), cs()))
    .map(region => `<option value="${region.id}">${b(names.get(region.id))} · ${b(format(region.populationShare))} of modeled population</option>`).join("");
  const strongest = regions.reduce((best, region) => region.support > best.support ? region : best);
  const update = region => {
    if (!region) return;
    state.selected = region.id;
    if (state.compare === region.key) state.compare = null;
    ui._gpmSupportSelection = { key: data.countryKey, party: data.partyId, province: region.key };
    select.value = String(region.id);
    const last = map.querySelector("[data-selected]");
    last?.removeAttribute("data-selected");
    last?.setAttribute("aria-pressed", "false");
    const selected = map.querySelector(`[data-gpm-support-region="${region.id}"]`);
    selected?.setAttribute("data-selected", "");
    selected?.setAttribute("aria-pressed", "true");
    const leader = view.player.pol.parties.find(party => party.id === region.leadId);
    readout.textContent = `${names.get(region.id)} · ${format(region.support)} estimated vote share` +
      (leader ? ` · ${Sa(leader)} leads` : "") + (region.headquarters ? " · Party headquarters" : "");
    breakdown.innerHTML = gpmRegionalBreakdown(region, view, ui, gpmRegionalBreakdownOpened(breakdown));
    open.onclick = () => gpmOpenRegionalMap(ui, open, region.key);
    const paint = () => {
      if (!panel.isConnected) return;
      const current = state.data.regions.find(item => item.id === state.selected) || region;
      const focus = tools.contains(document.activeElement) ? document.activeElement?.dataset.gpmProfileFocus : null;
      tools.innerHTML = gpmRegionalInlineTools(current, state.data, state, state.view, ui);
      feedback.textContent = state.status;
      const details = tools.querySelector("[data-gpm-region-compare]");
      if (details) details.ontoggle = () => { if (details.isConnected) state.compareOpen = details.open; };
      if (focus) tools.querySelector('[data-gpm-profile-focus="' + CSS.escape(focus) + '"]')?.focus({ preventScroll: true });
    };
    state.paint = paint;
    paint();
  };
  const previous = ui._gpmSupportSelection;
  update((previous?.key === data.countryKey && previous.party === data.partyId &&
    regions.find(region => region.key === previous.province)) || strongest);
  select.onchange = () => update(byId.get(Number(select.value)));
  map.onclick = event => {
    const path = event.target.closest("[data-gpm-support-region]");
    if (path) update(byId.get(Number(path.dataset.gpmSupportRegion)));
  };
  map.onkeydown = event => {
    const path = event.target.closest("[data-gpm-support-region]");
    if (!path || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    update(byId.get(Number(path.dataset.gpmSupportRegion)));
  };
  tools.onclick = event => {
    const button = event.target.closest("[data-gpm-region-action]");
    if (button?.getAttribute("aria-disabled") === "false") void gpmSubmitRegionalAction(ui, button.dataset.gpmRegionAction, state);
  };
  tools.onchange = event => {
    if (event.target.matches("[data-gpm-compare-region]")) {
      state.compare = event.target.value;
      state.compareOpen = true;
      state.paint();
    }
  };
  const insets = map.querySelector(".gpm-support-insets");
  if (insets) insets.scrollTop = scroll;
  if (restore) panel.querySelector('[data-gpm-profile-focus="' + CSS.escape(restore) + '"]')?.focus({ preventScroll: true });
  else if (restoreBreakdown) panel.querySelector(restoreBreakdown)?.focus({ preventScroll: true });
}

function gpmRenderRegionalMap(ui, state) {
  const { data, view, panel } = state;
  const region = data.regions.find(entry => entry.id === state.selected);
  const active = panel.contains(document.activeElement) ? document.activeElement : null;
  const focusTarget = active?.matches("[data-gpm-region-select]") ? "[data-gpm-region-select]" :
    active?.matches("[data-gpm-region-action]") ? '[data-gpm-region-action="' + active.dataset.gpmRegionAction + '"]' :
    active?.matches("[data-gpm-region-breakdown] > summary") ? "[data-gpm-region-breakdown] > summary" :
    active?.matches("[data-gpm-breakdown-party] > summary") ? `[data-gpm-breakdown-party="${CSS.escape(active.parentElement.dataset.gpmBreakdownParty)}"] > summary` : null;
  const money = amount => rr(amount * 1e6 * hA(), gA());
  const pct = value => new Intl.NumberFormat(cs(), { style: "percent", maximumFractionDigits: 1 }).format(value);
  const points = value => (value > 0 ? "+" : "") + (value * 100).toFixed(2) + " pp";
  const regionName = key => {
    const entry = data.regions.find(item => item.key === key);
    return entry ? gpmRegionalRegionName(entry) : key;
  };
  const options = data.regions.map(entry => [entry, gpmRegionalRegionName(entry)])
    .sort((a, b) => a[1].localeCompare(b[1], cs()))
    .map(([entry, name]) => `<option value="${entry.id}" ${entry.id === region?.id ? "selected" : ""}>${b(name)}</option>`).join("");
  const jobs = data.projects.map(project => `<small>${b(gpmRegionalActionName(project.kind))} · ${b(regionName(project.key))}
    · Finishes ${b(ui.gameDate(project.endDay))}</small>`).join("");
  const headquarters = data.regions.find(entry => entry.headquarters);
  const header = `<div class="gpm-regional-national">${gpmRegionalNational(data.national)}</div>
    <small>${b(money(data.treasuryM))} in party funds · ${b(Math.round(data.activistsK * 1000).toLocaleString(cs()))} available activists</small>
    ${headquarters ? `<small>Party headquarters · ${b(gpmRegionalRegionName(headquarters))}</small>` : ""}
    ${jobs}<label>Region <select class="k" data-gpm-region-select ${data.regions.length ? "" : "disabled"}>
      <option value="" ${region ? "" : "selected"}>Choose a region</option>${options}</select></label>`;
  let detail = `<p>${data.regions.length ? "Click a highlighted state or province on the globe." : "No campaign regions are available for this country."}</p>`;
  if (region) {
    const leader = view.player.pol.parties.find(party => party.id === region.leadId);
    const actions = Object.entries(region.quotes).map(([kind, quote]) => {
      const effect = kind === "investment" ? (data.presenceHalfLife > 0
        ? `Builds local presence. Without a new investment, presence halves every ${data.presenceHalfLife} days.`
        : "Builds lasting local presence. Gains taper as the region fills.")
        : kind === "rally" ? (data.rallyHalfLife === 0 ? "The local rally bonus does not decay."
          : `The rally bonus holds at full strength for ${data.rallyGraceDays ?? 21} days before fading.`)
          : "Adds a lasting support boost in this region.";
      const cost = quote.cash == null ? "" : `${money(quote.cash)} · ${Math.round(quote.activistsK * 1000).toLocaleString(cs())} activists · ${quote.days} days`;
      return `<div class="gpm-region-action"><button type="button" class="k" data-gpm-region-action="${kind}"
        ${quote.ok && !state.busy && !state.pending.has(kind) ? "" : "disabled"}>${gpmRegionalActionName(kind)}</button>
        ${cost ? `<small>${b(cost)}</small><small>${b(effect)}</small>` : ""}
        ${gpmRegionalProjection(quote, ui)}
        ${quote.ok ? "" : `<small>${b(gpmRegionalReason(quote, ui))}</small>`}</div>`;
    }).join("");
    const last = region.lastAction;
    const receipt = last && { cancelled: "Cancelled", completed: "Completed", strong: "Strong growth", partial: "Modest growth" }[last.result];
    detail = `<div class="gpm-region-detail"><h3>${b(gpmRegionalRegionName(region))}</h3>
      <dl><dt>Estimated party support</dt><dd>${b(pct(region.support))}</dd>
      <dt>Leading party</dt><dd>${b(leader ? Sa(leader) : "—")}</dd>
      <dt>Margin vs. strongest rival</dt><dd>${b(points(region.margin))}</dd>
      <dt>Lasting boost · presence and HQ</dt><dd>${b(gpmRegionalPoints(region.permanentBoost ?? 0))}</dd>
      ${region.headquartersBoost > .00005 ? `<dt>From headquarters</dt><dd>${b(gpmRegionalPoints(region.headquartersBoost))}</dd>` : ""}
      <dt>Temporary rally boost</dt><dd>${b(gpmRegionalPoints(region.rallyBoost ?? 0))}</dd>
      ${region.rivalBoost < -.00005 ? `<dt>Rival activity</dt><dd>${b(gpmRegionalPoints(region.rivalBoost))}</dd>` : ""}
      <dt>Local party presence</dt><dd>${b(pct(region.presence))}</dd></dl>
      ${region.rallyFullUntil > view.day ? `<small>Rally at full strength until ${b(ui.gameDate(region.rallyFullUntil))}.</small>` : ""}
      ${gpmRegionalBreakdown(region, view, ui, gpmRegionalBreakdownOpened(panel))}
      ${receipt ? `<small>${b(gpmRegionalActionName(last.kind))} · ${b(receipt)} · ${b(ui.gameDate(last.day))}</small>` : ""}
      ${actions}</div>`;
  }
  panel.querySelector("[data-gpm-region-content]").innerHTML = header + detail;
  panel.querySelector("[data-gpm-region-status]").textContent = state.status;
  if (focusTarget) {
    const target = panel.querySelector(focusTarget);
    target?.focus({ preventScroll: true });
  }
  const colors = {};
  for (const entry of data.regions) {
    colors[entry.id] = entry.id === state.selected ? [241, 202, 105, 246]
      : entry.headquarters ? [180, 138, 64, 225] : [63, 144, 168, 185];
  }
  state.globe.setProvinceChoropleth(colors);
}

function gpmRefreshRegionalMap(ui, snapshot = null) {
  const state = ui.gpmRegionalActive;
  if (!state || state.busy) return;
  if (state.session !== ze || !state.panel.isConnected) {
    gpmCloseRegionalMap(ui);
    return;
  }
  const view = Va(state.session, snapshot);
  const data = view?.party?.regionalCampaign;
  if (!data) return;
  if (data.partyId !== state.data.partyId || data.countryKey !== state.data.countryKey) {
    gpmCloseRegionalMap(ui);
    return;
  }
  if (data !== state.data) {
    state.view = view;
    state.data = data;
    gpmRegionalClearPending(state);
    gpmRenderRegionalMap(ui, state);
  }
}

function gpmRegionalClearPending(state) {
  for (const [kind, endDay] of state.pending) {
    if (state.view.day >= endDay || state.data.projects.some(project => project.kind === kind)) state.pending.delete(kind);
  }
}

function gpmSelectRegionalProvince(ui, id) {
  const state = ui.gpmRegionalActive;
  if (!state || state.busy) return;
  const region = state.data.regions.find(entry => entry.id === id);
  if (id !== null && !region) {
    state.status = "Choose a highlighted region in your country.";
    state.panel.querySelector("[data-gpm-region-status]").textContent = state.status;
    return;
  }
  state.selected = region?.id ?? null;
  if (region) ui._gpmSupportSelection = { key: state.data.countryKey, party: state.data.partyId, province: region.key };
  state.status = "";
  gpmRenderRegionalMap(ui, state);
}

function gpmRegionalGlobeClick(ui, coords) {
  const state = ui.gpmRegionalActive;
  if (!state) return false;
  if (state.session !== ze) {
    gpmCloseRegionalMap(ui);
    return false;
  }
  if (coords) gpmSelectRegionalProvince(ui, state.globe._provinceAt(coords[1], coords[0]));
  return true;
}

async function gpmSubmitRegionalAction(ui, kind, state = ui.gpmRegionalActive) {
  const region = state?.data.regions.find(entry => entry.id === state.selected);
  const quote = region?.quotes[kind];
  if (!quote?.ok || state.busy || state.pending.has(kind) || state.session !== ze) return;
  state.busy = true;
  state.status = "Scheduling project…";
  state.paint();
  let snapshot = null;
  try {
    const result = await Te(state.session, "applyPlayerAction", [{
      verb: "gpm.party.regional." + kind, partyId: state.data.partyId, provinceId: region.id,
      provinceKey: region.key, quoteToken: quote.token,
    }]);
    state.status = result?.ok ? "Project scheduled for " + ui.gameDate(result.endDay) + "."
      : gpmRegionalReason(result, ui) || "The action could not be started.";
    if (result?.ok) {
      // Block a second submission against stale quotes until the worker publishes a fresh view.
      state.pending.set(kind, result.endDay);
    }
    try { snapshot = await at(state.session, G.POLITICS); }
    catch (error) { console.error("[PPO] Regional campaign refresh failed", error); }
  } catch (error) {
    console.error("[PPO] Regional campaign action failed", error);
    state.status = "The action could not be started.";
  } finally {
    state.busy = false;
    if (ui.gpmRegionalActive === state) {
      gpmRefreshRegionalMap(ui, snapshot);
      if (ui.gpmRegionalActive === state) state.paint();
    } else if (ui._gpmRegionalInline === state && state.session === ze) {
      const view = Va(state.session, snapshot);
      const data = view?.party?.regionalCampaign;
      if (view?.day >= state.view.day && data?.partyId === state.data.partyId && data.countryKey === state.data.countryKey) {
        state.view = view;
        state.data = data;
        gpmRegionalClearPending(state);
      }
      state.paint();
    }
  }
}

async function gpmOpenRegionalMap(ui, button, provinceKey) {
  const session = ui._mpSession;
  if (ui.gpmRegionalActive || session !== ze || !ui.globe || button.disabled) return;
  button.disabled = true;
  try {
    if (ui.globe.activeBody === "moon") await Pue("earth");
    await ui.acquireSimulationViewLease("gpm-regional", [G.POLITICS]);
    const view = Va(session);
    const data = view?.party?.regionalCampaign;
    if (!button.isConnected || session !== ze || !data || ui.globe.activeBody === "moon") {
      await ui.releaseSimulationViewLease("gpm-regional");
      return;
    }
    mve(ui);
    if (sCt()) Xg(false);
    ui.closeModule();
    ui.deselectCountry();
    const panel = document.createElement("aside");
    panel.className = "gpm-regional-map";
    panel.setAttribute("aria-label", "Regional Campaigning");
    panel.innerHTML = '<header><h2>Regional Campaigning</h2><button class="k k-sm" type="button" data-gpm-region-close>Back to My Party</button></header>' +
      '<div class="gpm-region-detail" data-gpm-region-content></div><small role="status" data-gpm-region-status></small>';
    const globe = ui.globe;
    const selected = data.regions.find(region => region.key === provinceKey)?.id ?? null;
    const state = { session, view, data, globe, panel, selected, busy: false, status: "", pending: new Map(),
      previousStrategic: globe._forceStrategic, previousMap: globe._choroNextKey };
    state.paint = () => gpmRenderRegionalMap(ui, state);
    ui.gpmRegionalActive = state;
    ui.closeGpmRegionalMap = () => gpmCloseRegionalMap(ui);
    Xe("screen-game").append(panel);
    panel.addEventListener("click", event => {
      if (event.target.closest("[data-gpm-region-close]")) gpmCloseRegionalMap(ui, true);
      const action = event.target.closest('[data-gpm-region-action][aria-disabled="false"]');
      if (action) void gpmSubmitRegionalAction(ui, action.dataset.gpmRegionAction);
    });
    panel.addEventListener("change", event => {
      if (event.target.matches("[data-gpm-region-select]")) {
        gpmSelectRegionalProvince(ui, event.target.value === "" ? null : Number(event.target.value));
      }
    });
    jk("gpm-regional");
    globe._forceStrategic = true;
    globe.setDataMapIdentity("gpm-regional");
    Ju();
    const country = sy(data.countryKey);
    if (country) globe.focusCountry(country, 3.45);
    gpmRenderRegionalMap(ui, state);
    panel.querySelector("[data-gpm-region-close]").focus({ preventScroll: true });
  } catch (error) {
    console.error("[PPO] Regional campaign map failed to open", error);
    if (ui.gpmRegionalActive) gpmCloseRegionalMap(ui);
    else await ui.releaseSimulationViewLease("gpm-regional");
  } finally {
    button.disabled = false;
  }
}

function gpmCloseRegionalMap(ui, returnToParty = false) {
  const state = ui.gpmRegionalActive;
  if (!state) return;
  ui.gpmRegionalActive = null;
  state.panel.remove();
  state.globe.clearChoropleth();
  state.globe.setDataMapIdentity(state.previousMap);
  state.globe._forceStrategic = state.previousStrategic;
  Gk("gpm-regional");
  Ju();
  if (returnToParty && state.session === ze) ui.openModule("politics", "myparty");
  ui.releaseSimulationViewLease("gpm-regional").catch(error => console.error("[PPO] Regional campaign view release failed", error));
}

module.exports = {
  style,
  rendererFunctions: [gpmRegionalActionName, gpmRegionalReason, gpmRegionalRegionName, gpmRenderRegionalOverview,
    gpmRegionalPercent, gpmRegionalPoints, gpmRegionalBreakdown, gpmRegionalBreakdownOpened, gpmRegionalNational, gpmRegionalSeatRules,
    gpmCampaignSpendingText, gpmRegionalProjection, gpmRegionalProjectControls, gpmRegionalInlineTools, gpmRegionalClearPending,
    gpmRegionalSupportScale, gpmRegionalSupportPosition, gpmRegionalSupportColor, gpmRegionalSupportLegend,
    gpmRegionalMapLayout, gpmBindRegionalOverview, gpmRenderRegionalMap,
    gpmRefreshRegionalMap, gpmSelectRegionalProvince, gpmRegionalGlobeClick, gpmSubmitRegionalAction,
    gpmOpenRegionalMap, gpmCloseRegionalMap],
};

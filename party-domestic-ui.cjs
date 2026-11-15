"use strict";

const { rendererFunctions: agreementRenderer } = require("./party-agreements.cjs");

const style = `
  .gpm-domestic { display: grid; gap: var(--gap-3, 12px); min-width: 0; }
  .gpm-domestic h3, .gpm-domestic h4, .gpm-domestic p { margin: 0; }
  .gpm-domestic [data-gpm-domestic-status] { min-height: 1em; }
  .gpm-domestic-section { display: grid; gap: var(--gap-2, 8px); min-width: 0; }
  .gpm-domestic-section:empty { display: none; }
  .gpm-domestic-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 10rem), 1fr)); gap: var(--gap-2, 8px); }
  .gpm-domestic-grid > * { min-width: 0; }
  .gpm-domestic-summary { padding: var(--gap-2, 8px); border: 1px solid var(--line); border-radius: var(--r-cell, 4px); }
  .gpm-domestic-summary dl { margin: 0; display: grid; gap: .35rem; }
  .gpm-domestic-summary dl > div { display: flex; justify-content: space-between; flex-wrap: wrap; gap: .25rem .5rem; }
  .gpm-domestic-summary dd { margin: 0; font-variant-numeric: tabular-nums; }
  .gpm-domestic-fields { display: grid; gap: var(--gap-2, 8px); }
  .gpm-domestic-fields label:not(.gpm-domestic-check), .gpm-domestic-contest { display: grid; gap: .25rem; }
  .gpm-domestic-fields label:not(.gpm-domestic-check) { grid-template-rows: 1fr auto; }
  .gpm-domestic-contest { min-inline-size: 0; max-inline-size: 100%; }
  .gpm-domestic-fields input[type=number], .gpm-domestic-fields select, .gpm-domestic-contest select { width: 100%; min-width: 0; }
  .gpm-domestic-check { display: flex; align-items: start; gap: .4rem; }
  .gpm-domestic-check input { margin: .15em 0 0; }
  .gpm-domestic-actions { display: flex; gap: .5rem; flex-wrap: wrap; align-items: center; }
  .gpm-domestic-forecast-controls { align-items: flex-end; }
  .gpm-domestic details > summary { cursor: pointer; margin-block-end: .35rem; }
  .gpm-domestic-list { margin: 0; padding: 0; display: grid; gap: .4rem; list-style: none; }
  .gpm-domestic-list li { display: grid; gap: .2rem; overflow-wrap: anywhere; }
  .gpm-domestic-list progress { width: 100%; height: .6rem; }
  .gpm-domestic-recap { scroll-margin-block: 1rem; }
  .gpm-domestic-recap table { width: 100%; border-collapse: collapse; text-align: right; font-variant-numeric: tabular-nums; }
  .gpm-domestic-recap th, .gpm-domestic-recap td { padding: .3rem .25rem; border-bottom: 1px solid var(--line); }
  .gpm-domestic-recap th:first-child { text-align: left; overflow-wrap: anywhere; }
`;

function gpmRenderCampaignPlan() {
  if (!document.getElementById("gpm-domestic-style")) {
    const style = document.createElement("style");
    style.id = "gpm-domestic-style";
    style.textContent = gpmDomesticStyle;
    document.head.append(style);
  }
  return `<section class="mcard wide gpm-domestic" aria-labelledby="gpm-campaign-plan-title">
    <h3 class="mc-title" id="gpm-campaign-plan-title">Campaign Plan</h3>
    <div class="gpm-domestic-section" data-gpm-domestic-account></div>
    <form class="gpm-domestic-section" data-gpm-domestic-form>
      <h4>Party staff</h4>
      <div class="gpm-domestic-fields"></div>
      <div class="gpm-domestic-actions">
        <button class="k" type="submit" data-gpm-profile-focus="domestic-save">Save campaign plan</button>
        <small data-gpm-domestic-status role="status"></small>
      </div>
    </form>
    <section class="gpm-domestic-section" aria-labelledby="gpm-domestic-election-title">
      <h4 id="gpm-domestic-election-title">Election outlook</h4>
      <div class="gpm-domestic-actions gpm-domestic-forecast-controls">
        <label class="gpm-domestic-contest">See contest
          <select class="k" data-gpm-domestic-contest data-gpm-profile-focus="domestic-contest"></select>
        </label>
        <button class="k" type="button" data-gpm-domestic-refresh data-gpm-profile-focus="domestic-refresh">Refresh estimate</button>
      </div>
      <div class="gpm-domestic-section" data-gpm-domestic-forecast aria-live="polite"></div>
      <div class="gpm-domestic-section gpm-domestic-recap" data-gpm-domestic-recap tabindex="-1"></div>
    </section>
    <div class="gpm-domestic-section" data-gpm-domestic-agenda></div>
    <div class="gpm-domestic-section" data-gpm-domestic-projects></div>
    <details data-gpm-domestic-ledger><summary>Party activity</summary><div data-gpm-domestic-log></div></details>
  </section>`;
}

function gpmDomesticMoney(value, signed = false) {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(cs(), {
    style: "currency", currency: "USD", maximumFractionDigits: 0, signDisplay: signed ? "exceptZero" : "auto",
  }).format(Math.round(value * 1e6));
}

function gpmDomesticContestLabel(contest, ui) {
  const key = contest?.chamberNameKey;
  const name = key && st(key) ? o(key) : contest?.label || contest?.chamberName;
  const kind = contest?.kind === "presidential" ? "Executive election" : "Legislative election";
  return [name || kind, Number.isFinite(contest?.electionDay) && ui.gameDate(contest.electionDay)].filter(Boolean).join(" · ");
}

function gpmDomesticAccount(state, ui) {
  const { data } = state;
  const reserve = data.reserve || {};
  const membership = data.membership;
  const details = (pairs, label) => `<div class="gpm-domestic-summary"><h4>${b(label)}</h4><dl>${pairs.map(([key, value]) =>
    `<div><dt>${b(key)}</dt><dd>${b(String(value))}</dd></div>`).join("")}</dl></div>`;
  const counter = new Intl.NumberFormat(cs(), { maximumFractionDigits: 0 });
  const history = data.lastReview;
  const review = data.plan?.enabled && Number.isFinite(history?.day) ?
    `Last review ${ui.gameDate(history.day)}. ${history.reason === "no-eligible-priority" ?
      "Staff found no action within the plan and available resources." : "See Party activity for the decisions."}` : "";
  return `<div class="gpm-domestic-grid">${details([
    ["Treasury", gpmDomesticMoney(data.cashM)], ["Activists available", Number.isFinite(data.activistsK) ? li(data.activistsK) : "—"],
    ["Influence", Number.isFinite(data.influence) ? counter.format(data.influence) : "—"],
    ["Spent this month", gpmDomesticMoney(data.monthlySpendM)],
  ], "Party resources")}${details([
    ["Treasury", gpmDomesticMoney(reserve.cashM ?? 0)], ["Activists", li(reserve.activistsK ?? 0)],
    ["Influence", counter.format(reserve.influence ?? 0)],
  ], "Staff reserve")}${membership ? details([
    ["Members", Number.isFinite(membership.members) ? counter.format(membership.members) : "—"],
    ["Dues", gpmDomesticMoney(membership.duesM)],
    ["Upkeep", gpmDomesticMoney(membership.upkeepM)],
    ["Net this month", gpmDomesticMoney(membership.netM, true)],
    ...(membership.votingWeightPct > 0 ? [["Relative voting weight", `+${gpmRegionalPercent(membership.votingWeightPct / 100)}`]] : []),
  ], "Membership") : ""}</div>${review ? `<small>${b(review)}</small>` : ""}${data.plan?.enabled && Number.isFinite(data.nextPlannerDay) ?
    `<small>Next monthly review ${b(ui.gameDate(data.nextPlannerDay))}.</small>` : ""}`;
}

function gpmDomesticFields(state, ui) {
  const contestOptions = state.contests.map(contest =>
    `<option value="${b(contest.id)}">${b(gpmDomesticContestLabel(contest, ui))}</option>`).join("");
  const regionOptions = state.regions.map(region =>
    `<option value="${b(region.key)}">${b(gpmRegionalRegionName(region))}</option>`).join("");
  const check = (name, label) => `<label class="gpm-domestic-check"><input type="checkbox" name="${name}" data-gpm-profile-focus="domestic-${name}"> ${label}</label>`;
  const money = (name, label) => `<label>${label}<input class="k" type="number" name="${name}" min="0" max="1000000000" step="1" data-gpm-profile-focus="domestic-${name}"></label>`;
  return `${check("enabled", "Let staff run this plan")}
    <div class="gpm-domestic-grid">
      <label>Goal <select class="k" name="goal" data-gpm-profile-focus="domestic-goal">
        <option value="firstSeat">Win our first seat</option><option value="build">Build the party</option><option value="defend">Defend our seats</option>
      </select></label>
      <label>Target contest <select class="k" name="targetContestId" data-gpm-profile-focus="domestic-targetContestId">
        <option value="">Next eligible contest</option>${contestOptions}
      </select></label>
      <label>Focus region <select class="k" name="targetProvinceKey" data-gpm-profile-focus="domestic-targetProvinceKey">
        <option value="">Let staff choose</option>${regionOptions}
      </select></label>
      ${money("reserveCashM", "Treasury to reserve (USD)")}${money("monthlyBudgetM", "Monthly spending limit (USD)")}
    </div>
    <small>Leave the limit blank to spend from available funds. Staff uses the same treasury, costs and cooldowns as your manual actions.</small>
    <div class="gpm-domestic-grid">
      ${check("autoFundraise", "Fundraise")}${check("autoRecruit", "Recruit activists")}
      ${check("allowForeignFunding", "Seek foreign grants")}${check("allowForeignDonations", "Allow staff to answer foreign grant requests")}
    </div>`;
}

function gpmDomesticForecastHtml(value, ui) {
  if (!value) return "<p class=\"empty-note\">An estimate is unavailable for this contest.</p>";
  const show = (snapshot, title) => {
    if (!snapshot) return "";
    const district = snapshot.bestDistrict;
    const margin = Number.isFinite(snapshot.localMargin) && gpmRegionalPoints(snapshot.localMargin);
    const rows = [Number.isFinite(snapshot.support) && [`${gpmRegionalPercent(snapshot.support)} projected vote share`, ""],
      Number.isInteger(snapshot.seats) && [`${snapshot.seats} projected ${snapshot.seats === 1 ? "seat" : "seats"}`,
        Number.isInteger(value.totalSeats) ? `of ${value.totalSeats}` : ""],
      Number.isFinite(snapshot.qualifyingShare) && Number.isFinite(value.threshold) && value.threshold > 0 &&
        ["Share used for threshold", gpmRegionalPercent(snapshot.qualifyingShare)],
      margin && [district?.name ? `${gpmRegionalRegionName(district)} local margin` : "Closest local seat margin", margin],
    ].filter(Boolean);
    return `<div class="gpm-domestic-summary"><h4>${b(title)}</h4><dl>${rows.map(([label, detail]) =>
      `<div><dt>${b(label)}</dt>${detail ? `<dd>${b(detail)}</dd>` : ""}</div>`).join("")}</dl></div>`;
  };
  const electionDate = Number.isFinite(value.electionDay) ? ui.gameDate(value.electionDay) : "Election day";
  const rules = [gpmRegionalSeatRules(value), gpmRegionalThresholdText(value)].filter(Boolean);
  const assumptions = Array.isArray(value.assumptions) ? value.assumptions.filter(item => typeof item === "string").join(" ") : value.assumptions;
  return `<div class="gpm-domestic-grid">${show(value.current, "Current estimate")}${show(value.election, electionDate)}</div>
    <small>${b(rules.join(" · "))}</small>${typeof assumptions === "string" && assumptions ? `<small>${b(assumptions)}</small>` : ""}`;
}

function gpmDomesticRecap(result, ui, state = {}) {
  if (!result) return "";
  const day = result.day ?? result.electionDay;
  const before = result.beforeSeats ?? result.seatsBefore ?? result.before?.seats;
  const seats = result.seats ?? result.afterSeats ?? result.seatsAfter ?? result.after?.seats;
  const vote = result.voteShare ?? result.support ?? result.after?.support;
  const projectedSeats = result.projectedSeats ?? result.forecast?.seats;
  const key = result.chamberNameKey;
  const chamber = key && st(key) ? o(key) : result.chamberName || result.label;
  const lines = [Number.isInteger(seats) && `${seats} ${seats === 1 ? "seat" : "seats"}` +
    (Number.isFinite(before) ? ` (${seats >= before ? "+" : ""}${seats - before})` : ""),
    Number.isFinite(vote) && `${gpmRegionalPercent(vote)} vote share`,
    Number.isInteger(projectedSeats) && `${projectedSeats} forecast ${projectedSeats === 1 ? "seat" : "seats"}`,
  ].filter(Boolean);
  if (!lines.length) return "";
  const rows = result.parties || [];
  const names = new Map((state.view?.player?.pol?.parties || []).map(item => [item.id, Sa(item)]));
  const table = rows.length ? `<details><summary>All party results</summary><table aria-label="Election results by party">
    <thead><tr><th scope="col">Party</th><th scope="col">Vote share</th><th scope="col">Seats</th><th scope="col">Change</th></tr></thead>
    <tbody>${rows.map(row => {
      const change = row.seats - row.previousSeats;
      return `<tr><th scope="row">${b(names.get(row.id) || row.label || row.id)}</th><td>${b(gpmRegionalPercent(row.votes))}</td>
        <td>${b(row.seats)}</td><td>${Number.isInteger(change) ? b(`${change > 0 ? "+" : ""}${change}`) : "—"}</td></tr>`;
    }).join("")}</tbody></table></details>` : "";
  return `<h4>Election recap</h4><small>${b([chamber || "Legislative election", Number.isFinite(day) && ui.gameDate(day)].filter(Boolean).join(" · "))}</small>
    <p>${b(lines.join(" · "))}</p>${table}`;
}

function gpmDomesticProjectRows(state, ui) {
  const v = state.view;
  const day = v.day || 0;
  const regions = new Map(state.regions.map(region => [region.key, gpmRegionalRegionName(region)]));
  const projects = [...(v.party.regionalCampaign?.projects || []), ...(v.party.organizing?.projects || []),
    ...(v.party.outreach?.project ? [{ kind: "outreach", ...v.party.outreach.project }] : [])];
  if (!projects.length) return "";
  return `<h4>Projects underway</h4><ul class="gpm-domestic-list">${projects.map(project => {
    const name = gpmRegionalActionName(project.kind) || "Party project";
    const target = regions.get(project.key) || (project.kind === "meeting" && project.targetId ? Vr(project.targetId) : "");
    const duration = project.endDay - project.startDay;
    const details = [target, Number.isFinite(project.endDay) && `Due ${ui.gameDate(project.endDay)}`,
      Number.isFinite(project.activistsK) && `${li(project.activistsK)} activists assigned`];
    return `<li><strong>${b(name)}</strong><small>${b(details.filter(Boolean).join(" · "))}</small>` +
      (Number.isFinite(project.startDay) && duration > 0 ? `<progress value="${Math.min(duration, Math.max(0, day - project.startDay))}" max="${duration}" aria-label="${b(name + " progress")}"></progress>` : "") + "</li>";
  }).join("")}</ul>`;
}

function gpmDomesticActivity(state, ui) {
  function label(kind) {
    return ({ fundraise: "Fundraising", recruit: "Activist recruitment", dues: "Membership dues", upkeep: "Local upkeep",
      campaign: "Contest operation", plan: "Campaign plan", membership: "Membership and upkeep", grant: "Foreign grant",
      transfer: "Party transfer", regional: "Regional campaigning", organizing: "Party organizing" })[kind] ||
      (typeof kind === "string" ? kind.replace(/[_-]+/g, " ").replace(/^./, char => char.toUpperCase()) : "Party activity");
  }
  const ledger = state.data.ledger || [];
  if (!ledger.length) return "<small>No party activity recorded yet.</small>";
  return `<ul class="gpm-domestic-list">${ledger.slice(0, 12).map(row => {
    const details = [Number.isFinite(row.day) && ui.gameDate(row.day), row.cashM && gpmDomesticMoney(row.cashM, true),
      row.activistsK && `${row.activistsK > 0 ? "+" : ""}${li(row.activistsK)} activists`,
      row.influence && `${row.influence > 0 ? "+" : ""}${row.influence} influence`,
      typeof row.details === "string" && row.details].filter(Boolean);
    return `<li><strong>${b(label(row.kind))}</strong><small>${b(details.join(" · "))}</small></li>`;
  }).join("")}</ul>`;
}

function gpmDomesticAgendaEntries(agenda) {
  return (Array.isArray(agenda) ? agenda : agenda?.rows || []).filter(row =>
    row && typeof row.id === "string" && typeof row.title === "string");
}

function gpmDomesticAgendaHtml(state, ui) {
  const rows = gpmDomesticAgendaEntries(state.data.agenda).filter(row => row.status !== "completed");
  if (!rows.length) return "";
  return `<h4>Party schedule</h4><ul class="gpm-domestic-list">${rows.slice(0, 5).map(row => {
    const contest = row.kind === "vote" ? state.contests.find(item => item.id === row.contestId) : null;
    const title = contest?.label ? `Election · ${contest.label}` : contest?.kind === "presidential" ? "Executive election"
      : row.kind === "vote" ? "Legislative election" : row.title;
    return `<li><button class="k k-nav" type="button" ${gpmDomesticAgendaRoute(row)}>${b(title)}</button>
      <small>${b([Number.isFinite(row.deadlineDay) && ui.gameDate(row.deadlineDay), row.status].filter(Boolean).join(" · "))}</small></li>`;
  }).join("")}</ul>`;
}

function gpmDomesticAgendaRoute(row) {
  const isRecap = row.kind === "electionRecap" || row.kind === "election_recap";
  return `data-gpm-domestic-link="${b(row.tab || "plan")}"` +
    (row.contestId ? ` data-gpm-domestic-contest-id="${b(row.contestId)}"` : "") + (isRecap ? ' data-gpm-domestic-result="1"' : "");
}

function gpmDomesticSitroomRows(view, ui, recent = false) {
  const dismissed = ui._gpmDomesticDismissed?.session === ui.sim ? ui._gpmDomesticDismissed.keys : null;
  return gpmDomesticAgendaEntries(view.gpmDomesticAgenda).filter(row =>
    recent === (row.status === "completed")).map(row => {
    const days = Number.isFinite(row.deadlineDay) ? Math.max(0, Math.ceil(row.deadlineDay - view.day)) : null;
    const measure = days === null ? "" : Kc(days);
    const date = recent && Number.isFinite(row.day) ? ui.gameDate(row.day) : "";
    const contest = row.kind === "vote" ? view.player?.pol?.contests?.[row.contestId] : null;
    const title = contest ? smt(view, contest) : row.title;
    return { id: `gpm-party:${row.kind}:${row.id}${recent ? ":" + row.day : ""}`, den: recent ? "registre" : "dossier", sort: days ?? 1e6,
      sev: days !== null && days <= 7 ? "important" : "routine", hand: recent ? "none" : "you",
      title: `${ds("gov")}${b(title)}`, meta: b(date), outcome: contest ? "Open Campaign Plan" : recent ? "" : row.status || "", measure,
      contestId: contest?.id, gauge: null, gaugeTone: null, route: gpmDomesticAgendaRoute(row),
      aria: [title, date, measure].filter(Boolean).join(" · ") };
  }).filter(row => !recent || !dismissed?.has(row.id));
}

function gpmDismissDomesticRecent(ui, view) {
  if (!view) return;
  const previous = ui._gpmDomesticDismissed?.session === ui.sim ? ui._gpmDomesticDismissed.keys : [];
  const keys = [...previous, ...gpmDomesticSitroomRows(view, ui, true).map(row => row.id)];
  ui._gpmDomesticDismissed = { session: ui.sim, keys: new Set(keys.slice(-32)) };
}

function gpmOpenDomesticAgendaLink(ui, node) {
  const tab = node.dataset.gpmDomesticLink;
  if (tab === "conflicts") {
    gpmOpenHistoricalDecisions(ui, ui.sim);
    return;
  }
  if (!["plan", "congress", "agreement", "regional", "laws", "foreign"].includes(tab)) return;
  ui._gpmPartyProfileTab = `gpm-tab-${tab}`;
  ui._gpmDomesticOpen = tab === "plan" ? { session: ui.sim, contestId: node.dataset.gpmDomesticContestId || null,
    recap: node.dataset.gpmDomesticResult === "1" } : null;
  ui.openModule("politics", "myparty");
}

function gpmPaintDomestic(state, ui) {
  const panel = state.panel;
  if (!panel?.isConnected) return;
  const html = (name, value) => {
    const node = panel.querySelector(`[data-gpm-domestic-${name}]`);
    if (node._gpmRenderedHtml !== value) {
      node.innerHTML = value;
      node._gpmRenderedHtml = value;
    }
  };
  html("account", gpmDomesticAccount(state, ui));
  html("projects", gpmDomesticProjectRows(state, ui));
  html("log", gpmDomesticActivity(state, ui));
  html("agenda", gpmDomesticAgendaHtml(state, ui));
  html("forecast", state.forecast ? gpmDomesticForecastHtml(state.forecast, ui) +
    (Number.isFinite(state.forecastDay) ? `<small>Estimate as of ${b(ui.gameDate(state.forecastDay))}.</small>` : "") +
    (state.forecastError ? `<small>${b(state.forecastError)}</small>` : "") :
    `<small>${b(state.forecastPending ? "Checking the election outlook…" : state.forecastError || "No scheduled contest available.")}</small>`);
  const latest = state.data.recentResult;
  const result = latest?.contestId === state.recapContestId ? latest : state.forecast?.recentResult || latest;
  html("recap", gpmDomesticRecap(result, ui, state));
  const recap = panel.querySelector("[data-gpm-domestic-recap]");
  const resultDetails = recap.querySelector("details");
  if (resultDetails && !resultDetails._gpmBound) {
    resultDetails._gpmBound = true;
    resultDetails.open = state.resultOpen === true;
    resultDetails.ontoggle = () => { if (resultDetails.isConnected) state.resultOpen = resultDetails.open; };
  }
  const status = panel.querySelector("[data-gpm-domestic-status]");
  status.textContent = state.status;
  for (const input of panel.querySelectorAll("[data-gpm-domestic-form] [name]")) {
    input.disabled = state.saving || !state.fundingEnabled && ["allowForeignFunding", "allowForeignDonations"].includes(input.name);
  }
  panel.querySelector('[type="submit"]').disabled = state.saving || !state.dirty;
  panel.querySelector("[data-gpm-domestic-refresh]").disabled = state.forecastPending || !state.contestId;
  if (state.focusRecap && !state.forecastPending && recap.textContent) {
    state.focusRecap = false;
    recap.scrollIntoView({ block: "nearest" });
    recap.focus({ preventScroll: true });
  }
}

function gpmReadDomesticDraft(form) {
  const fields = form.elements;
  return {
    enabled: fields.enabled.checked, goal: fields.goal.value,
    targetContestId: fields.targetContestId.value || null, targetProvinceKey: fields.targetProvinceKey.value || null,
    reserveCashM: Number(fields.reserveCashM.value) / 1e6,
    monthlyBudgetM: fields.monthlyBudgetM.value === "" ? null : Number(fields.monthlyBudgetM.value) / 1e6,
    autoFundraise: fields.autoFundraise.checked, autoRecruit: fields.autoRecruit.checked,
    allowForeignFunding: fields.allowForeignFunding.checked, allowForeignDonations: fields.allowForeignDonations.checked,
  };
}

function gpmFillDomesticDraft(form, draft) {
  for (const input of form.querySelectorAll("[name]")) {
    const value = draft?.[input.name];
    if (input.type === "checkbox") input.checked = Boolean(value);
    else if (input.type === "number") input.value = Number.isFinite(value) ? String(Math.round(value * 1e6)) : "";
    else input.value = value || (input.name === "goal" ? "firstSeat" : "");
  }
}

async function gpmRequestDomesticForecast(state, ui, force = false) {
  const id = state.contestId;
  if (!id) {
    state.forecast = null;
    state.forecastPending = false;
    state.forecastError = "";
    state.forecastRequest++;
    gpmPaintDomestic(state, ui);
    return;
  }
  const day = state.view.day || 0;
  if (!force && state.forecastContestId === id && (state.forecastPending || day - state.forecastDay < 7)) return;
  const request = ++state.forecastRequest;
  state.forecastContestId = id;
  state.forecastDay = day;
  if (state.forecast?.contestId !== id) state.forecast = null;
  state.forecastPending = true;
  state.forecastError = "";
  gpmPaintDomestic(state, ui);
  try {
    const result = await at(state.session, "gpm.partyCampaignPlanForecast", { contestId: id });
    if (state.forecastRequest !== request || ui._gpmCampaignPlanUi !== state) return;
    state.forecast = result?.contestId === id ? result : null;
    state.forecastDay = day;
    if (!state.forecast) state.forecastError = "An estimate is unavailable for this contest.";
  } catch {
    if (state.forecastRequest !== request || ui._gpmCampaignPlanUi !== state) return;
    state.forecastError = "Could not refresh the estimate. Try again.";
    state.forecastDay = day;
  } finally {
    if (state.forecastRequest === request && ui._gpmCampaignPlanUi === state) {
      state.forecastPending = false;
      gpmPaintDomestic(state, ui);
    }
  }
}

async function gpmSaveCampaignPlan(state, ui) {
  if (state.saving || !state.dirty || ui._mpSession !== state.session) return;
  state.saving = true;
  state.status = "Saving plan…";
  gpmPaintDomestic(state, ui);
  try {
    const plan = state.draft;
    const result = await Te(state.session, "applyPlayerAction", [{ verb: "gpm.party.domestic.plan", partyId: state.partyId, plan }]);
    if (ui._gpmCampaignPlanUi !== state || ui._mpSession !== state.session) return;
    if (!result?.ok) {
      state.status = ({ contest: "The target contest has changed. Choose another contest.",
        region: "Your party can no longer organize in that region.", budget: "Enter a valid budget and reserve.",
        party: "This party is no longer under your control." })[result?.reason] || "Could not save this plan. Review the settings and try again.";
      return;
    }
    state.draft = result.plan || plan;
    state.appliedPlan = state.draft;
    state.data = { ...state.data, plan: state.appliedPlan };
    state.dirty = false;
    state.status = state.draft.enabled ? "Plan saved. Staff can act at its next review." : "Plan saved. You control all party actions.";
    state.planSavedAt = state.view.day;
    gpmPaintDomestic(state, ui);
    try {
      const snapshot = await at(state.session, G.POLITICS);
      if (ui._gpmCampaignPlanUi !== state || ui._mpSession !== state.session) return;
      const refreshed = Va(state.session, snapshot);
      const profile = state.panel?.closest(".gpm-party-profile");
      if (profile && refreshed?.day >= state.view.day && refreshed.player?.key === state.countryKey &&
          refreshed.party?.campaignPlan?.partyId === state.partyId) gpmBindCampaignPlan(profile, refreshed, ui);
    } catch (error) {
      console.warn("[PPO] Could not refresh the saved campaign plan view", error);
    }
    if (ui._gpmCampaignPlanUi !== state || ui._mpSession !== state.session) return;
    ui.refreshHUD?.(state.session);
    ui.refreshTab?.(state.session);
    void gpmRequestDomesticForecast(state, ui, true);
  } catch {
    if (ui._gpmCampaignPlanUi === state) state.status = "Could not save this plan. Try again.";
  } finally {
    if (ui._gpmCampaignPlanUi === state) {
      state.saving = false;
      gpmPaintDomestic(state, ui);
    }
  }
}

function gpmBindCampaignPlan(profile, view, ui) {
  const panel = profile.querySelector(".gpm-domestic");
  const data = view.party?.campaignPlan;
  if (!panel || !data) return;
  const session = ui._mpSession;
  const countryKey = view.player?.key;
  let state = ui._gpmCampaignPlanUi;
  if (!state || state.session !== session || state.partyId !== data.partyId || state.countryKey !== countryKey) {
    state = ui._gpmCampaignPlanUi = { session, partyId: data.partyId, countryKey, draft: data.plan,
      contestId: null, dirty: false, saving: false, status: "", forecastRequest: 0, forecastDay: -Infinity };
  }
  state.view = view;
  if (state.appliedPlan && view.day > state.planSavedAt) state.appliedPlan = null;
  const planStale = state.appliedPlan && Object.keys(state.appliedPlan).some(key => data.plan?.[key] !== state.appliedPlan[key]);
  state.data = planStale ? { ...data, plan: state.appliedPlan,
    reserve: state.data.reserve, nextPlannerDay: state.data.nextPlannerDay } : data;
  state.regions = view.party.regionalCampaign?.regions || [];
  const chambers = view.player?.pol?.chambers || [];
  state.contests = (data.contests || []).map(item => {
    const chamber = chambers.find(candidate => item.targetOrganId === `chamber:${candidate.id}`);
    return chamber && !item.label ? { ...item, label: Fi(chamber) } : item;
  });
  if (!state.dirty && !state.saving && (state.planSavedAt == null || state.planSavedAt < view.day)) state.draft = data.plan;
  const requested = ui._gpmDomesticOpen;
  if (requested?.session === session) {
    ui._gpmDomesticOpen = null;
    if (state.contests.some(contest => contest.id === requested.contestId)) state.contestId = requested.contestId;
    state.recapContestId = requested.recap ? requested.contestId : null;
    state.focusRecap = requested.recap;
  }
  if (!state.contests.some(contest => contest.id === state.contestId)) {
    state.contestId = state.contests.find(contest => contest.id === state.draft?.targetContestId)?.id || state.contests[0]?.id || null;
  }
  const form = panel.querySelector("[data-gpm-domestic-form]");
  const fields = form.querySelector(".gpm-domestic-fields");
  const fieldHtml = gpmDomesticFields(state, ui);
  if (fields._gpmRenderedHtml !== fieldHtml) {
    const focus = fields.contains(document.activeElement) ? document.activeElement.dataset.gpmProfileFocus : null;
    fields.innerHTML = fieldHtml;
    fields._gpmRenderedHtml = fieldHtml;
    gpmFillDomesticDraft(form, state.draft);
    if (focus) fields.querySelector(`[data-gpm-profile-focus="${CSS.escape(focus)}"]`)?.focus({ preventScroll: true });
  }
  state.fundingEnabled = view.party.foreignFunding?.enabled !== false;
  if (!state.dirty && !state.saving && !fields.contains(document.activeElement)) gpmFillDomesticDraft(form, state.draft);
  const contest = panel.querySelector("[data-gpm-domestic-contest]");
  const options = state.contests.map(item => `<option value="${b(item.id)}">${b(gpmDomesticContestLabel(item, ui))}</option>`).join("");
  if (contest._gpmOptions !== options) {
    contest.innerHTML = options;
    contest._gpmOptions = options;
  }
  contest.value = state.contestId || "";
  contest.disabled = state.contests.length === 0;
  const panelChanged = state.panel !== panel;
  state.panel = panel;
  if (panelChanged) {
    form.oninput = () => {
      state.draft = gpmReadDomesticDraft(form);
      state.dirty = true;
      state.status = "";
      gpmPaintDomestic(state, ui);
    };
    form.onsubmit = event => {
      event.preventDefault();
      void gpmSaveCampaignPlan(state, ui);
    };
    contest.onchange = () => {
      state.contestId = contest.value;
      state.recapContestId = null;
      state.focusRecap = false;
      void gpmRequestDomesticForecast(state, ui, true);
    };
    const ledger = panel.querySelector("[data-gpm-domestic-ledger]");
    ledger.open = state.ledgerOpen === true;
    ledger.ontoggle = () => { if (ledger.isConnected) state.ledgerOpen = ledger.open; };
    panel.querySelector("[data-gpm-domestic-agenda]").onclick = event => {
      const link = event.target.closest("[data-gpm-domestic-link]");
      if (link) gpmOpenDomesticAgendaLink(ui, link);
    };
    panel.querySelector("[data-gpm-domestic-refresh]").onclick = () => void gpmRequestDomesticForecast(state, ui, true);
  }
  gpmPaintDomestic(state, ui);
  void gpmRequestDomesticForecast(state, ui, Boolean(requested));
}

function patchPartyDomesticRenderer(js, replaceOnce) {
  const anchor = "\nmountPartyButtons();\n";
  js = replaceOnce(js, anchor, `\nconst gpmDomesticStyle = ${JSON.stringify(style)};\n${[...rendererFunctions, ...agreementRenderer].join("\n")}\nmountPartyButtons();\n`);
  js = replaceOnce(js, '  if (view.party.regionalCampaign) tabs.push(["regional",',
    '  if (view.party.campaignPlan) tabs.unshift(["plan", "Campaign Plan", gpmRenderCampaignPlan()]);\n  if (view.party.regionalCampaign) tabs.push(["regional",');
  js = replaceOnce(js, '  tabs.push(["laws", "Law Shortlist", gpmRenderPartyLaws()]);',
    '  if (view.party.agreement) tabs.push(["agreement", "Support Agreement", renderPartyAgreement(view, party, ui)]);\n  tabs.push(["laws", "Law Shortlist", gpmRenderPartyLaws()]);');
  js = replaceOnce(js, '    if (tab.id === "gpm-tab-regional")',
    '    if (tab.id === "gpm-tab-plan") gpmBindCampaignPlan(profile, view, ui);\n    if (tab.id === "gpm-tab-agreement") {\n      const party = view.player?.pol?.parties.find(item => item.id === view.party.agreement.partyId);\n      bindPartyAgreement(profile, view, party, ui);\n    }\n    if (tab.id === "gpm-tab-regional")');
  js = replaceOnce(js, 'n.push(...CA(t));let r=S$e(t)',
    'const gpmDeadlines=gpmDomesticSitroomRows(t,e);const gpmNearestContest=omt(t)?.contest?.id;' +
    'n.push(...CA(t).filter(row=>row.id!=="elec"||!gpmNearestContest||!gpmDeadlines.some(entry=>entry.contestId===gpmNearestContest)),...gpmDeadlines);let r=S$e(t)');
  js = replaceOnce(js, 'let p=LAt(this,a),m=OAt(this,a,l)',
    'let p=[...gpmDomesticSitroomRows(a,this,true),...LAt(this,a)],m=OAt(this,a,l)');
  js = replaceOnce(js, 'h$e(this._digest),this.refreshSitroom(this.sim);return',
    'h$e(this._digest),gpmDismissDomesticRecent(this,ay(this.sim)),this.refreshSitroom(this.sim);return');
  const navigation = 'let k=i.target.closest("[data-mod]");if(k&&this.sim){this.openModule(k.dataset.mod,k.dataset.sub||void 0);return}';
  return replaceOnce(js, navigation,
    'let gpmDomesticLink=i.target.closest("[data-gpm-domestic-link]");if(gpmDomesticLink&&this.sim){gpmOpenDomesticAgendaLink(this,gpmDomesticLink);return}' + navigation);
}

const rendererFunctions = [gpmRenderCampaignPlan, gpmDomesticMoney, gpmDomesticContestLabel, gpmDomesticAccount, gpmDomesticFields,
  gpmDomesticForecastHtml, gpmDomesticRecap, gpmDomesticProjectRows, gpmDomesticActivity, gpmDomesticAgendaEntries,
  gpmDomesticAgendaHtml, gpmDomesticAgendaRoute, gpmDomesticSitroomRows, gpmDismissDomesticRecent,
  gpmOpenDomesticAgendaLink, gpmPaintDomestic, gpmReadDomesticDraft,
  gpmFillDomesticDraft, gpmRequestDomesticForecast, gpmSaveCampaignPlan, gpmBindCampaignPlan];

module.exports = { patchPartyDomesticRenderer };

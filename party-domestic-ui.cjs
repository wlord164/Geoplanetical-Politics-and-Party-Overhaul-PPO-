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
      <div class="gpm-domestic-section" data-gpm-domestic-staff></div>
      <div class="gpm-domestic-fields"></div>
      <div class="gpm-domestic-actions">
        <button class="k" type="submit" data-gpm-profile-focus="domestic-save">Save campaign plan</button>
        <small data-gpm-domestic-status role="status"></small>
      </div>
    </form>
    <details data-gpm-domestic-ledger><summary>Party activity</summary><div data-gpm-domestic-log></div></details>
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
  </section>`;
}

function gpmDomesticMoney(value, signed = false) {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(ks(), {
    style: "currency", currency: "USD", maximumFractionDigits: 0, signDisplay: signed ? "exceptZero" : "auto",
  }).format(Math.round(value * 1e6));
}

function gpmDomesticContestLabel(contest, ui) {
  const key = contest?.chamberNameKey;
  const name = key && nt(key) ? o(key) : contest?.label || contest?.chamberName;
  const kind = contest?.kind === "presidential" ? "Executive election" : "Legislative election";
  return [name || kind, Number.isFinite(contest?.electionDay) && ui.gameDate(contest.electionDay)].filter(Boolean).join(" · ");
}

function gpmDomesticAccount(state, ui) {
  const { data } = state;
  const reserve = data.reserve || {};
  const membership = data.membership;
  const details = (pairs, label) => `<div class="gpm-domestic-summary"><h4>${v(label)}</h4><dl>${pairs.map(([key, value]) =>
    `<div><dt>${v(key)}</dt><dd>${v(String(value))}</dd></div>`).join("")}</dl></div>`;
  const counter = new Intl.NumberFormat(ks(), { maximumFractionDigits: 0 });
  return `<div class="gpm-domestic-grid">${details([
    ["Treasury", gpmDomesticMoney(data.cashM)], ["Activists available", Number.isFinite(data.activistsK) ? yr(data.activistsK) : "—"],
    ["Influence", Number.isFinite(data.influence) ? counter.format(data.influence) : "—"],
    ["Spent this month", gpmDomesticMoney(data.monthlySpendM)],
  ], "Party resources")}${details([
    ["Treasury", gpmDomesticMoney(reserve.cashM ?? 0)], ["Activists", yr(reserve.activistsK ?? 0)],
    ["Influence", counter.format(reserve.influence ?? 0)],
  ], "Staff reserve")}${membership ? details([
    ["Members", Number.isFinite(membership.members) ? counter.format(membership.members) : "—"],
    ["Dues", gpmDomesticMoney(membership.duesM)],
    ["Upkeep", gpmDomesticMoney(membership.upkeepM)],
    ["Net this month", gpmDomesticMoney(membership.netM, true)],
    ...(membership.votingWeightPct > 0 ? [["Relative voting weight", `+${gpmRegionalPercent(membership.votingWeightPct / 100)}`]] : []),
  ], "Membership") : ""}</div>`;
}

function gpmDomesticFields(state, ui) {
  const contestOptions = state.contests.map(contest =>
    `<option value="${v(contest.id)}">${v(gpmDomesticContestLabel(contest, ui))}</option>`).join("");
  const regionOptions = state.regions.map(region =>
    `<option value="${v(region.key)}">${v(gpmRegionalRegionName(region))}</option>`).join("");
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
    <small>Staff can organize, campaign, and make Congress and support agreement decisions when eligible. Leave the limit blank to spend from available funds. Staff use the same treasury, costs and cooldowns as your manual actions.</small>
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
    return `<div class="gpm-domestic-summary"><h4>${v(title)}</h4><dl>${rows.map(([label, detail]) =>
      `<div><dt>${v(label)}</dt>${detail ? `<dd>${v(detail)}</dd>` : ""}</div>`).join("")}</dl></div>`;
  };
  const electionDate = Number.isFinite(value.electionDay) ? ui.gameDate(value.electionDay) : "Election day";
  const rules = [gpmRegionalSeatRules(value), gpmRegionalThresholdText(value)].filter(Boolean);
  const assumptions = Array.isArray(value.assumptions) ? value.assumptions.filter(item => typeof item === "string").join(" ") : value.assumptions;
  return `<div class="gpm-domestic-grid">${show(value.current, "Current estimate")}${show(value.election, electionDate)}</div>
    <small>${v(rules.join(" · "))}</small>${typeof assumptions === "string" && assumptions ? `<small>${v(assumptions)}</small>` : ""}`;
}

function gpmDomesticRecap(result, ui, state = {}) {
  if (!result) return "";
  const day = result.day ?? result.electionDay;
  const before = result.beforeSeats ?? result.seatsBefore ?? result.before?.seats;
  const seats = result.seats ?? result.afterSeats ?? result.seatsAfter ?? result.after?.seats;
  const vote = result.voteShare ?? result.support ?? result.after?.support;
  const projectedSeats = result.projectedSeats ?? result.forecast?.seats;
  const key = result.chamberNameKey;
  const chamber = key && nt(key) ? o(key) : result.chamberName || result.label;
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
      return `<tr><th scope="row">${v(names.get(row.id) || row.label || row.id)}</th><td>${v(gpmRegionalPercent(row.votes))}</td>
        <td>${v(row.seats)}</td><td>${Number.isInteger(change) ? v(`${change > 0 ? "+" : ""}${change}`) : "—"}</td></tr>`;
    }).join("")}</tbody></table></details>` : "";
  return `<h4>Election recap</h4><small>${v([chamber || "Legislative election", Number.isFinite(day) && ui.gameDate(day)].filter(Boolean).join(" · "))}</small>
    <p>${v(lines.join(" · "))}</p>${table}`;
}

function gpmDomesticProjectRows(state, ui) {
  const view = state.view;
  const day = view.day || 0;
  const regions = new Map(state.regions.map(region => [region.key, gpmRegionalRegionName(region)]));
  const projects = [...(view.party.regionalCampaign?.projects || []), ...(view.party.organizing?.projects || []),
    ...(view.party.outreach?.project ? [{ kind: "outreach", ...view.party.outreach.project }] : [])];
  if (!projects.length) return "";
  return `<h4>Projects underway</h4><ul class="gpm-domestic-list">${projects.map(project => {
    const name = gpmRegionalActionName(project.kind) || "Party project";
    const target = regions.get(project.key) || (project.kind === "meeting" && project.targetId ? ti(project.targetId) : "");
    const duration = project.endDay - project.startDay;
    const details = [target, Number.isFinite(project.endDay) && `Due ${ui.gameDate(project.endDay)}`,
      Number.isFinite(project.activistsK) && `${yr(project.activistsK)} activists assigned`];
    return `<li><strong>${v(name)}</strong><small>${v(details.filter(Boolean).join(" · "))}</small>` +
      (Number.isFinite(project.startDay) && duration > 0 ? `<progress value="${Math.min(duration, Math.max(0, day - project.startDay))}" max="${duration}" aria-label="${v(name + " progress")}"></progress>` : "") + "</li>";
  }).join("")}</ul>`;
}

function gpmDomesticActivityLabel(kind) {
  return ({ fundraise: "Fundraising", recruit: "Activist recruitment", dues: "Membership dues", upkeep: "Local upkeep",
    "membership-upkeep": "Membership upkeep", "membership-dues": "Membership dues",
    campaign: "Contest operation", "campaign-promises": "Set campaign promises", plan: "Campaign plan",
    membership: "Membership and upkeep", transfer: "Party transfer", regional: "Regional campaigning",
    organizing: "Party organizing", meeting: "Public meeting", movement: "Backed peaceful mobilization",
    outreach: "Voter outreach", rally: "Regional rally", investment: "Local investment",
    headquarters: "Headquarters project", "congress-vote": "Congress vote",
    "agreement-offered": "Offered support agreement", "agreement-accepted": "Accepted support agreement",
    "agreement-declined": "Declined support agreement", "agreement-bill-tabled": "Tabled support agreement bill",
    "foreign-funding-request": "Requested foreign grant", "foreign-funding-received": "Received foreign grant",
    "foreign-funding-donated": "Donated foreign grant", "foreign-funding-return": "Returned foreign grant",
    "foreign-funding-refund": "Received foreign grant refund", "foreign-funding-declined": "Declined foreign grant",
    "foreign-funding-kept": "Kept foreign grant" })[kind] ||
    (typeof kind === "string" ? kind.replace(/[_-]+/g, " ").replace(/^./, char => char.toUpperCase()) : "Party activity");
}

function gpmDomesticActivityTarget(state, ui, row) {
  const target = row.details;
  if (typeof target !== "string" || !target || typeof row.kind !== "string") return "";
  if (row.kind === "campaign" || row.kind === "campaign-promises") {
    const contest = state.contests.find(item => item.id === target);
    return contest ? gpmDomesticContestLabel(contest, ui) : "";
  }
  if (["rally", "investment", "headquarters"].includes(row.kind)) {
    const region = state.regions.find(item => item.key === target);
    return region ? gpmRegionalRegionName(region) : "";
  }
  if (row.kind === "meeting" || row.kind === "outreach") return ti(target);
  if (row.kind === "movement") {
    const movement = state.view.party.organizing?.movements?.find(item => item.id === target);
    return movement ? o("domestic.demand." + movement.demandId) : "";
  }
  if (row.kind.startsWith("agreement-")) return Un(target);
  if (row.kind.startsWith("foreign-funding-")) return td(target, target);
  if (row.kind === "activists-returned") return gpmDomesticActivityLabel(target);
  return target;
}

function gpmDomesticStaffStatus(state, ui) {
  const { data } = state;
  const enabled = data.plan?.enabled;
  const latest = (data.ledger || []).find(row => row.staff === true);
  const review = data.lastReview;
  const status = enabled ? "Staff automation is on." : "Staff automation is off.";
  const next = enabled && Number.isFinite(data.nextPlannerDay) ? `Next monthly review ${ui.gameDate(data.nextPlannerDay)}.` : "";
  const previous = !Number.isFinite(review?.day) ? "" : Number.isInteger(review.staffActions)
    ? `Last monthly review ${ui.gameDate(review.day)} · ${review.staffActions ?
      `${review.staffActions} staff activity ${review.staffActions === 1 ? "entry" : "entries"}` : "No staff actions recorded"}`
    : `Last recorded party review ${ui.gameDate(review.day)} · Actor unrecorded`;
  const action = latest ? ["Latest staff action", Number.isFinite(latest.day) && ui.gameDate(latest.day),
    gpmDomesticActivityLabel(latest.kind), gpmDomesticActivityTarget(state, ui, latest)].filter(Boolean).join(" · ")
    : enabled ? "No staff actions recorded yet." : "";
  return [status, next, previous, action].filter(Boolean).map(line => `<small>${v(line)}</small>`).join("");
}

function gpmDomesticActivity(state, ui) {
  const ledger = state.data.ledger || [];
  if (!ledger.length) return "<small>No party activity recorded yet.</small>";
  return `<ul class="gpm-domestic-list">${ledger.map(row => {
    const details = [Number.isFinite(row.day) && ui.gameDate(row.day), row.cashM && gpmDomesticMoney(row.cashM, true),
      row.activistsK && `${row.activistsK > 0 ? "+" : ""}${yr(row.activistsK)} activists`,
      row.influence && `${row.influence > 0 ? "+" : ""}${row.influence} influence`,
      gpmDomesticActivityTarget(state, ui, row)].filter(Boolean);
    const title = (row.staff === true ? "Staff · " : "") + gpmDomesticActivityLabel(row.kind);
    return `<li><strong>${v(title)}</strong><small>${v(details.join(" · "))}</small></li>`;
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
    return `<li><button class="k k-nav" type="button" ${gpmDomesticAgendaRoute(row)}>${v(title)}</button>
      <small>${v([Number.isFinite(row.deadlineDay) && ui.gameDate(row.deadlineDay), row.status].filter(Boolean).join(" · "))}</small></li>`;
  }).join("")}</ul>`;
}

function gpmDomesticAgendaRoute(row) {
  const isRecap = row.kind === "electionRecap" || row.kind === "election_recap";
  return `data-gpm-domestic-link="${v(row.tab || "plan")}"` +
    (row.contestId ? ` data-gpm-domestic-contest-id="${v(row.contestId)}"` : "") + (isRecap ? ' data-gpm-domestic-result="1"' : "");
}

function gpmDomesticSitroomRows(view, ui, recent = false) {
  const dismissed = ui._gpmDomesticDismissed?.session === ui.sim ? ui._gpmDomesticDismissed.keys : null;
  return gpmDomesticAgendaEntries(view.gpmDomesticAgenda).filter(row =>
    recent === (row.status === "completed")).map(row => {
    const days = Number.isFinite(row.deadlineDay) ? Math.max(0, Math.ceil(row.deadlineDay - view.day)) : null;
    const measure = days === null ? "" : oc(days);
    const date = recent && Number.isFinite(row.day) ? ui.gameDate(row.day) : "";
    const contest = row.kind === "vote" ? view.player?.pol?.contests?.[row.contestId] : null;
    const title = contest ? zgt(view, contest) : row.title;
    return { id: `gpm-party:${row.kind}:${row.id}${recent ? ":" + row.day : ""}`, den: recent ? "registre" : "dossier", sort: days ?? 1e6,
      sev: days !== null && days <= 7 ? "important" : "routine", hand: recent ? "none" : "you",
      title: `${Do("gov")}${v(title)}`, meta: v(date), outcome: contest ? "Open Campaign Plan" : recent ? "" : row.status || "", measure,
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
  if (!panel?.isConnected || panel.closest('[role="tabpanel"]')?.hidden) return;
  const html = (name, value) => {
    const node = panel.querySelector(`[data-gpm-domestic-${name}]`);
    if (node._gpmRenderedHtml !== value) {
      node.innerHTML = value;
      node._gpmRenderedHtml = value;
    }
  };
  html("account", gpmDomesticAccount(state, ui));
  html("staff", gpmDomesticStaffStatus(state, ui));
  html("projects", gpmDomesticProjectRows(state, ui));
  html("log", gpmDomesticActivity(state, ui));
  html("agenda", gpmDomesticAgendaHtml(state, ui));
  html("forecast", state.forecast ? gpmDomesticForecastHtml(state.forecast, ui) +
    (Number.isFinite(state.forecast.day) ? `<small>Estimate as of ${v(ui.gameDate(state.forecast.day))}.</small>` : "") +
    (state.forecastError ? `<small>${v(state.forecastError)}</small>` : "") :
    `<small>${v(state.forecastPending ? "Checking the election outlook…" : state.forecastError || "No scheduled contest available.")}</small>`);
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
  gpmPaintDomesticForm(state);
  panel.querySelector("[data-gpm-domestic-refresh]").disabled = state.forecastPending || !state.contestId;
  if (state.focusRecap && !state.forecastPending && recap.textContent) {
    state.focusRecap = false;
    recap.scrollIntoView({ block: "nearest" });
    recap.focus({ preventScroll: true });
  }
}

function gpmPaintDomesticForm(state) {
  const panel = state.panel;
  if (!panel?.isConnected) return;
  panel.querySelector("[data-gpm-domestic-status]").textContent = state.status;
  for (const input of panel.querySelectorAll("[data-gpm-domestic-form] [name]")) {
    input.disabled = state.saving || !state.fundingEnabled && ["allowForeignFunding", "allowForeignDonations"].includes(input.name);
  }
  panel.querySelector('[type="submit"]').disabled = state.saving || !state.dirty;
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

function gpmRequestDomesticForecast(state, ui, force = false) {
  const id = state.contestId;
  if (!id) {
    state.forecast = null;
    state.forecastPending = false;
    state.forecastError = "";
    state.forecastRequest = null;
    state.forecastContestId = null;
    gpmPaintDomestic(state, ui);
    return;
  }
  const day = state.view.day || 0;
  const recent = state.forecastContestId === id && day - state.forecastAttemptDay < 7;
  if (state.forecastRequest?.id !== id && (force || !recent)) {
    state.forecastRequest = { id, day };
    state.forecastContestId = id;
    if (state.forecast?.contestId !== id) state.forecast = null;
    state.forecastPending = true;
    state.forecastError = "";
    gpmPaintDomestic(state, ui);
  }
  if (state.forecastRequest && !state.forecastRunning) void gpmRunDomesticForecast(state, ui);
}

async function gpmRunDomesticForecast(state, ui) {
  const isCurrent = () => ui._gpmCampaignPlanUi === state && ui._mpSession === state.session;
  state.forecastRunning = true;
  try {
    while (isCurrent() && state.forecastRequest && state.panel?.isConnected && !state.panel.closest('[role="tabpanel"]')?.hidden) {
      const request = state.forecastRequest;
      let result, error;
      try {
        result = await Je(state.session, "gpm.partyCampaignPlanForecast", { contestId: request.id });
        if (result?.contestId !== request.id) error = "An estimate is unavailable for this contest.";
      } catch {
        error = "Could not refresh the estimate. Try again.";
      }
      if (!isCurrent() || request !== state.forecastRequest) continue;
      state.forecastRequest = null;
      state.forecastPending = false;
      state.forecastAttemptDay = !error && Number.isFinite(result.day) ? result.day : request.day;
      state.forecastError = error || "";
      if (!error) state.forecast = result;
      gpmPaintDomestic(state, ui);
    }
  } finally {
    state.forecastRunning = false;
  }
}

async function gpmSaveCampaignPlan(state, ui) {
  if (state.saving || !state.dirty || ui._mpSession !== state.session) return;
  state.saving = true;
  state.status = "Saving plan…";
  gpmPaintDomesticForm(state);
  try {
    const plan = state.draft;
    const result = await Le(state.session, "applyPlayerAction", [{ ...state.actor, verb: "gpm.party.domestic.plan", partyId: state.partyId, plan }]);
    if (ui._gpmCampaignPlanUi !== state || ui._mpSession !== state.session) return;
    if (!result?.ok) {
      state.status = ({ contest: "The target contest has changed. Choose another contest.",
        region: "Your party can no longer organize in that region.", budget: "Enter a valid budget and reserve.",
        party: "This party is no longer under your control." })[result?.reason] || "Could not save this plan. Review the settings and try again.";
      return;
    }
    state.draft = result.plan || plan;
    state.appliedPlan = state.draft;
    if (result.campaignPlan?.partyId === state.partyId && !(state.view.day > result.day)) {
      state.data = { ...state.data, ...result.campaignPlan, plan: state.appliedPlan };
    } else {
      state.data = { ...state.data, plan: state.appliedPlan };
    }
    state.dirty = false;
    state.status = state.draft.enabled ? "Plan saved. Staff can act on the campaign schedule." : "Plan saved. Staff automation is off.";
    state.planSavedAt = Number.isFinite(result.day) ? result.day : state.view.day;
    const profile = state.panel?.closest(".gpm-party-profile");
    if (profile) {
      const view = { ...state.view, party: { ...state.view.party, campaignPlan: state.data } };
      gpmBindCampaignPlan(profile, view, ui, false);
      gpmFillDomesticDraft(state.panel.querySelector("[data-gpm-domestic-form]"), state.draft);
    }
  } catch {
    if (ui._gpmCampaignPlanUi === state) state.status = "Could not save this plan. Try again.";
  } finally {
    if (ui._gpmCampaignPlanUi === state) {
      state.saving = false;
      gpmPaintDomesticForm(state);
    }
  }
}

function gpmBindCampaignPlan(profile, view, ui, refreshForecast = true) {
  const panel = profile.querySelector(".gpm-domestic");
  const data = view.party?.campaignPlan;
  if (!panel || !data) return;
  const session = ui._mpSession;
  const countryKey = view.player?.key;
  let state = ui._gpmCampaignPlanUi;
  if (!state || state.session !== session || state.partyId !== data.partyId || state.countryKey !== countryKey) {
    state = ui._gpmCampaignPlanUi = { session, partyId: data.partyId, countryKey, draft: data.plan,
      contestId: null, dirty: false, saving: false, status: "", forecastRequest: null, forecastAttemptDay: -Infinity };
  }
  state.view = view;
  state.actor = gpmExpectedActor(countryKey, data.partyId, session?.playerControl);
  if (state.appliedPlan && view.day > state.planSavedAt) state.appliedPlan = null;
  const planStale = state.appliedPlan && Object.keys(state.appliedPlan).some(key => data.plan?.[key] !== state.appliedPlan[key]);
  state.data = planStale ? { ...data, plan: state.appliedPlan,
    reserve: state.data.reserve, nextPlannerDay: state.data.nextPlannerDay } : data;
  state.regions = view.party.regionalCampaign?.regions || [];
  const chambers = view.player?.pol?.chambers || [];
  state.contests = (data.contests || []).map(item => {
    const chamber = chambers.find(candidate => item.targetOrganId === `chamber:${candidate.id}`);
    return chamber && !item.label ? { ...item, label: Ji(chamber) } : item;
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
  const options = state.contests.map(item => `<option value="${v(item.id)}">${v(gpmDomesticContestLabel(item, ui))}</option>`).join("");
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
      gpmPaintDomesticForm(state);
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
  if (refreshForecast) gpmRequestDomesticForecast(state, ui, Boolean(requested));
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
  js = replaceOnce(js, 'n.push(...Xx(t));let r=FGe(t)',
    'const gpmDeadlines=gpmDomesticSitroomRows(t,e);const gpmNearestContest=$gt(t)?.contest?.id;' +
    'n.push(...Xx(t).filter(row=>row.id!=="elec"||!gpmNearestContest||!gpmDeadlines.some(entry=>entry.contestId===gpmNearestContest)),...gpmDeadlines);let r=FGe(t)');
  js = replaceOnce(js, 'let p=sTt(this,a),m=cTt(this,a,l)',
    'let p=[...gpmDomesticSitroomRows(a,this,true),...sTt(this,a)],m=cTt(this,a,l)');
  js = replaceOnce(js, 'LGe(this._digest),this.refreshSitroom(this.sim);return',
    'LGe(this._digest),gpmDismissDomesticRecent(this,a6(this.sim)),this.refreshSitroom(this.sim);return');
  const navigation = 'let k=i.target.closest("[data-mod]");if(k&&this.sim){this.openModule(k.dataset.mod,k.dataset.sub||void 0);return}';
  return replaceOnce(js, navigation,
    'let gpmDomesticLink=i.target.closest("[data-gpm-domestic-link]");if(gpmDomesticLink&&this.sim){gpmOpenDomesticAgendaLink(this,gpmDomesticLink);return}' + navigation);
}

const rendererFunctions = [gpmRenderCampaignPlan, gpmDomesticMoney, gpmDomesticContestLabel, gpmDomesticAccount, gpmDomesticFields,
  gpmDomesticForecastHtml, gpmDomesticRecap, gpmDomesticProjectRows, gpmDomesticActivityLabel, gpmDomesticActivityTarget,
  gpmDomesticStaffStatus, gpmDomesticActivity, gpmDomesticAgendaEntries,
  gpmDomesticAgendaHtml, gpmDomesticAgendaRoute, gpmDomesticSitroomRows, gpmDismissDomesticRecent,
  gpmOpenDomesticAgendaLink, gpmPaintDomestic, gpmPaintDomesticForm, gpmReadDomesticDraft,
  gpmFillDomesticDraft, gpmRequestDomesticForecast, gpmRunDomesticForecast, gpmSaveCampaignPlan, gpmBindCampaignPlan];

module.exports = { patchPartyDomesticRenderer };

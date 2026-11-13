"use strict";

const style = `
  .gpm-funding-card { display: grid; min-width: 0; gap: var(--gap-2); }
  .gpm-funding-card [data-gpm-funding-content] { display: grid; gap: var(--gap-2); }
  .gpm-funding-card p { margin: 0; }
  .gpm-funding-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr)); gap: var(--gap-2); }
  .gpm-funding-fields label { display: grid; min-width: 0; gap: var(--gap-1); }
  .gpm-funding-fields select { width: 100%; min-width: 0; }
  .gpm-funding-detail { display: grid; gap: var(--gap-1); padding: var(--gap-2); }
  .gpm-funding-factors { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: var(--gap-1) var(--gap-2); margin: 0; }
  .gpm-funding-factors dd { margin: 0; text-align: right; font-variant-numeric: tabular-nums; }
  .gpm-funding-actions { display: flex; flex-wrap: wrap; gap: var(--gap-2); }
  .gpm-funding-card [data-gpm-funding-status] { min-height: 1em; }
`;

function gpmRenderForeignFunding() {
  return `<section class="mcard gpm-funding-card" aria-label="Foreign Funding">
    <h3 class="mc-title">Foreign Funding</h3>
    <div data-gpm-funding-content></div>
    <small role="status" data-gpm-funding-status></small>
  </section>`;
}

function gpmForeignFundingMoney(amountM) {
  return rr(amountM * 1e6 * hA(), gA());
}

function gpmForeignFundingDonorName(donor) {
  const country = U({ key: donor.countryKey, name: donor.countryName, customName: donor.customName });
  const party = Sa({ id: donor.partyId, countryKey: donor.countryKey, nameDesc: donor.nameDesc });
  return party + " · " + country;
}

function gpmForeignFundingReason(reason) {
  return {
    active: "Resolve the current request, offer, or grant first.",
    capacity: "The transfer would exceed a party treasury limit.",
    cooldown: "Your party is still on cooldown.",
    donor: "The donor party is no longer available.",
    donor_funds: "The donor can no longer afford the grant.",
    disabled: "Foreign party funding is off in this campaign.",
    expired: "That offer or response has expired.",
    nothing_to_return: "There are no grant funds available to return.",
    party: "Your current party cannot use foreign funding.",
    support: "The donor declined to back your party.",
    terms: "Select a donor and valid grant terms.",
  }[reason] || "The action could not be completed.";
}

function gpmForeignFundingReceipt(last, ui) {
  if (!last) return "";
  const money = gpmForeignFundingMoney(last.amountM);
  const text = {
    refused: gpmForeignFundingReason(last.reason),
    declined: "Your party declined the " + money + " offer.",
    expired: "The " + money + " offer expired.",
    declared: "Your party accepted " + money + " in declared funding.",
    settled: "The exposure period ended for the " + money + " private grant.",
    repaid: "Your party returned " + gpmForeignFundingMoney(last.returnedM || 0) + " after the grant was exposed.",
    kept: "Your party kept the funds after the grant was exposed.",
  }[last.status];
  if (!text) return "";
  const penalty = last.credibilityLost > 0 ? ` Credibility fell by ${last.credibilityLost} points.` : "";
  return `<small>${b(ui.gameDate(last.day))} · ${b(gpmForeignFundingDonorName(last.donor))}<br>${b(text + penalty)}</small>`;
}

function gpmForeignFundingQuoteDetail(donor, state, ui, percent) {
  const factors = donor.factors;
  let breakdown = "";
  if (factors) {
    const points = new Intl.NumberFormat(cs(), { signDisplay: "exceptZero", maximumFractionDigits: 1 });
    const items = [
      ["Base chance", factors.baseline],
      ["Ideological alignment", factors.ideology],
      ["Ideological solidarity", factors.solidarity],
      ["Electoral traction", factors.traction],
    ];
    breakdown = `<dl class="gpm-funding-factors">${items.map(([label, value]) =>
      `<dt>${label}</dt><dd>${b(points.format(value * 100))} pp</dd>`).join("")}
      <dt>Before offer limits</dt><dd>${b(percent.format(factors.uncappedChance))}</dd></dl>`;
  }
  const treasury = (factors?.fundsAvailable ?? donor.chance > 0)
    ? `Treasury allows a grant up to ${gpmForeignFundingMoney(donor.limitM)}. The donor can offer less than requested.`
    : "The donor treasury cannot cover the minimum grant.";
  const date = Number.isFinite(state.quotesDay) ? ui.gameDate(state.quotesDay) : "";
  const stale = date && state.quotesDay !== state.data.day;
  return `<div class="sh-inset gpm-funding-detail"><b>${b(gpmForeignFundingDonorName(donor))}</b>
    <small>Ideological alignment ${b(percent.format(donor.match))} · Estimated chance of an offer ${b(percent.format(donor.chance))}</small>
    <small>${b(Object.entries(donor.alignment).map(([axis, delta]) => {
      const names = { econ: "Economy", social: "Social", gov: "Governance", nat: "National" };
      const score = Math.round(delta * 100);
      return names[axis] + " " + (score > 0 ? "+" : "") + score;
    }).join(" · "))} relative to your platform</small>
    ${breakdown}
    <small>${b(treasury)}</small>
    ${date ? `<small>Quote as of ${b(date)}.${stale ? " Refresh quotes to update." : ""}</small>` : ""}
  </div>`;
}

function gpmForeignFundingRequestFields(state, ui) {
  if (!state.countries) {
    return state.loading ? "<p>Loading foreign parties…</p>"
      : '<button class="k" type="button" data-gpm-funding-action="retry">Load foreign parties</button>';
  }
  if (!state.countries.length) return "<p>No foreign parties are available.</p>";
  const countryOptions = state.countries.map(country =>
    `<option value="${b(country.key)}"${state.countryKey === country.key ? " selected" : ""}>${b(U(country))}</option>`).join("");
  const donorOptions = (state.donors || []).map(donor => `<option value="${b(donor.partyId)}"${state.donorId === donor.partyId ? " selected" : ""}>
    ${b(Sa({ id: donor.partyId, countryKey: donor.countryKey, nameDesc: donor.nameDesc }))}</option>`).join("");
  const donor = state.donors?.find(entry => entry.partyId === state.donorId);
  const percent = new Intl.NumberFormat(cs(), { style: "percent", maximumFractionDigits: 0 });
  const amounts = (state.data.amountOptions || [.04, .10, .20]).map(amount =>
    `<option value="${amount}"${state.amountM === amount ? " selected" : ""}>${b(gpmForeignFundingMoney(amount))}</option>`).join("");
  const visibility = state.visibility === "private" ? " selected" : "";
  const detail = donor ? gpmForeignFundingQuoteDetail(donor, state, ui, percent) : "";
  return `<div class="gpm-funding-fields">
    <label>Country <select class="k" data-gpm-funding-field="country"><option value="">Select a country</option>${countryOptions}</select></label>
    <label>Party <select class="k" data-gpm-funding-field="donor"${state.loading || !donorOptions ? " disabled" : ""}>
      <option value="">${state.loading ? "Loading…" : "Select a party"}</option>${donorOptions}</select></label>
    <label>Requested grant <select class="k" data-gpm-funding-field="amount">${amounts}</select></label>
    <label>Visibility <select class="k" data-gpm-funding-field="visibility">
      <option value="declared">Declared</option><option value="private"${visibility}>Private</option></select></label>
    </div>${detail}
    <div class="gpm-funding-actions">
      <button class="k" type="button" data-gpm-funding-action="request"${donor?.chance > 0 && !state.busy && !state.loading ? "" : " disabled"}>Request Funding</button>
      ${state.countryKey ? `<button class="k" type="button" data-gpm-funding-action="retry"${state.loading || state.busy ? " disabled" : ""}>${state.donors ? "Refresh quotes" : "Reload Parties"}</button>` : ""}
    </div>`;
}

function gpmForeignFundingPanel(state, ui) {
  const data = state.data;
  const money = gpmForeignFundingMoney;
  const donor = deal => b(gpmForeignFundingDonorName(deal.donor));
  const button = (action, label, disabled = false) =>
    `<button class="k" type="button" data-gpm-funding-action="${action}"${disabled || state.busy ? " disabled" : ""}>${label}</button>`;
  if (data.pending) {
    return `<b>${donor(data.pending)}</b><p>Requested ${b(money(data.pending.amountM))}. Response expected by ${b(ui.gameDate(data.pending.responseDay))}.</p>`;
  }
  if (data.offer) {
    const offer = data.offer;
    const privateGrant = offer.visibility === "private";
    const risk = new Intl.NumberFormat(cs(), { style: "percent", maximumFractionDigits: 0 }).format(offer.risk);
    return `<b>${donor(offer)}</b><p>${b(money(offer.amountM))} one-time grant${offer.amountM < offer.requestedM
      ? ` · ${b(money(offer.requestedM))} requested` : ""}</p>
      <div class="sh-inset gpm-funding-detail"><b>${privateGrant ? "Private backing" : "Declared backing"}</b>
        <small>${privateGrant ? `${b(risk)} exposure risk within 90 days. A leak costs 4 credibility points and up to 8 more if you keep the funds. Returning unspent funds reduces the additional loss.`
          : "Public backing costs 2 credibility points on acceptance."}</small>
        <small>Funds go into the party treasury. Offer expires ${b(ui.gameDate(offer.expiresDay))}.</small></div>
      <div class="gpm-funding-actions">${button("accept", "Accept Grant")}${button("decline", "Decline")}</div>`;
  }
  if (data.grant) {
    const grant = data.grant;
    return grant.exposed
      ? `<b>Foreign funding exposed</b><p>${donor(grant)} · ${b(money(grant.amountM))} accepted</p>
        <p>Credibility fell by ${b(grant.credibilityLost)} points. Returning the unspent grant reduces the additional loss.</p>
        <small>${b(money(grant.returnableM))} available to return · Respond before ${b(ui.gameDate(grant.responseDay))}.</small>
        <div class="gpm-funding-actions">${button("return", "Return Unspent Funds", !(grant.returnableM > 0))}
          ${button("keep", "Keep Funds")}</div>`
      : `<b>Private grant received</b><p>${donor(grant)} · ${b(money(grant.amountM))} accepted</p>
        <small>${b(money(grant.unspentM))} unspent · Exposure period ends ${b(ui.gameDate(grant.closeDay))}.</small>`;
  }
  const receipt = gpmForeignFundingReceipt(data.last, ui);
  if (data.enabled === false) return `${receipt}<p>Foreign party funding is off in this campaign.</p>`;
  if (data.day < data.nextRequestDay) {
    return `${receipt}<p>Next approach available ${b(ui.gameDate(data.nextRequestDay))}.</p>`;
  }
  return receipt + gpmForeignFundingRequestFields(state, ui);
}

function gpmPaintForeignFunding(panel, state, ui) {
  if (!panel.isConnected) return;
  const content = panel.querySelector("[data-gpm-funding-content]");
  const html = gpmForeignFundingPanel(state, ui);
  if (content._gpmFundingHtml !== html) {
    const active = document.activeElement;
    const field = content.contains(active) && active.dataset.gpmFundingField;
    const action = content.contains(active) && active.dataset.gpmFundingAction;
    content.innerHTML = html;
    content._gpmFundingHtml = html;
    if (field) content.querySelector(`[data-gpm-funding-field="${field}"]`)?.focus({ preventScroll: true });
    if (action) content.querySelector(`[data-gpm-funding-action="${action}"]`)?.focus({ preventScroll: true });
  }
  panel.querySelector("[data-gpm-funding-status]").textContent = state.status;
}

async function gpmLoadForeignFunding(panel, state, ui) {
  const request = ++state.query;
  const isCurrent = () => request === state.query && state.session === ui._mpSession && panel._gpmForeignFundingUi === state;
  const countryKey = state.countryKey;
  state.loading = true;
  state.status = "";
  gpmPaintForeignFunding(panel, state, ui);
  try {
    if (!state.countries) {
      const result = await at(state.session, "gpm.foreignFunding");
      if (!isCurrent()) return;
      state.countries = [...(result?.countries || [])].sort((a, b) => U(a).localeCompare(U(b), cs()));
    }
    if (countryKey) {
      const result = await at(state.session, "gpm.foreignFunding", { countryKey });
      if (!isCurrent()) return;
      state.donors = result?.donors || [];
      state.quotesDay = result?.day;
      if (!state.donors.some(donor => donor.partyId === state.donorId)) state.donorId = state.donors[0]?.partyId || "";
      if (!state.donors.length) state.status = "No parties are available in this country.";
    }
  } catch (error) {
    console.error("[PPO] Foreign funding directory failed", error);
    if (isCurrent()) state.status = "The foreign party directory could not be loaded.";
  } finally {
    if (isCurrent()) {
      state.loading = false;
      gpmPaintForeignFunding(panel, state, ui);
    }
  }
}

async function gpmSubmitForeignFunding(panel, state, ui, action) {
  const data = state.data;
  if (state.busy || state.session !== ui._mpSession) return;
  if (action === "retry") {
    if (!state.loading) return gpmLoadForeignFunding(panel, state, ui);
    return;
  }
  const input = action === "request" ? {
    donorCountryKey: state.countryKey, donorPartyId: state.donorId, amountM: state.amountM, visibility: state.visibility,
  } : { requestId: (data.grant || data.offer)?.requestId };
  state.busy = true;
  state.status = "";
  gpmPaintForeignFunding(panel, state, ui);
  try {
    const result = await Te(state.session, "applyPlayerAction", [{ ...input, verb: "gpm.party.funding." + action }]);
    state.status = result?.ok ? "" : gpmForeignFundingReason(result?.reason);
    const snapshot = await at(state.session, G.POLITICS);
    if (state.session !== ui._mpSession) return;
    const current = Va(state.session, snapshot)?.party?.foreignFunding;
    if (current?.partyId === data.partyId) state.data = current;
    ui.refreshHUD?.(state.session);
    ui.refreshTab?.(state.session);
  } catch (error) {
    console.error("[PPO] Foreign funding action failed", error);
    state.status = "The funding action could not be verified.";
  } finally {
    state.busy = false;
    gpmPaintForeignFunding(panel, state, ui);
  }
}

function gpmBindForeignFunding(profile, view, ui) {
  const panel = profile.querySelector(".gpm-funding-card");
  const data = view.party?.foreignFunding;
  if (!panel || !data) return;
  const session = ui._mpSession;
  const country = view.player.key;
  const amounts = data.amountOptions || [.04, .10, .20];
  let state = panel._gpmForeignFundingUi;
  if (!state || state.session !== session || state.data.partyId !== data.partyId || state.country !== country) {
    state = { session, country, data, countries: null, countryKey: "", donorId: "", amountM: amounts[Math.floor(amounts.length / 2)],
      visibility: "declared", donors: null, query: 0, loading: false, busy: false, status: "" };
    panel._gpmForeignFundingUi = state;
  } else if (!state.busy) {
    state.data = data;
    if (!amounts.includes(state.amountM)) state.amountM = amounts[Math.floor(amounts.length / 2)];
  }
  panel.onclick = event => {
    const action = event.target.closest("[data-gpm-funding-action]")?.dataset.gpmFundingAction;
    if (action) void gpmSubmitForeignFunding(panel, state, ui, action);
  };
  panel.onchange = event => {
    if (state.busy) return;
    const { value, dataset } = event.target;
    switch (dataset.gpmFundingField) {
      case "country":
        state.countryKey = value;
        state.donors = null;
        state.quotesDay = null;
        state.donorId = "";
        void gpmLoadForeignFunding(panel, state, ui);
        return;
      case "donor": state.donorId = value; break;
      case "amount": state.amountM = Number(value); break;
      case "visibility": state.visibility = value; break;
      default: return;
    }
    gpmPaintForeignFunding(panel, state, ui);
  };
  if (data.enabled !== false && !state.countries && !state.loading && !state.status && !data.pending && !data.offer && !data.grant && data.day >= data.nextRequestDay) {
    void gpmLoadForeignFunding(panel, state, ui);
  } else {
    gpmPaintForeignFunding(panel, state, ui);
  }
}

module.exports = {
  style,
  rendererFunctions: [gpmRenderForeignFunding, gpmForeignFundingMoney, gpmForeignFundingDonorName,
    gpmForeignFundingReason, gpmForeignFundingReceipt, gpmForeignFundingQuoteDetail,
    gpmForeignFundingRequestFields, gpmForeignFundingPanel,
    gpmPaintForeignFunding, gpmLoadForeignFunding, gpmSubmitForeignFunding, gpmBindForeignFunding],
};

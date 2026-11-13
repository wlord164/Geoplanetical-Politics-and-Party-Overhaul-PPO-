"use strict";

const style = `
  .gpm-law-shortlist { display: grid; gap: var(--gap-2); min-width: 0; }
  .gpm-law-shortlist [data-gpm-law-refresh] { justify-self: start; }
  .gpm-law-shortlist [data-gpm-law-status]:empty, .gpm-law-shortlist [data-gpm-law-rights]:empty,
  .gpm-law-shortlist [data-gpm-law-results]:empty { display: none; }
  .gpm-law-shortlist [data-gpm-law-results] { display: grid; gap: var(--gap-1); padding: 0; margin: 0; list-style: none; }
  .gpm-law-shortlist li { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: var(--gap-1) var(--gap-2);
    padding: var(--gap-2); border: 1px solid var(--line, #474950); }
  .gpm-law-shortlist li div { display: grid; gap: var(--gap-1); overflow-wrap: anywhere; }
  .gpm-law-shortlist li button { align-self: start; }
`;

function gpmRenderPartyLaws() {
  return `<section class="mcard wide gpm-law-shortlist" aria-label="Law Shortlist">
    <h3 class="mc-title">Law Shortlist</h3>
    <small>Proposals closer to your party’s position, ranked by the legislative forecast. Fit points measure the improvement in alignment with your party.</small>
    <button class="k" type="button" data-gpm-law-refresh>Refresh forecast</button>
    <small data-gpm-law-status role="status"></small>
    <small data-gpm-law-rights></small>
    <ol data-gpm-law-results></ol>
  </section>`;
}

function gpmPartyLawRows(laws, country) {
  const formatGain = new Intl.NumberFormat(cs(), { maximumFractionDigits: 1 });
  return laws.map((law, index) => {
    const definition = dl(law.lawId);
    const name = tr(law.lawId);
    const value = definition ? yo(definition, law.value, country) : "";
    const vote = law.total > 0
      ? `${law.yes} of ${law.total} yes${Number.isFinite(law.requiredVotes) ? ` · ${law.requiredVotes} needed` : ""}`
      : "Chamber vote unavailable";
    const risks = [law.vetoRisk && "Veto risk", law.courtRisk && "Court risk"].filter(Boolean);
    return `<li><div>
      <strong>${b(name)}</strong>
      ${value ? `<small>${b(value)}</small>` : ""}
      <small>${b(law.priority ? `Platform priority · ${vote}` : `+${formatGain.format(law.gain)} fit points · ${vote}`)}</small>
      <small>${b([law.passes ? "Favorable forecast" : "Needs work", ...risks].join(" · "))}</small>
      </div><button class="k" type="button" data-gpm-law-review="${index}" aria-label="${b("Review proposal for " + name)}">Review proposal</button></li>`;
  }).join("");
}

function gpmBindPartyLaws(profile, view, ui) {
  const panel = profile.querySelector(".gpm-law-shortlist");
  const session = ui._mpSession;
  const partyId = view.party?.dashboard?.partyId ?? view.party?.parliament?.partyId;
  const countryKey = view.player?.key;
  if (!panel || !session || partyId == null || countryKey == null) return;

  let state = ui._gpmPartyLaws;
  if (!state || state.session !== session || state.partyId !== partyId || state.countryKey !== countryKey) {
    state = ui._gpmPartyLaws = { session, partyId, countryKey };
  }
  state.day = view.day;
  const refresh = panel.querySelector("[data-gpm-law-refresh]");
  const status = panel.querySelector("[data-gpm-law-status]");
  const rights = panel.querySelector("[data-gpm-law-rights]");
  const results = panel.querySelector("[data-gpm-law-results]");
  const isCurrent = () => ui._mpSession === session && ui._gpmPartyLaws === state;

  const paint = () => {
    const data = state.data;
    const date = Number.isFinite(data?.day) ? ui.gameDate(data.day) : "";
    const parts = [state.loading && "Checking the forecast…", state.error];
    if (date) {
      parts.push(`Forecast as of ${date}.`);
      if (data.day !== state.day) parts.push("Refresh to check the current votes.");
    }
    if (data && !data.laws.length) parts.push("No matching proposals available.");
    const message = parts.filter(Boolean).join(" ");
    if (status.textContent !== message) status.textContent = message;
    refresh.disabled = Boolean(state.loading);
    rights.textContent = data?.rights?.ok === false
      ? ui._mpParliamentBlock(data.rights.reason)
      : "";
    if (panel._gpmLawData !== data) {
      results.innerHTML = data ? gpmPartyLawRows(data.laws, view.player) : "";
      panel._gpmLawData = data;
    }
  };
  state.paint = paint;

  const load = async () => {
    if (state.loading || !isCurrent()) return;
    state.loading = true;
    state.error = "";
    state.paint();
    try {
      const data = await at(session, "gpm.partyLawShortlist", {});
      if (!isCurrent()) return;
      if (data?.partyId !== partyId || !Array.isArray(data.laws)) {
        state.error = "Law forecasts are unavailable for this party.";
      } else {
        state.data = data;
      }
    } catch {
      if (isCurrent()) state.error = "Could not load the law forecast. Try refreshing.";
    } finally {
      state.loading = false;
      if (isCurrent()) state.paint();
    }
  };
  refresh.onclick = load;
  results.onclick = event => {
    const button = event.target.closest("[data-gpm-law-review]");
    if (!button || !isCurrent()) return;
    const law = state.data?.laws[Number(button.dataset.gpmLawReview)];
    if (!law) return;
    (ui._sel ||= {})[`law:${law.lawId}`] = law.value;
    ui._lawQuery = "";
    ui.openLaws(session, { focusLawId: law.lawId });
  };
  paint();
  if (!state.data && !state.error) void load();
}

module.exports = { style, rendererFunctions: [gpmRenderPartyLaws, gpmPartyLawRows, gpmBindPartyLaws] };


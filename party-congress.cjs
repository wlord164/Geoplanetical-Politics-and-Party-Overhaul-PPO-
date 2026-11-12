"use strict";

function partyCongressSizeDraft(view, party, ui, current, value) {
  const key = "ppo:congress-proposed-delegates:" + JSON.stringify([view.player?.key, party.id]);
  const choices = ui._gpmCongressSizeDrafts ||= new Map();
  if (partyCongressSizeIsValid(value)) {
    choices.set(key, value);
    try { localStorage.setItem(key, String(value)); } catch {}
  }
  if (!choices.has(key)) {
    let saved;
    try { saved = Number(localStorage.getItem(key)); } catch {}
    if (partyCongressSizeIsValid(saved)) choices.set(key, saved);
  }
  return choices.get(key) ?? current;
}

function renderPartyCongressChart(data, total, ui) {
  const factions = partyCongressFactions(data, total);
  if (!factions.length) return '<p class="empty-note">Faction estimate unavailable.</p>';

  const rows = Math.max(3, Math.round(Math.sqrt(total / 2.6)));
  const outerRadius = 162;
  const innerRadius = outerRadius * .52;
  const points = ui._seatLayout(total, rows, innerRadius, outerRadius);
  const dotRadius = Math.max(1.6, Math.min(6.2, (outerRadius - innerRadius) / (rows - 1) * .42));
  const colors = ["#e36469", "#886fd7", "#4894e2", "#62b69d", "#e0a759", "#d275a8", "#72b5be", "#bb8d72"];
  const dots = [];
  const legend = [];
  let pointIndex = 0;

  for (const [index, group] of factions.entries()) {
    const id = `gpm-faction-${index}`;
    const color = colors[index] || `hsl(${Math.round(index * 137.508) % 360}, 65%, 68%)`;
    for (let seat = 0; seat < group.seats; seat++) {
      const point = points[pointIndex++];
      dots.push(`<circle class="seat" data-pty="${id}" cx="${(170 + point.x).toFixed(1)}" cy="${(168 + point.y).toFixed(1)}" r="${dotRadius.toFixed(1)}" fill="${color}"/>`);
    }
    const detail = [...(group.labels || []), ...group.names].join(", ");
    const count = `${group.seats} ${group.seats === 1 ? "delegate" : "delegates"}`;
    legend.push(`<span class="hc-leg-item" tabindex="0" data-pty="${id}" data-gpm-faction="${b(group.label)}"${detail ? ` data-tip="${b(detail)}"` : ""} aria-label="${b([group.label, count, detail].filter(Boolean).join(", "))}"><i style="background:${color}"></i>${b(group.label)} <b>${group.seats}</b></span>`);
  }
  return `<div class="hemicycle">
    <svg viewBox="0 0 340 178" class="hc-svg" role="img" aria-label="${total} estimated Congress delegates by faction">
      <text x="170" y="161" class="hc-total" text-anchor="middle">${total}</text>
      <text x="170" y="175" class="hc-total-sub" text-anchor="middle">delegates</text>
      ${dots.join("")}
    </svg>
    <div class="hc-legend">${legend.join("")}</div>
  </div>`;
}

function renderPartyCongress(view, party, ui) {
  const data = view.party?.congress;
  if (!data || !party) return "";
  const current = partyCongressSizeIsValid(data.size) ? data.size : 100;
  const proposed = partyCongressSizeDraft(view, party, ui, current);
  const forecast = partyCongressSizeVote(data, proposed);
  const lastVote = partyCongressVoteSummary(data.lastVote);
  return `<section class="mcard wide gpm-party-congress" aria-label="Party Congress">
    <h3 class="mc-title">Party Congress</h3>
    <div class="gpm-congress-chart" data-gpm-congress-chart>${renderPartyCongressChart(data, current, ui)}</div>
    <label class="gpm-congress-control">Proposed size <strong data-gpm-congress-proposed>${proposed}</strong>
      <span aria-hidden="true">50</span><input class="gpm-congress-size" data-gpm-congress-size type="range" min="50" max="200" step="1" value="${proposed}"><span aria-hidden="true">200</span>
    </label>
    <div class="gpm-congress-control">
      <button class="k" type="button" data-gpm-congress-vote ${forecast.ok ? "" : "disabled"}>Hold size vote</button>
      <small data-gpm-congress-forecast>${b(partyCongressVoteSummary(forecast, true))}</small>
    </div>
    <small data-gpm-congress-result role="status" ${lastVote ? "" : "hidden"}>${b(lastVote)}</small>
    <small>Faction estimates use the party platform, voter support, and known figures.</small>
  </section>`;
}

function partyCongressVoteSummary(vote, forecast = false) {
  if (!vote) return "";
  if (forecast) {
    if (vote.reason === "unchanged") return "Choose a different size to hold a vote.";
    if (!vote.ok) return "A size vote is unavailable.";
    return `Forecast ${vote.yes} of ${vote.total} in favor · ${vote.passed ? "would pass" : "would fall short"}`;
  }
  return `Size change ${vote.passed ? "adopted" : "rejected"} · ${vote.proposed} delegates proposed · ${vote.yes} of ${vote.total} in favor`;
}

function bindPartyCongress(host, view, party, ui) {
  const panel = host.querySelector('[data-mp-reading="gpm-congress"]');
  if (!panel) return;
  const data = view.party?.congress;
  if (!data || !party) {
    panel.innerHTML = "";
    return;
  }
  if (!panel.querySelector("[data-gpm-congress-size]")) panel.innerHTML = renderPartyCongress(view, party, ui);
  const input = panel.querySelector("[data-gpm-congress-size]");
  const chart = panel.querySelector("[data-gpm-congress-chart]");
  const button = panel.querySelector("[data-gpm-congress-vote]");
  const proposalLabel = panel.querySelector("[data-gpm-congress-proposed]");
  const forecastLabel = panel.querySelector("[data-gpm-congress-forecast]");
  const result = panel.querySelector("[data-gpm-congress-result]");
  const current = partyCongressSizeIsValid(data.size) ? data.size : 100;
  const updateDraft = value => {
    const proposed = partyCongressSizeDraft(view, party, ui, current, value);
    if (Number(input.value) !== proposed) input.value = String(proposed);
    if (proposalLabel.textContent !== String(proposed)) proposalLabel.textContent = String(proposed);
    const forecast = partyCongressSizeVote(data, proposed);
    const forecastText = partyCongressVoteSummary(forecast, true);
    if (forecastLabel.textContent !== forecastText) forecastLabel.textContent = forecastText;
    button.disabled = !forecast.ok || button.getAttribute("aria-busy") === "true";
    return forecast;
  };
  const html = renderPartyCongressChart(data, current, ui);
  if (chart._gpmCongressHtml !== html) {
    const focused = document.activeElement?.getAttribute("data-gpm-faction");
    chart.innerHTML = html;
    chart._gpmCongressHtml = html;
    ui._wireHemicycle(chart);
    if (focused) {
      [...chart.querySelectorAll("[data-gpm-faction]")]
        .find(item => item.getAttribute("data-gpm-faction") === focused)?.focus({ preventScroll: true });
    }
  }
  const latest = partyCongressVoteSummary(data.lastVote);
  if (result.textContent !== latest) result.textContent = latest;
  result.hidden = !latest;
  input.oninput = () => updateDraft(Number(input.value));
  button.onclick = async () => {
    const forecast = updateDraft();
    if (button.disabled) return;
    const response = await ui._mpSubmit(button, "applyPlayerAction", [{ verb: "gpm.party.congressSize", size: forecast.proposed }]);
    if (!button.isConnected) return;
    input.oninput();
    if (response?.ok) {
      button.parentElement.querySelector(".mp-local-feedback")?.remove();
      ui.refreshHUD?.(ui._mpSession);
      ui.refreshTab?.(ui._mpSession);
    }
  };
  updateDraft();
}

module.exports = {
  rendererFunctions: [partyCongressSizeDraft, renderPartyCongressChart, partyCongressVoteSummary, renderPartyCongress, bindPartyCongress],
};

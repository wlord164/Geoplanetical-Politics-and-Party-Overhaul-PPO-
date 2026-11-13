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

function partyCongressPriorityName(kind) {
  return kind === "investment" ? "Local investment" : "Regional rallies";
}

function partyCongressVoteSummary(vote, ui, forecast = false) {
  if (!vote) return "";
  if (!vote.ok) {
    const unavailable = {
      unchanged: "Choose a different size to hold a vote.",
      party: "This party cannot hold a Congress vote.",
      cooldown: Number.isFinite(vote.nextVoteDay) ? "Next vote available " + ui.gameDate(vote.nextVoteDay) + "." : "This vote is on cooldown.",
      active: "Congress can vote on a new priority when the current one expires.",
      budget: "The party treasury cannot cover this grant.",
      bargain: "This faction grant is no longer available.",
      stale: "The forecast changed. Review the updated vote before submitting.",
    };
    return unavailable[vote.reason] || "This vote is unavailable.";
  }
  const needed = vote.needed ?? Math.floor(vote.total / 2) + 1;
  const count = String(vote.yes) + " of " + vote.total + " yes · " + needed + " needed";
  if (forecast) return count + " · " + (vote.passed ? "Would pass" : "Would fall short");
  const proposal = vote.kind === "priority" ? partyCongressPriorityName(vote.priority) + " priority" : vote.proposed + " delegates";
  const grant = vote.passed && vote.bargain ? " · Grant paid to " + vote.bargain.label : "";
  return "Last vote · " + proposal + (vote.passed ? " adopted · " : " rejected · ") + count + grant;
}

function partyCongressVoteRows(vote) {
  if (!vote?.factions?.length) return "";
  const percent = new Intl.NumberFormat(cs(), { style: "percent", maximumFractionDigits: 2 });
  return vote.factions.map(faction => {
    const current = faction.currentSeats;
    const seatCount = vote.kind === "size"
      ? current + " → " + faction.proposedSeats + " delegates"
      : current + " delegates";
    const currentShare = percent.format(current / vote.current);
    const influence = vote.kind === "size"
      ? currentShare + " → " + percent.format(faction.proposedSeats / vote.proposed) + " of Congress"
      : currentShare + " of Congress";
    const no = current - faction.yes;
    const position = !current ? "No current delegates" : faction.yes > no ? "Leans yes" : faction.yes < no ? "Leans no" : "Split";
    const tally = current ? " · " + faction.yes + " yes · " + no + " no" : "";
    return '<li class="gpm-congress-faction"><strong>' + b(faction.label) + '</strong><span class="num">' + b(seatCount) +
      '<small>' + b(influence) + '</small></span><span>' + b(position + tally) + '</span><small>' + b(faction.reason || "") + '</small></li>';
  }).join("");
}

function partyCongressGrantOptions(vote) {
  return '<option value="">No grant</option>' + (vote?.bargains || []).map(grant => {
    const cash = rr(grant.cash * 1e6 * hA(), gA());
    return '<option value="' + b(grant.label) + '"' + (grant.affordable ? "" : " disabled") + '>' +
      b(grant.label + " · +" + grant.extraYes + " yes · " + cash + (grant.affordable ? "" : " · Unaffordable")) + '</option>';
  }).join("");
}

function partyCongressGrantDetail(vote) {
  if (!vote?.bargain) return "An organizing grant can win votes from one faction. The treasury pays only if the motion passes.";
  const { label, extraYes, cash } = vote.bargain;
  return label + " adds " + extraYes + " yes " + (extraYes === 1 ? "vote" : "votes") + ". If adopted, the party treasury pays " +
    rr(cash * 1e6 * hA(), gA()) + ".";
}

function partyCongressPriorityDetail(data, priority, ui) {
  const active = data.priority;
  const chosen = active?.kind || priority;
  const costs = chosen === "investment"
    ? "New local investments cost 20% less cash and regional rallies cost 15% more."
    : "New regional rallies cost 20% less cash and local investments cost 15% more.";
  return active
    ? partyCongressPriorityName(active.kind) + " has priority until " + ui.gameDate(active.untilDay) + ". " + costs
    : "For 90 days if adopted. " + costs;
}

function renderPartyCongress(view, party, ui) {
  const data = view.party?.congress;
  if (!data || !party) return "";
  const current = partyCongressSizeIsValid(data.size) ? data.size : 100;
  const proposed = partyCongressSizeDraft(view, party, ui, current);
  return '<section class="mcard wide gpm-party-congress" aria-label="Party Congress">' +
    '<h3 class="mc-title">Party Congress</h3>' +
    '<div class="gpm-congress-chart" data-gpm-congress-chart>' + renderPartyCongressChart(data, current, ui) + '</div>' +
    '<small>Faction estimates use the party platform, voter support, and known figures.</small>' +
    '<section class="gpm-congress-ballot" aria-label="Delegate count">' +
      '<h4>Delegate count</h4>' +
      '<label class="gpm-congress-size-label">Proposed size <strong data-gpm-congress-proposed>' + proposed + '</strong>' +
        '<span class="gpm-congress-size-range"><span aria-hidden="true">50</span><input class="gpm-congress-size" data-gpm-congress-size type="range" min="50" max="200" step="1" value="' +
        proposed + '"><span aria-hidden="true">200</span></span>' +
      '</label>' +
      '<ul class="gpm-congress-vote-rows" data-gpm-congress-size-rows aria-label="Projected size votes by faction"></ul>' +
      '<div class="gpm-congress-grant" data-gpm-congress-grant hidden>' +
        '<label class="gpm-congress-control">Faction grant <select class="k" data-gpm-congress-bargain></select></label>' +
        '<small data-gpm-congress-grant-detail></small>' +
      '</div>' +
      '<div class="gpm-congress-control">' +
        '<button class="k" type="button" data-gpm-congress-vote>Hold size vote</button>' +
        '<strong data-gpm-congress-forecast aria-live="polite"></strong>' +
      '</div>' +
      '<small data-gpm-congress-result role="status" hidden></small>' +
    '</section>' +
    '<section class="gpm-congress-ballot" aria-label="Campaign priority">' +
      '<h4>Campaign priority</h4>' +
      '<label class="gpm-congress-control">Proposed priority <select class="k" data-gpm-congress-priority>' +
        '<option value="rally">Regional rallies</option><option value="investment">Local investment</option>' +
      '</select></label>' +
      '<small data-gpm-congress-priority-detail></small>' +
      '<ul class="gpm-congress-vote-rows" data-gpm-congress-priority-rows aria-label="Projected priority votes by faction"></ul>' +
      '<div class="gpm-congress-control">' +
        '<button class="k" type="button" data-gpm-congress-priority-vote>Hold priority vote</button>' +
        '<strong data-gpm-congress-priority-forecast aria-live="polite"></strong>' +
      '</div>' +
      '<small data-gpm-congress-priority-result role="status" hidden></small>' +
    '</section></section>';
}

function bindPartyCongress(host, view, party, ui) {
  const panel = host.querySelector('[data-mp-reading="gpm-congress"]');
  if (!panel) return;
  const data = view.party?.congress;
  if (!data || !party) {
    panel.innerHTML = "";
    panel._gpmCongressUi = null;
    return;
  }
  const session = ui._mpSession;
  const country = view.player?.key;
  let state = panel._gpmCongressUi;
  if (!state || state.session !== session || state.partyId !== party.id || state.country !== country ||
      !panel.querySelector("[data-gpm-congress-size]")) {
    state = panel._gpmCongressUi = { session, partyId: party.id, country, data, busy: false };
    if (!panel.querySelector("[data-gpm-congress-size]")) panel.innerHTML = renderPartyCongress(view, party, ui);
  } else if (!state.busy) {
    state.data = data;
  }

  const get = name => panel.querySelector("[data-gpm-congress-" + name + "]");
  const input = get("size");
  const chart = get("chart");
  const bargain = get("bargain");
  const priority = get("priority");
  const sizeButton = get("vote");
  const priorityButton = get("priority-vote");
  const setText = (element, content) => {
    if (element.textContent !== content) element.textContent = content;
  };
  const setHtml = (element, html) => {
    if (element._gpmCongressHtml === html) return false;
    element.innerHTML = html;
    element._gpmCongressHtml = html;
    return true;
  };
  const setResult = (element, vote, feedback) => {
    const text = feedback || partyCongressVoteSummary(vote, ui);
    setText(element, text);
    element.hidden = !text;
  };

  const paint = () => {
    const { data: currentData, busy } = state;
    const current = partyCongressSizeIsValid(currentData.size) ? currentData.size : 100;
    const proposed = partyCongressSizeDraft(view, party, ui, current);
    if (Number(input.value) !== proposed) input.value = String(proposed);
    setText(get("proposed"), String(proposed));

    const baseVote = partyCongressSizeVote(currentData, proposed);
    const offers = baseVote.ok && !baseVote.passed ? baseVote.bargains || [] : [];
    const selected = offers.some(grant => grant.label === bargain.value && grant.affordable) ? bargain.value : "";
    setHtml(bargain, partyCongressGrantOptions({ bargains: offers }));
    if (bargain.value !== selected) bargain.value = selected;
    const sizeVote = selected ? partyCongressSizeVote(currentData, proposed, selected) : baseVote;
    if (currentData.priority) priority.value = currentData.priority.kind;
    const priorityVote = partyCongressPriorityVote(currentData, priority.value);

    get("grant").hidden = !offers.length;
    setText(get("grant-detail"), partyCongressGrantDetail(sizeVote));
    setText(get("forecast"), partyCongressVoteSummary(sizeVote, ui, true));
    setHtml(get("size-rows"), partyCongressVoteRows(sizeVote));
    setText(get("priority-detail"), partyCongressPriorityDetail(currentData, priority.value, ui));
    setText(get("priority-forecast"), partyCongressVoteSummary(priorityVote, ui, true));
    setHtml(get("priority-rows"), partyCongressVoteRows(priorityVote));

    const focused = chart.contains(document.activeElement) ? document.activeElement.getAttribute("data-gpm-faction") : null;
    if (setHtml(chart, renderPartyCongressChart(currentData, current, ui))) {
      ui._wireHemicycle(chart);
      if (focused) {
        [...chart.querySelectorAll("[data-gpm-faction]")]
          .find(item => item.getAttribute("data-gpm-faction") === focused)?.focus({ preventScroll: true });
      }
    }
    setResult(get("result"), currentData.lastVote, state.sizeFeedback);
    setResult(get("priority-result"), currentData.lastPriorityVote, state.priorityFeedback);
    input.disabled = busy;
    bargain.disabled = busy;
    priority.disabled = busy || Boolean(currentData.priority);
    sizeButton.disabled = busy || !sizeVote.ok;
    priorityButton.disabled = busy || !priorityVote.ok;
    return { sizeVote, priorityVote };
  };

  const submit = async (button, kind, vote, fields) => {
    if (state.busy || button.disabled || !vote.ok) return;
    state.busy = true;
    sizeButton.disabled = true;
    priorityButton.disabled = true;
    input.disabled = true;
    bargain.disabled = true;
    priority.disabled = true;
    const feedback = kind + "Feedback";
    state[feedback] = "";
    const response = await ui._mpSubmit(button, "applyPlayerAction", [{ ...fields, expected: partyCongressForecastKey(vote) }]);
    state.busy = false;
    if (!button.isConnected || state.session !== ui._mpSession || panel._gpmCongressUi !== state) return;
    button.parentElement.querySelector(".mp-local-feedback")?.remove();
    if (response?.ok) {
      if (kind === "size") {
        state.data = { ...state.data, lastVote: response, nextSizeVoteDay: response.nextVoteDay,
          size: response.passed ? response.proposed : response.current };
        if (response.passed && response.bargain) state.data.treasuryM -= response.bargain.cash;
        bargain.value = "";
      } else {
        const active = response.passed ? { kind: response.priority, untilDay: response.untilDay } : state.data.priority;
        state.data = { ...state.data, priority: active, lastPriorityVote: response, nextPriorityVoteDay: response.nextVoteDay };
      }
    } else {
      state[feedback] = response ? partyCongressVoteSummary(response, ui, true) : "The vote could not be verified.";
    }
    paint();
    ui.refreshHUD?.(ui._mpSession);
    ui.refreshTab?.(ui._mpSession);
  };

  input.oninput = () => {
    partyCongressSizeDraft(view, party, ui, state.data.size, Number(input.value));
    bargain.value = "";
    state.sizeFeedback = "";
    paint();
  };
  bargain.onchange = () => { state.sizeFeedback = ""; paint(); };
  priority.onchange = () => { state.priorityFeedback = ""; paint(); };
  sizeButton.onclick = () => {
    const vote = paint().sizeVote;
    return submit(sizeButton, "size", vote, { verb: "gpm.party.congressSize", size: vote.proposed, bargain: bargain.value });
  };
  priorityButton.onclick = () => {
    const vote = paint().priorityVote;
    return submit(priorityButton, "priority", vote, { verb: "gpm.party.congressPriority", priority: priority.value });
  };
  paint();
}

module.exports = {
  rendererFunctions: [partyCongressSizeDraft, renderPartyCongressChart, partyCongressPriorityName,
    partyCongressVoteSummary, partyCongressVoteRows, partyCongressGrantOptions, partyCongressGrantDetail,
    partyCongressPriorityDetail, renderPartyCongress, bindPartyCongress],
};

"use strict";

const { rendererFunctions: congressColorFunctions } = require("./party-congress-colors.cjs");

function partyCongressSizeDraft(view, party, ui, current, value, persist = false) {
  const key = "ppo:congress-proposed-delegates:" + JSON.stringify([view.player?.key, party.id]);
  const choices = ui._gpmCongressSizeDrafts ||= new Map();
  if (partyCongressSizeIsValid(value)) {
    choices.set(key, value);
    if (persist) {
      try { localStorage.setItem(key, String(value)); } catch {}
    }
  }
  if (!choices.has(key)) {
    let saved;
    try { saved = Number(localStorage.getItem(key)); } catch {}
    if (partyCongressSizeIsValid(saved)) choices.set(key, saved);
  }
  return choices.get(key) ?? current;
}

function renderPartyCongressChart(factions, total, ui, membershipBacked) {
  if (!factions.length) return '<p class="empty-note">Faction estimate unavailable.</p>';

  const rows = Math.max(3, Math.round(Math.sqrt(total / 2.6)));
  const outerRadius = 162;
  const innerRadius = outerRadius * .52;
  const points = ui._seatLayout(total, rows, innerRadius, outerRadius);
  const dotRadius = Math.max(1.6, Math.min(6.2, (outerRadius - innerRadius) / (rows - 1) * .42));
  const outlineWidth = Math.min(.8, dotRadius * .26);
  const marks = [];
  const legend = [];
  const evidence = [];
  const ideologies = new Map();
  const percent = new Intl.NumberFormat(Es(), { style: "percent", maximumSignificantDigits: 2 });
  let pointIndex = 0;

  for (const group of factions) {
    const label = group.displayLabel;
    const sources = [
      ["Party platform", group.sources.platform],
      ["Voter alignment", group.sources.supporters],
      ["Membership and outreach", group.sources.members],
      ["Known figures", group.sources.people],
      ["Protected prior representation", group.sources.legacy],
    ].filter(([, weight]) => weight > 0).map(([name, weight]) => name + " " + percent.format(weight));
    const scores = Object.entries({ econ: "Economy", social: "Social policy", gov: "Authority", nat: "National orientation" })
      .map(([axis, name]) => name + " " + Math.round(100 * group.axisWeights[axis] / group.weight));
    const count = group.seats + (group.seats === 1 ? " delegate" : " delegates");
    evidence.push({ group, html: `<li data-gpm-congress-evidence-faction="${v(group.label)}" data-delegates="${group.seats}"><strong>${v(label)}</strong> · ${v(count)}
      ${group.description ? "<small>" + v(group.description) + "</small>" : ""}
      <small>${v([...scores, ...sources].join(" · "))}</small>
      ${group.names.length ? "<small>" + v(group.names.join(", ")) + "</small>" : ""}
      </li>` });
    if (!group.seats) continue;
    const umbrella = gpmCongressDoctrine(gpmCongressDoctrine(group.doctrineId)?.chartAs);
    const key = umbrella ? "doctrine:" + umbrella.id : group.label;
    let ideology = ideologies.get(key);
    if (!ideology) {
      ideology = { key, label: umbrella?.label || label, seats: 0, factions: [],
        color: partyCongressIdeologyColor(umbrella ? { doctrineId: umbrella.id } : group) };
      ideologies.set(key, ideology);
    }
    ideology.seats += group.seats;
    ideology.factions.push(group);
  }
  const composition = [...ideologies.values()].sort((left, right) => right.seats - left.seats ||
    left.label.localeCompare(right.label) || left.key.localeCompare(right.key));
  for (const [index, ideology] of composition.entries()) {
    const id = "gpm-ideology-" + index;
    const { key, label, seats, color } = ideology;
    const outline = gpmCongressColorOutlines[color];
    const keyline = outline ? ` style="stroke:${outline};stroke-width:${outlineWidth.toFixed(2)}px" vector-effect="non-scaling-stroke"` : "";
    const ideologyKey = v(key);
    for (const group of ideology.factions) {
      const factionKey = v(group.label);
      for (let seat = 0; seat < group.seats; seat++) {
        const point = points[pointIndex++];
        marks.push(`<circle class="seat" data-pty="${id}" data-gpm-congress-seat-faction="${factionKey}"
          data-gpm-congress-seat-ideology="${ideologyKey}" data-delegates="1"
          cx="${(170 + point.x).toFixed(1)}" cy="${(168 + point.y).toFixed(1)}" r="${dotRadius.toFixed(1)}" fill="${color}"${keyline}/>`);
      }
    }
    const count = seats + (seats === 1 ? " delegate" : " delegates");
    const swatch = "background:" + color + (outline ? ";box-shadow:inset 0 0 0 1px " + outline : "");
    legend.push(`<span class="hc-leg-item" tabindex="0" data-pty="${id}" data-gpm-congress-chart-ideology="${ideologyKey}"
      data-gpm-faction="${ideologyKey}" data-delegates="${seats}" aria-label="${v(label + ", " + count)}"><i style="${swatch}"></i>${v(label)} <b>${seats}</b></span>`);
  }
  evidence.sort((left, right) => right.group.seats - left.group.seats || left.group.displayLabel.localeCompare(right.group.displayLabel));
  const top = composition.filter(ideology => ideology.seats === composition[0].seats);
  const chartLabel = total + (membershipBacked ? " Congress delegates by ideology" : " estimated Congress delegates by ideology");
  const chart = `<svg viewBox="0 0 340 178" class="hc-svg" data-gpm-congress-seat-dots
      role="img" aria-label="${v(chartLabel)}">
      <text x="170" y="161" class="hc-total" text-anchor="middle">${v(new Intl.NumberFormat(Es()).format(total))}</text>
      <text x="170" y="175" class="hc-total-sub" text-anchor="middle">delegates</text>
      ${marks.join("")}
    </svg>`;
  return `${top.length ? `<div class="gpm-congress-leading">
    <small>${top.length === 1 ? "Largest ideology in Congress" : "Largest ideologies in Congress"}</small>
    ${top.map(ideology => `<div data-gpm-congress-largest data-gpm-faction="${v(ideology.key)}" data-delegates="${ideology.seats}">
      <strong>${v(ideology.label)}</strong> <span>${ideology.seats} of ${total} delegates</span>
    </div>`).join("")}
  </div>` : ""}
  <div class="hemicycle">
    ${chart}
    <div class="hc-legend">${legend.join("")}</div>
  </div>
  <details class="gpm-congress-evidence" data-gpm-congress-faction-evidence>
    <summary>Faction positions and evidence</summary>
    <ul>${evidence.map(item => item.html).join("")}</ul>
  </details>`;
}

function partyCongressPriorityName(kind) {
  return kind === "investment" ? "Local investment" : "Regional rallies";
}

function partyCongressVoteSummary(vote, ui, forecast = false, labels) {
  if (!vote) return "";
  if (!vote.ok) {
    const unavailable = {
      unchanged: vote.kind === "charter" ? "This rule is already in force." : "Choose a different size to hold a vote.",
      size: "Enter a whole number from " + gpmCongressSizeMin + " to " + gpmCongressSizeMax + ".",
      pending: "Congress has already approved a new size.",
      party: "This party cannot hold a Congress vote.",
      cooldown: Number.isFinite(vote.nextVoteDay) ? "Next vote available " + ui.gameDate(vote.nextVoteDay) + "." : "This vote is on cooldown.",
      active: "Congress can vote again when the current term expires.",
      budget: "The party treasury cannot cover this grant.",
      bargain: "This faction grant is no longer available.",
      stale: "The forecast changed. Review the updated vote before submitting.",
      "charter-closed": "Current party rules prohibit faction representatives.",
    };
    return unavailable[vote.reason] || "This vote is unavailable.";
  }
  const needed = vote.needed ?? Math.floor(vote.total / 2) + 1;
  const count = String(vote.yes) + " of " + vote.total + " yes · " + needed + " needed";
  if (forecast) return count + " · " + (vote.passed ? "Would pass" : "Would fall short");
  const proposal = vote.kind === "priority" ? partyCongressPriorityName(vote.priority) + " priority" :
    vote.kind === "programme" ? (partyCongressProgrammes()[vote.programme]?.label || "Party programme") :
      vote.kind === "charter" ? vote.label || "Charter proposal" : vote.proposed + " delegates";
  const label = vote.bargain?.label;
  const grant = !vote.passed || !label ? "" : label === "Other factions"
    ? " · Organizing grant paid" : " · Grant paid to " + (labels?.get(label) || label);
  const outcome = vote.passed ? (vote.kind === "size" ? " approved · " : " adopted · ") : " rejected · ";
  return "Last vote · " + proposal + outcome + count + grant;
}

function partyCongressVoteRows(vote, labels, showTally = true) {
  if (!vote?.factions?.length) return "";
  const percent = new Intl.NumberFormat(Es(), { style: "percent", maximumFractionDigits: 2 });
  const resize = vote.kind === "size";
  const proposedRequired = resize ? partyCongressRecognitionSeats(vote.proposed) : null;
  return vote.factions.filter(faction => faction.currentSeats > 0 || faction.proposedSeats > 0)
    .sort((a, b) => b.currentSeats - a.currentSeats || (b.proposedSeats || 0) - (a.proposedSeats || 0)).map(faction => {
    const current = faction.currentSeats;
    const seatCount = resize
      ? current + " → " + faction.proposedSeats + " delegates"
      : current + (current === 1 ? " delegate" : " delegates");
    const currentShare = percent.format(current / vote.current);
    const influence = resize
      ? currentShare + " → " + percent.format(faction.proposedSeats / vote.proposed) + " of Congress"
      : currentShare + " of Congress";
    const no = current - faction.yes;
    const position = !current ? "No current delegates" : faction.yes > no ? "Leans yes" : faction.yes < no ? "Leans no" : "Split";
    const tally = current ? " · " + faction.yes + " yes · " + no + " no" : "";
    const qualifies = resize && faction.proposedSeats >= proposedRequired;
    const proposedStatus = !resize ? "" : qualifies ? "Qualifies for a representative" :
      faction.proposedSeats ? "Below the representative threshold" : "No seats in the proposed Congress";
    const attributes = ' data-current-delegates="' + current + '"' + (resize ?
      ' data-proposed-delegates="' + faction.proposedSeats + '" data-proposed-qualifies="' + qualifies + '"' : "");
    return '<li class="gpm-congress-faction" data-gpm-ballot-faction="' + v(faction.label) + '"' + attributes + '><strong>' +
      v(labels?.get(faction.label) || partyCongressFactionLabel(faction.label)) + '</strong><span class="num">' + v(seatCount) +
      '<small>' + v(influence) + '</small></span>' +
      (showTally ? '<span>' + v(position + tally) + '</span><small>' + v(faction.reason || "") + '</small>' : "") +
      (proposedStatus ? '<small>' + v(proposedStatus) + '</small>' : "") + '</li>';
  }).join("");
}

function partyCongressPendingRows(data, currentGroups, pending, labels) {
  const seatsByFaction = new Map(currentGroups.map(group => [group.label, { label: group.label, currentSeats: group.seats, proposedSeats: 0 }]));
  for (const group of partyCongressFactions(data, pending.size)) {
    const row = seatsByFaction.get(group.label) || { label: group.label, currentSeats: 0 };
    seatsByFaction.set(group.label, { ...row, proposedSeats: group.seats });
  }
  return partyCongressVoteRows({ kind: "size", current: data.size, proposed: pending.size, factions: [...seatsByFaction.values()] }, labels, false);
}

function partyCongressPendingText(pending, ui, labels) {
  if (!pending) return "";
  const approved = new Intl.NumberFormat(Es()).format(pending.size) + " delegates approved";
  if (pending.deferred?.reason === "commitment") {
    const factions = (pending.deferred.factionLabels || []).map(label => labels?.get(label) || partyCongressFactionLabel(label));
    const deadline = Number.isFinite(pending.deferred.untilDay) ? " (next commitment deadline " + ui.gameDate(pending.deferred.untilDay) + ")" : "";
    return approved + " · waiting for " + (factions.length ? "accepted commitments for " + factions.join(", ") : "accepted commitments") +
      " to resolve" + deadline + ".";
  }
  return approved + (Number.isFinite(pending.effectiveDay) ? " · takes effect " + ui.gameDate(pending.effectiveDay) :
    " · takes effect at the next Congress review") + ".";
}

function partyCongressGrantOptions(vote, labels) {
  return '<option value="">No grant</option>' + (vote?.bargains || []).map(grant => {
    const cash = Nr(grant.cash * 1e6 * WR(), ZR());
    return '<option value="' + v(grant.label) + '"' + (grant.affordable ? "" : " disabled") + '>' +
      v((labels?.get(grant.label) || grant.label) + " · +" + grant.extraYes + " yes · " + cash + (grant.affordable ? "" : " · Unaffordable")) + '</option>';
  }).join("");
}

function partyCongressGrantDetail(vote, labels) {
  if (!vote?.bargain) return "Offer one faction a grant to gain votes. You pay only if the motion passes.";
  const { label, extraYes, cash } = vote.bargain;
  return (labels?.get(label) || label) + " adds " + extraYes + " yes " + (extraYes === 1 ? "vote" : "votes") + ". If adopted, the party treasury pays " +
    Nr(cash * 1e6 * WR(), ZR()) + ".";
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

function partyCongressProgrammeDetail(data, programme, ui) {
  const active = data.programme;
  const label = partyCongressProgrammes()[active?.kind || programme]?.label;
  const effect = "Campaign promises and feasible bills that advance this programme move up the party’s recommendations.";
  return active ? label + " has priority until " + ui.gameDate(active.untilDay) + ". " + effect :
    "For 180 days if adopted. " + effect;
}

function partyCongressBargainReason(reason) {
  return {
    party: "This party cannot negotiate in Congress.",
    review: "Faction leaders are selected at a Congress review.",
    "party-leader": "Your party leader cannot negotiate as a faction representative.",
    terms: "Choose an eligible programme and a valid organizing budget.",
    leader: "The faction has no eligible leader, or its leader has changed.",
    "red-line": "This programme crosses the faction’s red line.",
    budget: "The available party budget cannot cover these terms.",
    mandate: "These terms fall outside the staff bargaining mandate.",
    conflict: "This faction already has an open negotiation or commitment.",
    programme: "The programme is unavailable for a vote or the faction cannot add support.",
    market: "The faction asks for a larger organizing budget.",
    aligned: "The programme matches the faction’s priorities.",
    open: "The faction leader is prepared to endorse these terms.",
    deadline: "The deadline passed.",
    "vote-passed": "Congress adopted the promised programme.",
    "vote-failed": "Congress rejected the promised programme.",
    "other-programme": "Congress adopted a different programme.",
    withdrawn: "The offer was withdrawn.",
    accepted: "The leader will endorse the programme at the vote.",
    reserved: "The agreed amount is reserved from the party treasury.",
    stale: "The terms changed. Check the estimate again.",
  }[reason] || "The action is unavailable. Check the current terms.";
}

function partyCongressBargainRecord(record, programmes, ui, forecast = false) {
  const label = programmes.find(option => option.id === record.programme)?.label || "Party programme";
  const status = ({
    offered: "Offer ready for acceptance", countered: "Leader counteroffer", refused: "Refused",
    accepted: "Commitment accepted", delivered: "Delivered", breached: "Breached",
    expired: "Expired", withdrawn: "Withdrawn",
  })[record.status] || "Negotiation";
  const budget = record.cashM > 0 ? " · " + gpmDomesticMoney(record.cashM) + " organizing grant" : "";
  const endorsement = Number.isFinite(record.extraYes) && record.status !== "refused"
    ? " · Estimated +" + record.extraYes + " yes" : "";
  const deadline = Number.isFinite(record.deadlineDay) && ["offered", "countered", "accepted"].includes(record.status)
    ? " · Before " + ui.gameDate(record.deadlineDay) : "";
  const resolved = Number.isFinite(record.closedDay) ? " · " + ui.gameDate(record.closedDay) : "";
  const members = record.membersAdded > 0 ? " · " + new Intl.NumberFormat(Es()).format(record.membersAdded) + " members recruited" : "";
  return "<strong>" + v(forecast ? "Expected response · " + status : status + resolved) + "</strong><p>" +
    v(label + budget + endorsement + deadline + members) + "</p>" +
    (record.reason ? "<small>" + v(partyCongressBargainReason(record.reason)) + "</small>" : "");
}

function partyCongressBargainingHtml(state, ui, view) {
  const { data, selectedId, subject, programme, cashUsd, quote, mandate } = state;
  const organized = data.factions || [];
  const byLabel = new Map(organized.map(faction => [faction.label, faction]));
  const factions = state.groups.filter(group => group.seats > 0).map(group => ({
    ...byLabel.get(group.label), label: group.label, displayLabel: group.displayLabel,
    description: group.description, seats: group.seats,
  }));
  const seated = new Set(factions.map(faction => faction.label));
  for (const faction of organized) {
    if (!seated.has(faction.label) && (data.offers || []).some(offer =>
      offer.factionId === faction.id && ["offered", "countered", "accepted"].includes(offer.status))) {
      factions.push({ ...faction, seats: 0 });
    }
  }
  const programmes = data.programmes || [];
  const option = (value, label, selected) =>
    '<option value="' + v(value) + '"' + (selected === value ? " selected" : "") + '>' + v(label) + '</option>';
  const button = (action, label, attributes = "") =>
    '<button class="k" type="button" data-gpm-bargain-action="' + action + '"' + attributes + '>' + v(label) + '</button>';
  const focus = id => ' data-gpm-profile-focus="faction-' + v(id) + '"';
  const review = Number.isFinite(data.nextReviewDay) ? ui.gameDate(data.nextReviewDay) : "";
  const partyLeader = data.partyLeader?.name ? '<small data-gpm-congress-party-leader>Party leader · ' + v(data.partyLeader.name) + '</small>' : "";
  const currentSize = view?.party?.congress?.size;
  const size = partyCongressSizeIsValid(currentSize) ? currentSize : gpmCongressDefaultSize;
  const required = partyCongressRecognitionSeats(size);
  const recognition = '<small data-gpm-congress-recognition data-minimum-delegates="' + required +
    '" data-congress-delegates="' + size + '">Factions with at least ' + gpmCongressRecognitionPercent +
    '% of delegates (' + required + ' of ' + size + ') qualify for a representative at a Congress review.</small>';
  const intro = review && data.day < data.nextReviewDay
    ? '<small>Next scheduled Congress review ' + v(review) + '.</small>'
    : button("review", "Convene Congress review", focus("review"));
  const programmeNames = ids => (ids || []).map(id => programmes.find(choice => choice.id === id)?.label).filter(Boolean).join(", ");
  const roster = factions.length ? '<ul class="gpm-congress-roster" aria-label="Congress factions">' +
    factions.map(faction => {
      const leader = faction.leader;
      const leaderId = leader?.personId || leader?.id;
      const person = leaderId && view?.people?.get(leaderId);
      const portraitUrl = person && rl(person, view._simYear || 2026);
      const leaderName = leader?.name || "Open leader profile";
      const portrait = portraitUrl
        ? '<span class="gov-face" data-gpm-faction-portrait><img class="char-av" src="' + v(portraitUrl) + '" alt=""></span>'
        : '<span class="gov-face" data-gpm-faction-portrait><span class="gov-initials" aria-hidden="true">' +
          v(K7t(leaderName)) + '</span></span>';
      const leaderAction = leaderId
        ? '<button class="k k-ghost gov-person" type="button"' +
          ' data-gpm-bargain-action="person" data-gpm-faction-person="' + v(leaderId) + '"' + focus(faction.id + "-profile") + '>' +
          portrait + '<span class="gov-person-copy"><b>' + v(leaderName) + '</b></span></button>'
        : '<small>' + (faction.seats >= required ? (faction.id ? "Leadership vacant" : "Representative pending Congress review") :
          "Below the representative threshold") + '</small>';
      const leaderStatus = ({ elected: "Elected leader", appointed: "Appointed leader", acting: "Acting leader" })[leader?.status];
      const priorities = programmeNames(faction.priorities);
      const redLines = programmeNames(faction.redLines);
      const trust = Number.isFinite(faction.trust) ? "Trust " + faction.trust + "/100" : "";
      const { members, delegateChange } = faction.organization || {};
      const organized = members > 0 ? `${members} organized members` : "";
      const representation = delegateChange > 0 ? `+${delegateChange} delegates from organizing and delivery` : "";
      const currentIssues = (faction.issuePriorities || []).filter(issue => issue.onAgenda).map(issue => issue.label);
      const completedIssues = (faction.issuePriorities || []).filter(issue => issue.lastDeliveredDay != null).map(issue => issue.label);
      const select = leaderId && leaderId !== data.partyLeader?.id ? button("select", "Negotiate", ' data-gpm-faction-id="' + v(faction.id) + '" aria-pressed="' +
        (selectedId === faction.id) + '"' + focus(faction.id + "-negotiate")) : "";
      return '<li class="gpm-congress-representative" data-gpm-congress-faction-id="' + v(faction.label) +
        '" data-delegates="' + faction.seats + '">' +
        '<div class="gpm-congress-rep-header"><strong>' + v(faction.displayLabel || faction.label) + '</strong><span class="num">' +
        v(faction.seats + (faction.seats === 1 ? " delegate" : " delegates")) + '</span></div>' +
        '<div class="gpm-congress-rep-controls">' + leaderAction + select + '</div>' +
        '<div class="gpm-congress-rep-details">' +
        (leaderStatus || trust ? '<small>' + v([leaderStatus, trust].filter(Boolean).join(" · ")) + '</small>' : "") +
        (faction.description ? '<small>' + v(faction.description) + '</small>' : "") +
        (organized || representation ? '<small>' + v([organized, representation].filter(Boolean).join(" · ")) + '</small>' : "") +
        (priorities ? '<small>' + v("Priorities · " + priorities) + '</small>' : "") +
        (currentIssues.length ? '<small>' + v("Issues on the agenda · " + currentIssues.join(", ")) + '</small>' : "") +
        (completedIssues.length ? '<small>' + v("Delivered · " + completedIssues.join(", ")) + '</small>' : "") +
        (redLines ? '<small>' + v("Red lines · " + redLines) + '</small>' : "") + '</div></li>';
    }).join("") + '</ul>' : "";
  const faction = selectedId && factions.find(item => item.id === selectedId &&
    (item.leader?.personId || item.leader?.id) !== data.partyLeader?.id);
  let negotiation = "";
  if (faction) {
    const records = (data.offers || []).filter(record => record.factionId === faction.id);
    const open = records.find(record => ["offered", "countered", "accepted"].includes(record.status));
    const leaderId = faction.leader?.personId || faction.leader?.id;
    const body = open ? '<div class="gpm-congress-ballot">' + partyCongressBargainRecord(open, programmes, ui) +
      '<div class="gpm-congress-control">' +
      (open.status === "accepted" ? button("ballot", "Review programme vote", focus("ballot")) :
        button("accept", open.status === "countered" ? "Accept counteroffer" : "Accept terms", focus("accept")) +
        button("withdraw", "Withdraw offer", focus("withdraw"))) + '</div></div>' :
      leaderId && faction.seats > 0 && programmes.length ? '<div class="gpm-congress-control">' +
        '<label>Subject <select class="k" name="subject"' + focus("subject") + '>' +
        option("programme", "Programme pledge", subject) + option("organizing", "Organizing grant", subject) + '</select></label>' +
        '<label>Programme <select class="k" name="programme"' + focus("programme") + '>' +
        programmes.map(choice => option(choice.id, choice.label, programme)).join("") + '</select></label>' +
        (subject === "organizing" ? '<label>Proposed grant (USD) <input class="k" name="cashUsd" type="number" min="0" max="1000000" step="1" value="' +
          v(cashUsd) + '"' + focus("cashUsd") + '></label>' : "") +
        '</div><small>' + (subject === "organizing"
          ? "The party reserves the agreed grant on acceptance and pays it when Congress adopts the programme. A failed pledge releases the reserve."
          : "A pledge commits the party to adopt the programme at a Congress vote. Bills follow the usual legislative procedure.") + '</small>' +
        '<div class="gpm-congress-control">' + button("quote", "Check estimate", focus("quote")) +
        (quote?.ok ? button("offer", "Send offer", focus("offer")) : "") + '</div>' +
        (quote?.ok ? '<div class="gpm-congress-ballot" aria-live="polite">' + partyCongressBargainRecord(quote, programmes, ui, true) + '</div>' : "") : "";
    const previous = records.filter(record => record !== open);
    const history = previous.length ? '<details data-gpm-bargain-history' + (state.showHistory ? " open" : "") +
      '><summary>Commitment history</summary><ul class="gpm-congress-vote-rows">' +
      previous.map(record => '<li class="gpm-congress-ballot">' + partyCongressBargainRecord(record, programmes, ui) + '</li>').join("") +
      '</ul></details>' : "";
    const label = faction.displayLabel || faction.label;
    negotiation = '<section class="gpm-congress-ballot" aria-label="' + v("Negotiate with " + label) + '">' +
      '<h4>' + v(label) + '</h4>' + body + history + '</section>';
  }
  const checked = value => value ? " checked" : "";
  const dollars = value => Math.round((value || 0) * 1e6);
  const permissions = '<details data-gpm-bargain-mandate' + (state.showMandate ? " open" : "") +
    '><summary>Staff bargaining mandate</summary><form class="gpm-congress-ballot" data-gpm-bargain-staff>' +
    '<label><input type="checkbox" name="enabled"' + checked(mandate.enabled) + focus("staff-enabled") + '> Let staff negotiate with faction leaders</label>' +
    '<div class="gpm-congress-control"><label><input type="checkbox" name="subjects" value="programme"' +
      checked(mandate.subjects.includes("programme")) + focus("staff-programme") + '> Programme pledges</label>' +
    '<label><input type="checkbox" name="subjects" value="organizing"' +
      checked(mandate.subjects.includes("organizing")) + focus("staff-organizing") + '> Organizing grants</label></div>' +
    '<div class="gpm-congress-control"><label>Monthly limit (USD) <input class="k" type="number" name="maxCashM" min="0" max="1000000" step="1" value="' +
      dollars(mandate.maxCashM) + '"' + focus("staff-limit") + '></label><label>Minimum treasury reserve (USD) ' +
      '<input class="k" type="number" name="reserveM" min="0" max="1000000000" step="1" value="' + dollars(mandate.reserveM) + '"' +
      focus("staff-reserve") + '></label></div>' +
    '<button class="k" type="submit"' + focus("staff-save") + '>Save mandate</button></form></details>';
  return partyLeader + recognition + intro + roster + negotiation + permissions;
}

function bindPartyCongressBargaining(panel, congress, ui, view) {
  const host = panel.querySelector("[data-gpm-congress-factions]");
  const data = congress.data.bargaining;
  host.hidden = !data;
  if (!data) return;
  const contents = host.querySelector("[data-gpm-bargain-contents]");
  const status = host.querySelector("[data-gpm-bargain-status]");
  const { session, partyId, country } = congress;
  const actor = gpmExpectedActor(country, partyId, session?.playerControl);
  let state = ui._gpmFactionBargaining;
  if (!state || state.session !== session || state.partyId !== partyId || state.country !== country) {
    state = ui._gpmFactionBargaining = { session, partyId, country, subject: "programme", cashUsd: "0" };
  }
  const sameSession = () => ui._gpmFactionBargaining === state && ui._mpSession === session;
  const isCurrent = () => sameSession() && panel.isConnected && panel._gpmCongressUi === congress;
  if (state.source !== data) {
    state.source = data;
    state.data = data;
    const current = data.mandate || {};
    if (!state.mandateDirty) state.mandate = { ...current, subjects: current.subjects || [] };
  }
  state.groups = congress.factions || [];
  if (!state.programme || !state.data.programmes?.some(choice => choice.id === state.programme)) {
    state.programme = state.data.programmes?.[0]?.id || "";
  }
  if (state.busy && contents._gpmBargainState === state) return;

  const paintFeedback = () => {
    const feedback = state.busy ? state.pendingMessage : state.message || "";
    if (status.textContent !== feedback) status.textContent = feedback;
    status.hidden = !feedback;
    for (const control of contents.querySelectorAll("button, input, select")) {
      if (control.disabled !== Boolean(state.busy)) control.disabled = Boolean(state.busy);
    }
  };

  const paint = () => {
    if (!isCurrent()) return;
    const html = partyCongressBargainingHtml(state, ui, view);
    const focus = contents.contains(document.activeElement) && document.activeElement.dataset.gpmProfileFocus;
    if (html !== state.html || contents._gpmBargainState !== state) {
      contents.innerHTML = html;
      state.html = html;
      contents._gpmBargainState = state;
      for (const details of contents.querySelectorAll("details")) {
        details.ontoggle = () => {
          if (!details.isConnected) return;
          if (details.matches("[data-gpm-bargain-mandate]")) state.showMandate = details.open;
          else state.showHistory = details.open;
        };
      }
      if (focus) {
        const target = [...contents.querySelectorAll("[data-gpm-profile-focus]")].find(item => item.dataset.gpmProfileFocus === focus);
        (target || contents.querySelector("[data-gpm-bargain-action=accept]") || status).focus({ preventScroll: true });
      }
    }
    paintFeedback();
  };
  state.paint = paint;

  const fields = () => ({ factionId: state.selectedId, subject: state.subject, programme: state.programme,
    cashM: state.subject === "organizing" ? Number(state.cashUsd) / 1e6 : 0 });

  const operate = async (button, action, input = {}) => {
    state.busy = true;
    state.pendingMessage = action === "quote" ? "Checking the faction’s terms…" : "Submitting to Congress…";
    paintFeedback();
    try {
      const response = action === "quote"
        ? await Xe(session, "gpm.partyFactionQuote", input)
        : await ui._mpSubmit(button, "applyPlayerAction", [{ ...actor, verb: "gpm.party.factionBargain", partyId: congress.partyId, action, ...input }]);
      if (!sameSession()) return;
      if (action === "quote") {
        state.quote = response;
        state.message = response?.ok ? "" : partyCongressBargainReason(response?.reason);
        return;
      }
      button.parentElement?.querySelector(".mp-local-feedback")?.remove();
      if (!response?.ok) {
        state.message = partyCongressBargainReason(response?.reason);
        if (response?.reason === "stale") state.quote = null;
        return;
      }
      if (action === "mandate") state.mandateDirty = false;
      if (action === "offer") {
        state.quote = null;
        state.requestId = null;
      }
      if (response.offer) {
        state.data = { ...state.data, offers: [response.offer,
          ...(state.data.offers || []).filter(record => record.id !== response.offer.id)] };
      }
      const refused = action === "offer" && response.offer?.status === "refused";
      if (refused) state.showHistory = true;
      state.message = refused ? "The leader refused. " + partyCongressBargainReason(response.offer.reason) :
        ({ mandate: "Staff bargaining mandate saved.", review: "Congress factions reviewed.",
          offer: "The leader answered the offer.", accept: "Commitment recorded.", withdraw: "Offer withdrawn." })[action] || "";
    } catch (error) {
      if (sameSession()) state.message = "Congress could not verify this request. Check the current terms and try again.";
      console.warn("[PPO] Faction bargaining request failed", error);
    } finally {
      state.busy = false;
      if (sameSession()) {
        state.paint();
        if (action !== "quote") {
          ui.refreshHUD?.(session);
          ui.refreshTab?.(session);
        }
      }
    }
  };

  contents.onclick = event => {
    const button = event.target.closest("[data-gpm-bargain-action]");
    if (!button || state.busy || !isCurrent()) return;
    const action = button.dataset.gpmBargainAction;
    if (action === "person") return ui.openFiche?.(button.dataset.gpmFactionPerson, session);
    if (action === "select") {
      if (state.selectedId === button.dataset.gpmFactionId) return;
      state.selectedId = button.dataset.gpmFactionId;
      state.quote = null;
      state.requestId = null;
      state.showHistory = false;
      state.message = "";
      return paint();
    }
    if (action === "review") return operate(button, action);
    const factionOffers = state.data.offers?.filter(record => record.factionId === state.selectedId) || [];
    if (action === "ballot") {
      const record = factionOffers.find(offer => offer.status === "accepted");
      const chooser = panel.querySelector("[data-gpm-congress-programme]");
      if (!record || !chooser) return;
      if (!chooser.disabled) {
        chooser.value = record.programme;
        chooser.dispatchEvent(new Event("change", { bubbles: true }));
      }
      chooser.closest("section")?.scrollIntoView({ block: "start" });
      chooser.focus({ preventScroll: true });
      return;
    }
    if (action === "quote" || action === "offer") {
      const amount = contents.querySelector('input[name="cashUsd"]');
      if (amount && (!amount.value || !amount.reportValidity())) return;
      if (action === "quote") return operate(button, action, fields());
      if (!state.quote?.ok) return;
      state.requestId ||= crypto.randomUUID();
      return operate(button, action, { ...fields(), expected: state.quote.expected, requestId: state.requestId });
    }
    const record = factionOffers.find(offer => ["offered", "countered"].includes(offer.status));
    if (record) return operate(button, action, { offerId: record.id });
  };
  contents.oninput = event => {
    const field = event.target;
    const form = field.closest("[data-gpm-bargain-staff]");
    if (form) {
      const values = new FormData(form);
      state.mandate = { enabled: values.has("enabled"), subjects: values.getAll("subjects"),
        maxCashM: Number(values.get("maxCashM")) / 1e6, reserveM: Number(values.get("reserveM")) / 1e6 };
      state.mandateDirty = true;
    } else if (["subject", "programme", "cashUsd"].includes(field.name)) {
      const repaint = field.name !== "cashUsd" || state.quote?.ok;
      state[field.name] = field.value;
      state.quote = null;
      state.requestId = null;
      state.message = "";
      if (repaint) paint();
      else status.hidden = true;
    }
  };
  contents.onchange = contents.oninput;
  contents.onsubmit = event => {
    if (!event.target.matches("[data-gpm-bargain-staff]")) return;
    event.preventDefault();
    if (!state.busy && isCurrent()) return operate(event.submitter || event.target.querySelector('button[type="submit"]'),
      "mandate", { mandate: state.mandate });
  };
  paint();
}

function partyCongressIdentityHtml(identity, profiles) {
  const { declared, foundingPreset, historicalTradition, positions } = identity || {};
  const sourceLabel = source => ({
    player: "Player declared",
    "founding-choice": "Chosen at party founding",
    "founding-platform": "Founding platform",
    authored: "Authored for the scenario",
    historical: "Historical record",
    preset: "Founding preset",
  })[source] || (source ? String(source).replace(/[-_]+/g, " ") : "");
  const reading = (title, value, detail = "") => `<div class="gpm-domestic-summary">
    <h4>${v(title)}</h4><p>${v(value || "Unknown")}</p>${detail ? `<small>${v(detail)}</small>` : ""}</div>`;
  const declaredLabel = declared?.ideologyLabel || declared?.label;
  const foundingLabel = foundingPreset?.ideologyLabel || foundingPreset?.label;
  const platform = profiles?.find(profile => profile.origin === "platform")?.ideology;
  const estimate = estimatePartyIdeology(platform);
  const ideology = declaredLabel || foundingLabel || (estimate && partyCongressFactionLabel(estimate));
  const provenance = declaredLabel ? sourceLabel(declared.source) : foundingLabel ? "Founding preset" :
    estimate ? "Estimated from the current party platform" : "";
  const header = ideology ? `<div class="gpm-congress-leading" data-gpm-congress-party-ideology>
    <small>Party ideology</small><div><strong>${v(ideology)}</strong>${provenance ? `<small>${v(provenance)}</small>` : ""}</div>
  </div>` : "";
  const tradition = declared?.label && declared.label !== ideology ? reading("Declared tradition", declared.label) : "";
  const founding = foundingPreset?.label && foundingPreset.label !== ideology && foundingPreset.label !== declared?.label
    ? reading("Founding preset", foundingPreset.label) : "";
  const historical = historicalTradition && historicalTradition !== ideology && historicalTradition !== declared?.label
    ? reading("Historical tradition", historicalTradition) : "";
  const issues = Object.values(positions || {}).filter(position => position?.label && position?.value);
  if (!tradition && !founding && !historical && !issues.length) return header;
  return `${header}<details class="gpm-congress-evidence" aria-label="Ideology and platform">
    <summary>Party platform</summary>
    ${tradition || founding || historical ? `<div class="gpm-domestic-grid">${tradition}${founding}${historical}</div>` : ""}
    ${issues.length ? `<details><summary>Recorded issue positions</summary><ul class="gpm-congress-vote-rows">
      ${issues.map(issue => `<li class="gpm-congress-faction"><strong>${v(issue.label)}</strong>
        <span>${v(issue.value)}</span><small>${v([
          issue.priority ? "Priority " + issue.priority : "", sourceLabel(issue.source),
        ].filter(Boolean).join(" · "))}</small></li>`).join("")}
      </ul></details>` : ""}
  </details>`;
}

function partyCongressRolePolicyHtml(data) {
  if (!data?.roles?.length) return '<p class="empty-note">Role eligibility is unavailable.</p>';
  const roleNames = {
    membership: "Party membership", delegate: "Congress delegates", factionLeadership: "Faction leadership",
    partyCouncil: "Party councils", candidacy: "Candidacy", legislativeSeat: "Legislative seats",
    cabinetAppointment: "Cabinet appointments", executiveOffice: "Executive office", clericalOffice: "Clerical office",
  };
  const readable = value => value ? String(value).replace(/[-_]+/g, " ").replace(/^\w/, first => first.toUpperCase()) : "";
  const source = (value, label) => {
    if (!value) return "";
    try {
      const url = new URL(value);
      if (url.protocol === "https:") return `<a href="${v(url.href)}" target="_blank" rel="noopener noreferrer">${v(label)}</a>`;
    } catch {}
    return `<small>${v(readable(value))}</small>`;
  };
  const evidenceItem = rule => {
    const kind = ({ partyCharter: "Party charter", formalLaw: "Formal law", observedRoster: "Recorded practice" })[rule.kind] ||
      readable(rule.kind);
    const scope = [readable(rule.positionId), readable(rule.slotKind), kind].filter(Boolean).join(" · ");
    const date = [
      rule.effectiveFrom && "From " + rule.effectiveFrom,
      rule.effectiveUntil && "Ends " + rule.effectiveUntil,
      rule.appliesOnDate === false && "Outside documented dates",
    ].filter(Boolean).join(" · ");
    return `<li><p><strong>${v(scope || "Scoped rule")}</strong></p>
      <p>${v(rule.description || rule.provision || "")}</p>
      ${rule.exception ? `<small>${v("Exception · " + readable(rule.exception))}</small>` : ""}
      <small>${v([rule.description && rule.provision, date, rule.confidence && readable(rule.confidence) + " confidence",
        readable(rule.authorityId)].filter(Boolean).join(" · "))}</small>
      <div class="gpm-congress-control">${source(rule.source, "Primary source")}${source(rule.corroboration, "Corroborating source")}</div>
    </li>`;
  };
  const roleList = (items, heading) => items.length ? `<section class="gpm-congress-ballot">
    <h4>${v(heading)}</h4>${items.map(({ role, evidence }) => `<div>
      <strong>${v(roleNames[role] || role)}</strong><ul>${evidence.map(evidenceItem).join("")}</ul></div>`).join("")}
  </section>` : "";
  const documented = data.roles.filter(row => row.evidence?.length);
  const ordinary = data.roles.filter(row => row.confidence === "ordinary_eligibility").map(row => roleNames[row.role] || row.role);
  const rosters = new Map();
  for (const row of data.historicalObservations || []) {
    if (!rosters.has(row.role)) rosters.set(row.role, []);
    rosters.get(row.role).push(row);
  }
  return `
    ${data.date ? `<small>Scenario date ${v(data.date)}</small>` : ""}
    ${roleList(documented, "Applicable rules")}
    ${ordinary.length ? `<p>Ordinary game eligibility applies where a documented rule is unavailable.</p>
      <small>${v(ordinary.join(" · "))}</small>` : ""}
    ${roleList([...rosters].map(([role, evidence]) => ({ role, evidence })), "Documented rosters")}
  `;
}

function partyCongressCurrentReason(reason, date) {
  return ({
    party: "This party cannot organize an ideological current.",
    incompatible: "This current is outside the party’s political tradition.",
    membership: "Organizing a current requires at least 20 active party members.",
    branches: "Establish more regional branches to organize this current.",
    budget: "The party treasury cannot cover this action.",
    organizers: "The party needs more available activists.",
    capacity: "The party has reached its current recruitment capacity.",
    cooldown: date ? "Available again " + date + "." : "This current is on an organizing cooldown.",
    stale: "Organizing conditions changed. Review the updated costs and eligibility.",
  })[reason] || "Organizing is unavailable for this current.";
}

function partyCongressCurrentHtml(currents, ui) {
  const numbers = new Intl.NumberFormat(Es());
  return currents.map(current => {
    const { cashM, activistsK } = current.cost || {};
    const costs = [Number.isFinite(cashM) ? Nr(cashM * 1e6 * WR(), ZR()) : "",
      Number.isFinite(activistsK) ? numbers.format(Math.round(activistsK * 1000)) + " activists" : ""].filter(Boolean);
    const members = Number.isFinite(current.members) ? numbers.format(current.members) +
      (current.members === 1 ? " affiliated member" : " affiliated members") : "";
    const branches = !current.isPlatform && Number.isFinite(current.regions) && Number.isFinite(current.requiredRegions)
      ? numbers.format(current.regions) + (current.regions === 1 ? " established branch" : " established branches") +
        " · " + numbers.format(current.requiredRegions) + " required" : "";
    const date = Number.isFinite(current.nextDay) ? ui.gameDate(current.nextDay) : "";
    const enabled = current.eligible && current.expected != null;
    return `<li class="gpm-congress-faction" data-gpm-congress-current="${v(current.id)}">
      <strong>${v(current.label)}</strong>
      ${current.description ? `<small>${v(current.description)}</small>` : ""}
      ${members ? `<small>${v(members)}</small>` : ""}
      ${branches ? `<small>${v(branches)}</small>` : ""}
      ${current.isPlatform ? "<small>Founding current</small>" : `
        ${costs.length ? `<small>${v("Cost · " + costs.join(" · "))}</small>` : ""}
        ${current.eligible ? "" : `<small>${v(partyCongressCurrentReason(current.reason, date))}</small>`}
        <span class="gpm-congress-control"><button class="k" type="button" data-gpm-current-organize="${v(current.id)}"
          aria-label="${v("Organize current " + current.label)}"${enabled ? " data-gpm-action-ready" : " disabled"}>Organize current</button></span>`}
    </li>`;
  }).join("");
}

function partyCongressCharterHtml(motions, labels, ui) {
  return motions.map(motion => {
    const current = motion.choices.find(choice => choice.value === motion.current);
    const closed = motion.choices.some(choice => choice.forecast?.reason === "charter-closed");
    const lastVote = motion.lastVote && { ...motion.lastVote, kind: "charter", label:
      motion.choices.find(choice => choice.value === motion.lastVote.value)?.label || motion.lastVote.label };
    return `<section class="gpm-congress-ballot" data-gpm-congress-charter-motion="${v(motion.id)}">
      <h4>${v(motion.label)}</h4>
      ${motion.description ? `<small>${v(motion.description)}</small>` : ""}
      ${current ? `<small>${v("Current rule · " + current.label)}</small>` : ""}
      ${closed ? "<small>Current party rules prohibit faction representatives.</small>" : ""}
      ${motion.choices.filter(choice => choice.value !== motion.current && choice.forecast?.reason !== "charter-closed").map(choice => {
        const forecast = choice.forecast && { ...choice.forecast, kind: "charter" };
        const rows = partyCongressVoteRows(forecast, labels);
        const enabled = forecast?.ok && forecast.expected != null;
        return `<div class="gpm-congress-ballot">
          <strong>${v("Proposed rule · " + choice.label)}</strong>
          <small>${v(partyCongressVoteSummary(forecast, ui, true) || "Forecast unavailable.")}</small>
          ${rows ? `<details data-gpm-charter-faction-preview="${v(motion.id)}:${v(choice.value)}">
            <summary>Faction forecast</summary><ul class="gpm-congress-vote-rows">${rows}</ul></details>` : ""}
          <button class="k" type="button" data-gpm-charter-submit="${v(motion.id)}" data-gpm-charter-value="${v(choice.value)}"
            aria-label="${v("Hold charter vote for " + choice.label)}"${enabled ? " data-gpm-action-ready" : " disabled"}>Hold charter vote</button>
        </div>`;
      }).join("")}
      ${lastVote ? `<small>${v(partyCongressVoteSummary(lastVote, ui, false, labels))}</small>` : ""}
    </section>`;
  }).join("");
}

function bindPartyCongressRolePolicy(panel, congress, ui) {
  const details = panel.querySelector("[data-gpm-congress-role-policy]");
  const contents = details.querySelector("[data-gpm-role-policy-contents]");
  const rolePolicy = congress.rolePolicy ||= {};
  const update = async () => {
    const day = congress.data.day;
    if (!details.open || rolePolicy.loadedDay === day) return;
    rolePolicy.loadedDay = day;
    const token = rolePolicy.token = {};
    contents.textContent = "Loading role eligibility…";
    const current = () => contents.isConnected && ui._mpSession === congress.session &&
      panel._gpmCongressUi === congress && rolePolicy.token === token;
    try {
      const policy = await Xe(congress.session, "gpm.partyRolePolicy", {});
      if (current()) contents.innerHTML = partyCongressRolePolicyHtml(policy);
    } catch {
      if (current()) contents.textContent = "Could not load role eligibility. Reopen to try again.";
    }
  };
  details.ontoggle = () => {
    if (details.open) update();
    else {
      rolePolicy.loadedDay = null;
      rolePolicy.token = null;
    }
  };
  update();
}

function renderPartyCongress(view, party, ui) {
  const data = view.party?.congress;
  if (!data || !party) return "";
  const current = partyCongressSizeIsValid(data.size) ? data.size : gpmCongressDefaultSize;
  const proposed = data.pendingResize?.size ?? partyCongressSizeDraft(view, party, ui, current);
  const numbers = new Intl.NumberFormat(Es());
  const quickPicks = [100, 200, 300, 500, 750, 1000].map(size =>
    '<button class="k" type="button" data-gpm-congress-size-pick="' + size + '">' + v(numbers.format(size)) + '</button>'
  ).join("");
  return '<section class="mcard wide gpm-party-congress" aria-label="Party Congress">' +
    '<h3 class="mc-title">Party Congress</h3>' +
    '<div data-gpm-congress-identity hidden></div>' +
    '<div class="gpm-congress-chart" data-gpm-congress-chart></div>' +
    '<section class="gpm-congress-ballot" data-gpm-congress-factions aria-label="Factions" hidden>' +
      '<h4>Factions</h4><p data-gpm-bargain-status role="status" tabindex="-1" hidden></p>' +
      '<div class="gpm-congress-ballot" data-gpm-bargain-contents></div></section>' +
    '<section class="gpm-congress-ballot" data-gpm-congress-currents aria-label="Organize ideological currents" hidden>' +
      '<h4>Organize ideological currents</h4><small data-gpm-congress-current-resources hidden></small>' +
      '<ul class="gpm-congress-vote-rows" data-gpm-congress-current-rows></ul>' +
      '<small data-gpm-congress-current-feedback role="status" hidden></small></section>' +
    '<details class="gpm-congress-evidence" data-gpm-congress-charter hidden>' +
      '<summary>Party charter</summary><div data-gpm-congress-charter-motions></div>' +
      '<small data-gpm-congress-charter-feedback role="status" hidden></small></details>' +
    '<details data-gpm-congress-role-policy><summary>Role eligibility and evidence</summary>' +
      '<div class="gpm-congress-ballot" data-gpm-role-policy-contents></div></details>' +
    '<section class="gpm-congress-ballot" aria-label="Delegate count">' +
      '<h4>Delegate count</h4>' +
      '<div class="gpm-congress-size-summary"><span>Current delegates <strong data-gpm-congress-current-size>' + v(numbers.format(current)) + '</strong></span>' +
        '<label class="gpm-congress-control">Proposed size <input class="k gpm-congress-size" data-gpm-congress-size data-gpm-congress-proposed' +
        ' type="number" inputmode="numeric" required min="' + gpmCongressSizeMin + '" max="' + gpmCongressSizeMax +
        '" step="1" value="' + proposed + '"></label></div>' +
      '<div class="gpm-congress-size-picks" role="group" aria-label="Quick picks for Congress size">' + quickPicks + '</div>' +
      '<small data-gpm-congress-size-recommendation hidden></small>' +
      '<strong data-gpm-congress-pending role="status" hidden></strong>' +
      '<small data-gpm-congress-resize-review hidden></small>' +
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
    '</section>' +
    '<section class="gpm-congress-ballot" aria-label="Party programme">' +
      '<h4>Party programme</h4>' +
      '<label class="gpm-congress-control">Proposed programme <select class="k" data-gpm-congress-programme>' +
      '</select></label>' +
      '<small data-gpm-congress-programme-detail></small>' +
      '<ul class="gpm-congress-vote-rows" data-gpm-congress-programme-rows aria-label="Projected programme votes by faction"></ul>' +
      '<div class="gpm-congress-control">' +
        '<button class="k" type="button" data-gpm-congress-programme-vote>Hold programme vote</button>' +
        '<strong data-gpm-congress-programme-forecast aria-live="polite"></strong>' +
      '</div>' +
      '<small data-gpm-congress-programme-result role="status" hidden></small>' +
    '</section></section>';
}

function bindPartyCongress(panel, view, party, ui) {
  const data = view.party?.congress;
  if (!data || !party) {
    panel.innerHTML = "";
    panel._gpmCongressUi = null;
    return;
  }
  const session = ui._mpSession;
  const country = view.player?.key;
  const actor = gpmExpectedActor(country, party.id, session?.playerControl);
  let state = panel._gpmCongressUi;
  let input = panel.querySelector("[data-gpm-congress-size]");
  if (!state || state.session !== session || state.partyId !== party.id || state.country !== country ||
      !input) {
    state = panel._gpmCongressUi = { session, partyId: party.id, country, data, busy: false };
    if (!input) panel.innerHTML = renderPartyCongress(view, party, ui);
    else {
      const current = partyCongressSizeIsValid(data.size) ? data.size : gpmCongressDefaultSize;
      input.value = String(data.pendingResize?.size ?? partyCongressSizeDraft(view, party, ui, current));
    }
  } else if (!state.busy) {
    if (state.data !== data) {
      state.awaitingSizeRefresh = false;
      state.awaitingGovernanceRefresh = false;
    }
    state.data = data;
  }

  const get = name => panel.querySelector("[data-gpm-congress-" + name + "]");
  input = get("size");
  const quickPicks = [...panel.querySelectorAll("[data-gpm-congress-size-pick]")];
  const chart = get("chart");
  const bargain = get("bargain");
  const priority = get("priority");
  const programme = get("programme");
  const sizeButton = get("vote");
  const priorityButton = get("priority-vote");
  const programmeButton = get("programme-vote");
  const currents = get("currents");
  const charter = get("charter");
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
    const text = feedback || partyCongressVoteSummary(vote, ui, false, state.factionLabels);
    setText(element, text);
    element.hidden = !text;
  };

  const paintSize = () => {
    const { data: currentData } = state;
    const current = partyCongressSizeIsValid(currentData.size) ? currentData.size : gpmCongressDefaultSize;
    const pending = currentData.pendingResize;
    if (pending && input.valueAsNumber !== pending.size) input.value = String(pending.size);
    const proposed = input.valueAsNumber;
    const voteKey = JSON.stringify([proposed, bargain.value, state.sizeFeedback, state.ballotKey, WR(), ZR()]);
    if (voteKey === state.sizeVoteKey) return state.sizeVote;
    const numbers = new Intl.NumberFormat(Es());
    setText(get("current-size"), numbers.format(current));
    input.setAttribute("aria-invalid", String(!partyCongressSizeIsValid(proposed)));
    for (const button of quickPicks) button.setAttribute("aria-pressed", String(Number(button.dataset.gpmCongressSizePick) === proposed));
    const recommendation = get("size-recommendation");
    const suggested = currentData.sizeRecommendation;
    recommendation.hidden = !suggested;
    if (suggested) {
      const range = suggested.min === suggested.max ? "" : " (" + numbers.format(suggested.min) + "–" + numbers.format(suggested.max) + ")";
      setText(recommendation, "Suggested size " + numbers.format(suggested.size) + " delegates · " + suggested.label + range);
    }
    const pendingStatus = get("pending");
    pendingStatus.hidden = !pending;
    setText(pendingStatus, partyCongressPendingText(pending, ui, state.factionLabels));
    pendingStatus.toggleAttribute("data-resize-deferred", Boolean(pending?.deferred));
    for (const [attribute, value] of [["data-pending-size", pending?.size], ["data-effective-day", pending?.effectiveDay],
      ["data-deferred-until-day", pending?.deferred?.untilDay]]) {
      if (Number.isFinite(value)) pendingStatus.setAttribute(attribute, String(value));
      else pendingStatus.removeAttribute(attribute);
    }
    const baseVote = partyCongressSizeVote(currentData, proposed);
    const offers = baseVote.ok && !baseVote.passed ? baseVote.bargains || [] : [];
    const selected = offers.some(grant => grant.label === bargain.value && grant.affordable) ? bargain.value : "";
    setHtml(bargain, partyCongressGrantOptions({ bargains: offers }, state.factionLabels));
    if (bargain.value !== selected) bargain.value = selected;
    const sizeVote = selected ? partyCongressSizeVote(currentData, proposed, selected) : baseVote;
    get("grant").hidden = !offers.length;
    setText(get("grant-detail"), partyCongressGrantDetail(sizeVote, state.factionLabels));
    setText(get("forecast"), pending ? "" : partyCongressVoteSummary(sizeVote, ui, true));
    const review = get("resize-review");
    review.hidden = !sizeVote.ok || !Number.isFinite(sizeVote.effectiveDay);
    setText(review, review.hidden ? "" : "If approved, takes effect " + ui.gameDate(sizeVote.effectiveDay) + ".");
    setHtml(get("size-rows"), pending ? partyCongressPendingRows(currentData, state.factions || [], pending, state.factionLabels) :
      partyCongressVoteRows(sizeVote, state.factionLabels));
    setResult(get("result"), currentData.lastVote, state.sizeFeedback);
    state.sizeVoteKey = JSON.stringify([proposed, selected, state.sizeFeedback, state.ballotKey, WR(), ZR()]);
    return state.sizeVote = sizeVote;
  };

  const paintPriority = () => {
    const { data: currentData } = state;
    if (currentData.priority) priority.value = currentData.priority.kind;
    const voteKey = JSON.stringify([priority.value, state.priorityFeedback, state.ballotKey]);
    if (voteKey === state.priorityVoteKey) return state.priorityVote;
    const priorityVote = partyCongressPriorityVote(currentData, priority.value);
    setText(get("priority-detail"), partyCongressPriorityDetail(currentData, priority.value, ui));
    setText(get("priority-forecast"), partyCongressVoteSummary(priorityVote, ui, true));
    setHtml(get("priority-rows"), partyCongressVoteRows(priorityVote, state.factionLabels));
    setResult(get("priority-result"), currentData.lastPriorityVote, state.priorityFeedback);
    state.priorityVoteKey = voteKey;
    return state.priorityVote = priorityVote;
  };

  const paintProgramme = () => {
    const { data: currentData } = state;
    const selected = currentData.programme?.kind || programme.value;
    if (setHtml(programme, Object.entries(partyCongressAvailableProgrammes(currentData)).map(([kind, choice]) =>
      '<option value="' + v(kind) + '">' + v(choice.label) + '</option>').join("")) &&
      [...programme.options].some(option => option.value === selected)) programme.value = selected;
    if (currentData.programme) programme.value = currentData.programme.kind;
    const voteKey = JSON.stringify([programme.value, state.programmeFeedback, state.ballotKey]);
    if (voteKey === state.programmeVoteKey) return state.programmeVote;
    const programmeVote = partyCongressProgrammeVote(currentData, programme.value);
    setText(get("programme-detail"), partyCongressProgrammeDetail(currentData, programme.value, ui));
    setText(get("programme-forecast"), partyCongressVoteSummary(programmeVote, ui, true));
    setHtml(get("programme-rows"), partyCongressVoteRows(programmeVote, state.factionLabels));
    setResult(get("programme-result"), currentData.lastProgrammeVote, state.programmeFeedback);
    state.programmeVoteKey = voteKey;
    return state.programmeVote = programmeVote;
  };

  const paintChart = () => {
    const { data: currentData } = state;
    const current = partyCongressSizeIsValid(currentData.size) ? currentData.size : gpmCongressDefaultSize;
    const chartKey = JSON.stringify([current, currentData.profiles, currentData.figures, currentData.identity, currentData.membershipBacked,
      currentData.factionDelegateFactors, currentData.factionLegacyAssignments, currentData.factionLegacyProtectedLabels, Es()]);
    if (chartKey === state.chartKey) return;
    state.chartKey = chartKey;
    const focused = chart.contains(document.activeElement) ? document.activeElement.getAttribute("data-gpm-congress-chart-ideology") : null;
    const factions = partyCongressFactions(currentData, current);
    state.factions = factions;
    state.factionLabels = new Map(factions.map(group => [group.label, group.displayLabel || group.label]));
    const evidenceOpen = chart.querySelector("[data-gpm-congress-faction-evidence]")?.open;
    if (setHtml(chart, renderPartyCongressChart(factions, current, ui, currentData.membershipBacked))) {
      if (evidenceOpen) chart.querySelector("[data-gpm-congress-faction-evidence]")?.setAttribute("open", "");
      ui._wireHemicycle(chart);
      if (focused) {
        [...chart.querySelectorAll("[data-gpm-congress-chart-ideology]")]
          .find(item => item.getAttribute("data-gpm-congress-chart-ideology") === focused)?.focus({ preventScroll: true });
      }
    }
  };

  const paintControls = () => {
    const { data: currentData, busy } = state;
    const governanceLocked = busy || Boolean(state.awaitingGovernanceRefresh);
    const resizeLocked = governanceLocked || Boolean(currentData.pendingResize) || Boolean(state.awaitingSizeRefresh);
    input.disabled = resizeLocked;
    bargain.disabled = resizeLocked;
    for (const button of quickPicks) button.disabled = resizeLocked;
    priority.disabled = governanceLocked || Boolean(currentData.priority);
    programme.disabled = governanceLocked || Boolean(currentData.programme);
    sizeButton.disabled = resizeLocked || !state.sizeVote?.ok;
    priorityButton.disabled = governanceLocked || !state.priorityVote?.ok;
    programmeButton.disabled = governanceLocked || !state.programmeVote?.ok;
    for (const button of panel.querySelectorAll("[data-gpm-current-organize], [data-gpm-charter-submit]")) {
      button.disabled = governanceLocked || !button.hasAttribute("data-gpm-action-ready");
    }
  };

  const paintCurrentsAndCharter = () => {
    const currentRows = state.data.currents || [];
    const motions = state.data.charter?.motions || [];
    currents.hidden = !currentRows.some(current => !current.isPlatform);
    charter.hidden = !motions.length;
    const resources = get("current-resources");
    const available = view.party?.organizing?.activistsK;
    resources.hidden = !Number.isFinite(available);
    const organizers = resources.hidden ? 0 : Math.round(available * 1000);
    setText(resources, resources.hidden ? "" : new Intl.NumberFormat(Es()).format(organizers) +
      (organizers === 1 ? " activist available" : " activists available"));
    setHtml(get("current-rows"), currents.hidden ? "" : partyCongressCurrentHtml(currentRows, ui));
    const motionHost = get("charter-motions");
    const open = new Set([...motionHost.querySelectorAll("[data-gpm-charter-faction-preview][open]")]
      .map(details => details.dataset.gpmCharterFactionPreview));
    if (setHtml(motionHost, partyCongressCharterHtml(motions, state.factionLabels, ui))) {
      for (const details of motionHost.querySelectorAll("[data-gpm-charter-faction-preview]")) {
        if (open.has(details.dataset.gpmCharterFactionPreview)) details.open = true;
      }
    }
    setResult(get("current-feedback"), null, state.currentFeedback);
    setResult(get("charter-feedback"), null, state.charterFeedback);
  };

  const paint = () => {
    if (panel.hidden) return;
    const { bargaining, identity, ...ballots } = state.data;
    state.ballotKey = JSON.stringify([ballots, identity?.declared, Es()]);
    const identityHost = get("identity");
    const identityHtml = partyCongressIdentityHtml(identity, state.data.profiles);
    identityHost.hidden = !identityHtml;
    setHtml(identityHost, identityHtml);
    paintChart();
    paintSize();
    paintPriority();
    paintProgramme();
    paintCurrentsAndCharter();
    paintControls();
    bindPartyCongressBargaining(panel, state, ui, view);
    bindPartyCongressRolePolicy(panel, state, ui);
  };

  const submit = async (button, kind, vote, fields) => {
    if (state.busy || button.disabled || !vote.ok) return;
    state.busy = true;
    paintControls();
    const feedback = kind + "Feedback";
    state[feedback] = "";
    let response;
    try {
      response = await ui._mpSubmit(button, "applyPlayerAction", [{ ...actor, ...fields, expected: partyCongressForecastKey(vote) }]);
    } catch (error) {
      console.warn("[PPO] Could not submit Congress vote", error);
    } finally {
      state.busy = false;
    }
    if (!button.isConnected || state.session !== ui._mpSession || panel._gpmCongressUi !== state) return;
    button.parentElement.querySelector(".mp-local-feedback")?.remove();
    if (response?.ok) {
      if (kind === "size") {
        const pendingResize = response.pendingResize ?? state.data.pendingResize;
        const bargaining = pendingResize && state.data.bargaining ?
          { ...state.data.bargaining, nextReviewDay: pendingResize.effectiveDay } : state.data.bargaining;
        state.data = { ...state.data, lastVote: response, nextSizeVoteDay: response.nextVoteDay,
          pendingResize, bargaining };
        bargain.value = "";
      } else if (kind === "priority") {
        const active = response.passed ? { kind: response.priority, untilDay: response.untilDay } : state.data.priority;
        state.data = { ...state.data, priority: active, lastPriorityVote: response, nextPriorityVoteDay: response.nextVoteDay };
      } else {
        const active = response.passed ? { kind: response.programme, untilDay: response.untilDay } : state.data.programme;
        state.data = { ...state.data, programme: active, lastProgrammeVote: response, nextProgrammeVoteDay: response.nextVoteDay };
      }
    } else {
      state[feedback] = response ? partyCongressVoteSummary(response, ui, true) : "The vote could not be verified.";
      if (kind === "size" && response?.reason === "stale") state.awaitingSizeRefresh = true;
    }
    paint();
    ui.refreshHUD?.(ui._mpSession);
    ui.refreshTab?.(ui._mpSession);
  };

  const submitOrganizingOrCharter = async (button, feedback, fields, message) => {
    if (state.busy || state.awaitingGovernanceRefresh || button.disabled) return;
    state.busy = true;
    state[feedback] = "";
    paintControls();
    let response;
    try {
      response = await ui._mpSubmit(button, "applyPlayerAction", [{ ...actor, partyId: state.partyId, ...fields }]);
    } catch (error) {
      console.warn("[PPO] Could not submit a Party Congress action", error);
    } finally {
      state.busy = false;
    }
    if (!panel.isConnected || state.session !== ui._mpSession || panel._gpmCongressUi !== state) return;
    button.parentElement?.querySelector(".mp-local-feedback")?.remove();
    state.awaitingGovernanceRefresh = Boolean(response?.ok || response?.reason === "stale");
    state[feedback] = message(response);
    paint();
    ui.refreshHUD?.(ui._mpSession);
    ui.refreshTab?.(ui._mpSession);
  };

  const refreshSize = () => {
    paintSize();
    paintControls();
  };
  const selectSize = persist => {
    partyCongressSizeDraft(view, party, ui, state.data.size, input.valueAsNumber, persist);
    bargain.value = "";
    state.sizeFeedback = "";
    refreshSize();
  };
  input.oninput = () => selectSize(false);
  input.onchange = () => selectSize(true);
  for (const button of quickPicks) button.onclick = () => {
    input.value = button.dataset.gpmCongressSizePick;
    selectSize(true);
  };
  bargain.onchange = () => { state.sizeFeedback = ""; refreshSize(); };
  priority.onchange = () => { state.priorityFeedback = ""; paintPriority(); paintControls(); };
  programme.onchange = () => { state.programmeFeedback = ""; paintProgramme(); paintControls(); };
  sizeButton.onclick = () => {
    const vote = paintSize();
    return submit(sizeButton, "size", vote, { verb: "gpm.party.congressSize", size: vote.proposed, bargain: bargain.value });
  };
  priorityButton.onclick = () => {
    const vote = paintPriority();
    return submit(priorityButton, "priority", vote, { verb: "gpm.party.congressPriority", priority: priority.value });
  };
  programmeButton.onclick = () => {
    const vote = paintProgramme();
    return submit(programmeButton, "programme", vote, { verb: "gpm.party.congressProgramme", programme: programme.value });
  };
  currents.onclick = event => {
    const button = event.target.closest("[data-gpm-current-organize]");
    const current = state.data.currents?.find(item => item.id === button?.dataset.gpmCurrentOrganize);
    if (!current?.eligible || current.expected == null) return;
    return submitOrganizingOrCharter(button, "currentFeedback", {
      verb: "gpm.party.currentOrganize", doctrineId: current.id, expected: current.expected,
    }, response => {
      if (!response) return "The organizing action could not be verified.";
      if (!response.ok) return partyCongressCurrentReason(response.reason,
        Number.isFinite(response.nextDay) ? ui.gameDate(response.nextDay) : "");
      const recruited = response.recruited ?? response.membersAdded;
      return "Organized " + current.label + (recruited > 0 ? " · " +
        new Intl.NumberFormat(Es()).format(recruited) + (recruited === 1 ? " member recruited" : " members recruited") : "") + ".";
    });
  };
  charter.onclick = event => {
    const button = event.target.closest("[data-gpm-charter-submit]");
    const motion = state.data.charter?.motions?.find(item => item.id === button?.dataset.gpmCharterSubmit);
    const choice = motion?.choices.find(item => item.value === button.dataset.gpmCharterValue);
    if (!choice?.forecast?.ok || choice.forecast.expected == null) return;
    return submitOrganizingOrCharter(button, "charterFeedback", {
      verb: "gpm.party.congressCharter", motionId: motion.id, value: choice.value, expected: choice.forecast.expected,
    }, response => response ? partyCongressVoteSummary({ ...response, kind: "charter", label: choice.label }, ui) :
      "The charter vote could not be verified.");
  };
  paint();
}

module.exports = {
  rendererFunctions: [...congressColorFunctions, partyCongressSizeDraft, renderPartyCongressChart, partyCongressPriorityName,
    partyCongressVoteSummary, partyCongressVoteRows, partyCongressPendingRows, partyCongressPendingText,
    partyCongressGrantOptions, partyCongressGrantDetail,
    partyCongressPriorityDetail, partyCongressProgrammeDetail, partyCongressBargainReason,
    partyCongressBargainRecord, partyCongressBargainingHtml, bindPartyCongressBargaining,
    partyCongressIdentityHtml, partyCongressRolePolicyHtml, partyCongressCurrentReason, partyCongressCurrentHtml,
    partyCongressCharterHtml, bindPartyCongressRolePolicy,
    renderPartyCongress, bindPartyCongress],
};

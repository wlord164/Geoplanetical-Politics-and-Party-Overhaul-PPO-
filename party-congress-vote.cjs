"use strict";

function partyCongressSizeIsValid(size) {
  return Number.isInteger(size) && size >= 50 && size <= 200;
}

function partyCongressTendencyDescription(axes) {
  const { econ, gov, social, nat } = axes || {};
  const positions = [
    econ <= -.25 ? "State-directed economy" : econ >= .25 ? "Market-oriented economy" : null,
    gov >= .45 ? "Centralized authority" : gov <= -.35 ? "Limited government authority" : null,
    social <= -.35 ? "Social reform" : social >= .35 ? "Social traditionalism" : null,
    nat >= .50 ? "National sovereignty" : nat <= -.50 ? "International cooperation" : null,
  ].filter(Boolean);
  return positions.join(" · ") || "Mixed policy tendencies";
}


function partyCongressDistinctLabels(groups) {
  const byDescription = new Map();
  for (const group of groups) {
    const matches = byDescription.get(group.displayLabel) || [];
    matches.push(group);
    byDescription.set(group.displayLabel, matches);
  }
  const scores = { econ: "Economy", gov: "Authority", social: "Social policy", nat: "International alignment" };
  for (const matches of byDescription.values()) {
    if (matches.length < 2) continue;
    const score = (group, axis) => Math.round(1000 * group.axisWeights[axis] / group.weight) / 10;
    const distinctAxis = Object.keys(scores).find(axis => new Set(matches.map(group => score(group, axis))).size === matches.length);
    for (const group of matches) {
      const axes = distinctAxis ? [distinctAxis] : Object.keys(scores);
      const evidence = axes.map(axis => scores[axis] + " " + score(group, axis)).join(", ");
      group.displayLabel += " (" + evidence + ")";
    }
  }
}


function partyCongressFactions(data, total) {
  const byLabel = new Map();
  for (const profile of data.profiles || []) {
    const label = estimatePartyIdeology(profile.ideology);
    if (!label || !Number.isFinite(profile.weight) || profile.weight <= 0) continue;
    const group = byLabel.get(label) || { label, weight: 0, economicWeight: 0, governmentWeight: 0, names: [],
      axisWeights: { econ: 0, gov: 0, social: 0, nat: 0 }, sources: { platform: 0, supporters: 0, people: 0 } };
    group.weight += profile.weight;
    if (profile.origin === "platform") group.sources.platform += profile.weight;
    if (profile.origin === "supporter-estimate") group.sources.supporters += profile.weight;
    if (profile.origin === "person") group.sources.people += profile.weight;
    group.economicWeight += profile.weight * profile.ideology.econ;
    group.governmentWeight += profile.weight * (profile.ideology.gov || 0);
    for (const axis of Object.keys(group.axisWeights)) group.axisWeights[axis] += profile.weight * (profile.ideology[axis] || 0);
    byLabel.set(label, group);
  }
  for (const figure of data.figures || []) {
    const group = byLabel.get(estimatePartyIdeology(figure.ideology));
    if (group && figure.name) group.names.push(figure.name);
  }
  const groups = [...byLabel.values()];
  const weight = groups.reduce((sum, group) => sum + group.weight, 0);
  if (!weight) return [];
  const factors = data.factionDelegateFactors || {};
  const fullRepresentation = groups.reduce((sum, group) => sum + group.weight * (factors[group.label] || 1), 0);
  let unassigned = total;
  for (const group of groups) {
    group.estimatedShare = group.weight / weight;
    const representation = group.weight * (factors[group.label] || 1);
    group.share = representation / fullRepresentation;
    group.displayLabel = partyCongressTendencyDescription(Object.fromEntries(
      Object.entries(group.axisWeights).map(([axis, value]) => [axis, value / group.weight])));
    for (const source of Object.keys(group.sources)) group.sources[source] /= group.weight;
    const quota = total * representation / fullRepresentation;
    group.seats = Math.floor(quota);
    group.remainder = quota - group.seats;
    unassigned -= group.seats;
  }
  partyCongressDistinctLabels(groups);
  const byRemainder = [...groups].sort((a, b) => b.remainder - a.remainder || a.label.localeCompare(b.label));
  for (let index = 0; index < unassigned; index++) byRemainder[index].seats++;
  return groups.sort((a, b) => a.economicWeight / a.weight - b.economicWeight / b.weight || a.label.localeCompare(b.label));
}

function partyCongressBallot(kind, current, factions) {
  const yes = factions.reduce((sum, group) => sum + group.yes, 0);
  const needed = Math.floor(current / 2) + 1;
  return { ok: true, kind, current, total: current, needed, yes, passed: yes >= needed, factions };
}

function partyCongressSizeVote(data, proposed, bargainLabel = "") {
  if (!partyCongressSizeIsValid(proposed)) return { ok: false, reason: "size" };
  if (!data) return { ok: false, reason: "unavailable" };
  const current = partyCongressSizeIsValid(data.size) ? data.size : 100;
  if (proposed === current) return { ok: false, reason: "unchanged" };
  if (data.day < data.nextSizeVoteDay) {
    return { ok: false, reason: "cooldown", nextVoteDay: data.nextSizeVoteDay };
  }
  const currentFactions = partyCongressFactions(data, current);
  if (!currentFactions.length) return { ok: false, reason: "unavailable" };
  const proposedFactions = partyCongressFactions(data, proposed);
  const currentSeatsByFaction = new Map(currentFactions.filter(group => group.seats > 0).map(group => [group.label, group.seats]));
  const proposedSeatsByFaction = new Map(proposedFactions.filter(group => group.seats > 0).map(group => [group.label, group.seats]));
  const labels = new Set([...currentSeatsByFaction.keys(), ...proposedSeatsByFaction.keys()]);

  const scale = Math.min(1, Math.abs(proposed - current) / current);
  const baseline = .66 - .42 * scale;
  const factions = [...labels].map(label => {
    const currentSeats = currentSeatsByFaction.get(label) || 0;
    const proposedSeats = proposedSeatsByFaction.get(label) || 0;
    const currentShare = currentSeats / current;
    const proposedShare = proposedSeats / proposed;
    const shift = (proposedShare - currentShare) / Math.max(.03, currentShare);
    let support = baseline;
    let reason = scale >= .35 ? "Resists the scale of the change." : "Accepts a smaller change to Congress.";
    if (!currentSeats) {
      reason = "Would gain representation and has no vote in this Congress.";
    } else if (!proposedSeats) {
      support = 0;
      reason = "Would lose all representation.";
    } else if (shift < -1e-8) {
      support -= .08 + .45 * Math.min(1, -shift);
      reason = "Would lose a share of Congress and resists losing influence.";
    } else if (shift > 1e-8) {
      support += .08 + .45 * Math.min(1, shift);
      reason = scale >= .35
        ? "Gains a share of Congress, but some delegates resist a large change."
        : "Favors the gain in its share of Congress.";
    }
    const yes = Math.round(currentSeats * Math.max(0, Math.min(1, support)));
    return { label, currentSeats, proposedSeats, yes, reason };
  });

  const base = partyCongressBallot("size", current, factions);
  const bargains = [];
  if (!base.passed) {
    for (const group of factions) {
      if (!group.proposedSeats || !group.currentSeats || group.yes > group.currentSeats / 2) continue;
      const extraYes = Math.ceil((group.currentSeats - group.yes) / 2);
      const cash = (15 + 2 * extraYes) / 1000;
      bargains.push({ label: group.label, cash, extraYes, affordable: data.treasuryM >= cash });
    }
  }
  if (!bargainLabel) return { ...base, proposed, bargains };
  const offer = bargains.find(group => group.label === bargainLabel);
  if (!offer) return { ok: false, reason: "bargain" };
  if (!offer.affordable) return { ok: false, reason: "budget" };
  const { label, cash, extraYes } = offer;
  const negotiated = factions.map(group => group.label === label
    ? { ...group, yes: group.yes + extraYes, reason: group.reason + " An organizing grant brings some delegates over." }
    : group);
  return { ...partyCongressBallot("size", current, negotiated), proposed, bargains, bargain: { label, cash, extraYes } };
}

function partyCongressPriorityIsValid(kind) {
  return kind === "rally" || kind === "investment";
}

function partyCongressActivePriority(party, day) {
  const priority = party.gpmCongressSizeState?.priority;
  return partyCongressPriorityIsValid(priority?.kind) && day < priority.untilDay ? priority : null;
}

function partyCongressPriorityCost(kind, priority) {
  if (!partyCongressPriorityIsValid(kind) || !partyCongressPriorityIsValid(priority)) return 1;
  return kind === priority ? .8 : 1.15;
}

function partyCongressPriorityVote(data, priority) {
  if (!partyCongressPriorityIsValid(priority)) return { ok: false, reason: "priority" };
  if (!data) return { ok: false, reason: "unavailable" };
  if (data.priority) return { ok: false, reason: "active", nextVoteDay: data.priority.untilDay };
  if (data.day < data.nextPriorityVoteDay) {
    return { ok: false, reason: "cooldown", nextVoteDay: data.nextPriorityVoteDay };
  }
  const current = partyCongressSizeIsValid(data.size) ? data.size : 100;
  const factions = partyCongressFactions(data, current).filter(group => group.seats > 0).map(group => {
    const economicLean = group.economicWeight / group.weight;
    const preferred = economicLean < 0 ? "investment" : "rally";
    const conviction = Math.min(1, Math.abs(economicLean) / .6);
    const neutral = Math.abs(economicLean) < .15;
    const support = .5 + (preferred === priority ? 1 : -1) * .45 * conviction + (neutral ? .05 : 0);
    const reason = neutral ? "Divided over which projects should get the budget."
      : preferred === "investment" ? "Statist delegates prefer sustained investment in local party networks."
        : "Market-leaning delegates prefer short rallies over long-term spending.";
    return { label: group.label, currentSeats: group.seats, proposedSeats: group.seats, yes: Math.round(group.seats * support), reason };
  });
  if (!factions.length) return { ok: false, reason: "unavailable" };
  return { ...partyCongressBallot("priority", current, factions), priority, untilDay: (data.day ?? 0) + 90 };
}

const congressProgrammes = {
  livelihoods: {
    label: "Jobs and household security", axis: "economicWeight", direction: -1,
    laws: ["minimum_wage", "unemployment_insurance", "family_allowance", "paid_parental_leave", "union_freedom", "strike_right"],
  },
  enterprise: {
    label: "Enterprise and investment", axis: "economicWeight", direction: 1,
    laws: ["regime_propriete", "land_tenure", "electricity_market"],
  },
  liberties: {
    label: "Civil liberties", axis: "governmentWeight", direction: -1,
    laws: ["media_freedom", "freedom_of_worship", "union_freedom", "strike_right"],
  },
};

function partyCongressProgrammes() {
  return gpmCongressProgrammes;
}

function partyCongressProgrammeVote(data, programme) {
  const choices = partyCongressProgrammes();
  const choice = Object.hasOwn(choices, programme) ? choices[programme] : null;
  if (!choice || !data) return { ok: false, reason: "unavailable" };
  if (data.programme) return { ok: false, reason: "active", nextVoteDay: data.programme.untilDay };
  if (data.day < data.nextProgrammeVoteDay) {
    return { ok: false, reason: "cooldown", nextVoteDay: data.nextProgrammeVoteDay };
  }
  const current = partyCongressSizeIsValid(data.size) ? data.size : 100;
  const endorsements = new Map((data.factionEndorsements || []).filter(offer => offer.programme === programme)
    .map(offer => [offer.label, offer.extraYes]));
  const factions = partyCongressFactions(data, current).filter(group => group.seats > 0).map(group => {
    const alignment = choice.direction * group[choice.axis] / group.weight;
    const support = Math.max(0, Math.min(1, .55 + .40 * alignment));
    let reason = alignment > .12 ? "This programme fits the faction’s politics." :
      alignment < -.12 ? "The faction favors different policy priorities." : "The faction is open to this programme.";
    const baselineYes = Math.round(group.seats * support);
    const pledgedYes = Math.min(group.seats - baselineYes, endorsements.get(group.label) || 0);
    if (pledgedYes) reason += ` Its leader's endorsement brings ${pledgedYes} more delegates.`;
    return { label: group.label, currentSeats: group.seats, proposedSeats: group.seats,
      yes: baselineYes + pledgedYes, reason };
  });
  if (!factions.length) return { ok: false, reason: "unavailable" };
  return { ...partyCongressBallot("programme", current, factions), programme, untilDay: data.day + 180 };
}

function partyCongressForecastKey(vote) {
  if (!vote.ok) return null;
  return JSON.stringify([
    vote.kind, vote.current, vote.proposed, vote.priority, vote.programme, vote.untilDay, vote.bargain ?? null,
    vote.factions.map(({ label, currentSeats, proposedSeats, yes }) => [label, currentSeats, proposedSeats, yes]),
  ]);
}

function partyCongressActiveProgramme(party, day) {
  const programme = party.gpmCongressSizeState?.programme;
  return programme && Object.hasOwn(partyCongressProgrammes(), programme.kind) && day < programme.untilDay
    ? programme : null;
}

function partyCongressProgrammeLawBonus(party, lawId, day) {
  const programme = partyCongressActiveProgramme(party, day);
  if (!programme) return 0;
  return partyCongressProgrammes()[programme.kind].laws.includes(lawId) ? 1 : 0;
}

function partyCongressEligible(party) {
  return !!party?.organization && party.legal !== false && !party.gpmUprisingShell && !party.gpmUprisingExcluded;
}

function applyPartyCongressVote(sim, country, party, kind, input, data = null) {
  if (!partyCongressEligible(party)) return { ok: false, reason: "party" };
  if (kind === "size" && input.bargain != null && typeof input.bargain !== "string") {
    return { ok: false, reason: "bargain" };
  }
  data ??= partyCongressView(sim, country, party.id);
  const forecast = kind === "size" ? partyCongressSizeVote(data, input.size, input.bargain)
    : kind === "priority" ? partyCongressPriorityVote(data, input.priority)
      : kind === "programme" ? partyCongressProgrammeVote(data, input.programme) : { ok: false, reason: "unavailable" };
  if (input.expected != null && input.expected !== partyCongressForecastKey(forecast)) {
    return { ok: false, reason: "stale" };
  }
  if (!forecast.ok) return forecast;
  const { bargains, ...ballot } = forecast;
  const vote = { ...ballot, day: data.day, nextVoteDay: data.day + 14, changed: true };
  const state = party.gpmCongressSizeState ??= { size: data.size };
  if (kind === "size") {
    if (vote.passed && vote.bargain) {
      const nextTreasury = Math.round((data.treasuryM - vote.bargain.cash) * 1e6) / 1e6;
      party.organization.treasuryM = partyForeignFundingTreasury(party, nextTreasury);
      if (typeof gpmDomesticReceipt === "function") {
        gpmDomesticReceipt(sim, country, party, "congress-grant", { cashM: -vote.bargain.cash, details: vote.bargain.label });
      }
    }
    if (vote.passed) state.size = vote.proposed;
    state.nextSizeVoteDay = vote.nextVoteDay;
    state.lastVote = vote;
  } else if (kind === "priority") {
    if (vote.passed) state.priority = { kind: vote.priority, untilDay: vote.untilDay };
    state.nextPriorityVoteDay = vote.nextVoteDay;
    state.lastPriorityVote = vote;
  } else {
    if (vote.passed) state.programme = { kind: vote.programme, untilDay: vote.untilDay };
    state.nextProgrammeVoteDay = vote.nextVoteDay;
    state.lastProgrammeVote = vote;
    if (typeof gpmFactionSettleVote === "function") gpmFactionSettleVote(sim, country, party, vote);
  }
  return vote;
}

function partyCongressAgenda(sim, country, partyId) {
  const party = YL(country, partyId);
  const state = party?.gpmCongressSizeState;
  const bargains = typeof gpmFactionAgenda === "function" ? gpmFactionAgenda(sim, country, partyId) : [];
  if (!state) return bargains;
  const entries = [
    [partyCongressActivePriority(party, sim.day), state.lastPriorityVote,
      state.priority?.kind === "investment" ? "Local investment priority" : "Regional rally priority"],
    [partyCongressActiveProgramme(party, sim.day), state.lastProgrammeVote,
      partyCongressProgrammes()[state.programme?.kind]?.label || "Party programme"],
  ];
  return bargains.concat(entries.flatMap(([current, vote, title]) => current ? [{
    id: `congress:${vote?.kind || current.kind}:${current.untilDay}`, kind: "congress", title,
    day: vote?.day ?? sim.day, deadlineDay: current.untilDay, status: "active", tab: "congress",
  }] : []));
}

function registerPartyCongressSize() {
  for (const [verb, kind] of [["gpm.party.congressSize", "size"], ["gpm.party.congressPriority", "priority"],
    ["gpm.party.congressProgramme", "programme"]]) {
    n5t(verb, {
      apply(sim, country, input) {
        if (country.key !== sim.playerKey || Uo(country) !== input.partyId) return { ok: false, reason: "party" };
        return applyPartyCongressVote(sim, country, YL(country, input.partyId), kind, input);
      },
    });
  }
}

module.exports = {
  sharedFunctions: [
    `const gpmCongressProgrammes = ${JSON.stringify(congressProgrammes)};`,
    partyCongressTendencyDescription, partyCongressDistinctLabels, partyCongressSizeIsValid, partyCongressFactions, partyCongressBallot, partyCongressSizeVote,
    partyCongressPriorityIsValid, partyCongressPriorityCost, partyCongressPriorityVote,
    partyCongressProgrammes, partyCongressProgrammeVote, partyCongressForecastKey,
  ],
  workerFunctions: [partyCongressActivePriority, partyCongressActiveProgramme, partyCongressProgrammeLawBonus,
    partyCongressEligible, applyPartyCongressVote, partyCongressAgenda, registerPartyCongressSize],
};

"use strict";

function partyCongressSizeIsValid(size) {
  return Number.isInteger(size) && size >= 50 && size <= 200;
}

function partyCongressFactions(data, total) {
  const byLabel = new Map();
  for (const profile of data.profiles || []) {
    const label = estimatePartyIdeology(profile.ideology);
    if (!label || !Number.isFinite(profile.weight) || profile.weight <= 0) continue;
    const group = byLabel.get(label) || { label, weight: 0, economicWeight: 0, names: [] };
    group.weight += profile.weight;
    group.economicWeight += profile.weight * profile.ideology.econ;
    byLabel.set(label, group);
  }
  for (const figure of data.figures || []) {
    const group = byLabel.get(estimatePartyIdeology(figure.ideology));
    if (group && figure.name) group.names.push(figure.name);
  }
  const groups = [...byLabel.values()];
  const weight = groups.reduce((sum, group) => sum + group.weight, 0);
  if (!weight) return [];
  const factions = [];
  const other = { label: "Other factions", weight: 0, economicWeight: 0, labels: [], names: [] };
  for (const group of groups) {
    if (group.weight / weight >= .03) {
      factions.push(group);
      continue;
    }
    other.weight += group.weight;
    other.economicWeight += group.economicWeight;
    other.labels.push(group.label);
    other.names.push(...group.names);
  }
  if (other.labels.length) factions.push(other);
  let unassigned = total;
  for (const group of factions) {
    const quota = total * group.weight / weight;
    group.seats = Math.floor(quota);
    group.remainder = quota - group.seats;
    unassigned -= group.seats;
  }
  const byRemainder = [...factions].sort((a, b) => b.remainder - a.remainder || a.label.localeCompare(b.label));
  for (let index = 0; index < unassigned; index++) byRemainder[index].seats++;
  return factions.filter(group => group.seats > 0)
    .sort((a, b) => a.economicWeight / a.weight - b.economicWeight / b.weight || a.label.localeCompare(b.label));
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
  const currentSeatsByFaction = new Map(currentFactions.map(group => [group.label, group.seats]));
  const proposedSeatsByFaction = new Map(proposedFactions.map(group => [group.label, group.seats]));
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
  const factions = partyCongressFactions(data, current).map(group => {
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

function partyCongressForecastKey(vote) {
  if (!vote.ok) return null;
  return JSON.stringify([
    vote.kind, vote.current, vote.proposed, vote.priority, vote.untilDay, vote.bargain ?? null,
    vote.factions.map(({ label, currentSeats, proposedSeats, yes }) => [label, currentSeats, proposedSeats, yes]),
  ]);
}

function registerPartyCongressSize() {
  for (const [verb, kind] of [["gpm.party.congressSize", "size"], ["gpm.party.congressPriority", "priority"]]) {
    n5t(verb, {
      apply(sim, country, input) {
        if (country.key !== sim.playerKey || Uo(country) !== input.partyId) return { ok: false, reason: "party" };
        const party = YL(country, input.partyId);
        if (!party?.organization || party.legal === false) return { ok: false, reason: "party" };
        if (kind === "size" && input.bargain != null && typeof input.bargain !== "string") {
          return { ok: false, reason: "bargain" };
        }
        const data = partyCongressView(sim, country, input.partyId);
        const forecast = kind === "size" ? partyCongressSizeVote(data, input.size, input.bargain)
          : partyCongressPriorityVote(data, input.priority);
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
          }
          if (vote.passed) state.size = vote.proposed;
          state.nextSizeVoteDay = vote.nextVoteDay;
          state.lastVote = vote;
        } else {
          if (vote.passed) state.priority = { kind: vote.priority, untilDay: vote.untilDay };
          state.nextPriorityVoteDay = vote.nextVoteDay;
          state.lastPriorityVote = vote;
        }
        return vote;
      },
    });
  }
}

module.exports = {
  sharedFunctions: [
    partyCongressSizeIsValid, partyCongressFactions, partyCongressBallot, partyCongressSizeVote,
    partyCongressPriorityIsValid, partyCongressPriorityCost, partyCongressPriorityVote, partyCongressForecastKey,
  ],
  workerFunctions: [partyCongressActivePriority, registerPartyCongressSize],
};

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

function partyCongressSizeVote(data, proposed) {
  if (!partyCongressSizeIsValid(proposed)) return { ok: false, reason: "size" };
  if (!data) return { ok: false, reason: "unavailable" };
  const current = partyCongressSizeIsValid(data.size) ? data.size : 100;
  if (proposed === current) return { ok: false, reason: "unchanged" };
  const currentFactions = partyCongressFactions(data, current);
  if (!currentFactions.length) return { ok: false, reason: "unavailable" };
  const proposedFactions = partyCongressFactions(data, proposed);
  const currentSeatsByFaction = new Map(currentFactions.map(group => [group.label, group.seats]));
  const proposedSeatsByFaction = new Map(proposedFactions.map(group => [group.label, group.seats]));
  const labels = new Set([...currentSeatsByFaction.keys(), ...proposedSeatsByFaction.keys()]);

  // A faction favors changes that improve its share of seats. Large changes
  // reduce support even when proportional representation barely moves.
  const scale = Math.min(1, Math.abs(proposed - current) / current);
  const baseline = .66 - .42 * scale;
  const factions = [...labels].map(label => {
    const currentSeats = currentSeatsByFaction.get(label) || 0;
    const proposedSeats = proposedSeatsByFaction.get(label) || 0;
    const currentShare = currentSeats / current;
    const proposedShare = proposedSeats / proposed;
    const shift = (proposedShare - currentShare) / Math.max(.03, currentShare);
    const support = Math.max(0, Math.min(1, baseline + .35 * Math.max(-1, Math.min(1, shift))));
    return { label, currentSeats, proposedSeats, yes: Math.round(currentSeats * support) };
  });
  const yes = factions.reduce((sum, group) => sum + group.yes, 0);
  return { ok: true, proposed, current, yes, total: current, passed: yes > current / 2, factions };
}

function registerPartyCongressSize() {
  Pyt("gpm.party.congressSize", {
    validate(sim, country, input) {
      if (country.key !== sim.playerKey || Go(country) !== input.partyId) return { ok: false, reason: "party" };
      return partyCongressSizeIsValid(input.size) ? true : { ok: false, reason: "size" };
    },
    apply(sim, country, input) {
      if (country.key !== sim.playerKey || Go(country) !== input.partyId) return { ok: false, reason: "party" };
      const party = WN(country, input.partyId);
      const data = partyCongressView(sim, country, input.partyId);
      const vote = partyCongressSizeVote(data, input.size);
      if (vote.ok) {
        party.gpmCongressSizeState = { size: vote.passed ? vote.proposed : vote.current, lastVote: vote };
      }
      return vote;
    },
  });
}

module.exports = {
  sharedFunctions: [partyCongressSizeIsValid, partyCongressFactions, partyCongressSizeVote],
  workerFunctions: [registerPartyCongressSize],
};

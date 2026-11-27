"use strict";

const motions = {
  memberAuthority: {
    label: "Faction representation",
    description: "Choose how representatives are selected. Current representatives keep their terms.",
    choices: {
      appointment: { label: "Party appointment", direction: -1 },
      election: { label: "Election by faction members", direction: 1 },
    },
  },
  branchAutonomy: {
    label: "Branch authority",
    description: "Autonomous branches can organize a compatible current from a single established branch. Central administration requires a broader network.",
    choices: {
      central: { label: "Central administration", direction: -1 },
      autonomous: { label: "Branch autonomy", direction: 1 },
    },
  },
  representativeIndependence: {
    label: "Representative independence",
    description: "Decide whether executive and cabinet officeholders can begin new terms as faction representatives.",
    requiresPosition: true,
    choices: {
      officeholdersPermitted: { label: "Public officeholders are eligible", direction: -1 },
      separateFromGovernment: { label: "Keep representatives separate from government", direction: 1 },
    },
  },
};

function partyCongressCharterRule(sim, party, motionId) {
  if (motionId === "memberAuthority") return gpmFactionLeadershipCharter(sim, party).method;
  if (motionId === "representativeIndependence") {
    return party.gpmCongressCharter?.representativeIndependence?.value === "separateFromGovernment"
      ? "separateFromGovernment" : "officeholdersPermitted";
  }
  return party.gpmCongressCharter?.branchAutonomy?.value === "autonomous" ? "autonomous" : "central";
}

function partyCongressCharterAvailable(party, motionId, motion, factions) {
  return !motion.requiresPosition || !!party.gpmCongressCharter?.[motionId] ||
    factions.some(group => group.seats > 0 && Number.isFinite(group.positions?.[motionId]));
}

function partyCongressCharterForecast(sim, party, data, motionId, value, factions) {
  if (!partyCongressEligible(party)) return { ok: false, reason: "party" };
  const motion = Object.hasOwn(gpmCongressCharterMotions, motionId) ? gpmCongressCharterMotions[motionId] : null;
  const choice = motion && Object.hasOwn(motion.choices, value) ? motion.choices[value] : null;
  if (!choice || !partyCongressCharterAvailable(party, motionId, motion, factions)) return { ok: false, reason: "unavailable" };
  const current = partyCongressCharterRule(sim, party, motionId);
  if (current === "none") return { ok: false, reason: "charter-closed" };
  if (current === value) return { ok: false, reason: "unchanged" };
  const previous = party.gpmCongressCharter?.ballots?.[motionId];
  if (data.day < (previous?.nextVoteDay ?? 0)) return { ok: false, reason: "cooldown", nextVoteDay: previous.nextVoteDay };

  const delegates = factions.filter(group => group.seats > 0).map(group => {
    const stance = group.positions?.[motionId];
    const agreement = Number.isFinite(stance) ? Math.min(1, Math.max(-1, stance * choice.direction)) : 0;
    const estimate = group.seats * (.5 + .42 * agreement);
    const yes = Math.floor(estimate);
    return { estimate, remainder: estimate - yes, row: {
      label: group.label, currentSeats: group.seats, proposedSeats: group.seats, yes,
      reason: agreement > .12 ? "Supports this rule for the party." : agreement < -.12 ? "Favors the other rule." : "No strong position on this rule.",
    } };
  });
  if (!delegates.length) return { ok: false, reason: "unavailable" };
  const expectedYes = delegates.reduce((sum, group) => sum + group.estimate, 0);
  const goal = Math.abs(expectedYes - data.size / 2) < 1e-9 ? Math.floor(data.size / 2) : Math.round(expectedYes);
  let left = goal - delegates.reduce((sum, group) => sum + group.row.yes, 0);
  for (const group of [...delegates].sort((a, b) => b.remainder - a.remainder || a.row.label.localeCompare(b.row.label))) {
    if (left <= 0) break;
    group.row.yes++;
    left--;
  }
  const ballot = { ...partyCongressBallot("charter", data.size, delegates.map(group => group.row)), motionId, value };
  const expected = JSON.stringify([party.id, data.day, motionId, current, value, partyCongressForecastKey(ballot)]);
  return { ...ballot, expected };
}

function partyCongressCharterView(sim, country, party, data) {
  const factions = partyCongressFactions(data, data.size);
  return { motions: Object.entries(gpmCongressCharterMotions).filter(([id, motion]) =>
    partyCongressCharterAvailable(party, id, motion, factions)).map(([id, motion]) => ({
    id, label: motion.label, description: motion.description,
    current: partyCongressCharterRule(sim, party, id), lastVote: party.gpmCongressCharter?.ballots?.[id] ?? null,
    choices: Object.entries(motion.choices).map(([value, choice]) => ({
      value, label: choice.label, forecast: partyCongressCharterForecast(sim, party, data, id, value, factions),
    })),
  })) };
}

function applyPartyCongressCharter(sim, country, party, motionId, value, expected, data = null) {
  if (!partyCongressEligible(party)) return { ok: false, reason: "party" };
  if (!Object.hasOwn(gpmCongressCharterMotions, motionId) || typeof value !== "string") return { ok: false, reason: "unavailable" };
  const previous = party.gpmCongressCharter?.ballots?.[motionId];
  if (previous?.expected === expected && previous?.value === value && typeof expected === "string") return { ...previous, changed: false };
  data ??= partyCongressView(sim, country, party.id);
  if (!data) return { ok: false, reason: "party" };
  const ballot = partyCongressCharterForecast(sim, party, data, motionId, value, partyCongressFactions(data, data.size));
  if (!ballot.ok) return ballot;
  if (ballot.expected !== expected) return { ok: false, reason: "stale" };

  const state = party.gpmCongressCharter ??= { ballots: {} };
  state.ballots ??= {};
  if (ballot.passed) state[motionId] = { value, day: data.day, revision: (state[motionId]?.revision || 0) + 1 };
  const result = { ...ballot, day: data.day, nextVoteDay: data.day + 14, changed: true };
  state.ballots[motionId] = result;
  return result;
}

function advancePartyCongressCharterAI(sim, country, party, data) {
  if (!data.identity?.congressDoctrine || data.sizeRecommendation.members < 20) return null;
  const factions = partyCongressFactions(data, data.size);
  for (const [id, motion] of Object.entries(gpmCongressCharterMotions)) {
    if (data.day - (party.gpmCongressCharter?.ballots?.[id]?.day ?? -365) < 120) continue;
    for (const value of Object.keys(motion.choices)) {
      const vote = partyCongressCharterForecast(sim, party, data, id, value, factions);
      if (vote.ok && vote.yes >= .6 * data.size) return applyPartyCongressCharter(sim, country, party, id, value, vote.expected, data);
    }
  }
  return null;
}

function registerPartyCongressCharter() {
  gNt("gpm.party.congressCharter", {
    apply(sim, country, input) {
      if (country.key !== sim.playerKey || Lo(country) !== input.partyId) return { ok: false, reason: "party" };
      return applyPartyCongressCharter(sim, country, Gq(country, input.partyId), input.motionId, input.value, input.expected);
    },
  });
}

module.exports = { workerFunctions: [
  `const gpmCongressCharterMotions = ${JSON.stringify(motions)};`, partyCongressCharterRule, partyCongressCharterAvailable, partyCongressCharterForecast,
  partyCongressCharterView, applyPartyCongressCharter, advancePartyCongressCharterAI, registerPartyCongressCharter,
] };

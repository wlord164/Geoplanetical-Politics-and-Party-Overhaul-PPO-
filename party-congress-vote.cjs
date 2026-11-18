"use strict";

const gpmCongressSizeMin = 50;
const gpmCongressSizeMax = 1000;
const gpmCongressDefaultSize = 100;

function partyCongressSizeIsValid(size) {
  return Number.isInteger(size) && size >= gpmCongressSizeMin && size <= gpmCongressSizeMax;
}

function partyCongressSizeRecommendation(members = 0, regions = 0, totalRegions = 0) {
  const nationwide = Math.min(totalRegions, Math.max(3, Math.ceil(totalRegions * .35)));
  const mass = Math.min(totalRegions, Math.max(4, Math.ceil(totalRegions * .65)));
  const evidence = { members, regions, totalRegions };
  if (members >= 35000 && mass > 0 && regions >= mass) {
    return { ...evidence, label: "Mass party", min: 750, max: gpmCongressSizeMax, size: 850 };
  }
  if (members >= 10000 && nationwide > 0 && regions >= nationwide) {
    return { ...evidence, label: "Nationwide party", min: 400, max: 600, size: 500 };
  }
  if (members >= 1000 && regions >= 2) {
    return { ...evidence, label: "Multi-region party", min: 150, max: 300, size: 250 };
  }
  return { ...evidence, label: "New or local party", min: gpmCongressSizeMin, max: gpmCongressDefaultSize, size: gpmCongressDefaultSize };
}

const gpmCongressRecognitionPercent = 5;

function partyCongressRecognitionSeats(total) {
  return Math.ceil(total * gpmCongressRecognitionPercent / 100);
}

const factionTitles = {
  "Authoritarian Left Nationalism": "Left Nationalism",
  "Progressive Left Nationalism": "Civic Nationalism",
  "Socially Conservative Left Nationalism": "Left Conservatism",
  "Left Nationalism": "Economic Nationalism",
  "Authoritarian National Conservatism": "Integral Nationalism",
  "National Conservatism": "National Conservative",
  "Authoritarian Nationalism": "Authoritarian Nationalist",
  "Liberal Nationalism": "Liberal Nationalist",
  "Market-Oriented Nationalism": "Market Nationalist",
  "Nationalism": "Nationalist",
  "Socially Conservative Authoritarian Left": "Conservative Socialism",
  "Authoritarian Left": "Authoritarian Socialist",
  "Authoritarian Market Right": "Authoritarian Capitalist",
  "Authoritarian Conservatism": "Authoritarian Conservative",
  "Socially Progressive Authoritarianism": "Authoritarian Progressive",
  "Authoritarian Centrism": "Authoritarian Centrist",
  "Socially Conservative Left": "Paternalistic Conservatism",
  "Internationalist Statist Left": "Internationalist Socialist",
  "Statist Left": "State Socialist",
  "Social Democracy": "Social Democrat",
  "Internationalist Left": "Internationalist Left",
  "Progressive Left": "Progressive Left",
  "Centre-Left": "Centre-left",
  "Liberal Conservatism": "Liberal Conservative",
  "Market Conservatism": "Market Conservative",
  "Market Liberalism": "Market Liberal",
  "Socially Progressive Market Right": "Socially Liberal Right",
  "Market Right": "Free-market Right",
  "Centre-Right": "Centre-right",
  "Social Liberalism": "Social Liberal",
  "Progressivism": "Progressive",
  "Social Conservatism": "Social Conservative",
  "Liberal Centrism": "Constitutional Liberalism",
  "Internationalist Centrism": "Internationalism",
  "Centrism": "Centrist",
};

function partyCongressFactionLabel(key) {
  if (key?.startsWith("doctrine:")) return gpmCongressDoctrine(key.slice(9))?.label || key;
  return Object.hasOwn(gpmCongressFactionTitles, key) ? gpmCongressFactionTitles[key] : key;
}

function partyCongressFactionId(key) {
  return key.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function partyCongressProfileDoctrine(data, profile, legacyKey) {
  if (data.membershipBacked) return profile.doctrineId ? gpmCongressDoctrine(profile.doctrineId) : null;
  const context = data.identity?.congressDoctrine;
  if (!context || data.factionLegacyProtectedLabels?.includes(legacyKey)) return null;
  const assigned = data.factionLegacyAssignments?.[legacyKey];
  if (assigned) return gpmCongressDoctrine(assigned);
  const platform = gpmCongressDoctrine(context.platform);
  if (!platform || profile.origin === "platform") return platform;
  const wings = (context.wings || []).map(gpmCongressDoctrine).filter(wing => wing && !wing.explicitOrganization);
  const distance = candidate => gpmAxes.reduce((sum, { id }) =>
    sum + (profile.ideology[id] - candidate.axes[id]) ** 2, 0);
  if (!wings.length) return legacyKey === estimatePartyIdeology(platform.axes) && distance(platform) <= .64 ? platform : null;
  let closest = platform;
  let best = distance(platform);
  for (const wing of wings) {
    const separation = distance(wing);
    if (separation >= best || separation > .64) continue;
    closest = wing;
    best = separation;
  }
  return closest;
}

function partyCongressPlatformTradition(data) {
  const declared = data.identity?.declared;
  if (!declared?.id || !Object.hasOwn(gpmPresets, declared.id)) return null;
  const platform = data.profiles?.find(profile => profile.origin === "platform")?.ideology;
  const preset = gpmPresets[declared.id];
  // A declaration can name the platform bloc while the current platform still fits that tradition.
  if (!gpmAxes.every(({ id }, index) => Math.abs(platform?.[id] - preset.values[index] / 100) <= .2)) return null;
  return { key: estimatePartyIdeology(platform), label: preset.label };
}

function partyCongressFactions(data, total) {
  const byLabel = new Map();
  for (const profile of data.profiles || []) {
    const legacyKey = estimatePartyIdeology(profile.ideology);
    if (!legacyKey || !Number.isFinite(profile.weight) || profile.weight <= 0) continue;
    const doctrine = partyCongressProfileDoctrine(data, profile, legacyKey);
    const label = profile.legacyLabel || (doctrine ? "doctrine:" + doctrine.id : legacyKey);
    const group = byLabel.get(label) || { label, id: partyCongressFactionId(label),
      doctrineId: doctrine?.id ?? null, positions: doctrine?.positions || null, description: doctrine?.description || "",
      weight: 0, economicWeight: 0, governmentWeight: 0, names: [], legacyWeights: {},
      axisWeights: { econ: 0, gov: 0, social: 0, nat: 0 }, sources: { platform: 0, supporters: 0, members: 0, people: 0, legacy: 0 } };
    group.legacyWeights[legacyKey] = (group.legacyWeights[legacyKey] || 0) + profile.weight;
    group.weight += profile.weight;
    if (profile.origin === "platform") group.sources.platform += profile.weight;
    if (profile.origin === "supporter-estimate") group.sources.supporters += profile.weight;
    if (profile.origin === "membership") group.sources.members += profile.weight;
    if (profile.origin === "person") group.sources.people += profile.weight;
    if (profile.origin === "legacy") group.sources.legacy += profile.weight;
    group.economicWeight += profile.weight * profile.ideology.econ;
    group.governmentWeight += profile.weight * (profile.ideology.gov || 0);
    for (const axis of Object.keys(group.axisWeights)) group.axisWeights[axis] += profile.weight * (profile.ideology[axis] || 0);
    byLabel.set(label, group);
  }
  for (const figure of data.figures || []) {
    const legacyKey = estimatePartyIdeology(figure.ideology);
    if (!legacyKey || !figure.name) continue;
    if (data.membershipBacked && !figure.doctrineId) continue;
    const doctrine = partyCongressProfileDoctrine(data, { origin: "person", ideology: figure.ideology, doctrineId: figure.doctrineId }, legacyKey);
    const group = byLabel.get(doctrine ? "doctrine:" + doctrine.id : legacyKey);
    if (group) group.names.push(figure.name);
  }
  const groups = [...byLabel.values()];
  const weight = groups.reduce((sum, group) => sum + group.weight, 0);
  if (!weight) return [];
  const factors = data.factionDelegateFactors || {};
  const fullRepresentation = groups.reduce((sum, group) => sum + group.weight * (factors[group.label] || 1), 0);
  const tradition = partyCongressPlatformTradition(data);
  let unassigned = total;
  for (const group of groups) {
    group.estimatedShare = group.weight / weight;
    const representation = group.weight * (factors[group.label] || 1);
    group.share = representation / fullRepresentation;
    for (const source of Object.keys(group.sources)) group.sources[source] /= group.weight;
    group.displayLabel = !group.doctrineId && tradition?.key === group.label && group.sources.platform >= .5
      ? tradition.label : partyCongressFactionLabel(group.label);
    const quota = total * representation / fullRepresentation;
    group.seats = Math.floor(quota);
    group.remainder = quota - group.seats;
    unassigned -= group.seats;
  }
  const byRemainder = [...groups].sort((a, b) => b.remainder - a.remainder || a.label.localeCompare(b.label));
  for (let index = 0; index < unassigned; index++) byRemainder[index].seats++;
  const tokenOrder = [...groups].sort((a, b) =>
    a.economicWeight / a.weight - b.economicWeight / b.weight || a.label.localeCompare(b.label));
  tokenOrder.forEach((group, index) => { group.forecastOrder = index; });
  return groups.sort((a, b) => b.seats - a.seats || a.label.localeCompare(b.label));
}

function partyCongressBallot(kind, current, factions) {
  const yes = factions.reduce((sum, group) => sum + group.yes, 0);
  const needed = Math.floor(current / 2) + 1;
  const ordered = factions.map((group, index) => ({ ...group, id: partyCongressFactionId(group.label), forecastOrder: index }))
    .sort((a, b) => b.currentSeats - a.currentSeats || b.proposedSeats - a.proposedSeats || a.label.localeCompare(b.label));
  return { ok: true, kind, current, total: current, needed, yes, passed: yes >= needed, factions: ordered };
}

function partyCongressSizeVote(data, proposed, bargainLabel = "") {
  if (!partyCongressSizeIsValid(proposed)) return { ok: false, reason: "size" };
  if (!data) return { ok: false, reason: "unavailable" };
  if (data.pendingResize) return { ok: false, reason: "pending", pendingResize: data.pendingResize };
  const current = partyCongressSizeIsValid(data.size) ? data.size : gpmCongressDefaultSize;
  if (proposed === current) return { ok: false, reason: "unchanged" };
  if (data.day < data.nextSizeVoteDay) {
    return { ok: false, reason: "cooldown", nextVoteDay: data.nextSizeVoteDay };
  }
  const byForecast = (a, b) => a.forecastOrder - b.forecastOrder;
  const currentFactions = partyCongressFactions(data, current).sort(byForecast);
  if (!currentFactions.length) return { ok: false, reason: "unavailable" };
  const proposedFactions = partyCongressFactions(data, proposed).sort(byForecast);
  const currentSeatsByFaction = new Map(currentFactions.filter(group => group.seats > 0).map(group => [group.label, group.seats]));
  const proposedSeatsByFaction = new Map(proposedFactions.filter(group => group.seats > 0).map(group => [group.label, group.seats]));
  const labels = new Set([...currentSeatsByFaction.keys(), ...proposedSeatsByFaction.keys()]);

  const recommendation = data.sizeRecommendation ?? partyCongressSizeRecommendation();
  const forecastDay = data.day ?? 0;
  const effectiveDay = Math.max(forecastDay, data.nextReviewDay ?? forecastDay + 1);
  const supported = (proposed >= recommendation.min && proposed <= recommendation.max) ||
    (proposed < recommendation.min && proposed > current) ||
    (proposed > recommendation.max && proposed < current);
  const scale = Math.abs(proposed - current) / Math.max(current, proposed);
  const baseline = supported ? .68 - .10 * scale : .62 - .48 * scale;
  const factions = [...labels].map(label => {
    const currentSeats = currentSeatsByFaction.get(label) || 0;
    const proposedSeats = proposedSeatsByFaction.get(label) || 0;
    const currentShare = currentSeats / current;
    const proposedShare = proposedSeats / proposed;
    const shift = (proposedShare - currentShare) / Math.max(.03, currentShare);
    let support = baseline;
    let reason = supported ? "Party membership and regional organization support this change."
      : scale >= .35 ? "Party organization does not support a change this large." : "Open to a smaller change to Congress.";
    if (!currentSeats) {
      reason = "Would gain representation and has no vote in this Congress.";
    } else if (!proposedSeats) {
      support = 0;
      reason = "Would lose all representation.";
    } else if (shift < -1e-8) {
      support -= .53 * Math.min(1, -shift);
      reason = "Would lose a share of Congress and resists losing influence.";
    } else if (shift > 1e-8) {
      support += .53 * Math.min(1, shift);
      reason = !supported && scale >= .35
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
      const cash = Math.round((15000 + 2000 * extraYes * gpmCongressDefaultSize / current)) / 1e6;
      bargains.push({ label: group.label, cash, extraYes, affordable: data.treasuryM >= cash });
    }
  }
  const details = { proposed, bargains, recommendation, forecastDay, effectiveDay };
  if (!bargainLabel) return { ...base, ...details };
  const offer = bargains.find(group => group.label === bargainLabel);
  if (!offer) return { ok: false, reason: "bargain" };
  if (!offer.affordable) return { ok: false, reason: "budget" };
  const { label, cash, extraYes } = offer;
  const negotiated = factions.map(group => group.label === label
    ? { ...group, yes: group.yes + extraYes, reason: group.reason + " An organizing grant brings some delegates over." }
    : group);
  return { ...partyCongressBallot("size", current, negotiated), ...details, bargain: { label, cash, extraYes } };
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
  const current = partyCongressSizeIsValid(data.size) ? data.size : gpmCongressDefaultSize;
  const factions = partyCongressFactions(data, current).filter(group => group.seats > 0)
    .sort((a, b) => a.forecastOrder - b.forecastOrder).map(group => {
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

function partyCongressAvailableProgrammes(data) {
  const families = new Set([data?.identity?.congressDoctrine?.family]);
  if (data?.membershipBacked && data.profiles?.length && partyCongressSizeIsValid(data.size)) {
    for (const group of partyCongressFactions(data, data.size)) {
      if (group.seats <= 0 || !group.doctrineId) continue;
      const family = gpmCongressDoctrine(group.doctrineId)?.family;
      if (family) families.add(family);
    }
  }
  return Object.fromEntries(Object.entries(partyCongressProgrammes()).filter(([, choice]) =>
    !choice.family || families.has(choice.family)));
}

function partyCongressIssueAffinity(positions, choice) {
  const stance = positions?.[choice.issue];
  return Number.isFinite(stance) ? 1 - Math.abs(stance - choice.value) : 0;
}

function partyCongressProgrammeVote(data, programme) {
  const choices = partyCongressAvailableProgrammes(data);
  const choice = Object.hasOwn(choices, programme) ? choices[programme] : null;
  if (!choice || !data) return { ok: false, reason: "unavailable" };
  if (data.programme) return { ok: false, reason: "active", nextVoteDay: data.programme.untilDay };
  if (data.day < data.nextProgrammeVoteDay) {
    return { ok: false, reason: "cooldown", nextVoteDay: data.nextProgrammeVoteDay };
  }
  const current = partyCongressSizeIsValid(data.size) ? data.size : gpmCongressDefaultSize;
  const endorsements = new Map((data.factionEndorsements || []).filter(offer => offer.programme === programme)
    .map(offer => [offer.label, offer.extraYes]));
  const factions = partyCongressFactions(data, current).filter(group => group.seats > 0)
    .sort((a, b) => a.forecastOrder - b.forecastOrder).map(group => {
    const alignment = choice.issue ? partyCongressIssueAffinity(group.positions, choice) : choice.direction * group[choice.axis] / group.weight;
    const support = Math.max(0, Math.min(1, .55 + .40 * alignment));
    let reason = alignment > .12 ? "This programme fits the faction’s politics." :
      alignment < -.12 ? "The faction favors different policy priorities." : "The faction is open to this programme.";
    if (choice.issue) {
      const target = choice.issueLabel || choice.label;
      reason = !Number.isFinite(group.positions?.[choice.issue]) ? "No recorded stance on " + target + "."
        : alignment >= .55 ? "Its position on " + target + " supports this proposal."
        : alignment <= -.43 ? "This crosses its red line on " + target + "."
        : "Its position on " + target + " is open to compromise.";
    }
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
    [...vote.factions].sort((a, b) => (a.forecastOrder ?? 0) - (b.forecastOrder ?? 0))
      .map(({ label, currentSeats, proposedSeats, yes }) => [label, currentSeats, proposedSeats, yes]),
    ...(vote.kind === "size" ? [vote.forecastDay, vote.effectiveDay] : []),
  ]);
}

function partyCongressActiveProgramme(party, day) {
  const programme = party.gpmCongressSizeState?.programme;
  return programme && Object.hasOwn(partyCongressProgrammes(), programme.kind) && day < programme.untilDay
    ? programme : null;
}

function partyCongressProgrammeLawBonus(party, lawId, day, target) {
  const programme = partyCongressActiveProgramme(party, day);
  if (!programme) return 0;
  const choice = partyCongressProgrammes()[programme.kind];
  if (!choice.laws.includes(lawId)) return 0;
  if (!choice.lawTargets || target === undefined) return 1;
  return fo(choice.lawTargets[lawId], target) ? 1 : 0;
}

function partyCongressEligible(party) {
  return !!party?.organization && party.legal !== false && !party.gpmUprisingShell && !party.gpmUprisingExcluded;
}

function applyPartyCongressVote(sim, country, party, kind, input, data = null) {
  if (!partyCongressEligible(party)) return { ok: false, reason: "party" };
  if (kind === "size" && input.bargain != null && typeof input.bargain !== "string") {
    return { ok: false, reason: "bargain" };
  }
  const saved = party.gpmCongressSizeState;
  const pending = saved?.pendingResize;
  const previous = saved?.lastVote;
  if (kind === "size" && input.expected != null && previous?.forecastKey === input.expected &&
      previous.proposed === input.size && (previous.bargain?.label || "") === (input.bargain || "")) {
    const { forecastKey, ...vote } = previous;
    return { ...vote, changed: false, pendingResize: pending ?? null, size: saved.size };
  }
  data ??= partyCongressView(sim, country, party.id);
  const forecast = kind === "size" ? partyCongressSizeVote(data, input.size, input.bargain)
    : kind === "priority" ? partyCongressPriorityVote(data, input.priority)
      : kind === "programme" ? partyCongressProgrammeVote(data, input.programme) : { ok: false, reason: "unavailable" };
  if (!forecast.ok && forecast.reason === "pending") return forecast;
  const forecastKey = input.expected != null ? partyCongressForecastKey(forecast) : null;
  if (input.expected != null && input.expected !== forecastKey) return { ok: false, reason: "stale" };
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
    if (vote.passed) {
      state.pendingResize = { size: vote.proposed, approvedDay: data.day, effectiveDay: vote.effectiveDay, deferred: null };
    }
    state.nextSizeVoteDay = vote.nextVoteDay;
    state.lastVote = { ...vote, forecastKey };
    return { ...vote, pendingResize: state.pendingResize ?? null, size: state.size };
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
  const party = sL(country, partyId);
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
    J7t(verb, {
      apply(sim, country, input) {
        if (country.key !== sim.playerKey || fn(country) !== input.partyId) return { ok: false, reason: "party" };
        return applyPartyCongressVote(sim, country, sL(country, input.partyId), kind, input);
      },
    });
  }
}

module.exports = {
  sharedFunctions: [
    `const gpmCongressProgrammes = {...${JSON.stringify(congressProgrammes)}, ...gpmCongressDoctrineProposals};`,
    `const gpmCongressFactionTitles = ${JSON.stringify(factionTitles)};`,
    `const gpmCongressRecognitionPercent = ${gpmCongressRecognitionPercent};`,
    `const gpmCongressSizeMin = ${gpmCongressSizeMin}, gpmCongressSizeMax = ${gpmCongressSizeMax}, gpmCongressDefaultSize = ${gpmCongressDefaultSize};`,
    partyCongressFactionLabel, partyCongressFactionId, partyCongressProfileDoctrine,
    partyCongressPlatformTradition, partyCongressSizeIsValid, partyCongressSizeRecommendation, partyCongressRecognitionSeats,
    partyCongressFactions, partyCongressBallot, partyCongressSizeVote,
    partyCongressPriorityIsValid, partyCongressPriorityVote,
    partyCongressProgrammes, partyCongressAvailableProgrammes, partyCongressIssueAffinity, partyCongressProgrammeVote, partyCongressForecastKey,
  ],
  workerFunctions: [partyCongressPriorityCost, partyCongressActivePriority, partyCongressActiveProgramme, partyCongressProgrammeLawBonus,
    partyCongressEligible, applyPartyCongressVote, partyCongressAgenda, registerPartyCongressSize],
};

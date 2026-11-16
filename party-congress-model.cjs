"use strict";

function partyCongressIdeology(ideal) {
  if (!gpmAxes.every(({ id }) => Number.isFinite(ideal?.[id]) && Math.abs(ideal[id]) <= 1)) return null;
  return Object.fromEntries(gpmAxes.map(({ id }) => [id, ideal[id]]));
}

function partyCongressOrganizationSize(sim, country, party) {
  const members = gpmDomesticMembership(party).members;
  const record = party.gpmRegional;
  const rules = gpmCampaignRulesFor(sim);
  let regions = 0;
  let totalRegions = 0;
  for (const province of Ih(sim, country.key)) {
    const { __provId: id, __provKey: key } = province;
    if (!partyRegionalProvince(sim, country, id, key)) continue;
    totalRegions++;
    if (partyRegionalPresence(record?.regions?.[key], sim.day, rules) >= .10 ||
        partyRegionalHeadquartersWeight(record, key) > 0) regions++;
  }
  return partyCongressSizeRecommendation(members, regions, totalRegions);
}

function partyCongressView(sim, country, partyId, electorate, people = sim.people?.values?.() || [], factionData = null, legacyProjection = false) {
  const party = pW(country, partyId);
  if (!party) return null;

  const saved = party.gpmCongressSizeState;
  const size = partyCongressSizeIsValid(saved?.size) ? saved.size : gpmCongressDefaultSize;
  const day = sim.day || 0;
  const pendingResize = saved?.pendingResize ?? null;
  const overview = {
    size, day, treasuryM: party.organization?.treasuryM ?? 0,
    pendingResize, nextReviewDay: pendingResize?.effectiveDay ?? party.gpmFactionPolitics?.nextReviewDay ?? null,
    sizeRecommendation: partyCongressOrganizationSize(sim, country, party),
    lastVote: saved?.lastVote ?? null, lastPriorityVote: saved?.lastPriorityVote ?? null,
    nextSizeVoteDay: saved?.nextSizeVoteDay ?? 0, nextPriorityVoteDay: saved?.nextPriorityVoteDay ?? 0,
    priority: partyCongressActivePriority(party, day),
    lastProgrammeVote: saved?.lastProgrammeVote ?? null,
    nextProgrammeVoteDay: saved?.nextProgrammeVoteDay ?? 0,
    programme: partyCongressActiveProgramme(party, day),
    identity: gpmPartyIdentity(party), membershipBacked: !legacyProjection,
    factionDelegateFactors: gpmFactionDelegateFactors(party.gpmFactionPolitics),
    factionLegacyAssignments: party.gpmFactionPolitics?.legacyAssignments,
    factionLegacyProtectedLabels: party.gpmFactionPolitics?.legacyProtectedLabels,
    ...factionData,
    factionEndorsements: factionData?.factionEndorsements ??
      (typeof gpmFactionEndorsements === "function" ? gpmFactionEndorsements(sim, country, party) : []),
  };
  const compatible = new Set(gpmCongressCurrentDoctrines(overview.identity).map(doctrine => doctrine.id));
  const figures = [];
  for (const person of people) {
    if (person?.party !== partyId || person.alive === false || person.gpmFactionGenerated || person.gpmFactionDetached ||
      String(person.countryKey) !== String(country.key)) continue;
    figures.push({
      name: person.styledName || person.name || "",
      id: person.id,
      ideology: partyCongressIdeology(person.ideal),
      doctrineId: compatible.has(person.gpmCongressDoctrineId) ? person.gpmCongressDoctrineId : null,
    });
  }

  const platform = partyCongressIdeology(party.ideology);
  if (!platform) return { ...overview, profiles: [], figures };

  const profiles = legacyProjection ? partyCongressLegacyProfiles(sim, country, party, electorate, overview.identity, platform, figures)
    : gpmCongressCurrentProfiles(sim, party, overview.identity, platform, figures, overview.sizeRecommendation.members);
  const congress = { ...overview, profiles, figures };
  if (factionData && !legacyProjection) {
    congress.currents = gpmCongressCurrentOptions(sim, country, party, overview.identity, overview.sizeRecommendation);
    if (typeof partyCongressCharterView === "function") congress.charter = partyCongressCharterView(sim, country, party, congress);
  }
  if (congress.bargaining?.factions.length) {
    const titles = new Map(partyCongressFactions(congress, size).map(group => [group.label, group.displayLabel]));
    congress.bargaining = { ...congress.bargaining, factions: congress.bargaining.factions.map(faction => ({
      ...faction, displayLabel: titles.get(faction.label) || partyCongressFactionLabel(faction.label),
    })) };
  }
  return congress;
}

function partyCongressLegacyProfiles(sim, country, party, electorate, identity, platform, figures) {
  // Reconstruct pre-affiliation profiles only to migrate already existing faction records.
  const supportPool = identity.congressDoctrine ? .38 : .45;
  const figurePool = .10;
  const blocInfluence = .70;
  const blocIdeals = new Map(vCe(country).map(group => [group.id, group.ideal]));
  const votingPressure = country.pol?.gpmPoliticalCrisis?.weights;
  if (votingPressure && Object.keys(votingPressure).length) electorate = partyCongressPlanningData(sim, country).electorate;
  const support = partySupportBaseView(sim, country, party.id, electorate);
  const evidence = [];
  for (const bloc of support?.blocs || []) {
    if (bloc.shareOfSupport <= 0) continue;
    const ideal = partyCongressIdeology(blocIdeals.get(bloc.id));
    if (!ideal) continue;
    const ideology = Object.fromEntries(gpmAxes.map(({ id }) => [
      id, platform[id] * (1 - blocInfluence) + ideal[id] * blocInfluence,
    ]));
    evidence.push({ origin: "supporter-estimate", sourceId: bloc.id, ideology, weight: supportPool * bloc.shareOfSupport });
  }
  // Member strength changes Congress only where the party has actually organized in a voter bloc.
  const membershipShare = .35 * Math.min(1, gpmDomesticMembership(party).members / Math.max(250, (country.pop || 0) * 75));
  if (membershipShare > 0 && evidence.length) {
    const organized = evidence.map(profile => ({ ...profile, origin: "membership", weight: profile.weight * Math.max(
      party.gpmOrganizing?.groups?.[profile.sourceId] || 0, party.outreach?.networks?.[profile.sourceId] || 0) }));
    const organization = organized.reduce((sum, profile) => sum + profile.weight, 0);
    if (organization > 0) {
      const pool = membershipShare * evidence.reduce((sum, profile) => sum + profile.weight, 0);
      for (const profile of evidence) profile.weight *= 1 - membershipShare;
      for (const profile of organized) {
        if (profile.weight > 0) evidence.push({ ...profile, weight: pool * profile.weight / organization });
      }
    }
  }
  if (figures.length) {
    const weight = figurePool / figures.length;
    for (const figure of figures) {
      if (figure.ideology) evidence.push({ origin: "person", sourceId: figure.id, ideology: figure.ideology, weight });
    }
  }

  const platformWeight = 1 - evidence.reduce((sum, profile) => sum + profile.weight, 0);
  return [{ origin: "platform", sourceId: party.id, ideology: platform, weight: platformWeight }, ...evidence];
}

function retirePartyCongress(party) {
  if (!party.gpmCongress) return;
  const { active } = party.gpmCongress;
  const organization = party.organization;
  if (active && organization) {
    if (Number.isFinite(active.activistsK) && active.activistsK > 0) {
      organization.activistsK = dW(Math.min(1e5, (organization.activistsK || 0) + active.activistsK));
    }
    if (Number.isFinite(active.cash) && active.cash > 0) {
      const treasury = Math.min(ope, (organization.treasuryM || 0) + active.cash);
      organization.treasuryM = Math.round(treasury * 1e6) / 1e6;
    }
  }
  delete party.gpmCongress;
}

function partyCongressPlanningData(sim, country) {
  let index = gpmCongressPlanningCache.get(sim);
  if (index?.day !== sim.day) {
    index = { day: sim.day, countries: new Map(), people: new Map() };
    for (const person of sim.people?.values?.() || []) {
      if (person?.alive === false || !person?.party) continue;
      const key = String(person.countryKey);
      const people = index.people.get(key) || [];
      people.push(person);
      index.people.set(key, people);
    }
    gpmCongressPlanningCache.set(sim, index);
  }
  if (!index.countries.has(country.key)) {
    index.countries.set(country.key, {
      electorate: sim._electorateBreakdown(country, false),
      people: index.people.get(String(country.key)) || [],
    });
  }
  return index.countries.get(country.key);
}

function advancePartyCongressAI(sim, country, party, policy) {
  if (!partyCongressEligible(party)) return null;
  const day = sim.day || 0;
  const state = party.gpmCongressSizeState;
  const canResize = !state?.pendingResize && day >= (state?.nextSizeVoteDay || 0) &&
    day - (state?.lastVote?.day ?? -365) >= 365;
  const canPrioritize = !partyCongressActivePriority(party, day) && day >= (state?.nextPriorityVoteDay || 0);
  const canAdoptProgramme = !partyCongressActiveProgramme(party, day) && day >= (state?.nextProgrammeVoteDay || 0);
  const developmentDay = day % 14 === 0;
  if (!canResize && !canPrioritize && !canAdoptProgramme && !developmentDay) return null;
  const planning = partyCongressPlanningData(sim, country);
  const data = partyCongressView(sim, country, party.id, planning.electorate, planning.people);
  if (!data) return null;

  if (canAdoptProgramme) {
    const endorsed = new Set(data.factionEndorsements.map(offer => offer.programme));
    const candidates = Object.entries(partyCongressAvailableProgrammes(data)).filter(([, choice]) =>
      choice.laws?.some(id => country.laws?.[id] != null))
      .map(([id]) => partyCongressProgrammeVote(data, id))
      .filter(vote => vote.ok && vote.passed)
      .sort((a, b) => Number(endorsed.has(b.programme)) - Number(endorsed.has(a.programme)) ||
        b.yes - a.yes || a.programme.localeCompare(b.programme));
    if (candidates.length) return applyPartyCongressVote(sim, country, party, "programme",
      { programme: candidates[0].programme }, data);
  }
  if (canPrioritize && (party.organization.treasuryM >= .012 || (party.gpmRegional?.projects || []).length)) {
    const electionIn = Object.values(st(country)?.contests || {}).reduce((days, contest) =>
      Number.isFinite(contest.nextDay) && contest.nextDay >= day ? Math.min(days, contest.nextDay - day) : days, Infinity);
    const order = electionIn <= 75 ? ["rally", "investment"] : ["investment", "rally"];
    const priority = order.find(kind => partyCongressPriorityVote(data, kind).passed);
    if (priority) return applyPartyCongressVote(sim, country, party, "priority", { priority }, data);
  }
  const recommendation = data.sizeRecommendation;
  if (!canResize || (data.size >= recommendation.min && data.size <= recommendation.max)) {
    if (!developmentDay) return null;
    const charter = typeof advancePartyCongressCharterAI === "function" ? advancePartyCongressCharterAI(sim, country, party, data) : null;
    return charter ?? gpmCongressOrganizeCurrentAI(sim, country, party, data, policy);
  }
  const desiredSize = recommendation.size;
  const vote = partyCongressSizeVote(data, desiredSize);
  if (!vote.ok) return null;
  if (vote.passed) return applyPartyCongressVote(sim, country, party, "size", { size: desiredSize }, data);
  if (typeof gpmDomesticCanCommit !== "function") return null;
  const offer = vote.bargains.filter(grant => grant.affordable && vote.yes + grant.extraYes >= vote.needed)
    .sort((a, b) => a.cash - b.cash || a.label.localeCompare(b.label))
    .find(grant => gpmDomesticCanCommit(sim, country, party, { cashM: grant.cash, activistsK: 0, influence: 0 }, policy));
  return offer ? applyPartyCongressVote(sim, country, party, "size", { size: desiredSize, bargain: offer.label }, data) : null;
}

module.exports = { workerFunctions: [
  "const gpmCongressPlanningCache = new WeakMap();", partyCongressIdeology, partyCongressOrganizationSize, partyCongressView, partyCongressLegacyProfiles, retirePartyCongress,
  partyCongressPlanningData, advancePartyCongressAI,
] };

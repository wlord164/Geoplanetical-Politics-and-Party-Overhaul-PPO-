"use strict";

function gpmCongressCurrentState(party) {
  return party.gpmCongressCurrents ??= { version: 1, affiliations: {}, legacy: [] };
}

function gpmCongressCurrentDoctrines(identity) {
  const congress = identity?.congressDoctrine ?? identity?.currentCompatibility;
  if (!congress) return [];
  return [...new Set([congress.platform, ...(congress.wings || [])])].map(gpmCongressDoctrine).filter(Boolean);
}

function gpmCongressLegacyCurrents(sim, party, identity) {
  const politics = party.gpmFactionPolitics;
  const day = sim.day || 0;
  const activeProgramme = partyCongressActiveProgramme(party, day);
  const programmeRows = party.gpmCongressSizeState?.lastProgrammeVote?.factions || [];
  const size = party.gpmCongressSizeState?.size ?? gpmCongressDefaultSize;
  return Object.values(politics?.factions || {}).flatMap(faction => {
    if (!(faction.seats > 0) || faction.doctrineId && faction.doctrineId === identity.congressDoctrine?.platform) return [];
    const ideology = partyCongressIdeology(faction.ideology) || partyCongressIdeology(party.ideology);
    if (!ideology) return [];
    const terms = (politics.offers || []).filter(offer => offer.status === "accepted" && offer.factionId === faction.id);
    const programmeEnd = activeProgramme && programmeRows.some(row => row.label === faction.label) ? activeProgramme.untilDay : 0;
    const untilDay = Math.max(faction.leadership?.termEndDay || 0, programmeEnd, ...terms.map(offer => offer.deadlineDay || 0));
    return untilDay > day ? [{ label: faction.label, doctrineId: faction.doctrineId, ideology,
      share: Math.min(1, faction.seats / size), untilDay }] : [];
  });
}

function gpmCongressMigrateCurrents(sim) {
  for (const country of sim.countries.values()) {
    for (const party of country.pol?.parties || []) {
      if (!party.gpmFactionPolitics || party.gpmCongressCurrents) continue;
      const legacy = gpmCongressLegacyCurrents(sim, party, gpmPartyIdentity(party));
      gpmCongressCurrentState(party).legacy = legacy;
    }
  }
}

function gpmCongressActiveAffiliations(party, identity, activeMembers) {
  const counts = party.gpmCongressCurrents?.affiliations || {};
  const compatible = new Set(gpmCongressCurrentDoctrines(identity).map(doctrine => doctrine.id));
  const rows = Object.entries(counts).filter(([id, members]) => compatible.has(id) && Number.isSafeInteger(members) && members > 0);
  const total = rows.reduce((sum, [, members]) => sum + members, 0);
  if (total <= activeMembers) return rows;
  return rows.map(([id, members]) => [id, Math.floor(activeMembers * members / total)]).filter(([, members]) => members > 0);
}

function gpmCongressRetainMembers(party, previousMembers, activeMembers) {
  const affiliations = party?.gpmCongressCurrents?.affiliations;
  if (!affiliations || !(previousMembers > 0) || activeMembers >= previousMembers) return;
  for (const [id, members] of Object.entries(affiliations)) {
    const remaining = Math.floor(activeMembers * members / previousMembers);
    if (remaining > 0) affiliations[id] = remaining;
    else delete affiliations[id];
  }
}

function gpmCongressTransferAffiliations(source, target, moved, originalMembers) {
  const affiliations = source?.gpmCongressCurrents?.affiliations;
  if (!affiliations || !(moved > 0) || !(originalMembers > 0)) return;
  const compatible = new Set(gpmCongressCurrentDoctrines(gpmPartyIdentity(target)).map(doctrine => doctrine.id));
  const rows = Object.entries(affiliations).sort(([left], [right]) => left.localeCompare(right));
  let remaining = moved;
  for (const [id, members] of rows) {
    const transferred = Math.min(remaining, Math.floor(moved * members / originalMembers));
    if (!transferred) continue;
    remaining -= transferred;
    if (members === transferred) delete affiliations[id];
    else affiliations[id] = members - transferred;
    if (compatible.has(id)) {
      const destination = gpmCongressCurrentState(target).affiliations;
      destination[id] = (destination[id] || 0) + transferred;
    }
  }
}

function gpmCongressCurrentProfiles(sim, party, identity, platform, figures, activeMembers) {
  const platformId = identity.congressDoctrine?.platform;
  const profiles = [{ origin: "platform", sourceId: party.id, doctrineId: platformId, ideology: platform, weight: 0 }];
  const affiliations = gpmCongressActiveAffiliations(party, identity, activeMembers);
  const representedMembers = affiliations.reduce((sum, [, members]) => sum + members, 0);
  // The founding slate gives a new party a represented platform even before it enrolls members.
  const unaligned = Math.max(100, activeMembers - representedMembers);
  const day = sim.day || 0;
  const legacy = party.gpmCongressCurrents?.legacy || gpmCongressLegacyCurrents(sim, party, identity);
  const validLegacy = legacy.filter(slate => slate.untilDay > day);
  const scale = Math.max(1, validLegacy.reduce((sum, slate) => sum + slate.share, 0));
  let legacyShare = 0;
  for (const slate of validLegacy) {
    const weight = unaligned * slate.share / scale;
    legacyShare += weight;
    profiles.push({ origin: "legacy", legacyLabel: slate.label, doctrineId: slate.doctrineId, ideology: slate.ideology, weight });
  }
  profiles[0].weight = Math.max(0.001, unaligned - legacyShare);
  for (const [id, members] of affiliations) {
    profiles.push({ origin: "membership", doctrineId: id, ideology: gpmCongressDoctrine(id).axes, weight: members });
  }
  for (const figure of figures) {
    if (!figure.doctrineId) continue;
    profiles.push({ origin: "person", sourceId: figure.id, doctrineId: figure.doctrineId,
      ideology: gpmCongressDoctrine(figure.doctrineId).axes, weight: 1 });
  }
  return profiles;
}

function gpmCongressCurrentQuote(sim, country, party, doctrine, identity, organization, activeMembers, affiliatedMembers) {
  const state = party.gpmCongressCurrents;
  const day = sim.day || 0;
  const platform = identity.congressDoctrine?.platform ?? identity.currentCompatibility?.platform;
  const isPlatform = doctrine.id === platform;
  const requiredRegions = Math.max(1, Math.min(organization.totalRegions,
    party.gpmCongressCharter?.branchAutonomy?.value === "autonomous" ? 1 : 2));
  const activistsK = zL(Math.max(.003, Math.min(.055, activeMembers / 180000)));
  const cashM = gpmDomesticMoney(.0015 + activistsK * .30);
  const cost = { cashM, activistsK, influence: 0 };
  const restricted = partyForeignFundingGrants(party.gpmForeignFunding).reduce((sum, grant) => sum + grant.unspentM, 0);
  let reason = null;
  if (!partyCongressEligible(party) || !gpmDomesticEligibleParty(country, party)) reason = "party";
  else if (isPlatform) reason = "platform";
  else if (activeMembers < 20) reason = "membership";
  else if (organization.regions < requiredRegions) reason = "branches";
  else if (day < (state?.last?.day ?? -21) + 21) reason = "cooldown";
  else if (gpmDomesticMoney(party.organization.treasuryM - restricted) < cashM) reason = "budget";
  else if (party.organization.activistsK < activistsK) reason = "organizers";
  const expected = JSON.stringify([party.id, doctrine.id, day, activeMembers, affiliatedMembers,
    organization.regions, requiredRegions, cashM, activistsK, reason]);
  return { id: doctrine.id, label: doctrine.label, description: doctrine.description, eligible: !reason, reason,
    members: affiliatedMembers, regions: organization.regions, requiredRegions, cost, expected, isPlatform,
    nextDay: (state?.last?.day ?? -21) + 21 };
}

function gpmCongressCurrentOptions(sim, country, party, identity, organization) {
  const activeMembers = organization.members;
  const affiliations = new Map(gpmCongressActiveAffiliations(party, identity, activeMembers));
  return gpmCongressCurrentDoctrines(identity).map(doctrine => gpmCongressCurrentQuote(sim, country, party, doctrine,
    identity, organization, activeMembers, affiliations.get(doctrine.id) || 0));
}

function gpmCongressOrganizeCurrent(sim, country, party, input, policy = null) {
  if (!partyCongressEligible(party) || !gpmDomesticEligibleParty(country, party)) return { ok: false, reason: "party" };
  const previous = party.gpmCongressCurrents?.last;
  if (previous?.expected === input.expected && previous?.result.doctrineId === input.doctrineId) return { ...previous.result, changed: false };
  const identity = gpmPartyIdentity(party);
  const organization = partyCongressOrganizationSize(sim, country, party);
  const quote = gpmCongressCurrentOptions(sim, country, party, identity, organization).find(row => row.id === input.doctrineId);
  if (!quote) return { ok: false, reason: "incompatible" };
  if (!quote.eligible) return { ok: false, reason: quote.reason };
  if (quote.expected !== input.expected) return { ok: false, reason: "stale" };
  if (policy && !gpmDomesticCanCommit(sim, country, party, quote.cost, policy)) return { ok: false, reason: "budget" };
  const before = gpmDomesticMembership(party).members;
  gpmDomesticEarnMembers(sim, country, party, "current", quote.cost.activistsK);
  const recruited = gpmDomesticMembership(party).members - before;
  if (recruited <= 0) return { ok: false, reason: "capacity" };
  const state = gpmCongressCurrentState(party);
  const members = (state.affiliations[quote.id] || 0) + recruited;
  state.affiliations[quote.id] = members;
  party.organization.treasuryM = partyForeignFundingTreasury(party,
    gpmDomesticMoney(party.organization.treasuryM - quote.cost.cashM));
  party.organization.activistsK = zL(party.organization.activistsK - quote.cost.activistsK);
  gpmDomesticReceipt(sim, country, party, "congress-current", { cashM: -quote.cost.cashM, activistsK: -quote.cost.activistsK,
    details: quote.id });
  const result = { ok: true, changed: true, doctrineId: quote.id, label: quote.label, members, recruited };
  state.last = { day: sim.day || 0, expected: input.expected, result };
  return result;
}

function gpmCongressOrganizeCurrentAI(sim, country, party, data, policy) {
  if (!policy || data.sizeRecommendation.regions < 2 || data.sizeRecommendation.members < 100 ||
      (party.gpmCongressCurrents?.last?.day ?? -90) + 90 > sim.day) return null;
  const founder = gpmCongressDoctrine(data.identity.congressDoctrine?.platform ?? data.identity.currentCompatibility?.platform);
  if (!founder) return null;
  const matching = Fwe(country);
  const options = gpmCongressCurrentOptions(sim, country, party, data.identity, data.sizeRecommendation);
  const ranked = options.filter(option => option.eligible).map(option => {
    const doctrine = gpmCongressDoctrine(option.id);
    if (doctrine.explicitOrganization && !option.members) return { option, fit: 0 };
    const fit = matching.reduce((sum, group) => {
      const contacts = Math.max(party.gpmOrganizing?.groups?.[group.id] || 0, party.outreach?.networks?.[group.id] || 0);
      if (!(contacts > 0) || !group.ideal) return sum;
      const distance = candidate => gpmAxes.reduce((square, { id }) => square + (group.ideal[id] - candidate.axes[id]) ** 2, 0);
      return sum + contacts * group.share * Math.max(0, distance(founder) - distance(doctrine));
    }, 0);
    return { option, fit };
  }).filter(row => row.fit >= .005).sort((left, right) => right.fit - left.fit || left.option.id.localeCompare(right.option.id));
  for (const { option } of ranked) {
    if (!gpmDomesticCanCommit(sim, country, party, option.cost, policy)) continue;
    return gpmCongressOrganizeCurrent(sim, country, party, { doctrineId: option.id, expected: option.expected }, policy);
  }
  return null;
}

function registerPartyCongressCurrents() {
  n5t("gpm.party.currentOrganize", {
    apply(sim, country, input) {
      if (country.key !== sim.playerKey || Uo(country) !== input.partyId) return { ok: false, reason: "party" };
      return gpmCongressOrganizeCurrent(sim, country, YL(country, input.partyId), input);
    },
  });
}

module.exports = { workerFunctions: [gpmCongressCurrentState, gpmCongressCurrentDoctrines, gpmCongressLegacyCurrents,
  gpmCongressMigrateCurrents, gpmCongressActiveAffiliations, gpmCongressRetainMembers, gpmCongressTransferAffiliations,
  gpmCongressCurrentProfiles, gpmCongressCurrentQuote, gpmCongressCurrentOptions, gpmCongressOrganizeCurrent,
  gpmCongressOrganizeCurrentAI, registerPartyCongressCurrents] };

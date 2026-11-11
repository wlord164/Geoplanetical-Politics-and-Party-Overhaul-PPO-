"use strict";

function partyModAIBlocFit(party, group) {
  let distance = 0;
  for (const axis of ["econ", "social", "gov", "nat"]) {
    distance += ((party.ideology?.[axis] || 0) - (group.ideal?.[axis] || 0)) ** 2;
  }
  return .55 + .45 * Math.exp(-distance);
}

function partyModAICanCommit(party, quote, electionIn) {
  if (!quote?.ok) return false;
  const { treasuryM, activistsK, influence } = party.organization;
  const preparingCampaign = electionIn <= 150;
  const cashShare = preparingCampaign ? .3 : .5;
  const cashReserve = preparingCampaign ? .075 : .02;
  const activistShare = preparingCampaign ? .3 : .5;
  return quote.cash <= Math.min(treasuryM * cashShare, treasuryM - cashReserve) &&
    quote.activistsK <= activistsK * activistShare &&
    (!quote.influence || influence >= quote.influence + (preparingCampaign ? 12 : 5));
}

function partyModAIOrganizing(sim, country, party, groups, movements, electionIn) {
  const blocs = new Map(groups.map(group => [group.id, group.share * partyModAIBlocFit(party, group)]));
  let best = null;
  function consider(kind, targetId) {
    const quote = partyOrganizingQuote(sim, country, party.id, kind, targetId, groups);
    if (!partyModAICanCommit(party, quote, electionIn)) return;
    const gain = quote.effects.reduce((sum, effect) =>
      sum + effect.increase * (blocs.get(effect.id) || 0), 0);
    if (gain < .0015) return;
    const cost = 1 + quote.cash / party.organization.treasuryM +
      quote.activistsK / party.organization.activistsK;
    const score = gain / cost;
    if (!best || score > best.score || (score === best.score && targetId < best.targetId)) {
      best = { kind, targetId, score };
    }
  }
  const record = party.gpmOrganizing;
  const day = sim.day || 0;
  if (day - (record?.lastMeeting ?? -Infinity) >= 30) {
    for (const group of groups) consider("meeting", group.id);
  }
  if (day - (record?.lastBacking ?? -Infinity) >= 60) {
    for (const movement of movements) consider("movement", movement.id);
  }
  return best;
}

function advancePartyModAI(sim, country) {
  const day = sim.day || 0;
  let electionIn = Infinity;
  for (const contest of Object.values(ot(country)?.contests || {})) {
    if (Number.isFinite(contest.nextDay) && contest.nextDay >= day) {
      electionIn = Math.min(electionIn, contest.nextDay - day);
    }
  }
  // Give parties a buffer for resources before the native campaign opens.
  if (electionIn <= 90) return;
  const groups = dIe(country);
  if (!groups.length) return;
  const movements = (country.domestic?.movements || []).filter(peacefulPartyMovement);
  for (const party of country.pol?.parties || []) {
    if (!party.organization || party.legal === false || JNr(sim, country, party.id)) continue;
    const action = partyModAIOrganizing(sim, country, party, groups, movements, electionIn);
    if (action) applyPartyOrganizing(sim, country, party.id, action.kind, action.targetId);
  }
}

module.exports = {
  workerFunctions: [partyModAIBlocFit, partyModAICanCommit, partyModAIOrganizing, advancePartyModAI],
};

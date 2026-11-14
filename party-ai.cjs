"use strict";

function partyModAIBlocFit(party, group) {
  let distance = 0;
  for (const axis of ["econ", "social", "gov", "nat"]) {
    distance += ((party.ideology?.[axis] || 0) - (group.ideal?.[axis] || 0)) ** 2;
  }
  return .55 + .45 * Math.exp(-distance);
}

function partyModAICampaignReserve(sim, country, party, contest) {
  if (!contest?.id || contest.nextDay - sim.day > 120) return null;
  const { treasuryM, activistsK } = party.organization;
  const cash = Math.min(treasuryM, Math.max(.05, EMa(country, party) * .45));
  const assigned = Math.min(activistsK, Math.max(.05, OMa(country, party) * .45));
  if (cash < .05 && assigned < .05 || party.organization.influence < ZKe) return null;
  const active = nE(country, party, sim.day, contest.id);
  const points = doo(sim, country, party, active, cash, assigned);
  const forecast = partyCampaignForecast(sim, country, party.id, contest.id, points, { day: contest.nextDay });
  if (!forecast || forecast.delta < .00001) return null;
  const missing = Math.min(forecast.scoreCap - forecast.score, forecast.weightHeadroom);
  const operations = Math.max(1, Math.min(3, Math.ceil(missing / points), Math.ceil((contest.nextDay - sim.day) / 7)));
  return { cash: Math.min(treasuryM, cash * operations), activistsK: Math.min(activistsK, assigned * operations),
    influence: ZKe * operations, gain: forecast.delta };
}

function partyModAICanCommit(party, quote, electionIn, reserve = null) {
  if (!quote?.ok) return false;
  const { treasuryM, activistsK, influence } = party.organization;
  const openingParty = (party.support || 0) < .05;
  const returnsBeforeCampaign = quote.endDay - quote.startDay + Math.max(0, 60 - electionIn) <= 45;
  const keepActivists = reserve && !returnsBeforeCampaign ? reserve.activistsK : 0;
  const keepCash = reserve ? reserve.cash : openingParty ? .005 : .02;
  return quote.cash <= Math.min(treasuryM * (openingParty ? .7 : .5), treasuryM - keepCash) &&
    quote.activistsK <= Math.min(activistsK * (openingParty ? .85 : .55), activistsK - keepActivists) &&
    (!quote.influence || influence >= quote.influence + (reserve?.influence ?? 3));
}

function partyModAIOrganizing(sim, country, party, groups, movements, electionIn, contest, context) {
  const blocs = new Map(groups.map(group => [group.id, group.share * partyModAIBlocFit(party, group)]));
  const reserve = partyModAICampaignReserve(sim, country, party, contest);
  const candidates = [];
  let best = null;
  function consider(kind, targetId) {
    const quote = partyOrganizingQuote(sim, country, party.id, kind, targetId, groups);
    if (!partyModAICanCommit(party, quote, electionIn, reserve)) return;
    const gain = quote.effects.reduce((sum, effect) =>
      sum + (effect.increase + (effect.contacts || 0) * .4) * (blocs.get(effect.id) || 0), 0);
    if (gain > 0) candidates.push({ kind, targetId, quote, gain });
  }
  const record = party.gpmOrganizing;
  const day = sim.day || 0;
  if (day - (record?.lastMeeting ?? -Infinity) >= 30) {
    for (const group of groups) consider("meeting", group.id);
  }
  if (day - (record?.lastBacking ?? -Infinity) >= 60) {
    for (const movement of movements) consider("movement", movement.id);
  }
  const planning = gpmCampaignRulesFor(sim).aiPlanning;
  const count = planning === "strong" ? 3 : planning === "basic" ? 1 : 2;
  candidates.sort((a, b) => b.gain - a.gain || a.targetId.localeCompare(b.targetId));
  for (const candidate of candidates.slice(0, count)) {
    const { quote } = candidate;
    const through = Math.min(quote.endDay + 14, contest?.nextDay ?? Infinity);
    const forecast = partyOrganizingForecast(sim, country, party, quote, through, context);
    const gain = forecast?.gain || 0;
    if (gain < .000005) continue;
    let cost = 1 + quote.cash / party.organization.treasuryM + quote.activistsK / party.organization.activistsK;
    if (reserve && electionIn <= 60) {
      const share = quote.cash / Math.max(.00001, party.organization.treasuryM - reserve.cash + quote.cash);
      cost += share * reserve.gain / gain;
    }
    const score = gain / cost;
    if (score > (best?.score || 0)) best = { ...candidate, score };
  }
  return best;
}

function advancePartyModAI(sim, country) {
  const day = sim.day || 0;
  const contest = Object.values(Xe(country)?.contests || {}).filter(item =>
    Number.isFinite(item.nextDay) && item.nextDay >= day).sort((a, b) => a.nextDay - b.nextDay)[0];
  const electionIn = contest ? contest.nextDay - day : Infinity;
  advancePartyRegionalAI(sim, country, electionIn, contest);
  advancePartyForeignFundingAI(sim, country, electionIn);
  const groups = Fwe(country);
  if (!groups.length) return;
  const context = { blocs: sim._voterBlocs?.(country), groups: new Map(groups.map(group => [group.id, group])) };
  const movements = (country.domestic?.movements || []).filter(peacefulPartyMovement);
  for (const party of country.pol?.parties || []) {
    if (!party.organization || party.legal === false || party.gpmUprisingShell || party.gpmUprisingExcluded ||
        iGr(sim, country, party.id)) continue;
    const action = partyModAIOrganizing(sim, country, party, groups, movements, electionIn, contest, context);
    if (action) applyPartyOrganizing(sim, country, party.id, action.kind, action.targetId);
  }
}

module.exports = {
  workerFunctions: [partyModAIBlocFit, partyModAICampaignReserve, partyModAICanCommit, partyModAIOrganizing, advancePartyModAI],
};

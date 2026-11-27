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
  const cash = Math.min(treasuryM, Math.max(.05, eia(country, party) * .45));
  const assigned = Math.min(activistsK, Math.max(.05, tia(country, party) * .45));
  if (cash < .05 && assigned < .05 || party.organization.influence < Aze) return null;
  const active = OI(country, party, sim.day, contest.id);
  const points = GYr(sim, country, party, active, cash, assigned);
  const forecast = partyCampaignForecast(sim, country, party.id, contest.id, points, { day: contest.nextDay });
  if (!forecast || forecast.delta < .00001) return null;
  const missing = Math.min(forecast.scoreCap - forecast.score, forecast.weightHeadroom);
  const operations = Math.max(1, Math.min(3, Math.ceil(missing / points), Math.ceil((contest.nextDay - sim.day) / 7)));
  return { cash: Math.min(treasuryM, cash * operations), activistsK: Math.min(activistsK, assigned * operations),
    influence: Aze * operations, gain: forecast.delta };
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

function partyModAIOrganizing(sim, country, party, groups, movements, electionIn, contest, context, policy, reserve) {
  const blocs = new Map(groups.map(group => [group.id, group.share * partyModAIBlocFit(party, group)]));
  const candidates = [];
  let best = null;
  function consider(kind, targetId) {
    const quote = partyOrganizingQuote(sim, country, party.id, kind, targetId, groups);
    if (!quote.ok || !gpmDomesticCanCommit(sim, country, party,
      { cashM: quote.cash, activistsK: quote.activistsK, influence: quote.influence }, policy,
      { reserve, endDay: quote.endDay })) return;
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
    if (reserve.cashM > policy.reserveCashM && electionIn <= 60) {
      const share = quote.cash / Math.max(.00001, party.organization.treasuryM - reserve.cashM + quote.cash);
      cost += share;
    }
    const score = gain / cost;
    if (score > (best?.score || 0)) best = { ...candidate, score };
  }
  return best;
}

function gpmDomesticRenewOrganization(sim, country, party, policy, reserve, electionIn) {
  const organization = party.organization;
  const founding = xGe(country, party);
  const smallParty = (party.support || 0) < .07;
  const targetCash = Math.max(founding.treasuryM * 2, reserve.cashM + (smallParty ? .15 : .10));
  if (policy.autoFundraise && organization.treasuryM < targetCash) $je(sim, country, party.id);
  if (!policy.autoRecruit) return;
  const campaignRecruitment = electionIn <= 220 && policy.goal !== "build";
  const targetActivists = Math.max(founding.activistsK, smallParty ? .46 : 0,
    campaignRecruitment ? Math.min(2.4, Math.max(.9, reserve.activistsK * 1.5, tia(country, party) * 1.25)) : 0);
  const missing = targetActivists - organization.activistsK;
  if (missing <= .05) return;
  const cost = Math.min(organization.treasuryM, Math.max(.05, Math.min(campaignRecruitment ? .105 : .075,
    missing / (3 + organization.credibility * 4))));
  const budgetM = Math.floor(cost * 1000) / 1000;
  if (budgetM >= .05 && gpmDomesticCanCommit(sim, country, party, { cashM: budgetM }, policy, { reserve })) {
    Xna(sim, country, party.id, budgetM);
  }
}

function gpmDomesticOutreach(sim, country, party, groups, policy, reserve, electionIn) {
  if (party.outreach?.project || electionIn <= 80) return;
  const options = groups.map(group => ({
    id: group.id,
    score: group.share * partyModAIBlocFit(party, group) * (1 - (party.outreach?.networks?.[group.id] || 0)),
  })).sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
  for (const option of options) {
    const quote = K8t(sim, country, party.id, option.id);
    if (quote.ok && gpmDomesticCanCommit(sim, country, party, {
      cashM: quote.cost.budgetM, activistsK: quote.cost.activistsK, influence: quote.cost.influence,
    }, policy, { reserve, endDay: quote.effect.endDay })) {
      N8t(sim, country, party.id, option.id);
      return;
    }
  }
}

function gpmDomesticRunContest(sim, country, party, entry, policy) {
  const active = OI(country, party, sim.day, entry.contestId);
  if (!active || (active.lastActionDay != null && sim.day - active.lastActionDay < wz)) return;
  if (!active.promises.length) {
    const result = CPt(sim, country, party.id, jYr(sim, country, party), entry.contestId);
    if (result?.ok && result.promiseIds?.length) gpmDomesticReceipt(sim, country, party, "campaign-promises",
      { details: entry.contestId, staffDecision: true });
  }
  const reserve = gpmDomesticReserve(sim, country, party, policy, entry.contestId);
  const organization = party.organization;
  const spendingCap = policy.monthlyBudgetM == null ? Infinity : policy.monthlyBudgetM - gpmDomesticSpendThisMonth(sim, party);
  const days = entry.election.nextDay - sim.day;
  const effort = zYr(country, party, days, entry);
  const bareBudget = Math.max(.05, eia(country, party) * 1.4 * effort);
  const bareActivists = Math.max(.05, tia(country, party) * effort);
  const firstSeat = policy.goal === "firstSeat" && (party.support || 0) < .08;
  const cashM = Math.max(0, Math.floor(Math.min(organization.treasuryM - reserve.cashM,
    spendingCap, firstSeat ? Math.max(.055, bareBudget) : bareBudget) * 1000) / 1000);
  const availableActivists = organization.activistsK - reserve.activistsK;
  const remainingOperations = Math.max(1, Math.ceil(days / wz));
  const grassrootsEffort = .85 * availableActivists / remainingOperations;
  const activistsK = Math.max(0, Math.floor(Math.min(availableActivists,
    firstSeat ? Math.max(.225, bareActivists, grassrootsEffort) : bareActivists) * 1000) / 1000);
  const params = { contestId: entry.contestId, budgetM: cashM, activistsK };
  const quote = pye(sim, country, party.id, active, params);
  if (!quote.ok || !gpmDomesticCanCommit(sim, country, party, { cashM: quote.cost.treasuryM,
    activistsK: quote.cost.activistsK, influence: quote.cost.influence }, policy, { reserve })) return;
  const offset = FYr(sim, country, party, active) + ((organization.credibility ?? .5) - .5) * 12;
  if (Math.min(50, 35 - offset) <= (active.score || 0)) return;
  MPt(sim, country, party.id, params);
}

function gpmDomesticContestAI(sim, country, activeContests) {
  for (const party of country.pol?.parties || []) {
    const policy = gpmDomesticPolicy(sim, country, party);
    if (!policy) continue;
    const scheduled = gpmDomesticContestList(sim, country, policy);
    const focus = gpmDomesticFocusedContest(country, policy, scheduled);
    const order = scheduled.map(contest => contest.id);
    const entries = activeContests.filter(entry => !focus || entry.contestId === focus.id)
      .sort((left, right) => order.indexOf(left.contestId) - order.indexOf(right.contestId));
    gpmDomesticWithStaff(sim, country, party, () => {
      for (const entry of entries) gpmDomesticRunContest(sim, country, party, entry, policy);
    });
  }
}

function gpmDomesticReviewAgreements(sim, country, party, staff) {
  if (typeof advancePartyAgreementsAI !== "function") return;
  const before = staff ? partyAgreementState(country)?.current : null;
  const wasOffered = before?.status === "offered";
  const result = advancePartyAgreementsAI(sim, country, party);
  if (!staff || !result?.ok || !result.changed) return;
  const current = partyAgreementState(country)?.current;
  const kind = current?.status === "offered" ? "agreement-offered" :
    current?.status === "active" ? wasOffered ? "agreement-accepted" : "agreement-bill-tabled" : "agreement-declined";
  gpmDomesticReceipt(sim, country, party, kind,
    { details: (current || before)?.lawId, staffDecision: true });
}

function gpmDomesticReviewFunding(sim, country, party, electionIn, policy, staff) {
  const before = party.gpmForeignFunding;
  const pending = before?.pending;
  const last = before?.last;
  advancePartyForeignFundingAI(sim, country, electionIn, party, policy);
  if (!staff) return;
  const after = party.gpmForeignFunding;
  if (after?.pending && after.pending !== pending) {
    gpmDomesticReceipt(sim, country, party, "foreign-funding-request",
      { details: after.pending.donor?.countryKey, staffDecision: true });
  } else if (after?.last && after.last !== last && ["declined", "kept"].includes(after.last.status)) {
    const kind = after.last.status === "declined" ? "foreign-funding-declined" : "foreign-funding-kept";
    gpmDomesticReceipt(sim, country, party, kind,
      { details: after.last.donor?.countryKey, staffDecision: true });
  }
}

function advancePartyModAI(sim, country) {
  const day = sim.day || 0;
  gpmBindCampaignPolity(sim, country.pol);
  const groups = PUe(country);
  const context = { blocs: sim._voterBlocs?.(country), groups: new Map(groups.map(group => [group.id, group])) };
  const movements = (country.domestic?.movements || []).filter(peacefulPartyMovement);
  const parties = country.pol?.parties?.slice().sort((left, right) => left.id.localeCompare(right.id)) || [];
  for (const party of parties) {
    if (typeof gpmFactionAutomate === "function") {
      gpmDomesticWithStaff(sim, country, party, staff => gpmFactionAutomate(sim, country, party, staff ? "staff" : "ai"));
    }
    const policy = gpmDomesticPolicy(sim, country, party);
    if (!policy) continue;
    const contests = gpmDomesticContestList(sim, country, policy);
    const contest = gpmDomesticFocusedContest(country, policy, contests) || contests[0];
    const electionIn = contest ? contest.nextDay - day : Infinity;
    const reserve = gpmDomesticReserve(sim, country, party, policy);
    const before = party.gpmDomestic?.ledger?.[0];
    gpmDomesticWithStaff(sim, country, party, staff => {
      gpmDomesticRenewOrganization(sim, country, party, policy, reserve, electionIn);
      if (typeof advancePartyCongressAI === "function") {
        const vote = advancePartyCongressAI(sim, country, party, policy);
        if (staff && vote?.ok && vote.changed) {
          const topic = vote.kind === "size" ? `${vote.proposed} delegates` : vote.kind === "priority"
            ? vote.priority === "rally" ? "Regional rallies" : "Local investment"
            : partyCongressProgrammes()[vote.programme]?.label || "Party programme";
          gpmDomesticReceipt(sim, country, party, "congress-vote",
            { details: topic + (vote.passed ? " · Passed" : " · Failed"), staffDecision: true });
        }
      }
      gpmDomesticReviewAgreements(sim, country, party, staff);
      advancePartyRegionalAI(sim, country, electionIn, contest, party, policy);
      if (policy.allowForeignFunding) gpmDomesticReviewFunding(sim, country, party, electionIn, policy, staff);
      const action = partyModAIOrganizing(sim, country, party, groups, movements, electionIn, contest, context, policy, reserve);
      if (action) applyPartyOrganizing(sim, country, party.id, action.kind, action.targetId);
      if (!action || electionIn > 200) gpmDomesticOutreach(sim, country, party, groups, policy, reserve, electionIn);
      const state = gpmDomesticState(party);
      const updated = staff ? staff.actions > 0 : state.ledger?.[0] !== before;
      state.lastReview = { day, goal: policy.goal, reason: updated ? null : "no-eligible-priority", contestId: contest?.id || null,
        ...(staff ? { staffActions: staff.actions } : {}) };
    });
  }
}

module.exports = {
  workerFunctions: [partyModAIBlocFit, partyModAICampaignReserve, partyModAICanCommit, partyModAIOrganizing,
    gpmDomesticRenewOrganization, gpmDomesticOutreach, gpmDomesticRunContest, gpmDomesticContestAI, gpmDomesticReviewAgreements, gpmDomesticReviewFunding, advancePartyModAI],
};

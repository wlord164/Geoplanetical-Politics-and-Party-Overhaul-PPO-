"use strict";

const defaults = {
  enabled: false,
  goal: "firstSeat",
  targetProvinceKey: null,
  targetContestId: null,
  reserveCashM: .025,
  monthlyBudgetM: null,
  autoFundraise: true,
  autoRecruit: true,
  allowForeignFunding: false,
  allowForeignDonations: false,
};

const membershipTerms = {
  monthlyDues: 18,
  monthlyUpkeep: 5,
  monthlyDuesCap: 90000,
  monthlyRetention: .965,
  inactiveRetention: .89,
  votingWeight: .36,
  fullVotingMembers: 3500,
  projectMembers: { meeting: 2.4, movement: 1.4, outreach: 2.1, rally: 1, investment: 2.2, headquarters: 2.6, current: 1.8 },
};

function gpmDomesticMoney(amount) {
  return Math.round(amount * 1e6) / 1e6;
}

function gpmDomesticNormalizePlan(input) {
  const plan = { ...gpmDomesticDefaults };
  if (!input || typeof input !== "object") return plan;
  for (const key of ["enabled", "autoFundraise", "autoRecruit", "allowForeignFunding", "allowForeignDonations"]) {
    if (typeof input[key] === "boolean") plan[key] = input[key];
  }
  if (["build", "firstSeat", "defend"].includes(input.goal)) plan.goal = input.goal;
  for (const key of ["targetProvinceKey", "targetContestId"]) {
    if (typeof input[key] === "string" && /^[\w:?.-]{1,120}$/.test(input[key])) plan[key] = input[key];
  }
  if (Number.isFinite(input.reserveCashM)) plan.reserveCashM = gpmDomesticMoney(Math.max(0, Math.min(1000, input.reserveCashM)));
  if (Number.isFinite(input.monthlyBudgetM)) plan.monthlyBudgetM = gpmDomesticMoney(Math.max(0, Math.min(1000, input.monthlyBudgetM)));
  return plan;
}

function gpmDomesticEligibleParty(country, party, existing = false) {
  return Boolean(party?.organization && party.legal !== false && !party.gpmUprisingShell && !party.gpmUprisingExcluded &&
    country.pol?.parties?.includes(party) && (existing || !gpmOpeningNonparty(party)));
}

function gpmDomesticPlanFor(country, party) {
  const saved = party.gpmDomestic?.plan;
  if (saved) return gpmDomesticNormalizePlan(saved);
  const represented = country.pol?.chambers?.some(chamber => chamber.composition?.[party.id] > 0);
  return { ...gpmDomesticDefaults, goal: represented ? "defend" : "firstSeat" };
}

function gpmDomesticPolicy(sim, country, party) {
  if (!gpmDomesticEligibleParty(country, party)) return null;
  const plan = gpmDomesticPlanFor(country, party);
  if (ukr(sim, country, party.id)) return plan.enabled ? plan : null;
  return plan.enabled ? plan : { ...plan, enabled: true, allowForeignFunding: true, allowForeignDonations: true };
}

function gpmDomesticAllowsDonation(sim, country, party, existing = false) {
  if (!gpmDomesticEligibleParty(country, party, existing)) return false;
  const plan = gpmDomesticPlanFor(country, party);
  return ukr(sim, country, party.id) ? plan.allowForeignDonations : !plan.enabled || plan.allowForeignDonations;
}

function gpmDomesticDonationBudget(sim, country, party) {
  const policy = gpmDomesticPlanFor(country, party);
  const reserve = gpmDomesticReserve(sim, country, party, policy);
  const cap = policy.monthlyBudgetM == null ? Infinity : policy.monthlyBudgetM - gpmDomesticSpendThisMonth(sim, party);
  return gpmDomesticMoney(Math.max(0, Math.min(cap, party.organization.treasuryM - reserve.cashM)));
}

function gpmDomesticState(party) {
  return party.gpmDomestic ??= { version: 1, ledger: [] };
}

function gpmDomesticMembership(party) {
  return party.gpmDomestic?.membership || { members: 0, duesM: 0, upkeepM: 0, netM: 0, reconciledDay: null };
}

function gpmDomesticMemberWeight(party) {
  const terms = gpmDomesticMembershipTerms;
  const activeMembers = gpmDomesticMembership(party).members;
  const scale = Math.min(1, activeMembers / terms.fullVotingMembers);
  const room = Math.max(.15, 1 - (party.support || 0) / .15);
  return 1 + terms.votingWeight * scale * room;
}

function gpmDomesticMoveMembers(source, target, share) {
  const origin = source?.gpmDomestic?.membership;
  if (!origin || !target?.organization || source === target) return 0;
  const originalMembers = origin.members;
  const moved = Math.round(originalMembers * Math.max(0, Math.min(1, share)));
  if (!(moved > 0)) return 0;
  const state = gpmDomesticState(target);
  const destination = state.membership ??= gpmDomesticMembership(target);
  origin.members -= moved;
  destination.members += moved;
  if (typeof gpmCongressTransferAffiliations === "function") gpmCongressTransferAffiliations(source, target, moved, originalMembers);
  for (const key of ["reconciledDay", "reconciledMonth", "lastProjectDay"]) {
    if (Number.isFinite(origin[key])) destination[key] = Math.max(destination[key] ?? origin[key], origin[key]);
  }
  return moved;
}

function gpmDomesticWithStaff(sim, country, party, apply) {
  if (!ukr(sim, country, party.id)) return apply(null);
  const previous = gpmDomesticStaffScope.get(sim);
  const scope = { party, actions: 0 };
  gpmDomesticStaffScope.set(sim, scope);
  try {
    return apply(scope);
  } finally {
    if (previous) gpmDomesticStaffScope.set(sim, previous);
    else gpmDomesticStaffScope.delete(sim);
  }
}

function gpmDomesticReceipt(sim, country, party, kind, amount = {}) {
  if (sim.countries?.get(country.key) !== country || !party?.organization || !country.pol?.parties?.includes(party)) return;
  const { cashM = 0, activistsK = 0, influence = 0, details = null, staffDecision = false } = amount;
  const scope = gpmDomesticStaffScope.get(sim);
  const staff = scope?.party === party && !["activists-returned", "membership-dues", "membership-upkeep"].includes(kind);
  if (!cashM && !activistsK && !influence && !(staffDecision && staff)) return;
  const state = gpmDomesticState(party);
  const ledger = state.ledger ??= [];
  const entry = { day: sim.day || 0, kind, cashM, activistsK, influence, details };
  if (staff) {
    entry.staff = true;
    scope.actions++;
  }
  ledger.unshift(entry);
  ledger.length = Math.min(ledger.length, 30);
  if (cashM >= 0 || kind === "membership-upkeep") return;
  const month = Bye(sim);
  state.monthlySpendM = gpmDomesticMoney((month === state.spendMonth ? state.monthlySpendM || 0 : 0) - cashM);
  state.spendMonth = month;
}

function gpmDomesticEarnMembers(sim, country, party, kind, activistsK, day = sim.day) {
  if (!sim.gpmDomesticForecast && (sim.countries?.get(country.key) !== country || !gpmDomesticEligibleParty(country, party, true))) return;
  const recruitment = ["meeting", "movement", "outreach", "rally"].includes(kind)
    ? gpmPoliticalCrisisRecruitment(country, party, day) : 1;
  const earned = Math.round(1000 * activistsK * (gpmDomesticMembershipTerms.projectMembers[kind] || 0) * recruitment);
  if (!(earned > 0)) return;
  const state = gpmDomesticState(party);
  const membership = state.membership ??= gpmDomesticMembership(party);
  const membershipCap = Math.max(250, Math.round((country.pop || 0) * 5000));
  membership.members = Math.min(membershipCap, (membership.members || 0) + earned);
  membership.lastProjectDay = Math.max(membership.lastProjectDay ?? -Infinity, day);
}

function gpmDomesticAssessMembership(sim, country, party) {
  const membership = party.gpmDomestic?.membership;
  if (!membership || membership.reconciledMonth === Bye(sim)) return;
  const terms = gpmDomesticMembershipTerms;
  const treasury = party.organization.treasuryM;
  const duesM = gpmDomesticMoney(Math.min(Math.max(0, Eye - treasury), Math.min(terms.monthlyDuesCap, membership.members * terms.monthlyDues) / 1e6));
  const upkeepM = gpmDomesticMoney(duesM * terms.monthlyUpkeep / terms.monthlyDues);
  const netM = gpmDomesticMoney(duesM - upkeepM);
  party.organization.treasuryM = gpmDomesticMoney(treasury + netM);
  gpmDomesticReceipt(sim, country, party, "membership-dues", { cashM: duesM });
  gpmDomesticReceipt(sim, country, party, "membership-upkeep", { cashM: -upkeepM });
  const retention = sim.day - (membership.lastProjectDay ?? -Infinity) <= 90 ? terms.monthlyRetention : terms.inactiveRetention;
  const previousMembers = membership.members;
  Object.assign(membership, {
    members: Math.floor(membership.members * retention), duesM, upkeepM, netM,
    reconciledDay: sim.day, reconciledMonth: Bye(sim),
  });
  if (typeof gpmCongressRetainMembers === "function") gpmCongressRetainMembers(party, previousMembers, membership.members);
}

function gpmDomesticCompleteOutreach(sim, country, party, project, eligible) {
  const before = party.organization.activistsK;
  BFA(party);
  gpmDomesticReceipt(sim, country, party, "activists-returned", {
    activistsK: Oq(party.organization.activistsK - before), details: "outreach",
  });
  if (eligible && project.domesticMembership) {
    gpmDomesticEarnMembers(sim, country, party, "outreach", project.activistsK, project.endDay);
  }
}

function gpmDomesticContestList(sim, country, policy = null) {
  const day = sim.day || 0;
  const contests = Object.values(Qt(country)?.contests || {}).filter(contest => Number.isFinite(contest.nextDay) && contest.nextDay > day);
  return contests.sort((left, right) => {
    const target = Number(right.id === policy?.targetContestId) - Number(left.id === policy?.targetContestId);
    const legislative = Number($na(country, right).kind === "legislative") - Number($na(country, left).kind === "legislative");
    return target || (policy?.goal === "firstSeat" ? legislative : 0) || left.nextDay - right.nextDay || left.id.localeCompare(right.id);
  });
}

function gpmDomesticFocusedContest(country, policy, contests) {
  const selected = contests.find(contest => contest.id === policy.targetContestId);
  if (selected || policy.goal !== "firstSeat") return selected;
  return contests.find(contest => {
    const organ = ZA(country, contest.targetOrganId);
    return organ?.legislative && organ.selection?.method === "election" &&
      !["appointed", "hereditary", "delegated", "indirect"].includes(organ.selection.selectMode);
  });
}

function gpmDomesticReserve(sim, country, party, policy, excludedContest = null) {
  const organization = party.organization;
  const reserve = { cashM: policy?.reserveCashM || 0, activistsK: 0, influence: 0 };
  if (!policy) return reserve;
  const all = gpmDomesticContestList(sim, country, policy);
  const focus = gpmDomesticFocusedContest(country, policy, all);
  const contests = (focus ? [focus] : all).filter(contest => contest.id !== excludedContest && contest.nextDay - sim.day <= 120);
  for (const contest of contests.slice(0, 3)) {
    const need = partyModAICampaignReserve(sim, country, party, contest);
    if (!need) continue;
    reserve.cashM += need.cash;
    reserve.activistsK += need.activistsK;
    reserve.influence += need.influence;
  }
  return {
    cashM: Math.min(organization.treasuryM, gpmDomesticMoney(reserve.cashM)),
    activistsK: Math.min(organization.activistsK, Oq(reserve.activistsK)),
    influence: Math.min(organization.influence, reserve.influence),
  };
}

function gpmDomesticSpendThisMonth(sim, party) {
  const state = party.gpmDomestic;
  return state && state.spendMonth === Bye(sim) ? state.monthlySpendM || 0 : 0;
}

function gpmDomesticCanCommit(sim, country, party, cost, policy, { reserve = null, endDay = null } = {}) {
  const { cashM = 0, activistsK = 0, influence = 0 } = cost;
  const organization = party.organization;
  if (!policy || cashM < 0 || activistsK < 0 || influence < 0 || !gpmDomesticEligibleParty(country, party)) return false;
  const keep = reserve || gpmDomesticReserve(sim, country, party, policy);
  const returnsBeforeElection = endDay != null && (keep.activistsK || 0) > 0 &&
    gpmDomesticContestList(sim, country, policy).every(contest => endDay <= contest.nextDay - 60);
  const remainingCash = gpmDomesticMoney(organization.treasuryM - (keep.cashM ?? keep.cash ?? 0));
  const remainingActivists = Oq(organization.activistsK - (returnsBeforeElection ? 0 : keep.activistsK || 0));
  return (cashM <= Math.max(0, remainingCash)) && (activistsK <= Math.max(0, remainingActivists)) &&
    influence <= Math.max(0, organization.influence - (keep.influence || 0)) &&
    (policy.monthlyBudgetM == null || gpmDomesticMoney(gpmDomesticSpendThisMonth(sim, party) + cashM) <= policy.monthlyBudgetM);
}

function gpmDomesticView(sim, country, partyId) {
  const party = Gq(country, partyId);
  if (!party?.organization) return null;
  const state = party.gpmDomestic;
  const plan = gpmDomesticPlanFor(country, party);
  const contests = gpmDomesticContestList(sim, country, plan).map(contest => ({
    id: contest.id, kind: $na(country, contest).kind, targetOrganId: contest.targetOrganId, electionDay: contest.nextDay,
  }));
  return {
    partyId, plan, contests, membership: { ...gpmDomesticMembership(party),
      votingWeightPct: (gpmDomesticMemberWeight(party) - 1) * 100 }, ledger: state?.ledger || [],
    reserve: gpmDomesticReserve(sim, country, party, plan), cashM: party.organization.treasuryM,
    activistsK: party.organization.activistsK, influence: party.organization.influence,
    monthlySpendM: gpmDomesticSpendThisMonth(sim, party),
    nextPlannerDay: plan.enabled ? Jje(sim) : null, lastReview: state?.lastReview || null,
  };
}

function registerPartyDomestic() {
  gNt("gpm.party.domestic.plan", {
    validate(sim, country, input) {
      const party = Gq(country, input.partyId);
      return gpmDomesticEligibleParty(country, party) && ukr(sim, country, party.id)
        ? true : { ok: false, reason: "party" };
    },
    apply(sim, country, input) {
      const party = Gq(country, input.partyId);
      if (!gpmDomesticEligibleParty(country, party) || !ukr(sim, country, party.id)) return { ok: false, reason: "party" };
      const state = gpmDomesticState(party);
      state.plan = gpmDomesticNormalizePlan(input.plan);
      return { ok: true, changed: true, day: sim.day, plan: state.plan, campaignPlan: gpmDomesticView(sim, country, party.id) };
    },
  });
}

function patchDomesticWorker(source, replaceOnce) {
  const functions = [gpmDomesticMoney, gpmDomesticNormalizePlan, gpmDomesticEligibleParty, gpmDomesticPlanFor, gpmDomesticPolicy,
    gpmDomesticAllowsDonation, gpmDomesticDonationBudget, gpmDomesticState, gpmDomesticMembership, gpmDomesticMemberWeight, gpmDomesticMoveMembers,
    gpmDomesticWithStaff, gpmDomesticReceipt, gpmDomesticEarnMembers,
    gpmDomesticAssessMembership, gpmDomesticCompleteOutreach, gpmDomesticContestList, gpmDomesticFocusedContest,
    gpmDomesticReserve, gpmDomesticSpendThisMonth,
    gpmDomesticCanCommit, gpmDomesticView, registerPartyDomestic];
  const declarations = `const gpmDomesticStaffScope = new WeakMap();\nconst gpmDomesticDefaults=${JSON.stringify(defaults)};\n` +
    `const gpmDomesticMembershipTerms=${JSON.stringify(membershipTerms)};\n${functions.join("\n")}\nregisterPartyDomestic();\n`;
  source = replaceOnce(source, "registerPartyOrganizing();\nregisterPartyCongressSize();",
    declarations + "registerPartyOrganizing();\nregisterPartyCongressSize();");
  source = replaceOnce(source,
    "function U1a(e,t){return QFA(e,t),kda(e,t),e._reviewPartyParliamentAi(t)}",
    "function U1a(e,t){return gpmBindCampaignPolity(e,t.pol),kda(e,t),e._reviewPartyParliamentAi(t)}");
  source = replaceOnce(source,
    '!n&&a.legal!==!1?HYr(e,t,a):n&&r.autoFundraise===!0&&ria(e,t,a)}return _Pt(e,t),!0}',
    'n&&r.autoFundraise===!0&&ria(e,t,a),gpmDomesticEligibleParty(t,a)&&gpmDomesticAssessMembership(e,t,a)}return _Pt(e,t),advancePartyModAI(e,t),!0}');
  source = replaceOnce(source, "dPt(()=>VYr(e,t,A)),A[0].election.nextDay", "dPt(()=>gpmDomesticContestAI(e,t,A)),A[0].election.nextDay");
  source = replaceOnce(source, "r.lastFundraiseMonth=Bye(e),{ok:!0,partyId:A,gainM:n,treasuryM:r.treasuryM}",
    'r.lastFundraiseMonth=Bye(e),gpmDomesticReceipt(e,t,r,"fundraise",{cashM:n}),{ok:!0,partyId:A,gainM:n,treasuryM:r.treasuryM}');
  source = replaceOnce(source, "o.lastRecruitMonth=Bye(e),{ok:!0,partyId:A,spendM:n,gainedK:s,activistsK:o.activistsK}",
    'o.lastRecruitMonth=Bye(e),gpmDomesticReceipt(e,t,o,"recruit",{cashM:-n,activistsK:s}),{ok:!0,partyId:A,spendM:n,gainedK:s,activistsK:o.activistsK}');
  source = replaceOnce(source, "a.opsDone=(a.opsDone||0)+1,a.lastActionDay=e.day,{ok:!0,partyId:A,contestId:a.contestId,gain:l,score:a.score,spendM:i,activistsK:s}",
    'a.opsDone=(a.opsDone||0)+1,a.lastActionDay=e.day,gpmDomesticReceipt(e,t,K0(t,A),"campaign",{cashM:-i,activistsK:-s,influence:-Aze,details:a.contestId}),{ok:!0,partyId:A,contestId:a.contestId,gain:l,score:a.score,spendM:i,activistsK:s}');
  source = replaceOnce(source, 'i.lastStartedDay=n,T8t(e,t,A,"started",a),{...r,applied:!0}',
    'i.project.domesticMembership=!0,i.lastStartedDay=n,T8t(e,t,A,"started",a),gpmDomesticReceipt(e,t,o,"outreach",{cashM:-r.cost.budgetM,activistsK:-r.cost.activistsK,influence:-r.cost.influence,details:a}),{...r,applied:!0}');
  source = replaceOnce(source, 'BFA(a),T8t(e,t,A,"cancelled",r),{ok:!0}',
    'gpmDomesticCompleteOutreach(e,t,a,a.outreach.project,!1),T8t(e,t,A,"cancelled",r),{ok:!0}');
  return replaceOnce(source, 'BFA(A),T8t(e,t,A.id,r>=o.endDay?"completed":"cancelled",o.groupId)',
    'gpmDomesticCompleteOutreach(e,t,A,o,r>=o.endDay&&i.has(o.groupId)&&A.legal!==!1),' +
    'T8t(e,t,A.id,r>=o.endDay?"completed":"cancelled",o.groupId)');
}

module.exports = { patchDomesticWorker };

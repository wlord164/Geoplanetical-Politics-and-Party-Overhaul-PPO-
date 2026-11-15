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
  projectMembers: { meeting: 2.4, movement: 1.4, outreach: 2.1, rally: 1, investment: 2.2, headquarters: 2.6 },
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

function gpmDomesticEligibleParty(country, party) {
  return Boolean(party?.organization && party.legal !== false && !party.gpmUprisingShell && !party.gpmUprisingExcluded &&
    country.pol?.parties?.includes(party));
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
  if (iGr(sim, country, party.id)) return plan.enabled ? plan : null;
  return plan.enabled ? plan : { ...plan, enabled: true, allowForeignFunding: true, allowForeignDonations: true };
}

function gpmDomesticAllowsDonation(sim, country, party) {
  if (!gpmDomesticEligibleParty(country, party)) return false;
  return iGr(sim, country, party.id)
    ? gpmDomesticNormalizePlan(party.gpmDomestic?.plan).allowForeignDonations
    : gpmDomesticPolicy(sim, country, party)?.allowForeignDonations === true;
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
  const moved = Math.round(origin.members * Math.max(0, Math.min(1, share)));
  if (!(moved > 0)) return 0;
  const state = gpmDomesticState(target);
  const destination = state.membership ??= gpmDomesticMembership(target);
  origin.members -= moved;
  destination.members += moved;
  for (const key of ["reconciledDay", "reconciledMonth", "lastProjectDay"]) {
    if (Number.isFinite(origin[key])) destination[key] = Math.max(destination[key] ?? origin[key], origin[key]);
  }
  return moved;
}

function gpmDomesticReceipt(sim, country, party, kind, amount = {}) {
  if (sim.countries?.get(country.key) !== country || !party?.organization || !country.pol?.parties?.includes(party)) return;
  const { cashM = 0, activistsK = 0, influence = 0, details = null } = amount;
  if (!cashM && !activistsK && !influence) return;
  const state = gpmDomesticState(party);
  const ledger = state.ledger ??= [];
  ledger.unshift({ day: sim.day || 0, kind, cashM, activistsK, influence, details });
  ledger.length = Math.min(ledger.length, 30);
  if (cashM >= 0 || kind === "membership-upkeep") return;
  const month = o2e(sim);
  state.monthlySpendM = gpmDomesticMoney((month === state.spendMonth ? state.monthlySpendM || 0 : 0) - cashM);
  state.spendMonth = month;
}

function gpmDomesticEarnMembers(sim, country, party, kind, activistsK, day = sim.day) {
  if (!sim.gpmDomesticForecast && (sim.countries?.get(country.key) !== country || !gpmDomesticEligibleParty(country, party))) return;
  const earned = Math.round(1000 * activistsK * (gpmDomesticMembershipTerms.projectMembers[kind] || 0));
  if (!(earned > 0)) return;
  const state = gpmDomesticState(party);
  const membership = state.membership ??= gpmDomesticMembership(party);
  const membershipCap = Math.max(250, Math.round((country.pop || 0) * 5000));
  membership.members = Math.min(membershipCap, (membership.members || 0) + earned);
  membership.lastProjectDay = Math.max(membership.lastProjectDay ?? -Infinity, day);
}

function gpmDomesticAssessMembership(sim, country, party) {
  const membership = party.gpmDomestic?.membership;
  if (!membership || membership.reconciledMonth === o2e(sim)) return;
  const terms = gpmDomesticMembershipTerms;
  const treasury = party.organization.treasuryM;
  const duesM = gpmDomesticMoney(Math.min(Math.max(0, r2e - treasury), Math.min(terms.monthlyDuesCap, membership.members * terms.monthlyDues) / 1e6));
  const upkeepM = gpmDomesticMoney(duesM * terms.monthlyUpkeep / terms.monthlyDues);
  const netM = gpmDomesticMoney(duesM - upkeepM);
  party.organization.treasuryM = gpmDomesticMoney(treasury + netM);
  gpmDomesticReceipt(sim, country, party, "membership-dues", { cashM: duesM });
  gpmDomesticReceipt(sim, country, party, "membership-upkeep", { cashM: -upkeepM });
  const retention = sim.day - (membership.lastProjectDay ?? -Infinity) <= 90 ? terms.monthlyRetention : terms.inactiveRetention;
  Object.assign(membership, {
    members: Math.floor(membership.members * retention), duesM, upkeepM, netM,
    reconciledDay: sim.day, reconciledMonth: o2e(sim),
  });
}

function gpmDomesticCompleteOutreach(sim, country, party, project, eligible) {
  const before = party.organization.activistsK;
  r1a(party);
  gpmDomesticReceipt(sim, country, party, "activists-returned", {
    activistsK: zL(party.organization.activistsK - before), details: "outreach",
  });
  if (eligible && project.domesticMembership) {
    gpmDomesticEarnMembers(sim, country, party, "outreach", project.activistsK, project.endDay);
  }
}

function gpmDomesticContestList(sim, country, policy = null) {
  const day = sim.day || 0;
  const contests = Object.values(Xe(country)?.contests || {}).filter(contest => Number.isFinite(contest.nextDay) && contest.nextDay > day);
  return contests.sort((left, right) => {
    const target = Number(right.id === policy?.targetContestId) - Number(left.id === policy?.targetContestId);
    const legislative = Number(xMa(country, right).kind === "legislative") - Number(xMa(country, left).kind === "legislative");
    return target || (policy?.goal === "firstSeat" ? legislative : 0) || left.nextDay - right.nextDay || left.id.localeCompare(right.id);
  });
}

function gpmDomesticFocusedContest(country, policy, contests) {
  const selected = contests.find(contest => contest.id === policy.targetContestId);
  if (selected || policy.goal !== "firstSeat") return selected;
  return contests.find(contest => {
    const organ = ar(country, contest.targetOrganId);
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
    activistsK: Math.min(organization.activistsK, zL(reserve.activistsK)),
    influence: Math.min(organization.influence, reserve.influence),
  };
}

function gpmDomesticSpendThisMonth(sim, party) {
  const state = party.gpmDomestic;
  return state && state.spendMonth === o2e(sim) ? state.monthlySpendM || 0 : 0;
}

function gpmDomesticCanCommit(sim, country, party, cost, policy, { reserve = null, endDay = null } = {}) {
  const { cashM = 0, activistsK = 0, influence = 0 } = cost;
  const organization = party.organization;
  if (!policy || cashM < 0 || activistsK < 0 || influence < 0 || !gpmDomesticEligibleParty(country, party)) return false;
  const keep = reserve || gpmDomesticReserve(sim, country, party, policy);
  const returnsBeforeElection = endDay != null && (keep.activistsK || 0) > 0 &&
    gpmDomesticContestList(sim, country, policy).every(contest => endDay <= contest.nextDay - 60);
  const remainingCash = gpmDomesticMoney(organization.treasuryM - (keep.cashM ?? keep.cash ?? 0));
  const remainingActivists = zL(organization.activistsK - (returnsBeforeElection ? 0 : keep.activistsK || 0));
  return (cashM <= Math.max(0, remainingCash)) && (activistsK <= Math.max(0, remainingActivists)) &&
    influence <= Math.max(0, organization.influence - (keep.influence || 0)) &&
    (policy.monthlyBudgetM == null || gpmDomesticMoney(gpmDomesticSpendThisMonth(sim, party) + cashM) <= policy.monthlyBudgetM);
}

function gpmDomesticView(sim, country, partyId) {
  const party = YL(country, partyId);
  if (!party?.organization) return null;
  const state = party.gpmDomestic;
  const plan = gpmDomesticPlanFor(country, party);
  const contests = gpmDomesticContestList(sim, country, plan).map(contest => ({
    id: contest.id, kind: xMa(country, contest).kind, targetOrganId: contest.targetOrganId, electionDay: contest.nextDay,
  }));
  return {
    partyId, plan, contests, membership: { ...gpmDomesticMembership(party),
      votingWeightPct: (gpmDomesticMemberWeight(party) - 1) * 100 }, ledger: state?.ledger || [],
    reserve: gpmDomesticReserve(sim, country, party, plan), cashM: party.organization.treasuryM,
    activistsK: party.organization.activistsK, influence: party.organization.influence,
    monthlySpendM: gpmDomesticSpendThisMonth(sim, party),
    nextPlannerDay: plan.enabled ? bMa(sim) : null, lastReview: state?.lastReview || null,
  };
}

function registerPartyDomestic() {
  n5t("gpm.party.domestic.plan", {
    validate(sim, country, input) {
      const party = YL(country, input.partyId);
      return gpmDomesticEligibleParty(country, party) && iGr(sim, country, party.id)
        ? true : { ok: false, reason: "party" };
    },
    apply(sim, country, input) {
      const party = YL(country, input.partyId);
      if (!gpmDomesticEligibleParty(country, party) || !iGr(sim, country, party.id)) return { ok: false, reason: "party" };
      const state = gpmDomesticState(party);
      state.plan = gpmDomesticNormalizePlan(input.plan);
      return { ok: true, changed: true, plan: state.plan };
    },
  });
}

function patchDomesticWorker(source, replaceOnce) {
  const functions = [gpmDomesticMoney, gpmDomesticNormalizePlan, gpmDomesticEligibleParty, gpmDomesticPlanFor, gpmDomesticPolicy,
    gpmDomesticAllowsDonation, gpmDomesticDonationBudget, gpmDomesticState, gpmDomesticMembership, gpmDomesticMemberWeight, gpmDomesticMoveMembers,
    gpmDomesticReceipt, gpmDomesticEarnMembers,
    gpmDomesticAssessMembership, gpmDomesticCompleteOutreach, gpmDomesticContestList, gpmDomesticFocusedContest,
    gpmDomesticReserve, gpmDomesticSpendThisMonth,
    gpmDomesticCanCommit, gpmDomesticView, registerPartyDomestic];
  const declarations = `const gpmDomesticDefaults=${JSON.stringify(defaults)};\n` +
    `const gpmDomesticMembershipTerms=${JSON.stringify(membershipTerms)};\n${functions.join("\n")}\nregisterPartyDomestic();\n`;
  source = replaceOnce(source, "registerPartyOrganizing();\nregisterPartyCongressSize();",
    declarations + "registerPartyOrganizing();\nregisterPartyCongressSize();");
  source = replaceOnce(source,
    "function SKa(e,t){return gpmBindCampaignPolity(e,t.pol),n1a(e,t),QAa(e,t),advancePartyModAI(e,t),e._reviewPartyParliamentAi(t)}",
    "function SKa(e,t){return gpmBindCampaignPolity(e,t.pol),QAa(e,t),e._reviewPartyParliamentAi(t)}");
  source = replaceOnce(source,
    '!(e.playerControlsParty?.(t,r.id)??(t.key===e.playerKey&&r.id===Uo(t)))&&r.legal!==!1&&yoo(e,t,r)}return Vpt(e,t),!0}',
    'gpmDomesticEligibleParty(t,r)&&gpmDomesticAssessMembership(e,t,r)}return Vpt(e,t),advancePartyModAI(e,t),!0}');
  source = replaceOnce(source, "z2t(()=>Soo(e,t,a)),a[0].election.nextDay", "z2t(()=>gpmDomesticContestAI(e,t,a)),a[0].election.nextDay");
  source = replaceOnce(source, "organizing:partyOrganizingView(e,t,a),congress:",
    "organizing:partyOrganizingView(e,t,a),campaignPlan:gpmDomesticView(e,t,a),congress:");
  source = replaceOnce(source, "o.lastFundraiseMonth=o2e(e),{ok:!0,partyId:a,gainM:i,treasuryM:o.treasuryM}",
    'o.lastFundraiseMonth=o2e(e),gpmDomesticReceipt(e,t,r,"fundraise",{cashM:i}),{ok:!0,partyId:a,gainM:i,treasuryM:o.treasuryM}');
  source = replaceOnce(source, "n.lastRecruitMonth=o2e(e),{ok:!0,partyId:a,spendM:i,gainedK:l,activistsK:n.activistsK}",
    'n.lastRecruitMonth=o2e(e),gpmDomesticReceipt(e,t,o,"recruit",{cashM:-i,activistsK:l}),{ok:!0,partyId:a,spendM:i,gainedK:l,activistsK:n.activistsK}');
  source = replaceOnce(source, "r.opsDone=(r.opsDone||0)+1,r.lastActionDay=e.day,{ok:!0,partyId:a,contestId:r.contestId,gain:c,score:r.score,spendM:s,activistsK:l}",
    'r.opsDone=(r.opsDone||0)+1,r.lastActionDay=e.day,gpmDomesticReceipt(e,t,Cu(t,a),"campaign",{cashM:-s,activistsK:-l,influence:-ZKe,details:r.contestId}),{ok:!0,partyId:a,contestId:r.contestId,gain:c,score:r.score,spendM:s,activistsK:l}');
  source = replaceOnce(source, 's.lastStartedDay=i,Ent(e,t,a,"started",r),{...o,applied:!0}',
    's.project.domesticMembership=!0,s.lastStartedDay=i,Ent(e,t,a,"started",r),gpmDomesticReceipt(e,t,n,"outreach",{cashM:-o.cost.budgetM,activistsK:-o.cost.activistsK,influence:-o.cost.influence,details:r}),{...o,applied:!0}');
  source = replaceOnce(source, 'r1a(r),Ent(e,t,a,"cancelled",o),{ok:!0}',
    'gpmDomesticCompleteOutreach(e,t,r,r.outreach.project,!1),Ent(e,t,a,"cancelled",o),{ok:!0}');
  return replaceOnce(source, 'r1a(a),Ent(e,t,a.id,o>=n.endDay?"completed":"cancelled",n.groupId)',
    'gpmDomesticCompleteOutreach(e,t,a,n,o>=n.endDay&&s.has(n.groupId)&&a.legal!==!1),' +
    'Ent(e,t,a.id,o>=n.endDay?"completed":"cancelled",n.groupId)');
}

module.exports = { patchDomesticWorker };

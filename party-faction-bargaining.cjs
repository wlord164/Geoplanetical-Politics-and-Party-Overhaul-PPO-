"use strict";

const subjects = ["programme", "organizing"];
const defaultMandate = { enabled: false, subjects, maxCashM: .05, reserveM: .025 };

function gpmFactionMandate(input) {
  const defaults = gpmFactionMandateDefaults;
  return {
    enabled: input?.enabled === true,
    subjects: defaults.subjects.filter(subject => !Array.isArray(input?.subjects) || input.subjects.includes(subject)),
    maxCashM: Number.isFinite(input?.maxCashM) ? gpmDomesticMoney(Math.max(0, Math.min(1, input.maxCashM))) : defaults.maxCashM,
    reserveM: Number.isFinite(input?.reserveM) ? gpmDomesticMoney(Math.max(0, Math.min(1000, input.reserveM))) : defaults.reserveM,
  };
}

function gpmFactionId(label) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function gpmFactionAlignment(ideology, programme) {
  const choice = partyCongressProgrammes()[programme];
  return choice.direction * (choice.axis === "economicWeight" ? ideology.econ : ideology.gov);
}

function gpmFactionOpen(offer) {
  return ["offered", "countered", "accepted"].includes(offer.status);
}

function gpmFactionPublicOffer({ requestId, requestKey, ...offer }) {
  return offer;
}

function gpmFactionReview(sim, country, party) {
  if (!partyCongressEligible(party)) return { ok: false, reason: "party" };
  const old = party.gpmFactionPolitics;
  if (old && sim.day < old.nextReviewDay) return { ok: false, reason: "review", nextReviewDay: old.nextReviewDay };
  const planning = partyCongressPlanningData(sim, country);
  const data = partyCongressView(sim, country, party.id, planning.electorate, planning.people);
  const groups = partyCongressFactions({ ...data, factionDelegateFactors: {} }, data.size);
  if (!groups.some(group => group.seats > 0)) return { ok: false, reason: "review" };

  const state = party.gpmFactionPolitics ??= { version: 1, factions: {}, offers: [], nextId: 1 };
  const organized = groups.filter(group => group.seats > 0).sort((a, b) => b.seats - a.seats || a.label.localeCompare(b.label));
  for (const group of organized.slice(0, 2)) {
    const id = gpmFactionId(group.label);
    state.factions[id] ??= { id, label: group.label, trust: 50, organizedDay: sim.day };
  }
  for (const faction of Object.values(state.factions)) {
    const group = groups.find(item => item.label === faction.label);
    faction.seats = group?.seats || 0;
    if (!group) continue;
    faction.displayLabel = group.displayLabel;
    faction.ideology = Object.fromEntries(gpmAxes.map(({ id }) => [id, group.axisWeights[id] / group.weight]));
    gpmFactionDevelopmentReview(sim.day, state, faction);
  }
  const represented = partyCongressFactions({ ...data, factionDelegateFactors: gpmFactionDelegateFactors(state) }, data.size);
  for (const group of represented) {
    const faction = state.factions[gpmFactionId(group.label)];
    if (!faction) continue;
    faction.organization.delegateChange = group.seats - faction.seats;
    faction.seats = group.seats;
  }

  gpmRecordPartyIdentity(party);
  state.nextReviewDay = sim.day + 90;
  gpmFactionUpdateLeaders(sim, country, party, planning.people);
  return { ok: true, changed: true, nextReviewDay: state.nextReviewDay };
}

function gpmFactionUpdateLeaders(sim, country, party, people) {
  const factions = Object.values(party.gpmFactionPolitics?.factions || {}).filter(faction => faction.seats > 0);
  const used = new Set();
  for (const faction of factions) {
    const others = new Set(factions.filter(other => other !== faction).map(other => other.leadership?.personId).filter(Boolean));
    const leader = gpmFactionLeader(sim, country, party, faction, new Set([...used, ...others]), people);
    if (leader) used.add(leader.id);
  }
}

function gpmFactionLiveLeader(sim, country, party, faction) {
  if (!faction?.seats || !partyCongressEligible(party)) return null;
  const person = sim.people?.get(faction.leadership?.personId);
  if (!person || faction.leadership.termEndDay <= sim.day) return null;
  const charter = gpmFactionLeadershipCharter(sim, party);
  if (charter.method === "none" || faction.leadership.charterKey !== charter.key) return null;
  return gpmFactionLeaderEligibility(sim, country, party, charter, person, new Set()).eligible ? person : null;
}

function gpmFactionEndorsements(sim, country, party) {
  const state = party.gpmFactionPolitics;
  return (state?.offers || []).flatMap(offer => {
    if (offer.status !== "accepted" || offer.deadlineDay <= sim.day) return [];
    const faction = state.factions[offer.factionId];
    if (gpmFactionLiveLeader(sim, country, party, faction)?.id !== offer.leaderId) return [];
    return [{ label: faction.label, programme: offer.programme, extraYes: offer.extraYes }];
  });
}

function gpmFactionView(sim, country, party) {
  const state = party.gpmFactionPolitics;
  const offers = state?.offers || [];
  return {
    day: sim.day,
    initialized: state?.nextReviewDay != null,
    nextReviewDay: state?.nextReviewDay ?? null,
    factions: Object.values(state?.factions || {}).map(({ id, label, seats, trust, priorities, redLines, leadership, ideology, displayLabel, organization, issuePriorities }) => ({
      id, label, displayLabel: displayLabel || partyCongressTendencyDescription(ideology), seats, trust, priorities, redLines, leader: gpmFactionLeaderView(sim, { leadership }),
      organization, issuePriorities,
    })),
    offers: offers.slice().reverse().filter((offer, index) => index < 30 || gpmFactionOpen(offer))
      .map(gpmFactionPublicOffer),
    mandate: gpmFactionMandate(state?.mandate),
    programmes: Object.entries(partyCongressProgrammes()).map(([id, choice]) => ({ id, label: choice.label })),
  };
}

function gpmFactionCongressData(sim, country, partyId) {
  const party = YL(country, partyId);
  if (!party || Uo(country) !== partyId) return null;
  return { bargaining: gpmFactionView(sim, country, party), factionEndorsements: gpmFactionEndorsements(sim, country, party),
    factionDelegateFactors: gpmFactionDelegateFactors(party.gpmFactionPolitics) };
}

function gpmFactionCashAvailable(sim, party, cashM, actor, subject) {
  const grants = partyForeignFundingGrants(party.gpmForeignFunding);
  const restricted = grants.reduce((sum, grant) => sum + grant.unspentM, 0);
  if (cashM > Math.max(0, gpmDomesticMoney(party.organization.treasuryM - restricted))) return false;
  if (actor !== "staff") return true;
  const state = party.gpmFactionPolitics;
  const mandate = gpmFactionMandate(state.mandate);
  const month = o2e(sim);
  const paid = state.offers.reduce((sum, offer) => offer.acceptedBy === "staff" && offer.reservedMonth === month &&
    ["accepted", "delivered"].includes(offer.status) ? sum + offer.cashM : sum, 0);
  return mandate.subjects.includes(subject) && mandate.enabled && (!cashM ||
    (gpmDomesticMoney(paid + cashM) <= mandate.maxCashM &&
      gpmDomesticMoney(party.organization.treasuryM - cashM) >= mandate.reserveM));
}

function gpmFactionQuote(sim, country, party, input, actor) {
  if (!partyCongressEligible(party)) return { ok: false, reason: "party" };
  const state = party.gpmFactionPolitics;
  const faction = state?.factions[input.factionId];
  if (!state || !faction) return { ok: false, reason: "review" };
  const { subject, programme } = input;
  const cashM = input.cashM ?? 0;
  if (!gpmFactionMandateDefaults.subjects.includes(subject) || !Object.hasOwn(partyCongressProgrammes(), programme) ||
      !Number.isFinite(cashM) || cashM < 0 || cashM > 1 || (subject === "programme" && cashM !== 0)) {
    return { ok: false, reason: "terms" };
  }
  if (state.offers.some(offer => offer.factionId === faction.id && gpmFactionOpen(offer) && offer.deadlineDay > sim.day)) {
    return { ok: false, reason: "conflict" };
  }
  const leader = gpmFactionLiveLeader(sim, country, party, faction);
  if (!leader) return { ok: false, reason: "leader" };
  const planning = partyCongressPlanningData(sim, country);
  const data = partyCongressView(sim, country, party.id, planning.electorate, planning.people);
  const vote = partyCongressProgrammeVote(data, programme);
  if (!vote.ok) return { ok: false, reason: "programme" };
  const group = vote.factions.find(item => item.label === faction.label);
  const affinity = gpmFactionAlignment(faction.ideology, programme);
  const needed = subject === "organizing" ? Math.round(8 + faction.seats * .2 + Math.max(0, 50 - faction.trust) * .2) / 1000 : 0;
  const money = Math.max(needed, gpmDomesticMoney(cashM));
  const support = .18 + .10 * affinity + .002 * (faction.trust - 50) + (subject === "organizing" ? .08 : 0);
  const extraYes = Math.min((group?.currentSeats || 0) - (group?.yes || 0), Math.max(1, Math.round(faction.seats * support)));
  const decision = faction.redLines.includes(programme) ? ["refused", "red-line"] :
    !extraYes ? ["refused", "programme"] :
    !gpmFactionCashAvailable(sim, party, money, actor, subject) ? ["refused", "budget"] :
    cashM < needed ? ["countered", "market"] : ["offered", affinity >= .12 ? "aligned" : "open"];
  const [status, reason] = decision;
  const quote = { ok: true, status, reason, factionId: faction.id, leaderId: leader.id, subject,
    programme, cashM: status === "refused" ? gpmDomesticMoney(cashM) : money,
    deadlineDay: sim.day + 21, extraYes: status === "refused" ? 0 : extraYes };
  quote.expected = JSON.stringify([quote.factionId, quote.leaderId, subject, programme, quote.cashM,
    quote.status, quote.reason, quote.deadlineDay, quote.extraYes]);
  return quote;
}

function gpmFactionClose(sim, country, party, state, offer, status, reason) {
  if (!gpmFactionOpen(offer)) return;
  const wasCommitted = offer.status === "accepted";
  const faction = state.factions[offer.factionId];
  offer.status = status;
  offer.reason = reason;
  offer.closedDay = sim.day;
  if (!wasCommitted) return;

  if (status === "delivered") {
    faction.trust = Math.min(100, faction.trust + 10);
    if (offer.cashM) {
      const before = gpmDomesticMembership(party).members;
      // An organizing grant supports membership work through the same member and dues system as regional projects.
      gpmDomesticEarnMembers(sim, country, party, "investment", offer.cashM * .4);
      offer.membersAdded = gpmDomesticMembership(party).members - before;
    }
  } else {
    faction.trust = Math.max(0, faction.trust - 15);
    if (offer.cashM && party.organization) {
      party.organization.treasuryM = gpmDomesticMoney(party.organization.treasuryM + offer.cashM);
      gpmDomesticReceipt(sim, country, party, "faction-refund", { cashM: offer.cashM, details: faction.label });
    }
  }
  gpmFactionCloseDevelopment(state, faction, offer);
}

function gpmFactionExpire(sim, country, party) {
  const state = party.gpmFactionPolitics;
  for (const offer of state?.offers || []) {
    if (!gpmFactionOpen(offer)) continue;
    const faction = state.factions[offer.factionId];
    const leader = gpmFactionLiveLeader(sim, country, party, faction);
    if (offer.deadlineDay > sim.day && leader?.id === offer.leaderId) continue;
    const reason = offer.deadlineDay <= sim.day ? "deadline" : "leader";
    gpmFactionClose(sim, country, party, state, offer, offer.status === "accepted" ? "breached" : "expired", reason);
  }
}

function gpmFactionSettleVote(sim, country, party, vote) {
  const state = party.gpmFactionPolitics;
  gpmFactionExpire(sim, country, party);
  for (const offer of state?.offers || []) {
    if (offer.status !== "accepted") continue;
    if (offer.programme === vote.programme) {
      gpmFactionClose(sim, country, party, state, offer, vote.passed ? "delivered" : "breached", vote.passed ? "vote-passed" : "vote-failed");
    } else if (vote.passed) {
      gpmFactionClose(sim, country, party, state, offer, "breached", "other-programme");
    }
  }
}

function gpmFactionAction(sim, country, party, input, actor = "player") {
  if (!partyCongressEligible(party)) return { ok: false, reason: "party" };
  if (actor === "player" && (country.key !== sim.playerKey || Uo(country) !== party.id)) return { ok: false, reason: "party" };
  if (actor !== "player" && (actor === "staff") !== iGr(sim, country, party.id)) return { ok: false, reason: "party" };
  if (input.action === "review") return gpmFactionReview(sim, country, party);
  if (input.action === "mandate" && actor === "player") {
    const state = party.gpmFactionPolitics ??= { version: 1, factions: {}, offers: [], nextId: 1 };
    state.mandate = gpmFactionMandate(input.mandate);
    return { ok: true, changed: true };
  }

  const state = party.gpmFactionPolitics;
  if (!state || state.nextReviewDay == null) return { ok: false, reason: "review" };
  if (actor === "staff" && !state.mandate?.enabled) return { ok: false, reason: "mandate" };
  gpmFactionDaily(sim, country, party);
  if (input.action === "offer") {
    const requestId = input.requestId;
    if (typeof requestId !== "string" || !/^[a-z0-9:_.-]{1,150}$/i.test(requestId)) return { ok: false, reason: "terms" };
    const requestKey = JSON.stringify([input.factionId, input.subject, input.programme, input.cashM ?? 0]);
    const duplicate = state.offers.find(offer => offer.requestId === requestId);
    if (duplicate) return duplicate.requestKey === requestKey ?
      { ok: true, changed: false, offer: gpmFactionPublicOffer(duplicate) } : { ok: false, reason: "stale" };
    const quote = gpmFactionQuote(sim, country, party, input, actor);
    if (!quote.ok) return quote;
    if (input.expected != null && quote.expected !== input.expected) return { ok: false, reason: "stale" };
    const { ok, expected, ...terms } = quote;
    const offer = { ...terms, id: `faction-offer:${state.nextId++}`, day: sim.day, requestId, requestKey, actor };
    state.offers.push(offer);
    return { ok: true, changed: true, offer: gpmFactionPublicOffer(offer) };
  }

  const offer = state.offers.find(item => item.id === input.offerId);
  if (!offer || !["accept", "withdraw"].includes(input.action)) return { ok: false, reason: "terms" };
  if (input.action === "accept" && ["accepted", "delivered"].includes(offer.status)) {
    return { ok: true, changed: false, offer: gpmFactionPublicOffer(offer) };
  }
  if (!["offered", "countered"].includes(offer.status)) return { ok: false, reason: offer.reason, offer: gpmFactionPublicOffer(offer) };
  if (input.action === "withdraw") {
    gpmFactionClose(sim, country, party, state, offer, "withdrawn", "withdrawn");
    return { ok: true, changed: true, offer: gpmFactionPublicOffer(offer) };
  }
  if (partyCongressActiveProgramme(party, sim.day) ||
    sim.day < (party.gpmCongressSizeState?.nextProgrammeVoteDay || 0)) return { ok: false, reason: "programme" };
  if (state.factions[offer.factionId].redLines.includes(offer.programme)) return { ok: false, reason: "red-line" };
  if (!gpmFactionCashAvailable(sim, party, offer.cashM, actor, offer.subject)) return { ok: false, reason: "budget" };
  if (offer.cashM) party.organization.treasuryM = gpmDomesticMoney(party.organization.treasuryM - offer.cashM);
  Object.assign(offer, { status: "accepted", reason: offer.cashM ? "reserved" : "accepted", acceptedDay: sim.day,
    reservedMonth: o2e(sim), acceptedBy: actor });
  gpmDomesticReceipt(sim, country, party, "faction-commitment", { cashM: -offer.cashM,
    details: state.factions[offer.factionId].label, staffDecision: true });
  return { ok: true, changed: true, offer: gpmFactionPublicOffer(offer) };
}

function gpmFactionAutomate(sim, country, party, actor) {
  const state = party.gpmFactionPolitics;
  if (!partyCongressEligible(party) || (actor === "staff" && !state?.mandate?.enabled)) return;
  // An enacted programme marks an earlier review for parties without faction records.
  if (!state?.nextReviewDay && !party.gpmCongressSizeState?.lastProgrammeVote?.passed) return;
  if ((state?.nextReviewDay ?? 0) <= sim.day) gpmFactionAction(sim, country, party, { action: "review" }, actor);
  const current = party.gpmFactionPolitics;
  if (!current || partyCongressActiveProgramme(party, sim.day)) return;
  const open = current.offers.find(offer => offer.actor === actor &&
    ["offered", "countered"].includes(offer.status) && offer.deadlineDay > sim.day);
  if (open) {
    gpmFactionAction(sim, country, party, { action: "accept", offerId: open.id }, actor);
    return;
  }
  const programme = Object.keys(partyCongressProgrammes()).find(id =>
    partyCongressProgrammes()[id].laws.some(law => country.laws?.[law] != null));
  const faction = Object.values(current.factions).find(item => item.seats > 0 && item.priorities.includes(programme));
  if (!faction || current.offers.some(offer => gpmFactionOpen(offer) && offer.deadlineDay > sim.day)) return;
  const mandate = gpmFactionMandate(actor === "staff" ? current.mandate : null);
  const subject = mandate.subjects[0];
  if (!subject) return;
  const result = gpmFactionAction(sim, country, party, { action: "offer", factionId: faction.id, subject, programme,
    requestId: `${actor}:${sim.day}:${faction.id}` }, actor);
  if (result.offer) gpmFactionAction(sim, country, party, { action: "accept", offerId: result.offer.id }, actor);
}

function gpmFactionDaily(sim, country, party) {
  const state = party.gpmFactionPolitics;
  if (state?.nextReviewDay == null) return;
  gpmFactionExpire(sim, country, party);
  if (!partyCongressEligible(party)) return;
  const charter = gpmFactionLeadershipCharter(sim, party);
  const due = Object.values(state.factions).some(faction => {
    if (!faction.seats) return false;
    const leadership = faction.leadership;
    if (!leadership || leadership.charterKey !== charter.key) return true;
    if (charter.method === "none") return false;
    if (leadership.retryDay > sim.day) return false;
    return !gpmFactionLiveLeader(sim, country, party, faction);
  });
  if (due) gpmFactionUpdateLeaders(sim, country, party, partyCongressPlanningData(sim, country).people);
}

function gpmFactionAgenda(sim, country, partyId) {
  const state = YL(country, partyId)?.gpmFactionPolitics;
  return (state?.offers || []).filter(offer => gpmFactionOpen(offer) && offer.deadlineDay > sim.day)
    .map(offer => ({ id: offer.id, kind: "congress", tab: "congress",
      title: `${state.factions[offer.factionId].label} · ${partyCongressProgrammes()[offer.programme].label}`,
      day: offer.day, deadlineDay: offer.deadlineDay, status: offer.status }));
}

function registerPartyFactionBargaining() {
  n5t("gpm.party.factionBargain", {
    apply(sim, country, input) { return gpmFactionAction(sim, country, YL(country, input.partyId), input); },
  });
}

module.exports = { workerFunctions: [
  `const gpmFactionMandateDefaults = ${JSON.stringify(defaultMandate)};`,
  gpmFactionMandate, gpmFactionId, gpmFactionAlignment, gpmFactionOpen, gpmFactionPublicOffer, gpmFactionReview, gpmFactionUpdateLeaders,
  gpmFactionLiveLeader, gpmFactionEndorsements, gpmFactionView, gpmFactionCongressData, gpmFactionCashAvailable, gpmFactionQuote, gpmFactionClose,
  gpmFactionExpire, gpmFactionSettleVote, gpmFactionAction, gpmFactionAutomate, gpmFactionDaily, gpmFactionAgenda,
  registerPartyFactionBargaining,
] };

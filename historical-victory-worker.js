const gpmHistoricalVictoryThreshold = 100;
const gpmHistoricalConcessionThreshold = 55;

function gpmHistoricalCountryMatches(a, b) {
  if (a == null || b == null) return false;
  return a === b || /^\d+$/.test(a) && /^\d+$/.test(b) && Number(a) === Number(b);
}

function gpmHistoricalCountry(sim, key) {
  if (typeof key !== "string") return null;
  return sim.countries.get(key) || (/^\d+$/.test(key) ? sim.countries.get(key.padStart(3, "0")) : null);
}

function gpmHistoricalVictoryPlan(definition, actorId) {
  return gpmHistoricalCatalog.victories[definition.id]?.[actorId] || null;
}

function gpmHistoricalFrontSide(sim, definition) {
  const state = sim.gpmHistoricalState;
  const successor = state?.nationalOutcomes?.[sim.playerKey]?.actorId;
  return definition.sides.findIndex(side => side.some(id => {
    const actor = gpmHistoricalActorById(id);
    return id === successor ||
      !successor && gpmHistoricalCountryMatches(actor?.countryKey, sim.playerKey) &&
        ["state", "state-force", "government", "military-government"].includes(actor.kind) ||
      state?.regionalOutcomes?.[id]?.polityKey === sim.playerKey;
  }));
}

function gpmHistoricalReviewSupersededFronts(sim, definition, countryKey, incomingActorId) {
  const state = sim.gpmHistoricalState;
  const outgoing = new Set(definition.sides.flat().filter(id => id !== incomingActorId &&
    gpmHistoricalActorById(id)?.kind === "government" && gpmHistoricalCountryMatches(gpmHistoricalActorById(id).countryKey, countryKey)));
  for (const candidate of gpmHistoricalDefinitions(state)) {
    const other = state.conflicts[candidate.id];
    if (candidate.id === definition.id || other?.nativeId || !["active", "ceasefire"].includes(other?.status) ||
        !candidate.sides.flat().some(id => outgoing.has(id))) continue;
    other.status = "ceasefire";
    other.ceasefireUntil = null;
    other.pending = null;
    other.advantage = 0;
    other.transitionReview = true;
    other.history.push({ day: sim.day, term: "government-transition", outcome: "Bilateral status under review" });
  }
}

function gpmHistoricalFactionOutcome(definition, actorId) {
  return gpmHistoricalCatalog.factionReview.fronts[definition.id]?.[actorId] || null;
}

function gpmHistoricalWinningActor(definition, side) {
  const actors = definition.sides[side] || [];
  return actors.find(id => gpmHistoricalVictoryPlan(definition, id)) ||
    actors.find(id => gpmHistoricalFactionOutcome(definition, id)?.scope === "agreement") || actors[0];
}

function gpmHistoricalNeedsDecisiveOutcome(plan) {
  return !!plan && (plan.scope === "independence" ||
    (plan.scope === "national" && !plan.incumbent) ||
    (plan.scope === "autonomy" && !plan.regionalOnly));
}

function gpmHistoricalFinishVictory(sim, definition, row, side, concessionBy = null) {
  if (!row || row.nativeId || !["active", "ceasefire"].includes(row.status) || !definition.sides[side]) return false;
  const winners = definition.sides[side];
  const actorId = gpmHistoricalWinningActor(definition, side);
  const actor = gpmHistoricalActorById(actorId);
  const plan = gpmHistoricalVictoryPlan(definition, actorId);
  if (gpmHistoricalNeedsDecisiveOutcome(plan) && !concessionBy) return false;
  const assessment = gpmHistoricalFactionOutcome(definition, actorId);
  let effect = null;
  if (plan?.scope === "national") {
    const country = gpmHistoricalCountry(sim, plan.countryKey);
    if (!country) return false;
    const government = gpmHistoricalInstallVictoryGovernment(sim, country, actor, plan);
    effect = { ...plan, countryKey: country.key, actorId, laws: government.appliedLaws, native: true };
    (sim.gpmHistoricalState.nationalOutcomes ??= {})[country.key] = effect;
    if (!plan.incumbent) gpmHistoricalReviewSupersededFronts(sim, definition, plan.countryKey, actorId);
  } else if (plan) {
    effect = gpmHistoricalInstallVictoryRegions(sim, definition, actor, plan);
    if (!effect) {
      row.victoryBlocked = "The proposed government could not take control of the specified region. Overlapping territorial authority remains unresolved.";
      return false;
    }
  }

  row.status = "settled";
  row.winnerActor = actorId;
  row.settledDay = sim.day;
  row.settlement = concessionBy ? "negotiated-concession" : "decisive-victory";
  row.victoryOutcome = {
    ...assessment,
    ...(effect || { scope: assessment?.scope || "military", native: false, regionKeys: [] }),
    actorId,
    coWinners: winners.filter(id => id !== actorId),
    ...(concessionBy ? { negotiated: true, concessionBy } : {}),
  };
  if (!effect && assessment?.policies?.length) row.victoryOutcome.regionalLaws = assessment.policies;
  row.pending = null;
  row.ceasefireUntil = null;
  row.victoryBlocked = null;
  row.history.push({ day: sim.day, term: row.settlement, outcome: actor.name,
    ...(concessionBy ? { offeredBy: concessionBy } : {}) });
  return true;
}

function gpmHistoricalUpdateFront(sim, definition, row, strength) {
  if (row.nativeId || row.status !== "active" || row.weeksActive < 2) return;
  const sum = strength[0] + strength[1];
  const relative = sum ? (strength[1] - strength[0]) / sum : 0;
  const week = Math.floor(sim.day / 7);
  const noise = (va(definition.id + ":" + week + ":" + sim.rngSeed0) >>> 0) % 17 - 8;
  const movement = Math.round(relative * 7) + noise;
  row.advantage = Math.max(-100, Math.min(100, (row.advantage || 0) + movement));
  if (row.weeksActive < 12 || Math.abs(row.advantage) < gpmHistoricalVictoryThreshold) return;
  const side = row.advantage > 0 ? 1 : 0;
  const winner = gpmHistoricalWinningActor(definition, side);
  if (!gpmHistoricalNeedsDecisiveOutcome(gpmHistoricalVictoryPlan(definition, winner))) return side;
  row.victoryBlocked = "Changing sovereignty or the national government requires a decisive native war or an explicit concession.";
}

function gpmHistoricalVictoryTerms(sim, definition, row) {
  const playerSide = gpmHistoricalFrontSide(sim, definition);
  if (playerSide < 0 || row.nativeId || !["active", "ceasefire"].includes(row.status)) return [];
  const advantage = (row.advantage || 0) * (playerSide === 1 ? 1 : -1);
  const options = [];
  const ownActor = gpmHistoricalWinningActor(definition, playerSide);
  if (row.weeksActive >= 8 && advantage >= gpmHistoricalConcessionThreshold &&
      !gpmHistoricalNeedsDecisiveOutcome(gpmHistoricalVictoryPlan(definition, ownActor))) {
    options.push({ id: "claim-victory", label: "Demand capitulation" });
  }
  const otherSide = definition.sides[1 - playerSide];
  const outcome = otherSide.map(id => gpmHistoricalVictoryPlan(definition, id)).find(Boolean);
  if (outcome) options.push({ id: "concede-victory", label: "Concede and implement " + outcome.title });
  const agreements = definition.sides.flat().map(id => [id, gpmHistoricalFactionOutcome(definition, id)])
    .filter(([, policy]) => policy?.scope === "agreement" && policy.policies?.length);
  return [...options, ...agreements.map(([id, policy]) => ({ id: "terms:" + id, label: policy.title }))];
}

function gpmHistoricalImplementTerms(sim, definition, row, actorId) {
  const side = definition.sides.findIndex(ids => ids.includes(actorId));
  const assessment = gpmHistoricalFactionOutcome(definition, actorId);
  if (side < 0 || !assessment?.policies?.length) return false;
  if (assessment.scope === "occupation" && row.status === "occupation") {
    if (row.occupationAgreement) return false;
    row.occupationAgreement = true;
    row.victoryOutcome = { ...assessment, scope: "agreement", actorId, native: false, regionKeys: [] };
    row.pending = null;
    row.history.push({ day: sim.day, term: "political-agreement", outcome: "Status agreement recorded" });
  } else {
    if (assessment.scope !== "agreement" || row.nativeId || !["active", "ceasefire"].includes(row.status)) return false;
    row.status = "settled";
    row.settledDay = sim.day;
    row.victoryOutcome = { ...assessment, actorId, native: false, regionKeys: [] };
    row.pending = null;
    row.ceasefireUntil = null;
    row.history.push({ day: sim.day, term: "political-agreement", outcome: "Agreement reached" });
  }
  row.settlement = "political-agreement";
  row.disruption = Math.max(row.status === "occupation" ? 15 : 0, row.disruption - 10);
  row.victoryOutcome.negotiated = true;
  row.victoryOutcome.regionalLaws = assessment.policies;
  return true;
}

function gpmHistoricalNegotiateVictory(sim, definition, row, term) {
  const side = gpmHistoricalFrontSide(sim, definition);
  const winner = term === "concede-victory" ? 1 - side : side;
  const applied = gpmHistoricalFinishVictory(sim, definition, row, winner,
    term === "concede-victory" ? sim.playerKey : null);
  return applied ? { ok: true, message: "Settlement implemented.", settlement: row.victoryOutcome } :
    { ok: false, reason: row.victoryBlocked || "historical_term_unavailable" };
}

function gpmHistoricalWithdrawalPlan(sim, definition, row) {
  if (row.nativeId || row.status !== "occupation") return null;
  const actors = definition.sides.flat();
  const actorId = actors.find(id => gpmHistoricalFactionOutcome(definition, id)?.withdrawal);
  if (!actorId) return null;
  const otherActor = actors.find(id => id !== actorId);
  const affected = gpmHistoricalCountry(sim, gpmHistoricalActorById(actorId)?.countryKey);
  const occupier = gpmHistoricalCountry(sim, gpmHistoricalActorById(otherActor)?.countryKey);
  return { actorId, terms: gpmHistoricalFactionOutcome(definition, actorId), affected, occupier };
}

function gpmHistoricalWithdrawalAction(sim, definition, row) {
  const plan = gpmHistoricalWithdrawalPlan(sim, definition, row);
  if (!plan) return { reason: "This occupation has no withdrawal terms available." };
  const country = sim.countries.get(sim.playerKey);
  if (!country || (country !== plan.affected && country !== plan.occupier)) {
    return { reason: "Only a government involved in this occupation can negotiate its withdrawal." };
  }
  const counterparty = gpmHistoricalWithdrawalCounterparty(plan, country);
  if (!Ge(country, "diplomacy")) {
    return { reason: "This country's government lacks authority to negotiate the withdrawal." };
  }
  if (!Ge(counterparty, "diplomacy")) {
    return { reason: "The other government cannot negotiate this withdrawal." };
  }
  if (row.pending || row.withdrawalPetition?.status === "pending") {
    return { reason: "A petition or proposal is already waiting for a response." };
  }
  if (sim.playerControlsGovernment()) {
    return { option: { id: "propose-withdrawal", label: "Propose withdrawal", description: plan.terms.note } };
  }
  const party = fS(country, Uo(country));
  if (!party?.organization || party.legal === false || p1a(country.pol).has(party.id)) {
    return { reason: "A government can propose terms, and a legal opposition party can petition it to negotiate." };
  }
  return { option: { id: "petition-withdrawal", label: "Petition for withdrawal",
    description: "Ask your government to propose ending this occupation. If it agrees, the other government decides whether to accept.",
    reviewDay: gpmHistoricalWithdrawalReviewDay(sim.day),
    assessment: gpmHistoricalWithdrawalAssessment(sim, plan, country, counterparty, party) } };
}

function gpmHistoricalWithdrawalAssessment(sim, plan, country, counterparty, party) {
  const willingness = plan.terms.withdrawal.willingness;
  const alignment = _3t(sim, counterparty, country);
  const support = party ? Math.max(0, party.support || 0) : 0;
  const seats = party ? partyForeignFundingSeatShare(country, party) : 0;
  return { support, seats, willingness, alignment,
    governmentChance: Math.min(.95, .45 + Math.max(support, seats) + willingness * .35),
    counterpartyChance: Math.max(0, Math.min(1, willingness + alignment * .2)) };
}

function gpmHistoricalWithdrawalCounterparty(plan, proposer) {
  if (!proposer || !plan) return null;
  return proposer === plan.affected ? plan.occupier : proposer === plan.occupier ? plan.affected : null;
}

function gpmHistoricalWithdrawalReviewDay(day) {
  return Math.ceil((day + 7) / 7) * 7;
}

function gpmHistoricalOfferWithdrawal(sim, row, proposerKey, title) {
  row.pending = { term: "propose-withdrawal", label: title, offeredBy: proposerKey,
    reviewDay: gpmHistoricalWithdrawalReviewDay(sim.day) };
}

function gpmHistoricalRecordWithdrawalPetition(sim, row, petition, status, message) {
  Object.assign(petition, { status, updatedDay: sim.day, message });
  if (status !== "accepted" && status !== "rejected") {
    row.history.push({ day: sim.day, term: "occupation-petition", outcome: message });
  }
}

function gpmHistoricalReviewWithdrawalPetition(sim, definition, row) {
  const petition = row.withdrawalPetition;
  if (petition?.status !== "pending" || petition.reviewDay > sim.day) return;
  const plan = gpmHistoricalWithdrawalPlan(sim, definition, row);
  const country = sim.countries.get(petition.countryKey);
  const party = fS(country, petition.partyId);
  const counterparty = gpmHistoricalWithdrawalCounterparty(plan, country);
  if (country?.key === sim.playerKey && sim.playerControlsGovernment()) {
    gpmHistoricalRecordWithdrawalPetition(sim, row, petition, "unavailable",
      "You now control the government and can propose the withdrawal yourself.");
    return;
  }
  if (!Ge(country, "diplomacy") || !Ge(counterparty, "diplomacy") || !party?.organization || party.legal === false) {
    gpmHistoricalRecordWithdrawalPetition(sim, row, petition, "unavailable",
      "The petition closed because the party or government can no longer act on it.");
    return;
  }
  const { governmentChance: chance } = gpmHistoricalWithdrawalAssessment(sim, plan, country, counterparty, party);
  const roll = partyForeignFundingRoll(sim, [definition.id, petition.countryKey, petition.submittedDay], "occupation-petition");
  if (roll >= chance) {
    gpmHistoricalRecordWithdrawalPetition(sim, row, petition, "declined",
      "Your government declined to open withdrawal talks.");
    return;
  }
  gpmHistoricalRecordWithdrawalPetition(sim, row, petition, "forwarded",
    "Your government submitted a withdrawal proposal. The other government is considering it.");
  gpmHistoricalOfferWithdrawal(sim, row, country.key, plan.terms.title);
}

function gpmHistoricalReviewWithdrawalOffer(sim, definition, row) {
  const offer = row.pending;
  const plan = gpmHistoricalWithdrawalPlan(sim, definition, row);
  const proposer = sim.countries.get(offer.offeredBy);
  const respondent = gpmHistoricalWithdrawalCounterparty(plan, proposer);
  const petition = row.withdrawalPetition;
  const canNegotiate = plan && Ge(proposer, "diplomacy") && Ge(respondent, "diplomacy");
  const chance = canNegotiate ? gpmHistoricalWithdrawalAssessment(sim, plan, proposer, respondent).counterpartyChance : 0;
  const roll = partyForeignFundingRoll(sim, [definition.id, offer.offeredBy, offer.reviewDay], "occupation-withdrawal");
  const accepted = roll < chance;
  row.pending = null;
  if (!accepted) {
    const message = "The withdrawal proposal was declined. The occupation remains.";
    row.history.push({ day: sim.day, term: "propose-withdrawal", outcome: message });
    if (petition?.status === "forwarded" && petition.countryKey === offer.offeredBy) {
      gpmHistoricalRecordWithdrawalPetition(sim, row, petition, "rejected", message);
    }
    return;
  }

  row.status = "settled";
  row.settlement = "negotiated-withdrawal";
  row.settledDay = sim.day;
  row.ceasefireUntil = null;
  row.disruption = 0;
  row.pressure = 0;
  row.victoryOutcome = { title: plan.terms.title, scope: "agreement", native: false, negotiated: true,
    actorId: plan.actorId, note: "The agreement removed this reported occupation from the affected areas.",
    sources: plan.terms.sources, regionKeys: [] };
  const message = "The withdrawal agreement took effect. This reported occupation has ended.";
  row.history.push({ day: sim.day, term: row.settlement, outcome: message });
  for (const { key } of definition.regions) {
    const shared = sim.gpmHistoricalState.regions[key];
    if (shared) shared.fronts = shared.fronts.filter(id => id !== definition.id);
  }
  if (petition?.status === "forwarded" && petition.countryKey === offer.offeredBy) {
    gpmHistoricalRecordWithdrawalPetition(sim, row, petition, "accepted", message);
  }
}

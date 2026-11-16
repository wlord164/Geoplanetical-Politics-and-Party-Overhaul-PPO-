"use strict";

function partyForeignFundingTreasury(party, nextTreasuryM) {
  const grants = partyForeignFundingGrants(party?.gpmForeignFunding);
  let spent = grants.length ? Math.max(0, xP(party.organization.treasuryM) - xP(nextTreasuryM)) : 0;
  for (const grant of grants) {
    if (!spent) break;
    const attributed = Math.min(xP(grant.unspentM), spent);
    grant.unspentM = (xP(grant.unspentM) - attributed) / Bu;
    spent -= attributed;
  }
  return nextTreasuryM;
}

function partyForeignFundingTransfer(source, target, amountM, repayment = false) {
  const amount = xP(amountM);
  const from = xP(source.organization.treasuryM);
  const to = xP(target.organization.treasuryM);
  if (!amount || amount > from || to + amount > ope * Bu) return false;
  const next = (from - amount) / Bu;
  source.organization.treasuryM = repayment ? next : partyForeignFundingTreasury(source, next);
  target.organization.treasuryM = (to + amount) / Bu;
  return true;
}

function partyForeignFundingParticipant(party) {
  return Boolean(party?.organization && party.legal !== false && !party.gpmUprisingShell && !party.gpmUprisingExcluded &&
    partyCongressIdeology(party.ideology));
}

function partyForeignFundingDonor(sim, country, countryKey, partyId) {
  const foreign = typeof countryKey === "string" ? sim.countries.get(countryKey) : null;
  const donor = foreign && foreign.key !== country.key && typeof partyId === "string" ? pW(foreign, partyId) : null;
  return partyForeignFundingParticipant(donor) ? donor : null;
}

function partyForeignFundingDonorLabel(sim, country, donor) {
  return {
    countryKey: country.key,
    countryName: country.name || country.key,
    customName: sim.customNames?.[country.key] || country.customName || null,
    partyId: donor.id,
    nameDesc: donor.nameDesc ? structuredClone(donor.nameDesc) : null,
  };
}

function partyForeignFundingLeftAffinity(party) {
  const { econ, gov } = party.ideology;
  if (econ <= -.30 && gov >= .50) return 1;
  // Native party families preserve ideological identity when the axes drift.
  return party.family === "authleft" ? Math.max(0, Math.min(1, (gov - .30) / .20)) : 0;
}

function partyForeignFundingAmounts(rules) {
  return [.04, .10, .20].map(amount => Math.round(amount * rules.grantSize * 1e4) / 1e6);
}

function partyForeignFundingQuote(country, party, donor, rules = null, budgetM = Infinity) {
  const alignment = Object.fromEntries(gpmAxes.map(({ id }) => [id, donor.ideology[id] - party.ideology[id]]));
  const match = Math.exp(-.28 * vm(party.ideology, donor.ideology) ** 2);
  const closeMatch = .12 * Math.max(0, Math.min(1, (match - .80) / .15));
  const coreMatch = Math.exp(-.28 * (alignment.econ ** 2 + alignment.gov ** 2));
  const leftSolidarity = .23 * coreMatch * partyForeignFundingLeftAffinity(party) * partyForeignFundingLeftAffinity(donor);
  const support = Math.max(0, party.support || 0);
  const seats = partyForeignFundingSeatShare(country, party);
  const maximum = rules ? partyForeignFundingAmounts(rules).at(-1) : .20;
  const limitM = Math.min(budgetM, Math.min(xP(maximum), Math.floor(xP(donor.organization.treasuryM) * .12)) / Bu);
  const factors = {
    baseline: -.08,
    ideology: .68 * match,
    solidarity: Math.max(closeMatch, leftSolidarity),
    traction: .27 * Math.min(1, 8 * support + 3 * seats),
    fundsAvailable: limitM >= .015,
  };
  factors.uncappedChance = factors.baseline + factors.ideology + factors.solidarity + factors.traction;
  const chance = factors.fundsAvailable ? Math.max(.04, Math.min(.86, factors.uncappedChance)) : 0;
  return { match, chance, limitM, alignment, factors };
}

function partyForeignFundingSeatShare(country, party) {
  const share = (country.pol?.chambers || []).reduce((best, chamber) => {
    const total = chamber.seats || 0;
    return total > 0 ? Math.max(best, (chamber.composition?.[party.id] || 0) / total) : best;
  }, 0);
  return Math.max(0, Math.min(1, share));
}

function partyForeignFundingDirectory(sim, params) {
  const country = sim.player;
  const party = country && pW(country, cn(country));
  if (!partyForeignFundingParticipant(party)) return null;
  const rules = gpmCampaignRulesFor(sim);
  if (!rules.foreignFunding) return { countries: [], donors: [] };
  if (params.countryKey == null) {
    const countries = [];
    for (const foreign of sim.countries.values()) {
      if (foreign.key === country.key || !foreign.pol?.parties?.some(donor =>
        partyForeignFundingParticipant(donor) && gpmDomesticAllowsDonation(sim, foreign, donor))) continue;
      countries.push({
        key: foreign.key,
        name: foreign.name || foreign.key,
        customName: sim.customNames?.[foreign.key] || foreign.customName || null,
      });
    }
    return { countries };
  }
  const foreign = typeof params.countryKey === "string" ? sim.countries.get(params.countryKey) : null;
  if (!foreign || foreign.key === country.key) return { day: sim.day || 0, donors: [] };
  const donors = (foreign.pol?.parties || []).filter(donor =>
    partyForeignFundingParticipant(donor) && gpmDomesticAllowsDonation(sim, foreign, donor)).map(donor => ({
    ...partyForeignFundingDonorLabel(sim, foreign, donor),
    ...partyForeignFundingQuote(country, party, donor, rules, gpmDomesticDonationBudget(sim, foreign, donor)),
  }));
  donors.sort((a, b) => b.chance - a.chance || a.partyId.localeCompare(b.partyId));
  return { day: sim.day || 0, donors };
}

function partyForeignFundingRoll(sim, requestId, purpose) {
  const hash = pYr(JSON.stringify([sim.rngSeed0, requestId, purpose]));
  return (Math.imul(hash ^ (hash >>> 16), 0x45d9f3b) >>> 0) / 0x100000000;
}

function partyForeignFundingState(party) {
  return party.gpmForeignFunding ??= { nextRequestDay: 0, pending: null, offer: null, grants: [], last: null };
}

function partyForeignFundingGrants(state) {
  return state?.grants || (state?.grant ? [state.grant] : []);
}

function partyForeignFundingHasAcceptedGrant(state) {
  return !!(state && (state.hasAcceptedGrant || partyForeignFundingGrants(state).some(grant => grant.amountM > 0) ||
    ["declared", "settled", "kept", "repaid"].includes(state.last?.status) && state.last.amountM > 0));
}

function partyForeignFundingStoreGrants(state, grants) {
  state.grants = grants;
  delete state.grant;
}

function partyForeignFundingCurrentGrant(state) {
  const grants = partyForeignFundingGrants(state);
  return grants.reduce((selected, grant) => {
    if (!selected) return grant;
    if (grant.exposed !== selected.exposed) return grant.exposed ? grant : selected;
    return grant.exposed && grant.responseDay < selected.responseDay ? grant : selected;
  }, null);
}

function partyForeignFundingMerge(sim, country, survivor, absorbedId, previous) {
  if (previous) {
    const state = partyForeignFundingState(survivor);
    state.hasAcceptedGrant = partyForeignFundingHasAcceptedGrant(state) || partyForeignFundingHasAcceptedGrant(previous);
    state.nextRequestDay = Math.max(state.nextRequestDay || 0, previous.nextRequestDay || 0);
    const grants = [...partyForeignFundingGrants(state), ...partyForeignFundingGrants(previous)]
      .sort((a, b) => a.closeDay - b.closeDay);
    partyForeignFundingStoreGrants(state, grants);
    // The game caps the merged treasury. Keep the unspent portion backed by available cash.
    let available = xP(survivor.organization.treasuryM);
    for (const grant of grants) {
      const reserved = Math.min(xP(grant.unspentM), available);
      grant.unspentM = reserved / Bu;
      available -= reserved;
    }
  }
  const replacement = partyForeignFundingDonorLabel(sim, country, survivor);
  for (const foreign of sim.countries.values()) {
    for (const party of foreign.pol?.parties || []) {
      const funding = party.gpmForeignFunding;
      for (const deal of [funding?.pending, funding?.offer, ...partyForeignFundingGrants(funding)]) {
        if (deal?.donor.countryKey === country.key && deal.donor.partyId === absorbedId) deal.donor = replacement;
      }
    }
  }
}

function partyForeignFundingRequest(sim, country, party, input) {
  const { donorCountryKey, donorPartyId, amountM, visibility } = input;
  const rules = gpmCampaignRulesFor(sim);
  if (!rules.foreignFunding) return { ok: false, reason: "disabled" };
  if (!partyForeignFundingAmounts(rules).includes(amountM) || !["private", "declared"].includes(visibility)) {
    return { ok: false, reason: "terms" };
  }
  const donor = partyForeignFundingDonor(sim, country, donorCountryKey, donorPartyId);
  const foreign = donor && sim.countries.get(donorCountryKey);
  if (!donor || !gpmDomesticAllowsDonation(sim, foreign, donor)) return { ok: false, reason: "donor" };
  const state = partyForeignFundingState(party);
  if (state.pending || state.offer || partyForeignFundingGrants(state).length) return { ok: false, reason: "active" };
  const day = sim.day || 0;
  if (day < state.nextRequestDay) return { ok: false, reason: "cooldown" };
  const quote = partyForeignFundingQuote(country, party, donor, rules, gpmDomesticDonationBudget(sim, foreign, donor));
  if (!quote.chance) return { ok: false, reason: "donor_funds" };
  const requestId = JSON.stringify([day, country.key, party.id, donorCountryKey, donorPartyId]);
  const responseDay = day + 5 + Math.floor(5 * partyForeignFundingRoll(sim, requestId, "delay"));
  state.nextRequestDay = day + rules.fundingCooldown;
  state.pending = {
    requestId, responseDay, amountM, visibility, domesticBudgeted: true,
    roll: partyForeignFundingRoll(sim, requestId, "offer"),
    donor: partyForeignFundingDonorLabel(sim, foreign, donor),
  };
  return { ok: true, responseDay };
}

function partyForeignFundingReceipt(state, deal, status, day, extra = {}) {
  if (partyForeignFundingHasAcceptedGrant(state)) state.hasAcceptedGrant = true;
  state.last = { status, day, donor: deal.donor, amountM: deal.amountM, ...extra };
}

function partyForeignFundingPenalty(country, party, points) {
  const org = party.organization;
  const credibility = org.credibility ?? .5;
  org.credibility = Math.max(0, Math.round((credibility - points / 100) * 1000) / 1000);
  if (country.pol.campaignPolls) country.pol.campaignPolls = {};
  return Math.round((credibility - org.credibility) * 1000) / 10;
}

function partyForeignFundingSettle(sim, country, party, grant, action) {
  const state = party.gpmForeignFunding;
  const day = sim.day || 0;
  const donor = partyForeignFundingDonor(sim, country, grant.donor.countryKey, grant.donor.partyId);
  let returnedM = 0;
  if (action === "return") {
    if (!donor) return { ok: false, reason: "donor" };
    returnedM = Math.min(xP(grant.unspentM), xP(party.organization.treasuryM),
      Math.max(0, xP(ope) - xP(donor.organization.treasuryM))) / Bu;
    if (!returnedM) return { ok: false, reason: "nothing_to_return" };
    if (!partyForeignFundingTransfer(party, donor, returnedM, true)) {
      return { ok: false, reason: "capacity" };
    }
    const foreign = sim.countries.get(grant.donor.countryKey);
    gpmDomesticReceipt(sim, country, party, "foreign-funding-return", { cashM: -returnedM, details: foreign.key });
    gpmDomesticReceipt(sim, foreign, donor, "foreign-funding-refund", { cashM: returnedM, details: country.key });
  }
  partyForeignFundingStoreGrants(state, partyForeignFundingGrants(state).filter(item => item !== grant));
  const penalty = partyForeignFundingPenalty(country, party, 8 * (1 - returnedM / grant.amountM));
  partyForeignFundingReceipt(state, grant, returnedM > 0 ? "repaid" : "kept", day,
    { returnedM, credibilityLost: grant.credibilityLost + penalty });
  return { ok: true, returnedM };
}

function advancePartyForeignFunding(sim, country, party) {
  const state = party.gpmForeignFunding;
  if (!state || !party.organization) return;
  const day = sim.day || 0;
  const rules = gpmCampaignRulesFor(sim);
  const eligible = partyForeignFundingParticipant(party);
  if (state.pending && (day >= state.pending.responseDay || !eligible)) {
    const pending = state.pending;
    state.pending = null;
    const foreign = sim.countries.get(pending.donor.countryKey);
    const candidate = eligible && partyForeignFundingDonor(sim, country, pending.donor.countryKey, pending.donor.partyId);
    const donor = candidate && (!pending.domesticBudgeted || gpmDomesticAllowsDonation(sim, foreign, candidate)) ? candidate : null;
    const quote = donor ? partyForeignFundingQuote(country, party, donor, rules,
      pending.domesticBudgeted ? gpmDomesticDonationBudget(sim, foreign, donor) : Infinity) : null;
    if (!quote?.chance || pending.roll >= quote.chance) {
      partyForeignFundingReceipt(state, pending, "refused", day,
        { reason: !donor ? "donor" : !quote.chance ? "donor_funds" : "support" });
    } else {
      const amountM = Math.floor(xP(Math.min(quote.limitM, pending.amountM *
        (pending.roll < quote.chance * .5 ? 1 : .55))) / 1000) * 1000 / Bu;
      const risk = pending.visibility === "private"
        ? Math.min(.95, Math.min(.48, .14 + .23 * amountM / .20 + .11 * (1 - quote.match)) * rules.fundingExposure / 100) : 0;
      state.offer = {
        requestId: pending.requestId, donor: pending.donor, amountM, requestedM: pending.amountM,
        visibility: pending.visibility, risk, expiresDay: pending.responseDay + 30, domesticBudgeted: pending.domesticBudgeted,
      };
    }
  }
  if (state.offer && (day >= state.offer.expiresDay || !eligible)) {
    partyForeignFundingReceipt(state, state.offer, "expired", day);
    state.offer = null;
  }
  for (const grant of partyForeignFundingGrants(state)) {
    if (!grant.exposed && grant.exposureDay != null && day >= grant.exposureDay) {
      grant.exposed = true;
      grant.credibilityLost = partyForeignFundingPenalty(country, party, 4);
      grant.responseDay = grant.exposureDay + 30;
    }
    if (grant.exposed && day >= grant.responseDay) {
      partyForeignFundingSettle(sim, country, party, grant, "keep");
    } else if (!grant.exposed && day >= grant.closeDay) {
      partyForeignFundingReceipt(state, grant, "settled", day);
      partyForeignFundingStoreGrants(state, partyForeignFundingGrants(state).filter(item => item !== grant));
    }
  }
}

function partyForeignFundingAnswer(sim, country, party, input, action) {
  const state = party.gpmForeignFunding;
  if (!state) return { ok: false, reason: "expired" };
  advancePartyForeignFunding(sim, country, party);
  const day = sim.day || 0;
  if (action === "return" || action === "keep") {
    const grant = partyForeignFundingGrants(state).find(item => item.exposed && item.requestId === input.requestId);
    if (!grant) return { ok: false, reason: "expired" };
    return partyForeignFundingSettle(sim, country, party, grant, action);
  }
  const offer = state.offer;
  if (!offer || offer.requestId !== input.requestId) return { ok: false, reason: "expired" };
  if (action === "decline") {
    partyForeignFundingReceipt(state, offer, "declined", day);
    state.offer = null;
    return { ok: true };
  }
  const donor = partyForeignFundingDonor(sim, country, offer.donor.countryKey, offer.donor.partyId);
  const foreign = donor && sim.countries.get(offer.donor.countryKey);
  if (!donor || partyForeignFundingQuote(country, party, donor, gpmCampaignRulesFor(sim),
    offer.domesticBudgeted ? gpmDomesticDonationBudget(sim, foreign, donor) : Infinity).limitM < offer.amountM) {
    partyForeignFundingReceipt(state, offer, "refused", day, { reason: donor ? "donor_funds" : "donor" });
    state.offer = null;
    return { ok: false, reason: state.last.reason };
  }
  if (!partyForeignFundingTransfer(donor, party, offer.amountM)) return { ok: false, reason: "capacity" };
  gpmDomesticReceipt(sim, country, party, "foreign-funding-received", { cashM: offer.amountM, details: foreign.key });
  gpmDomesticReceipt(sim, foreign, donor, "foreign-funding-donated", { cashM: -offer.amountM, details: country.key });
  state.offer = null;
  state.hasAcceptedGrant = true;
  if (offer.visibility === "declared") {
    const credibilityLost = partyForeignFundingPenalty(country, party, 2);
    partyForeignFundingReceipt(state, offer, "declared", day, { credibilityLost });
  } else {
    const exposureDay = partyForeignFundingRoll(sim, offer.requestId, "exposure") < offer.risk
      ? day + 14 + Math.floor(76 * partyForeignFundingRoll(sim, offer.requestId, "exposure-delay")) : null;
    partyForeignFundingStoreGrants(state, [...partyForeignFundingGrants(state), {
      requestId: offer.requestId, donor: offer.donor, amountM: offer.amountM, unspentM: offer.amountM,
      exposureDay, closeDay: day + 90, exposed: false, credibilityLost: 0,
    }]);
  }
  return { ok: true, amountM: offer.amountM };
}

function advancePartyForeignFundingAI(sim, country, electionIn, plannedParty = null, policy = null) {
  const rules = gpmCampaignRulesFor(sim);
  if (!rules.foreignFunding) return;
  const day = sim.day || 0;
  const amounts = partyForeignFundingAmounts(rules);
  const partners = () => {
    const adjacent = sim.world?.adjacency?.[country.key] || [];
    const candidates = [...sim.countries.values()];
    const initial = Math.floor(day / 30) + (country.hash >>> 0);
    const keys = new Set(adjacent.slice().sort().slice(0, 8));
    for (let index = 0; index < Math.min(6, candidates.length); index++) {
      keys.add(candidates[(initial + index) % candidates.length].key);
    }
    keys.delete(country.key);
    return [...keys].map(key => sim.countries.get(key)).filter(Boolean);
  };
  let availablePartners;
  for (const party of plannedParty ? [plannedParty] : country.pol?.parties || []) {
    const plan = policy || gpmDomesticPolicy(sim, country, party);
    if (!partyForeignFundingParticipant(party) || !plan?.allowForeignFunding) continue;
    const state = party.gpmForeignFunding;
    const grant = partyForeignFundingCurrentGrant(state);
    if (grant?.exposed) {
      if (grant.unspentM >= grant.amountM * .25 &&
          partyForeignFundingAnswer(sim, country, party, { requestId: grant.requestId }, "return").ok) continue;
      partyForeignFundingAnswer(sim, country, party, { requestId: grant.requestId }, "keep");
      continue;
    }
    if (state?.offer) {
      partyForeignFundingAnswer(sim, country, party, { requestId: state.offer.requestId },
        state.offer.amountM >= .015 ? "accept" : "decline");
      continue;
    }
    if (state?.pending || grant || day < (state?.nextRequestDay || 0) ||
        (party.support || 0) > .20 || party.organization.treasuryM > .09 || electionIn <= 30) continue;
    let best = null;
    availablePartners ??= partners();
    for (const foreign of availablePartners) {
      for (const donor of foreign.pol?.parties || []) {
        if (!partyForeignFundingParticipant(donor) || !gpmDomesticAllowsDonation(sim, foreign, donor)) continue;
        const quote = partyForeignFundingQuote(country, party, donor, rules, gpmDomesticDonationBudget(sim, foreign, donor));
        const score = quote.chance * quote.limitM;
        if (quote.match >= .75 && score > (best?.score || 0)) best = { foreign, donor, quote, score };
      }
    }
    if (!best || best.quote.limitM < .015) continue;
    const amountM = amounts.find(amount => amount >= best.quote.limitM) ?? amounts.at(-1);
    partyForeignFundingRequest(sim, country, party, {
      amountM, donorCountryKey: best.foreign.key, donorPartyId: best.donor.id,
      visibility: party.organization.credibility < .45 ? "private" : "declared",
    });
  }
}

function registerPartyForeignFunding() {
  for (const action of ["request", "accept", "decline", "return", "keep"]) {
    Xgt("gpm.party.funding." + action, {
      apply(sim, country, input) {
        if (country.key !== sim.playerKey || cn(country) !== input.partyId) return { ok: false, reason: "party" };
        const party = pW(country, input.partyId);
        if (!partyForeignFundingParticipant(party)) return { ok: false, reason: "party" };
        return action === "request"
          ? partyForeignFundingRequest(sim, country, party, input)
          : partyForeignFundingAnswer(sim, country, party, input, action);
      },
    });
  }
}

function partyForeignFundingView(sim, country, partyId) {
  const party = pW(country, partyId);
  if (!partyForeignFundingParticipant(party)) return null;
  const rules = gpmCampaignRulesFor(sim);
  const state = party.gpmForeignFunding;
  const pending = state?.pending;
  const grant = partyForeignFundingCurrentGrant(state);
  let grantView = null;
  if (grant) {
    const donor = partyForeignFundingDonor(sim, country, grant.donor.countryKey, grant.donor.partyId);
    const returnableM = donor ? Math.min(xP(grant.unspentM), xP(party.organization.treasuryM),
      Math.max(0, xP(ope) - xP(donor.organization.treasuryM))) / Bu : 0;
    grantView = {
      requestId: grant.requestId, donor: grant.donor, amountM: grant.amountM, unspentM: grant.unspentM,
      closeDay: grant.closeDay, exposed: grant.exposed, responseDay: grant.responseDay ?? null,
      returnableM, credibilityLost: grant.credibilityLost,
    };
  }
  return {
    partyId,
    enabled: rules.foreignFunding,
    amountOptions: partyForeignFundingAmounts(rules),
    cooldownDays: rules.fundingCooldown,
    day: sim.day || 0,
    nextRequestDay: state?.nextRequestDay || 0,
    pending: pending ? { donor: pending.donor, amountM: pending.amountM, responseDay: pending.responseDay } : null,
    offer: state?.offer || null,
    grant: grantView,
    last: state?.last || null,
  };
}

module.exports = {
  workerFunctions: [partyForeignFundingTreasury, partyForeignFundingTransfer, partyForeignFundingParticipant,
    partyForeignFundingDonor, partyForeignFundingDonorLabel, partyForeignFundingLeftAffinity, partyForeignFundingAmounts, partyForeignFundingQuote,
    partyForeignFundingSeatShare,
    partyForeignFundingDirectory, partyForeignFundingRoll, partyForeignFundingState, partyForeignFundingGrants, partyForeignFundingHasAcceptedGrant,
    partyForeignFundingStoreGrants, partyForeignFundingCurrentGrant, partyForeignFundingMerge, partyForeignFundingRequest,
    partyForeignFundingReceipt, partyForeignFundingPenalty, partyForeignFundingSettle, advancePartyForeignFunding,
    partyForeignFundingAnswer, advancePartyForeignFundingAI, registerPartyForeignFunding, partyForeignFundingView],
};

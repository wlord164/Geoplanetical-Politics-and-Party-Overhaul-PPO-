"use strict";

function partyForeignFundingTreasury(party, nextTreasuryM) {
  const grant = party?.gpmForeignFunding?.grant;
  if (grant) {
    const spent = Math.max(0, dP(party.organization.treasuryM) - dP(nextTreasuryM));
    grant.unspentM = Math.max(0, dP(grant.unspentM) - spent) / _u;
  }
  return nextTreasuryM;
}

function partyForeignFundingTransfer(source, target, amountM) {
  const amount = dP(amountM);
  const from = dP(source.organization.treasuryM);
  const to = dP(target.organization.treasuryM);
  if (!amount || amount > from || to + amount > r2e * _u) return false;
  source.organization.treasuryM = partyForeignFundingTreasury(source, (from - amount) / _u);
  target.organization.treasuryM = (to + amount) / _u;
  return true;
}

function partyForeignFundingParticipant(party) {
  return Boolean(party?.organization && party.legal !== false && partyCongressIdeology(party.ideology));
}

function partyForeignFundingDonor(sim, country, countryKey, partyId) {
  const foreign = typeof countryKey === "string" ? sim.countries.get(countryKey) : null;
  const donor = foreign && foreign.key !== country.key && typeof partyId === "string" ? YL(foreign, partyId) : null;
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

function partyForeignFundingQuote(country, party, donor) {
  const alignment = Object.fromEntries(gpmAxes.map(({ id }) => [id, donor.ideology[id] - party.ideology[id]]));
  const match = Math.exp(-.28 * om(party.ideology, donor.ideology) ** 2);
  const closeMatch = .12 * Math.max(0, Math.min(1, (match - .80) / .15));
  const coreMatch = Math.exp(-.28 * (alignment.econ ** 2 + alignment.gov ** 2));
  const leftSolidarity = .23 * coreMatch * partyForeignFundingLeftAffinity(party) * partyForeignFundingLeftAffinity(donor);
  const support = Math.max(0, party.support || 0);
  const seats = partyForeignFundingSeatShare(country, party);
  const limitM = Math.min(dP(.20), Math.floor(dP(donor.organization.treasuryM) * .12)) / _u;
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
  const party = country && YL(country, Uo(country));
  if (!partyForeignFundingParticipant(party)) return null;
  if (params.countryKey == null) {
    const countries = [];
    for (const foreign of sim.countries.values()) {
      if (foreign.key === country.key || !foreign.pol?.parties?.some(partyForeignFundingParticipant)) continue;
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
  const donors = (foreign.pol?.parties || []).filter(partyForeignFundingParticipant).map(donor => ({
    ...partyForeignFundingDonorLabel(sim, foreign, donor),
    ...partyForeignFundingQuote(country, party, donor),
  }));
  donors.sort((a, b) => b.chance - a.chance || a.partyId.localeCompare(b.partyId));
  return { day: sim.day || 0, donors };
}

function partyForeignFundingRoll(sim, requestId, purpose) {
  const hash = tGr(JSON.stringify([sim.rngSeed0, requestId, purpose]));
  return (Math.imul(hash ^ (hash >>> 16), 0x45d9f3b) >>> 0) / 0x100000000;
}

function partyForeignFundingState(party) {
  return party.gpmForeignFunding ??= { nextRequestDay: 0, pending: null, offer: null, grant: null, last: null };
}

function partyForeignFundingRequest(sim, country, party, input) {
  const { donorCountryKey, donorPartyId, amountM, visibility } = input;
  if (![.04, .10, .20].includes(amountM) || !["private", "declared"].includes(visibility)) {
    return { ok: false, reason: "terms" };
  }
  const donor = partyForeignFundingDonor(sim, country, donorCountryKey, donorPartyId);
  if (!donor) return { ok: false, reason: "donor" };
  const state = partyForeignFundingState(party);
  if (state.pending || state.offer || state.grant) return { ok: false, reason: "active" };
  const day = sim.day || 0;
  if (day < state.nextRequestDay) return { ok: false, reason: "cooldown" };
  const quote = partyForeignFundingQuote(country, party, donor);
  if (!quote.chance) return { ok: false, reason: "donor_funds" };
  const requestId = JSON.stringify([day, country.key, party.id, donorCountryKey, donorPartyId]);
  const responseDay = day + 5 + Math.floor(5 * partyForeignFundingRoll(sim, requestId, "delay"));
  state.nextRequestDay = day + 120;
  state.pending = {
    requestId, responseDay, amountM, visibility,
    roll: partyForeignFundingRoll(sim, requestId, "offer"),
    donor: partyForeignFundingDonorLabel(sim, sim.countries.get(donorCountryKey), donor),
  };
  return { ok: true, responseDay };
}

function partyForeignFundingReceipt(state, deal, status, day, extra = {}) {
  state.last = { status, day, donor: deal.donor, amountM: deal.amountM, ...extra };
}

function partyForeignFundingPenalty(country, party, points) {
  const org = party.organization;
  const credibility = org.credibility ?? .5;
  org.credibility = Math.max(0, Math.round((credibility - points / 100) * 1000) / 1000);
  if (country.pol.campaignPolls) country.pol.campaignPolls = {};
  return Math.round((credibility - org.credibility) * 1000) / 10;
}

function partyForeignFundingSettle(sim, country, party, action) {
  const state = party.gpmForeignFunding;
  const grant = state.grant;
  const day = sim.day || 0;
  const donor = partyForeignFundingDonor(sim, country, grant.donor.countryKey, grant.donor.partyId);
  let returnedM = 0;
  if (action === "return") {
    if (!donor) return { ok: false, reason: "donor" };
    returnedM = Math.min(dP(grant.unspentM), dP(party.organization.treasuryM),
      Math.max(0, dP(r2e) - dP(donor.organization.treasuryM))) / _u;
    if (!returnedM) return { ok: false, reason: "nothing_to_return" };
    state.grant = null;
    if (!partyForeignFundingTransfer(party, donor, returnedM)) {
      state.grant = grant;
      return { ok: false, reason: "capacity" };
    }
  }
  state.grant = null;
  const penalty = partyForeignFundingPenalty(country, party, 8 * (1 - returnedM / grant.amountM));
  partyForeignFundingReceipt(state, grant, returnedM > 0 ? "repaid" : "kept", day,
    { returnedM, credibilityLost: grant.credibilityLost + penalty });
  return { ok: true, returnedM };
}

function advancePartyForeignFunding(sim, country, party) {
  const state = party.gpmForeignFunding;
  if (!state || !party.organization) return;
  const day = sim.day || 0;
  const eligible = partyForeignFundingParticipant(party);
  if (state.pending && (day >= state.pending.responseDay || !eligible)) {
    const pending = state.pending;
    state.pending = null;
    const donor = eligible && partyForeignFundingDonor(sim, country, pending.donor.countryKey, pending.donor.partyId);
    const quote = donor ? partyForeignFundingQuote(country, party, donor) : null;
    if (!quote || !quote.chance || pending.roll >= quote.chance) {
      partyForeignFundingReceipt(state, pending, "refused", day,
        { reason: !donor ? "donor" : !quote.chance ? "donor_funds" : "support" });
    } else {
      const amountM = Math.floor(dP(Math.min(quote.limitM, pending.amountM *
        (pending.roll < quote.chance * .5 ? 1 : .55))) / 1000) * 1000 / _u;
      const risk = pending.visibility === "private"
        ? Math.min(.48, .14 + .23 * amountM / .20 + .11 * (1 - quote.match)) : 0;
      state.offer = {
        requestId: pending.requestId, donor: pending.donor, amountM, requestedM: pending.amountM,
        visibility: pending.visibility, risk, expiresDay: pending.responseDay + 30,
      };
    }
  }
  if (state.offer && (day >= state.offer.expiresDay || !eligible)) {
    partyForeignFundingReceipt(state, state.offer, "expired", day);
    state.offer = null;
  }
  const grant = state.grant;
  if (!grant) return;
  if (!grant.exposed && grant.exposureDay != null && day >= grant.exposureDay) {
    grant.exposed = true;
    grant.credibilityLost = partyForeignFundingPenalty(country, party, 4);
    grant.responseDay = grant.exposureDay + 30;
  }
  if (grant.exposed && day >= grant.responseDay) {
    partyForeignFundingSettle(sim, country, party, "keep");
  } else if (!grant.exposed && day >= grant.closeDay) {
    partyForeignFundingReceipt(state, grant, "settled", day);
    state.grant = null;
  }
}

function partyForeignFundingAnswer(sim, country, party, input, action) {
  const state = party.gpmForeignFunding;
  if (!state) return { ok: false, reason: "expired" };
  advancePartyForeignFunding(sim, country, party);
  const day = sim.day || 0;
  if (action === "return" || action === "keep") {
    if (!state.grant?.exposed || state.grant.requestId !== input.requestId) return { ok: false, reason: "expired" };
    return partyForeignFundingSettle(sim, country, party, action);
  }
  const offer = state.offer;
  if (!offer || offer.requestId !== input.requestId) return { ok: false, reason: "expired" };
  if (action === "decline") {
    partyForeignFundingReceipt(state, offer, "declined", day);
    state.offer = null;
    return { ok: true };
  }
  const donor = partyForeignFundingDonor(sim, country, offer.donor.countryKey, offer.donor.partyId);
  if (!donor || partyForeignFundingQuote(country, party, donor).limitM < offer.amountM) {
    partyForeignFundingReceipt(state, offer, "refused", day, { reason: donor ? "donor_funds" : "donor" });
    state.offer = null;
    return { ok: false, reason: state.last.reason };
  }
  if (!partyForeignFundingTransfer(donor, party, offer.amountM)) return { ok: false, reason: "capacity" };
  state.offer = null;
  if (offer.visibility === "declared") {
    const credibilityLost = partyForeignFundingPenalty(country, party, 2);
    partyForeignFundingReceipt(state, offer, "declared", day, { credibilityLost });
  } else {
    const exposureDay = partyForeignFundingRoll(sim, offer.requestId, "exposure") < offer.risk
      ? day + 14 + Math.floor(76 * partyForeignFundingRoll(sim, offer.requestId, "exposure-delay")) : null;
    state.grant = {
      requestId: offer.requestId, donor: offer.donor, amountM: offer.amountM, unspentM: offer.amountM,
      exposureDay, closeDay: day + 90, exposed: false, credibilityLost: 0,
    };
  }
  return { ok: true, amountM: offer.amountM };
}

function registerPartyForeignFunding() {
  for (const action of ["request", "accept", "decline", "return", "keep"]) {
    n5t("gpm.party.funding." + action, {
      apply(sim, country, input) {
        if (country.key !== sim.playerKey || Uo(country) !== input.partyId) return { ok: false, reason: "party" };
        const party = YL(country, input.partyId);
        if (!partyForeignFundingParticipant(party)) return { ok: false, reason: "party" };
        return action === "request"
          ? partyForeignFundingRequest(sim, country, party, input)
          : partyForeignFundingAnswer(sim, country, party, input, action);
      },
    });
  }
}

function partyForeignFundingView(sim, country, partyId) {
  const party = YL(country, partyId);
  if (!partyForeignFundingParticipant(party)) return null;
  const state = party.gpmForeignFunding;
  const pending = state?.pending;
  const grant = state?.grant;
  let grantView = null;
  if (grant) {
    const donor = partyForeignFundingDonor(sim, country, grant.donor.countryKey, grant.donor.partyId);
    const returnableM = donor ? Math.min(dP(grant.unspentM), dP(party.organization.treasuryM),
      Math.max(0, dP(r2e) - dP(donor.organization.treasuryM))) / _u : 0;
    grantView = {
      requestId: grant.requestId, donor: grant.donor, amountM: grant.amountM, unspentM: grant.unspentM,
      closeDay: grant.closeDay, exposed: grant.exposed, responseDay: grant.responseDay ?? null,
      returnableM, credibilityLost: grant.credibilityLost,
    };
  }
  return {
    partyId,
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
    partyForeignFundingDonor, partyForeignFundingDonorLabel, partyForeignFundingLeftAffinity, partyForeignFundingQuote,
    partyForeignFundingSeatShare,
    partyForeignFundingDirectory, partyForeignFundingRoll, partyForeignFundingState, partyForeignFundingRequest,
    partyForeignFundingReceipt, partyForeignFundingPenalty, partyForeignFundingSettle, advancePartyForeignFunding,
    partyForeignFundingAnswer, registerPartyForeignFunding, partyForeignFundingView],
};

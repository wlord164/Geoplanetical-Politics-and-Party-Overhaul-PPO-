"use strict";

const uprisingPreparationRules = {
  threshold: .60,
  projects: 2,
  investmentDays: 21,
  divisionDays: 24,
  wingCash: .018,
  divisionCash: .036,
  aidDiscount: .024,
  divisionLimit: 3,
  aidCooldown: 75,
};

function gpmUprisingPreparationState(party) {
  return party.gpmUprisingPreparations ??= {
    wing: false, regions: {}, divisions: 0, training: null, credits: 0,
    aid: { nextRequestDay: 0, pending: null, offer: null, last: null },
  };
}

function gpmUprisingFoothold(party, province, support) {
  const regional = party.gpmRegional;
  const presence = regional?.regions?.[province.__provKey]?.presence || 0;
  const headquarters = regional?.headquarters?.key === province.__provKey ? .10 : 0;
  const base = Math.min(.30, .05 + .20 * presence + headquarters + Math.min(.07, .45 * (support || 0)));
  const preparation = party.gpmUprisingPreparations?.regions?.[province.__provKey]?.progress || 0;
  return Math.min(1, Math.round((base + preparation) * 100) / 100);
}

function gpmUprisingCashQuote(party, cash, reason) {
  reason ||= MS(party.organization.treasuryM) < MS(cash) ? "budget" : null;
  return { ok: !reason, reason, cash };
}

function gpmUprisingSpend(party, cash) {
  party.organization.treasuryM = partyForeignFundingTreasury(party,
    (MS(party.organization.treasuryM) - MS(cash)) / cu);
}

function gpmUprisingInvestmentQuote(sim, party, row, eligible) {
  const state = party.gpmUprisingPreparations;
  const rule = uprisingPreparationRules;
  const active = Object.values(state?.regions || {}).filter(region => region.project).length;
  const scale = Math.min(2.5, Math.sqrt(row.province.__pop || 0));
  const cash = Math.round(.010 * (1 + .55 * scale) * 1000) / 1000;
  const gain = Math.min(1 - row.foothold, row.foothold < .5 ? .20 : .16);
  const reason = !eligible ? "region" : row.project ? "active" :
    row.foothold >= 1 ? "saturated" : active >= rule.projects ? "project_limit" : null;
  return { ...gpmUprisingCashQuote(party, cash, reason), days: rule.investmentDays,
    gain: Math.round(gain * 100) / 100, endDay: sim.day + rule.investmentDays };
}

function gpmUprisingRecruitmentQuote(sim, party) {
  const state = party.gpmUprisingPreparations;
  const rule = uprisingPreparationRules;
  const creditCost = state?.credits > 0 ? 1 : 0;
  const reason = !state?.wing ? "wing" : state.training ? "active" :
    state.divisions >= rule.divisionLimit ? "division_limit" : null;
  return { ...gpmUprisingCashQuote(party, rule.divisionCash - creditCost * rule.aidDiscount, reason),
    creditCost, days: rule.divisionDays, endDay: sim.day + rule.divisionDays };
}

function gpmUprisingAidQuote(country, party, donor) {
  const quote = partyForeignFundingQuote(country, party, donor);
  const credits = Math.min(2, Math.floor(quote.limitM / uprisingPreparationRules.aidDiscount));
  const chance = credits ? Math.min(.80, Math.max(0, quote.chance - .10)) : 0;
  return { chance, credits };
}

function gpmUprisingAidDonors(sim, country, party) {
  if (!partyForeignFundingParticipant(party)) return [];
  const donors = [];
  for (const foreign of sim.countries.values()) {
    if (foreign.key === country.key) continue;
    for (const donor of foreign.pol?.parties || []) {
      if (!partyForeignFundingParticipant(donor)) continue;
      const quote = gpmUprisingAidQuote(country, party, donor);
      if (!quote.chance) continue;
      donors.push({ ...partyForeignFundingDonorLabel(sim, foreign, donor), ...quote });
    }
  }
  return donors.sort((a, b) => b.chance - a.chance || b.credits - a.credits ||
    a.countryKey.localeCompare(b.countryKey) || a.partyId.localeCompare(b.partyId)).slice(0, 12);
}

function gpmUprisingAidAction(sim, country, party, input, action) {
  const state = party.gpmUprisingPreparations;
  if (!state?.wing) return { ok: false, reason: "wing" };
  const aid = state.aid;
  if (action === "aidRequest") {
    if (aid.pending || aid.offer) return { ok: false, reason: "active" };
    if (sim.day < aid.nextRequestDay) return { ok: false, reason: "cooldown" };
    const donor = gpmUprisingAidDonors(sim, country, party).find(option =>
      option.countryKey === input.donorCountryKey && option.partyId === input.donorPartyId);
    if (!donor) return { ok: false, reason: "donor" };
    const requestId = JSON.stringify([sim.day, country.key, party.id, donor.countryKey, donor.partyId, "aid"]);
    const responseDay = sim.day + 7 + Math.floor(5 * partyForeignFundingRoll(sim, requestId, "delay"));
    aid.pending = { requestId, responseDay, donor, roll: partyForeignFundingRoll(sim, requestId, "offer") };
    aid.nextRequestDay = sim.day + uprisingPreparationRules.aidCooldown;
    return { ok: true };
  }
  const offer = aid.offer;
  if (!offer || sim.day >= offer.expiresDay || input.requestId !== offer.requestId)
    return { ok: false, reason: "expired" };
  const accepting = action === "aidAccept";
  if (accepting) {
    const donor = partyForeignFundingDonor(sim, country, offer.donor.countryKey, offer.donor.partyId);
    if (!donor || gpmUprisingAidQuote(country, party, donor).credits < offer.credits)
      return { ok: false, reason: "donor_funds" };
    gpmUprisingSpend(donor, offer.credits * uprisingPreparationRules.aidDiscount);
    state.credits += offer.credits;
  }
  aid.last = { status: accepting ? "accepted" : "declined", day: sim.day, donor: offer.donor, credits: offer.credits };
  aid.offer = null;
  return { ok: true };
}

function gpmUprisingAdvancePreparations(sim, country, party) {
  const state = party.gpmUprisingPreparations;
  if (!state || !party.organization || party.legal === false) return;
  for (const [key, local] of Object.entries(state.regions)) {
    const province = sim.world.provByKey.get(key);
    if (!province || ke(province) !== country.key) {
      delete state.regions[key];
    } else if (local.project && sim.day >= local.project.endDay) {
      if (!province.__occupier) local.progress = Math.round((local.progress + local.project.gain) * 100) / 100;
      local.project = null;
    }
  }
  if (state.training && sim.day >= state.training.endDay) {
    state.divisions++;
    state.training = null;
  }
  const aid = state.aid;
  if (aid.pending && sim.day >= aid.pending.responseDay) {
    const { requestId, responseDay, donor: label, roll } = aid.pending;
    const donor = partyForeignFundingDonor(sim, country, label.countryKey, label.partyId);
    const quote = donor && gpmUprisingAidQuote(country, party, donor);
    if (quote?.chance > roll) {
      aid.offer = { requestId, donor: label, credits: Math.min(quote.credits, label.credits), expiresDay: responseDay + 21 };
    } else {
      aid.last = { status: "refused", day: sim.day, donor: label };
    }
    aid.pending = null;
  }
  if (aid.offer && sim.day >= aid.offer.expiresDay) {
    aid.last = { status: "expired", day: sim.day, donor: aid.offer.donor };
    aid.offer = null;
  }
}

function gpmUprisingPreparationView(sim, country, party, plan) {
  const state = party.gpmUprisingPreparations;
  const rule = uprisingPreparationRules;
  const aid = state?.aid;
  const count = state?.divisions || 0;
  const regions = plan.rows.map(row => {
    const { province, foothold, project } = row;
    return { id: province.__provId, key: province.__provKey, name: province.__name, foothold, project,
      defects: plan.joining.has(province.__provId), starting: province === plan.province,
      invest: gpmUprisingInvestmentQuote(sim, party, row, row.eligible) };
  });
  return {
    regions, threshold: rule.threshold, deploymentCount: count, defectingCount: plan.joining.size,
    wing: { formed: !!state?.wing, quote: gpmUprisingCashQuote(party, rule.wingCash, state?.wing ? "formed" : null) },
    division: { count, limit: rule.divisionLimit, credits: state?.credits || 0,
      quote: gpmUprisingRecruitmentQuote(sim, party), project: state?.training || null },
    foreignAid: {
      donors: state?.wing && !aid.pending && !aid.offer && sim.day >= aid.nextRequestDay
        ? gpmUprisingAidDonors(sim, country, party) : [],
      pending: aid?.pending ? { responseDay: aid.pending.responseDay, donor: aid.pending.donor } : null,
      offer: aid?.offer || null, last: aid?.last || null, nextRequestDay: aid?.nextRequestDay || 0,
    },
  };
}

function gpmUprisingPrepare(sim, country, input, action) {
  const party = Rb(country, Go(country));
  if (country.key !== sim.playerKey || !party || input.partyId !== party.id)
    return { ok: false, reason: "founder_control" };
  const reason = gpmUprisingEligibility(sim, country, party);
  if (reason) return { ok: false, reason };
  if (action.startsWith("aid")) return gpmUprisingAidAction(sim, country, party, input, action);
  const state = party.gpmUprisingPreparations;
  if (action === "form") {
    const quote = gpmUprisingCashQuote(party, uprisingPreparationRules.wingCash, state?.wing ? "formed" : null);
    if (!quote.ok) return quote;
    gpmUprisingSpend(party, quote.cash);
    gpmUprisingPreparationState(party).wing = true;
  } else if (action === "recruit") {
    const quote = gpmUprisingRecruitmentQuote(sim, party);
    if (!quote.ok) return quote;
    gpmUprisingSpend(party, quote.cash);
    state.credits -= quote.creditCost;
    state.training = { endDay: quote.endDay };
  } else {
    const plan = gpmUprisingTerritoryPlan(sim, country, party);
    const row = plan.rows.find(({ province }) =>
      province.__provId === input.provinceId && province.__provKey === input.provinceKey);
    if (!row?.eligible) return { ok: false, reason: "region" };
    const quote = gpmUprisingInvestmentQuote(sim, party, row, true);
    if (!quote.ok) return quote;
    gpmUprisingSpend(party, quote.cash);
    const local = gpmUprisingPreparationState(party).regions[row.province.__provKey] ??= { progress: 0 };
    local.project = { gain: quote.gain, endDay: quote.endDay };
  }
  return { ok: true };
}

function gpmUprisingDeployPreparations(sim, child, provinces, count) {
  if (!count) return 0;
  const infantry = jo.formationTypes.infantry;
  const kit = Object.fromEntries(Object.entries(infantry.toe).map(([key, units]) => [key, Math.ceil(units / 2)]));
  const manpower = LJe(child, count * infantry.manpowerK, sim);
  const personnel = mh(child);
  for (let i = 0; i < count; i++) {
    for (const [key, units] of Object.entries(kit)) pY(child.forces, key, units);
    xTr(sim, child, kit);
    child.forces.ammunitionStock += 14 * hbe(kit, infantry.manpowerK);
    // Allocate the recruited cohort across all prepared units, including in small breakaways.
    const available = personnel.replacementK;
    const allocation = Math.min(available, manpower / count);
    personnel.replacementK = allocation;
    OTr(sim, child, "infantry", provinces[i % provinces.length].__provKey);
    personnel.replacementK += available - allocation;
  }
  return count;
}

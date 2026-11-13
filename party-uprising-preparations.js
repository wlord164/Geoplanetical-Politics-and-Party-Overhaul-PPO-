"use strict";

const uprisingPreparationRules = {
  threshold: .60,
  projects: 2,
  investmentDays: 21,
  wingCash: .018,
  aidDiscount: .024,
  baseCapacity: 2,
  capacityThreshold: .30,
  aidCooldown: 75,
};

const uprisingDivisionTypes = {
  infantry: { label: "Infantry", cash: .036, days: 24 },
  motorized: { label: "Motorized", cash: .052, days: 28 },
  mechanized: { label: "Mechanized", cash: .082, days: 35 },
  artillery: { label: "Artillery", cash: .066, days: 31 },
};
const uprisingEquipmentKits = {
  basic: { label: "Basic", share: .50, extraCash: 0, extraDays: 0 },
  standard: { label: "Standard", share: 1, extraCash: .026, extraDays: 7 },
};
const uprisingLegacyDivision = { type: "infantry", kit: "basic" };

function gpmUprisingRoster(state) {
  if (Array.isArray(state?.divisions)) return state.divisions;
  return Array.from({ length: state?.divisions || 0 }, () => ({ ...uprisingLegacyDivision }));
}

function gpmUprisingTraining(state) {
  return state?.training ? { ...uprisingLegacyDivision, ...state.training } : null;
}

function gpmUprisingDivisionLabel(division) {
  return { ...division, label: uprisingDivisionTypes[division.type].label,
    kitLabel: uprisingEquipmentKits[division.kit].label };
}

function gpmUprisingPreparationState(party) {
  return party.gpmUprisingPreparations ??= {
    wing: false, regions: {}, divisions: [], training: null, credits: 0,
    aid: { nextRequestDay: 0, pending: null, offer: null, last: null },
  };
}

function gpmUprisingFoothold(party, province, voteShare) {
  const regional = party.gpmRegional;
  const sources = {
    support: Math.min(.12, .70 * (voteShare || 0)),
    presence: .25 * (regional?.regions?.[province.__provKey]?.presence || 0),
    headquarters: regional?.headquarters?.key === province.__provKey ? .12 : 0,
    investment: party.gpmUprisingPreparations?.regions?.[province.__provKey]?.progress || 0,
  };
  const total = Object.values(sources).reduce((sum, value) => sum + value, 0);
  return { foothold: Math.min(1, Math.round(total * 1000) / 1000), sources };
}

function gpmUprisingCapacity(plan) {
  const { baseCapacity, capacityThreshold, threshold } = uprisingPreparationRules;
  const regionalCapacity = plan.rows.filter(row => row.eligible && row.foothold >= capacityThreshold).length;
  const headquartersCapacity = plan.headquarters?.eligible && plan.headquarters.foothold >= threshold ? 1 : 0;
  return baseCapacity + regionalCapacity + headquartersCapacity;
}

function gpmUprisingHeadquartersQuote(sim, country, party, row) {
  const { province } = row;
  const region = { id: province.__provId, key: province.__provKey, pop: province.__pop, lean: province.__lean };
  const relocate = !!party.gpmRegional?.headquarters;
  if (!row.eligible) return { ok: false, reason: "headquarters_region", relocate };
  return { ...partyRegionalQuote(sim, country, party, "headquarters", region, true), relocate };
}

function gpmUprisingCashQuote(party, cash, reason) {
  reason ||= dP(party.organization.treasuryM) < dP(cash) ? "budget" : null;
  return { ok: !reason, reason, cash };
}

function gpmUprisingSpend(party, cash) {
  party.organization.treasuryM = partyForeignFundingTreasury(party,
    (dP(party.organization.treasuryM) - dP(cash)) / _u);
}

function gpmUprisingInvestmentQuote(sim, party, row, eligible) {
  const state = party.gpmUprisingPreparations;
  const rule = uprisingPreparationRules;
  const active = Object.values(state?.regions || {}).filter(region => region.project).length;
  const scale = Math.min(2.5, Math.sqrt(row.province.__pop || 0));
  const cash = Math.round(.010 * (1 + .55 * scale) * 1000) / 1000;
  const gain = Math.min(1 - row.foothold, row.foothold < .5 ? .20 : .16);
  const reason = !eligible ? "region" : !state?.wing ? "wing" : row.project ? "active" :
    row.foothold >= 1 ? "saturated" : active >= rule.projects ? "project_limit" : null;
  return { ...gpmUprisingCashQuote(party, cash, reason), days: rule.investmentDays,
    gain: Math.round(gain * 1000) / 1000, endDay: sim.day + rule.investmentDays };
}

function gpmUprisingDivisionEquipment(type, kit) {
  return Object.entries(zo.formationTypes[type].toe).map(([id, units]) =>
    ({ id, units: Math.ceil(units * uprisingEquipmentKits[kit].share) }));
}

function gpmUprisingRecruitmentQuote(sim, party, capacity, type, kit) {
  if (!Object.hasOwn(uprisingDivisionTypes, type) || !Object.hasOwn(uprisingEquipmentKits, kit))
    return { ok: false, reason: "division_terms" };
  const state = party.gpmUprisingPreparations;
  const model = uprisingDivisionTypes[type];
  const packageTerms = uprisingEquipmentKits[kit];
  const days = model.days + packageTerms.extraDays;
  const creditCost = state?.credits > 0 ? 1 : 0;
  const cash = (dP(model.cash) + dP(packageTerms.extraCash) - creditCost * dP(uprisingPreparationRules.aidDiscount)) / _u;
  const reason = !state?.wing ? "wing" : state.training ? "active" :
    gpmUprisingRoster(state).length >= capacity ? "division_limit" : null;
  return { ...gpmUprisingCashQuote(party, cash, reason), creditCost, days, endDay: sim.day + days };
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
      if (!province.__occupier) local.progress = Math.min(1, Math.round((local.progress + local.project.gain) * 1000) / 1000);
      local.project = null;
    }
  }
  if (state.training && sim.day >= state.training.endDay) {
    const { type, kit } = gpmUprisingTraining(state);
    state.divisions = [...gpmUprisingRoster(state), { type, kit }];
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
  const roster = gpmUprisingRoster(state).map(gpmUprisingDivisionLabel);
  const training = gpmUprisingTraining(state);
  const capacity = gpmUprisingCapacity(plan);
  const options = Object.entries(uprisingDivisionTypes).map(([type, { label }]) => ({ id: type, label,
    kits: Object.entries(uprisingEquipmentKits).map(([kit, terms]) => ({ id: kit, label: terms.label,
      equipment: gpmUprisingDivisionEquipment(type, kit),
      quote: gpmUprisingRecruitmentQuote(sim, party, capacity, type, kit) })) }));
  const headquarters = plan.headquarters;
  const headquartersProject = party.gpmRegional?.projects?.find(project => project.kind === "headquarters");
  const regions = plan.rows.map(row => {
    const { province, foothold, sources, project, eligible } = row;
    return { id: province.__provId, key: province.__provKey, name: province.__name, foothold, sources, project, eligible, capital: !!province.__isCapital,
      headquarters: row === headquarters, defects: plan.joining.has(province.__provId),
      starting: province === plan.province,
      hq: gpmUprisingHeadquartersQuote(sim, country, party, row),
      invest: gpmUprisingInvestmentQuote(sim, party, row, eligible) };
  });
  return {
    regions, threshold: rule.threshold, capacityThreshold: rule.capacityThreshold,
    deploymentCount: roster.length, defectingCount: plan.joining.size,
    headquarters: { key: headquarters?.province.__provKey || null, name: headquarters?.province.__name || null,
      eligible: !!headquarters?.eligible, foothold: headquarters?.foothold || 0,
      ready: !!headquarters?.eligible && headquarters.foothold >= rule.threshold,
      project: headquartersProject ? { key: headquartersProject.key, endDay: headquartersProject.endDay } : null },
    wing: { formed: !!state?.wing, quote: gpmUprisingCashQuote(party, rule.wingCash, state?.wing ? "formed" : null) },
    division: { count: roster.length, limit: capacity, credits: state?.credits || 0, roster, options,
      project: training ? gpmUprisingDivisionLabel(training) : null },
    foreignAid: {
      donors: state?.wing && !aid.pending && !aid.offer && sim.day >= aid.nextRequestDay
        ? gpmUprisingAidDonors(sim, country, party) : [],
      pending: aid?.pending ? { responseDay: aid.pending.responseDay, donor: aid.pending.donor } : null,
      offer: aid?.offer || null, last: aid?.last || null, nextRequestDay: aid?.nextRequestDay || 0,
    },
  };
}

function gpmUprisingPrepare(sim, country, input, action) {
  const party = fS(country, Uo(country));
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
    return { ok: true };
  }
  const plan = gpmUprisingTerritoryPlan(sim, country, party);
  if (action === "recruit") {
    const { divisionType, equipmentKit } = input;
    const quote = gpmUprisingRecruitmentQuote(sim, party, gpmUprisingCapacity(plan), divisionType, equipmentKit);
    if (!quote.ok) return quote;
    gpmUprisingSpend(party, quote.cash);
    state.credits -= quote.creditCost;
    state.training = { type: divisionType, kit: equipmentKit, endDay: quote.endDay };
  } else {
    const row = plan.rows.find(({ province }) =>
      province.__provId === input.provinceId && province.__provKey === input.provinceKey);
    if (!row?.eligible) return { ok: false, reason: action === "headquarters" ? "headquarters_region" : "region" };
    if (action === "headquarters") {
      const { province } = row;
      return partyRegionalStart(sim, country, party, "headquarters", {
        id: province.__provId, key: province.__provKey, pop: province.__pop, lean: province.__lean,
      }, true);
    }
    const quote = gpmUprisingInvestmentQuote(sim, party, row, true);
    if (!quote.ok) return quote;
    gpmUprisingSpend(party, quote.cash);
    const local = gpmUprisingPreparationState(party).regions[row.province.__provKey] ??= { progress: 0 };
    local.project = { gain: quote.gain, endDay: quote.endDay };
  }
  return { ok: true };
}

function gpmUprisingDeployPreparations(sim, child, headquarters, divisions) {
  const definitions = divisions.map(({ type }) => zo.formationTypes[type]);
  const total = definitions.reduce((sum, definition) => sum + definition.manpowerK, 0);
  const manpower = _et(child, total, sim);
  const bases = YIe(sim, child);
  const slots = {};
  for (const [index, { type, kit }] of divisions.entries()) {
    const definition = definitions[index];
    const equip = Object.fromEntries(gpmUprisingDivisionEquipment(type, kit).map(({ id, units }) => [id, units]));
    for (const [id, units] of Object.entries(equip)) kV(child.forces, id, units);
    const formation = hK(sim, child, type, definition, equip, H_({ equip }, definition), definition.manpowerK,
      bases, slots, Fqr(sim, child, type), headquarters.__provKey);
    formation.manpowerK = 0;
    Tbe(child, formation, manpower * definition.manpowerK / total);
    formation.ammunitionUnitsPerDay = HSe(formation.equip, formation.manpowerK);
    formation.supply.ammoDays = 14;
    formation.location = { type: "province", provKey: headquarters.__provKey };
    formation.state = "ready";
  }
}

"use strict";

const rules = {
  rally: { days: 7, cash: .012, activists: .08 },
  investment: { days: 42, cash: .03, activists: .16 },
  headquarters: { days: 28, cash: .055, activists: .22 },
  rallyGraceDays: 21,
  rallyHalfLife: 60,
  legacyRallyHalfLife: 45,
  rallyCooldown: 35,
  rallyLimit: .55,
  presenceWeight: .68,
  headquartersWeight: .12,
};

function partyRegionalProvince(sim, country, id, key) {
  if (!Number.isSafeInteger(id) || id < 0 || typeof key !== "string" || !key) return null;
  const province = sim.world?.provinces?.[id];
  return province?.__provKey === key && province.__lean && province.__pop > 0 && ni(province, country.key)
    ? province : null;
}

function partyRegionalRallyWeight(rally, day) {
  if (!rally || day < rally.day) return 0;
  const fullUntil = rally.fullUntil ?? rally.day;
  const halfLife = rally.fullUntil == null ? gpmRegionalRules.legacyRallyHalfLife : gpmRegionalRules.rallyHalfLife;
  const weight = rally.weight * Math.pow(.5, Math.max(0, day - fullUntil) / halfLife);
  return weight >= .001 ? weight : 0;
}

function partyRegionalPermanentWeight(presence, headquarters) {
  return presence * gpmRegionalRules.presenceWeight + (headquarters ? gpmRegionalRules.headquartersWeight : 0);
}

function partyRegionalWeight(party, provinceKey, day) {
  const record = party.gpmRegional;
  if (!record || party.legal === false) return 0;
  const local = record.regions[provinceKey];
  return partyRegionalPermanentWeight(local?.presence || 0, record.headquarters?.key === provinceKey)
    + partyRegionalRallyWeight(local?.rally, day);
}

function partyRegionalShares(polity, shares, key, day, override = null) {
  if (!key) return shares;
  let adjusted = null;
  let extra = 0;
  for (const party of polity.parties) {
    if (!(shares[party.id] > 0)) continue;
    const weight = party.id === override?.partyId ? override.weight : partyRegionalWeight(party, key, day);
    const gain = shares[party.id] * weight;
    if (gain > 0) {
      adjusted ??= { ...shares };
      adjusted[party.id] += gain;
      extra += gain;
    }
  }
  if (!adjusted) return shares;
  const total = Object.values(shares).reduce((sum, share) => sum + share, extra);
  for (const id of Object.keys(adjusted)) adjusted[id] /= total;
  return adjusted;
}

function partyRegionalNationalTotals(polity, regions, supports, day) {
  const population = regions.reduce((total, region) => total + region.pop, 0);
  const total = Object.values(supports).reduce((sum, share) => sum + share, 0);
  if (!(population > 0 && total > 0)) return { adjusted: supports, population, total };
  let adjusted = null;
  for (const region of regions) {
    const shares = partyRegionalShares(polity, region.shares, region.key, day);
    if (shares === region.shares) continue;
    adjusted ??= { ...supports };
    for (const id of Object.keys(supports)) {
      adjusted[id] += ((shares[id] || 0) - (region.shares[id] || 0)) * region.pop / population * total;
    }
  }
  return { adjusted: adjusted ?? supports, population, total };
}

function partyRegionalNormalize(supports, adjusted, total) {
  if (adjusted === supports) return supports;
  const normalized = {};
  let adjustedTotal = 0;
  for (const id of Object.keys(adjusted)) {
    normalized[id] = supports[id] > 0 ? Math.max(0, adjusted[id]) : 0;
    adjustedTotal += normalized[id];
  }
  if (!(adjustedTotal > 0)) return supports;
  for (const id of Object.keys(normalized)) normalized[id] *= total / adjustedTotal;
  return normalized;
}

function partyRegionalNationalShares(polity, map, supports) {
  if (!map?.regions?.length || !polity.parties.some(party => party.gpmRegional)) return supports;
  const regions = vIe(polity, map, supports, false);
  const { adjusted, total } = partyRegionalNationalTotals(polity, regions, supports, map.day);
  return partyRegionalNormalize(supports, adjusted, total);
}

function partyRegionalQuote(sim, country, party, kind, region, relocateHeadquarters = false) {
  const rule = gpmRegionalRules[kind];
  if (!party?.organization || party.legal === false) return { ok: false, reason: "party" };
  if (!region || !rule) return { ok: false, reason: "region" };
  const day = sim.day || 0;
  const record = party.gpmRegional;
  const local = record?.regions[region.key];
  const presence = local?.presence || 0;
  const hasHeadquarters = record?.headquarters?.key === region.key;
  const scale = Math.min(2.5, Math.sqrt(region.pop));
  const priority = partyCongressActivePriority(party, day);
  const cash = Math.round(rule.cash * (1 + scale) * (kind === "rally" ? 1 - .25 * presence : 1)
    * partyCongressPriorityCost(kind, priority?.kind) * 1e6) / 1e6;
  const activistsK = GN(rule.activists * (1 + scale));
  const rally = partyRegionalRallyWeight(local?.rally, day + rule.days);
  const fit = Math.exp(-.4 * Hp(party.ideology, region.lean) ** 2);
  const credibility = party.organization.credibility ?? .5;
  const chance = Math.max(.25, Math.min(.9, .34 + .30 * fit + .16 * credibility + .10 * presence + (hasHeadquarters ? .06 : 0)));
  const rallyGain = Math.max(0, Math.min(gpmRegionalRules.rallyLimit - rally, .24 + .08 * fit + .08 * presence));
  const investmentGain = initial => Math.min(1 - presence, Math.round(initial * (1 - .65 * presence) * 100) / 100);
  const availableDay = (local?.rally?.day ?? -gpmRegionalRules.rallyCooldown) + gpmRegionalRules.rallyCooldown;
  const organization = party.organization;
  let reason = null;
  if (record?.projects.some(project => project.kind === kind)) reason = "active";
  else if (kind === "headquarters" && record?.headquarters &&
    partyRegionalProvince(sim, country, record.headquarters.id, record.headquarters.key) && (!relocateHeadquarters || hasHeadquarters)) reason = "headquarters";
  else if (kind === "rally" && day < availableDay) reason = "cooldown";
  else if (kind === "investment" && presence >= 1) reason = "saturated";
  else if (organization.treasuryM < cash) reason = "budget";
  else if (organization.activistsK < activistsK) reason = "resources";
  return {
    ok: !reason, reason, cash, activistsK, availableDay, days: rule.days, endDay: day + rule.days,
    chance: kind === "investment" ? chance : null,
    presenceGain: kind === "investment" ? { strong: investmentGain(.32), partial: investmentGain(.13) } : null,
    gain: kind === "rally" ? rallyGain : kind === "headquarters" ? gpmRegionalRules.headquartersWeight : null,
  };
}

function partyRegionalStart(sim, country, party, kind, region, relocateHeadquarters = false) {
  const quote = partyRegionalQuote(sim, country, party, kind, region, relocateHeadquarters);
  if (!quote.ok) return quote;
  const day = sim.day || 0;
  const record = party.gpmRegional ??= { regions: {}, projects: [], headquarters: null };
  const nextTreasury = Math.round((party.organization.treasuryM - quote.cash) * 1e6) / 1e6;
  party.organization.treasuryM = partyForeignFundingTreasury(party, nextTreasury);
  party.organization.activistsK = GN(party.organization.activistsK - quote.activistsK);
  // The result is bound to the project at commitment and survives a save/reload.
  const salt = YNr(JSON.stringify([sim.rngSeed0, country.key, party.id, region.key, day]));
  const roll = ((Math.imul(salt ^ (salt >>> 16), 0x45d9f3b) >>> 0) / 0x100000000);
  const strongInvestment = kind === "investment" && roll < quote.chance;
  record.projects.push({
    kind, id: region.id, key: region.key, endDay: quote.endDay, activistsK: quote.activistsK,
    gain: quote.presenceGain?.[strongInvestment ? "strong" : "partial"] ?? quote.gain, strongInvestment,
  });
  return { ok: true, endDay: quote.endDay };
}

function advancePartyRegionalCampaign(sim, country, party) {
  const record = party.gpmRegional;
  if (!record || !party.organization) return;
  const day = sim.day || 0;
  if (record.headquarters && !partyRegionalProvince(sim, country, record.headquarters.id, record.headquarters.key)) {
    record.headquarters = null;
  }
  for (const project of [...record.projects]) {
    const province = partyRegionalProvince(sim, country, project.id, project.key);
    const eligible = province && party.legal !== false;
    if (eligible && day < project.endDay) continue;
    record.projects.splice(record.projects.indexOf(project), 1);
    party.organization.activistsK = GN(Math.min(1e5, party.organization.activistsK + project.activistsK));
    const local = record.regions[project.key] ??= { presence: 0 };
    if (!eligible) {
      local.lastAction = { kind: project.kind, result: "cancelled", day };
      continue;
    }
    const finishDay = project.endDay;
    let result = "completed";
    if (project.kind === "rally") {
      const existing = partyRegionalRallyWeight(local.rally, finishDay);
      local.rally = {
        day: finishDay, fullUntil: finishDay + gpmRegionalRules.rallyGraceDays,
        weight: Math.min(gpmRegionalRules.rallyLimit, existing + project.gain),
      };
    } else if (project.kind === "investment") {
      const gain = project.gain ?? (project.strongInvestment ? .24 : .07);
      local.presence = Math.min(1, Math.round((local.presence + gain) * 100) / 100);
      result = project.strongInvestment ? "strong" : "partial";
    } else {
      record.headquarters = { id: project.id, key: project.key };
    }
    local.lastAction = { kind: project.kind, result, day: finishDay };
    if (country.pol.campaignPolls) country.pol.campaignPolls = {};
  }
}

function registerPartyRegionalCampaign() {
  for (const kind of ["rally", "investment", "headquarters"]) {
    Pyt("gpm.party.regional." + kind, {
      apply(sim, country, input) {
        if (country.key !== sim.playerKey || Go(country) !== input.partyId) return { ok: false, reason: "party" };
        const province = partyRegionalProvince(sim, country, input.provinceId, input.provinceKey);
        if (!province) return { ok: false, reason: "region" };
        const region = { id: province.__provId, key: province.__provKey, pop: province.__pop, lean: province.__lean };
        return partyRegionalStart(sim, country, WN(country, input.partyId), kind, region);
      },
    });
  }
}

function partyRegionalNationalForecast(sim, country, map, partyId) {
  const polity = country.pol;
  const elections = Object.values(ot(country)?.contests || {});
  const directChambers = (polity.chambers || []).filter(chamber =>
    ["direct", "equal-per-state", "delegated"].includes(chamber.selectMode || "direct"));
  const election = elections.filter(contest => Number.isFinite(contest.nextDay)
    && directChambers.some(chamber => contest.targetOrganId === "chamber:" + chamber.id))
    .sort((a, b) => a.nextDay - b.nextDay)[0];
  const chamber = directChambers.find(item => election?.targetOrganId === "chamber:" + item.id) || directChambers[0];
  const rules = chamber ? V0a(chamber) : null;
  const base = election ? sx(sim, country, { kind: "legislative", contestId: election.id, election })
    : Object.fromEntries(polity.parties.map(party => [party.id, party.support || 0]));
  const supports = Dh(polity, base);
  const estimates = vIe(polity, map, supports, false);
  const totalsByDay = new Map();
  const projected = ({ adjusted, total }) => partyRegionalNormalize(supports, adjusted, total);
  const totalsAt = day => {
    if (!totalsByDay.has(day)) {
      const totals = partyRegionalNationalTotals(polity, estimates, supports, day);
      totalsByDay.set(day, { ...totals, shares: projected(totals) });
    }
    return totalsByDay.get(day);
  };
  const current = totalsAt(map.day).shares;
  const seats = chamber && c7(chamber, rules.transfer ? supports : current, chamber.seats, {
    rulingId: polity.institutionState?.government?.leadPartyId || null,
    integrity: polity.regime.electoralIntegrity,
    polity, electoralMap: rules.transfer ? map : null,
  });
  return {
    summary: {
      support: current[partyId] || 0, threshold: !rules?.transfer && rules?.threshold > 0 ? rules.threshold : null,
      seats: seats ? seats[partyId] || 0 : null, chamberId: chamber?.id ?? null,
      mode: rules ? rules.transfer ? "regional" : "national" : null,
    },
    estimates: new Map(estimates.map(region => [region.id, region.shares])),
    totalsAt, projected,
  };
}

function partyRegionalProjectProjection(polity, partyId, region, estimate, local, headquarters, kind, quote, forecast) {
  const day = quote.endDay;
  const permanent = partyRegionalPermanentWeight(local?.presence || 0, headquarters);
  const rally = partyRegionalRallyWeight(local?.rally, day);
  const localBefore = partyRegionalShares(polity, estimate, region.key, day)[partyId] || 0;
  const nationalTotals = forecast.totalsAt(day);
  const nationalBefore = nationalTotals.shares[partyId] || 0;
  const nationalEstimate = forecast.estimates.get(region.id);
  const nationalRegionBefore = partyRegionalShares(polity, nationalEstimate, region.key, day);
  const scenarios = kind === "investment" ? [
    ["strong", quote.chance, quote.presenceGain.strong * gpmRegionalRules.presenceWeight],
    ["partial", 1 - quote.chance, quote.presenceGain.partial * gpmRegionalRules.presenceWeight],
  ] : [["completed", 1, quote.gain]];
  const outcomes = scenarios.map(([id, chance, gain]) => {
    const override = { partyId, weight: permanent + rally + gain };
    const localAfter = partyRegionalShares(polity, estimate, region.key, day, override)[partyId] || 0;
    const nationalRegionAfter = partyRegionalShares(polity, nationalEstimate, region.key, day, override);
    const adjusted = { ...nationalTotals.adjusted };
    const share = region.pop / nationalTotals.population * nationalTotals.total;
    for (const key of Object.keys(adjusted)) {
      adjusted[key] += ((nationalRegionAfter[key] || 0) - (nationalRegionBefore[key] || 0)) * share;
    }
    const nationalAfter = forecast.projected({ ...nationalTotals, adjusted })[partyId] || 0;
    return { id, chance, localAfter, nationalAfter };
  });
  return { day, localBefore, nationalBefore, outcomes };
}

function partyRegionalCampaignView(sim, country, partyId) {
  const party = WN(country, partyId);
  if (!party?.organization) return null;
  const map = Ix(sim, country);
  const raw = new Map(vIe(country.pol, map, null, false).map(region => [region.id, region.shares]));
  const record = party.gpmRegional;
  const day = sim.day || 0;
  const forecast = partyRegionalNationalForecast(sim, country, map, partyId);
  return {
    partyId,
    countryKey: country.key,
    national: forecast.summary,
    treasuryM: party.organization.treasuryM,
    activistsK: party.organization.activistsK,
    projects: (record?.projects || []).map(({ kind, key, endDay }) => ({ kind, key, endDay })),
    regions: map.regions.filter(region => region.pop > 0).map(region => {
      const estimate = raw.get(region.id);
      const shares = partyRegionalShares(country.pol, estimate, region.key, day);
      const ranked = Object.keys(shares).sort((a, b) => shares[b] - shares[a]);
      const support = shares[partyId] || 0;
      const leadId = ranked[0] || null;
      const rivalId = ranked.find(id => id !== partyId);
      const local = record?.regions[region.key];
      const headquarters = record?.headquarters?.key === region.key;
      const rivalSupport = partyRegionalShares(country.pol, estimate, region.key, day, { partyId, weight: 0 })[partyId] || 0;
      const presenceSupport = partyRegionalShares(country.pol, estimate, region.key, day, {
        partyId, weight: partyRegionalPermanentWeight(local?.presence || 0, false),
      })[partyId] || 0;
      const permanentSupport = partyRegionalShares(country.pol, estimate, region.key, day, {
        partyId, weight: partyRegionalPermanentWeight(local?.presence || 0, headquarters),
      })[partyId] || 0;
      const quotes = {};
      for (const kind of ["rally", "investment", "headquarters"]) {
        const quote = partyRegionalQuote(sim, country, party, kind, region);
        if (quote.ok || ["budget", "resources"].includes(quote.reason)) {
          quote.projection = partyRegionalProjectProjection(country.pol, partyId, region, estimate, local, headquarters, kind, quote, forecast);
        }
        quotes[kind] = quote;
      }
      return {
        id: region.id, key: region.key, name: region.name, pop: region.pop,
        support, leadId, margin: support - (shares[rivalId] || 0),
        boost: support - (estimate[partyId] || 0),
        permanentBoost: permanentSupport - rivalSupport,
        presenceBoost: presenceSupport - rivalSupport,
        headquartersBoost: permanentSupport - presenceSupport,
        rallyBoost: support - permanentSupport,
        rivalBoost: rivalSupport - (estimate[partyId] || 0),
        rallyFullUntil: local?.rally?.fullUntil ?? null,
        presence: local?.presence || 0,
        headquarters,
        lastAction: local?.lastAction || null,
        quotes,
      };
    }),
  };
}

function advancePartyRegionalAI(sim, country, electionIn) {
  if (country.key !== sim.playerKey) return;
  const kind = electionIn <= 70 ? "rally" : "investment";
  const map = Ix(sim, country);
  if (!map.regions.length) return;
  const regions = new Map(map.regions.filter(region => region.pop > 0).map(region => [region.id, region]));
  const estimates = vIe(country.pol, map);
  for (const party of country.pol.parties) {
    if (!party.organization || party.legal === false || JNr(sim, country, party.id)) continue;
    let best = null;
    for (const estimate of estimates) {
      const region = regions.get(estimate.id);
      if (!region) continue;
      const quote = partyRegionalQuote(sim, country, party, kind, region);
      if (quote.endDay >= sim.day + electionIn || !partyModAICanCommit(party, quote, electionIn)) continue;
      const support = estimate.shares[party.id] || 0;
      const leader = Math.max(...Object.values(estimate.shares));
      const score = Math.sqrt(region.pop) * support * Math.exp(-4 * (leader - support)) / quote.cash;
      if (score > (best?.score || 0)) best = { region, score };
    }
    if (best) partyRegionalStart(sim, country, party, kind, best.region);
  }
}

module.exports = {
  rules,
  workerFunctions: [partyRegionalProvince, partyRegionalRallyWeight, partyRegionalPermanentWeight, partyRegionalWeight,
    partyRegionalShares, partyRegionalNationalTotals, partyRegionalNormalize, partyRegionalNationalShares,
    partyRegionalQuote, partyRegionalStart, advancePartyRegionalCampaign, registerPartyRegionalCampaign,
    partyRegionalNationalForecast, partyRegionalProjectProjection, partyRegionalCampaignView, advancePartyRegionalAI],
};

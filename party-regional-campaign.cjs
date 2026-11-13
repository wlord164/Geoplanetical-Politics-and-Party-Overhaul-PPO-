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
  return province?.__provKey === key && province.__lean && province.__pop > 0 && fi(province, country.key)
    ? province : null;
}

function partyRegionalRallyWeight(rally, day, rules = gpmCampaignRulesFor()) {
  if (!rally || day < rally.day) return 0;
  const fullUntil = rally.fullUntil ?? rally.day;
  const halfLife = rally.fullUntil == null ? gpmRegionalRules.legacyRallyHalfLife : rules.rallyHalfLife;
  const weight = rally.weight * (halfLife > 0 ? Math.pow(.5, Math.max(0, day - fullUntil) / halfLife) : 1);
  return weight >= .001 ? weight : 0;
}

function partyRegionalPresence(local, day, rules) {
  const presence = local?.presence || 0;
  const timestamp = local?.presenceDay;
  if (!presence || !rules.presenceHalfLife || !Number.isFinite(timestamp)) return presence;
  return presence * Math.pow(.5, Math.max(0, day - timestamp) / rules.presenceHalfLife);
}

function partyCampaignSmallPartyFactor(party, rules) {
  const support = Math.max(0, Number(party.support) || 0);
  return 1 + rules.smallPartyBonus / 100 * Math.max(0, 1 - support / .15);
}

function partyRegionalPermanentWeight(presence, headquarters) {
  return presence * gpmRegionalRules.presenceWeight + (typeof headquarters === "number" ? headquarters
    : headquarters ? gpmRegionalRules.headquartersWeight : 0);
}

function partyRegionalHeadquartersWeight(record, key) {
  const headquarters = record?.headquarters;
  if (headquarters?.key !== key) return 0;
  return headquarters.weight ?? gpmRegionalRules.headquartersWeight;
}

function partyRegionalWeight(party, provinceKey, day, rules) {
  const record = party.gpmRegional;
  if (!record || party.legal === false) return 0;
  const local = record.regions[provinceKey];
  return partyRegionalPermanentWeight(partyRegionalPresence(local, day, rules), partyRegionalHeadquartersWeight(record, provinceKey))
    + partyRegionalRallyWeight(local?.rally, day, rules);
}

function partyRegionalShares(polity, shares, key, day, override = null) {
  if (!key) return shares;
  let adjusted = null;
  let extra = 0;
  const rules = gpmCampaignRulesFor(polity);
  for (const party of polity.parties) {
    if (!(shares[party.id] > 0)) continue;
    const weight = party.id === override?.partyId ? override.weight : partyRegionalWeight(party, key, day, rules);
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
  const regions = Ywe(polity, map, supports, false);
  const { adjusted, total } = partyRegionalNationalTotals(polity, regions, supports, map.day);
  return partyRegionalNormalize(supports, adjusted, total);
}

function partyRegionalQuote(sim, country, party, kind, region, relocateHeadquarters = false) {
  const baseRule = gpmRegionalRules[kind];
  if (!party?.organization || party.legal === false) return { ok: false, reason: "party" };
  if (!region || !baseRule) return { ok: false, reason: "region" };
  const rules = gpmCampaignRulesFor(sim);
  const days = rules[kind + "Days"];
  const day = sim.day || 0;
  const record = party.gpmRegional;
  const local = record?.regions[region.key];
  const presence = partyRegionalPresence(local, day, rules);
  const hasHeadquarters = record?.headquarters?.key === region.key;
  const scale = Math.min(2.5, Math.sqrt(region.pop));
  const priority = partyCongressActivePriority(party, day);
  const cash = Math.round(rules[kind + "Cost"] * (1 + scale) * (kind === "rally" ? 1 - .25 * presence : 1)
    * partyCongressPriorityCost(kind, priority?.kind)) / 1e6;
  const activistsK = zL(baseRule.activists * (1 + scale));
  const endDay = day + days;
  const finishingPresence = partyRegionalPresence(local, endDay, rules);
  const rally = partyRegionalRallyWeight(local?.rally, endDay, rules);
  const effectiveness = rules.regionalEffectiveness / 100 * partyCampaignSmallPartyFactor(party, rules);
  const fit = Math.exp(-.4 * om(party.ideology, region.lean) ** 2);
  const credibility = party.organization.credibility ?? .5;
  const chance = Math.max(.25, Math.min(.9, .34 + .30 * fit + .16 * credibility + .10 * presence + (hasHeadquarters ? .06 : 0)));
  const rallyGain = Math.max(0, Math.min(gpmRegionalRules.rallyLimit - rally, (.24 + .08 * fit + .08 * presence) * effectiveness));
  const investmentGain = initial => Math.min(1 - finishingPresence, Math.round(initial * effectiveness * (1 - .65 * presence) * 100) / 100);
  const availableDay = local?.rally ? local.rally.day + rules.rallyCooldown : 0;
  const organization = party.organization;
  let reason = null;
  if (record?.projects.some(project => project.kind === kind) || (record?.projects.length || 0) >= rules.maxRegionalProjects) reason = "active";
  else if (kind === "headquarters" && record?.headquarters &&
    partyRegionalProvince(sim, country, record.headquarters.id, record.headquarters.key) && (!relocateHeadquarters || hasHeadquarters)) reason = "headquarters";
  else if (kind === "rally" && day < availableDay) reason = "cooldown";
  else if (kind === "rally" && rallyGain <= 0 || kind === "investment" && finishingPresence >= 1) reason = "saturated";
  else if (organization.treasuryM < cash) reason = "budget";
  else if (organization.activistsK < activistsK) reason = "resources";
  return {
    ok: !reason, reason, cash, activistsK, availableDay, days, endDay,
    chance: kind === "investment" ? chance : null,
    presenceGain: kind === "investment" ? { strong: investmentGain(.32), partial: investmentGain(.13) } : null,
    gain: kind === "rally" ? rallyGain : kind === "headquarters" ? gpmRegionalRules.headquartersWeight * effectiveness : null,
  };
}

function partyRegionalStart(sim, country, party, kind, region, relocateHeadquarters = false) {
  const quote = partyRegionalQuote(sim, country, party, kind, region, relocateHeadquarters);
  if (!quote.ok) return quote;
  const day = sim.day || 0;
  const record = party.gpmRegional ??= { regions: {}, projects: [], headquarters: null };
  const nextTreasury = Math.round((party.organization.treasuryM - quote.cash) * 1e6) / 1e6;
  party.organization.treasuryM = partyForeignFundingTreasury(party, nextTreasury);
  party.organization.activistsK = zL(party.organization.activistsK - quote.activistsK);
  // The result is bound to the project at commitment and survives a save/reload.
  const salt = tGr(JSON.stringify([sim.rngSeed0, country.key, party.id, region.key, day]));
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
  const rules = gpmCampaignRulesFor(sim);
  if (record.headquarters && !partyRegionalProvince(sim, country, record.headquarters.id, record.headquarters.key)) {
    record.headquarters = null;
  }
  for (const project of [...record.projects]) {
    const province = partyRegionalProvince(sim, country, project.id, project.key);
    const eligible = province && party.legal !== false;
    if (eligible && day < project.endDay) continue;
    record.projects.splice(record.projects.indexOf(project), 1);
    party.organization.activistsK = zL(Math.min(1e5, party.organization.activistsK + project.activistsK));
    const local = record.regions[project.key] ??= { presence: 0 };
    if (!eligible) {
      local.lastAction = { kind: project.kind, result: "cancelled", day };
      continue;
    }
    const finishDay = project.endDay;
    let result = "completed";
    if (project.kind === "rally") {
      const existing = partyRegionalRallyWeight(local.rally, finishDay, rules);
      local.rally = {
        day: finishDay, fullUntil: finishDay + rules.rallyGraceDays,
        weight: Math.min(gpmRegionalRules.rallyLimit, existing + project.gain),
      };
    } else if (project.kind === "investment") {
      const gain = project.gain ?? (project.strongInvestment ? .24 : .07);
      const presence = partyRegionalPresence(local, finishDay, rules);
      local.presence = Math.min(1, Math.round((presence + gain) * 100) / 100);
      local.presenceDay = finishDay;
      result = project.strongInvestment ? "strong" : "partial";
    } else {
      record.headquarters = { id: project.id, key: project.key, weight: project.gain ?? gpmRegionalRules.headquartersWeight };
    }
    local.lastAction = { kind: project.kind, result, day: finishDay };
    if (country.pol.campaignPolls) country.pol.campaignPolls = {};
  }
}

function registerPartyRegionalCampaign() {
  for (const kind of ["rally", "investment", "headquarters"]) {
    n5t("gpm.party.regional." + kind, {
      apply(sim, country, input) {
        if (country.key !== sim.playerKey || Uo(country) !== input.partyId) return { ok: false, reason: "party" };
        const province = partyRegionalProvince(sim, country, input.provinceId, input.provinceKey);
        if (!province) return { ok: false, reason: "region" };
        const region = { id: province.__provId, key: province.__provKey, pop: province.__pop, lean: province.__lean };
        return partyRegionalStart(sim, country, YL(country, input.partyId), kind, region);
      },
    });
  }
}

function partyRegionalNationalForecast(sim, country, map, partyId) {
  const polity = country.pol;
  const elections = Object.values(Xe(country)?.contests || {});
  const directChambers = (polity.chambers || []).filter(chamber =>
    ["direct", "equal-per-state", "delegated"].includes(chamber.selectMode || "direct"));
  const election = elections.filter(contest => Number.isFinite(contest.nextDay)
    && directChambers.some(chamber => contest.targetOrganId === "chamber:" + chamber.id))
    .sort((a, b) => a.nextDay - b.nextDay)[0];
  const chamber = directChambers.find(item => election?.targetOrganId === "chamber:" + item.id) || directChambers[0];
  const rules = chamber ? f1a(chamber) : null;
  const base = election ? iE(sim, country, { kind: "legislative", contestId: election.id, election })
    : Object.fromEntries(polity.parties.map(party => [party.id, party.support || 0]));
  const supports = r6(polity, base);
  const estimates = Ywe(polity, map, supports, false);
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
  const seats = chamber && O7(chamber, rules.transfer ? supports : current, chamber.seats, {
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
  const rules = gpmCampaignRulesFor(polity);
  const permanent = partyRegionalPermanentWeight(partyRegionalPresence(local, day, rules), headquarters);
  const rally = partyRegionalRallyWeight(local?.rally, day, rules);
  const localBefore = partyRegionalShares(polity, estimate, region.key, day)[partyId] || 0;
  const nationalTotals = forecast.totalsAt(day);
  const nationalBefore = nationalTotals.shares[partyId] || 0;
  const nationalEstimate = forecast.estimates.get(region.id);
  const nationalRegionBefore = partyRegionalShares(polity, nationalEstimate, region.key, day);
  const roundedInvestmentBoost = gain => {
    const presence = partyRegionalPresence(local, day, rules);
    const after = Math.min(1, Math.round((presence + gain) * 100) / 100);
    return (after - presence) * gpmRegionalRules.presenceWeight;
  };
  const scenarios = kind === "investment" ? [
    ["strong", quote.chance, roundedInvestmentBoost(quote.presenceGain.strong)],
    ["partial", 1 - quote.chance, roundedInvestmentBoost(quote.presenceGain.partial)],
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

function partyRegionalBreakdown(polity, estimate, shares, regionKey, day) {
  const rules = gpmCampaignRulesFor(polity);
  const baseTotal = Object.values(estimate).reduce((sum, share) => sum + share, 0);
  const details = polity.parties.filter(party => estimate[party.id] > 0 || shares[party.id] > 0).map(party => {
    const record = party.legal === false ? null : party.gpmRegional;
    const local = record?.regions[regionKey];
    const presence = partyRegionalPresence(local, day, rules);
    const headquarters = record?.headquarters?.key === regionKey;
    const headquartersWeight = partyRegionalHeadquartersWeight(record, regionKey);
    const rally = local?.rally;
    const rallyHalfLife = rally?.fullUntil == null ? gpmRegionalRules.legacyRallyHalfLife : rules.rallyHalfLife;
    const rallyWeight = partyRegionalRallyWeight(rally, day, rules);
    const rallyFullUntil = rallyWeight > 0 ? rally.fullUntil ?? rally.day : null;
    const rallyExpiresDay = rallyWeight > 0 && rallyHalfLife > 0
      ? rallyFullUntil + Math.floor(rallyHalfLife * Math.log2(rally.weight / .001)) + 1 : null;
    const baseShare = estimate[party.id] || 0;
    return {
      partyId: party.id, baseShare, presence, headquarters, rallyFullUntil, rallyHalfLife: rallyWeight > 0 ? rallyHalfLife : null,
      rallyExpiresDay, presenceWeight: partyRegionalPermanentWeight(presence, false),
      permanentWeight: partyRegionalPermanentWeight(presence, headquartersWeight), rallyWeight,
      support: shares[party.id] || 0,
    };
  });
  const excess = details.reduce((sum, row) => sum + row.baseShare * (row.permanentWeight + row.rallyWeight), 0);
  return details.map(({ presenceWeight, permanentWeight, rallyWeight, ...detail }) => {
    const base = detail.baseShare;
    const rivalTotal = baseTotal + Math.max(0, excess - base * (permanentWeight + rallyWeight));
    const projected = weight => {
      const total = rivalTotal + base * weight;
      return total > 0 && (weight || rivalTotal > baseTotal) ? base * (1 + weight) / total : base;
    };
    const rivalAdjusted = projected(0);
    const present = projected(presenceWeight);
    const permanent = projected(permanentWeight);
    return { ...detail, rivalEffect: rivalAdjusted - base, presenceBoost: present - rivalAdjusted,
      headquartersBoost: permanent - present, rallyBoost: detail.support - permanent };
  }).sort((a, b) => b.support - a.support || a.partyId.localeCompare(b.partyId));
}

function partyRegionalCampaignView(sim, country, partyId) {
  const party = YL(country, partyId);
  if (!party?.organization) return null;
  const map = PE(sim, country);
  const raw = new Map(Ywe(country.pol, map, null, false).map(region => [region.id, region.shares]));
  const record = party.gpmRegional;
  const day = sim.day || 0;
  const rules = gpmCampaignRulesFor(sim);
  const forecast = partyRegionalNationalForecast(sim, country, map, partyId);
  return {
    partyId,
    countryKey: country.key,
    rallyHalfLife: rules.rallyHalfLife,
    rallyGraceDays: rules.rallyGraceDays,
    presenceHalfLife: rules.presenceHalfLife,
    national: forecast.summary,
    treasuryM: party.organization.treasuryM,
    activistsK: party.organization.activistsK,
    projects: (record?.projects || []).map(({ kind, key, endDay }) => ({ kind, key, endDay })),
    regions: map.regions.filter(region => region.pop > 0).map(region => {
      const estimate = raw.get(region.id) || {};
      const shares = partyRegionalShares(country.pol, estimate, region.key, day);
      const ranked = Object.keys(shares).sort((a, b) => shares[b] - shares[a]);
      const support = shares[partyId] || 0;
      const leadId = ranked[0] || null;
      const rivalId = ranked.find(id => id !== partyId);
      const local = record?.regions[region.key];
      const headquarters = record?.headquarters?.key === region.key;
      const parties = partyRegionalBreakdown(country.pol, estimate, shares, region.key, day);
      const selected = parties.find(item => item.partyId === partyId);
      const quotes = {};
      for (const kind of ["rally", "investment", "headquarters"]) {
        const quote = partyRegionalQuote(sim, country, party, kind, region);
        if (quote.ok || ["budget", "resources"].includes(quote.reason)) {
          quote.projection = partyRegionalProjectProjection(country.pol, partyId, region, estimate, local,
            partyRegionalHeadquartersWeight(record, region.key), kind, quote, forecast);
        }
        quotes[kind] = quote;
      }
      return {
        id: region.id, key: region.key, name: region.name, pop: region.pop,
        support, leadId, margin: support - (shares[rivalId] || 0),
        boost: support - (estimate[partyId] || 0),
        permanentBoost: (selected?.presenceBoost || 0) + (selected?.headquartersBoost || 0),
        presenceBoost: selected?.presenceBoost || 0,
        headquartersBoost: selected?.headquartersBoost || 0,
        rallyBoost: selected?.rallyBoost || 0,
        rivalBoost: selected?.rivalEffect || 0,
        rallyFullUntil: selected?.rallyFullUntil ?? null,
        presence: selected?.presence || 0,
        headquarters,
        parties,
        lastAction: local?.lastAction || null,
        quotes,
      };
    }),
  };
}

function advancePartyRegionalAI(sim, country, electionIn) {
  const rules = gpmCampaignRulesFor(sim);
  if (rules.regionalAI === "domestic" && country.key !== sim.playerKey) return;
  const preferred = electionIn <= 70 ? "rally" : "investment";
  const eligible = (country.pol?.parties || []).filter(party => party.organization && party.legal !== false &&
    !party.gpmUprisingShell && !party.gpmUprisingExcluded &&
    !iGr(sim, country, party.id) && party.organization.treasuryM > .02 &&
    party.organization.activistsK > .08 && (party.gpmRegional?.projects.length || 0) < rules.maxRegionalProjects);
  if (!eligible.length) return;
  // Share one world pass across the country's staggered monthly decisions.
  let index = gpmRegionalAICache.get(sim);
  const month = Math.floor(sim.day / 30);
  if (index?.month !== month) {
    const provinces = new Map();
    for (const province of sim.world?.provinces || []) {
      const key = ke(province);
      if (!key || !province.__lean || !(province.__pop > 0)) continue;
      const list = provinces.get(key) || [];
      list.push(province);
      provinces.set(key, list);
    }
    index = { month, provinces };
    gpmRegionalAICache.set(sim, index);
  }
  const populated = (index.provinces.get(country.key) || []).filter(province => fi(province, country.key))
    .map(province => ({ id: province.__provId, key: province.__provKey, name: province.__name || "",
      pop: province.__pop, lean: province.__lean })).sort((a, b) => b.pop - a.pop || a.id - b.id);
  if (!populated.length) return;
  const focus = rules.aiPlanning === "basic" ? 6 : rules.aiPlanning === "strong" ? 18 : 12;
  const regionKeys = new Set(populated.slice(0, focus).map(region => region.id));
  const other = populated.slice(focus);
  if (other.length) {
    const offset = (Math.floor(sim.day / 30) + (country.hash >>> 0)) % other.length;
    for (let i = 0; i < Math.min(Math.ceil(focus / 2), other.length); i++) {
      regionKeys.add(other[(offset + i) % other.length].id);
    }
  }
  const regions = new Map(populated.filter(region => regionKeys.has(region.id)).map(region => [region.id, region]));
  const estimates = Ywe(country.pol, { day: sim.day, regions: [...regions.values()], partyPerf: sim._partyPerf(country) });
  for (const party of eligible) {
    let best = null;
    const candidates = party.gpmRegional?.headquarters || electionIn <= 90
      ? [preferred] : [preferred, "headquarters"];
    for (const estimate of estimates) {
      const region = regions.get(estimate.id);
      if (!region) continue;
      const support = estimate.shares[party.id] || 0;
      const leader = Math.max(...Object.values(estimate.shares));
      if (!support) continue;
      for (const kind of candidates) {
        const quote = partyRegionalQuote(sim, country, party, kind, region);
        if (quote.endDay >= sim.day + electionIn || !partyModAICanCommit(party, quote, electionIn)) continue;
        const weight = kind === "investment"
          ? (quote.chance * quote.presenceGain.strong + (1 - quote.chance) * quote.presenceGain.partial) * gpmRegionalRules.presenceWeight
          : quote.gain * (kind === "headquarters" ? 1.5 : 1);
        const competition = rules.aiPlanning === "basic" ? 1 : Math.exp(-(rules.aiPlanning === "strong" ? 6 : 4) * (leader - support));
        const score = Math.sqrt(region.pop) * support * competition * weight / Math.max(.000001, quote.cash);
        if (score > (best?.score || 0)) best = { kind, region, score };
      }
    }
    if (best) partyRegionalStart(sim, country, party, best.kind, best.region);
  }
}

module.exports = {
  rules,
  workerFunctions: ["const gpmRegionalAICache = new WeakMap();", partyRegionalProvince, partyRegionalRallyWeight, partyRegionalPresence, partyCampaignSmallPartyFactor,
    partyRegionalPermanentWeight, partyRegionalHeadquartersWeight, partyRegionalWeight,
    partyRegionalShares, partyRegionalNationalTotals, partyRegionalNormalize, partyRegionalNationalShares,
    partyRegionalQuote, partyRegionalStart, advancePartyRegionalCampaign, registerPartyRegionalCampaign,
    partyRegionalNationalForecast, partyRegionalProjectProjection, partyRegionalBreakdown, partyRegionalCampaignView, advancePartyRegionalAI],
};

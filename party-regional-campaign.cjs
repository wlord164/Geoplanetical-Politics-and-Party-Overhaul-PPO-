"use strict";

const rules = {
  rally: { days: 7, cash: .012, activists: .08 },
  investment: { days: 42, cash: .03, activists: .16 },
  headquarters: { days: 28, cash: .055, activists: .22 },
  rallyHalfLife: 45,
  rallyCooldown: 35,
  rallyLimit: .55,
  presenceWeight: .28,
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
  const weight = rally.weight * Math.pow(.5, (day - rally.day) / gpmRegionalRules.rallyHalfLife);
  return weight >= .001 ? weight : 0;
}

function partyRegionalWeight(party, provinceKey, day) {
  const record = party.gpmRegional;
  if (!record || party.legal === false) return 0;
  const local = record.regions[provinceKey];
  return (local?.presence || 0) * gpmRegionalRules.presenceWeight
    + partyRegionalRallyWeight(local?.rally, day)
    + (record.headquarters?.key === provinceKey ? gpmRegionalRules.headquartersWeight : 0);
}

function partyRegionalShares(polity, shares, key, day) {
  if (!key) return shares;
  let adjusted = null;
  let extra = 0;
  for (const party of polity.parties) {
    if (!(shares[party.id] > 0)) continue;
    const gain = shares[party.id] * partyRegionalWeight(party, key, day);
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

function partyRegionalNationalShares(polity, map, supports) {
  if (!map?.regions?.length || !polity.parties.some(party => party.gpmRegional)) return supports;
  const regions = vIe(polity, map, supports, false);
  const population = regions.reduce((total, region) => total + region.pop, 0);
  const total = Object.values(supports).reduce((sum, share) => sum + share, 0);
  if (!(population > 0 && total > 0)) return supports;
  let adjusted = null;
  for (const region of regions) {
    const shares = partyRegionalShares(polity, region.shares, region.key, map.day);
    if (shares === region.shares) continue;
    adjusted ??= { ...supports };
    for (const id of Object.keys(supports)) {
      adjusted[id] += ((shares[id] || 0) - (region.shares[id] || 0)) * region.pop / population * total;
    }
  }
  if (!adjusted) return supports;
  let adjustedTotal = 0;
  for (const id of Object.keys(adjusted)) {
    adjusted[id] = supports[id] > 0 ? Math.max(0, adjusted[id]) : 0;
    adjustedTotal += adjusted[id];
  }
  if (!(adjustedTotal > 0)) return supports;
  for (const id of Object.keys(adjusted)) adjusted[id] *= total / adjustedTotal;
  return adjusted;
}

function partyRegionalQuote(sim, country, party, kind, region) {
  const rule = gpmRegionalRules[kind];
  if (!party?.organization || party.legal === false) return { ok: false, reason: "party" };
  if (!region || !rule) return { ok: false, reason: "region" };
  const day = sim.day || 0;
  const record = party.gpmRegional;
  const local = record?.regions[region.key];
  const presence = local?.presence || 0;
  const hasHeadquarters = record?.headquarters?.key === region.key;
  const scale = Math.min(2.5, Math.sqrt(region.pop));
  const cash = Math.round(rule.cash * (1 + scale) * (kind === "rally" ? 1 - .25 * presence : 1) * 1e6) / 1e6;
  const activistsK = GN(rule.activists * (1 + scale));
  const rally = partyRegionalRallyWeight(local?.rally, day + rule.days);
  const fit = Math.exp(-.4 * Hp(party.ideology, region.lean) ** 2);
  const credibility = party.organization.credibility ?? .5;
  const chance = Math.max(.25, Math.min(.9, .34 + .30 * fit + .16 * credibility + .10 * presence + (hasHeadquarters ? .06 : 0)));
  const rallyGain = Math.min(gpmRegionalRules.rallyLimit - rally, .24 + .08 * fit + .08 * presence);
  const availableDay = (local?.rally?.day ?? -gpmRegionalRules.rallyCooldown) + gpmRegionalRules.rallyCooldown;
  const organization = party.organization;
  let reason = null;
  if (record?.projects.some(project => project.kind === kind)) reason = "active";
  else if (kind === "headquarters" && record?.headquarters &&
    partyRegionalProvince(sim, country, record.headquarters.id, record.headquarters.key)) reason = "headquarters";
  else if (kind === "rally" && day < availableDay) reason = "cooldown";
  else if (kind === "investment" && presence >= 1) reason = "saturated";
  else if (organization.treasuryM < cash) reason = "budget";
  else if (organization.activistsK < activistsK) reason = "resources";
  return {
    ok: !reason, reason, cash, activistsK, availableDay, days: rule.days, endDay: day + rule.days,
    chance: kind === "investment" ? chance : null,
    gain: kind === "rally" ? rallyGain : kind === "headquarters" ? gpmRegionalRules.headquartersWeight : null,
  };
}

function partyRegionalStart(sim, country, party, kind, region) {
  const quote = partyRegionalQuote(sim, country, party, kind, region);
  if (!quote.ok) return quote;
  const day = sim.day || 0;
  const record = party.gpmRegional ??= { regions: {}, projects: [], headquarters: null };
  party.organization.treasuryM = Math.round((party.organization.treasuryM - quote.cash) * 1e6) / 1e6;
  party.organization.activistsK = GN(party.organization.activistsK - quote.activistsK);
  // The result is bound to the project at commitment and survives a save/reload.
  const salt = YNr(JSON.stringify([sim.rngSeed0, country.key, party.id, region.key, day]));
  const roll = ((Math.imul(salt ^ (salt >>> 16), 0x45d9f3b) >>> 0) / 0x100000000);
  record.projects.push({
    kind, id: region.id, key: region.key, endDay: quote.endDay, activistsK: quote.activistsK,
    gain: quote.gain, strongInvestment: kind === "investment" && roll < quote.chance,
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
      local.rally = { day: finishDay, weight: Math.min(gpmRegionalRules.rallyLimit, existing + project.gain) };
    } else if (project.kind === "investment") {
      const gain = project.strongInvestment ? .24 : .07;
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

function partyRegionalCampaignView(sim, country, partyId) {
  const party = WN(country, partyId);
  if (!party?.organization) return null;
  const map = Ix(sim, country);
  const raw = new Map(vIe(country.pol, map, null, false).map(region => [region.id, region.shares]));
  const record = party.gpmRegional;
  const day = sim.day || 0;
  return {
    partyId,
    countryKey: country.key,
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
      return {
        id: region.id, key: region.key, name: region.name, pop: region.pop,
        support, leadId, margin: support - (shares[rivalId] || 0),
        boost: support - (estimate[partyId] || 0),
        presence: local?.presence || 0,
        headquarters: record?.headquarters?.key === region.key,
        lastAction: local?.lastAction || null,
        quotes: Object.fromEntries(["rally", "investment", "headquarters"].map(kind =>
          [kind, partyRegionalQuote(sim, country, party, kind, region)])),
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
  workerFunctions: [partyRegionalProvince, partyRegionalRallyWeight, partyRegionalWeight, partyRegionalShares,
    partyRegionalNationalShares, partyRegionalQuote, partyRegionalStart, advancePartyRegionalCampaign,
    registerPartyRegionalCampaign, partyRegionalCampaignView, advancePartyRegionalAI],
};

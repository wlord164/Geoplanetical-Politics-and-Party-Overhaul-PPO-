const gpmHistoricalRegionalProfiles = new Set(["self_governing_territory", "autonomous_region", "free_association"]);

function gpmHistoricalVictoryRegionPlan(sim, definition, actor, outcome) {
  const state = sim.gpmHistoricalState;
  if (!state || !["autonomy", "independence"].includes(outcome.scope)) return null;
  if (!outcome.title || !outcome.regionalOnly && zPt(outcome.title) !== outcome.title) return null;
  const country = gpmHistoricalCountry(sim, outcome.countryKey);
  if (!country || !Array.isArray(outcome.regionKeys) || !outcome.regionKeys.length) return null;
  const parentKey = country.key;
  const ownerKeys = outcome.regionalOnly && outcome.regionOwnerKeys?.length ? outcome.regionOwnerKeys : [parentKey];
  const regionKeys = [...new Set(outcome.regionKeys)];
  const existing = outcome.regionalOnly ? state.conflicts[definition.id]?.victoryOutcome : state.regionalOutcomes?.[actor.id];
  if (existing) return { existing };
  const childKey = "gpm-historical-polity-" + actor.id;
  if (!outcome.regionalOnly && (!gpmHistoricalVictoryRegimes[outcome.regime] || !country.pol?.chambers[0] ||
      Object.keys(outcome.laws || {}).some(lawId => !ba(lawId)) || sim.countries.has(childKey) ||
      sim.graveyard?.has(childKey) || ln(sim, parentKey)?.kind === "domestic_polity")) return null;
  const relationProfileId = outcome.relationProfileId || "self_governing_territory";
  if (outcome.scope === "autonomy" && !gpmHistoricalRegionalProfiles.has(relationProfileId)) return null;
  const overlap = new Map(gpmHistoricalDefinitions(state).map(row => [row.id, row]));
  const regions = [];
  for (const key of regionKeys) {
    const province = sim.world.provByKey.get(key);
    const shared = state.regions[key];
    if (!province || !ownerKeys.some(key => gpmHistoricalCountryMatches(key, province.__countryKey)) || province.__isCapital) return null;
    if (!outcome.regionalOnly && (shared?.regionalOutcome && shared.regionalOutcome.actorId !== actor.id ||
        shared?.localOutcomes?.some(local => local.actorId !== actor.id))) return null;
    const fronts = (shared?.fronts || []).filter(id => id !== definition.id &&
      ["active", "occupation"].includes(state.conflicts[id]?.status));
    if (!outcome.regionalOnly && (ke(province) !== parentKey || province.__occupier)) return null;
    if (outcome.scope === "independence" && !outcome.regionalOnly && fronts.some(id => {
      const rival = overlap.get(id);
      const area = rival?.regions?.find(row => row.key === key);
      const participants = rival?.sides?.flat() || [];
      return (state.conflicts[id]?.status === "occupation" ||
        !outcome.coexistingFrontIds?.includes(id) &&
        (rival?.native || rival?.territoryClaim || [area?.administrator, area?.controller].some(Boolean)) &&
        !participants.includes(actor.id));
    })) return null;
    regions.push({ key, province, shared, fronts });
  }
  return { parentKey, childKey, regions, relationProfileId };
}

function gpmHistoricalInstallVictoryRegions(sim, definition, actor, outcome) {
  const plan = gpmHistoricalVictoryRegionPlan(sim, definition, actor, outcome);
  if (!plan || plan.existing) return plan?.existing || null;
  const { parentKey, childKey, regions, relationProfileId } = plan;
  let government = null;
  if (!outcome.regionalOnly) {
    const change = { create: [{ key: childKey, parentKey, provIds: regions.map(row => row.province.__provId),
      a2: childKey, feature: W7o(childKey), name: outcome.title }] };
    const birth = kP(sim, change);
    if (!birth.ok) return null;
    const child = sim.countries.get(childKey);
    if (!child) throw new Error("Historical regional outcome did not create " + childKey);
    government = gpmHistoricalInstallVictoryGovernment(sim, child, actor, outcome);
    if (outcome.scope === "autonomy") {
      const autonomy = gOe(sim, childKey, { relationProfileId, sovereignKey: parentKey,
        administratorKey: childKey, securitySponsorKey: parentKey });
      if (!autonomy.ok) throw new Error("Could not assign historical autonomy to " + childKey + ": " + autonomy.reasonId);
    }
  }

  const state = sim.gpmHistoricalState;
  const result = {
    actorId: actor.id, scope: outcome.scope, countryKey: parentKey,
    polityKey: outcome.regionalOnly ? null : childKey, native: !outcome.regionalOnly,
    title: outcome.title, administration: outcome.administration || null,
    government: outcome.government || null, regime: outcome.regime || null,
    laws: government?.appliedLaws ?? (outcome.regionalOnly ? outcome.laws ?? {} : {}),
    regionalLaws: outcome.regionalLaws ?? [],
    regionKeys: regions.map(region => region.key), establishedDay: sim.day,
  };
  if (!outcome.regionalOnly) (state.regionalOutcomes ??= {})[actor.id] = result;
  for (const { key, province, shared, fronts } of regions) {
    const region = shared || (state.regions[key] = {
      ...gpmHistoricalRegion(sim, definition, { key, name: outcome.regionLabels?.[key] || province.__name }),
      fronts: [], disruption: 0,
    });
    if (!region.fronts.includes(definition.id)) region.fronts.push(definition.id);
    region.currentContested = !!(outcome.mixed || fronts.length || province.__occupier ||
      region.currentContested || outcome.regionalOnly && (region.contested || region.localOutcomes?.length));
    if (outcome.regionalOnly) {
      (region.localOutcomes ??= []).push(result);
    } else {
      region.regionalOutcome = result;
      region.currentController = actor.id;
      region.administrator = actor.id;
      region.legalOwner = province.__countryKey;
    }
  }
  return result;
}

const gpmUprising = (() => {

const statusField = "gpmUprising";
const victoryGain = .12;
const childPrefix = "ppo-uprising-";

function gpmUprisingCase(sim, key = sim.playerKey) {
  const country = sim.countries.get(key);
  const parentKey = country?.gpmUprisingParentKey ||
    (key?.startsWith(childPrefix) ? sim.world.byKey.get(key)?.__parentKey : key);
  const parent = sim.countries.get(parentKey);
  return { parent, state: parent?.[statusField] || null };
}

function gpmUprisingStatus(sim) {
  const { parent, state } = gpmUprisingCase(sim);
  const parentKey = parent?.key;
  const founderId = state?.founderId || Uo(parent);
  const child = sim.countries.get(state?.childKey);
  const founder = fS(parent, founderId);
  const branchFounder = fS(child, founderId);
  const war = state && sim.conflicts?.get(state.warId);
  const control = Ho(sim);
  const owned = key => wy(sim, key)?.provinceKeys || [];
  return {
    day: sim.day,
    campaignActive: S0(sim),
    noOccupation: sim.world.provinces.every(province => !province.__occupier ||
      ![parentKey, state?.childKey].includes(province.__occupier)),
    warCount: sim.wars?.size || 0,
    state,
    control: { countryKey: control.countryKey, partyId: control.partyId,
      campaignId: control.campaignId, controlsExecutive: control.controlsExecutive },
    parent: { key: parent?.key, name: Zr(sim, parent), lead: Xe(parent)?.government?.leadPartyId,
      founder: founder ? { legal: founder.legal, bannedYear: founder.bannedYear,
        treasury: founder.organization?.treasuryM, activists: founder.organization?.activistsK,
        influence: founder.organization?.influence, support: founder.support,
        electionEligible: Object.hasOwn(r6(parent.pol, { [founderId]: 0.5 }), founderId),
        ppoKeys: Object.keys(founder).filter(key => key.startsWith("gpm") && key !== "gpmUprisingShell").sort() } : null,
      owned: owned(parentKey), regime: su(parent.pol.constitution),
      ceremonial: !!parent.pol.constitution.organs.head_of_state.ceremonial,
      legalParties: parent.pol.parties.filter(party => party.legal !== false).map(party => party.id),
      chambers: parent.pol.chambers.map(chamber => chamber.composition), laws: parent.laws },
    child: child ? { key: child.key, name: child.name, lead: Xe(child)?.government?.leadPartyId,
      treasury: branchFounder?.organization?.treasuryM, owned: owned(child.key),
      regime: su(child.pol.constitution), ceremonial: !!child.pol.constitution.organs.head_of_state.ceremonial, legalParties: child.pol.parties.filter(party => party.legal !== false).map(party => party.id), laws: child.laws } : null,
    war: war ? { id: war.id, status: war.status, mode: war.mode, day: war.startDay,
      sideA: war.sideAKey, sideB: war.sideBKey, participants: Object.keys(war.participants || {}).sort(),
      registered: sim.wars.get(parentKey) === war, scope: MEe(sim, war)?.scope } : null,
    activeHostilities: child ? ga(sim, child.key, parentKey) : false,
  };
}

function gpmUprisingPartyShell(party) {
  const shell = { ...structuredClone(party), legal: false, support: 0, valence: 0, outreach: null, organization: { treasuryM: 0, activistsK: 0, influence: 0,
    credibility: 0, lastFundraiseMonth: null, lastRecruitMonth: null }, campaigns: {}, parliament: {} };
  for (const key of Object.keys(shell)) {
    if (key.startsWith("gpm")) delete shell[key];
  }
  shell.gpmUprisingShell = true;
  return shell;
}

function gpmUprisingInstallGovernment(sim, country, partyId, status) {
  const office = Ve(country, "head_of_gov");
  const candidate = Tio(sim, country, partyId, office)
    || Pso(sim, country, office, partyId);
  const institution = Xe(country);
  const transition = Yc(sim, country, {
    intent: "government.install",
    transitionId: "gpm.uprising.government:" + country.key + ":" + institution.revision,
    expectedRevision: institution.revision,
    day: sim.day,
    head: { personId: candidate.id, partyId, controllerRef: { kind: "party", id: partyId } },
    leadPartyId: partyId,
    coalitionPartyIds: [partyId],
    supportPartyIds: [],
    formationProcedureId: "gpm.uprising",
    status,
  });
  if (!transition.ok) throw new Error("Government transition failed: " + JSON.stringify(transition));
  Ff(sim, country);
}

function gpmUprisingCharter(country, party, year = 2026) {
  const draft = { ...country, laws: { ...country.laws } };
  const changes = new Map();
  const platform = gpmPresets[gpmActiveIdeologyPreset(party)];
  // Resolve dependent settings after their enabling law changes.
  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    for (const law of p1) {
      const from = country.laws?.[law.id];
      if (from == null || !$mt(draft, law).ok)
        continue;
      const commitment = gpmIdeologyLawTarget(platform, law.id, from, year);
      if (commitment !== undefined) {
        if (!Jr(draft.laws[law.id], commitment)) {
          draft.laws[law.id] = Ga(commitment);
          changed = true;
        }
        if (!Jr(from, commitment)) changes.set(law.id, { lawId: law.id, value: Ga(commitment), choiceId: "platform" });
        continue;
      }
      if (!Object.values(law.doctrine?.axes || {}).some(weight => Number.isFinite(weight) && weight !== 0)) continue;
      const distance = value => jWe(party, law, value, draft, null);
      const baseline = distance(from);
      const ceiling = are(law, country);
      let best = null;
      let bestDistance = baseline;
      let seed = from;
      // Compound settings can require more than one native choice to become coherent.
      const steps = law.schema.type === "object" && !Number.isFinite(ceiling) ? 6 : 1;
      for (let step = 0; step < steps; step++) {
        let next = null;
        const choices = Lg(law, draft, seed);
        // From a disabled benefit, the rate and duration must be introduced together.
        if (law.id === "unemployment_insurance" && seed.maxMonths === 0 && seed.replacementPct === 0) {
          const rate = choices.find(choice => choice.id === "rate_plus_10");
          const term = choices.find(choice => choice.id === "duration_plus_6");
          if (rate && term) choices.push({ id: "start_benefit", value: {
            ...term.value, replacementPct: rate.value.replacementPct,
          } });
        }
        if (law.id === "military_service" && seed.mode === "volunteer" && seed.months === 0) {
          const term = choices.find(choice => choice.id === "months_plus_6");
          const service = choices.find(choice => choice.id === "mode_selective");
          if (term && service) choices.push({ id: "start_service", value: {
            ...service.value, months: term.value.months,
          } });
        }
        for (const choice of choices) {
          const value = choice.value;
          if (Number.isFinite(ceiling) && value?.enabled !== false && value?.amountLocalMonthly > ceiling)
            continue;
          if (law.id === "unemployment_insurance" && (value.maxMonths > 0) !== (value.replacementPct > 0))
            continue;
          if (law.id === "military_service" && value.mode !== "volunteer" && value.months <= 0) continue;
          const score = distance(value);
          if (Number.isFinite(score) && score < bestDistance - 0.05) {
            bestDistance = score;
            next = choice;
          }
        }
        if (!next) break;
        best = next;
        seed = next.value;
      }
      if (baseline - bestDistance <= 2) best = null;
      if (best) CAa(law, jAa, UAa, country);
      const target = best?.value ?? from;
      if (!Jr(draft.laws[law.id], target)) {
        draft.laws[law.id] = target;
        changed = true;
      }
      if (best) changes.set(law.id, { lawId: law.id, value: Ga(target), choiceId: best.id });
      else changes.delete(law.id);
    }
    if (!changed) break;
  }
  return { assessed: p1.length, changes: [...changes.values()] };
}

function gpmApplyUprisingCharter(sim, country, charter) {
  const remaining = [...charter.changes];
  const applied = [];
  while (remaining.length) {
    const index = remaining.findIndex(item => $mt(country, ba(item.lawId)).ok);
    if (index < 0) break;
    const [item] = remaining.splice(index, 1);
    const law = ba(item.lawId);
    if (Jr(country.laws[law.id], item.value)) continue;
    Uno(sim, country, law, item.value, { procedure: {
      id: "gpm.uprising.charter:" + country.key + ":" + law.id + ":" + sim.day,
      kind: Lm(law), passed: true, resolutionMode: "founding_charter",
    } });
    Hno(country, item);
    applied.push(item);
  }
  return applied;
}

function gpmUprisingReform(country, profile) {
  const chamber = country.pol.chambers[0];
  const draft = Bht(country, chamber, profile);
  draft.constitution.organs.head_of_state.ceremonial = profile.ceremonial;
  return draft;
}

function gpmUprisingGovernment(sim, country, founder, profile, transitional, customizeDraft) {
  const partyId = founder.id;
  const draft = gpmUprisingReform(country, profile);
  customizeDraft?.(draft);
  const rivals = country.pol.parties.filter(party => party.id !== partyId && party.legal !== false);
  const weights = Object.fromEntries(rivals.map(party => [party.id, Math.max(.0001, party.support || 0)]));
  for (const chamber of draft.draftChambers) {
    if (profile.singleParty || !rivals.length) {
      chamber.composition = { [partyId]: chamber.seats };
    } else if (transitional) {
      const governing = Math.floor(chamber.seats / 2) + 1;
      chamber.composition = { ...tj(weights, chamber.seats - governing), [partyId]: governing };
    } else {
      chamber.composition = Object.fromEntries(Object.entries(chamber.composition || {})
        .filter(([id, count]) => rivals.some(party => party.id === id) && count > 0));
    }
    oM(chamber);
  }

  const folded = Ve(country, "head_of_gov") === Ve(country, "head_of_state");
  const status = transitional || profile.singleParty || !profile.ceremonial ? "installed" : "minority";
  gpmUprisingInstallGovernment(sim, country, partyId, status);
  const head = ut(country, "head_of_gov");
  const president = !profile.headGovExists ? head :
    Vc(sim, { countryKey: country.key, party: partyId, role: draft.constitution.organs.head_of_state.role,
      born: sim._simYear - 45, since: sim._simYear }).id;
  const officeholder = personId => ({ personId, partyId, controllerRef: { kind: "party", id: partyId } });
  // Unfolding needs distinct, explicit officeholders even in a one-party parent.
  const institution = Xe(country);
  const transition = Yc(sim, country, {
    intent: "constitution.reconcile",
    transitionId: "gpm.uprising.constitution:" + country.key + ":" + institution.revision,
    expectedRevision: institution.revision, constitutionRevision: institution.constitutionRevision + 1,
    day: sim.day, sourceProcedureId: "gpm.uprising.charter",
    constitution: draft.constitution, chambers: draft.draftChambers,
    government: { coalitionPartyIds: [partyId], supportPartyIds: [], status },
    replaceHeadOfState: officeholder(president),
    ...(folded && profile.headGovExists ? { unfoldHead: officeholder(head) } : {}),
  });
  if (!transition.ok || Xr(country) !== partyId)
    throw new Error("Uprising constitution failed: " + JSON.stringify(transition));
  wMa(country);
  Object.assign(country.pol.regime, draft.polity.regime);
  if (profile.singleParty) {
    for (const party of country.pol.parties) {
      if (party.id === partyId) continue;
      party.legal = false;
      party.gpmUprisingExcluded = true;
      party.campaigns = {};
    }
  }
  country.pol.campaignPolls = {};
  qy(sim, country, sim._simYear);
  if (sim.playerKey === country.key) yS(sim, country);
  j2e(sim, country);
  sim._reclassRegime(country, true);
}

function gpmUprisingStartingIdentity(country, customName = null) {
  const system = gpmUprisingSystemFromBlueprint(country.pol?.constitution?.blueprint);
  const name = customName || gpmUprisingOfficialNames[country.key] || country.name;
  return system && name ? { system, name, custom: !!customName } : null;
}

function gpmUprisingCaptureStartingIdentities(sim) {
  for (const country of sim.countries.values()) {
    if (country.__born || country.gpmUprisingStartingIdentity) continue;
    const identity = gpmUprisingStartingIdentity(country, sim.customNames?.[country.key]);
    if (identity) country.gpmUprisingStartingIdentity = identity;
  }
}

function gpmUprisingTerritoryPlan(sim, parent, founder) {
  const owned = Q6(sim, parent.key);
  const population = owned.reduce((sum, province) => sum + (province.__pop || 0), 0);
  const support = new Map(Ywe(parent.pol, PE(sim, parent)).map(region =>
    [region.key, region.shares[founder.id] || 0]));
  const rows = owned.map(province => ({
    province,
    ...gpmUprisingFoothold(founder, province, support.get(province.__provKey)),
    project: founder.gpmUprisingPreparations?.regions?.[province.__provKey]?.project || null,
    eligible: province.__countryKey === parent.key && !province.__isCapital && !province.__occupier &&
      !!partyRegionalProvince(sim, parent, province.__provId, province.__provKey) &&
      province.__pop <= population * .80 && !!province.__adjAll?.some(id => ke(sim.world.provinces[id]) === parent.key),
  }));
  const headquartersKey = founder.gpmRegional?.headquarters?.key;
  const headquarters = rows.find(row => row.province.__provKey === headquartersKey);
  const state = founder.gpmUprisingPreparations;
  const threshold = uprisingPreparationRules.threshold;
  const reason = !rows.some(row => row.eligible) ? "territory" :
    !headquartersKey ? "headquarters_required" : !headquarters?.eligible ? "headquarters_region" :
    headquarters.foothold < threshold ? "headquarters_foothold" :
    !state?.wing || !gpmUprisingRoster(state).length ? "division_required" : null;
  const province = reason ? null : headquarters.province;
  const joining = new Set();
  const provinces = [];
  if (!province) return { reason, province, joining, rows, headquarters };
  joining.add(province.__provId);
  provinces.push(province);
  let joiningPopulation = province.__pop;
  const eligibleDefectors = new Map(rows.filter(row => row.eligible && row.foothold >= threshold)
    .map(row => [row.province.__provId, row]));
  for (let index = 0; index < provinces.length; index++) {
    const neighbors = (provinces[index].__adjAll || []).map(id => eligibleDefectors.get(id))
      .filter(Boolean).sort((a, b) => b.foothold - a.foothold || a.province.__provId - b.province.__provId);
    for (const { province: neighbor } of neighbors) {
      if (joining.has(neighbor.__provId) || joiningPopulation + neighbor.__pop > population * .80) continue;
      joining.add(neighbor.__provId);
      provinces.push(neighbor);
      joiningPopulation += neighbor.__pop;
    }
  }
  return { reason, province, joining, rows, headquarters };
}

function gpmUprisingEligibility(sim, parent, founder) {
  if (parent?.[statusField]) return "case_exists";
  if (sim.playerKey !== parent?.key || !founder?.organization || founder.legal === false)
    return "founder_control";
  const parentKey = parent.key;
  const founderId = founder.id;
  const territory = wy(sim, parentKey);
  if (!Xe(parent) || !parent.pol.chambers?.length || territory?.sovereignKey !== parentKey ||
      territory.primaryDefenseAuthorityKey !== parentKey || territory.primaryDiplomacyAuthorityKey !== parentKey ||
      parent.pol.constitution.organs.head_of_state.source === "sovereign")
    return "scope";
  const incumbent = _t(parent);
  const incumbentParty = incumbent && fS(parent, incumbent);
  if (!incumbentParty || incumbentParty.legal === false || p1a(parent.pol).has(founderId) ||
      parent.pol.chambers.some(chamber => (chamber.composition?.[founderId] || 0) > 0))
    return "unsupported_party_roles";
  if (gpmHistoricalBlocksUprising(sim, parentKey) ||
      [...(sim.wars?.values() || [])].some(war => war.sideAKey === parentKey || war.sideBKey === parentKey) ||
      [...(sim.conflicts?.values() || [])].some(conflict =>
    conflict.participants?.[parentKey] && (conflict.status === "active" || conflict.status === "suspended")))
    return "existing_war";
  return null;
}

function gpmUprisingProposal(sim, parent, founder) {
  const reason = gpmUprisingEligibility(sim, parent, founder);
  if (reason) return { reason };
  const parentKey = parent.key;
  const founderId = founder.id;
  const incumbent = _t(parent);
  const territoryPlan = gpmUprisingTerritoryPlan(sim, parent, founder);
  const { province } = territoryPlan;
  if (territoryPlan.reason) return { reason: territoryPlan.reason, territoryPlan };
  const divisions = gpmUprisingRoster(founder.gpmUprisingPreparations);
  const founderSupport = founder.support;
  if (!Number.isFinite(founderSupport) || founderSupport < 0 || founderSupport > 1)
    return { reason: "founder_control" };
  const profile = gpmUprisingProfile(founder);
  try { gpmUprisingReform(parent, profile); }
  catch { return { reason: "constitution", territoryPlan }; }
  const parentName = sim.customNames?.[parentKey] || gpmUprisingOfficialNames[parentKey] || parent.name;
  const seed = parentKey === "422" && founder.nameDesc?.gpmTag === "ASBP" ? undefined :
    va(JSON.stringify([sim.rngSeed0, Ho(sim).campaignId, parentKey, founderId, profile.regime]));
  const starting = parent.gpmUprisingStartingIdentity ||
    (!parent.__born ? gpmUprisingStartingIdentity(parent) : null);
  const restoresOriginalName = !!starting && starting.system === gpmUprisingSystemFromProfile(profile);
  const identity = restoresOriginalName
    ? { name: gpmUprisingRevolutionaryName(parentKey, starting.name) }
    : gpmUprisingIdentity(parentKey, parentName, profile, seed);
  const names = [identity.name, ...(identity.alternatives || [])]
    .filter((name, index, list) => zPt(name) === name && name && list.indexOf(name) === index);
  if (!names.length) return { reason: "name", territoryPlan };
  const victorySupport = Math.min(1, founderSupport + victoryGain);
  const charter = gpmUprisingCharter(parent, founder, sim._simYear);
  const quoteId = JSON.stringify([sim.day, parentKey, founderId, [...territoryPlan.joining], divisions, incumbent, founderSupport,
    va(JSON.stringify([profile, names, charter.changes, restoresOriginalName ? starting : null]))]);
  return { province, territoryPlan, divisions, incumbent, founderSupport, victorySupport, charter, quoteId, names, profile, parentName,
    restoration: restoresOriginalName ? starting : null };
}

function gpmUprisingView(sim) {
  const { parent, state } = gpmUprisingCase(sim);
  const child = state && sim.countries.get(state.childKey);
  const founder = fS(child || parent, state?.founderId || Uo(parent));
  const proposal = state ? {} : gpmUprisingProposal(sim, parent, founder);
  const phase = state?.phase || (proposal.reason ? "unavailable" : "ready");
  const war = state && sim.conflicts.get(state.warId);
  const profile = state?.profile || proposal.profile || (state && gpmUprisingProfile(founder));
  const province = proposal.province || sim.world.provByKey.get(state?.provinceKey);
  return {
    phase, available: phase === "ready", reason: proposal.reason || null, day: sim.day,
    preparations: proposal.territoryPlan ? gpmUprisingPreparationView(sim, parent, founder, proposal.territoryPlan) : null,
    deployedCount: state?.deployedCount || 0, deployedRoster: state?.deployedRoster || [],
    defectingRegions: state?.defectingRegions || [],
    countryKey: sim.playerKey, partyId: Uo(sim.player), founderId: founder?.id,
    partyName: founder?.nameDesc?.gpmName || null, parentKey: parent?.key,
    parentName: state?.parentName || proposal.parentName || gpmUprisingOfficialNames[parent?.key] || parent?.name,
    breakawayName: state?.breakawayName || child?.name || proposal.names?.[0] ||
      (state && parent?.key === "422" ? "Democratic People's Republic of Lebanon" : null),
    victoryName: state?.victoryName || state?.breakawayName || proposal.restoration?.name || proposal.names?.[0],
    restoresOriginalName: state ? !!state.restoresOriginalName : !!proposal.restoration,
    names: proposal.names || [], provinceKey: province?.__provKey, regionName: province?.__name,
    government: profile?.label, singleParty: profile?.singleParty, ceremonial: profile?.ceremonial,
    ideologyProgram: gpmPresets[profile?.preset]?.program || null,
    nationalSupport: state ? state.founderSupport : proposal.founderSupport,
    victorySupport: state ? state.victorySupport : proposal.victorySupport,
    result: state?.result || null, quoteId: proposal.quoteId || null,
    warStatus: war?.status || null,
    charterLaws: state ? state.appliedLaws || state.charter?.changes || [] : proposal.charter?.changes || [],
    charterAssessed: state?.charter?.assessed || proposal.charter?.assessed,
  };
}

function gpmUprisingOpen(sim, country, input) {
  const { parent, state } = gpmUprisingCase(sim);
  if (state) return { ok: false, reason: "case_exists" };
  const founder = fS(parent, Uo(parent));
  const proposal = gpmUprisingProposal(sim, parent, founder);
  if (proposal.reason) return { ok: false, reason: proposal.reason };
  if (input.quoteId !== proposal.quoteId) return { ok: false, reason: "stale" };
  const { province, territoryPlan, divisions, incumbent, founderSupport, victorySupport, charter, profile, parentName, names, restoration } = proposal;
  const breakawayName = input.name ?? names[0];
  if (!names.includes(breakawayName)) return { ok: false, reason: "name" };
  const flag = input.flag ?? null;
  if (flag !== null && !D7t(flag)) return { ok: false, reason: "flag" };
  const parentKey = parent.key;
  const founderId = founder.id;
  const provinceKey = province.__provKey;
  const childKey = childPrefix + parentKey + "-" + sim.day;
  const plan = { create: [{ key: childKey, parentKey, provIds: [...territoryPlan.joining],
    a2: childKey, feature: W7o(childKey), name: breakawayName, hostile: true }] };
  const goal = SQ(sim, { actorKey: childKey, targetCountryKey: parentKey, casusBelliId: "coercion" });
  const validation = Uyt(sim, plan);
  if (!validation.ok || !goal.ok) return { ok: false, reason: validation.reasonId || goal.reasonId };
  const split = kP(sim, plan);
  if (!split.ok) throw new Error("Unable to create the breakaway: " + split.reasonId);
  const child = sim.countries.get(childKey);

  // Use one organization across the split. Native country creation clones every party.
  parent.pol.parties = parent.pol.parties.map(party => party.id === founderId
    ? gpmUprisingPartyShell(party) : party);
  lSa(sim, parent);
  child.gpmUprisingParentKey = parentKey;
  child.pol.parties = child.pol.parties.map(party => {
    if (party.id === founderId) return founder;
    const empty = gpmUprisingPartyShell(party);
    if (profile.singleParty || party.legal === false) return empty;
    empty.legal = true;
    empty.support = party.support;
    empty.valence = party.valence;
    delete empty.gpmUprisingShell;
    return empty;
  });
  gpmUprisingGovernment(sim, child, founder, profile, true);
  const childCharter = gpmUprisingCharter(child, founder, sim._simYear);
  gpmApplyUprisingCharter(sim, child, childCharter);
  const handoff = sim.switchPlayerControl({ countryKey: childKey, partyId: founderId });
  if (!handoff.ok || !handoff.current.controlsExecutive) throw new Error("Breakaway control failed");

  // Completed preparations enter the native roster. Unfinished projects end at declaration.
  R7(sim, child);
  gpmUprisingDeployPreparations(sim, child, province, divisions);
  delete founder.gpmUprisingPreparations;
  const target = wy(sim, parentKey);
  const war = fDa(sim, parent, { selectedTargetActorKey: parentKey,
    targetDefenseAuthorityKeys: target.defenseAuthorityKeys,
    targetDiplomacyAuthorityKeys: target.diplomacyAuthorityKeys,
    targetProvinceKeys: target.provinceKeys, enemyPop0: parent.pop,
    enemyProvTotal0: target.provinceKeys.length, cb: "coercion",
    campaign: { scope: "full_war", doctrine: "balanced" },
    warGoals: { A: [goal.goal], B: [nde(parentKey, childKey, sim.day)] } });
  if (!war || sim.conflicts.get(war.id) !== war || !ga(sim, childKey, parentKey))
    throw new Error("Civil war was not registered");
  Ayt(sim, war);
  H(sim, "war.player_declared", { warId: war.id, playerKey: childKey, enemyKey: parentKey,
    selectedTargetActorKey: parentKey, casusBelli: "coercion" }, { category: "guerre", severity: "danger" });
  parent[statusField] = { version: 1, id: childKey, childKey, warId: war.id, phase: "active",
    openedDay: sim.day, provinceKey, founderId, founderSupport, victorySupport, charter, incumbent,
    deployedCount: divisions.length, deployedRoster: divisions.map(gpmUprisingDivisionLabel),
    defectingRegions: [...territoryPlan.joining].map(id => sim.world.provinces[id].__provKey),
    parentName, breakawayName, victoryName: restoration?.name || breakawayName,
    restoresOriginalName: !!restoration, restoreCustomName: !!restoration?.custom, profile,
    ...(flag ? { flag: { src: flag.src, ratio: flag.ratio } } : {}) };
  return { ok: true, ...gpmUprisingView(sim) };
}

function gpmUprisingMatches(sim, war) {
  const { state } = gpmUprisingCase(sim, war?.sideBKey || "");
  return !!(war && state?.phase === "active" && war.id === state.warId &&
    war.sideAKey === state.childKey && war.startDay === state.openedDay);
}

function gpmUprisingRecordResult(sim, war, outcome) {
  if (!gpmUprisingMatches(sim, war)) return;
  const { state } = gpmUprisingCase(sim, war.sideBKey);
  if (outcome !== "victory" && outcome !== "defeat") {
    Object.assign(state, { phase: "settled", result: "separated", settledDay: sim.day });
    return;
  }
  Object.assign(state, { phase: "resolving", nativeOutcome: outcome, outcomeEvidence: war.gpmDecisiveEvidence });
}

function gpmUprisingSettleCase(sim, parent, state) {
  const parentKey = parent.key;
  const founderId = state.founderId;
  const result = state.nativeOutcome === "victory" ? "breakaway" : "government";
  const child = sim.countries.get(state.childKey);
  const founder = fS(child, founderId);
  const incumbent = fS(parent, Xr(parent)) || fS(parent, _t(parent));
  const targetParty = result === "breakaway" ? founder : incumbent;
  if (!child || sim.conflicts.has(state.warId) || !targetParty || targetParty.legal === false ||
      !fS(parent, founderId)?.gpmUprisingShell)
    throw new Error("Civil war succession has inconsistent parties or territory");
  const plan = { moves: [{ provIds: wy(sim, child.key).provinceIds, to: parentKey }] };
  const validation = Uyt(sim, plan);
  if (!validation.ok) throw new Error("Civil war reunification cannot proceed: " + validation.reasonId);

  // Native combat has closed the war. Transfer control before retiring the breakaway.
  if (result === "breakaway") {
    // Apply the victory gain to the prewar national share and retain
    // the incumbent parties' relative standings.
    const otherParties = parent.pol.parties.filter(party => party.id !== founderId);
    const otherSupport = otherParties.reduce((total, party) => total + party.support, 0);
    founder.support = state.victorySupport;
    for (const party of otherParties) {
      party.support = (1 - founder.support) * (otherSupport > 0
        ? party.support / otherSupport : 1 / otherParties.length);
    }
    parent.pol.parties = parent.pol.parties.map(party => party.id === founderId ? founder : party);
    lSa(sim, parent);
    state.profile ||= gpmUprisingProfile(founder);
    state.breakawayName ||= child.name;
    gpmUprisingGovernment(sim, parent, founder, state.profile, false);
    state.victoryName ||= state.breakawayName;
    // The normal display path supplies PPO's scenario title when the native override is empty.
    if (state.restoresOriginalName && !state.restoreCustomName) {
      VPt(sim, parentKey, "");
    } else if (!VPt(sim, parentKey, state.victoryName)) {
      throw new Error("Uprising country name is invalid");
    }
    state.appliedLaws = gpmApplyUprisingCharter(sim, parent, state.charter);
    if (state.flag && parent.a2 && !zXa(sim, parent.a2, state.flag)) state.flagRetained = true;
  } else {
    fS(parent, founderId).bannedYear = sim._simYear || 2026;
  }
  if (sim.playerKey === child.key || sim.playerKey === parentKey) {
    const handoff = sim.switchPlayerControl({ countryKey: parentKey, partyId: targetParty.id });
    if (!handoff.ok || !handoff.current.controlsExecutive) throw new Error("Postwar control failed");
  }
  const returned = kP(sim, plan);
  if (!returned.ok || sim.countries.has(child.key)) throw new Error("Postwar reunification failed");
  Object.assign(state, { phase: "settled", result, settledDay: sim.day });
}

function gpmUprisingSettle(sim) {
  for (const parent of sim.countries.values()) {
    const state = parent[statusField];
    if (state?.phase === "resolving") gpmUprisingSettleCase(sim, parent, state);
  }
}

function gpmUprisingFlags(sim) {
  const flags = {};
  for (const country of sim.countries.values()) {
    const state = country[statusField];
    if (!state) continue;
    const key = sim.countries.get(state.childKey)?.a2?.toLowerCase();
    const parentFlag = country.a2?.toLowerCase();
    if (key && parentFlag) {
      flags[key] = { parentFlag, ...(state.flag || {}) };
    } else if (state.result === "breakaway" && state.flagRetained && parentFlag) {
      flags[parentFlag] = state.flag;
    }
  }
  return flags;
}

n5t("gpm.party.uprising.declare", { apply: gpmUprisingOpen });
for (const action of ["form", "headquarters", "invest", "recruit", "aidRequest", "aidAccept", "aidDecline"]) {
  n5t("gpm.party.uprising." + action, {
    apply: (sim, country, input) => gpmUprisingPrepare(sim, country, input, action),
  });
}
return { view: gpmUprisingView, flags: gpmUprisingFlags, matches: gpmUprisingMatches, record: gpmUprisingRecordResult,
  captureStartingIdentities: gpmUprisingCaptureStartingIdentities,
  settle: gpmUprisingSettle, inspect: gpmUprisingStatus, advancePreparations: gpmUprisingAdvancePreparations,
  applyCharter: gpmApplyUprisingCharter, installGovernment: gpmUprisingGovernment };
})();

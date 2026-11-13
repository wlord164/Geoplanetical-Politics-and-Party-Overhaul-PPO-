const gpmUprising = (() => {

const parentKey = "422";
const founderId = "np1";
const statusField = "gpmUprising";
const breakawayName = "Democratic People's Republic of Lebanon";
const provinceKey = "LBN-3023";
const victoryGain = 0.12;

function gpmUprisingStatus(sim) {
  const parent = sim.countries.get(parentKey);
  const state = parent?.[statusField] ?? null;
  const child = sim.countries.get(state?.childKey);
  const founder = Rb(parent, founderId);
  const branchFounder = Rb(child, founderId);
  const war = state && sim.conflicts?.get(state.warId);
  const control = Wo(sim);
  const owned = key => ly(sim, key)?.provinceKeys || [];
  return {
    day: sim.day,
    campaignActive: n0(sim),
    noOccupation: sim.world.provinces.every(province => !province.__occupier ||
      ![parentKey, state?.childKey].includes(province.__occupier)),
    warCount: sim.wars.size,
    state,
    control: { countryKey: control.countryKey, partyId: control.partyId,
      campaignId: control.campaignId, controlsExecutive: control.controlsExecutive },
    parent: { key: parent?.key, name: parent?.name, lead: ot(parent)?.government?.leadPartyId,
      founder: founder ? { legal: founder.legal, bannedYear: founder.bannedYear,
        treasury: founder.organization?.treasuryM, activists: founder.organization?.activistsK,
        influence: founder.organization?.influence, support: founder.support,
        electionEligible: Object.hasOwn(Dh(parent.pol, { [founderId]: 0.5 }), founderId),
        ppoKeys: Object.keys(founder).filter(key => key.startsWith("gpm") && key !== "gpmUprisingShell").sort() } : null,
      owned: owned(parentKey), regime: U0(parent.pol.constitution),
      legalParties: parent.pol.parties.filter(party => party.legal !== false).map(party => party.id),
      chambers: parent.pol.chambers.map(chamber => chamber.composition), laws: parent.laws },
    child: child ? { key: child.key, name: child.name, lead: ot(child)?.government?.leadPartyId,
      treasury: branchFounder?.organization?.treasuryM, owned: owned(child.key),
      regime: U0(child.pol.constitution), legalParties: child.pol.parties.filter(party => party.legal !== false).map(party => party.id), laws: child.laws } : null,
    war: war ? { id: war.id, status: war.status, mode: war.mode, day: war.startDay,
      sideA: war.sideAKey, sideB: war.sideBKey, participants: Object.keys(war.participants || {}).sort(),
      registered: sim.wars.get(parentKey) === war, scope: QKe(sim, war)?.scope } : null,
    activeHostilities: child ? ha(sim, child.key, parentKey) : false,
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

function gpmUprisingInstallGovernment(sim, country, partyId) {
  const office = Ve(country, "head_of_gov");
  const candidate = Mro(sim, country, partyId, office)
    || doo(sim, country, office, partyId);
  const institution = ot(country);
  const transition = Ec(sim, country, {
    intent: "government.install",
    transitionId: "gpm.uprising.government:" + country.key + ":" + institution.revision,
    expectedRevision: institution.revision,
    day: sim.day,
    head: { personId: candidate.id, partyId, controllerRef: { kind: "party", id: partyId } },
    leadPartyId: partyId,
    coalitionPartyIds: [partyId],
    supportPartyIds: [],
    formationProcedureId: "gpm.uprising",
    status: "installed",
  });
  if (!transition.ok) throw new Error("Government transition failed: " + JSON.stringify(transition));
  _f(sim, country);
}

function gpmUprisingCharter(country, party) {
  const draft = { ...country, laws: { ...country.laws } };
  const changes = new Map();
  // Resolve dependent settings after their enabling law changes.
  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    for (const law of t1) {
      const from = country.laws?.[law.id];
      if (from == null || !dpt(draft, law).ok ||
          !Object.values(law.doctrine?.axes || {}).some(weight => Number.isFinite(weight) && weight !== 0))
        continue;
      const distance = value => lGe(party, law, value, draft, null);
      const baseline = distance(from);
      const ceiling = Bte(law, country);
      let best = null;
      let bestDistance = baseline;
      let seed = from;
      // Compound settings can require more than one native choice to become coherent.
      const steps = law.schema.type === "object" && !Number.isFinite(ceiling) ? 6 : 1;
      for (let step = 0; step < steps; step++) {
        let next = null;
        const choices = yg(law, draft, seed);
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
      if (best) UCa(law, lMa, cMa, country);
      const target = best?.value ?? from;
      if (!$r(draft.laws[law.id], target)) {
        draft.laws[law.id] = target;
        changed = true;
      }
      if (best) changes.set(law.id, { lawId: law.id, value: Fa(target), choiceId: best.id });
      else changes.delete(law.id);
    }
    if (!changed) break;
  }
  return { assessed: t1.length, changes: [...changes.values()] };
}

function gpmApplyUprisingCharter(sim, country, charter) {
  const remaining = [...charter.changes];
  const applied = [];
  while (remaining.length) {
    const index = remaining.findIndex(item => dpt(country, Sa(item.lawId)).ok);
    if (index < 0) break;
    const [item] = remaining.splice(index, 1);
    const law = Sa(item.lawId);
    if ($r(country.laws[law.id], item.value)) continue;
    Bao(sim, country, law, item.value, { procedure: {
      id: "gpm.uprising.charter:" + country.key + ":" + law.id + ":" + sim.day,
      kind: wm(law), passed: true, resolutionMode: "founding_charter",
    } });
    Tao(country, item);
    applied.push(item);
  }
  return applied;
}

function gpmUprisingOnePartyState(sim, country, partyId) {
  gpmUprisingInstallGovernment(sim, country, partyId);
  const chamber = country.pol.chambers[0];
  const draft = egt(country, chamber, { headSelection: "party", headGovExists: 0, partyLegality: .1 });
  for (const assembly of draft.draftChambers) {
    assembly.composition = { [partyId]: assembly.seats };
    pC(assembly);
  }
  const head = gt(country, "head_of_gov");
  const transition = o9(sim, country, draft.constitution, {
    transitionId: "gpm.uprising.constitution:" + country.key + ":" + sim.day,
    sourceProcedureId: "gpm.uprising.charter",
    chambers: draft.draftChambers,
    replaceHeadOfState: { personId: head, partyId, controllerRef: { kind: "party", id: partyId } },
  });
  if (!transition.ok || Zr(country) !== partyId)
    throw new Error("One-party constitution failed: " + JSON.stringify(transition));
  Wwa(country);
  Object.assign(country.pol.regime, draft.polity.regime);
  for (const party of country.pol.parties) {
    if (party.id === partyId) continue;
    party.legal = false;
    party.gpmUprisingExcluded = true;
    party.campaigns = {};
  }
  country.pol.campaignPolls = {};
  wy(sim, country, sim._simYear);
  if (sim.playerKey === country.key) Kb(sim, country);
  I1e(sim, country);
  sim._reclassRegime(country, true);
}

function gpmUprisingCase(sim) {
  const parent = sim.countries.get(parentKey);
  const state = parent?.[statusField];
  return { parent, state };
}

function gpmUprisingProposal(sim, parent, founder) {
  if (parent?.[statusField]) return { reason: "case_exists" };
  if (sim.playerKey !== parentKey || !parent || Go(parent) !== founderId ||
      founder?.nameDesc?.gpmTag !== "ASBP") return { reason: "scope" };
  if (founder.legal === false) return { reason: "founder_control" };
  const incumbent = ot(parent)?.government?.leadPartyId;
  const incumbentParty = incumbent && Rb(parent, incumbent);
  if (!incumbentParty || incumbentParty.legal === false || z0a(parent.pol).has(founderId) ||
      parent.pol.chambers.some(chamber => (chamber.composition?.[founderId] || 0) > 0))
    return { reason: "unsupported_party_roles" };
  if (sim.wars.size || [...sim.conflicts.values()].some(conflict =>
    conflict.participants?.[parentKey] && (conflict.status === "active" || conflict.status === "suspended")))
    return { reason: "existing_war" };
  const territory = ly(sim, parentKey);
  const province = sim.world.provByKey.get(provinceKey);
  if (!province || !territory.provinceKeys.includes(provinceKey) || territory.provinceKeys.length < 2)
    return { reason: "territory" };
  const founderSupport = founder.support;
  if (!Number.isFinite(founderSupport) || founderSupport < 0 || founderSupport > 1)
    return { reason: "founder_control" };
  const victorySupport = Math.min(1, founderSupport + victoryGain);
  const charter = gpmUprisingCharter(parent, founder);
  const quoteId = JSON.stringify([sim.day, parentKey, founderId, provinceKey, incumbent, founderSupport,
    ba(JSON.stringify(charter.changes))]);
  return { province, incumbent, founderSupport, victorySupport, charter, quoteId };
}

function gpmUprisingView(sim) {
  const { parent, state } = gpmUprisingCase(sim);
  const child = state && sim.countries.get(state.childKey);
  const relevant = state && (sim.playerKey === parentKey || sim.playerKey === state.childKey);
  const founder = Rb(child || parent, founderId);
  const proposal = relevant ? {} : gpmUprisingProposal(sim, parent, founder);
  const phase = relevant ? state.phase : proposal.reason ? "unavailable" : "ready";
  const war = relevant && sim.conflicts.get(state.warId);
  return {
    phase, available: phase === "ready", reason: proposal.reason || null,
    countryKey: sim.playerKey, partyId: Go(sim.player),
    partyName: founder?.nameDesc?.gpmName || "Arab Socialist Ba'ath Party",
    parentName: "Lebanese Republic", breakawayName,
    regionName: sim.world.provByKey.get(provinceKey)?.__name || "North Lebanon",
    nationalSupport: relevant ? state.founderSupport : proposal.founderSupport,
    victorySupport: relevant ? state.victorySupport : proposal.victorySupport,
    result: relevant ? state.result || null : null, quoteId: proposal.quoteId || null,
    warStatus: war?.status || null,
    charterLaws: relevant ? state.appliedLaws || state.charter?.changes || [] : proposal.charter?.changes || [],
    charterAssessed: relevant ? state.charter?.assessed : proposal.charter?.assessed,
  };
}

function gpmUprisingOpen(sim, country, input) {
  const parent = sim.countries.get(parentKey);
  const founder = Rb(parent, founderId);
  const proposal = gpmUprisingProposal(sim, parent, founder);
  if (proposal.reason) return { ok: false, reason: proposal.reason };
  if (input.quoteId !== proposal.quoteId) return { ok: false, reason: "stale" };
  const { province, incumbent, founderSupport, victorySupport, charter } = proposal;
  const childKey = "ppo-uprising-lebanon-" + sim.day;
  const plan = { create: [{ key: childKey, parentKey, provIds: [province.__provId],
    a2: "QB", feature: Bho(childKey), name: breakawayName, hostile: true }] };
  const goal = nZ(sim, { actorKey: childKey, targetCountryKey: parentKey, casusBelliId: "coercion" });
  const validation = i3t(sim, plan);
  if (!validation.ok || !goal.ok) return { ok: false, reason: validation.reasonId || goal.reasonId };
  const split = jS(sim, plan);
  if (!split.ok) throw new Error("Unable to create the breakaway: " + split.reasonId);
  const child = sim.countries.get(childKey);

  // Use one organization across the split. Native country creation clones every party.
  parent.pol.parties = parent.pol.parties.map(party => party.id === founderId
    ? gpmUprisingPartyShell(party) : party);
  K9a(sim, parent);
  child.pol.parties = child.pol.parties.map(party => party.id === founderId ? founder :
    gpmUprisingPartyShell(party));
  gpmUprisingOnePartyState(sim, child, founderId);
  const childCharter = gpmUprisingCharter(child, founder);
  gpmApplyUprisingCharter(sim, child, childCharter);
  const handoff = sim.switchPlayerControl({ countryKey: childKey, partyId: founderId });
  if (!handoff.ok || !handoff.current.controlsExecutive) throw new Error("Breakaway control failed");

  // Put inherited reserves on the native roster so the breakaway can be played from day one.
  n7(sim, child);
  if (!Ne(sim, child).some(formation => formation.type !== "reserve") &&
      (child.forces?.personnel?.replacementK || 0) > .01)
    OTr(sim, child, "infantry", provinceKey);
  const target = ly(sim, parentKey);
  const war = Exa(sim, parent, { selectedTargetActorKey: parentKey,
    targetDefenseAuthorityKeys: target.defenseAuthorityKeys,
    targetDiplomacyAuthorityKeys: target.diplomacyAuthorityKeys,
    targetProvinceKeys: target.provinceKeys, enemyPop0: parent.pop,
    enemyProvTotal0: target.provinceKeys.length, cb: "coercion",
    campaign: { scope: "full_war", doctrine: "balanced" },
    warGoals: { A: [goal.goal], B: [N0e(parentKey, childKey, sim.day)] } });
  if (!war || sim.conflicts.get(war.id) !== war || !ha(sim, childKey, parentKey))
    throw new Error("Civil war was not registered");
  Uft(sim, war);
  j(sim, "war.player_declared", { warId: war.id, playerKey: childKey, enemyKey: parentKey,
    selectedTargetActorKey: parentKey, casusBelli: "coercion" }, { category: "guerre", severity: "danger" });
  parent[statusField] = { version: 1, id: childKey, childKey, warId: war.id, phase: "active",
    openedDay: sim.day, provinceKey, founderId, founderSupport, victorySupport, charter, incumbent };
  return { ok: true, ...gpmUprisingView(sim) };
}

function gpmUprisingMatches(sim, war) {
  const { state } = gpmUprisingCase(sim);
  return !!(war && state?.phase === "active" && war.id === state.warId &&
    war.sideAKey === state.childKey && war.sideBKey === parentKey && war.startDay === state.openedDay);
}

function gpmUprisingRecordResult(sim, war, outcome) {
  if (!gpmUprisingMatches(sim, war)) return;
  const { state } = gpmUprisingCase(sim);
  if (outcome !== "victory" && outcome !== "defeat") {
    Object.assign(state, { phase: "settled", result: "separated", settledDay: sim.day });
    return;
  }
  Object.assign(state, { phase: "resolving", nativeOutcome: outcome });
}

function gpmUprisingSettle(sim) {
  const { parent, state } = gpmUprisingCase(sim);
  if (state?.phase !== "resolving") return;
  const result = state.nativeOutcome === "victory" ? "breakaway" : "government";
  const child = sim.countries.get(state.childKey);
  const founder = Rb(child, founderId);
  const incumbent = Rb(parent, Zr(parent)) || Rb(parent, kt(parent));
  const targetParty = result === "breakaway" ? founder : incumbent;
  if (!child || sim.conflicts.has(state.warId) || !targetParty || targetParty.legal === false ||
      !Rb(parent, founderId)?.gpmUprisingShell)
    throw new Error("Civil war succession has inconsistent parties or territory");
  const plan = { moves: [{ provIds: ly(sim, child.key).provinceIds, to: parentKey }] };
  const validation = i3t(sim, plan);
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
    K9a(sim, parent);
    gpmUprisingOnePartyState(sim, parent, founderId);
    state.appliedLaws = gpmApplyUprisingCharter(sim, parent, state.charter);
  } else {
    Rb(parent, founderId).bannedYear = sim._simYear || 2026;
  }
  if (sim.playerKey === child.key || sim.playerKey === parentKey) {
    const handoff = sim.switchPlayerControl({ countryKey: parentKey, partyId: targetParty.id });
    if (!handoff.ok || !handoff.current.controlsExecutive) throw new Error("Postwar control failed");
  }
  const returned = jS(sim, plan);
  if (!returned.ok || sim.countries.has(child.key)) throw new Error("Postwar reunification failed");
  Object.assign(state, { phase: "settled", result, settledDay: sim.day });
}

Pyt("gpm.party.uprising.declare", { apply: gpmUprisingOpen });
return { view: gpmUprisingView, matches: gpmUprisingMatches, record: gpmUprisingRecordResult,
  settle: gpmUprisingSettle, inspect: gpmUprisingStatus };
})();
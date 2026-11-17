function gpmRetireBreakawayFlag(sim, child, successor = null) {
  const flags = sim.flags;
  const from = zw(child.a2);
  const to = zw(successor?.a2);
  if (!flags || !from || from === to) return false;
  let transferred = false;
  if (to) {
    for (const kind of ["custom", "hist", "image"]) {
      const choice = flags[kind]?.[from];
      if (!choice) continue;
      Pqe(flags, to);
      flags[kind][to] = kind === "hist" && !choice.includes("/") ? from + "/" + choice : choice;
      transferred = true;
      break;
    }
  }
  Pqe(flags, from);
  delete flags.library[from];
  w5e(flags);
  return transferred;
}

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
  const founderId = state?.founderId || fn(parent);
  const child = sim.countries.get(state?.childKey);
  const founder = rP(parent, founderId);
  const branchFounder = rP(child, founderId);
  const war = state && sim.conflicts?.get(state.warId);
  const control = yn(sim);
  const owned = key => d5(sim, key)?.provinceKeys || [];
  return {
    day: sim.day,
    campaignActive: Lc(sim),
    noOccupation: sim.world.provinces.every(province => !province.__occupier ||
      ![parentKey, state?.childKey].includes(province.__occupier)),
    warCount: sim.wars?.size || 0,
    state,
    control: { countryKey: control.countryKey, partyId: control.partyId,
      campaignId: control.campaignId, controlsExecutive: control.controlsExecutive },
    parent: { key: parent?.key, name: uo(sim, parent), lead: st(parent)?.government?.leadPartyId,
      founder: founder ? { legal: founder.legal, bannedYear: founder.bannedYear,
        treasury: founder.organization?.treasuryM, activists: founder.organization?.activistsK,
        influence: founder.organization?.influence, support: founder.support,
        electionEligible: Object.hasOwn(zg(parent.pol, { [founderId]: 0.5 }), founderId),
        ppoKeys: Object.keys(founder).filter(key => key.startsWith("gpm") && key !== "gpmUprisingShell").sort() } : null,
      owned: owned(parentKey), regime: Ku(parent.pol.constitution),
      ceremonial: !!parent.pol.constitution.organs.head_of_state.ceremonial,
      legalParties: parent.pol.parties.filter(party => party.legal !== false).map(party => party.id),
      chambers: parent.pol.chambers.map(chamber => chamber.composition), laws: parent.laws },
    child: child ? { key: child.key, name: child.name, lead: st(child)?.government?.leadPartyId,
      treasury: branchFounder?.organization?.treasuryM, owned: owned(child.key),
      regime: Ku(child.pol.constitution), ceremonial: !!child.pol.constitution.organs.head_of_state.ceremonial, legalParties: child.pol.parties.filter(party => party.legal !== false).map(party => party.id), laws: child.laws } : null,
    war: war ? { id: war.id, status: war.status, mode: war.mode, day: war.startDay,
      sideA: war.sideAKey, sideB: war.sideBKey, participants: Object.keys(war.participants || {}).sort(),
      registered: sim.wars.get(parentKey) === war, scope: lBe(sim, war)?.scope } : null,
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

function gpmUprisingInstallGovernment(sim, country, partyId, status) {
  const office = Ve(country, "head_of_gov");
  const candidate = C4o(sim, country, partyId, office)
    || f5o(sim, country, office, partyId);
  const institution = st(country);
  const transition = $0(sim, country, {
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
  gf(sim, country);
}

function gpmUprisingCharter(country, party, year = 2026) {
  const draft = { ...country, laws: { ...country.laws } };
  const changes = new Map();
  const platform = gpmPresets[gpmActiveIdeologyPreset(party)];
  // Resolve dependent settings after their enabling law changes.
  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    for (const law of l1) {
      const from = country.laws?.[law.id];
      if (from == null || !Uht(draft, law).ok)
        continue;
      const commitment = gpmIdeologyLawTarget(platform, law.id, from, year);
      if (commitment !== undefined) {
        if (!fo(draft.laws[law.id], commitment)) {
          draft.laws[law.id] = or(commitment);
          changed = true;
        }
        if (!fo(from, commitment)) changes.set(law.id, { lawId: law.id, value: or(commitment), choiceId: "platform" });
        continue;
      }
      if (!Object.values(law.doctrine?.axes || {}).some(weight => Number.isFinite(weight) && weight !== 0)) continue;
      const distance = value => Zze(party, law, value, draft, null);
      const baseline = distance(from);
      const ceiling = Boe(law, country);
      let best = null;
      let bestDistance = baseline;
      let seed = from;
      // Compound settings can require more than one native choice to become coherent.
      const steps = law.schema.type === "object" && !Number.isFinite(ceiling) ? 6 : 1;
      for (let step = 0; step < steps; step++) {
        let next = null;
        const choices = w6(law, draft, seed);
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
      if (best) LNa(law, oGa, nGa, country);
      const target = best?.value ?? from;
      if (!fo(draft.laws[law.id], target)) {
        draft.laws[law.id] = target;
        changed = true;
      }
      if (best) changes.set(law.id, { lawId: law.id, value: or(target), choiceId: best.id });
      else changes.delete(law.id);
    }
    if (!changed) break;
  }
  return { assessed: l1.length, changes: [...changes.values()] };
}

function gpmApplyUprisingCharter(sim, country, charter) {
  const remaining = [...charter.changes];
  const applied = [];
  while (remaining.length) {
    const index = remaining.findIndex(item => Uht(country, Ra(item.lawId)).ok);
    if (index < 0) break;
    const [item] = remaining.splice(index, 1);
    const law = Ra(item.lawId);
    if (fo(country.laws[law.id], item.value)) continue;
    kfo(sim, country, law, item.value, { procedure: {
      id: "gpm.uprising.charter:" + country.key + ":" + law.id + ":" + sim.day,
      kind: S3(law), passed: true, resolutionMode: "founding_charter",
    } });
    Afo(country, item);
    applied.push(item);
  }
  return applied;
}

function gpmUprisingReform(country, profile) {
  const chamber = country.pol.chambers[0];
  const draft = _bt(country, chamber, profile);
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
      chamber.composition = { ...yj(weights, chamber.seats - governing), [partyId]: governing };
    } else {
      chamber.composition = Object.fromEntries(Object.entries(chamber.composition || {})
        .filter(([id, count]) => rivals.some(party => party.id === id) && count > 0));
    }
    rk(chamber);
  }

  const folded = Ve(country, "head_of_gov") === Ve(country, "head_of_state");
  const status = transitional || profile.singleParty || !profile.ceremonial ? "installed" : "minority";
  gpmUprisingInstallGovernment(sim, country, partyId, status);
  const head = mt(country, "head_of_gov");
  const hereditary = profile.headSelection === "hereditary";
  const reigning = hereditary ? sim.people.get(country.monarchId) : null;
  const sovereign = hereditary && reigning?.alive && reigning.countryKey === country.key ? reigning : null;
  const headOfState = !profile.headGovExists ? head : (sovereign ||
    b0(sim, { countryKey: country.key, party: hereditary ? null : partyId, role: draft.constitution.organs.head_of_state.role,
      born: sim._simYear - 45, since: sim._simYear })).id;
  const officeholder = personId => ({ personId, partyId, controllerRef: { kind: "party", id: partyId } });
  // Unfolding needs distinct, explicit officeholders even in a one-party parent.
  const institution = st(country);
  const transition = $0(sim, country, {
    intent: "constitution.reconcile",
    transitionId: "gpm.uprising.constitution:" + country.key + ":" + institution.revision,
    expectedRevision: institution.revision, constitutionRevision: institution.constitutionRevision + 1,
    day: sim.day, sourceProcedureId: "gpm.uprising.charter",
    constitution: draft.constitution, chambers: draft.draftChambers,
    government: { coalitionPartyIds: [partyId], supportPartyIds: [], status },
    replaceHeadOfState: hereditary ? { personId: headOfState, partyId: null, controllerRef: { kind: "person", id: headOfState } }
      : officeholder(headOfState),
    ...(folded && profile.headGovExists ? { unfoldHead: officeholder(head) } : {}),
  });
  if (!transition.ok || to(country) !== partyId)
    throw new Error("Uprising constitution failed: " + JSON.stringify(transition));
  if (hereditary) {
    const monarch = sim.people.get(headOfState);
    if (!sim.dynasties.has(monarch.dynastyId)) pq(sim, country, monarch);
  }
  GTa(country);
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
  M5(sim, country, sim._simYear);
  if (sim.playerKey === country.key) oP(sim, country);
  g3e(sim, country);
  sim._reclassRegime(country, true);
}

function gpmUprisingStartingIdentity(country, customName = null) {
  const constitution = country.pol?.constitution;
  const system = gpmUprisingSystemFromBlueprint(constitution?.blueprint, constitution?.territory?.level);
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
  const owned = Qh(sim, parent.key);
  const population = owned.reduce((sum, province) => sum + (province.__pop || 0), 0);
  const support = new Map(wke(parent.pol, DO(sim, parent)).map(region =>
    [region.key, region.shares[founder.id] || 0]));
  const rows = owned.map(province => ({
    province,
    ...gpmUprisingFoothold(sim, founder, province, support.get(province.__provKey)),
    project: founder.gpmUprisingPreparations?.regions?.[province.__provKey]?.project || null,
    eligible: partyUprisingProvinceEligible(sim, parent, province, population),
  }));
  const headquartersKey = founder.gpmRegional?.headquarters?.key;
  const headquarters = rows.find(row => row.province.__provKey === headquartersKey);
  const state = founder.gpmUprisingPreparations;
  const threshold = uprisingPreparationRules.threshold;
  const reason = !rows.some(row => row.eligible) ? "territory" :
    !headquartersKey ? "headquarters_required" : !headquarters?.eligible ? "headquarters_region" :
    headquarters.foothold < threshold ? "headquarters_foothold" :
    !state?.wing || !gpmUprisingStockedDivisions(state).length ? "division_required" : null;
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
  const staffing = gpmUprisingStockedDivisions(state).map(({ type }) => gn.formationTypes[type].manpowerK);
  const requiredK = staffing.reduce((sum, manpowerK) => sum + manpowerK, 0);
  const share = joiningPopulation / population;
  const replacementK = (parent.forces?.personnel?.replacementK || 0) +
    (parent.formations || []).reduce((sum, id) => {
      const unit = sim.formations.get(id);
      return sum + (unit && unit.type !== "reserve" ? unit.manpowerK || 0 : 0);
    }, 0);
  const availableK = parent.forces ? share * replacementK + (parent.employment ?
    share * Math.max(0, (parent.employment.workingAgeM || 0) - Q2(parent)) * 1000 : requiredK) : 0;
  const manpower = { requiredK, availableK: Math.min(requiredK, availableK) };
  const minimumK = requiredK / Math.max(...staffing) * .001;
  return { reason: availableK < minimumK ? "division_manpower" : reason, province, joining, rows, headquarters, manpower };
}

function gpmUprisingEligibility(sim, parent, founder) {
  if (parent?.[statusField]) return "case_exists";
  if (sim.playerKey !== parent?.key || !founder?.organization || founder.legal === false)
    return "founder_control";
  const parentKey = parent.key;
  const founderId = founder.id;
  const territory = d5(sim, parentKey);
  if (!st(parent) || !parent.pol.chambers?.length || territory?.sovereignKey !== parentKey ||
      territory.primaryDefenseAuthorityKey !== parentKey || territory.primaryDiplomacyAuthorityKey !== parentKey ||
      parent.pol.constitution.organs.head_of_state.source === "sovereign")
    return "scope";
  const incumbent = Et(parent);
  const incumbentParty = incumbent && rP(parent, incumbent);
  if (!incumbentParty || incumbentParty.legal === false) return "incumbent_required";
  if (xya(parent.pol).has(founderId)) return "unsupported_party_roles";
  return null;
}

function gpmUprisingWarStamp(entry) {
  return entry.war?.startDay ?? entry.row.openedDay ?? 0;
}

function gpmUprisingWithdrawnProvinces(sim, war, countryKey) {
  return Object.entries(war.occupationCredit || {}).filter(([key, occupier]) => {
    const province = sim.world.provByKey.get(key);
    return province && (province.__countryKey === countryKey || occupier === countryKey);
  }).map(([key]) => key);
}

function gpmUprisingVoluntaryAid(sim, countryKey) {
  return [...(sim.militarySupportPrograms?.values() || [])].filter(program =>
    program.sourceTypeId === "voluntary" && program.donorKey === countryKey && g5.has(program.statusId));
}

function gpmUprisingMissionInvolves(sim, mission, owner, countryKey) {
  if (owner === countryKey) return true;
  const target = mission.targetId;
  return sim.countries.has(target) ? target === countryKey :
    [sim.formations.get(target), sim.bases?.get(target), sim.plants?.get(target), sim.fields?.get(target)]
      .some(asset => asset?.owner === countryKey);
}

function gpmInheritedPeaceTerms(sim, parent, record, entry) {
  const { war, definition, row, summaryStatus } = entry;
  const name = key => uo(sim, sim.countries.get(key)) || key;
  const countryKey = parent.key;
  const side = war?.participants[countryKey]?.side;
  const other = side === "A" ? "B" : "A";
  const catalogSide = war ? -1 : definition.sides.findIndex(actors =>
    actors.some(id => gpmHistoricalActorRepresents(sim, id, countryKey)));
  const opponents = war ? We(war, other) : definition.sides[1 - catalogSide] || [];
  const allies = war ? We(war, side).filter(key => key !== countryKey) : [];
  const stays = war ? allies : (definition.sides[catalogSide] || [])
    .filter(id => !gpmHistoricalActorRepresents(sim, id, countryKey));
  const opponent = war ? C8t(war, other) : null;
  const opponentCountry = sim.countries.get(opponent);
  const counterparties = war ? [name(opponent)] : opponents.map(id => gpmHistoricalShortName(gpmHistoricalViewActor(sim, id)) || id);
  const stance = war ? kP(sim, war, other) : null;
  const advantage = stance?.scoreAdvantage ?? (catalogSide === 0 ? row.advantage : -row.advantage) ?? 0;
  const quiet = summaryStatus !== "active";
  const exhaustion = stance?.exhaustion01 ?? Math.min(1, (row.weeksActive || 0) / 35);
  const refusing = !quiet && exhaustion < .65 && (advantage >= 55 ||
    advantage >= 25 && stance?.hasOffensiveObjectives && !stance.offensiveObjectivesComplete && stance.objectiveProgress01 >= .7);
  const terms = !refusing && war && !allies.length && opponents.length === 1 && (advantage >= 20 || stance?.offensiveObjectivesComplete)
    ? zF(sim, war, opponent, countryKey).filter(term => term.type === "territorial_transfer") : [];
  const territory = terms.length && hja(sim, war, opponent, countryKey, terms);
  const transfers = territory?.ok && !territory.totalAnnexation ? terms : [];
  const released = war ? (stays.length ? gpmUprisingWithdrawnProvinces(sim, war, countryKey) : Object.keys(war.occupationCredit || {})) : [];
  const ceded = transfers.flatMap(term => term.provinceKeys);
  const releases = released.filter(key => !ceded.includes(key));
  const wantsPayment = !refusing && !!war && !transfers.length && advantage >= 24 && exhaustion < .8;
  const payment = wantsPayment ? ae(Math.max(.0001, (parent.gdp || 0) * (advantage >= 40 ? .002 : .001)), "floor") : 0;
  const payable = !payment || (opponentCountry && LH(sim, parent, opponentCountry, payment,
    { allowFinancing: false, purposeId: "peace_reparations" }).ok);
  const rejectReason = !opponents.length ? "There is no opposing side available to negotiate." :
    refusing ? "The opposing side believes it can gain more by continuing to fight." :
    !payable ? "The opposing side demands reparations your government cannot afford." : null;
  const heading = stays.length ? "Separate peace" : "Peace settlement";
  const consequences = [stays.length ? "Your country leaves. The remaining combatants keep fighting." : "This war ends."];
  const places = keys => keys.map(key => sim.world.provByKey.get(key)?.__name || key).join(", ");
  for (const term of transfers) consequences.push(`${name(term.toKey)} gains legal control of ${places(term.provinceKeys)}.`);
  if (releases.length) consequences.push(`Wartime control ends in ${places(releases)}. Those provinces return to their legal owners.`);
  if (!transfers.length) consequences.push("Legal borders stay the same.");
  if (payment) {
    const amount = new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(payment * 1000);
    const treasuryShare = Math.round(100 * payment / Math.max(Ka(sim, parent), 1e-9));
    consequences.push(`Your state treasury pays ${name(opponent)} US$${amount} million in reparations once${payable ? `, about ${treasuryShare}% of current state cash` : ""}.`);
  }
  if (allies.length) consequences.push(`Relations with ${allies.map(name).join(", ")} worsen when you make a separate peace.`);
  const token = JSON.stringify([record.key, record.startDay, countryKey, opponents, stays, releases, transfers, payment]);
  return { token, heading, consequences, counterparties, opponent, allies, transfers, payment, rejectReason,
    likelihood: rejectReason || (payment || transfers.length ? "The opposing side is asking for concessions." :
      "The opposing side may agree to these terms.") };
}

function gpmInheritedPeaceView(sim, parent, record, entry) {
  const saved = record.peace;
  if (!entry || record.choice) return saved;
  if (saved?.status === "pending" || saved?.status === "ready") return saved;
  return { ...saved, status: saved?.status || "available", offer: gpmInheritedPeaceTerms(sim, parent, record, entry) };
}

function gpmUprisingInheritedWars(sim) {
  const { parent, state } = gpmUprisingCase(sim);
  if (state?.result !== "breakaway" || sim.playerKey !== parent?.key ||
      fn(parent) !== state.founderId || !sim.playerControlsGovernment(parent)) return null;
  const current = gpmDirectWars(sim, parent.key);
  const wars = (state.inheritedWars || []).map(record => {
    const entry = current.find(candidate => candidate.key === record.key && gpmUprisingWarStamp(candidate) === record.startDay);
    const peace = gpmInheritedPeaceView(sim, parent, record, entry);
    return { ...record, conflictId: entry?.definition.id || record.conflictId,
      choice: record.choice || (!entry ? "ended" : null), peace };
  });
  const voluntaryAid = gpmUprisingVoluntaryAid(sim, parent.key).map(program => {
    const war = sim.conflicts.get(program.conflictId);
    const name = key => uo(sim, sim.countries.get(key)) || key;
    return { id: program.id, recipient: name(program.recipientKey), warName:
      war ? name(war.sideAKey) + " / " + name(war.sideBKey) : null };
  });
  return { wars, voluntaryAid };
}

function gpmUprisingDemoteWar(sim, war) {
  if (war.mode !== "operational") return;
  // The operational controller belongs to the player country that opened or adopted it.
  const strategicWars = sim.aiWars ??= new Map();
  if (strategicWars.has(war.id) && strategicWars.get(war.id) !== war) {
    throw new Error("Inherited war identifier conflicts with a strategic war: " + war.id);
  }
  for (const [key, current] of sim.wars) {
    if (current === war) sim.wars.delete(key);
  }
  Object.assign(war, { mode: "strategic", enemyKey: null, enemyName: null,
    score: war._score?.total ?? war.score ?? 0, a: war.sideAKey, b: war.sideBKey,
    aName: uo(sim, sim.countries.get(war.sideAKey)), bName: uo(sim, sim.countries.get(war.sideBKey)) });
  strategicWars.set(war.id, war);
}

function gpmUprisingLeaveNativeWar(sim, war, country) {
  const countryKey = country.key;
  const { side } = war.participants[countryKey];
  const remaining = We(war, side).filter(key => key !== countryKey);
  const opponent = side === "A" ? "B" : "A";
  const opposing = We(war, opponent);
  const closed = !remaining.length || !opposing.length;
  if (closed) {
    Og(war).outcomeId = "uprising_peace";
    Av(sim, war);
    gpmHistoricalCloseNative(sim, war, "Peace settlement signed");
    for (const key of [...remaining, ...opposing]) {
      const actor = sim.countries.get(key);
      if (actor && !actor.atWar) actor.warScore = 0;
    }
  } else {
    const released = gpmUprisingWithdrawnProvinces(sim, war, countryKey);
    for (const key of released) {
      const province = sim.world.provByKey.get(key);
      aP(sim, war, key, null);
      war.occupied?.delete(province.__provId);
      war.lost?.delete(province.__provId);
      if (war.occupationCivil) delete war.occupationCivil[key];
    }
    for (const program of sim.militarySupportPrograms?.values() || []) {
      if (program.conflictId === war.id && (program.recipientKey === countryKey || program.donorKey === countryKey) &&
          g5.has(program.statusId)) {
        h5(sim, program.id, "withdrawn");
      }
    }
    for (const call of sim.militaryCalls?.values() || []) {
      if (call.warId === war.id && (call.memberKey === countryKey || call.defenderKey === countryKey ||
          call.aggressorKey === countryKey)) XQ(sim, call.id, "withdrawn");
    }
    // Abort sorties involving the departing country, then withdraw just its assigned formations.
    zpt(sim, war, sim.day, "withdrawn", countryKey);
    pct(sim, war.id, null, countryKey);
    const coalition = war.coalitions[side];
    const principalLeft = coalition.principalKey === countryKey;
    if (principalLeft) {
      const historicalPrincipal = [war.a, war.b].find(key => remaining.includes(key));
      const successor = historicalPrincipal || remaining.sort((a, b) =>
        (war.participants[a].joinedDay || 0) - (war.participants[b].joinedDay || 0) || K(a, b))[0];
      coalition.principalKey = successor;
      war[side === "A" ? "sideAKey" : "sideBKey"] = successor;
      war.participants[successor].role = "principal";
    }
    coalition.members = coalition.members.filter(key => key !== countryKey);
    delete war.participants[countryKey];
    (war.gpmDepartureHistory ??= []).push({ countryKey, side, day: sim.day });
    war._participantRevision = (Number(war._participantRevision) || 0) + 1;
    if (war._forcePlan) delete war._forcePlan[countryKey];
    if (war.commandPlans) delete war.commandPlans[countryKey];
    if (war.campaign?.actorKey === countryKey) {
      war.campaign.actorKey = war.coalitions[side].principalKey;
    }
    if (war.campaign?.targetKey === countryKey) {
      war.campaign.targetKey = war.coalitions[side].principalKey;
    }
    for (const goal of Object.values(war.warGoals || {}).flat()) {
      if ([goal.actorKey, goal.targetCountryKey, goal.selectedTargetActorKey, goal.beneficiaryKey].includes(countryKey)) {
        goal.status = "abandoned";
      }
    }
    const settlement = Og(war);
    for (const proposal of settlement.proposals) {
      if (proposal.status === "pending" && (principalLeft || proposal.proposedByKey === countryKey)) {
        Object.assign(proposal, { status: "rejected", respondedDay: sim.day });
      }
    }
    settlement.revision++;
    gpmUprisingDemoteWar(sim, war);
    llt(sim, war);
    DJ(sim);
    FW(sim);
  }
  Jce(sim, countryKey);
  if (!country.atWar) country.warScore = 0;
  return { ok: true, closed };
}

function gpmReviewInheritedPeace(sim, parent, state) {
  const records = state.inheritedWars?.filter(({ choice, peace }) => !choice &&
    (peace?.status === "pending" && peace.reviewDay <= sim.day || peace?.status === "ready" && peace.lastCheckedDay < sim.day));
  if (!records?.length) return;
  const current = gpmDirectWars(sim, parent.key);
  for (const record of records) {
    const entry = current.find(candidate => candidate.key === record.key && gpmUprisingWarStamp(candidate) === record.startDay);
    if (!entry) continue;
    const peace = record.peace;
    if (peace.status === "ready") {
      if (peace.expiresDay < sim.day) {
        record.peace = { status: "rejected", message: "The offer expired. Request new terms to reopen talks." };
      } else {
        const currentTerms = gpmInheritedPeaceTerms(sim, parent, record, entry);
        if (currentTerms.rejectReason || currentTerms.token !== peace.offer.token) {
          record.peace = { status: "rejected", message: "The situation changed. Request new terms to reopen talks." };
        } else peace.lastCheckedDay = sim.day;
      }
      continue;
    }
    const offer = gpmInheritedPeaceTerms(sim, parent, record, entry);
    if (offer.rejectReason) {
      record.peace = { status: "rejected", retryDay: sim.day + 14, message: offer.rejectReason };
    } else {
      record.peace = { status: "ready", offer, expiresDay: sim.day + 14, lastCheckedDay: sim.day,
        message: offer.token === peace.offer.token ? "The opposing side agrees. Review the terms and sign to make peace." :
          "The opposing side sent revised terms. Review them before you sign." };
    }
  }
}

function gpmSignInheritedPeace(sim, country, record, entry, offer) {
  const { war } = entry;
  if (offer.transfers.length) {
    const transferred = tD(sim, war, offer.opponent, country.key, offer.transfers);
    if (!transferred.ok) return { ok: false, reason: "war_peace_changed" };
  }
  if (offer.payment) {
    const payment = Qc(sim, country, sim.countries.get(offer.opponent), offer.payment, {
      id: `gpm:peace:${country.key}:${record.key}:${record.startDay}`, allowFinancing: false,
      purposeId: "peace_reparations", refs: { conflictId: record.key },
    });
    if (!payment.ok) return { ok: false, reason: "war_peace_changed" };
  }
  const result = war ? gpmUprisingLeaveNativeWar(sim, war, country) : gpmLeaveCatalogWar(sim, entry, country.key);
  if (!result.ok) return result;
  for (const key of offer.allies) {
    xa(sim, key, country.key, -8);
    H0(sim, sim.countries.get(key), country.key, "betrayal", .15);
  }
  record.choice = "peace";
  record.decidedDay = sim.day;
  record.conflictId = entry.definition.id;
  record.peace = { status: "signed", offer, message: "Peace settlement signed." };
  return { ok: true };
}

function gpmUprisingWarDecision(sim, country, input) {
  const { parent, state } = gpmUprisingCase(sim);
  if (!parent || country?.key !== parent.key || state?.result !== "breakaway" ||
      sim.playerKey !== parent.key || fn(parent) !== state.founderId || !sim.playerControlsGovernment(parent)) {
    return { ok: false, reason: "war_authority" };
  }
  if (input.choice === "endAid") {
    if (!gpmUprisingVoluntaryAid(sim, parent.key).some(program => program.id === input.id)) {
      return { ok: false, reason: "war_stale" };
    }
    const result = h7a(sim, input.id, parent.key);
    return result.ok ? { ok: true } : { ok: false, reason: result.reasonId };
  }
  const record = state.inheritedWars?.find(entry => entry.key === input.id);
  const current = gpmDirectWars(sim, parent.key).find(entry => entry.key === input.id);
  if (!record || record.choice || !current || record.startDay !== gpmUprisingWarStamp(current)) {
    return { ok: false, reason: "war_stale" };
  }
  const peace = record.peace;
  switch (input.choice) {
    case "stay":
      record.choice = "stay";
      record.decidedDay = sim.day;
      delete record.peace;
      return { ok: true };
    case "offer": {
      if (["pending", "ready"].includes(peace?.status) || peace?.retryDay > sim.day) {
        return { ok: false, reason: "war_peace_unavailable" };
      }
      const offer = gpmInheritedPeaceTerms(sim, parent, record, current);
      if (offer.token !== input.token) return { ok: false, reason: "war_peace_changed" };
      record.peace = { status: "pending", offer, reviewDay: sim.day + 7,
        message: "The opposing side is reviewing your offer. Your country remains in the war." };
      return { ok: true };
    }
    case "decline":
      if (peace?.status !== "ready") return { ok: false, reason: "war_peace_unavailable" };
      record.peace = { status: "declined", retryDay: sim.day + 7,
        message: "You declined the terms. Your country remains in the war." };
      return { ok: true };
    case "accept": {
      if (peace?.status !== "ready" || peace.expiresDay < sim.day || peace.offer.token !== input.token) {
        return { ok: false, reason: "war_peace_unavailable" };
      }
      const offer = gpmInheritedPeaceTerms(sim, parent, record, current);
      if (offer.rejectReason || offer.token !== input.token) {
        return { ok: false, reason: "war_peace_changed" };
      }
      return gpmSignInheritedPeace(sim, parent, record, current, offer);
    }
    default:
      return { ok: false, reason: "war_peace_unavailable" };
  }
}

function gpmUprisingSeatTransfers(polity, founderId, incumbent) {
  const rivals = polity.parties.filter(party => party.id !== founderId && party.legal !== false);
  const transfers = [];
  for (const chamber of polity.chambers) {
    const composition = chamber.composition || {};
    const vacated = composition[founderId] || 0;
    if (!(vacated > 0)) continue;
    let weights = rivals.map(party => [party.id, composition[party.id] || 0]);
    if (!weights.some(([, seats]) => seats > 0)) {
      weights = rivals.map(party => [party.id, party.support || 0]);
    }
    if (!weights.some(([, weight]) => weight > 0)) weights = [[incumbent, 1]];
    // The largest remaining party wins ties in the native D'Hondt allocation.
    weights.sort(([idA, a], [idB, b]) => b - a || K(idA, idB));
    const gains = Tya(weights.map(([, weight]) => weight), vacated);
    const recipients = weights.map(([id], index) => [id, gains[index]]).filter(([, gain]) => gain > 0);
    transfers.push({ chamberId: chamber.id, vacated, recipients });
  }
  return transfers;
}

function gpmUprisingProposal(sim, parent, founder) {
  const reason = gpmUprisingEligibility(sim, parent, founder);
  if (reason) return { reason };
  const parentKey = parent.key;
  const founderId = founder.id;
  const incumbent = Et(parent);
  const territoryPlan = gpmUprisingTerritoryPlan(sim, parent, founder);
  const { province } = territoryPlan;
  if (territoryPlan.reason) return { reason: territoryPlan.reason, territoryPlan };
  const preparations = founder.gpmUprisingPreparations;
  const divisions = gpmUprisingStockedDivisions(preparations);
  const stockpile = gpmUprisingStockpile(preparations);
  const founderSupport = founder.support;
  if (!Number.isFinite(founderSupport) || founderSupport < 0 || founderSupport > 1)
    return { reason: "founder_control" };
  const profile = gpmUprisingProfile(founder);
  try { gpmUprisingReform(parent, profile); }
  catch { return { reason: "constitution", territoryPlan }; }
  const parentName = sim.customNames?.[parentKey] || gpmUprisingOfficialNames[parentKey] || parent.name;
  const seed = parentKey === "422" && founder.nameDesc?.gpmTag === "ASBP" ? undefined :
    Aa(JSON.stringify([sim.rngSeed0, yn(sim).campaignId, parentKey, founderId, profile.regime]));
  const starting = parent.gpmUprisingStartingIdentity ||
    (!parent.__born ? gpmUprisingStartingIdentity(parent) : null);
  const restoresOriginalName = !!starting && starting.system === gpmUprisingSystemFromProfile(profile);
  const identity = restoresOriginalName
    ? { name: gpmUprisingRevolutionaryName(parentKey, starting.name) }
    : gpmUprisingIdentity(parentKey, parentName, profile, seed);
  const names = [identity.name, ...(identity.alternatives || [])]
    .filter((name, index, list) => tHe(name) === name && name && list.indexOf(name) === index);
  if (!names.length) return { reason: "name", territoryPlan };
  const victorySupport = Math.min(1, founderSupport + victoryGain);
  const charter = gpmUprisingCharter(parent, founder, sim._simYear);
  const seatTransfers = gpmUprisingSeatTransfers(parent.pol, founderId, incumbent);
  const vacatedSeats = seatTransfers.reduce((total, transfer) => total + transfer.vacated, 0);
  const quoteId = JSON.stringify([sim.day, parentKey, founderId, [...territoryPlan.joining], divisions, stockpile, incumbent, founderSupport,
    territoryPlan.manpower,
    Aa(JSON.stringify([profile, names, charter.changes, restoresOriginalName ? starting : null, seatTransfers]))]);
  return { province, territoryPlan, divisions, stockpile, incumbent, founderSupport, victorySupport, charter, quoteId, names, profile, parentName,
    restoration: restoresOriginalName ? starting : null, seatTransfers, vacatedSeats };
}

function gpmUprisingView(sim) {
  const control = yn(sim);
  const { parent, state } = gpmUprisingCase(sim);
  const child = state && sim.countries.get(state.childKey);
  const founder = rP(child || parent, state?.founderId || fn(parent));
  const proposal = state ? {} : gpmUprisingProposal(sim, parent, founder);
  const phase = state?.phase || (proposal.reason ? "unavailable" : "ready");
  const war = state && sim.conflicts.get(state.warId);
  const profile = state?.profile || proposal.profile || (state && gpmUprisingProfile(founder));
  const province = proposal.province || sim.world.provByKey.get(state?.provinceKey);
  return {
    phase, available: phase === "ready", reason: proposal.reason || null, day: sim.day,
    preparations: proposal.territoryPlan ? gpmUprisingPreparationView(sim, parent, founder, proposal.territoryPlan) : null,
    preparedDivisionCount: state?.preparedDivisionCount ?? state?.deployedCount ?? 0,
    deployedCount: state?.deployedCount || 0, deployedRoster: state?.deployedRoster || [],
    integratedDivisions: state?.integratedDivisions || 0,
    defectingRegions: state?.defectingRegions || [],
    vacatedSeats: state?.vacatedSeats ?? proposal.vacatedSeats ?? 0,
    countryKey: sim.playerKey, partyId: control.partyId, campaignId: control.campaignId,
    controlRevision: control.controlRevision, founderId: founder?.id,
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
  const founder = rP(parent, fn(parent));
  const proposal = gpmUprisingProposal(sim, parent, founder);
  if (proposal.reason) return { ok: false, reason: proposal.reason };
  if (input.quoteId !== proposal.quoteId) return { ok: false, reason: "stale" };
  const { province, territoryPlan, divisions, stockpile, incumbent, founderSupport, victorySupport, charter, profile, parentName, names, restoration,
    seatTransfers, vacatedSeats } = proposal;
  const breakawayName = input.name ?? names[0];
  if (!names.includes(breakawayName)) return { ok: false, reason: "name" };
  const flag = input.flag ?? null;
  if (flag !== null && !Nwt(flag)) return { ok: false, reason: "flag" };
  const parentKey = parent.key;
  const founderId = founder.id;
  const provinceKey = province.__provKey;
  const childKey = childPrefix + parentKey + "-" + sim.day;
  const priorOperationalWar = sim.wars?.get(parentKey);
  if (priorOperationalWar && !Oo(priorOperationalWar, parentKey)) {
    return { ok: false, reason: "war_stale" };
  }
  const plan = { create: [{ key: childKey, parentKey, provIds: [...territoryPlan.joining],
    a2: childKey, feature: HRo(childKey), name: breakawayName, hostile: true, gpmUprisingFounderId: founderId }] };
  const goal = HJ(sim, { actorKey: childKey, targetCountryKey: parentKey, casusBelliId: "coercion" });
  const validation = N8t(sim, plan);
  if (!validation.ok || !goal.ok) return { ok: false, reason: validation.reasonId || goal.reasonId };
  const split = _w(sim, plan);
  if (!split.ok) throw new Error("Unable to create the breakaway: " + split.reasonId);
  const child = sim.countries.get(childKey);

  // Use one organization across the split. Native country creation clones every party.
  parent.pol.parties = parent.pol.parties.map(party => party.id === founderId
    ? gpmUprisingPartyShell(party) : party);
  hRa(sim, parent);
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
  for (const outsideWar of [...(sim.wars?.values() || [])]) {
    if (!Oo(outsideWar, parentKey) || Oo(outsideWar, childKey)) continue;
    zpt(sim, outsideWar, sim.day, "strategic");
    F4a(sim, outsideWar.id);
    gpmUprisingDemoteWar(sim, outsideWar);
  }

  // Completed preparations enter the native roster. Unfinished projects end at declaration.
  b9(sim, child);
  const deployed = gpmUprisingDeployPreparations(sim, child, province, divisions, stockpile);
  delete founder.gpmUprisingPreparations;
  const target = d5(sim, parentKey);
  const war = VUa(sim, parent, { id: sim.conflicts?.has("player:" + parentKey) ? "player:" + childKey : undefined,
    selectedTargetActorKey: parentKey,
    targetDefenseAuthorityKeys: target.defenseAuthorityKeys,
    targetDiplomacyAuthorityKeys: target.diplomacyAuthorityKeys,
    targetProvinceKeys: target.provinceKeys, enemyPop0: parent.pop,
    enemyProvTotal0: target.provinceKeys.length, cb: "coercion",
    campaign: { scope: "full_war", doctrine: "balanced" },
    warGoals: { A: [goal.goal], B: [I2e(parentKey, childKey, sim.day)] } });
  if (!war || sim.conflicts.get(war.id) !== war || !ha(sim, childKey, parentKey))
    throw new Error("Civil war was not registered");
  P8t(sim, war);
  H(sim, "war.player_declared", { warId: war.id, playerKey: childKey, enemyKey: parentKey,
    selectedTargetActorKey: parentKey, casusBelli: "coercion" }, { category: "guerre", severity: "danger" });
  for (const { chamberId, recipients } of seatTransfers) {
    const chamber = parent.pol.chambers.find(entry => entry.id === chamberId);
    const composition = { ...chamber.composition };
    delete composition[founderId];
    for (const [partyId, gain] of recipients) composition[partyId] = (composition[partyId] || 0) + gain;
    chamber.composition = composition;
  }
  parent[statusField] = { version: 1, id: childKey, childKey, warId: war.id, phase: "active",
    openedDay: sim.day, provinceKey, founderId, founderSupport, victorySupport, charter, incumbent,
    preparedDivisionCount: divisions.length, deployedCount: deployed.length, deployedRoster: deployed, vacatedSeats,
    defectingRegions: [...territoryPlan.joining].map(id => sim.world.provinces[id].__provKey),
    parentName, breakawayName, victoryName: restoration?.name || breakawayName,
    restoresOriginalName: !!restoration, restoreCustomName: !!restoration?.custom, profile,
    ...(flag && !x0r(sim, child.a2, flag) ? { flag: { src: flag.src, ratio: flag.ratio } } : {}) };
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

function gpmUprisingIntegrateArmy(sim, child, parent, headquartersKey) {
  const army = je(sim, child).filter(formation =>
    formation.owner === child.key && formation.domain === "land" && formation.type !== "reserve");
  if (!army.length) return 0;
  // Reconcile the original roster's secession-era inventory before adding the breakaway formations.
  b9(sim, parent);
  const units = new Set(army.map(formation => formation.id));
  for (const formation of army) {
    // Take the actual surviving equipment and existing personnel with the unit.
    for (const [id, quantity] of Object.entries(formation.equip)) {
      n9(parent.forces, id, X3(child.forces, id, quantity));
    }
    child.forces.active -= formation.manpowerK;
    parent.forces.active += formation.manpowerK;
    const position = Ce(sim, formation);
    const province = sim.world.provByKey.get(Z4a(sim, formation) || (position && tf(position[0], position[1])));
    const provKey = province && [child.key, parent.key].includes(Re(province))
      ? province.__provKey : headquartersKey;
    qg(sim, formation.id);
    formation.owner = parent.key;
    formation.ord = JQr(sim, parent, formation.type);
    formation.location = { type: "province", provKey };
    formation.pos = null;
    formation.homeBaseId = null;
    formation.assignment = null;
    formation.order = null;
    formation.baseDeployment = null;
    u4a(formation);
    parent.formations.push(formation.id);
  }
  child.formations = child.formations.filter(id => !units.has(id));
  return army.length;
}

function gpmUprisingSettleCase(sim, parent, state) {
  const parentKey = parent.key;
  const founderId = state.founderId;
  const result = state.nativeOutcome === "victory" ? "breakaway" : "government";
  const child = sim.countries.get(state.childKey);
  const founder = rP(child, founderId);
  const incumbent = rP(parent, to(parent)) || rP(parent, Et(parent));
  const targetParty = result === "breakaway" ? founder : incumbent;
  if (!child || sim.conflicts.has(state.warId) || !targetParty || targetParty.legal === false ||
      !rP(parent, founderId)?.gpmUprisingShell)
    throw new Error("Civil war succession has inconsistent parties or territory");
  const plan = { moves: [{ provIds: d5(sim, child.key).provinceIds, to: parentKey }] };
  const validation = N8t(sim, plan);
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
    hRa(sim, parent);
    state.profile ||= gpmUprisingProfile(founder);
    state.breakawayName ||= child.name;
    gpmUprisingGovernment(sim, parent, founder, state.profile, false);
    state.victoryName ||= state.breakawayName;
    // The normal display path supplies PPO's scenario title when the native override is empty.
    if (state.restoresOriginalName && !state.restoreCustomName) {
      _At(sim, parentKey, "");
    } else if (!_At(sim, parentKey, state.victoryName)) {
      throw new Error("Uprising country name is invalid");
    }
    state.appliedLaws = gpmApplyUprisingCharter(sim, parent, state.charter);
  } else {
    rP(parent, founderId).bannedYear = sim._simYear || 2026;
  }
  if (sim.playerKey === child.key || sim.playerKey === parentKey) {
    const handoff = sim.switchPlayerControl({ countryKey: parentKey, partyId: targetParty.id });
    if (!handoff.ok || !handoff.current.controlsExecutive) throw new Error("Postwar control failed");
  }
  if (result === "breakaway") {
    state.integratedDivisions = gpmUprisingIntegrateArmy(sim, child, parent, state.provinceKey);
  }
  const returned = _w(sim, plan);
  if (!returned.ok || sim.countries.has(child.key)) throw new Error("Postwar reunification failed");
  const flagTransferred = gpmRetireBreakawayFlag(sim, child, result === "breakaway" ? parent : null);
  if (!flagTransferred && result === "breakaway" && state.flag && parent.a2 && !x0r(sim, parent.a2, state.flag)) {
    state.flagRetained = true;
  }
  if (state.integratedDivisions) {
    b9(sim, parent);
    no(parent);
  }
  if (result === "breakaway") {
    state.inheritedWars = gpmDirectWars(sim, parentKey)
      .filter(entry => entry.war?.id !== state.warId)
      .map(entry => ({ key: entry.key, startDay: gpmUprisingWarStamp(entry),
        name: gpmHistoricalTitles(sim, entry.definition).shortTitle || entry.definition.name }));
  }
  Object.assign(state, { phase: "settled", result, settledDay: sim.day });
  const inherited = gpmUprisingInheritedWars(sim);
  if (parentKey === sim.playerKey && (inherited?.wars.some(war => !war.choice) || inherited?.voluntaryAid.length)) {
    H(sim, "gpm.war_choices_available", { countryKey: parentKey },
      { category: "guerre", audience: { countryKeys: [parentKey] }, journal: false });
  }
}

function gpmUprisingSettle(sim) {
  for (const parent of sim.countries.values()) {
    const state = parent[statusField];
    if (state?.phase === "resolving") gpmUprisingSettleCase(sim, parent, state);
  }
  const { parent, state } = gpmUprisingCase(sim);
  if (state?.result === "breakaway" && parent.key === sim.playerKey &&
      fn(parent) === state.founderId && sim.playerControlsGovernment(parent)) {
    gpmReviewInheritedPeace(sim, parent, state);
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

function gpmUprisingClearLegacyFlag(sim, key) {
  const country = sim.player;
  const { state } = gpmUprisingCase(sim);
  if (state && zw(country?.a2) === zw(key) && (country.key === state.childKey || state.flagRetained)) {
    delete state.flag;
    delete state.flagRetained;
  }
}

J7t("gpm.party.uprising.declare", { apply: gpmUprisingOpen });
J7t("gpm.party.uprising.warDecision", { apply: gpmUprisingWarDecision });
for (const action of ["form", "headquarters", "invest", "recruit", "aidRequest", "aidAccept", "aidDecline"]) {
  J7t("gpm.party.uprising." + action, {
    apply: (sim, country, input) => gpmUprisingPrepare(sim, country, input, action),
  });
}
return { view: gpmUprisingView, flags: gpmUprisingFlags, clearLegacyFlag: gpmUprisingClearLegacyFlag,
  inheritedWars: gpmUprisingInheritedWars,
  matches: gpmUprisingMatches, record: gpmUprisingRecordResult,
  captureStartingIdentities: gpmUprisingCaptureStartingIdentities,
  settle: gpmUprisingSettle, inspect: gpmUprisingStatus, advancePreparations: gpmUprisingAdvancePreparations,
  refreshStaffing: gpmUprisingRefreshStaffing, missionInvolves: gpmUprisingMissionInvolves,
  applyCharter: gpmApplyUprisingCharter, installGovernment: gpmUprisingGovernment };
})();

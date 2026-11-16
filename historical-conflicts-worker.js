const gpmHistoricalStockWar = "t0:russo-ukrainian-war";
const gpmHistoricalDefaultReadiness = .55;
const gpmHistoricalTerms = {
  "aid-access": "Humanitarian access agreement",
  "ceasefire": "Ceasefire",
  "autonomy": "Regional autonomy agreement",
  "transition": "Transitional government agreement",
};

function gpmHistoricalDefinitions(state) {
  const catalog = state?.version === 1 ? [...gpmHistoricalCatalog.conflicts, ...gpmHistoricalCatalog.legacyOnly] : gpmHistoricalCatalog.conflicts;
  if (!state?.departures) return catalog;
  return catalog.map(definition => {
    const row = state.conflicts[definition.id];
    if (!row?.departedActors?.length || row.status === "settled") return definition;
    const sides = definition.sides.map(side => side.filter(id => !row.departedActors.includes(id)));
    return { ...definition, sides };
  });
}

function gpmHistoricalActorById(id) {
  return gpmHistoricalCatalog.actors[id] || gpmHistoricalCatalog.legacyActors[id];
}

function gpmHistoricalForcePool(actorId) {
  return gpmHistoricalActorById(actorId)?.strength?.sharedPoolId || actorId;
}

function gpmHistoricalSidePools(side) {
  return new Set(side.map(gpmHistoricalForcePool));
}

function gpmHistoricalFactionShare(state) {
  const fronts = Object.create(null);
  for (const definition of gpmHistoricalDefinitions(state)) {
    if (state.conflicts[definition.id]?.status !== "active") continue;
    for (const poolId of gpmHistoricalSidePools(definition.sides.flat())) fronts[poolId] = (fronts[poolId] || 0) + 1;
  }
  return fronts;
}

function gpmHistoricalRegion(sim, definition, region) {
  const province = sim.world.provByKey.get(region.key);
  if (!province) throw new Error(`Unknown historical province ${region.key} in ${definition.id}`);
  return {
    key: region.key, name: region.name || province.__name,
    legalOwner: province.__countryKey,
    controller: region.controller || null,
    administrator: region.administrator || null,
    contested: !!region.contested,
    note: region.note || null,
  };
}

function gpmHistoricalSavedRegion(sim, state, definition, region) {
  let shared = state.regions[region.key];
  if (!shared) {
    if (!sim.world.provByKey.has(region.key)) return null;
    // Older campaigns can predate a catalog's regional mapping for a saved front.
    shared = state.regions[region.key] = {
      ...gpmHistoricalRegion(sim, definition, region), fronts: [], disruption: 0,
    };
  }
  if (!shared.fronts.includes(definition.id)) shared.fronts.push(definition.id);
  return shared;
}

function gpmHistoricalStrength(sim, actorId, kind) {
  const actor = gpmHistoricalActorById(actorId);
  const estimate = actor?.strength;
  const country = estimate?.basis === "native-roster" && gpmHistoricalCountry(sim, actor.countryKey);
  const personnelK = estimate?.gamePersonnel ? estimate.gamePersonnel / 1000 : country?.forces?.active || 0;
  // National rosters contribute a share of their personnel to a local front.
  const domesticShare = { insurgency: .15, nonstate: .20, civil: .50 }[kind] ?? 1;
  const personnelShare = gpmHistoricalCountryKinds.has(actor?.kind) ? domesticShare : 1;
  return Math.sqrt(personnelK * personnelShare) * (estimate?.readiness ?? gpmHistoricalDefaultReadiness);
}

function gpmHistoricalApplyLaws(sim, country, values) {
  if (!country || !values) return;
  const changes = Object.entries(values).map(([lawId, value]) => ({ lawId, value }));
  gpmUprising.applyCharter(sim, country, { changes });
}

function gpmHistoricalNativeForces(sim, parent, child, parentActor, childActor, provinces) {
  const original = [parent, child].map(country => Math.max(0, country.forces?.active || 0));
  if (!original[0] || !original[1]) return;
  const [parentEstimate, childEstimate] = [parentActor, childActor].map(actor => actor.strength?.gamePersonnel / 1000);
  const total = original[0] + original[1];
  const desired = Number.isFinite(childEstimate) && childEstimate > 0
    ? Math.min(childEstimate, total * childEstimate / ((parentEstimate || total) + childEstimate))
    : original[1];
  const parentPersonnel = Vg(parent);
  const childPersonnel = Vg(child);
  const laborCapacity = Math.max(0, (child.employment?.laborForceM || 0) * 1000 - original[1]);
  const requested = Math.min(Math.max(0, desired - original[1]), laborCapacity);
  const replacement = Math.min(requested, parentPersonnel.replacementK);
  const support = Math.min(requested - replacement, Math.max(0, parentPersonnel.supportK - original[0] * .15));
  const transfer = replacement + support;
  if (transfer) {
    parentPersonnel.replacementK -= replacement;
    parentPersonnel.supportK -= support;
    childPersonnel.replacementK += transfer;
    parent.forces.active -= transfer;
    child.forces.active += transfer;
    Qc(parent);
    Qc(child);
  }
  const definition = dn.formationTypes.infantry;
  const bases = w_e(sim, child);
  const slots = {};
  const readiness = childActor.strength?.readiness ?? gpmHistoricalDefaultReadiness;
  const deployable = Math.min(child.forces.active * readiness, childPersonnel.replacementK);
  const pool = R0e(sim, child, "land");
  const fielded = je(sim, child).filter(formation => formation !== pool);
  for (const equipmentId of Object.keys(definition.toe)) {
    const assigned = fielded.reduce((total, formation) => total + (formation.equip[equipmentId] || 0), 0);
    pool.equip[equipmentId] = Math.max(0, Math.floor(_a(child.forces, equipmentId) - assigned));
  }
  for (let index = 0; index < Math.ceil(deployable / definition.manpowerK); index++) {
    const province = provinces[index % provinces.length];
    const manpower = Math.min(definition.manpowerK, deployable - index * definition.manpowerK);
    const equipment = qpa(sim, child, definition.toe, [pool]);
    const unit = EE(sim, child, "infantry", definition, equipment, cC({ equip: equipment }, definition),
      definition.manpowerK, bases, slots, JHr(sim, child, "infantry"), province.__provKey);
    unit.manpowerK = 0;
    iPe(child, unit, manpower);
    unit.org = Math.round(100 * readiness);
    unit.location = { type: "province", provKey: province.__provKey };
    unit.ammunitionUnitsPerDay = Swe(unit.equip, unit.manpowerK);
    unit.state = "ready";
  }
}

function gpmHistoricalCreateNative(sim, definition, row, opening = definition.openingGovernment) {
  const { parentKey, actorId, provinceKeys, startDate, parentActorId = definition.sides[0][0] } = opening || definition.native;
  const actor = gpmHistoricalCatalog.actors[actorId];
  const parent = sim.countries.get(parentKey);
  if (!actor || !parent || !provinceKeys?.length || !definition.sides.flat().includes(actorId)) {
    throw new Error(`Invalid native historical setup ${definition.id}`);
  }
  const childKey = "gpm-historical-" + actorId;
  const name = opening?.title || actor.administrationName || actor.name;
  const provinces = provinceKeys.map(key => sim.world.provByKey.get(key));
  const replacementCapital = opening?.replacementCapitalKey && sim.world.provByKey.get(opening.replacementCapitalKey);
  if (provinces.some(province => !province || province.__countryKey !== parentKey ||
      province.__isCapital && !replacementCapital) ||
      replacementCapital && (replacementCapital.__countryKey !== parentKey || provinceKeys.includes(replacementCapital.__provKey))) {
    throw new Error(`Invalid historical territory in ${definition.id}`);
  }
  const plan = { create: [{ key: childKey, parentKey, provIds: provinces.map(province => province.__provId),
    a2: childKey, feature: OIo(childKey), name, hostile: definition.status === "active" }] };
  const split = YP(sim, plan);
  if (!split.ok) throw new Error(`Historical territorial split failed for ${definition.id}: ${split.reasonId}`);
  const child = sim.countries.get(childKey);
  PCt(sim, childKey, name);
  if (replacementCapital) replacementCapital.__isCapital = true;
  if (childKey === gpmSudanRivalKey) {
    gpmSudanSeedIdentity(sim, child);
    gpmHistoricalApplyLaws(sim, child, actor.charterLawValues);
  }
  if (opening) {
    // The wartime polity uses the native country economy and institutions.
    gpmHistoricalInstallVictoryGovernment(sim, child, actor, { ...opening, administration: opening.administration || opening.title });
    if (/^#[\da-f]{6}$/i.test(opening.color)) {
      child.mapColorCustom = [1, 3, 5].map(index => Number.parseInt(opening.color.slice(index, index + 2), 16));
    }
    const executive = Mc(sim, child, "head_of_state");
    const office = actor.identity?.headOfState ? "headOfState" : "leader";
    const premier = Mc(sim, child, "head_of_gov");
    const effective = Qt(sim, child);
    gpmHistoricalIdentifyPerson(office === "leader" && effective === premier && premier !== executive &&
      !actor.identity?.headOfGovernment ? premier : executive, actorId, office);
    if (premier && premier !== executive) {
      gpmHistoricalIdentifyPerson(premier, actorId, "headOfGovernment");
    }
    (sim.gpmHistoricalState.openingGovernments ??= {})[actorId] = { key: childKey, parentKey, frontId: definition.id,
      ...(opening.replacementCapitalKey ? { replacementCapitalKey: opening.replacementCapitalKey } : {}),
      ...(opening.subdivided ? { subdivided: true } : {}) };
  }
  gpmHistoricalNativeForces(sim, parent, child, gpmHistoricalCatalog.actors[parentActorId], actor, provinces);
  uDa(sim, child);
  row.nativeActors = { [parentKey]: parentActorId, [childKey]: actorId };
  if (definition.status !== "active") return;
  const side = key => ({ principalKey: key, participants: [{ countryKey: key, role: "principal" }] });
  const goal = (from, to) => a1e(from, to, 0);
  const war = oko(sim, { schemaVersion: 1, asOfDate: gpmHistoricalCatalog.asOf, conflicts: [{
    id: "gpm-history:" + definition.id,
    mode: "strategic", status: "active", aggressorKey: childKey,
    preT0DurationDays: startDate ? Math.max(0, Math.round((Date.parse(gpmHistoricalCatalog.asOf) - Date.parse(startDate)) / 86400000)) : 0,
    casusBelliId: "coercion", sourceIds: definition.sources,
    sides: { A: side(parentKey), B: side(childKey) },
    warGoals: { A: [goal(parentKey, childKey)], B: [goal(childKey, parentKey)] },
    occupation: [],
  }] })[0];
  nko(sim, war);
  row.nativeId = war.id;
  if (Object.hasOwn(row.nativeActors, sim.playerKey)) {
    const adopted = QDe(sim, war.id);
    if (!adopted.ok) throw new Error(`Historical War Theatre could not open for ${definition.id}: ${adopted.reason}`);
  }
}

function gpmHistoricalRestoreOpeningCapitals(sim) {
  for (const { parentKey, replacementCapitalKey } of Object.values(sim.gpmHistoricalState?.openingGovernments || {})) {
    const province = replacementCapitalKey && sim.world.provByKey.get(replacementCapitalKey);
    if (province?.__countryKey === parentKey) province.__isCapital = true;
  }
}

function gpmHistoricalOpeningWar(sim, war) {
  const state = sim.gpmHistoricalState;
  if (!state?.openingGovernments || !war?.id) return null;
  for (const [actorId, govt] of Object.entries(state.openingGovernments)) {
    const row = state.conflicts[govt.frontId];
    if (row?.nativeId === war.id) return { actorId, govt, row };
  }
  return null;
}

function gpmHistoricalAllowsRegionalGain(sim, government, province) {
  const actor = sim.gpmHistoricalState.conflicts[government.frontId]?.nativeActors?.[government.key];
  const plan = gpmHistoricalCatalog.victories[government.frontId]?.[actor];
  return !plan?.regionalOnly || plan.regionKeys.includes(province.__provKey) ||
    plan.regionKeys.includes(province.properties?.gpmOpeningSourceProvince);
}

function gpmHistoricalCheckOccupation(sim, war, province, controller) {
  if (!controller.startsWith(gpmHistoricalFactionPrefix)) return true;
  const opening = gpmHistoricalOpeningWar(sim, war);
  return !opening || controller !== opening.govt.key || province.__countryKey !== opening.govt.parentKey ||
    gpmHistoricalAllowsRegionalGain(sim, opening.govt, province);
}

function gpmHistoricalSettleOpeningWars(sim) {
  const state = sim.gpmHistoricalState;
  for (const [actorId, govt] of Object.entries(state?.openingGovernments || {})) {
    const row = state.conflicts[govt.frontId];
    const decision = row?.pendingOpeningOutcome;
    if (!decision || sim.conflicts.has(row.nativeId)) continue;
    const child = sim.countries.get(govt.key);
    const parent = sim.countries.get(govt.parentKey);
    if (!child || !parent) throw new Error("Opening settlement missing participating government");
    const actor = gpmHistoricalActorById(actorId);
    const plan = gpmHistoricalCatalog.victories[govt.frontId]?.[actorId];
    const childWon = decision.winner === child.key;
    const reunified = !childWon || plan?.scope === "national";
    let country = child;
    if (reunified) {
      country = parent;
      const territory = Gy(sim, child.key)?.provinceIds;
      const change = { moves: [{ provIds: territory, to: parent.key, claimPolicy: "settle_claims" }] };
      if (!territory?.length || !Ght(sim, change).ok) throw new Error("Invalid opening government reunification");
      const executive = childWon && Qt(sim, child);
      const premier = childWon && Mc(sim, child, "head_of_gov");
      const partyId = childWon ? gpmHistoricalInstallVictoryGovernment(sim, parent, actor, plan).partyId : kt(parent);
      if (childWon) {
        for (const [office, previous] of [["head_of_state", executive], ["head_of_gov", premier]]) {
          const official = Mc(sim, parent, office);
          if (official && previous?.alive && (office === "head_of_state" || Ze(parent, office) !== Ze(parent, "head_of_state"))) {
            Object.assign(official, { name: previous.name, given: previous.given, surname: previous.surname,
              g: previous.g, born: previous.born, culture: previous.culture, _seed: previous._seed });
            if (previous.gpmHistoricalPerson) official.gpmHistoricalPerson = previous.gpmHistoricalPerson;
          }
        }
        (state.nationalOutcomes ??= {})[parent.key] = { ...plan, countryKey: parent.key, actorId };
      }
      if (sim.playerKey === child.key) {
        const handoff = sim.switchPlayerControl({ countryKey: parent.key, partyId });
        if (!handoff.ok) throw new Error("Unable to transfer opening government player");
      }
      if (!YP(sim, change).ok || sim.countries.has(child.key)) throw new Error("Opening government reunification failed");
      gpmRetireBreakawayFlag(sim, child, childWon ? parent : null);
      const interimCapital = govt.replacementCapitalKey && sim.world.provByKey.get(govt.replacementCapitalKey);
      if (interimCapital?.__countryKey === parent.key) interimCapital.__isCapital = false;
      govt.replacementCapitalKey = null;
    } else if (plan?.scope === "independence" || govt.subdivided && plan?.scope === "autonomy") {
      const gained = decision.evidence.gainedProvinceKeys.map(key => sim.world.provByKey.get(key))
        .filter(province => province?.__countryKey === parent.key && !province.__isCapital &&
          gpmHistoricalAllowsRegionalGain(sim, govt, province));
      if (gained.length && !YP(sim, { moves: [{ to: child.key, provIds: gained.map(p => p.__provId), claimPolicy: "settle_claims" }] }).ok) {
        throw new Error("Could not record independence gains for " + actorId);
      }
      if (plan.scope === "independence" && !PCt(sim, child.key, plan.title)) throw new Error("Invalid independence title for " + actorId);
      if (plan.scope === "autonomy") {
        const autonomy = aTe(sim, child.key, { relationProfileId: plan.relationProfileId || "self_governing_territory",
          sovereignKey: parent.key, administratorKey: child.key, securitySponsorKey: parent.key });
        if (!autonomy.ok) throw new Error("Could not assign historical autonomy to " + child.key + ": " + autonomy.reasonId);
      }
      child.gpmHistoricalAdministration = plan.administration || null;
      (state.regionalOutcomes ??= {})[actorId] = {
        ...plan, countryKey: parent.key, actorId, polityKey: child.key, native: true,
      };
    }
    row.settlement = reunified ? "reunification" : plan?.scope === "autonomy" ? "autonomy" : "independence";
    row.winnerActor = row.nativeActors[decision.winner];
    row.victoryOutcome = childWon && plan ? { ...plan, actorId, polityKey: country.key, native: true,
      regionKeys: Gy(sim, country.key)?.provinceKeys || [] } : null;
    row.history.push({ day: sim.day, term: row.settlement, outcome: "implemented", ...decision.evidence });
    delete row.pendingOpeningOutcome;
  }
}

async function gpmHistoricalInitialize(sim, commitTransportBoundary) {
  if (sim.gpmHistoricalState || sim.day !== 0) return;
  const state = { version: gpmHistoricalCatalog.version, asOf: gpmHistoricalCatalog.asOf, conflicts: {}, regions: {} };
  for (const definition of gpmHistoricalDefinitions(state)) {
    const expiry = definition.status === "ceasefire" && definition.ceasefireEndsOn
      ? 1 + Math.round((Date.parse(definition.ceasefireEndsOn) - Date.parse(gpmHistoricalCatalog.asOf)) / 86400000)
      : null;
    const row = { status: definition.status, ...(expiry ? { ceasefireUntil: expiry } : {}), pressure: definition.status === "active" ? 30 : 0,
      disruption: definition.status === "occupation" ? 15 : definition.status === "active" ? 10 : 0, aidUntil: 0,
      openedDay: sim.day, lastReviewDay: sim.day, history: [], weeksActive: 0 };
    state.conflicts[definition.id] = row;
    const regions = (definition.regions || []).map(region => gpmHistoricalRegion(sim, definition, region));
    for (const region of regions) {
      const shared = state.regions[region.key] ??= { ...region, fronts: [], disruption: 0 };
      shared.fronts.push(definition.id);
      if (!definition.native && definition.mode !== "stock") shared.disruption = Math.max(shared.disruption, row.disruption);
      shared.contested ||= region.contested;
      if (!shared.controller && !shared.disputedController) shared.controller = region.controller;
      else if (shared.controller && region.controller && shared.controller !== region.controller) {
        shared.contested = true;
        shared.disputedController = true;
        shared.controller = null;
      }
      if (!shared.administrator) shared.administrator = region.administrator;
    }
    if (definition.mode === "stock") row.nativeId = gpmHistoricalStockWar;
  }
  sim.gpmHistoricalState = state;
  const splitParents = new Set();
  for (const actor of Object.values(gpmHistoricalCatalog.actors)) {
    if (actor.kind === "government") gpmHistoricalApplyLaws(sim, gpmHistoricalCountry(sim, actor.countryKey), actor.lawValues);
  }
  for (const definition of gpmHistoricalDefinitions(state)) {
    if (!definition.native && !definition.openingGovernment) continue;
    gpmHistoricalCreateNative(sim, definition, state.conflicts[definition.id]);
    splitParents.add((definition.openingGovernment || definition.native).parentKey);
  }
  // A territorial split divides inventory without rebalancing the parent's assignments.
  for (const key of splitParents) V7(sim, sim.countries.get(key));
  if (splitParents.size) await commitTransportBoundary(sim);
  gpmHistoricalUpdateDisruption(sim, state);
}

function gpmHistoricalCloseNative(sim, war, outcome) {
  if (!war) return;
  for (const row of Object.values(sim.gpmHistoricalState?.conflicts || {})) {
    if (row.nativeId !== war.id) continue;
    if (row.status === "settled") {
      if (outcome && row.history.at(-1)?.term === "native-settlement") row.history.at(-1).outcome = outcome;
      return;
    }
    row.status = "settled";
    row.history.push({ day: sim.day, term: "native-settlement", outcome: outcome || "peace" });
    row.pending = null;
    row.ceasefireUntil = null;
    row.settledDay = sim.day;
    return;
  }
}

function gpmHistoricalApplyTerm(sim, definition, row, term) {
  if (term === "aid-access") row.aidUntil = sim.day + 90;
  else if (term === "ceasefire") {
    row.status = "ceasefire";
    row.ceasefireUntil = sim.day + 90;
  } else {
    row.status = "settled";
    row.settlement = term;
    row.settledDay = sim.day;
    row.ceasefireUntil = null;
    for (const opening of definition.regions || []) {
      const administrator = opening.administrator || opening.controller;
      if (term !== "autonomy" || !administrator || !definition.sides[1].includes(administrator)) continue;
      const state = sim.gpmHistoricalState;
      const competingFront = gpmHistoricalDefinitions(state).some(front => front.id !== definition.id &&
        state.conflicts[front.id]?.status === "active" && front.regions?.some(item => item.key === opening.key));
      if (competingFront) continue;
      const region = gpmHistoricalSavedRegion(sim, state, definition, opening);
      if (!region) continue;
      region.administrator = administrator;
      region.autonomyAgreement = definition.id;
    }
  }
  row.history.push({ day: sim.day, term, outcome: "accepted" });
  row.pending = null;
}

function gpmHistoricalUpdateDisruption(sim, state) {
  const countryPressure = new Map();
  for (const definition of gpmHistoricalDefinitions(state)) {
    const row = state.conflicts[definition.id];
    if (!row || row.nativeId || row.disruption <= 0 || row.status === "uncertain") continue;
    const regions = definition.regions || [];
    if (!regions.length) {
      for (const key of definition.countryKeys) {
        const country = gpmHistoricalCountry(sim, key);
        if (country) countryPressure.set(country.key, Math.max(countryPressure.get(country.key) || 0, row.disruption * .06));
      }
    }
  }
  for (const region of Object.values(state.regions)) {
    const province = sim.world.provByKey.get(region.key);
    const key = province?.__countryKey;
    const country = sim.countries.get(key);
    if (!country?.pop || !region.disruption) continue;
    const share = Math.max(0, province.__pop || 0) / country.pop;
    countryPressure.set(key, (countryPressure.get(key) || 0) + region.disruption * Math.min(1, share));
  }
  for (const country of sim.countries.values()) {
    const pressure = countryPressure.get(country.key);
    if (pressure) country.gpmHistoricalSupplyFactor = 1 - Math.min(.12, pressure / 500);
    else delete country.gpmHistoricalSupplyFactor;
  }
}

function gpmHistoricalReviewProposal(sim, definition, row) {
  if (!row.pending && !row.nativeId && row.status === "active" && row.weeksActive >= 12 &&
      row.pressure >= 55 && (ka(definition.id) >>> 0) % 13 === Math.floor(sim.day / 7) % 13) {
    row.pending = { term: "ceasefire", label: gpmHistoricalTerms.ceasefire,
      offeredBy: null, reviewDay: sim.day + 14 };
  }
  if (!row.pending || row.pending.reviewDay > sim.day) return;
  const { term } = row.pending;
  if (term === "propose-withdrawal") {
    gpmHistoricalReviewWithdrawalOffer(sim, definition, row);
    return;
  }
  if (term.startsWith("terms:")) {
    const actorId = term.slice("terms:".length);
    const ready = row.status === "ceasefire" || row.status === "occupation" || row.weeksActive >= 4 && row.pressure >= 45;
    if (!ready || !gpmHistoricalImplementTerms(sim, definition, row, actorId)) {
      row.history.push({ day: sim.day, term: "political-agreement", outcome: "declined" });
      row.pending = null;
    }
    return;
  }
  const accepted = term === "aid-access" || term === "ceasefire" && row.pressure >= 38 ||
    ["autonomy", "transition"].includes(term) && row.status === "ceasefire" && row.pressure <= 20;
  if (accepted) gpmHistoricalApplyTerm(sim, definition, row, term);
  else {
    row.history.push({ day: sim.day, term, outcome: "declined" });
    row.pending = null;
  }
}

function gpmHistoricalAdvance(sim) {
  const state = sim.gpmHistoricalState;
  if (!state || sim.day <= 0) return;
  for (const row of Object.values(state.conflicts)) {
    if (row.nativeId || row.status !== "ceasefire" || !row.ceasefireUntil || sim.day < row.ceasefireUntil) continue;
    row.status = "active";
    row.ceasefireUntil = null;
    row.history.push({ day: sim.day, term: "ceasefire", outcome: "expired" });
  }
  if (sim.day % 7 !== 0) return;
  const fronts = gpmHistoricalFactionShare(state);
  const readyVictories = [];
  for (const shared of Object.values(state.regions)) shared.disruption = 0;
  for (const definition of gpmHistoricalDefinitions(state)) {
    const row = state.conflicts[definition.id];
    if (!row || row.lastReviewDay === sim.day) continue;
    row.lastReviewDay = sim.day;
    if (row.nativeId) {
      const war = sim.conflicts.get(row.nativeId);
      if (war?.status === "ended" || !war) gpmHistoricalCloseNative(sim, { id: row.nativeId });
      else row.pressure = Math.min(100, Math.round(Math.abs(war.score || 0)) + 30);
    }
    if (row.status === "active") {
      row.weeksActive = (row.weeksActive || 0) + 1;
      if (!row.nativeId) {
        const strength = definition.sides.map(side => [...gpmHistoricalSidePools(side)].reduce((sum, poolId) =>
          sum + gpmHistoricalStrength(sim, poolId, definition.kind) / (fronts[poolId] || 1), 0));
        const imbalance = Math.abs(strength[0] - strength[1]) / Math.max(1, strength[0] + strength[1]);
        row.pressure = Math.min(100, row.pressure + 2 + Math.round(2 * imbalance));
        const winner = gpmHistoricalUpdateFront(sim, definition, row, strength);
        if (winner !== undefined) readyVictories.push([definition, row, winner]);
      }
      row.disruption = Math.min(100, Math.max(0, row.disruption + (row.aidUntil > sim.day ? -3 : 2)));
    } else if (row.status !== "uncertain") {
      row.pressure = Math.max(0, row.pressure - 3);
      const floor = row.status === "occupation" ? 15 : 0;
      const recovery = row.settlement === "political-agreement" ? 4 : 2;
      row.disruption = Math.max(floor, row.disruption - recovery);
    }
    gpmHistoricalReviewWithdrawalPetition(sim, definition, row);
    gpmHistoricalReviewProposal(sim, definition, row);
    if (!row.nativeId) {
      const hasActiveRegion = row.status !== "uncertain" && row.status !== "settled";
      for (const region of definition.regions || []) {
        const shared = hasActiveRegion ? gpmHistoricalSavedRegion(sim, state, definition, region) : state.regions[region.key];
        if (shared) shared.disruption = Math.max(shared.disruption, row.disruption);
      }
    }
  }
  for (const [definition, row, winner] of readyVictories) {
    if (row.status === "active") gpmHistoricalFinishVictory(sim, definition, row, winner);
  }
  gpmHistoricalUpdateDisruption(sim, state);
}

function gpmHistoricalNegotiation(sim, definition, row) {
  const war = row.nativeId && sim.conflicts?.get(row.nativeId);
  const status = gpmHistoricalConflictStatus(row, war);
  if (!gpmHistoricalVisibleStatuses.has(status)) {
    return { options: [], reason: status === "settled" ? "This conflict has ended." : "No negotiations are available for this report." };
  }
  const transitionGovernment = row.transitionReview && definition.sides.flat().some(id => {
    const actor = gpmHistoricalActorById(id);
    return actor?.kind === "government" && gpmHistoricalCountryMatches(actor.countryKey, sim.playerKey);
  });
  const party = transitionGovernment || gpmHistoricalFrontSide(sim, definition) >= 0;
  const nativeParty = war && Eo(war, sim.playerKey);
  if (!row.nativeId && status === "occupation") {
    const withdrawal = gpmHistoricalWithdrawalAction(sim, definition, row);
    if (withdrawal.option) return { options: [withdrawal.option], reason: null };
    // Occupation reports may already offer a separate political agreement, such as special status.
    if (!gpmHistoricalWithdrawalPlan(sim, definition, row) &&
        sim.playerControlsGovernment() && party && !row.pending && !row.occupationAgreement) {
      const options = definition.sides.flat().map(id => [id, gpmHistoricalFactionOutcome(definition, id)])
        .filter(([, terms]) => terms?.policies?.length)
        .map(([id, terms]) => ({ id: "terms:" + id, label: terms.title }));
      if (options.length) return { options, reason: null };
    }
    return { options: [], reason: withdrawal.reason };
  }
  if (war ? !nativeParty : !party) {
    return { options: [], reason: "Your government is not a direct party to this conflict." };
  }
  if (!sim.playerControlsGovernment()) {
    return { options: [], reason: "Your government handles negotiations for this conflict." };
  }
  if (row.pending) return { options: [], reason: "A proposal is already waiting for a response." };
  if (definition.simulated) return { options: [], reason: war.mode === "operational"
    ? "Open the War Theatre to use this war's military and peace controls."
    : "Open Military to see the controls for this war." };
  const allowed = [];
  if (row.aidUntil <= sim.day) allowed.push("aid-access");
  if (!row.nativeId && !row.transitionReview && status === "active") allowed.push("ceasefire");
  if (!row.nativeId && !row.transitionReview && status === "ceasefire" && ["civil", "insurgency"].includes(definition.kind)) {
    if (definition.regions?.some(region => definition.sides[1].includes(region.administrator || region.controller))) {
      allowed.push("autonomy");
    }
    if (definition.kind === "civil") allowed.push("transition");
  }
  const options = allowed.map(id => ({ id, label: gpmHistoricalTerms[id] }));
  if (row.transitionReview) options.push({ id: "confirm-transition-truce", label: "Confirm post-transition truce" });
  else options.push(...gpmHistoricalVictoryTerms(sim, definition, row));
  const reason = war?.mode === "operational" ? "The War Theatre handles peace proposals for this war." :
    war ? "See Military for this war's available actions." : "There are no proposals available at this stage.";
  return { options, reason: options.length ? null : reason };
}

function gpmHistoricalActorView(sim, actor) {
  if (!actor) return null;
  const state = sim.gpmHistoricalState || { conflicts: {} };
  const national = Object.values(state.nationalOutcomes || {}).find(outcome => outcome.actorId === actor.id);
  const countryKey = national?.countryKey || state.regionalOutcomes?.[actor.id]?.polityKey ||
    (actor.id === gpmSudanRivalActor && state.conflicts[gpmSudanConflictId]?.settlement === "tasis-reunification" ? gpmSudanCountryKey : null);
  const factionCountry = gpmHistoricalCountry(sim, countryKey) || sim.countries.get("gpm-historical-" + actor.id);
  const governmentCountry = (actor.simulated || gpmHistoricalCountryKinds.has(actor.kind)) && gpmHistoricalCountry(sim, actor.countryKey);
  const incumbent = governmentCountry && state.nationalOutcomes?.[governmentCountry.key];
  const replacedByTasis = actor.id === gpmSudanIncumbentActor && state.conflicts[gpmSudanConflictId]?.settlement === "tasis-reunification";
  const country = factionCountry || (governmentCountry && !replacedByTasis &&
    (actor.simulated || !incumbent || incumbent.actorId === actor.id) ? governmentCountry : null);
  const ppoIdeology = gpmHistoricalCatalog.factionReview.actors[actor.id];
  if (!country) return { ...actor, ppoIdeology };
  const tracksLeadership = factionCountry || actor.simulated || actor.id === gpmSudanIncumbentActor;
  const executive = tracksLeadership ? Qt(sim, country) : null;
  const primeMinister = executive && Mc(sim, country, "head_of_gov");
  const count = amount => Number.isFinite(amount) ? Math.round(amount * 1000) : null;
  return { ...actor, ppoIdeology, nativeGovernment: true, ...(tracksLeadership ? {
    leadership: { leader: executive?.alive ? yc(executive) : null,
      headOfGovernment: primeMinister?.alive && primeMinister.id !== executive.id ? yc(primeMinister) : null,
      year: sim._simYear || 2026 },
  } : {}), nativeForces: {
    active: count(country.forces?.active), reserve: count(country.forces?.reserve),
  } };
}

function gpmHistoricalContestedCells(war) {
  const field = war?.field;
  if (!field?.prov || !field.terrain || !field.control) return [];
  const totals = new Map();
  for (let index = 0; index < field.prov.length; index++) {
    const provinceId = field.prov[index];
    const control = field.control[index];
    if (provinceId < 0 || !field.terrain[index] || (control !== 0 && control !== 1)) continue;
    const sides = totals.get(provinceId) || [0, 0];
    sides[control]++;
    totals.set(provinceId, sides);
  }
  const sideA = war.coalitions?.A?.principalKey || war.sideAKey;
  const sideB = war.coalitions?.B?.principalKey || war.sideBKey;
  return [...totals].filter(([, sides]) => sides[0] && sides[1]).map(([id, [b, a]]) => [id, {
    dominantKey: a >= b ? sideA : sideB, secondaryKey: a >= b ? sideB : sideA,
    dominance: Math.max(a, b) / (a + b),
    sides: [{ countryKey: sideA, cells: a }, { countryKey: sideB, cells: b }],
  }]);
}

const gpmHistoricalVisibleStatuses = new Set(["active", "ceasefire", "occupation", "suspended"]);
const gpmHistoricalCountryKinds = new Set(["government", "state", "state-force", "military-government"]);
const gpmHistoricalFactionPrefix = "gpm-historical-";
const gpmHistoricalNativeActorPrefix = "ppo-native-country:";

const gpmHistoricalShortNames = {
  "mmr-knu": "KNU",
  "ucdp-actor-57": "Russia",
  "ucdp-actor-61": "Ukraine",
  "ucdp-actor-6254": "Yemen government",
};

function gpmHistoricalShortName(actor) {
  return gpmHistoricalShortNames[actor?.id] || actor?.shortName || actor?.name;
}

function gpmHistoricalTitles(sim, definition) {
  const actors = [...new Set([...definition.sides.flat(), ...(definition.associatedActorIds || [])])]
    .map(id => gpmHistoricalViewActor(sim, id)).filter(Boolean);
  let shortTitle = definition.name;
  // Condense the catalog's automatically generated matchups while keeping authored war titles.
  if (definition.simulated || /\s(?:vs\.?|versus)\s/i.test(shortTitle)) {
    for (const actor of [...actors].sort((a, b) => b.name.length - a.name.length)) {
      shortTitle = shortTitle.replaceAll(actor.name, gpmHistoricalShortName(actor));
    }
  }
  return { shortTitle, participantNames: actors.flatMap(actor => [actor.name, gpmHistoricalShortName(actor)]) };
}

function gpmHistoricalCountryActor(sim, key) {
  const outcome = sim.gpmHistoricalState?.nationalOutcomes?.[key];
  if (outcome?.actorId && gpmHistoricalActorById(outcome.actorId)) return outcome.actorId;
  const faction = Object.entries(sim.gpmHistoricalState?.regionalOutcomes || {}).find(([, row]) => row.polityKey === key);
  if (faction && gpmHistoricalActorById(faction[0])) return faction[0];
  const actorId = key.startsWith(gpmHistoricalFactionPrefix) && key.slice(gpmHistoricalFactionPrefix.length);
  if (actorId && gpmHistoricalActorById(actorId)) return actorId;
  return gpmHistoricalNativeActorPrefix + key;
}

function gpmHistoricalViewActor(sim, id) {
  if (!id?.startsWith(gpmHistoricalNativeActorPrefix)) return gpmHistoricalActorById(id);
  const countryKey = id.slice(gpmHistoricalNativeActorPrefix.length);
  const country = sim.countries.get(countryKey);
  const name = lo(sim, country) || countryKey;
  const kind = country?.gpmUprisingParentKey || countryKey.startsWith("ppo-uprising-") ? "uprising" : "government";
  return { id, countryKey, name, kind, simulated: true };
}

function gpmHistoricalNativeOpponents(war) {
  return [war.coalitions?.A?.principalKey || war.sideAKey, war.coalitions?.B?.principalKey || war.sideBKey];
}

function gpmHistoricalNativeStatus(war) {
  return war.status === "suspended" ? "ceasefire" : war.status;
}

function gpmHistoricalConflictStatus(row, war) {
  if (war) return war.status === "ended" ? "settled" : gpmHistoricalNativeStatus(war);
  return row.nativeId && gpmHistoricalVisibleStatuses.has(row.status) ? "settled" : row.status;
}

function gpmHistoricalNativeSideKeys(war, side, principalKey) {
  return [...new Set([principalKey, ...Object.entries(war.participants || {})
    .filter(([, participant]) => participant.side === side).map(([key]) => key)].filter(Boolean))];
}

function gpmHistoricalLinkNativeWar(sim, war) {
  const state = sim.gpmHistoricalState;
  if (!state || !gpmHistoricalVisibleStatuses.has(war.status)) return;
  const [a, b] = gpmHistoricalNativeOpponents(war);
  if (!a || !b || a === b) return;
  // Link a continuation only when both principals are the actual opening governments.
  // Reports with overlapping participants or geography can describe distinct wars.
  const matches = gpmHistoricalDefinitions(state).filter(definition => {
    const row = state.conflicts[definition.id];
    if (!definition.openingGovernment || !row || row.nativeId || !gpmHistoricalVisibleStatuses.has(row.status)) return false;
    const [first, second] = definition.sides;
    const aActor = row.nativeActors?.[a];
    const bActor = row.nativeActors?.[b];
    return first.includes(aActor) && second.includes(bActor) || first.includes(bActor) && second.includes(aActor);
  });
  if (matches.length !== 1) return;
  const row = state.conflicts[matches[0].id];
  if (row.pending) row.history.push({ day: sim.day, term: row.pending.term, outcome: "superseded by native conflict" });
  row.pending = null;
  row.ceasefireUntil = null;
  row.transitionReview = false;
  row.nativeId = war.id;
  row.status = gpmHistoricalNativeStatus(war);
  row.history.push({ day: war.startDay ?? sim.day, term: "native-conflict", outcome: "native conflict began" });
}

function gpmHistoricalRestoreNativeWars(sim) {
  for (const war of sim.conflicts?.values() || []) {
    gpmHistoricalLinkNativeWar(sim, war);
    if (!gpmHistoricalVisibleStatuses.has(war.status) || !gpmHistoricalOpeningWar(sim, war)) continue;
    for (const [key, controller] of Object.entries(war.occupationCredit || {})) {
      const province = sim.world.provByKey.get(key);
      if (!province || gpmHistoricalCheckOccupation(sim, war, province, controller)) continue;
      if (!RS(sim, war, key).ok) continue;
      war.occupied?.delete(province.__provId);
      war.lost?.delete(province.__provId);
    }
  }
}

function gpmHistoricalConflictEntries(sim) {
  const state = sim.gpmHistoricalState;
  const wars = sim.conflicts || new Map();
  const entries = [];
  const linked = new Set();
  for (const definition of gpmHistoricalDefinitions(state)) {
    const row = state?.conflicts?.[definition.id];
    if (!row) continue;
    const nativeId = row.nativeId || (definition.mode === "stock" ? gpmHistoricalStockWar : null);
    const war = wars.get(nativeId);
    if (nativeId) linked.add(nativeId);
    const status = gpmHistoricalConflictStatus(row, war);
    entries.push({ definition, row, war, summaryStatus: status, mapStatus: status });
  }
  for (const war of wars.values()) {
    if (linked.has(war.id) || !gpmHistoricalVisibleStatuses.has(war.status)) continue;
    const opponents = gpmHistoricalNativeOpponents(war);
    if (opponents.some(key => typeof key !== "string") || opponents[0] === opponents[1]) continue;
    const countrySides = ["A", "B"].map((side, index) => gpmHistoricalNativeSideKeys(war, side, opponents[index]));
    const name = opponents.map(key => lo(sim, sim.countries.get(key)) || key).join(" / ");
    const nativeActors = Object.fromEntries(countrySides.flat().map(key => [key, gpmHistoricalCountryActor(sim, key)]));
    const sides = countrySides.map(keys => keys.map(key => nativeActors[key]));
    entries.push({
      definition: { id: "ppo-native-war:" + war.id, name, sides, countryKeys: countrySides.flat(),
        kind: "simulated-war", mode: war.mode, simulated: true },
      row: { nativeId: war.id, nativeActors },
      war, mapStatus: gpmHistoricalNativeStatus(war), summaryStatus: gpmHistoricalNativeStatus(war),
    });
  }
  return entries;
}

function gpmHistoricalWarActor(sim, definition, row, countryKey) {
  if (!countryKey) return null;
  return row.nativeActors?.[countryKey] || definition.sides.flat().find(id => {
    const actor = gpmHistoricalActorById(id);
    return gpmHistoricalCountryKinds.has(actor?.kind) &&
      gpmHistoricalCountryMatches(actor.wartimeCountryKey || actor.countryKey, countryKey);
  }) || gpmHistoricalCountryActor(sim, countryKey);
}

function gpmHistoricalNativeRegions(sim, war, authored) {
  const keys = new Set(authored);
  const battle = new Map();
  const occupations = new Map();
  const front = new Set();
  if (!gpmHistoricalVisibleStatuses.has(war?.status)) return { keys, battle, occupations, front };
  const [sideA, sideB] = [new Set(We(war, "A")), new Set(We(war, "B"))];
  const combatant = key => sideA.has(key) || sideB.has(key);
  for (const [id, pressure] of gpmHistoricalContestedCells(war)) {
    const province = sim.world.provinces[id];
    if (!province || !combatant(province.__countryKey)) continue;
    keys.add(province.__provKey);
    battle.set(province.__provKey, pressure);
  }
  const candidates = new Set([...keys, ...Object.keys(war.occupationCredit || {})]);
  for (const id of [...(war.occupied || []), ...(war.lost || [])]) {
    const key = sim.world.provinces[id]?.__provKey;
    if (key) candidates.add(key);
  }
  for (const key of candidates) {
    const province = sim.world.provByKey.get(key);
    if (!province) continue;
    const credit = fWa(sim, war, key);
    const owner = war.participants?.[province.__countryKey];
    const controller = war.participants?.[credit];
    if (!credit || province.__occupier !== credit || !owner || !controller || owner.side === controller.side ||
        !combatant(credit) || !combatant(province.__countryKey)) continue;
    if (!war.occupationCredit?.[key] && Tua(sim, key, war.id)) continue;
    occupations.set(key, credit);
    keys.add(key);
  }
  // Land contact uses only territory and captures that belong to this war.
  if (gpmHistoricalNativeOpponents(war).every(Boolean)) {
    const contact = dAa(sim, sideA, sideB, province => province.__occupier
      ? occupations.get(province.__provKey) : province.__countryKey);
    for (const id of [...contact.aFront, ...contact.bFront]) {
      const key = sim.world.provinces[id]?.__provKey;
      if (!key) continue;
      keys.add(key);
      front.add(key);
    }
  }
  return { keys, battle, occupations, front };
}

function gpmHistoricalControl(sim, pressure, captured, actorIdForCountry) {
  const side = (countryKey, percent) => {
    const actor = gpmHistoricalViewActor(sim, actorIdForCountry(countryKey));
    return { name: gpmHistoricalShortName(actor) || countryKey, percent,
      ...(actor?.mapColor ? { color: actor.mapColor } : {}) };
  };
  if (pressure) {
    const [a, b] = pressure.sides;
    if (a.countryKey && b.countryKey && a.countryKey !== b.countryKey) {
      const percent = Math.round(a.cells * 1000 / (a.cells + b.cells)) / 10;
      return [side(a.countryKey, percent), side(b.countryKey, 100 - percent)];
    }
  }
  return captured ? [side(captured, 100)] : [];
}

function gpmHistoricalProvinceControl(sim, definition, row, war, live, province, region, actorIdForCountry) {
  const key = province.__provKey;
  const pressure = live.battle.get(key);
  const occupationKey = live.occupations.get(key) || null;
  const captured = !!occupationKey && !pressure;
  const native = !!war || !!row.nativeId || !!definition.openingGovernment && !!row.nativeActors;
  const shared = sim.gpmHistoricalState?.regions?.[key];
  const regionalOutcome = row.victoryOutcome?.regionKeys?.includes(key) ? row.victoryOutcome : null;
  const outcome = shared?.regionalOutcome || regionalOutcome;
  const recognized = outcome?.native && !!outcome.polityKey && outcome.polityKey === (province.__polityKey || province.__countryKey)
    ? outcome.actorId : null;
  const autonomyAdministrator = shared?.autonomyAgreement === definition.id ? shared.administrator : null;
  const currentOwner = native ? actorIdForCountry(province.__countryKey) : null;
  const settledController = row.winnerActor && definition.native && shared?.currentController === row.winnerActor
    ? row.winnerActor : null;
  const reportedController = region.dominantActorId || (region.contested && region.controller) || null;
  const controllerId = captured ? actorIdForCountry(occupationKey) :
    (pressure && actorIdForCountry(pressure.dominantKey)) || reportedController ||
    recognized || settledController || currentOwner || region.controller || null;
  const administratorId = recognized || autonomyAdministrator || (!captured && region.administrator) || currentOwner;
  const contested = !captured && !!(pressure || region.contested || regionalOutcome?.mixed);
  const reportedDominantId = !pressure && contested ? reportedController : null;
  const eligibleController = controllerId && !gpmHistoricalViewActor(sim, controllerId)?.strategicOnly;
  const controlled = !contested && !captured && !definition.strategicOnly && !!eligibleController &&
    (recognized === controllerId || !native && region.controller === controllerId && region.administrator === controllerId);
  return { controllerId, administratorId, reportedDominantId, contested, occupationKey, captured, controlled,
    recognizedControl: !!recognized && recognized === controllerId,
    modeledContact: live.front.has(key), control: gpmHistoricalControl(sim, pressure, captured && occupationKey, actorIdForCountry),
    dominantKey: captured ? occupationKey : pressure?.dominantKey,
    secondaryKey: pressure?.secondaryKey, dominance: pressure?.dominance ?? region.dominance,
    dominantColor: pressure || captured ? null : region.color };
}

function gpmHistoricalMapView(sim) {
  const state = sim.gpmHistoricalState || {};
  const regions = new Map();
  const actors = {};
  const nativeCountryActors = {};
  const includeActor = id => {
    if (!id || Object.hasOwn(actors, id)) return;
    const actor = gpmHistoricalViewActor(sim, id);
    if (!actor) return;
    const { name, kind, strategicOnly, administrationName, mapColor: color, wartimeMapName, simulated } = actor;
    const sourceKey = /^\d+$/.test(actor.countryKey) ? actor.countryKey.padStart(3, "0") : actor.countryKey;
    const factionKey = state.regionalOutcomes?.[id]?.polityKey || gpmHistoricalFactionPrefix + id;
    const countryKey = sim.countries.has(factionKey) ? factionKey :
      (simulated || gpmHistoricalCountryKinds.has(kind)) && sim.countries.has(sourceKey) ? sourceKey : null;
    const flag = actor.identity?.flag;
    actors[id] = { id, name, shortName: gpmHistoricalShortName(actor), kind, strategicOnly, mapName: wartimeMapName, administrationName, sourceCountryKey: sourceKey,
      countryKey, color, simulated, ...(flag ? { identity: { flag } } : {}) };
  };
  for (const country of sim.countries.values()) {
    if (!country.key.startsWith(gpmHistoricalFactionPrefix)) continue;
    const id = country.key.startsWith(gpmHistoricalFactionPrefix + "polity-")
      ? gpmHistoricalCountryActor(sim, country.key) : country.key.slice(gpmHistoricalFactionPrefix.length);
    if (id.startsWith(gpmHistoricalNativeActorPrefix)) continue;
    includeActor(id);
    const outcome = state.regionalOutcomes?.[id];
    if (actors[id] && !actors[id].strategicOnly &&
        (outcome?.polityKey !== country.key || outcome.scope === "autonomy")) nativeCountryActors[country.key] = id;
  }
  for (const { definition, row, war, mapStatus: status } of gpmHistoricalConflictEntries(sim)) {
    if (!gpmHistoricalVisibleStatuses.has(status)) continue;
    const native = !!war || !!row.nativeId || !!definition.openingGovernment && !!row.nativeActors;
    const actorIdForCountry = key => gpmHistoricalWarActor(sim, definition, row, key);
    const warActors = Object.keys(war?.participants || {}).map(actorIdForCountry);
    const actorIds = [...new Set([...definition.sides.flat(), ...(definition.associatedActorIds || []), ...warActors])];
    actorIds.forEach(includeActor);
    const opponents = war && gpmHistoricalNativeOpponents(war);
    const currentSides = opponents ? ["A", "B"].map((side, index) =>
      gpmHistoricalNativeSideKeys(war, side, opponents[index]).map(actorIdForCountry)) : [[], []];
    const reversed = definition.sides[0]?.some(id => currentSides[1].includes(id)) &&
      !definition.sides[0].some(id => currentSides[0].includes(id));
    const sides = definition.sides.map((members, index) =>
      [...new Set([...members, ...(currentSides[reversed ? 1 - index : index] || [])])]);
    const front = { id: definition.id, name: definition.name, shortTitle: gpmHistoricalTitles(sim, definition).shortTitle,
      status, native, sides,
      crimeReport: definition.crimeReport, strategicOnly: definition.strategicOnly, simulated: definition.simulated, actorIds };
    const authoredRegions = new Map((definition.regions || []).map(region => [region.key, region]));
    const live = gpmHistoricalNativeRegions(sim, war, [...authoredRegions.keys()]);
    for (const key of live.keys) {
      const province = sim.world.provByKey.get(key);
      if (!province) continue;
      const region = authoredRegions.get(key) || {};
      const control = gpmHistoricalProvinceControl(sim, definition, row, war, live, province, region, actorIdForCountry);
      const { controllerId, administratorId, contested, captured, controlled } = control;
      includeActor(controllerId);
      includeActor(administratorId);
      includeActor(region.secondaryActorId);
      const dominantKey = control.dominantKey || actors[controllerId]?.countryKey;
      const secondaryKey = control.secondaryKey || actors[region.secondaryActorId]?.countryKey || province.__countryKey;
      const mapped = regions.get(key) || { key, name: region.name || province.__name, fronts: [] };
      const eligibleController = !!controllerId && !actors[controllerId]?.strategicOnly;
      const territorial = captured || contested || controlled;
      const political = !front.strategicOnly && (!front.crimeReport && (territorial || authoredRegions.has(key)) ||
        eligibleController && territorial);
      mapped.fronts.push({ ...front, ...control, reportedRegion: authoredRegions.has(key), political, strategic: true,
        dominantKey, secondaryKey, note: region.note || null });
      regions.set(key, mapped);
    }
  }
  return { regions: [...regions.values()], actors, nativeCountryActors, unmappedFronts: [] };
}

function gpmHistoricalFlags(sim) {
  const overrides = {};
  for (const [key, outcome] of Object.entries(sim.gpmHistoricalState?.nationalOutcomes || {})) {
    const country = sim.countries.get(key);
    if (!country?.a2 || outcome.incumbent || !outcome.actorId) continue;
    overrides[country.a2.toLowerCase()] = outcome.actorId;
  }
  for (const [actorId, outcome] of Object.entries(sim.gpmHistoricalState?.regionalOutcomes || {})) {
    const country = sim.countries.get(outcome.polityKey);
    if (country?.a2 && !country.a2.startsWith("gpm-historical-polity-")) overrides[country.a2.toLowerCase()] = actorId;
  }
  return overrides;
}

function gpmHistoricalView(sim, { id } = {}) {
  const state = sim.gpmHistoricalState || {};
  const control = un(sim);
  const header = { asOf: gpmHistoricalCatalog.asOf, day: sim.day, playerKey: sim.playerKey,
    partyId: control.partyId, campaignId: control.campaignId, controlRevision: control.controlRevision };
  const conflicts = [];
  let selected;
  const entries = gpmHistoricalConflictEntries(sim);
  const conflictsById = id ? new Map(entries.map(({ definition, summaryStatus }) =>
    [definition.id, { id: definition.id, name: definition.name, status: summaryStatus }])) : null;
  for (const { definition, row, war, summaryStatus: status } of entries) {
    const { native, regions, charterLawValues, ...summary } = definition;
    const result = { ...summary, ...gpmHistoricalTitles(sim, definition), status, pressure: row.pressure, disruption: row.disruption,
      ceasefireUntil: row.ceasefireUntil ?? null, mode: summary.mode || (war || row.nativeId ? "native" : "regional") };
    if (!definition.crimeReport && !definition.strategicOnly) {
      result.warCard = gpmWarCard(sim, definition, row, war, status, result.shortTitle);
    }
    const petition = row.withdrawalPetition?.countryKey === sim.playerKey ? row.withdrawalPetition : null;
    if (status === "occupation" && !row.nativeId) {
      const plan = gpmHistoricalWithdrawalPlan(sim, definition, row);
      if ([plan?.affected?.key, plan?.occupier?.key].includes(sim.playerKey)) {
        const { option } = gpmHistoricalWithdrawalAction(sim, definition, row);
        const offer = row.pending?.term === "propose-withdrawal" ? row.pending : null;
        const pending = petition?.status === "pending" || !!offer;
        if (option || pending) result.decision = { actionable: !!option, pending,
          label: option?.label || "View response status", description: option?.description,
          ...(option?.assessment ? { assessment: option.assessment } : {}),
          message: petition?.status === "pending" || petition?.status === "forwarded" ? petition.message :
            offer ? "The withdrawal proposal is waiting for the other government's response." : petition?.message,
          reviewDay: offer?.reviewDay ?? (petition?.status === "pending" ? petition.reviewDay : null) };
      }
    }
    if (!result.decision && petition?.message) {
      result.decision = { label: "View petition result", message: petition.message };
    }
    conflicts.push(result);
    if (id !== definition.id) continue;
    const outcomeRegions = new Set(row.victoryOutcome?.regionKeys || []);
    const openingRegions = new Map((regions || []).map(region => [region.key, region]));
    const actorIdForCountry = countryKey => gpmHistoricalWarActor(sim, definition, row, countryKey);
    const live = gpmHistoricalNativeRegions(sim, war, [...openingRegions.keys()]);
    const details = [...new Set([...live.keys, ...outcomeRegions])].filter(key => sim.world.provByKey.has(key)).map(key => {
      const region = openingRegions.get(key) || { key };
      const province = sim.world.provByKey.get(region.key);
      const opening = gpmHistoricalRegion(sim, definition, region);
      const shared = state.regions?.[key];
      const control = gpmHistoricalProvinceControl(sim, definition, row, war, live, province, region, actorIdForCountry);
      const pressure = live.battle.get(key);
      const militarySides = pressure?.sides?.filter(side => side.countryKey).map(side =>
        ({ ...side, actorId: actorIdForCountry(side.countryKey) }));
      const militaryControl = control.contested && militarySides?.length === 2 &&
        militarySides[0].countryKey !== militarySides[1].countryKey
        ? { sides: militarySides, totalCells: militarySides[0].cells + militarySides[1].cells } : null;
      const overlappingConflicts = (shared?.fronts || []).filter(frontId => frontId !== definition.id)
        .map(frontId => conflictsById.get(frontId)).filter(front => front && gpmHistoricalVisibleStatuses.has(front.status));
      const localOutcomes = outcomeRegions.has(key)
        ? shared?.localOutcomes?.filter(outcome => outcome.actorId === row.victoryOutcome.actorId &&
          outcome.title === row.victoryOutcome.title) : undefined;
      return { ...opening, ...region, legalControllerId: actorIdForCountry(opening.legalOwner),
        administrator: control.administratorId, occupationKey: control.occupationKey,
        currentController: control.controllerId, currentContested: control.contested, militaryControl,
        modeledContact: control.modeledContact, reportedRegion: openingRegions.has(key),
        controlled: control.controlled, control: control.control, runtimeOwner: province.__countryKey,
        disruption: row.disruption, localOutcomes,
        overlappingFronts: overlappingConflicts.map(front => front.name), overlappingConflicts };
    });
    const { options, reason: actionReason } = gpmHistoricalNegotiation(sim, definition, row);
    const warActors = Object.keys(war?.participants || {}).map(actorIdForCountry);
    const actorIds = new Set([...definition.sides.flat(), ...(definition.associatedActorIds || []), ...warActors, ...details.flatMap(region =>
      [region.controller, region.administrator, region.currentController, region.dominantActorId, region.secondaryActorId,
       ...(region.militaryControl?.sides.map(side => side.actorId) || [])]).filter(id => gpmHistoricalViewActor(sim, id))]);
    selected = { ...result,
      ...(result.warCard ? { warCard: gpmWarCard(sim, definition, row, war, status, result.shortTitle, true) } : {}),
      regions: details, actors: [...actorIds].map(actorId => {
      const actor = gpmHistoricalViewActor(sim, actorId);
      return { ...gpmHistoricalActorView(sim, actor), shortName: gpmHistoricalShortName(actor) };
    }),
      theatreKey: war?.mode === "operational" ? war.enemyKey : null,
      durationDays: war ? c4(sim, war) : null,
      canNegotiate: options.length > 0, options, actionReason, pending: row.pending || null,
      petition,
      history: [...(row.history || []), ...gpmWarRecentChanges(sim, war)].sort((a, b) => a.day - b.day).slice(-10),
      aidUntil: row.aidUntil, settlement: row.settlement || null,
      factionOutcomes: gpmHistoricalCatalog.factionReview.fronts[definition.id] || {},
      victoryOutcome: row.victoryOutcome || null, victoryBlocked: row.victoryBlocked || null,
      transitionReview: !!row.transitionReview, advantage: row.advantage || 0 };
  }
  return { ...header, conflicts, inheritedWars: gpmUprising.inheritedWars(sim), ...(selected ? { selected } : {}) };
}

function gpmHistoricalNegotiate(sim, country, { id, term }) {
  const state = sim.gpmHistoricalState;
  const definition = state && gpmHistoricalDefinitions(state).find(row => row.id === id);
  const row = state?.conflicts?.[id];
  if (!definition || !row || country?.key !== sim.playerKey) {
    return { ok: false, reason: "historical_term_unavailable" };
  }
  const negotiation = gpmHistoricalNegotiation(sim, definition, row);
  if (!negotiation.options.some(option => option.id === term)) {
    return { ok: false, reason: "historical_term_unavailable", ...(negotiation.reason ? { message: negotiation.reason } : {}) };
  }
  if (term === "petition-withdrawal") {
    const petition = { status: "pending", countryKey: country.key, partyId: cn(country),
      submittedDay: sim.day, reviewDay: gpmHistoricalWithdrawalReviewDay(sim.day),
      message: "Your government is considering your petition to negotiate a withdrawal." };
    row.withdrawalPetition = petition;
    row.history.push({ day: sim.day, term: "occupation-petition", outcome: "Petition sent to the government" });
    return { ok: true, message: "Petition submitted.", petition };
  }
  if (term === "propose-withdrawal") {
    const { terms } = gpmHistoricalWithdrawalPlan(sim, definition, row);
    gpmHistoricalOfferWithdrawal(sim, row, country.key, terms.title);
    return { ok: true, message: "Withdrawal proposal submitted.", pending: row.pending };
  }
  if (term === "confirm-transition-truce") {
    row.transitionReview = false;
    row.history.push({ day: sim.day, term: "government-transition", outcome: "Truce confirmed" });
    return { ok: true };
  }
  if (["claim-victory", "concede-victory"].includes(term)) return gpmHistoricalNegotiateVictory(sim, definition, row, term);
  const label = term.startsWith("terms:") ?
    gpmHistoricalFactionOutcome(definition, term.slice("terms:".length)).title : gpmHistoricalTerms[term];
  row.pending = { term, label, offeredBy: country.key, reviewDay: sim.day + 7 };
  return { ok: true, pending: row.pending };
}

Xgt("gpm.historicalConflicts.negotiate", { apply: gpmHistoricalNegotiate });

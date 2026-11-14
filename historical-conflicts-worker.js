const gpmHistoricalStockWar = "t0:russo-ukrainian-war";
const gpmHistoricalDefaultReadiness = .55;
const gpmHistoricalTerms = {
  "aid-access": "Humanitarian access agreement",
  "ceasefire": "Ceasefire",
  "autonomy": "Regional autonomy agreement",
  "transition": "Transitional government agreement",
};

function gpmHistoricalDefinitions(state) {
  if (state?.version === 1) return [...gpmHistoricalCatalog.conflicts, ...gpmHistoricalCatalog.legacyOnly];
  return gpmHistoricalCatalog.conflicts;
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

function gpmHistoricalStrength(actorId) {
  const estimate = gpmHistoricalActorById(actorId)?.strength;
  const personnel = Number(estimate?.gamePersonnel);
  return Number.isFinite(personnel) && personnel > 0
    ? Math.sqrt(personnel / 1000) * (estimate.readiness ?? gpmHistoricalDefaultReadiness)
    : 1;
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
    ? Math.min(childEstimate, total * childEstimate / ((parentEstimate || original[0]) + childEstimate))
    : original[1];
  const parentPersonnel = Th(parent);
  const childPersonnel = Th(child);
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
    dc(parent);
    dc(child);
  }
  const definition = zo.formationTypes.infantry;
  const bases = YIe(sim, child);
  const slots = {};
  const readiness = childActor.strength?.readiness ?? gpmHistoricalDefaultReadiness;
  const deployable = Math.min(child.forces.active * readiness, childPersonnel.replacementK);
  const pool = Tce(sim, child, "land");
  for (const equipmentId of Object.keys(definition.toe)) {
    pool.equip[equipmentId] = Math.floor(da(child.forces, equipmentId));
  }
  for (let index = 0; index < Math.ceil(deployable / definition.manpowerK); index++) {
    const province = provinces[index % provinces.length];
    const manpower = Math.min(definition.manpowerK, deployable - index * definition.manpowerK);
    const equipment = Cua(sim, child, definition.toe, [pool]);
    const unit = hK(sim, child, "infantry", definition, equipment, H_({ equip: equipment }, definition),
      definition.manpowerK, bases, slots, Fqr(sim, child, "infantry"), province.__provKey);
    unit.manpowerK = 0;
    Tbe(child, unit, manpower);
    unit.org = Math.round(100 * readiness);
    unit.location = { type: "province", provKey: province.__provKey };
    unit.ammunitionUnitsPerDay = HSe(unit.equip, unit.manpowerK);
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
    a2: childKey, feature: W7o(childKey), name, hostile: definition.status === "active" }] };
  const split = kP(sim, plan);
  if (!split.ok) throw new Error(`Historical territorial split failed for ${definition.id}: ${split.reasonId}`);
  const child = sim.countries.get(childKey);
  VPt(sim, childKey, name);
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
    const executive = uc(sim, child, "head_of_state");
    const office = actor.identity?.headOfState ? "headOfState" : "leader";
    const premier = uc(sim, child, "head_of_gov");
    const effective = Ua(sim, child);
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
  KRa(sim, child);
  row.nativeActors = { [parentKey]: parentActorId, [childKey]: actorId };
  if (definition.status !== "active") return;
  const side = key => ({ principalKey: key, participants: [{ countryKey: key, role: "principal" }] });
  const goal = (from, to) => nde(from, to, 0);
  const war = JSo(sim, { schemaVersion: 1, asOfDate: gpmHistoricalCatalog.asOf, conflicts: [{
    id: "gpm-history:" + definition.id,
    mode: "strategic", status: "active", aggressorKey: childKey,
    preT0DurationDays: startDate ? Math.max(0, Math.round((Date.parse(gpmHistoricalCatalog.asOf) - Date.parse(startDate)) / 86400000)) : 0,
    casusBelliId: "coercion", sourceIds: definition.sources,
    sides: { A: side(parentKey), B: side(childKey) },
    warGoals: { A: [goal(parentKey, childKey)], B: [goal(childKey, parentKey)] },
    occupation: [],
  }] })[0];
  XSo(sim, war);
  row.nativeId = war.id;
  if (Object.hasOwn(row.nativeActors, sim.playerKey)) {
    const adopted = dOe(sim, war.id);
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
      const territory = wy(sim, child.key)?.provinceIds;
      const change = { moves: [{ provIds: territory, to: parent.key, claimPolicy: "settle_claims" }] };
      if (!territory?.length || !Uyt(sim, change).ok) throw new Error("Invalid opening government reunification");
      const executive = childWon && Ua(sim, child);
      const premier = childWon && uc(sim, child, "head_of_gov");
      const partyId = childWon ? gpmHistoricalInstallVictoryGovernment(sim, parent, actor, plan).partyId : _t(parent);
      if (childWon) {
        for (const [office, previous] of [["head_of_state", executive], ["head_of_gov", premier]]) {
          const official = uc(sim, parent, office);
          if (official && previous?.alive && (office === "head_of_state" || Ve(parent, office) !== Ve(parent, "head_of_state"))) {
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
      if (!kP(sim, change).ok || sim.countries.has(child.key)) throw new Error("Opening government reunification failed");
      const interimCapital = govt.replacementCapitalKey && sim.world.provByKey.get(govt.replacementCapitalKey);
      if (interimCapital?.__countryKey === parent.key) interimCapital.__isCapital = false;
      govt.replacementCapitalKey = null;
    } else if (plan?.scope === "independence" || govt.subdivided && plan?.scope === "autonomy") {
      const gained = decision.evidence.gainedProvinceKeys.map(key => sim.world.provByKey.get(key))
        .filter(province => province?.__countryKey === parent.key && !province.__isCapital);
      if (gained.length && !kP(sim, { moves: [{ to: child.key, provIds: gained.map(p => p.__provId), claimPolicy: "settle_claims" }] }).ok) {
        throw new Error("Could not record independence gains for " + actorId);
      }
      if (plan.scope === "independence" && !VPt(sim, child.key, plan.title)) throw new Error("Invalid independence title for " + actorId);
      if (plan.scope === "autonomy") {
        const autonomy = gOe(sim, child.key, { relationProfileId: plan.relationProfileId || "self_governing_territory",
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
      regionKeys: wy(sim, country.key)?.provinceKeys || [] } : null;
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
  let needsTransportCommit = false;
  for (const actor of Object.values(gpmHistoricalCatalog.actors)) {
    if (actor.kind === "government") gpmHistoricalApplyLaws(sim, gpmHistoricalCountry(sim, actor.countryKey), actor.lawValues);
  }
  for (const definition of gpmHistoricalDefinitions(state)) {
    if (!definition.native && !definition.openingGovernment) continue;
    gpmHistoricalCreateNative(sim, definition, state.conflicts[definition.id]);
    needsTransportCommit = true;
  }
  if (needsTransportCommit) await commitTransportBoundary(sim);
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
      row.pressure >= 55 && (va(definition.id) >>> 0) % 13 === Math.floor(sim.day / 7) % 13) {
    row.pending = { term: "ceasefire", label: gpmHistoricalTerms.ceasefire,
      offeredBy: null, reviewDay: sim.day + 14 };
  }
  if (!row.pending || row.pending.reviewDay > sim.day) return;
  const { term } = row.pending;
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
    if (row.status !== "ceasefire" || !row.ceasefireUntil || sim.day < row.ceasefireUntil) continue;
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
      const strength = definition.sides.map(side => [...gpmHistoricalSidePools(side)].reduce((sum, poolId) =>
        sum + gpmHistoricalStrength(poolId) / (fronts[poolId] || 1), 0));
      const imbalance = Math.abs(strength[0] - strength[1]) / Math.max(1, strength[0] + strength[1]);
      if (!row.nativeId) {
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

function gpmHistoricalOptions(sim, definition, row) {
  const transitionGovernment = row.transitionReview && definition.sides.flat().some(id => {
    const actor = gpmHistoricalActorById(id);
    return actor?.kind === "government" && gpmHistoricalCountryMatches(actor.countryKey, sim.playerKey);
  });
  const party = transitionGovernment || gpmHistoricalFrontSide(sim, definition) >= 0;
  const nativeParty = row.nativeActors && Object.hasOwn(row.nativeActors, sim.playerKey);
  if (!sim.playerControlsGovernment() || !(party || nativeParty) || row.pending ||
      ["uncertain", "settled", "dormant"].includes(row.status)) return [];
  if (row.status === "occupation") {
    if (row.occupationAgreement) return [];
    return definition.sides.flat().map(id => [id, gpmHistoricalFactionOutcome(definition, id)])
      .filter(([, terms]) => terms?.policies?.length)
      .map(([id, terms]) => ({ id: "terms:" + id, label: terms.title }));
  }
  const allowed = [];
  if (row.aidUntil <= sim.day) allowed.push("aid-access");
  if (row.nativeId) return allowed.map(id => ({ id, label: gpmHistoricalTerms[id] }));
  if (row.transitionReview) return [...allowed.map(id => ({ id, label: gpmHistoricalTerms[id] })), { id: "confirm-transition-truce", label: "Confirm post-transition truce" }];
  if (row.status === "active") allowed.push("ceasefire");
  if (row.status === "ceasefire" && ["civil", "insurgency"].includes(definition.kind)) {
    if (definition.regions?.some(region => definition.sides[1].includes(region.administrator || region.controller))) {
      allowed.push("autonomy");
    }
    if (definition.kind === "civil") allowed.push("transition");
  }
  return [...allowed.map(id => ({ id, label: gpmHistoricalTerms[id] })), ...gpmHistoricalVictoryTerms(sim, definition, row)];
}

function gpmHistoricalBlocksUprising(sim, countryKey) {
  if (!sim.gpmHistoricalState) return false;
  return gpmHistoricalDefinitions(sim.gpmHistoricalState).some(definition =>
    definition.countryKeys.some(key => gpmHistoricalCountryMatches(key, countryKey)) &&
    ["civil", "interstate"].includes(definition.kind) &&
    sim.gpmHistoricalState.conflicts[definition.id]?.status === "active" &&
    definition.sides.flat().some(id => {
      const actor = gpmHistoricalActorById(id);
      return gpmHistoricalCountryMatches(actor.countryKey, countryKey) && actor.kind === "government";
    }));
}

function gpmHistoricalActorView(sim, actor) {
  if (!actor) return null;
  const state = sim.gpmHistoricalState || { conflicts: {} };
  const national = Object.values(state.nationalOutcomes || {}).find(outcome => outcome.actorId === actor.id);
  const countryKey = national?.countryKey || state.regionalOutcomes?.[actor.id]?.polityKey ||
    (actor.id === gpmSudanRivalActor && state.conflicts[gpmSudanConflictId]?.settlement === "tasis-reunification" ? gpmSudanCountryKey : null);
  const factionCountry = gpmHistoricalCountry(sim, countryKey) || sim.countries.get("gpm-historical-" + actor.id);
  const governmentCountry = (actor.simulated || actor.kind === "government") && gpmHistoricalCountry(sim, actor.countryKey);
  const incumbent = governmentCountry && state.nationalOutcomes?.[governmentCountry.key];
  const replacedByTasis = actor.id === gpmSudanIncumbentActor && state.conflicts[gpmSudanConflictId]?.settlement === "tasis-reunification";
  const country = factionCountry || (governmentCountry && !replacedByTasis &&
    (actor.simulated || !incumbent || incumbent.actorId === actor.id) ? governmentCountry : null);
  const ppoIdeology = gpmHistoricalCatalog.factionReview.actors[actor.id];
  if (!country) return { ...actor, ppoIdeology };
  const tracksLeadership = factionCountry || actor.simulated || actor.id === gpmSudanIncumbentActor;
  const executive = tracksLeadership ? Ua(sim, country) : null;
  const primeMinister = executive && uc(sim, country, "head_of_gov");
  const count = amount => Number.isFinite(amount) ? Math.round(amount * 1000) : null;
  return { ...actor, ppoIdeology, nativeGovernment: true, ...(tracksLeadership ? {
    leadership: { leader: executive?.alive ? Ru(executive) : null,
      headOfGovernment: primeMinister?.alive && primeMinister.id !== executive.id ? Ru(primeMinister) : null,
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
  const name = Zr(sim, country) || countryKey;
  const kind = country?.gpmUprisingParentKey || countryKey.startsWith("ppo-uprising-") ? "uprising" : "government";
  return { id, countryKey, name, kind, simulated: true };
}

function gpmHistoricalNativeOpponents(war) {
  return [war.coalitions?.A?.principalKey || war.sideAKey, war.coalitions?.B?.principalKey || war.sideBKey];
}

function gpmHistoricalNativeStatus(war) {
  return war.status === "suspended" ? "ceasefire" : war.status;
}

function gpmHistoricalNativeSideKeys(war, side, principalKey) {
  return [...new Set([principalKey, ...Object.entries(war.participants || {})
    .filter(([, participant]) => participant.side === side).map(([key]) => key)].filter(Boolean))];
}

function gpmHistoricalMatchesNativeWar(sim, definition, row, [a, b]) {
  const match = (side, key) => side.some(id => {
    if (row.nativeActors?.[key] === id || gpmHistoricalCountryActor(sim, key) === id) return true;
    const actor = gpmHistoricalActorById(id);
    return gpmHistoricalCountryKinds.has(actor?.kind) &&
      gpmHistoricalCountryMatches(actor.wartimeCountryKey || actor.countryKey, key);
  });
  const [first, second] = definition.sides;
  return match(first, a) && match(second, b) || match(first, b) && match(second, a);
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
    const status = war ? gpmHistoricalNativeStatus(war) :
      row.nativeId && gpmHistoricalVisibleStatuses.has(row.status) ? "settled" : row.status;
    entries.push({ definition, row, war, summaryStatus: status === "ended" ? "settled" : status,
      mapStatus: status });
  }
  for (const war of wars.values()) {
    if (linked.has(war.id) || !gpmHistoricalVisibleStatuses.has(war.status)) continue;
    const opponents = gpmHistoricalNativeOpponents(war);
    if (opponents.some(key => typeof key !== "string") || opponents[0] === opponents[1]) continue;
    const matching = entries.filter(({ definition, row, war: existing }) => !definition.simulated && !existing && !row.nativeId &&
      gpmHistoricalVisibleStatuses.has(row.status) && gpmHistoricalMatchesNativeWar(sim, definition, row, opponents));
    if (matching.length === 1) {
      matching[0].war = war;
      matching[0].mapStatus = matching[0].summaryStatus = gpmHistoricalNativeStatus(war);
      continue;
    }
    const countrySides = ["A", "B"].map((side, index) => gpmHistoricalNativeSideKeys(war, side, opponents[index]));
    const name = opponents.map(key => Zr(sim, sim.countries.get(key)) || key).join(" / ");
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
  for (const [id, pressure] of gpmHistoricalContestedCells(war)) {
    const province = sim.world.provinces[id];
    if (!province || !war.participants?.[province.__countryKey]) continue;
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
    const credit = gDa(sim, war, key);
    const owner = war.participants?.[province.__countryKey];
    const controller = war.participants?.[credit];
    if (!credit || province.__occupier !== credit || !owner || !controller || owner.side === controller.side) continue;
    occupations.set(key, credit);
    keys.add(key);
  }
  // The stock War Theatre calculates land contact from participants' adjacent provinces.
  // Localized historical fronts retain their documented geography.
  if (!authored.length && gpmHistoricalNativeOpponents(war).every(Boolean)) {
    const contact = e2t(sim, war);
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
    return { name: actor?.wartimeMapName || actor?.shortName || actor?.name || countryKey, percent,
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

function gpmHistoricalMapView(sim) {
  const state = sim.gpmHistoricalState || {};
  const regions = new Map();
  const actors = {};
  const nativeCountryActors = {};
  const includeActor = id => {
    if (!id || Object.hasOwn(actors, id)) return;
    const actor = gpmHistoricalViewActor(sim, id);
    if (!actor) return;
    const { name, shortName, kind, strategicOnly, administrationName, mapColor: color, wartimeMapName, simulated } = actor;
    const sourceKey = /^\d+$/.test(actor.countryKey) ? actor.countryKey.padStart(3, "0") : actor.countryKey;
    const factionKey = state.regionalOutcomes?.[id]?.polityKey || gpmHistoricalFactionPrefix + id;
    const countryKey = sim.countries.has(factionKey) ? factionKey :
      (simulated || gpmHistoricalCountryKinds.has(kind)) && sim.countries.has(sourceKey) ? sourceKey : null;
    const flag = actor.identity?.flag;
    actors[id] = { id, name, shortName, kind, strategicOnly, mapName: wartimeMapName, administrationName, sourceCountryKey: sourceKey,
      countryKey, color, simulated, ...(flag ? { identity: { flag } } : {}) };
  };
  for (const country of sim.countries.values()) {
    if (!country.key.startsWith("gpm-historical-") || country.key.startsWith("gpm-historical-polity-")) continue;
    const id = country.key.slice("gpm-historical-".length);
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
    const front = { id: definition.id, name: definition.name, status, native,
      crimeReport: definition.crimeReport, strategicOnly: definition.strategicOnly, simulated: definition.simulated, actorIds };
    const authoredRegions = new Map((definition.regions || []).map(region => [region.key, region]));
    const live = gpmHistoricalNativeRegions(sim, war, [...authoredRegions.keys()]);
    for (const key of live.keys) {
      const province = sim.world.provByKey.get(key);
      if (!province) continue;
      const region = authoredRegions.get(key) || {};
      const shared = !definition.simulated && state.regions?.[key];
      const credit = live.occupations.get(key);
      const occupationKey = credit || (!definition.simulated && province.__occupier) || null;
      const pressure = live.battle.get(key);
      const captured = !!credit && !pressure;
      const contact = live.front.has(key);
      const controllerId = pressure && actorIdForCountry(pressure.dominantKey) ||
        (!captured && (region.dominantActorId || region.contested && region.controller)) || (native
        ? (war ? actorIdForCountry(occupationKey || province.__countryKey) : row.nativeActors?.[province.__countryKey]) || region.controller || null
        : shared?.currentController ?? region.controller ?? null);
      const administratorId = region.administrator && !captured ? region.administrator : native
        ? (war ? actorIdForCountry(province.__countryKey) : row.nativeActors?.[province.__countryKey]) || null
        : ((shared?.regionalOutcome || shared?.autonomyAgreement) && shared.administrator) || region.administrator || null;
      const contested = !captured && (!!pressure || region.contested || shared?.currentContested || false);
      includeActor(controllerId);
      includeActor(administratorId);
      includeActor(region.secondaryActorId);
      const dominantKey = captured ? occupationKey : pressure?.dominantKey || actors[controllerId]?.countryKey;
      const secondaryKey = pressure?.secondaryKey || actors[region.secondaryActorId]?.countryKey || province.__countryKey;
      const mapped = regions.get(key) || { key, name: region.name || province.__name, fronts: [] };
      const eligibleController = !!controllerId && !actors[controllerId]?.strategicOnly;
      const controlled = !contested && !captured && !front.strategicOnly && eligibleController &&
        (shared?.regionalOutcome?.actorId === controllerId && shared.regionalOutcome.native === true ||
         !native && region.controller === controllerId && region.administrator === controllerId);
      const territorial = captured || contested || controlled;
      const political = !front.strategicOnly && (!front.crimeReport && (territorial || authoredRegions.has(key)) ||
        eligibleController && territorial);
      mapped.fronts.push({ ...front, controllerId, administratorId, contested, occupationKey, captured, controlled, political,
        strategic: true, modeledContact: contact, control: gpmHistoricalControl(sim, pressure, captured && credit, actorIdForCountry),
        dominantKey, secondaryKey, dominance: pressure?.dominance ?? region.dominance,
        dominantColor: pressure || captured ? null : region.color, note: region.note || null });
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
  const header = { asOf: gpmHistoricalCatalog.asOf, day: sim.day, playerKey: sim.playerKey };
  const conflicts = [];
  let selected;
  for (const { definition, row, war, summaryStatus: status } of gpmHistoricalConflictEntries(sim)) {
    const { native, regions, charterLawValues, ...summary } = definition;
    const result = { ...summary, status, pressure: row.pressure, disruption: row.disruption,
      ceasefireUntil: row.ceasefireUntil ?? null, mode: summary.mode || (war || row.nativeId ? "native" : "regional") };
    conflicts.push(result);
    if (id !== definition.id) continue;
    const outcomeRegions = new Set(row.victoryOutcome?.regionKeys || []);
    const openingRegions = new Map((regions || []).map(region => [region.key, region]));
    const actorIdForCountry = countryKey => gpmHistoricalWarActor(sim, definition, row, countryKey);
    const live = gpmHistoricalNativeRegions(sim, war, [...openingRegions.keys()]);
    const details = [...new Set([...live.keys, ...outcomeRegions])].filter(key => sim.world.provByKey.has(key)).map(key => {
      const region = openingRegions.get(key) || { key };
      const province = sim.world.provByKey.get(region.key);
      const shared = (openingRegions.has(key) || outcomeRegions.has(key)) && state.regions?.[region.key] ||
        (province ? gpmHistoricalRegion(sim, definition, region) : {});
      const pressure = live.battle.get(key);
      const credit = live.occupations.get(key);
      const occupier = credit || (!definition.simulated && province?.__occupier) || null;
      const captured = !!credit && !pressure;
      const controller = (pressure && actorIdForCountry(pressure.dominantKey)) ||
        (occupier && actorIdForCountry(occupier)) || shared.currentController || shared.controller ||
        (war && actorIdForCountry(province?.__countryKey));
      const currentContested = !captured && !!(pressure || region.contested || (shared.currentContested ?? shared.contested));
      const militarySides = pressure?.sides?.filter(side => side.countryKey).map(side =>
        ({ ...side, actorId: actorIdForCountry(side.countryKey) }));
      const militaryControl = currentContested && militarySides?.length === 2 &&
        militarySides[0].countryKey !== militarySides[1].countryKey
        ? { sides: militarySides, totalCells: militarySides[0].cells + militarySides[1].cells } : null;
      return { ...shared, ...region, controller: shared.controller, administrator: shared.administrator,
        contested: shared.contested, occupationKey: occupier, currentController: controller,
        currentContested, militaryControl, modeledContact: live.front.has(key),
        control: gpmHistoricalControl(sim, pressure, captured && credit, actorIdForCountry),
        runtimeOwner: province?.__countryKey || null };
    });
    const options = definition.simulated ? [] : gpmHistoricalOptions(sim, definition, row);
    const warActors = Object.keys(war?.participants || {}).map(actorIdForCountry);
    const actorIds = new Set([...definition.sides.flat(), ...(definition.associatedActorIds || []), ...warActors, ...details.flatMap(region =>
      [region.controller, region.administrator, region.currentController, region.dominantActorId, region.secondaryActorId,
       ...(region.militaryControl?.sides.map(side => side.actorId) || [])]).filter(id => gpmHistoricalViewActor(sim, id))]);
    selected = { ...result, regions: details, actors: [...actorIds].map(actorId => gpmHistoricalActorView(sim, gpmHistoricalViewActor(sim, actorId))),
      theatreKey: war?.mode === "operational" ? war.enemyKey : null,
      durationDays: war ? N6(sim, war) : null,
      canNegotiate: options.length > 0, options, pending: row.pending || null, history: (row.history || []).slice(-10),
      aidUntil: row.aidUntil, settlement: row.settlement || null,
      factionOutcomes: gpmHistoricalCatalog.factionReview.fronts[definition.id] || {},
      victoryOutcome: row.victoryOutcome || null, victoryBlocked: row.victoryBlocked || null,
      transitionReview: !!row.transitionReview, advantage: row.advantage || 0 };
  }
  return { ...header, conflicts, ...(selected ? { selected } : {}) };
}

function gpmHistoricalNegotiate(sim, country, { id, term }) {
  const state = sim.gpmHistoricalState;
  const definition = state && gpmHistoricalDefinitions(state).find(row => row.id === id);
  const row = state?.conflicts[id];
  if (!definition || !row || country?.key !== sim.playerKey ||
      !gpmHistoricalOptions(sim, definition, row).some(option => option.id === term)) {
    return { ok: false, reason: "historical_term_unavailable" };
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

n5t("gpm.historicalConflicts.negotiate", { apply: gpmHistoricalNegotiate });

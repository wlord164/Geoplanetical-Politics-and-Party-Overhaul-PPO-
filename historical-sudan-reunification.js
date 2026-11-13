const gpmSudanConflictId = "sudan-civil-war";
const gpmSudanCountryKey = "729";
const gpmSudanIncumbentActor = "sdn-saf";
const gpmSudanRivalActor = "sdn-rsf";
const gpmSudanRivalKey = "gpm-historical-" + gpmSudanRivalActor;

function gpmHistoricalCultureCountry(key) {
  if (typeof key !== "string") return key;
  const parent = /^ppo-uprising-(.+)-\d+$/.exec(key)?.[1];
  if (parent) return gpmHistoricalCultureCountry(parent);
  const prefix = ["gpm-historical-polity-", "gpm-historical-"].find(value => key.startsWith(value));
  if (!prefix) return key;
  const actor = gpmHistoricalActorById(key.slice(prefix.length));
  const countryKey = actor?.countryKey;
  return /^\d+$/.test(countryKey) ? countryKey.padStart(3, "0") : countryKey || key;
}

function gpmHistoricalIdentifyPerson(person, actorId, office = "leader") {
  const identity = gpmHistoricalActorById(actorId)?.identity?.[office];
  if (!person || !identity) return false;
  Object.assign(person, nGe(identity.name), {
    name: identity.name, g: identity.g || "m", born: identity.born ?? null, seeded: false,
    gpmHistoricalPerson: `${actorId}:${office}`,
  });
  if (Number.isInteger(identity.bornMonth)) person.bornMonth = identity.bornMonth;
  return true;
}

function gpmSudanIdentifyIncumbent(sim, fresh = false) {
  const country = sim.countries.get(gpmSudanCountryKey);
  if (!country) return;
  const chair = uc(sim, country, "head_of_state", { exercising: false });
  if (chair?.alive && chair.seeded && chair.name === n2.seed[gpmSudanCountryKey]?.name) {
    gpmHistoricalIdentifyPerson(chair, gpmSudanIncumbentActor);
  }
  const pm = uc(sim, country, "head_of_gov", { exercising: false });
  const office = Ve(country, "head_of_gov");
  if (pm?.alive && pm !== chair && !pm.gpmHistoricalPerson && (fresh ||
      H8(country, office)?.mandate?.startedDay === 0 && pm._seed === va(`${country.key}:constitutional-office:${office}`))) {
    gpmHistoricalIdentifyPerson(pm, gpmSudanIncumbentActor, "headOfGovernment");
  }
}

function gpmSudanSeedIdentity(sim, country) {
  gpmSudanIdentifyIncumbent(sim, true);
  gpmHistoricalIdentifyPerson(uc(sim, country, "head_of_state"), gpmSudanRivalActor);
  if (Ve(country, "head_of_state") !== Ve(country, "head_of_gov")) {
    gpmHistoricalIdentifyPerson(uc(sim, country, "head_of_gov"), gpmSudanRivalActor, "headOfGovernment");
  }
  sim.gpmHistoricalState.conflicts[gpmSudanConflictId].gpmVerifiedLeadership = true;
}

function gpmSudanRestoreIdentity(sim) {
  const row = sim.gpmHistoricalState?.conflicts?.[gpmSudanConflictId];
  if (!row || row.gpmVerifiedLeadership) return;
  if (row.settlement !== "tasis-reunification") gpmSudanIdentifyIncumbent(sim);
  const reunificationDay = row?.settlement === "tasis-reunification" ? row.reunifiedDay : null;
  const republic = Number.isInteger(reunificationDay) && sim.countries.get(gpmSudanCountryKey);
  const country = sim.countries.get(gpmSudanRivalKey) || republic;
  if (!country) return;
  if (country === republic && Xe(country).government?.formationProcedureId !== "gpm.historical.sudan.transition") return;
  const installedDay = country === republic ? reunificationDay : 0;
  const offices = [["head_of_state", "leader"], ["head_of_gov", "headOfGovernment"]];
  for (const [role, office] of offices) {
    if (role === "head_of_gov" && Ve(country, role) === Ve(country, "head_of_state")) continue;
    const assignment = H8(country, role);
    const person = sim.people.get(assignment?.principal?.personId);
    if (!person?.alive || person.gpmHistoricalPerson || assignment.mandate?.startedDay !== installedDay ||
        (assignment.mandate.sourceProcedureId && assignment.mandate.sourceProcedureId !== "gpm.historical.sudan.transition")) continue;
    if (country !== republic) {
      const originalSeed = role === "head_of_state" ? $d(`${country.key}:secede`) : va(`${country.key}:constitutional-office:${Ve(country, role)}`);
      if (person._seed !== originalSeed) continue;
    }
    gpmHistoricalIdentifyPerson(person, gpmSudanRivalActor, office);
  }
  row.gpmVerifiedLeadership = true;
}

function gpmSudanWarRow(sim, war) {
  const row = sim.gpmHistoricalState?.conflicts[gpmSudanConflictId];
  return row?.nativeId && row.nativeId === war?.id ? row : null;
}

function gpmHistoricalCivilWarTerms(sim, war, winner, loser, terms, options, basis = "military-gains") {
  const row = gpmSudanWarRow(sim, war);
  const isSudan = row && (winner === gpmSudanCountryKey && loser === gpmSudanRivalKey ||
    winner === gpmSudanRivalKey && loser === gpmSudanCountryKey);
  const playerUprising = gpmUprising.matches(sim, war);
  const wartime = gpmHistoricalOpeningWar(sim, war);
  if (!isSudan && !playerUprising && !wartime) return HE(sim, war, winner, loser, terms, options);
  const gainedProvinceKeys = CG(sim, war, winner, loser).map(province => province.key);
  if (basis === "military-gains" && !gainedProvinceKeys.length) {
    return { ok: false, reasonId: "civil_war_no_territorial_gains" };
  }
  const evidence = { basis, gainedProvinceKeys, ...(basis === "negotiated-concession" ? { concessionBy: loser } : {}) };
  // The continuing state keeps its ID. Reunification follows the native occupation cleanup.
  const finalTerms = isSudan || wartime ? [{ type: "status_quo", targetKey: loser }] : terms;
  const result = HE(sim, war, winner, loser, finalTerms, options);
  if (!result.ok) return result;
  if (isSudan) row.pendingReunification = { winner, decidedDay: sim.day, evidence };
  else if (wartime) wartime.row.pendingOpeningOutcome = { winner, decidedDay: sim.day, evidence };
  else war.gpmDecisiveEvidence = evidence;
  return result;
}

function gpmSudanTasisParty(sim, country) {
  const existing = country.pol.parties.find(party => party.gpmHistoricalActorId === gpmSudanRivalActor);
  if (existing) return existing;
  const previous = Lio(country.pol.parties);
  const actor = gpmHistoricalCatalog.actors[gpmSudanRivalActor];
  const change = R1a(country.pol, {}, .02, (party, parties) => {
    Vda(party, ol(country.key), (country.hash ^ sim.rngSeed0) >>> 0, parties);
    party.nameDesc = { ...party.nameDesc, gpmName: actor.name, gpmTag: "Tasis" };
    party.gpmHistoricalActorId = gpmSudanRivalActor;
  });
  qMa(country, change, previous);
  s1a(country, change, previous);
  sim._reconcilePolity(country);
  const party = fS(country, change.id);
  if (!party) throw new Error("Sudan transitional coalition could not be registered");
  return party;
}

function gpmSudanTransferOfficial(sim, country, office, partyId, person) {
  const role = ar(country, office).role;
  if (!person?.alive) return Vc(sim, { countryKey: country.key, party: partyId, role, since: sim._simYear });
  // The rival polity remains in the institution graph until territorial reunification completes.
  // Carry its current holder into Sudan without prematurely invalidating the rival's office assignment.
  const successor = Vc(sim, { countryKey: country.key, party: partyId, role, since: sim._simYear,
    name: person.name, given: person.given, surname: person.surname, culture: person.culture,
    g: person.g, born: person.born, bornMonth: person.bornMonth, seed: person._seed,
    traits: person.traits, ideal: person.ideal, background: person.background });
  successor.born = person.born;
  if (person._station) successor._station = person._station;
  if (person.gpmHistoricalPerson) successor.gpmHistoricalPerson = person.gpmHistoricalPerson;
  return successor;
}

function gpmSudanInstallTasis(sim, country, rival) {
  const party = gpmSudanTasisParty(sim, country);
  const office = Ve(country, "head_of_gov");
  const stateOffice = Ve(country, "head_of_state");
  const actor = gpmHistoricalCatalog.actors[gpmSudanRivalActor];
  const official = () => "gpm.historical.sudan.transition:" + country.key + ":" + Xe(country).revision;
  const chair = uc(sim, rival, "head_of_state");
  const primeMinister = uc(sim, rival, "head_of_gov");
  const head = gpmSudanTransferOfficial(sim, country, office, party.id, stateOffice === office ? chair || primeMinister : primeMinister);
  const occupant = person => ({ personId: person.id, partyId: party.id, controllerRef: { kind: "party", id: party.id } });
  const government = { coalitionPartyIds: [party.id], supportPartyIds: [], status: "installed" };
  const install = Yc(sim, country, {
    intent: "government.install", transitionId: official(), expectedRevision: Xe(country).revision, day: sim.day,
    head: occupant(head), leadPartyId: party.id, formationProcedureId: "gpm.historical.sudan.transition", ...government,
  });
  if (!install.ok) throw new Error("Sudan transitional executive failed: " + JSON.stringify(install));

  // The charter commits to decentralization. Leave the timetable and detailed regional institutions for gameplay.
  const chamber = country.pol.chambers[0];
  const draft = Bht(country, chamber, { stateStructure: "decentralized" });
  const president = stateOffice === office ? head :
    gpmSudanTransferOfficial(sim, country, stateOffice, party.id, chair === primeMinister ? null : chair);
  const institution = Xe(country);
  const transition = Yc(sim, country, {
    intent: "constitution.reconcile", transitionId: official(), expectedRevision: institution.revision,
    constitutionRevision: institution.constitutionRevision + 1, day: sim.day,
    sourceProcedureId: "gpm.historical.sudan.transition", constitution: draft.constitution,
    chambers: draft.draftChambers, government, replaceHeadOfState: occupant(president),
  });
  if (!transition.ok || _t(country) !== party.id) {
    throw new Error("Sudan charter framework failed: " + JSON.stringify(transition));
  }
  Object.assign(country.pol.regime, draft.polity.regime);
  qy(sim, country, sim._simYear);
  wMa(country);
  j2e(sim, country);
  sim._reclassRegime(country, true);
  gpmHistoricalApplyLaws(sim, country, actor.charterLawValues);
  country.gpmHistoricalAdministration = actor.administrationName;
  return party.id;
}

function gpmSudanReunify(sim) {
  const state = sim.gpmHistoricalState;
  const row = state?.conflicts[gpmSudanConflictId];
  const decision = row?.pendingReunification;
  if (!decision || sim.conflicts.has(row.nativeId)) return;
  const country = sim.countries.get(gpmSudanCountryKey);
  const rival = sim.countries.get(gpmSudanRivalKey);
  if (!country || !rival) throw new Error("Sudan postwar territorial actors are unavailable");
  const territory = wy(sim, rival.key)?.provinceIds;
  if (!territory?.length) throw new Error("Sudan rival territory is unavailable");
  const plan = { moves: [{ provIds: territory, to: country.key, claimPolicy: "settle_claims" }] };
  const validation = Uyt(sim, plan);
  if (!validation.ok) throw new Error("Sudan reunification could not proceed: " + validation.reasonId);
  const tasisWon = decision.winner === rival.key;
  const partyId = tasisWon ? gpmSudanInstallTasis(sim, country, rival) : _t(country);
  const playerInSudan = sim.playerKey === rival.key || sim.playerKey === country.key;
  if (playerInSudan) {
    const handoff = sim.switchPlayerControl({ countryKey: country.key, partyId });
    if (!handoff.ok || !handoff.current.controlsExecutive) throw new Error("Sudan postwar control handoff failed");
  }
  const returned = kP(sim, plan);
  if (!returned.ok || sim.countries.has(rival.key)) throw new Error("Sudan wartime administration could not retire");
  // The Tasis charter gives its own English rendering of the continuing state name.
  VPt(sim, country.key, tasisWon ? "Republic of Sudan" : "");
  const winnerActor = row.nativeActors?.[decision.winner] || (tasisWon ? gpmSudanRivalActor : "sdn-saf");
  row.settlement = tasisWon ? "tasis-reunification" : "saf-reunification";
  row.reunifiedDay = sim.day;
  row.winnerActor = winnerActor;
  row.administrationName = country.gpmHistoricalAdministration || null;
  row.history.push({ day: sim.day, term: row.settlement, outcome: "implemented", ...decision.evidence });
  for (const region of Object.values(state.regions)) {
    if (!region.fronts.includes(gpmSudanConflictId)) continue;
    if (region.fronts.some(front => front !== gpmSudanConflictId && state.conflicts[front]?.status === "active")) continue;
    if (!region.contested && (!region.controller || region.controller === "sdn-saf" || region.controller === gpmSudanRivalActor)) {
      region.currentController = winnerActor;
    }
  }
  delete row.pendingReunification;
}

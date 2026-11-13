const gpmSudanConflictId = "sudan-civil-war";
const gpmSudanCountryKey = "729";
const gpmSudanRivalActor = "sdn-rsf";
const gpmSudanRivalKey = "gpm-historical-" + gpmSudanRivalActor;

function gpmSudanWarRow(sim, war) {
  const row = sim.gpmHistoricalState?.conflicts[gpmSudanConflictId];
  return row?.nativeId && row.nativeId === war?.id ? row : null;
}

function gpmSudanDecisiveTerms(sim, war, winner, loser, terms, options) {
  const row = gpmSudanWarRow(sim, war);
  const isSudan = row && (winner === gpmSudanCountryKey && loser === gpmSudanRivalKey ||
    winner === gpmSudanRivalKey && loser === gpmSudanCountryKey);
  if (!isSudan) return HE(sim, war, winner, loser, terms, options);
  // The Sudan ID is the continuing state. Defer reunification until native cleanup clears occupation.
  const result = HE(sim, war, winner, loser, [{ type: "status_quo", targetKey: loser }], options);
  if (result.ok) row.pendingReunification = { winner, decidedDay: sim.day };
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

function gpmSudanInstallTasis(sim, country) {
  const party = gpmSudanTasisParty(sim, country);
  const office = Ve(country, "head_of_gov");
  const actor = gpmHistoricalCatalog.actors[gpmSudanRivalActor];
  const official = () => "gpm.historical.sudan.transition:" + country.key + ":" + Xe(country).revision;
  const head = Tio(sim, country, party.id, office) || Vc(sim, {
    countryKey: country.key, party: party.id, role: ar(country, office).role, born: sim._simYear - 50, since: sim._simYear,
  });
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
  const stateOffice = Ve(country, "head_of_state");
  const president = stateOffice === office ? head : Vc(sim, {
    countryKey: country.key, party: party.id, role: ar(country, stateOffice).role, born: sim._simYear - 55, since: sim._simYear,
  });
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
  const partyId = tasisWon ? gpmSudanInstallTasis(sim, country) : _t(country);
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
  row.history.push({ day: sim.day, term: row.settlement, outcome: "implemented" });
  for (const region of Object.values(state.regions)) {
    if (!region.fronts.includes(gpmSudanConflictId)) continue;
    if (region.fronts.some(front => front !== gpmSudanConflictId && state.conflicts[front]?.status === "active")) continue;
    if (!region.contested && (!region.controller || region.controller === "sdn-saf" || region.controller === gpmSudanRivalActor)) {
      region.currentController = winnerActor;
    }
  }
  delete row.pendingReunification;
}

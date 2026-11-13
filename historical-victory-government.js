const gpmHistoricalParliamentaryReform = {
  ceremonial: true,
  vacancyHoS: "acting_then_election",
  vacancyHoG: "party",
  headSelection: "elected",
  headBallot: "parliament",
  headGovExists: 1,
  headGovSelection: "parliament",
  cabinetAccountability: "parliament",
  confidenceMode: "constructive",
  investiture: true,
  parliamentPower: "sovereign",
  partyLegality: .95,
  execConstraints: .85,
  commissionIndep: .85,
  suffrage: .95,
  emergencyPowers: "limited",
  dissolutionPower: "constructive",
  veto: false,
  judicialReview: true,
};

const gpmHistoricalCouncilReform = {
  ceremonial: false,
  vacancyHoS: "council",
  vacancyHoG: "appointment",
  headSelection: "party",
  headGovExists: 1,
  headGovSelection: "appointed",
  cabinetAccountability: "head",
  parliamentPower: "advisory",
  partyLegality: .30,
  execConstraints: .25,
  commissionIndep: .35,
  suffrage: .50,
  emergencyPowers: "broad",
  dissolutionPower: "none",
};

const gpmHistoricalVictoryRegimes = {
  islamic_republic: {
    blueprint: "dominant-party", family: "authoritarian", integrity: .08, concentration: .78, pressFreedom: .24,
    reform: { ...gpmHistoricalCouncilReform, stateStructure: "unitary" },
    ideology: { econ: .05, social: .78, gov: .77, nat: .73 },
  },
  islamic_emirate: {
    blueprint: "theocracy", integrity: .08, concentration: .90, pressFreedom: .15,
    reform: { ...gpmHistoricalCouncilReform, headSelection: "clerical", headGovExists: 0,
      stateStructure: "unitary", partyLegality: .15, execConstraints: .15, judicialReview: false },
    ideology: { econ: -.15, social: .95, gov: .95, nat: .2 },
  },
  military_directorate: {
    blueprint: "military-junta", integrity: .15, concentration: .86, pressFreedom: .25,
    reform: { ...gpmHistoricalCouncilReform, headSelection: "military", headGovExists: 0,
      stateStructure: "unitary", partyLegality: .35, execConstraints: .2 },
    ideology: { econ: .1, social: .45, gov: .9, nat: .7 },
  },
  federal_parliamentary: {
    blueprint: "parliamentary-republic", integrity: 0.95, concentration: 0.27, pressFreedom: 0.9,
    reform: { ...gpmHistoricalParliamentaryReform, stateStructure: "federal", upperChamber: true, bicameralRelation: "symmetric" },
    ideology: { econ: -.13, social: -.35, gov: -.53, nat: .1 },
  },
  parliamentary_republic: {
    blueprint: "parliamentary-republic", integrity: 0.9, concentration: 0.32, pressFreedom: 0.8,
    reform: gpmHistoricalParliamentaryReform,
    ideology: { econ: 0, social: -.2, gov: -.35, nat: .1 },
  },
  presidential_republic: {
    blueprint: "presidential-republic", integrity: 0.88, concentration: 0.43, pressFreedom: 0.76,
    reform: {
      ceremonial: false,
      vacancyHoS: "acting_then_election",
      headSelection: "elected",
      headBallot: "two-round",
      headGovExists: 0,
      cabinetAccountability: "head",
      parliamentPower: "sovereign",
      partyLegality: .80,
      execConstraints: .68,
      commissionIndep: .74,
      suffrage: .90,
      emergencyPowers: "limited",
      dissolutionPower: "none",
      veto: true,
      judicialReview: true,
    },
    ideology: { econ: 0, social: 0, gov: .13, nat: .35 },
  },
  provisional_council: {
    blueprint: "dominant-party", integrity: 0.45, concentration: 0.62, pressFreedom: 0.52,
    reform: { ...gpmHistoricalCouncilReform, partyLegality: .72, execConstraints: .45, commissionIndep: .55, suffrage: .80 },
    ideology: { econ: 0, social: 0, gov: .20, nat: .35 },
  },
  revolutionary_coalition: {
    blueprint: "dominant-party", family: "authoritarian", integrity: .22, concentration: .69, pressFreedom: .35,
    reform: { ...gpmHistoricalCouncilReform, partyLegality: .45, suffrage: .72, stateStructure: "decentralized" },
    ideology: { econ: -.95, social: -.18, gov: .74, nat: .32 },
  },
  regional_council: {
    blueprint: "dominant-party", integrity: 0.5, concentration: 0.6, pressFreedom: 0.52,
    reform: { ...gpmHistoricalCouncilReform, stateStructure: "unitary", partyLegality: .55, execConstraints: .40, commissionIndep: .50 },
    ideology: { econ: 0, social: 0, gov: .26, nat: .60 },
  },
};

function gpmHistoricalVictoryParty(sim, country, actor, outcome, ideology) {
  const existing = country.pol.parties.find(party => party.gpmHistoricalActorId === actor.id);
  if (existing && existing.legal !== false) return existing;
  const assessment = gpmHistoricalCatalog.factionReview.actors[actor.id];
  const previous = Lio(country.pol.parties);
  const change = R1a(country.pol, ideology, .02, (party, parties) => {
    Vda(party, ol(country.key), (country.hash ^ sim.rngSeed0) >>> 0, parties);
    party.nameDesc = {
      ...party.nameDesc,
      gpmName: outcome.partyName || actor.name,
      gpmTag: outcome.partyTag || party.nameDesc?.gpmTag,
      gpmFounded: true,
      gpmHistoricalIdeology: assessment?.historicalLabel || undefined,
      gpmHistoricalIdeologyEquivalent: assessment?.label || undefined,
    };
    party.gpmHistoricalActorId = actor.id;
  });
  qMa(country, change, previous);
  s1a(country, change, previous);
  sim._reconcilePolity(country);
  const party = fS(country, change.id);
  if (!party) throw new Error("Historical victory party was not created: " + actor.id);
  return party;
}

function gpmHistoricalVictoryRegimeDraft(draft, profile) {
  const { constitution, polity } = draft;
  const { regime } = polity;
  constitution.blueprint = profile.blueprint;
  constitution.pressFreedom = profile.pressFreedom;
  constitution._integrity0 = profile.integrity;
  constitution._integBaseline = Object.fromEntries(aIt.map(({ id }) => [id, constitution[id]]));
  Object.assign(regime, structuredClone(vae[profile.blueprint]), { id: profile.blueprint });
  if (profile.family) {
    regime.family = profile.family;
    regime.headOfState.selection = "party";
    regime.headOfGov.selection = "president";
    regime.definingElection = "none";
  }
  regime.electoralIntegrity = hk(constitution);
  regime._concBase = profile.concentration;
  regime.powerConcentration = Math.max(0, Math.min(.98, profile.concentration + II(constitution)));
  regime.termLimited = bae(constitution);
  for (const power of constitution.powers) {
    if (power.power === "confidence" && profile.reform.confidenceMode === "constructive") {
      power.constructive = true;
    }
  }
}

function gpmHistoricalInstallVictoryGovernment(sim, country, actor, outcome) {
  const base = gpmHistoricalVictoryRegimes[outcome?.regime];
  const profile = base && (outcome.reform ? { ...base, reform: { ...base.reform, ...outcome.reform } } : base);
  const chamber = country?.pol?.chambers[0];
  if (!profile || !chamber || !actor?.id || !outcome.title || zPt(outcome.title) !== outcome.title) {
    throw new Error("Invalid historical victory government: " + (actor?.id || country?.key));
  }

  // Preflight the constitutional reform and law IDs before creating a party.
  Bht(country, chamber, profile.reform);
  const changes = Object.entries(outcome.laws || {}).map(([lawId, value]) => {
    if (!ba(lawId)) throw new Error("Unknown historical victory law: " + lawId);
    return { lawId, value };
  });
  const controlledExecutive = sim.playerKey === country.key && sim.playerControlsGovernment();
  const party = gpmHistoricalVictoryParty(sim, country, actor, outcome, profile.ideology);
  // The resulting chambers have transitional appointments. A normal election can replace them.
  gpmUprising.installGovernment(sim, country, party, profile.reform, true,
    draft => gpmHistoricalVictoryRegimeDraft(draft, profile));
  country.pol.archetype = profile.blueprint;
  gpmUprising.applyCharter(sim, country, { changes });
  const appliedLaws = {};
  for (const { lawId, value } of changes) {
    if (Jr(country.laws[lawId], value)) appliedLaws[lawId] = Ga(country.laws[lawId]);
  }
  country.gpmHistoricalAdministration = outcome.administration || null;
  if (!VPt(sim, country.key, outcome.title)) throw new Error("Invalid historical state name: " + outcome.title);
  if (controlledExecutive && !sim.playerControlsGovernment()) {
    const handoff = sim.switchPlayerControl({ countryKey: country.key, partyId: party.id });
    if (!handoff.ok || !handoff.current.controlsExecutive) {
      throw new Error("Historical victory control handoff failed: " + actor.id);
    }
  }
  return { partyId: party.id, appliedLaws };
}

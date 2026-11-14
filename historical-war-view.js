const gpmDirectWarRoles = new Set(["principal", "cobelligerent"]);
const gpmWarNoticeState = new WeakMap();
const gpmWarNumber = new Intl.NumberFormat("en-US");
const gpmWarPlaceList = new Intl.ListFormat("en");

function gpmHistoricalActorRepresents(sim, actorId, key) {
  const state = sim.gpmHistoricalState;
  const successor = state?.nationalOutcomes?.[key]?.actorId;
  const actor = gpmHistoricalActorById(actorId);
  return actorId === successor || state?.regionalOutcomes?.[actorId]?.polityKey === key ||
    (!successor && gpmHistoricalCountryKinds.has(actor?.kind) && gpmHistoricalCountryMatches(actor.countryKey, key));
}

function gpmPlayerWarRole(sim, definition, row, war, key = sim.playerKey) {
  if (!key) return null;
  if (war) {
    if (Eo(war, key)) return war.participants?.[key]?.role || "principal";
    if (!war.participants?.[key] && war.airShields?.[key]) return "support";
    if (war.participants?.[key]) {
      const hasAid = Array.from(sim.militarySupportPrograms?.values() || []).some(program =>
        program.conflictId === war.id && program.donorKey === key && ["active", "suspended"].includes(program.statusId));
      const access = !hasAid && Array.from(sim.militaryCalls?.values() || []).some(call =>
        call.warId === war.id && call.memberKey === key && call.status === "resolved" && call.response === "access");
      return access ? "access" : war.participants[key].role || null;
    }
  } else if (!row.nativeId && !definition.crimeReport && !definition.strategicOnly &&
      ["active", "ceasefire", "suspended"].includes(row.status) &&
      definition.sides.flat().some(id => gpmHistoricalActorRepresents(sim, id, key))) {
    return "principal";
  }
  return (definition.regions || []).some(region => sim.world.provByKey.get(region.key)?.__countryKey === key) ||
    definition.countryKeys.some(countryKey => gpmHistoricalCountryMatches(countryKey, key)) ? "affected" : null;
}

function gpmDirectWars(sim, key = sim.playerKey) {
  return gpmHistoricalConflictEntries(sim).filter(({ definition, row, war, summaryStatus }) =>
    ["active", "ceasefire", "suspended"].includes(summaryStatus) &&
    gpmDirectWarRoles.has(gpmPlayerWarRole(sim, definition, row, war, key)))
    .map(entry => ({ ...entry, key: entry.war?.id || entry.definition.id }));
}

function gpmLeaveCatalogWar(sim, { definition, row }, countryKey) {
  if (row.nativeId || !["active", "ceasefire"].includes(row.status)) return { ok: false, reason: "war_changed" };
  const departing = definition.sides.flat().filter(actorId => gpmHistoricalActorRepresents(sim, actorId, countryKey));
  if (!departing.length) return { ok: false, reason: "war_changed" };
  row.departedActors = [...new Set([...(row.departedActors || []), ...departing])];
  sim.gpmHistoricalState.departures = true;
  const closed = definition.sides.some(side => side.every(actorId => departing.includes(actorId)));
  row.history.push({ day: sim.day, term: "negotiated-peace", outcome: `${Zr(sim, sim.countries.get(countryKey)) || countryKey} signed a peace agreement` });
  row.pending = null;
  if (closed) {
    row.status = "settled";
    row.settledDay = sim.day;
    row.settlement = "negotiated-peace";
    row.ceasefireUntil = null;
    row.disruption = 0;
    const state = sim.gpmHistoricalState;
    for (const region of Object.values(state.regions)) {
      if (region.fronts?.includes(definition.id)) {
        region.disruption = Math.max(0, ...region.fronts.map(id => state.conflicts[id]?.disruption || 0));
      }
    }
    gpmHistoricalUpdateDisruption(sim, state);
  }
  return { ok: true, closed };
}

function gpmWarGoal(sim, goal, detailed) {
  const countryName = key => Zr(sim, sim.countries.get(key)) || null;
  const target = countryName(goal.selectedTargetActorKey || goal.targetCountryKey);
  const places = (goal.targetProvinceKeys || []).map(key => sim.world.provByKey.get(key)?.__name).filter(Boolean);
  switch (goal.type) {
    case "restore_status_quo": return "Restore prewar borders and control";
    case "defend_ally": return `Defend ${countryName(goal.beneficiaryKey) || "an ally"}`;
    case "territorial": {
      if (!places.length) return "Take territory";
      const shown = detailed ? places : places.slice(0, 3);
      return `Take control of ${shown.join(", ")}${places.length > shown.length ? ` and ${places.length - shown.length} more` : ""}`;
    }
    case "disarmament": return `Disarm ${target || "the opposing side"}`;
    case "status_change": return `Change the political status of ${target || "the disputed territory"}`;
    case "coercion": return `Seek concessions from ${target || "the opposing side"}`;
    default: return null;
  }
}

function gpmScenarioWarGoals(definition, row, status, members, index) {
  const occupation = status === "occupation" || definition.status === "occupation";
  return [...new Set(members.map(actorId => {
    const outcome = gpmHistoricalFactionOutcome(definition, actorId);
    if (outcome?.goal) return outcome.goal;
    if (status === "dormant") return "Keep the dispute from returning to open fighting";
    if (occupation) {
      if (outcome?.withdrawal) return "Secure withdrawal from the reported occupation area";
      return outcome?.title || "Negotiate the status of the reported occupation";
    }
    if (outcome?.scope === "agreement" && outcome.title) return outcome.title;
    if (status === "ceasefire" || status === "suspended") return "Maintain the ceasefire";
    switch (outcome?.title) {
      case "State authority upheld": return "Retain government authority in the conflict area";
      case "Local rival checked": return "Contain the rival group in this area";
      case "Bounded armed victory": return "Improve military control on this front";
    }
    if (outcome?.title) return outcome.title;
    if (definition.territoryClaim && definition.territoryClaim !== "Islamic State") {
      return definition.territoryClaim === "Common Border" ? "Protect positions along the shared border" :
        `Protect or improve control around ${definition.territoryClaim}`;
    }
    const government = gpmHistoricalCountryKinds.has(gpmHistoricalActorById(actorId)?.kind);
    return government ? "Maintain government authority in the conflict area" : "Protect local positions on this front";
  }).filter(Boolean))].concat(members.length ? [] : [
    row.settlement ? "Carry out the settlement" : index === 0 ? "Hold current positions" : "Protect the side’s position on this front",
  ]);
}

function gpmWarContext(sim, definition, row, status) {
  const note = definition.note?.trim();
  const sourceBoilerplate = /^(?:UCDP (?:documents violence|identifies the .*dyad)|Geneva Academy classifies|War WATCH classifies)/i;
  if (note && !sourceBoilerplate.test(note)) {
    const sentence = note.match(/^.*?[.!?](?=\s+[A-Z]|$)/u)?.[0] || note;
    if (sentence.length <= 220) return sentence;
  }
  const claim = definition.territoryClaim;
  if (claim && claim !== "Islamic State") {
    return claim === "Common Border" ? "The dispute concerns the countries’ shared border." : `The dispute concerns ${claim}.`;
  }
  const regions = [...new Set([...(definition.geographicContext || []), ...(definition.regions || [])
    .map(region => region.name || sim.world.provByKey.get(region.key)?.__name).filter(Boolean)])];
  const countries = [...new Set(definition.countryKeys.map(key => Zr(sim, gpmHistoricalCountry(sim, key))).filter(Boolean))];
  const place = gpmWarPlaceList.format((regions.length ? regions : countries).slice(0, 2));
  if (status === "occupation" || row.settlement === "negotiated-withdrawal") {
    return place ? `This report covers military presence in ${place}.` : "This report covers military presence in the disputed area.";
  }
  if (status === "ceasefire") return place ? `A ceasefire pauses fighting connected to ${place}.` : "A ceasefire pauses fighting between these sides.";
  const where = place ? ` in ${place}` : "";
  if (claim === "Islamic State") return `This is a front in the conflict involving Islamic State${where}.`;
  if (definition.kind === "civil") return `This is a front in the struggle over government authority${where}.`;
  if (definition.kind === "insurgency") return `Government forces and an armed opposition group have clashed${where}.`;
  if (definition.kind === "nonstate") return `The scenario records clashes between these groups${where}.`;
  return place ? `This conflict concerns fighting involving ${place}.` : "";
}

function gpmWarRecentChanges(sim, war) {
  const name = key => Zr(sim, sim.countries.get(key)) || null;
  const rows = [];
  for (const entry of war?.log || []) {
    const place = sim.world.provinces[entry.provId]?.__name;
    if (["province_captured", "province_lost", "capital_fell"].includes(entry.kind) && place) {
      rows.push({ day: entry.day, outcome: `${place} was captured` });
    }
    if (entry.kind === "terms_accepted") rows.push({ day: entry.day, outcome: "Peace terms accepted" });
  }
  for (const [key, participant] of Object.entries(war?.participants || {})) {
    if (!(participant.joinedDay > (war.startDay || 0)) || !name(key)) continue;
    const role = gpmPlayerWarRole(sim, {}, {}, war, key);
    const action = gpmDirectWarRoles.has(role) ? "joined the fighting" : role === "access" ? "granted access" : "joined as a supporter";
    rows.push({ day: participant.joinedDay, outcome: `${name(key)} ${action}` });
  }
  for (const entry of war?.gpmDepartureHistory || []) {
    if (name(entry.countryKey)) rows.push({ day: entry.day, outcome: `${name(entry.countryKey)} left the war` });
  }
  for (const agreement of war?.settlement?.agreements || []) {
    if (!Number.isFinite(agreement.startedDay ?? agreement.sinceDay)) continue;
    rows.push({ day: agreement.startedDay ?? agreement.sinceDay, outcome: "Fighting paused under an agreement" });
  }
  return rows;
}

function gpmWarParticipant(sim, war, actorId, key, role) {
  const actor = gpmHistoricalViewActor(sim, actorId);
  const country = key ? sim.countries.get(key) :
    gpmHistoricalCountryKinds.has(actor?.kind) ? gpmHistoricalCountry(sim, actor.countryKey) : null;
  const direct = gpmDirectWarRoles.has(role);
  const formationIds = war?.participants?.[key]?.formationIds || [];
  const forces = formationIds.map(id => sim.formations?.get(id)).filter(unit => unit?.owner === key && unit.type !== "reserve");
  const deployed = forces.length ? Math.round(forces.reduce((total, unit) => total + (unit.manpowerK || 0), 0) * 1000) : null;
  const active = country?.forces?.active;
  const association = actor?.countryFlagAssociation;
  const associatedCountry = association && gpmHistoricalCountry(sim, actor.countryKey);
  const roster = Number.isFinite(active) ? Math.round(active * 1000) : null;
  const estimate = actor?.strength;
  const scope = country ? "National active forces" : "Scenario estimate";
  const countLabel = count => `${gpmWarNumber.format(count)} personnel`;
  let strength = { label: "Unknown", scope: "" };
  if (deployed != null) strength = { label: countLabel(deployed), scope: "Assigned to this war" };
  else if (roster != null) strength = { label: countLabel(roster), scope };
  else if (estimate?.range) strength = { label: estimate.range, scope };
  else if (Number.isFinite(estimate?.gamePersonnel)) strength = { label: countLabel(estimate.gamePersonnel), scope };
  const side = war?.participants?.[key]?.side;
  const bilateralPrincipal = war && key && direct && side && Be(war, side).length === 1 &&
    war.coalitions?.[side]?.principalKey === key;
  const kia = war?.personnelByCountry?.[key]?.kia ?? (bilateralPrincipal ? war.personnel?.[side === "A" ? "p" : "e"]?.kia : null);
  return { id: actorId, countryKey: country?.key || key || null, name: gpmHistoricalShortName(actor) || Zr(sim, country) || key || actorId,
    flagCode: country?.a2 || null, flagUrl: actor?.identity?.flag?.image || null, role, strength,
    ...(associatedCountry?.a2 ? { associatedFlagCode: associatedCountry.a2, associatedFlagLabel: association.label } : {}),
    deaths: Number.isFinite(kia) ? Math.round(kia * 1e6) : null };
}

function gpmWarEntryReason(sim, war, opening = false) {
  if (opening) return "Your country is fighting when the campaign begins.";
  if (!war) return null;
  const key = sim.playerKey;
  const call = Array.from(sim.militaryCalls?.values() || []).find(item => item.memberKey === key && item.response === "join" &&
    (item.warId === war.id || item.resolvedDay === sim.day && item.aggressorKey === war.aggressorKey));
  if (call) return "Your government joined after an ally called for help.";
  const entryActor = { "war.player_attacked": "playerKey", "war.player_declared": "playerKey", "war.player_joined": "playerKey",
    "status.subject_war_joined": "subjectActorKey", "military.voluntary_intervention": "interveningKey" };
  const matchesEntry = ({ type, payload }) => (payload?.warId === war.id || payload?.conflictId === war.id) &&
    payload[entryActor[type]] === key;
  const event = sim.outbox?.findLast(matchesEntry) || sim.journal?.findLast(matchesEntry);
  switch (event?.type) {
    case "war.player_attacked": return "Your country was attacked.";
    case "war.player_declared": return "Your side declared war.";
    case "war.player_joined": return "Your government joined the fighting.";
    case "status.subject_war_joined": return "Your country entered under its defense obligations.";
    case "military.voluntary_intervention": return "Your government intervened in the fighting.";
  }
  if (war.participants?.[key] && !Eo(war, key)) {
    const aid = Array.from(sim.militarySupportPrograms?.values() || []).find(program =>
      program.conflictId === war.id && program.donorKey === key && ["active", "suspended"].includes(program.statusId));
    if (aid) {
      const recipient = Zr(sim, sim.countries.get(aid.recipientKey)) || "the supported side";
      return aid.modeId === "request" ? `Your government accepted an aid request from ${recipient}.` :
        `Your government offered aid to ${recipient}.`;
    }
    const access = Array.from(sim.militaryCalls?.values() || []).some(item =>
      item.warId === war.id && item.memberKey === key && item.status === "resolved" && item.response === "access");
    if (access) return "Your government granted military access after an ally called for help.";
  }
  return null;
}

function gpmWarCard(sim, definition, row, war, status, name = definition.name, detailed = false) {
  const opponents = war && gpmHistoricalNativeOpponents(war);
  const aggressor = war?.participants?.[war.aggressorKey]?.side ||
    war?.gpmDepartureHistory?.findLast(item => item.countryKey === war.aggressorKey)?.side ||
    (war?.aggressorKey && (opponents[0] === war.aggressorKey ? "A" : opponents[1] === war.aggressorKey ? "B" : null));
  const recordedSides = aggressor === "A" || aggressor === "B";
  const hasGovernment = members => members.some(id => gpmHistoricalCountryKinds.has(gpmHistoricalActorById(id)?.kind));
  // Catalog order is a presentation fallback for fronts without a clear modeled defender.
  const defenderIndex = definition.sides.findIndex(members => members.includes(definition.defenderActor));
  const scenarioDefense = defenderIndex >= 0 ? defenderIndex :
    Number(!hasGovernment(definition.sides[0]) && hasGovernment(definition.sides[1]));
  const defense = war ? Number(aggressor !== "B") : scenarioDefense;
  const sides = [defense, 1 - defense].map((sideIndex, index) => {
    const side = sideIndex === 0 ? "A" : "B";
    const members = war ? [...new Set([...gpmHistoricalNativeSideKeys(war, side, opponents[side === "A" ? 0 : 1]),
      ...Object.keys(war.airShields || {}).filter(key => war.airShields[key].side === side)])] : definition.sides[sideIndex];
    const participants = members.map(member => {
      if (!war) return gpmWarParticipant(sim, null, member, null, status === "occupation" ? "affected" : "principal");
      return gpmWarParticipant(sim, war, gpmHistoricalWarActor(sim, definition, row, member), member,
        gpmPlayerWarRole(sim, definition, row, war, member));
    });
    const liveGoals = [...new Set((war?.warGoals?.[side] || []).filter(goal => goal.status === "active" && Eo(war, goal.actorKey))
      .map(goal => gpmWarGoal(sim, goal, detailed)).filter(Boolean))];
    const catalogMembers = war ? participants.map(participant => participant.id) : members;
    return { label: index === 0 ? "DEF" : "ATK",
      goals: liveGoals.length ? liveGoals : gpmScenarioWarGoals(definition, row, status, catalogMembers, index),
      goalBasis: liveGoals.length ? null : "Scenario objectives", participants };
  });
  const context = !definition.simulated && sides.some(side => side.goalBasis) ? gpmWarContext(sim, definition, row, status) : null;
  return { id: definition.id, name, status, sides, context, modeledSides: !recordedSides,
    playerRole: gpmPlayerWarRole(sim, definition, row, war),
    entryReason: gpmWarEntryReason(sim, war), nativeId: war?.id || null };
}

function gpmCheckWarEntry(sim, startup = null) {
  if (!sim?.playerKey) return;
  const fingerprint = [...(sim.conflicts?.values() || [])].filter(war => war.participants?.[sim.playerKey])
    .map(war => `${war.id}:${war.status}:${war.participants[sim.playerKey].role}:${war.participants[sim.playerKey].joinedDay}`).join("|");
  const prior = gpmWarNoticeState.get(sim);
  if (!startup && prior?.countryKey === sim.playerKey && prior.day === sim.day && prior.fingerprint === fingerprint) return;
  const entries = gpmDirectWars(sim);
  const active = new Set(entries.map(({ key }) => key));
  gpmWarNoticeState.set(sim, { countryKey: sim.playerKey, keys: active, day: sim.day, fingerprint });
  if (startup === "load" || (!startup && !prior)) return;
  for (const { definition, row, war, summaryStatus, key } of entries) {
    if (summaryStatus !== "active" || (prior?.countryKey === sim.playerKey && prior.keys.has(key))) continue;
    // A newly controlled government inherits existing belligerency. A new war on the day of a handoff still counts.
    if (prior && prior.countryKey !== sim.playerKey && (war?.startDay ?? row.openedDay) !== sim.day) continue;
    const warCard = gpmWarCard(sim, definition, row, war, summaryStatus, gpmHistoricalTitles(sim, definition).shortTitle);
    warCard.entryReason = gpmWarEntryReason(sim, war, startup === "new") || warCard.entryReason;
    H(sim, "gpm.war_entered", { id: definition.id, warId: war?.id || null, warCard },
      { category: "guerre", severity: "danger", audience: { countryKeys: [sim.playerKey] }, journal: false });
  }
}

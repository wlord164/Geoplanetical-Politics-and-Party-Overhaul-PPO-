const gpmFrontlineColors = ["blue", "amber", "green", "violet", "red", "cyan"];
const gpmFrontlineModes = ["hold", "advance"];
const gpmFrontlineSectorKm = 95;
const gpmFrontlineArrowKm = 90;

function gpmFrontlineArmyRoot(plans, plan) {
  while (plan?.afterId) plan = plans.find(item => item.id === plan.afterId);
  return plan;
}

function gpmFrontlineGenerals(sim, owner) {
  const culture = Js(owner);
  return Array.from({ length: 8 }, (_, index) => {
    const seed = Hu(`${owner}:gpm-frontline-general:${sim.rngSeed0}:${index}`) >>> 0 || 1;
    const g = (seed >>> 5) % 9 === 0 ? "f" : "m";
    const person = UA(culture, g, seed);
    return { id: `gpm-general:${owner}:${index}`, name: person.name, countryKey: owner, g,
      born: 1970 + seed % 13, culture: typeof culture === "string" ? culture : zj(culture, seed), _seed: seed, _station: "militaire" };
  });
}

function gpmFrontlineArmyMetadata(sim, war, owner, army, input) {
  const name = input.name === undefined ? army?.name ?? null : input.name;
  if (name !== null && (typeof name !== "string" || name.length > 80 || /[\u0000-\u001f\u007f]/.test(name))) return { ok: false, reason: "army_name" };
  const slot = input.slot === undefined ? army?.slot ?? null : input.slot;
  if (slot !== null && (!Number.isSafeInteger(slot) || slot < 1)) return { ok: false, reason: "army_slot" };
  if (slot !== null && war.gpmFrontline?.some(plan => !plan.afterId && plan !== army && plan.owner === owner && plan.slot === slot)) return { ok: false, reason: "army_slot" };
  const generalId = input.generalId === undefined ? army?.generalId ?? null : input.generalId;
  if (generalId !== null && !gpmFrontlineGenerals(sim, owner).some(person => person.id === generalId)) return { ok: false, reason: "general" };
  if (generalId !== null && [...sim.conflicts.values()].some(conflict => conflict.status !== "ended" &&
      conflict.gpmFrontline?.some(plan => !plan.afterId && plan !== army && plan.owner === owner && plan.generalId === generalId))) return { ok: false, reason: "general_assigned" };
  return { ok: true, name: name?.trim() || null, slot, generalId };
}

function gpmFrontlineRestore(saved, sim) {
  if (!Array.isArray(saved)) return undefined;
  const plans = [];
  const seen = new Set();
  for (const plan of saved) {
    if (!plan || typeof plan.id !== "string" || seen.has(plan.id) || typeof plan.owner !== "string") continue;
    const line = gpmFrontlineTracePoints(plan.line) || (Array.isArray(plan.line) && !plan.line.length &&
      !plan.afterId && plan.mode === "hold" && !plan.arrow?.length ? [] : null);
    const candidate = gpmFrontlineArrowPoints(plan.arrow);
    const arrow = candidate && (plan.completed || gpmFrontlineLandStroke(sim, null, candidate)) ? candidate : null;
    const formationIds = Array.isArray(plan.formationIds) ? [...new Set(plan.formationIds.filter(id => typeof id === "string"))] : [];
    if (!line || line.length && !formationIds.length || !gpmFrontlineModes.includes(plan.mode)) continue;
    const parent = plans.find(item => item.id === plan.afterId && item.owner === plan.owner);
    if (plan.afterId && (!parent || plans.some(item => item.afterId === parent.id) || !gpmFrontlineSameGroup(parent.formationIds, formationIds))) continue;
    seen.add(plan.id);
    plans.push({ id: plan.id, owner: plan.owner, formationIds, line, arrow: arrow || [],
      objectiveProvinceKey: arrow && typeof plan.objectiveProvinceKey === "string" ? plan.objectiveProvinceKey : null,
      mode: arrow ? plan.mode : "hold", color: gpmFrontlineColors.includes(plan.color) ? plan.color : "blue",
      afterId: parent?.id ?? null, completed: plan.completed === true, holdLine: gpmFrontlineTracePoints(plan.holdLine),
      holdLineUnavailable: plan.holdLineUnavailable === true, resumeRequired: plan.resumeRequired === true,
      routeBlocked: plan.routeBlocked === true || !!candidate && !arrow,
      requestedDay: Number.isSafeInteger(plan.requestedDay) ? plan.requestedDay : null,
      revision: Number.isSafeInteger(plan.revision) ? plan.revision : 0,
      ...(parent ? {} : { name: typeof plan.name === "string" ? plan.name.slice(0, 80).trim() : null,
        generalId: typeof plan.generalId === "string" ? plan.generalId : null,
        slot: Number.isSafeInteger(plan.slot) && plan.slot > 0 ? plan.slot : null }) });
  }
  return plans.length ? plans : undefined;
}

function gpmFrontlineSameGroup(a, b) {
  return a.length === b.length && a.every(id => b.includes(id));
}

function gpmFrontlineWar(sim, war, owner = sim.playerKey) {
  const participant = war?.participants?.[owner];
  return war?.mode === "operational" && war.status !== "ended" && war.campaign?.scope !== z1 &&
    X0(sim, owner) && participant && ["principal", "cobelligerent"].includes(participant.role || "principal");
}

function gpmFrontlineActivePlans(war, owner) {
  const plans = war?.gpmFrontline?.filter(plan => plan.owner === owner && plan.line.length) || [];
  const byId = new Map(plans.map(plan => [plan.id, plan]));
  const followed = new Set(plans.map(plan => plan.afterId));
  return plans.filter(plan => (!plan.afterId || byId.get(plan.afterId)?.completed) && (!plan.completed || !followed.has(plan.id)));
}

function gpmFrontlineOrders(sim, war, formation) {
  if (!formation || formation.owner !== sim.playerKey || !war?.gpmFrontline?.length || !gpmFrontlineWar(sim, war)) return null;
  return gpmFrontlineActivePlans(war, formation.owner).find(plan => plan.formationIds.includes(formation.id)) || null;
}

function gpmFrontlineCell(field, lon, lat) {
  if (!field?.prov) return -1;
  const x = ((lon - field.bbox[0]) % 360 + 360) % 360 / field.bbox[2] * field.gw;
  const y = (lat - field.bbox[1]) / field.bbox[3] * field.gh;
  if (x < 0 || x >= field.gw || y < 0 || y >= field.gh) return -1;
  return Math.floor(y) * field.gw + Math.floor(x);
}

function gpmFrontlineObjectiveState(sim, war, owner, arrow, key) {
  if (!arrow?.length) return { reason: "objective" };
  const endpoint = arrow.at(-1);
  const field = war.field;
  const cell = gpmFrontlineCell(field, ...endpoint);
  const nativeProvince = field?.terrain[cell] ? sim.world.provinces[field.prov[cell]] : null;
  const province = key == null ? nativeProvince || (S2(...endpoint) === "land" ? sim.world.provByKey.get(uf(...endpoint)) : null)
    : sim.world.provByKey.get(key);
  if (!province?.__provKey || (key != null && nativeProvince && province !== nativeProvince)) return { reason: "objective" };
  const side = war.participants[owner]?.side;
  const provinceSide = war.participants[province.__countryKey]?.side;
  const occupierSide = war.participants[province.__occupier]?.side;
  if (!side || !provinceSide || !Do(war, province.__countryKey) || Jma(sim, province.__provKey, war.id)) return { reason: "objective" };
  const controlled = nativeProvince ? field.control[cell] === (side === "A" ? 1 : 0) : (occupierSide || provinceSide) === side;
  if (controlled) return { key: province.__provKey, controlled };
  if (provinceSide !== side && !gpmHistoricalCheckOccupation(sim, war, province)) return { reason: "regional_scope" };
  return { key: province.__provKey, controlled: false };
}

function gpmFrontlineRoute(points, location) {
  let nearest = { distanceKm: Infinity, alongKm: 0 };
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const point = VK(points[i - 1], points[i], location, Infinity);
    if (point && point.distanceKm < nearest.distanceKm) nearest = { distanceKm: point.distanceKm, alongKm: total + point.alongKm };
    total += qi(points[i - 1], points[i]);
  }
  return { ...nearest, total };
}

function gpmFrontlineStations(war) {
  if (war?._commandStations?.length) return war._commandStations;
  const stations = new Map();
  for (const side of ["A", "B"]) {
    for (const slot of Object.values(war?.frontSlots?.[side] || {})) {
      if (!slot?.stationId || !_Q(slot.ll)) continue;
      stations.set(slot.stationId, { id: slot.stationId, lon: slot.ll[0], lat: slot.ll[1] });
    }
  }
  return [...stations.values()];
}

function gpmFrontlinePlanLine(war, line, parent) {
  if (!line) return null;
  if (parent && !parent.completed && parent.arrow.length) {
    const previous = parent.holdLine || parent.line;
    // Future orders may be authored at the current front or near the prior objective.
    if (gpmFrontlineRoute(line, parent.arrow.at(-1)).distanceKm > gpmFrontlineSectorKm &&
        gpmFrontlineRoute(previous, line[0]).distanceKm > gpmFrontlineSectorKm) return null;
    return gpmFrontlineTrace(war, line) || gpmFrontlineTrace(war, previous);
  }
  return gpmFrontlineTrace(war, parent?.holdLine || line);
}

function gpmFrontlineFormationReason(sim, war, owner, formation) {
  if (!formation || formation.owner !== owner || formation.domain !== "land" || formation.type === "reserve" || C2(formation) <= 0) return "formation";
  if (formation.state === "forming") return "forming";
  return RQ(formation, war.id).reason || RP(sim, formation, war) || null;
}

function gpmFrontlinePrepare(sim, country, input, operation) {
  const owner = country?.key;
  const war = sim.conflicts?.get(input.warId);
  if (!gpmFrontlineWar(sim, war, owner)) return { ok: false, reason: "conflict" };
  const plans = war.gpmFrontline || [];
  const record = plans.find(plan => plan.id === input.id && plan.owner === owner);
  if (input.id != null && !record || operation !== "upsert" && !record) return { ok: false, reason: "plan" };
  if (operation === "remove") {
    const wholeArmy = input.wholeArmy === true || input.army === true;
    if (wholeArmy && record.afterId) return { ok: false, reason: "plan" };
    return { ok: true, war, plans, record, wholeArmy };
  }
  if (operation === "army") {
    const army = gpmFrontlineArmyRoot(plans, record);
    const metadata = gpmFrontlineArmyMetadata(sim, war, owner, army, input);
    return metadata.ok ? { ok: true, war, plans, record, army, metadata } : metadata;
  }
  if (war.status !== "active" && input.mode === "advance") return { ok: false, reason: "ceasefire" };
  if (!gpmFrontlineModes.includes(input.mode)) return { ok: false, reason: "mode" };
  if (operation === "mode") {
    if (!record.line.length) return { ok: false, reason: "front" };
    if (record.completed || !gpmFrontlineActivePlans(war, owner).includes(record)) return { ok: false, reason: "queued" };
    if (input.mode === "advance") {
      if (record.routeBlocked) return { ok: false, reason: "no_land_route" };
      const objective = gpmFrontlineObjectiveState(sim, war, owner, record.arrow, record.objectiveProvinceKey);
      if (objective.reason || objective.controlled) return { ok: false, reason: objective.reason || "objective_held" };
    }
    return { ok: true, war, plans, record };
  }

  if (record?.completed) return { ok: false, reason: "objective_held" };
  const formationIds = Array.isArray(input.formationIds) ? [...new Set(input.formationIds)] : [];
  if (formationIds.some(id => typeof id !== "string")) return { ok: false, reason: "formation" };
  for (const id of formationIds) {
    const reason = gpmFrontlineFormationReason(sim, war, owner, sim.formations?.get(id));
    if (reason) return { ok: false, reason };
  }
  const parentId = input.afterId ?? record?.afterId ?? null;
  const parent = plans.find(plan => plan.id === parentId && plan.owner === owner);
  if (parentId && (!parent || parent === record || !gpmFrontlineSameGroup(parent.formationIds, formationIds) ||
      plans.some(plan => plan !== record && plan.afterId === parentId) || record && parentId !== record.afterId)) return { ok: false, reason: "queue" };
  const successor = plans.some(plan => plan.afterId === record?.id);
  if (successor && !gpmFrontlineSameGroup(record.formationIds, formationIds)) return { ok: false, reason: "queue" };
  const sameChain = candidate => (parent || record?.afterId || successor) && gpmFrontlineSameGroup(candidate.formationIds, formationIds);
  for (const conflict of sim.conflicts.values()) {
    if (conflict.status === "ended") continue;
    if (conflict.gpmFrontline?.some(plan => plan.owner === owner && plan !== record && plan.formationIds.some(id => formationIds.includes(id)) &&
        !(conflict === war && sameChain(plan)))) return { ok: false, reason: "formation_overlap" };
  }
  const dormant = input.contactId == null && Array.isArray(input.line) && !input.line.length && input.mode === "hold" && !input.arrow?.length && !parent && !successor;
  if (parent && !parent.completed && !parent.arrow.length) return { ok: false, reason: "queue_front" };
  const selected = dormant ? { ok: true, line: [] } : gpmFrontlineLineRequest(war, input, parent);
  if (!selected.ok) return selected;
  const { line } = selected;
  if (!formationIds.length && !dormant) return { ok: false, reason: "formation" };
  const objective = input.arrow?.length ? gpmFrontlineCanonicalArrow(sim, war, owner, input.arrow, line, input.objectiveProvinceKey) : null;
  if (objective && !objective.ok) return objective;
  if (objective && gpmFrontlineRoute(line, objective.arrow[0]).distanceKm > gpmFrontlineSectorKm) return { ok: false, reason: "arrow_start" };
  if (!objective && input.mode === "advance") return { ok: false, reason: "objective" };
  const color = input.color ?? record?.color ?? gpmFrontlineColors[plans.filter(plan => !plan.afterId).length % gpmFrontlineColors.length];
  if (!gpmFrontlineColors.includes(color)) return { ok: false, reason: "color" };
  const metadata = parent ? { ok: true } : gpmFrontlineArmyMetadata(sim, war, owner, record, input);
  if (!metadata.ok) return metadata;
  const id = record?.id ?? `frontline:${owner}:${Math.max(0, ...plans.map(plan => Number(plan.id.split(":").at(-1)) || 0)) + 1}`;
  return { ok: true, war, plans, record, plan: { id, owner, formationIds, line, arrow: objective?.arrow || [], color,
    mode: input.mode, afterId: parentId, objectiveProvinceKey: objective?.objectiveProvinceKey ?? null,
    completed: false, holdLine: null, resumeRequired: parent?.holdLineUnavailable === true,
    requestedDay: dormant ? null : sim.day ?? 0, revision: (record?.revision || 0) + 1,
    ...(parent ? {} : { name: metadata.name, slot: metadata.slot, generalId: metadata.generalId }) } };
}

function gpmFrontlineFreezeLine(sim, war, plan) {
  const side = war.participants[plan.owner]?.side;
  const slots = war.frontSlots?.[side];
  const positions = plan.formationIds.map(id => slots?.[id]?.ll).filter(_Q);
  plan.holdLine = gpmFrontlineTrackedLine(war, plan, positions) || plan.holdLine;
}

function gpmFrontlineClearOrders(sim, plan) {
  for (const id of plan.formationIds) {
    const formation = sim.formations?.get(id);
    if (!formation || formation.owner !== plan.owner) continue;
    if (formation.order?.reason === "gpm_frontline") formation.order = null;
    formation._sectorIntent = null;
    formation._frontNodeRoute = null;
  }
}

function gpmFrontlineClose(sim, war) {
  if (war.gpmFrontline?.length) for (const plan of war.gpmFrontline) gpmFrontlineClearOrders(sim, plan);
  delete war.gpmFrontline;
}

function gpmFrontlineSuspend(sim, war) {
  for (const plan of war.gpmFrontline || []) {
    if (plan.completed || plan.mode !== "advance") continue;
    gpmFrontlineFreezeLine(sim, war, plan);
    plan.resumeRequired = true;
    gpmFrontlineClearOrders(sim, plan);
  }
}

function gpmFrontlineChange(sim, country, input, operation) {
  const prepared = gpmFrontlinePrepare(sim, country, input, operation);
  if (!prepared.ok) return prepared;
  const { war, plans, record, plan, army, metadata, wholeArmy } = prepared;
  if (operation === "army") {
    Object.assign(army, { name: metadata.name, slot: metadata.slot, generalId: metadata.generalId });
    return { ok: true, changed: true, id: army.id };
  }
  const wasActive = record && gpmFrontlineActivePlans(war, record.owner).includes(record);
  if (operation === "remove") {
    if (wholeArmy) {
      const root = gpmFrontlineArmyRoot(plans, record);
      const removed = new Set(plans.filter(item => gpmFrontlineArmyRoot(plans, item) === root));
      for (const active of gpmFrontlineActivePlans(war, record.owner)) {
        if (removed.has(active)) gpmFrontlineClearOrders(sim, active);
      }
      war.gpmFrontline = plans.filter(item => !removed.has(item));
    } else {
      const successor = plans.find(item => item.afterId === record.id);
      if (successor) {
        successor.afterId = record.afterId;
        if (!record.afterId) Object.assign(successor, { name: record.name, slot: record.slot, generalId: record.generalId });
      }
      war.gpmFrontline = plans.filter(item => item !== record);
    }
  } else if (operation === "mode") {
    if (input.mode === "hold" && record.mode !== "hold") gpmFrontlineFreezeLine(sim, war, record);
    record.mode = input.mode;
    record.resumeRequired = false;
    record.requestedDay = sim.day ?? 0;
    record.revision = (record.revision || 0) + 1;
  } else {
    war.gpmFrontline = record ? plans.map(item => item === record ? plan : item) : [...plans, plan];
  }
  if (wasActive && !wholeArmy) gpmFrontlineClearOrders(sim, record);
  if (operation === "mode" && record.mode === "hold") {
    for (const id of record.formationIds) {
      const formation = sim.formations.get(id);
      if (formation?.owner === record.owner && formation.assignment?.conflictId === war.id && formation._stance === "attack") formation._stance = "hold";
    }
  }
  return { ok: true, changed: true, id: plan?.id || record.id };
}

function registerFrontlinePlans() {
  for (const operation of ["upsert", "mode", "remove", "army"]) Bt(`gpm.frontline.${operation}`, {
    competencyDomains: ["defense"],
    validate: (sim, country, input) => {
      const result = gpmFrontlinePrepare(sim, country, input, operation);
      return result.ok ? true : result;
    },
    apply: (sim, country, input) => gpmFrontlineChange(sim, country, input, operation),
  });
}

function gpmFrontlinePlanState(sim, war, plan) {
  if (plan.completed) return "completed";
  if (!plan.line.length) return "unassigned";
  if (!gpmFrontlineActivePlans(war, plan.owner).includes(plan)) return "queued";
  if (plan.routeBlocked) return "blocked";
  if (war.status !== "active" || plan.resumeRequired) return "paused";
  const units = plan.formationIds.map(id => sim.formations?.get(id)).filter(unit => unit?.owner === plan.owner);
  if (!units.length) return "blocked";
  if (plan.mode === "advance") {
    const target = gpmFrontlineObjectiveState(sim, war, plan.owner, plan.arrow, plan.objectiveProvinceKey);
    if (target.reason) return "blocked";
  }
  const deployed = units.filter(unit => unit.location?.type === "front" && unit.assignment?.conflictId === war.id);
  if (!deployed.length) return "assembling";
  if (plan.mode === "advance" && !deployed.some(unit => unit._stance === "attack")) {
    return deployed.some(unit => unit._stance === "resupply" || (unit.supply?.ammoDays ?? 0) < 3) ? "resupplying" : "assembling";
  }
  if (plan.mode === "hold" && deployed.some(unit => unit._stance === "resupply")) return "resupplying";
  return plan.mode === "advance" ? "advancing" : "holding";
}

function gpmFrontlineView(sim, input) {
  const owner = sim.playerKey;
  const eligibleWars = [...sim.conflicts?.values?.() || []].filter(war => gpmFrontlineWar(sim, war, owner));
  const wars = eligibleWars.map(war => ({ id: war.id, name: war.enemyName || war.id, enemyKey: war.enemyKey,
    side: war.participants[owner].side, status: war.status }));
  const war = eligibleWars.find(item => item.id === input.warId) || eligibleWars[0];
  if (!war) return { wars, warId: null, day: sim.day ?? 0, formations: [], stations: [], contacts: [], plans: [], generals: [] };
  const plans = (war.gpmFrontline || []).filter(plan => plan.owner === owner);
  const active = gpmFrontlineActivePlans(war, owner);
  const side = war.participants[owner].side;
  const formations = je(sim, sim.countries.get(owner)).filter(unit => unit.domain === "land" && unit.type !== "reserve").map(unit => {
    const assigned = active.find(plan => plan.formationIds.includes(unit.id)) ||
      plans.find(plan => !plan.line.length && plan.formationIds.includes(unit.id));
    const reason = gpmFrontlineFormationReason(sim, war, owner, unit);
    return { id: unit.id, name: unit.name || `${unit.type} ${unit.ord ?? ""}`.trim(), position: Ce(sim, unit) || null,
      org: unit.org ?? Math.round(vu(unit) * 100), ammoDays: unit.supply?.ammoDays ?? null, planId: assigned?.id ?? null,
      armyId: assigned ? gpmFrontlineArmyRoot(plans, assigned)?.id ?? null : null,
      posture: unit._stance || unit.order?.kind || null, eligible: !reason, reason,
      ...gpmFrontlineTelemetry(sim, war, unit, assigned, reason) };
  });
  return { wars, warId: war.id, side, status: war.status, day: sim.day ?? 0, formations, generals: gpmFrontlineGenerals(sim, owner),
    contacts: gpmFrontlineContactChains(war).map(chain => ({ id: chain.id, line: chain.points, closed: chain.closed })),
    stations: gpmFrontlineStations(war).map(station => ({ id: station.id, position: [station.lon, station.lat] })),
    plans: plans.map(plan => {
      const { owner: countryKey, ...summary } = plan;
      const army = gpmFrontlineArmyRoot(plans, plan);
      const slots = war.frontSlots?.[side];
      const positions = active.includes(plan) ? plan.formationIds.map(id => slots?.[id]?.ll).filter(_Q) : [];
      const tracked = (Object.is(war._gpmFrontlineLiveLineGeneration, war.field?._gen) && war._gpmFrontlineLiveLines?.get(plan.id)) ||
        gpmFrontlineTrackedLine(war, plan, positions);
      return { ...summary, armyId: army.id, name: army.name, slot: army.slot, generalId: army.generalId,
        arrow: plan.completed ? [] : plan.arrow, status: gpmFrontlinePlanState(sim, war, plan),
        liveLine: tracked || [],
        reason: plan.routeBlocked ? "no_land_route" : plan.line.length && !tracked?.length ? "no_connected_front" : null };
    }) };
}

function gpmFrontlineReserveForces(sim, requests, formations) {
  const reserved = new Set();
  if (!formations.length || formations[0].owner !== sim.playerKey) return reserved;
  const available = new Set(formations.map(formation => formation.id));
  for (const request of requests) {
    if (!gpmFrontlineWar(sim, request.war) || request.war.status !== "active") continue;
    for (const plan of gpmFrontlineActivePlans(request.war, sim.playerKey)) {
      for (const id of plan.formationIds) {
        if (!available.has(id) || reserved.has(id)) continue;
        const unit = sim.formations.get(id);
        if (gpmFrontlineFormationReason(sim, request.war, plan.owner, unit)) continue;
        request.ids.push(id);
        reserved.add(id);
      }
    }
  }
  return reserved;
}

function gpmFrontlineRank(plan, stations) {
  const defensive = plan.holdLine || plan.line;
  return stations.map((station, index) => {
    const location = [station.lon, station.lat];
    const distance = gpmFrontlineRoute(defensive, location).distanceKm;
    if (plan.mode === "advance" && !plan.completed && !plan.resumeRequired && plan.arrow.length) {
      const route = gpmFrontlineRoute(plan.arrow, location);
      if (route.distanceKm <= gpmFrontlineArrowKm) return { station, index, score: route.distanceKm - route.alongKm * .6 };
    }
    return distance <= gpmFrontlineSectorKm ? { station, index, score: 100 + distance } : null;
  }).filter(Boolean).sort((a, b) => a.score - b.score || a.index - b.index);
}

function gpmFrontlineDestination(sim, formation, enemy) {
  if (formation?.owner !== sim.playerKey) return null;
  const war = Tya(sim, formation) || sim.wars?.get(enemy);
  const plan = gpmFrontlineOrders(sim, war, formation);
  if (!plan || war.status !== "active") return null;
  const side = war.participants[plan.owner].side;
  const ranked = gpmFrontlineRank(plan, gpmFrontlineStations(war));
  for (const { station } of ranked) {
    const point = [station.lon, station.lat];
    const contact = nHa(sim, war, side, point);
    const key = contact && Wg(contact.nodeId);
    if (!key || qi(point, [contact.lon, contact.lat]) > 90) continue;
    return { assignmentPatch: { warKey: enemy, sectorProvKey: key, gpmFrontlinePlanId: plan.id,
      gpmFrontlineReceivedDay: sim.day ?? 0, gpmFrontlineRevision: plan.revision || 0 }, goalProvId: Dp(sim, key),
      destLL: [contact.lon, contact.lat], dest: { type: "front", warKey: enemy, provKey: key } };
  }
  return { goalProvId: -1, destLL: null, dest: { type: "front", warKey: enemy, provKey: null } };
}

function gpmFrontlineCompleted(sim, war) {
  if (!war?.field || !war.gpmFrontline?.length || war.status !== "active" || !gpmFrontlineWar(sim, war)) return [];
  return gpmFrontlineActivePlans(war, sim.playerKey).filter(plan => !plan.completed && !plan.resumeRequired && plan.mode === "advance" &&
    gpmFrontlineObjectiveState(sim, war, plan.owner, plan.arrow, plan.objectiveProvinceKey).controlled);
}

function gpmFrontlineHeldContour(sim, war, plan, endpoint) {
  const side = war.participants[plan.owner].side;
  const origins = plan.formationIds.map(id => sim.formations.get(id))
    .filter(unit => unit?.owner === plan.owner && unit.assignment?.conflictId === war.id && unit.location?.type === "front")
    .map(unit => Ce(sim, unit)).filter(_Q);
  if (!origins.length) return null;
  const reachable = point => origins.some(origin => {
    const contact = iHa(sim, war, side, origin, point);
    return contact && qi(point, [contact.lon, contact.lat]) <= 30;
  });
  return gpmFrontlineTraceWindow(war, endpoint, gpmFrontlineTraceWidth(plan.line), reachable);
}

function gpmFrontlineTrackedLine(war, plan, positions = []) {
  if (!plan.line.length || plan.holdLineUnavailable) return null;
  const line = plan.holdLine || plan.line;
  if (positions.length && plan.mode === "advance" && plan.arrow.length) {
    const staged = positions.map(point => ({ point, progress: gpmFrontlineRoute(plan.arrow, point).alongKm }))
      .sort((a, b) => a.progress - b.progress);
    const active = staged[Math.floor(staged.length / 2)].point;
    const live = gpmFrontlineTraceWindow(war, active, gpmFrontlineTraceWidth(line));
    if (live) return live;
  }
  return gpmFrontlineTrace(war, line);
}

function gpmFrontlineReanchorSuccessor(sim, war, previous, successor) {
  if (!previous.holdLine || previous.holdLineUnavailable) return;
  successor.line = previous.holdLine.map(point => point.slice());
  if (!successor.arrow.length) return;
  const adjusted = gpmFrontlineCanonicalArrow(sim, war, successor.owner, successor.arrow, successor.line, successor.objectiveProvinceKey);
  if (adjusted.ok) {
    successor.arrow = adjusted.arrow;
    successor.objectiveProvinceKey = adjusted.objectiveProvinceKey;
    return;
  }
  successor.arrow = [];
  successor.objectiveProvinceKey = null;
  successor.mode = "hold";
  successor.routeBlocked = true;
}

function gpmFrontlineComplete(sim, war) {
  for (const plan of gpmFrontlineCompleted(sim, war)) {
    const line = gpmFrontlineHeldContour(sim, war, plan, plan.arrow.at(-1));
    if (line) plan.holdLine = line;
    else gpmFrontlineFreezeLine(sim, war, plan);
    plan.completed = true;
    plan.mode = "hold";
    plan.holdLineUnavailable = !line;
    war._gpmFrontlineLiveLines?.delete(plan.id);
    gpmFrontlineClearOrders(sim, plan);
    const successor = war.gpmFrontline.find(item => item.afterId === plan.id);
    if (successor) {
      if (line) gpmFrontlineReanchorSuccessor(sim, war, plan, successor);
      else successor.resumeRequired = true;
    }
  }
}

function gpmFrontlineSlots(sim, war, side, units, stations, defaultSlots, staffOwner) {
  if (!war.gpmFrontline?.length || war.participants?.[sim.playerKey]?.side !== side || !gpmFrontlineWar(sim, war)) return defaultSlots;
  gpmFrontlineComplete(sim, war);
  const active = gpmFrontlineActivePlans(war, sim.playerKey);
  const targetIds = new Set(active.flatMap(plan => plan.formationIds));
  const available = new Set(stations.map(station => station.id));
  const plannedSlots = {};
  war._gpmFrontlineLiveLines = new Map();
  war._gpmFrontlineLiveLineGeneration = war.field?._gen;
  for (const plan of active) {
    const group = units.filter(unit => unit.owner === plan.owner && plan.formationIds.includes(unit.id));
    let ranked = gpmFrontlineRank(plan, stations).filter(({ station }) => available.has(station.id));
    if (plan.mode === "hold" && ranked.length > group.length) {
      const line = plan.holdLine || plan.line;
      ranked = ranked.map(entry => ({ ...entry, along: gpmFrontlineRoute(line, [entry.station.lon, entry.station.lat]).alongKm }))
        .sort((a, b) => a.along - b.along || a.score - b.score);
      const spread = new Set(Y8o(ranked.map(entry => entry.station), group.length).map(station => station.id));
      ranked = ranked.filter(entry => spread.has(entry.station.id));
    }
    const remaining = ranked.slice(0, group.length);
    for (const formation of group) {
      if (!remaining.length) break;
      const current = defaultSlots?.[formation.id]?.ll || Ce(sim, formation) || plan.line[0];
      remaining.sort((a, b) => qi(current, [a.station.lon, a.station.lat]) - qi(current, [b.station.lon, b.station.lat]));
      const { station, index } = remaining.shift();
      const point = [station.lon, station.lat];
      if (defaultSlots?.[formation.id]?.stationId !== station.id) formation._frontNodeRoute = null;
      available.delete(station.id);
      plannedSlots[formation.id] = { u: (index + .5) / stations.length, ll: point, stationId: station.id };
    }
    if (plan.holdLineUnavailable && group.length && plan.arrow.length) {
      const restored = gpmFrontlineHeldContour(sim, war, plan, plan.arrow.at(-1));
      if (restored) {
        plan.holdLine = restored;
        plan.holdLineUnavailable = false;
      }
    }
    const positions = group.map(unit => plannedSlots[unit.id]?.ll).filter(_Q);
    const tracked = gpmFrontlineTrackedLine(war, plan, positions);
    war._gpmFrontlineLiveLines.set(plan.id, tracked || []);
  }
  const ordinary = units.filter(unit => !(unit.owner === sim.playerKey && targetIds.has(unit.id)));
  for (const unit of ordinary) {
    const slot = defaultSlots?.[unit.id];
    if (slot && available.delete(slot.stationId)) plannedSlots[unit.id] = slot;
  }
  const remainingUnits = ordinary.filter(unit => !plannedSlots[unit.id]);
  if (available.size && remainingUnits.length) {
    const objective = sim.world.provByKey.get(oU(sim, war, staffOwner))?.__centroid || null;
    const remainder = V8o(sim, war, side, remainingUnits, stations.filter(station => available.has(station.id)), objective);
    Object.assign(plannedSlots, remainder);
  }
  war.frontSlots[side] = plannedSlots;
  return plannedSlots;
}

function gpmFrontlineOrderKind(sim, war, formation, fallback) {
  const plan = gpmFrontlineOrders(sim, war, formation);
  if (!plan) return fallback;
  const side = war.participants[plan.owner].side;
  if (plan.mode !== "advance" || plan.completed || plan.resumeRequired || war.status !== "active" ||
      formation.assignment?.conflictId !== war.id || formation.location?.type !== "front" || !war.frontSlots?.[side]?.[formation.id] ||
      Ck(formation) <= .3 || (formation.supply?.ammoDays ?? 0) < 3) return "hold";
  const objective = gpmFrontlineObjectiveState(sim, war, plan.owner, plan.arrow, plan.objectiveProvinceKey);
  return objective.reason || objective.controlled ? "hold" : "attack";
}

function gpmFrontlineCombatStance(sim, war, formation, fallback, resupply) {
  const stance = gHa(formation, fallback, sim.day || 0, resupply);
  if (!gpmFrontlineOrders(sim, war, formation) || !["attack", "hold"].includes(stance)) return stance;
  return stance === "attack" && gpmFrontlineOrderKind(sim, war, formation, "hold") === "hold" ? "hold" : stance;
}

function gpmFrontlineProjectsPressure(sim, war, formation) {
  if (formation._stance !== "attack" && formation._stance !== "encircled") return false;
  const plan = gpmFrontlineOrders(sim, war, formation);
  return !plan || gpmFrontlineOrderKind(sim, war, formation, "hold") === "attack";
}

function gpmFrontlinePressureFilter(sim, war) {
  if (!war.gpmFrontline?.length) return null;
  const routes = new Map();
  for (const plan of gpmFrontlineActivePlans(war, sim.playerKey)) {
    if (plan.mode !== "advance" || plan.completed || plan.resumeRequired || !plan.arrow.length) continue;
    for (const id of plan.formationIds) routes.set(id, plan);
  }
  if (!routes.size) return null;
  const allowed = new Map();
  const provinceAllowed = new Map();
  for (const attack of [...war._causalLocal.pAttack, ...war._causalLocal.eAttack]) {
    const plan = routes.get(attack.fid);
    if (!plan) continue;
    const route = gpmFrontlineRoute(plan.arrow, [attack.lon, attack.lat]);
    allowed.set(attack.fid, { plan, route });
  }
  return (attack, lon, lat) => {
    const entry = allowed.get(attack.fid);
    if (!entry) return true;
    const { plan, route } = entry;
    const cell = gpmFrontlineCell(war.field, lon, lat);
    const province = war.field.terrain[cell] ? sim.world.provinces[war.field.prov[cell]] : null;
    if (!province) return false;
    const side = war.participants[plan.owner].side;
    const provinceSide = war.participants[province.__countryKey]?.side;
    if (!provinceSide) return false;
    if (provinceSide !== side) {
      if (!provinceAllowed.has(province.__provKey)) provinceAllowed.set(province.__provKey,
        gpmHistoricalCheckOccupation(sim, war, province) && !Jma(sim, province.__provKey, war.id));
      if (!provinceAllowed.get(province.__provKey)) return false;
    }
    const target = gpmFrontlineRoute(plan.arrow, [lon, lat]);
    return target.distanceKm <= gpmFrontlineArrowKm && target.alongKm >= route.alongKm - 15 &&
      (target.alongKm < target.total - 1 || qi(plan.arrow.at(-1), [lon, lat]) <= 14);
  };
}

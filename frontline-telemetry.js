function gpmFrontlineRecordCombat(sim, war, attacker, target) {
  const owner = sim.playerKey;
  if (!war.participants?.[owner] || attacker.owner !== owner && target.owner !== owner) return;
  const day = sim.day ?? 0;
  if (war._gpmFrontlineCombat?.day !== day) war._gpmFrontlineCombat = { day, formations: new Set() };
  war._gpmFrontlineCombat.formations.add(attacker.id);
  war._gpmFrontlineCombat.formations.add(target.id);
}

function gpmFrontlineRecordRoute(sim, war, formation, blocked) {
  if (formation.owner !== sim.playerKey || !war.participants?.[sim.playerKey]) return;
  formation._gpmFrontlineMovementFailure = blocked ? { conflictId: war.id, day: sim.day ?? 0 } : null;
}

function gpmFrontlineFormationDestination(sim, formation, slot) {
  const location = formation.location;
  if (location?.type === "moving") {
    const last = location.wp?.at(-1);
    return { kind: location.dest?.type || "transfer", position: $Z(last) ? last : null,
      provinceKey: location.dest?.provKey ?? null, stationId: null,
      progress: Number.isFinite(location.totalKm) && Number.isFinite(location.kmpd) ? Ufa(sim, location) : null };
  }
  if (!slot || !$Z(slot.ll)) return null;
  const route = formation._frontNodeRoute;
  const point = formation._frontSlotLL || slot.ll;
  return { kind: "front", position: point, provinceKey: formation.assignment?.sectorProvKey ?? null,
    stationId: slot.stationId ?? null, progress: route?.total > 0 ? Math.min(1, Math.max(0, route.traveled / route.total)) : null };
}

function gpmFrontlineUnitStatus(war, unit, plan, seen) {
  const selected = !!plan?.line.length;
  const { reason, assignment, destination, fighting, pressuring, slot, failed } = seen;
  const state = (status, reason = null) => ({ status, reason });
  if (selected && (war.status !== "active" || plan.resumeRequired)) return state("paused", war.status !== "active" ? "ceasefire" : "resume_required");
  if (selected && plan.routeBlocked) return state("blocked", "no_land_route");
  if (selected && reason) return state("blocked", reason);
  if (failed && (!assignment || assignment.conflictId === war.id)) return state("blocked", failed);
  if (unit._stance === "resupply") return state("resupplying", "ammunition");
  if (unit._stance === "withdraw" || assignment?.role === "recovering") return state("regrouping", "cohesion");
  if (fighting) return state("fighting");
  if (unit.location?.type === "moving" || unit._frontMoving && destination) return state("moving");
  if (pressuring) return state("advancing");
  if (!selected) {
    if (assignment) return state("staff", assignment.conflictId === war.id ? "general_staff" : "assigned-other-conflict");
    if (reason) return state("blocked", reason);
    return state(plan ? "unassigned" : "available");
  }
  if (!assignment || assignment.conflictId !== war.id) return state("waiting", "staff_dispatch");
  if (unit.location?.type !== "front") return state("waiting", "deployment");
  if (!slot) return state("waiting", "no_slot");
  if (plan.mode === "advance" && (unit.supply?.ammoDays ?? 0) < 3) return state("blocked", "low_ammunition");
  if (plan.mode === "advance" && sk(unit) <= .3) return state("blocked", "low_readiness");
  if (unit._frontAtSlot === true) return state(plan.mode === "hold" ? "holding" : "ready");
  return state("waiting", "awaiting_position");
}

function gpmFrontlineTelemetry(sim, war, unit, plan, reason) {
  const day = sim.day ?? 0;
  const nativeAssignment = unit.assignment;
  const assignedWar = nativeAssignment?.conflictId ? sim.conflicts.get(nativeAssignment.conflictId) : null;
  const assignment = nativeAssignment?.conflictId ? { conflictId: nativeAssignment.conflictId,
    warName: assignedWar?.enemyName || assignedWar?.id || nativeAssignment.conflictId,
    role: nativeAssignment.role ?? null, sectorProvinceKey: nativeAssignment.sectorProvKey ?? null } : null;
  const observer = assignedWar || war;
  const side = observer.participants?.[unit.owner]?.side;
  const slot = assignment && side ? observer.frontSlots?.[side]?.[unit.id] : null;
  const destination = gpmFrontlineFormationDestination(sim, unit, slot);
  const native = unit.order;
  const nativeOrder = native ? { kind: native.kind ?? null, reason: native.reason ?? null, issuer: native.issuer ?? null,
    issuedDay: native.issuedDay ?? null, targetStationId: native.targetStationId ?? null } : null;
  const requestedDay = plan?.requestedDay ?? null;
  const acknowledged = plan?.line.length && !plan.resumeRequired && assignment?.conflictId === war.id &&
    native?.reason === "gpm_frontline" && (native.issuedDay ?? -1) >= (requestedDay ?? -1);
  const dispatched = plan?.line.length && unit.location?.type === "moving" && nativeAssignment?.gpmFrontlinePlanId === plan.id &&
    (nativeAssignment.gpmFrontlineRevision ?? 0) === (plan.revision ?? 0) &&
    (nativeAssignment.gpmFrontlineReceivedDay ?? -1) >= (requestedDay ?? -1);
  const issuedDay = acknowledged ? native.issuedDay : dispatched ? nativeAssignment.gpmFrontlineReceivedDay : null;
  const observedCombat = observer._gpmFrontlineCombat;
  const pressure = observer._causalLocal;
  const fighting = !!(observer.status === "active" && observedCombat?.day >= day - 1 && observedCombat.formations.has(unit.id));
  const pressuring = !!(observer.status === "active" && pressure?.day >= day - 1 &&
    (!plan?.line.length || plan.mode === "advance" && !plan.resumeRequired) &&
    (side === "A" ? pressure.pAttack : pressure.eAttack)?.some(formation => formation.fid === unit.id));
  const strategicFailure = unit._deployRouteFailure?.conflictId === war.id &&
    (requestedDay == null || unit._deployRouteFailure.day == null || unit._deployRouteFailure.day >= requestedDay) ? unit._deployRouteFailure : null;
  const tacticalFailure = unit._gpmFrontlineMovementFailure;
  const failed = strategicFailure?.reason || (strategicFailure || tacticalFailure?.conflictId === war.id && tacticalFailure.day >= day - 1 ? "no_route" : null);
  const state = gpmFrontlineUnitStatus(war, unit, plan, { reason, assignment, destination, fighting, pressuring, slot, failed });
  return { assignment, nativeOrder, destination, execution: { ...state, received: !!(acknowledged || dispatched),
    requestedDay, issuedDay, fighting, pressuring, control: plan?.line.length ? "player" : "staff" } };
}

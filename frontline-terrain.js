const gpmFrontlineArrowPointLimit = 2048;
const gpmFrontlineCoastSnapKm = 95;

function gpmFrontlineArrowPoints(input) {
  if (!Array.isArray(input) || input.length < 2 || input.length > gpmFrontlineArrowPointLimit || !input.every(eoe)) return null;
  return input.some(point => Zn(input[0], point) > 1) ? input.map(point => point.slice()) : null;
}

function gpmFrontlineMidpoint(line) {
  const segments = line.slice(1).map((point, index) => Zn(line[index], point));
  let remaining = segments.reduce((sum, distance) => sum + distance, 0) / 2;
  for (let index = 0; index < segments.length; index++) {
    const distance = segments[index];
    if (distance > 0 && remaining <= distance) return ik(line[index], line[index + 1], remaining / distance);
    remaining -= distance;
  }
  return line.at(-1).slice();
}

function gpmFrontlineLandPoint(sim, field, point) {
  if (field && !field.terrain[gpmFrontlineCell(field, ...point)]) return false;
  return !!t8(sim, ...point);
}

function gpmFrontlineLandSegment(sim, field, a, b) {
  const samples = Math.max(1, Math.ceil(Zn(a, b) / 1.5));
  for (let index = 1; index < samples; index++) {
    if (!gpmFrontlineLandPoint(sim, field, ik(a, b, index / samples))) return false;
  }
  return true;
}

function gpmFrontlineLandStroke(sim, field, points) {
  return points.every((point, index) => gpmFrontlineLandPoint(sim, field, point) &&
    (index === 0 || gpmFrontlineLandSegment(sim, field, points[index - 1], point)));
}

function gpmFrontlineTerrain(sim, war, owner) {
  const { field } = war;
  const center = cell => [((field.lonOf(cell % field.gw) + 180) % 360 + 360) % 360 - 180, field.latOf(Math.floor(cell / field.gw))];
  const side = war.participants[owner].side;
  const friendly = side === "A" ? 1 : 0;
  const legalProvinces = new Map();
  const validCells = new Int8Array(field.terrain.length);
  function legal(cell) {
    if (cell < 0 || !field.terrain[cell]) return false;
    const id = field.prov[cell];
    if (!legalProvinces.has(id)) {
      const province = sim.world.provinces[id];
      const provinceSide = war.participants[province?.__countryKey]?.side;
      legalProvinces.set(id, !!provinceSide && $r(war, province.__countryKey) && !u_A(sim, province.__provKey, war.id) &&
        (provinceSide === side || gpmHistoricalCheckOccupation(sim, war, province)));
    }
    return legalProvinces.get(id);
  }
  function eligible(cell) {
    if (validCells[cell]) return validCells[cell] === 1;
    if (!legal(cell)) return false;
    const allowed = gpmFrontlineLandPoint(sim, field, center(cell));
    validCells[cell] = allowed ? 1 : -1;
    return allowed;
  }
  return { center, legal, eligible, hostile: cell => field.control[cell] !== friendly };
}

function gpmFrontlineGridNeighbors(field, cell) {
  const x = cell % field.gw;
  return [x > 0 ? cell - 1 : -1, x < field.gw - 1 ? cell + 1 : -1, cell - field.gw, cell + field.gw];
}

function gpmFrontlineStartingCell(war, terrain, start, line) {
  const direct = gpmFrontlineCell(war.field, ...start);
  if (terrain.eligible(direct)) return direct;
  let best = -1;
  let score = gpmFrontlineCoastSnapKm;
  for (let cell = 0; cell < war.field.terrain.length; cell++) {
    if (!war.field.terrain[cell]) continue;
    const position = terrain.center(cell);
    const distance = Zn(start, position);
    if (distance >= score || line && gpmFrontlineRoute(line, position).distanceKm > gpmFrontlineSectorKm || !terrain.eligible(cell)) continue;
    score = distance;
    best = cell;
  }
  return best;
}

function gpmFrontlineGridPath(sim, war, owner, points, line, objectiveProvinceKey) {
  const { field } = war;
  if (!field?.terrain || !field?.prov || typeof field.lonOf !== "function" || typeof field.latOf !== "function") return null;
  const goal = points.at(-1);
  const goalCell = gpmFrontlineCell(field, ...goal);
  const dryGoal = gpmFrontlineLandPoint(sim, field, goal);
  const terrain = gpmFrontlineTerrain(sim, war, owner);
  const start = gpmFrontlineStartingCell(war, terrain, points[0], line);
  if (start < 0) return null;

  // The live War Theatre raster uses four-way land contact. Following those same edges
  // rules out cutting diagonally between two water cells and keeps the route in this war.
  const previous = new Int32Array(field.terrain.length).fill(-2);
  const pending = new Int32Array(field.terrain.length);
  pending[0] = start;
  previous[start] = -1;
  let count = 1;
  let closest = -1;
  let remainingDistance = gpmFrontlineCoastSnapKm;
  for (let index = 0; index < count; index++) {
    const cell = pending[index];
    const position = terrain.center(cell);
    if (terrain.hostile(cell) && Math.abs(position[1] - goal[1]) * 111 < remainingDistance &&
        (objectiveProvinceKey == null || sim.world.provinces[field.prov[cell]]?.__provKey === objectiveProvinceKey)) {
      if (cell === goalCell && dryGoal && terrain.eligible(cell) && gpmFrontlineLandSegment(sim, field, position, goal)) {
        closest = cell;
        remainingDistance = 0;
        break;
      }
      const distance = Zn(position, goal);
      if (distance < remainingDistance && terrain.eligible(cell)) { closest = cell; remainingDistance = distance; }
    }
    for (const next of gpmFrontlineGridNeighbors(field, cell)) {
      if (previous[next] !== -2 || !terrain.legal(next)) continue;
      previous[next] = cell;
      pending[count++] = next;
    }
  }
  if (closest < 0) return null;
  const indices = [];
  for (let current = closest; current !== -1; current = previous[current]) indices.push(current);
  let path = indices.reverse().map(terrain.center);
  if (!gpmFrontlineLandStroke(sim, field, path)) {
    // Only cells on a candidate route pay for polygon and hole checks. If the raster
    // approximates a narrow bay, ask the native graph solver to avoid that vector gap.
    const solve = ikA({ count: field.terrain.length, distance: (a, b) => Zn(terrain.center(a), terrain.center(b)),
      neighbors: current => gpmFrontlineGridNeighbors(field, current).filter(next => terrain.eligible(next) &&
        gpmFrontlineLandSegment(sim, field, terrain.center(current), terrain.center(next))) });
    const exact = solve(start, closest, terrain.eligible);
    if (!exact.nodes?.length) return null;
    path = exact.nodes.map(terrain.center);
  }
  if (gpmFrontlineLandPoint(sim, field, points[0]) && gpmFrontlineLandSegment(sim, field, points[0], path[0])) path.unshift(points[0]);
  if (!remainingDistance) path.push(goal);
  const route = [path[0]];
  for (let from = 0; from < path.length - 1;) {
    let to = Math.min(from + 12, path.length - 1);
    while (to > from + 1 && !gpmFrontlineLandSegment(sim, field, path[from], path[to])) to--;
    if (Zn(route.at(-1), path[to]) > .001) route.push(path[to]);
    from = to;
  }
  return gpmFrontlineArrowPoints(route);
}

function gpmFrontlineCanonicalArrow(sim, war, owner, raw, line, objectiveProvinceKey) {
  const stroke = gpmFrontlineArrowPoints(raw);
  const points = stroke && gpmFrontlineArrowPoints([gpmFrontlineMidpoint(line), stroke.at(-1)]);
  if (!points) return { ok: false, reason: "objective" };
  const field = war.field?.terrain ? war.field : null;
  const dry = gpmFrontlineLandStroke(sim, field, points);
  if (dry) {
    const objective = gpmFrontlineObjectiveState(sim, war, owner, points, objectiveProvinceKey);
    if (objective.reason || objective.controlled) return { ok: false, reason: objective.reason || "objective_held" };
    return { ok: true, arrow: points, objectiveProvinceKey: objective.key, corrected: false };
  }
  let corrected = gpmFrontlineGridPath(sim, war, owner, points, line, objectiveProvinceKey);
  if (!corrected || !gpmFrontlineLandStroke(sim, field, corrected)) return { ok: false, reason: "no_land_route" };
  const direct = [points[0], corrected.at(-1)];
  if (gpmFrontlineLandStroke(sim, field, direct)) corrected = direct;
  const objective = gpmFrontlineObjectiveState(sim, war, owner, corrected, objectiveProvinceKey);
  if (objective.reason || objective.controlled) return { ok: false, reason: objective.reason || "objective_held" };
  return { ok: true, arrow: corrected, objectiveProvinceKey: objective.key, corrected: true };
}

function gpmFrontlineRoutePreview(sim, input) {
  const war = sim.conflicts?.get(input.warId);
  if (!gpmFrontlineWar(sim, war)) return { ok: false, reason: "conflict" };
  const previous = war.gpmFrontline?.find(plan => plan.id === input.afterId && plan.owner === sim.playerKey);
  const selected = gpmFrontlineLineRequest(war, input, previous);
  if (!selected.ok) return selected;
  const { line } = selected;
  const result = gpmFrontlineCanonicalArrow(sim, war, sim.playerKey, input.validateArrow || input.arrow, line, input.objectiveProvinceKey);
  if (result.ok && gpmFrontlineRoute(line, result.arrow[0]).distanceKm > gpmFrontlineSectorKm) return { ok: false, reason: "arrow_start" };
  return result;
}

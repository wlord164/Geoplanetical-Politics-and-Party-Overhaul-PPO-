const gpmFrontlineContactCache = new WeakMap();

function gpmFrontlineTracePoints(input) {
  if (!Array.isArray(input) || input.length < 2 || !input.every(eoe)) return null;
  return input.some(point => Zn(input[0], point) > 1) ? input.map(point => point.slice()) : null;
}

function gpmFrontlineContactChains(war) {
  const field = war?.field;
  if (!field?.terrain || !field?.control || !field.heat) return [];
  const cached = gpmFrontlineContactCache.get(field);
  if (cached && cached.generation === field._gen && cached.tick === field._tick) return cached.chains;
  const nativeGeometry = field._frontGeometryCache;
  const source = nativeGeometry && nativeGeometry.gen === field._gen && nativeGeometry.tick === field._tick && nativeGeometry;
  const geometry = source || vVr(field, field._phiGen === field._gen && field._phiDeg ||
    Float32Array.from(field.control, side => side ? 1 : -1));
  const chains = geometry.chains.map((keys, index) => {
    const vertices = keys.map(key => geometry.pt.get(key)).filter(Boolean);
    const points = vertices.map(({ lon, lat }) => [((lon + 180) % 360 + 360) % 360 - 180, lat]);
    const distances = [0];
    for (let index = 1; index < points.length; index++) distances.push(distances.at(-1) + Zn(points[index - 1], points[index]));
    return { id: `contact:${field._gen ?? field._tick ?? 0}:${index}:${keys[0]}`, points, distances,
      span: distances.at(-1), closed: keys[0] === keys.at(-1) };
  }).filter(chain => chain.span > 1);
  gpmFrontlineContactCache.set(field, { generation: field._gen, tick: field._tick, chains });
  return chains;
}

function gpmFrontlineContactAt(war, position, reachable = null) {
  let nearest = null;
  let maxDistance = gpmFrontlineSectorKm;
  for (const chain of gpmFrontlineContactChains(war)) {
    for (let index = 1; index < chain.points.length; index++) {
      const a = chain.points[index - 1];
      const b = chain.points[index];
      const segmentKm = chain.distances[index] - chain.distances[index - 1];
      if (Zn(a, position) > maxDistance + segmentKm) continue;
      const projection = GT(a, b, position, maxDistance);
      if (!projection) continue;
      const point = projection.ll || ik(a, b, segmentKm ? projection.alongKm / segmentKm : 0);
      if (reachable && !reachable(point)) continue;
      maxDistance = projection.distanceKm;
      nearest = { chain, measure: chain.distances[index - 1] + projection.alongKm, position: point };
    }
  }
  return nearest;
}

function gpmFrontlineChainPoint(chain, measure) {
  if (measure <= 0) return chain.points[0];
  if (measure >= chain.span) return chain.points.at(-1);
  const index = chain.distances.findIndex(distance => distance >= measure);
  const step = chain.distances[index] - chain.distances[index - 1];
  return step ? ik(chain.points[index - 1], chain.points[index], (measure - chain.distances[index - 1]) / step) : chain.points[index];
}

function gpmFrontlineChainSlice(chain, from, to) {
  const result = [gpmFrontlineChainPoint(chain, from)];
  for (let index = 1; index < chain.distances.length - 1; index++) {
    if (chain.distances[index] > from && chain.distances[index] < to) result.push(chain.points[index]);
  }
  result.push(gpmFrontlineChainPoint(chain, to));
  return result;
}

function gpmFrontlineTrace(war, line) {
  if (!line?.length) return null;
  const start = gpmFrontlineContactAt(war, line[0]);
  const end = gpmFrontlineContactAt(war, line.at(-1));
  if (!start || !end || start.chain !== end.chain) return null;
  const chain = start.chain;
  if (chain.closed && Zn(line[0], line.at(-1)) < 1 && gpmFrontlineTraceWidth(line) > chain.span * .8) {
    return gpmFrontlineTracePoints(chain.points);
  }
  const from = Math.min(start.measure, end.measure);
  const to = Math.max(start.measure, end.measure);
  let forward = start.measure <= end.measure;
  let path;
  if (chain.closed && to - from > chain.span / 2) {
    path = gpmFrontlineChainSlice(chain, to, chain.span).concat(gpmFrontlineChainSlice(chain, 0, from).slice(1));
    forward = !forward;
  } else {
    path = gpmFrontlineChainSlice(chain, from, to);
  }
  return gpmFrontlineTracePoints(forward ? path : path.reverse());
}

function gpmFrontlineTraceWidth(line) {
  return line.slice(1).reduce((length, point, index) => length + Zn(line[index], point), 0);
}

function gpmFrontlineTraceWindow(war, position, width, reachable = null) {
  const selected = gpmFrontlineContactAt(war, position, reachable);
  if (!selected) return null;
  const { chain, measure } = selected;
  const span = Math.min(width, chain.span);
  if (chain.closed && span < chain.span && (measure - span / 2 < 0 || measure + span / 2 > chain.span)) {
    const a = (measure - span / 2 + chain.span) % chain.span;
    const b = (measure + span / 2) % chain.span;
    return gpmFrontlineTracePoints(gpmFrontlineChainSlice(chain, a, chain.span).concat(gpmFrontlineChainSlice(chain, 0, b).slice(1)));
  }
  const from = Math.max(0, Math.min(measure - span / 2, chain.span - span));
  return gpmFrontlineTracePoints(gpmFrontlineChainSlice(chain, from, from + span));
}

function gpmFrontlineLinePreview(sim, input) {
  const war = sim.conflicts?.get(input.warId);
  if (!gpmFrontlineWar(sim, war)) return { ok: false, reason: "conflict" };
  const previous = war.gpmFrontline?.find(plan => plan.id === input.afterId && plan.owner === sim.playerKey);
  return gpmFrontlineLineRequest(war, input, previous);
}

function gpmFrontlineLineRequest(war, input, previous) {
  const forecast = !!previous && !previous.completed;
  if (input.contactId != null) {
    const contact = gpmFrontlineContactChains(war).find(chain => chain.id === input.contactId);
    if (!contact) return { ok: false, reason: "front_changed" };
    const { startIndex, endIndex } = input;
    if (startIndex == null && endIndex == null) return { ok: true, line: contact.points, contactId: contact.id, scope: "whole", forecast };
    if (!Number.isInteger(startIndex) || !Number.isInteger(endIndex) || startIndex === endIndex ||
        [startIndex, endIndex].some(index => index < 0 || index >= contact.points.length)) return { ok: false, reason: "front" };
    const from = Math.min(startIndex, endIndex);
    const to = Math.max(startIndex, endIndex);
    let towardEnd = startIndex === from;
    let line = contact.points.slice(from, to + 1);
    if (contact.closed && contact.distances[to] - contact.distances[from] > contact.span / 2) {
      line = contact.points.slice(to).concat(contact.points.slice(1, from + 1));
      towardEnd = !towardEnd;
    }
    const traced = gpmFrontlineTracePoints(towardEnd ? line : line.reverse());
    return traced ? { ok: true, line: traced, contactId: contact.id, scope: "section", forecast } : { ok: false, reason: "front" };
  }
  const request = gpmFrontlineTracePoints(input.line);
  if (!request) return { ok: false, reason: "front" };
  const line = gpmFrontlinePlanLine(war, request, previous);
  return line ? { ok: true, line, scope: "section", forecast } : { ok: false, reason: "no_connected_front" };
}

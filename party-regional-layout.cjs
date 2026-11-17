"use strict";

function gpmCreatePartyMapFeatures(topology, arcCoordinates) {
  const provinces = topology.objects.provinces.geometries;
  let previousTolerance = 0;
  let cache = new Map();

  function simplify(points, toleranceSq) {
    if (points.length < 8) return points;
    for (let index = 1; index < points.length; index++) {
      if (Math.abs(points[index][0] - points[index - 1][0]) > 180) return points;
    }
    const last = points.length - 1;
    const keep = new Uint8Array(points.length);
    keep[0] = keep[last] = 1;
    const stack = [0, last];
    while (stack.length) {
      const end = stack.pop();
      const start = stack.pop();
      const [x, y] = points[start];
      const dx = points[end][0] - x;
      const dy = points[end][1] - y;
      const lengthSq = dx * dx + dy * dy;
      let farthest = toleranceSq;
      let split = -1;
      for (let index = start + 1; index < end; index++) {
        const offsetX = points[index][0] - x;
        const offsetY = points[index][1] - y;
        const along = lengthSq ? Math.min(1, Math.max(0, (offsetX * dx + offsetY * dy) / lengthSq)) : 0;
        const errorSq = (offsetX - dx * along) ** 2 + (offsetY - dy * along) ** 2;
        if (errorSq > farthest) {
          farthest = errorSq;
          split = index;
        }
      }
      if (split >= 0) {
        keep[split] = 1;
        stack.push(start, split, split, end);
      }
    }
    const simplified = points.filter((_, index) => keep[index]);
    const closed = points[0][0] === points[last][0] && points[0][1] === points[last][1];
    return closed && simplified.length < 4 ? points : simplified;
  }

  function orientedArea(points) {
    const [originX, originY] = points[0];
    let area = 0;
    let previousX = 0;
    let previousY = 0;
    for (let index = 1; index < points.length; index++) {
      const x = points[index][0] - originX;
      const y = points[index][1] - originY;
      area += previousX * y - previousY * x;
      previousX = x;
      previousY = y;
    }
    return area;
  }

  function ringCanReverse(ring) {
    const first = ring[0];
    const edge = cache.get(first < 0 ? ~first : first).coordinates;
    const [originX, originY] = edge[first < 0 ? edge.length - 1 : 0];
    let area = 0;
    let minimumChange = 0;
    let maximumChange = 0;
    let magnitude = 0;
    for (const ref of ring) {
      const { coordinates, sourceArea, change } = cache.get(ref < 0 ? ~ref : ref);
      const [startX, startY] = coordinates[0];
      const [endX, endY] = coordinates[coordinates.length - 1];
      const translated = (startX - originX) * (endY - originY) - (startY - originY) * (endX - originX);
      const direction = ref < 0 ? -1 : 1;
      area += direction * (sourceArea + translated);
      magnitude += Math.abs(sourceArea) + Math.abs(translated);
      const difference = direction * change;
      minimumChange += Math.min(0, difference);
      maximumChange += Math.max(0, difference);
    }
    if (minimumChange === 0 && maximumChange === 0) return false;
    // Use the whole range since a shared arc may be retained to protect another ring.
    const margin = Math.max(1, magnitude) * 1e-12;
    return area + minimumChange <= margin && area + maximumChange >= -margin;
  }

  return features => {
    const area = features.reduce((sum, feature) => sum + (feature.__area || 0), 0);
    // SVG maps have a short display span. Keep smaller territories closer to full detail.
    const tolerance = Math.min(.04, Math.sqrt(area) * 180 / Math.PI / 1250);
    if (!(tolerance >= .001)) return features;
    if (tolerance !== previousTolerance) {
      previousTolerance = tolerance;
      cache = new Map();
    }
    const shapes = features.map(feature => {
      const province = provinces[feature.__provId];
      return province?.type === "Polygon" || province?.type === "MultiPolygon" ? province : null;
    });
    const arcTolerances = new Map();
    const rings = [];
    for (const [index, province] of shapes.entries()) {
      if (!province) continue;
      // A tiny region may be shown on its own inset. Protect its shared edges too.
      const localTolerance = Math.min(tolerance, Math.sqrt(features[index].__area || 0) * 180 / Math.PI / 125);
      const polygons = province.type === "Polygon" ? [province.arcs] : province.arcs;
      for (const polygon of polygons) {
        for (const ring of polygon) {
          if (ring.length) rings.push(ring);
          for (const ref of ring) {
            const id = ref < 0 ? ~ref : ref;
            arcTolerances.set(id, Math.min(arcTolerances.get(id) ?? tolerance, localTolerance));
          }
        }
      }
    }
    for (const [id, limit] of arcTolerances) {
      if (cache.get(id)?.limit !== limit) {
        const points = arcCoordinates(id);
        const coordinates = limit >= .001 ? simplify(points, limit * limit) : points;
        const sourceArea = orientedArea(points);
        const change = coordinates === points ? 0 : orientedArea(coordinates) - sourceArea;
        cache.set(id, { limit, coordinates, sourceArea, change });
      }
    }
    const retainedArcs = new Set();
    for (const ring of rings) {
      if (!ringCanReverse(ring)) continue;
      for (const ref of ring) retainedArcs.add(ref < 0 ? ~ref : ref);
    }
    const arcs = [];
    for (const id of arcTolerances.keys()) {
      const entry = cache.get(id);
      // Both sides of a border use the same reduced TopoJSON arc, in opposite directions.
      arcs[id] = retainedArcs.has(id) ? (entry.original ??= arcCoordinates(id)) : entry.coordinates;
    }
    const displayTopology = { arcs };
    return features.map((feature, index) => {
      const province = shapes[index];
      return province ? { ...feature, geometry: D4(displayTopology, province).geometry } : feature;
    });
  };
}

function gpmRegionalMapLayout(features, displayFeatures = features) {
  if (!features.length) return null;

  // Nearby islands stay in geographic position regardless of population.
  // Chords on the unit sphere avoid a false coastline gap at the date line.
  const coastLimit = 2 * Math.sin(180 / (2 * 6371));
  const distanceSq = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  const shapes = new Map(features.map(feature => [feature.__provId, feature]));
  const unseen = new Set(shapes.keys());
  const components = [];
  while (unseen.size) {
    const first = unseen.values().next().value;
    unseen.delete(first);
    const queue = [first];
    for (const id of queue) {
      for (const neighbor of shapes.get(id).__adj || []) {
        if (unseen.delete(neighbor)) queue.push(neighbor);
      }
    }
    components.push(queue.map(id => shapes.get(id)));
  }

  const population = group => group.reduce((sum, feature) => sum + Math.max(0, feature.__pop || 0), 0);
  components.sort((left, right) => population(right) - population(left) || right.length - left.length);
  const main = components.shift();

  const geometry = new WeakMap();
  function coast(feature) {
    if (geometry.has(feature)) return geometry.get(feature);
    const { type, coordinates } = feature.geometry;
    const polygons = type === "MultiPolygon" ? coordinates : type === "Polygon" ? [coordinates] : [];
    const points = polygons.flatMap(polygon => (polygon[0] || []).map(([lon, lat]) => p0e(lon, lat)));
    const center = feature.__centroid || zd(feature);
    const sphere = center?.every(Number.isFinite) ? p0e(...center) : null;
    const extent = sphere ? points.reduce((max, point) => Math.max(max, distanceSq(point, sphere)), 0) : Infinity;
    const item = { points, sphere, radius: Math.sqrt(extent) };
    geometry.set(feature, item);
    return item;
  }
  function nearby(left, right) {
    const a = coast(left);
    const b = coast(right);
    if (a.sphere && b.sphere && distanceSq(a.sphere, b.sphere) > (a.radius + b.radius + coastLimit) ** 2) return false;
    return a.points.some(point => b.points.some(other => distanceSq(point, other) <= coastLimit ** 2));
  }
  for (let index = 0; index < main.length; index++) {
    for (let remote = components.length - 1; remote >= 0; remote--) {
      const group = components[remote];
      if (!group.some(shape => nearby(main[index], shape))) continue;
      main.push(...group);
      components.splice(remote, 1);
    }
  }

  function plot(group, width, height, pad, minAspect, maxAspect, fitGroup = group) {
    const collection = { type: "FeatureCollection", features: group };
    const frame = fitGroup === group ? collection : { type: "FeatureCollection", features: fitGroup };
    const projection = RNt(fitGroup).fitExtent([[pad, pad], [width - pad, height - pad]], frame);
    const path = dh(projection);
    const [[x0, y0], [x1, y1]] = path.bounds(frame);
    if (![x0, y0, x1, y1].every(Number.isFinite)) return null;
    let w = Math.max(1, x1 - x0) + pad * 2;
    let h = Math.max(1, y1 - y0) + pad * 2;
    w = Math.max(w, h * minAspect);
    h = Math.max(h, w / maxAspect);
    const viewBox = [(x0 + x1 - w) / 2, (y0 + y1 - h) / 2, w, h].map(value => value.toFixed(2)).join(" ");
    const paths = group.flatMap(feature => {
      const d = path(feature);
      return d ? [{ provId: feature.__provId, d }] : [];
    });
    return paths.length ? { viewBox, paths } : null;
  }

  function insetFrame(group) {
    // Keep the full region path, but fit widely scattered island chains around
    // their main islands so minor outlying rocks do not set the panel scale.
    if (group.length !== 1 || group[0].geometry.type !== "MultiPolygon") return group;
    const [feature] = group;
    const parts = feature.geometry.coordinates.map(coordinates => ({
      type: "Feature", geometry: { type: "Polygon", coordinates },
    })).map(shape => ({ shape, area: B4(shape), center: zd(shape) }));
    const largest = parts.reduce((best, part) => part.area > (best?.area || 0) ? part : best, null);
    if (!largest || !largest.center?.every(Number.isFinite)) return group;
    const nearbyLimit = 240 / 6371;
    const anchors = parts.filter(part => part.area >= largest.area * .025);
    const core = parts.filter(part => anchors.includes(part) ||
      (part.center?.every(Number.isFinite) && anchors.some(anchor => anchor.center?.every(Number.isFinite) &&
        Nje(part.center, anchor.center) <= nearbyLimit)));
    return core.length && core.length < parts.length ? core.map(part => part.shape) : group;
  }

  const displayById = new Map(displayFeatures.map(feature => [feature.__provId, feature]));
  const display = group => group.map(feature => displayById.get(feature.__provId));
  const primary = plot(display(main), 620, 450, 12, 1.24, 3.1);
  if (!primary) return null;
  const insets = components.flatMap(group => {
    const shapes = display(group);
    const map = plot(shapes, 150, 102, 6, 1.05, 2.05, insetFrame(shapes));
    return map ? [{ ...map, ids: group.map(feature => feature.__provId) }] : [];
  });
  return { ...primary, insets };
}

module.exports = { gpmCreatePartyMapFeatures, gpmRegionalMapLayout };

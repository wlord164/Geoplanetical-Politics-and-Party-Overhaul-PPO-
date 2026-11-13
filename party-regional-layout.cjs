"use strict";

function gpmRegionalMapLayout(features) {
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
    const points = polygons.flatMap(polygon => (polygon[0] || []).map(([lon, lat]) => Xoe(lon, lat)));
    const center = nd(feature);
    const sphere = center?.every(Number.isFinite) ? Xoe(...center) : null;
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
    const projection = xkt(fitGroup).fitExtent([[pad, pad], [width - pad, height - pad]], frame);
    const path = e2(projection);
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
    })).map(shape => ({ shape, area: s3(shape), center: nd(shape) }));
    const largest = parts.reduce((best, part) => part.area > (best?.area || 0) ? part : best, null);
    if (!largest || !largest.center?.every(Number.isFinite)) return group;
    const nearbyLimit = 240 / 6371;
    const anchors = parts.filter(part => part.area >= largest.area * .025);
    const core = parts.filter(part => anchors.includes(part) ||
      (part.center?.every(Number.isFinite) && anchors.some(anchor => anchor.center?.every(Number.isFinite) &&
        qNe(part.center, anchor.center) <= nearbyLimit)));
    return core.length && core.length < parts.length ? core.map(part => part.shape) : group;
  }

  const primary = plot(main, 620, 450, 12, 1.24, 3.1);
  if (!primary) return null;
  const insets = components.flatMap(group => {
    const map = plot(group, 150, 102, 6, 1.05, 2.05, insetFrame(group));
    return map ? [{ ...map, ids: group.map(feature => feature.__provId) }] : [];
  });
  return { ...primary, insets };
}

module.exports = { gpmRegionalMapLayout };

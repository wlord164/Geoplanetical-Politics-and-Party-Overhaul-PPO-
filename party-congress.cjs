"use strict";

function partyCongressView(sim, country, partyId) {
  if (!WN(country, partyId)) return null;
  const figures = [];
  for (const person of sim.people?.values?.() || []) {
    if (person?.party !== partyId || person.alive === false || String(person.countryKey) !== String(country.key)) continue;
    const ideal = person.ideal;
    const hasIdeology = gpmAxes.every(({ id }) => Number.isFinite(ideal?.[id]) && Math.abs(ideal[id]) <= 1);
    figures.push({
      name: person.styledName || person.name || "",
      ideology: hasIdeology ? Object.fromEntries(gpmAxes.map(({ id }) => [id, ideal[id]])) : null,
    });
  }
  return { figures };
}

function retirePartyCongress(party) {
  if (!party.gpmCongress) return;
  const { active } = party.gpmCongress;
  const organization = party.organization;
  if (active && organization) {
    if (Number.isFinite(active.activistsK) && active.activistsK > 0) {
      organization.activistsK = GN(Math.min(1e5, (organization.activistsK || 0) + active.activistsK));
    }
    if (Number.isFinite(active.cash) && active.cash > 0) {
      const treasury = Math.min(Tde, (organization.treasuryM || 0) + active.cash);
      organization.treasuryM = Math.round(treasury * 1e6) / 1e6;
    }
  }
  delete party.gpmCongress;
}

function partyCongressGroups(figures) {
  const groups = new Map();
  for (const figure of figures) {
    const label = figure.ideology ? partyIdeologyLabel(figure) : "Ideology unrecorded";
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(figure);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function renderPartyCongress(view, party, ui) {
  const data = view.party?.congress;
  if (!data || !party) return "";
  const platform = b(partyIdeologyLabel(party));
  const figures = data.figures;
  const count = figures.length;
  const heading = `<h3 class="mc-title">Party Congress</h3><div>Party platform <strong>${platform}</strong></div>`;
  if (!count) return `<section class="mcard wide gpm-party-congress" aria-label="Party Congress">
    ${heading}<p class="empty-note">No party figures are recorded yet.</p></section>`;

  const groups = partyCongressGroups(figures);
  const rows = Math.min(count, Math.max(2, Math.round(Math.sqrt(count / 2.6))));
  const seats = ui._seatLayout(count, rows, 78, 160);
  const radius = Math.max(1.6, Math.min(6.2, 34.4 / Math.max(1, rows - 1)));
  const palette = ["#88bdea", "#f3a37f", "#82c9ab", "#df95b5", "#c1a6ee", "#e5c87d", "#76cbd8", "#ccae9f"];
  const dots = [];
  const legend = [];
  let position = 0;
  for (const [index, [label, members]] of groups.entries()) {
    const id = `congress-${index}`;
    const color = palette[index] || `hsl(${Math.round(index * 137.508) % 360}, 62%, 72%)`;
    const names = members.map(member => member.name).filter(Boolean);
    const namesText = names.length ? names.join(", ") : label;
    for (const member of members) {
      const point = seats[position++];
      dots.push(`<circle class="seat" data-pty="${id}" cx="${(170 + point.x).toFixed(1)}" cy="${(168 + point.y).toFixed(1)}" r="${radius.toFixed(1)}" fill="${color}"><title>${b(member.name || label)}</title></circle>`);
    }
    legend.push(`<span class="hc-leg-item" tabindex="0" data-pty="${id}" data-tip="${b(namesText)}" aria-label="${b(`${label}, ${members.length} known figures. ${names.join(", ")}`)}"><i style="background:${color}"></i>${b(label)} <b>${members.length}</b></span>`);
  }

  return `<section class="mcard wide gpm-party-congress" aria-label="Party Congress">${heading}
    <div class="hemicycle">
      <svg viewBox="0 0 340 180" class="hc-svg" role="img" aria-label="${count} known party ${count === 1 ? "figure" : "figures"} by ideology">
        <path d="M 10 168 A 160 160 0 0 1 330 168" fill="none" stroke="currentColor" opacity=".25"/>
        <text x="170" y="151" class="hc-total" text-anchor="middle">${count}</text>
        <text x="170" y="165" class="hc-total-sub" text-anchor="middle">${count === 1 ? "known figure" : "known figures"}</text>
        ${dots.join("")}
      </svg>
      <div class="hc-legend">${legend.join("")}</div>
    </div>
  </section>`;
}

module.exports = {
  workerFunctions: [partyCongressView, retirePartyCongress],
  rendererFunctions: [partyCongressGroups, renderPartyCongress],
};

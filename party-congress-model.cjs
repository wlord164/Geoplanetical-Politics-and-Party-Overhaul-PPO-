"use strict";

function partyCongressIdeology(ideal) {
  if (!gpmAxes.every(({ id }) => Number.isFinite(ideal?.[id]) && Math.abs(ideal[id]) <= 1)) return null;
  return Object.fromEntries(gpmAxes.map(({ id }) => [id, ideal[id]]));
}

function partyCongressView(sim, country, partyId, electorate) {
  const party = WN(country, partyId);
  if (!party) return null;

  const saved = party.gpmCongressSizeState;
  const size = partyCongressSizeIsValid(saved?.size) ? saved.size : 100;
  const lastVote = saved?.lastVote ?? null;
  const figures = [];
  for (const person of sim.people?.values?.() || []) {
    if (person?.party !== partyId || person.alive === false || String(person.countryKey) !== String(country.key)) continue;
    figures.push({
      name: person.styledName || person.name || "",
      ideology: partyCongressIdeology(person.ideal),
    });
  }

  const platform = partyCongressIdeology(party.ideology);
  if (!platform) return { size, lastVote, profiles: [], figures };

  // The platform anchors the estimate. Blocs shape tendencies within the party,
  // and known figures contribute a smaller share. Missing evidence stays with the platform.
  const supportPool = .45;
  const figurePool = .10;
  const blocInfluence = .70;
  const blocIdeals = new Map(dIe(country).map(group => [group.id, group.ideal]));
  const support = partySupportBaseView(sim, country, partyId, electorate);
  const evidence = [];
  for (const bloc of support?.blocs || []) {
    if (bloc.shareOfSupport <= 0) continue;
    const ideal = partyCongressIdeology(blocIdeals.get(bloc.id));
    if (!ideal) continue;
    const ideology = Object.fromEntries(gpmAxes.map(({ id }) => [
      id, platform[id] * (1 - blocInfluence) + ideal[id] * blocInfluence,
    ]));
    evidence.push({ ideology, weight: supportPool * bloc.shareOfSupport });
  }
  if (figures.length) {
    const weight = figurePool / figures.length;
    for (const figure of figures) {
      if (figure.ideology) evidence.push({ ideology: figure.ideology, weight });
    }
  }

  const platformWeight = 1 - evidence.reduce((sum, profile) => sum + profile.weight, 0);
  return { size, lastVote, profiles: [{ ideology: platform, weight: platformWeight }, ...evidence], figures };
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

module.exports = { workerFunctions: [partyCongressIdeology, partyCongressView, retirePartyCongress] };

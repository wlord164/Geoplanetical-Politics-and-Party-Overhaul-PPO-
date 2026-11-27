"use strict";

function partyLawShortlist(sim) {
  const day = sim.day || 0;
  if (!sim.player?.pol) return { day, partyId: null, rights: { ok: false, reason: "party" }, laws: [] };
  const { querySim, country, partyId } = Dot(sim);
  const reason = bDt(querySim, country, partyId);
  const party = country?.pol?.parties.find(item => item.id === partyId);
  const platform = gpmPresets[gpmActiveIdeologyPreset(party)];
  const active = partyCongressActiveProgramme(party, day);
  const programmeTargets = partyCongressProgrammes()[active?.kind]?.lawTargets || {};
  const candidates = new Map(Qda(querySim, country, partyId, false).map(item => [item.law.id, item]));
  const authoredLaws = new Set([...Object.keys(platform?.laws || {}), ...Object.keys(programmeTargets)]);
  for (const lawId of authoredLaws) {
    const law = cA(lawId);
    const current = country.laws?.[lawId];
    const programme = Object.hasOwn(programmeTargets, lawId);
    const target = programme ? programmeTargets[lawId] : gpmIdeologyLawTarget(platform, lawId, current, querySim._simYear || 2026);
    if (!law || current == null || target === undefined) continue;
    candidates.delete(lawId);
    if (ir(current, target) || (country.lawCooldown?.[lawId] || 0) > day ||
        country.procedures?.some(procedure => procedure.kind === "law" && procedure.lawId === lawId)) continue;
    const distance = value => typeof target === "number" ? Math.abs(target - value) :
      typeof target === "object" ? Object.keys(target).filter(key => target[key] !== value?.[key]).length :
        Number(value !== target);
    const choices = Yh(law, country, current).filter(choice => distance(choice.value) < distance(current));
    choices.sort((a, b) => distance(a.value) - distance(b.value));
    if (choices.length) {
      const choice = choices[0];
      const gain = Kst(party, law, current, country) - Kst(party, law, choice.value, country);
      candidates.set(lawId, { law, choice, gain, priority: true, programme });
    }
  }
  const laws = [];
  for (const { law, choice, gain, priority, programme } of candidates.values()) {
    if (!CDt(country, law).ok) continue;
    const forecast = querySim.forecastBillFor(country, law, choice.value, {
      sponsorKind: "party",
      sponsorPartyId: partyId,
      partyLines: { [partyId]: { lineId: "support", setDay: day } },
    });
    if (!forecast.fc || !forecast.procedureKind) continue;
    const stages = { ...forecast.exec, completeHistory: true };
    querySim._procedurePasses(country.pol, forecast.procedureKind, forecast.fc.detail, stages);
    const { requiredVotes, vetoRisk, courtRisk } = oye(stages._res?.history);
    laws.push({
      lawId: law.id, value: pa(choice.value), choiceId: choice.id, gain: B6(gain, 2), ...(priority ? { priority } : {}),
      ...(programme ? { programme } : {}),
      passes: forecast.passes, yes: forecast.fc.yes, total: forecast.fc.total,
      requiredVotes, vetoRisk, courtRisk,
    });
  }

  const margin = law => law.yes - (law.requiredVotes ?? Math.floor(law.total / 2) + 1);
  laws.sort((a, b) => Number(b.passes) - Number(a.passes)
    || Number(Boolean(b.priority)) - Number(Boolean(a.priority))
    || margin(b) - margin(a) || b.gain - a.gain || k(a.lawId, b.lawId));
  return { day, partyId, rights: { ok: !reason, reason }, laws };
}

module.exports = { workerFunctions: [partyLawShortlist] };

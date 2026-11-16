"use strict";

const { gpmResolveRoleEligibility, workerFunctions: roleRules } = require("./party-role-rules.cjs");

function gpmFactionLeadershipCharter(sim, party) {
  const date = sim.date?.toISOString?.().slice(0, 10);
  const records = party.gpmCharter?.factionLeadership;
  const active = (Array.isArray(records) ? records : [records]).filter(record => record && gpmRoleDateInEffect(record, date))
    .sort((a, b) => (b.effectiveFrom || "").localeCompare(a.effectiveFrom || ""))[0];
  const method = ["appointment", "election", "none"].includes(active?.method) ? active.method : "appointment";
  const termDays = Number.isSafeInteger(active?.termDays) && active.termDays > 0 ? active.termDays : 365;
  const electionDelayDays = Number.isSafeInteger(active?.electionDelayDays) && active.electionDelayDays >= 0 ?
    active.electionDelayDays : 14;
  return {
    key: `${active?.id || "ordinary"}:${active?.effectiveFrom || ""}:${active?.revision ?? 0}`,
    method, termDays, electionDelayDays,
    allowGenerated: active?.allowGenerated !== false,
    allowActing: active?.allowActing !== false,
    allowReappointment: active?.allowReappointment !== false,
    authorityId: active?.authorityId || null,
  };
}

function gpmPersonRoleFacts(sim, person, organizationId) {
  const year = sim.date?.getUTCFullYear?.() ?? sim._simYear ?? 2026;
  const age = person?.born == null ? null : Ly(person, year, sim.date?.getUTCMonth?.());
  const facts = person?.gpmRoleQualifications?.[organizationId];
  return { person, age, memberStatus: facts?.memberStatus, heldPositions: facts?.heldPositions, attestations: facts?.attestations,
    date: sim.date?.toISOString?.().slice(0, 10) };
}

function gpmFactionLeaderEligibility(sim, country, party, charter, person, usedLeaderIds) {
  const nativeAllowed = person?.alive === true && !person.inExileFrom && person.party === party.id &&
    String(person.countryKey) === String(country.key) && c9(sim, person) && !usedLeaderIds.has(person.id);
  const binding = gpmPartyRoleBinding(country, party);
  if (charter.authorityId) binding.authorityId = charter.authorityId;
  const facts = gpmPersonRoleFacts(sim, person, binding.organizationId);
  return gpmResolveRoleEligibility({
    ...binding, ...facts, role: "factionLeadership", nativeAllowed, rules: gpmPartyRoleRules(country, party),
  });
}

function gpmNativeCandidateAllowed(sim, country, partyId, person, positionId) {
  const party = fS(country, partyId);
  if (!party?.gpmCharter?.roleRules?.length) return true;
  const binding = gpmPartyRoleBinding(country, party);
  const facts = gpmPersonRoleFacts(sim, person, binding.organizationId);
  return gpmResolveRoleEligibility({ ...binding, ...facts, role: "candidacy", positionId,
    nativeAllowed: true, rules: gpmPartyRoleRules(country, party) }).eligible;
}

function gpmPublicRoleEligibility(sim, country, person, role, positionId) {
  const charter = country.pol?.gpmPublicRoleCharter;
  if (!charter?.organizationId || !charter.authorityId || !charter.roleRules?.length) return true;
  const facts = gpmPersonRoleFacts(sim, person, charter.organizationId);
  return gpmResolveRoleEligibility({ ...facts, role, positionId, nativeAllowed: true, rules: charter.roleRules,
    organizationId: charter.organizationId, authorityId: charter.authorityId, jurisdictionKey: String(country.key) }).eligible;
}

function gpmNativeOfficeAllowed(sim, country, person, positionId) {
  if (!country.pol?.gpmPublicRoleCharter) return true;
  const selection = ar(country, positionId)?.selection;
  const role = selection?.method === "designation" && selection.by === "clergy" ? "clericalOffice" : "executiveOffice";
  return gpmPublicRoleEligibility(sim, country, person, role, positionId);
}

function gpmPublicOfficeTransition(sim, country, target) {
  if (!country.pol?.gpmPublicRoleCharter) return;
  const current = Xe(country)?.offices || {};
  for (const [positionId, office] of Object.entries(Xe(target)?.offices || {})) {
    for (const category of ["principal", "acting"]) {
      const incoming = office?.[category]?.personId;
      if (!incoming || current[positionId]?.[category]?.personId === incoming) continue;
      const person = sim.people?.get(incoming);
      if (person && !gpmNativeOfficeAllowed(sim, target, person, positionId)) ta("role_ineligible", positionId);
    }
  }
}

function gpmRolePolicySnapshot(sim) {
  const country = sim.player;
  const party = country && YL(country, Uo(country));
  return party ? gpmPartyRolePolicyView(sim, country, party) : null;
}

function gpmFactionLeaderRank(person, ideology) {
  const authored = person.gpmHistoricalPerson || person.seeded ? 4 : 0;
  const distance = gpmAxes.reduce((sum, { id }) => sum + Math.abs((person.ideal?.[id] || 0) - (ideology?.[id] || 0)), 0);
  return authored - distance / gpmAxes.length + (person.traits?.competence || 0) * .1;
}

function gpmCreateFactionLeader(sim, country, party, faction, charter, usedLeaderIds, generation) {
  const basis = `${Number(sim.rngSeed0) >>> 0}:${country.key}:${party.id}:${faction.id}:leader:${generation}`;
  const factionPersonId = ["ppo-faction-person", ...[country.key, party.id, faction.id].map(encodeURIComponent), generation].join(":");
  const existing = sim.people.get(factionPersonId);
  if (existing) return existing.gpmFactionGenerated &&
    gpmFactionLeaderEligibility(sim, country, party, charter, existing, usedLeaderIds).eligible ? existing : null;
  const year = sim.date?.getUTCFullYear?.() ?? sim._simYear ?? 2026;
  const firstGender = ($d(basis) >>> 8) % 2 ? "f" : "m";
  for (const gender of [firstGender, firstGender === "f" ? "m" : "f"]) {
    const seed = $d(`${basis}:${gender}`);
    const profile = { countryKey: country.key, party: party.id, seed, g: gender, born: year - 36 - (seed >>> 8) % 23 };
    if (!gpmFactionLeaderEligibility(sim, country, party, charter, { ...profile, alive: true }, usedLeaderIds).eligible) continue;
    const person = Vc(sim, { ...profile, factionPersonId, role: "party_figure", since: year, ideal: faction.ideology || party.ideology });
    person.gpmFactionGenerated = true;
    return person;
  }
  return null;
}

function gpmFactionLeadershipRecord(person, country, party, faction, day, year, status) {
  const career = person.gpmFactionCareer ||= [];
  career.push({ countryKey: country.key, partyId: party.id, factionId: faction.id, factionName: faction.displayLabel || faction.label || faction.id,
    sinceDay: day, sinceYear: year, status });
}

function gpmFactionLeadershipClose(person, country, party, faction, day, year, reason) {
  const term = person?.gpmFactionCareer?.findLast(period => period.untilDay == null && period.factionId === faction.id &&
    period.partyId === party.id && period.countryKey === country.key);
  if (term) Object.assign(term, { untilDay: day, untilYear: year, reason });
}

function gpmFactionLeader(sim, country, party, faction, usedLeaderIds = new Set(), people = sim.people?.values?.() || [], canAppoint = true) {
  const day = sim.day || 0;
  const year = sim.date?.getUTCFullYear?.() ?? sim._simYear ?? 2026;
  const charter = gpmFactionLeadershipCharter(sim, party);
  const prior = faction.leadership;
  const incumbent = prior?.personId && sim.people?.get?.(prior.personId);
  const charterChanged = !!prior && prior.charterKey !== charter.key;
  const eligible = person => gpmFactionLeaderEligibility(sim, country, party, charter, person, usedLeaderIds).eligible;
  if ((canAppoint || faction.seats > 0) && charter.method !== "none" && !charterChanged &&
      incumbent && day < prior.termEndDay && eligible(incumbent)) return incumbent;
  if (!canAppoint && !prior?.personId) return null;
  if (charter.method !== "none" && !charterChanged && prior?.status === "vacant" && day < prior.retryDay) return null;

  const earlyVacancy = prior?.personId && day < prior.termEndDay && !eligible(incumbent);
  let electionDay = null;
  if (charter.method === "election" && !charterChanged) {
    if (prior?.electionDay > day) electionDay = prior.electionDay;
    else if (earlyVacancy && charter.electionDelayDays > 0) electionDay = day + charter.electionDelayDays;
  }
  const waitingForElection = electionDay != null;
  const acting = waitingForElection && charter.allowActing;
  const canSelect = canAppoint && charter.method !== "none" && (!waitingForElection || acting);
  const exclude = !charter.allowReappointment && prior?.status !== "acting" ? prior?.personId : null;
  const ideology = faction.ideology || party.ideology;
  let leader = null;
  let generation = prior?.generation || 0;
  if (canSelect) {
    const available = Array.from(people).filter(person => person.id !== exclude && eligible(person));
    available.sort((a, b) => gpmFactionLeaderRank(b, ideology) - gpmFactionLeaderRank(a, ideology) || a.id.localeCompare(b.id));
    leader = available[0] || null;
    if (!leader && charter.allowGenerated) {
      leader = gpmCreateFactionLeader(sim, country, party, faction, charter, usedLeaderIds, generation);
      if (leader) generation++;
    }
  }
  const status = leader ? (acting ? "acting" : charter.method === "election" ? "elected" : "appointed") : "vacant";
  const reason = !canAppoint ? "delegate_threshold" : charter.method === "none" ? "charter_prohibits_selection" :
    charterChanged ? "charter_changed" : earlyVacancy ? "leader_ineligible" :
      prior?.personId ? "term_ended" : leader ? "eligible_leader_selected" : "no_eligible_person";
  if (prior?.status === "vacant" && status === "vacant" && !charterChanged) {
    prior.electionDay = electionDay;
    prior.retryDay = charter.method === "none" ? null : electionDay ?? day + 30;
    return null;
  }
  const history = prior?.history || [];
  if (prior?.personId) {
    history.push({ personId: prior.personId, name: incumbent?.styledName || incumbent?.name || prior.personName,
      status: prior.status, sinceDay: prior.sinceDay, untilDay: day, reason });
    gpmFactionLeadershipClose(incumbent, country, party, faction, day, year, reason);
  }
  if (leader) gpmFactionLeadershipRecord(leader, country, party, faction, day, year, status);
  faction.leadership = {
    charterKey: charter.key, personId: leader?.id || null, personName: leader?.styledName || leader?.name || null, status,
    sinceDay: day, termEndDay: leader ? (acting ? electionDay : day + charter.termDays) : null,
    retryDay: leader || !canAppoint || charter.method === "none" ? null : electionDay ?? day + 30,
    electionDay: canAppoint ? electionDay : null, generation, reason, history,
  };
  return leader;
}

function gpmFactionLeaderView(sim, faction) {
  const term = faction.leadership;
  const person = term?.personId && sim.people?.get?.(term.personId);
  const available = person?.alive === true;
  return {
    id: available ? person.id : null, personId: available ? person.id : null,
    name: available ? person.styledName || person.name : null,
    role: available ? person.role : null, status: available ? term.status : "vacant",
    sinceDay: term?.sinceDay ?? null, termEndDay: available ? term.termEndDay : null,
    retryDay: term?.retryDay ?? null, reason: term?.reason ?? null,
    history: (term?.history || []).slice(-12),
  };
}

function gpmFactionPeopleRandom(sim, person, month, draw) {
  if (!person.gpmFactionGenerated && !person.gpmFactionDetached) return s9(sim);
  let seed = $d(`${person._seed}:${month}:${draw}`);
  seed = Math.imul(seed ^ seed >>> 16, 0x85ebca6b);
  return ((seed ^ seed >>> 13) >>> 0) / 4294967296;
}

function patchFactionPeopleWorker(source, replaceOnce) {
  let patched = replaceOnce(source, 'c=m7a(e,a),u=Object.assign(y7a(r,DQ(e,r)),t.traits||{})',
    'c=t.factionPersonId||m7a(e,a),u=Object.assign(y7a(r,DQ(e,r)),t.traits||{})');
  patched = replaceOnce(patched, 'if(!(s.alive||r.has(i)||o.has(i)&&l<=150||n.has(i)))',
    'if(!(s.alive||s.gpmFactionCareer?.length||r.has(i)||o.has(i)&&l<=150||n.has(i)))');
  patched = replaceOnce(patched, 'for(let[r,o]of[...e.people])!o.alive||t.has(r)||(Z0t(e,r,o),e.people.delete(r))',
    'for(let[r,o]of[...e.people]){if(!o.alive)continue;if(t.has(r)){delete o.gpmFactionDetached;continue}if(o.gpmFactionCareer?.length){o.gpmFactionDetached=true;continue}Z0t(e,r,o),e.people.delete(r)}');
  patched = replaceOnce(patched, 'filter(l=>l.alive!==!1&&l.countryKey===t.key&&(a==null||l.party===a)&&!n.has(l.id)&&(!r||MA(t,r,l.id).eligible))',
    'filter(l=>!l.gpmFactionGenerated&&!l.gpmFactionDetached&&l.alive!==!1&&l.countryKey===t.key&&(a==null||l.party===a)&&!n.has(l.id)&&(!r||MA(t,r,l.id).eligible&&gpmNativeOfficeAllowed(e,t,l,r)))');
  patched = replaceOnce(patched, '_partyCandidate(t,a,r=null){let o=r?Ve(t,r):null,n=i=>!o||MA(t,o,i.id).eligible;if(o&&cc(t,o)===a){let i=uc(this,t,o);if(i?.alive!==!1&&(!i||n(i)))return i}return pAe(this,t,a,o)[0]||null}',
    '_partyCandidate(t,a,r=null){let o=r?Ve(t,r):null,n=i=>!o||MA(t,o,i.id).eligible&&gpmNativeOfficeAllowed(this,t,i,o),gpmCandidate=i=>!o||gpmNativeCandidateAllowed(this,t,a,i,o);if(o&&cc(t,o)===a){let i=uc(this,t,o);if(i?.alive!==!1&&(!i||n(i)&&gpmCandidate(i)))return i}return pAe(this,t,a,o).find(gpmCandidate)||null}');
  patched = replaceOnce(patched, 'let n=aut(e,t,a);if(n?.id===r.id)return r.id;if((t.cabinetIds||[]).includes(r.id))',
    'let n=aut(e,t,a);if(n?.id===r.id)return r.id;if(!gpmPublicRoleEligibility(e,t,r,"cabinetAppointment",a))return null;if((t.cabinetIds||[]).includes(r.id))');
  patched = replaceOnce(patched, 'yde(c),Vke(f),Vm(e,f);let S=r.socialMind?',
    'yde(c),Vke(f),Vm(e,f),gpmPublicOfficeTransition(e,r,f);let S=r.socialMind?');
  patched = replaceOnce(patched, 'return Vke(s),Vm(e,s),a.nextSocialMind&&G3',
    'return Vke(s),Vm(e,s),gpmPublicOfficeTransition(e,r,s),a.nextSocialMind&&G3');
  patched = replaceOnce(patched, 'a==="gpm.historicalMap"?', 'a==="gpm.partyRolePolicy"?gpmRolePolicySnapshot(r):a==="gpm.historicalMap"?');
  const start = patched.indexOf('function O7a(');
  const end = patched.indexOf('function D7a(', start + 1);
  const original = patched.slice(start, end);
  if (start < 0 || end < 0 || original.split('s9(e)').length !== 5) {
    throw new Error("Faction leader lifecycle patch target changed");
  }
  const mortality = replaceOnce(original, 'if(!s.alive)continue;let l=Ly(s,t,a);',
    'if(!s.alive)continue;let gpmPeopleDraw=0,l=Ly(s,t,a);');
  return replaceOnce(patched, original, mortality.replaceAll('s9(e)', 'gpmFactionPeopleRandom(e,s,i,gpmPeopleDraw++)'));
}

function patchFactionPeopleRenderer(source, replaceOnce) {
  return replaceOnce(source, 'return!e.alive&&e.diedYear!=null&&a.push({y:e.diedYear,txt:o("fiche.life.died")})',
    `for (const period of e.gpmFactionCareer || []) {
      const name = b(period.factionName);
      if (Number.isInteger(period.sinceYear)) {
        const position = period.status === "acting" ? "acting faction leader" : "faction leader";
        a.push({ y: period.sinceYear, txt: "Became " + position + " for " + name });
      }
      if (Number.isInteger(period.untilYear)) a.push({ y: period.untilYear, txt: "Ended faction leadership for " + name });
    }
    return!e.alive&&e.diedYear!=null&&a.push({y:e.diedYear,txt:o("fiche.life.died")})`);
}

module.exports = {
  gpmResolveRoleEligibility, patchFactionPeopleWorker, patchFactionPeopleRenderer,
  workerFunctions: [
    ...roleRules, gpmFactionLeadershipCharter, gpmPersonRoleFacts, gpmFactionLeaderEligibility,
    gpmNativeCandidateAllowed, gpmPublicRoleEligibility, gpmNativeOfficeAllowed, gpmPublicOfficeTransition, gpmRolePolicySnapshot,
    gpmFactionLeaderRank, gpmCreateFactionLeader, gpmFactionLeadershipRecord, gpmFactionLeadershipClose,
    gpmFactionLeader, gpmFactionLeaderView, gpmFactionPeopleRandom,
  ],
};

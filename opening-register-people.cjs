"use strict";

function gpmApplyOpeningPersonIdentity(person, identityId) {
  const identity = gpmRegisterPersonData.people[identityId];
  if (!identity || !person?.alive || (person.gpmHistoricalPerson && person.gpmHistoricalPerson !== identityId)) return false;
  Object.assign(person, Ize(identity.name), { name: identity.name, gpmHistoricalPerson: identityId });
  return true;
}

function gpmAssignOpeningRegisterPeople(sim) {
  for (const [key, register] of Object.entries(gpmRegisterPersonData.countries)) {
    const country = sim.countries.get(key);
    if (!country?.pol?.parties?.length) continue;

    const assigned = new Map();
    const occupied = new Set([country.leaderId, country.headGovId, country.monarchId, country.regentId, ...country.cabinetIds || []]);
    for (const office of Object.values(lt(country)?.offices || {})) {
      occupied.add(office.principal?.personId);
      occupied.add(office.acting?.personId);
    }
    for (const [role, identityId] of register.executive) {
      const holder = j0(sim, country, role, { exercising: false });
      if (assigned.has(identityId) || holder?.countryKey !== country.key) continue;
      if (gpmApplyOpeningPersonIdentity(holder, identityId)) assigned.set(identityId, holder);
    }

    const knownParties = new Set(country.pol.parties.map(party => party.id));
    for (const [partyId, heads] of register.heads) {
      if (!knownParties.has(partyId)) continue;
      for (const [order, identityId] of heads.entries()) {
        let person = assigned.get(identityId);
        if (!person) {
          person = (country.partyBench?.[partyId] || []).map(id => sim.people.get(id)).find(candidate =>
            candidate?.alive && candidate.countryKey === country.key && candidate.party === partyId &&
            !occupied.has(candidate.id) && !candidate.gpmHistoricalPerson);
          person ||= $3t(sim, country, partyId);
          if (!gpmApplyOpeningPersonIdentity(person, identityId)) continue;
          assigned.set(identityId, person);
          occupied.add(person.id);
        }
        if (!person.gpmRegisterChair && person.party === partyId) person.gpmRegisterChair = { partyId, order, affiliations: [] };
        const chair = person.gpmRegisterChair;
        if (chair && person.alive && chair.partyId === person.party) chair.affiliations.push({ partyId, order });
      }
    }
  }
}

function gpmOpeningRegisterPartyCards(view, party) {
  const kind = party.nameDesc?.gpmOpeningKind;
  if (kind === "aggregate") return "";
  const bench = view.player.partyBench?.[party.id] || [];
  const render = people => people.map(person => pm(view, person, "", "")).join("");
  const benchPeople = ids => ids.map(id => view.people.get(id)).filter(Boolean);
  if (!kind) return render(benchPeople(bench.slice(0, 2)));

  // Index once per people snapshot, including named leaders displaced from the native bench.
  let index = gpmOpeningRegisterPartyIndexes.get(view.people);
  if (!index) {
    index = new Map();
    for (const person of view.people.values()) {
      const chair = person.gpmRegisterChair;
      if (!chair) continue;
      for (const { partyId, order } of chair.affiliations || [chair]) {
        if (!index.has(partyId)) index.set(partyId, []);
        index.get(partyId).push({ id: person.id, order });
      }
    }
    gpmOpeningRegisterPartyIndexes.set(view.people, index);
  }

  const current = person => person.alive && person.countryKey === view.player.key && person.party === party.id;
  const visibleBench = ids => benchPeople(ids).filter(person => !person.gpmRegisterChair || current(person));
  const leaders = [...(index.get(party.id) || [])].sort((a, b) => a.order - b.order).map(({ id }) => view.people.get(id))
    .filter(person => person?.alive && person.countryKey === view.player.key && person.gpmRegisterChair?.partyId === person.party);
  if (!leaders.length) return render(visibleBench(bench.slice(0, 2)));

  const featured = new Set(leaders.map(person => person.id));
  const people = [...leaders, ...visibleBench(bench.filter(id => !featured.has(id)))];
  return render(people.slice(0, Math.max(2, leaders.length)));
}

function openingPeopleData(data) {
  const people = Object.fromEntries(Object.entries(data.people).map(([id, person]) => [id, { name: person.name }]));
  const countries = Object.fromEntries(Object.entries(data.countries).map(([key, country]) => {
    const executive = [
      ["head_of_state", country.executive?.headOfState],
      ["head_of_gov", country.executive?.headOfGovernment],
    ].filter(([, identityId]) => Object.hasOwn(people, identityId));
    const heads = new Map();
    for (const chamber of Object.values(country.chambers || {})) {
      for (const row of chamber.rows) {
        if (row.kind === "aggregate" || row.kind === "vacancy") continue;
        const identities = (row.heads || []).filter(id => Object.hasOwn(people, id));
        if (!identities.length) continue;
        if (!heads.has(row.id)) heads.set(row.id, { kind: row.kind, identities: new Set() });
        for (const id of identities) heads.get(row.id).identities.add(id);
      }
    }
    // A shared chair is attached to their party actor before linking the parliamentary bloc.
    const affiliations = [...heads].sort(([, a], [, b]) => Number(a.kind === "parliamentary bloc") - Number(b.kind === "parliamentary bloc"));
    return [key, { executive, heads: affiliations.map(([id, { identities }]) => [id, [...identities]]) }];
  }));
  return { countries, people };
}

function patchRegisterPeopleWorker(source, replaceOnce, data) {
  const anchor = "function $3t(e,t,a){";
  let patched = replaceOnce(source, anchor,
    `const gpmRegisterPersonData = ${JSON.stringify(openingPeopleData(data))};\n` +
    `${gpmApplyOpeningPersonIdentity}\n${gpmAssignOpeningRegisterPeople}\n${anchor}`);
  const capture = "!o&&gpmUprising.captureStartingIdentities(b)";
  return replaceOnce(patched, capture, "!o&&gpmAssignOpeningRegisterPeople(b)," + capture);
}

function patchRegisterPeopleRenderer(source, replaceOnce) {
  const partyCard = 'function pm(e,t,a,n=""){';
  const patched = replaceOnce(source, partyCard,
    `const gpmOpeningRegisterPartyIndexes = new WeakMap();\n${gpmOpeningRegisterPartyCards}\n${partyCard}`);
  const partyBench = 'g=(e.player.partyBench?.[i.id]||[]).slice(0,2).map(v=>e.people.get(v)).filter(Boolean).map(v=>pm(e,v,"","")).join("")';
  const withCards = replaceOnce(patched, partyBench, "g=gpmOpeningRegisterPartyCards(e,i)");
  const portrait = "const person=gpmHistoricalPeople[e?.gpmHistoricalPerson];if(person)return gpmHistoricalAssetUrl(person.asset);";
  return replaceOnce(withCards, portrait,
    'const person=gpmHistoricalPeople[e?.gpmHistoricalPerson];if(person){const url=gpmHistoricalAssetUrl(person.asset);' +
    'if(url||!String(e.gpmHistoricalPerson).startsWith("reg-"))return url;}');
}

module.exports = { patchRegisterPeopleWorker, patchRegisterPeopleRenderer };

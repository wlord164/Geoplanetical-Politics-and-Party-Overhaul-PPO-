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
    if (!country?.pol) continue;

    const assigned = new Map();
    const occupied = new Set([country.leaderId, country.headGovId, country.monarchId, country.regentId, ...country.cabinetIds || []]);
    const nativeOffices = lt(country)?.offices || {};
    const headOfStateOffice = Xe(country, "head_of_state");
    const headOfStatePerson = nativeOffices[headOfStateOffice]?.principal?.personId;
    for (const office of Object.values(nativeOffices)) {
      occupied.add(office.principal?.personId);
      occupied.add(office.acting?.personId);
    }
    const supplemental = [];
    for (const [role, identityId] of register.executive) {
      if (assigned.has(identityId)) continue;
      const officeId = Xe(country, role);
      const holderId = nativeOffices[officeId]?.principal?.personId;
      // A constitutional alias does not provide a separate seat for a distinct prime minister.
      const sharedOffice = role === "head_of_gov" &&
        (officeId === headOfStateOffice || holderId === headOfStatePerson);
      const holder = sharedOffice ? null : sim.people.get(holderId);
      if (holder?.countryKey === country.key && gpmApplyOpeningPersonIdentity(holder, identityId)) {
        assigned.set(identityId, holder);
      } else {
        supplemental.push([role, identityId]);
      }
    }

    const knownParties = new Set((country.pol.parties || []).map(party => party.id));
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
        if (!person.gpmRegisterChair) person.gpmRegisterChair = { partyId: person.party ?? null, order, affiliations: [] };
        const chair = person.gpmRegisterChair;
        if (person.alive && chair.partyId === (person.party ?? null)) chair.affiliations.push({ partyId, order });
      }
    }

    // Keep real opening officeholders visible when the game has no distinct matching office.
    for (const [role, identityId] of supplemental) {
      const identity = gpmRegisterPersonData.people[identityId];
      let person = assigned.get(identityId);
      if (!person) {
        person = C0(sim, { countryKey: country.key, name: identity.name });
        if (!gpmApplyOpeningPersonIdentity(person, identityId)) continue;
        assigned.set(identityId, person);
      }
      person.gpmRegisterOpeningOffice = { role, label: identity.role };
    }
  }
}

function gpmOpeningRegisterPartyCards(view, party) {
  const kind = party.nameDesc?.gpmOpeningKind;
  if (kind === "aggregate") return "";
  const bench = view.player.partyBench?.[party.id] || [];
  const render = people => people.map(person =>
    pm(view, person, gpmOpeningRegisterRoles[person.gpmHistoricalPerson] || "")).join("");
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
        const key = person.countryKey + "/" + partyId;
        if (!index.has(key)) index.set(key, []);
        index.get(key).push({ id: person.id, order });
      }
    }
    gpmOpeningRegisterPartyIndexes.set(view.people, index);
  }

  const current = person => person.alive && person.countryKey === view.player.key && person.party === party.id;
  const visibleBench = ids => benchPeople(ids).filter(person => !person.gpmRegisterChair || current(person));
  const leaders = [...(index.get(view.player.key + "/" + party.id) || [])].sort((a, b) => a.order - b.order).map(({ id }) => view.people.get(id))
    .filter(person => person?.alive && person.countryKey === view.player.key &&
      person.gpmRegisterChair?.partyId === (person.party ?? null));
  if (!leaders.length) return render(visibleBench(bench.slice(0, 2)));

  return render(leaders);
}

function gpmOpeningRegisterGovernmentCards(view) {
  const country = view.player;
  const booked = new Set([
    country.headOfGovernmentId, country.headOfStateId, country.deputyId, ...(country.cabinetIds || []),
  ]);
  return [...view.people.values()].filter(person => person.alive && person.countryKey === country.key &&
    person.gpmRegisterOpeningOffice && !booked.has(person.id)).map(person => {
    const { role, label } = person.gpmRegisterOpeningOffice;
    const title = label || (role === "head_of_gov" ? "Head of government" : "Head of state");
    return pm(view, person, "Opening " + title);
  }).join("");
}

function openingPeopleData(data) {
  const people = Object.fromEntries(Object.entries(data.people).map(([id, person]) =>
    [id, { name: person.name, role: person.role }]));
  const countries = Object.fromEntries(Object.entries(data.countries).map(([key, country]) => {
    const offices = country.executive || {};
    const executive = [
      ["head_of_state", offices.headOfState],
      ["head_of_gov", offices.primeMinister || offices.headOfGovernment],
      ["council_chair", offices.councilChair],
    ].filter(([, identityId]) => Object.hasOwn(people, identityId));
    const heads = new Map();
    const rows = Object.values(country.chambers || {}).flatMap(chamber => chamber.rows);
    rows.push(...Object.entries(country.stockParties || {}).map(([id, row]) => ({ ...row, id })));
    for (const row of rows) {
      if (row.kind === "aggregate" || row.kind === "vacancy") continue;
      const identities = (row.heads || []).filter(id => Object.hasOwn(people, id));
      if (!identities.length) continue;
      if (!heads.has(row.id)) heads.set(row.id, { kind: row.kind, identities: new Set() });
      for (const id of identities) heads.get(row.id).identities.add(id);
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

function patchRegisterPeopleRenderer(source, replaceOnce, data) {
  const partyCard = 'function pm(e,t,a,n=""){';
  const roles = {};
  for (const [id, person] of Object.entries(data.people)) {
    const label = person.role?.split(/ · |\. /u, 1)[0]
      .replace(/ at (?:the )?cutoff(?:,.*)?$/iu, "").trim();
    if (label && !/[{}|]|\blisted\b|\bper electoral register\b|\breported in\b/iu.test(label)) roles[id] = label;
  }
  const patched = replaceOnce(source, partyCard,
    `const gpmOpeningRegisterPartyIndexes = new WeakMap();\n` +
    `const gpmOpeningRegisterRoles = ${JSON.stringify(roles)};\n` +
    `${gpmOpeningRegisterPartyCards}\n${gpmOpeningRegisterGovernmentCards}\n${partyCard}`);
  const partyBench = 'g=(e.player.partyBench?.[i.id]||[]).slice(0,2).map(v=>e.people.get(v)).filter(Boolean).map(v=>pm(e,v,"","")).join("")';
  const withCards = replaceOnce(patched, partyBench, "g=gpmOpeningRegisterPartyCards(e,i)");
  const government = '${h&&h.id!==g?pm(t,h,o("role."+DK(a.constitution)+(h.g==="f"?".f":""))):""}';
  const withGovernment = replaceOnce(withCards, government, government + '${gpmOpeningRegisterGovernmentCards(t)}');
  const portrait = "const person=gpmHistoricalPeople[e?.gpmHistoricalPerson];if(person)return gpmHistoricalAssetUrl(person.asset);";
  return replaceOnce(withGovernment, portrait,
    'const person=gpmHistoricalPeople[e?.gpmHistoricalPerson];if(person){const url=gpmHistoricalAssetUrl(person.asset);' +
    'if(url||!String(e.gpmHistoricalPerson).startsWith("reg-"))return url;}');
}

module.exports = { patchRegisterPeopleWorker, patchRegisterPeopleRenderer };

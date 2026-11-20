"use strict";

const governmentRegister = require("./opening-register-government.json");

function gpmApplyOpeningPersonIdentity(person, identityId) {
  const identity = gpmRegisterPersonData.people[identityId];
  if (!identity || !person?.alive || (person.gpmHistoricalPerson && person.gpmHistoricalPerson !== identityId)) return false;
  Object.assign(person, Ize(identity.name), { name: identity.name, gpmHistoricalPerson: identityId });
  if (identity.biography) {
    person.g = identity.biography.gender;
    person.born = identity.biography.born;
  }
  return true;
}

function gpmApplyIllustratedRepresentative(person, illustration) {
  Object.assign(person, Ize(illustration.name), { name: illustration.name, g: illustration.gender });
}

function gpmRestoreRegisterPortraitPeople(sim) {
  for (const person of sim.people.values()) {
    const biography = gpmRegisterPersonData.people[person.gpmHistoricalPerson]?.biography;
    if (biography) {
      person.g = biography.gender;
      person.born = biography.born;
    }
    const chair = person.gpmRegisterChair;
    if (!chair?.fictionalRepresentative || chair.illustration !== person.countryKey + "/" + chair.partyId) continue;
    const illustration = gpmRegisterPersonData.illustrations[chair.illustration];
    if (!illustration) continue;
    if (person.name === illustration.legacyName) gpmApplyIllustratedRepresentative(person, illustration);
  }
}

function gpmOpeningOfficeHolder(country, role) {
  const office = H7(country, role);
  const mandate = office?.mandate;
  return office?.status === "occupied" && !office.acting && mandate?.startedDay === 0 &&
    mandate.ordinal === 1 && !mandate.sourceContestId && !mandate.sourceProcedureId
    ? office.principal?.personId : null;
}

function gpmRegisterExecutiveOffices(country, executive) {
  const offices = new Map();
  for (const [role, identityId] of executive) {
    const resolved = Xe(country, role) || (role === "council_chair" ? y1(country) : null);
    if (resolved && !offices.has(resolved)) offices.set(resolved, identityId);
  }
  return offices;
}

function gpmRegisterPersonSequence(person) {
  return Number(person.id.split(":").at(-1));
}

function gpmOriginalExecutivePerson(country, person) {
  if (person.seeded && person.name === ad.seed[country.key]?.name) return true;
  if (person.seeded && person.role === "monarch" && person.name === ad.monarchSeed?.[country.key]?.name &&
      person._seed === Hu(country.key + ":crown")) return true;
  return person._seed === Hu(country.key + ":headgov:2026:" + (gpmRegisterPersonSequence(person) - 1));
}

function gpmMoveMisassignedDeputyChair(sim, country, deputy, replacementId, heads) {
  const identityId = deputy.gpmHistoricalPerson;
  const chair = deputy.gpmRegisterChair;
  if (!gpmRegisterPersonData.people[replacementId] || !identityId || identityId === replacementId ||
      !chair || chair.partyId !== deputy.party ||
      !heads.some(([partyId, identities]) => partyId === deputy.party && identities.includes(identityId))) return;
  const chairActor = $3t(sim, country, chair.partyId);
  if (!gpmApplyOpeningPersonIdentity(chairActor, identityId)) return;
  chairActor.gpmRegisterChair = chair;
  delete deputy.gpmRegisterChair;
  delete deputy.gpmHistoricalPerson;
}

function gpmAssignOpeningGovernment(sim, country, register, restoring) {
  const { government, heads } = register;
  if (!government) return;
  const deputy = sim.people.get(country.deputyId);
  const chief = sim.people.get(country.militaryLoyalty?.chiefId);
  const validPerson = (person, role) => person?.alive && person.role === role && person.countryKey === country.key;
  const poolSeed = (person, slot) => Hu(country.key + ":pool:" + slot + ":" + (gpmRegisterPersonSequence(person) - 1));
  const initialDeputy = validPerson(deputy, "deputy") && deputy._seed === poolSeed(deputy, "deputy");
  const initialGovernment = gpmOpeningOfficeHolder(country, y1(country)) && Dn(country)?.installedDay === 0;
  if (validPerson(deputy, "deputy") && (!restoring || (initialGovernment && initialDeputy))) {
    if (restoring) gpmMoveMisassignedDeputyChair(sim, country, deputy, government.deputy, heads);
    gpmApplyOpeningPersonIdentity(deputy, government.deputy);
  }
  for (const id of country.cabinetIds || []) {
    const minister = sim.people.get(id);
    if (!validPerson(minister, "minister")) continue;
    const portfolio = nw.indexOf(minister.office);
    const initialMinister = portfolio >= 0 && minister._seed === poolSeed(minister, "min" + portfolio) &&
      (sim.day === 0 || (initialDeputy &&
        gpmRegisterPersonSequence(minister) === gpmRegisterPersonSequence(deputy) + 1 + portfolio));
    if (!restoring || (initialGovernment && initialMinister)) {
      gpmApplyOpeningPersonIdentity(minister, government[minister.office]);
    }
  }
  if (!validPerson(chief, "chief_of_staff")) return;
  if (restoring) {
    const initialChief = person => person._seed === Ma("chief:" + country.key + ":0:" + (gpmRegisterPersonSequence(person) - 1));
    if (!initialChief(chief)) return;
    for (const person of sim.people.values()) {
      if (person.countryKey === country.key && gpmRegisterPersonSequence(person) < gpmRegisterPersonSequence(chief) &&
          initialChief(person)) return;
    }
  }
  gpmApplyOpeningPersonIdentity(chief, government.chief_of_staff);
}

function gpmOpeningExecutiveDisplay(sim, country, actor) {
  if (!country || !actor?.alive) return actor;
  const domestic = actor.countryKey === country.key;
  if (domestic && actor.gpmHistoricalPerson) return actor;
  const executive = gpmRegisterPersonData.countries[country.key]?.executive;
  if (!executive) return actor;
  const offices = gpmRegisterExecutiveOffices(country, executive);
  if (domestic && offices.size < 2) return actor;
  const target = [...offices].find(([role]) => {
    if (gpmOpeningOfficeHolder(country, role) === actor.id) return true;
    if (domestic) return false;
    const office = H7(country, role);
    return office?.status === "occupied" && !office.acting && office.principal?.personId === actor.id &&
      office.mandate?.startedDay === 0 && office.mandate.sourceProcedureId === "sovereign-office";
  });
  if (!target) return actor;
  if (!domestic) {
    if (actor.gpmHistoricalPerson === target[1]) return actor;
    // The local officeholder can be displayed without renaming a person shared with another country.
    for (const person of sim.people.values()) {
      if (person.alive && person.countryKey === country.key && person.gpmRegisterOpeningOffice &&
          person.gpmHistoricalPerson === target[1]) return person;
    }
    return actor;
  }
  for (const [role, identityId] of offices) {
    if (role === target[0] || identityId !== target[1]) continue;
    const named = sim.people.get(gpmOpeningOfficeHolder(country, role));
    if (named?.alive && named.countryKey === country.key && named.gpmHistoricalPerson === identityId) {
      return { ...actor, name: named.name, given: named.given, surname: named.surname,
        g: named.g, born: named.born, gpmHistoricalPerson: identityId };
    }
  }
  return actor;
}

function gpmOpeningAliasedGovernment(sim, country) {
  const executive = gpmRegisterPersonData.countries[country.key]?.executive;
  if (!executive) return null;
  const state = executive.find(([role]) => role === "head_of_state")?.[1];
  const government = executive.find(([role]) => role === "head_of_gov")?.[1];
  if (!state || !government || state === government) return null;
  const holderId = gpmOpeningOfficeHolder(country, "head_of_state");
  if (!holderId || holderId !== gpmOpeningOfficeHolder(country, "head_of_gov")) return null;
  const holder = sim.people.get(holderId);
  if (!holder?.alive || holder.gpmHistoricalPerson !== state) return null;

  const { name, role } = gpmRegisterPersonData.people[government];
  const opening = { id: government, name, role };
  for (const person of sim.people.values()) {
    if (person.countryKey === country.key && person.gpmHistoricalPerson === government &&
        person.gpmRegisterOpeningOffice?.role === "head_of_gov") return { ...opening, personId: person.id };
  }
  return opening;
}

function gpmAssignOpeningRegisterPeople(sim, restoring) {
  if (restoring) gpmRestoreRegisterPortraitPeople(sim);
  for (const [key, register] of Object.entries(gpmRegisterPersonData.countries)) {
    const country = sim.countries.get(key);
    if (!country?.pol) continue;

    const assigned = new Map();
    const occupied = new Set([
      country.leaderId, country.headGovId, country.monarchId, country.regentId,
      country.deputyId, country.partyDeputyId, country.militaryLoyalty?.chiefId, ...(country.cabinetIds || []),
    ]);
    const nativeOffices = lt(country)?.offices || {};
    for (const office of Object.values(nativeOffices)) {
      occupied.add(office.principal?.personId);
      occupied.add(office.acting?.personId);
    }
    const supplemental = [];
    const executiveOffices = gpmRegisterExecutiveOffices(country, register.executive);
    for (const [role, identityId] of executiveOffices) {
      if (assigned.has(identityId)) continue;
      const holderId = restoring ? gpmOpeningOfficeHolder(country, role) : nativeOffices[role]?.principal?.personId;
      const holder = sim.people.get(holderId);
      if (holder?.countryKey !== country.key) continue;
      if (restoring && !holder.gpmHistoricalPerson && sim.day !== 0 && !gpmOriginalExecutivePerson(country, holder)) continue;
      if (gpmApplyOpeningPersonIdentity(holder, identityId)) assigned.set(identityId, holder);
    }
    gpmAssignOpeningGovernment(sim, country, register, restoring);
    if (restoring) continue;

    for (const [role, identityId] of register.executive) {
      if (!assigned.has(identityId)) supplemental.push([role, identityId]);
    }
    for (const identityId of register.coOfficeholders) {
      supplemental.push(["co_executive", identityId]);
    }

    const knownParties = new Set((country.pol.parties || []).map(party => party.id));
    for (const [partyId, heads, fictionalRepresentative] of register.heads) {
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
      if (fictionalRepresentative) {
        const representative = $3t(sim, country, partyId);
        if (representative) {
          const illustration = gpmRegisterPersonData.illustrations[fictionalRepresentative.illustration];
          if (illustration) gpmApplyIllustratedRepresentative(representative, illustration);
          representative.gpmRegisterChair = {
            partyId, order: heads.length, affiliations: [{ partyId, order: heads.length }], fictionalRepresentative: true,
            illustration: fictionalRepresentative.illustration,
          };
        }
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
  if (["aggregate", "unaffiliated", "affiliation-unverified"].includes(kind)) return "";
  const bench = view.player.partyBench?.[party.id] || [];
  const render = people => people.map(person =>
    pm(view, person, person.gpmRegisterChair?.fictionalRepresentative
      ? "Fictional party representative" : gpmOpeningRegisterRoles[person.gpmHistoricalPerson] || "")).join("");
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
    country.headOfGovernmentId, country.headOfStateId, country.headOfGovernment?.id, country.headOfState?.id,
    country.deputyId, ...(country.cabinetIds || []),
  ]);
  return [...view.people.values()].filter(person => person.alive && person.countryKey === country.key &&
    person.gpmRegisterOpeningOffice && !booked.has(person.id)).map(person => {
    const { role, label } = person.gpmRegisterOpeningOffice;
    const title = label || (role === "head_of_gov" ? "Head of government" : "Head of state");
    return pm(view, person, "Opening " + title);
  }).join("");
}

function gpmOpeningRepresentativeCards(view) {
  const { key, deputyId, cabinetIds } = view.player;
  const entries = gpmOpeningRepresentatives.portraits[key];
  if (!entries?.length) return "";
  const cabinet = new Set([deputyId, ...(cabinetIds || [])].map(id => view.people.get(id)?.gpmHistoricalPerson).filter(Boolean));
  const portraits = entries.filter(person => !cabinet.has(person.identityId));
  if (!portraits.length) return "";
  return `<section class="mcard wide" data-gpm-opening-representatives>
    <div class="gov-section-head"><h3>Opening representatives</h3></div>
    <div class="gov-members">${portraits.map(person => `<div class="k k-ghost gov-person" data-gpm-opening-representative>
      <span class="gov-face"><img src="${b(gpmHistoricalAssetUrl(person.portrait.asset))}" alt=""></span>
      <span class="gov-person-copy"><small>${b(person.role)}</small><b>${b(person.name)}</b></span>
    </div>`).join("")}</div></section>`;
}

function openingPeopleData(data) {
  const people = Object.fromEntries(Object.entries({ ...data.people, ...governmentRegister.people }).map(([id, person]) =>
    [id, { name: person.name, role: person.executiveRole?.role || person.role, biography: person.biography }]));
  const illustrations = Object.fromEntries(Object.entries(data.countries).flatMap(([key, country]) =>
    Object.entries(country.fictionalOpeningPortraits || {})
      .map(([partyId, portrait]) => [key + "/" + partyId, portrait.person])));
  const countryKeys = new Set([...Object.keys(data.countries), ...Object.keys(governmentRegister.countries)]);
  const countries = Object.fromEntries([...countryKeys].map(key => {
    const country = data.countries[key] || {};
    const offices = country.executive || {};
    const executive = [
      ["head_of_state", offices.headOfState],
      ["head_of_gov", offices.primeMinister || offices.headOfGovernment],
      ["council_chair", offices.councilChair],
    ].filter(([, identityId]) => Object.hasOwn(people, identityId));
    const heads = new Map();
    const illustratedParties = new Set(country.illustratedOpeningParties || []);
    const rows = Object.values(country.chambers || {}).flatMap(chamber => chamber.rows);
    rows.push(...Object.entries(country.stockParties || {}).map(([id, row]) => ({ ...row, id })));
    for (const row of rows) {
      if (row.kind === "aggregate" || row.kind === "vacancy") continue;
      const identities = [...(row.heads || []), ...(row.parliamentaryHeads || [])].filter(id => Object.hasOwn(people, id));
      if (!identities.length && !illustratedParties.has(row.id)) continue;
      if (!heads.has(row.id)) heads.set(row.id, { kind: row.kind, identities: new Set() });
      for (const id of identities) heads.get(row.id).identities.add(id);
    }
    // A shared chair is attached to their party actor before linking the parliamentary bloc.
    const affiliations = [...heads].sort(([, a], [, b]) => Number(a.kind === "parliamentary bloc") - Number(b.kind === "parliamentary bloc"));
    const government = governmentRegister.countries[key]?.government;
    const coOfficeholders = (country.executiveCoOfficeholders || []).filter(id => Object.hasOwn(people, id));
    return [key, { executive, coOfficeholders, government,
      heads: affiliations.map(([id, { identities }]) => [id, [...identities], illustratedParties.has(id) ? {
        illustration: country.fictionalOpeningPortraits?.[id] ? key + "/" + id : null,
      } : null]) }];
  }));
  return { countries, people, illustrations };
}

function patchRegisterPeopleWorker(source, replaceOnce, data) {
  const anchor = "function $3t(e,t,a){";
  let patched = replaceOnce(source, anchor,
    `const gpmRegisterPersonData = ${JSON.stringify(openingPeopleData(data))};\n` +
    [gpmApplyOpeningPersonIdentity, gpmApplyIllustratedRepresentative, gpmRestoreRegisterPortraitPeople,
      gpmOpeningOfficeHolder, gpmRegisterExecutiveOffices, gpmRegisterPersonSequence,
      gpmOriginalExecutivePerson, gpmMoveMisassignedDeputyChair, gpmAssignOpeningGovernment,
      gpmOpeningExecutiveDisplay, gpmOpeningAliasedGovernment, gpmAssignOpeningRegisterPeople, anchor].join("\n"));
  const capture = "!o&&gpmUprising.captureStartingIdentities(b)";
  patched = replaceOnce(patched, capture, "gpmAssignOpeningRegisterPeople(b,!!o)," + capture);
  patched = replaceOnce(patched, "nationalExecutive:x0(p),headOfGovernment:x0(d),headOfState:x0(u)",
    "nationalExecutive:x0(gpmOpeningExecutiveDisplay(e,o,p)),headOfGovernment:x0(gpmOpeningExecutiveDisplay(e,o,d)),headOfState:x0(gpmOpeningExecutiveDisplay(e,o,u)),gpmOpeningHeadOfGovernment:gpmOpeningAliasedGovernment(e,o)");
  patched = replaceOnce(patched, "leader:o?Object.freeze(x0(o)):null,executiveLeader:n?Object.freeze(x0(n)):null,playerControl:r",
    "leader:o?Object.freeze(x0(gpmOpeningExecutiveDisplay(e,a,o))):null,executiveLeader:n?Object.freeze(x0(gpmOpeningExecutiveDisplay(e,a,n))):null,playerControl:r");
  patched = replaceOnce(patched, "headOfGovernment:x0(j0(e,t,\"head_of_gov\")),headOfStateId:ft(t,\"head_of_state\"),headOfState:x0(j0(e,t,\"head_of_state\"))",
    "headOfGovernment:x0(gpmOpeningExecutiveDisplay(e,t,j0(e,t,\"head_of_gov\"))),headOfStateId:ft(t,\"head_of_state\"),headOfState:x0(gpmOpeningExecutiveDisplay(e,t,j0(e,t,\"head_of_state\")))");
  patched = replaceOnce(patched, "representative:x0(o),sanctionDrag:",
    "representative:x0(gpmOpeningExecutiveDisplay(e,a,o)),sanctionDrag:");
  patched = replaceOnce(patched, "n.headOfState=hhe(l),n.headOfGovernment=hhe(c)",
    "n.headOfState=hhe(gpmOpeningExecutiveDisplay(e,t,l)),n.headOfGovernment=hhe(gpmOpeningExecutiveDisplay(e,t,c))");
  patched = replaceOnce(patched, ".filter(y=>y&&(y.countryKey===t.key||y.id===i)).map(hhe)",
    ".filter(y=>y&&(y.countryKey===t.key||y.id===i)).map(y=>hhe(y.countryKey===t.key&&(y.id===i||y.id===s)?gpmOpeningExecutiveDisplay(e,t,y):y))");
  return replaceOnce(patched, "person:hhe(a),people:[...i].map(d=>hhe(e.people?.get?.(d))).filter(Boolean)",
    "person:hhe(gpmOpeningExecutiveDisplay(e,n,a)),people:[...i].map(d=>hhe(gpmOpeningExecutiveDisplay(e,n,e.people?.get?.(d)))).filter(Boolean)");
}

function patchRegisterPeopleRenderer(source, replaceOnce, data) {
  const partyCard = 'function pm(e,t,a,n=""){';
  const roles = {};
  for (const [id, person] of Object.entries({ ...data.people, ...governmentRegister.people })) {
    const label = person.role?.split(/ · |\. /u, 1)[0]
      .replace(/ at (?:the )?cutoff(?:,.*)?$/iu, "").trim();
    if (label && !/[{}|]|\blisted\b|\bper electoral register\b|\breported in\b/iu.test(label)) roles[id] = label;
  }
  const patched = replaceOnce(source, partyCard,
    `const gpmOpeningRegisterPartyIndexes = new WeakMap();\n` +
    `const gpmOpeningRegisterRoles = ${JSON.stringify(roles)};\n` +
    `${gpmOpeningRegisterPartyCards}\n${gpmOpeningRegisterGovernmentCards}\n${gpmOpeningRepresentativeCards}\n${partyCard}`);
  const partyBench = 'g=(e.player.partyBench?.[i.id]||[]).slice(0,2).map(v=>e.people.get(v)).filter(Boolean).map(v=>pm(e,v,"","")).join("")';
  const withCards = replaceOnce(patched, partyBench, "g=gpmOpeningRegisterPartyCards(e,i)");
  const government = '${h&&h.id!==g?pm(t,h,o("role."+DK(a.constitution)+(h.g==="f"?".f":""))):""}';
  let withGovernment = replaceOnce(withCards, government, government + '${gpmOpeningRegisterGovernmentCards(t)}');
  const cabinet = '${pFe(this,t,s)}';
  withGovernment = replaceOnce(withGovernment, cabinet, cabinet + '${gpmOpeningRepresentativeCards(t)}');
  withGovernment = replaceOnce(withGovernment, 'd&&l.push(pm(t,d,a));for(let h of t.player.cabinetIds',
    'd&&l.push(pm(t,d,gpmOpeningRegisterRoles[d.gpmHistoricalPerson]||a));for(let h of t.player.cabinetIds');
  withGovernment = replaceOnce(withGovernment, 'y=pm(t,f,g),v=r.get(String(h))',
    'y=pm(t,f,gpmOpeningRegisterRoles[f.gpmHistoricalPerson]||g),v=r.get(String(h))');
  return replaceOnce(withGovernment, 'pm(t,p,o("fiche.role.chief_of_staff"),',
    'pm(t,p,gpmOpeningRegisterRoles[p.gpmHistoricalPerson]||o("fiche.role.chief_of_staff"),');
}

module.exports = { patchRegisterPeopleWorker, patchRegisterPeopleRenderer };

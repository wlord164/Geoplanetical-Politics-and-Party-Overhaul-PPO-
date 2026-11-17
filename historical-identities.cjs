"use strict";

const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const assetTypes = { jpg: "jpeg", jpeg: "jpeg", png: "png", webp: "webp" };

const historicalNamePools = {
  // Igbo personal names and surnames documented in https://philarchive.org/archive/IBETOA
  // and https://www.mdpi.com/2313-5778/10/3/100.
  "ucdp-actor-6287": {
    m: ["Chinedu", "Nnamdi", "Chukwuemeka", "Ikenna", "Obinna", "Ifeanyi", "Uchenna", "Chukwudi"],
    f: ["Adaeze", "Adanna", "Amaka", "Chinasa", "Nkechi", "Ifeoma", "Chiamaka", "Nneka"],
    family: ["Nwosu", "Okafor", "Nnaji", "Obiwuru", "Eze", "Nwankwo", "Okonkwo", "Nwafor"],
  },
  // Balochi given names and tribal surnames from Sabir Badalkhan's fieldwork
  // Language Contact in Balochistan and Its Impact on Balochi Personal Names and
  // https://doi.org/10.34158/ONOMA.60/2025/12.
  "ucdp-actor-7542": {
    m: ["Chakar", "Bibrak", "Bizan", "Bijar", "Mayar", "Rasuljan", "Alibaksh", "Durrjan"],
    f: ["Mahal", "Mahrang", "Mahgul", "Durren", "Gulbahar", "Parinaz", "Gulbibi", "Shahrbano"],
    family: ["Baloch", "Dashti", "Lashari", "Buledi", "Magsi", "Mazari", "Kalmati", "Rind"],
  },
  // Tuareg personal names documented by Mohamed and Bernus. The surnames model
  // the attested ag/oult patronymic in a spelling suitable for the game interface.
  // https://doi.org/10.4000/echogeo.20218
  // https://ressources.ingall-niger.org/documents/livres/ighazer_uniteculturelle_bernus.pdf
  // https://hcamazighite.dz/docs/document/publications2023/actes_boumerdes.pdf
  "ucdp-actor-8822": {
    m: ["Bodal", "Bedrun", "Abarad", "Bazo", "Musa", "Sidi", "Amud", "Iddar"],
    f: ["Away Fati", "Gheishatu", "Mariama", "Taghmet", "Tawaqqast", "Tahamud", "Tiddar", "Tannalxer"],
    family: ["Mokhammed", "Akhmed", "Musa", "Sidi", "Gheli", "Ghabiden", "Bodal", "Ghalisun"],
    patronymic: { m: "ag", f: "oult" },
  },
};

function gpmHistoricalGeneratedName(countryKey, gender, seed, inheritedSurname) {
  let key = countryKey;
  let nested;
  while ((nested = /^ppo-uprising-(.+)-\d+$/.exec(key))) key = nested[1];
  const actorId = /^gpm-historical-(?:polity-)?(ucdp-actor-\d+)$/.exec(key)?.[1];
  const pool = gpmHistoricalNamePools[actorId];
  if (!pool) return null;

  const sex = gender === "f" ? "f" : "m";
  const given = pool[sex][(Lu(`${seed}:given`) >>> 16) % pool[sex].length];
  const family = pool.family[(Lu(`${seed}:family`) >>> 16) % pool.family.length];
  const surname = inheritedSurname ?? (pool.patronymic ? `${pool.patronymic[sex]} ${family}` : family);
  return { given, surname, name: surname ? `${given} ${surname}` : given };
}

function patchHistoricalNameWorker(source, replaceOnce) {
  const createPerson = 'function b0(e,t={}){';
  let patched = replaceOnce(source, createPerson,
    `const gpmHistoricalNamePools=${JSON.stringify(historicalNamePools)};\n${gpmHistoricalGeneratedName}\n${createPerson}`);
  patched = replaceOnce(patched, ':_A(d,l,r,t.surname!=null?t.surname:null),m={id:c',
    ':(gpmHistoricalGeneratedName(a,l,r,t.surname)||_A(d,l,r,t.surname!=null?t.surname:null)),m={id:c');
  return replaceOnce(patched, 'l=N7r(xl(e.key),s,i),c=r&&r.parties.find',
    'l=gpmHistoricalGeneratedName(e.key,s,i)||N7r(xl(e.key),s,i),c=r&&r.parties.find');
}

function readMedia({ file, source, credit, license, ...details }, actorId) {
  const path = typeof file === "string" && file.match(/^historical-identity-assets\/[a-z0-9][a-z0-9.-]*\.(jpg|jpeg|png|webp)$/);
  if (!path || !/^https:\/\//.test(source) || !credit || !license) {
    throw new Error("Invalid historical identity image: " + actorId);
  }
  const bytes = readFileSync(join(__dirname, file));
  if (!bytes.length) throw new Error("Empty historical identity image: " + file);
  return { ...details, source, credit, license, image: `data:image/${assetTypes[path[1]]};base64,${bytes.toString("base64")}` };
}

function readIdentities() {
  const identities = Object.create(null);
  const convention = JSON.parse(readFileSync(join(__dirname, "historical-flag-convention.json"), "utf8"));
  for (const name of ["sudan", "world", "independence", "opening"]) {
    const file = join(__dirname, `historical-identities-${name}.json`);
    const records = JSON.parse(readFileSync(file, "utf8"));
    for (const [id, record] of Object.entries(records)) {
      const identity = identities[id] ??= {};
      for (const office of ["leader", "headOfState", "headOfGovernment", "representative"]) {
        const person = record[office];
        if (!person) continue;
        if (Object.hasOwn(identity, office)) throw new Error("Duplicate historical identity: " + id + "/" + office);
        if (!person.name || !person.role || !/^https:\/\//.test(person.source) ||
            (office === "representative" && !person.portrait)) {
          throw new Error("Invalid historical leader: " + id + "/" + office);
        }
        identity[office] = { ...person,
          ...(person.portrait ? { portrait: readMedia(person.portrait, id) } : {}) };
      }
      for (const flag of ["flag", "administrationFlag", "victoryFlag"]) {
        if (!record[flag]) continue;
        if (Object.hasOwn(identity, flag)) throw new Error("Duplicate historical identity: " + id + "/" + flag);
        identity[flag] = readMedia(record[flag], id);
      }
    }
  }
  const flags = Object.fromEntries(Object.entries(convention.banners).map(([key, media]) => [key, readMedia(media, key)]));
  for (const [id, key] of Object.entries(convention.actors)) {
    if (!flags[key]) throw new Error("Unknown historical flag convention: " + id);
    const identity = identities[id] ??= {};
    identity.flag = flags[key];
  }
  return identities;
}

function readIdentityIllustrations() {
  const records = JSON.parse(readFileSync(join(__dirname, "historical-identity-illustrations.json"), "utf8"));
  if (!records || typeof records !== "object" || Array.isArray(records)) {
    throw new Error("Invalid historical dossier illustrations catalog");
  }
  return Object.fromEntries(Object.entries(records).map(([id, record]) => {
    const { file, fictionalName } = record || {};
    const extension = typeof file === "string" &&
      /^historical-identity-assets\/illustrative-[a-z0-9][a-z0-9.-]*\.(jpg|jpeg|png|webp)$/.exec(file)?.[1];
    if (!/^[a-z\d:-]+$/.test(id) || !extension ||
        (fictionalName !== undefined && (typeof fictionalName !== "string" || !fictionalName.trim()))) {
      throw new Error("Invalid historical dossier illustration: " + id);
    }
    const bytes = readFileSync(join(__dirname, file));
    if (!bytes.length) throw new Error("Empty historical dossier illustration: " + file);
    return [id, {
      image: `data:image/${assetTypes[extension]};base64,${bytes.toString("base64")}`,
      ...(fictionalName ? { fictionalName: fictionalName.trim() } : {}),
    }];
  }));
}

function gpmNativeHistoricalPortrait(person, year, fallbackIcon) {
  const tag = person?.gpmHistoricalPerson;
  const historical = gpmHistoricalPeople[tag];
  const actorId = historical && tag.endsWith(":leader") ? tag.slice(0, -":leader".length) : null;
  const illustration = actorId && !historical.image && gpmHistoricalDossierIllustrations[actorId];
  const representative = historical?.representative;
  const photo = representative?.image || illustration?.image || (historical && !historical.image ? loe(person, year) : rl(person, year));
  const note = representative ? `Photo: ${representative.name} (faction representative)` :
    illustration?.image ? "Illustrative portrait" : historical && !historical.image && photo ? "Game-generated portrait" : null;
  const title = representative ? [representative.name, representative.role, "Faction representative"].filter(Boolean).join(" · ") : note;
  return {
    html: photo ? `<img class="il-av" src="${v(photo)}" alt="${v(note || "")}"${title ? ` title="${v(title)}"` : ""}>` : fallbackIcon,
    note,
  };
}

function patchHistoricalIdentityRenderer(source, replaceOnce) {
  const identities = readIdentities();
  const people = Object.fromEntries(Object.entries(identities).flatMap(([actorId, identity]) =>
    ["leader", "headOfState", "headOfGovernment"].filter(office => identity[office]).map(office =>
      [`${actorId}:${office}`, { image: identity[office].portrait?.image || null, role: identity[office].role,
        representative: !identity[office].portrait && identity.representative ?
          { name: identity.representative.name, role: identity.representative.role, image: identity.representative.portrait.image } : null }])));
  const portraitSelector = 'function rl(e,t,a){';
  let patched = replaceOnce(source, portraitSelector,
    `const gpmHistoricalPeople = ${JSON.stringify(people)};\n${gpmNativeHistoricalPortrait}\n` +
    `${portraitSelector}const person=gpmHistoricalPeople[e?.gpmHistoricalPerson];if(person)return person.image;`);
  patched = replaceOnce(patched, 'let w=e.nationalExecutiveRoleId?o(', 'let w=gpmHistoricalPeople[n.gpmHistoricalPerson]?.role||(e.nationalExecutiveRoleId?o(');
  patched = replaceOnce(patched, ':o("inspector.leader.title"),k=t.year', ':o("inspector.leader.title")),k=t.year');
  patched = replaceOnce(patched, 'o("inspector.leader.age",{age:M}):""))}else a?',
    'o("inspector.leader.age",{age:M}):"")+(s.note?" · "+s.note:""))}else a?');
  patched = replaceOnce(patched, '_refreshInspector(e,t){this._iset("countryName",j(e,e.key)),this._iset("regimeName",U5(e));let a=e.pol,n=e.nationalExecutive,r=e.nationalExecutivePartyId||a?.government?.leadPartyId,i=a?.parties?.find(w=>w.id===r)||null;if(n)',
    '_refreshInspector(e,t){this._iset("countryName",j(e,e.key)),this._iset("regimeName",U5(e));let a=e.pol,n=e.nationalExecutive,r=e.nationalExecutivePartyId||a?.government?.leadPartyId,i=a?.parties?.find(w=>w.id===r)||null,s=gpmNativeHistoricalPortrait(n,t.year,Z.user);if(n)');
  patched = replaceOnce(patched, "let s=n?rl(n,t.year):null;this._isetHtml(\"leaderAvatar\",s?`<img class=\"il-av\" src=\"${s}\" alt=\"\">`:Z.user)",
    'this._isetHtml("leaderAvatar",s.html)');
  patched = replaceOnce(patched, "let k=t.year,M=rl(w,k);this._isetHtml(\"crownAvatar\",M?`<img class=\"il-av\" src=\"${M}\" alt=\"\">`:e.headOfStateRoleId===\"monarch\"?Z.crown:Z.user),this._iset(\"crownName\",Ot(w));let P=e.headOfStateRoleId===\"monarch\"?",
    'let k=t.year,M=gpmNativeHistoricalPortrait(w,k,e.headOfStateRoleId==="monarch"?Z.crown:Z.user);this._isetHtml("crownAvatar",M.html),this._iset("crownName",Ot(w));let P=gpmHistoricalPeople[w.gpmHistoricalPerson]?.role||(e.headOfStateRoleId==="monarch"?');
  patched = replaceOnce(patched, 'pd(e.headOfStateRoleId||"head_of_state",w.g);this._iset("crownRole",P+',
    'pd(e.headOfStateRoleId||"head_of_state",w.g));this._iset("crownRole",P+');
  patched = replaceOnce(patched, 'o("inspector.leader.age",{age:k-w.born}):""))}else l.style.display="none"}',
    'o("inspector.leader.age",{age:k-w.born}):"")+(M.note?" · "+M.note:e.key?.startsWith("gpm-historical-")&&gpmHistoricalPeople[n?.gpmHistoricalPerson]&&!w.gpmHistoricalPerson?" · Simulated officeholder":""))}else l.style.display="none"}');
  const flagSelector = 'function QS(e){return AY(e)||ere(e)}';
  const flagEntry = (flag, provisional) => ({
    url: flag.image, ratio: flag.ratio || 1.5, label: `${provisional ? "Provisional · " : ""}${flag.name}`,
  });
  const polityFlags = Object.fromEntries(Object.entries(identities).flatMap(([actorId, identity]) => {
    const regionalFlag = identity.victoryFlag || identity.administrationFlag || identity.flag;
    return [
      [`gpm-historical-${actorId}`, identity.flag || identity.administrationFlag, false],
      [`gpm-historical-polity-${actorId}`, regionalFlag, regionalFlag === identity.flag],
    ].filter(([, flag]) => flag).map(([key, flag, provisional]) => [key, flagEntry(flag, provisional)]);
  }));
  const victoryFlags = Object.fromEntries(Object.entries(identities).flatMap(([actorId, identity]) => {
    const flag = identity.victoryFlag || identity.administrationFlag || identity.flag;
    return flag ? [[actorId, flagEntry(flag, flag === identity.flag)]] : [];
  }));
  patched = replaceOnce(patched, flagSelector,
    `const gpmHistoricalPolityFlags=${JSON.stringify(polityFlags)};\nconst gpmHistoricalVictoryFlags=${JSON.stringify(victoryFlags)};\n` +
    'function QS(e){const key=_u(e);const victor=K8()?.gpmHistoricalFlags?.[key];return gpmHistoricalVictoryFlags[victor]||gpmHistoricalPolityFlags[key]||AY(e)||ere(e)}');
  patched = replaceOnce(patched, 'return` data-flag="${t}"`+V_e(H5(t))',
    'const flag=H5(t);return` data-flag="${t}"${gpmHistoricalFlagLabel(flag)}`+V_e(flag)');
  patched = replaceOnce(patched, 'function wc(e){',
    'function gpmHistoricalFlagLabel(flag){return flag?.label?` role="img" aria-label="${v(flag.label)}" title="${v(flag.label)}"`:""}function wc(e){');
  return replaceOnce(patched, 'let n=_u(e);return`<span class="flag ${a||""}" data-flag="${n}"${V_e(H5(n),',
    'let n=_u(e);const flag=H5(n);return`<span class="flag ${a||""}" data-flag="${n}"${gpmHistoricalFlagLabel(flag)}${V_e(flag,');
}

module.exports = { readIdentities, readIdentityIllustrations, patchHistoricalIdentityRenderer, patchHistoricalNameWorker };

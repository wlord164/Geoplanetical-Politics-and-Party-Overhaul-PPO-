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
  const given = pool[sex][(Hu(`${seed}:given`) >>> 16) % pool[sex].length];
  const family = pool.family[(Hu(`${seed}:family`) >>> 16) % pool.family.length];
  const surname = inheritedSurname ?? (pool.patronymic ? `${pool.patronymic[sex]} ${family}` : family);
  return { given, surname, name: surname ? `${given} ${surname}` : given };
}

function patchHistoricalNameWorker(source, replaceOnce) {
  const createPerson = 'function C0(e,t={}){';
  let patched = replaceOnce(source, createPerson,
    `const gpmHistoricalNamePools=${JSON.stringify(historicalNamePools)};\n${gpmHistoricalGeneratedName}\n${createPerson}`);
  patched = replaceOnce(patched, ':UA(d,l,r,t.surname!=null?t.surname:null),m={id:c',
    ':(gpmHistoricalGeneratedName(a,l,r,t.surname)||UA(d,l,r,t.surname!=null?t.surname:null)),m={id:c');
  return replaceOnce(patched, 'l=nbr(Js(e.key),s,i),c=r&&r.parties.find',
    'l=gpmHistoricalGeneratedName(e.key,s,i)||nbr(Js(e.key),s,i),c=r&&r.parties.find');
}

function readAsset(file, extension, assets) {
  if (assets && !assets.has(file)) {
    const bytes = readFileSync(join(__dirname, file));
    if (!bytes.length) throw new Error("Empty historical identity image: " + file);
    assets.set(file, `data:image/${assetTypes[extension]};base64,${bytes.toString("base64")}`);
  }
  return file;
}

function readMedia({ file, source, credit, license, ...details }, actorId, assets) {
  const path = typeof file === "string" && file.match(/^historical-identity-assets\/[a-z0-9][a-z0-9.-]*\.(jpg|jpeg|png|webp)$/);
  if (!path || !/^https:\/\//.test(source) || !credit || !license) {
    throw new Error("Invalid historical identity image: " + actorId);
  }
  return { ...details, source, credit, license, asset: readAsset(file, path[1], assets) };
}

function readHistoricalOfficial(person, id, office, assets) {
  if (!person?.name || !person.role || !/^https:\/\//.test(person.source) ||
      (office === "representative" && !person.portrait)) {
    throw new Error("Invalid historical leader: " + id + "/" + office);
  }
  return { ...person, ...(person.portrait ? { portrait: readMedia(person.portrait, id, assets) } : {}) };
}

function readIdentities(assets) {
  const identities = Object.create(null);
  const convention = JSON.parse(readFileSync(join(__dirname, "historical-flag-convention.json"), "utf8"));
  for (const name of ["sudan", "world", "independence", "opening", "register-factions"]) {
    const file = join(__dirname, `historical-identities-${name}.json`);
    const records = JSON.parse(readFileSync(file, "utf8"));
    for (const [id, record] of Object.entries(records)) {
      const identity = identities[id] ??= {};
      for (const office of ["leader", "headOfState", "headOfGovernment", "representative"]) {
        const person = record[office];
        if (!person) continue;
        const entry = readHistoricalOfficial(person, id, office, assets);
        const prior = identity[office];
        if (prior) {
          if (name !== "register-factions" || entry.name !== prior.name || prior.portrait || !entry.portrait) {
            throw new Error("Duplicate historical identity: " + id + "/" + office);
          }
          prior.portrait = entry.portrait;
        } else {
          identity[office] = entry;
        }
      }
      if (record.additionalOfficials) {
        if (!Array.isArray(record.additionalOfficials) || !record.additionalOfficials.length || identity.additionalOfficials) {
          throw new Error("Invalid historical additional officials: " + id);
        }
        identity.additionalOfficials = record.additionalOfficials.map(person =>
          readHistoricalOfficial(person, id, "additional official", assets));
      }
      for (const flag of ["flag", "administrationFlag", "victoryFlag"]) {
        if (!record[flag]) continue;
        if (Object.hasOwn(identity, flag)) throw new Error("Duplicate historical identity: " + id + "/" + flag);
        identity[flag] = readMedia(record[flag], id, assets);
      }
    }
  }
  const flags = Object.fromEntries(Object.entries(convention.banners).map(([key, media]) => [key, readMedia(media, key, assets)]));
  for (const [id, key] of Object.entries(convention.actors)) {
    if (!flags[key]) throw new Error("Unknown historical flag convention: " + id);
    const identity = identities[id] ??= {};
    identity.flag ??= flags[key];
  }
  return identities;
}

function readIdentityIllustrations(assets) {
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
    return [id, {
      asset: readAsset(file, extension, assets),
      ...(fictionalName ? { fictionalName: fictionalName.trim() } : {}),
    }];
  }));
}

function gpmHistoricalAssetUrl(asset) {
  return Object.hasOwn(gpmHistoricalAssets, asset) ? gpmHistoricalAssets[asset] : null;
}

function readOpeningRepresentatives(people, assets) {
  const { countries, dossierCountries } = require("./opening-register-representatives.json");
  const portraits = Object.fromEntries(Object.entries(countries).map(([key, entries]) => {
    const names = new Set();
    const rows = entries.map(entry => {
      const registered = entry.identityId && people[entry.identityId];
      const name = registered?.name || entry.name;
      const file = registered?.asset || entry.file;
      const extension = /^(?:opening-register-portraits|historical-identity-assets)\/[a-z0-9][a-z0-9-]*\.(jpg|jpeg|png|webp)$/.exec(file)?.[1];
      if (entry.identityId && !registered?.asset || !name || !entry.role || !extension || names.has(name) ||
          (entry.fictional ? registered || !entry.credit : !/^https:\/\//.test(entry.source) || (!registered && (!entry.credit || !entry.license)))) {
        throw new Error("Invalid opening representative: " + key + "/" + name);
      }
      names.add(name);
      return {
        name,
        role: entry.fictional ? "Fictional " + entry.role : entry.role,
        identityId: entry.identityId,
        portrait: { asset: readAsset(file, extension, assets) },
      };
    });
    return [key, rows];
  }));
  for (const key of Object.values(dossierCountries)) {
    if (!Object.hasOwn(portraits, key)) throw new Error("Missing opening representatives for: " + key);
  }
  return { portraits, dossierCountries };
}

function gpmOpeningDossierRepresentatives(actorId) {
  const { portraits, dossierCountries } = gpmOpeningRepresentatives;
  return portraits[dossierCountries[actorId] || "gpm-historical-" + actorId] || [];
}

function gpmHistoricalFlagUrls(flags) {
  return Object.fromEntries(Object.entries(flags).map(([id, { asset, ...flag }]) =>
    [id, { url: gpmHistoricalAssetUrl(asset), ...flag }]));
}

function gpmNativeHistoricalPortrait(person, year, fallbackIcon) {
  const tag = person?.gpmHistoricalPerson;
  const historical = gpmHistoricalPeople[tag];
  const actorId = historical && tag.endsWith(":leader") ? tag.slice(0, -":leader".length) : null;
  const image = gpmHistoricalAssetUrl(historical?.asset);
  const illustration = actorId && !image && gpmHistoricalDossierIllustrations[actorId];
  const illustrationImage = gpmHistoricalAssetUrl(illustration?.asset);
  const representative = historical?.representative;
  const photo = gpmHistoricalAssetUrl(representative?.asset) || illustrationImage || image || pl(person, year);
  const note = representative ? `Photo: ${representative.name} (faction representative)` :
    illustrationImage ? "Illustrative portrait" : historical && !image && photo ? "Game-generated portrait" : null;
  const title = representative ? [representative.name, representative.role, "Faction representative"].filter(Boolean).join(" · ") : note;
  return {
    html: photo ? `<img class="il-av" src="${b(photo)}" alt="${b(note || "")}"${title ? ` title="${b(title)}"` : ""}>` : fallbackIcon,
    note,
  };
}

function gpmHistoricalBirthYear(person) {
  return gpmHistoricalPeople[person?.gpmHistoricalPerson]?.unverifiedBirth ? null : person?.born ?? null;
}

function gpmRefreshOpeningHeadOfGovernment(ui, row, opening) {
  row.disabled = !opening.personId;
  row.dataset.mid = opening.personId || "";
  row.setAttribute("data-gpm-opening-head-of-government", "");
  row.style.display = "";
  const photo = gpmHistoricalAssetUrl(gpmHistoricalPeople[opening.id]?.asset);
  ui._isetHtml("crownAvatar", photo ? `<img class="il-av" src="${b(photo)}" alt="">` : Y.user);
  ui._iset("crownName", opening.name);
  ui._iset("crownRole", "Opening · " + opening.role);
}

function patchHistoricalIdentityRenderer(source, replaceOnce) {
  // Resolve the same asset references used in worker views and native country displays.
  const assets = new Map();
  const identities = readIdentities(assets);
  const illustrations = readIdentityIllustrations(assets);
  const people = Object.fromEntries(Object.entries(identities).flatMap(([actorId, identity]) =>
    ["leader", "headOfState", "headOfGovernment"].filter(office => identity[office]).map(office =>
      [`${actorId}:${office}`, { asset: identity[office].portrait?.asset || null, role: identity[office].role,
        representative: !identity[office].portrait && identity.representative ?
          { name: identity.representative.name, role: identity.representative.role, asset: identity.representative.portrait.asset } : null }])));
  const governmentPeople = require("./opening-register-government.json").people;
  const register = require("./opening-register-data.json");
  const registerPeople = { ...register.people, ...governmentPeople };
  const openingRepresentatives = readOpeningRepresentatives(registerPeople, assets);
  for (const [id, entry] of Object.entries(registerPeople)) {
    const role = entry.executiveRole?.role || entry.role;
    const unverifiedBirth = !entry.biography?.born;
    if (!entry.asset) {
      people[id] = { asset: null, role, unverifiedBirth, generatedFallback: Object.hasOwn(governmentPeople, id) };
      continue;
    }
    const file = /^opening-register-portraits\/[a-z0-9][a-z0-9-]*\.(jpg|jpeg|png|webp)$/.exec(entry.asset);
    if (!file) throw new Error("Invalid register portrait asset: " + id);
    people[id] = { asset: readAsset(entry.asset, file[1], assets), role, unverifiedBirth };
  }
  const partyIllustrations = Object.fromEntries(Object.entries(register.countries).flatMap(([key, country]) =>
    Object.entries(country.fictionalOpeningPortraits || {}).map(([id, portrait]) => {
      const file = /^opening-register-portraits\/reg-fictional-[a-z0-9-]+\.jpg$/.exec(portrait.asset);
      if (!file || !country.illustratedOpeningParties?.includes(id)) throw new Error("Invalid fictional representative portrait: " + key + "/" + id);
      return [key + "/" + id, readAsset(portrait.asset, "jpg", assets)];
    })));
  const portraitSelector = 'function pl(e,t,a){';
  let patched = replaceOnce(source, portraitSelector,
    `const gpmHistoricalPeople = ${JSON.stringify(people)};\n${gpmNativeHistoricalPortrait}\n${gpmHistoricalBirthYear}\n${gpmRefreshOpeningHeadOfGovernment}\n` +
    `const gpmFictionalPartyPortraits=${JSON.stringify(partyIllustrations)};\n` +
    `${portraitSelector}const portrait=gpmFictionalPartyPortraits[e?.gpmRegisterChair?.illustration];if(portrait)return gpmHistoricalAssetUrl(portrait);const person=gpmHistoricalPeople[e?.gpmHistoricalPerson];if(person&&!person.generatedFallback)return gpmHistoricalAssetUrl(person.asset);`);
  patched = replaceOnce(patched, "let w=e.headOfStateId!==e.nationalExecutiveId?e.headOfState:null",
    'l.disabled=false;l.removeAttribute("data-gpm-opening-head-of-government");let w=gpmShowSeparateHeadOfState(e)?e.headOfState:null');
  patched = replaceOnce(patched, 'function BYe(e,t){',
    'function gpmShowSeparateHeadOfState(country){const head=country.headOfState;return !!head&&country.headOfStateId!==country.nationalExecutiveId&&(!head.gpmHistoricalPerson||head.gpmHistoricalPerson!==country.nationalExecutive?.gpmHistoricalPerson)}function BYe(e,t){');
  patched = replaceOnce(patched, "!!a.headOfState&&a.headOfStateId!==a.nationalExecutiveId", "gpmShowSeparateHeadOfState(a)||!!a.gpmOpeningHeadOfGovernment");
  patched = replaceOnce(patched, 'let w=e.nationalExecutiveRoleId?o(', 'let w=gpmHistoricalPeople[n.gpmHistoricalPerson]?.role||(e.nationalExecutiveRoleId?o(');
  patched = replaceOnce(patched, ':o("inspector.leader.title"),k=t.year', ':o("inspector.leader.title")),k=t.year');
  patched = replaceOnce(patched, '_=n.born?k-n.born:null', '_=gpmHistoricalBirthYear(n)==null?null:k-n.born');
  patched = replaceOnce(patched, ':w.born?" \\xB7 "+o("inspector.leader.age"', ':gpmHistoricalBirthYear(w)!=null?" \\xB7 "+o("inspector.leader.age"');
  patched = replaceOnce(patched, 'e.born!=null&&a.push({y:e.born,txt:o("fiche.life.born")})',
    'gpmHistoricalBirthYear(e)!=null&&a.push({y:e.born,txt:o("fiche.life.born")})');
  patched = replaceOnce(patched, 'o("inspector.leader.age",{age:_}):""))}else a?',
    'o("inspector.leader.age",{age:_}):"")+(s.note?" · "+s.note:""))}else a?');
  patched = replaceOnce(patched, '_refreshInspector(e,t){this._iset("countryName",G(e,e.key)),this._iset("regimeName",ry(e));let a=e.pol,n=e.nationalExecutive,r=e.nationalExecutivePartyId||a?.government?.leadPartyId,i=a?.parties?.find(w=>w.id===r)||null;if(n)',
    '_refreshInspector(e,t){this._iset("countryName",G(e,e.key)),this._iset("regimeName",ry(e));let a=e.pol,n=e.nationalExecutive,r=e.nationalExecutivePartyId||a?.government?.leadPartyId,i=a?.parties?.find(w=>w.id===r)||null,s=gpmNativeHistoricalPortrait(n,t.year,Y.user);if(n)');
  patched = replaceOnce(patched, "let s=n?pl(n,t.year):null;this._isetHtml(\"leaderAvatar\",s?`<img class=\"il-av\" src=\"${s}\" alt=\"\">`:Y.user)",
    'this._isetHtml("leaderAvatar",s.html)');
  patched = replaceOnce(patched, "let k=t.year,_=pl(w,k);this._isetHtml(\"crownAvatar\",_?`<img class=\"il-av\" src=\"${_}\" alt=\"\">`:e.headOfStateRoleId===\"monarch\"?Y.crown:Y.user),this._iset(\"crownName\",Dt(w));let P=e.headOfStateRoleId===\"monarch\"?",
    'let k=t.year,_=gpmNativeHistoricalPortrait(w,k,e.headOfStateRoleId==="monarch"?Y.crown:Y.user);this._isetHtml("crownAvatar",_.html),this._iset("crownName",Dt(w));let P=gpmHistoricalPeople[w.gpmHistoricalPerson]?.role||(e.headOfStateRoleId==="monarch"?');
  patched = replaceOnce(patched, 'vd(e.headOfStateRoleId||"head_of_state",w.g);this._iset("crownRole",P+',
    'vd(e.headOfStateRoleId||"head_of_state",w.g));this._iset("crownRole",P+');
  patched = replaceOnce(patched, 'o("inspector.leader.age",{age:k-w.born}):""))}else l.style.display="none"}',
    'o("inspector.leader.age",{age:k-w.born}):"")+(_.note?" · "+_.note:e.key?.startsWith("gpm-historical-")&&gpmHistoricalPeople[n?.gpmHistoricalPerson]&&!w.gpmHistoricalPerson?" · Simulated officeholder":""))}else if(e.gpmOpeningHeadOfGovernment)gpmRefreshOpeningHeadOfGovernment(this,l,e.gpmOpeningHeadOfGovernment);else l.style.display="none"}');
  const flagSelector = 'function Mk(e){return kZ(e)||cie(e)}';
  const flagEntry = (flag, provisional) => ({
    asset: flag.asset, ratio: flag.ratio || 1.5, label: `${provisional ? "Provisional · " : ""}${flag.name}`,
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
    `const gpmHistoricalAssets = ${JSON.stringify(Object.fromEntries(assets))};\n${gpmHistoricalAssetUrl}\n` +
    `const gpmOpeningRepresentatives = ${JSON.stringify(openingRepresentatives)};\n${gpmOpeningDossierRepresentatives}\n` +
    `const gpmHistoricalDossierIllustrations = ${JSON.stringify(illustrations)};\n` +
    `${gpmHistoricalFlagUrls}\n` +
    `const gpmHistoricalPolityFlags=gpmHistoricalFlagUrls(${JSON.stringify(polityFlags)});\nconst gpmHistoricalVictoryFlags=gpmHistoricalFlagUrls(${JSON.stringify(victoryFlags)});\n` +
    'function Mk(e){const key=Au(e);const victor=pb()?.gpmHistoricalFlags?.[key];return gpmHistoricalVictoryFlags[victor]||gpmHistoricalPolityFlags[key]||kZ(e)||cie(e)}');
  patched = replaceOnce(patched, 'return` data-flag="${t}"`+HPe(iy(t))',
    'const flag=iy(t);return` data-flag="${t}"${gpmHistoricalFlagLabel(flag)}`+HPe(flag)');
  patched = replaceOnce(patched, 'function Pc(e){',
    'function gpmHistoricalFlagLabel(flag){return flag?.label?` role="img" aria-label="${b(flag.label)}" title="${b(flag.label)}"`:""}function Pc(e){');
  return replaceOnce(patched, 'let n=Au(e);return`<span class="flag ${a||""}" data-flag="${n}"${HPe(iy(n),',
    'let n=Au(e);const flag=iy(n);return`<span class="flag ${a||""}" data-flag="${n}"${gpmHistoricalFlagLabel(flag)}${HPe(flag,');
}

module.exports = { readIdentities, patchHistoricalIdentityRenderer, patchHistoricalNameWorker };

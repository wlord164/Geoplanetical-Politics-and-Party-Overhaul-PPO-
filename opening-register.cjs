"use strict";

const data = require("./opening-register-data.json");
const { openingIdeology } = require("./opening-register-ideology.cjs");

function gpmOpeningRegisterPreset(countryKey, preset) {
  const opening = gpmOpeningCountries[countryKey];
  if (!opening?.chambers || !preset?.chambers?.length) return preset;

  const registeredParties = new Map();
  const unchangedPartyIds = new Set();
  let registeredSeats = 0;
  const chambers = [];
  for (const chamber of preset.chambers) {
    const source = opening.chambers[chamber.id];
    if (!source) {
      for (const id of Object.keys(chamber.composition || {})) unchangedPartyIds.add(id);
      chambers.push(chamber);
      continue;
    }

    chambers.push({
      ...chamber,
      customName: source.name,
      seats: source.statutorySeats,
      seatsBasis: "opening-register",
      composition: Object.fromEntries(source.rows.filter(row => row.seats > 0).map(row => [row.id, row.seats])),
    });
    for (const row of source.rows) {
      if (row.kind === "vacancy") continue;
      if (!registeredParties.has(row.id)) registeredParties.set(row.id, { ...row, seats: 0 });
      registeredParties.get(row.id).seats += row.seats;
      registeredSeats += row.seats;
    }
  }

  if (!registeredParties.size) return preset;
  const previous = new Map(preset.parties.map(party => [party.id, party]));
  const parties = [];
  for (const { id, name, tag, seats, kind, stockBasis, ideologyMatch } of registeredParties.values()) {
    const base = previous.get(id) || previous.get(stockBasis) || {};
    const party = {
      ...base,
      id,
      ideology: ideologyMatch?.scores || base.ideology || { econ: 0, social: 0, gov: 0, nat: 0 },
      support: registeredSeats ? seats / registeredSeats : 0,
      nameDesc: {
        ...base.nameDesc,
        gpmOpeningName: name,
        gpmOpeningTag: tag || null,
        gpmOpeningKind: kind || null,
        gpmOpeningIdeology: ideologyMatch?.preset || null,
      },
    };
    if (ideologyMatch) delete party.family;
    parties.push(party);
  }
  for (const party of previous.values()) {
    if (unchangedPartyIds.has(party.id) && !registeredParties.has(party.id)) parties.push(party);
  }

  const valid = new Set(parties.map(party => party.id));
  const largest = parties.filter(party => party.nameDesc?.gpmOpeningKind !== "aggregate")
    .reduce((best, party) => !best || party.support > best.support ? party : best, null);
  const lead = valid.has(preset.rulingPartyId) ? preset.rulingPartyId : (largest || parties[0]).id;
  preset.chambers = chambers;
  preset.parties = parties;
  preset.rulingPartyId = lead;
  preset.coalition = [...new Set([lead, ...(preset.coalition || []).filter(id => valid.has(id))])];
  return preset;
}

function gpmOpeningVacancyHtml(chamber) {
  const vacancies = chamber?.composition?.["gpm-vacant"] || 0;
  if (!vacancies) return "";
  return '<p class="empty-note">' + vacancies + " vacant " + (vacancies === 1 ? "seat" : "seats") + "</p>";
}

function seedDeclaration() {
  const countries = Object.fromEntries(Object.entries(data.countries).map(([key, entry]) => [
    key, { chambers: Object.fromEntries(Object.entries(entry.chambers || {}).map(([id, chamber]) => [id, {
      ...chamber, rows: chamber.rows.map(row => ({ ...row, ideologyMatch: openingIdeology(key, row) })),
    }])) },
  ]));
  return "const gpmOpeningCountries=" + JSON.stringify(countries) + ";\n" + gpmOpeningRegisterPreset + "\n";
}

function patchOpeningRegisterRenderer(source, replaceOnce) {
  const setup = "function Sse(e,t=2026){";
  let js = replaceOnce(source, setup, seedDeclaration() + setup);
  js = replaceOnce(js, "t_t(a,i),xIe(i,CIe(a))", "t_t(a,i),xIe(i,CIe(a)),gpmOpeningRegisterPreset(a,i)");
  js = replaceOnce(js, "if(e?.nameDesc?.customName)return e.nameDesc.customName;let a=t&&e?.id?N9(",
    "if(e?.nameDesc?.customName)return e.nameDesc.customName;if(e?.nameDesc?.gpmOpeningName)return e.nameDesc.gpmOpeningName;let a=t&&e?.id?N9(");
  js = replaceOnce(js, "gpmTag:i?N9(", "gpmTag:r.nameDesc?.gpmOpeningTag||(i?N9(");
  js = replaceOnce(js, "?.tag:null);s&&n.add(s)", "?.tag:null));s&&n.add(s)");
  js = replaceOnce(js, "gpmTag:s?.tag)||Obt(l,n)", "gpmTag:r.nameDesc?.gpmOpeningTag||s?.tag)||Obt(l,n)");
  const chooseParty = "u=c.filter(d=>!d.isGovernmentLead).sort(";
  js = replaceOnce(js, chooseParty, 'u=c.filter(d=>!d.isGovernmentLead&&d.nameDesc?.gpmOpeningKind!=="aggregate").sort(');
  const partyGrid = "function fFe(e,t){";
  js = replaceOnce(js, partyGrid, gpmOpeningVacancyHtml + "\n" + partyGrid);
  return replaceOnce(js, '${this._partyGridCardHtml(t)}', '${gpmOpeningVacancyHtml(RFe(t.player.pol))}${this._partyGridCardHtml(t)}');
}

function patchOpeningRegisterWorker(source, replaceOnce) {
  const setup = "function gFa(e,t=2026){";
  let js = replaceOnce(source, setup, seedDeclaration() + setup);
  js = replaceOnce(js, "Xho(a,n),lga(n,yte(a))", "Xho(a,n),lga(n,yte(a)),gpmOpeningRegisterPreset(a,n)");
  js = replaceOnce(js, 'i.seatsBasis==="reform"||K0(i)?.seats!=null',
    '(i.seatsBasis==="reform"||i.seatsBasis==="opening-register")||K0(i)?.seats!=null');
  return replaceOnce(js, "gpmTag:e.nameDesc.gpmTag||null,gpmIdeologyPreset:",
    "gpmTag:e.nameDesc.gpmTag||null,gpmOpeningName:e.nameDesc.gpmOpeningName||null,gpmOpeningTag:e.nameDesc.gpmOpeningTag||null,gpmOpeningKind:e.nameDesc.gpmOpeningKind||null,gpmOpeningIdeology:e.nameDesc.gpmOpeningIdeology||null,gpmIdeologyPreset:");
}

module.exports = { data, patchOpeningRegisterRenderer, patchOpeningRegisterWorker };


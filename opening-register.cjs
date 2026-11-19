"use strict";

const data = require("./opening-register-data.json");
const { openingIdeology } = require("./opening-register-ideology.cjs");

function gpmOpeningNonparty(party) {
  return ["aggregate", "unaffiliated", "affiliation-unverified"].includes(party?.nameDesc?.gpmOpeningKind);
}

function gpmOpeningGoverningParties(parties) {
  const eligible = parties.filter(party => !gpmOpeningNonparty(party));
  return eligible.length ? eligible : parties;
}

function gpmRegisteredOpeningParty(base, row) {
  const { id, name, tag, kind, ideologyMatch } = row;
  const party = {
    ...base,
    id,
    ideology: ideologyMatch?.scores || base.ideology || { econ: 0, social: 0, gov: 0, nat: 0 },
    nameDesc: {
      ...base.nameDesc,
      gpmOpeningName: name,
      gpmOpeningTag: tag || null,
      gpmOpeningKind: kind || null,
      gpmOpeningIdeology: ideologyMatch?.preset || null,
      gpmOpeningIdeologySource: ideologyMatch?.scope || (base.ideology ? "game-model" : null),
    },
  };
  if (ideologyMatch) delete party.family;
  return party;
}

function gpmOpeningRegisterPreset(countryKey, preset, createPolity, options) {
  const opening = gpmOpeningCountries[countryKey];
  if (!opening || !preset?.parties?.length) return preset;
  const hasRegisteredChamber = Object.keys(opening.chambers).length > 0;
  const needsStockAllocation = hasRegisteredChamber && preset.chambers?.some(chamber =>
    !opening.chambers[chamber.id] && !Object.keys(chamber.composition || {}).length);
  const stockChambers = needsStockAllocation ? createPolity(preset, options).chambers : [];
  if (opening.stockParties) {
    preset.parties = preset.parties.map(party => {
      const row = opening.stockParties[party.id];
      return row ? gpmRegisteredOpeningParty(party, row) : party;
    });
  }
  if (!preset.chambers?.length || !hasRegisteredChamber) return preset;

  const registeredParties = new Map();
  const unchangedPartyIds = new Set();
  const firstChamber = preset.chambers[0];
  const governingSeats = new Map(opening.chambers[firstChamber.id]?.rows
    .map(row => [row.id, row.seats]) || Object.entries(firstChamber.composition || {}));
  let registeredSeats = 0;
  const chambers = [];
  for (const chamber of preset.chambers) {
    const source = opening.chambers[chamber.id];
    if (!source) {
      const composition = stockChambers.find(stock => stock.id === chamber.id)?.composition || chamber.composition;
      for (const id of Object.keys(composition || {})) unchangedPartyIds.add(id);
      chambers.push(composition === chamber.composition ? chamber : { ...chamber, composition });
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
  for (const row of registeredParties.values()) {
    const base = previous.get(row.id) || previous.get(row.stockBasis) || {};
    parties.push({
      ...gpmRegisteredOpeningParty(base, row),
      support: registeredSeats ? row.seats / registeredSeats : 0,
    });
  }
  for (const party of previous.values()) {
    if (unchangedPartyIds.has(party.id) && !registeredParties.has(party.id)) parties.push(party);
  }

  const eligible = gpmOpeningGoverningParties(parties);
  const valid = new Set(eligible.map(party => party.id));
  const largest = eligible.reduce((best, party) => {
    const seats = governingSeats.get(party.id) || 0;
    const bestSeats = governingSeats.get(best?.id) || 0;
    return !best || seats > bestSeats || (seats === bestSeats && party.support > best.support) ? party : best;
  }, null);
  const lead = valid.has(opening.governmentPartyId) ? opening.governmentPartyId :
    valid.has(preset.rulingPartyId) ? preset.rulingPartyId : (largest || parties[0]).id;
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

function gpmAssemblyPartyName(party) {
  if (!party || gpmOpeningNonparty(party)) return "";
  const name = ba(party);
  return /^(?:other(?: parties)?|others|miscellaneous|independents?|non[- ]affiliated)$/i.test(name.trim()) ? "" : name;
}

function gpmOpenAssemblyParty(event, assembly) {
  const partyId = event.target.closest?.("[data-gpm-assembly-party]")?.dataset.gpmAssemblyParty;
  if (!partyId) return;
  const details = [...assembly.querySelectorAll("details[data-pa-party]")].find(row => row.dataset.paParty === partyId);
  if (!details) return;
  details.open = true;
  details.querySelector("summary")?.focus({ preventScroll: true });
  details.scrollIntoView({ block: "nearest" });
}

function seedDeclaration() {
  const countries = Object.fromEntries(Object.entries(data.countries).map(([key, entry]) => [
    key, {
      governmentPartyId: entry.governmentPartyId,
      chambers: Object.fromEntries(Object.entries(entry.chambers || {}).map(([id, chamber]) => [id, {
        ...chamber, rows: chamber.rows.map(row => ({ ...row, ideologyMatch: openingIdeology(key, row) })),
      }])),
      stockParties: entry.stockParties ? Object.fromEntries(Object.entries(entry.stockParties).map(([id, row]) => [
        id, { id, kind: "party", ...row, ideologyMatch: openingIdeology(key, { id }) },
      ])) : undefined,
    },
  ]));
  return "const gpmOpeningCountries=" + JSON.stringify(countries) + ";\n" + gpmOpeningNonparty + "\n" +
    gpmOpeningGoverningParties + "\n" + gpmRegisteredOpeningParty + "\n" + gpmOpeningRegisterPreset + "\n";
}

function patchOpeningRegisterRenderer(source, replaceOnce) {
  const setup = "function Sse(e,t=2026){";
  let js = replaceOnce(source, setup, seedDeclaration() + setup);
  js = replaceOnce(js, "t_t(a,i),xIe(i,CIe(a))",
    "t_t(a,i),xIe(i,CIe(a)),gpmOpeningRegisterPreset(a,i,RIe,{culture:ld(a),baseSeed:_h(a)})");
  js = replaceOnce(js, "if(e?.nameDesc?.customName)return e.nameDesc.customName;let a=t&&e?.id?N9(",
    "if(e?.nameDesc?.customName)return e.nameDesc.customName;if(e?.nameDesc?.gpmOpeningName)return e.nameDesc.gpmOpeningName;let a=t&&e?.id?N9(");
  js = replaceOnce(js, "gpmTag:i?N9(", "gpmTag:r.nameDesc?.gpmOpeningTag||(i?N9(");
  js = replaceOnce(js, "?.tag:null);s&&n.add(s)", "?.tag:null));s&&n.add(s)");
  js = replaceOnce(js, "gpmTag:s?.tag)||Obt(l,n)", "gpmTag:r.nameDesc?.gpmOpeningTag||s?.tag)||Obt(l,n)");
  const chooseParty = "u=c.filter(d=>!d.isGovernmentLead).sort(";
  js = replaceOnce(js, chooseParty, "u=c.filter(d=>!d.isGovernmentLead&&!gpmOpeningNonparty(d)).sort(");
  const coalition = "i=Object.entries(n).sort((h,f)=>f[1]-h[1]),s=a&&n[a]?a:i.length?i[0][0]:Wj(e)";
  js = replaceOnce(js, coalition,
    "gpmEligible=gpmOpeningGoverningParties(e.parties),gpmIds=new Set(gpmEligible.map(p=>p.id))," +
    "i=Object.entries(n).filter(([id])=>gpmIds.has(id)).sort((h,f)=>f[1]-h[1]),s=a&&n[a]&&gpmIds.has(a)?a:i.length?i[0][0]:Wj(e)");
  js = replaceOnce(js, "p=e.parties.filter(h=>h.id!==s&&(n[h.id]||0)>0)", "p=gpmEligible.filter(h=>h.id!==s&&(n[h.id]||0)>0)");
  const partyGrid = "function fFe(e,t){";
  js = replaceOnce(js, partyGrid, gpmOpeningVacancyHtml + "\n" + gpmAssemblyPartyName + "\n" + gpmOpenAssemblyParty + "\n" + partyGrid);
  js = replaceOnce(js, "coalition:c||[],held:u", "coalition:c||[],held:u,assemblyNamesOnly:true");
  js = replaceOnce(js, 'for(let L of c){let I=Pl(i(L)),A=r.has(L)?" gov":"";',
    'for(let L of c){let gpmName=a.assemblyNamesOnly?gpmAssemblyPartyName(i(L)):"",I=a.assemblyNamesOnly&&!gpmName?"#657383":Pl(i(L)),A=r.has(L)?" gov":"";');
  js = replaceOnce(js, 'r="${k.toFixed(1)}" fill="${I}"/>',
    'r="${k.toFixed(1)}" fill="${I}"${gpmName?` data-gpm-assembly-party="${b(L)}" style="cursor:pointer"`:""}>${gpmName?`<title>${b(gpmName)}</title>`:""}</circle>');
  js = replaceOnce(js, "let C=c.slice().sort((L,I)=>e[I]-e[L]).map(", 'let C=a.assemblyNamesOnly?"":c.slice().sort((L,I)=>e[I]-e[L]).map(');
  js = replaceOnce(js, '<div class="hc-legend">${C}</div>${E}</div>', '${a.assemblyNamesOnly?"":`<div class="hc-legend">${C}</div>`}${E}</div>');
  js = replaceOnce(js, 'this._wireHemicycle(e),this._wireParl(e),',
    'this._wireHemicycle(e),e.querySelector(".pa-panel")?.addEventListener("click",event=>gpmOpenAssemblyParty(event,e)),this._wireParl(e),');
  js = replaceOnce(js, "n=a.parties.filter(i=>i.legal!==!1).sort(", "n=a.parties.filter(i=>i.legal!==!1&&gpmAssemblyPartyName(i)).sort(");
  js = replaceOnce(js, '<summary><span class="sh-idline pa-identity"><span class="pa-party-tag"',
    '<summary style="grid-template-columns:minmax(0,1fr) 54px auto"><span class="sh-idline pa-identity"><span class="pa-party-tag"');
  js = replaceOnce(js, '<span class="pa-party-tag" style="--pa-color:${s}">${b(y||"")}</span>',
    '<span aria-hidden="true" style="width:.65em;height:.65em;flex:0 0 .65em;border-radius:50%;background:${s}"></span>');
  js = replaceOnce(js, '<span><b>${b(ba(i))}</b><small data-tip="${b(o("pol.party.roleTip."+l))}">${o("pol.role."+l)}</small></span>',
    '<span><b>${b(gpmAssemblyPartyName(i))}</b></span>');
  js = replaceOnce(js, '<span class="pa-number"><b>${d}</b><small>${o("pol.party.support")}</small></span>',
    "");
  js = replaceOnce(js, '${h}</summary>\n      <div class="pa-party-body">', '</summary>\n      <div class="pa-party-body">${h}');
  return replaceOnce(js, '>${s.seats} ${$C(s)}</span></h3>${d}</section>',
    '>${s.seats} ${$C(s)}</span></h3>${d}${gpmOpeningVacancyHtml(s)}</section>');
}

function patchOpeningRegisterWorker(source, replaceOnce) {
  const setup = "function gFa(e,t=2026){";
  let js = replaceOnce(source, setup, seedDeclaration() + setup);
  js = replaceOnce(js, "Xho(a,n),lga(n,yte(a))",
    "Xho(a,n),lga(n,yte(a)),gpmOpeningRegisterPreset(a,n,cga,{culture:Js(a),baseSeed:Ma(a)})");
  js = replaceOnce(js, 'i.seatsBasis==="reform"||K0(i)?.seats!=null',
    '(i.seatsBasis==="reform"||i.seatsBasis==="opening-register")||K0(i)?.seats!=null');
  const coalition = "n=Object.entries(r).sort((m,f)=>f[1]-m[1]),i=a&&r[a]?a:n.length?n[0][0]:SC(e)";
  js = replaceOnce(js, coalition,
    "gpmEligible=gpmOpeningGoverningParties(e.parties),gpmIds=new Set(gpmEligible.map(p=>p.id))," +
    "n=Object.entries(r).filter(([id])=>gpmIds.has(id)).sort((m,f)=>f[1]-m[1]),i=a&&r[a]&&gpmIds.has(a)?a:n.length?n[0][0]:SC(e)");
  js = replaceOnce(js, "d=e.parties.filter(m=>m.id!==i&&(r[m.id]||0)>0)", "d=gpmEligible.filter(m=>m.id!==i&&(r[m.id]||0)>0)");
  return replaceOnce(js, "gpmTag:e.nameDesc.gpmTag||null,gpmIdeologyPreset:",
    "gpmTag:e.nameDesc.gpmTag||null,gpmOpeningName:e.nameDesc.gpmOpeningName||null,gpmOpeningTag:e.nameDesc.gpmOpeningTag||null,gpmOpeningKind:e.nameDesc.gpmOpeningKind||null,gpmOpeningIdeology:e.nameDesc.gpmOpeningIdeology||null,gpmOpeningIdeologySource:e.nameDesc.gpmOpeningIdeologySource||null,gpmIdeologyPreset:");
}

module.exports = { data, patchOpeningRegisterRenderer, patchOpeningRegisterWorker };


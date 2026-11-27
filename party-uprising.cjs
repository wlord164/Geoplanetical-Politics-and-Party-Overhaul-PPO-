"use strict";

const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const officialNames = require("./party-official-country-names.cjs");
const { workerFunctions: naming } = require("./party-uprising-names.cjs");
const { workerFunctions: regimes } = require("./party-uprising-regimes.cjs");
const { workerFunctions: continuity } = require("./party-uprising-continuity.cjs");
const dynamicFlagKey = /^(?:ppo-uprising-[a-z0-9][a-z0-9:-]*-\d+|gpm-historical-[a-z0-9][a-z0-9:-]*)$/;
const preparationCode = readFileSync(join(__dirname, "party-uprising-preparations.js"), "utf8");
const uprisingCode = readFileSync(join(__dirname, "party-uprising-worker.js"), "utf8");
const workerCode = "const gpmUprisingOfficialNames = " + JSON.stringify(officialNames) + ";\n" +
  [...naming, ...regimes, ...continuity].join("\n") + "\n" +
  uprisingCode.replace("const gpmUprising = (() => {", "$&\n" + preparationCode);

function patchUprisingWorker(source, replaceOnce) {
  const anchors = [
    ["registerPartyCongressSize();\nconst gpmRegionalRules",
      "registerPartyCongressSize();\n" + workerCode + "\nconst gpmRegionalRules"],
    ["this.sim=g,r?retirePartyCongresses(g)",
      "this.sim=g,!r&&gpmUprising.captureStartingIdentities(g),r?retirePartyCongresses(g)"],
    ['if (party.gpmForeignFunding) advancePartyForeignFunding(sim, country, party);',
      'if (party.gpmForeignFunding) advancePartyForeignFunding(sim, country, party);\n      if (party.gpmUprisingPreparations) gpmUprising.advancePreparations(sim, country, party);'],
    ['t.parties.map(A=>({...A,view:{color:W7(A)',
      't.parties.map(({gpmUprisingPreparations,gpmForeignFunding,...A})=>({...A,view:{color:W7(A)'],
    ['(A==="gpm.foreignFunding"?',
      '(A==="gpm.uprising"?gpmUprising.view(a):A==="gpm.foreignFunding"?'],
    ['independence:Mqt(e)})', 'independence:Mqt(e),gpmUprisingFlags:gpmUprising.flags(e)})'],
    ['Ch=e=>yho.test(kw(e))||qCe(kw(e))!==null',
      `Ch=e=>yho.test(kw(e))||qCe(kw(e))!==null||${dynamicFlagKey}.test(kw(e))`],
    ['setBaseFlag(t){return{ok:wDa(this,t)}}',
      'setBaseFlag(t){const ok=wDa(this,t);if(ok)gpmUprising.clearLegacyFlag(this,t);return{ok}}'],
    ['e._onWarEnd&&e._onWarEnd(c)}function XNt(',
      'e._onWarEnd&&e._onWarEnd(c),gpmUprising.record(e,i,A)}function XNt('],
    ['t.support.e<=0&&!e.playerControlsGovernment(A)&&XNt',
      't.support.e<=0&&(!e.playerControlsGovernment(A)||gpmUprising.matches(e,t))&&XNt'],
    ['function*bMo(e,t){', 'function*bMo(e,t){gpmUprising.settle(e);'],
    ['id:`player:${t.key}`,mode:"operational"', 'id:a.id||`player:${t.key}`,mode:"operational"'],
    ['function e8t(e,t,A=null){let a=[...e.formations?.values()||[]].filter(c=>t?',
      'function e8t(e,t,A=null,gpmOwner=null){let a=[...e.formations?.values()||[]].filter(c=>!gpmOwner||c.owner===gpmOwner).filter(c=>t?'],
    ['function hSt(e,t,A,a="ceasefire"){', 'function hSt(e,t,A,a="ceasefire",gpmCountry=null){'],
    ['!l||!r.has(s.owner)||!(l.warKey===t.id',
      '!l||!r.has(s.owner)||gpmCountry&&!gpmUprising.missionInvolves(e,l,s.owner,gpmCountry)||!(l.warKey===t.id'],
    ['for(let s of t.missileMissions||[]){if(!s||s.resolved)continue;',
      'for(let s of t.missileMissions||[]){if(!s||s.resolved||gpmCountry&&!gpmUprising.missionInvolves(e,s,s.owner,gpmCountry))continue;'],
    ['await this.commitTransportBoundary(A),this.invalidateDomainCallViews(a)',
      'gpmUprising.settle(A);await this.commitTransportBoundary(A),this.invalidateDomainCallViews(a)'],
    ['function zNt(e,t,A,a){if(!Array.isArray(a))',
      'function zNt(e,t,A,a){if(gpmUprising.matches(e,t)&&a?.length)return{ok:!1,reasonId:"civil_war_decisive"};if(!Array.isArray(a))'],
    ["filter(n=>n.legal===!1);if(!A.length)return null;let a=GUe",
      "filter(n=>n.legal===!1&&!n.gpmUprisingShell&&!n.gpmUprisingExcluded);if(!A.length)return null;let a=GUe"],
    ["function up(e,t,A){",
      "function up(e,t,A){if(e.parties?.some(p=>p.gpmUprisingShell||p.gpmUprisingExcluded)){t={...t};for(const p of e.parties)if(p.gpmUprisingShell||p.gpmUprisingExcluded)delete t[p.id];}"],
    ["function Fq(e,t){let A=e.parties;", "function Fq(e,t){let A=e.parties.filter(p=>!p.gpmUprisingShell);"],
    ['&&(K.state="ready"),K.location?.type==="front"',
      '&&!K.gpmUprisingStaffing&&(K.state="ready"),K.location?.type==="front"'],
    ['o.strength=Qk(o,n),Object.keys(u).length||d>0?',
      'o.strength=Qk(o,n),gpmUprising.refreshStaffing(o),Object.keys(u).length||d>0?'],
    ["let r=a.valence??.1;if(!Number.isFinite(r)", "let r=a.gpmUprisingShell?0:a.valence??.1;if(!Number.isFinite(r)"],
    ["t.pol._partyOrganizationMonth=A;for(let a of t.pol.parties){",
      "t.pol._partyOrganizationMonth=A;for(let a of t.pol.parties){if(a.gpmUprisingShell||a.gpmUprisingExcluded)continue;"],
    ["function VYr(e,t,A){for(let a of t.pol.parties)if(", "function VYr(e,t,A){for(let a of t.pol.parties)if(!a.gpmUprisingShell&&!a.gpmUprisingExcluded&&"],
    ['if(!r)return{ok:!1,reason:"party"};let o=Qo(e)',
      'if(!r||r.gpmUprisingShell||r.gpmUprisingExcluded)return{ok:!1,reason:"party"};let o=Qo(e)'],
  ];
  return anchors.reduce((code, [anchor, replacement]) => replaceOnce(code, anchor, replacement), source);
}

module.exports = { patchUprisingWorker, dynamicFlagKey };

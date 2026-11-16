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
    ["this.sim=b,o?retirePartyCongresses(b)",
      "this.sim=b,!o&&gpmUprising.captureStartingIdentities(b),o?retirePartyCongresses(b)"],
    ['if (party.gpmForeignFunding) advancePartyForeignFunding(sim, country, party);',
      'if (party.gpmForeignFunding) advancePartyForeignFunding(sim, country, party);\n      if (party.gpmUprisingPreparations) gpmUprising.advancePreparations(sim, country, party);'],
    ['t.parties.map(a=>({...a,view:{color:yC(a)',
      't.parties.map(({gpmUprisingPreparations,gpmForeignFunding,...a})=>({...a,view:{color:yC(a)'],
    ['(a==="gpm.foreignFunding"?',
      '(a==="gpm.uprising"?gpmUprising.view(r):a==="gpm.foreignFunding"?'],
    ['independence:Awt(e)})', 'independence:Awt(e),gpmUprisingFlags:gpmUprising.flags(e)})'],
    ['Kh=e=>xMo.test(fw(e))||oRe(fw(e))!==null',
      `Kh=e=>xMo.test(fw(e))||oRe(fw(e))!==null||${dynamicFlagKey}.test(fw(e))`],
    ['setBaseFlag(t){return{ok:$or(this,t)}}',
      'setBaseFlag(t){const ok=$or(this,t);if(ok)gpmUprising.clearLegacyFlag(this,t);return{ok}}'],
    ['e._onWarEnd&&e._onWarEnd(u)}function jht(',
      'e._onWarEnd&&e._onWarEnd(u),gpmUprising.record(e,s,a)}function jht('],
    ['t.support.e<=0&&!e.playerControlsGovernment(a)&&jht',
      't.support.e<=0&&(!e.playerControlsGovernment(a)||gpmUprising.matches(e,t))&&jht'],
    ['function*wGo(e,t){', 'function*wGo(e,t){gpmUprising.settle(e);'],
    ['id:`player:${t.key}`,mode:"operational"', 'id:a.id||`player:${t.key}`,mode:"operational"'],
    ['function qst(e,t,a=null){let r=[...e.formations?.values()||[]].filter(u=>t?',
      'function qst(e,t,a=null,gpmOwner=null){let r=[...e.formations?.values()||[]].filter(u=>!gpmOwner||u.owner===gpmOwner).filter(u=>t?'],
    ['function d1t(e,t,a,r="ceasefire"){', 'function d1t(e,t,a,r="ceasefire",gpmCountry=null){'],
    ['!c||!o.has(l.owner)||!(c.warKey===t.id',
      '!c||!o.has(l.owner)||gpmCountry&&!gpmUprising.missionInvolves(e,c,l.owner,gpmCountry)||!(c.warKey===t.id'],
    ['for(let l of t.missileMissions||[]){if(!l||l.resolved)continue;',
      'for(let l of t.missileMissions||[]){if(!l||l.resolved||gpmCountry&&!gpmUprising.missionInvolves(e,l,l.owner,gpmCountry))continue;'],
    ['await this.commitTransportBoundary(a),this.invalidateDomainCallViews(r)',
      'gpmUprising.settle(a);await this.commitTransportBoundary(a),this.invalidateDomainCallViews(r)'],
    ['function Eht(e,t,a,r){if(!Array.isArray(r))',
      'function Eht(e,t,a,r){if(gpmUprising.matches(e,t)&&r?.length)return{ok:!1,reasonId:"civil_war_decisive"};if(!Array.isArray(r))'],
    ["filter(i=>i.legal===!1);if(!a.length)return null;let r=MCe",
      "filter(i=>i.legal===!1&&!i.gpmUprisingShell&&!i.gpmUprisingExcluded);if(!a.length)return null;let r=MCe"],
    ["function v6(e,t,a){",
      "function v6(e,t,a){if(e.parties?.some(p=>p.gpmUprisingShell||p.gpmUprisingExcluded)){t={...t};for(const p of e.parties)if(p.gpmUprisingShell||p.gpmUprisingExcluded)delete t[p.id];}"],
    ["function mW(e,t){let a=e.parties;", "function mW(e,t){let a=e.parties.filter(p=>!p.gpmUprisingShell);"],
    ['&&(x.state="ready"),x.location?.type==="front"',
      '&&!x.gpmUprisingStaffing&&(x.state="ready"),x.location?.type==="front"'],
    ['n.strength=cC(n,i),Object.keys(d).length||p>0?',
      'n.strength=cC(n,i),gpmUprising.refreshStaffing(n),Object.keys(d).length||p>0?'],
    ["let o=r.valence??.1;if(!Number.isFinite(o)", "let o=r.gpmUprisingShell?0:r.valence??.1;if(!Number.isFinite(o)"],
    ["t.pol._partyOrganizationMonth=a;for(let r of t.pol.parties){",
      "t.pol._partyOrganizationMonth=a;for(let r of t.pol.parties){if(r.gpmUprisingShell||r.gpmUprisingExcluded)continue;"],
    ["function $0o(e,t,a){for(let r of t.pol.parties)if(", "function $0o(e,t,a){for(let r of t.pol.parties)if(!r.gpmUprisingShell&&!r.gpmUprisingExcluded&&"],
    ['if(!o)return{ok:!1,reason:"party"};let n=un(e)',
      'if(!o||o.gpmUprisingShell||o.gpmUprisingExcluded)return{ok:!1,reason:"party"};let n=un(e)'],
  ];
  return anchors.reduce((code, [anchor, replacement]) => replaceOnce(code, anchor, replacement), source);
}

module.exports = { patchUprisingWorker, dynamicFlagKey };

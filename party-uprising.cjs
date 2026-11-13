"use strict";

const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const workerCode = readFileSync(join(__dirname, "party-uprising-worker.js"), "utf8");

function patchUprisingWorker(source, replaceOnce) {
  const anchors = [
    ["registerPartyCongressSize();\nconst gpmRegionalRules",
      "registerPartyCongressSize();\n" + workerCode + "\nconst gpmRegionalRules"],
    ['(a==="gpm.foreignFunding"?',
      '(a==="gpm.uprising"?gpmUprising.view(r):a==="gpm.foreignFunding"?'],
    ['e._onWarEnd&&e._onWarEnd(u)}function p3t(',
      'e._onWarEnd&&e._onWarEnd(u),gpmUprising.record(e,s,a)}function p3t('],
    ['t.support.e<=0&&!e.playerControlsGovernment(a)&&p3t',
      't.support.e<=0&&(!e.playerControlsGovernment(a)||gpmUprising.matches(e,t))&&p3t'],
    ['function*Hko(e,t){', 'function*Hko(e,t){gpmUprising.settle(e);'],
    ['await this.commitTransportBoundary(a),this.invalidateDomainCallViews(r)',
      'gpmUprising.settle(a);await this.commitTransportBoundary(a),this.invalidateDomainCallViews(r)'],
    ['function Jft(e,t,a,r){if(!Array.isArray(r))',
      'function Jft(e,t,a,r){if(gpmUprising.matches(e,t)&&r?.length)return{ok:!1,reasonId:"civil_war_decisive"};if(!Array.isArray(r))'],
    ["filter(i=>i.legal===!1);if(!a.length)return null;let r=bIe",
      "filter(i=>i.legal===!1&&!i.gpmUprisingShell&&!i.gpmUprisingExcluded);if(!a.length)return null;let r=bIe"],
    ["function Dh(e,t,a){",
      "function Dh(e,t,a){if(e.parties?.some(p=>p.gpmUprisingShell||p.gpmUprisingExcluded)){t={...t};for(const p of e.parties)if(p.gpmUprisingShell||p.gpmUprisingExcluded)delete t[p.id];}"],
    ["function jN(e,t){let a=e.parties;", "function jN(e,t){let a=e.parties.filter(p=>!p.gpmUprisingShell);"],
    ["let o=r.valence??.1;if(!Number.isFinite(o)", "let o=r.gpmUprisingShell?0:r.valence??.1;if(!Number.isFinite(o)"],
    ["t.pol._partyOrganizationMonth=a;for(let r of t.pol.parties){",
      "t.pol._partyOrganizationMonth=a;for(let r of t.pol.parties){if(r.gpmUprisingShell||r.gpmUprisingExcluded)continue;"],
    ["function dto(e,t,a){for(let r of t.pol.parties)if(", "function dto(e,t,a){for(let r of t.pol.parties)if(!r.gpmUprisingShell&&!r.gpmUprisingExcluded&&"],
    ['if(!o)return{ok:!1,reason:"party"};let n=Wo(e)',
      'if(!o||o.gpmUprisingShell||o.gpmUprisingExcluded)return{ok:!1,reason:"party"};let n=Wo(e)'],
  ];
  return anchors.reduce((code, [anchor, replacement]) => replaceOnce(code, anchor, replacement), source);
}

module.exports = { patchUprisingWorker };
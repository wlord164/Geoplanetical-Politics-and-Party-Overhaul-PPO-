"use strict";

const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const worker = readFileSync(join(__dirname, "historical-sudan-reunification.js"), "utf8");

function patchSudanReunificationWorker(source, replaceOnce) {
  const hooks = [
    ['function gpmHistoricalStrength(sim, actorId, kind)', worker + '\nfunction gpmHistoricalStrength(sim, actorId, kind)'],
    ['let l=e.countries.get(t),c=aet(e,s),u=hG(e,r,i,n,s);',
      'let l=e.countries.get(t),c=aet(e,s),u=gpmHistoricalCivilWarTerms(e,r,i,n,s,undefined,"negotiated-concession");'],
    ['s=bV(e,t,n.key,i.key),l=aet(e,s),c=hG(e,t,n.key,i.key,s);',
      's=bV(e,t,n.key,i.key),l=aet(e,s),c=gpmHistoricalCivilWarTerms(e,t,n.key,i.key,s);'],
    ['u=bV(e,a,s.key,l.key,c),d=aet(e,u),E=hG(e,a,s.key,l.key,u,c);',
      'u=bV(e,a,s.key,l.key,c),d=aet(e,u),E=gpmHistoricalCivilWarTerms(e,a,s.key,l.key,u,c,"developer-override");'],
    ['c=bV(e,r,s.key,l.key,a),u=hG(e,r,s.key,l.key,c,a);',
      'c=bV(e,r,s.key,l.key,a),u=gpmHistoricalCivilWarTerms(e,r,s.key,l.key,c,a);'],
    ['l=hG(e,t,a.winnerKey,a.loserKey,a.terms);',
      'l=gpmHistoricalCivilWarTerms(e,t,a.winnerKey,a.loserKey,a.terms);'],
    ['t.support.e<=0&&(!e.playerControlsGovernment(A)||gpmUprising.matches(e,t))&&XNt',
      't.support.e<=0&&(!e.playerControlsGovernment(A)||gpmUprising.matches(e,t)||gpmSudanWarRow(e,t)||gpmHistoricalOpeningWar(e,t))&&XNt'],
    ['function*bMo(e,t){gpmHistoricalAdvance(e);', 'function*bMo(e,t){gpmSudanReunify(e);gpmHistoricalSettleOpeningWars(e);gpmHistoricalAdvance(e);'],
    ['gpmUprising.settle(A);await this.commitTransportBoundary(A),this.invalidateDomainCallViews(a)',
      'gpmUprising.settle(A);gpmSudanReunify(A);gpmHistoricalSettleOpeningWars(A);await this.commitTransportBoundary(A),this.invalidateDomainCallViews(a)'],
    ['aidUntil: row.aidUntil, settlement: row.settlement || null',
      'aidUntil: row.aidUntil, settlement: row.settlement || null, administrationName: row.administrationName || null'],
    ['function zNt(e,t,A,a){if(gpmUprising.matches(e,t)&&a?.length)',
      'function zNt(e,t,A,a){if((gpmUprising.matches(e,t)||gpmSudanWarRow(e,t)||gpmHistoricalOpeningWar(e,t))&&a?.length)'],
  ];
  return hooks.reduce((code, [before, after]) => replaceOnce(code, before, after), source);
}

function patchSudanReunificationRenderer(source, replaceOnce) {
  const changes = [
    ['(previous.startsWith("ppo-uprising-") || key.startsWith("ppo-uprising-"))',
      '(previous.startsWith("ppo-uprising-") || key.startsWith("ppo-uprising-") || previous === "gpm-historical-sdn-rsf" || key === "gpm-historical-sdn-rsf")'],
    ['"native-settlement": "War settlement",',
      '"native-settlement": "War settlement", "tasis-reunification": "Reunification under Tasis", "saf-reunification": "Reunification under the Sudanese government",'],
  ];
  return changes.reduce((code, [before, after]) => replaceOnce(code, before, after), source);
}

module.exports = { patchSudanReunificationWorker, patchSudanReunificationRenderer };

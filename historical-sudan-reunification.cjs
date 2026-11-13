"use strict";

const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const worker = readFileSync(join(__dirname, "historical-sudan-reunification.js"), "utf8");

function patchSudanReunificationWorker(source, replaceOnce) {
  const hooks = [
    ['function gpmHistoricalStrength(actorId)', worker + '\nfunction gpmHistoricalStrength(actorId)'],
    ['let c=e.countries.get(t),u=IOe(e,l),d=HE(e,o,s,i,l);',
      'let c=e.countries.get(t),u=IOe(e,l),d=gpmSudanDecisiveTerms(e,o,s,i,l);'],
    ['l=kG(e,t,i.key,s.key),c=IOe(e,l),u=HE(e,t,i.key,s.key,l);',
      'l=kG(e,t,i.key,s.key),c=IOe(e,l),u=gpmSudanDecisiveTerms(e,t,i.key,s.key,l);'],
    ['d=kG(e,r,l.key,c.key,u),p=IOe(e,d),m=HE(e,r,l.key,c.key,d,u);',
      'd=kG(e,r,l.key,c.key,u),p=IOe(e,d),m=gpmSudanDecisiveTerms(e,r,l.key,c.key,d,u);'],
    ['u=kG(e,o,l.key,c.key,r),d=HE(e,o,l.key,c.key,u,r);',
      'u=kG(e,o,l.key,c.key,r),d=gpmSudanDecisiveTerms(e,o,l.key,c.key,u,r);'],
    ['c=HE(e,t,r.winnerKey,r.loserKey,r.terms);',
      'c=gpmSudanDecisiveTerms(e,t,r.winnerKey,r.loserKey,r.terms);'],
    ['t.support.e<=0&&(!e.playerControlsGovernment(a)||gpmUprising.matches(e,t))&&Zyt',
      't.support.e<=0&&(!e.playerControlsGovernment(a)||gpmUprising.matches(e,t)||gpmSudanWarRow(e,t))&&Zyt'],
    ['function*oxo(e,t){gpmHistoricalAdvance(e);', 'function*oxo(e,t){gpmSudanReunify(e);gpmHistoricalAdvance(e);'],
    ['gpmUprising.settle(a);await this.commitTransportBoundary(a),this.invalidateDomainCallViews(r)',
      'gpmUprising.settle(a);gpmSudanReunify(a);await this.commitTransportBoundary(a),this.invalidateDomainCallViews(r)'],
    ['aidUntil: row.aidUntil, settlement: row.settlement || null',
      'aidUntil: row.aidUntil, settlement: row.settlement || null, administrationName: row.administrationName || null'],
    ['function Tyt(e,t,a,r){if(gpmUprising.matches(e,t)&&r?.length)',
      'function Tyt(e,t,a,r){if((gpmUprising.matches(e,t)||gpmSudanWarRow(e,t))&&r?.length)'],
  ];
  return hooks.reduce((code, [before, after]) => replaceOnce(code, before, after), source);
}

function patchSudanReunificationRenderer(source, replaceOnce) {
  const changes = [
    ['(previous.startsWith("ppo-uprising-") || key.startsWith("ppo-uprising-"))',
      '(previous.startsWith("ppo-uprising-") || key.startsWith("ppo-uprising-") || previous === "gpm-historical-sdn-rsf" || key === "gpm-historical-sdn-rsf")'],
    ['"native-settlement": "War settlement",',
      '"native-settlement": "War settlement", "tasis-reunification": "Reunification under Tasis", "saf-reunification": "Reunification under the Sudanese government",'],
    ['${conflict.settlement ? `<p>Settlement · ${b(gpmHistoricalLabel(conflict.settlement))}</p>` : ""}',
      '${conflict.settlement ? `<p>Settlement · ${b(gpmHistoricalLabel(conflict.settlement))}</p>` : ""}\n    ${conflict.administrationName ? `<p>Postwar administration · ${b(conflict.administrationName)}</p>` : ""}'],
  ];
  return changes.reduce((code, [before, after]) => replaceOnce(code, before, after), source);
}

module.exports = { patchSudanReunificationWorker, patchSudanReunificationRenderer };

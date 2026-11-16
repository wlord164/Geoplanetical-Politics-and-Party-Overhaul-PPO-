"use strict";

const payrollWorkers = {
  wageBillBnY: "employmentM",
  employerContributionBnY: "employmentM",
  wageBill0BnY: "employment0M",
  employerContribution0BnY: "employment0M",
};

function gpmMoveTerritorialPayroll(source, target, workers, movedWorkers) {
  if (!(movedWorkers > 0)) return;
  const share = movedWorkers / source[workers];
  for (const [field, matchedWorkers] of Object.entries(gpmTerritorialPayrollWorkers)) {
    if (matchedWorkers !== workers) continue;
    const movedPayroll = je(source[field]) * share;
    source[field] = je(source[field]) - movedPayroll;
    target[field] = je(target[field]) + movedPayroll;
  }
}

function patchTerritorialPayroll(source, replaceOnce) {
  // Preserve wages and contributions per worker when productive assets and
  // employment move in different proportions. Keep the territorial share for
  // payroll records with no workers available to supply a proportion.
  source = replaceOnce(source, "function VJe(e,t){",
    `const gpmTerritorialPayrollWorkers=${JSON.stringify(payrollWorkers)};\n${gpmMoveTerritorialPayroll}\nfunction VJe(e,t){`);
  source = replaceOnce(source, "for(let S of cQt){let P=je(u[S])*p;u[S]=je(u[S])-P,m[S]=je(m[S])+P}",
    "for(let S of cQt){if(je(u[gpmTerritorialPayrollWorkers[S]])>0)continue;let P=je(u[S])*p;u[S]=je(u[S])-P,m[S]=je(m[S])+P}");
  return replaceOnce(source, "u[S]=Math.max(0,je(u[S])-P),m[S]=Math.max(0,je(m[S])+P)}let b={requiredEmploymentM:i",
    "gpmMoveTerritorialPayroll(u,m,S,P),u[S]=Math.max(0,je(u[S])-P),m[S]=Math.max(0,je(m[S])+P)}let b={requiredEmploymentM:i");
}

module.exports = { patchTerritorialPayroll };

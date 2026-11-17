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
    const movedPayroll = Qe(source[field]) * share;
    source[field] = Qe(source[field]) - movedPayroll;
    target[field] = Qe(target[field]) + movedPayroll;
  }
}

function patchTerritorialPayroll(source, replaceOnce) {
  // Preserve wages and contributions per worker when productive assets and
  // employment move in different proportions. Keep the territorial share for
  // payroll records with no workers available to supply a proportion.
  source = replaceOnce(source, "function Irt(e,t){",
    `const gpmTerritorialPayrollWorkers=${JSON.stringify(payrollWorkers)};\n${gpmMoveTerritorialPayroll}\nfunction Irt(e,t){`);
  source = replaceOnce(source, "for(let S of foa){let P=Qe(u[S])*p;u[S]=Qe(u[S])-P,m[S]=Qe(m[S])+P}",
    "for(let S of foa){if(Qe(u[gpmTerritorialPayrollWorkers[S]])>0)continue;let P=Qe(u[S])*p;u[S]=Qe(u[S])-P,m[S]=Qe(m[S])+P}");
  return replaceOnce(source, "u[S]=Math.max(0,Qe(u[S])-P),m[S]=Math.max(0,Qe(m[S])+P)}let b={requiredEmploymentM:i",
    "gpmMoveTerritorialPayroll(u,m,S,P),u[S]=Math.max(0,Qe(u[S])-P),m[S]=Math.max(0,Qe(m[S])+P)}let b={requiredEmploymentM:i");
}

module.exports = { patchTerritorialPayroll };

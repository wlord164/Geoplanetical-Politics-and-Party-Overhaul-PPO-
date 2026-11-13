"use strict";

function partySupportBaseView(sim, country, partyId, electorate) {
  if (partyId == null) return null;
  const breakdown = electorate === undefined ? sim._electorateBreakdown(country) : electorate;
  if (!breakdown?.blocs?.length) return null;

  const blocs = [];
  for (const bloc of breakdown.blocs) {
    if (!Number.isFinite(bloc.share) || bloc.share <= 0) continue;
    if (!Array.isArray(bloc.votes)) return null;
    const vote = bloc.votes.find(result => result.id === partyId)?.v;
    const withinBloc = Number.isFinite(vote) ? Math.max(0, Math.min(1, vote)) : 0;
    blocs.push({ id: bloc.id, withinBloc, contribution: bloc.share * withinBloc });
  }
  if (!blocs.length) return null;

  const total = blocs.reduce((sum, bloc) => sum + bloc.contribution, 0);
  blocs.sort((a, b) => b.contribution - a.contribution || a.id.localeCompare(b.id));
  return {
    blocs: blocs.map(({ id, withinBloc, contribution }) => ({
      id,
      withinBloc,
      shareOfSupport: total > 0 ? contribution / total : 0,
    })),
  };
}

function renderPartySupportBase(view) {
  const blocs = view.party?.supportBase?.blocs;
  const percent = new Intl.NumberFormat(cs(), { style: "percent", maximumFractionDigits: 1 });
  const format = fraction => fraction > 0 && fraction < .001 ? "<" + percent.format(.001) : percent.format(fraction);
  const rows = blocs?.some(bloc => bloc.shareOfSupport > 0) ? blocs.map(bloc => `
    <li class="gpm-support-bloc">
      <div class="gpm-support-bloc-line"><strong>${b(Vr(bloc.id))}</strong><span class="num">${b(format(bloc.shareOfSupport))}</span></div>
      <div class="gpm-support-track" aria-hidden="true"><span style="width:${(100 * bloc.shareOfSupport).toFixed(2)}%"></span></div>
      <small>${b(format(bloc.withinBloc))} support within this bloc</small>
    </li>`).join("") : "";
  return `<section class="mcard wide gpm-party-support-base" aria-label="Support base">
    <h3 class="mc-title">Support Base</h3>
    ${rows ? `<small>Share of your party’s estimated support from each voter bloc.</small><ol class="gpm-support-blocs">${rows}</ol>`
      : `<p class="empty-note">${blocs?.length ? "No estimated party support to break down." : "Voter bloc estimates are unavailable."}</p>`}
  </section>`;
}

module.exports = {
  workerFunctions: [partySupportBaseView],
  rendererFunctions: [renderPartySupportBase],
};

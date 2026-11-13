function partyLawResultContext(event, context) {
  const snapshot = im(context);
  const countryKey = event.payload?.countryKey || snapshot?.countryKey;
  const sim = context?.sim;
  if (!countryKey || !sim) return snapshot;

  const player = sim.readView?.(G.POLITICS)?.player;
  const parliament = sim.readView?.(G.SITROOM)?.parliament;
  const savedParties = (player?.key === countryKey ? player.pol?.parties : null)
    || (parliament?.countryKey === countryKey ? parliament.parties : null);
  return { ...snapshot, countryKey, savedParties };
}

function partyLawResultIdeology(row, snapshot, saved) {
  const atVote = row.gpmVoteProfile;
  for (const profile of [atVote, snapshot, saved]) {
    if (estimatePartyIdeology(profile?.ideology)) return partyIdeologyLabel(profile);
  }

  const recorded = atVote?.view?.family || snapshot?.view?.family || row.family || saved?.view?.family || saved?.family;
  if (typeof recorded !== 'string' || !recorded) return '';
  const key = recorded.startsWith('pol.family.') ? recorded : `pol.family.${recorded}`;
  return st(key) ? o(key) : recorded;
}

function partyLawVoteDetail(country, rows) {
  const parties = new Map((country.pol?.parties || []).map(party => [party.id, party]));
  return (rows || []).map(row => {
    const party = parties.get(row.id);
    if (!party) return row;
    const gpmVoteProfile = {
      id: party.id,
      ideology: party.ideology ? { ...party.ideology } : null,
      nameDesc: party.nameDesc ? { ...party.nameDesc } : null,
      view: { family: a6(party), color: Q_(party) },
    };
    return { ...row, gpmVoteProfile };
  });
}

function patchLawLabels(js, replaceOnce) {
  const formatter = 'function ax(e=[],t={}){';
  js = replaceOnce(js, formatter, `${partyLawResultContext}\n${partyLawResultIdeology}\n${formatter}`);
  js = replaceOnce(js,
    'let a=(t?.parties||[]).map(i=>({...i,countryKey:i.countryKey||t.countryKey})),n=PA(a,t?.countryKey),r=t?.institutionState?.government||t||{};return e.map(i=>{let s=i.partyId??i.id,l=a.find(p=>p.id===s),',
    `let a=(t?.parties||[]).map(i=>({...i,countryKey:i.countryKey||t.countryKey}));
    const snapshots=new Map(a.map(party=>[party.id,party]));
    const saved=new Map((t?.savedParties||[]).map(party=>[party.id,party]));
    const named=new Set(snapshots.keys());
    for (const row of e) {
      const id=row.partyId??row.id;
      const profile=row.gpmVoteProfile||saved.get(id);
      if (named.has(id)||!profile) continue;
      named.add(id);
      a.push({...profile,id,countryKey:t?.countryKey});
    }
    let n=PA(a,t?.countryKey),r=t?.institutionState?.government||t||{};return e.map(i=>{let s=i.partyId??i.id,l=snapshots.get(s)||i.gpmVoteProfile||saved.get(s),`);
  js = replaceOnce(js,
    'u=l?.view?.family?`pol.family.${l.view.family}`:null,d=`pol.role.${c==="partner"?"coalition":c}`;',
    'u=partyLawResultIdeology(i,snapshots.get(s),saved.get(s)),d=`pol.role.${c==="partner"?"coalition":c}`;');
  js = replaceOnce(js,
    'identity:[u,d].filter(p=>p&&st(p)).map(p=>o(p)).join(" \\xB7 "),family:u&&st(u)?o(u):"",',
    'identity:[u,st(d)?o(d):""].filter(Boolean).join(" \\xB7 "),family:u,');
  js = replaceOnce(js, 'FB(e.payload,im(t),{ccy:', 'FB(e.payload,partyLawResultContext(e,t),{ccy:');
  js = replaceOnce(js,
    'parties:ax(a.parties,im(t)),stages:J9(a.history,im(t)),approvalCost:',
    'parties:ax(a.parties,partyLawResultContext(e,t)),stages:J9(a.history,im(t)),approvalCost:');
  return replaceOnce(js,
    'parties:ax(a.parties,im(t)),stages:J9(a.history,im(t))}}});H("politics.snap_election_rejected"',
    'parties:ax(a.parties,partyLawResultContext(e,t)),stages:J9(a.history,im(t))}}});H("politics.snap_election_rejected"');
}

function patchLawVoteSnapshots(js, replaceOnce) {
  const law = 'function L2e(e,t,a,r=!1,o={}){';
  js = replaceOnce(js, law, `${partyLawVoteDetail}\n${law}`);
  js = replaceOnce(js,
    'if(n)return N2e(e,t,a,null,{passes:!0,decreed:!0,history:[]});let c={executiveStages:!1}',
    'if(n)return N2e(e,t,a,null,{passes:!0,decreed:!0,history:[]});if(!a.parliamentaryVote)l.detail=partyLawVoteDetail(t,l.detail);let c={executiveStages:!1}');
  js = replaceOnce(js,
    'parties:r.detail.map(v=>({partyId:v.id,seats:v.seats,vote:!!v.vote,yesSeats:v.yesSeats??null,noSeats:v.noSeats??null,role:v.role||null}))',
    'parties:r.detail.map(v=>({partyId:v.id,seats:v.seats,vote:!!v.vote,yesSeats:v.yesSeats??null,noSeats:v.noSeats??null,role:v.role||null,gpmVoteProfile:(a.parliamentaryVote?.detail?.find(row=>row.id===v.id)||v).gpmVoteProfile||null}))');
  js = replaceOnce(js,
    'detail:(n.parliamentaryVote.detail||[]).map(d=>({partyId:d.id,seats:d.seats,vote:!!d.vote,yesSeats:d.yesSeats??null,noSeats:d.noSeats??null,role:d.role||null}))',
    'detail:(n.parliamentaryVote.detail||[]).map(d=>({partyId:d.id,seats:d.seats,vote:!!d.vote,yesSeats:d.yesSeats??null,noSeats:d.noSeats??null,role:d.role||null,gpmVoteProfile:d.gpmVoteProfile||null}))');
  js = replaceOnce(js,
    'let l=a.fc||efe(i,s,a.params,e._electoralMap(t)),c,u=!1,d=!1,p=[],m=!1,f=null;if(r)c=!0;',
    'let l=a.fc||efe(i,s,a.params,e._electoralMap(t)),c,u=!1,d=!1,p=[],m=!1,f=null;if(!n)l.detail=partyLawVoteDetail(t,l.detail);if(r)c=!0;');
  js = replaceOnce(js,
    'parties:(l.detail||[]).map(I=>({partyId:I.id,seats:Number(I.seats||0),vote:!!I.vote,yesSeats:I.yesSeats??null,noSeats:I.noSeats??null,role:I.role||null}))',
    'parties:(l.detail||[]).map(I=>({partyId:I.id,seats:Number(I.seats||0),vote:!!I.vote,yesSeats:I.yesSeats??null,noSeats:I.noSeats??null,role:I.role||null,gpmVoteProfile:I.gpmVoteProfile||null}))');
  return replaceOnce(js,
    'p={currencyCode:a.ccy?.code||null,leadPartyId:Xe(a)?.government?.leadPartyId||null,coalitionPartyIds:(Xe(a)?.government?.coalitionPartyIds||[]).map(String),parties:(u.parties||[]).map(m=>({id:String(m.id),countryKey:a.key,nameDesc:rv(m.nameDesc),view:{color:Q_(m),family:a6(m)}}))',
    'p={countryKey:a.key,currencyCode:a.ccy?.code||null,leadPartyId:Xe(a)?.government?.leadPartyId||null,coalitionPartyIds:(Xe(a)?.government?.coalitionPartyIds||[]).map(String),parties:(u.parties||[]).map(m=>({id:String(m.id),countryKey:a.key,nameDesc:rv(m.nameDesc),ideology:rv(m.ideology||null),view:{color:Q_(m),family:a6(m)}}))');
}

module.exports = { patchLawLabels, patchLawVoteSnapshots };

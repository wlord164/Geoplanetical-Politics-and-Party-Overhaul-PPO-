function partyLawResultContext(event, context) {
  const snapshot = Dh(context);
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
  return Qe(key) ? o(key) : recorded;
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
      view: { family: Am(party), color: W7(party) },
    };
    return { ...row, gpmVoteProfile };
  });
}

function patchLawLabels(js, replaceOnce) {
  const formatter = 'function sN(e=[],t={}){';
  js = replaceOnce(js, formatter, `${partyLawResultContext}\n${partyLawResultIdeology}\n${formatter}`);
  js = replaceOnce(js,
    'let a=(t?.parties||[]).map(i=>({...i,countryKey:i.countryKey||t.countryKey})),n=Q4(a,t?.countryKey),r=t?.institutionState?.government||t||{};return e.map(i=>{let s=i.partyId??i.id,l=a.find(p=>p.id===s),',
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
    let n=Q4(a,t?.countryKey),r=t?.institutionState?.government||t||{};return e.map(i=>{let s=i.partyId??i.id,l=snapshots.get(s)||i.gpmVoteProfile||saved.get(s),`);
  js = replaceOnce(js,
    'u=l?.view?.family?`pol.family.${l.view.family}`:null,d=`pol.role.${c==="partner"?"coalition":c}`;',
    'u=partyLawResultIdeology(i,snapshots.get(s),saved.get(s)),d=`pol.role.${c==="partner"?"coalition":c}`;');
  js = replaceOnce(js,
    'identity:[u,d].filter(p=>p&&Qe(p)).map(p=>o(p)).join(" \\xB7 "),family:u&&Qe(u)?o(u):"",',
    'identity:[u,Qe(d)?o(d):""].filter(Boolean).join(" \\xB7 "),family:u,');
  js = replaceOnce(js, 'aK(e.payload,Dh(t),{ccy:', 'aK(e.payload,partyLawResultContext(e,t),{ccy:');
  js = replaceOnce(js,
    'parties:sN(a.parties,Dh(t)),stages:vP(a.history,Dh(t)),approvalCost:',
    'parties:sN(a.parties,partyLawResultContext(e,t)),stages:vP(a.history,Dh(t)),approvalCost:');
  return replaceOnce(js,
    'parties:sN(a.parties,Dh(t)),stages:vP(a.history,Dh(t))}}});K("politics.snap_election_rejected"',
    'parties:sN(a.parties,partyLawResultContext(e,t)),stages:vP(a.history,Dh(t))}}});K("politics.snap_election_rejected"');
}

function patchLawVoteSnapshots(js, replaceOnce) {
  const law = 'function K5e(e,t,A,a=!1,r={}){';
  js = replaceOnce(js, law, `${partyLawVoteDetail}\n${law}`);
  js = replaceOnce(js,
    'if(o)return _5e(e,t,A,null,{passes:!0,decreed:!0,history:[]});let l={executiveStages:!1}',
    'if(o)return _5e(e,t,A,null,{passes:!0,decreed:!0,history:[]});if(!A.parliamentaryVote)s.detail=partyLawVoteDetail(t,s.detail);let l={executiveStages:!1}');
  js = replaceOnce(js,
    'parties:a.detail.map(f=>({partyId:f.id,seats:f.seats,vote:!!f.vote,yesSeats:f.yesSeats??null,noSeats:f.noSeats??null,role:f.role||null}))',
    'parties:a.detail.map(f=>({partyId:f.id,seats:f.seats,vote:!!f.vote,yesSeats:f.yesSeats??null,noSeats:f.noSeats??null,role:f.role||null,gpmVoteProfile:(a.parliamentaryVote?.detail?.find(row=>row.id===f.id)||f).gpmVoteProfile||null}))');
  js = replaceOnce(js,
    'detail:(o.parliamentaryVote.detail||[]).map(u=>({partyId:u.id,seats:u.seats,vote:!!u.vote,yesSeats:u.yesSeats??null,noSeats:u.noSeats??null,role:u.role||null}))',
    'detail:(o.parliamentaryVote.detail||[]).map(u=>({partyId:u.id,seats:u.seats,vote:!!u.vote,yesSeats:u.yesSeats??null,noSeats:u.noSeats??null,role:u.role||null,gpmVoteProfile:u.gpmVoteProfile||null}))');
  js = replaceOnce(js,
    'let s=A.fc||m7e(n,i,A.params,e._electoralMap(t)),l,c=!1,u=!1,d=[],E=!1,B=null;if(a)l=!0;',
    'let s=A.fc||m7e(n,i,A.params,e._electoralMap(t)),l,c=!1,u=!1,d=[],E=!1,B=null;if(!n)s.detail=partyLawVoteDetail(t,s.detail);if(a)l=!0;');
  js = replaceOnce(js,
    'parties:(s.detail||[]).map(b=>({partyId:b.id,seats:Number(b.seats||0),vote:!!b.vote,yesSeats:b.yesSeats??null,noSeats:b.noSeats??null,role:b.role||null}))',
    'parties:(s.detail||[]).map(b=>({partyId:b.id,seats:Number(b.seats||0),vote:!!b.vote,yesSeats:b.yesSeats??null,noSeats:b.noSeats??null,role:b.role||null,gpmVoteProfile:b.gpmVoteProfile||null}))');
  return replaceOnce(js,
    'd={currencyCode:A.ccy?.code||null,leadPartyId:Qt(A)?.government?.leadPartyId||null,coalitionPartyIds:(Qt(A)?.government?.coalitionPartyIds||[]).map(String),parties:(c.parties||[]).map(E=>({id:String(E.id),countryKey:A.key,nameDesc:Qb(E.nameDesc),view:{color:W7(E),family:Am(E)}}))',
    'd={countryKey:A.key,currencyCode:A.ccy?.code||null,leadPartyId:Qt(A)?.government?.leadPartyId||null,coalitionPartyIds:(Qt(A)?.government?.coalitionPartyIds||[]).map(String),parties:(c.parties||[]).map(E=>({id:String(E.id),countryKey:A.key,nameDesc:Qb(E.nameDesc),ideology:Qb(E.ideology||null),view:{color:W7(E),family:Am(E)}}))');
}

module.exports = { patchLawLabels, patchLawVoteSnapshots };

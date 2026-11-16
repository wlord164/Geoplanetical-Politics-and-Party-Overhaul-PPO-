"use strict";

function gpmStartQueuedRequestTimeout(client) {
  const request = client.requests.values().next().value;
  if (!request?.startQueuedTimeout) return;
  request.startQueuedTimeout();
  request.startQueuedTimeout = null;
}

function gpmRefreshViewTimeoutOnWork(client, work) {
  const request = client.requests.values().next().value;
  const watchdog = request?.viewWatchdog;
  if (!watchdog || request.timedOut || !work?.active || work.kind !== "monthly" ||
      !Number.isFinite(work.targetDay) || !Number.isFinite(work.workRevision)) return;
  const previous = watchdog.progress;
  if (previous && (work.targetDay < previous.targetDay ||
      work.targetDay === previous.targetDay && (work.workRevision < previous.workRevision ||
      work.workRevision === previous.workRevision && !(work.current > previous.current)))) return;
  watchdog.progress = work;
  const remaining = watchdog.deadline - performance.now();
  if (remaining <= 0) return;
  clearTimeout(request.timer);
  request.timer = watchdog.schedule(Math.min(watchdog.timeout, remaining));
}

function patchSimulationViewTimeout(js, replaceOnce) {
  // The Worker handles requests in post order. Give each bounded request its
  // full budget once it reaches the front, including the renderer's clock pulse.
  js = replaceOnce(js, 'var lq=class{constructor(t={}){',
    `${gpmStartQueuedRequestTimeout}\n${gpmRefreshViewTimeoutOnWork}\nvar lq=class{constructor(t={}){`);
  js = replaceOnce(js, 'let p=l===1/0?null:setTimeout(()=>{if(!this.requests.has(i))return;',
    'const startTimeout=(delay=l)=>l===1/0?null:setTimeout(()=>{if(!this.requests.has(i))return;');
  js = replaceOnce(js, '},l);this.requests.set(i,{resolve:u,reject:d,command:t,timer:p,recoveryTimer:null,',
    `},delay);
    const isFiniteView = t === hd.VIEW_SNAPSHOT && l !== Infinity;
    const deferTimeout = l !== Infinity && t !== hd.SHUTDOWN && this.requests.size > 0 &&
      [...this.requests.values()].every(request => request.hasTimeout);
    const viewWatchdog = isFiniteView ? {schedule:startTimeout,timeout:l,deadline:0,progress:null} : null;
    const armTimeout = () => {
      if (viewWatchdog) viewWatchdog.deadline = performance.now() + Math.max(l,this.advanceDaysTimeoutMs);
      return startTimeout();
    };
    const request = {resolve:u,reject:d,command:t,timer:deferTimeout?null:armTimeout(),
      viewWatchdog,hasTimeout:l!==Infinity,recoveryTimer:null,`);
  js = replaceOnce(js, 'onTransportSettled:typeof n.onTransportSettled=="function"?n.onTransportSettled:null})});try',
    `onTransportSettled:typeof n.onTransportSettled=="function"?n.onTransportSettled:null};
    if (deferTimeout) request.startQueuedTimeout = () => { request.timer = armTimeout(); };
    this.requests.set(i,request)});try`);
  // A snapshot may itself finish a pending month. Only forward progress from
  // that closing extends the idle budget, up to the native advance limit.
  js = replaceOnce(js, 'applyWork(t){if(this.failure||this.closed)return;',
    'applyWork(t){if(this.failure||this.closed)return;gpmRefreshViewTimeoutOnWork(this,t);');
  js = replaceOnce(js, 'this.requests.delete(a.requestId),clearTimeout(n.timer),clearTimeout(n.recoveryTimer),n.onTransportSettled?.(),',
    'this.requests.delete(a.requestId),clearTimeout(n.timer),clearTimeout(n.recoveryTimer),n.onTransportSettled?.(),gpmStartQueuedRequestTimeout(this),');
  return replaceOnce(js, 'this.requests.delete(i),d?.onTransportSettled?.(),Promise.reject(u)',
    'this.requests.delete(i),d?.onTransportSettled?.(),gpmStartQueuedRequestTimeout(this),Promise.reject(u)');
}

module.exports = { patchSimulationViewTimeout };

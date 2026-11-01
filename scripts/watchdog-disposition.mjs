/**
 * NagameAlert freshness watchdog: classify the ALREADY OBSERVED native report.
 * No network, filesystem writes, retries, recovery or synthetic certificates.
 * The original report.allFresh remains authoritative and unchanged.
 */
export const SOURCE_NAMES = Object.freeze(['AESAN','RAPNA','RASFF','SAFETY GATE','OECD']);
// Runtime #182's v35-audit-only-reader-v1 validates this immutable resolution,
// including original job/receipt hashes and committed effects. It explicitly
// preserves unknown certification; this identity grants no global PASS.
export function nativeHistoricalCertificationHolds(body) {
  const gate=body?.certificationGate;
  const attempt=body?.state?.revisionAttempts?.['RAPNA:current-parity'];
  if(gate?.protocol!=='v35-audit-only-reader-v1' || gate.allow!==false || gate.consumerAllow!==true ||
     gate.reason!=='V35_AUDIT_ONLY_READER' || gate.cycles!==0 || gate.unsafe!==0 || gate.legacyUnresolved!==0 ||
     attempt?.id!=='ab50d0f7-0ad7-4fb5-8078-f6c376aa8f53' || attempt.outcome!=='unknown' ||
     attempt.reason!=='REVISION_CERTIFICATION_HOLD' ||
     !Array.isArray(attempt.pendingDetails) || attempt.pendingDetails.length!==0) return [];
  return [{key:'RAPNA:current-parity',id:attempt.id,originalOutcome:'unknown',
    classification:'materialized-certification-unknown',protocol:gate.protocol}];
}
const names = new Set(SOURCE_NAMES);
const validSourceSet = rows => Array.isArray(rows) && rows.length === SOURCE_NAMES.length &&
  new Set(rows.map(row => row?.source)).size === SOURCE_NAMES.length &&
  rows.every(row => names.has(row?.source));

function disposition(level, reason, report, historicHolds=[]) {
  return Object.freeze({
    policy: 'nagamealert-watchdog-severity-v1',
    level,
    exitCode:level==='CRITICAL'?1:0,
    reason,
    globalOfficialAllFresh:report?.allFresh===true,
    recent:report?.channels?.recent?.verdict??'UNKNOWN',
    historical:report?.channels?.historical?.verdict??'UNKNOWN',
    historicalHolds:Object.freeze([...historicHolds]),
    preservedHistoricalUnknowns:Object.freeze([...(Array.isArray(report?.historicalEvidenceHolds)?report.historicalEvidenceHolds:[])]),
    zeroWrite:report?.zeroWrite===true,
    recoveryAuthorized:false,
  });
}

export function classifyWatchdogReport(report) {
  const critical=(reason)=>disposition('CRITICAL',reason,report);
  if(!report || typeof report!=='object' || Array.isArray(report))return critical('missing-report');
  if(report.authBlocked!==false || report.recoveryOutcomeUncertain!==false || report.auditOutcomeUncertain!==false || report.zeroWrite!==true)
    return critical('auth-uncertainty-or-write');
  // Current native reports include additional checks on fields lost in the summary.
  // Archived reports are classified only at their recorded summary's evidence level.
  if(Object.hasOwn(report,'evidenceIssues') &&
     (!Array.isArray(report.evidenceIssues) || report.evidenceIssues.length!==0))
    return critical('contradictory-or-unknown-native-evidence');
  if(report.policyVersion!==1 || report.supervisor!=='github-observes-cloudflare')
    return critical('unknown-policy-or-provenance');
  const channels=report.channels;
  if(!channels || channels.recoveryAuthorized!==false || channels.zeroWrite!==true ||
     channels.recent?.officialFreshnessCertified!==false ||
     channels.historical?.officialFreshnessCertified!==false)
    return critical('invalid-channel-provenance');
  if(!validSourceSet(report.states) || !validSourceSet(channels.recent?.sources) ||
     !validSourceSet(channels.historical?.sources))return critical('missing-or-duplicate-source');
  // This specific classification is for the two-read native observer only.
  // Legacy mutating audits, uncertain transports and HTTP errors cannot become warnings.
  if(!Array.isArray(report.calls) || report.calls.length!==2 ||
     !report.calls.every(c=>c && c.method==='GET' && c.http===200 &&
       ['native-heartbeat','policy'].includes(c.phase)) ||
     new Set(report.calls.map(c=>c.phase)).size!==2)
    return critical('native-transport-or-method-unknown');
  if(channels.coordinator?.verdict!=='OBSERVED' || channels.recent.verdict!=='OBSERVED' ||
     channels.recent.sources.some(s=>s.verdict!=='OBSERVED'))
    return critical('coordinator-or-recent-not-verified');
  if(report.states.some(s=>!['PASS','HOLD'].includes(s.verdict) || s.recentFresh!==true ||
      s.parity!==true || s.reason!==null))
    return critical('recent-parity-or-source-evidence');
  const validAge = value => Number.isFinite(value) && value>=0;
  if(!validAge(channels.coordinator.wakeAgeMinutes) || !validAge(channels.coordinator.auditAgeMinutes) ||
     report.states.some(s=>!validAge(s.recentAgeMinutes) ||
       (!validAge(s.revisionAgeMinutes) && s.revisionAgeMinutes!==null)))
    return critical('invalid-evidence-timestamp');

  const hist=channels.historical;
  if(!hist.sources.every(s=>['OBSERVED','HOLD','NOT_REQUIRED'].includes(s.verdict)) ||
     hist.sources.some(s=>s.verdict==='NOT_REQUIRED' && s.source!=='SAFETY GATE'))
    return critical('historical-evidence-unknown-or-invalid');
  const holds=hist.sources.filter(s=>s.verdict==='HOLD').map(s=>s.source);
  if(report.states.some(s=>typeof s.revisionFresh!=='boolean' ||
      (s.verdict==='PASS' && s.revisionFresh!==true) ||
      (s.verdict==='HOLD' && (s.revisionFresh!==false || !holds.includes(s.source))) ||
      (s.revisionFresh===false && !holds.includes(s.source))))
    return critical('unexplained-or-contradictory-source-hold');
  if(report.allFresh===true){
    if(hist.verdict!=='OBSERVED' || holds.length || report.states.some(s=>s.verdict!=='PASS'))
      return critical('contradictory-global-pass');
    return disposition('HEALTHY','all-original-gates-certified',report);
  }
  if(report.allFresh!==false)return critical('invalid-global-verdict');
  if(hist.verdict==='HOLD' && holds.length>0)
    return disposition('WARNING','historical-hold-only',report,holds);
  return critical('uncertified-global-outcome');
}

// Diagnostics for severity only: no changes to audits, policy, allFresh or channels.
export function nativeSeverityEvidenceIssues(body, report, now) {
  const issues=[];
  const audit=body?.state?.lastAudit;
  if(typeof body?.officialParityCertified!=='boolean' || typeof audit?.allFresh!=='boolean' ||
     body.officialParityCertified!==audit.allFresh ||
     (body.officialParityCertified===true && report.allFresh!==true))
    issues.push('contradictory-native-certificate');
  if(Array.isArray(audit?.states)) for(const state of audit.states){
    const assessment=report.states.find(s=>s.source===state?.source);
    const revisionTime=state?.revisionLastSuccessAt;
    // No previous historical success can be a known HOLD. An invalid/future
    // success timestamp is uncertainty, even if the original verdict says HOLD.
    if(!Number.isFinite(now) ||
       (revisionTime!=null && (typeof revisionTime!=='string' ||
        !Number.isFinite(Date.parse(revisionTime)) || Date.parse(revisionTime)>now)) ||
       (state?.revisionStatus==='fresh' && revisionTime==null))
      issues.push('invalid-historical-timestamp');
    if(!['fresh','stale','unknown','not-required'].includes(state?.revisionStatus) ||
       state.revisionStatus==='unknown' ||
       (assessment?.recentFresh===true && assessment.parity===true && state.error===null &&
        ((assessment.revisionFresh===false && state.status!=='stale') ||
         (assessment.revisionFresh===true && state.status!=='fresh'))))
      issues.push('unknown-or-contradictory-source-status');
  }
  const attempts=body?.state?.revisionAttempts;
  const classified=nativeHistoricalCertificationHolds(body);
  if(attempts!==undefined){
    if(!attempts || typeof attempts!=='object' || Array.isArray(attempts)) issues.push('invalid-historical-attempts');
    else for(const [key,attempt] of Object.entries(attempts)){
      if(!SOURCE_NAMES.some(s=>key.startsWith(s+':')) ||
         (!['completed','partial','failed','running','idle','skipped'].includes(attempt?.outcome) &&
          !classified.some(hold=>hold.key===key && hold.id===attempt?.id)) ||
         (attempt?.pendingDetails!==undefined && !Array.isArray(attempt.pendingDetails)))
        issues.push('unknown-historical-attempt');
    }
  }
  return [...new Set(issues)];
}

export function watchdogStepSummary(classification) {
  if(!classification || !['CRITICAL','WARNING','HEALTHY'].includes(classification.level))
    throw new Error('INVALID_WATCHDOG_DISPOSITION');
  const label=classification.level==='CRITICAL'?'CRITICAL — intervention or investigation required':
    classification.level==='WARNING'?'WARNING — historical certification pending':'HEALTHY — all global gates met';
  const holds=classification.historicalHolds.length?classification.historicalHolds.join(', '):'None';
  const preserved=classification.preservedHistoricalUnknowns?.map(h=>h.key).join(', ')||'None';
  return `### NagameAlert source freshness: ${label}\n\n`+
    `- Native RECENT channel: **${classification.recent}**\n`+
    `- Historical certification channel: **${classification.historical}**\n`+
    `- Historical HOLD sources: **${holds}**\n`+
    `- Preserved historical UNKNOWN with native classified effects: **${preserved}**\n`+
    `- Existing global allFresh (unchanged): **${classification.globalOfficialAllFresh}**\n`+
    `- Decision: **${classification.reason}**\n`+
    `- Mutations or recovery authorized by this classification: **NO**\n\n`+
    `A WARNING is not a PASS for historical completeness or global official parity.\n`;
}

/**
 * WF1 — Staffing Keyword Filter
 * Rules-based layer 1 filter: detects staffing/recruiting firms before using LLM.
 * Input:  Scored job items
 * Output: Same items with pre_filter_result set to:
 *         "staffing_firm" | "unclear" | "likely_direct"
 */

// Known staffing firm indicators
const STAFFING_KEYWORDS = [
  // Category terms
  'staffing', 'recruiting', 'recruitment', 'talent acquisition', 'headhunter',
  'executive search', 'placement agency', 'temp agency', 'temporary staffing',
  'contingent workforce', 'staff augmentation', 'workforce solutions',
  'managed service provider', 'vendor management system', 'vms', 'msp', 'rpo',
  'contract staffing', 'contract placement', 'direct placement',
  // Common staffing firm brand names
  'kelly services', 'kelly it', 'robert half', 'adecco', 'manpower', 'manpowergroup',
  'randstad', 'insight global', 'apex systems', 'tek systems', 'teksystems',
  'modis', 'cognizant staffing', 'infosys bpm', 'wipro staffing',
  'hays', 'michael baker', 'kforce', 'spherion', 'allegis', 'aerotek',
  'staffmark', 'express employment', 'volt workforce', 'compunnel',
  'mindlance', 'mastech', 'cybercoders', 'hired', 'toptal'
];

// Company name suffixes that suggest indirect employer (may still be direct)
const SUSPICIOUS_SUFFIXES = [
  /\b(staffing|recruiting|recruitment|placement|talent|search)\b/i,
  /\b(solutions group|workforce solutions|staffing solutions)\b/i,
  /\b(managed services|managed solutions)\b/i
];

// Patterns that STRONGLY suggest direct employer
const DIRECT_SIGNALS = [
  /we are hiring for our (own|internal|team)/i,
  /join our team/i,
  /be part of our/i,
  /we('re| are) (a|an) (tech|saas|fintech|healthcare|retail|manufacturing)/i
];

const results = [];

for (const item of $input.all()) {
  const job = { ...item.json };

  const companyLower = (job.company_name || '').toLowerCase();
  const descLower = (job.job_description || '').toLowerCase();
  const checkText = `${companyLower} ${descLower}`;

  // Check against explicit staffing keywords
  const matchedStaffingKeyword = STAFFING_KEYWORDS.find(kw => checkText.includes(kw.toLowerCase()));

  if (matchedStaffingKeyword) {
    job.pre_filter_result = 'staffing_firm';
    job.company_classification = 'staffing_firm';
    job.company_classification_reason = `Staffing keyword match: "${matchedStaffingKeyword}"`;
    results.push({ json: job });
    continue;
  }

  // Check for direct employer signals (skip LLM if strong signal)
  const isDirectSignal = DIRECT_SIGNALS.some(rx => rx.test(job.job_description || ''));
  if (isDirectSignal) {
    job.pre_filter_result = 'likely_direct';
    results.push({ json: job });
    continue;
  }

  // Check suspicious company name patterns
  const hasSuspiciousSuffix = SUSPICIOUS_SUFFIXES.some(rx => rx.test(job.company_name || ''));
  if (hasSuspiciousSuffix) {
    job.pre_filter_result = 'unclear';
    results.push({ json: job });
    continue;
  }

  // Default: no red flags, likely direct
  job.pre_filter_result = 'likely_direct';
  results.push({ json: job });
}

return results;

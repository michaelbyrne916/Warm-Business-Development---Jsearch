/**
 * WF1 — Score & Match Jobs
 * Scores each normalized job 0-100 against target role/location criteria.
 * Input:  Normalized job items (from normalizeJobs code node)
 * Output: Same items with match_score populated; items below MIN_MATCH_SCORE are filtered next
 */
const MIN_SCORE = parseInt($env.MIN_MATCH_SCORE || '60');
const results = [];

for (const item of $input.all()) {
  const job = { ...item.json };
  let score = 40; // base score

  const titleLower = (job.job_title || '').toLowerCase();
  const descLower = (job.job_description || '').toLowerCase();
  const fullText = `${titleLower} ${descLower}`;

  // --- Title quality signals (+points) ---
  const strongTitleWords = ['engineer', 'developer', 'manager', 'director', 'analyst', 'architect', 'lead', 'specialist'];
  if (strongTitleWords.some(w => titleLower.includes(w))) score += 15;

  // Seniority in title
  if (/senior|sr\.|lead|principal|staff|head of|director|vp/.test(titleLower)) score += 10;

  // --- Job quality signals ---
  // Has apply link (real posting)
  if (job.source_url && job.source_url.includes('http')) score += 5;

  // Has salary range (quality signal)
  if (fullText.match(/\$\d{2,3}k|\$\d{2,3},\d{3}|salary:|compensation:/)) score += 5;

  // Is remote or hybrid (expands opportunity)
  if (/remote|hybrid|work from home|wfh/.test(fullText)) score += 5;

  // Mentions specific tech (structured role)
  if (job.skills && job.skills.split(',').length > 2) score += 5;

  // --- Penalties ---
  // Job title includes unwanted words
  const penaltyWords = ['temp', 'temporary', 'part-time', 'part time', 'seasonal', 'volunteer'];
  if (penaltyWords.some(w => titleLower.includes(w))) score -= 20;

  // Description is very short (low quality posting)
  if ((job.job_description || '').length < 200) score -= 15;

  // Clamp score
  job.match_score = Math.min(100, Math.max(0, score));

  results.push({ json: job });
}

return results;

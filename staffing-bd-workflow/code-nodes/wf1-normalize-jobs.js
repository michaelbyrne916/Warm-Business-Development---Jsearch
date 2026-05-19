/**
 * WF1 — Normalize Jobs
 * Maps JSearch API response fields to the common Opportunity schema.
 * Input:  JSearch /search response object (item.json = full API response)
 * Output: One item per job in common schema
 */
const crypto = require('crypto');

const results = [];

for (const item of $input.all()) {
  const data = item.json;
  const jobs = data.data || [];

  for (const job of jobs) {
    // Extract clean domain from employer_website
    const rawWebsite = job.employer_website || '';
    const companyDomain = rawWebsite
      .replace(/https?:\/\/(www\.)?/, '')
      .split('/')[0]
      .toLowerCase()
      .trim();

    // Generate stable opportunity_id from content hash
    const key = `${companyDomain}|${(job.job_title || '').toLowerCase()}|${(job.job_city || '').toLowerCase()}`;
    const opportunityId = crypto.createHash('md5').update(key).digest('hex').substring(0, 12);

    // Normalize employment type
    let employmentType = 'unknown';
    const jt = (job.job_employment_type || '').toUpperCase();
    if (jt.includes('CONTRACT')) employmentType = 'contract';
    else if (jt.includes('FULLTIME') || jt.includes('FULL_TIME')) employmentType = 'direct_hire';
    else if (jt.includes('PART')) employmentType = 'part_time';
    else if (jt.includes('INTERN')) employmentType = 'internship';

    // Extract skills from job description + qualifications
    const jdText = JSON.stringify(job).toLowerCase();
    const skillKeywords = [
      'python', 'javascript', 'typescript', 'react', 'vue', 'angular',
      'node', 'nodejs', 'java', 'go', 'rust', 'c#', 'dotnet', '.net',
      'sql', 'postgres', 'mysql', 'mongodb', 'redis',
      'aws', 'azure', 'gcp', 'kubernetes', 'docker', 'terraform',
      'machine learning', 'ml', 'data science', 'spark', 'kafka',
      'salesforce', 'tableau', 'power bi'
    ];
    const skills = skillKeywords.filter(sk => jdText.includes(sk)).join(', ');

    // Infer seniority from title and experience requirements
    const titleLower = (job.job_title || '').toLowerCase();
    const expMonths = job.job_required_experience?.required_experience_in_months || 0;
    let seniority = 'mid';
    if (/senior|sr\.|principal|staff|lead|head of|director|vp|vice president|chief/.test(titleLower) || expMonths > 84) {
      seniority = 'senior';
    } else if (/junior|jr\.|entry|associate|intern/.test(titleLower) || expMonths < 24) {
      seniority = 'junior';
    }

    results.push({
      json: {
        opportunity_id: opportunityId,
        company_name: job.employer_name || '',
        company_domain: companyDomain,
        company_type: '',
        company_summary: '',
        job_title: job.job_title || '',
        location: [job.job_city, job.job_state, job.job_country]
          .filter(Boolean).join(', '),
        employment_type: employmentType,
        source_name: 'JSearch/RapidAPI',
        source_url: job.job_apply_link || job.job_google_link || '',
        posted_date: job.job_posted_at_datetime_utc || '',
        date_found: new Date().toISOString(),
        job_description: (job.job_description || '').substring(0, 3000),
        skills: skills,
        seniority: seniority,
        match_score: 0,
        company_classification: '',
        company_classification_reason: '',
        status: 'discovered',
        // Internal: pass through for downstream filtering
        _employer_logo: job.employer_logo || '',
        _job_id: job.job_id || opportunityId,
        _remote: job.job_is_remote || false
      }
    });
  }
}

return results;

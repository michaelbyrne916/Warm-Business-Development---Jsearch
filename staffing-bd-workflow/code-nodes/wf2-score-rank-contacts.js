/**
 * WF2 — Score & Rank Contacts
 * Scores Hunter.io domain search results against role-based title priority.
 * Input:  Hunter.io /domain-search response merged with opportunity data
 * Output: Single item per opportunity with best contact selected
 */

const MIN_CONFIDENCE = parseInt($env.MIN_CONFIDENCE_SCORE || '70');

// Title priority by role domain (index 0 = highest priority)
const TITLE_PRIORITY = {
  engineering: [
    'engineering manager', 'director of engineering', 'vp of engineering', 'vp engineering',
    'cto', 'chief technology officer', 'head of engineering', 'tech lead manager',
    'software development manager', 'principal engineer', 'director of software'
  ],
  data: [
    'director of data', 'vp of data', 'head of data', 'data engineering manager',
    'director of analytics', 'vp analytics', 'chief data officer', 'cdo',
    'head of data science', 'director of data science'
  ],
  product: [
    'vp of product', 'director of product', 'head of product', 'cpo',
    'chief product officer', 'product director', 'vp product management',
    'vp product', 'director of product management'
  ],
  design: [
    'vp of design', 'director of design', 'head of design', 'design director',
    'vp ux', 'director of ux'
  ],
  operations: [
    'coo', 'vp operations', 'director of operations', 'head of operations',
    'vp of operations', 'chief operating officer', 'operations director'
  ],
  finance: [
    'cfo', 'vp finance', 'director of finance', 'controller',
    'head of finance', 'chief financial officer', 'vp of finance'
  ],
  sales: [
    'vp of sales', 'director of sales', 'head of sales', 'cro',
    'chief revenue officer', 'vp revenue', 'director of revenue'
  ],
  marketing: [
    'cmo', 'vp of marketing', 'director of marketing', 'head of marketing',
    'chief marketing officer', 'vp marketing'
  ],
  default: [
    'director', 'vice president', 'vp', 'head of', 'cto', 'coo', 'cfo',
    'talent acquisition manager', 'recruiting manager', 'hr manager',
    'talent acquisition director', 'director of talent'
  ]
};

// Titles that indicate TA/HR fallback (penalized)
const TA_TITLES = [
  'talent acquisition', 'recruiter', 'recruiting', 'hr generalist',
  'human resources', 'people operations', 'hr business partner'
];

function getRoleDomain(jobTitle) {
  const t = jobTitle.toLowerCase();
  if (/engineer|developer|devops|sre|platform|infrastructure|backend|frontend|fullstack/.test(t)) return 'engineering';
  if (/data|analytics|ml |machine learning|ai |scientist/.test(t)) return 'data';
  if (/product|ux|design|user experience/.test(t)) return 'product';
  if (/operations|ops|supply chain|logistics/.test(t)) return 'operations';
  if (/finance|accounting|financial|controller/.test(t)) return 'finance';
  if (/sales|revenue|account executive|business development/.test(t)) return 'sales';
  if (/marketing|growth|demand gen|content/.test(t)) return 'marketing';
  return 'default';
}

function scoreContact(email, titlePriority) {
  const title = (email.position || '').toLowerCase();
  let score = 20; // base

  // Title match against priority list
  for (let i = 0; i < titlePriority.length; i++) {
    if (title.includes(titlePriority[i].toLowerCase())) {
      // Higher priority = higher score, decay by rank
      score += Math.max(60 - (i * 4), 25);
      break;
    }
  }

  // Seniority bonuses
  if (/\b(director|vp|vice president|chief|head of|cto|coo|cfo|cpo)\b/.test(title)) score += 20;
  else if (/\b(manager|lead|principal|senior director)\b/.test(title)) score += 10;

  // TA/HR penalty (fallback, not ideal)
  const isTa = TA_TITLES.some(ta => title.includes(ta));
  if (isTa) score -= 20;

  // Email confidence from Hunter.io
  const hunterConfidence = email.confidence || 0;
  if (hunterConfidence >= 90) score += 10;
  else if (hunterConfidence >= 70) score += 5;
  else if (hunterConfidence < 40) score -= 10;

  // Has LinkedIn (better data quality)
  if (email.linkedin) score += 5;

  return { score: Math.min(100, Math.max(0, score)), isTa };
}

const results = [];

for (const item of $input.all()) {
  const data = item.json;

  // Hunter.io response is at data.data.emails when the API responded
  const emails = data.data?.emails || [];
  const roleDomain = getRoleDomain(data.job_title || '');
  const titlePriority = [
    ...(TITLE_PRIORITY[roleDomain] || []),
    ...TITLE_PRIORITY.default
  ];

  if (emails.length === 0) {
    results.push({
      json: {
        ...data,
        contact_name: '',
        contact_title: '',
        contact_email: '',
        contact_phone: '',
        linkedin_url: '',
        source_of_contact: 'hunter.io (no results)',
        confidence_score: 0,
        contact_reasoning: `No contacts found via Hunter.io for domain: ${data.company_domain}`,
        _role_domain: roleDomain,
        _is_ta_fallback: false,
        _total_contacts_found: 0
      }
    });
    continue;
  }

  // Score all contacts
  const scored = emails.map(e => {
    const { score, isTa } = scoreContact(e, titlePriority);
    return {
      name: `${e.first_name || ''} ${e.last_name || ''}`.trim(),
      title: e.position || '',
      email: e.value || '',
      phone: e.phone_number || '',
      linkedin: e.linkedin ? `https://www.linkedin.com/in/${e.linkedin}` : '',
      hunterConfidence: e.confidence || 0,
      score,
      isTa
    };
  });

  // Sort by composite score, take best
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];

  // Build reasoning note
  const rank = titlePriority.findIndex(t => (best.title || '').toLowerCase().includes(t));
  const rankNote = rank >= 0
    ? `Title matched priority rank #${rank + 1} for ${roleDomain} roles.`
    : 'No direct title match; selected by highest composite score.';

  const taNote = best.isTa
    ? ' NOTE: TA/HR fallback — no direct hiring manager found. Manual review recommended.'
    : '';

  results.push({
    json: {
      ...data,
      contact_name: best.name,
      contact_title: best.title,
      contact_email: best.email,
      contact_phone: best.phone,
      linkedin_url: best.linkedin,
      source_of_contact: `hunter.io (${emails.length} contacts found)`,
      confidence_score: best.score,
      contact_reasoning: `${rankNote}${taNote} Hunter confidence: ${best.hunterConfidence}%.`,
      _role_domain: roleDomain,
      _is_ta_fallback: best.isTa,
      _total_contacts_found: emails.length
    }
  });
}

return results;

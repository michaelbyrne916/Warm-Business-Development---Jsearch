/**
 * WF3 — Parse LLM Response (8-email)
 * Tags items with _parse_status='success' | 'fail' for downstream routing.
 * On parse failure: emits minimal diagnostic fields only, no placeholder OQ row.
 * Route Parse Result IF sends success -> Write to OQ, fail -> Log Parse Failure.
 */
const results = [];
const originalItems = $('Build Outreach Prompt').all();

for (let i = 0; i < $input.all().length; i++) {
  const item = $input.all()[i];
  const d = item.json;
  const orig = originalItems[i] ? originalItems[i].json : {};
  let parsed = null;
  let parseError = null;
  let rawForLog = '';

  try {
    if (d.choices && d.choices[0]) {
      const raw = d.choices[0].message?.content || '{}';
      rawForLog = raw;
      const cleaned = raw.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
      parsed = JSON.parse(cleaned);
    } else if (d.content && d.content[0]) {
      const raw = d.content[0].text || '{}';
      rawForLog = raw;
      const cleaned = raw.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
      parsed = JSON.parse(cleaned);
    } else if (d.email_1_subject) {
      parsed = d;
    } else if (d.error) {
      throw new Error('LLM API error: ' + (d.error.message || JSON.stringify(d.error)));
    } else {
      throw new Error('Unrecognized LLM response shape');
    }
  } catch(e) {
    parseError = e.message;
  }

  if (parseError) {
    results.push({ json: {
      _parse_status: 'fail',
      opportunity_id: orig.opportunity_id || '',
      company_name: orig.company_name || '',
      contact_email: orig.contact_email || '',
      contact_name: orig.contact_name || '',
      job_title: orig.job_title || '',
      parse_error: parseError,
      raw_excerpt: rawForLog.substring(0, 500),
      llm_provider: $vars.LLM_PROVIDER || 'openai'
    }});
    continue;
  }

  const contactFirst = (orig.contact_name || '').split(' ')[0] || '';
  const companyName = orig.company_name || '';
  const clean = (str) => (str || '')
    .replace(/\b(Hi|Hello|Dear)[,\s]*Hiring(?:\s+Manager)?\b/gi, (_, g) => contactFirst ? g + ' ' + contactFirst : g + ',')
    .replace(/\[Hiring Manager\]/gi, contactFirst)
    .replace(/\[First Name\]/gi, contactFirst)
    .replace(/\[Name\]/gi, contactFirst)
    .replace(/\[Your Name\]/gi, 'Michael')
    .replace(/\[Company Name\]/gi, companyName)
    .replace(/\[Company\]/gi, companyName)
    .replace(/\s*—\s*/g, ', ')
    .replace(/\s*--\s*/g, ', ')
    .replace(/\s*–\s*/g, ', ')
    .replace(/([A-Za-z])-([A-Za-z])/g, '$1 $2')   // strip intra-word hyphens (cross-functional -> cross functional)
    .replace(/([A-Za-z])-([A-Za-z])/g, '$1 $2')   // second pass for chained hyphens (state-of-the-art)
    .replace(/(\d)-([A-Za-z])/g, '$1 $2')         // digit-letter (12-plus -> 12 plus)
    .replace(/([A-Za-z])-(\d)/g, '$1 $2')         // letter-digit (leaves date/range digit-digit like 2026-06-01 intact)
    // Deterministic banned-phrase scrub — safety net for when the LLM ignores the prompt ban.
    .replace(/I wanted to circle back to/gi, 'About')
    .replace(/I wanted to circle back/gi, 'A quick note')
    .replace(/circling back to/gi, 'returning to')
    .replace(/circling back/gi, 'returning')
    .replace(/I came across/gi, 'I noticed')
    .replace(/I wanted to follow up/gi, 'One more thought')
    .replace(/following up/gi, 'writing again')
    .replace(/just checking in/gi, 'a quick note')
    .replace(/wanted to reach out/gi, 'wanted to write')
    // Broader cliche scrub (hyphens already stripped to spaces above, so match spaced forms)
    .replace(/touching base/gi, 'a quick note')
    .replace(/quick chat/gi, 'quick conversation')
    .replace(/pick your brain/gi, 'get your perspective')
    .replace(/top talent/gi, 'strong candidates')
    .replace(/best in class/gi, 'strong')
    .replace(/world class/gi, 'excellent')
    .replace(/game changer/gi, 'meaningful step')
    .replace(/perfect fit/gi, 'strong fit')
    .replace(/hope (?:you are|you're|youre) doing well/gi, 'I hope things are going well')
    .replace(/[ \t]+\n/g, '\n')     // strip trailing spaces on each line
    .replace(/\n{3,}/g, '\n\n')     // collapse 3+ blank lines to a single paragraph break
    .trim()                          // remove leading/trailing whitespace and blank lines
    .replace(/^([a-z])/, c => c.toUpperCase());  // re-capitalize first char after any scrub rewrite

  results.push({
    json: {
      _parse_status: 'success',
      opportunity_id: orig.opportunity_id || '',
      company_name: orig.company_name || '',
      company_domain: orig.company_domain || '',
      contact_name: orig.contact_name || '',
      contact_title: orig.contact_title || '',
      contact_email: orig.contact_email || '',
      job_title: orig.job_title || '',
      location: orig.location || '',
      company_summary: orig.company_summary || '',
      company_industry: orig.company_industry || '',
      seniority: orig.seniority || '',
      skills: orig.skills || '',
      confidence_score: orig.confidence_score || '',
      contact_reasoning: orig.contact_reasoning || '',
      linkedin_url: orig.linkedin_url || '',
      source_url: orig.source_url || '',
      posted_date: orig.posted_date || '',
      email_1_subject: clean(parsed.email_1_subject) || '',
      email_1_body: clean(parsed.email_1_body) || '',
      email_2_subject: clean(parsed.email_2_subject) || '',
      email_2_body: clean(parsed.email_2_body) || '',
      email_3_subject: clean(parsed.email_3_subject) || '',
      email_3_body: clean(parsed.email_3_body) || '',
      email_4_subject: clean(parsed.email_4_subject) || '',
      email_4_body: clean(parsed.email_4_body) || '',
      email_5_subject: clean(parsed.email_5_subject) || '',
      email_5_body: clean(parsed.email_5_body) || '',
      email_6_subject: clean(parsed.email_6_subject) || '',
      email_6_body: clean(parsed.email_6_body) || '',
      email_7_subject: clean(parsed.email_7_subject) || '',
      email_7_body: clean(parsed.email_7_body) || '',
      email_8_subject: clean(parsed.email_8_subject) || '',
      email_8_body: clean(parsed.email_8_body) || '',
      personalization_angle: parsed.personalization_angle || '',
      recipient_reasoning: parsed.recipient_reasoning || '',
      scaling_hypothesis: parsed.scaling_hypothesis || '',
      candidate_track: parsed.candidate_track || orig._candidate_track || '',
      approval_status: 'pending',
      sent_status: 'unsent',
      sent_timestamp: '',
      llm_provider: $vars.LLM_PROVIDER || 'openai',
      generated_at: new Date().toISOString()
    }
  });
}

return results;

/**
 * WF3 — Parse LLM Response
 * Extracts structured outreach fields from either OpenAI or Claude API response.
 * Handles JSON parsing failures gracefully with a fallback draft.
 * Input:  Raw LLM API response (OpenAI or Anthropic format)
 * Output: Structured outreach item ready to write to Outreach Queue sheet
 *
 * Field names: email_1/2/3_subject/body, personalization_angle, recipient_reasoning, scaling_hypothesis
 */
const results = [];
const originalItems = $('Build Outreach Prompt').all();

for (let i = 0; i < $input.all().length; i++) {
  const item = $input.all()[i];
  const d = item.json;
  const orig = originalItems[i] ? originalItems[i].json : {};
  let parsed = {};

  try {
    // OpenAI format
    if (d.choices && d.choices[0]) {
      const raw = d.choices[0].message?.content || '{}';
      const cleaned = raw.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
      parsed = JSON.parse(cleaned);
    }
    // Anthropic Claude format
    else if (d.content && d.content[0]) {
      const raw = d.content[0].text || '{}';
      const cleaned = raw.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
      parsed = JSON.parse(cleaned);
    }
    // Already parsed (manual trigger test)
    else if (d.email_1_subject) {
      parsed = d;
    }
    // Error response from API
    else if (d.error) {
      throw new Error(`LLM API error: ${d.error.message || JSON.stringify(d.error)}`);
    }
  } catch(e) {
    const raw = d.choices?.[0]?.message?.content || d.content?.[0]?.text || '';
    parsed = {
      email_1_subject: 'Review needed — parsing failed',
      email_1_body: raw.substring(0, 1000),
      email_2_subject: '',
      email_2_body: '',
      email_3_subject: '',
      email_3_body: '',
      personalization_angle: `LLM parse error: ${e.message}`,
      recipient_reasoning: '',
      scaling_hypothesis: ''
    };
  }

  // Replace common placeholders and strip dashes
  const contactFirst = (orig.contact_name || '').split(' ')[0] || 'there';
  const companyName = orig.company_name || '';
  const clean = (str) => (str || '')
    .replace(/\[Hiring Manager\]/gi, contactFirst)
    .replace(/\[First Name\]/gi, contactFirst)
    .replace(/\[Name\]/gi, contactFirst)
    .replace(/\[Your Name\]/gi, 'Michael')
    .replace(/\[Company Name\]/gi, companyName)
    .replace(/\[Company\]/gi, companyName)
    .replace(/\s*\u2014\s*/g, ', ')   // em dash → comma
    .replace(/\s*--\s*/g, ', ')        // double hyphen → comma
    .replace(/\s*\u2013\s*/g, ', ');   // en dash → comma

  results.push({
    json: {
      // Pass-through context fields
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

      // Generated outreach fields
      email_1_subject: clean(parsed.email_1_subject) || '',
      email_1_body: clean(parsed.email_1_body) || '',
      email_2_subject: clean(parsed.email_2_subject) || '',
      email_2_body: clean(parsed.email_2_body) || '',
      email_3_subject: clean(parsed.email_3_subject) || '',
      email_3_body: clean(parsed.email_3_body) || '',

      // Metadata fields
      personalization_angle: parsed.personalization_angle || '',
      recipient_reasoning: parsed.recipient_reasoning || '',
      scaling_hypothesis: parsed.scaling_hypothesis || '',

      // Status fields
      approval_status: 'pending',
      sent_status: 'unsent',
      sent_timestamp: '',

      // Metadata
      llm_provider: $vars.LLM_PROVIDER || 'openai',
      generated_at: new Date().toISOString()
    }
  });
}

return results;

const apolloResponses = $input.all();
const opportunities = $('Prepare Apollo Request').all();
const results = [];

for (let idx = 0; idx < apolloResponses.length; idx++) {
  const apolloResp = apolloResponses[idx].json;
  const opportunity = opportunities[idx] ? opportunities[idx].json : {};

  // Skip if Apollo errored (406, 401, etc.) — company stays unprocessed for retry
  if (apolloResp.error || (apolloResp.status && apolloResp.status >= 400)) {
    continue;
  }

  const contacts = apolloResp.contacts || [];

  if (contacts.length === 0) {
    // Apollo authenticated but found nothing — write needs_review placeholder
    results.push({ json: {
      ...opportunity,
      contact_name: '',
      contact_title: '',
      contact_email: '',
      linkedin_url: '',
      source_of_contact: 'apollo.io (no results)',
      confidence_score: 0,
      contact_status: 'needs_review',
      contact_reasoning: 'Hunter.io and Apollo.io both returned no contacts for this domain'
    }});
    continue;
  }

  const withEmail = contacts.filter(c => c.email && c.email.includes('@'));
  const best = withEmail.length > 0 ? withEmail[0] : contacts[0];
  const hasEmail = !!(best.email && best.email.includes('@'));

  results.push({ json: {
    ...opportunity,
    contact_name: ((best.first_name || '') + ' ' + (best.last_name || '')).trim(),
    contact_title: best.title || '',
    contact_email: hasEmail ? best.email : '',
    linkedin_url: best.linkedin_url || '',
    source_of_contact: 'apollo.io',
    confidence_score: hasEmail ? 60 : 10,
    contact_status: hasEmail ? 'contact_found' : 'needs_review',
    contact_reasoning: hasEmail
      ? 'Apollo.io fallback: found contact with email'
      : 'Apollo.io fallback: found contact but no email available'
  }});
}

return results;

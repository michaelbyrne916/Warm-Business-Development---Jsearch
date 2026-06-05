// WF4 — Prepare Send Fields (8-email)
// Reads the email to send based on follow_up_stage: emailIndex = stage + 1 (1..8).
// Stage 0 sends email_1 with its own subject; stages 1..7 send email_2..8 as a Re: reply chain.
return $input.all().map(item => {
  const d = item.json;
  const stage = parseInt(d.follow_up_stage || '0', 10);
  const idx = stage + 1; // email number to send (1..8)

  let sendSubject;
  if (stage === 0) {
    sendSubject = d.email_1_subject || '';
  } else {
    // Emails 2..8 — reply chain using Re: prefix on the original subject
    sendSubject = 'Re: ' + (d.email_1_subject || d.company_name || '');
  }

  let sendBody = d['email_' + idx + '_body'] || '';

  // Strip any embedded unsubscribe line
  sendBody = sendBody.replace(/\n?If you do not wish to receive any communication please reply with the subject line UNSUBSCRIBE/gi, '').trim();

  // Convert newlines to <br> for HTML email rendering
  const sendBodyHtml = sendBody.replace(/\n/g, '<br>');

  return { json: { ...d, _send_subject: sendSubject, _send_body: sendBody, _send_body_html: sendBodyHtml } };
});

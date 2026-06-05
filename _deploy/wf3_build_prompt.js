/**
 * WF3 — Build Outreach Prompt (8-email sequence)
 * Assembles the LLM system + user prompt for an 8-email warm outreach sequence.
 *  - Emails 1-3: intro / value reframe / reflective question.
 *  - Emails 4-8: candidate sizzle / market insight / soft check-in / sizzle callback / breakup.
 * Candidate sizzle for emails 4 & 7 is routed by job_title/industry/skills/JD keywords.
 * Input:  Merged opportunity + contact data from WF2
 * Output: Same item with _system_prompt, _user_prompt, _candidate_track added
 */
const results = [];

// --- Candidate sizzle library (verbatim facts; LLM weaves them as prose, de-dashed) ---
const SIZZLE = {
  IT: `IT / STEM candidate. Profile: Technical Program Manager / Scrum Master.
Currently engaged on an active state government IT initiative. Brings 12+ years of technical program management across healthcare, financial services, and enterprise retail. PMP, Six Sigma Black Belt, SAFe, and Scrum certified. Has owned programs ranging from $1.5M to $10.7M, led cross functional teams of 40+, and has deep hands on experience with Salesforce, Oracle Fusion, Agile and Waterfall hybrid delivery, QA coordination, and executive steering committee reporting. Sacramento area based and already operating in the California state agency environment.`,
  Finance: `Finance / Accounting candidate. Profile: CFO / VP Finance / Head of FP&A.
A strategic finance executive with 15+ years across consumer finance and asset management, known for building finance functions from the ground up and driving measurable cost reduction at scale. Has delivered $4M+ in recurring savings, designed and executed a workforce strategy generating $20M in projected annual savings, and rebuilt a full analytics organization from scratch. Deep experience in FP&A, M&A integration, board level reporting, incentive design, and capital strategy. Previously held senior roles at a Fortune 100 financial institution and a $1B+ AUM asset manager.`,
  Construction: `Construction Management candidate. Profile: Construction Manager / Owner's Representative.
A seasoned construction professional with experience managing ground up and renovation projects across commercial, public sector, and infrastructure verticals. Has served in both owner's representative and GC side roles, with concurrent oversight of multiple active projects ranging from $10M to $30M+. Brings hands on command of the full project lifecycle, from preconstruction and design coordination through procurement, scheduling, field execution, and closeout. Proven track record managing subcontractor relationships, RFI and submittal workflows, and budget controls while keeping stakeholders informed and projects on schedule. Comfortable operating in highly regulated environments and experienced working alongside public agency clients, architects, and multi discipline engineering teams.`
};

// Route to a candidate track from role/company keywords. Construction is checked first
// because "project manager"/"engineer" otherwise get swept into IT. Default = IT (largest segment).
function pickTrack(hay) {
  const constructionCtx = /\b(construction|contractor|building|civil|jobsite|job site|preconstruction|subcontractor|general contractor)\b/.test(hay);
  if (/\b(superintendent|estimator)\b/.test(hay) || /\bconstruction\b/.test(hay) || (/\bproject manager\b/.test(hay) && constructionCtx)) {
    return 'Construction';
  }
  if (/\b(finance|accounting|controller|fp&a|fp and a|cfo|treasury|treasurer|bookkeeper|accountant|auditor)\b/.test(hay)) {
    return 'Finance';
  }
  if (/\b(it|software|developer|engineer|cloud|data|security|infrastructure|pm|scrum|devops|architect|systems|network|qa|technical|cyber|sre|sysadmin)\b/.test(hay)) {
    return 'IT';
  }
  return 'IT';
}

const systemPrompt = `You are writing an 8-email outbound business development sequence for a staffing and recruiting firm. The emails go to a likely hiring manager or functional leader after a new job posting at their company is identified.

--- OUR FIRM ---
10 Pillars Solutions is an AI-enabled, human-led staffing firm that helps employers hire faster without sacrificing quality. We pair intelligent sourcing with experienced recruiter judgment, technical screening, and rigorous QA, so clients get qualified candidates, not just more resumes. We work contract, contract-to-hire, and direct-hire across IT and STEM, finance and accounting, and construction management.

--- METHOD: NEPQ ---
Write using NEPQ principles:
- Build problem awareness before offering any solution.
- Lead with curiosity and questions that pull the reader into reflecting on their own hiring situation.
- Never use pitch language, hype, or pressure.
- Sound like a sharp human who knows this space, not a vendor working a list.
- Let the reader feel understood before they feel sold to. In most emails you are not selling at all.

--- VOICE RULES (every email) ---
- Conversational and direct. Write like a real person typing a quick note.
- No corporate speak, no jargon, no buzzwords.
- Do not use dashes of any kind. No hyphens as connectors, no em dashes, no en dashes. Use commas or short sentences instead. This applies even when restating the candidate facts below.
- No bullet points or lists in the email bodies.
- No exclamation marks.
- Short paragraphs, easy to skim and reply to. About a 9th grade reading level.
- Every email body opens with this exact line: Hi FIRST_NAME,  (use the real first name given below). Then a blank line, then the body.
- Do NOT include a signature, a sign-off name, or a contact block. The sending system adds the signature. End on your last real sentence.
- Vary sentence openings across the eight emails. Do not start two emails the same way.

--- SUBJECT LINES ---
- 3 to 6 words. Curiosity-driven and human. No spam words, no all caps, no clickbait.
- Emails 2 through 8 may use a short Re: style subject so the thread reads as continuing.

--- DO NOT ---
- Do not invent facts about the company, role, person, or candidate.
- Do not mention scraping, automation, AI, monitoring, or that the role was detected automatically.
- Do not use cliches: hope you are doing well, touching base, quick chat, pick your brain, top talent, best in class, world class, game changer, perfect fit.
- Do not reuse the same wording or call to action across emails.

--- BANNED PHRASES (must NEVER appear in any of the 8 emails, in any form) ---
"I came across", "I wanted to follow up", "I wanted to circle back", "circling back", "following up", "just checking in", "wanted to reach out".
If you are tempted to write any of these, rewrite the sentence from scratch with a concrete, specific observation instead.

--- THE 8-EMAIL ARC ---
Each email must feel like a natural continuation, never a copy-paste reminder.

Email 1 - Noticed their specific opening. A personalized intro that shows you are paying attention to their company and this role. Reference the posted role naturally and one grounded detail about what the company does. Warm, brief, human. No pitch. A low-pressure opening to a conversation.

Email 2 - Follow up from a different angle. Add value or reframe why this hire matters now, such as timing, delivery pressure, team load, or how hard this role is to fill well. Do not restate Email 1. Stay short.

Email 3 - A reflective question. Pull engagement instead of pitching. Ask something real, like what has been the hardest part of filling this role, or where the pressure is coming from. One genuine question. Do not offer a solution yet.

Email 4 - Candidate sizzle. Reference their open role, then introduce the anonymized candidate described in CANDIDATE SIZZLE below, who recently came off a project and could be a fit. Phrase it naturally, for example: if the role is still open, we have someone who might be worth a quick conversation, then describe the person in a few human sentences. Do not paste a resume and do not use bullets. Make it read like you are telling them about a strong person you know.

Email 5 - Industry insight. Share one genuinely useful, grounded observation about hiring or talent trends in their space. Pure credibility builder. No candidate, no pitch, no ask beyond an open door.

Email 6 - Soft check-in. Brief and conversational. Make it easy to say not right now. For example: if the timing is not right, no problem, happy to be a resource when the need comes up.

Email 7 - Candidate sizzle callback. Refer back to the SAME candidate from Email 4. Add gentle, honest urgency: the person you mentioned a few weeks ago is still available but actively interviewing, and ask if it is worth a quick conversation before they are off the market. Low pressure, not pushy.

Email 8 - Breakup that leaves the door open. The last note on this. Clean and gracious, no guilt. For example: this is the last note from me on this one, and when staffing needs come up down the road, you know where to find me.

--- CANDIDATE SIZZLE (Emails 4 and 7 only, same person in both) ---
Use ONLY the candidate provided in the user message. Weave the details in as natural prose, never as a list, and never add facts that are not given.
- Refer to the candidate as they/them. Never assign a gender (no he, she, his, her).
- Preserve the candidate's specific numbers and metrics verbatim: dollar amounts, team sizes, years of experience, and named certifications or tools. Do not soften them into vague phrases like "significant budgets" or "large teams." The concrete numbers are the point.

--- OUTPUT FORMAT ---
Respond ONLY with this exact JSON object, no markdown and no extra text:
{
  "email_1_subject": "...",
  "email_1_body": "...",
  "email_2_subject": "...",
  "email_2_body": "...",
  "email_3_subject": "...",
  "email_3_body": "...",
  "email_4_subject": "...",
  "email_4_body": "...",
  "email_5_subject": "...",
  "email_5_body": "...",
  "email_6_subject": "...",
  "email_6_body": "...",
  "email_7_subject": "...",
  "email_7_body": "...",
  "email_8_subject": "...",
  "email_8_body": "...",
  "personalization_angle": "...",
  "recipient_reasoning": "...",
  "scaling_hypothesis": "...",
  "candidate_track": "IT | Finance | Construction"
}

Field notes:
- Each email body must contain the full email text starting with the Hi FIRST_NAME, line, with blank lines between paragraphs and no signature.
- personalization_angle: one sentence on the primary company customization used.
- recipient_reasoning: one sentence on why this person was selected as the likely contact.
- scaling_hypothesis: one sentence on why this role likely matters now.
- candidate_track: echo back which sizzle track you were given (IT, Finance, or Construction).`;

for (const item of $input.all()) {
  const d = item.json;

  const contactName = d.contact_name || '';
  const firstName = contactName.split(' ')[0] || '';
  const hasName = firstName.length > 0;
  const greetingInstruction = hasName
    ? 'Open every email with this exact line: Hi ' + firstName + ',  then a blank line, then the body. Use the real name, not a placeholder or a merge tag.'
    : 'The recipient first name is not known. Open every email with the bare line: Hi,  on its own line, then a blank line, then the body. Do not use Hiring Manager, there, or any placeholder name.';

  // Seniority tier for tone guidance
  const title = (d.contact_title || '').toLowerCase();
  let seniorityTier;
  if (/\b(vp|vice president|director|chief|cto|coo|ceo|cfo|head of|svp|evp)\b/.test(title)) {
    seniorityTier = 'senior — use more concise, outcome-focused, commercial language';
  } else if (/\b(manager|lead|senior|sr\.?|principal)\b/.test(title)) {
    seniorityTier = 'mid-level — use slightly more collaborative, role-specific language';
  } else {
    seniorityTier = 'unknown — write for a likely functional leader; keep the fallback ask polite';
  }

  // Candidate sizzle routing for emails 4 and 7
  const routeHay = ((d.job_title || '') + ' ' + (d.company_industry || '') + ' ' + (d.skills || '') + ' ' + (d.job_description || '')).toLowerCase();
  const candidateTrack = pickTrack(routeHay);
  const selectedSizzle = SIZZLE[candidateTrack];

  const userPrompt = `Generate an 8-email warm outreach sequence for this opportunity:

--- COMPANY ---
Name: ${d.company_name || 'Unknown'}
Domain: ${d.company_domain || 'Unknown'}
Industry: ${d.company_industry || 'Not specified'}
HQ: ${d.company_hq || 'Not specified'}
Description: ${d.company_summary || 'Not available'}
Hiring Signals: ${d.hiring_signals || 'None identified'}
Tech Stack in JD: ${d.tech_stack || 'Not specified'}

--- ROLE ---
Job Title: ${d.job_title || 'Unknown'}
Location: ${d.location || 'Unknown'}
Seniority: ${d.seniority || 'Not specified'}
Employment Type: ${d.employment_type || 'Not specified'}
Skills Mentioned: ${d.skills || 'Not specified'}
Job Description (excerpt):
${(d.job_description || '').substring(0, 1000)}

--- CONTACT ---
Name: ${contactName || 'Not available'}
First Name: ${firstName || 'Not available'}
Title: ${d.contact_title || 'Unknown'}
Seniority Tier: ${seniorityTier}
Why They Were Selected: ${d.contact_reasoning || 'Best available contact for this role'}

--- CANDIDATE SIZZLE (use in Emails 4 and 7, same person in both) ---
Track: ${candidateTrack}
${selectedSizzle}

${greetingInstruction}`;

  results.push({
    json: {
      ...d,
      _system_prompt: systemPrompt,
      _user_prompt: userPrompt,
      _contact_first_name: firstName,
      _candidate_track: candidateTrack
    }
  });
}

return results;

# Campaign Review Triage Copilot
### Product Requirements Document — LaunchGood Applied AI Engineer Application
**Author:** Applicant Prototype  
**Version:** 1.0  
**Status:** Draft for Submission

---

## 1. Executive Summary

LaunchGood reviews every campaign submitted to its platform manually — checking identity, cause legitimacy, compliance with sanctions lists, and documentation completeness. This is the right thing to do. It's also a process that breaks under scale.

A small Trust & Safety team is handling a global queue of submissions across 155 countries, navigating 400+ sanctions lists, OFAC jurisdictions, and document back-and-forths — all through email threads. During Ramadan, when campaign volume spikes dramatically and a single night can generate over $1M in donations, this team is working around the clock with no AI assistance.

The **Campaign Review Triage Copilot** is an internal tool that sits between campaign submission and human review. It reads every new campaign, assigns a risk tier with clear reasoning, identifies documentation gaps, drafts the right outbound email for the reviewer to send, and maintains a live queue dashboard so the team always knows what needs attention and what can wait.

The AI does the triage. The human makes every decision that matters.

---

## 2. Problem Statement

### 2.1 The Core Process Today

When a campaign is submitted on LaunchGood:

1. A Trust & Safety specialist picks it up from a queue
2. They read the campaign title, description, creator profile, and location
3. They cross-reference sanctions lists (manually or via a compliance tool)
4. They decide: approve, request documents, or escalate
5. They write an email to the creator requesting missing information
6. They wait for a reply, review the documents, and potentially ask follow-up questions
7. They make a final decision

Every step is manual. Every email is written from scratch. There is no consistent scoring, no structured handoff, and no way to know at a glance which campaigns are high-risk vs. routine.

### 2.2 Why This Breaks

**Volume doesn't scale linearly with headcount.** LaunchGood has raised $688M across 155 countries with a small team. As the platform grows — and especially during Ramadan — the queue grows faster than the team can hire.

**Inconsistency is a compliance risk.** Without structured criteria, different reviewers make different calls on similar campaigns. This creates both false rejections (real, legitimate causes delayed or blocked) and false approvals (fraud that slips through).

**Email back-and-forth is the biggest time sink.** When a reviewer needs documents, they write an email. The creator responds with incomplete information. The reviewer asks again. This can take days — during which the creator is anxious, donors are waiting, and the campaign may be missing its fundraising window.

**The human cost is real.** Reviews of Trustpilot show creators of urgent campaigns — displaced families, medical emergencies, bereaved relatives — stuck in generic "under review" limbo with no timeline. The team isn't negligent; they're overwhelmed.

### 2.3 Assumptions (Stated Explicitly)

- LaunchGood's review queue is currently managed via email or a basic ticketing system, not a purpose-built tool
- Reviewers are currently reading and triaging campaigns without AI pre-screening
- The volume of campaigns spikes significantly during Ramadan and other Islamic giving periods
- A meaningful percentage of submissions (~30–50%) are from non-G7 or OFAC-sensitive regions, requiring Enhanced Due Diligence
- The team has some documented criteria for what makes a campaign low/medium/high risk, even if informal

---

## 3. Goals

### 3.1 For the Trust & Safety Team
- Reduce average time-to-decision on low-risk campaigns from hours to minutes
- Eliminate blank-page email writing — every outbound communication starts as an AI draft
- Give reviewers a live queue with risk-ranked campaigns so they always work the highest-priority cases first
- Reduce repeated back-and-forth by identifying all documentation gaps upfront

### 3.2 For Campaign Creators
- Faster approvals for legitimate, low-risk campaigns
- More specific, actionable document requests (not generic "we need more information")
- Clearer communication about why a campaign is under review and what's needed

### 3.3 For LaunchGood as a Platform
- Reduce compliance risk through consistent, documented AI-assisted triage
- Scale through Ramadan surges without proportional headcount increases
- Build an audit trail showing structured review reasoning for every campaign

---

## 4. Non-Goals

- **The AI will never approve or reject a campaign.** All decisions remain with the human reviewer. The AI triages, scores, drafts — it does not decide.
- **This is not a fraud detection system.** Sanctions screening against external lists remains handled by LaunchGood's existing compliance tools (e.g., FinClusive). The copilot reads signals from those results but does not replace them.
- **This is not a donor-facing product.** Everything in this document is internal tooling for the T&S team.
- **This does not handle payouts.** Payout compliance is a related but separate problem.

---

## 5. User Personas

### Maya — Senior Trust & Safety Specialist
Has been at LaunchGood for 3 years. Knows the risk signals by intuition — "this campaign description feels off," "this country + this goal amount + this account age is a pattern." She's the institutional knowledge. During Ramadan she reviews 40+ campaigns a day. She doesn't need the AI to tell her what to do; she needs it to do the pre-reading and drafting so she can spend her time on the hard cases.

### Tariq — Junior T&S Reviewer
Joined 6 months ago. Still learning the compliance nuances — which regions need Enhanced Due Diligence, what documents are required for a zakat-eligible campaign vs. a personal cause, how to phrase a document request that's firm but warm. He needs the AI as a guide that surfaces the right criteria and drafts communications he can learn from.

### Amira — Head of Operations
Doesn't do individual reviews. Needs to know: Is the queue healthy? Are we meeting SLAs? Where are the bottlenecks? Is Ramadan prep on track? She needs the dashboard view, not the campaign-level detail.

---

## 6. System Design

### 6.1 Architecture Overview

```
Campaign Submission (LaunchGood Platform)
         │
         ▼
  ┌─────────────────────┐
  │   Intake Processor  │  ← Receives campaign data via webhook/API
  └─────────────────────┘
         │
         ▼
  ┌─────────────────────┐
  │    AI Risk Engine   │  ← Claude analyzes campaign, assigns tier + reasoning
  └─────────────────────┘
         │
         ▼
  ┌─────────────────────┐
  │  Document Gap Check │  ← Rule-based check: what docs are required vs. submitted
  └─────────────────────┘
         │
         ▼
  ┌─────────────────────┐
  │   Draft Generator   │  ← Claude writes the outbound email for this specific case
  └─────────────────────┘
         │
         ▼
  ┌─────────────────────┐
  │   Review Dashboard  │  ← Human reviewer sees queue, risk, reasoning, draft
  └─────────────────────┘
         │
    Human Decision
    ┌────┴────┐
    ▼         ▼
 Approve   Request Docs / Escalate
    │         │
    └────┬────┘
         ▼
  Email sent (one click, or edited + sent)
  Decision + reasoning logged
```

### 6.2 AI Risk Triage Engine

The core of the system. For every campaign, Claude receives a structured prompt containing:

- Campaign title and full description
- Creator account age and history (first campaign vs. repeat creator)
- Creator location and beneficiary location
- Campaign category (personal cause, NGO, disaster relief, zakat-eligible, etc.)
- Funding goal amount
- Existing sanctions screening result (pass/flag/pending)
- Documents already submitted

Claude returns a structured JSON output:

```json
{
  "risk_tier": "MEDIUM",
  "confidence": 0.82,
  "risk_signals": [
    "Beneficiary located in OFAC-sensitive jurisdiction (Yemen)",
    "First-time creator with no prior campaign history",
    "Goal amount ($45,000) is above median for personal cause campaigns"
  ],
  "positive_signals": [
    "Detailed, specific campaign description with named beneficiary",
    "Sanctions screen passed",
    "Creator account verified email"
  ],
  "missing_documents": ["beneficiary_id", "bank_verification"],
  "recommended_action": "REQUEST_DOCUMENTS",
  "reviewer_note": "Likely legitimate — Yemen-based campaigns for personal causes require Enhanced Due Diligence. Standard EDD document set applies. Creator is responsive based on account activity."
}
```

**Risk Tiers:**

| Tier | Meaning | Suggested Reviewer Action |
|------|---------|--------------------------|
| LOW | Strong signals, no compliance flags, complete docs | Review AI draft approval email → send |
| MEDIUM | Missing docs, moderate risk signals, or sensitive region | Review AI document request → edit if needed → send |
| HIGH | OFAC flags, large goal, inconsistent description, or pattern match | Senior reviewer required, AI provides case summary |
| ESCALATE | Sanctions hit or clear fraud indicators | Immediate escalation path, legal/compliance involved |

### 6.3 Documentation Gap Check

A deterministic rule layer (not AI) that cross-references:

- Campaign category → required document checklist
- Creator location → jurisdiction-specific requirements
- Beneficiary location → Enhanced Due Diligence trigger
- Goal amount → thresholds that require additional verification

This produces a specific, named list of missing items — not a vague "more information needed" — before the AI drafts the email.

### 6.4 Draft Email Generator

Claude generates a warm, specific, on-brand email draft for the reviewer. It:

- References the actual campaign by name
- Lists the exact documents needed and why (category-appropriate explanation)
- Sets a clear timeline expectation
- Matches LaunchGood's tone (professional, faith-aligned, human)
- Includes a structured reply format so the creator's response is easier to process

The reviewer sees the draft inline in the dashboard. They can edit it, approve it, or discard it and write their own. One click sends it through LaunchGood's existing email system.

**Example AI draft for a MEDIUM-risk campaign:**

> Subject: Your LaunchGood Fundraiser — Additional Documents Needed
>
> Assalamu Alaikum [Creator Name],
>
> JazakAllah Khair for submitting your fundraiser "[Campaign Name]" — your cause is important and we're honored to support your effort.
>
> To complete our review and get your campaign live as soon as possible, we need a few additional documents for campaigns raising funds on behalf of beneficiaries in Yemen:
>
> 1. **Beneficiary Identification** — A government-issued ID or equivalent for the primary beneficiary
> 2. **Bank Account Verification** — A bank statement or letter confirming the account connected to this campaign
>
> Please reply to this email with the documents attached. Once received, our team will complete your review within 24 hours, inshAllah.
>
> If you have any questions, we're here to help.
>
> Warmly,
> [Reviewer Name]
> Trust & Safety Team, LaunchGood

### 6.5 Review Dashboard

The primary interface for the T&S team. Key views:

**Queue View**
- All pending campaigns sorted by risk tier (HIGH → MEDIUM → LOW) and time in queue
- SLA timer showing how long each campaign has been waiting
- Color-coded risk badges
- One-line AI summary per campaign
- Surge indicator during Ramadan / high-volume periods

**Campaign Detail View**
- Full campaign information
- AI risk score and reasoning (expandable signal breakdown)
- Document checklist (submitted vs. missing, with required vs. optional labels)
- AI-generated email draft (editable inline)
- Action buttons: Approve / Send Document Request / Escalate / Reject
- Decision log showing any prior interactions on this creator's account

**Ops Dashboard (for Amira)**
- Live queue depth by risk tier
- Average time-to-decision trend (today vs. 7-day avg vs. Ramadan peak)
- Document request response rate (how many creators reply within 24h)
- Reviewer throughput per team member
- Escalation rate and reasons

---

## 7. Human/AI Boundary — Design Principles

This is the most important section of this document.

**The AI owns:**
- Reading and categorizing every campaign before a human touches it
- Generating the initial risk score and the reasoning behind it
- Identifying which documents are missing based on deterministic rules
- Drafting outbound emails the reviewer can edit or send
- Maintaining the queue and surfacing the right campaigns at the right time

**The human owns:**
- Every approval, rejection, or escalation decision
- Editing or overriding the AI's risk assessment (with a reason logged)
- Sending or modifying any email to a creator
- Making judgment calls the AI explicitly flags as uncertain
- Final accountability for compliance decisions

**Trust is built incrementally:**
- Initially, reviewers see AI reasoning and draft — but always write their own emails
- After 2–4 weeks, low-risk drafts can be sent with one click if the reviewer agrees
- Agreement rate and override rate are tracked — if the AI is wrong often, the prompt and criteria are updated
- The AI never gains autonomy over MEDIUM or higher campaigns

**Failure modes we design around:**
- **Over-flagging:** AI marks too many campaigns as HIGH → reviewers ignore the tier. Mitigation: track override rate; recalibrate if >20% of HIGH campaigns are overridden to LOW/MEDIUM.
- **Under-flagging:** AI misses a genuine risk. Mitigation: human reviews all AI outputs during first 30 days; spot audits ongoing; escalation path is always one click away.
- **Hallucinated reasoning:** AI invents a risk signal that doesn't exist in the data. Mitigation: AI reasoning is always grounded in the structured input it received; reviewers are trained to check reasoning against actual campaign data.
- **Tone mismatch:** AI draft email feels cold or off-brand. Mitigation: email drafts are always editable; reviewer feedback on drafts is collected and used to refine prompts.

---

## 8. Key Metrics

### Operational
- **Time-to-decision (TTD):** Average hours from submission to first action (target: <2h for LOW, <8h for MEDIUM, <24h for HIGH)
- **First-contact resolution rate:** % of document requests resolved without a second email
- **Queue clearance rate during Ramadan:** Can the team keep up with peak volume?

### Quality
- **AI override rate:** % of cases where reviewer changes the AI-assigned risk tier (target: <15% for LOW/MEDIUM)
- **False negative rate:** Approved campaigns that later generate fraud/compliance issues (tracked retrospectively)
- **Email edit rate:** % of AI-drafted emails sent with no edits vs. moderate edits vs. full rewrite

### Creator Experience
- **Creator response time:** How quickly do creators respond to document requests?
- **Approval rate by tier:** Are legitimate campaigns getting through faster?

---

## 9. Prototype Scope (For This Application)

The submitted prototype demonstrates:

1. **Campaign intake form** — Simulates a campaign submission with realistic fields (title, description, creator location, beneficiary location, goal, category, documents submitted)
2. **AI triage in real-time** — Calls Claude API, displays risk tier, reasoning breakdown, and signal list as the analysis runs
3. **Document gap check** — Rule-based layer that identifies what's missing before the email is drafted
4. **AI email draft** — Claude generates a specific, warm, on-brand document request email
5. **Reviewer queue dashboard** — Shows multiple mock campaigns at different risk tiers with SLA timers
6. **One-click approve/send flow** — Reviewer edits draft and sends, decision is logged

**What's mocked (with stated assumptions):**
- Campaign data is seeded with realistic mock submissions across different risk profiles
- Sanctions screening result is a mock field (real system would integrate with FinClusive or equivalent)
- Email sending is simulated (real system would integrate with LaunchGood's email service)
- Creator account history is mocked (real system would pull from LaunchGood's database)

---

## 10. Trade-offs & Decisions

**Why Claude for risk triage, not a rule-based classifier?**
Campaign descriptions are unstructured natural language. A rigid rule system catches obvious signals but misses context — a campaign for "medical supplies" to a sanctioned region looks very different from a campaign for "school books" to the same region. Claude can reason about context, stated purpose, and plausibility in a way that rules cannot. The rules layer handles deterministic requirements (document checklists); Claude handles nuanced judgment.

**Why email drafting, not just triage?**
The document request email is where the most time is lost. Reviewers writing from scratch produce inconsistent, sometimes too-vague requests that lead to incomplete replies and more back-and-forth. A specific, well-structured email draft — even if the reviewer rewrites 30% of it — is faster and produces better creator responses. This is where the AI creates the most immediate time savings.

**Why not automate approvals for LOW-risk campaigns?**
Trust must be earned. Even if the AI achieves 98% accuracy on LOW-risk triage, a false negative on a campaign for a vulnerable beneficiary has serious human consequences and reputational risk for LaunchGood. The human-in-loop is non-negotiable until the system's accuracy is validated over a long period. The goal is to make the human's job easier, not to remove them.

**Why build a dashboard rather than plug into an existing ticketing system?**
A purpose-built dashboard can present AI reasoning, document checklists, and email drafts in one view — the way a compliance reviewer actually thinks about a case. Bolting AI output onto a generic tool like Zendesk would require the reviewer to switch contexts and mentally reassemble information. The UX is part of the design.

---

## 11. Future Roadmap (Out of Scope for Prototype)

- **Creator-facing status page:** Creators can see exactly where their campaign is in review and what documents are still needed — reducing inbound support volume
- **Payout hold triage:** Apply the same AI-assisted triage to post-campaign payout holds, which are the second-biggest source of creator complaints
- **Pattern detection across accounts:** AI flags when multiple new accounts share device fingerprint, beneficiary name, or bank details
- **Multilingual support:** Draft emails in the creator's preferred language (Arabic, Malay, Urdu, French) using the same AI layer
- **Ramadan surge mode:** Automated queue prioritization rules that kick in during high-volume periods to ensure urgent campaigns are never buried

---

*This document was prepared as part of an application for the Applied AI Engineer role at LaunchGood. All assumptions about internal processes are stated explicitly and based on publicly available information from LaunchGood's support center, safety documentation, and user reviews.*

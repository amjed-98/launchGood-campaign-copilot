# Campaign Review Triage Copilot

This context describes the internal Trust & Safety review workflow for LaunchGood campaign submissions. The prototype exists to simulate AI-assisted triage while keeping every campaign decision with a human reviewer.

## Language

**Simulated Campaign Intake**:
An internal prototype tool where a reviewer or demo operator enters campaign submission data so it can be triaged and added to the review queue.
_Avoid_: Creator-facing submission flow, public campaign creation

**Review Queue**:
The list of submitted campaigns awaiting Trust & Safety review, ordered by operational priority.
_Avoid_: Inbox, ticket list

**Local Prototype Record**:
A browser-persisted prototype record used to keep simulated campaign and review activity visible across refreshes without a database.
_Avoid_: Database record, backend persistence

**Unified Local Queue**:
The browser-persisted campaign queue initialized from seeded mock campaigns and then updated by prototype actions.
_Avoid_: Split seeded queue, separate intake queue

**Campaign Detail**:
The reviewer workspace for one campaign, including campaign facts, AI triage, document gaps, communication draft, and human actions.
_Avoid_: Case page, campaign profile

**Document Gap Check**:
A deterministic review step that compares submitted campaign documents against required documents and produces the missing document list.
_Avoid_: AI document guess, Claude missing-docs result

**Prototype Rules Matrix**:
A small explicit set of document rules covering campaign category, legal-entity needs, sensitive beneficiary locations, sanctions status, and goal thresholds.
_Avoid_: Full compliance engine, opaque policy model

**Required Document**:
A document that must be present or requested before the reviewer can move toward approval.
_Avoid_: Suggested document, helpful document

**Optional Document**:
A helpful supporting document that may improve reviewer confidence but does not block approval by itself.
_Avoid_: Missing document, required document

**AI Triage**:
An advisory risk assessment that explains campaign signals and recommends the next human workflow action.
_Avoid_: Automated decision, approval engine

**Fallback Triage**:
A local advisory risk assessment computed from campaign facts and the prototype rules matrix when Claude is unavailable.
_Avoid_: Seed echo, random mock result

**Escalation**:
A human action that routes a campaign to senior or compliance review before any final campaign decision.
_Avoid_: Rejection, denial

**Rejection**:
A final human decision that closes a campaign as not approvable and records the reviewer’s reason.
_Avoid_: Escalation, AI rejection

**Active Review Queue**:
The subset of review queue items that still require human or creator follow-up before a final decision.
_Avoid_: Completed campaigns, resolved queue

**Decision History**:
The local prototype record of final and non-final reviewer actions taken on campaigns.
_Avoid_: Audit-complete compliance log, email thread

**Reviewer Override**:
A human change to the AI-assigned risk tier or recommended action, recorded with the reviewer’s reason.
_Avoid_: AI correction, silent edit

**Document Gap Override**:
A human reason allowing approval to proceed despite one or more missing required documents.
_Avoid_: Removing document rule, optional document

**Compliance Clearance**:
A required compliance review result for confirmed sanctions hits or unresolved screening concerns that cannot be bypassed by ordinary document-gap override.
_Avoid_: Optional compliance note, reviewer preference

**Sanctions Screening Status**:
The mock compliance-screening result used by the prototype rules matrix: pass, pending, name match, or confirmed hit.
_Avoid_: AI sanctions search, real sanctions integration

**Sensitive Beneficiary Location**:
A prototype beneficiary geography that triggers enhanced document expectations: Yemen, Gaza or Palestinian Territories, Syria, Sudan, or Afghanistan.
_Avoid_: Full OFAC list, country-risk database

**High Goal Amount**:
A campaign funding goal of at least $50,000 that triggers extra verification expectations in the prototype.
_Avoid_: Large campaign, arbitrary high risk

**Campaign Category Rule**:
A prototype document rule tied to the campaign's purpose, such as mosque renovation, medical emergency, emergency relief, orphan support, NGO project, education, food aid, disaster relief, or accessibility.
_Avoid_: Freeform category text, full taxonomy

**Review Status**:
The current lifecycle state of a campaign record: New, In review, Waiting on creator, Escalated, Approved, or Rejected.
_Avoid_: Email state, AI state

**Resolution Reason**:
A human-written reason required for rejection, escalation, reviewer override, or document-gap override.
_Avoid_: Internal note, optional comment

**Current Review Assessment**:
The effective risk tier and recommended action after applying any reviewer override while preserving the original AI triage.
_Avoid_: Overwritten AI triage, mutated recommendation

**Simulated Email Send**:
A prototype event recording that a reviewer chose to send the current draft, without delivering an external email.
_Avoid_: Real email delivery, background email automation

**Email Edit Bucket**:
A transparent prototype classification of how much a reviewer changed an AI draft before simulated send.
_Avoid_: AI quality score, hidden edit judgment

**Local Ops Metric**:
A prototype metric computed from local campaign records and reviewer events rather than a backend analytics system.
_Avoid_: Production KPI, static dashboard number

**Seeded Ops Metric**:
A clearly labeled prototype metric supplied from mock assumptions because the user flow does not generate the underlying event.
_Avoid_: Live metric, measured KPI

**Simulated Creator Response**:
A prototype event marking whether a creator’s reply to a document request was complete or incomplete, with timestamp and reviewer note.
_Avoid_: Document upload, real creator message

**Queue Priority**:
The ordering rule for active review work: escalation tier first, then high, medium, low, with older submissions first within each tier.
_Avoid_: SLA-only ordering, newest-first ordering

**Surge Indicator**:
A queue and ops signal showing whether submission volume is normal, being monitored, or in active surge.
_Avoid_: Ramadan mode, staffing scheduler

## Relationships

- A **Simulated Campaign Intake** creates one **Review Queue** item.
- A **Simulated Campaign Intake** stores its created **Review Queue** item as a **Local Prototype Record**.
- A **Simulated Campaign Intake** runs **Document Gap Check** before **AI Triage**.
- The **Review Queue** is represented by one **Unified Local Queue** after initial seeding.
- A **Review Queue** item opens into exactly one **Campaign Detail**.
- A **Document Gap Check** applies the **Prototype Rules Matrix**.
- A **Document Gap Check** provides the source of truth for missing **Required Documents** used by **AI Triage**.
- An **Optional Document** may appear in the **Document Checklist** but does not create a document gap by itself.
- A **Campaign Category Rule** contributes required and optional documents to the **Prototype Rules Matrix**.
- Mosque renovation and accessibility categories expect bank verification plus project/quote documentation.
- Medical emergency categories expect creator identity, medical evidence, beneficiary identity, and receiving-account verification.
- NGO, education, emergency relief, disaster relief, orphan support, and food aid categories expect entity/partner proof, budget or distribution plan, and receiving-account verification when funds move through an organization or partner.
- **AI Triage** may explain document gaps but does not decide which documents are missing.
- **AI Triage** runs automatically at intake when available and uses **Fallback Triage** when unavailable.
- **Fallback Triage** uses campaign facts and the **Prototype Rules Matrix** rather than echoing seeded values.
- **Escalation** is not a final campaign decision and requires a human reason.
- A **Rejection** is always made by a human reviewer and requires a reason.
- Approvals and **Rejections** leave the **Active Review Queue** and remain visible through **Decision History**.
- Document requests and **Escalations** remain in the **Active Review Queue** with updated status.
- Resolved campaigns keep their **Campaign Detail** available from history views with final action controls disabled.
- A **Reviewer Override** may change risk tier, recommended action, or both.
- Every **Reviewer Override** requires a reason and is captured in **Decision History**.
- Approval is blocked by missing **Required Documents** unless a **Document Gap Override** is recorded.
- A **Document Gap Override** preserves the original document gap and records why the reviewer proceeded.
- A **Document Gap Override** cannot bypass missing **Compliance Clearance**.
- A confirmed-hit **Sanctions Screening Status** forces escalation, requires **Compliance Clearance**, and blocks approval.
- A name-match **Sanctions Screening Status** creates high risk and requires name-match resolution or senior review.
- A pending **Sanctions Screening Status** blocks routine approval until screening resolves.
- A passed **Sanctions Screening Status** adds no sanctions-specific document requirement.
- A **Sensitive Beneficiary Location** raises review scrutiny and adds enhanced document expectations in the **Prototype Rules Matrix**.
- A **High Goal Amount** adds verification expectations and a risk signal, but does not force high risk by itself.
- **Review Status** determines whether a campaign appears in the **Active Review Queue**.
- A **Resolution Reason** is required for rejection, escalation, reviewer override, and document-gap override.
- A **Current Review Assessment** may differ from **AI Triage** when a **Reviewer Override** exists.
- **AI Triage** remains visible after a **Reviewer Override** for comparison and metrics.
- A **Simulated Email Send** records the final edited draft and moves the campaign to creator follow-up.
- A **Simulated Email Send** never delivers an external email.
- A **Simulated Email Send** records an **Email Edit Bucket** using deterministic text comparison.
- A **Local Ops Metric** is preferred when the prototype creates enough local events to compute it.
- A **Seeded Ops Metric** is acceptable only when the prototype does not generate the underlying event.
- A **Simulated Creator Response** can turn creator response time and first-contact resolution into **Local Ops Metrics**.
- False-negative rate remains a **Seeded Ops Metric** unless retrospective fraud/compliance outcomes are simulated.
- Reviewer throughput, escalation rate, approval rate by tier, override rate, email edit rate, creator response time, and first-contact resolution are **Local Ops Metrics** once the relevant local events exist.
- The **Active Review Queue** uses **Queue Priority**; overdue SLA state is emphasized visually but does not outrank tier.
- A **Surge Indicator** has a computed default and can be manually adjusted for demo control.

## Example Dialogue

> **Dev:** "Should the intake page look like LaunchGood's creator onboarding?"
> **Domain expert:** "No. **Simulated Campaign Intake** is an internal tool for entering test campaign data so Trust & Safety can review the resulting queue item."

## Flagged Ambiguities

- "intake form" was ambiguous between creator-facing submission and internal prototype data entry — resolved: use **Simulated Campaign Intake**.
- "persisted" was ambiguous between database-backed storage and browser persistence — resolved: prototype-created campaigns use **Local Prototype Record** storage.
- "missing documents" was ambiguous between AI output and rules output — resolved: **Document Gap Check** is the source of truth.
- "optional documents" was ambiguous as possible blockers — resolved: **Optional Documents** are display guidance only in this prototype.
- "reject" was ambiguous with escalation — resolved: **Rejection** is a final human decision, while **Escalation** routes the campaign for further review.
- "queue" was ambiguous between all campaign records and unresolved work — resolved: **Active Review Queue** excludes final approvals and rejections.
- "override" was ambiguous between changing risk and changing action — resolved: **Reviewer Override** can change either or both.
- "document override" was ambiguous with changing the rules — resolved: **Document Gap Override** permits approval without deleting the original gap.
- "current tier" was ambiguous between AI output and human-adjusted state — resolved: display **Current Review Assessment** while preserving **AI Triage**.
- "send" was ambiguous between real email integration and prototype behavior — resolved: use **Simulated Email Send**.
- "email edit rate" was ambiguous as an AI-evaluated quality metric — resolved: classify with deterministic **Email Edit Buckets**.
- "ops metric" was ambiguous between live measurement and seeded demo data — resolved: prefer **Local Ops Metrics** and label **Seeded Ops Metrics**.
- "creator response" was ambiguous as real messaging/document upload — resolved: use **Simulated Creator Response** events.
- "sorted by risk and time" was ambiguous about SLA precedence — resolved: use **Queue Priority** and visual SLA emphasis.
- "surge mode" was ambiguous between automated prioritization and display signal — resolved: **Surge Indicator** is a computed and manually adjustable signal.
- "fallback triage" was ambiguous between mock echoing and computed local behavior — resolved: **Fallback Triage** is rules-informed.
- "large goal" was ambiguous without a threshold — resolved: **High Goal Amount** means $50,000 or more in the prototype.

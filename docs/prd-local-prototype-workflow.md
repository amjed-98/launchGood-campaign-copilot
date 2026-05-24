# PRD: Complete Local Prototype Workflow for Campaign Review Triage Copilot

## Problem Statement

The current Campaign Review Triage Copilot demonstrates the core LaunchGood Trust & Safety review concept, but several PRD-level workflow features are still missing or only mocked. Reviewers can inspect seeded campaigns, run AI triage, edit a draft, and log a few actions, but the prototype does not yet model the full internal review lifecycle: **Simulated Campaign Intake**, deterministic **Document Gap Check**, **Unified Local Queue** state, reviewer overrides with reasons, **Rejection**, simulated creator follow-up, and ops metrics derived from local events.

This makes the prototype less convincing as an internal Trust & Safety tool because the **Review Queue**, **Campaign Detail**, and Ops Dashboard can drift apart, and several human/AI boundary guarantees are not enforced in the UI.

## Solution

Build the next prototype increment around a **Unified Local Queue**. On first load, seed it from the existing mock campaigns, then persist all intake-created campaigns and reviewer events as **Local Prototype Records** in browser storage. Add an internal **Simulated Campaign Intake** flow that runs a deterministic **Document Gap Check** first, then runs **AI Triage** automatically when available and uses **Fallback Triage** when Claude is unavailable.

**Campaign Detail** should preserve original **AI Triage** while allowing human **Reviewer Overrides** to produce a **Current Review Assessment**. Human decisions must remain explicit: approvals and **Rejections** leave the **Active Review Queue**, document requests and **Escalations** stay active with updated **Review Status**, and resolved **Campaign Detail** views remain inspectable with final action controls disabled.

Ops should compute **Local Ops Metrics** from the local event model wherever possible and clearly label **Seeded Ops Metrics** when the prototype does not generate the underlying event.

## User Stories

1. As a Trust & Safety reviewer, I want to create a campaign through **Simulated Campaign Intake**, so that I can demonstrate the review workflow without relying only on hardcoded mock data.
2. As a demo operator, I want intake-created campaigns to persist locally, so that the prototype still contains my test campaign after a browser refresh.
3. As a Trust & Safety reviewer, I want the **Review Queue** to combine seeded and intake-created campaigns, so that I have one consistent place to review work.
4. As a Trust & Safety reviewer, I want the **Review Queue** to show only active work by default, so that completed approvals and rejections do not clutter my daily queue.
5. As a Trust & Safety reviewer, I want resolved campaigns to remain accessible from history views, so that I can inspect prior decisions.
6. As a Trust & Safety reviewer, I want resolved **Campaign Detail** pages to disable final action controls, so that a campaign cannot be approved or rejected twice.
7. As a Trust & Safety reviewer, I want the queue ordered by ESCALATE, HIGH, MEDIUM, LOW and oldest first within each tier, so that I work the highest-priority cases first.
8. As a Trust & Safety reviewer, I want overdue SLA state visually emphasized without overriding tier order, so that urgent timing is visible without hiding compliance severity.
9. As a Trust & Safety reviewer, I want a **Surge Indicator** visible in queue and ops surfaces, so that I can tell whether campaign volume is normal, monitored, or actively surging.
10. As a demo operator, I want to manually adjust the **Surge Indicator**, so that I can demonstrate normal, monitoring, and surge states during a walkthrough.
11. As a Trust & Safety reviewer, I want **Simulated Campaign Intake** to run **Document Gap Check** immediately, so that required missing documents are known before AI assessment.
12. As a Trust & Safety reviewer, I want **Document Gap Check** to be deterministic, so that missing **Required Documents** are not invented or removed by AI.
13. As a Trust & Safety reviewer, I want the **Prototype Rules Matrix** to cover campaign category, legal-entity needs, sensitive beneficiary locations, sanctions status, and high goal amounts, so that the prototype reflects the PRD without becoming a full compliance engine.
14. As a Trust & Safety reviewer, I want **Optional Documents** shown as guidance only, so that optional support does not block approval.
15. As a Trust & Safety reviewer, I want **Required Documents** to be clearly distinguished from **Optional Documents**, so that I know what blocks approval.
16. As a Trust & Safety reviewer, I want missing **Required Documents** to block approval by default, so that the document policy is enforced consistently.
17. As a senior reviewer, I want to record a **Document Gap Override** for ordinary missing **Required Documents**, so that human judgment can handle edge cases.
18. As a compliance reviewer, I want **Compliance Clearance** gaps to be non-bypassable through ordinary **Document Gap Override**, so that sanctions-related blockers cannot be ignored.
19. As a Trust & Safety reviewer, I want confirmed sanctions hits to force escalation and require **Compliance Clearance**, so that critical compliance risks are handled correctly.
20. As a Trust & Safety reviewer, I want name-match screening results to create high risk and require resolution or senior review, so that unresolved identity concerns are not treated as routine.
21. As a Trust & Safety reviewer, I want pending screening results to block routine approval, so that campaigns are not approved before screening completes.
22. As a Trust & Safety reviewer, I want passed screening results to add no sanctions-specific document requirement, so that routine campaigns are not overburdened.
23. As a Trust & Safety reviewer, I want Yemen, Gaza or Palestinian Territories, Syria, Sudan, and Afghanistan to count as **Sensitive Beneficiary Locations** in the prototype, so that enhanced document expectations are triggered consistently.
24. As a Trust & Safety reviewer, I want campaigns with goals of at least $50,000 to trigger high-goal verification expectations, so that large raises receive extra scrutiny.
25. As a Trust & Safety reviewer, I want **High Goal Amount** to contribute a risk signal without forcing HIGH by itself, so that risk assessment remains contextual.
26. As a Trust & Safety reviewer, I want mosque renovation and accessibility categories to expect bank verification plus project or quote documentation, so that domestic project campaigns have concrete checklist expectations.
27. As a Trust & Safety reviewer, I want medical emergency categories to expect creator identity, medical evidence, beneficiary identity, and receiving-account verification, so that personal medical campaigns request the right evidence.
28. As a Trust & Safety reviewer, I want NGO, education, emergency relief, disaster relief, orphan support, and food aid categories to expect entity or partner proof, budget or distribution plan, and receiving-account verification, so that organizational funds movement is documented.
29. As a Trust & Safety reviewer, I want **AI Triage** to run automatically at intake when Claude is available, so that every new campaign enters the queue with an advisory assessment.
30. As a Trust & Safety reviewer, I want **Fallback Triage** when Claude is unavailable, so that the prototype still works without an API key.
31. As a Trust & Safety reviewer, I want **Fallback Triage** to compute a plausible tier/action from campaign facts and rules, so that intake-created campaigns are not dependent on seeded mock outputs.
32. As a Trust & Safety reviewer, I want Claude to receive deterministic missing document results as input, so that AI can explain gaps without owning them.
33. As a Trust & Safety reviewer, I want original **AI Triage** preserved after a **Reviewer Override**, so that I can compare human judgment against AI advice.
34. As a Trust & Safety reviewer, I want to override risk tier, recommended action, or both, so that I can correct AI advice without losing the original assessment.
35. As a Trust & Safety reviewer, I want every **Reviewer Override** to require a **Resolution Reason**, so that override metrics have evidence.
36. As a Trust & Safety reviewer, I want the queue to display the **Current Review Assessment** after override, so that active prioritization follows the human-reviewed state.
37. As an ops lead, I want override metrics to compare original **AI Triage** with **Current Review Assessment**, so that I can monitor AI agreement rate.
38. As a Trust & Safety reviewer, I want to reject a campaign as a final human decision, so that not-approvable campaigns can be closed explicitly.
39. As a Trust & Safety reviewer, I want rejection to require a **Resolution Reason**, so that final negative decisions have human rationale.
40. As a Trust & Safety reviewer, I want escalation to require a **Resolution Reason**, so that senior/compliance handoff includes context.
41. As a Trust & Safety reviewer, I want approval and document request actions to log current state automatically, so that routine actions are efficient.
42. As a Trust & Safety reviewer, I want approval to move a campaign out of the **Active Review Queue**, so that completed work no longer appears as pending.
43. As a Trust & Safety reviewer, I want rejection to move a campaign out of the **Active Review Queue**, so that closed campaigns no longer appear as pending.
44. As a Trust & Safety reviewer, I want document request to update **Review Status** to Waiting on creator, so that follow-up work remains visible.
45. As a Trust & Safety reviewer, I want escalation to update **Review Status** to Escalated, so that senior/compliance work remains visible.
46. As a Trust & Safety reviewer, I want Send Document Request to create a **Simulated Email Send**, so that the prototype records the event without delivering real email.
47. As a Trust & Safety reviewer, I want **Simulated Email Send** to store the final edited draft, timestamp, and campaign status change, so that document requests have evidence.
48. As an ops lead, I want **Email Edit Buckets** based on deterministic text comparison, so that I can see whether drafts are being used, edited, or rewritten.
49. As a Trust & Safety reviewer, I want **Email Edit Buckets** to be transparent, so that the prototype does not pretend an AI quality score exists.
50. As a Trust & Safety reviewer, I want campaigns in Waiting on creator to support **Simulated Creator Response**, so that creator follow-up can be demonstrated.
51. As a Trust & Safety reviewer, I want **Simulated Creator Response** to capture complete or incomplete response, timestamp, and note, so that follow-up quality can be measured.
52. As an ops lead, I want creator response time to be computed from **Simulated Email Send** and **Simulated Creator Response** events, so that the metric is locally grounded.
53. As an ops lead, I want first-contact resolution rate to be computed from complete versus incomplete **Simulated Creator Responses**, so that document request quality is visible.
54. As an ops lead, I want reviewer throughput computed from local reviewer actions, so that the Ops Dashboard reflects prototype activity.
55. As an ops lead, I want escalation rate and reasons computed from local escalation events, so that bottlenecks are explainable.
56. As an ops lead, I want approval rate by tier computed from local decisions, so that I can see whether legitimate campaigns move faster.
57. As an ops lead, I want email edit rate computed from **Simulated Email Send** events, so that draft usefulness is measurable.
58. As an ops lead, I want false-negative rate clearly labeled as seeded unless retrospective outcomes are simulated, so that fake metrics are not presented as measured behavior.
59. As a Trust & Safety reviewer, I want **Decision History** to show final and non-final reviewer actions, so that I can understand what happened on a campaign.
60. As a Trust & Safety reviewer, I want **Decision History** to include timestamps and **Resolution Reasons** where required, so that decisions are auditable within prototype limits.
61. As a Trust & Safety reviewer, I want the human/AI boundary visible in the workflow, so that no screen implies AI approval, rejection, or email sending autonomy.
62. As a demo operator, I want all local prototype state resettable, so that I can restart the demo from the seeded scenario.

## Implementation Decisions

- Build a **Unified Local Queue** module that initializes from seeded mock campaigns and persists campaign records plus reviewer events in browser storage.
- Treat browser storage as prototype persistence only; do not introduce a database.
- Add **Simulated Campaign Intake** as an internal reviewer/demo-operator workflow, not a creator-facing campaign submission flow.
- Add a deterministic **Document Gap Check** module as a deep, testable module with a simple interface: campaign facts and submitted documents in; required documents, optional documents, missing required documents, and rule explanations out.
- Add a **Prototype Rules Matrix** module or data structure that remains small and explicit instead of modeling a full compliance engine.
- Add a **Fallback Triage** module as a deep, testable module that uses campaign facts and the **Prototype Rules Matrix** to compute risk tier, recommended action, risk signals, positive signals, and reviewer note when Claude is unavailable.
- Modify **AI Triage** so missing required documents come from **Document Gap Check**, not Claude output.
- Preserve original **AI Triage** and model **Current Review Assessment** separately when **Reviewer Overrides** exist.
- Add reviewer action/event modeling for approval, rejection, escalation, document request, reviewer override, document-gap override, simulated email send, and simulated creator response.
- Require **Resolution Reason** for rejection, escalation, **Reviewer Override**, and **Document Gap Override**.
- Do not require **Resolution Reason** for normal approval or Send Document Request.
- Block approval when missing **Required Documents** exist unless a valid **Document Gap Override** is recorded.
- Never allow **Document Gap Override** to bypass missing **Compliance Clearance**.
- Move approvals and rejections out of the **Active Review Queue** while keeping them visible in **Decision History** and all-record/history views.
- Keep document requests and escalations in the **Active Review Queue** with updated **Review Status**.
- Keep resolved **Campaign Detail** views accessible and read-only for final action controls.
- Implement **Simulated Email Send** as an event, not a real email integration.
- Compute **Email Edit Bucket** with deterministic text comparison, not AI judgment.
- Add **Simulated Creator Response** for Waiting on creator campaigns.
- Update Ops Dashboard to compute **Local Ops Metrics** from local events where possible and label **Seeded Ops Metrics** explicitly.
- Add a queue-visible **Surge Indicator** with computed default plus manual demo override.
- Keep human/AI boundaries explicit: AI triages, scores, drafts, and surfaces signals; humans approve, reject, escalate, override, and simulate sends.

## Testing Decisions

- Good tests should assert externally visible behavior and stable domain outcomes, not implementation details or component internals.
- Add focused unit tests for **Document Gap Check** because it is the source of truth for missing **Required Documents**.
- Add focused unit tests for **Prototype Rules Matrix** behavior covering category rules, **Sensitive Beneficiary Locations**, **Sanctions Screening Status**, **High Goal Amount**, **Optional Documents**, and **Compliance Clearance** blockers.
- Add focused unit tests for **Fallback Triage** because it must keep intake-created campaigns usable without Claude.
- Add focused unit tests for queue lifecycle behavior: active versus resolved records, **Review Status** transitions, **Queue Priority** ordering, and approval blocking.
- Add focused unit tests for event-derived **Local Ops Metrics**, including override rate, email edit rate, creator response time, first-contact resolution, reviewer throughput, escalation rate, and approval rate by tier.
- Add component or integration tests for **Simulated Campaign Intake**, **Campaign Detail** actions, and queue filtering if a React test setup is added.
- Add E2E tests for the main prototype path if Playwright is introduced: intake campaign, review campaign, send document request, simulate creator response, approve or reject, inspect Ops Dashboard.
- The repo currently has no local test framework; initial verification should include lint and build, plus any new test runner added for the deep modules.

## Out of Scope

- Real database persistence.
- Real LaunchGood campaign ingestion.
- Creator-facing public campaign submission.
- Real email delivery.
- Real document upload or attachment handling.
- Real sanctions-list screening or FinClusive integration.
- Full global compliance policy modeling.
- Automated approval, rejection, or email sending by AI.
- Production analytics or production audit logging.
- Multilingual email generation.
- Payout hold triage.
- Pattern detection across accounts.

## Further Notes

The domain glossary in `CONTEXT.md` defines the canonical terms for this work. The most important boundary is that **Document Gap Check** owns missing **Required Documents**, while **AI Triage** remains advisory. The prototype should feel operationally coherent, but it should stay honest about browser storage, simulated email, seeded metrics, and mock compliance data.

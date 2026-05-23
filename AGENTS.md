# Campaign Review Triage Copilot — LaunchGood

## What This Is
An internal AI-powered tool for LaunchGood's Trust & Safety team to review 
crowdfunding campaign submissions. This is a job application prototype.

## The Problem We're Solving
LaunchGood manually reviews every campaign submitted across 155 countries. 
A small T&S team triages campaigns through email with no AI assistance. 
During Ramadan, volume spikes dramatically and the team gets overwhelmed.

## Core User Flow
1. Campaign submitted → AI reads it and assigns LOW/MEDIUM/HIGH/ESCALATE risk tier
2. AI identifies missing documents based on campaign category + location rules
3. AI drafts a warm, specific outbound email for the reviewer
4. Reviewer sees queue sorted by risk, reviews AI reasoning, edits draft, sends
5. Decision is logged with timestamp and reasoning

## Human/AI Boundary (CRITICAL — never violate this)
- AI: triages, scores, drafts emails, surfaces signals
- Human: every approval, rejection, escalation decision
- AI never sends emails autonomously
- AI never approves or rejects a campaign

## Tech Stack
- Next.js 16 App Router
- TypeScript
- Tailwind CSS + shadcn/ui
- Anthropic Claude API (claude-sonnet-4-20250514)
- No database — mock data + localStorage for prototype

## Routes
- /dashboard — reviewer queue (sorted HIGH → LOW, SLA timers)
- /campaign/[id] — campaign detail + AI triage + email draft + action buttons
- /ops — summary dashboard for ops team
- /api/triage — POST, calls Claude, returns structured risk JSON
- /api/draft-email — POST, calls Claude, returns email draft string

## Risk Tiers
- LOW: routine campaign, complete docs, no flags → reviewer approves in one click
- MEDIUM: missing docs or sensitive region → AI drafts document request
- HIGH: OFAC flag, large goal, inconsistent description → senior reviewer required
- ESCALATE: sanctions hit or clear fraud indicators → immediate escalation

## Mock Data
Include 5 realistic campaigns:
1. LOW — UK-based mosque renovation, repeat creator, all docs submitted
2. MEDIUM — Yemen beneficiary, first-time creator, missing beneficiary ID
3. HIGH — Large goal ($80k), Gaza relief, new account, incomplete description
4. ESCALATE — Name match on sanctions screening result
5. MEDIUM — Malaysia NGO, missing incorporation documents

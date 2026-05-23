"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Loader2, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  appendCampaignToQueue,
  notifyLocalQueueChanged,
  readQueueFromStorage,
  writeQueueToStorage
} from "@/lib/local-queue";
import {
  createCampaignFromIntake,
  parseSubmittedDocuments,
  prepareCampaignForTriage,
  type IntakeCampaignInput
} from "@/lib/intake";
import type { Campaign, TriageResult } from "@/lib/types";

const categories = [
  "Mosque renovation",
  "Medical emergency",
  "Emergency relief",
  "Disaster relief",
  "Orphan support",
  "Food aid",
  "NGO project",
  "Education",
  "Accessibility",
  "Zakat distribution"
];

const sanctionsStatuses: Array<Campaign["sanctionsScreen"]> = ["pass", "pending", "name_match", "confirmed_hit"];

const initialForm = {
  title: "",
  creatorName: "",
  creatorLocation: "",
  beneficiaryLocation: "",
  category: "Emergency relief",
  goalAmount: "25000",
  accountAgeDays: "30",
  previousCampaigns: "0",
  sanctionsScreen: "pass" as Campaign["sanctionsScreen"],
  description: "",
  documentsSubmitted: ""
};

export function CampaignIntakeForm() {
  const router = useRouter();
  const [form, setForm] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submittedDocumentPreview = useMemo(
    () => parseSubmittedDocuments(form.documentsSubmitted),
    [form.documentsSubmitted]
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const input = toIntakeInput(form);
      const intakeOptions = {
        id: `local-${crypto.randomUUID()}`,
        submittedAt: new Date().toISOString()
      };
      const campaignForTriage = prepareCampaignForTriage(input, intakeOptions);
      const triage = await runTriage(campaignForTriage);
      const campaign = createCampaignFromIntake(input, triage, intakeOptions);
      const queue = readQueueFromStorage(window.localStorage);
      const nextQueue = appendCampaignToQueue(queue, campaign);

      writeQueueToStorage(window.localStorage, nextQueue);
      notifyLocalQueueChanged();
      router.push(`/campaign/${campaign.id}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create campaign.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Campaign Facts</CardTitle>
            <CardDescription>Internal intake data used to create a local prototype record.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Campaign title" required>
              <input
                required
                value={form.title}
                onChange={(event) => setFormField("title", event.target.value)}
                className={inputClassName}
              />
            </Field>
            <Field label="Creator name" required>
              <input
                required
                value={form.creatorName}
                onChange={(event) => setFormField("creatorName", event.target.value)}
                className={inputClassName}
              />
            </Field>
            <Field label="Creator location" required>
              <input
                required
                value={form.creatorLocation}
                onChange={(event) => setFormField("creatorLocation", event.target.value)}
                className={inputClassName}
              />
            </Field>
            <Field label="Beneficiary location" required>
              <input
                required
                value={form.beneficiaryLocation}
                onChange={(event) => setFormField("beneficiaryLocation", event.target.value)}
                className={inputClassName}
              />
            </Field>
            <Field label="Category">
              <select
                value={form.category}
                onChange={(event) => setFormField("category", event.target.value)}
                className={inputClassName}
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Sanctions screen">
              <select
                value={form.sanctionsScreen}
                onChange={(event) => setFormField("sanctionsScreen", event.target.value as Campaign["sanctionsScreen"])}
                className={inputClassName}
              >
                {sanctionsStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Goal amount">
              <input
                type="number"
                min="1"
                value={form.goalAmount}
                onChange={(event) => setFormField("goalAmount", event.target.value)}
                className={inputClassName}
              />
            </Field>
            <Field label="Account age days">
              <input
                type="number"
                min="0"
                value={form.accountAgeDays}
                onChange={(event) => setFormField("accountAgeDays", event.target.value)}
                className={inputClassName}
              />
            </Field>
            <Field label="Previous campaigns">
              <input
                type="number"
                min="0"
                value={form.previousCampaigns}
                onChange={(event) => setFormField("previousCampaigns", event.target.value)}
                className={inputClassName}
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Campaign Description</CardTitle>
            <CardDescription>Submission copy available to Trust & Safety review.</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              required
              value={form.description}
              onChange={(event) => setFormField("description", event.target.value)}
              className="min-h-[180px]"
            />
          </CardContent>
        </Card>
      </section>

      <aside className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Submitted Documents</CardTitle>
            <CardDescription>Use document keys separated by commas or new lines.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={form.documentsSubmitted}
              onChange={(event) => setFormField("documentsSubmitted", event.target.value)}
              className="min-h-[180px]"
              placeholder="creator_id, bank_verification, project_budget"
            />
            <div className="rounded-md border bg-muted/35 p-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Parsed documents</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {submittedDocumentPreview.length > 0 ? submittedDocumentPreview.join(", ") : "No documents listed"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Create Local Record</CardTitle>
            <CardDescription>Document Gap Check runs before advisory AI triage.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {error ? <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <PlusCircle className="size-4" aria-hidden="true" />
              )}
              Run intake triage
            </Button>
            <div className="flex items-start gap-2 rounded-md border bg-white p-3 text-sm text-muted-foreground">
              <ClipboardCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <p>The new campaign is saved only in this browser&apos;s unified local queue.</p>
            </div>
          </CardContent>
        </Card>
      </aside>
    </form>
  );

  function setFormField<Key extends keyof typeof form>(key: Key, value: (typeof form)[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }
}

async function runTriage(campaign: Campaign): Promise<TriageResult> {
  const response = await fetch("/api/triage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ campaign })
  });

  if (!response.ok) {
    throw new Error("Unable to run intake triage.");
  }

  return (await response.json()) as TriageResult;
}

function toIntakeInput(form: typeof initialForm): IntakeCampaignInput {
  return {
    title: form.title,
    creatorName: form.creatorName,
    creatorLocation: form.creatorLocation,
    beneficiaryLocation: form.beneficiaryLocation,
    category: form.category,
    goalAmount: Number(form.goalAmount),
    accountAgeDays: Number(form.accountAgeDays),
    previousCampaigns: Number(form.previousCampaigns),
    sanctionsScreen: form.sanctionsScreen,
    description: form.description,
    documentsSubmitted: parseSubmittedDocuments(form.documentsSubmitted)
  };
}

function Field({ label, required = false, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      <span>
        {label}
        {required ? <span className="text-rose-600"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

const inputClassName =
  "h-10 rounded-md border border-input bg-white px-3 text-sm shadow-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";

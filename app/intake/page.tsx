import { AppShell } from "@/components/app-shell";
import { CampaignIntakeForm } from "@/components/campaign-intake-form";

export default function IntakePage() {
  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-2">
        <p className="text-sm font-medium text-primary">Simulated Campaign Intake</p>
        <h1 className="text-3xl font-semibold tracking-normal">Create local campaign</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Add an internal prototype record to the unified local queue. AI triage remains advisory and every campaign
          decision stays with a human reviewer.
        </p>
      </div>

      <CampaignIntakeForm />
    </AppShell>
  );
}

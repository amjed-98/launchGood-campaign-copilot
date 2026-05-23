import { Badge } from "@/components/ui/badge";
import { riskLabelClasses } from "@/lib/risk";
import type { RiskTier } from "@/lib/types";

export function RiskBadge({ tier }: { tier: RiskTier }) {
  return (
    <Badge variant="outline" className={riskLabelClasses[tier]}>
      {tier}
    </Badge>
  );
}

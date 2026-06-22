import { Boxes, BrainCircuit, CheckCircle2, MailCheck } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

interface StatsProps {
  totalProducts: number;
  totalAnalyses: number;
  worthBuildingCount: number;
  lastDigestSentAt: Date | string | null;
}

export function StatsCards({
  totalProducts,
  totalAnalyses,
  worthBuildingCount,
  lastDigestSentAt,
}: StatsProps) {
  const items = [
    {
      label: "Total Products",
      value: String(totalProducts),
      icon: Boxes,
    },
    {
      label: "Total Analyses",
      value: String(totalAnalyses),
      icon: BrainCircuit,
    },
    {
      label: "Worth Building",
      value: String(worthBuildingCount),
      icon: CheckCircle2,
    },
    {
      label: "Last Digest Sent",
      value: lastDigestSentAt ? formatDate(lastDigestSentAt) : "Never",
      icon: MailCheck,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {item.label}
              </CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{item.value}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

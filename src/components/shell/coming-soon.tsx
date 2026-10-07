import { Hammer } from "lucide-react";
import { EmptyState } from "@/components/brand/empty-state";
import { PageHeader } from "./page-header";

/** Placeholder for a screen whose phase hasn't been built yet. Removed screen by screen. */
export function ComingSoon({ title, description, phase }: { title: string; description: string; phase: string }) {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={title} description={description} />
      <EmptyState
        className="bg-card"
        icon={<Hammer className="size-6" />}
        title="This screen is next on the list"
        description={`It is built in ${phase} of the implementation plan.`}
      />
    </div>
  );
}

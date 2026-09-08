import { Ruler } from "lucide-react";

import { APP_NAME } from "@/lib/constants";

export function AuthBrand() {
  return (
    <div className="mb-6 flex items-center justify-center gap-2">
      <div className="flex size-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Ruler className="size-6" />
      </div>
      <span className="font-heading text-lg">{APP_NAME}</span>
    </div>
  );
}

import { Ruler } from "lucide-react";

import { APP_NAME } from "@/lib/constants";

export function AuthBrand() {
  return (
    <div className="mb-6 flex items-center justify-center gap-2">
      <img src="https://media.licdn.com/dms/image/v2/D560BAQHRRHYRf3WZWg/company-logo_200_200/company-logo_200_200/0/1709055160728/thetailoredai_logo?e=2147483647&v=beta&t=zgoD-kt4ICmqJVq9Jrq0WTPuadyLShYpB8bPeZH0FlM" alt="Logo" className="size-12 rounded-lg" />
      <span className="font-heading text-lg">{APP_NAME}</span>
    </div>
  );
}

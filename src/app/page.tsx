import { redirect } from "next/navigation";

import { getSessionContext } from "@/lib/auth";

/** Root just routes people to the surface that belongs to their role. */
export default async function HomePage() {
  const context = await getSessionContext();

  if (!context) redirect("/login");
  redirect(context.profile.role === "admin" ? "/admin" : "/portal");
}

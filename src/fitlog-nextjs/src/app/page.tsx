// Root → redirect to /today (the landing screen per the canonical IA).
import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/today");
}

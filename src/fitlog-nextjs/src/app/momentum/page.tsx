import { redirect } from "next/navigation";

// Momentum page retired — redirect to Today.
export default function MomentumPage() {
  redirect("/today");
}

import { redirect } from "next/navigation";
import LoginPage from "./login/page";
import { getCurrentSessionUser } from "@/lib/demo";

export default async function Home() {
  const user = await getCurrentSessionUser();

  if (user) {
    redirect("/dashboard");
  }

  return <LoginPage />;
}

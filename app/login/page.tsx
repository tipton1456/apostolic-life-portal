import Image from "next/image";
import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-6 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-8">
        <Image
          src="/apostolic-life-white.png"
          alt="Apostolic Life Tupelo Mississippi"
          width={1786}
          height={535}
          priority
          className="h-auto w-64 max-w-full"
        />

        <h1 className="mt-4 text-3xl font-bold">Member Login</h1>

        <p className="mt-3 text-sm leading-6 text-neutral-400">
          Sign in with your email address to access your household information.
        </p>

        <LoginForm />
      </div>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PlanningCenterPersonSearchResult } from "@/lib/planning-center";

type PlanningCenterPersonSearchProps = {
  selectedPerson?: PlanningCenterPersonSearchResult | null;
};

export default function PlanningCenterPersonSearch({
  selectedPerson,
}: PlanningCenterPersonSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlanningCenterPersonSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const trimmedQuery = query.trim();

    if (trimmedQuery.length < 2) {
      return;
    }

    const abortController = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsLoading(true);

      try {
        const response = await fetch(
          `/api/admin/planning-center/people?q=${encodeURIComponent(trimmedQuery)}`,
          {
            signal: abortController.signal,
          },
        );

        if (!response.ok) {
          setResults([]);
          return;
        }

        const data = (await response.json()) as {
          people?: PlanningCenterPersonSearchResult[];
        };

        setResults(data.people ?? []);
      } catch (error) {
        if (!abortController.signal.aborted) {
          console.error("Planning Center person search failed:", error);
          setResults([]);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      abortController.abort();
    };
  }, [query]);

  function selectPerson(person: PlanningCenterPersonSearchResult) {
    setQuery("");
    setResults([]);
    router.push(`/admin/schedule-lookup?personId=${person.id}`);
  }

  return (
    <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <h2 className="text-2xl font-semibold">Find Person</h2>
      <input
        value={query}
        onChange={(event) => {
          const nextQuery = event.target.value;

          setQuery(nextQuery);

          if (nextQuery.trim().length < 2) {
            setResults([]);
            setIsLoading(false);
          }
        }}
        className="mt-4 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none ring-lime-400 transition focus:ring-2"
        placeholder="Start typing a Planning Center name"
      />

      {selectedPerson ? (
        <p className="mt-3 text-sm text-neutral-400">
          Showing assignments for{" "}
          <span className="font-semibold text-lime-300">
            {selectedPerson.name}
          </span>
        </p>
      ) : null}

      {query.trim().length >= 2 ? (
        <div className="mt-5 divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10">
          {isLoading ? (
            <p className="px-4 py-3 text-sm text-neutral-400">Searching...</p>
          ) : results.length > 0 ? (
            results.map((person) => (
              <button
                key={person.id}
                type="button"
                onClick={() => selectPerson(person)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.06]"
              >
                {person.thumbnail ? (
                  <img
                    src={person.thumbnail}
                    alt={person.name}
                    className="h-9 w-9 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lime-400 text-xs font-bold text-neutral-950">
                    {getInitials(person.name)}
                  </span>
                )}
                <span className="font-semibold text-neutral-100">
                  {person.name}
                </span>
              </button>
            ))
          ) : (
            <p className="px-4 py-3 text-sm text-neutral-400">
              No matching people found.
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

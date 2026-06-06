"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { PersonSearchResult } from "@/lib/elvanto-groups";

type GroupMemberSearchProps = {
  addPersonAction: (formData: FormData) => void;
  existingMemberIds: string[];
  groupId: string;
};

export default function GroupMemberSearch({
  addPersonAction,
  existingMemberIds,
  groupId,
}: GroupMemberSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PersonSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const existingMemberIdSet = useMemo(
    () => new Set(existingMemberIds),
    [existingMemberIds],
  );

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
          `/api/groups/${groupId}/search?q=${encodeURIComponent(trimmedQuery)}`,
          {
            signal: abortController.signal,
          },
        );

        if (!response.ok) {
          setResults([]);
          return;
        }

        const data = (await response.json()) as {
          people?: PersonSearchResult[];
        };

        setResults(data.people ?? []);
      } catch (error) {
        if (!abortController.signal.aborted) {
          console.error("Group member search failed:", error);
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
  }, [groupId, query]);

  return (
    <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <h2 className="text-2xl font-semibold">Add Person To Group</h2>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="mt-4 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none ring-lime-400 transition focus:ring-2"
        placeholder="Start typing a name, email, or mobile"
      />

      {query.trim().length >= 2 ? (
        <div className="mt-5 divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10">
          {isLoading ? (
            <p className="px-4 py-3 text-sm text-neutral-400">Searching...</p>
          ) : results.length > 0 ? (
            results.map((person) => (
              <div
                key={person.id}
                className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-semibold text-neutral-100">{person.name}</p>
                  <p className="mt-1 text-sm text-neutral-400">
                    {person.email} · {person.mobile}
                  </p>
                </div>
                {existingMemberIdSet.has(person.id) ? (
                  <span className="text-sm text-neutral-500">
                    Already in group
                  </span>
                ) : (
                  <form
                    action={(formData) => {
                      startTransition(() => addPersonAction(formData));
                      setQuery("");
                      setResults([]);
                    }}
                  >
                    <input type="hidden" name="groupId" value={groupId} />
                    <input type="hidden" name="personId" value={person.id} />
                    <button
                      type="submit"
                      disabled={isPending}
                      className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-neutral-100 transition hover:border-lime-400/60 hover:text-lime-300 disabled:cursor-wait disabled:opacity-60"
                    >
                      Add Person
                    </button>
                  </form>
                )}
              </div>
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

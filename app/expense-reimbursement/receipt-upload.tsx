"use client";

import { useState } from "react";

const MAX_RECEIPT_UPLOAD_BYTES = 4 * 1024 * 1024;

export default function ReceiptUpload() {
  const [error, setError] = useState("");

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <h2 className="text-2xl font-semibold">Receipts</h2>
      <p className="mt-2 text-sm text-neutral-400">
        Upload receipt images or PDFs. Keep the total upload under 4 MB.
      </p>
      <label className="mt-5 block text-sm font-medium text-neutral-300">
        Upload Receipts / Files
        <input
          accept="image/*,.pdf"
          className="mt-2 w-full rounded-xl border border-dashed border-white/15 bg-neutral-900 px-4 py-4 text-sm text-neutral-200 file:mr-4 file:rounded-lg file:border-0 file:bg-lime-400 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-neutral-950 hover:border-lime-400/50"
          multiple
          name="receipts"
          onChange={(event) => {
            const files = Array.from(event.currentTarget.files ?? []);
            const totalSize = files.reduce((sum, file) => sum + file.size, 0);

            if (totalSize > MAX_RECEIPT_UPLOAD_BYTES) {
              event.currentTarget.value = "";
              setError("Receipt uploads must be 4 MB or less total.");
              return;
            }

            setError("");
          }}
          required
          type="file"
        />
      </label>

      {error ? (
        <p className="mt-3 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm font-semibold text-red-200">
          {error}
        </p>
      ) : null}
    </section>
  );
}

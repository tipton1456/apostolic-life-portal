"use client";

import { useState, type FormEvent } from "react";
import AdminFormButton from "@/app/admin/admin-form-button";

type CloneContactUpdateFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  cloneEmail: string;
  person: {
    birthdayValue: string;
    email: string;
    id: string;
    mobile: string;
    phone: string;
  };
};

const MAX_PHOTO_SIZE = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export default function CloneContactUpdateForm({
  action,
  cloneEmail,
  person,
}: CloneContactUpdateFormProps) {
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const photo = formData.get("profilePicture");

    setError("");

    if (!(photo instanceof File) || photo.size === 0) return;

    if (!ALLOWED_PHOTO_TYPES.has(photo.type)) {
      event.preventDefault();
      setError("Please upload a JPG, PNG, or WebP image.");
      return;
    }

    if (photo.size > MAX_PHOTO_SIZE) {
      event.preventDefault();
      setError("Please choose an image smaller than 5MB.");
    }
  }

  return (
    <form
      action={action}
      className="mt-5 border-t border-white/10 pt-5"
      onSubmit={handleSubmit}
    >
      <input type="hidden" name="cloneEmail" value={cloneEmail} />
      <input type="hidden" name="personId" value={person.id} />
      <div className="grid gap-4 md:grid-cols-2">
        <TextInput
          label="Email"
          name="email"
          type="email"
          defaultValue={editableValue(person.email)}
        />
        <TextInput
          label="Phone"
          name="phone"
          defaultValue={editableValue(person.phone)}
        />
        <TextInput
          label="Mobile"
          name="mobile"
          defaultValue={editableValue(person.mobile)}
        />
        <TextInput
          label="Birthdate"
          name="birthday"
          type="date"
          defaultValue={person.birthdayValue}
        />
        <FileInput label="Profile Picture" name="profilePicture" />
      </div>
      {error ? <p className="mt-3 text-sm font-semibold text-red-300">{error}</p> : null}
      <AdminFormButton pendingLabel="Saving..." className="mt-5">
        Save Contact
      </AdminFormButton>
    </form>
  );
}

function TextInput({
  defaultValue,
  label,
  name,
  type = "text",
}: {
  defaultValue: string;
  label: string;
  name: string;
  type?: string;
}) {
  return (
    <label className="block text-sm font-medium text-neutral-300">
      {label}
      <input
        type={type}
        name={name}
        defaultValue={defaultValue}
        className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none ring-lime-400 transition focus:ring-2"
      />
    </label>
  );
}

function FileInput({ label, name }: { label: string; name: string }) {
  return (
    <label className="block text-sm font-medium text-neutral-300 md:col-span-2">
      {label}
      <input
        type="file"
        name={name}
        accept="image/jpeg,image/png,image/webp"
        className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm text-neutral-100 outline-none ring-lime-400 transition file:mr-4 file:rounded-lg file:border-0 file:bg-lime-400 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-neutral-950 hover:file:bg-lime-300 focus:ring-2"
      />
      <span className="mt-1 block text-xs text-neutral-500">
        JPG, PNG, or WebP under 5MB. Photo uploads sync to Planning Center when
        matched.
      </span>
    </label>
  );
}

function editableValue(value: string) {
  return value === "Not listed" ? "" : value;
}

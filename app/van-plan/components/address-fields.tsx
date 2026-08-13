"use client";

import { useState } from "react";
import { lookupVanPlanAddressAction } from "@/lib/van-plan/actions";
import type { VanPlanAddress, VanPlanAddressSuggestion } from "@/lib/van-plan/address";
import { VAN_PLAN_STATES } from "@/lib/van-plan/constants";

export default function VanPlanAddressFields({
  defaults,
}: {
  defaults?: Partial<VanPlanAddress>;
}) {
  const [address, setAddress] = useState<VanPlanAddress>({
    addressLine1: defaults?.addressLine1 ?? "",
    addressLine2: defaults?.addressLine2 ?? "",
    city: defaults?.city ?? "",
    state: defaults?.state ?? "",
    zip: defaults?.zip ?? "",
  });
  const [suggestions, setSuggestions] = useState<VanPlanAddressSuggestion[]>([]);
  const [message, setMessage] = useState("");
  const [lookingUp, setLookingUp] = useState(false);

  function update<Key extends keyof VanPlanAddress>(key: Key, value: string) {
    setAddress((current) => ({ ...current, [key]: value }));
  }

  async function lookupAddress() {
    setLookingUp(true);
    setMessage("");
    setSuggestions([]);

    try {
      const matches = await lookupVanPlanAddressAction(address);
      setSuggestions(matches);
      setMessage(
        matches.length === 1
          ? "We found a matching address. Use it if it looks right."
          : `We found ${matches.length} matching addresses.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to look up that address.",
      );
    } finally {
      setLookingUp(false);
    }
  }

  return (
    <div className="grid gap-4 md:col-span-2 md:grid-cols-2">
      <label className="vp-subhead block text-sm md:col-span-2">
        mailing address 1
        <input
          name="addressLine1"
          required
          autoComplete="address-line1"
          value={address.addressLine1}
          onChange={(event) => update("addressLine1", event.target.value)}
          className="vp-input mt-2"
        />
      </label>

      <label className="vp-subhead block text-sm md:col-span-2">
        mailing address 2
        <input
          name="addressLine2"
          autoComplete="address-line2"
          value={address.addressLine2}
          onChange={(event) => update("addressLine2", event.target.value)}
          className="vp-input mt-2"
        />
      </label>

      <label className="vp-subhead block text-sm">
        city
        <input
          name="city"
          required
          autoComplete="address-level2"
          value={address.city}
          onChange={(event) => update("city", event.target.value)}
          className="vp-input mt-2"
        />
      </label>

      <label className="vp-subhead block text-sm">
        state
        <select
          name="state"
          required
          value={address.state}
          onChange={(event) => update("state", event.target.value)}
          className="vp-select mt-2"
        >
          <option value="">select</option>
          {VAN_PLAN_STATES.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>
      </label>

      <label className="vp-subhead block text-sm">
        zip
        <input
          name="zip"
          required
          autoComplete="postal-code"
          value={address.zip}
          onChange={(event) => update("zip", event.target.value)}
          className="vp-input mt-2"
        />
      </label>

      <div className="flex items-end">
        <button
          type="button"
          onClick={lookupAddress}
          disabled={lookingUp}
          className="vp-button vp-button-secondary w-full"
        >
          {lookingUp ? "Looking up..." : "Look up address"}
        </button>
      </div>

      {message ? <p className="vp-accent text-sm md:col-span-2">{message}</p> : null}

      {suggestions.length > 0 ? (
        <div className="md:col-span-2 space-y-2">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.label}
              type="button"
              className="vp-card block w-full px-4 py-3 text-left"
              onClick={() => {
                setAddress({
                  addressLine1: suggestion.addressLine1,
                  addressLine2: suggestion.addressLine2,
                  city: suggestion.city,
                  state: suggestion.state,
                  zip: suggestion.zip,
                });
                setSuggestions([]);
                setMessage("Address applied. Review it before saving.");
              }}
            >
              <span className="vp-description">{suggestion.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

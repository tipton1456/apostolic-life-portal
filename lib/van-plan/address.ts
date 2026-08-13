import { VAN_PLAN_STATES } from "@/lib/van-plan/constants";
import { VanPlanError } from "@/lib/van-plan/db";

export type VanPlanAddress = {
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zip: string;
};

export type VanPlanAddressSuggestion = VanPlanAddress & {
  label: string;
};

type CensusAddressMatch = {
  matchedAddress?: string;
  addressComponents?: {
    fromAddress?: string;
    toAddress?: string;
    streetName?: string;
    preType?: string;
    preDirection?: string;
    preQualifier?: string;
    suffixType?: string;
    suffixDirection?: string;
    suffixQualifier?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
};

export function emptyVanPlanAddress(): VanPlanAddress {
  return {
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    zip: "",
  };
}

export function readVanPlanAddress(formData: FormData): VanPlanAddress {
  return {
    addressLine1: String(formData.get("addressLine1") ?? "").trim(),
    addressLine2: String(formData.get("addressLine2") ?? "").trim(),
    city: String(formData.get("city") ?? "").trim(),
    state: String(formData.get("state") ?? "").trim().toUpperCase(),
    zip: String(formData.get("zip") ?? "").trim(),
  };
}

export function assertVanPlanAddress(address: VanPlanAddress) {
  if (address.addressLine1.length < 3) {
    throw new VanPlanError("Enter mailing address line 1.");
  }

  if (address.city.length < 2) {
    throw new VanPlanError("Enter a city.");
  }

  if (!VAN_PLAN_STATES.includes(address.state as (typeof VAN_PLAN_STATES)[number])) {
    throw new VanPlanError("Choose a valid two-letter state.");
  }

  if (!/^\d{5}(-\d{4})?$/.test(address.zip)) {
    throw new VanPlanError("Enter a valid 5-digit ZIP code.");
  }
}

export async function lookupVanPlanAddress(
  address: VanPlanAddress,
): Promise<VanPlanAddressSuggestion[]> {
  const street = address.addressLine1.trim();
  const city = address.city.trim();
  const state = address.state.trim();
  const zip = address.zip.trim();

  if (!street && !city && !zip) {
    throw new VanPlanError("Enter at least a street or city to look up an address.");
  }

  const params = new URLSearchParams({
    benchmark: "Public_AR_Current",
    format: "json",
  });

  if (street && (city || state || zip)) {
    params.set("street", street);
    if (city) params.set("city", city);
    if (state) params.set("state", state);
    if (zip) params.set("zip", zip);
  } else {
    params.set(
      "address",
      [street, city, state, zip].filter(Boolean).join(", "),
    );
  }

  const path = params.has("street")
    ? "locations/address"
    : "locations/onelineaddress";

  const response = await fetch(
    `https://geocoding.geo.census.gov/geocoder/${path}?${params.toString()}`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    throw new VanPlanError("Unable to look up that address right now.", 502);
  }

  const payload = (await response.json()) as {
    result?: { addressMatches?: CensusAddressMatch[] };
  };

  const matches = payload.result?.addressMatches ?? [];

  if (matches.length === 0) {
    throw new VanPlanError(
      "No matching USPS-style address was found. Check the street, city, state, and ZIP.",
    );
  }

  return matches.slice(0, 5).map((match) => {
    const components = match.addressComponents ?? {};
    const streetNumber = components.fromAddress || components.toAddress || "";
    const streetName = [
      components.preQualifier,
      components.preDirection,
      components.preType,
      components.streetName,
      components.suffixType,
      components.suffixDirection,
      components.suffixQualifier,
    ]
      .filter(Boolean)
      .join(" ");

    const next: VanPlanAddressSuggestion = {
      addressLine1: [streetNumber, streetName].filter(Boolean).join(" ").trim() ||
        match.matchedAddress?.split(",")[0]?.trim() ||
        street,
      addressLine2: address.addressLine2,
      city: components.city || city,
      state: (components.state || state).toUpperCase(),
      zip: components.zip || zip,
      label: match.matchedAddress || `${street}, ${city}, ${state} ${zip}`,
    };

    return next;
  });
}

export const VAN_PLAN_TITLE = "The Great Van Plan";
export const VAN_PLAN_SUBTITLE = "Silent Auction";
export const VAN_PLAN_PAYMENT_MEMO = "The Great Van Plan";
export const VAN_PLAN_BASE_PATH = "/van-plan";
/** Saturday, August 29, 2026, 9:00 a.m. America/Chicago (CDT). */
export const VAN_PLAN_AUCTION_OPENS_AT = "2026-08-29T14:00:00.000Z";
/** Saturday, August 29, 2026, 1:00 p.m. America/Chicago (CDT). */
export const VAN_PLAN_AUCTION_CLOSES_AT = "2026-08-29T18:00:00.000Z";
export const VAN_PLAN_AUCTION_TIME_ZONE = "America/Chicago";
export const VAN_PLAN_SESSION_COOKIE = "van_plan_session";
export const VAN_PLAN_SESSION_DAYS = 14;
export const VAN_PLAN_MIN_BID_INCREMENT_CENTS = 100;
export const VAN_PLAN_MAX_IMAGES_PER_ITEM = 12;
export const VAN_PLAN_MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const VAN_PLAN_LOGIN_WINDOW_MINUTES = 15;
export const VAN_PLAN_MAX_FAILED_LOGINS = 8;

export const VAN_PLAN_PERMISSIONS = ["admin", "auctioneer", "user"] as const;
export const VAN_PLAN_ITEM_STATUSES = ["draft", "open", "closed", "sold"] as const;

export const VAN_PLAN_ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const VAN_PLAN_COLORS = {
  background: "#F9EDE4",
  ink: "#46433c",
  accent: "#75871F",
} as const;

export const VAN_PLAN_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL",
  "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME",
  "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH",
  "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI",
  "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI",
  "WY",
] as const;

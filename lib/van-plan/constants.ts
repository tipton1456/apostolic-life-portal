export const VAN_PLAN_TITLE = "The Great Van Plan";
export const VAN_PLAN_SUBTITLE = "Silent Auction";
export const VAN_PLAN_PAYMENT_MEMO = "The Great Van Plan";
export const VAN_PLAN_BASE_PATH = "/van-plan";
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

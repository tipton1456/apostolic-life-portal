import type {
  VAN_PLAN_ITEM_STATUSES,
  VAN_PLAN_PERMISSIONS,
} from "@/lib/van-plan/constants";

export type VanPlanPermission = (typeof VAN_PLAN_PERMISSIONS)[number];
export type VanPlanItemStatus = (typeof VAN_PLAN_ITEM_STATUSES)[number];
export type VanPlanInvoiceStatus = "pending" | "sent" | "failed";

export type VanPlanUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  phoneDigits: string;
  permission: VanPlanPermission;
  createdAt: string;
};

export type VanPlanItemImage = {
  id: string;
  itemId: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  isPrimary: boolean;
  sortOrder: number;
  url: string;
};

export type VanPlanBid = {
  id: string;
  itemId: string;
  userId: string;
  bidderName: string;
  bidderEmail: string;
  bidderPhone: string;
  amountCents: number;
  createdAt: string;
};

export type VanPlanInvoice = {
  id: string;
  itemId: string;
  userId: string;
  amountCents: number;
  memo: string;
  status: VanPlanInvoiceStatus;
  stripeCustomerId: string | null;
  stripeInvoiceId: string | null;
  stripeInvoiceUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
};

export type VanPlanItem = {
  id: string;
  slug: string;
  name: string;
  description: string;
  startingPriceCents: number;
  status: VanPlanItemStatus;
  createdBy: string | null;
  soldToUserId: string | null;
  soldAt: string | null;
  createdAt: string;
  updatedAt: string;
  images: VanPlanItemImage[];
  highestBid: VanPlanBid | null;
  bidCount: number;
};

export type VanPlanActionState = {
  message: string;
  status: "idle" | "success" | "error";
  version: number;
};

export const idleVanPlanActionState: VanPlanActionState = {
  message: "",
  status: "idle",
  version: 0,
};

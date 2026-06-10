import { isDemoMode } from "./demo";

type GroupMeAttachment = {
  type?: string;
  url?: string;
  name?: string;
};

type GroupMeMessageResponse = {
  response?: {
    count?: number;
    messages?: GroupMeApiMessage[];
  };
  meta?: {
    code?: number;
    errors?: string[];
  };
};

type GroupMeApiMessage = {
  id?: string;
  created_at?: number;
  name?: string;
  avatar_url?: string;
  text?: string;
  system?: boolean;
  attachments?: GroupMeAttachment[];
};

export type PrayerBoardMessage = {
  id: string;
  author: string;
  avatarUrl?: string;
  text: string;
  createdAt: string;
  createdAtLabel: string;
  imageUrls: string[];
};

export type PrayerBoard = {
  conversationUrl?: string;
  isConfigured: boolean;
  messages: PrayerBoardMessage[];
};

export async function getPrayerBoardMessages(limit = 30): Promise<PrayerBoard> {
  if (await isDemoMode()) {
    return {
      conversationUrl: "https://groupme.com/join_group/demo-prayer-board",
      isConfigured: true,
      messages: samplePrayerMessages.slice(0, limit),
    };
  }

  const accessToken = process.env.GROUPME_ACCESS_TOKEN;
  const groupId = process.env.GROUPME_PRAYER_GROUP_ID;
  const conversationUrl = process.env.GROUPME_PRAYER_GROUP_URL;

  if (!accessToken || !groupId) {
    return {
      conversationUrl,
      isConfigured: false,
      messages: [],
    };
  }

  try {
    const messages = await getFilteredMessages({
      accessToken,
      groupId,
      limit,
    });

    return {
      conversationUrl,
      isConfigured: true,
      messages,
    };
  } catch (error) {
    console.error("GroupMe messages lookup failed:", error);

    return {
      conversationUrl,
      isConfigured: true,
      messages: [],
    };
  }
}

async function getFilteredMessages({
  accessToken,
  groupId,
  limit,
}: {
  accessToken: string;
  groupId: string;
  limit: number;
}) {
  const messages: PrayerBoardMessage[] = [];
  const seenMessageIds = new Set<string>();
  let beforeId: string | undefined;

  for (let page = 0; page < getMaxPages(limit); page += 1) {
    const result = await getMessagePage({
      accessToken,
      beforeId,
      groupId,
      pageLimit: getPageLimit(limit),
    });
    const pageMessages = result.response?.messages ?? [];

    if (pageMessages.length === 0) break;

    for (const message of pageMessages) {
      const messageId = message.id ?? `${message.created_at}-${message.name}`;

      if (seenMessageIds.has(messageId)) continue;

      seenMessageIds.add(messageId);

      if (message.system || shouldExcludePrayerBoardMessage(message.text)) {
        continue;
      }

      messages.push(mapMessage(message));

      if (messages.length >= limit) {
        return messages;
      }
    }

    const nextBeforeId = pageMessages.at(-1)?.id;

    if (!nextBeforeId || nextBeforeId === beforeId) break;

    beforeId = nextBeforeId;
  }

  return messages;
}

async function getMessagePage({
  accessToken,
  beforeId,
  groupId,
  pageLimit,
}: {
  accessToken: string;
  beforeId?: string;
  groupId: string;
  pageLimit: number;
}) {
  const url = new URL(`https://api.groupme.com/v3/groups/${groupId}/messages`);
  url.searchParams.set("limit", String(pageLimit));

  if (beforeId) {
    url.searchParams.set("before_id", beforeId);
  }

  const response = await fetch(url, {
    headers: {
      "X-Access-Token": accessToken,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`GroupMe messages lookup failed: ${response.status}`);
  }

  return (await response.json()) as GroupMeMessageResponse;
}

function getPageLimit(limit: number) {
  return Math.min(Math.max(limit * 8, 50), 100);
}

function getMaxPages(limit: number) {
  return limit <= 5 ? 5 : 3;
}

function shouldExcludePrayerBoardMessage(text?: string) {
  const normalizedText = text?.trimStart().toLowerCase() ?? "";

  return (
    normalizedText.startsWith("praise god") ||
    normalizedText.startsWith("praying") ||
    normalizedText.startsWith("thank you")
  );
}

function mapMessage(message: GroupMeApiMessage): PrayerBoardMessage {
  const createdAt = message.created_at
    ? new Date(message.created_at * 1000)
    : new Date();

  return {
    id: message.id ?? `${message.created_at}-${message.name}`,
    author: formatAuthorName(message.name),
    avatarUrl: message.avatar_url,
    text: message.text?.trim() ?? "",
    createdAt: createdAt.toISOString(),
    createdAtLabel: formatMessageTime(createdAt),
    imageUrls: (message.attachments ?? [])
      .filter((attachment) => attachment.type === "image" && attachment.url)
      .map((attachment) => attachment.url!),
  };
}

function formatAuthorName(name?: string) {
  const trimmedName = name?.trim();

  if (trimmedName?.toLowerCase() === "danny robbins 2") {
    return "Pastor Robbins";
  }

  return trimmedName?.replace(/\s+\d+$/, "") || "GroupMe Member";
}

function formatMessageTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  }).format(date);
}

const samplePrayerMessages: PrayerBoardMessage[] = [
  samplePrayerMessage("demo-prayer-1", "Pastor Robbins", "Please remember the outreach team this weekend as they connect with new families.", -1),
  samplePrayerMessage("demo-prayer-2", "Maria Demo", "Pray for a coworker who is recovering from surgery this week.", -3),
  samplePrayerMessage("demo-prayer-3", "Caleb Martin", "Requesting prayer for safe travel for our family.", -5),
  samplePrayerMessage("demo-prayer-4", "Angela Reed", "Please pray for strength and peace for a family in our neighborhood.", -8),
  samplePrayerMessage("demo-prayer-5", "Daniel Demo", "Thankful for what God is doing in our church family. Please pray for our youth service.", -12),
  samplePrayerMessage("demo-prayer-6", "Nina Brooks", "Pray for a friend visiting church for the first time Sunday.", -18),
];

function samplePrayerMessage(
  id: string,
  author: string,
  text: string,
  hoursAgo: number,
): PrayerBoardMessage {
  const createdAt = new Date();
  createdAt.setHours(createdAt.getHours() + hoursAgo);

  return {
    id,
    author,
    avatarUrl: `https://i.pravatar.cc/120?u=${encodeURIComponent(author)}`,
    createdAt: createdAt.toISOString(),
    createdAtLabel: formatMessageTime(createdAt),
    imageUrls: [],
    text,
  };
}

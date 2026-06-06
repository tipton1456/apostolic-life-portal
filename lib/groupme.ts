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
    const url = new URL(
      `https://api.groupme.com/v3/groups/${groupId}/messages`,
    );
    url.searchParams.set("limit", String(getFetchLimit(limit)));

    const response = await fetch(url, {
      headers: {
        "X-Access-Token": accessToken,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(`GroupMe messages lookup failed: ${response.status}`);
      return {
        conversationUrl,
        isConfigured: true,
        messages: [],
      };
    }

    const result = (await response.json()) as GroupMeMessageResponse;
    const messages = (result.response?.messages ?? [])
      .filter((message) => !message.system)
      .filter((message) => !messageStartsWithPraying(message.text))
      .slice(0, limit)
      .map(mapMessage);

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

function getFetchLimit(limit: number) {
  return Math.min(Math.max(limit * 4, limit), 100);
}

function messageStartsWithPraying(text?: string) {
  return text?.trimStart().toLowerCase().startsWith("praying") ?? false;
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

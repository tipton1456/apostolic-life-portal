import { createClient } from "@/lib/supabase/server";
import { isDemoEmail } from "./demo";

type ElvantoPerson = {
  id?: string;
  email?: string;
};

type ElvantoTransaction = {
  id?: string;
  person_id?: string;
  person_email?: string;
  transaction_date?: string;
  transaction_datetime?: string;
  transaction_total?: string | number;
  amounts?: {
    amount?: ElvantoTransactionAmount | ElvantoTransactionAmount[];
  };
};

type ElvantoTransactionAmount = {
  id?: string;
  category?: {
    name?: string;
  };
  total?: string | number;
};

export type GivingRange =
  | "this-month"
  | "last-month"
  | "this-quarter"
  | "last-quarter"
  | "year-to-date"
  | "last-year";

export type GivingRecord = {
  id: string;
  date: string;
  dateLabel: string;
  fund: string;
  amount: number;
  amountLabel: string;
};

export type GivingSummary = {
  range: GivingRange;
  label: string;
  start: string;
  end: string;
  total: number;
  totalLabel: string;
  records: GivingRecord[];
};

const RANGE_LABELS: Record<GivingRange, string> = {
  "this-month": "This Month",
  "last-month": "Last Month",
  "this-quarter": "This Quarter",
  "last-quarter": "Last Quarter",
  "year-to-date": "This Year to Date",
  "last-year": "Last Year",
};

const VALID_RANGES = Object.keys(RANGE_LABELS) as GivingRange[];

export function parseGivingRange(value?: string): GivingRange {
  return VALID_RANGES.includes(value as GivingRange)
    ? (value as GivingRange)
    : "this-month";
}

export async function getGivingSummary(
  email: string | undefined,
  range: GivingRange,
): Promise<GivingSummary> {
  const dateRange = getDateRange(range);
  const emptySummary = buildSummary(range, dateRange, []);

  if (isDemoEmail(email)) {
    return buildSummary(range, dateRange, getDemoGivingRecords(dateRange));
  }

  if (!email) return emptySummary;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email || user.email.toLowerCase() !== email.toLowerCase()) {
    console.error("Giving lookup blocked because login email did not match.");
    return emptySummary;
  }

  const authorization = getElvantoAuthorization();

  if (!authorization) return emptySummary;

  const person = await getElvantoPersonByEmail(authorization, email);

  const transactions = await getTransactionsForRange(authorization, dateRange);
  const records = transactions
    .filter((transaction) => transactionBelongsToPerson(transaction, person, email))
    .flatMap(mapTransaction)
    .sort(
      (firstRecord, secondRecord) =>
        new Date(secondRecord.date).getTime() -
        new Date(firstRecord.date).getTime(),
    );

  return buildSummary(range, dateRange, records);
}

function getElvantoAuthorization() {
  const apiKey = process.env.ELVANTO_API_KEY;

  if (!apiKey) {
    console.error("ELVANTO_API_KEY is not configured.");
    return null;
  }

  return `Basic ${Buffer.from(`${apiKey}:x`).toString("base64")}`;
}

async function getElvantoPersonByEmail(authorization: string, email: string) {
  const response = await fetch(
    "https://api.elvanto.com/v1/people/search.json",
    {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        page: "1",
        page_size: "5",
        "search[email]": email,
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    console.error(`Elvanto people lookup failed: ${response.status}`);
    return null;
  }

  const result = await response.json();
  const people = normalizeArray<ElvantoPerson>(result?.people?.person);

  return (
    people.find((person) => person.email?.toLowerCase() === email.toLowerCase()) ??
    people[0] ??
    null
  );
}

async function getTransactionsForRange(
  authorization: string,
  dateRange: { start: string; end: string },
) {
  const transactions: ElvantoTransaction[] = [];
  let page = 1;
  let total = 0;

  do {
    const response = await fetch(
      "https://api.elvanto.com/v1/financial/transactions/getAll.json",
      {
        method: "POST",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          page: String(page),
          page_size: "1000",
          start: dateRange.start,
          end: dateRange.end,
        }),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      console.error(`Elvanto transactions lookup failed: ${response.status}`);
      return transactions;
    }

    const result = await response.json();
    const pageTransactions = normalizeArray<ElvantoTransaction>(
      result?.transactions?.transaction,
    );

    transactions.push(...pageTransactions);
    total = Number(result?.transactions?.total ?? transactions.length);
    page += 1;
  } while (transactions.length < total && page <= 10);

  return transactions;
}

function transactionBelongsToPerson(
  transaction: ElvantoTransaction,
  person: ElvantoPerson | null,
  email: string,
) {
  return (
    Boolean(person?.id && transaction.person_id === person.id) ||
    transaction.person_email?.toLowerCase() === email.toLowerCase()
  );
}

function mapTransaction(transaction: ElvantoTransaction): GivingRecord[] {
  const date = transaction.transaction_datetime ?? transaction.transaction_date ?? "";
  const amounts = normalizeArray<ElvantoTransactionAmount>(
    transaction.amounts?.amount,
  );

  if (amounts.length === 0) {
    const amount = Number(transaction.transaction_total ?? 0);

    return [
      {
        id: transaction.id ?? `${date}-${amount}`,
        date,
        dateLabel: formatDate(date),
        fund: "Not listed",
        amount,
        amountLabel: formatCurrency(amount),
      },
    ];
  }

  return amounts.map((transactionAmount, index) => {
    const amount = Number(transactionAmount.total ?? 0);

    return {
      id: transactionAmount.id ?? `${transaction.id}-${index}`,
      date,
      dateLabel: formatDate(date),
      fund: transactionAmount.category?.name?.trim() || "Not listed",
      amount,
      amountLabel: formatCurrency(amount),
    };
  });
}

function buildSummary(
  range: GivingRange,
  dateRange: { start: string; end: string },
  records: GivingRecord[],
): GivingSummary {
  const total = records.reduce((sum, record) => sum + record.amount, 0);

  return {
    range,
    label: RANGE_LABELS[range],
    start: dateRange.start,
    end: dateRange.end,
    total,
    totalLabel: formatCurrency(total),
    records,
  };
}

function getDemoGivingRecords(dateRange: { start: string; end: string }) {
  const records = [
    demoGivingRecord("demo-giving-1", dateRange.end, "Tithing", 245),
    demoGivingRecord("demo-giving-2", offsetDate(dateRange.end, -7), "General Offering", 50),
    demoGivingRecord("demo-giving-3", offsetDate(dateRange.end, -14), "Missions", 35),
    demoGivingRecord("demo-giving-4", offsetDate(dateRange.end, -21), "Building Fund", 75),
  ];

  return records.filter(
    (record) => record.date >= dateRange.start && record.date <= dateRange.end,
  );
}

function demoGivingRecord(
  id: string,
  date: string,
  fund: string,
  amount: number,
): GivingRecord {
  return {
    id,
    amount,
    amountLabel: formatCurrency(amount),
    date,
    dateLabel: formatDate(date),
    fund,
  };
}

function offsetDate(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);

  return formatDateForApi(date);
}

function getDateRange(range: GivingRange) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentQuarterStartMonth = Math.floor(currentMonth / 3) * 3;

  if (range === "this-month") {
    return formatRange(
      new Date(currentYear, currentMonth, 1),
      new Date(currentYear, currentMonth + 1, 0),
    );
  }

  if (range === "last-month") {
    return formatRange(
      new Date(currentYear, currentMonth - 1, 1),
      new Date(currentYear, currentMonth, 0),
    );
  }

  if (range === "this-quarter") {
    return formatRange(
      new Date(currentYear, currentQuarterStartMonth, 1),
      new Date(currentYear, currentQuarterStartMonth + 3, 0),
    );
  }

  if (range === "last-quarter") {
    return formatRange(
      new Date(currentYear, currentQuarterStartMonth - 3, 1),
      new Date(currentYear, currentQuarterStartMonth, 0),
    );
  }

  if (range === "last-year") {
    return formatRange(
      new Date(currentYear - 1, 0, 1),
      new Date(currentYear - 1, 11, 31),
    );
  }

  return formatRange(new Date(currentYear, 0, 1), now);
}

function formatRange(start: Date, end: Date) {
  return {
    start: formatDateForApi(start),
    end: formatDateForApi(end),
  };
}

function formatDateForApi(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function normalizeArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];

  return Array.isArray(value) ? value : [value];
}

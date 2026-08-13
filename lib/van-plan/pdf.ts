import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { VAN_PLAN_TITLE } from "@/lib/van-plan/constants";
import { VanPlanError } from "@/lib/van-plan/db";
import { getVanPlanImageRecord, readVanPlanImage } from "@/lib/van-plan/images";
import { getVanPlanItemBySlug, primaryItemImage } from "@/lib/van-plan/items";
import { getPortalBaseUrl } from "@/lib/portal-url";
import { toProperCase } from "@/lib/van-plan/format";
import type { VanPlanUser } from "@/lib/van-plan/types";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 48;
const INK = rgb(70 / 255, 67 / 255, 60 / 255);
const ACCENT = rgb(117 / 255, 135 / 255, 31 / 255);

function wrapText(text: string, maxWidth: number, font: { widthOfTextAtSize: (t: string, s: number) => number }, size: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;

    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
      continue;
    }

    if (current) lines.push(current);
    current = word;
  }

  if (current) lines.push(current);
  return lines;
}

export async function buildVanPlanItemPdf(
  slug: string,
  viewer: VanPlanUser | null,
) {
  const item = await getVanPlanItemBySlug(slug, viewer);

  if (!item) {
    throw new VanPlanError("Item not found.", 404);
  }

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const contentWidth = PAGE_WIDTH - MARGIN * 2;
  let cursor = PAGE_HEIGHT - MARGIN;

  page.drawText("SILENT AUCTION", {
    x: MARGIN,
    y: cursor,
    size: 11,
    font: regular,
    color: ACCENT,
  });
  cursor -= 18;

  page.drawText(VAN_PLAN_TITLE.toUpperCase(), {
    x: MARGIN,
    y: cursor,
    size: 14,
    font: bold,
    color: INK,
  });
  cursor -= 28;

  const mainImage = primaryItemImage(item);

  if (mainImage) {
    try {
      const imageRecord = await getVanPlanImageRecord(mainImage.id);
      const bytes = await readVanPlanImage(imageRecord.storagePath);
      const embedded =
        imageRecord.mimeType.includes("png")
          ? await pdf.embedPng(bytes)
          : await pdf.embedJpg(bytes);
      const maxHeight = 280;
      const scaled = embedded.scaleToFit(contentWidth, maxHeight);
      cursor -= scaled.height;
      page.drawImage(embedded, {
        x: MARGIN,
        y: cursor,
        width: scaled.width,
        height: scaled.height,
      });
      cursor -= 28;
    } catch (error) {
      console.error("Van Plan PDF image embed failed:", error);
    }
  }

  const nameLines = wrapText(item.name.toUpperCase(), contentWidth, bold, 22);

  for (const line of nameLines) {
    page.drawText(line, {
      x: MARGIN,
      y: cursor,
      size: 22,
      font: bold,
      color: INK,
    });
    cursor -= 26;
  }

  cursor -= 8;
  const description = toProperCase(item.description);
  const descriptionLines = wrapText(description, contentWidth, regular, 12);

  for (const line of descriptionLines) {
    if (cursor < 180) break;
    page.drawText(line, {
      x: MARGIN,
      y: cursor,
      size: 12,
      font: regular,
      color: INK,
    });
    cursor -= 16;
  }

  const itemUrl = `${getPortalBaseUrl()}/van-plan/items/${item.slug}`;
  const qrPng = await QRCode.toBuffer(itemUrl, {
    type: "png",
    margin: 1,
    width: 220,
    errorCorrectionLevel: "M",
    color: {
      dark: "#46433c",
      light: "#F9EDE4",
    },
  });
  const qrImage = await pdf.embedPng(qrPng);
  const qrSize = 132;

  page.drawText("scan to bid", {
    x: MARGIN,
    y: MARGIN + qrSize + 16,
    size: 12,
    font: regular,
    color: ACCENT,
  });
  page.drawImage(qrImage, {
    x: MARGIN,
    y: MARGIN,
    width: qrSize,
    height: qrSize,
  });

  const fileName = `${item.slug}.pdf`;
  const buffer = await pdf.save();

  return { buffer, fileName };
}

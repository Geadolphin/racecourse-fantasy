import { NextResponse } from "next/server";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const imageUrl = String(body?.imageUrl ?? "").trim();

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Image URL is required." },
        { status: 400 }
      );
    }

    let parsedUrl: URL;

    try {
      parsedUrl = new URL(imageUrl);
    } catch {
      return NextResponse.json(
        { error: "The dropped image URL is invalid." },
        { status: 400 }
      );
    }

    if (
      parsedUrl.protocol !== "https:" &&
      parsedUrl.protocol !== "http:"
    ) {
      return NextResponse.json(
        { error: "Only http and https image URLs are supported." },
        { status: 400 }
      );
    }

    const response = await fetch(parsedUrl.toString(), {
      redirect: "follow",
      headers: {
        Accept: "image/png,image/jpeg,image/webp,image/svg+xml,image/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 RacecourseFantasySilksImporter/1.0",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            "That website would not allow the image to be downloaded.",
        },
        { status: 400 }
      );
    }

    const contentType = (
      response.headers.get("content-type") ?? ""
    )
      .split(";")[0]
      .trim()
      .toLowerCase();

    if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
      return NextResponse.json(
        {
          error:
            "The dropped URL did not return a supported image.",
        },
        { status: 400 }
      );
    }

    const arrayBuffer = await response.arrayBuffer();

    if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "Silks image must be 5 MB or smaller." },
        { status: 400 }
      );
    }

    const base64 =
      Buffer.from(arrayBuffer).toString("base64");

    return NextResponse.json({
      contentType,
      dataUrl: `data:${contentType};base64,${base64}`,
    });
  } catch (error) {
    console.error("Silks URL proxy error:", error);

    return NextResponse.json(
      { error: "Could not download the dropped image." },
      { status: 500 }
    );
  }
}
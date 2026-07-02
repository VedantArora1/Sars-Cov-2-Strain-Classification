import { NextRequest, NextResponse } from "next/server";

const BACKEND_BASE_URL = process.env.BACKEND_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

type RouteContext = {
  params: Promise<{
    path: string[];
  }>;
};

async function proxyRequest(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  const upstreamUrl = buildUpstreamUrl(request, params.path);
  const method = request.method.toUpperCase();
  const contentType = request.headers.get("content-type") ?? "";

  let body: BodyInit | undefined;
  if (method !== "GET" && method !== "HEAD") {
    if (contentType.includes("multipart/form-data")) {
      body = await request.formData();
    } else if (contentType.includes("application/json")) {
      body = JSON.stringify(await request.json());
    } else {
      body = await request.text();
    }
  }

  const upstreamResponse = await fetch(upstreamUrl, {
    method,
    headers: buildUpstreamHeaders(request, contentType),
    body,
    cache: "no-store",
  });

  return new NextResponse(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: copyResponseHeaders(upstreamResponse.headers),
  });
}

function buildUpstreamUrl(request: NextRequest, pathSegments: string[]): string {
  const upstreamUrl = new URL(`${BACKEND_BASE_URL}/${pathSegments.join("/")}`);
  upstreamUrl.search = request.nextUrl.search;
  return upstreamUrl.toString();
}

function buildUpstreamHeaders(request: NextRequest, contentType: string): HeadersInit {
  const headers = new Headers();
  const accept = request.headers.get("accept");

  if (accept) {
    headers.set("accept", accept);
  }

  if (contentType && !contentType.includes("multipart/form-data")) {
    headers.set("content-type", contentType);
  }

  return headers;
}

function copyResponseHeaders(headers: Headers): Headers {
  const nextHeaders = new Headers();
  const contentType = headers.get("content-type");
  if (contentType) {
    nextHeaders.set("content-type", contentType);
  }

  return nextHeaders;
}

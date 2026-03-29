import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    // User denied access or error occurred
    // Redirect to callback page with error
    return NextResponse.redirect(
      new URL(`/spotify-callback?error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/spotify-callback?error=missing_parameters", request.url)
    );
  }

  // Redirect to the callback page with the code and state
  // The callback page will handle the token exchange
  return NextResponse.redirect(
    new URL(`/spotify-callback?code=${code}&state=${state}`, request.url)
  );
}

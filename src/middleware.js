import { NextResponse } from "next/server";

export function middleware(request) {
  const session = request.cookies.get("navatar_admin_session");
  const isLoginPage = request.nextUrl.pathname === "/login";

  if (!session || session.value !== "navatar_admin_authenticated") {
    if (!isLoginPage) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  if (isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

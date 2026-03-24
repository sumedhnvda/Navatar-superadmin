"use server";

import { createSession, destroySession } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function googleLoginAction(email) {
  await createSession(email);
  return { success: true };
}


import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import RequestsClient from "./requests-client";
import { cookies } from "next/headers";

export const fetchCache = 'force-no-store';

async function getRequests() {
  const reqRef = collection(db, "user requests");
  const snap = await getDocs(query(reqRef, orderBy("createdAt", "desc")));
  return snap.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
}

async function getHospitals() {
  const reqRef = collection(db, "hospitals");
  const snap = await getDocs(query(reqRef, orderBy("createdAt", "desc")));
  return snap.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
}

async function getSuperadmins() {
  const reqRef = collection(db, "superadmins");
  const snap = await getDocs(query(reqRef));
  return snap.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
}

export default async function DashboardPage() {
  const requests = await getRequests();
  const hospitals = await getHospitals();
  const superadmins = await getSuperadmins();
  const cookieStore = await cookies();
  const adminEmail = cookieStore.get("navatar_admin_email")?.value || "";

  // Safe stringify due to possible Firestore Timestamps inside un-mapped objects inside DB
  return <RequestsClient requests={JSON.parse(JSON.stringify(requests))} hospitals={JSON.parse(JSON.stringify(hospitals))} superadmins={JSON.parse(JSON.stringify(superadmins))} loggedInEmail={adminEmail} />;
}

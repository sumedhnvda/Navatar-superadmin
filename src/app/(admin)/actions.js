"use server";

import { db } from "@/lib/firebase";
import { doc, updateDoc, collection, addDoc } from "firebase/firestore";
import { revalidatePath } from "next/cache";

export async function acceptRequest(requestId) {
  try {
    await updateDoc(doc(db, "user requests", requestId), {
      status: "accepted"
    });
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Failed to accept request:", error);
    return { error: error.message };
  }
}

export async function setupHospital(requestId, data) {
  try {
    // data payload: { adminEmail, numberOfBots, botIds: ["...", "..."] }
    await addDoc(collection(db, "hospitals"), {
      sourceRequestId: requestId,
      hospitalName: data.hospitalName, // Add hospital name
      adminEmail: data.adminEmail,
      adminPassword: "admin123", // default configuration
      numberOfNavatars: data.numberOfBots,
      botIds: data.botIds,
      status: "active",
      createdAt: new Date().toISOString()
    });

    // Mark request as provisioned to hide the setup button
    await updateDoc(doc(db, "user requests", requestId), {
      status: "provisioned"
    });

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Failed to setup hospital:", error);
    return { error: error.message };
  }
}

export async function updateHospital(hospitalId, data) {
  try {
    const updateData = {};
    if (data.adminEmail) updateData.adminEmail = data.adminEmail;
    if (data.numberOfBots !== undefined) updateData.numberOfNavatars = data.numberOfBots;
    if (data.botIds) updateData.botIds = data.botIds;
    if (data.hospitalName) updateData.hospitalName = data.hospitalName;

    await updateDoc(doc(db, "hospitals", hospitalId), updateData);
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Failed to update hospital:", error);
    return { error: error.message };
  }
}

export async function rejectRequest(requestId) {
  try {
    await updateDoc(doc(db, "user requests", requestId), {
      status: "rejected"
    });
    
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Failed to reject request:", error);
    return { error: error.message };
  }
}

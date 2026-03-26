"use server";

import { db } from "@/lib/firebase";
import { doc, updateDoc, collection, addDoc, deleteDoc, getDoc, getDocs, query, where, setDoc } from "firebase/firestore";
import { revalidatePath } from "next/cache";

export async function checkAvailability(email, hospitalId) {
  try {
    // Check if hospital ID is taken
    if (hospitalId) {
      const idDoc = await getDoc(doc(db, "hospitals", hospitalId));
      if (idDoc.exists()) return { available: false, reason: "Hospital ID is already taken", field: 'hid' };
    }

    // Check if email is taken
    if (email) {
      const q = query(collection(db, "hospitals"), where("adminEmail", "==", email));
      const snap = await getDocs(q);
      if (!snap.empty) return { available: false, reason: "Admin email is already assigned to another hospital", field: 'email' };
    }

    return { available: true };
  } catch (error) {
    console.error("Availability check failed:", error);
    return { error: error.message };
  }
}

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
    // data payload: { adminEmail, numberOfBots, botIds: ["...", "..."], hospitalName, hospitalId }
    
    // Double check email uniqueness
    const emailQ = query(collection(db, "hospitals"), where("adminEmail", "==", data.adminEmail));
    const emailSnap = await getDocs(emailQ);
    if (!emailSnap.empty) {
      return { error: "Admin email is already assigned to another hospital." };
    }

    // Double check ID uniqueness
    const idDoc = await getDoc(doc(db, "hospitals", data.hospitalId));
    if (idDoc.exists()) {
      return { error: "Hospital ID is already taken. Please choose another name or ID." };
    }

    await setDoc(doc(db, "hospitals", data.hospitalId), {
      sourceRequestId: requestId,
      hospitalName: data.hospitalName,
      adminEmail: data.adminEmail,
      numberOfNavatars: data.numberOfBots,
      botIds: data.botIds,
      status: "active",
      createdAt: new Date().toISOString()
    });

    // Mark request as provisioned
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
    // If email is being updated, check for uniqueness cross-hospital
    if (data.adminEmail) {
      const emailQ = query(collection(db, "hospitals"), where("adminEmail", "==", data.adminEmail));
      const emailSnap = await getDocs(emailQ);
      const otherHospitals = emailSnap.docs.filter(d => d.id !== hospitalId);
      if (otherHospitals.length > 0) {
        return { error: "Admin email is already assigned to another hospital." };
      }
    }

    const updateData = {};
    if (data.adminEmail) updateData.adminEmail = data.adminEmail;
    if (data.numberOfBots !== undefined) updateData.numberOfNavatars = data.numberOfBots;
    if (data.botIds) updateData.botIds = data.botIds;
    if (data.hospitalName) updateData.hospitalName = data.hospitalName;

    await updateDoc(doc(db, "hospitals", hospitalId), updateData);

    // Also update the linked user request email if it exists
    const hSnap = await getDoc(doc(db, "hospitals", hospitalId));
    if (hSnap.exists()) {
      const requestId = hSnap.data().sourceRequestId;
      if (requestId && data.adminEmail) {
        await updateDoc(doc(db, "user requests", requestId), {
          email: data.adminEmail
        });
      }
    }

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Failed to update hospital:", error);
    return { error: error.message };
  }
}

export async function createDirectHospital(data) {
  try {
    // 1. Create a "provisioned" request first
    const requestRef = await addDoc(collection(db, "user requests"), {
      hospitalName: data.hospitalName,
      contactName: "Direct Entry",
      email: data.adminEmail,
      phone: "N/A",
      notes: "Directly added by superadmin",
      status: "provisioned",
      date: new Date().toISOString(),
      createdAt: new Date().toISOString()
    });

    // 2. Setup the hospital using the new request ID
    const res = await setupHospital(requestRef.id, {
      ...data,
      hospitalId: data.hospitalId
    });

    if (res.error) {
      // Cleanup the request if hospital creation fails
      await deleteDoc(doc(db, "user requests", requestRef.id));
      return { error: res.error };
    }

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Failed to create direct hospital:", error);
    return { error: error.message };
  }
}

export async function reviveRequest(requestId) {
  try {
    await updateDoc(doc(db, "user requests", requestId), {
      status: "accepted"
    });
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Failed to revive request:", error);
    return { error: error.message };
  }
}

export async function deleteRequestAndHospital(requestId) {
  try {
    // 1. Find and delete the hospital allocation if it exists
    const q = query(collection(db, "hospitals"), where("sourceRequestId", "==", requestId));
    const snap = await getDocs(q);
    
    const deletePromises = snap.docs.map(hDoc => deleteDoc(doc(db, "hospitals", hDoc.id)));
    await Promise.all(deletePromises);

    // 2. Delete the original user request
    await deleteDoc(doc(db, "user requests", requestId));

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete request and hospital:", error);
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

export async function addSuperadmin(email, addedBy) {
  try {
    const emailTrimmed = email.trim();
    if (!emailTrimmed) return { error: "Email is required" };

    await addDoc(collection(db, "superadmins"), {
      email: emailTrimmed,
      addedBy: addedBy || "Unknown",
      createdAt: new Date().toISOString()
    });

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Failed to add superadmin:", error);
    return { error: error.message };
  }
}

export async function deleteSuperadmin(adminId) {
  try {
    await deleteDoc(doc(db, "superadmins", adminId));
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete superadmin:", error);
    return { error: error.message };
  }
}

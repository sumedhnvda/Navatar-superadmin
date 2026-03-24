"use client";

import { useState } from "react";
import { googleLoginAction } from "./actions";
import { auth, googleProvider, db } from "@/lib/firebase";
import { signInWithPopup } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { LogIn } from "lucide-react";

export default function LoginPage() {
  const [error, setError] = useState(null);
  const [isPending, setIsPending] = useState(false);

  const handleGoogleLogin = async () => {
    setIsPending(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      // Check if user is the primary superadmin
      if (user.email === process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL) {
        const res = await googleLoginAction(user.email);
        if (res?.success) {
          window.location.href = "/";
        }
        return;
      }

      // Check if user exists in superadmins collection
      const q = query(collection(db, "superadmins"), where("email", "==", user.email));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const res = await googleLoginAction(user.email);
        if (res?.success) {
          window.location.href = "/";
        }
        return;
      }

      // Not authorized
      setError("Unauthorized account. You are not a superadmin.");
      await auth.signOut();
    } catch (err) {
      console.error(err);
      setError("Failed to sign in with Google.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
        padding: "20px",
      }}
    >
      {/* Background decoration */}
      <div
        style={{
          position: "absolute",
          top: "10%",
          left: "10%",
          width: "300px",
          height: "300px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "10%",
          right: "10%",
          width: "400px",
          height: "400px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div
        className="animate-fade-in"
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "rgba(255, 255, 255, 0.03)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "20px",
          padding: "48px 40px",
          position: "relative",
          textAlign: "center"
        }}
      >
        {/* Logo / Brand */}
        <div style={{ marginBottom: "36px" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "14px",
              background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              fontSize: "24px",
              fontWeight: "800",
              color: "white",
              boxShadow: "0 8px 32px rgba(59, 130, 246, 0.3)",
            }}
          >
            N
          </div>
          <h1
            style={{
              fontSize: "24px",
              fontWeight: "700",
              color: "white",
              marginBottom: "6px",
              letterSpacing: "-0.02em",
            }}
          >
            Navatar Super Admin
          </h1>
          <p style={{ color: "#94a3b8", fontSize: "14px" }}>
            Sign in to your dashboard securely
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div
            style={{
              padding: "12px 16px",
              marginBottom: "20px",
              borderRadius: "10px",
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              color: "#fca5a5",
              fontSize: "13px",
              textAlign: "left"
            }}
          >
            {error}
          </div>
        )}

        <button
          onClick={handleGoogleLogin}
          disabled={isPending}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            padding: "14px",
            borderRadius: "10px",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            background: isPending
              ? "rgba(255, 255, 255, 0.05)"
              : "rgba(255, 255, 255, 0.1)",
            color: "white",
            fontSize: "15px",
            fontWeight: "600",
            cursor: isPending ? "not-allowed" : "pointer",
            transition: "all 0.2s ease",
          }}
          onMouseOver={(e) => {
            if (!isPending) e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
          }}
          onMouseOut={(e) => {
            if (!isPending) e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
          }}
        >
          {isPending ? (
            "Signing in..."
          ) : (
            <>
              <LogIn size={20} />
              Sign in with Google
            </>
          )}
        </button>
      </div>
    </div>
  );
}

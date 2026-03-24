"use client";

import { useState } from "react";
import { Building2, Mail, Phone, Calendar, Search, Filter, Check, X, ShieldAlert, Cpu, LogOut, Trash2 } from "lucide-react";
import { acceptRequest, rejectRequest, setupHospital, updateHospital } from "./actions";
import { formatDate, getRelativeTime, parseDate } from "@/lib/utils";
import { logoutAction } from "@/app/login/actions";
import { useRouter } from "next/navigation";

export default function RequestsClient({ requests, hospitals, superadmins, loggedInEmail }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("pending"); // pending, accepted, rejected

  // Setup Modal State
  const [setupId, setSetupId] = useState(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [numBots, setNumBots] = useState(1);
  const [botIds, setBotIds] = useState([""]);
  const [submittingId, setSubmittingId] = useState(null);

  // Edit Modal State
  const [editSetupId, setEditSetupId] = useState(null);
  const [editHospitalId, setEditHospitalId] = useState(null);
  const [editAdminEmail, setEditAdminEmail] = useState("");
  const [editNumBots, setEditNumBots] = useState(1);
  const [editBotIds, setEditBotIds] = useState([""]);

  // Manage Admins Modal State
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);

  const handleAddAdmin = async (e) => {
    e.preventDefault();
    if (!newAdminEmail.trim()) return;
    setIsAddingAdmin(true);
    try {
      const { collection, addDoc, serverTimestamp } = require("firebase/firestore");
      const { db } = require("@/lib/firebase");
      await addDoc(collection(db, "superadmins"), {
        email: newAdminEmail.trim(),
        addedBy: loggedInEmail || "Unknown",
        createdAt: serverTimestamp()
      });
      alert("Superadmin added successfully!");
      setNewAdminEmail("");
      router.refresh(); // Refresh static props
    } catch (err) {
      console.error(err);
      alert("Failed to add superadmin.");
    } finally {
      setIsAddingAdmin(false);
    }
  };

  const handleDeleteAdmin = async (adminId) => {
    if (!confirm("Are you sure you want to remove this superadmin?")) return;
    try {
      const { doc, deleteDoc } = require("firebase/firestore");
      const { db } = require("@/lib/firebase");
      await deleteDoc(doc(db, "superadmins", adminId));
      alert("Superadmin removed successfully!");
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Failed to remove superadmin.");
    }
  };

  const filtered = requests.filter((r) => {
    const matchesSearch =
      !searchQuery ||
      (r.hospitalName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.contactName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.email || "").toLowerCase().includes(searchQuery.toLowerCase());
    
    const rStatus = r.status || "new";
    let matchesTab = false;
    
    if (activeTab === "pending") {
      matchesTab = !["accepted", "provisioned", "rejected"].includes(rStatus);
    } else if (activeTab === "accepted") {
      matchesTab = rStatus === "accepted" || rStatus === "provisioned";
    } else if (activeTab === "rejected") {
      matchesTab = rStatus === "rejected";
    }
      
    return matchesSearch && matchesTab;
  });

  const handleAccept = async (id) => {
    if (!confirm("Approve this hospital request?")) return;
    setSubmittingId(id);
    const res = await acceptRequest(id);
    if (!res.success) {
      alert("Failed to accept: " + res.error);
    }
    setSubmittingId(null);
  };

  const handleReject = async (id) => {
    if (!confirm("Are you sure you want to reject this request?")) return;
    setSubmittingId(id);
    const res = await rejectRequest(id);
    if (!res.success) {
      alert("Failed to reject: " + res.error);
    }
    setSubmittingId(null);
  };

  const [hospitalPrefix, setHospitalPrefix] = useState("HOSP");

  const generateBotId = (hospName, index) => {
    // Take first word or acronym of hospital name
    const prefix = hospName ? hospName.split(' ')[0].toUpperCase().replace(/[^A-Z0-9]/g, '') : "HOSP";
    return `${prefix}-NAV-${index}`;
  };

  const openSetup = (id, email, hospitalName) => {
    setSetupId(id);
    setAdminEmail(email || "");
    setHospitalPrefix(hospitalName || "HOSP");
    setNumBots(1);
    setBotIds([generateBotId(hospitalName, 1)]);
  };

  const handleNumBotsChange = (e) => {
    const val = parseInt(e.target.value) || 1;
    if (val > 20) return; // Prevent creating too many
    setNumBots(val);
    
    // adjust botIds array size
    setBotIds((prev) => {
      if (val > prev.length) {
        const newIds = Array(val - prev.length).fill("").map((_, i) => generateBotId(hospitalPrefix, prev.length + i + 1));
        return [...prev, ...newIds];
      } else {
        return prev.slice(0, val);
      }
    });
  };

  const updateBotId = (index, val) => {
    setBotIds((prev) => {
      const copy = [...prev];
      copy[index] = val;
      return copy;
    });
  };

  const handleEditNumBotsChange = (e) => {
    const val = parseInt(e.target.value) || 1;
    if (val > 20) return;
    setEditNumBots(val);
    
    setEditBotIds((prev) => {
      if (val > prev.length) {
        const newIds = Array(val - prev.length).fill("").map((_, i) => generateBotId(hospitalPrefix, prev.length + i + 1));
        return [...prev, ...newIds];
      } else {
        return prev.slice(0, val);
      }
    });
  };

  const updateEditBotId = (index, val) => {
    setEditBotIds((prev) => {
      const copy = [...prev];
      copy[index] = val;
      return copy;
    });
  };

  const openEditSetup = (requestId) => {
    const hospital = hospitals?.find(h => h.sourceRequestId === requestId);
    if (!hospital) {
      alert("Hospital data not found.");
      return;
    }
    setEditSetupId(requestId);
    setEditHospitalId(hospital._id);
    setEditAdminEmail(hospital.adminEmail || "");
    setHospitalPrefix(hospital.hospitalName || "HOSP");
    setEditNumBots(hospital.numberOfNavatars || 1);
    setEditBotIds(hospital.botIds || [generateBotId(hospital.hospitalName, 1)]);
  };

  const submitEditSetup = async (e) => {
    e.preventDefault();
    if (!editAdminEmail || editBotIds.some(bid => !bid.trim())) {
      alert("Please fill all fields.");
      return;
    }

    setSubmittingId(editSetupId);
    const res = await updateHospital(editHospitalId, {
      adminEmail: editAdminEmail,
      numberOfBots: editNumBots,
      botIds: editBotIds.map(b => b.trim()),
      hospitalName: hospitalPrefix
    });

    if (res.success) {
      setEditSetupId(null);
    } else {
      alert("Failed to update: " + res.error);
    }
    setSubmittingId(null);
  };

  const submitSetup = async (e) => {
    e.preventDefault();
    if (!adminEmail || botIds.some(bid => !bid.trim())) {
      alert("Please fill all fields.");
      return;
    }

    setSubmittingId(setupId);
    const res = await setupHospital(setupId, {
      adminEmail,
      numberOfBots: numBots,
      botIds: botIds.map(b => b.trim()),
      hospitalName: hospitalPrefix // Pass the hospital name from state
    });

    if (res.success) {
      setSetupId(null);
    } else {
      alert("Failed to setup: " + res.error);
    }
    setSubmittingId(null);
  };

  const getTabStyle = (tabName) => ({
    padding: "10px 20px",
    fontSize: "14px",
    fontWeight: "600",
    color: activeTab === tabName ? "#3b82f6" : "#64748b",
    borderBottom: activeTab === tabName ? "2px solid #3b82f6" : "2px solid transparent",
    cursor: "pointer",
    background: "none",
    borderLeft: "none", borderRight: "none", borderTop: "none",
    outline: "none"
  });

  return (
    <>
      <div className="animate-fade-in">
        {/* Header */}
        <div style={{ marginBottom: "28px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ fontSize: "26px", fontWeight: "700", color: "#0f172a", letterSpacing: "-0.02em" }}>
              Hospital Requests
            </h1>
            <p style={{ color: "#64748b", fontSize: "14px", marginTop: "4px" }}>
              Manage incoming requests and configure approved Navatars
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button
              onClick={() => setShowAdminModal(true)}
              className="card-hover"
              style={{
                display: "flex", alignItems: "center", gap: "8px", padding: "10px 16px", borderRadius: "10px",
                border: "1px solid #e2e8f0", background: "white", color: "#475569", fontSize: "14px",
                fontWeight: "600", cursor: "pointer", transition: "all 0.2s"
              }}
            >
               <ShieldAlert size={16} /> Manage Super Admins
            </button>
            <form action={logoutAction}>
              <button
                type="submit"
                className="card-hover"
                style={{
                  display: "flex", alignItems: "center", gap: "8px", padding: "10px 16px", borderRadius: "10px",
                  border: "1px solid #e2e8f0", background: "white", color: "#475569", fontSize: "14px",
                  fontWeight: "600", cursor: "pointer", transition: "all 0.2s"
                }}
              >
                <LogOut size={16} /> Sign Out
              </button>
            </form>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0", marginBottom: "20px" }}>
          <button style={getTabStyle("pending")} onClick={() => setActiveTab("pending")}>
            Pending
          </button>
          <button style={getTabStyle("accepted")} onClick={() => setActiveTab("accepted")}>
            Accepted
          </button>
          <button style={getTabStyle("rejected")} onClick={() => setActiveTab("rejected")}>
            Rejected
          </button>
        </div>

        {/* Filters (Search) */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
          <div style={{ flex: 1, minWidth: "260px", position: "relative" }}>
            <Search size={16} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
            <input
              type="text"
              placeholder="Search by hospital, contact, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%", padding: "10px 14px 10px 40px", borderRadius: "10px",
                border: "1px solid #e2e8f0", background: "white", fontSize: "14px", color: "#0f172a", outline: "none"
              }}
            />
          </div>
        </div>

        {/* List */}
        <div style={{ background: "white", borderRadius: "14px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Hospital / Org</th>
                  <th>Contact Name</th>
                  <th>Contact Details</th>
                  {activeTab === "pending" && <th>Notes</th>}
                  <th>Requested Date</th>
                  {activeTab === "accepted" && <th>Status</th>}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "48px", color: "#94a3b8" }}>
                      No {activeTab} requests found
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => {
                    return (
                      <tr key={r._id}>
                        <td>
                          <div style={{ fontWeight: "600", color: "#0f172a", fontSize: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                            <Building2 size={16} color="#64748b" />
                            {r.hospitalName || "N/A"}
                          </div>
                        </td>
                        <td style={{ fontSize: "14px", color: "#475569" }}>
                          {r.contactName || "N/A"}
                        </td>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            <a href={`mailto:${r.email}`} style={{ fontSize: "13px", color: "#3b82f6", display: "flex", alignItems: "center", gap: "6px", textDecoration: "none" }}>
                              <Mail size={12} /> {r.email}
                            </a>
                            <div style={{ fontSize: "13px", color: "#64748b", display: "flex", alignItems: "center", gap: "6px" }}>
                               <Phone size={12} /> {r.phone}
                            </div>
                          </div>
                        </td>
                        {activeTab === "pending" && (
                          <td style={{ maxWidth: "200px" }}>
                            <div style={{ fontSize: "13px", color: "#475569", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {r.notes || r.note || <span style={{ color: "#94a3b8", fontStyle: "italic" }}>No notes</span>}
                            </div>
                          </td>
                        )}
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <span style={{ fontSize: "13px", color: "#475569", display: "flex", alignItems: "center", gap: "6px" }}>
                               <Calendar size={12} /> {formatDate(r.date)}
                            </span>
                            <span style={{ fontSize: "11px", color: "#94a3b8", marginLeft: "18px" }}>
                              Sent: {getRelativeTime(r.createdAt)}
                            </span>
                          </div>
                        </td>
                        {activeTab === "accepted" && (
                          <td>
                            {r.status === "provisioned" ? (
                               <span className="status-badge bg-green-100 text-green-700 border-green-200">Provisioned</span>
                            ) : (
                               <span className="status-badge bg-blue-100 text-blue-700 border-blue-200">Awaiting Setup</span>
                            )}
                          </td>
                        )}
                        <td>
                          {activeTab === "pending" && (
                            <div style={{ display: "flex", gap: "8px" }}>
                              <button
                                onClick={() => handleAccept(r._id)}
                                disabled={submittingId === r._id}
                                style={{
                                  display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "8px", 
                                  border: "1px solid #86efac", background: "#f0fdf4", color: "#166534", fontSize: "13px", 
                                  fontWeight: "600", cursor: "pointer", opacity: submittingId === r._id ? 0.6 : 1
                                }}
                              >
                                <Check size={14} strokeWidth={2.5} /> Accept
                              </button>
                              <button
                                onClick={() => handleReject(r._id)}
                                disabled={submittingId === r._id}
                                style={{
                                  display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "8px", 
                                  border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", fontSize: "13px", 
                                  fontWeight: "600", cursor: "pointer", opacity: submittingId === r._id ? 0.6 : 1
                                }}
                              >
                                <X size={14} strokeWidth={2.5} /> Reject
                              </button>
                            </div>
                          )}
                          {activeTab === "accepted" && (
                            r.status === "provisioned" ? (
                              <button
                                onClick={() => openEditSetup(r._id)}
                                style={{
                                  display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "8px", 
                                  border: "1px solid #cbd5e1", background: "#f8fafc", color: "#334155", fontSize: "13px", 
                                  fontWeight: "600", cursor: "pointer"
                                }}
                              >
                                <ShieldAlert size={14} /> View/Edit Allocation
                              </button>
                            ) : (
                              <button
                                onClick={() => openSetup(r._id, r.email, r.hospitalName)}
                                style={{
                                  display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "8px", 
                                  border: "1px solid #93c5fd", background: "#eff6ff", color: "#1d4ed8", fontSize: "13px", 
                                  fontWeight: "600", cursor: "pointer"
                                }}
                              >
                                <ShieldAlert size={14} /> Setup Hospital
                              </button>
                            )
                          )}
                          {activeTab === "rejected" && (
                            <span style={{ fontSize: "13px", color: "#ef4444", fontWeight: "500" }}>
                              Rejected
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Setup Hospital Modal */}
      {setupId && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 999999,
          display: "flex", justifyContent: "center", padding: "40px 20px", overflowY: "auto"
        }}>
          <div className="animate-fade-in" style={{
            background: "white", borderRadius: "16px", width: "100%", maxWidth: "700px",
            boxShadow: "0 24px 48px rgba(0,0,0,0.15)", overflow: "hidden", display: "flex", flexDirection: "column",
            margin: "0 auto", marginTop: "40px", marginBottom: "auto", minHeight: "fit-content"
          }}>
            <form onSubmit={submitSetup} style={{ display: "flex", flexDirection: "column", height: "100%" }}>
              <div style={{ padding: "24px", borderBottom: "1px solid #f1f5f9", flexShrink: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                  <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", color: "#3b82f6" }}>
                    <ShieldAlert size={24} />
                  </div>
                  <button type="button" onClick={() => setSetupId(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}>
                     <X size={20} />
                  </button>
                </div>
                <h2 style={{ fontSize: "20px", fontWeight: "700", color: "#0f172a", marginBottom: "8px" }}>
                  Setup Hospital Account
                </h2>
                <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.5 }}>
                  Assign an admin and construct their fleet of Navatars. They will use Google Authentication to log in.
                </p>
              </div>
              
              <div style={{ padding: "24px", overflowY: "auto", flex: 1 }}>
                
                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#475569", marginBottom: "8px" }}>
                    Admin Email Address <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="email"
                    required
                    autoFocus
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="admin@hospital.com"
                    style={{
                      width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1px solid #e2e8f0",
                      fontSize: "14px", color: "#0f172a", outline: "none"
                    }}
                  />
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#475569", marginBottom: "8px" }}>
                    Number of Navatars Booked <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={20}
                    value={numBots}
                    onChange={handleNumBotsChange}
                    style={{
                      width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1px solid #e2e8f0",
                      fontSize: "14px", color: "#0f172a", outline: "none"
                    }}
                  />
                </div>

                <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#475569", marginBottom: "12px" }}>
                    Assign unique Bot IDs <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {botIds.map((botId, index) => (
                      <div key={index} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ color: "#94a3b8", display: "flex", alignItems: "center", gap: "4px", fontSize: "13px" }}>
                          <Cpu size={14} /> #{index + 1}
                        </div>
                        <input
                          type="text"
                          required
                          placeholder="e.g. NAV-1011"
                          value={botId}
                          onChange={(e) => updateBotId(index, e.target.value)}
                          style={{
                            flex: 1, padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1",
                            fontSize: "14px", color: "#0f172a", outline: "none"
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              <div style={{ padding: "16px 24px", background: "#f8fafc", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "flex-end", gap: "12px", flexShrink: 0 }}>
                <button
                  type="button"
                  disabled={submittingId === setupId}
                  onClick={() => setSetupId(null)}
                  style={{ padding: "10px 16px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "white", color: "#475569", fontSize: "14px", fontWeight: "500", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingId === setupId}
                  style={{
                    padding: "10px 18px", borderRadius: "8px", border: "none", background: "#3b82f6", color: "white", fontSize: "14px", fontWeight: "600", cursor: submittingId === setupId ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 12px rgba(59,130,246,0.3)", opacity: submittingId === setupId ? 0.7 : 1
                  }}
                >
                  {submittingId === setupId ? "Saving..." : "Setup & Save Configurations"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Edit Hospital Setup Modal */}
      {editSetupId && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 999999,
          display: "flex", justifyContent: "center", padding: "40px 20px", overflowY: "auto"
        }}>
          <div className="animate-fade-in" style={{
            background: "white", borderRadius: "16px", width: "100%", maxWidth: "700px",
            boxShadow: "0 24px 48px rgba(0,0,0,0.15)", overflow: "hidden", display: "flex", flexDirection: "column",
            margin: "0 auto", marginTop: "40px", marginBottom: "auto", minHeight: "fit-content"
          }}>
            <form onSubmit={submitEditSetup} style={{ display: "flex", flexDirection: "column", height: "100%" }}>
              <div style={{ padding: "24px", borderBottom: "1px solid #f1f5f9", flexShrink: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                  <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", color: "#334155" }}>
                    <ShieldAlert size={24} />
                  </div>
                  <button type="button" onClick={() => setEditSetupId(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}>
                     <X size={20} />
                  </button>
                </div>
                <h2 style={{ fontSize: "20px", fontWeight: "700", color: "#0f172a", marginBottom: "8px" }}>
                  View/Edit Hospital Allocation
                </h2>
                <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.5 }}>
                  Update the hospital admin email and Navatar fleet details.
                </p>
              </div>
              
              <div style={{ padding: "24px", overflowY: "auto", flex: 1 }}>
                
                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#475569", marginBottom: "8px" }}>
                    Admin Email Address <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="email"
                    required
                    autoFocus
                    value={editAdminEmail}
                    onChange={(e) => setEditAdminEmail(e.target.value)}
                    placeholder="admin@hospital.com"
                    style={{
                      width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1px solid #e2e8f0",
                      fontSize: "14px", color: "#0f172a", outline: "none"
                    }}
                  />
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#475569", marginBottom: "8px" }}>
                    Number of Navatars Booked <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={20}
                    value={editNumBots}
                    onChange={handleEditNumBotsChange}
                    style={{
                      width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1px solid #e2e8f0",
                      fontSize: "14px", color: "#0f172a", outline: "none"
                    }}
                  />
                </div>

                <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#475569", marginBottom: "12px" }}>
                    Assign unique Bot IDs <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {editBotIds.map((botId, index) => (
                      <div key={index} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ color: "#94a3b8", display: "flex", alignItems: "center", gap: "4px", fontSize: "13px" }}>
                          <Cpu size={14} /> #{index + 1}
                        </div>
                        <input
                          type="text"
                          required
                          placeholder="e.g. NAV-1011"
                          value={botId}
                          onChange={(e) => updateEditBotId(index, e.target.value)}
                          style={{
                            flex: 1, padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1",
                            fontSize: "14px", color: "#0f172a", outline: "none"
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              <div style={{ padding: "16px 24px", background: "#f8fafc", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "flex-end", gap: "12px", flexShrink: 0 }}>
                <button
                  type="button"
                  disabled={submittingId === editSetupId}
                  onClick={() => setEditSetupId(null)}
                  style={{ padding: "10px 16px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "white", color: "#475569", fontSize: "14px", fontWeight: "500", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingId === editSetupId}
                  style={{
                    padding: "10px 18px", borderRadius: "8px", border: "none", background: "#3b82f6", color: "white", fontSize: "14px", fontWeight: "600", cursor: submittingId === editSetupId ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 12px rgba(59,130,246,0.3)", opacity: submittingId === editSetupId ? 0.7 : 1
                  }}
                >
                  {submittingId === editSetupId ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Manage Admins Modal */}
      {showAdminModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 999999,
          display: "flex", alignItems: "center", justifyContent: "center", padding: "20px"
        }}>
          <div className="animate-fade-in" style={{
            background: "white", borderRadius: "16px", width: "100%", maxWidth: "450px",
            boxShadow: "0 24px 48px rgba(0,0,0,0.15)", overflow: "hidden"
          }}>
            <form onSubmit={handleAddAdmin}>
              <div style={{ padding: "24px", borderBottom: "1px solid #f1f5f9" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                  <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", color: "#16a34a" }}>
                    <ShieldAlert size={24} />
                  </div>
                  <button type="button" onClick={() => setShowAdminModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}>
                     <X size={20} />
                  </button>
                </div>
                <h2 style={{ fontSize: "20px", fontWeight: "700", color: "#0f172a", marginBottom: "8px" }}>
                  Add Superadmin
                </h2>
                <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.5 }}>
                  Enter a Google email address to grant superadmin access to the dashboard.
                </p>
              </div>
              
              <div style={{ padding: "24px", overflowY: "auto", maxHeight: "400px" }}>
                {/* List of Admins */}
                <div style={{ marginBottom: "24px", borderBottom: "1px solid #f1f5f9", paddingBottom: "16px" }}>
                  <h3 style={{ fontSize: "14px", fontWeight: "600", color: "#0f172a", marginBottom: "12px" }}>
                    Current Superadmins
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#f0fdf4", borderRadius: "8px", border: "1px solid #dcfce7" }}>
                      <span style={{ fontSize: "13px", color: "#166534", fontWeight: "500" }}>{process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL || "Primary Admin"}</span>
                      <span style={{ fontSize: "11px", color: "#15803d", fontStyle: "italic" }}>System Root</span>
                    </div>
                    {superadmins?.map((admin) => (
                      <div key={admin._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                        <span style={{ fontSize: "13px", color: "#334155" }}>{admin.email}</span>
                        <button 
                          type="button" 
                          onClick={() => handleDeleteAdmin(admin._id)} 
                          style={{ padding: "4px", color: "#ef4444", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center" }}
                          title="Remove Superadmin"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    {(!superadmins || superadmins.length === 0) && (
                      <p style={{ fontSize: "12px", color: "#94a3b8", fontStyle: "italic", textAlign: "center", marginTop: "8px" }}>
                        No secondary superadmins added yet.
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#475569", marginBottom: "8px" }}>
                    Add New Google Email <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="email"
                    required
                    autoFocus
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    placeholder="admin@gmail.com"
                    style={{
                      width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1px solid #e2e8f0",
                      fontSize: "14px", color: "#0f172a", outline: "none"
                    }}
                  />
                </div>
              </div>

              <div style={{ padding: "16px 24px", background: "#f8fafc", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                <button
                  type="button"
                  disabled={isAddingAdmin}
                  onClick={() => setShowAdminModal(false)}
                  style={{ padding: "10px 16px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "white", color: "#475569", fontSize: "14px", fontWeight: "500", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingAdmin}
                  style={{
                    padding: "10px 18px", borderRadius: "8px", border: "none", background: "#16a34a", color: "white", fontSize: "14px", fontWeight: "600", cursor: isAddingAdmin ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 12px rgba(22,163,74,0.3)", opacity: isAddingAdmin ? 0.7 : 1
                  }}
                >
                  {isAddingAdmin ? "Adding..." : "Add Superadmin"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

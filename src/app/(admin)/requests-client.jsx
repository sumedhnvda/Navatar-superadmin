"use client";

import { useState, useEffect } from "react";
import { Building2, Mail, Phone, Calendar, Search, Filter, Check, X, ShieldAlert, Cpu, LogOut, Trash2, Plus, RotateCcw, CheckCircle2, AlertCircle } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { 
  acceptRequest, 
  rejectRequest, 
  setupHospital, 
  updateHospital, 
  addSuperadmin, 
  deleteSuperadmin,
  deleteRequestAndHospital,
  checkAvailability,
  reviveRequest,
  createDirectHospital
} from "./actions";
import { formatDate, getRelativeTime, parseDate } from "@/lib/utils";
import { logoutAction } from "@/app/login/actions";
import { useRouter } from "next/navigation";

export default function RequestsClient({ requests, hospitals, superadmins, loggedInEmail }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("pending"); // pending, accepted, rejected
  
  // Real-time Data State (initialized with props for SSR fast-paint)
  const [liveRequests, setLiveRequests] = useState(requests || []);
  const [liveHospitals, setLiveHospitals] = useState(hospitals || []);
  const [liveSuperadmins, setLiveSuperadmins] = useState(superadmins || []);

  const [notification, setNotification] = useState(null);
  const [confirmConfig, setConfirmConfig] = useState(null); // { title: '', message: '', onConfirm: () => {} }
  const [setupRequest, setSetupRequest] = useState(null); // The request being setup or {} for direct entry
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [submittingId, setSubmittingId] = useState(null);

  // Real-time Sync Effect
  useEffect(() => {
    // 1. Listen for requests
    const reqQuery = query(collection(db, "user requests"), orderBy("createdAt", "desc"));
    const unsubReq = onSnapshot(reqQuery, (snap) => {
      const data = snap.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
      setLiveRequests(JSON.parse(JSON.stringify(data)));
    });

    // 2. Listen for hospitals
    const hospQuery = query(collection(db, "hospitals"), orderBy("createdAt", "desc"));
    const unsubHosp = onSnapshot(hospQuery, (snap) => {
      const data = snap.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
      setLiveHospitals(JSON.parse(JSON.stringify(data)));
    });

    // 3. Listen for superadmins
    const adminQuery = collection(db, "superadmins");
    const unsubAdmin = onSnapshot(adminQuery, (snap) => {
      const data = snap.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
      setLiveSuperadmins(JSON.parse(JSON.stringify(data)));
    });

    // Cleanup listeners on unmount
    return () => {
      unsubReq();
      unsubHosp();
      unsubAdmin();
    };
  }, []);

  async function handleHospitalSubmit(data, isDirect = false) {
    setSubmittingId(data.hospitalId || "direct"); // Use a temporary ID for direct entry
    const res = isDirect ? await createDirectHospital(data) : await setupHospital(setupRequest._id, data);
    if (res.success) {
      setIsSetupOpen(false);
      setSetupRequest(null);
      const action = isDirect ? "Onboarded" : "Provisioned";
      const msg = isDirect ? `${data.hospitalName} has been directly added.` : "Hospital account and Navatars are ready.";
      appAlert("success", `Hospital ${action}`, msg);
    } else {
      appAlert("error", "Failed", res.error);
    }
    setSubmittingId(null);
  }

  // Edit Modal State
  const [editSetupId, setEditSetupId] = useState(null);
  const [editHospitalId, setEditHospitalId] = useState(null);
  const [editAdminEmail, setEditAdminEmail] = useState("");
  const [editNumBots, setEditNumBots] = useState(1);
  const [editBotIds, setEditBotIds] = useState([""]);
  const [editHospitalName, setEditHospitalName] = useState(""); // For edit modal name display
  const [editAvailabilityHint, setEditAvailabilityHint] = useState(null);
  const [isCheckingEdit, setIsCheckingEdit] = useState(false);


  // Manage Admins Modal State
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);

  const appAlert = (type, title, msg) => {
    setNotification({ type, title, message: msg });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleAddAdmin = async (e) => {
    e.preventDefault();
    if (!newAdminEmail.trim()) return;
    setIsAddingAdmin(true);
    try {
      const res = await addSuperadmin(newAdminEmail, loggedInEmail);
      if (res.success) {
        appAlert("success", "Superadmin Added", "Successfully granted dashboard access.");
        setNewAdminEmail("");
        router.refresh(); 
      } else {
        appAlert("error", "Failed to Add Superadmin", res.error);
      }
    } catch (err) {
      console.error(err);
      appAlert("error", "Error", "Failed to add superadmin.");
    } finally {
      setIsAddingAdmin(false);
    }
  };

  const handleDeleteAdmin = async (adminId) => {
    setConfirmConfig({
      title: "Remove Superadmin",
      message: "Are you sure you want to remove this superadmin? Access has been revoked immediately.",
      onConfirm: async () => {
        try {
          const res = await deleteSuperadmin(adminId);
          if (res.success) {
            appAlert("success", "Superadmin Removed", "Access has been revoked.");
            router.refresh();
          } else {
            appAlert("error", "Failed to Remove", res.error);
          }
        } catch (err) {
          console.error(err);
          appAlert("error", "Error", "Failed to remove superadmin.");
        }
      }
    });
  };

  const filtered = liveRequests.filter((r) => {
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
    setConfirmConfig({
      title: "Approve Request",
      message: "Are you sure you want to approve this hospital request? This will move it to the system queue for fleet allocation.",
      onConfirm: async () => {
        setSubmittingId(id);
        const res = await acceptRequest(id);
        if (res.success) {
          appAlert("success", "Request Accepted", "Hospital request has moved to the Accepted tab.");
        } else {
          appAlert("error", "Failed to Accept", res.error);
        }
        setSubmittingId(null);
      }
    });
  };

  const handleReject = async (id) => {
    setConfirmConfig({
      title: "Reject Request",
      message: "Are you sure you want to reject this request? It will be moved to the Rejected tab and remain inactive.",
      onConfirm: async () => {
        setSubmittingId(id);
        const res = await rejectRequest(id);
        if (res.success) {
          appAlert("success", "Request Rejected", "The request has been moved to the Rejected tab.");
        } else {
          appAlert("error", "Failed to Reject", res.error);
        }
        setSubmittingId(null);
      }
    });
  };

  const handleRevive = async (id) => {
    setSubmittingId(id);
    const res = await reviveRequest(id);
    if (res.success) {
      appAlert("success", "Request Restored", "The request is now back in Awaiting Setup.");
    } else {
      appAlert("error", "Failed to Restore", res.error);
    }
    setSubmittingId(null);
  };

  const generateBotId = (hospName, index) => {
    // Take first word or acronym of hospital name
    const prefix = hospName ? hospName.split(' ')[0].toUpperCase().replace(/[^A-Z0-9]/g, '') : "HOSP";
    return `${prefix}-NAV-${index}`;
  };

  const openSetup = (r) => {
    setSetupRequest(r);
    setIsSetupOpen(true);
  };

  const handleEditNumBotsChange = (e) => {
    const val = parseInt(e.target.value) || 1;
    if (val > 20) return;
    setEditNumBots(val);
    
    setEditBotIds((prev) => {
      if (val > prev.length) {
        const newIds = Array(val - prev.length).fill("").map((_, i) => generateBotId(editHospitalName, prev.length + i + 1));
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

  const validateEditAvailability = async (email, hid, nameToCheck = null, excludeId = null) => {
    if (!email && !hid && !nameToCheck) {
      setEditAvailabilityHint(null);
      return;
    }
    setIsCheckingEdit(true);
    
    let nameCollision = false;
    if (nameToCheck) {
      nameCollision = liveHospitals?.some(h => 
        h.hospitalName.toLowerCase().trim() === nameToCheck.toLowerCase().trim() && 
        h._id !== excludeId
      );
    }

    const res = await checkAvailability(email, hid);
    
    if (nameCollision) {
      setEditAvailabilityHint({ 
        type: 'error', 
        message: 'Name already exists. Please use unique format like "Name-Location"',
        field: 'name' 
      });
    } else if (res.available) {
      setEditAvailabilityHint({ type: 'success', message: 'ID and Email are available' });
    } else if (res.error) {
       // ignore transient errors
    } else {
      setEditAvailabilityHint({ type: 'error', message: res.reason, field: res.field });
    }
    setIsCheckingEdit(false);
  };

  const openEditSetup = (requestId) => {
    const hospital = liveHospitals?.find(h => h.sourceRequestId === requestId);
    if (!hospital) {
      appAlert("error", "Not Found", "Hospital data not found.");
      return;
    }
    setEditSetupId(requestId);
    setEditHospitalId(hospital._id);
    setEditAdminEmail(hospital.adminEmail || "");
    setEditHospitalName(hospital.hospitalName || "HOSP");
    setEditNumBots(hospital.numberOfNavatars || 1);
    setEditBotIds(hospital.botIds || [generateBotId(hospital.hospitalName, 1)]);
    setEditAvailabilityHint(null);
  };

  const submitEditSetup = async (e) => {
    e.preventDefault();
    if (!editAdminEmail || editBotIds.some(bid => !bid.trim())) {
      appAlert("error", "Missing Information", "Please fill all required fields.");
      return;
    }
    
    if (editAvailabilityHint?.type === 'error') {
      appAlert("error", "Validation Failed", editAvailabilityHint.message);
      return;
    }

    setSubmittingId(editSetupId);
    const res = await updateHospital(editHospitalId, {
      adminEmail: editAdminEmail,
      numberOfBots: editNumBots,
      botIds: editBotIds.map(b => b.trim()),
      hospitalName: editHospitalName
    });

    if (res.success) {
      setEditSetupId(null);
      appAlert("success", "Allocation Updated", "Hospital configuration saved successfully.");
    } else {
      appAlert("error", "Update Failed", res.error);
    }
    setSubmittingId(null);
  };


  const handleDeleteRequest = async (requestId, name) => {
    setConfirmConfig({
      title: "Permanent Deletion",
      message: `Are you sure you want to PERMANENTLY delete the request and any allocation for "${name || 'this hospital'}"? This cannot be undone and all data will be lost.`,
      onConfirm: async () => {
        setSubmittingId(requestId);
        const res = await deleteRequestAndHospital(requestId);
        if (res.success) {
          appAlert("success", "Deleted", "Hospital and request records have been permanently removed.");
        } else {
          appAlert("error", "Delete Failed", res.error);
        }
        setSubmittingId(null);
      }
    });
  };


  const slugify = (text) => {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]+/g, '')
      .replace(/--+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  };

  const generateComplexId = (name) => {
    const slug = slugify(name || "HOSP");
    const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${slug.toUpperCase()}-${suffix}`;
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
              onClick={() => { setSetupRequest({}); setIsSetupOpen(true); }}
              className="card-hover"
              style={{
                display: "flex", alignItems: "center", gap: "8px", padding: "10px 16px", borderRadius: "10px",
                border: "none", background: "#3b82f6", color: "white", fontSize: "14px",
                fontWeight: "600", cursor: "pointer", transition: "all 0.2s", boxShadow: "0 4px 12px rgba(59,130,246,0.3)"
              }}
            >
               <Plus size={16} /> Add Hospital
            </button>
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
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
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
                                  onClick={() => openSetup(r)}
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
                            {(activeTab === "accepted" || activeTab === "pending") && (
                              <button
                                onClick={() => handleDeleteRequest(r._id, r.hospitalName)}
                                disabled={submittingId === r._id}
                                style={{
                                  display: "flex", alignItems: "center", justifyContent: "center", padding: "8px", borderRadius: "8px", 
                                  border: "1px solid #fee2e2", background: "#fef2f2", color: "#ef4444", fontSize: "13px", 
                                  fontWeight: "600", cursor: "pointer", opacity: submittingId === r._id ? 0.6 : 1
                                }}
                                title="Delete Request and Allocation"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                            {activeTab === "rejected" && (
                              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                <span style={{ fontSize: "13px", color: "#ef4444", fontWeight: "500" }}>
                                  Rejected
                                </span>
                                <button
                                  onClick={() => handleRevive(r._id)}
                                  disabled={submittingId === r._id}
                                  title="Revive Request"
                                  style={{
                                    display: "flex", alignItems: "center", gap: "6px", padding: "6px", borderRadius: "8px", 
                                    border: "1px solid #cbd5e1", background: "#f8fafc", color: "#475569", 
                                    cursor: "pointer", opacity: submittingId === r._id ? 0.6 : 1
                                  }}
                                >
                                  <RotateCcw size={14} />
                                </button>
                              </div>
                            )}
                          </div>
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

      <HospitalSetupModal 
        key={isSetupOpen ? (setupRequest?._id || 'direct') : 'closed'}
        open={isSetupOpen} 
        onClose={() => { setIsSetupOpen(false); setSetupRequest(null); }}
        onSave={handleHospitalSubmit}
        initialRequest={setupRequest}
        liveHospitals={liveHospitals}
        submittingId={submittingId}
        generateComplexId={generateComplexId}
        slugify={slugify}
        generateBotId={generateBotId}
      />

      <NotificationToast notification={notification} />
      
      {confirmConfig && (
        <ConfirmationModal 
          config={confirmConfig} 
          onClose={() => setConfirmConfig(null)} 
        />
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
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.025em", marginBottom: "8px" }}>
                    Hospital Identity (Permanent)
                  </label>
                  <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: "14px", fontWeight: "700", color: "#0f172a" }}>{editHospitalName}</div>
                    <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px", fontFamily: "monospace", letterSpacing: "0.05em" }}>ID: {editHospitalId}</div>
                  </div>
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#475569", marginBottom: "8px" }}>
                    Admin Email Address <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="email"
                    required
                    autoFocus
                    value={editAdminEmail}
                    onChange={(e) => {
                      setEditAdminEmail(e.target.value);
                      validateEditAvailability(e.target.value, editHospitalId, editHospitalName, editHospitalId);
                    }}
                    placeholder="admin@hospital.com"
                    style={{
                      width: "100%", padding: "12px 14px", borderRadius: "10px", border: editAvailabilityHint?.field === 'email' ? "1.5px solid #ef4444" : "1px solid #e2e8f0",
                      fontSize: "14px", color: "#0f172a", outline: "none", background: editAvailabilityHint?.field === 'email' ? "#fff1f2" : "white"
                    }}
                  />
                  {isCheckingEdit && (
                      <span style={{ fontSize: "11px", color: "#3b82f6", marginTop: "4px", display: "block" }}>
                        Checking...
                      </span>
                    )}
                  {editAvailabilityHint && editAvailabilityHint.field === 'email' && (
                    <p style={{ fontSize: "12px", marginTop: "6px", color: editAvailabilityHint.type === 'error' ? '#ef4444' : '#10b981', fontWeight: "500" }}>
                      {editAvailabilityHint.type === 'error' ? <X size={12} style={{ verticalAlign: 'middle' }} /> : <Check size={12} style={{ verticalAlign: 'middle' }} />} {editAvailabilityHint.message}
                    </p>
                  )}
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
                  disabled={submittingId === editSetupId || editAvailabilityHint?.type === 'error'}
                  style={{
                    padding: "10px 18px", borderRadius: "8px", border: "none", background: "#3b82f6", color: "white", fontSize: "14px", fontWeight: "600", cursor: (submittingId === editSetupId || editAvailabilityHint?.type === 'error') ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 12px rgba(59,130,246,0.3)", opacity: (submittingId === editSetupId || editAvailabilityHint?.type === 'error') ? 0.7 : 1
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
                    {liveSuperadmins?.map((admin) => (
                      <div key={admin._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc", padding: "10px 14px", borderRadius: "10px", border: "1px solid #f1f5f9" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", color: "#3b82f6", fontSize: "12px", fontWeight: "700" }}>
                            {admin.email?.[0].toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontSize: "14px", fontWeight: "600", color: "#0f172a" }}>{admin.email}</div>
                            {admin.email === loggedInEmail && (
                              <span style={{ fontSize: "10px", color: "#3b82f6", fontWeight: "600" }}>Current User (You)</span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteAdmin(admin._id)}
                          disabled={admin.email === loggedInEmail}
                          style={{ color: admin.email === loggedInEmail ? "#cbd5e1" : "#ef4444", background: "none", border: "none", cursor: admin.email === loggedInEmail ? "not-allowed" : "pointer" }}
                          title="Remove Superadmin"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    {(!liveSuperadmins || liveSuperadmins.length === 0) && (
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

// Reusable Components inside the same file for simplicity as per existing structure

function HospitalSetupModal({ open, onClose, onSave, initialRequest, liveHospitals, submittingId, generateComplexId, slugify, generateBotId }) {
  const [name, setName] = useState(initialRequest?.hospitalName || "");
  const [email, setEmail] = useState(initialRequest?.email || "");
  const [hid, setHid] = useState(initialRequest?.hospitalName ? generateComplexId(initialRequest.hospitalName) : "");
  const [numBots, setNumBots] = useState(1);
  const [botIds, setBotIds] = useState(initialRequest?.hospitalName ? [generateBotId(initialRequest.hospitalName, 1)] : [""]);
  const [isChecking, setIsChecking] = useState(false);
  const [availabilityHint, setAvailabilityHint] = useState(null);

  const isDirectEntry = !initialRequest?._id;

  if (!open) return null;

  const validateAvailability = async (m, i, n = null) => {
    if (!m && !i && !n) {
      setAvailabilityHint(null);
      return;
    }
    setIsChecking(true);
    let nameCollision = false;
    if (n && n.trim()) {
      nameCollision = liveHospitals?.some(h => 
        h.hospitalName.toLowerCase().trim() === n.toLowerCase().trim()
      );
    }

    const res = await checkAvailability(m, i);
    
    if (nameCollision) {
      setAvailabilityHint({ 
        type: 'error', 
        message: 'Hospital name already exists. Please use a unique format like "Name-Location"',
        field: 'name' 
      });
    } else if (res.available) {
      setAvailabilityHint({ type: 'success', message: 'ID and Email are available' });
    } else if (res.error) {
       // ignore transient errors
    } else {
      setAvailabilityHint({ type: 'error', message: res.reason, field: res.field });
    }
    setIsChecking(false);
  };

  const handleNameChange = (val) => {
    setName(val);
    if (!val.trim()) {
      setHid("");
      setAvailabilityHint(null);
      return;
    }
    const prefix = val.split(' ')[0].toUpperCase().replace(/[^A-Z0-9]/g, '') || "HOSP";
    
    // Auto-update Hospital ID for direct entry
    if (isDirectEntry) {
      const newId = generateComplexId(val);
      setHid(newId);
      validateAvailability(email, newId, val);
    } else {
      // For existing requests, only validate name
      validateAvailability(email, hid, val);
    }

    // Auto-populate Bot IDs
    setBotIds(Array(numBots).fill("").map((_, i) => `${prefix}-NAV-${i + 1}`));
  };

  const updateBotId = (idx, val) => {
    setBotIds(prev => {
      const copy = [...prev];
      copy[idx] = val;
      return copy;
    });
  };

  const handleNumBotsChange = (val) => {
    const n = parseInt(val) || 1;
    if (n > 20) return;
    setNumBots(n);
    setBotIds(prev => {
      const hName = name || "HOSP";
      const prefix = hName.split(' ')[0].toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (n > prev.length) {
        return [...prev, ...Array(n - prev.length).fill("").map((_, i) => `${prefix}-NAV-${prev.length + i + 1}`)];
      }
      return prev.slice(0, n);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || botIds.some(bid => !bid.trim()) || !name.trim() || !hid.trim()) {
      setAvailabilityHint({ type: 'error', message: 'Please fill all required fields.', field: 'general' });
      return;
    }
    if (availabilityHint?.type === 'error') return;
    
    await onSave({ hospitalName: name, adminEmail: email, hospitalId: hid, numberOfBots: numBots, botIds }, isDirectEntry);
  };

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 999999, display: "flex", justifyContent: "center", padding: "40px 20px", overflowY: "auto" }}>
      <div className="animate-fade-in" style={{ background: "white", borderRadius: "16px", width: "100%", maxWidth: "700px", boxShadow: "0 24px 48px rgba(0,0,0,0.15)", margin: "auto" }}>
        <form onSubmit={handleSubmit}>
          <div style={{ padding: "24px", borderBottom: "1px solid #f1f5f9" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", color: "#3b82f6" }}>
                  {isDirectEntry ? <Plus size={20} /> : <ShieldAlert size={20} />}
                </div>
                <h2 style={{ fontSize: "18px", fontWeight: "700", color: "#0f172a" }}>
                  {isDirectEntry ? "Direct Hospital Onboarding" : "Setup Hospital Account"}
                </h2>
              </div>
              <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}><X size={20} /></button>
            </div>
            <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.5 }}>
              {isDirectEntry ? "Manually onboard a new hospital into the system." : "Assign an admin and construct their fleet of Navatars. They will use Google Authentication to log in."}
            </p>
          </div>
          <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#475569", marginBottom: "8px" }}>Hospital Name / Organization <span style={{ color: "#ef4444" }}>*</span></label>
                <input type="text" required value={name} onChange={(e) => handleNameChange(e.target.value)} placeholder="e.g. City General Hospital" style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: availabilityHint?.field === 'name' ? "1.5px solid #ef4444" : "1px solid #e2e8f0", fontSize: "14px", outline: "none", background: availabilityHint?.field === 'name' ? "#fff1f2" : "white" }} />
                {availabilityHint?.field === 'name' && <p style={{ fontSize: "11px", marginTop: "4px", color: "#ef4444", fontWeight: "600" }}><X size={12} style={{ verticalAlign: 'middle' }} /> {availabilityHint.message}</p>}
                {isDirectEntry && <p style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>This name will be used to generate the Hospital ID.</p>}
              </div>
              <div>
                 <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#475569", marginBottom: "8px" }}>Hospital ID (Locked) <span style={{ color: "#ef4444" }}>*</span></label>
                 <div style={{ position: "relative" }}>
                   <input type="text" readOnly value={hid} style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: availabilityHint?.field === 'hid' ? "1.5px solid #ef4444" : "1px solid #e2e8f0", fontSize: "14px", outline: "none", fontWeight: "600", background: "#f1f5f9", color: "#64748b", cursor: "not-allowed" }} />
                   {isChecking && <span style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "11px", color: "#3b82f6" }}>Checking...</span>}
                 </div>
                 {availabilityHint?.field === 'hid' && (
                    <p style={{ fontSize: "11px", marginTop: "4px", color: availabilityHint.type === 'error' ? '#ef4444' : '#10b981' }}>
                      {availabilityHint.type === 'error' ?'✕ ' : '✓ '}{availabilityHint.message}
                    </p>
                 )}
              </div>
             <div>
               <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#475569", marginBottom: "8px" }}>Admin Email Address <span style={{ color: "#ef4444" }}>*</span></label>
               <input type="email" required value={email} onChange={(e) => { setEmail(e.target.value); validateAvailability(e.target.value, hid, name); }} placeholder="admin@hospital.com" style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: availabilityHint?.field === 'email' ? "1.5px solid #ef4444" : "1px solid #e2e8f0", fontSize: "14px", outline: "none", background: availabilityHint?.field === 'email' ? "#fff1f2" : "white" }} />
               {availabilityHint?.field === 'email' && (
                    <p style={{ fontSize: "11px", marginTop: "4px", color: availabilityHint.type === 'error' ? '#ef4444' : '#10b981' }}>
                      {availabilityHint.type === 'error' ?'✕ ' : '✓ '}{availabilityHint.message}
                    </p>
                 )}
              </div>
             <div>
               <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#475569", marginBottom: "8px" }}>Number of Navatars Booked <span style={{ color: "#ef4444" }}>*</span></label>
               <input type="number" min={1} max={20} required value={numBots} onChange={(e) => handleNumBotsChange(e.target.value)} style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "14px", outline: "none" }} />
             </div>
             <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
               <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#475569", marginBottom: "12px" }}>Assign unique Bot IDs <span style={{ color: "#ef4444" }}>*</span></label>
               <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                 {botIds.map((bid, idx) => (
                   <div key={idx} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                     <span style={{ fontSize: "12px", color: "#94a3b8", display: "flex", alignItems: "center", gap: "4px" }}><Cpu size={14} /> #{idx + 1}</span>
                     <input type="text" required value={bid} onChange={(e) => updateBotId(idx, e.target.value)} placeholder="e.g. NAV-1011" style={{ flex: 1, padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", outline: "none" }} />
                   </div>
                 ))}
               </div>
             </div>
          </div>
          <div style={{ padding: "16px 24px", background: "#f8fafc", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "flex-end", gap: "12px" }}>
            <button type="button" onClick={onClose} style={{ padding: "10px 16px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "white", color: "#475569", fontSize: "14px", cursor: "pointer" }}>Cancel</button>
            <button type="submit" disabled={submittingId === (initialRequest?._id || "direct") || availabilityHint?.type === 'error'} style={{ padding: "10px 20px", borderRadius: "8px", border: "none", background: "#3b82f6", color: "white", fontSize: "14px", fontWeight: "600", cursor: (submittingId === (initialRequest?._id || "direct") || availabilityHint?.type === 'error') ? "not-allowed" : "pointer", opacity: (submittingId === (initialRequest?._id || "direct") || availabilityHint?.type === 'error') ? 0.7 : 1 }}>
              {submittingId === (initialRequest?._id || "direct") ? "Saving..." : (isDirectEntry ? "Onboard Hospital" : "Setup & Save Configurations")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConfirmationModal({ config, onClose }) {
  if (!config) return null;
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999999, display: "flex", justifyContent: "center", alignItems: "center", padding: "20px" }}>
      <div className="animate-fade-in" style={{ background: "white", borderRadius: "16px", width: "100%", maxWidth: "420px", boxShadow: "0 24px 48px rgba(0,0,0,0.2)", padding: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px", color: "#ef4444" }}>
          <AlertCircle size={24} />
          <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#0f172a" }}>{config.title}</h3>
        </div>
        <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.5, marginBottom: "24px" }}>{config.message}</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
          <button onClick={onClose} style={{ padding: "10px 16px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "white", color: "#475569", fontSize: "14px", fontWeight: "500", cursor: "pointer" }}>Cancel</button>
          <button 
            onClick={() => { config.onConfirm(); onClose(); }} 
            style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#ef4444", color: "white", fontSize: "14px", fontWeight: "600", cursor: "pointer" }}
          >
            Confirm Action
          </button>
        </div>
      </div>
    </div>
  );
}

function NotificationToast({ notification }) {
  if (!notification) return null;
  const isError = notification.type === "error";
  return (
    <div style={{
      position: "fixed", bottom: "24px", right: "24px", zIndex: 9999999,
      minWidth: "320px", maxWidth: "400px", background: "white", borderRadius: "12px",
      boxShadow: "0 10px 25px rgba(0,0,0,0.1)", border: `1px solid ${isError ? '#fee2e2' : '#dcfce7'}`,
      padding: "16px", display: "flex", gap: "12px", alignItems: "flex-start",
      animation: "slide-in 0.3s ease-out"
    }}>
      <div style={{ color: isError ? "#ef4444" : "#10b981", marginTop: "2px" }}>
        {isError ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
      </div>
      <div style={{ flex: 1 }}>
        <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#0f172a" }}>{notification.title}</h4>
        <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#64748b", lineHeight: 1.4 }}>{notification.message}</p>
      </div>
    </div>
  );
}

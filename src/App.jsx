import { useState, useEffect } from "react";
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  SignIn,
  useUser,
  UserButton,
} from "@clerk/clerk-react";
import { createClient } from "@supabase/supabase-js";

const PUBLISHABLE_KEY = "pk_test_bWFpbi1jb3JhbC00OS5jbGVyay5hY2NvdW50cy5kZXYk";
const SUPABASE_URL = "https://pvjmzycmvavmntbmudbc.supabase.co";
const SUPABASE_KEY = "sb_publishable_Zoq88wvCDawDQET4LpAj4w_Mw6vDgRr";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const STATUSES = ["Applied", "Interview", "Offer", "Rejected", "Withdrawn"];
const ALIGNMENT = ["", "Reaches", "Good Fit", "Dream", "Safety"];
const IMPACT = ["", "Low", "Medium", "High"];

const STATUS_COLORS = {
  Applied: { bg: "#e8f4fd", text: "#1a6fa8", border: "#b8d9f0" },
  Interview: { bg: "#fef3e2", text: "#b45309", border: "#fcd88a" },
  Offer: { bg: "#e6f9f0", text: "#166534", border: "#86efac" },
  Rejected: { bg: "#fde8e8", text: "#991b1b", border: "#fca5a5" },
  Withdrawn: { bg: "#f3f4f6", text: "#4b5563", border: "#d1d5db" },
};

const EMPTY_FORM = { company: "", role: "", status: "Applied", date: "", notes: "", alignment: "", impact: "" };

function fmt(d) {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Main App Shell ───────────────────────────────────────────────────────────
export default function App() {
  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <SignedOut>
        <LoginPage />
      </SignedOut>
      <SignedIn>
        <Tracker />
      </SignedIn>
    </ClerkProvider>
  );
}

// ─── Login Page ───────────────────────────────────────────────────────────────
function LoginPage() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#0f0f0f",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Georgia', serif",
    }}>
      <div style={{ marginBottom: 40, textAlign: "center" }}>
        <div style={{ fontSize: 13, letterSpacing: "0.3em", color: "#666", textTransform: "uppercase", marginBottom: 12 }}>
          Application Tracker
        </div>
        <div style={{ fontSize: 42, color: "#fff", fontWeight: 400, letterSpacing: "-0.02em" }}>
          Your job hunt,<br />your business.
        </div>
        <div style={{ marginTop: 14, fontSize: 15, color: "#555", maxWidth: 340 }}>
          Private by default. Share only with who you choose.
        </div>
      </div>
      <SignIn routing="hash" />
    </div>
  );
}

// ─── Main Tracker ─────────────────────────────────────────────────────────────
function Tracker() {
  const { user } = useUser();
  const myEmail = user?.primaryEmailAddress?.emailAddress;
  const myName = user?.fullName || user?.firstName || myEmail;

  const [view, setView] = useState("mine"); // "mine" | "total" | email string (someone else's tracker)
  const [myApps, setMyApps] = useState([]);
  const [sharedWithMe, setSharedWithMe] = useState([]); // list of {owner_email, owner_name}
  const [myShares, setMyShares] = useState([]); // emails I've shared with
  const [viewingApps, setViewingApps] = useState([]); // apps for current view
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [shareModal, setShareModal] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [shareMsg, setShareMsg] = useState("");
  const [comments, setComments] = useState({}); // { appId: [comments] }
  const [commentText, setCommentText] = useState({}); // { appId: text }
  const [expandedComments, setExpandedComments] = useState({}); // { appId: bool }
  const [statusFilter, setStatusFilter] = useState("All");

  useEffect(() => { if (myEmail) init(); }, [myEmail]);
  useEffect(() => { if (view !== "mine") loadViewApps(); }, [view]);

  async function init() {
    setLoading(true);
    await Promise.all([fetchMyApps(), fetchSharedWithMe(), fetchMyShares()]);
    setLoading(false);
  }

  async function fetchMyApps() {
    const { data } = await supabase
      .from("applications")
      .select("*")
      .eq("person", myEmail)
      .order("created_at", { ascending: false });
    setMyApps(data || []);
    if (view === "mine") {
      setViewingApps(data || []);
      await fetchCommentsForApps(data || []);
    }
  }

  async function fetchSharedWithMe() {
    const { data } = await supabase
      .from("shares")
      .select("*")
      .eq("shared_with_email", myEmail);
    setSharedWithMe(data || []);
  }

  async function fetchMyShares() {
    const { data } = await supabase
      .from("shares")
      .select("*")
      .eq("owner_email", myEmail);
    setMyShares(data || []);
  }

  async function loadViewApps() {
    if (view === "total") {
      // Load apps from everyone who shared with me + mine
      const ownerEmails = sharedWithMe.map(s => s.owner_email);
      ownerEmails.push(myEmail);
      const { data } = await supabase
        .from("applications")
        .select("*")
        .in("person", ownerEmails)
        .order("created_at", { ascending: false });
      setViewingApps(data || []);
      await fetchCommentsForApps(data || []);
    } else {
      // Viewing someone else's tracker — check we have access
      const hasAccess = sharedWithMe.some(s => s.owner_email === view) || view === myEmail;
      if (!hasAccess) return;
      const { data } = await supabase
        .from("applications")
        .select("*")
        .eq("person", view)
        .order("created_at", { ascending: false });
      setViewingApps(data || []);
      await fetchCommentsForApps(data || []);
    }
  }

  async function fetchCommentsForApps(apps) {
    if (!apps.length) return;
    const ids = apps.map(a => a.id);
    const { data } = await supabase
      .from("comments")
      .select("*")
      .in("application_id", ids)
      .order("created_at", { ascending: true });
    const grouped = {};
    (data || []).forEach(c => {
      if (!grouped[c.application_id]) grouped[c.application_id] = [];
      grouped[c.application_id].push(c);
    });
    setComments(prev => ({ ...prev, ...grouped }));
  }

  async function save() {
    if (!form.company || !form.role) return;
    if (editId) {
      await supabase.from("applications").update({ ...form }).eq("id", editId);
    } else {
      await supabase.from("applications").insert({ ...form, person: myEmail, person_name: myName });
    }
    setModal(false);
    setForm(EMPTY_FORM);
    setEditId(null);
    await fetchMyApps();
    if (view !== "mine") await loadViewApps();
  }

  async function remove(id) {
    if (!confirm("Delete this application?")) return;
    await supabase.from("applications").delete().eq("id", id);
    await fetchMyApps();
    if (view !== "mine") await loadViewApps();
  }

  function openEdit(app) {
    setForm({ company: app.company, role: app.role, status: app.status, date: app.date || "", notes: app.notes || "", alignment: app.alignment || "", impact: app.impact || "" });
    setEditId(app.id);
    setModal(true);
  }

  async function addShare() {
    if (!shareEmail.trim()) return;
    const email = shareEmail.trim().toLowerCase();
    if (email === myEmail) { setShareMsg("That's your own email!"); return; }
    if (myShares.some(s => s.shared_with_email === email)) { setShareMsg("Already shared with this person."); return; }
    await supabase.from("shares").insert({ owner_email: myEmail, shared_with_email: email });
    await fetchMyShares();
    setShareEmail("");
    setShareMsg(`✓ Shared with ${email}`);
    setTimeout(() => setShareMsg(""), 3000);
  }

  async function removeShare(email) {
    await supabase.from("shares").delete().eq("owner_email", myEmail).eq("shared_with_email", email);
    await fetchMyShares();
  }

  async function postComment(appId) {
    const text = (commentText[appId] || "").trim();
    if (!text) return;
    await supabase.from("comments").insert({
      application_id: appId,
      author_email: myEmail,
      author_name: myName,
      text,
    });
    setCommentText(prev => ({ ...prev, [appId]: "" }));
    const apps = view === "mine" ? myApps : viewingApps;
    await fetchCommentsForApps(apps);
  }

  async function deleteComment(commentId, appId) {
    // Only app owner can delete
    await supabase.from("comments").delete().eq("id", commentId);
    const apps = view === "mine" ? myApps : viewingApps;
    await fetchCommentsForApps(apps);
  }

  const isMyTracker = view === "mine" || view === myEmail;
  const canEdit = isMyTracker;

  // Figure out tracker owner email for permission checks
  const trackerOwnerEmail = view === "total" ? null : (view === "mine" ? myEmail : view);

  const filtered = statusFilter === "All"
    ? viewingApps
    : viewingApps.filter(a => a.status === statusFilter);

  const statusCounts = STATUSES.reduce((acc, s) => {
    acc[s] = viewingApps.filter(a => a.status === s).length;
    return acc;
  }, {});

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#fafaf8", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Georgia, serif", color: "#999", fontSize: 16 }}>
      Loading your tracker…
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#fafaf8", fontFamily: "'Georgia', serif" }}>
      {/* Top Nav */}
      <div style={{ background: "#0f0f0f", padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <span style={{ color: "#fff", fontSize: 15, letterSpacing: "0.05em", fontWeight: 400 }}>AppTrackr</span>
          <div style={{ display: "flex", gap: 4 }}>
            {[
              { label: "My Tracker", key: "mine" },
              { label: "Total View", key: "total" },
            ].map(tab => (
              <button key={tab.key} onClick={() => { setView(tab.key); setStatusFilter("All"); if (tab.key === "mine") setViewingApps(myApps); }}
                style={{ padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 13, background: view === tab.key ? "#fff" : "transparent", color: view === tab.key ? "#0f0f0f" : "#888", transition: "all 0.15s" }}>
                {tab.label}
              </button>
            ))}
            {sharedWithMe.map(s => (
              <button key={s.owner_email} onClick={() => { setView(s.owner_email); setStatusFilter("All"); }}
                style={{ padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 13, background: view === s.owner_email ? "#fff" : "transparent", color: view === s.owner_email ? "#0f0f0f" : "#888", transition: "all 0.15s" }}>
                {s.owner_email.split("@")[0]}'s Tracker
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {isMyTracker && (
            <button onClick={() => setShareModal(true)}
              style={{ padding: "6px 16px", borderRadius: 6, border: "1px solid #444", background: "transparent", color: "#ccc", fontSize: 13, cursor: "pointer" }}>
              Share Tracker
            </button>
          )}
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
        {/* Header */}
        <div style={{ marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.25em", color: "#999", textTransform: "uppercase", marginBottom: 6 }}>
              {view === "mine" ? `${myName}` : view === "total" ? "Combined View" : `${view.split("@")[0]}'s Tracker`}
            </div>
            <div style={{ fontSize: 30, color: "#1a1a1a", fontWeight: 400 }}>
              {viewingApps.length} Application{viewingApps.length !== 1 ? "s" : ""}
            </div>
          </div>
          {canEdit && (
            <button onClick={() => { setForm(EMPTY_FORM); setEditId(null); setModal(true); }}
              style={{ padding: "10px 22px", background: "#0f0f0f", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, cursor: "pointer", letterSpacing: "0.02em" }}>
              + Add Application
            </button>
          )}
        </div>

        {/* Status summary pills */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
          <button onClick={() => setStatusFilter("All")}
            style={{ padding: "5px 14px", borderRadius: 20, border: `1px solid ${statusFilter === "All" ? "#0f0f0f" : "#ddd"}`, background: statusFilter === "All" ? "#0f0f0f" : "#fff", color: statusFilter === "All" ? "#fff" : "#666", fontSize: 12, cursor: "pointer" }}>
            All ({viewingApps.length})
          </button>
          {STATUSES.filter(s => statusCounts[s] > 0).map(s => {
            const c = STATUS_COLORS[s];
            const active = statusFilter === s;
            return (
              <button key={s} onClick={() => setStatusFilter(statusFilter === s ? "All" : s)}
                style={{ padding: "5px 14px", borderRadius: 20, border: `1px solid ${active ? c.border : "#ddd"}`, background: active ? c.bg : "#fff", color: active ? c.text : "#666", fontSize: 12, cursor: "pointer" }}>
                {s} ({statusCounts[s]})
              </button>
            );
          })}
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "#aaa", fontSize: 15 }}>
            {canEdit ? "No applications yet. Add your first one →" : "Nothing here yet."}
          </div>
        ) : (
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e8e4", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #f0f0ec" }}>
                  {view === "total" && <th style={thStyle}>Person</th>}
                  <th style={thStyle}>Company</th>
                  <th style={thStyle}>Role</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Fit</th>
                  <th style={thStyle}>Priority</th>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Notes</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((app, i) => {
                  const sc = STATUS_COLORS[app.status] || {};
                  const appComments = comments[app.id] || [];
                  const expanded = expandedComments[app.id];
                  const isOwner = app.person === myEmail;
                  // Can comment if: this is my tracker, total view, or viewing someone's shared tracker
                  const canComment = true;

                  return (
                    <>
                      <tr key={app.id} style={{ borderBottom: expanded ? "none" : "1px solid #f5f5f2", background: i % 2 === 0 ? "#fff" : "#fdfdfc" }}>
                        {view === "total" && (
                          <td style={tdStyle}>
                            <span style={{ fontSize: 12, color: "#888", background: "#f5f5f2", padding: "2px 8px", borderRadius: 4 }}>
                              {(app.person_name || app.person.split("@")[0])}
                            </span>
                          </td>
                        )}
                        <td style={{ ...tdStyle, fontWeight: 500, color: "#1a1a1a" }}>{app.company}</td>
                        <td style={{ ...tdStyle, color: "#555" }}>{app.role}</td>
                        <td style={tdStyle}>
                          <span style={{ fontSize: 11, fontWeight: 500, padding: "3px 9px", borderRadius: 12, background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`, whiteSpace: "nowrap" }}>
                            {app.status}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          {app.alignment ? <span style={{ fontSize: 11, color: "#888", background: "#f5f5f2", padding: "2px 8px", borderRadius: 4 }}>{app.alignment}</span> : <span style={{ color: "#ddd" }}>—</span>}
                        </td>
                        <td style={tdStyle}>
                          {app.impact ? <span style={{ fontSize: 11, color: "#888", background: "#f5f5f2", padding: "2px 8px", borderRadius: 4 }}>{app.impact}</span> : <span style={{ color: "#ddd" }}>—</span>}
                        </td>
                        <td style={{ ...tdStyle, color: "#aaa", fontSize: 12, whiteSpace: "nowrap" }}>{fmt(app.date)}</td>
                        <td style={{ ...tdStyle, color: "#888", fontSize: 12, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={app.notes}>{app.notes || "—"}</td>
                        <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                          <button onClick={() => setExpandedComments(prev => ({ ...prev, [app.id]: !prev[app.id] }))}
                            style={{ fontSize: 11, color: appComments.length ? "#6366f1" : "#bbb", background: "none", border: "none", cursor: "pointer", marginRight: 8 }}>
                            💬 {appComments.length}
                          </button>
                          {isOwner && (
                            <>
                              <button onClick={() => openEdit(app)} style={{ fontSize: 12, color: "#888", background: "none", border: "none", cursor: "pointer", marginRight: 6 }}>Edit</button>
                              <button onClick={() => remove(app.id)} style={{ fontSize: 12, color: "#ef4444", background: "none", border: "none", cursor: "pointer" }}>Delete</button>
                            </>
                          )}
                        </td>
                      </tr>
                      {expanded && (
                        <tr key={`${app.id}-comments`} style={{ borderBottom: "1px solid #f5f5f2" }}>
                          <td colSpan={view === "total" ? 9 : 8} style={{ padding: "12px 20px 16px", background: "#fafaf8" }}>
                            <div style={{ fontSize: 12, color: "#999", marginBottom: 8, letterSpacing: "0.1em", textTransform: "uppercase" }}>Comments</div>
                            {appComments.length === 0 && <div style={{ fontSize: 13, color: "#ccc", marginBottom: 10 }}>No comments yet.</div>}
                            {appComments.map(c => (
                              <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, background: "#fff", borderRadius: 8, padding: "8px 12px", border: "1px solid #efefec" }}>
                                <div>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: "#555", marginRight: 8 }}>{c.author_name || c.author_email.split("@")[0]}</span>
                                  <span style={{ fontSize: 13, color: "#333" }}>{c.text}</span>
                                  <div style={{ fontSize: 11, color: "#ccc", marginTop: 2 }}>{fmt(c.created_at)}</div>
                                </div>
                                {isOwner && (
                                  <button onClick={() => deleteComment(c.id, app.id)} style={{ fontSize: 11, color: "#ef4444", background: "none", border: "none", cursor: "pointer", marginLeft: 12, flexShrink: 0 }}>✕</button>
                                )}
                              </div>
                            ))}
                            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                              <input
                                value={commentText[app.id] || ""}
                                onChange={e => setCommentText(prev => ({ ...prev, [app.id]: e.target.value }))}
                                onKeyDown={e => e.key === "Enter" && postComment(app.id)}
                                placeholder="Add a comment…"
                                style={{ flex: 1, border: "1px solid #e0e0dc", borderRadius: 6, padding: "7px 12px", fontSize: 13, outline: "none", fontFamily: "Georgia, serif", background: "#fff" }}
                              />
                              <button onClick={() => postComment(app.id)}
                                style={{ padding: "7px 16px", background: "#0f0f0f", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, cursor: "pointer" }}>
                                Post
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 440, maxWidth: "90vw", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
            <div style={{ fontSize: 18, color: "#1a1a1a", marginBottom: 20, fontWeight: 400 }}>{editId ? "Edit Application" : "New Application"}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { label: "Company *", key: "company", placeholder: "e.g. Google" },
                { label: "Role *", key: "role", placeholder: "e.g. Software Engineer" },
              ].map(f => (
                <div key={f.key}>
                  <label style={labelStyle}>{f.label}</label>
                  <input value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    placeholder={f.placeholder} style={inputStyle} />
                </div>
              ))}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Status</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={inputStyle}>
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Fit</label>
                  <select value={form.alignment} onChange={e => setForm({ ...form, alignment: e.target.value })} style={inputStyle}>
                    {ALIGNMENT.map(s => <option key={s} value={s}>{s || "—"}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Priority</label>
                  <select value={form.impact} onChange={e => setForm({ ...form, impact: e.target.value })} style={inputStyle}>
                    {IMPACT.map(s => <option key={s} value={s}>{s || "—"}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Date Applied</label>
                <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Notes</label>
                <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional" style={inputStyle} />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
              <button onClick={() => { setModal(false); setEditId(null); }}
                style={{ padding: "9px 18px", border: "1px solid #e0e0dc", borderRadius: 8, background: "#fff", color: "#666", fontSize: 13, cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={save}
                style={{ padding: "9px 18px", background: "#0f0f0f", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer" }}>
                {editId ? "Save Changes" : "Add Application"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {shareModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 420, maxWidth: "90vw", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
            <div style={{ fontSize: 18, color: "#1a1a1a", marginBottom: 6, fontWeight: 400 }}>Share Your Tracker</div>
            <div style={{ fontSize: 13, color: "#999", marginBottom: 20 }}>People you invite can view your applications and leave comments.</div>

            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input value={shareEmail} onChange={e => setShareEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addShare()}
                placeholder="Enter their email address"
                style={{ ...inputStyle, flex: 1, margin: 0 }} />
              <button onClick={addShare}
                style={{ padding: "9px 18px", background: "#0f0f0f", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>
                Invite
              </button>
            </div>
            {shareMsg && <div style={{ fontSize: 13, color: shareMsg.startsWith("✓") ? "#166534" : "#991b1b", marginBottom: 12 }}>{shareMsg}</div>}

            {myShares.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, color: "#aaa", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 8 }}>Shared with</div>
                {myShares.map(s => (
                  <div key={s.shared_with_email} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#fafaf8", borderRadius: 8, marginBottom: 6, border: "1px solid #efefec" }}>
                    <span style={{ fontSize: 13, color: "#555" }}>{s.shared_with_email}</span>
                    <button onClick={() => removeShare(s.shared_with_email)}
                      style={{ fontSize: 12, color: "#ef4444", background: "none", border: "none", cursor: "pointer" }}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 20, textAlign: "right" }}>
              <button onClick={() => { setShareModal(false); setShareEmail(""); setShareMsg(""); }}
                style={{ padding: "9px 18px", border: "1px solid #e0e0dc", borderRadius: 8, background: "#fff", color: "#666", fontSize: 13, cursor: "pointer" }}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const thStyle = {
  padding: "11px 16px",
  textAlign: "left",
  fontSize: 11,
  fontWeight: 500,
  color: "#aaa",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  fontFamily: "Georgia, serif",
};

const tdStyle = {
  padding: "12px 16px",
  fontSize: 13,
  fontFamily: "Georgia, serif",
  verticalAlign: "top",
};

const labelStyle = {
  display: "block",
  fontSize: 11,
  color: "#999",
  marginBottom: 5,
  letterSpacing: "0.05em",
};

const inputStyle = {
  width: "100%",
  border: "1px solid #e0e0dc",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 13,
  outline: "none",
  fontFamily: "Georgia, serif",
  background: "#fff",
  boxSizing: "border-box",
};
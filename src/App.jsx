import { useState, useEffect, useRef } from "react";
import { ClerkProvider, SignedIn, SignedOut, SignIn, useUser, UserButton } from "@clerk/clerk-react";
import { createClient } from "@supabase/supabase-js";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const PUBLISHABLE_KEY = "pk_test_bWFpbi1jb3JhbC00OS5jbGVyay5hY2NvdW50cy5kZXYk";
const SUPABASE_URL = "https://pvjmzycmvavmntbmudbc.supabase.co";
const SUPABASE_KEY = "sb_publishable_Zoq88wvCDawDQET4LpAj4w_Mw6vDgRr";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const STATUSES = ["Applied", "Interview", "Offer", "Rejected", "Likely Rejected", "Withdrawn"];
const STAGES = [
  "", "Online Assessment Pending", "Completed Online Assessment",
  "Completed First Round Interview", "Final Round", "Waiting After Final Round"
];
const CATEGORIES = ["", "Graduate Role", "Internship", "Event", "Other"];
const ALIGNMENT = ["", "Reaches", "Good Fit", "Dream", "Safety"];
const IMPACT = ["", "Low", "Medium", "High"];
const BAR_COLORS = ["#0f0f0f", "#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6"];

const STATUS_COLORS = {
  Applied:        { bg: "#e8f4fd", text: "#1a6fa8", border: "#b8d9f0" },
  Interview:      { bg: "#dbeafe", text: "#1d4ed8", border: "#93c5fd" },
  Offer:          { bg: "#e6f9f0", text: "#166534", border: "#86efac" },
  Rejected:       { bg: "#fde8e8", text: "#991b1b", border: "#fca5a5" },
  "Likely Rejected": { bg: "#fff7ed", text: "#c2410c", border: "#fdba74" },
  Withdrawn:      { bg: "#f3f4f6", text: "#4b5563", border: "#d1d5db" },
};

const EMPTY_FORM = {
  company: "", role: "", status: "Applied", stage: "", category: "",
  date: "", notes: "", alignment: "", impact: "", assessment_deadline: ""
};

function fmt(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function daysUntil(d) {
  if (!d) return null;
  const diff = new Date(d) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
function timeAgo(d) {
  if (!d) return "";
  const diff = (Date.now() - new Date(d)) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
function displayName(app) {
  return app.person_name || app.person.split("@")[0];
}

// Row highlight logic
function rowStyle(app, i) {
  const base = { fontFamily: "Georgia, serif" };
  if (app.status === "Rejected") return { ...base, background: "#fff1f1" };
  if (app.status === "Likely Rejected") return { ...base, background: "#fff7ed" };
  if (app.stage === "Online Assessment Pending") return { ...base, background: "#fffbeb" };
  if (app.status === "Interview") return { ...base, background: "#eff6ff" };
  if (app.category === "Event") return { ...base, background: "#f5f3ff" };
  return { ...base, background: i % 2 === 0 ? "#fff" : "#fdfdfc" };
}

export default function App() {
  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <SignedOut><LoginPage /></SignedOut>
      <SignedIn><Tracker /></SignedIn>
    </ClerkProvider>
  );
}

function LoginPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#0f0f0f", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Georgia', serif" }}>
      <div style={{ marginBottom: 40, textAlign: "center" }}>
        <div style={{ fontSize: 13, letterSpacing: "0.3em", color: "#666", textTransform: "uppercase", marginBottom: 12 }}>Application Tracker</div>
        <div style={{ fontSize: 42, color: "#fff", fontWeight: 400, letterSpacing: "-0.02em" }}>Your job hunt,<br />your business.</div>
        <div style={{ marginTop: 14, fontSize: 15, color: "#555", maxWidth: 340 }}>Private by default. Share only with who you choose.</div>
      </div>
      <SignIn routing="hash" />
    </div>
  );
}

function Tracker() {
  const { user } = useUser();
  const myEmail = user?.primaryEmailAddress?.emailAddress;
  const myName = user?.fullName || user?.firstName || myEmail;

  const [tab, setTab] = useState("personal");
  const [myApps, setMyApps] = useState([]);
  const [sharedWithMe, setSharedWithMe] = useState([]);
  const [myShares, setMyShares] = useState([]);
  const [viewingApps, setViewingApps] = useState([]);
  const [allConnectedApps, setAllConnectedApps] = useState([]);
  const [activity, setActivity] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [prevStatus, setPrevStatus] = useState(null);
  const [shareModal, setShareModal] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [shareMsg, setShareMsg] = useState("");
  const [comments, setComments] = useState({});
  const [commentText, setCommentText] = useState({});
  const [expandedComments, setExpandedComments] = useState({});
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortMode, setSortMode] = useState("default"); // "default" | "rejected_first" | "rejected_last"
  const [deadlineEdits, setDeadlineEdits] = useState({});
  const notifRef = useRef(null);

  useEffect(() => { if (myEmail) init(); }, [myEmail]);
  useEffect(() => {
    if (tab === "personal") { setViewingApps(myApps); fetchCommentsForApps(myApps); setStatusFilter("All"); }
    else if (tab === "shared") { fetchAllConnectedApps(sharedWithMe); setStatusFilter("All"); }
    else if (tab === "total") loadViewApps("total");
    else if (sharedWithMe.some(s => s.owner_email === tab)) loadViewApps(tab);
  }, [tab]);

  useEffect(() => {
    function handle(e) { if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifs(false); }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  async function init() {
    setLoading(true);
    const [apps, shared] = await Promise.all([fetchMyApps(), fetchSharedWithMe(), fetchMyShares(), fetchNotifications()]);
    await fetchAllConnectedApps(shared || []);
    setLoading(false);
  }

  async function fetchMyApps() {
    const { data } = await supabase.from("applications").select("*").eq("person", myEmail).order("created_at", { ascending: false });
    setMyApps(data || []);
    setViewingApps(data || []);
    await fetchCommentsForApps(data || []);
    return data || [];
  }

  async function fetchSharedWithMe() {
    const { data } = await supabase.from("shares").select("*").eq("shared_with_email", myEmail);
    const seen = new Set();
    const unique = (data || []).filter(s => { if (seen.has(s.owner_email)) return false; seen.add(s.owner_email); return true; });
    setSharedWithMe(unique);
    return unique;
  }

  async function fetchMyShares() {
    const { data } = await supabase.from("shares").select("*").eq("owner_email", myEmail);
    const seen = new Set();
    const unique = (data || []).filter(s => { if (seen.has(s.shared_with_email)) return false; seen.add(s.shared_with_email); return true; });
    setMyShares(unique);
    return unique;
  }

  async function fetchNotifications() {
    const { data } = await supabase.from("notifications").select("*").eq("user_email", myEmail).order("created_at", { ascending: false }).limit(20);
    setNotifications(data || []);
  }

  async function fetchAllConnectedApps(sharedList) {
    const ownerEmails = [...new Set((sharedList || sharedWithMe).map(s => s.owner_email))];
    ownerEmails.push(myEmail);
    const { data } = await supabase.from("applications").select("*").in("person", ownerEmails).order("created_at", { ascending: false });
    setAllConnectedApps(data || []);
    setActivity([...(data || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 20));
  }

  async function loadViewApps(which) {
    const target = which || tab;
    if (target === "total") {
      const ownerEmails = [...new Set(sharedWithMe.map(s => s.owner_email))];
      ownerEmails.push(myEmail);
      const { data } = await supabase.from("applications").select("*").in("person", ownerEmails).order("created_at", { ascending: false });
      setViewingApps(data || []);
      await fetchCommentsForApps(data || []);
    } else {
      const { data } = await supabase.from("applications").select("*").eq("person", target).order("created_at", { ascending: false });
      setViewingApps(data || []);
      await fetchCommentsForApps(data || []);
    }
  }

  async function fetchCommentsForApps(apps) {
    if (!apps.length) return;
    const ids = apps.map(a => a.id);
    const { data } = await supabase.from("comments").select("*").in("application_id", ids).order("created_at", { ascending: true });
    const grouped = {};
    (data || []).forEach(c => {
      if (!grouped[c.application_id]) grouped[c.application_id] = [];
      grouped[c.application_id].push(c);
    });
    setComments(prev => ({ ...prev, ...grouped }));
  }

  async function save() {
    if (!form.company || !form.role) return;

    // Clean up the form — only send fields that exist in the DB
    const payload = {
      company: form.company,
      role: form.role,
      status: form.status,
      stage: form.stage || null,
      category: form.category || null,
      date: form.date || null,
      notes: form.notes || null,
      alignment: form.alignment || null,
      impact: form.impact || null,
      assessment_deadline: form.stage === "Online Assessment Pending" ? (form.assessment_deadline || null) : null,
    };

    if (editId) {
      if (prevStatus && prevStatus !== form.status) {
        for (const s of myShares) {
          await supabase.from("notifications").insert({
            user_email: s.shared_with_email, type: "status_change",
            message: `${myName} updated ${form.company} to ${form.status}`,
          });
        }
      }
      const { error } = await supabase.from("applications").update(payload).eq("id", editId);
      if (error) { alert(`Save failed: ${error.message}`); return; }
    } else {
      const { error } = await supabase.from("applications").insert({ ...payload, person: myEmail, person_name: myName });
      if (error) { alert(`Save failed: ${error.message}`); return; }
    }

    setModal(false); setForm(EMPTY_FORM); setEditId(null); setPrevStatus(null);
    await fetchMyApps();
    await fetchAllConnectedApps(sharedWithMe);
  }

  async function saveDeadline(appId, deadline) {
    await supabase.from("applications").update({ assessment_deadline: deadline || null }).eq("id", appId);
    await fetchMyApps();
    setDeadlineEdits(prev => { const n = { ...prev }; delete n[appId]; return n; });
  }

  async function remove(id) {
    if (!confirm("Delete this application?")) return;
    await supabase.from("applications").delete().eq("id", id);
    await fetchMyApps();
    await fetchAllConnectedApps(sharedWithMe);
  }

  function openEdit(app) {
    setForm({
      company: app.company, role: app.role, status: app.status, stage: app.stage || "",
      category: app.category || "", date: app.date || "", notes: app.notes || "",
      alignment: app.alignment || "", impact: app.impact || "",
      assessment_deadline: app.assessment_deadline || ""
    });
    setEditId(app.id); setPrevStatus(app.status); setModal(true);
  }

  async function addShare() {
    if (!shareEmail.trim()) return;
    const email = shareEmail.trim().toLowerCase();
    if (email === myEmail) { setShareMsg("That's your own email!"); return; }
    if (myShares.some(s => s.shared_with_email === email)) { setShareMsg("Already connected with this person."); return; }
    const { error } = await supabase.from("shares").insert([
      { owner_email: myEmail, shared_with_email: email },
      { owner_email: email, shared_with_email: myEmail },
    ]);
    if (error) { setShareMsg(`Error: ${error.message}`); return; }
    await supabase.from("notifications").insert({ user_email: email, type: "share", message: `${myName} shared their tracker with you` });
    await Promise.all([fetchMyShares(), fetchSharedWithMe()]);
    setShareEmail(""); setShareMsg("✓ Connected! You can now both see each other's trackers.");
    setTimeout(() => setShareMsg(""), 4000);
  }

  async function removeShare(email) {
    await supabase.from("shares").delete().eq("owner_email", myEmail).eq("shared_with_email", email);
    await supabase.from("shares").delete().eq("owner_email", email).eq("shared_with_email", myEmail);
    await Promise.all([fetchMyShares(), fetchSharedWithMe()]);
  }

  async function postComment(appId) {
    const text = (commentText[appId] || "").trim();
    if (!text) return;
    await supabase.from("comments").insert({ application_id: appId, author_email: myEmail, author_name: myName, text });
    const app = [...myApps, ...viewingApps].find(a => a.id === appId);
    if (app && app.person !== myEmail) {
      await supabase.from("notifications").insert({
        user_email: app.person, type: "comment",
        message: `${myName} commented on your ${app.company} application: "${text.slice(0, 50)}${text.length > 50 ? "…" : ""}"`,
      });
    }
    setCommentText(prev => ({ ...prev, [appId]: "" }));
    await fetchCommentsForApps(tab === "personal" ? myApps : viewingApps);
  }

  async function deleteComment(commentId) {
    await supabase.from("comments").delete().eq("id", commentId);
    await fetchCommentsForApps(tab === "personal" ? myApps : viewingApps);
  }

  async function markAllRead() {
    await supabase.from("notifications").update({ read: true }).eq("user_email", myEmail);
    await fetchNotifications();
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  const barData = (() => {
    const counts = {}; const names = {};
    allConnectedApps.forEach(a => { counts[a.person] = (counts[a.person] || 0) + 1; names[a.person] = displayName(a); });
    return Object.entries(counts).map(([email, count]) => ({ name: names[email], count })).sort((a, b) => b.count - a.count);
  })();

  // Stats for personal tracker summary
  const totalApplied = myApps.length;
  const totalRejected = myApps.filter(a => a.status === "Rejected" || a.status === "Likely Rejected").length;
  const totalOffers = myApps.filter(a => a.status === "Offer").length;
  const totalInterviews = myApps.filter(a => a.status === "Interview").length;
  const successRate = totalApplied > 0 ? Math.round((totalOffers / totalApplied) * 100) : 0;
  const rejectedRate = totalApplied > 0 ? Math.round((totalRejected / totalApplied) * 100) : 0;

  // Assessment deadlines (OA Pending apps with or without deadline)
  const oaPending = myApps.filter(a => a.stage === "Online Assessment Pending");

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#fafaf8", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Georgia, serif", color: "#999" }}>Loading…</div>
  );

  // ── Notification Bell ──
  const notifBell = (
    <div ref={notifRef} style={{ position: "relative" }}>
      <button onClick={() => { setShowNotifs(!showNotifs); if (!showNotifs && unreadCount > 0) markAllRead(); }}
        style={{ position: "relative", background: "none", border: "none", cursor: "pointer", padding: "4px 8px", fontSize: 18, lineHeight: 1 }}>
        🔔
        {unreadCount > 0 && (
          <span style={{ position: "absolute", top: 0, right: 0, background: "#ef4444", color: "#fff", fontSize: 10, borderRadius: "50%", width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600 }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {showNotifs && (
        <div style={{ position: "absolute", right: 0, top: 40, width: 320, background: "#fff", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.15)", border: "1px solid #e8e8e4", zIndex: 200, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #f0f0ec", fontSize: 11, color: "#aaa", letterSpacing: "0.1em", textTransform: "uppercase" }}>Notifications</div>
          {notifications.length === 0 ? (
            <div style={{ padding: "20px 16px", fontSize: 13, color: "#ccc", textAlign: "center" }}>Nothing yet</div>
          ) : (
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              {notifications.map(n => (
                <div key={n.id} style={{ padding: "10px 16px", borderBottom: "1px solid #f5f5f2", background: n.read ? "#fff" : "#fdf8ff" }}>
                  <div style={{ fontSize: 13, color: "#333", lineHeight: 1.4 }}>{n.message}</div>
                  <div style={{ fontSize: 11, color: "#bbb", marginTop: 3 }}>{timeAgo(n.created_at)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  // ── Share Modal ──
  const shareModalJsx = !shareModal ? null : (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 420, maxWidth: "90vw", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
        <div style={{ fontSize: 18, color: "#1a1a1a", marginBottom: 6, fontWeight: 400 }}>Share Your Tracker</div>
        <div style={{ fontSize: 13, color: "#999", marginBottom: 20 }}>Sharing is mutual — you'll both see each other's trackers.</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input value={shareEmail} onChange={e => setShareEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && addShare()}
            placeholder="Enter their email address" style={{ ...iS, flex: 1, margin: 0 }} />
          <button onClick={addShare} style={{ padding: "9px 18px", background: "#0f0f0f", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>Invite</button>
        </div>
        {shareMsg && <div style={{ fontSize: 13, color: shareMsg.startsWith("✓") ? "#166534" : "#991b1b", marginBottom: 12 }}>{shareMsg}</div>}
        {myShares.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, color: "#aaa", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 8 }}>Connected with</div>
            {myShares.map(s => (
              <div key={s.shared_with_email} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#fafaf8", borderRadius: 8, marginBottom: 6, border: "1px solid #efefec" }}>
                <span style={{ fontSize: 13, color: "#555" }}>{s.shared_with_email}</span>
                <button onClick={() => removeShare(s.shared_with_email)} style={{ fontSize: 12, color: "#ef4444", background: "none", border: "none", cursor: "pointer" }}>Remove</button>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 20, textAlign: "right" }}>
          <button onClick={() => { setShareModal(false); setShareEmail(""); setShareMsg(""); }}
            style={{ padding: "9px 18px", border: "1px solid #e0e0dc", borderRadius: 8, background: "#fff", color: "#666", fontSize: 13, cursor: "pointer" }}>Done</button>
        </div>
      </div>
    </div>
  );

  // ── App Modal ──
  const appModal = !modal ? null : (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 480, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
        <div style={{ fontSize: 18, color: "#1a1a1a", marginBottom: 20, fontWeight: 400 }}>{editId ? "Edit Application" : "New Application"}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div><label style={lS}>Company *</label><input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} placeholder="e.g. Google" style={iS} /></div>
          <div><label style={lS}>Role *</label><input value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} placeholder="e.g. Software Engineer" style={iS} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><label style={lS}>Category</label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={iS}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c || "— Select —"}</option>)}
              </select>
            </div>
            <div><label style={lS}>Status</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={iS}>
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div><label style={lS}>Stage</label>
            <select value={form.stage} onChange={e => setForm({ ...form, stage: e.target.value })} style={iS}>
              {STAGES.map(s => <option key={s} value={s}>{s || "— None —"}</option>)}
            </select>
          </div>
          {form.stage === "Online Assessment Pending" && (
            <div><label style={lS}>Assessment Deadline</label>
              <input type="date" value={form.assessment_deadline} onChange={e => setForm({ ...form, assessment_deadline: e.target.value })} style={iS} />
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div><label style={lS}>Fit</label><select value={form.alignment} onChange={e => setForm({ ...form, alignment: e.target.value })} style={iS}>{ALIGNMENT.map(s => <option key={s} value={s}>{s || "—"}</option>)}</select></div>
            <div><label style={lS}>Priority</label><select value={form.impact} onChange={e => setForm({ ...form, impact: e.target.value })} style={iS}>{IMPACT.map(s => <option key={s} value={s}>{s || "—"}</option>)}</select></div>
            <div><label style={lS}>Date Applied</label><input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={iS} /></div>
          </div>
          <div><label style={lS}>Notes</label><input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional" style={iS} /></div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <button onClick={() => { setModal(false); setEditId(null); }} style={{ padding: "9px 18px", border: "1px solid #e0e0dc", borderRadius: 8, background: "#fff", color: "#666", fontSize: 13, cursor: "pointer" }}>Cancel</button>
          <button onClick={save} style={{ padding: "9px 18px", background: "#0f0f0f", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer" }}>{editId ? "Save Changes" : "Add Application"}</button>
        </div>
      </div>
    </div>
  );

  // ── Applications Table (shared component) ──
  function AppsTable({ apps, showPerson }) {
    const REJECTED_STATUSES = ["Rejected", "Likely Rejected"];
    let sorted = [...apps];
    if (sortMode === "rejected_first") sorted.sort((a, b) => REJECTED_STATUSES.includes(b.status) - REJECTED_STATUSES.includes(a.status));
    else if (sortMode === "rejected_last") sorted.sort((a, b) => REJECTED_STATUSES.includes(a.status) - REJECTED_STATUSES.includes(b.status));
    const f = statusFilter === "All" ? sorted : sorted.filter(a => a.status === statusFilter);
    const counts = STATUSES.reduce((acc, s) => { acc[s] = apps.filter(a => a.status === s).length; return acc; }, {});
    return (
      <>
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setStatusFilter("All")}
            style={{ padding: "5px 14px", borderRadius: 20, border: `1px solid ${statusFilter === "All" ? "#0f0f0f" : "#ddd"}`, background: statusFilter === "All" ? "#0f0f0f" : "#fff", color: statusFilter === "All" ? "#fff" : "#666", fontSize: 12, cursor: "pointer" }}>
            All ({apps.length})
          </button>
          {STATUSES.filter(s => counts[s] > 0).map(s => {
            const c = STATUS_COLORS[s]; const active = statusFilter === s;
            return (
              <button key={s} onClick={() => setStatusFilter(statusFilter === s ? "All" : s)}
                style={{ padding: "5px 14px", borderRadius: 20, border: `1px solid ${active ? c.border : "#ddd"}`, background: active ? c.bg : "#fff", color: active ? c.text : "#666", fontSize: 12, cursor: "pointer" }}>
                {s} ({counts[s]})
              </button>
            );
          })}
          </div>
          {/* Sort controls */}
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "#aaa", marginRight: 4 }}>Sort:</span>
            {[
              { key: "default", label: "Default" },
              { key: "rejected_first", label: "Rejected First" },
              { key: "rejected_last", label: "Rejected Last" },
            ].map(s => (
              <button key={s.key} onClick={() => setSortMode(s.key)}
                style={{ padding: "4px 12px", borderRadius: 16, border: `1px solid ${sortMode === s.key ? "#0f0f0f" : "#ddd"}`, background: sortMode === s.key ? "#0f0f0f" : "#fff", color: sortMode === s.key ? "#fff" : "#666", fontSize: 11, cursor: "pointer" }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        {f.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#aaa", fontSize: 15 }}>
            {tab === "personal" ? "No applications yet. Add your first one →" : "Nothing here yet."}
          </div>
        ) : (
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e8e4", overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #f0f0ec", background: "#fafaf8" }}>
                    {showPerson && <th style={tH}>Person</th>}
                    <th style={tH}>Company</th>
                    <th style={tH}>Role</th>
                    <th style={tH}>Category</th>
                    <th style={tH}>Status</th>
                    <th style={tH}>Stage</th>
                    <th style={tH}>Date</th>
                    <th style={tH}>Notes</th>
                    <th style={{ ...tH, textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {f.map((app, i) => {
                    const sc = STATUS_COLORS[app.status] || {};
                    const appComments = comments[app.id] || [];
                    const expanded = expandedComments[app.id];
                    const isOwner = app.person === myEmail;
                    const isOAPending = app.stage === "Online Assessment Pending";
                    const rs = rowStyle(app, i);
                    return (
                      <>
                        <tr key={app.id} style={{ ...rs, borderBottom: expanded ? "none" : "1px solid #f0f0ec" }}>
                          {showPerson && <td style={tD}><span style={{ fontSize: 12, color: "#888", background: "#f5f5f2", padding: "2px 8px", borderRadius: 4 }}>{displayName(app)}</span></td>}
                          <td style={{ ...tD, fontWeight: 600, color: "#1a1a1a" }}>{app.company}</td>
                          <td style={{ ...tD, color: "#555" }}>{app.role}</td>
                          <td style={tD}>
                            {app.category ? <span style={{ fontSize: 11, color: "#6366f1", background: "#eef2ff", padding: "2px 8px", borderRadius: 4, border: "1px solid #c7d2fe" }}>{app.category}</span> : <span style={{ color: "#ddd" }}>—</span>}
                          </td>
                          <td style={tD}>
                            <span style={{ fontSize: 11, fontWeight: 500, padding: "3px 9px", borderRadius: 12, background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`, whiteSpace: "nowrap" }}>{app.status}</span>
                          </td>
                          <td style={tD}>
                            {app.stage ? (
                              <span style={{ fontSize: 11, color: isOAPending ? "#92400e" : "#555", whiteSpace: "nowrap" }}>
                                {isOAPending ? "⚠️ " : ""}{app.stage}
                              </span>
                            ) : <span style={{ color: "#ddd" }}>—</span>}
                          </td>
                          <td style={{ ...tD, color: "#aaa", fontSize: 12, whiteSpace: "nowrap" }}>{fmt(app.date)}</td>
                          <td style={{ ...tD, color: "#888", fontSize: 12, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={app.notes}>{app.notes || "—"}</td>
                          <td style={{ ...tD, textAlign: "right", whiteSpace: "nowrap" }}>
                            <button onClick={() => setExpandedComments(prev => ({ ...prev, [app.id]: !prev[app.id] }))}
                              style={{ fontSize: 11, color: appComments.length ? "#6366f1" : "#bbb", background: "none", border: "none", cursor: "pointer", marginRight: 8 }}>
                              💬 {appComments.length}
                            </button>
                            {isOwner && <>
                              <button onClick={() => openEdit(app)} style={{ fontSize: 12, color: "#888", background: "none", border: "none", cursor: "pointer", marginRight: 6 }}>Edit</button>
                              <button onClick={() => remove(app.id)} style={{ fontSize: 12, color: "#ef4444", background: "none", border: "none", cursor: "pointer" }}>Delete</button>
                            </>}
                          </td>
                        </tr>
                        {expanded && (
                          <tr key={`${app.id}-c`} style={{ borderBottom: "1px solid #f0f0ec", background: rs.background }}>
                            <td colSpan={showPerson ? 9 : 8} style={{ padding: "12px 20px 16px", background: "rgba(0,0,0,0.02)" }}>
                              <div style={{ fontSize: 11, color: "#999", marginBottom: 8, letterSpacing: "0.1em", textTransform: "uppercase" }}>Comments</div>
                              {appComments.length === 0 && <div style={{ fontSize: 13, color: "#ccc", marginBottom: 10 }}>No comments yet.</div>}
                              {appComments.map(c => (
                                <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, background: "#fff", borderRadius: 8, padding: "8px 12px", border: "1px solid #efefec" }}>
                                  <div>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: "#555", marginRight: 8 }}>{c.author_name || c.author_email.split("@")[0]}</span>
                                    <span style={{ fontSize: 13, color: "#333" }}>{c.text}</span>
                                    <div style={{ fontSize: 11, color: "#ccc", marginTop: 2 }}>{fmt(c.created_at)}</div>
                                  </div>
                                  {isOwner && <button onClick={() => deleteComment(c.id)} style={{ fontSize: 11, color: "#ef4444", background: "none", border: "none", cursor: "pointer", marginLeft: 12, flexShrink: 0 }}>✕</button>}
                                </div>
                              ))}
                              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                                <input value={commentText[app.id] || ""} onChange={e => setCommentText(prev => ({ ...prev, [app.id]: e.target.value }))}
                                  onKeyDown={e => e.key === "Enter" && postComment(app.id)} placeholder="Add a comment…"
                                  style={{ flex: 1, border: "1px solid #e0e0dc", borderRadius: 6, padding: "7px 12px", fontSize: 13, outline: "none", fontFamily: "Georgia, serif", background: "#fff" }} />
                                <button onClick={() => postComment(app.id)} style={{ padding: "7px 16px", background: "#0f0f0f", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, cursor: "pointer" }}>Post</button>
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
          </div>
        )}
      </>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#fafaf8", fontFamily: "'Georgia', serif" }}>
      {/* Nav */}
      <div style={{ background: "#0f0f0f", padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ color: "#fff", fontSize: 15, letterSpacing: "0.05em", marginRight: 20 }}>AppTrackr</span>
          {[
            { key: "personal", label: "My Tracker" },
            { key: "shared", label: `Shared With Me${sharedWithMe.length ? ` (${sharedWithMe.length})` : ""}` },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ padding: "6px 16px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 13, background: tab === t.key ? "#fff" : "transparent", color: tab === t.key ? "#0f0f0f" : "#777", transition: "all 0.15s" }}>
              {t.label}
            </button>
          ))}
          {(tab === "total" || sharedWithMe.some(s => s.owner_email === tab)) && (
            <>
              <span style={{ color: "#444", margin: "0 8px" }}>|</span>
              <button onClick={() => setTab("shared")} style={{ background: "none", border: "none", color: "#666", fontSize: 13, cursor: "pointer" }}>← Back</button>
              <span style={{ color: "#888", fontSize: 13, marginLeft: 8 }}>
                {tab === "total" ? "Total View" : `${tab.split("@")[0]}'s Tracker`}
              </span>
            </>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={() => setShareModal(true)} style={{ padding: "6px 16px", borderRadius: 6, border: "1px solid #444", background: "transparent", color: "#ccc", fontSize: 13, cursor: "pointer" }}>
            Share Tracker
          </button>
          {notifBell}
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>

        {/* ── PERSONAL TRACKER TAB ── */}
        {tab === "personal" && (
          <>
            {/* Stats summary bar */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 28 }}>
              {[
                { label: "Total Applied", value: totalApplied, color: "#1a1a1a" },
                { label: "Rejected", value: totalRejected, color: "#ef4444" },
                { label: "Interviews", value: totalInterviews, color: "#1d4ed8" },
                { label: "Offers", value: totalOffers, color: "#166534" },
                { label: "Success Rate", value: `${successRate}%`, color: "#166534" },
                { label: "Rejected Rate", value: `${rejectedRate}%`, color: "#ef4444" },
              ].map(s => (
                <div key={s.label} style={{ background: "#fff", border: "1px solid #e8e8e4", borderRadius: 12, padding: "14px 18px", textAlign: "center" }}>
                  <div style={{ fontSize: 26, fontWeight: 400, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: "#aaa", marginTop: 4, letterSpacing: "0.05em" }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Assessment Deadlines Table */}
            {oaPending.length > 0 && (
              <div style={{ background: "#fff", border: "1px solid #fcd88a", borderRadius: 12, marginBottom: 28, overflow: "hidden" }}>
                <div style={{ padding: "14px 20px", background: "#fffbeb", borderBottom: "1px solid #fcd88a", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 16 }}>⚠️</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#92400e" }}>Assessment Deadlines</span>
                  <span style={{ fontSize: 12, color: "#b45309", marginLeft: 4 }}>— click to set or update a deadline</span>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #fef3e2", background: "#fffdf5" }}>
                      <th style={{ ...tH, color: "#92400e" }}>Company</th>
                      <th style={{ ...tH, color: "#92400e" }}>Role</th>
                      <th style={{ ...tH, color: "#92400e" }}>Category</th>
                      <th style={{ ...tH, color: "#92400e" }}>Deadline</th>
                      <th style={{ ...tH, color: "#92400e" }}>Days Left</th>
                    </tr>
                  </thead>
                  <tbody>
                    {oaPending.map((app, i) => {
                      const days = daysUntil(app.assessment_deadline);
                      const editing = deadlineEdits[app.id] !== undefined;
                      const urgentColor = days !== null && days <= 3 ? "#ef4444" : days !== null && days <= 7 ? "#f59e0b" : "#166534";
                      return (
                        <tr key={app.id} style={{ borderBottom: "1px solid #fef3e2", background: i % 2 === 0 ? "#fff" : "#fffdf7" }}>
                          <td style={{ ...tD, fontWeight: 600 }}>{app.company}</td>
                          <td style={{ ...tD, color: "#555" }}>{app.role}</td>
                          <td style={tD}>{app.category ? <span style={{ fontSize: 11, color: "#6366f1", background: "#eef2ff", padding: "2px 8px", borderRadius: 4 }}>{app.category}</span> : <span style={{ color: "#ddd" }}>—</span>}</td>
                          <td style={tD}>
                            {editing ? (
                              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                <input type="date" value={deadlineEdits[app.id]}
                                  onChange={e => setDeadlineEdits(prev => ({ ...prev, [app.id]: e.target.value }))}
                                  style={{ ...iS, width: "auto", padding: "4px 8px", fontSize: 12 }} />
                                <button onClick={() => saveDeadline(app.id, deadlineEdits[app.id])}
                                  style={{ padding: "4px 10px", background: "#0f0f0f", color: "#fff", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>Save</button>
                                <button onClick={() => setDeadlineEdits(prev => { const n = { ...prev }; delete n[app.id]; return n; })}
                                  style={{ padding: "4px 10px", background: "none", border: "1px solid #ddd", borderRadius: 6, fontSize: 11, cursor: "pointer", color: "#888" }}>Cancel</button>
                              </div>
                            ) : (
                              <button onClick={() => setDeadlineEdits(prev => ({ ...prev, [app.id]: app.assessment_deadline || "" }))}
                                style={{ background: "none", border: "1px dashed #fcd88a", borderRadius: 6, padding: "3px 10px", fontSize: 12, color: app.assessment_deadline ? "#333" : "#bbb", cursor: "pointer" }}>
                                {app.assessment_deadline ? fmt(app.assessment_deadline) : "Set deadline"}
                              </button>
                            )}
                          </td>
                          <td style={tD}>
                            {days !== null ? (
                              <span style={{ fontSize: 13, fontWeight: 600, color: urgentColor }}>
                                {days < 0 ? "Expired" : days === 0 ? "Today!" : `${days}d`}
                              </span>
                            ) : <span style={{ color: "#ccc", fontSize: 12 }}>No deadline set</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* My tracker header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 11, letterSpacing: "0.25em", color: "#aaa", textTransform: "uppercase", marginBottom: 6 }}>{myName}</div>
                <div style={{ fontSize: 28, color: "#1a1a1a", fontWeight: 400 }}>{myApps.length} Application{myApps.length !== 1 ? "s" : ""}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {/* Legend */}
                <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#888", alignItems: "center" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "#fff1f1", border: "1px solid #fca5a5", display: "inline-block" }} />Rejected</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "#fff7ed", border: "1px solid #fdba74", display: "inline-block" }} />Likely Rejected</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "#fffbeb", border: "1px solid #fcd88a", display: "inline-block" }} />⚠️ OA Pending</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "#eff6ff", border: "1px solid #93c5fd", display: "inline-block" }} />Interview</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "#f5f3ff", border: "1px solid #c4b5fd", display: "inline-block" }} />Event</span>
                </div>
                <button onClick={() => { setForm(EMPTY_FORM); setEditId(null); setModal(true); }}
                  style={{ padding: "10px 22px", background: "#0f0f0f", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, cursor: "pointer" }}>
                  + Add Application
                </button>
              </div>
            </div>
            <AppsTable apps={myApps} showPerson={false} />
          </>
        )}

        {/* ── SHARED WITH ME TAB ── */}
        {tab === "shared" && (
          <>
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 11, letterSpacing: "0.25em", color: "#aaa", textTransform: "uppercase", marginBottom: 6 }}>Shared With Me</div>
              <div style={{ fontSize: 30, color: "#1a1a1a", fontWeight: 400 }}>Your Network</div>
            </div>
            {sharedWithMe.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#aaa", fontSize: 15 }}>
                No one has shared their tracker with you yet.<br />
                <button onClick={() => setShareModal(true)} style={{ marginTop: 16, padding: "9px 20px", background: "#0f0f0f", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer" }}>
                  Share Your Tracker
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                  <div style={{ background: "#fff", borderRadius: 16, padding: "24px 28px", border: "1px solid #e8e8e4" }}>
                    <div style={{ fontSize: 11, color: "#aaa", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 20 }}>Applications by Person</div>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={barData} barCategoryGap="30%">
                        <XAxis dataKey="name" tick={{ fontSize: 11, fontFamily: "Georgia, serif", fill: "#aaa" }} axisLine={false} tickLine={false} />
                        <YAxis hide />
                        <Tooltip contentStyle={{ fontFamily: "Georgia, serif", fontSize: 12, border: "1px solid #e8e8e4", borderRadius: 8 }} formatter={v => [v, "Applications"]} />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                          {barData.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e8e8e4", overflow: "hidden" }}>
                    <div style={{ padding: "14px 22px", borderBottom: "1px solid #f0f0ec", fontSize: 11, color: "#aaa", letterSpacing: "0.1em", textTransform: "uppercase" }}>Recent Activity</div>
                    <div style={{ maxHeight: 220, overflowY: "auto" }}>
                      {activity.length === 0 ? (
                        <div style={{ padding: "24px", fontSize: 13, color: "#ccc", textAlign: "center" }}>No activity yet.</div>
                      ) : activity.map((a, i) => {
                        const name = displayName(a); const isMe = a.person === myEmail; const sc = STATUS_COLORS[a.status] || {};
                        return (
                          <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 18px", borderBottom: i < activity.length - 1 ? "1px solid #f5f5f2" : "none" }}>
                            <div style={{ width: 26, height: 26, borderRadius: "50%", background: isMe ? "#0f0f0f" : BAR_COLORS[1], display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, flexShrink: 0 }}>
                              {name[0].toUpperCase()}
                            </div>
                            <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: "#555", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              <span style={{ fontWeight: 600, color: "#333" }}>{isMe ? "You" : name}</span> → {a.company}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                              <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 10, background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>{a.status}</span>
                              <span style={{ fontSize: 10, color: "#ccc" }}>{timeAgo(a.created_at)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 11, letterSpacing: "0.2em", color: "#aaa", textTransform: "uppercase", marginBottom: 10 }}>Trackers</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10, marginBottom: 16 }}>
                  <div onClick={() => { setTab("total"); loadViewApps("total"); }}
                    style={{ background: "#0f0f0f", borderRadius: 14, padding: "16px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#333", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13 }}>⊕</div>
                    <div><div style={{ fontSize: 13, color: "#fff" }}>Total View</div><div style={{ fontSize: 11, color: "#555", marginTop: 1 }}>Everyone combined</div></div>
                  </div>
                  {sharedWithMe.map((s, i) => {
                    const label = s.owner_email.split("@")[0];
                    return (
                      <div key={s.owner_email} onClick={() => { setTab(s.owner_email); loadViewApps(s.owner_email); }}
                        style={{ background: "#fff", border: "1px solid #e8e8e4", borderRadius: 14, padding: "16px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}
                        onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.07)"}
                        onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: BAR_COLORS[(i + 1) % BAR_COLORS.length], display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13 }}>
                          {label[0].toUpperCase()}
                        </div>
                        <div><div style={{ fontSize: 13, color: "#1a1a1a" }}>{label}'s Tracker</div><div style={{ fontSize: 11, color: "#bbb", marginTop: 1 }}>{s.owner_email}</div></div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

        {/* ── INDIVIDUAL / TOTAL VIEW ── */}
        {(tab === "total" || sharedWithMe.some(s => s.owner_email === tab)) && (() => {
          const vTotal = viewingApps.length;
          const vRejected = viewingApps.filter(a => a.status === "Rejected" || a.status === "Likely Rejected").length;
          const vOffers = viewingApps.filter(a => a.status === "Offer").length;
          const vInterviews = viewingApps.filter(a => a.status === "Interview").length;
          const vSuccess = vTotal > 0 ? Math.round((vOffers / vTotal) * 100) : 0;
          const vRejectedRate = vTotal > 0 ? Math.round((vRejected / vTotal) * 100) : 0;
          const vOaPending = viewingApps.filter(a => a.stage === "Online Assessment Pending");
          return (
            <>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, letterSpacing: "0.25em", color: "#aaa", textTransform: "uppercase", marginBottom: 6 }}>
                  {tab === "total" ? "Everyone Combined" : `${tab.split("@")[0]}'s Tracker`}
                </div>
                <div style={{ fontSize: 28, color: "#1a1a1a", fontWeight: 400 }}>{vTotal} Application{vTotal !== 1 ? "s" : ""}</div>
              </div>
              {/* Stats bar */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 24 }}>
                {[
                  { label: "Total Applied", value: vTotal, color: "#1a1a1a" },
                  { label: "Rejected", value: vRejected, color: "#ef4444" },
                  { label: "Interviews", value: vInterviews, color: "#1d4ed8" },
                  { label: "Offers", value: vOffers, color: "#166534" },
                  { label: "Success Rate", value: `${vSuccess}%`, color: "#166534" },
                  { label: "Rejected Rate", value: `${vRejectedRate}%`, color: "#ef4444" },
                ].map(s => (
                  <div key={s.label} style={{ background: "#fff", border: "1px solid #e8e8e4", borderRadius: 12, padding: "14px 18px", textAlign: "center" }}>
                    <div style={{ fontSize: 26, fontWeight: 400, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: "#aaa", marginTop: 4, letterSpacing: "0.05em" }}>{s.label}</div>
                  </div>
                ))}
              </div>
              {/* OA Deadlines */}
              {vOaPending.length > 0 && (
                <div style={{ background: "#fff", border: "1px solid #fcd88a", borderRadius: 12, marginBottom: 24, overflow: "hidden" }}>
                  <div style={{ padding: "14px 20px", background: "#fffbeb", borderBottom: "1px solid #fcd88a", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16 }}>⚠️</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#92400e" }}>Assessment Deadlines</span>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #fef3e2", background: "#fffdf5" }}>
                        <th style={{ ...tH, color: "#92400e" }}>Company</th>
                        <th style={{ ...tH, color: "#92400e" }}>Role</th>
                        <th style={{ ...tH, color: "#92400e" }}>Deadline</th>
                        <th style={{ ...tH, color: "#92400e" }}>Days Left</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vOaPending.map((app, i) => {
                        const days = daysUntil(app.assessment_deadline);
                        const urgentColor = days !== null && days <= 3 ? "#ef4444" : days !== null && days <= 7 ? "#f59e0b" : "#166534";
                        return (
                          <tr key={app.id} style={{ borderBottom: "1px solid #fef3e2", background: i % 2 === 0 ? "#fff" : "#fffdf7" }}>
                            <td style={{ ...tD, fontWeight: 600 }}>{app.company}</td>
                            <td style={{ ...tD, color: "#555" }}>{app.role}</td>
                            <td style={tD}>{app.assessment_deadline ? fmt(app.assessment_deadline) : <span style={{ color: "#ccc" }}>Not set</span>}</td>
                            <td style={tD}>
                              {days !== null ? (
                                <span style={{ fontSize: 13, fontWeight: 600, color: urgentColor }}>
                                  {days < 0 ? "Expired" : days === 0 ? "Today!" : `${days}d`}
                                </span>
                              ) : <span style={{ color: "#ccc", fontSize: 12 }}>—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <AppsTable apps={viewingApps} showPerson={tab === "total"} />
            </>
          );
        })()}
      </div>

      {appModal}
      {shareModalJsx}
    </div>
  );
}

const tH = { padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 500, color: "#aaa", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "Georgia, serif", whiteSpace: "nowrap" };
const tD = { padding: "11px 14px", fontSize: 13, fontFamily: "Georgia, serif", verticalAlign: "middle" };
const lS = { display: "block", fontSize: 11, color: "#999", marginBottom: 5, letterSpacing: "0.05em" };
const iS = { width: "100%", border: "1px solid #e0e0dc", borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none", fontFamily: "Georgia, serif", background: "#fff", boxSizing: "border-box" };
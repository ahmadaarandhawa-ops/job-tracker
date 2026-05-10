import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const SUPABASE_URL = "https://pvjmzycmvavmntbmudbc.supabase.co";
const SUPABASE_KEY = "sb_publishable_Zoq88wvCDawDQET4LpAj4w_Mw6vDgRr";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const STATUSES = ["Applied", "Interview", "Offer", "Rejected", "Withdrawn"];
const CHANCES = ["Why did I apply", "No Chance", "Maybe", "Good Chance"];
const TYPES = ["Internship", "Graduate Scheme", "Placement", "Event", "Other"];
const ROUNDS = ["Applied", "Online Test", "HireVue", "Phone Screen", "Assessment Centre", "Final Round", "Offer"];
const ALIGNMENTS = ["Not Aligned", "Somewhat", "Aligned", "Strongly Aligned"];
const IMPACTS = ["Low", "Medium", "High", "Very High"];

const STATUS_STYLES = {
  Applied: "bg-blue-100 text-blue-800",
  Interview: "bg-yellow-100 text-yellow-800",
  Offer: "bg-green-100 text-green-800",
  Rejected: "bg-red-100 text-red-800",
  Withdrawn: "bg-gray-100 text-gray-700",
};
const CHANCE_STYLES = {
  "Why did I apply": "bg-purple-100 text-purple-800",
  "No Chance": "bg-red-100 text-red-700",
  "Maybe": "bg-yellow-100 text-yellow-800",
  "Good Chance": "bg-green-100 text-green-800",
};
const ROUND_STYLES = {
  "Applied": "bg-gray-100 text-gray-600",
  "Online Test": "bg-blue-100 text-blue-700",
  "HireVue": "bg-indigo-100 text-indigo-700",
  "Phone Screen": "bg-cyan-100 text-cyan-700",
  "Assessment Centre": "bg-orange-100 text-orange-700",
  "Final Round": "bg-purple-100 text-purple-800",
  "Offer": "bg-green-100 text-green-800",
};
const ALIGNMENT_STYLES = {
  "Not Aligned": "bg-red-100 text-red-700",
  "Somewhat": "bg-yellow-100 text-yellow-700",
  "Aligned": "bg-blue-100 text-blue-700",
  "Strongly Aligned": "bg-green-100 text-green-800",
};
const IMPACT_STYLES = {
  "Low": "bg-gray-100 text-gray-600",
  "Medium": "bg-yellow-100 text-yellow-700",
  "High": "bg-orange-100 text-orange-700",
  "Very High": "bg-green-100 text-green-800",
};
const COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];
const EMPTY = { company: "", role: "", status: "Applied", date: "", notes: "", chance: "", type: "", type_custom: "", round: "", alignment: "", impact: "" };

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>
        <p style={{ fontWeight: 600, marginBottom: 4 }}>{label}</p>
        <p style={{ color: "#6366f1" }}>{d.applications} applications</p>
        {d.rejectionPct > 0 && <p style={{ color: "#ef4444" }}>{d.rejectionPct}% rejected</p>}
      </div>
    );
  }
  return null;
};

function fmtDateTime(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmt(d) {
  if (!d) return "—";
  const [y, m, dd] = d.split("-");
  return `${dd}/${m}/${y}`;
}

export default function App() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("home");
  const [filter, setFilter] = useState("All");
  const [modal, setModal] = useState(false);
  const [newTrackerModal, setNewTrackerModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const { data } = await supabase.from("applications").select("*").order("created_at", { ascending: false });
    setApps(data || []);
    setLoading(false);
  }

  const people = [...new Set(apps.map(a => a.person))];
  const currentApps = view === "total" ? apps : apps.filter(a => a.person === view);
  const filtered = filter === "All" ? currentApps : currentApps.filter(a => a.status === filter);

  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = currentApps.filter(a => a.status === s).length;
    return acc;
  }, {});

  const chartData = people.map(person => {
    const personApps = apps.filter(a => a.person === person);
    const rejected = personApps.filter(a => a.status === "Rejected").length;
    return {
      name: person,
      applications: personApps.length,
      rejectionPct: personApps.length > 0 ? Math.round((rejected / personApps.length) * 100) : 0,
    };
  });

  const lastApp = apps[0];

  function openAdd() { setForm(EMPTY); setEditId(null); setModal(true); }

  function openEdit(app) {
    setForm({
      company: app.company || "",
      role: app.role || "",
      status: app.status || "Applied",
      date: app.date || "",
      notes: app.notes || "",
      chance: app.chance || "",
      type: app.type || "",
      type_custom: app.type_custom || "",
      round: app.round || "",
      alignment: app.alignment || "",
      impact: app.impact || "",
    });
    setEditId(app.id);
    setModal(true);
  }

  async function save() {
    if (!form.company || !form.role) return;
    setSaving(true);
    const payload = { ...form };
    if (form.type !== "Other") payload.type_custom = "";

    let error;
    if (editId) {
      const res = await supabase.from("applications").update(payload).eq("id", editId);
      error = res.error;
    } else {
      const res = await supabase.from("applications").insert({ ...payload, person: view });
      error = res.error;
    }

    setSaving(false);
    if (error) {
      alert("Save failed: " + error.message);
      return;
    }
    setModal(false);
    setEditId(null);
    fetchAll();
  }

  async function remove(id) {
    if (!confirm("Delete this application?")) return;
    await supabase.from("applications").delete().eq("id", id);
    fetchAll();
  }

  function createTracker() {
    const name = newName.trim();
    if (!name) return;
    setNewTrackerModal(false);
    setNewName("");
    setView(name);
  }

  function displayType(app) {
    if (!app.type) return null;
    return app.type === "Other" && app.type_custom ? app.type_custom : app.type;
  }

  if (view === "home") {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-semibold text-gray-900">Job Trackers</h1>
            <p className="text-sm text-gray-500 mt-1">Click a tracker to view or add applications</p>
          </div>

          {lastApp && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-4 mb-6 flex items-center gap-3">
              <span className="text-2xl">🔔</span>
              <p className="text-sm text-indigo-900">
                <span className="font-semibold">{lastApp.person}</span> just applied to{" "}
                <span className="font-semibold">{lastApp.company}</span> for{" "}
                <span className="font-semibold">{lastApp.role}</span>
              </p>
            </div>
          )}

          {chartData.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6">
              <p className="text-sm font-medium text-gray-700 mb-1">Applications per person</p>
              <p className="text-xs text-gray-400 mb-4">Hover to see rejection rate</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} barSize={40}>
                  <XAxis dataKey="name" tick={{ fontSize: 13 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f3f4f6" }} />
                  <Bar dataKey="applications" radius={[6, 6, 0, 0]}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-3 flex-wrap">
                {chartData.map((d, i) => d.rejectionPct > 0 && (
                  <span key={i} className="text-xs text-red-500 font-medium">{d.name}: {d.rejectionPct}% rejected</span>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            <div onClick={() => setView("total")} className="bg-gray-900 text-white rounded-2xl p-5 cursor-pointer hover:bg-gray-700 transition-all">
              <p className="text-xs font-medium opacity-60 mb-1">Combined</p>
              <p className="text-xl font-semibold">Total Tracker</p>
              <p className="text-sm opacity-60 mt-2">{apps.length} applications across everyone</p>
            </div>
            {people.map(person => {
              const personApps = apps.filter(a => a.person === person);
              return (
                <div key={person} onClick={() => setView(person)} className="bg-white border border-gray-200 rounded-2xl p-5 cursor-pointer hover:border-gray-400 hover:shadow-sm transition-all">
                  <p className="text-xs text-gray-400 mb-1">Personal tracker</p>
                  <p className="text-xl font-semibold text-gray-900">{person}'s Tracker</p>
                  <div className="flex gap-3 mt-3 flex-wrap">
                    {STATUSES.filter(s => personApps.some(a => a.status === s)).map(s => (
                      <span key={s} className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[s]}`}>
                        {personApps.filter(a => a.status === s).length} {s}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
            <div onClick={() => setNewTrackerModal(true)} className="border-2 border-dashed border-gray-200 rounded-2xl p-5 cursor-pointer hover:border-gray-400 transition-all flex flex-col items-center justify-center text-gray-400 hover:text-gray-600 min-h-[120px]">
              <p className="text-2xl mb-1">+</p>
              <p className="text-sm font-medium">New tracker</p>
            </div>
          </div>

          {apps.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-700">Activity Log</p>
                <p className="text-xs text-gray-400 mt-0.5">Every application in order of when it was added</p>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Person</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Applied to</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Role</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Status</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Added at</th>
                  </tr>
                </thead>
                <tbody>
                  {apps.map((app, i) => (
                    <tr key={app.id} className={`border-t border-gray-100 hover:bg-gray-50 ${i === 0 ? "border-t-0" : ""}`}>
                      <td className="px-5 py-3 font-medium text-gray-900">{app.person}</td>
                      <td className="px-5 py-3 text-gray-700">{app.company}</td>
                      <td className="px-5 py-3 text-gray-500">{app.role}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_STYLES[app.status]}`}>{app.status}</span>
                      </td>
                      <td className="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">{fmtDateTime(app.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {newTrackerModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 w-full max-w-sm">
              <h2 className="text-base font-semibold mb-4">Create your tracker</h2>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400" placeholder="Your name (e.g. Ahmad)" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === "Enter" && createTracker()} autoFocus />
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setNewTrackerModal(false)} className="text-sm px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
                <button onClick={createTracker} className="text-sm px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-700">Create</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => { setView("home"); setFilter("All"); }} className="text-sm text-gray-400 hover:text-gray-700">← Home</button>
          <span className="text-gray-300">/</span>
          <h1 className="text-2xl font-semibold text-gray-900">{view === "total" ? "Total Tracker" : `${view}'s Tracker`}</h1>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          {STATUSES.map(s => (
            <div key={s} className="bg-white rounded-xl border border-gray-200 p-3">
              <p className="text-xs text-gray-500">{s}</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">{counts[s]}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex gap-2 flex-wrap">
            {["All", ...STATUSES].map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`text-sm px-3 py-1.5 rounded-full border transition-all ${filter === f ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}>{f}</button>
            ))}
          </div>
          {view !== "total" && (
            <button onClick={openAdd} className="text-sm px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-all">+ Add application</button>
          )}
        </div>
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <table className="text-sm" style={{width:"100%", tableLayout:"fixed"}}>
            <colgroup>
              {view === "total" && <col style={{width:"90px"}}/>}
              <col style={{width:"130px"}}/>
              <col style={{width:"160px"}}/>
              <col style={{width:"100px"}}/>
              <col style={{width:"90px"}}/>
              <col style={{width:"130px"}}/>
              <col style={{width:"110px"}}/>
              <col style={{width:"120px"}}/>
              <col style={{width:"90px"}}/>
              <col style={{width:"95px"}}/>
              <col style={{width:"130px"}}/>
              <col style={{width:"80px"}}/>
            </colgroup>
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {view === "total" && <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Person</th>}
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Company</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Role</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Type</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Status</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Round</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Chance</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Values</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Impact</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Date</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Notes</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={12} className="text-center py-12 text-gray-400">Loading...</td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={12} className="text-center py-12 text-gray-400">No applications yet</td></tr>}
              {filtered.map((app, i) => {
                const isRejected = app.status === "Rejected";
                return (
                  <tr key={app.id} className={`border-t border-gray-100 ${i === 0 ? "border-t-0" : ""} ${isRejected ? "bg-red-50 hover:bg-red-100" : "hover:bg-gray-50"}`}>
                    {view === "total" && <td className="px-3 py-2 font-medium text-gray-700 truncate">{app.person}</td>}
                    <td className={`px-3 py-2 font-medium truncate ${isRejected ? "text-red-800 line-through" : "text-gray-900"}`} title={app.company}>{app.company}</td>
                    <td className={`px-3 py-2 truncate ${isRejected ? "text-red-600 line-through" : "text-gray-600"}`} title={app.role}>{app.role}</td>
                    <td className="px-3 py-2">
                      {displayType(app) ? <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 truncate block w-fit max-w-full">{displayType(app)}</span> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2"><span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_STYLES[app.status]}`}>{app.status}</span></td>
                    <td className="px-3 py-2">
                      {app.round ? <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${ROUND_STYLES[app.round] || "bg-gray-100 text-gray-600"}`}>{app.round}</span> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      {app.chance ? <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${CHANCE_STYLES[app.chance] || "bg-gray-100 text-gray-600"}`}>{app.chance}</span> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      {app.alignment ? <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${ALIGNMENT_STYLES[app.alignment] || "bg-gray-100 text-gray-600"}`}>{app.alignment}</span> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      {app.impact ? <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${IMPACT_STYLES[app.impact] || "bg-gray-100 text-gray-600"}`}>{app.impact}</span> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap text-xs">{fmt(app.date)}</td>
                    <td className="px-3 py-2 text-gray-500 truncate text-xs" title={app.notes}>{app.notes || "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1 justify-end">
                        {view !== "total" && <button onClick={() => openEdit(app)} className="text-xs text-gray-400 hover:text-gray-700 whitespace-nowrap">Edit</button>}
                        <button onClick={() => remove(app.id)} className="text-xs text-red-400 hover:text-red-600 whitespace-nowrap">Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 w-full max-w-md shadow-xl my-8">
            <h2 className="text-base font-semibold mb-4">{editId ? "Edit application" : "Add application"}</h2>
            <div className="space-y-3">
              <div><label className="block text-xs text-gray-500 mb-1">Company *</label><input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} placeholder="e.g. Google" /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Role *</label><input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} placeholder="e.g. Software Engineer" /></div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Type</label>
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  <option value="">— Select —</option>
                  {TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              {form.type === "Other" && (
                <div><label className="block text-xs text-gray-500 mb-1">Custom type</label><input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400" value={form.type_custom} onChange={e => setForm({ ...form, type_custom: e.target.value })} placeholder="e.g. Spring Week" /></div>
              )}
              <div><label className="block text-xs text-gray-500 mb-1">Status</label><select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Round</label>
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400" value={form.round} onChange={e => setForm({ ...form, round: e.target.value })}>
                  <option value="">— Select —</option>
                  {ROUNDS.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Chance</label>
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400" value={form.chance} onChange={e => setForm({ ...form, chance: e.target.value })}>
                  <option value="">— Select —</option>
                  {CHANCES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Values Alignment</label>
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400" value={form.alignment} onChange={e => setForm({ ...form, alignment: e.target.value })}>
                  <option value="">— Select —</option>
                  {ALIGNMENTS.map(a => <option key={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Potential for Impact</label>
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400" value={form.impact} onChange={e => setForm({ ...form, impact: e.target.value })}>
                  <option value="">— Select —</option>
                  {IMPACTS.map(i => <option key={i}>{i}</option>)}
                </select>
              </div>
              <div><label className="block text-xs text-gray-500 mb-1">Date applied</label><input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Notes</label><input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional" /></div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => { setModal(false); setEditId(null); }} className="text-sm px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={save} disabled={saving} className="text-sm px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50">
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
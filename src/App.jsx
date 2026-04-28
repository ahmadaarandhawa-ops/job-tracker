import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://pvjmzycmvavmntbmudbc.supabase.co";
const SUPABASE_KEY = "sb_publishable_Zoq88wvCDawDQET4LpAj4w_Mw6vDgRr";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const STATUSES = ["Applied", "Interview", "Offer", "Rejected", "Withdrawn"];
const STATUS_STYLES = {
  Applied: "bg-blue-100 text-blue-800",
  Interview: "bg-yellow-100 text-yellow-800",
  Offer: "bg-green-100 text-green-800",
  Rejected: "bg-red-100 text-red-800",
  Withdrawn: "bg-gray-100 text-gray-700",
};
const EMPTY = { company: "", role: "", status: "Applied", date: "", notes: "" };

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

  function openAdd() { setForm(EMPTY); setEditId(null); setModal(true); }

  function openEdit(app) {
    setForm({ company: app.company, role: app.role, status: app.status, date: app.date || "", notes: app.notes || "" });
    setEditId(app.id);
    setModal(true);
  }

  async function save() {
    if (!form.company || !form.role) return;
    if (editId) {
      await supabase.from("applications").update(form).eq("id", editId);
    } else {
      await supabase.from("applications").insert({ ...form, person: view });
    }
    setModal(false);
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

  function fmt(d) {
    if (!d) return "—";
    const [y, m, dd] = d.split("-");
    return `${dd}/${m}/${y}`;
  }

  if (view === "home") {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-semibold text-gray-900">Job Trackers</h1>
            <p className="text-sm text-gray-500 mt-1">Click a tracker to view or add applications</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
      <div className="max-w-5xl mx-auto">
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
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {view === "total" && <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Person</th>}
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Company</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Role</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Date</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Notes</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="text-center py-12 text-gray-400">Loading...</td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={7} className="text-center py-12 text-gray-400">No applications yet</td></tr>}
              {filtered.map((app, i) => (
                <tr key={app.id} className={`border-t border-gray-100 hover:bg-gray-50 ${i === 0 ? "border-t-0" : ""}`}>
                  {view === "total" && <td className="px-4 py-3 font-medium text-gray-700">{app.person}</td>}
                  <td className="px-4 py-3 font-medium text-gray-900">{app.company}</td>
                  <td className="px-4 py-3 text-gray-600">{app.role}</td>
                  <td className="px-4 py-3"><span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_STYLES[app.status]}`}>{app.status}</span></td>
                  <td className="px-4 py-3 text-gray-500">{fmt(app.date)}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{app.notes || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      {view !== "total" && <button onClick={() => openEdit(app)} className="text-xs text-gray-400 hover:text-gray-700">Edit</button>}
                      <button onClick={() => remove(app.id)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 w-full max-w-md shadow-xl">
            <h2 className="text-base font-semibold mb-4">{editId ? "Edit application" : "Add application"}</h2>
            <div className="space-y-3">
              <div><label className="block text-xs text-gray-500 mb-1">Company *</label><input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} placeholder="e.g. Google" /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Role *</label><input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} placeholder="e.g. Software Engineer" /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Status</label><select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></div>
              <div><label className="block text-xs text-gray-500 mb-1">Date applied</label><input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Notes</label><input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional" /></div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setModal(false)} className="text-sm px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={save} className="text-sm px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-700">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
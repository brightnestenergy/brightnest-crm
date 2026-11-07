import { useEffect, useState, useMemo } from 'react'
import { supabase } from './supabase'
import { LayoutDashboard, Users, Plus, LogOut, RefreshCw, Search, Filter, MapPin, Phone, Mail, Calendar, CheckCircle2, AlertCircle, FileText, Printer, Package, Home } from 'lucide-react'

const PIPELINE = [
  { id: 'new', label: 'New', color: 'bg-blue-100 text-blue-800' },
  { id: 'contacted', label: 'Contacted', color: 'bg-amber-100 text-amber-800' },
  { id: 'qualified', label: 'Qualified', color: 'bg-indigo-100 text-indigo-800' },
  { id: 'site_inspection', label: 'Site Inspection', color: 'bg-purple-100 text-purple-800' },
  { id: 'proposal', label: 'Proposal', color: 'bg-teal-100 text-teal-800' },
  { id: 'closed_won', label: 'Closed Won', color: 'bg-emerald-100 text-emerald-800' },
  { id: 'deposit', label: 'Deposit', color: 'bg-green-100 text-green-800' },
  { id: 'design', label: 'Design', color: 'bg-pink-100 text-pink-800' },
  { id: 'dnsp', label: 'DNSP Application', color: 'bg-cyan-100 text-cyan-800' },
  { id: 'install_scheduled', label: 'Install Scheduled', color: 'bg-orange-100 text-orange-800' },
  { id: 'installed', label: 'Installed', color: 'bg-violet-100 text-violet-800' },
  { id: 'compliance', label: 'Compliance', color: 'bg-slate-100 text-slate-800' },
  { id: 'stc', label: 'STC / Rebate', color: 'bg-lime-100 text-lime-800' },
  { id: 'handover', label: 'Handover', color: 'bg-emerald-200 text-emerald-900' },
  { id: 'lost', label: 'Lost', color: 'bg-red-100 text-red-800' },
]

function isTooFar(postcode, suburb) {
  const pc = String(postcode || '').trim()
  if (!pc) return false
  const n = parseInt(pc, 10)
  if (n && (n < 3000 || n > 3999)) return true
  const farKw = ['ballarat','geelong','bendigo','gippsland','warrnambool','mildura','shepparton','traralgon','morwell','bairnsdale']
  return farKw.some(k => (suburb || '').toLowerCase().includes(k))
}

function daysSince(dateStr) {
  if (!dateStr) return 0
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

export default function App() {
  const [session, setSession] = useState(null)
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [view, setView] = useState('dashboard')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [tooFarOnly, setTooFarOnly] = useState(false)
  const [selected, setSelected] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({})
  const [showQuote, setShowQuote] = useState(null) // lead to quote for

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => { if (session) loadLeads() }, [session])

  async function loadLeads() {
    const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false })
    if (!error && data) {
      // Auto-mark old pending as lost
      const updated = data.map(l => {
        if (['new','contacted','qualified','followup'].includes(l.status) && daysSince(l.created_at) > 14 && !l.signed_in_greensketch) {
          return { ...l, status: 'lost', needs_follow_up: false }
        }
        return l
      })
      setLeads(updated)
    }
  }

  async function syncFromSheet() {
    setSyncing(true)
    try {
      const { data, error } = await supabase.functions.invoke('sync-leads')
      if (error) throw error
      alert(`Sync complete. ${data?.added || 0} new leads added.`)
      loadLeads()
    } catch (e) {
      alert('Sync requires the Edge Function to be deployed. Use CSV import for now or deploy the function.')
    }
    setSyncing(false)
  }

  async function saveLead(lead) {
    const payload = {
      ...lead,
      too_far: isTooFar(lead.postcode, lead.suburb),
      updated_at: new Date().toISOString(),
    }
    if (lead.id) {
      await supabase.from('leads').update(payload).eq('id', lead.id)
    } else {
      payload.status = payload.status || 'new'
      payload.needs_follow_up = true
      await supabase.from('leads').insert(payload)
    }
    setShowForm(false)
    setSelected(null)
    loadLeads()
  }

  async function updateStatus(id, status) {
    await supabase.from('leads').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    loadLeads()
  }

  const filtered = useMemo(() => {
    return leads.filter(l => {
      if (search) {
        const s = search.toLowerCase()
        if (!`${l.name} ${l.phone} ${l.email} ${l.suburb} ${l.postcode}`.toLowerCase().includes(s)) return false
      }
      if (statusFilter && l.status !== statusFilter) return false
      if (tooFarOnly && !l.too_far) return false
      return true
    })
  }, [leads, search, statusFilter, tooFarOnly])

  const stats = useMemo(() => ({
    total: leads.length,
    new: leads.filter(l => l.status === 'new').length,
    followup: leads.filter(l => l.needs_follow_up && !['lost','won','installed'].includes(l.status)).length,
    tooFar: leads.filter(l => l.too_far).length,
    won: leads.filter(l => l.status === 'closed_won' || l.status === 'won').length,
    signed: leads.filter(l => l.signed_in_greensketch).length,
  }), [leads])

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading CRM…</div>
  if (!session) return <LoginScreen />

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold">B</div>
            <div>
              <h1 className="font-bold text-lg leading-tight">Brightnest Energy</h1>
              <p className="text-xs text-slate-500">Solar & Battery CRM</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={syncFromSheet} disabled={syncing} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium">
              <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Syncing…' : 'Sync Sheet'}
            </button>
            <button onClick={() => { setForm({}); setShowForm(true) }} className="flex items-center gap-1.5 px-3 py-2 bg-white border rounded-lg text-sm font-medium">
              <Plus size={15} /> New Lead
            </button>
            <button onClick={() => supabase.auth.signOut()} className="p-2 text-slate-500 hover:text-slate-700"><LogOut size={18} /></button>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 flex gap-1 border-t">
          <NavBtn active={view==='dashboard'} onClick={() => setView('dashboard')} icon={LayoutDashboard}>Dashboard</NavBtn>
          <NavBtn active={view==='pipeline'} onClick={() => setView('pipeline')} icon={Users}>Pipeline</NavBtn>
          <NavBtn active={view==='leads'} onClick={() => setView('leads')} icon={Users}>All Leads</NavBtn>
          <NavBtn active={view==='leads'} onClick={() => setView('leads')} icon={Users}>All Leads</NavBtn>
          <NavBtn active={view==='followup'} onClick={() => setView('followup')} icon={AlertCircle}>Follow-ups</NavBtn>
          <NavBtn active={view==='inventory'} onClick={() => setView('inventory')} icon={Package}>Inventory</NavBtn>
          <NavBtn active={view==='portal'} onClick={() => setView('portal')} icon={Home}>Customer Portal</NavBtn>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Filters */}
        <div className="bg-white rounded-xl p-3 shadow-sm mb-4 flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, phone, suburb, postcode…" className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
            <option value="">All Statuses</option>
            {PIPELINE.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm px-3 py-2 border rounded-lg cursor-pointer">
            <input type="checkbox" checked={tooFarOnly} onChange={e => setTooFarOnly(e.target.checked)} />
            Too Far only
          </label>
          {(search || statusFilter || tooFarOnly) && (
            <button onClick={() => { setSearch(''); setStatusFilter(''); setTooFarOnly(false) }} className="text-xs text-slate-500 underline">Clear</button>
          )}
        </div>

        {view === 'dashboard' && <Dashboard stats={stats} leads={filtered} onSelect={setSelected} />}
        {view === 'pipeline' && <Pipeline leads={filtered} onUpdateStatus={updateStatus} onSelect={setSelected} />}
        {view === 'leads' && <LeadTable leads={filtered} onSelect={setSelected} />}
        {view === 'quotes' && <QuotesView leads={leads} onCreate={setShowQuote} />}
        {view === 'inventory' && <InventoryView />}
        {view === 'portal' && <CustomerPortal leads={leads} />}
      </main>

      {selected && <LeadDrawer lead={selected} onClose={() => setSelected(null)} onSave={saveLead} onStatus={updateStatus} onQuote={() => { setShowQuote(selected); setSelected(null) }} />}
      {showForm && <LeadForm initial={form} onClose={() => setShowForm(false)} onSave={saveLead} />}
      {showQuote && <QuoteGenerator lead={showQuote} onClose={() => setShowQuote(null)} />}
    </div>
  )
}

function NavBtn({ children, active, onClick, icon: Icon }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 ${active ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-600 hover:text-slate-900'}`}>
      <Icon size={16} /> {children}
    </button>
  )
}

function Dashboard({ stats, leads, onSelect }) {
  const attention = leads.filter(l => l.needs_follow_up && !['lost','closed_won','installed'].includes(l.status)).slice(0, 8)
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Total Leads" value={stats.total} />
        <StatCard label="New" value={stats.new} />
        <StatCard label="Needs Follow-up" value={stats.followup} />
        <StatCard label="Too Far" value={stats.tooFar} />
        <StatCard label="Won" value={stats.won} />
        <StatCard label="Signed (GS)" value={stats.signed} />
      </div>
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><AlertCircle size={16} /> Needs Attention</h3>
        {attention.length === 0 ? <p className="text-sm text-slate-400">No leads need follow-up right now.</p> : (
          <div className="space-y-2">
            {attention.map(l => (
              <div key={l.id} onClick={() => onSelect(l)} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 cursor-pointer border">
                <div>
                  <div className="font-medium">{l.name}</div>
                  <div className="text-xs text-slate-500">{l.suburb} · {l.postcode} · {l.created_at ? new Date(l.created_at).toLocaleDateString('en-AU') : ''} · {daysSince(l.created_at)} days old</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded ${PIPELINE.find(s => s.id === l.status)?.color || ''}`}>{l.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  )
}

function Pipeline({ leads, onUpdateStatus, onSelect }) {
  const byStatus = {}
  PIPELINE.forEach(s => byStatus[s.id] = leads.filter(l => l.status === s.id))
  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {PIPELINE.filter(s => s.id !== 'lost').map(s => (
        <div key={s.id} className="flex-shrink-0 w-72 bg-slate-100 rounded-xl p-2">
          <div className="flex items-center justify-between px-2 py-1 mb-2">
            <span className="font-medium text-sm">{s.label}</span>
            <span className="text-xs bg-white px-2 py-0.5 rounded-full">{byStatus[s.id]?.length || 0}</span>
          </div>
          <div className="space-y-2 max-h-[70vh] overflow-y-auto">
            {(byStatus[s.id] || []).map(l => (
              <div key={l.id} onClick={() => onSelect(l)} className="bg-white rounded-lg p-3 shadow-sm cursor-pointer hover:shadow">
                <div className="font-medium text-sm">{l.name}</div>
                <div className="text-xs text-slate-500 mt-0.5">{l.suburb} {l.postcode} · {l.created_at ? new Date(l.created_at).toLocaleDateString('en-AU') : ''}</div>
                <div className="flex gap-1 mt-2">
                  {l.too_far && <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">Too Far</span>}
                  {l.signed_in_greensketch && <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">Signed</span>}
                </div>
                <select value={l.status} onChange={e => { e.stopPropagation(); onUpdateStatus(l.id, e.target.value) }} onClick={e => e.stopPropagation()} className="mt-2 w-full text-xs border rounded px-1 py-0.5">
                  {PIPELINE.map(st => <option key={st.id} value={st.id}>{st.label}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function LeadTable({ leads, onSelect }) {
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Contact</th>
              <th className="text-left p-3">Location</th>
              <th className="text-left p-3">Bill</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Flags</th>
              <th className="text-left p-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {leads.map(l => (
              <tr key={l.id} onClick={() => onSelect(l)} className="border-b hover:bg-slate-50 cursor-pointer">
                <td className="p-3 font-medium">{l.name}</td>
                <td className="p-3 text-xs">{l.phone}<br/>{l.email}</td>
                <td className="p-3 text-xs">{l.suburb}<br/>{l.postcode} {l.state}</td>
                <td className="p-3">{l.bill}</td>
                <td className="p-3"><span className={`text-xs px-2 py-0.5 rounded ${PIPELINE.find(s => s.id === l.status)?.color || ''}`}>{l.status}</span></td>
                <td className="p-3">
                  {l.too_far && <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded mr-1">Too Far</span>}
                  {l.signed_in_greensketch && <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">Signed</span>}
                </td>
                <td className="p-3 text-xs text-slate-500">{l.created_at ? new Date(l.created_at).toLocaleDateString('en-AU') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function LeadDrawer({ lead, onClose, onSave, onStatus, onQuote }) {
  const [edit, setEdit] = useState({ ...lead })
  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex justify-end" onClick={onClose}>
      <div className="bg-white w-full max-w-lg h-full overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b flex justify-between items-start sticky top-0 bg-white">
          <div>
            <h2 className="text-lg font-bold">{lead.name}</h2>
            <p className="text-sm text-slate-500">{lead.suburb} {lead.postcode} · Created {lead.created_at ? new Date(lead.created_at).toLocaleDateString('en-AU') : '—'}</p>
          </div>
          <button onClick={onClose} className="text-2xl text-slate-400">&times;</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><Phone size={14} className="inline mr-1" /> {lead.phone || '—'}</div>
            <div><Mail size={14} className="inline mr-1" /> {lead.email || '—'}</div>
            <div className="col-span-2"><MapPin size={14} className="inline mr-1" /> {lead.address}, {lead.suburb} {lead.postcode}</div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Status</label>
            <select value={edit.status || 'new'} onChange={e => { setEdit({...edit, status: e.target.value}); onStatus(lead.id, e.target.value) }} className="w-full border rounded-lg px-3 py-2 mt-1">
              {PIPELINE.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium text-sm mb-2">Existing System</h4>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium">Has Existing PV?</label>
                <select value={edit.has_existing_pv || ''} onChange={e => setEdit({...edit, has_existing_pv: e.target.value})} className="w-full border rounded px-2 py-1.5 mt-1 text-sm">
                  <option value="">Select</option>
                  <option>No</option>
                  <option>Yes</option>
                </select>
              </div>
              <div><label className="text-xs font-medium">Existing PV Size (kW)</label><input value={edit.existing_pv_size || ''} onChange={e => setEdit({...edit, existing_pv_size: e.target.value})} placeholder="e.g. 6.6" className="w-full border rounded px-2 py-1.5 mt-1 text-sm" /></div>
              <div><label className="text-xs font-medium">Has Existing Battery?</label>
                <select value={edit.has_existing_battery || ''} onChange={e => setEdit({...edit, has_existing_battery: e.target.value})} className="w-full border rounded px-2 py-1.5 mt-1 text-sm">
                  <option value="">Select</option>
                  <option>No</option>
                  <option>Yes</option>
                </select>
              </div>
              <div><label className="text-xs font-medium">Existing Battery Capacity (kWh)</label><input value={edit.existing_battery_kwh || ''} onChange={e => setEdit({...edit, existing_battery_kwh: e.target.value})} placeholder="e.g. 10" className="w-full border rounded px-2 py-1.5 mt-1 text-sm" /></div>
              <div className="col-span-2"><label className="text-xs font-medium">Job Type</label>
                <select value={edit.job_type || ''} onChange={e => setEdit({...edit, job_type: e.target.value})} className="w-full border rounded px-2 py-1.5 mt-1 text-sm">
                  <option value="">Select</option>
                  <option>New System</option>
                  <option>Retrofit / Add Battery</option>
                  <option>Expansion</option>
                  <option>Replacement</option>
                </select>
              </div>
              <div className="col-span-2"><label className="text-xs font-medium">NMI Number</label><input value={edit.nmi || ''} onChange={e => setEdit({...edit, nmi: e.target.value})} placeholder="10-digit NMI" className="w-full border rounded px-2 py-1.5 mt-1 text-sm" /></div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium text-sm mb-2">Property & Roof</h4>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium">Roof Type</label><input value={edit.roof_type || ''} onChange={e => setEdit({...edit, roof_type: e.target.value})} placeholder="Tile / Metal / Flat" className="w-full border rounded px-2 py-1.5 mt-1 text-sm" /></div>
              <div><label className="text-xs font-medium">Pitch</label><input value={edit.pitch || ''} onChange={e => setEdit({...edit, pitch: e.target.value})} placeholder="15° / 22° / Flat" className="w-full border rounded px-2 py-1.5 mt-1 text-sm" /></div>
              <div><label className="text-xs font-medium">Orientation</label><input value={edit.orientation || ''} onChange={e => setEdit({...edit, orientation: e.target.value})} placeholder="North / NE / West" className="w-full border rounded px-2 py-1.5 mt-1 text-sm" /></div>
              <div><label className="text-xs font-medium">Shading</label><input value={edit.shading || ''} onChange={e => setEdit({...edit, shading: e.target.value})} placeholder="None / Low / Medium / High" className="w-full border rounded px-2 py-1.5 mt-1 text-sm" /></div>
              <div><label className="text-xs font-medium">Meter Phase</label>
                <select value={edit.meter_phase || ''} onChange={e => setEdit({...edit, meter_phase: e.target.value})} className="w-full border rounded px-2 py-1.5 mt-1 text-sm">
                  <option value="">Select</option>
                  <option>Single Phase</option>
                  <option>Three Phase</option>
                  <option>Unknown</option>
                </select>
              </div>
              <div><label className="text-xs font-medium">Existing Solar</label>
                <select value={edit.existing_solar || ''} onChange={e => setEdit({...edit, existing_solar: e.target.value})} className="w-full border rounded px-2 py-1.5 mt-1 text-sm">
                  <option value="">Select</option>
                  <option>No</option>
                  <option>Yes - keep</option>
                  <option>Yes - replace</option>
                </select>
              </div>
              <div className="col-span-2"><label className="text-xs font-medium">Switchboard Condition</label><input value={edit.switchboard || ''} onChange={e => setEdit({...edit, switchboard: e.target.value})} placeholder="Good / Needs upgrade / Asbestos" className="w-full border rounded px-2 py-1.5 mt-1 text-sm" /></div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium text-sm mb-2">Energy Usage</h4>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium">Quarterly Bill</label><input value={edit.bill || ''} onChange={e => setEdit({...edit, bill: e.target.value})} className="w-full border rounded px-2 py-1.5 mt-1 text-sm" /></div>
              <div><label className="text-xs font-medium">Daily Usage (kWh)</label><input value={edit.daily_usage || ''} onChange={e => setEdit({...edit, daily_usage: e.target.value})} className="w-full border rounded px-2 py-1.5 mt-1 text-sm" /></div>
              <div className="col-span-2"><label className="text-xs font-medium">Current Retailer</label><input value={edit.retailer || ''} onChange={e => setEdit({...edit, retailer: e.target.value})} className="w-full border rounded px-2 py-1.5 mt-1 text-sm" /></div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium text-sm mb-2">Interests</h4>
            <div className="flex flex-wrap gap-3 text-sm">
              {['Solar PV','Battery / BESS','EV Charger','Off-grid / Backup','Commercial'].map(opt => (
                <label key={opt} className="flex items-center gap-1.5">
                  <input type="checkbox" checked={(edit.interests || '').includes(opt)} onChange={e => {
                    const current = (edit.interests || '').split(',').filter(Boolean)
                    const next = e.target.checked ? [...current, opt] : current.filter(x => x !== opt)
                    setEdit({...edit, interests: next.join(',')})
                  }} />
                  {opt}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-medium">System kW</label><input value={edit.system_kw || ''} onChange={e => setEdit({...edit, system_kw: e.target.value})} className="w-full border rounded px-2 py-1.5 mt-1 text-sm" /></div>
            <div><label className="text-xs font-medium">Battery kWh</label><input value={edit.battery_kwh || ''} onChange={e => setEdit({...edit, battery_kwh: e.target.value})} className="w-full border rounded px-2 py-1.5 mt-1 text-sm" /></div>
          </div>
          <div>
            <label className="text-xs font-medium">GreenSketch URL</label>
            <input value={edit.greensketch_url || ''} onChange={e => setEdit({...edit, greensketch_url: e.target.value})} placeholder="https://…" className="w-full border rounded px-2 py-1.5 mt-1 text-sm" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!edit.signed_in_greensketch} onChange={e => setEdit({...edit, signed_in_greensketch: e.target.checked})} />
            Signed in GreenSketch
          </label>
          <div>
            <label className="text-xs font-medium">Notes</label>
            <textarea value={edit.notes || ''} onChange={e => setEdit({...edit, notes: e.target.value})} rows={4} className="w-full border rounded px-2 py-1.5 mt-1 text-sm" />
          </div>
          <button onClick={() => onSave(edit)} className="w-full bg-emerald-600 text-white py-2 rounded-lg font-medium">Save Changes</button>
        </div>
      </div>
    </div>
  )
}

function LeadForm({ initial, onClose, onSave }) {
  const [f, setF] = useState({
    name: '', phone: '', email: '', address: '', suburb: '', postcode: '', state: 'VIC',
    bill: '', timeline: '', notes: '', status: 'new', ...initial
  })
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b flex justify-between items-center sticky top-0 bg-white">
          <h2 className="text-lg font-bold">New Lead</h2>
          <button onClick={onClose} className="text-2xl text-slate-400">&times;</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First / Full Name *" value={f.name} onChange={v => set('name', v)} required />
            <Field label="Phone" value={f.phone} onChange={v => set('phone', v)} />
            <Field label="Email" value={f.email} onChange={v => set('email', v)} />
            <Field label="Postcode *" value={f.postcode} onChange={v => set('postcode', v)} required />
            <Field label="Suburb *" value={f.suburb} onChange={v => set('suburb', v)} required />
            <Field label="State" value={f.state} onChange={v => set('state', v)} />
            <div className="col-span-2"><Field label="Street Address" value={f.address} onChange={v => set('address', v)} /></div>
            <Field label="Quarterly Bill" value={f.bill} onChange={v => set('bill', v)} />
            <Field label="Timeline" value={f.timeline} onChange={v => set('timeline', v)} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Notes</label>
            <textarea value={f.notes} onChange={e => set('notes', e.target.value)} rows={3} className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" />
          </div>
          <p className="text-xs text-slate-400">Only name, suburb and postcode are required. Everything else is optional.</p>
          <button onClick={() => onSave(f)} className="w-full bg-emerald-600 text-white py-2.5 rounded-lg font-medium">Save Lead</button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, required }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-600">{label}</label>
      <input value={value || ''} onChange={e => onChange(e.target.value)} required={required} className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" />
    </div>
  )
}

function QuotesView({ leads, onCreate }) {
  const quotable = leads.filter(l => !['lost','new'].includes(l.status))
  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <h3 className="font-semibold mb-4">Create Quote from Lead</h3>
      {quotable.length === 0 ? <p className="text-sm text-slate-400">No leads ready for quotes yet.</p> : (
        <div className="space-y-2">
          {quotable.slice(0, 20).map(l => (
            <div key={l.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50">
              <div>
                <div className="font-medium">{l.name}</div>
                <div className="text-xs text-slate-500">{l.suburb} · {l.postcode} · {l.status}</div>
              </div>
              <button onClick={() => onCreate(l)} className="px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-lg">Create Quote</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function QuoteGenerator({ lead, onClose }) {
  const [q, setQ] = useState({
    systemKw: lead.system_kw || '6.6',
    panels: '15',
    panelModel: 'Jinko 440W',
    inverter: 'Sungrow 5kW',
    batteryKwh: lead.battery_kwh || '10',
    batteryModel: 'Sungrow SBR',
    panelCost: 4200,
    inverterCost: 1800,
    batteryCost: 8500,
    installCost: 2500,
    stcRebate: 2800,
    notes: ''
  })
  const set = (k, v) => setQ(p => ({ ...p, [k]: v }))
  const total = Number(q.panelCost) + Number(q.inverterCost) + Number(q.batteryCost) + Number(q.installCost) - Number(q.stcRebate)
  const today = new Date().toLocaleDateString('en-AU')

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[95vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b flex justify-between items-center sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold">Quote for {lead.name}</h2>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="flex items-center gap-1 px-3 py-1.5 border rounded-lg text-sm"><Printer size={15} /> Print / PDF</button>
            <button onClick={onClose} className="text-2xl text-slate-400">&times;</button>
          </div>
        </div>
        <div className="p-6" id="quote-content">
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="text-2xl font-bold text-emerald-700">Brightnest Energy</div>
              <div className="text-sm text-slate-500">Solar & Battery Proposal</div>
            </div>
            <div className="text-right text-sm">
              <div>Date: {today}</div>
              <div>Quote #: BN-{Date.now().toString().slice(-6)}</div>
            </div>
          </div>
          <div className="border-b pb-4 mb-4">
            <div className="font-semibold">Prepared for</div>
            <div>{lead.name}</div>
            <div className="text-sm text-slate-600">{lead.address}, {lead.suburb} {lead.postcode} {lead.state}</div>
            <div className="text-sm text-slate-600">{lead.phone} · {lead.email}</div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
            <div><label className="font-medium">System Size (kW)</label><input value={q.systemKw} onChange={e => set('systemKw', e.target.value)} className="w-full border rounded px-2 py-1 mt-1" /></div>
            <div><label className="font-medium">Panels</label><input value={q.panels} onChange={e => set('panels', e.target.value)} className="w-full border rounded px-2 py-1 mt-1" /></div>
            <div><label className="font-medium">Panel Model</label><input value={q.panelModel} onChange={e => set('panelModel', e.target.value)} className="w-full border rounded px-2 py-1 mt-1" /></div>
            <div><label className="font-medium">Inverter</label><input value={q.inverter} onChange={e => set('inverter', e.target.value)} className="w-full border rounded px-2 py-1 mt-1" /></div>
            <div><label className="font-medium">Battery (kWh)</label><input value={q.batteryKwh} onChange={e => set('batteryKwh', e.target.value)} className="w-full border rounded px-2 py-1 mt-1" /></div>
            <div><label className="font-medium">Battery Model</label><input value={q.batteryModel} onChange={e => set('batteryModel', e.target.value)} className="w-full border rounded px-2 py-1 mt-1" /></div>
          </div>
          <div className="border rounded-lg overflow-hidden mb-6">
            <table className="w-full text-sm">
              <thead className="bg-slate-50"><tr><th className="text-left p-3">Item</th><th className="text-right p-3">Amount</th></tr></thead>
              <tbody>
                <tr className="border-t"><td className="p-3">Panels & mounting ({q.panels} × {q.panelModel})</td><td className="p-3 text-right"><input type="number" value={q.panelCost} onChange={e => set('panelCost', e.target.value)} className="w-24 text-right border rounded px-1" /></td></tr>
                <tr className="border-t"><td className="p-3">Inverter ({q.inverter})</td><td className="p-3 text-right"><input type="number" value={q.inverterCost} onChange={e => set('inverterCost', e.target.value)} className="w-24 text-right border rounded px-1" /></td></tr>
                <tr className="border-t"><td className="p-3">Battery ({q.batteryKwh} kWh {q.batteryModel})</td><td className="p-3 text-right"><input type="number" value={q.batteryCost} onChange={e => set('batteryCost', e.target.value)} className="w-24 text-right border rounded px-1" /></td></tr>
                <tr className="border-t"><td className="p-3">Installation & labour</td><td className="p-3 text-right"><input type="number" value={q.installCost} onChange={e => set('installCost', e.target.value)} className="w-24 text-right border rounded px-1" /></td></tr>
                <tr className="border-t bg-emerald-50"><td className="p-3">Less STCs / Rebate</td><td className="p-3 text-right text-emerald-700">-<input type="number" value={q.stcRebate} onChange={e => set('stcRebate', e.target.value)} className="w-24 text-right border rounded px-1 bg-transparent" /></td></tr>
                <tr className="border-t font-bold bg-slate-50"><td className="p-3">Total (incl. GST)</td><td className="p-3 text-right text-lg">${total.toLocaleString()}</td></tr>
              </tbody>
            </table>
          </div>
          <div>
            <label className="text-sm font-medium">Notes / Inclusions</label>
            <textarea value={q.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="25-year panel warranty, 10-year inverter warranty, monitoring app, etc." className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" />
          </div>
          <div className="mt-6 text-xs text-slate-400 text-center">Valid for 14 days · Brightnest Energy · sales@brightnestenergy.net</div>
        </div>
      </div>
    </div>
  )
}

function InventoryView() {
  const [items, setItems] = useState([
    { id: 1, sku: 'PNL-440-JINKO', name: 'Jinko 440W Panel', category: 'Panel', stock: 48, cost: 185, price: 280, low: 20 },
    { id: 2, sku: 'INV-5K-SG', name: 'Sungrow 5kW Inverter', category: 'Inverter', stock: 12, cost: 980, price: 1600, low: 5 },
    { id: 3, sku: 'BAT-10-SBR', name: 'Sungrow SBR 10kWh', category: 'Battery', stock: 6, cost: 6200, price: 8900, low: 3 },
    { id: 4, sku: 'MNT-RAIL', name: 'Roof Mounting Rail Kit', category: 'Mounting', stock: 35, cost: 45, price: 85, low: 10 },
    { id: 5, sku: 'EV-7KW', name: 'EV Charger 7kW', category: 'EV', stock: 4, cost: 850, price: 1400, low: 2 },
  ])
  const [showAdd, setShowAdd] = useState(false)
  const [newItem, setNewItem] = useState({ name: '', sku: '', category: 'Panel', stock: 0, cost: 0, price: 0, low: 5 })

  const lowStock = items.filter(i => i.stock <= i.low)

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Inventory</h3>
        <button onClick={() => setShowAdd(true)} className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm">+ Add Product</button>
      </div>
      {lowStock.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
          <strong>Low stock:</strong> {lowStock.map(i => i.name).join(', ')}
        </div>
      )}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left p-3">SKU</th>
              <th className="text-left p-3">Product</th>
              <th className="text-left p-3">Category</th>
              <th className="text-right p-3">Stock</th>
              <th className="text-right p-3">Cost</th>
              <th className="text-right p-3">Price</th>
              <th className="text-right p-3">Margin</th>
            </tr>
          </thead>
          <tbody>
            {items.map(i => (
              <tr key={i.id} className="border-b">
                <td className="p-3 font-mono text-xs">{i.sku}</td>
                <td className="p-3 font-medium">{i.name}</td>
                <td className="p-3">{i.category}</td>
                <td className={`p-3 text-right ${i.stock <= i.low ? 'text-red-600 font-semibold' : ''}`}>{i.stock}</td>
                <td className="p-3 text-right">${i.cost}</td>
                <td className="p-3 text-right">${i.price}</td>
                <td className="p-3 text-right text-emerald-600">{Math.round((1 - i.cost/i.price)*100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-xl p-5 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h4 className="font-semibold mb-3">Add Product</h4>
            <div className="space-y-2 text-sm">
              <input placeholder="Name" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} className="w-full border rounded px-3 py-2" />
              <input placeholder="SKU" value={newItem.sku} onChange={e => setNewItem({...newItem, sku: e.target.value})} className="w-full border rounded px-3 py-2" />
              <input type="number" placeholder="Stock" value={newItem.stock} onChange={e => setNewItem({...newItem, stock: +e.target.value})} className="w-full border rounded px-3 py-2" />
              <input type="number" placeholder="Cost" value={newItem.cost} onChange={e => setNewItem({...newItem, cost: +e.target.value})} className="w-full border rounded px-3 py-2" />
              <input type="number" placeholder="Price" value={newItem.price} onChange={e => setNewItem({...newItem, price: +e.target.value})} className="w-full border rounded px-3 py-2" />
            </div>
            <button onClick={() => { setItems([...items, {...newItem, id: Date.now()}]); setShowAdd(false) }} className="w-full mt-4 bg-emerald-600 text-white py-2 rounded-lg">Add</button>
          </div>
        </div>
      )}
    </div>
  )
}

function CustomerPortal({ leads }) {
  const customers = leads.filter(l => ['closed_won','deposit','design','dnsp','install_scheduled','installed','compliance','stc','handover'].includes(l.status))
  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Customer Portal (Preview)</h3>
      <p className="text-sm text-slate-500">Customers will log in with a magic link to see their project status, documents and appointments.</p>
      {customers.length === 0 ? <p className="text-sm text-slate-400">No active customers yet.</p> : (
        <div className="grid gap-3 md:grid-cols-2">
          {customers.map(l => (
            <div key={l.id} className="bg-white rounded-xl p-4 shadow-sm border">
              <div className="font-medium">{l.name}</div>
              <div className="text-sm text-slate-500">{l.suburb} {l.postcode}</div>
              <div className="mt-2 flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded ${PIPELINE.find(s => s.id === l.status)?.color || ''}`}>{l.status.replace(/_/g, ' ')}</span>
                {l.signed_in_greensketch && <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">Signed</span>}
              </div>
              <div className="mt-3 text-xs text-slate-400">System: {l.system_kw || '—'} kW · Battery: {l.battery_kwh || '—'} kWh</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FollowUpView({ leads, onSelect }) {
  const needFollow = leads.filter(l => l.needs_follow_up && !['lost','closed_won','installed','handover'].includes(l.status))
  const overdue = needFollow.filter(l => daysSince(l.created_at) > 2)
  const recent = needFollow.filter(l => daysSince(l.created_at) <= 2)

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h3 className="font-semibold mb-3 text-amber-700">Overdue Follow-ups ({overdue.length})</h3>
        {overdue.length === 0 ? <p className="text-sm text-slate-400">None overdue.</p> : (
          <div className="space-y-2">
            {overdue.map(l => (
              <div key={l.id} onClick={() => onSelect(l)} className="flex items-center justify-between p-3 rounded-lg hover:bg-amber-50 cursor-pointer border border-amber-100">
                <div>
                  <div className="font-medium">{l.name}</div>
                  <div className="text-xs text-slate-500">{l.suburb} · {l.postcode} · {l.phone} · Created {l.created_at ? new Date(l.created_at).toLocaleDateString('en-AU') : ''}</div>
                </div>
                <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">{daysSince(l.created_at)} days</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h3 className="font-semibold mb-3">Recent / Upcoming ({recent.length})</h3>
        {recent.length === 0 ? <p className="text-sm text-slate-400">None.</p> : (
          <div className="space-y-2">
            {recent.map(l => (
              <div key={l.id} onClick={() => onSelect(l)} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 cursor-pointer border">
                <div>
                  <div className="font-medium">{l.name}</div>
                  <div className="text-xs text-slate-500">{l.suburb} · {l.phone} · {l.status}</div>
                </div>
                <span className="text-xs text-slate-500">{l.created_at ? new Date(l.created_at).toLocaleDateString('en-AU') : ''}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function LoginScreen() {
  const [err, setErr] = useState('')
  async function handle(e) {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithPassword({
      email: e.target.email.value,
      password: e.target.password.value
    })
    if (error) setErr(error.message)
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-600 to-teal-700">
      <form onSubmit={handle} className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm mx-4">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-emerald-100 rounded-xl mx-auto mb-3 flex items-center justify-center">
            <span className="text-2xl font-bold text-emerald-600">B</span>
          </div>
          <h1 className="text-2xl font-bold">Brightnest Energy</h1>
          <p className="text-sm text-slate-500">Solar & Battery CRM</p>
        </div>
        <input name="email" type="email" placeholder="Email" required className="w-full border rounded-lg px-4 py-2.5 mb-3" />
        <input name="password" type="password" placeholder="Password" required className="w-full border rounded-lg px-4 py-2.5 mb-4" />
        {err && <div className="text-red-600 text-sm mb-3">{err}</div>}
        <button className="w-full bg-emerald-600 text-white py-2.5 rounded-lg font-semibold">Sign In</button>
        <p className="text-xs text-slate-400 text-center mt-4">Create your first user in the Supabase dashboard</p>
      </form>
    </div>
  )
}

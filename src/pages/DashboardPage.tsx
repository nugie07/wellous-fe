import { useEffect, useMemo, useRef, useState } from "react"
import { format, startOfMonth } from "date-fns"
import { ArrowDown, ArrowUp, CalendarIcon } from "lucide-react"
import { type DateRange } from "react-day-picker"
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import logo from "../assets/wellous_icon.png"
import { HeaderInbox } from "@/components/HeaderInbox"
import { IndonesiaMap } from "@/components/IndonesiaMap"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { changePassword, fetchDashboardLeadTracker, type DashboardLeadTrackerData } from "@/lib/api"
import { getStoredAuthSession } from "@/lib/auth"

type DashboardPageProps = {
  onLogout: () => void
  navigate: (path: string) => void
}

const topNav = ["Dashboard", "Lead Tracker", "Global Settings"]

const SUMMARY_CARD_CONFIG = {
  total_leads: { title: "Total Leads", subtitle1: "Fetched from API", subtitle2: "Lead masuk dalam sistem", bg: "#eff6ff", border: "#bfdbfe", valueColor: "#1e40af" },
  total_assigned: { title: "Total Assigned", subtitle1: "Lead sudah dialokasikan", subtitle2: "Status Assigned", bg: "#f0fdfa", border: "#99f6e4", valueColor: "#0f766e" },
  unreachable_contact: { title: "Unreachable Contact", subtitle1: "Remark follow-up", subtitle2: "Not verified / no response", bg: "#fef3c7", border: "#fde68a", valueColor: "#b45309" },
  assigned_rate: { title: "Assigned Rate", subtitle1: "Persentase lead assigned", subtitle2: "Assigned ÷ Total Leads", bg: "#eef2ff", border: "#c7d2fe", valueColor: "#4338ca" },
} satisfies Record<keyof DashboardLeadTrackerData["summary_cards"], { title: string; subtitle1: string; subtitle2: string; bg: string; border: string; valueColor: string }>

function Dot({ color }: { color: string }) {
  return <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
}

export default function DashboardPage({ onLogout, navigate }: DashboardPageProps) {
  const session = getStoredAuthSession()
  const today = new Date()
  const [date, setDate] = useState<DateRange | undefined>({
    from: startOfMonth(today),
    to: today,
  })
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false)
  const [changePasswordModalOpen, setChangePasswordModalOpen] = useState(false)
  const [logoutModalOpen, setLogoutModalOpen] = useState(false)
  const [dashboardData, setDashboardData] = useState<DashboardLeadTrackerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const avatarLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentPath = typeof window !== "undefined" ? window.location.pathname : ""

  useEffect(() => {
    const from = date?.from
    const to = date?.to ?? date?.from
    if (!from || !to) return

    let active = true
    setLoading(true)
    setError("")

    fetchDashboardLeadTracker({
      date_from: format(from, "yyyy-MM-dd"),
      date_to: format(to, "yyyy-MM-dd"),
    })
      .then((data) => {
        if (!active) return
        setDashboardData(data)
      })
      .catch((err) => {
        if (!active) return
        setError(err instanceof Error ? err.message : "Failed to load dashboard.")
      })
      .finally(() => {
        if (!active) return
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [date?.from, date?.to])

  const dateLabel =
    date?.from && date?.to
      ? `${format(date.from, "dd MMM yyyy")} - ${format(date.to, "dd MMM yyyy")}`
      : date?.from
        ? format(date.from, "dd MMM yyyy")
        : "Pick date range"

  const leadKpiCards = useMemo(() => {
    if (!dashboardData) return []

    return Object.entries(SUMMARY_CARD_CONFIG).map(([key, config]) => {
      const stat = dashboardData.summary_cards[key as keyof DashboardLeadTrackerData["summary_cards"]]
      const isRate = key === "assigned_rate"
      return {
        ...config,
        title: config.title,
        value: isRate ? `${stat.value}%` : stat.value.toLocaleString(),
        trend: `${stat.trend_direction === "up" ? "+" : "-"}${Math.abs(stat.trend_percentage)}%`,
        trendUp: stat.trend_direction === "up",
      }
    })
  }, [dashboardData])

  const leadsAssignedBarData = dashboardData?.leads_vs_assigned ?? []
  const productFunnelData = dashboardData?.product_funnel ?? []
  const indonesiaRegions = dashboardData?.customer_mapping_location.regions ?? []
  const indonesiaMapPoints = dashboardData?.customer_mapping_location.points ?? []

  return (
    <main className="min-h-svh bg-[#f7fafc] text-[#2c3645]">
      <header className="sticky top-0 z-20 border-b border-[#e3e9ef] bg-white">
        <div className="mx-auto flex h-17.5 w-full max-w-400 items-center justify-between px-3">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2.5">
              <img src={logo} alt="Wellous" className="h-8 w-8 rounded-full" />
              <span className="text-[16px] font-semibold tracking-[-0.01em] text-[#1e2633]">Wellous</span>
            </div>
            <nav className="hidden items-center gap-8 lg:flex">
              {topNav.map((item) => {
                const path = item === "Dashboard" ? "/dashboard" : item === "Lead Tracker" ? "/lead-tracker" : "/global-settings"
                const active = currentPath === path
                return (
                  <button key={item} type="button" onClick={() => navigate(path)} className={`rounded px-3 py-1.5 font-normal text-[16px] leading-6 transition hover:bg-[#22c55e] hover:text-white ${active ? "bg-[#22c55e] text-white" : "text-[rgb(38,42,46)]"}`}>{item}</button>
                )
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <HeaderInbox navigate={navigate} />
            <div className="relative hidden items-center gap-3 lg:flex" onMouseEnter={() => { if (avatarLeaveTimer.current) clearTimeout(avatarLeaveTimer.current); setAvatarMenuOpen(true) }} onMouseLeave={() => { avatarLeaveTimer.current = setTimeout(() => setAvatarMenuOpen(false), 150) }}>
              <span className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-gradient-to-br from-[#3f7f8f] to-[#2f5fa9] text-[13px] font-semibold text-white">{(session?.user.name ?? "WU").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span>
              <div className="text-left">
                <p className="text-[14px] font-medium leading-none text-[#2f3640]">{session?.user.name ?? "Wellous User"}</p>
                <p className="mt-1 text-[12px] leading-none text-[#73819a]">{session?.user.role ?? "Administrator"}</p>
              </div>
              {avatarMenuOpen ? (
                <div className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-md border border-[#e3e9ef] bg-white shadow-[0_8px_24px_rgba(17,24,39,0.12)]">
                  <button type="button" onClick={() => { setAvatarMenuOpen(false); setChangePasswordModalOpen(true) }} className="flex w-full items-center gap-3 px-4 py-3 text-left text-[14px] text-[#2f3640] transition hover:bg-[#f5f8fb]"><span className="text-[16px]">🔒</span> Change Password</button>
                  <button type="button" onClick={() => { setAvatarMenuOpen(false); setLogoutModalOpen(true) }} className="flex w-full items-center gap-3 border-t border-[#f0f4f8] px-4 py-3 text-left text-[14px] text-[#2f3640] transition hover:bg-[#e04b4b] hover:text-white"><span className="text-[16px]">🚪</span> Logout</button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-350 px-5 py-8">
        <div className="mb-7 flex items-start justify-between gap-6">
          <div>
            <h1 className="text-[28px] font-bold leading-8.5 tracking-[-0.01em] text-[rgb(38,42,46)]">Welcome back</h1>
            <p className="mt-2 whitespace-nowrap text-[16px] font-normal leading-6 text-[rgb(111,111,111)]">Optimize your conversion strategy with real-time lead insights, engagement history, and detailed source attribution in one view.</p>
          </div>
          <div className="flex justify-end">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-10 w-auto whitespace-nowrap justify-start gap-3 rounded border border-[#d6dbe3] bg-white px-5 text-[14px] font-medium text-[#303947] shadow-none hover:bg-white">
                  <CalendarIcon className="h-4 w-4 text-[#6f7b8d]" />
                  {dateLabel}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto rounded-md border border-[#e5e7eb] p-0 shadow-[0_8px_20px_rgba(17,24,39,0.12)]" align="end" sideOffset={8}>
                <Calendar mode="range" defaultMonth={date?.from} selected={date} onSelect={setDate} numberOfMonths={2} />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {loading ? <div className="rounded-xl border border-[#e0e7ef] bg-white px-5 py-8 text-center text-[14px] text-[#6d7888]">Loading dashboard...</div> : null}
        {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-8 text-center text-[14px] text-red-700">{error}</div> : null}

        {!loading && !error && dashboardData ? (
          <>
            <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {leadKpiCards.map((card) => (
                    <article key={card.title} className="rounded-md border-2 p-4 transition hover:shadow-md" style={{ backgroundColor: card.bg, borderColor: card.border }}>
                      <p className="text-[13px] font-medium text-[#475569]" style={{ color: card.valueColor }}>{card.title}</p>
                      <div className="mt-2 flex items-start justify-between gap-2">
                        <p className="text-2xl font-bold tracking-tight text-[#1e293b]" style={{ color: card.valueColor }}>{card.value}</p>
                        <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[12px] font-medium ${card.trendUp ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{card.trendUp ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}{card.trend}</span>
                      </div>
                      <p className="mt-2 text-[12px] text-[#64748b]">{card.subtitle1}</p>
                      <p className="mt-0.5 text-[11px] text-[#94a3b8]">{card.subtitle2}</p>
                    </article>
                  ))}
                </div>

                <article className="rounded-md border border-[#e0e7ef] bg-white">
                  <div className="border-b border-[#edf1f5] px-5 py-4">
                    <h3 className="text-[18px] font-semibold text-[#2b3340]">Total Leads & Total Assigned</h3>
                    <p className="mt-1 text-[13px] text-[#6d7888]">Latest 6 months</p>
                  </div>
                  <div className="h-[280px] w-full px-4 pb-4 pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={leadsAssignedBarData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#6d7888" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 12, fill: "#6d7888" }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }} formatter={(value: number, name: string) => [value.toLocaleString(), name === "totalLeads" ? "Total Leads" : "Total Assigned"]} />
                        <Legend formatter={(value) => (value === "totalLeads" ? "Total Leads" : "Total Assigned")} />
                        <Bar dataKey="totalLeads" name="totalLeads" fill="#3f7f8f" radius={[4, 4, 0, 0]} maxBarSize={48} />
                        <Bar dataKey="totalAssigned" name="totalAssigned" fill="#5e97a8" radius={[4, 4, 0, 0]} maxBarSize={48} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </article>
              </div>

              <article className="rounded-[10px] border border-[#e0e7ef] bg-white">
                <div className="flex items-center justify-between border-b border-[#edf1f5] px-5 py-3">
                  <h2 className="text-[18px] font-medium text-[#2b3340]">Product Funnel</h2>
                  <button className="text-[24px] text-[#647183]" type="button" aria-label="Options">⋮</button>
                </div>
                <p className="px-5 pt-2 text-[13px] text-[#6d7888]">Jumlah Lead per produk</p>
                <div className="h-[260px] w-full px-4 pb-4 pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={productFunnelData} dataKey="leads" nameKey="product" cx="50%" cy="50%" outerRadius={90} innerRadius={0} paddingAngle={1} stroke="none">
                        {productFunnelData.map((entry) => <Cell key={entry.product} fill={entry.fill} />)}
                      </Pie>
                      <Tooltip formatter={(value: number, name: string) => [value.toLocaleString(), name ?? "Leads"]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="border-t border-[#edf1f5] px-5 py-3">
                  {productFunnelData.map((row) => (
                    <div key={row.product} className="flex items-center justify-between py-1.5 text-[14px]">
                      <span className="inline-flex items-center gap-2 text-[#2d3441]"><Dot color={row.fill} /> {row.product}</span>
                      <span className="font-medium text-[#2d3441]">{row.leads.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </article>
            </div>

            <article className="mt-6 rounded-[10px] border border-[#e0e7ef] bg-white">
              <div className="flex items-center justify-between border-b border-[#edf1f5] px-5 py-3">
                <h3 className="text-[18px] font-medium text-[#2b3340]">Customer Mapping Location</h3>
                <button className="rounded border border-[#d8e1ea] px-4 py-1.5 text-[16px] text-[#687589]">API Data</button>
              </div>
              <div className="grid gap-4 px-5 py-4 xl:grid-cols-[1.5fr_0.75fr]">
                <div className="h-[280px] overflow-hidden rounded-lg border border-[#e2e8f0] bg-[#f8fbff]">
                  <IndonesiaMap points={indonesiaMapPoints} className="h-full w-full" />
                </div>
                <div className="space-y-4 pt-2">
                  {indonesiaRegions.map((r, idx) => (
                    <div key={r.name}>
                      <div className="mb-1 flex items-center justify-between text-[14px] text-[#324156]">
                        <span>{r.name}</span>
                        <span className="text-[#6c7889]">{r.value}%</span>
                      </div>
                      <div className="h-[6px] rounded-full bg-[#e2e8ef]">
                        <div className="h-[6px] rounded-full" style={{ width: `${r.value}%`, backgroundColor: r.color, opacity: idx < 3 ? 1 : 0.75 }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          </>
        ) : null}
      </section>

      {changePasswordModalOpen ? <ChangePasswordModal onClose={() => setChangePasswordModalOpen(false)} onSaved={() => setChangePasswordModalOpen(false)} /> : null}
      {logoutModalOpen ? <LogoutConfirmModal onClose={() => setLogoutModalOpen(false)} onConfirm={() => { setLogoutModalOpen(false); onLogout() }} /> : null}
    </main>
  )
}

function ChangePasswordModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setError("Confirm password does not match.")
      return
    }
    try {
      await changePassword(currentPassword, newPassword)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update password.")
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-[18px] font-semibold text-[#2d3441]">Change Password</h3>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div><label className="block text-[13px] font-medium text-[#2d3441]">Current Password</label><input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required className="mt-1 h-10 w-full rounded-lg border border-[#d8e1ea] px-3 text-[14px]" /></div>
          <div><label className="block text-[13px] font-medium text-[#2d3441]">New Password</label><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required className="mt-1 h-10 w-full rounded-lg border border-[#d8e1ea] px-3 text-[14px]" /></div>
          <div><label className="block text-[13px] font-medium text-[#2d3441]">Confirm New Password</label><input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="mt-1 h-10 w-full rounded-lg border border-[#d8e1ea] px-3 text-[14px]" /></div>
          {error ? <p className="text-[12px] text-red-600">{error}</p> : null}
          <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-lg border border-[#d8e1ea] px-4 py-2 text-[14px] font-medium text-[#5f6e83] hover:bg-[#f5f7f9]">Cancel</button><button type="submit" className="rounded-lg bg-[#3f7f8f] px-4 py-2 text-[14px] font-medium text-white hover:bg-[#35707a]">Save</button></div>
        </form>
      </div>
    </div>
  )
}

function LogoutConfirmModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-[18px] font-semibold text-[#2d3441]">Logout</h3>
        <p className="mt-2 text-[14px] text-[#6d7888]">Are you sure you want to logout from the system?</p>
        <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-lg border border-[#d8e1ea] px-4 py-2 text-[14px] font-medium text-[#5f6e83] hover:bg-[#f5f7f9]">Cancel</button><button type="button" onClick={onConfirm} className="rounded-lg bg-[#e04b4b] px-4 py-2 text-[14px] font-medium text-white hover:bg-[#c43d3d]">Logout</button></div>
      </div>
    </div>
  )
}

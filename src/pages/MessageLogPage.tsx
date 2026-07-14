import { useEffect, useRef, useState } from "react"
import { format } from "date-fns"
import { RefreshCw } from "lucide-react"
import logo from "../assets/wellous_icon.png"
import { HeaderInbox } from "@/components/HeaderInbox"
import { changePassword, fetchMessageLogs, type MessageLogItem } from "@/lib/api"
import { getStoredAuthSession } from "@/lib/auth"

const topNav = ["Dashboard", "Lead Tracker", "Global Settings"]

type MessageLogPageProps = {
  onLogout: () => void
  navigate: (path: string) => void
}

type StatusFilter = "all" | "sent" | "failed" | "skipped" | "pending"
type RecipientFilter = "all" | "dealer" | "customer"

const STATUS_LABEL: Record<string, string> = {
  sent: "Sent",
  failed: "Failed",
  skipped: "Skipped",
  pending: "Pending",
}

const STATUS_STYLE: Record<string, string> = {
  sent: "bg-emerald-100 text-emerald-700 border-emerald-200",
  failed: "bg-red-100 text-red-700 border-red-200",
  skipped: "bg-amber-100 text-amber-700 border-amber-200",
  pending: "bg-gray-100 text-gray-600 border-gray-200",
}

const RECIPIENT_STYLE: Record<string, string> = {
  dealer: "bg-blue-100 text-blue-700 border-blue-200",
  customer: "bg-purple-100 text-purple-700 border-purple-200",
}

function formatDateTime(value?: string | null) {
  if (!value) return "-"
  return format(new Date(value), "dd MMM yyyy HH:mm:ss")
}

export default function MessageLogPage({ onLogout, navigate }: MessageLogPageProps) {
  const session = getStoredAuthSession()
  const [logs, setLogs] = useState<MessageLogItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [recipientFilter, setRecipientFilter] = useState<RecipientFilter>("all")
  const [leadIdFilter, setLeadIdFilter] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false)
  const [changePasswordModalOpen, setChangePasswordModalOpen] = useState(false)
  const [logoutModalOpen, setLogoutModalOpen] = useState(false)
  const avatarLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentPath = typeof window !== "undefined" ? window.location.pathname : ""

  const PER_PAGE = 50

  const load = async (p = page) => {
    setLoading(true)
    setError("")
    try {
      const result = await fetchMessageLogs({
        status: statusFilter === "all" ? undefined : statusFilter,
        recipient_type: recipientFilter === "all" ? undefined : recipientFilter,
        lead_id: leadIdFilter.trim() || undefined,
        page: p,
      })
      setLogs(result.data)
      setTotal(result.meta.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load message logs.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setPage(1)
    load(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, recipientFilter])

  useEffect(() => {
    load(page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    load(1)
  }

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))

  // Stat counts
  const sent = logs.filter((l) => l.status === "sent").length
  const failed = logs.filter((l) => l.status === "failed").length
  const skipped = logs.filter((l) => l.status === "skipped").length

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
                const path =
                  item === "Dashboard" ? "/dashboard"
                  : item === "Lead Tracker" ? "/lead-tracker"
                  : item === "Vendor" ? "/vendor"
                  : item === "Notification" ? "/notification"
                  : item === "WA Log" ? "/wa-log"
                  : "/global-settings"
                const active = currentPath === path
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => navigate(path)}
                    className={`rounded-lg px-3 py-1.5 font-normal text-[16px] leading-6 transition hover:bg-[#22c55e] hover:text-white ${active ? "bg-[#22c55e] text-white" : "text-[rgb(38,42,46)]"}`}
                  >
                    {item}
                  </button>
                )
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <HeaderInbox navigate={navigate} />
            <div
              className="relative hidden items-center gap-3 lg:flex"
              onMouseEnter={() => { if (avatarLeaveTimer.current) clearTimeout(avatarLeaveTimer.current); setAvatarMenuOpen(true) }}
              onMouseLeave={() => { avatarLeaveTimer.current = setTimeout(() => setAvatarMenuOpen(false), 150) }}
            >
              <div className="text-right">
                <p className="text-[14px] font-medium leading-none text-[#2f3640]">{session?.user.name ?? "Wellous User"}</p>
                <p className="mt-1 text-[12px] leading-none text-[#73819a]">{session?.user.role ?? "Administrator"}</p>
              </div>
              <span className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-gradient-to-br from-[#3f7f8f] to-[#2f5fa9] text-[13px] font-semibold text-white">
                {(session?.user.name ?? "WU").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
              </span>
              {avatarMenuOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-xl border border-[#e3e9ef] bg-white shadow-[0_8px_24px_rgba(17,24,39,0.12)]">
                  <button type="button" onClick={() => { setAvatarMenuOpen(false); setChangePasswordModalOpen(true) }} className="flex w-full items-center gap-3 px-4 py-3 text-left text-[14px] text-[#2f3640] transition hover:bg-[#f5f8fb]"><span className="text-[16px]">🔒</span> Change Password</button>
                  <button type="button" onClick={() => { setAvatarMenuOpen(false); setLogoutModalOpen(true) }} className="flex w-full items-center gap-3 border-t border-[#f0f4f8] px-4 py-3 text-left text-[14px] text-[#2f3640] transition hover:bg-[#e04b4b] hover:text-white"><span className="text-[16px]">🚪</span> Logout</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-[1600px] px-5 py-6">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-bold leading-[34px] tracking-[-0.01em] text-[rgb(38,42,46)]">WA Log</h1>
            <p className="mt-2 text-[16px] text-[rgb(111,111,111)]">Log pengiriman pesan WhatsApp dari proses assign lead ke vendor dan customer.</p>
          </div>
          <button
            type="button"
            onClick={() => load(page)}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-[#d8e1ea] bg-white px-4 py-2 text-[14px] font-medium text-[#3f7f8f] hover:bg-[#f0f9fa] disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {error ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-700">{error}</div> : null}

        {/* Summary cards */}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total (halaman ini)", value: logs.length, color: "bg-white text-[#2d3441]" },
            { label: "Sent", value: sent, color: "bg-emerald-50 text-emerald-700" },
            { label: "Failed", value: failed, color: "bg-red-50 text-red-700" },
            { label: "Skipped", value: skipped, color: "bg-amber-50 text-amber-700" },
          ].map((card) => (
            <div key={card.label} className={`rounded-xl border border-[#e0e7ef] px-4 py-3 shadow-sm ${card.color}`}>
              <p className="text-[12px] font-medium opacity-70">{card.label}</p>
              <p className="mt-1 text-[24px] font-bold leading-none">{card.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {/* Status filter */}
          <div className="flex gap-1 rounded-lg border border-[#d8e1ea] bg-white p-1">
            {(["all", "sent", "failed", "skipped", "pending"] as StatusFilter[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition ${
                  statusFilter === s ? "bg-[#3f7f8f] text-white" : "text-[#5f6e83] hover:bg-[#f5f7f9]"
                }`}
              >
                {s === "all" ? "All Status" : STATUS_LABEL[s]}
              </button>
            ))}
          </div>

          {/* Recipient filter */}
          <div className="flex gap-1 rounded-lg border border-[#d8e1ea] bg-white p-1">
            {(["all", "dealer", "customer"] as RecipientFilter[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRecipientFilter(r)}
                className={`rounded-md px-3 py-1.5 text-[13px] font-medium capitalize transition ${
                  recipientFilter === r ? "bg-[#3f7f8f] text-white" : "text-[#5f6e83] hover:bg-[#f5f7f9]"
                }`}
              >
                {r === "all" ? "All Penerima" : r}
              </button>
            ))}
          </div>

          {/* Lead ID search */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Cari Lead ID..."
              value={leadIdFilter}
              onChange={(e) => setLeadIdFilter(e.target.value)}
              className="h-9 w-40 rounded-lg border border-[#d8e1ea] px-3 text-[14px]"
            />
            <button type="submit" className="h-9 rounded-lg bg-[#3f7f8f] px-3 text-[13px] font-medium text-white hover:bg-[#35707a]">Cari</button>
            {leadIdFilter && (
              <button type="button" onClick={() => { setLeadIdFilter(""); setPage(1); load(1) }} className="h-9 rounded-lg border border-[#d8e1ea] px-3 text-[13px] text-[#5f6e83] hover:bg-[#f5f7f9]">Reset</button>
            )}
          </form>
        </div>

        {/* Table */}
        <div className="rounded-[10px] border border-[#e0e7ef] bg-white shadow-sm">
          {loading ? (
            <div className="px-5 py-12 text-center text-[14px] text-[#6d7888]">Memuat log...</div>
          ) : logs.length === 0 ? (
            <div className="px-5 py-12 text-center text-[14px] text-[#6d7888]">Tidak ada log ditemukan.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-[14px]">
                <thead>
                  <tr className="border-b border-[#ecf1f5] bg-[#f8fafc] text-[#6e7b8e]">
                    <th className="whitespace-nowrap py-3 px-4 font-medium">Lead ID</th>
                    <th className="whitespace-nowrap py-3 px-4 font-medium">Penerima</th>
                    <th className="whitespace-nowrap py-3 px-4 font-medium">No. Tujuan</th>
                    <th className="whitespace-nowrap py-3 px-4 font-medium">Vendor</th>
                    <th className="whitespace-nowrap py-3 px-4 font-medium">Status</th>
                    <th className="whitespace-nowrap py-3 px-4 font-medium">Error</th>
                    <th className="whitespace-nowrap py-3 px-4 font-medium">Sent At</th>
                    <th className="whitespace-nowrap py-3 px-4 font-medium">Created At</th>
                    <th className="whitespace-nowrap py-3 px-4 font-medium">Pesan</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <>
                      <tr key={log.id} className="border-b border-[#ecf1f5] text-[#314158] hover:bg-[#fafbfc]">
                        <td className="py-3 px-4 font-mono font-medium">{log.lead_id}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[12px] font-medium capitalize ${RECIPIENT_STYLE[log.recipient_type] ?? "bg-gray-100 text-gray-600"}`}>
                            {log.recipient_type}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-[13px]">{log.recipient_number || "-"}</td>
                        <td className="py-3 px-4 text-[13px]">{log.vendor_name || "-"}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${STATUS_STYLE[log.status] ?? "bg-gray-100 text-gray-600"}`}>
                            {STATUS_LABEL[log.status] ?? log.status}
                          </span>
                        </td>
                        <td className="max-w-[200px] py-3 px-4 text-[12px] text-red-600">
                          {log.error_message ? (
                            <span title={log.error_message} className="block truncate">{log.error_message}</span>
                          ) : "-"}
                        </td>
                        <td className="py-3 px-4 text-[13px] text-[#6d7888]">{formatDateTime(log.sent_at)}</td>
                        <td className="py-3 px-4 text-[13px] text-[#6d7888]">{formatDateTime(log.created_at)}</td>
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                            className="rounded border border-[#d8e1ea] px-2 py-1 text-[12px] text-[#5f6e83] hover:bg-[#f5f7f9]"
                          >
                            {expandedId === log.id ? "Tutup" : "Lihat"}
                          </button>
                        </td>
                      </tr>
                      {expandedId === log.id ? (
                        <tr key={`${log.id}-expanded`} className="bg-[#f8fafc]">
                          <td colSpan={9} className="px-4 py-4">
                            <p className="mb-1 text-[12px] font-semibold text-[#5f6e83] uppercase tracking-wide">Isi Pesan</p>
                            <pre className="whitespace-pre-wrap rounded-lg border border-[#e0e7ef] bg-white px-4 py-3 text-[13px] leading-relaxed text-[#2d3441]">{log.message_body}</pre>
                          </td>
                        </tr>
                      ) : null}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-[#edf1f5] px-4 py-3">
            <span className="text-[14px] text-[#6a778a]">{total} total · halaman {page} dari {totalPages}</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded border border-[#d8e1ea] px-3 py-1.5 text-[14px] text-[#5f6e83] disabled:opacity-50 hover:bg-[#f5f7f9]">‹ Prev</button>
              <span className="rounded bg-[#3f7f8f] px-3 py-1.5 text-[14px] font-medium text-white">{page}</span>
              <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="rounded border border-[#d8e1ea] px-3 py-1.5 text-[14px] text-[#5f6e83] disabled:opacity-50 hover:bg-[#f5f7f9]">Next ›</button>
            </div>
          </div>
        </div>
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
    if (newPassword !== confirmPassword) { setError("Confirm password does not match."); return }
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
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-lg border border-[#d8e1ea] px-4 py-2 text-[14px] font-medium text-[#5f6e83] hover:bg-[#f5f7f9]">Cancel</button>
            <button type="submit" className="rounded-lg bg-[#3f7f8f] px-4 py-2 text-[14px] font-medium text-white hover:bg-[#35707a]">Save</button>
          </div>
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
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-[#d8e1ea] px-4 py-2 text-[14px] font-medium text-[#5f6e83] hover:bg-[#f5f7f9]">Cancel</button>
          <button type="button" onClick={onConfirm} className="rounded-lg bg-[#e04b4b] px-4 py-2 text-[14px] font-medium text-white hover:bg-[#c43d3d]">Logout</button>
        </div>
      </div>
    </div>
  )
}

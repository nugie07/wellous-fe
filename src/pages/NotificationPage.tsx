import { useCallback, useEffect, useRef, useState } from "react"
import { Inbox } from "lucide-react"
import logo from "../assets/wellous_icon.png"
import { HeaderInbox } from "@/components/HeaderInbox"
import { changePassword, fetchNotifications, markNotificationRead, type NotificationItemApi } from "@/lib/api"
import { getStoredAuthSession } from "@/lib/auth"

const topNav = ["Dashboard", "Lead Tracker", "Global Settings"]
const PAGE_SIZE = 10

type NotificationPageProps = {
  onLogout: () => void
  navigate: (path: string) => void
}

function formatRelativeTime(value: string) {
  const date = new Date(value)
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.max(1, Math.round(diffMs / 60000))
  if (diffMin < 60) return `${diffMin} min ago`
  const diffHour = Math.round(diffMin / 60)
  if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? "s" : ""} ago`
  const diffDay = Math.round(diffHour / 24)
  return `${diffDay} day${diffDay > 1 ? "s" : ""} ago`
}

export default function NotificationPage({ onLogout, navigate }: NotificationPageProps) {
  const session = getStoredAuthSession()
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false)
  const [changePasswordModalOpen, setChangePasswordModalOpen] = useState(false)
  const [logoutModalOpen, setLogoutModalOpen] = useState(false)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [notifications, setNotifications] = useState<NotificationItemApi[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const avatarLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadNotifications = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const items = await fetchNotifications()
      setNotifications(items)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notifications.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  const visibleNotifications = notifications.slice(0, visibleCount)
  const hasMore = visibleCount < notifications.length

  const loadMore = useCallback(() => {
    setVisibleCount((c) => Math.min(c + PAGE_SIZE, notifications.length))
  }, [notifications.length])

  useEffect(() => {
    const el = loadMoreRef.current
    if (!el || !hasMore) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore()
      },
      { rootMargin: "100px" }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, loadMore])

  const currentPath = typeof window !== "undefined" ? window.location.pathname : ""

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
                  <button
                    key={item}
                    type="button"
                    onClick={() => navigate(path)}
                    className={`rounded px-3 py-1.5 font-normal text-[16px] leading-6 transition hover:bg-[#22c55e] hover:text-white ${active ? "bg-[#22c55e] text-white" : "text-[rgb(38,42,46)]"}`}
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
              onMouseEnter={() => {
                if (avatarLeaveTimer.current) clearTimeout(avatarLeaveTimer.current)
                setAvatarMenuOpen(true)
              }}
              onMouseLeave={() => {
                avatarLeaveTimer.current = setTimeout(() => setAvatarMenuOpen(false), 150)
              }}
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
                  <button
                    type="button"
                    onClick={() => { setAvatarMenuOpen(false); setChangePasswordModalOpen(true) }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-[14px] text-[#2f3640] transition hover:bg-[#f5f8fb]"
                  >
                    <span className="text-[16px]">🔒</span> Change Password
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAvatarMenuOpen(false); setLogoutModalOpen(true) }}
                    className="flex w-full items-center gap-3 border-t border-[#f0f4f8] px-4 py-3 text-left text-[14px] text-[#2f3640] transition hover:bg-[#e04b4b] hover:text-white"
                  >
                    <span className="text-[16px]">🚪</span> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-[900px] px-5 py-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Inbox className="h-6 w-6 text-[#3f7f8f]" />
            <h1 className="text-[24px] font-bold text-[#2d3441]">Notifications</h1>
          </div>
          <button
            type="button"
            onClick={loadNotifications}
            className="rounded-lg border border-[#d8e1ea] px-4 py-2 text-[13px] font-medium text-[#5f6e83] hover:bg-[#f5f7f9]"
          >
            Refresh
          </button>
        </div>
        <div className="rounded-[10px] border border-[#e0e7ef] bg-white shadow-sm">
          {loading ? (
            <div className="px-5 py-8 text-center text-[14px] text-[#6d7888]">Loading notifications...</div>
          ) : error ? (
            <div className="px-5 py-8 text-center text-[14px] text-red-600">{error}</div>
          ) : (
            <>
              <ul className="divide-y divide-[#edf1f5]">
                {visibleNotifications.map((n) => (
                  <li key={n.id} className={`flex items-center justify-between gap-4 px-5 py-4 hover:bg-[#fafbfc] ${n.read ? "" : "bg-[#f9fcff]"}`}>
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => {
                        markNotificationRead(n.id).catch(() => undefined)
                        setNotifications((prev) => prev.map((item) => (item.id === n.id ? { ...item, read: true } : item)))
                      }}
                    >
                      <p className="text-[14px] font-medium text-[#2d3441]">{n.title}</p>
                      <p className="mt-1 text-[13px] text-[#6d7888]">{n.message}</p>
                      <p className="mt-2 text-[12px] text-[#8a95a5]">{formatRelativeTime(n.created_at)}</p>
                    </button>
                    {n.type === "Export Ready" && (
                      <button
                        type="button"
                        className="shrink-0 rounded-lg bg-[#3f7f8f] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[#35707a]"
                      >
                        Download
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <div ref={loadMoreRef} className="h-4 w-full" />
            </>
          )}
        </div>
      </section>

      {changePasswordModalOpen && (
        <ChangePasswordModal onClose={() => setChangePasswordModalOpen(false)} onSaved={() => setChangePasswordModalOpen(false)} />
      )}
      {logoutModalOpen && (
        <LogoutConfirmModal onClose={() => setLogoutModalOpen(false)} onConfirm={() => { setLogoutModalOpen(false); onLogout() }} />
      )}
    </main>
  )
}

function ChangePasswordModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setError("Confirm password does not match.")
      return
    }
    setSubmitting(true)
    setError("")
    try {
      await changePassword(currentPassword, newPassword)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update password.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-[18px] font-semibold text-[#2d3441]">Change Password</h3>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-[#2d3441]">Current Password</label>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required className="mt-1 h-10 w-full rounded-lg border border-[#d8e1ea] px-3 text-[14px]" />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[#2d3441]">New Password</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required className="mt-1 h-10 w-full rounded-lg border border-[#d8e1ea] px-3 text-[14px]" />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[#2d3441]">Confirm New Password</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="mt-1 h-10 w-full rounded-lg border border-[#d8e1ea] px-3 text-[14px]" />
          </div>
          {error ? <p className="text-[12px] text-red-600">{error}</p> : null}
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-lg border border-[#d8e1ea] px-4 py-2 text-[14px] font-medium text-[#5f6e83] hover:bg-[#f5f7f9]">Cancel</button>
            <button type="submit" disabled={submitting} className="rounded-lg bg-[#3f7f8f] px-4 py-2 text-[14px] font-medium text-white hover:bg-[#35707a] disabled:opacity-50">{submitting ? "Saving..." : "Save"}</button>
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

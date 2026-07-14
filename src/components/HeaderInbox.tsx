import { useEffect, useRef, useState } from "react"
import { Inbox } from "lucide-react"
import { fetchNotifications, markNotificationRead, type NotificationItemApi } from "@/lib/api"

export type NotificationType = "Export Ready" | "Lead Assigned" | "Assignment" | "Reminder" | "System"

export type NotificationItem = {
  id: string
  type: NotificationType
  title: string
  message: string
  time: string
  read?: boolean
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

function toNotificationItem(item: NotificationItemApi): NotificationItem {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    message: item.message,
    time: formatRelativeTime(item.created_at),
    read: item.read,
  }
}

type HeaderInboxProps = {
  navigate: (path: string) => void
}

export function HeaderInbox({ navigate }: HeaderInboxProps) {
  const [inboxOpen, setInboxOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const inboxLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let active = true
    fetchNotifications()
      .then((items) => {
        if (!active) return
        setNotifications(items.map(toNotificationItem))
      })
      .catch(() => {
        if (!active) return
        setNotifications([])
      })
    return () => {
      active = false
    }
  }, [])

  const visibleNotifications = notifications.slice(0, 8)
  const unreadCount = notifications.filter((item) => !item.read).length

  return (
    <div
      className="relative hidden lg:block"
      onMouseEnter={() => {
        if (inboxLeaveTimer.current) clearTimeout(inboxLeaveTimer.current)
        setInboxOpen(true)
      }}
      onMouseLeave={() => {
        inboxLeaveTimer.current = setTimeout(() => setInboxOpen(false), 150)
      }}
    >
      <button
        type="button"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-[#5f6e83] transition hover:bg-[#f0f4f8] hover:text-[#3f7f8f]"
        aria-label="Inbox"
      >
        <Inbox className="h-5 w-5" />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {inboxOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-[#e3e9ef] bg-white shadow-[0_8px_24px_rgba(17,24,39,0.12)]">
          <div className="border-b border-[#edf1f5] px-4 py-3">
            <h4 className="text-[14px] font-semibold text-[#2d3441]">Notifications</h4>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {visibleNotifications.length === 0 ? (
              <div className="px-4 py-6 text-center text-[13px] text-[#6d7888]">No notifications yet.</div>
            ) : (
              visibleNotifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className={`flex w-full items-start justify-between gap-2 border-b border-[#f0f4f8] px-4 py-3 text-left transition hover:bg-[#f8fafc] ${n.read ? "bg-white" : "bg-[#f9fcff]"}`}
                  onClick={() => {
                    setInboxOpen(false)
                    markNotificationRead(n.id).catch(() => undefined)
                    setNotifications((prev) => prev.map((item) => (item.id === n.id ? { ...item, read: true } : item)))
                    navigate("/notification")
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-[#2d3441]">{n.title}</p>
                    <p className="mt-0.5 text-[12px] text-[#6d7888]">{n.message}</p>
                    <p className="mt-1 text-[11px] text-[#8a95a5]">{n.time}</p>
                  </div>
                  {n.type === "Export Ready" && (
                    <span className="shrink-0 rounded bg-[#3f7f8f] px-2 py-1 text-[11px] font-medium text-white">
                      Open
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
          <div className="border-t border-[#edf1f5] bg-[#f8fafc] px-4 py-2">
            <button
              type="button"
              onClick={() => {
                setInboxOpen(false)
                navigate("/notification")
              }}
              className="w-full py-2 text-center text-[13px] font-medium text-[#3f7f8f] hover:underline"
            >
              See All Notifications
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

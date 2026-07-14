import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { addDays, format } from "date-fns"
import { FileDown, LayoutList, ListChecks, UserCheck } from "lucide-react"
import { type DateRange } from "react-day-picker"
import logo from "../assets/wellous_icon.png"
import { HeaderInbox } from "@/components/HeaderInbox"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { assignBulk, assignLead, exportLeads, getAssignJob, changePassword, fetchLeadTransactions, fetchLeads, fetchProducts, fetchVendors, type AssignJobStatus, type LeadItem, type LeadTrxItem, type ProductItem, type VendorItem } from "@/lib/api"
import { getStoredAuthSession } from "@/lib/auth"
import { downloadBlobFile } from "@/lib/utils"

const topNav = ["Dashboard", "Lead Tracker", "Global Settings"]

type LeftMenuItem = "Unassigned List" | "Assigned List" | "Failed List" | "Export Data"
type TabId = "All" | "D.V.N" | "Erojan" | "BLZ Pro" | "NOVIA"

const TAB_PRODUCT_ID: Record<TabId, string | null> = {
  All: null,
  "D.V.N": "dvn",
  Erojan: "erojan",
  "BLZ Pro": "blz_pro",
  NOVIA: "novia",
}

const TAB_COLORS: Record<TabId, string> = {
  All: "#e5e7eb",
  "D.V.N": "#fee4e7",
  Erojan: "#face34",
  "BLZ Pro": "#efceb3",
  NOVIA: "#f2e4ff",
}

type LeadTrackerPageProps = {
  onLogout: () => void
  navigate: (path: string) => void
}

function formatDate(value?: string) {
  if (!value) return "-"
  return format(new Date(value), "dd MMM yyyy")
}

function productLabel(productId: string, products: ProductItem[]) {
  return products.find((item) => item.id === productId)?.name ?? productId
}

export default function LeadTrackerPage({ onLogout, navigate }: LeadTrackerPageProps) {
  const session = getStoredAuthSession()
  const [leftMenu, setLeftMenu] = useState<LeftMenuItem>("Unassigned List")
  const [activeTab, setActiveTab] = useState<TabId>("All")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [assignAllModalOpen, setAssignAllModalOpen] = useState(false)
  const [assignJob, setAssignJob] = useState<AssignJobStatus | null>(null)
  const assignPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [assignLeadModalOpen, setAssignLeadModalOpen] = useState(false)
  const [selectedLead, setSelectedLead] = useState<LeadItem | null>(null)
  const [eligibleVendors, setEligibleVendors] = useState<VendorItem[]>([])
  const [loadingEligibleVendors, setLoadingEligibleVendors] = useState(false)
  const [eligibleVendorsError, setEligibleVendorsError] = useState("")
  const [selectedVendorId, setSelectedVendorId] = useState("")
  const [assigningLead, setAssigningLead] = useState(false)
  const [exportAssignedList, setExportAssignedList] = useState(false)
  const [exportUnassignedList, setExportUnassignedList] = useState(false)
  const [exportProductId, setExportProductId] = useState("")
  const [exportDateRange, setExportDateRange] = useState<DateRange | undefined>({ from: new Date(), to: addDays(new Date(), 7) })
  const [exportFileType, setExportFileType] = useState<"xlsx" | "csv">("xlsx")
  const [exportSubmittedModalOpen, setExportSubmittedModalOpen] = useState(false)
  const [exportSubmitting, setExportSubmitting] = useState(false)
  const [exportFormError, setExportFormError] = useState("")
  const [exportStatusSummary, setExportStatusSummary] = useState("Assigned + Unassigned")
  const [exportDateSummary, setExportDateSummary] = useState("Semua tanggal")
  const [exportProductSummary, setExportProductSummary] = useState("All Products")
  const [loadingExportProducts, setLoadingExportProducts] = useState(false)
  const [exportProductError, setExportProductError] = useState("")
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false)
  const [changePasswordModalOpen, setChangePasswordModalOpen] = useState(false)
  const [logoutModalOpen, setLogoutModalOpen] = useState(false)
  const [leads, setLeads] = useState<LeadItem[]>([])
  const [products, setProducts] = useState<ProductItem[]>([])
  const [vendors, setVendors] = useState<VendorItem[]>([])
  const [leadTransactions, setLeadTransactions] = useState<LeadTrxItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [feedback, setFeedback] = useState("")
  const avatarLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentPath = typeof window !== "undefined" ? window.location.pathname : ""

  useEffect(() => {
    let active = true
    Promise.all([fetchLeads(), fetchProducts(), fetchVendors(), fetchLeadTransactions()])
      .then(([leadItems, productItems, vendorItems, trxItems]) => {
        if (!active) return
        setLeads(leadItems)
        setProducts(productItems)
        setVendors(vendorItems)
        setLeadTransactions(trxItems)
      })
      .catch((err) => {
        if (!active) return
        setError(err instanceof Error ? err.message : "Failed to load lead tracker.")
      })
      .finally(() => {
        if (!active) return
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (leftMenu !== "Export Data") return

    if (products.length > 0) {
      setLoadingExportProducts(false)
      setExportProductError("")
      return
    }

    if (loading) {
      setLoadingExportProducts(true)
      return
    }

    let active = true
    setLoadingExportProducts(true)
    setExportProductError("")

    fetchProducts()
      .then((items) => {
        if (!active) return
        setProducts(items)
      })
      .catch((err) => {
        if (!active) return
        setExportProductError(err instanceof Error ? err.message : "Failed to load product list.")
      })
      .finally(() => {
        if (!active) return
        setLoadingExportProducts(false)
      })

    return () => {
      active = false
    }
  }, [leftMenu, loading, products.length])

  const reloadExportProducts = async () => {
    setLoadingExportProducts(true)
    setExportProductError("")
    try {
      const items = await fetchProducts()
      setProducts(items)
    } catch (err) {
      setExportProductError(err instanceof Error ? err.message : "Failed to load product list.")
    } finally {
      setLoadingExportProducts(false)
    }
  }

  const leadTrxMap = useMemo(() => {
    const map = new Map<string, LeadTrxItem>()
    for (const item of leadTransactions) {
      if (!map.has(item.lead_id)) {
        map.set(item.lead_id, item)
      }
    }
    return map
  }, [leadTransactions])

  const isRemarkEmpty = (r: LeadItem) => r.remark == null || String(r.remark).trim() === ""
  const unassignedListCount = leads.filter((r) => r.status === "Unassigned" && isRemarkEmpty(r)).length
  const assignedCount = leads.filter((r) => r.status === "Assigned").length
  const failedListCount = leads.filter((r) => r.status === "Unassigned" && !isRemarkEmpty(r)).length

  const leftMenuItems: { id: LeftMenuItem; label: string; icon: ReactNode; count: number }[] = [
    { id: "Unassigned List", label: "Unassigned List", icon: <LayoutList className="h-5 w-5 shrink-0" />, count: unassignedListCount },
    { id: "Assigned List", label: "Assigned List", icon: <UserCheck className="h-5 w-5 shrink-0" />, count: assignedCount },
    { id: "Failed List", label: "Failed List", icon: <ListChecks className="h-5 w-5 shrink-0" />, count: failedListCount },
    { id: "Export Data", label: "Export Data", icon: <FileDown className="h-5 w-5 shrink-0" />, count: 0 },
  ]

  const tabs: { id: TabId; label: string }[] = [
    { id: "All", label: "All" },
    { id: "D.V.N", label: "D.V.N" },
    { id: "Erojan", label: "Erojan" },
    { id: "BLZ Pro", label: "BLZ Pro" },
    { id: "NOVIA", label: "NOVIA" },
  ]

  const filteredLeads = useMemo(() => {
    const remarkEmpty = (item: LeadItem) => item.remark == null || String(item.remark).trim() === ""
    let list = [...leads]
    if (leftMenu === "Assigned List") list = list.filter((item) => item.status === "Assigned")
    if (leftMenu === "Unassigned List") list = list.filter((item) => item.status === "Unassigned" && remarkEmpty(item))
    if (leftMenu === "Failed List") list = list.filter((item) => item.status === "Unassigned" && !remarkEmpty(item))

    if (leftMenu === "Assigned List" && activeTab !== "All") {
      list = list.filter((item) => item.product_id === TAB_PRODUCT_ID[activeTab])
    }

    if (!search.trim()) return list
    const q = search.trim().toLowerCase()
    return list.filter((item) =>
      item.lead_id.toLowerCase().includes(q) ||
      item.name.toLowerCase().includes(q) ||
      item.email.toLowerCase().includes(q) ||
      item.phone.includes(q) ||
      item.ig_tiktok.toLowerCase().includes(q) ||
      item.vendor_phone.toLowerCase().includes(q) ||
      item.city.toLowerCase().includes(q)
    )
  }, [activeTab, leftMenu, leads, search])

  const PAGE_SIZE = 10
  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / PAGE_SIZE))
  const paginatedLeads = filteredLeads.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const showTabs = leftMenu === "Assigned List"
  const isAssignedList = leftMenu === "Assigned List"
  const showRemarkColumn = leftMenu === "Unassigned List" || leftMenu === "Failed List"
  const showActionColumn = !isAssignedList

  const stopAssignPoll = () => {
    if (assignPollRef.current) {
      clearInterval(assignPollRef.current)
      assignPollRef.current = null
    }
  }

  const refreshLeadData = async () => {
    const [leadItems, trxItems] = await Promise.all([fetchLeads(), fetchLeadTransactions()])
    setLeads(leadItems)
    setLeadTransactions(trxItems)
  }

  const openAssignLeadModal = async (lead: LeadItem) => {
    setSelectedLead(lead)
    setAssignLeadModalOpen(true)
    setEligibleVendors([])
    setEligibleVendorsError("")
    setSelectedVendorId("")
    setLoadingEligibleVendors(true)

    try {
      const vendorItems = await fetchVendors({ productId: lead.product_id })
      setEligibleVendors(vendorItems)
      setSelectedVendorId(vendorItems[0]?.id ?? "")
    } catch (err) {
      setEligibleVendorsError(err instanceof Error ? err.message : "Failed to load eligible vendors.")
    } finally {
      setLoadingEligibleVendors(false)
    }
  }

  const handleAssignLead = async () => {
    if (!selectedLead || !selectedVendorId) return
    setAssigningLead(true)
    setEligibleVendorsError("")
    try {
      await assignLead(selectedLead.lead_id, selectedVendorId)
      await refreshLeadData()
      setFeedback("Lead assigned.")
      setAssignLeadModalOpen(false)
      setSelectedLead(null)
      setEligibleVendors([])
      setSelectedVendorId("")
    } catch (err) {
      setEligibleVendorsError(err instanceof Error ? err.message : "Failed to assign lead.")
    } finally {
      setAssigningLead(false)
    }
  }

  const assignAll = async () => {
    const unassignedLeads = filteredLeads.filter((item) => item.status === "Unassigned" && isRemarkEmpty(item))
    if (unassignedLeads.length === 0) {
      setFeedback("No unassigned leads to process.")
      setAssignAllModalOpen(false)
      return
    }

    const vendorIndexByProduct = new Map<string, number>()
    let skippedLeads = 0
    const assignments = unassignedLeads.flatMap((lead) => {
      const productEligibleVendors = vendors.filter(
        (vendor) => vendor.whatsapp_number.trim() !== "" && vendor.product_ids?.includes(lead.product_id)
      )

      if (productEligibleVendors.length === 0) {
        skippedLeads += 1
        return []
      }

      const nextIndex = vendorIndexByProduct.get(lead.product_id) ?? 0
      vendorIndexByProduct.set(lead.product_id, nextIndex + 1)

      return [{
        lead_id: lead.lead_id,
        vendor_id: productEligibleVendors[nextIndex % productEligibleVendors.length].id,
      }]
    })

    if (assignments.length === 0) {
      setError("Belum ada vendor eligible yang terhubung ke product lead untuk diproses.")
      return
    }

    try {
      const job = await assignBulk(assignments)
      setAssignJob(job)

      assignPollRef.current = setInterval(async () => {
        try {
          const updated = await getAssignJob(job.job_id)
          setAssignJob(updated)
          if (updated.status === "completed") {
            stopAssignPoll()
            await refreshLeadData()
            const successCount = updated.total - updated.failed
            setFeedback(
              updated.failed > 0 || skippedLeads > 0
                ? `${successCount} lead berhasil di-assign, ${updated.failed} gagal${skippedLeads > 0 ? `, ${skippedLeads} tidak punya vendor eligible` : ""}.`
                : `${successCount} lead berhasil di-assign.`
            )
            setAssignJob(null)
            setAssignAllModalOpen(false)
          }
        } catch {
          // polling error is non-fatal, will retry next interval
        }
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start assignment job.")
      setAssignJob(null)
    }
  }

  const isAssigning = assignJob !== null
  const productOptions = products

  const resolveExportStatus = () => {
    if (exportAssignedList && exportUnassignedList) return undefined
    if (exportAssignedList) return "Assigned" as const
    if (exportUnassignedList) return "Unassigned" as const
    return null
  }

  const buildExportDateParams = () => {
    if (!exportDateRange?.from) return { date_from: undefined, date_to: undefined, label: "Semua tanggal" }
    if (exportDateRange.to && exportDateRange.from > exportDateRange.to) {
      return { date_from: undefined, date_to: undefined, label: "invalid" as const }
    }
    const from = format(exportDateRange.from, "yyyy-MM-dd")
    const to = format(exportDateRange.to ?? exportDateRange.from, "yyyy-MM-dd")
    return { date_from: from, date_to: to, label: `${from} s/d ${to}` }
  }

  const handleExportData = async (event: React.FormEvent) => {
    event.preventDefault()
    setExportFormError("")

    const status = resolveExportStatus()
    if (status === null) {
      setExportFormError("Pilih minimal satu status lead untuk export.")
      return
    }

    const { date_from, date_to, label } = buildExportDateParams()
    if (label === "invalid") {
      setExportFormError("Date range is invalid.")
      return
    }
    if (!exportFileType) {
      setExportFormError("Please choose a file type.")
      return
    }

    setExportStatusSummary(status ?? "Assigned + Unassigned")
    setExportDateSummary(label)
    setExportProductSummary(exportProductId ? productLabel(exportProductId, productOptions) : "All Products")
    setExportSubmittedModalOpen(true)
  }

  const handleConfirmExport = async () => {
    setExportFormError("")
    setExportSubmitting(true)
    try {
      const { date_from, date_to } = buildExportDateParams()
      const { blob, filename } = await exportLeads({
        assigned_list: exportAssignedList,
        unassigned_list: exportUnassignedList,
        date_from,
        date_to,
        file_type: exportFileType,
        product_id: exportProductId || undefined,
      })
      downloadBlobFile(blob, filename)
      setExportSubmittedModalOpen(false)
      setFeedback("Download should begin shortly.")
    } catch (err) {
      setExportFormError(err instanceof Error ? err.message : "Failed to request export data.")
    } finally {
      setExportSubmitting(false)
    }
  }

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
                return <button key={item} type="button" onClick={() => navigate(path)} className={`rounded px-3 py-1.5 font-normal text-[16px] leading-6 transition hover:bg-[#22c55e] hover:text-white ${active ? "bg-[#22c55e] text-white" : "text-[rgb(38,42,46)]"}`}>{item}</button>
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

      <section className="mx-auto w-full max-w-400 px-5 py-6">
        <div className="mb-7 flex items-start justify-between gap-6">
          <div>
            <h1 className="text-[28px] font-bold leading-8.5 tracking-[-0.01em] text-[rgb(38,42,46)]">Lead Tracking</h1>
            <p className="mt-2 text-[16px] font-normal leading-6 text-[rgb(111,111,111)]">Reliable lead management tailored to keep your sales pipeline organized, transparent, and high-converting.</p>
          </div>
        </div>

        {feedback ? <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-[14px] text-emerald-700">{feedback}</div> : null}
        {error ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-700">{error}</div> : null}

        <div className="flex gap-6">
          <aside className="w-52 shrink-0">
            <nav className="rounded-md border border-[#e0e7ef] bg-white py-2">
              {leftMenuItems.map((item) => (
                <button key={item.id} type="button" onClick={() => { setLeftMenu(item.id); setPage(1) }} className={`flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-[14px] font-medium transition ${leftMenu === item.id ? "border-l-4 border-[#3f7f8f] bg-[#f0f9fa] text-[#3f7f8f]" : "border-l-4 border-transparent text-[#2d3441] hover:bg-[#f8fafc]"}`}>
                  <span className="flex items-center gap-3"><span className={leftMenu === item.id ? "text-[#3f7f8f]" : "text-[#5f6e83]"}>{item.icon}</span>{item.label}</span>
                  {item.id !== "Export Data" ? <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white">{item.count}</span> : null}
                </button>
              ))}
            </nav>
          </aside>

          <div className="min-w-0 flex-1">
            {leftMenu === "Export Data" ? (
              <div className="rounded-[10px] border border-[#e0e7ef] bg-white p-6 shadow-sm">
                <h3 className="text-[18px] font-semibold text-[#2b3340]">Request Export Data</h3>
                <form className="mt-6 max-w-lg space-y-6" onSubmit={handleExportData}>
                  <div>
                    <p className="mb-3 text-[14px] font-medium text-[#2d3441]">Data scope</p>
                    <label className="flex cursor-pointer items-center gap-3 py-2"><input type="checkbox" checked={exportAssignedList} onChange={(e) => setExportAssignedList(e.target.checked)} className="h-4 w-4" /><span className="text-[14px] text-[#2d3441]">Assigned List</span></label>
                    <label className="flex cursor-pointer items-center gap-3 py-2"><input type="checkbox" checked={exportUnassignedList} onChange={(e) => setExportUnassignedList(e.target.checked)} className="h-4 w-4" /><span className="text-[14px] text-[#2d3441]">Unassigned List</span></label>
                  </div>
                  <div>
                    <label className="mb-2 block text-[14px] font-medium text-[#2d3441]">Product</label>
                    <select value={exportProductId} onChange={(e) => setExportProductId(e.target.value)} disabled={loadingExportProducts || !!exportProductError} className="h-10 w-full rounded border border-[#d8e1ea] px-3 text-[14px] text-[#2d3441] disabled:bg-[#f8fafc] disabled:text-[#6d7888]">
                      <option value="">
                        {loadingExportProducts ? "Loading product list..." : "All Products"}
                      </option>
                      {productOptions.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                        </option>
                      ))}
                    </select>
                    {exportProductError ? (
                      <div className="mt-2 flex items-center gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
                        <span>{exportProductError}</span>
                        <button type="button" onClick={reloadExportProducts} className="font-medium underline underline-offset-2">
                          Retry
                        </button>
                      </div>
                    ) : null}
                    {!loadingExportProducts && !exportProductError && productOptions.length === 0 ? (
                      <p className="mt-2 text-[12px] text-[#6d7888]">No products found. Export will apply to all products.</p>
                    ) : null}
                    <p className="mt-2 text-[12px] text-[#6d7888]">Optional. Leave empty to export all products.</p>
                  </div>
                  <div>
                    <p className="mb-2 text-[14px] font-medium text-[#2d3441]">Date range</p>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button type="button" variant="outline" className="h-10 w-full justify-start rounded border-[#d8e1ea] bg-white text-[14px] font-normal text-[#2d3441]">
                          {exportDateRange?.from ? exportDateRange.to ? `${format(exportDateRange.from, "dd MMM yyyy")} – ${format(exportDateRange.to, "dd MMM yyyy")}` : format(exportDateRange.from, "dd MMM yyyy") : "Pilih rentang tanggal"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto rounded-md border-[#e2e8f0] p-0" align="start">
                        <Calendar mode="range" defaultMonth={exportDateRange?.from} selected={exportDateRange} onSelect={setExportDateRange} numberOfMonths={2} />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <p className="mb-3 text-[14px] font-medium text-[#2d3441]">Tipe file</p>
                    <div className="flex gap-6">
                      <label className="flex cursor-pointer items-center gap-2"><input type="radio" checked={exportFileType === "xlsx"} onChange={() => setExportFileType("xlsx")} className="h-4 w-4" /><span className="text-[14px]">Xlsx</span></label>
                      <label className="flex cursor-pointer items-center gap-2"><input type="radio" checked={exportFileType === "csv"} onChange={() => setExportFileType("csv")} className="h-4 w-4" /><span className="text-[14px]">CSV</span></label>
                    </div>
                  </div>
                  {exportFormError ? <div className="rounded border border-red-200 bg-red-50 px-3 py-2.5 text-[14px] text-red-700">{exportFormError}</div> : null}
                  <Button type="submit" disabled={exportSubmitting} className="rounded bg-[#3f7f8f] px-5 py-2 text-[14px] font-medium text-white hover:bg-[#35707a] disabled:opacity-50">Review Export</Button>
                </form>
              </div>
            ) : (
              <div className="rounded-md border border-[#e0e7ef] bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf1f5] px-4 pt-3 pb-2">
                  {showTabs ? (
                    <div className="flex flex-wrap gap-1">
                      {tabs.map((tab) => (
                        <button key={tab.id} type="button" onClick={() => { setActiveTab(tab.id); setPage(1) }} className="rounded-sm px-4 py-2 text-[14px] font-medium transition hover:opacity-90" style={{ backgroundColor: activeTab === tab.id ? TAB_COLORS[tab.id] : "transparent", color: activeTab === tab.id ? "#1f2937" : "#5f6e83" }}>{tab.label}</button>
                      ))}
                    </div>
                  ) : <div />}
                  <div className="flex flex-wrap items-center gap-2">
                    {leftMenu === "Unassigned List" ? (
                      <button
                        type="button"
                        disabled={isAssigning}
                        onClick={() => !isAssigning && setAssignAllModalOpen(true)}
                        className="flex items-center gap-2 rounded bg-[#3f7f8f] px-4 py-2 text-[14px] font-medium text-white transition hover:bg-[#35707a] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isAssigning ? (
                          <>
                            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            Assigning {assignJob?.done ?? 0}/{assignJob?.total ?? 0}...
                          </>
                        ) : "Assign All List"}
                      </button>
                    ) : null}
                    <input type="text" placeholder="Search..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} className="h-9 w-56 rounded border border-[#d8e1ea] px-3 text-[14px]" />
                  </div>
                </div>

                {loading ? <div className="px-4 py-8 text-center text-[14px] text-[#6d7888]">Loading leads...</div> : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[900px] text-left text-[14px]">
                        <thead>
                          <tr className="border-b border-[#ecf1f5] bg-[#f8fafc] text-[#6e7b8e]">
                            <th className="whitespace-nowrap py-3 px-3 font-medium">ID</th>
                            <th className="whitespace-nowrap py-3 px-3 font-medium">Lead ID</th>
                            {showRemarkColumn ? <th className="whitespace-nowrap py-3 px-3 font-medium">Remark</th> : null}
                            {isAssignedList ? <th className="whitespace-nowrap py-3 px-3 font-medium">Assigned To</th> : null}
                            <th className="whitespace-nowrap py-3 px-3 font-medium">Product</th>
                            <th className="whitespace-nowrap py-3 px-3 font-medium">Name</th>
                            <th className="whitespace-nowrap py-3 px-3 font-medium">Phone Number</th>
                            <th className="whitespace-nowrap py-3 px-3 font-medium">Email</th>
                            <th className="whitespace-nowrap py-3 px-3 font-medium">IG / Tiktok</th>
                            <th className="whitespace-nowrap py-3 px-3 font-medium">Vendor Phone</th>
                            <th className="whitespace-nowrap py-3 px-3 font-medium">City</th>
                            <th className="whitespace-nowrap py-3 px-3 font-medium">Information</th>
                            <th className="whitespace-nowrap py-3 px-3 font-medium">Voucher</th>
                            <th className="whitespace-nowrap py-3 px-3 font-medium">Purchased</th>
                            <th className="whitespace-nowrap py-3 px-3 font-medium">Terms</th>
                            {isAssignedList ? <th className="whitespace-nowrap py-3 px-3 font-medium">Assigned Date</th> : null}
                            <th className="whitespace-nowrap py-3 px-3 font-medium">Created Date</th>
                            {showActionColumn ? <th className="whitespace-nowrap py-3 px-3 font-medium">Action</th> : null}
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedLeads.map((row) => {
                            const trx = leadTrxMap.get(row.lead_id)
                            return (
                              <tr key={row.lead_id} className="border-b border-[#ecf1f5] text-[#314158] hover:bg-[#fafbfc]">
                                <td className="py-3 px-3 font-medium">{row.id ?? "-"}</td>
                                <td className="py-3 px-3 font-medium">{row.lead_id}</td>
                                {showRemarkColumn ? <td className="py-3 px-3 text-[13px] text-[#6d7888]">{row.remark || "-"}</td> : null}
                                {isAssignedList ? <td className="py-3 px-3">{trx?.vendor?.name ?? row.current_vendor?.name ?? "-"}</td> : null}
                                <td className="py-3 px-3">{productLabel(row.product_id, products)}</td>
                                <td className="py-3 px-3">{row.name}</td>
                                <td className="py-3 px-3">{row.phone}</td>
                                <td className="py-3 px-3">{row.email}</td>
                                <td className="py-3 px-3">{row.ig_tiktok}</td>
                                <td className="py-3 px-3">{row.vendor_phone || "-"}</td>
                                <td className="py-3 px-3">{row.city}</td>
                                <td className="py-3 px-3">{row.information || "-"}</td>
                                <td className="py-3 px-3">{row.voucher_code || "-"}</td>
                                <td className="py-3 px-3">{row.purchased || "-"}</td>
                                <td className="py-3 px-3">{row.terms_accepted || "-"}</td>
                                {isAssignedList ? <td className="py-3 px-3">{formatDate(trx?.assigned_timestamp)}</td> : null}
                                <td className="py-3 px-3">{formatDate(row.created_at)}</td>
                                {showActionColumn ? (
                                  <td className="py-3 px-3">
                                    <button type="button" onClick={() => openAssignLeadModal(row)} className="rounded border border-[#3f7f8f] px-3 py-1.5 text-[13px] font-medium text-[#3f7f8f] hover:bg-[#eef6f7]">
                                      Assign
                                    </button>
                                  </td>
                                ) : null}
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex items-center justify-between border-t border-[#edf1f5] px-4 py-3">
                      <span className="text-[14px] text-[#6a778a]">{filteredLeads.length} total · page {page} of {totalPages}</span>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded border border-[#d8e1ea] px-3 py-1.5 text-[14px] text-[#5f6e83] disabled:opacity-50 hover:bg-[#f5f7f9]">‹ Prev</button>
                        <span className="rounded bg-[#3f7f8f] px-3 py-1.5 text-[14px] font-medium text-white">{page}</span>
                        <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="rounded border border-[#d8e1ea] px-3 py-1.5 text-[14px] text-[#5f6e83] disabled:opacity-50 hover:bg-[#f5f7f9]">Next ›</button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {exportSubmittedModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-md bg-white p-6 shadow-xl">
            <h3 className="text-[18px] font-semibold text-[#2d3441]">Export Details</h3>
            <p className="mt-2 text-[14px] text-[#6d7888]">Pastikan detail export berikut sudah sesuai sebelum file diunduh.</p>
            <div className="mt-4 space-y-2 rounded-md border border-[#e0e7ef] bg-[#f8fafc] px-4 py-3 text-[14px] text-[#4a5565]">
              <p><span className="font-medium text-[#2d3441]">Product:</span> {exportProductSummary}</p>
              <p><span className="font-medium text-[#2d3441]">Status:</span> {exportStatusSummary}</p>
              <p><span className="font-medium text-[#2d3441]">Date range:</span> {exportDateSummary}</p>
              <p><span className="font-medium text-[#2d3441]">File type:</span> {exportFileType.toUpperCase()}</p>
            </div>
            {exportFormError ? <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[14px] text-red-700">{exportFormError}</div> : null}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" disabled={exportSubmitting} onClick={() => setExportSubmittedModalOpen(false)} className="rounded border border-[#d8e1ea] px-4 py-2 text-[14px] font-medium text-[#5f6e83] hover:bg-[#f5f7f9] disabled:opacity-50">
                Cancel
              </button>
              <button type="button" disabled={exportSubmitting} onClick={handleConfirmExport} className="rounded bg-[#3f7f8f] px-4 py-2 text-[14px] font-medium text-white hover:bg-[#35707a] disabled:opacity-50">
                {exportSubmitting ? "Preparing export..." : "Export"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {assignAllModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-[18px] font-semibold text-[#2d3441]">Assign All List</h3>

            {!isAssigning ? (
              <p className="mt-2 text-[14px] text-[#6d7888]">
                Assign semua lead unassigned ke vendor yang tersedia secara round-robin?
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between text-[14px] text-[#2d3441]">
                  <span>Memproses antrian...</span>
                  <span className="font-semibold">{assignJob?.done ?? 0} / {assignJob?.total ?? 0}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[#e8f0f5]">
                  <div
                    className="h-full rounded-full bg-[#3f7f8f] transition-all duration-500"
                    style={{ width: assignJob && assignJob.total > 0 ? `${Math.round((assignJob.done / assignJob.total) * 100)}%` : "0%" }}
                  />
                </div>
                <p className="text-[12px] text-[#73819a]">
                  Mohon tunggu, pesan WhatsApp sedang dikirim satu per satu. Jangan tutup halaman ini.
                </p>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={isAssigning}
                onClick={() => setAssignAllModalOpen(false)}
                className="rounded-lg border border-[#d8e1ea] px-4 py-2 text-[14px] font-medium text-[#5f6e83] hover:bg-[#f5f7f9] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isAssigning}
                onClick={assignAll}
                className="flex items-center gap-2 rounded-lg bg-[#3f7f8f] px-4 py-2 text-[14px] font-medium text-white hover:bg-[#35707a] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isAssigning ? (
                  <>
                    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Memproses...
                  </>
                ) : "Ya, Assign"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {assignLeadModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-md bg-white p-6 shadow-xl">
            <h3 className="text-[18px] font-semibold text-[#2d3441]">Assign Lead</h3>
            <p className="mt-2 text-[14px] text-[#6d7888]">
              {selectedLead ? `Pilih vendor untuk lead ${selectedLead.lead_id} (${productLabel(selectedLead.product_id, products)}).` : "Pilih vendor untuk lead ini."}
            </p>

            <div className="mt-4 rounded border border-[#edf1f5] bg-[#f8fafc] px-4 py-3 text-[13px] text-[#4a5565]">
              {selectedLead ? (
                <>
                  <p><span className="font-medium text-[#2d3441]">Name:</span> {selectedLead.name}</p>
                  <p className="mt-1"><span className="font-medium text-[#2d3441]">Product:</span> {productLabel(selectedLead.product_id, products)}</p>
                </>
              ) : null}
            </div>

            <div className="mt-4">
              {loadingEligibleVendors ? (
                <div className="rounded-md border border-[#d8e1ea] px-4 py-6 text-center text-[14px] text-[#6d7888]">Loading eligible vendors...</div>
              ) : eligibleVendorsError ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-700">{eligibleVendorsError}</div>
              ) : eligibleVendors.length === 0 ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-[14px] text-amber-800">Belum ada vendor yang terhubung ke product ini</div>
              ) : (
                <div className="space-y-3">
                  <label className="block text-[13px] font-medium text-[#2d3441]">Eligible Vendor</label>
                  <select value={selectedVendorId} onChange={(e) => setSelectedVendorId(e.target.value)} className="h-10 w-full rounded border border-[#d8e1ea] px-3 text-[14px]">
                    {eligibleVendors.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.name}{vendor.code ? ` (${vendor.code})` : ""}
                      </option>
                    ))}
                  </select>
                  <div className="space-y-2 rounded border border-[#edf1f5] p-3">
                    {eligibleVendors.map((vendor) => (
                      <label key={vendor.id} className="flex cursor-pointer items-start gap-3 rounded border border-[#edf1f5] px-3 py-2">
                        <input type="radio" name="eligible_vendor" checked={selectedVendorId === vendor.id} onChange={() => setSelectedVendorId(vendor.id)} className="mt-0.5 h-4 w-4" />
                        <span>
                          <span className="block text-[14px] font-medium text-[#2d3441]">{vendor.name}</span>
                          <span className="block text-[12px] text-[#6d7888]">{vendor.whatsapp_number || "No WhatsApp number"}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" disabled={assigningLead} onClick={() => { setAssignLeadModalOpen(false); setSelectedLead(null); setEligibleVendors([]); setEligibleVendorsError(""); setSelectedVendorId("") }} className="rounded border border-[#d8e1ea] px-4 py-2 text-[14px] font-medium text-[#5f6e83] hover:bg-[#f5f7f9] disabled:opacity-50">
                Cancel
              </button>
              <button type="button" disabled={assigningLead || loadingEligibleVendors || eligibleVendors.length === 0 || !selectedVendorId} onClick={handleAssignLead} className="rounded bg-[#3f7f8f] px-4 py-2 text-[14px] font-medium text-white hover:bg-[#35707a] disabled:opacity-50">
                {assigningLead ? "Assigning..." : "Assign"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setError("Confirm password does not match.")
      return
    }
    setIsSubmitting(true)
    try {
      await changePassword(currentPassword, newPassword)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update password.")
    } finally {
      setIsSubmitting(false)
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
          <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-lg border border-[#d8e1ea] px-4 py-2 text-[14px] font-medium text-[#5f6e83] hover:bg-[#f5f7f9]">Cancel</button><button type="submit" disabled={isSubmitting} className="rounded-lg bg-[#3f7f8f] px-4 py-2 text-[14px] font-medium text-white hover:bg-[#35707a] disabled:opacity-50">{isSubmitting ? "Saving..." : "Save"}</button></div>
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

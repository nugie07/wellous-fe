import { useEffect, useRef, useState } from "react"
import logo from "../assets/wellous_icon.png"
import { HeaderInbox } from "@/components/HeaderInbox"
import { Button } from "@/components/ui/button"
import { changePassword, createVendor, deleteVendor, fetchProducts, fetchVendors, updateVendor, type ProductItem, type VendorItem } from "@/lib/api"
import { getStoredAuthSession } from "@/lib/auth"

const topNav = ["Dashboard", "Lead Tracker", "Global Settings"]
const VENDOR_PAGE_SIZE = 10

type VendorPageProps = {
  onLogout: () => void
  navigate: (path: string) => void
}

export default function VendorPage({ onLogout, navigate }: VendorPageProps) {
  const session = getStoredAuthSession()
  const [vendors, setVendors] = useState<VendorItem[]>([])
  const [products, setProducts] = useState<ProductItem[]>([])
  const [loading, setLoading] = useState(true)
  const [vendorModalOpen, setVendorModalOpen] = useState(false)
  const [editingVendor, setEditingVendor] = useState<VendorItem | null>(null)
  const [vendorName, setVendorName] = useState("")
  const [vendorCode, setVendorCode] = useState("")
  const [vendorEmail, setVendorEmail] = useState("")
  const [vendorWhatsappNumber, setVendorWhatsappNumber] = useState("")
  const [vendorAddress, setVendorAddress] = useState("")
  const [vendorLong, setVendorLong] = useState("")
  const [vendorLat, setVendorLat] = useState("")
  const [vendorProductIds, setVendorProductIds] = useState<string[]>([])
  const [vendorSearch, setVendorSearch] = useState("")
  const [vendorPage, setVendorPage] = useState(1)
  const [feedback, setFeedback] = useState("")
  const [error, setError] = useState("")
  const [changePasswordModalOpen, setChangePasswordModalOpen] = useState(false)
  const [logoutModalOpen, setLogoutModalOpen] = useState(false)
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false)
  const avatarLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const vendorImportInputRef = useRef<HTMLInputElement | null>(null)
  const currentPath = typeof window !== "undefined" ? window.location.pathname : ""

  useEffect(() => {
    let active = true
    Promise.all([fetchVendors(), fetchProducts()])
      .then(([vendorItems, productItems]) => {
        if (!active) return
        setVendors(vendorItems)
        setProducts(productItems)
      })
      .catch((err) => {
        if (!active) return
        setError(err instanceof Error ? err.message : "Failed to load vendors.")
      })
      .finally(() => {
        if (!active) return
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const openCreateVendor = () => {
    setEditingVendor(null)
    setVendorName("")
    setVendorCode("")
    setVendorEmail("")
    setVendorWhatsappNumber("")
    setVendorAddress("")
    setVendorLong("")
    setVendorLat("")
    setVendorProductIds([])
    setError("")
    setVendorModalOpen(true)
  }

  const openEditVendor = (vendor: VendorItem) => {
    setEditingVendor(vendor)
    setVendorName(vendor.name)
    setVendorCode(vendor.code ?? "")
    setVendorEmail(vendor.email ?? "")
    setVendorWhatsappNumber(vendor.whatsapp_number ?? "")
    setVendorAddress(vendor.address ?? "")
    setVendorLong(String(vendor.long ?? ""))
    setVendorLat(String(vendor.lat ?? ""))
    setVendorProductIds(vendor.product_ids ?? [])
    setError("")
    setVendorModalOpen(true)
  }

  const handleSaveVendor = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    const payload = {
      name: vendorName,
      code: vendorCode,
      email: vendorEmail,
      whatsapp_number: vendorWhatsappNumber,
      address: vendorAddress,
      long: Number(vendorLong || 0),
      lat: Number(vendorLat || 0),
      product_ids: vendorProductIds,
    }
    try {
      if (editingVendor) {
        const updated = await updateVendor(editingVendor.id, payload)
        setVendors((prev) => prev.map((item) => (item.id === editingVendor.id ? updated : item)))
        setFeedback("Vendor updated.")
      } else {
        const created = await createVendor(payload)
        setVendors((prev) => [created, ...prev])
        setFeedback("Vendor created.")
      }
      setVendorModalOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save vendor.")
    }
  }

  const toggleVendorProduct = (productId: string) => {
    setVendorProductIds((prev) => (
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    ))
  }

  const productNameMap = new Map(products.map((item) => [item.id, item.name]))

  const handleDeleteVendor = async (id: string) => {
    if (!window.confirm("Delete this vendor?")) return
    try {
      await deleteVendor(id)
      setVendors((prev) => prev.filter((item) => item.id !== id))
      setFeedback("Vendor deleted.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete vendor.")
    }
  }

  const handleDownloadVendorTemplate = () => {
    const csv = "name,code,email,whatsapp_number,address,long,lat\n"
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "vendor-template.csv"
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const handleVendorImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setError("")
    try {
      const text = await file.text()
      const rows = parseVendorCsv(text)
      if (rows.length === 0) throw new Error("Template is empty.")
      for (const row of rows) {
        await createVendor(row)
      }
      const items = await fetchVendors()
      setVendors(items)
      setFeedback(`${rows.length} vendor imported.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import vendors.")
    } finally {
      event.target.value = ""
    }
  }

  const filteredVendors = vendorSearch.trim()
    ? vendors.filter(
        (item) =>
          item.name.toLowerCase().includes(vendorSearch.trim().toLowerCase()) ||
          (item.code ?? "").toLowerCase().includes(vendorSearch.trim().toLowerCase()) ||
          (item.email ?? "").toLowerCase().includes(vendorSearch.trim().toLowerCase()) ||
          (item.whatsapp_number ?? "").toLowerCase().includes(vendorSearch.trim().toLowerCase()) ||
          (item.address ?? "").toLowerCase().includes(vendorSearch.trim().toLowerCase())
      )
    : vendors

  const vendorTotalPages = Math.max(1, Math.ceil(filteredVendors.length / VENDOR_PAGE_SIZE))
  const paginatedVendors = filteredVendors.slice((vendorPage - 1) * VENDOR_PAGE_SIZE, vendorPage * VENDOR_PAGE_SIZE)

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
                  <button key={item} type="button" onClick={() => navigate(path)} className={`rounded px-3 py-1.5 font-normal text-[16px] leading-6 transition hover:bg-[#22c55e] hover:text-white ${active ? "bg-[#22c55e] text-white" : "text-[rgb(38,42,46)]"}`}>
                    {item}
                  </button>
                )
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <HeaderInbox navigate={navigate} />
            <div className="relative hidden items-center gap-3 lg:flex" onMouseEnter={() => { if (avatarLeaveTimer.current) clearTimeout(avatarLeaveTimer.current); setAvatarMenuOpen(true) }} onMouseLeave={() => { avatarLeaveTimer.current = setTimeout(() => setAvatarMenuOpen(false), 150) }}>
              <div className="text-right">
                <p className="text-[14px] font-medium leading-none text-[#2f3640]">{session?.user.name ?? "Wellous User"}</p>
                <p className="mt-1 text-[12px] leading-none text-[#73819a]">{session?.user.role ?? "Administrator"}</p>
              </div>
              <span className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-gradient-to-br from-[#3f7f8f] to-[#2f5fa9] text-[13px] font-semibold text-white">{(session?.user.name ?? "WU").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span>
              {avatarMenuOpen ? (
                <div className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-xl border border-[#e3e9ef] bg-white shadow-[0_8px_24px_rgba(17,24,39,0.12)]">
                  <button type="button" onClick={() => { setAvatarMenuOpen(false); setChangePasswordModalOpen(true) }} className="flex w-full items-center gap-3 px-4 py-3 text-left text-[14px] text-[#2f3640] transition hover:bg-[#f5f8fb]"><span className="text-[16px]">🔒</span> Change Password</button>
                  <button type="button" onClick={() => { setAvatarMenuOpen(false); setLogoutModalOpen(true) }} className="flex w-full items-center gap-3 border-t border-[#f0f4f8] px-4 py-3 text-left text-[14px] text-[#2f3640] transition hover:bg-[#e04b4b] hover:text-white"><span className="text-[16px]">🚪</span> Logout</button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-[1600px] px-5 py-6">
        <div className="mb-7">
          <h1 className="text-[28px] font-bold leading-[34px] tracking-[-0.01em] text-[rgb(38,42,46)]">Vendor</h1>
          <p className="mt-2 text-[16px] font-normal leading-6 text-[rgb(111,111,111)]">Manage vendor master data and import vendor records using the existing API.</p>
        </div>

        {feedback ? <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-[14px] text-emerald-700">{feedback}</div> : null}
        {error ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-700">{error}</div> : null}

        <div className="rounded-[10px] border border-[#e0e7ef] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#edf1f5] px-5 py-4">
            <h3 className="text-[18px] font-semibold text-[#2b3340]">Vendor</h3>
            <div className="flex flex-wrap items-center gap-3">
              <input type="search" placeholder="Search vendor..." value={vendorSearch} onChange={(e) => { setVendorSearch(e.target.value); setVendorPage(1) }} className="h-9 w-56 rounded-lg border border-[#d8e1ea] px-3 text-[14px]" />
              <Button type="button" onClick={handleDownloadVendorTemplate} className="rounded-lg border border-[#d8e1ea] bg-white px-4 py-2 text-[14px] font-medium text-[#3f7f8f] hover:bg-[#f5f7f9]">Download Template</Button>
              <Button type="button" onClick={() => vendorImportInputRef.current?.click()} className="rounded-lg border border-[#d8e1ea] bg-white px-4 py-2 text-[14px] font-medium text-[#3f7f8f] hover:bg-[#f5f7f9]">Import CSV</Button>
              <Button type="button" onClick={openCreateVendor} className="rounded-lg bg-[#3f7f8f] px-4 py-2 text-[14px] font-medium text-white hover:bg-[#35707a]">Add Vendor</Button>
              <input ref={vendorImportInputRef} type="file" accept=".csv" className="hidden" onChange={handleVendorImport} />
            </div>
          </div>
          <div className="border-b border-[#edf1f5] bg-[#f9fcfd] px-5 py-3 text-[13px] text-[#6d7888]">
            Template import mengikuti kolom tabel vendor: <span className="font-medium text-[#314158]">name, code, email, whatsapp_number, address, long, lat</span>. Gunakan file CSV agar bisa dibuka di Excel.
          </div>
          {loading ? (
            <div className="px-5 py-8 text-center text-[14px] text-[#6d7888]">Loading vendors...</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[14px]">
                  <thead>
                    <tr className="border-b border-[#ecf1f5] bg-[#f8fafc] text-[#6e7b8e]">
                      <th className="py-3 px-4 font-medium">Name</th>
                      <th className="py-3 px-4 font-medium">Code</th>
                      <th className="py-3 px-4 font-medium">Email</th>
                      <th className="py-3 px-4 font-medium">Whatsapp Number</th>
                      <th className="py-3 px-4 font-medium">Address</th>
                      <th className="py-3 px-4 font-medium">Products</th>
                      <th className="py-3 px-4 font-medium">Long</th>
                      <th className="py-3 px-4 font-medium">Lat</th>
                      <th className="w-40 py-3 px-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedVendors.map((item) => (
                      <tr key={item.id} className="border-b border-[#ecf1f5] text-[#314158] hover:bg-[#fafbfc]">
                        <td className="py-3 px-4 font-medium">{item.name}</td>
                        <td className="py-3 px-4">{item.code || "-"}</td>
                        <td className="py-3 px-4">{item.email || "-"}</td>
                        <td className="py-3 px-4">{item.whatsapp_number || "-"}</td>
                        <td className="py-3 px-4">{item.address || "-"}</td>
                        <td className="py-3 px-4">
                          {item.product_ids?.length ? (
                            <div className="flex flex-wrap gap-2">
                              {item.product_ids.map((productId) => (
                                <span key={productId} className="rounded-full bg-[#eef6f7] px-2.5 py-1 text-[12px] font-medium text-[#3f7f8f]">
                                  {productNameMap.get(productId) ?? productId}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[13px] text-[#6d7888]">No products linked</span>
                          )}
                        </td>
                        <td className="py-3 px-4">{item.long}</td>
                        <td className="py-3 px-4">{item.lat}</td>
                        <td className="py-3 px-4">
                          <button type="button" onClick={() => openEditVendor(item)} className="mr-2 text-[#3f7f8f] hover:underline">Edit</button>
                          <button type="button" onClick={() => handleDeleteVendor(item.id)} className="text-red-600 hover:underline">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-[#edf1f5] px-5 py-3">
                <p className="text-[13px] text-[#6d7888]">Showing {filteredVendors.length === 0 ? 0 : (vendorPage - 1) * VENDOR_PAGE_SIZE + 1}–{Math.min(vendorPage * VENDOR_PAGE_SIZE, filteredVendors.length)} of {filteredVendors.length}</p>
                <div className="flex items-center gap-2">
                  <button type="button" disabled={vendorPage <= 1} onClick={() => setVendorPage((p) => p - 1)} className="rounded border border-[#d8e1ea] px-3 py-1.5 text-[13px] font-medium text-[#5f6e83] disabled:opacity-50 hover:bg-[#f5f7f9]">Previous</button>
                  <span className="text-[13px] text-[#5f6e83]">Page {vendorPage} of {vendorTotalPages}</span>
                  <button type="button" disabled={vendorPage >= vendorTotalPages} onClick={() => setVendorPage((p) => p + 1)} className="rounded border border-[#d8e1ea] px-3 py-1.5 text-[13px] font-medium text-[#5f6e83] disabled:opacity-50 hover:bg-[#f5f7f9]">Next</button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {vendorModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-[18px] font-semibold text-[#2d3441]">{editingVendor ? "Edit Vendor" : "Create Vendor"}</h3>
            <form onSubmit={handleSaveVendor} className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="block text-[13px] font-medium text-[#2d3441]">Name</label>
                <input type="text" value={vendorName} onChange={(e) => setVendorName(e.target.value)} required className="mt-1 h-10 w-full rounded-lg border border-[#d8e1ea] px-3 text-[14px]" />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[#2d3441]">Code</label>
                <input type="text" value={vendorCode} onChange={(e) => setVendorCode(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[#d8e1ea] px-3 text-[14px]" />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[#2d3441]">Email</label>
                <input type="email" value={vendorEmail} onChange={(e) => setVendorEmail(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[#d8e1ea] px-3 text-[14px]" />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[#2d3441]">Whatsapp Number</label>
                <input type="text" value={vendorWhatsappNumber} onChange={(e) => setVendorWhatsappNumber(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[#d8e1ea] px-3 text-[14px]" />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[#2d3441]">Address</label>
                <input type="text" value={vendorAddress} onChange={(e) => setVendorAddress(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[#d8e1ea] px-3 text-[14px]" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[13px] font-medium text-[#2d3441]">Handled Products</label>
                <div className="mt-1 rounded-lg border border-[#d8e1ea] p-3">
                  {products.length === 0 ? (
                    <p className="text-[13px] text-[#6d7888]">Belum ada product yang tersedia.</p>
                  ) : (
                    <div className="grid gap-2 md:grid-cols-2">
                      {products.map((product) => (
                        <label key={product.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#edf1f5] px-3 py-2">
                          <input
                            type="checkbox"
                            checked={vendorProductIds.includes(product.id)}
                            onChange={() => toggleVendorProduct(product.id)}
                            className="mt-0.5 h-4 w-4"
                          />
                          <span>
                            <span className="block text-[14px] font-medium text-[#2d3441]">{product.name}</span>
                            <span className="block text-[12px] font-mono text-[#6d7888]">{product.id}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <p className="mt-2 text-[12px] text-[#6d7888]">Vendor boleh tidak terhubung ke product apa pun, tapi relasi product akan menentukan vendor yang bisa dipakai saat assign lead.</p>
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[#2d3441]">Long</label>
                <input type="number" step="0.00000001" value={vendorLong} onChange={(e) => setVendorLong(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[#d8e1ea] px-3 text-[14px]" />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[#2d3441]">Lat</label>
                <input type="number" step="0.00000001" value={vendorLat} onChange={(e) => setVendorLat(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[#d8e1ea] px-3 text-[14px]" />
              </div>
              <div className="mt-2 flex justify-end gap-3 md:col-span-2">
                <button type="button" onClick={() => setVendorModalOpen(false)} className="rounded-lg border border-[#d8e1ea] px-4 py-2 text-[14px] font-medium text-[#5f6e83] hover:bg-[#f5f7f9]">Cancel</button>
                <button type="submit" className="rounded-lg bg-[#3f7f8f] px-4 py-2 text-[14px] font-medium text-white hover:bg-[#35707a]">Save</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {changePasswordModalOpen ? <ChangePasswordModal onClose={() => setChangePasswordModalOpen(false)} onSaved={() => setChangePasswordModalOpen(false)} /> : null}
      {logoutModalOpen ? <LogoutConfirmModal onClose={() => setLogoutModalOpen(false)} onConfirm={() => { setLogoutModalOpen(false); onLogout() }} /> : null}
    </main>
  )
}

function parseVendorCsv(text: string) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (lines.length < 2) return []
  const headers = lines[0].split(",").map((item) => item.trim().toLowerCase())
  const expectedHeaders = ["name", "code", "email", "whatsapp_number", "address", "long", "lat"]
  if (headers.join(",") !== expectedHeaders.join(",")) {
    throw new Error("Invalid template. Use columns: name,code,email,whatsapp_number,address,long,lat")
  }
  return lines.slice(1).map((line, index) => {
    const values = line.split(",").map((item) => item.trim())
    if (!values[0]) throw new Error(`Vendor name is required on row ${index + 2}.`)
    return {
      name: values[0] ?? "",
      code: values[1] ?? "",
      email: values[2] ?? "",
      whatsapp_number: values[3] ?? "",
      address: values[4] ?? "",
      long: Number(values[5] || 0),
      lat: Number(values[6] || 0),
      product_ids: [],
    }
  })
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
          {error ? <p className="text-[13px] text-red-600">{error}</p> : null}
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
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-[18px] font-semibold text-[#2d3441]">Logout</h3>
        <p className="mt-2 text-[14px] text-[#6d7888]">Are you sure you want to logout?</p>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-[#d8e1ea] px-4 py-2 text-[14px] font-medium text-[#5f6e83] hover:bg-[#f5f7f9]">Cancel</button>
          <button type="button" onClick={onConfirm} className="rounded-lg bg-[#e04b4b] px-4 py-2 text-[14px] font-medium text-white hover:bg-[#c93d3d]">Logout</button>
        </div>
      </div>
    </div>
  )
}

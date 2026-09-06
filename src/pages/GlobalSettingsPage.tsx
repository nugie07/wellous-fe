import { useEffect, useRef, useState } from "react"
import { format } from "date-fns"
import { Building2, FileText, RefreshCw, Settings2, Users } from "lucide-react"
import logo from "../assets/wellous_icon.png"
import { HeaderInbox } from "@/components/HeaderInbox"
import { Button } from "@/components/ui/button"
import {
  changePassword,
  createProduct,
  createVendor,
  deleteProduct,
  deleteUser,
  deleteVendor,
  fetchProduct,
  fetchMessageLogs,
  fetchProducts,
  fetchSettings,
  fetchUsers,
  fetchVendorConfig,
  fetchVendors,
  regenerateProductTypeformWebhook,
  resetUserPassword,
  sendTestEmail,
  updateProduct,
  updateSetting,
  updateVendorConfig,
  updateUser,
  updateVendor,
  createUser,
  type MessageLogItem,
  type ProductItem,
  type UserItemApi,
  type VendorItem,
} from "@/lib/api"
import { getStoredAuthSession } from "@/lib/auth"

const topNav = ["Dashboard", "Lead Tracker", "Global Settings"]
const USER_PAGE_SIZE = 10
const PRODUCT_PAGE_SIZE = 10
const VENDOR_PAGE_SIZE = 10
const LOG_PAGE_SIZE = 50

type SettingsMenuItem = "User Management" | "Vendor" | "Integration Settings" | "WhatsApp Log"
type UserRole = "Admin" | "Staff"
type DistributionType = "by_alphabet" | "by_performance"
type LogStatusFilter = "all" | "sent" | "failed" | "skipped" | "pending"
type LogRecipientFilter = "all" | "dealer" | "customer"

const LOG_STATUS_LABEL: Record<string, string> = { sent: "Sent", failed: "Failed", skipped: "Skipped", pending: "Pending" }
const LOG_STATUS_STYLE: Record<string, string> = {
  sent: "bg-emerald-100 text-emerald-700 border-emerald-200",
  failed: "bg-red-100 text-red-700 border-red-200",
  skipped: "bg-amber-100 text-amber-700 border-amber-200",
  pending: "bg-gray-100 text-gray-600 border-gray-200",
}
const LOG_RECIPIENT_STYLE: Record<string, string> = {
  dealer: "bg-blue-100 text-blue-700 border-blue-200",
  customer: "bg-purple-100 text-purple-700 border-purple-200",
}
const TEMPLATE_PLACEHOLDERS = [
  "{{lead_id}}",
  "{{product_id}}",
  "{{product_name}}",
  "{{name}}",
  "{{phone}}",
  "{{email}}",
  "{{city}}",
  "{{information}}",
  "{{vendor_name}}",
  "{{vendor_phone}}",
]

function formatDateTime(value?: string | null) {
  if (!value) return "-"
  return format(new Date(value), "dd MMM yyyy HH:mm:ss")
}

function parseVendorCsv(text: string) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length < 2) return []
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase())
  if (headers.join(",") !== "name,code,email,whatsapp_number,address,long,lat")
    throw new Error("Invalid template. Use columns: name,code,email,whatsapp_number,address,long,lat")
  return lines.slice(1).map((line, i) => {
    const v = line.split(",").map((x) => x.trim())
    if (!v[0]) throw new Error(`Vendor name required on row ${i + 2}.`)
    return { name: v[0], code: v[1] ?? "", email: v[2] ?? "", whatsapp_number: v[3] ?? "", address: v[4] ?? "", long: Number(v[5] || 0), lat: Number(v[6] || 0), product_ids: [] }
  })
}

type GlobalSettingsPageProps = { onLogout: () => void; navigate: (path: string) => void }

export default function GlobalSettingsPage({ onLogout, navigate }: GlobalSettingsPageProps) {
  const session = getStoredAuthSession()
  const [leftMenu, setLeftMenu] = useState<SettingsMenuItem>("User Management")
  const [feedback, setFeedback] = useState("")
  const [error, setError] = useState("")
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false)
  const [changePasswordModalOpen, setChangePasswordModalOpen] = useState(false)
  const [logoutModalOpen, setLogoutModalOpen] = useState(false)
  const avatarLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentPath = typeof window !== "undefined" ? window.location.pathname : ""

  // ── User Management ──────────────────────────────────────────────────────────
  const [users, setUsers] = useState<UserItemApi[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [userModalOpen, setUserModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserItemApi | null>(null)
  const [formName, setFormName] = useState("")
  const [formEmail, setFormEmail] = useState("")
  const [formPassword, setFormPassword] = useState("")
  const [formRole, setFormRole] = useState<UserRole>("Staff")
  const [userSearch, setUserSearch] = useState("")
  const [userPage, setUserPage] = useState(1)
  const [savingUser, setSavingUser] = useState(false)
  const [savingVendor, setSavingVendor] = useState(false)
  const [savingProduct, setSavingProduct] = useState(false)
  const [savingVendorConfig, setSavingVendorConfig] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)

  // ── Vendor ───────────────────────────────────────────────────────────────────
  const [vendors, setVendors] = useState<VendorItem[]>([])
  const [loadingVendors, setLoadingVendors] = useState(false)
  const [vendorLoaded, setVendorLoaded] = useState(false)
  const [vendorModalOpen, setVendorModalOpen] = useState(false)
  const [editingVendor, setEditingVendor] = useState<VendorItem | null>(null)
  const [vName, setVName] = useState("")
  const [vCode, setVCode] = useState("")
  const [vEmail, setVEmail] = useState("")
  const [vWa, setVWa] = useState("")
  const [vAddress, setVAddress] = useState("")
  const [vLong, setVLong] = useState("")
  const [vLat, setVLat] = useState("")
  const [vProductIds, setVProductIds] = useState<string[]>([])
  const [vendorSearch, setVendorSearch] = useState("")
  const [vendorPage, setVendorPage] = useState(1)
  const vendorImportRef = useRef<HTMLInputElement | null>(null)

  // ── Integration Settings ─────────────────────────────────────────────────────
  const [products, setProducts] = useState<ProductItem[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [productModalOpen, setProductModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null)
  const [viewingProduct, setViewingProduct] = useState<ProductItem | null>(null)
  const [loadingProductDetail, setLoadingProductDetail] = useState(false)
  const [productId, setProductId] = useState("")
  const [productName, setProductName] = useState("")
  const [productColorHex, setProductColorHex] = useState("")
  const [productTypeformId, setProductTypeformId] = useState("")
  const [productMessageTemplate, setProductMessageTemplate] = useState("")
  const [productDealerMessageTemplate, setProductDealerMessageTemplate] = useState("")
  const [productCustomerMessageTemplate, setProductCustomerMessageTemplate] = useState("")
  const [productDealerTemplateCode, setProductDealerTemplateCode] = useState("")
  const [productCustomerTemplateCode, setProductCustomerTemplateCode] = useState("")
  const [regeneratingProductWebhook, setRegeneratingProductWebhook] = useState(false)
  const [productSearch, setProductSearch] = useState("")
  const [productPage, setProductPage] = useState(1)
  const [vendorDistributionType, setVendorDistributionType] = useState<DistributionType>("by_alphabet")
  const [autoAssignEnabled, setAutoAssignEnabled] = useState(false)
  const [savingAutoAssign, setSavingAutoAssign] = useState(false)
  const [gmailEmail, setGmailEmail] = useState("")
  const [emailToken, setEmailToken] = useState("")
  const [testEmailModalOpen, setTestEmailModalOpen] = useState(false)
  const [testEmailTo, setTestEmailTo] = useState("")
  const [testEmailSending, setTestEmailSending] = useState(false)
  const [telegramToken, setTelegramToken] = useState("")
  const [wahaSecretKey, setWahaSecretKey] = useState("")
  const [wahaBaseUrl, setWahaBaseUrl] = useState("")
  const [wahaSessionName, setWahaSessionName] = useState("")
  const [whatsappProvider, setWhatsappProvider] = useState<"waha" | "waba">("waha")
  const [appshdBaseUrl, setAppshdBaseUrl] = useState("")
  const [appshdApiKey, setAppshdApiKey] = useState("")
  const [appshdClientId, setAppshdClientId] = useState("")
  const [appshdSenderId, setAppshdSenderId] = useState("")
  const [appshdDealerTemplateCode, setAppshdDealerTemplateCode] = useState("")
  const [appshdCustomerTemplateCode, setAppshdCustomerTemplateCode] = useState("")
  const [defaultMessageTemplate, setDefaultMessageTemplate] = useState("")
  const [savingDefaultMessageTemplate, setSavingDefaultMessageTemplate] = useState(false)

  // ── WhatsApp Log ─────────────────────────────────────────────────────────────
  const [msgLogs, setMsgLogs] = useState<MessageLogItem[]>([])
  const [logTotal, setLogTotal] = useState(0)
  const [logPage, setLogPage] = useState(1)
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [logLoaded, setLogLoaded] = useState(false)
  const [logStatus, setLogStatus] = useState<LogStatusFilter>("all")
  const [logRecipient, setLogRecipient] = useState<LogRecipientFilter>("all")
  const [logLeadId, setLogLeadId] = useState("")
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null)

  // ── Initial loads ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let active = true
    fetchUsers().then((d) => { if (active) setUsers(d) }).catch(() => undefined).finally(() => { if (active) setLoadingUsers(false) })
    fetchProducts().then((d) => { if (active) setProducts(d) }).catch(() => undefined).finally(() => { if (active) setLoadingProducts(false) })
    fetchVendorConfig().then((d) => { if (active) setVendorDistributionType(d.distribution_type) }).catch(() => undefined)
    fetchSettings([
      "gmail_email", "gmail_token", "telegram_token",
      "waha_secret_access_key", "waha_base_url", "waha_session_name",
      "whatsapp_provider", "appshd_base_url", "appshd_api_key", "appshd_client_id",
      "appshd_sender_id_wa", "appshd_dealer_template_code", "appshd_customer_template_code",
      "auto_assign_enabled", "default_message_template",
    ])
      .then((d) => {
        if (!active) return
        setGmailEmail(d.gmail_email ?? "")
        setEmailToken(d.gmail_token ?? "")
        setTelegramToken(d.telegram_token ?? "")
        setWahaSecretKey(d.waha_secret_access_key ?? "")
        setWahaBaseUrl(d.waha_base_url ?? "")
        setWahaSessionName(d.waha_session_name ?? "")
        setWhatsappProvider(d.whatsapp_provider === "waba" ? "waba" : "waha")
        setAppshdBaseUrl(d.appshd_base_url ?? "")
        setAppshdApiKey(d.appshd_api_key ?? "")
        setAppshdClientId(d.appshd_client_id ?? "")
        setAppshdSenderId(d.appshd_sender_id_wa ?? "")
        setAppshdDealerTemplateCode(d.appshd_dealer_template_code ?? "")
        setAppshdCustomerTemplateCode(d.appshd_customer_template_code ?? "")
        setAutoAssignEnabled(d.auto_assign_enabled === "true")
        setDefaultMessageTemplate(d.default_message_template ?? "")
      }).catch(() => undefined)
    return () => { active = false }
  }, [])

  // Lazy-load Vendor section
  useEffect(() => {
    if (leftMenu !== "Vendor" || vendorLoaded) return
    setLoadingVendors(true)
    fetchVendors().then(setVendors).catch(() => undefined).finally(() => { setLoadingVendors(false); setVendorLoaded(true) })
  }, [leftMenu, vendorLoaded])

  // Lazy-load WA Log section
  useEffect(() => {
    if (leftMenu !== "WhatsApp Log" || logLoaded) return
    loadLogs(1)
  }, [leftMenu, logLoaded])

  const loadLogs = async (p: number) => {
    setLoadingLogs(true)
    try {
      const res = await fetchMessageLogs({
        status: logStatus === "all" ? undefined : logStatus,
        recipient_type: logRecipient === "all" ? undefined : logRecipient,
        lead_id: logLeadId.trim() || undefined,
        page: p,
      })
      setMsgLogs(res.data)
      setLogTotal(res.meta.total)
      setLogLoaded(true)
    } catch { /* non-fatal */ }
    finally { setLoadingLogs(false) }
  }

  useEffect(() => { if (logLoaded) { setLogPage(1); loadLogs(1) } }, [logStatus, logRecipient])
  useEffect(() => { if (logLoaded) loadLogs(logPage) }, [logPage])

  // ── Left menu nav ─────────────────────────────────────────────────────────────
  const leftMenuItems: { id: SettingsMenuItem; label: string; icon: React.ReactNode }[] = [
    { id: "User Management", label: "User Management", icon: <Users className="h-5 w-5 shrink-0" /> },
    { id: "Vendor", label: "Vendor", icon: <Building2 className="h-5 w-5 shrink-0" /> },
    { id: "Integration Settings", label: "Integration Settings", icon: <Settings2 className="h-5 w-5 shrink-0" /> },
    { id: "WhatsApp Log", label: "WhatsApp Log", icon: <FileText className="h-5 w-5 shrink-0" /> },
  ]

  // ── User helpers ──────────────────────────────────────────────────────────────
  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"
    setFormPassword(Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join(""))
  }

  const openCreateUser = () => { setEditingUser(null); setFormName(""); setFormEmail(""); setFormPassword(""); setFormRole("Staff"); setError(""); setUserModalOpen(true) }
  const openEditUser = (u: UserItemApi) => { setEditingUser(u); setFormName(u.name); setFormEmail(u.email); setFormPassword(""); setFormRole(u.role as UserRole); setError(""); setUserModalOpen(true) }

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setSavingUser(true)
    try {
      if (editingUser) {
        await updateUser(editingUser.id, { name: formName, email: formEmail, role: formRole })
        setUsers((prev) => prev.map((u) => u.id === editingUser.id ? { ...u, name: formName, email: formEmail, role: formRole } : u))
        setFeedback("User updated.")
      } else {
        await createUser({ name: formName, email: formEmail, password: formPassword, role: formRole })
        setUsers(await fetchUsers())
        setFeedback("User created.")
      }
      setUserModalOpen(false)
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to save user.") }
    finally { setSavingUser(false) }
  }

  const handleDeleteUser = async (id: string) => {
    if (!window.confirm("Delete this user?")) return
    try { await deleteUser(id); setUsers((prev) => prev.filter((u) => u.id !== id)); setFeedback("User deleted.") }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to delete user.") }
  }

  // ── Vendor helpers ────────────────────────────────────────────────────────────
  const openCreateVendor = () => { setEditingVendor(null); setVName(""); setVCode(""); setVEmail(""); setVWa(""); setVAddress(""); setVLong(""); setVLat(""); setVProductIds([]); setError(""); setVendorModalOpen(true) }
  const openEditVendor = (v: VendorItem) => { setEditingVendor(v); setVName(v.name); setVCode(v.code ?? ""); setVEmail(v.email ?? ""); setVWa(v.whatsapp_number ?? ""); setVAddress(v.address ?? ""); setVLong(String(v.long ?? "")); setVLat(String(v.lat ?? "")); setVProductIds(v.product_ids ?? []); setError(""); setVendorModalOpen(true) }

  const handleSaveVendor = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setSavingVendor(true)
    const payload = { name: vName, code: vCode, email: vEmail, whatsapp_number: vWa, address: vAddress, long: Number(vLong || 0), lat: Number(vLat || 0), product_ids: vProductIds }
    try {
      if (editingVendor) {
        const updated = await updateVendor(editingVendor.id, payload)
        setVendors((prev) => prev.map((v) => v.id === editingVendor.id ? updated : v))
        setFeedback("Vendor updated.")
      } else {
        const created = await createVendor(payload)
        setVendors((prev) => [created, ...prev])
        setFeedback("Vendor created.")
      }
      setVendorModalOpen(false)
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to save vendor.") }
    finally { setSavingVendor(false) }
  }

  const toggleVendorProduct = (productId: string) => {
    setVProductIds((prev) => (
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    ))
  }

  const handleDeleteVendor = async (id: string) => {
    if (!window.confirm("Delete this vendor?")) return
    try { await deleteVendor(id); setVendors((prev) => prev.filter((v) => v.id !== id)); setFeedback("Vendor deleted.") }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to delete vendor.") }
  }

  const handleDownloadVendorTemplate = () => {
    const blob = new Blob(["name,code,email,whatsapp_number,address,long,lat\n"], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = "vendor-template.csv"; a.click(); URL.revokeObjectURL(url)
  }

  const handleVendorImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return; setError("")
    try {
      const rows = parseVendorCsv(await file.text())
      if (rows.length === 0) throw new Error("Template is empty.")
      for (const row of rows) await createVendor(row)
      setVendors(await fetchVendors())
      setFeedback(`${rows.length} vendor imported.`)
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to import vendors.") }
    finally { event.target.value = "" }
  }

  // ── Product helpers ───────────────────────────────────────────────────────────
  const openCreateProduct = () => {
    setEditingProduct(null)
    setProductId("")
    setProductName("")
    setProductColorHex("")
    setProductTypeformId("")
    setProductMessageTemplate("")
    setProductDealerMessageTemplate("")
    setProductCustomerMessageTemplate("")
    setProductDealerTemplateCode("")
    setProductCustomerTemplateCode("")
    setError("")
    setProductModalOpen(true)
  }
  const openEditProduct = (p: ProductItem) => {
    setEditingProduct(p)
    setProductId(p.id)
    setProductName(p.name)
    setProductColorHex(p.color_hex ?? "")
    setProductTypeformId(p.typeform_id ?? "")
    setProductMessageTemplate(p.message_template ?? "")
    setProductDealerMessageTemplate(p.dealer_message_template ?? "")
    setProductCustomerMessageTemplate(p.customer_message_template ?? "")
    setProductDealerTemplateCode(p.dealer_template_code ?? "")
    setProductCustomerTemplateCode(p.customer_template_code ?? "")
    setError("")
    setProductModalOpen(true)
  }

  const openProductDetail = async (product: ProductItem) => {
    setViewingProduct(product)
    setLoadingProductDetail(true)
    setError("")
    try {
      const detail = await fetchProduct(product.id)
      setViewingProduct(detail)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load product detail.")
    } finally {
      setLoadingProductDetail(false)
    }
  }

  const copyProductWebhookUrl = async (url: string) => {
    if (!url.trim()) return
    try {
      await navigator.clipboard.writeText(url)
      setFeedback("Typeform Webhook URL copied.")
    } catch {
      setError("Failed to copy webhook URL.")
    }
  }

  const handleRegenerateProductWebhook = async (product: ProductItem) => {
    if (!window.confirm("Regenerate webhook URL? Update Typeform webhook configuration with the new URL.")) return
    setRegeneratingProductWebhook(true)
    setError("")
    try {
      const updated = await regenerateProductTypeformWebhook(product.id)
      setProducts((prev) => prev.map((p) => (p.id === product.id ? updated : p)))
      if (editingProduct?.id === product.id) setEditingProduct(updated)
      if (viewingProduct?.id === product.id) setViewingProduct(updated)
      setFeedback("Typeform Webhook URL regenerated.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to regenerate webhook URL.")
    } finally {
      setRegeneratingProductWebhook(false)
    }
  }

  const getProductFormError = (err: unknown) => {
    if (!(err instanceof Error)) return "Failed to save product."
    const message = err.message.toLowerCase()
    if (message.includes("typeform_id") && (message.includes("used") || message.includes("unique") || message.includes("duplicate") || message.includes("exists"))) {
      return "Typeform ID sudah dipakai product lain. Gunakan ID form lain atau kosongkan field ini."
    }
    return err.message || "Failed to save product."
  }

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setSavingProduct(true)
    try {
      const payload = {
        id: productId,
        name: productName,
        color_hex: productColorHex,
        typeform_id: productTypeformId.trim(),
        message_template: productMessageTemplate,
        dealer_message_template: productDealerMessageTemplate,
        customer_message_template: productCustomerMessageTemplate,
        dealer_template_code: productDealerTemplateCode,
        customer_template_code: productCustomerTemplateCode,
      }
      if (editingProduct) {
        const updated = await updateProduct(editingProduct.id, payload)
        setProducts((prev) => prev.map((p) => p.id === editingProduct.id ? updated : p))
        setEditingProduct(updated)
        setFeedback("Product updated.")
      } else {
        const created = await createProduct(payload)
        setProducts((prev) => [created, ...prev])
        setEditingProduct(created)
        setFeedback("Product created. Copy Typeform Webhook URL ke Typeform Admin.")
      }
    } catch (err) { setError(getProductFormError(err)) }
    finally { setSavingProduct(false) }
  }

  const handleDeleteProduct = async (id: string) => {
    if (!window.confirm("Delete this product?")) return
    try { await deleteProduct(id); setProducts((prev) => prev.filter((p) => p.id !== id)); setFeedback("Product deleted.") }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to delete product.") }
  }

  // ── Integration helpers ───────────────────────────────────────────────────────
  const handleSaveVendorConfig = async () => {
    setSavingVendorConfig(true)
    try { const u = await updateVendorConfig(vendorDistributionType); setVendorDistributionType(u.distribution_type); setFeedback("Vendor config updated.") }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to update vendor config.") }
    finally { setSavingVendorConfig(false) }
  }

  const handleToggleAutoAssign = async (enabled: boolean) => {
    setSavingAutoAssign(true)
    try {
      await updateSetting("auto_assign_enabled", enabled ? "true" : "false")
      setAutoAssignEnabled(enabled)
      setFeedback(enabled ? "Auto-assign aktif. Lead baru akan otomatis di-assign setiap 5 menit." : "Auto-assign dinonaktifkan.")
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to update setting.") }
    finally { setSavingAutoAssign(false) }
  }

  const saveSetting = async (key: string, value: string, msg: string) => {
    setSavingSettings(true)
    try { await updateSetting(key, value); setFeedback(msg) }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to save setting.") }
    finally { setSavingSettings(false) }
  }

  const handleSaveDefaultMessageTemplate = async () => {
    setSavingDefaultMessageTemplate(true)
    try {
      await updateSetting("default_message_template", defaultMessageTemplate)
      setFeedback("Default message template updated.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save default message template.")
    } finally {
      setSavingDefaultMessageTemplate(false)
    }
  }

  // ── Pagination helpers ────────────────────────────────────────────────────────
  const filteredUsers = userSearch.trim() ? users.filter((u) => u.name.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase())) : users
  const userTotalPages = Math.max(1, Math.ceil(filteredUsers.length / USER_PAGE_SIZE))
  const paginatedUsers = filteredUsers.slice((userPage - 1) * USER_PAGE_SIZE, userPage * USER_PAGE_SIZE)

  const filteredVendors = vendorSearch.trim() ? vendors.filter((v) => [v.name, v.code ?? "", v.email ?? "", v.whatsapp_number ?? "", v.address ?? ""].some((s) => s.toLowerCase().includes(vendorSearch.toLowerCase()))) : vendors
  const vendorTotalPages = Math.max(1, Math.ceil(filteredVendors.length / VENDOR_PAGE_SIZE))
  const paginatedVendors = filteredVendors.slice((vendorPage - 1) * VENDOR_PAGE_SIZE, vendorPage * VENDOR_PAGE_SIZE)

  const filteredProducts = productSearch.trim() ? products.filter((p) => p.id.toLowerCase().includes(productSearch.toLowerCase()) || p.name.toLowerCase().includes(productSearch.toLowerCase()) || (p.typeform_id ?? "").toLowerCase().includes(productSearch.toLowerCase())) : products
  const productTotalPages = Math.max(1, Math.ceil(filteredProducts.length / PRODUCT_PAGE_SIZE))
  const paginatedProducts = filteredProducts.slice((productPage - 1) * PRODUCT_PAGE_SIZE, productPage * PRODUCT_PAGE_SIZE)
  const productNameMap = new Map(products.map((product) => [product.id, product.name]))

  const logTotalPages = Math.max(1, Math.ceil(logTotal / LOG_PAGE_SIZE))

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
              <span className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-gradient-to-br from-[#3f7f8f] to-[#2f5fa9] text-[13px] font-semibold text-white">{(session?.user.name ?? "WU").split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}</span>
              <div className="text-left">
                <p className="text-[14px] font-medium leading-none text-[#2f3640]">{session?.user.name ?? "Wellous User"}</p>
                <p className="mt-1 text-[12px] leading-none text-[#73819a]">{session?.user.role ?? "Administrator"}</p>
              </div>
              {avatarMenuOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-md border border-[#e3e9ef] bg-white shadow-[0_8px_24px_rgba(17,24,39,0.12)]">
                  <button type="button" onClick={() => { setAvatarMenuOpen(false); setChangePasswordModalOpen(true) }} className="flex w-full items-center gap-3 px-4 py-3 text-left text-[14px] text-[#2f3640] transition hover:bg-[#f5f8fb]"><span>🔒</span> Change Password</button>
                  <button type="button" onClick={() => { setAvatarMenuOpen(false); setLogoutModalOpen(true) }} className="flex w-full items-center gap-3 border-t border-[#f0f4f8] px-4 py-3 text-left text-[14px] text-[#2f3640] transition hover:bg-[#e04b4b] hover:text-white"><span>🚪</span> Logout</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-400 px-5 py-6">
        <div className="mb-7">
          <h1 className="text-[28px] font-bold leading-8.5 tracking-[-0.01em] text-[rgb(38,42,46)]">Global Settings</h1>
          <p className="mt-2 text-[16px] text-[rgb(111,111,111)]">Kelola user, vendor, integrasi, dan log WhatsApp.</p>
        </div>

        {feedback ? <div className="mb-4 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-[14px] text-emerald-700">{feedback}</div> : null}
        {error ? <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-700">{error}</div> : null}

        <div className="flex gap-6">
          {/* ── Sidebar ── */}
          <aside className="w-56 shrink-0">
            <nav className="rounded-md border border-[#e0e7ef] bg-white py-2">
              {leftMenuItems.map((item) => (
                <button key={item.id} type="button" onClick={() => { setLeftMenu(item.id); setError(""); setFeedback("") }}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left text-[14px] font-medium transition ${leftMenu === item.id ? "border-l-4 border-[#3f7f8f] bg-[#f0f9fa] text-[#3f7f8f]" : "border-l-4 border-transparent text-[#2d3441] hover:bg-[#f8fafc]"}`}>
                  <span className={leftMenu === item.id ? "text-[#3f7f8f]" : "text-[#5f6e83]"}>{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </nav>
          </aside>

          <div className="min-w-0 flex-1">

            {/* ════════════════ USER MANAGEMENT ════════════════ */}
            {leftMenu === "User Management" ? (
              <div className="rounded-md border border-[#e0e7ef] bg-white">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#edf1f5] px-5 py-4">
                  <h3 className="text-[18px] font-semibold text-[#2b3340]">User Management</h3>
                  <div className="flex items-center gap-3">
                    <input type="search" placeholder="Search by name or email..." value={userSearch} onChange={(e) => { setUserSearch(e.target.value); setUserPage(1) }} className="h-9 w-56 rounded border border-[#d8e1ea] px-3 text-[14px]" />
                    <Button type="button" onClick={openCreateUser} className="rounded bg-[#3f7f8f] h-9 px-4 flex items-center justify-center text-[14px] font-medium text-white hover:bg-[#35707a]">Add User</Button>
                  </div>
                </div>
                {loadingUsers ? <div className="px-5 py-8 text-center text-[14px] text-[#6d7888]">Loading users...</div> : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[14px]">
                        <thead><tr className="border-b border-[#ecf1f5] bg-[#f8fafc] text-[#6e7b8e]">
                          <th className="py-3 px-4 font-medium">Name</th><th className="py-3 px-4 font-medium">Email</th><th className="py-3 px-4 font-medium">Role</th><th className="w-56 py-3 px-4 font-medium">Actions</th>
                        </tr></thead>
                        <tbody>
                          {paginatedUsers.map((u) => (
                            <tr key={u.id} className="border-b border-[#ecf1f5] text-[#314158] hover:bg-[#fafbfc]">
                              <td className="py-3 px-4 font-medium">{u.name}</td>
                              <td className="py-3 px-4">{u.email}</td>
                              <td className="py-3 px-4">{u.role}</td>
                              <td className="py-3 px-4">
                                {session?.user.id === u.id ? (
                                  <span className="text-[#6d7888] font-medium italic">on login</span>
                                ) : (
                                  <>
                                    <button type="button" onClick={() => openEditUser(u)} className="mr-2 text-[#3f7f8f] hover:underline">Edit</button>
                                    <button type="button" onClick={async () => { try { await resetUserPassword(u.id); setFeedback(`Reset triggered for ${u.email}.`) } catch (err) { setError(err instanceof Error ? err.message : "Failed.") }}} className="mr-2 text-[#3f7f8f] hover:underline">Reset Password</button>
                                    <button type="button" onClick={() => handleDeleteUser(u.id)} className="text-red-600 hover:underline">Delete</button>
                                  </>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex items-center justify-between border-t border-[#edf1f5] px-5 py-3">
                      <p className="text-[13px] text-[#6d7888]">Showing {filteredUsers.length === 0 ? 0 : (userPage - 1) * USER_PAGE_SIZE + 1}–{Math.min(userPage * USER_PAGE_SIZE, filteredUsers.length)} of {filteredUsers.length}</p>
                      <div className="flex items-center gap-2">
                        <button type="button" disabled={userPage <= 1} onClick={() => setUserPage((p) => p - 1)} className="rounded border border-[#d8e1ea] h-9 px-3 flex items-center justify-center text-[13px] text-[#5f6e83] disabled:opacity-50 hover:bg-[#f5f7f9]">Previous</button>
                        <span className="text-[13px] text-[#5f6e83]">Page {userPage} of {userTotalPages}</span>
                        <button type="button" disabled={userPage >= userTotalPages} onClick={() => setUserPage((p) => p + 1)} className="rounded border border-[#d8e1ea] h-9 px-3 flex items-center justify-center text-[13px] text-[#5f6e83] disabled:opacity-50 hover:bg-[#f5f7f9]">Next</button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : null}

            {/* ════════════════ VENDOR ════════════════ */}
            {leftMenu === "Vendor" ? (
              <div className="rounded-md border border-[#e0e7ef] bg-white">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#edf1f5] px-5 py-4">
                  <h3 className="text-[18px] font-semibold text-[#2b3340]">Vendor</h3>
                  <div className="flex flex-wrap items-center gap-3">
                    <input type="search" placeholder="Search vendor..." value={vendorSearch} onChange={(e) => { setVendorSearch(e.target.value); setVendorPage(1) }} className="h-9 w-52 rounded border border-[#d8e1ea] px-3 text-[14px]" />
                    <Button type="button" onClick={handleDownloadVendorTemplate} className="rounded border border-[#d8e1ea] bg-white h-9 px-4 flex items-center justify-center text-[14px] font-medium text-[#3f7f8f] hover:bg-[#f5f7f9]">Download Template</Button>
                    <Button type="button" onClick={() => vendorImportRef.current?.click()} className="rounded border border-[#d8e1ea] bg-white h-9 px-4 flex items-center justify-center text-[14px] font-medium text-[#3f7f8f] hover:bg-[#f5f7f9]">Import CSV</Button>
                    <Button type="button" onClick={openCreateVendor} className="rounded bg-[#3f7f8f] h-9 px-4 flex items-center justify-center text-[14px] font-medium text-white hover:bg-[#35707a]">Add Vendor</Button>
                    <input ref={vendorImportRef} type="file" accept=".csv" className="hidden" onChange={handleVendorImport} />
                  </div>
                </div>
                <div className="border-b border-[#edf1f5] bg-[#f9fcfd] px-5 py-3 text-[13px] text-[#6d7888]">
                  Kolom CSV: <span className="font-medium text-[#314158]">name, code, email, whatsapp_number, address, long, lat</span>
                </div>
                {loadingVendors ? <div className="px-5 py-8 text-center text-[14px] text-[#6d7888]">Loading vendors...</div> : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[14px]">
                        <thead><tr className="border-b border-[#ecf1f5] bg-[#f8fafc] text-[#6e7b8e]">
                          <th className="py-3 px-4 font-medium">Name</th><th className="py-3 px-4 font-medium">Code</th><th className="py-3 px-4 font-medium">Email</th><th className="py-3 px-4 font-medium">WhatsApp</th><th className="py-3 px-4 font-medium">Address</th><th className="py-3 px-4 font-medium">Products</th><th className="py-3 px-4 font-medium">Long</th><th className="py-3 px-4 font-medium">Lat</th><th className="w-32 py-3 px-4 font-medium">Actions</th>
                        </tr></thead>
                        <tbody>
                          {paginatedVendors.map((v) => (
                            <tr key={v.id} className="border-b border-[#ecf1f5] text-[#314158] hover:bg-[#fafbfc]">
                              <td className="py-3 px-4 font-medium">{v.name}</td><td className="py-3 px-4">{v.code || "-"}</td><td className="py-3 px-4">{v.email || "-"}</td><td className="py-3 px-4">{v.whatsapp_number || "-"}</td><td className="py-3 px-4">{v.address || "-"}</td><td className="py-3 px-4">{v.product_ids?.length ? <div className="flex flex-wrap gap-2">{v.product_ids.map((productId) => <span key={productId} className="rounded-full bg-[#eef6f7] px-2.5 py-1 text-[12px] font-medium text-[#3f7f8f]">{productNameMap.get(productId) ?? productId}</span>)}</div> : <span className="text-[13px] text-[#6d7888]">No products linked</span>}</td><td className="py-3 px-4">{v.long}</td><td className="py-3 px-4">{v.lat}</td>
                              <td className="py-3 px-4">
                                <button type="button" onClick={() => openEditVendor(v)} className="mr-2 text-[#3f7f8f] hover:underline">Edit</button>
                                <button type="button" onClick={() => handleDeleteVendor(v.id)} className="text-red-600 hover:underline">Delete</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex items-center justify-between border-t border-[#edf1f5] px-5 py-3">
                      <p className="text-[13px] text-[#6d7888]">Showing {filteredVendors.length === 0 ? 0 : (vendorPage - 1) * VENDOR_PAGE_SIZE + 1}–{Math.min(vendorPage * VENDOR_PAGE_SIZE, filteredVendors.length)} of {filteredVendors.length}</p>
                      <div className="flex items-center gap-2">
                        <button type="button" disabled={vendorPage <= 1} onClick={() => setVendorPage((p) => p - 1)} className="rounded border border-[#d8e1ea] h-9 px-3 flex items-center justify-center text-[13px] text-[#5f6e83] disabled:opacity-50 hover:bg-[#f5f7f9]">Previous</button>
                        <span className="text-[13px] text-[#5f6e83]">Page {vendorPage} of {vendorTotalPages}</span>
                        <button type="button" disabled={vendorPage >= vendorTotalPages} onClick={() => setVendorPage((p) => p + 1)} className="rounded border border-[#d8e1ea] h-9 px-3 flex items-center justify-center text-[13px] text-[#5f6e83] disabled:opacity-50 hover:bg-[#f5f7f9]">Next</button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : null}

            {/* ════════════════ INTEGRATION SETTINGS ════════════════ */}
            {leftMenu === "Integration Settings" ? (
              <div className="space-y-6">

                {/* Product Management */}
                <div className="rounded-md border border-[#e0e7ef] bg-white">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#edf1f5] px-5 py-4">
                    <div><h3 className="text-[16px] font-semibold text-[#2b3340]">Product</h3><p className="mt-0.5 text-[13px] text-[#6d7888]">Setiap product punya Typeform ID dan Webhook URL unik. Tempel Webhook URL ke Typeform Admin (Connect → Webhooks) untuk form product tersebut.</p></div>
                    <div className="flex items-center gap-3">
                      <input type="search" placeholder="Search product..." value={productSearch} onChange={(e) => { setProductSearch(e.target.value); setProductPage(1) }} className="h-9 w-52 rounded border border-[#d8e1ea] px-3 text-[14px]" />
                      <Button type="button" onClick={openCreateProduct} className="rounded bg-[#3f7f8f] h-9 px-4 flex items-center justify-center text-[14px] font-medium text-white hover:bg-[#35707a]">Add Product</Button>
                    </div>
                  </div>
                  {loadingProducts ? <div className="px-5 py-6 text-center text-[14px] text-[#6d7888]">Loading...</div> : (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-[14px]">
                          <thead><tr className="border-b border-[#ecf1f5] bg-[#f8fafc] text-[#6e7b8e]">
                            <th className="py-3 px-4 font-medium">ID</th><th className="py-3 px-4 font-medium">Name</th><th className="py-3 px-4 font-medium">Color</th><th className="py-3 px-4 font-medium">Typeform ID</th><th className="py-3 px-4 font-medium">Webhook</th><th className="py-3 px-4 font-medium">Template</th><th className="w-40 py-3 px-4 font-medium">Actions</th>
                          </tr></thead>
                          <tbody>
                            {paginatedProducts.map((p) => (
                              <tr key={p.id} className="border-b border-[#ecf1f5] text-[#314158] hover:bg-[#fafbfc]">
                                <td className="py-3 px-4 font-mono">{p.id}</td>
                                <td className="py-3 px-4 font-medium">{p.name}</td>
                                <td className="py-3 px-4"><div className="flex items-center gap-2"><span className="h-4 w-4 rounded-full border border-[#d8e1ea]" style={{ backgroundColor: p.color_hex || "#fff" }} />{p.color_hex || "-"}</div></td>
                                <td className="py-3 px-4 text-[13px] text-[#6d7888]">{p.typeform_id?.trim() ? <span className="font-mono text-[#314158]">{p.typeform_id}</span> : "Belum diset"}</td>
                                <td className="py-3 px-4 text-[13px]">
                                  {p.typeform_webhook_url?.trim() ? (
                                    <button type="button" onClick={() => copyProductWebhookUrl(p.typeform_webhook_url ?? "")} className="font-mono text-[12px] text-[#3f7f8f] hover:underline">Copy URL</button>
                                  ) : (
                                    <span className="text-[#6d7888]">Belum tersedia</span>
                                  )}
                                </td>
                                <td className="max-w-[360px] py-3 px-4 text-[13px] text-[#6d7888]">
                                  {p.message_template?.trim() ? <span className="block truncate">{p.message_template}</span> : "Fallback ke default template"}
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${p.dealer_message_template?.trim() ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"}`}>
                                      {p.dealer_message_template?.trim() ? "Dealer template set" : "Dealer template not set"}
                                    </span>
                                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${p.customer_message_template?.trim() ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                                      {p.customer_message_template?.trim() ? "Customer template set" : "Customer template not set"}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <button type="button" onClick={() => openProductDetail(p)} className="mr-2 text-[#3f7f8f] hover:underline">View</button>
                                  <button type="button" onClick={() => openEditProduct(p)} className="mr-2 text-[#3f7f8f] hover:underline">Edit</button>
                                  <button type="button" onClick={() => handleDeleteProduct(p.id)} className="text-red-600 hover:underline">Delete</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex items-center justify-between border-t border-[#edf1f5] px-5 py-3">
                        <p className="text-[13px] text-[#6d7888]">{filteredProducts.length} total</p>
                        <div className="flex items-center gap-2">
                          <button type="button" disabled={productPage <= 1} onClick={() => setProductPage((p) => p - 1)} className="rounded border border-[#d8e1ea] h-9 px-3 flex items-center justify-center text-[13px] text-[#5f6e83] disabled:opacity-50 hover:bg-[#f5f7f9]">Previous</button>
                          <span className="text-[13px] text-[#5f6e83]">Page {productPage} of {productTotalPages}</span>
                          <button type="button" disabled={productPage >= productTotalPages} onClick={() => setProductPage((p) => p + 1)} className="rounded border border-[#d8e1ea] h-9 px-3 flex items-center justify-center text-[13px] text-[#5f6e83] disabled:opacity-50 hover:bg-[#f5f7f9]">Next</button>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Vendor Config */}
                <div className="rounded-md border border-[#e0e7ef] bg-white p-5">
                  <h3 className="text-[16px] font-semibold text-[#2b3340]">Default Message Template</h3>
                  <p className="mt-1 text-[13px] text-[#6d7888]">Template fallback global yang dipakai jika product belum punya template sendiri.</p>
                  <div className="mt-4 max-w-4xl space-y-3">
                    <div>
                      <label className="block text-[13px] font-medium text-[#2d3441]">Template</label>
                      <textarea value={defaultMessageTemplate} onChange={(e) => setDefaultMessageTemplate(e.target.value)} rows={8} className="mt-1 w-full rounded border border-[#d8e1ea] px-3 py-2 text-[14px]" placeholder="Tulis template pesan default di sini..." />
                    </div>
                    <div>
                      <p className="text-[12px] font-medium uppercase tracking-wide text-[#5f6e83]">Available placeholders</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {TEMPLATE_PLACEHOLDERS.map((placeholder) => (
                          <span key={placeholder} className="rounded-full border border-[#d8e1ea] bg-[#f8fafc] px-2.5 py-1 font-mono text-[12px] text-[#4a5565]">
                            {placeholder}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button type="button" disabled={savingDefaultMessageTemplate} onClick={handleSaveDefaultMessageTemplate} className="rounded bg-[#3f7f8f] h-9 px-4 flex items-center justify-center text-[14px] font-medium text-white hover:bg-[#35707a] disabled:opacity-50">{savingDefaultMessageTemplate ? "Saving..." : "Save Default Template"}</button>
                  </div>
                </div>

                <div className="rounded-md border border-[#e0e7ef] bg-white p-5">
                  <h3 className="text-[16px] font-semibold text-[#2b3340]">Vendor Distribution</h3>
                  <p className="mt-1 text-[13px] text-[#6d7888]">Strategi distribusi lead ke vendor.</p>
                  <div className="mt-4 space-y-3">
                    {(["by_alphabet", "by_performance"] as DistributionType[]).map((t) => (
                      <label key={t} className="flex cursor-pointer items-start gap-3 rounded border border-[#d8e1ea] p-4">
                        <input type="radio" checked={vendorDistributionType === t} onChange={() => setVendorDistributionType(t)} className="mt-1 h-4 w-4" />
                        <span>
                          <span className="block text-[14px] font-medium text-[#2d3441]">{t === "by_alphabet" ? "By Alphabet" : "By Performance"}</span>
                          <span className="block text-[13px] text-[#6d7888]">{t === "by_alphabet" ? "Assign vendor secara alfabetis." : "Assign vendor berdasarkan performa."}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <button type="button" disabled={savingVendorConfig} onClick={handleSaveVendorConfig} className="mt-4 rounded bg-[#3f7f8f] h-9 px-4 flex items-center justify-center text-[14px] font-medium text-white hover:bg-[#35707a] disabled:opacity-50">{savingVendorConfig ? "Saving..." : "Save"}</button>
                </div>

                {/* Auto Assign */}
                <div className="rounded-md border border-[#e0e7ef] bg-white p-5">
                  <h3 className="text-[16px] font-semibold text-[#2b3340]">Auto Assign Cron</h3>
                  <p className="mt-1 text-[13px] text-[#6d7888]">Assign semua lead unassigned otomatis setiap 5 menit secara round-robin.</p>
                  <div className="mt-4 flex items-center justify-between rounded-md border border-[#d8e1ea] bg-[#f8fafc] p-4">
                    <div>
                      <p className="text-[14px] font-semibold text-[#2d3441]">Auto Assign Lead</p>
                      <p className="mt-0.5 text-[13px] text-[#6d7888]">{autoAssignEnabled ? "Aktif — jalan setiap 5 menit" : "Nonaktif"}</p>
                    </div>
                    <button type="button" disabled={savingAutoAssign} onClick={() => handleToggleAutoAssign(!autoAssignEnabled)}
                      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 disabled:opacity-60 ${autoAssignEnabled ? "bg-[#3f7f8f]" : "bg-[#d1d9e0]"}`}>
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ${autoAssignEnabled ? "translate-x-5" : "translate-x-0"}`} />
                    </button>
                  </div>
                </div>

                {/* Email Settings */}
                <div className="rounded-md border border-[#e0e7ef] bg-white p-5">
                  <h3 className="text-[16px] font-semibold text-[#2b3340]">Email (Gmail)</h3>
                  <p className="mt-1 text-[13px] text-[#6d7888]">Kirim email dari Gmail Anda (misal: reset password). Pakai Alamat Gmail + App Password.</p>
                  <div className="mt-4 max-w-md space-y-3">
                    <div>
                      <label className="block text-[13px] font-medium text-[#2d3441]">Alamat Gmail (pengirim)</label>
                      <input type="email" value={gmailEmail} onChange={(e) => setGmailEmail(e.target.value)} placeholder="anda@gmail.com" className="mt-1 h-10 w-full rounded border border-[#d8e1ea] px-3 text-[14px]" />
                    </div>
                    <div>
                      <label className="block text-[13px] font-medium text-[#2d3441]">App Password (Gmail)</label>
                      <input type="text" value={emailToken} onChange={(e) => setEmailToken(e.target.value)} placeholder="16 karakter dari Google Account" className="mt-1 h-10 w-full rounded border border-[#d8e1ea] px-3 text-[14px]" />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" disabled={savingSettings} onClick={async () => { await saveSetting("gmail_email", gmailEmail, ""); await saveSetting("gmail_token", emailToken, "Gmail settings updated.") }} className="rounded bg-[#3f7f8f] h-9 px-4 flex items-center justify-center text-[14px] font-medium text-white hover:bg-[#35707a] disabled:opacity-50">{savingSettings ? "Saving..." : "Save"}</button>
                      <button
                        type="button"
                        disabled={!gmailEmail.trim() || !emailToken}
                        onClick={() => { setTestEmailTo(""); setTestEmailModalOpen(true) }}
                        className="rounded border border-[#3f7f8f] bg-white h-9 px-4 flex items-center justify-center text-[14px] font-medium text-[#3f7f8f] disabled:cursor-not-allowed disabled:opacity-50 hover:bg-[#e8f4f6]"
                      >
                        Testing Email
                      </button>
                    </div>
                  </div>
                </div>

                {/* Telegram */}
                <div className="rounded-md border border-[#e0e7ef] bg-white p-5">
                  <h3 className="text-[16px] font-semibold text-[#2b3340]">Telegram</h3>
                  <p className="mt-1 text-[13px] text-[#6d7888]">Hubungkan Telegram bot untuk notifikasi.</p>
                  <div className="mt-4 max-w-md">
                    <label className="block text-[13px] font-medium text-[#2d3441]">Telegram Bot Token</label>
                    <input type="text" value={telegramToken} onChange={(e) => setTelegramToken(e.target.value)} className="mt-1 h-10 w-full rounded border border-[#d8e1ea] px-3 text-[14px]" />
                    <button type="button" disabled={savingSettings} onClick={() => saveSetting("telegram_token", telegramToken, "Telegram token updated.")} className="mt-3 rounded bg-[#3f7f8f] h-9 px-4 flex items-center justify-center text-[14px] font-medium text-white hover:bg-[#35707a] disabled:opacity-50">{savingSettings ? "Saving..." : "Save"}</button>
                  </div>
                </div>

                {/* Active WhatsApp Provider */}
                <div className="rounded-md border border-[#e0e7ef] bg-white p-5">
                  <h3 className="text-[16px] font-semibold text-[#2b3340]">Active WhatsApp Provider</h3>
                  <p className="mt-1 text-[13px] text-[#6d7888]">Pilih provider yang dipakai untuk kirim pesan WhatsApp saat lead di-assign (berlaku global untuk semua product).</p>
                  <div className="mt-4 space-y-3">
                    {(["waha", "waba"] as const).map((p) => (
                      <label key={p} className="flex cursor-pointer items-start gap-3 rounded border border-[#d8e1ea] p-4">
                        <input type="radio" checked={whatsappProvider === p} onChange={() => { setWhatsappProvider(p); saveSetting("whatsapp_provider", p, "Active WhatsApp provider updated.") }} className="mt-1 h-4 w-4" />
                        <span>
                          <span className="block text-[14px] font-medium text-[#2d3441]">{p === "waha" ? "WAHA (self-hosted)" : "AppSHD (WABA resmi)"}</span>
                          <span className="block text-[13px] text-[#6d7888]">{p === "waha" ? "WhatsApp Web gateway, mendukung tombol interaktif." : "WhatsApp Business API resmi, butuh template yang sudah disetujui BSP."}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* WAHA */}
                {whatsappProvider === "waha" ? (
                  <div className="rounded-md border border-[#e0e7ef] bg-white p-5">
                    <h3 className="text-[16px] font-semibold text-[#2b3340]">WAHA (WhatsApp)</h3>
                    <p className="mt-1 text-[13px] text-[#6d7888]">Konfigurasi WAHA untuk kirim pesan WhatsApp ke vendor dan customer saat lead di-assign.</p>
                    <div className="mt-4 max-w-xl space-y-4">
                      <div><label className="block text-[13px] font-medium text-[#2d3441]">Base URL</label><input type="text" value={wahaBaseUrl} onChange={(e) => setWahaBaseUrl(e.target.value)} className="mt-1 h-10 w-full rounded border border-[#d8e1ea] px-3 text-[14px]" /></div>
                      <div><label className="block text-[13px] font-medium text-[#2d3441]">Session Name</label><input type="text" value={wahaSessionName} onChange={(e) => setWahaSessionName(e.target.value)} className="mt-1 h-10 w-full rounded border border-[#d8e1ea] px-3 text-[14px]" /></div>
                      <div><label className="block text-[13px] font-medium text-[#2d3441]">API Key</label><input type="text" value={wahaSecretKey} onChange={(e) => setWahaSecretKey(e.target.value)} className="mt-1 h-10 w-full rounded border border-[#d8e1ea] px-3 text-[14px]" /></div>
                      <button type="button" disabled={savingSettings} onClick={async () => { await saveSetting("waha_base_url", wahaBaseUrl, ""); await saveSetting("waha_session_name", wahaSessionName, ""); await saveSetting("waha_secret_access_key", wahaSecretKey, "WAHA settings updated.") }} className="rounded bg-[#3f7f8f] h-9 px-4 flex items-center justify-center text-[14px] font-medium text-white hover:bg-[#35707a] disabled:opacity-50">{savingSettings ? "Saving..." : "Save"}</button>
                    </div>
                  </div>
                ) : null}

                {/* AppSHD (WABA) */}
                {whatsappProvider === "waba" ? (
                  <div className="rounded-md border border-[#e0e7ef] bg-white p-5">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[16px] font-semibold text-[#2b3340]">AppSHD (WABA)</h3>
                      <span className="rounded bg-[#3f7f8f] px-2 py-0.5 text-[10px] font-medium text-white">Official WABA API</span>
                    </div>
                    <p className="mt-1 text-[13px] text-[#6d7888]">Konfigurasi WhatsApp Business API resmi via BSP AppSHD.</p>
                    <div className="mt-4 max-w-xl space-y-4">
                      <div><label className="block text-[13px] font-medium text-[#2d3441]">Base URL</label><input type="text" value={appshdBaseUrl} onChange={(e) => setAppshdBaseUrl(e.target.value)} placeholder="https://api.your-domain.com" className="mt-1 h-10 w-full rounded border border-[#d8e1ea] px-3 text-[14px]" /></div>
                      <div><label className="block text-[13px] font-medium text-[#2d3441]">API Key</label><input type="text" value={appshdApiKey} onChange={(e) => setAppshdApiKey(e.target.value)} className="mt-1 h-10 w-full rounded border border-[#d8e1ea] px-3 text-[14px]" /></div>
                      <div><label className="block text-[13px] font-medium text-[#2d3441]">Client ID</label><input type="text" value={appshdClientId} onChange={(e) => setAppshdClientId(e.target.value)} className="mt-1 h-10 w-full rounded border border-[#d8e1ea] px-3 text-[14px]" /></div>
                      <div><label className="block text-[13px] font-medium text-[#2d3441]">Sender ID (WA)</label><input type="text" value={appshdSenderId} onChange={(e) => setAppshdSenderId(e.target.value)} className="mt-1 h-10 w-full rounded border border-[#d8e1ea] px-3 text-[14px]" /></div>
                      <div>
                        <label className="block text-[13px] font-medium text-[#2d3441]">Dealer Template Code (default)</label>
                        <input type="text" value={appshdDealerTemplateCode} onChange={(e) => setAppshdDealerTemplateCode(e.target.value)} className="mt-1 h-10 w-full rounded border border-[#d8e1ea] px-3 text-[14px]" />
                      </div>
                      <div>
                        <label className="block text-[13px] font-medium text-[#2d3441]">Customer Template Code (default)</label>
                        <input type="text" value={appshdCustomerTemplateCode} onChange={(e) => setAppshdCustomerTemplateCode(e.target.value)} className="mt-1 h-10 w-full rounded border border-[#d8e1ea] px-3 text-[14px]" />
                      </div>
                      <p className="text-[12px] text-[#8a95a3]">Kode template WA yang sudah disetujui BSP AppSHD. Kosongkan jika belum disetujui — pengiriman WABA akan gagal tanpa ini. Bisa di-override per product di form Product.</p>
                      <button type="button" disabled={savingSettings} onClick={async () => {
                        await saveSetting("appshd_base_url", appshdBaseUrl, "")
                        await saveSetting("appshd_api_key", appshdApiKey, "")
                        await saveSetting("appshd_client_id", appshdClientId, "")
                        await saveSetting("appshd_sender_id_wa", appshdSenderId, "")
                        await saveSetting("appshd_dealer_template_code", appshdDealerTemplateCode, "")
                        await saveSetting("appshd_customer_template_code", appshdCustomerTemplateCode, "AppSHD settings updated.")
                      }} className="rounded bg-[#3f7f8f] h-9 px-4 flex items-center justify-center text-[14px] font-medium text-white hover:bg-[#35707a] disabled:opacity-50">{savingSettings ? "Saving..." : "Save"}</button>
                    </div>
                  </div>
                ) : null}

              </div>
            ) : null}

            {/* ════════════════ WHATSAPP LOG ════════════════ */}
            {leftMenu === "WhatsApp Log" ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-[18px] font-semibold text-[#2b3340]">WhatsApp Log</h3>
                    <p className="mt-0.5 text-[13px] text-[#6d7888]">Log pengiriman pesan WA dari proses assign lead.</p>
                  </div>
                  <button type="button" onClick={() => { setLogLoaded(false); setLogPage(1); loadLogs(1) }} disabled={loadingLogs}
                    className="flex items-center justify-center gap-2 rounded border border-[#d8e1ea] bg-white h-9 px-4 text-[14px] font-medium text-[#3f7f8f] hover:bg-[#f0f9fa] disabled:opacity-50">
                    <RefreshCw className={`h-4 w-4 ${loadingLogs ? "animate-spin" : ""}`} /> Refresh
                  </button>
                </div>

                {/* Stat cards */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: "Total (halaman)", value: msgLogs.length, cls: "bg-white text-[#2d3441]" },
                    { label: "Sent", value: msgLogs.filter((l) => l.status === "sent").length, cls: "bg-emerald-50 text-emerald-700" },
                    { label: "Failed", value: msgLogs.filter((l) => l.status === "failed").length, cls: "bg-red-50 text-red-700" },
                    { label: "Skipped", value: msgLogs.filter((l) => l.status === "skipped").length, cls: "bg-amber-50 text-amber-700" },
                  ].map((c) => (
                    <div key={c.label} className={`rounded-md border border-[#e0e7ef] px-4 py-3 ${c.cls}`}>
                      <p className="text-[12px] font-medium opacity-70">{c.label}</p>
                      <p className="mt-1 text-[24px] font-bold leading-none">{c.value}</p>
                    </div>
                  ))}
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex gap-1 rounded border border-[#d8e1ea] bg-white p-1">
                    {(["all", "sent", "failed", "skipped", "pending"] as LogStatusFilter[]).map((s) => (
                      <button key={s} type="button" onClick={() => setLogStatus(s)} className={`rounded px-3 py-1.5 text-[13px] font-medium transition ${logStatus === s ? "bg-[#3f7f8f] text-white" : "text-[#5f6e83] hover:bg-[#f5f7f9]"}`}>
                        {s === "all" ? "All Status" : LOG_STATUS_LABEL[s]}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-1 rounded border border-[#d8e1ea] bg-white p-1">
                    {(["all", "dealer", "customer"] as LogRecipientFilter[]).map((r) => (
                      <button key={r} type="button" onClick={() => setLogRecipient(r)} className={`rounded px-3 py-1.5 text-[13px] font-medium capitalize transition ${logRecipient === r ? "bg-[#3f7f8f] text-white" : "text-[#5f6e83] hover:bg-[#f5f7f9]"}`}>
                        {r === "all" ? "All Penerima" : r}
                      </button>
                    ))}
                  </div>
                  <form onSubmit={(e) => { e.preventDefault(); setLogPage(1); loadLogs(1) }} className="flex items-center gap-2">
                    <input type="text" placeholder="Cari Lead ID..." value={logLeadId} onChange={(e) => setLogLeadId(e.target.value)} className="h-9 w-36 rounded border border-[#d8e1ea] px-3 text-[14px]" />
                    <button type="submit" className="h-9 rounded bg-[#3f7f8f] px-3 text-[13px] font-medium text-white hover:bg-[#35707a]">Cari</button>
                    {logLeadId && <button type="button" onClick={() => { setLogLeadId(""); setLogPage(1); loadLogs(1) }} className="h-9 rounded border border-[#d8e1ea] px-3 text-[13px] text-[#5f6e83] hover:bg-[#f5f7f9]">Reset</button>}
                  </form>
                </div>

                {/* Table */}
                <div className="rounded-md border border-[#e0e7ef] bg-white">
                  {loadingLogs ? <div className="px-5 py-10 text-center text-[14px] text-[#6d7888]">Memuat log...</div> : msgLogs.length === 0 ? <div className="px-5 py-10 text-center text-[14px] text-[#6d7888]">Tidak ada log ditemukan.</div> : (
                    <div className="overflow-x-auto rounded-md">
                      <table className="w-full min-w-[860px] text-left text-[14px]">
                        <thead><tr className="border-b border-[#ecf1f5] bg-[#f8fafc] text-[#6e7b8e]">
                          <th className="whitespace-nowrap py-3 px-4 font-medium">Lead ID</th>
                          <th className="whitespace-nowrap py-3 px-4 font-medium">Penerima</th>
                          <th className="whitespace-nowrap py-3 px-4 font-medium">Provider</th>
                          <th className="whitespace-nowrap py-3 px-4 font-medium">No. Tujuan</th>
                          <th className="whitespace-nowrap py-3 px-4 font-medium">Vendor</th>
                          <th className="whitespace-nowrap py-3 px-4 font-medium">Status</th>
                          <th className="whitespace-nowrap py-3 px-4 font-medium">Error</th>
                          <th className="whitespace-nowrap py-3 px-4 font-medium">Sent At</th>
                          <th className="whitespace-nowrap py-3 px-4 font-medium">Created At</th>
                          <th className="whitespace-nowrap py-3 px-4 font-medium">Pesan</th>
                        </tr></thead>
                        <tbody>
                          {msgLogs.map((log) => (
                            <>
                              <tr key={log.id} className="border-b border-[#ecf1f5] text-[#314158] hover:bg-[#fafbfc]">
                                <td className="py-3 px-4 font-mono font-medium">{log.lead_id}</td>
                                <td className="py-3 px-4"><span className={`inline-block rounded-full border px-2.5 py-0.5 text-[12px] font-medium capitalize ${LOG_RECIPIENT_STYLE[log.recipient_type] ?? "bg-gray-100 text-gray-600"}`}>{log.recipient_type}</span></td>
                                <td className="py-3 px-4"><span className={`inline-block rounded-full border px-2.5 py-0.5 text-[12px] font-medium uppercase ${log.provider === "waba" ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-teal-50 text-teal-700 border-teal-200"}`}>{log.provider}</span></td>
                                <td className="py-3 px-4 font-mono text-[13px]">{log.recipient_number || "-"}</td>
                                <td className="py-3 px-4 text-[13px]">{log.vendor_name || "-"}</td>
                                <td className="py-3 px-4"><span className={`inline-block rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${LOG_STATUS_STYLE[log.status] ?? "bg-gray-100 text-gray-600"}`}>{LOG_STATUS_LABEL[log.status] ?? log.status}</span></td>
                                <td className="max-w-[180px] py-3 px-4 text-[12px] text-red-600">{log.error_message ? <span title={log.error_message} className="block truncate">{log.error_message}</span> : "-"}</td>
                                <td className="py-3 px-4 text-[13px] text-[#6d7888]">{formatDateTime(log.sent_at)}</td>
                                <td className="py-3 px-4 text-[13px] text-[#6d7888]">{formatDateTime(log.created_at)}</td>
                                <td className="py-3 px-4"><button type="button" onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)} className="rounded border border-[#d8e1ea] px-2 py-1 text-[12px] text-[#5f6e83] hover:bg-[#f5f7f9]">{expandedLogId === log.id ? "Tutup" : "Lihat"}</button></td>
                              </tr>
                              {expandedLogId === log.id ? (
                                <tr key={`${log.id}-exp`} className="bg-[#f8fafc]">
                                  <td colSpan={10} className="px-4 py-4">
                                    <p className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-[#5f6e83]">Isi Pesan</p>
                                    <pre className="whitespace-pre-wrap rounded border border-[#e0e7ef] bg-white px-4 py-3 text-[13px] leading-relaxed text-[#2d3441]">{log.message_body}</pre>
                                  </td>
                                </tr>
                              ) : null}
                            </>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-[#edf1f5] px-4 py-3">
                    <span className="text-[14px] text-[#6a778a]">{logTotal} total · halaman {logPage} dari {logTotalPages}</span>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setLogPage((p) => Math.max(1, p - 1))} disabled={logPage <= 1} className="rounded border border-[#d8e1ea] h-9 px-3 flex items-center justify-center text-[14px] text-[#5f6e83] disabled:opacity-50 hover:bg-[#f5f7f9]">‹ Prev</button>
                      <span className="rounded bg-[#3f7f8f] px-3 py-1.5 text-[14px] font-medium text-white">{logPage}</span>
                      <button type="button" onClick={() => setLogPage((p) => Math.min(logTotalPages, p + 1))} disabled={logPage >= logTotalPages} className="rounded border border-[#d8e1ea] h-9 px-3 flex items-center justify-center text-[14px] text-[#5f6e83] disabled:opacity-50 hover:bg-[#f5f7f9]">Next ›</button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

          </div>
        </div>
      </section>

      {/* Modals */}
      {userModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-md bg-white p-6 shadow-xl">
            <h3 className="text-[18px] font-semibold text-[#2d3441]">{editingUser ? "Edit User" : "Create User"}</h3>
            <form onSubmit={handleSaveUser} className="mt-4 space-y-4">
              <div><label className="block text-[13px] font-medium text-[#2d3441]">Name</label><input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} required className="mt-1 h-10 w-full rounded border border-[#d8e1ea] px-3 text-[14px]" /></div>
              <div><label className="block text-[13px] font-medium text-[#2d3441]">Email</label><input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} required className="mt-1 h-10 w-full rounded border border-[#d8e1ea] px-3 text-[14px]" /></div>
              {!editingUser && <div><label className="block text-[13px] font-medium text-[#2d3441]">Password</label><div className="mt-1 flex gap-2"><input type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} required className="h-10 flex-1 rounded border border-[#d8e1ea] px-3 text-[14px]" /><button type="button" onClick={generatePassword} className="shrink-0 rounded border border-[#d8e1ea] h-9 px-3 flex items-center justify-center text-[13px] font-medium text-[#5f6e83] hover:bg-[#f5f7f9]">Generate</button></div></div>}
              <div><label className="block text-[13px] font-medium text-[#2d3441]">Role</label><div className="mt-2 flex gap-4"><label className="flex cursor-pointer items-center gap-2"><input type="radio" checked={formRole === "Admin"} onChange={() => setFormRole("Admin")} className="h-4 w-4" /><span className="text-[14px]">Admin</span></label><label className="flex cursor-pointer items-center gap-2"><input type="radio" checked={formRole === "Staff"} onChange={() => setFormRole("Staff")} className="h-4 w-4" /><span className="text-[14px]">Staff</span></label></div></div>
              {error ? <p className="text-[12px] text-red-600">{error}</p> : null}
              <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setUserModalOpen(false)} className="rounded border border-[#d8e1ea] h-9 px-4 flex items-center justify-center text-[14px] font-medium text-[#5f6e83] hover:bg-[#f5f7f9]">Cancel</button><button type="submit" disabled={savingUser} className="rounded bg-[#3f7f8f] h-9 px-4 flex items-center justify-center text-[14px] font-medium text-white hover:bg-[#35707a] disabled:opacity-50">{savingUser ? "Saving..." : "Save"}</button></div>
            </form>
          </div>
        </div>
      ) : null}

      {vendorModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-md bg-white p-6 shadow-xl">
            <h3 className="text-[18px] font-semibold text-[#2d3441]">{editingVendor ? "Edit Vendor" : "Create Vendor"}</h3>
            <form onSubmit={handleSaveVendor} className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2"><label className="block text-[13px] font-medium text-[#2d3441]">Name</label><input type="text" value={vName} onChange={(e) => setVName(e.target.value)} required className="mt-1 h-10 w-full rounded border border-[#d8e1ea] px-3 text-[14px]" /></div>
              <div><label className="block text-[13px] font-medium text-[#2d3441]">Code</label><input type="text" value={vCode} onChange={(e) => setVCode(e.target.value)} className="mt-1 h-10 w-full rounded border border-[#d8e1ea] px-3 text-[14px]" /></div>
              <div><label className="block text-[13px] font-medium text-[#2d3441]">Email</label><input type="email" value={vEmail} onChange={(e) => setVEmail(e.target.value)} className="mt-1 h-10 w-full rounded border border-[#d8e1ea] px-3 text-[14px]" /></div>
              <div><label className="block text-[13px] font-medium text-[#2d3441]">WhatsApp Number</label><input type="text" value={vWa} onChange={(e) => setVWa(e.target.value)} className="mt-1 h-10 w-full rounded border border-[#d8e1ea] px-3 text-[14px]" /></div>
              <div><label className="block text-[13px] font-medium text-[#2d3441]">Address</label><input type="text" value={vAddress} onChange={(e) => setVAddress(e.target.value)} className="mt-1 h-10 w-full rounded border border-[#d8e1ea] px-3 text-[14px]" /></div>
              <div className="md:col-span-2">
                <label className="block text-[13px] font-medium text-[#2d3441]">Handled Products</label>
                <div className="mt-1 rounded border border-[#d8e1ea] p-3">
                  {products.length === 0 ? (
                    <p className="text-[13px] text-[#6d7888]">Belum ada product yang tersedia.</p>
                  ) : (
                    <div className="grid gap-2 md:grid-cols-2">
                      {products.map((product) => (
                        <label key={product.id} className="flex cursor-pointer items-start gap-3 rounded border border-[#edf1f5] px-3 py-2">
                          <input type="checkbox" checked={vProductIds.includes(product.id)} onChange={() => toggleVendorProduct(product.id)} className="mt-0.5 h-4 w-4" />
                          <span>
                            <span className="block text-[14px] font-medium text-[#2d3441]">{product.name}</span>
                            <span className="block text-[12px] font-mono text-[#6d7888]">{product.id}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <p className="mt-2 text-[12px] text-[#6d7888]">Array ini boleh kosong, tetapi hanya vendor yang terhubung ke product lead yang akan muncul saat manual assign.</p>
              </div>
              <div><label className="block text-[13px] font-medium text-[#2d3441]">Long</label><input type="number" step="0.00000001" value={vLong} onChange={(e) => setVLong(e.target.value)} className="mt-1 h-10 w-full rounded border border-[#d8e1ea] px-3 text-[14px]" /></div>
              <div><label className="block text-[13px] font-medium text-[#2d3441]">Lat</label><input type="number" step="0.00000001" value={vLat} onChange={(e) => setVLat(e.target.value)} className="mt-1 h-10 w-full rounded border border-[#d8e1ea] px-3 text-[14px]" /></div>
              {error ? <p className="text-[12px] text-red-600 md:col-span-2">{error}</p> : null}
              <div className="mt-2 flex justify-end gap-3 md:col-span-2"><button type="button" onClick={() => setVendorModalOpen(false)} className="rounded border border-[#d8e1ea] h-9 px-4 flex items-center justify-center text-[14px] font-medium text-[#5f6e83] hover:bg-[#f5f7f9]">Cancel</button><button type="submit" disabled={savingVendor} className="rounded bg-[#3f7f8f] h-9 px-4 flex items-center justify-center text-[14px] font-medium text-white hover:bg-[#35707a] disabled:opacity-50">{savingVendor ? "Saving..." : "Save"}</button></div>
            </form>
          </div>
        </div>
      ) : null}

      {productModalOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4">
          <div className="flex min-h-full items-start justify-center py-4 sm:items-center">
            <div className="flex w-full max-w-2xl max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-md bg-white shadow-xl">
              <div className="border-b border-[#edf1f5] px-6 py-5">
                <h3 className="text-[18px] font-semibold text-[#2d3441]">{editingProduct ? "Edit Product" : "Create Product"}</h3>
              </div>
              <form onSubmit={handleSaveProduct} className="flex min-h-0 flex-1 flex-col">
                <div className="flex-1 overflow-y-auto px-6 py-5">
                  <div className="grid gap-4 pr-1 md:grid-cols-2">
                    <div><label className="block text-[13px] font-medium text-[#2d3441]">ID</label><input type="text" value={productId} onChange={(e) => setProductId(e.target.value)} required className="mt-1 h-10 w-full rounded border border-[#d8e1ea] px-3 font-mono text-[14px]" /></div>
                    <div><label className="block text-[13px] font-medium text-[#2d3441]">Name</label><input type="text" value={productName} onChange={(e) => setProductName(e.target.value)} required className="mt-1 h-10 w-full rounded border border-[#d8e1ea] px-3 text-[14px]" /></div>
                    <div><label className="block text-[13px] font-medium text-[#2d3441]">Color Hex</label><div className="mt-1 flex gap-2"><input type="text" value={productColorHex} onChange={(e) => setProductColorHex(e.target.value)} placeholder="#3f7f8f" className="h-10 flex-1 rounded border border-[#d8e1ea] px-3 text-[14px]" /><input type="color" value={productColorHex || "#3f7f8f"} onChange={(e) => setProductColorHex(e.target.value)} className="h-10 w-12 rounded border border-[#d8e1ea] bg-white p-1" /></div></div>
                    <div>
                      <label className="block text-[13px] font-medium text-[#2d3441]">Typeform ID</label>
                      <input type="text" value={productTypeformId} onChange={(e) => setProductTypeformId(e.target.value)} className="mt-1 h-10 w-full rounded border border-[#d8e1ea] px-3 font-mono text-[14px]" placeholder="K3NjgJQR" />
                      <p className="mt-1 text-[12px] text-[#6d7888]">ID form dari URL Typeform, misalnya `wellous.typeform.com/to/K3NjgJQR`.</p>
                    </div>
                    {editingProduct?.typeform_webhook_url?.trim() ? (
                      <div className="md:col-span-2 rounded border border-[#dbeafe] bg-[#eff6ff] p-4">
                        <label className="block text-[13px] font-medium text-[#1e40af]">Typeform Webhook URL</label>
                        <p className="mt-1 text-[12px] text-[#3b82f6]">Tempel URL ini di Typeform Admin → Connect → Webhooks untuk form product ini.</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <input type="text" readOnly value={editingProduct.typeform_webhook_url} className="h-10 min-w-0 flex-1 rounded border border-[#bfdbfe] bg-white px-3 font-mono text-[12px] text-[#1e3a8a]" />
                          <button type="button" onClick={() => copyProductWebhookUrl(editingProduct.typeform_webhook_url ?? "")} className="rounded border border-[#93c5fd] bg-white px-3 text-[13px] font-medium text-[#1d4ed8] hover:bg-[#dbeafe]">Copy</button>
                          <button type="button" disabled={regeneratingProductWebhook} onClick={() => handleRegenerateProductWebhook(editingProduct)} className="rounded border border-[#93c5fd] bg-white px-3 text-[13px] font-medium text-[#1d4ed8] hover:bg-[#dbeafe] disabled:opacity-50">Regenerate</button>
                        </div>
                      </div>
                    ) : (
                      <div className="md:col-span-2 rounded border border-dashed border-[#d8e1ea] px-4 py-3 text-[12px] text-[#6d7888]">
                        Typeform Webhook URL akan tersedia setelah product disimpan.
                      </div>
                    )}
                    <div className="md:col-span-2">
                      <label className="block text-[13px] font-medium text-[#2d3441]">Dealer Message Template</label>
                      <textarea value={productDealerMessageTemplate} onChange={(e) => setProductDealerMessageTemplate(e.target.value)} rows={6} className="mt-1 w-full rounded border border-[#d8e1ea] px-3 py-2 text-[14px]" placeholder="Template khusus untuk dealer/vendor." />
                      <p className="mt-2 text-[12px] text-[#6d7888]">Used for messages sent to dealer/vendor.</p>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[13px] font-medium text-[#2d3441]">Customer Message Template</label>
                      <textarea value={productCustomerMessageTemplate} onChange={(e) => setProductCustomerMessageTemplate(e.target.value)} rows={6} className="mt-1 w-full rounded border border-[#d8e1ea] px-3 py-2 text-[14px]" placeholder="Template khusus untuk customer." />
                      <p className="mt-2 text-[12px] text-[#6d7888]">Used for messages sent to customer.</p>
                    </div>
                    <div className="md:col-span-2">
                      <div className="mt-2 flex flex-wrap gap-2">
                        {TEMPLATE_PLACEHOLDERS.map((placeholder) => (
                          <span key={placeholder} className="rounded-full border border-[#d8e1ea] bg-[#f8fafc] px-2.5 py-1 font-mono text-[12px] text-[#4a5565]">
                            {placeholder}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[13px] font-medium text-[#2d3441]">Dealer Template Code (WABA)</label>
                      <input type="text" value={productDealerTemplateCode} onChange={(e) => setProductDealerTemplateCode(e.target.value)} className="mt-1 h-10 w-full rounded border border-[#d8e1ea] px-3 font-mono text-[14px]" placeholder="dealer_assigned_lead" />
                    </div>
                    <div>
                      <label className="block text-[13px] font-medium text-[#2d3441]">Customer Template Code (WABA)</label>
                      <input type="text" value={productCustomerTemplateCode} onChange={(e) => setProductCustomerTemplateCode(e.target.value)} className="mt-1 h-10 w-full rounded border border-[#d8e1ea] px-3 font-mono text-[14px]" placeholder="customer_assigned_lead" />
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-[12px] text-[#8a95a3]">Kode template resmi WABA/AppSHD (bukan teks bebas). Isi hanya jika sudah disetujui BSP — variabel dikirim berurutan sesuai posisi, bukan placeholder <code>{"{{...}}"}</code> di atas. Kosongkan untuk pakai default dari Integration Settings.</p>
                    </div>
                    {error ? <p className="text-[12px] text-red-600">{error}</p> : null}
                  </div>
                </div>
                <div className="border-t border-[#edf1f5] bg-white px-6 py-4">
                  <div className="flex justify-end gap-3">
                    <button type="button" onClick={() => setProductModalOpen(false)} className="rounded border border-[#d8e1ea] h-9 px-4 flex items-center justify-center text-[14px] font-medium text-[#5f6e83] hover:bg-[#f5f7f9]">Cancel</button>
                    <button type="submit" disabled={savingProduct} className="rounded bg-[#3f7f8f] h-9 px-4 flex items-center justify-center text-[14px] font-medium text-white hover:bg-[#35707a] disabled:opacity-50">{savingProduct ? "Saving..." : "Save"}</button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {viewingProduct ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-md bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-[18px] font-semibold text-[#2d3441]">Product Detail</h3>
                <p className="mt-1 text-[13px] text-[#6d7888]">Setiap product punya webhook URL unik. Pastikan URL ini sudah ditempel di Typeform Admin untuk form dengan Typeform ID yang sama.</p>
              </div>
              <button type="button" onClick={() => setViewingProduct(null)} className="rounded border border-[#d8e1ea] h-9 px-3 flex items-center justify-center text-[13px] text-[#5f6e83] hover:bg-[#f5f7f9]">Close</button>
            </div>

            {loadingProductDetail ? (
              <div className="mt-6 rounded border border-[#d8e1ea] px-4 py-8 text-center text-[14px] text-[#6d7888]">Loading product detail...</div>
            ) : (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded border border-[#edf1f5] p-4">
                  <p className="text-[12px] font-medium uppercase tracking-wide text-[#5f6e83]">Product ID</p>
                  <p className="mt-2 font-mono text-[14px] text-[#2d3441]">{viewingProduct.id}</p>
                </div>
                <div className="rounded border border-[#edf1f5] p-4">
                  <p className="text-[12px] font-medium uppercase tracking-wide text-[#5f6e83]">Name</p>
                  <p className="mt-2 text-[14px] text-[#2d3441]">{viewingProduct.name}</p>
                </div>
                <div className="rounded border border-[#edf1f5] p-4 md:col-span-2">
                  <p className="text-[12px] font-medium uppercase tracking-wide text-[#5f6e83]">Typeform ID</p>
                  <p className="mt-2 text-[14px] text-[#2d3441]">{viewingProduct.typeform_id?.trim() ? <span className="font-mono">{viewingProduct.typeform_id}</span> : "Belum diset"}</p>
                </div>
                <div className="rounded border border-[#edf1f5] p-4 md:col-span-2">
                  <p className="text-[12px] font-medium uppercase tracking-wide text-[#5f6e83]">Typeform Webhook URL</p>
                  {viewingProduct.typeform_webhook_url?.trim() ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <p className="break-all font-mono text-[13px] text-[#2d3441]">{viewingProduct.typeform_webhook_url}</p>
                      <button type="button" onClick={() => copyProductWebhookUrl(viewingProduct.typeform_webhook_url ?? "")} className="rounded border border-[#d8e1ea] px-3 py-1 text-[12px] text-[#3f7f8f] hover:bg-[#f5f7f9]">Copy</button>
                      <button type="button" disabled={regeneratingProductWebhook} onClick={() => handleRegenerateProductWebhook(viewingProduct)} className="rounded border border-[#d8e1ea] px-3 py-1 text-[12px] text-[#3f7f8f] hover:bg-[#f5f7f9] disabled:opacity-50">Regenerate</button>
                    </div>
                  ) : (
                    <p className="mt-2 text-[14px] text-[#6d7888]">Belum tersedia</p>
                  )}
                </div>
                <div className="rounded border border-[#edf1f5] p-4">
                  <p className="text-[12px] font-medium uppercase tracking-wide text-[#5f6e83]">Color Hex</p>
                  <div className="mt-2 flex items-center gap-2 text-[14px] text-[#2d3441]">
                    <span className="h-4 w-4 rounded-full border border-[#d8e1ea]" style={{ backgroundColor: viewingProduct.color_hex || "#fff" }} />
                    {viewingProduct.color_hex || "-"}
                  </div>
                </div>
                <div className="rounded border border-[#edf1f5] p-4 md:col-span-2">
                  <p className="text-[12px] font-medium uppercase tracking-wide text-[#5f6e83]">Dealer Message Template</p>
                  {viewingProduct.dealer_message_template?.trim() ? (
                    <pre className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-[#2d3441]">{viewingProduct.dealer_message_template}</pre>
                  ) : (
                    <p className="mt-2 text-[14px] text-[#6d7888]">Not set. Backend will use the fallback template.</p>
                  )}
                </div>
                <div className="rounded border border-[#edf1f5] p-4 md:col-span-2">
                  <p className="text-[12px] font-medium uppercase tracking-wide text-[#5f6e83]">Customer Message Template</p>
                  {viewingProduct.customer_message_template?.trim() ? (
                    <pre className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-[#2d3441]">{viewingProduct.customer_message_template}</pre>
                  ) : (
                    <p className="mt-2 text-[14px] text-[#6d7888]">Not set. Backend will use the fallback template.</p>
                  )}
                </div>
                <div className="rounded border border-[#edf1f5] p-4">
                  <p className="text-[12px] font-medium uppercase tracking-wide text-[#5f6e83]">Dealer Template Code (WABA)</p>
                  <p className="mt-2 font-mono text-[14px] text-[#2d3441]">{viewingProduct.dealer_template_code?.trim() || "Not set. Uses AppSHD default."}</p>
                </div>
                <div className="rounded border border-[#edf1f5] p-4">
                  <p className="text-[12px] font-medium uppercase tracking-wide text-[#5f6e83]">Customer Template Code (WABA)</p>
                  <p className="mt-2 font-mono text-[14px] text-[#2d3441]">{viewingProduct.customer_template_code?.trim() || "Not set. Uses AppSHD default."}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {testEmailModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-md bg-white p-6 shadow-xl">
            <h3 className="text-[18px] font-semibold text-[#2d3441]">Testing Email</h3>
            <p className="mt-1 text-[14px] text-[#6d7888]">Masukkan alamat email yang akan menerima email percobaan.</p>
            <form
              className="mt-4 space-y-4"
              onSubmit={async (e) => {
                e.preventDefault()
                const to = testEmailTo.trim()
                if (!to) return
                setTestEmailSending(true)
                setError("")
                try {
                  await sendTestEmail(to)
                  setFeedback("Test email terkirim ke " + to + ".")
                  setTestEmailModalOpen(false)
                  setTestEmailTo("")
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Gagal mengirim test email.")
                } finally {
                  setTestEmailSending(false)
                }
              }}
            >
              <div>
                <label className="block text-[13px] font-medium text-[#2d3441]">Email tujuan</label>
                <input type="email" value={testEmailTo} onChange={(e) => setTestEmailTo(e.target.value)} placeholder="contoh@email.com" required className="mt-1 h-10 w-full rounded border border-[#d8e1ea] px-3 text-[14px]" />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => { setTestEmailModalOpen(false); setTestEmailTo("") }} className="rounded border border-[#d8e1ea] h-9 px-4 flex items-center justify-center text-[14px] font-medium text-[#5f6e83] hover:bg-[#f5f7f9]">Batal</button>
                <button type="submit" disabled={testEmailSending} className="rounded bg-[#3f7f8f] h-9 px-4 flex items-center justify-center text-[14px] font-medium text-white hover:bg-[#35707a] disabled:opacity-60">
                  {testEmailSending ? "Mengirim..." : "Kirim Test Email"}
                </button>
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

function ChangePasswordModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) { setError("Passwords do not match."); return }
    setIsSubmitting(true)
    try { await changePassword(currentPassword, newPassword); onSaved() }
    catch (err) { setError(err instanceof Error ? err.message : "Failed.") }
    finally { setIsSubmitting(false) }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-md bg-white p-6 shadow-xl">
        <h3 className="text-[18px] font-semibold text-[#2d3441]">Change Password</h3>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div><label className="block text-[13px] font-medium text-[#2d3441]">Current Password</label><input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required className="mt-1 h-10 w-full rounded border border-[#d8e1ea] px-3 text-[14px]" /></div>
          <div><label className="block text-[13px] font-medium text-[#2d3441]">New Password</label><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required className="mt-1 h-10 w-full rounded border border-[#d8e1ea] px-3 text-[14px]" /></div>
          <div><label className="block text-[13px] font-medium text-[#2d3441]">Confirm New Password</label><input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="mt-1 h-10 w-full rounded border border-[#d8e1ea] px-3 text-[14px]" /></div>
          {error ? <p className="text-[12px] text-red-600">{error}</p> : null}
          <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded border border-[#d8e1ea] h-9 px-4 flex items-center justify-center text-[14px] font-medium text-[#5f6e83] hover:bg-[#f5f7f9]">Cancel</button><button type="submit" disabled={isSubmitting} className="rounded bg-[#3f7f8f] h-9 px-4 flex items-center justify-center text-[14px] font-medium text-white hover:bg-[#35707a] disabled:opacity-50">{isSubmitting ? "Saving..." : "Save"}</button></div>
        </form>
      </div>
    </div>
  )
}

function LogoutConfirmModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-md bg-white p-6 shadow-xl">
        <h3 className="text-[18px] font-semibold text-[#2d3441]">Logout</h3>
        <p className="mt-2 text-[14px] text-[#6d7888]">Are you sure you want to logout?</p>
        <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded border border-[#d8e1ea] h-9 px-4 flex items-center justify-center text-[14px] font-medium text-[#5f6e83] hover:bg-[#f5f7f9]">Cancel</button><button type="button" onClick={onConfirm} className="rounded bg-[#e04b4b] h-9 px-4 flex items-center justify-center text-[14px] font-medium text-white hover:bg-[#c43d3d]">Logout</button></div>
      </div>
    </div>
  )
}

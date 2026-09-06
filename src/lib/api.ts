import { getStoredAuthSession, SESSION_EXPIRED_EVENT, type AuthSession } from "./auth"

export type ApiEnvelope<T> = {
  status: "success" | "error"
  data?: T
  message?: string
  errors?: unknown
}

export type ProductItem = {
  id: string
  name: string
  color_hex?: string
  typeform_id?: string
  typeform_webhook_url?: string
  message_template?: string
  dealer_message_template?: string
  customer_message_template?: string
  dealer_template_code?: string
  customer_template_code?: string
  created_at?: string
}

export type ProductPayload = {
  id: string
  name: string
  color_hex?: string
  typeform_id?: string
  message_template?: string
  dealer_message_template?: string
  customer_message_template?: string
  dealer_template_code?: string
  customer_template_code?: string
}

export type VendorStatus = "active" | "suspended"

export type VendorItem = {
  id: string
  name: string
  code: string
  email: string
  whatsapp_number: string
  address: string
  long: number
  lat: number
  status?: VendorStatus
  product_ids: string[]
  created_at?: string
}

export function vendorStatus(vendor: Pick<VendorItem, "status">): VendorStatus {
  return vendor.status === "suspended" ? "suspended" : "active"
}

export type LeadItem = {
  id?: string
  lead_id: string
  product_id: string
  status: "Assigned" | "Unassigned"
  name: string
  phone: string
  email: string
  ig_tiktok: string
  vendor_phone: string
  city: string
  information: string
  voucher_code: string
  utm_source: string
  utm_medium: string
  purchased: string
  terms_accepted: string
  remark: string
  created_at: string
  current_vendor?: {
    id: string
    name: string
  }
}

export type FetchLeadsParams = {
  product_id?: string
  status?: "Assigned" | "Unassigned"
  date_from?: string
  date_to?: string
  search?: string
}

export type LeadExportRequest = {
  assigned_list: boolean
  unassigned_list: boolean
  date_from?: string
  date_to?: string
  file_type: "csv" | "xlsx"
  product_id?: string
}

export type LeadTrxItem = {
  id: string
  lead_id: string
  vendor_id: string
  vendor?: {
    id: string
    name: string
  }
  assigned_timestamp: string
  assigned_by_user_id?: string
}

export type NotificationItemApi = {
  id: string
  type: "Export Ready" | "Lead Assigned" | "Assignment" | "Reminder" | "System"
  title: string
  message: string
  lead_id?: string
  created_at: string
  read: boolean
}

export type UserItemApi = {
  id: string
  name: string
  email: string
  role: "Admin" | "Staff"
  created_at?: string
}

export type DashboardSummaryCardItem = {
  value: number
  trend_percentage: number
  trend_direction: "up" | "down"
}

export type DashboardLeadTrackerData = {
  summary_cards: {
    total_leads: DashboardSummaryCardItem
    total_assigned: DashboardSummaryCardItem
    unreachable_contact: DashboardSummaryCardItem
    assigned_rate: DashboardSummaryCardItem
  }
  product_funnel: {
    product: string
    leads: number
    fill: string
  }[]
  leads_vs_assigned: {
    key: string
    month: string
    totalLeads: number
    totalAssigned: number
  }[]
  customer_mapping_location: {
    regions: {
      name: string
      value: number
      color: string
    }[]
    points: {
      label: string
      count: number
      lat: number
      lng: number
    }[]
  }
}

const getApiBaseUrl = () => {
  const raw = (import.meta.env.VITE_WELLOUS_API_BASE_URL as string | undefined)?.trim()
  return raw ? raw.replace(/\/+$/, "") : "http://api-wellous.lokal.test"
}

const apiBaseUrl = getApiBaseUrl()

function unwrapCollection<T>(value: T[] | { data: T[] } | null | undefined) {
  if (Array.isArray(value)) return value
  if (value && Array.isArray(value.data)) return value.data
  return []
}

async function request<T>(path: string, init?: RequestInit, session?: AuthSession | null): Promise<T> {
  const auth = session ?? getStoredAuthSession()
  const headers = new Headers(init?.headers ?? {})

  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json")
  }
  if (auth?.access_token) {
    headers.set("Authorization", `Bearer ${auth.access_token}`)
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers,
  })

  if (response.status === 401 && auth?.access_token) {
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT))
  }

  if (response.status === 204) {
    return undefined as T
  }

  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null
  if (!response.ok || !payload) {
    throw new Error(payload?.message || `Request failed with status ${response.status}`)
  }
  if (payload.status !== "success") {
    throw new Error(payload.message || "Request failed")
  }

  return (payload.data ?? (payload as unknown)) as T
}

async function requestBlob(path: string, init?: RequestInit, session?: AuthSession | null) {
  const auth = session ?? getStoredAuthSession()
  const headers = new Headers(init?.headers ?? {})

  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json")
  }
  if (auth?.access_token) {
    headers.set("Authorization", `Bearer ${auth.access_token}`)
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers,
  })

  if (response.status === 401 && auth?.access_token) {
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT))
  }

  if (!response.ok) {
    const contentType = response.headers.get("Content-Type") ?? ""
    if (contentType.includes("application/json")) {
      const payload = (await response.json().catch(() => null)) as ApiEnvelope<unknown> | null
      throw new Error(payload?.message || `Request failed with status ${response.status}`)
    }

    const message = (await response.text().catch(() => "")).trim()
    throw new Error(message || `Request failed with status ${response.status}`)
  }

  return response
}

function parseFilenameFromContentDisposition(headerValue: string | null) {
  if (!headerValue) return null

  const utf8Match = headerValue.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim())
    } catch {
      return utf8Match[1].trim()
    }
  }

  const quotedMatch = headerValue.match(/filename\s*=\s*"([^"]+)"/i)
  if (quotedMatch?.[1]) {
    return quotedMatch[1].trim()
  }

  const plainMatch = headerValue.match(/filename\s*=\s*([^;]+)/i)
  if (plainMatch?.[1]) {
    return plainMatch[1].trim()
  }

  return null
}

export function apiBase() {
  return apiBaseUrl
}

export async function fetchProducts(session?: AuthSession | null) {
  const data = await request<ProductItem[] | { data: ProductItem[] }>("/v1/products", undefined, session)
  return unwrapCollection(data)
}

export async function fetchProduct(id: string, session?: AuthSession | null) {
  return request<ProductItem>(`/v1/products/${id}`, undefined, session)
}

export async function createProduct(payload: ProductPayload, session?: AuthSession | null) {
  return request<ProductItem>("/v1/products", {
    method: "POST",
    body: JSON.stringify(payload),
  }, session)
}

export async function updateProduct(id: string, payload: ProductPayload, session?: AuthSession | null) {
  return request<ProductItem>(`/v1/products/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }, session)
}

export async function deleteProduct(id: string, session?: AuthSession | null) {
  return request(`/v1/products/${id}`, { method: "DELETE" }, session)
}

export async function regenerateProductTypeformWebhook(id: string, session?: AuthSession | null) {
  return request<ProductItem>(`/v1/products/${id}/regenerate-typeform-webhook`, {
    method: "POST",
  }, session)
}

export async function fetchVendors(options?: { productId?: string }, session?: AuthSession | null) {
  const qs = new URLSearchParams()
  if (options?.productId) qs.set("product_id", options.productId)
  const query = qs.toString()
  const data = await request<VendorItem[] | { data: VendorItem[] }>(`/v1/vendors${query ? `?${query}` : ""}`, undefined, session)
  return unwrapCollection(data)
}

export async function createVendor(payload: { name: string; code: string; email: string; whatsapp_number: string; address: string; long: number; lat: number; product_ids: string[] }, session?: AuthSession | null) {
  return request<VendorItem>("/v1/vendors", {
    method: "POST",
    body: JSON.stringify(payload),
  }, session)
}

export async function updateVendor(id: string, payload: { name: string; code: string; email: string; whatsapp_number: string; address: string; long: number; lat: number; product_ids: string[] }, session?: AuthSession | null) {
  return request<VendorItem>(`/v1/vendors/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }, session)
}

export async function deleteVendor(id: string, session?: AuthSession | null) {
  return request(`/v1/vendors/${id}`, { method: "DELETE" }, session)
}

export async function suspendVendors(ids: string[], session?: AuthSession | null) {
  return request<{ status: VendorStatus; ids: string[]; updated: number }>("/v1/vendors/suspend", {
    method: "POST",
    body: JSON.stringify({ ids }),
  }, session)
}

export async function unsuspendVendors(ids: string[], session?: AuthSession | null) {
  return request<{ status: VendorStatus; ids: string[]; updated: number }>("/v1/vendors/unsuspend", {
    method: "POST",
    body: JSON.stringify({ ids }),
  }, session)
}

export async function fetchVendorConfig(session?: AuthSession | null) {
  return request<{ distribution_type: "by_alphabet" | "by_performance" }>("/v1/vendor-config", undefined, session)
}

export async function updateVendorConfig(distributionType: "by_alphabet" | "by_performance", session?: AuthSession | null) {
  return request<{ distribution_type: "by_alphabet" | "by_performance" }>("/v1/vendor-config", {
    method: "PUT",
    body: JSON.stringify({ distribution_type: distributionType }),
  }, session)
}

export async function fetchLeads(params?: FetchLeadsParams, session?: AuthSession | null) {
  const qs = new URLSearchParams()
  if (params?.product_id) qs.set("product_id", params.product_id)
  if (params?.status) qs.set("status", params.status)
  if (params?.date_from) qs.set("date_from", params.date_from)
  if (params?.date_to) qs.set("date_to", params.date_to)
  if (params?.search) qs.set("search", params.search)
  const query = qs.toString()
  const data = await request<LeadItem[] | { data: LeadItem[] }>(`/v1/leads${query ? `?${query}` : ""}`, undefined, session)
  return unwrapCollection(data)
}

export async function fetchDashboardLeadTracker(
  params?: { date_from?: string; date_to?: string },
  session?: AuthSession | null
) {
  const qs = new URLSearchParams()
  if (params?.date_from) qs.set("date_from", params.date_from)
  if (params?.date_to) qs.set("date_to", params.date_to)
  const query = qs.toString()
  return request<DashboardLeadTrackerData>(`/v1/dashboard/lead-tracker${query ? `?${query}` : ""}`, undefined, session)
}

export async function fetchLeadTransactions(session?: AuthSession | null) {
  const data = await request<LeadTrxItem[] | { data: LeadTrxItem[] }>("/v1/lead-trx", undefined, session)
  return unwrapCollection(data)
}

export async function assignLead(leadId: string, vendorId: string, session?: AuthSession | null) {
  return request(`/v1/leads/${leadId}/assign`, {
    method: "POST",
    body: JSON.stringify({ vendor_id: vendorId }),
  }, session)
}

export type AssignJobStatus = {
  job_id: string
  total: number
  done: number
  failed: number
  status: "processing" | "completed"
}

export async function assignBulk(assignments: { lead_id: string; vendor_id: string }[], session?: AuthSession | null) {
  return request<AssignJobStatus>("/v1/lead-assign-bulk", {
    method: "POST",
    body: JSON.stringify({ assignments }),
  }, session)
}

export async function getAssignJob(jobId: string, session?: AuthSession | null) {
  return request<AssignJobStatus>(`/v1/lead-assign-jobs/${jobId}`, undefined, session)
}

export async function exportLeads(payload: LeadExportRequest, session?: AuthSession | null) {
  const response = await requestBlob("/v1/leads/export", {
    method: "POST",
    body: JSON.stringify(payload),
  }, session)

  const blob = await response.blob()
  const filename = parseFilenameFromContentDisposition(response.headers.get("Content-Disposition"))
    || `wellous-leads-export.${payload.file_type}`

  return { blob, filename }
}

export type MessageLogItem = {
  id: string
  lead_id: string
  vendor_id: string | null
  vendor_name: string
  recipient_type: "dealer" | "customer"
  recipient_number: string
  provider: string
  status: "pending" | "sent" | "failed" | "skipped"
  message_body: string
  provider_message_id: string
  error_message: string
  sent_at: string | null
  created_at: string
}

export async function fetchMessageLogs(
  params?: { status?: string; recipient_type?: string; provider?: string; lead_id?: string; page?: number },
  session?: AuthSession | null
) {
  const qs = new URLSearchParams()
  if (params?.status) qs.set("status", params.status)
  if (params?.recipient_type) qs.set("recipient_type", params.recipient_type)
  if (params?.provider) qs.set("provider", params.provider)
  if (params?.lead_id) qs.set("lead_id", params.lead_id)
  if (params?.page) qs.set("page", String(params.page))
  const query = qs.toString()
  const data = await request<{ data: MessageLogItem[]; meta: { total: number; current_page: number; per_page: number } }>(
    `/v1/message-logs${query ? `?${query}` : ""}`,
    undefined,
    session
  )
  return data
}

export async function fetchNotifications(session?: AuthSession | null) {
  const data = await request<NotificationItemApi[] | { data: NotificationItemApi[] }>("/v1/notifications", undefined, session)
  return unwrapCollection(data)
}

export async function markNotificationRead(id: string, session?: AuthSession | null) {
  return request(`/v1/notifications/${id}/read`, { method: "PATCH" }, session)
}

export async function changePassword(currentPassword: string, newPassword: string, session?: AuthSession | null) {
  return request("/v1/auth/change-password", {
    method: "POST",
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  }, session)
}

export async function fetchUsers(session?: AuthSession | null) {
  const data = await request<UserItemApi[] | { data: UserItemApi[] }>("/v1/users", undefined, session)
  return unwrapCollection(data)
}

export async function createUser(payload: { name: string; email: string; password: string; role: "Admin" | "Staff" }, session?: AuthSession | null) {
  return request("/v1/users", {
    method: "POST",
    body: JSON.stringify(payload),
  }, session)
}

export async function updateUser(id: string, payload: { name: string; email: string; role: "Admin" | "Staff" }, session?: AuthSession | null) {
  return request(`/v1/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }, session)
}

export async function deleteUser(id: string, session?: AuthSession | null) {
  return request(`/v1/users/${id}`, { method: "DELETE" }, session)
}

export async function resetUserPassword(userId: string, session?: AuthSession | null) {
  return request("/v1/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  }, session)
}

export async function fetchSettings(keys: string[], session?: AuthSession | null) {
  if (keys.length === 0) return {}
  return request<Record<string, string | null>>(`/v1/settings?keys=${encodeURIComponent(keys.join(","))}`, undefined, session)
}

export async function updateSetting(key: string, value: string, session?: AuthSession | null) {
  return request(`/v1/settings/${key}`, {
    method: "PUT",
    body: JSON.stringify({ value }),
  }, session)
}

export async function sendTestEmail(to: string, session?: AuthSession | null) {
  return request<{ message?: string }>("/v1/email/test", {
    method: "POST",
    body: JSON.stringify({ to }),
  }, session)
}

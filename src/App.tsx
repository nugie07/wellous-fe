import { useEffect, useRef, useState } from "react"
import logo from "./assets/wellous_icon.png"
import rightPanelImage from "./assets/bg_login_new.png"
import DashboardPage from "./pages/DashboardPage"
import LeadTrackerPage from "./pages/LeadTrackerPage"
import GlobalSettingsPage from "./pages/GlobalSettingsPage"
import MessageLogPage from "./pages/MessageLogPage"
import NotificationPage from "./pages/NotificationPage"
import VendorPage from "./pages/VendorPage"
import { AUTH_STORAGE_KEY, SESSION_EXPIRED_EVENT } from "./lib/auth"

type LoginUser = {
  id: string
  name: string
  email: string
  role: string
}

type LoginPayload = {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
  user: LoginUser
}

type ApiSuccess<T> = {
  status: "success"
  data: T
  message?: string
}

type ApiError = {
  status?: "error"
  message?: string
  errors?: unknown
}

type ReCaptchaApi = {
  render: (
    container: HTMLElement,
    parameters: {
      sitekey: string
      theme?: "light" | "dark"
      size?: "normal" | "compact" | "invisible"
      callback?: (token: string) => void
      "error-callback"?: () => void
      "expired-callback"?: () => void
    },
  ) => number
  enterprise?: {
    render: ReCaptchaApi["render"]
  }
}

declare global {
  interface Window {
    grecaptcha?: ReCaptchaApi
  }
}

const getApiBaseUrl = () => {
  const raw = (import.meta.env.VITE_WELLOUS_API_BASE_URL as string | undefined)?.trim()
  return raw ? raw.replace(/\/+$/, "") : "http://api-wellous.lokal.test"
}

// Fallback dipakai hanya jika VITE_RECAPTCHA_SITE_KEY tidak di-set saat build.
const FALLBACK_RECAPTCHA_SITE_KEY = "6Ld-U3AsAAAAAM44o5I_JG4c5E59bvh86OndBBt3";

function App() {
  const [pathname, setPathname] = useState(() => window.location.pathname || "/")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoginErrorModalOpen, setIsLoginErrorModalOpen] = useState(false)
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false)
  const [isSessionExpiredModalOpen, setIsSessionExpiredModalOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [emailError, setEmailError] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [captchaError, setCaptchaError] = useState("")
  const [loginErrorMessage, setLoginErrorMessage] = useState("")
  const [isLoginChecking, setIsLoginChecking] = useState(false)
  const [isLoginFinalizing, setIsLoginFinalizing] = useState(false)
  const [forgotEmail, setForgotEmail] = useState("")
  const [forgotEmailError, setForgotEmailError] = useState("")
  const [forgotCaptchaError, setForgotCaptchaError] = useState("")
  const [recaptchaLoaded, setRecaptchaLoaded] = useState(false)
  const [recaptchaVerified, setRecaptchaVerified] = useState(false)
  const [forgotRecaptchaVerified, setForgotRecaptchaVerified] = useState(false)
  const [recaptchaError, setRecaptchaError] = useState<string>("")
  const [authSession, setAuthSession] = useState<LoginPayload | null>(() => {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw) as LoginPayload
    } catch {
      window.localStorage.removeItem(AUTH_STORAGE_KEY)
      return null
    }
  })
  const [pendingLogin, setPendingLogin] = useState<LoginPayload | null>(null)

  const recaptchaContainerRef = useRef<HTMLDivElement | null>(null)
  const recaptchaWidgetIdRef = useRef<number | null>(null)
  const forgotRecaptchaContainerRef = useRef<HTMLDivElement | null>(null)
  const forgotRecaptchaWidgetIdRef = useRef<number | null>(null)

  const recaptchaSiteKey = (import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined)?.trim() || FALLBACK_RECAPTCHA_SITE_KEY
  const apiBaseUrl = getApiBaseUrl()
  const isAuthenticated = Boolean(authSession?.access_token)

  const navigate = (path: string) => {
    if (window.location.pathname === path) return
    window.history.pushState({}, "", path)
    setPathname(path)
  }

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname || "/")
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  useEffect(() => {
    const protectedPaths = ["/dashboard", "/lead-tracker", "/vendor", "/notification", "/wa-log", "/global-settings", "/settings"]
    if (!isAuthenticated && protectedPaths.includes(pathname)) {
      navigate("/")
      return
    }
    if (isAuthenticated && pathname === "/") {
      navigate("/dashboard")
    }
  }, [isAuthenticated, pathname])

  const [showWabaWarning, setShowWabaWarning] = useState(false)

  useEffect(() => {
    const handleSessionExpired = () => {
      setPendingLogin(null)
      setIsModalOpen(false)
      setIsForgotModalOpen(false)
      setIsSessionExpiredModalOpen(true)
      window.localStorage.removeItem(AUTH_STORAGE_KEY)
      setAuthSession(null)
    }

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired)
  }, [])

  useEffect(() => {
    if (!isAuthenticated || authSession?.user?.role !== "Admin") {
      setShowWabaWarning(false)
      return
    }

    let intervalId: ReturnType<typeof setInterval>

    const checkWaba = async () => {
      try {
        const { getWabaValidatorStatus, fetchSettings } = await import("./lib/api")
        const settings = await fetchSettings(["whatsapp_provider"])
        if (settings.whatsapp_provider === "waba") {
          const st = await getWabaValidatorStatus(authSession)
          setShowWabaWarning(!st.connected)
        } else {
          setShowWabaWarning(false)
        }
      } catch {
        setShowWabaWarning(true) // assume disconnected if it fails
      }
    }

    checkWaba()
    intervalId = setInterval(checkWaba, 10000)

    return () => {
      clearInterval(intervalId)
    }
  }, [isAuthenticated, authSession?.user?.role])


  useEffect(() => {
    if (!recaptchaSiteKey) return

    const scriptSources = [
      "https://www.google.com/recaptcha/enterprise.js?render=explicit",
      "https://www.recaptcha.net/recaptcha/enterprise.js?render=explicit",
    ]

    if (window.grecaptcha) {
      setRecaptchaLoaded(true)
      setRecaptchaError("")
      return
    }

    const existing = document.querySelector<HTMLScriptElement>('script[data-recaptcha="google-enterprise"]')
    if (existing) {
      const onLoad = () => {
        setRecaptchaLoaded(true)
        setRecaptchaError("")
      }
      const onError = () => setRecaptchaError("reCAPTCHA script failed to load.")
      existing.addEventListener("load", onLoad)
      existing.addEventListener("error", onError)
      return () => {
        existing.removeEventListener("load", onLoad)
        existing.removeEventListener("error", onError)
      }
    }

    const scripts: HTMLScriptElement[] = []
    let sourceIndex = 0
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const loadScript = () => {
      timeoutId = setTimeout(() => {
        setRecaptchaError(
          "reCAPTCHA tidak bisa dimuat. Tambahkan domain ini di Google reCAPTCHA Admin (console.cloud.google.com), atau coba matikan ad blocker."
        )
      }, 12000)

      const script = document.createElement("script")
      script.src = scriptSources[sourceIndex]
      script.async = true
      script.defer = true
      script.dataset.recaptcha = "google-enterprise"
      script.addEventListener("load", () => {
        if (timeoutId) clearTimeout(timeoutId)
        setRecaptchaLoaded(true)
        setRecaptchaError("")
      })
      script.addEventListener("error", () => {
        if (timeoutId) clearTimeout(timeoutId)
        script.remove()
        sourceIndex += 1
        if (sourceIndex < scriptSources.length) {
          loadScript()
          return
        }
        setRecaptchaError("reCAPTCHA script unreachable (google.com/recaptcha.net blocked).")
      })
      scripts.push(script)
      document.body.appendChild(script)
    }

    loadScript()

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
      for (const s of scripts) s.remove()
    }
  }, [recaptchaSiteKey])

  useEffect(() => {
    if (!isModalOpen || !recaptchaSiteKey || !recaptchaLoaded || !recaptchaContainerRef.current) return
    if (recaptchaWidgetIdRef.current !== null) return
    if (!window.grecaptcha) return

    try {
      const renderer = window.grecaptcha.enterprise?.render ?? window.grecaptcha.render
      recaptchaWidgetIdRef.current = renderer(recaptchaContainerRef.current, {
        sitekey: recaptchaSiteKey,
        theme: "light",
        size: "normal",
        callback: () => {
          setRecaptchaVerified(true)
          setRecaptchaError("")
        },
        "error-callback": () => {
          setRecaptchaVerified(false)
          setRecaptchaError("Google reCAPTCHA validation failed.")
        },
        "expired-callback": () => {
          setRecaptchaVerified(false)
          setRecaptchaError("Google reCAPTCHA expired. Please verify again.")
        },
      })
    } catch {
      setRecaptchaError("Invalid site key or domain mismatch in reCAPTCHA admin.")
    }
  }, [isModalOpen, recaptchaLoaded, recaptchaSiteKey])

  useEffect(() => {
    if (!isForgotModalOpen || !recaptchaSiteKey || !recaptchaLoaded || !forgotRecaptchaContainerRef.current) return
    if (forgotRecaptchaWidgetIdRef.current !== null) return
    if (!window.grecaptcha) return

    try {
      const renderer = window.grecaptcha.enterprise?.render ?? window.grecaptcha.render
      forgotRecaptchaWidgetIdRef.current = renderer(forgotRecaptchaContainerRef.current, {
        sitekey: recaptchaSiteKey,
        theme: "light",
        size: "normal",
        callback: () => {
          setForgotRecaptchaVerified(true)
          setRecaptchaError("")
        },
        "error-callback": () => {
          setForgotRecaptchaVerified(false)
          setRecaptchaError("Google reCAPTCHA validation failed.")
        },
        "expired-callback": () => {
          setForgotRecaptchaVerified(false)
          setRecaptchaError("Google reCAPTCHA expired. Please verify again.")
        },
      })
    } catch {
      setRecaptchaError("Invalid site key or domain mismatch in reCAPTCHA admin.")
    }
  }, [isForgotModalOpen, recaptchaLoaded, recaptchaSiteKey])

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

  const closeErrorModal = () => {
    setIsLoginErrorModalOpen(false)
    setLoginErrorMessage("")
  }

  const persistAuth = (payload: LoginPayload) => {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload))
    setAuthSession(payload)
    setPendingLogin(null)
  }

  const clearAuth = () => {
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
    setAuthSession(null)
    setPendingLogin(null)
  }

  const handleLogout = async () => {
    const currentSession = authSession

    clearAuth()
    navigate("/")

    if (!currentSession?.access_token) {
      return
    }

    try {
      await fetch(`${apiBaseUrl}/v1/auth/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${currentSession.access_token}`,
        },
      })
    } catch {
      // Ignore network errors on logout; local session is already cleared.
    }
  }

  const acknowledgeSessionExpired = () => {
    setIsSessionExpiredModalOpen(false)
    navigate("/")
  }

  const openLoginModal = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmedEmail = email.trim()
    let hasError = false

    setLoginErrorMessage("")
    setIsLoginErrorModalOpen(false)
    setPendingLogin(null)

    if (!trimmedEmail) {
      setEmailError("Email is required.")
      hasError = true
    } else if (!isValidEmail(trimmedEmail)) {
      setEmailError("Please enter a valid email address.")
      hasError = true
    } else {
      setEmailError("")
    }

    if (!password.trim()) {
      setPasswordError("Password is required.")
      hasError = true
    } else {
      setPasswordError("")
    }

    if (hasError) return

    setIsLoginChecking(true)

    try {
      const response = await fetch(`${apiBaseUrl}/v1/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: trimmedEmail,
          password,
        }),
      })

      const payload = (await response.json().catch(() => null)) as ApiSuccess<LoginPayload> | ApiError | null

      if (response.status === 401) {
        setLoginErrorMessage("Email or Password Not Match")
        setIsLoginErrorModalOpen(true)
        return
      }

      if (!response.ok || !payload || payload.status !== "success" || !("data" in payload)) {
        setLoginErrorMessage(payload?.message || "Login failed. Please try again.")
        setIsLoginErrorModalOpen(true)
        return
      }

      setPendingLogin(payload.data)
      setIsModalOpen(true)
      setCaptchaError("")
      setRecaptchaVerified(false)
    } catch {
      setLoginErrorMessage("Login service is unavailable. Please try again.")
      setIsLoginErrorModalOpen(true)
    } finally {
      setIsLoginChecking(false)
    }
  }

  const closeLoginModal = () => {
    setIsModalOpen(false)
    setCaptchaError("")
    setRecaptchaVerified(false)
    setIsLoginFinalizing(false)
    setPendingLogin(null)
    recaptchaWidgetIdRef.current = null
    if (recaptchaContainerRef.current) {
      recaptchaContainerRef.current.innerHTML = ""
    }
  }

  const openForgotModal = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    setIsForgotModalOpen(true)
    setForgotEmailError("")
    setForgotCaptchaError("")
    setForgotRecaptchaVerified(false)
  }

  const closeForgotModal = () => {
    setIsForgotModalOpen(false)
    setForgotCaptchaError("")
    setForgotEmailError("")
    setForgotRecaptchaVerified(false)
    forgotRecaptchaWidgetIdRef.current = null
    if (forgotRecaptchaContainerRef.current) {
      forgotRecaptchaContainerRef.current.innerHTML = ""
    }
  }

  const verifyModalLogin = () => {
    const canSkip = !recaptchaSiteKey
    if (!canSkip && !recaptchaVerified) {
      setCaptchaError("Please complete Google reCAPTCHA.")
      return
    }

    if (!pendingLogin) {
      setCaptchaError("Login session expired. Please sign in again.")
      return
    }

    setIsLoginFinalizing(true)
    setCaptchaError("")
    persistAuth(pendingLogin)
    closeLoginModal()
    navigate("/dashboard")
  }

  const submitForgotPassword = () => {
    const trimmedEmail = forgotEmail.trim()
    if (!trimmedEmail) {
      setForgotEmailError("Email is required.")
      return
    }
    if (!isValidEmail(trimmedEmail)) {
      setForgotEmailError("Please enter a valid email address.")
      return
    }
    setForgotEmailError("")

    if (recaptchaSiteKey && !forgotRecaptchaVerified) {
      setForgotCaptchaError("Please complete reCAPTCHA.")
      return
    }

    setForgotCaptchaError("")
    closeForgotModal()
  }

  if (pathname === "/dashboard") {
    return <DashboardPage onLogout={handleLogout} navigate={navigate} />
  }

  if (pathname === "/lead-tracker") {
    return <LeadTrackerPage onLogout={handleLogout} navigate={navigate} />
  }

  if (pathname === "/notification") {
    return <NotificationPage onLogout={handleLogout} navigate={navigate} />
  }

  if (pathname === "/vendor") {
    return <VendorPage onLogout={handleLogout} navigate={navigate} />
  }

  if (pathname === "/wa-log") {
    return <MessageLogPage onLogout={handleLogout} navigate={navigate} />
  }

  if (pathname === "/global-settings" || pathname === "/settings") {
    return <GlobalSettingsPage onLogout={handleLogout} navigate={navigate} />
  }

  return (
    <main className="grid h-svh overflow-hidden bg-[#edf3fb] lg:grid-cols-[40%_60%]">
      <section className="relative flex h-svh flex-col overflow-hidden bg-white px-7 pb-4 pt-6 sm:px-10 lg:px-14 lg:pb-4 lg:pt-6">
        <div className="mx-auto w-full max-w-[500px] lg:mt-6">
          <div className="mb-8 flex justify-center">
            <div className="inline-flex items-center gap-4 text-left">
              <img src={logo} alt="Wellous" className="h-auto w-[80px] rounded-[16px]" />
              <span className="text-[26px] font-bold leading-[1.12] tracking-[-0.02em] text-[#203a67]">
                Lead Tracker
                <br />
                Management
              </span>
            </div>
          </div>

          <h1 className="mt-20 mb-3 text-center text-[28px] font-medium leading-[1.2] tracking-[-0.01em] text-[#242b36]">
            Sign in to your account
          </h1>
          <p className="mx-auto mb-8 max-w-[420px] text-center text-[16px] leading-[1.55] text-[#606d7a]">
            Explore countless integrated solutions and dynamic insights on Wellous .
          </p>

          <form className="space-y-4" onSubmit={openLoginModal}>
            <label className="block space-y-2">
              <span className="text-[16px] font-medium text-[#252d38]">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (emailError) setEmailError("")
                  if (isLoginErrorModalOpen) closeErrorModal()
                }}
                placeholder="Enter your email"
                className="h-[46px] w-full rounded-[9px] border border-[#c7d2e2] bg-white px-4 text-[16px] text-[#2a3038] placeholder:text-[#9ca5af] shadow-[0_1px_1px_rgba(16,24,40,0.03)] transition focus:border-[#2b5fb3] focus:outline-none focus:ring-3 focus:ring-[#2b5fb324]"
              />
              {emailError ? <p className="text-[12px] text-red-600">{emailError}</p> : null}
            </label>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[16px] font-medium text-[#252d38]">Password</span>
                <a href="#" onClick={openForgotModal} className="text-[14px] font-medium text-[#2f5fa9] hover:underline">
                  Forgot Password ?
                </a>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (passwordError) setPasswordError("")
                    if (isLoginErrorModalOpen) closeErrorModal()
                  }}
                  placeholder="Enter your password"
                  className="h-[46px] w-full rounded-[9px] border border-[#c7d2e2] bg-white px-4 pr-20 text-[16px] text-[#2a3038] placeholder:text-[#9ca5af] shadow-[0_1px_1px_rgba(16,24,40,0.03)] transition focus:border-[#2b5fb3] focus:outline-none focus:ring-3 focus:ring-[#2b5fb324]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[13px] font-medium tracking-[0.02em] text-[#2f5fa9] hover:text-[#244b86]"
                >
                  {showPassword ? "HIDE" : "SHOW"}
                </button>
              </div>
              {passwordError ? <p className="text-[12px] text-red-600">{passwordError}</p> : null}
            </div>

            <label className="inline-flex items-center gap-2.5 text-[16px] text-[#67727d]">
              <input type="checkbox" defaultChecked className="size-4 rounded-[3px] accent-[#2f5fa9]" />
              Keep me logged in
            </label>

            <button
              type="submit"
              disabled={isLoginChecking}
              className="h-[46px] w-full rounded-[9px] bg-[#48a645] text-[16px] font-bold uppercase tracking-[0.04em] text-white shadow-[0_10px_24px_rgba(72,166,69,0.28)] transition hover:bg-[#3f913c] focus:outline-none focus:ring-3 focus:ring-[#48a64540]"
            >
              {isLoginChecking ? "CHECKING..." : "LOGIN"}
            </button>
          </form>
        </div>

        <footer className="mx-auto mt-auto w-full max-w-[500px] pb-1 pt-6 text-center text-[13px] leading-[1.4] text-[#6f7680]">
          Wellous @2026 All rights reserved.{" "}
          <a href="#" className="text-[#2f5fa9] hover:underline">
            Privacy Policy
          </a>{" "}
          |{" "}
          <a href="#" className="text-[#2f5fa9] hover:underline">
            T&amp;C
          </a>{" "}
          |{" "}
          <a href="#" className="text-[#2f5fa9] hover:underline">
            version 0.0.1
          </a>
        </footer>
      </section>

      <aside className="hidden h-svh overflow-hidden border-l border-[#d6dfec] bg-[#eef4fd] lg:flex">
        <img src={rightPanelImage} alt="Wellous login background" className="h-full w-full object-cover object-center" />
      </aside>

      {isModalOpen ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/45 px-4">
          <div className="w-full max-w-[420px] rounded-xl bg-white p-6 shadow-2xl">
            <h3 className="text-[20px] font-bold text-[#24324a]">Security Verification</h3>
            <p className="mt-1 text-[14px] text-[#6a7280]">Complete reCAPTCHA before continuing.</p>

            <div className="mt-4 rounded-lg border border-[#d7dfea] p-3">
              {recaptchaSiteKey ? <div ref={recaptchaContainerRef} /> : null}
              {!recaptchaSiteKey ? (
                <p className="mt-1 text-[12px] text-amber-700">reCAPTCHA tidak dikonfigurasi (VITE_RECAPTCHA_SITE_KEY). Klik &quot;Verify &amp; Continue&quot; untuk lanjut tanpa reCAPTCHA.</p>
              ) : !recaptchaLoaded && !recaptchaError ? (
                <p className="mt-1 text-[11px] text-slate-500">Loading reCAPTCHA...</p>
              ) : null}
            </div>

            {captchaError ? <p className="mt-3 text-[12px] text-red-600">{captchaError}</p> : null}
            {recaptchaError ? <p className="mt-2 text-[12px] text-red-600">{recaptchaError}</p> : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeLoginModal}
                className="rounded-md border border-[#c8d2e3] px-4 py-2 text-[13px] font-semibold text-[#44536c]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={verifyModalLogin}
                disabled={isLoginFinalizing}
                className="rounded-md bg-[#48a645] px-4 py-2 text-[13px] font-semibold text-white"
              >
                {isLoginFinalizing ? "Signing in..." : "Verify & Continue"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isLoginErrorModalOpen ? (
        <div className="fixed inset-0 z-[1001] flex items-center justify-center bg-slate-900/45 px-4">
          <div className="w-full max-w-[380px] rounded-xl bg-white p-6 shadow-2xl">
            <h3 className="text-[20px] font-bold text-[#24324a]">Login Failed</h3>
            <p className="mt-3 text-[14px] text-[#6a7280]">{loginErrorMessage || "Email or Password Not Match"}</p>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={closeErrorModal}
                className="rounded-md bg-[#d84242] px-4 py-2 text-[13px] font-semibold text-white"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isSessionExpiredModalOpen ? (
        <div className="fixed inset-0 z-[1002] flex items-center justify-center bg-slate-900/45 px-4">
          <div className="w-full max-w-[420px] rounded-xl bg-white p-6 shadow-2xl">
            <h3 className="text-[20px] font-bold text-[#24324a]">Session Expired</h3>
            <p className="mt-3 text-[14px] text-[#6a7280]">Sesi habis, mohon login ulang kembali.</p>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={acknowledgeSessionExpired}
                className="rounded-md bg-[#d84242] px-4 py-2 text-[13px] font-semibold text-white"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isForgotModalOpen ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/45 px-4">
          <div className="w-full max-w-[420px] rounded-xl bg-white p-6 shadow-2xl">
            <h3 className="text-[20px] font-bold text-[#24324a]">Forgot Password</h3>
            <p className="mt-1 text-[14px] text-[#6a7280]">Enter your registered email and complete reCAPTCHA.</p>

            <div className="mt-4">
              <label className="mb-2 block text-[13px] font-medium text-[#30415f]">Email</label>
              <input
                type="email"
                value={forgotEmail}
                onChange={(e) => {
                  setForgotEmail(e.target.value)
                  if (forgotEmailError) setForgotEmailError("")
                }}
                placeholder="Enter your email"
                className="h-[42px] w-full rounded-[8px] border border-[#c7d2e2] px-3 text-[14px]"
              />
              {forgotEmailError ? <p className="mt-1 text-[12px] text-red-600">{forgotEmailError}</p> : null}
            </div>

            <div className="mt-4 rounded-lg border border-[#d7dfea] p-3">
              {recaptchaSiteKey ? <div ref={forgotRecaptchaContainerRef} /> : null}
              {!recaptchaSiteKey ? (
                <p className="mt-1 text-[12px] text-amber-700">reCAPTCHA tidak dikonfigurasi. Isi email lalu Submit.</p>
              ) : !recaptchaLoaded && !recaptchaError ? (
                <p className="mt-1 text-[11px] text-slate-500">Loading reCAPTCHA...</p>
              ) : null}
            </div>

            {forgotCaptchaError ? <p className="mt-3 text-[12px] text-red-600">{forgotCaptchaError}</p> : null}
            {recaptchaError ? <p className="mt-2 text-[12px] text-red-600">{recaptchaError}</p> : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeForgotModal}
                className="rounded-md border border-[#c8d2e3] px-4 py-2 text-[13px] font-semibold text-[#44536c]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitForgotPassword}
                className="rounded-md bg-[#48a645] px-4 py-2 text-[13px] font-semibold text-white"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showWabaWarning && isAuthenticated && pathname !== "/global-settings" ? (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/60 px-4">
          <div className="w-full max-w-[420px] rounded-xl bg-white p-6 shadow-2xl text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
              <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="mt-4 text-[18px] font-bold text-[#24324a]">WABA Validator Terputus</h3>
            <p className="mt-2 text-[14px] text-[#6a7280]">Provider WhatsApp diatur ke WABA, namun WABA Validator belum terhubung atau QR code expired. Validasi nomor tidak dapat dilakukan.</p>
            <p className="mt-2 text-[14px] text-[#6a7280]">Silakan scan QR code di halaman Settings untuk menghubungkan WhatsApp web session.</p>

            <div className="mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowWabaWarning(false)
                  navigate("/global-settings")
                }}
                className="w-full rounded-md bg-[#3f7f8f] px-4 py-2.5 text-[14px] font-semibold text-white shadow-sm hover:bg-[#35707a]"
              >
                Ke Halaman Settings
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}

export default App

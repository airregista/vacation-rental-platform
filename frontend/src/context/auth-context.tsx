"use client"

import * as React from "react"
import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react"
import { apiClient, ApiError } from "@/lib/api-client"
import type { UserResponse, TokenResponse, OTPResponse, AuthContextType } from "@/types/auth"

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isOtpModalOpen, setIsOtpModalOpen] = useState<boolean>(false)

  useEffect(() => {
    let isMounted = true
    const rehydrate = async () => {
      if (typeof window === "undefined") return
      const storedToken = localStorage.getItem("access_token")
      if (!storedToken) {
        if (isMounted) setIsLoading(false)
        return
      }

      // The token is only committed to state after /auth/me succeeds, so a
      // network error or 5xx never leaves token non-null while user is null.
      // The stored token stays in localStorage for a later retry; only
      // 401/403 evicts it.
      try {
        const currentUser = await apiClient.get<UserResponse>("/auth/me")
        if (isMounted) {
          setToken(storedToken)
          setUser(currentUser)
        }
      } catch (err: unknown) {
        // Only evict token on explicit unauthorized/forbidden authentication failure,
        // preserving credentials across temporary network dropouts or 5xx server downtime.
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          if (typeof window !== "undefined") {
            localStorage.removeItem("access_token")
          }
          if (isMounted) {
            setToken(null)
            setUser(null)
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    rehydrate()
    return () => {
      isMounted = false
    }
  }, [])

  const openOtpModal = useCallback(() => {
    setIsOtpModalOpen(true)
  }, [])

  const closeOtpModal = useCallback(() => {
    setIsOtpModalOpen(false)
  }, [])

  const sendOtp = useCallback(async (phone: string): Promise<OTPResponse> => {
    return await apiClient.post<OTPResponse>("/auth/otp/send", { phone })
  }, [])

  const verifyOtp = useCallback(async (phone: string, code: string): Promise<void> => {
    const res = await apiClient.post<TokenResponse>("/auth/otp/verify", { phone, code })
    if (typeof window !== "undefined") {
      localStorage.setItem("access_token", res.access_token)
    }
    setToken(res.access_token)
    setUser(res.user)
    setIsOtpModalOpen(false)
  }, [])

  const becomeHost = useCallback(async (): Promise<void> => {
    const updatedUser = await apiClient.post<UserResponse>("/auth/become-host")
    setUser(updatedUser)
  }, [])

  const updateUser = useCallback((updatedUser: UserResponse): void => {
    setUser(updatedUser)
  }, [])

  const logout = useCallback((): void => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("access_token")
    }
    setToken(null)
    setUser(null)
  }, [])

  useEffect(() => {
    const handleUnauthorized = () => {
      logout()
    }
    if (typeof window !== "undefined") {
      window.addEventListener("auth:unauthorized", handleUnauthorized)
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("auth:unauthorized", handleUnauthorized)
      }
    }
  }, [logout])

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      token,
      isLoading,
      isAuthenticated: !!user,
      isHost: user?.role === "host" || user?.role === "admin",
      isAdmin: user?.role === "admin",
      isOtpModalOpen,
      openOtpModal,
      closeOtpModal,
      sendOtp,
      verifyOtp,
      becomeHost,
      updateUser,
      logout,
    }),
    [
      user,
      token,
      isLoading,
      isOtpModalOpen,
      openOtpModal,
      closeOtpModal,
      sendOtp,
      verifyOtp,
      becomeHost,
      updateUser,
      logout,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

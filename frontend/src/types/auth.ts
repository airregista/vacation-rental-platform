export interface UserResponse {
  id: number
  phone: string
  email: string | null
  first_name: string | null
  last_name: string | null
  role: "guest" | "host" | "admin"
  avatar_url: string | null
  shaba_number: string | null
  created_at: string
}

export interface PublicHost {
  id: number
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  created_at: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  user: UserResponse
}

export interface OTPResponse {
  message: string
  dev_code?: string | null
  expires_in_seconds: number
}

export interface AuthContextType {
  user: UserResponse | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  isHost: boolean
  isAdmin: boolean
  isOtpModalOpen: boolean
  openOtpModal: () => void
  closeOtpModal: () => void
  sendOtp: (phone: string) => Promise<OTPResponse>
  verifyOtp: (phone: string, code: string) => Promise<void>
  becomeHost: () => Promise<void>
  logout: () => void
}

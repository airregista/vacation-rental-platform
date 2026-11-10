"use client"

import * as React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
import { AlertCircle, Loader2, MessageSquare, Send, User } from "lucide-react"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/context/auth-context"
import { apiClient, ApiError } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { formatMessageTime, toPersianDigits } from "@/lib/format-fa"
import type { ChatMessageItem, TripReservationItem } from "@/types/trips"

export interface ChatDrawerProps {
  trip: TripReservationItem | null
  isOpen: boolean
  onClose: () => void
}

export function ChatDrawer({ trip, isOpen, onClose }: ChatDrawerProps) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<ChatMessageItem[]>([])
  const [hasLoadedInitially, setHasLoadedInitially] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [inputText, setInputText] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isLoadingMessages = isOpen && !hasLoadedInitially && !errorMessage

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
    })
  }, [])

  const isMyMessage = useCallback(
    (msg: ChatMessageItem) => {
      if (user?.id) return msg.sender_id === user.id
      if (trip) return msg.sender_id === trip.user_id
      return false
    },
    [user, trip]
  )

  // Depend on the reservation id, not the trip object: the parent creates
  // new trip objects on every refetch, which would restart the fetch and
  // the polling interval while the drawer is open.
  const tripId = trip?.id

  const handleClose = () => {
    setMessages([])
    setHasLoadedInitially(false)
    setInputText("")
    setErrorMessage(null)
    setIsSending(false)
    onClose()
  }

  // Fetch on open & set up polling.
  // The messages endpoint defaults to limit=50, oldest first, and 100 is
  // the maximum it accepts. Conversations longer than 100 messages still
  // truncate to the oldest 100 — a backend "latest N" / cursor parameter
  // would be needed to fix that properly (out of scope here).
  useEffect(() => {
    if (!isOpen || tripId === undefined) return

    let isMounted = true

    apiClient
      .get<ChatMessageItem[]>(`/reservations/${tripId}/messages?limit=100`)
      .then((data) => {
        if (isMounted) {
          setMessages(data)
          setHasLoadedInitially(true)
          setTimeout(() => scrollToBottom(false), 50)
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setHasLoadedInitially(true)
          if (err instanceof ApiError) {
            setErrorMessage(err.detail || err.message || "خطا در دریافت پیام‌ها.")
          } else {
            setErrorMessage("امکان برقراری ارتباط با چت وجود ندارد.")
          }
        }
      })

    // Poll for new messages every 8 seconds
    const interval = setInterval(() => {
      apiClient
        .get<ChatMessageItem[]>(`/reservations/${tripId}/messages?limit=100`)
        .then((data) => {
          if (isMounted) setMessages(data)
        })
        .catch(() => {
          // ignore background polling failures
        })
    }, 8000)

    const handleFocus = () => {
      apiClient
        .get<ChatMessageItem[]>(`/reservations/${tripId}/messages?limit=100`)
        .then((data) => {
          if (isMounted) setMessages(data)
        })
        .catch(() => {
          // ignore background focus poll failures
        })
    }
    window.addEventListener("focus", handleFocus)

    return () => {
      isMounted = false
      clearInterval(interval)
      window.removeEventListener("focus", handleFocus)
    }
  }, [isOpen, tripId, scrollToBottom])

  // Scroll on new message added
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom(true)
    }
  }, [messages.length, scrollToBottom])

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmed = inputText.trim()
    if (!trimmed || !trip || isSending) return

    setIsSending(true)
    setErrorMessage(null)

    try {
      const sent = await apiClient.post<ChatMessageItem>(
        `/reservations/${trip.id}/messages`,
        { message: trimmed }
      )
      setMessages((prev) => [...prev, sent])
      setInputText("")
      setTimeout(() => scrollToBottom(true), 50)
      textareaRef.current?.focus()
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.detail || err.message || "خطا در ارسال پیام.")
      } else {
        setErrorMessage("خطا در ارسال پیام. لطفاً وضعیت اینترنت را بررسی کنید.")
      }
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent
        side="left"
        className="w-full sm:max-w-md p-0 flex flex-col h-full bg-background"
      >
        {/* Header Bar */}
        <SheetHeader className="p-4 sm:p-5 border-b border-border bg-card text-right flex flex-col gap-1.5 shrink-0">
          <div className="flex items-center justify-between pl-8">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <MessageSquare className="size-5" />
              </div>
              <SheetTitle className="text-base sm:text-lg font-bold text-foreground">
                گفتگو با میزبان
              </SheetTitle>
            </div>
            {trip && (
              <Badge variant="outline" className="text-xs font-mono">
                JBM-{toPersianDigits(trip.id)}
              </Badge>
            )}
          </div>
          <SheetDescription className="text-xs text-muted-foreground line-clamp-1 pr-11">
            {trip?.accommodation_title || (trip ? `اقامتگاه کد ${trip.accommodation_id}` : "")}
          </SheetDescription>
        </SheetHeader>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3">
            <Alert variant="destructive" className="py-2">
              <AlertCircle className="size-4" />
              <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
            </Alert>
          </div>
        )}

        {/* Message Container Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoadingMessages ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
              <Loader2 className="size-6 animate-spin text-primary" />
              <span className="text-xs">در حال بارگذاری پیام‌ها...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 text-muted-foreground gap-3">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground/60">
                <MessageSquare className="size-6" />
              </div>
              <p className="text-sm font-medium text-foreground">
                هنوز پیامی رد و بدل نشده است.
              </p>
              <p className="text-xs leading-relaxed max-w-xs">
                اولین پیام خود را برای میزبان ارسال کنید تا هماهنگی‌های تحویل کلید و ساعت ورود را انجام دهید.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const mine = isMyMessage(msg)
              return (
                <div
                  key={msg.id}
                  className={cn(
                    "flex flex-col max-w-[82%]",
                    mine ? "ml-auto items-end" : "mr-auto items-start"
                  )}
                >
                  {/* Sender Name for Incoming */}
                  {!mine && (
                    <span className="text-[11px] font-semibold text-muted-foreground mb-1 pr-1">
                      {msg.sender_name || "میزبان"}
                    </span>
                  )}

                  <div className="flex items-end gap-2">
                    {!mine && (
                      <Avatar className="size-7 shrink-0 bg-secondary/20 text-secondary border border-border">
                        <AvatarFallback className="text-[11px] font-bold">
                          {msg.sender_name ? msg.sender_name.charAt(0) : "م"}
                        </AvatarFallback>
                      </Avatar>
                    )}

                    <div
                      className={cn(
                        "px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed break-words whitespace-pre-wrap shadow-xs",
                        mine
                          ? "bg-primary text-primary-foreground rounded-bl-sm"
                          : "bg-muted text-foreground rounded-br-sm border border-border"
                      )}
                    >
                      <p>{msg.message}</p>
                      <div
                        className={cn(
                          "text-[10px] mt-1 text-right",
                          mine
                            ? "text-primary-foreground/75"
                            : "text-muted-foreground"
                        )}
                      >
                        {formatMessageTime(msg.created_at)}
                      </div>
                    </div>

                    {mine && (
                      <Avatar className="size-7 shrink-0 bg-primary/20 text-primary border border-border">
                        <AvatarFallback className="text-[11px] font-bold">
                          {user?.first_name ? user.first_name.charAt(0) : <User className="size-3.5" />}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Composer Footer */}
        <div className="p-3 border-t border-border bg-card shrink-0">
          <form
            onSubmit={handleSendMessage}
            className="flex items-end gap-2 bg-background border border-input rounded-2xl p-1.5 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1"
          >
            <Textarea
              ref={textareaRef}
              placeholder="پیام خود را بنویسید (Enter برای ارسال)..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={isSending || isLoadingMessages}
              className="min-h-[38px] max-h-32 resize-none border-0 bg-transparent px-2 py-1.5 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!inputText.trim() || isSending || isLoadingMessages}
              className="size-9 rounded-xl shrink-0"
              aria-label="ارسال پیام"
            >
              {isSending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4 rtl:rotate-180" />
              )}
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  )
}

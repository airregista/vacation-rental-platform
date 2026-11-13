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
import {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
} from "@/components/ui/message-scroller"
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageHeader,
} from "@/components/ui/message"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { useAuth } from "@/context/auth-context"
import { apiClient, ApiError } from "@/lib/api-client"
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

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isLoadingMessages = isOpen && !hasLoadedInitially && !errorMessage

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
  const viewerId = user?.id

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

    // One fetch path for the initial load, the 8-second poll, and the
    // window-focus refetch. A successful fetch clears any earlier error
    // banner; only the initial load reports failures (background polls
    // stay silent).
    // Poll results MERGE by id instead of replacing the list: a message
    // sent just before a poll tick lands must neither duplicate (poll
    // already contains it, then the POST resolution appends it again) nor
    // vanish (a poll started before the persist overwrites the appended
    // message). Incoming rows win per id; local-only rows are preserved.
    const refreshMessages = (isInitial: boolean) => {
      apiClient
        .get<ChatMessageItem[]>(`/reservations/${tripId}/messages?limit=100`)
        .then((data) => {
          if (isMounted) {
            setMessages((prev) => {
              const byId = new Map(prev.map((m) => [m.id, m]))
              for (const m of data) byId.set(m.id, m)
              return [...byId.values()]
            })
            setErrorMessage(null)
            if (isInitial) setHasLoadedInitially(true)
            const hasUnreadIncoming = data.some(
              (m) => m.sender_id !== viewerId && m.read_at == null
            )
            if (viewerId !== undefined && hasUnreadIncoming) {
              void apiClient
                .post<{ marked_read: number }>(
                  `/reservations/${tripId}/messages/read`
                )
                .catch(() => {
                  // A failed read receipt must not interrupt the conversation.
                })
            }
          }
        })
        .catch((err: unknown) => {
          if (!isMounted || !isInitial) return
          setHasLoadedInitially(true)
          if (err instanceof ApiError) {
            setErrorMessage(err.detail || err.message || "خطا در دریافت پیام‌ها.")
          } else {
            setErrorMessage("امکان برقراری ارتباط با چت وجود ندارد.")
          }
        })
    }

    refreshMessages(true)

    // Poll for new messages every 8 seconds. Skip ticks while the tab is
    // hidden so background tabs don't keep hammering the messages endpoint.
    const interval = setInterval(() => {
      if (document.visibilityState !== "visible") return
      refreshMessages(false)
    }, 8000)

    const handleFocus = () => refreshMessages(false)
    window.addEventListener("focus", handleFocus)

    // Catch up immediately when the tab becomes visible again.
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refreshMessages(false)
    }
    document.addEventListener("visibilitychange", handleVisibility)

    return () => {
      isMounted = false
      clearInterval(interval)
      window.removeEventListener("focus", handleFocus)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [isOpen, tripId, viewerId])

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
      // Dedupe on append: a poll tick that landed between the persist and
      // this POST resolution already contains the sent message.
      setMessages((prev) =>
        prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]
      )
      setInputText("")
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
        className="flex h-full w-full flex-col border-line bg-paper p-0 sm:max-w-md"
      >
        {/* Header Bar */}
        <SheetHeader className="flex shrink-0 flex-col gap-1.5 border-b border-line bg-paper-card p-4 text-right sm:p-5">
          <div className="flex items-center justify-between pl-8">
            <div className="flex items-center gap-2.5">
              <span className="grid size-10 shrink-0 place-items-center rounded-b-xl rounded-t-full bg-brick/10 text-brick">
                <MessageSquare className="size-5" />
              </span>
              <SheetTitle className="text-base font-black text-ink sm:text-lg">
                گفتگو با میزبان
              </SheetTitle>
            </div>
            {trip && (
              <Badge
                variant="outline"
                className="border-line bg-paper-deep/50 font-mono text-[10px] text-ink-soft"
                dir="ltr"
              >
                JBM-{toPersianDigits(trip.id)}
              </Badge>
            )}
          </div>
          <SheetDescription className="line-clamp-1 pr-12 text-[11px] text-ink-soft">
            {trip?.accommodation_title ||
              (trip ? `اقامتگاه کد ${trip.accommodation_id}` : "")}
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

        {/* Message Thread — shadcn chat primitives own scrolling,
            anchoring and jump-to-latest; no manual scroll wiring. */}
        <MessageScrollerProvider autoScroll>
          {/* h-auto overrides the stock size-full height so the scroller
              shares the Sheet column with the header and composer. */}
          <MessageScroller className="h-auto min-h-0 flex-1">
            <MessageScrollerViewport className="p-4">
              <MessageScrollerContent className="gap-3">
                {isLoadingMessages ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-2 text-ink-soft">
                    <Loader2 className="size-6 animate-spin text-brick" />
                    <span className="text-xs">در حال بارگذاری پیام‌ها...</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-ink-soft">
                    <span className="grid size-14 place-items-center rounded-b-2xl rounded-t-full bg-brick/10 text-brick">
                      <MessageSquare className="size-6" />
                    </span>
                    <p className="text-sm font-bold text-ink">
                      هنوز پیامی رد و بدل نشده است.
                    </p>
                    <p className="max-w-xs text-xs leading-6">
                      اولین پیام خود را برای میزبان ارسال کنید تا هماهنگی‌های تحویل کلید و ساعت ورود را انجام دهید.
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const mine = isMyMessage(msg)
                    return (
                      <MessageScrollerItem
                        key={msg.id}
                        messageId={String(msg.id)}
                        scrollAnchor={mine}
                      >
                        <Message align={mine ? "end" : "start"}>
                          <MessageAvatar>
                            {!mine ? (
                              <Avatar className="size-7 shrink-0 border border-line bg-trust/10 text-trust">
                                <AvatarFallback className="bg-transparent text-[11px] font-bold text-trust">
                                  {msg.sender_name ? msg.sender_name.charAt(0) : "م"}
                                </AvatarFallback>
                              </Avatar>
                            ) : (
                              <Avatar className="size-7 shrink-0 border border-line bg-brick/10 text-brick">
                                <AvatarFallback className="bg-transparent text-[11px] font-bold text-brick">
                                  {user?.first_name ? (
                                    user.first_name.charAt(0)
                                  ) : (
                                    <User className="size-3.5" />
                                  )}
                                </AvatarFallback>
                              </Avatar>
                            )}
                          </MessageAvatar>
                          <MessageContent>
                            {!mine && (
                              <MessageHeader className="text-ink-soft">
                                {msg.sender_name || "میزبان"}
                              </MessageHeader>
                            )}
                            <Bubble
                              variant={mine ? "default" : "muted"}
                              align={mine ? "end" : "start"}
                            >
                              <BubbleContent
                                className={
                                  mine
                                    ? "whitespace-pre-wrap rounded-bl-sm"
                                    : "whitespace-pre-wrap rounded-br-sm border-line bg-paper-deep/70 text-ink"
                                }
                              >
                                <p>{msg.message}</p>
                                <div
                                  className={
                                    mine
                                      ? "mt-1 text-right text-[10px] tabular-nums text-on-brick/70"
                                      : "mt-1 text-right text-[10px] tabular-nums text-ink-soft"
                                  }
                                >
                                  {formatMessageTime(msg.created_at)}
                                </div>
                              </BubbleContent>
                            </Bubble>
                          </MessageContent>
                        </Message>
                      </MessageScrollerItem>
                    )
                  })
                )}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton />
          </MessageScroller>
        </MessageScrollerProvider>

        {/* Composer Footer */}
        <div className="shrink-0 border-t border-line bg-paper-card p-3">
          <form
            onSubmit={handleSendMessage}
            className="flex items-end gap-2 rounded-2xl border border-line-strong/60 bg-paper p-1.5 focus-within:ring-2 focus-within:ring-brick/30"
          >
            <Textarea
              ref={textareaRef}
              placeholder="پیام خود را بنویسید (Enter برای ارسال)..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              maxLength={2000}
              disabled={isSending || isLoadingMessages}
              className="max-h-32 min-h-[38px] resize-none border-0 bg-transparent px-2 py-1.5 text-sm shadow-none placeholder:text-ink-soft focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!inputText.trim() || isSending || isLoadingMessages}
              className="size-9 shrink-0 rounded-xl"
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

"use client"

import * as React from "react"
import { useSyncExternalStore } from "react"
import { useAuth } from "@/context/auth-context"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { OtpForm } from "./otp-form"

function subscribeMediaQuery(callback: () => void) {
  const mql = window.matchMedia("(max-width: 639px)")
  mql.addEventListener("change", callback)
  return () => mql.removeEventListener("change", callback)
}

function getMobileSnapshot(): boolean {
  return window.matchMedia("(max-width: 639px)").matches
}

function getServerMobileSnapshot(): boolean {
  return false
}

function subscribeMounted() {
  return () => {}
}

function getMountedSnapshot(): boolean {
  return true
}

function getServerMountedSnapshot(): boolean {
  return false
}

/**
 * Auth entry point for every page. The phone/OTP flow itself lives in
 * OtpForm so the modal and /login can never drift apart; this component only
 * supplies the responsive frame and resets the form between visits.
 */
export function OtpModal() {
  const { isOtpModalOpen, closeOtpModal } = useAuth()

  const mounted = useSyncExternalStore(
    subscribeMounted,
    getMountedSnapshot,
    getServerMountedSnapshot
  )
  const isMobile = useSyncExternalStore(
    subscribeMediaQuery,
    getMobileSnapshot,
    getServerMobileSnapshot
  )

  // Bumping the key remounts OtpForm, clearing step/phone/OTP/error state
  // without leaking it into the next sign-in.
  const [session, setSession] = React.useState(0)

  function handleClose() {
    setSession((value) => value + 1)
    closeOtpModal()
  }

  const body = (
    <div className="flex flex-col gap-5">
      <OtpForm
        key={session}
        active={isOtpModalOpen}
        onSuccess={handleClose}
      />
    </div>
  )

  if (!mounted) {
    return (
      <Dialog open={false} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md p-6">
          <DialogHeader className="sr-only">
            <DialogTitle>ورود یا ثبت‌نام در آشیانک</DialogTitle>
            <DialogDescription>پنجره تایید هویت دو مرحله‌ای با شماره موبایل</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    )
  }

  if (isMobile) {
    return (
      <Sheet open={isOtpModalOpen} onOpenChange={(open) => !open && handleClose()}>
        <SheetContent side="bottom" className="p-6 pt-3">
          <SheetHeader className="sr-only">
            <SheetTitle>ورود یا ثبت‌نام در آشیانک</SheetTitle>
            <SheetDescription>پنجره تایید هویت دو مرحله‌ای با شماره موبایل</SheetDescription>
          </SheetHeader>
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-muted-foreground/30" />
          {body}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={isOtpModalOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md p-6">
        <DialogHeader className="sr-only">
          <DialogTitle>ورود یا ثبت‌نام در آشیانک</DialogTitle>
          <DialogDescription>پنجره تایید هویت دو مرحله‌ای با شماره موبایل</DialogDescription>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  )
}

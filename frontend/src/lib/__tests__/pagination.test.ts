import { beforeEach, describe, expect, it, vi } from "vitest"

// Plan 097 anticipated `lib/pagination.ts` from plan 075; 075 landed the walk
// helper in `components/host/host-utils.ts` instead, so this suite targets the
// live export. `findLatestSuccessfulPayment` (checkout success page) is
// module-private there and stays untested rather than editing app files.
vi.mock("@/lib/api-client", () => ({
  apiClient: {
    get: vi.fn(),
  },
  ApiError: class ApiError extends Error {},
}))

import { apiClient } from "@/lib/api-client"
import { fetchAllPages } from "@/components/host/host-utils"

const getMock = vi.mocked(apiClient.get)

function makeItems(count: number, startIndex: number): unknown[] {
  return Array.from({ length: count }, (_, i) => ({ id: startIndex + i }))
}

describe("fetchAllPages", () => {
  beforeEach(() => {
    getMock.mockReset()
  })

  it("walks pages until a short page and concatenates results", async () => {
    getMock
      .mockResolvedValueOnce(makeItems(100, 0))
      .mockResolvedValueOnce(makeItems(100, 100))
      .mockResolvedValueOnce(makeItems(7, 200))

    const all = await fetchAllPages("/reservations/host")

    expect(all).toHaveLength(207)
    expect(getMock).toHaveBeenCalledTimes(3)
    expect(getMock).toHaveBeenNthCalledWith(1, "/reservations/host?skip=0&limit=100")
    expect(getMock).toHaveBeenNthCalledWith(2, "/reservations/host?skip=100&limit=100")
    expect(getMock).toHaveBeenNthCalledWith(3, "/reservations/host?skip=200&limit=100")
  })

  it("stops after a single non-full page", async () => {
    getMock.mockResolvedValueOnce(makeItems(3, 0))

    const all = await fetchAllPages("/geo/cities")

    expect(all).toHaveLength(3)
    expect(getMock).toHaveBeenCalledTimes(1)
  })

  it("returns an empty array for an empty first page", async () => {
    getMock.mockResolvedValueOnce([])

    const all = await fetchAllPages("/accommodations/my")

    expect(all).toEqual([])
    expect(getMock).toHaveBeenCalledTimes(1)
  })

  it("treats a non-array payload as an empty page", async () => {
    getMock.mockResolvedValueOnce(null)

    const all = await fetchAllPages("/reservations/host")

    expect(all).toEqual([])
  })
})

import { useEffect, useState } from "react"

export default function OfflineStatus() {
  const [isOffline, setIsOffline] = useState(() => !window.navigator.onLine)
  const [showOfflineToast, setShowOfflineToast] = useState(false)
  const [offlineReady, setOfflineReady] = useState(false)
  const [updateReady, setUpdateReady] = useState(false)

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false)
      setShowOfflineToast(false)
    }
    const handleOffline = () => {
      setIsOffline(true)
      setShowOfflineToast(true)
    }
    const handleOfflineReady = () => setOfflineReady(true)
    const handleUpdateReady = () => setUpdateReady(true)

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    window.addEventListener("triketrack:pwa-offline-ready", handleOfflineReady)
    window.addEventListener("triketrack:pwa-update-ready", handleUpdateReady)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
      window.removeEventListener("triketrack:pwa-offline-ready", handleOfflineReady)
      window.removeEventListener("triketrack:pwa-update-ready", handleUpdateReady)
    }
  }, [])

  useEffect(() => {
    if (!showOfflineToast) return
    const timer = window.setTimeout(() => setShowOfflineToast(false), 6000)
    return () => window.clearTimeout(timer)
  }, [showOfflineToast])

  if ((!isOffline || !showOfflineToast) && !offlineReady && !updateReady) return null

  const message = isOffline && showOfflineToast
    ? "You are offline. Cached dashboard data is still available, but live updates need internet."
    : updateReady
      ? "A new dashboard version is available."
      : "TrikeTrack Admin is ready for offline loading."

  return (
    <div className="offline-status" role="status" aria-live="polite">
      <span>{message}</span>
      {updateReady ? (
        <button type="button" onClick={() => window.location.reload()}>
          Reload
        </button>
      ) : null}
      {!isOffline && !updateReady ? (
        <button type="button" onClick={() => setOfflineReady(false)}>
          Dismiss
        </button>
      ) : null}
    </div>
  )
}

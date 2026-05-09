import { registerSW } from "virtual:pwa-register"

export const registerTrikeTrackPwa = () => {
  registerSW({
    immediate: true,
    onNeedRefresh() {
      window.dispatchEvent(new CustomEvent("triketrack:pwa-update-ready"))
    },
    onOfflineReady() {
      window.dispatchEvent(new CustomEvent("triketrack:pwa-offline-ready"))
    }
  })
}

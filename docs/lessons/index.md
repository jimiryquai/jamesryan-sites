---
okf_version: 0.2
---

# Lessons

## usermaven

* [Usermaven's browser SDK keeps a localStorage retry buffer and requires tagged form tracking](usermaven-sdk-storage-and-tagged-forms.md) - `lib.js` unconditionally writes `usermaven_offline_queue_default_data` to `localStorage` even in strict cookieless mode, and `data-form-tracking="all"` captures raw input values across every `<form>`, so keep `data-form-tracking="tagged"` and opt in marketing forms with `data-um-form`.

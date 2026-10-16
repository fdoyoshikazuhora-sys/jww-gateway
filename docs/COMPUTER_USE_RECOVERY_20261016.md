# Computer Use Recovery And Remaining Native Cases

Date: 2026-10-16. Status: **OPERATIONALLY RECOVERED; INTERNAL ROOT CAUSE UNCONFIRMED.**

The supported Computer Use connection and screenshots worked across private Jw_cad restarts, enabling all nine pending TNKN_SET cases to complete. This is not a demonstrated permanent repair of Codex. No bundled transport code, plugin configuration, Windows security settings or installed JWF was changed. No browser was operated.

## Diagnostic Findings

The earlier private `.work/COMPUTER_USE_DIAGNOSTICS_20261016.md` is retained as a historical failed attempt. Its endpoint checks already established that the configured pipe existed and matched desktop startup. This continuation inspected the installed host-side JavaScript read-only and correlated a timed supported request with helper process lifetime.

| Check | Observed result | What it establishes |
| --- | --- | --- |
| Installed AppX | 26.1013.3656.0, package status Ok | Package registration is present, not proof of runtime health |
| Runtime/plugin identifiers | UI/runtime 26.1013.31256, sky 0.7.8 | Different identifiers alone do not establish a version mismatch |
| Pipe framing | Client and Windows host use four-byte little-endian length plus JSON | No framing mismatch identified in the inspected implementation |
| Host dispatch | Lazy helper transport; a second in-flight request is rejected; invalid envelopes may be dropped | Relevant failure paths exist, but no evidence identifies one as this request's cause |
| 02:44:25.466 UTC request | Supported list_windows timed out after 10021 ms | No successful operation response within the request budget |
| Concurrent process observation | Helper appeared at 02:44:25.771; a second appeared near timeout; both disappeared by 02:44:36.057 | Request reached helper startup; not simply a missing MCP tool or nonexistent endpoint |
| Event checks | No matching application crash/hang, .NET or Code Integrity event in the queried interval | No corroborating event found; this does not exclude a native stall |
| Host logs | No operation-level diagnostic identifying the internal blocking call | Exact native operation/return-path cause remains UNCONFIRMED |

The ten-second request timeout is distinct from MCP startup and native connection timeouts. Increasing unrelated settings is not an evidence-backed repair. The helper process observations do not prove that screenshot capture itself was the blocked operation: even window enumeration had timed out.

## Supported Recovery

1. Used the supported `sky.launch_app` with the explicit **process:** identifier of the private Jw_cad executable. The 02:47:42.503 UTC call succeeded after approximately 19.1 seconds. No direct helper launch or custom pipe client was used.
2. Enumerated returned windows, required exactly one matching private executable, obtained that window, explicitly activated it, then captured fresh state. After closing an owned dialog, reselected the current main window instead of reusing the dialog binding.
3. Closed and restarted private Jw_cad after restoring the test baseline; fresh screenshots succeeded again. Evidence: private `first-main-window.jpg` and `restarted-main-window.jpg`.
4. Repeated the supported selection/capture workflow while performing the nine native cases. New screenshots were inspected after each action; no browser was used.

One later Alt+F4 cleanup request timed out. A fresh window list, binding, activation and screenshot succeeded, followed by one successful close retry. Separately, cancelling an association dialog required rebinding the main window after a stale foreground-process error. These observations prevent a claim of zero transport errors or proven long-term stability. An unrelated security notification was not clicked, changed or treated as the cause.

## Native Outcome

All nine requested cases completed reflection, separate native Save As and clean-baseline JWW reopen: field 4 ASCII7 and fields 5, 6, 7, 8 ASCII6/ASCII7. Enlarged building-number text was inspected for field 4; all seven triangle-number rows were inspected for fields 5..8. Screenshots and output hashes are retained privately. See [the field-by-field audit](JWF_TNKN_NAME_NATIVE_AUDIT.md).

ASCII6 remained intact. ASCII7 produced the first six ASCII bytes, omitting G. These are bounded 10.02.1 observations, not permission to accept seven-byte settings. The production six-byte editor guard remains unchanged. Native JWF export persistence was not rerun here: the prior observed TNKN_SET omission still stands.

The test process ended normally. Registry Restore and Verify passed, both installed JWFs and all nine canonical dirty files matched their pinned hashes, and all 92 prior referenced artifacts plus prepared profiles/input drawings retained their hashes. Prior evidence was not overwritten. No drawing or configuration was sent externally.

## User Actions

No further user operation is required for the completed nine cases. If the failure returns, use the supported single refreshed-window retry and stop if it fails; do not run an indefinite retry loop or change security policies. Record the timestamp, operation and exact error for a Codex product report. Before sharing logs through the app's feedback flow, review them for private data. This investigation did not submit logs or feedback.

Official operational references consulted: [Computer Use](https://learn.chatgpt.com/docs/computer-use) and [troubleshooting](https://learn.chatgpt.com/docs/reference/troubleshooting). These describe supported operation/reporting, not a published fix for this specific internal stall.

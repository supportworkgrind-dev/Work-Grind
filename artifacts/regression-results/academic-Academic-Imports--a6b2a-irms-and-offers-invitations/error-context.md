# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: academic.spec.ts >> Academic Imports — downloads a template, maps columns, previews issues, confirms, and offers invitations
- Location: tests\academic.spec.ts:296:5

# Error details

```
Error: page.waitForEvent: Target page, context or browser has been closed
=========================== logs ===========================
waiting for event "download"
============================================================
```

```
Error: locator.click: Target page, context or browser has been closed
Browser logs:

<launching> C:\Users\MUBASHAR\AppData\Local\ms-playwright\chromium_headless_shell-1248\chrome-headless-shell-win64\chrome-headless-shell.exe --disable-field-trial-config --disable-background-networking --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-back-forward-cache --disable-breakpad --disable-client-side-phishing-detection --disable-component-extensions-with-background-pages --disable-component-update --no-default-browser-check --disable-default-apps --disable-dev-shm-usage --disable-edgeupdater --disable-extensions --disable-features=AvoidUnnecessaryBeforeUnloadCheckSync,DestroyProfileOnBrowserClose,DialMediaRouteProvider,GlobalMediaControls,HttpsUpgrades,LensOverlay,MediaRouter,PaintHolding,ThirdPartyStoragePartitioning,BlockOriginHeaderModificationOnRedirect,Translate,AutoDeElevate,OptimizationHints,NetworkTimeServiceQuerying,AimEnabled,msForceBrowserSignIn,msEdgeUpdateLaunchServicesPreferredVersion --enable-features=CDPScreenshotNewSurface --allow-pre-commit-input --disable-hang-monitor --disable-ipc-flooding-protection --disable-popup-blocking --disable-prompt-on-repost --disable-renderer-backgrounding --disable-updater-scheduler --force-color-profile=srgb --metrics-recording-only --no-first-run --password-store=basic --use-mock-keychain --no-service-autorun --export-tagged-pdf --disable-search-engine-choice-screen --unsafely-disable-devtools-self-xss-warnings --edge-skip-compat-layer-relaunch --disable-infobars --disable-search-engine-choice-screen --disable-sync --enable-unsafe-swiftshader --headless --hide-scrollbars --mute-audio --blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4 --no-sandbox --user-data-dir=C:\Users\MUBASHAR\AppData\Local\Temp\playwright_chromiumdev_profile-No6j25 --remote-debugging-pipe --no-startup-window
<launched> pid=10384
[pid=10384][err] Received fatal exception 0xe0000008
[pid=10384][err] Symbols not available. Dumping unresolved backtrace:
[pid=10384][err] 	(No symbol) [0x7ffae0cf41ca]
[pid=10384][err] Received fatal exception 0xe0000008
[pid=10384][err] Symbols not available. Dumping unresolved backtrace:
[pid=10384][err] 	(No symbol) [0x7ffae0cf41ca]
[pid=10384][err] [1028/135722.066:ERROR:content\browser\gpu\gpu_process_host.cc:1038] GPU process launch failed: error_code=63
[pid=10384][err] [1028/135722.067:WARNING:content\browser\gpu\gpu_process_host.cc:1503] The GPU process has crashed 1 time(s)
[pid=10384][err] [1028/135722.076:ERROR:content\browser\gpu\gpu_process_host.cc:1038] GPU process launch failed: error_code=63
[pid=10384][err] [1028/135722.076:WARNING:content\browser\gpu\gpu_process_host.cc:1503] The GPU process has crashed 2 time(s)
[pid=10384][err] [1028/135722.082:ERROR:content\browser\gpu\gpu_process_host.cc:1038] GPU process launch failed: error_code=63
[pid=10384][err] [1028/135722.082:WARNING:content\browser\gpu\gpu_process_host.cc:1503] The GPU process has crashed 3 time(s)
[pid=10384][err] [1028/135722.087:ERROR:content\browser\gpu\gpu_process_host.cc:1038] GPU process launch failed: error_code=63
[pid=10384][err] [1028/135722.087:WARNING:content\browser\gpu\gpu_process_host.cc:1503] The GPU process has crashed 4 time(s)
[pid=10384][err] [1028/135722.093:ERROR:content\browser\gpu\gpu_process_host.cc:1038] GPU process launch failed: error_code=63
[pid=10384][err] [1028/135722.093:WARNING:content\browser\gpu\gpu_process_host.cc:1503] The GPU process has crashed 5 time(s)
[pid=10384][err] [1028/135722.100:ERROR:content\browser\gpu\gpu_process_host.cc:1038] GPU process launch failed: error_code=63
[pid=10384][err] [1028/135722.100:WARNING:content\browser\gpu\gpu_process_host.cc:1503] The GPU process has crashed 6 time(s)
[pid=10384][err] [1028/135722.100:FATAL:content\browser\gpu\gpu_data_manager_impl_private.cc:389] GPU process isn't usable. Goodbye.
Call log:
  - waiting for getByRole('button', { name: 'Download CSV template' })

```

```
Error: apiRequestContext._wrapApiCall: Target page, context or browser has been closed
```
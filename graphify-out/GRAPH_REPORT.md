# Graph Report - .  (2026-04-15)

## Corpus Check
- 200 files · ~454,981 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 645 nodes · 980 edges · 47 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## God Nodes (most connected - your core abstractions)
1. `ESCPOSBuilder` - 25 edges
2. `showToast()` - 23 edges
3. `GET()` - 23 edges
4. `BluetoothPrinterService` - 18 edges
5. `POST()` - 16 edges
6. `MainActivity` - 16 edges
7. `adminAuthHeaders()` - 10 edges
8. `load()` - 10 edges
9. `openDb()` - 9 edges
10. `loadBills()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `fetchRevDetail()` --calls--> `adminAuthHeaders()`  [EXTRACTED]
  app/admin/page.tsx → app/admin/vendor/items/page.tsx
- `advanceStatus()` --calls--> `showToast()`  [EXTRACTED]
  app/admin/page.tsx → app/admin/vendor/page.tsx
- `exportUsersToCsv()` --calls--> `showToast()`  [EXTRACTED]
  app/admin/page.tsx → app/admin/vendor/page.tsx
- `if()` --calls--> `showToast()`  [EXTRACTED]
  app/admin/page.tsx → app/admin/vendor/page.tsx
- `setBillsByDateData()` --calls--> `showToast()`  [EXTRACTED]
  app/admin/page.tsx → app/admin/vendor/page.tsx

## Communities

### Community 0 - "Community 0"
Cohesion: 0.03
Nodes (52): acquireCameraStream(), addCustomItemMain(), addQuickItemPreset(), adminAuthHeaders(), advanceStatus(), applyBillFilters(), applyBillsResponse(), applySuggestedSlot() (+44 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (43): checkPublicRateLimit(), getClientIp(), checkAdminRateLimit(), getClientId(), billFromTokenVerifiedForCandidates(), billSavedRowsForFill(), blockRollupsFromRpc(), buildResponse() (+35 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (24): applyServiceFeeDiscount(), calculateServiceFee(), formatServiceFeeReceiptLine(), billMapAndVisibleOrderIds(), handleCompleteProfile(), handleConfirmDelivery(), handleConfirmOrder(), handleSaveEditProfile() (+16 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (12): encodeAsciiLines(), sanitizeReceiptText(), concatParts(), ESCPOSBuilder, escposPlainDivider(), escposPlainTableRow(), buildVendorReceiptEscPos(), formatVendorReceiptEscPosPlain() (+4 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (6): applySessionFromUrl(), parseHashParams(), signInWithGoogleNative(), isCampusCollegeStudent(), needsStudentCollegeChoice(), needsStudentHostelDetails()

### Community 5 - "Community 5"
Cohesion: 0.11
Nodes (10): normalizeHostelBlockKey(), rollupHostelBlockKey(), dayRow(), legacyDayRow(), normalizeVendorDashboardPayload(), num(), parseBilledBlockRow(), parseBilledSlice() (+2 more)

### Community 6 - "Community 6"
Cohesion: 0.14
Nodes (19): getBlePrinterPreferences(), getEffectiveEscPosPaperSize(), load(), save(), setBlePrinterPreferences(), syncEscPosPaperFromAdminPrinter(), patchPrefs(), refreshPrefs() (+11 more)

### Community 7 - "Community 7"
Cohesion: 0.09
Nodes (3): assertBookingMatchesSchedule(), isDateEnabledForVendor(), slotIdsForDateByVendor()

### Community 8 - "Community 8"
Cohesion: 0.17
Nodes (5): BluetoothPrinterService, getBluetooth(), isWebBluetoothAvailable(), pickWritableCharacteristic(), writeChunks()

### Community 9 - "Community 9"
Cohesion: 0.19
Nodes (17): buildEscPosBytes(), escapeHtml(), escapeHtmlStatic(), escPosPlainReceiptHtmlForPaper(), escPosPlainToThermalReceiptHtml(), getThermalStyles(), getThermalTestReceiptBodyHtml(), isBluetoothSupported() (+9 more)

### Community 10 - "Community 10"
Cohesion: 0.12
Nodes (1): MainActivity

### Community 11 - "Community 11"
Cohesion: 0.14
Nodes (6): buildTestEscPosReceipt(), formatTestEscPosPlain(), unitTotalLines(), tryNativeEscPosPrint(), uint8ToBase64(), PrintQueue

### Community 12 - "Community 12"
Cohesion: 0.15
Nodes (0): 

### Community 13 - "Community 13"
Cohesion: 0.21
Nodes (7): connectBluetoothPrinter(), loadBluetoothModules(), printPlainLines(), printSelfTest(), printVendorBillPlain(), savePreferredPrinterAddress(), scanBluetoothDevices()

### Community 14 - "Community 14"
Cohesion: 0.38
Nodes (12): clearBillsSyncMeta(), getLastSyncForFilter(), hasIndexedDb(), metaKey(), openDb(), pageKey(), patchCachedBillRow(), readCachedBillsPage() (+4 more)

### Community 15 - "Community 15"
Cohesion: 0.23
Nodes (9): customerFacingStatusClass(), customerFacingStatusLabel(), statusClass(), statusLabel(), catalogIdSet(), mergeVendorBillItems(), mergeVendorBillItemsFromDbRow(), parseBillItemOverrides() (+1 more)

### Community 16 - "Community 16"
Cohesion: 0.32
Nodes (10): b64urlDecode(), b64urlEncode(), createAdminToken(), getAdminSessionCookie(), getAdminSessionFromRequest(), getAdminTokenFromRequest(), getSecret(), isAdminRequest() (+2 more)

### Community 17 - "Community 17"
Cohesion: 0.18
Nodes (3): BluetoothDevicePickerAdapter, PairedDeviceRow, VH

### Community 18 - "Community 18"
Cohesion: 0.53
Nodes (8): clean(), escapeReg(), isEmptyDisplay(), segregateCustomerDisplay(), segregateHostelBlockRoom(), segregateNameAndReg(), stripTrailingRoomFromBlock(), tryExtractRoomFromBlock()

### Community 19 - "Community 19"
Cohesion: 0.32
Nodes (3): addDaysYmd(), eachYmdInRange(), fillCollectedByDate()

### Community 20 - "Community 20"
Cohesion: 0.29
Nodes (0): 

### Community 21 - "Community 21"
Cohesion: 0.47
Nodes (4): allowInWindow(), envBool(), isConservationMode(), nowMs()

### Community 22 - "Community 22"
Cohesion: 0.4
Nodes (1): BluetoothPrinterDevices

### Community 23 - "Community 23"
Cohesion: 0.4
Nodes (1): PrintBridge

### Community 24 - "Community 24"
Cohesion: 0.5
Nodes (0): 

### Community 25 - "Community 25"
Cohesion: 0.67
Nodes (0): 

### Community 26 - "Community 26"
Cohesion: 1.0
Nodes (0): 

### Community 27 - "Community 27"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "Community 28"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "Community 29"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "Community 30"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "Community 31"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Community 32"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "Community 33"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "Community 34"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "Community 35"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "Community 36"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "Community 37"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "Community 38"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Community 39"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "Community 40"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "Community 41"
Cohesion: 1.0
Nodes (0): 

### Community 42 - "Community 42"
Cohesion: 1.0
Nodes (0): 

### Community 43 - "Community 43"
Cohesion: 1.0
Nodes (0): 

### Community 44 - "Community 44"
Cohesion: 1.0
Nodes (0): 

### Community 45 - "Community 45"
Cohesion: 1.0
Nodes (0): 

### Community 46 - "Community 46"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **1 isolated node(s):** `PairedDeviceRow`
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 26`** (2 nodes): `manifest.ts`, `manifest()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (2 nodes): `ScrollingMarquee.tsx`, `ScrollingMarquee()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (2 nodes): `SegmentTabs.tsx`, `SegmentTabs()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (2 nodes): `TestimonialCarousel.tsx`, `TestimonialCarousel()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (2 nodes): `app.config.ts`, `defineConfig()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (2 nodes): `hello-wave.tsx`, `HelloWave()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (2 nodes): `haptic-tab.tsx`, `HapticTab()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (2 nodes): `icon-symbol.ios.tsx`, `IconSymbol()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (2 nodes): `use-color-scheme.web.ts`, `useColorScheme()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (2 nodes): `reset-project.js`, `moveDirectories()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (1 nodes): `next.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (1 nodes): `env.production.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (1 nodes): `env.development.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (1 nodes): `build.gradle.kts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (1 nodes): `settings.gradle.kts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (1 nodes): `HeroAnimations.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43`** (1 nodes): `sw.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44`** (1 nodes): `generate-env.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 45`** (1 nodes): `eslint.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 46`** (1 nodes): `react-native-bluetooth-escpos-printer.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `PairedDeviceRow` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.03 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `Community 4` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `Community 5` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._
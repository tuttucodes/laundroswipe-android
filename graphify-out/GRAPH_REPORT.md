# Graph Report - .  (2026-04-14)

## Corpus Check
- 140 files · ~419,808 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 540 nodes · 823 edges · 39 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## God Nodes (most connected - your core abstractions)
1. `ESCPOSBuilder` - 25 edges
2. `GET()` - 24 edges
3. `showToast()` - 23 edges
4. `BluetoothPrinterService` - 18 edges
5. `MainActivity` - 16 edges
6. `POST()` - 14 edges
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
Nodes (48): addCustomItemMain(), addQuickItemPreset(), adminAuthHeaders(), advanceStatus(), applyBillFilters(), applyBillsResponse(), applySuggestedSlot(), authHeaders() (+40 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (40): checkPublicRateLimit(), getClientIp(), billFromTokenVerifiedForCandidates(), billSavedRowsForFill(), blockRollupsFromRpc(), buildResponse(), debugLog(), DELETE() (+32 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (17): billMapAndVisibleOrderIds(), handleCompleteProfile(), handleConfirmDelivery(), handleConfirmOrder(), handleSaveEditProfile(), handleSaveStudentDetailsModal(), init(), isCampusCollegeStudent() (+9 more)

### Community 3 - "Community 3"
Cohesion: 0.11
Nodes (10): normalizeHostelBlockKey(), rollupHostelBlockKey(), dayRow(), legacyDayRow(), normalizeVendorDashboardPayload(), num(), parseBilledBlockRow(), parseBilledSlice() (+2 more)

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (4): escapeHtml(), openThermalReceiptReactPrintWindow(), locationFromBill(), vendorBillRowToThermalReceiptData()

### Community 5 - "Community 5"
Cohesion: 0.14
Nodes (19): getBlePrinterPreferences(), getEffectiveEscPosPaperSize(), load(), save(), setBlePrinterPreferences(), syncEscPosPaperFromAdminPrinter(), patchPrefs(), refreshPrefs() (+11 more)

### Community 6 - "Community 6"
Cohesion: 0.12
Nodes (14): encodeAsciiLines(), sanitizeReceiptText(), concatParts(), escposPlainDivider(), escposPlainTableRow(), applyServiceFeeDiscount(), calculateServiceFee(), formatServiceFeeReceiptLine() (+6 more)

### Community 7 - "Community 7"
Cohesion: 0.15
Nodes (1): ESCPOSBuilder

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
Cohesion: 0.19
Nodes (9): customerFacingStatusClass(), customerFacingStatusLabel(), statusClass(), statusLabel(), catalogIdSet(), mergeVendorBillItems(), mergeVendorBillItemsFromDbRow(), parseBillItemOverrides() (+1 more)

### Community 12 - "Community 12"
Cohesion: 0.16
Nodes (6): buildTestEscPosReceipt(), formatTestEscPosPlain(), unitTotalLines(), tryNativeEscPosPrint(), uint8ToBase64(), PrintQueue

### Community 13 - "Community 13"
Cohesion: 0.38
Nodes (12): clearBillsSyncMeta(), getLastSyncForFilter(), hasIndexedDb(), metaKey(), openDb(), pageKey(), patchCachedBillRow(), readCachedBillsPage() (+4 more)

### Community 14 - "Community 14"
Cohesion: 0.32
Nodes (10): b64urlDecode(), b64urlEncode(), createAdminToken(), getAdminSessionCookie(), getAdminSessionFromRequest(), getAdminTokenFromRequest(), getSecret(), isAdminRequest() (+2 more)

### Community 15 - "Community 15"
Cohesion: 0.18
Nodes (3): BluetoothDevicePickerAdapter, PairedDeviceRow, VH

### Community 16 - "Community 16"
Cohesion: 0.53
Nodes (8): clean(), escapeReg(), isEmptyDisplay(), segregateCustomerDisplay(), segregateHostelBlockRoom(), segregateNameAndReg(), stripTrailingRoomFromBlock(), tryExtractRoomFromBlock()

### Community 17 - "Community 17"
Cohesion: 0.32
Nodes (3): addDaysYmd(), eachYmdInRange(), fillCollectedByDate()

### Community 18 - "Community 18"
Cohesion: 0.29
Nodes (0): 

### Community 19 - "Community 19"
Cohesion: 0.47
Nodes (4): allowInWindow(), envBool(), isConservationMode(), nowMs()

### Community 20 - "Community 20"
Cohesion: 0.4
Nodes (1): BluetoothPrinterDevices

### Community 21 - "Community 21"
Cohesion: 0.4
Nodes (1): PrintBridge

### Community 22 - "Community 22"
Cohesion: 0.5
Nodes (0): 

### Community 23 - "Community 23"
Cohesion: 0.67
Nodes (2): checkAdminRateLimit(), getClientId()

### Community 24 - "Community 24"
Cohesion: 0.67
Nodes (0): 

### Community 25 - "Community 25"
Cohesion: 1.0
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

## Knowledge Gaps
- **1 isolated node(s):** `PairedDeviceRow`
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 25`** (2 nodes): `manifest.ts`, `manifest()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (2 nodes): `ScrollingMarquee.tsx`, `ScrollingMarquee()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (2 nodes): `SegmentTabs.tsx`, `SegmentTabs()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (2 nodes): `TestimonialCarousel.tsx`, `TestimonialCarousel()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (1 nodes): `next.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (1 nodes): `env.production.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (1 nodes): `env.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (1 nodes): `env.development.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (1 nodes): `build.gradle.kts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (1 nodes): `settings.gradle.kts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (1 nodes): `HeroAnimations.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (1 nodes): `sw.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (1 nodes): `generate-env.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ESCPOSBuilder` connect `Community 7` to `Community 6`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._
- **What connects `PairedDeviceRow` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.03 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._
- **Should `Community 4` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
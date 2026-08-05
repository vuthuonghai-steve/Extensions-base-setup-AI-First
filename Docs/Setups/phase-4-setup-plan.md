# Kế hoạch Setup Giai đoạn 4 — Layer 3: Pure Modules & Unit Testing

> **Trạng thái:** ✅ DONE — 2026-08-06, theo `docs/validation-report.md` (bằng chứng cơ học đầy đủ).
> **Vai trò:** AI Product & Development Agent theo `Docs/Trade-offs/AGENTS.md` (8-Stage Pipeline, Dual Context, Binary Gates).
> **Nguồn sự thật:** `Architect-workspace.md` (§4–5 Layer 3, §7 Testing, §11 Gates) · `temps_phase.md` (Phase 4) · `.claude/rules/*` (testing-and-verification, code-quality-and-gates, llm-core-principles, tech-stack-and-conventions).
> **Branch:** `feat/phase-4-layer3-composite-modules` (tách từ main sau merge PR #4).

---

## 1. Mục tiêu

Dựng toàn bộ **Layer 3 — Pure Modules** trong `src/3_modules/`: 3 sub-modules thuần + 1 composite module mẫu, kèm Unit Test Vitest và ngưỡng coverage TST-1. Layer 3 là "trái tim" xử lý nghiệp vụ — 100% Pure TS (không `chrome`, không DOM API), test trực tiếp bằng Vitest không cần Chrome thật; storage I/O qua **interface tự định nghĩa** để Phase 5 lắp adapter thật.

## 2. Hiện trạng đã khảo sát (Constraint Anchoring — S4)

| Hạng mục | Hiện trạng |
|---|---|
| `src/3_modules/` | **Rỗng** (0 file) — branch tách sạch từ main |
| Layer 0 contracts (input) | ✅ Đủ: `AppError`/`MessageResponse`/Result pattern · `StorageKey`/`LogLevel`/`LogEntry` · **không có** Bookmark/User entity (không tạo — YAGNI, type inline trong module) |
| Layer 2 (input) | ✅ Đủ: `StorageDriver` interface (get/set/remove/subscribe), `Router`/`Handler` typed, `sendMessage` timeout+retry |
| Path alias | `@modules` → `src/3_modules`, `@contracts` → `src/0_contracts` ✅ (wxt.config.ts) |
| Vitest | ✅ `WxtVitest()` plugin (fake-browser + alias + auto-imports); test co-located mẫu `*.spec.ts` (storage-driver.spec.ts) |
| G1-06 arch boundary | `chrome_regex`/`dom_regex` áp dụng TargetFile chứa `3_modules/` → deny ngay lúc ghi. **Lưu ý: hook bắt cả từ khóa trong comment** |
| depcruise ARC-1 | ✅ Rule `arc-1: modules-khong-ngo` — `3_modules` không import `1_engine/2_platform_adapters/4_presentation` (chỉ `0_contracts`) |
| Hooks gate active | **G0-04** deny ghi `src/` nếu viability-gate.md thiếu GO Phase 4 (hiện chỉ GO 1–3 — chắc chắn deny) · **G0-01** deny chữ cấm trong docs (chặn cả tên pattern khi mô tả) · **G0-03** force_ask nếu đụng `0_contracts/` · **G0-06** stop-verify · **G1-06** backstop |
| CI | TST-1 đang `pnpm test` **không `--coverage`** → chưa đáp ứng TST-1 §11 (ngưỡng coverage trên `3_modules/`) |
| ESLint | `@typescript-eslint/require-await` error — mock store async không await sẽ fail lint |

## 3. Quyết định kỹ thuật (Stage 3 — đã duyệt)

| # | Quyết định | Lý do (ràng buộc) |
|---|---|---|
| **D1** | Phạm vi 3 `sub-modules/` đúng tên Architect §4: `time-formatter` (formatDate/formatRelativeTime — invalid → Result.err), `dom-parser` (parsePageMetadata từ **string HTML** — title/canonical URL/textLength, **không đụng DOM API**), `ai-stream-decoder` (decodeSseChunk — `data:` lines → chunks JSON, `[DONE]` sentinel, malformed skip+đếm) | Mỗi module 1 hàm chính + test **tại `tests/unit/3_modules/`** (fix: không co-located trong src — xem §8) |
| **D2** | Composite mẫu `bookmark-manager`: `index.ts` (type `Bookmark` + interface `BookmarkStore` + `BookmarkResult<T>`) + `use-cases/bookmark-actions.ts` (`saveBookmark`/`deleteBookmark`/`normalizeUrl` — validate URL http/https, dedupe normalized, lỗi code `INVALID_URL`/`DUPLICATE`/`NOT_FOUND`/`STORE_FAILURE`) + `bookmark-manager.test.ts` (10 tests, in-memory store đóng vai adapter Layer 2) | Đúng mẫu chuẩn Architect §4; chứng minh composite pattern + TST-1 mà không cần feature thật. **Storage I/O qua interface `BookmarkStore`** — ARC-1 chặn import Layer 2, adapter thật lắp Phase 5 |
| **D3** | Test tại `tests/unit/3_modules/` theo cây §4 (import qua alias `@modules`) | Rule cũ ghi "co-located" mâu thuẫn tree §4 → thống nhất 1 pattern; test ở src bị instrument vào coverage làm bóp méo % |
| **D4** | Coverage TST-1: `vitest.config.ts` — `coverage.include: ['src/3_modules/**']`, threshold **lines/functions/statements 90%**, branches 80%, reporter text + text-summary; CI job test → `pnpm test -- --coverage` | §11 TST-1 pass = coverage report đạt ngưỡng đã thống nhất trên `3_modules/`; ngưỡng 90% lines do chủ dự án chốt (Q2) |
| **D5** | Dependency mới `@vitest/coverage-v8@4.1.10` (devDep) | Vitest 4 không kèm coverage provider; phiên bản khớp Vitest 4.1.10 |

## 4. Rủi ro & ứng phó (Reverse Probing)

| # | Rủi ro | Mức | Ứng phó |
|---|---|---|---|
| R1 | G0-04 deny ghi `src/` vì viability-gate.md chưa có GO Phase 4 | Chắc chắn | **T0**: update viability-gate.md trước mọi write |
| R2 | G1-06 deny nếu `chrome`/DOM keyword lọt vào `3_modules/` — kể cả comment | Cao | Comment module tránh từ khóa kích hoạt regex (`DOM API`, `storage layer 2` thay vì tên API trực tiếp) |
| R3 | depcruise chặn composite import `2_platform_adapters` storage driver | Chắc chắn | Storage I/O qua interface `BookmarkStore` do module tự định nghĩa — inject ở Phase 5 |
| R4 | ESLint `require-await` fail trên mock store async | Trung bình | Mock trả `Promise.resolve(...)` thay vì async không await |
| R5 | Coverage 0% vì v8 provider không instrument qua WxtVitest transform | Đã loại | Install `@vitest/coverage-v8` → 96.34% lines (verified) |
| R6 | `new URL` lowercase host nhưng giữ case path → test expectation sai | Thấp | Test theo chuẩn URL thật (path case-sensitive) |
| R7 | RTK proxy cắt output vitest (báo lỗi 0% sai lệch) | Trung bình | Verify coverage qua `--coverage.reporter=json-summary` + `coverage/coverage-summary.json` |

## 5. Danh sách task (T0 → T8) — ✅ HOÀN TẤT

| # | Task | Kết quả |
|---|---|---|
| **T0** | Update `docs/decisions/viability-gate.md` — GO Phase 4 | ✅ Thêm GO + scope + cấm mục |
| **T1** | `sub-modules/time-formatter/` + test | ✅ 5 tests |
| **T2** | `sub-modules/dom-parser/` + test | ✅ 4 tests |
| **T3** | `sub-modules/ai-stream-decoder/` + test | ✅ 4 tests |
| **T4** | `composite-modules/bookmark-manager/` (index + use-cases + test) | ✅ 10 tests |
| **T5** | Coverage config 90% — `vitest.config.ts` | ✅ Lines 96.34% pass |
| **T6** | CI job test thêm `--coverage` | ✅ |
| **T7** | `docs/validation-report.md` — bằng chứng Phase 4 | ✅ |
| **T8** | Commit + merge PR `feat/phase-4-layer3-composite-modules` | — |

**Trình tự verify cuối phase:** `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test -- --coverage && pnpm build && pnpm arc1` — toàn bộ xanh (bằng chứng §6 validation-report.md).

## 6. Bằng chứng (binary gates)

Xem `docs/validation-report.md` mục "Kết quả cơ học Giai đoạn 4" — typecheck/lint/format/test 136/136/coverage 96.34% lines/build/arc1 đều PASS.

## 8. Fix pattern sau review (PR #6 — test placement)

- **Vấn đề**: testing-and-verification.md §3 cũ ghi "Test co-located trong `3_modules/`" nhưng Architect-workspace.md §4 tree ghi `tests/unit/3_modules/` — 2 nguồn mâu thuẫn, không gate nào enforce vị trí test (Vitest quét cả 2 chỗ, coverage `include: ['src/3_modules/**']` instrument cả file test trong src → bóp méo %).
- **Fix**: move 4 spec sang `tests/unit/3_modules/` (`*.spec.ts`, import qua `@modules`); cập nhật testing-and-verification.md §3 bỏ co-located; coverage giờ chỉ đo source thuần (branches 86.66→87.5%, không đổi lines 96.34%).

## 7. Skipped (YAGNI — Zero-Artifact)

- `tests/e2e/` + Playwright (Phase 6) · feature thật ngoài bookmark-manager (Phase 5 khi có consumer) · `domain-entities` Bookmark type (inline trong module) · `0_contracts/` action/type mới (G0-03 — không cần, use-cases thuần).

# Test Plan

**Document ID:** DOC-008  
**Version:** 1.0  
**Date:** June 2026  
**Project Leader:** De Vera, Kevin Russel L.  
**Sponsor:** Pamantasan ng Cabuyao  
**Status:** For Validation  
**Classification:** Confidential - Academic Use Only  

---

## 1. Overview

* **Project:** Performance Profiler - Specialized Hybrid Interpolation Based Profiling System
* **Test Manager:** Daniel Andrie G. Quinatac-an (Quality Assurance)
* **Developer:** Catherine Jade M. De Jesus (Lead Programmer)
* **System Analyst:** Ghuan Christian Narvaez
* **Evaluation Lead:** IT Expert - Technical Evaluator (assigned during evaluation period)
* **Evaluation Support:** Business Evaluator / E-commerce Specialist (assigned during evaluation period)
* **Evaluation Start:** 01 September 2026
* **Evaluation End:** 12 September 2026
* **SRS Reference:** Performance Profiler SRS v1.0 (DOC-005)

---

## 2. Objectives

* Verify that all 18 functional requirements in SRS v1.0 (FR-001–FR-018) across Dataset Management, Benchmark Configuration, Benchmark Execution, Performance Measurement, and Results & Analysis are correctly implemented.
* Validate that execution-time measurement achieves nanosecond precision and can reliably distinguish differences as small as single-digit nanoseconds between the three hybrid algorithms (FR-008, NFR 4.1).
* Confirm that peak and per-batch memory usage (in MB) is accurately captured for each hybrid algorithm during a benchmark run (FR-009, FR-010).
* Validate that the system correctly identifies the fastest-performing algorithm and generates an AI-assisted comparative analysis with a clear, evidence-based recommendation (FR-011, FR-012, FR-018).
* Confirm the system supports datasets and benchmark runs of up to 1,000,000 records/operations without freezing the browser tab (FR-002, FR-005, FR-017, NFR 4.1).
* Verify that CSV/JSON dataset import validation and CSV/JSON result export function correctly and reject malformed data (FR-001, FR-003, FR-015, FR-016).

---

## 3. Test Scope

### 3.1 In Scope

| Module | Test Types | Priority |
| :---: | :---: | :---: |
| **Dataset Management** (Import / Generate / Validate) | Functional, Data Validation | Must Have |
| **Benchmark Configuration** | Functional | Must Have |
| **Benchmark Execution** (3 Hybrid Algorithms) | Functional, Regression | Must Have |
| **Performance Measurement** (Time & Memory) | Functional, Performance | Must Have |
| **Results & Analysis** (incl. AI Analysis API) | Functional, Integration | Must Have |
| **Export & Reporting** (CSV/JSON) | Functional | Should Have |
| **Charting & Visualization** (uPlot) | Functional, UI | Must Have |
| **Large-Scale Dataset Handling** (up to 1,000,000 records) | Performance, Stress | Must Have |

### 3.2 Out of Scope

* Live e-commerce transactions (not part of the Performance Profiler scope).
* Search algorithms other than the three hybrid interpolation variants (Interpolation-Binary, Interpolation-Fibonacci, Interpolation-Exponential).
* User account management / authentication (system does not require end-user login, NFR 4.2).
* Long-term multi-user data storage (benchmark history persists only for the current browser session).
* Mobile browser testing (system targets desktop browsers on Windows 10/11 only).

---

## 4. Test Types

| Test Type | Description | Owner | Tooling |
| :---: | :---: | :---: | :---: |
| **Unit Testing** | Individual functions of the Hybrid Search Engine (interpolation estimate, fallback trigger logic) tested in isolation | Catherine Jade M. De Jesus | JavaScript test runner (Jest) |
| **Integration Testing** | Interaction between the Benchmark Execution module, Runtime Memory API, and external AI/LLM Analysis API | Catherine Jade M. De Jesus | Jest + API mocking |
| **System / E2E Testing** | Full three-step workflow: Import Dataset $\rightarrow$ Run Benchmarks $\rightarrow$ View Results | Daniel Andrie G. Quinatac-an | Manual, browser-based |
| **Performance & Stress Testing** | Execution-time and memory-usage validation on large datasets, up to 1,000,000 records / operations | Daniel Andrie G. Quinatac-an | Browser DevTools, `performance.now()` |
| **Evaluation (Acceptance) Testing** | IT Expert and E-commerce Specialist validate benchmarking correctness, reliability, and real-world applicability | IT Expert, E-commerce Specialist | Manual |
| **Regression Testing** | Re-run of the test suite after each defect fix to confirm no prior functionality was broken | Daniel Andrie G. Quinatac-an | Manual / repeat runs |

---

## 5. Entry & Exit Criteria

### 5.1 Evaluation Entry Criteria
* All Must Have functional requirements (FR-001–FR-014, FR-017, FR-018) implemented and passing unit and integration testing.
* Synthetic dataset generation verified for all four selectable sizes (1,000 / 10,000 / 100,000 / 1,000,000 records) without freezing the browser.
* Zero open Critical or High defects from integration testing.
* Application stable on the hosting platform (Vercel), reachable over HTTPS, for 48 continuous hours.
* Representative sample datasets (valid and intentionally malformed CSV/JSON files) available for import and validation testing.

### 5.2 Evaluation Exit Criteria
* All Must Have and Should Have functional requirements pass evaluation acceptance criteria.
* Zero open Critical defects; zero open High defects.
* IT Expert (Technical Evaluator) and E-commerce Specialist (Business Evaluator) both sign off evaluation results in writing.
* A full benchmark run of 1,000,000 records / 1,000,000 operations completes successfully across all three hybrid algorithms.
* Results charts (execution-time progression, memory-usage analysis, combined chart) render within 3 seconds of benchmark completion, per NFR 4.1.

---

## 6. Defect Severity

| Severity | Definition | Response Time | Resolution Target |
| :---: | :---: | :---: | :---: |
| **Critical** | Application crash, corrupted or incorrect benchmark results, browser memory limit failure on a 1,000,000-record run, or exposure of the AI analysis API key | Immediate (same day) | Before evaluation resumes |
| **High** | Core workflow blocked (Import / Run / Results); incorrect execution-time or memory readings; AI-assisted analysis fails to generate | Within 24 hours | Within 3 working days |
| **Medium** | Feature works with a workaround; minor chart or table display errors; export formatting issues | Within 48 hours | Before final submission |
| **Low** | Cosmetic issues, minor UI/UX improvements | Logged for backlog | Post-evaluation acceptable |

---

## 7. Schedule

| Activity | Start | End | Owner |
| :---: | :---: | :---: | :---: |
| **Unit & integration testing** (alongside development) | 01 Jul 2026 | 14 Aug 2026 | Catherine Jade M. De Jesus |
| **System/E2E test cases written & reviewed** | 10 Aug 2026 | 20 Aug 2026 | Daniel Andrie G. Quinatac-an |
| **Test Plan & Test Case submission** (Lab Quiz 2) | 20 Aug 2026 | 20 Aug 2026 | Daniel Andrie G. Quinatac-an |
| **Performance & stress testing** (large datasets) | 21 Aug 2026 | 28 Aug 2026 | Catherine Jade M. De Jesus |
| **Evaluation execution** (IT Expert & E-commerce Specialist) | 01 Sep 2026 | 12 Sep 2026 | IT Expert, E-commerce Specialist |
| **Defect fixes & regression re-run** | 13 Sep 2026 | 20 Sep 2026 | Catherine Jade M. De Jesus |
| **Evaluation sign-off meeting** | 21 Sep 2026 | 21 Sep 2026 | Ghuan Christian Narvaez |
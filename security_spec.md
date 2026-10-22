# Security Specification: EXAMCBT Admin & Firestore Security

## 1. Data Invariants
1. **Admin Authorization**: Only authenticated and email-verified administrators (specifically bootstrap admin `iswanlabanto18@guru.sma.belajar.id` or registered admin in `/admins/{adminId}`) can create, update, or delete exam configurations.
2. **Exam ID Integrity**: Document ID must be a valid alphanumeric string with hyphens (`^[a-zA-Z0-9_-]+$`) and max length 64 characters.
3. **PIN Safety & Volumetric Boundaries**: `pinMasuk`, `pinKeluar`, and `pinPengawas` must be non-empty strings under 10 characters (typically 4 digits).
4. **URL Safety**: `googleFormUrl` must be a valid string up to 1000 characters.
5. **Duration Invariant**: `durationMinutes` must be a positive number greater than 0 and less than or equal to 1440 (24 hours).
6. **Status Lifecycle**: `status` must be one of `['draft', 'active', 'closed']`.
7. **Read Access**:
   - Admins can read all exams and admin records.
   - Public/Student client apps can read exams marked with `status == 'active'` or read specific exam configs by ID to execute tests.
   - Admin collection `/admins/{adminId}` read and write is strictly restricted to verified admins.

---

## 2. The "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)

1. **Payload 1 (Unauthenticated Exam Creation)**: An unauthenticated guest trying to write a new exam to `/exams/EXAM-HACK-01`.
2. **Payload 2 (Unverified Email Admin Spoof)**: An authenticated user claiming email `iswanlabanto18@guru.sma.belajar.id` but with `email_verified: false` attempting to create an exam.
3. **Payload 3 (Non-Admin User Modification)**: An authenticated non-admin user trying to update PINs on `/exams/EXAM-2026-001`.
4. **Payload 4 (Ghost Field Injection)**: Admin attempting to create an exam with extra malicious/unauthorized fields like `maliciousPayload: true`.
5. **Payload 5 (Oversized Document ID / ID Poisoning)**: Write attempt to `/exams/` with a 2000-character junk string as the document ID.
6. **Payload 6 (Oversized String / Denial of Wallet)**: Setting `examTitle` or `googleFormUrl` with a 2MB payload string.
7. **Payload 7 (Invalid Status Value)**: Updating `status` to an unauthorized state like `'deleted'` or `'hacked'`.
8. **Payload 8 (Negative or Zero Duration)**: Creating an exam with `durationMinutes: -30` or `durationMinutes: 0`.
9. **Payload 9 (Self-Promoted Admin Record)**: Regular user writing their own UID into `/admins/{uid}` with `role: 'superadmin'`.
10. **Payload 10 (Delete Admin Collection)**: Unauthorized deletion of the `/admins/` records.
11. **Payload 11 (Blanket Admin List Query by Guest)**: Unauthenticated list query against the `/admins` collection.
12. **Payload 12 (Empty Required Fields)**: Exam creation payload missing required fields like `googleFormUrl` or `pinMasuk`.

---

## 3. Test Runner
Defined in `firestore.rules.test.ts` to assert that all unauthenticated or malicious payloads are rejected with PERMISSION_DENIED.

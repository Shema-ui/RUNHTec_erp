/// <reference path="../pb_data/types.d.ts" />

// Server-side audit trail for sensitive changes. Runs regardless of which
// client made the request (web app, direct API call, curl), so it can't be
// bypassed the way a frontend-only logging call could be. Writes into the
// existing activity_logs collection — no new collection introduced.
//
// IMPORTANT: PocketBase's JSVM does not retain closures over top-level
// const/function declarations inside a deferred hook callback (verified
// empirically — referencing a file-scope const or function from within an
// onRecord*Request callback throws "ReferenceError: x is not defined" at
// request time, even though it resolves fine at file-load time). Every
// hook below is therefore fully self-contained: no shared helpers, only
// values passed in via the tag list at registration time (which *is*
// evaluated at file-load time and works fine).

onRecordCreateRequest((e) => {
  e.next();
  try {
    const collectionName = e.collection.name;
    const who = e.auth ? (e.auth.get("name") || e.auth.get("email") || "Unknown user") : "System";
    let label = e.record.id;
    if (collectionName === "users") label = e.record.get("email");
    else if (collectionName === "invoices") label = e.record.get("invoice_number");
    else if (collectionName === "payments") label = e.record.get("reference") || e.record.id;
    else if (collectionName === "quotations") label = e.record.get("number");

    const logs = e.app.findCollectionByNameOrId("activity_logs");
    const entry = new Record(logs);
    entry.set("actor", e.auth ? e.auth.id : "");
    entry.set("actor_name", who);
    entry.set("action", "Created " + collectionName);
    entry.set("detail", label);
    e.app.save(entry);
  } catch (err) {
    console.log("audit log (create) failed:", err);
  }
}, "users", "invoices", "payments", "quotations");

onRecordUpdateRequest((e) => {
  e.next();
  try {
    const collectionName = e.collection.name;
    const who = e.auth ? (e.auth.get("name") || e.auth.get("email") || "Unknown user") : "System";
    let label = e.record.id;
    if (collectionName === "users") label = e.record.get("email");
    else if (collectionName === "invoices") label = e.record.get("invoice_number");
    else if (collectionName === "payments") label = e.record.get("reference") || e.record.id;
    else if (collectionName === "quotations") label = e.record.get("number");
    else if (collectionName === "rfqs") label = e.record.get("company") || e.record.get("name") || e.record.id;
    else if (collectionName === "company_settings") label = "Company Settings";

    // Curated "important field" diff per collection, kept small so entries
    // stay readable instead of dumping the whole record on every edit.
    let watchedFields = [];
    if (collectionName === "users") watchedFields = ["role", "status", "email"];
    else if (collectionName === "invoices") watchedFields = ["status", "total"];
    else if (collectionName === "payments") watchedFields = ["status", "amount"];
    else if (collectionName === "quotations") watchedFields = ["status", "total"];
    else if (collectionName === "rfqs") watchedFields = ["status", "request_status"];
    else if (collectionName === "company_settings") watchedFields = ["bank_name", "account_number", "signature", "stamp", "logo", "show_signature", "show_stamp"];

    let changes = [];
    try {
      const before = e.record.original();
      watchedFields.forEach((field) => {
        const oldVal = before.get(field);
        const newVal = e.record.get(field);
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          changes.push(field + ": '" + oldVal + "' -> '" + newVal + "'");
        }
      });
    } catch (_) {}

    const logs = e.app.findCollectionByNameOrId("activity_logs");
    const entry = new Record(logs);
    entry.set("actor", e.auth ? e.auth.id : "");
    entry.set("actor_name", who);
    entry.set("action", "Updated " + collectionName);
    entry.set("detail", [label, changes.join(", ")].filter(Boolean).join(" \u2014 "));
    e.app.save(entry);
  } catch (err) {
    console.log("audit log (update) failed:", err);
  }
}, "users", "company_settings", "invoices", "payments", "quotations", "rfqs");

onRecordDeleteRequest((e) => {
  e.next();
  try {
    const collectionName = e.collection.name;
    const who = e.auth ? (e.auth.get("name") || e.auth.get("email") || "Unknown user") : "System";
    let label = e.record.id;
    if (collectionName === "users") label = e.record.get("email");
    else if (collectionName === "invoices") label = e.record.get("invoice_number");
    else if (collectionName === "payments") label = e.record.get("reference") || e.record.id;
    else if (collectionName === "quotations") label = e.record.get("number");
    else if (collectionName === "rfqs") label = e.record.get("company") || e.record.get("name") || e.record.id;
    else if (collectionName === "clients") label = e.record.get("company_name") || e.record.id;
    else if (collectionName === "projects") label = e.record.get("title") || e.record.id;
    else if (collectionName === "company_settings") label = "Company Settings";

    const logs = e.app.findCollectionByNameOrId("activity_logs");
    const entry = new Record(logs);
    entry.set("actor", e.auth ? e.auth.id : "");
    entry.set("actor_name", who);
    entry.set("action", "Deleted " + collectionName);
    entry.set("detail", label);
    e.app.save(entry);
  } catch (err) {
    console.log("audit log (delete) failed:", err);
  }
}, "users", "company_settings", "invoices", "payments", "quotations", "rfqs", "clients", "projects");

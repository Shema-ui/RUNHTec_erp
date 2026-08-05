/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // company_settings collection
    let settingsCol;
    try {
      settingsCol = app.findCollectionByNameOrId("company_settings");
    } catch (_) {
      settingsCol = new Collection({
        type: "base",
        name: "company_settings",
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.role = 'super_admin'",
        updateRule: "@request.auth.role = 'super_admin'",
        deleteRule: null,
        fields: [
          { name: "bank_name", type: "text", max: 200 },
          { name: "account_name", type: "text", max: 200 },
          { name: "account_number", type: "text", max: 100 },
          { name: "branch_code", type: "text", max: 50 },
          { name: "swift_code", type: "text", max: 50 },
          { name: "currency", type: "text", max: 10 },
          { name: "company_address", type: "text", max: 500 },
          { name: "company_phone", type: "text", max: 100 },
          { name: "company_email", type: "text", max: 200 },
          { name: "company_website", type: "text", max: 200 },
          { name: "created", type: "autodate", onCreate: true, onUpdate: false },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
      });
      app.save(settingsCol);
    }

    // Seed default company settings
    try {
      const existing = app.findFirstRecordByFilter("company_settings", "id != ''");
    } catch (_) {
      // no record yet — seed defaults
      const rec = new Record(settingsCol);
      rec.set("bank_name", "First National Bank");
      rec.set("account_name", "RUNHTec Contractors (Pty) Ltd");
      rec.set("account_number", "");
      rec.set("branch_code", "");
      rec.set("swift_code", "FIRNZAJJ");
      rec.set("currency", "ZAR");
      rec.set("company_address", "Kigali, Rwanda");
      rec.set("company_phone", "+250 XXX XXX XXX");
      rec.set("company_email", "info@runhteccontractors.com");
      rec.set("company_website", "www.runhteccontractors.com");
      app.save(rec);
    }

    // invoices collection
    let invoicesCol;
    try {
      invoicesCol = app.findCollectionByNameOrId("invoices");
    } catch (_) {
      const users = app.findCollectionByNameOrId("users");
      const clients = app.findCollectionByNameOrId("clients");

      invoicesCol = new Collection({
        type: "base",
        name: "invoices",
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          { name: "invoice_number", type: "text", required: true, max: 50 },
          { name: "client", type: "relation", maxSelect: 1, collectionId: clients.id },
          { name: "bill_to_name", type: "text", max: 200 },
          { name: "bill_to_company", type: "text", max: 200 },
          { name: "bill_to_address", type: "text", max: 500 },
          { name: "bill_to_email", type: "text", max: 200 },
          { name: "bill_to_phone", type: "text", max: 50 },
          { name: "invoice_date", type: "text", max: 20 },
          { name: "due_date", type: "text", max: 20 },
          { name: "payment_terms", type: "text", max: 100 },
          { name: "items", type: "json" },
          { name: "subtotal", type: "number" },
          { name: "tax_rate", type: "number" },
          { name: "tax_amount", type: "number" },
          { name: "discount_amount", type: "number" },
          { name: "total", type: "number" },
          { name: "currency", type: "text", max: 10 },
          { name: "notes", type: "text", max: 2000 },
          { name: "payment_instructions", type: "text", max: 2000 },
          { name: "terms_conditions", type: "text", max: 5000 },
          { name: "status", type: "select", maxSelect: 1, values: ["draft", "sent", "paid", "overdue", "cancelled"] },
          { name: "created_by", type: "relation", maxSelect: 1, collectionId: users.id },
          { name: "created_by_name", type: "text", max: 200 },
          { name: "created", type: "autodate", onCreate: true, onUpdate: false },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
        indexes: [
          "CREATE INDEX idx_invoice_number ON invoices (invoice_number)",
          "CREATE INDEX idx_invoice_status ON invoices (status)",
          "CREATE INDEX idx_invoice_client ON invoices (client)",
        ],
      });
      app.save(invoicesCol);
    }
  },
  (app) => {
    try { app.delete(app.findCollectionByNameOrId("invoices")); } catch (_) {}
    try { app.delete(app.findCollectionByNameOrId("company_settings")); } catch (_) {}
  }
);

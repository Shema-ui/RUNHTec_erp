/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    const clients = app.findCollectionByNameOrId("clients");

    const createCollection = (name, fields, rules, indexes = []) => {
      let collection;
      try {
        collection = app.findCollectionByNameOrId(name);
      } catch (_) {
        collection = new Collection({
          type: "base",
          name,
          listRule: rules.listRule,
          viewRule: rules.viewRule,
          createRule: rules.createRule,
          updateRule: rules.updateRule,
          deleteRule: rules.deleteRule,
          fields,
          indexes,
        });
        app.save(collection);
      }
      return collection;
    };

    createCollection(
      "rfqs",
      [
        { name: "name", type: "text", required: true, max: 200 },
        { name: "company", type: "text", max: 200 },
        { name: "email", type: "text", max: 200 },
        { name: "phone", type: "text", max: 80 },
        { name: "service_type", type: "text", max: 200 },
        { name: "urgency", type: "text", max: 80 },
        { name: "budget", type: "text", max: 80 },
        { name: "address", type: "text", max: 500 },
        { name: "description", type: "text", max: 4000 },
        { name: "attachments", type: "file", maxSelect: 20 },
        { name: "status", type: "select", maxSelect: 1, values: ["new", "reviewing", "quoted", "declined"] },
        { name: "source", type: "select", maxSelect: 1, values: ["website", "manual"] },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      ],
      {
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
      },
      ["CREATE INDEX idx_rfqs_status ON rfqs (status)"]
    );

    createCollection(
      "quotations",
      [
        { name: "rfq", type: "relation", maxSelect: 1, collectionId: app.findCollectionByNameOrId("rfqs").id },
        { name: "client", type: "relation", maxSelect: 1, collectionId: clients.id },
        { name: "number", type: "text", required: true, max: 50 },
        { name: "items", type: "json" },
        { name: "subtotal", type: "number" },
        { name: "tax_rate", type: "number" },
        { name: "tax_amount", type: "number" },
        { name: "total", type: "number" },
        { name: "currency", type: "text", max: 10 },
        { name: "notes", type: "text", max: 4000 },
        { name: "status", type: "select", maxSelect: 1, values: ["draft", "sent", "accepted", "declined", "expired"] },
        { name: "valid_until", type: "text", max: 20 },
        { name: "signed_at", type: "text", max: 20 },
        { name: "signed_by_name", type: "text", max: 200 },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      ],
      {
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
      },
      ["CREATE INDEX idx_quotations_status ON quotations (status)"]
    );

    createCollection(
      "projects",
      [
        { name: "quotation", type: "relation", maxSelect: 1, collectionId: app.findCollectionByNameOrId("quotations").id },
        { name: "client", type: "relation", maxSelect: 1, collectionId: clients.id },
        { name: "title", type: "text", required: true, max: 200 },
        { name: "status", type: "select", maxSelect: 1, values: ["scheduled", "in_progress", "done", "cancelled"] },
        { name: "assigned_technicians", type: "relation", maxSelect: 10, collectionId: users.id },
        { name: "tasks", type: "json" },
        { name: "site_address", type: "text", max: 500 },
        { name: "start_date", type: "text", max: 20 },
        { name: "due_date", type: "text", max: 20 },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      ],
      {
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
      },
      ["CREATE INDEX idx_projects_status ON projects (status)"]
    );

    createCollection(
      "maintenance_contracts",
      [
        { name: "client", type: "relation", maxSelect: 1, collectionId: clients.id },
        { name: "service_type", type: "text", max: 200 },
        { name: "frequency", type: "text", max: 80 },
        { name: "next_due_date", type: "text", max: 20 },
        { name: "active", type: "bool" },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      ],
      {
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
      }
    );

    createCollection(
      "employees",
      [
        { name: "user", type: "relation", maxSelect: 1, collectionId: users.id },
        { name: "role", type: "text", max: 80 },
        { name: "phone", type: "text", max: 80 },
        { name: "skills", type: "json" },
        { name: "active", type: "bool" },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      ],
      {
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
      }
    );

    createCollection(
      "notifications",
      [
        { name: "user", type: "relation", maxSelect: 1, collectionId: users.id },
        { name: "type", type: "text", max: 80 },
        { name: "message", type: "text", max: 4000 },
        { name: "read", type: "bool" },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      ],
      {
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
      },
      ["CREATE INDEX idx_notifications_read ON notifications (read)"]
    );

    createCollection(
      "payments",
      [
        { name: "client", type: "relation", maxSelect: 1, collectionId: clients.id },
        { name: "reference", type: "text", max: 120 },
        { name: "amount", type: "number" },
        { name: "currency", type: "text", max: 10 },
        { name: "status", type: "select", maxSelect: 1, values: ["pending", "completed", "failed"] },
        { name: "transaction_reference", type: "text", max: 200 },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      ],
      {
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
      }
    );

    createCollection(
      "documents",
      [
        { name: "title", type: "text", required: true, max: 200 },
        { name: "client", type: "relation", maxSelect: 1, collectionId: clients.id },
        { name: "type", type: "text", max: 80 },
        { name: "file", type: "file", maxSelect: 1 },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      ],
      {
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
      }
    );
  },
  (app) => {
    ["rfqs", "quotations", "projects", "maintenance_contracts", "employees", "notifications", "payments", "documents"].forEach((name) => {
      try { app.delete(app.findCollectionByNameOrId(name)); } catch (_) {}
    });
  }
);

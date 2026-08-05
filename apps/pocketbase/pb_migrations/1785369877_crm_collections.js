/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");

    // 1. clients
    const clients = new Collection({
      type: "base",
      name: "clients",
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: "client_id", type: "text", max: 20 },
        { name: "company_name", type: "text", required: true, max: 200 },
        { name: "trading_name", type: "text", max: 200 },
        { name: "industry", type: "text", max: 100 },
        { name: "registration_number", type: "text", max: 50 },
        { name: "vat_number", type: "text", max: 50 },
        { name: "website", type: "url" },
        {
          name: "logo",
          type: "file",
          maxSelect: 1,
          maxSize: 5242880,
          mimeTypes: ["image/jpeg", "image/png", "image/svg+xml", "image/gif", "image/webp"],
        },
        {
          name: "status",
          type: "select",
          maxSelect: 1,
          required: true,
          values: ["lead", "active", "inactive", "suspended"],
        },
        {
          name: "categories",
          type: "select",
          maxSelect: 12,
          values: ["government", "ngo", "commercial", "industrial", "residential", "educational", "healthcare", "hospitality", "manufacturing", "agriculture", "mining", "other"],
        },
        {
          name: "services",
          type: "select",
          maxSelect: 15,
          values: ["electrical", "hvac", "solar", "borehole", "plumbing", "fire_protection", "mechanical", "civil", "preventive_maintenance", "corrective_maintenance", "construction", "ict", "energy_audits", "generator", "other"],
        },
        { name: "potential_value", type: "number", min: 0 },
        { name: "country", type: "text", max: 100 },
        { name: "province", type: "text", max: 100 },
        { name: "district", type: "text", max: 100 },
        { name: "city", type: "text", max: 100 },
        { name: "sector", type: "text", max: 100 },
        { name: "street", type: "text", max: 200 },
        { name: "building_name", type: "text", max: 100 },
        { name: "office_number_addr", type: "text", max: 50 },
        { name: "gps_coordinates", type: "text", max: 100 },
        { name: "account_manager", type: "relation", maxSelect: 1, collectionId: users.id },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE INDEX idx_clients_status ON clients (status)",
        "CREATE INDEX idx_clients_company_name ON clients (company_name)",
      ],
    });
    app.save(clients);

    // 2. client_contacts
    const contacts = new Collection({
      type: "base",
      name: "client_contacts",
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: "client", type: "relation", required: true, maxSelect: 1, collectionId: clients.id, cascadeDelete: true },
        { name: "full_name", type: "text", required: true, max: 200 },
        { name: "position", type: "text", max: 100 },
        { name: "mobile", type: "text", max: 20 },
        { name: "office", type: "text", max: 20 },
        { name: "whatsapp", type: "text", max: 20 },
        { name: "email", type: "email" },
        { name: "is_primary", type: "bool" },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: ["CREATE INDEX idx_contacts_client ON client_contacts (client)"],
    });
    app.save(contacts);

    // 3. client_activities
    const activities = new Collection({
      type: "base",
      name: "client_activities",
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: null,
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: "client", type: "relation", required: true, maxSelect: 1, collectionId: clients.id, cascadeDelete: true },
        {
          name: "type",
          type: "select",
          maxSelect: 1,
          required: true,
          values: ["call", "email", "meeting", "site_visit", "rfq", "quotation", "work_order", "project", "maintenance", "invoice", "payment", "note", "attachment", "other"],
        },
        { name: "description", type: "text", required: true, max: 1000 },
        { name: "actor", type: "relation", maxSelect: 1, collectionId: users.id },
        { name: "actor_name", type: "text", max: 200 },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      ],
      indexes: ["CREATE INDEX idx_activities_client ON client_activities (client)"],
    });
    app.save(activities);

    // 4. client_followups
    const followups = new Collection({
      type: "base",
      name: "client_followups",
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: "client", type: "relation", required: true, maxSelect: 1, collectionId: clients.id, cascadeDelete: true },
        {
          name: "type",
          type: "select",
          maxSelect: 1,
          required: true,
          values: ["call", "meeting", "site_visit", "email", "task"],
        },
        { name: "title", type: "text", required: true, max: 200 },
        { name: "description", type: "text", max: 500 },
        { name: "due_date", type: "date" },
        { name: "assigned_to", type: "relation", maxSelect: 1, collectionId: users.id },
        {
          name: "status",
          type: "select",
          maxSelect: 1,
          values: ["pending", "completed", "cancelled"],
        },
        {
          name: "priority",
          type: "select",
          maxSelect: 1,
          values: ["low", "medium", "high"],
        },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE INDEX idx_followups_client ON client_followups (client)",
        "CREATE INDEX idx_followups_status ON client_followups (status)",
        "CREATE INDEX idx_followups_due_date ON client_followups (due_date)",
      ],
    });
    app.save(followups);

    // 5. client_notes
    const notes = new Collection({
      type: "base",
      name: "client_notes",
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: "client", type: "relation", required: true, maxSelect: 1, collectionId: clients.id, cascadeDelete: true },
        { name: "title", type: "text", max: 200 },
        { name: "body", type: "text", max: 10000 },
        {
          name: "category",
          type: "select",
          maxSelect: 1,
          values: ["general", "technical", "financial", "legal", "other"],
        },
        {
          name: "priority",
          type: "select",
          maxSelect: 1,
          values: ["low", "medium", "high"],
        },
        { name: "author", type: "relation", maxSelect: 1, collectionId: users.id },
        { name: "author_name", type: "text", max: 200 },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: ["CREATE INDEX idx_notes_client ON client_notes (client)"],
    });
    app.save(notes);

    // 6. client_documents
    const documents = new Collection({
      type: "base",
      name: "client_documents",
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: "client", type: "relation", required: true, maxSelect: 1, collectionId: clients.id, cascadeDelete: true },
        { name: "title", type: "text", required: true, max: 200 },
        {
          name: "doc_type",
          type: "select",
          maxSelect: 1,
          values: ["rfq", "boq", "contract", "drawing", "photo", "purchase_order", "certificate", "technical_report", "site_report", "other"],
        },
        { name: "file", type: "file", maxSelect: 1, maxSize: 52428800 },
        { name: "uploaded_by", type: "relation", maxSelect: 1, collectionId: users.id },
        { name: "uploaded_by_name", type: "text", max: 200 },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: ["CREATE INDEX idx_documents_client ON client_documents (client)"],
    });
    app.save(documents);

    // 7. equipment
    const equipment = new Collection({
      type: "base",
      name: "equipment",
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: "client", type: "relation", required: true, maxSelect: 1, collectionId: clients.id, cascadeDelete: true },
        { name: "equipment_id", type: "text", max: 30 },
        { name: "name", type: "text", required: true, max: 200 },
        {
          name: "category",
          type: "select",
          maxSelect: 1,
          values: ["hvac", "electrical", "solar", "borehole", "plumbing", "fire", "mechanical", "generator", "ict", "civil", "other"],
        },
        { name: "manufacturer", type: "text", max: 100 },
        { name: "brand", type: "text", max: 100 },
        { name: "model_number", type: "text", max: 100 },
        { name: "serial_number", type: "text", max: 100 },
        { name: "capacity", type: "text", max: 50 },
        { name: "voltage", type: "text", max: 50 },
        { name: "power_rating", type: "text", max: 50 },
        { name: "installation_date", type: "date" },
        { name: "warranty_expiry", type: "date" },
        { name: "commissioning_date", type: "date" },
        { name: "asset_location", type: "text", max: 200 },
        { name: "building", type: "text", max: 100 },
        { name: "floor", type: "text", max: 50 },
        { name: "room", type: "text", max: 100 },
        { name: "gps_coordinates", type: "text", max: 100 },
        {
          name: "condition",
          type: "select",
          maxSelect: 1,
          values: ["excellent", "good", "fair", "poor", "critical"],
        },
        {
          name: "status",
          type: "select",
          maxSelect: 1,
          values: ["operational", "under_maintenance", "faulty", "decommissioned"],
        },
        { name: "service_interval", type: "text", max: 50 },
        { name: "next_service_date", type: "date" },
        { name: "assigned_technician", type: "text", max: 200 },
        {
          name: "photos",
          type: "file",
          maxSelect: 10,
          maxSize: 10485760,
          mimeTypes: ["image/jpeg", "image/png", "image/webp"],
        },
        { name: "remarks", type: "text", max: 1000 },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE INDEX idx_equipment_client ON equipment (client)",
        "CREATE INDEX idx_equipment_status ON equipment (status)",
      ],
    });
    app.save(equipment);

    // 8. sales_opportunities
    const opportunities = new Collection({
      type: "base",
      name: "sales_opportunities",
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: "client", type: "relation", required: true, maxSelect: 1, collectionId: clients.id, cascadeDelete: true },
        { name: "title", type: "text", required: true, max: 200 },
        {
          name: "stage",
          type: "select",
          maxSelect: 1,
          required: true,
          values: ["new_lead", "contacted", "meeting_scheduled", "site_visit", "proposal_prep", "quotation_sent", "negotiation", "won", "lost"],
        },
        { name: "value", type: "number", min: 0 },
        { name: "description", type: "text", max: 1000 },
        { name: "expected_close", type: "date" },
        { name: "assigned_to", type: "relation", maxSelect: 1, collectionId: users.id },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: ["CREATE INDEX idx_opportunities_stage ON sales_opportunities (stage)"],
    });
    app.save(opportunities);
  },
  (app) => {
    const names = [
      "sales_opportunities",
      "equipment",
      "client_documents",
      "client_notes",
      "client_followups",
      "client_activities",
      "client_contacts",
      "clients",
    ];
    for (const name of names) {
      try {
        app.delete(app.findCollectionByNameOrId(name));
      } catch (_) {}
    }
  }
);

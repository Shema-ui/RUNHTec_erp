/// <reference path="../pb_data/types.d.ts" />

// Role-based access rules for the five roles introduced in
// 1790000004_rbac_roles.js. Design:
//   - super_admin: unrestricted everywhere (unchanged).
//   - Most operational records stay LIST/VIEW-able by any authenticated
//     staff member, because client/project/quotation names are referenced
//     across modules (e.g. an accountant viewing an invoice needs the
//     client's name, a technician on a project needs to see who it's for).
//     Write access (create/update/delete) is what gets restricted per role.
//   - Financial data (invoices, payments) is the exception: both READ and
//     WRITE are restricted to super_admin + accountant, per the explicit
//     "protect financial information" requirement.
//   - notifications are scoped so a user only ever lists/views their own.
//   - Where the schema has a usable per-record technician relation
//     (projects.assigned_technicians), technicians get update rights
//     scoped to records they're actually assigned to, not the whole table.

migrate(
  (app) => {
    const SUPER = "@request.auth.role = 'super_admin'";
    const SALES = "@request.auth.role = 'sales'";
    const PM = "@request.auth.role = 'project_manager'";
    const ACCOUNTANT = "@request.auth.role = 'accountant'";
    const TECH = "@request.auth.role = 'technician'";
    const AUTHED = "@request.auth.id != ''";

    const any = (...clauses) => clauses.join(" || ");

    const setRules = (name, rules) => {
      const col = app.findCollectionByNameOrId(name);
      if (rules.listRule !== undefined) col.listRule = rules.listRule;
      if (rules.viewRule !== undefined) col.viewRule = rules.viewRule;
      if (rules.createRule !== undefined) col.createRule = rules.createRule;
      if (rules.updateRule !== undefined) col.updateRule = rules.updateRule;
      if (rules.deleteRule !== undefined) col.deleteRule = rules.deleteRule;
      app.save(col);
    };

    // Needed so technicians can be scoped to only their own maintenance
    // jobs below — the collection previously had no assignment field at all.
    const maintenance = app.findCollectionByNameOrId("maintenance_contracts");
    if (!maintenance.fields.getByName("assigned_technician")) {
      maintenance.fields.add(
        new RelationField({
          name: "assigned_technician",
          maxSelect: 1,
          collectionId: app.findCollectionByNameOrId("users").id,
          cascadeDelete: false,
        })
      );
      app.save(maintenance);
    }

    // --- Sales domain: Leads, Clients, RFQs, Quotations ---
    const salesWrite = any(SUPER, SALES);
    ["clients", "client_contacts", "client_activities", "client_followups", "client_notes", "client_documents", "sales_opportunities"].forEach((name) => {
      setRules(name, { listRule: AUTHED, viewRule: AUTHED, createRule: salesWrite, updateRule: salesWrite, deleteRule: salesWrite });
    });
    setRules("rfqs", { listRule: AUTHED, viewRule: AUTHED, createRule: salesWrite, updateRule: salesWrite, deleteRule: salesWrite });
    setRules("quotations", { listRule: AUTHED, viewRule: AUTHED, createRule: salesWrite, updateRule: salesWrite, deleteRule: salesWrite });

    // --- Project Manager domain: Projects, Maintenance, Project documents ---
    const pmWrite = any(SUPER, PM);
    // Technicians may update (not create/delete) a project they are
    // assigned to via the existing assigned_technicians relation.
    const projectUpdate = any(SUPER, PM, "assigned_technicians.id ?= @request.auth.id");
    setRules("projects", { listRule: AUTHED, viewRule: AUTHED, createRule: pmWrite, updateRule: projectUpdate, deleteRule: pmWrite });

    const maintenanceUpdate = any(SUPER, PM, "assigned_technician = @request.auth.id");
    setRules("maintenance_contracts", { listRule: AUTHED, viewRule: AUTHED, createRule: pmWrite, updateRule: maintenanceUpdate, deleteRule: pmWrite });

    // equipment is asset/maintenance tracking data — PM manages it,
    // technicians update condition/status as part of their work.
    const equipmentWrite = any(SUPER, PM, TECH);
    setRules("equipment", { listRule: AUTHED, viewRule: AUTHED, createRule: equipmentWrite, updateRule: equipmentWrite, deleteRule: pmWrite });

    setRules("employees", { listRule: AUTHED, viewRule: AUTHED, createRule: pmWrite, updateRule: pmWrite, deleteRule: pmWrite });

    // Project/site documents — PM manages the library, technicians can
    // upload (site photos, reports) as part of "work updates" but cannot
    // alter or remove what's already there.
    setRules("documents", { listRule: AUTHED, viewRule: AUTHED, createRule: any(SUPER, PM, TECH), updateRule: pmWrite, deleteRule: pmWrite });

    // --- Accountant domain: Invoices, Payments (financial data — locked down) ---
    const financeAccess = any(SUPER, ACCOUNTANT);
    setRules("invoices", { listRule: financeAccess, viewRule: financeAccess, createRule: financeAccess, updateRule: financeAccess, deleteRule: financeAccess });
    setRules("payments", { listRule: financeAccess, viewRule: financeAccess, createRule: financeAccess, updateRule: financeAccess, deleteRule: financeAccess });

    // --- Notifications: users only ever see their own ---
    const ownNotification = any(SUPER, "user = @request.auth.id");
    setRules("notifications", { listRule: ownNotification, viewRule: ownNotification, createRule: AUTHED, updateRule: ownNotification, deleteRule: SUPER });
  },
  (app) => {
    const AUTHED = "@request.auth.id != ''";
    const collections = [
      "clients", "client_contacts", "client_activities", "client_followups", "client_notes", "client_documents",
      "sales_opportunities", "rfqs", "quotations", "projects", "maintenance_contracts", "equipment", "employees",
      "documents", "invoices", "payments", "notifications",
    ];
    collections.forEach((name) => {
      try {
        const col = app.findCollectionByNameOrId(name);
        col.listRule = AUTHED;
        col.viewRule = AUTHED;
        col.createRule = AUTHED;
        col.updateRule = name === "client_activities" ? null : AUTHED;
        col.deleteRule = AUTHED;
        app.save(col);
      } catch (_) {}
    });

    try {
      const maintenance = app.findCollectionByNameOrId("maintenance_contracts");
      if (maintenance.fields.getByName("assigned_technician")) {
        maintenance.fields.removeByName("assigned_technician");
        app.save(maintenance);
      }
    } catch (_) {}
  }
);

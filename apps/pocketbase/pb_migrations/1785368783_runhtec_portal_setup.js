/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // --- users auth collection ---
    const users = app.findCollectionByNameOrId("users");

    if (!users.fields.getByName("role")) {
      users.fields.add(
        new SelectField({
          name: "role",
          required: true,
          maxSelect: 1,
          values: ["super_admin", "admin"],
        }),
      );
    }
    if (!users.fields.getByName("status")) {
      users.fields.add(
        new SelectField({
          name: "status",
          required: true,
          maxSelect: 1,
          values: ["active", "suspended"],
        }),
      );
    }
    if (!users.fields.getByName("phone")) {
      users.fields.add(new TextField({ name: "phone", max: 40 }));
    }
    if (!users.fields.getByName("job_title")) {
      users.fields.add(new TextField({ name: "job_title", max: 120 }));
    }

    // Any signed-in staff member can read the directory; only the super
    // administrator can create/modify/delete accounts. Super-admin records
    // are protected from deletion.
    users.listRule = "@request.auth.id != ''";
    users.viewRule = "@request.auth.id != ''";
    users.createRule = "@request.auth.role = 'super_admin'";
    users.updateRule = "@request.auth.role = 'super_admin'";
    users.deleteRule = "@request.auth.role = 'super_admin' && role != 'super_admin'";
    // Super administrator can fully manage other accounts (reset passwords).
    users.manageRule = "@request.auth.role = 'super_admin'";
    // Suspended accounts cannot authenticate.
    users.authRule = "status = 'active'";
    app.save(users);

    // --- activity_logs collection ---
    let logs;
    try {
      logs = app.findCollectionByNameOrId("activity_logs");
    } catch (_) {
      logs = new Collection({
        type: "base",
        name: "activity_logs",
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: "actor",
            type: "relation",
            required: false,
            maxSelect: 1,
            collectionId: users.id,
            cascadeDelete: false,
          },
          { name: "actor_name", type: "text", max: 200 },
          { name: "action", type: "text", required: true, max: 120 },
          { name: "detail", type: "text", max: 500 },
          { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        ],
      });
      app.save(logs);
    }

    // --- seed the protected super administrator ---
    try {
      app.findAuthRecordByEmail("users", "superadmin@runhteccontractors.com");
    } catch (_) {
      const admin = new Record(users);
      admin.setEmail("superadmin@runhteccontractors.com");
      admin.setPassword("RunhtecAdmin2024");
      admin.set("verified", true);
      admin.set("name", "System Administrator");
      admin.set("role", "super_admin");
      admin.set("status", "active");
      admin.set("job_title", "Super Administrator");
      app.save(admin);
    }
  },
  (app) => {
    try {
      const logs = app.findCollectionByNameOrId("activity_logs");
      app.delete(logs);
    } catch (_) {
      /* already gone */
    }
    const users = app.findCollectionByNameOrId("users");
    ["role", "status", "phone", "job_title"].forEach((f) => {
      if (users.fields.getByName(f)) users.fields.removeByName(f);
    });
    users.authRule = "";
    app.save(users);
  },
);

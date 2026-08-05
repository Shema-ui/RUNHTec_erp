/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("company_settings");

    const existing = collection.fields.getByName("signature");
    if (existing) return;

    collection.fields.add(
      new FileField({
        name: "signature",
        maxSelect: 1,
        maxSize: 2097152, // 2 MB
        mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
      })
    );
    app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId("company_settings");
    collection.fields.removeByName("signature");
    app.save(collection);
  }
);

/// <reference path="../pb_data/types.d.ts" />

routerAdd("POST", "/api/website-intake", (e) => {
  const body = e.request?.json?.() || {};
  const payload = body || {};
  const source = String(payload.source || "website").toLowerCase();
  const type = String(payload.type || "contact").toLowerCase();
  const name = String(payload.name || "").trim();
  const email = String(payload.email || "").trim();
  const phone = String(payload.phone || "").trim();
  const company = String(payload.company || "").trim();
  const message = String(payload.message || "").trim();
  const serviceType = String(payload.serviceType || payload.service_type || "").trim();
  const urgency = String(payload.urgency || "").trim();

  if (!name && !email && !message) {
    throw new BadRequestError("Missing submission data");
  }

  const clients = $app.findCollectionByNameOrId("clients");
  const rfqs = $app.findCollectionByNameOrId("rfqs");
  const activities = $app.findCollectionByNameOrId("client_activities");
  const users = $app.findCollectionByNameOrId("users");

  let clientRecord = null;
  if (email) {
    try {
      clientRecord = $app.findFirstRecordByFilter("clients", `email = '${email}'`);
    } catch (_) {}
  }

  if (!clientRecord && company) {
    try {
      clientRecord = $app.findFirstRecordByFilter("clients", `company_name = '${company}'`);
    } catch (_) {}
  }

  if (!clientRecord) {
    const client = new Record(clients);
    client.set("company_name", company || name);
    client.set("trading_name", company || name);
    client.set("status", "lead");
    client.set("industry", "website");
    client.set("city", payload.city || "");
    client.set("country", payload.country || "");
    client.set("website", payload.website || "");
    client.set("potential_value", 0);
    client.set("created", new Date().toISOString());
    $app.save(client);
    clientRecord = client;
  }

  if (email) {
    try {
      const contactCollection = $app.findCollectionByNameOrId("client_contacts");
      const existingContact = $app.findFirstRecordByFilter("client_contacts", `email = '${email}'`);
      if (!existingContact) {
        const contact = new Record(contactCollection);
        contact.set("client", clientRecord.id);
        contact.set("full_name", name || company);
        contact.set("email", email);
        contact.set("mobile", phone);
        contact.set("position", "Website Inquiry");
        contact.set("is_primary", true);
        $app.save(contact);
      }
    } catch (_) {}
  }

  if (type === "quote" || type === "quotation" || payload.request_type === "quote") {
    const rfq = new Record(rfqs);
    rfq.set("name", name || company || "Website request");
    rfq.set("company", company || name);
    rfq.set("email", email);
    rfq.set("phone", phone);
    rfq.set("service_type", serviceType || payload.service || "General inquiry");
    rfq.set("urgency", urgency || payload.urgency || "medium");
    rfq.set("budget", payload.budget || "");
    rfq.set("address", payload.address || "");
    rfq.set("description", message || payload.description || "Website submission");
    rfq.set("status", "new");
    rfq.set("source", source === "website" ? "website" : source);
    rfq.set("request_type", "quote_request");
    rfq.set("request_status", "new");
    rfq.set("client", clientRecord.id);
    $app.save(rfq);
  } else if (type === "service" || type === "request" || payload.request_type === "service") {
    const serviceRfq = new Record(rfqs);
    serviceRfq.set("name", name || company || "Website request");
    serviceRfq.set("company", company || name);
    serviceRfq.set("email", email);
    serviceRfq.set("phone", phone);
    serviceRfq.set("service_type", serviceType || payload.service || "Service request");
    serviceRfq.set("urgency", urgency || payload.urgency || "medium");
    serviceRfq.set("address", payload.address || "");
    serviceRfq.set("description", message || payload.description || "Service request from website");
    serviceRfq.set("status", "new");
    serviceRfq.set("source", source === "website" ? "website" : source);
    serviceRfq.set("request_type", "service_request");
    serviceRfq.set("request_status", "new");
    serviceRfq.set("client", clientRecord.id);
    $app.save(serviceRfq);
  } else {
    const enquiry = new Record(rfqs);
    enquiry.set("name", name || company || "Website enquiry");
    enquiry.set("company", company || name);
    enquiry.set("email", email);
    enquiry.set("phone", phone);
    enquiry.set("service_type", serviceType || payload.service || "General enquiry");
    enquiry.set("description", message || payload.description || "Website enquiry");
    enquiry.set("status", "new");
    enquiry.set("source", source === "website" ? "website" : source);
    enquiry.set("request_type", "contact_enquiry");
    enquiry.set("request_status", "new");
    enquiry.set("client", clientRecord.id);
    $app.save(enquiry);
  }

  const activity = new Record(activities);
  activity.set("client", clientRecord.id);
  activity.set("type", "other");
  activity.set("description", `Website ${type} submitted by ${name || email || company}`);
  activity.set("actor_name", "Website");
  $app.save(activity);

  return e.json(200, {
    success: true,
    message: "Submission received",
    type,
  });
});

// Integration points for CRM, calendar, fuel cards, IoT, analytics
// See AGENT.md Integration Points section

export const integrations = {
  crm: {
    salesforce: false,
    zoho: false,
  },
  calendar: {
    google: false,
    outlook: false,
  },
  fuelCards: {
    vendorApi: false,
  },
  iot: {
    mqtt: false,
    rest: false,
  },
  analytics: {
    segment: false,
    amplitude: false,
    datadog: false,
  },
  // Add actual integration logic as implemented
};

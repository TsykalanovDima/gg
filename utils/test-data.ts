import { randomInt } from 'node:crypto';

export type OrderTestData = ReturnType<typeof createOrderTestData>;

export function createOrderTestData() {
  const now = new Date();
  const shipmentDate = new Date(now);
  shipmentDate.setDate(shipmentDate.getDate() + 1);

  return {
    provider: 'Verizon',
    device: 'Samsung Galaxy S24+',
    deviceVariant: '512GB Onyx Black',
    fullDevice: 'Samsung Galaxy S24+ 512GB Onyx Black',
    accessory: 'Tech21 Evo Check Case for Galaxy S24+',
    location: '100 South Charles Street',
    attentionTo: 'QA Automation',
    attentionPhone: '2025550123',
    additionalInfo: `Playwright QA run ${now.toISOString()}`,
    imei: generateImei(now),
    orderNumber: `PW-${now.getTime()}`,
    trackingNumber: `TRK${now.getTime()}`,
    carrier: 'FedEx',
    priceDigits: '22999',
    // The price input mask turns the typed digits into 2299.90.
    expectedPrice: '2299.90',
    expectedStoredPrice: 'USD;2299.90',
    shipmentDate: formatUsDate(shipmentDate),
    shipmentDateIso: formatIsoDate(shipmentDate),
  };
}

// 13-digit epoch millis + 2 random digits: unique per run, within the 14-17 digit rule.
function generateImei(now: Date): string {
  return `${now.getTime()}${randomInt(10, 100)}`;
}

function formatUsDate(value: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(value);
}

function formatIsoDate(value: Date): string {
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
}

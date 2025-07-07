import { v4 as uuidv4 } from "uuid";

import { type BenchmarkConfig, type CapturedText } from "./types";

const TEXT_TYPES = [
  "alt",
  "backgroundImageUrl",
  "href",
  "imgSrc",
  "innerHTML",
  "innerText",
  "outerHTML",
  "title"
] as const;

const SAMPLE_PRODUCTS = [
  {
    name: "Wireless Bluetooth Headphones",
    price: 89.99,
    rating: 4.5,
    reviews: 1247,
    features: [
      "Noise Cancelling",
      "40hr Battery",
      "Quick Charge",
      "Touch Controls"
    ],
    colors: ["Black", "White", "Blue", "Red"],
    inStock: true
  },
  {
    name: "Smart Fitness Watch",
    price: 199.99,
    rating: 4.3,
    reviews: 892,
    features: [
      "Heart Rate Monitor",
      "GPS",
      "Water Resistant",
      "Sleep Tracking"
    ],
    colors: ["Silver", "Black", "Rose Gold"],
    inStock: true
  },
  {
    name: "Portable Power Bank",
    price: 49.99,
    rating: 4.7,
    reviews: 2156,
    features: ["20000mAh", "Fast Charging", "Multiple Ports", "LED Display"],
    colors: ["Black", "White"],
    inStock: false
  },
  {
    name: "Wireless Gaming Mouse",
    price: 79.99,
    rating: 4.6,
    reviews: 567,
    features: [
      "RGB Lighting",
      "Programmable Buttons",
      "High DPI",
      "Ergonomic Design"
    ],
    colors: ["Black", "White"],
    inStock: true
  },
  {
    name: "Bluetooth Speaker",
    price: 129.99,
    rating: 4.4,
    reviews: 743,
    features: ["360° Sound", "Waterproof", "20hr Battery", "Party Mode"],
    colors: ["Black", "Blue", "Red"],
    inStock: true
  }
];

const SAMPLE_CUSTOMERS = [
  {
    id: "CUST001",
    name: "John Smith",
    email: "john.smith@email.com",
    tier: "Premium"
  },
  {
    id: "CUST002",
    name: "Sarah Johnson",
    email: "sarah.j@email.com",
    tier: "Gold"
  },
  {
    id: "CUST003",
    name: "Mike Davis",
    email: "mike.davis@email.com",
    tier: "Silver"
  },
  {
    id: "CUST004",
    name: "Lisa Wilson",
    email: "lisa.w@email.com",
    tier: "Premium"
  },
  {
    id: "CUST005",
    name: "David Brown",
    email: "david.brown@email.com",
    tier: "Gold"
  }
];

const SAMPLE_ORDERS = [
  { orderId: "ORD001", status: "Shipped", total: 299.97, items: 3 },
  { orderId: "ORD002", status: "Delivered", total: 149.98, items: 2 },
  { orderId: "ORD003", status: "Processing", total: 89.99, items: 1 },
  { orderId: "ORD004", status: "Shipped", total: 459.96, items: 4 },
  { orderId: "ORD005", status: "Cancelled", total: 79.99, items: 1 }
];

export const generateCapturedText = (config: BenchmarkConfig): CapturedText => {
  const text = generateLargeJsonText();
  const type = TEXT_TYPES[Math.floor(Math.random() * TEXT_TYPES.length)];

  return {
    taskId: uuidv4(),
    stepIndex: Math.floor(Math.random() * 10),
    name: `field_${Math.floor(Math.random() * 1000)}`,
    text,
    targetNotFound: Math.random() < 0.1, // 10% chance of target not found
    detectedChange: Math.random() < 0.2, // 20% chance of detected change
    comparedToTextId: Math.random() < 0.2 ? uuidv4() : null,
    comparedToRecording: Math.random() < 0.3, // 30% chance of compared to recording
    type,
    listId: Math.random() < 0.3 ? uuidv4() : null,
    listItemIndex: Math.random() < 0.3 ? Math.floor(Math.random() * 100) : null,
    listPageNumber:
      Math.random() < 0.2 ? Math.floor(Math.random() * 10) + 1 : null,
    listPageItemIndex:
      Math.random() < 0.2 ? Math.floor(Math.random() * 50) : null,
    attachmentS3Key: Math.random() < 0.1 ? `attachments/${uuidv4()}.txt` : null,
    attachmentMimeType: Math.random() < 0.1 ? "text/plain" : null
  };
};

export const generateBatch = (
  config: BenchmarkConfig,
  batchSize: number
): Array<CapturedText> => {
  const batch: Array<CapturedText> = [];
  for (let i = 0; i < batchSize; i++) {
    batch.push(generateCapturedText(config));
  }
  return batch;
};

export const calculateDataSizeMB = (records: Array<CapturedText>): number => {
  const jsonString = JSON.stringify(records);
  const bytes = Buffer.byteLength(jsonString, "utf8");
  return bytes / (1024 * 1024); // Convert to MB
};

function generateLargeJsonText(): string {
  const targetSizeKB = Math.floor(Math.random() * 51) + 50; // 50-100 KB
  const targetSizeBytes = targetSizeKB * 1024;

  const baseData = {
    timestamp: new Date().toISOString(),
    sessionId: uuidv4(),
    pageUrl: `https://example.com/products/${Math.floor(Math.random() * 1000)}`,
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    viewport: { width: 1920, height: 1080 },
    products: SAMPLE_PRODUCTS,
    customers: SAMPLE_CUSTOMERS,
    orders: SAMPLE_ORDERS,
    analytics: {
      pageLoadTime: Math.random() * 3000 + 500,
      timeOnPage: Math.random() * 300 + 30,
      scrollDepth: Math.random() * 100,
      clicks: Math.floor(Math.random() * 20),
      formInteractions: Math.floor(Math.random() * 5)
    },
    metadata: {
      language: "en-US",
      timezone: "America/New_York",
      screenResolution: "1920x1080",
      colorDepth: 24,
      pixelRatio: 2
    }
  };

  let jsonText = JSON.stringify(baseData, null, 2);
  let currentSize = Buffer.byteLength(jsonText, "utf8");

  // Add more data until we reach target size
  while (currentSize < targetSizeBytes) {
    const additionalData = {
      [`extraField_${Math.floor(Math.random() * 10000)}`]: {
        id: uuidv4(),
        value: Math.random() * 1000,
        description: `This is a detailed description for field ${Math.floor(
          Math.random() * 1000
        )} with additional context and information that helps to increase the overall size of the JSON data structure.`,
        tags: Array.from(
          { length: Math.floor(Math.random() * 10) + 1 },
          () => `tag_${Math.floor(Math.random() * 100)}`
        ),
        nested: {
          level1: {
            level2: {
              level3: {
                finalValue: `Deep nested value ${Math.floor(
                  Math.random() * 1000
                )}`,
                timestamp: new Date().toISOString(),
                metadata: {
                  source: "generated",
                  version: "1.0.0",
                  checksum: uuidv4().replace(/-/g, "")
                }
              }
            }
          }
        },
        arrayData: Array.from(
          { length: Math.floor(Math.random() * 20) + 5 },
          () => ({
            itemId: uuidv4(),
            score: Math.random() * 100,
            category: `category_${Math.floor(Math.random() * 50)}`,
            attributes: {
              color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
              size: Math.floor(Math.random() * 100),
              weight: Math.random() * 10,
              active: Math.random() > 0.5
            }
          })
        )
      }
    };

    const additionalJson = JSON.stringify(additionalData, null, 2);
    const additionalSize = Buffer.byteLength(additionalJson, "utf8");

    // Check if adding this would exceed target size
    if (currentSize + additionalSize > targetSizeBytes) {
      break;
    }

    // Merge the additional data
    const currentData = JSON.parse(jsonText);
    Object.assign(currentData, additionalData);
    jsonText = JSON.stringify(currentData, null, 2);
    currentSize = Buffer.byteLength(jsonText, "utf8");
  }

  return jsonText;
}

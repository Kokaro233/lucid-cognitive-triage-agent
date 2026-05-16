import { MongoClient, type Db } from "mongodb";
import type { PatternRecord } from "@/lib/types";

let clientPromise: Promise<MongoClient> | null = null;

export function hasMongoConfig() {
  return Boolean(process.env.MONGODB_URI);
}

async function getClient() {
  if (!process.env.MONGODB_URI) {
    throw new Error("Missing MONGODB_URI.");
  }
  if (!clientPromise) {
    const client = new MongoClient(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 2500,
      connectTimeoutMS: 2500
    });
    clientPromise = client.connect();
  }
  return clientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getClient();
  return client.db(process.env.MONGODB_DB || "lucid");
}

export async function searchPatternsMongo(chain: string[], scenario?: string): Promise<PatternRecord[]> {
  const db = await getDb();
  const patterns = db.collection<PatternRecord>("patterns");
  const cases = db.collection<PatternRecord>("cases");
  const query = {
    $or: [
      { manipulation_chain: { $in: chain } },
      { scenario: { $regex: scenario || chain.join("|") || "scam", $options: "i" } }
    ]
  };
  const [curated, saved] = await Promise.all([
    patterns.find(query).sort({ severity: -1 }).limit(3).toArray(),
    cases.find(query).sort({ severity: -1 }).limit(3).toArray()
  ]);
  return [...curated, ...saved]
    .sort((a, b) => (b.severity ?? 0) - (a.severity ?? 0))
    .slice(0, 3);
}

export async function savePatternMongo(pattern: PatternRecord) {
  const db = await getDb();
  const cases = db.collection("cases");
  const saved = {
    ...pattern,
    saved_at: new Date().toISOString(),
    storage_policy: "anonymized_pattern_only"
  };
  await cases.insertOne(saved);
  return saved;
}

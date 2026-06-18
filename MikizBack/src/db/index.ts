import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const ssl = process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false;
const client = postgres(process.env.DATABASE_URL!, { max: 10, ssl });

export const db = drizzle(client, { schema });

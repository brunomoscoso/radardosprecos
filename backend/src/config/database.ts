import sqlite3 from "sqlite3";
import { open } from "sqlite";
import path from "path";

export async function connectDB() {
    const dbPath = path.resolve(__dirname, "../../database/database.sqlite");
    console.log("Usando banco em:", dbPath);

    return open({
        filename: dbPath,
        driver: sqlite3.Database,
    });
}
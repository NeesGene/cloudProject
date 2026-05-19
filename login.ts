import "dotenv/config";
import bcrypt from "bcryptjs";
import { MongoClient, ObjectId } from "mongodb";
import { account } from "./interfaces";

const uri = process.env.MONGODB_URI;
if (!uri) {
    throw new Error("MONGODB_URI is not set.");
}

const client = new MongoClient(uri);
const db = client.db("Rivals-Track");

export const userCollection = db.collection<account>("Accounts");

const ROLES = ["ADMIN", "USER"];

function generateRandomSalt(): string {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let salt = "";
    for (let i = 0; i < 10; i++) {
        salt += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return salt;
}


export async function createAccount(data: Omit<account, "salt">) {
    const salt = generateRandomSalt();
    // Use the salt + password combination
    const hashedPassword = await bcrypt.hash(data.password + salt, 10);

    const newAccount: account = {
        username: data.username,
        email: data.email,
        password: hashedPassword,
        salt: salt,
        role: ROLES.includes(data.role) ? data.role : "USER"
    };

    return await userCollection.insertOne(newAccount);
}


export async function login(email: string, passwordAttempt: string): Promise<account | null> {
    const user = await userCollection.findOne({ email });
    if (!user) return null;

    const isMatch = await bcrypt.compare(passwordAttempt + user.salt, user.password);
    return isMatch ? user : null;
}


export async function updateAccount(id: string, updates: Partial<account>) {
    const updatePayload: any = { ...updates };

    if (updates.password) {
        const newSalt = generateRandomSalt();
        updatePayload.salt = newSalt;
        updatePayload.password = await bcrypt.hash(updates.password + newSalt, 10);
    }

    return await userCollection.updateOne(
        { _id: new ObjectId(id) as any },
        { $set: updatePayload }
    );
}

export async function deleteAccount(id: string) {
    return await userCollection.deleteOne({ _id: new ObjectId(id) as any });
}

export async function createInitialUser() {
    if (await userCollection.countDocuments() > 0) return;

    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;

    if (!email || !password) {
        throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in environment");
    }

    await createAccount({
        username: "Admin",
        email: email,
        password: password,
        role: "ADMIN"
    });
}

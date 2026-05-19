import { ObjectId } from 'mongodb'; // Optional: if you want strict typing

export interface account {
    _id?: ObjectId | string; // The '?' makes it optional for when you're creating a new account
    username: string;
    email: string;
    password: string;
    salt: string;
    role: string;
    favoriteHeroes?: string[];
}

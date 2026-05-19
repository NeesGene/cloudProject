import express from 'express';
import { db } from '../controllers/databaseController'; // Make sure the path is correct
import axios from 'axios'

const router = express.Router();

const BASE_URL = "https://marvelrivalsapi.com/api/v1";

// GET /api/player/:username

import express, { Express } from "express";
import dotenv from "dotenv";
import path from "path";
import authRouter from './routes/authRouter';
import heroesRouter from './routes/heroes';
import newsRouter from './routes/news';
import statsRouter from './routes/stats';
import { sessionStore, syncHeroes, smartSyncOnStartup, syncGameUpdates } from './controllers/databaseController';
import session from 'express-session';
import cron from 'node-cron'
dotenv.config();

// all links to API (refer to On the subject of API's to import properly and only load once!)
// (will be reused countless times, hence loading the data once will speedup our load times!)
// (async ofc)
// (idk interface yet, handle it.)
const API_KEY = process.env.RIVALS_API_KEY;
const BASE_URL = "https://marvelrivalsapi.com/api/v1";
const IMG_BASE = "https://marvelrivalsapi.com";
const SKIN_BASE = "https://marvelrivalsapi.com/rivals";

const app: Express = express();
const key: string = process.env.SALT || "";
const sessionSecret: string = key;
app.use(session({
    store: sessionStore,
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Set to true if using HTTPS
}));

app.use((req, res, next) => {
    res.locals.user = (req.session as any).user || null;
    next();
});

app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.use(authRouter);
app.use(heroesRouter);
app.use(newsRouter);
app.use(statsRouter);
app.set("views", path.join(__dirname, "views"));

app.set("port", process.env.PORT || 3001);

app.get("/", (req, res) => {
  smartSyncOnStartup();
  res.render("index", {
    title: "Team Rivals",
  });
});


app.listen(app.get("port"), () => {
  console.log("Server started on http://localhost:" + app.get("port"));
});


cron.schedule('0 * * * *', () => {
    syncHeroes();
    syncGameUpdates(); // Refresh news every hour
});

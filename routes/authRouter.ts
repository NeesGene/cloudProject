import express from 'express';
import { login, createAccount, getAccountById, getAllAccounts, updateAccount, deleteAccount } from '../controllers/databaseController';

// This forces TypeScript to merge the types in this specific file
declare module 'express-session' {
    interface SessionData {
        user: {
            id: string;
            username: string;
            email: string;
            role: string;
        };
    }
}
const router = express.Router();

function requireLogin(req: express.Request, res: express.Response, next: express.NextFunction) {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    next();
}

async function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    const account = await getAccountById(req.session.user.id);

    if (!account || account.role !== 'ADMIN') {
        return res.status(403).render('login', { error: 'Admin access required.' });
    }

    req.session.user.role = account.role;
    next();
}

async function renderAdminAccounts(
    res: express.Response,
    message: { error?: string | null; success?: string | null } = {}
) {
    const accounts = await getAllAccounts();

    res.render('adminAccounts', {
        accounts,
        currentPage: 'admin',
        error: message.error || null,
        success: message.success || null
    });
}

// GET: Render the login page
router.get('/login', async (req, res) => {
    if (req.session.user) {
        return res.redirect('/landing');
    }

    res.render('login', { error: null });
});

router.get('/landing',requireLogin, (req, res) => {
    res.render('landing', {currentPage: "landing"})
});

router.get('/account/edit', requireLogin, async (req, res) => {
    const sessionUser = req.session.user;
    if (!sessionUser) return res.redirect('/login');

    const account = await getAccountById(sessionUser.id);

    if (!account) {
        return logout(req, res);
    }

    res.render('accountEdit', {
        account,
        currentPage: 'account',
        error: null,
        success: null
    });
});

router.post('/account/edit', requireLogin, async (req, res) => {
    const sessionUser = req.session.user;
    if (!sessionUser) return res.redirect('/login');

    const { username, email } = req.body;
    const trimmedUsername = typeof username === 'string' ? username.trim() : '';
    const trimmedEmail = typeof email === 'string' ? email.trim() : '';

    if (!trimmedUsername || !trimmedEmail) {
        const account = await getAccountById(sessionUser.id);

        return res.render('accountEdit', {
            account,
            currentPage: 'account',
            error: 'Username and email are required.',
            success: null
        });
    }

    await updateAccount(sessionUser.id, {
        username: trimmedUsername,
        email: trimmedEmail
    });

    sessionUser.username = trimmedUsername;
    sessionUser.email = trimmedEmail;

    req.session.save(async (err) => {
        const account = await getAccountById(sessionUser.id);

        res.render('accountEdit', {
            account,
            currentPage: 'account',
            error: err ? 'Your profile was updated, but the session could not be refreshed.' : null,
            success: err ? null : 'Profile updated.'
        });
    });
});

router.post('/account/password', requireLogin, async (req, res) => {
    const sessionUser = req.session.user;
    if (!sessionUser) return res.redirect('/login');

    const { password, confirmPassword } = req.body;
    const account = await getAccountById(sessionUser.id);

    if (!password || password !== confirmPassword) {
        return res.render('accountEdit', {
            account,
            currentPage: 'account',
            error: 'Passwords must match.',
            success: null
        });
    }

    await updateAccount(sessionUser.id, { password });

    res.render('accountEdit', {
        account,
        currentPage: 'account',
        error: null,
        success: 'Password reset.'
    });
});

router.post('/account/delete', requireLogin, async (req, res) => {
    const sessionUser = req.session.user;
    if (!sessionUser) return res.redirect('/login');

    await deleteAccount(sessionUser.id);
    logout(req, res);
});

router.get('/admin/accounts', requireAdmin, async (_req, res) => {
    await renderAdminAccounts(res);
});

router.post('/admin/accounts/:id', requireAdmin, async (req, res) => {
    const id = String(req.params.id);
    const { username, email, password, role } = req.body;
    const trimmedUsername = typeof username === 'string' ? username.trim() : '';
    const trimmedEmail = typeof email === 'string' ? email.trim() : '';
    const trimmedPassword = typeof password === 'string' ? password.trim() : '';
    const normalizedRole = role === 'ADMIN' ? 'ADMIN' : 'USER';

    if (!trimmedUsername || !trimmedEmail) {
        return renderAdminAccounts(res, { error: 'Username and email are required.' });
    }

    const updates: { username: string; email: string; role: string; password?: string } = {
        username: trimmedUsername,
        email: trimmedEmail,
        role: normalizedRole
    };

    if (trimmedPassword) {
        updates.password = trimmedPassword;
    }

    await updateAccount(id, updates);

    if (req.session.user && req.session.user.id === id) {
        req.session.user.username = trimmedUsername;
        req.session.user.email = trimmedEmail;
        req.session.user.role = normalizedRole;
    }

    await renderAdminAccounts(res, { success: 'Account updated.' });
});

router.post('/admin/accounts/:id/delete', requireAdmin, async (req, res) => {
    const id = String(req.params.id);
    const sessionUser = req.session.user;

    if (sessionUser && sessionUser.id === id) {
        await deleteAccount(id);
        return logout(req, res);
    }

    await deleteAccount(id);
    await renderAdminAccounts(res, { success: 'Account deleted.' });
});

// POST: Handle both Login and Registration
// POST: Handle both Login and Registration
router.post('/auth', async (req, res) => {
    const { mode, email, password, username } = req.body;

    try {
        if (mode === 'register') {
            await createAccount({ username, email, password, role: "USER" });
            return res.redirect('/login?msg=AccountCreated');
        } else {
            const user = await login(email, password);
            if (user) {
                req.session.user = {
                    id: user._id!.toString(), 
                    username: user.username,
                    email: user.email,
                    role: user.role
                };
                
                // IMPORTANT: Save the session before redirecting 
                // to ensure the data is written before the next page loads
                req.session.save((err) => {
                    if (err) console.error("Session save error:", err);
                    return res.redirect('/landing');
                });
            } else {
                return res.render('login', { error: "Invalid email or password." });
            }
        }
    } catch (err) {
        console.error(err);
        res.render('login', { error: "An error occurred." });
    }
});

function logout(req: express.Request, res: express.Response) {
    req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.redirect('/');
    });
}

// Add a Logout route to clear the session
router.get('/logout', logout);
router.get('/auth/logout', logout);

export default router;

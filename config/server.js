// server.js
import express from 'express';
import session from 'express-session';
import flash from 'connect-flash';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config'; 
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';

// --- INITIAL SETUP ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;
const saltRounds = 10;

// Database Connection Pool
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test DB Connection
pool.getConnection()
    .then(connection => {
        console.log('Connected to MySQL database!');
        connection.release();
    })
    .catch(err => {
        console.error(' Failed to connect to database:', err.message);
        process.exit(1);
    });

// EJS and Middleware Setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public')); // Create a 'public' folder for CSS/JS if needed

// To keep users logged in between page requests
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));
app.use(flash());

// Res.locals (Available to all EJS templates)
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    next();
});

// --- AUTHENTICATION MIDDLEWARE ---

const isAuthenticated = (req, res, next) => {
    if (req.session.user) return next();
    req.flash('error', 'Please log in to access this page.');
    res.redirect('/login');
};

const isRecruiter = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'recruiter') return next();
    req.flash('error', 'Access denied. Recruiter privileges required.');
    res.redirect('/');
};

const isSeeker = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'seeker') return next();
    req.flash('error', 'Access denied. Job Seeker privileges required.');
    res.redirect('/');
};

// --- AUTH ROUTES ---

// GET /register
app.get('/register', (req, res) => {
    res.render('register.ejs', { pageTitle: 'Register' });
});

// POST /register
app.post('/register', async (req, res) => {
    const { name, email, password, role } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        await pool.query(
            'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
            [name, email, hashedPassword, role]
        );
        req.flash('success', `Registration successful! Please log in as a ${role}.`);
        res.redirect('/login');
    } catch (error) {
        let message = (error.code === 'ER_DUP_ENTRY') ? 'Email already in use.' : 'An error occurred during registration.';
        req.flash('error', message);
        res.redirect('/register');
    }
});

// GET /login
app.get('/login', (req, res) => {
    res.render('login.ejs', { pageTitle: 'Login' });
});

// POST /login
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        const user = rows[0];

        if (!user || !(await bcrypt.compare(password, user.password))) {
            req.flash('error', 'Invalid email or password.');
            return res.redirect('/login');
        }
        
        req.session.user = { userId: user.userId, name: user.name, email: user.email, role: user.role };
        req.flash('success', `Welcome back, ${user.name}!`);

        const redirectUrl = user.role === 'recruiter' ? '/recruiter/dashboard' : '/signedIn';
        res.redirect(redirectUrl);

    } catch (error) {
        console.error('Login error:', error);
        req.flash('error', 'An error occurred during login.');
        res.redirect('/login');
    }
});

// POST /logout
app.post('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

// --- JOB SEEKER ROUTES ---

// GET /signedIn - Signed-in homepage for seekers
app.get('/signedIn', isAuthenticated, isSeeker, async (req, res) => {
    const searchTerm = req.query.term || '';
    let q = `
        SELECT jobId, title, company, location, salary, skills
        FROM jobs
        WHERE title LIKE ? OR company LIKE ? OR location LIKE ?
        ORDER BY postedAt DESC
    `;
    const searchValue = `%${searchTerm}%`;

    try {
        const [jobs] = await pool.query(q, [searchValue, searchValue, searchValue]);
        res.render("signedIn.ejs", { jobs: jobs, searchTerm: searchTerm });
    } catch (err) {
        console.error("Error fetching jobs:", err);
        req.flash('error', 'Could not load job listings.');
        res.render("signedIn.ejs", { jobs: [], searchTerm: "" });
    }
});

// GET / or /search - Homepage (View All/Filter Jobs)
app.get(['/', '/search'], async (req, res) => {
    const searchTerm = req.query.term || '';
    let q = `
        SELECT jobId, title, company, location, salary, skills
        FROM jobs
        WHERE title LIKE ? OR company LIKE ? OR location LIKE ?
        ORDER BY postedAt DESC
    `;
    const searchValue = `%${searchTerm}%`;

    try {
        const [jobs] = await pool.query(q, [searchValue, searchValue, searchValue]);
        res.render("index.ejs", { jobs: jobs, searchTerm: searchTerm });
    } catch (err) {
        console.error("Error fetching jobs:", err);
        req.flash('error', 'Could not load job listings.');
        res.render("index.ejs", { jobs: [], searchTerm: "" });
    }
});

// GET /job/:id - View Single Job Details
app.get('/job/:id', async (req, res) => {
    const jobId = req.params.id;
    const currentUserId = req.session.user ? req.session.user.userId : null;
    let hasApplied = false;

    try {
        const [jobs] = await pool.query('SELECT * FROM jobs WHERE jobId = ?', [jobId]);
        const jobDetails = jobs[0];

        if (!jobDetails) {
            req.flash('error', 'Job not found.');
            return res.redirect('/');
        }

        if (currentUserId && req.session.user.role === 'seeker') {
            const [applications] = await pool.query(
                'SELECT 1 FROM applications WHERE jobId = ? AND userId = ?', 
                [jobId, currentUserId]
            );
            hasApplied = applications.length > 0;
        }

        res.render("jobDetails.ejs", { 
            job: jobDetails, 
            hasApplied: hasApplied,
            isRecruiterView: (req.session.user && req.session.user.role === 'recruiter')
        });

    } catch (err) {
        console.error("Error fetching job details:", err);
        req.flash('error', 'Error loading job details.');
        res.redirect('/');
    }
});

// POST /apply/:jobId - Apply to Job
app.post('/apply/:jobId', isAuthenticated, isSeeker, async (req, res) => {
    const jobId = req.params.jobId;
    const userId = req.session.user.userId;

    try {
        const q = 'INSERT INTO applications (jobId, userId) VALUES (?, ?)';
        await pool.query(q, [jobId, userId]);

        req.flash('success', 'Application submitted successfully! ✅');
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            req.flash('error', 'You have already applied for this job.');
        } else {
            console.error("Error applying for job:", err);
            req.flash('error', 'An error occurred while submitting your application.');
        }
    }
    res.redirect(`/job/${jobId}`);
});

// --- RECRUITER ROUTES (CRUD) ---

// GET /recruiter/dashboard
app.get('/recruiter/dashboard', isAuthenticated, isRecruiter, async (req, res) => {
    const recruiterId = req.session.user.userId;
    const q = 'SELECT * FROM jobs WHERE recruiterId = ? ORDER BY postedAt DESC';

    try {
        const [jobs] = await pool.query(q, [recruiterId]);
        res.render("recruiter/dashboard.ejs", { jobs: jobs });
    } catch (err) {
        console.error("Error fetching recruiter jobs:", err);
        req.flash('error', 'Could not load your dashboard.');
        res.redirect('/');
    }
});

// GET /recruiter/post-job - Show form to create new job
app.get('/recruiter/post-job', isAuthenticated, isRecruiter, (req, res) => {
    res.render("recruiter/postJob.ejs", { job: null, action: '/recruiter/post-job' });
});

// POST /recruiter/post-job - Create new job
app.post('/recruiter/post-job', isAuthenticated, isRecruiter, async (req, res) => {
    const { title, description, company, location, salary, experience_required, skills } = req.body;
    const recruiterId = req.session.user.userId;

    const q = `
        INSERT INTO jobs (title, description, company, location, salary, experience_required, skills, recruiterId)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [title, description, company, location, salary, experience_required, skills, recruiterId];

    try {
        await pool.query(q, values);
        req.flash('success', 'New job posted successfully! 🎉');
        res.redirect('/recruiter/dashboard');
    } catch (err) {
        console.error("Error posting new job:", err);
        req.flash('error', 'Failed to post job. Please check your data.');
        res.redirect('/recruiter/post-job');
    }
});                 

// GET /recruiter/edit-job/:id - Show form to edit existing job
// app.get('/recruiter/edit-job/:id', isAuthenticated, isRecruiter, async (req, res) => {
//     const jobId = req.params.id;
//     const recruiterId = req.session.user.userId;

//     try {
//         const [jobs] = await pool.query('SELECT * FROM jobs WHERE jobId = ? AND recruiterId = ?', [jobId, recruiterId]);
//         const job = jobs[0];

//         if (!job) {
//             req.flash('error', 'Job not found or you do not have permission to edit it.');
//             return res.redirect('/recruiter/dashboard');
//         }
//     } catch (err) {
//         console.error("Error fetching job for edit:", err);
//         req.flash('error', 'Error loading job details for editing.');
//         res.redirect('/recruiter/dashboard');
//     }
// });

// POST /recruiter/edit-job/:id (Update existing job)
app.post('/recruiter/edit-job/:id', isAuthenticated, isRecruiter, async (req, res) => {
    const jobId = req.params.id;
    const recruiterId = req.session.user.userId;
    const { title, description, company, location, salary, experience_required, skills } = req.body;

    const q = `
        UPDATE jobs 
        SET title=?, description=?, company=?, location=?, salary=?, experience_required=?, skills=?
        WHERE jobId = ? AND recruiterId = ?
    `;
    const values = [title, description, company, location, salary, experience_required, skills, jobId, recruiterId];

    try {
        const [result] = await pool.query(q, values);

        if (result.affectedRows === 0) {
            req.flash('error', 'Job not found or you do not have permission to edit it.');
            return res.redirect('/recruiter/dashboard');
        }

        req.flash('success', `Job "${title}" updated successfully! ✏️`);
        res.redirect('/recruiter/dashboard');
    } catch (err) {
        console.error("Error updating job:", err);
        req.flash('error', 'Failed to update job.');
        res.redirect(`/recruiter/edit-job/${jobId}`);
    }
});

// POST /recruiter/delete-job/:id
app.post('/recruiter/delete-job/:id', isAuthenticated, isRecruiter, async (req, res) => {
    const jobId = req.params.id;
    const recruiterId = req.session.user.userId;

    try {
        const [result] = await pool.query('DELETE FROM jobs WHERE jobId = ? AND recruiterId = ?', [jobId, recruiterId]);

        if (result.affectedRows === 0) {
            req.flash('error', 'Job not found or you do not have permission to delete it.');
        } else {
            req.flash('success', 'Job deleted successfully! 🗑️');
        }
        res.redirect('/recruiter/dashboard');

    } catch (err) {
        console.error("Error deleting job:", err);
        req.flash('error', 'Failed to delete job.');
        res.redirect('/recruiter/dashboard');
    }
});


// --- SERVER START & 404 ---

// 404 Handler
app.use((req, res) => {
    res.status(404).render('404.ejs', { pageTitle: 'Page Not Found' });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
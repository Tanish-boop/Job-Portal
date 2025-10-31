# 💼 Job Portal

A full-stack **Job Portal web application** built using **Node.js**, **Express**, **MySQL**, and **EJS**.  
It allows **Job Seekers** to register, browse, and apply for jobs, while **Recruiters** can post and manage job listings.

---

## 🚀 Features

### 👩‍💼 For Job Seekers:
- Register and log in securely.
- View and search available jobs.
- Apply for jobs (only once per job).

### 🧑‍💻 For Recruiters:
- Register as a recruiter.
- Post new job openings.
- View all applicants for their job postings.
- Delete or edit job posts.

### 🔒 Security:
- Passwords are hashed using **bcrypt**.
- Role-based access control (recruiter/seeker).
- Flash messages for feedback (success/error).
- Session-based authentication.

---

## 🧰 Tech Stack

| Category | Technology |
|-----------|-------------|
| Backend | Node.js, Express.js |
| Database | MySQL |
| Frontend | EJS (Embedded JavaScript Templates), Bootstrap 5 |
| Authentication | express-session, bcrypt |
| Flash Messages | connect-flash |
| Environment Variables | dotenv |

---

## ⚙️ Prerequisites

Make sure you have these installed before running the project:

1. **Node.js** (v18 or above) → [Download here](https://nodejs.org/)
2. **MySQL Server** → [Download here](https://dev.mysql.com/downloads/)
3. **npm** (comes with Node.js)
4. **Git** → [Download here](https://git-scm.com/)
5. A code editor (recommended: **VS Code**)

---

## 📦 Installation Steps

1️⃣ Clone the repository
```bash
git clone https://github.com/Tanish-boop/Job-Portal.git
cd Job-Portal

2️⃣ Install dependencies
npm install

3️⃣ Create the MySQL Database
CREATE DATABASE job_portal;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(100) UNIQUE,
    password VARCHAR(255),
    role ENUM('recruiter', 'seeker'),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE jobs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(100),
    description TEXT,
    company VARCHAR(100),
    location VARCHAR(100),
    posted_by INT,
    FOREIGN KEY (posted_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE applications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    job_id INT,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

4️⃣ Configure Environment Variables
Create a .env file in the root folder and add:
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=job_portal
PORT=3000
SESSION_SECRET=yourSecretKey

5️⃣ Run the application
node app.js

Then open your browser and go to:
👉 http://localhost:3000

📁 Project Structure
Job-Portal/
│
├── app.js                # Main server file
├── package.json          # Dependencies and scripts
├── /views                # EJS templates (UI)
├── /public               # CSS, JS, and Bootstrap files
├── /routes               # Express route files
├── /controllers          # Business logic
├── /models               # Database models
└── .env                  # Environment variables


🧑‍🏫 Author
👤 Tanish Thakare
📧 tanish.thakare2005@gmail.com

⭐ Show Your Support
If you like this project, please ⭐ the repository and share it with others!



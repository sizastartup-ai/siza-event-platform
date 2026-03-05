const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from the current directory
app.use(express.static(path.join(__dirname)));

// --- API Endpoints ---

// Get all venues, optionally filter by location and guests
app.get('/api/venues', (req, res) => {
    let query = "SELECT * FROM venues";
    const params = [];

    const conditions = [];
    if (req.query.location) {
        conditions.push("location LIKE ?");
        params.push(`%${req.query.location}%`);
    }
    if (req.query.guests) {
        conditions.push("guests >= ?");
        params.push(req.query.guests);
    }
    if (req.query.owner_id) {
        conditions.push("owner_id = ?");
        params.push(req.query.owner_id);
    }

    if (conditions.length > 0) {
        query += " WHERE " + conditions.join(" AND ");
    }

    db.all(query, params, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ venues: rows });
    });
});

// Get venue by ID with owner profile
app.get('/api/venues/:id', (req, res) => {
    const query = `
        SELECT v.*, u.name as owner_name, u.profile_image as owner_image 
        FROM venues v 
        LEFT JOIN users u ON v.owner_id = u.id 
        WHERE v.id = ?
    `;
    db.get(query, [req.params.id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            res.status(404).json({ error: "Venue not found" });
            return;
        }
        res.json({ venue: row });
    });
});

// Create a new venue
app.post('/api/venues', (req, res) => {
    const { owner_id, title, location, type, guests, price, rating, image, amenities, description } = req.body;

    // Fallbacks just in case
    const safeTitle = title || "New Venue";
    const safeGuests = guests || 50;
    const safePrice = price || 0;

    // Safely handle image serialization
    let finalImage = image;
    if (image && typeof image !== 'string') {
        finalImage = JSON.stringify(image);
    }

    console.log('[POST /api/venues] image type:', typeof finalImage, '| is array:', Array.isArray(image), '| finalImage length:', (finalImage || '').length);
    if (typeof finalImage === 'string' && finalImage.length < 200) console.log('[POST /api/venues] finalImage preview:', finalImage);

    db.run(
        "INSERT INTO venues (owner_id, title, location, type, guests, price, rating, reviews, image, amenities, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [owner_id || 1, safeTitle, location, type, safeGuests, safePrice, rating || 0.0, 0, finalImage, JSON.stringify(amenities || []), description || ""],
        function (err) {
            if (err) {
                console.error("Database error creating venue:", err.message);
                res.status(500).json({ error: err.message });
                return;
            }
            console.log("Venue created with ID:", this.lastID);
            res.status(201).json({ message: "Venue created", id: this.lastID });
        }
    );
});

// Delete a venue by ID
app.delete('/api/venues/:id', (req, res) => {
    db.run("DELETE FROM venues WHERE id = ?", [req.params.id], function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: "Venue deleted" });
    });
});

// Update venue unavailable dates
app.put('/api/venues/:id/availability', (req, res) => {
    const { unavailable_dates } = req.body;
    console.log(`[Availability Update] Venue ID: ${req.params.id}`);
    console.log(`[Availability Update] Dates received:`, unavailable_dates);

    const finalDates = JSON.stringify(unavailable_dates || []);

    db.run(
        "UPDATE venues SET unavailable_dates = ? WHERE id = ?",
        [finalDates, req.params.id],
        function (err) {
            if (err) {
                console.error(`[Availability Update] Error:`, err.message);
                res.status(500).json({ error: err.message });
                return;
            }
            console.log(`[Availability Update] Success for Venue ${req.params.id}`);
            res.json({ message: "Availability updated" });
        }
    );
});

// Update a venue by ID
app.put('/api/venues/:id', (req, res) => {
    const { title, location, type, guests, price, image, amenities, unavailable_dates, description } = req.body;

    // Safely handle image serialization
    let finalImage = image;
    if (image && typeof image !== 'string') {
        finalImage = JSON.stringify(image);
    }

    console.log('[PUT /api/venues/:id] image type:', typeof finalImage, '| is array:', Array.isArray(image), '| finalImage length:', (finalImage || '').length);
    if (typeof finalImage === 'string' && finalImage.length < 200) console.log('[PUT /api/venues/:id] finalImage preview:', finalImage);

    db.run(
        "UPDATE venues SET title = ?, location = ?, type = ?, guests = ?, price = ?, image = ?, amenities = ?, unavailable_dates = ?, description = ? WHERE id = ?",
        [title, location, type, guests, price, finalImage, JSON.stringify(amenities || []), JSON.stringify(unavailable_dates || []), description, req.params.id],
        function (err) {
            if (err) {
                console.error(`Database error updating venue ${req.params.id}:`, err.message);
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ message: "Venue updated" });
        }
    );
});

// Increment venue views
app.post('/api/venues/:id/view', (req, res) => {
    db.run("UPDATE venues SET views = views + 1 WHERE id = ?", [req.params.id], function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: "View recorded" });
    });
});

// Auth: Login
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!user) {
            res.status(401).json({ error: "Invalid email or password" });
            return;
        }

        const match = await bcrypt.compare(password, user.password_hash);
        if (match) {
            res.json({ message: "Login successful", user: { id: user.id, name: user.name, email: user.email, role: user.role } });
        } else {
            res.status(401).json({ error: "Invalid email or password" });
        }
    });
});

// Auth: Register
app.post('/api/auth/register', async (req, res) => {
    const { name, email, password, role } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const userRole = role === 'owner' ? 'owner' : 'user';

        db.run("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
            [name, email, hashedPassword, userRole],
            function (err) {
                if (err) {
                    res.status(400).json({ error: "Email already exists or error creating user." });
                    return;
                }
                res.status(201).json({
                    message: "User created successfully",
                    user: { id: this.lastID, name: name, email: email, role: userRole }
                });
            });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// Get User Profile
app.get('/api/users/:id', (req, res) => {
    db.get("SELECT id, name, email, role, profile_image FROM users WHERE id = ?", [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: "User not found" });
        res.json({ user: row });
    });
});

// Update User Profile
app.put('/api/users/:id/profile', (req, res) => {
    const { name, email, phone, profile_image } = req.body;

    let query = "UPDATE users SET name = ?, email = ?";
    let params = [name, email];

    if (phone !== undefined) {
        query += ", phone = ?";
        params.push(phone);
    }

    if (profile_image !== undefined) {
        query += ", profile_image = ?";
        params.push(profile_image);
    }

    query += " WHERE id = ?";
    params.push(req.params.id);

    db.run(query, params, function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: "Profile updated" });
    });
});

// Bookings: Create booking
app.post('/api/bookings', (req, res) => {
    const { user_id, venue_id, date, guests } = req.body;
    if (!user_id || !venue_id || !date || !guests) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    // Check if the date is unavailable
    db.get("SELECT unavailable_dates FROM venues WHERE id = ?", [venue_id], (err, venue) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!venue) return res.status(404).json({ error: "Venue not found" });

        let unavailable = [];
        try {
            unavailable = JSON.parse(venue.unavailable_dates || '[]');
        } catch (e) {
            unavailable = [];
        }

        if (unavailable.includes(date)) {
            return res.status(400).json({ error: "This date is marked as unavailable by the owner." });
        }

        db.run("INSERT INTO bookings (user_id, venue_id, date, guests) VALUES (?, ?, ?, ?)",
            [user_id, venue_id, date, guests],
            function (err) {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }

                // Increment bookings count
                db.run("UPDATE venues SET bookings_count = bookings_count + 1 WHERE id = ?", [venue_id]);

                res.status(201).json({ message: "Booking created", bookingId: this.lastID });
            });
    });
});

// Serve HTML pages (fallback)
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

const dbPath = path.resolve(__dirname, 'database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');

        // Users Table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            profile_image TEXT,
            phone TEXT
        )`);

        // Venues Table
        db.run(`CREATE TABLE IF NOT EXISTS venues (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            owner_id INTEGER,
            title TEXT NOT NULL,
            location TEXT NOT NULL,
            type TEXT NOT NULL,
            guests INTEGER NOT NULL,
            price INTEGER NOT NULL,
            rating REAL,
            reviews INTEGER DEFAULT 0,
            image TEXT,
            amenities TEXT,
            description TEXT,
            FOREIGN KEY(owner_id) REFERENCES users(id)
        )`, (err) => {
            if (!err) {
                // Seed initial venues if empty
                db.get("SELECT COUNT(*) as count FROM venues", (err, row) => {
                    if (row && row.count === 0) {
                        seedVenues();
                    }
                });
            }
        });

        // Bookings Table
        db.run(`CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            venue_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            guests INTEGER NOT NULL,
            status TEXT DEFAULT 'pending',
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(venue_id) REFERENCES venues(id)
        )`);

        // Database Migrations (Ignore errors if column already exists)
        const migrations = [
            "ALTER TABLE users ADD COLUMN profile_image TEXT",
            "ALTER TABLE users ADD COLUMN phone TEXT",
            "ALTER TABLE venues ADD COLUMN views INTEGER DEFAULT 0",
            "ALTER TABLE venues ADD COLUMN views_last_week INTEGER DEFAULT 0",
            "ALTER TABLE venues ADD COLUMN bookings_count INTEGER DEFAULT 0",
            "ALTER TABLE venues ADD COLUMN bookings_last_week INTEGER DEFAULT 0",
            "ALTER TABLE venues ADD COLUMN unavailable_dates TEXT",
            "ALTER TABLE venues ADD COLUMN description TEXT"
        ];

        migrations.forEach(sql => {
            db.run(sql, (err) => {
                if (err && !err.message.includes("duplicate column name")) {
                    console.error(`Migration error (${sql}):`, err.message);
                }
            });
        });
    }
});

function seedVenues() {
    console.log("Seeding venues...");
    const initialVenues = [
        {
            title: "Luxury Downtown Loft",
            location: "New York, NY",
            type: "Indoor",
            guests: 150,
            price: 450,
            rating: 4.92,
            reviews: 128,
            image: "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800&auto=format&fit=crop",
            amenities: ["Wifi", "Projector", "Catering", "Parking"]
        },
        {
            title: "Rooftop Garden Terrace",
            location: "Los Angeles, CA",
            type: "Rooftops",
            guests: 200,
            price: 650,
            rating: 4.88,
            reviews: 96,
            image: "https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=800&auto=format&fit=crop",
            amenities: ["Outdoor Space", "Bar", "Sound System", "City View"]
        },
        {
            title: "Botanical Garden Hall",
            location: "Chicago, IL",
            type: "Gardens",
            guests: 500,
            price: 1200,
            rating: 4.95,
            reviews: 234,
            image: "https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=800&auto=format&fit=crop",
            amenities: ["Greenery", "Outdoor", "Catering", "Parking"]
        },
        {
            title: "Historic School Auditorium",
            location: "Boston, MA",
            type: "Schools",
            guests: 300,
            price: 850,
            rating: 4.90,
            reviews: 156,
            image: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&auto=format&fit=crop",
            amenities: ["Stage", "Seating", "Sound System", "Parking"]
        },
        {
            title: "Boutique Hotel Ballroom",
            location: "Miami, FL",
            type: "Hotels",
            guests: 100,
            price: 380,
            rating: 4.85,
            reviews: 78,
            image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop",
            amenities: ["Luxury", "Bar", "Rooms", "Valet"]
        },
        {
            title: "Converted Warehouse",
            location: "Austin, TX",
            type: "Unique",
            guests: 400,
            price: 720,
            rating: 4.87,
            reviews: 112,
            image: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&auto=format&fit=crop",
            amenities: ["Industrial", "Lighting", "Bar", "Food Trucks"]
        }
    ];

    const stmt = db.prepare(`INSERT INTO venues (title, location, type, guests, price, rating, reviews, image, amenities) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    initialVenues.forEach(v => {
        stmt.run(v.title, v.location, v.type, v.guests, v.price, v.rating, v.reviews, v.image, JSON.stringify(v.amenities));
    });
    stmt.finalize();
    console.log("Venues seeded.");
}

module.exports = db;

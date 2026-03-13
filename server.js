const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const path = require('path');
const supabase = require('./supabaseClient');

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
app.get('/api/venues', async (req, res) => {
    try {
        // Only select fields needed for the venue cards to keep payload small
        let query = supabase.from('venues').select(`
            id, title, location, type, guests, price, rating, reviews, image, views
        `);

        if (req.query.location) {
            query = query.ilike('location', `%${req.query.location}%`);
        }
        if (req.query.guests) {
            query = query.gte('guests', parseInt(req.query.guests));
        }
        if (req.query.owner_id) {
            query = query.eq('owner_id', req.query.owner_id);
        }

        const { data, error } = await query;
        if (error) throw error;

        // If 'views' isn't available as a direct column, the query above might need adjustment
        // For now, let's just use the data as is to avoid the expensive join if possible
        const venues = data.map(v => ({
            ...v,
            views: v.views || 0
        }));

        res.json({ venues });
    } catch (err) {
        console.error("API error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// Get venue by ID with owner profile
app.get('/api/venues/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('venues')
            .select('*, users:owner_id(name, profile_image), venue_views(count)')
            .eq('id', req.params.id)
            .single();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: "Venue not found" });

        // Format to match existing frontend expectations
        const venue = {
            ...data,
            owner_name: data.users ? data.users.name : 'Unknown',
            owner_image: data.users ? data.users.profile_image : null,
            views: data.venue_views ? (data.venue_views[0] ? data.venue_views[0].count : 0) : 0
        };

        res.json({ venue });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create a new venue
app.post('/api/venues', async (req, res) => {
    const { owner_id, title, location, type, guests, price, rating, image, amenities, description } = req.body;

    try {
        let finalImage = image;
        if (image && typeof image !== 'string') {
            finalImage = JSON.stringify(image);
        }

        const { data, error } = await supabase
            .from('venues')
            .insert([{
                owner_id: owner_id,
                title: title || "New Venue",
                location,
                type,
                guests: guests || 50,
                price: price || 0,
                rating: rating || 0.0,
                reviews: 0,
                image: finalImage,
                amenities: JSON.stringify(amenities || []),
                description: description || ""
            }])
            .select();

        if (error) {
            console.error(`[POST /api/venues] Supabase Error:`, error);
            throw error;
        }
        res.status(201).json({ message: "Venue created", id: data[0].id });
    } catch (err) {
        console.error(`[POST /api/venues] Catch Error:`, err);
        res.status(500).json({ error: err.message });
    }
});

// Delete a venue by ID
app.delete('/api/venues/:id', async (req, res) => {
    try {
        const { error } = await supabase.from('venues').delete().eq('id', req.params.id);
        if (error) {
            console.error(`[DELETE /api/venues/${req.params.id}] Error:`, error);
            throw error;
        }
        res.json({ message: "Venue deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update venue unavailable dates
app.put('/api/venues/:id/availability', async (req, res) => {
    const { unavailable_dates } = req.body;
    try {
        const finalDates = JSON.stringify(unavailable_dates || []);
        const { error } = await supabase
            .from('venues')
            .update({ unavailable_dates: finalDates })
            .eq('id', req.params.id);

        if (error) {
            console.error(`[PUT /api/venues/${req.params.id}/availability] Error:`, error);
            throw error;
        }
        res.json({ message: "Availability updated" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update a venue by ID
app.put('/api/venues/:id', async (req, res) => {
    const { title, location, type, guests, price, image, amenities, unavailable_dates, description } = req.body;

    try {
        let finalImage = image;
        if (image && typeof image !== 'string') {
            finalImage = JSON.stringify(image);
        }

        const { error } = await supabase
            .from('venues')
            .update({
                title,
                location,
                type,
                guests,
                price,
                image: finalImage,
                amenities: JSON.stringify(amenities || []),
                unavailable_dates: JSON.stringify(unavailable_dates || []),
                description
            })
            .eq('id', req.params.id);

        if (error) {
            console.error(`[PUT /api/venues/${req.params.id}] Error:`, error);
            throw error;
        }
        res.json({ message: "Venue updated" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Increment venue views (Advanced Analytics)
app.post('/api/venues/:id/view', async (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    try {
        await supabase
            .from('venue_views')
            .insert([{ venue_id: req.params.id, ip_address: ip }]);

        res.json({ message: "View recorded" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Auth: Login
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('id, name, email, password_hash, role') // Explicitly NOT selecting profile_image
            .eq('email', email)
            .single();

        if (error || !user) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        const match = await bcrypt.compare(password, user.password_hash);
        if (match) {
            res.json({ message: "Login successful", user: { id: user.id, name: user.name, email: user.email, role: user.role } });
        } else {
            res.status(401).json({ error: "Invalid email or password" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Auth: Register
app.post('/api/auth/register', async (req, res) => {
    const { name, email, password, role, phone } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const userRole = role === 'owner' ? 'owner' : 'user';

        const { data, error } = await supabase
            .from('users')
            .insert([{ name, email, password_hash: hashedPassword, role: userRole, phone: phone || null }])
            .select();

        if (error) {
            console.error('[Register] Supabase Error:', error);
            return res.status(400).json({ error: "Email already exists or error creating user." });
        }
        res.status(201).json({
            message: "User created successfully",
            user: { id: data[0].id, name, email, role: userRole }
        });
    } catch (err) {
        console.error('[Register] Catch Error:', err);
        res.status(500).json({ error: "Server error" });
    }
});

// Get User Profile
app.get('/api/users/:id', async (req, res) => {
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('id, name, email, role, profile_image, phone')
            .eq('id', req.params.id)
            .single();

        if (error || !user) return res.status(404).json({ error: "User not found" });
        res.json({ user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update User Profile
app.put('/api/users/:id/profile', async (req, res) => {
    const { name, email, phone, profile_image } = req.body;
    try {
        const updateData = { name, email };
        if (phone !== undefined) updateData.phone = phone;
        if (profile_image !== undefined) updateData.profile_image = profile_image;

        const { error } = await supabase
            .from('users')
            .update(updateData)
            .eq('id', req.params.id);

        if (error) {
            console.error(`[PUT /api/users/${req.params.id}/profile] Error:`, error);
            throw error;
        }
        res.json({ message: "Profile updated" });
    } catch (err) {
        console.error(`[PUT /api/users/${req.params.id}/profile] Catch Error:`, err);
        res.status(500).json({ error: err.message });
    }
});

// Bookings: Create booking
app.post('/api/bookings', async (req, res) => {
    const { user_id, venue_id, date, guests } = req.body;
    if (!user_id || !venue_id || !date || !guests) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        const { data: venue, error: vErr } = await supabase
            .from('venues')
            .select('unavailable_dates, bookings_count')
            .eq('id', venue_id)
            .single();

        if (vErr || !venue) return res.status(404).json({ error: "Venue not found" });

        let unavailable = [];
        try {
            unavailable = JSON.parse(venue.unavailable_dates || '[]');
        } catch (e) { unavailable = []; }

        if (unavailable.includes(date)) {
            return res.status(400).json({ error: "This date is marked as unavailable by the owner." });
        }

        const { data: booking, error: bErr } = await supabase
            .from('bookings')
            .insert([{ user_id, venue_id, date, guests }])
            .select();

        if (bErr) throw bErr;

        // Increment bookings count
        await supabase.from('venues').update({ bookings_count: (venue.bookings_count || 0) + 1 }).eq('id', venue_id);

        res.status(201).json({ message: "Booking created", bookingId: booking[0].id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Favorites: Get user favorites
app.get('/api/users/:id/favorites', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('favorites')
            .select('venue_id')
            .eq('user_id', req.params.id);

        if (error) throw error;
        res.json({ favorites: data.map(f => f.venue_id) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Favorites: Toggle favorite
app.post('/api/favorites/toggle', async (req, res) => {
    const { user_id, venue_id } = req.body;
    try {
        // Check if exists
        const { data: existing } = await supabase
            .from('favorites')
            .select('*')
            .eq('user_id', user_id)
            .eq('venue_id', venue_id)
            .single();

        if (existing) {
            // Remove
            await supabase.from('favorites').delete().eq('id', existing.id);
            res.json({ message: "Removed from favorites", status: 'removed' });
        } else {
            // Add
            await supabase.from('favorites').insert([{ user_id, venue_id }]);
            res.json({ message: "Added to favorites", status: 'added' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Serve HTML pages (fallback)
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

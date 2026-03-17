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

// --- Supabase Storage Helpers ---
async function uploadBase64ToStorage(base64Data, subPath) {
    if (!base64Data || !base64Data.startsWith('data:')) return base64Data;

    try {
        const parts = base64Data.split(';base64,');
        if (parts.length !== 2) return base64Data;
        
        const contentType = parts[0].split(':')[1];
        const base64String = parts[1];
        const buffer = Buffer.from(base64String, 'base64');
        const extension = contentType.split('/')[1] || 'bin';
        
        const fileName = `${Date.now()}_${Math.floor(Math.random() * 10000)}.${extension}`;
        const filePath = `${subPath}/${fileName}`;

        const { data, error } = await supabase.storage
            .from('venues')
            .upload(filePath, buffer, {
                contentType: contentType,
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            console.error(`[STORAGE] Upload failed for ${filePath}:`, error);
            // If bucket doesn't exist, we might want to log it specifically
            if (error.message === 'Bucket not found') {
                console.error("IMPORTANT: Create a public bucket named 'venues' in Supabase Storage");
            }
            return base64Data; 
        }

        const { data: { publicUrl } } = supabase.storage
            .from('venues')
            .getPublicUrl(data.path);

        return publicUrl;
    } catch (err) {
        console.error("[STORAGE] Helper fatal error:", err);
        return base64Data;
    }
}

// --- API Endpoints ---

// Get all venues, optionally filter by location and guests
app.get('/api/venues', async (req, res) => {
    try {
        // Select fields needed for the venue cards
        let query = supabase.from('venues').select(`
            id, title, location, location_tags, type, event_categories, guests, price, rating, reviews, image, views, bookings_count, amenities, description, unavailable_dates, details_pdf
        `);

        if (req.query.location) {
            // Search both location and location_tags columns
            const searchTerm = req.query.location;
            query = query.or(`location.ilike.%${searchTerm}%,location_tags.ilike.%${searchTerm}%`);
        }
        if (req.query.guests) {
            query = query.gte('guests', parseInt(req.query.guests));
        }
        if (req.query.owner_id) {
            query = query.eq('owner_id', req.query.owner_id);
        }

        const { data, error } = await query;
        if (error) throw error;

        const venues = data.map(v => ({
            ...v,
            views: v.views || 0,
            location_tags: v.location_tags ? (typeof v.location_tags === 'string' ? JSON.parse(v.location_tags) : v.location_tags) : []
        }));

        res.json({ venues });
    } catch (err) {
        console.error("API error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// Get venue by ID (includes details_pdf)
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
    const { owner_id, title, location, location_tags, type, event_categories, guests, price, rating, image, amenities, details_pdf, description } = req.body;
    console.log('[POST /api/venues] Body:', { ...req.body, image: '...', details_pdf: '...' });
    console.log('[POST /api/venues] event_categories:', event_categories);

    try {
        // Handle images upload to storage
        let uploadedImages = [];
        if (Array.isArray(image)) {
            uploadedImages = await Promise.all(image.map(img => uploadBase64ToStorage(img, 'photos')));
        } else if (image) {
            uploadedImages = [await uploadBase64ToStorage(image, 'photos')];
        }

        // Handle PDF upload to storage
        const uploadedPdf = await uploadBase64ToStorage(details_pdf, 'documents');

        const { data, error } = await supabase
            .from('venues')
            .insert([{
                owner_id: owner_id,
                title: title || "New Venue",
                location,
                location_tags: JSON.stringify(location_tags || []),
                type,
                guests: guests || 50,
                price: price || 0,
                rating: rating || 0.0,
                reviews: 0,
                image: JSON.stringify(uploadedImages),
                amenities: JSON.stringify(amenities || []),
                event_categories: (Array.isArray(event_categories) && event_categories.length > 0) ? JSON.stringify(event_categories) : (typeof event_categories === 'string' && event_categories.length > 2 ? event_categories : null),
                details_pdf: uploadedPdf || null,
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
    const venueId = req.params.id;
    const numericId = parseInt(venueId);
    
    if (isNaN(numericId)) {
        return res.status(400).json({ error: "Invalid venue ID format" });
    }

    try {
        console.log(`[DELETE /api/venues/${numericId}] Initiating robust deletion...`);
        
        // 1. Delete associated venue_views
        const { error: viewsErr } = await supabase.from('venue_views').delete().eq('venue_id', numericId);
        if (viewsErr) console.warn(`[DELETE /api/venues/${numericId}] Warning deleting views:`, viewsErr);

        // 2. Delete associated favorites
        const { error: favsErr } = await supabase.from('favorites').delete().eq('venue_id', numericId);
        if (favsErr) console.warn(`[DELETE /api/venues/${numericId}] Warning deleting favorites:`, favsErr);

        // 3. Delete associated bookings
        const { error: bookingsErr } = await supabase.from('bookings').delete().eq('venue_id', numericId);
        if (bookingsErr) {
            console.error(`[DELETE /api/venues/${numericId}] ERROR deleting bookings:`, bookingsErr);
            return res.status(500).json({ error: "Could not clear associated bookings: " + bookingsErr.message });
        }

        // 4. Finally delete the venue
        const { error: venueErr } = await supabase.from('venues').delete().eq('id', numericId);
        if (venueErr) {
            console.error(`[DELETE /api/venues/${numericId}] Final Venue Delete Error:`, venueErr);
            return res.status(500).json({ error: "Failed to delete venue record: " + venueErr.message });
        }
        
        console.log(`[DELETE /api/venues/${numericId}] Deletion successful`);
        res.json({ message: "Venue deleted successfully" });
    } catch (err) {
        console.error(`[DELETE /api/venues/${numericId}] Catch Error:`, err);
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
    const { title, location, location_tags, type, event_categories, guests, price, image, amenities, details_pdf, unavailable_dates, description } = req.body;
    console.log('[PUT /api/venues] Body:', { ...req.body, image: '...', details_pdf: '...' });
    console.log('[PUT /api/venues] event_categories:', event_categories);

    try {
        // Handle images update
        let uploadedImages = image;
        if (Array.isArray(image)) {
            uploadedImages = await Promise.all(image.map(img => uploadBase64ToStorage(img, 'photos')));
        }

        // Handle PDF update
        const uploadedPdf = details_pdf !== undefined ? await uploadBase64ToStorage(details_pdf, 'documents') : undefined;
        
        const updatePayload = {
            title,
            location,
            location_tags: location_tags !== undefined ? JSON.stringify(location_tags || []) : undefined,
            type,
            guests,
            price,
            image: image !== undefined ? (typeof uploadedImages === 'string' ? uploadedImages : JSON.stringify(uploadedImages)) : undefined,
            amenities: amenities !== undefined ? JSON.stringify(amenities || []) : undefined,
            event_categories: event_categories !== undefined ? (Array.isArray(event_categories) ? JSON.stringify(event_categories) : event_categories) : undefined,
            unavailable_dates: unavailable_dates !== undefined ? JSON.stringify(unavailable_dates || []) : undefined,
            description
        };
        
        // Remove undefined fields to prevent overwriting with null
        Object.keys(updatePayload).forEach(key => updatePayload[key] === undefined && delete updatePayload[key]);

        if (uploadedPdf !== undefined) updatePayload.details_pdf = uploadedPdf;

        const { error } = await supabase
            .from('venues')
            .update(updatePayload)
            .eq('id', req.params.id);

        if (error) {
            console.error(`[PUT /api/venues/${req.params.id}] Error:`, error);
            throw error;
        }
        res.json({ message: "Venue updated" });
    } catch (err) {
        console.error(`[PUT /api/venues] Error:`, err);
        res.status(500).json({ error: err.message });
    }
});

// Increment venue views (Advanced Analytics)
app.post('/api/venues/:id/view', async (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const venueId = req.params.id;
    console.log(`[VIEW] Recording view for venue ${venueId} from IP ${ip}`);
    try {
        // 1. Record detailed view log
        const { error: logError } = await supabase
            .from('venue_views')
            .insert([{ venue_id: parseInt(venueId), ip_address: ip }]);

        if (logError) {
            console.error(`[VIEW] venue_views insert error:`, logError);
        } else {
            console.log(`[VIEW] Detail log saved to venue_views Table.`);
        }

        // 2. Increment counter in venues table for fast dashboard access
        const vid = parseInt(venueId);
        const { data: vData, error: fetchError } = await supabase.from('venues').select('views').eq('id', vid).single();
        if (fetchError) {
            console.error(`[VIEW] venues fetch error:`, fetchError);
        }

        const currentViews = vData ? (vData.views || 0) : 0;
        const { error: upError } = await supabase.from('venues').update({ views: currentViews + 1 }).eq('id', vid);
        
        if (upError) {
            console.error(`[VIEW] venues update error:`, upError);
        } else {
            console.log(`[VIEW] Counter incremented to ${currentViews + 1} for venue ${vid}`);
        }

        res.json({ message: "View recorded" });
    } catch (err) {
        console.error("[VIEW] Fatal Error:", err);
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
    const { user_id, venue_id, date, guests, status, start_date, end_date, contact_name, contact_email, contact_phone, total_price, event_category } = req.body;
    
    if (!venue_id) {
        return res.status(400).json({ error: "Missing venue_id" });
    }

    try {
        let finalUserId = user_id;

        // Auto-create or fetch guest user if not logged in
        if (!finalUserId && contact_email) {
            const { data: existingUser } = await supabase.from('users').select('id').eq('email', contact_email).single();
            if (existingUser) {
                finalUserId = existingUser.id;
            } else {
                const { data: newUser, error: numErr } = await supabase.from('users').insert([{ 
                    name: contact_name || 'Guest User', 
                    email: contact_email, 
                    phone: contact_phone || '', 
                    role: 'renter', 
                    password_hash: 'guest_' + Date.now() 
                }]).select();
                if (numErr) {
                    console.error("[BOOKING] User creation failed:", numErr);
                    throw new Error("Failed to create guest account: " + numErr.message);
                }
                if (newUser && newUser.length > 0) {
                    finalUserId = newUser[0].id;
                }
            }
        }

        if (!finalUserId && status !== 'owner_generated') {
            console.error("[BOOKING] Failed: Missing user info for guest", { contact_email, contact_name });
            return res.status(400).json({ error: "Missing user information for booking. Please ensure email and name are provided." });
        }

        const { data: venue, error: vErr } = await supabase.from('venues').select('unavailable_dates, bookings_count').eq('id', venue_id).single();
        if (vErr || !venue) return res.status(404).json({ error: "Venue not found" });

        let unavailable = [];
        try { unavailable = JSON.parse(venue.unavailable_dates || '[]'); } catch (e) { unavailable = []; }

        let finalDate = date;
        if (start_date && end_date) {
            finalDate = `${start_date} to ${end_date}`;
        } else if (start_date) {
            finalDate = start_date;
        }

        if (status !== 'owner_generated') {
            if (start_date && unavailable.includes(start_date)) {
                return res.status(400).json({ error: "This date is marked as unavailable by the owner." });
            }
        }

        const payload = { 
            user_id: finalUserId, 
            venue_id: parseInt(venue_id), 
            date: finalDate,
            guests: parseInt(guests) || 0,
            status: status || 'pending',
            contact_name: contact_name || null,
            contact_email: contact_email || null,
            contact_phone: contact_phone || null,
            event_category: event_category || null
        };

        const { data: booking, error: bErr } = await supabase.from('bookings').insert([payload]).select();
        if (bErr) throw bErr;

        if (status !== 'owner_generated') {
            await supabase.from('venues').update({ bookings_count: (venue.bookings_count || 0) + 1 }).eq('id', venue_id);
        }

        res.status(201).json({ message: "Booking created", bookingId: booking[0].id });
    } catch (err) {
        console.error("Booking err:", err);
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

// Bookings: Get owner's venues and their bookings
app.get('/api/owner/bookings/:ownerId', async (req, res) => {
    try {
        const ownerId = req.params.ownerId;
        
        // 1. Get venues
        const { data: venues, error: vErr } = await supabase.from('venues').select('id, title').eq('owner_id', ownerId);
        if (vErr) throw vErr;
        
        const venueIds = venues.map(v => v.id);
        if (venueIds.length === 0) return res.json({ bookings: [] });
        
        // 2. Get bookings with user details
        const { data: bookings, error: bErr } = await supabase
            .from('bookings')
            .select('*, users:user_id(name, email, phone), venues:venue_id(title)')
            .in('venue_id', venueIds)
            .order('created_at', { ascending: false });
            
        if (bErr) throw bErr;
        res.json({ bookings });
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

// Analytics: Get owner dashboard stats
app.get('/api/owner/analytics/:ownerId', async (req, res) => {
    try {
        const ownerId = req.params.ownerId;
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)).toISOString();
        const sixtyDaysAgo = new Date(now.getTime() - (60 * 24 * 60 * 60 * 1000)).toISOString();

        const { data: venues, error: vErr } = await supabase
            .from('venues')
            .select('id, title, views')
            .eq('owner_id', ownerId);

        if (vErr) throw vErr;
        console.log(`[ANALYTICS] Found ${venues.length} venues for owner ${ownerId}`);
        const venueIds = venues.map(v => v.id);
        const allTimeViewsSummary = venues.reduce((sum, v) => sum + (v.views || 0), 0);

        if (venueIds.length === 0) {
            return res.json({
                totalViews: 0,
                viewsChange: 0,
                totalBookings: 0,
                revenue: 0,
                chartData: { labels: [], views: [], bookings: [] }
            });
        }

        // 2. Get views for last 30 days and previous 30 days using standard 'created_at' column
        const { count: currentViews, error: cErr } = await supabase
            .from('venue_views')
            .select('*', { count: 'exact', head: true })
            .in('venue_id', venueIds)
            .gte('created_at', thirtyDaysAgo);

        const { count: previousViews, error: pErr } = await supabase
            .from('venue_views')
            .select('*', { count: 'exact', head: true })
            .in('venue_id', venueIds)
            .gte('created_at', sixtyDaysAgo)
            .lt('created_at', thirtyDaysAgo);

        // 3. Get bookings for last 30 days
        const { data: bookings, error: bErr } = await supabase
            .from('bookings')
            .select('id, created_at, guests, venue_id, venues(price)')
            .in('venue_id', venueIds)
            .gte('created_at', thirtyDaysAgo);

        // 4. Calculate Revenue (rough estimate)
        let totalRevenue = 0;
        bookings.forEach(b => {
             const price = b.venues ? b.venues.price : 0;
             totalRevenue += price;
        });

        // 5a. Get bookings from previous 30 days for trend comparison
        const { data: previousBookings, error: pbErr } = await supabase
            .from('bookings')
            .select('id')
            .in('venue_id', venueIds)
            .gte('created_at', sixtyDaysAgo)
            .lt('created_at', thirtyDaysAgo);

        const { data: venueViews } = await supabase
            .from('venues')
            .select('views')
            .in('id', venueIds);
        const allTimeViews = venueViews ? venueViews.reduce((sum, v) => sum + (v.views || 0), 0) : 0;
        
        // Sum total bookings for all time from bookings table for all owner venues
        const { count: allTimeBookings } = await supabase
            .from('bookings')
            .select('*', { count: 'exact', head: true })
            .in('venue_id', venueIds);

        console.log(`[ANALYTICS] Total views calculated: ${allTimeViews}, Recent views: ${currentViews}, All Time Bookings: ${allTimeBookings}`);

        // 6. Generate daily chart data for last 14 days
        const labels = [];
        const chartViews = [];
        const chartBookings = [];
        for (let i = 13; i >= 0; i--) {
            const date = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000));
            const dateStr = date.toISOString().split('T')[0];
            labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            chartViews.push(Math.floor(Math.random() * 50) + 10);
            chartBookings.push(bookings.filter(b => b.created_at.startsWith(dateStr)).length);
        }

        const viewsChange = previousViews > 0 ? ((currentViews - previousViews) / previousViews * 100) : (currentViews > 0 ? 100 : 0);
        const prevBookCount = previousBookings ? previousBookings.length : 0;
        const bookingsChange = prevBookCount > 0 ? ((bookings.length - prevBookCount) / prevBookCount * 100) : (bookings.length > 0 ? 100 : 0);

        res.json({
            totalViews: allTimeViews,
            recentViews: currentViews,
            viewsChange: Math.round(viewsChange * 10) / 10,
            totalBookings: allTimeBookings || bookings.length,
            bookingsChange: Math.round(bookingsChange * 10) / 10,
            revenue: totalRevenue,
            chartData: { labels, views: chartViews, bookings: chartBookings }
        });

    } catch (err) {
        console.error("Analytics Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// Serve HTML pages (fallback)
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

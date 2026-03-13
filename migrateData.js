const db = require('./database');
const supabase = require('./supabaseClient');

async function migrate() {
    console.log('--- Starting Data Migration from SQLite to Supabase ---');

    // 1. Migrate Users
    console.log('Migrating Users...');
    const users = await new Promise((resolve, reject) => {
        db.all("SELECT * FROM users", (err, rows) => err ? reject(err) : resolve(rows));
    });

    for (const user of users) {
        // Remove local ID to let Supabase generate its own, or keep it if you want to preserve relations
        const { id, ...userData } = user;
        const { data, error } = await supabase.from('users').upsert([{ id, ...userData }]);
        if (error) console.error(`Error migrating user ${user.email}:`, error.message);
    }
    console.log(`Migrated ${users.length} users.`);

    // 2. Migrate Venues
    console.log('Migrating Venues...');
    const venues = await new Promise((resolve, reject) => {
        db.all("SELECT * FROM venues", (err, rows) => err ? reject(err) : resolve(rows));
    });

    for (const venue of venues) {
        const { id, ...venueData } = venue;
        const { data, error } = await supabase.from('venues').upsert([{ id, ...venueData }]);
        if (error) console.error(`Error migrating venue ${venue.title}:`, error.message);
    }
    console.log(`Migrated ${venues.length} venues.`);

    // 3. Migrate Bookings
    console.log('Migrating Bookings...');
    const bookings = await new Promise((resolve, reject) => {
        db.all("SELECT * FROM bookings", (err, rows) => err ? reject(err) : resolve(rows));
    });

    for (const booking of bookings) {
        const { id, ...bookingData } = booking;
        const { data, error } = await supabase.from('bookings').upsert([{ id, ...bookingData }]);
        if (error) console.error(`Error migrating booking ${booking.id}:`, error.message);
    }
    console.log(`Migrated ${bookings.length} bookings.`);

    console.log('--- Migration Finished ---');
    process.exit(0);
}

migrate().catch(err => {
    console.error('Migration failed:', err.message);
    process.exit(1);
});

const supabase = require('./supabaseClient');

async function testConnection() {
    console.log('Testing Supabase connection...');
    try {
        const { data, error } = await supabase.from('venues').select('*').limit(1);

        if (error) {
            console.error('Error connecting to Supabase:', error.message);
            if (error.code === 'PGRST116' || error.message.includes('relation "venues" does not exist')) {
                console.log('TIP: It seems the "venues" table does not exist in your Supabase project yet.');
            }
        } else {
            console.log('Successfully connected to Supabase!');
            console.log('Data sample:', data);
        }
    } catch (err) {
        console.error('Unexpected error:', err.message);
    }
}

testConnection();

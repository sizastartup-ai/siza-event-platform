const supabase = require('./supabaseClient');

async function testQuery() {
    console.log('Fetching venues with event_categories...');
    const { data, error } = await supabase.from('venues').select('id, title, event_categories');
    
    if (error) {
        console.error('Fetch Error:', error);
    } else {
        console.log('Venues found:', data.length);
        data.forEach(v => {
            console.log(`ID: ${v.id}, Title: ${v.title}, Categories: ${v.event_categories}`);
        });
    }
}

testQuery();

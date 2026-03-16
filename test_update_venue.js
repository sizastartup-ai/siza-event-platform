const supabase = require('./supabaseClient');

async function testUpdate() {
    const venueId = 11; // Swahili Beach
    const categories = ["Weddings", "Concerts"];
    
    console.log(`Updating venue ${venueId} with categories:`, categories);
    
    const { data, error } = await supabase
        .from('venues')
        .update({ event_categories: JSON.stringify(categories) })
        .eq('id', venueId)
        .select();
    
    if (error) {
        console.error('Update Error:', error);
    } else {
        console.log('Update Success:', data[0]);
    }
}

testUpdate();

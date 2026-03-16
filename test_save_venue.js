const supabase = require('./supabaseClient');

async function testSave() {
    const venue = {
        title: "Test Venue Categories",
        location: "Nairobi",
        type: "Gardens",
        event_categories: JSON.stringify(["Weddings", "Picnics"]),
        guests: 100,
        price: 50000,
        description: "Testing if categories save"
    };

    console.log('Inserting venue with categories:', venue.event_categories);
    const { data, error } = await supabase.from('venues').insert([venue]).select();
    
    if (error) {
        console.error('Insert Error:', error);
    } else {
        console.log('Insert Success:', data[0]);
    }
}

testSave();

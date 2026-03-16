const supabase = require('./supabaseClient');

async function testSaveRaw() {
    const venue = {
        title: "Test Raw Array",
        location: "Nairobi",
        type: "Gardens",
        event_categories: ["Weddings", "Picnics"],
        guests: 100,
        price: 50000,
        description: "Testing if raw array saves"
    };

    console.log('Inserting venue with raw array:', venue.event_categories);
    const { data, error } = await supabase.from('venues').insert([venue]).select();
    
    if (error) {
        console.error('Insert Error:', error);
    } else {
        console.log('Insert Success:', data[0]);
    }
}

testSaveRaw();

const supabase = require('./supabaseClient');

async function testSupabase() {
    const testData = {
        title: 'Supabase JSONB Test ' + Date.now(),
        location: 'Test Location',
        type: 'Indoor Spaces',
        guests: 100,
        price: 0,
        category_pricing: { "Test": { "price": 100 } }
    };

    console.log("Inserting:", JSON.stringify(testData, null, 2));
    
    const { data, error } = await supabase
        .from('venues')
        .insert([testData])
        .select();

    if (error) {
        console.error("Insert Error:", error);
        return;
    }

    console.log("Inserted ID:", data[0].id);
    console.log("Inserted Data category_pricing:", JSON.stringify(data[0].category_pricing, null, 2));

    const { data: fetchResult, error: fetchError } = await supabase
        .from('venues')
        .select('id, title, location, category_pricing')
        .eq('id', data[0].id)
        .single();

    if (fetchError) {
        console.error("Fetch Error:", fetchError);
        return;
    }

    console.log("Fetched Data category_pricing:", JSON.stringify(fetchResult.category_pricing, null, 2));
}

testSupabase();
